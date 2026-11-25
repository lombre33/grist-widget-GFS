// Les modules que un CDN fabrique à la demande (choix du porteur, 25/11, « toutes les bibliothèques des apps, TipTap compris » : Publipostage+ charge l'éditeur TipTap et ses dépendances
// depuis esm.sh). Ce ne sont pas les octets d'un paquet npm : le CDN les assemble. Le banc suit les imports de proche en proche et dit ce qu'un RSSI regarde : combien de fichiers et d'octets,
// combien ne sont que des aiguillages, si une dépendance n'est pas figée (plage, « latest »), si une relecture rend les mêmes octets, quels hôtes sont appelés.

const DEPTH = 6;
const LIMIT = 300;
// `import … from "x"`, `export … from "x"`, `import "x"`, `import("x")` : écrits à la main ou minifiés (`import{a}from"x"`).
const SPECIFIER = /(?:\bimport|\bexport)\s*(?:[^'";()]*?\bfrom\s*)?["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;

export function specifiersOf(source) {
  const found = new Set();
  for (const match of String(source).matchAll(SPECIFIER)) found.add(match[1] || match[2]);
  return [...found];
}

// L'adresse d'un import : un chemin absolu ou une adresse complète rendent une adresse du même CDN ou d'un autre ; un chemin relatif se lit depuis le fichier. Une adresse qui n'est pas http(s) rend null.
export function resolveSpecifier(specifier, from) {
  try {
    const url = new URL(specifier, from);
    return /^https?:$/.test(url.protocol) ? url.href : null;
  } catch (error) { return null; }
}

// Une dépendance est figée quand son adresse nomme une version exacte (`@1.2.3`) ; une plage (`@^1.0.0`, `@~1`), « latest » ou l'absence de version ne l'est pas. Les aiguillages `node/…` et `gh/…` ne comptent pas.
export function isUnpinned(url) {
  const path = new URL(url).pathname.replace(/^\/(?:\*|v\d+\/|npm\/)?/, '');
  const found = /^(?:@[^/@]+\/)?[^/@]+@([^/?]+)/.exec(path);
  return found ? !/^\d+\.\d+\.\d+(?:[-+][\w.]+)?$/.test(found[1]) : false;
}

const isStub = (reply, source) => reply.octets <= 400 && /^\s*(?:export\s*\*\s*from|\/\*[^]*?\*\/\s*export\s*\*\s*from)/.test(source);
const origin = url => new URL(url).origin;

// Le graphe d'un module : { racine, statut, fichiers, octets, aiguillages, profondeur, nonFiges: [adresse], hotes: [origine], coupe, fichiers: [{ url, octets, sha384, aiguillage, profondeur, cacheControl }] }.
// `get(url)` rend une réponse de curlGet (statut, octets, sha384, corps, entetes). La première lecture parcourt, la seconde (`relire`) refait les mêmes adresses pour comparer les octets.
export async function crawl(root, get, { depth = DEPTH, limit = LIMIT } = {}) {
  const seen = new Map();
  const queue = [{ url: root, depth: 0 }];
  let cut = false;
  while (queue.length) {
    const { url, depth: level } = queue.shift();
    if (seen.has(url)) continue;
    if (seen.size >= limit) { cut = true; break; }
    const reply = await get(url);
    const source = reply.statut === 200 ? reply.corps.toString('utf8') : '';
    seen.set(url, { url, statut: reply.statut, octets: reply.octets, sha384: reply.sha384, aiguillage: reply.statut === 200 && isStub(reply, source), profondeur: level,
      cacheControl: reply.entetes['cache-control'] || null, ms: reply.ms.total });
    if (reply.statut !== 200 || level >= depth || !/javascript|ecmascript/.test(reply.entetes['content-type'] || '')) continue;
    for (const specifier of specifiersOf(source)) {
      const next = resolveSpecifier(specifier, reply.url);
      if (next && !seen.has(next)) queue.push({ url: next, depth: level + 1 });
    }
  }
  const files = [...seen.values()];
  return { racine: root, statut: files[0] ? files[0].statut : 0, fichiers: files.length, octets: files.reduce((total, file) => total + (file.octets || 0), 0),
    aiguillages: files.filter(file => file.aiguillage).length, profondeur: Math.max(0, ...files.map(file => file.profondeur)), nonFiges: files.map(file => file.url).filter(isUnpinned),
    hotes: [...new Set(files.map(file => origin(file.url)))], coupe: cut, erreurs: files.filter(file => file.statut !== 200).length, liste: files };
}

// La relecture : les mêmes adresses lues de nouveau ; { relus, differents: [adresse] }.
export async function reread(graph, get) {
  const different = [];
  for (const file of graph.liste) {
    if (file.statut !== 200) continue;
    const again = await get(file.url);
    if (again.sha384 !== file.sha384) different.push(file.url);
  }
  return { relus: graph.liste.filter(file => file.statut === 200).length, differents: different };
}
