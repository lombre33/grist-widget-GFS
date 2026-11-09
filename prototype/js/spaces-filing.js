// Les espaces partagés dans l'explorateur (contrats 11.7, point 13, lot 4b) : un espace est un dossier de plus, sous « Espaces » à côté de « Moi ». Le fichier y est placé par une ligne de `GFS_Placement` (partagée,
// lue par ceux qui ont accès à l'espace), jamais par le rangement de la personne (`GFS_Rangement`, à elle seule). Le chemin que l'explorateur montre est « Espaces / <espace> / <dossier> » : tout ce qu'il sait faire d'un dossier
// (arbre, fil d'Ariane, déplacer, couper-coller, glisser) marche donc sans rien savoir des espaces ; seule l'écriture passe ici, qui sépare ce qui va au rangement de la personne de ce qui va au placement.
// Un dossier vide d'un espace tient à une ligne de placement sans fichier (`Cible` vide). Seuls les propriétaires écrivent les espaces et les placements (les règles de `spaceRules`).

import { SPACES_ROOT, fileKey, folderName, normalizePath } from './explorer-model.js';
import { normalize } from './search.js';
import { PLACE_TABLE, SPACES_TABLE } from './sharing-model.js';

export { SPACES_ROOT };
const text = value => (typeof value === 'string' ? value : '');
const cell = (data, column, i) => (data && Array.isArray(data[column]) ? data[column][i] : undefined);
const rowCount = data => (data && Array.isArray(data.id) ? data.id.length : 0);

// Ce chemin est-il sous « Espaces » (la racine comprise) ? Un espace est « Espaces/<nom> » ; ses dossiers sont dessous.
export const isSpacePath = path => path === SPACES_ROOT || path.startsWith(`${SPACES_ROOT}/`);
// Le chemin est « Espaces » ou un espace lui-même : ni renommé, ni supprimé, ni déplacé d'ici (un espace se gère dans « Gérer les partages… »).
export const isSpaceItself = path => isSpacePath(path) && path.split('/').length <= 2;
// Le chemin d'un dossier à l'intérieur d'un espace.
export const isInsideSpace = path => isSpacePath(path) && path.split('/').length > 2;

// Le nom d'un chemin pour l'écran : la racine « Espaces » se dit dans la langue de la personne, les autres noms restent ceux que la personne a donnés.
export const folderLabel = (t, path, name = path.split('/').pop()) => (path === SPACES_ROOT ? t('ex.spaces') : name);

// Ce que disent `GFS_Espaces` et `GFS_Placement` (tables telles que `fetchTable` les rend, ou null) : { spaces: [{ key, name, path }], placed: Map(cible -> { space, folder }), folders: [chemins montrés même sans fichier] }.
// Un espace que la personne ne lit pas n'est pas dans sa table : ses fichiers restent là où le rangement de la personne les met.
export function readSpaces(spacesData, placeData) {
  const spaces = [];
  const taken = new Set();
  for (let i = 0; i < rowCount(spacesData); i++) {
    const key = text(cell(spacesData, 'Cle', i));
    if (!key) continue;
    let name = folderName(cell(spacesData, 'Nom', i)) || key;
    if (taken.has(name.toLowerCase())) name = `${name} (${key})`;
    taken.add(name.toLowerCase());
    spaces.push({ key, name, path: `${SPACES_ROOT}/${name}` });
  }
  const byKey = new Map(spaces.map(space => [space.key, space]));
  const placed = new Map();
  const folders = new Set(spaces.map(space => space.path));
  for (let i = 0; i < rowCount(placeData); i++) {
    const space = byKey.get(text(cell(placeData, 'Espace', i)));
    if (!space) continue;
    const folder = normalizePath(cell(placeData, 'Dossier', i));
    const target = text(cell(placeData, 'Cible', i));
    if (target) { if (!placed.has(target)) placed.set(target, { space, folder }); } else if (folder) folders.add(`${space.path}/${folder}`);
  }
  return { spaces, placed, folders: [...folders] };
}

// Pose le dossier d'espace sur les fichiers placés (le dossier de la personne, lui, est gardé dans `ownFolder` : il revient si le fichier quitte l'espace) et refait leur texte de recherche.
export function applyPlacement(files, info) {
  if (!info) return files;
  for (const file of files) {
    const at = info.placed.get(file.key);
    if (!at) continue;
    file.ownFolder = file.folder;
    file.space = { key: at.space.key, folder: at.folder };
    file.folder = at.folder ? `${at.space.path}/${at.folder}` : at.space.path;
    file.search = normalize(`${file.name} ${file.folder}`);
  }
  return files;
}

// L'espace et le dossier qu'un chemin « Espaces/<nom>/<dossier> » désigne, ou null (la racine, ou un espace qu'on ne connaît pas).
export function locate(path, info) {
  const parts = path.split('/');
  const space = parts.length > 1 && info ? info.spaces.find(item => item.path === parts.slice(0, 2).join('/')) : null;
  return space ? { space, folder: parts.slice(2).join('/') } : null;
}

// Sépare un rangement en ce qui va au rangement de la personne et ce qui va au placement. `entries` : [{ app, file, pinned, folder }] ; `folders` : { add, drop, quiet } ; `files` : la liste montrée.
// Rend { entries, folders, ops, markers } ou { error } (une clé de phrase : un chemin sous « Espaces » qui ne désigne aucun espace). `ops` : [{ place, space, folder }] ou [{ remove }] ; `markers` : { add, drop } de { space, folder }.
// Un fichier qui entre dans un espace garde son dossier à lui (rien n'y change) ; un fichier qui en sort va dans le dossier demandé.
export function splitWrites(entries, folders, files, info) {
  const byKey = new Map(files.map(file => [file.key, file]));
  const personal = [];
  const ops = [];
  for (const entry of entries) {
    const key = fileKey(entry.app, entry.file);
    const now = byKey.get(key);
    const to = normalizePath(entry.folder);
    if (!isSpacePath(to)) {
      personal.push({ ...entry, folder: to });
      if (now && now.space) ops.push({ remove: key });
      continue;
    }
    const dest = locate(to, info);
    if (!dest) return { error: 'ex.spaceUnknown' };
    personal.push({ ...entry, folder: now ? (now.space ? now.ownFolder || '' : now.folder) : '' });
    if (!(now && now.space && now.space.key === dest.space.key && now.space.folder === dest.folder)) ops.push({ place: key, space: dest.space.key, folder: dest.folder });
  }
  const markers = { add: [], drop: [] };
  const rest = { add: [], drop: [] };
  for (const kind of ['add', 'drop']) {
    for (const path of folders[kind] || []) {
      if (!isSpacePath(path)) { rest[kind].push(path); continue; }
      const dest = locate(path, info);
      if (dest && dest.folder) markers[kind].push({ space: dest.space.key, folder: dest.folder });
    }
  }
  return { entries: personal, folders: { ...folders, ...rest }, ops, markers };
}

// Ce que le plan écrit dans le placement : y a-t-il quelque chose à faire ?
export const touchesSpaces = plan => plan.ops.length > 0 || plan.markers.add.length > 0 || plan.markers.drop.length > 0;

// Écrit le placement : relit la table, un seul lot. Rend true quand le lot est parti.
export async function writePlacement(doc, plan) {
  const data = await doc.fetchTable(PLACE_TABLE);
  const rows = Array.isArray(data.id) ? data.id : [];
  const at = test => rows.map((id, i) => (test(i) ? id : null)).filter(id => id !== null);
  const actions = [];
  for (const op of plan.ops) {
    const found = at(i => text(cell(data, 'Cible', i)) === (op.place || op.remove));
    if (op.remove) { for (const id of found) actions.push(['RemoveRecord', PLACE_TABLE, id]); continue; }
    if (found.length) actions.push(['UpdateRecord', PLACE_TABLE, found[0], { Espace: op.space, Dossier: op.folder }]);
    else actions.push(['AddRecord', PLACE_TABLE, null, { Cible: op.place, Espace: op.space, Dossier: op.folder }]);
  }
  const marker = (item, i) => !text(cell(data, 'Cible', i)) && text(cell(data, 'Espace', i)) === item.space && normalizePath(cell(data, 'Dossier', i)) === item.folder;
  for (const item of plan.markers.drop) for (const id of at(i => marker(item, i))) actions.push(['RemoveRecord', PLACE_TABLE, id]);
  for (const item of plan.markers.add) if (!at(i => marker(item, i)).length && !plan.markers.drop.some(other => other.space === item.space && other.folder === item.folder)) actions.push(['AddRecord', PLACE_TABLE, null, { Cible: '', Espace: item.space, Dossier: item.folder }]);
  if (!actions.length) return false;
  await doc.applyUserActions(actions);
  return true;
}

// La lecture des deux tables pour l'explorateur : { spaces, placed, folders } ou null (le partage n'est pas actif, ou la table est illisible : les fichiers restent où le rangement les met).
export async function loadSpaces(doc, tables) {
  const has = name => !tables || tables.some(each => String(each).toLowerCase() === name.toLowerCase());
  if (!has(SPACES_TABLE) || !has(PLACE_TABLE)) return null;
  try {
    return readSpaces(await doc.fetchTable(SPACES_TABLE), await doc.fetchTable(PLACE_TABLE));
  } catch (error) {
    console.warn('GFS : les espaces sont illisibles', error);
    return null;
  }
}
