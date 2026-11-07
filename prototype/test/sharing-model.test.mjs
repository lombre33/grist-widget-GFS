// Le modèle de « Partager » (js/sharing-model.js ; contrats 11.7, point 13) : la table de partages, les colonnes d'aide, les règles, le plan d'activation et de retrait, la ligne d'un partage.
// Ce que Grist en fait (l'auteur écrit par lui, les règles lisant les colonnes-formules, un administrateur qui partage sans propriétaire) se mesure dans un vrai Grist : labo/run-partager.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planSharing, planUnsharing, shareColumns, helperColumns, fileRules, shareRules, stampRules, shareRecord, sharesOf, isSharingNote, sharingActive, TARGETS, SHARES_TABLE, HELPERS, targetsOf, appTargets } from '../js/sharing-model.js';
import { FILES_COLUMNS } from '../js/gfs-files.js';
import { levelOfNote } from '../js/rights.js';

const BUILT_IN = { id: 1, resource: 1, permissions: 63, principals: '[1]', aclFormula: '', aclColumn: 0, permissionsText: '', rulePos: null, memo: '' };
const base = () => ({ resources: [{ id: 1, tableId: '', colIds: '' }], rules: [{ ...BUILT_IN }], tables: [], columns: [] });
const withFiles = (extra = []) => ({ ...base(), tables: [{ id: 7, tableId: 'GFS_Fichiers' }], columns: [{ parentId: 7, colId: 'Identifiant' }, { parentId: 7, colId: 'Auteur' }, ...extra] });
const applied = (existing, actions) => {
  const next = { ...existing, resources: [...existing.resources], rules: [...existing.rules], tables: [...existing.tables], columns: [...existing.columns] };
  for (const [name, table, id, values] of actions) {
    if (name === 'AddTable') {
      const added = { id: 100 + next.tables.length, tableId: table };
      next.tables.push(added);
      for (const column of values === undefined ? id : []) next.columns.push({ parentId: added.id, colId: column.id });
    }
    if (name === 'AddColumn') next.columns.push({ parentId: next.tables.find(row => row.tableId === table).id, colId: id });
    if (name === 'AddRecord' && table === '_grist_ACLResources') next.resources.push({ id, ...values });
    if (name === 'AddRecord' && table === '_grist_ACLRules') next.rules.push({ id, ...values });
    if (name === 'BulkRemoveRecord' && table === '_grist_ACLRules') next.rules = next.rules.filter(rule => !id.includes(rule.id));
    if (name === 'BulkRemoveRecord' && table === '_grist_ACLResources') next.resources = next.resources.filter(resource => !id.includes(resource.id));
  }
  return next;
};

test('les colonnes de la table de partages : l\'auteur et son rôle sont écrits par Grist (formule déclenchée à la création, jamais ensuite)', () => {
  const columns = shareColumns();
  for (const id of ['Auteur', 'AuteurAcces']) {
    const found = columns.find(column => column.id === id);
    assert.equal(found.isFormula, false);
    assert.equal(found.recalcWhen, 0);
    assert.equal(found.recalcDeps, null);
  }
  assert.equal(columns.find(column => column.id === 'Auteur').formula, 'user.Email');
  for (const id of ['PersonneL', 'Actif', 'Valide1', 'AdminsBase', 'Valide', 'AdminsCible']) assert.equal(columns.find(column => column.id === id).isFormula, true, id);
});

test('les formules sont du Python valide : aucune ligne de tête n\'est indentée (l\'indentation d\'un seul bloc cassait `Valide` : mesuré)', () => {
  const columns = [...shareColumns(), ...TARGETS.flatMap(target => helperColumns(target))].filter(column => column.isFormula);
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

test('les colonnes d\'aide d\'une table de fichiers : cinq, du nom que lisent les règles ; l\'auteur du fichier est toujours dans les trois listes d\'adresses', () => {
  const columns = helperColumns(TARGETS[0]);
  assert.deepEqual(columns.map(column => column.id), [...HELPERS]);
  for (const id of ['GFS_Lecteurs', 'GFS_Ecrivains', 'GFS_Admins']) assert.match(columns.find(column => column.id === id).formula, /str\(\$Auteur\)\.strip\(\)\.lower\(\)/);
  assert.match(columns.find(column => column.id === 'GFS_Admins').formula, /\("admin",\)/);
  assert.match(columns[0].formula, /GFS_Partages\.lookupRecords\(Cible="gfs-fichiers:" \+ str\(\$Identifiant\)\)/);
});

test('les règles d\'une table de fichiers : propriétaires d\'abord, création à son nom, le reste refusé en dernier ; chacune a sa note « GFS : Partages »', () => {
  const rules = fileRules();
  assert.equal(rules[0].formula, 'user.Access in [OWNER]');
  assert.equal(rules[0].rights, '+CRUD');
  assert.deepEqual(rules.at(-1), { formula: '', rights: '-CRUD', memo: rules.at(-1).memo });
  assert.ok(rules.every(rule => isSharingNote(rule.memo)));
  assert.match(rules.find(rule => rule.rights === '+C').formula, /newRec\.Auteur\.lower\(\) == user\.Email\.lower\(\)/);
  assert.ok(rules.every(rule => !/\bnow\b|NOW|TODAY|lookup/.test(rule.formula)), 'une règle ne lit que `rec` et `newRec`');
});

test('les règles de la table de partages : création à son nom ET avec son rôle (mesuré : Grist garde l\'auteur qu\'on lui donne), lecture de ce qui nous concerne', () => {
  const create = shareRules().find(rule => rule.rights === '+C');
  assert.match(create.formula, /newRec\.Auteur\.lower\(\) == user\.Email\.lower\(\)/);
  assert.match(create.formula, /newRec\.AuteurAcces == user\.Access/);
  assert.ok(shareRules().some(rule => rule.rights === '+R' && /PersonneL == user\.Email\.lower\(\)/.test(rule.formula) && /"@tous"/.test(rule.formula)));
  assert.deepEqual(stampRules().map(rule => rule.rights), ['-U']);
});

test('les notes du partage disent « Encadré » au panneau (les tables sont protégées par des règles de GFS), jamais « Partagé » (le niveau du rangement)', () => {
  for (const rule of [...fileRules(), ...shareRules(), ...stampRules()]) assert.equal(levelOfNote(rule.memo), 'encadre', rule.memo);
});

test('activer le partage sur un document neuf : les deux tables, les règles, la première règle du document', () => {
  const plan = planSharing(base(), FILES_COLUMNS);
  assert.equal(plan.ok, true);
  assert.equal(plan.firstRule, true);
  assert.deepEqual(plan.creates, [SHARES_TABLE, 'GFS_Rangement', 'GFS_Fichiers', 'GFS_Groupes']);
  assert.deepEqual(plan.actions.filter(action => action[0] === 'AddTable').map(action => action[1]), ['GFS_Groupes', 'GFS_Fichiers', 'GFS_Rangement', SHARES_TABLE], 'les groupes d\'abord : les colonnes d\'aide les lisent');
  const created = plan.actions.find(action => action[1] === 'GFS_Fichiers')[2];
  assert.deepEqual(created.map(column => column.id), [...FILES_COLUMNS.map(column => column.id), ...HELPERS]);
  const resources = plan.actions.filter(action => action[1] === '_grist_ACLResources').map(action => action[3]);
  assert.deepEqual(resources.map(resource => `${resource.tableId}/${resource.colIds}`), [`${SHARES_TABLE}/Auteur,AuteurAcces`, `${SHARES_TABLE}/*`, 'GFS_Groupes/Nom,NomL,Nb,Source', 'GFS_Groupes/*', 'GFS_Fichiers/*']);
  assert.ok(plan.actions.findIndex(action => action[0] === 'AddTable') < plan.actions.findIndex(action => action[1] === '_grist_ACLResources'), 'les tables avant les règles');
});

test('le rangement naît avec le partage s\'il manque (sans lui, GFS ne connaît pas l\'adresse d\'un éditeur et son PDF serait refusé), et n\'est pas recréé s\'il est là', () => {
  const without = planSharing(base(), FILES_COLUMNS);
  assert.ok(without.actions.some(action => action[0] === 'AddTable' && action[1] === 'GFS_Rangement' && action[2].some(column => column.id === 'Adresse')));
  const there = planSharing({ ...base(), tables: [{ id: 3, tableId: 'GFS_Rangement' }] }, FILES_COLUMNS);
  assert.ok(!there.creates.includes('GFS_Rangement') && !there.actions.some(action => action[0] === 'AddTable' && action[1] === 'GFS_Rangement'));
});

test('les règles se posent aux numéros qui suivent ceux en place, dans l\'ordre, sur la bonne ressource', () => {
  const existing = { ...base(), resources: [{ id: 1, tableId: '', colIds: '' }, { id: 4, tableId: 'Autre', colIds: '*' }], rules: [{ ...BUILT_IN }, { id: 9, resource: 4, aclFormula: '', permissionsText: '+R', memo: 'à la main' }] };
  const plan = planSharing(existing, FILES_COLUMNS);
  assert.equal(plan.ok, true);
  assert.equal(plan.firstRule, false, 'une règle à la main est déjà là : ce n\'est pas la première');
  const rules = plan.actions.filter(action => action[1] === '_grist_ACLRules');
  assert.equal(rules[0][2], 10);
  const sharesResource = plan.actions.find(action => action[1] === '_grist_ACLResources' && action[3].colIds === '*' && action[3].tableId === SHARES_TABLE)[2];
  assert.deepEqual(rules.filter(action => action[3].resource === sharesResource).map(action => action[3].rulePos), [1, 2, 3, 4, 5, 6]);
});

test('une table de fichiers déjà là : seules les colonnes d\'aide manquantes sont ajoutées, jamais la table recréée', () => {
  const plan = planSharing(withFiles(), FILES_COLUMNS);
  assert.deepEqual(plan.creates, [SHARES_TABLE, 'GFS_Rangement', 'GFS_Groupes']);
  assert.deepEqual(plan.actions.filter(action => action[0] === 'AddColumn').map(action => action[2]), [...HELPERS]);
  const some = planSharing(withFiles([{ parentId: 7, colId: 'GFS_Lecteurs' }]), FILES_COLUMNS);
  assert.ok(!some.actions.some(action => action[0] === 'AddColumn' && action[2] === 'GFS_Lecteurs'));
  assert.equal(some.adds.length, HELPERS.length - 1);
});

test('refus : déjà activé ; une règle d\'un autre auteur sur une de ces tables', () => {
  const done = applied(base(), planSharing(base(), FILES_COLUMNS).actions);
  assert.deepEqual(planSharing(done, FILES_COLUMNS), { ok: false, reason: 'already' });
  const foreign = { ...withFiles(), resources: [{ id: 1, tableId: '', colIds: '' }, { id: 2, tableId: 'GFS_Fichiers', colIds: '*' }], rules: [{ ...BUILT_IN }, { id: 2, resource: 2, aclFormula: '', permissionsText: '-D', memo: 'écrite à la main' }] };
  assert.deepEqual(planSharing(foreign, FILES_COLUMNS), { ok: false, reason: 'foreign' });
});

test('retirer : les règles de partage et leurs ressources, rien d\'autre ; les tables restent ; un second retrait n\'a plus rien à faire', () => {
  const hand = { id: 50, resource: 1, aclFormula: 'user.Access != OWNER', permissionsText: '-S', memo: 'GFS : Structure fermée · …' };
  const done = applied({ ...base(), rules: [{ ...BUILT_IN }, hand] }, planSharing(base(), FILES_COLUMNS).actions);
  assert.equal(sharingActive(done.tables), true);
  const plan = planUnsharing(done);
  assert.equal(plan.ok, true);
  const after = applied(done, plan.actions);
  assert.deepEqual(after.rules.map(rule => rule.id).sort((a, b) => a - b), [1, 50]);
  assert.deepEqual(after.resources.map(resource => resource.id), [1]);
  assert.equal(sharingActive(after.tables), true);
  assert.equal(planUnsharing(after).reason, 'none');
});

test('la ligne d\'un partage : le droit, la personne nettoyée, la fin ; refus d\'un droit inconnu ou d\'une personne vide ; jamais l\'auteur (Grist l\'écrit)', () => {
  assert.deepEqual(shareRecord({ target: 'gfs-fichiers:f1', who: '  Marie@Exemple.fr ', right: 'ecriture', download: true, end: 1800000000 }), { Cible: 'gfs-fichiers:f1', Personne: 'Marie@Exemple.fr', Droit: 'ecriture', Telecharger: true, Fin: 1800000000 });
  assert.equal(shareRecord({ target: 'gfs-fichiers:f1', who: '', right: 'lecture' }), null);
  assert.equal(shareRecord({ target: 'gfs-fichiers:f1', who: 'a@b.fr', right: 'depot' }), null, 'le dépôt seul attend sa table');
  assert.ok(!('Auteur' in shareRecord({ target: 'x', who: 'a@b.fr', right: 'lecture' })));
});

test('ce que la fenêtre lit : les lignes de la cible et la racine (héritée), triées, avec leur validité', () => {
  const rows = [
    { id: 3, Cible: '*', Personne: '@tous', Droit: 'lecture' }, { id: 1, Cible: 'gfs-fichiers:f1', Personne: 'zoe@x.fr', Droit: 'admin', Valide: true },
    { id: 2, Cible: 'gfs-fichiers:f1', Personne: 'ann@x.fr', Droit: 'lecture', Valide: false, Fin: 100 }, { id: 4, Cible: 'gfs-fichiers:f2', Personne: 'autre@x.fr', Droit: 'lecture' },
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
  const [files, pp, other] = targetsOf([PP, ids]);
  assert.equal(files.table, 'GFS_Fichiers');
  assert.deepEqual([pp.table, pp.prefix, pp.id, pp.author, pp.stamped], ['Publipostage_Modeles', 'publipostage:', null, 'GFS_Auteur', true]);
  assert.equal(pp.open, 'rec.TypeModele in ("reglages",)');
  assert.deepEqual([other.id, other.open], ['Jeton', '']);
  assert.deepEqual(appTargets([{ id: 'x' }, { id: 'y', fichiers: [{}] }]), []);
});

test('une table d\'app : GFS pose sa colonne d\'auteur (écrite par Grist) et les colonnes d\'aide, lit la ligne par son numéro, ouvre les lignes de réglages', () => {
  const [, pp] = targetsOf([PP]);
  const columns = helperColumns(pp);
  assert.deepEqual(columns.map(column => column.id), ['GFS_Auteur', ...HELPERS]);
  assert.equal(columns[0].isFormula, false);
  assert.equal(columns[0].recalcWhen, 0);
  assert.match(columns[1].formula, /Cible="publipostage:" \+ str\(\$id\)/);
  assert.match(columns[1].formula, /\$GFS_Auteur/);
  const share = shareColumns(targetsOf([PP])).find(column => column.id === 'AdminsBase').formula;
  assert.match(share, /lookupOne\(id=int\(raw\)\) if raw\.isdigit\(\) else None/);
  assert.match(share, /found\.GFS_Auteur/);
  const rules = fileRules(pp);
  assert.deepEqual(rules.map(rule => rule.rights), ['+CRUD', '+R', '+UD', '+CRUD', '+RU', '+R', '+C', '-CRUD']);
  assert.match(rules[1].formula, /^rec\.TypeModele in \("reglages",\)$/);
  assert.match(rules.find(rule => rule.rights === '+C').formula, /newRec\.GFS_Auteur\.lower\(\) == user\.Email\.lower\(\)/);
  assert.equal(fileRules().length, 6, 'sans lignes exclues : les six règles d\'avant');
});

test('activer avec une app : ses colonnes, ses règles (la colonne d\'auteur gardée), ses modèles d\'avant lisibles de tous ; une table d\'app absente est laissée', () => {
  const plan = planSharing({ ...withApp(), targets: targetsOf([PP, ids]) }, FILES_COLUMNS);
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.appTables, ['Publipostage_Modeles']);
  assert.deepEqual(plan.adds, ['Publipostage_Modeles.GFS_Auteur', ...HELPERS.map(id => `Publipostage_Modeles.${id}`)]);
  assert.equal(plan.legacy, 2);
  const legacy = plan.actions.find(action => action[0] === 'BulkAddRecord');
  assert.deepEqual(legacy[3].Cible, ['publipostage:3', 'publipostage:5']);
  const resources = plan.actions.filter(action => action[1] === '_grist_ACLResources').map(action => `${action[3].tableId}/${action[3].colIds}`);
  assert.deepEqual(resources, [`${SHARES_TABLE}/Auteur,AuteurAcces`, `${SHARES_TABLE}/*`, 'GFS_Groupes/Nom,NomL,Nb,Source', 'GFS_Groupes/*', 'GFS_Fichiers/*', 'Publipostage_Modeles/GFS_Auteur', 'Publipostage_Modeles/*']);
  assert.ok(!plan.actions.some(action => action[0] === 'AddTable' && action[1] === 'Autre_Fichiers'));
});

test('une règle d\'un autre auteur sur la table d\'une app : cette table est laissée (dite), le reste s\'active ; ajouter une app plus tard complète sans refaire le reste', () => {
  const hand = { id: 9, resource: 4, aclFormula: '', permissionsText: '-D', memo: 'écrite à la main' };
  const foreign = withApp({ resources: [{ id: 1, tableId: '', colIds: '' }, { id: 4, tableId: 'Publipostage_Modeles', colIds: '*' }], rules: [{ ...BUILT_IN }, hand] });
  const first = planSharing(foreign, FILES_COLUMNS);
  assert.equal(first.ok, true);
  assert.deepEqual([first.appTables, first.skipped], [[], ['Publipostage_Modeles']]);
  const done = applied(base(), planSharing(base(), FILES_COLUMNS).actions);
  assert.equal(planSharing(done, FILES_COLUMNS).reason, 'already');
  const later = { ...done, tables: [...done.tables, { id: 7, tableId: 'Publipostage_Modeles' }], columns: [...done.columns, { parentId: 7, colId: 'Nom' }], targets: targetsOf([PP]), files: { Publipostage_Modeles: [1] } };
  const extension = planSharing(later, FILES_COLUMNS);
  assert.equal(extension.ok, true);
  assert.equal(extension.extends, true);
  assert.deepEqual(extension.appTables, ['Publipostage_Modeles']);
  assert.ok(!extension.actions.some(action => action[0] === 'AddTable'));
  assert.ok(extension.actions.some(action => action[0] === 'ModifyColumn' && action[2] === 'AdminsBase' && /publipostage:/.test(action[3].formula)), 'la formule des administrateurs apprend la table');
  assert.ok(!extension.actions.some(action => action[1] === '_grist_ACLResources' && /^GFS_Partages/.test(action[3].tableId)), 'les règles des partages ne sont pas reposées');
  assert.equal(planSharing(applied(later, extension.actions), FILES_COLUMNS).reason, 'already');
});

test('après un retrait, activer de nouveau repose les règles sans recréer les tables ni les colonnes', () => {
  const done = applied(base(), planSharing(base(), FILES_COLUMNS).actions);
  const removed = applied(done, planUnsharing(done).actions);
  const again = planSharing(removed, FILES_COLUMNS);
  assert.equal(again.ok, true);
  assert.deepEqual([again.creates, again.adds], [[], []]);
  assert.ok(again.actions.some(action => action[1] === '_grist_ACLResources' && action[3].tableId === SHARES_TABLE));
});

// Les groupes (lot 3) : un partage cible `#nom`, les colonnes d'aide développent les membres, la table des groupes naît avec le partage.
import * as model from '../js/sharing-model.js';

test('les colonnes d\'un groupe : nom, nom minuscule, adresses tapées, source, membres et nombre calculés par Grist', () => {
  const ids = model.groupColumns().map(item => item.id);
  assert.deepEqual(ids, ['Nom', 'NomL', 'PersonnesIci', 'Source', 'SourceEmail', 'SourceGroupe', 'Membres', 'Nb']);
  const members = model.groupColumns().find(item => item.id === 'Membres');
  assert.equal(members.isFormula, true);
  assert.match(members.formula, /^out = set\(/);
  assert.ok(!members.formula.startsWith(' '), 'aucune ligne de tête indentée');
});

test('un groupe lu d\'une table : la formule des membres relit la table et la colonne, jamais un identifiant douteux', () => {
  const one = model.planGroupSources([{ table: 'Contacts', email: 'Mail', group: 'Equipe' }]).actions[0];
  assert.deepEqual(one.slice(0, 3), ['ModifyColumn', 'GFS_Groupes', 'Membres']);
  assert.match(one[3].formula, /Contacts\.lookupRecords\(Equipe=\$Nom\)/);
  assert.match(one[3].formula, /r\.Mail/);
  const bad = model.planGroupSources([{ table: 'Contacts"; import os', email: 'Mail', group: 'Equipe' }]).actions[0][3].formula;
  assert.doesNotMatch(bad, /import os/);
  assert.deepEqual(model.sourcesOf([{ Source: 'Contacts', SourceEmail: 'Mail', SourceGroupe: 'Equipe' }, { Source: 'Contacts', SourceEmail: 'Mail', SourceGroupe: 'Equipe' }, { Source: 'x y', SourceEmail: 'a', SourceGroupe: 'b' }, { Source: '' }]), [{ table: 'Contacts', email: 'Mail', group: 'Equipe' }]);
});

test('les colonnes d\'aide d\'un fichier développent un groupe par ses membres (une règle ne lit pas une autre table)', () => {
  const readers = model.helperColumns(TARGETS[0]).find(item => item.id === 'GFS_Lecteurs');
  assert.match(readers.formula, /GFS_Groupes\.lookupOne\(NomL=p\.PersonneL\[1:\]\)\.Membres/);
  assert.match(readers.formula, /startswith\("#"\)/);
});

test('les règles de la table des groupes : les propriétaires font tout, un éditeur lit nom, nombre et source, le reste est refusé', () => {
  assert.deepEqual(model.groupRules().map(item => [item.formula, item.rights]), [['user.Access in [OWNER]', '+CRUD'], ['', '-CRUD']]);
  assert.deepEqual(model.groupPublicRules().map(item => [item.formula, item.rights]), [['user.Access in [EDITOR]', '+R']]);
  assert.equal(model.GROUP_PUBLIC, 'Nom,NomL,Nb,Source');
  assert.ok(!model.GROUP_PUBLIC.includes('Membres') && !model.GROUP_PUBLIC.includes('PersonnesIci'), 'jamais les adresses');
});

test('un document déjà partagé avant les groupes : la table naît, les colonnes d\'aide sont relues, les règles se posent', () => {
  const first = planSharing(withFiles(), FILES_COLUMNS);
  const old = applied(withFiles(), first.actions.filter(action => action[1] !== 'GFS_Groupes' && !(action[0] === 'AddRecord' && action[3] && action[3].tableId === 'GFS_Groupes')));
  // on simule l'état d'avant : tout posé sauf la table des groupes et ses règles
  const noGroups = { ...old, tables: old.tables.filter(row => row.tableId !== 'GFS_Groupes'), resources: old.resources.filter(row => row.tableId !== 'GFS_Groupes') };
  noGroups.rules = noGroups.rules.filter(rule => noGroups.resources.some(res => res.id === rule.resource));
  const plan = planSharing(noGroups, FILES_COLUMNS);
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.creates, ['GFS_Groupes']);
  assert.equal(plan.actions[0][0], 'AddTable');
  assert.ok(plan.actions.some(action => action[0] === 'ModifyColumn' && action[2] === 'GFS_Lecteurs'), 'les colonnes d\'aide relisent les groupes');
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
  assert.deepEqual(model.groupRecord({ name: 'Achats', people: ' a@x.fr\nb@x.fr ' }), { Nom: 'Achats', PersonnesIci: 'a@x.fr\nb@x.fr', Source: '', SourceEmail: '', SourceGroupe: '' });
  assert.equal(model.groupRecord({ name: 'Achats', source: { table: 'C', email: 'M; x', group: 'G' } }), null);
  const add = model.planGroupAdd([{ Nom: 'Compta' }], model.groupRecord({ name: 'Achats', people: 'a@x.fr' }));
  assert.deepEqual(add.actions.map(action => action[0]), ['AddRecord']);
  assert.equal(model.planGroupAdd([{ Nom: 'achats' }], model.groupRecord({ name: 'Achats' })).reason, 'exists');
  const fromTable = model.planGroupAdd([{ Nom: 'Compta', Source: 'C', SourceEmail: 'M', SourceGroupe: 'G' }], model.groupRecord({ name: 'Achats', source: { table: 'D', email: 'E', group: 'F' } }));
  assert.deepEqual(fromTable.actions.map(action => action[0]), ['ModifyColumn', 'AddRecord']);
  assert.match(fromTable.actions[0][3].formula, /C\.lookupRecords[\s\S]*D\.lookupRecords/, 'les anciennes sources restent');
  assert.deepEqual(model.groupsOf([{ id: 2, Nom: 'b', Nb: 3, Source: 'C' }, { id: 1, Nom: 'a', Nb: '2' }, { id: 3, Nom: '' }]).map(group => [group.name, group.count]), [['a', 2], ['b', 3]]);
});

test('lire les groupes d\'une table : un groupe par valeur distincte, les noms pris ou douteux laissés, une seule formule relue', () => {
  const source = { table: 'Contacts', email: 'Mail', group: 'Equipe' };
  const plan = model.planGroupsRead([{ Nom: 'Compta' }], source, ['Achats', 'achats', 'Compta', '@x', '', 'Ventes']);
  assert.equal(plan.ok, true);
  assert.equal(plan.added, 2);
  assert.deepEqual(plan.actions.map(action => action[0]), ['ModifyColumn', 'BulkAddRecord']);
  assert.deepEqual(plan.actions[1][3].Nom, ['Achats', 'Ventes']);
  assert.deepEqual(plan.actions[1][3].Source, ['Contacts', 'Contacts']);
  assert.equal(model.planGroupsRead([], source, ['', null]).reason, 'none');
  assert.equal(model.planGroupsRead([], { ...source, table: 'a b' }, ['x']).reason, 'invalid');
});

test('la formule des membres est du Python : aucun saut de ligne dans une chaîne (le « \\n » du texte reste deux signes), ni dans la formule de groupes lus', () => {
  const sources = [{ table: 'Contacts', email: 'Mail', group: 'Equipe' }];
  for (const formula of [model.groupColumns().find(item => item.id === 'Membres').formula, model.planGroupSources(sources).actions[0][3].formula]) {
    assert.match(formula, /split\("\\n"\)/);
    for (const line of formula.split('\n')) assert.equal(line.split('"').length % 2, 1, `guillemets non fermés : ${line}`);
  }
});
