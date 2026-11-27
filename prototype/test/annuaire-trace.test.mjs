// Le tracé des locaux (lot 3b du plan des bâtiments, demande du porteur du 27/11 ; js/annuaire/annuaire-trace.js) : l'aimant de la grille, les gestes qui font un
// rectangle ou un polygone, l'ajustement d'un tracé, le brouillon (Annuler, Rétablir, locaux créés en passant) et les actions que Grist recevra : une par tracé changé, une
// par local créé, jamais une colonne absente. Du code pur ; le dessin, la souris et le vrai Grist se mesurent dans le labo (labo/run-annuaire-plan.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDocument } from './fake-dom.mjs';

installFakeDocument();

const trace = await import('../js/annuaire/annuaire-trace.js');
const { readShape, writeShape, boundsOf, UNITS } = await import('../js/annuaire/annuaire-plan-shape.js');
const { readConfig } = await import('../js/annuaire/annuaire-config.js');
const { planOf } = await import('../js/annuaire/annuaire-plan.js');
const { fitRect, unitsAt, FIT } = await import('../js/annuaire/annuaire-plan-zoom.js');

const { snap, placed, rectFrom, rectOk, polygonFrom, movedBy, withCorner, Draft, traceActions, GRID } = trace;
const H = 625;
const RECT = { type: 'rect', x: 100, y: 50, w: 200, h: 100 };
const TRI = { type: 'poly', pts: [[0, 0], [100, 0], [0, 100]] };

test('la grille : l\'aimant arrondit au pas, sans pas il laisse le point, et le point ne sort jamais de l\'image', () => {
  assert.equal(snap(14, 10), 10);
  assert.equal(snap(15, 10), 20);
  assert.equal(snap(14.2, 0), 14.2);
  assert.deepEqual(placed([14, 96], GRID, H), [10, 100]);
  assert.deepEqual(placed([-30, 9999], GRID, H), [0, H], 'ni à gauche ni sous l\'image : le point est ramené au bord de l\'image');
  assert.deepEqual(placed([1200, 14.2], 0, H), [UNITS, 14.2]);
});

test('un rectangle se trace d\'un coin à l\'autre, dans le sens qu\'on veut ; trop petit, il ne compte pas', () => {
  assert.deepEqual(rectFrom([300, 150], [100, 50]), RECT);
  assert.deepEqual(rectFrom([100, 50], [300, 150]), RECT);
  assert.equal(rectOk(RECT), true);
  assert.equal(rectOk(rectFrom([10, 10], [14, 80])), false, 'un trait n\'est pas un local');
});

test('un polygone a trois angles au moins et une surface', () => {
  assert.deepEqual(polygonFrom(TRI.pts), TRI);
  assert.equal(polygonFrom([[0, 0], [10, 0]]), null);
  assert.equal(polygonFrom([[0, 0], [10, 0], [20, 0]]), null, 'trois points alignés : pas de surface');
  assert.equal(polygonFrom(Array.from({ length: 65 }, (_, i) => [i * 5, (i % 2) * 40])), null, 'plus de 64 angles : refusé');
});

test('déplacer un tracé le garde dans l\'image ; tirer un angle ajuste, l\'angle opposé d\'un rectangle reste en place', () => {
  assert.deepEqual(boundsOf(movedBy(RECT, 50, 20, H)), { x: 150, y: 70, w: 200, h: 100 });
  assert.deepEqual(boundsOf(movedBy(RECT, -999, -999, H)), { x: 0, y: 0, w: 200, h: 100 }, 'collé en haut à gauche, pas au-delà');
  assert.deepEqual(boundsOf(movedBy(RECT, 9999, 9999, H)), { x: UNITS - 200, y: H - 100, w: 200, h: 100 });
  const poly = movedBy(TRI, 30, 30, H);
  assert.deepEqual(poly.pts, [[30, 30], [130, 30], [30, 130]], 'un polygone garde sa forme');
  const tall = withCorner(RECT, 2, [400, 300]); // l'angle bas droit (300, 150) tiré en (400, 300) : l'angle haut gauche (100, 50) ne bouge pas
  assert.deepEqual(boundsOf(tall), { x: 100, y: 50, w: 300, h: 250 });
  const flipped = withCorner(RECT, 2, [20, 10]); // tiré au-delà de l'angle opposé : le rectangle se retourne
  assert.deepEqual(boundsOf(flipped), { x: 20, y: 10, w: 80, h: 40 });
  assert.deepEqual(withCorner(RECT, 2, [101, 51]), RECT, 'un angle tiré jusqu\'à écraser le rectangle ne le détruit pas');
  assert.deepEqual(withCorner(TRI, 1, [200, 20]).pts, [[0, 0], [200, 20], [0, 100]]);
  assert.deepEqual(withCorner(TRI, 1, [0, 50]), TRI, 'un angle qui rendrait le polygone plat ne passe pas');
});

test('le brouillon : poser, retirer, annuler et rétablir ; une pose identique n\'est pas un geste', () => {
  const draft = new Draft([{ id: 1, shape: RECT }, { id: 2, shape: null }]);
  assert.deepEqual(draft.keys(), [1, 2]);
  assert.equal(draft.count, 0);
  assert.equal(draft.canUndo, false);
  assert.equal(draft.setShape(1, RECT), false, 'le même tracé : rien ne change, rien à annuler');
  assert.equal(draft.setShape(9, RECT), false, 'un local inconnu ne reçoit rien');
  assert.equal(draft.setShape(2, TRI), true);
  assert.equal(draft.setShape(1, null), true);
  assert.deepEqual([draft.shapeOf(1), draft.shapeOf(2)], [null, TRI]);
  assert.equal(draft.count, 2);
  assert.deepEqual(draft.changes().shapes, [{ id: 1, shape: null }, { id: 2, shape: TRI }]);
  assert.equal(draft.undo(), true);
  assert.deepEqual(draft.shapeOf(1), RECT, '« Annuler » rend le tracé retiré');
  assert.equal(draft.canRedo, true);
  assert.equal(draft.redo(), true);
  assert.equal(draft.shapeOf(1), null);
  draft.undo();
  draft.setShape(1, { ...RECT, w: 250 });
  assert.equal(draft.canRedo, false, 'un nouveau geste efface ce qu\'on pouvait rétablir');
  draft.undo();
  draft.undo();
  assert.equal(draft.count, 0, 'tout annulé : plus rien à enregistrer');
  assert.equal(draft.undo(), false);
  assert.equal(new Draft([]).redo(), false);
});

test('le brouillon : un local créé dans la séance prend un tracé, se retire, s\'annule ; un local existant ne se retire pas d\'ici', () => {
  const draft = new Draft([{ id: 1, shape: null }]);
  const key = draft.addRoom({ name: 'Bureau 301', use: 'office', capacity: 2 });
  assert.match(key, /^new:\d+$/);
  assert.deepEqual(draft.made(key), { name: 'Bureau 301', use: 'office', capacity: 2 });
  assert.equal(draft.made(1), null);
  assert.equal(draft.shapeOf(key), null);
  assert.equal(draft.count, 1, 'un local créé sans tracé s\'écrit quand même (la ligne)');
  draft.setShape(key, RECT);
  assert.deepEqual(draft.changes().added, [{ key, name: 'Bureau 301', use: 'office', capacity: 2, shape: RECT }]);
  assert.equal(draft.dropRoom(1), false, 'un local de la table reste dans la table');
  assert.equal(draft.dropRoom(key), true);
  assert.equal(draft.has(key), false);
  assert.equal(draft.count, 0);
  assert.equal(draft.undo(), true);
  assert.deepEqual(draft.shapeOf(key), RECT, '« Annuler » rend le local retiré, avec son tracé');
  const other = draft.addRoom({ name: 'Archives', use: 'service', capacity: 0 });
  assert.notEqual(other, key, 'chaque local créé a sa clé');
});

// Une table de lieux : le site « Siège », le bâtiment A (depth 1, porte le plan), l'étage 1 (depth 2) et un local.
const ROWS = () => ({ id: [1, 2, 3, 4], Name: ['Siège', 'Bâtiment A', 'Étage 1', 'Bureau 101'], Kind: ['Site', 'Building', 'Floor', 'Room'], Use: ['', '', '', 'Office'],
  Parent: [0, 1, 2, 3], Address: ['', '', '', ''], Capacity: [0, 0, 0, 2], Plan: [null, null, ['L', 7], null], Shape: ['', '', '', ''], Lat: [null, null, null, null] });
const planFrom = rows => planOf(readConfig({ plan: { table: 'Directory_Places', office: 'Bureau' } }), 'Personnes', { Personnes: { id: [] }, Directory_Places: rows });

test('les actions : un tracé changé s\'écrit en une `UpdateRecord`, un tracé retiré s\'écrit vide, un local créé en une `AddRecord`', () => {
  const plan = planFrom(ROWS());
  const draft = new Draft([{ id: 4, shape: null }]);
  draft.setShape(4, RECT);
  draft.addRoom({ name: 'Bureau 102', use: 'office', capacity: 3 }, TRI);
  draft.addRoom({ name: 'Couloir', use: 'circulation', capacity: 5 });
  const actions = traceActions(draft.changes(), plan, plan.byId.get(3));
  assert.deepEqual(actions[0], ['UpdateRecord', 'Directory_Places', 4, { Shape: writeShape(RECT) }]);
  assert.deepEqual(actions[1], ['AddRecord', 'Directory_Places', null, { Name: 'Bureau 102', Kind: 'Room', Use: 'Office', Capacity: 3, Parent: 3, Shape: writeShape(TRI) }]);
  assert.deepEqual(actions[2][3], { Name: 'Couloir', Kind: 'Room', Use: 'Circulation', Parent: 3, Shape: '' }, 'un couloir n\'a pas de places : « Capacity » n\'est pas écrite');
  assert.equal(actions.length, 3);
  const cleared = new Draft([{ id: 4, shape: RECT }]);
  cleared.setShape(4, null);
  assert.deepEqual(traceActions(cleared.changes(), plan, plan.byId.get(3)), [['UpdateRecord', 'Directory_Places', 4, { Shape: '' }]]);
  assert.deepEqual(traceActions(new Draft([{ id: 4, shape: RECT }]).changes(), plan, plan.byId.get(3)), [], 'rien de changé : rien à écrire');
});

test('les actions : le genre d\'un local créé suit sa profondeur, et jamais une colonne que la table n\'a pas', () => {
  const rows = ROWS();
  delete rows.Kind;
  delete rows.Capacity;
  delete rows.Use;
  const plan = planFrom(rows);
  const draft = new Draft([]);
  draft.addRoom({ name: 'Étage 2', use: 'office', capacity: 4 }, RECT);
  const [add] = traceActions(draft.changes(), plan, plan.byId.get(2));
  assert.deepEqual(add[3], { Name: 'Étage 2', Parent: 2, Shape: writeShape(RECT) }, 'sans « Kind », « Use » ni « Capacity » dans la table, aucune des trois n\'est écrite');
  const full = planFrom(ROWS());
  const [floor] = traceActions(draft.changes(), full, full.byId.get(2));
  assert.equal(floor[3].Kind, 'Floor', 'sous un bâtiment, un lieu créé est un étage');
  const [site] = traceActions(draft.changes(), full, full.byId.get(1));
  assert.equal(site[3].Kind, 'Building', 'sous le site, un bâtiment');
});

test('le pointeur sur le plan : le point du cadre devient un point du plan, agrandi ou non', () => {
  const rect = fitRect(400, 200, 1.6); // une image de 1,6 de rapport dans un cadre de 400 × 200 : 320 × 200, centrée
  assert.deepEqual([rect.dw, rect.dh, rect.ox, rect.oy], [320, 200, 40, 0]);
  const wide = fitRect(300, 400, 1.6);
  assert.deepEqual([wide.dw, Math.round(wide.dh), wide.ox, Math.round(wide.oy)], [300, 188, 0, 106], 'un cadre étroit : l\'image tient en largeur');
  assert.deepEqual(unitsAt(FIT, rect, 40, 0, UNITS), [0, 0], 'le coin haut gauche de l\'image');
  assert.deepEqual(unitsAt(FIT, rect, 360, 200, UNITS), [UNITS, 625], 'le coin bas droit');
  const zoomed = { k: 2, x: -100, y: -20 };
  const [x, y] = unitsAt(zoomed, rect, 200, 100, UNITS);
  // ce qui est au milieu du cadre à 2× décalé de (−100, −20) : ((200 + 100) / 2 − 40) px de l'image, soit 110 / 320 de sa largeur
  assert.equal(Math.round(x), Math.round((110 / 320) * UNITS));
  assert.equal(Math.round(y), Math.round((((100 + 20) / 2) / 200) * 625));
});

test('les textes du tracé : français et anglais ont les mêmes clés, toutes se traduisent, le pluriel suit le nombre', async () => {
  const { ANNUAIRE_TRACE_STRINGS } = await import('../js/i18n/i18n-annuaire-trace.js');
  const { createI18n } = await import('../js/i18n/i18n.js');
  assert.deepEqual(Object.keys(ANNUAIRE_TRACE_STRINGS.fr).sort(), Object.keys(ANNUAIRE_TRACE_STRINGS.en).sort());
  const fr = createI18n('fr').t;
  const en = createI18n('en').t;
  for (const key of Object.keys(ANNUAIRE_TRACE_STRINGS.fr)) {
    assert.notEqual(fr(key, { name: 'N', n: 2, max: 3, reason: 'r' }), key, `français : ${key}`);
    assert.notEqual(en(key, { name: 'N', n: 2, max: 3, reason: 'r' }), key, `anglais : ${key}`);
  }
  assert.equal(fr('an.tr.traced', { n: 1, max: 4 }), '1 tracé sur 4');
  assert.equal(fr('an.tr.traced', { n: 3, max: 4 }), '3 tracés sur 4');
  assert.match(fr('an.tr.leaveText', { n: 1 }), /1 changement n’est pas enregistré :/);
  assert.match(fr('an.tr.leaveText', { n: 2 }), /2 changements ne sont pas enregistrés :/);
});
