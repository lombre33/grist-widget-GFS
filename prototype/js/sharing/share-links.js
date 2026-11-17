// Les documents que ce document a reliés pour leur envoyer ses fichiers (« Partager > Dans un autre document Grist », « Gérer les partages > Autres
// documents » ; maquette et go du porteur, 09/11). Un document relié, c'est un export du moteur de partage (kit/js/synchro/) dont la condition nomme les
// fichiers partagés : « Copie à jour » = le fichier est dans la condition ; « Pas partagé » = il n'y est pas. Sans fenêtre ni Grist : les opérations passent
// par `engine` (les fonctions du moteur, js/sharing/sync-service.js), que les essais remplacent. Ce fichier ne charge rien du moteur.
//
// Deux faits mesurés dans un vrai Grist (labo/run-sync-retrait.mjs, faits vérifiés 70) règlent tout ce qui suit :
//   - une condition SANS valeur est écartée par le moteur et TOUS les fichiers partent : quand le dernier fichier sort, la condition nomme `NONE`, un
//   identifiant qui n'existe pas ;
//   - un fichier retiré de la condition est effacé chez l'autre, sauf quand sa réception est « en archive » (la copie reste, marquée « supprimée à la source
//   ») : GFS reçoit toujours en archive.
import { FILES_COLUMN_IDS, FILES_TABLE, SHARED_FOLDER_COLUMN, TRASH_COLUMN_IDS } from '../files/gfs-files.js';

// Les colonnes qui partent : celles du fichier, sans la corbeille (qui n'a de sens que dans le document d'origine). Le nom du dossier partagé n'y est PAS : il
// ne part qu'avec un lien qui reçoit un dossier (`selectionFor`, `folder`). Sans cela, le nom de dossier écrit pour un document A partait aussi chez un
// document B qui ne reçoit que des fichiers seuls : il y voyait un fichier rangé dans un dossier qu'on ne lui a jamais partagé (audit « contournement » du
// 11/11).
export const SENT_COLUMNS = Object.freeze(FILES_COLUMN_IDS.filter(id => !TRASH_COLUMN_IDS.includes(id)));
export const NONE = 'gfs-aucun';
export const LEVELS = Object.freeze(['none', 'once', 'live']);
export const PASS_MS = 2000; // entre deux passages du rattrapage, tant que des fichiers partent
export const PASSES = 90; // trois minutes au plus avant de dire que l'envoi n'est pas fini

// La sélection du moteur : la table des fichiers, ses colonnes, et les fichiers voulus (leur identifiant ne change jamais, ni au renommage ni au remplacement).
// Jamais une condition vide (voir plus haut). `folder` : le lien reçoit un dossier, le nom du dossier part avec chaque fichier (le moteur ne l'envoie que si la
// table porte la colonne à l'enregistrement : faits vérifiés, 99).
export const selectionFor = (ids, { folder = false } = {}) => [{ table: FILES_TABLE,
  columns: folder ? [...SENT_COLUMNS, SHARED_FOLDER_COLUMN] : [...SENT_COLUMNS],
  filter: { mode: 'all', conds: [{ id: 'Identifiant', op: 'in', values: ids.length ? [...ids] : [NONE] }] } }];

// Le lien envoie-t-il déjà le nom du dossier ? (sa colonne est dans l'export : un lien qui a reçu un dossier la garde, même pour un fichier seul de plus.)
export const carriesFolder = link => (((link && link.exp && link.exp.tables) || [])[0]?.columns || []).some(column => column &&
  column.id === SHARED_FOLDER_COLUMN);

// Les fichiers d'une sélection, lue dans les tables d'un export (`tables` : [{ table, columns, filter }] ; null si la condition n'est pas celle de GFS :
// l'export est ignoré).
export function filesOf(tables) {
  if (!Array.isArray(tables) || tables.length !== 1 || tables[0].table !== FILES_TABLE) return null;
  const conds = (tables[0].filter && tables[0].filter.conds) || [];
  if (conds.length !== 1 || conds[0].id !== 'Identifiant' || conds[0].op !== 'in') return null;
  return (conds[0].values || []).map(String).filter(id => id !== NONE);
}

// Le document que dit le mémo d'un webhook (« e-mail · identifiant · équipe/nom du document ») : son nom et son identifiant.
export function docOf(memo) {
  const parts = String(memo || '').split(' · ').filter(Boolean);
  const place = parts.find(part => part.includes('/')) || '';
  return { name: place.slice(place.indexOf('/') + 1).trim(), id: parts[1] || '' };
}

// Les liens de ce document, lus dans ce que le moteur dit : la note de la table technique (`note` : exports et invitations), ses lignes, les webhooks
// (`hooks.of(export)` : les destinataires ; null quand Grist ne dit rien) et trois lectures du moteur (`tablesOf`, `emailOf`, `statusOf(webhook)` → 'active' |
// 'paused' | 'error'). Seuls les exports de GFS (une condition sur l'identifiant des fichiers) comptent : un échange, un lien public ou un export d'une autre
// origine est laissé. Rend, par lien : { id, name, files, state ('active' | 'paused' | 'blocked' | 'pending'), doc: { name, id }, exp } où `exp` est l'export
// tel que le moteur le prend (saveChosenExport, finishEdit, endExport).
export function linksFrom({ note, rows, hooks, tablesOf, emailOf, statusOf }) {
  const links = [];
  for (const entry of note.exports) {
    const tables = tablesOf(rows, entry.id);
    const files = filesOf(tables);
    if (!files || entry.echange || entry.retour || entry.public) continue;
    const recipients = hooks ? hooks.of(entry.id) : [];
    const invitations = note.invitations.filter(each => each.export === entry.id);
    if (!recipients.length && !invitations.length) continue;
    const states = recipients.map(statusOf);
    const state = !recipients.length ? 'pending' : (states.includes('error') ? 'blocked' : (states.every(each => each === 'paused') ? 'paused' : 'active'));
    const doc = recipients.length ? docOf(recipients[0].fields.memo) : { name: '', id: '' };
    links.push({ id: entry.id, name: entry.name, files, state, doc, exp: { id: entry.id, name: entry.name, tables, recipients, invitations, public: false,
      echange: false, retour: false, email: emailOf(rows, entry.id) } });
  }
  return links;
}

// Un fichier (son identifiant) ou une liste de fichiers (ceux d'un dossier) : toujours une liste.
const listed = ids => (Array.isArray(ids) ? ids : [ids]);

// Le niveau d'un fichier, ou de tous ceux d'un dossier, chez un document relié : 'live' (tous dans la condition), 'part' (une partie seulement : un dossier
// dont un fichier a été partagé ou retiré à part) ou 'none'. « Une copie, une fois » n'est pas un état : elle part, puis le fichier sort de la condition.
export function levelOf(link, ids) {
  const wanted = listed(ids);
  const inside = wanted.filter(id => link.files.includes(id)).length;
  if (wanted.length && inside === wanted.length) return 'live';
  return inside ? 'part' : 'none';
}

// Ce que la condition devient quand le fichier `ids` (ou les fichiers d'un dossier) y entre (`on`) ou en sort.
export function idsWith(link, ids, on) {
  const wanted = listed(ids);
  return on ? [...new Set([...link.files, ...wanted])] : link.files.filter(id => !wanted.includes(id));
}

// Enregistre la condition de l'export et renvoie ce qui a changé (le moteur envoie l'ajout, le contenu suit par son rattrapage).
export async function setCondition(engine, link, ids, { folder = false } = {}) {
  const saved = await engine.saveChosenExport({ exp: link.exp, name: link.name, selection: selectionFor(ids, { folder: folder || carriesFolder(link) }) });
  await engine.finishEdit(link.exp, { name: link.name, changed: saved.changed });
  return ids;
}

// Attend que plus rien ne reste à partir pour cet export (les lignes d'abord, puis le contenu des fichiers : `catchUp` du moteur, passé jusqu'à « rien à
// envoyer »). Lève `blocked` ou `timeout`.
export async function settle(engine, link, wait = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  for (let pass = 0; pass < PASSES; pass += 1) {
    await engine.catchUp();
    const caught = engine.catchState();
    if (caught.why === 'blocked') throw Object.assign(new Error('blocked'), { share: 'blocked' });
    if (!caught.running && caught.why === 'idle' && engine.filesPending(link.exp.id) === 0) return;
    await wait(PASS_MS);
  }
  throw Object.assign(new Error('timeout'), { share: 'timeout' });
}

// Change le niveau du fichier `fileId` (ou de la liste des fichiers d'un dossier) chez le document relié `link` ; rend le nouveau niveau ou, pour « une fois »,
// une promesse que la fenêtre n'attend pas (`later`) : le fichier part, puis sort de la condition.
//   live  le fichier entre dans la condition et y reste ;
//   once  il entre, part, puis sort (la copie reste chez l'autre : réception en archive) ;
//   none  il sort (idem).
export async function applyLevel(engine, link, fileId, level, wait, options = {}) {
  if (level === 'none') return { level, ids: await setCondition(engine, link, idsWith(link, fileId, false), options) };
  const ids = await setCondition(engine, link, idsWith(link, fileId, true), options);
  if (level === 'live') return { level, ids };
  // La condition est relue au moment de la retirer : un autre fichier ajouté entre-temps (par la même personne, dans une autre fenêtre) ne doit pas disparaître
  // avec celui-ci.
  const leave = async () => {
    const fresh = (await engine.readLinks()).find(each => each.id === link.id);
    if (fresh && listed(fileId).some(id => fresh.files.includes(id))) await setCondition(engine, fresh, idsWith(fresh, fileId, false), options);
  };
  return { level, ids, later: settle(engine, link, wait).then(leave) };
}

// Arrête le lien : ses invitations en attente sont annulées, l'export, son webhook et ses lignes disparaissent ; ce qui est arrivé reste chez l'autre.
export async function stopLink(engine, link) {
  for (const invitation of link.exp.invitations) await engine.cancelPendingInvitation(invitation).catch(() => {});
  await engine.endExport(link.exp);
}
