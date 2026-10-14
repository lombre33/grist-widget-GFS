// L'outil des bibliothèques d'extensions (contrats 2.6, point 6) : d'après la liste de GFS (bibliotheques/package.json), il tire de chaque paquet
// le fichier à servir, en calcule l'empreinte (sha384, comme `integrity`), en garde la copie vendorisée (vendor/<id>/<version>/<fichier>) et
// écrit le catalogue (bibliotheques/catalogue.json) que GFS lit. Les fichiers générés sont commités : aucune étape de construction pour servir.
//
//   node outils/bibliotheques.mjs                       tire les paquets (npm pack) et écrit le catalogue et la copie vendorisée
//   node outils/bibliotheques.mjs --paquets <dossier>   idem, depuis des archives <paquet>-<version>.tgz déjà téléchargées (hors ligne)
//   node outils/bibliotheques.mjs --verifier            relit les fichiers commités, sans réseau : empreintes, versions exactes, cohérence
//   node outils/bibliotheques.mjs --verifier-cdn        compare l'empreinte du catalogue au fichier que le CDN sert vraiment (réseau)
//
// Le CDN est jsDelivr, qui sert le fichier du paquet octet pour octet : une seule empreinte vaut pour le CDN et pour la copie vendorisée.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXACT_VERSION_RE = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const CDN_BASE = 'https://cdn.jsdelivr.net/npm';

export const integrity = bytes => `sha384-${createHash('sha384').update(bytes).digest('base64')}`;

// La liste de GFS : [{ id, paquet, version, fichier }], versions exactes seulement.
export function readList(packageJson) {
  const deps = packageJson.dependencies || {};
  const declared = (packageJson.gfs && packageJson.gfs.bibliotheques) || {};
  return Object.entries(declared).map(([id, spec]) => {
    const version = deps[spec.paquet];
    if (!EXACT_VERSION_RE.test(version || '')) throw new Error(`${id} : la version de ${spec.paquet} doit être exacte (reçu : ${version})`);
    if (!spec.fichier || spec.fichier.includes('..') || spec.fichier.startsWith('/')) throw new Error(`${id} : fichier hors du paquet`);
    return { id, paquet: spec.paquet, version, fichier: spec.fichier };
  });
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

// Relit les fichiers commités : l'empreinte de chaque copie vendorisée est celle du catalogue, et le CDN et la copie portent la même.
// `read(chemin)` rend les octets d'un chemin relatif à prototype/. Rend la liste des écarts (vide : tout est cohérent).
export function checkFiles(catalogue, list, read) {
  const problems = [];
  const entries = catalogue.bibliotheques || [];
  for (const item of list) {
    const entry = entries.find(e => e.id === item.id && e.version === item.version);
    if (!entry) { problems.push(`${item.id}@${item.version} : absent du catalogue`); continue; }
    if (entry.cdn.src !== `${CDN_BASE}/${item.paquet}@${item.version}/${item.fichier}`) problems.push(`${item.id} : adresse du CDN inattendue`);
    if (entry.cdn.integrite !== entry.vendorise.integrite) problems.push(`${item.id} : le CDN et la copie vendorisée doivent porter la même empreinte`);
    let bytes = null;
    try { bytes = read(entry.vendorise.chemin); } catch (error) { problems.push(`${item.id} : copie vendorisée illisible (${entry.vendorise.chemin})`); }
    if (bytes && integrity(bytes) !== entry.vendorise.integrite) problems.push(`${item.id} : l'empreinte de ${entry.vendorise.chemin} ne correspond pas au catalogue`);
    if (bytes && entry.poids !== bytes.length) problems.push(`${item.id} : le poids du catalogue (${entry.poids}) n'est pas celui du fichier (${bytes.length})`);
  }
  for (const entry of entries) {
    if (!list.some(item => item.id === entry.id && item.version === entry.version)) problems.push(`${entry.id}@${entry.version} : dans le catalogue mais plus dans la liste`);
  }
  return problems;
}

// Compare au CDN réel. `fetchBytes(url)` rend les octets (injecté : le réseau n'est pas toujours là).
export async function checkCdn(catalogue, fetchBytes) {
  const problems = [];
  for (const entry of catalogue.bibliotheques || []) {
    try {
      const got = integrity(await fetchBytes(entry.cdn.src));
      if (got !== entry.cdn.integrite) problems.push(`${entry.id} : le CDN sert un fichier d'empreinte ${got}, le catalogue dit ${entry.cdn.integrite}`);
    } catch (error) { problems.push(`${entry.id} : le CDN n'a pas répondu (${error.message})`); }
  }
  return problems;
}

function packBytes(item, packagesDir, workDir) {
  const archive = packagesDir ? join(packagesDir, `${item.paquet}-${item.version}.tgz`) : null;
  let file = archive;
  if (!archive || !existsSync(archive)) {
    const out = execFileSync('npm', ['pack', `${item.paquet}@${item.version}`, '--silent', '--pack-destination', workDir], { encoding: 'utf8' }).trim().split('\n').pop();
    file = join(workDir, out);
  }
  execFileSync('tar', ['-xzf', file, '-C', workDir, `package/${item.fichier}`]);
  return readFileSync(join(workDir, 'package', item.fichier));
}

function generate(packagesDir) {
  const list = readList(JSON.parse(readFileSync(join(ROOT, 'bibliotheques/package.json'), 'utf8')));
  const work = mkdtempSync(join(tmpdir(), 'gfs-bibliotheques-'));
  try {
    const entries = list.map(item => {
      const bytes = packBytes(item, packagesDir, work);
      const entry = buildEntry(item, bytes);
      const target = join(ROOT, entry.vendorise.chemin);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, bytes);
      process.stdout.write(`${item.id}@${item.version} : ${bytes.length} octets, ${entry.cdn.integrite}\n`);
      return entry;
    });
    const catalogue = { contrat: 0, bibliotheques: entries };
    writeFileSync(join(ROOT, 'bibliotheques/catalogue.json'), `${JSON.stringify(catalogue, null, 2)}\n`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

async function main(argv) {
  const list = readList(JSON.parse(readFileSync(join(ROOT, 'bibliotheques/package.json'), 'utf8')));
  if (argv.includes('--verifier') || argv.includes('--verifier-cdn')) {
    const catalogue = JSON.parse(readFileSync(join(ROOT, 'bibliotheques/catalogue.json'), 'utf8'));
    const problems = checkFiles(catalogue, list, path => readFileSync(join(ROOT, path)));
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
  generate(at >= 0 ? resolve(argv[at + 1]) : null);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2));
