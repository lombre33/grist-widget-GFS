// Une question à la personne, dans une fenêtre du widget (charte : jamais `confirm()`). Une fenêtre sur une seule base : le titre et les boutons restent
// en place. Elle passe au-dessus de ce qui est ouvert (Layers), rend le fond inerte, garde Tab dans ses deux boutons et rend le clavier à l'élément
// qui l'avait. La promesse vaut `true` pour le bouton principal, `false` pour « Annuler », Échap ou un clic hors de la fenêtre.

import { h } from './dom.js';
import { Layers } from './layers.js';

// opts : { container, title, message, confirmLabel, cancelLabel, inertTargets() -> [élément] }
export function ask({ container, title, message, confirmLabel, cancelLabel, inertTargets }) {
  const doc = container.ownerDocument;
  const opener = doc.activeElement;
  const openerKey = opener && opener.dataset ? opener.dataset.fk : null;
  return new Promise(resolve => {
    const yes = h('button', { type: 'button', class: 'btn primary', dataset: { fk: 'ask-yes' } }, confirmLabel);
    const no = h('button', { type: 'button', class: 'btn', dataset: { fk: 'ask-no' } }, cancelLabel);
    const root = h('div', { class: 'mod-scrim' },
      h('section', { class: 'mod ask', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'ask-title', 'aria-describedby': 'ask-text' },
        h('header', { class: 'mod-head' }, h('h2', { id: 'ask-title' }, title)),
        h('div', { class: 'ask-body' }, h('p', { id: 'ask-text' }, message)),
        h('footer', { class: 'mod-foot ask-foot' }, no, yes)));
    container.append(root);
    Layers.raise(root, '--z-window');
    const inert = inertTargets().map(target => [target, target.inert]);
    for (const [target] of inert) target.inert = true;

    const close = answer => {
      doc.removeEventListener('keydown', onKey, true);
      root.remove();
      for (const [target, was] of inert) target.inert = was;
      // La ligne qui avait le clavier a pu être redessinée entre-temps : on la retrouve par sa clé.
      const back = opener && opener.isConnected ? opener : (openerKey ? [...container.querySelectorAll('[data-fk]')].find(node => node.dataset.fk === openerKey) : null);
      if (back && typeof back.focus === 'function') back.focus({ preventScroll: true });
      resolve(answer);
    };
    const onKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(false); return; }
      if (event.key !== 'Tab') return;
      event.preventDefault();
      const next = doc.activeElement === yes ? no : yes;
      next.focus();
    };
    doc.addEventListener('keydown', onKey, true);
    yes.addEventListener('click', () => close(true));
    no.addEventListener('click', () => close(false));
    root.addEventListener('pointerdown', event => { if (event.target === root) close(false); });
    try { doc.defaultView.focus(); } catch (error) { /* le cadre garde l'état qu'il avait */ }
    yes.focus({ preventScroll: true });
  });
}
