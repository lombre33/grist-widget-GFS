// Ce que la fenêtre « Dépendances » des réglages montre (demande du porteur, 18/11 : « transparent pour les utilisateurs et simple à comprendre et à auditer
// ») : une ligne par paquet que GFS sert, avec ce qui l'utilise, l'état (active, installée mais non utilisée, prête et pas encore servie), la version servie,
// la dernière stable, les avis de sécurité, la licence et les liens. Trois sources, aucun appel externe : le catalogue de GFS (ce qui est servi,
// `bibliotheques/catalogue.json`), le relevé daté (ce que l'outil `outils/releve-dependances.mjs` a lu du registre, `bibliotheques/releve.json`) et les apps
// installées (`modulesModel`). Du code sans effet de bord.

import { label } from './manifest.js';
import { gap } from './version-gap.js';
import { licenceFit } from './licences.js';
import { extensionUnit, nativeUnit, appNames } from './dependencies-source.js';

const STATE_RANK = { active: 0, installed: 1, ready: 2, unused: 3 };
const LEVEL_RANK = { critical: 0, high: 1, moderate: 2, low: 3 };
const UPDATABLE = new Set(['correctif', 'mineure', 'majeure']);

const URL_RE = /^https:\/\/[^\s/]+\.[^\s/]+/;
// Une adresse que la fenêtre peut offrir en lien : https seulement, sans identifiants.
export function safeLink(value) {
  if (typeof value !== 'string' || !URL_RE.test(value)) return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch (error) { return null; }
}

// Les paquets qu'une entrée du catalogue porte : [{ paquet, version }]. Un fichier assemblé (`module`) dit ce qu'il contient ; un script classique est un seul
// paquet, dont le relevé donne le nom (l'id de l'entrée sinon).
function packagesOf(entry, releve) {
  if (entry.forme === 'module') return entry.contient.map(({ paquet, version }) => ({ paquet, version }));
  const names = (releve && releve.bibliotheques && releve.bibliotheques[entry.id]) || [entry.id];
  return names.map(paquet => ({ paquet, version: entry.version }));
}

// Qui utilise quoi : Map('<id>@<version>' d'une bibliothèque du catalogue -> [{ app, appName, what, state, unit }]) d'après les lignes de `modulesModel` ;
// `unit` dit ce que la personne peut choisir pour cette fonction (js/apps/dependencies-source.js).
function usesOf(modules, lang) {
  const uses = new Map();
  const add = (library, use) => { const key = `${library.id}@${library.version}`; uses.set(key, [...(uses.get(key) || []), use]); };
  const names = appNames(modules, lang);
  for (const item of modules.items) {
    if (item.kind === 'ext') {
      const state = item.checked ? 'active' : (item.appInstalled ? 'installed' : 'ready');
      for (const library of item.libraries) add(library, { app: item.app, appName: names.get(item.app) || item.app, what: label(item.extension.nom, lang),
        state, unit: extensionUnit(item, names, lang) });
    } else if (item.kind === 'app' && item.ok) {
      for (const row of item.natives || []) {
        // la copie figée d'une fonction native n'est servie que si la personne l'a choisie ; sinon l'app charge ses propres adresses
        const state = item.installed && row.mode === 'vendorise' ? 'active' : (item.installed ? 'installed' : 'ready');
        for (const library of row.libraries) add(library, { app: item.id, appName: names.get(item.id), what: label(row.group.nom, lang), state,
          unit: nativeUnit(item, row, names, lang) });
      }
    }
  }
  return uses;
}

const unique = list => [...new Set(list)];
// L'état d'une ligne : le meilleur de ses usages (active avant installée avant prête), « unused » quand aucune app ne la demande.
const stateOf = uses => (uses.length ? uses.map(use => use.state).sort((a, b) => STATE_RANK[a] - STATE_RANK[b])[0] : 'unused');
const byState = (a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || a.paquet.localeCompare(b.paquet);
// Les usages sans doublon : `docx` et `docx-charts` sont deux entrées d'une même fonction, la ligne du paquet ne la nomme qu'une fois.
const uniqueUses = uses => [...new Map(uses.map(use => [`${use.app}|${use.what}|${use.state}`, use])).values()];

// Un fichier que GFS sert : ce que la fenêtre vérifie (copie) et ce qu'elle dit des adresses contactées en mode CDN.
const fileOf = entry => ({ id: entry.id, version: entry.version, forme: entry.forme || 'script', poids: entry.poids || 0, copie: entry.vendorise,
  cdn: entry.cdn || null,
  cdnHost: entry.cdn ? new URL(entry.cdn.src).hostname : null, memeEmpreinte: Boolean(entry.cdn) && entry.cdn.integrite === entry.vendorise.integrite });

// L'avis le plus grave d'une liste (ou null).
const worstAdvisory = advisories => [...advisories].sort((a, b) => (LEVEL_RANK[a.niveau] ?? 9) - (LEVEL_RANK[b.niveau] ?? 9))[0] || null;

// `releve` : le fichier lu, ou null quand il manque (la fenêtre le dit et montre quand même ce que GFS sert). Un relevé fait pour une autre version que celle
//   servie ne dit rien de sûr de la version servie : ni avis ni écart, la ligne le signale (`releveAncien`).
function rowOf({ paquet, version, files, uses }, releve) {
  const found = releve && releve.paquets && releve.paquets[paquet];
  const stale = Boolean(found) && found.version !== version;
  const advisories = found && !stale ? found.avis : [];
  const latest = found ? found.derniere : null;
  const state = stateOf(uses);
  const worst = worstAdvisory(advisories);
  const ecart = found ? gap(version, latest) : 'inconnu';
  return {
    key: `${paquet}@${version}`, paquet, version, files, state, uses, advisories, worst, latest, ecart, releveAncien: stale,
      licence: found ? found.licence : null,
    licenceFit: licenceFit(found ? found.licence : null), site: found ? safeLink(found.site) : null, depot: found ? safeLink(found.depot) : null,
    apps: unique(uses.map(use => use.appName)), functions: unique(uses.map(use => use.what)),
    hasCdn: files.some(file => file.cdn), poids: files.reduce((total, file) => total + file.poids, 0),
    updatable: !stale && UPDATABLE.has(ecart), flagged: advisories.length > 0,
  };
}

// Les lignes, les actives d'abord puis par nom. `catalogue` : le résultat de readCatalogue ; `modules` : le résultat de modulesModel ; `lang` : 'fr' ou 'en'.
export function dependencyRows({ catalogue, releve, modules, lang }) {
  const uses = usesOf(modules, lang);
  const byKey = new Map();
  for (const entry of catalogue.entries.values()) {
    for (const { paquet, version } of packagesOf(entry, releve)) {
      const key = `${paquet}@${version}`;
      const row = byKey.get(key) || { paquet, version, files: [], uses: [] };
      row.files.push(fileOf(entry));
      row.uses.push(...(uses.get(`${entry.id}@${entry.version}`) || []));
      byKey.set(key, row);
    }
  }
  return [...byKey.values()].map(row => rowOf({ ...row, uses: uniqueUses(row.uses) }, releve))
    .sort(byState);
}

// Une ligne vue depuis une app (`app` : son id, ou null pour une bibliothèque qu'aucune app ne demande) : ses usages seulement, donc son état, ses
// fonctions et le choix de sa source (js/apps/dependencies-source.js) ne parlent que de cette app ; `all` garde tous les usages (le détail les nomme),
// `others` les autres apps qui la demandent aussi (la mise en commun qu'on cherche à voir). `slot` identifie la ligne dans la fenêtre : une bibliothèque
// s'y trouve une fois par app.
export function scopeRow(row, app) {
  const uses = app === null ? [] : row.uses.filter(use => use.app === app);
  const scope = app === null ? 'none' : app;
  return { ...row, uses, all: row.uses, scope, slot: `${scope}|${row.key}`, state: stateOf(uses),
    apps: unique(uses.map(use => use.appName)), functions: unique(uses.map(use => use.what)),
    others: unique(row.uses.filter(use => use.app !== app).map(use => use.appName)) };
}

// Les lignes rangées par app (demande du porteur, 18/11 : « regroupé par app, par défaut seulement celles des apps activées ») : [{ id, name, installed,
// rows, carried, declared }], les apps par nom, et en dernier ce qu'aucune app ne demande (`id` vide, `name` null). `installed` : l'app est installée (au
// moins un de ses usages n'est pas « prête »). `carried` : ce que l'app déclare charger elle-même (js/apps/dependencies-carried.js, la liste rendue par
// `carriedOf`) ; `declared` : combien elle en déclare, ou null quand elle n'a encore rien déclaré.
export function groupsOf(rows, carried = []) {
  const apps = new Map();
  const loose = [];
  for (const row of rows) {
    if (!row.uses.length) { loose.push(scopeRow(row, null)); continue; }
    for (const use of new Map(row.uses.map(each => [each.app, each])).values()) {
      const group = apps.get(use.app) || { id: use.app, name: use.appName, rows: [], installed: false };
      group.rows.push(scopeRow(row, use.app));
      group.installed = group.installed || row.uses.some(each => each.app === use.app && each.state !== 'ready');
      apps.set(use.app, group);
    }
  }
  for (const own of carried) {
    const group = apps.get(own.id) || { id: own.id, name: own.name, rows: [], installed: false };
    apps.set(own.id, { ...group, installed: group.installed || own.installed, carried: own.carried, declared: own.declared });
  }
  const named = [...apps.values()].map(group => ({ carried: [], declared: null, ...group, rows: group.rows.sort(byState) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return loose.length ? [...named, { id: '', name: null, installed: false, rows: loose.sort(byState), carried: [], declared: null }] : named;
}

// Les filtres de la fenêtre : Toutes, Actives, Mises à jour, Avis.
export const FILTERS = Object.freeze(['all', 'active', 'updates', 'advisories']);
export const matchesFilter = (row, filter) => ({ all: true, active: row.state === 'active', updates: row.updatable, advisories: row.flagged }[filter]);

// Le pied : combien de lignes par filtre et le poids des copies figées.
export function summary(rows) {
  const counts = Object.fromEntries(FILTERS.map(filter => [filter, rows.filter(row => matchesFilter(row, filter)).length]));
  const files = new Map(rows.flatMap(row => row.files).map(file => [file.id, file.poids]));
  return { counts, bytes: [...files.values()].reduce((total, poids) => total + poids, 0) };
}

// Une date ISO en toutes lettres, dans la langue de la personne (UTC : le relevé et le contrôle sont datés en UTC).
export function formatDate(iso, locale) {
  try { return new Date(iso).toLocaleDateString(locale, { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }); }
    catch (error) { return String(iso).slice(0, 10); }
}
