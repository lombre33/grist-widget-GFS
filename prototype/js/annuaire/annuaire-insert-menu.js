// Le bouton « Insérer dans… » de la fiche et son menu (module Annuaire, demande du porteur du 25/11, scène 15 de la maquette ; contrats 2.7, point 8, et 5.4,
// point 16) : poser la personne de la fiche dans une app qui accepte d'en recevoir une. Une ligne par app que le manifeste déclare ; une app qu'il faut d'abord
// activer ou qui ne sait pas encore recevoir une personne reste dans le menu, grisée, avec sa raison (charte : grisé, jamais masqué), et le clic la redit.
// Des fonctions qui construisent des nœuds ; le geste d'ouvrir l'app est à js/annuaire/annuaire-control.js.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openMenu } from '../ui/menu.js';
import { personPayload } from './annuaire-pick.js';

// Le bouton de la fiche : grisé, jamais masqué, quand rien n'est à choisir (le clic dit pourquoi) ; le menu s'ouvre sous lui.
export function insertButton(person, t) {
  return h('button', { type: 'button', class: 'btn sm an-insert-b', title: t('an.link.insertTip'), 'aria-haspopup': 'menu',
    dataset: { act: 'insert', row: String(person.row), fk: 'insert' } }, icon('link'), t('an.link.insert'));
}

// L'annuaire d'où vient une personne : celui qu'on regarde ; dans la vue fusionnée, le premier qui la cite.
export function originOf(person, current, t) {
  if (!current) return '';
  return current.merged ? (person.fields[t('an.merge.origin')] || [])[0] || '' : current.name;
}

// Une ligne du menu. `target` : { id, name, where, lock, focus, ready } (js/broker/entries.js, `personTargets`).
function lineOf(target, { t, go, unlock, say }) {
  const base = { icon: 'open', label: target.name };
  if (target.lock) return { ...base, hint: t('an.link.locked'), greyed: true, title: target.lock, run: () => unlock(target) };
  if (!target.ready) {
    const why = t('an.link.notYetWhy', { app: target.name });
    return { ...base, hint: t('an.link.notYet'), greyed: true, title: why, run: () => say(why) };
  }
  return { ...base, hint: target.where, run: () => go(target.id) };
}

// Le menu : un titre (la personne), puis une ligne par app ; sans app, une seule ligne grisée qui le dit. `hooks` : { targets() -> les apps
// (js/broker/entries.js, `personTargets`), onInsert(id, personne) -> ouvre l'app avec la personne, onUnlock(app) -> dit comment débloquer l'app } ; `current` :
// l'annuaire qu'on regarde.
export function openInsertMenu({ anchor, host, t, person, current, hooks, say }) {
  const go = id => void hooks.onInsert(id, personPayload(person, originOf(person, current, t)));
  const lines = hooks.targets().map(target => lineOf(target, { t, go, unlock: app => void hooks.onUnlock(app), say }));
  const none = { icon: 'link', label: t('an.link.noneLine'), greyed: true, title: t('an.link.none'), run: () => say(t('an.link.none')) };
  openMenu(anchor, [{ heading: t('an.link.menuTitle', { name: person.name }) }, ...(lines.length ? lines : [none])], { host, align: 'right',
    label: t('an.link.insert') });
}
