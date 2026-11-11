// L'outil des bibliothèques d'extensions (outils/bibliotheques.mjs) : liste en versions exactes, empreintes, cohérence des fichiers commités.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { integrity, readList, readPublication, githubAddress, buildEntry, checkFiles, checkCdn, generate, archiveName, verify, ROOT } from '../outils/bibliotheques.mjs';

import { EXACT_VERSION_RE as KIT_EXACT_VERSION_RE, integrity as kitIntegrity } from '../kit/outils/bibliotheques/primitives.mjs';
import { EXACT_VERSION_RE } from '../js/manifest.js';

const pkg = extra => ({ dependencies: { 'plotly.js-basic-dist-min': '2.13.2' }, gfs: { bibliotheques: { plotly: { paquet: 'plotly.js-basic-dist-min', fichier: 'plotly-basic.min.js' } } }, ...extra });
const BYTES = Buffer.from('console.log("exemple")');
const LICENCES = Buffer.from('plotly.js-basic-dist-min@2.13.2 · MIT');
// Ce que lit l'outil : les octets de la copie, et le LICENCES.txt posé à côté d'elle.
const reading = bytes => path => (path.endsWith('LICENCES.txt') ? LICENCES : bytes);

test('integrity : sha384 en base 64, comme l\'attribut integrity', () => {
  assert.equal(integrity(Buffer.from('abc')), 'sha384-ywB1P0WjXou1oD1pmsZQBycsMqsO3tFjGotgWkP/W+2AhgcroefMI1i67KE0yCWn');
});

test('l\'outil de GFS reprend les primitives du kit (l\'empreinte, le fichier d\'un paquet, la comparaison au CDN) et n\'en redéfinit aucune ; la version exacte du manifeste est celle du kit', () => {
  assert.equal(integrity, kitIntegrity);
  assert.doesNotMatch(readFileSync(join(ROOT, 'outils/bibliotheques.mjs'), 'utf8'), /createHash|function archiveOf|function packBytes|function headerProblems/);
  assert.equal(EXACT_VERSION_RE.source, KIT_EXACT_VERSION_RE.source, 'deux écritures de la même règle (le manifeste de GFS, l\'outil du kit) : elles ne divergent pas');
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
  assert.deepEqual(checkFiles(catalogue, list, reading(BYTES)), []);
  assert.match(checkFiles(catalogue, list, reading(Buffer.from('abîmé')))[0], /ne correspond pas/);
  assert.match(checkFiles({ bibliotheques: [{ ...entry, poids: 1 }] }, list, reading(BYTES)).join('|'), /poids/);
  assert.match(checkFiles({ bibliotheques: [{ ...entry, cdn: { ...entry.cdn, integrite: integrity(Buffer.from('autre')) } }] }, list, reading(BYTES)).join('|'), /même empreinte/);
  assert.match(checkFiles({ bibliotheques: [] }, list, reading(BYTES))[0], /absent du catalogue/);
  assert.match(checkFiles({ bibliotheques: [entry, { ...entry, id: 'marked', version: '1.0.0' }] }, list, reading(BYTES))[0], /plus dans la liste/);
  assert.match(checkFiles(catalogue, list, () => { throw new Error('absent'); })[0], /illisible/);
});

test('checkFiles : une copie vendorisée sans sa licence, ou avec celle d\'un autre paquet, est signalée', () => {
  const list = readList(pkg());
  const catalogue = { bibliotheques: [buildEntry(list[0], BYTES)] };
  const missing = path => { if (path.endsWith('LICENCES.txt')) throw new Error('absent'); return BYTES; };
  assert.match(checkFiles(catalogue, list, missing).join('|'), /licences illisibles \(vendor\/plotly\/2\.13\.2\/LICENCES\.txt\)/);
  const other = path => (path.endsWith('LICENCES.txt') ? Buffer.from('echarts@6.1.0 · Apache-2.0') : BYTES);
  assert.match(checkFiles(catalogue, list, other).join('|'), /ne porte pas la licence de plotly\.js-basic-dist-min@2\.13\.2/);
});

// Une archive de paquet comme `npm pack` la fait : un dossier `package/` (le fichier à servir, le package.json, et les fichiers de licence donnés).
function packArchive(dir, files) {
  const staging = join(dir, 'staging');
  rmSync(staging, { recursive: true, force: true });
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(staging, 'package', name, '..'), { recursive: true });
    writeFileSync(join(staging, 'package', name), text);
  }
  mkdirSync(join(dir, 'paquets'), { recursive: true });
  execFileSync('tar', ['-czf', join(dir, 'paquets', archiveName('echarts', '6.1.0')), '-C', staging, 'package']);
}

test('generate : la copie d\'un paquet Apache 2.0 porte son LICENCES.txt avec la licence et le NOTICE ; sans licence dans le paquet, l\'outil refuse', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'gfs-bibliotheques-test-'));
  try {
    const root = join(dir, 'prototype');
    mkdirSync(join(root, 'bibliotheques'), { recursive: true });
    writeFileSync(join(root, 'bibliotheques/package.json'), JSON.stringify({ dependencies: { echarts: '6.1.0' }, gfs: { bibliotheques: { echarts: { paquet: 'echarts', fichier: 'dist/echarts.min.js' } } } }));
    const base = { 'dist/echarts.min.js': '/* ASF */ var echarts = {};', 'package.json': JSON.stringify({ name: 'echarts', version: '6.1.0', license: 'Apache-2.0' }) };

    packArchive(dir, { ...base, LICENSE: 'Apache License\nVersion 2.0, January 2004', NOTICE: 'Apache ECharts\nCopyright 2017-2026 The Apache Software Foundation' });
    await generate(root, join(dir, 'paquets'), () => {});
    const licences = readFileSync(join(root, 'vendor/echarts/6.1.0/LICENCES.txt'), 'utf8');
    assert.match(licences, /echarts@6\.1\.0 · Apache-2\.0/);
    assert.match(licences, /Apache License\nVersion 2\.0/);
    assert.match(licences, /NOTICE\n\nApache ECharts\nCopyright 2017-2026 The Apache Software Foundation/, 'la licence Apache 2.0 veut le NOTICE avec la copie');
    assert.deepEqual(verify(root).problems, []);

    packArchive(dir, base);
    await assert.rejects(generate(root, join(dir, 'paquets'), () => {}), /pas de fichier de licence dans le paquet/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('checkCdn : le CDN sert le même fichier, un autre, ou ne répond pas', async () => {
  const entry = buildEntry(readList(pkg())[0], BYTES);
  const catalogue = { bibliotheques: [entry] };
  assert.deepEqual(await checkCdn(catalogue, async () => BYTES), []);
  assert.match((await checkCdn(catalogue, async () => Buffer.from('autre')))[0], /le CDN sert un fichier/);
  assert.match((await checkCdn(catalogue, async () => { throw new Error('HTTP 503'); }))[0], /n'a pas répondu \(HTTP 503\)/);
});

test('les fichiers commités (liste, catalogue, copie vendorisée, commit épinglé) sont cohérents', () => {
  assert.deepEqual(verify(ROOT).problems, []);
});

test('la liste de GFS épingle un commit complet de son dépôt public, et le CDN du fichier assemblé est l\'adresse jsDelivr de ce commit', () => {
  const packageJson = JSON.parse(readFileSync(join(ROOT, 'bibliotheques/package.json'), 'utf8'));
  const publication = readPublication(packageJson);
  assert.match(publication.commit, /^[0-9a-f]{40}$/, 'jamais une branche ni une étiquette : elles bougent sous l\'empreinte');
  assert.equal(publication.racine, 'prototype/', 'GFS est le dossier prototype/ de son dépôt');
  const catalogue = JSON.parse(readFileSync(join(ROOT, 'bibliotheques/catalogue.json'), 'utf8'));
  const live = catalogue.bibliotheques.find(entry => entry.id === 'edition-live');
  assert.equal(live.cdn.src, githubAddress(publication, live.vendorise.chemin));
  assert.equal(live.cdn.integrite, live.vendorise.integrite);
  assert.equal(catalogue.bibliotheques.find(entry => entry.id === 'plotly').cdn.src.includes('/gh/'), false, 'Plotly reste servi depuis npm, octet pour octet');
});
