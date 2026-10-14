// L'état des apps installées : lire ce que Grist dit, changer d'abord puis écrire, revenir en arrière si l'écriture échoue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppsState } from '../js/apps-state.js';
import { readCatalogue } from '../js/libraries.js';
import { APPS_KEY } from '../js/settings.js';
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

function setup(write = async () => {}) {
  const writes = [];
  let changes = 0;
  const state = new AppsState({ always: ['publipostage'], write: async (key, value) => { writes.push([key, value]); await write(key, value); }, onChange: () => { changes += 1; } });
  state.setApps(loaded);
  state.setCatalogue(catalogue);
  state.read(null);
  const start = changes; // le démarrage compte un changement : on mesure à partir de là
  return { state, writes, changes: () => changes - start };
}

test('sans réglage retenu : Publipostage+ seul, rien n\'est écrit', () => {
  const { state, writes } = setup();
  assert.deepEqual(state.installedIds(), ['publipostage']);
  assert.equal(state.stored, false);
  assert.equal(state.has('automation'), false);
  assert.deepEqual(writes, []);
});

test('read : suit ce que Grist dit, borné par les manifestes ; l\'app qui ne se retire pas reste', () => {
  const { state, changes } = setup();
  state.read({ [APPS_KEY]: { automation: { extensions: [] }, fantome: { extensions: [] } } });
  assert.deepEqual(state.installedIds(), ['publipostage', 'automation']);
  assert.equal(state.stored, true);
  assert.equal(changes(), 1);
  state.read({ [APPS_KEY]: { automation: { extensions: [] } } });
  assert.equal(changes(), 1, 'un message identique ne signale rien');
});

test('setApp : l\'état change avant l\'écriture, la clé est celle de GFS, l\'ordre celui du catalogue', async () => {
  const { state, writes, changes } = setup();
  const done = state.setApp('automation', true);
  assert.equal(state.has('automation'), true, 'la fenêtre répond tout de suite');
  assert.equal(changes(), 1);
  assert.equal(await done, true);
  assert.deepEqual(writes, [[APPS_KEY, { publipostage: { extensions: [] }, automation: { extensions: [] } }]]);
  assert.equal(await state.setApp('automation', true), false, 'déjà installée : rien à écrire');
  assert.equal(await state.setApp('publipostage', false), false, 'Publipostage+ ne se retire pas');
  assert.equal(await state.setApp('fantome', true), false);
  assert.equal(writes.length, 1);
});

test('setExtension et setMode : par extension, bornés par le manifeste', async () => {
  const { state, writes } = setup();
  assert.equal(await state.setExtension('publipostage', 'graphique', true), true);
  assert.equal(await state.setMode('publipostage', 'graphique', 'vendorise'), true);
  assert.deepEqual(writes.at(-1)[1], { publipostage: { extensions: ['graphique'], modes: { graphique: 'vendorise' } } });
  assert.equal(await state.setExtension('publipostage', 'inconnue', true), false);
  assert.equal(await state.setExtension('automation', 'graphique', true), false, 'une app non installée ne reçoit rien');
  const given = state.extensionsFor('publipostage', 'https://exemple.test/gfs/');
  assert.deepEqual(given.extensions, ['graphique']);
  assert.match(given.bibliotheques.plotly.src, /^https:\/\/exemple\.test\/gfs\/vendor\/plotly\/2\.13\.2\//);
});

test('une écriture refusée : l\'état revient à ce que Grist a dit en dernier, l\'erreur remonte', async () => {
  const { state, changes } = setup(async () => { throw new Error('refusé'); });
  state.read({ [APPS_KEY]: { publipostage: { extensions: [] } } });
  const before = changes();
  await assert.rejects(state.setApp('automation', true), /refusé/);
  assert.equal(state.has('automation'), false);
  assert.equal(changes() - before, 2, 'un changement, puis le retour');
});

test('pendant une écriture, l\'écho d\'une écriture plus ancienne ne défait pas le choix', async () => {
  let release;
  const { state } = setup(() => new Promise(resolve => { release = resolve; }));
  const done = state.setApp('automation', true);
  state.read({ [APPS_KEY]: { publipostage: { extensions: [] } } }); // l'écho d'avant
  assert.equal(state.has('automation'), true);
  release();
  await done;
  assert.equal(state.has('automation'), true);
  state.read({ [APPS_KEY]: { publipostage: { extensions: [] }, automation: { extensions: [] } } });
  assert.equal(state.has('automation'), true);
});

test('model : une ligne par app (l\'invalide grisée) puis par extension', () => {
  const { state } = setup();
  const model = state.model();
  assert.deepEqual(model.items.map(item => `${item.kind}:${item.id || item.extension.id}`), ['app:publipostage', 'ext:graphique', 'app:automation', 'app:casse']);
  assert.equal(model.items.at(-1).ok, false);
});
