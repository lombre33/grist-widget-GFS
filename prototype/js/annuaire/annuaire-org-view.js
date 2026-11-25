// L'organigramme de l'annuaire, à l'écran (module Annuaire, demande du porteur du 25/11 : « super important ») : une carte par élément, posée par la mise en
// page de js/annuaire/annuaire-org.js, des traits en équerre en SVG, le repli d'une branche, le zoom, « Tout voir » et le glissé pour déplacer le dessin. Les
// cartes sont des boutons (Tab les parcourt) ; un clic désigne un élément, que la fenêtre de l'annuaire montre. Le dessin ne lit rien : les éléments viennent
// de js/annuaire/annuaire-items.js. Aucun attribut `style` (la politique de sécurité le refuse) : les positions passent par des variables du CSSOM.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { layoutOrg, defaultOpen, step, fitZoom } from './annuaire-org.js';

// La carte (largeur, hauteur) et l'espace entre deux cartes d'un étage (gx) et entre deux étages (gy) ; chaque petite ligne de relation ajoute LINE à la
// hauteur.
export const BOX = Object.freeze({ w: 196, h: 66, gx: 12, gy: 34 });
export const LINE = 15;
const SVG_NS = 'http://www.w3.org/2000/svg';

export class OrgView {
  #t;
  #opts;
  #refs;
  #roots = [];
  #key = null;
  #open = new Set();
  #zoom = 1;
  #selected = '';
  #modes = [];
  #mode = '';
  #size = { width: 0, height: 0 };
  #layout = null;
  #lines = 0;

  // opts : { t, onPick(item), onMode(id), onNote(texte) } ; `item` est l'élément dont la carte a reçu le clic.
  constructor(opts) {
    this.#opts = opts;
    this.#t = opts.t;
    const button = (act, glyph) => h('button', { type: 'button', class: 'an-ib', dataset: { act, fk: act } }, icon(glyph));
    this.#refs = {
      modes: h('div', { class: 'an-seg', role: 'group' }),
      out: button('org-out', 'minus'), zoom: h('span', { class: 'an-zoom', 'aria-live': 'polite' }), in: button('org-in', 'plus'),
      fit: button('org-fit', 'fit'), all: button('org-all', 'chev-down'),
      canvas: h('div', { class: 'an-org-canvas' }),
      empty: h('p', { class: 'an-org-none', hidden: true }),
    };
    this.#refs.sheet = h('div', { class: 'an-org-sheet' }, this.#refs.canvas);
    this.#refs.scroll = h('div', { class: 'an-org-scroll', tabindex: '0', role: 'group' }, this.#refs.sheet, this.#refs.empty);
    this.element = h('div', { class: 'an-org' },
      h('div', { class: 'an-org-bar' }, this.#refs.modes, h('span', { class: 'an-grow' }),
        h('div', { class: 'an-zoombar', role: 'group' }, this.#refs.out, this.#refs.zoom, this.#refs.in, this.#refs.fit, this.#refs.all)),
      this.#refs.scroll);
    this.#refs.canvas.style.setProperty('--ow', `${BOX.w}px`);
    this.#refs.canvas.style.setProperty('--oh', `${BOX.h}px`);
    this.element.addEventListener('click', event => this.#click(event));
    this.#refs.scroll.addEventListener('pointerdown', event => this.#pan(event));
  }

  relabel(t) {
    this.#t = t;
    this.#labels();
  }

  // Montre `roots` ([{ id, ch, card, pick }]). `key` : change quand ce sont d'autres éléments (un autre annuaire, l'autre organigramme) : les branches repliées
  // et le zoom repartent de zéro, sinon ils restent comme la personne les a laissés. `modes` : [{ id, label, greyed, why }] ; `selected` : l'identifiant de
  // l'élément choisi ; `lines` : combien de petites lignes de relation les cartes peuvent porter (elles gardent toutes la même hauteur).
  show(roots, { key, selected = '', modes = [], mode = '', lines = 0 }) {
    const fresh = key !== this.#key;
    this.#lines = lines;
    this.#roots = roots;
    this.#selected = selected;
    this.#modes = modes;
    this.#mode = mode;
    if (fresh) { this.#key = key; this.#open = defaultOpen(roots); }
    this.#render();
    if (fresh) this.start();
  }

  // Le premier regard : tout l'organigramme quand il tient à un zoom lisible (80 % au moins), sinon 80 %, centré sur la première carte.
  start() {
    const { scroll } = this.#refs;
    const wanted = fitZoom(this.#size, { width: scroll.clientWidth - 28, height: scroll.clientHeight - 28 });
    this.#setZoom(Math.max(wanted, 0.8));
    const first = this.#layout && this.#layout.entries.find(entry => entry.depth === 0);
    scroll.scrollLeft = first ? Math.max(0, (first.x + BOX.w / 2) * this.#zoom + 14 - scroll.clientWidth / 2) : 0;
    scroll.scrollTop = 0;
  }

  // Le zoom qui fait tenir tout l'organigramme dans la place (jamais plus de 100 %).
  fit() {
    const { scroll } = this.#refs;
    this.#setZoom(fitZoom(this.#size, { width: scroll.clientWidth - 24, height: scroll.clientHeight - 24 }));
    scroll.scrollTo(0, 0);
  }

  #labels() {
    const t = this.#t;
    const { modes, out, in: zoomIn, fit, all, scroll } = this.#refs;
    const name = (button, key) => { button.title = t(key); button.setAttribute('aria-label', t(key)); };
    name(out, 'an.org.out');
    name(zoomIn, 'an.org.in');
    name(fit, 'an.org.fit');
    name(all, this.#allOpen() ? 'an.org.foldAll' : 'an.org.openAll');
    all.replaceChildren(icon(this.#allOpen() ? 'chev-up' : 'chev-down'));
    scroll.setAttribute('aria-label', t('an.org.label'));
    modes.setAttribute('aria-label', t('an.org.modes'));
    this.#refs.empty.textContent = t('an.org.none');
  }

  #allOpen() {
    let every = true;
    const walk = item => { if (item.ch.length && !this.#open.has(item.id)) every = false; item.ch.forEach(walk); };
    this.#roots.forEach(walk);
    return every;
  }

  #render() {
    const { canvas, empty } = this.#refs;
    const box = { ...BOX, h: BOX.h + this.#lines * LINE };
    canvas.style.setProperty('--oh', `${box.h}px`);
    const layout = layoutOrg(this.#roots, { box, open: this.#open });
    this.#layout = layout;
    this.#size = { width: layout.width, height: layout.height };
    empty.hidden = layout.entries.length > 0;
    const lines = document.createElementNS(SVG_NS, 'svg');
    lines.setAttribute('class', 'an-lines');
    lines.setAttribute('width', String(layout.width));
    lines.setAttribute('height', String(layout.height));
    lines.setAttribute('aria-hidden', 'true');
    for (const d of layout.paths) {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      lines.append(path);
    }
    canvas.replaceChildren(lines, ...[...layout.entries].reverse().map(entry => this.#card(entry)));
    canvas.style.setProperty('--cw', `${layout.width}px`);
    canvas.style.setProperty('--ch', `${layout.height}px`);
    this.#paintModes();
    this.#paintZoom();
    this.#labels();
  }

  #card(entry) {
    const { item } = entry;
    const { card } = item;
    const t = this.#t;
    const extra = (card.lines || []).map(text => h('span', { class: 'an-oc-line', title: text }, text));
    const body = h('button', { type: 'button', class: 'an-oc', 'aria-pressed': String(item.id === this.#selected),
      dataset: { act: 'org-pick', id: item.id, fk: `oc:${item.id}` } },
      card.initials ? h('span', { class: 'an-av' }, card.initials) : null,
      h('span', { class: 'an-oc-text' }, h('span', { class: 'an-oc-title' }, card.title), card.head ||
        card.sub ? h('span', { class: 'an-oc-sub' }, card.head || card.sub) : null, ...extra),
      card.count ? h('span', { class: 'an-pill' }, String(card.count)) : null);
    const opened = this.#open.has(item.id);
    const fold = item.ch.length
      ? h('button', { type: 'button', class: 'an-fold', 'aria-expanded': String(opened),
        title: t(opened ? 'an.org.fold' : 'an.org.unfold', { n: item.ch.length }),
        'aria-label': t(opened ? 'an.org.fold' : 'an.org.unfold', { n: item.ch.length }), dataset: { act: 'org-fold', id: item.id, fk: `of:${item.id}` } },
      opened ? icon('chev-up') : `+${item.ch.length}`) : null;
    return h('div', { class: 'an-ocw', vars: { '--x': `${entry.x}px`, '--y': `${entry.y}px` } }, body, fold);
  }

  #paintModes() {
    this.#refs.modes.replaceChildren(...this.#modes.map(mode => h('button', { type: 'button', class: 'an-seg-b', 'aria-pressed': String(mode.id === this.#mode),
      'aria-disabled': mode.greyed ? 'true' : null, title: mode.greyed ? mode.why : null, dataset: { act: 'org-mode', mode: mode.id, fk: `om:${mode.id}` } },
    mode.label)));
    this.#refs.modes.hidden = this.#modes.length === 0;
  }

  #paintZoom() {
    const { canvas, sheet, zoom, out, in: zoomIn } = this.#refs;
    canvas.style.setProperty('--z', String(this.#zoom));
    sheet.style.setProperty('--sw', `${Math.ceil(this.#size.width * this.#zoom)}px`);
    sheet.style.setProperty('--sh', `${Math.ceil(this.#size.height * this.#zoom)}px`);
    zoom.textContent = `${Math.round(this.#zoom * 100)} %`;
    out.setAttribute('aria-disabled', String(step(this.#zoom, -1) === this.#zoom));
    zoomIn.setAttribute('aria-disabled', String(step(this.#zoom, 1) === this.#zoom));
  }

  // Un nouveau zoom, en gardant au centre ce qui y était.
  #setZoom(next) {
    const { scroll } = this.#refs;
    const centre = { x: (scroll.scrollLeft + scroll.clientWidth / 2) / this.#zoom, y: (scroll.scrollTop + scroll.clientHeight / 2) / this.#zoom };
    this.#zoom = next;
    this.#paintZoom();
    scroll.scrollLeft = Math.max(0, centre.x * next - scroll.clientWidth / 2);
    scroll.scrollTop = Math.max(0, centre.y * next - scroll.clientHeight / 2);
  }

  #click(event) {
    const button = event.target.closest('[data-act]');
    if (!button || !this.element.contains(button)) return;
    const { act, id, mode } = button.dataset;
    if (act === 'org-out' || act === 'org-in') this.#setZoom(step(this.#zoom, act === 'org-in' ? 1 : -1));
    else if (act === 'org-fit') this.fit();
    else if (act === 'org-all') this.#toggleAll();
    else if (act === 'org-fold') this.#toggle(id);
    else if (act === 'org-mode') this.#opts.onMode(mode);
    else if (act === 'org-pick') this.#opts.onPick(this.#find(id));
  }

  #find(id) {
    let found = null;
    const walk = item => { if (item.id === id) found = item; else item.ch.forEach(walk); };
    this.#roots.forEach(walk);
    return found;
  }

  // Replie ou déplie une branche, en gardant le clavier sur son bouton.
  #toggle(id) {
    if (!this.#open.delete(id)) this.#open.add(id);
    this.#render();
    const again = [...this.#refs.canvas.querySelectorAll('[data-fk]')].find(node => node.dataset.fk === `of:${id}`);
    if (again) again.focus({ preventScroll: true });
  }

  // Tout déplier quand une branche est repliée, sinon tout replier sauf la racine.
  #toggleAll() {
    if (this.#allOpen()) this.#open = new Set(this.#roots.map(root => root.id));
    else { const every = new Set(); const walk = item => { if (item.ch.length) every.add(item.id); item.ch.forEach(walk); }; this.#roots.forEach(walk);
      this.#open = every; }
    this.#render();
  }

  // Le glissé à la souris : le dessin suit la main (un clic sur une carte ou un bouton n'est pas un glissé).
  #pan(event) {
    if (event.button !== 0 || event.target.closest('button')) return;
    const { scroll } = this.#refs;
    const from = { x: event.clientX, y: event.clientY, left: scroll.scrollLeft, top: scroll.scrollTop };
    scroll.classList.add('is-pan');
    if (scroll.setPointerCapture) scroll.setPointerCapture(event.pointerId);
    const move = moved => { scroll.scrollLeft = from.left - (moved.clientX - from.x); scroll.scrollTop = from.top - (moved.clientY - from.y); };
    const end = () => {
      scroll.classList.remove('is-pan');
      scroll.removeEventListener('pointermove', move);
      scroll.removeEventListener('pointerup', end);
      scroll.removeEventListener('pointercancel', end);
    };
    scroll.addEventListener('pointermove', move);
    scroll.addEventListener('pointerup', end);
    scroll.addEventListener('pointercancel', end);
  }
}
