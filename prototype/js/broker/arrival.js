// L'arrivée de GFS (cahier 6.2, point 2) : quelle app s'ouvre toute seule quand la section démarre. Une section dont les réglages portent une clé qu'un
// manifeste déclare servait à cette app : GFS l'ouvre sans consigne (elle applique son propre ordre d'arrivée ; pour Publipostage+ : la ligne choisie, le
// modèle de la vue, le ★ du document) et sans rien écrire. C'est l'aller-retour sans perte (contrats 7.4, point 7) : changer l'adresse du widget, dans un sens
// ou dans l'autre, retrouve la vue telle qu'elle était. Une app qui garde ce qu'il faut pour rouvrir la vue dans une table du document (Automation+ : son
// graphe, `arrivee` du manifeste) est reconnue par cette table, mais seulement quand aucun réglage de la vue ne parle : un réglage est le choix explicite de la
// vue, la table ne dit que ce que le document contient. Du code sans effet de bord, comme `options-slice.js` : le contrôleur ouvre l'app ; la lecture de la
// table est à `arrival-table.js`.
//
// Pas fait, exprès : le point 1 (l'app de départ `gfs.depart`, que personne n'écrit encore) et le point 3 (une seule app installée : elle s'ouvre). Sans clé
// d'une app, l'explorateur.

import { sliceOf } from './options-slice.js';
import { levelOf } from './filter.js';

// Un réglage qui a une valeur. Une app qui retire un choix écrit `null` (Publipostage+, « Retirer » du modèle de la vue : `setWidgetOption(clé, null)`),
// parfois un texte vide : la clé reste dans l'objet des réglages de la section, mais il n'y a plus de choix.
const isSet = value => value !== undefined && value !== null && value !== '';

// La section porte-t-elle un réglage de cette app ?
function servedBy(allOptions, manifest) {
  const slice = sliceOf(allOptions, manifest.reglages || []);
  return slice !== null && Object.values(slice).some(isSet);
}

// Ne comptent que les apps qu'on peut ouvrir ici : installées (`installed(id)`), et dont l'accès demandé ne dépasse pas celui que Grist a donné à GFS
// (`granted`).
const openableApps = (manifests, { installed, granted }) => manifests.filter(manifest => installed(manifest.id) &&
  levelOf(manifest.permissions.acces) <= levelOf(granted));

// L'app à ouvrir à l'arrivée d'après les réglages de la section, ou null (l'explorateur). `manifests` : ceux des apps valides. Il en faut une seule que la
// section serve : avec deux (la section a servi plusieurs apps tour à tour), GFS ne devine pas.
export function arrivalApp(allOptions, manifests, rules) {
  const served = openableApps(manifests, rules).filter(manifest => servedBy(allOptions, manifest));
  return served.length === 1 ? served[0].id : null;
}

// Les apps dont il faut lire la table pour savoir si la section est la leur : aucune app qu'on peut ouvrir n'est servie par un réglage de la section (avec une,
// ou deux, le réglage a parlé : la table n'est pas lue), et l'app déclare `arrivee`. Vide : rien à lire, l'explorateur.
export function arrivalProbes(allOptions, manifests, rules) {
  const apps = openableApps(manifests, rules);
  if (apps.some(manifest => servedBy(allOptions, manifest))) return [];
  return apps.filter(manifest => manifest.arrivee);
}

const sameName = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

// La table de l'app (telle que `fetchTable` la rend, par colonnes) a-t-elle une ligne pour cette table de vue ? `spec` : l'`arrivee` du manifeste, { table,
// colonne, lignes }. Une colonne absente ne dit rien.
export function tableServes(data, spec, tableId) {
  const column = data && data[spec.colonne];
  if (!column || !Array.isArray(column) || !Array.isArray(data.id)) return false;
  const required = Object.entries(spec.lignes || {});
  return data.id.some((row, index) => sameName(column[index], tableId) && required.every(([name, value]) => Array.isArray(data[name]) &&
    data[name][index] === value));
}

// L'app que la table désigne : `found` est [{ id, spec, data }], une table lue par app (`data` nul quand elle n'existe pas). Une seule app reconnue : elle
// s'ouvre ; deux : GFS ne devine pas.
export function arrivalByTable(found, tableId) {
  const served = found.filter(item => tableServes(item.data, item.spec, tableId));
  return served.length === 1 ? served[0].id : null;
}
