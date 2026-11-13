// Le message d'un e-mail de la boîte d'envoi, en texte brut prêt pour SMTP (lignes finies par CRLF). Les règles de rules.js ont déjà refusé tout retour à la ligne
// dans un champ d'en-tête ; ici, rien d'autre n'entre dans un en-tête que ces champs, encodés si besoin (mots codés, RFC 2047). Le corps part en base64, UTF-8.
import { randomBytes } from 'node:crypto';

const CRLF = '\r\n';
const base64 = text => Buffer.from(text, 'utf8').toString('base64');
const wrap = encoded => (encoded.match(/.{1,76}/g) || ['']).join(CRLF);

// Un en-tête en ASCII reste tel quel ; sinon des mots codés de 75 caractères au plus, coupés entre deux caractères (jamais au milieu d'un octet d'UTF-8).
export function encodeHeader(value) {
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  const words = [];
  let current = '';
  for (const char of value) {
    if (base64(current + char).length > 60) { words.push(current); current = ''; }
    current += char;
  }
  words.push(current);
  return words.map(word => `=?UTF-8?B?${base64(word)}?=`).join(`${CRLF} `);
}

// `message` : le verdict de rules.js (`to`, `cc`, `subject`, `text`, `html`, `replyTo`) ; `from` : l'adresse du relais ; `id` : un identifiant stable de l'envoi
// (le même pour la même demande, donc pour un envoi retenté) ; `date` : un Date.
export function buildMessage({ message, from, id, date = new Date() }) {
  const domain = from.split('@')[1];
  const headers = [
    `From: ${from}`, `To: ${message.to.join(', ')}`, message.cc.length ? `Cc: ${message.cc.join(', ')}` : '', message.replyTo ? `Reply-To: ${message.replyTo}` : '',
    `Subject: ${encodeHeader(message.subject)}`, `Date: ${date.toUTCString().replace('GMT', '+0000')}`, `Message-ID: <${id}@${domain}>`, 'MIME-Version: 1.0',
    'X-Mailer: Grist Factory Suite, relais de courrier',
  ].filter(Boolean);
  if (!message.html.trim()) return [...headers, 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64', '', wrap(base64(message.text))].join(CRLF) + CRLF;
  const boundary = `gfs-${randomBytes(12).toString('hex')}`;
  const part = (type, body) => [`--${boundary}`, `Content-Type: ${type}; charset=utf-8`, 'Content-Transfer-Encoding: base64', '', wrap(base64(body))].join(CRLF);
  const plain = message.text.trim() ? message.text : message.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return [...headers, `Content-Type: multipart/alternative; boundary="${boundary}"`, '', part('text/plain', plain), part('text/html', message.html), `--${boundary}--`, ''].join(CRLF);
}
