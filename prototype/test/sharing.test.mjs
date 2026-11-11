// Poser le partage d'une page (contrats 3.3, point 6 : l'exception ; 3.4, point 8) : ce que la capacité `partage` laisse faire à Form+, et ce qu'elle ne laisse jamais faire.
// Un faux Grist ne sert ici qu'à rejouer les écritures et à compter ce qui est lu et appliqué ; ce que Grist fait vraiment du partage se mesure dans un vrai Grist
// (labo/run-form.mjs, labo/run-cle-partage.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCallHandler } from '../js/broker.js';
import { checkBatch } from '../js/filter.js';
import { validateManifest, listCapabilities } from '../js/manifest.js';
import { sharedLinkQuestion } from '../js/publication-window.js';
import { createI18n } from '../js/i18n.js';
import { policyOf, form } from './helpers.mjs';

const PUBLISHED = '{"publish":true,"form":true}';
const OPEN = '{"publish":true}';
const SHUT = '{"publish":false}';
const LINK = 'a1b2c3d4-0000-4000-8000-000000000001';

const TABLES = { _grist_Tables: 'tables', _grist_Tables_column: 'columns', _grist_Views_section: 'sections', _grist_Views_section_field: 'fields', _grist_Pages: 'pages', _grist_Shares: 'shares', _grist_Views: 'views' };

// « Reponses » (table 1), deux pages (vues 50 et 51), une section de formulaire sur chacune, aucun partage.
function fakeDocument() {
  const document = {
    tables: [{ id: 1, tableId: 'Reponses' }, { id: 2, tableId: 'Autres' }],
    columns: [{ id: 10, parentId: 1, colId: 'Nom', type: 'Text', isFormula: false, formula: '', visibleCol: 0 }, { id: 20, parentId: 2, colId: 'Nom', type: 'Text', isFormula: false, formula: '', visibleCol: 0 }],
    sections: [{ id: 100, tableRef: 1, parentId: 50, parentKey: 'form', shareOptions: '' }, { id: 101, tableRef: 2, parentId: 51, parentKey: 'form', shareOptions: '' }],
    views: [{ id: 50, name: 'Formulaire Reponses' }, { id: 51, name: 'Formulaire Autres' }],
    fields: [{ id: 1000, parentId: 100, colRef: 10, widgetOptions: '' }, { id: 1001, parentId: 101, colRef: 20, widgetOptions: '' }],
    pages: [{ id: 1, viewRef: 50, shareRef: 0 }, { id: 2, viewRef: 51, shareRef: 0 }],
    shares: [],
  };
  const calls = { fetched: [], applied: [] };
  const columnar = rows => Object.fromEntries([...new Set(rows.flatMap(row => Object.keys(row)))].map(key => [key, rows.map(row => row[key])]));
  const rowsOf = tableId => document[TABLES[Object.keys(TABLES).find(name => name.toLowerCase() === tableId.toLowerCase())]];
  const port = {
    doc: {
      fetchTable: async tableId => { calls.fetched.push(tableId); return columnar(rowsOf(tableId)); },
      applyUserActions: async actions => {
        calls.applied.push(actions);
        const retValues = actions.map(([verb, tableId, id, values]) => {
          const rows = rowsOf(tableId);
          if (verb === 'AddRecord') { const row = { id: rows.reduce((top, item) => Math.max(top, item.id), 0) + 1, ...values }; rows.push(row); return row.id; }
          Object.assign(rows.find(row => row.id === id), values);
          return null;
        });
        return { retValues };
      },
    },
  };
  return { document, calls, port };
}

function setup(overrides = {}) {
  const fake = fakeDocument();
  const asked = [];
  const env = { policy: policyOf(form()), port: fake.port, level: 'full', readonly: false, declared: new Set(), onConfigure() {}, authorize: async opens => { asked.push(opens); return true; }, ...overrides };
  const apply = actions => makeCallHandler(env)({ iface: 'GristDocAPI', meth: 'applyUserActions', args: [actions, {}] });
  return { ...fake, asked, env, apply };
}

const addShare = (values = {}) => ['AddRecord', '_grist_Shares', null, { linkId: LINK, options: OPEN, ...values }];
const attach = (page, shareRef) => ['UpdateRecord', '_grist_Pages', page, { shareRef }];
const reopen = (share, options = OPEN) => ['UpdateRecord', '_grist_Shares', share, { options }];
const publish = (section = 100) => ['UpdateRecord', '_grist_Views_section', section, { shareOptions: PUBLISHED }];
const refused = (promise, pattern) => assert.rejects(() => promise, error => error.code === 'GFS_REFUSE' && pattern.test(error.message));

// ───────────────────────── La forme des actions ─────────────────────────

test('Form+ déclare `partage` : la recette du bouton « Publier » de Grist passe le filtre, action par action', () => {
  const policy = policyOf(form());
  assert.equal(policy.partage, true);
  for (const action of [addShare(), attach(1, 7), reopen(7), reopen(7, SHUT), publish()]) assert.deepEqual(checkBatch(policy, [action]), { ok: true }, JSON.stringify(action));
});

test('sans la capacité `partage`, `_grist_Shares` et `shareRef` restent des écritures que nulle app ne fait (contrats 3.3, point 6)', () => {
  const bare = form();
  delete bare.permissions.partage;
  const policy = policyOf(bare);
  assert.equal(policy.partage, false);
  for (const action of [addShare(), attach(1, 7), reopen(7)]) {
    const verdict = checkBatch(policy, [action]);
    assert.equal(verdict.ok, false, JSON.stringify(action));
    assert.match(verdict.reason, /jamais écrite|non déclarée/);
  }
  // Même un manifeste qui déclarerait `shareRef` par `gristInterne` (le validateur le refuse) ne l'obtient pas sans `partage` : la colonne reste sur la liste des refus du filtre.
  const forced = form();
  delete forced.permissions.partage;
  forced.permissions.gristInterne.find(entry => entry.tables.includes('_grist_Pages')).ecrit = ['shareRef'];
  assert.match(checkBatch(policyOf(forced), [attach(1, 7)]).reason, /shareRef de _grist_Pages n'est jamais écrite/);
});

test('une ligne de partage s\'ajoute avec son `linkId` et `{"publish":true}`, et rien d\'autre', () => {
  const policy = policyOf(form());
  const bad = [
    ['AddRecord', '_grist_Shares', 5, { linkId: LINK, options: OPEN }],
    ['AddRecord', '_grist_Shares', null, { linkId: LINK }],
    ['AddRecord', '_grist_Shares', null, { linkId: LINK, options: OPEN, label: 'Mon lien' }],
    ['AddRecord', '_grist_Shares', null, { linkId: 'a', options: OPEN }],
    ['AddRecord', '_grist_Shares', null, { linkId: 'a b c d e f g h', options: OPEN }],
    ['AddRecord', '_grist_Shares', null, { linkId: 12345678, options: OPEN }],
    ['AddRecord', '_grist_Shares', null, { linkId: LINK, options: SHUT }],
    ['AddRecord', '_grist_Shares', null, { linkId: LINK, options: '{"publish":true,"access":"editors"}' }],
    ['AddRecord', '_grist_Shares', null, { linkId: LINK, options: 'pas du JSON' }],
    ['AddRecord', '_grist_Shares', null, { linkId: LINK, options: { publish: true } }],
    ['BulkAddRecord', '_grist_Shares', [null], { linkId: [LINK], options: [OPEN] }],
    ['AddOrUpdateRecord', '_grist_Shares', { linkId: LINK }, { options: OPEN }],
  ];
  for (const action of bad) assert.equal(checkBatch(policy, [action]).ok, false, JSON.stringify(action));
});

test('une ligne de partage se met à jour pour `options` seulement, à `publish` vrai ou faux', () => {
  const policy = policyOf(form());
  const bad = [
    ['UpdateRecord', '_grist_Shares', null, { options: OPEN }],
    ['UpdateRecord', '_grist_Shares', 0, { options: OPEN }],
    ['UpdateRecord', '_grist_Shares', 7, { linkId: 'autre-identifiant' }],
    ['UpdateRecord', '_grist_Shares', 7, { options: OPEN, linkId: LINK }],
    ['UpdateRecord', '_grist_Shares', 7, { options: '{"publish":"oui"}' }],
    ['UpdateRecord', '_grist_Shares', 7, { options: '{"publish":true,"x":1}' }],
    ['UpdateRecord', '_grist_Shares', 7, { options: '{}' }],
    ['BulkUpdateRecord', '_grist_Shares', [7], { options: [OPEN] }],
  ];
  for (const action of bad) assert.equal(checkBatch(policy, [action]).ok, false, JSON.stringify(action));
});

test('un partage ne se retire jamais, et `shareRef` ne se détache pas', () => {
  const policy = policyOf(form());
  for (const action of [['RemoveRecord', '_grist_Shares', 7], ['BulkRemoveRecord', '_grist_Shares', [7]], attach(1, 0), attach(1, -1), attach(1, '7'), attach(1, null),
    ['UpdateRecord', '_grist_Pages', 1, { shareRef: 7, pagePos: 2 }], ['UpdateRecord', '_grist_Pages', null, { shareRef: 7 }],
    ['BulkUpdateRecord', '_grist_Pages', [1], { shareRef: [7] }], ['AddRecord', '_grist_Pages', null, { viewRef: 50, shareRef: 7 }],
    ['AddOrUpdateRecord', '_grist_Pages', { viewRef: 50 }, { shareRef: 7 }]]) {
    assert.equal(checkBatch(policy, [action]).ok, false, JSON.stringify(action));
  }
});

test('les autres colonnes de `_grist_Pages` n\'ont rien gagné : l\'entrée `gristInterne` décide toujours', () => {
  const policy = policyOf(form());
  const verdict = checkBatch(policy, [['UpdateRecord', '_grist_Pages', 1, { pagePos: 2 }]]);
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /non déclarée/);
});

test('les autres tables de partage et les règles d\'accès restent fermées, même avec `partage`', () => {
  const policy = policyOf(form());
  for (const table of ['_grist_ACLRules', '_grist_ACLResources', '_grist_Triggers', '_grist_DocInfo']) {
    assert.equal(checkBatch(policy, [['AddRecord', table, null, { x: 1 }]]).ok, false, table);
  }
  assert.equal(checkBatch(policy, [['UpdateRecord', '_grist_Views_section', 100, { options: '{}' }]]).ok, false);
});

// ───────────────────────── Le manifeste ─────────────────────────

test('le manifeste : `partage` porte son pourquoi en français et en anglais, demande l\'accès full, et se liste avec les autres capacités', () => {
  assert.deepEqual(validateManifest(form()).errors, []);
  const noReason = form();
  noReason.permissions.partage = {};
  assert.match(validateManifest(noReason).errors.join(' | '), /partage : pourquoi doit porter fr et en/);
  const noFrench = form();
  noFrench.permissions.partage = { pourquoi: { en: 'a' } };
  assert.match(validateManifest(noFrench).errors.join(' | '), /partage : pourquoi/);
  const readOnly = form();
  readOnly.permissions = { acces: 'read table', partage: { pourquoi: { fr: 'a', en: 'a' } } };
  assert.match(validateManifest(readOnly).errors.join(' | '), /accès full/);
  const row = listCapabilities([form()]).find(item => item.capacite === 'partage');
  assert.ok(row && row.pourquoi && row.pourquoi.fr && row.pourquoi.en, 'la raison est montrée à la personne');
});

test('le manifeste ne peut toujours pas déclarer `_grist_Shares` ni `shareRef` par `gristInterne`', () => {
  for (const entry of [{ tables: ['_grist_Shares'], lit: true, ecrit: ['options'] }, { tables: ['_grist_Pages'], lit: true, ecrit: ['shareRef'] }]) {
    const manifest = form();
    manifest.permissions.gristInterne.push({ ...entry, pourquoi: { fr: 'a', en: 'a' } });
    assert.notDeepEqual(validateManifest(manifest).errors, [], JSON.stringify(entry));
  }
});

// ───────────────────────── Ce que dit le document ─────────────────────────

test('la recette entière : la ligne de partage, la page, puis la publication, qui seule demande l\'accord', async () => {
  const { apply, asked, calls, document } = setup();
  const added = await apply([addShare()]);
  assert.deepEqual(added.retValues, [1]);
  await apply([attach(1, 1)]);
  assert.equal(asked.length, 0, 'poser le partage n\'ouvre rien : la personne n\'est pas sollicitée');
  assert.equal(document.pages[0].shareRef, 1);
  await apply([publish()]);
  assert.equal(asked.length, 1, 'la publication demande l\'accord, comme avant');
  assert.deepEqual(asked[0].tables.map(table => table.tableId), ['Reponses']);
  assert.equal(document.sections[0].shareOptions, PUBLISHED);
  assert.equal(calls.applied.length, 3);
});

test('si la personne refuse à la publication, le partage reste posé et rien n\'est ouvert', async () => {
  const { apply, document } = setup({ authorize: async () => false });
  await apply([addShare()]);
  await apply([attach(1, 1)]);
  await assert.rejects(() => apply([publish()]), error => error.code === 'GFS_ANNULE');
  assert.equal(document.sections[0].shareOptions, '', 'la section n\'est pas marquée publiée');
  assert.equal(document.pages[0].shareRef, 1);
  assert.equal(document.shares.length, 1);
});

test('rattacher un partage à une page qui n\'existe pas, ou un partage qui n\'existe pas, est refusé', async () => {
  const { apply, calls } = setup();
  await apply([addShare()]);
  const before = calls.applied.length;
  await refused(apply([attach(9, 1)]), /page est introuvable/);
  await refused(apply([attach(1, 9)]), /partage est introuvable/);
  assert.equal(calls.applied.length, before, 'rien n\'est envoyé à Grist');
});

test('une page qui a déjà un partage n\'en reçoit pas un second', async () => {
  const { apply } = setup();
  await apply([addShare(), addShare({ linkId: 'b1b2c3d4-0000-4000-8000-000000000002' })]);
  await apply([attach(1, 1)]);
  await refused(apply([attach(1, 2)]), /déjà un partage/);
});

// Choix du porteur du 11/11, « Au choix, non coché » : une page ne prend le lien d'une autre qu'avec l'accord de la personne, dans une fenêtre de GFS qui reste sur « Refuser ».
test('une page qui prend le lien d\'une autre demande l\'accord : la fenêtre dit les deux pages et les tables de l\'autre', async () => {
  const { apply, asked, document } = setup();
  await apply([addShare()]);
  await apply([attach(1, 1)]);
  assert.equal(asked.length, 0, 'le premier rattachement, sur un partage neuf, ne demande rien');
  await apply([attach(2, 1)]);
  assert.equal(asked.length, 1);
  assert.deepEqual(asked[0], { tables: [], reads: [], sharedLink: { page: 'Formulaire Autres', others: [{ page: 'Formulaire Reponses', tables: ['Reponses'] }] } });
  assert.equal(document.pages[1].shareRef, 1, 'la personne a accepté : le rattachement est fait');
});

test('si la personne refuse le même lien, la page ne le prend pas et l\'app reçoit GFS_ANNULE', async () => {
  const { apply, calls, document } = setup({ authorize: async opens => !opens.sharedLink });
  await apply([addShare()]);
  await apply([attach(1, 1)]);
  const before = calls.applied.length;
  await assert.rejects(() => apply([attach(2, 1)]), error => error.code === 'GFS_ANNULE' && /même lien/.test(error.message));
  assert.equal(calls.applied.length, before, 'rien n\'est envoyé à Grist');
  assert.equal(document.pages[1].shareRef, 0);
});

test('sans moyen de demander l\'accord, une page ne prend pas le lien d\'une autre', async () => {
  const { apply, document } = setup({ authorize: undefined });
  await apply([addShare()]);
  await apply([attach(1, 1)]);
  await refused(apply([attach(2, 1)]), /accord de la personne/);
  assert.equal(document.pages[1].shareRef, 0);
});

test('la question porte les noms du document comme du texte, une entrée par page qui partage déjà le lien, et reste sur « Refuser »', () => {
  const shared = { page: 'Formulaire <b>Autres</b>', others: [{ page: 'Formulaire Reponses', tables: ['Reponses', 'Menus'] }, { page: 'Vide', tables: [] }] };
  for (const [lang, title, allow] of [['fr', /Un seul lien pour deux formulaires/, 'Même lien'], ['en', /One link for two forms/, 'Same link']]) {
    const { t } = createI18n(lang);
    const question = sharedLinkQuestion({ t, app: 'Form+', shared });
    assert.match(question.title, title);
    assert.match(question.message, /Form\+/);
    assert.ok(question.message.includes('Formulaire <b>Autres</b>'), 'le nom entre tel quel : la fenêtre le met en texte, jamais en HTML');
    assert.equal(question.items.length, 2);
    assert.ok(question.items[0].includes('Formulaire Reponses') && question.items[0].includes('Reponses') && question.items[0].includes('Menus'));
    assert.equal(question.items[1].includes('Vide'), true);
    assert.equal(question.confirmLabel, allow);
    assert.equal(question.safeFirst, true);
  }
});

test('dans un même lot, le second geste est jugé sur le document que le premier laisse : il demande, le premier non', async () => {
  const { apply, asked } = setup();
  await apply([addShare()]);
  await apply([attach(1, 1), attach(2, 1)]);
  assert.equal(asked.length, 1);
  assert.equal(asked[0].sharedLink.page, 'Formulaire Autres');
});

test('un partage ne se rattache pas à une page dont un formulaire est déjà marqué publié : il s\'ouvrirait sans l\'accord', async () => {
  const { apply, document } = setup();
  document.sections[0].shareOptions = PUBLISHED;
  await apply([addShare()]);
  await refused(apply([attach(1, 1)]), /marqué publié/);
  await apply([attach(2, 1)]);
  assert.equal(document.pages[1].shareRef, 1, 'une page sans formulaire publié, elle, le reçoit');
});

test('un formulaire marqué mais pas publié, ou publié sans `form`, ne compte pas', async () => {
  for (const shareOptions of ['', '{}', '{"publish":true}', '{"form":true}', '{"publish":false,"form":true}', 'pas du JSON']) {
    const { apply, document } = setup();
    document.sections[0].shareOptions = shareOptions;
    await apply([addShare()]);
    await apply([attach(1, 1)]);
    assert.equal(document.pages[0].shareRef, 1, shareOptions);
  }
});

test('rouvrir un partage : permis quand aucun formulaire marqué publié n\'y est rattaché, ou quand il est déjà ouvert', async () => {
  const { apply, document } = setup();
  await apply([addShare()]);
  await apply([attach(1, 1)]);
  await apply([reopen(1, SHUT)]);
  await apply([reopen(1)]);
  assert.equal(document.shares[0].options, OPEN);
  document.sections[0].shareOptions = PUBLISHED;
  await apply([reopen(1)]);
  assert.equal(document.shares[0].options, OPEN, 'déjà ouvert : rien de plus ne s\'ouvre');
});

test('rouvrir un partage fermé dont une page porte un formulaire marqué publié est refusé : la personne l\'avait fermé', async () => {
  const { apply, document } = setup();
  await apply([addShare()]);
  await apply([attach(1, 1)]);
  await apply([reopen(1, SHUT)]);
  document.sections[0].shareOptions = PUBLISHED;
  await refused(apply([reopen(1)]), /rouvrirait un formulaire marqué publié/);
  assert.equal(document.shares[0].options, SHUT);
  await apply([reopen(1, SHUT)]);
});

test('rouvrir un partage qui n\'existe pas est refusé', async () => {
  const { apply } = setup();
  await refused(apply([reopen(4)]), /partage est introuvable/);
});

test('GFS échoue fermé : un document dont les pages ou les partages sont illisibles refuse le lot', async () => {
  const { apply, calls, port } = setup();
  await apply([addShare()]);
  port.doc.fetchTable = async () => { throw new Error('Access not granted'); };
  const before = calls.applied.length;
  await refused(apply([attach(1, 1)]), /illisibles/);
  assert.equal(calls.applied.length, before);
});

test('poser une ligne de partage neuve ne lit rien dans le document : sans page, elle n\'ouvre rien', async () => {
  const { apply, calls } = setup();
  await apply([addShare()]);
  assert.deepEqual(calls.fetched, []);
});

test('en lecture seule, rien de tout cela n\'est écrit', async () => {
  const { apply, calls } = setup({ readonly: true });
  await assert.rejects(() => apply([addShare()]), error => error.code === 'GFS_LECTURE_SEULE');
  assert.equal(calls.applied.length, 0);
});

test('l\'accord de la publication reste exigé : sans moyen de le demander, publier est refusé, même avec un partage posé', async () => {
  const { apply, document } = setup({ authorize: undefined });
  await apply([addShare()]);
  await apply([attach(1, 1)]);
  await refused(apply([publish()]), /accord/);
  assert.equal(document.sections[0].shareOptions, '');
});
