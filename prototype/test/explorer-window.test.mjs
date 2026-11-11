// La liste fenêtrée de l'explorateur (js/explorer-window.js, carte « Afficher seulement les lignes visibles » de l'audit vitesse du 10/11, faits vérifiés 87) : la géométrie, sans navigateur. Ce que le
// navigateur en fait (le clavier, le défilement, la souris, le glisser-déposer, la mémoire) se mesure sous Firefox dans test/fenetrage-firefox.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { windowRange, scrollToReveal, WINDOW_FROM } from '../js/explorer-window.js';

const LIST = { offset: 26, rowH: 28, perRow: 1, viewport: 400 };

test('windowRange : en haut, la fenêtre commence à 0 et couvre l\'écran et un peu plus ; le reste est du remplissage', () => {
  const range = windowRange({ ...LIST, scrollTop: 0, count: 20000 });
  assert.equal(range.from, 0);
  assert.equal(range.to, Math.ceil((400 - 26) / 28) + 8);
  assert.equal(range.before, 0);
  assert.equal(range.after, (20000 - range.to) * 28, 'le remplissage du bas tient la place des lignes non construites');
});

test('windowRange : au milieu, le haut, le bas et les lignes construites tiennent exactement la hauteur de la liste entière', () => {
  for (const scrollTop of [28, 2800, 123456, 559000]) {
    const range = windowRange({ ...LIST, scrollTop, count: 20000 });
    assert.equal(range.before + (range.to - range.from) * 28 + range.after, 20000 * 28, `hauteur à ${scrollTop}`);
    assert.ok(range.from * 28 + 26 <= scrollTop && range.to * 28 + 26 >= scrollTop + 400, `l'écran est couvert à ${scrollTop}`);
    assert.ok(range.to - range.from <= 400 / 28 + 2 * 8 + 2, 'jamais plus que l\'écran et les deux marges');
  }
});

test('windowRange : en bas, jusqu\'au dernier élément, et un défilement plus loin que le contenu (la liste a raccourci) garde de quoi montrer', () => {
  const bottom = windowRange({ ...LIST, scrollTop: 20000 * 28 + 26 - 400, count: 20000 });
  assert.equal(bottom.to, 20000);
  assert.equal(bottom.after, 0);
  const beyond = windowRange({ ...LIST, scrollTop: 10 ** 9, count: 300 });
  assert.equal(beyond.to, 300);
  assert.ok(beyond.to - beyond.from >= 1 && beyond.from >= 0, 'au moins une rangée');
});

test('windowRange : en vignettes, la fenêtre commence et finit sur des rangées entières, la dernière rangée peut être incomplète', () => {
  const grid = { offset: 8, rowH: 120, perRow: 5, viewport: 400 };
  for (const scrollTop of [0, 1000, 33333]) {
    const range = windowRange({ ...grid, scrollTop, count: 5003 });
    assert.equal(range.from % 5, 0, 'commence au début d\'une rangée');
    assert.ok(range.to % 5 === 0 || range.to === 5003, 'finit à la fin d\'une rangée ou du contenu');
    assert.equal(range.before + Math.ceil((range.to - range.from) / 5) * 120 + range.after, Math.ceil(5003 / 5) * 120);
  }
  assert.equal(windowRange({ ...grid, scrollTop: 10 ** 9, count: 5003 }).to, 5003);
});

test('windowRange : sans élément, rien n\'est construit', () => {
  assert.deepEqual(windowRange({ ...LIST, scrollTop: 0, count: 0 }), { from: 0, to: 0, before: 0, after: 0 });
});

test('scrollToReveal : une ligne déjà visible ne fait pas bouger le défilement ; une ligne cachée par l\'en-tête collé ou par le bas est amenée au bord le plus proche', () => {
  const base = { ...LIST, sticky: 26, scrollTop: 2800 };
  const row = index => 26 + index * 28; // le haut de la ligne
  assert.equal(scrollToReveal({ ...base, index: 105 }), 2800, 'visible : rien ne bouge');
  assert.equal(scrollToReveal({ ...base, index: 99 }), row(99) - 26, 'sous l\'en-tête collé : elle se range sous lui');
  assert.equal(scrollToReveal({ ...base, index: 500 }), row(500) + 28 - 400, 'sous le bas : elle se range contre le bas');
  assert.equal(scrollToReveal({ ...base, scrollTop: 100, index: 0 }), 0, 'la première ligne : jusqu\'en haut');
  assert.equal(scrollToReveal({ ...base, perRow: 4, rowH: 120, offset: 8, sticky: 0, scrollTop: 0, index: 43 }), 8 + 10 * 120 + 120 - 400, 'une vignette : sa rangée');
});

test('le seuil : en dessous, la liste est construite entière comme avant', () => {
  assert.ok(WINDOW_FROM >= 100 && WINDOW_FROM <= 500, 'assez haut pour que les listes ordinaires gardent leur DOM d\'avant, assez bas pour que 5 000 fichiers ne coûtent rien');
});
