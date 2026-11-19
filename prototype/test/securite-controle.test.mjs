// Le contrôle de sécurité des apps (cahier 3.2.1 et 3.2.2, règles S1 à S9) : la lecture d'une politique et d'une page, le jugement de chaque règle, le contrôle d'une app et du catalogue
// (outils/controle-securite.mjs, avec un environnement de lecture fabriqué : aucun réseau), et le fichier commité. Les politiques d'essai sont celles que les apps portaient le 18/11
// (faits vérifiés 133), réduites à ce qui compte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parsePolicy, sourcesOf, kindOf, gradeS1, gradeS2, gradeS3, gradeS4, permitted } from '../js/apps/security-policy.js';
import { readPage, scanCode, scanRelay, parseState } from '../js/apps/security-page.js';
import { gradeApp, gradeS5, gradeS7, gradeS8, gradeS9, RULES } from '../js/apps/security-rules.js';
import { controle, checkSecurite, fingerprintOf, walk, SECURITE_FILE } from '../outils/controle-securite.mjs';
import { ROOT } from '../outils/bibliotheques.mjs';

const GRIST_API = 'https://docs.getgrist.com/grist-plugin-api.js';
const AUTOMATION = `default-src 'none'; script-src 'self' 'unsafe-eval' ${GRIST_API}; style-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'`;
const FORM_WIDGET = `default-src 'self'; script-src 'self' 'unsafe-eval' ${GRIST_API} https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: https:; `
  + `connect-src 'self' https:; object-src 'none'; base-uri 'none'`;
const PUBLIPOSTAGE = `script-src 'self' 'unsafe-eval' ${GRIST_API} https://esm.sh/*orderedmap@2.1.1 https://esm.sh/@tiptap/core@3.31.3 'sha256-abc='; object-src 'none'; base-uri 'none'; `
  + `frame-src https://www.youtube-nocookie.com https://player.vimeo.com; form-action 'none'`;
const policies = text => [parsePolicy(text)];
const html = (csp, extra = '') => `<!doctype html><html><head><meta charset="utf-8">${csp ? `<meta http-equiv="Content-Security-Policy" content="${csp}">` : ''}${extra}</head><body></body></html>`;

test('parsePolicy : directive par directive, la première écrite gagne, les majuscules et les blancs ne comptent pas', () => {
  const policy = parsePolicy("Default-Src 'none' ;  script-src   'self'  https://a.fr ; script-src https://b.fr;;");
  assert.deepEqual(policy, { 'default-src': ["'none'"], 'script-src': ["'self'", 'https://a.fr'] });
});

test('sourcesOf : la directive, sinon son repli ; un worker replie sur script-src ; plusieurs politiques : la plus étroite', () => {
  const p = policies("default-src 'none'; script-src 'self'");
  assert.deepEqual(sourcesOf(p, 'connect-src'), ["'none'"], 'repli sur default-src');
  assert.equal(sourcesOf(policies("script-src 'self'"), 'connect-src'), null, 'rien ne la limite');
  assert.deepEqual(sourcesOf(p, 'worker-src'), ["'self'"], 'worker-src replie sur script-src avant default-src');
  assert.deepEqual(sourcesOf([parsePolicy("connect-src 'self' https:"), parsePolicy("connect-src 'none'")], 'connect-src'), ["'none'"], "'none' d'une des deux politiques l'emporte");
});

test('kindOf : un hôte nu est une origine entière, un hôte avec chemin une adresse exacte, un joker ou un schéma est large', () => {
  const kinds = ["'self'", "'none'", "'unsafe-eval'", "'sha256-abc='", "'nonce-x'", '*', 'https:', 'data:', '*.exemple.fr', 'https://cdn.fr', 'https://cdn.fr/', 'https://cdn.fr/lib@1.2.3/x.js', 'cdn.fr/x.js']
    .map(kindOf);
  assert.deepEqual(kinds, ['self', 'none', 'keyword', 'hash', 'nonce', 'wildcard', 'scheme', 'scheme', 'host-wildcard', 'origin', 'origin', 'host', 'host']);
});

test('Automation+ : la politique de la page tient S1 à S4, sans aucune adresse d\'appel ; \'unsafe-eval\' est noté, pas compté contre elle', () => {
  const p = policies(AUTOMATION);
  assert.deepEqual([gradeS1(p).etat, gradeS2(p).etat, gradeS3(p).etat, gradeS4(p).etat], ['tenue', 'tenue', 'tenue', 'tenue']);
  assert.deepEqual(gradeS4(p).notes, ["'unsafe-eval'"]);
  assert.deepEqual(permitted(p), { ouvert: [], adresses: [] });
});

test('Publipostage+ : sans default-src ni connect-src, les appels sortants sont ouverts (S2, S3) ; ses scripts sont nommés (S4)', () => {
  const p = policies(PUBLIPOSTAGE);
  assert.equal(gradeS1(p).etat, 'tenue');
  const s2 = gradeS2(p);
  assert.equal(s2.etat, 'non-tenue');
  assert.deepEqual(s2.motifs[0].directives, ['style-src', 'img-src', 'font-src', 'connect-src', 'media-src']);
  const s3 = gradeS3(p, null);
  assert.equal(s3.etat, 'non-tenue');
  assert.deepEqual(s3.motifs[0], { code: 'appels-ouverts', directives: ['connect-src', 'img-src', 'font-src', 'media-src'], gravite: 'non-tenue' });
  assert.deepEqual(s3.motifs[1].hotes, ['player.vimeo.com', 'www.youtube-nocookie.com'], 'les deux cadres vidéo, dits ou non par l\'app');
  assert.equal(gradeS4(p).etat, 'tenue');
});

test('Form+ (page que GFS ouvre) : connect-src https: et img-src https: sont non tenus (S3), unpkg.com entier aussi (S4), pas de form-action (S2)', () => {
  const p = policies(FORM_WIDGET);
  const s3 = gradeS3(p, null);
  assert.equal(s3.etat, 'non-tenue');
  assert.deepEqual(s3.motifs.filter(motif => motif.code === 'source-large').map(motif => [motif.directive, motif.sources]), [['connect-src', ['https:']], ['img-src', ['https:']]]);
  const s4 = gradeS4(p);
  assert.equal(s4.etat, 'non-tenue');
  assert.deepEqual(s4.motifs[0], { code: 'source-large', directive: 'script-src', sources: ['https://unpkg.com'], gravite: 'non-tenue' });
  const s2 = gradeS2(p);
  assert.equal(s2.etat, 'a-noter');
  assert.deepEqual(s2.motifs.map(motif => motif.code), ['directive-absente', 'style-en-ligne']);
});

test('l\'exception dite : https: seul est « à noter » quand l\'app déclare le serveur Grist de la personne, jamais pour un joker ni pour une autre directive', () => {
  const p = policies("default-src 'none'; connect-src 'self' https:; img-src 'self' https:; font-src https:");
  const withGrist = gradeS3(p, { hosts: [], serveurGrist: true });
  assert.deepEqual(withGrist.motifs.map(motif => [motif.code, motif.directive, motif.gravite]),
    [['https-serveur-grist', 'connect-src', 'a-noter'], ['https-serveur-grist', 'img-src', 'a-noter'], ['source-large', 'font-src', 'non-tenue']]);
  assert.equal(gradeS3(policies("default-src 'none'; connect-src *"), { hosts: [], serveurGrist: true }).etat, 'non-tenue');
  assert.equal(gradeS3(p, { hosts: [], serveurGrist: false }).motifs.every(motif => motif.gravite === 'non-tenue'), true);
});

test('Grist-BI : sans politique, S1 est non tenue et S2 à S4 le disent', () => {
  const none = [];
  assert.deepEqual([gradeS1(none), gradeS2(none), gradeS3(none), gradeS4(none)].map(rule => [rule.etat, rule.motifs[0].code]), Array(4).fill(['non-tenue', 'aucune-politique']));
});

test('S4 : un script en ligne, un joker ou une origine entière ne tiennent pas ; une adresse sans version se note', () => {
  assert.equal(gradeS4(policies("script-src 'self' 'unsafe-inline'")).motifs[0].code, 'script-en-ligne');
  assert.equal(gradeS4(policies("script-src 'self' https://cdn.fr/")).motifs[0].code, 'source-large');
  assert.equal(gradeS4(policies("style-src 'self'")).motifs[0].code, 'scripts-ouverts', 'rien ne limite les scripts');
  assert.equal(gradeS4(policies("default-src 'none'")).etat, 'tenue', 'default-src \'none\' couvre les scripts');
  assert.equal(gradeS4(policies("script-src 'self'")).etat, 'tenue');
  const unversioned = gradeS4(policies(`script-src 'self' ${GRIST_API} https://cdn.fr/lib.js https://cdn.fr/lib@1.2.3/x.js`));
  assert.deepEqual([unversioned.etat, unversioned.motifs[0].code, unversioned.motifs[0].exemples], ['a-noter', 'sans-version', ['https://cdn.fr/lib.js']]);
});

test('readPage : les politiques (guillemets doubles ou simples, plusieurs balises), les scripts et feuilles externes avec leur empreinte, la carte d\'importation, les scripts en ligne', () => {
  const page = readPage(`<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'">
    <meta HTTP-EQUIV='content-security-policy' content='img-src "self"'>
    <script src="https://cdn.fr/a.js" integrity="sha384-x" crossorigin="anonymous"></script><script src="js/local.js"></script><script src="//cdn.fr/b.js"></script>
    <link rel="stylesheet" href="https://cdn.fr/c.css"><link rel="icon" href="https://cdn.fr/icone.png">
    <script type="importmap">{"imports":{"x":"https://esm.sh/x@1.0.0","y":"./local/y.js"},"scopes":{"https://z/":{"w":"https://esm.sh/w@2.0.0"}}}</script>
    <script>window.a = 1;</script><script type="module">import './x.js';</script></head>`);
  assert.deepEqual(page.politiques, [{ 'default-src': ["'none'"] }, { 'img-src': ['"self"'] }]);
  assert.deepEqual(page.ressources.map(resource => [resource.genre, resource.url, resource.empreinte]), [
    ['script', 'https://cdn.fr/a.js', true], ['script', 'https://cdn.fr/b.js', false], ['feuille', 'https://cdn.fr/c.css', false],
    ['carte', 'https://esm.sh/x@1.0.0', false], ['carte', 'https://esm.sh/w@2.0.0', false]]);
  assert.equal(page.enLigne, 2);
  assert.deepEqual(readPage(''), { politiques: [], ressources: [], enLigne: 0, relais: false });
});

test('scanCode : seulement les adresses des CDN connus, sans la ponctuation qui les suit ; une adresse de documentation n\'en est pas une', () => {
  const found = scanCode({ 'a.js': "import('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js'); // voir https://developer.mozilla.org/fr/docs",
    'b.js': 'const u = `https://esm.sh/@tiptap/core@3.31.3`; x("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js").then(); // https://unpkg.com/x@1.0.0.' });
  assert.deepEqual(found, ['https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js', 'https://esm.sh/@tiptap/core@3.31.3', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/x@1.0.0']);
});

test('parseState : les deux sections du GFS-ETAT.md (titre sans accent ni apostrophe typographique), « aucune », les états de la section Sécurité, la ligne du serveur Grist', () => {
  const state = parseState(`# GFS-ETAT : x\n\n## Adresses que l’app appelle\n- serveur Grist de la personne · connect · lire les pièces jointes · oui, après un geste\n- https://cdnjs.cloudflare.com/ajax/libs/x/1.0.0/x.js · connect · une police · non\n\n## Sécurité\n- S1 · tenue · ok\n- S3 · en cours, prévue le 20/11 · ferme les appels\n- S5 · non tenue · à faire\n- S9 · peut-être\n- S12 · tenue\n\n## Autre\n- S2 · tenue\n`);
  assert.deepEqual(state.adresses, ['cdnjs.cloudflare.com']);
  assert.equal(state.serveurGrist, true);
  assert.deepEqual(Object.entries(state.securite).map(([id, rule]) => [id, rule.etat]), [['S1', 'tenue'], ['S3', 'en-cours'], ['S5', 'non-tenue']]);
  assert.deepEqual(parseState('## Adresses que l\'app appelle\n- aucune\n').adresses, []);
  assert.deepEqual(parseState(null), { adresses: null, serveurGrist: false, securite: null }, 'une page sans les sections : rien d\'écrit, pas « aucune »');
});

test('S5 : l\'adresse non déclarée ne tient pas ; l\'API de Grist et ce que GFS sert ne se déclarent pas ; une adresse déclarée et introuvable se note ; sans déclaration, non vérifiable', () => {
  const page = readPage(html(`script-src 'self' ${GRIST_API} https://esm.sh/@tiptap/core@3.31.3 https://cdn.jsdelivr.net/npm/plotly.js-basic-dist-min@2.13.2/plotly-basic.min.js`,
    `<script src="${GRIST_API}"></script><script src="https://cdn.evil.fr/x.js"></script>`));
  const served = ['https://cdn.jsdelivr.net/npm/plotly.js-basic-dist-min@2.13.2/plotly-basic.min.js'];
  const declared = [{ id: 'tiptap', adresse: 'https://esm.sh/' }, { id: 'pdfmake', adresse: 'https://cdnjs.cloudflare.com/' }, { id: 'api', adresse: GRIST_API }];
  const result = gradeS5({ page, portees: declared, served });
  assert.equal(result.etat, 'non-tenue');
  assert.deepEqual(result.motifs.map(motif => [motif.code, motif.hotes || motif.nombre]), [['non-declaree', ['cdn.evil.fr']], ['non-retrouvee', ['cdnjs.cloudflare.com']], ['sans-empreinte', 1]]);
  assert.equal(gradeS5({ page, portees: undefined, served }).etat, 'non-verifiable');
  assert.equal(gradeS5({ page: readPage(html(AUTOMATION)), portees: [], served }).etat, 'tenue', 'aucune adresse trouvée, aucune déclarée');
});

test('S5 : une empreinte qui change chez un CDN qui sert un fichier figé (cdnjs, jsDelivr) ne tient pas ; chez un CDN qui reconstruit (esm.sh), elle se note', () => {
  const page = readPage(html(AUTOMATION));
  const result = gradeS5({ page, portees: [], changed: [{ url: 'https://cdnjs.cloudflare.com/a.js', immuable: true }, { url: 'https://esm.sh/b@1.0.0', immuable: false }] });
  assert.deepEqual(result.motifs.map(motif => [motif.code, motif.gravite, motif.immuable]), [['empreinte-changee', 'non-tenue', true], ['empreinte-changee', 'a-noter', false]]);
});

test('S7 et S9 : pas de dependabot.yml, un avis grave publié, un avis moindre, une lecture impossible ; un SECURITY.md', () => {
  assert.equal(gradeS7({ dependabot: true, advisories: [] }).etat, 'tenue');
  assert.equal(gradeS7({ dependabot: false, advisories: [] }).motifs[0].code, 'sans-dependabot');
  assert.equal(gradeS7({ dependabot: null, advisories: [] }).etat, 'non-verifiable');
  assert.deepEqual(gradeS7({ dependabot: true, advisories: [{ paquet: 'x', version: '1.0.0', niveau: 'critical', id: 'GHSA-1' }] }).etat, 'non-tenue');
  assert.deepEqual(gradeS7({ dependabot: true, advisories: [{ paquet: 'x', version: '1.0.0', niveau: 'moderate', id: 'GHSA-2' }] }).etat, 'a-noter');
  assert.equal(gradeS7({ dependabot: true, advisories: null }).etat, 'non-verifiable', 'sans le registre, on ne dit pas « tenue »');
  assert.deepEqual([true, false, null].map(value => gradeS9(value).etat), ['tenue', 'a-noter', 'non-verifiable']);
});

test('S8 : le relais des appels bloqués du kit se lit dans la page ou le code ; une page seule ne dit pas non ; le code lu sans relais est « à noter »', () => {
  const plain = readPage(html(AUTOMATION, `<script src="${GRIST_API}"></script>`));
  const relayed = readPage(html(AUTOMATION, `<script type="module" src="kit/js/violations-start.js"></script>`));
  assert.equal(plain.relais, false);
  assert.equal(relayed.relais, true);
  assert.deepEqual(gradeS8({ page: relayed }), { etat: 'tenue', motifs: [] });
  assert.equal(gradeS8({ page: plain }).motifs[0].code, 'relais-a-lusage', 'page seule : le module d\'entrée peut le démarrer');
  assert.equal(gradeS8({ page: plain }).etat, 'non-verifiable');
  assert.deepEqual(gradeS8({ page: plain, relayInCode: true }).etat, 'tenue');
  const missing = gradeS8({ page: plain, codeRead: true });
  assert.equal(missing.etat, 'a-noter', 'attendue, pas exigée (cahier 3.2.1)');
  assert.equal(missing.motifs[0].code, 'sans-relais');
  assert.equal(gradeS8({ page: null }).motifs[0].code, 'page-illisible');
  assert.equal(scanRelay({ 'a.js': "import { Violations } from './kit/js/violations.js'; Violations.start();" }), true);
  assert.equal(scanRelay({ 'a.js': 'createViolations({ link })' }), true);
  assert.equal(scanRelay({ 'a.js': "import { GfsLink } from './kit/js/gfs-link.js';" }), false);
  assert.equal(scanRelay({}), false);
});

test('gradeApp : neuf règles, S6 déclarée par l\'app, S8 « à l\'usage » tant que le code n\'est pas lu ; une page illisible rend S1 à S5 non vérifiables ; ce que l\'app dit se garde à côté', () => {
  const page = readPage(html(AUTOMATION, `<script src="${GRIST_API}"></script>`));
  const state = parseState('## Sécurité\n- S1 · tenue · ok\n');
  const graded = gradeApp({ page, portees: [], state, dependabot: true, securityMd: true, advisories: [] });
  assert.deepEqual(Object.keys(graded.regles), RULES);
  assert.deepEqual(RULES.map(rule => graded.regles[rule].etat), ['tenue', 'tenue', 'tenue', 'tenue', 'tenue', 'non-verifiable', 'tenue', 'non-verifiable', 'tenue']);
  assert.equal(graded.regles.S6.motifs[0].code, 'declaree');
  assert.deepEqual(graded.declaration, { S1: { etat: 'tenue', texte: 'tenue · ok' } });
  const unread = gradeApp({ page: null, dependabot: null, securityMd: null, advisories: null });
  assert.deepEqual(['S1', 'S2', 'S3', 'S4', 'S5'].map(rule => unread.regles[rule].motifs[0].code), Array(5).fill('page-illisible'));
  assert.equal(unread.permis, null);
});

// Un environnement de lecture fabriqué : deux apps, des pages, un GFS-ETAT.md, des empreintes qui changent d'un passage à l'autre.
function environment(over = {}) {
  const pages = { 'a/index.html': html(AUTOMATION, `<script src="${GRIST_API}"></script>`), 'b/index.html': html(FORM_WIDGET, '<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>') };
  const prints = { 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js': { sha384: 'sha384-AAA', octets: 100 } };
  return {
    apps: [{ id: 'a', repo: 'o/a', commit: 'c1', entree: 'index.html', portees: [] }, { id: 'b', repo: 'o/b', commit: 'c2', entree: 'index.html', portees: undefined }],
    now: '2026-11-18T10:00:00.000Z', origine: 'local', withFingerprints: true, withAdvisories: false, withCode: false, net: null, served: [],
    read: async (app, path, where) => (where === 'reference' ? pages[`${app.id}/${path}`] ?? null : where === 'etat' && app.id === 'a' ? '## Adresses que l\'app appelle\n- aucune\n' : null),
    exists: async (app, paths) => (paths[0].includes('dependabot') ? app.id === 'a' : null),
    fingerprint: async url => prints[url] || null, code: async () => ({ files: {}, lu: false }), ...over,
  };
}

test('controle : chaque app est lue à sa référence, jugée sur neuf règles, et l\'empreinte d\'un CDN est gardée avec son premier jour', async () => {
  const first = await controle(environment());
  assert.deepEqual(Object.keys(first.apps), ['a', 'b']);
  assert.equal(first.apps.a.regles.S3.etat, 'tenue');
  assert.equal(first.apps.a.regles.S7.etat, 'non-verifiable', 'dependabot lu, avis non demandés : on ne dit pas « tenue »');
  assert.equal(first.apps.b.regles.S3.etat, 'non-tenue');
  assert.deepEqual(first.apps.b.empreintes, [{ url: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', sha384: 'sha384-AAA', octets: 100, vu: '2026-11-18' }]);
  assert.deepEqual([first.apps.b.lecture.empreintes, first.apps.b.empreintesLe, first.apps.a.pages.politiques], [true, '2026-11-18', 1]);
  assert.deepEqual(checkSecurite(first, ['a', 'b']), []);
  // Une semaine plus tard : même empreinte (le premier jour reste), puis une empreinte différente chez unpkg (à noter : unpkg peut reconstruire).
  const second = await controle(environment({ now: '2026-11-25T10:00:00.000Z' }), first);
  assert.equal(second.apps.b.empreintes[0].vu, '2026-11-18');
  const changed = await controle(environment({ now: '2026-12-02T10:00:00.000Z', fingerprint: async () => ({ sha384: 'sha384-BBB', octets: 101 }) }), second);
  assert.equal(changed.apps.b.regles.S5.motifs.find(motif => motif.code === 'empreinte-changee').gravite, 'a-noter');
  assert.deepEqual([changed.apps.b.empreintes[0].sha384, changed.apps.b.empreintes[0].vu], ['sha384-BBB', '2026-12-02']);
});

test('controle : sans --empreintes, les empreintes du passage précédent restent, avec leur date', async () => {
  const first = await controle(environment());
  const second = await controle(environment({ withFingerprints: false, now: '2026-11-25T10:00:00.000Z' }), first);
  assert.deepEqual([second.apps.b.empreintes, second.apps.b.empreintesLe, second.apps.b.lecture.empreintes], [first.apps.b.empreintes, '2026-11-18', false]);
});

test('controle : une page introuvable rend les règles de page non vérifiables, jamais « tenue » ; le site en ligne qui diffère de la référence est dit', async () => {
  const missing = await controle(environment({ read: async () => null }));
  assert.equal(missing.apps.a.regles.S1.etat, 'non-verifiable');
  assert.deepEqual(missing.apps.a.enLigne, { lue: false });
  const live = await controle(environment({ read: async (app, path, where) => (where === 'live' ? html(FORM_WIDGET) : where === 'reference' && app.id === 'b' ? html(FORM_WIDGET) : html(AUTOMATION)) }));
  assert.deepEqual(live.apps.a.enLigne.identique, false, 'la page en ligne de a n\'a pas la politique de sa référence');
  assert.equal(live.apps.a.enLigne.regles.S3.etat, 'non-tenue');
  assert.deepEqual(live.apps.b.enLigne, { lue: true, identique: true });
});

test('checkSecurite : une app absente, une règle manquante ou un état inconnu sont refusés', () => {
  const rules = Object.fromEntries(RULES.map(rule => [rule, { etat: 'tenue', motifs: [] }]));
  const good = { contrat: 0, controle: '2026-11-18T10:00:00.000Z', apps: { a: { regles: rules } } };
  assert.deepEqual(checkSecurite(good, ['a']), []);
  assert.match(checkSecurite(good, ['a', 'b'])[0], /b : absente/);
  assert.match(checkSecurite({ ...good, apps: { a: { regles: { ...rules, S4: { etat: 'bof', motifs: [] } } } } }, ['a'])[0], /a S4/);
  assert.match(checkSecurite({ ...good, controle: 'hier' }, ['a'])[0], /date/);
  assert.equal(checkSecurite(null).length, 1);
});

test('fingerprintOf : seulement https, un CDN connu, sans joker ; trois redirections au plus, vers un CDN connu', async () => {
  const bytes = Buffer.from('contenu');
  const reply = (status, location) => ({ status, ok: status < 300, headers: { get: () => location }, arrayBuffer: async () => bytes });
  const calls = [];
  const fetchFn = async url => { calls.push(url); return url.includes('/vieux') ? reply(302, 'https://cdn.jsdelivr.net/npm/x@1.0.0/nouveau.js') : url.includes('/ailleurs') ? reply(302, 'https://evil.example/x.js') : reply(200); };
  const ok = await fingerprintOf('https://cdnjs.cloudflare.com/ajax/libs/x/1.0.0/x.js', fetchFn);
  assert.deepEqual([ok.octets, ok.sha384.startsWith('sha384-')], [7, true]);
  assert.equal((await fingerprintOf('https://unpkg.com/vieux', fetchFn)).octets, 7);
  assert.deepEqual(calls.slice(-2), ['https://unpkg.com/vieux', 'https://cdn.jsdelivr.net/npm/x@1.0.0/nouveau.js']);
  const before = calls.length;
  for (const url of ['http://unpkg.com/x.js', 'https://evil.example/x.js', 'https://esm.sh/*orderedmap@2.1.1', 'javascript:alert(1)', 'https://unpkg.com/ailleurs']) {
    assert.equal(await fingerprintOf(url, fetchFn), null, url);
  }
  assert.equal(calls.length - before, 1, 'seule la dernière, un CDN connu, est demandée ; sa redirection vers un autre hôte est refusée');
});

test('le fichier commité couvre le catalogue : neuf règles par app, chacune avec un état et des motifs', () => {
  const report = JSON.parse(readFileSync(join(ROOT, SECURITE_FILE), 'utf8'));
  assert.deepEqual(checkSecurite(report), []);
});

test('la tâche hebdomadaire : un lundi, les sous-modules lus, les empreintes recalculées, aucune action tierce, jamais de push dans une app', () => {
  const text = readFileSync(join(ROOT, '..', '.github/workflows/controle-securite.yml'), 'utf8');
  assert.match(text, /cron: '\d+ \d+ \* \* 1'/, 'une fois par semaine, le lundi');
  assert.match(text, /submodules: recursive/);
  assert.match(text, /controle-securite\.mjs --empreintes/);
  assert.match(text, /releve-dependances\.mjs/);
  const uses = [...text.matchAll(/^\s*- uses: (\S+)/gm)].map(match => match[1].split('@')[0]);
  assert.deepEqual(uses, ['actions/checkout', 'actions/setup-node'], 'seulement les actions de GitHub, comme essais.yml');
  assert.doesNotMatch(text, /git push[^\n]*(publipostage|FormPlus|GRIST_automation|Grist-BI|grist-factory)/i, 'rien ne part vers un dépôt d\'app');
  assert.match(text, /git push origin HEAD:main/, 'la date seule : un commit direct');
  assert.match(text, /gh pr create/, 'un vrai changement : une demande de fusion');
});

test('le code lu est celui que l\'app écrit : le dossier `kit/` de sa racine n\'en fait pas partie (S8 et S5 ne se lisent pas dans le kit de GFS), un autre dossier `kit` plus bas si', () => {
  const root = mkdtempSync(join(tmpdir(), 'gfs-walk-'));
  try {
    mkdirSync(join(root, 'kit', 'js'), { recursive: true });
    mkdirSync(join(root, 'kit', 'test'), { recursive: true });
    mkdirSync(join(root, 'js', 'kit'), { recursive: true });
    writeFileSync(join(root, 'kit', 'js', 'violations.js'), 'export function createViolations() {}');
    writeFileSync(join(root, 'kit', 'test', 'a.test.mjs'), "const x = 'https://cdn.jsdelivr.net/npm/exemple@1.0.0/x.js';");
    writeFileSync(join(root, 'js', 'gfs.js'), "import '../kit/js/gfs-link.js';");
    writeFileSync(join(root, 'js', 'kit', 'b.js'), 'export const b = 1;');
    writeFileSync(join(root, 'index.html'), '<html></html>');
    const files = Object.keys(walk(root)).map(path => path.slice(root.length + 1)).sort();
    assert.deepEqual(files, ['index.html', 'js/gfs.js', 'js/kit/b.js']);
    assert.equal(scanRelay(walk(root)), false, 'le relais du kit ne rend pas S8 « tenue » à une app qui ne le démarre pas');
    assert.deepEqual(scanCode(walk(root)), [], 'les adresses d\'exemple du kit ne rendent pas S5 « non tenue »');
    writeFileSync(join(root, 'js', 'gfs.js'), "import '../kit/js/violations-start.js';");
    assert.equal(scanRelay(walk(root)), true, 'le relais que l\'app démarre se lit dans son propre code');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
