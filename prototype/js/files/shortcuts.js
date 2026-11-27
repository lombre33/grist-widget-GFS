// Les raccourcis de fichiers dans « Moi » (étude du 25/11 ; demande du porteur le 27/11 : « le bouton pour créer des raccourcis de fichier doit fonctionner
// partout »). Un raccourci est un pointeur à la personne seule : le même fichier se montre dans un de ses dossiers de « Moi », sans copie, sans déplacer
// l'original. **Il ne donne aucun accès** : c'est une ligne du rangement de la personne (`GFS_Filing`, contrats 6.4), lue et écrite par elle seule (les règles
// du partage, 11.7 point 13.n.c), qui nomme sa cible ; ce que la personne lit de la cible, Grist le décide (lignes de partage et règles), comme pour le fichier
// lui-même. Une cible qu'elle ne lit plus (partage retiré, fichier supprimé ou refusé) rend le raccourci grisé : il n'est jamais effacé tout seul, et il se
// rallume si l'accès revient. Aucune table ni colonne de plus : sous l'app `gfs-shortcut`, `File` est le numéro du raccourci, `Folder` son dossier de
// « Moi » (il se range, se déplace et se glisse comme un fichier), `Value` le JSON { target, name, type } (la clé du fichier visé, le nom du raccourci, le
// type que la cible avait à la création : une clé réutilisée par un fichier d'un autre type ne se laisse pas prendre pour la même). Ce module ne touche pas à
// Grist : il lit les lignes, bâtit les entrées de la liste et rend les actions à écrire.

import { fileKey, normalizePath } from '../explorer/explorer-model.js';
import { normalize } from '../ui/search.js';
import { ACCEPTED } from '../sharing/received-state.js';

export const SHORTCUT_APP = 'gfs-shortcut';
export const shortcutKey = id => fileKey(SHORTCUT_APP, id);

const text = value => (typeof value === 'string' ? value : '');
const cell = (data, column, i) => (data && Array.isArray(data[column]) ? data[column][i] : undefined);

// Un numéro neuf : le temps et quelques signes au hasard (deux gestes dans la même milliseconde ne se confondent pas).
export function newShortcutId(now = Date.now(), random = Math.random) {
  return `s${now.toString(36)}${Math.floor(random() * 36 ** 4).toString(36).padStart(4, '0')}`;
}

function parse(value) {
  try {
    const found = JSON.parse(value);
    return found && typeof found === 'object' && !Array.isArray(found) ? found : null;
  } catch (error) {
    return null;
  }
}

// Les raccourcis de la personne `identity` d'après le rangement (la table telle que `fetchTable` la rend, ou null) : [{ id, row, folder, target, name, type }].
// Une ligne sans cible lisible, ou pour une autre personne, n'en est pas un ; un même numéro deux fois : la première fait foi.
export function readShortcuts(data, identity = '') {
  const found = [];
  const seen = new Set();
  const rows = data && Array.isArray(data.id) ? data.id : [];
  rows.forEach((row, i) => {
    if (text(cell(data, 'User', i)) !== identity || text(cell(data, 'App', i)) !== SHORTCUT_APP) return;
    const id = text(cell(data, 'File', i));
    const value = parse(text(cell(data, 'Value', i)));
    if (!id || !value || !text(value.target) || seen.has(id)) return;
    seen.add(id);
    found.push({ id, row, folder: normalizePath(cell(data, 'Folder', i)), target: value.target, name: text(value.name), type: text(value.type) });
  });
  return found;
}

// L'entrée de la liste pour un raccourci, de la forme d'un fichier de l'explorateur (js/explorer/explorer-model.js) : `app` et `id` font qu'il se range, se
// déplace et se glisse comme un fichier (c'est sa ligne de rangement). Il ne pèse rien (la cible pèse déjà) et n'est ni épinglé ni à la corbeille. `target` :
// le fichier visé tel que la liste le montre, ou rien.
function entryOf(row, target) {
  const sound = Boolean(target) && !target.trashed && (!row.type || !target.type || row.type === target.type);
  const name = row.name || (target ? target.name : '');
  const base = { key: shortcutKey(row.id), app: SHORTCUT_APP, id: row.id, table: '', row: row.row, name, icon: 'shortcut', folder: row.folder, pinned: false,
    trashed: null, weight: 0, pieces: [], search: normalize(`${name} ${row.folder}`) };
  if (!sound) {
    return { ...base, type: row.type, typeInfo: null, known: false, family: '', ts: null, by: '', shortcut: { target: row.target, state: 'missing' } };
  }
  return { ...base, type: target.type, typeInfo: target.typeInfo, known: target.known, family: target.family, ts: target.ts, by: target.by,
    shortcut: { target: row.target, state: 'ok' } };
}

// Les entrées des raccourcis : `files` les fichiers vivants que la personne lit (les siens, ceux d'un espace, ceux qu'on lui donne), `received` les arrivées
// d'un autre document (seules les acceptées se visent). Une cible que la personne ne lit pas (ou plus) rend un raccourci grisé : `shortcut.state` vaut
// 'missing'.
export function shortcutFiles(rows, files, received = []) {
  if (!rows || !rows.length) return [];
  const live = new Map(files.map(file => [file.key, file]));
  for (const arrival of received) {
    if (arrival.received && arrival.received.state === ACCEPTED && !live.has(arrival.key)) live.set(arrival.key, arrival);
  }
  return rows.map(row => entryOf(row, live.get(row.target)));
}

// Où se trouve la cible d'un raccourci, pour « Aller au fichier d'origine » : « Partagés avec moi » pour une arrivée ou un fichier donné qu'on n'a pas rangé,
// sinon son dossier.
export const originOf = target => (target.received || (target.direct && !target.folder) ? { view: 'shared', path: '' } :
  { view: 'folder', path: target.folder });

// Les actions qui ajoutent le raccourci `row` ({ id, folder, target, name, type }) dans la table relue `ctx` ({ data, tableId, identity }). Un raccourci qui
// existe déjà sous ce numéro est mis à jour, jamais doublé.
export function addActions({ data, tableId, identity }, row) {
  const at = (data && Array.isArray(data.id) ? data.id : []).findIndex((rowId, i) => text(cell(data, 'User', i)) === identity &&
    text(cell(data, 'App', i)) === SHORTCUT_APP && text(cell(data, 'File', i)) === row.id);
  const record = { Favorite: false, Folder: normalizePath(row.folder), Value: JSON.stringify({ target: row.target, name: row.name, type: row.type }) };
  return [at >= 0 ? ['UpdateRecord', tableId, data.id[at], record] : ['AddRecord', tableId, null,
    { User: identity, App: SHORTCUT_APP, File: row.id, ...record }]];
}

// Les actions qui retirent le raccourci `id` de la personne.
export function removeActions({ data, tableId, identity }, id) {
  const rows = (data && Array.isArray(data.id) ? data.id : []).filter((rowId, i) => text(cell(data, 'User', i)) === identity &&
    text(cell(data, 'App', i)) === SHORTCUT_APP && text(cell(data, 'File', i)) === id);
  return rows.map(rowId => ['RemoveRecord', tableId, rowId]);
}

// Les actions qui donnent le nom `name` au raccourci `id` : seul le nom change, la cible et le type restent ceux de la ligne.
export function renameActions({ data, tableId, identity }, id, name) {
  const found = readShortcuts(data, identity).find(item => item.id === id);
  if (!found) return [];
  const value = JSON.stringify({ target: found.target, name, type: found.type });
  return [['UpdateRecord', tableId, found.row, { Value: value }]];
}
