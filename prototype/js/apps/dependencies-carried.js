// Les bibliothèques que chaque app dit charger elle-même, pour la fenêtre « Dépendances » (demande du porteur, 18/11 : « Oui, déclaré par chaque
// app »). Elles viennent du champ `portees` du manifeste (js/apps/manifest-carried.js), que GFS écrit d'après la déclaration de l'app : GFS ne les
// sert pas et n'en vérifie rien. Du code sans effet de bord, qui lit les apps de `modulesModel` ; rien n'est appelé sur le réseau.

import { label } from './manifest.js';
import { carriedAddress, CARRIED_WHEN } from './manifest-carried.js';
import { normalize } from '../ui/search.js';

// Une entrée déclarée, vue de la fenêtre. `served` : les lignes de GFS par nom de paquet, pour dire quand GFS en garde aussi une copie.
function entryOf(item, name, entry, served, lang) {
  const url = carriedAddress(entry.adresse);
  const gfs = entry.paquet ? served.get(entry.paquet) : null;
  const slot = `${item.id}|portee|${entry.id}`;
  return { kind: 'carried', key: slot, slot, app: item.id, appName: name, id: entry.id, name: entry.nom, version: entry.version || null,
    contains: entry.contient || [],
    host: url.hostname, address: url.href, when: entry.quand, note: entry.note ? label(entry.note, lang) : '', paquet: entry.paquet || null,
    gfs: gfs ? { version: gfs.version } : null, gfsUsed: Boolean(gfs && gfs.uses.some(use => use.app === item.id)) };
}

const byWhen = (a, b) => CARRIED_WHEN.indexOf(a.when) - CARRIED_WHEN.indexOf(b.when) || a.name.localeCompare(b.name);

// Les déclarations, une par app qui en a une (même vide : « n'en charge aucune » se distingue de « n'a encore rien dit ») : [{ id, name, installed,
// declared: <combien>, carried: [entrée] }]. Une entrée dont le paquet est déjà servi par GFS à cette app est ôtée : sa ligne est celle de GFS,
// avec sa source à choisir. `rows` : les lignes de js/apps/dependencies-model.js.
export function carriedOf({ modules, lang, rows }) {
  const served = new Map(rows.map(row => [row.paquet, row]));
  const groups = [];
  for (const item of modules.items) {
    if (item.kind !== 'app' || !item.ok || !Array.isArray(item.manifest.portees)) continue;
    const name = label(item.manifest.nom, lang);
    const entries = item.manifest.portees.map(entry => entryOf(item, name, entry, served, lang));
    groups.push({ id: item.id, name, installed: Boolean(item.installed), declared: entries.length,
      carried: entries.filter(entry => !entry.gfsUsed).sort(byWhen) });
  }
  return groups;
}

// Ce que la recherche lit d'une entrée.
export const carriedText = entry => normalize([entry.name, entry.version, entry.host, entry.paquet, entry.appName,
  ...entry.contains].filter(Boolean).join(' '));
