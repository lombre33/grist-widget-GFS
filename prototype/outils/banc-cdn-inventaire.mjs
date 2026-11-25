// L'inventaire du banc de comparaison des CDN (choix du porteur, 25/11, « banc complet » : toutes les bibliothèques de GFS et des apps, TipTap compris). Il vient de deux fichiers déjà
// commités : le catalogue de GFS (`bibliotheques/catalogue.json`, les adresses que GFS donne aux apps) et le dernier contrôle de sécurité (`bibliotheques/securite.json`, les adresses de CDN
// que chaque app charge, avec l'empreinte que le CDN servait ce jour-là). Rien ne se lit sur le réseau ici.
//
// Trois familles : `fichiers` (un fichier d'un paquet npm, que plusieurs CDN peuvent servir : jsDelivr, cdnjs, unpkg), `esm` (des modules que esm.sh fabrique à la demande : TipTap et ses
// dépendances, chez Publipostage+) et `depots` (un fichier d'un dépôt GitHub : seul jsDelivr le sert).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Le nom que cdnjs donne à un paquet quand ce n'est pas celui de npm.
const CDNJS_NPM = { 'angular.js': 'angular', 'pdf.js': 'pdfjs-dist' };
const PACKAGE = '((?:@[^/@]+/)?[^/@]+)@([^/]+)';

// Une adresse de CDN en { famille, hote, paquet, version, chemin } ; null si ce n'est pas une adresse qu'un banc sait lire.
export function parseAddress(url) {
  let address;
  try { address = new URL(url); } catch (error) { return null; }
  const path = address.pathname;
  let found;
  if (address.hostname === 'cdn.jsdelivr.net') {
    if ((found = new RegExp(`^/npm/${PACKAGE}/(.+)$`).exec(path))) return { famille: 'fichier', hote: 'jsdelivr', paquet: found[1], version: found[2], chemin: found[3] };
    if ((found = /^\/gh\/([^/@]+\/[^/@]+)@([^/]+)\/(.+)$/.exec(path))) return { famille: 'depot', hote: 'jsdelivr', depot: found[1], version: found[2], chemin: found[3] };
  }
  if (address.hostname === 'unpkg.com' && (found = new RegExp(`^/${PACKAGE}/(.+)$`).exec(path))) {
    return { famille: 'fichier', hote: 'unpkg', paquet: found[1], version: found[2], chemin: found[3] };
  }
  if (address.hostname === 'cdnjs.cloudflare.com' && (found = /^\/ajax\/libs\/([^/]+)\/([^/]+)\/(.+)$/.exec(path))) {
    return { famille: 'fichier', hote: 'cdnjs', paquet: CDNJS_NPM[found[1]] || found[1], nomCdnjs: found[1], version: found[2], chemin: found[3] };
  }
  if (address.hostname === 'esm.sh') return { famille: 'esm', hote: 'esm.sh', chemin: `${path.replace(/^\/\*?/, '')}${address.search}` };
  return null;
}

// Un paquet de l'adresse d'esm.sh (`@tiptap/core@3.31.3/…`), ou null : les aiguillages `node/…`, `gh/…` et les adresses sans version n'en ont pas.
export function esmPackage(chemin) {
  const found = new RegExp(`^${PACKAGE}(?:[/?].*)?$`).exec(chemin);
  return found ? { paquet: found[1], version: found[2].replace(/\?.*$/, '') } : null;
}

const exact = version => /^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(version);

// { fichiers: [{ id, paquet, version, adresses: [{ url, hote, chemin, sha384, octets, origines }] }], esm: [{ racine: 'paquet@version', paquet, version, adresses: n }], depots: [...] }.
// `catalogue` : bibliotheques/catalogue.json ; `securite` : bibliotheques/securite.json (ou null). Une version qui n'est pas exacte (une plage, « latest ») n'est jamais comparée : elle n'est pas figée.
export function inventory(catalogue, securite) {
  const files = new Map();
  const roots = new Map();
  const repos = new Map();
  const add = (url, origin, sha384, octets) => {
    const parsed = parseAddress(url);
    if (!parsed) return;
    if (parsed.famille === 'depot') { repos.set(url, { url, ...parsed, sha384, octets, origines: [...new Set([...(repos.get(url)?.origines || []), origin])] }); return; }
    if (parsed.famille === 'esm') {
      const pkg = esmPackage(parsed.chemin);
      if (!pkg || !exact(pkg.version)) return;
      const key = `${pkg.paquet}@${pkg.version}`;
      const entry = roots.get(key) || { racine: key, ...pkg, adresses: 0, origines: [] };
      roots.set(key, { ...entry, adresses: entry.adresses + 1, origines: [...new Set([...entry.origines, origin])] });
      return;
    }
    if (!exact(parsed.version)) return;
    const key = `${parsed.paquet}@${parsed.version}`;
    const entry = files.get(key) || { id: key, paquet: parsed.paquet, version: parsed.version, adresses: [] };
    const same = entry.adresses.find(each => each.url === url);
    if (same) same.origines = [...new Set([...same.origines, origin])];
    else entry.adresses.push({ url, hote: parsed.hote, chemin: parsed.chemin, sha384: sha384 || null, octets: octets ?? null, origines: [origin] });
    files.set(key, entry);
  };
  for (const entry of (catalogue && catalogue.bibliotheques) || []) if (entry.cdn && entry.cdn.src) add(entry.cdn.src, 'gfs', entry.cdn.integrite, null);
  for (const [id, app] of Object.entries((securite && securite.apps) || {})) for (const print of (app.empreintes || [])) add(print.url, id, print.sha384, print.octets);
  const sorted = list => [...list].sort((a, b) => String(a.id || a.racine || a.url).localeCompare(String(b.id || b.racine || b.url)));
  return { fichiers: sorted(files.values()), esm: sorted(roots.values()), depots: sorted(repos.values()) };
}

export const readInventory = root => inventory(JSON.parse(readFileSync(join(root, 'bibliotheques/catalogue.json'), 'utf8')),
  JSON.parse(readFileSync(join(root, 'bibliotheques/securite.json'), 'utf8')));
