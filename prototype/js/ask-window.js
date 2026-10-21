// Une question à la personne, dans une fenêtre du widget (charte : jamais `confirm()`), sur la base commune des fenêtres (js/modal.js) : le titre et les
// boutons restent en place, Tab reste dans ses boutons. La promesse vaut `true` pour le bouton principal, `false` pour « Annuler », Échap ou un clic hors
// de la fenêtre. Sans `cancelLabel`, la fenêtre n'a que son bouton principal (un compte rendu) ; `items` ajoute une liste sous le message.

import { h } from './dom.js';
import { openModal } from './modal.js';

// opts : { container, title, message, items?, confirmLabel, cancelLabel?, inertTargets() -> [élément] }
export function ask({ container, title, message, items = [], confirmLabel, cancelLabel = null, inertTargets }) {
  const yes = h('button', { type: 'button', class: 'btn primary', dataset: { fk: 'ask-yes' } }, confirmLabel);
  const no = cancelLabel ? h('button', { type: 'button', class: 'btn', dataset: { fk: 'ask-no' } }, cancelLabel) : null;
  const list = items.length ? [h('ul', { class: 'ask-items' }, ...items.map(item => h('li', {}, item)))] : [];
  const section = h('section', { class: 'mod ask', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'ask-title', 'aria-describedby': 'ask-text' },
    h('header', { class: 'mod-head' }, h('h2', { id: 'ask-title' }, title)),
    h('div', { class: 'ask-body' }, h('p', { id: 'ask-text' }, message), ...list),
    h('footer', { class: 'mod-foot ask-foot' }, ...(no ? [no] : []), yes));
  const { done, result } = openModal({ container, section, inertTargets, first: yes, cancel: false });
  yes.addEventListener('click', () => done(true));
  if (no) no.addEventListener('click', () => done(false));
  return result;
}
