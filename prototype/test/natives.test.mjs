// Les bibliothèques natives d'une app, rangées par fonction : CDN ou copie figée au choix (contrats 2.6, point 14 ; étude `docs/etude-cdn-ou-copie.md`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest } from '../js/manifest.js';
import { readCatalogue } from '../js/libraries.js';
import { nativeRows, nativesState, modeOfGroup, nativeKey } from '../js/natives.js';
import { readApps, patchApps, withNativeMode, withExtension } from '../js/settings.js';
import { AppsState } from '../js/apps-state.js';
import { buildContext } from '../js/context.js';
import { publipostage } from './helpers.mjs';

const SRI = `sha384-${'C'.repeat(64)}`;
const entry = (id, version, poids) => ({ id, version, poids, cdn: { src: `https://cdn.jsdelivr.net/npm/${id}@${version}/${id}.js`, integrite: SRI }, vendorise: { chemin: `vendor/${id}/${version}/${id}.js`, integrite: SRI } });
const catalogue = readCatalogue({ bibliotheques: [entry('pdfmake', '0.2.7', 2048), entry('pdfmake-polices', '0.2.7', 1024), entry('docx', '9.15.1', 4096)] });
const groups = [
  { id: 'pdf', nom: { fr: 'Export PDF', en: 'PDF export' }, bibliotheques: [{ id: 'pdfmake', version: '0.2.7' }, { id: 'pdfmake-polices', version: '0.2.7' }] },
  { id: 'word', nom: { fr: 'Export Word', en: 'Word export' }, bibliotheques: [{ id: 'docx', version: '9.15.1' }] },
];
const manifest = () => ({ ...publipostage(), natives: structuredClone(groups) });
const BASE = 'https://exemple.test/gfs/index.html';

test('manifeste : des fonctions de bibliothèques natives valides passent ; une forme fausse est refusée avec sa raison', () => {
  assert.deepEqual(validateManifest(manifest()).errors, []);
  const refuse = (change, reason) => {
    const m = manifest();
    change(m);
    assert.match(validateManifest(m).errors.join('|'), reason);
  };
  refuse(m => { m.natives = 'pdf'; }, /natives : liste attendue/);
  refuse(m => { delete m.natives[0].nom; }, /natives\[\] : id et nom \(fr, en\) attendus/);
  refuse(m => { m.natives[1].id = 'pdf'; }, /natives pdf : fonction déjà déclarée/);
  refuse(m => { m.natives[0].bibliotheques = []; }, /natives pdf : bibliotheques : liste non vide attendue/);
  refuse(m => { m.natives[0].bibliotheques[0].version = '^0.2.7'; }, /la version de pdfmake doit être exacte/);
  refuse(m => { m.natives[1].bibliotheques.push({ id: 'pdfmake', version: '0.2.7' }); }, /natives word : pdfmake est déjà dans une autre fonction/);
  assert.deepEqual(validateManifest(publipostage()).errors, [], 'sans `natives`, rien ne change');
});

test('nativeRows : le CDN par défaut, la copie figée choisie, et jamais une fonction servie à moitié', () => {
  const m = manifest();
  const key = nativeKey('pdf');
  assert.equal(key, 'natif:pdf');
  const none = nativeRows(m, { extensions: [], modes: {} }, catalogue);
  assert.deepEqual(none.map(row => [row.group.id, row.mode, row.poids, row.missing.length]), [['pdf', 'cdn', 3072, 0], ['word', 'cdn', 4096, 0]]);
  const copy = nativeRows(m, { extensions: [], modes: { [key]: 'vendorise' } }, catalogue);
  assert.deepEqual(copy.map(row => row.mode), ['vendorise', 'cdn']);
  const half = readCatalogue({ bibliotheques: [entry('pdfmake', '0.2.7', 2048)] });
  const [pdf] = nativeRows(m, { extensions: [], modes: { [key]: 'vendorise' } }, half);
  assert.equal(pdf.mode, 'cdn', 'sans les polices, la copie figée n\'est pas servie : le CDN reste en vigueur');
  assert.deepEqual(pdf.missing, [{ id: 'pdfmake-polices', version: '0.2.7' }]);
  assert.equal(modeOfGroup({ modes: { [key]: 'vendorise' } }, 'pdf'), 'vendorise', 'le choix retenu n\'est pas modifié pour autant');
  assert.equal(modeOfGroup({ modes: { [key]: 'autre' } }, 'pdf'), 'cdn');
  assert.equal(modeOfGroup(undefined, 'pdf'), 'cdn');
});

test('nativesState : l\'app ne reçoit que les copies des fonctions en copie figée, avec leur version', () => {
  const m = manifest();
  assert.deepEqual(nativesState(m, { extensions: [], modes: {} }, catalogue, BASE), {});
  assert.deepEqual(nativesState(m, undefined, catalogue, BASE), {}, 'une app non installée ne reçoit rien');
  const state = nativesState(m, { extensions: [], modes: { 'natif:pdf': 'vendorise' } }, catalogue, BASE);
  assert.deepEqual(Object.keys(state), ['pdfmake', 'pdfmake-polices']);
  assert.deepEqual(state.pdfmake, { version: '0.2.7', src: 'https://exemple.test/gfs/vendor/pdfmake/0.2.7/pdfmake.js', integrite: SRI, forme: 'script' });
  assert.equal(JSON.stringify(state).includes('jsdelivr'), false, 'jamais l\'adresse du CDN de GFS : le CDN d\'une app est le sien (contrats 2.6, point 14)');
});

test('settings : le mode d\'une fonction, ou de toutes ; le CDN n\'est pas écrit ; ce que cette version ne connaît pas est gardé', () => {
  const m = manifest();
  const apps = readApps({ publipostage: { extensions: [] } }, new Map([[m.id, m]]), [m.id]).apps;
  const pdf = withNativeMode(apps, m, 'pdf', 'vendorise');
  assert.deepEqual(pdf.publipostage.modes, { 'natif:pdf': 'vendorise' });
  const all = withNativeMode(apps, m, null, 'vendorise');
  assert.deepEqual(all.publipostage.modes, { 'natif:pdf': 'vendorise', 'natif:word': 'vendorise' });
  assert.deepEqual(withNativeMode(all, m, 'word', 'cdn').publipostage.modes, { 'natif:pdf': 'vendorise' }, 'revenir au CDN retire la clé');
  assert.deepEqual(withNativeMode(all, m, null, 'cdn').publipostage.modes, {});
  assert.equal(withNativeMode(apps, m, 'inconnue', 'vendorise'), apps, 'une fonction que le manifeste ne déclare pas ne s\'écrit pas');
  assert.equal(withNativeMode(apps, m, 'pdf', 'ftp'), apps);
  assert.equal(withNativeMode(apps, { id: 'automation' }, null, 'vendorise'), apps);
  const kept = patchApps({ publipostage: { extensions: ['graphique'], modes: { 'natif:word': 'vendorise', 'natif:futur': 'vendorise', graphique: 'vendorise' } } }, m.id, pdf.publipostage, m);
  assert.deepEqual(kept.publipostage.modes, { 'natif:futur': 'vendorise', 'natif:pdf': 'vendorise' }, 'la clé d\'une fonction connue est remplacée, celle d\'une fonction inconnue gardée');
  const read = readApps({ publipostage: { extensions: [], modes: { 'natif:pdf': 'vendorise', 'natif:vieux': 'vendorise', 'natif:word': 'cdn' } } }, new Map([[m.id, m]]), [m.id]);
  assert.deepEqual(read.apps.publipostage.modes, { 'natif:pdf': 'vendorise' }, 'un mode lu ne porte que les fonctions du manifeste et jamais le CDN');
  assert.deepEqual(withExtension(pdf, m, 'graphique', true).publipostage.modes, { 'natif:pdf': 'vendorise' }, 'cocher une extension ne touche pas aux fonctions natives');
});

test('AppsState : le geste écrit dans la table, le modèle de la fenêtre et l\'app le voient', async () => {
  const m = { ...manifest(), permanente: true };
  const store = { value: null, writes: [], read: async () => ({ raw: structuredClone(store.value) }), update: async (mutate) => { store.value = mutate(structuredClone(store.value)); store.writes.push(store.value); return structuredClone(store.value); } };
  const state = new AppsState({ store, onChange: () => {} });
  state.setCatalogue(catalogue);
  state.setApps([{ app: { id: m.id }, manifest: m, ok: true, errors: [] }]);
  await state.load();
  const rows = () => state.model().items.find(item => item.id === m.id).natives.map(row => `${row.group.id}:${row.mode}`);
  assert.deepEqual(rows(), ['pdf:cdn', 'word:cdn']);
  assert.deepEqual(state.extensionsFor(m.id, BASE).natives, {});
  assert.equal(await state.setNativeMode(m.id, 'pdf', 'vendorise'), true);
  assert.deepEqual(rows(), ['pdf:vendorise', 'word:cdn']);
  assert.deepEqual(store.value.publipostage.modes, { 'natif:pdf': 'vendorise' });
  assert.deepEqual(Object.keys(state.extensionsFor(m.id, BASE).natives), ['pdfmake', 'pdfmake-polices']);
  assert.equal(await state.setNativeMode(m.id, 'pdf', 'vendorise'), false, 'rien à écrire quand le choix ne change pas');
  assert.equal(await state.setNativeMode('inconnue', null, 'vendorise'), false);
  await state.setNativeMode(m.id, null, 'cdn');
  assert.deepEqual(rows(), ['pdf:cdn', 'word:cdn']);
});

test('le contexte de l\'app porte les copies figées choisies, `{}` sinon', () => {
  const facts = { instance: 'https://docs.getgrist.com', document: 'abc123', page: 4, widgetAddress: BASE };
  const base = { access: 'read table', extensions: [], libraries: {} };
  assert.deepEqual(buildContext(facts, base, { preferences: {}, readonly: false }).natives, {});
  const natives = nativesState(manifest(), { extensions: [], modes: { 'natif:word': 'vendorise' } }, catalogue, BASE);
  assert.deepEqual(buildContext(facts, { ...base, natives }, { preferences: {}, readonly: false }).natives, natives);
});
