// La liste qui se tient à jour toute seule (js/explorer/live-list.js, demande du porteur du 25/11 : « tout les 5 s ok, que ça voie tout, et les gros fichiers sans
// impact ») : le rythme suit le coût, rien ne tourne quand l'explorateur est fermé, la page cachée, un menu ouvert ou la personne partie, et un document lourd lu en
// entier ne se relit pas tout seul. Le temps et le document sont des doublures ; ce que Grist rend vraiment se mesure dans le labo (labo/run-direct.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LiveList, paceOf, LIVE_EVERY, LIVE_EVERY_REST, LIVE_IDLE } from '../js/explorer/live-list.js';
import { HEAVY_BYTES } from '../js/explorer/explorer-sql.js';
import { listSignature } from '../js/explorer/list-signature.js';

// Un document de page qui garde ses écoutes, et une horloge à la main.
function bench(over = {}) {
  const listeners = new Map();
  const doc = {
    visibilityState: 'visible', layers: 0,
    addEventListener: (type, fn) => listeners.set(type, [...(listeners.get(type) || []), fn]),
    removeEventListener: (type, fn) => listeners.set(type, (listeners.get(type) || []).filter(one => one !== fn)),
    querySelector: () => (doc.layers ? {} : null),
  };
  const state = { now: 1_000_000, open: true, read: true, loading: false, timer: null, asked: [] };
  const live = new LiveList({
    doc, now: () => state.now, isOpen: () => state.open, canRead: () => state.read, loading: () => state.loading,
    refresh: opts => state.asked.push(opts), setTimer: (fn, ms) => { state.timer = { fn, ms }; return 1; }, clearTimer: () => { state.timer = null; }, ...over,
  });
  const fire = type => (listeners.get(type) || []).forEach(fn => fn({}));
  const tick = () => { const { fn } = state.timer; fn(); };
  return { doc, state, live, fire, tick, listeners };
}

test('le pas : 5 s, 15 s par l\'API REST, jamais plus vite que 5 fois la durée de la lecture, et rien pour un document lourd lu en entier', () => {
  assert.equal(paceOf(null), LIVE_EVERY);
  assert.equal(paceOf({ ms: 40, bytes: 1000, light: false }), LIVE_EVERY);
  assert.equal(paceOf({ ms: 3000, bytes: 1000, light: false }), 15000, 'une lecture lente espace la suivante');
  assert.equal(paceOf({ ms: 30, bytes: 900 * 1024 * 1024, light: true }), LIVE_EVERY_REST, 'la lecture légère passe par l\'API REST : plus lente');
  assert.equal(paceOf({ ms: 30, bytes: 900 * 1024 * 1024, light: false, indexed: true }), LIVE_EVERY, 'l\'index des noms : une lecture sans contenu, même sur un gros document');
  assert.equal(paceOf({ ms: 30, bytes: 900 * 1024 * 1024, light: false }), null, 'sans index, un gros document lu en entier ne se relit pas tout seul');
  assert.equal(paceOf({ ms: 30, bytes: HEAVY_BYTES - 1, light: false }), LIVE_EVERY);
  assert.equal(paceOf({ ms: 800, bytes: HEAVY_BYTES, light: false }), null, 'un document lourd lu en entier : jamais relu tout seul');
});

test('une relecture silencieuse toutes les 5 s tant que l\'explorateur est ouvert', () => {
  const b = bench();
  b.live.start();
  assert.equal(b.state.timer.ms, LIVE_EVERY);
  b.tick(); b.tick();
  assert.deepEqual(b.state.asked, [{ quiet: true, live: true }, { quiet: true, live: true }]);
  assert.equal(b.state.timer.ms, LIVE_EVERY, 'le pas se reprogramme');
});

test('le pas suit ce que la dernière lecture a coûté', () => {
  const b = bench();
  b.live.start();
  b.live.note({ ms: 30, bytes: 800 * 1024 * 1024, light: true });
  b.tick();
  assert.equal(b.state.timer.ms, LIVE_EVERY_REST);
  b.live.note({ ms: 4000, bytes: 100, light: false });
  b.tick();
  assert.equal(b.state.timer.ms, 20000);
});

test('un document lourd qui ne se lit qu\'en entier ne se relit pas tout seul, et reprend si une lecture légère devient possible', () => {
  const b = bench();
  b.live.start();
  b.live.note({ ms: 900, bytes: HEAVY_BYTES * 3, light: false });
  b.tick(); b.tick();
  assert.deepEqual(b.state.asked, []);
  b.live.note({ ms: 30, bytes: HEAVY_BYTES * 3, light: true });
  b.tick();
  assert.equal(b.state.asked.length, 1);
});

test('rien ne tourne : explorateur fermé, accès incomplet, lecture en cours, page cachée, menu ou fenêtre ouverts', () => {
  const b = bench();
  b.live.start();
  const none = () => { const before = b.state.asked.length; b.tick(); assert.equal(b.state.asked.length, before); };
  b.state.open = false; none(); b.state.open = true;
  b.state.read = false; none(); b.state.read = true;
  b.state.loading = true; none(); b.state.loading = false;
  b.doc.visibilityState = 'hidden'; none(); b.doc.visibilityState = 'visible';
  b.doc.layers = 1; none(); b.doc.layers = 0;
  b.tick();
  assert.equal(b.state.asked.length, 1, 'tout redevenu libre, la relecture repart');
});

test('cinq minutes sans geste : elle s\'arrête ; le premier geste la relance tout de suite', () => {
  const b = bench();
  b.live.start();
  b.state.now += LIVE_IDLE;
  b.tick();
  assert.equal(b.state.asked.length, 0, 'la personne est partie');
  b.fire('pointerdown');
  assert.equal(b.state.asked.length, 1, 'un geste après le calme relit tout de suite');
  b.state.now += 100;
  b.fire('keydown');
  assert.equal(b.state.asked.length, 1, 'un geste pendant le travail ne relit rien de plus');
});

test('le retour sur l\'onglet relit tout de suite, mais pas deux fois en moins d\'une seconde', () => {
  const b = bench();
  b.live.start();
  b.doc.visibilityState = 'hidden'; b.fire('visibilitychange');
  assert.equal(b.state.asked.length, 0);
  b.doc.visibilityState = 'visible'; b.fire('visibilitychange');
  assert.equal(b.state.asked.length, 1);
  b.fire('visibilitychange');
  assert.equal(b.state.asked.length, 1);
  b.state.now += 1500; b.fire('visibilitychange');
  assert.equal(b.state.asked.length, 2);
});

test('arrêtée, elle ne laisse ni minuterie ni écoute', () => {
  const b = bench();
  b.live.start();
  b.live.stop();
  assert.equal(b.state.timer, null);
  assert.ok([...b.listeners.values()].every(list => list.length === 0));
  assert.equal(b.live.running, false);
});

test('l\'empreinte d\'une lecture : un renommage, un déplacement, une suppression ou un poids changent l\'empreinte ; le contenu qui ne se voit pas, non', () => {
  const file = (over = {}) => ({ key: 'pp:1', name: 'Convocation', folder: 'Formation', ts: 5, by: 'a@x.fr', weight: 100, pinned: false, typeInfo: { x: 1 }, search: 'convocation', pieces: [], ...over });
  const read = (files, over = {}) => ({ files, trash: [], folders: [], received: [], spaces: null, problems: [], ...over });
  const base = listSignature(read([file()]));
  assert.equal(listSignature(read([file({ typeInfo: { x: 2 }, search: 'autre', pieces: [['a', 3]] })])), base, 'ce qui se déduit du reste ne compte pas');
  for (const changed of [{ name: 'Renommé' }, { folder: 'Archives' }, { weight: 101 }, { ts: 6 }, { by: 'b@x.fr' }, { pinned: true }]) {
    assert.notEqual(listSignature(read([file(changed)])), base, JSON.stringify(changed));
  }
  assert.notEqual(listSignature(read([])), base, 'un fichier supprimé');
  assert.notEqual(listSignature(read([file(), file({ key: 'pp:2' })])), base, 'un fichier créé');
  assert.notEqual(listSignature(read([file()], { problems: [{ app: 'pp' }] })), base, 'une app qui devient illisible');
  const space = { spaces: [{ key: 'a', name: 'A', path: 'Espaces/A' }], links: [], placed: new Map([['pp:1', { space: { key: 'a' }, folder: '' }]]) };
  assert.notEqual(listSignature(read([file()], { spaces: space })), base, 'un placement dans un espace');
});
