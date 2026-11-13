// Un client SMTP de soumission, sans dépendance : connexion (TLS d'emblée sur `smtps://`, STARTTLS sur `smtp://`), identification (AUTH PLAIN), enveloppe, message.
// Le relais envoie par le serveur de messagerie de l'administration ; il n'écoute rien.
//   - `smtp://[utilisateur:motdepasse@]hôte[:587]` : STARTTLS exigé (refus si le serveur ne l'offre pas) ;
//   - `smtps://[utilisateur:motdepasse@]hôte[:465]` : TLS d'emblée ;
//   - `smtp://…?tls=none` : sans chiffrement, seulement vers la machine elle-même (127.0.0.1, localhost) : les essais ;
//   - `ca` : le certificat (PEM) d'une autorité à croire en plus de celles du système (un serveur interne) ; la vérification du certificat n'est jamais coupée.
// Une erreur porte `permanent` : vrai pour un refus définitif du serveur (5xx : l'adresse n'existe pas, le message est refusé), faux pour tout le reste (4xx, réseau
// muet, délai : on peut réessayer).
import net from 'node:net';
import tls from 'node:tls';

export class SmtpError extends Error {
  constructor(message, { permanent = false, code = 0 } = {}) {
    super(message);
    this.permanent = permanent;
    this.code = code;
  }
}

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);

export function parseSmtpUrl(url) {
  const parsed = new URL(url);
  const secure = parsed.protocol === 'smtps:';
  if (!secure && parsed.protocol !== 'smtp:') throw new SmtpError('Adresse SMTP : smtp:// ou smtps:// attendu.', { permanent: true });
  const plain = parsed.searchParams.get('tls') === 'none';
  if (plain && !LOOPBACK.has(parsed.hostname)) throw new SmtpError('Sans chiffrement, seulement vers cette machine.', { permanent: true });
  return {
    host: parsed.hostname, port: Number(parsed.port) || (secure ? 465 : 587), secure, plain,
    user: decodeURIComponent(parsed.username), pass: decodeURIComponent(parsed.password),
  };
}

// Lit les réponses du socket en cours : `reply()` rend `{ code, lines }` (une réponse sur plusieurs lignes « 250-… » finit par « 250 … »). `use(socket)` change de
// socket (STARTTLS) : l'ancien n'est plus écouté, ce qui reste du tampon est jeté.
function reader(timeoutMs) {
  const waiting = [];
  let buffer = '';
  let failure = null;
  let current = null;
  let handlers = [];
  const flush = () => {
    let end;
    while (waiting.length && (end = /(^|\r\n)(\d{3}) [^\r\n]*\r\n/.exec(buffer))) {
      const text = buffer.slice(0, end.index + end[0].length);
      buffer = buffer.slice(text.length);
      const lines = text.split('\r\n').filter(Boolean);
      waiting.shift().resolve({ code: Number(lines[lines.length - 1].slice(0, 3)), lines });
    }
  };
  const fail = error => { failure = failure || error; while (waiting.length) waiting.shift().reject(failure); };
  const closed = () => fail(new SmtpError('Le serveur a fermé la connexion.'));
  const use = target => {
    for (const [event, handler] of handlers) current.removeListener(event, handler);
    current = target;
    buffer = '';
    handlers = [['data', chunk => { buffer += chunk.toString('utf8'); flush(); }], ['error', fail], ['close', closed]];
    for (const [event, handler] of handlers) target.on(event, handler);
    target.setTimeout(timeoutMs, () => { fail(new SmtpError('Le serveur ne répond pas.')); target.destroy(); });
  };
  return {
    start: target => { current = target; use(target); },
    use,
    reply: () => new Promise((resolve, reject) => { if (failure) reject(failure); else { waiting.push({ resolve, reject }); flush(); } }),
  };
}

const expect = (answer, ok) => {
  if (answer.code >= ok && answer.code < ok + 100) return answer;
  throw new SmtpError(`SMTP ${answer.lines[answer.lines.length - 1]}`.slice(0, 200), { permanent: answer.code >= 500, code: answer.code });
};

const connect = (config, options) => new Promise((resolve, reject) => {
  const socket = config.secure ? tls.connect({ host: config.host, port: config.port, ...options }) : net.connect({ host: config.host, port: config.port });
  socket.once(config.secure ? 'secureConnect' : 'connect', () => { socket.removeListener('error', reject); resolve(socket); });
  socket.once('error', reject);
}).catch(error => { throw new SmtpError(`Connexion impossible : ${error.code || error.message}`); });

// STARTTLS : le serveur doit l'offrir ; le socket devient chiffré, et la conversation reprend par un nouveau EHLO.
async function upgrade({ socket, lines, say, options, features }) {
  if (!features.lines.some(line => /STARTTLS/i.test(line))) throw new SmtpError('Le serveur n’offre pas STARTTLS.', { permanent: true });
  await say('STARTTLS', 200);
  const secured = tls.connect({ socket, ...options });
  await new Promise((resolve, reject) => { secured.once('secureConnect', resolve); secured.once('error', reject); })
    .catch(error => { throw new SmtpError(`TLS refusé : ${error.code || error.message}`); });
  lines.use(secured);
  return secured;
}

// Envoie `data` (le message, CRLF) de `from` à `recipients`. Rend `{ refused: [adresses refusées] }` ; lève si aucune adresse n'est acceptée.
export async function smtpSend({ url, ca, from, recipients, data, hello = 'relais.local', timeoutMs = 20000 }) {
  const config = parseSmtpUrl(url);
  const options = { servername: net.isIP(config.host) ? undefined : config.host, ca: ca ? [ca] : undefined, rejectUnauthorized: true };
  let socket = await connect(config, options);
  const lines = reader(timeoutMs);
  lines.start(socket);
  const say = async (command, ok) => { socket.write(`${command}\r\n`); return expect(await lines.reply(), ok); };
  try {
    expect(await lines.reply(), 200);
    const features = await say(`EHLO ${hello}`, 200);
    if (!config.secure && !config.plain) {
      socket = await upgrade({ socket, lines, say, options, features });
      await say(`EHLO ${hello}`, 200);
    }
    if (config.user) await say(`AUTH PLAIN ${Buffer.from(`\0${config.user}\0${config.pass}`).toString('base64')}`, 200);
    await say(`MAIL FROM:<${from}>`, 200);
    const refused = [];
    const codes = [];
    for (const address of recipients) {
      socket.write(`RCPT TO:<${address}>\r\n`);
      const answer = await lines.reply();
      if (answer.code >= 400) { refused.push(address); codes.push(answer.code); } else expect(answer, 200);
    }
    if (refused.length === recipients.length) throw new SmtpError('Aucune adresse n’est acceptée par le serveur.', { permanent: codes.every(code => code >= 500), code: codes[0] });
    await say('DATA', 300);
    socket.write(`${data.replace(/^\./gm, '..')}${data.endsWith('\r\n') ? '' : '\r\n'}.\r\n`);
    expect(await lines.reply(), 200);
    socket.write('QUIT\r\n');
    return { refused };
  } finally {
    socket.end();
  }
}
