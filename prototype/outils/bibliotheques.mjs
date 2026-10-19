// L'outil des bibliothèques d'extensions (contrats 2.6, point 6) : d'après la liste de GFS (bibliotheques/package.json), il tire de chaque paquet
// le fichier à servir, en calcule l'empreinte (sha384, comme `integrity`), en garde la copie vendorisée (vendor/<id>/<version>/<fichier>) et
// écrit le catalogue (bibliotheques/catalogue.json) que GFS lit. Les fichiers générés sont commités : aucune étape de construction pour servir.
// Une bibliothèque de la liste est soit le fichier d'un paquet (`paquet`, `fichier`), soit un fichier assemblé par GFS (`assemble`, points 8 à 11 :
// outils/assemblage.mjs ; elle demande esbuild, épinglé dans package.json, donc `npm ci` dans prototype/ avant de lancer l'outil).
//
//   node outils/bibliotheques.mjs                       tire les paquets (npm pack) et écrit le catalogue et la copie vendorisée
//   node outils/bibliotheques.mjs --paquets <dossier>   idem, depuis des archives <paquet>-<version>.tgz déjà téléchargées (hors ligne)
//   node outils/bibliotheques.mjs --catalogue           réécrit le catalogue d'après les copies vendorisées commitées, sans rien tirer : ce que change `gfs.publication` (le commit épinglé)
//   node outils/bibliotheques.mjs --verifier            relit les fichiers commités, sans réseau : empreintes, versions exactes, cohérence, et (git) que le commit épinglé porte le fichier
//   node outils/bibliotheques.mjs --verifier-cdn        compare le catalogue à ce que le CDN sert vraiment (réseau) : les octets (empreinte), l'en-tête CORS et le type JavaScript
//
// Le CDN est jsDelivr, qui sert le fichier du paquet octet pour octet : une seule empreinte vaut pour le CDN et pour la copie vendorisée.
// Un fichier assemblé est servi par jsDelivr depuis le dépôt public de GFS, épinglé à un commit complet qui porte la copie vendorisée (`gfs.publication` de la liste ;
// choix du porteur, 19/10). Sans `gfs.publication`, il n'a pas de CDN (`cdn: null`) : la copie de GFS est son seul mode.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { EXACT_VERSION_RE, isSafePath } from '../js/manifest.js';
import { readAssembly, assembleFile, licencesText, registeredProblems, assembledPath, licencesPath, sameSet } from './assemblage.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CDN_ORIGIN = 'https://cdn.jsdelivr.net';
const CDN_BASE = `${CDN_ORIGIN}/npm`;
const REPO_RE = /^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9._-]+$/;
const COMMIT_RE = /^[0-9a-f]{40}$/;

export const integrity = bytes => `sha384-${createHash('sha384').update(bytes).digest('base64')}`;

// La liste de GFS : [{ id, paquet, version, fichier }] pour le fichier d'un paquet, [{ id, forme: 'module', version, paquets, modules, externes, alias }]
// pour un fichier assemblé. Versions exactes seulement.
export function readList(packageJson) {
  const deps = packageJson.dependencies || {};
  const declared = (packageJson.gfs && packageJson.gfs.bibliotheques) || {};
  return Object.entries(declared).map(([id, spec]) => (spec.assemble ? readAssembly(id, spec, deps) : readPackageFile(id, spec, deps)));
}

// Où jsDelivr sert les fichiers assemblés : { depot, commit, racine } (`gfs.publication` de la liste), ou null quand GFS n'a pas d'adresse publique.
// `commit` est complet : une branche ou une étiquette change sous les pieds de l'empreinte. `racine` est le dossier de GFS dans le dépôt (« prototype/ »).
export function readPublication(packageJson) {
  const publication = packageJson.gfs && packageJson.gfs.publication;
  if (publication === undefined) return null;
  const { depot, commit, racine } = publication || {};
  if (!REPO_RE.test(depot || '')) throw new Error('gfs.publication.depot : « propriétaire/dépôt » attendu');
  if (!COMMIT_RE.test(commit || '')) throw new Error('gfs.publication.commit : un commit complet (40 chiffres hexadécimaux) attendu, jamais une branche ni une étiquette');
  if (typeof racine !== 'string' || (racine !== '' && !(racine.endsWith('/') && isSafePath(racine.slice(0, -1))))) throw new Error('gfs.publication.racine : le dossier de GFS dans le dépôt, avec sa barre finale (ou vide)');
  return { depot, commit, racine };
}

// L'adresse jsDelivr d'un fichier de GFS (`chemin` : relatif à prototype/) au commit épinglé.
export const githubAddress = ({ depot, commit, racine }, chemin) => `${CDN_ORIGIN}/gh/${depot}@${commit}/${racine}${chemin}`;

// Lit un fichier de GFS à un commit, sans réseau (`git cat-file`). Rend null quand le commit n'est pas dans ce clone (partiel, sans historique, ou sans git) : la vérification
// est alors laissée à --verifier-cdn, qui lit ce que jsDelivr sert. Lève une erreur quand le commit est là sans ce fichier.
export function gitReader(root) {
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 });
  return (commit, path) => {
    try { git('cat-file', '-e', `${commit}^{commit}`); } catch (error) { return null; }
    return git('cat-file', 'blob', `${commit}:${path}`);
  };
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

// L'entrée du catalogue d'un fichier assemblé (2.6, point 8) : ce qu'il contient, ce qu'il range, ce qu'il laisse à l'app, la copie de GFS et, quand le commit épinglé de
// `publication` porte cette copie, l'adresse jsDelivr du même fichier (même empreinte).
export function buildAssembledEntry(item, bytes, publication = null) {
  const sri = integrity(bytes);
  return {
    id: item.id,
    version: item.version,
    forme: 'module',
    poids: bytes.length,
    contient: item.paquets.map(({ paquet, version }) => ({ paquet, version })),
    modules: [...item.modules],
    externes: [...item.externes],
    cdn: publication ? { src: githubAddress(publication, assembledPath(item)), integrite: sri } : null,
    vendorise: { chemin: assembledPath(item), integrite: sri },
  };
}

// L'adresse du CDN d'un fichier assemblé : celle du commit épinglé par la liste (avec l'empreinte de la copie), ou aucune quand la liste n'en épingle pas.
function assembledCdnProblems(item, entry, publication) {
  if (!publication) return entry.cdn === null ? [] : [`${item.id} : sans gfs.publication dans la liste, un fichier assemblé n'a pas de CDN (cdn: null)`];
  if (!entry.cdn) return [`${item.id} : la liste épingle le commit ${publication.commit.slice(0, 7)}, le catalogue n'a pas d'adresse de CDN : relancer l'outil (--catalogue)`];
  const expected = githubAddress(publication, entry.vendorise.chemin);
  const found = [];
  if (entry.cdn.src !== expected) found.push(`${item.id} : l'adresse du CDN n'est pas celle du commit épinglé (${expected})`);
  if (entry.cdn.integrite !== entry.vendorise.integrite) found.push(`${item.id} : le CDN et la copie vendorisée doivent porter la même empreinte`);
  return found;
}

// Le commit épinglé porte-t-il la copie vendorisée, octet pour octet ? Sans lecteur, ou quand le commit n'est pas dans ce clone, le contrôle est laissé à --verifier-cdn.
function pinProblems(item, entry, publication, readAtCommit) {
  if (!publication || !readAtCommit) return [];
  const path = `${publication.racine}${entry.vendorise.chemin}`;
  const short = publication.commit.slice(0, 7);
  let held;
  try { held = readAtCommit(publication.commit, path); } catch (error) { return [`${item.id} : le commit épinglé ${short} ne porte pas ${path}`]; }
  if (held === null) return [];
  return integrity(held) === entry.vendorise.integrite ? [] : [`${item.id} : le commit épinglé ${short} porte un autre ${path} que la copie vendorisée (l'empreinte diffère)`];
}

// Ce que le catalogue dit d'un fichier assemblé doit être exactement ce que la liste déclare.
function assembledProblems(item, entry, read, { publication = null, readAtCommit = null } = {}) {
  const found = [];
  if (entry.forme !== 'module') found.push(`${item.id} : forme « module » attendue`);
  found.push(...assembledCdnProblems(item, entry, publication), ...pinProblems(item, entry, publication, readAtCommit));
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
// `read(chemin)` rend les octets d'un chemin relatif à prototype/. `pin` : { publication, readAtCommit } de la liste (un fichier assemblé a un CDN quand la liste épingle un commit).
// Rend la liste des écarts (vide : tout est cohérent).
export function checkFiles(catalogue, list, read, pin = {}) {
  const problems = [];
  const entries = catalogue.bibliotheques || [];
  for (const item of list) {
    const entry = entries.find(e => e.id === item.id && e.version === item.version);
    if (!entry) problems.push(`${item.id}@${item.version} : absent du catalogue`);
    else if (!entry.vendorise || typeof entry.vendorise.chemin !== 'string') problems.push(`${item.id} : copie vendorisée absente du catalogue`);
    else problems.push(...(item.forme === 'module' ? assembledProblems(item, entry, read, pin) : scriptProblems(item, entry)), ...copyProblems(item, entry, read));
  }
  for (const entry of entries) {
    if (!list.some(item => item.id === entry.id && item.version === entry.version)) problems.push(`${entry.id}@${entry.version} : dans le catalogue mais plus dans la liste`);
  }
  return problems;
}

// Ce que le navigateur exige d'un script à empreinte servi par un CDN, en plus des octets : l'en-tête CORS (sans lui, l'empreinte n'est pas contrôlée et le script est refusé,
// surtout dans un cadre isolé dont l'origine est opaque) et un type JavaScript (un module est refusé sinon).
function headerProblems(entry, headers) {
  const found = [];
  if (headers.cors !== '*' && headers.cors !== 'null') found.push(`${entry.id} : le CDN ne donne pas l'en-tête CORS (access-control-allow-origin : ${headers.cors || 'absent'})`);
  if (!/(java|ecma)script/i.test(headers.type || '')) found.push(headers.type ? `${entry.id} : le CDN sert le fichier comme « ${headers.type} », pas comme du JavaScript` : `${entry.id} : le CDN ne dit pas le type du fichier (content-type absent), il faut du JavaScript`);
  return found;
}

// Compare au CDN réel. `fetchFile(url)` rend { bytes, headers: { cors, type } } (ou seulement les octets, sans contrôle des en-têtes) ; injecté : le réseau n'est pas toujours là.
// Une entrée sans CDN n'a rien à comparer.
export async function checkCdn(catalogue, fetchFile) {
  const problems = [];
  for (const entry of (catalogue.bibliotheques || []).filter(candidate => candidate.cdn)) {
    try {
      const answer = await fetchFile(entry.cdn.src);
      const { bytes, headers } = Buffer.isBuffer(answer) ? { bytes: answer, headers: null } : answer;
      const got = integrity(bytes);
      if (got !== entry.cdn.integrite) problems.push(`${entry.id} : le CDN sert un fichier d'empreinte ${got}, le catalogue dit ${entry.cdn.integrite}`);
      if (headers) problems.push(...headerProblems(entry, headers));
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

async function generateAssembled(root, item, packagesDir, work, log, pin) {
  const dir = join(work, item.id);
  unpackPackages(item, packagesDir, dir);
  const { bytes, problems } = await assembleFile(item, dir, await loadEsbuild());
  const licences = licencesText(item, dir);
  problems.push(...licences.problems);
  if (problems.length) throw new Error(`${item.id} : le fichier n'est pas ce que la liste dit :\n  - ${problems.join('\n  - ')}`);
  const entry = buildAssembledEntry(item, bytes, publicationFor(item, bytes, pin, log));
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

const readRootPackage = root => JSON.parse(readFileSync(join(root, 'bibliotheques/package.json'), 'utf8'));
const writeCatalogue = (root, entries) => writeFileSync(join(root, 'bibliotheques/catalogue.json'), `${JSON.stringify({ contrat: 0, bibliotheques: entries }, null, 2)}\n`);

// L'épinglage de la liste : { publication, readAtCommit } quand elle épingle un commit, sinon rien (un fichier assemblé n'a alors pas de CDN).
function pinOf(root, packageJson) {
  const publication = readPublication(packageJson);
  return publication ? { publication, readAtCommit: gitReader(root) } : {};
}

// La publication qui vaut pour ces octets : celle de la liste quand son commit épinglé porte exactement ce fichier ; sinon aucune (cdn: null), et l'outil dit quoi faire.
function publicationFor(item, bytes, { publication, readAtCommit } = {}, log) {
  if (!publication) return null;
  const short = publication.commit.slice(0, 7);
  let held;
  try { held = readAtCommit(publication.commit, `${publication.racine}${assembledPath(item)}`); } catch (error) { held = undefined; }
  if (held === null) throw new Error(`${item.id} : le commit épinglé ${short} n'est pas dans ce clone (git fetch) : l'adresse du CDN ne s'écrit qu'après avoir lu le fichier à ce commit`);
  if (held && integrity(held) === integrity(bytes)) return publication;
  log(`${item.id} : pas d'adresse de CDN pour l'instant, le commit épinglé ${short} ne porte pas ce fichier. Commiter la copie, mettre son commit dans gfs.publication.commit de la liste, puis relancer avec --catalogue.\n`);
  return null;
}

// Écrit le catalogue et les copies vendorisées de `root` (prototype/) d'après sa liste.
export async function generate(root, packagesDir, log = text => process.stdout.write(text)) {
  const packageJson = readRootPackage(root);
  const pin = pinOf(root, packageJson);
  const work = mkdtempSync(join(tmpdir(), 'gfs-bibliotheques-'));
  try {
    const entries = [];
    for (const item of readList(packageJson)) entries.push(item.forme === 'module' ? await generateAssembled(root, item, packagesDir, work, log, pin) : generateScript(root, item, packagesDir, work, log));
    writeCatalogue(root, entries);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function readCopy(root, item, chemin) {
  try { return readFileSync(join(root, chemin)); } catch (error) { throw new Error(`${item.id}@${item.version} : pas de copie vendorisée à ${chemin} : relancer l'outil sans option`); }
}

// L'entrée d'une bibliothèque refaite d'après sa copie vendorisée commitée.
function entryFromCopy(root, item, pin, log) {
  if (item.forme !== 'module') return buildEntry(item, readCopy(root, item, `vendor/${item.id}/${item.version}/${item.fichier}`));
  const bytes = readCopy(root, item, assembledPath(item));
  return buildAssembledEntry(item, bytes, publicationFor(item, bytes, pin, log));
}

// Réécrit le catalogue d'après les copies vendorisées déjà commitées, sans rien tirer : ce que change l'épinglage d'un autre commit (`gfs.publication`). Seule l'adresse du CDN
// peut changer : une copie qui n'est plus celle du catalogue (empreinte, poids, contenu) est une erreur, la liste se reconstruit alors par l'outil sans option.
export function rewriteCatalogue(root, log = text => process.stdout.write(text)) {
  const packageJson = readRootPackage(root);
  const pin = pinOf(root, packageJson);
  const before = new Map(JSON.parse(readFileSync(join(root, 'bibliotheques/catalogue.json'), 'utf8')).bibliotheques.map(entry => [`${entry.id}@${entry.version}`, entry]));
  const entries = readList(packageJson).map(item => {
    const entry = entryFromCopy(root, item, pin, log);
    const old = before.get(`${entry.id}@${entry.version}`);
    if (!old || JSON.stringify({ ...old, cdn: null }) !== JSON.stringify({ ...entry, cdn: null })) throw new Error(`${entry.id} : la copie vendorisée n'est plus celle du catalogue : relancer l'outil sans option`);
    return entry;
  });
  writeCatalogue(root, entries);
}

// Relit les fichiers commités de `root` : les écarts entre la liste, le catalogue et les copies vendorisées (et le commit épinglé, quand git le connaît).
export function verify(root, readAtCommit = null) {
  const catalogue = JSON.parse(readFileSync(join(root, 'bibliotheques/catalogue.json'), 'utf8'));
  const packageJson = readRootPackage(root);
  const publication = readPublication(packageJson);
  const pin = { publication, readAtCommit: publication ? (readAtCommit || gitReader(root)) : null };
  return { catalogue, problems: checkFiles(catalogue, readList(packageJson), path => readFileSync(join(root, path)), pin) };
}

// Ce que le CDN rend d'une adresse : les octets et les deux en-têtes que le navigateur exige d'un script à empreinte (checkCdn).
async function fetchFile(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return { bytes: Buffer.from(await response.arrayBuffer()), headers: { cors: response.headers.get('access-control-allow-origin'), type: response.headers.get('content-type') } };
}

async function main(argv) {
  if (argv.includes('--verifier') || argv.includes('--verifier-cdn')) {
    const { catalogue, problems } = verify(ROOT);
    if (argv.includes('--verifier-cdn')) problems.push(...await checkCdn(catalogue, fetchFile));
    problems.forEach(problem => process.stderr.write(`écart : ${problem}\n`));
    process.stdout.write(problems.length ? `${problems.length} écart(s)\n` : 'catalogue cohérent\n');
    process.exitCode = problems.length ? 1 : 0;
    return;
  }
  if (argv.includes('--catalogue')) { rewriteCatalogue(ROOT); return; }
  const at = argv.indexOf('--paquets');
  await generate(ROOT, at >= 0 ? resolve(argv[at + 1]) : null);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2));
