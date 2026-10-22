// L'arrivée de GFS (cahier 6.2, point 2) : quelle app s'ouvre toute seule quand la section démarre. Une section dont les réglages portent une clé qu'un manifeste déclare
// servait à cette app : GFS l'ouvre sans consigne (elle applique son propre ordre d'arrivée ; pour Publipostage+ : la ligne choisie, le modèle de la vue, le ★ du document) et sans
// rien écrire. C'est l'aller-retour sans perte (contrats 7.4, point 7) : changer l'adresse du widget, dans un sens ou dans l'autre, retrouve la vue telle qu'elle était.
// Du code sans effet de bord, comme `options-slice.js` : le contrôleur ouvre l'app.
//
// Pas fait, exprès : le point 1 (l'app de départ `gfs.depart`, que personne n'écrit encore) et le point 3 (une seule app installée : elle s'ouvre). Sans clé d'une app, l'explorateur.

import { sliceOf } from './options-slice.js';
import { levelOf } from './filter.js';

// Un réglage qui a une valeur. Une app qui retire un choix écrit `null` (Publipostage+, « Retirer » du modèle de la vue : `setWidgetOption(clé, null)`), parfois un texte vide : la clé
// reste dans l'objet des réglages de la section, mais il n'y a plus de choix.
const isSet = value => value !== undefined && value !== null && value !== '';

// La section porte-t-elle un réglage de cette app ?
function servedBy(allOptions, manifest) {
  const slice = sliceOf(allOptions, manifest.reglages || []);
  return slice !== null && Object.values(slice).some(isSet);
}

// L'app à ouvrir à l'arrivée, ou null (l'explorateur). `manifests` : ceux des apps valides. Ne comptent que les apps qu'on peut ouvrir ici : installées (`installed(id)`), et dont l'accès
// demandé ne dépasse pas celui que Grist a donné à GFS (`granted`). Il en faut une seule que la section serve : avec deux (la section a servi plusieurs apps tour à tour), GFS ne devine pas.
export function arrivalApp(allOptions, manifests, { installed, granted }) {
  const openable = manifests.filter(manifest => installed(manifest.id) && levelOf(manifest.permissions.acces) <= levelOf(granted));
  const served = openable.filter(manifest => servedBy(allOptions, manifest));
  return served.length === 1 ? served[0].id : null;
}
