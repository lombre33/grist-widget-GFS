// Les neuf règles de sécurité de la suite, jugées pour une app (cahier 3.2.1) : S1 à S4 d'après sa politique (js/apps/security-policy.js), S5 d'après ses
// adresses et ses empreintes, S6 (déclarée par l'app, GFS ne peut pas la vérifier), S7 d'après son suivi de dépendances et les avis publiés, S8 (relais des
// appels bloqués : le kit n'a pas encore de version qui le permet), S9 d'après son `SECURITY.md`. Du code sans effet de bord ni réseau :
// outils/controle-securite.mjs lui donne ce qu'il a lu.
//
// Chaque règle rend { etat: tenue | a-noter | non-tenue | non-verifiable, motifs: [{ code, gravite, … }], notes? } : des codes et leurs paramètres, que la
// fenêtre met en phrases ; GFS n'écrit aucun texte ici.

import { gradeS1, gradeS2, gradeS3, gradeS4, permitted, sourcesOf, kindOf, worst } from './security-policy.js';

export const RULES = Object.freeze(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9']);
const API_HOST = 'docs.getgrist.com';
const unverifiable = code => ({ etat: 'non-verifiable', motifs: [{ code, gravite: 'non-verifiable' }] });
const result = reasons => ({ etat: worst(reasons.map(reason => reason.gravite)), motifs: reasons });
const hostnameOf = url => { try { return new URL(url).hostname.toLowerCase(); } catch (error) { return null; } };
const uniqueSorted = list => [...new Set(list.filter(Boolean))].sort();

// Les adresses de l'app que GFS a retrouvées : sa page (scripts, feuilles, carte d'importation, politique) et le code qu'il a pu lire. Deux sortent du compte :
// le script d'API de Grist (celui de la plateforme, il ne se déclare pas) et les adresses de CDN que GFS sert lui-même (`served`, le catalogue de GFS : il en
// garde la version et l'empreinte).
export function foundHosts(page, scanned, served = []) {
  const fromPolicy = page.politiques.flatMap(policy => sourcesOf([policy], 'script-src') || []).filter(source => ['host', 'origin'].includes(kindOf(source)))
    .map(source => (/^[a-z]+:\/\//i.test(source) ? source : `https://${source}`));
  const urls = [...page.ressources.map(resource => resource.url), ...scanned, ...fromPolicy].filter(url => !served.includes(url));
  return uniqueSorted(urls.map(hostnameOf)).filter(host => host !== API_HOST);
}

// S5 : chaque bibliothèque chargée de l'extérieur est déclarée, à une adresse que GFS retrouve ; son empreinte ne change pas (`changed` : [{ url, immuable }],
//   les adresses dont l'empreinte a changé depuis le dernier contrôle). `codeRead` : GFS a lu le code de l'app (copie à la référence), pas seulement sa page.
export function gradeS5({ page, scanned = [], portees, changed = [], codeRead = false, served = [] }) {
  const found = foundHosts(page, scanned, served);
  const reasons = [];
  // Un CDN qui sert un fichier octet pour octet à une version exacte (cdnjs, jsDelivr) ne doit jamais le changer : signal. Un autre peut le reconstruire : à
  // noter.
  for (const [immutable, gravite] of [[true, 'non-tenue'], [false, 'a-noter']]) {
    const group = changed.filter(entry => entry.immuable === immutable).map(entry => entry.url);
    if (group.length) reasons.push({ code: 'empreinte-changee', gravite, immuable: immutable, adresses: group.slice(0, 6), nombre: group.length });
  }
  if (!Array.isArray(portees)) return result([...reasons, { code: 'rien-declare', gravite: 'non-verifiable', hotes: found.slice(0, 12) }]);
  const declared = uniqueSorted(portees.map(entry => hostnameOf(entry.adresse))).filter(host => host !== API_HOST);
  const undeclared = found.filter(host => !declared.includes(host));
  if (undeclared.length) reasons.push({ code: 'non-declaree', gravite: 'non-tenue', hotes: undeclared.slice(0, 12) });
  const missing = declared.filter(host => !found.includes(host));
  if (missing.length) reasons.push({ code: 'non-retrouvee', gravite: 'a-noter', hotes: missing.slice(0, 12), codeLu: codeRead });
  const bare = page.ressources.filter(resource => resource.genre !== 'carte' && !resource.empreinte && hostnameOf(resource.url) !== API_HOST);
  if (bare.length) reasons.push({ code: 'sans-empreinte', gravite: 'a-noter', nombre: bare.length });
  return result(reasons);
}

const SERIOUS = ['critical', 'high'];

// S7 : le suivi de dépendances (`dependabot` : le fichier existe ; null : non lisible) et les avis publiés sur les versions que l'app déclare (`advisories`).
export function gradeS7({ dependabot, advisories = null }) {
  const reasons = [];
  if (dependabot === false) reasons.push({ code: 'sans-dependabot', gravite: 'non-tenue' });
  if (dependabot === null) reasons.push({ code: 'dependabot-illisible', gravite: 'non-verifiable' });
  if (advisories === null) reasons.push({ code: 'avis-non-releves', gravite: 'non-verifiable' });
  else if (advisories.length) {
    const grave = advisories.some(advisory => SERIOUS.includes(advisory.niveau));
    reasons.push({ code: 'avis-publie', gravite: grave ? 'non-tenue' : 'a-noter', avis: advisories.slice(0, 8) });
  }
  return result(reasons);
}

// S8 : l'app démarre le relais des appels bloqués du kit (kit 0.25.0). Lu dans la page ou le code ; une page seule ne dit pas non (l'entrée peut charger un
//   module qui le démarre) : GFS l'apprend alors à l'usage, quand l'app dit « relais » (js/broker/security-relay.js).
export function gradeS8({ page, relayInCode = false, codeRead = false }) {
  if (!page) return unverifiable('page-illisible');
  if (page.relais || relayInCode) return { etat: 'tenue', motifs: [] };
  return codeRead ? result([{ code: 'sans-relais', gravite: 'a-noter' }]) : unverifiable('relais-a-lusage');
}

// S9 : un `SECURITY.md` à la racine.
export const gradeS9 = securityMd => (securityMd === true ? { etat: 'tenue', motifs: [] }
  : securityMd === false ? { etat: 'a-noter', motifs: [{ code: 'sans-security-md', gravite: 'a-noter' }] } : unverifiable('security-md-illisible'));

// Tout ce que GFS dit d'une app : { regles: { S1…S9 }, permis, notes }. `declaration` : ce que l'app dit d'elle-même dans son `GFS-ETAT.md` (à côté, jamais
// mêlé).
export function gradeApp(input) {
  const { page, state = null } = input;
  const unread = page ? null : unverifiable('page-illisible');
  const policies = page ? page.politiques : [];
  const rules = {
    S1: unread || gradeS1(policies), S2: unread || gradeS2(policies), S3: unread ||
      gradeS3(policies, state && state.adresses !== null ? { hosts: state.adresses, serveurGrist: state.serveurGrist } : null),
    S4: unread || gradeS4(policies), S5: unread || gradeS5(input), S6: unverifiable('declaree'), S7: gradeS7(input), S8: gradeS8(input),
      S9: gradeS9(input.securityMd),
  };
  return { regles: rules, permis: page ? permitted(policies) : null, declaration: state ? state.securite : null };
}
