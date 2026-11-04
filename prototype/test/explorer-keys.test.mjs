// Les touches de l'explorateur (js/explorer-keys.js) : la touche tapée -> le geste. Ce que le geste fait de la ligne choisie se mesure dans l'interface (test/interfaces-firefox.test.mjs, avec un vrai
// clavier) ; ici, la table des touches, sans DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listAction, isSearchKey, clipboardAction, parentPath, stepRow } from '../js/explorer-keys.js';

const press = (key, mods = {}) => ({ key, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, ...mods });
const LIST = { display: 'list', filtering: false };
const TILES = { display: 'tiles', filtering: false };

test('en liste : ↑ ↓, Début, Fin, Entrée, F2, Suppr, Retour arrière, la touche Menu et Maj+F10 ont chacun leur geste ; ← → n\'en ont pas', () => {
  const gestures = Object.fromEntries(['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', 'F2', 'Delete', 'Backspace', 'ContextMenu', 'a', ' ', 'Tab', 'Escape'].map(key => [key, listAction(press(key), LIST)]));
  assert.deepEqual(gestures, {
    ArrowDown: 'next', ArrowUp: 'prev', ArrowLeft: null, ArrowRight: null, Home: 'first', End: 'last', Enter: 'activate', F2: 'rename', Delete: 'delete', Backspace: 'parent', ContextMenu: 'menu',
    a: null, ' ': null, Tab: null, Escape: null,
  });
  assert.equal(listAction(press('F10', { shiftKey: true }), LIST), 'menu');
  assert.equal(listAction(press('F10'), LIST), null, 'F10 seul n\'est pas le menu');
});

test('en vignettes : ← → changent de vignette, ↑ ↓ de rangée ; le reste ne change pas', () => {
  assert.deepEqual(['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Enter', 'Delete'].map(key => listAction(press(key), TILES)), ['next', 'prev', 'down', 'up', 'activate', 'delete']);
});

test('une touche tapée avec Ctrl, Alt ou Méta n\'est pas à GFS (Ctrl+D, Ctrl+F, Alt+←, Alt+↑ sont au navigateur) ; Maj seul ne change que F10', () => {
  for (const mods of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }]) {
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'Enter', 'F2', 'Delete', 'Backspace', 'd', 'f', 'ArrowLeft']) assert.equal(listAction(press(key, mods), LIST), null, `${key} avec ${Object.keys(mods)[0]}`);
  }
  assert.equal(listAction(press('F10', { shiftKey: true, ctrlKey: true }), LIST), null);
  for (const key of ['ArrowDown', 'Delete', 'Enter', 'F2']) assert.equal(listAction(press(key, { shiftKey: true }), LIST), null, `Maj+${key}`);
});

test('Retour arrière ne remonte pas pendant une recherche : la liste ne montre pas un dossier', () => {
  assert.equal(listAction(press('Backspace'), { display: 'list', filtering: true }), null);
  assert.equal(listAction(press('Backspace'), LIST), 'parent');
});

test('« / » va à la recherche, sauf dans un champ de saisie et avec Ctrl, Alt ou Méta', () => {
  const field = tag => ({ closest: selector => (selector.split(',').map(part => part.trim()).includes(tag) ? {} : null) });
  const slash = (mods = {}, target = null) => ({ ...press('/', mods), target });
  assert.equal(isSearchKey(slash()), true);
  assert.equal(isSearchKey(slash({}, field('div'))), true);
  for (const tag of ['input', 'textarea', 'select']) assert.equal(isSearchKey(slash({}, field(tag))), false, tag);
  assert.equal(isSearchKey(slash({}, { closest: () => ({}) })), false, 'un champ modifiable');
  assert.equal(isSearchKey(slash({ ctrlKey: true })), false);
  assert.equal(isSearchKey({ ...press('a'), target: null }), false);
});

test('parentPath : un dossier monte d\'un niveau, la racine reste la racine', () => {
  assert.deepEqual(['Factures/2024/Mars', 'Factures/2024', 'Factures', ''].map(parentPath), ['Factures/2024', 'Factures', '', '']);
});

test('stepRow : une rangée plus bas ou plus haut, sans sortir de la grille ; de l\'avant-dernière rangée, ↓ va à la dernière vignette', () => {
  // 7 vignettes sur 3 colonnes : [0 1 2] [3 4 5] [6]
  assert.deepEqual([[1, 1], [4, 1], [5, 1], [6, 1], [0, -1], [4, -1], [6, -1], [2, -1]].map(([at, dir]) => stepRow(at, 3, 7, dir)), [4, 6, 6, 6, 0, 1, 3, 2]);
  assert.equal(stepRow(-1, 3, 7, 1), 0, 'rien n\'est choisi : la première');
  assert.equal(stepRow(-1, 3, 7, -1), 0);
  assert.equal(stepRow(0, 3, 0, 1), -1, 'aucune vignette');
  assert.equal(stepRow(2, 0, 5, 1), 3, 'une largeur inconnue vaut une colonne');
  assert.equal(stepRow(3, 1, 4, 1), 3, 'une colonne, dernière ligne : on reste');
});

// Le presse-papiers : Ctrl+C, Ctrl+X, Ctrl+V (⌘ sur Mac). Ctrl+D n'est pas liée : c'est le marque-page du navigateur, et GFS ne lie aucun geste à une touche qu'on ne peut pas avoir partout.
test('Ctrl+C copie, Ctrl+X coupe, Ctrl+V colle ; ⌘ vaut Ctrl ; la majuscule d\'un verrouillage des capitales aussi', () => {
  assert.deepEqual(['c', 'x', 'v'].map(key => clipboardAction(press(key, { ctrlKey: true }))), ['copy', 'cut', 'paste']);
  assert.deepEqual(['c', 'x', 'v'].map(key => clipboardAction(press(key, { metaKey: true }))), ['copy', 'cut', 'paste']);
  assert.deepEqual(['C', 'X', 'V'].map(key => clipboardAction(press(key, { ctrlKey: true }))), ['copy', 'cut', 'paste']);
});

test('Ctrl+Z (⌘+Z sur Mac) est l\'annulation ; Ctrl+Y et Ctrl+Maj+Z (⌘+Maj+Z) le rétablissement ; avec Alt, rien', () => {
  assert.equal(clipboardAction(press('z', { ctrlKey: true })), 'undo');
  assert.equal(clipboardAction(press('Z', { ctrlKey: true })), 'undo', 'les capitales verrouillées');
  assert.equal(clipboardAction(press('z', { metaKey: true })), 'undo');
  assert.equal(clipboardAction(press('y', { ctrlKey: true })), 'redo');
  assert.equal(clipboardAction(press('Z', { ctrlKey: true, shiftKey: true })), 'redo', 'Ctrl+Maj+Z : la touche rend « Z »');
  assert.equal(clipboardAction(press('z', { metaKey: true, shiftKey: true })), 'redo', '⌘+Maj+Z sur Mac');
  assert.equal(clipboardAction(press('z', { ctrlKey: true, altKey: true })), null);
  assert.equal(clipboardAction(press('y', { ctrlKey: true, altKey: true })), null);
  assert.equal(clipboardAction(press('z')), null, 'sans Ctrl, c\'est une lettre');
  assert.equal(clipboardAction(press('y', { ctrlKey: true, shiftKey: true })), null, 'Ctrl+Maj+Y n\'est pas liée');
});

test('sans Ctrl ou ⌘, une lettre n\'est pas le presse-papiers ; avec Alt (AltGr) ou Maj (Ctrl+Maj+V : coller sans mise en forme), non plus ; ni les autres lettres', () => {
  assert.deepEqual(['c', 'x', 'v', 'z'].map(key => clipboardAction(press(key))), [null, null, null, null]);
  assert.deepEqual(['c', 'x', 'v', 'z'].map(key => clipboardAction(press(key, { ctrlKey: true, altKey: true }))), Array(4).fill(null));
  assert.deepEqual(['c', 'x', 'v'].map(key => clipboardAction(press(key, { ctrlKey: true, shiftKey: true }))), Array(3).fill(null));
  assert.deepEqual(['d', 'a', 'f', 'w', 'F2', 'Delete', 'Control'].map(key => clipboardAction(press(key, { ctrlKey: true }))), Array(7).fill(null), 'Ctrl+D (marque-page) n\'est jamais liée');
  assert.equal(clipboardAction({ ctrlKey: true }), null, 'un événement sans touche');
});

test('dans un champ de saisie (la recherche, une fenêtre), Ctrl+C, X, V, Z et Y gardent leur sens : copier, couper, coller, annuler et rétablir le texte', () => {
  const field = tag => ({ closest: selector => (selector.split(',').map(part => part.trim()).includes(tag) ? {} : null) });
  for (const tag of ['input', 'textarea', 'select', '[contenteditable]']) assert.equal(clipboardAction({ ...press('v', { ctrlKey: true }), target: field(tag) }), null, tag);
  assert.equal(clipboardAction({ ...press('v', { ctrlKey: true }), target: field('li') }), 'paste', 'une ligne de la liste n\'est pas un champ');
  assert.equal(clipboardAction({ ...press('v', { ctrlKey: true }), target: {} }), 'paste', 'une cible sans `closest`');
  assert.equal(clipboardAction({ ...press('z', { ctrlKey: true }), target: field('input') }), null, 'Ctrl+Z défait la frappe dans la recherche');
  assert.equal(clipboardAction({ ...press('y', { ctrlKey: true }), target: field('input') }), null, 'Ctrl+Y la refait');
  assert.equal(clipboardAction({ ...press('Z', { ctrlKey: true, shiftKey: true }), target: field('input') }), null, 'Ctrl+Maj+Z aussi');
});
