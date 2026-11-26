// Le verrou réel de « qui modifie les fiches » (module Annuaire ; choix du porteur, 26/11 : « Oui, sur demande, avec aperçu »). La règle de GFS (js/annuaire/
// annuaire-edit-rights.js) grise « Modifier » ; elle n'arrête personne. Ici, les règles d'accès de Grist qui la font tenir sur la table des personnes : le
// propriétaire les voit d'abord (l'aperçu), GFS ne les écrit qu'à son accord, et elles se retirent. Du code pur : il reçoit les lignes des tables internes de
// Grist (lues par un propriétaire prouvé, js/rights/rights-reader.js) et rend les actions ; la lecture et l'écriture sont à
// js/annuaire/annuaire-lock-control.js.
//
// Ce que Grist ne sait pas faire seul, GFS le fait faire par deux colonnes d'aide de la table des personnes (comme les colonnes `GFS_Resp` de contrats 11.4,
// point 4 : jamais un « attribut de personne », qui recharge la page) : `GFS_Node` (la structure où la personne se range : le même identifiant que
// `nodeId`, js/annuaire/annuaire-model.js) et `GFS_Editors` (les adresses, en minuscules, de ceux qui peuvent modifier cette fiche). Une règle de Grist ne
// compare que ces copies : `user.Email.lower() in rec.GFS_Editors`.
//   - les propriétaires gardent toute la main, en premier (contrats 11.1, point 6) ;
//   - une fiche se modifie par ceux de `GFS_Editors` ; personne d'autre (`-U`) ; ajouter et supprimer une fiche reste à Grist ;
//   - l'adresse, le rôle désigné et la colonne de chaque niveau ne se changent que par un propriétaire : sans cela, la personne qui modifie sa propre fiche se
//     donnerait la structure ou le rôle d'une autre (les colonnes passent avant la table, 11.4 point 3) ;
//   - « Ma présence » : chacun garde la main sur la case de sa propre fiche.
// Ne tient que si la structure est fermée (13/11 : un éditeur réécrit sinon la formule des colonnes d'aide) : le plan sait la fermer dans la même écriture.

import { columnOf } from './annuaire-schema.js';
import { effectiveConfig, keyPath } from './annuaire-config.js';
import { withStructureClosed } from '../rights/rights-plan.js';

export const NODE_COLUMN = 'GFS_Node';
export const EDITORS_COLUMN = 'GFS_Editors';
const HELPERS = Object.freeze([NODE_COLUMN, EDITORS_COLUMN]);
const NOTE_ANY = /^\s*GFS\s*:\s*Annuaire\b/i;
const OWNERS = 'user.Access in [OWNER]';
const SEP = '\\x1f'; // ce que la formule écrit : le caractère que `nodeId` met entre deux niveaux

// La note de nos règles : « GFS : Annuaire · … » (js/rights/rights.js ne la prend pour aucun niveau : « Retirer les règles de GFS » ne les touche pas).
export const isLockNote = memo => NOTE_ANY.test(String(memo ?? ''));
const maxId = rows => rows.reduce((top, row) => Math.max(top, Number(row.id) || 0), 0);

// ---------- ce que le verrou demande ----------

// L'expression de Grist d'un chemin de colonnes depuis la ligne `row` (`$` : la ligne de la formule ; `r.` : une autre) ; null quand le chemin n'est pas
// lisible d'une formule (une liste, des pièces jointes, une référence qui ne montre rien). Les maillons sont des références simples ; la dernière colonne dit
// sa valeur (celle que l'annuaire montre : la colonne visible d'une référence).
function pathExpr(schema, table, path, row) {
  let at = table;
  let tail = '';
  for (let i = 0; i < path.length; i++) {
    const col = columnOf(schema, at, path[i]);
    if (!col) return null;
    if (i < path.length - 1) {
      if (col.genre !== 'ref') return null;
      at = col.ref;
    } else if (['reflist', 'choicelist', 'file'].includes(col.genre)) return null;
    else if (col.genre === 'ref') {
      if (!col.visible) return null;
      tail = `.${col.visible}`;
    }
  }
  return path.length ? `${row}${path.join('.')}${tail}` : null;
}

// Ce que la configuration d'un annuaire demande au verrou : { ok: true, table, self, level ('' | 'own' | 'below'), role (colonne ou ''), email (la colonne),
// levels: [expression des niveaux], protect: [colonnes que seul un propriétaire change], presence (la colonne de « Ma présence », ou ''), helpers (les colonnes
// d'aide voulues : { id, type, formula }) }, ou { ok: false, reason } : 'no-table' (la table n'existe pas), 'no-email' (pas de colonne d'adresse, ou lue dans
// une table liée : une règle de Grist la lit dans la ligne), 'level' (un niveau qu'une formule ne sait pas lire), 'no-column' (la colonne du rôle ou de la
// présence n'existe plus).
export function lockSpec({ table, config, schema }) {
  if (!table || !schema || !schema[table]) return { ok: false, reason: 'no-table' };
  const named = namedColumns({ table, config, schema });
  if (named.reason) return { ok: false, reason: named.reason };
  const levels = effectiveConfig(config).levels;
  const edit = config.edit || {};
  const level = edit.level && levels.length ? edit.level : '';
  const exprs = level ? levels.map(each => pathExpr(schema, table, each.path, '$')) : [];
  if (exprs.some(each => !each)) return { ok: false, reason: 'level' };
  const { emailCol, role, presence } = named;
  const self = edit.self === true;
  const editors = self || Boolean(level) || Boolean(role);
  const spec = { ok: true, table, self, level, role, email: emailCol.id, presence, levels: exprs, editors,
    protect: editors ? protectedColumns([emailCol.id, role, ...(level ? levels.map(each => each.path[0]) : [])]) : [] };
  return { ...spec, helpers: helperColumns(spec) };
}

// Les colonnes que seul un propriétaire change : l'adresse, le rôle désigné et la première colonne de chaque niveau (une fois chacune).
const protectedColumns = ids => [...new Set(ids.filter(Boolean))];

// Les colonnes que le réglage nomme et que les règles lisent : l'adresse (une colonne de la table, pas un chemin), le rôle désigné, la case de la présence ;
// { reason } quand l'une manque.
function namedColumns({ table, config, schema }) {
  const email = keyPath(config.email);
  const emailCol = email.length === 1 ? columnOf(schema, table, email[0]) : null;
  const role = (config.edit && config.edit.role) || '';
  const presence = config.presence && config.presence.on ? config.presence.col : '';
  if (!emailCol) return { reason: 'no-email' };
  return [role, presence].some(id => id && !columnOf(schema, table, id)) ? { reason: 'no-column' } : { emailCol, role, presence };
}

// L'adresse de la ligne `row` (`$` ou `r.`), nettoyée comme GFS la compare : sans espaces autour, en minuscules.
const mailOf = (spec, row) => `str(${row}${spec.email} or "").strip().lower()`;

// La formule de `GFS_Node` : « \x1f0:Pôle\x1f1:Direction », les niveaux vides sautés (`nodeId`).
const nodeFormula = spec => `nodes = [str(x) if x not in (None, "") else "" for x in (${spec.levels.join(', ')},)]\n` +
  `return "".join("${SEP}%d:%s" % (i, v) for i, v in enumerate(nodes) if v)`;

// La formule de `GFS_Editors` : les adresses de ceux qui modifient cette fiche. Sa structure : ceux du même nœud (`own`) et, avec `below`, ceux de tous les
// nœuds au-dessus (le nœud d'une personne est le préfixe du nôtre, au séparateur près : `editRight`) ; le nœud racine n'ouvre aucun droit.
function editorsFormula(spec) {
  const lines = ['out = set()', `table = ${spec.table}`];
  if (spec.self) lines.push(`mail = ${mailOf(spec, '$')}`, 'if mail: out.add(mail)');
  if (spec.level) {
    const owner = spec.level === 'below' ? 'range(2, len(parts) + 1)' : '[len(parts)]';
    lines.push(`node = $${NODE_COLUMN}`, 'parts = node.split("' + SEP + '") if node else []',
      `for k in (${owner} if node else []):`, `  for r in table.lookupRecords(${NODE_COLUMN}="${SEP}".join(parts[:k])):`,
      `    mail = ${mailOf(spec, 'r.')}`, '    if mail: out.add(mail)');
  }
  if (spec.role) lines.push(`for r in table.lookupRecords(${spec.role}=True):`, `  mail = ${mailOf(spec, 'r.')}`, '  if mail: out.add(mail)');
  lines.push('return tuple(sorted(out))');
  return lines.join('\n');
}

function helperColumns(spec) {
  if (!spec.self && !spec.level && !spec.role) return [];
  return [...(spec.level ? [{ id: NODE_COLUMN, type: 'Text', formula: nodeFormula(spec) }] : []),
    { id: EDITORS_COLUMN, type: 'Any', formula: editorsFormula(spec) }];
}

// ---------- les règles voulues ----------

// Les règles que le verrou veut, dans l'ordre où Grist les évalue : [{ colIds, rules: [{ key, formula, rights, memo }] }]. `say(clé)` : le texte de la note
// de chaque règle (la langue de la personne qui pose ; elle sert au refus que Grist montre).
export function lockResources(spec, say) {
  const rule = (key, formula, rights) => ({ key, formula, rights, memo: `GFS : Annuaire · ${say(key)}` });
  const resources = [];
  if (spec.protect.length) resources.push({ colIds: spec.protect.join(','), rules: [rule('cols.owners', OWNERS, '+U'), rule('cols.others', '', '-U')] });
  if (spec.presence) {
    const own = `user.Email and rec.${spec.email} and rec.${spec.email}.lower() == user.Email.lower()`;
    resources.push({ colIds: spec.presence, rules: [rule('presence.owners', OWNERS, '+U'), rule('presence.self', own, '+U'),
      rule('presence.others', '', '-U')] });
  }
  resources.push({ colIds: '*', rules: [rule('owners', OWNERS, '+CRUD'),
    ...(spec.editors ? [rule('editors', `user.Email and user.Email.lower() in rec.${EDITORS_COLUMN}`, '+U')] : []), rule('others', '', '-U')] });
  return resources;
}

// ---------- ce qui existe ----------

const sameSet = (a, b) => a.length === b.length && [...new Set(a.split(','))].sort().join(',') === [...new Set(b.split(','))].sort().join(',');

// Les règles qui sont sur la table `tableId`, avec la ressource qui les porte, dans l'ordre : { rule, colIds }.
function onTable(existing, tableId) {
  const byId = new Map(existing.resources.map(resource => [resource.id, resource]));
  return existing.rules.filter(rule => (byId.get(rule.resource) || {}).tableId === tableId).sort((a, b) => (Number(a.rulePos) || 0) - (Number(b.rulePos) || 0))
    .map(rule => ({ rule, colIds: String((byId.get(rule.resource) || {}).colIds || '*') }));
}

// Les règles de GFS sont-elles celles que le verrou veut (mêmes ressources, mêmes conditions, mêmes droits : la note, dans la langue de qui a posé, ne compte
// pas) ?
function sameRules(mine, wanted) {
  const flat = wanted.flatMap(resource => resource.rules.map(each => ({ colIds: resource.colIds, formula: each.formula, rights: each.rights })));
  return mine.length === flat.length && flat.every(each => mine.some(({ rule, colIds }) => sameSet(colIds, each.colIds) &&
    String(rule.aclFormula || '').trim() === each.formula && String(rule.permissionsText || '').trim() === each.rights));
}

// Les colonnes d'aide à poser ou à corriger : AddColumn pour celle qui manque, ModifyColumn pour celle dont la formule n'est plus la bonne.
function helperActions(existing, spec) {
  const table = existing.tables.find(row => row.tableId === spec.table);
  const here = table ? existing.columns.filter(column => column.parentId === table.id) : [];
  return spec.helpers.flatMap(wanted => {
    const found = here.find(column => column.colId === wanted.id);
    if (!found) return [['AddColumn', spec.table, wanted.id, { type: wanted.type, isFormula: true, formula: wanted.formula, label: wanted.id }]];
    return String(found.formula || '') === wanted.formula && found.isFormula !== false ? [] :
      [['ModifyColumn', spec.table, wanted.id, { isFormula: true, formula: wanted.formula }]];
  });
}

// Les actions qui posent `wanted` : une ressource par groupe de colonnes, les règles aux identifiants choisis (l'une après l'autre : contrats 11.5, point 2).
function writeActions(existing, table, wanted) {
  let resource = maxId(existing.resources);
  let id = maxId(existing.rules);
  return wanted.flatMap(group => {
    resource += 1;
    const resourceId = resource;
    return [['AddRecord', '_grist_ACLResources', resourceId, { tableId: table, colIds: group.colIds }],
      ...group.rules.map((each, at) => ['AddRecord', '_grist_ACLRules', (id += 1),
        { resource: resourceId, aclFormula: each.formula, permissionsText: each.rights,
        rulePos: at + 1, memo: each.memo }])];
  });
}

// Retirer les règles de GFS de ces lignes : les règles, puis les ressources qui n'en gardent plus aucune.
function removeActions(existing, mine) {
  if (!mine.length) return [];
  const gone = new Set(mine.map(({ rule }) => rule.id));
  const emptied = [...new Set(mine.map(({ rule }) => rule.resource))].filter(id => !existing.rules.some(rule => rule.resource === id && !gone.has(rule.id)));
  return [['BulkRemoveRecord', '_grist_ACLRules', [...gone]], ...(emptied.length ? [['BulkRemoveRecord', '_grist_ACLResources', emptied]] : [])];
}

// La règle par défaut que Grist crée avec tout document (« tout le monde peut tout », sans condition) : ce n'est pas une règle de la personne.
const isDefault = (rule, byId) => {
  const resource = byId.get(rule.resource);
  return (!resource || ((!resource.tableId || resource.tableId === '*') && (!resource.colIds || resource.colIds === '*'))) &&
    !String(rule.aclFormula || '').trim() &&
    (rule.permissionsText ? !String(rule.permissionsText).includes('-') : Number(rule.permissions) === 63);
};

// ---------- les plans ----------

// Poser le verrou, ou le mettre à jour : { ok: true, columns (les colonnes d'aide à poser avant : AddColumn, ModifyColumn), actions (la liasse des règles ;
// elle retire d'abord les règles de GFS d'avant quand elles diffèrent), resources (celles que l'aperçu montre), firstRule, replaces (des règles de GFS sont
// déjà là), closes (la structure se ferme avec : `structure: true` et pas déjà fermée) } ou { ok: false, reason } : 'already' (tout est posé), 'foreign' (une
// règle d'un autre auteur est sur cette table : GFS n'y touche pas), 'no-table', 'no-email', 'level', 'no-column' (voir `lockSpec`), 'no-helper' (les colonnes
// d'aide ne sont pas encore là : l'appelant les pose, relit, puis refait le plan ; `columns` dit lesquelles).
// `say(clé)` : la note de chaque règle.
export function planLock(existing, spec, say, { structure = false } = {}) {
  if (!spec.ok) return { ok: false, reason: spec.reason };
  if (!existing.tables.some(row => row.tableId === spec.table)) return { ok: false, reason: 'no-table' };
  const here = onTable(existing, spec.table);
  const mine = here.filter(({ rule }) => isLockNote(rule.memo));
  if (mine.length < here.length) return { ok: false, reason: 'foreign' };
  const wanted = lockResources(spec, say);
  const columns = helperActions(existing, spec);
  const same = sameRules(mine, wanted);
  if (same && !columns.length) return { ok: false, reason: 'already' };
  const byId = new Map(existing.resources.map(resource => [resource.id, resource]));
  const firstRule = existing.rules.every(rule => isDefault(rule, byId) || isLockNote(rule.memo));
  // Une colonne d'aide qui manque : les règles qui la nomment se posent après elle (Grist refuse une règle sur une colonne absente).
  if (columns.some(([kind]) => kind === 'AddColumn')) return { ok: false, reason: 'no-helper', columns, resources: wanted, firstRule };
  const base = { ok: true, columns, resources: wanted, replaces: mine.length > 0, firstRule };
  if (same) return { ...base, actions: [] };
  const removed = removeActions(existing, mine);
  const gone = new Set(mine.map(({ rule }) => rule.id));
  const left = { ...existing, rules: existing.rules.filter(rule => !gone.has(rule.id)) };
  const plan = { ...base, actions: [...removed, ...writeActions(left, spec.table, wanted)] };
  return structure ? withStructureClosed(existing, plan) : plan;
}

// Retirer le verrou : les règles de GFS de cette table, et les colonnes d'aide que GFS a posées. { ok: true, actions } ou { ok: false, reason: 'none' } (rien à
// retirer) ou 'foreign' (une règle d'un autre auteur : GFS ne la touche pas, il retire seulement les siennes quand il y en a).
export function planUnlock(existing, tableId) {
  const mine = onTable(existing, tableId).filter(({ rule }) => isLockNote(rule.memo));
  if (!mine.length) return { ok: false, reason: 'none' };
  const table = existing.tables.find(row => row.tableId === tableId);
  const here = table ? existing.columns.filter(column => column.parentId === table.id) : [];
  const columns = [EDITORS_COLUMN, NODE_COLUMN].filter(id => here.some(column => column.colId === id)).map(id => ['RemoveColumn', tableId, id]);
  return { ok: true, actions: [...removeActions(existing, mine), ...columns], rules: mine.length, columns: columns.length };
}

// L'état du verrou d'un annuaire pour la fenêtre : 'none' (aucune règle de GFS), 'current' (posées, et ce que le réglage veut), 'stale' (posées, mais le
// réglage a changé depuis), 'foreign' (une règle d'un autre auteur sur la table), ou '' quand le verrou ne se sait pas lire (la raison est celle du plan).
export function lockState(existing, spec, say) {
  if (!spec.ok) return spec.reason;
  const here = onTable(existing, spec.table);
  const mine = here.filter(({ rule }) => isLockNote(rule.memo));
  if (mine.length < here.length) return 'foreign';
  if (!mine.length) return 'none';
  const plan = planLock(existing, spec, say);
  return !plan.ok && plan.reason === 'already' ? 'current' : 'stale';
}

// Ce que le verrou lit du réglage enregistré (la table, l'adresse, les niveaux, qui modifie, la présence) : le verrou suit le réglage enregistré, jamais celui
// d'une fenêtre ouverte. Deux réglages qui donnent le même texte donnent les mêmes règles.
export function lockKey(config, table) {
  const edit = config.edit || {};
  return JSON.stringify([table, config.email, config.hierarchy, effectiveConfig(config).levels.map(level => level.path), edit.self === true, edit.level || '',
    edit.role || '',
    config.presence && config.presence.on ? config.presence.col : '']);
}
