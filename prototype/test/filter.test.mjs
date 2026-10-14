// Le filtre du courtier (contrats 3.2 à 3.4), avec les vrais manifestes de Publipostage+ et d'Automation+.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkBatch, readRefusal, writeRefusal, visibleTables, cleanApplyOptions, realNameRefusal, tokenOptions, classify,
  lowestAccess, batchTouchesTables } from '../js/filter.js';
import { policyOf, publipostage, automation } from './helpers.mjs';

const pp = policyOf(publipostage());
const au = policyOf(automation());
const refused = (policy, actions, ctx) => { const r = checkBatch(policy, actions, ctx); assert.equal(r.ok, false, JSON.stringify(actions)); return r; };
const allowed = (policy, actions, ctx) => { const r = checkBatch(policy, actions, ctx); assert.equal(r.ok, true, `${JSON.stringify(actions)} : ${r.reason}`); };

test('contrats 3.2 point 2 : « * » désigne les tables de la personne, jamais GFS_, une autre app ni _grist_', () => {
  assert.equal(classify(pp, 'Clients'), 'personne');
  assert.equal(classify(pp, 'Publipostage_Modeles'), 'propre');
  assert.equal(classify(pp, 'publipostage_modeles'), 'propre');
  assert.equal(classify(pp, '_Publipostage_Modeles'), 'propre');
  assert.equal(classify(pp, 'Automation_Etat'), 'autre-app');
  assert.equal(classify(pp, 'GFS_Rangement'), 'gfs');
  assert.equal(classify(pp, '_grist_Tables'), 'interne');
  assert.equal(readRefusal(pp, 'Clients'), null);
  assert.notEqual(readRefusal(pp, 'GFS_Rangement'), null);
  assert.notEqual(readRefusal(pp, 'Automation_Etat'), null);
  assert.notEqual(readRefusal(au, 'Publipostage_Modeles'), null);
});

test('contrats 3.2 point 4 : une table interne se lit seulement si elle est déclarée ; _grist_Shares et _grist_Triggers jamais', () => {
  assert.equal(readRefusal(pp, '_grist_Tables'), null);
  assert.equal(readRefusal(pp, '_grist_Views_section_field'), null);
  assert.notEqual(readRefusal(pp, '_grist_Shares'), null);
  assert.notEqual(readRefusal(pp, '_grist_Triggers'), null);
  assert.notEqual(readRefusal(au, '_grist_Tables'), null);
});

test('contrats 3.2 point 5 : listTables rend les tables lisibles, triées, sans _grist_ ni GFS_', () => {
  const all = ['Publipostage_Modeles', 'Clients', '', 'GFS_Rangement', 'Automation_Etat', '_grist_Tables', 'Alpha'];
  assert.deepEqual(visibleTables(pp, all), ['Alpha', 'Clients', 'Publipostage_Modeles']);
  assert.deepEqual(visibleTables(au, all), ['Alpha', 'Automation_Etat', 'Clients']);
});

test('contrats 3.3 point 1 : un lot est permis en entier ou refusé en entier, avec le rang de l\'action fautive', () => {
  const r = refused(pp, [['AddRecord', 'Clients', null, { a: 1 }], ['UpdateRecord', 'GFS_Rangement', 1, { a: 1 }]]);
  assert.equal(r.rank, 1);
  allowed(pp, [['AddRecord', 'Clients', null, { a: 1 }], ['BulkUpdateRecord', 'Publipostage_Modeles', [1, 2], { Nom: ['a', 'b'] }]]);
});

test('contrats 3.3 point 2 : verbes en liste fermée', () => {
  for (const verb of ['ApplyDocActions', 'ApplyUndoActions', 'ReplaceTableData', 'RenameColumn', 'ModifyColumn', 'AddView', 'AddViewSection', 'RemoveView', 'RemoveViewSection']) {
    assert.match(refused(pp, [[verb, 'Clients']]).reason, /liste fermée/, verb);
  }
  refused(pp, [['AddRecord']]);
  refused(pp, ['AddRecord']);
  refused(pp, 'AddRecord');
});

test('contrats 3.3 point 3 : jamais GFS_, jamais la table d\'une autre app, même si un motif la nomme', () => {
  refused(au, [['AddRecord', 'Publipostage_Modeles', null, {}]]);
  refused(policyOf({ ...automation(), permissions: { acces: 'full', lit: ['*', 'Publipostage_*'], ecrit: ['Publipostage_*'] } }), [['AddRecord', 'Publipostage_Modeles', null, {}]]);
  refused(pp, [['AddTable', 'GFS_Rangement', [{ id: 'A' }]]]);
  refused(pp, [['RemoveTable', 'GFS_Rangement']]);
  refused(pp, [['RenameTable', 'Clients', 'GFS_Clients']]);
  refused(pp, [['AddColumn', 'GFS_Rangement', 'X', {}]]);
});

test('contrats 3.3 point 4 : un nom est jugé sans « _ » de tête et sans la casse', () => {
  refused(pp, [['AddTable', '_gfs_Rangement', [{ id: 'A' }]]]);
  refused(pp, [['AddTable', 'Automation_Etat2', [{ id: 'A' }]]]);
  refused(pp, [['AddTable', 'GFS Rangement', [{ id: 'A' }]]]);
  refused(pp, [['AddTable', 'GFS-Rangement', [{ id: 'A' }]]]);
  refused(pp, [['AddTable', 'ＧＦＳ_Rangement', [{ id: 'A' }]]]);
  refused(pp, [['AddTable', 'Automation Etat', [{ id: 'A' }]]]);
  refused(pp, [['RenameTable', 'Clients', 'gfs rangement']]);
  allowed(pp, [['AddTable', 'Publipostage_Nouvelle', [{ id: 'A', type: 'Text' }]]]);
  allowed(pp, [['AddTable', 'MesDonnees', [{ id: 'A', type: 'Text' }]]]);
  assert.notEqual(realNameRefusal(pp, 'GFS_Faux'), null);
  assert.notEqual(realNameRefusal(pp, 'Automation_Faux'), null);
  assert.equal(realNameRefusal(pp, 'MesDonnees2'), null);
  assert.equal(batchTouchesTables([['AddTable', 'X', []]]), true);
  assert.equal(batchTouchesTables([['AddRecord', 'X', null, {}]]), false);
});

test('contrats 3.3 point 5 : écriture d\'une table interne par colonne déclarée seulement', () => {
  allowed(pp, [['UpdateRecord', '_grist_Tables_column', 12, { visibleCol: 5 }]]);
  allowed(pp, [['BulkUpdateRecord', '_grist_Pages', [1, 2], { indentation: [0, 1], pagePos: [1, 2], options: ['', ''] }]]);
  assert.match(refused(pp, [['UpdateRecord', '_grist_Tables_column', 12, { visibleCol: 5, colId: 'x' }]]).reason, /colId/);
  assert.match(refused(pp, [['UpdateRecord', '_grist_Tables', 1, { tableId: 'x' }]]).reason, /non déclarée/);
  allowed(policyOf({ ...publipostage(), permissions: { ...publipostage().permissions, gristInterne: [{ tables: ['_grist_Pages'], lit: true, ecrit: ['options'], pourquoi: { fr: 'a', en: 'a' } }] } }),
    [['AddRecord', '_grist_Pages', null, { options: '' }]]);
  assert.match(refused(pp, [['RemoveRecord', '_grist_Pages', 3]]).reason, /retire/);
  refused(pp, [['AddColumn', '_grist_Pages', 'X', {}]]);
  refused(pp, [['AddTable', '_grist_Truc', []]]);
});

test('contrats 3.3 point 5 : un AddOrUpdateRecord compare les clés de require et de col_values', () => {
  allowed(pp, [['AddOrUpdateRecord', 'Clients', { Nom: 'a' }, { Age: 3 }, {}]]);
  const policy = policyOf({ ...publipostage(), permissions: { ...publipostage().permissions, gristInterne: [{ tables: ['_grist_Pages'], lit: true, ecrit: ['pagePos'], pourquoi: { fr: 'a', en: 'a' } }] } });
  assert.match(refused(policy, [['AddOrUpdateRecord', '_grist_Pages', { viewRef: 1 }, { pagePos: 1 }, {}]]).reason, /viewRef/);
});

test('contrats 3.3 point 6 : les sept tables internes et la colonne options ne s\'écrivent jamais, même déclarées', () => {
  const sneaky = table => policyOf({ ...publipostage(), permissions: { acces: 'full', lit: ['*'], gristInterne: [{ tables: [table], lit: true, ecrit: ['x', 'options', 'type'], pourquoi: { fr: 'a', en: 'a' } }] } });
  for (const t of ['_grist_ACLRules', '_grist_ACLResources', '_grist_ACLPrincipals', '_grist_ACLMemberships', '_grist_Shares', '_grist_Triggers', '_grist_DocInfo']) {
    assert.match(refused(sneaky(t), [['UpdateRecord', t, 1, { x: 1 }]]).reason, /jamais écrite/, t);
  }
  assert.match(refused(sneaky('_grist_Views_section'), [['UpdateRecord', '_grist_Views_section', 4, { options: '{}' }]]).reason, /jamais écrite/);
  allowed(sneaky('_grist_Views_section'), [['UpdateRecord', '_grist_Views_section', 4, { x: 1 }]]);
});

test('contrats 3.3 point 7 : seuls desc et parseStrings passent', () => {
  assert.deepEqual(cleanApplyOptions({ desc: 'a', parseStrings: true, extra: 1, onlyIfNotExists: true }), { desc: 'a', parseStrings: true });
  assert.deepEqual(cleanApplyOptions(null), {});
  assert.deepEqual(cleanApplyOptions({ desc: 3 }), {});
});

test('contrats 3.4 point 2 : sans « formules », toute colonne à formule est refusée', () => {
  const noFormulas = policyOf({ ...automation() });
  assert.match(refused(noFormulas, [['AddColumn', 'Clients', 'F', { formula: '$A + 1', isFormula: true }]]).reason, /formules/);
  assert.match(refused(noFormulas, [['AddColumn', 'Clients', 'F', { formula: '$A + 1', isFormula: false }]]).reason, /formules/);
  assert.match(refused(noFormulas, [['AddTable', 'T', [{ id: 'A' }, { id: 'B', formula: '1' }]]]).reason, /formules/);
  assert.match(refused(noFormulas, [['SetDisplayFormula', 'Clients', null, 5, '$B.Nom']]).reason, /formules/);
  allowed(noFormulas, [['AddColumn', 'Clients', 'F', { type: 'Text', formula: '', isFormula: false }]]);
  allowed(pp, [['AddColumn', 'Clients', 'F', { formula: '$A', isFormula: true }], ['SetDisplayFormula', 'Clients', null, 5, '$B.Nom']]);
});

test('contrats 3.4 point 3 : CreateViewSection demande « structure », une table permise, pas de synthèse', () => {
  const withStructure = policyOf({ ...publipostage(), permissions: { ...publipostage().permissions, structure: { pourquoi: { fr: 'a', en: 'a' } } } });
  const refs = new Map([[7, 'Clients'], [8, 'GFS_Rangement'], [9, '_grist_Tables']]);
  assert.match(refused(pp, [['CreateViewSection', 7, 0, 'record', null, null]], { tableRefs: refs }).reason, /structure/);
  allowed(withStructure, [['CreateViewSection', 7, 0, 'record', null, null]], { tableRefs: refs });
  allowed(withStructure, [['CreateViewSection', 0, 0, 'record', null, 'MesDonnees']], { tableRefs: refs });
  refused(withStructure, [['CreateViewSection', 8, 0, 'record', null, null]], { tableRefs: refs });
  refused(withStructure, [['CreateViewSection', 9, 0, 'record', null, null]], { tableRefs: refs });
  refused(withStructure, [['CreateViewSection', 7, 0, 'record', [3], null]], { tableRefs: refs });
  refused(withStructure, [['CreateViewSection', 99, 0, 'record', null, null]], { tableRefs: refs });
  refused(withStructure, [['CreateViewSection', 0, 0, 'record', null, 'GFS_X']], { tableRefs: refs });
});

test('contrats 3.4 point 1 : le jeton est en lecture seule sauf déclaration contraire', () => {
  assert.deepEqual(tokenOptions(pp, { readOnly: false, route: 'attachments' }), { readOnly: true, route: 'attachments' });
  const rw = policyOf({ ...publipostage(), permissions: { ...publipostage().permissions, jeton: { lectureSeule: false, pourquoi: { fr: 'a', en: 'a' } } } });
  assert.deepEqual(tokenOptions(rw, { readOnly: false }), { readOnly: false, route: undefined });
  assert.deepEqual(tokenOptions(rw, {}), { readOnly: false, route: undefined });
});

test('contrats 3.1 : le niveau d\'une app est le plus bas entre son manifeste et celui accordé à GFS', () => {
  assert.equal(lowestAccess('full', 'read table'), 'read table');
  assert.equal(lowestAccess('none', 'full'), 'none');
  assert.equal(lowestAccess('full', 'full'), 'full');
});

test('les lectures et écritures déclarées de Publipostage+ passent toutes (manifeste de l\'exemple 2.9)', () => {
  assert.equal(writeRefusal(pp, 'Publipostage_Modeles'), null);
  assert.equal(writeRefusal(pp, 'MaTable'), null);
  allowed(pp, [['AddTable', 'Publipostage_PreferencesModeles', [{ id: 'Utilisateur', type: 'Text' }]]]);
  allowed(pp, [['AddVisibleColumn', 'Publipostage_Modeles', 'Jeton', { type: 'Text', isFormula: false, label: 'x' }]]);
  allowed(pp, [['AddTable', 'Publipostage_UserProbe', [{ id: 'Email', type: 'Text', isFormula: false, formula: 'user.Email', recalcWhen: 0, recalcDeps: null }]]]);
  allowed(pp, [['AddRecord', 'Publipostage_UserProbe', null, {}], ['RemoveRecord', 'Publipostage_UserProbe', 3]]);
});
