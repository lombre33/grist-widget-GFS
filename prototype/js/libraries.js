// Le catalogue des bibliothèques d'extensions (contrats 2.6, points 5 à 7) : ce que GFS sait servir à une extension, à quelle adresse et avec
// quelle empreinte. Il est livré avec GFS (bibliotheques/catalogue.json, tiré de bibliotheques/package.json par outils/bibliotheques.mjs) :
// l'adresse d'une bibliothèque n'est jamais lue dans un réglage, une table ou un message d'une app (cahier 3.2, point 3).
// Du code sans effet de bord : il lit, valide, résout ; le contrôleur charge le fichier.

import { isSafePath, LIBRARY_ID_RE, EXACT_VERSION_RE } from './manifest.js';

// Les seules adresses de CDN que GFS accepte au catalogue, chacune ajoutée en conscience avec ce qu'elle sert à faire :
//  - cdn.jsdelivr.net : le fichier d'un paquet npm, octet pour octet (plotly.js-basic-dist-min, le moteur du graphique).
export const CDN_HOSTS = Object.freeze(['cdn.jsdelivr.net']);
export const MODES = Object.freeze(['cdn', 'vendorise']);
export const DEFAULT_MODE = 'cdn';
const SRI_RE = /^sha384-[A-Za-z0-9+/]{64}$/;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function cdnProblem(cdn) {
  if (!isObject(cdn) || typeof cdn.src !== 'string') return 'cdn.src absent';
  let url;
  try { url = new URL(cdn.src); } catch (error) { return 'cdn.src n\'est pas une adresse'; }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return 'cdn.src doit être une adresse https sans identifiants ni requête';
  if (!CDN_HOSTS.includes(url.hostname)) return `cdn.src : ${url.hostname} n'est pas un CDN de GFS`;
  return SRI_RE.test(cdn.integrite || '') ? null : 'cdn.integrite : sha384 en base 64 attendu';
}

function vendoredProblem(vendored) {
  if (!isObject(vendored) || !isSafePath(vendored.chemin)) return 'vendorise.chemin : chemin relatif sûr attendu';
  return SRI_RE.test(vendored.integrite || '') ? null : 'vendorise.integrite : sha384 en base 64 attendu';
}

function entryProblems(entry) {
  if (!isObject(entry)) return ['une entrée n\'est pas un objet'];
  const name = `${entry.id}@${entry.version}`;
  const found = [];
  if (!LIBRARY_ID_RE.test(entry.id || '')) found.push('id hors format');
  if (!EXACT_VERSION_RE.test(entry.version || '')) found.push('version exacte attendue');
  if (entry.poids !== undefined && !(Number.isInteger(entry.poids) && entry.poids >= 0)) found.push('poids : entier d\'octets attendu');
  found.push(cdnProblem(entry.cdn), vendoredProblem(entry.vendorise));
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
// Rend { libraries: { id: { version, mode, src, integrite, poids } }, missing: [{ id, version }] }.
export function resolveLibraries(catalogue, required, modeOf, base) {
  const libraries = {};
  const missing = [];
  for (const { id, version } of required) {
    const entry = lookup(catalogue, id, version);
    if (!entry) { missing.push({ id, version }); continue; }
    const mode = modeOf(id) === 'vendorise' ? 'vendorise' : DEFAULT_MODE;
    const source = mode === 'vendorise' ? { src: new URL(entry.vendorise.chemin, base).href, integrite: entry.vendorise.integrite } : entry.cdn;
    libraries[id] = { version, mode, src: source.src, integrite: source.integrite, poids: entry.poids || 0 };
  }
  return { libraries, missing };
}

// Ce que `contexte.bibliotheques` et l'événement `extensions` portent (5.2) : l'adresse et l'empreinte, rien d'autre.
export function forContext(libraries) {
  const out = {};
  for (const [id, { src, integrite }] of Object.entries(libraries)) out[id] = { src, integrite };
  return out;
}
