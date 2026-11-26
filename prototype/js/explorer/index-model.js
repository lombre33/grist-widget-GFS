// L'index des noms (choix du porteur, 26/11 : « Index tenu par Grist ») : pour chaque table de fichiers d'une app, une TABLE-RÉSUMÉ de Grist, groupée par la
// clé du fichier, qui ne garde que ce que l'explorateur montre (le nom, le type, la date, l'auteur, le dossier, les colonnes d'aide du partage) et le POIDS que
// le moteur de Grist a compté lui-même. L'explorateur la lit à la place de la table entière : quelques millisecondes pour un document de plusieurs centaines
// de mégaoctets, un renommage, une création et une suppression s'y voient, aucun contenu ne voyage (mesuré dans un vrai Grist, faits vérifiés 182).
//
// Ce module ne lit ni n'écrit rien : il dit quoi poser (`planIndex`, d'après les lignes que `RightsReader` lit) et quelles colonnes lire (`indexColumns`).
//   - Une table dont l'identifiant est le numéro de ligne (`colonnes.id: "id"`, les apps) ne se groupe pas par `id` : une colonne d'aide `GFS_Key` (formule
//     `$id`) sert de groupe. Une table à identifiant propre (`GFS_Fichiers`) se groupe par lui.
//   - Chaque colonne que la lecture légère garde (js/explorer/explorer-sql.js, `keptColumns`) est reprise par une formule `$group[0].<colonne>` ; `GFS_Row`
//   dit le
//     numéro de la ligne d'origine (les gestes d'écriture le visent), `GFS_Weight` les octets de la ligne comme `cellBytes` (js/weight/weight.js) les compte :
//     écrit en Python pour chaque type de colonne, égal à l'octet près dans un vrai Grist.
//   - Les tables liées au poids d'un fichier (`poids.liees`) ont la leur, groupée par la clé de liaison : une ligne par clé, `GFS_Weight` la somme des lignes.
//   - Les règles de lecture de la table d'origine (`fileRules`, js/sharing/sharing-model.js) se posent à l'identique sur le résumé, en lecture seule : sans
//   elles, il
//     laisserait voir les noms des fichiers des autres (mesuré, faits vérifiés 182). Une table qui porte une règle d'un autre auteur n'est pas indexée.

import { keptColumns, neededColumns } from './explorer-sql.js';
import { wantedBoth, helperSetOf } from '../sharing/helper-names.js';
import { fileRules, isSharingNote, onTable, rulesActions } from '../sharing/sharing-model.js';

export const KEY = 'GFS_Key'; // la colonne d'aide qui groupe une table dont l'identifiant est le numéro de ligne
export const ROW = 'GFS_Row'; // le numéro de la ligne d'origine
export const WEIGHT = 'GFS_Weight'; // les octets de la ligne d'origine (ou la somme du groupe, pour une table liée)

export const summaryName = (table, key) => `${table}_summary_${key}`;

// La colonne qui groupe la table d'une déclaration `spec` (contrats 2.4) : l'identifiant du manifeste, ou `GFS_Key` quand c'est le numéro de ligne.
export const keyOf = spec => {
  const id = spec && spec.colonnes && spec.colonnes.id;
  return !id || id === 'id' ? KEY : id;
};

// Les noms des tables-résumés de l'index pour des déclarations `specs` ([{ table, spec }]) : celles des tables de fichiers et celles de leurs tables liées. La
// page de chacune se range sous celle de GFS (js/files/page-tree.js).
export const indexNamesOf = specs => (specs || []).flatMap(({ table, spec }) => [summaryName(table, keyOf(spec)),
  ...((spec.poids && spec.poids.liees) || []).map(rule => summaryName(rule.table, rule.colonne))]);

const hidden = colId => /^gristHelper/.test(colId) || colId === 'manualSort';
const columnsOf = (existing, table) => {
  const found = existing.tables.find(row => row.tableId === table);
  return found ? existing.columns.filter(col => col.parentId === found.id && !hidden(col.colId)).map(col => ({ ...col })) : null;
};

// ---------- le poids, écrit pour le moteur de Grist ----------

// Les fonctions du poids, en tête de chaque formule : les octets d'une cellule comme `cellBytes` (js/weight/weight.js) les compte : un texte en UTF-8, un
// entier de 1 à 8 octets (selon sa taille), un flottant 8, un booléen 1, rien 0, une liste ou une valeur codée leur JSON.
const HELPERS = [
  'import json',
  'def _ib(n):', '  s = abs(n)', '  return 1 if s < 128 else 2 if s < 32768 else 3 if s < 2**23 else 4 if s < 2**31 else 6 if s < 2**47 else 8',
  'def _tx(v):', '  return len(v.encode("utf-8")) if isinstance(v, str) else 0',
  'def _num(v):', '  return 0 if v is None else _ib(int(v)) if float(v).is_integer() else 8',
  'def _enc(v):', '  return ["L"] + [_enc(x) for x in v] if isinstance(v, (list, tuple)) else v',
  'def _li(v):',
  '  items = _enc([x.id if hasattr(x, "id") else x for x in v])[1:]',
  '  return len(json.dumps(items, ensure_ascii=False, separators=(",", ":"), default=str).encode("utf-8"))',
  'def _ls(v):', '  return _li(v) if v else 0',
  'def _any(v):',
  '  if v is None: return 0',
  '  if isinstance(v, bool): return 1',
  '  if isinstance(v, str): return _tx(v)',
  '  if isinstance(v, (int, float)): return _num(v)',
  '  return _li(v) if isinstance(v, (list, tuple)) or hasattr(v, "__iter__") else 0',
];

// Les octets d'une cellule de `r.<colonne>` d'après le type de la colonne (mesuré égal à `cellBytes` : texte, entier, flottant, booléen, date, choix, liste de
// choix, référence, liste de références, pièces jointes, `Any`).
export function cellExpr(colId, type) {
  const value = `r.${colId}`;
  const kind = String(type).split(':')[0];
  if (kind === 'Text' || kind === 'Choice') return `_tx(${value})`;
  if (kind === 'Int' || kind === 'Numeric' || kind === 'Id') return `_num(${value})`;
  if (kind === 'Bool') return `(0 if ${value} is None else 1)`;
  if (kind === 'Date' || kind === 'DateTime') return `(0 if ${value} is None else 4)`;
  if (kind === 'Ref') return `_num(${value}.id)`;
  if (kind === 'ChoiceList' || kind === 'RefList' || kind === 'Attachments') return `_ls(${value})`;
  return `_any(${value})`;
}

// Le poids d'une ligne `r` de la table `columns` : la somme de toutes ses cellules (sauf `id` et le rang), comme `rowWeigher` (js/weight/weight.js).
const rowExpr = columns => (columns.length ? columns.map(col => cellExpr(col.colId, col.type)).join(' + ') : '0');

// La formule du poids d'une table de fichiers : la ligne du groupe (un groupe sans ligne pèse zéro).
export const weightFormula = columns => [...HELPERS, 'r = $group[0] if len($group) else None', 'if r is None:', '  return 0',
  `return ${rowExpr(columns)}`].join('\n');

// Celle d'une table liée : la somme des lignes du groupe (toutes celles qui portent la même clé).
export const linkedWeightFormula = columns => [...HELPERS, 'total = 0', 'for r in $group:', `  total += ${rowExpr(columns)}`, 'return total'].join('\n');

// ---------- ce que l'index reprend ----------

// Les colonnes reprises d'une table de fichiers : celles que la lecture légère garde, la clé exceptée (le résumé la porte déjà). [{ colId, type }].
export function mirrored(columns, spec, key) {
  return keptColumns(columns.filter(col => col.colId !== key), new Set(wantedBoth(neededColumns(spec))));
}

const mirrorFormula = colId => `$group[0].${colId} if len($group) else None`;
const NUMERIC = new Set(['Int', 'Numeric']); // Grist les somme lui-même dans un résumé : la colonne existe, on en change la formule

// Ce que l'index de la table `item` ({ table, spec }) a de posé : { base, columns, summary: { exists, cols, formulas } } ; `null` quand la table n'est pas là.
function stateOf(existing, item) {
  const cols = columnsOf(existing, item.table);
  if (!cols) return null;
  const key = keyOf(item.spec);
  const summary = columnsOf(existing, summaryName(item.table, key));
  return { cols, key, summary, hasKey: cols.some(col => col.colId === key) };
}

// Les actions qui posent les colonnes du résumé `name` : une formule par colonne reprise (AddColumn, ou ModifyColumn pour une colonne qui est déjà là, dont
// celles que Grist crée lui-même dans un résumé neuf : la somme de chaque colonne numérique), puis `extras` ([[colonne, champs]] : le numéro de ligne, le
// poids). Une colonne qui a déjà la bonne formule n'est pas réécrite.
function columnActions(name, have, wanted, extras, fresh) {
  const actions = [];
  const sums = new Set(fresh ? wanted.filter(col => NUMERIC.has(String(col.type))).map(col => col.colId) : []);
  const put = (colId, fields) => {
    const current = have.find(col => col.colId === colId);
    if (current && current.isFormula && current.formula === fields.formula && current.type === fields.type) return;
    actions.push(current || sums.has(colId) ? ['ModifyColumn', name, colId, fields] : ['AddColumn', name, colId, fields]);
  };
  for (const col of wanted) put(col.colId, { type: col.type, isFormula: true, formula: mirrorFormula(col.colId) });
  for (const [colId, fields] of extras) put(colId, fields);
  return actions;
}

// La clé de liaison d'une table liée : `rule.colonne`, la colonne de la table liée qui porte la clé du fichier.
const linkedItems = items => items.flatMap(item => ((item.spec.poids && item.spec.poids.liees) || []).map(rule => ({ table: rule.table, key: rule.colonne })))
  .filter((one, at, all) => all.findIndex(other => other.table === one.table && other.key === one.key) === at);

// Les règles du résumé : celles de la table d'origine, en lecture seule (la création et la modification n'ont pas de sens sur un résumé que Grist tient).
const readOnly = rules => rules.filter(rule => rule.rights !== '+C' && rule.rights !== '+UD').map(rule =>
  (rule.rights.startsWith('+') ? { ...rule, rights: '+R' } : rule));

// Des règles de GFS protègent-elles l'une de ces tables ? Alors le plan les recopie, en lecture seule, sur son résumé.
const copiesRules = (existing, todo) => todo.some(({ item }) => (existing.targets || []).some(target => target.table === item.table)
  && onTable(existing, item.table).some(rule => isSharingNote(rule.memo)));

// Le plan de l'index pour les tables de fichiers `existing.specs` ([{ table, spec }]) : `existing` : { resources, rules, tables, columns, targets, specs }
// (js/rights/rights-reader.js). Rend { ok: true, actions, again, creates, skipped, tables (les tables de fichiers à indexer), rules (des règles se recopient) }
// ou { ok: false, reason } : 'nothing' (rien à indexer), 'already' (tout est
// posé). `again` : une colonne d'aide manque, le plan ne la pose que ; le même geste, rejoué, pose les résumés (js/rights/rights-writer.js).
export function planIndex(existing) {
  const items = (existing.specs || []).filter((item, at, all) => item.spec && all.findIndex(other => other.table === item.table) === at);
  const states = items.map(item => ({ item, state: stateOf(existing, item) })).filter(entry => entry.state);
  if (!states.length) return { ok: false, reason: 'nothing' };
  const skipped = states.filter(({ item }) => onTable(existing, item.table).some(rule => !isSharingNote(rule.memo))).map(({ item }) => item.table);
  const todo = states.filter(({ item }) => !skipped.includes(item.table));
  if (!todo.length) return { ok: false, reason: skipped.length ? 'foreign' : 'nothing' };
  const about = { tables: todo.map(({ item }) => item.table), rules: copiesRules(existing, todo) };
  const missing = todo.filter(({ state }) => state.key === KEY && !state.hasKey);
  if (missing.length) {
    const actions = missing.map(({ item }) => ['AddColumn', item.table, KEY, { type: 'Int', isFormula: true, formula: '$id' }]);
    return { ok: true, actions, again: true, creates: [], skipped, ...about };
  }
  const built = build(existing, todo, skipped);
  return built.ok ? { ...built, ...about } : built;
}

// Les résumés à créer (`CreateViewSection` groupé par la clé, puis ses colonnes et ses règles) ou à compléter.
function build(existing, todo, skipped) {
  const actions = []; const creates = []; const groups = [];
  const refs = new Map(existing.tables.map(row => [row.tableId, row.id]));
  const colRef = (table, colId) => (existing.columns.find(col => col.parentId === refs.get(table) && col.colId === colId) || {}).id;
  // Les règles de la table, dans le jeu de noms de ses colonnes d'aide (un document que la mise à jour des noms n'a pas atteint les a en français) : le résumé
  // les reprend sous les mêmes noms.
  const rule = (target, table) => (target ? readOnly(fileRules({ ...target, set: helperSetOf((columnsOf(existing, table) || []).map(col => col.colId)) })) :
    []);
  for (const { item, state } of todo) {
    const name = summaryName(item.table, state.key);
    if (!state.summary) {
      actions.push(['CreateViewSection', refs.get(item.table), 0, 'record', [colRef(item.table, state.key)], null]);
      creates.push(name);
      const target = (existing.targets || []).find(each => each.table === item.table);
      const mine = onTable(existing, item.table).some(each => isSharingNote(each.memo));
      if (target && mine) groups.push({ tableId: name, colIds: '*', rules: rule(target, item.table) });
    }
    const have = state.summary || [];
    const wanted = mirrored(state.cols, item.spec, state.key);
    actions.push(...columnActions(name, have, wanted, [[ROW, { type: 'Int', isFormula: true, formula: '$group[0].id if len($group) else 0' }],
      [WEIGHT, { type: 'Int', isFormula: true, formula: weightFormula(state.cols) }]], !state.summary));
  }
  for (const { table, key } of linkedItems(todo.map(({ item }) => item))) {
    const cols = columnsOf(existing, table);
    const name = summaryName(table, key);
    // une règle sur la table liée : l'index ne la contournera pas
    if (!cols || !cols.some(col => col.colId === key) || onTable(existing, table).length) continue;
    const summary = columnsOf(existing, name);
    if (!summary) {
      actions.push(['CreateViewSection', refs.get(table), 0, 'record', [colRef(table, key)], null]);
      creates.push(name);
    }
    actions.push(...columnActions(name, summary || [], [], [[WEIGHT, { type: 'Int', isFormula: true, formula: linkedWeightFormula(cols) }]], !summary));
  }
  if (!actions.length) return { ok: false, reason: 'already' };
  return { ok: true, actions: [...actions, ...rulesActions(existing, groups)], again: false, creates, skipped };
}
