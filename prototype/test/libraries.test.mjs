// Le catalogue des bibliothèques d'extensions (contrats 2.6) : lecture et validation, résolution CDN ou vendorisée, lien avec les manifestes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { readCatalogue, resolveLibraries, forContext, lookup, CDN_HOSTS } from '../js/libraries.js';

const SRI = `sha384-${'A'.repeat(64)}`;
const entry = (extra = {}) => ({
  id: 'plotly', version: '2.13.2', poids: 10,
  cdn: { src: 'https://cdn.jsdelivr.net/npm/plotly.js-basic-dist-min@2.13.2/plotly-basic.min.js', integrite: SRI },
  vendorise: { chemin: 'vendor/plotly/2.13.2/plotly-basic.min.js', integrite: SRI },
  ...extra,
});
const read = list => readCatalogue({ contrat: 0, bibliotheques: list });
const BASE = 'https://exemple.github.io/grist-widget-GFS/prototype/index.html?access=full';

test('le catalogue livré est valide et dit exactement ce que l\'outil a écrit', () => {
  const doc = JSON.parse(readFileSync(new URL('../bibliotheques/catalogue.json', import.meta.url), 'utf8'));
  const catalogue = readCatalogue(doc);
  assert.deepEqual(catalogue.errors, []);
  assert.ok(lookup(catalogue, 'plotly', '2.13.2'));
});

test('readCatalogue : une entrée valide entre, les autres sont écartées avec leur raison', () => {
  const bad = [
    entry({ version: '^2.13.2' }),
    entry({ version: '2.13.3', cdn: { src: 'http://cdn.jsdelivr.net/x.js', integrite: SRI } }),
    entry({ version: '2.13.4', cdn: { src: 'https://evil.example/x.js', integrite: SRI } }),
    entry({ version: '2.13.5', cdn: { src: 'https://cdn.jsdelivr.net/x.js?a=1', integrite: SRI } }),
    entry({ version: '2.13.6', cdn: { src: 'https://cdn.jsdelivr.net/x.js', integrite: 'sha256-abc' } }),
    entry({ version: '2.13.7', vendorise: { chemin: '../dehors.js', integrite: SRI } }),
    entry({ version: '2.13.8', vendorise: { chemin: 'vendor/_cache/x.js', integrite: SRI } }),
    entry({ id: 'Plotly', version: '2.14.0' }),
    entry({ version: '2.14.1', poids: -1 }),
    null,
  ];
  const { entries, errors } = read([entry(), ...bad]);
  assert.deepEqual([...entries.keys()], ['plotly@2.13.2']);
  assert.equal(errors.length, bad.length);
  assert.match(errors.join('\n'), /evil\.example n'est pas un CDN de GFS/);
});

test('readCatalogue : le même id et la même version deux fois, ou un document sans liste, sont refusés', () => {
  assert.match(read([entry(), entry()]).errors[0], /déjà au catalogue/);
  assert.equal(readCatalogue({}).entries.size, 0);
  assert.equal(readCatalogue(null).errors.length, 1);
  assert.deepEqual(CDN_HOSTS, ['cdn.jsdelivr.net'], 'chaque hôte ajouté l\'est consciemment : ce test le rappelle');
});

test('resolveLibraries : CDN par défaut, copie vendorisée servie à côté de GFS, version absente signalée', () => {
  const catalogue = read([entry()]);
  const need = [{ id: 'plotly', version: '2.13.2' }];
  const cdn = resolveLibraries(catalogue, need, () => 'cdn', BASE);
  assert.equal(cdn.libraries.plotly.src, entry().cdn.src);
  assert.equal(cdn.libraries.plotly.mode, 'cdn');
  assert.equal(cdn.libraries.plotly.poids, 10);
  const local = resolveLibraries(catalogue, need, () => 'vendorise', BASE);
  assert.equal(local.libraries.plotly.src, 'https://exemple.github.io/grist-widget-GFS/prototype/vendor/plotly/2.13.2/plotly-basic.min.js');
  assert.equal(local.libraries.plotly.integrite, SRI);
  const unknownMode = resolveLibraries(catalogue, need, () => 'autre', BASE);
  assert.equal(unknownMode.libraries.plotly.mode, 'cdn', 'un mode inconnu retombe sur le CDN');
  const none = resolveLibraries(catalogue, [{ id: 'plotly', version: '2.13.3' }, { id: 'marked', version: '1.0.0' }], () => 'cdn', BASE);
  assert.deepEqual(none.missing, [{ id: 'plotly', version: '2.13.3' }, { id: 'marked', version: '1.0.0' }]);
  assert.deepEqual(none.libraries, {});
});

test('forContext : l\'adresse et l\'empreinte, rien d\'autre', () => {
  const { libraries } = resolveLibraries(read([entry()]), [{ id: 'plotly', version: '2.13.2' }], () => 'cdn', BASE);
  assert.deepEqual(forContext(libraries), { plotly: { src: entry().cdn.src, integrite: SRI } });
});

test('chaque bibliothèque qu\'une extension des manifestes livrés exige est au catalogue, en version exacte', () => {
  const catalogue = readCatalogue(JSON.parse(readFileSync(new URL('../bibliotheques/catalogue.json', import.meta.url), 'utf8')));
  const dir = new URL('../manifestes/', import.meta.url);
  for (const file of readdirSync(dir).filter(name => name.endsWith('.json'))) {
    const manifest = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
    for (const ext of manifest.extensions || []) {
      for (const { id, version } of ext.bibliotheques || []) assert.ok(lookup(catalogue, id, version), `${file} : ${ext.id} exige ${id}@${version}, absent du catalogue`);
    }
  }
});
