// L'endroit de l'explorateur que la reprise après un rechargement retient et retrouve (js/explorer/explorer-place.js ; js/broker/resume.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeOf, applyPlace, PLACE_VIEWS } from '../js/explorer/explorer-place.js';

const state = (extra = {}) => ({ view: 'folder', path: '', group: null, open: new Set(), type: 'all', q: '', sel: null, ...extra });

test('placeOf : la vue et, dans un dossier seulement, son chemin', () => {
  assert.deepEqual(placeOf(state({ path: 'Formation/Archives' })), { view: 'folder', path: 'Formation/Archives' });
  assert.deepEqual(placeOf(state({ view: 'recent', path: 'Formation' })), { view: 'recent', path: '' }, 'hors dossier, le chemin ne compte pas');
  for (const view of ['fav', 'shared', 'trash']) assert.deepEqual(placeOf(state({ view })), { view, path: '' }, view);
});

test('placeOf : « Ouverts » se retrouve à la racine, sa liste repart vide après un rechargement', () => {
  assert.deepEqual(placeOf(state({ view: 'opened', path: 'Stock' })), { view: 'folder', path: '' });
  assert.ok(!PLACE_VIEWS.includes('opened'));
});

test('applyPlace : un dossier se pose comme un clic, ses parents s\'ouvrent dans l\'arbre, la recherche, le filtre et la sélection sont vidés', () => {
  const found = state({ q: 'bon', type: 'document', sel: 'publipostage:3', view: 'trash', group: 'g1' });
  applyPlace(found, { view: 'folder', path: 'Formation/Archives 2025' });
  assert.deepEqual({ view: found.view, path: found.path, group: found.group, q: found.q, type: found.type, sel: found.sel },
    { view: 'folder', path: 'Formation/Archives 2025', group: null, q: '', type: 'all', sel: null });
  assert.deepEqual([...found.open], ['Formation', 'Formation/Archives 2025']);
});

test('applyPlace : une autre vue se pose sans toucher au dossier où l\'on était ; une vue inconnue est la racine', () => {
  const found = state({ path: 'Stock' });
  applyPlace(found, { view: 'fav', path: '' });
  assert.deepEqual({ view: found.view, path: found.path }, { view: 'fav', path: 'Stock' });
  applyPlace(found, { view: 'opened', path: 'Stock' });
  assert.deepEqual({ view: found.view, path: found.path }, { view: 'folder', path: '' }, '« Ouverts » : la racine');
  applyPlace(found, { view: '__proto__', path: 42 });
  assert.deepEqual({ view: found.view, path: found.path }, { view: 'folder', path: '' });
});
