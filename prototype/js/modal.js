// La base commune des fenêtres du widget (charte : une seule base, le titre et les boutons fixes) : la fenêtre passe au-dessus de ce qui est ouvert
// (Layers), rend le fond inerte, garde Tab en elle, se ferme sur Échap (jamais sur un clic à côté d'elle : charte, « un clic sur le voile ne ferme rien », décidé le 09/11), et rend le clavier à l'élément qui l'avait,
// retrouvé par sa clé `data-fk` quand il a été redessiné entre-temps. Les fenêtres à liste y prennent aussi leur clavier (`listKeys`).
// Une fenêtre posée par-dessus une autre (la fenêtre « Couleur personnalisée » sur la fenêtre « Thème ») est seule à tenir le clavier : Échap ne ferme que celle du dessus. Un panneau flottant que la
// fenêtre a ouvert (`data-popover`, js/menu.js `openPanel`) garde Échap et Tab quand le clavier est dedans.

import { h } from './dom.js';
import { Layers } from './layers.js';

const FOCUSABLE = 'input:not([disabled]), button:not([disabled]), [tabindex="0"]';
const stack = []; // les fenêtres ouvertes, la dernière est au-dessus

// Les arrêts de Tab d'une fenêtre, d'après ses éléments au clavier : un groupe de boutons radio n'en a qu'un, le coché (sinon le premier), comme dans le navigateur ; les flèches font le reste.
export function tabStops(nodes) {
  return nodes.filter(node => {
    if (node.type !== 'radio' || !node.name) return true;
    const group = nodes.filter(other => other.type === 'radio' && other.name === node.name && other.form === node.form);
    return node === (group.find(other => other.checked) || group[0]);
  });
}

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

// Rend le fond inerte (ni clic ni clavier) et rend la fonction qui, à la fermeture, redonne à chaque élément l'état où il était (l'explorateur en tenait déjà un).
export function holdBackground(targets) {
  const kept = targets.map(target => [target, target.inert]);
  for (const [target] of kept) target.inert = true;
  return () => { for (const [target, was] of kept) target.inert = was; };
}

// Rend le clavier à l'élément qui l'avait avant l'ouverture, quand il est encore dans la page.
export function giveBackFocus(opener) {
  if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
}

// Pose une fenêtre à classe (« Apps et extensions », « Table de travail ») : son fond `root`, déjà bâti, passe au-dessus de ce qui est ouvert (Layers), le fond de la page devient inerte, et
// Échap et Tab s'écoutent sur le document, en capture (ils valent même quand le clavier est tombé sur le fond, et passent avant ceux de l'explorateur). `onKey(événement)` est leur gestionnaire.
// Rend { opener, unmount } : `opener` est l'élément qui avait le clavier (à lui rendre par `giveBackFocus`) ; `unmount()` retire la fenêtre, rend au fond son état et défait l'écoute.
export function mountWindow({ container, root, inertTargets, onKey }) {
  const doc = container.ownerDocument;
  const opener = doc.activeElement;
  container.append(root);
  Layers.raise(root, '--z-window');
  const release = holdBackground(inertTargets());
  doc.addEventListener('keydown', onKey, true);
  return { opener, unmount() { doc.removeEventListener('keydown', onKey, true); root.remove(); release(); } };
}

// opts : { container, section (la fenêtre), inertTargets() -> [élément], first (l'élément qui prend le clavier), cancel (la valeur d'Échap) }.
// Rend { done(valeur), result } : `done` ferme la fenêtre une fois pour toutes, `result` est la promesse de la valeur.
export function openModal({ container, section, inertTargets, first, cancel = null }) {
  const doc = container.ownerDocument;
  const opener = doc.activeElement;
  const openerKey = opener && opener.dataset ? opener.dataset.fk : null;
  const root = h('div', { class: 'mod-scrim' }, section);
  container.append(root);
  Layers.raise(root, '--z-window');
  const release = holdBackground(inertTargets());
  let resolve;
  const result = new Promise(settle => { resolve = settle; });
  let open = true;
  const token = {};
  stack.push(token);
  // Tab et Maj+Tab tournent dans la fenêtre ; un clavier tombé hors d'elle revient sur `first`.
  const onKey = event => {
    if (stack[stack.length - 1] !== token) return;
    if (doc.activeElement && doc.activeElement.closest('[data-popover]')) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); done(cancel); return; }
    if (event.key !== 'Tab') return;
    event.preventDefault();
    const nodes = tabStops([...section.querySelectorAll(FOCUSABLE)].filter(node => !node.closest('[hidden]') && node.tabIndex >= 0));
    const at = nodes.indexOf(doc.activeElement);
    (at < 0 ? first : nodes[(at + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length]).focus();
  };
  const done = value => {
    if (!open) return;
    open = false;
    stack.splice(stack.indexOf(token), 1);
    doc.removeEventListener('keydown', onKey, true);
    root.remove();
    release();
    const back = opener && opener.isConnected ? opener : (openerKey ? [...container.querySelectorAll('[data-fk]')].find(node => node.dataset.fk === openerKey) : null);
    if (back && typeof back.focus === 'function') back.focus({ preventScroll: true });
    resolve(value);
  };
  doc.addEventListener('keydown', onKey, true);
  try { doc.defaultView.focus(); } catch (error) { /* le cadre garde l'état qu'il avait */ }
  first.focus({ preventScroll: true });
  return { done, result };
}
