// Le petit dépôt des fichiers CDN (outils/depot-cdn.mjs) : ce qu'il range, ce qu'il refuse, et que son contenu est celui du catalogue de GFS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, integrity } from '../outils/bibliotheques.mjs';
import { buildCdnRepo, filesToServe, pushSteps, DEFAULT_DEPOT } from '../outils/depot-cdn.mjs';

const TMP = mkdtempSync(join(tmpdir(), 'gfs-depot-cdn-'));
test.after(() => rmSync(TMP, { recursive: true, force: true }));
let counter = 0;
const fresh = () => { const dir = join(TMP, String(counter++)); mkdirSync(dir, { recursive: true }); return dir; };
const files = dir => readdirSync(dir, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile()).map(entry => join(entry.parentPath, entry.name).slice(dir.length + 1)).sort();

test('le catalogue de GFS : l\'écriture en direct (et ses licences) est à servir, pdf.js sans CDN n\'y est pas', () => {
  const catalogue = JSON.parse(readFileSync(join(ROOT, 'bibliotheques/catalogue.json'), 'utf8'));
  const served = filesToServe(catalogue, ROOT);
  assert.deepEqual(served.map(file => file.chemin), ['vendor/edition-live/1.0.0/edition-live.js', 'vendor/edition-live/1.0.0/LICENCES.txt']);
  assert.ok(!served.some(file => file.chemin.includes('pdfjs')), 'une bibliothèque sansCdn n\'a rien à faire dans ce dépôt');
});

test('le dossier du petit dépôt : la licence, le mode d\'emploi, les fichiers au même chemin que dans GFS, octet pour octet, avec leurs empreintes', () => {
  const target = fresh();
  const written = buildCdnRepo(ROOT, target);
  assert.deepEqual(files(target), [...written].sort());
  assert.deepEqual(written, ['LICENSE', 'LISEZ-MOI.md', 'vendor/edition-live/1.0.0/edition-live.js', 'vendor/edition-live/1.0.0/LICENCES.txt']);
  const copy = readFileSync(join(ROOT, 'vendor/edition-live/1.0.0/edition-live.js'));
  assert.ok(readFileSync(join(target, 'vendor/edition-live/1.0.0/edition-live.js')).equals(copy), 'le même fichier : une seule empreinte vaut pour GFS, le CDN et la copie');
  assert.ok(readFileSync(join(target, 'LICENSE')).equals(readFileSync(join(ROOT, '..', 'LICENSE'))));
  const readme = readFileSync(join(target, 'LISEZ-MOI.md'), 'utf8');
  assert.match(readme, new RegExp(integrity(copy).replace(/[+/]/g, '\\$&')), 'l\'empreinte est dans le mode d\'emploi');
  assert.match(readme, /https:\/\/cdn\.jsdelivr\.net\/gh\/grist-factory\/gfs-bibliotheques@<commit complet>\//);
  assert.doesNotMatch(readme, /lombre33/, 'aucun compte personnel dans un dépôt public');
});

test('buildCdnRepo : un dossier qui contient autre chose est refusé, un dépôt déjà fabriqué ici se met à jour', () => {
  const foreign = fresh();
  writeFileSync(join(foreign, 'notes.txt'), 'à moi');
  assert.throws(() => buildCdnRepo(ROOT, foreign), /contient autre chose que ce dépôt \(notes\.txt\)/);
  assert.equal(readFileSync(join(foreign, 'notes.txt'), 'utf8'), 'à moi', 'rien n\'est écrasé ni écrit');
  assert.ok(!existsSync(join(foreign, 'vendor')));

  const again = fresh();
  mkdirSync(join(again, '.git'));
  buildCdnRepo(ROOT, again);
  buildCdnRepo(ROOT, again, 'autre/depot');
  assert.match(readFileSync(join(again, 'LISEZ-MOI.md'), 'utf8'), /autre\/depot@<commit complet>/, 'refait avec le nom donné');
});

test('buildCdnRepo : une copie qui n\'est plus celle du catalogue arrête tout, avant d\'avoir écrit le moindre fichier', () => {
  const root = fresh();
  const proto = join(root, 'prototype');
  mkdirSync(join(proto, 'bibliotheques'), { recursive: true });
  mkdirSync(join(proto, 'vendor/x/1.0.0'), { recursive: true });
  writeFileSync(join(root, 'LICENSE'), 'GPL');
  writeFileSync(join(proto, 'vendor/x/1.0.0/x.js'), 'export const x = 2;');
  const entry = { id: 'x', version: '1.0.0', forme: 'module', cdn: { src: 'https://cdn.jsdelivr.net/gh/a/b@' + 'a'.repeat(40) + '/vendor/x/1.0.0/x.js', integrite: 'sha384-x' }, vendorise: { chemin: 'vendor/x/1.0.0/x.js', integrite: integrity(Buffer.from('export const x = 1;')) } };
  writeFileSync(join(proto, 'bibliotheques/catalogue.json'), JSON.stringify({ bibliotheques: [entry] }));
  const target = fresh();
  assert.throws(() => buildCdnRepo(proto, target), /vendor\/x\/1\.0\.0\/x\.js : l'empreinte de la copie n'est pas celle du catalogue/);
  assert.deepEqual(readdirSync(target), [], 'rien n\'est écrit');
  entry.cdn = null;
  writeFileSync(join(proto, 'bibliotheques/catalogue.json'), JSON.stringify({ bibliotheques: [entry] }));
  assert.throws(() => buildCdnRepo(proto, target), /aucun fichier assemblé à servir par CDN/);
});

test('pushSteps : la première fois init et remote, ensuite seulement add, commit, push ; le dernier mot donne le commit complet', () => {
  const first = fresh();
  assert.deepEqual(pushSteps(first, DEFAULT_DEPOT), [`cd ${first}`, 'git init -b main', `git remote add origin https://github.com/${DEFAULT_DEPOT}.git`, 'git add -A',
    'git commit -m "Fichiers servis par CDN pour GFS"', 'git push -u origin main', 'git rev-parse HEAD']);
  mkdirSync(join(first, '.git'));
  const later = pushSteps(first, DEFAULT_DEPOT);
  assert.ok(!later.includes('git init -b main') && later.at(-1) === 'git rev-parse HEAD');
});
