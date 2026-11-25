// Le rangement que l'app tient elle-même, quand son manifeste laisse GFS l'écrire (contrats 2.4, `rangement.ecriture` ; 6.4, point 8) : pour les fichiers de
// cette app, la table de l'app fait foi. GFS la lit et l'écrit (même ligne que l'app, par personne et par fichier), et l'app ouverte seule montre alors la même
// liste que l'explorateur. `GFS_Filing` ne garde pour elle que ce qui a précédé (repris ici au premier rangement) et, aux deux endroits, les dossiers que la
// personne garde sans fichier (6.4, point 11) quand l'app a une ligne pour cela (`ecriture.dossiers` : la valeur de la colonne du fichier qui marque une ligne
// d'état de dossier).
//
// Tout ce module travaille sur des tables telles que `fetchTable` les rend ; il n'écrit rien lui-même : il rend les actions du lot, que `Rangement.setFiling`
// (js/files/rangement.js) envoie en une seule fois avec celles de `GFS_Filing`.

import { normalizePath } from '../explorer/explorer-model.js';

const text = value => (typeof value === 'string' ? value : '');
const same = (a, b) => String(a) === String(b);
const hasMark = filing => filing.marque !== undefined;
// Un identifiant de fichier qui est un entier s'écrit en nombre (la colonne de `ModeleId` est un entier) ; une colonne de texte le convertit seule.
const valueOf = id => (/^[0-9]+$/.test(String(id)) ? Number(id) : String(id));

// Le rangement que GFS écrit chez cette app : le `rangement` de son manifeste, avec `app` (son identifiant) et `marque` (`ecriture.dossiers`, absent si l'app
// n'a pas de ligne d'état de dossier), ou null quand l'app n'a pas de rangement à elle ou ne le laisse pas écrire.
export function appFilingOf(manifest) {
  for (const spec of (manifest && manifest.fichiers) || []) {
    const filing = spec.rangement;
    if (filing && filing.ecriture) return { ...filing, app: manifest.id, marque: filing.ecriture.dossiers };
  }
  return null;
}

// La table de l'app est-elle là, avec toutes les colonnes que GFS lit et écrit ? Sinon GFS range comme avant, dans `GFS_Filing` : il n'ajoute jamais une
// colonne à la table d'une app, et n'écrit jamais une colonne absente (une seule annulerait tout le lot).
export function usable(filing, data) {
  return Boolean(filing && data) && [filing.utilisateur, filing.fichier, filing.dossier, filing.epingle].every(column => Array.isArray(data[column]));
}

// Les lignes de `data` que `test(i)` retient : leurs numéros.
const rowsWhere = (data, test) => data.id.filter((rowId, i) => test(i));

const mineAt = (filing, data, identity) => i => text(data[filing.utilisateur][i]) === identity;

// Les lignes d'état de dossier de la personne pour le chemin `path` : celles dont la colonne du fichier porte la marque.
const stateRows = (filing, data, identity, path) => rowsWhere(data, i => mineAt(filing, data, identity)(i) && same(data[filing.fichier][i], filing.marque)
  && normalizePath(data[filing.dossier][i]) === path);

// Les dossiers que la personne garde sans fichier chez l'app (les lignes d'état) : des chemins normalisés, sans doublon. Aucun quand l'app n'a pas de ligne
// d'état.
export function readAppFolders(filing, data, identity = '') {
  if (!hasMark(filing) || !usable(filing, data)) return [];
  const found = new Set();
  data.id.forEach((rowId, i) => {
    const path = normalizePath(data[filing.dossier][i]);
    if (path && mineAt(filing, data, identity)(i) && same(data[filing.fichier][i], filing.marque)) found.add(path);
  });
  return [...found];
}

// Les actions qui rangent des fichiers chez l'app : la ligne de la personne pour chaque fichier est mise à jour (toutes, s'il y en a plusieurs : l'app lit la
// dernière, GFS la première), ajoutée sinon ; puis les dossiers gardés (`add`, une ligne d'état chacun s'il n'y en a pas déjà) et ceux qu'on ne garde plus
// (`drop`, toutes leurs lignes d'état). `entries` : [{ file, pinned, folder }].
export function appActions(filing, tableId, data, identity, { entries = [], add = [], drop = [] }) {
  const actions = [];
  for (const { file, pinned, folder } of entries) {
    const record = { [filing.epingle]: pinned === true, [filing.dossier]: folder || '' };
    const rows = rowsWhere(data, i => mineAt(filing, data, identity)(i) && same(data[filing.fichier][i], file));
    if (rows.length) actions.push(...rows.map(rowId => ['UpdateRecord', tableId, rowId, record]));
    else actions.push(['AddRecord', tableId, null, { [filing.utilisateur]: identity, [filing.fichier]: valueOf(file), ...record }]);
  }
  if (!hasMark(filing)) return actions;
  for (const path of drop) actions.push(...stateRows(filing, data, identity, path).map(rowId => ['RemoveRecord', tableId, rowId]));
  for (const path of [...new Set(add)].filter(each => !drop.includes(each) && !stateRows(filing, data, identity, each).length)) {
    actions.push(['AddRecord', tableId, null, { [filing.utilisateur]: identity, [filing.fichier]: filing.marque, [filing.epingle]: false,
      [filing.dossier]: path }]);
  }
  return actions;
}

// Ce que `GFS_Filing` disait déjà de cette app pour la personne et que sa table ne dit pas, à passer chez l'app (6.4, point 8) : le rangement de GFS passait
// devant celui de l'app, la personne l'a vu ; il n'est pas perdu. Rend { entries, folders, removed } : `entries` les fichiers à ranger chez l'app (la première
// ligne de chaque fichier, comme la lecture ; une ligne sans dossier ni favori n'est reprise que si l'app a déjà une ligne pour ce fichier, qu'elle doit
// défaire), `folders` les dossiers sans fichier à garder chez l'app aussi, `removed` les actions qui retirent de `GFS_Filing` les lignes de fichier
// reprises : une ligne qui resterait pourrait défaire plus tard un rangement fait dans l'app. `gfs` : { tableId, data } ; `target` : { data } (la table de
// l'app).
export function carryOver(filing, target, gfs, identity) {
  const { data } = gfs;
  const known = new Set();
  target.data.id.forEach((rowId, i) => { if (mineAt(filing, target.data, identity)(i)) known.add(String(target.data[filing.fichier][i])); });
  const entries = new Map();
  const folders = new Set();
  const removed = [];
  ((data && data.id) || []).forEach((rowId, i) => {
    if (text(data.User[i]) !== identity) return;
    const app = text(data.App[i]);
    const file = text(data.File[i]);
    const folder = normalizePath(data.Folder[i]);
    if (app === filing.app && file) {
      removed.push(['RemoveRecord', gfs.tableId, rowId]);
      const pinned = data.Favorite[i] === true;
      if (!entries.has(file) && (known.has(file) || pinned || folder)) entries.set(file, { file, pinned, folder });
    } else if (!app && !file && folder && hasMark(filing)) folders.add(folder);
  });
  return { entries: [...entries.values()], folders: [...folders], removed };
}
