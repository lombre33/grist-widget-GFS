// Ce qui aide à se déplacer sur le plan (module Annuaire, plan des bâtiments, lot 4 ; demande du porteur du 27/11 : « sélecteur d'étage avec décomptes »,
// « Voir sur une carte en ligne ») : les autres lieux de même rang que celui où l'on est, chacun avec son décompte (un clic y va, sans remonter), et le lien
// vers une carte en ligne. Des fonctions qui construisent des nœuds ; le clic « aller » est celui des cartes (`data-act="plan-go"`,
// js/annuaire/annuaire-window.js), le lien est un lien du navigateur : OpenStreetMap ne reçoit rien tant que la personne ne le clique pas, et l'adresse
// seulement alors (le texte du bouton le dit).

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { kindAt, siblingsOf, geoOf } from './annuaire-plan.js';

// Les autres étages, bâtiments ou sites : un bouton par lieu de même rang (le lieu où l'on est est enfoncé), avec ce qu'il accueille. Rien pour un local (trop
// nombreux : les cartes et le plan suffisent) ni pour un lieu seul de son rang.
export function siblingsBar(state, place, count) {
  const { t } = state;
  const kind = kindAt(place);
  const all = kind === 'room' ? [] : siblingsOf(state.plan, place.id);
  if (!all.length) return null;
  return h('div', { class: 'an-pl-sib', role: 'group', 'aria-label': t(`an.plan.sibs.${kind}`), dataset: { fk: 'plan-sibs' } },
    ...all.map(each => {
      const here = each.id === place.id;
      return h('button', { type: 'button', class: 'an-pl-sibb', 'aria-pressed': String(here), 'aria-current': here ? 'location' : null,
        dataset: { act: 'plan-go', id: String(each.id), fk: `plan-sib:${each.id}` } },
      h('span', { class: 'an-pl-sibn' }, each.name), h('span', { class: 'an-pl-sibc' }, String(count.total.get(each.id) || 0)));
    }));
}

// « Voir sur une carte en ligne » : un lien (nouvel onglet) vers OpenStreetMap, sur le lieu ou, à défaut, sur le plus proche lieu au-dessus qui a une adresse
// ou des coordonnées. Sans l'un ni l'autre le bouton reste là, grisé : un clic dit quelle colonne remplir.
export function geoLink(state, place) {
  const { t, plan } = state;
  const found = geoOf(plan, place.id);
  if (!found) return h('button', { type: 'button', class: 'btn sm an-pl-geo', 'aria-disabled': 'true', title: t('an.plan.noGeo'),
    dataset: { act: 'plan-note', why: t('an.plan.noGeo'), fk: 'plan-geo' } }, icon('open'), t('an.plan.geo'));
  return h('a', { class: 'btn sm an-pl-geo', href: found.url, target: '_blank', rel: 'noopener noreferrer',
    title: t('an.plan.geoHint', { name: found.place.name }),
    dataset: { fk: 'plan-geo' } }, icon('open'), t('an.plan.geo'));
}
