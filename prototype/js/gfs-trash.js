// La corbeille des fichiers des apps (décision du porteur, 04/11 ; contrats 6.7) : quand la personne met à la corbeille un fichier d'une app, GFS en garde une copie dans la table `GFS_Corbeille`
// du document et retire la ligne de la table de l'app ; restaurer remet la ligne, au même numéro quand il est libre. Ce module est tout ce que GFS en sait sans toucher à Grist : la table, ce
// qu'on y écrit, comment on la lit pour l'explorateur, et ce que la restauration remet dans la table de l'app. Du code sans effet de bord.
//
// La recette (`fichiers[].suppression`, contrats 2.4) est ce que le manifeste d'une app dit pour que GFS sache retirer et remettre un de ses fichiers ; sans elle, rien ne se supprime depuis GFS :
//   { ligne: true }                    un fichier est une ligne de cette table : la retirer le supprime, la remettre le restaure ;
//   uniques: [colonne, …]              colonnes dont la valeur désigne un fichier (un jeton) : si une ligne qui est déjà dans la table la porte, il n'y a rien à restaurer ;
//   exclusives: [colonne, …]           colonnes booléennes qu'une seule ligne peut avoir (« le modèle par défaut ») : restauré, le fichier ne la reprend pas si une autre ligne l'a ;
//   remettre: { colonne: valeur }      valeurs que la restauration pose à la place de celles qui étaient gardées ;
//   appel: true                        un fichier tient à plus qu'une ligne (un formulaire et son lien public, par exemple) : avant de retirer la ligne, GFS demande à l'app ouverte de fermer ce qui est lié
//                                      au fichier (l'appel `supprimer`, contrats 5.4, point 10) ; restaurer remet la ligne, sans rien demander à l'app.
// Une app seule, sans GFS, garde sa propre gestion de ses fichiers : GFS n'agit que sur ce que le manifeste déclare, et seulement quand l'app est servie par lui.

import { isExcluded } from './explorer-model.js';
import { sameName, freeName } from './gfs-files.js';
import { rowWeigher } from './weight.js';

export const BIN_TABLE = 'GFS_Corbeille';

// Une ligne par fichier supprimé. `Identifiant` : le nom de l'entrée (douze signes hexadécimaux) ; `App`, `Table`, `FichierId` : d'où le fichier vient et comment l'app le désignait ; `Nom`, `Type`,
// `Date`, `Auteur` : ce que l'explorateur montre, tel qu'il était ; `SupprimeLe`, `SupprimePar` : le geste ; `Instantane` : la ligne de l'app, en JSON.
export const BIN_COLUMNS = Object.freeze([
  { id: 'Identifiant', type: 'Text' }, { id: 'App', type: 'Text' }, { id: 'Table', type: 'Text' }, { id: 'FichierId', type: 'Text' },
  { id: 'Nom', type: 'Text' }, { id: 'Type', type: 'Text' }, { id: 'Date', type: 'DateTime:UTC' }, { id: 'Auteur', type: 'Text' },
  { id: 'SupprimeLe', type: 'DateTime:UTC' }, { id: 'SupprimePar', type: 'Text' }, { id: 'Instantane', type: 'Text' },
].map(column => Object.freeze(column)));
export const BIN_COLUMN_IDS = Object.freeze(BIN_COLUMNS.map(column => column.id));

const FORMAT = 1;
const text = value => (typeof value === 'string' ? value : '');
const cell = (data, column, i) => (column && data && Array.isArray(data[column]) ? data[column][i] : undefined);
const filled = value => value !== undefined && value !== null && value !== '' && value !== false && value !== 0;

// La recette d'une entrée `fichiers[]` du manifeste, ou null : l'app n'a pas dit comment supprimer ses fichiers.
export const recipeOf = spec => (spec && spec.suppression && spec.suppression.ligne === true ? spec.suppression : null);

// Le fichier tient à plus qu'une ligne : l'app ouverte est appelée (`supprimer`) avant que la ligne parte.
export const asksApp = spec => Boolean(recipeOf(spec) && spec.suppression.appel === true);

// Les colonnes de la table de l'app qu'on peut écrire à la restauration : celles que Grist rend et qui ne sont pas des formules (`dataColumns`, relues dans les tables internes de Grist).
export const writable = (data, dataColumns) => dataColumns.filter(column => column !== 'id' && Array.isArray(data && data[column]));

// L'instantané d'une ligne : { format, id, valeurs } ; `columns` : les colonnes à garder.
export function snapshotOf(data, i, columns) {
  const values = {};
  for (const column of columns) values[column] = data[column][i];
  return { format: FORMAT, id: data.id[i], valeurs: values };
}

// L'instantané relu, ou null quand le texte n'en est pas un.
export function parseSnapshot(json) {
  try {
    const value = JSON.parse(json);
    return value && value.format === FORMAT && value.valeurs && typeof value.valeurs === 'object' ? value : null;
  } catch (error) {
    return null;
  }
}

// La ligne de `GFS_Corbeille` d'un fichier supprimé. `file` : { id, name, type, ts, by } tel que la table de l'app le disait ; `id` : l'identifiant de l'entrée.
export const entryRecord = ({ id, app, spec, file, snapshot, now, author }) => ({
  Identifiant: id, App: app, Table: spec.table, FichierId: String(file.id), Nom: file.name, Type: file.type || '', Date: file.ts ?? null, Auteur: file.by || '',
  SupprimeLe: Math.floor(now / 1000), SupprimePar: author || '', Instantane: JSON.stringify(snapshot),
});

// Les entrées de `GFS_Corbeille` d'une table de fichiers, dans la forme que `readFiles` (js/explorer-model.js) lit : les colonnes de la table de l'app y portent ce que l'entrée a gardé. `id` reste le
// numéro de ligne de `GFS_Corbeille` (c'est lui qui désigne l'entrée) ; l'identifiant du fichier passe par `FichierId`. Rend { spec, data, weights } : l'entrée du manifeste à lire, les données, et
// ce que chaque entrée pèse dans le document (toute la ligne de `GFS_Corbeille`, copie JSON de la ligne de l'app comprise : c'est ce que la corbeille garde, non la ligne d'origine).
export function binFiles(spec, bin, appId) {
  const cols = spec.colonnes || {};
  const all = Array.from({ length: bin && Array.isArray(bin.id) ? bin.id.length : 0 }, (_, i) => i);
  const rows = all.filter(i => text(cell(bin, 'App', i)) === appId && text(cell(bin, 'Table', i)) === spec.table);
  const pick = column => rows.map(i => cell(bin, column, i));
  const binTable = { id: rows.map(i => bin.id[i]), FichierId: pick('FichierId'), SupprimeLe: pick('SupprimeLe'), SupprimePar: pick('SupprimePar') };
  for (const [key, from] of [['nom', 'Nom'], ['type', 'Type'], ['date', 'Date'], ['par', 'Auteur']]) if (cols[key]) binTable[cols[key]] = pick(from);
  return { spec: { ...spec, exclure: undefined, corbeille: { date: 'SupprimeLe', par: 'SupprimePar' }, colonnes: { ...cols, id: 'FichierId' } }, data: binTable, weights: rows.map(rowWeigher(bin)) };
}

// Ce que la restauration écrit dans la table de l'app (`data` : la table relue à l'instant), ou le constat qu'il n'y a rien à restaurer.
//   { present: true, name } : une ligne qui est déjà là porte la même valeur « unique » : rien n'est écrit, l'entrée de la corbeille part ;
//   { rowId, values, name, renamed } : le numéro de ligne à redonner (null : un numéro neuf, quelqu'un a pris le sien), les valeurs, le nom (le premier nom libre quand le sien est pris).
export function restorePlan({ snapshot, spec, data, columns }) {
  const recipe = recipeOf(spec) || {};
  const cols = spec.colonnes || {};
  const live = (data.id || []).map((row, i) => i).filter(i => !isExcluded(spec, data, i));
  const kept = snapshot.valeurs || {};
  const present = presentRow({ recipe, cols, kept, data, live });
  if (present) return present;
  const taken = live.map(i => text(cell(data, cols.nom, i)));
  const original = text(kept[cols.nom]);
  const name = taken.some(other => sameName(other, original)) ? freeName(original, taken, { extension: false }) : original;
  const values = restoredValues({ recipe, cols, kept, columns, name, data, live });
  const rowId = (data.id || []).includes(snapshot.id) ? null : snapshot.id;
  return { rowId, values, name, renamed: name !== original };
}

// Une ligne vivante porte déjà la même valeur « unique » : rien à restaurer, l'entrée part. Rend { present: true, name }, ou null quand aucune ne la porte.
function presentRow({ recipe, cols, kept, data, live }) {
  for (const column of recipe.uniques || []) {
    const wanted = kept[column];
    const same = filled(wanted) ? live.find(i => cell(data, column, i) === wanted) : undefined;
    if (same !== undefined) return { present: true, name: text(cell(data, cols.nom, same)) };
  }
  return null;
}

// Les valeurs redonnées à la ligne : celles que la corbeille a gardées, le nom libre, les colonnes « exclusives » éteintes quand une ligne vivante en porte une, puis les valeurs que la recette remet (`remettre`).
function restoredValues({ recipe, cols, kept, columns, name, data, live }) {
  const values = {};
  for (const column of columns) if (column in kept) values[column] = kept[column];
  if (columns.includes(cols.nom)) values[cols.nom] = name;
  for (const column of recipe.exclusives || []) if (columns.includes(column) && filled(values[column]) && live.some(i => filled(cell(data, column, i)))) values[column] = false;
  for (const [column, value] of Object.entries(recipe.remettre || {})) if (columns.includes(column)) values[column] = value;
  return values;
}
