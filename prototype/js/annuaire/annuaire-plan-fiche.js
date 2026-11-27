// La section « Lieu » de la fiche d'une personne (module Annuaire, demande du porteur du 27/11 : « situer le bureau d'une personne ») : le chemin du bureau, du
// site au local, chaque lieu un cran sous le précédent (comme « Rattachement »), et le bouton « Voir sur le plan » qui ouvre la vue « Plan » sur son étage. Une
// personne sans bureau garde la ligne (un tiret : on voit que la donnée manque). Des fonctions qui construisent des nœuds ; js/annuaire/annuaire-panes.js en
// fait la section.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { pathOf, kindAt, placeOfPerson } from './annuaire-plan.js';

// Ce que la section montre, ou null quand l'annuaire n'a pas de plan (rien n'est dit : la vue « Plan » grisée dit déjà comment l'allumer). `ctx.plan` : le plan
// lu (js/annuaire/annuaire-plan.js), `ctx.t`.
export function placeContent(person, ctx) {
  const { t, plan } = ctx;
  if (!plan) return null;
  const place = placeOfPerson(plan, person.row);
  if (!place) return [h('span', { class: 'an-empty', title: t('an.fiche.empty') }, '—')];
  const steps = pathOf(plan, place.id).map((each, depth) => h('li', { class: `an-hp-step${depth ? ' is-sub' : ''}`, vars: { '--d': depth } },
    h('span', { class: 'an-hp-k' }, t(`an.plan.kind.${kindAt(each)}`)), h('span', { class: 'an-hp-v' }, each.name)));
  return [h('ol', { class: 'an-hp', 'aria-label': t('an.fiche.place') }, ...steps),
    h('button', { type: 'button', class: 'btn sm an-see', dataset: { act: 'plan-open', row: String(person.row), fk: 'plan-open' } }, icon('plan'),
      t('an.plan.see'))];
}
