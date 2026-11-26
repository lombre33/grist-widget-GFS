// Le modèle de « Partager » (js/sharing/sharing-model.js ; contrats 11.7, point 13) : la table de partages, les colonnes d'aide, les règles, le plan d'activation et de retrait, la ligne d'un partage.
// Ce que Grist en fait (l'auteur écrit par lui, les règles lisant les colonnes-formules, un administrateur qui partage sans propriétaire) se mesure dans un vrai Grist : labo/run-partager.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noticeTableRules, noticeColumnGroups, planSharing, planUnsharing, shareColumns, helperColumns, fileRules, shareRules, stampRules, shareRecord, sharesOf, isSharingNote, sharingActive, defaultTargets, SHARES_TABLE, HELPERS, targetsOf, appTargets } from '../js/sharing/sharing-model.js';
import { filesColumns } from '../js/files/gfs-files.js';
import { BUILT_IN, base, withFiles, applied } from './sharing-fixtures.mjs';
import { levelOfNote } from '../js/rights/rights.js';


test('les colonnes de la table de partages : l\'auteur et son rôle sont écrits par Grist (formule déclenchée à la création, jamais ensuite)', () => {
  const columns = shareColumns();
  for (const id of ['Author', 'AuthorAccess']) {
    const found = columns.find(column => column.id === id);
    assert.equal(found.isFormula, false);
    assert.equal(found.recalcWhen, 0);
    assert.equal(found.recalcDeps, null);
  }
  assert.equal(columns.find(column => column.id === 'Author').formula, 'user.Email');
  for (const id of ['PersonL', 'Active', 'AuthorOwner', 'AdminsBase', 'Valid', 'AdminsTarget']) assert.equal(columns.find(column => column.id === id).isFormula, true, id);
});

test('les formules sont du Python valide : aucune ligne de tête n\'est indentée (l\'indentation d\'un seul bloc cassait `Valid` : mesuré)', () => {
  const columns = [...shareColumns(), ...defaultTargets().flatMap(target => helperColumns(target))].filter(column => column.isFormula);
  for (const column of columns) {
    const lines = column.formula.split('\n');
    assert.ok(!/^\s/.test(lines[0]), `${column.id} : première ligne indentée`);
    let depth = 0;
    for (const line of lines) {
      const indent = line.length - line.trimStart().length;
      assert.ok(indent <= depth, `${column.id} : « ${line} » est indentée sans bloc ouvert`);
      depth = line.trimEnd().endsWith(':') ? indent + 2 : indent;
    }
  }
});

test('les colonnes d\'aide d\'une table de fichiers : un calcul et sept listes, du nom que lisent les règles ; l\'auteur du fichier est toujours administrateur', () => {
  const columns = helperColumns(defaultTargets()[0]);
  assert.deepEqual(columns.map(column => column.id), ['GFS_Author', ...HELPERS]);
  assert.equal(columns[0].formula, 'user.Email', 'l\'auteur d\'un PDF est écrit par Grist à la création, comme pour les fichiers des apps');
  const calc = columns.find(column => column.id === 'GFS_Calc').formula;
  assert.match(calc, /key = "gfs-fichiers:" \+ str\(\$FileId\)/);
  assert.match(calc, /str\(\$GFS_Author\)\.strip\(\)\.lower\(\)/);
  assert.doesNotMatch(calc, /\$Author\b/, '« Author » n\'est que le dernier qui a modifié : il ne donne aucun droit');
  assert.match(calc, /best\[author\] = \(999, 9, 3, ""\)/);
  assert.match(calc, /GFS_Placement\.lookupOne\(Target=key\)/);
  const parts = columns.filter(column => !['GFS_Calc', 'GFS_Author', 'GFS_Folder', 'GFS_Ids', 'GFS_Seen'].includes(column.id)).map(column => [column.id, column.formula.match(/\[(\d)\]\)$/)[1]]);
  assert.deepEqual(parts, [['GFS_Readers', '0'], ['GFS_Writers', '1'], ['GFS_Admins', '2'], ['GFS_Denied', '3'], ['GFS_Cats', '4'], ['GFS_CatsWrite', '5'], ['GFS_Direct', '6']]);
  assert.match(calc, /directs = sorted\(who \+ ">" \+ v\[3\]/);
  assert.match(calc, /put\(best, p\.PersonL, lvl, 2, rank, str\(p\.Author/);
  for (const line of calc.split('\n')) assert.equal(line.split('"').length % 2, 1, `guillemets non fermés : ${line}`);
});

test('les règles d\'une table de fichiers : propriétaires d\'abord, création à son nom, le reste refusé en dernier ; chacune a sa note « GFS : Partages »', () => {
  const rules = fileRules();
  assert.equal(rules[0].formula, 'user.Access in [OWNER]');
  assert.equal(rules[0].rights, '+CRUD');
  assert.deepEqual(rules.at(-1), { formula: '', rights: '-CRUD', memo: rules.at(-1).memo });
  assert.ok(rules.every(rule => isSharingNote(rule.memo)));
  assert.match(rules.find(rule => rule.rights === '+C').formula, /newRec\.GFS_Author\.lower\(\) == user\.Email\.lower\(\)/);
  assert.ok(rules.every(rule => !/\bnow\b|NOW|TODAY|lookup/.test(rule.formula)), 'une règle ne lit que `rec` et `newRec`');
});

test('les règles de la table de partages : création à son nom ET avec son rôle (mesuré : Grist garde l\'auteur qu\'on lui donne), lecture de ce qui nous concerne', () => {
  const create = shareRules().find(rule => rule.rights === '+C');
  assert.match(create.formula, /newRec\.Author\.lower\(\) == user\.Email\.lower\(\)/);
  assert.match(create.formula, /newRec\.AuthorAccess == user\.Access/);
  assert.ok(shareRules().some(rule => rule.rights === '+R' && /PersonL == user\.Email\.lower\(\)/.test(rule.formula) && /"@tous"/.test(rule.formula)));
  assert.deepEqual(stampRules().map(rule => rule.rights), ['-U']);
});

test('les notes du partage disent « Encadré » au panneau (les tables sont protégées par des règles de GFS), jamais « Partagé » (le niveau du rangement)', () => {
  for (const rule of [...fileRules(), ...shareRules(), ...stampRules(), ...noticeTableRules(), ...noticeColumnGroups().flatMap(group => group.rules)]) {
    assert.equal(levelOfNote(rule.memo), 'encadre', rule.memo);
  }
});

test('activer le partage sur un document neuf : les deux tables, les règles, la première règle du document', () => {
  const plan = planSharing(base(), filesColumns());
  assert.equal(plan.ok, true);
  assert.equal(plan.firstRule, true);
  assert.deepEqual(plan.creates, [SHARES_TABLE, 'GFS_Filing', 'GFS_Files', 'GFS_Groups', 'GFS_Spaces', 'GFS_Placement', 'GFS_Notifications']);
  assert.deepEqual(plan.actions.filter(action => action[0] === 'AddTable').map(action => action[1]), ['GFS_Groups', 'GFS_Spaces', 'GFS_Placement', 'GFS_Notifications', 'GFS_Files', 'GFS_Filing', SHARES_TABLE], 'groupes, espaces et placement d\'abord : les colonnes d\'aide les lisent');
  const created = plan.actions.find(action => action[1] === 'GFS_Files')[2];
  assert.deepEqual(created.map(column => column.id), [...filesColumns().map(column => column.id), 'GFS_Author', ...HELPERS]);
  const resources = plan.actions.filter(action => action[1] === '_grist_ACLResources').map(action => action[3]);
  assert.deepEqual(resources.map(resource => `${resource.tableId}/${resource.colIds}`), [`${SHARES_TABLE}/Author,AuthorAccess`, `${SHARES_TABLE}/*`, 'GFS_Groups/Name,NameL,Count,Source', 'GFS_Groups/*', 'GFS_Spaces/*', 'GFS_Placement/*', 'GFS_Notifications/Recipient,Type,Target,By,Key,When', 'GFS_Notifications/Read', 'GFS_Notifications/*', 'GFS_Files/GFS_Author', 'GFS_Files/*', 'GFS_Filing/*']);
  assert.ok(plan.actions.findIndex(action => action[0] === 'AddTable') < plan.actions.findIndex(action => action[1] === '_grist_ACLResources'), 'les tables avant les règles');
});

test('le rangement naît avec le partage s\'il manque (sans lui, GFS ne connaît pas l\'adresse d\'un éditeur et son PDF serait refusé), et n\'est pas recréé s\'il est là', () => {
  const without = planSharing(base(), filesColumns());
  assert.ok(without.actions.some(action => action[0] === 'AddTable' && action[1] === 'GFS_Filing' && action[2].some(column => column.id === 'Address')));
  const there = planSharing({ ...base(), tables: [{ id: 3, tableId: 'GFS_Filing' }] }, filesColumns());
  assert.ok(!there.creates.includes('GFS_Filing') && !there.actions.some(action => action[0] === 'AddTable' && action[1] === 'GFS_Filing'));
});

test('les règles se posent aux numéros qui suivent ceux en place, dans l\'ordre, sur la bonne ressource', () => {
  const existing = { ...base(), resources: [{ id: 1, tableId: '', colIds: '' }, { id: 4, tableId: 'Autre', colIds: '*' }], rules: [{ ...BUILT_IN }, { id: 9, resource: 4, aclFormula: '', permissionsText: '+R', memo: 'à la main' }] };
  const plan = planSharing(existing, filesColumns());
  assert.equal(plan.ok, true);
  assert.equal(plan.firstRule, false, 'une règle à la main est déjà là : ce n\'est pas la première');
  const rules = plan.actions.filter(action => action[1] === '_grist_ACLRules');
  assert.equal(rules[0][2], 10);
  const sharesResource = plan.actions.find(action => action[1] === '_grist_ACLResources' && action[3].colIds === '*' && action[3].tableId === SHARES_TABLE)[2];
  assert.deepEqual(rules.filter(action => action[3].resource === sharesResource).map(action => action[3].rulePos), [1, 2, 3, 4, 5, 6]);
});

test('une table de fichiers déjà là : seules les colonnes d\'aide manquantes sont ajoutées, jamais la table recréée', () => {
  const plan = planSharing(withFiles(), filesColumns());
  assert.deepEqual(plan.creates, [SHARES_TABLE, 'GFS_Filing', 'GFS_Groups', 'GFS_Spaces', 'GFS_Placement', 'GFS_Notifications']);
  assert.deepEqual(plan.actions.filter(action => action[0] === 'AddColumn').map(action => action[2]), ['GFS_Author', ...HELPERS]);
  // Les PDF d'avant : l'auteur est repris de « Author » (colonne à formule rendue ordinaire : elle garde ses valeurs), puis la formule de création reprend pour les nouvelles lignes.
  const kept = plan.actions.filter(action => action[2] === 'GFS_Author' && action[1] === 'GFS_Files');
  assert.deepEqual(kept.map(action => action[0]), ['AddColumn', 'ModifyColumn']);
  assert.deepEqual([kept[0][3].isFormula, kept[0][3].formula], [true, '$Author']);
  assert.deepEqual([kept[1][3].isFormula, kept[1][3].formula, kept[1][3].recalcWhen], [false, 'user.Email', 0]);
  const some = planSharing(withFiles([{ parentId: 7, colId: 'GFS_Readers' }]), filesColumns());
  assert.ok(!some.actions.some(action => action[0] === 'AddColumn' && action[2] === 'GFS_Readers'));
  assert.equal(some.adds.length, HELPERS.length);
});

test('une table qui porte encore ses colonnes d\'aide d\'avant (Sync+ la tient) : le plan les complète sous leurs noms d\'avant, formules et règles comprises', () => {
  const old = withFiles([{ parentId: 7, colId: 'GFS_Lecteurs' }, { parentId: 7, colId: 'GFS_Auteur' }]);
  const plan = planSharing(old, filesColumns());
  const added = plan.actions.filter(action => action[0] === 'AddColumn' && action[1] === 'GFS_Files').map(action => action[2]);
  assert.deepEqual(added, ['GFS_Dossier', 'GFS_Ids', 'GFS_Calc', 'GFS_Ecrivains', 'GFS_Admins', 'GFS_Refus', 'GFS_Cats', 'GFS_CatsEcrit', 'GFS_Directs', 'GFS_Vus']);
  const text = JSON.stringify(plan.actions);
  assert.doesNotMatch(text, /GFS_(Author|Folder|Readers|Writers|Denied|CatsWrite|Direct|Seen)\b/, 'aucun nom d\'arrivée n\'entre dans une table restée aux noms d\'avant');
  const rules = plan.actions.filter(action => action[1] === '_grist_ACLRules').map(action => action[3].aclFormula).join('\n');
  assert.match(rules, /rec\.GFS_Refus/);
  assert.match(rules, /newRec\.GFS_Auteur/);
  // Une autre table du même document, sans colonne d'aide, reçoit les noms d'arrivée : le jeu se choisit table par table.
  const both = { ...old, tables: [...old.tables, { id: 9, tableId: 'Publipostage_Modeles' }], columns: [...old.columns, { parentId: 9, colId: 'Name' }],
    targets: targetsOf([{ id: 'publipostage', fichiers: [{ table: 'Publipostage_Modeles', colonnes: { id: 'id' } }] }]) };
  const mixed = planSharing(both, filesColumns());
  assert.deepEqual(mixed.actions.filter(action => action[0] === 'AddColumn' && action[1] === 'Publipostage_Modeles').map(action => action[2]).slice(0, 2), ['GFS_Author', 'GFS_Folder']);
});

test('refus : déjà activé ; une règle d\'un autre auteur sur une de ces tables', () => {
  const done = applied(base(), planSharing(base(), filesColumns()).actions);
  assert.deepEqual(planSharing(done, filesColumns()), { ok: false, reason: 'already' });
  const foreign = { ...withFiles(), resources: [{ id: 1, tableId: '', colIds: '' }, { id: 2, tableId: 'GFS_Files', colIds: '*' }], rules: [{ ...BUILT_IN }, { id: 2, resource: 2, aclFormula: '', permissionsText: '-D', memo: 'écrite à la main' }] };
  assert.deepEqual(planSharing(foreign, filesColumns()), { ok: false, reason: 'foreign' });
});

test('retirer : les règles de partage et leurs ressources, rien d\'autre ; les tables restent ; un second retrait n\'a plus rien à faire', () => {
  const hand = { id: 50, resource: 1, aclFormula: 'user.Access != OWNER', permissionsText: '-S', memo: 'GFS : Structure fermée · …' };
  const done = applied({ ...base(), rules: [{ ...BUILT_IN }, hand] }, planSharing(base(), filesColumns()).actions);
  assert.equal(sharingActive(done.tables), true);
  const plan = planUnsharing(done);
  assert.equal(plan.ok, true);
  const after = applied(done, plan.actions);
  // Le rangement garde ses règles « Partagé » : elles protègent le rangement de chacun, partage ou non (c'est un autre geste que de les retirer).
  assert.deepEqual(after.rules.filter(rule => !/^GFS : Partagé/.test(rule.memo)).map(rule => rule.id).sort((a, b) => a - b), [1, 50]);
  assert.equal(after.rules.filter(rule => /^GFS : Partagé/.test(rule.memo)).length, 6);
  assert.equal(after.resources.length, 2);
  assert.equal(sharingActive(after.tables), true);
  assert.equal(planUnsharing(after).reason, 'none');
});

test('la ligne d\'un partage : le droit, la personne nettoyée, la fin ; refus d\'un droit inconnu ou d\'une personne vide ; jamais l\'auteur (Grist l\'écrit)', () => {
  assert.deepEqual(shareRecord({ target: 'gfs-fichiers:f1', who: '  Marie@Exemple.fr ', right: 'ecriture', download: true, end: 1800000000 }), { Target: 'gfs-fichiers:f1', Person: 'Marie@Exemple.fr', Right: 'ecriture', Download: true, End: 1800000000 });
  assert.equal(shareRecord({ target: 'gfs-fichiers:f1', who: '', right: 'lecture' }), null);
  assert.equal(shareRecord({ target: 'gfs-fichiers:f1', who: 'a@b.fr', right: 'depot' }), null, 'le dépôt seul attend sa table');
  assert.ok(!('Author' in shareRecord({ target: 'x', who: 'a@b.fr', right: 'lecture' })));
});

test('ce que la fenêtre lit : les lignes de la cible et la racine (héritée), triées, avec leur validité', () => {
  const rows = [
    { id: 3, Target: '*', Person: '@tous', Right: 'lecture' }, { id: 1, Target: 'gfs-fichiers:f1', Person: 'zoe@x.fr', Right: 'admin', Valid: true },
    { id: 2, Target: 'gfs-fichiers:f1', Person: 'ann@x.fr', Right: 'lecture', Valid: false, End: 100 }, { id: 4, Target: 'gfs-fichiers:f2', Person: 'autre@x.fr', Right: 'lecture' },
  ];
  const shares = sharesOf(rows, 'gfs-fichiers:f1');
  assert.deepEqual(shares.map(share => [share.who, share.inherited, share.valid]), [['ann@x.fr', false, false], ['zoe@x.fr', false, true], ['@tous', true, true]]);
  assert.equal(shares[0].end, 100);
});

// ---------- les fichiers des apps (contrats 11.7, point 13, lot 2) ----------
const PP = { id: 'publipostage', fichiers: [{ table: 'Publipostage_Modeles', colonnes: { id: 'id', nom: 'Nom' }, exclure: { TypeModele: ['reglages'] } }] };
const ids = { id: 'fichier', fichiers: [{ table: 'Autre_Fichiers', colonnes: { id: 'Jeton' } }] };
const withApp = (extra = {}) => ({ ...base(), tables: [{ id: 7, tableId: 'Publipostage_Modeles' }], columns: [{ parentId: 7, colId: 'Nom' }], targets: targetsOf([PP]), files: { Publipostage_Modeles: [3, 5] }, ...extra });

test('les cibles des apps : une par table de fichiers du manifeste, le numéro de ligne quand l\'identifiant est « id », les lignes exclues ouvertes', () => {
  const [files, annuaires, pp, other] = targetsOf([PP, ids]);
  assert.equal(files.table, 'GFS_Files');
  assert.deepEqual([annuaires.table, annuaires.prefix, annuaires.author, annuaires.stamped], ['GFS_Directories', 'gfs-annuaires:', 'GFS_Author', true]); // le verrou des sous-annuaires
  assert.deepEqual([pp.table, pp.prefix, pp.id, pp.author, pp.stamped], ['Publipostage_Modeles', 'publipostage:', null, 'GFS_Author', true]);
  assert.equal(pp.open, 'rec.TypeModele in ("reglages",)');
  assert.deepEqual([other.id, other.open], ['Jeton', '']);
  assert.deepEqual(appTargets([{ id: 'x' }, { id: 'y', fichiers: [{}] }]), []);
});

test('une table d\'app : GFS pose sa colonne d\'auteur (écrite par Grist) et les colonnes d\'aide, lit la ligne par son numéro, ouvre les lignes de réglages', () => {
  const [, , pp] = targetsOf([PP]);
  const columns = helperColumns(pp);
  assert.deepEqual(columns.map(column => column.id), ['GFS_Author', ...HELPERS]);
  assert.equal(columns[0].isFormula, false);
  assert.equal(columns[0].recalcWhen, 0);
  assert.match(columns.find(column => column.id === 'GFS_Calc').formula, /key = "publipostage:" \+ str\(\$id\)/);
  assert.match(columns.find(column => column.id === 'GFS_Calc').formula, /\$GFS_Author/);
  assert.match(columns.find(column => column.id === 'GFS_Folder').formula, /lookupRecords\(App="publipostage", File=str\(\$id\)\)/);
  const share = shareColumns(targetsOf([PP])).find(column => column.id === 'AdminsBase').formula;
  assert.match(share, /lookupOne\(id=int\(raw\)\) if raw\.isdigit\(\) else None/);
  assert.match(share, /found\.GFS_Author/);
  const rules = fileRules(pp);
  assert.deepEqual(rules.map(rule => rule.rights), ['+CRUD', '+R', '+UD', '-CRUD', '+CRUD', '+RU', '+R', '+C', '-CRUD']);
  assert.match(rules[1].formula, /^rec\.TypeModele in \("reglages",\)$/);
  assert.match(rules[3].formula, /rec\.GFS_Denied/, 'le refus passe avant les administrateurs');
  assert.match(rules.find(rule => rule.rights === '+C').formula, /newRec\.GFS_Author\.lower\(\) == user\.Email\.lower\(\)/);
  assert.equal(fileRules().length, 7, 'sans lignes exclues : propriétaires, refus, administrateurs, écriture, lecture, création, reste refusé');
});

test('activer avec une app : ses colonnes, ses règles (la colonne d\'auteur gardée), ses modèles d\'avant lisibles de tous ; une table d\'app absente est laissée', () => {
  const plan = planSharing({ ...withApp(), targets: targetsOf([PP, ids]) }, filesColumns());
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.appTables, ['Publipostage_Modeles']);
  assert.deepEqual(plan.adds, ['Publipostage_Modeles.GFS_Author', ...HELPERS.map(id => `Publipostage_Modeles.${id}`)]);
  assert.equal(plan.legacy, 2);
  const legacy = plan.actions.find(action => action[0] === 'BulkAddRecord');
  assert.deepEqual(legacy[3].Target, ['publipostage:3', 'publipostage:5']);
  const resources = plan.actions.filter(action => action[1] === '_grist_ACLResources').map(action => `${action[3].tableId}/${action[3].colIds}`);
  assert.deepEqual(resources, [`${SHARES_TABLE}/Author,AuthorAccess`, `${SHARES_TABLE}/*`, 'GFS_Groups/Name,NameL,Count,Source', 'GFS_Groups/*', 'GFS_Spaces/*', 'GFS_Placement/*', 'GFS_Notifications/Recipient,Type,Target,By,Key,When', 'GFS_Notifications/Read', 'GFS_Notifications/*', 'GFS_Files/GFS_Author', 'GFS_Files/*', 'Publipostage_Modeles/GFS_Author', 'Publipostage_Modeles/*', 'GFS_Filing/*']);
  assert.ok(!plan.actions.some(action => action[0] === 'AddTable' && action[1] === 'Autre_Fichiers'));
});

test('une règle d\'un autre auteur sur la table d\'une app : cette table est laissée (dite), le reste s\'active ; ajouter une app plus tard complète sans refaire le reste', () => {
  const hand = { id: 9, resource: 4, aclFormula: '', permissionsText: '-D', memo: 'écrite à la main' };
  const foreign = withApp({ resources: [{ id: 1, tableId: '', colIds: '' }, { id: 4, tableId: 'Publipostage_Modeles', colIds: '*' }], rules: [{ ...BUILT_IN }, hand] });
  const first = planSharing(foreign, filesColumns());
  assert.equal(first.ok, true);
  assert.deepEqual([first.appTables, first.skipped], [[], ['Publipostage_Modeles']]);
  const done = applied(base(), planSharing(base(), filesColumns()).actions);
  assert.equal(planSharing(done, filesColumns()).reason, 'already');
  const later = { ...done, tables: [...done.tables, { id: 7, tableId: 'Publipostage_Modeles' }], columns: [...done.columns, { parentId: 7, colId: 'Nom' }], targets: targetsOf([PP]), files: { Publipostage_Modeles: [1] } };
  const extension = planSharing(later, filesColumns());
  assert.equal(extension.ok, true);
  assert.equal(extension.extends, true);
  assert.deepEqual(extension.appTables, ['Publipostage_Modeles']);
  assert.ok(!extension.actions.some(action => action[0] === 'AddTable'));
  assert.ok(extension.actions.some(action => action[0] === 'ModifyColumn' && action[2] === 'AdminsBase' && /publipostage:/.test(action[3].formula)), 'la formule des administrateurs apprend la table');
  assert.ok(!extension.actions.some(action => action[1] === '_grist_ACLResources' && /^GFS_Shares/.test(action[3].tableId)), 'les règles des partages ne sont pas reposées');
  assert.equal(planSharing(applied(later, extension.actions), filesColumns()).reason, 'already');
});

test('après un retrait, activer de nouveau repose les règles sans recréer les tables ni les colonnes', () => {
  const done = applied(base(), planSharing(base(), filesColumns()).actions);
  const removed = applied(done, planUnsharing(done).actions);
  const again = planSharing(removed, filesColumns());
  assert.equal(again.ok, true);
  assert.deepEqual([again.creates, again.adds], [[], []]);
  assert.ok(again.actions.some(action => action[1] === '_grist_ACLResources' && action[3].tableId === SHARES_TABLE));
});

// Les groupes (lot 3) : un partage cible `#nom`, les colonnes d'aide développent les membres, la table des groupes naît avec le partage.
import * as model from '../js/sharing/sharing-model.js';

test('les colonnes d\'un groupe : nom, nom minuscule, adresses tapées, source, membres et nombre calculés par Grist', () => {
  const ids = model.groupColumns().map(item => item.id);
  assert.deepEqual(ids, ['Name', 'NameL', 'People', 'Source', 'SourceEmail', 'SourceGroup', 'Members', 'Count']);
  const members = model.groupColumns().find(item => item.id === 'Members');
  assert.equal(members.isFormula, true);
  assert.match(members.formula, /^out = set\(/);
  assert.ok(!members.formula.startsWith(' '), 'aucune ligne de tête indentée');
});

test('un groupe lu d\'une table : la formule des membres relit la table et la colonne, jamais un identifiant douteux', () => {
  const one = model.planGroupSources([{ table: 'Contacts', email: 'Mail', group: 'Equipe' }]).actions[0];
  assert.deepEqual(one.slice(0, 3), ['ModifyColumn', 'GFS_Groups', 'Members']);
  assert.match(one[3].formula, /Contacts\.lookupRecords\(Equipe=\$Name\)/);
  assert.match(one[3].formula, /r\.Mail/);
  const bad = model.planGroupSources([{ table: 'Contacts"; import os', email: 'Mail', group: 'Equipe' }]).actions[0][3].formula;
  assert.doesNotMatch(bad, /import os/);
  assert.deepEqual(model.sourcesOf([{ Source: 'Contacts', SourceEmail: 'Mail', SourceGroup: 'Equipe' }, { Source: 'Contacts', SourceEmail: 'Mail', SourceGroup: 'Equipe' }, { Source: 'x y', SourceEmail: 'a', SourceGroup: 'b' }, { Source: '' }]), [{ table: 'Contacts', email: 'Mail', group: 'Equipe' }]);
});

test('le calcul des droits développe un groupe par ses membres (une règle ne lit pas une autre table)', () => {
  const calc = model.helperColumns(defaultTargets()[0]).find(item => item.id === 'GFS_Calc').formula;
  assert.match(calc, /GFS_Groups\.lookupOne\(NameL=p\.PersonL\[1:\]\)/);
  assert.match(calc, /g\.Members/);
});

test('les règles de la table des groupes : les propriétaires font tout, un éditeur lit nom, nombre et source, le reste est refusé', () => {
  assert.deepEqual(model.groupRules().map(item => [item.formula, item.rights]), [['user.Access in [OWNER]', '+CRUD'], ['', '-CRUD']]);
  assert.deepEqual(model.groupPublicRules().map(item => [item.formula, item.rights]), [['user.Access in [EDITOR]', '+R']]);
  assert.equal(model.GROUP_PUBLIC, 'Name,NameL,Count,Source');
  assert.ok(!model.GROUP_PUBLIC.includes('Members') && !model.GROUP_PUBLIC.includes('People'), 'jamais les adresses');
});

test('un document partagé avant les espaces : les tables naissent, GFS_Calc s\'ajoute, les formules d\'aide sont reprises, les règles d\'avant sont retirées puis reposées, aucun ancien fichier n\'est repartagé', () => {
  const first = planSharing(withFiles(), filesColumns());
  const done = applied(withFiles(), first.actions);
  // l'état d'avant : sans espaces ni placement, sans GFS_Calc ni GFS_Denied, et des règles de fichiers sans la règle des refus
  const gone = new Set(['GFS_Spaces', 'GFS_Placement']);
  const old = { ...done, tables: done.tables.filter(row => !gone.has(row.tableId)) };
  const goneResources = done.resources.filter(row => gone.has(row.tableId)).map(row => row.id);
  old.resources = done.resources.filter(row => !goneResources.includes(row.id));
  old.rules = done.rules.filter(rule => !goneResources.includes(rule.resource) && !String(rule.aclFormula || '').includes('GFS_Denied'));
  old.columns = done.columns.filter(col => !['GFS_Calc', 'GFS_Denied'].includes(col.colId));
  const plan = planSharing(old, filesColumns());
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.creates, ['GFS_Spaces', 'GFS_Placement']);
  assert.equal(plan.actions[0][0], 'AddTable');
  assert.ok(plan.actions.some(action => action[0] === 'ModifyColumn' && action[2] === 'GFS_Readers'), 'les colonnes d\'aide d\'avant sont reprises');
  assert.ok(plan.actions.findIndex(action => action[0] === 'AddColumn' && action[2] === 'GFS_Calc') < plan.actions.findIndex(action => action[0] === 'ModifyColumn' && action[2] === 'GFS_Readers'), 'GFS_Calc d\'abord');
  assert.ok(plan.actions.some(action => action[0] === 'BulkRemoveRecord' && action[1] === '_grist_ACLRules'), 'les règles de fichiers d\'avant sont retirées');
  assert.equal(plan.legacy, 0, 'un fichier déjà partagé n\'est pas repartagé à tous');
  assert.equal(plan.actions.some(action => action[0] === 'BulkAddRecord'), false);
  // un second passage sur l'état à jour ne trouve rien à faire
  assert.equal(planSharing(applied(old, plan.actions), filesColumns()).reason, 'already');
});

test('les liens entre espaces (13.o) : GFS_Seen lit les liens de la chaîne du fichier, le placement porte Lien et Partages, les deux calculs partent de la même chaîne', () => {
  const [calc, vus] = ['GFS_Calc', 'GFS_Seen'].map(id => model.helperColumns(defaultTargets()[0]).find(item => item.id === id));
  assert.equal(vus.isFormula, true);
  assert.match(vus.formula, /GFS_Placement\.lookupRecords\(Link=cible\)/);
  assert.match(vus.formula, /rest = \[\] if cible == key else full\[lvl - 1:\]/);
  assert.ok(HELPERS.includes('GFS_Seen'));
  assert.deepEqual(model.placeColumns().map(column => column.id), ['Target', 'Space', 'Folder', 'Sees', 'Link', 'Shares']);
  const chain = vus.formula.split('\nout = set()')[0];
  assert.ok(calc.formula.startsWith(chain), 'la chaîne des cibles est écrite une seule fois');
  assert.match(chain, /full = parts/);
  assert.match(chain, /full = mine/);
});

test('un document partagé avant les liens : les deux colonnes du placement et GFS_Seen s\'ajoutent (additif), rien ne se recrée, un second passage ne trouve rien', () => {
  const done = applied(withFiles(), planSharing(withFiles(), filesColumns()).actions);
  const old = { ...done, columns: done.columns.filter(col => !['Link', 'Shares', 'GFS_Seen'].includes(col.colId)) };
  const plan = planSharing(old, filesColumns());
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.creates, []);
  const adds = plan.actions.filter(action => action[0] === 'AddColumn').map(action => `${action[1]}.${action[2]}`);
  assert.ok(adds.includes('GFS_Placement.Link') && adds.includes('GFS_Placement.Shares') && adds.includes('GFS_Files.GFS_Seen'), adds.join(', '));
  assert.ok(adds.indexOf('GFS_Placement.Link') < adds.indexOf('GFS_Files.GFS_Seen'), 'les colonnes du placement avant la formule qui les lit');
  assert.equal(plan.actions.some(action => action[0] === 'AddTable'), false);
  assert.equal(planSharing(applied(old, plan.actions), filesColumns()).reason, 'already');
});

test('le nom d\'un groupe : nettoyé, sans @ ni # au début, 60 signes au plus', () => {
  assert.equal(model.groupName('  Équipe   des  achats '), 'Équipe des achats');
  assert.equal(model.groupName('@editeurs'), null);
  assert.equal(model.groupName('#x'), null);
  assert.equal(model.groupName(''), null);
  assert.equal(model.groupName('a'.repeat(61)), null);
  assert.ok(model.isGroup('#achats') && !model.isGroup('@tous') && !model.isGroup('a@b.fr'));
});

test('la ligne d\'un groupe et son ajout : tapé dans GFS ou lu d\'une table ; un nom pris ou un identifiant douteux est refusé', () => {
  assert.deepEqual(model.groupRecord({ name: 'Achats', people: ' a@x.fr\nb@x.fr ' }), { Name: 'Achats', People: 'a@x.fr\nb@x.fr', Source: '', SourceEmail: '', SourceGroup: '' });
  assert.equal(model.groupRecord({ name: 'Achats', source: { table: 'C', email: 'M; x', group: 'G' } }), null);
  const add = model.planGroupAdd([{ Name: 'Compta' }], model.groupRecord({ name: 'Achats', people: 'a@x.fr' }));
  assert.deepEqual(add.actions.map(action => action[0]), ['AddRecord']);
  assert.equal(model.planGroupAdd([{ Name: 'achats' }], model.groupRecord({ name: 'Achats' })).reason, 'exists');
  const fromTable = model.planGroupAdd([{ Name: 'Compta', Source: 'C', SourceEmail: 'M', SourceGroup: 'G' }], model.groupRecord({ name: 'Achats', source: { table: 'D', email: 'E', group: 'F' } }));
  assert.deepEqual(fromTable.actions.map(action => action[0]), ['ModifyColumn', 'AddRecord']);
  assert.match(fromTable.actions[0][3].formula, /C\.lookupRecords[\s\S]*D\.lookupRecords/, 'les anciennes sources restent');
  assert.deepEqual(model.groupsOf([{ id: 2, Name: 'b', Count: 3, Source: 'C' }, { id: 1, Name: 'a', Count: '2' }, { id: 3, Name: '' }]).map(group => [group.name, group.count]), [['a', 2], ['b', 3]]);
});

test('lire les groupes d\'une table : un groupe par valeur distincte, les noms pris ou douteux laissés, une seule formule relue', () => {
  const source = { table: 'Contacts', email: 'Mail', group: 'Equipe' };
  const plan = model.planGroupsRead([{ Name: 'Compta' }], source, ['Achats', 'achats', 'Compta', '@x', '', 'Ventes']);
  assert.equal(plan.ok, true);
  assert.equal(plan.added, 2);
  assert.deepEqual(plan.actions.map(action => action[0]), ['ModifyColumn', 'BulkAddRecord']);
  assert.deepEqual(plan.actions[1][3].Name, ['Achats', 'Ventes']);
  assert.deepEqual(plan.actions[1][3].Source, ['Contacts', 'Contacts']);
  assert.equal(model.planGroupsRead([], source, ['', null]).reason, 'none');
  assert.equal(model.planGroupsRead([], { ...source, table: 'a b' }, ['x']).reason, 'invalid');
});

test('la formule des membres est du Python : aucun saut de ligne dans une chaîne (le « \\n » du texte reste deux signes), ni dans la formule de groupes lus', () => {
  const sources = [{ table: 'Contacts', email: 'Mail', group: 'Equipe' }];
  for (const formula of [model.groupColumns().find(item => item.id === 'Members').formula, model.planGroupSources(sources).actions[0][3].formula]) {
    assert.match(formula, /split\("\\n"\)/);
    for (const line of formula.split('\n')) assert.equal(line.split('"').length % 2, 1, `guillemets non fermés : ${line}`);
  }
});

// Les espaces et « le plus précis gagne » (lot 4a) : les tables, les cibles, le droit « Aucun accès », la règle des refus.
test('les cibles d\'un espace et d\'un dossier : « espace:clé » et « dossier:clé/chemin », le chemin nettoyé', () => {
  assert.equal(model.spaceTarget('achats'), 'espace:achats');
  assert.equal(model.folderTarget('achats', '/Contrats//Sous/'), 'dossier:achats/Contrats/Sous');
  assert.equal(model.folderTarget('achats', ''), 'dossier:achats/');
});

test('« Aucun accès » : un droit pour une personne ou un groupe, jamais pour une catégorie ; l\'administration reste celle d\'une personne', () => {
  assert.equal(model.shareRecord({ target: 'a:1', who: 'x@y.fr', right: 'aucun' }).Right, 'aucun');
  assert.equal(model.shareRecord({ target: 'a:1', who: '#Achats', right: 'aucun' }).Right, 'aucun');
  assert.equal(model.shareRecord({ target: 'a:1', who: '@tous', right: 'aucun' }), null);
  assert.equal(model.shareRecord({ target: 'a:1', who: '@editeurs', right: 'admin' }), null);
  assert.equal(model.shareRecord({ target: 'a:1', who: '#Achats', right: 'admin' }).Right, 'admin', 'un groupe administre comme une personne (choix du porteur, 13/11)');
});

test('les tables d\'espaces : un espace voit qui y a accès (groupes développés), le placement le relit ; les règles cachent l\'espace à qui n\'y a pas accès', () => {
  assert.deepEqual(model.spaceColumns().map(item => item.id), ['Key', 'Name', 'Sees']);
  assert.match(model.spaceColumns().find(item => item.id === 'Sees').formula, /Target="espace:" \+ str\(\$Key\)/);
  assert.match(model.spaceColumns().find(item => item.id === 'Sees').formula, /g\.Members/);
  assert.deepEqual(model.placeColumns().map(item => item.id), ['Target', 'Space', 'Folder', 'Sees', 'Link', 'Shares']);
  assert.deepEqual(model.spaceRules().map(item => item.rights), ['+CRUD', '+R', '-CRUD']);
  for (const line of model.spaceColumns().find(item => item.id === 'Sees').formula.split('\n')) assert.equal(line.split('"').length % 2, 1, line);
});

test('la règle des refus passe après les propriétaires et avant les administrateurs, et vise les fichiers de toute table', () => {
  for (const target of [defaultTargets()[0], ...targetsOf([PP]).slice(1)]) {
    const rights = model.fileRules(target).map(item => item.formula);
    const at = rights.findIndex(formulaText => formulaText.includes('GFS_Denied'));
    assert.ok(at === 1 || at === 3, `rang du refus : ${at}`);
    assert.equal(model.fileRules(target)[at].rights, '-CRUD');
    assert.ok(at < rights.findIndex(formulaText => formulaText.includes('GFS_Admins')));
  }
});

test('créer, lire, vider un espace : la clé sans accent ni doublon, le nom refusé s\'il est vide ou pris, la suppression emporte ses partages et ses placements', () => {
  assert.equal(model.spaceKey('Équipe Achats & Compta'), 'equipe-achats-compta');
  assert.equal(model.spaceKey('Achats', ['achats', 'achats-2']), 'achats-3');
  assert.equal(model.spaceKey('!!!'), '');
  const add = model.planSpaceAdd([{ Key: 'achats', Name: 'Achats' }], ' Ventes  Nord ');
  assert.deepEqual([add.ok, add.key, add.actions[0].slice(0, 2), add.actions[0][3]], [true, 'ventes-nord', ['AddRecord', 'GFS_Spaces'], { Key: 'ventes-nord', Name: 'Ventes Nord' }]);
  assert.equal(model.planSpaceAdd([{ Key: 'achats', Name: 'Achats' }], 'achats').reason, 'exists');
  assert.equal(model.planSpaceAdd([], '  ').reason, 'invalid');
  const shares = [{ id: 1, Target: 'espace:achats', Person: '#Achats', Right: 'lecture' }, { id: 2, Target: 'dossier:achats/Contrats', Person: 'a@x.fr', Right: 'ecriture' }, { id: 3, Target: 'dossier:achats-2/X', Person: 'a@x.fr', Right: 'lecture' }, { id: 4, Target: 'espace:achats', Person: 'b@x.fr', Right: 'lecture' }];
  const spaces = model.spacesOf([{ id: 7, Key: 'achats', Name: 'Achats', Sees: ['a@x.fr', 'b@x.fr'] }, { id: 8, Key: '', Name: 'vide' }], shares);
  assert.deepEqual(spaces, [{ id: 7, key: 'achats', name: 'Achats', people: 2, groups: [{ id: 1, group: 'Achats', right: 'lecture' }] }]);
  const gone = model.planSpaceRemove(spaces[0], shares, [{ id: 10, Space: 'achats' }, { id: 11, Space: 'autre' }]);
  assert.deepEqual(gone.actions, [['BulkRemoveRecord', 'GFS_Shares', [1, 2, 4]], ['BulkRemoveRecord', 'GFS_Placement', [10]], ['RemoveRecord', 'GFS_Spaces', 7]]);
});

test('le rôle d\'un groupe dans un espace : ajouté, changé, retiré ; lecture ou écriture seulement', () => {
  const space = { key: 'achats' };
  const shares = [{ id: 1, Target: 'espace:achats', Person: '#Achats', Right: 'lecture' }];
  assert.deepEqual(model.planSpaceGroup(space, shares, 'Achats', 'ecriture').actions, [['UpdateRecord', 'GFS_Shares', 1, { Right: 'ecriture' }]]);
  assert.deepEqual(model.planSpaceGroup(space, shares, 'Achats', null).actions, [['RemoveRecord', 'GFS_Shares', 1]]);
  const added = model.planSpaceGroup(space, shares, 'Compta', 'lecture').actions[0];
  assert.deepEqual([added[0], added[3].Target, added[3].Person, added[3].Right], ['AddRecord', 'espace:achats', '#Compta', 'lecture']);
  assert.equal(model.planSpaceGroup(space, shares, 'Compta', 'admin').reason, 'invalid');
  assert.deepEqual(model.planSpaceGroup(space, shares, 'Absent', null).actions, []);
});

test('créer un espace : la personne qui le crée y entre (écriture, en minuscules) dans la même écriture ; sans adresse, seulement l\'espace', () => {
  const added = model.planSpaceAdd([], 'Équipe UI', ' Moi@X.fr ');
  assert.deepEqual(added.actions.map(action => action.slice(0, 2)), [['AddRecord', 'GFS_Spaces'], ['AddRecord', 'GFS_Shares']]);
  assert.deepEqual([added.actions[1][3].Target, added.actions[1][3].Person, added.actions[1][3].Right], ['espace:equipe-ui', 'moi@x.fr', 'ecriture']);
  assert.equal(model.planSpaceAdd([], 'Équipe UI').actions.length, 1);
  assert.equal(model.planSpaceAdd([], 'Équipe UI', '  ').actions.length, 1);
});

test('« Administrer » : une personne ou un groupe (ses membres), jamais une catégorie ; le calcul des droits plafonne une catégorie à l\'écriture', () => {
  for (const id of ['AdminsBase', 'AdminsTarget']) {
    const formula = model.shareColumns().find(column => column.id === id).formula;
    assert.match(formula, /if p\.PersonL\.startswith\("#"\):\n *g = GFS_Groups\.lookupOne\(NameL=p\.PersonL\[1:\]\)\n *out\.update\(list\(g\.Members or \(\)\) if g else \[\]\)/, `${id} développe un groupe`);
    assert.match(formula, /elif p\.PersonL and not p\.PersonL\.startswith\("@"\):\n *out\.add\(p\.PersonL\)/, `${id} ne compte aucune catégorie`);
  }
  const calc = model.helperColumns().find(column => column.id === 'GFS_Calc').formula;
  assert.match(calc, /put\(cats, p\.PersonL\[1:\], lvl, 0, min\(rank, 2\)\)/);
});

test('le dossier de « Moi » : l\'auteur du fichier le donne par GFS_Filing, la chaîne des droits l\'ajoute hors d\'un espace, sa clé porte l\'adresse de l\'auteur', () => {
  const dossier = model.helperColumns().find(column => column.id === 'GFS_Folder').formula;
  assert.match(dossier, /GFS_Filing\.lookupRecords\(App="gfs-fichiers", File=str\(\$FileId\)\)/);
  assert.match(dossier, /str\(r\.User or ""\)\.strip\(\)\.lower\(\) == author/);
  const calc = model.helperColumns().find(column => column.id === 'GFS_Calc').formula;
  assert.match(calc, /elif author:\n {2}mine = \[x for x in str\(\$GFS_Folder or ""\)\.split\("\/"\) if x\]/, 'seulement quand le fichier n\'est pas dans un espace');
  assert.match(calc, /chain\["dossier:moi:" \+ author \+ "\/" \+ "\/"\.join\(mine\[:i \+ 1\]\)\] = 2 \+ i/);
  assert.ok(calc.indexOf('author = ') < calc.indexOf('chain = '), 'l\'auteur est connu avant la chaîne');
  assert.equal(model.personalTarget('Marie@Exemple.fr', 'Docs/Factures'), 'dossier:moi:marie@exemple.fr/Docs/Factures');
  assert.ok(model.personalTarget('a@b.fr', 'Docs').startsWith(model.PERSONAL_PREFIX));
  const base = model.shareColumns().find(column => column.id === 'AdminsBase').formula;
  assert.match(base, /if cible\.startswith\("dossier:moi:"\):\n *out\.add\(cible\[12:\]\.split\("\/"\)\[0\]\.strip\(\)\.lower\(\)\)/, 'la personne administre son dossier, sans propriétaire');
});

test('les membres d\'un groupe à qui un dossier de « Moi » est donné ont le fichier « donné » (Partagés avec moi), pas ceux d\'un autre partage de groupe', () => {
  const calc = model.helperColumns().find(column => column.id === 'GFS_Calc').formula;
  assert.match(calc, /gave = str\(p\.Author or ""\)\.strip\(\)\.lower\(\) if cible\.startswith\("dossier:moi:"\) else ""/);
  assert.match(calc, /put\(best, m, lvl, 1, rank, gave\)/);
  assert.match(calc, /if v\[1\] in \(1, 2\) and v\[2\] >= 1 and v\[3\] and v\[3\] != who/);
});

test('les règles du rangement : le partage les pose avec le reste (sinon une ligne de rangement falsifiée mettrait le fichier d\'un autre dans un dossier partagé)', () => {
  const plan = planSharing(base(), filesColumns());
  const rules = plan.actions.filter(action => action[1] === '_grist_ACLRules').map(action => action[3]);
  const filing = rules.filter(rule => /^GFS : Partagé/.test(rule.memo));
  assert.deepEqual(filing.map(rule => rule.permissionsText), model.sharedRules().map(rule => rule.rights));
  assert.deepEqual(filing.map(rule => rule.aclFormula), model.sharedRules().map(rule => rule.formula));
  // Des règles « Partagé » déjà posées (le panneau d'avant) suffisent : rien n'est reposé ; une règle d'un autre auteur sur le rangement bloque (GFS n'y touche pas).
  const done = applied(base(), plan.actions);
  assert.equal(planSharing(done, filesColumns()).reason, 'already');
  const foreignRule = { id: 91, resource: 91, aclFormula: 'user.Access in [OWNER]', permissionsText: '+CRUD', memo: 'écrite à la main' };
  const hand = { ...base(), tables: [{ id: 3, tableId: 'GFS_Filing' }], resources: [{ id: 1, tableId: '', colIds: '' }, { id: 91, tableId: 'GFS_Filing', colIds: '*' }],
    rules: [{ ...BUILT_IN }, foreignRule] };
  assert.equal(planSharing(hand, filesColumns()).reason, 'foreign');
  // Un rangement d'avant la sonde : la colonne `Address` que nomme une règle est ajoutée d'abord.
  const old = { ...base(), tables: [{ id: 3, tableId: 'GFS_Filing' }], columns: [{ parentId: 3, colId: 'User' }] };
  const added = planSharing(old, filesColumns());
  const at = added.actions.findIndex(action => action[0] === 'AddColumn' && action[1] === 'GFS_Filing' && action[2] === 'Address');
  assert.ok(at >= 0 && at < added.actions.findIndex(action => action[1] === '_grist_ACLResources'), 'la colonne avant les règles');
  assert.ok(added.adds.includes('GFS_Filing.Address'));
});

// Un dossier de « Moi » se désigne par le numéro de sa ligne d'état (contrats 11.7, point 13.n.g) : renommer le dossier ne perd plus ses partages.
test('GFS_Ids : les lignes d\'état des dossiers de l\'AUTEUR du fichier, du plus haut au plus bas ; la chaîne les ajoute à côté des chemins (deux « / » : jamais un nom de dossier)', () => {
  const ids = model.helperColumns().find(column => column.id === 'GFS_Ids');
  assert.equal(ids.type, 'Any');
  assert.match(ids.formula, /GFS_Filing\.lookupRecords\(App="", File="", Folder="\/"\.join\(mine\[:i \+ 1\]\)\)/, 'une ligne d\'état : ni app ni fichier');
  assert.match(ids.formula, /if str\(r\.User or ""\)\.strip\(\)\.lower\(\) == author:\n {8}out\.append\(\[r\.id, i\]\)/, 'seules les lignes de l\'auteur comptent');
  assert.ok(ids.formula.indexOf('author = ') < ids.formula.indexOf('lookupRecords'));
  for (const id of ['GFS_Calc', 'GFS_Seen']) {
    const formula = model.helperColumns().find(column => column.id === id).formula;
    assert.match(formula, /for rid, i in \(\$GFS_Ids or \[\]\):\n {4}chain\["dossier:moi:" \+ author \+ "\/\/" \+ str\(rid\)\] = 2 \+ i/, `${id} lit les numéros`);
    assert.match(formula, /chain\["dossier:moi:" \+ author \+ "\/" \+ "\/"\.join\(mine\[:i \+ 1\]\)\] = 2 \+ i/, `${id} garde les partages à l'ancienne mode`);
  }
  assert.ok(HELPERS.indexOf('GFS_Ids') > HELPERS.indexOf('GFS_Folder') && HELPERS.indexOf('GFS_Ids') < HELPERS.indexOf('GFS_Calc'), 'la colonne naît avant celles qui la lisent');
  for (const line of ids.formula.split('\n')) assert.equal(line.split('"').length % 2, 1, `guillemets non fermés : ${line}`);
});

test('un partage d\'avant GFS_Ids : la colonne s\'ajoute (additif) et les formules d\'aide sont reprises, comme pour GFS_Seen ; un second passage ne trouve rien', () => {
  const done = applied(base(), planSharing(base(), filesColumns()).actions);
  const old = { ...done, columns: done.columns.filter(col => col.colId !== 'GFS_Ids') };
  const plan = planSharing(old, filesColumns());
  assert.equal(plan.ok, true, 'le partage est à compléter');
  assert.deepEqual(plan.adds, ['GFS_Files.GFS_Ids']);
  const modified = plan.actions.filter(action => action[0] === 'ModifyColumn').map(action => action[2]);
  assert.ok(modified.includes('GFS_Calc') && modified.includes('GFS_Seen'), `les formules qui la lisent sont reprises : ${modified.join(', ')}`);
  assert.equal(planSharing(applied(old, plan.actions), filesColumns()).reason, 'already');
});

test('sharesOf : un dossier se désigne par plusieurs cibles (son numéro, son chemin d\'avant) ; les lignes de toutes viennent, une cible d\'origine liste les siennes', () => {
  const rows = [{ id: 1, Target: 'dossier:moi:a@b.fr//4', Person: 'x@y.fr', Right: 'lecture' }, { id: 2, Target: 'dossier:moi:a@b.fr/Docs', Person: 'z@y.fr', Right: 'lecture' },
    { id: 3, Target: 'dossier:moi:a@b.fr//3', Person: 'p@y.fr', Right: 'ecriture' }, { id: 4, Target: 'dossier:moi:a@b.fr/Autre', Person: 'q@y.fr', Right: 'lecture' }];
  const shares = sharesOf(rows, ['dossier:moi:a@b.fr/Docs/Sous', 'dossier:moi:a@b.fr//4'], [{ kind: 'folder', name: 'Docs', target: ['dossier:moi:a@b.fr/Docs', 'dossier:moi:a@b.fr//3'] }]);
  assert.deepEqual(shares.map(share => [share.id, share.inherited, share.from && share.from.name]), [[1, false, null], [3, true, 'Docs'], [2, true, 'Docs']]);
  assert.deepEqual(sharesOf(rows, 'dossier:moi:a@b.fr//4').map(share => share.id), [1], 'une seule cible en texte : comme avant');
});

test('un document partagé avant les notifications : seule leur table naît, avec ses trois groupes de règles, et rien d\'autre ne bouge ; le retrait du partage retire aussi ces règles', () => {
  const done = applied(withFiles(), planSharing(withFiles(), filesColumns()).actions);
  const gone = new Set(['GFS_Notifications']);
  const goneResources = done.resources.filter(row => gone.has(row.tableId)).map(row => row.id);
  const old = { ...done, tables: done.tables.filter(row => !gone.has(row.tableId)), resources: done.resources.filter(row => !goneResources.includes(row.id)),
    rules: done.rules.filter(rule => !goneResources.includes(rule.resource)) };
  const plan = planSharing(old, filesColumns());
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.creates, ['GFS_Notifications']);
  assert.deepEqual(plan.actions.filter(action => action[0] === 'AddTable').map(action => action[1]), ['GFS_Notifications']);
  assert.deepEqual(plan.actions.filter(action => action[1] === '_grist_ACLResources').map(action => action[3].colIds), ['Recipient,Type,Target,By,Key,When', 'Read', '*']);
  assert.equal(plan.actions.some(action => action[0] === 'BulkRemoveRecord' || action[0] === 'ModifyColumn'), false, 'aucune règle ni formule d\'avant n\'est touchée');
  const after = applied(old, plan.actions);
  assert.equal(planSharing(after, filesColumns()).reason, 'already');
  const off = applied(after, planUnsharing(after).actions);
  assert.equal(off.rules.some(rule => String(rule.memo).includes('notification')), false, 'le retrait enlève les règles des notifications avec les autres');
});
