// Le geste du propriétaire pour l'index des noms (js/rights/index-control.js ; choix du porteur du 26/11) : les raisons de refuser, la question posée avant d'écrire, ce
// qui se fait quand Grist a accepté, et les déclarations de fichiers que le lecteur et le rangement des pages en tirent (js/files/file-specs.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IndexControl } from '../js/rights/index-control.js';
import { fileSpecsOf } from '../js/files/file-specs.js';
import { publipostage } from './helpers.mjs';

const t = (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key);
const PLAN = { ok: true, actions: [['AddColumn']], again: false, creates: [], skipped: [], tables: ['Pub_Modeles'], rules: false };

function setup({ plan = PLAN, apply = { ok: true }, full = true, blocked = null, answer = true } = {}) {
  const log = { notices: [], asked: [], refreshed: 0, tidied: 0, applied: [] };
  const writer = { indexPlan: async () => plan, apply: async (kind, resume) => { log.applied.push([kind, resume]); return apply; } };
  const control = new IndexControl({ writer, t, container: {}, inertTargets: () => [], fullAccess: () => full, writeBlock: () => blocked, notice: text => log.notices.push(text),
    refresh: () => { log.refreshed += 1; }, tidy: () => { log.tidied += 1; }, ask: async options => { log.asked.push(options); return answer; } });
  return { control, log };
}

test('why : grisé sans l\'accès complet ou quand le document ne s\'écrit pas, jamais caché ; un clic dit la raison et n\'écrit rien', async () => {
  assert.equal(setup().control.why(), null);
  assert.equal(setup({ full: false }).control.why(), 'share.noAccess');
  assert.equal(setup({ blocked: 'Document en lecture seule.' }).control.why(), 'Document en lecture seule.');
  const closed = setup({ full: false });
  assert.equal(await closed.control.open(), false);
  assert.deepEqual(closed.log.notices, ['share.noAccess']);
  assert.deepEqual(closed.log.applied, []);
});

test('open : qui n\'est pas propriétaire, ou rien à indexer, ou déjà fait, ou des règles d\'autrui : un mot, aucune question, aucune écriture', async () => {
  for (const [plan, word] of [[null, 'index.notOwner'], [{ ok: false, reason: 'nothing' }, 'index.nothing'], [{ ok: false, reason: 'already' }, 'index.already'],
    [{ ok: false, reason: 'foreign' }, 'index.foreign']]) {
    const { control, log } = setup({ plan });
    assert.equal(await control.open(), false);
    assert.deepEqual(log.notices, [word]);
    assert.deepEqual(log.asked, []);
    assert.deepEqual(log.applied, []);
  }
});

test('open : la question d\'abord, puis l\'écriture ; la liste se relit et les pages se rangent', async () => {
  const { control, log } = setup();
  assert.equal(await control.open(), true);
  assert.equal(log.asked.length, 1);
  assert.equal(log.asked[0].title, 'rights.ask.index.title');
  assert.deepEqual(log.applied, [['index', 'index']]);
  assert.deepEqual([log.refreshed, log.tidied], [1, 1]);
  assert.deepEqual(log.notices, ['index.done']);
});

test('open : « Annuler » n\'écrit rien ; un refus de Grist se dit sans « index en place »', async () => {
  const cancelled = setup({ answer: false });
  assert.equal(await cancelled.control.open(), false);
  assert.deepEqual(cancelled.log.applied, []);
  assert.deepEqual(cancelled.log.notices, []);
  const refused = setup({ apply: { ok: false, message: 'Only owners can modify access rules' } });
  assert.equal(await refused.control.open(), false);
  assert.equal(refused.log.asked.at(-1).title, 'rights.ask.index.failed.title');
  assert.deepEqual(refused.log.notices, []);
  assert.deepEqual([refused.log.refreshed, refused.log.tidied], [0, 0]);
});

test('fileSpecsOf : les fichiers de GFS, des annuaires et des apps, chacun avec le nom de sa table', () => {
  const specs = fileSpecsOf([publipostage()]);
  assert.deepEqual(specs.map(item => item.table).slice(0, 3), ['GFS_Files', 'GFS_Directories', 'Publipostage_Modeles']);
  assert.ok(specs.every(item => item.spec.table === item.table));
  assert.deepEqual(fileSpecsOf([]).length, 2);
  assert.deepEqual(fileSpecsOf([{ id: 'sans-fichiers' }]).length, 2);
});
