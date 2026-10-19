// L'état des apps installées : lire ce que la table dit, changer d'abord puis écrire (une écriture à la fois), revenir en arrière si elle échoue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppsState } from '../js/apps-state.js';
import { TableDeclined } from '../js/rangement.js';
import { readCatalogue } from '../js/libraries.js';
import { publipostage } from './helpers.mjs';

const SRI = `sha384-${'B'.repeat(64)}`;
const catalogue = readCatalogue({ bibliotheques: [{
  id: 'plotly', version: '2.13.2', poids: 1000,
  cdn: { src: 'https://cdn.jsdelivr.net/npm/plotly.js-basic-dist-min@2.13.2/plotly-basic.min.js', integrite: SRI },
  vendorise: { chemin: 'vendor/plotly/2.13.2/plotly-basic.min.js', integrite: SRI },
}] });
const pub = publipostage();
const automation = { id: 'automation', nom: { fr: 'A', en: 'A' }, extensions: [] };
const loaded = [
  { app: { id: 'publipostage' }, manifest: pub, ok: true, errors: [] },
  { app: { id: 'automation' }, manifest: automation, ok: true, errors: [] },
  { app: { id: 'casse' }, manifest: null, ok: false, errors: ['gfs.json absent'] },
];

// Une table du document en mémoire : `value` est ce qu'elle retient ; `fail(raw)` peut refuser l'écriture ; `gate` suspend une écriture pour la mesurer.
function fakeStore({ value = null, fail = null } = {}) {
  const store = {
    value,
    writes: [],
    running: 0,
    maxRunning: 0,
    gates: [],
    read: async () => ({ raw: structuredClone(store.value) }),
    update: async mutate => {
      store.running += 1;
      store.maxRunning = Math.max(store.maxRunning, store.running);
      try {
        if (store.gates.length) await store.gates.shift();
        const failure = fail && fail(store.value);
        if (failure) throw failure;
        const next = mutate(structuredClone(store.value));
        store.writes.push(next);
        store.value = next;
        return structuredClone(next);
      } finally { store.running -= 1; }
    },
  };
  return store;
}

async function setup(options) {
  const store = fakeStore(options);
  let changes = 0;
  const state = new AppsState({ always: ['publipostage'], store, onChange: () => { changes += 1; } });
  state.setApps(loaded);
  state.setCatalogue(catalogue);
  await state.load();
  const start = changes; // le démarrage compte des changements : on mesure à partir de là
  return { state, store, changes: () => changes - start };
}

test('sans valeur retenue : Publipostage+ seul, rien n\'est écrit', async () => {
  const { state, store } = await setup();
  assert.deepEqual(state.installedIds(), ['publipostage']);
  assert.equal(state.stored, false);
  assert.equal(state.has('automation'), false);
  assert.deepEqual(store.writes, []);
});

test('load : suit ce que la table dit, borné par les manifestes ; l\'app qui ne se retire pas reste', async () => {
  const { state } = await setup({ value: { automation: { extensions: [] }, fantome: { extensions: [] } } });
  assert.deepEqual(state.installedIds(), ['publipostage', 'automation']);
  assert.equal(state.stored, true);
});

test('load : une table illisible vaut une table absente, avec un avertissement', async () => {
  const warn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args[0]);
  try {
    const state = new AppsState({ always: ['publipostage'], store: { read: async () => { throw new Error('refusé'); } }, onChange: () => {} });
    state.setApps(loaded);
    await state.load();
    assert.deepEqual(state.installedIds(), ['publipostage']);
    assert.equal(state.stored, false);
    assert.equal(warnings.length, 1);
  } finally { console.warn = warn; }
});

test('setApp : l\'état change avant l\'écriture, la première écriture part de ce que la fenêtre montrait', async () => {
  const { state, store, changes } = await setup();
  const done = state.setApp('automation', true);
  assert.equal(state.has('automation'), true, 'la fenêtre répond tout de suite');
  assert.equal(state.busy, true);
  assert.ok(changes() >= 1);
  assert.equal(await done, true);
  assert.equal(state.busy, false);
  assert.deepEqual(store.writes, [{ publipostage: { extensions: [] }, automation: { extensions: [] } }]);
  assert.equal(state.stored, true);
  assert.equal(await state.setApp('automation', true), false, 'déjà installée : rien à écrire');
  assert.equal(await state.setApp('publipostage', false), false, 'Publipostage+ ne se retire pas');
  assert.equal(await state.setApp('fantome', true), false);
  assert.equal(store.writes.length, 1);
});

test('une écriture ne change que l\'entrée touchée : ce que cette version ne connaît pas reste dans la table', async () => {
  const { state, store } = await setup({ value: { publipostage: { extensions: [], reserve: 'a' }, nouvelle: { extensions: ['x'] } } });
  await state.setExtension('publipostage', 'graphique', true);
  assert.deepEqual(store.value, { publipostage: { extensions: ['graphique'], reserve: 'a' }, nouvelle: { extensions: ['x'] } });
  await state.setApp('automation', true);
  assert.deepEqual(Object.keys(store.value), ['publipostage', 'nouvelle', 'automation']);
  await state.setApp('automation', false);
  assert.deepEqual(Object.keys(store.value), ['publipostage', 'nouvelle']);
});

test('chaque écriture part de la table relue : ce qu\'une autre section a écrit entre-temps n\'est pas défait', async () => {
  const { state, store } = await setup({ value: { publipostage: { extensions: [] } } });
  store.value = { publipostage: { extensions: [] }, automation: { extensions: [] } }; // une autre section vient d'installer Automation+
  await state.setExtension('publipostage', 'graphique', true);
  assert.deepEqual(store.value, { publipostage: { extensions: ['graphique'] }, automation: { extensions: [] } });
});

test('setExtension et setMode : par extension, bornés par le manifeste', async () => {
  const { state, store } = await setup();
  assert.equal(await state.setExtension('publipostage', 'graphique', true), true);
  assert.equal(await state.setMode('publipostage', 'graphique', 'vendorise'), true);
  assert.deepEqual(store.writes.at(-1), { publipostage: { extensions: ['graphique'], modes: { graphique: 'vendorise' } } });
  assert.equal(await state.setExtension('publipostage', 'inconnue', true), false);
  assert.equal(await state.setExtension('automation', 'graphique', true), false, 'une app non installée ne reçoit rien');
  const given = state.extensionsFor('publipostage', 'https://exemple.test/gfs/');
  assert.deepEqual(given.extensions, ['graphique']);
  assert.match(given.bibliotheques.plotly.src, /^https:\/\/exemple\.test\/gfs\/vendor\/plotly\/2\.13\.2\//);
});

test('une écriture refusée : l\'état revient à ce que la table a dit, l\'erreur remonte', async () => {
  const { state, store, changes } = await setup({ value: { publipostage: { extensions: [] } }, fail: () => new Error('refusé') });
  const before = changes();
  await assert.rejects(state.setApp('automation', true), /refusé/);
  assert.equal(state.has('automation'), false);
  assert.equal(state.busy, false);
  assert.ok(changes() - before >= 2, 'un changement, puis le retour');
  assert.deepEqual(store.value, { publipostage: { extensions: [] } });
});

test('l\'accord refusé : rien ne s\'installe, la case revient, l\'erreur dit pourquoi', async () => {
  const { state, store } = await setup({ fail: () => new TableDeclined() });
  await assert.rejects(state.setApp('automation', true), error => error instanceof TableDeclined);
  assert.equal(state.has('automation'), false);
  assert.equal(state.stored, false);
  assert.equal(store.value, null);
});

test('deux gestes de suite : les écritures passent l\'une après l\'autre, la seconde part de la première', async () => {
  const { state, store } = await setup({ value: { publipostage: { extensions: [] } } });
  let release;
  store.gates.push(new Promise(resolve => { release = resolve; }));
  const first = state.setApp('automation', true);
  const second = state.setExtension('publipostage', 'graphique', true);
  assert.equal(state.has('automation'), true);
  assert.deepEqual(state.apps.publipostage.extensions, ['graphique'], 'les deux gestes se voient tout de suite');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(store.running, 1, 'une seule écriture à la fois');
  release();
  await Promise.all([first, second]);
  assert.equal(store.maxRunning, 1);
  assert.deepEqual(store.value, { publipostage: { extensions: ['graphique'] }, automation: { extensions: [] } });
  assert.equal(state.busy, false);
});

test('le premier geste refusé n\'empêche pas le suivant d\'être écrit', async () => {
  let refuse = true;
  const { state, store } = await setup({ fail: () => (refuse ? new Error('non') : null) });
  const first = state.setApp('automation', true);
  const rejected = assert.rejects(first, /non/);
  await rejected;
  refuse = false;
  assert.equal(await state.setApp('automation', true), true);
  assert.deepEqual(store.value, { publipostage: { extensions: [] }, automation: { extensions: [] } });
});

test('model : une ligne par app (l\'invalide grisée) puis par extension', async () => {
  const { state } = await setup();
  const model = state.model();
  assert.deepEqual(model.items.map(item => `${item.kind}:${item.id || item.extension.id}`), ['app:publipostage', 'ext:graphique', 'ext:edition', 'ext:diapositives', 'app:automation', 'app:casse']);
  assert.equal(model.items.at(-1).ok, false);
});
