// Le banc de comparaison des CDN (choix du porteur, 25/11, « banc complet », critères d'un RSSI). Pour chaque fichier de bibliothèque que GFS ou une app charge chez un CDN (inventaire :
// outils/banc-cdn-inventaire.mjs), il compare jsDelivr, cdnjs et unpkg avec ce que le registre npm a publié, et mesure : le fichier est-il là, rend-il les mêmes octets que l'archive npm, le CDN
// publie-t-il lui-même un chiffre de contrôle et concorde-t-il, de quel protocole, avec quels en-têtes (cache, partage d'origine, cookies), en combien de temps. Pour les modules que esm.sh
// fabrique à la demande (TipTap, chez Publipostage+), il suit les imports (outils/banc-cdn-esm.mjs) et compare esm.sh au `+esm` de jsDelivr. Le résultat est `bibliotheques/banc-cdn.json`
// et un résumé en texte.
//
//   node outils/banc-cdn.mjs              lance le banc (GitHub Actions : .github/workflows/banc-cdn.yml ; du cloud de développement, ces hôtes sont injoignables)
//   node outils/banc-cdn.mjs --essais N   N lectures par adresse (3 par défaut)
//
// Le banc ne lit que des adresses de ces trois CDN, en https, déduites de l'inventaire ; il ne pousse rien dans un dépôt d'app. Mesuré depuis un seul endroit (le centre de données de GitHub) :
// la latence n'est donc qu'une indication, jamais celle d'un poste de la DINUM.

import { resolveCname, resolve4 } from 'node:dns/promises';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './bibliotheques.mjs';
import { readInventory } from './banc-cdn-inventaire.mjs';
import { packageFiles, referenceFor } from './banc-cdn-npm.mjs';
import { curlGet, median, publishedMatches, publishedOf, slowest } from './banc-cdn-mesure.mjs';
import { crawl, reread } from './banc-cdn-esm.mjs';

export const BANC_FILE = 'bibliotheques/banc-cdn.json';
export const CDNS = ['jsdelivr', 'cdnjs', 'unpkg'];
export const HOSTS = { jsdelivr: 'cdn.jsdelivr.net', cdnjs: 'cdnjs.cloudflare.com', unpkg: 'unpkg.com' };
export const ESM_ROOTS = ['@tiptap/starter-kit@3.31.3', '@tiptap/pm@3.31.3', 'lib0@0.2.119'];

export const urlAt = {
  jsdelivr: ({ paquet, version }, chemin) => `https://cdn.jsdelivr.net/npm/${paquet}@${version}/${chemin}`,
  unpkg: ({ paquet, version }, chemin) => `https://unpkg.com/${paquet}@${version}/${chemin}`,
};
const cdnjsUrl = (name, version, file) => `https://cdnjs.cloudflare.com/ajax/libs/${name}/${version}/${file}`;
const baseName = path => path.split('/').at(-1);

// Le fichier que cdnjs publie pour un chemin npm : même chemin, sinon même nom ; à défaut, la variante `.min` (ou son contraire), dite telle. `files` : la liste de l'interface de cdnjs.
export function cdnjsFile(files, chemin) {
  const list = Array.isArray(files) ? files : [];
  const same = list.find(file => file === chemin) || list.find(file => baseName(file) === baseName(chemin));
  if (same) return { fichier: same, rapprochement: 'meme-fichier' };
  const name = baseName(chemin);
  const toggled = name.includes('.min.') ? name.replace('.min.', '.') : name.replace(/\.(js|css)$/, '.min.$1');
  const variant = list.find(file => baseName(file) === toggled);
  return variant ? { fichier: variant, rapprochement: 'variante' } : null;
}

// Cherche la bibliothèque chez cdnjs sous les noms qu'elle peut y porter : { nom, reply, fichier, rapprochement } ou null.
async function findAtCdnjs(unit, env) {
  const names = [...new Set([unit.nomCdnjs, unit.paquet, unit.paquet.replace(/^@[^/]+\//, ''), unit.paquet.replace(/-dist-min$/, '')].filter(Boolean))];
  for (const nom of names) {
    const reply = await env.getJson(`https://api.cdnjs.com/libraries/${nom}/${unit.version}?fields=files,sri`);
    if (!reply || !Array.isArray(reply.files)) continue;
    const found = cdnjsFile(reply.files, unit.chemin);
    if (found) return { nom, reply, ...found };
  }
  return null;
}

// Les unités du banc : un fichier d'un paquet, regroupant les adresses (GFS, apps) qui le chargent. Une adresse dont l'empreinte n'est celle d'aucun fichier du paquet (cdnjs sert parfois une
// variante minifiée) reste une unité à part, mesurée chez son seul CDN : rien n'y est comparable à npm.
export async function planUnits(inventory, env) {
  const cache = new Map();
  const units = new Map();
  for (const entry of inventory.fichiers) {
    if (!cache.has(entry.id)) cache.set(entry.id, await env.files(entry.paquet, entry.version).catch(() => null));
    const files = cache.get(entry.id);
    for (const address of entry.adresses) {
      const reference = files ? referenceFor(files, address) : { chemin: null, sha384: null, octets: null, via: null, identique: false };
      const key = reference.chemin ? `${entry.id}/${reference.chemin}` : address.url;
      const unit = units.get(key) || { id: key, paquet: entry.paquet, version: entry.version, chemin: reference.chemin, reference, nomCdnjs: null, adresses: [], origines: [] };
      if (address.hote === 'cdnjs') unit.nomCdnjs = new URL(address.url).pathname.split('/')[3] || null;
      unit.adresses.push({ url: address.url, hote: address.hote, sha384: address.sha384 });
      unit.origines = [...new Set([...unit.origines, ...address.origines])];
      units.set(key, unit);
    }
  }
  return [...units.values()];
}

// Les adresses à mesurer d'une unité, par CDN : { cdn, url, fichier?, rapprochement?, api? }. Sans fichier npm (une variante), seul le CDN qui la sert est mesuré.
export async function targetsOf(unit, env) {
  if (!unit.chemin) return unit.adresses.map(address => ({ cdn: address.hote, url: address.url, rapprochement: 'variante-du-cdn' }));
  const targets = [{ cdn: 'jsdelivr', url: urlAt.jsdelivr(unit, unit.chemin) }, { cdn: 'unpkg', url: urlAt.unpkg(unit, unit.chemin) }];
  const found = await findAtCdnjs({ ...unit, chemin: unit.chemin }, env);
  targets.push(found ? { cdn: 'cdnjs', url: cdnjsUrl(found.nom, unit.version, found.fichier), fichier: found.fichier, rapprochement: found.rapprochement, api: found.reply }
    : { cdn: 'cdnjs', url: null, absent: true });
  return targets;
}

// Ce que le CDN publie du fichier (hachage ou SRI) : { algo, valeur } ou null ; lu une fois par paquet chez jsDelivr, dans la réponse déjà reçue chez cdnjs, par `?meta` chez unpkg.
async function publishedFor(unit, target, env) {
  if (target.cdn === 'jsdelivr') return publishedOf('jsdelivr', await env.getJson(`https://data.jsdelivr.com/v1/packages/npm/${unit.paquet}@${unit.version}?structure=flat`), unit.chemin);
  if (target.cdn === 'cdnjs') return publishedOf('cdnjs', target.api, target.fichier);
  return publishedOf('unpkg', await env.getJson(`${target.url}?meta`), null);
}

// L'état d'une adresse après ses lectures : identique à npm, différent, absent (404), en erreur, sans référence (rien à comparer), ou variante.
export function stateOf(first, reference) {
  if (first.statut === 404) return 'absent';
  if (first.statut !== 200) return 'erreur';
  if (!reference || !reference.sha384) return 'sans-reference';
  return first.sha384 === reference.sha384 ? 'identique' : 'different';
}

const pick = (entetes, ...names) => Object.fromEntries(names.filter(name => entetes[name]).map(name => [name, entetes[name]]));

// Mesure toutes les adresses, `rounds` fois chacune, dans l'ordre des tours (le premier tour est celui du cache froid) ; rend { url: { essais, premiere } }.
async function measureAll(targets, env, rounds) {
  const results = new Map(targets.map(target => [target.url, { essais: [], premiere: null }]));
  for (let round = 0; round < rounds; round += 1) {
    for (const target of targets) {
      const reply = await env.curl(target.url);
      const entry = results.get(target.url);
      entry.essais.push({ statut: reply.statut, octets: reply.octets, sha384: reply.sha384, http: reply.http, ip: reply.ip, ms: reply.ms, redirections: reply.redirections,
        cache: reply.entetes['cf-cache-status'] || reply.entetes['x-cache'] || reply.entetes.age || null });
      if (round === 0) entry.premiere = reply;
      await env.pause();
    }
  }
  return results;
}

function describe(unit, target, measured, published) {
  const { essais, premiere } = measured;
  const first = essais[0];
  const state = target.absent ? 'absent' : stateOf(first, unit.reference);
  const match = published && premiere && premiere.statut === 200 ? publishedMatches(published, premiere.corps) : null;
  return { cdn: target.cdn, url: target.url, etat: state, rapprochement: target.rapprochement || null, octets: first ? first.octets : null,
    stable: essais.length > 1 ? essais.every(each => each.sha384 === first.sha384) : null, http: first ? first.http : null, ip: first ? first.ip : null,
    publie: published ? { algo: published.algo, concorde: match } : null, entetes: premiere ? pick(premiere.entetes, 'cache-control', 'etag', 'content-type', 'content-encoding',
      'access-control-allow-origin', 'cross-origin-resource-policy', 'x-content-type-options', 'strict-transport-security', 'server', 'via', 'cf-ray', 'x-served-by', 'x-cache',
      'cf-cache-status', 'set-cookie') : {},
    premierOctetMs: essais.map(each => each.ms.premierOctet), totalMs: essais.map(each => each.ms.total), cache: essais.map(each => each.cache) };
}

// Les modules fabriqués : esm.sh et le `+esm` de jsDelivr pour chaque racine ; chaque graphe est parcouru puis relu.
async function esmPart(env) {
  const out = [];
  for (const root of ESM_ROOTS) {
    const entry = { racine: root, esm: null, jsdelivr: null };
    for (const [cdn, url] of [['esm', `https://esm.sh/${root}`], ['jsdelivr', `https://cdn.jsdelivr.net/npm/${root}/+esm`]]) {
      const get = async address => { const reply = await env.curl(address); await env.pause(); return reply; };
      const graph = await crawl(url, get);
      const again = graph.statut === 200 ? await reread(graph, get) : { relus: 0, differents: [] };
      const { liste, ...summary } = graph;
      entry[cdn] = { ...summary, relus: again.relus, differents: again.differents.length, ms: median(liste.map(file => file.ms)) };
    }
    out.push(entry);
  }
  return out;
}

// Les hôtes : ce que le DNS en dit (adresses, alias) ; la version du protocole et l'adresse vues par curl sont dans les mesures.
async function hostsPart(env) {
  const out = {};
  for (const [cdn, host] of Object.entries(HOSTS)) out[cdn] = { hote: host, alias: await env.dns.cname(host).catch(() => []), adresses: await env.dns.a(host).catch(() => []) };
  return out;
}

export async function bench(env, inventory) {
  const units = await planUnits(inventory, env);
  const plan = [];
  for (const unit of units) plan.push({ unit, targets: await targetsOf(unit, env) });
  const flat = plan.flatMap(item => item.targets.filter(target => target.url));
  const measured = await measureAll(flat, env, env.rounds);
  const files = [];
  for (const { unit, targets } of plan) {
    const results = [];
    for (const target of targets) {
      const published = target.url && measured.get(target.url).premiere && measured.get(target.url).premiere.statut === 200 ? await publishedFor(unit, target, env).catch(() => null) : null;
      results.push(target.url ? describe(unit, target, measured.get(target.url), published) : describe(unit, target, { essais: [], premiere: null }, null));
    }
    files.push({ id: unit.id, paquet: unit.paquet, version: unit.version, chemin: unit.chemin, origines: unit.origines, npm: unit.reference.sha384 ? { sha384: unit.reference.sha384, octets: unit.reference.octets } : null,
      cdn: results });
  }
  return { contrat: 0, lu: env.now, essais: env.rounds, depuis: env.from, fichiers: files, esm: await esmPart(env), hotes: await hostsPart(env), depots: inventory.depots.length };
}

// Par CDN : combien de fichiers trouvés, identiques à npm, avec un chiffre publié qui concorde ; latence (médiane et plus lent) du premier octet et du total ; protocoles, cookies, cache.
export function summarize(report) {
  const out = {};
  for (const cdn of CDNS) {
    const rows = report.fichiers.flatMap(file => file.cdn.filter(each => each.cdn === cdn).map(each => ({ ...each, file })));
    const found = rows.filter(row => row.etat === 'identique' || row.etat === 'different' || row.etat === 'sans-reference');
    const comparable = rows.filter(row => row.file.npm && row.etat !== 'sans-reference');
    out[cdn] = { adresses: rows.length, trouvees: found.length, absentes: rows.filter(row => row.etat === 'absent').length, erreurs: rows.filter(row => row.etat === 'erreur').length,
      identiques: rows.filter(row => row.etat === 'identique').length, differents: rows.filter(row => row.etat === 'different').length, comparables: comparable.length,
      variantes: rows.filter(row => row.rapprochement === 'variante').length, publient: rows.filter(row => row.publie).length, concordent: rows.filter(row => row.publie && row.publie.concorde === true).length,
      discordent: rows.filter(row => row.publie && row.publie.concorde === false).length, instables: rows.filter(row => row.stable === false).length,
      premierOctetMs: { mediane: median(rows.flatMap(row => row.premierOctetMs)), plusLent: slowest(rows.flatMap(row => row.premierOctetMs)) },
      totalMs: { mediane: median(rows.flatMap(row => row.totalMs)), plusLent: slowest(rows.flatMap(row => row.totalMs)) },
      http: [...new Set(rows.map(row => row.http).filter(Boolean))].sort(), cookies: rows.filter(row => row.entetes['set-cookie']).length,
      cors: rows.filter(row => row.entetes['access-control-allow-origin'] === '*').length, nosniff: rows.filter(row => row.entetes['x-content-type-options']).length,
      hsts: rows.filter(row => row.entetes['strict-transport-security']).length, caches: [...new Set(rows.map(row => row.entetes['cache-control']).filter(Boolean))].slice(0, 4) };
  }
  return out;
}

const realEnv = (rounds, from) => ({
  files: (paquet, version) => packageFiles(paquet, version),
  getJson: async url => { const reply = await curlGet(url); if (reply.statut !== 200) return null; try { return JSON.parse(reply.corps.toString('utf8')); } catch (error) { return null; } },
  curl: url => curlGet(url), pause: () => new Promise(resolve => { setTimeout(resolve, 150); }), now: new Date().toISOString(), rounds, from,
  dns: { cname: resolveCname, a: resolve4 },
});

async function main(args) {
  const at = args.indexOf('--essais');
  const rounds = at >= 0 ? Math.max(1, Number(args[at + 1]) || 3) : 3;
  const report = await bench(realEnv(rounds, process.env.GITHUB_ACTIONS ? 'GitHub Actions' : 'machine locale'), readInventory(ROOT));
  const withSummary = { ...report, resume: summarize(report) };
  writeFileSync(join(ROOT, BANC_FILE), `${JSON.stringify(withSummary, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(withSummary.resume, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main(process.argv.slice(2)).catch(error => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; });
