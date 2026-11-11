// Le modèle de l'explorateur (contrats 2.4, 6.4) : des fonctions sans effet de bord. Elles lisent les tables de fichiers d'après le manifeste
// de chaque app (GFS ne garde que les colonnes déclarées), rangent les fichiers en dossiers, filtrent et trient, et disent ce qu'un rangement change.
//
// Les tables arrivent telles que `fetchTable` les rend : { id: [..], <colonne>: [..] }. Une colonne déclarée mais absente se lit comme vide :
// un document ancien n'a pas toutes les colonnes (2.4, point 2).

import { normalize, words, matchesWords } from './search.js';
import { keptInFolder } from './direct-shares.js';
import { rowWeigher, piecesOf, linkedOf, newSum, addWeight } from './weight.js';

// Le champ `couleur` du manifeste -> la famille de couleur de la charte (cahier 6.5) ; tout autre mot : neutre. Le rouge du PDF est la quatrième famille (décision du porteur, 04/11).
const FAMILIES = Object.freeze({ document: 'doc', grille: 'grid', presentation: 'slides', pdf: 'pdf' });
// Les familles que l'explorateur colore (attribut `data-fam`, jetons `--t-*` de css/gfs.css) ; `familyOf` : la famille d'un mot du manifeste, ou '' (neutre : jamais un mot de la chaîne de prototypes).
export const FAMILY_NAMES = Object.freeze(Object.values(FAMILIES));
export const familyOf = couleur => (Object.hasOwn(FAMILIES, couleur) ? FAMILIES[couleur] : '');
const RECENT_LIMIT = 8;
// La racine des espaces partagés, à côté de « Moi » (js/spaces-filing.js) : un dossier de plus pour tout ce qui range, mais « Moi » ne la liste pas.
export const SPACES_ROOT = 'Espaces';

const text = value => (typeof value === 'string' ? value : '');
const cell = (data, column, i) => (column && data && Array.isArray(data[column]) ? data[column][i] : undefined);

// Une date de Grist en secondes ; une valeur codée ['D', secondes, fuseau] est lue aussi ; le reste est « pas de date ».
function seconds(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value) && (value[0] === 'D' || value[0] === 'd') && typeof value[1] === 'number') return value[1];
  return null;
}

// « Factures // 2024/ » -> « Factures/2024 » ; vide -> '' (la racine).
export const normalizePath = path => text(path).split('/').map(part => part.trim()).filter(Boolean).join('/');

const rowCount = data => (data && Array.isArray(data.id) ? data.id.length : 0);

// À la corbeille ? `marker` = `corbeille` du manifeste ({ date, par }) : le fichier y est quand sa colonne de date porte une date. Rend { ts, by } (la date du geste, son auteur) ou null.
function trashOf(marker, data, i) {
  if (!marker) return null;
  const ts = seconds(cell(data, marker.date, i));
  return ts !== null && ts > 0 ? { ts, by: text(cell(data, marker.par, i)) } : null;
}

export function isExcluded(spec, data, i) {
  return Object.entries(spec.exclure || {}).some(([column, values]) => Array.isArray(values) && values.includes(text(cell(data, column, i))));
}

// La clé d'un fichier dans l'explorateur et dans le rangement de GFS : « app:identifiant ».
export const fileKey = (app, id) => `${app}:${id}`;

// Les fichiers d'une table : { key, app, id, table, row, name, type, typeInfo, known, family, icon, ts, by, folder, pinned, trashed, weight, pieces, search } ; `table` et `row` : la table
// du manifeste et la ligne de Grist (renommer) ; `trashed` : { ts, by } quand le fichier est à la corbeille (le manifeste déclare alors `corbeille`), sinon null. La liste des fichiers vivants
// et celle de la corbeille se séparent après la lecture (js/explorer-data.js) : ce modèle rend tout, le fichier à la corbeille a gardé son nom, son dossier et son type.
// `typeInfo` est l'entrée de `types` qui porte le type, ou null : un type que le manifeste ne connaît pas est listé grisé (6.5, point 3).
// `weight` : le poids estimé en octets (js/weight.js), les cellules de la ligne (ou `weights[i]` quand l'appelant les a comptées lui-même : une entrée de la corbeille pèse ce qu'elle garde) plus la pièce
// jointe que le fichier EST (`spec.poids.pieces`) et les lignes des tables liées qui le suivent (`spec.poids.liees`, lues par l'appelant : `linked`, js/weight.js `linkedOf`) ; `pieces` : [[clé, taille]]
// de ces pièces et de ces lignes liées, pour qu'une somme compte une fois celle que deux fichiers citent.
export function readFiles(manifest, spec, data, weights = null, linked = null) {
  const cols = spec.colonnes || {};
  const weigh = rowWeigher(data);
  const files = [];
  for (let i = 0; i < rowCount(data); i++) {
    if (isExcluded(spec, data, i)) continue;
    const rawId = cell(data, cols.id, i);
    if (rawId === undefined || rawId === null) continue;
    const type = text(cell(data, cols.type, i)) || spec.typeParDefaut || '';
    const typeInfo = (spec.types || []).find(item => item.valeur === type) || null;
    const name = text(cell(data, cols.nom, i));
    const pieces = [...piecesOf(spec.poids, data, i), ...linkedOf(linked, data, i)];
    files.push({
      key: fileKey(manifest.id, rawId), app: manifest.id, id: String(rawId), table: spec.table, row: data.id[i], name, type, typeInfo, known: Boolean(typeInfo),
      family: typeInfo ? familyOf(typeInfo.couleur) : '', icon: (typeInfo && typeInfo.icone) || 'doc',
      ts: seconds(cell(data, cols.date, i)), by: text(cell(data, cols.par, i)), folder: normalizePath(cell(data, cols.dossier, i)), pinned: false,
      trashed: trashOf(spec.corbeille, data, i), weight: (weights ? weights[i] : weigh(i)) + pieces.reduce((sum, [, size]) => sum + size, 0), pieces, search: '',
    });
  }
  return files;
}

// Le rangement d'une app pour la personne `identity` ('' quand son identité n'est pas résolue : le rangement est alors partagé, 6.4).
// `rangement` = { table, utilisateur, fichier, dossier, epingle } : les noms de colonnes. Rend une Map : identifiant du fichier -> { folder, pinned }.
// Les lignes d'état de dossier (fichier = 0 ou vide) n'ont rien à dire d'un fichier ; une ligne dont le fichier n'existe plus est ignorée par l'appelant.
export function readFiling(rangement, data, identity = '') {
  const byFile = new Map();
  if (!rangement) return byFile;
  for (let i = 0; i < rowCount(data); i++) {
    if (text(cell(data, rangement.utilisateur, i)) !== identity) continue;
    const file = cell(data, rangement.fichier, i);
    if (file === undefined || file === null || file === '' || file === 0) continue;
    const id = String(file);
    if (byFile.has(id)) continue; // plusieurs lignes pour un même fichier : la première fait foi, comme dans l'app
    byFile.set(id, { folder: normalizePath(cell(data, rangement.dossier, i)), pinned: cell(data, rangement.epingle, i) === true });
  }
  return byFile;
}

// Le rangement de GFS pour la personne `identity` (`GFS_Rangement`, 6.4) : Map « app:fichier » -> { folder, pinned }. Les lignes réservées (« @… ») et les
// lignes d'état de dossier (sans app ni fichier) n'ont rien à dire d'un fichier ; plusieurs lignes pour un même fichier : la première fait foi.
export function readGfsFiling(data, identity = '') {
  const byFile = new Map();
  for (let i = 0; i < rowCount(data); i++) {
    const user = text(cell(data, 'Utilisateur', i));
    const app = text(cell(data, 'App', i));
    const file = text(cell(data, 'Fichier', i));
    if (user !== identity || user.startsWith('@') || !app || !file || byFile.has(fileKey(app, file))) continue;
    byFile.set(fileKey(app, file), { folder: normalizePath(cell(data, 'Dossier', i)), pinned: cell(data, 'Favori', i) === true });
  }
  return byFile;
}

// Les dossiers que la personne `identity` garde même sans fichier (`GFS_Rangement`, les lignes d'état de dossier : ni app ni fichier, contrats 6.4, point 11) : des chemins normalisés, sans doublon.
// Ceux qu'elle a créés, et ceux qu'un rangement a vidés de leur dernier fichier ; un dossier qui a des fichiers existe de toute façon par eux.
export function readGfsFolders(data, identity = '') {
  const found = new Set();
  for (let i = 0; i < rowCount(data); i++) {
    const user = text(cell(data, 'Utilisateur', i));
    if (user !== identity || user.startsWith('@') || text(cell(data, 'App', i)) || text(cell(data, 'Fichier', i))) continue;
    const path = normalizePath(cell(data, 'Dossier', i));
    if (path) found.add(path);
  }
  return [...found];
}

// Pose dossier et favori sur les fichiers, et le texte de recherche (nom et dossier, normalisés une fois). Le rangement propre de l'app (`filing`, par
// identifiant) sert de point de départ ; celui de GFS (`gfsFiling`, par clé « app:fichier ») passe devant : l'app seule garde le sien (6.4, point 5).
export function applyFiling(files, filing, gfsFiling = null) {
  for (const file of files) {
    const entry = (gfsFiling && gfsFiling.get(file.key)) || (filing && filing.get(file.id));
    if (entry) { file.folder = entry.folder; file.pinned = entry.pinned; }
    file.search = normalize(`${file.name} ${file.folder}`);
  }
  return files;
}

// Tous les dossiers que nomment les fichiers, ou que la personne garde sans fichier (`spare`, `readGfsFolders`), leurs parents compris, triés : la liste où choisir où ranger.
export function folderPaths(files, locale, spare = []) {
  const found = new Set();
  for (const folder of [...files.map(file => file.folder), ...spare]) for (const part of pathParts(folder)) found.add(part.path);
  return [...found].sort((a, b) => a.localeCompare(b, locale, { sensitivity: 'base', numeric: true }));
}

// Le nom d'un dossier : sans « / » (il sépare les dossiers), sans espaces autour ; '' s'il ne reste rien.
export const folderName = name => text(name).replace(/\//g, ' ').replace(/\s+/g, ' ').trim();

// Ce que change le dossier `from` qui devient `to` (renommé, ou déplacé : `to` est alors le dossier d'arrivée suivi de son nom) : les fichiers qu'il contient,
// sous-dossiers compris, avec leur nouveau chemin, au format de `setFiling` ({ app, file, pinned, folder }). Rien quand `to` est `from` ou un de ses
// sous-dossiers : un dossier ne va pas en lui-même.
export function folderMoves(files, from, to) {
  if (!from || to === from || inside(to, from)) return [];
  return files.filter(file => inside(file.folder, from))
    .map(file => ({ app: file.app, file: file.id, pinned: file.pinned, folder: normalizePath(`${to}/${file.folder.slice(from.length)}`) }));
}

// Ce que le dossier `from` qui devient `to` change aux dossiers gardés sans fichier (`spare`) : ceux qu'il est ou contient changent de chemin. Rend { drop, add } : les chemins à ne plus garder et ceux à garder.
export function spareMoves(spare, from, to) {
  if (!from || to === from || inside(to, from)) return { drop: [], add: [] };
  const moved = spare.filter(path => inside(path, from));
  return { drop: moved, add: moved.map(path => normalizePath(`${to}/${path.slice(from.length)}`)) };
}

// Les dossiers que nomment ces chemins, leurs parents compris, du plus haut au plus bas.
const withParents = folders => {
  const found = new Set();
  for (const folder of folders) for (const part of pathParts(folder)) found.add(part.path);
  return found;
};

// Les dossiers qui n'existeraient plus après ces rangements (`entries` : [{ app, file, folder }] ; `folder: null` : le fichier quitte la liste, il part à la corbeille) : ceux que plus aucun fichier ni aucune
// ligne d'état ne nomme. Un dossier que la personne vide ne disparaît pas, il est gardé (contrats 6.4, point 11) : l'appelant écrit une ligne d'état pour chacun. `spare` : les dossiers déjà gardés ;
// `moved` : { drop, add }, ce que le même lot change à ces lignes (`spareMoves`, un dossier qu'on déplace). Un dossier qui part avec tout son contenu n'est pas gardé derrière lui : l'appelant l'ôte du résultat.
export function vacatedFolders(files, entries, spare = [], moved = {}) {
  const target = new Map(entries.map(entry => [fileKey(entry.app, entry.file), entry.folder === null ? null : normalizePath(entry.folder)]));
  const kept = [...spare.filter(path => !(moved.drop || []).includes(path)), ...(moved.add || [])];
  const after = withParents([...files.map(file => (target.has(file.key) ? target.get(file.key) : file.folder)).filter(folder => folder !== null), ...kept]);
  return [...withParents([...files.map(file => file.folder), ...spare])].filter(path => !after.has(path));
}

// Le fichier est-il dans le dossier `path` (ou dans un de ses sous-dossiers) ? La racine '' contient tout.
export const inside = (folder, path) => path === '' || folder === path || folder.startsWith(`${path}/`);

// Le sous-dossier direct de `path` qui contient `folder` (ou qui l'est), ou null : `folder` n'est pas dans `path`.
function childOf(folder, path) {
  if (folder === path || !inside(folder, path)) return null;
  const name = (path ? folder.slice(path.length + 1) : folder).split('/')[0];
  return { name, path: path ? `${path}/${name}` : name };
}

// Les sous-dossiers directs de `path` : [{ path, name, count, ts, weight }] triés par nom. Un dossier existe tant qu'un fichier le nomme, ou que la personne le garde sans fichier (`spare`, compte 0, poids 0). Son
// poids est celui de tous ses fichiers, sous-dossiers compris, une pièce jointe citée par deux d'entre eux comptée une fois.
export function subfolders(files, path, locale, spare = []) {
  const found = new Map();
  const entryOf = child => found.get(child.name) || found.set(child.name, { ...child, count: 0, ts: null, sum: newSum() }).get(child.name);
  for (const file of files) {
    const child = childOf(file.folder, path);
    if (!child) continue;
    const entry = entryOf(child);
    entry.count += 1;
    addWeight(entry.sum, file);
    if (file.ts !== null && (entry.ts === null || file.ts > entry.ts)) entry.ts = file.ts;
  }
  for (const folder of spare) { const child = childOf(folder, path); if (child) entryOf(child); }
  return [...found.values()].map(({ sum, ...folder }) => ({ ...folder, weight: sum.bytes }))
    .sort((a, b) => a.name.localeCompare(b.name, locale, { sensitivity: 'base', numeric: true }));
}

// L'arbre des dossiers pour le volet : [{ path, name, depth, count, hasChildren }] dans l'ordre d'affichage, selon les dossiers ouverts.
export function treeRows(files, openPaths, locale, spare = []) {
  const rows = [];
  const walk = (path, depth) => {
    for (const folder of subfolders(files, path, locale, spare)) {
      const children = subfolders(files, folder.path, locale, spare).length > 0;
      rows.push({ path: folder.path, name: folder.name, depth, count: folder.count, hasChildren: children, open: openPaths.has(folder.path) });
      if (children && openPaths.has(folder.path)) walk(folder.path, depth + 1);
    }
  };
  walk('', 0);
  return rows;
}

// Le chemin d'un dossier en segments utilisables pour le fil d'Ariane : [{ path, name }].
export function pathParts(path) {
  const parts = [];
  let acc = '';
  for (const name of path ? path.split('/') : []) {
    acc = acc ? `${acc}/${name}` : name;
    parts.push({ path: acc, name });
  }
  return parts;
}

// Ce que les colonnes « Modifié » et « Par » disent d'un fichier : sa dernière modification et son auteur, ou, à la corbeille, la date du geste qui l'y a mis et son auteur.
export const stampOf = file => (file.trashed ? file.trashed.ts : file.ts);
export const authorOf = file => (file.trashed ? file.trashed.by : file.by);

const SORTERS = {
  name: (a, b, c) => c.name(a, b),
  type: (a, b, c) => (a.typeInfo ? c.label(a) : a.type).localeCompare(b.typeInfo ? c.label(b) : b.type, c.locale, { sensitivity: 'base' }),
  poids: (a, b) => a.weight - b.weight,
  mod: (a, b) => (stampOf(a) ?? -Infinity) - (stampOf(b) ?? -Infinity),
  by: (a, b, c) => authorOf(a).localeCompare(authorOf(b), c.locale, { sensitivity: 'base' }),
};

// Les lignes affichées : { rows: [{ kind: 'folder', ... } | { kind: 'file', file }], flat, covered }. `covered` : les fichiers que la liste couvre, ceux des dossiers montrés compris (le total du pied
// de fenêtre en fait la somme : une pièce jointe que deux d'entre eux citent n'y est comptée qu'une fois).
// `state` : { view: 'folder'|'recent'|'fav'|'trash'|'shared'|'opened', path, q, type, sort: { key, dir } } ; `locale` : pour le tri ; `typeLabel(file)` : le nom du type dans la langue ; `spare` : les dossiers gardés sans fichier.
// Récents garde d'abord les huit plus récents, puis les trie comme demandé (l'explorateur y commence par « modifié, le plus récent d'abord »). La corbeille, « Partagés avec moi » et « Ouverts » sont des listes à plat : `files` est alors
// celle des fichiers qui y sont, tous montrés, sans dossier.
export function listItems(files, state, { locale, typeLabel, spare = [] }) {
  const needles = words(state.q);
  const filtering = needles.length > 0 || state.type !== 'all';
  const ctx = { locale, label: typeLabel, name: (a, b) => (a.name || '').localeCompare(b.name || '', locale, { sensitivity: 'base', numeric: true }) };
  let pool;
  let flat = true;
  if (state.view === 'recent') pool = [...files].sort((a, b) => (b.ts ?? -Infinity) - (a.ts ?? -Infinity)).slice(0, RECENT_LIMIT);
  else if (state.view === 'fav') pool = files.filter(file => file.pinned);
  else if (filtering || ['trash', 'shared', 'opened'].includes(state.view)) pool = files;
  else { pool = files.filter(file => file.folder === state.path && keptInFolder(file)); flat = false; }
  pool = pool.filter(file => (state.type === 'all' || file.type === state.type) && matchesWords(needles, file.search));
  const sorter = SORTERS[state.sort.key] || SORTERS.name;
  const compare = (a, b) => (sorter(a, b, ctx) * state.sort.dir) || ctx.name(a, b);
  pool.sort(compare);
  const rows = pool.map(file => ({ kind: 'file', file }));
  if (!flat) {
    // « Espaces » est une racine à côté de « Moi » (js/spaces-filing.js) : « Moi » ne la liste pas parmi ses dossiers.
    const folders = subfolders(files, state.path, locale, spare).filter(folder => folder.path !== SPACES_ROOT).map(folder => ({ kind: 'folder', ...folder }));
    // Les dossiers vont par nom (renversés quand le tri par nom l'est), sauf quand la liste est triée par poids : ils suivent alors le même ordre que les fichiers (le tri est stable : à poids égal, l'ordre des noms).
    if (state.sort.key === 'poids') folders.sort((a, b) => (a.weight - b.weight) * state.sort.dir);
    else if (state.sort.key === 'name' && state.sort.dir < 0) folders.reverse();
    rows.unshift(...folders);
  }
  return { rows, flat, covered: flat ? pool : files.filter(file => inside(file.folder, state.path)) };
}

// Les types présents dans les fichiers, pour le filtre : [{ value, label, icon, family, count }] (types connus d'abord, puis inconnus).
export function typeChoices(files, typeLabel) {
  const found = new Map();
  for (const file of files) {
    const entry = found.get(file.type) || { value: file.type, label: typeLabel(file), icon: file.icon, family: file.family, known: file.known, count: 0 };
    entry.count += 1;
    found.set(file.type, entry);
  }
  return [...found.values()].filter(item => item.value !== '').sort((a, b) => a.label.localeCompare(b.label));
}

// « Nom <adresse> » ou « adresse » -> { name, initials } (jamais d'identité inventée : sans texte, rien).
export function person(by) {
  const raw = text(by).trim();
  if (!raw) return { name: '', initials: '' };
  const angle = /^(.*?)\s*<([^>]*)>\s*$/.exec(raw);
  const name = angle ? (angle[1].trim() || angle[2].trim()) : raw;
  const source = name.includes('@') ? name.split('@')[0] : name;
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const initials = (parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2)).toUpperCase();
  return { name, initials };
}

// La date d'une ligne : « Auj. 10:15 », « Hier », « 02/10 », ou avec l'année quand ce n'est pas l'année en cours. `i18n.t` donne les mots.
export function formatDate(timestamp, now, locale, t) {
  if (timestamp === null || timestamp === undefined) return '—';
  const date = new Date(timestamp * 1000);
  const day = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(now) - day(date)) / 86400000);
  if (diff === 0) return t('ex.today', { time: date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) });
  if (diff === 1) return t('ex.yesterday');
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(locale, sameYear ? { day: '2-digit', month: '2-digit' } : { day: '2-digit', month: '2-digit', year: 'numeric' });
}
