// L'image du plan d'un lieu (lot 2 du plan des bâtiments, demande du porteur du 27/11 ; js/annuaire/annuaire-plan-zoom.js, annuaire-plan-map.js, annuaire-plan-image.js) :
// le calcul du zoom et du déplacement, la taille de l'image réduite, qui peut écrire l'image d'un plan, ce qui s'écrit (une seule cellule, jamais une colonne absente) et ce
// que la vue montre (le cadre, les boutons grisés avec leur raison). Du code pur sur un faux Grist ; le glisser, la molette, le clavier et l'envoi d'un vrai fichier
// se mesurent dans le labo, à la vraie souris (labo/run-annuaire-plan.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDocument } from './fake-dom.mjs';
import { ANNUAIRE_PLAN_STRINGS } from '../js/i18n/i18n-annuaire-plan.js';

installFakeDocument();

const { FIT, MAX_ZOOM, clampView, zoomAt, panBy, isFit, wheelFactor, keyMove } = await import('../js/annuaire/annuaire-plan-zoom.js');
const { targetSize, useImages, canUpload } = await import('../js/annuaire/annuaire-images.js');
const { readConfig } = await import('../js/annuaire/annuaire-config.js');
const { planOf } = await import('../js/annuaire/annuaire-plan.js');
const { writePlanImage } = await import('../js/annuaire/annuaire-plan-image.js');
const { imageWhy, traceWhy } = await import('../js/annuaire/annuaire-plan-pane.js');
const { PlanView } = await import('../js/annuaire/annuaire-plan-view.js');
const { createI18n } = await import('../js/i18n/i18n.js');

const { t } = createI18n('fr');
const VW = 400;
const VH = 200;

test('le zoom : l\'image recouvre toujours le cadre, l\'agrandissement reste entre 1 et 8', () => {
  assert.deepEqual(clampView({ k: 0.2, x: 50, y: 50 }, VW, VH), FIT, 'on ne réduit pas sous l\'image entière, et elle ne se décale pas');
  assert.equal(clampView({ k: 99, x: 0, y: 0 }, VW, VH).k, MAX_ZOOM);
  const far = clampView({ k: 2, x: -9999, y: 9999 }, VW, VH);
  assert.deepEqual([far.x, far.y], [VW - VW * 2, 0], 'le bord droit de l\'image ne dépasse pas le bord droit du cadre, le haut ne descend pas');
  assert.equal(isFit(FIT), true);
  assert.equal(isFit({ k: 1.5, x: 0, y: 0 }), false);
});

test('le zoom : ce qui est sous le pointeur y reste', () => {
  const px = 300;
  const py = 120;
  const view = zoomAt(FIT, 2, px, py, VW, VH);
  // le point de l'image qui était sous le pointeur (en coordonnées de l'image à 1×) est à (px − x) / k
  assert.equal((px - view.x) / view.k, px);
  assert.equal((py - view.y) / view.k, py);
  const again = zoomAt(view, 1.5, px, py, VW, VH);
  assert.ok(Math.abs((px - again.x) / again.k - px) < 1e-9 && Math.abs((py - again.y) / again.k - py) < 1e-9);
  assert.deepEqual(zoomAt(view, 1 / 100, px, py, VW, VH), FIT, 'réduire au plus revient à l\'image entière');
  assert.equal(zoomAt({ k: MAX_ZOOM, x: 0, y: 0 }, 2, 10, 10, VW, VH).k, MAX_ZOOM);
});

test('le déplacement : borné par le cadre, sans effet sur l\'image entière', () => {
  assert.deepEqual(panBy(FIT, 30, 30, VW, VH), FIT);
  const zoomed = zoomAt(FIT, 4, 0, 0, VW, VH);
  const moved = panBy(zoomed, -100, -50, VW, VH);
  assert.deepEqual([moved.x, moved.y], [-100, -50]);
  const stuck = panBy(zoomed, -99999, -99999, VW, VH);
  assert.deepEqual([stuck.x, stuck.y], [VW - VW * 4, VH - VH * 4]);
});

test('la molette et le clavier', () => {
  assert.ok(wheelFactor(-100) > 1 && wheelFactor(100) < 1);
  assert.ok(Math.abs(wheelFactor(-100) * wheelFactor(100) - 1) < 1e-9, 'un cran avant et un cran arrière se compensent');
  assert.equal(wheelFactor(-1e6) <= Math.exp(240 * 0.0018) + 1e-9, true, 'un coup de molette violent est borné');
  assert.equal(wheelFactor(-3, 1) > wheelFactor(-1, 1), true, 'la molette en lignes pèse plus que celle en pixels');
  assert.deepEqual(keyMove('+', FIT), { zoom: 1.4, dx: 0, dy: 0 });
  assert.equal(keyMove('-', FIT).zoom < 1, true);
  assert.equal(keyMove('0', FIT).zoom, 0);
  assert.equal(keyMove('ArrowLeft', FIT), null, 'les flèches gardent leur geste habituel tant que l\'image est entière');
  assert.deepEqual(keyMove('ArrowLeft', { k: 2, x: 0, y: 0 }), { zoom: 1, dx: 40, dy: 0 });
  assert.equal(keyMove('a', { k: 2, x: 0, y: 0 }), null);
});

test('l\'image d\'un plan : réduite à 2048 pixels au plus, jamais agrandie, jamais rognée', () => {
  assert.deepEqual(targetSize('plan', 4096, 3072), { width: 2048, height: 1536, crop: 0 });
  assert.deepEqual(targetSize('plan', 3000, 6000), { width: 1024, height: 2048, crop: 0 });
  assert.deepEqual(targetSize('plan', 1000, 800), { width: 1000, height: 800, crop: 0 });
  assert.deepEqual(targetSize('avatar', 640, 480), { width: 128, height: 128, crop: 480 }, 'la photo d\'une personne ne change pas');
  assert.deepEqual(targetSize('logo', 480, 120), { width: 192, height: 48, crop: 0 }, 'le logo ne change pas');
});

const rows = (extra = {}) => ({ id: [1, 2], Name: ['Siège', 'Bâtiment A'], Kind: ['Site', 'Building'], Use: ['', ''], Parent: [0, 1], ...extra });
const config = readConfig({ name: 'Nom', plan: { table: 'Directory_Places', office: 'Bureau' } });
const planWith = extra => planOf(config, 'Personnes', { Personnes: { id: [1], Nom: ['Camille'], Bureau: [2] }, Directory_Places: rows(extra) });

test('la table des lieux : la colonne « Plan » se lit, et son absence est dite (jamais écrire une colonne qui n\'existe pas)', () => {
  const withColumn = planWith({ Plan: [null, ['L', 7]] });
  assert.equal(withColumn.canImage, true);
  assert.deepEqual(withColumn.places.map(place => place.plan), [0, 7]);
  assert.equal(planWith({}).canImage, false);
});

test('qui peut changer l\'image d\'un plan : un administrateur, quand la colonne existe et que GFS sait envoyer', () => {
  useImages(null);
  const data = { plan: planWith({ Plan: [null, null] }), admin: true };
  assert.equal(imageWhy({ ...data, plan: planWith({}) }), 'an.plan.noPlanCol');
  assert.equal(imageWhy({ ...data, admin: false }), 'an.plan.imgAdmin');
  assert.equal(imageWhy(data), 'an.img.noUpload', 'sans cadre d\'envoi, rien ne part : grisé avec sa raison');
  useImages({ download: async () => new Blob([]), upload: async () => 1 });
  assert.equal(canUpload(), true);
  assert.equal(imageWhy(data), '');
  useImages(null);
});

const storeOf = (log, fail = null) => ({ update: async action => { log.push(action); if (fail) throw new Error(fail); } });

test('retirer l\'image : une seule cellule écrite (`null`), le lieu nommé dans la phrase', async () => {
  const log = [];
  const plan = planWith({ Plan: [null, ['L', 7]] });
  const done = await writePlanImage({ store: storeOf(log), plan, id: 2, file: null, t });
  assert.deepEqual(log, [['UpdateRecord', 'Directory_Places', 2, { Plan: null }]]);
  assert.deepEqual([done.ok, done.say], [true, t('an.plan.imgRemoved', { name: 'Bâtiment A' })]);
});

test('rien ne s\'écrit sur une table sans colonne « Plan », ni sur un lieu qui n\'existe plus, ni sur un fichier trop lourd', async () => {
  const log = [];
  const none = await writePlanImage({ store: storeOf(log), plan: planWith({}), id: 2, file: null, t });
  assert.deepEqual([none.ok, none.say], [false, t('an.plan.noPlanCol')]);
  const gone = await writePlanImage({ store: storeOf(log), plan: planWith({ Plan: [null, null] }), id: 99, file: null, t });
  assert.equal(gone.ok, false);
  const heavy = await writePlanImage({ store: storeOf(log), plan: planWith({ Plan: [null, null] }), id: 2, file: { size: 30 * 1048576, name: 'plan.png' }, t });
  assert.deepEqual([heavy.ok, heavy.say], [false, t('an.img.tooBig', { max: 20 })]);
  assert.deepEqual(log, [], 'aucune écriture');
});

test('le refus de Grist est dit tel quel, rien d\'autre n\'est présenté comme écrit', async () => {
  const done = await writePlanImage({ store: storeOf([], 'Blocked by column update access rules'), plan: planWith({ Plan: [null, ['L', 7]] }), id: 2, file: null, t });
  assert.equal(done.ok, false);
  assert.equal(done.say, t('an.plan.imgRefused', { reason: 'Blocked by column update access rules' }));
});

const text = node => (typeof node === 'string' ? node : node.textContent);
const walk = (node, found = []) => { found.push(node); for (const child of node.children || []) if (typeof child !== 'string') walk(child, found); return found; };
const byClass = (node, name) => walk(node).filter(each => (each.className || '').split(' ').includes(name));
const shown = [{ row: 1, name: 'Camille', levels: [], title: '', avatar: 0 }];

function paint(view, extra = {}) {
  const plan = planWith({ Plan: [null, ['L', 7]] });
  view.show({ t, plan, people: shown, current: 2, here: 0, selected: null, masked: new Set(), imageWhy: '', send: { image: () => {}, trace: () => {} }, ...extra });
}

test('la vue : un lieu qui porte une image montre son cadre, avec les trois boutons de zoom ; sans cadre d\'envoi, la vue marche sans', () => {
  useImages(null);
  const without = new PlanView();
  paint(without);
  assert.equal(byClass(without.element, 'an-pl-map').length, 0, 'sans cadre d\'envoi, pas de cadre d\'image (la liste des lieux reste là)');
  assert.ok(byClass(without.element, 'an-pl-tile').length === 0 && text(without.element).includes('Bâtiment A'));
  useImages({ download: async () => { throw new Error('refusé'); }, upload: async () => 1 });
  const view = new PlanView();
  paint(view);
  const [frame] = byClass(view.element, 'an-pl-vp');
  assert.ok(frame, 'le cadre de l\'image est là');
  assert.equal(frame.attrs['aria-label'], t('an.plan.mapLabel', { name: 'Bâtiment A' }));
  const zoom = byClass(view.element, 'an-pl-zb');
  assert.deepEqual(zoom.map(button => button.dataset.pl), ['zoom-in', 'zoom-out', 'zoom-fit', 'trace']);
  assert.deepEqual(zoom.map(button => button.attrs['aria-disabled']), ['false', 'true', 'true', 'false'],
    'tout entier : on peut agrandir, pas réduire ni ajuster (grisés, jamais masqués) ; « Tracer les locaux » est ouvert à l\'administrateur');
  assert.ok(byClass(view.element, 'an-pl-body')[0].className.includes('has-map'));
  useImages(null);
});

test('la vue : « Remplacer l\'image… » et « Retirer » sont ouverts à l\'administrateur, grisés avec leur raison sinon', () => {
  const view = new PlanView();
  paint(view);
  const open = byClass(view.element, 'an-pl-img-b');
  assert.deepEqual(open.map(button => button.dataset.pl), ['img-pick', 'img-clear']);
  assert.deepEqual(open.map(button => text(button)), [t('an.img.replace'), t('an.img.remove')]);
  assert.ok(open.every(button => button.attrs['aria-disabled'] === null || button.attrs['aria-disabled'] === undefined));
  paint(view, { imageWhy: 'an.plan.imgAdmin' });
  const grey = byClass(view.element, 'an-pl-img-b');
  assert.deepEqual(grey.map(button => [button.attrs['aria-disabled'], button.dataset.act, button.dataset.why]), [['true', 'plan-note', t('an.plan.imgAdmin')], ['true', 'plan-note', t('an.plan.imgAdmin')]],
    'grisé, jamais masqué : un clic dit pourquoi (la phrase du plan, déjà dite par la fenêtre)');
  const bare = new PlanView();
  bare.show({ t, plan: planWith({ Plan: [null, null] }), people: shown, current: 2, here: 0, selected: null, masked: new Set(), imageWhy: '', send: { image: () => {}, trace: () => {} } });
  assert.deepEqual(byClass(bare.element, 'an-pl-img-b').map(button => text(button)), [t('an.plan.imgPick')], 'sans image : un seul bouton, « Image du plan… »');
});

test('la vue : « Tracer les locaux » est grisé avec sa raison pour qui n\'administre pas, ou sans colonne « Shape » ; ouvert, il demande le tracé du lieu', () => {
  useImages({ download: async () => { throw new Error('refusé'); }, upload: async () => 1 });
  const asked = [];
  const view = new PlanView();
  paint(view, { send: { image: () => {}, trace: id => asked.push(id) } });
  const [button] = byClass(view.element, 'an-pl-zb').filter(each => each.dataset.pl === 'trace');
  assert.equal(button.attrs['aria-label'], t('an.plan.trace'));
  assert.equal(button.dataset.act, undefined, 'ouvert : pas de note à dire');
  paint(view, { traceWhy: 'an.plan.traceAdmin' });
  const [grey] = byClass(view.element, 'an-pl-zb').filter(each => each.dataset.pl === 'trace');
  assert.deepEqual([grey.attrs['aria-disabled'], grey.dataset.act, grey.dataset.why], ['true', 'plan-note', t('an.plan.traceAdmin')], 'grisé, jamais masqué : un clic dit pourquoi');
  assert.deepEqual(asked, []);
  useImages(null);
});

test('un cadre qui se mesure avant d\'avoir montré un plan (l\'observateur de taille tire à la pose) ne casse rien : le bouton de tracé n\'a pas besoin des textes', () => {
  const seen = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class { constructor(callback) { this.callback = callback; } observe() { this.callback(); } disconnect() {} };
  try {
    assert.doesNotThrow(() => new PlanView());
  } finally {
    if (seen === undefined) delete globalThis.ResizeObserver; else globalThis.ResizeObserver = seen;
  }
});

test('qui peut tracer : la colonne « Shape » d\'abord, puis l\'administrateur du document (preuve de GFS, jamais devinée)', () => {
  const plan = planWith({ Plan: [null, ['L', 7]] });
  assert.equal(traceWhy({ plan: { ...plan, canShape: false }, admin: true }), 'an.plan.noShapeCol');
  assert.equal(traceWhy({ plan: { ...plan, canShape: true }, admin: false }), 'an.plan.traceAdmin');
  assert.equal(traceWhy({ plan: { ...plan, canShape: true }, admin: null }), 'an.plan.traceAdmin', 'une preuve qui manque ne vaut pas un oui');
  assert.equal(traceWhy({ plan: { ...plan, canShape: true }, admin: true }), '');
});

test('les textes du lot 2 : français et anglais ont les mêmes clés et toutes se traduisent', () => {
  assert.deepEqual(Object.keys(ANNUAIRE_PLAN_STRINGS.fr).sort(), Object.keys(ANNUAIRE_PLAN_STRINGS.en).sort());
  const english = createI18n('en').t;
  for (const key of ['an.plan.mapLabel', 'an.plan.mapHint', 'an.plan.mapLoading', 'an.plan.mapFailed', 'an.plan.zoomIn', 'an.plan.zoomOut', 'an.plan.zoomFit', 'an.plan.imgPick',
    'an.plan.imgAdmin', 'an.plan.noPlanCol', 'an.plan.imgSaved', 'an.plan.imgRemoved', 'an.plan.imgRefused']) {
    assert.notEqual(t(key, { name: 'X', reason: 'Y' }), key, `${key} (français)`);
    assert.notEqual(english(key, { name: 'X', reason: 'Y' }), key, `${key} (anglais)`);
  }
});
