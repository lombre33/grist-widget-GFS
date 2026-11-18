// Le relevé des dépendances (décision du porteur, 18/11 : « relevé par GFS, sans appel externe » : la fenêtre « Dépendances » des réglages lit un fichier daté de
// GFS, le navigateur de la personne n'appelle aucun service). L'outil lit la liste des bibliothèques de GFS (`bibliotheques/package.json`), demande au registre npm
//   - la dernière version STABLE de chaque paquet (jamais une préversion ni une version de développement : le « latest » de DuckDB-WASM en est une) ;
//   - les avis de sécurité publiés pour la version que GFS sert ;
//   - la licence, le site et le dépôt de cette version ;
// et écrit `bibliotheques/releve.json`. Le résultat est commité : aucune étape de construction pour servir.
//
//   node outils/releve-dependances.mjs             refait le relevé (réseau : registry.npmjs.org) ; dans le cloud, NODE_USE_ENV_PROXY=1
//   node outils/releve-dependances.mjs --verifier  dit si le fichier couvre la liste, sans réseau (code de sortie 1 sinon)
//
// Le piège des avis : ils sont inscrits au nom du paquet SOURCE (`plotly.js`), pas du paquet de fichiers que GFS sert (`plotly.js-basic-dist-min`). Interrogé par le
// second nom, le registre répond « aucun avis » (mesuré le 18/11 : avis critique sur plotly.js 2.13.2). PAQUET_DES_AVIS relie les deux ; un essai refuse un paquet
// « -dist-min » de la liste qui n'y est pas (pdfjs-dist est, lui, le paquet source : ses avis sont à son nom).

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, readList } from './bibliotheques.mjs';
import { STABLE_RE, parseVersion, compareVersions, gap } from '../js/apps/version-gap.js';

export { gap }; // l'écart se dit comme dans la fenêtre « Dépendances » : une seule règle (js/apps/version-gap.js)

const REGISTRY = 'https://registry.npmjs.org';
const LEVELS = ['critical', 'high', 'moderate', 'low'];
export const RELEVE_FILE = 'bibliotheques/releve.json';

// Le paquet qui porte les avis d'un paquet de fichiers (« -dist-min ») : le même code, publié sous un autre nom, à la même version.
export const PAQUET_DES_AVIS = { 'plotly.js-basic-dist-min': 'plotly.js' };


// La dernière version stable d'un paquet : la plus haute `x.y.z` sans suffixe, parmi celles qui ne sont pas retirées (`deprecated`).
export function latestStable(versions) {
  const stable = Object.entries(versions || {}).filter(([number, info]) => STABLE_RE.test(number) && !(info && info.deprecated)).map(([number]) => number);
  stable.sort((a, b) => compareVersions(parseVersion(a), parseVersion(b)));
  return stable.length ? stable[stable.length - 1] : null;
}

// La version qui corrige, d'après la plage touchée donnée par le registre (« <6.1.0 », « >=1.0.0 <2.25.2 ») : la borne haute exclue, ou null quand la plage n'en a pas.
export function fixedIn(range) {
  const found = /<\s*(\d+\.\d+\.\d+)\s*$/.exec(range || '');
  return found ? found[1] : null;
}

const levelRank = level => { const rank = LEVELS.indexOf(level); return rank < 0 ? LEVELS.length : rank; };

// Les avis du registre (`advisories/bulk`, réponse pour un paquet) en lignes du relevé, les plus graves d'abord.
export function toAdvisories(items) {
  const byUrl = new Map();
  for (const item of items || []) {
    const url = String(item.url || '');
    byUrl.set(url, {
      id: (/GHSA-[a-z0-9-]+$/i.exec(url) || [url])[0],
      niveau: String(item.severity || 'inconnu'),
      titre: String(item.title || ''),
      url,
      touche: String(item.vulnerable_versions || ''),
      corrigeEn: fixedIn(item.vulnerable_versions),
      cvss: item.cvss && typeof item.cvss.score === 'number' ? item.cvss.score : null,
    });
  }
  return [...byUrl.values()].sort((a, b) => levelRank(a.niveau) - levelRank(b.niveau) || a.id.localeCompare(b.id));
}

// Une adresse de dépôt npm (`git+https://…/x.git`, `git://…`, `github:o/x`) en adresse https lisible, ou null.
export function repositoryLink(repository) {
  const raw = typeof repository === 'string' ? repository : repository && repository.url;
  if (!raw) return null;
  const clean = raw.replace(/^git\+/, '').replace(/^git:\/\//, 'https://').replace(/^ssh:\/\/git@/, 'https://').replace(/\.git$/, '');
  if (/^github:/.test(clean)) return `https://github.com/${clean.slice(7)}`;
  return /^https:\/\/[^\s]+$/.test(clean) ? clean : null;
}

const licenseOf = manifest => {
  const found = manifest.license || (Array.isArray(manifest.licenses) ? manifest.licenses.map(l => l.type).join(' OR ') : null);
  return typeof found === 'string' ? found : (found && found.type) || null;
};

// Les paquets que GFS sert, d'après sa liste : Map paquet → { version, ids } (une bibliothèque de fichier assemblé en contient plusieurs).
export function packagesOfList(packageJson) {
  const packages = new Map();
  const add = (paquet, version, id) => {
    const found = packages.get(paquet) || { version, ids: [] };
    if (found.version !== version) throw new Error(`${paquet} : deux versions dans la liste (${found.version} et ${version})`);
    if (!found.ids.includes(id)) found.ids.push(id);
    packages.set(paquet, found);
  };
  for (const item of readList(packageJson)) {
    if (item.paquets) for (const { paquet, version } of item.paquets) add(paquet, version, item.id);
    else add(item.paquet, item.version, item.id);
  }
  return packages;
}

// Les bibliothèques de GFS et leurs paquets : { id: [paquet, …] }.
const librariesOf = packages => {
  const out = {};
  for (const [paquet, { ids }] of packages) for (const id of ids) (out[id] = out[id] || []).push(paquet);
  return out;
};

const scoped = name => encodeURIComponent(name).replace(/^%40/, '@');

// Le réseau, par défaut : le registre npm. `net.getJson(chemin, entetes)` et `net.postJson(chemin, corps)` rendent le JSON de la réponse.
export function registryNet(fetchFn = fetch) {
  const call = async (path, init) => {
    const reply = await fetchFn(`${REGISTRY}${path}`, init);
    if (!reply.ok) throw new Error(`${path} : ${reply.status}`);
    return reply.json();
  };
  return {
    getJson: (path, headers = {}) => call(path, { headers }),
    postJson: (path, body) => call(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  };
}

// Le relevé d'un paquet : sa dernière stable, l'écart, les avis de la version servie, sa licence, son site et son dépôt.
async function surveyPackage(paquet, version, net) {
  const sourceName = PAQUET_DES_AVIS[paquet] || paquet;
  const [packument, manifest] = await Promise.all([
    net.getJson(`/${scoped(paquet)}`, { accept: 'application/vnd.npm.install-v1+json' }),
    net.getJson(`/${scoped(paquet)}/${version}`),
  ]);
  const body = { [sourceName]: [version] };
  if (sourceName !== paquet) body[paquet] = [version];
  const advisories = await net.postJson('/-/npm/v1/security/advisories/bulk', body);
  const latest = latestStable(packument.versions);
  return {
    version,
    derniere: latest,
    ecart: gap(version, latest),
    ...(sourceName !== paquet ? { paquetAvis: sourceName } : {}),
    avis: toAdvisories(Object.values(advisories || {}).flat()),
    licence: licenseOf(manifest),
    site: manifest.homepage || null,
    depot: repositoryLink(manifest.repository),
  };
}

// Le relevé de toute la liste. `now` : la date du relevé (ISO), pour des essais qui ne dépendent pas de l'horloge.
export async function survey(packageJson, net, now = new Date().toISOString()) {
  const packages = packagesOfList(packageJson);
  const paquets = {};
  for (const paquet of [...packages.keys()].sort()) paquets[paquet] = await surveyPackage(paquet, packages.get(paquet).version, net);
  return { contrat: 0, releve: now, source: REGISTRY.replace('https://', ''), bibliotheques: librariesOf(packages), paquets };
}

// Le fichier couvre-t-il la liste ? Chaque paquet y est avec une version, une dernière stable et ses avis (un tableau), et tout « -dist-min » a son paquet d'avis. Une version
// qui diffère de la liste n'est pas une erreur ici (Dependabot monte la liste, le relevé se refait ensuite) : la fenêtre le dit.
export function checkReleve(releve, packageJson) {
  const problems = [];
  const packages = packagesOfList(packageJson);
  if (!releve || releve.contrat !== 0 || !releve.paquets) return ['le relevé n\'a pas la forme attendue (contrat 0, paquets)'];
  if (Number.isNaN(Date.parse(releve.releve))) problems.push('la date du relevé n\'est pas une date');
  for (const [paquet, { version, ids }] of packages) {
    const found = releve.paquets[paquet];
    if (!found) { problems.push(`${paquet} : absent du relevé (refaire : node outils/releve-dependances.mjs)`); continue; }
    if (!STABLE_RE.test(found.version || '') || !Array.isArray(found.avis)) problems.push(`${paquet} : version ou avis manquants`);
    if (found.derniere !== null && !STABLE_RE.test(found.derniere || '')) problems.push(`${paquet} : la dernière version n'est pas une version stable (${found.derniere})`);
    if (/-dist-min$/.test(paquet) && !PAQUET_DES_AVIS[paquet]) problems.push(`${paquet} : un paquet de fichiers « -dist-min » doit être relié au paquet qui porte ses avis (PAQUET_DES_AVIS)`);
    for (const id of ids) if (!(releve.bibliotheques[id] || []).includes(paquet)) problems.push(`${id} : le relevé ne la relie pas à ${paquet}`);
    if (version !== found.version) problems.push(`AVERTISSEMENT ${paquet} : le relevé est à ${found.version}, la liste à ${version}`);
  }
  return problems;
}

export const readPackageJson = (root = ROOT) => JSON.parse(readFileSync(join(root, 'bibliotheques/package.json'), 'utf8'));

async function main(args) {
  const packageJson = readPackageJson();
  if (args.includes('--verifier')) {
    const problems = checkReleve(JSON.parse(readFileSync(join(ROOT, RELEVE_FILE), 'utf8')), packageJson);
    for (const problem of problems) process.stdout.write(`${problem}\n`);
    process.exitCode = problems.some(problem => !problem.startsWith('AVERTISSEMENT')) ? 1 : 0;
    if (!problems.length) process.stdout.write('Le relevé couvre la liste.\n');
    return;
  }
  const releve = await survey(packageJson, registryNet());
  writeFileSync(join(ROOT, RELEVE_FILE), `${JSON.stringify(releve, null, 2)}\n`);
  const withAdvisories = Object.entries(releve.paquets).filter(([, p]) => p.avis.length);
  process.stdout.write(`${Object.keys(releve.paquets).length} paquets relevés (${releve.releve}), ${withAdvisories.length} avec un avis de sécurité.\n`);
  for (const [paquet, p] of withAdvisories) process.stdout.write(`  ${paquet} ${p.version} : ${p.avis.map(a => `${a.niveau} ${a.id}`).join(', ')}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2)).catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
