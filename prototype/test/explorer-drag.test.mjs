// Le glisser-déposer de l'explorateur (js/explorer/explorer-drag.js) : ce qui s'accepte, ce qui s'éclaire, ce qui est déplacé. Des doublures du DOM : ce que le vrai navigateur fait des événements de glisser se mesure
// à la vraie souris dans le labo (labo/run-glisser-explorateur.mjs) ; sous Firefox, le départ et le survol d'une cible sont mesurés par test/interfaces-firefox.test.mjs (le dépôt, lui, n'y aboutit pas au banc).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Dragging, canDrop, targetOf } from '../js/explorer/explorer-drag.js';

const TYPE = 'application/x-gfs-ligne';
const files = [{ key: 'a:1', folder: 'Factures' }, { key: 'a:2', folder: '' }];
const file = key => files.find(item => item.key === key);

// Un élément de doublure : une liste de classes, des données, et `closest` qui rend l'élément quand il est de la bonne sorte.
const element = (kind, data = {}, extra = {}) => {
  const classes = new Set(kind === 'tree' ? ['tr-row'] : []);
  const el = {
    dataset: data, draggable: undefined, classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) }, has: c => classes.has(c),
    closest: selector => (selector.includes('data-path') && kind !== 'row' ? el : (selector.includes('data-key') && kind === 'row' ? el : null)),
    contains: other => other === el, querySelector: () => null, ...extra,
  };
  return el;
};
const row = key => element('row', { key });
const treeRow = (path, open = null) => element('tree', { path }, {
  querySelector: selector => (selector === '[data-toggle]' ? (open === null ? null : {}) : (selector === '.ic.open' ? (open ? {} : null) : null)),
});

function setup({ may = true } = {}) {
  const handlers = {};
  const root = { addEventListener: (type, fn) => { handlers[type] = fn; }, querySelectorAll: () => [...dragging.rows] };
  const log = { moves: [], expanded: [], timers: [], cancelled: [] };
  const dragging = new Dragging({
    root, may: () => may, file, moveTo: (key, path) => log.moves.push([key, path]), expand: path => log.expanded.push(path),
    later: (run, ms) => { log.timers.push({ run, ms }); return log.timers.length; }, cancel: id => log.cancelled.push(id),
  });
  dragging.rows = [];
  const data = {};
  const dataTransfer = { types: [], setData(type, value) { data[type] = value; this.types = [type]; }, effectAllowed: '', dropEffect: '' };
  const event = (target, extra = {}) => ({ target, dataTransfer, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra });
  return { handlers, log, dragging, dataTransfer, data, event };
}

test('on peut déposer dans un autre dossier, à la racine aussi ; pas dans le dossier où la ligne est déjà', () => {
  assert.equal(canDrop({ key: 'a:1', path: '', file }), true);
  assert.equal(canDrop({ key: 'a:1', path: 'Autre', file }), true);
  assert.equal(canDrop({ key: 'a:1', path: 'Factures', file }), false);
  assert.equal(canDrop({ key: 'a:2', path: '', file }), false, 'déjà à la racine');
  assert.equal(canDrop({ key: 'a:absent', path: 'Autre', file }), false, 'un fichier qui n\'est plus là ne se dépose pas');
});

test('un dossier va en amont (la racine, un ancêtre sauf son parent) et en aval (un voisin), jamais sur lui-même, dans un de ses sous-dossiers, ni dans son dossier parent', () => {
  assert.equal(canDrop({ key: 'dir:A/B', path: '', file }), true, 'à la racine');
  assert.equal(canDrop({ key: 'dir:A/B/C', path: 'A', file }), true, 'en amont, sur un ancêtre');
  assert.equal(canDrop({ key: 'dir:A/B', path: 'X', file }), true, 'dans un dossier voisin');
  assert.equal(canDrop({ key: 'dir:A/B', path: 'A/B', file }), false, 'sur lui-même');
  assert.equal(canDrop({ key: 'dir:A/B', path: 'A/B/C', file }), false, 'dans un de ses sous-dossiers');
  assert.equal(canDrop({ key: 'dir:A/B', path: 'A', file }), false, 'il y est déjà : son dossier parent');
  assert.equal(canDrop({ key: 'dir:A', path: '', file }), false, 'un dossier de la racine sur la racine');
});

test('la cible : le volet et le fil d\'Ariane disent leur chemin, une ligne ou une vignette de dossier sa clé ; la racine est le chemin vide', () => {
  const tree = treeRow('Factures/2026');
  assert.deepEqual(targetOf(tree), { element: tree, path: 'Factures/2026' });
  assert.equal(targetOf(treeRow('')).path, '', 'la racine « Moi »');
  const folder = row('dir:Contrats');
  assert.deepEqual(targetOf(folder), { element: folder, path: 'Contrats' });
  assert.equal(targetOf({ closest: () => null }), null);
  assert.equal(targetOf(null), null);
});

test('prendre une ligne : la clé est gardée, le curseur dit « déplacer », la ligne s\'efface après la capture de l\'image', () => {
  const { handlers, dataTransfer, data, event, log } = setup();
  const line = row('a:1');
  handlers.dragstart(event(line));
  assert.equal(data[TYPE], 'a:1');
  assert.equal(dataTransfer.effectAllowed, 'move');
  assert.equal(log.timers[0].ms, 0);
  assert.equal(line.has('is-dragging'), false, 'pas avant la fin de l\'événement');
  log.timers[0].run();
  assert.equal(line.has('is-dragging'), true);
});

test('à la corbeille ou pendant un choix, rien ne se prend', () => {
  const { handlers, data, event } = setup({ may: false });
  handlers.dragstart(event(row('a:1')));
  assert.deepEqual(data, {});
  const rows = [element('row'), element('row')];
  const stub = { querySelectorAll: () => rows };
  const gate = setup({ may: false });
  gate.dragging.mark(stub);
  assert.deepEqual(rows.map(each => each.draggable), [false, false]);
  const open = setup();
  open.dragging.mark(stub);
  assert.deepEqual(rows.map(each => each.draggable), [true, true]);
});

test('survoler un dossier qui accepterait la ligne : il s\'éclaire, le dépôt est permis (preventDefault) ; un dossier qui ne la prendrait pas ne s\'éclaire pas', () => {
  const { handlers, dataTransfer, event } = setup();
  handlers.dragstart(event(row('a:1')));
  const ok = treeRow('Autre');
  const over = event(ok);
  handlers.dragover(over);
  assert.equal(over.defaultPrevented, true);
  assert.equal(dataTransfer.dropEffect, 'move');
  assert.equal(ok.has('is-drop'), true);
  const same = treeRow('Factures');
  const refused = event(same);
  handlers.dragover(refused);
  assert.equal(refused.defaultPrevented, false, 'le dossier de la ligne : rien n\'est accepté');
  assert.equal(same.has('is-drop'), false);
  assert.equal(ok.has('is-drop'), false, 'l\'ancienne cible est éteinte');
});

test('un glissement qui n\'est pas le nôtre (un fichier de l\'ordinateur, une ligne tenue puis perdue) n\'est jamais accepté', () => {
  const { handlers, event } = setup();
  const foreign = event(treeRow('Autre'), { dataTransfer: { types: ['Files'], setData() {} } });
  handlers.dragover(foreign);
  assert.equal(foreign.defaultPrevented, false, 'aucune ligne n\'a été prise');
  handlers.dragstart(event(row('a:1')));
  const other = event(treeRow('Autre'), { dataTransfer: { types: ['text/plain'], setData() {} } });
  handlers.dragover(other);
  assert.equal(other.defaultPrevented, false, 'ce n\'est pas notre type de donnée');
});

test('déposer : la ligne tenue est déplacée dans le dossier visé, une seule fois, et tout est remis à zéro', () => {
  const { handlers, log, event } = setup();
  const line = row('a:1');
  handlers.dragstart(event(line));
  log.timers[0].run();
  const target = treeRow('Autre');
  handlers.dragover(event(target));
  const dropped = event(target);
  handlers.drop(dropped);
  assert.equal(dropped.defaultPrevented, true);
  assert.deepEqual(log.moves, [['a:1', 'Autre']]);
  assert.equal(target.has('is-drop'), false);
  handlers.drop(event(target));
  assert.equal(log.moves.length, 1, 'un second dépôt n\'a plus rien à déplacer');
});

test('déposer là où rien ne changerait (le dossier de la ligne, un dossier sur lui-même) ne déplace rien', () => {
  const { handlers, log, event } = setup();
  handlers.dragstart(event(row('a:1')));
  handlers.drop(event(treeRow('Factures')));
  assert.deepEqual(log.moves, []);
  handlers.dragstart(event(row('dir:A/B')));
  handlers.drop(event(row('dir:A/B')));
  handlers.dragstart(event(row('dir:A/B')));
  handlers.drop(event(row('dir:A/B/C')));
  assert.deepEqual(log.moves, []);
});

test('fin du glissement sans dépôt (Échap, hors de la fenêtre) : la ligne se rallume, la cible s\'éteint', () => {
  const { handlers, log, event, dragging } = setup();
  const line = row('a:1');
  dragging.rows = [line];
  handlers.dragstart(event(line));
  log.timers[0].run();
  const target = treeRow('Autre');
  handlers.dragover(event(target));
  handlers.dragend(event(line));
  assert.equal(target.has('is-drop'), false);
  assert.equal(line.has('is-dragging'), false);
  handlers.drop(event(target));
  assert.deepEqual(log.moves, []);
});

test('quitter la cible éteint son éclairage, sauf quand on entre dans un de ses éléments', () => {
  const { handlers, event } = setup();
  handlers.dragstart(event(row('a:1')));
  const target = treeRow('Autre');
  handlers.dragover(event(target));
  handlers.dragleave(event(target, { relatedTarget: target }));
  assert.equal(target.has('is-drop'), true, 'on est encore dedans');
  handlers.dragleave(event(target, { relatedTarget: null }));
  assert.equal(target.has('is-drop'), false);
});

test('un dossier fermé du volet qu\'on survole 700 ms s\'ouvre ; un dossier ouvert, ou sans sous-dossier, non ; quitter annule', () => {
  const { handlers, log, event } = setup();
  handlers.dragstart(event(row('a:1')));
  log.timers.length = 0;
  const closed = treeRow('Contrats', false);
  handlers.dragover(event(closed));
  handlers.dragover(event(closed));
  assert.equal(log.timers.length, 1, 'un seul minuteur, même si le survol se répète');
  assert.equal(log.timers[0].ms, 700);
  log.timers[0].run();
  assert.deepEqual(log.expanded, ['Contrats']);
  handlers.dragover(event(treeRow('Ouvert', true)));
  handlers.dragover(event(treeRow('Feuille')));
  assert.equal(log.timers.length, 1, 'ni un dossier déjà ouvert, ni un dossier sans sous-dossier');
  handlers.dragover(event(treeRow('Autre', false)));
  const pending = log.timers.length;
  handlers.dragover(event({ closest: () => null }));
  assert.equal(log.cancelled.at(-1), pending, 'sorti de la cible : le minuteur est annulé');
});
