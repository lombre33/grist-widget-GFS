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

// Les tables de fichiers que le partage couvre : la clé d'une ligne est `<préfixe><identifiant>` (le même que `fileKey` de l'explorateur). `id` : la colonne de l'identifiant (null : le numéro de ligne de Grist,
// `colonnes.id: "id"` du manifeste) ; `author` : la colonne de l'auteur ; `stamped` : GFS pose lui-même cette colonne (une formule déclenchée sur `user`, écrite par Grist à la création, que l'app n'a pas à tenir) ;
// `open` : une condition sur la ligne (`rec`) des lignes qui ne sont pas des fichiers (`exclure` du manifeste, les réglages de l'app) et restent ouvertes comme avant.
export const FILES_TARGET = Object.freeze({ table: FILES_TABLE, prefix: 'gfs-fichiers:', id: 'Identifiant', author: 'Auteur', stamped: false, open: '' });
export const TARGETS = Object.freeze([FILES_TARGET]);
export const STAMP = 'GFS_Auteur';

// Les tables de fichiers que les manifestes des apps déclarent (`fichiers[]`) : une cible par table, d'après la forme de l'explorateur (js/explorer-model.js).
export function appTargets(manifests) {
  const out = [];
  for (const manifest of manifests || []) {
    for (const spec of (manifest && manifest.fichiers) || []) {
      if (!spec || !spec.table || !manifest.id) continue;
      const idColumn = spec.colonnes && spec.colonnes.id;
      const open = Object.entries(spec.exclure || {}).filter(([, values]) => Array.isArray(values) && values.length).map(([col, values]) => `rec.${col} in (${values.map(value => JSON.stringify(String(value))).join(', ')},)`).join(' or ');
      out.push(Object.freeze({ table: spec.table, prefix: `${manifest.id}:`, id: !idColumn || idColumn === 'id' ? null : idColumn, author: STAMP, stamped: true, open }));
    }
  }
  return out;
}
export const targetsOf = manifests => [FILES_TARGET, ...appTargets(manifests)];
const idOf = target => (target.id ? `$${target.id}` : '$id');
// La ligne d'un fichier d'après sa clé, dans une formule de la table de partages (le numéro de ligne se lit par `id`).
const findFile = target => (target.id
  ? `  found = ${target.table}.lookupOne(${target.id}=cible[${target.prefix.length}:])`
  : `  raw = cible[${target.prefix.length}:]\n  found = ${target.table}.lookupOne(id=int(raw)) if raw.isdigit() else None`);

const column = (id, type, extra = {}) => Object.freeze({ id, type, ...extra });
// `Auteur` et `AuteurAcces` : écrits par Grist à la création (formule déclenchée sur `user`), jamais choisis par la personne.
const stamped = (id, formula) => column(id, 'Text', { isFormula: false, formula, recalcWhen: 0, recalcDeps: null });
const formula = (id, type, body) => column(id, type, { isFormula: true, formula: body });

// La table de partages. `Valide1` : l'auteur est propriétaire. `AdminsBase` : l'auteur du fichier visé et les administrateurs que des propriétaires ont nommés, pour la cible. `Valide` : le partage vient d'un propriétaire
// ou d'un administrateur de la cible (deux niveaux : une formule ne peut pas dépendre d'elle-même). `AdminsCible` : ceux qui administrent la cible (les règles s'y fient).
export function shareColumns(targets = TARGETS) {
  const author = targets.map(target => `if cible.startswith("${target.prefix}"):\n${findFile(target)}\n  if found:\n    out.add(str(found.${target.author}).strip().lower())`).join('\n');
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

// Les groupes (contrats 11.7, point 13, lot 3) : `GFS_Groupes`, une ligne par groupe. Un groupe créé dans GFS garde ses adresses dans `PersonnesIci` (une par ligne) ; un groupe lu dans une table du document porte la table
// et les deux colonnes (`Source`, `SourceEmail`, `SourceGroupe`) et `Membres` les relit (formule : une règle de Grist ne lit pas une autre table, les colonnes d'aide de chaque fichier lisent `Membres`). Un partage cible un
// groupe par `#nom`. Les noms de table et de colonne sont des identifiants Grist, vérifiés avant d'entrer dans une formule.
export const GROUPS_TABLE = 'GFS_Groupes';
export const GROUP_PREFIX = '#';
export const isGroup = who => String(who ?? '').startsWith(GROUP_PREFIX);
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const isIdent = text => IDENT.test(String(text ?? ''));

// Les sources distinctes (table, colonne des adresses, colonne des groupes) que portent les lignes de groupes.
export function sourcesOf(rows) {
  const seen = new Map();
  for (const row of rows || []) {
    if (!row.Source || !isIdent(row.Source) || !isIdent(row.SourceEmail) || !isIdent(row.SourceGroupe)) continue;
    seen.set(`${row.Source}/${row.SourceEmail}/${row.SourceGroupe}`, { table: row.Source, email: row.SourceEmail, group: row.SourceGroupe });
  }
  return [...seen.values()];
}

const membersFormula = sources => [
  'out = set(m.strip().lower() for m in str($PersonnesIci or "").replace(",", "\\n").split("\\n") if m.strip())',
  ...sources.filter(source => isIdent(source.table) && isIdent(source.email) && isIdent(source.group)).map(source => `if $Source == "${source.table}":\n  for r in ${source.table}.lookupRecords(${source.group}=$Nom):\n    out.add(str(r.${source.email} or "").strip().lower())`),
  'out.discard("")', 'return tuple(sorted(out))'].join('\n');

export const groupColumns = (sources = []) => [
  column('Nom', 'Text'), formula('NomL', 'Text', 'str($Nom or "").strip().lower()'), column('PersonnesIci', 'Text'),
  column('Source', 'Text'), column('SourceEmail', 'Text'), column('SourceGroupe', 'Text'),
  formula('Membres', 'Any', membersFormula(sources)), formula('Nb', 'Int', 'len($Membres or ())'),
];

// Les règles de la table des groupes : les propriétaires font tout ; les éditeurs lisent le nom, la source et le nombre (pour proposer un groupe), jamais les adresses ; le reste est refusé.
export const GROUP_PUBLIC = 'Nom,NomL,Nb,Source';
export const groupRules = () => [rule('user.Access in [OWNER]', '+CRUD', 'les propriétaires tiennent les groupes'), rule('', '-CRUD', 'les adresses d’un groupe ne se lisent que des propriétaires')];
export const groupPublicRules = () => [rule('user.Access in [EDITOR]', '+R', 'un éditeur voit le nom d’un groupe et combien de personnes il compte')];

// Le plan d'un changement de sources : la formule de `Membres` relue avec `sources`.
export const planGroupSources = sources => ({ ok: true, actions: [['ModifyColumn', GROUPS_TABLE, 'Membres', { formula: membersFormula(sources) }]] });

// Les colonnes d'aide d'une table de fichiers : les adresses qui lisent, écrivent, administrent (l'auteur du fichier toujours), et les catégories entières (`editeurs`, `tous`) qui lisent ou écrivent.
export const HELPERS = Object.freeze(['GFS_Lecteurs', 'GFS_Ecrivains', 'GFS_Admins', 'GFS_Cats', 'GFS_CatsEcrit']);
export function helperColumns(target = FILES_TARGET) {
  const rows = `[p for p in list(${SHARES_TABLE}.lookupRecords(Cible="${target.prefix}" + str(${idOf(target)}))) + list(${SHARES_TABLE}.lookupRecords(Cible="*")) if p.Valide and p.Actif]`;
  const members = ranks => `[m for p in ${rows} if p.Droit in ${ranks} and not p.PersonneL.startswith("@") for m in (list(${GROUPS_TABLE}.lookupOne(NomL=p.PersonneL[1:]).Membres or ()) if p.PersonneL.startswith("#") else [p.PersonneL])]`;
  const people = ranks => `tuple(sorted(set([str($${target.author}).strip().lower()] + ${members(ranks)})))`;
  const cats = ranks => `tuple(sorted(set([p.PersonneL[1:] for p in ${rows} if p.Droit in ${ranks} and p.PersonneL.startswith("@")])))`;
  return [
    ...(target.stamped ? [stamped(STAMP, 'user.Email')] : []),
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
export function fileRules(target = FILES_TARGET) {
  const open = target.open ? [
    rule(target.open, '+R', 'les lignes de réglages de l’app restent lisibles'),
    rule(`user.Access in [EDITOR] and (${target.open})`, '+UD', 'et modifiables par les éditeurs, comme avant'),
  ] : [];
  return [
    rule('user.Access in [OWNER]', '+CRUD', 'les propriétaires gardent la main'),
    ...open,
    rule(inList('GFS_Admins'), '+CRUD', 'l’auteur et les administrateurs du fichier gèrent son partage'),
    rule(`${inList('GFS_Ecrivains')} or (user.Access in [EDITOR] and rec.GFS_CatsEcrit and "editeurs" in rec.GFS_CatsEcrit)`, '+RU', 'ceux qui ont l’écriture modifient le fichier'),
    rule(`${inList('GFS_Lecteurs')} or (rec.GFS_Cats and (("editeurs" in rec.GFS_Cats and user.Access in [EDITOR]) or ("tous" in rec.GFS_Cats and user.Access in [EDITOR, VIEWER])))`, '+R', 'ceux à qui le fichier est partagé le lisent'),
    rule(`user.Access in [EDITOR] and user.Email and newRec.${target.author} and newRec.${target.author}.lower() == user.Email.lower()`, '+C', 'chacun ajoute des fichiers à son nom'),
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
export const stampRules = (memo = 'l’auteur d’un partage est écrit par Grist, personne ne le change') => [rule('user.Access not in [OWNER]', '-U', memo)];

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

// Activer le partage : crée `GFS_Partages` (et `GFS_Fichiers`, `GFS_Rangement` s'ils manquent), ajoute les colonnes d'aide aux tables de fichiers (celles que GFS garde et celles des apps : `GFS_Auteur`, que Grist écrit à la
// création, en plus pour les apps), pose les règles. Rejoué quand une app a été ajoutée depuis (ou après un retrait), il ne complète que ce qui manque. `existing` : { resources, rules, tables, columns, targets,
// files: { table: [identifiants] } } ; `targets` : les tables de fichiers (`targetsOf`, js/sharing-model.js), celles des apps seulement si elles sont dans le document.
// Rend { ok: true, actions, firstRule, creates: [tables créées], adds: [colonnes ajoutées], legacy: nombre de fichiers déjà là, laissés lisibles de tous, appTables, skipped, extends } ou { ok: false, reason } : 'already'
// (tout est posé), 'foreign' (une règle d'un autre auteur sur une table de GFS). Une table d'app qui porte déjà une règle d'un autre auteur est laissée (`skipped`) : ce qu'elle protège est à elle.
export function planSharing(existing, filesColumns, targets = existing.targets || TARGETS) {
  const hasTable = name => existing.tables.some(row => row.tableId === name);
  const columnsOf = table => new Set(existing.columns.filter(col => col.parentId === (existing.tables.find(row => row.tableId === table) || {}).id).map(col => col.colId));
  const isFiles = target => target.table === FILES_TABLE;
  const mine = table => onTable(existing, table).filter(item => isSharingNote(item.memo));
  const foreign = table => onTable(existing, table).some(item => !isSharingNote(item.memo));
  const shared = hasTable(SHARES_TABLE);
  if (!shared && [SHARES_TABLE, FILES_TABLE].some(foreign)) return { ok: false, reason: 'foreign' };
  const skipped = targets.filter(target => !isFiles(target) && hasTable(target.table) && foreign(target.table)).map(target => target.table);
  const here = targets.filter(target => (isFiles(target) ? (!shared || hasTable(target.table)) : hasTable(target.table)) && !skipped.includes(target.table));
  const covered = target => hasTable(target.table) && mine(target.table).length > 0 && helperColumns(target).every(helper => columnsOf(target.table).has(helper.id));
  const todo = here.filter(target => !covered(target));
  const sharesRules = shared && mine(SHARES_TABLE).length > 0;
  const hasGroups = hasTable(GROUPS_TABLE);
  const groupsRules = hasGroups && mine(GROUPS_TABLE).length > 0;
  if (shared && !todo.length && sharesRules && hasGroups && groupsRules) return { ok: false, reason: 'already' };
  const actions = []; const creates = []; const adds = [];
  if (!shared) { actions.push(['AddTable', SHARES_TABLE, shareColumns(here)]); creates.push(SHARES_TABLE); }
  else if (todo.length) actions.push(['ModifyColumn', SHARES_TABLE, 'AdminsBase', { formula: shareColumns(here).find(item => item.id === 'AdminsBase').formula }]);
  // Une fois le partage actif, un éditeur n'ajoute un fichier qu'à son nom : GFS doit connaître son adresse, qu'il ne lit que par la sonde de `GFS_Rangement` (js/rangement.js). Sans cette table, son PDF serait
  // refusé (mesuré, labo/run-partager-fenetre.mjs) : le partage la crée avec le reste, et la question le dit.
  if (!hasTable(FILING_TABLE)) { actions.unshift(['AddTable', FILING_TABLE, FILING_COLUMNS.map(column => ({ ...column }))]); creates.push(FILING_TABLE); }
  for (const target of todo) {
    if (!hasTable(target.table)) { actions.unshift(['AddTable', target.table, [...filesColumns, ...helperColumns(target)]]); creates.push(target.table); continue; }
    const have = columnsOf(target.table);
    for (const helper of helperColumns(target)) if (!have.has(helper.id)) { actions.push(['AddColumn', target.table, helper.id, { ...helper, id: undefined }]); adds.push(`${target.table}.${helper.id}`); }
  }
  // Les groupes (un partage cible `#nom`) : la table naît avec le partage, avant les colonnes d'aide qui la lisent ; un partage activé avant les groupes voit ses colonnes d'aide relues (même formule, qui lit les groupes).
  if (!hasGroups) {
    actions.unshift(['AddTable', GROUPS_TABLE, groupColumns()]); creates.push(GROUPS_TABLE);
    if (shared) for (const target of here.filter(item => !todo.includes(item) && covered(item))) for (const helper of helperColumns(target)) if (helper.isFormula) actions.push(['ModifyColumn', target.table, helper.id, { formula: helper.formula }]);
  }
  // Les fichiers déjà rangés restent lisibles de tous ceux qui ont accès au document, comme avant l'activation (contrats 11.7, point 12) : un partage « tout le document » par fichier ; les nouveaux fichiers
  // ne sont lus que de leur auteur.
  const legacyOf = target => ((existing.files && existing.files[target.table]) || (isFiles(target) ? existing.fileIds : null) || []).map(String).map(one => `${target.prefix}${one}`);
  const legacy = todo.flatMap(legacyOf);
  if (legacy.length) actions.push(['BulkAddRecord', SHARES_TABLE, legacy.map(() => null), { Cible: legacy, Personne: legacy.map(() => CATEGORIES.tous), Droit: legacy.map(() => 'lecture'), Telecharger: legacy.map(() => true) }]);
  const map = byResource(existing);
  const groups = [
    ...(sharesRules ? [] : [{ tableId: SHARES_TABLE, colIds: 'Auteur,AuteurAcces', rules: stampRules() }, { tableId: SHARES_TABLE, colIds: '*', rules: shareRules() }]),
    ...(groupsRules ? [] : [{ tableId: GROUPS_TABLE, colIds: GROUP_PUBLIC, rules: groupPublicRules() }, { tableId: GROUPS_TABLE, colIds: '*', rules: groupRules() }]),
    ...todo.flatMap(target => [...(target.stamped ? [{ tableId: target.table, colIds: STAMP, rules: stampRules('l’auteur d’un fichier est écrit par Grist, personne ne le change') }] : []), { tableId: target.table, colIds: '*', rules: fileRules(target) }]),
  ];
  const appTables = todo.filter(target => !isFiles(target)).map(target => target.table);
  return { ok: true, actions: [...actions, ...rulesActions(existing, groups)], firstRule: existing.rules.every(item => isBuiltIn(item, map)), creates, adds, legacy: legacy.length, appTables, skipped, extends: shared };
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
  if (right === 'admin' && (cleaned.startsWith('@') || isGroup(cleaned))) return null; // l'administration est celle d'une personne
  return { Cible: target, Personne: cleaned, Droit: right, Telecharger: Boolean(download), Fin: end ?? null };
}

// Ce que dit la table de partages d'une cible, pour la fenêtre : les lignes qui la visent (la racine `*` comprise, marquée héritée), triées, avec leur validité.
export function sharesOf(rows, target) {
  return rows.filter(row => row.Cible === target || row.Cible === ROOT).map(row => ({
    id: row.id, who: String(row.Personne || ''), right: row.Droit, download: Boolean(row.Telecharger), end: row.Fin || null, inherited: row.Cible === ROOT, valid: row.Valide !== false, active: row.Actif !== false, author: String(row.Auteur || ''),
  })).sort((a, b) => Number(a.inherited) - Number(b.inherited) || a.who.localeCompare(b.who));
}

// Un nom de groupe se tape dans la fenêtre : sans `@` ni `#` au début, ni retour à la ligne, 60 signes au plus. Rend le nom propre ou null.
export function groupName(text) {
  const name = String(text ?? '').replace(/\s+/g, ' ').trim();
  return name && name.length <= 60 && !/^[@#]/.test(name) ? name : null;
}

// Les groupes pour la fenêtre : { id, name, count, source (la table lue, ou ''), here (les adresses tapées dans GFS) }, triés par nom. Un éditeur ne lit que le nom, le nombre et la source.
export const groupsOf = rows => (rows || []).map(row => ({ id: row.id, name: String(row.Nom || ''), count: Number(row.Nb) || 0, source: String(row.Source || ''), here: String(row.PersonnesIci || '') }))
  .filter(group => group.name).sort((a, b) => a.name.localeCompare(b.name));

// La ligne d'un groupe : tapé dans GFS (`people` : les adresses) ou lu d'une table (`source` : { table, email, group }, identifiants Grist vérifiés). Null si le nom ou un identifiant ne vaut rien.
export function groupRecord({ name, people = '', source = null }) {
  const clean = groupName(name);
  if (!clean) return null;
  if (!source) return { Nom: clean, PersonnesIci: String(people || '').trim(), Source: '', SourceEmail: '', SourceGroupe: '' };
  if (![source.table, source.email, source.group].every(isIdent)) return null;
  return { Nom: clean, PersonnesIci: '', Source: source.table, SourceEmail: source.email, SourceGroupe: source.group };
}

// L'ajout d'un groupe lu d'une table : la formule de `Membres` relue avec toutes les sources (celles d'avant et la nouvelle), puis la ligne.
export function planGroupAdd(rows, record) {
  if (!record) return { ok: false, reason: 'invalid' };
  if ((rows || []).some(row => String(row.Nom || '').trim().toLowerCase() === record.Nom.toLowerCase())) return { ok: false, reason: 'exists' };
  const actions = [];
  if (record.Source) actions.push(...planGroupSources(sourcesOf([...(rows || []), record])).actions);
  actions.push(['AddRecord', GROUPS_TABLE, null, record]);
  return { ok: true, actions };
}

// Lire les groupes d'une table du document : un groupe par valeur distincte de la colonne des groupes (`names`), les noms pris ou douteux laissés. Rend { ok, actions, added, skipped } ou { ok: false, reason }.
export function planGroupsRead(rows, source, names) {
  if (!source || ![source.table, source.email, source.group].every(isIdent)) return { ok: false, reason: 'invalid' };
  const taken = new Set((rows || []).map(row => String(row.Nom || '').trim().toLowerCase()));
  const fresh = [];
  for (const name of [...new Set((names || []).map(groupName).filter(Boolean))]) {
    if (taken.has(name.toLowerCase())) continue;
    taken.add(name.toLowerCase());
    fresh.push(groupRecord({ name, source }));
  }
  const skipped = new Set((names || []).map(item => String(item ?? '').trim()).filter(Boolean)).size - fresh.length;
  if (!fresh.length) return { ok: false, reason: 'none', skipped };
  return { ok: true, added: fresh.length, skipped, actions: [...planGroupSources(sourcesOf([...(rows || []), ...fresh])).actions, ['BulkAddRecord', GROUPS_TABLE, fresh.map(() => null), Object.fromEntries(Object.keys(fresh[0]).map(key => [key, fresh.map(record => record[key])]))]] };
}
