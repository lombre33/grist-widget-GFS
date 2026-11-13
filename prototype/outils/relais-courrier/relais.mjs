// Le relais de courrier : reçoit de Grist (webhook) les lignes « à envoyer » de la boîte d'envoi d'un document, les envoie par le serveur de messagerie, et rend
// l'accusé par le formulaire public du document. Un petit serveur, sans dépendance. Réglages par l'environnement :
//   RELAIS_SECRET   le secret que GFS a posé dans le webhook (en-tête `Authorization: Bearer …`, ou `?cle=…` dans l'adresse) ; obligatoire
//   SMTP_URL        smtp://utilisateur:motdepasse@hôte:587 (STARTTLS), smtps://… (TLS d'emblée) ; voir smtp.mjs
//   SMTP_CA         (facultatif) fichier PEM d'une autorité à croire en plus du système
//   DE              l'adresse d'expédition (celle du compte SMTP) ; obligatoire
//   ACCUSE_URL      l'adresse d'écriture du formulaire de GFS_Courrier_Retours (…/api/s/<clé>/tables/GFS_Courrier_Retours/records?flat=1) ; obligatoire
//   ECOUTE          adresse:port d'écoute (127.0.0.1:8787 par défaut : derrière un serveur web qui porte le https)
//   MEMOIRE         fichier où le relais retient ce qu'il a envoyé (./relais-memoire.json) ; PAR_HEURE : plafond d'envois par heure (200)
// Le relais ne lit aucune adresse dans ce qu'il reçoit : il n'écrit qu'à l'adresse de son réglage, et n'envoie que par son serveur de messagerie.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { timingSafeEqual } from 'node:crypto';
import { createDelivery } from './livraison.mjs';
import { buildMessage } from './mime.mjs';
import { smtpSend } from './smtp.mjs';

const MAX_BODY = 1024 * 1024;
const KEEP_MS = 7 * 24 * 3600 * 1000;

// Ce que le relais a déjà envoyé, dans un fichier (7 jours) : un redémarrage ne renvoie rien.
export function fileMemory(path, now = () => Date.now()) {
  let known = {};
  try { known = JSON.parse(readFileSync(path, 'utf8')); } catch (error) { known = {}; }
  const save = () => { try { writeFileSync(path, JSON.stringify(known)); } catch (error) { console.warn(`mémoire non écrite : ${error.message}`); } };
  return {
    has: key => Object.prototype.hasOwnProperty.call(known, key) && now() - known[key] < KEEP_MS,
    add: key => { known[key] = now(); for (const old of Object.keys(known)) if (now() - known[old] >= KEEP_MS) delete known[old]; save(); },
  };
}

// L'accusé : une ligne dans GFS_Courrier_Retours, par le formulaire public (trois essais).
export function formAck(url, fetcher = fetch) {
  return async (row, state, detail) => {
    const body = JSON.stringify([{ Courrier: row.id, Cle: row.Cle, Relance: Number(row.Relance) || 0, Etat: state, Detail: String(detail || '').slice(0, 200) }]);
    let failure = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetcher(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(15000) });
        if (response.ok) return;
        failure = new Error(`HTTP ${response.status}`);
      } catch (error) { failure = error; }
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
    throw failure;
  };
}

// Le secret : en-tête `Authorization: Bearer …` (ce que GFS pose) ou `?cle=…` (les services qui ne lisent pas les en-têtes).
export function authorized(request, secret) {
  const given = String((request.headers.authorization || '').replace(/^Bearer\s+/i, '') || new URL(request.url, 'http://x').searchParams.get('cle') || '');
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createRelay({ secret, delivery }) {
  return createServer((request, response) => {
    const reply = (status, body) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(body)); };
    if (request.method !== 'POST') return reply(405, { error: 'POST seulement' });
    if (!authorized(request, secret)) return reply(401, { error: 'secret refusé' });
    let size = 0;
    const chunks = [];
    request.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) { reply(413, { error: 'trop gros' }); request.destroy(); } else chunks.push(chunk);
    });
    request.on('end', async () => {
      if (size > MAX_BODY) return;
      let rows;
      try { rows = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (error) { return reply(400, { error: 'JSON attendu' }); }
      try {
        const done = await delivery.handle(rows);
        reply(done.status, { results: done.results });
      } catch (error) {
        console.error(`livraison en échec : ${error.message}`);
        reply(500, { error: 'échec' });
      }
    });
  });
}

export function relayFromEnv(env = process.env) {
  for (const name of ['RELAIS_SECRET', 'SMTP_URL', 'DE', 'ACCUSE_URL']) if (!env[name]) throw new Error(`Réglage manquant : ${name}`);
  if (env.RELAIS_SECRET.length < 32) throw new Error('RELAIS_SECRET : 32 caractères au moins (celui que GFS a posé).');
  const ca = env.SMTP_CA ? readFileSync(env.SMTP_CA, 'utf8') : undefined;
  const send = async (mail, id) => {
    const data = buildMessage({ message: mail, from: env.DE, id });
    return smtpSend({ url: env.SMTP_URL, ca, from: env.DE, recipients: [...mail.to, ...mail.cc, ...mail.bcc], data });
  };
  const delivery = createDelivery({ send, ack: formAck(env.ACCUSE_URL), memory: fileMemory(env.MEMOIRE || './relais-memoire.json'), perHour: Number(env.PAR_HEURE) || 200 });
  return createRelay({ secret: env.RELAIS_SECRET, delivery });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [host, port] = (process.env.ECOUTE || '127.0.0.1:8787').split(':');
  relayFromEnv().listen(Number(port), host, () => process.stderr.write(`Relais de courrier à l'écoute sur ${host}:${port}\n`));
}
