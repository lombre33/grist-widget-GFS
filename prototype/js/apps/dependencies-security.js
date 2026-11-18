// Ce que la fenêtre « Dépendances » montre du contrôle de sécurité des apps (cahier 3.2.2, choix du porteur du 18/11 : « Idem + alertes relayées par les apps
// ») : le verdict de chaque app, règle par règle (S1 à S9), tel que bibliotheques/securite.json le dit (outils/controle-securite.mjs, contrats 2.6 point 18),
// et, pour chaque bibliothèque que l'app déclare charger elle-même, ce que GFS en a retrouvé. Du code sans effet de bord ni réseau : le fichier a été lu par le
// contrôleur ; rien ne s'appelle d'ici. Les textes sont à la vue (js/apps/dependencies-security-view.js) : ici, des états et des codes.

import { label } from './manifest.js';
import { RULES } from './security-rules.js';
import { worst } from './security-policy.js';

const STATES = ['tenue', 'a-noter', 'non-tenue', 'non-verifiable'];
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hostOfUrl = url => { try { return new URL(url).hostname.toLowerCase(); } catch (error) { return ''; } };

// Le fichier a-t-il la forme attendue ? (Un fichier qui ne l'a pas se traite comme absent : la fenêtre le dit.)
export const isReport = report => isObject(report) && report.contrat === 0 && isObject(report.apps) && !Number.isNaN(Date.parse(report.controle));

// Ce que la fenêtre dit de l'origine de l'app d'une règle : GFS l'a lu (`gfs`), l'app le dit seule (`declared`), ou personne n'a pu le vérifier (`none`).
function sourceOf(id, etat) {
  if (id === 'S6') return 'declared';
  return etat === 'non-verifiable' ? 'none' : 'gfs';
}

function ruleOf(app, id) {
  const found = isObject(app.regles) && isObject(app.regles[id]) ? app.regles[id] : { etat: 'non-verifiable', motifs: [] };
  const etat = STATES.includes(found.etat) ? found.etat : 'non-verifiable';
  const says = isObject(app.declaration) && isObject(app.declaration[id]) ? app.declaration[id] : null;
  return { id, etat, motifs: Array.isArray(found.motifs) ? found.motifs : [], notes: Array.isArray(found.notes) ? found.notes : [], source: sourceOf(id, etat),
    says };
}

// Le site en ligne : pas lu, même politique que la référence, ou une autre (avec ce que S1 à S4 en disent).
function liveOf(app) {
  const live = isObject(app.enLigne) ? app.enLigne : { lue: false };
  if (!live.lue) return { etat: 'non-lue' };
  if (live.identique) return { etat: 'identique' };
  const states = isObject(live.regles) ? ['S1', 'S2', 'S3', 'S4'].map(id => (isObject(live.regles[id]) ? live.regles[id].etat : 'non-verifiable')) : [];
  return { etat: 'differe', verdict: worst(states) };
}

// Une app du catalogue : { id, name, installed, reference, checked, policy, counts, rules, permis, live }.
function appOf(item, report, lang) {
  const app = isObject(report.apps[item.id]) ? report.apps[item.id] : null;
  const base = { id: item.id, name: label(item.manifest.nom, lang), installed: Boolean(item.installed) };
  if (!app) return { ...base, checked: false, reference: null, policy: 'non-verifiable',
    counts: { tenue: 0, 'a-noter': 0, 'non-tenue': 0, 'non-verifiable': 0 }, rules: [], permis: null, live: { etat: 'non-lue' } };
  const rules = RULES.map(id => ruleOf(app, id));
  const counts = Object.fromEntries(STATES.map(state => [state, rules.filter(rule => rule.etat === state).length]));
  return { ...base, checked: true, reference: String(app.reference || '').slice(0, 7) || null, entry: app.entree || null,
    policy: worst(rules.slice(0, 4).map(rule => rule.etat)),
    counts, rules, permis: isObject(app.permis) ? app.permis : null, live: liveOf(app), read: isObject(app.lecture) ? app.lecture : {} };
}

// Le tableau de bord : { controle, origine, apps: [app], problems } (apps installées d'abord, puis par nom), ou null sans fichier. `problems` : les règles non
// tenues, toutes apps.
export function securityOf({ report, modules, lang }) {
  if (!isReport(report)) return null;
  const apps = modules.items.filter(item => item.kind === 'app' && item.ok).map(item => appOf(item, report, lang))
    .sort((a, b) => Number(b.installed) - Number(a.installed) || a.name.localeCompare(b.name));
  return { controle: report.controle, origine: report.origine === 'actions' ? 'actions' : 'local', apps,
    problems: apps.reduce((total, app) => total + app.counts['non-tenue'], 0) };
}

// Ce que GFS a retrouvé d'une bibliothèque que l'app déclare (une entrée de `carriedOf`) : l'adresse est-elle dans la page ou le code (`found`: true, false, ou
// null quand l'app n'a pas été lue), la dernière version et les avis du registre (`library`, quand la déclaration a un paquet npm et une version exacte), et
// les empreintes relevées chez ce CDN
// (`prints` : { n, since }). `read` : { page, code } (ce que le contrôle a lu).
export function carriedCheck(report, entry) {
  if (!isReport(report) || !isObject(report.apps[entry.app])) return null;
  const app = report.apps[entry.app];
  const read = isObject(app.lecture) ? app.lecture : {};
  const found = read.page ? (Array.isArray(app.adressesTrouvees) && app.adressesTrouvees.includes(entry.host)) : null;
  const library = (Array.isArray(app.bibliotheques) ? app.bibliotheques : []).find(each => each.id === entry.id) || null;
  const prints = (Array.isArray(app.empreintes) ? app.empreintes : []).filter(print => hostOfUrl(print.url) === entry.host);
  return { found, read: { page: Boolean(read.page), code: Boolean(read.code) }, library,
    prints: { n: prints.length, since: prints.map(print => print.vu).sort().at(-1) || null },
    printsLe: app.empreintesLe || null };
}
