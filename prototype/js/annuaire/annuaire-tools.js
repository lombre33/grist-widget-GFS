// Les boutons et les repères que « À vérifier », « Écrire au groupe » et « Ma présence » posent dans la fenêtre de l'annuaire (module Annuaire, demande du
// porteur du
// 25/11) : des fonctions qui construisent des nœuds (js/annuaire/annuaire-window.js les place et lit les clics par `data-act`). Grisé, jamais masqué : « À
// vérifier » reste dans la barre pour tout le monde (réservé aux administrateurs : grisé, avec sa raison) ; « Écrire » se grise sans adresse.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { switchButton } from './annuaire-setup-shared.js';
import { copyDate } from './annuaire-sub-menu.js';

// La pastille de la barre : le triangle d'alerte et le nombre de points (ambre). `state` : { admin, on (au moins un contrôle allumé), total }. Un lecteur qui
// n'est pas administrateur la voit grisée ; sans contrôle allumé, un clic dit où les allumer.
export function checkButton(state, t) {
  const { admin, on, total, sub, merged } = state;
  const label = merged ? t('an.check.merged') : sub ? t('an.check.sub') : !admin ? t('an.check.admin') : (!on ? t('an.check.off') :
    t(total ? 'an.check.tip' : 'an.check.tipNone', { n: total }));
  const flagged = admin && on && total > 0;
  return h('button', { type: 'button', class: `an-ib an-chk-b${flagged ? ' is-flagged' : ''}`, title: label, 'aria-label': label,
    'aria-disabled': admin && !sub && !merged ? null : 'true',
    dataset: { act: 'check', fk: 'check' } }, icon('warning'), flagged ? h('b', { class: 'an-chk-n', 'aria-hidden': 'true' }, String(total)) : null);
}

// Le bouton « Écrire » de la barre de la liste et de l'organigramme : écrire aux personnes affichées. Grisé quand aucune n'a d'adresse (le survol dit
// pourquoi).
export function mailButton({ count, addresses }, t) {
  const label = addresses ? t('an.mail.tip', { n: count }) : t('an.mail.noAddress');
  return h('button', { type: 'button', class: 'btn sm an-tbtn an-mailbtn', title: label, 'aria-label': label, 'aria-disabled': addresses ? null : 'true',
    dataset: { act: 'mail', fk: 'mail' } }, icon('mail'), h('span', { class: 'an-tb-t' }, t('an.write')));
}

// Le pied de la fenêtre : combien de personnes passent la recherche et les filtres et, quand des valeurs sont choisies, lesquelles, avec le moyen de les
// retirer d'un clic (« 10 sur 16 personnes · Titulaire, Siège · Réinitialiser » : la maquette du porteur). `sub` : la copie d'un sous-annuaire (sa date) ;
// `merged` : la vue « Tous mes annuaires » ({ sources, skipped }) ; `chosen` : les valeurs choisies, déjà dites.
export function footNodes({ t, locale, total, found, chosen, sub, merged }) {
  const count = found === total ? t('an.foot.all', { n: total }) : t('an.foot.some', { n: found, total });
  const date = sub ? copyDate(sub.at, locale) : '';
  const stamp = sub ? `${count} · ${date ? t('an.sub.stamp', { date }) : t('an.sub.stampNoDate')}` : count;
  const text = merged ? [count, t('an.merge.foot', { n: merged.sources.filter(each => each.on).length }),
    merged.skipped.length ? t('an.merge.skipped', { names: merged.skipped.join(', ') }) : ''].filter(Boolean).join(' · ') : stamp;
  return [h('span', { class: 'an-foot-t' }, chosen ? `${text} · ${chosen}` : text),
    chosen ? h('button', { type: 'button', class: 'an-reset', dataset: { act: 'filters-reset', fk: 'filters-reset' } }, t('an.filters.reset')) :
      null].filter(Boolean);
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
