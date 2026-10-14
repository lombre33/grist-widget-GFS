// L'outil des bibliothèques d'extensions (outils/bibliotheques.mjs) : liste en versions exactes, empreintes, cohérence des fichiers commités.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { integrity, readList, buildEntry, checkFiles, checkCdn, ROOT } from '../outils/bibliotheques.mjs';

const pkg = extra => ({ dependencies: { 'plotly.js-basic-dist-min': '2.13.2' }, gfs: { bibliotheques: { plotly: { paquet: 'plotly.js-basic-dist-min', fichier: 'plotly-basic.min.js' } } }, ...extra });
const BYTES = Buffer.from('console.log("exemple")');

test('integrity : sha384 en base 64, comme l\'attribut integrity', () => {
  assert.equal(integrity(Buffer.from('abc')), 'sha384-ywB1P0WjXou1oD1pmsZQBycsMqsO3tFjGotgWkP/W+2AhgcroefMI1i67KE0yCWn');
});

test('readList : une version exacte par bibliothèque, jamais un intervalle ni latest', () => {
  assert.deepEqual(readList(pkg()), [{ id: 'plotly', paquet: 'plotly.js-basic-dist-min', version: '2.13.2', fichier: 'plotly-basic.min.js' }]);
  for (const version of ['^2.13.2', '~2.13', 'latest', '2.x', '']) {
    assert.throws(() => readList(pkg({ dependencies: { 'plotly.js-basic-dist-min': version } })), /doit être exacte/, version);
  }
  const outside = pkg();
  outside.gfs.bibliotheques.plotly.fichier = '../../x.js';
  assert.throws(() => readList(outside), /hors du paquet/);
});

test('buildEntry : le CDN et la copie vendorisée portent la même empreinte, le poids est celui des octets', () => {
  const entry = buildEntry({ id: 'plotly', paquet: 'plotly.js-basic-dist-min', version: '2.13.2', fichier: 'plotly-basic.min.js' }, BYTES);
  assert.equal(entry.cdn.src, 'https://cdn.jsdelivr.net/npm/plotly.js-basic-dist-min@2.13.2/plotly-basic.min.js');
  assert.equal(entry.vendorise.chemin, 'vendor/plotly/2.13.2/plotly-basic.min.js');
  assert.equal(entry.cdn.integrite, entry.vendorise.integrite);
  assert.equal(entry.poids, BYTES.length);
});

test('checkFiles : un fichier abîmé, un poids faux, une empreinte qui diffère, une entrée en trop sont signalés', () => {
  const list = readList(pkg());
  const entry = buildEntry(list[0], BYTES);
  const catalogue = { bibliotheques: [entry] };
  assert.deepEqual(checkFiles(catalogue, list, () => BYTES), []);
  assert.match(checkFiles(catalogue, list, () => Buffer.from('abîmé'))[0], /ne correspond pas/);
  assert.match(checkFiles({ bibliotheques: [{ ...entry, poids: 1 }] }, list, () => BYTES).join('|'), /poids/);
  assert.match(checkFiles({ bibliotheques: [{ ...entry, cdn: { ...entry.cdn, integrite: integrity(Buffer.from('autre')) } }] }, list, () => BYTES).join('|'), /même empreinte/);
  assert.match(checkFiles({ bibliotheques: [] }, list, () => BYTES)[0], /absent du catalogue/);
  assert.match(checkFiles({ bibliotheques: [entry, { ...entry, id: 'marked', version: '1.0.0' }] }, list, () => BYTES)[0], /plus dans la liste/);
  assert.match(checkFiles(catalogue, list, () => { throw new Error('absent'); })[0], /illisible/);
});

test('checkCdn : le CDN sert le même fichier, un autre, ou ne répond pas', async () => {
  const entry = buildEntry(readList(pkg())[0], BYTES);
  const catalogue = { bibliotheques: [entry] };
  assert.deepEqual(await checkCdn(catalogue, async () => BYTES), []);
  assert.match((await checkCdn(catalogue, async () => Buffer.from('autre')))[0], /le CDN sert un fichier/);
  assert.match((await checkCdn(catalogue, async () => { throw new Error('HTTP 503'); }))[0], /n'a pas répondu \(HTTP 503\)/);
});

test('les fichiers commités (liste, catalogue, copie vendorisée) sont cohérents', () => {
  const list = readList(JSON.parse(readFileSync(join(ROOT, 'bibliotheques/package.json'), 'utf8')));
  const catalogue = JSON.parse(readFileSync(join(ROOT, 'bibliotheques/catalogue.json'), 'utf8'));
  assert.deepEqual(checkFiles(catalogue, list, path => readFileSync(join(ROOT, path))), []);
});
