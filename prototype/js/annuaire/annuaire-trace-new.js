// « Nouveau local » dans la fenêtre de tracé (module Annuaire, plan des bâtiments, lot 3 ; demande du porteur du 27/11 : « créer un local : nom, usage, places
// »). Une petite fenêtre du widget sur la base commune (js/ui/modal.js) : le nom, l'usage (bureau, salle de réunion, circulation, technique) et les places.
// Elle ne parle pas à
// Grist : le local entre dans le brouillon du tracé (js/annuaire/annuaire-trace.js) et ne s'écrit qu'à « Enregistrer le tracé ». Un lieu de passage ou de
//   service n'a pas de places : le champ reste là, grisé, avec sa raison. Rend { name, use, capacity }, ou null quand la personne renonce.

import { h } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { USES, NO_SEATS } from './annuaire-plan.js';
import { formRow } from './annuaire-setup-shared.js';

// opts : { container, inertTargets(), t, taken (les noms que le lieu parent porte déjà, pour prévenir d'un doublon) }
export function askNewRoom({ container, inertTargets, t, taken = [] }) {
  let use = USES[0];
  const input = h('input', { type: 'text', class: 'an-set-input', autocomplete: 'off', 'aria-label': t('an.tr.newName'), dataset: { fk: 'trn-name' } });
  const seats = h('input', { type: 'number', min: '0', max: '999', value: '1', class: 'an-set-input an-tr-seats', 'aria-label': t('an.tr.newSeats'),
    dataset: { fk: 'trn-seats' } });
  const note = h('span', { class: 'mod-note', 'aria-live': 'polite' });
  const cancel = h('button', { type: 'button', class: 'btn', dataset: { fk: 'trn-cancel' } }, t('an.set.cancel'));
  const ok = h('button', { type: 'button', class: 'btn primary', 'aria-disabled': 'true', dataset: { fk: 'trn-ok' } }, t('an.tr.newOk'));
  const uses = h('div', { class: 'an-seg', role: 'group', 'aria-label': t('an.tr.newUse') }, ...USES.map(each =>
    h('button', { type: 'button', class: 'an-seg-b', 'aria-pressed': String(each === use), dataset: { use: each, fk: `trn-use:${each}` } },
      t(`an.plan.use.${each}`))));
  const seatsHint = h('span', { class: 'an-set-hint' });
  const check = () => {
    const name = input.value.trim();
    const noSeats = NO_SEATS.includes(use);
    seats.setAttribute('aria-disabled', String(noSeats));
    seats.disabled = noSeats;
    seatsHint.textContent = noSeats ? t('an.plan.noSeats') : '';
    const twin = name && taken.some(each => each.toLowerCase() === name.toLowerCase());
    note.textContent = twin ? t('an.tr.newTwin', { name }) : '';
    note.classList.toggle('is-warn', Boolean(twin));
    ok.setAttribute('aria-disabled', name ? 'false' : 'true');
  };
  const section = h('section', { class: 'mod an-nl an-tr-new', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'an-trn-title' },
    h('header', { class: 'mod-head' }, h('h2', { id: 'an-trn-title' }, t('an.tr.newTitle'))),
    h('div', { class: 'mod-body an-set-body' }, formRow(`${t('an.tr.newName')} *`, input), formRow(t('an.tr.newUse'), uses),
      formRow(t('an.tr.newSeats'), h('span', { class: 'an-tr-seatcell' }, seats, seatsHint))),
    h('footer', { class: 'mod-foot' }, note, cancel, ok));
  const { done, result } = openModal({ container, section, inertTargets, first: input, cancel: null });
  const add = () => {
    if (ok.getAttribute('aria-disabled') === 'true') return;
    const capacity = NO_SEATS.includes(use) ? 0 : Math.max(0, Math.min(999, Math.round(Number(seats.value)) || 0));
    done({ name: input.value.trim(), use, capacity });
  };
  uses.addEventListener('click', event => {
    const button = event.target.closest('[data-use]');
    if (!button) return;
    use = button.dataset.use;
    for (const each of uses.children) each.setAttribute('aria-pressed', String(each === button));
    check();
  });
  input.addEventListener('input', check);
  input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); add(); } });
  cancel.addEventListener('click', () => done(null));
  ok.addEventListener('click', add);
  check();
  return result;
}
