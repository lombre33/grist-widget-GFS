// Poser et retirer (js/rights-writer.js, js/rights-actions.js ; étape 7 lot a) : une seule liasse envoyée, plan relu au moment d’écrire, rien d’écrit pour un non-propriétaire, la reprise après le
// rechargement que Grist impose, et la question posée avant d’écrire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RightsWriter } from '../js/rights-writer.js';
import { runAction, askOptions } from '../js/rights-actions.js';
import { RANGEMENT } from '../js/rights-plan.js';

const BUILT_IN = { id: 1, resource: 1, permissions: 63, aclFormula: '', permissionsText: '', rulePos: 1, memo: '' };
const RAW = () => ({ resources: [{ id: 1, tableId: '', colIds: '' }], rules: [{ ...BUILT_IN }], tables: [{ id: 5, tableId: RANGEMENT }], columns: [{ parentId: 5, colId: 'Utilisateur' }, { parentId: 5, colId: 'Adresse' }] });
const memoryStore = () => { let value = null; return { read: () => value, write: next => { value = next; return true; } }; };

function setup({ raw = RAW(), fail = null } = {}) {
  const sent = [];
  const store = memoryStore();
  const port = { doc: { applyUserActions: async actions => { if (fail) throw new Error(fail); sent.push(actions); } } };
  const writer = new RightsWriter({ port, reader: { raw: async () => raw }, store });
  return { writer, sent, store };
}

test('apply : une seule liasse, et la reprise retenue avant d’écrire', async () => {
  const { writer, sent, store } = setup();
  assert.deepEqual(await writer.apply('shared'), { ok: true });
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0][1], '_grist_ACLResources');
  assert.equal(store.read(), 'rights');
});

test('apply : un refus de Grist se rend, et la reprise est retirée', async () => {
  const { writer, store } = setup({ fail: 'Only owners can modify access rules' });
  const result = await writer.apply('shared');
  assert.equal(result.ok, false);
  assert.match(result.message, /Only owners/);
  assert.equal(store.read(), null);
});

test('apply : sans lecture des règles (pas propriétaire), ou plan périmé, rien n’est envoyé', async () => {
  const none = setup({ raw: null });
  assert.equal((await none.writer.apply('shared')).reason, 'unreadable');
  assert.equal(none.sent.length, 0);
  const stale = setup({ raw: { ...RAW(), tables: [] } });
  assert.equal((await stale.writer.apply('shared')).reason, 'no-table');
  assert.equal(stale.sent.length, 0);
  assert.equal((await setup().writer.apply('inconnu')).ok, false);
});

test('resume : vrai une seule fois après une pose', async () => {
  const { writer } = setup();
  assert.equal(writer.resume(), false);
  await writer.apply('close');
  assert.equal(writer.resume(), true);
  assert.equal(writer.resume(), false);
});

test('plans : les quatre plans, ou null sans lecture', async () => {
  assert.deepEqual(Object.keys(await setup().writer.plans()).sort(), ['close', 'open', 'remove-level', 'shared']);
  assert.equal(await setup({ raw: null }).writer.plans(), null);
});

const t = (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key);

test('la question dit le prix : première règle, rechargement, et sur la structure ce qu’elle coûte', () => {
  const first = askOptions(t, 'close', { firstRule: true });
  assert.ok(first.items.includes('rights.ask.firstRule') && first.items.includes('rights.ask.close.item1'));
  assert.equal(first.note, 'rights.ask.reload');
  assert.equal(first.safeFirst, true);
  assert.deepEqual(askOptions(t, 'shared', { firstRule: false }).items, []);
});

test('runAction : Annuler n’écrit rien ; accepter écrit ; un échec est dit', async () => {
  const cases = [{ answer: false, written: 0, told: 0 }, { answer: true, written: 1, told: 0 }];
  for (const { answer, written, told } of cases) {
    const { writer, sent } = setup();
    const asked = [];
    const done = await runAction({ kind: 'shared', plans: await writer.plans(), t, ask: async options => { asked.push(options); return answer; }, writer });
    assert.equal(done, answer);
    assert.equal(sent.length, written);
    assert.equal(asked.length - 1, told);
  }
  const bad = setup({ fail: 'refus' });
  const asked = [];
  assert.equal(await runAction({ kind: 'shared', plans: await bad.writer.plans(), t, ask: async options => { asked.push(options); return true; }, writer: bad.writer }), false);
  assert.equal(asked.length, 2);
  assert.match(asked[1].message, /refus/);
});
