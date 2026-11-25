// La recherche d'un filtre de l'annuaire (js/annuaire/annuaire-filter-panel.js, retour du porteur du 25/11 : « un champ de recherche par filtre ») : ce qui s'écrit réduit les
// valeurs de ce filtre seulement, des mots dans n'importe quel ordre, accents, casse et ponctuation ignorés, sur le texte que la personne lit (un oui/non en toutes lettres). Le
// dessin du panneau et de la barre se mesure sous Firefox (test/annuaire-filtres-firefox.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createI18n } from '../js/i18n/i18n.js';
import { valuesMatching, activeCount, sectionOpen } from '../js/annuaire/annuaire-filter-panel.js';

const ctx = language => ({ t: createI18n(language).t, locale: language });
const option = (genre, ...values) => ({ col: 'X', label: 'X', genre, values: values.map((value, at) => ({ value, count: at + 1 })) });
const texts = found => found.map(entry => entry.value);

test('la recherche d\'un filtre : des mots dans n\'importe quel ordre, sans accents ni casse ni ponctuation', () => {
  const sites = option('text', 'Siège', 'Campus Saint-Germain', 'Pôle Numérique', 'Bibliothèque universitaire');
  assert.deepEqual(texts(valuesMatching(sites, '', ctx('fr'))), ['Siège', 'Campus Saint-Germain', 'Pôle Numérique', 'Bibliothèque universitaire'], 'rien de tapé : toutes les valeurs');
  assert.deepEqual(texts(valuesMatching(sites, '   ', ctx('fr'))), texts(sites.values), 'des espaces seuls ne cherchent rien');
  assert.deepEqual(texts(valuesMatching(sites, 'siege', ctx('fr'))), ['Siège']);
  assert.deepEqual(texts(valuesMatching(sites, 'GERMAIN saint', ctx('fr'))), ['Campus Saint-Germain'], 'l\'ordre des mots et la casse ne comptent pas');
  assert.deepEqual(texts(valuesMatching(sites, 'bibliotheque univ', ctx('fr'))), ['Bibliothèque universitaire'], 'un début de mot suffit');
  assert.deepEqual(texts(valuesMatching(sites, 'zzz', ctx('fr'))), [], 'sans réponse : aucune valeur');
});

test('la recherche d\'un oui/non porte sur le texte lu, dans la langue de la personne ; les nombres de personnes restent ceux des valeurs', () => {
  const remote = option('bool', 'true', 'false');
  assert.deepEqual(texts(valuesMatching(remote, 'oui', ctx('fr'))), ['true']);
  assert.deepEqual(texts(valuesMatching(remote, 'non', ctx('fr'))), ['false']);
  assert.deepEqual(texts(valuesMatching(remote, 'yes', ctx('en'))), ['true']);
  assert.deepEqual(texts(valuesMatching(remote, 'oui', ctx('en'))), [], 'en anglais, « oui » ne trouve rien');
  assert.deepEqual(valuesMatching(remote, 'oui', ctx('fr')), [{ value: 'true', count: 1 }]);
});

test('le nombre de cases cochées, tous filtres confondus, et les filtres dépliés par défaut', () => {
  assert.equal(activeCount({}), 0);
  assert.equal(activeCount({ A: new Set(['x', 'y']), B: new Set(), C: new Set(['z']) }), 3);
  const opened = new Map();
  assert.equal(sectionOpen({ col: 'A' }, 0, {}, opened), true);
  assert.equal(sectionOpen({ col: 'C' }, 2, {}, opened), false, 'au-delà des deux premiers : repliés');
  assert.equal(sectionOpen({ col: 'C' }, 2, { C: new Set(['z']) }, opened), true, 'un filtre qui a une valeur choisie reste ouvert');
  opened.set('A', false);
  assert.equal(sectionOpen({ col: 'A' }, 0, {}, opened), false, 'ce que la personne a décidé prend le pas');
});
