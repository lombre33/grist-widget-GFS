// L'outil de versionnage (outils/versions.mjs) : ?v= des balises, carte d'importation, empreinte de la carte dans la politique de sécurité.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'acorn';
import { posix } from 'node:path';
import { version, cspHash, importMapText, applyVersions, staleItems, readFiles, readSideFiles, applySideVersions, staleSideItems, startupModules, ROOT } from '../outils/versions.mjs';

const PAGE = `<head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-eval' https://docs.getgrist.com/grist-plugin-api.js 'sha256-ancienne'; style-src 'self'">
<link rel="stylesheet" href="css/a.css?v=2">
<link rel="stylesheet" href="kit/css/k.css?v=2">
<script src="js/broker/router.js"></script>
<script type="importmap"></script>
<!-- préchargement -->
<!-- /préchargement -->
<script type="module" src="js/main.js?v=3"></script>
</head>`;

const files = () => ({
  'css/a.css': Buffer.from('a{}'),
  'kit/css/k.css': Buffer.from('k{}'),
  'kit/js/k.js': Buffer.from('kit'),
  'js/broker/router.js': Buffer.from('router'),
  'js/main.js': Buffer.from('main'),
  'js/ui/dom.js': Buffer.from('dom'),
  'js/b.js': Buffer.from('b'),
});

const inlineText = html => html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1];

test('version : dix caractères hexadécimaux, qui changent avec le contenu', () => {
  assert.match(version(Buffer.from('a')), /^[0-9a-f]{10}$/);
  assert.equal(version(Buffer.from('a')), version(Buffer.from('a')));
  assert.notEqual(version(Buffer.from('a')), version(Buffer.from('b')));
});

test('applyVersions : chaque balise locale porte l\'empreinte de son fichier', () => {
  const html = applyVersions(PAGE, files());
  assert.ok(html.includes(`href="css/a.css?v=${version(Buffer.from('a{}'))}"`));
  assert.ok(html.includes(`src="js/broker/router.js?v=${version(Buffer.from('router'))}"`));
  assert.ok(html.includes(`src="js/main.js?v=${version(Buffer.from('main'))}"`));
});

test('applyVersions : la carte versionne les modules importés, pas ceux que la page cite elle-même', () => {
  const map = JSON.parse(inlineText(applyVersions(PAGE, files())));
  assert.deepEqual(Object.keys(map.imports), ['./js/b.js', './js/ui/dom.js', './kit/js/k.js']);
  assert.equal(map.imports['./js/ui/dom.js'], `./js/ui/dom.js?v=${version(Buffer.from('dom'))}`);
});

test('applyVersions : le kit (sous-module) est versionné comme le reste : sa feuille dans sa balise, ses modules dans la carte', () => {
  const html = applyVersions(PAGE, files());
  assert.ok(html.includes(`href="kit/css/k.css?v=${version(Buffer.from('k{}'))}"`));
  const map = JSON.parse(inlineText(html));
  assert.equal(map.imports['./kit/js/k.js'], `./kit/js/k.js?v=${version(Buffer.from('kit'))}`);
  assert.throws(() => applyVersions(PAGE, { ...files(), 'kit/css/k.css': undefined }), /kit\/css\/k\.css, qui n'existe pas/);
  const advanced = { ...files(), 'kit/js/k.js': Buffer.from('kit avancé') };
  assert.match(staleItems(html, advanced).join('|'), /carte d'importation/);
});

test('readFiles : les dossiers du kit sont lus avec leur préfixe ; sans le sous-module, l\'erreur dit la commande à lancer', () => {
  const root = mkdtempSync(join(tmpdir(), 'gfs-versions-'));
  for (const folder of ['css', 'js']) mkdirSync(join(root, folder));
  assert.throws(() => readFiles(root), /git submodule update --init prototype\/kit/);
  const real = readFiles();
  assert.ok(Object.keys(real).some(path => /^kit\/js\/[a-z-]+\.js$/.test(path)) && Object.keys(real).some(path => /^kit\/css\/[a-z-]+\.css$/.test(path)));
  const paths = Object.keys(real);
  const engine = paths.filter(path => path.startsWith('kit/js/synchro/'));
  assert.ok(engine.length > 20 && engine.every(path => path.endsWith('.js')), 'le moteur de partage descend dans ses sous-dossiers');
  assert.ok(engine.includes('kit/js/synchro/logic/common.js') && real['kit/js/synchro/port.js'], 'le moteur de partage est lu avec ses sous-dossiers');
  // Les modules de GFS sont rangés par sujet (js/broker/…) : un dossier de profondeur, sauf l'entrée et le contrôleur, à la racine.
  const own = paths.filter(path => path.startsWith('js/'));
  assert.ok(own.length > 100 && own.every(path => /^js\/(?:[a-z0-9]+\/)?[a-z0-9-]+\.js$/.test(path)), `les modules de js/ : un sous-dossier au plus (${own.filter(path => !/^js\/(?:[a-z0-9]+\/)?[a-z0-9-]+\.js$/.test(path)).slice(0, 3)})`);
  assert.ok(real['js/gfs.js'] && real['js/controller.js'] && real['js/broker/router.js'] && real['js/ui/modal.js'], 'l\'entrée et le contrôleur sont à la racine, les autres modules dans leur dossier');
  assert.ok(paths.filter(path => !path.startsWith('js/') && !engine.includes(path)).every(path => /^(?:kit\/)?(?:css|js)\/[^/]+\.(?:css|js)$/.test(path)) && !paths.some(path => path.startsWith('kit/js/calendrier/')), 'les autres dossiers sont lus à plat, sans le calendrier du kit');
});

test('applyVersions : l\'empreinte de la politique est celle du texte exact de la carte, et remplace l\'ancienne', () => {
  const html = applyVersions(PAGE, files());
  const want = `'sha256-${createHash('sha256').update(inlineText(html), 'utf8').digest('base64')}'`;
  const policy = html.match(/content="([^"]*)"/)[1];
  assert.ok(policy.includes(`script-src 'self' 'unsafe-eval' https://docs.getgrist.com/grist-plugin-api.js ${want};`), policy);
  assert.ok(!policy.includes('ancienne'));
  assert.equal(cspHash(inlineText(html)), want);
});

test('applyVersions : sans empreinte au départ, elle s\'ajoute à script-src seulement ; relancée, rien ne change', () => {
  const bare = PAGE.replace(" 'sha256-ancienne'", '');
  const once = applyVersions(bare, files());
  assert.equal(once.match(/'sha256-/g).length, 1);
  assert.ok(once.includes("style-src 'self'"));
  assert.equal(applyVersions(once, files()), once);
});

test('staleItems : un fichier modifié, une balise sans ?v= et une carte vieillie sont nommés ; à jour, la liste est vide', () => {
  const current = applyVersions(PAGE, files());
  assert.deepEqual(staleItems(current, files()), []);

  const changed = { ...files(), 'js/ui/dom.js': Buffer.from('dom modifié') };
  assert.match(staleItems(current, changed).join('|'), /carte d'importation/);

  const edited = { ...files(), 'css/a.css': Buffer.from('a{color:red}') };
  assert.match(staleItems(current, edited).join('|'), /css\/a\.css : \?v=[0-9a-f]{10} au lieu de \?v=[0-9a-f]{10}/);

  assert.match(staleItems(current.replace(/(href="css\/a\.css)\?v=[^"]*"/, '$1"'), files()).join('|'), /\(absente\)/);
  assert.match(staleItems(current.replace(/'sha256-[^']*'/, "'sha256-faux'"), files()).join('|'), /empreinte de la carte/);
});

test('applyVersions : une balise vers un fichier absent, une page sans carte ou sans politique, sont refusées', () => {
  assert.throws(() => applyVersions(PAGE, { ...files(), 'js/main.js': undefined }), /js\/main\.js, qui n'existe pas/);
  assert.throws(() => applyVersions(PAGE.replace('<script type="importmap"></script>', ''), files()), /importmap/);
  assert.throws(() => applyVersions(PAGE.replace(/<meta [^>]*>/, ''), files()), /politique de sécurité/);
  assert.throws(() => applyVersions(PAGE.replace('<!-- préchargement -->\n<!-- /préchargement -->\n', ''), files()), /préchargement/);
});

// Le graphe d'un chemin de démarrage : main importe a (en plusieurs lignes) et side ; a importe deep et le kit (`export … from`) ; deep revient sur main (un cycle) ;
// main ne cite lazy que par `import()`, et des adresses nues ou externes.
const graph = () => ({
  ...files(),
  'js/main.js': Buffer.from("import { a } from './a.js';\nimport './side.js';\n// import z from './commente.js';\nconst lazy = () => import('./lazy.js');\nimport x from 'bare';\nimport y from 'https://exemple.fr/y.js';\n"),
  'js/a.js': Buffer.from("import {\n  c,\n  d,\n} from './deep.js';\nexport { e } from '../kit/js/k.js';\n"),
  'js/side.js': Buffer.from(''),
  'js/deep.js': Buffer.from("import './main.js';\n"),
  'js/lazy.js': Buffer.from('lazy'),
  'js/commente.js': Buffer.from('commente'),
});

test('startupModules : les imports statiques de proche en proche, du plus proche au plus loin ; ni les imports dynamiques, ni les commentaires, ni les adresses nues ou externes, ni l\'entrée (même dans un cycle)', () => {
  assert.deepEqual(startupModules(graph(), 'js/main.js'), ['js/a.js', 'js/side.js', 'js/deep.js', 'kit/js/k.js']);
  assert.deepEqual(startupModules(graph(), 'js/main.js', ['js/side.js']), ['js/a.js', 'js/deep.js', 'kit/js/k.js'], 'un fichier que la page cite elle-même n\'est pas préchargé, mais ses imports le sont');
  assert.deepEqual(startupModules(graph(), null), []);
  assert.deepEqual(startupModules(graph(), 'js/absent.js'), []);
});

const blockOf = html => html.match(/<!-- préchargement -->([\s\S]*?)<!-- \/préchargement -->/)[1];
const mapOf = html => JSON.parse(inlineText(html)).imports;

test('applyVersions : le bloc de préchargement a un lien par module du chemin de démarrage, à l\'adresse que la carte donne, après la carte et avant le script d\'entrée', () => {
  const html = applyVersions(PAGE, graph());
  const map = mapOf(html);
  const hrefs = [...blockOf(html).matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map(match => match[1]);
  assert.deepEqual(hrefs.map(href => href.split('?')[0]), ['./js/a.js', './js/side.js', './js/deep.js', './kit/js/k.js']);
  for (const href of hrefs) assert.equal(href, map[href.split('?')[0]], 'même adresse que la carte : le module préchargé est celui que la page demandera');
  assert.ok(!hrefs.some(href => /main\.js|router\.js|lazy\.js/.test(href)), 'ni l\'entrée, ni un fichier cité par une balise, ni un module qu\'aucun import statique n\'atteint');
  assert.ok(html.indexOf('</script>') < html.indexOf('<!-- préchargement -->') && html.indexOf('<!-- /préchargement -->') < html.indexOf('type="module"'));
  assert.equal(applyVersions(html, graph()), html, 'relancé, rien ne change');
  assert.deepEqual(staleItems(html, graph()), []);
});

test('staleItems : un nouvel import statique sur le chemin de démarrage périme les liens ; un module que seul un import dynamique atteint ne touche que la carte', () => {
  const current = applyVersions(PAGE, graph());
  const grown = { ...graph(), 'js/side.js': Buffer.from("import './nouveau.js';\n"), 'js/nouveau.js': Buffer.from('nouveau') };
  assert.match(staleItems(current, grown).join('|'), /liens de préchargement/);
  const lazyOnly = { ...graph(), 'js/lazy.js': Buffer.from('lazy modifié') };
  const stale = staleItems(current, lazyOnly).join('|');
  assert.match(stale, /carte d'importation/);
  assert.doesNotMatch(stale, /préchargement/);
  assert.match(staleItems(current.replace(/<link rel="modulepreload"[^>]*js\/deep\.js[^>]*>\n/, ''), graph()).join('|'), /liens de préchargement/, 'un lien retiré à la main est signalé');
});

test('index.html du prototype : les liens de préchargement sont les modules que le script d\'entrée atteint, comptés par un vrai analyseur, chacun à l\'adresse de la carte', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const all = readFiles();
  const seen = new Set(['js/gfs.js']);
  for (let queue = ['js/gfs.js']; queue.length;) {
    const next = [];
    for (const from of queue) {
      for (const node of parse(all[from].toString('utf8'), { ecmaVersion: 'latest', sourceType: 'module' }).body) {
        const source = node.source && node.source.value;
        if (!source || !source.startsWith('.')) continue;
        const path = posix.join(posix.dirname(from), source);
        if (!seen.has(path) && all[path]) { seen.add(path); next.push(path); }
      }
    }
    queue = next;
  }
  seen.delete('js/gfs.js');
  const hrefs = [...blockOf(html).matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map(match => match[1]);
  assert.deepEqual(hrefs.map(href => href.slice(2).split('?')[0]).sort(), [...seen].sort());
  const map = mapOf(html);
  for (const href of hrefs) assert.equal(href, map[href.split('?')[0]], href);
  assert.ok(hrefs.length > 100, 'le chemin de démarrage de GFS compte plus de cent modules');
  assert.ok(html.indexOf('</script>') < html.indexOf('<!-- préchargement -->'), 'les liens viennent après la carte d\'importation (avant elle, Firefox l\'ignore)');
});

test('importMapText : stable, trié, deux espaces d\'indentation, un retour à la ligne avant et après', () => {
  const text = importMapText(files(), ['js/broker/router.js', 'js/main.js']);
  assert.ok(text.startsWith('\n{\n  "imports": {\n    "./js/b.js"'));
  assert.ok(text.endsWith('}\n}\n'));
});

test('index.html du prototype est à jour : ?v=, carte d\'importation et empreinte (sinon : node outils/versions.mjs)', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.deepEqual(staleItems(html, readFiles()), []);
});

const SIDE = '<script src="transfer.js"></script>\n<script src="https://exemple.fr/x.js"></script>';

test('applySideVersions : le script voisin d\'une page porte son empreinte, relancée la page ne change plus ; un script absent est refusé', () => {
  const side = { 'transfer.js': Buffer.from('envoi') };
  const html = applySideVersions(SIDE, side);
  assert.ok(html.includes(`src="transfer.js?v=${version(Buffer.from('envoi'))}"`));
  assert.ok(html.includes('src="https://exemple.fr/x.js"'), 'une adresse externe n\'est pas touchée');
  assert.equal(applySideVersions(html, side), html);
  assert.throws(() => applySideVersions(SIDE, {}), /transfer\.js, qui n'existe pas/);
});

test('staleSideItems : un script modifié ou une balise sans ?v= sont nommés ; à jour, la liste est vide', () => {
  const side = { 'transfer.js': Buffer.from('envoi') };
  const current = applySideVersions(SIDE, side);
  assert.deepEqual(staleSideItems(current, side), []);
  assert.match(staleSideItems(current, { 'transfer.js': Buffer.from('autre') }).join('|'), /transfer\.js : \?v=[0-9a-f]{10} au lieu de \?v=[0-9a-f]{10}/);
  assert.match(staleSideItems(SIDE, side).join('|'), /\(absente\)/);
});

test('transfer/index.html est à jour : le ?v= de transfer.js (sinon : node outils/versions.mjs)', () => {
  const html = readFileSync(join(ROOT, 'transfer/index.html'), 'utf8');
  assert.deepEqual(staleSideItems(html, readSideFiles('transfer')), []);
});
