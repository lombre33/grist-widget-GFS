// Ce que le contrôle de sécurité dit de ce que GFS sert lui-même (choix du porteur, 25/11 : « CDN vérifié, secours chez GFS »). Les apps sont jugées une à une
// (outils/controle-securite.mjs) ; ici, le catalogue de GFS : chaque adresse de CDN qu'il donne aux apps rend-elle, aujourd'hui, exactement le fichier dont il garde l'empreinte ?
// et chaque paquet npm qu'il sert porte-t-il une signature valide du registre ? La première lecture est celle d'une machine qui atteint les CDN (GitHub Actions, ou le porteur) :
// du cloud de développement, jsDelivr n'est pas joignable. Rien ne se lit dans une app, rien ne se pousse nulle part.

const STATES = ['identique', 'different', 'non-lu'];

// Les adresses du catalogue (`entry.cdn.src` avec l'empreinte attendue), triées par identifiant ; une bibliothèque sans CDN (`cdn: null`) n'en a pas.
const addressesOf = catalogue => (catalogue || []).filter(entry => entry && entry.cdn && entry.cdn.src)
  .map(entry => ({ id: entry.id, url: entry.cdn.src, attendu: entry.cdn.integrite })).sort((a, b) => a.id.localeCompare(b.id));

// Les adresses du catalogue lues chez le CDN. Sans lecture demandée, la dernière lecture est gardée avec sa date (jamais rien d'inventé).
async function cdnPart(env, previous) {
  if (!env.withFingerprints) return previous && Array.isArray(previous.entrees) ? previous : { lu: null, entrees: [] };
  const entrees = [];
  for (const address of addressesOf(env.catalogue)) {
    const now = await env.fingerprint(address.url);
    if (!now) { entrees.push({ ...address, vu: null, octets: null, etat: 'non-lu' }); continue; }
    entrees.push({ ...address, vu: now.sha384, octets: now.octets, etat: now.sha384 === address.attendu ? 'identique' : 'different' });
  }
  return { lu: env.now.slice(0, 10), entrees };
}

// Les signatures du registre npm, d'après le relevé (bibliotheques/releve.json, refait avant le contrôle) : aucun appel de plus.
function npmPart(releve) {
  const list = releve && releve.paquets ? Object.entries(releve.paquets) : [];
  const state = found => (found && typeof found.signature === 'string' ? found.signature : 'non-verifiee');
  const problems = list.filter(([, found]) => ['invalide', 'absente', 'cle-inconnue'].includes(state(found)))
    .map(([paquet, found]) => ({ paquet, version: found.version, signature: state(found) }));
  return {
    releve: releve && releve.releve ? releve.releve : null, paquets: list.length, valides: list.filter(([, found]) => state(found) === 'valide').length,
    nonVerifiees: list.filter(([, found]) => state(found) === 'non-verifiee').length, provenance: list.filter(([, found]) => found && found.provenance === true).length,
    problemes: problems,
  };
}

// `env` : { catalogue (les entrées de bibliotheques/catalogue.json), releve (bibliotheques/releve.json ou null), withFingerprints, fingerprint(url), now }.
export async function controlCatalogue(env, previous = null) {
  return { cdn: await cdnPart(env, previous && previous.cdn), npm: npmPart(env.releve) };
}

// Le morceau du fichier est-il de la forme attendue ? (Rend les problèmes ; vide quand tout va bien ou quand le morceau n'existe pas encore.)
export function checkCatalogue(part) {
  if (part === undefined) return [];
  if (part === null || typeof part !== 'object' || !part.cdn || !Array.isArray(part.cdn.entrees) || !part.npm || !Array.isArray(part.npm.problemes)) {
    return ['le contrôle du catalogue n\'a pas la forme attendue (cdn.entrees, npm.problemes)'];
  }
  return part.cdn.entrees.filter(entry => !STATES.includes(entry.etat)).map(entry => `${entry.id} : état de l'adresse inconnu (${entry.etat})`);
}
