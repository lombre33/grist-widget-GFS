// Les boutons et les repères que « À vérifier », « Écrire au groupe » et « Ma présence » posent dans la fenêtre de l'annuaire (module Annuaire, demande du
// porteur du
// 25/11) : des fonctions qui construisent des nœuds (js/annuaire/annuaire-window.js les place et lit les clics par `data-act`). Grisé, jamais masqué : « À
// vérifier » reste dans la barre pour tout le monde (réservé aux administrateurs : grisé, avec sa raison) ; « Écrire » se grise sans adresse.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { switchButton } from './annuaire-setup-shared.js';

// La pastille de la barre : le triangle d'alerte et le nombre de points (ambre). `state` : { admin, on (au moins un contrôle allumé), total }. Un lecteur qui
// n'est pas administrateur la voit grisée ; sans contrôle allumé, un clic dit où les allumer.
export function checkButton(state, t) {
  const { admin, on, total } = state;
  const label = !admin ? t('an.check.admin') : (!on ? t('an.check.off') : t(total ? 'an.check.tip' : 'an.check.tipNone', { n: total }));
  const flagged = admin && on && total > 0;
  return h('button', { type: 'button', class: `an-ib an-chk-b${flagged ? ' is-flagged' : ''}`, title: label, 'aria-label': label,
    'aria-disabled': admin ? null : 'true',
    dataset: { act: 'check', fk: 'check' } }, icon('warning'), flagged ? h('b', { class: 'an-chk-n', 'aria-hidden': 'true' }, String(total)) : null);
}

// Le bouton « Écrire » de la barre de la liste et de l'organigramme : écrire aux personnes affichées. Grisé quand aucune n'a d'adresse (le survol dit
// pourquoi).
export function mailButton({ count, addresses }, t) {
  const label = addresses ? t('an.mail.tip', { n: count }) : t('an.mail.noAddress');
  return h('button', { type: 'button', class: 'btn sm an-tbtn an-mailbtn', title: label, 'aria-label': label, 'aria-disabled': addresses ? null : 'true',
    dataset: { act: 'mail', fk: 'mail' } }, icon('mail'), h('span', { class: 'an-tb-t' }, t('an.write')));
}

// La pastille d'une personne dont la fiche est masquée (vue d'un administrateur, ou de la personne elle-même).
export const maskedPill = t => h('span', { class: 'an-pill an-masked', title: t('an.pres.maskedTip') }, icon('lock'), t('an.pres.masked'));

// La ligne « Apparaître dans l'annuaire » de la fiche : l'interrupteur et une phrase. `state` : { on (la fiche apparaît), can (la personne qui lit peut changer
// le choix), blocked (ce qui empêche d'écrire : le texte, ou rien) }. Grisé quand elle ne peut pas, avec sa raison.
export function presenceRow(person, state, t) {
  const { on, can, blocked } = state;
  const why = blocked || (can ? '' : t('an.pres.noRight'));
  return h('div', { class: 'an-pres' }, switchButton({ on, label: t('an.pres.label'), fk: 'presence', disabled: Boolean(why), title: why,
    data: { act: 'presence', row: String(person.row) } }),
  h('span', { class: 'an-pres-t' }, h('b', null, t('an.pres.label')), h('small', null, why || t(on ? 'an.pres.on' : 'an.pres.off'))));
}
