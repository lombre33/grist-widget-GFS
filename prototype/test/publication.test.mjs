// L'accord à la publication d'un formulaire (contrats 3.3, point 9) : ce qu'un lot d'actions ouvre de nouveau à qui aura le lien, d'après les règles de partage de Grist
// (app/common/ACLRulesReader.ts) : l'ajout de lignes dans toutes les colonnes de la table de la section publiée, la lecture de la colonne affichée des Références.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { touchesPublication, rowsOf, simulate, exposureOf, newExposure, publicationOpens } from '../js/publication.js';

// Un document : « Reponses » (Nom, Email, Statut, une Référence cachée vers la Définition), « Menus » (Nom), « FormPlus_Formulaires » (Definition), une section de formulaire.
const PUBLISHED = '{"publish":true,"form":true}';
const meta = () => ({
  tables: [{ id: 1, tableId: 'Reponses' }, { id: 2, tableId: 'Menus' }, { id: 3, tableId: 'FormPlus_Formulaires' }, { id: 4, tableId: 'Notes' }],
  columns: [
    { id: 10, parentId: 1, colId: 'Nom', type: 'Text', isFormula: false, formula: '', visibleCol: 0 },
    { id: 11, parentId: 1, colId: 'Email', type: 'Text', isFormula: false, formula: '', visibleCol: 0 },
    { id: 12, parentId: 1, colId: 'Statut', type: 'Text', isFormula: false, formula: '', visibleCol: 0 },
    { id: 13, parentId: 1, colId: 'FormPlusDef', type: 'Ref:FormPlus_Formulaires', isFormula: false, formula: '', visibleCol: 31 },
    { id: 14, parentId: 1, colId: 'Total', type: 'Numeric', isFormula: true, formula: '$Nom', visibleCol: 0 },
    { id: 15, parentId: 1, colId: 'manualSort', type: 'ManualSortPos', isFormula: false, formula: '', visibleCol: 0 },
    { id: 16, parentId: 1, colId: 'gristHelper_Display', type: 'Any', isFormula: true, formula: '$FormPlusDef.Definition', visibleCol: 0 },
    { id: 17, parentId: 1, colId: 'Repas', type: 'Ref:Menus', isFormula: false, formula: '', visibleCol: 0 },
    { id: 20, parentId: 2, colId: 'Nom', type: 'Text', isFormula: false, formula: '', visibleCol: 0 },
    { id: 21, parentId: 2, colId: 'Prix', type: 'Numeric', isFormula: false, formula: '', visibleCol: 0 },
    { id: 31, parentId: 3, colId: 'Definition', type: 'Text', isFormula: false, formula: '', visibleCol: 0 },
    { id: 40, parentId: 4, colId: 'Texte', type: 'Text', isFormula: false, formula: '', visibleCol: 0 },
  ],
  sections: [{ id: 100, tableRef: 1, shareOptions: '' }, { id: 101, tableRef: 1, shareOptions: '' }, { id: 102, tableRef: 4, shareOptions: '' }],
  fields: [
    { id: 1000, parentId: 100, colRef: 10, widgetOptions: '' },
    { id: 1001, parentId: 100, colRef: 11, widgetOptions: '{"formRequired":true}' },
    { id: 1002, parentId: 100, colRef: 12, widgetOptions: '{"formIsHidden":true}' },
  ],
});
const publish = id => ['UpdateRecord', '_grist_Views_section', id, { shareOptions: PUBLISHED }];
const opens = (before, actions) => newExposure(exposureOf(before), exposureOf(simulate(before, actions)));

test('un lot qui ne touche ni aux sections, ni à leurs champs, ni aux colonnes ne demande rien', () => {
  assert.equal(touchesPublication([['AddRecord', 'Clients', null, { Nom: 'a' }]]), false);
  assert.equal(touchesPublication([['AddTable', 'Autre', []]]), false);
  assert.equal(touchesPublication([['UpdateRecord', '_grist_Pages', 3, { pagePos: 2 }]]), false);
  assert.equal(touchesPublication([['UpdateRecord', '_grist_Views_section', 100, { shareOptions: PUBLISHED }]]), true);
  assert.equal(touchesPublication([['BulkAddRecord', '_grist_Views_section_field', [null], { parentId: [100], colRef: [10] }]]), true);
  assert.equal(touchesPublication([['UpdateRecord', '_GRIST_tables_column', 13, { visibleCol: 31 }]]), true);
});

test('publier une section ouvre sa table à l\'ajout, dans toutes ses colonnes de données, dont celles que le formulaire ne montre pas', () => {
  const found = opens(meta(), [publish(100)]);
  assert.deepEqual(found.reads, []);
  assert.equal(found.tables.length, 1);
  const [table] = found.tables;
  assert.equal(table.tableId, 'Reponses');
  assert.deepEqual(table.shown, ['Nom', 'Email'], 'le formulaire montre Nom et Email');
  // Statut est un champ caché (formIsHidden) : le lien peut le remplir. FormPlusDef et Repas ne sont dans aucun champ. Ni la formule, ni manualSort, ni l\'aide de Grist.
  assert.deepEqual(table.unshown, ['Statut', 'FormPlusDef', 'Repas']);
});

test('une section qui n\'est pas marquée « publish » et « form » n\'ouvre rien', () => {
  for (const shareOptions of ['', '{}', '{"publish":true}', '{"form":true}', '{"publish":false,"form":true}', 'pas du JSON', 'null']) {
    const before = meta();
    const found = opens(before, [['UpdateRecord', '_grist_Views_section', 100, { shareOptions }]]);
    assert.deepEqual(found, { tables: [], reads: [] }, shareOptions);
  }
});

test('une deuxième section sur la même table, ou le même lot rejoué, n\'ouvre rien de plus', () => {
  const published = simulate(meta(), [publish(100)]);
  assert.deepEqual(opens(published, [publish(101)]), { tables: [], reads: [] });
  assert.deepEqual(opens(published, [publish(100)]), { tables: [], reads: [] });
});

test('une section sur une autre table ouvre cette table-là, et elle seule', () => {
  const published = simulate(meta(), [publish(100)]);
  const found = opens(published, [publish(102)]);
  assert.deepEqual(found.tables.map(table => table.tableId), ['Notes']);
  assert.deepEqual(found.tables[0].unshown, ['Texte']);
});

test('ajouter à une section publiée un champ Référence ouvre la lecture de la colonne affichée de la table visée', () => {
  const published = simulate(meta(), [publish(100)]);
  const found = opens(published, [['AddRecord', '_grist_Views_section_field', null, { parentId: 100, colRef: 13, widgetOptions: '{"formIsHidden":true}' }]]);
  assert.deepEqual(found.tables, []);
  assert.deepEqual(found.reads, [{ tableId: 'FormPlus_Formulaires', colId: 'Definition' }]);
  // Le même champ ajouté une seconde fois, ou dans la seconde section : plus rien de nouveau.
  const twice = simulate(published, [['AddRecord', '_grist_Views_section_field', null, { parentId: 100, colRef: 13 }]]);
  assert.deepEqual(opens(twice, [['AddRecord', '_grist_Views_section_field', null, { parentId: 101, colRef: 13 }]]), { tables: [], reads: [] });
});

test('une Référence sans colonne affichée n\'ouvre aucune lecture ; en poser une dans une section publiée en ouvre une', () => {
  const published = simulate(meta(), [publish(100), ['AddRecord', '_grist_Views_section_field', null, { parentId: 100, colRef: 17 }]]);
  assert.deepEqual(exposureOf(published).reads.size, 0, 'Repas ne dit pas quelle colonne montrer : rien de lisible');
  const found = opens(published, [['UpdateRecord', '_grist_Tables_column', 17, { visibleCol: 20 }]]);
  assert.deepEqual(found.reads, [{ tableId: 'Menus', colId: 'Nom' }]);
});

test('changer la colonne affichée d\'une Référence hors de toute section publiée n\'ouvre rien', () => {
  const found = opens(meta(), [['UpdateRecord', '_grist_Tables_column', 17, { visibleCol: 20 }]]);
  assert.deepEqual(found, { tables: [], reads: [] });
});

test('retirer un champ ou une section publiée n\'ouvre rien', () => {
  const published = simulate(meta(), [publish(100), ['AddRecord', '_grist_Views_section_field', null, { parentId: 100, colRef: 13 }]]);
  assert.deepEqual(opens(published, [['RemoveRecord', '_grist_Views_section_field', 1000]]), { tables: [], reads: [] });
  assert.deepEqual(opens(published, [['UpdateRecord', '_grist_Views_section', 100, { shareOptions: '' }]]), { tables: [], reads: [] });
});

test('les verbes « Bulk » se jugent comme les autres', () => {
  const found = opens(meta(), [['BulkUpdateRecord', '_grist_Views_section', [100, 102], { shareOptions: [PUBLISHED, PUBLISHED] }]]);
  assert.deepEqual(found.tables.map(table => table.tableId).sort(), ['Notes', 'Reponses']);
  const added = opens(simulate(meta(), [publish(100)]), [['BulkAddRecord', '_grist_Views_section_field', [null, null], { parentId: [100, 100], colRef: [13, 17] }]]);
  assert.deepEqual(added.reads, [{ tableId: 'FormPlus_Formulaires', colId: 'Definition' }]);
  const removed = opens(simulate(meta(), [publish(100)]), [['BulkRemoveRecord', '_grist_Views_section_field', [1000, 1001]]]);
  assert.deepEqual(removed, { tables: [], reads: [] });
});

test('le calcul ne touche pas aux tables qu\'il reçoit', () => {
  const before = meta();
  const frozen = JSON.stringify(before);
  simulate(before, [publish(100), ['AddRecord', '_grist_Views_section_field', null, { parentId: 100, colRef: 13 }], ['RemoveRecord', '_grist_Views_section_field', 1000]]);
  assert.equal(JSON.stringify(before), frozen);
});

test('un verbe que le calcul ne sait pas juger sur ces tables est refusé, jamais laissé passer', () => {
  assert.throws(() => simulate(meta(), [['AddOrUpdateRecord', '_grist_Views_section', { id: 100 }, { shareOptions: PUBLISHED }]]), error => error.code === 'GFS_REFUSE');
  assert.throws(() => simulate(meta(), [['BulkUpdateRecord', '_grist_Views_section', [100], { shareOptions: PUBLISHED }]]), error => error.code === 'GFS_REFUSE');
  assert.throws(() => simulate(meta(), [['BulkAddRecord', '_grist_Views_section_field', [null], null]]), error => error.code === 'GFS_REFUSE');
});

test('rowsOf lit les colonnes que rend Grist', () => {
  assert.deepEqual(rowsOf({ id: [1, 2], tableId: ['A', 'B'] }), [{ id: 1, tableId: 'A' }, { id: 2, tableId: 'B' }]);
  assert.deepEqual(rowsOf(undefined), []);
});

// Le courtier lit les quatre tables qui décident, seulement quand le lot les touche.
const columnar = rows => {
  const keys = new Set(rows.flatMap(row => Object.keys(row)));
  return Object.fromEntries([...keys].map(key => [key, rows.map(row => row[key])]));
};
const portOf = (document, reads) => ({
  doc: { fetchTable: async tableId => { reads.push(tableId); return columnar(document[{ _grist_Tables: 'tables', _grist_Tables_column: 'columns', _grist_Views_section: 'sections', _grist_Views_section_field: 'fields' }[tableId]]); } },
});

test('publicationOpens : aucune lecture pour un lot qui ne publie rien, et la différence pour un lot qui publie', async () => {
  const reads = [];
  const port = portOf(meta(), reads);
  assert.equal(await publicationOpens(port, [['AddRecord', 'Clients', null, {}]]), null);
  assert.deepEqual(reads, [], 'rien n\'est lu');
  const found = await publicationOpens(port, [publish(100)]);
  assert.deepEqual(found.tables.map(table => table.tableId), ['Reponses']);
  assert.deepEqual(reads.sort(), ['_grist_Tables', '_grist_Tables_column', '_grist_Views_section', '_grist_Views_section_field']);
});

test('publicationOpens : une structure illisible refuse le lot, elle ne le laisse pas passer', async () => {
  const port = { doc: { fetchTable: async () => { throw new Error('Access denied'); } } };
  await assert.rejects(() => publicationOpens(port, [publish(100)]), error => error.code === 'GFS_REFUSE' && /illisible/.test(error.message));
});
