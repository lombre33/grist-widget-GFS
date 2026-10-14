// La recherche : mots dans n'importe quel ordre, accents, casse et ponctuation ignorés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, words, matchesWords } from '../js/search.js';

test('normalize : accents, casse, ponctuation et ligatures', () => {
  assert.equal(normalize('  Émargement — Feuille d’ÉMARGEMENT (v2) '), 'emargement feuille d emargement v2');
  assert.equal(normalize('Œuvre ﬁnale'), 'oeuvre finale');
  assert.equal(normalize(null), '');
  assert.equal(normalize('Приём 2024'), 'приём 2024'.normalize('NFKD').replace(/\p{M}+/gu, ''));
});

test('words : une recherche vide ne donne aucun mot', () => {
  assert.deepEqual(words('   '), []);
  assert.deepEqual(words('Feuille,   émargement'), ['feuille', 'emargement']);
});

test('matchesWords : chaque mot, dans n\'importe quel ordre', () => {
  const hay = normalize('Feuille d’émargement (grille)');
  assert.equal(matchesWords(words('grille feuille'), hay), true);
  assert.equal(matchesWords(words('EMARGEMENT'), hay), true);
  assert.equal(matchesWords(words('feuille absent'), hay), false);
  assert.equal(matchesWords([], hay), true);
});
