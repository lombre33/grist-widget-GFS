// Ce que l'annuaire sait des tables du document : leurs colonnes et leur type, lus dans les tables internes de Grist (`_grist_Tables`, `_grist_Tables_column`),
// donnés en tableaux de colonnes comme les rend `fetchTable`. Du code sans effet de bord : la lecture est à js/annuaire/annuaire-store.js.
//
// Un type de Grist devient un genre, celui dont l'annuaire a besoin : « text », « choice » et « choicelist » (un filtre par valeur), « bool » (un filtre
// oui/non), « date », « number », « ref » et « reflist » (une référence : sa valeur est celle de la colonne visible de la table visée), « file » (des pièces
// jointes : leur numéro se lit pour la photo et le logo, js/annuaire/annuaire-model.js ; leur contenu, js/annuaire/annuaire-images.js). Un type que l'annuaire
//   ne connaît pas est du texte. Une colonne dit aussi si Grist la calcule (`formula`) et, pour un choix, ses
//   valeurs
// (`choices`) : de quoi proposer de la modifier (js/annuaire/annuaire-edit.js).

import { keyPath } from './annuaire-config.js';

const GENRES = Object.freeze({ Choice: 'choice', ChoiceList: 'choicelist', Bool: 'bool', Int: 'number', Numeric: 'number', Date: 'date', Attachments: 'file' });

export function genreOf(type) {
  const text = String(type ?? '');
  if (text.startsWith('Ref:')) return 'ref';
  if (text.startsWith('RefList:')) return 'reflist';
  if (text.startsWith('DateTime')) return 'date';
  return GENRES[text] || 'text';
}

// La table que vise une colonne de référence (`Ref:Structures` : « Structures »), ou ''.
export const targetOf = type => (/^Ref(?:List)?:(.+)$/.exec(String(type ?? '')) || [])[1] || '';

// Les tables qu'un annuaire peut choisir : pas celles de Grist, pas celles de GFS, pas les tables de synthèse.
export const isPeopleTable = tableId => !/^(_grist_|GFS_)/i.test(tableId);

// Les choix qu'une colonne « Choix » ou « Choix multiple » propose, lus dans ses options (un texte JSON : `{"choices": ["Titulaire", …]}`) ; [] quand elle n'en
// dit pas ou que le texte est illisible.
function choicesOf(options) {
  try {
    const list = (typeof options === 'string' && options ? JSON.parse(options) : {}).choices;
    return Array.isArray(list) ? list.filter(each => typeof each === 'string' && each) : [];
  } catch (error) {
    return [];
  }
}

const column = (data, name, i) => (data && Array.isArray(data[name]) ? data[name][i] : undefined);

// { [tableId]: { columns: [{ id, type, genre, ref, visible, formula, choices }] } } d'après les deux tables internes de Grist. Une colonne « manualSort », une
// colonne d'aide de Grist (`gristHelper_…`) et une colonne sans nom sont ignorées. `visible` : le nom de la colonne que Grist montre pour une référence (celle
// de la table visée, sinon vide : la valeur est alors le numéro de la ligne, que l'annuaire n'affiche jamais).
export function schemaOf(tablesData, columnsData) {
  const names = new Map();
  (tablesData && tablesData.id || []).forEach((id, i) => {
    const summary = column(tablesData, 'summarySourceTable', i);
    if (!summary) names.set(id, String(column(tablesData, 'tableId', i) ?? ''));
  });
  const colNames = new Map();
  (columnsData && columnsData.id || []).forEach((id, i) => colNames.set(id, String(column(columnsData, 'colId', i) ?? '')));
  const schema = {};
  for (const name of names.values()) if (name) schema[name] = { columns: [] };
  (columnsData && columnsData.id || []).forEach((id, i) => {
    const table = names.get(column(columnsData, 'parentId', i));
    const colId = colNames.get(id);
    if (!table || !colId || colId === 'manualSort' || colId.startsWith('gristHelper_')) return;
    const type = String(column(columnsData, 'type', i) ?? 'Any');
    schema[table].columns.push({ id: colId, type, genre: genreOf(type), ref: targetOf(type), visible: colNames.get(column(columnsData, 'visibleCol', i)) ||
      '', formula: column(columnsData, 'isFormula', i) === true, choices: choicesOf(column(columnsData, 'widgetOptions', i)) });
  });
  return schema;
}

// La colonne `colId` d'une table du schéma, ou null.
export const columnOf = (schema, tableId, colId) => ((schema[tableId] && schema[tableId].columns) || []).find(each => each.id === colId) || null;

// La colonne qu'un chemin désigne depuis `tableId` (les colonnes suivies sont des références simples), ou null.
export function columnAt(schema, tableId, columns) {
  let table = tableId;
  let col = null;
  for (const id of columns) {
    col = table ? columnOf(schema, table, id) : null;
    table = col && col.genre === 'ref' ? col.ref : '';
  }
  return col;
}

// Les tables que la lecture d'un annuaire demande : celle des personnes et, pour chaque colonne d'un niveau ou d'un champ qui est une référence, la table visée
// (de proche en proche : un chemin `Structure › Pôle` lit la table des structures). `config` : voir js/annuaire/annuaire-config.js.
export function tablesNeeded(config, tableId, schema) {
  const needed = new Set([tableId]);
  const follow = (from, colId) => {
    const col = columnOf(schema, from, colId);
    if (!col || !col.ref || !schema[col.ref]) return null;
    needed.add(col.ref);
    return col.ref;
  };
  const walk = columns => { let at = tableId; for (const colId of columns) { if (!at) break; at = follow(at, colId); } };
  for (const level of config.levels) walk(level.path);
  for (const field of config.fields) walk(field.path && field.path.length ? field.path : [field.col]);
  for (const key of ['name', 'first', 'title', 'email', 'phone', 'avatar', 'logo']) if (config[key]) walk(keyPath(config[key]));
  if (config.lead) walk([config.lead]);
  return needed;
}
