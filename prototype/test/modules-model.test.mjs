// Ce que la fenêtre « Apps et extensions » montre : lignes, grisé, compte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modulesModel } from '../js/modules-model.js';
import { readCatalogue } from '../js/libraries.js';
import { publipostage, automation } from './helpers.mjs';

const SRI = `sha384-${'C'.repeat(64)}`;
const catalogue = readCatalogue({ bibliotheques: [{
  id: 'plotly', version: '2.13.2', poids: 1000,
  cdn: { src: 'https://cdn.jsdelivr.net/npm/plotly.js-basic-dist-min@2.13.2/plotly-basic.min.js', integrite: SRI },
  vendorise: { chemin: 'vendor/plotly/2.13.2/plotly-basic.min.js', integrite: SRI },
}] });
const loaded = (bad = false) => [
  { app: { id: 'publipostage' }, manifest: publipostage(), ok: true, errors: [] },
  { app: { id: 'automation' }, manifest: bad ? null : automation(), ok: !bad, errors: bad ? ['manifeste illisible : 404'] : [] },
];

test('une app, ses extensions juste après, le compte des actifs et du total', () => {
  const model = modulesModel(loaded(), { apps: { publipostage: { extensions: ['graphique'], modes: {} } } }, catalogue, ['publipostage']);
  assert.deepEqual(model.items.map(item => `${item.kind}:${item.id || item.extension.id}`), ['app:publipostage', 'ext:graphique', 'ext:edition', 'ext:diapositives', 'app:automation']);
  assert.equal(model.items[0].always, true);
  assert.equal(model.items[2].greyed, true, 'l\'édition collaborative exige edition-live, que ce catalogue d\'essai n\'a pas');
  assert.equal(model.items[3].greyed, false, 'les diapositives n\'exigent aucune bibliothèque : le catalogue ne peut pas les griser');
  assert.deepEqual(model.items[3].libraries, [], 'et il n\'y a rien à charger, donc pas de choix CDN ou copie de GFS');
  assert.equal(model.items[4].installed, false);
  assert.equal(model.total, 5);
  assert.equal(model.active, 2, 'Publipostage+ et son graphique');
});

test('les diapositives, sans bibliothèque, se cochent comme les autres : active dès que l\'app est installée', () => {
  const model = modulesModel(loaded(), { apps: { publipostage: { extensions: ['graphique', 'diapositives'], modes: {} } } }, catalogue, ['publipostage']);
  const slides = model.items.find(item => item.kind === 'ext' && item.extension.id === 'diapositives');
  assert.equal(slides.checked, true);
  assert.equal(slides.greyed, false);
  assert.equal(model.active, 3, 'Publipostage+, son graphique et ses diapositives');
  const apart = modulesModel(loaded(), { apps: {} }, catalogue, []);
  assert.equal(apart.active, 0, 'sans l\'app installée, une extension n\'est pas active');
});

test('une extension d\'une app non installée n\'est pas comptée active ; une bibliothèque absente la grise', () => {
  const none = modulesModel(loaded(), { apps: {} }, catalogue, []);
  assert.equal(none.active, 0);
  const grey = modulesModel(loaded(), { apps: { publipostage: { extensions: ['graphique'], modes: {} } } }, readCatalogue({ bibliotheques: [] }), ['publipostage']);
  assert.equal(grey.items[1].greyed, true);
  assert.equal(grey.active, 1, 'seule l\'app compte');
});

test('une app au manifeste invalide reste dans la liste, grisée avec son motif, et ne compte pas', () => {
  const model = modulesModel(loaded(true), { apps: { publipostage: { extensions: [], modes: {} } } }, catalogue, ['publipostage']);
  const broken = model.items.find(item => item.id === 'automation');
  assert.equal(broken.ok, false);
  assert.deepEqual(broken.errors, ['manifeste illisible : 404']);
  assert.equal(model.total, 4, 'l\'app et ses trois extensions ; l\'invalide ne compte pas');
});
