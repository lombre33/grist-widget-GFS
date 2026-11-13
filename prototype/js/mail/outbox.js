// La boîte d'envoi des e-mails : « le courrier est une ligne ». Une table du document, `GFS_Courrier`, que les apps remplissent ; un relais (un script ou un
// service, hors de GFS) la vide quand Grist l'appelle par un webhook, puis rend son accusé par le formulaire public de `GFS_Courrier_Retours` : le relais ne
// détient aucune clé du document (le tour du partage entre documents). Ce module prépare le document et dépose les lignes ; il n'envoie rien lui-même.
//   - `ensureOutbox` : crée les deux tables, seulement après l'accord de la personne (`accept` reçoit ce qui sera ajouté), relit le nom réel de chaque table
//     après sa création, et n'ajoute que ce qui manque ;
//   - `armRelay` : le webhook de la boîte d'envoi vers l'adresse du relais, filtré par une condition (seules les lignes « à envoyer » partent), avec un secret
//     dans l'en-tête `Authorization` ; `disarmRelay` le retire ;
//   - `enqueue` : une ligne « à envoyer », après les règles de rules.js ; `requeue` : renvoyer une ligne (un envoi voulu, jamais un doublon).
// Tout passe par le port de GFS (js/sharing/sync-port.js) ; le cadre d'envoi ne sert qu'à régler le secret du webhook (le port n'a pas cette opération).
import { checkMail } from './rules.js';

export const OUTBOX = 'GFS_Courrier';
export const RETURNS = 'GFS_Courrier_Retours';
export const QUEUED = 'a-envoyer';
export const WEBHOOK_NAME = 'Courrier : relais';
const CONDITION = '$Statut == "a-envoyer"';

// L'accusé : une ligne par envoi (ou par échec), écrite par le relais. `Cle` et `Relance` relient l'accusé à CETTE demande : sans la clé de la ligne, que seuls
//   le relais et les éditeurs du document voient, un accusé reçu par le lien public ne change rien.
const RETURNS_COLUMNS = [
  { id: 'Courrier', type: 'Int' }, { id: 'Cle', type: 'Text' }, { id: 'Relance', type: 'Int' }, { id: 'Etat', type: 'Text' }, { id: 'Detail', type: 'Text' },
  { id: 'RecuLe', type: 'DateTime:UTC', isFormula: false, formula: 'NOW()' },
];

const STATUS_FORMULA = returns => [
  `back = ${returns}.lookupRecords(Courrier=$id, Cle=$Cle, Relance=$Relance, sort_by="id")`,
  'return back[-1].Etat if back else ($Demande or "brouillon")',
].join('\n');
const DETAIL_FORMULA = returns => [
  `back = ${returns}.lookupRecords(Courrier=$id, Cle=$Cle, Relance=$Relance, sort_by="id")`,
  'return back[-1].Detail if back else ""',
].join('\n');

const text = id => ({ id, type: 'Text' });
const outboxColumns = returns => [
  text('Destinataires'), text('Copie'), text('CopieCachee'), text('Objet'), text('Corps'), text('Html'), text('RepondreA'),
  { id: 'Demande', type: 'Choice', widgetOptions: JSON.stringify({ choices: ['brouillon', QUEUED] }) },
  { id: 'Relance', type: 'Int' },
  { id: 'Cle', type: 'Text', isFormula: false, formula: 'import uuid\nreturn uuid.uuid4().hex' },
  { id: 'Statut', type: 'Text', isFormula: true, formula: STATUS_FORMULA(returns) },
  { id: 'Detail', type: 'Text', isFormula: true, formula: DETAIL_FORMULA(returns) },
];

const missingIn = (schema, tableId, wanted) => {
  const have = schema.has(tableId) ? new Set(schema.columns(tableId).map(column => column.colId)) : null;
  return { tableId, exists: have !== null, missing: wanted.filter(column => !have || !have.has(column.id)) };
};

// Ce qui manque au document : `{ returns, outbox }`, chacun `{ tableId, exists, missing: [colonnes] }`. Les colonnes de la boîte citent le nom de la table des
// accusés, que le plan suppose `RETURNS` (le nom réel est relu après sa création).
export const outboxPlan = schema => ({ returns: missingIn(schema, RETURNS, RETURNS_COLUMNS), outbox: missingIn(schema, OUTBOX, outboxColumns(RETURNS)) });
export const planIsDone = plan => [plan.returns, plan.outbox].every(part => part.exists && !part.missing.length);

// Crée la table, ou ajoute les colonnes qui lui manquent (rien d'autre : jamais une colonne retirée ni réécrite). Rend le nom réel de la table.
async function settle(port, part, columns) {
  const info = ({ id, ...rest }) => rest;
  if (!part.exists) {
    const created = (await port.apply([['AddTable', part.tableId, columns]])).retValues[0];
    return (created && created.table_id) || part.tableId;
  }
  if (part.missing.length) await port.apply(part.missing.map(column => ['AddColumn', part.tableId, column.id, info(column)]));
  return part.tableId;
}

// Le document a-t-il sa boîte d'envoi ? Sinon, la crée après l'accord : `accept({ tables, columns })` rend vrai ou faux. Rend `{ ready, outbox, returns,
// created }`, ou `{ ready: false, declined: true }` : rien n'a été écrit.
export async function ensureOutbox(port, { accept }) {
  const plan = outboxPlan(await port.readSchema());
  if (planIsDone(plan)) return { ready: true, outbox: OUTBOX, returns: RETURNS, created: false };
  const parts = [plan.returns, plan.outbox];
  const wish = { tables: parts.filter(part => !part.exists).map(part => part.tableId),
    columns: parts.flatMap(part => (part.exists ? part.missing.map(column => `${part.tableId}.${column.id}`) : [])) };
  if (!(await accept(wish))) return { ready: false, declined: true };
  const returns = await settle(port, plan.returns, RETURNS_COLUMNS);
  const outbox = await settle(port, plan.outbox, outboxColumns(returns));
  return { ready: true, outbox, returns, created: true };
}

// Une adresse de relais : https, sauf une adresse de la machine elle-même quand `loopback` est vrai (les essais). `null` si elle convient, sinon le code.
export function checkRelayUrl(url, { loopback = false } = {}) {
  let parsed;
  try { parsed = new URL(url); } catch (error) { return 'badUrl'; }
  if (parsed.username || parsed.password) return 'badUrl';
  if (parsed.protocol === 'https:') return null;
  return loopback && parsed.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(parsed.hostname) ? null : 'notHttps';
}

// Un secret au hasard (24 octets, en hexadécimal), à coller dans la configuration du relais.
export function newSecret(crypto = globalThis.crypto) {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)), byte => byte.toString(16).padStart(2, '0')).join('');
}

// Les webhooks de ce nom : la liste de Grist (propriétaires seulement).
const relayHooks = async port => (await port.listWebhooks()).filter(hook => hook.fields && hook.fields.name === WEBHOOK_NAME);

export async function disarmRelay(port) {
  for (const hook of await relayHooks(port)) await port.deleteWebhook(hook.id);
}

// Pose le webhook de la boîte d'envoi vers `url`, avec `secret` dans l'en-tête `Authorization` (`Bearer …`). Un relais déjà posé est remplacé. Un secret que
// Grist refuse défait le webhook (il livrerait sans protection). Rend l'identifiant du webhook.
export async function armRelay({ port, transfer, outbox = OUTBOX, url, secret, loopback = false }) {
  const problem = checkRelayUrl(url, { loopback });
  if (problem) throw new Error(problem);
  if (!/^[0-9a-f]{32,}$/.test(secret)) throw new Error('weakSecret');
  await disarmRelay(port);
  const id = await port.createWebhook({ name: WEBHOOK_NAME, memo: 'Envoie les lignes « à envoyer » de la boîte d’envoi.', url, tableId: outbox,
    condition: CONDITION });
  try {
    await transfer.rest('PATCH', `/webhooks/${encodeURIComponent(id)}`, { body: { authorization: `Bearer ${secret}` }, writable: true });
  } catch (error) {
    await port.deleteWebhook(id).catch(() => {});
    throw error;
  }
  return id;
}

// Dépose un e-mail dans la boîte d'envoi : `mail` a les champs de la table (`Destinataires`, `Copie`, `CopieCachee`, `Objet`, `Corps`, `Html`, `RepondreA`).
// Les règles de rules.js d'abord (une erreur au code de la règle), puis une ligne « à envoyer ». Rend le numéro de la ligne.
export async function enqueue(port, outbox, mail) {
  const verdict = checkMail(mail);
  if (!verdict.ok) throw new Error(verdict.code);
  const { Destinataires, Copie, CopieCachee, Objet, Corps, Html, RepondreA } = mail;
  const row = { Destinataires, Copie, CopieCachee, Objet, Corps, Html, RepondreA, Demande: QUEUED };
  return (await port.apply([['AddRecord', outbox, null, row]])).retValues[0];
}

// Renvoie des lignes : leur numéro de relance monte, Grist les voit de nouveau « à envoyer » et le relais, qui retient chaque envoi par (ligne, clé, relance),
// les envoie une seconde fois, parce que la personne l'a voulu.
export async function requeue(port, outbox, ids) {
  const rows = (await port.fetchRows(outbox)).filter(row => ids.includes(row.id));
  if (rows.length) await port.apply(rows.map(row => ['UpdateRecord', outbox, row.id, { Relance: (Number(row.Relance) || 0) + 1, Demande: QUEUED }]));
  return rows.length;
}
