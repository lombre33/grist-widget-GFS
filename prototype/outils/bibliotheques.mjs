// L'outil des bibliothèques d'extensions (contrats 2.6, point 6) : d'après la liste de GFS (bibliotheques/package.json), il tire de chaque paquet
// le fichier à servir, en calcule l'empreinte (sha384, comme `integrity`), en garde la copie vendorisée (vendor/<id>/<version>/<fichier>) et
// écrit le catalogue (bibliotheques/catalogue.json) que GFS lit. Les fichiers générés sont commités : aucune étape de construction pour servir.
// Une bibliothèque de la liste est soit le fichier d'un paquet (`paquet`, `fichier`), soit un fichier assemblé par GFS (`assemble`, points 8 à 11 :
// outils/assemblage.mjs ; elle demande esbuild, épinglé dans package.json, donc `npm ci` dans prototype/ avant de lancer l'outil).
//
//   node outils/bibliotheques.mjs                       tire les paquets (npm pack) et écrit le catalogue et la copie vendorisée
//   node outils/bibliotheques.mjs --paquets <dossier>   idem, depuis des archives <paquet>-<version>.tgz déjà téléchargées (hors ligne)
//   node outils/bibliotheques.mjs --verifier            relit les fichiers commités, sans réseau : empreintes, versions exactes, cohérence
//   node outils/bibliotheques.mjs --verifier-cdn        compare l'empreinte du catalogue au fichier que le CDN sert vraiment (réseau)
//
// Le CDN est jsDelivr, qui sert le fichier du paquet octet pour octet : une seule empreinte vaut pour le CDN et pour la copie vendorisée.
// Un fichier assemblé n'a pas de CDN (`cdn: null`) tant que GFS n'a pas d'adresse publique (cahier, question 5) : la copie de GFS est son seul mode.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { EXACT_VERSION_RE } from '../js/manifest.js';
import { readAssembly, assembleFile, licencesText, registeredProblems, assembledPath, licencesPath, sameSet } from './assemblage.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CDN_BASE = 'https://cdn.jsdelivr.net/npm';

export const integrity = bytes => `sha384-${createHash('sha384').update(bytes).digest('base64')}`;

// La liste de GFS : [{ id, paquet, version, fichier }] pour le fichier d'un paquet, [{ id, forme: 'module', version, paquets, modules, externes, alias }]
// pour un fichier assemblé. Versions exactes seulement.
export function readList(packageJson) {
  const deps = packageJson.dependencies || {};
  const declared = (packageJson.gfs && packageJson.gfs.bibliotheques) || {};
  return Object.entries(declared).map(([id, spec]) => (spec.assemble ? readAssembly(id, spec, deps) : readPackageFile(id, spec, deps)));
}

function readPackageFile(id, spec, deps) {
  const version = deps[spec.paquet];
  if (!EXACT_VERSION_RE.test(version || '')) throw new Error(`${id} : la version de ${spec.paquet} doit être exacte (reçu : ${version})`);
  if (!spec.fichier || spec.fichier.includes('..') || spec.fichier.startsWith('/')) throw new Error(`${id} : fichier hors du paquet`);
  return { id, paquet: spec.paquet, version, fichier: spec.fichier };
}

// L'entrée du catalogue d'une bibliothèque, d'après les octets du fichier du paquet.
export function buildEntry({ id, paquet, version, fichier }, bytes) {
  const sri = integrity(bytes);
  return {
    id,
    version,
    poids: bytes.length,
    cdn: { src: `${CDN_BASE}/${paquet}@${version}/${fichier}`, integrite: sri },
    vendorise: { chemin: `vendor/${id}/${version}/${fichier}`, integrite: sri },
  };
}

// L'entrée du catalogue d'un fichier assemblé (2.6, point 8) : ce qu'il contient, ce qu'il range, ce qu'il laisse à l'app, et la copie de GFS.
export function buildAssembledEntry(item, bytes) {
  return {
    id: item.id,
    version: item.version,
    forme: 'module',
    poids: bytes.length,
    contient: item.paquets.map(({ paquet, version }) => ({ paquet, version })),
    modules: [...item.modules],
    externes: [...item.externes],
    cdn: null,
    vendorise: { chemin: assembledPath(item), integrite: integrity(bytes) },
  };
}

// Ce que le catalogue dit d'un fichier assemblé doit être exactement ce que la liste déclare.
function assembledProblems(item, entry, read) {
  const found = [];
  if (entry.forme !== 'module') found.push(`${item.id} : forme « module » attendue`);
  if (entry.cdn !== null) found.push(`${item.id} : un fichier assemblé n'a pas de CDN tant que GFS n'a pas d'adresse publique (cdn: null)`);
  if (entry.vendorise.chemin !== assembledPath(item)) found.push(`${item.id} : chemin de la copie inattendu (${entry.vendorise.chemin})`);
  const contient = (entry.contient || []).map(({ paquet, version }) => `${paquet}@${version}`);
  if (!sameSet(contient, item.paquets.map(({ paquet, version }) => `${paquet}@${version}`))) found.push(`${item.id} : « contient » du catalogue n'est pas celui de la liste`);
  if (!sameSet(entry.modules || [], item.modules)) found.push(`${item.id} : « modules » du catalogue n'est pas celui de la liste`);
  if (!sameSet(entry.externes || [], item.externes)) found.push(`${item.id} : « externes » du catalogue n'est pas celui de la liste`);
  try {
    const licences = read(licencesPath(item)).toString('utf8');
    for (const { paquet, version } of item.paquets) if (!licences.includes(`${paquet}@${version}`)) found.push(`${item.id} : ${licencesPath(item)} ne porte pas la licence de ${paquet}@${version}`);
  } catch (error) { found.push(`${item.id} : licences illisibles (${licencesPath(item)})`); }
  return found;
}

function scriptProblems(item, entry) {
  if (entry.forme === 'module') return [`${item.id} : le catalogue dit « module », la liste donne le fichier d'un paquet`];
  if (!entry.cdn) return [`${item.id} : adresse du CDN absente`];
  const found = [];
  if (entry.cdn.src !== `${CDN_BASE}/${item.paquet}@${item.version}/${item.fichier}`) found.push(`${item.id} : adresse du CDN inattendue`);
  if (entry.cdn.integrite !== entry.vendorise.integrite) found.push(`${item.id} : le CDN et la copie vendorisée doivent porter la même empreinte`);
  return found;
}

// Les écarts de la copie vendorisée d'une entrée : lisible, de la bonne empreinte et du bon poids ; un fichier assemblé range bien ses modules.
function copyProblems(item, entry, read) {
  let bytes;
  try { bytes = read(entry.vendorise.chemin); } catch (error) { return [`${item.id} : copie vendorisée illisible (${entry.vendorise.chemin})`]; }
  const found = [];
  if (integrity(bytes) !== entry.vendorise.integrite) found.push(`${item.id} : l'empreinte de ${entry.vendorise.chemin} ne correspond pas au catalogue`);
  if (entry.poids !== bytes.length) found.push(`${item.id} : le poids du catalogue (${entry.poids}) n'est pas celui du fichier (${bytes.length})`);
  if (item.forme === 'module') found.push(...registeredProblems(item, bytes));
  return found;
}

// Relit les fichiers commités : l'empreinte de chaque copie vendorisée est celle du catalogue, et le CDN et la copie portent la même.
// `read(chemin)` rend les octets d'un chemin relatif à prototype/. Rend la liste des écarts (vide : tout est cohérent).
export function checkFiles(catalogue, list, read) {
  const problems = [];
  const entries = catalogue.bibliotheques || [];
  for (const item of list) {
    const entry = entries.find(e => e.id === item.id && e.version === item.version);
    if (!entry) problems.push(`${item.id}@${item.version} : absent du catalogue`);
    else if (!entry.vendorise || typeof entry.vendorise.chemin !== 'string') problems.push(`${item.id} : copie vendorisée absente du catalogue`);
    else problems.push(...(item.forme === 'module' ? assembledProblems(item, entry, read) : scriptProblems(item, entry)), ...copyProblems(item, entry, read));
  }
  for (const entry of entries) {
    if (!list.some(item => item.id === entry.id && item.version === entry.version)) problems.push(`${entry.id}@${entry.version} : dans le catalogue mais plus dans la liste`);
  }
  return problems;
}

// Compare au CDN réel. `fetchBytes(url)` rend les octets (injecté : le réseau n'est pas toujours là). Une entrée sans CDN n'a rien à comparer.
export async function checkCdn(catalogue, fetchBytes) {
  const problems = [];
  for (const entry of (catalogue.bibliotheques || []).filter(candidate => candidate.cdn)) {
    try {
      const got = integrity(await fetchBytes(entry.cdn.src));
      if (got !== entry.cdn.integrite) problems.push(`${entry.id} : le CDN sert un fichier d'empreinte ${got}, le catalogue dit ${entry.cdn.integrite}`);
    } catch (error) { problems.push(`${entry.id} : le CDN n'a pas répondu (${error.message})`); }
  }
  return problems;
}

// Le nom que `npm pack` donne à l'archive d'un paquet : `@portee/nom` devient `portee-nom`.
export const archiveName = (paquet, version) => `${paquet.replace(/^@/, '').replace('/', '-')}-${version}.tgz`;

// L'archive d'un paquet : celle du dossier hors ligne si elle y est, sinon `npm pack` (qui vérifie l'intégrité donnée par le registre).
function archiveOf(paquet, version, packagesDir, workDir) {
  const archive = packagesDir ? join(packagesDir, archiveName(paquet, version)) : null;
  if (archive && existsSync(archive)) return archive;
  const out = execFileSync('npm', ['pack', `${paquet}@${version}`, '--silent', '--pack-destination', workDir], { encoding: 'utf8' }).trim().split('\n').pop();
  return join(workDir, out);
}

function packBytes(item, packagesDir, workDir) {
  const file = archiveOf(item.paquet, item.version, packagesDir, workDir);
  execFileSync('tar', ['-xzf', file, '-C', workDir, `package/${item.fichier}`]);
  return readFileSync(join(workDir, 'package', item.fichier));
}

// Pose chaque paquet de la liste dans `<workDir>/node_modules/<paquet>` : exactement ces paquets, aucun autre (la liste dit tout ce qui entre dans le fichier).
function unpackPackages(item, packagesDir, workDir) {
  for (const { paquet, version } of item.paquets) {
    const target = join(workDir, 'node_modules', ...paquet.split('/'));
    mkdirSync(target, { recursive: true });
    execFileSync('tar', ['-xzf', archiveOf(paquet, version, packagesDir, workDir), '-C', target, '--strip-components=1']);
  }
}

async function loadEsbuild() {
  try { return await import('esbuild'); } catch (error) { throw new Error('esbuild n\'est pas installé : lancer « npm ci » dans prototype/ (il est épinglé dans package.json)'); }
}

function writeVendored(root, chemin, bytes) {
  const target = join(root, chemin);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, bytes);
}

async function generateAssembled(root, item, packagesDir, work, log) {
  const dir = join(work, item.id);
  unpackPackages(item, packagesDir, dir);
  const { bytes, problems } = await assembleFile(item, dir, await loadEsbuild());
  const licences = licencesText(item, dir);
  problems.push(...licences.problems);
  if (problems.length) throw new Error(`${item.id} : le fichier n'est pas ce que la liste dit :\n  - ${problems.join('\n  - ')}`);
  const entry = buildAssembledEntry(item, bytes);
  writeVendored(root, entry.vendorise.chemin, bytes);
  writeVendored(root, licencesPath(item), licences.text);
  log(`${item.id}@${item.version} (assemblé) : ${bytes.length} octets, ${entry.vendorise.integrite}\n`);
  return entry;
}

function generateScript(root, item, packagesDir, work, log) {
  const bytes = packBytes(item, packagesDir, work);
  const entry = buildEntry(item, bytes);
  writeVendored(root, entry.vendorise.chemin, bytes);
  log(`${item.id}@${item.version} : ${bytes.length} octets, ${entry.cdn.integrite}\n`);
  return entry;
}

const readRootList = root => readList(JSON.parse(readFileSync(join(root, 'bibliotheques/package.json'), 'utf8')));

// Écrit le catalogue et les copies vendorisées de `root` (prototype/) d'après sa liste.
export async function generate(root, packagesDir, log = text => process.stdout.write(text)) {
  const list = readRootList(root);
  const work = mkdtempSync(join(tmpdir(), 'gfs-bibliotheques-'));
  try {
    const entries = [];
    for (const item of list) entries.push(item.forme === 'module' ? await generateAssembled(root, item, packagesDir, work, log) : generateScript(root, item, packagesDir, work, log));
    writeFileSync(join(root, 'bibliotheques/catalogue.json'), `${JSON.stringify({ contrat: 0, bibliotheques: entries }, null, 2)}\n`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

// Relit les fichiers commités de `root` : les écarts entre la liste, le catalogue et les copies vendorisées.
export function verify(root) {
  const catalogue = JSON.parse(readFileSync(join(root, 'bibliotheques/catalogue.json'), 'utf8'));
  return { catalogue, problems: checkFiles(catalogue, readRootList(root), path => readFileSync(join(root, path))) };
}

async function main(argv) {
  if (argv.includes('--verifier') || argv.includes('--verifier-cdn')) {
    const { catalogue, problems } = verify(ROOT);
    if (argv.includes('--verifier-cdn')) {
      problems.push(...await checkCdn(catalogue, async url => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return Buffer.from(await response.arrayBuffer());
      }));
    }
    problems.forEach(problem => process.stderr.write(`écart : ${problem}\n`));
    process.stdout.write(problems.length ? `${problems.length} écart(s)\n` : 'catalogue cohérent\n');
    process.exitCode = problems.length ? 1 : 0;
    return;
  }
  const at = argv.indexOf('--paquets');
  await generate(ROOT, at >= 0 ? resolve(argv[at + 1]) : null);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2));
