// L'endroit de l'explorateur, pour la reprise après un rechargement de la page (js/broker/resume.js) : la vue où la personne est et, dans un dossier, son
// chemin. Du code sans effet de bord sur la page : il lit et pose l'état de l'explorateur (`state`), comme le font `#goFolder` et `#goView` de
// js/explorer/explorer.js, qui dessine ensuite. La recherche, le filtre de type, le tri et la ligne choisie ne se retrouvent pas : un rechargement repart
// d'une liste entière, la personne retrouve l'endroit, pas la manière dont elle le regardait.

import { pathParts } from './explorer-model.js';

// Les vues qu'un rechargement retrouve : un dossier, « Récents », « Favoris », « Partagés avec moi », la corbeille. « Ouverts » n'en est pas une : sa liste est
// gardée en mémoire seulement, elle repart vide, et la vue montrerait une page vide ; un dossier de « Partagés avec moi » n'est pas gardé non plus (il se
// lit après les fichiers de la vue).
export const PLACE_VIEWS = Object.freeze(['folder', 'recent', 'fav', 'shared', 'trash']);

// Où la personne est : { view, path } ; `path` ne vaut que dans un dossier, '' ailleurs (et dans « Ouverts », qui se retrouve à la racine).
export function placeOf(state) {
  const view = PLACE_VIEWS.includes(state.view) ? state.view : 'folder';
  return { view, path: view === 'folder' && state.view === 'folder' ? state.path : '' };
}

// Pose l'endroit sur l'état : une vue inconnue est la racine ; les dossiers du chemin s'ouvrent dans l'arbre, comme à un clic dans un dossier.
export function applyPlace(state, place) {
  const view = PLACE_VIEWS.includes(place.view) ? place.view : 'folder';
  const path = place.view === 'folder' && typeof place.path === 'string' ? place.path : '';
  Object.assign(state, { view, group: null, q: '', type: 'all', sel: null });
  if (view === 'folder') {
    state.path = path;
    for (const part of pathParts(path)) state.open.add(part.path);
  }
}
