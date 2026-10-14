// Le filtre du courtier : ce qu'une app peut lire et écrire, d'après la politique tirée de son manifeste (contrats 3.2 à 3.4).
// Du code sans effet de bord : il rend « permis » ou la raison du refus ; c'est le courtier qui répond à l'app et qui appelle Grist.

export const ERR = Object.freeze({
  REFUSE: 'GFS_REFUSE',
  ACCES: 'GFS_ACCES',
  LECTURE_SEULE: 'GFS_LECTURE_SEULE',
  CLE: 'GFS_CLE_NON_DECLAREE',
  INCONNU: 'GFS_INCONNU',
  INACTIF: 'GFS_INACTIF',
  ANNULE: 'GFS_ANNULE',
  QUOTA: 'GFS_QUOTA',
});

export class Refus extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const ROW_VERBS = new Set(['AddRecord', 'BulkAddRecord', 'UpdateRecord', 'BulkUpdateRecord', 'RemoveRecord',
  'BulkRemoveRecord', 'AddOrUpdateRecord', 'BulkAddOrUpdateRecord']);
const REMOVE_VERBS = new Set(['RemoveRecord', 'BulkRemoveRecord']);
const COLUMN_VERBS = new Set(['AddColumn', 'AddVisibleColumn', 'AddHiddenColumn', 'RemoveColumn', 'SetDisplayFormula']);
const TABLE_VERBS = new Set(['AddTable', 'RemoveTable', 'RenameTable']);
const STRUCTURE_VERBS = new Set(['CreateViewSection']);

// Tables internes qu'aucune app ne lit (3.2, point 4) ni n'écrit (3.3, point 6), quoi que le manifeste déclare.
const NEVER_READ = new Set(['_grist_shares', '_grist_triggers']);
const NEVER_WRITE = new Set(['_grist_aclrules', '_grist_aclresources', '_grist_aclprincipals', '_grist_aclmemberships',
  '_grist_shares', '_grist_triggers', '_grist_docinfo']);
const NEVER_WRITE_COLUMNS = { _grist_views_section: new Set(['options']) };

const LEVELS = ['none', 'read table', 'full'];
export const levelOf = access => Math.max(0, LEVELS.indexOf(access));
export const lowestAccess = (a, b) => LEVELS[Math.min(levelOf(a), levelOf(b))];

// Grist nettoie le nom qu'on lui donne : accents enlevés, tout caractère autre qu'une lettre, un chiffre ou « _ » remplacé par « _ », « _ » de tête
// retirés ; il ne distingue pas les capitales. On juge un nom de la même façon, avant l'appel (le contrôle de l'identifiant réel vient après).
export const norm = name => String(name ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+/, '').toLowerCase();
const isInternal = tableId => /^_grist_/i.test(String(tableId));

export function makePolicy(manifest, catalogue = []) {
  const perm = manifest.permissions || {};
  return {
    id: manifest.id,
    prefix: manifest.tables.prefixe,
    otherPrefixes: catalogue.filter(m => m.id !== manifest.id).map(m => m.tables.prefixe),
    acces: perm.acces || 'none',
    lit: perm.lit || [],
    ecrit: perm.ecrit || [],
    interne: indexInternal(perm.gristInterne || []),
    jeton: perm.jeton || null,
    formules: Boolean(perm.formules),
    structure: Boolean(perm.structure),
    reglages: new Set(manifest.reglages || []),
  };
}

function indexInternal(entries) {
  const index = new Map();
  for (const entry of entries) {
    for (const table of entry.tables || []) {
      index.set(norm(table), {
        lit: entry.lit === true,
        ecrit: Array.isArray(entry.ecrit) ? new Set(entry.ecrit) : null,
        retire: entry.retire === true,
      });
    }
  }
  return index;
}

// 'interne', 'gfs', 'propre' (préfixe de l'app), 'autre-app' (préfixe d'une autre app du catalogue) ou 'personne'.
export function classify(policy, tableId) {
  if (isInternal(tableId)) return 'interne';
  const n = norm(tableId);
  if (n.startsWith('gfs_')) return 'gfs';
  if (n.startsWith(norm(policy.prefix))) return 'propre';
  if (policy.otherPrefixes.some(prefix => n.startsWith(norm(prefix)))) return 'autre-app';
  return 'personne';
}

// Un motif est un nom, un préfixe suivi de « * » ou « * » seul ; « * » ne désigne que les tables de la personne (3.2, point 2).
function covers(patterns, tableId, cls) {
  const n = norm(tableId);
  return patterns.some(pattern => {
    if (pattern === '*') return cls === 'personne';
    if (pattern.endsWith('*')) return n.startsWith(norm(pattern.slice(0, -1)));
    return norm(pattern) === n;
  });
}

export function readRefusal(policy, tableId) {
  const cls = classify(policy, tableId);
  if (cls === 'interne') return internalReadRefusal(policy, tableId);
  if (cls === 'gfs') return `La table ${tableId} est réservée à GFS.`;
  if (cls === 'propre') return null;
  return covers(policy.lit, tableId, cls) ? null : `Lecture de ${tableId} non déclarée dans le manifeste (permissions.lit).`;
}

function internalReadRefusal(policy, tableId) {
  const key = norm(tableId);
  if (NEVER_READ.has('_' + key)) return `${tableId} ne se lit jamais.`;
  const entry = policy.interne.get(key);
  return entry && entry.lit ? null : `Lecture de ${tableId} non déclarée (permissions.gristInterne).`;
}

export function writeRefusal(policy, tableId) {
  const cls = classify(policy, tableId);
  if (cls === 'interne') return `${tableId} ne s'écrit que par ses colonnes déclarées (permissions.gristInterne).`;
  if (cls === 'gfs') return `La table ${tableId} est réservée à GFS.`;
  if (cls === 'autre-app') return `La table ${tableId} appartient à une autre app.`;
  if (cls === 'propre') return null;
  return covers(policy.ecrit, tableId, cls) ? null : `Écriture de ${tableId} non déclarée dans le manifeste (permissions.ecrit).`;
}

// Les tables que l'app peut lire, triées (3.2, point 5) : celles de la personne, les siennes, celles qu'un motif nomme.
export function visibleTables(policy, tableIds) {
  return tableIds.filter(id => id && !isInternal(id) && readRefusal(policy, id) === null).sort((a, b) => a.localeCompare(b));
}

const hasFormula = info => Boolean(info) && typeof info.formula === 'string' && info.formula.trim() !== '';

// Les clés des objets de valeurs d'un verbe de lignes (3.3, point 5).
function valueKeys(verb, args) {
  switch (verb) {
    case 'AddRecord': case 'BulkAddRecord': case 'UpdateRecord': case 'BulkUpdateRecord': return Object.keys(args[2] || {});
    case 'AddOrUpdateRecord': case 'BulkAddOrUpdateRecord': return [...Object.keys(args[1] || {}), ...Object.keys(args[2] || {})];
    default: return [];
  }
}

function internalWriteRefusal(policy, verb, tableId, args) {
  const key = norm(tableId);
  if (NEVER_WRITE.has('_' + key)) return `${tableId} n'est jamais écrite par une app.`;
  const entry = policy.interne.get(key);
  if (!entry || !entry.ecrit) return `Écriture de ${tableId} non déclarée (permissions.gristInterne).`;
  if (REMOVE_VERBS.has(verb)) return entry.retire ? null : `Retirer des lignes de ${tableId} n'est pas déclaré (retire).`;
  const blocked = NEVER_WRITE_COLUMNS['_' + key];
  for (const column of valueKeys(verb, args)) {
    if (blocked && blocked.has(column)) return `La colonne ${column} de ${tableId} n'est jamais écrite par une app.`;
    if (!entry.ecrit.has(column)) return `La colonne ${column} de ${tableId} n'est pas déclarée.`;
  }
  return null;
}

function rowsRefusal(policy, verb, args) {
  const tableId = args[0];
  return isInternal(tableId) ? internalWriteRefusal(policy, verb, tableId, args) : writeRefusal(policy, tableId);
}

function columnsRefusal(policy, verb, args) {
  const tableId = args[0];
  if (isInternal(tableId)) return `${verb} ne vise jamais une table interne.`;
  const refusal = writeRefusal(policy, tableId);
  if (refusal) return refusal;
  if (verb === 'SetDisplayFormula') return policy.formules ? null : 'Une formule demande la capacité « formules ».';
  const info = args[2];
  return !policy.formules && hasFormula(info) ? 'Une colonne à formule demande la capacité « formules ».' : null;
}

function tablesRefusal(policy, verb, args) {
  const names = verb === 'RenameTable' ? [args[0], args[1]] : [args[0]];
  for (const name of names) {
    if (/^_+grist_/i.test(String(name))) return `${verb} ne vise jamais une table interne.`;
    const refusal = writeRefusal(policy, name);
    if (refusal) return refusal;
  }
  if (verb === 'AddTable' && !policy.formules && (args[1] || []).some(hasFormula)) {
    return 'Une colonne à formule demande la capacité « formules ».';
  }
  return null;
}

function structureRefusal(policy, args, ctx) {
  if (!policy.structure) return 'Créer une section demande la capacité « structure ».';
  const [tableRef, , , groupBy, newName] = args;
  if (Array.isArray(groupBy) ? groupBy.length : groupBy) return 'Une section de synthèse est refusée en v0.';
  const tableId = tableRef === 0 ? newName : (ctx.tableRefs || new Map()).get(tableRef);
  if (!tableId) return 'La table de la section est introuvable.';
  return isInternal(tableId) ? 'Une section ne vise jamais une table interne.' : writeRefusal(policy, tableId);
}

const namesTable = value => typeof value === 'string' && value !== '';

function actionRefusal(policy, action, ctx) {
  if (!Array.isArray(action) || typeof action[0] !== 'string') return 'Action mal formée.';
  const [verb, ...args] = action;
  if (STRUCTURE_VERBS.has(verb)) return structureRefusal(policy, args, ctx);
  const known = ROW_VERBS.has(verb) || COLUMN_VERBS.has(verb) || TABLE_VERBS.has(verb);
  if (!known) return `Le verbe ${verb} n'est pas dans la liste fermée de GFS.`;
  if (!namesTable(args[0]) || (verb === 'RenameTable' && !namesTable(args[1]))) return `${verb} : le nom de la table manque.`;
  if (ROW_VERBS.has(verb)) return rowsRefusal(policy, verb, args);
  return COLUMN_VERBS.has(verb) ? columnsRefusal(policy, verb, args) : tablesRefusal(policy, verb, args);
}

// Un lot est permis en entier ou refusé en entier, avec le rang de l'action fautive (3.3, point 1).
export function checkBatch(policy, actions, ctx = {}) {
  if (!Array.isArray(actions)) return { ok: false, rank: 0, reason: 'Un lot d\'actions est une liste.' };
  for (let rank = 0; rank < actions.length; rank++) {
    const reason = actionRefusal(policy, actions[rank], ctx);
    if (reason) return { ok: false, rank, reason };
  }
  return { ok: true };
}

export const batchTouchesTables = actions => actions.some(a => Array.isArray(a) && TABLE_VERBS.has(a[0]) && a[0] !== 'RemoveTable');
export const batchCreatesSection = actions => actions.some(a => Array.isArray(a) && STRUCTURE_VERBS.has(a[0]));

// Du deuxième argument de applyUserActions, seuls desc et parseStrings passent (3.3, point 7).
export function cleanApplyOptions(options) {
  const out = {};
  if (options && typeof options === 'object') {
    if (typeof options.desc === 'string') out.desc = options.desc;
    if (typeof options.parseStrings === 'boolean') out.parseStrings = options.parseStrings;
  }
  return out;
}

// Le contrôle après coup d'un nom que Grist a normalisé (3.3, point 4) : un identifiant réel qui n'est pas permis à l'app.
export function realNameRefusal(policy, tableId) {
  const cls = classify(policy, tableId);
  if (cls === 'gfs' || cls === 'autre-app' || cls === 'interne') return `Grist a créé ${tableId}, qui n'est pas permis à cette app.`;
  return null;
}

// L'accès d'un jeton (3.4, point 1) : lecture seule sauf si l'app a déclaré le contraire.
export function tokenOptions(policy, options) {
  const readOnly = policy.jeton && policy.jeton.lectureSeule === false ? Boolean(options && options.readOnly) : true;
  return { readOnly, route: options && options.route };
}
