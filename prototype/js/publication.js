// L'accord de la personne à la publication d'un formulaire (contrats 3.3, point 9). Du code sans effet de bord, qui juge ce qu'un lot d'actions ouvre de nouveau.
//
// Ce que Grist ouvre à qui a le lien d'un formulaire publié (app/common/ACLRulesReader.ts : _addRulesForShare, _shareTableForForm, _shareTableReferencesForForm ;
// lu le 22/10, et mesuré par Form+ sur un vrai Grist) :
//   - AJOUTER des lignes dans la table de chaque section publiée (`shareOptions` : `publish` et `form`), dans TOUTES ses colonnes, même celles que le formulaire ne
//     montre pas (Grist le note lui-même : « hidden columns could be written ») ;
//   - LIRE toutes les valeurs de la colonne affichée (`visibleCol`) des tables vers lesquelles pointent les Références de ces formulaires.
// Rien d'autre : ni modifier, ni supprimer, ni relire une ligne existante.
//
// Le courtier calcule ce qui est ouvert avant le lot et après, et demande l'accord de la personne pour la différence. Le partage (la page) ne compte pas : un drapeau
// posé aujourd'hui ouvre dès qu'une page est partagée, et la personne peut la partager sans passer par GFS.

import { ERR, Refus, ROW_VERBS, PUBLISHING_TABLES, classify, readRefusal, writeRefusal } from './filter.js';

// Les quatre tables internes que ce calcul lit, et sous quel nom il les tient (une écriture dans les trois dernières peut changer ce qui est ouvert : PUBLISHING_TABLES).
const NAMES = { _grist_tables: 'tables', _grist_tables_column: 'columns', _grist_views_section: 'sections', _grist_views_section_field: 'fields' };
export const META_TABLES = ['_grist_Tables', '_grist_Tables_column', '_grist_Views_section', '_grist_Views_section_field'];

const lower = name => String(name).toLowerCase();
const isRef = type => /^Ref(List)?:/.test(String(type || ''));

export const touchesPublication = actions => actions.some(action => Array.isArray(action) && ROW_VERBS.has(action[0]) && PUBLISHING_TABLES.has(lower(action[1])));

// Les lignes d'une table que Grist rend par colonnes ({ id: [...], colonne: [...] }), en objets.
export function rowsOf(data) {
  const ids = (data && data.id) || [];
  const keys = Object.keys(data || {}).filter(key => key !== 'id');
  return ids.map((id, i) => Object.fromEntries([['id', id], ...keys.map(key => [key, data[key][i]])]));
}

const unjudgeable = verb => new Refus(ERR.REFUSE,
  `${verb} : GFS ne sait pas juger ce que ce verbe ouvre dans cette table interne ; AddRecord, UpdateRecord et RemoveRecord (ou leurs formes Bulk) se jugent.`);

// La ligne d'un verbe « Bulk » : les valeurs de chaque colonne à la position i.
function valuesAt(colValues, i, verb) {
  if (!colValues || typeof colValues !== 'object') throw unjudgeable(verb);
  return Object.fromEntries(Object.entries(colValues).map(([key, values]) => {
    if (!Array.isArray(values)) throw unjudgeable(verb);
    return [key, values[i]];
  }));
}

// Une ligne ajoutée sans numéro en reçoit un négatif, propre au calcul (`counter`).
const add = (rows, id, values, counter) => rows.push({ ...values, id: id ?? -(++counter.next) });
const update = (rows, id, values) => { const row = rows.find(item => item.id === id); if (row) Object.assign(row, values); };
const remove = (rows, ids) => { for (const id of ids) { const at = rows.findIndex(item => item.id === id); if (at >= 0) rows.splice(at, 1); } };

// Rejoue un verbe de lignes sur les lignes de sa table ; un verbe dont on ne sait pas dire ce qu'il change (un `AddOrUpdateRecord`, un `Bulk…` sans liste de lignes) lève un refus.
function replay(rows, [verb, , first, second], counter) {
  if (verb === 'AddRecord') add(rows, first, second || {}, counter);
  else if (verb === 'UpdateRecord') update(rows, first, second || {});
  else if (verb === 'RemoveRecord') remove(rows, [first]);
  else if (!Array.isArray(first)) throw unjudgeable(verb);
  else if (verb === 'BulkRemoveRecord') remove(rows, first);
  else if (verb === 'BulkAddRecord') first.forEach((id, i) => add(rows, id, valuesAt(second, i, verb), counter));
  else if (verb === 'BulkUpdateRecord') first.forEach((id, i) => update(rows, id, valuesAt(second, i, verb)));
  else throw unjudgeable(verb);
}

// Rejoue, sur des copies des quatre tables, les verbes de lignes qui les visent.
export function simulate(meta, actions) {
  const copy = Object.fromEntries(Object.values(NAMES).map(name => [name, meta[name].map(row => ({ ...row }))]));
  const counter = { next: 0 };
  for (const action of actions) {
    if (!Array.isArray(action) || !ROW_VERBS.has(action[0]) || !Object.hasOwn(NAMES, lower(action[1]))) continue;
    replay(copy[NAMES[lower(action[1])]], action, counter);
  }
  return copy;
}

const parse = text => {
  try { const value = JSON.parse(text || '{}'); return value && typeof value === 'object' ? value : {}; } catch { return {}; }
};

// Les lignes regroupées par la valeur d'une colonne : Map(valeur -> [élément]).
function groupBy(rows, key, pick) {
  const groups = new Map();
  for (const row of rows) {
    const list = groups.get(row[key]);
    if (list) list.push(pick(row)); else groups.set(row[key], [pick(row)]);
  }
  return groups;
}

// Une colonne de données : celle qu'une ligne ajoutée peut remplir. Les colonnes de formule, la colonne d'ordre et les colonnes d'aide de Grist n'en sont pas.
const isData = column => (!column.isFormula || !String(column.formula || '').trim()) && column.colId !== 'manualSort' && !String(column.colId).startsWith('gristHelper_');

// Ce que les sections marquées publiées ouvrent : { writes: Map(table -> { tableId, shown, columns }), reads: Map("table.colonne" -> { tableId, colId }) }.
// `shown` : les colonnes que le formulaire montre (un champ caché n'en est pas) ; `columns` : toutes les colonnes de données de la table.
export function exposureOf(meta) {
  const tableOf = new Map(meta.tables.map(row => [row.id, row.tableId]));
  const columnOf = new Map(meta.columns.map(row => [row.id, row]));
  const fieldsOf = groupBy(meta.fields, 'parentId', field => field);
  const dataOf = groupBy(meta.columns.filter(isData), 'parentId', column => column.colId);
  const writes = new Map();
  const reads = new Map();
  for (const section of meta.sections) {
    const options = parse(section.shareOptions);
    const tableId = tableOf.get(section.tableRef);
    if (!options.publish || !options.form || !tableId) continue;
    const entry = writes.get(tableId) || { tableId, shown: new Set(), columns: dataOf.get(section.tableRef) || [] };
    writes.set(tableId, entry);
    for (const field of fieldsOf.get(section.id) || []) {
      const column = columnOf.get(field.colRef);
      if (!column) continue;
      if (!parse(field.widgetOptions).formIsHidden) entry.shown.add(column.colId);
      const visible = isRef(column.type) && column.visibleCol ? columnOf.get(column.visibleCol) : null;
      const target = visible ? tableOf.get(visible.parentId) : null;
      if (target) reads.set(`${target}.${visible.colId}`, { tableId: target, colId: visible.colId });
    }
  }
  return { writes, reads };
}

// Ce que le lot ouvre de plus : { tables: [{ tableId, shown, unshown }], reads: [{ tableId, colId }] }. `unshown` : les colonnes de données que le formulaire ne montre pas
// et que le lien pourra pourtant remplir.
export function newExposure(before, after) {
  const tables = [...after.writes.values()].filter(entry => !before.writes.has(entry.tableId)).map(entry => ({
    tableId: entry.tableId,
    shown: entry.columns.filter(colId => entry.shown.has(colId)),
    unshown: entry.columns.filter(colId => !entry.shown.has(colId)),
  }));
  const reads = [...after.reads].filter(([key]) => !before.reads.has(key)).map(([, read]) => read);
  return { tables, reads };
}

// Pourquoi un lien public n'ouvrira jamais cette table, ou null (contrats 11.9, point 4c) : celle de GFS, celle d'une autre app, celle de l'app qui publie (à l'ajout : un lien n'y
// écrit jamais), ou ce que l'app ne pourrait pas écrire, ni lire, elle-même. La lecture d'une table de l'app qui publie passe par l'accord : le formulaire de Form+ y lit sa
// définition (consigne 013, qui la lui fait retirer).
function whyNot(policy, tableId, writing) {
  const kind = classify(policy, tableId);
  if (kind === 'gfs') return 'elle est réservée à GFS';
  if (kind === 'autre-app') return 'elle appartient à une autre app';
  if (kind === 'propre' && writing) return 'c\'est une table de l\'app : un lien public n\'y écrit jamais';
  return String((writing ? writeRefusal : readRefusal)(policy, tableId) || '').replace(/\.$/, '') || null;
}

// Ce que le lot ouvrirait et que GFS refuse sans même le proposer à la personne, ou null.
export function protectedRefusal(policy, opens) {
  const asked = [...opens.tables.map(({ tableId }) => [tableId, true]), ...opens.reads.map(({ tableId }) => [tableId, false])];
  for (const [tableId, writing] of asked) {
    const why = whyNot(policy, tableId, writing);
    if (why) return new Refus(ERR.REFUSE, `Ce lot ouvrirait ${tableId} ${writing ? 'à l\'ajout' : 'à la lecture'} par toute personne qui aurait le lien d'un formulaire : ${why}. GFS ne le propose pas à la personne.`);
  }
  return null;
}

async function readMeta(port) {
  try {
    const tables = await Promise.all(META_TABLES.map(tableId => port.doc.fetchTable(tableId)));
    return Object.fromEntries(Object.values(NAMES).map((name, i) => [name, rowsOf(tables[i])]));
  } catch (error) {
    throw new Refus(ERR.REFUSE, `GFS ne peut pas juger ce lot : la structure du document est illisible (${String((error && error.message) || error)}).`);
  }
}

// Ce que le lot ouvre de nouveau à qui aura le lien d'un formulaire, ou null. Aucune lecture quand le lot ne touche pas aux tables qui décident.
export async function publicationOpens(port, actions) {
  if (!touchesPublication(actions)) return null;
  const before = await readMeta(port);
  const opens = newExposure(exposureOf(before), exposureOf(simulate(before, actions)));
  return opens.tables.length || opens.reads.length ? opens : null;
}
