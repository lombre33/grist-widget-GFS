// Le plan des bâtiments (module Annuaire, demande du porteur du 27/11 : « une cartographie des bâtiments liée à l'annuaire pour situer le bureau d'une
// personne » ;
// décision : « le plan comme base », sans dépendance). Ce que GFS sait des lieux : du code sans effet de bord, essayé sous Node (test/annuaire-plan.test.mjs) ;
// la lecture est à js/annuaire/annuaire-store.js, l'écran à js/annuaire/annuaire-plan-view.js.
//
// Les lieux vivent dans UNE table (`Directory_Places`, js/annuaire/annuaire-config.js : `PLAN_TABLE`) : chaque ligne a un parent, ce qui donne l'arbre « site >
// bâtiment > étage > local » sans le fixer (un document sans site commence aux bâtiments). Le niveau de zoom d'un lieu est sa profondeur dans cet arbre :
// quatre crans, de « tous les bâtiments » au local et à ses occupants. Rien ne s'y calcule dans Grist : les décomptes se font à la lecture, d'après les
// personnes que l'annuaire montre (celles que la recherche, les filtres et « Ma présence » laissent voir) : le plan ne montre jamais une personne que
// l'annuaire cache.

import { normalize } from '../ui/search.js';
import { planReady, PLAN_TABLE } from './annuaire-config.js';
import { readShape } from './annuaire-plan-shape.js';

export const KINDS = Object.freeze(['site', 'building', 'floor', 'room']);
export const USES = Object.freeze(['office', 'meeting', 'circulation', 'service']);
// Les usages sans place de travail (couloir, escalier, sanitaires, local technique) : ils se tracent pour que le plan ressemble au bâtiment, mais ils restent
// grisés (pas d'occupant).
export const NO_SEATS = Object.freeze(['circulation', 'service']);

// Ce qu'une personne a pu écrire à la main dans Grist pour chaque valeur (la table se saisit aussi directement) : comparé sans accents ni casse.
const KIND_WORDS = Object.freeze({ site: ['site'], building: ['building', 'batiment', 'immeuble'], floor: ['floor', 'etage', 'niveau'],
  room: ['room', 'local', 'salle', 'piece'] });
const USE_WORDS = Object.freeze({ office: ['office', 'bureau'], meeting: ['meeting', 'reunion', 'salle de reunion'],
  circulation: ['circulation', 'couloir', 'escalier', 'hall'], service: ['service', 'wc', 'sanitaires', 'technique'] });

const wordOf = (table, value) => {
  const text = normalize(value);
  return text ? Object.keys(table).find(key => table[key].includes(text)) || '' : '';
};
export const kindOf = value => wordOf(KIND_WORDS, value);
export const useOf = value => wordOf(USE_WORDS, value);

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const natural = (a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true, sensitivity: 'base' });
const numberOf = value => (typeof value === 'number' && Number.isFinite(value) ? value : null);
// Le numéro de la pièce jointe d'un plan : la première d'une cellule « Pièces jointes » (comme la photo : js/annuaire/annuaire-model.js).
const attachmentOf = cell => (Array.isArray(cell) ? cell.slice(cell[0] === 'L' ? 1 : 0).find(each => Number.isInteger(each) && each > 0) || 0 : 0);

// Les lieux de la table `data[plan.table]` : [{ id, name, kind (celui que la table dit, ou ''), use, parent (0 : au sommet), address, lat, lng, plan (le numéro
// de la pièce jointe, 0 sans), shape (son tracé sur le plan de son parent : js/annuaire/annuaire-plan-shape.js, null sans), capacity, depth }]. Un lieu sans
// nom est ignoré ; un parent qui n'existe plus, ou qui ferait une boucle, laisse le lieu au sommet.
function placesOf(rows, byId) {
  const cell = (column, i) => (Array.isArray(rows[column]) ? rows[column][i] : undefined);
  const places = rows.id.map((id, i) => ({ id, name: clean(cell('Name', i)), kind: kindOf(cell('Kind', i)), use: useOf(cell('Use', i)),
    parent: typeof cell('Parent', i) === 'number' ? cell('Parent', i) : 0, address: clean(cell('Address', i)), lat: numberOf(cell('Lat', i)),
    lng: numberOf(cell('Lng', i)), plan: attachmentOf(cell('Plan', i)), shape: readShape(cell('Shape', i)),
      capacity: Math.max(0, Math.round(Number(cell('Capacity', i))) || 0), depth: 0 }))
    .filter(place => place.name);
  for (const place of places) byId.set(place.id, place);
  for (const place of places) {
    if (!byId.has(place.parent)) place.parent = 0;
    const seen = new Set([place.id]);
    for (let at = byId.get(place.parent); at; at = byId.get(at.parent)) {
      if (seen.has(at.id)) { place.parent = 0; break; }
      seen.add(at.id);
    }
  }
  for (const place of places) for (let at = byId.get(place.parent); at; at = byId.get(at.parent)) place.depth += 1;
  return places;
}

// Les lieux et le bureau de chaque personne, d'après les tables lues : { table, places, byId (Map), kids (Map : numéro du parent, 0 pour le sommet -> lieux
// triés par nom, 12 avant 102), offices (Map : numéro de ligne de la personne -> numéro du lieu) }, ou null quand le plan n'est pas réglé ou que sa table n'est
// pas lue.
export function planOf(config, tableId, data) {
  if (!planReady(config)) return null;
  const rows = data[config.plan.table];
  if (!rows || !Array.isArray(rows.id)) return null;
  const byId = new Map();
  const places = placesOf(rows, byId);
  const kids = new Map();
  for (const place of [...places].sort(natural)) kids.set(place.parent, [...(kids.get(place.parent) || []), place]);
  const people = data[tableId];
  const column = people && Array.isArray(people[config.plan.office]) ? people[config.plan.office] : [];
  const offices = new Map();
  (people && Array.isArray(people.id) ? people.id : []).forEach((row, i) => { if (byId.has(column[i])) offices.set(row, column[i]); });
  // `canImage` et `canShape` : la table a sa colonne « Plan » (les pièces jointes), sa colonne « Shape » (les tracés) ; sans elle, rien ne s'écrit (jamais une
  // colonne absente).
  return { table: config.plan.table, places, byId, kids, offices, canImage: Array.isArray(rows[PLAN_TABLE.image]),
    canShape: Array.isArray(rows[PLAN_TABLE.shape]) };
}

// Le genre d'un lieu : celui que la table dit, sinon celui que sa profondeur suggère (site, bâtiment, étage, local).
export const kindAt = place => place.kind || KINDS[Math.min(place.depth, KINDS.length - 1)];

// Les lieux du sommet à `id` (lui compris) ; [] pour 0 ou un lieu inconnu.
export function pathOf(plan, id) {
  const path = [];
  for (let at = plan.byId.get(id); at; at = plan.byId.get(at.parent)) path.unshift(at);
  return path;
}

export const pathText = (plan, id, separator = ' › ') => pathOf(plan, id).map(place => place.name).join(separator);

// L'image que le lieu `id` montre (0 : tous les lieux, qui n'a pas d'image) : { host (le lieu dont l'image est montrée : lui-même quand il porte la sienne,
// sinon son plus proche ancêtre qui en porte une : un local se montre sur le plan de son étage), focus (le lieu de la chaîne qui est un enfant direct de
// `host` : celui qu'on cadre ; null quand l'image est celle du lieu même), shapes (les enfants de `host` qui ont un tracé) }, ou null sans image à montrer.
export function mapOf(plan, id) {
  let focus = null;
  for (let at = plan.byId.get(id); at; focus = at, at = plan.byId.get(at.parent)) {
    if (!at.plan) continue;
    return { host: at, focus: at.id === id ? null : focus, shapes: childrenOf(plan, at.id).filter(place => place.shape) };
  }
  return null;
}

// Le lieu où travaille la personne, ou null.
export const placeOfPerson = (plan, row) => plan.byId.get(plan.offices.get(row)) || null;

// Les lieux enfants d'un lieu (0 : le sommet).
export const childrenOf = (plan, id) => plan.kids.get(id) || [];

// Ce que les personnes montrées occupent : { direct: Map (lieu -> personnes dont c'est le bureau), total: Map (lieu -> combien dedans, sous-lieux compris),
// unplaced: les personnes sans bureau (ou dont le bureau n'existe plus) }.
export function occupancy(plan, people) {
  const direct = new Map();
  const total = new Map();
  const unplaced = [];
  for (const person of people) {
    const id = plan.offices.get(person.row);
    if (!id) { unplaced.push(person); continue; }
    direct.set(id, [...(direct.get(id) || []), person]);
    for (const place of pathOf(plan, id)) total.set(place.id, (total.get(place.id) || 0) + 1);
  }
  return { direct, total, unplaced };
}

// Les choix d'un bureau pour une fiche (le formulaire « Modifier ») : [{ id, label }], chacun écrit en chemin entier (« Siège › Bât. A › 2e › 204 » : deux
// « 204 » de bâtiments différents ne se confondent pas), sans les lieux qui n'ont pas de place de travail ; triés par chemin.
export function officeChoices(plan) {
  return plan.places.filter(place => !NO_SEATS.includes(place.use)).map(place => ({ id: place.id, label: pathText(plan, place.id) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr', { numeric: true, sensitivity: 'base' }));
}
