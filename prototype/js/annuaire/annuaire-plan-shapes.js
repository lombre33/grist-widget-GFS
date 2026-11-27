// Les tracés posés sur l'image d'un plan (module Annuaire, plan des bâtiments, lot 3 ; demande du porteur du 27/11) : chaque lieu tracé est une forme qu'on
// clique (elle fait ce que sa carte fait : descendre dans le lieu, ou dire pourquoi il est grisé), avec son nom et son décompte quand elle est assez grande ;
// le lieu qu'on cadre (le local ouvert, au cran 4) montre ses places : une pastille pleine par occupant, vide par place libre. `layerOf` (sans nœud) dit quoi
// dessiner d'après le plan et les personnes montrées ; `ShapeLayer` le dessine, en SVG par-dessus l'image (js/annuaire/annuaire-plan-map.js). Le calque est
// caché aux lecteurs d'écran et hors du clavier : les cartes et les lignes de la liste, juste à côté, font les mêmes gestes. Tout se dessine en unités du plan
// (js/annuaire/annuaire-plan-shape.js) ; la taille d'un trait ou d'un texte, elle, suit l'écran : `--px` dit combien d'unités vaut un pixel, la feuille de
// style en tire les épaisseurs et les tailles.

import { pathOf, NO_SEATS } from './annuaire-plan.js';
import { pathD, boundsOf, centerOf, seatSpots, UNITS } from './annuaire-plan-shape.js';

const NS = 'http://www.w3.org/2000/svg';
const MAX_SEATS = 80;
const MAX_RADIUS = 26; // le rayon d'une place, en unités du plan : une place seule dans un grand local ne devient pas un disque énorme
const FONT = 12; // la taille d'un nom, en pixels

function node(tag, attrs, ...children) {
  const el = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'dataset') Object.assign(el.dataset, value);
    else el.setAttribute(key, String(value));
  }
  el.append(...children.filter(Boolean));
  return el;
}

// Les lignes du nom et du décompte qui tiennent dans une forme de `widthPx` sur `heightPx` pixels d'écran : { name: [une ou deux lignes], count }. Le nom
// entier sur une ligne, sinon sur deux (coupé entre deux mots), jamais coupé au milieu d'un mot ni suivi de points (« Bureau 1… » ne dirait pas lequel) ; le
// décompte s'ajoute quand la hauteur le permet. `name` est vide quand rien ne tient : le nom se lit alors en survolant la forme, ou en agrandissant le plan.
export function labelLines(name, count, widthPx, heightPx) {
  const none = { name: [], count: '' };
  const room = Math.floor((widthPx - 8) / (FONT * 0.58));
  if (room < 3) return none;
  let lines = [name];
  if (name.length > room) {
    const words = name.split(' ');
    let at = 1;
    while (at < words.length && words.slice(0, at + 1).join(' ').length <= room) at += 1;
    lines = [words.slice(0, at).join(' '), words.slice(at).join(' ')];
    if (!lines[1] || lines[0].length > room || lines[1].length > room) return none;
  }
  const fits = rows => rows * FONT * 1.3 + 4 <= heightPx;
  if (count && fits(lines.length + 1)) return { name: lines, count };
  return fits(lines.length) ? { name: lines, count: '' } : none;
}

// Ce que le plan dessine pour `map` (js/annuaire/annuaire-plan.js : `mapOf`) : { shapes: [{ id, name, shape, grey, here, current, dim, label, why, marks (des
// classes de plus : la fenêtre de tracé) }], seats : { shape, people: [{ row, name, selected }], free } | null }. `state` : { t, here (le lieu à repérer),
// selected, filtered (la recherche ou un filtre a réduit les personnes : un lieu où personne ne correspond s'estompe) }, `count` : `occupancy`
// (js/annuaire/annuaire-plan.js).
export function layerOf({ plan, map, count, state }) {
  const { t } = state;
  const here = new Set(pathOf(plan, state.here).map(place => place.id));
  const shapes = map.shapes.map(place => {
    const grey = NO_SEATS.includes(place.use);
    const n = count.total.get(place.id) || 0;
    const label = grey || (!n && !place.capacity) ? '' : place.capacity ? `${n}/${place.capacity}` : String(n);
    return { id: place.id, name: place.name, shape: place.shape, grey, here: here.has(place.id), current: Boolean(map.focus && map.focus.id === place.id),
      dim: Boolean(map.focus ? map.focus.id !== place.id : state.filtered && !n && !grey), label, why: grey ? t('an.plan.noSeats') : '' };
  });
  const focus = map.focus && map.focus.shape && !NO_SEATS.includes(map.focus.use) ? map.focus : null;
  const people = focus ? count.direct.get(focus.id) || [] : [];
  const seats = focus && (focus.capacity || people.length) ? { shape: focus.shape, free: Math.max(0, focus.capacity - people.length),
    people: people.map(person => ({ row: person.row, name: person.name, selected: person.row === state.selected })) } : null;
  return { shapes, seats };
}

export class ShapeLayer {
  #items = [];
  #upp = 1;

  constructor() {
    this.element = node('svg', { class: 'an-pl-shapes', viewBox: `0 0 ${UNITS} ${UNITS}`, 'aria-hidden': 'true', focusable: 'false' });
  }

  // Dessine `layer` (voir `layerOf`) sur une image de UNITS unités de large et `height` de haut.
  draw({ height, shapes, seats }) {
    this.element.setAttribute('viewBox', `0 0 ${UNITS} ${height}`);
    this.#items = [];
    const groups = shapes.map(item => this.#shape(item));
    this.element.replaceChildren(...(seats ? [...groups, this.#seats(seats)] : groups));
    this.fit(this.#upp);
  }

  #shape(item) {
    const { id, name, shape, grey, here, current, dim, label, why, marks } = item;
    const [cx, cy] = centerOf(shape);
    const title = node('title', null, label ? `${name} · ${label}` : name);
    const cls = ['an-pl-shape', grey ? 'is-grey' : '', here ? 'is-here' : '', current ? 'is-current' : '', dim ? 'is-dim' : '',
      marks].filter(Boolean).join(' ');
    const lines = [0, 1, 2].map(i => node('text', { class: `an-pl-label${i === 2 ? ' is-count' : ' is-name'}`, x: cx, 'text-anchor': 'middle',
      'dominant-baseline': 'central' }));
    this.#items.push({ box: boundsOf(shape), cy, name, label, lines, labelled: !current });
    const act = current ? null : grey ? { act: 'plan-note', why } : { act: 'plan-go' };
    return node('g', { class: cls, dataset: { id: String(id), ...act, fk: `shape:${id}` } }, title, node('path', { d: pathD(shape) }), ...lines);
  }

  // Les places du local cadré : pleines (un occupant, un clic ouvre sa fiche) puis vides.
  #seats({ shape, people, free }) {
    const wanted = Math.min(MAX_SEATS, people.length + free);
    const { pts, step } = seatSpots(shape, wanted);
    const radius = Math.min(MAX_RADIUS, Math.round(step * 34) / 100);
    const circles = pts.map(([x, y], i) => {
      const person = people[i];
      return person ? node('circle', { class: `an-pl-seat is-taken${person.selected ? ' is-selected' : ''}`, cx: x, cy: y, r: radius,
        dataset: { act: 'person', row: String(person.row), fk: `seat:${person.row}` } }, node('title', null, person.name))
        : node('circle', { class: 'an-pl-seat is-free', cx: x, cy: y, r: radius });
    });
    return node('g', { class: 'an-pl-seats' }, ...circles);
  }

  // Dit combien d'unités vaut un pixel de l'écran (l'image agrandie ou rétrécie) : les traits et les textes gardent leur taille d'écran, et les noms qui ne
  // tiennent plus dans leur forme disparaissent au lieu de déborder.
  fit(upp) {
    this.#upp = upp;
    this.element.style.setProperty('--px', String(Math.round(upp * 1000) / 1000));
    const step = FONT * 1.3 * upp;
    for (const item of this.#items) {
      const { name, count } = item.labelled ? labelLines(item.name, item.label, item.box.w / upp, item.box.h / upp) : { name: [], count: '' };
      const rows = count ? [...name, count] : name;
      item.lines.forEach(line => { line.textContent = ''; });
      rows.forEach((row, r) => {
        const line = item.lines[r < name.length ? r : 2];
        line.textContent = row;
        line.setAttribute('y', String(item.cy + (r - (rows.length - 1) / 2) * step));
      });
    }
  }
}
