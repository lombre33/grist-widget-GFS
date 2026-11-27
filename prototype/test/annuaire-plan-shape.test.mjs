// Le tracé des lieux sur le plan (lot 3 du plan des bâtiments, demande du porteur du 27/11 ; js/annuaire/annuaire-plan-shape.js, annuaire-plan-shapes.js, annuaire-plan.js :
// `mapOf`) : lire et écrire le texte de la colonne `Shape` (un texte qu'on ne comprend pas ne casse rien), l'aire, l'intérieur, le centre d'un polygone en L, les places d'un
// local, le plan qu'un lieu montre (le sien, ou celui de son étage, cadré), ce que le calque dessine et la vue qui cadre un local. Du code pur ; l'aspect à l'écran, la souris et
// le vrai Grist se mesurent dans le labo (labo/run-annuaire-plan.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDocument } from './fake-dom.mjs';
import { createI18n } from '../js/i18n/i18n.js';

installFakeDocument();

const shapes = await import('../js/annuaire/annuaire-plan-shape.js');
const { readConfig } = await import('../js/annuaire/annuaire-config.js');
const { planOf, mapOf, occupancy } = await import('../js/annuaire/annuaire-plan.js');
const shapesModule = await import('../js/annuaire/annuaire-plan-shapes.js');
const { layerOf, ShapeLayer } = shapesModule;
const { focusView, FIT } = await import('../js/annuaire/annuaire-plan-zoom.js');

const { t } = createI18n('fr');
const { readShape, writeShape, areaOf, inside, centerOf, boundsOf, pathD, seatSpots, edgeDistance, pointsOf } = shapes;

const RECT = { type: 'rect', x: 100, y: 50, w: 200, h: 100 };
// un L : 300 × 300 dont le coin haut droit (200..300 × 0..200) manque
const ELL = { type: 'poly', pts: [[0, 0], [200, 0], [200, 200], [300, 200], [300, 300], [0, 300]] };

test('le tracé : un rectangle et un polygone s\'écrivent et se relisent, un texte qu\'on ne comprend pas donne rien', () => {
  assert.deepEqual(readShape(writeShape(RECT)), RECT);
  assert.deepEqual(readShape(writeShape(ELL)), ELL);
  assert.equal(writeShape({ type: 'rect', x: 1.234, y: 2, w: 3.99, h: 4 }), '{"t":"r","x":1.2,"y":2,"w":4,"h":4}', 'les nombres au dixième : un texte court');
  for (const bad of ['', '  ', 'pas du json', '[]', 'null', '42', '{}', '{"t":"x"}', '{"t":"r","x":1,"y":1,"w":0,"h":5}', '{"t":"r","x":"1","y":1,"w":2,"h":5}',
    '{"t":"r","x":1,"y":1,"w":-2,"h":5}', '{"t":"p","p":[[0,0],[1,1]]}', '{"t":"p","p":[[0,0],[1,1],[2,2]]}', '{"t":"p","p":[[0,0],[1,1],["a",2]]}',
    '{"t":"p","p":[[0,0],[1,1],[2]]}', '{"t":"p","p":"x"}', '{"t":"r","x":1,"y":1,"w":Infinity,"h":2}']) {
    assert.equal(readShape(bad), null, `${JSON.stringify(bad)} ne donne pas de tracé`);
  }
  assert.equal(readShape(undefined), null);
  assert.equal(readShape(7), null);
  const many = JSON.stringify({ t: 'p', p: Array.from({ length: 65 }, (_, i) => [Math.cos(i) * 100, Math.sin(i) * 100]) });
  assert.equal(readShape(many), null, 'au plus 64 angles : un texte démesuré n\'est pas un tracé');
});

test('le tracé : l\'aire, la boîte, le chemin, l\'intérieur (un L n\'est pas son rectangle) et la distance au bord', () => {
  assert.equal(areaOf(RECT), 20000);
  assert.equal(areaOf(ELL), 300 * 300 - 100 * 200, 'la formule des lacets compte le creux du L');
  assert.deepEqual(boundsOf(ELL), { x: 0, y: 0, w: 300, h: 300 });
  assert.equal(pathD(RECT), 'M100 50 L300 50 L300 150 L100 150Z');
  assert.deepEqual([inside(RECT, 150, 100), inside(RECT, 50, 100), inside(RECT, 301, 100)], [true, false, false]);
  assert.equal(inside(ELL, 250, 100), false, 'le creux du L n\'est pas dans le tracé');
  assert.equal(inside(ELL, 100, 100), true);
  assert.equal(inside(ELL, 250, 250), true);
  assert.equal(edgeDistance(RECT, 200, 100), 50, 'le bord le plus proche est en haut et en bas, à 50');
  assert.equal(edgeDistance(RECT, 100, 100), 0);
  assert.equal(pointsOf(RECT).length, 4);
});

test('le tracé : le nom se pose dans la forme, même pour un L (jamais dans le creux)', () => {
  assert.deepEqual(centerOf(RECT), [200, 100]);
  const [x, y] = centerOf(ELL);
  assert.equal(inside(ELL, x, y), true, 'le centre d\'un L est dans le L');
  const hook = { type: 'poly', pts: [[0, 0], [100, 0], [100, 400], [400, 400], [400, 500], [0, 500]] };
  assert.equal(inside(hook, ...centerOf(hook)), true);
});

test('les places d\'un local : autant que demandé, toutes dans la forme et loin des bords, rangées par rangées', () => {
  for (const shape of [RECT, ELL]) {
    for (const count of [1, 3, 8, 24]) {
      const { pts, step } = seatSpots(shape, count);
      assert.equal(pts.length, count, `${count} places dans le tracé`);
      assert.ok(pts.every(([x, y]) => inside(shape, x, y) && edgeDistance(shape, x, y) >= step * 0.4 - 1e-9), 'chaque place est dedans, à distance des bords');
      const keys = new Set(pts.map(point => point.join()));
      assert.equal(keys.size, count, 'deux places ne se superposent pas');
      assert.ok(step > 0);
    }
  }
  const alone = seatSpots(RECT, 1);
  assert.ok(Math.hypot(alone.pts[0][0] - 200, alone.pts[0][1] - 100) <= alone.step, 'une place seule est au milieu du local, pas dans son coin');
  assert.deepEqual(seatSpots(RECT, 0), { pts: [], step: 0 });
  const tiny = seatSpots({ type: 'rect', x: 0, y: 0, w: 10, h: 10 }, 200);
  assert.ok(tiny.pts.length > 0 && tiny.pts.length <= 200, 'un tracé trop petit rend ce qui tient, sans boucler');
});

// Le site « Siège » > « Bâtiment A » (plan du bâtiment) > « 2e étage » (plan de l'étage) > trois locaux tracés, dont un couloir.
const place = (id, name, parent, extra = {}) => ({ id, name, parent, ...extra });
function planFixture(rows = null) {
  const list = rows || [place(1, 'Siège', 0), place(2, 'Bâtiment A', 1, { plan: 11 }), place(3, '2e étage', 2, { plan: 12, shape: RECT }),
    place(4, 'Bureau 204', 3, { shape: RECT, use: 'Office', capacity: 3 }), place(5, 'Couloir', 3, { shape: ELL, use: 'Circulation' }),
    place(6, 'Bureau 12', 3, { use: 'Office', capacity: 1 }), place(7, 'Rez-de-chaussée', 2, { shape: { ...RECT, x: 0, w: 50 } })];
  const col = key => list.map(each => (each[key] === undefined ? (key === 'Capacity' ? 0 : '') : each[key]));
  const attachment = list.map(each => (each.plan ? ['L', each.plan] : null));
  const rows2 = { id: list.map(each => each.id), Name: list.map(each => each.name), Kind: col('Kind'), Use: list.map(each => each.use || ''),
    Parent: list.map(each => each.parent), Address: col('Address'), Capacity: list.map(each => each.capacity || 0), Plan: attachment,
    Shape: list.map(each => (each.shape ? writeShape(each.shape) : '')) };
  return planOf(readConfig({ name: 'Nom', plan: { table: 'Directory_Places', office: 'Bureau' } }), 'Personnes',
    { Personnes: { id: [1, 2, 3], Nom: ['Camille', 'Inès', 'Nathan'], Bureau: [4, 4, 6] }, Directory_Places: rows2 });
}
const shown = ['Camille', 'Inès', 'Nathan'].map((name, i) => ({ row: i + 1, name, levels: [], title: '', avatar: 0 }));

test('le plan qu\'un lieu montre : le sien, sinon celui de son plus proche ancêtre, qui le cadre', () => {
  const plan = planFixture();
  assert.equal(plan.canShape, true);
  assert.deepEqual(plan.byId.get(4).shape, RECT, 'le tracé se lit avec le lieu');
  assert.equal(plan.byId.get(6).shape, null, 'un lieu non tracé reste dans la liste');
  assert.equal(mapOf(plan, 0), null, 'tous les lieux : pas d\'image');
  assert.equal(mapOf(plan, 1), null, 'un lieu sans image, dont aucun ancêtre n\'en a : rien à montrer');
  const floor = mapOf(plan, 3);
  assert.deepEqual([floor.host.id, floor.focus, floor.shapes.map(each => each.id)], [3, null, [4, 5]], 'un étage montre son image et les locaux tracés dessus');
  const room = mapOf(plan, 4);
  assert.deepEqual([room.host.id, room.focus.id, room.shapes.map(each => each.id)], [3, 4, [4, 5]], 'un local se montre sur le plan de son étage, cadré');
  const building = mapOf(plan, 2);
  assert.deepEqual([building.host.id, building.shapes.map(each => each.id)], [2, [3, 7]], 'un bâtiment à image montre ses étages tracés');
  const untraced = mapOf(plan, 6);
  assert.deepEqual([untraced.host.id, untraced.focus.id], [3, 6], 'un local sans tracé se montre sur le plan de l\'étage, sans rien de cerné');
  assert.equal(planFixture().canImage, true);
});

test('une table sans colonne « Shape » : rien ne s\'écrit, jamais une colonne absente', () => {
  const rows = { id: [1], Name: ['Siège'], Parent: [0], Plan: [null] };
  const plan = planOf(readConfig({ plan: { table: 'Directory_Places', office: 'Bureau' } }), 'Personnes', { Personnes: { id: [] }, Directory_Places: rows });
  assert.equal(plan.canShape, false);
  assert.equal(plan.places[0].shape, null);
});

test('ce que le calque dessine : les lieux tracés, les grisés, le repéré, l\'estompé, le décompte et les places du local cadré', () => {
  const plan = planFixture();
  const count = occupancy(plan, shown);
  const floor = layerOf({ plan, map: mapOf(plan, 3), count, state: { t, here: 4, selected: null } });
  assert.deepEqual(floor.shapes.map(each => [each.id, each.grey, each.here, each.current, each.dim, each.label]),
    [[4, false, true, false, false, '2/3'], [5, true, false, false, false, '']], 'le bureau 204 porte 2 personnes sur 3 places, le couloir est grisé et sans décompte');
  assert.equal(floor.shapes[1].why, t('an.plan.noSeats'));
  assert.equal(floor.seats, null, 'au cran de l\'étage, pas de places : elles viennent avec le local');
  const room = layerOf({ plan, map: mapOf(plan, 4), count, state: { t, here: 0, selected: 2 } });
  assert.deepEqual(room.shapes.map(each => [each.id, each.current, each.dim]), [[4, true, false], [5, false, true]], 'le local ouvert est cerné, les autres s\'estompent');
  assert.deepEqual(room.seats.people.map(each => [each.row, each.selected]), [[1, false], [2, true]], 'une place pleine par occupant');
  assert.equal(room.seats.free, 1, 'et une vide pour la troisième place');
  const noone = layerOf({ plan, map: mapOf(plan, 6), count: occupancy(plan, []), state: { t, here: 0, selected: null } });
  assert.equal(noone.seats, null, 'un local sans tracé n\'a pas de places à poser');
  const other = layerOf({ plan, map: mapOf(plan, 5), count, state: { t, here: 0, selected: null } });
  assert.equal(other.seats, null, 'un couloir n\'a pas de places');
});

test('une recherche ou un filtre estompe les lieux où personne ne correspond (le couloir reste grisé, le cadrage garde sa règle)', () => {
  const plan = planFixture();
  const few = occupancy(plan, shown.slice(0, 1));
  const state = { t, here: 0, selected: null, filtered: true };
  const floor = layerOf({ plan, map: mapOf(plan, 3), count: few, state });
  assert.deepEqual(floor.shapes.map(each => [each.id, each.grey, each.dim]), [[4, false, false], [5, true, false]], 'un lieu qui a des personnes correspondantes ne s\'estompe pas, un couloir est grisé, pas estompé');
  const none = layerOf({ plan, map: mapOf(plan, 3), count: occupancy(plan, []), state });
  assert.deepEqual(none.shapes.map(each => each.dim), [true, false], 'sans personne qui corresponde, le bureau s\'estompe');
  const plain = layerOf({ plan, map: mapOf(plan, 3), count: occupancy(plan, []), state: { ...state, filtered: false } });
  assert.deepEqual(plain.shapes.map(each => each.dim), [false, false], 'sans filtre, rien ne s\'estompe');
  const framed = layerOf({ plan, map: mapOf(plan, 4), count: few, state });
  assert.deepEqual(framed.shapes.map(each => [each.id, each.dim]), [[4, false], [5, true]], 'un local cadré estompe les autres, comme avant');
});

test('le calque : une forme par lieu avec l\'action de sa carte, des places qui s\'ouvrent, des noms qui se taisent quand la forme est trop petite', () => {
  const plan = planFixture();
  const count = occupancy(plan, shown);
  const layer = new ShapeLayer();
  const room = layerOf({ plan, map: mapOf(plan, 4), count, state: { t, here: 0, selected: null } });
  layer.draw({ height: 667, ...room });
  assert.equal(layer.element.attrs.viewBox, '0 0 1000 667');
  assert.equal(layer.element.attrs['aria-hidden'], 'true', 'le calque est caché aux lecteurs d\'écran : les cartes font les mêmes gestes');
  const groups = layer.element.children.filter(node => node.tag === 'g' && node.attrs.class.includes('an-pl-shape'));
  assert.deepEqual(groups.map(node => [node.dataset.act, node.dataset.why]), [[undefined, undefined], ['plan-note', t('an.plan.noSeats')]],
    'le local ouvert ne se clique pas ; le couloir, grisé, dit pourquoi');
  const seats = layer.element.children.find(node => node.attrs.class === 'an-pl-seats');
  assert.deepEqual(seats.children.map(node => [node.attrs.class.includes('is-taken'), node.dataset.act, node.dataset.row]),
    [[true, 'person', '1'], [true, 'person', '2'], [false, undefined, undefined]], 'les places pleines ouvrent la fiche, la vide ne fait rien');
  // les noms : à taille d'écran ils tiennent dans leur forme (200 × 100 unités, un pixel par unité), à quarante unités par pixel il n'y a plus de place
  const floor = layerOf({ plan, map: mapOf(plan, 3), count, state: { t, here: 0, selected: null } });
  layer.draw({ height: 667, ...floor });
  layer.fit(1);
  const bureau = layer.element.children.find(node => node.dataset && node.dataset.id === '4');
  const texts = () => bureau.children.filter(node => node.tag === 'text').map(node => [node.attrs.class.includes('is-count'), node.textContent]);
  assert.deepEqual(texts(), [[false, 'Bureau 204'], [false, ''], [true, '2/3']], 'à taille d\'écran, le nom et le décompte tiennent dans la forme');
  layer.fit(40);
  assert.deepEqual(texts().map(each => each[1]), ['', '', ''], 'trop petite : ni nom ni décompte, jamais un texte qui déborde');
  const couloir = layer.element.children.find(node => node.dataset && node.dataset.id === '5');
  assert.deepEqual([couloir.dataset.act, couloir.dataset.id], ['plan-note', '5'], 'le couloir grisé garde son numéro, son geste dit pourquoi il est grisé');
});

test('le nom d\'un lieu dans sa forme : entier sur une ligne, sur deux entre deux mots, sinon rien (jamais coupé en « Bureau 1… »)', () => {
  const { labelLines } = shapesModule;
  assert.deepEqual(labelLines('Bureau 204', '2/3', 100, 80), { name: ['Bureau 204'], count: '2/3' });
  assert.deepEqual(labelLines('Bureau 204', '2/3', 70, 80), { name: ['Bureau', '204'], count: '2/3' }, 'trop étroit pour une ligne : deux lignes, coupées entre deux mots');
  assert.deepEqual(labelLines('Bureau 204', '2/3', 70, 40), { name: ['Bureau', '204'], count: '' }, 'sans hauteur pour le décompte, le nom d\'abord');
  assert.deepEqual(labelLines('Bureau 204', '', 100, 20), { name: ['Bureau 204'], count: '' });
  assert.deepEqual(labelLines('Bureau 204', '2/3', 100, 12), { name: [], count: '' }, 'pas la hauteur d\'une ligne : rien');
  assert.deepEqual(labelLines('Bureau 204', '2/3', 40, 80), { name: [], count: '' }, 'trop étroit même pour « Bureau » : rien, jamais un mot coupé');
  assert.deepEqual(labelLines('Immeuble', '', 40, 80), { name: [], count: '' }, 'un mot seul qui ne tient pas : rien');
  assert.deepEqual(labelLines('Salle de réunion Atlas', '', 80, 80), { name: [], count: '' }, 'trois lignes ne tiennent pas : rien plutôt qu\'un nom coupé');
});

test('cadrer un local : la vue l\'agrandit avec de la marge, sans jamais sortir de l\'image', () => {
  const full = focusView({ x: 0, y: 0, w: 400, h: 200 }, 400, 200);
  assert.deepEqual(full, FIT, 'un local grand comme le cadre : on garde l\'image entière');
  const view = focusView({ x: 100, y: 50, w: 100, h: 50 }, 400, 200);
  assert.ok(view.k > 1 && view.k <= 8);
  const centre = [(150 * view.k) + view.x, (75 * view.k) + view.y];
  assert.ok(Math.abs(centre[0] - 200) < 1 && Math.abs(centre[1] - 100) < 1, 'le local est au milieu du cadre');
  const corner = focusView({ x: 0, y: 0, w: 40, h: 20 }, 400, 200);
  assert.deepEqual([corner.x, corner.y], [0, 0], 'un local dans le coin ne fait pas sortir l\'image du cadre');
  assert.equal(focusView({ x: 10, y: 10, w: 1, h: 1 }, 400, 200).k, 8, 'au plus huit fois');
});
