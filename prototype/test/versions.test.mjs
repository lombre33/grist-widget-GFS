// L'outil de versionnage (outils/versions.mjs) : ?v= des balises, carte d'importation, empreinte de la carte dans la politique de sécurité.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { version, cspHash, importMapText, applyVersions, staleItems, readFiles, readSideFiles, applySideVersions, staleSideItems, ROOT } from '../outils/versions.mjs';

const PAGE = `<head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-eval' https://docs.getgrist.com/grist-plugin-api.js 'sha256-ancienne'; style-src 'self'">
<link rel="stylesheet" href="css/a.css?v=2">
<link rel="stylesheet" href="kit/css/k.css?v=2">
<script src="js/router.js"></script>
<script type="importmap"></script>
<script type="module" src="js/main.js?v=3"></script>
</head>`;

const files = () => ({
  'css/a.css': Buffer.from('a{}'),
  'kit/css/k.css': Buffer.from('k{}'),
  'kit/js/k.js': Buffer.from('kit'),
  'js/router.js': Buffer.from('router'),
  'js/main.js': Buffer.from('main'),
  'js/dom.js': Buffer.from('dom'),
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
  assert.ok(html.includes(`src="js/router.js?v=${version(Buffer.from('router'))}"`));
  assert.ok(html.includes(`src="js/main.js?v=${version(Buffer.from('main'))}"`));
});

test('applyVersions : la carte versionne les modules importés, pas ceux que la page cite elle-même', () => {
  const map = JSON.parse(inlineText(applyVersions(PAGE, files())));
  assert.deepEqual(Object.keys(map.imports), ['./js/b.js', './js/dom.js', './kit/js/k.js']);
  assert.equal(map.imports['./js/dom.js'], `./js/dom.js?v=${version(Buffer.from('dom'))}`);
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
  const nested = Object.keys(real).filter(path => path.split('/').length > (path.startsWith('kit/') ? 3 : 2));
  assert.ok(nested.length > 20 && nested.every(path => path.startsWith('kit/js/synchro/') && path.endsWith('.js')), `seul le moteur de partage descend dans ses sous-dossiers : ${nested.slice(0, 3)}`);
  assert.ok(nested.includes('kit/js/synchro/logic/common.js') && real['kit/js/synchro/port.js'], 'le moteur de partage est lu avec ses sous-dossiers');
  assert.ok(Object.keys(real).filter(path => !nested.includes(path)).every(path => /^(?:kit\/)?(?:css|js)\/[^/]+\.(?:css|js)$/.test(path)) && !Object.keys(real).some(path => path.startsWith('kit/js/calendrier/')), 'premier niveau de chaque autre dossier seulement');
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

  const changed = { ...files(), 'js/dom.js': Buffer.from('dom modifié') };
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
});

test('importMapText : stable, trié, deux espaces d\'indentation, un retour à la ligne avant et après', () => {
  const text = importMapText(files(), ['js/router.js', 'js/main.js']);
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
