// La fenêtre « Dépendances » des réglages, ses gestes (lot 3, demande du porteur du 18/11) : choisir la source d'une bibliothèque (CDN ou copie figée, le même réglage que la fiche
// d'une app), « Tout en copie figée », et l'export du rapport (rapport de GFS et inventaire CycloneDX). Sans écran : le vrai manifeste de Publipostage+, le vrai catalogue et le vrai
// relevé de GFS, les vraies lignes du modèle des apps ; la table du document est une mémoire. La fenêtre à la souris se mesure sous Firefox (test/dependances-firefox.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppsState } from '../js/apps/apps-state.js';
import { readCatalogue } from '../js/apps/libraries.js';
import { dependencyRows } from '../js/apps/dependencies-model.js';
import { allUnits, planFor, planSize, sourceOf } from '../js/apps/dependencies-source.js';
import { allTarget } from '../js/apps/dependencies-foot.js';
import { gfsReport, reportText, reportName, newSerial } from '../js/apps/dependencies-export.js';
import { cyclonedx, hexOf, purlOf } from '../js/apps/dependencies-cyclonedx.js';
import { withSources } from '../js/apps/settings.js';
import { RELEVE_FILE } from '../outils/releve-dependances.mjs';
import { ROOT } from '../outils/bibliotheques.mjs';
import { publipostage } from './helpers.mjs';

const catalogue = readCatalogue(JSON.parse(readFileSync(join(ROOT, 'bibliotheques/catalogue.json'), 'utf8')));
const releve = JSON.parse(readFileSync(join(ROOT, RELEVE_FILE), 'utf8'));
const pub = { ...publipostage(), permanente: true };
const loaded = [{ app: { id: 'publipostage' }, manifest: pub, ok: true, errors: [] }];
const ALL = { publipostage: { extensions: ['graphique', 'edition', 'lecture-pdf'] } };

// Une table du document en mémoire : `writes` garde chaque écriture.
function fakeStore(value, fail = null) {
  const store = { value, writes: [], read: async () => ({ raw: structuredClone(store.value) }),
    update: async mutate => {
      if (fail) throw fail;
      const next = mutate(structuredClone(store.value));
      store.writes.push(next);
      store.value = next;
      return structuredClone(next);
    } };
  return store;
}

async function setup(value = ALL, fail = null) {
  const store = fakeStore(value, fail);
  const state = new AppsState({ store, onChange: () => {} });
  state.setApps(loaded);
  state.setCatalogue(catalogue);
  await state.load();
  return { state, store };
}

const rowsOf = (state, lang = 'fr') => dependencyRows({ catalogue, releve, modules: state.model(), lang });
const byName = rows => Object.fromEntries(rows.map(row => [row.paquet, row]));

test('les fonctions du modèle : ce que la personne peut choisir, et pourquoi le reste est grisé', async () => {
  const { state } = await setup({ publipostage: { extensions: ['graphique', 'lecture-pdf'] } });
  const units = allUnits(state.model(), 'fr');
  const unit = key => units.get(`publipostage|${key}`);
  assert.deepEqual([unit('extension|graphique').mode, unit('extension|graphique').why, unit('extension|graphique').canCdn], ['cdn', null, true]);
  assert.deepEqual([unit('extension|lecture-pdf').mode, unit('extension|lecture-pdf').canCdn], ['vendorise', false], 'pdf.js n\'a pas de CDN : la copie est son seul mode');
  assert.equal(unit('extension|edition').why, 'off', 'une extension non ajoutée attend son ajout');
  assert.equal(unit('extension|diapositives').why, 'off');
  assert.deepEqual([unit('native|editeur').mode, unit('native|editeur').canCopy, unit('native|editeur').libraries], ['cdn', true, []], 'une fonction dont la copie est dans l\'app compte aussi');
  assert.equal(unit('extension|graphique').appName, 'Publipostage+');
  assert.equal(unit('extension|graphique').what, 'Graphique');
  assert.deepEqual(unit('extension|graphique').libraries, ['plotly', 'echarts']);
  const noApp = new AppsState({ store: fakeStore(null), onChange: () => {} });
  noApp.setApps([{ app: { id: 'publipostage' }, manifest: { ...pub, permanente: false }, ok: true, errors: [] }]);
  noApp.setCatalogue(catalogue);
  await noApp.load();
  assert.equal(allUnits(noApp.model(), 'fr').get('publipostage|extension|graphique').why, 'app', 'une app pas installée : son choix se fait après l\'installation');
});

test('planFor : seulement ce qui se peut et ce qui change, une liste par app avec le nom des fonctions', async () => {
  const { state } = await setup();
  const units = allUnits(state.model(), 'fr');
  const copy = planFor(units.values(), 'vendorise');
  assert.deepEqual(copy, [{ app: 'publipostage', appName: 'Publipostage+', extensions: ['graphique'], natives: ['editeur'], names: [pub.natives[0].nom.fr, 'Graphique'] }],
    'Écriture en direct et lecture PDF sont déjà en copie : rien à y écrire');
  assert.equal(planSize(copy), 2);
  const cdn = planFor(units.values(), 'cdn');
  assert.deepEqual(cdn.map(entry => [entry.extensions, entry.natives]), [[['edition'], []]], 'le CDN : Écriture en direct (qui peut) ; pas la lecture PDF (aucun CDN), rien pour ce qui y est déjà');
  assert.deepEqual(planFor(units.values(), 'inconnu'), [], 'un mode inconnu ne change rien');
  assert.deepEqual(planFor([...units.values(), ...units.values()], 'vendorise'), copy, 'une fonction vue deux fois n\'est écrite qu\'une fois');
});

test('allTarget : « tout en copie figée », sauf quand chaque fonction qui le peut y est déjà (le bouton propose le retour au CDN)', async () => {
  const { state } = await setup();
  assert.equal(allTarget(allUnits(state.model(), 'fr')), 'vendorise');
  await state.setSources('publipostage', { extensions: ['graphique'], natives: ['editeur'] }, 'vendorise');
  assert.equal(allTarget(allUnits(state.model(), 'fr')), 'cdn');
  const none = await setup({ publipostage: { extensions: [] } });
  assert.equal(allTarget(new Map([...allUnits(none.state.model(), 'fr')].filter(([, unit]) => unit.kind === 'extension'))), 'vendorise', 'rien ne se choisit : la copie par défaut, le plan sera vide');
});

test('setSources : plusieurs fonctions d\'une app, une seule écriture ; l\'état change avant ; un choix qui est le défaut ne s\'écrit pas', async () => {
  const { state, store } = await setup();
  const done = state.setSources('publipostage', { extensions: ['graphique', 'edition'], natives: ['editeur'] }, 'vendorise');
  assert.equal(state.apps.publipostage.modes.graphique, 'vendorise', 'la fenêtre répond tout de suite');
  assert.equal(await done, true);
  assert.equal(store.writes.length, 1, 'une seule écriture pour trois fonctions');
  assert.deepEqual(store.value.publipostage.modes, { graphique: 'vendorise', 'natif:editeur': 'vendorise' }, 'Écriture en direct est en copie par défaut : rien à retenir');
  assert.equal(await state.setSources('publipostage', { extensions: ['graphique'], natives: [] }, 'vendorise'), false, 'rien ne change, rien ne s\'écrit');
  assert.equal(store.writes.length, 1);
  assert.equal(await state.setSources('publipostage', { extensions: ['graphique'] }, 'cdn'), true);
  assert.deepEqual(store.value.publipostage.modes, { 'natif:editeur': 'vendorise' }, 'le retour au CDN efface le choix de l\'extension');
  assert.equal(await state.setSources('inconnue', { extensions: ['graphique'] }, 'cdn'), false);
  assert.equal(await state.setSources('publipostage', { extensions: [], natives: [] }, 'cdn'), false, 'une liste vide n\'écrit rien');
});

test('withSources : un mode inconnu, une extension non ajoutée ou une fonction inconnue ne changent rien', () => {
  const apps = { publipostage: { extensions: ['graphique'], modes: {} } };
  assert.equal(withSources(apps, pub, { extensions: ['graphique'] }, 'autre'), apps);
  assert.equal(withSources({}, pub, { extensions: ['graphique'] }, 'vendorise').publipostage, undefined);
  const next = withSources(apps, pub, { extensions: ['edition', 'inconnue'], natives: ['fantome', 'editeur'] }, 'vendorise');
  assert.deepEqual(next.publipostage.modes, { 'natif:editeur': 'vendorise' }, 'l\'extension non ajoutée et les inconnues ne laissent rien');
});

test('un refus de la table : l\'état revient à ce que la table dit, l\'erreur remonte', async () => {
  const { state } = await setup(ALL, new Error('refusé'));
  await assert.rejects(state.setSources('publipostage', { extensions: ['graphique'] }, 'vendorise'), /refusé/);
  assert.equal(state.apps.publipostage.modes.graphique, undefined);
});

test('sourceOf : ce que la ligne d\'une bibliothèque propose, d\'après les fonctions qui l\'utilisent', async () => {
  const { state } = await setup();
  const rows = byName(rowsOf(state));
  const plotly = sourceOf(rows['plotly.js-basic-dist-min']);
  assert.deepEqual([plotly.mode, plotly.can.cdn, plotly.can.vendorise, plotly.open.length, plotly.refused], ['cdn', true, true, 1, false]);
  assert.deepEqual(plotly.follow, ['echarts'], 'Graphiques porte aussi ECharts : il suit le choix');
  const pdf = sourceOf(rows['pdfjs-dist']);
  assert.deepEqual([pdf.mode, pdf.can.cdn, pdf.can.vendorise], ['vendorise', false, true], 'le CDN est grisé : GFS n\'a pas d\'adresse publique pour pdf.js');
  const edition = sourceOf(rows.yjs);
  assert.deepEqual([edition.mode, edition.refused, edition.follow], ['vendorise', false, []]);
  await state.setMode('publipostage', 'edition', 'cdn');
  assert.equal(sourceOf(byName(rowsOf(state)).yjs).refused, true, 'en CDN avec une app qui ne nomme pas encore l\'adresse : le navigateur refuserait, la ligne le dit');
  assert.deepEqual(sourceOf(rows.marked).units, [], 'aucune app ne la demande : rien à choisir');
  assert.equal(sourceOf(rows.marked).mode, null);
  const { state: bare } = await setup({ publipostage: { extensions: [] } });
  const off = sourceOf(byName(rowsOf(bare))['plotly.js-basic-dist-min']);
  assert.deepEqual([off.open.length, off.why], [0, ['off']], 'l\'extension n\'est pas ajoutée : le choix attend');
  await state.setSources('publipostage', { extensions: ['graphique'] }, 'vendorise');
  assert.equal(sourceOf(byName(rowsOf(state))['plotly.js-basic-dist-min']).mode, 'vendorise', 'les lignes relues après un choix suivent');
});

test('hexOf et purlOf : l\'empreinte du catalogue en hexadécimal (96 chiffres), l\'identifiant d\'un paquet, portée comprise', () => {
  const bytes = new TextEncoder().encode('Grist Factory Suite');
  const sha = createHash('sha384').update(bytes);
  assert.equal(hexOf(`sha384-${createHash('sha384').update(bytes).digest('base64')}`), sha.digest('hex'));
  assert.equal(hexOf('sha384-pas-une-empreinte'), null);
  assert.equal(hexOf(undefined), null);
  assert.equal(purlOf('echarts', '6.1.0'), 'pkg:npm/echarts@6.1.0');
  assert.equal(purlOf('@tiptap/y-tiptap', '3.0.10'), 'pkg:npm/%40tiptap/y-tiptap@3.0.10');
});

test('le rapport de GFS : une entrée par bibliothèque, ce que la fenêtre dit d\'elle, de la source retenue aux empreintes', async () => {
  const { state } = await setup();
  const rows = rowsOf(state);
  const report = gfsReport({ rows, surveyed: releve.releve, generated: '2026-11-18T10:00:00.000Z' });
  assert.deepEqual([report.format, report.version, report.genere, report.releve], ['gfs-dependances', 1, '2026-11-18T10:00:00.000Z', releve.releve]);
  assert.equal(report.bibliotheques.length, rows.length);
  const plotly = report.bibliotheques.find(entry => entry.paquet === 'plotly.js-basic-dist-min');
  assert.deepEqual(plotly.utilisee_par, [{ app: 'Publipostage+', fonction: 'Graphique', etat: 'active', source: 'cdn' }]);
  assert.equal(plotly.avis[0].id, 'GHSA-wjc4-73q6-gv3m');
  assert.equal(plotly.fichiers[0].copie.integrite, catalogue.entries.get('plotly@2.13.2').vendorise.integrite);
  assert.equal(plotly.fichiers[0].cdn.src, catalogue.entries.get('plotly@2.13.2').cdn.src);
  const pdfjs = report.bibliotheques.find(entry => entry.paquet === 'pdfjs-dist');
  assert.equal(pdfjs.fichiers[0].cdn, null);
  assert.equal(pdfjs.utilisee_par[0].source, 'copie');
  assert.deepEqual(JSON.parse(JSON.stringify(report)), report, 'rien que du JSON');
  assert.equal(reportName('json', '2026-11-18T10:00:00.000Z'), 'gfs-dependances-2026-11-18.json');
  assert.equal(reportName('cdx', '2026-11-18T10:00:00.000Z'), 'gfs-dependances-2026-11-18.cdx.json');
  assert.match(reportText('json', { rows, surveyed: releve.releve, generated: '2026-11-18T10:00:00.000Z' }), /\n$/);
});

test('l\'inventaire CycloneDX 1.5 : un composant par bibliothèque, les empreintes en hexadécimal, les avis en vulnérabilités, les adresses contactées', async () => {
  const { state } = await setup();
  const rows = rowsOf(state);
  const bom = cyclonedx({ rows, surveyed: releve.releve, generated: '2026-11-18T10:00:00.000Z', serial: '3e671687-395b-41f5-a30f-a58921a69b79' });
  assert.deepEqual([bom.bomFormat, bom.specVersion, bom.serialNumber, bom.version], ['CycloneDX', '1.5', 'urn:uuid:3e671687-395b-41f5-a30f-a58921a69b79', 1]);
  assert.equal(bom.metadata.timestamp, '2026-11-18T10:00:00.000Z');
  assert.equal(bom.metadata.component.licenses[0].license.id, 'GPL-3.0-only');
  assert.equal(bom.components.length, rows.length);
  const refs = bom.components.map(component => component['bom-ref']);
  assert.equal(new Set(refs).size, refs.length, 'un identifiant par composant');
  assert.deepEqual(bom.dependencies, [{ ref: 'gfs', dependsOn: refs }]);
  const part = name => bom.components.find(component => component.name === name || component.purl.includes(`/${name}@`));
  const plotly = part('plotly.js-basic-dist-min');
  assert.equal(plotly.purl, 'pkg:npm/plotly.js-basic-dist-min@2.13.2');
  assert.deepEqual(plotly.licenses, [{ license: { id: 'MIT' } }]);
  assert.equal(plotly.hashes[0].alg, 'SHA-384');
  assert.match(plotly.hashes[0].content, /^[0-9a-f]{96}$/);
  assert.equal(plotly.hashes[0].content, hexOf(catalogue.entries.get('plotly@2.13.2').vendorise.integrite));
  assert.equal(plotly.scope, 'required');
  assert.ok(plotly.externalReferences.some(ref => ref.type === 'distribution' && ref.url.startsWith('https://cdn.jsdelivr.net/') && /^[0-9a-f]{96}$/.test(ref.hashes[0].content)), 'l\'adresse du CDN et son empreinte');
  assert.ok(plotly.externalReferences.some(ref => ref.type === 'vcs' && ref.url === 'https://github.com/plotly/plotly.js'));
  assert.deepEqual(plotly.properties.filter(property => property.name === 'gfs:used-by'), [{ name: 'gfs:used-by', value: 'Publipostage+' }]);
  assert.equal(plotly.properties.find(property => property.name === 'gfs:source').value, 'cdn');
  const scoped = bom.components.find(component => component.group === '@tiptap' && component.name === 'y-tiptap');
  assert.ok(scoped && scoped.purl.startsWith('pkg:npm/%40tiptap/y-tiptap@'), 'un paquet à portée : le groupe et le nom, la purl avec %40');
  assert.equal(scoped.hashes, undefined, 'un fichier assemblé porte six paquets : son empreinte n\'est pas celle de l\'un d\'eux');
  assert.ok(scoped.properties.some(property => property.name === 'gfs:copy:edition-live' && property.value.includes('sha384-')), 'elle est dans ses propriétés');
  assert.equal(part('echarts').licenses[0].license.id, 'Apache-2.0');
  assert.deepEqual(part('docx').hashes, undefined, 'docx porte deux fichiers : leurs empreintes sont dans ses propriétés');
  assert.deepEqual(bom.vulnerabilities.map(vuln => vuln.id), ['GHSA-wjc4-73q6-gv3m']);
  const [vuln] = bom.vulnerabilities;
  assert.deepEqual([vuln.ratings[0].severity, vuln.ratings[0].score, vuln.affects], ['critical', 9.8, [{ ref: 'pkg:npm/plotly.js-basic-dist-min@2.13.2' }]]);
  assert.equal(vuln.recommendation, 'Upgrade to 2.25.2 or later.');
  assert.match(vuln.source.url, /^https:\/\/github\.com\/advisories\//);
  assert.deepEqual(JSON.parse(JSON.stringify(bom)), bom, 'rien que du JSON');
});

test('une licence qui est une expression reste une expression ; sans licence, aucun champ', () => {
  const row = { paquet: 'x', version: '1.0.0', state: 'unused', uses: [], apps: [], files: [], advisories: [], latest: null, site: null, depot: null };
  const one = licence => cyclonedx({ rows: [{ ...row, licence }], surveyed: null, generated: 'g', serial: 's' }).components[0].licenses;
  assert.deepEqual(one('(MIT OR GPL-3.0-or-later)'), [{ expression: '(MIT OR GPL-3.0-or-later)' }]);
  assert.deepEqual(one(null), []);
  assert.equal(cyclonedx({ rows: [], surveyed: null, generated: 'g', serial: 's' }).metadata.properties[0].value, 'unavailable', 'sans relevé, l\'inventaire le dit');
});

test('newSerial : un UUID version 4, celui du navigateur ou, à défaut, construit d\'après ses octets aléatoires', () => {
  assert.equal(newSerial({ randomUUID: () => 'abc' }), 'abc');
  const fixed = { getRandomValues: bytes => { bytes.fill(255); return bytes; } };
  assert.match(newSerial(fixed), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.match(newSerial(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
