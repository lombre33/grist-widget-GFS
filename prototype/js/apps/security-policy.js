// La politique de sécurité du contenu d'une page d'app, lue et jugée d'après les règles de sécurité de la suite (cahier 3.2.1, S1 à S4 ; guide des
// apps 1.4). Du code sans effet de bord ni réseau : le contrôle (outils/controle-securite.mjs) lui donne le texte des balises `<meta>` d'une page ; la fenêtre
// « Dépendances » n'en lit que le résultat, écrit dans bibliotheques/securite.json.
//
// Ce qui est jugé est ce que la page DIT : la politique est appliquée par le navigateur, jamais par GFS, qui ne peut en imposer aucune à un sous-cadre
// (contrats 2.6, point 1 ; faits vérifiés 133). Un jugement dit « tenue », « à noter », « non tenue » ; chaque motif est un code et ses paramètres, que
// la fenêtre met en phrases (français et anglais).

// Les directives qui disent d'où la page charge quelque chose, et celles qui disent ce qu'elle peut appeler ou intégrer.
export const FETCH_DIRECTIVES = Object.freeze(['script-src', 'style-src', 'img-src', 'font-src', 'connect-src', 'media-src', 'frame-src', 'worker-src',
  'object-src']);
export const CALL_DIRECTIVES = Object.freeze(['connect-src', 'img-src', 'font-src', 'media-src', 'frame-src', 'worker-src']);
const FALLBACK = Object.freeze({ 'frame-src': ['frame-src', 'child-src', 'default-src'],
  'worker-src': ['worker-src', 'child-src', 'script-src', 'default-src'] });
const RANK = { 'non-tenue': 3, 'a-noter': 2, 'non-verifiable': 1, tenue: 0 };

// Le texte d'une politique : { directive: [sources] }. Une directive écrite deux fois compte pour la première, comme dans le navigateur.
export function parsePolicy(text) {
  const directives = {};
  for (const part of String(text || '').split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    const key = (name || '').toLowerCase();
    if (key && !Object.hasOwn(directives, key)) directives[key] = sources;
  }
  return directives;
}

const isNone = sources => sources.length === 1 && sources[0].toLowerCase() === "'none'";

// Les sources que la politique donne vraiment à une directive : la sienne, sinon celle de repli (`default-src` le plus souvent) ; null si rien ne la limite.
// Plusieurs politiques s'appliquent toutes : on garde la plus étroite (« 'none' » d'abord, puis la plus courte), sans calculer l'intersection exacte.
export function sourcesOf(policies, name) {
  const chain = FALLBACK[name] || [name, 'default-src'];
  const found = policies.map(policy => { const key = chain.find(candidate => Object.hasOwn(policy, candidate)); return key ? policy[key] : null; }).filter(
    Boolean);
  if (!found.length) return null;
  return found.find(isNone) || found.reduce((best, sources) => (sources.length < best.length ? sources : best));
}

// Ce qu'est une source : none, self, hash, nonce, keyword ('unsafe-eval'…), wildcard (`*`), scheme (`https:`), host-wildcard (`*.exemple.fr`), origin (un hôte
// sans chemin) ou host (un hôte et un chemin : une adresse exacte).
export function kindOf(source) {
  const value = source.toLowerCase();
  if (value === "'none'") return 'none';
  if (value === "'self'") return 'self';
  if (/^'sha(256|384|512)-/.test(value)) return 'hash';
  if (value.startsWith("'nonce-")) return 'nonce';
  if (value.startsWith("'")) return 'keyword';
  if (value === '*') return 'wildcard';
  if (/^[a-z][a-z0-9+.-]*:$/.test(value)) return 'scheme';
  if (/^([a-z]+:\/\/)?\*\./.test(value)) return 'host-wildcard';
  const path = value.replace(/^[a-z]+:\/\//, '').split(/[?#]/)[0];
  return path.includes('/') && path.split('/').slice(1).join('') !== '' ? 'host' : 'origin';
}

// L'hôte d'une source (sans schéma, sans port, sans chemin), ou null.
export function hostOf(source) {
  const match = /^(?:[a-z]+:\/\/)?([^/:?#]+)/i.exec(source);
  return match && match[1].includes('.') ? match[1].toLowerCase() : null;
}

const hosts = sources => [...new Set(sources.filter(source => ['host', 'origin'].includes(kindOf(source))).map(hostOf).filter(Boolean))];

// La plus grave des issues.
export const worst = states => states.reduce((top, state) => (RANK[state] > RANK[top] ? state : top), 'tenue');
const verdict = reasons => ({ etat: worst(reasons.map(reason => reason.etat)), motifs: reasons.map(({ etat, ...reason }) => ({ ...reason, gravite: etat })) });
const hasKind = (sources, ...kinds) => sources.filter(source => kinds.includes(kindOf(source)));

// S1 : une politique dans la page.
export function gradeS1(policies) {
  return policies.length ? { etat: 'tenue', motifs: [] } : { etat: 'non-tenue', motifs: [{ code: 'aucune-politique', gravite: 'non-tenue' }] };
}

// S2 : aucune directive de récupération laissée ouverte ; `base-uri` et `form-action` ne se replient pas sur `default-src` et se disent « 'none' ».
export function gradeS2(policies) {
  if (!policies.length) return { etat: 'non-tenue', motifs: [{ code: 'aucune-politique', gravite: 'non-tenue' }] };
  const open = FETCH_DIRECTIVES.filter(name => sourcesOf(policies, name) === null);
  const reasons = open.length ? [{ etat: 'non-tenue', code: 'directives-ouvertes', directives: open }] : [];
  for (const name of ['base-uri', 'form-action']) {
    const sources = policies.map(policy => policy[name]).filter(Boolean);
    if (!sources.some(isNone)) reasons.push({ etat: 'a-noter', code: sources.length ? 'directive-large' : 'directive-absente', directive: name });
  }
  if (policies.some(policy => (policy['style-src'] || []).includes("'unsafe-inline'"))) reasons.push({ etat: 'a-noter', code: 'style-en-ligne' });
  return verdict(reasons);
}

// Les adresses que la politique laisse atteindre : un hôte par ligne, avec les directives qui le nomment. `ouvert` : les directives sans limite.
export function permitted(policies) {
  const byHost = new Map();
  const open = [];
  // Un worker sans directive à lui replie sur `script-src` : ses adresses sont déjà jugées en S4, elles ne sont pas des appels.
  const ownWorker = policies.some(policy => policy['worker-src'] || policy['child-src']);
  for (const name of CALL_DIRECTIVES) {
    const sources = sourcesOf(policies, name);
    if (sources === null) { open.push(name); continue; }
    if (name === 'worker-src' && !ownWorker) continue;
    for (const host of hosts(sources)) byHost.set(host, [...(byHost.get(host) || []), name]);
  }
  return { ouvert: open, adresses: [...byHost].map(([host, directives]) => ({ hote: host, directives })).sort((a, b) => a.hote.localeCompare(b.hote)) };
}

const SCHEMES_BY_DIRECTIVE = { 'img-src': ['data:'], 'font-src': ['data:'], 'media-src': ['data:', 'blob:'] };

// Ce qu'une directive d'appel ouvre de trop : un joker ou un schéma entier (sauf `data:` pour une image ou une police), ou `blob:` pour un worker (à noter).
// Une app qui appelle le serveur Grist de la personne (jeton d'accès) ne peut pas nommer cet hôte : son `https:` seul, dit dans ses « Adresses que l'app
// appelle » (`serveurGrist`), est « à noter » au lieu de « non tenue ».
function wideReasons(policies, name, serveurGrist) {
  const sources = sourcesOf(policies, name) || [];
  const allowed = SCHEMES_BY_DIRECTIVE[name] || [];
  const wide = hasKind(sources, 'wildcard', 'host-wildcard', 'scheme').filter(source => !allowed.includes(source.toLowerCase()) &&
    !(name === 'worker-src' && source.toLowerCase() === 'blob:'));
  const grist = serveurGrist && ['connect-src', 'img-src', 'media-src'].includes(name) ? wide.filter(source => source.toLowerCase() === 'https:') : [];
  const rest = wide.filter(source => !grist.includes(source));
  const reasons = rest.length ? [{ etat: 'non-tenue', code: 'source-large', directive: name, sources: rest.slice(0, 6) }] : [];
  if (grist.length) reasons.push({ etat: 'a-noter', code: 'https-serveur-grist', directive: name });
  if (name === 'worker-src' && sources.some(source => source.toLowerCase() === 'blob:')) reasons.push({ etat: 'a-noter', code: 'worker-blob' });
  return reasons;
}

// S3 : appels sortants fermés : rien d'ouvert, aucun joker ni schéma entier ; chaque adresse est dite par l'app (`declared` : { hosts, serveurGrist } d'après
//   sa section « Adresses que l'app appelle », ou null si elle n'a pas la section).
export function gradeS3(policies, declared = null) {
  if (!policies.length) return { etat: 'non-tenue', motifs: [{ code: 'aucune-politique', gravite: 'non-tenue' }] };
  const { ouvert, adresses } = permitted(policies);
  const reasons = ouvert.length ? [{ etat: 'non-tenue', code: 'appels-ouverts', directives: ouvert }] : [];
  for (const name of CALL_DIRECTIVES) reasons.push(...wideReasons(policies, name, Boolean(declared && declared.serveurGrist)));
  const named = adresses.map(address => address.hote);
  const unsaid = declared === null ? named : named.filter(host => !declared.hosts.includes(host));
  if (unsaid.length) reasons.push({ etat: 'a-noter', code: declared === null ? 'section-absente' : 'adresses-non-dites', hotes: unsaid.slice(0, 12) });
  return verdict(reasons);
}

const API_ADDRESS = /^https:\/\/docs\.getgrist\.com\/grist-plugin-api\.js$/i;
const VERSIONED = /@\d|\/\d+\.\d+|\d+\.\d+\.\d+|\/v\d+[/.]/;

// S4 : scripts nommés : jamais d'origine entière, de joker, de `'unsafe-inline'`, de `data:` ni de `blob:` ; une adresse versionnée ; `'unsafe-eval'` est
//   permis (le script d'API de Grist l'exige).
export function gradeS4(policies) {
  if (!policies.length) return { etat: 'non-tenue', motifs: [{ code: 'aucune-politique', gravite: 'non-tenue' }] };
  const sources = sourcesOf(policies, 'script-src');
  if (sources === null) return verdict([{ etat: 'non-tenue', code: 'scripts-ouverts' }]);
  const reasons = [];
  if (sources.some(source => source.toLowerCase() === "'unsafe-inline'")) reasons.push({ etat: 'non-tenue', code: 'script-en-ligne' });
  const wide = hasKind(sources, 'wildcard', 'host-wildcard', 'scheme').concat(hasKind(sources, 'origin'));
  if (wide.length) reasons.push({ etat: 'non-tenue', code: 'source-large', directive: 'script-src', sources: wide.slice(0, 6) });
  const unversioned = hasKind(sources, 'host').filter(source => !API_ADDRESS.test(source) && !VERSIONED.test(source));
  if (unversioned.length) reasons.push({ etat: 'a-noter', code: 'sans-version', nombre: unversioned.length, exemples: unversioned.slice(0, 4) });
  const notes = ["'unsafe-eval'", "'wasm-unsafe-eval'"].filter(word => sources.some(source => source.toLowerCase() === word));
  const result = verdict(reasons);
  return notes.length ? { ...result, notes } : result;
}
