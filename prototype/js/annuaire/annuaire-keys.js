// Le clavier des volets de l'annuaire (module Annuaire, demande du porteur du 25/11) : la liste des personnes et la hiérarchie. Des fonctions qui lisent la
// touche et déplacent le clavier ; la fenêtre (js/annuaire/annuaire-window.js) leur donne les nœuds et ce qu'elles doivent déclencher.

import { findNode } from './annuaire-model.js';

// La liste : ↑ et ↓ d'une personne à l'autre (↑ sur la première rend la recherche), ← et → d'une carte à l'autre. `ctx` : { list, view, search }.
export function listKeys(event, active, { list, view, search }) {
  const rows = [...list.querySelectorAll('.an-person, .an-pcard')];
  const move = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
  if (!move || !rows.includes(active)) return;
  if (view === 'list' && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) return; // ← et → ne servent pas dans une liste
  event.preventDefault();
  const next = rows[rows.indexOf(active) + move];
  if (next) { next.focus(); next.scrollIntoView({ block: 'nearest' }); } else if (move < 0) search.focus();
}

// La hiérarchie : ↑ et ↓ d'un nœud à l'autre, → déplie, ← replie (ou remonte au parent). `ctx` : { tree (le volet), root (l'arbre), open (Set des nœuds
// dépliés), toggle(id) }.
export function treeKeys(event, active, { tree, root, open, toggle }) {
  const buttons = [...tree.querySelectorAll('.an-tb')];
  const at = buttons.indexOf(active);
  if (at < 0) return;
  const { id } = active.dataset;
  const node = findNode(root, id);
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    const next = buttons[at + (event.key === 'ArrowDown' ? 1 : -1)];
    if (next) { event.preventDefault(); next.focus(); next.scrollIntoView({ block: 'nearest' }); }
  } else if (event.key === 'ArrowRight' && node && node.ch.length && !open.has(id)) {
    event.preventDefault();
    toggle(id);
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    if (open.has(id) && id) toggle(id);
    else buttons.slice(0, at).reverse().find(each => each.dataset.id !== id && id.startsWith(each.dataset.id))?.focus();
  }
}

// Une fenêtre posée au-dessus de l'annuaire (le réglage, une liste avec recherche) : le clavier est à elle, l'annuaire derrière n'écoute pas (sans cela, Échap
// dans la liste le fermait). `root` : le voile de la fenêtre de l'annuaire.
export function isCovered(root) {
  const host = root.parentElement;
  const later = node => node !== root && node.classList.contains('mod-scrim') && Boolean(root.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING);
  return Boolean(host) && [...host.children].some(later);
}
