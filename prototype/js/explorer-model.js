// Le modèle de l'explorateur (contrats 2.4, 6.4) : des fonctions sans effet de bord. Elles lisent les tables de fichiers d'après le manifeste
// de chaque app (GFS ne garde que les colonnes déclarées, n'écrit jamais), rangent les fichiers en dossiers, filtrent et trient.
//
// Les tables arrivent telles que `fetchTable` les rend : { id: [..], <colonne>: [..] }. Une colonne déclarée mais absente se lit comme vide :
// un document ancien n'a pas toutes les colonnes (2.4, point 2).

import { normalize, words, matchesWords } from './search.js';

// Le champ `couleur` du manifeste -> la famille de couleur de la charte (cahier 6.5) ; tout autre mot : neutre.
const FAMILIES = Object.freeze({ document: 'doc', grille: 'grid', presentation: 'slides' });
const RECENT_LIMIT = 8;

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

function isExcluded(spec, data, i) {
  return Object.entries(spec.exclure || {}).some(([column, values]) => Array.isArray(values) && values.includes(text(cell(data, column, i))));
}

// Les fichiers d'une table : { key, app, id, name, type, typeInfo, known, family, icon, ts, by, folder, pinned, search }.
// `typeInfo` est l'entrée de `types` qui porte le type, ou null : un type que le manifeste ne connaît pas est listé grisé (6.5, point 3).
export function readFiles(manifest, spec, data) {
  const cols = spec.colonnes || {};
  const files = [];
  for (let i = 0; i < rowCount(data); i++) {
    if (isExcluded(spec, data, i)) continue;
    const rawId = cell(data, cols.id, i);
    if (rawId === undefined || rawId === null) continue;
    const type = text(cell(data, cols.type, i)) || spec.typeParDefaut || '';
    const typeInfo = (spec.types || []).find(item => item.valeur === type) || null;
    const name = text(cell(data, cols.nom, i));
    files.push({
      key: `${manifest.id}:${rawId}`, app: manifest.id, id: String(rawId), name, type, typeInfo, known: Boolean(typeInfo),
      family: (typeInfo && FAMILIES[typeInfo.couleur]) || '', icon: (typeInfo && typeInfo.icone) || 'doc',
      ts: seconds(cell(data, cols.date, i)), by: text(cell(data, cols.par, i)), folder: normalizePath(cell(data, cols.dossier, i)), pinned: false,
      search: '',
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

// Pose dossier et favori sur les fichiers, et le texte de recherche (nom et dossier, normalisés une fois).
export function applyFiling(files, filing) {
  for (const file of files) {
    const entry = filing && filing.get(file.id);
    if (entry) { file.folder = entry.folder; file.pinned = entry.pinned; }
    file.search = normalize(`${file.name} ${file.folder}`);
  }
  return files;
}

// Le fichier est-il dans le dossier `path` (ou dans un de ses sous-dossiers) ? La racine '' contient tout.
export const inside = (folder, path) => path === '' || folder === path || folder.startsWith(`${path}/`);

// Les sous-dossiers directs de `path` : [{ path, name, count, ts }] triés par nom. Un dossier existe tant qu'un fichier le nomme.
export function subfolders(files, path, locale) {
  const found = new Map();
  for (const file of files) {
    if (file.folder === path || !inside(file.folder, path)) continue;
    const rest = path ? file.folder.slice(path.length + 1) : file.folder;
    const name = rest.split('/')[0];
    const entry = found.get(name) || { path: path ? `${path}/${name}` : name, name, count: 0, ts: null };
    entry.count += 1;
    if (file.ts !== null && (entry.ts === null || file.ts > entry.ts)) entry.ts = file.ts;
    found.set(name, entry);
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name, locale, { sensitivity: 'base', numeric: true }));
}

// L'arbre des dossiers pour le volet : [{ path, name, depth, count, hasChildren }] dans l'ordre d'affichage, selon les dossiers ouverts.
export function treeRows(files, openPaths, locale) {
  const rows = [];
  const walk = (path, depth) => {
    for (const folder of subfolders(files, path, locale)) {
      const children = subfolders(files, folder.path, locale).length > 0;
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

const SORTERS = {
  name: (a, b, c) => c.name(a, b),
  type: (a, b, c) => (a.typeInfo ? c.label(a) : a.type).localeCompare(b.typeInfo ? c.label(b) : b.type, c.locale, { sensitivity: 'base' }),
  mod: (a, b) => (a.ts ?? -Infinity) - (b.ts ?? -Infinity),
  by: (a, b, c) => a.by.localeCompare(b.by, c.locale, { sensitivity: 'base' }),
};

// Les lignes affichées : { rows: [{ kind: 'folder', ... } | { kind: 'file', file }], flat }.
// `state` : { view: 'folder'|'recent'|'fav', path, q, type, sort: { key, dir } } ; `locale` : pour le tri ; `typeLabel(file)` : le nom du type dans la langue.
// Récents garde d'abord les huit plus récents, puis les trie comme demandé (l'explorateur y commence par « modifié, le plus récent d'abord »).
export function listItems(files, state, { locale, typeLabel }) {
  const needles = words(state.q);
  const filtering = needles.length > 0 || state.type !== 'all';
  const ctx = { locale, label: typeLabel, name: (a, b) => (a.name || '').localeCompare(b.name || '', locale, { sensitivity: 'base', numeric: true }) };
  let pool;
  let flat = true;
  if (state.view === 'recent') pool = [...files].sort((a, b) => (b.ts ?? -Infinity) - (a.ts ?? -Infinity)).slice(0, RECENT_LIMIT);
  else if (state.view === 'fav') pool = files.filter(file => file.pinned);
  else if (filtering) pool = files;
  else { pool = files.filter(file => file.folder === state.path); flat = false; }
  pool = pool.filter(file => (state.type === 'all' || file.type === state.type) && matchesWords(needles, file.search));
  const sorter = SORTERS[state.sort.key] || SORTERS.name;
  const compare = (a, b) => (sorter(a, b, ctx) * state.sort.dir) || ctx.name(a, b);
  pool.sort(compare);
  const rows = pool.map(file => ({ kind: 'file', file }));
  if (!flat) {
    const dir = state.sort.key === 'name' ? state.sort.dir : 1;
    const folders = subfolders(files, state.path, locale).map(folder => ({ kind: 'folder', ...folder }));
    if (dir < 0) folders.reverse();
    rows.unshift(...folders);
  }
  return { rows, flat };
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
