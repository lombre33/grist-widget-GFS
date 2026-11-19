// La fenêtre « Dépendances » des réglages, sa partie sans écran : les lignes que le modèle tire du catalogue, du relevé daté et des apps installées, la licence face à la GPL 3.0,
// l'audit d'une copie (SHA-384 recalculé) et les adresses que la fenêtre accepte d'offrir en lien. La fenêtre elle-même, à la souris et au clavier, à 700 × 400, en clair et en
// sombre, se mesure sous Firefox (test/dependances-firefox.mjs, lancé par test/interfaces-firefox.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dependencyRows, matchesFilter, summary, safeLink, scopeRow, groupsOf, FILTERS } from '../js/apps/dependencies-model.js';
import { licenceFit } from '../js/apps/licences.js';
import { fingerprint, verifyCopy, verdict } from '../js/apps/dependencies-audit.js';
import { readCatalogue } from '../js/apps/libraries.js';
import { gap } from '../js/apps/version-gap.js';
import { gap as toolGap, RELEVE_FILE } from '../outils/releve-dependances.mjs';
import { ROOT } from '../outils/bibliotheques.mjs';

const catalogue = readCatalogue(JSON.parse(readFileSync(join(ROOT, 'bibliotheques/catalogue.json'), 'utf8')));
const releve = JSON.parse(readFileSync(join(ROOT, RELEVE_FILE), 'utf8'));
const NO_MODULES = { items: [], active: 0, total: 0 };
const rowsOf = (extra = {}) => dependencyRows({ catalogue, releve, modules: NO_MODULES, lang: 'fr', ...extra });
const byName = rows => Object.fromEntries(rows.map(row => [row.paquet, row]));

// Ce que `modulesModel` rend, en miniature : Publipostage+ installé, son extension « Graphiques » cochée ou non, la fonction native « Export PDF » en copie figée ou non.
function modules({ installed = true, checked = true, mode = 'vendorise' } = {}) {
  return { items: [
    { kind: 'app', id: 'publipostage', ok: true, installed, manifest: { nom: { fr: 'Publipostage+', en: 'Mail merge+' } },
      natives: [{ group: { id: 'pdf', nom: { fr: 'Export PDF', en: 'PDF export' } }, mode, inApp: false, libraries: [{ id: 'pdfmake', version: '0.2.7' }, { id: 'pdfmake-polices', version: '0.2.7' }] }] },
    { kind: 'ext', app: 'publipostage', appInstalled: installed, checked, extension: { id: 'graphique', nom: { fr: 'Graphiques', en: 'Charts' } },
      libraries: [{ id: 'plotly', version: '2.13.2' }, { id: 'echarts', version: '6.1.0' }] },
  ], active: 0, total: 2 };
}

test('l\'écart de version est dit par une seule règle, celle de la fenêtre et de l\'outil du relevé', () => {
  assert.equal(toolGap, gap);
  assert.equal(gap('2.13.2', '4.3.0'), 'majeure');
});

test('licenceFit : une licence que la GPL 3.0 accepte, un choix dont une alternative l\'est, jamais « incompatible » par ignorance, rien quand le registre se tait', () => {
  assert.equal(licenceFit('MIT'), 'compatible');
  assert.equal(licenceFit('Apache-2.0'), 'compatible');
  assert.equal(licenceFit('(MIT OR GPL-3.0-or-later)'), 'compatible');
  assert.equal(licenceFit('MIT AND Apache-2.0'), 'compatible');
  assert.equal(licenceFit('GPL-2.0-only'), 'verifier');
  assert.equal(licenceFit('MIT AND Inconnue-1.0'), 'verifier');
  assert.equal(licenceFit('Apache-2.0 WITH LLVM-exception'), 'verifier');
  assert.equal(licenceFit('SEE LICENSE IN LICENSE.txt'), 'verifier');
  assert.equal(licenceFit(''), 'inconnue');
  assert.equal(licenceFit(undefined), 'inconnue');
});

test('safeLink : une adresse https sans identifiants ; jamais http, javascript:, data: ni un texte', () => {
  assert.equal(safeLink('https://github.com/plotly/plotly.js'), 'https://github.com/plotly/plotly.js');
  for (const bad of ['http://exemple.fr/x', 'javascript:alert(1)', 'data:text/html,x', 'https://u:p@exemple.fr/', 'exemple.fr', '', null, undefined, 42]) assert.equal(safeLink(bad), null, String(bad));
});

test('les lignes : une par paquet que GFS sert (17 d\'après le catalogue du 18/11, d3-cloud compris), les six paquets de l\'écriture en direct portent le même fichier, docx et pdfmake en portent deux', () => {
  const rows = byName(rowsOf());
  assert.equal(Object.keys(rows).length, 17);
  for (const name of ['yjs', 'y-protocols', 'lib0', '@tiptap/y-tiptap', '@tiptap/extension-collaboration', '@tiptap/extension-collaboration-caret']) {
    assert.deepEqual(rows[name].files.map(file => file.id), ['edition-live'], name);
  }
  assert.deepEqual(rows.docx.files.map(file => file.id), ['docx', 'docx-charts']);
  assert.deepEqual(rows.pdfmake.files.map(file => file.id), ['pdfmake', 'pdfmake-polices']);
  assert.equal(rows['pdfjs-dist'].version, '6.5.438', 'la version servie est celle du contenu du fichier assemblé, pas celle de GFS (1.0.0)');
  assert.equal(rows['pdfjs-dist'].hasCdn, false, 'pdf.js n\'a pas de CDN : la copie est son seul mode');
  assert.equal(rows.echarts.hasCdn, true);
  assert.ok(rows.echarts.files.every(file => file.cdnHost === 'cdn.jsdelivr.net'));
});

test('sans app qui la demande, une bibliothèque est « au catalogue, demandée par aucune app » ; le relevé donne la dernière stable, l\'écart, la licence et les liens', () => {
  const rows = byName(rowsOf());
  assert.ok(Object.values(rows).every(row => row.state === 'unused' && row.uses.length === 0));
  assert.deepEqual([rows.marked.latest, rows.marked.ecart, rows.marked.licence, rows.marked.licenceFit], ['18.2.1', 'majeure', 'MIT', 'compatible']);
  assert.equal(rows.echarts.ecart, 'a-jour');
  assert.equal(rows.marked.site, 'https://marked.js.org/');
  assert.equal(rows.marked.depot, 'https://github.com/markedjs/marked');
});

test('l\'avis de Plotly (critique, corrigé en 2.25.2) est rattaché à la ligne servie, et lui seul : un filtre « Avis » ne montre que lui', () => {
  const rows = rowsOf();
  const plotly = byName(rows)['plotly.js-basic-dist-min'];
  assert.equal(plotly.advisories.length, 1);
  assert.equal(plotly.worst.niveau, 'critical');
  assert.equal(plotly.worst.corrigeEn, '2.25.2');
  assert.deepEqual(rows.filter(row => matchesFilter(row, 'advisories')).map(row => row.paquet), ['plotly.js-basic-dist-min']);
});

test('l\'état d\'une ligne vient des apps : active (extension cochée, app installée), installée non utilisée, prête (app pas installée) ; une fonction native n\'est active qu\'en copie figée', () => {
  const state = extra => byName(rowsOf({ modules: modules(extra) }));
  const active = state();
  assert.equal(active['plotly.js-basic-dist-min'].state, 'active');
  assert.equal(active.echarts.state, 'active');
  assert.equal(active.pdfmake.state, 'active', 'la fonction « Export PDF » est en copie figée');
  assert.deepEqual(active.echarts.apps, ['Publipostage+']);
  assert.deepEqual(active.echarts.functions, ['Graphiques']);
  assert.deepEqual(active.pdfmake.functions, ['Export PDF']);
  assert.equal(active.pdfmake.uses.length, 1, 'pdfmake et ses polices sont deux entrées d\'une même fonction : une seule mention');
  assert.equal(state({ checked: false, mode: 'cdn' })['plotly.js-basic-dist-min'].state, 'installed');
  assert.equal(state({ checked: false, mode: 'cdn' }).pdfmake.state, 'installed', 'l\'app charge alors ses propres adresses : la copie de GFS n\'est pas servie');
  assert.equal(state({ installed: false, checked: false })['plotly.js-basic-dist-min'].state, 'ready');
  assert.equal(state({ installed: false, checked: false }).marked.state, 'unused', 'ce qu\'aucune app ne demande');
});

test('les lignes actives passent devant, puis l\'ordre alphabétique ; le nom d\'une app suit la langue', () => {
  const rows = rowsOf({ modules: modules({ checked: true }) });
  const states = rows.map(row => row.state);
  assert.deepEqual(states, [...states].sort((a, b) => ['active', 'installed', 'ready', 'unused'].indexOf(a) - ['active', 'installed', 'ready', 'unused'].indexOf(b)));
  assert.deepEqual(rows.slice(0, 3).map(row => row.paquet), ['echarts', 'pdfmake', 'plotly.js-basic-dist-min']);
  assert.ok(rows.slice(3).every(row => row.state === 'unused'));
  assert.deepEqual(byName(rowsOf({ modules: modules(), lang: 'en' })).echarts.apps, ['Mail merge+']);
});

test('sans relevé (fichier absent ou illisible), la fenêtre montre ce que GFS sert : ni dernière stable, ni avis, ni licence, une licence « inconnue »', () => {
  const rows = rowsOf({ releve: null });
  assert.equal(rows.length, 19, 'sans le relevé, un script classique est un paquet qui porte l\'id de sa bibliothèque (docx-charts et pdfmake-polices ont chacun leur ligne) ; un fichier assemblé garde ses paquets');
  const plotly = byName(rows).plotly;
  assert.deepEqual([plotly.latest, plotly.ecart, plotly.advisories.length, plotly.licence, plotly.licenceFit], [null, 'inconnu', 0, null, 'inconnue']);
});

test('un relevé fait pour une autre version que celle que GFS sert ne dit rien de sûr : ni avis ni écart, la ligne le signale', () => {
  const old = structuredClone(releve);
  old.paquets['plotly.js-basic-dist-min'].version = '2.12.0';
  const plotly = byName(rowsOf({ releve: old }))['plotly.js-basic-dist-min'];
  assert.equal(plotly.releveAncien, true);
  assert.deepEqual([plotly.advisories.length, plotly.flagged, plotly.updatable, plotly.worst], [0, false, false, null]);
});

test('les filtres et le pied : le nombre de lignes par filtre et le poids des copies, chaque fichier compté une fois même quand six paquets le portent', () => {
  const rows = rowsOf({ modules: modules() });
  const { counts, bytes } = summary(rows);
  assert.deepEqual(Object.keys(counts), [...FILTERS]);
  assert.equal(counts.all, 17);
  assert.equal(counts.active, 3, 'Plotly, ECharts et pdfmake (deux fichiers, une seule ligne)');
  assert.equal(counts.advisories, 1);
  assert.equal(counts.updates, rows.filter(row => ['correctif', 'mineure', 'majeure'].includes(row.ecart)).length);
  const expected = catalogue.entries.size && [...catalogue.entries.values()].reduce((total, entry) => total + (entry.poids || 0), 0);
  assert.equal(bytes, expected);
});

test('fingerprint : le format des attributs integrity, le même résultat que Node', async () => {
  const bytes = new TextEncoder().encode('Grist Factory Suite');
  assert.equal(await fingerprint(bytes), `sha384-${createHash('sha384').update(bytes).digest('base64')}`);
  await assert.rejects(() => fingerprint(bytes, null), /crypto\.subtle absent/);
});

test('verifyCopy : « ok » quand l\'empreinte recalculée est celle du catalogue, « different » quand le fichier a changé, « erreur » (avec la raison) quand il ne se lit pas', async () => {
  const bytes = new TextEncoder().encode('contenu');
  const file = { copie: { chemin: 'vendor/x/x.js', integrite: await fingerprint(bytes) } };
  const base = 'https://gfs.exemple/proto/';
  const read = content => async address => { assert.equal(address, 'https://gfs.exemple/proto/vendor/x/x.js'); return content; };
  assert.equal((await verifyCopy(file, { readBytes: read(bytes), base })).state, 'ok');
  const changed = await verifyCopy(file, { readBytes: read(new TextEncoder().encode('autre')), base });
  assert.equal(changed.state, 'different');
  assert.notEqual(changed.found, changed.expected);
  const failed = await verifyCopy(file, { readBytes: async () => { throw new Error('404'); }, base });
  assert.deepEqual([failed.state, failed.reason], ['erreur', '404']);
  assert.equal(verdict([{ state: 'ok' }, { state: 'ok' }]), 'ok');
  assert.equal(verdict([{ state: 'ok' }, { state: 'different' }, { state: 'erreur' }]), 'different');
  assert.equal(verdict([{ state: 'ok' }, { state: 'erreur' }]), 'erreur');
  assert.equal(verdict([]), 'erreur');
});

test('les copies que GFS sert sont celles que le catalogue annonce : la vérification de la fenêtre les confirme toutes, octet pour octet', async () => {
  const base = `file://${ROOT}/`;
  const readBytes = async address => readFileSync(new URL(address));
  for (const row of rowsOf()) {
    for (const file of row.files) assert.equal((await verifyCopy(file, { readBytes, base })).state, 'ok', `${row.paquet} : ${file.copie.chemin}`);
  }
});

// Demande du porteur du 18/11 : « regroupé par app, par défaut seulement celles des apps activées, un panneau refermé pour les autres ».
const USE = (app, what, state) => ({ app, appName: app.toUpperCase(), what, state, unit: null });
const ROW = (paquet, uses) => ({ key: `${paquet}@1.0.0`, paquet, version: '1.0.0', uses, state: 'unused' });

test('scopeRow : la ligne vue depuis une app ne parle que d\'elle (état, fonctions), nomme les autres apps et garde tous les usages', () => {
  const row = ROW('x', [USE('a', 'Graphique', 'active'), USE('b', 'Export', 'ready')]);
  const fromA = scopeRow(row, 'a');
  assert.deepEqual([fromA.state, fromA.apps, fromA.functions, fromA.others, fromA.slot, fromA.scope], ['active', ['A'], ['Graphique'], ['B'], 'a|x@1.0.0', 'a']);
  assert.equal(fromA.all.length, 2, 'l\'audit voit tous les usages');
  assert.deepEqual(fromA.uses.map(use => use.app), ['a'], 'le choix de la source ne vaut que pour les fonctions de cette app');
  const fromB = scopeRow(row, 'b');
  assert.deepEqual([fromB.state, fromB.others, fromB.slot], ['ready', ['A'], 'b|x@1.0.0']);
  const loose = scopeRow(ROW('y', []), null);
  assert.deepEqual([loose.state, loose.uses, loose.others, loose.slot], ['unused', [], [], 'none|y@1.0.0']);
});

test('groupsOf : une section par app installée (par nom), les apps non installées puis ce qu\'aucune app ne demande à part, une bibliothèque sous chaque app qui l\'utilise', () => {
  const groups = groupsOf([ROW('zlib', [USE('b', 'Export', 'ready')]), ROW('shared', [USE('a', 'Graphique', 'installed'), USE('b', 'Export', 'ready')]),
    ROW('mine', [USE('a', 'Graphique', 'active')]), ROW('orphan', [])]);
  assert.deepEqual(groups.map(group => [group.id, group.name, group.installed]), [['a', 'A', true], ['b', 'B', false], ['', null, false]]);
  assert.deepEqual(groups[0].rows.map(row => `${row.paquet}:${row.state}`), ['mine:active', 'shared:installed'], 'les actives d\'abord, puis par nom');
  assert.deepEqual(groups[1].rows.map(row => `${row.paquet}:${row.state}`), ['shared:ready', 'zlib:ready'], 'la bibliothèque commune est aussi sous l\'app non installée');
  assert.deepEqual(groups[2].rows.map(row => row.paquet), ['orphan']);
  assert.deepEqual(groupsOf([ROW('mine', [USE('a', 'Graphique', 'active')])]).map(group => group.id), ['a'], 'sans bibliothèque orpheline, pas de section « aucune app »');
});

test('les lignes de GFS rangées par app : Publipostage+ (installée) a les siennes, ce qu\'aucune app ne demande va au panneau refermé', () => {
  const groups = groupsOf(rowsOf({ modules: modules() }));
  const pub = groups.find(group => group.id === 'publipostage');
  assert.ok(pub && pub.installed, 'Publipostage+ est installée');
  assert.ok(pub.rows.every(row => row.uses.length && row.uses.every(use => use.app === 'publipostage')));
  const loose = groups.find(group => group.id === '');
  assert.ok(loose && !loose.installed && loose.rows.every(row => row.state === 'unused'), 'ce qu\'aucune app ne demande va avec les apps non installées');
  assert.equal(new Set(groups.flatMap(group => group.rows.map(row => row.key))).size, rowsOf({ modules: modules() }).length, 'aucune bibliothèque ne manque');
  const off = groupsOf(rowsOf({ modules: modules({ installed: false, checked: false }) })).find(group => group.id === 'publipostage');
  assert.equal(off.installed, false, 'une app qui n\'est pas installée est dans le panneau refermé');
});
