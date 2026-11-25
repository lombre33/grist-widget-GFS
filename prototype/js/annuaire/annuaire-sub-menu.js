// Le bouton et le menu d'un sous-annuaire (module Annuaire, demande du porteur du 25/11) : un seul bouton dans la barre de la fenêtre (un cadenas : la copie
// est verrouillée par Grist), qui ouvre un petit menu : actualiser la copie, la partager, la supprimer. Chaque geste que la personne ne peut pas faire reste
// dans le menu, grisé, avec sa raison (charte : grisé, jamais masqué) ; le clic la redit. Des fonctions qui construisent des nœuds ; les gestes sont à
// js/annuaire/annuaire-control.js.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openMenu } from '../ui/menu.js';

// Le moment d'une copie, dit à la personne (« 25/11/2026 14:32 »), ou '' quand le texte n'est pas une date.
export function copyDate(at, locale) {
  const date = new Date(at);
  return at && Number.isFinite(date.getTime()) ? date.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' }) : '';
}

// Le bouton de la barre : un cadenas, qui dit ce que le menu contient.
export function subButton(t) {
  const label = t('an.sub.menu');
  return h('button', { type: 'button', class: 'an-ib an-sub-b', title: label, 'aria-label': label, 'aria-haspopup': 'menu',
    dataset: { act: 'sub', fk: 'sub' } },
    icon('lock'));
}

// Le menu d'un sous-annuaire. `state` : { at (le moment de la copie), can: { refresh, share, remove } } ; `run(geste)` : 'refresh', 'share' ou 'remove' (la
// fenêtre du geste dit pourquoi un geste grisé ne se fait pas).
export function openSubMenu({ anchor, host, t, locale, state, run }) {
  const date = copyDate(state.at, locale);
  const item = (key, glyph, name, hint, why) => ({ icon: glyph, label: t(`an.sub.${name}`), hint, greyed: !state.can[key],
    title: state.can[key] ? null : t(why),
    run: () => run(key) });
  openMenu(anchor, [
    item('refresh', 'refresh', 'refresh', date ? t('an.sub.refreshHint', { date }) : t('an.sub.refreshNoDate'), 'an.sub.refreshWhy'),
    item('share', 'users', 'share', t('an.sub.shareHint'), 'an.sub.shareWhy'),
    '-',
    item('remove', 'trash', 'remove', t('an.sub.removeHint'), 'an.sub.removeWhy'),
  ], { host, align: 'right', label: t('an.sub.menu') });
}
