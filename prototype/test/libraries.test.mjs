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

test('forContext : l\'adresse, l\'empreinte et la forme, rien d\'autre', () => {
  const { libraries } = resolveLibraries(read([entry()]), [{ id: 'plotly', version: '2.13.2' }], () => 'cdn', BASE);
  assert.deepEqual(forContext(libraries), { plotly: { src: entry().cdn.src, integrite: SRI, forme: 'script' } });
});

// Un fichier assemblé par GFS (2.6, points 8 à 11) : forme module, ce qu'il contient et range ; son CDN est l'adresse jsDelivr du dépôt public de GFS à un
// commit épinglé, ou aucun (`cdn: null`) quand GFS n'a pas d'adresse publique.
const assembled = (extra = {}) => ({
  id: 'edition-live', version: '1.0.0', forme: 'module', poids: 145862,
  contient: [{ paquet: 'yjs', version: '13.6.33' }, { paquet: 'lib0', version: '0.2.119' }], modules: ['yjs'], externes: ['prosemirror-state'],
  cdn: null, vendorise: { chemin: 'vendor/edition-live/1.0.0/edition-live.js', integrite: SRI },
  ...extra,
});

test('readCatalogue : un fichier assemblé sans CDN entre ; une forme inconnue, un module sans contenu ou un CDN absent sont écartés', () => {
  const bad = [
    assembled({ version: '1.0.1', forme: 'bundle' }),
    assembled({ version: '1.0.2', contient: undefined }),
    assembled({ version: '1.0.3', contient: [{ paquet: 'yjs', version: '^13' }] }),
    assembled({ version: '1.0.4', modules: [] }),
    assembled({ version: '1.0.5', externes: 'prosemirror-state' }),
    assembled({ version: '1.0.6', cdn: undefined }),
    assembled({ version: '1.0.7', cdn: { src: 'https://evil.example/x.js', integrite: SRI } }),
  ];
  const { entries, errors } = read([assembled(), ...bad]);
  assert.deepEqual([...entries.keys()], ['edition-live@1.0.0']);
  assert.equal(errors.length, bad.length);
  assert.match(errors.join('\n'), /forme : script ou module attendu/);
  assert.match(errors.join('\n'), /contient : liste de \{ paquet, version exacte \} attendue/);
  assert.match(errors.join('\n'), /evil\.example n'est pas un CDN de GFS/);
  assert.equal(read([entry({ cdn: null })]).entries.size, 1, 'sans adresse publique de GFS, un script classique peut aussi ne pas avoir de CDN');
});

test('resolveLibraries : sans CDN, la copie de GFS sert quel que soit le mode demandé, et la forme suit', () => {
  const catalogue = read([assembled(), entry()]);
  const need = [{ id: 'edition-live', version: '1.0.0' }, { id: 'plotly', version: '2.13.2' }];
  const asked = resolveLibraries(catalogue, need, () => 'cdn', BASE);
  assert.equal(asked.libraries['edition-live'].mode, 'vendorise');
  assert.equal(asked.libraries['edition-live'].forme, 'module');
  assert.equal(asked.libraries['edition-live'].src, 'https://exemple.github.io/grist-widget-GFS/prototype/vendor/edition-live/1.0.0/edition-live.js');
  assert.equal(asked.libraries.plotly.mode, 'cdn', 'les autres bibliothèques gardent leur mode');
  assert.equal(asked.libraries.plotly.forme, 'script');
  assert.deepEqual(forContext(asked.libraries)['edition-live'], { src: asked.libraries['edition-live'].src, integrite: SRI, forme: 'module' });
});

const COMMIT = 'cc8707c2ff18a32fd8f43a92a3e1a3026579f713';
const github = (ref = COMMIT, path = 'prototype/vendor/edition-live/1.0.0/edition-live.js', repo = 'lombre33/grist-widget-GFS') => `https://cdn.jsdelivr.net/gh/${repo}@${ref}/${path}`;

test('readCatalogue : une adresse jsDelivr du dépôt de GFS nomme un commit complet, jamais une branche, une étiquette ni un commit abrégé', () => {
  const at = (version, src) => assembled({ version, cdn: { src, integrite: SRI } });
  const bad = [
    at('1.0.1', github('main')),
    at('1.0.2', github('v1.0.0')),
    at('1.0.3', github('cc8707c')),
    at('1.0.4', github('cc8707c2ff18a32fd8f43a92a3e1a3026579f71')),
    at('1.0.5', github('CC8707C2FF18A32FD8F43A92A3E1A3026579F713')),
    at('1.0.6', 'https://cdn.jsdelivr.net/gh/lombre33/grist-widget-GFS/prototype/vendor/edition-live/1.0.0/edition-live.js'),
    at('1.0.7', `https://cdn.jsdelivr.net/gh/lombre33@${COMMIT}/x.js`),
    at('1.0.8', `https://cdn.jsdelivr.net/gh/lombre33/grist-widget-GFS@${COMMIT}`),
    at('1.0.9', `https://cdn.jsdelivr.net/gh/lombre33/grist-widget-GFS@${COMMIT}/`),
  ];
  const { entries, errors } = read([at('1.0.0', github()), ...bad]);
  assert.deepEqual([...entries.keys()], ['edition-live@1.0.0']);
  assert.equal(errors.length, bad.length);
  assert.match(errors.join('\n'), /une adresse \/gh\/ nomme le dépôt et un commit complet \(40 chiffres hexadécimaux\), jamais une branche ni une étiquette/);
  assert.equal(read([at('1.0.0', 'https://cdn.jsdelivr.net/npm/yjs@13.6.33/dist/yjs.mjs')]).entries.size, 1, 'une adresse /npm/ garde sa règle : le paquet et la version sont dans l\'adresse que l\'outil écrit');
  assert.match(read([at('1.0.0', github(COMMIT, 'x.js').replace('cdn.jsdelivr.net', 'raw.githubusercontent.com'))]).errors[0], /raw\.githubusercontent\.com n'est pas un CDN de GFS/, 'seul jsDelivr sert GFS');
});

test('resolveLibraries : un fichier assemblé avec son CDN se sert par jsDelivr (le défaut) ou par la copie de GFS, de la même empreinte, sous la même forme', () => {
  const catalogue = read([assembled({ cdn: { src: github(), integrite: SRI } })]);
  const need = [{ id: 'edition-live', version: '1.0.0' }];
  const cdn = resolveLibraries(catalogue, need, () => 'cdn', BASE);
  assert.equal(cdn.libraries['edition-live'].mode, 'cdn');
  assert.equal(cdn.libraries['edition-live'].src, github());
  assert.equal(cdn.libraries['edition-live'].forme, 'module');
  assert.deepEqual(forContext(cdn.libraries)['edition-live'], { src: github(), integrite: SRI, forme: 'module' });
  const copy = resolveLibraries(catalogue, need, () => 'vendorise', BASE);
  assert.equal(copy.libraries['edition-live'].mode, 'vendorise');
  assert.equal(copy.libraries['edition-live'].src, 'https://exemple.github.io/grist-widget-GFS/prototype/vendor/edition-live/1.0.0/edition-live.js');
  assert.equal(copy.libraries['edition-live'].integrite, SRI);
  assert.equal(resolveLibraries(catalogue, need, () => undefined, BASE).libraries['edition-live'].mode, 'cdn', 'le CDN est le défaut');
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
