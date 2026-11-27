// La vue « Plan » de l'annuaire (module Annuaire, demande du porteur du 27/11 : « une cartographie des bâtiments liée à l'annuaire ») : on part de tous les
// lieux et on descend d'un cran à chaque clic (le bâtiment et ses étages, l'étage et ses locaux, le local et ses occupants) ; le fil d'Ariane remonte. Une
// carte par lieu, avec son genre, son adresse et le nombre de personnes qu'il accueille ; un lieu de passage ou de service (couloir, escalier, sanitaires) est
// grisé et le dit au clic. Les décomptes sont ceux des personnes que l'annuaire montre (la recherche, les filtres et « Ma présence » les ont déjà réduites).
// Des fonctions qui construisent des nœuds ; les clics se lisent par délégation, d'après les attributs `data-act` (js/annuaire/annuaire-window.js). L'image du
// plan et les tracés se posent dessus au lot suivant ; la vue marche sans.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { childrenOf, pathOf, kindAt, occupancy, NO_SEATS } from './annuaire-plan.js';
import { personRow } from './annuaire-panes.js';

// L'icône de chaque genre de lieu : une icône = une fonction.
const GLYPHS = Object.freeze({ site: 'pin', building: 'building', floor: 'stack', room: 'door' });

export class PlanView {
  #refs;

  constructor() {
    this.#refs = { crumb: h('nav', { class: 'an-pl-crumb' }), tools: h('div', { class: 'an-org-tools' }), filters: h('div', { class: 'an-org-fbar' }),
      body: h('div', { class: 'an-pl-body', tabindex: '-1' }) };
    this.element = h('div', { class: 'an-plan' }, h('div', { class: 'an-org-bar' }, this.#refs.crumb, h('span', { class: 'an-grow' }), this.#refs.tools),
      this.#refs.filters,
      this.#refs.body);
  }

  // L'endroit des boutons que la fenêtre ajoute à la barre (les filtres, « Ajouter », « Écrire ») et celui de la barre des filtres.
  get tools() { return this.#refs.tools; }

  get filters() { return this.#refs.filters; }

  // Montre le lieu `current` (0 : tous les lieux). `state` : { t, plan, people (celles que l'annuaire montre), current, here (le lieu à repérer : le bureau de
  // la personne dont la fiche s'ouvre), selected (la ligne de la personne dont la fiche est ouverte), masked (Set) }.
  show(state) {
    const { t, plan, people, current } = state;
    const count = occupancy(plan, people);
    const trail = pathOf(plan, current);
    this.#refs.crumb.setAttribute('aria-label', t('an.plan.crumb'));
    this.#refs.crumb.replaceChildren(h('ol', { class: 'an-pl-trail' }, h('li', null, step(t('an.plan.all'), 0, trail.length === 0)),
      ...trail.map((place, i) => h('li', null, step(place.name, place.id, i === trail.length - 1)))));
    const kids = childrenOf(plan, current);
    const place = current ? plan.byId.get(current) : null;
    const direct = count.direct.get(current) || [];
    const grid = kids.length ? h('div', { class: 'an-pl-grid' }, ...kids.map(kid => tile(kid, state, count))) : null;
    this.#refs.body.replaceChildren(...[head(state, place, count.total.get(current) || 0), grid,
      direct.length ? occupants(state, direct, kids.length > 0) : null,
      empty(state, kids.length + direct.length), current ? null : unplacedNote(state, count.unplaced)].filter(Boolean));
  }
}

// Une étape du fil d'Ariane : un bouton, sauf la dernière (le lieu où l'on est).
function step(label, id, last) {
  return h('button', { type: 'button', class: `an-pl-step${last ? ' is-last' : ''}`, 'aria-current': last ? 'location' : null,
    'aria-disabled': last ? 'true' : null,
    dataset: { act: 'plan-go', id: String(id), fk: `plan-at:${id}` } }, label);
}

// Le titre du volet : le lieu où l'on est (son genre, son adresse, combien de personnes il accueille), ou « Tous les lieux ».
function head(state, place, total) {
  const { t } = state;
  if (!place) return h('div', { class: 'an-pl-head' }, h('h3', null, t('an.plan.all')),
    h('span', { class: 'an-count' }, t('an.count', { n: total || state.people.length })));
  const sub = [t(`an.plan.kind.${kindAt(place)}`), place.use ? t(`an.plan.use.${place.use}`) : '', place.address].filter(Boolean).join(' · ');
  return h('div', { class: 'an-pl-head' }, icon(GLYPHS[kindAt(place)], 'an-pl-ic'), h('h3', null, place.name),
    h('span', { class: 'an-count' }, t('an.count', { n: total })),
    h('p', { class: 'an-pe-sub an-pl-sub' }, sub));
}

// La carte d'un lieu : l'icône de son genre, son nom, ce qui le décrit (genre, adresse) et combien de personnes y travaillent. Grisée sans poste de travail.
function tile(place, state, count) {
  const { t } = state;
  const grey = NO_SEATS.includes(place.use);
  const n = count.total.get(place.id) || 0;
  const meta = [t(`an.plan.kind.${kindAt(place)}`), place.use ? t(`an.plan.use.${place.use}`) : '', place.address].filter(Boolean).join(' · ');
  const seats = place.capacity ? t('an.plan.seats', { n, max: place.capacity }) : t('an.count', { n });
  return h('button', { type: 'button', class: `an-pl-tile${grey ? ' is-grey' : ''}${place.id === state.here ? ' is-here' : ''}`,
    'aria-disabled': grey ? 'true' : null,
    title: grey ? t('an.plan.noSeats') : null, dataset: { act: grey ? 'plan-note' : 'plan-go', id: String(place.id),
      ...(grey ? { why: t('an.plan.noSeats') } : {}), fk: `pl:${place.id}` } },
  icon(GLYPHS[kindAt(place)], 'an-pl-ic'), h('span', { class: 'an-pl-name' }, place.name), h('span', { class: 'an-pe-sub an-pl-meta' }, meta),
  grey ? null : h('span', { class: 'an-pill' }, seats));
}

// Les personnes dont c'est le bureau : les mêmes lignes que la liste (un clic ouvre la fiche).
function occupants(state, people, below) {
  const { t, selected, masked } = state;
  return h('div', { class: 'an-pl-people' }, h('h4', { class: 'an-fs-h' }, t(below ? 'an.plan.here' : 'an.plan.occupants')),
    ...people.map((person, i) => personRow(person, { selected: person.row === selected, tabStop: i === 0, masked: Boolean(masked && masked.has(person.row)),
      t })));
}

// Ce que le volet dit quand il n'a rien à montrer : aucun lieu dans la table, ou un lieu sans occupant.
function empty(state, shown) {
  const { t, plan } = state;
  if (shown) return null;
  return h('p', { class: 'an-note' }, t(plan.places.length ? 'an.plan.emptyPlace' : 'an.plan.noPlaces', { table: plan.table }));
}

// Les personnes montrées qui n'ont pas de bureau (ou dont le bureau n'existe plus) : une ligne en bas du premier cran, pas une carte.
function unplacedNote(state, people) {
  return people.length ? h('p', { class: 'an-note an-pl-unplaced' }, state.t('an.plan.unplaced', { n: people.length })) : null;
}
