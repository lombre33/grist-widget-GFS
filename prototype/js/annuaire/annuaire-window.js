// La fenêtre de l'annuaire (module Annuaire, demande du porteur du 25/11) : à gauche la hiérarchie, au milieu les personnes (liste, cartes de contact ou
// organigramme), à droite la fiche. Une fenêtre sur la base commune (js/ui/modal.js, charte) : le titre, la recherche et le pied restent en place, seuls les
// volets défilent ; Échap la ferme, un clic à côté ne ferme rien. Elle ne lit ni n'écrit rien : la lecture et la création sont à
// js/annuaire/annuaire-control.js, qui lui donne ce qu'elle montre (`show`) et reçoit ce que la personne demande (changer d'annuaire, en créer un, le régler).

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { mountWindow, giveBackFocus, tabStops, LIST_SHOWN } from '../ui/modal.js';
import { findNode, peopleIn, filterPeople, filterOptions, managerTree } from './annuaire-model.js';
import { structureItems, managerItems, pathIds, levelLabel } from './annuaire-items.js';
import { treeList, personRow, personCard, fiche, nodeFiche, filterBar } from './annuaire-panes.js';
import { OrgView } from './annuaire-org-view.js';
import { copyText } from './annuaire-copy.js';

const FOCUSABLE = 'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), [tabindex="0"], a[href]';
const VIEWS = Object.freeze([['list', 'list', 'an.view.list'], ['cards', 'tiles', 'an.view.cards'], ['org', 'org', 'an.view.org']]);

export class AnnuaireWindow {
  #o;
  #root = null;
  #refs = null;
  #mounted = null;
  #org = null;
  #show = { state: 'loading', annuaires: [], current: null, data: null, error: '' };
  #node = '';
  #query = '';
  #filters = {};
  #view = 'list';
  #mode = 'structures';
  #person = null; // le numéro de ligne de la personne dont la fiche est ouverte
  #struct = null; // l'identifiant du nœud dont la fiche est ouverte (l'organigramme des structures)
  #open = new Set(['']);
  #filtersOpen = false;
  #note = '';

  // opts : { container, t, locale() (la langue des dates), inertTargets(), onSwitch(), onConfigure(), onNew(), onFilterMore(colonne, option) -> Promise<valeur
  //   ou null>, onClose() }
  constructor(opts) { this.#o = opts; }

  get isOpen() { return this.#root !== null; }
  get element() { return this.#root; }

  // La fenêtre s'ouvre sur l'état de `show` (la lecture en cours, d'abord).
  open() {
    if (this.#root) return;
    this.#build();
    this.#mounted = mountWindow({ container: this.#o.container, root: this.#root, inertTargets: () => this.#o.inertTargets(),
      onKey: event => this.#keydown(event) });
    this.#paint();
    this.#refs.search.focus({ preventScroll: true });
  }

  close() {
    if (!this.#root) return;
    const { opener, unmount } = this.#mounted;
    unmount();
    this.#root = null;
    this.#refs = null;
    this.#mounted = null;
    giveBackFocus(opener);
    this.#o.onClose();
  }

  // La langue de GFS a changé : une fenêtre ouverte réécrit ses textes, une fenêtre fermée prendra les nouveaux à son ouverture.
  relocalize({ t }) {
    this.#o = { ...this.#o, t };
    if (this.#org) this.#org.relabel(t);
    this.#paint();
  }

  // Ce que la fenêtre montre : { state: 'loading' | 'none' | 'error' | 'ready', annuaires, current, data, error }. Un autre annuaire repart du haut de sa
  // hiérarchie.
  show(next) {
    const other = !this.#show.current || !next.current || this.#show.current.row !== next.current.row;
    this.#show = { ...this.#show, ...next };
    if (other) this.#reset();
    this.#paint();
  }

  #reset() {
    this.#node = '';
    this.#query = '';
    this.#filters = {};
    this.#person = null;
    this.#struct = null;
    this.#note = '';
    this.#open = new Set(['']);
    this.#filtersOpen = false;
    if (this.#refs) this.#refs.search.value = '';
  }

  // ---------- le cadre ----------

  #build() {
    const t = (key, vars) => this.#o.t(key, vars);
    const refs = {
      title: h('h2', { id: 'an-title' }), name: h('button', { type: 'button', class: 'an-name', 'aria-haspopup': 'dialog',
        dataset: { act: 'switch', fk: 'switch' } }),
      search: h('input', { type: 'search', autocomplete: 'off', dataset: { fk: 'search' } }),
      views: h('div', { class: 'an-seg', role: 'group' }), config: h('button', { type: 'button', class: 'an-ib',
        dataset: { act: 'configure', fk: 'configure' } }, icon('sliders')),
      filters: h('div', { class: 'an-filters-host' }), crumb: h('div', { class: 'an-crumb' }), list: h('div', { class: 'an-list' }),
      body: h('div', { class: 'mod-body an-body' }), state: h('div', { class: 'an-state' }), tree: h('nav', { class: 'an-card an-tree' }),
        main: h('div', { class: 'an-card an-main' }), side: h('aside', { class: 'an-card an-side' }),
      note: h('p', { class: 'mod-note an-foot', 'aria-live': 'polite' }), close: h('button',
        { type: 'button', class: 'btn', dataset: { act: 'close', fk: 'close' } }),
    };
    this.#org = new OrgView({ t, onPick: item => this.#orgPick(item), onMode: id => this.#orgMode(id) });
    refs.main.append(refs.crumb, refs.filters, refs.list, this.#org.element);
    refs.body.append(refs.state, refs.tree, refs.main, refs.side);
    this.#refs = refs;
    const section = h('section', { class: 'mod an', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'an-title' },
      h('header', { class: 'mod-head an-head' }, h('div', { class: 'an-top' }, refs.title, refs.name, h('span', { class: 'an-grow' }),
        h('label', { class: 'inp-search an-search' }, icon('search'), refs.search), refs.views, refs.config)),
      refs.body, h('footer', { class: 'mod-foot' }, refs.note, refs.close));
    this.#root = h('div', { class: 'mod-scrim an-scrim' }, section);
    refs.search.addEventListener('input', () => { this.#query = refs.search.value; this.#paintBody(); this.#paintFoot(); });
    this.#root.addEventListener('click', event => this.#click(event));
  }

  // ---------- ce qui se voit ----------

  #paint() {
    if (!this.#root) return;
    this.#paintHead();
    this.#paintBody();
    this.#paintFoot();
  }

  #paintHead() {
    const t = this.#o.t;
    const { title, name, search, views, config, close } = this.#refs;
    const { current } = this.#show;
    title.textContent = t('an.title');
    name.replaceChildren(h('span', { class: 'an-name-t' }, current ? current.name : t('an.none.name')), icon('chev-down'));
    name.title = t('an.switch');
    name.setAttribute('aria-label', t('an.switch'));
    search.placeholder = t('an.search');
    search.setAttribute('aria-label', t('an.searchLabel'));
    views.setAttribute('aria-label', t('an.views'));
    views.replaceChildren(...VIEWS.map(([id, glyph, key]) => h('button', { type: 'button', class: 'an-seg-b', 'aria-pressed': String(this.#view === id),
      title: t(key), 'aria-label': t(key), dataset: { act: 'view', view: id, fk: `v:${id}` } }, icon(glyph), h('span', { class: 'an-seg-t' }, t(key)))));
    config.title = t('an.configure');
    config.setAttribute('aria-label', t('an.configure'));
    close.textContent = t('an.close');
  }

  // Les personnes que le volet du milieu montre : toute la liste quand on cherche, sinon le nœud choisi et ce qui est dessous ; puis la recherche et les
  // filtres.
  #scope() {
    const { tree, people } = this.#show.data;
    const node = findNode(tree, this.#node) || tree;
    const base = this.#query.trim() ? people : peopleIn(node);
    return { node, base, found: filterPeople(base, { query: this.#query, filters: this.#filters }) };
  }

  #paintBody() {
    const { state, data } = this.#show;
    const refs = this.#refs;
    const ready = state === 'ready' && data;
    refs.state.hidden = Boolean(ready);
    refs.tree.hidden = !ready || this.#view === 'org';
    refs.main.hidden = !ready;
    refs.side.hidden = !ready || (this.#person === null && this.#struct === null);
    refs.body.dataset.side = String(!refs.side.hidden);
    refs.body.dataset.view = this.#view;
    if (!ready) { this.#paintState(); return; }
    this.#paintTree();
    this.#paintMain();
    this.#paintSide();
  }

  // Ce que la fenêtre dit quand elle n'a rien à montrer : la lecture en cours, aucun annuaire encore (avec le moyen d'en créer un), ou ce qui a mal tourné.
  #paintState() {
    const t = this.#o.t;
    const { state, error } = this.#show;
    const create = () => h('button', { type: 'button', class: 'btn primary', dataset: { act: 'new', fk: 'new' } }, icon('plus'), t('an.new'));
    const [glyph, head, text, action] = {
      loading: ['clock', t('an.loading'), '', null],
      none: ['annuaire', t('an.none.title'), t('an.none.text'), create()],
      error: ['warning', t('an.error.title'), error, state === 'error' ? h('button', { type: 'button', class: 'btn', dataset: { act: 'configure', fk: 'fix' } },
        icon('sliders'),
        t('an.configure')) : null],
    }[state] || ['clock', '', '', null];
    this.#refs.state.replaceChildren(icon(glyph, 'an-state-ic'), h('p', { class: 'an-state-title' }, head), text ? h('p', { class: 'an-note' }, text) : null,
      action);
  }

  #paintTree() {
    const { tree } = this.#show.data;
    const levels = this.#show.current.config.levels;
    this.#refs.tree.setAttribute('aria-label', this.#o.t('an.tree.label'));
    this.#refs.tree.replaceChildren(treeList(tree, { t: this.#o.t, selected: this.#node, open: this.#open, levels }));
  }

  #paintMain() {
    const { crumb, filters, list, main } = this.#refs;
    const org = this.#view === 'org';
    crumb.hidden = org;
    list.hidden = org;
    if (org) filters.hidden = true;
    this.#org.element.hidden = !org;
    main.dataset.view = this.#view;
    if (org) { this.#paintOrg(); return; }
    this.#paintList();
  }

  #paintList() {
    const t = this.#o.t;
    const { current, data } = this.#show;
    const { node, base, found } = this.#scope();
    const levels = current.config.levels;
    const searching = this.#query.trim() !== '';
    const level = !searching && node.level >= 0 ? levelLabel(levels[node.level]) : '';
    const options = filterOptions(base, current.config, data.schema, current.table).filter(option => option.values.length);
    const active = Object.values(this.#filters).reduce((sum, set) => sum + (set ? set.size : 0), 0);
    this.#refs.crumb.replaceChildren(...[h('h3', null, searching ? t('an.results') : node.name), level ? h('span', { class: 'an-pill' }, level) : null,
      h('span', { class: 'an-count' }, t('an.count', { n: found.length })),
      options.length ? h('button', { type: 'button', class: 'an-chip an-ftoggle', 'aria-pressed': String(this.#filtersOpen || active > 0),
        'aria-expanded': String(this.#filtersOpen),
        dataset: { act: 'filters', fk: 'filters' } }, icon('filter'), t('an.filters'), active ? h('b', null, String(active)) : null) : null].filter(Boolean));
    this.#refs.filters.hidden = !options.length || !this.#filtersOpen;
    const ctx = { t, locale: this.#o.locale() };
    this.#refs.filters.replaceChildren(filterBar(options, this.#filters, ctx));
    const rows = found.slice(0, LIST_SHOWN);
    const make = this.#view === 'cards' ? personCard : personRow;
    const at = Math.max(0, rows.findIndex(person => person.row === this.#person));
    this.#refs.list.className = this.#view === 'cards' ? 'an-list an-grid' : 'an-list';
    this.#refs.list.replaceChildren(...rows.map((person, i) => make(person, { selected: person.row === this.#person, tabStop: i === at })),
      ...(found.length > rows.length ? [h('p', { class: 'an-note' }, t('work.more', { n: LIST_SHOWN, total: found.length }))] : []),
      ...(found.length ? [] : [h('p', { class: 'an-note' }, t(data.people.length ? 'an.list.none' : 'an.list.empty'))]));
  }

  // L'organigramme : celui des structures (l'arbre des niveaux), ou celui des responsables quand l'annuaire dit qui est le responsable de chacun.
  #paintOrg() {
    const t = this.#o.t;
    const { current, data } = this.#show;
    const hasManager = Boolean(current.config.manager);
    const mode = this.#mode === 'managers' && hasManager ? 'managers' : 'structures';
    const roots = mode === 'managers' ? managerItems(managerTree(data.people)) : structureItems(data.tree, current.config.levels);
    const selected = mode === 'managers' ? (this.#person === null ? '' : `p${this.#person}`) : (this.#struct === null ? '' : (this.#struct || 'root'));
    this.#org.show(roots, { key: `${current.row}:${mode}`, selected, mode, modes: [
      { id: 'structures', label: t('an.org.structures') },
      { id: 'managers', label: t('an.org.managers'), greyed: !hasManager, why: t('an.org.noManager') }] });
  }

  #paintSide() {
    const { current, data } = this.#show;
    const t = this.#o.t;
    const genres = Object.fromEntries((data.schema[current.table] ? data.schema[current.table].columns : []).map(col => [col.id, col.genre]));
    const ctx = { t, locale: this.#o.locale(), levels: current.config.levels, config: current.config, genres };
    const person = this.#person === null ? null : data.people.find(each => each.row === this.#person);
    const node = this.#struct === null ? null : findNode(data.tree, this.#struct);
    const body = person ? fiche(person, ctx) : (node ? nodeFiche(node, ctx) : null);
    const closer = h('button', { type: 'button', class: 'an-ib an-side-x', title: t('an.fiche.close'), 'aria-label': t('an.fiche.close'),
      dataset: { act: 'side-close', fk: 'side-x' } },
      icon('x'));
    this.#refs.side.replaceChildren(...(body ? [closer, body] : []));
  }

  #paintFoot() {
    const t = this.#o.t;
    const { state, data } = this.#show;
    if (this.#note) { this.#refs.note.textContent = this.#note; return; }
    if (state !== 'ready' || !data) { this.#refs.note.textContent = ''; return; }
    const total = data.people.length;
    const found = this.#view === 'org' ? total : this.#scope().found.length;
    this.#refs.note.textContent = found === total ? t('an.foot.all', { n: total }) : t('an.foot.some', { n: found, total });
  }

  // ---------- les gestes ----------

  #click(event) {
    const button = event.target.closest('[data-act]');
    if (!button || !this.#root.contains(button) || this.#org.element.contains(button)) return;
    const handler = ACTIONS[button.dataset.act];
    if (handler) handler(this, button.dataset, button);
  }

  // Les clics de l'organigramme : une carte de structure ouvre la fiche de la structure, une carte de personne celle de la personne.
  #orgPick(item) {
    if (!item) return;
    this.#note = '';
    if (item.pick.node !== undefined) { this.#struct = item.pick.node; this.#person = null; } else { this.#person = item.pick.person; this.#struct = null; }
    this.#paintBody();
    this.#paintFoot();
    this.#focus(`oc:${item.id}`, 'side-x');
  }

  #orgMode(id) {
    const { current } = this.#show;
    if (id === 'managers' && !current.config.manager) { this.#say(this.#o.t('an.org.noManager')); return; }
    this.#note = '';
    this.#mode = id;
    this.#person = null;
    this.#struct = null;
    this.#paintBody();
    this.#paintFoot();
  }

  #say(text) {
    this.#note = text;
    this.#paintFoot();
  }

  // Choisit un nœud de la hiérarchie : lui et tout ce qui le porte se déplient, pour qu'il se voie.
  // Un geste que le contrôle fait (changer d'annuaire, en créer un, le régler).
  callout(name) { this.#o[name](); }

  pickNode(id) {
    this.#node = id;
    this.#query = '';
    this.#refs.search.value = '';
    this.#note = '';
    for (const each of pathIds(id)) this.#open.add(each);
    this.#paintBody();
    this.#paintFoot();
  }

  toggleNode(id) {
    if (!this.#open.delete(id)) this.#open.add(id);
    this.#paintTree();
    this.#focus(`tn:${id}`);
  }

  setView(view) {
    this.#view = view;
    this.#note = '';
    this.#paint();
    this.#focus(`v:${view}`);
  }

  pickPerson(row) {
    this.#person = this.#person === row ? null : row;
    this.#struct = null;
    this.#note = '';
    this.#paintBody();
    this.#focus(`pe:${row}`, 'side-x');
  }

  // Les personnes d'un nœud, dans la liste (le bouton « Voir les personnes » de la fiche d'une structure).
  listNode(id) {
    this.#view = 'list';
    this.#struct = null;
    this.pickNode(id);
    this.#paintHead();
  }

  toggleFilters() {
    this.#filtersOpen = !this.#filtersOpen;
    this.#paintBody();
    this.#focus('filters');
  }

  toggleFilter(col, value) {
    const set = new Set(this.#filters[col] || []);
    if (!set.delete(value)) set.add(value);
    this.#filters = { ...this.#filters, [col]: set };
    this.#paintBody();
    this.#paintFoot();
    this.#focus(`fl:${col}:${value}`);
  }

  // Les valeurs d'un filtre au-delà des pastilles : la liste avec recherche (js/ui/pick-window.js), ouverte par le contrôle.
  moreFilter(col) {
    const { current, data } = this.#show;
    const option = filterOptions(this.#scope().base, current.config, data.schema, current.table).find(each => each.col === col);
    if (option) void this.#o.onFilterMore(col, option).then(value => { if (value !== null) this.toggleFilter(col, value); });
  }

  async copy(value) {
    const t = this.#o.t;
    this.#say(await copyText(value, this.#root.ownerDocument) ? t('an.copied', { what: value }) : t('an.copyFailed'));
  }

  // La fiche se ferme : le clavier revient à la ligne ou à la carte qu'elle montrait (la recherche si elle n'est plus là).
  closeSide() {
    const back = this.#person !== null ? `pe:${this.#person}` : (this.#struct !== null ? `oc:${this.#struct || 'root'}` : '');
    this.#person = null;
    this.#struct = null;
    this.#paintBody();
    this.#paintFoot();
    this.#focus(back, 'search');
  }

  // Le clavier rendu à l'élément de clé `key` après un redessin ; `fallback` quand il n'est plus à l'écran (la fiche qui prend toute la place cache la liste).
  #focus(key, fallback = '') {
    const shown = [...this.#root.querySelectorAll('[data-fk]')].filter(node => node.getClientRects().length > 0);
    const target = shown.find(node => node.dataset.fk === key) || shown.find(node => node.dataset.fk === fallback);
    if (target) target.focus({ preventScroll: true });
  }

  // ---------- le clavier ----------

  #keydown(event) {
    const doc = this.#root.ownerDocument;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); this.close(); return; }
    if (event.key === 'Tab') { this.#tab(event, doc); return; }
    const active = doc.activeElement;
    if (!active || !active.closest) return;
    if (active.closest('.an-tn')) this.#treeKeys(event, active);
    else if (active.closest('.an-list')) this.#listKeys(event, active);
    else if (active === this.#refs.search && event.key === 'ArrowDown') {
      const first = this.#refs.list.querySelector('.an-person, .an-pcard');
      if (first && !this.#refs.list.hidden) { event.preventDefault(); first.focus(); }
    }
  }

  #tab(event, doc) {
    event.preventDefault();
    // ce qui est caché (`hidden` ou un volet que la fiche recouvre) n'est pas un arrêt
    const nodes = tabStops([...this.#root.querySelectorAll(FOCUSABLE)].filter(node => node.getClientRects().length > 0));
    const at = nodes.indexOf(doc.activeElement);
    (at < 0 ? this.#refs.search : nodes[(at + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length]).focus();
  }

  // La liste : ↑ et ↓ d'une personne à l'autre (↑ sur la première rend la recherche), ← et → d'une carte à l'autre.
  #listKeys(event, active) {
    const rows = [...this.#refs.list.querySelectorAll('.an-person, .an-pcard')];
    const move = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
    if (!move || !rows.includes(active)) return;
    if (this.#view === 'list' && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) return; // ← et → ne servent pas dans une liste
    event.preventDefault();
    const next = rows[rows.indexOf(active) + move];
    if (next) { next.focus(); next.scrollIntoView({ block: 'nearest' }); } else if (move < 0) this.#refs.search.focus();
  }

  // La hiérarchie : ↑ et ↓ d'un nœud à l'autre, → déplie, ← replie (ou remonte au parent).
  #treeKeys(event, active) {
    const buttons = [...this.#refs.tree.querySelectorAll('.an-tb')];
    const at = buttons.indexOf(active);
    if (at < 0) return;
    const id = active.dataset.id;
    const node = findNode(this.#show.data.tree, id);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const next = buttons[at + (event.key === 'ArrowDown' ? 1 : -1)];
      if (next) { event.preventDefault(); next.focus(); next.scrollIntoView({ block: 'nearest' }); }
    } else if (event.key === 'ArrowRight' && node && node.ch.length && !this.#open.has(id)) { event.preventDefault(); this.toggleNode(id); }
      else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (this.#open.has(id) && id) this.toggleNode(id);
      else buttons.slice(0, at).reverse().find(each => each.dataset.id !== id && id.startsWith(each.dataset.id))?.focus();
    }
  }
}

// Ce que fait chaque `data-act` de la fenêtre (hors de l'organigramme, qui lit les siens).
const ACTIONS = Object.freeze({
  close: window_ => window_.close(),
  switch: window_ => window_.callout('onSwitch'),
  configure: window_ => window_.callout('onConfigure'),
  new: window_ => window_.callout('onNew'),
  view: (window_, data) => window_.setView(data.view),
  'tree-pick': (window_, data) => window_.pickNode(data.id),
  'tree-toggle': (window_, data) => window_.toggleNode(data.id),
  person: (window_, data) => window_.pickPerson(Number(data.row)),
  filters: window_ => window_.toggleFilters(),
  filter: (window_, data) => window_.toggleFilter(data.col, data.value),
  'filter-more': (window_, data) => window_.moreFilter(data.col),
  copy: (window_, data) => void window_.copy(data.value),
  'side-close': window_ => window_.closeSide(),
  'node-list': (window_, data) => window_.listNode(data.id),
});
