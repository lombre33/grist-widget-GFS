// Le catalogue des bibliothèques d'extensions (contrats 2.6, points 5 à 7) : ce que GFS sait servir à une extension, à quelle adresse et avec
// quelle empreinte. Il est livré avec GFS (bibliotheques/catalogue.json, tiré de bibliotheques/package.json par outils/bibliotheques.mjs) :
// l'adresse d'une bibliothèque n'est jamais lue dans un réglage, une table ou un message d'une app (cahier 3.2, point 3).
// Une entrée est soit un script classique (Plotly : `<script src>`, un nom global), soit un fichier assemblé par GFS, de forme `module` (2.6, points 8
// à 11). Le CDN d'un fichier assemblé est jsDelivr, qui sert le dépôt public de GFS à un commit complet ; sans dépôt public épinglé, il n'a pas
// d'adresse de CDN (`cdn: null`) et sa copie est son seul mode.
// Du code sans effet de bord : il lit, valide, résout ; le contrôleur charge le fichier.

import { isSafePath, LIBRARY_ID_RE, EXACT_VERSION_RE } from './manifest.js';

// Les seules adresses de CDN que GFS accepte au catalogue, chacune ajoutée en conscience avec ce qu'elle sert à faire :
//  - cdn.jsdelivr.net/npm/ : le fichier d'un paquet npm, octet pour octet (plotly.js-basic-dist-min, le moteur du graphique) ; le paquet et sa version
//    exacte sont dans l'adresse que l'outil écrit et contrôle ;
//  - cdn.jsdelivr.net/gh/ : un fichier du dépôt public de GFS à un commit complet (le fichier assemblé de l'écriture en direct, que GFS ne tire d'aucun
//    paquet). Une branche ou une étiquette bougerait sous l'empreinte : l'adresse nomme le commit en entier.
export const CDN_HOSTS = Object.freeze(['cdn.jsdelivr.net']);
const GITHUB_PINNED_RE = /^\/gh\/[^/@]+\/[^/@]+@[0-9a-f]{40}\/[^/]/;
export const MODES = Object.freeze(['cdn', 'vendorise']);
export const DEFAULT_MODE = 'cdn';
export const FORMS = Object.freeze(['script', 'module']);
export const DEFAULT_FORM = 'script';
const SRI_RE = /^sha384-[A-Za-z0-9+/]{64}$/;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

const githubProblem = url => (url.pathname.startsWith('/gh/') && !GITHUB_PINNED_RE.test(url.pathname)
  ? 'cdn.src : une adresse /gh/ nomme le dépôt et un commit complet (40 chiffres hexadécimaux), jamais une branche ni une étiquette' : null);

function cdnProblem(cdn) {
  if (cdn === null) return null; // pas d'adresse publique de GFS : la copie est le seul mode (2.6, point 11)
  if (!isObject(cdn) || typeof cdn.src !== 'string') return 'cdn.src absent';
  let url;
  try { url = new URL(cdn.src); } catch (error) { return 'cdn.src n\'est pas une adresse'; }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return 'cdn.src doit être une adresse https sans identifiants ni requête';
  if (!CDN_HOSTS.includes(url.hostname)) return `cdn.src : ${url.hostname} n'est pas un CDN de GFS`;
  const unpinned = githubProblem(url);
  if (unpinned) return unpinned;
  return SRI_RE.test(cdn.integrite || '') ? null : 'cdn.integrite : sha384 en base 64 attendu';
}

function vendoredProblem(vendored) {
  if (!isObject(vendored) || !isSafePath(vendored.chemin)) return 'vendorise.chemin : chemin relatif sûr attendu';
  return SRI_RE.test(vendored.integrite || '') ? null : 'vendorise.integrite : sha384 en base 64 attendu';
}

const isNames = (value, min) => Array.isArray(value) && value.length >= min && value.every(name => typeof name === 'string' && name !== '');
const isContent = item => isObject(item) && typeof item.paquet === 'string' && EXACT_VERSION_RE.test(item.version || '');

// La forme d'une entrée : `script` (le défaut) ou `module` ; un module dit ce qu'il contient, ce qu'il range et ce qu'il laisse à l'app (2.6, point 8).
function formProblem(entry) {
  if (entry.forme !== undefined && !FORMS.includes(entry.forme)) return `forme : ${FORMS.join(' ou ')} attendu`;
  if (entry.forme !== 'module') return null;
  if (!Array.isArray(entry.contient) || !entry.contient.length || !entry.contient.every(isContent)) return 'contient : liste de { paquet, version exacte } attendue';
  if (!isNames(entry.modules, 1)) return 'modules : liste de noms de paquets attendue';
  return isNames(entry.externes, 0) ? null : 'externes : liste de noms attendue';
}

function entryProblems(entry) {
  if (!isObject(entry)) return ['une entrée n\'est pas un objet'];
  const name = `${entry.id}@${entry.version}`;
  const found = [];
  if (!LIBRARY_ID_RE.test(entry.id || '')) found.push('id hors format');
  if (!EXACT_VERSION_RE.test(entry.version || '')) found.push('version exacte attendue');
  if (entry.poids !== undefined && !(Number.isInteger(entry.poids) && entry.poids >= 0)) found.push('poids : entier d\'octets attendu');
  found.push(formProblem(entry), cdnProblem(entry.cdn), vendoredProblem(entry.vendorise));
  return found.filter(Boolean).map(text => `${name} : ${text}`);
}

// Rend { entries: Map('<id>@<version>' -> entrée), errors }. Une entrée invalide n'entre pas dans la table : l'extension qui l'exige est grisée.
export function readCatalogue(doc) {
  const entries = new Map();
  const errors = [];
  if (!isObject(doc) || !Array.isArray(doc.bibliotheques)) return { entries, errors: ['le catalogue des bibliothèques n\'a pas la forme attendue'] };
  for (const entry of doc.bibliotheques) {
    const problems = entryProblems(entry);
    const key = isObject(entry) ? `${entry.id}@${entry.version}` : '';
    if (!problems.length && entries.has(key)) problems.push(`${key} : déjà au catalogue`);
    if (problems.length) errors.push(...problems);
    else entries.set(key, entry);
  }
  return { entries, errors };
}

export const lookup = (catalogue, id, version) => catalogue.entries.get(`${id}@${version}`) || null;

// `required` : [{ id, version }] ; `modeOf(id)` : 'cdn' ou 'vendorise' ; `base` : l'adresse de GFS (la copie vendorisée est servie à côté de lui).
// Une entrée sans CDN est toujours servie par la copie de GFS, quel que soit le mode demandé.
// Rend { libraries: { id: { version, mode, forme, src, integrite, poids } }, missing: [{ id, version }] }.
export function resolveLibraries(catalogue, required, modeOf, base) {
  const libraries = {};
  const missing = [];
  for (const { id, version } of required) {
    const entry = lookup(catalogue, id, version);
    if (!entry) { missing.push({ id, version }); continue; }
    const mode = modeOf(id) === 'vendorise' || !entry.cdn ? 'vendorise' : DEFAULT_MODE;
    const source = mode === 'vendorise' ? { src: new URL(entry.vendorise.chemin, base).href, integrite: entry.vendorise.integrite } : entry.cdn;
    libraries[id] = { version, mode, forme: entry.forme || DEFAULT_FORM, src: source.src, integrite: source.integrite, poids: entry.poids || 0 };
  }
  return { libraries, missing };
}

// Ce que `contexte.bibliotheques` et l'événement `extensions` portent (5.2) : l'adresse, l'empreinte et la forme (comment la charger), rien d'autre.
export function forContext(libraries) {
  const out = {};
  for (const [id, { src, integrite, forme }] of Object.entries(libraries)) out[id] = { src, integrite, forme };
  return out;
}
