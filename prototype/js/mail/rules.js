// Les règles d'un e-mail déposé dans la boîte d'envoi (`GFS_Courrier`), écrites une seule fois : GFS les applique avant d'écrire la ligne, le relais les
// applique de nouveau avant d'envoyer (il ne fait jamais confiance à ce qu'il reçoit : une ligne peut venir d'un autre outil que GFS). Rien ici ne touche au
// réseau ni à la
// page : un texte entre, un verdict sort.
//   - une adresse est une adresse nue, `nom@domaine.tld`, en ASCII : pas de « Nom <adresse> », pas de commentaire, pas de retour à la ligne (c'est ainsi qu'on
//     glisse un en-tête de plus, « Bcc: », dans un message) ;
//   - les champs qui deviennent un en-tête (objet, répondre à) tiennent sur une ligne ;
//   - des plafonds : destinataires, objet, texte.
export const LIMITS = { recipients: 50, subject: 200, body: 200000, address: 254 };

const ADDRESS = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
const CONTROL = /[\u0000-\u001f\u007f\u2028\u2029]/;
const text = value => String(value == null ? '' : value);

// Les adresses d'un champ, séparées par « , » ou « ; » ; une liste vide si le champ est vide. `null` si une entrée n'est pas une adresse.
export function splitAddresses(field) {
  if (CONTROL.test(text(field))) return null;
  const parts = text(field).split(/[,;]/).map(part => part.trim()).filter(Boolean);
  return parts.every(part => part.length <= LIMITS.address && ADDRESS.test(part)) ? parts : null;
}

// Les trois listes de destinataires : `{ to, cc, bcc }` ou `{ code }`.
function recipients(row) {
  const keys = ['Destinataires', 'Copie', 'CopieCachee'];
  if (keys.some(key => CONTROL.test(text(row[key])))) return { code: 'headerBreak' };
  const [to, cc, bcc] = keys.map(key => splitAddresses(row[key]));
  if (!to || !cc || !bcc) return { code: 'badAddress' };
  if (!to.length) return { code: 'noRecipient' };
  return to.length + cc.length + bcc.length > LIMITS.recipients ? { code: 'tooMany' } : { to, cc, bcc };
}

// Les deux champs qui deviennent un en-tête : `{ subject, replyTo }` ou `{ code }`.
function headers(row) {
  if (CONTROL.test(text(row.Objet) + text(row.RepondreA))) return { code: 'headerBreak' };
  if (text(row.Objet).length > LIMITS.subject) return { code: 'tooLong' };
  const reply = splitAddresses(row.RepondreA);
  if (!reply || reply.length > 1) return { code: 'badAddress' };
  return { subject: text(row.Objet), replyTo: reply[0] || '' };
}

// Le verdict pour une ligne de la boîte d'envoi : `{ ok: true, to, cc, bcc, subject, text, html, replyTo }` ou `{ ok: false, code }`. Les codes : `headerBreak`
// (un retour à la ligne ou un caractère de commande dans un champ d'en-tête), `badAddress`, `noRecipient`, `tooMany`, `tooLong`, `noBody`.
export function checkMail(row) {
  const who = recipients(row);
  if (who.code) return { ok: false, code: who.code };
  const head = headers(row);
  if (head.code) return { ok: false, code: head.code };
  const body = { text: text(row.Corps), html: text(row.Html) };
  if (body.text.length > LIMITS.body || body.html.length > LIMITS.body) return { ok: false, code: 'tooLong' };
  if (!body.text.trim() && !body.html.trim()) return { ok: false, code: 'noBody' };
  return { ok: true, ...who, ...head, ...body };
}
