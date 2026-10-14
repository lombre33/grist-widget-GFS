// Le versionnage des fichiers de GFS : « tout fichier CSS ou JS modifié monte son ?v= dans la page qui le charge » (GitHub Pages met tout en
// cache 10 minutes : sans cela, un module modifié et un module ancien se mélangent dans la page). Un numéro monté à la main s'oublie : l'outil
// écrit dans index.html, d'après le contenu des fichiers,
//   - la `?v=` de chaque feuille de style et de chaque script cité par une balise ;
//   - la carte d'importation : chaque module de js/ importé par un autre y est associé à son adresse versionnée ;
//   - dans la politique de sécurité du contenu, l'empreinte (sha256) du script en ligne qui porte cette carte.
// Le résultat est commité : aucune étape de construction pour servir.
//
//   node outils/versions.mjs             met index.html à jour
//   node outils/versions.mjs --verifier  dit ce qui est périmé, sans rien écrire (code de sortie 1)

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'index.html';
const FOLDERS = ['css', 'js'];

// Les balises locales de la page : <link ... href="css/x.css?v=…"> et <script ... src="js/x.js?v=…">.
const TAG_RE = /(<(?:link|script)\b[^>]*?\b(?:href|src)=")((?:css|js)\/[^"?]+)(?:\?v=([^"]*))?(")/g;
const MAP_RE = /(<script type="importmap">)([\s\S]*?)(<\/script>)/;
const CSP_RE = /(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(")/;
const HASH_RE = /'sha256-[A-Za-z0-9+/=]+'/g;

export const version = bytes => createHash('sha256').update(bytes).digest('hex').slice(0, 10);
export const cspHash = text => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

// { 'css/gfs.css': octets, 'js/gfs.js': octets, … } : les fichiers du premier niveau de css/ et de js/.
export function readFiles(root = ROOT) {
  const files = {};
  for (const folder of FOLDERS) {
    for (const name of readdirSync(join(root, folder)).sort()) {
      if (name.endsWith(`.${folder}`)) files[`${folder}/${name}`] = readFileSync(join(root, folder, name));
    }
  }
  return files;
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
  for (const path of Object.keys(files).filter(p => p.startsWith('js/') && !direct.includes(p)).sort()) {
    imports[`./${path}`] = `./${path}?v=${version(files[path])}`;
  }
  return `\n${JSON.stringify({ imports }, null, 2)}\n`;
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
  return withCspHash(mapped, cspHash(text));
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
  if (importMapText(files, directPaths(html)) !== html.match(MAP_RE)[2]) stale.push('la carte d\'importation n\'est plus celle des modules de js/');
  if (!stale.length) stale.push('l\'empreinte de la carte dans la politique de sécurité du contenu n\'est plus la bonne');
  return stale;
}

function main(argv) {
  const path = join(ROOT, PAGE);
  const html = readFileSync(path, 'utf8');
  const files = readFiles();
  if (argv.includes('--verifier')) {
    const stale = staleItems(html, files);
    stale.forEach(item => process.stderr.write(`périmé : ${item}\n`));
    process.stdout.write(stale.length ? `${stale.length} écart(s) : lancer node outils/versions.mjs\n` : 'index.html est à jour\n');
    process.exitCode = stale.length ? 1 : 0;
    return;
  }
  const next = applyVersions(html, files);
  if (next !== html) writeFileSync(path, next);
  process.stdout.write(next === html ? 'index.html était déjà à jour\n' : 'index.html mis à jour\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
