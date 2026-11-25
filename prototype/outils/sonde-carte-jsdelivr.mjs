// La sonde de la carte d'importation de l'éditeur chez jsDelivr (choix du porteur, 25/11 : « jsDelivr, pas esm.sh, la copie figée restant au menu de l'app »).
// Avec esm.sh, l'étoile (`*`) laisse les dépendances d'un module à la carte de l'app : une seule copie de ProseMirror. jsDelivr n'a pas cette étoile : le `+esm` d'un paquet importe ses
// dépendances par des adresses absolues (`/npm/<paquet>@<version>/+esm`), à la version que jsDelivr tire de la plage du paquet. La sonde suit ces imports pour chaque nom de la carte d'une app
// et dit, paquet par paquet, quelles versions la page chargerait : une seule et celle de la liste de l'app (la carte n'a alors rien à ramener), ou plusieurs (deux copies de ProseMirror :
// « Adding different instances of a keyed plugin »). Du cloud de développement jsDelivr est injoignable : la sonde se lance depuis GitHub Actions (.github/workflows/sonde-carte-jsdelivr.yml).

import { readFileSync, writeFileSync } from 'node:fs';
import { curlGet } from './banc-cdn-mesure.mjs';
import { crawl } from './banc-cdn-esm.mjs';
import { parseAddress } from './banc-cdn-inventaire.mjs';

const ORIGIN = 'https://cdn.jsdelivr.net/npm';
const addressOf = (name, version, path = '') => `${ORIGIN}/${name}@${version}/${path}+esm`;

// Les racines à suivre pour une app : un `+esm` par nom de sa carte, un par sous-chemin que son code ou ses paquets importent (`@tiptap/pm/model`…).
export function roots(packageJson) {
  const spec = packageJson.gfs && packageJson.gfs.carte;
  if (!spec) return [];
  const deps = packageJson.dependencies || {};
  const out = (spec.paquets || []).map(name => ({ nom: name, adresse: addressOf(name, deps[name]) }));
  for (const [paquet, subs] of Object.entries(spec.sousChemins || {})) {
    for (const sub of Object.keys(subs)) out.push({ nom: `${paquet}/${sub}`, adresse: addressOf(paquet, deps[paquet], `${sub}/`) });
  }
  return out;
}

// Les versions de chaque paquet dans un ensemble d'adresses jsDelivr : Map paquet → Set de versions (les adresses d'un autre hôte, ou d'un autre chemin que `/npm/`, ne comptent pas).
export function versionsOf(urls) {
  const found = new Map();
  for (const url of urls) {
    const parsed = parseAddress(url);
    if (!parsed || parsed.famille !== 'fichier' || parsed.hote !== 'jsdelivr') continue;
    found.set(parsed.paquet, (found.get(parsed.paquet) || new Set()).add(parsed.version));
  }
  return found;
}

// Le verdict par paquet : `ok` (une seule version, celle de la liste), `ecart` (une seule version, ce n'est pas celle de la liste), `doublon` (plusieurs versions), `hors-liste` (un paquet que la liste ne nomme pas).
export function verdicts(found, dependencies) {
  const out = [];
  for (const [paquet, set] of [...found].sort((a, b) => a[0].localeCompare(b[0]))) {
    const versions = [...set].sort();
    const pinned = dependencies[paquet] || null;
    let verdict = 'hors-liste';
    if (versions.length > 1) verdict = 'doublon';
    else if (pinned) verdict = versions[0] === pinned ? 'ok' : 'ecart';
    out.push({ paquet, versions, liste: pinned, verdict });
  }
  return out;
}

// La sonde : chaque racine est suivie (les fichiers déjà lus ne sont pas relus). `get(url)` rend une réponse de curlGet (remplaçable : les essais n'ouvrent aucune connexion).
export async function probe(packageJson, get = curlGet) {
  const cache = new Map();
  const read = url => { if (!cache.has(url)) cache.set(url, get(url)); return cache.get(url); };
  const entries = [];
  for (const root of roots(packageJson)) {
    const graph = await crawl(root.adresse, read, { depth: 6, limit: 400 });
    entries.push({ nom: root.nom, adresse: root.adresse, statut: graph.statut, fichiers: graph.fichiers, octets: graph.octets, erreurs: graph.erreurs, coupe: graph.coupe,
      urls: graph.liste.filter(file => file.statut === 200).map(file => file.url) });
  }
  const all = new Set(entries.flatMap(entry => entry.urls));
  const list = verdicts(versionsOf(all), packageJson.dependencies || {});
  return { lu: new Date().toISOString(), racines: entries.map(({ urls, ...rest }) => rest), fichiers: all.size, paquets: list,
    doublons: list.filter(item => item.verdict === 'doublon'), ecarts: list.filter(item => item.verdict === 'ecart'), urls: [...all].sort() };
}

// Le résumé qu'on lit : les racines absentes, les doublons, les écarts, les paquets hors liste.
export function summarize(result) {
  const lines = [`Sonde de la carte chez jsDelivr, lue le ${result.lu} : ${result.racines.length} racines, ${result.fichiers} fichiers distincts.`];
  const absent = result.racines.filter(root => root.statut !== 200);
  lines.push(`Racines sans réponse 200 : ${absent.length ? absent.map(root => `${root.nom} (${root.statut})`).join(', ') : 'aucune'}.`);
  for (const [title, key] of [['Doublons (plusieurs versions)', 'doublons'], ['Écarts avec la liste de l\'app', 'ecarts']]) {
    lines.push(`${title} : ${result[key].length ? result[key].map(item => `${item.paquet} ${item.versions.join(' + ')} (liste : ${item.liste || '—'})`).join(' ; ') : 'aucun'}.`);
  }
  const outside = result.paquets.filter(item => item.verdict === 'hors-liste');
  lines.push(`Paquets que la liste ne nomme pas : ${outside.length ? outside.map(item => `${item.paquet}@${item.versions.join('+')}`).join(', ') : 'aucun'}.`);
  lines.push(`Conformes à la liste : ${result.paquets.filter(item => item.verdict === 'ok').length} paquets.`);
  return lines.join('\n');
}

async function main() {
  const file = process.argv[2];
  const out = process.argv[3];
  if (!file || !out) { console.error('usage : node outils/sonde-carte-jsdelivr.mjs <package.json de l\'app> <résultat.json>'); process.exit(2); }
  const result = await probe(JSON.parse(readFileSync(file, 'utf8')));
  writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(summarize(result));
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
