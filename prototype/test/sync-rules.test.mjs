// Les règles des tables techniques du partage entre documents (js/sync-rules.js ; audit de sécurité du 09/11) : `GFS_Synchro` et les journaux reçus ne se lisent qu'avec les droits de propriétaire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planTechnicalRules, technicalRules, closeSharingTables, isTechnical, isJournal } from '../js/sync-rules.js';
import { isSharingNote } from '../js/sharing-model.js';
import { levelOfNote, tableLevels, userRules } from '../js/rights.js';

const tables = names => names.map((tableId, at) => ({ id: at + 1, tableId }));
const world = (names, resources = [], rules = []) => ({ tables: tables(names), resources, rules });

test('les tables techniques sont GFS_Synchro et les journaux reçus, pas les tables de Sync+ lui-même', () => {
  assert.equal(isTechnical('GFS_Synchro'), true);
  assert.equal(isTechnical('GFS_Journal_Facture'), true);
  assert.equal(isJournal('GFS_Journal_Facture'), true);
  assert.equal(isTechnical('GFS_Recus'), false, 'les fichiers reçus restent lisibles : « Partagés avec moi » les montre (carte 4c)');
  assert.equal(isTechnical('GFS_Fichiers'), false);
  assert.equal(isTechnical('Synchro'), false);
  assert.equal(isTechnical('Journal_Facture'), false);
});

test('GFS_Synchro est fermée aux non-propriétaires ; un journal garde la création ouverte (c\'est par elle que le formulaire y écrit)', () => {
  const synchro = technicalRules('GFS_Synchro');
  assert.deepEqual(synchro.map(each => [each.formula, each.rights]), [['user.Access in [OWNER]', '+CRUD'], ['', '-CRUD']]);
  const journal = technicalRules('GFS_Journal_Facture');
  assert.deepEqual(journal.map(each => [each.formula, each.rights]), [['user.Access in [OWNER]', '+CRUD'], ['', '-RUD']]);
  for (const each of [...synchro, ...journal]) {
    assert.ok(isSharingNote(each.memo), `la note est celle des règles de « Partager » : ${each.memo}`);
    assert.equal(levelOfNote(each.memo), 'encadre', 'le pied dit « Encadré », comme pour les fichiers');
  }
});

test('un document sans table technique : rien à poser', () => {
  assert.deepEqual(planTechnicalRules(world(['Clients', 'GFS_Fichiers', 'GFS_Recus'])), { ok: false, reason: 'none' });
});

test('les règles se posent sur chaque table technique, avec leurs ressources, en une liasse', () => {
  const plan = planTechnicalRules(world(['Clients', 'GFS_Synchro', 'GFS_Journal_A', 'GFS_Journal_B']));
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.tables, ['GFS_Synchro', 'GFS_Journal_A', 'GFS_Journal_B']);
  const resources = plan.actions.filter(action => action[1] === '_grist_ACLResources');
  const rules = plan.actions.filter(action => action[1] === '_grist_ACLRules');
  assert.deepEqual(resources.map(action => action[3].tableId), plan.tables);
  assert.ok(resources.every(action => action[3].colIds === '*'));
  assert.equal(rules.length, 6);
  assert.deepEqual(rules.filter(action => action[3].resource === resources[0][2]).map(action => action[3].rulePos), [1, 2]);
  assert.equal(new Set(plan.actions.map(action => `${action[1]}#${action[2]}`)).size, plan.actions.length, 'aucun identifiant n\'est pris deux fois');
});

test('les identifiants continuent après ceux qui existent déjà', () => {
  const resources = [{ id: 7, tableId: 'Clients', colIds: '*' }];
  const rules = [{ id: 12, resource: 7, aclFormula: 'user.Access in [OWNER]', permissionsText: '+CRUD', rulePos: 1, memo: 'à la main' }];
  const plan = planTechnicalRules(world(['Clients', 'GFS_Synchro'], resources, rules));
  assert.deepEqual(plan.actions.filter(action => action[1] === '_grist_ACLResources').map(action => action[2]), [8]);
  assert.deepEqual(plan.actions.filter(action => action[1] === '_grist_ACLRules').map(action => action[2]), [13, 14]);
});

test('rien ne se repose quand tout est posé, rien ne se touche d\'une règle d\'un autre auteur', () => {
  const first = planTechnicalRules(world(['GFS_Synchro', 'GFS_Journal_A']));
  const posed = {
    tables: tables(['GFS_Synchro', 'GFS_Journal_A']),
    resources: first.actions.filter(action => action[1] === '_grist_ACLResources').map(action => ({ id: action[2], ...action[3] })),
    rules: first.actions.filter(action => action[1] === '_grist_ACLRules').map(action => ({ id: action[2], ...action[3] })),
  };
  assert.deepEqual(planTechnicalRules(posed), { ok: false, reason: 'already' }, 'un second passage ne fait rien : Grist ne recharge pas le document pour rien');
  const foreign = world(['GFS_Synchro'], [{ id: 1, tableId: 'GFS_Synchro', colIds: '*' }], [{ id: 1, resource: 1, aclFormula: 'user.Email == "x@y"', permissionsText: '+R', rulePos: 1, memo: 'écrite par une personne' }]);
  assert.deepEqual(planTechnicalRules(foreign), { ok: false, reason: 'foreign' });
});

test('une table pose ses règles même quand une autre porte celles d\'un autre auteur', () => {
  const existing = world(['GFS_Synchro', 'GFS_Journal_A'], [{ id: 1, tableId: 'GFS_Synchro', colIds: '*' }], [{ id: 1, resource: 1, aclFormula: '', permissionsText: '-C', rulePos: 1, memo: '' }]);
  const plan = planTechnicalRules(existing);
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.tables, ['GFS_Journal_A']);
  assert.ok(!plan.actions.some(action => action[0].startsWith('BulkRemove')), 'la règle de l\'autre auteur reste');
});

test('des règles de GFS d\'avant, différentes, sont remplacées avec leur ressource vide', () => {
  const resources = [{ id: 3, tableId: 'GFS_Synchro', colIds: '*' }];
  const rules = [{ id: 5, resource: 3, aclFormula: '', permissionsText: '-R', rulePos: 1, memo: 'GFS : Partages · ancienne' }];
  const plan = planTechnicalRules(world(['GFS_Synchro'], resources, rules));
  assert.deepEqual(plan.actions[0], ['BulkRemoveRecord', '_grist_ACLRules', [5]]);
  assert.deepEqual(plan.actions[1], ['BulkRemoveRecord', '_grist_ACLResources', [3]]);
  assert.equal(plan.actions.filter(action => action[0] === 'AddRecord' && action[1] === '_grist_ACLRules').length, 2);
});

test('le pied compte les tables techniques comme « encadrées »', () => {
  const plan = planTechnicalRules(world(['GFS_Synchro', 'GFS_Journal_A']));
  const resources = plan.actions.filter(action => action[1] === '_grist_ACLResources').map(action => ({ id: action[2], ...action[3] }));
  const rules = plan.actions.filter(action => action[1] === '_grist_ACLRules').map(action => ({ id: action[2], ...action[3] }));
  assert.deepEqual([...tableLevels(userRules(resources, rules), ['GFS_Synchro', 'GFS_Journal_A'])], [['GFS_Synchro', 'encadre'], ['GFS_Journal_A', 'encadre']]);
});

const docOf = (rows, applied) => ({
  fetchTable: async name => {
    const list = rows[name] || [];
    const keys = [...new Set(list.flatMap(row => Object.keys(row)))];
    return Object.fromEntries(keys.map(key => [key, list.map(row => row[key])]));
  },
  applyUserActions: async actions => { applied.push(actions); },
});

test('closeSharingTables écrit la liasse une fois, puis ne fait plus rien', async () => {
  const applied = [];
  const rows = { _grist_ACLResources: [], _grist_ACLRules: [], _grist_Tables: tables(['GFS_Synchro']) };
  const first = await closeSharingTables({ docApi: docOf(rows, applied) });
  assert.deepEqual(first, { changed: true, tables: ['GFS_Synchro'] });
  assert.equal(applied.length, 1);
  rows._grist_ACLResources = applied[0].filter(action => action[1] === '_grist_ACLResources').map(action => ({ id: action[2], ...action[3] }));
  rows._grist_ACLRules = applied[0].filter(action => action[1] === '_grist_ACLRules').map(action => ({ id: action[2], ...action[3] }));
  assert.deepEqual(await closeSharingTables({ docApi: docOf(rows, applied) }), { changed: false, tables: [] });
  assert.equal(applied.length, 1, 'rien de plus écrit');
});

test('un échec de lecture ou d\'écriture est dit en avertissement et ne lève rien', async () => {
  const warned = [];
  const original = console.warn;
  console.warn = (...args) => warned.push(args);
  try {
    const broken = { fetchTable: async () => { throw new Error('Access not granted'); }, applyUserActions: async () => {} };
    assert.deepEqual(await closeSharingTables({ docApi: broken }), { changed: false, tables: [] });
    const refusing = { ...docOf({ _grist_ACLResources: [], _grist_ACLRules: [], _grist_Tables: tables(['GFS_Synchro']) }, []), applyUserActions: async () => { throw new Error('refusé'); } };
    assert.deepEqual(await closeSharingTables({ docApi: refusing }), { changed: false, tables: [] });
  } finally { console.warn = original; }
  assert.equal(warned.length, 2);
});
