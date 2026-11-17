// Les liens entre espaces (contrats 11.7, point 13.o ; choix du porteur, 13/11 : « un lien avec son droit »). Un dossier ou un fichier d'un espace A se montre
// dans un espace B, sans copie : c'est le même dossier, et les groupes de B y ont la lecture ou l'écriture. Un lien est une ligne de `GFS_Placement` sans
// `Cible` qui porte `Lien` (la cible à montrer : un fichier ou `dossier:<clé>/<chemin>`), l'espace B et le dossier de B où il se montre. **Il ne donne aucun
// droit par
// lui-même** : à sa création, GFS écrit des lignes de partage ordinaires sur la source pour les groupes de B (`Partages` garde ceux qu'il a ajoutés, pour les
//   retirer avec lui), et Grist les calcule comme tous les partages (le droit le plus précis gagne, « Aucun accès » d'un fichier du dossier reste gagnant). Ce
//   qui se montre sous le lien, Grist le dit aussi : la colonne d'aide `GFS_Vus` de chaque fichier (js/sharing/sharing-model.js) donne les chemins où il se
//   montre, et une personne ne lit que les fichiers où elle a un droit. Ce module ne touche pas à Grist : il rend des actions et pose les chemins sur les
//   fichiers.

import { normalize } from '../ui/search.js';
import { listOf } from './direct-shares.js';
import { GROUP_PREFIX, PLACE_TABLE, SHARES_TABLE, STAMP, shareRecord } from './sharing-model.js';

export const LINK_RIGHTS = Object.freeze(['lecture', 'ecriture']);
const WEIGHT = Object.freeze({ aucun: 0, lecture: 1, ecriture: 2, admin: 3 });
const lower = text => String(text ?? '').trim().toLowerCase();
const cleanPath = path => String(path ?? '').split('/').map(part => part.trim()).filter(Boolean).join('/');

// Les groupes d'un espace qui y ont un droit (`space` : un espace de `spacesOf`, js/sharing/sharing-model.js), sans doublon.
export const groupsOfSpace = space => [...new Set((space ? space.groups : []).filter(item => WEIGHT[item.right] > 0).map(item => item.group))];

// Créer un lien : `source` la cible à montrer, `space` l'espace B (`spacesOf`), `folder` où il se montre dans B (le nom du lien pour un dossier, le dossier
// d'accueil pour un fichier), `right` le droit des groupes de B. Rend { ok: true, actions, groups } ou { ok: false, reason } : 'invalid', 'noGroup' (l'espace
// n'a aucun groupe : personne n'y recevrait de droit), 'sameSpace', 'exists'. Un groupe qui a déjà un droit plus large sur la source le garde ; un droit plus
// étroit est élargi.
export function planLink({ source, space, folder, right, shareRows = [], placeRows = [], kind = 'folder' }) {
  const path = cleanPath(folder);
  if (!source || !space || !LINK_RIGHTS.includes(right) || (kind === 'folder' && !path)) return { ok: false, reason: 'invalid' };
  const groups = groupsOfSpace(space);
  if (!groups.length) return { ok: false, reason: 'noGroup' };
  if (inSpace(source, space)) return { ok: false, reason: 'sameSpace' };
  if (placeRows.some(row => row.Lien === source && row.Espace === space.key && cleanPath(row.Dossier) === path)) return { ok: false, reason: 'exists' };
  const added = [];
  const actions = [];
  for (const name of groups) {
    const who = `${GROUP_PREFIX}${name}`;
    const row = shareRows.find(item => item.Cible === source && String(item.Personne) === who);
    if (!row) { actions.push(['AddRecord', SHARES_TABLE, null, shareRecord({ target: source, who, right, download: true })]); added.push(who); }
    else if ((WEIGHT[row.Droit] ?? 0) < WEIGHT[right]) actions.push(['UpdateRecord', SHARES_TABLE, row.id, { Droit: right }]);
  }
  actions.push(['AddRecord', PLACE_TABLE, null, { Cible: '', Espace: space.key, Dossier: path, Lien: source, Partages: added.join(',') }]);
  return { ok: true, actions, groups };
}

// Ce dossier source est-il déjà dans cet espace (on ne lie pas un dossier dans son propre espace) ?
export const inSpace = (source, space) => String(source).startsWith(`dossier:${space.key}/`);

// Retirer un lien (`link` : un lien de `readSpaces`) : sa ligne, et les lignes de partage qu'il avait ajoutées sur la source (celles qui existaient avant, ou
// que quelqu'un a ajoutées depuis, restent). Les fichiers ne sont jamais touchés.
export function planLinkRemove(link, shareRows = []) {
  if (!link || !link.id) return { ok: false, reason: 'none' };
  const mine = new Set(String(link.groups || '').split(',').map(name => name.trim()).filter(Boolean));
  const rows = shareRows.filter(row => row.Cible === link.source && mine.has(String(row.Personne))).map(row => row.id);
  return { ok: true, actions: [...(rows.length ? [['BulkRemoveRecord', SHARES_TABLE, rows]] : []), ['RemoveRecord', PLACE_TABLE, link.id]] };
}

// Le lien que montre le dossier `path` de l'explorateur (le dossier du lien lui-même), ou null.
export const linkAt = (info, path) => (info && info.links ? info.links.find(link => link.path === path && link.source.startsWith('dossier:')) || null : null);

// Le lien dont ce dossier de l'explorateur fait partie (le dossier du lien, ou dessous : ce sont les dossiers de la source, vus d'ici), ou null : on n'y range
// ni n'y partage rien, c'est dans l'espace d'origine que cela se règle.
export const linkWithin = (info, path) => (info && info.links ? info.links.find(link => link.source.startsWith('dossier:') &&
  (path === link.path || path.startsWith(`${link.path}/`))) || null : null);

// Pose les chemins des liens sur les fichiers : pour chaque fichier, `GFS_Vus` (la colonne que Grist calcule dans `data`, la table telle que `fetchTable` la
// rend) donne « <clé de l'espace>/<chemin> » ; une copie du fichier (même clé, même ligne : c'est le même fichier) se montre à ce chemin, pour les espaces que
// la personne lit. Une copie ne se range pas (`linked`, sans `space`). L'original d'un fichier qu'une personne ne voit nulle part ailleurs (ni dans son espace,
// ni dans un dossier à elle, ni donné par son adresse, ni de sa main : `GFS_Auteur`) se retire de la liste : il n'a pas à traîner à la racine de « Moi ». Rend
// la liste.
export function applyLinks(files, data, info, identity = '') {
  if (!info || !info.links || !info.links.length || !data || !Array.isArray(data.id) || !Array.isArray(data.GFS_Vus)) return files;
  const at = new Map(data.id.map((row, i) => [row, i]));
  const spaces = new Map(info.spaces.map(space => [space.key, space]));
  const me = lower(identity);
  const shown = [];
  const gone = new Set();
  for (const file of files) {
    const index = at.get(file.row);
    const copies = copiesOf(file, listOf(data.GFS_Vus[index]).map(String), spaces);
    shown.push(...copies);
    if (copies.length && forgettable(file, lower((data[STAMP] || [])[index]), me)) gone.add(file);
  }
  if (gone.size) files.splice(0, files.length, ...files.filter(file => !gone.has(file)));
  files.push(...shown);
  return files;
}

// Les copies d'un fichier : une par chemin de `GFS_Vus` dont l'espace est lu par la personne (`spaces` : clé -> espace).
function copiesOf(file, paths, spaces) {
  const copies = [];
  for (const item of paths) {
    const [key, ...rest] = item.split('/');
    const parts = rest.filter(Boolean);
    const space = spaces.get(key);
    if (!space) continue;
    const folder = parts.length ? `${space.path}/${parts.join('/')}` : space.path;
    copies.push({ ...file, folder, space: null, ownFolder: undefined, direct: undefined, linked: { space: space.key },
      search: normalize(`${file.name} ${folder}`) });
  }
  return copies;
}

// L'original n'a plus sa place à la racine de « Moi » : ni dans un espace que la personne lit, ni rangé par elle, ni donné par son adresse, ni de sa main.
const forgettable = (file, author, me) => !file.space && file.folder === '' && !file.direct && author !== '' && author !== me;
