// Ce que l'organigramme dessine d'un annuaire (module Annuaire, retour du porteur du 25/11 : « des filtres sur l'organigramme, les mêmes partout », « par
// défaut déplié jusqu'au niveau le plus bas, et une option pour montrer ou non les gens ») : les éléments des deux organigrammes, réduits par la recherche et
// les filtres de la liste. Du code sans effet de bord, essayé sous Node ; le dessin est à js/annuaire/annuaire-org-view.js et la fenêtre à
// js/annuaire/annuaire-window.js.

import { buildTree, managerTree, withManagers, filterPeople } from './annuaire-model.js';
import { structureItems, managerItems } from './annuaire-items.js';

// Au-delà de ce nombre de personnes, l'organigramme des structures ne dessine plus les personnes sous leur structure (des milliers de petites cartes ne
// tiennent pas dans un panneau) : le bouton « Personnes » se grise et dit pourquoi ; les filtres et la recherche font redescendre sous la limite.
export const PEOPLE_MAX = 400;

// La recherche et les filtres en un texte, vide quand il n'y en a pas : quand il change, l'organigramme se déplie de nouveau jusqu'au niveau le plus bas.
export function orgSignature(query, filters) {
  const chosen = Object.entries(filters).filter(([, set]) => set && set.size > 0).map(([key, set]) => `${key}=${[...set].sort().join('|')}`).sort();
  return [String(query).trim(), ...chosen].join(';');
}

// L'arbre des structures de ce que la recherche et les filtres laissent (celui de l'annuaire quand rien ne filtre) : les comptes et les responsables disent la
// même chose que les cartes.
export const reducedTree = (data, found, signature) => (signature ? buildTree(found, data.config.levels, data.tree.name) : data.tree);

// Les éléments de l'organigramme `mode` ('structures' ou 'managers') : { roots, found (les personnes qui passent), withPeople (les personnes sont dessinées),
// signature }. `wantPeople` : le bouton « Personnes » est allumé ; `linesOf(personne)` : les petites lignes de la carte d'un responsable. Chez les
// responsables, les responsables des personnes trouvées restent pour relier, estompés.
export function orgData({ mode, data, query, filters, wantPeople, linesOf }) {
  const signature = orgSignature(query, filters);
  const found = signature ? filterPeople(data.people, { query, filters }) : data.people;
  const withPeople = mode === 'structures' && wantPeople && found.length <= PEOPLE_MAX;
  const kept = new Set(found.map(person => person.row));
  let roots = [];
  if (found.length && mode === 'managers') {
    roots = managerItems(managerTree(signature ? withManagers(data.people, found) : data.people), linesOf, person => !kept.has(person.row));
  } else if (found.length) roots = structureItems(reducedTree(data, found, signature), data.config.levels, { withPeople });
  return { roots, found, withPeople, signature };
}
