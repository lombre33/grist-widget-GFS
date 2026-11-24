// La copie d'une table lourde que l'explorateur vient de lire (js/broker/table-cache.js) : rendue à l'app qui s'ouvre, une fois, tant que le document n'a pas bougé.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { TableCache, KEEP_MAX_BYTES } from '../js/broker/table-cache.js';

const TABLE = { id: [1, 2], Nom: ['A', 'B'] };

// Un document de doublure : `fetchTable` compte ses lectures, `applyUserActions` ses écritures ; `state.head` est l'empreinte que le serveur rendrait.
function bench({ head = 'h1', now = () => 1000 } = {}) {
  const state = { head, reads: 0, writes: 0, fail: false };
  const doc = {
    label: 'doc',
    fetchTable: async id => { state.reads += 1; return { ...TABLE, read: state.reads, id: [id] }; },
    applyUserActions: async () => { state.writes += 1; return { ok: true }; },
    whoami() { return this.label; },
  };
  const cache = new TableCache({ head: async () => { if (state.fail) throw new Error('réseau coupé'); return state.head; }, now: () => now.value ?? now() });
  return { cache, state, doc: cache.wrap(doc), tick: now };
}

test('le document n\'a pas bougé : la copie est rendue sans relire, une seule fois', async () => {
  const { cache, state, doc } = bench();
  const mark = await cache.mark();
  cache.keep(mark, [{ id: 'Modeles', data: TABLE }], 5e6);
  assert.equal(await doc.fetchTable('Modeles'), TABLE);
  assert.equal(state.reads, 0);
  assert.equal((await doc.fetchTable('Modeles')).read, 1, 'la copie a servi : la seconde demande lit');
});

test('le nom de la table se compare sans tenir compte de la casse (Grist en garde la sienne)', async () => {
  const { cache, doc } = bench();
  cache.keep(await cache.mark(), [{ id: 'Publipostage_Modeles', data: TABLE }], 5e6);
  assert.equal(await doc.fetchTable('publipostage_modeles'), TABLE);
});

test('le document a bougé (empreinte autre) : la table se relit, et la copie est perdue', async () => {
  const { cache, state, doc } = bench();
  cache.keep(await cache.mark(), [{ id: 'Modeles', data: TABLE }], 5e6);
  state.head = 'h2';
  assert.equal((await doc.fetchTable('Modeles')).read, 1);
  state.head = 'h1';
  assert.equal((await doc.fetchTable('Modeles')).read, 2, 'une copie refusée ne revient pas');
});

test('le serveur ne répond pas ou ne rend pas d\'empreinte : la table se relit', async () => {
  const silent = bench();
  silent.cache.keep(await silent.cache.mark(), [{ id: 'Modeles', data: TABLE }], 5e6);
  silent.state.fail = true;
  assert.equal((await silent.doc.fetchTable('Modeles')).read, 1);
  const none = bench();
  none.cache.keep(await none.cache.mark(), [{ id: 'Modeles', data: TABLE }], 5e6);
  none.state.head = null;
  assert.equal((await none.doc.fetchTable('Modeles')).read, 1);
});

test('une écriture, d\'où qu\'elle vienne par GFS, fait oublier les copies ; elle passe telle quelle', async () => {
  const { cache, state, doc } = bench();
  cache.keep(await cache.mark(), [{ id: 'Modeles', data: TABLE }], 5e6);
  assert.deepEqual(await doc.applyUserActions([['AddRecord', 'X', null, {}]]), { ok: true });
  assert.equal(state.writes, 1);
  assert.equal(cache.size, 0);
  assert.equal((await doc.fetchTable('Modeles')).read, 1);
});

test('une copie vieille de plus de deux minutes ne sert plus', async () => {
  const { cache, state, doc, tick } = bench({ now: { value: 0 } });
  cache.keep(await cache.mark(), [{ id: 'Modeles', data: TABLE }], 5e6);
  tick.value = 2 * 60 * 1000 + 1;
  assert.equal((await doc.fetchTable('Modeles')).read, 1);
  assert.equal(state.reads, 1);
});

test('sans empreinte d\'avant la lecture, ou pour un document trop lourd pour la mémoire, rien ne se garde', async () => {
  const { cache, doc } = bench();
  cache.keep(null, [{ id: 'Modeles', data: TABLE }], 5e6);
  cache.keep('h1', [{ id: 'Modeles', data: TABLE }], KEEP_MAX_BYTES + 1);
  assert.equal(cache.size, 0);
  assert.equal((await doc.fetchTable('Modeles')).read, 1);
});

test('l\'empreinte ne se prend qu\'une fois par page : la première lecture ; les suivantes n\'ont rien à attendre', async () => {
  const { cache } = bench();
  assert.equal(await cache.mark(), 'h1');
  assert.equal(cache.mark(), null);
});

test('l\'empreinte d\'avant la lecture qui ne vient pas est abandonnée : l\'explorateur n\'attend jamais plus d\'une seconde et demie', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const cache = new TableCache({ head: () => new Promise(() => {}) });
    const marked = cache.mark();
    mock.timers.tick(1500);
    assert.equal(await marked, null);
  } finally { mock.timers.reset(); }
  const failing = new TableCache({ head: async () => { throw new Error('jeton refusé'); } });
  assert.equal(await failing.mark(), null, 'un refus du serveur n\'arrête rien');
});

test('les autres appels du document passent tels quels, avec leur `this`', async () => {
  const { doc } = bench();
  assert.equal(doc.label, 'doc');
  assert.equal(doc.whoami(), 'doc');
});

// ---------- la lecture complète derrière la liste (`fill`, 24/11) ----------

// Un document dont `fetchTable` se lit lentement : la lecture se termine quand `finish()` est appelé.
function slowBench({ head = 'h1' } = {}) {
  const state = { head, reads: [], waits: [] };
  const doc = { fetchTable: id => new Promise((resolve, reject) => { state.reads.push(id); state.waits.push({ resolve: () => resolve({ ...TABLE, from: 'lecture' }), reject }); }) };
  const cache = new TableCache({ head: async () => state.head });
  return { cache, state, doc: cache.wrap(doc) };
}

test('`fill` lit la table en entier derrière la liste : l\'app qui la demande ensuite la reçoit sans nouvelle lecture, une seule fois', async () => {
  const { cache, state, doc } = slowBench();
  const filling = cache.fill(await cache.mark(), ['Modeles'], 42e6);
  state.waits[0].resolve();
  await filling;
  assert.equal((await doc.fetchTable('Modeles')).from, 'lecture');
  assert.equal(state.reads.length, 1, 'la table n\'a été lue qu\'une fois');
  state.waits[1] && state.waits[1].resolve();
  assert.equal(state.reads.length, 1, 'la copie ne sert qu\'une fois');
});

test('l\'app demande la table pendant qu\'elle se lit encore : elle attend cette lecture au lieu d\'en lancer une seconde', async () => {
  const { cache, state, doc } = slowBench();
  cache.fill(await cache.mark(), ['Modeles'], 42e6);
  const asked = doc.fetchTable('Modeles');
  let done = false;
  asked.then(() => { done = true; });
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(done, false, 'la lecture n\'est pas finie : l\'app attend');
  assert.equal(state.reads.length, 1);
  state.waits[0].resolve();
  assert.equal((await asked).from, 'lecture');
  assert.equal(state.reads.length, 1);
});

test('`fill` lit sans passer par la copie qu\'il remplit, et ne lit pas deux fois une table citée deux fois', async () => {
  const { cache, state } = slowBench();
  const filling = cache.fill(await cache.mark(), ['Modeles', 'modeles', 'Autre'], 42e6);
  await Promise.resolve();
  assert.deepEqual(state.reads, ['Modeles', 'Autre']);
  state.waits.forEach(wait => wait.resolve());
  await filling;
});

test('le document a bougé pendant la lecture derrière la liste : l\'app relit la table', async () => {
  const { cache, state, doc } = slowBench();
  const filling = cache.fill(await cache.mark(), ['Modeles'], 42e6);
  state.head = 'h2';
  state.waits[0].resolve();
  await filling;
  const asked = doc.fetchTable('Modeles');
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(state.reads.length, 2, 'une copie refusée : l\'app lit elle-même');
  state.waits[1].resolve();
  await asked;
});

test('une lecture derrière la liste qui échoue ne garde rien et n\'arrête rien : l\'app lit elle-même', async () => {
  const { cache, state, doc } = slowBench();
  const filling = cache.fill(await cache.mark(), ['Modeles'], 42e6);
  state.waits[0].reject(new Error('Grist ne répond pas'));
  await filling;
  const asked = doc.fetchTable('Modeles');
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(state.reads.length, 2);
  state.waits[1].resolve();
  assert.equal((await asked).from, 'lecture');
});

test('une écriture pendant la lecture derrière la liste fait oublier cette lecture ; sans empreinte ou au-delà de la limite de mémoire, rien ne se lit', async () => {
  const { cache, state, doc } = slowBench();
  const filling = cache.fill(await cache.mark(), ['Modeles'], 42e6);
  doc.applyUserActions && await doc.applyUserActions([]).catch(() => {});
  cache.invalidate();
  state.waits[0].resolve();
  await filling;
  assert.equal(cache.size, 0);
  const idle = slowBench();
  await idle.cache.fill(null, ['Modeles'], 42e6);
  await idle.cache.fill('h1', ['Modeles'], KEEP_MAX_BYTES + 1);
  assert.deepEqual(idle.state.reads, []);
});

test('une copie que personne n\'a prise s\'en va au bout de deux minutes, avec sa mémoire', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { cache } = bench();
    cache.keep('h1', [{ id: 'Modeles', data: TABLE }], 5e6);
    assert.equal(cache.size, 1);
    mock.timers.tick(2 * 60 * 1000 + 1);
    assert.equal(cache.size, 0);
  } finally { mock.timers.reset(); }
});
