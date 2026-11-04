// Le lecteur des droits (js/rights-reader.js) sur un faux document : ce qu'il rend, ce qu'il garde, et la preuve de propriétaire. Ce que le vrai Grist rend se mesure dans le labo (run-droits-reel.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RightsReader } from '../js/rights-reader.js';

const columns = rows => { const keys = [...new Set(rows.flatMap(row => Object.keys(row)))]; return Object.fromEntries(keys.map(key => [key, rows.map(row => row[key])])); };
const BUILT_IN = { id: 1, resource: 1, permissions: 63, principals: '[1]', aclFormula: '', aclColumn: 0, permissionsText: '', memo: '' };

function setup({ tables = {}, owner = true, now = { t: 0 }, failing = [] } = {}) {
  const asked = [];
  const base = {
    _grist_ACLResources: [{ id: 1, tableId: '', colIds: '' }],
    _grist_ACLRules: [BUILT_IN],
    _grist_Tables: [{ id: 1, tableId: 'Clients' }],
    _grist_Shares: [], _grist_Pages: [], _grist_Views: [], _grist_Views_section: [], _grist_Views_section_field: [], _grist_Tables_column: [],
    ...tables,
  };
  const port = { doc: { fetchTable: async name => { asked.push(name); if (failing.includes(name)) throw new Error('Table not found'); return columns(base[name] || []); } } };
  const calls = { owner: 0 };
  const transfer = { isOwner: async () => { calls.owner += 1; return typeof owner === 'function' ? owner() : owner; } };
  return { reader: new RightsReader({ port, transfer, prefixes: () => ['PP_'], now: () => now.t }), asked, calls, now };
}

test('rules : sans aucune règle de la personne, les tables de GFS et des apps sont « Pas protégé » ; celles de la personne ne comptent pas', async () => {
  const { reader } = setup({ tables: { _grist_Tables: [{ id: 1, tableId: 'Clients' }, { id: 2, tableId: 'GFS_Rangement' }, { id: 3, tableId: 'PP_Modeles' }] } });
  const state = await reader.rules();
  assert.deepEqual(state, { readable: true, tables: [{ tableId: 'GFS_Rangement', level: 'ouvert' }, { tableId: 'PP_Modeles', level: 'ouvert' }], closed: false, hasRules: false, count: 0, word: 'pas' });
});

test('rules : des règles GFS Encadré partout et la structure fermée → « Protégé », lues sans que la personne soit prouvée propriétaire', async () => {
  const run = setup({
    tables: {
      _grist_Tables: [{ id: 2, tableId: 'GFS_Rangement' }, { id: 3, tableId: 'PP_Modeles' }],
      _grist_ACLResources: [{ id: 1, tableId: '', colIds: '' }, { id: 2, tableId: 'GFS_Rangement', colIds: '*' }, { id: 3, tableId: 'PP_Modeles', colIds: '*' }],
      _grist_ACLRules: [BUILT_IN,
        { id: 2, resource: 2, aclFormula: 'user.Access != OWNER', permissionsText: '-CRUD', memo: 'GFS : Encadré', permissions: 0, aclColumn: 0 },
        { id: 3, resource: 3, aclFormula: 'user.Access != OWNER', permissionsText: '-CRUD', memo: 'GFS : Encadré', permissions: 0, aclColumn: 0 },
        { id: 4, resource: 1, aclFormula: 'user.Access != OWNER', permissionsText: '-S', memo: 'GFS : structure fermée', permissions: 0, aclColumn: 0 }],
    },
    owner: false,
  });
  const state = await run.reader.rules();
  assert.equal(state.word, 'protege');
  assert.equal(state.closed, true);
  assert.equal(state.count, 3);
  assert.equal(run.calls.owner, 0, 'lire les règles ne demande aucune preuve de propriétaire');
});

test('rules : une table que les règles retirent à la personne (absente de ses tables internes) est quand même jugée d\'après ses règles', async () => {
  const run = setup({
    tables: {
      _grist_Tables: [{ id: 1, tableId: 'Clients' }],
      _grist_ACLResources: [{ id: 1, tableId: '', colIds: '' }, { id: 2, tableId: 'GFS_Rangement', colIds: '*' }],
      _grist_ACLRules: [BUILT_IN, { id: 2, resource: 2, aclFormula: 'user.Access != OWNER', permissionsText: '-CRUD', memo: 'GFS : Encadré', permissions: 0, aclColumn: 0 }],
    },
  });
  const state = await run.reader.rules();
  assert.deepEqual(state.tables, [{ tableId: 'GFS_Rangement', level: 'encadre' }], 'Grist ne rend pas à un éditeur la ligne d\'une table qu\'il ne lit pas : ses règles la nomment');
  assert.equal(state.word, 'partie');
});

test('rules : des tables internes illisibles (accès trop bas) → readable: false, jamais une erreur', async () => {
  const { reader } = setup({ failing: ['_grist_ACLRules'] });
  assert.deepEqual(await reader.rules(), { readable: false, tables: [], closed: false, hasRules: false, count: 0, word: null });
});

test('owner : la preuve se garde quand elle est sûre ; un « on ne sait pas » se redemande au bout de 30 secondes', async () => {
  const sure = setup({ owner: true });
  assert.equal(await sure.reader.owner(), true);
  sure.now.t = 10 * 60 * 1000;
  assert.equal(await sure.reader.owner(), true);
  assert.equal(sure.calls.owner, 1, 'une réponse sûre vaut pour la vie de la page');
  const unsure = setup({ owner: null });
  assert.equal(await unsure.reader.owner(), null);
  await Promise.resolve();
  unsure.now.t = 5000;
  await unsure.reader.owner();
  assert.equal(unsure.calls.owner, 1, 'pas de nouvelle demande avant 30 secondes');
  unsure.now.t = 31000;
  await unsure.reader.owner();
  assert.equal(unsure.calls.owner, 2);
  const throwing = setup({ owner: () => { throw new Error('boum'); } });
  assert.equal(await throwing.reader.owner(), null, 'une erreur de la preuve est un « on ne sait pas »');
});

test('role : { proprietaire, responsableDe } ; null tant que la preuve manque, même si elle tarde', async () => {
  assert.deepEqual(await setup({ owner: true }).reader.role(), { proprietaire: true, responsableDe: [] });
  assert.deepEqual(await setup({ owner: false }).reader.role(), { proprietaire: false, responsableDe: [] });
  assert.deepEqual(await setup({ owner: null }).reader.role(), { proprietaire: null, responsableDe: [] });
  const slow = setup({ owner: () => new Promise(() => {}) });
  assert.deepEqual(await slow.reader.role(20), { proprietaire: null, responsableDe: [] }, 'la preuve tarde : l\'app ne démarre pas plus tard pour cela');
});

const SHARING = {
  _grist_Shares: [{ id: 1, linkId: 'cle-secrete', options: '{"publish":true}' }],
  _grist_Pages: [{ id: 1, viewRef: 7, shareRef: 1 }],
  _grist_Views: [{ id: 7, name: 'Inscription' }],
  _grist_Tables: [{ id: 10, tableId: 'Inscrits' }],
  _grist_Tables_column: [{ id: 100, parentId: 10, colId: 'Nom', type: 'Text', isFormula: false, formula: '', visibleCol: 0 }],
  _grist_Views_section: [{ id: 50, parentId: 7, tableRef: 10, shareOptions: '{"publish":true,"form":true}' }],
  _grist_Views_section_field: [{ id: 1, parentId: 50, colRef: 100, widgetOptions: '{}' }],
  Inscrits: [{ id: 1, Nom: 'A' }, { id: 2, Nom: 'B' }, { id: 3, Nom: 'C' }],
};

test('links : un propriétaire voit chaque partage et le nombre de lignes de la table qu\'il remplit ; la clé du lien ne sort pas', async () => {
  const { reader } = setup({ tables: SHARING, owner: true });
  const result = await reader.links();
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.links, [{ id: 1, published: true, pages: ['Inscription'], filled: [{ tableId: 'Inscrits', shown: ['Nom'], unshown: [], rows: 3 }], readable: [], protectedOpen: [] }]);
  assert.equal(JSON.stringify(result).includes('cle-secrete'), false);
});

test('links : une personne qui n\'est pas propriétaire (ou non prouvée) ne les voit pas, même si Grist lui rend les tables ; aucune table de données n\'est lue', async () => {
  const other = setup({ tables: SHARING, owner: false });
  assert.deepEqual(await other.reader.links(), { status: 'owner-only', links: [] });
  assert.deepEqual(other.asked, [], 'rien n\'est lu');
  const unsure = setup({ tables: SHARING, owner: null });
  assert.deepEqual(await unsure.reader.links(), { status: 'unknown', links: [] });
});

test('links : une table interne illisible → unreadable ; un compte de lignes qui échoue → null, sans tout perdre', async () => {
  assert.deepEqual(await setup({ tables: SHARING, failing: ['_grist_Shares'] }).reader.links(), { status: 'unreadable', links: [] });
  const noCount = setup({ tables: SHARING, failing: ['Inscrits'] });
  assert.equal((await noCount.reader.links()).links[0].filled[0].rows, null);
});
