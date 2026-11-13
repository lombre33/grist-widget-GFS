// Ce que fait le relais d'une livraison de Grist (les lignes « à envoyer » de la boîte d'envoi) : pour chaque ligne, les règles, l'envoi, l'accusé. Sans réseau ni
// fichier ici : `send`, `ack`, `memory` sont donnés (relais.mjs les branche, les essais les remplacent).
//   - une ligne déjà envoyée n'est jamais renvoyée : Grist retente une livraison tant que le relais n'a pas répondu 2xx, avec les lignes qu'il avait déjà envoyées ;
//     chaque envoi est retenu par (numéro de ligne, clé, relance) : une relance voulue (le numéro monte) part, un doublon non ;
//   - un refus définitif (une règle, un 5xx du serveur de messagerie) est accusé « erreur » avec son motif et ne bloque pas les autres lignes ;
//   - un échec passager (réseau muet, 4xx, plafond horaire) répond 502 : Grist retentera, et ce qui est déjà parti ne repart pas ;
//   - une ligne sans numéro ni clé valable est ignorée : rien ne permettrait d'en rendre l'accusé.
import { checkMail } from '../../js/mail/rules.js';

const KEY = /^[0-9a-f]{16,64}$/;
const HOUR = 3600 * 1000;

// `send(mail, id)` envoie et rend `{ refused: [adresses] }` (lève une erreur dont `permanent` dit si elle est définitive) ; `ack(row, state, detail)` rend l'accusé ; `memory` : { has(key), add(key) } ;
// `perHour` : plafond d'envois par heure ; `now()` : l'heure en millisecondes.
export function createDelivery({ send, ack, memory, perHour = 200, now = () => Date.now() }) {
  const sentAt = [];
  const budget = () => {
    while (sentAt.length && now() - sentAt[0] > HOUR) sentAt.shift();
    return sentAt.length < perHour;
  };
  const record = (row, state, detail) => ack(row, state, detail).catch(error => console.warn(`accusé non rendu pour la ligne ${row.id} : ${error.message}`));

  async function one(row) {
    const id = `${row.Cle}.${row.id}.${Number(row.Relance) || 0}`;
    if (memory.has(id)) return { id: row.id, state: 'deja' };
    const mail = checkMail(row);
    if (!mail.ok) { memory.add(id); await record(row, 'erreur', mail.code); return { id: row.id, state: 'erreur', detail: mail.code }; }
    if (!budget()) return { id: row.id, state: 'a-reessayer', detail: 'perHour' };
    let outcome;
    try {
      outcome = await send(mail, id);
    } catch (error) {
      if (!error.permanent) return { id: row.id, state: 'a-reessayer', detail: String(error.message).slice(0, 120) };
      memory.add(id);
      await record(row, 'erreur', String(error.message).slice(0, 200));
      return { id: row.id, state: 'erreur', detail: 'refus' };
    }
    sentAt.push(now());
    memory.add(id);
    const refused = (outcome && outcome.refused) || [];
    await record(row, 'envoye', `Message-ID <${id}>${refused.length ? ` ; ${refused.length} adresse(s) refusée(s) par le serveur` : ''}`);
    return { id: row.id, state: 'envoye' };
  }

  // `rows` : le corps JSON de la livraison (un tableau de lignes). Rend `{ status, results }` : 200 si chaque ligne est réglée, 502 s'il en reste une à réessayer.
  async function handle(rows) {
    if (!Array.isArray(rows)) return { status: 400, results: [] };
    const results = [];
    for (const row of rows) {
      const usable = row && Number.isInteger(row.id) && typeof row.Cle === 'string' && KEY.test(row.Cle);
      results.push(usable ? await one(row) : { id: row && row.id, state: 'ignoree' });
    }
    return { status: results.some(result => result.state === 'a-reessayer') ? 502 : 200, results };
  }

  return { handle };
}
