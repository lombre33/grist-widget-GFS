// L'image d'un plan et son cadre (module Annuaire, plan des bâtiments, lot 2 ; demande du porteur du 27/11 : « le plan comme base »). Un lieu peut porter
// l'image de son plan (une pièce jointe de la table des lieux : js/annuaire/annuaire-images.js, genre « plan ») ; ce module la montre dans un cadre qu'on
// agrandit et qu'on
// déplace : la molette ou les boutons « + », « − » et « Ajuster » (le calcul est à js/annuaire/annuaire-plan-zoom.js), le glisser à la souris, et au clavier
//   « + », « − », « 0 » et les flèches quand le cadre a le clavier. Grisé, jamais masqué : un bouton sans effet (déjà tout entier, déjà au plus près) reste là,
//   grisé. L'image se lit par le cadre d'envoi de GFS, une fois (elle reste en mémoire : quelques plans à la fois) ; si elle ne vient pas, le cadre le dit,
//   rien d'autre ne change. Des fonctions qui construisent des nœuds ; le cadre garde son agrandissement quand le volet se redessine (c'est le même nœud).

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { imageIn, loadImage } from './annuaire-images.js';
import { FIT, MAX_ZOOM, clampView, zoomAt, panBy, isFit, wheelFactor, keyMove } from './annuaire-plan-zoom.js';

const BUTTONS = Object.freeze([['zoom-in', 'plus', 'an.plan.zoomIn'], ['zoom-out', 'minus', 'an.plan.zoomOut'], ['zoom-fit', 'fit', 'an.plan.zoomFit']]);

export class PlanMap {
  #refs;
  #view = FIT;
  #shown = ''; // le lieu et la pièce jointe montrés : `${lieu}:${pièce}`
  #drag = null;
  #t = null;

  constructor() {
    const frame = h('div', { class: 'an-pl-vp', tabindex: '0', role: 'group', dataset: { fk: 'plan-map' } });
    const img = h('img', { class: 'an-pl-img', alt: '', draggable: 'false', hidden: true });
    const note = h('p', { class: 'an-note an-pl-mapnote' });
    const bar = h('div', { class: 'an-pl-zoom', role: 'group' }, ...BUTTONS.map(([act, glyph]) =>
      h('button', { type: 'button', class: 'an-pl-zb', dataset: { pl: act, fk: `plan-${act}` } }, icon(glyph))));
    frame.append(img, note, bar);
    this.#refs = { frame, img, note, bar };
    this.element = h('figure', { class: 'an-pl-map' }, frame);
    bar.addEventListener('click', event => this.#press(event));
    frame.addEventListener('wheel', event => this.#wheel(event), { passive: false });
    frame.addEventListener('pointerdown', event => this.#down(event));
    frame.addEventListener('pointermove', event => this.#move(event));
    frame.addEventListener('pointerup', event => this.#up(event));
    frame.addEventListener('pointercancel', event => this.#up(event));
    frame.addEventListener('dblclick', event => this.#double(event));
    frame.addEventListener('keydown', event => this.#key(event));
  }

  // Montre le plan de `place` ({ id, name, plan : le numéro de la pièce jointe }) ; le même lieu avec la même image ne recommence rien (l'agrandissement
  // reste).
  show({ t, place }) {
    const { frame, img, note } = this.#refs;
    this.#t = t;
    frame.setAttribute('aria-label', t('an.plan.mapLabel', { name: place.name }));
    frame.title = t('an.plan.mapHint');
    for (const button of this.#refs.bar.children) button.setAttribute('aria-label', t(BUTTONS.find(([act]) => act === button.dataset.pl)[2]));
    const key = `${place.id}:${place.plan}`;
    if (key !== this.#shown) {
      this.#shown = key;
      this.#view = FIT;
      const known = imageIn('plan', place.plan);
      img.hidden = true;
      note.hidden = false;
      note.textContent = known === '' ? t('an.plan.mapFailed', { name: place.name }) : t('an.plan.mapLoading');
      if (known) this.#put(img, known);
      else if (known === undefined) void loadImage('plan', place.plan).then(url => this.#loaded(key, url, place.name));
    }
    this.#apply();
  }

  #loaded(key, url, name) {
    if (key !== this.#shown) return; // un autre plan est venu depuis
    if (url) this.#put(this.#refs.img, url);
    else this.#refs.note.textContent = this.#t('an.plan.mapFailed', { name });
    this.#apply();
  }

  #put(img, url) {
    img.src = url;
    img.hidden = false;
    this.#refs.note.hidden = true;
  }

  // La taille du cadre en pixels (0 tant qu'il n'est pas dans la page : rien ne bouge alors).
  #size() {
    const { frame } = this.#refs;
    return { vw: frame.clientWidth || 0, vh: frame.clientHeight || 0 };
  }

  // Pose la vue sur l'image et dit l'état des boutons et du curseur.
  #apply() {
    const { frame, img, bar } = this.#refs;
    const { vw, vh } = this.#size();
    this.#view = vw && vh ? clampView(this.#view, vw, vh) : this.#view;
    img.style.transform = isFit(this.#view) ? '' : `translate(${this.#view.x}px, ${this.#view.y}px) scale(${this.#view.k})`;
    frame.classList.toggle('is-zoomed', !isFit(this.#view));
    const grey = { 'zoom-in': this.#view.k >= MAX_ZOOM, 'zoom-out': isFit(this.#view), 'zoom-fit': isFit(this.#view) };
    for (const button of bar.children) button.setAttribute('aria-disabled', String(Boolean(grey[button.dataset.pl])));
  }

  #zoom(factor, px, py) {
    const { vw, vh } = this.#size();
    if (!vw || !vh) return;
    this.#view = factor === 0 ? FIT : zoomAt(this.#view, factor, px, py, vw, vh);
    this.#apply();
  }

  #press(event) {
    const button = event.target.closest('[data-pl]');
    if (!button || button.getAttribute('aria-disabled') === 'true') return;
    const { vw, vh } = this.#size();
    const factor = { 'zoom-in': 1.5, 'zoom-out': 1 / 1.5, 'zoom-fit': 0 }[button.dataset.pl];
    if (factor !== undefined) this.#zoom(factor, vw / 2, vh / 2);
  }

  // Le point du cadre sous le pointeur.
  #at(event) {
    const box = this.#refs.frame.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  #wheel(event) {
    event.preventDefault();
    const at = this.#at(event);
    this.#zoom(wheelFactor(event.deltaY, event.deltaMode), at.x, at.y);
  }

  #double(event) {
    if (event.target.closest('.an-pl-zoom')) return;
    const at = this.#at(event);
    this.#zoom(isFit(this.#view) ? 2 : 0, at.x, at.y);
  }

  #down(event) {
    if (event.button !== 0 || event.target.closest('.an-pl-zoom') || isFit(this.#view)) return;
    this.#drag = { x: event.clientX, y: event.clientY };
    try { this.#refs.frame.setPointerCapture(event.pointerId); } catch (error) { /* le glisser marche sans la capture */ }
    this.#refs.frame.classList.add('is-drag');
  }

  #move(event) {
    if (!this.#drag) return;
    const { vw, vh } = this.#size();
    this.#view = panBy(this.#view, event.clientX - this.#drag.x, event.clientY - this.#drag.y, vw, vh);
    this.#drag = { x: event.clientX, y: event.clientY };
    this.#apply();
  }

  #up(event) {
    if (!this.#drag) return;
    this.#drag = null;
    this.#refs.frame.classList.remove('is-drag');
    try { this.#refs.frame.releasePointerCapture(event.pointerId); } catch (error) { /* déjà relâché */ }
  }

  #key(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const move = keyMove(event.key, this.#view);
    if (!move) return;
    event.preventDefault();
    const { vw, vh } = this.#size();
    if (move.zoom !== 1) this.#zoom(move.zoom, vw / 2, vh / 2);
    else if (vw && vh) { this.#view = panBy(this.#view, move.dx, move.dy, vw, vh); this.#apply(); }
  }
}
