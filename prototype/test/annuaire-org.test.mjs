// La mise en page de l'organigramme (js/annuaire/annuaire-org.js) : feuilles côte à côte, parents centrés, traits en équerre, éléments repliés, zoom.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultOpen, allOpen, layoutOrg, step, fitZoom, ZOOMS, CREW } from '../js/annuaire/annuaire-org.js';
import { orgData, PEOPLE_MAX } from '../js/annuaire/annuaire-org-data.js';
import { buildPeople, buildTree, levelKey } from '../js/annuaire/annuaire-model.js';
import { schemaOf } from '../js/annuaire/annuaire-schema.js';
import { documentFixture, configFixture } from './annuaire-fixtures.mjs';

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

// ---------- retour du porteur, 25/11 : déplié jusqu'au niveau le plus bas, les personnes sous leur structure, les filtres ----------

test('étages dépliés : par défaut tout l\'organigramme est déplié jusqu\'au niveau le plus bas, même à plusieurs centaines de cartes', () => {
  const many = { id: 'r', ch: Array.from({ length: 30 }, (_, i) => ({ id: `n${i}`, ch: Array.from({ length: 5 }, (_, j) => ({ id: `n${i}-${j}`, ch: [leaf(`n${i}-${j}x`)] })) })) };
  const open = defaultOpen([many]); // 1 + 30 + 150 + 150 = 331 éléments
  assert.deepEqual([...open].sort(), [...allOpen([many])].sort());
  assert.equal(open.has('n7-3'), true, 'le dernier étage qui a des enfants est déplié');
  assert.equal(defaultOpen([many], 100).has('n7-3'), false, 'au-delà de la limite, seuls deux étages');
});

test('mise en page : les personnes d\'une structure se rangent en pile sous sa carte, et l\'étage d\'en dessous commence sous la pile', () => {
  const node = id => ({ id, ch: [], people: [leaf(`${id}1`), leaf(`${id}2`)] });
  const root = { id: 'r', ch: [node('a'), node('b')], people: [leaf('r1')] };
  const layout = layoutOrg([root], { box, open: new Set(['r']) });
  const entry = id => layout.entries.find(each => each.item.id === id);
  const stack = CREW.top + 2 * (CREW.h + CREW.gap);
  assert.equal(entry('r').stack, CREW.top + (CREW.h + CREW.gap));
  assert.equal(entry('a').y, box.h + entry('r').stack + box.gy, 'les enfants commencent sous la pile de la racine');
  assert.deepEqual([entry('a1').y, entry('a2').y], [entry('a').y + box.h + CREW.top, entry('a').y + box.h + CREW.top + CREW.h + CREW.gap]);
  assert.equal(entry('a1').person, true);
  assert.equal(entry('a1').x, entry('a').x, 'les personnes sont sous leur structure');
  assert.equal(layout.height, entry('a').y + box.h + stack, 'le dessin va jusqu\'au bas de la pile la plus basse');
  const folded = layoutOrg([root], { box, open: new Set() });
  assert.equal(folded.entries.some(each => each.person), false, 'une structure repliée cache ses personnes avec elle');
});

test('organigramme : les filtres et la recherche réduisent les structures aux personnes qui passent, les autres cartes sont estompées', () => {
  const doc = documentFixture();
  const schema = schemaOf(doc._grist_Tables, doc._grist_Tables_column);
  const config = configFixture();
  const people = buildPeople(config, 'Personnes', doc, schema);
  const data = { people, config, tree: buildTree(people, config.levels, 'Annuaire') };
  const walk = (item, each) => { each(item); item.ch.forEach(child => walk(child, each)); };
  const titles = (roots, pick) => { const found = []; roots.forEach(root => walk(root, item => found.push(...pick(item)))); return found; };

  const all = orgData({ mode: 'structures', data, query: '', filters: {}, wantPeople: false });
  assert.equal(all.signature, '');
  assert.equal(all.found.length, 6);
  assert.deepEqual(titles(all.roots, item => item.people.map(person => person.card.title)), [], 'sans le bouton « Personnes », aucune personne n\'est dessinée');

  const one = orgData({ mode: 'structures', data, query: 'camille', filters: {}, wantPeople: true });
  assert.equal(one.signature, 'camille');
  assert.equal(one.withPeople, true);
  assert.deepEqual(titles(one.roots, item => [item.card.title]), ['Annuaire', 'Pôle Ressources', 'Direction des finances', 'Budget'], 'seule la branche de Camille reste');
  assert.deepEqual(titles(one.roots, item => item.people.map(person => person.card.title)), ['Camille Durand']);
  assert.equal(one.roots[0].card.count, 1, 'les comptes disent les personnes qui passent');

  const level = orgData({ mode: 'structures', data, query: '', filters: { [levelKey(0)]: new Set(['Pôle Numérique']) }, wantPeople: false });
  assert.deepEqual(titles(level.roots, item => [item.card.title]), ['Annuaire', 'Pôle Numérique', 'Direction du numérique'], 'un filtre de niveau garde sa branche');
  assert.notEqual(level.signature, one.signature, 'la signature change avec les filtres : l\'organigramme se déplie de nouveau');

  const none = orgData({ mode: 'structures', data, query: 'zzz', filters: {}, wantPeople: true });
  assert.deepEqual([none.roots, none.found], [[], []]);

  const managers = orgData({ mode: 'managers', data, query: 'camille', filters: {}, wantPeople: true, linesOf: () => [] });
  assert.equal(managers.withPeople, false, 'chez les responsables, les personnes sont déjà les cartes');
  const flat = titles(managers.roots, item => [[item.card.title, item.card.dim]]);
  assert.deepEqual(flat, [['Emma Rolland', true], ['Nathan Roussel', true], ['Camille Durand', false]], 'le responsable d\'une personne trouvée relie, estompé');
  assert.equal(orgData({ mode: 'managers', data, query: '', filters: {}, wantPeople: false, linesOf: () => [] }).roots.length, 2);
});

test('organigramme : au-delà de la limite, les personnes ne se dessinent plus', () => {
  const doc = documentFixture();
  const schema = schemaOf(doc._grist_Tables, doc._grist_Tables_column);
  const config = configFixture();
  const people = buildPeople(config, 'Personnes', doc, schema);
  const many = Array.from({ length: PEOPLE_MAX + 1 }, (_, i) => ({ ...people[i % people.length], row: 100 + i }));
  const data = { people: many, config, tree: buildTree(many, config.levels, 'Annuaire') };
  assert.equal(orgData({ mode: 'structures', data, query: '', filters: {}, wantPeople: true }).withPeople, false);
  assert.equal(orgData({ mode: 'structures', data: { ...data, people: many.slice(0, PEOPLE_MAX), tree: buildTree(many.slice(0, PEOPLE_MAX), config.levels, 'A') }, query: '', filters: {},
    wantPeople: true }).withPeople, true);
});
