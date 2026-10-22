// Le courtier devant un lot qui publie un formulaire (contrats 3.3, point 9) : l'accord de la personne avant d'ouvrir une table ou une colonne à qui aura le lien.
// Un faux Grist ne sert ici qu'à compter ce qui est lu et appliqué ; ce que Grist ouvre vraiment se mesure dans le labo et chez Form+.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCallHandler } from '../js/broker.js';
import { simulate } from '../js/publication.js';
import { policyOf, form } from './helpers.mjs';

const PUBLISHED = '{"publish":true,"form":true}';
const NAMES = { _grist_Tables: 'tables', _grist_Tables_column: 'columns', _grist_Views_section: 'sections', _grist_Views_section_field: 'fields' };

// Un document en lignes ; `fetchTable` les rend par colonnes comme Grist, `applyUserActions` les rejoue (c'est ce que Grist ferait pour de bon).
function fakeDocument() {
  const document = {
    tables: [{ id: 1, tableId: 'Reponses' }, { id: 3, tableId: 'FormPlus_Formulaires' }],
    columns: [
      { id: 10, parentId: 1, colId: 'Nom', type: 'Text', isFormula: false, formula: '', visibleCol: 0 },
      { id: 12, parentId: 1, colId: 'Statut', type: 'Text', isFormula: false, formula: '', visibleCol: 0 },
      { id: 13, parentId: 1, colId: 'FormPlusDef', type: 'Ref:FormPlus_Formulaires', isFormula: false, formula: '', visibleCol: 31 },
      { id: 31, parentId: 3, colId: 'Definition', type: 'Text', isFormula: false, formula: '', visibleCol: 0 },
    ],
    sections: [{ id: 100, tableRef: 1, shareOptions: '' }],
    fields: [{ id: 1000, parentId: 100, colRef: 10, widgetOptions: '' }],
  };
  const calls = { fetched: [], applied: [] };
  const columnar = rows => Object.fromEntries([...new Set(rows.flatMap(row => Object.keys(row)))].map(key => [key, rows.map(row => row[key])]));
  const port = {
    doc: {
      fetchTable: async tableId => { calls.fetched.push(tableId); return columnar(document[NAMES[tableId]]); },
      applyUserActions: async actions => { calls.applied.push(actions); Object.assign(document, simulate(document, actions)); return { retValues: [] }; },
    },
  };
  return { document, calls, port };
}

// Des tables que jamais un lien public n'ouvre : celle de GFS, celle d'une autre app, celle de l'app qui publie ; et `Dossiers`, qui a une Référence vers chacune d'elles et vers
// `Menus`, une table de la personne. Une section de formulaire non publiée sur chacune.
function addProtectedTables(document) {
  const column = (id, parentId, colId, type = 'Text', visibleCol = 0) => ({ id, parentId, colId, type, isFormula: false, formula: '', visibleCol });
  document.tables.push({ id: 5, tableId: 'GFS_Espaces' }, { id: 6, tableId: 'Publipostage_Modeles' }, { id: 7, tableId: 'Dossiers' }, { id: 8, tableId: 'Menus' });
  document.columns.push(column(51, 5, 'Nom'), column(61, 6, 'Nom'), column(81, 8, 'Nom'), column(71, 7, 'Espace', 'Ref:GFS_Espaces', 51),
    column(72, 7, 'Modele', 'Ref:Publipostage_Modeles', 61), column(73, 7, 'Menu', 'Ref:Menus', 81));
  document.sections.push({ id: 101, tableRef: 5, shareOptions: '' }, { id: 102, tableRef: 6, shareOptions: '' }, { id: 103, tableRef: 3, shareOptions: '' }, { id: 104, tableRef: 7, shareOptions: '' });
}

function setup(overrides = {}, withProtected = false) {
  const fake = fakeDocument();
  if (withProtected) addProtectedTables(fake.document);
  const asked = [];
  const env = { policy: policyOf(form()), port: fake.port, level: 'full', readonly: false, declared: new Set(), onConfigure() {}, authorize: async opens => { asked.push(opens); return true; }, ...overrides };
  const apply = actions => makeCallHandler(env)({ iface: 'GristDocAPI', meth: 'applyUserActions', args: [actions, {}] });
  return { ...fake, asked, env, apply };
}
const publish = (id = 100) => [['UpdateRecord', '_grist_Views_section', id, { shareOptions: PUBLISHED }]];
const addDefinitionField = () => [['AddRecord', '_grist_Views_section_field', null, { parentId: 100, colRef: 13, widgetOptions: '{"formIsHidden":true}' }]];

test('un lot qui publie une section demande l\'accord, dit la table et les colonnes que le formulaire ne montre pas, puis passe', async () => {
  const { apply, asked, calls } = setup();
  await apply(publish());
  assert.equal(asked.length, 1);
  assert.deepEqual(asked[0].tables, [{ tableId: 'Reponses', shown: ['Nom'], unshown: ['Statut', 'FormPlusDef'] }]);
  assert.deepEqual(asked[0].reads, []);
  assert.equal(calls.applied.length, 1, 'le lot est appliqué une fois, après l\'accord');
});

test('si la personne refuse, le lot n\'est pas appliqué et l\'app reçoit GFS_ANNULE', async () => {
  const { apply, calls, document } = setup({ authorize: async () => false });
  await assert.rejects(() => apply(publish()), error => error.code === 'GFS_ANNULE');
  assert.equal(calls.applied.length, 0, 'rien n\'est envoyé à Grist');
  assert.equal(document.sections[0].shareOptions, '', 'le document est resté comme il était');
});

test('une ouverture déjà accordée ne se redemande pas ; une ouverture de plus se demande', async () => {
  const { apply, asked } = setup();
  await apply(publish());
  await apply(publish());
  assert.equal(asked.length, 1, 'le même lot rejoué n\'ouvre rien de plus');
  await apply(addDefinitionField());
  assert.equal(asked.length, 2);
  assert.deepEqual(asked[1].reads, [{ tableId: 'FormPlus_Formulaires', colId: 'Definition' }], 'le champ Référence ouvre la lecture de la colonne affichée');
  assert.deepEqual(asked[1].tables, []);
});

test('sans moyen de demander l\'accord, le courtier refuse de publier', async () => {
  const { apply, calls } = setup({ authorize: undefined });
  await assert.rejects(() => apply(publish()), error => error.code === 'GFS_REFUSE' && /accord/.test(error.message));
  assert.equal(calls.applied.length, 0);
});

test('un lot qui ne publie rien ne lit rien et ne demande rien', async () => {
  const { apply, asked, calls } = setup();
  await apply([['AddRecord', 'FormPlus_Formulaires', null, { Nom: 'a', Definition: '{}' }]]);
  assert.equal(asked.length, 0);
  assert.deepEqual(calls.fetched, []);
  assert.equal(calls.applied.length, 1);
});

test('un lot que le filtre refuse ne demande rien non plus', async () => {
  const { apply, asked, calls } = setup();
  await assert.rejects(() => apply([['UpdateRecord', '_grist_Views_section', 100, { shareOptions: PUBLISHED, options: '{}' }]]), error => error.code === 'GFS_REFUSE');
  assert.equal(asked.length, 0);
  assert.equal(calls.applied.length, 0);
});

test('les lots qui publient passent l\'un après l\'autre : le second est jugé sur un document où le premier est déjà posé', async () => {
  const waiting = [];
  const { apply, asked, calls } = setup({ authorize: opens => new Promise(resolve => { waiting.push(() => resolve(true)); asked.push(opens); }) });
  const first = apply(publish());
  const second = apply(publish());
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(waiting.length, 1, 'une seule demande à la fois');
  waiting[0]();
  await Promise.all([first, second]);
  assert.equal(asked.length, 1, 'le second lot n\'ouvre plus rien : pas de seconde demande');
  assert.equal(calls.applied.length, 2);
});

test('en lecture seule, rien n\'est demandé : l\'écriture est refusée avant', async () => {
  const { apply, asked } = setup({ readonly: true });
  await assert.rejects(() => apply(publish()), error => error.code === 'GFS_LECTURE_SEULE');
  assert.equal(asked.length, 0);
});

test('une structure illisible refuse le lot au lieu de le laisser passer', async () => {
  const { apply, calls, port } = setup();
  port.doc.fetchTable = async () => { throw new Error('Access not granted'); };
  await assert.rejects(() => apply(publish()), error => error.code === 'GFS_REFUSE' && /illisible/.test(error.message));
  assert.equal(calls.applied.length, 0);
});

test('une table de GFS, d\'une autre app ou de l\'app qui publie n\'est jamais ouverte à l\'ajout : refus, sans demander l\'accord', async () => {
  for (const [section, why] of [[101, /réservée à GFS/], [102, /autre app/], [103, /table de l'app/]]) {
    const { apply, asked, calls } = setup({}, true);
    await assert.rejects(() => apply(publish(section)), error => error.code === 'GFS_REFUSE' && why.test(error.message) && /à l'ajout/.test(error.message), `section ${section}`);
    assert.equal(asked.length, 0, 'la personne n\'est pas sollicitée');
    assert.equal(calls.applied.length, 0, 'rien n\'est envoyé à Grist');
  }
});

test('une Référence vers une table de GFS ou d\'une autre app ne rend jamais sa colonne lisible : refus, sans demander l\'accord', async () => {
  for (const [colRef, name] of [[71, 'GFS_Espaces'], [72, 'Publipostage_Modeles']]) {
    const { apply, asked, calls } = setup({}, true);
    await apply([['AddRecord', '_grist_Views_section_field', null, { parentId: 104, colRef, widgetOptions: '' }]]);
    const before = calls.applied.length;
    await assert.rejects(() => apply(publish(104)), error => error.code === 'GFS_REFUSE' && error.message.includes(name) && /à la lecture/.test(error.message), name);
    assert.equal(asked.length, 0);
    assert.equal(calls.applied.length, before, 'la publication n\'est pas envoyée');
  }
});

test('l\'app ne peut pas ouvrir au public ce qu\'elle ne pourrait pas écrire, ni lire, elle-même', async () => {
  const permissions = form().permissions;
  const noWrite = setup({ policy: policyOf({ ...form(), permissions: { ...permissions, ecrit: [] } }) });
  await assert.rejects(() => noWrite.apply(publish()), error => error.code === 'GFS_REFUSE' && /Reponses/.test(error.message) && /ecrit/.test(error.message));
  assert.equal(noWrite.asked.length, 0);
  const noRead = setup({ policy: policyOf({ ...form(), permissions: { ...permissions, lit: [] } }) }, true);
  await noRead.apply([['AddRecord', '_grist_Views_section_field', null, { parentId: 104, colRef: 73, widgetOptions: '' }]]);
  await assert.rejects(() => noRead.apply(publish(104)), error => error.code === 'GFS_REFUSE' && /Menus/.test(error.message) && /à la lecture/.test(error.message));
  assert.equal(noRead.asked.length, 0);
});

test('la lecture d\'une table de l\'app qui publie passe par l\'accord (la définition des formulaires de Form+, consigne 013)', async () => {
  const { apply, asked } = setup();
  await apply(publish());
  await apply(addDefinitionField());
  assert.deepEqual(asked[1].reads, [{ tableId: 'FormPlus_Formulaires', colId: 'Definition' }]);
});

