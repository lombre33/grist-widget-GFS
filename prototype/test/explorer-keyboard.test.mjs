// Ce que l'explorateur fait des touches (js/explorer/explorer-keyboard.js) : la touche tapée -> le geste est dans explorer-keys.test.mjs ; ici, ce que chaque geste fait
// de la ligne choisie, avec des doublures sans DOM. Le vrai clavier se mesure dans l'interface (test/interfaces-firefox.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Keyboard } from '../js/explorer/explorer-keyboard.js';

const KEYS = ['a', 'b', 'c', 'd'];

function bench({ keys = KEYS, sel = null, display = 'list', choice = false, text = false, tops = null } = {}) {
  const log = [];
  const state = { display, sel, q: '' };
  const rows = {};
  keys.forEach((key, index) => {
    rows[key] = { dataset: { key }, offsetTop: tops ? tops[index] : index * 20, button: null, closest: selector => (selector === '[data-key]' ? rows[key] : null),
      querySelector: selector => (selector === '[data-menu]' ? rows[key].button : null) };
  });
  const outside = { closest: () => null };
  const inside = { closest: () => null };
  const body = { closest: () => null };
  const search = { value: '', focus: () => log.push('search.focus'), select: () => log.push('search.select'), closest: () => inside.closest() };
  const selection = text ? { isCollapsed: false, toString: () => 'du texte' } : null;
  const root = {
    ownerDocument: { body, documentElement: {}, getSelection: () => selection },
    contains: node => [inside, search, body === node ? null : undefined, ...Object.values(rows)].includes(node) && node !== undefined,
  };
  const keyboard = new Keyboard({
    root: () => root, state: () => state, search: () => search, list: () => ({ querySelectorAll: () => keys.map(key => rows[key]) }),
    filtering: () => false, keys: () => keys, choice: () => choice,
    opts: () => ({ notice: message => log.push(`notice:${message}`), i18n: { t: key => key } }),
    undo: () => ({ undo: async () => log.push('undo'), redo: async () => log.push('redo') }),
    clipboard: () => ({ paste: async () => log.push('paste'), take: async (key, action) => log.push(`${action}:${key}`) }),
    removal: () => ({ trash: async key => log.push(`trash:${key}`) }),
    select: (key, focus) => log.push(`select:${key}:${focus}`), rowFor: key => rows[key], activate: key => log.push(`activate:${key}`),
    rename: key => log.push(`rename:${key}`), rowMenu: (key, anchor) => log.push(`menu:${key}:${anchor === rows[key] ? 'ligne' : 'bouton'}`),
    goParent: () => log.push('parent'), searched: () => log.push('searched'), requestClose: () => log.push('close'),
  });
  return { keyboard, log, state, rows, search, inside, outside, body };
}

const press = (key, target, mods = {}) => ({
  key, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, repeat: false, defaultPrevented: false, target,
  preventDefault() { this.prevented = true; }, ...mods,
});
// Le clavier est dans une ligne de la liste.
const inRow = (b, key) => b.rows[key];

test('↓ ↑ Début Fin : le choix va à la ligne voisine, borné aux bouts de la liste, et la touche est retenue', () => {
  const b = bench({ sel: 'b' });
  const moves = [['ArrowDown', 'c'], ['ArrowUp', 'a'], ['Home', 'a'], ['End', 'd']];
  for (const [key, expected] of moves) {
    b.log.length = 0;
    const event = press(key, inRow(b, 'b'));
    b.keyboard.onList(event);
    assert.deepEqual(b.log, [`select:${expected}:true`], key);
    assert.equal(event.prevented, true);
  }
  const bottom = bench({ sel: 'd' });
  bottom.keyboard.onList(press('ArrowDown', inRow(bottom, 'd')));
  assert.deepEqual(bottom.log, ['select:d:true'], '↓ sur la dernière ligne y reste');
});

test('rien de choisi : ↓ prend la première ligne', () => {
  const b = bench({ sel: null });
  b.keyboard.onList(press('ArrowDown', inRow(b, 'c')));
  assert.deepEqual(b.log, ['select:a:true']);
});

test('Entrée, F2, Suppr et la touche Menu visent la ligne choisie ; sans choix, celle où est le clavier', () => {
  const chosen = bench({ sel: 'b' });
  for (const key of ['Enter', 'F2', 'Delete', 'ContextMenu']) chosen.keyboard.onList(press(key, inRow(chosen, 'c')));
  assert.deepEqual(chosen.log, ['activate:b', 'rename:b', 'select:b:false', 'trash:b', 'menu:b:ligne']);
  const none = bench({ sel: null });
  for (const key of ['Enter', 'F2']) none.keyboard.onList(press(key, inRow(none, 'c')));
  assert.deepEqual(none.log, ['activate:c', 'rename:c'], 'à l\'ouverture, le clavier est sur une ligne sans qu\'aucune soit choisie');
});

test('la touche Menu ancre le menu sur le bouton « ⋯ » de la ligne quand elle en a un', () => {
  const b = bench({ sel: 'a' });
  b.rows.a.button = { name: 'plus' };
  b.keyboard.onList(press('ContextMenu', inRow(b, 'a')));
  assert.deepEqual(b.log, ['menu:a:bouton']);
});

test('un bouton de la ligne garde ses touches : flèches et Entrée lui reviennent, mais F2, Suppr, Menu et Retour arrière valent encore', () => {
  const b = bench({ sel: 'b' });
  const button = { closest: selector => (selector === 'button' ? {} : (selector === '[data-key]' ? b.rows.b : null)) };
  const event = press('ArrowDown', button);
  b.keyboard.onList(event);
  b.keyboard.onList(press('Enter', button));
  assert.deepEqual(b.log, []);
  assert.equal(event.prevented, undefined, 'la touche n\'est pas retenue : le bouton la traite');
  b.keyboard.onList(press('F2', button));
  b.keyboard.onList(press('Backspace', button));
  assert.deepEqual(b.log, ['rename:b', 'parent']);
});

test('une liste vide : Retour arrière remonte au dossier parent, les autres touches ne font rien', () => {
  const b = bench({ keys: [] });
  const target = { closest: () => null };
  for (const key of ['Enter', 'ArrowDown', 'Delete']) b.keyboard.onList(press(key, target));
  assert.deepEqual(b.log, []);
  b.keyboard.onList(press('Backspace', target));
  assert.deepEqual(b.log, ['parent']);
});

test('Retour arrière dans une liste pleine remonte au dossier parent aussi', () => {
  const b = bench({ sel: 'a' });
  b.keyboard.onList(press('Backspace', inRow(b, 'a')));
  assert.deepEqual(b.log, ['parent']);
});

test('en vignettes, ↓ et ↑ changent de rangée : le nombre de colonnes est celui des vignettes à la hauteur de la première', () => {
  const b = bench({ display: 'tiles', sel: 'a', tops: [0, 0, 80, 80] });
  b.keyboard.onList(press('ArrowDown', inRow(b, 'a')));
  assert.deepEqual(b.log, ['select:c:true']);
  b.log.length = 0;
  b.state.sel = 'd';
  b.keyboard.onList(press('ArrowUp', inRow(b, 'd')));
  assert.deepEqual(b.log, ['select:b:true']);
});

test('« / » met le clavier dans la recherche quand il est dans l\'explorateur, et nulle part ailleurs', () => {
  const b = bench();
  const inside = press('/', b.inside);
  b.keyboard.onDocument(inside);
  assert.deepEqual(b.log, ['search.focus', 'search.select']);
  assert.equal(inside.prevented, true);
  b.log.length = 0;
  b.keyboard.onDocument(press('/', b.outside));
  assert.deepEqual(b.log, []);
});

test('Échap dans la recherche garnie l\'efface ; ailleurs, il ferme ; une touche déjà prise par un menu ou une fenêtre ne ferme rien', () => {
  const b = bench();
  b.search.value = 'facture';
  b.state.q = 'facture';
  const clearing = press('Escape', b.search);
  b.keyboard.onDocument(clearing);
  assert.deepEqual([b.search.value, b.state.q, b.log, clearing.prevented], ['', '', ['searched'], true]);
  b.log.length = 0;
  b.keyboard.onDocument(press('Escape', b.search));
  b.keyboard.onDocument(press('Escape', b.inside));
  assert.deepEqual(b.log, ['close', 'close'], 'la recherche vide ne retient plus Échap');
  b.log.length = 0;
  b.keyboard.onDocument(press('Escape', b.inside, { defaultPrevented: true }));
  assert.deepEqual(b.log, []);
});

test('le presse-papiers : copier et couper visent la ligne choisie, coller n\'a besoin d\'aucune ligne, Ctrl+Z et Ctrl+Y défont et refont', () => {
  const b = bench({ sel: 'b' });
  const ctrl = (key, target = b.inside, mods = {}) => b.keyboard.onDocument(press(key, target, { ctrlKey: true, ...mods }));
  ctrl('c');
  ctrl('x');
  ctrl('v');
  ctrl('d');
  ctrl('z');
  ctrl('y');
  ctrl('z', b.inside, { shiftKey: true });
  assert.deepEqual(b.log, ['copy:b', 'cut:b', 'paste', 'duplicate:b', 'undo', 'redo', 'redo']);
});

test('sans ligne choisie, copier vise la ligne où est le clavier ; sans ligne du tout, rien ne se copie', () => {
  const b = bench({ sel: null });
  b.keyboard.onDocument(press('c', inRow(b, 'c'), { ctrlKey: true }));
  b.keyboard.onDocument(press('c', b.inside, { ctrlKey: true }));
  assert.deepEqual(b.log, ['copy:c']);
});

test('Ctrl+D tenue enfoncée ne fait qu\'une copie', () => {
  const b = bench({ sel: 'a' });
  b.keyboard.onDocument(press('d', b.inside, { ctrlKey: true }));
  b.keyboard.onDocument(press('d', b.inside, { ctrlKey: true, repeat: true }));
  assert.deepEqual(b.log, ['duplicate:a']);
});

test('du texte surligné dans la page : Ctrl+C et Ctrl+X le copient comme partout, et la touche n\'est pas retenue ; Ctrl+V reste à l\'explorateur', () => {
  const b = bench({ sel: 'a', text: true });
  const copy = press('c', b.inside, { ctrlKey: true });
  b.keyboard.onDocument(copy);
  b.keyboard.onDocument(press('x', b.inside, { ctrlKey: true }));
  assert.deepEqual(b.log, []);
  assert.equal(copy.prevented, undefined);
  b.keyboard.onDocument(press('v', b.inside, { ctrlKey: true }));
  assert.deepEqual(b.log, ['paste']);
});

test('le clavier est dans une fenêtre ou un autre panneau : les touches du presse-papiers ne sont pas à l\'explorateur ; sur le corps de la page, si', () => {
  const b = bench({ sel: 'a' });
  b.keyboard.onDocument(press('c', b.outside, { ctrlKey: true }));
  assert.deepEqual(b.log, []);
  b.keyboard.onDocument(press('c', b.body, { ctrlKey: true }));
  assert.deepEqual(b.log, ['copy:a']);
});

test('pendant un choix de fichier pour une app, le presse-papiers est grisé et la phrase le dit', () => {
  const b = bench({ sel: 'a', choice: true });
  for (const key of ['c', 'x', 'v', 'd', 'z']) b.keyboard.onDocument(press(key, b.inside, { ctrlKey: true }));
  assert.deepEqual(b.log, Array(5).fill('notice:ex.choose.newOff'));
});
