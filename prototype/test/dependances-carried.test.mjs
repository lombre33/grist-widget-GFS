// « Portées par l'app » (demande du porteur, 18/11 : « Oui, déclaré par chaque app ») : la validation de `portees` dans le manifeste, ce que la fenêtre en tire (js/apps/
// dependencies-carried.js), leur rangement sous l'app (`groupsOf`) et leur place dans le rapport exporté. La fenêtre elle-même se mesure sous Firefox
// (test/dependances-firefox.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateManifest } from '../js/apps/manifest.js';
import { carriedAddress } from '../js/apps/manifest-carried.js';
import { carriedOf, carriedText } from '../js/apps/dependencies-carried.js';
import { groupsOf } from '../js/apps/dependencies-model.js';
import { gfsReport, reportText } from '../js/apps/dependencies-export.js';
import { cyclonedx } from '../js/apps/dependencies-cyclonedx.js';
import { ROOT } from '../outils/bibliotheques.mjs';

const manifest = id => JSON.parse(readFileSync(join(ROOT, `manifestes/${id}.json`), 'utf8'));
const withCarried = portees => ({ ...manifest('automation'), portees });
const errorsOf = portees => validateManifest(withCarried(portees)).errors;
const GOOD = { id: 'leaflet', nom: 'Leaflet', version: '1.9.4', adresse: 'https://unpkg.com/', quand: 'option' };

test('portees : une liste (même vide : « aucune bibliothèque » se distingue de « rien déclaré »), jamais autre chose', () => {
  assert.deepEqual(errorsOf([]), []);
  assert.deepEqual(errorsOf([GOOD]), []);
  assert.deepEqual(validateManifest(manifest('automation')).errors, [], 'le champ est facultatif');
  assert.deepEqual(errorsOf({}), ['portees : liste attendue']);
  assert.deepEqual(errorsOf('leaflet'), ['portees : liste attendue']);
});

test('portees : un identifiant en minuscules et unique, un nom, une adresse https sans identifiants ni port, un moment connu', () => {
  const bad = (entry, part) => assert.ok(errorsOf([{ ...GOOD, ...entry }]).some(error => error.includes(part)), `${JSON.stringify(entry)} : ${part}`);
  bad({ id: 'Leaflet' }, 'portees[0].id');
  bad({ id: undefined }, 'portees[0].id');
  bad({ nom: '' }, 'portees[0].nom');
  bad({ nom: 'x'.repeat(61) }, 'portees[0].nom');
  bad({ version: '^1.9.0' }, 'portees[0].version');
  bad({ version: 'latest' }, 'portees[0].version');
  for (const address of ['http://unpkg.com/', 'unpkg.com', 'https://u:p@unpkg.com/', 'https://unpkg.com:8443/', 'https://localhost/', 'javascript:alert(1)', 42, undefined]) {
    bad({ adresse: address }, 'portees[0].adresse');
  }
  bad({ quand: 'toujours' }, 'portees[0].quand');
  bad({ quand: undefined }, 'portees[0].quand');
  bad({ contient: 'ProseMirror' }, 'portees[0].contient');
  bad({ contient: Array.from({ length: 13 }, (_, index) => `lib${index}`) }, 'portees[0].contient');
  bad({ paquet: 'Not A Package' }, 'portees[0].paquet');
  bad({ note: { fr: 'seulement le français' } }, 'portees[0].note');
  bad({ secret: 'x' }, 'portees[0].secret : inconnu');
  assert.ok(errorsOf([GOOD, { ...GOOD, nom: 'Autre' }]).some(error => error.includes('déjà déclaré')), 'un identifiant déclaré deux fois');
  assert.deepEqual(errorsOf([{ ...GOOD, version: undefined, paquet: '@tiptap/core', contient: ['a'], note: { fr: 'x', en: 'y' } }]), [], 'sans version : un service en ligne');
  assert.equal(carriedAddress('https://esm.sh/').hostname, 'esm.sh');
});

// Ce que `modulesModel` rend, en miniature : deux apps qui déclarent, une qui n'a rien déclaré.
const item = (id, nom, installed, portees) => ({ kind: 'app', id, ok: true, installed, manifest: { nom: { fr: nom, en: nom }, ...(portees ? { portees } : {}) }, natives: [] });
const MODULES = {
  items: [item('pp', 'Publipostage+', true, [
    { id: 'tiptap', nom: 'TipTap', version: '3.31.3', adresse: 'https://esm.sh/', quand: 'demarrage', contient: ['ProseMirror', 'linkifyjs'], note: { fr: 'Note FR', en: 'Note EN' } },
    { id: 'pdfmake', nom: 'pdfmake', version: '0.2.7', adresse: 'https://cdnjs.cloudflare.com/', quand: 'usage', paquet: 'pdfmake' },
    { id: 'marked', nom: 'marked', version: '15.0.12', adresse: 'https://cdnjs.cloudflare.com/', quand: 'usage', paquet: 'marked' },
    { id: 'api', nom: 'API de Grist', adresse: 'https://docs.getgrist.com/', quand: 'demarrage' }]),
  item('form', 'Form+', false, [{ id: 'leaflet', nom: 'Leaflet', version: '1.9.4', adresse: 'https://unpkg.com/', quand: 'option' }]),
  item('auto', 'Automation+', true, []), item('bi', 'Grist-BI', true, undefined)],
  active: 0, total: 4 };
const USE = (app, appName, what, state) => ({ app, appName, what, state, unit: null });
const ROW = (paquet, version, uses) => ({ key: `${paquet}@${version}`, paquet, version, uses, state: 'unused' });
const ROWS = [ROW('pdfmake', '0.2.7', [USE('pp', 'Publipostage+', 'Export PDF', 'active')]), ROW('marked', '15.0.12', []), ROW('d3-cloud', '2.0.0', [USE('bi', 'Grist-BI', 'Nuage', 'active')])];

test('carriedOf : une entrée par app qui déclare (même vide), l\'app sans déclaration absente, le moment puis le nom, la langue de la personne', () => {
  const groups = carriedOf({ modules: MODULES, lang: 'fr', rows: ROWS });
  assert.deepEqual(groups.map(group => [group.id, group.name, group.installed, group.declared, group.carried.length]),
    [['pp', 'Publipostage+', true, 4, 3], ['form', 'Form+', false, 1, 1], ['auto', 'Automation+', true, 0, 0]], 'Grist-BI n\'a rien déclaré : pas d\'entrée');
  const [api, tiptap, marked] = groups[0].carried;
  assert.deepEqual([api.id, tiptap.id, marked.id], ['api', 'tiptap', 'marked'], 'au démarrage d\'abord (par nom), puis au premier usage');
  assert.deepEqual([tiptap.host, tiptap.version, tiptap.contains, tiptap.note, tiptap.when, tiptap.slot], ['esm.sh', '3.31.3', ['ProseMirror', 'linkifyjs'], 'Note FR', 'demarrage', 'pp|portee|tiptap']);
  assert.equal(carriedOf({ modules: MODULES, lang: 'en', rows: ROWS })[0].carried.find(entry => entry.id === 'tiptap').note, 'Note EN');
  assert.equal(api.version, null, 'un service en ligne n\'a pas de version');
});

test('carriedOf : une bibliothèque que GFS sert déjà à cette app n\'est pas montrée deux fois ; servie sans être utilisée, elle le dit', () => {
  const [pp] = carriedOf({ modules: MODULES, lang: 'fr', rows: ROWS });
  assert.deepEqual(pp.carried.map(entry => entry.id), ['api', 'tiptap', 'marked'], 'pdfmake est la ligne de GFS (Publipostage+ l\'utilise)');
  assert.equal(pp.declared, 4, 'mais l\'app en déclare quatre');
  const marked = pp.carried.find(entry => entry.id === 'marked');
  assert.deepEqual(marked.gfs, { version: '15.0.12' }, 'GFS en garde une copie, qu\'aucune app n\'utilise');
  assert.equal(pp.carried.find(entry => entry.id === 'tiptap').gfs, null);
});

test('carriedText : le nom, la version, l\'hôte, le paquet et ce que la bibliothèque contient se cherchent', () => {
  const [pp] = carriedOf({ modules: MODULES, lang: 'fr', rows: ROWS });
  const text = carriedText(pp.carried.find(entry => entry.id === 'tiptap'));
  for (const word of ['tiptap', '3 31 3', 'esm sh', 'prosemirror', 'linkifyjs', 'publipostage']) assert.ok(text.includes(word), word);
});

test('groupsOf avec ce que les apps déclarent : sous l\'app qui le déclare, une app sans bibliothèque de GFS a sa section, installée ou non', () => {
  const carried = carriedOf({ modules: MODULES, lang: 'fr', rows: ROWS });
  const groups = groupsOf(ROWS, carried);
  assert.deepEqual(groups.map(group => [group.id, group.installed, group.rows.length, group.carried.length, group.declared]), [
    ['auto', true, 0, 0, 0], ['form', false, 0, 1, 1], ['bi', true, 1, 0, null], ['pp', true, 1, 3, 4], ['', false, 1, 0, null]]);
  assert.deepEqual(groupsOf(ROWS).map(group => group.declared), [null, null, null], 'sans déclaration, comme avant');
});

test('le rapport exporté garde ce que les apps déclarent, marqué non vérifié ; l\'inventaire CycloneDX en fait des composants sans identifiant ni licence', () => {
  const carried = carriedOf({ modules: MODULES, lang: 'fr', rows: ROWS });
  const report = gfsReport({ rows: [], carried, surveyed: null, generated: '2026-11-18T10:00:00.000Z' });
  assert.deepEqual(report.declarees.map(group => [group.app, group.nombre, group.bibliotheques.length]), [['pp', 4, 3], ['form', 1, 1], ['auto', 0, 0]]);
  const tiptap = report.declarees[0].bibliotheques.find(entry => entry.id === 'tiptap');
  assert.deepEqual([tiptap.declaree_par, tiptap.verifiee, tiptap.hote, tiptap.quand, tiptap.contient], ['app', false, 'esm.sh', 'demarrage', ['ProseMirror', 'linkifyjs']]);
  assert.deepEqual(JSON.parse(JSON.stringify(report)), report, 'rien que du JSON');
  assert.deepEqual(gfsReport({ rows: [], surveyed: null, generated: 'g' }).declarees, [], 'sans déclaration, une liste vide');
  const bom = cyclonedx({ rows: [], carried, surveyed: null, generated: 'g', serial: 's' });
  const leaflet = bom.components.find(component => component['bom-ref'] === 'gfs:declared:form:leaflet');
  assert.ok(leaflet && !leaflet.purl && !leaflet.licenses && !leaflet.hashes, 'GFS n\'en sait ni la licence ni l\'empreinte');
  assert.deepEqual(leaflet.properties.slice(0, 3), [{ name: 'gfs:declared-by-app', value: 'form' }, { name: 'gfs:verified', value: 'false' }, { name: 'gfs:loaded', value: 'option' }]);
  assert.equal(leaflet.externalReferences[0].url, 'https://unpkg.com/');
  assert.equal(bom.components.find(component => component.name === 'API de Grist').version, undefined, 'pas de version déclarée, pas de champ');
  assert.equal(JSON.parse(reportText('cdx', { rows: [], carried, surveyed: null, generated: 'g', serial: 's' })).components.length, 4);
});

test('Publipostage+ déclare ce qu\'il charge lui-même (sa section du 18/11, consigne 081) : l\'éditeur et l\'API de Grist au démarrage, les sept bibliothèques d\'export et les polices du PDF au premier usage, deux familles de polices en option', () => {
  const portees = manifest('publipostage').portees;
  assert.deepEqual(validateManifest(manifest('publipostage')).errors, []);
  assert.deepEqual(portees.filter(entry => entry.quand === 'demarrage').map(entry => entry.id), ['tiptap', 'grist-api']);
  assert.deepEqual(portees.filter(entry => entry.quand === 'usage').map(entry => entry.id).sort(),
    ['docx', 'exceljs', 'jszip', 'marked', 'pdf-lib', 'pdfmake', 'polices-pdf', 'qrcode-generator']);
  assert.deepEqual(portees.filter(entry => entry.quand === 'option').map(entry => entry.id), ['polices-libres', 'marianne']);
  assert.equal(portees.find(entry => entry.id === 'docx').adresse, 'https://cdn.jsdelivr.net/', 'docx est sur jsDelivr, pas sur cdnjs (la page de l\'app le dit)');
  assert.equal(portees.find(entry => entry.id === 'polices-pdf').adresse, 'https://lombre33.github.io/publipostageGrist/', 'rangées avec l\'app : son propre site');
  assert.deepEqual(portees.find(entry => entry.id === 'tiptap').contient, ['ProseMirror', 'floating-ui', 'prosemirror-suggest-changes', 'linkifyjs']);
});

test('Grist-BI, Form+ et Automation+ déclarent ce qu\'ils chargent eux-mêmes (leurs sections du 18/11, consignes 023, 035 et 022) ; le kit n\'y est pas : c\'est du code de GFS', () => {
  for (const id of ['bi', 'form', 'automation']) assert.deepEqual(validateManifest(manifest(id)).errors, [], id);
  const ids = id => manifest(id).portees.map(entry => entry.id);
  assert.deepEqual(ids('bi'), ['echarts', 'exceljs', 'duckdb-wasm', 'pptxgenjs', 'grist-api']);
  assert.deepEqual(ids('form'), ['grist-api', 'leaflet', 'tuiles-openstreetmap', 'qrcodejs']);
  assert.deepEqual(ids('automation'), ['grist-api'], 'Automation+ : le script de Grist et rien d\'autre');
  assert.equal(manifest('form').portees.find(entry => entry.id === 'leaflet').quand, 'option', 'Leaflet est inactive tant que la carte n\'est pas activée');
  assert.equal(manifest('bi').portees.find(entry => entry.id === 'duckdb-wasm').quand, 'usage', 'DuckDB-WASM (34 Mo) : jamais à l\'ouverture');
  for (const id of ['publipostage', 'bi', 'form', 'automation']) assert.ok(!manifest(id).portees.some(entry => entry.id === 'kit'), `${id} : pas de ligne « kit »`);
});
