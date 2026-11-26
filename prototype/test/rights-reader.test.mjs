// Le lecteur des droits (js/rights/rights-reader.js) sur un faux document : ce qu'il rend, ce qu'il garde, et la preuve de propriétaire. Ce que le vrai Grist rend se mesure dans le labo (run-droits-reel.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RightsReader } from '../js/rights/rights-reader.js';

const columns = rows => { const keys = [...new Set(rows.flatMap(row => Object.keys(row)))]; return Object.fromEntries(keys.map(key => [key, rows.map(row => row[key])])); };
const BUILT_IN = { id: 1, resource: 1, permissions: 63, principals: '[1]', aclFormula: '', aclColumn: 0, permissionsText: '', memo: '' };

function setup({ tables = {}, owner = true, now = { t: 0 }, failing = [] } = {}) {
  const asked = [];
  const base = {
    _grist_ACLResources: [{ id: 1, tableId: '', colIds: '' }],
    _grist_ACLRules: [BUILT_IN],
    _grist_Tables: [{ id: 1, tableId: 'Clients' }],
    _grist_Tables_column: [],
    ...tables,
  };
  const port = { doc: { fetchTable: async name => { asked.push(name); if (failing.includes(name)) throw new Error('Table not found'); return columns(base[name] || []); } } };
  const calls = { owner: 0 };
  const transfer = { isOwner: async () => { calls.owner += 1; return typeof owner === 'function' ? owner() : owner; } };
  return { reader: new RightsReader({ port, transfer, now: () => now.t }), asked, calls, now };
}

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

test('raw : avec files:false, les tables de fichiers ne sont pas lues (« Gérer les partages » n\'en a pas besoin) ; par défaut elles le sont, pour l\'activation', async () => {
  const tables = { _grist_Tables: [{ id: 1, tableId: 'GFS_Files' }], GFS_Files: [{ id: 1, FileId: 'a' }, { id: 2, FileId: 'b' }] };
  const light = setup({ tables });
  const lite = await light.reader.raw({ files: false });
  assert.deepEqual([lite.fileIds, lite.files, light.asked.includes('GFS_Files')], [[], {}, false]);
  const full = setup({ tables });
  const whole = await full.reader.raw();
  assert.deepEqual([whole.fileIds, full.asked.includes('GFS_Files')], [['a', 'b'], true]);
});

test('raw : les déclarations de fichiers que le lecteur reçoit (`specs`) vont avec les lignes, pour le plan de l\'index des noms ; sans elles, une liste vide', async () => {
  const specs = [{ table: 'Pub_Modeles', spec: { colonnes: { id: 'id' } } }];
  const { reader } = setup();
  assert.deepEqual((await reader.raw({ files: false })).specs, []);
  const asked = [];
  const port = { doc: { fetchTable: async name => { asked.push(name); return columns(name === '_grist_Tables' ? [{ id: 1, tableId: 'Clients' }] : []); } } };
  const withSpecs = new RightsReader({ port, transfer: { isOwner: async () => true }, now: () => 0, targets: () => [{ table: 'Pub_Modeles', prefix: 'pub:' }], specs: () => specs });
  assert.deepEqual((await withSpecs.raw({ files: false })).specs, specs);
  assert.ok(!asked.includes('Pub_Modeles'), 'sans les tables de fichiers : la plus lourde du document ne se lit pas');
});
