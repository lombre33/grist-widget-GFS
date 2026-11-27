// Le plan de la fenêtre « Tracer les locaux » (module Annuaire, plan des bâtiments, lot 3 ; demande du porteur du 27/11) : l'image du plan et, par-dessus, les
// tracés du brouillon (les mêmes formes que la vue « Plan » : js/annuaire/annuaire-plan-shapes.js) et ce que la personne est en train de faire. Quatre gestes à
// la souris : « Sélectionner » (un clic choisit un tracé, tirer le tracé le déplace, tirer une poignée l'ajuste, tirer le fond déplace le plan), « Rectangle »
// (tirer d'un coin à l'autre), « Polygone » (un clic par angle ; Entrée, un double-clic ou un clic sur le premier angle ferment ; Retour arrière recule d'un
// angle) ; la molette zoome autour du pointeur, Espace tenu et tiré déplace le plan, « + », « − » et « 0 » zooment au clavier, les flèches décalent le tracé
// choisi d'un cran de grille. Le canevas ne décide de rien : il dit ce que la personne a fait (`on.draw`, `on.edit`, `on.select`, `on.remove`, `on.blocked`,
// `on.note`) et la fenêtre le range dans son brouillon (js/annuaire/annuaire-trace.js). Les points se lisent en unités du plan
// (js/annuaire/annuaire-plan-zoom.js : `unitsAt`), aimantés à la grille quand elle est allumée. Des fonctions qui construisent des nœuds ; essayé à la vraie
// souris dans le labo (labo/run-annuaire-plan.mjs).

import { h } from '../ui/dom.js';
import { FIT, clampView, zoomAt, panBy, wheelFactor, fitRect, unitsAt } from './annuaire-plan-zoom.js';
import { ShapeLayer } from './annuaire-plan-shapes.js';
import { UNITS, pathD, pointsOf } from './annuaire-plan-shape.js';
import { GRID, snap, placed, rectFrom, rectOk, polygonFrom, movedBy, withCorner } from './annuaire-trace.js';

const NS = 'http://www.w3.org/2000/svg';
const DRAG_FROM = 3; // en deçà, un appui reste un clic (pixels)
const HANDLE = 9; // le côté d'une poignée, en pixels d'écran
const CLOSE_AT = 10; // à moins de tant de pixels du premier angle, un clic ferme le polygone
const DEFAULT_RATIO = 1.5;

function svgNode(tag, attrs, ...children) {
  const el = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs || {})) if (value !== null && value !== undefined && value !== false) el.setAttribute(key, String(value));
  el.append(...children.filter(Boolean));
  return el;
}

export class TraceCanvas {
  #o;
  #refs;
  #edit; // le calque de la main (poignées, rectangle tiré, polygone en cours)
  #layer = new ShapeLayer();
  #view = FIT;
  #ratio = DEFAULT_RATIO;
  #state = { items: [], selected: '', target: '', tool: 'select', snap: true };
  #gesture = null; // le geste en cours : { kind: 'pan' | 'move' | 'corner' | 'rect', … }
  #override = null; // le tracé qu'on est en train de déplacer ou d'ajuster : { key, shape }
  #poly = []; // les angles du polygone qu'on trace
  #hover = null; // où est le pointeur (en unités), pour le trait qui suit
  #space = false;

  // opts : { t, on : { draw(forme), edit(clé, forme), select(clé | ''), remove(clé), blocked(), note(clé du texte) } }
  constructor(opts) {
    this.#o = opts;
    const frame = h('div', { class: 'an-pl-vp an-tr-vp', tabindex: '0', role: 'application', 'aria-label': opts.t('an.tr.canvas'),
      dataset: { fk: 'trace-map' } });
    const img = h('img', { class: 'an-pl-img', alt: '', draggable: 'false' });
    this.#edit = svgNode('svg', { class: 'an-pl-shapes an-tr-edit', viewBox: `0 0 ${UNITS} ${UNITS}`, 'aria-hidden': 'true', focusable: 'false' });
    const stage = h('div', { class: 'an-pl-stage' }, img, this.#layer.element, this.#edit);
    frame.append(stage);
    this.#refs = { frame, stage, img };
    this.element = h('figure', { class: 'an-tr-map' }, frame);
    frame.addEventListener('wheel', event => this.#wheel(event), { passive: false });
    frame.addEventListener('pointerdown', event => this.#down(event));
    frame.addEventListener('pointermove', event => this.#move(event));
    frame.addEventListener('pointerup', event => this.#up(event));
    frame.addEventListener('pointercancel', event => this.#up(event));
    frame.addEventListener('dblclick', () => this.finishPolygon());
    frame.addEventListener('keydown', event => this.#key(event));
    frame.addEventListener('keyup', event => { if (event.key === ' ') this.#space = false; });
    img.addEventListener('load', () => this.#loadedSize());
    if (typeof ResizeObserver === 'function') new ResizeObserver(() => this.#apply()).observe(frame);
  }

  // Montre l'image du plan (une adresse `data:`).
  load(url) { this.#refs.img.src = url; }

  // Pose ce que le canevas montre : { items: [{ key, name, shape, grey }], selected, target (le local qu'on trace), tool ('select', 'rect' ou 'poly'), snap }.
  set(state) {
    const toolChanged = state.tool !== this.#state.tool;
    this.#state = { ...this.#state, ...state };
    if (toolChanged) this.#poly = [];
    this.#refs.frame.dataset.tool = this.#state.tool;
    this.#render();
  }

  get #height() { return Math.round(UNITS / this.#ratio); }

  get #step() { return this.#state.snap ? GRID : 0; }

  get drawing() { return this.#poly.length > 0 || (this.#gesture !== null && this.#gesture.kind === 'rect'); }

  // Abandonne le tracé en cours (polygone commencé, rectangle tiré) ; rend vrai quand il y en avait un (Échap : la fenêtre ne se ferme pas).
  cancelDrawing() {
    const was = this.drawing;
    this.#poly = [];
    if (this.#gesture && this.#gesture.kind === 'rect') this.#gesture = null;
    if (was) this.#drawEdit();
    return was;
  }

  // Ferme le polygone en cours : trois angles au moins, une surface.
  finishPolygon() {
    if (!this.#poly.length) return;
    const shape = polygonFrom(this.#poly);
    if (!shape) { this.#o.on.note('an.tr.polyShort'); return; }
    this.#poly = [];
    this.#o.on.draw(shape);
    this.#drawEdit();
  }

  zoomBy(factor) {
    const { vw, vh } = this.#frameSize();
    this.#view = factor === 0 ? FIT : zoomAt(this.#view, factor, vw / 2, vh / 2, vw, vh);
    this.#apply();
  }

  // La vue, pour les boutons de zoom de la fenêtre : { k }.
  get view() { return this.#view; }

  #loadedSize() {
    const { naturalWidth, naturalHeight } = this.#refs.img;
    this.#ratio = naturalWidth > 0 && naturalHeight > 0 ? naturalWidth / naturalHeight : DEFAULT_RATIO;
    this.#render();
  }

  #frameSize() {
    const { frame } = this.#refs;
    return { vw: frame.clientWidth || 0, vh: frame.clientHeight || 0 };
  }

  // La taille du cadre et où l'image tient dedans.
  #geometry() {
    const { vw, vh } = this.#frameSize();
    return { vw, vh, rect: fitRect(vw, vh, this.#ratio) };
  }

  // Le point du cadre sous le pointeur, en pixels : le bord du cadre (son liseré) n'en fait pas partie (un pixel de trop vaudrait deux unités et demie du
  // plan).
  #local(event) {
    const { frame } = this.#refs;
    const box = frame.getBoundingClientRect();
    return { x: event.clientX - box.left - frame.clientLeft, y: event.clientY - box.top - frame.clientTop };
  }

  // Les unités du plan sous le pointeur, ramenées dans l'image (et aimantées quand la grille est allumée) ; `free` : sans aimant.
  #unit(event, free = false) {
    const { rect } = this.#geometry();
    const at = this.#local(event);
    const raw = unitsAt(this.#view, rect, at.x, at.y, UNITS);
    return free ? raw : placed(raw, this.#step, this.#height);
  }

  // Combien d'unités vaut un pixel de l'écran, à la vue actuelle.
  get #perPixel() {
    const { rect } = this.#geometry();
    return rect.dw ? UNITS / (rect.dw * this.#view.k) : 1;
  }

  // ---------- le dessin ----------

  #render() {
    const { items, selected } = this.#state;
    const over = this.#override;
    const shapes = items.map(item => (over && over.key === item.key ? { ...item, shape: over.shape } : item)).filter(item => item.shape)
      .map(item => ({ id: item.key, name: item.name, shape: item.shape, grey: item.grey, here: false, current: false, dim: false, label: '',
        why: '', marks: [item.key === selected ? 'is-selected' : '', item.key === this.#state.target ? 'is-target' : ''].filter(Boolean).join(' ') }));
    this.#layer.draw({ height: this.#height, shapes, seats: null });
    this.#edit.setAttribute('viewBox', `0 0 ${UNITS} ${this.#height}`);
    this.#apply();
  }

  // Pose la vue sur l'image, dit la taille d'un pixel aux calques, et redessine ce qu'on est en train de faire (la taille des poignées suit l'écran).
  #apply() {
    const { stage } = this.#refs;
    const { vw, vh, rect } = this.#geometry();
    this.#view = vw && vh ? clampView(this.#view, vw, vh) : this.#view;
    stage.style.transform = this.#view.k <= 1 ? '' : `translate(${this.#view.x}px, ${this.#view.y}px) scale(${this.#view.k})`;
    if (rect.dw) this.#layer.fit(UNITS / (rect.dw * this.#view.k));
    this.#drawEdit();
  }

  // Le calque de la main : les poignées du tracé choisi, le rectangle qu'on tire, le polygone qu'on trace et le trait qui suit le pointeur.
  #drawEdit() {
    const upp = this.#perPixel;
    const nodes = [];
    const { selected } = this.#state;
    const picked = selected ? (this.#override && this.#override.key === selected ? this.#override.shape :
      (this.#state.items.find(item => item.key === selected) || {}).shape) : null;
    if (picked && this.#state.tool === 'select') {
      const side = HANDLE * upp;
      pointsOf(picked).forEach(([x, y], i) => nodes.push(svgNode('rect', { class: 'an-tr-handle', x: x - side / 2, y: y - side / 2, width: side, height: side,
        'data-vertex': i })));
    }
    const gesture = this.#gesture;
    if (gesture && gesture.kind === 'rect' && gesture.shape) nodes.push(svgNode('path', { class: 'an-tr-draft', d: pathD(gesture.shape) }));
    if (this.#poly.length) nodes.push(...this.#polyNodes(upp));
    this.#edit.style.setProperty('--px', String(Math.round(upp * 1000) / 1000));
    this.#edit.replaceChildren(...nodes);
  }

  #polyNodes(upp) {
    const points = this.#hover ? [...this.#poly, this.#hover] : this.#poly;
    const line = svgNode('path', { class: 'an-tr-draft is-open', d: points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ') });
    const dots = this.#poly.map(([x, y], i) => svgNode('circle', { class: `an-tr-dot${i === 0 ? ' is-first' : ''}`, cx: x, cy: y,
      r: (i === 0 ? 6 : 4) * upp }));
    return [line, ...dots];
  }

  // ---------- la souris ----------

  #down(event) {
    const { frame } = this.#refs;
    frame.focus({ preventScroll: true });
    if (event.button === 1 || (event.button === 0 && this.#space)) { this.#begin(event, { kind: 'pan' }); return; }
    if (event.button !== 0) return;
    const { tool } = this.#state;
    if (tool === 'select') { this.#downSelect(event); return; }
    if (!this.#state.target) { this.#o.on.blocked(); return; }
    if (tool === 'rect') this.#begin(event, { kind: 'rect', a: this.#unit(event), shape: null });
    else this.#addAngle(event);
  }

  #begin(event, gesture) {
    this.#gesture = { ...gesture, x: event.clientX, y: event.clientY, from: this.#unit(event, true), moved: false };
    try { this.#refs.frame.setPointerCapture(event.pointerId); } catch (error) { /* le geste marche sans la capture */ }
    this.#refs.frame.classList.toggle('is-pan', gesture.kind === 'pan');
  }

  #downSelect(event) {
    const handle = event.target.closest && event.target.closest('[data-vertex]');
    const shape = event.target.closest && event.target.closest('.an-pl-shape');
    const key = shape ? shape.dataset.id : '';
    if (handle) { this.#begin(event, { kind: 'corner', index: Number(handle.dataset.vertex), key: this.#state.selected }); return; }
    if (key) {
      this.#o.on.select(key);
      this.#begin(event, { kind: 'move', key });
      return;
    }
    this.#o.on.select('');
    this.#begin(event, { kind: 'pan' });
  }

  // Un angle de plus au polygone ; un clic près du premier le ferme, un clic au même endroit que le précédent (le premier appui d'un double-clic) ne compte
  // pas.
  #addAngle(event) {
    const point = this.#unit(event);
    const last = this.#poly.at(-1);
    if (last && last[0] === point[0] && last[1] === point[1]) return;
    const first = this.#poly[0];
    if (first && this.#poly.length >= 3 && Math.hypot(first[0] - point[0], first[1] - point[1]) / this.#perPixel <= CLOSE_AT) { this.finishPolygon(); return; }
    this.#poly.push(point);
    this.#o.on.note(this.#poly.length >= 3 ? 'an.tr.polyMore' : 'an.tr.polyGo');
    this.#drawEdit();
  }

  #move(event) {
    const gesture = this.#gesture;
    if (this.#state.tool === 'poly' && this.#poly.length) { this.#hover = this.#unit(event); this.#drawEdit(); }
    if (!gesture) return;
    if (!gesture.moved && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < DRAG_FROM) return;
    gesture.moved = true;
    ({ pan: () => this.#pan(event, gesture), move: () => this.#shift(event, gesture), corner: () => this.#pull(event, gesture),
      rect: () => this.#stretch(event, gesture) })[gesture.kind]();
  }

  #pan(event, gesture) {
    const { vw, vh } = this.#frameSize();
    this.#view = panBy(this.#view, event.clientX - gesture.x, event.clientY - gesture.y, vw, vh);
    gesture.x = event.clientX;
    gesture.y = event.clientY;
    this.#apply();
  }

  #item(key) { return this.#state.items.find(item => item.key === key); }

  // Le tracé déplacé : par pas de grille quand elle est allumée.
  #shift(event, gesture) {
    const base = (this.#item(gesture.key) || {}).shape;
    if (!base) return;
    const at = this.#unit(event, true);
    const step = this.#step;
    const moved = movedBy(base, snap(at[0] - gesture.from[0], step), snap(at[1] - gesture.from[1], step), this.#height);
    this.#override = { key: gesture.key, shape: moved };
    this.#render();
  }

  #pull(event, gesture) {
    const base = (this.#item(gesture.key) || {}).shape;
    if (!base) return;
    this.#override = { key: gesture.key, shape: withCorner(base, gesture.index, this.#unit(event)) };
    this.#render();
  }

  #stretch(event, gesture) {
    gesture.shape = rectFrom(gesture.a, this.#unit(event));
    this.#drawEdit();
  }

  #up(event) {
    const gesture = this.#gesture;
    if (!gesture) return;
    this.#gesture = null;
    this.#refs.frame.classList.remove('is-pan');
    try { this.#refs.frame.releasePointerCapture(event.pointerId); } catch (error) { /* déjà relâché */ }
    const override = this.#override;
    this.#override = null;
    if (gesture.kind === 'rect' && gesture.moved) {
      if (gesture.shape && rectOk(gesture.shape)) this.#o.on.draw(gesture.shape);
      else this.#o.on.note('an.tr.rectShort');
    } else if (override && gesture.moved) this.#o.on.edit(override.key, override.shape);
    this.#render();
  }

  #wheel(event) {
    event.preventDefault();
    const at = this.#local(event);
    const { vw, vh } = this.#frameSize();
    if (!vw || !vh) return;
    this.#view = zoomAt(this.#view, wheelFactor(event.deltaY, event.deltaMode), at.x, at.y, vw, vh);
    this.#apply();
  }

  // ---------- le clavier ----------

  #key(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const { key } = event;
    if (key === ' ') { event.preventDefault(); this.#space = true; return; }
    const zoom = { '+': 1.4, '=': 1.4, '-': 1 / 1.4, _: 1 / 1.4, 0: 0 }[key];
    if (zoom !== undefined) { event.preventDefault(); this.zoomBy(zoom); return; }
    if (this.#poly.length && (key === 'Enter' || key === 'Backspace')) {
      event.preventDefault();
      if (key === 'Enter') this.finishPolygon(); else { this.#poly.pop(); this.#drawEdit(); }
      return;
    }
    if (this.#state.selected && this.#state.tool === 'select') this.#keySelected(event);
  }

  // Le tracé choisi : Suppr l'efface, les flèches le déplacent d'un cran de la grille.
  #keySelected(event) {
    const { key } = event;
    const { selected } = this.#state;
    if (key === 'Delete' || key === 'Backspace') { event.preventDefault(); this.#o.on.remove(selected); return; }
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
    const base = (this.#item(selected) || {}).shape;
    if (!step || !base) return;
    event.preventDefault();
    this.#o.on.edit(selected, movedBy(base, step[0] * GRID, step[1] * GRID, this.#height));
  }
}
