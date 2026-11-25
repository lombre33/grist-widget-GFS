// La mise en page de l'organigramme (js/annuaire/annuaire-org.js) : feuilles côte à côte, parents centrés, traits en équerre, éléments repliés, zoom.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultOpen, layoutOrg, step, fitZoom, ZOOMS } from '../js/annuaire/annuaire-org.js';

const box = { w: 100, h: 40, gx: 10, gy: 20 };
const leaf = id => ({ id, ch: [] });
const tree = () => ({ id: 'r', ch: [{ id: 'a', ch: [leaf('a1'), leaf('a2')] }, { id: 'b', ch: [leaf('b1')] }, leaf('c')] });
const at = (layout, id) => layout.entries.find(entry => entry.item.id === id);

test('mise en page : les feuilles côte à côte, chaque parent centré sur ses enfants', () => {
  const layout = layoutOrg([tree()], { box, open: defaultOpen([tree()]) });
  assert.deepEqual(['a1', 'a2', 'b1', 'c'].map(id => at(layout, id).x), [0, 110, 220, 330]);
  assert.equal(at(layout, 'a').x, 55);
  assert.equal(at(layout, 'b').x, 220);
  assert.equal(at(layout, 'r').x, (55 + 330) / 2);
  assert.deepEqual([at(layout, 'r').y, at(layout, 'a').y, at(layout, 'a1').y], [0, 60, 120]);
  assert.equal(layout.width, 430);
  assert.equal(layout.height, 160);
});

test('mise en page : un élément replié est une feuille qui dit combien d\'enfants il cache', () => {
  const root = tree();
  const open = new Set(['r']);
  const layout = layoutOrg([root], { box, open });
  assert.equal(layout.entries.length, 4);
  assert.deepEqual([at(layout, 'a').folded, at(layout, 'b').folded, at(layout, 'c').folded, at(layout, 'r').folded], [2, 1, 0, 0]);
  assert.deepEqual(['a', 'b', 'c'].map(id => at(layout, id).x), [0, 110, 220]);
});

test('mise en page : les traits relient chaque parent à ses enfants, une barre seulement à partir de deux enfants', () => {
  const layout = layoutOrg([{ id: 'p', ch: [leaf('x'), leaf('y')] }, { id: 'q', ch: [leaf('z')] }], { box, open: new Set(['p', 'q']) });
  assert.equal(layout.paths.length, 5); // p : un trait (avec sa barre) + deux ; q : un trait + un
  assert.ok(layout.paths.some(path => path.includes('H')), 'p a une barre');
  assert.equal(layout.paths.filter(path => path.includes('H')).length, 1);
  assert.ok(layout.paths.every(path => /^M[\d. ]+V[\d.]+/.test(path)));
});

test('mise en page : plusieurs racines côte à côte ; rien du tout donne un dessin vide', () => {
  const layout = layoutOrg([leaf('a'), leaf('b')], { box, open: new Set() });
  assert.deepEqual(layout.entries.map(entry => entry.x), [0, 110]);
  const none = layoutOrg([], { box, open: new Set() });
  assert.deepEqual([none.entries.length, none.width], [0, 0]);
});

test('étages dépliés : tout quand c\'est petit, deux étages seulement quand c\'est grand', () => {
  assert.deepEqual([...defaultOpen([tree()])].sort(), ['a', 'b', 'r']); // tous les éléments qui ont des enfants
  const wide = { id: 'r', ch: Array.from({ length: 9 }, (_, i) => ({ id: `n${i}`, ch: [leaf(`n${i}a`), leaf(`n${i}b`), { id: `n${i}c`, ch: [leaf(`n${i}c1`)] }] })) };
  const open = defaultOpen([wide], 20);
  assert.equal(open.has('r'), true);
  assert.equal(open.has('n3'), true);
  assert.equal(open.has('n3c'), false); // le troisième étage est replié
});

test('zoom : un cran de plus ou de moins, bornés ; « tout voir » choisit le zoom qui tient', () => {
  assert.equal(step(1, 1), 1.25);
  assert.equal(step(1, -1), 0.8);
  assert.equal(step(0.5, -1), 0.33);
  assert.equal(step(0.25, -1), 0.25); // borné en bas
  assert.equal(step(1.5, 1), 1.5);
  assert.equal(step(0.7, 1), 0.8);
  assert.equal(fitZoom({ width: 400, height: 200 }, { width: 600, height: 300 }), 1);
  assert.equal(fitZoom({ width: 1200, height: 300 }, { width: 600, height: 300 }), 0.5);
  assert.equal(fitZoom({ width: 900, height: 300 }, { width: 600, height: 300 }), 0.5);
  assert.equal(fitZoom({ width: 800, height: 300 }, { width: 600, height: 300 }), 0.67);
  assert.equal(fitZoom({ width: 5000, height: 3000 }, { width: 600, height: 300 }), ZOOMS[0]);
  assert.equal(fitZoom({ width: 0, height: 0 }, { width: 600, height: 300 }), 1);
});
