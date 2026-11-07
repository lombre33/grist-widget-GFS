// Partager un fichier (contrats 11.7, point 13 ; maquettes du 06/11) : le modèle de données et les règles, en code pur. Une table `GFS_Partages` dit qui a quel droit sur quelle cible (un fichier : sa clé
// d'explorateur, `app:identifiant` ; `*` : tout le document) ; des colonnes-formules d'aide, sur chaque table de fichiers, en tirent les listes que lisent les règles (une règle ne lit que `rec` et `newRec` :
// faits vérifiés, 46 et 55). Ce module ne touche pas à Grist : il rend les actions à envoyer en UNE `applyUserActions` et les lignes à écrire.
//
// Le premier lot couvre les fichiers que GFS garde (`GFS_Fichiers`, les PDF : une table de GFS, sans app) : « lecture » et « écriture » et « administration ». « Commentaires » (ceux des apps) et « dépôt seul »
// attendent leurs tables ; « peut télécharger » est un confort de GFS (le bouton), jamais une protection : qui lit la pièce jointe peut la copier (contrats 11.1, point 8).

import { FILES_TABLE } from './gfs-files.js';
import { TABLE as FILING_TABLE, COLUMNS as FILING_COLUMNS } from './rangement.js';

export const SHARES_TABLE = 'GFS_Partages';
export const ROOT = '*';
export const RIGHTS = Object.freeze(['lecture', 'ecriture', 'admin']);
export const CATEGORIES = Object.freeze({ editeurs: '@editeurs', tous: '@tous' });
const NOTE = 'GFS : Partages · ';
const NOTE_ANY = /^\s*GFS\s*:\s*Partages\b/i;
export const isSharingNote = memo => NOTE_ANY.test(String(memo ?? ''));

// Les tables de fichiers que le partage couvre : la clé d'une ligne est `<préfixe><identifiant>` (le même que `fileKey` de l'explorateur).
export const TARGETS = Object.freeze([Object.freeze({ table: FILES_TABLE, prefix: 'gfs-fichiers:', id: 'Identifiant', author: 'Auteur' })]);

const column = (id, type, extra = {}) => Object.freeze({ id, type, ...extra });
// `Auteur` et `AuteurAcces` : écrits par Grist à la création (formule déclenchée sur `user`), jamais choisis par la personne.
const stamped = (id, formula) => column(id, 'Text', { isFormula: false, formula, recalcWhen: 0, recalcDeps: null });
const formula = (id, type, body) => column(id, type, { isFormula: true, formula: body });

// La table de partages. `Valide1` : l'auteur est propriétaire. `AdminsBase` : l'auteur du fichier visé et les administrateurs que des propriétaires ont nommés, pour la cible. `Valide` : le partage vient d'un propriétaire
// ou d'un administrateur de la cible (deux niveaux : une formule ne peut pas dépendre d'elle-même). `AdminsCible` : ceux qui administrent la cible (les règles s'y fient).
export function shareColumns(targets = TARGETS) {
  const author = targets.map(target => `if cible.startswith("${target.prefix}"):\n  found = ${target.table}.lookupOne(${target.id}=cible[${target.prefix.length}:])\n  if found:\n    out.add(str(found.${target.author}).strip().lower())`).join('\n');
  return [
    column('Cible', 'Text'), column('Personne', 'Text'), column('Droit', 'Text'), column('Telecharger', 'Bool'), column('Fin', 'Date'),
    stamped('Auteur', 'user.Email'), stamped('AuteurAcces', 'str(user.Access)'),
    formula('PersonneL', 'Text', 'str($Personne or "").strip().lower()'),
    formula('Actif', 'Bool', 'not $Fin or $Fin >= TODAY()'),
    formula('Valide1', 'Bool', 'str($AuteurAcces).lower() in ("owners", "owner")'),
    formula('AdminsBase', 'Any', [
      'cible = str($Cible)', 'out = set()',
      author,
      'for p in Partages.lookupRecords(Droit="admin"):',
      '  if p.Valide1 and p.Actif and p.Cible in (cible, "*"):',
      '    out.add(p.PersonneL)',
      'return tuple(sorted(out))'].filter(Boolean).join('\n').replace(/Partages\./g, `${SHARES_TABLE}.`)),
    formula('Valide', 'Bool', '$Valide1 or str($Auteur).strip().lower() in $AdminsBase'),
    formula('AdminsCible', 'Any', [
      'out = set($AdminsBase)',
      `for p in ${SHARES_TABLE}.lookupRecords(Droit="admin"):`,
      '  if p.Valide and p.Actif and p.Cible in (str($Cible), "*"):',
      '    out.add(p.PersonneL)',
      'return tuple(sorted(out))'].join('\n')),
  ];
}

// Les colonnes d'aide d'une table de fichiers : les adresses qui lisent, écrivent, administrent (l'auteur du fichier toujours), et les catégories entières (`editeurs`, `tous`) qui lisent ou écrivent.
export const HELPERS = Object.freeze(['GFS_Lecteurs', 'GFS_Ecrivains', 'GFS_Admins', 'GFS_Cats', 'GFS_CatsEcrit']);
export function helperColumns(target) {
  const rows = `[p for p in list(${SHARES_TABLE}.lookupRecords(Cible="${target.prefix}" + str($${target.id}))) + list(${SHARES_TABLE}.lookupRecords(Cible="*")) if p.Valide and p.Actif]`;
  const people = ranks => `tuple(sorted(set([str($${target.author}).strip().lower()] + [p.PersonneL for p in ${rows} if p.Droit in ${ranks} and not p.PersonneL.startswith("@")])))`;
  const cats = ranks => `tuple(sorted(set([p.PersonneL[1:] for p in ${rows} if p.Droit in ${ranks} and p.PersonneL.startswith("@")])))`;
  return [
    formula('GFS_Lecteurs', 'Any', people('("lecture", "ecriture", "admin")')),
    formula('GFS_Ecrivains', 'Any', people('("ecriture", "admin")')),
    formula('GFS_Admins', 'Any', people('("admin",)')),
    formula('GFS_Cats', 'Any', cats('("lecture", "ecriture", "admin")')),
    formula('GFS_CatsEcrit', 'Any', cats('("ecriture", "admin")')),
  ];
}

const me = 'user.Email and user.Email.lower()';
const inList = name => `user.Email and rec.${name} and user.Email.lower() in rec.${name}`;
const ownShare = 'user.Email and rec.Auteur and rec.Auteur.lower() == user.Email.lower()';
const rule = (formulaText, rights, memo, extra = {}) => ({ formula: formulaText, rights, memo: `${NOTE}${memo}`, ...extra });

// Les règles d'une table de fichiers : les propriétaires, les administrateurs, qui écrit, qui lit (par adresse ou par catégorie), la création à son nom, le reste refusé.
export function fileRules() {
  return [
    rule('user.Access in [OWNER]', '+CRUD', 'les propriétaires gardent la main'),
    rule(inList('GFS_Admins'), '+CRUD', 'l’auteur et les administrateurs du fichier gèrent son partage'),
    rule(`${inList('GFS_Ecrivains')} or (user.Access in [EDITOR] and rec.GFS_CatsEcrit and "editeurs" in rec.GFS_CatsEcrit)`, '+RU', 'ceux qui ont l’écriture modifient le fichier'),
    rule(`${inList('GFS_Lecteurs')} or (rec.GFS_Cats and (("editeurs" in rec.GFS_Cats and user.Access in [EDITOR]) or ("tous" in rec.GFS_Cats and user.Access in [EDITOR, VIEWER])))`, '+R', 'ceux à qui le fichier est partagé le lisent'),
    rule('user.Access in [EDITOR] and user.Email and newRec.Auteur and newRec.Auteur.lower() == user.Email.lower()', '+C', 'chacun ajoute des fichiers à son nom'),
    rule('', '-CRUD', 'le fichier d’une autre personne n’est pas à vous'),
  ];
}

// Les règles de la table de partages (sur la table entière), et celles qui gardent l'auteur écrit par Grist (sur ses deux colonnes seules : passent avant).
export function shareRules() {
  return [
    rule('user.Access in [OWNER]', '+CRUD', 'les propriétaires gardent la main'),
    rule(inList('AdminsCible'), '+RUD', 'les administrateurs d’un fichier gèrent ses partages'),
    rule(ownShare, '+RUD', 'chacun gère les partages qu’il a ajoutés'),
    rule('(user.Email and rec.PersonneL == user.Email.lower()) or (rec.PersonneL == "@tous" and user.Access in [EDITOR, VIEWER]) or (rec.PersonneL == "@editeurs" and user.Access in [EDITOR])', '+R', 'chacun lit les partages qui le concernent, catégories comprises'),
    // Mesuré (faits 55) : une colonne à formule déclenchée garde la valeur qu'on lui donne à la création, et `newRec` porte, à la création, celle que Grist écrit ou celle qu'on a donnée : la règle exige
    // que l'auteur et son rôle soient ceux de la personne.
    rule('user.Access in [EDITOR] and user.Email and newRec.Auteur and newRec.Auteur.lower() == user.Email.lower() and newRec.AuteurAcces == user.Access', '+C', 'tout éditeur peut ajouter une ligne, à son nom : elle ne vaut que si elle est valide'),
    rule('', '-CRUD', 'le reste est refusé'),
  ];
}
export const stampRules = () => [rule('user.Access not in [OWNER]', '-U', 'l’auteur d’un partage est écrit par Grist, personne ne le change')];

const maxId = rows => rows.reduce((top, row) => Math.max(top, Number(row.id) || 0), 0);
const byResource = existing => new Map(existing.resources.map(resource => [resource.id, resource]));
const onTable = (existing, tableId) => { const map = byResource(existing); return existing.rules.filter(item => (map.get(item.resource) || {}).tableId === tableId); };

// Les ressources et règles à écrire : une ressource par table (et une pour les colonnes écrites par Grist), les règles aux identifiants choisis, dans l'ordre (rulePos).
function rulesActions(existing, groups) {
  let resource = maxId(existing.resources);
  let id = maxId(existing.rules);
  const actions = [];
  for (const { tableId, colIds, rules } of groups) {
    resource += 1;
    actions.push(['AddRecord', '_grist_ACLResources', resource, { tableId, colIds }]);
    rules.forEach((one, at) => actions.push(['AddRecord', '_grist_ACLRules', (id += 1), { resource, aclFormula: one.formula, permissionsText: one.rights, rulePos: at + 1, memo: one.memo }]));
  }
  return actions;
}

const isBuiltIn = (item, map) => { const res = map.get(item.resource); return (!res || ((!res.tableId || res.tableId === '*') && (!res.colIds || res.colIds === '*'))) && !String(item.aclFormula || '').trim() && (item.permissionsText ? !String(item.permissionsText).includes('-') : Number(item.permissions) === 63); };

// Activer le partage : crée `GFS_Partages` (et `GFS_Fichiers` s'il manque, avec ses colonnes), ajoute les colonnes d'aide aux tables de fichiers, pose les règles. `existing` : { resources, rules, tables, columns }.
// Rend { ok: true, actions, firstRule, creates: [tables créées], adds: [colonnes ajoutées], legacy: nombre de fichiers déjà là, laissés lisibles de tous } ou { ok: false, reason } : 'already' (la table de partages est là), 'foreign' (une règle d'un autre auteur sur ces tables).
export function planSharing(existing, filesColumns) {
  const hasTable = name => existing.tables.some(row => row.tableId === name);
  if (hasTable(SHARES_TABLE)) return { ok: false, reason: 'already' };
  const tables = [SHARES_TABLE, ...TARGETS.map(target => target.table)];
  if (tables.some(name => onTable(existing, name).some(item => !isSharingNote(item.memo)))) return { ok: false, reason: 'foreign' };
  const actions = []; const creates = [SHARES_TABLE]; const adds = [];
  actions.push(['AddTable', SHARES_TABLE, shareColumns()]);
  // Une fois le partage actif, un éditeur n'ajoute un fichier qu'à son nom : GFS doit connaître son adresse, qu'il ne lit que par la sonde de `GFS_Rangement` (js/rangement.js). Sans cette table, son PDF serait
  // refusé (mesuré, labo/run-partager-fenetre.mjs) : le partage la crée avec le reste, et la question le dit.
  if (!hasTable(FILING_TABLE)) { actions.unshift(['AddTable', FILING_TABLE, FILING_COLUMNS.map(column => ({ ...column }))]); creates.push(FILING_TABLE); }
  for (const target of TARGETS) {
    if (!hasTable(target.table)) { actions.unshift(['AddTable', target.table, [...filesColumns, ...helperColumns(target)]]); creates.push(target.table); continue; }
    const table = existing.tables.find(row => row.tableId === target.table);
    const have = new Set(existing.columns.filter(col => col.parentId === table.id).map(col => col.colId));
    for (const helper of helperColumns(target)) if (!have.has(helper.id)) { actions.push(['AddColumn', target.table, helper.id, { ...helper, id: undefined }]); adds.push(`${target.table}.${helper.id}`); }
  }
  // Les fichiers déjà rangés restent lisibles de tous ceux qui ont accès au document, comme avant l'activation (contrats 11.7, point 12) : un partage « tout le document » par fichier ; les nouveaux fichiers
  // ne sont lus que de leur auteur.
  const legacy = (existing.fileIds || []).map(String);
  if (legacy.length) actions.push(['BulkAddRecord', SHARES_TABLE, legacy.map(() => null), { Cible: legacy.map(one => `${TARGETS[0].prefix}${one}`), Personne: legacy.map(() => CATEGORIES.tous), Droit: legacy.map(() => 'lecture'), Telecharger: legacy.map(() => true) }]);
  const map = byResource(existing);
  const groups = [
    { tableId: SHARES_TABLE, colIds: 'Auteur,AuteurAcces', rules: stampRules() }, { tableId: SHARES_TABLE, colIds: '*', rules: shareRules() },
    ...TARGETS.map(target => ({ tableId: target.table, colIds: '*', rules: fileRules() })),
  ];
  return { ok: true, actions: [...actions, ...rulesActions(existing, groups)], firstRule: existing.rules.every(item => isBuiltIn(item, map)), creates, adds, legacy: legacy.length };
}

// Retirer le partage : les règles de GFS (note « GFS : Partages ») et leurs ressources. Les tables et les colonnes d'aide restent (rien d'une donnée ne s'efface) ; plus aucune règle ne les lit.
export function planUnsharing(existing) {
  const mine = existing.rules.filter(item => isSharingNote(item.memo));
  if (!mine.length) return { ok: false, reason: 'none' };
  const dropped = new Set(mine.map(item => item.id));
  const emptied = [...new Set(mine.map(item => item.resource))].filter(id => !existing.rules.some(item => item.resource === id && !dropped.has(item.id)));
  return { ok: true, actions: [['BulkRemoveRecord', '_grist_ACLRules', [...dropped]], ...(emptied.length ? [['BulkRemoveRecord', '_grist_ACLResources', emptied]] : [])] };
}

export const sharingActive = tables => tables.some(row => row.tableId === SHARES_TABLE);

// La ligne d'un partage à écrire : le droit, la personne (adresse ou catégorie), la fin d'accès éventuelle (secondes, 'Date' de Grist). L'auteur est écrit par Grist.
export function shareRecord({ target, who, right, download = false, end = null }) {
  const cleaned = String(who ?? '').trim();
  if (!target || !cleaned || !RIGHTS.includes(right)) return null;
  return { Cible: target, Personne: cleaned, Droit: right, Telecharger: Boolean(download), Fin: end ?? null };
}

// Ce que dit la table de partages d'une cible, pour la fenêtre : les lignes qui la visent (la racine `*` comprise, marquée héritée), triées, avec leur validité.
export function sharesOf(rows, target) {
  return rows.filter(row => row.Cible === target || row.Cible === ROOT).map(row => ({
    id: row.id, who: String(row.Personne || ''), right: row.Droit, download: Boolean(row.Telecharger), end: row.Fin || null, inherited: row.Cible === ROOT, valid: row.Valide !== false, active: row.Actif !== false, author: String(row.Auteur || ''),
  })).sort((a, b) => Number(a.inherited) - Number(b.inherited) || a.who.localeCompare(b.who));
}
