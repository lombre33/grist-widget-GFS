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
