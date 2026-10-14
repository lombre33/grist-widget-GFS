// Les textes : même lot en français et en anglais, pluriels par {n|singulier|pluriel}.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createI18n, STRING_TABLES } from '../js/i18n.js';

test('chaque texte existe en français et en anglais, avec les mêmes variables', () => {
  const fr = Object.keys(STRING_TABLES.fr);
  const en = Object.keys(STRING_TABLES.en);
  assert.deepEqual(fr.filter(k => !en.includes(k)), [], 'absents en anglais');
  assert.deepEqual(en.filter(k => !fr.includes(k)), [], 'absents en français');
  const vars = text => [...new Set([...text.matchAll(/\{(\w+)[|}]/g)].map(m => m[1]))].sort().join(',');
  for (const key of fr) assert.equal(vars(STRING_TABLES.fr[key]), vars(STRING_TABLES.en[key]), key);
});

test('pluriels : zéro et un sont au singulier en français, un seul l\'est en anglais', () => {
  const fr = createI18n('fr').t;
  const en = createI18n('en').t;
  assert.equal(fr('ex.fileCount', { n: 0 }), '0 fichier');
  assert.equal(fr('ex.fileCount', { n: 1 }), '1 fichier');
  assert.equal(fr('ex.fileCount', { n: 3 }), '3 fichiers');
  assert.equal(en('ex.fileCount', { n: 0 }), '0 files');
  assert.equal(en('ex.fileCount', { n: 1 }), '1 file');
});

test('variables, texte inconnu et langue inconnue', () => {
  const { t, lang } = createI18n('de');
  assert.equal(lang, 'fr');
  assert.equal(t('gfs.loading', { app: 'Publipostage+' }), 'Publipostage+ se charge…');
  const warnings = [];
  const original = console.warn;
  console.warn = message => warnings.push(message);
  try { assert.equal(t('absent.cle'), 'absent.cle'); t('absent.cle'); } finally { console.warn = original; }
  assert.equal(warnings.length, 1, 'un seul avertissement par texte inconnu');
});

test('le français parle de « modèle », jamais de « template »', () => {
  for (const [key, text] of Object.entries(STRING_TABLES.fr)) assert.doesNotMatch(text, /template/i, key);
});
