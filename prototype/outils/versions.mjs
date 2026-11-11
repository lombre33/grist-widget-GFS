// Le versionnage des fichiers de GFS : « tout fichier CSS ou JS modifié monte son ?v= dans la page qui le charge » (GitHub Pages met tout en
// cache 10 minutes : sans cela, un module modifié et un module ancien se mélangent dans la page). Un numéro monté à la main s'oublie : l'outil
// écrit dans index.html, d'après le contenu des fichiers,
//   - la `?v=` de chaque feuille de style et de chaque script cité par une balise ;
//   - la carte d'importation : chaque module de js/ importé par un autre y est associé à son adresse versionnée ;
//   - dans la politique de sécurité du contenu, l'empreinte (sha256) du script en ligne qui porte cette carte ;
//   - le préchargement : un <link rel="modulepreload"> par module du chemin de démarrage (les imports statiques du script d'entrée, de proche en proche), à son adresse de la carte, juste après la carte.
//     Sans lui, le navigateur ne découvre les modules qu'un niveau d'imports à la fois (9 niveaux, donc 9 allers-retours de réseau : audit vitesse du 10/11, faits vérifiés 82).
// Les pages qui n'ont qu'un script à côté d'elles (le cadre d'envoi, `transfer/`) portent aussi la `?v=` de ce script.
// Le kit (sous-module `kit/`, dépôt lombre33/grist-factory-kit) est versionné comme le reste : ses feuilles (`kit/css/`) et ses modules (`kit/js/`) sont dans la carte et les balises. Son dossier vient
// avec `git submodule update --init kit` ; l'outil le récupère lui-même quand il manque.
// Le résultat est commité : aucune étape de construction pour servir.
//
//   node outils/versions.mjs             met index.html (et les pages à script voisin) à jour
//   node outils/versions.mjs --verifier  dit ce qui est périmé, sans rien écrire (code de sortie 1)

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'index.html';
const FOLDERS = ['css', 'kit/css', 'kit/js'];
// Les dossiers que GFS charge avec tous leurs sous-dossiers : ses propres modules (js/, rangés par sujet : broker/, explorer/…) et le moteur de partage du kit (kit/js/synchro/, logic/, source/, target/). Les autres modules du kit (le calendrier…) ne sont pas ceux de GFS.
const NESTED = ['js', 'kit/js/synchro'];
// Les pages qui citent un script de leur propre dossier : { page, dossier }.
const SIDE_PAGES = [{ page: 'transfer/index.html', folder: 'transfer' }];
const SIDE_TAG_RE = /(<script\b[^>]*?\bsrc=")([^"?:/]+\.js)(?:\?v=([^"]*))?(")/g;

// Les balises locales de la page : <link ... href="css/x.css?v=…"> et <script ... src="js/x.js?v=…">.
const TAG_RE = /(<(?:link|script)\b[^>]*?\b(?:href|src)=")((?:kit\/)?(?:css|js)\/[^"?]+)(?:\?v=([^"]*))?(")/g;
const MAP_RE = /(<script type="importmap">)([\s\S]*?)(<\/script>)/;
// Le bloc du préchargement : ses deux repères sont dans index.html, l'outil réécrit ce qu'ils entourent. Il vient APRÈS la carte d'importation : une page qui commence à charger un module avant elle l'ignore
// (Firefox demande alors les modules sans leur ?v=, mesuré le 10/11).
const PRELOAD_RE = /(<!-- préchargement -->)([\s\S]*?)(<!-- \/préchargement -->)/;
const ENTRY_RE = /<script\b[^>]*\btype="module"[^>]*\bsrc="([^"?]+)/;
// Un import statique (`import … from 'x'`, `import 'x'`, `export … from 'x'`) en début de ligne ; les imports dynamiques `import('x')` ne sont pas suivis : ils se chargent à l'usage.
const STATIC_IMPORT_RE = /(?:^|[\n;])[ \t]*(?:import\s+(?:[^'"()]*?\s+from\s+)?|export\s+(?:\*|\{[^}]*\})\s+from\s+)(['"])([^'"]+)\1/g;
const CSP_RE = /(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(")/;
const HASH_RE = /'sha256-[A-Za-z0-9+/=]+'/g;

export const version = bytes => createHash('sha256').update(bytes).digest('hex').slice(0, 10);
export const cspHash = text => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

// { 'css/gfs.css': octets, 'js/gfs.js': octets, 'kit/js/i18n.js': octets, 'kit/js/synchro/port.js': octets, … } : les fichiers du premier niveau de css/ et des dossiers du kit, tous ceux de js/ (sous-dossiers compris) et tout le moteur de partage du kit.
export function readFiles(root = ROOT) {
  const files = {};
  for (const folder of FOLDERS) {
    if (folder.startsWith('kit/') && !existsSync(join(root, folder))) throw new Error(`le sous-module du kit n'est pas là (${folder} manque) : git submodule update --init prototype/kit`);
    const extension = folder.slice(folder.lastIndexOf('/') + 1);
    for (const name of readdirSync(join(root, folder)).sort()) {
      if (name.endsWith(`.${extension}`)) files[`${folder}/${name}`] = readFileSync(join(root, folder, name));
    }
  }
  for (const folder of NESTED.filter(each => existsSync(join(root, each)))) {
    for (const name of readdirSync(join(root, folder), { recursive: true }).sort()) {
      if (name.endsWith('.js')) files[`${folder}/${name.split(sep).join('/')}`] = readFileSync(join(root, folder, name));
    }
  }
  return files;
}

// { 'transfer.js': octets } : les scripts du dossier d'une page à script voisin.
export function readSideFiles(folder, root = ROOT) {
  const files = {};
  for (const name of readdirSync(join(root, folder)).sort()) if (name.endsWith('.js')) files[name] = readFileSync(join(root, folder, name));
  return files;
}

// Une page à script voisin telle qu'elle doit être pour ces fichiers : chaque balise <script src="x.js"> porte l'empreinte de x.js.
export function applySideVersions(html, files) {
  return html.replace(SIDE_TAG_RE, (all, open, name, had, close) => {
    if (!files[name]) throw new Error(`la page cite ${name}, qui n'existe pas`);
    return `${open}${name}?v=${version(files[name])}${close}`;
  });
}

// Ce qui est périmé dans une page à script voisin (liste vide : tout est à jour).
export function staleSideItems(html, files) {
  return [...html.matchAll(SIDE_TAG_RE)].filter(match => files[match[2]] && match[3] !== version(files[match[2]]))
    .map(match => `${match[2]} : ?v=${match[3] === undefined ? '(absente)' : match[3]} au lieu de ?v=${version(files[match[2]])}`);
}

const versionOf = (files, path) => {
  if (!files[path]) throw new Error(`index.html cite ${path}, qui n'existe pas`);
  return version(files[path]);
};

// Les fichiers que la page cite elle-même par une balise : ils portent leur ?v= dans la balise, pas dans la carte.
const directPaths = html => [...html.matchAll(TAG_RE)].map(match => match[2]);

// Le texte exact de la carte : chaque module importé par un autre, dans l'ordre alphabétique. (L'empreinte de la politique de sécurité porte sur
// ce texte à l'octet près, retours à la ligne compris.)
export function importMapText(files, direct) {
  const imports = {};
  for (const path of Object.keys(files).filter(p => /^(?:kit\/)?js\//.test(p) && !direct.includes(p)).sort()) {
    imports[`./${path}`] = `./${path}?v=${version(files[path])}`;
  }
  return `\n${JSON.stringify({ imports }, null, 2)}\n`;
}

// Le module d'entrée de la page : le chemin du premier <script type="module" src="…"> (sans sa ?v=), ou null.
const entryOf = html => (html.match(ENTRY_RE) || [])[1] || null;

// Les modules du chemin de démarrage : les imports statiques de `entry`, de proche en proche, du plus proche au plus loin (c'est l'ordre où le navigateur les demande), sans l'entrée ni les
// fichiers que la page cite elle-même (`direct`) ; seuls les fichiers de `files` comptent (les adresses nues et externes sont laissées).
export function startupModules(files, entry, direct = []) {
  if (!entry || !files[entry]) return [];
  const order = [];
  const seen = new Set([entry]);
  for (let queue = [entry]; queue.length;) {
    const next = [];
    for (const from of queue) {
      for (const match of files[from].toString('utf8').matchAll(STATIC_IMPORT_RE)) {
        if (!match[2].startsWith('.')) continue;
        const path = posix.join(posix.dirname(from), match[2]);
        if (seen.has(path) || !files[path]) continue;
        seen.add(path);
        next.push(path);
        if (!direct.includes(path)) order.push(path);
      }
    }
    queue = next;
  }
  return order;
}

// Le texte exact du bloc : un lien par module du chemin de démarrage, à l'adresse versionnée que la carte donne (même adresse : le module préchargé est celui que la carte fait demander).
export function preloadText(files, entry, direct) {
  const links = startupModules(files, entry, direct).map(path => `<link rel="modulepreload" href="./${path}?v=${version(files[path])}">`);
  return `\n${links.join('\n')}\n`;
}

function withCspHash(html, hash) {
  if (!CSP_RE.test(html)) throw new Error('index.html n\'a pas de politique de sécurité du contenu');
  return html.replace(CSP_RE, (all, open, policy, close) => {
    const directives = policy.split(';').map(part => {
      if (!part.trim().startsWith('script-src')) return part;
      const kept = part.replace(HASH_RE, '').replace(/\s+$/, '');
      return `${kept} ${hash}`;
    });
    return `${open}${directives.join(';')}${close}`;
  });
}

// index.html tel qu'il doit être pour ces fichiers.
export function applyVersions(html, files) {
  if (!MAP_RE.test(html)) throw new Error('index.html n\'a pas de <script type="importmap">');
  const direct = directPaths(html);
  const tagged = html.replace(TAG_RE, (all, open, path, had, close) => `${open}${path}?v=${versionOf(files, path)}${close}`);
  const text = importMapText(files, direct);
  const mapped = tagged.replace(MAP_RE, (all, open, old, close) => `${open}${text}${close}`);
  if (!PRELOAD_RE.test(mapped)) throw new Error('index.html n\'a pas le bloc <!-- préchargement --> … <!-- /préchargement --> (après la carte d\'importation)');
  const preload = preloadText(files, entryOf(mapped), direct);
  const loaded = mapped.replace(PRELOAD_RE, (all, open, old, close) => `${open}${preload}${close}`);
  return withCspHash(loaded, cspHash(text));
}

// Ce qui est périmé dans index.html (liste vide : tout est à jour).
export function staleItems(html, files) {
  const expected = applyVersions(html, files);
  if (expected === html) return [];
  const stale = [];
  for (const match of html.matchAll(TAG_RE)) {
    const had = match[3];
    const want = versionOf(files, match[2]);
    if (had !== want) stale.push(`${match[2]} : ?v=${had === undefined ? '(absente)' : had} au lieu de ?v=${want}`);
  }
  if (importMapText(files, directPaths(html)) !== html.match(MAP_RE)[2]) stale.push('la carte d\'importation n\'est plus celle des modules de js/ et de kit/js/');
  if (preloadText(files, entryOf(html), directPaths(html)) !== (html.match(PRELOAD_RE) || [])[2]) stale.push('les liens de préchargement ne sont plus ceux des modules du chemin de démarrage');
  if (!stale.length) stale.push('l\'empreinte de la carte dans la politique de sécurité du contenu n\'est plus la bonne');
  return stale;
}

// Un clone sans `--recurse-submodules` n'a pas le dossier du kit : l'outil le récupère, sans quoi il ne pourrait pas versionner ses modules.
function ensureKit() {
  if (existsSync(join(ROOT, 'kit/js'))) return;
  process.stdout.write('le sous-module du kit n\'est pas là : git submodule update --init kit\n');
  execFileSync('git', ['submodule', 'update', '--init', '--', 'kit'], { cwd: ROOT, stdio: 'inherit' });
}

function main(argv) {
  ensureKit();
  const path = join(ROOT, PAGE);
  const html = readFileSync(path, 'utf8');
  const files = readFiles();
  const sides = SIDE_PAGES.map(side => ({ ...side, path: join(ROOT, side.page), files: readSideFiles(side.folder) }));
  if (argv.includes('--verifier')) {
    const stale = [...staleItems(html, files), ...sides.flatMap(side => staleSideItems(readFileSync(side.path, 'utf8'), side.files).map(item => `${side.page} : ${item}`))];
    stale.forEach(item => process.stderr.write(`périmé : ${item}\n`));
    process.stdout.write(stale.length ? `${stale.length} écart(s) : lancer node outils/versions.mjs\n` : 'index.html est à jour\n');
    process.exitCode = stale.length ? 1 : 0;
    return;
  }
  const next = applyVersions(html, files);
  if (next !== html) writeFileSync(path, next);
  process.stdout.write(next === html ? 'index.html était déjà à jour\n' : 'index.html mis à jour\n');
  for (const side of sides) {
    const current = readFileSync(side.path, 'utf8');
    const updated = applySideVersions(current, side.files);
    if (updated !== current) writeFileSync(side.path, updated);
    process.stdout.write(updated === current ? `${side.page} était déjà à jour\n` : `${side.page} mis à jour\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
