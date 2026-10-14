// L'outil de versionnage (outils/versions.mjs) : ?v= des balises, carte d'importation, empreinte de la carte dans la politique de sécurité.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { version, cspHash, importMapText, applyVersions, staleItems, readFiles, ROOT } from '../outils/versions.mjs';

const PAGE = `<head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-eval' https://docs.getgrist.com/grist-plugin-api.js 'sha256-ancienne'; style-src 'self'">
<link rel="stylesheet" href="css/a.css?v=2">
<script src="js/router.js"></script>
<script type="importmap"></script>
<script type="module" src="js/main.js?v=3"></script>
</head>`;

const files = () => ({
  'css/a.css': Buffer.from('a{}'),
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
  assert.deepEqual(Object.keys(map.imports), ['./js/b.js', './js/dom.js']);
  assert.equal(map.imports['./js/dom.js'], `./js/dom.js?v=${version(Buffer.from('dom'))}`);
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
