// Le relevé des dépendances (outils/releve-dependances.mjs) : dernière stable sans préversion, écart, avis de sécurité au nom du paquet source, fichier commité.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  latestStable, gap, fixedIn, toAdvisories, repositoryLink, packagesOfList, survey, checkReleve, readPackageJson, registryNet,
  PAQUET_DES_AVIS, RELEVE_FILE,
} from '../outils/releve-dependances.mjs';
import { ROOT } from '../outils/bibliotheques.mjs';

test('latestStable : jamais une préversion ni une version de développement (le « latest » de DuckDB-WASM en est une), ni une version retirée', () => {
  assert.equal(latestStable({ '1.32.0': {}, '1.33.0': {}, '1.33.1-dev57.0': {}, '2.0.0-rc.1': {} }), '1.33.0');
  assert.equal(latestStable({ '1.0.0': {}, '1.0.1': { deprecated: 'retirée' } }), '1.0.0');
  assert.equal(latestStable({ '2.9.0': {}, '10.0.0': {}, '10.1.0': {} }), '10.1.0', 'les numéros se comparent comme des nombres, pas comme du texte');
  assert.equal(latestStable({ '1.0.0-beta': {} }), null);
  assert.equal(latestStable(undefined), null);
});

test('gap : correctif, mineure, majeure ; en 0.x une version mineure change l\'interface et compte pour une majeure', () => {
  assert.equal(gap('6.1.0', '6.1.0'), 'a-jour');
  assert.equal(gap('9.15.1', '9.15.4'), 'correctif');
  assert.equal(gap('3.31.3', '3.34.0'), 'mineure');
  assert.equal(gap('2.13.2', '4.3.0'), 'majeure');
  assert.equal(gap('0.2.7', '0.3.14'), 'majeure');
  assert.equal(gap('0.2.119', '0.2.120'), 'correctif');
  assert.equal(gap('7.0.0', '6.9.9'), 'avance');
  assert.equal(gap('1.0.0', null), 'inconnu');
  assert.equal(gap('x', '1.0.0'), 'inconnu');
});

test('fixedIn : la borne haute exclue de la plage touchée', () => {
  assert.equal(fixedIn('<6.1.0'), '6.1.0');
  assert.equal(fixedIn('>=1.0.0 <2.25.2'), '2.25.2');
  assert.equal(fixedIn('>=3.0.0'), null);
  assert.equal(fixedIn(''), null);
});

test('toAdvisories : les plus graves d\'abord, l\'identifiant lu dans l\'adresse, un avis par adresse', () => {
  const rows = toAdvisories([
    { url: 'https://github.com/advisories/GHSA-bbbb-2222-cccc', severity: 'moderate', title: 'XSS', vulnerable_versions: '<6.1.0', cvss: { score: 6.1 } },
    { url: 'https://github.com/advisories/GHSA-aaaa-1111-bbbb', severity: 'critical', title: 'Pollution', vulnerable_versions: '<2.25.2', cvss: { score: 9.8 } },
    { url: 'https://github.com/advisories/GHSA-aaaa-1111-bbbb', severity: 'critical', title: 'Pollution', vulnerable_versions: '<2.25.2', cvss: { score: 9.8 } },
  ]);
  assert.deepEqual(rows.map(row => row.id), ['GHSA-aaaa-1111-bbbb', 'GHSA-bbbb-2222-cccc']);
  assert.deepEqual(rows[0], { id: 'GHSA-aaaa-1111-bbbb', niveau: 'critical', titre: 'Pollution', url: 'https://github.com/advisories/GHSA-aaaa-1111-bbbb',
    touche: '<2.25.2', corrigeEn: '2.25.2', cvss: 9.8 });
  assert.deepEqual(toAdvisories(undefined), []);
});

test('repositoryLink : une adresse https lisible', () => {
  assert.equal(repositoryLink({ url: 'git+https://github.com/apache/echarts.git' }), 'https://github.com/apache/echarts');
  assert.equal(repositoryLink('git://github.com/Leaflet/Leaflet.git'), 'https://github.com/Leaflet/Leaflet');
  assert.equal(repositoryLink({ url: 'ssh://git@github.com/o/x.git' }), 'https://github.com/o/x');
  assert.equal(repositoryLink('github:o/x'), 'https://github.com/o/x');
  assert.equal(repositoryLink({ url: 'file:///etc/passwd' }), null);
  assert.equal(repositoryLink(undefined), null);
});

const LIST = {
  dependencies: { 'plotly.js-basic-dist-min': '2.13.2', docx: '9.15.1' },
  gfs: { bibliotheques: {
    plotly: { paquet: 'plotly.js-basic-dist-min', fichier: 'plotly-basic.min.js' },
    docx: { paquet: 'docx', fichier: 'dist/index.iife.js' },
    'docx-charts': { paquet: 'docx', fichier: 'dist/charts.iife.js' },
  } },
};

// Un faux registre : ce que `registryNet` demande, répondu par des tables. Il garde chaque appel pour les essais.
function fakeNet({ latest = { 'plotly.js-basic-dist-min': '4.3.0', docx: '9.15.4' }, advisories = {} } = {}) {
  const calls = [];
  return {
    calls,
    getJson: async path => {
      calls.push(['GET', path]);
      const [, name, version] = /^\/((?:@[^/]+\/)?[^/]+)(?:\/(.+))?$/.exec(path);
      if (version) return { license: 'MIT', homepage: `https://exemple.test/${name}`, repository: { url: `git+https://github.com/o/${name}.git` } };
      return { versions: { [latest[name]]: {}, [`${latest[name]}-dev1.0`]: {} } };
    },
    postJson: async (path, body) => {
      calls.push(['POST', path, body]);
      return Object.fromEntries(Object.keys(body).filter(name => advisories[name]).map(name => [name, advisories[name]]));
    },
  };
}

test('packagesOfList : un paquet servi par deux bibliothèques n\'est relevé qu\'une fois', () => {
  const packages = packagesOfList(LIST);
  assert.deepEqual([...packages.keys()].sort(), ['docx', 'plotly.js-basic-dist-min']);
  assert.deepEqual(packages.get('docx'), { version: '9.15.1', ids: ['docx', 'docx-charts'] });
});

test('survey : les avis sont demandés au nom du paquet SOURCE (plotly.js), sinon le registre répond « aucun avis » ; la version demandée est celle que GFS sert', async () => {
  const plotlyAdvisory = { url: 'https://github.com/advisories/GHSA-wjc4-73q6-gv3m', severity: 'critical', title: 'plotly.js prototype pollution',
    vulnerable_versions: '<2.25.2', cvss: { score: 9.8 } };
  const net = fakeNet({ advisories: { 'plotly.js': [plotlyAdvisory] } });
  const releve = await survey(LIST, net, '2026-11-18T10:00:00.000Z');
  const bulk = net.calls.filter(call => call[0] === 'POST');
  assert.equal(bulk.length, 2, 'une demande d\'avis par paquet');
  const forPlotly = bulk.find(call => 'plotly.js' in call[2]);
  assert.deepEqual(forPlotly[2], { 'plotly.js': ['2.13.2'], 'plotly.js-basic-dist-min': ['2.13.2'] });
  const plotly = releve.paquets['plotly.js-basic-dist-min'];
  assert.equal(plotly.paquetAvis, 'plotly.js');
  assert.equal(plotly.avis.length, 1);
  assert.equal(plotly.avis[0].corrigeEn, '2.25.2');
  assert.equal(plotly.derniere, '4.3.0', 'la version de développement n\'est pas la dernière stable');
  assert.equal(plotly.ecart, 'majeure');
  assert.equal(plotly.licence, 'MIT');
  assert.equal(plotly.depot, 'https://github.com/o/plotly.js-basic-dist-min');
  assert.deepEqual(releve.paquets.docx.avis, []);
  assert.equal(releve.paquets.docx.paquetAvis, undefined);
  assert.deepEqual(releve.bibliotheques, { plotly: ['plotly.js-basic-dist-min'], docx: ['docx'], 'docx-charts': ['docx'] });
  assert.equal(releve.releve, '2026-11-18T10:00:00.000Z');
  assert.equal(releve.source, 'registry.npmjs.org');
});

test('survey : un paquet à portée (@tiptap/…) est demandé avec son « / » codé', async () => {
  const list = { dependencies: { '@tiptap/y-tiptap': '3.0.10' }, gfs: { bibliotheques: { x: { paquet: '@tiptap/y-tiptap', fichier: 'dist/x.js' } } } };
  const net = fakeNet({ latest: { '@tiptap/y-tiptap': '3.3.0' } });
  await survey(list, net);
  assert.ok(net.calls.some(call => call[0] === 'GET' && call[1] === '/@tiptap%2Fy-tiptap'), net.calls.map(call => call[1]).join(' '));
});

test('registryNet : une réponse en erreur lève avec le chemin et le code', async () => {
  const net = registryNet(async () => ({ ok: false, status: 503, json: async () => ({}) }));
  await assert.rejects(() => net.getJson('/echarts'), /\/echarts : 503/);
});

test('checkReleve : le fichier couvre la liste ; une absence, un « -dist-min » sans paquet d\'avis et une forme fausse sont des erreurs, une version différente un avertissement', async () => {
  const releve = await survey(LIST, fakeNet());
  assert.deepEqual(checkReleve(releve, LIST), []);

  const missing = structuredClone(releve);
  delete missing.paquets.docx;
  assert.match(checkReleve(missing, LIST).join('\n'), /docx : absent du relevé/);

  const drift = structuredClone(releve);
  drift.paquets.docx.version = '9.15.0';
  const drifted = checkReleve(drift, LIST);
  assert.equal(drifted.length, 1);
  assert.match(drifted[0], /^AVERTISSEMENT docx/);

  const unlinked = structuredClone(releve);
  unlinked.bibliotheques.docx = [];
  assert.match(checkReleve(unlinked, LIST).join('\n'), /docx : le relevé ne la relie pas à docx/);

  const preview = structuredClone(releve);
  preview.paquets.docx.derniere = '9.16.0-beta.1';
  assert.match(checkReleve(preview, LIST).join('\n'), /pas une version stable/);

  assert.match(checkReleve({}, LIST)[0], /forme attendue/);
});

test('un paquet « -dist-min » de la liste de GFS est relié au paquet qui porte ses avis (le relevé du 18/11 : plotly.js, avis critique, absent sous l\'autre nom)', () => {
  const packages = packagesOfList(readPackageJson(ROOT));
  for (const paquet of packages.keys()) {
    if (/-dist-min$/.test(paquet)) assert.ok(PAQUET_DES_AVIS[paquet], `${paquet} : à relier au paquet source de ses avis`);
  }
  assert.equal(PAQUET_DES_AVIS['plotly.js-basic-dist-min'], 'plotly.js');
});

test('le relevé commité couvre la liste de GFS (une montée de version laisse un avertissement, un paquet nouveau demande de refaire le relevé)', () => {
  const releve = JSON.parse(readFileSync(join(ROOT, RELEVE_FILE), 'utf8'));
  const problems = checkReleve(releve, readPackageJson(ROOT)).filter(problem => !problem.startsWith('AVERTISSEMENT'));
  assert.deepEqual(problems, []);
  assert.equal(releve.source, 'registry.npmjs.org');
  assert.ok(!Number.isNaN(Date.parse(releve.releve)));
});
