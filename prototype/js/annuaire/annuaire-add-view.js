// Ce que la fenêtre « Ajouter des personnes » montre en plus de la fenêtre « Modifier » (module Annuaire ; choix du porteur, 27/11 : « Plusieurs à la suite, un
// seul ajout ») : la rangée des fiches préparées, en pastilles qu'on choisit ou qu'on retire, avec le bouton qui en prépare une autre, puis la relecture des
// ajouts. Des fonctions qui construisent des nœuds (js/annuaire/annuaire-edit-window.js tient l'état et les gestes) ; la logique est à
// js/annuaire/annuaire-add.js.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { iconButton } from './annuaire-setup-shared.js';

// La rangée des fiches préparées. `names` : le nom dit de chacune ('' tant qu'il n'est pas saisi : « Nouvelle personne »). La fiche en cours est la pastille
// pressée ; on ne retire pas la seule fiche qui reste (grisé, jamais masqué).
export function draftsRow({ drafts, at, names, t }) {
  const label = index => names[index] || (drafts.length > 1 ? t('an.add.draftN', { n: index + 1 }) : t('an.add.draft'));
  return h('div', { class: 'an-ed-drafts', role: 'group', 'aria-label': t('an.add.drafts') },
    ...drafts.map((_, index) => h('span', { class: `an-ed-draft${index === at ? ' is-current' : ''}` },
      h('button', { type: 'button', class: 'an-ed-draft-b', 'aria-pressed': String(index === at), title: label(index),
        dataset: { act: 'ed-draft', value: String(index), fk: `ed-draft:${index}` } }, h('span', null, label(index))),
      iconButton(t, { glyph: 'x', label: t('an.edit.remove', { what: label(index) }), fk: `ed-draft-x:${index}`, disabled: drafts.length < 2,
        data: { act: 'ed-draft-remove', value: String(index) } }))),
    h('button', { type: 'button', class: 'btn sm an-ed-add', dataset: { act: 'ed-draft-add', fk: 'ed-draft-add' } }, icon('plus'), t('an.add.another')));
}

// La relecture : l'intro, puis une carte par fiche (son nom en titre, ses autres valeurs, ses doublons possibles). `cards` : [{ name, rows: [[libellé,
// valeur]], warns: [texte] }].
export function addReviewNodes({ t, table, cards }) {
  return [h('p', { class: 'an-set-help an-ed-intro' }, t('an.add.reviewText', { n: cards.length, table })),
    ...cards.map(card => h('section', { class: 'an-ed-new' }, h('h3', null, card.name),
      card.rows.length ? h('dl', { class: 'an-ed-review' }, ...card.rows.map(([label, value]) => h('div', { class: 'an-ed-change' }, h('dt', null, label),
        h('dd', null, h('b', { class: 'an-ed-now' }, value))))) : null,
      ...card.warns.map(warn => h('p', { class: 'an-ed-warn' }, icon('warning'), h('span', null, warn)))))];
}
