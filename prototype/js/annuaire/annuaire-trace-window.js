// La fenêtre « Tracer les locaux » (module Annuaire, plan des bâtiments, lot 3 ; demande du porteur du 27/11 : « tracer les bâtiments, les étages et les locaux
// sur l'image », rectangle ou polygone sur une grille qui aimante, chaque tracé rattaché à une ligne de la table des lieux, « Créer un local : nom, usage,
// places », annuler, « Enregistrer le tracé » écrit tout d'un coup). Une fenêtre du widget sur la base commune (js/ui/modal.js, charte) : à gauche le plan
// (js/annuaire/ annuaire-trace-canvas.js), à droite la liste des locaux du lieu (avec recherche) : on choisit le local à tracer dans la liste, ou on en crée
// un, puis on trace. Le brouillon (js/annuaire/annuaire-trace.js) garde tout jusqu'à « Enregistrer le tracé » : Échap, « Annuler » ou un refus de Grist
// n'écrivent rien ; la fenêtre dit ce que Grist répond, tel quel, et reste ouverte. Elle ne parle pas à Grist : l'écriture est `save`, que le contrôle lui
// donne (js/annuaire/annuaire-control.js). Rend vrai quand le tracé a été écrit, faux quand la personne renonce.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openModal } from '../ui/modal.js';
import { normalize, words, matchesWords } from '../ui/search.js';
import { iconButton } from './annuaire-setup-shared.js';
import { NO_SEATS } from './annuaire-plan.js';
import { TraceCanvas } from './annuaire-trace-canvas.js';
import { askNewRoom } from './annuaire-trace-new.js';
import { Draft, traceActions } from './annuaire-trace.js';

const TOOLS = Object.freeze([['select', 'pointer', 'an.tr.toolSelect'], ['rect', 'shape-rect', 'an.tr.toolRect'], ['poly', 'shape-poly', 'an.tr.toolPoly']]);
const natural = (a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true, sensitivity: 'base' });

const toolbarButton = (glyph, fk, extra = {}) => h('button', { type: 'button', class: 'an-tr-tb', dataset: { fk }, ...extra }, icon(glyph));

export class TraceWindow {
  #o;
  #draft;
  #canvas;
  #refs = {};
  #rooms = new Map(); // les locaux qui existent : numéro -> { name, use, capacity }
  #state = { tool: 'select', snap: true, selected: '', target: '', filter: '', hint: '' };
  #busy = false;
  #done = null;

  // opts : { container, inertTargets(), t, plan (js/annuaire/annuaire-plan.js : `planOf`), host (le lieu dont l'image est tracée : { id, name, depth }), rooms
  //   (ses enfants :
  //   [{ id, name, use, capacity, shape }]), imageUrl (l'image du plan, en `data:`), ask(opts) -> Promise<boolean>, save(actions) -> Promise (les actions de
  //   Grist) }
  constructor(opts) {
    this.#o = opts;
    this.#draft = new Draft(opts.rooms.map(room => ({ id: room.id, shape: room.shape })));
    for (const room of opts.rooms) this.#rooms.set(room.id, { name: room.name, use: room.use, capacity: room.capacity });
    this.#canvas = new TraceCanvas({ t: opts.t, on: { draw: shape => this.#drawn(shape), edit: (key, shape) => this.#edited(key, shape),
      select: key => this.#select(key),
      remove: key => this.#unset(key), blocked: () => this.#hint('an.tr.hintPick'), note: key => this.#hint(key) } });
  }

  // Le nom, l'usage et les places d'un local : celui de la table, ou celui qu'on vient de créer.
  #info(key) { return this.#draft.made(key) || this.#rooms.get(key) || { name: String(key), use: '', capacity: 0 }; }

  // La fenêtre : rend une promesse (vrai quand le tracé est écrit).
  run() {
    const { t, host } = this.#o;
    const refs = this.#refs = { note: h('p', { class: 'mod-note an-set-note', 'aria-live': 'polite' }), list: h('div', { class: 'an-tr-list', role: 'list' }),
      count: h('span', { class: 'an-count' }), search: h('input', { type: 'search', class: 'an-set-input an-tr-search', autocomplete: 'off',
        placeholder: t('an.tr.search'),
        'aria-label': t('an.tr.search'), dataset: { fk: 'trace-search' } }),
      cancel: h('button', { type: 'button', class: 'btn', dataset: { fk: 'trace-cancel' } }, t('an.set.cancel')),
      save: h('button', { type: 'button', class: 'btn primary', dataset: { fk: 'trace-save' } }), tools: this.#toolbar(),
      fresh: h('button', { type: 'button', class: 'btn sm an-tr-fresh', dataset: { fk: 'trace-new' } }, icon('plus'), t('an.tr.new')) };
    const section = h('section', { class: 'mod an-trace', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'an-tr-title' },
      h('header', { class: 'mod-head' }, h('h2', { id: 'an-tr-title' }, t('an.tr.title', { name: host.name }))), refs.tools,
      h('div', { class: 'mod-body an-tr-body' }, this.#canvas.element,
        h('div', { class: 'an-tr-side' }, h('div', { class: 'an-tr-side-head' }, h('h3', { class: 'an-fs-h' }, t('an.tr.rooms')), refs.count), refs.search,
          refs.list, refs.fresh)),
      h('footer', { class: 'mod-foot' }, refs.note, refs.cancel, refs.save));
    const { done, result } = openModal({ container: this.#o.container, section, inertTargets: this.#o.inertTargets, first: refs.search,
      cancel: false, keepOpen: () => this.#escape() });
    this.#done = done;
    section.addEventListener('click', event => this.#click(event));
    section.addEventListener('keydown', event => this.#key(event));
    refs.search.addEventListener('input', () => { this.#state.filter = refs.search.value; this.#paintList(); });
    this.#canvas.load(this.#o.imageUrl);
    this.#refresh();
    refs.search.focus({ preventScroll: true });
    return result.then(Boolean);
  }

  #toolbar() {
    const { t } = this.#o;
    const label = (button, key) => { button.setAttribute('aria-label', t(key)); button.title = t(key); return button; };
    const tools = TOOLS.map(([tool, glyph, key]) => label(toolbarButton(glyph, `trace-tool:${tool}`, { dataset: { tool, fk: `trace-tool:${tool}` } }), key));
    const rest = [['grid', 'trace-snap', 'an.tr.snap'], ['plus', 'trace-zoom-in', 'an.plan.zoomIn'], ['minus', 'trace-zoom-out', 'an.plan.zoomOut'],
      ['fit', 'trace-zoom-fit', 'an.plan.zoomFit'], ['undo', 'trace-undo', 'an.tr.undo'], ['redo', 'trace-redo', 'an.tr.redo'],
        ['trash', 'trace-del', 'an.tr.del']]
      .map(([glyph, fk, key]) => label(toolbarButton(glyph, fk), key));
    const [snap, zin, zout, zfit, undo, redo, del] = rest;
    const group = (...nodes) => h('div', { class: 'an-tr-group', role: 'group' }, ...nodes);
    return h('div', { class: 'an-tr-bar', role: 'toolbar', 'aria-label': t('an.tr.bar') }, group(...tools), group(snap), group(zin, zout, zfit),
      group(undo, redo), group(del));
  }

  // ---------- ce que le canevas dit ----------

  #drawn(shape) {
    const key = this.#state.target;
    if (!key || !this.#draft.has(key)) return;
    this.#draft.setShape(key, shape);
    this.#state.selected = key;
    this.#state.tool = 'select';
    this.#hint('an.tr.drawn');
  }

  #edited(key, shape) {
    this.#draft.setShape(key, shape);
    this.#state.hint = '';
    this.#refresh();
  }

  #select(key) {
    this.#state.selected = key;
    if (key) this.#state.target = key;
    this.#state.hint = '';
    this.#refresh();
  }

  #unset(key) {
    this.#draft.setShape(key, null);
    this.#state.selected = '';
    this.#refresh();
  }

  // Dit une phrase (la clé d'un texte) dans le pied, à la place de l'aide du moment.
  #hint(key) {
    this.#state.hint = this.#o.t(key, { name: this.#info(this.#state.target).name });
    this.#refresh();
  }

  // ---------- les gestes de la fenêtre ----------

  #click(event) {
    const node = event.target.closest('[data-fk], [data-key], [data-drop]');
    if (!node || node.closest('.an-tr-vp') || node.getAttribute('aria-disabled') === 'true') return;
    if (node.dataset.drop) { this.#drop(node.dataset.drop); return; }
    if (node.dataset.key) { this.#pick(node.dataset.key); return; }
    const { fk } = node.dataset;
    const state = this.#state;
    if (fk.startsWith('trace-tool:')) { state.tool = node.dataset.tool; this.#canvas.cancelDrawing(); state.hint = ''; }
    else if (fk === 'trace-snap') state.snap = !state.snap;
    else if (fk === 'trace-undo' || fk === 'trace-redo') this.#history(fk === 'trace-undo');
    else { this.#act(fk); return; }
    this.#refresh();
  }

  // Les gestes qui n'ont rien à redessiner d'eux-mêmes (le zoom, l'effacement, la création, la sortie, l'enregistrement).
  #act(fk) {
    if (fk.startsWith('trace-zoom-')) this.#canvas.zoomBy({ in: 1.5, out: 1 / 1.5, fit: 0 }[fk.slice(11)]);
    else if (fk === 'trace-del') { if (this.#state.selected) this.#unset(this.#state.selected); }
    else if (fk === 'trace-new') void this.#create();
    else if (fk === 'trace-cancel') void this.#leave();
    else if (fk === 'trace-save') void this.#save();
  }

  // Ctrl+Z et Ctrl+Y (ou Ctrl+Maj+Z) hors d'un champ de saisie.
  #key(event) {
    if (!(event.ctrlKey || event.metaKey) || event.target.closest('input')) return;
    const key = event.key.toLowerCase();
    if (key !== 'z' && key !== 'y') return;
    event.preventDefault();
    this.#history(key === 'z' && !event.shiftKey);
    this.#refresh();
  }

  #history(back) {
    if (back) this.#draft.undo(); else this.#draft.redo();
    const state = this.#state;
    for (const field of ['selected', 'target']) if (state[field] && !this.#draft.has(state[field])) state[field] = '';
    state.hint = '';
  }

  // Le local de la liste devient celui qu'on trace ; sans tracé, le rectangle est l'outil qu'on prend, avec un tracé, on le choisit pour l'ajuster.
  #pick(raw) {
    const key = this.#draft.has(raw) ? raw : Number(raw);
    const state = this.#state;
    state.target = key;
    state.selected = this.#draft.shapeOf(key) ? key : '';
    if (!this.#draft.shapeOf(key) && state.tool === 'select') state.tool = 'rect';
    this.#canvas.cancelDrawing();
    state.hint = '';
    this.#refresh();
  }

  async #create() {
    const { t, container, inertTargets } = this.#o;
    const taken = [...this.#draft.keys()].map(key => this.#info(key).name);
    const info = await askNewRoom({ container, inertTargets, t, taken });
    if (!info) { this.#refs.fresh.focus(); return; }
    const key = this.#draft.addRoom(info);
    Object.assign(this.#state, { target: key, selected: '', tool: 'rect', hint: '', filter: '' });
    this.#refs.search.value = '';
    this.#refresh();
  }

  #drop(key) {
    this.#draft.dropRoom(key);
    for (const field of ['selected', 'target']) if (this.#state[field] === key) this.#state[field] = '';
    this.#refresh();
  }

  // Échap : range d'abord le tracé en cours, puis demande avant d'abandonner un brouillon ; rend vrai quand la touche a servi (la fenêtre reste ouverte).
  #escape() {
    if (this.#busy) return true;
    if (this.#canvas.cancelDrawing()) { this.#hint('an.tr.cancelled'); return true; }
    if (this.#draft.count > 0) { void this.#leave(); return true; }
    return false;
  }

  async #leave() {
    if (this.#draft.count === 0) { this.#done(false); return; }
    const { t } = this.#o;
    const sure = await this.#o.ask({ title: t('an.tr.leaveTitle'), message: t('an.tr.leaveText', { n: this.#draft.count }), confirmLabel: t('an.tr.leave'),
      cancelLabel: t('an.tr.stay'), safeFirst: true });
    if (sure) this.#done(false);
  }

  async #save() {
    const { t, plan, host } = this.#o;
    if (this.#busy || this.#draft.count === 0) return;
    this.#busy = true;
    this.#refresh();
    try {
      await this.#o.save(traceActions(this.#draft.changes(), plan, host));
      this.#done(true);
    } catch (error) {
      this.#busy = false;
      this.#refresh();
      this.#say(t('an.tr.refused', { reason: String(error && error.message ? error.message : error) }), true);
    }
  }

  // ---------- ce qui se voit ----------

  #say(text, warn = false) {
    this.#refs.note.textContent = text;
    this.#refs.note.classList.toggle('is-warn', warn);
  }

  // L'aide du moment : la phrase qu'on vient de dire, sinon celle de l'outil et du local choisis.
  #helpText() {
    const { t } = this.#o;
    const { hint, tool, target } = this.#state;
    if (hint) return hint;
    if (tool === 'select') return t('an.tr.hintSelect');
    return target ? t(tool === 'rect' ? 'an.tr.hintRect' : 'an.tr.hintPoly', { name: this.#info(target).name }) : t('an.tr.hintPick');
  }

  #refresh() {
    const { t } = this.#o;
    const { tool, snap, selected, target } = this.#state;
    const items = this.#draft.keys().map(key => ({ key, name: this.#info(key).name, shape: this.#draft.shapeOf(key),
      grey: NO_SEATS.includes(this.#info(key).use) }));
    this.#canvas.set({ items, selected, target, tool, snap });
    const grey = (node, on) => node.setAttribute('aria-disabled', String(on));
    for (const button of this.#refs.tools.querySelectorAll('[data-tool]')) button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
    const named = fk => this.#refs.tools.querySelector(`[data-fk="${fk}"]`);
    named('trace-snap').setAttribute('aria-pressed', String(snap));
    grey(named('trace-undo'), !this.#draft.canUndo);
    grey(named('trace-redo'), !this.#draft.canRedo);
    grey(named('trace-del'), !selected || this.#busy);
    const n = this.#draft.count;
    this.#refs.save.textContent = t('an.tr.save', { n });
    grey(this.#refs.save, n === 0 || this.#busy);
    if (!this.#busy) this.#say(this.#helpText());
    this.#paintList();
  }

  // La liste des locaux : un bouton par local (le local qu'on trace est enfoncé), son état (tracé, à tracer, nouveau) et, pour un local créé ici, de quoi le
  // retirer.
  #paintList() {
    const { t } = this.#o;
    const needles = words(this.#state.filter);
    const rows = this.#draft.keys().map(key => ({ key, ...this.#info(key) })).sort(natural).filter(row => matchesWords(needles, normalize(row.name)));
    const traced = this.#draft.keys().filter(key => this.#draft.shapeOf(key)).length;
    this.#refs.count.textContent = t('an.tr.traced', { n: traced, max: this.#draft.keys().length });
    this.#refs.list.replaceChildren(...rows.map(row => this.#row(row)),
      ...(rows.length ? [] : [h('p', { class: 'an-note' }, t(this.#draft.keys().length ? 'an.tr.noMatch' : 'an.tr.noRooms'))]));
  }

  #row(row) {
    const { t } = this.#o;
    const made = Boolean(this.#draft.made(row.key));
    const has = Boolean(this.#draft.shapeOf(row.key));
    const status = made ? t('an.tr.statusNew') : t(has ? 'an.tr.statusTraced' : 'an.tr.statusTodo');
    const main = h('button', { type: 'button', class: `an-tr-room${has ? ' is-traced' : ''}`, 'aria-pressed': String(row.key === this.#state.target),
      dataset: { key: String(row.key), fk: `trace-room:${row.key}` } }, icon(has ? 'check' : 'door', 'an-pl-ic'), h('span', { class: 'an-tr-name' }, row.name),
    h('span', { class: 'an-pill' }, status));
    return h('div', { class: 'an-tr-row', role: 'listitem' }, main,
      made ? iconButton(t, { glyph: 'trash', label: t('an.tr.drop', { name: row.name }), fk: `trace-drop:${row.key}`, data: { drop: String(row.key) } }) :
        null);
  }
}

// Ouvre la fenêtre sur le lieu `host` du plan lu (`read` : la lecture de l'annuaire, `read.plan`) ; rend vrai quand le tracé a été écrit. `imageUrl` : l'image
// du plan, déjà lue ; `save(actions)` : l'écriture, d'un coup. Les enfants du lieu sont tous là, tracés ou non.
export function openTrace({ read, host, imageUrl, t, container, inertTargets, ask, save }) {
  const { plan } = read;
  const rooms = plan.kids.get(host.id) || [];
  return new TraceWindow({ container, inertTargets, t, plan, host, imageUrl, ask, save,
    rooms: rooms.map(room => ({ id: room.id, name: room.name, use: room.use, capacity: room.capacity, shape: room.shape })) }).run();
}
