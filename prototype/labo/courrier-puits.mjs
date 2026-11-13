// Un serveur de messagerie d'essai : il accepte les messages et les garde (le « puits »), pour mesurer ce que le relais envoie VRAIMENT par SMTP, avec le vrai échange :
// STARTTLS ou TLS d'emblée (certificat auto-signé que le relais est prié de croire : sa vérification n'est jamais coupée), AUTH PLAIN, enveloppe, DATA.
// `mode` : 'starttls' (offre STARTTLS), 'smtps' (TLS d'emblée), 'clair' (rien : le relais doit refuser, sauf `?tls=none` vers la machine). `refuse` : une expression
// des adresses refusées en 550. Rend `{ port, messages: [{ from, rcpt, data, user, chiffre }], close }`.
import net from 'node:net';
import tls from 'node:tls';

export function startSink({ mode = 'starttls', key, cert, user = 'relais', pass = 'secret', refuse = /^inconnu@/ } = {}) {
  const messages = [];
  const session = (raw, encrypted) => {
    const state = { from: '', rcpt: [], user: '', data: null, buffer: '', socket: raw, encrypted };
    const say = text => state.socket.write(`${text}\r\n`);
    const attach = socket => { socket.on('data', chunk => { state.buffer += chunk.toString('utf8'); pump(); }); socket.on('error', () => {}); };
    const finish = () => {
      messages.push({ from: state.from, rcpt: state.rcpt, data: state.data.replace(/\r\n\.\r\n$/, '\r\n').replace(/^\.\./gm, '.'), user: state.user, chiffre: state.encrypted });
      state.data = null; state.from = ''; state.rcpt = [];
      say('250 2.0.0 mis en file');
    };
    const command = line => {
      const upper = line.toUpperCase();
      if (upper.startsWith('EHLO') || upper.startsWith('HELO')) {
        say(`250-puits${mode === 'starttls' && !state.encrypted ? '\r\n250-STARTTLS' : ''}\r\n250-AUTH PLAIN\r\n250 8BITMIME`);
      } else if (upper === 'STARTTLS') {
        say('220 2.0.0 allez-y');
        const secured = new tls.TLSSocket(state.socket, { isServer: true, key, cert });
        state.socket = secured; state.encrypted = true; state.buffer = '';
        attach(secured);
      } else if (upper.startsWith('AUTH PLAIN')) {
        const [, who, secret] = Buffer.from(line.slice(11), 'base64').toString('utf8').split('\0');
        if (who === user && secret === pass) { state.user = who; say('235 2.7.0 ok'); } else say('535 5.7.8 refus');
      } else if (upper.startsWith('MAIL FROM:')) {
        state.from = line.slice(10).replace(/[<>]/g, ''); say('250 ok');
      } else if (upper.startsWith('RCPT TO:')) {
        const address = line.slice(8).replace(/[<>]/g, '');
        if (refuse && refuse.test(address)) say('550 5.1.1 adresse inconnue'); else { state.rcpt.push(address); say('250 ok'); }
      } else if (upper === 'DATA') { state.data = ''; say('354 allez-y'); } else if (upper === 'QUIT') { say('221 au revoir'); state.socket.end(); } else say('502 non géré');
    };
    function pump() {
      for (;;) {
        if (state.data !== null) {
          const end = (state.data + state.buffer).indexOf('\r\n.\r\n');
          if (end < 0) { state.data += state.buffer; state.buffer = ''; return; }
          const all = state.data + state.buffer;
          state.data = all.slice(0, end + 5); state.buffer = all.slice(end + 5);
          finish();
        } else {
          const at = state.buffer.indexOf('\r\n');
          if (at < 0) return;
          const line = state.buffer.slice(0, at);
          state.buffer = state.buffer.slice(at + 2);
          command(line);
        }
      }
    }
    attach(raw);
    say('220 puits ESMTP');
  };
  const server = mode === 'smtps'
    ? tls.createServer({ key, cert }, socket => session(socket, true))
    : net.createServer(socket => session(socket, false));
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ port: server.address().port, messages, close: () => new Promise(done => server.close(done)) })));
}
