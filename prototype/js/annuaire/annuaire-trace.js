// Le tracé des locaux d'un plan (module Annuaire, plan des bâtiments, lot 3 ; demande du porteur du 27/11 : « tracer les bâtiments, les étages et les locaux
// sur l'image »). Du calcul sans effet de bord, essayé sous Node (test/annuaire-trace.test.mjs) : l'aimant de la grille, les gestes qui font un rectangle ou un
// polygone, l'ajustement d'un tracé (le déplacer, tirer un angle), le brouillon (les tracés posés pendant la séance, avec « Annuler » et « Rétablir », et les
// locaux créés en passant) et les actions que Grist recevra à « Enregistrer » : une `UpdateRecord` par tracé changé, une `AddRecord` par local créé, rien
// d'autre, et jamais une colonne que la table n'a pas. La fenêtre qui s'en sert : js/annuaire/annuaire-trace-window.js ; le dessin :
// js/annuaire/annuaire-trace-canvas.js.

import { updateAction, addAction, PLAN_TABLE } from './annuaire-config.js';
import { UNITS, MAX_POINTS, writeShape, boundsOf, pointsOf, areaOf } from './annuaire-plan-shape.js';
import { KINDS, USES, NO_SEATS } from './annuaire-plan.js';

export const GRID = 10; // l'écart de la grille, en unités du plan (un centième de la largeur de l'image)
export const MIN_SIDE = 10; // le plus petit côté d'un rectangle qu'on trace
const HISTORY = 100;

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

// Un nombre ramené à la grille de `step` (0 : pas d'aimant).
export const snap = (value, step) => (step ? Math.round(value / step) * step : value);

// Un point de l'image, aimanté puis ramené dans l'image (qui fait UNITS de large et `height` de haut).
export const placed = ([x, y], step, height) => [clamp(snap(x, step), 0, UNITS), clamp(snap(y, step), 0, height)];

// Le rectangle dont `a` et `b` sont deux coins opposés.
export function rectFrom(a, b) {
  const x = Math.min(a[0], b[0]);
  const y = Math.min(a[1], b[1]);
  return { type: 'rect', x, y, w: Math.abs(a[0] - b[0]), h: Math.abs(a[1] - b[1]) };
}

export const rectOk = shape => shape.w >= MIN_SIDE && shape.h >= MIN_SIDE;

// Le polygone de ces angles, ou null : trois angles au moins, MAX_POINTS au plus, une surface.
export function polygonFrom(points) {
  if (points.length < 3 || points.length > MAX_POINTS) return null;
  const shape = { type: 'poly', pts: points.map(([x, y]) => [x, y]) };
  return areaOf(shape) > 0 ? shape : null;
}

// Le tracé déplacé de (dx, dy), puis ramené dans l'image : il ne sort jamais du plan et garde sa forme.
export function movedBy(shape, dx, dy, height) {
  const box = boundsOf(shape);
  const mx = clamp(dx, -box.x, UNITS - box.x - box.w);
  const my = clamp(dy, -box.y, height - box.y - box.h);
  if (shape.type === 'rect') return { ...shape, x: shape.x + mx, y: shape.y + my };
  return { type: 'poly', pts: shape.pts.map(([x, y]) => [x + mx, y + my]) };
}

// Le tracé dont l'angle `index` est tiré en `point` : l'angle opposé d'un rectangle reste en place ; un polygone qui n'aurait plus de surface reste comme il
// était.
export function withCorner(shape, index, point) {
  if (shape.type === 'rect') {
    const next = rectFrom(pointsOf(shape)[(index + 2) % 4], point);
    return rectOk(next) ? next : shape;
  }
  const pts = shape.pts.map((each, i) => (i === index ? [point[0], point[1]] : each));
  return polygonFrom(pts) || shape;
}

// Le brouillon d'une séance : les tracés de `rooms` ([{ id, shape }]) tels qu'ils étaient, ceux qu'on pose ou qu'on retire, les locaux créés (clé « new:n »,
// avec leur nom, leur usage et leurs places). `Annuler` et `Rétablir` parcourent les gestes (cent au plus).
export class Draft {
  #base = new Map();
  #now = new Map();
  #made = new Map();
  #past = [];
  #future = [];
  #seq = 0;

  constructor(rooms) {
    for (const room of rooms) { this.#base.set(room.id, room.shape || null); this.#now.set(room.id, room.shape || null); }
  }

  keys() { return [...this.#now.keys()]; }

  has(key) { return this.#now.has(key); }

  shapeOf(key) { return this.#now.get(key) || null; }

  // Ce qu'on a dit d'un local créé dans la séance : { name, use, capacity }, ou null pour un local qui existait déjà.
  made(key) { return this.#made.get(key) || null; }

  #state() { return { now: [...this.#now], made: [...this.#made] }; }

  #restore(state) {
    this.#now = new Map(state.now);
    this.#made = new Map(state.made);
  }

  #record() {
    this.#past.push(structuredClone(this.#state()));
    if (this.#past.length > HISTORY) this.#past.shift();
    this.#future = [];
  }

  // Pose (ou retire, avec null) le tracé de `key` ; rend faux quand rien ne change.
  setShape(key, shape) {
    if (!this.#now.has(key)) return false;
    const before = this.#now.get(key);
    if ((before ? writeShape(before) : '') === (shape ? writeShape(shape) : '')) return false;
    this.#record();
    this.#now.set(key, shape || null);
    return true;
  }

  // Crée un local dans la séance : rend sa clé.
  addRoom(info, shape = null) {
    this.#record();
    this.#seq += 1;
    const key = `new:${this.#seq}`;
    this.#now.set(key, shape);
    this.#made.set(key, { name: info.name, use: info.use, capacity: info.capacity });
    return key;
  }

  // Retire un local créé dans la séance (un local qui existait déjà ne se retire pas d'ici : seul son tracé s'efface).
  dropRoom(key) {
    if (!this.#made.has(key)) return false;
    this.#record();
    this.#now.delete(key);
    this.#made.delete(key);
    return true;
  }

  get canUndo() { return this.#past.length > 0; }

  get canRedo() { return this.#future.length > 0; }

  undo() {
    if (!this.#past.length) return false;
    this.#future.push(structuredClone(this.#state()));
    this.#restore(this.#past.pop());
    return true;
  }

  redo() {
    if (!this.#future.length) return false;
    this.#past.push(structuredClone(this.#state()));
    this.#restore(this.#future.pop());
    return true;
  }

  // Ce qui change par rapport à ce que la table disait : { shapes: [{ id, shape (null : retiré) }], added: [{ key, name, use, capacity, shape }] }.
  changes() {
    const text = shape => (shape ? writeShape(shape) : '');
    const shapes = [...this.#base].filter(([id, shape]) => text(shape) !== text(this.#now.get(id))).map(([id]) => ({ id, shape: this.#now.get(id) }));
    const added = [...this.#made].map(([key, info]) => ({ key, ...info, shape: this.#now.get(key) }));
    return { shapes, added };
  }

  get count() {
    const { shapes, added } = this.changes();
    return shapes.length + added.length;
  }
}

const USE_VALUES = Object.freeze({ office: 'Office', meeting: 'Meeting', circulation: 'Circulation', service: 'Service' });

// Les actions de Grist pour `changes` (voir `Draft.changes`), pour les enfants du lieu `host` ({ id, depth }) de la table des lieux `plan`
// (js/annuaire/annuaire-plan.js : `planOf`, dont `has` dit les colonnes que la table a). Un tracé retiré s'écrit « vide ». Un local créé prend le genre que sa
// profondeur dit, l'usage choisi et ses places ; chaque valeur n'est écrite que si sa colonne existe (une seule colonne absente annulerait tout le lot). Rend
// la liste des actions, à envoyer d'un coup.
export function traceActions(changes, plan, host) {
  const has = column => plan.has.has(column);
  const updates = changes.shapes.map(({ id, shape }) => updateAction(plan.table, id, { [PLAN_TABLE.shape]: shape ? writeShape(shape) : '' }));
  const kind = KINDS[Math.min(host.depth + 1, KINDS.length - 1)];
  const adds = changes.added.map(room => {
    const seats = USES.includes(room.use) && !NO_SEATS.includes(room.use) ? room.capacity : 0;
    const values = { [PLAN_TABLE.name]: room.name, Kind: `${kind[0].toUpperCase()}${kind.slice(1)}`, Use: USE_VALUES[room.use],
      Capacity: seats > 0 ? seats : undefined,
      [PLAN_TABLE.parent]: host.id, [PLAN_TABLE.shape]: room.shape ? writeShape(room.shape) : '' };
    return addAction(plan.table, Object.fromEntries(Object.entries(values).filter(([column, value]) => value !== undefined && has(column))));
  });
  return [...updates, ...adds];
}
