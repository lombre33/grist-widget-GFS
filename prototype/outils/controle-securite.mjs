// Le contrôle de sécurité des apps (cahier 3.2.2, choix du porteur du 18/11 : « un tableau de bord de sécurité » que GFS vérifie lui-même). Pour chaque app du catalogue, il lit
// sa page d'entrée à la référence que GFS a relue, son code quand la copie est là, son `GFS-ETAT.md`, la présence de `.github/dependabot.yml` et de `SECURITY.md`, les avis publiés sur les
// bibliothèques qu'elle déclare (registre npm) et, sur demande, l'empreinte que chaque CDN sert ce jour-là ; il juge S1 à S9 (js/apps/security-rules.js) et écrit
// `bibliotheques/securite.json`, que la fenêtre « Dépendances » lit. Le résultat est commité : aucune étape de construction pour servir, et le navigateur de la personne n'appelle rien.
//
//   node outils/controle-securite.mjs                 lit les apps (copie du sous-module si elle est là, sinon raw.githubusercontent.com) et refait le fichier ; dans le cloud, NODE_USE_ENV_PROXY=1
//   node outils/controle-securite.mjs --empreintes    recalcule aussi l'empreinte de chaque adresse de CDN trouvée (cdnjs, jsDelivr, unpkg, esm.sh) : depuis GitHub Actions ou chez le porteur
//                                                      (ces hôtes sont injoignables du cloud de développement), jamais d'une autre adresse
//   node outils/controle-securite.mjs --sans-avis     ne demande rien au registre npm
//   node outils/controle-securite.mjs --catalogue     ne refait que ce que GFS sert lui-même (signatures npm d'après le relevé ; avec --empreintes, les adresses du catalogue chez le CDN), sans relire les apps
//   node outils/controle-securite.mjs --verifier      dit si le fichier couvre les apps du catalogue, sans réseau (code de sortie 1 sinon)
//
// Sûreté : l'outil ne lit, dans le code d'une app, que des adresses de CDN connus (CDN_HOSTS), en https, sans joker, et suit au plus trois redirections vers ces mêmes hôtes : une app n'a
// aucun moyen de lui faire appeler une adresse de son choix. Il ne pousse rien dans le dépôt d'une app.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './bibliotheques.mjs';
import { integrity } from '../kit/outils/bibliotheques/primitives.mjs';
import { registryNet, surveyPackage } from './releve-dependances.mjs';
import { CATALOGUE } from '../js/apps/catalogue.js';
import { readPage, scanCode, scanRelay, parseState, CDN_HOSTS } from '../js/apps/security-page.js';
import { gradeApp, foundHosts, RULES } from '../js/apps/security-rules.js';
import { gradeS1, gradeS2, gradeS3, gradeS4 } from '../js/apps/security-policy.js';
import { controlCatalogue, checkCatalogue } from './controle-catalogue.mjs';

export const SECURITE_FILE = 'bibliotheques/securite.json';
// Les CDN qui servent un fichier octet pour octet à une version exacte (une empreinte qui change y est un signal) et ceux qui peuvent le reconstruire sans changer de version.
const IMMUTABLE_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net'];
const DEPENDABOT = ['.github/dependabot.yml', '.github/dependabot.yaml'];
const SECURITY = ['SECURITY.md', '.github/SECURITY.md', 'docs/SECURITY.md'];
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0';
const SKIP_DIRS = new Set(['node_modules', '.git', 'vendor', 'dist', 'coverage']);
const MAX_FILE = 1_500_000;

// ─── Ce que le contrôle compare au passage précédent ──────────────────────────────────────────────────────────────────────────────────────────────

const canFetch = url => { try { const u = new URL(url); return u.protocol === 'https:' && CDN_HOSTS.includes(u.hostname) && !url.includes('*'); } catch (error) { return false; } };

// L'empreinte de ce qu'une adresse de CDN sert, ou null (adresse refusée, hors ligne, erreur). Trois redirections au plus, toutes vers un CDN connu.
export async function fingerprintOf(url, fetchFn = fetch, hops = 3) {
  if (!canFetch(url)) return null;
  try {
    const reply = await fetchFn(url, { redirect: 'manual', headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(20000) });
    if (reply.status >= 300 && reply.status < 400 && hops > 0) return fingerprintOf(new URL(reply.headers.get('location'), url).href, fetchFn, hops - 1);
    if (!reply.ok) return null;
    const bytes = Buffer.from(await reply.arrayBuffer());
    return { sha384: integrity(bytes), octets: bytes.length };
  } catch (error) { return null; }
}

const immutable = url => IMMUTABLE_HOSTS.includes(new URL(url).hostname);

// Les empreintes d'une app : celles du passage précédent gardées, les nouvelles calculées ; `changed` : les adresses dont l'empreinte a changé (avec leur nature).
async function fingerprints(urls, previous, env) {
  const known = new Map((previous || []).map(entry => [entry.url, entry]));
  if (!env.withFingerprints) return { list: previous || [], changed: [], computed: false };
  const list = [];
  const changed = [];
  for (const url of urls.filter(canFetch)) {
    const seen = known.get(url);
    const now = await env.fingerprint(url);
    if (!now) { if (seen) list.push(seen); continue; }
    if (seen && seen.sha384 !== now.sha384) changed.push({ url, immuable: immutable(url) });
    list.push({ url, sha384: now.sha384, octets: now.octets, vu: seen && seen.sha384 === now.sha384 ? seen.vu : env.now.slice(0, 10) });
  }
  return { list, changed, computed: true };
}

// Les bibliothèques que l'app déclare avec un paquet npm et une version exacte : leurs avis et leur dernière version (registre npm).
async function declaredLibraries(portees, env) {
  const wanted = (portees || []).filter(entry => entry.paquet && entry.version);
  if (!env.withAdvisories || !wanted.length) return { list: [], advisories: env.withAdvisories ? [] : null };
  const list = [];
  const advisories = [];
  for (const entry of wanted) {
    try {
      const found = await surveyPackage(entry.paquet, entry.version, env.net);
      list.push({ id: entry.id, paquet: entry.paquet, version: entry.version, derniere: found.derniere, ecart: found.ecart, avis: found.avis });
      for (const advisory of found.avis) advisories.push({ paquet: entry.paquet, version: entry.version, niveau: advisory.niveau, id: advisory.id });
    } catch (error) { list.push({ id: entry.id, paquet: entry.paquet, version: entry.version, erreur: String(error.message).slice(0, 120) }); }
  }
  return { list, advisories };
}

// Le site en ligne de l'app : sa politique est-elle celle de la référence ? Sinon, ce que valent S1 à S4 pour lui.
async function liveCheck(app, page, env) {
  const html = await env.read(app, app.entree, 'live');
  if (html === null) return { lue: false };
  const live = readPage(html);
  if (page && JSON.stringify(live.politiques) === JSON.stringify(page.politiques)) return { lue: true, identique: true };
  const p = live.politiques;
  return { lue: true, identique: false, regles: { S1: gradeS1(p), S2: gradeS2(p), S3: gradeS3(p), S4: gradeS4(p) } };
}

// ─── Une app ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export async function controlApp(app, env, previous = null) {
  const html = await env.read(app, app.entree, 'reference');
  const page = html === null ? null : readPage(html);
  const code = env.withCode ? await env.code(app) : { files: {}, lu: false };
  const scanned = scanCode(code.files);
  const state = parseState(await env.read(app, 'GFS-ETAT.md', 'etat'));
  const [dependabot, securityMd] = [await env.exists(app, DEPENDABOT), await env.exists(app, SECURITY)];
  const libraries = await declaredLibraries(app.portees, env);
  const urls = [...new Set([...(page ? page.ressources.map(resource => resource.url) : []), ...scanned])].sort();
  const prints = await fingerprints(urls, previous && previous.empreintes, env);
  const graded = gradeApp({ page, scanned, portees: app.portees, state, dependabot, securityMd, advisories: libraries.advisories, changed: prints.changed, codeRead: code.lu, relayInCode: scanRelay(code.files), served: env.served || [] });
  const count = genre => (page ? page.ressources.filter(resource => resource.genre === genre).length : 0);
  return {
    depot: app.repo, reference: app.commit, entree: app.entree,
    lecture: { page: page !== null, code: code.lu, etat: state.securite !== null || state.adresses !== null, empreintes: prints.computed },
    pages: { scripts: count('script'), feuilles: count('feuille'), carte: count('carte'), enLigne: page ? page.enLigne : 0, politiques: page ? page.politiques.length : 0 },
    ...graded, adressesTrouvees: page ? foundHosts(page, scanned, env.served || []) : [], enLigne: await liveCheck(app, page, env), bibliotheques: libraries.list,
    empreintes: prints.list, empreintesLe: prints.computed ? env.now.slice(0, 10) : (previous && previous.empreintesLe) || null,
  };
}

export async function controle(env, previous = null) {
  const apps = {};
  for (const app of env.apps) apps[app.id] = await controlApp(app, env, previous && previous.apps && previous.apps[app.id]);
  const catalogue = await controlCatalogue(env, previous && previous.catalogue);
  return { contrat: 0, controle: env.now, origine: env.origine, catalogue, apps };
}

// Le fichier couvre-t-il le catalogue ? Chaque app y est avec ses neuf règles, chacune avec un état connu et des motifs.
export function checkSecurite(report, ids = CATALOGUE.map(entry => entry.id)) {
  const problems = [];
  if (!report || report.contrat !== 0 || !report.apps) return ['le contrôle n\'a pas la forme attendue (contrat 0, apps)'];
  if (Number.isNaN(Date.parse(report.controle))) problems.push('la date du contrôle n\'est pas une date');
  problems.push(...checkCatalogue(report.catalogue));
  for (const id of ids) {
    const app = report.apps[id];
    if (!app) { problems.push(`${id} : absente du contrôle (refaire : node outils/controle-securite.mjs)`); continue; }
    for (const rule of RULES) {
      const found = app.regles && app.regles[rule];
      if (!found || !['tenue', 'a-noter', 'non-tenue', 'non-verifiable'].includes(found.etat) || !Array.isArray(found.motifs)) problems.push(`${id} ${rule} : état ou motifs manquants`);
    }
  }
  return problems;
}

// ─── Les lectures réelles ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// Les adresses de CDN que GFS sert lui-même, à des versions et des empreintes qu'il garde (bibliotheques/catalogue.json) : l'app n'a pas à les déclarer.
const servedByGfs = root => JSON.parse(readFileSync(join(root, 'bibliotheques/catalogue.json'), 'utf8')).bibliotheques.map(entry => entry.cdn && entry.cdn.src).filter(Boolean);

// Les entrées du catalogue de GFS (adresse du CDN et empreinte attendue) et le relevé des dépendances (signatures du registre), lus sur disque.
const catalogueEntries = root => JSON.parse(readFileSync(join(root, 'bibliotheques/catalogue.json'), 'utf8')).bibliotheques;
const releveOf = root => (existsSync(join(root, 'bibliotheques/releve.json')) ? JSON.parse(readFileSync(join(root, 'bibliotheques/releve.json'), 'utf8')) : null);

const repoOf = url => /github\.com[/:]([^/]+\/[^/.]+)(?:\.git)?$/.exec(url)[1];

function listApps(root) {
  const modules = readFileSync(join(root, '..', '.gitmodules'), 'utf8');
  return CATALOGUE.map(entry => {
    const manifest = JSON.parse(readFileSync(join(root, entry.manifeste), 'utf8'));
    const path = `prototype/${entry.dossier.replace(/\/$/, '')}`;
    const block = modules.split('[submodule').find(part => part.includes(`"${path}"`));
    const commit = execFileSync('git', ['ls-tree', 'HEAD', path], { cwd: join(root, '..'), encoding: 'utf8' }).split(/\s+/)[2];
    return { id: entry.id, dossier: join(root, entry.dossier), repo: repoOf(/url = (.+)/.exec(block)[1].trim()), commit, entree: manifest.entree, portees: manifest.portees };
  });
}

// Le texte d'une adresse, ou null (introuvable, ou injoignable). `status` dit les deux cas : le code HTTP, ou null si le réseau a échoué.
async function fetchWith(url, wantText) {
  try {
    const reply = await fetch(url, { signal: AbortSignal.timeout(20000) });
    return { status: reply.status, text: reply.ok && wantText ? await reply.text() : null };
  } catch (error) { return { status: null, text: null }; }
}

const getText = async url => (await fetchWith(url, true)).text;

// Le code que l'app écrit : `kit/` (le sous-module du kit de GFS, au même commit que prototype/kit) n'en fait pas partie. Lu, il rendait S8 « tenue » pour toute app
// dont le kit est de la 0.25.0 ou après (ses fichiers `violations*.js`) et S5 « non tenue » pour les adresses d'exemple de son outil de miroir et de ses essais
// (retour d'Automation+ du 19/11) ; le relais que l'app démarre se lit dans SON code (`import '…/kit/js/violations-start.js'`), pas dans le kit.
export function walk(dir, found = {}, root = dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && relative(root, path) !== 'kit') walk(path, found, root);
    } else if (entry.isFile() && /\.(m?js|html)$/.test(entry.name) && statSync(path).size < MAX_FILE) found[path] = readFileSync(path, 'utf8');
  }
  return found;
}

export function realEnv(options = {}, root = ROOT) {
  const apps = listApps(root);
  const local = app => existsSync(join(app.dossier, app.entree));
  const rawUrl = (app, ref, path) => `https://raw.githubusercontent.com/${app.repo}/${ref}/${path}`;
  return {
    apps, now: new Date().toISOString(), origine: process.env.GITHUB_ACTIONS ? 'actions' : 'local',
    withFingerprints: Boolean(options.empreintes), withAdvisories: !options.sansAvis, withCode: apps.some(local), net: registryNet(),
    fingerprint: url => fingerprintOf(url), served: servedByGfs(root), catalogue: catalogueEntries(root), releve: releveOf(root),
    read: async (app, path, where) => {
      if (where === 'live') return getText(`https://${app.repo.split('/')[0]}.github.io/${app.repo.split('/')[1]}/${path}`);
      if (where === 'etat') return getText(rawUrl(app, 'main', path));
      return local(app) && existsSync(join(app.dossier, path)) ? readFileSync(join(app.dossier, path), 'utf8') : getText(rawUrl(app, app.commit, path));
    },
    // Le fichier existe-t-il à la référence ? true ; false (introuvable) ; null (le réseau a échoué : on ne sait pas).
    exists: async (app, paths) => {
      let unknown = false;
      for (const path of paths) {
        if (local(app)) { if (existsSync(join(app.dossier, path))) return true; continue; }
        const { status } = await fetchWith(rawUrl(app, app.commit, path), false);
        if (status === 200) return true;
        if (status !== 404) unknown = true;
      }
      return local(app) || !unknown ? false : null;
    },
    code: async app => (local(app) ? { files: walk(app.dossier), lu: true } : { files: {}, lu: false }),
  };
}

async function main(args) {
  const file = join(ROOT, SECURITE_FILE);
  if (args.includes('--verifier')) {
    const problems = checkSecurite(JSON.parse(readFileSync(file, 'utf8')));
    for (const problem of problems) process.stdout.write(`${problem}\n`);
    process.exitCode = problems.length ? 1 : 0;
    if (!problems.length) process.stdout.write('Le contrôle couvre les apps du catalogue.\n');
    return;
  }
  const previous = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
  if (args.includes('--catalogue')) {
    if (!previous) throw new Error('--catalogue complète un contrôle déjà fait : lancez d\'abord node outils/controle-securite.mjs');
    const env = realEnv({ empreintes: args.includes('--empreintes') });
    const { apps, ...head } = previous;
    writeFileSync(file, `${JSON.stringify({ ...head, catalogue: await controlCatalogue(env, previous.catalogue), apps }, null, 2)}\n`);
    process.stdout.write('Le contrôle du catalogue est refait (les apps ne sont pas relues).\n');
    return;
  }
  const report = await controle(realEnv({ empreintes: args.includes('--empreintes'), sansAvis: args.includes('--sans-avis') }), previous);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`Contrôle du ${report.controle} (${report.origine}) :\n`);
  for (const [id, app] of Object.entries(report.apps)) process.stdout.write(`  ${id.padEnd(13)} ${RULES.map(rule => `${rule}:${app.regles[rule].etat}`).join(' ')}\n`);
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] || '')).href) main(process.argv.slice(2)).catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
