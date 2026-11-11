// La base commune des fenêtres : les arrêts de Tab. Un groupe de boutons radio n'en a qu'un (le coché, sinon le premier) : un clavier qui traverse une fenêtre de cinq vignettes ne s'y arrête pas
// cinq fois, il y entre une fois et les flèches choisissent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tabStops } from '../js/ui/modal.js';

const radio = (name, value, checked = false, form = null) => ({ type: 'radio', name, value, checked, form });
const other = type => ({ type });

test('un groupe de boutons radio n\'a qu\'un arrêt : le coché', () => {
  const [a, b, c] = [radio('amb', 'a'), radio('amb', 'b', true), radio('amb', 'c')];
  const button = other('button');
  assert.deepEqual(tabStops([a, b, c, button]), [b, button]);
});

test('aucun coché : le premier du groupe ; des groupes de noms différents ont chacun le leur', () => {
  const [a, b] = [radio('amb', 'a'), radio('amb', 'b')];
  const [x, y] = [radio('col', 'x'), radio('col', 'y', true)];
  assert.deepEqual(tabStops([a, b, x, y]), [a, y]);
});

test('le reste garde tous ses arrêts, dans l\'ordre ; un radio sans nom est un arrêt à lui seul', () => {
  const [text, button, anonymous, again] = [other('text'), other('button'), radio('', 'z'), radio('', 'w')];
  assert.deepEqual(tabStops([text, anonymous, button, again]), [text, anonymous, button, again]);
  assert.deepEqual(tabStops([]), []);
});

test('deux formulaires gardent chacun leur radio coché', () => {
  const [f1, f2] = [{}, {}];
  const [a, b, c, d] = [radio('amb', 'a', true, f1), radio('amb', 'b', false, f1), radio('amb', 'a', false, f2), radio('amb', 'b', true, f2)];
  assert.deepEqual(tabStops([a, b, c, d]), [a, d]);
});
