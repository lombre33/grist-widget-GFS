// La base commune des fenêtres du widget (charte : une seule base, le titre et les boutons fixes) : la fenêtre passe au-dessus de ce qui est ouvert
// (Layers), rend le fond inerte, garde Tab en elle, se ferme sur Échap ou sur un clic hors d'elle, et rend le clavier à l'élément qui l'avait,
// retrouvé par sa clé `data-fk` quand il a été redessiné entre-temps. Les fenêtres à liste y prennent aussi leur clavier (`listKeys`).

import { h } from './dom.js';
import { Layers } from './layers.js';

const FOCUSABLE = 'input, button:not([disabled])';

// Au-delà, une liste demande d'affiner la recherche : vingt mille boutons ralentiraient la fenêtre sans aider personne.
export const LIST_SHOWN = 200;

// Le clavier d'une liste à recherche : les flèches vont de la recherche à la liste et d'un article à l'autre (la flèche du haut sur le premier revient à la
// recherche) ; Entrée dans la recherche choisit le seul article qui reste. Rend true quand la touche a servi.
export function listKeys(event, { search, items }) {
  const active = search.ownerDocument.activeElement;
  const at = items.indexOf(active);
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    const step = event.key === 'ArrowDown' ? 1 : -1;
    const next = at < 0 ? (step > 0 ? items[0] : null) : (items[at + step] || (step < 0 ? search : null));
    if (next) { event.preventDefault(); next.focus(); next.scrollIntoView({ block: 'nearest' }); }
    return true;
  }
  if (event.key === 'Enter' && active === search && items.length === 1) { event.preventDefault(); items[0].click(); return true; }
  return false;
}

// opts : { container, section (la fenêtre), inertTargets() -> [élément], first (l'élément qui prend le clavier), cancel (la valeur d'Échap et du clic dehors) }.
// Rend { done(valeur), result } : `done` ferme la fenêtre une fois pour toutes, `result` est la promesse de la valeur.
export function openModal({ container, section, inertTargets, first, cancel = null }) {
  const doc = container.ownerDocument;
  const opener = doc.activeElement;
  const openerKey = opener && opener.dataset ? opener.dataset.fk : null;
  const root = h('div', { class: 'mod-scrim' }, section);
  container.append(root);
  Layers.raise(root, '--z-window');
  const inert = inertTargets().map(target => [target, target.inert]);
  for (const [target] of inert) target.inert = true;
  let resolve;
  const result = new Promise(settle => { resolve = settle; });
  let open = true;
  // Tab et Maj+Tab tournent dans la fenêtre ; un clavier tombé hors d'elle revient sur `first`.
  const onKey = event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); done(cancel); return; }
    if (event.key !== 'Tab') return;
    event.preventDefault();
    const nodes = [...section.querySelectorAll(FOCUSABLE)].filter(node => !node.closest('[hidden]'));
    const at = nodes.indexOf(doc.activeElement);
    (at < 0 ? first : nodes[(at + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length]).focus();
  };
  const done = value => {
    if (!open) return;
    open = false;
    doc.removeEventListener('keydown', onKey, true);
    root.remove();
    for (const [target, was] of inert) target.inert = was;
    const back = opener && opener.isConnected ? opener : (openerKey ? [...container.querySelectorAll('[data-fk]')].find(node => node.dataset.fk === openerKey) : null);
    if (back && typeof back.focus === 'function') back.focus({ preventScroll: true });
    resolve(value);
  };
  doc.addEventListener('keydown', onKey, true);
  root.addEventListener('pointerdown', event => { if (event.target === root) done(cancel); });
  try { doc.defaultView.focus(); } catch (error) { /* le cadre garde l'état qu'il avait */ }
  first.focus({ preventScroll: true });
  return { done, result };
}
