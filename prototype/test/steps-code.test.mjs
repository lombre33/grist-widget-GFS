// Les deux gestes que les fenêtres « Envoyer » et « Recevoir » (et les panneaux de droits) partagent : la zone de code avec son bouton « Copier » (js/steps-window.js, `codeWithCopy`) et l'écriture des actions
// dans le document (js/rights-actions.js, `writeActions`). Un DOM de doublure (test/fake-dom.mjs) : le texte, les clés et les écouteurs ; la mise en page se mesure sous Firefox (test/partager-autre-firefox.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDocument } from './fake-dom.mjs';

installFakeDocument();
const { codeWithCopy } = await import('../js/steps-window.js');
const { writeActions } = await import('../js/rights-actions.js');

test('la zone de code porte sa clé et sa valeur, se sélectionne quand le clavier y arrive ; le bouton « Copier » recopie la zone', () => {
  const copied = [];
  const ctx = { t: key => `«${key}»`, copy: zone => copied.push(zone) };
  const { code, copy } = codeWithCopy(ctx, { fk: 'so-code', copyFk: 'so-copy', label: 'Le code', value: 'GRISTSYNC2.abc' });
  assert.equal(code.dataset.fk, 'so-code');
  assert.equal(code.attrs['aria-label'], 'Le code');
  assert.equal(code.value, 'GRISTSYNC2.abc');
  assert.equal(copy.dataset.fk, 'so-copy');
  assert.equal(copy.elements.length >= 1, true, 'le bouton porte son icône');
  assert.equal(copy.children.at(-1), '«so.code.copy»');
  let selected = 0;
  code.select = () => { selected += 1; };
  code.listeners.focus[0]();
  assert.equal(selected, 1, 'le clavier sur la zone la sélectionne');
  copy.listeners.click[0]();
  assert.deepEqual(copied, [code], 'le bouton recopie la zone, pas une autre');
});

test('écrire des actions : une écriture bloquée n\'écrit rien et dit pourquoi ; Grist qui refuse est dit en 300 signes au plus', async () => {
  const written = [];
  const open = { writeBlock: () => null, port: { doc: { applyUserActions: async actions => { written.push(actions); } } } };
  assert.deepEqual(await writeActions(open, [['AddRecord', 'T', null, {}]]), { ok: true });
  assert.deepEqual(written, [[['AddRecord', 'T', null, {}]]]);
  const blocked = { writeBlock: () => 'Le document est en lecture seule.', port: { doc: { applyUserActions: async () => { throw new Error('ne devait pas être appelé'); } } } };
  assert.deepEqual(await writeActions(blocked, [['X']]), { ok: false, message: 'Le document est en lecture seule.' });
  const refused = { writeBlock: () => null, port: { doc: { applyUserActions: async () => { throw new Error('x'.repeat(500)); } } } };
  const answer = await writeActions(refused, [['X']]);
  assert.equal(answer.ok, false);
  assert.equal(answer.message.length, 300);
  const plain = { writeBlock: () => null, port: { doc: { applyUserActions: async () => { throw 'texte brut'; } } } };
  assert.deepEqual(await writeActions(plain, [['X']]), { ok: false, message: 'texte brut' });
});
