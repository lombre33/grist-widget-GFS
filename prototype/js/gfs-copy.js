// La copie d'un fichier d'une app (décision du porteur, 04/11 : tout se fait depuis l'explorateur, « Dupliquer » compris ; contrats 2.4 `copie`, 6.3 point 2). Ce module est tout ce que GFS en sait
// sans toucher à Grist : la recette du manifeste et ce qu'on écrit dans la table de l'app. Du code sans effet de bord.
//
// La recette (`fichiers[].copie`, contrats 2.4) est ce que le manifeste d'une app dit pour que GFS sache copier un de ses fichiers ; sans elle, rien ne se copie depuis GFS :
//   { ligne: true }                    un fichier est une ligne de cette table : la copier, c'est ajouter une ligne qui a les mêmes valeurs ;
//   uniques: [colonne, …]              colonnes dont la valeur désigne un fichier (un jeton) : la copie les a vides (l'app en donne un à la copie quand elle en a besoin) ;
//   exclusives: [colonne, …]           colonnes booléennes qu'une seule ligne peut avoir (« le modèle par défaut ») : la copie ne les a pas ;
//   valeurs: { colonne: valeur }       valeurs que la copie reçoit à la place de celles de l'original.
// Le nom de la copie est le premier nom libre : « Contrat » devient « Contrat (1) ». La date et l'auteur du fichier restent ceux de l'original : le contenu est le même, et c'est l'app qui les met à jour
// quand elle enregistre. Une app seule, sans GFS, garde sa propre gestion de ses fichiers : GFS n'agit que sur ce que le manifeste déclare, et seulement quand l'app est servie par lui.

import { isExcluded } from './explorer-model.js';
import { freeName } from './gfs-files.js';
import { writable } from './gfs-trash.js';

const text = value => (typeof value === 'string' ? value : '');
const cell = (data, column, i) => (column && data && Array.isArray(data[column]) ? data[column][i] : undefined);

// La recette d'une entrée `fichiers[]` du manifeste, ou null : l'app n'a pas dit comment copier ses fichiers.
export const copyRecipeOf = spec => (spec && spec.copie && spec.copie.ligne === true ? spec.copie : null);

// Une valeur vide pour la colonne `type` : le texte vide d'une colonne de texte, sinon rien.
const emptyOf = type => (type === 'Text' || type === 'Choice' ? '' : null);

// Ce que la copie de la ligne `at` de `data` (la table de l'app relue à l'instant) écrit : { values, name }, ou null quand la colonne du nom n'existe pas (la copie porterait le nom de l'original).
// `columns` : les colonnes de données de la table, [{ id, type }] (sans les formules). Une ligne réservée (`exclure`) n'est pas un fichier : son nom ne compte pas.
export function copyPlan({ spec, data, at, columns }) {
  const recipe = copyRecipeOf(spec) || {};
  const nameColumn = (spec.colonnes || {}).nom;
  const ids = writable(data, columns.map(column => column.id));
  if (!ids.includes(nameColumn)) return null;
  const taken = (data.id || []).map((row, i) => i).filter(i => !isExcluded(spec, data, i)).map(i => text(cell(data, nameColumn, i)));
  const name = freeName(text(cell(data, nameColumn, at)), taken, { extension: false });
  const values = {};
  for (const column of ids) values[column] = data[column][at];
  values[nameColumn] = name;
  for (const column of recipe.uniques || []) if (column in values) values[column] = emptyOf((columns.find(item => item.id === column) || {}).type);
  for (const column of recipe.exclusives || []) if (column in values) values[column] = false;
  for (const [column, value] of Object.entries(recipe.valeurs || {})) if (column in values) values[column] = value;
  return { values, name };
}
