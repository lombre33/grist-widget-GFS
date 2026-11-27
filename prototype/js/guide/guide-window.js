// La fenêtre du guide (module Guide, demande du porteur du 27/11) : les thèmes en tuiles, ou la liste (l'arbre des démarches à gauche, les démarches du nœud à
// droite), ou la fiche d'une démarche (ses étapes, ses rôles, qui contacter). Une fenêtre sur la base commune (js/ui/modal.js, charte) : le titre, la recherche
// et le pied restent en place, seuls les volets défilent ; Échap la ferme, un clic à côté ne ferme rien. Elle ne lit ni n'écrit rien : la lecture et la
// création sont à js/guide/guide-control.js, qui lui donne ce qu'elle montre (`show`) et reçoit ce que la personne demande (changer de guide, en créer un, le
// régler).

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { mountWindow, giveBackFocus, trapTab, listKeys, LIST_SHOWN } from '../ui/modal.js';
import { ancestors, below, searchProcedures } from './guide-model.js';
import { themeTiles, treeNav, procedureRow, infoPane, contactsPane, visibleAnswer } from './guide-panes.js';
import { typeOf } from './guide-types.js';
import { treeKeys } from './guide-keys.js';

const VIEWS = Object.freeze([['themes', 'tiles', 'gd.view.themes'], ['list', 'list', 'gd.view.list']]);

export class GuideWindow {
  #o;
  #root = null;
  #refs = null;
  #mounted = null;
  #show = { state: 'loading', guides: [], current: null, data: null, error: '' };
  #view = 'themes';
  #node = null; // la démarche dont la liste montre ce qu'il y a dessous (rien : tout)
  #proc = null; // la démarche dont la fiche est ouverte
  #query = '';
  #open = new Set();
  #note = '';

  // opts : { container, t, inertTargets(), onSwitch(), onConfigure(), onNew(), onNewProc(mère: ligne ou null), onEditProc(ligne), writeBlock() -> texte ou
  //   null, onCopy(texte) -> Promise<vrai si copié>, onClose() }
  constructor(opts) { this.#o = opts; }

  get isOpen() { return this.#root !== null; }
  get element() { return this.#root; }

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

  // La langue de GFS a changé : une fenêtre ouverte réécrit ses textes.
  relocalize({ t }) {
    this.#o = { ...this.#o, t };
    this.#paint();
  }

  // Ce que la fenêtre montre : { state: 'loading' | 'none' | 'error' | 'ready', guides, current, data, error }. Un autre guide repart des thèmes.
  show(next) {
    const other = !this.#show.current || !next.current || this.#show.current.row !== next.current.row;
    this.#show = { ...this.#show, ...next };
    if (other) this.#reset();
    else if (this.#proc !== null && this.#show.data && !this.#show.data.index.byRow.has(this.#proc)) this.#proc = null; // la démarche a disparu à la relecture
    this.#paint();
  }

  #reset() {
    this.#view = 'themes';
    this.#node = null;
    this.#proc = null;
    this.#query = '';
    this.#note = '';
    this.#open = new Set();
    if (this.#refs) this.#refs.search.value = '';
  }

  say(text) {
    if (!this.#root) return;
    this.#note = text;
    this.#paintFoot();
  }

  // ---------- le cadre ----------

  #build() {
    const t = (key, vars) => this.#o.t(key, vars);
    const refs = { title: h('h2', { id: 'gd-title' }), name: h('button', { type: 'button', class: 'gd-name', 'aria-haspopup': 'dialog',
      dataset: { act: 'switch', fk: 'switch' } }),
      search: h('input', { type: 'search', autocomplete: 'off', dataset: { fk: 'search' } }), views: h('div', { class: 'gd-seg', role: 'group' }),
      add: h('button', { type: 'button', class: 'gd-ibtn', dataset: { act: 'newproc', fk: 'newproc' } }, icon('plus')),
      config: h('button', { type: 'button', class: 'gd-ibtn', dataset: { act: 'configure', fk: 'configure' } }, icon('sliders')),
      body: h('div', { class: 'mod-body gd-body' }), note: h('p', { class: 'mod-note gd-foot', 'aria-live': 'polite' }),
      close: h('button', { type: 'button', class: 'btn', dataset: { act: 'close', fk: 'close' } }) };
    this.#refs = refs;
    const section = h('section', { class: 'mod gd', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'gd-title' },
      h('header', { class: 'mod-head gd-head' }, h('div', { class: 'gd-top' }, icon('guide', 'gd-logo'), refs.title, refs.name, h('span', { class: 'gd-grow' }),
        h('label', { class: 'inp-search gd-search' }, icon('search'), refs.search), refs.views, refs.add, refs.config)),
      refs.body, h('footer', { class: 'mod-foot' }, refs.note, refs.close));
    this.#root = h('div', { class: 'mod-scrim gd-scrim' }, section);
    refs.search.addEventListener('input', () => { this.#query = refs.search.value; this.#proc = null; this.#note = ''; this.#paintBody(); this.#paintFoot(); });
    this.#root.addEventListener('click', event => this.#click(event));
    refs.search.setAttribute('aria-label', t('gd.searchLabel'));
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
    const { title, name, search, views, add, config, close } = this.#refs;
    const { current } = this.#show;
    title.textContent = t('gd.title');
    name.replaceChildren(h('span', { class: 'gd-name-t' }, current ? current.name : t('gd.none.name')), icon('chev-down'));
    name.title = t('gd.switch');
    name.setAttribute('aria-label', t('gd.switch'));
    search.placeholder = t('gd.search');
    views.setAttribute('aria-label', t('gd.views'));
    views.replaceChildren(...VIEWS.map(([id, glyph, key]) => h('button', { type: 'button', class: 'gd-seg-b',
      'aria-pressed': String(this.#view === id && this.#proc === null),
      title: t(key), 'aria-label': t(key), dataset: { act: 'view', view: id, fk: `v:${id}` } }, icon(glyph), h('span', { class: 'gd-seg-t' }, t(key)))));
    const why = this.#addWhy();
    add.title = why || t('gd.proc.new');
    add.setAttribute('aria-label', t('gd.proc.new'));
    add.setAttribute('aria-disabled', why ? 'true' : 'false');
    config.title = t('gd.configure');
    config.setAttribute('aria-label', t('gd.configure'));
    close.textContent = t('gd.close');
  }

  // Pourquoi « Nouvelle démarche » est grisé : le document ne s'écrit pas, ou aucun guide n'est lu. Jamais masqué (charte).
  #addWhy() {
    const blocked = this.#o.writeBlock ? this.#o.writeBlock() : null;
    if (blocked) return blocked;
    return this.#ready() ? '' : this.#o.t('gd.proc.needGuide');
  }

  // Le bouton qui crée une démarche, dans l'écran vide.
  #addButton() {
    const t = this.#o.t;
    const why = this.#addWhy();
    return h('button', { type: 'button', class: 'btn primary', 'aria-disabled': why ? 'true' : null, title: why || null,
      dataset: { act: 'newproc', fk: 'newproc-empty' } },
      icon('plus'), t('gd.proc.new'));
  }

  #ready() { return this.#show.state === 'ready' && this.#show.data; }

  #paintBody() {
    const { body } = this.#refs;
    if (!this.#ready()) { body.replaceChildren(this.#stateNode()); return; }
    const data = this.#show.data;
    let nodes;
    if (this.#proc !== null) nodes = this.#ficheNodes(data);
    else if (this.#query.trim()) nodes = this.#resultsNodes(data);
    else nodes = this.#view === 'themes' ? this.#themesNodes(data) : this.#listNodes(data);
    body.dataset.mode = this.#proc !== null ? 'fiche' : this.#query.trim() ? 'results' : this.#view;
    body.replaceChildren(...nodes);
  }

  // Ce que la fenêtre dit quand elle n'a rien à montrer : la lecture en cours, aucun guide encore (avec le moyen d'en créer un), ou ce qui a mal tourné.
  #stateNode() {
    const t = this.#o.t;
    const { state, error } = this.#show;
    const create = () => h('button', { type: 'button', class: 'btn primary', dataset: { act: 'new', fk: 'new' } }, icon('plus'), t('gd.new'));
    const [glyph, head, text, action] = {
      loading: ['clock', t('gd.loading'), '', null],
      none: ['guide', t('gd.none.title'), t('gd.none.text'), create()],
      error: ['warning', t('gd.error.title'), error, h('button', { type: 'button', class: 'btn', dataset: { act: 'configure', fk: 'fix' } }, icon('sliders'),
        t('gd.configure'))],
    }[state] || ['clock', '', '', null];
    return h('div', { class: 'gd-state' }, icon(glyph, 'gd-state-ic'), h('p', { class: 'gd-state-title' }, head),
      text ? h('p', { class: 'gd-note' }, text) : null, action);
  }

  #themesNodes(data) {
    const t = this.#o.t;
    if (!data.procs.length) return [this.#emptyCard()];
    return [h('div', { class: 'gd-card gd-home' }, h('h3', { class: 'gd-home-t' }, t('gd.home')),
      h('div', { class: 'gd-tiles' }, ...themeTiles(data, { t, answerFor: data.answerFor })))];
  }

  // Un guide sans démarche : il le dit et propose d'écrire la première.
  #emptyCard() {
    const t = this.#o.t;
    return h('div', { class: 'gd-card gd-empty' }, icon('guide', 'gd-state-ic'), h('p', { class: 'gd-state-title' }, t('gd.empty.title')),
      h('p', { class: 'gd-note' }, t('gd.empty')),
      this.#addButton());
  }

  // Les démarches qui répondent à la recherche, d'un bout à l'autre du guide.
  #resultsNodes(data) {
    const t = this.#o.t;
    const found = searchProcedures(data.procs, this.#query);
    const rows = found.slice(0, LIST_SHOWN).map((proc, at) => procedureRow(data, proc, { answerFor: data.answerFor, tabStop: at === 0 }));
    return [h('div', { class: 'gd-card gd-results' }, h('p', { class: 'gd-hint' }, t('gd.searchHint')), h('div', { class: 'gd-list' }, ...rows,
      found.length > rows.length ? h('p', { class: 'gd-note' }, t('work.more', { n: LIST_SHOWN, total: found.length })) : null,
      found.length ? null : h('p', { class: 'gd-note' }, t('gd.listNone'))))];
  }

  // Les démarches sous le nœud choisi (toutes celles du guide sans nœud), de haut en bas de l'arbre.
  #below(data) {
    const out = [];
    const walk = proc => { for (const kid of data.index.children.get(proc.row) || []) { out.push(kid); walk(kid); } };
    if (this.#node === null) for (const root of data.index.roots) { out.push(root); walk(root); } else walk(data.index.byRow.get(this.#node));
    return out;
  }

  #listNodes(data) {
    const t = this.#o.t;
    if (!data.procs.length) return [this.#emptyCard()];
    const node = this.#node === null ? null : data.index.byRow.get(this.#node);
    const rows = this.#below(data);
    const shown = rows.slice(0, LIST_SHOWN).map((proc, at) => procedureRow(data, proc, { answerFor: data.answerFor, tabStop: at === 0, here: this.#node }));
    const head = h('div', { class: 'gd-list-h' }, h('h3', null, node ? node.title : t('gd.all')),
      h('span', { class: 'gd-pill' }, t('gd.count', { n: rows.length })),
      h('span', { class: 'gd-grow' }), node ? h('button', { type: 'button', class: 'btn sm',
        dataset: { act: 'open', row: String(node.row), fk: 'node-fiche' } },
        icon('open'), t('gd.fiche')) : null);
    return [h('nav', { class: 'gd-card gd-treecard' }, treeNav(data, { selected: this.#node, open: this.#open, t })),
      h('div', { class: 'gd-card gd-main' }, head, h('div', { class: 'gd-list' }, ...shown,
        rows.length ? null : h('p', { class: 'gd-note' }, t('gd.listNone'))))];
  }

  #ficheNodes(data) {
    const t = this.#o.t;
    const proc = data.index.byRow.get(this.#proc);
    const back = h('button', { type: 'button', class: 'btn sm gd-back', dataset: { act: 'back', fk: 'back' } }, icon('chev-left'), t('gd.back'));
    const edit = h('button', { type: 'button', class: 'btn sm gd-edit-b', 'aria-disabled': this.#addWhy() ? 'true' : null, title: this.#addWhy() || null,
      dataset: { act: 'edit', row: String(proc.row), fk: 'edit' } }, icon('edit'), t('gd.proc.edit'));
    return [h('div', { class: 'gd-card gd-fiche-info' }, h('div', { class: 'gd-fiche-bar' }, back, edit), infoPane(data, proc, { t, config: data.config })),
      h('div', { class: 'gd-card gd-fiche-who' }, contactsPane(visibleAnswer(data.answerFor(proc.row), typeOf(data.config, proc)),
        { t, titleOf: row => (data.index.byRow.get(row) || { title: '' }).title }))];
  }

  #paintFoot() {
    const t = this.#o.t;
    const note = this.#refs.note;
    const data = this.#ready() ? this.#show.data : null;
    if (this.#note) { note.textContent = this.#note; return; }
    if (!data) { note.textContent = ''; return; }
    const total = data.procs.length;
    if (this.#proc !== null) note.textContent = t('gd.foot.in', { n: total });
    else if (this.#query.trim()) note.textContent = t('gd.foot.results', { n: searchProcedures(data.procs, this.#query).length });
    else if (this.#view === 'themes') note.textContent = t('gd.foot.themes', { n: data.index.roots.length, total });
    else note.textContent = this.#node === null ? t('gd.foot.all', { total }) : t('gd.foot.list',
      { n: below(data.index, this.#node), name: data.index.byRow.get(this.#node).title, total });
  }

  // ---------- les gestes ----------

  // Redessine le corps en gardant le clavier là où il était (retrouvé par sa clé).
  #repaint() {
    const doc = this.#root.ownerDocument;
    const key = doc.activeElement && doc.activeElement.dataset ? doc.activeElement.dataset.fk : null;
    this.#paintHead();
    this.#paintBody();
    this.#paintFoot();
    const again = key ? [...this.#root.querySelectorAll('[data-fk]')].find(node => node.dataset.fk === key) : null;
    if (again) again.focus({ preventScroll: true });
  }

  #spread(row) {
    const { index } = this.#show.data;
    for (const mother of ancestors(index, row)) this.#open.add(mother.row);
  }

  #act(name, data) {
    const row = Number(data.row);
    const handlers = {
      close: () => this.close(),
      switch: () => this.#o.onSwitch(),
      configure: () => this.#o.onConfigure(),
      new: () => this.#o.onNew(),
      newproc: () => this.#newProc(),
      mapoff: () => this.say(this.#o.t('gd.map.off')),
      edit: () => this.#guardedEdit(row),
      view: () => { this.#view = data.view; this.#proc = null; this.#note = ''; this.#repaint(); },
      open: () => this.#openProc(row),
      back: () => { this.#proc = null; this.#note = ''; this.#repaint(); },
      node: () => this.#pickNode(row),
      toggle: () => this.#toggle(row),
      copy: () => this.#copy(data.text),
    };
    if (handlers[name]) handlers[name]();
  }

  // « Nouvelle démarche » : la mère proposée est la démarche ouverte, ou celle dont la liste montre le dessous ; grisé, un clic dit pourquoi.
  #newProc() {
    const why = this.#addWhy();
    if (why) { this.say(why); return; }
    this.#o.onNewProc(this.#proc !== null ? this.#proc : this.#node);
  }

  #guardedEdit(row) {
    const why = this.#addWhy();
    if (why) { this.say(why); return; }
    this.#o.onEditProc(row);
  }

  // Montre la fiche d'une démarche (après un enregistrement : la démarche qu'on vient d'écrire).
  showProc(row) { this.#openProc(row); }

  #click(event) {
    const button = event.target.closest('[data-act]');
    if (button && this.#root.contains(button)) this.#act(button.dataset.act, button.dataset);
  }

  // Ouvre la fiche d'une démarche (la recherche se vide : on est arrivé).
  #openProc(row) {
    if (!this.#ready() || !this.#show.data.index.byRow.has(row)) return;
    this.#proc = row;
    this.#note = '';
    this.#spread(row);
    this.#repaint();
    this.#refs.body.scrollTop = 0;
  }

  // Une démarche de l'arbre : sa liste se montre ; une démarche sans rien dessous ouvre sa fiche.
  #pickNode(row) {
    const { index } = this.#show.data;
    if (!(index.children.get(row) || []).length) { this.#openProc(row); return; }
    this.#node = row;
    this.#open.add(row);
    this.#spread(row);
    this.#note = '';
    this.#repaint();
  }

  #toggle(row) {
    if (this.#open.has(row)) this.#open.delete(row); else this.#open.add(row);
    this.#repaint();
  }

  async #copy(text) {
    const t = this.#o.t;
    this.say(await this.#o.onCopy(text) ? t('gd.copied', { what: text }) : t('gd.copyFailed'));
  }

  // Une autre fenêtre est posée par-dessus la nôtre (un choix, le réglage) : c'est elle qui tient le clavier.
  #covered() {
    const host = this.#root.parentElement;
    const later = node => node !== this.#root && node.classList.contains('mod-scrim') &&
      Boolean(this.#root.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING);
    return Boolean(host) && [...host.children].some(later);
  }

  #keydown(event) {
    if (this.#covered()) return;
    const doc = this.#root.ownerDocument;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); this.close(); return; }
    if (event.key === 'Tab') { trapTab(event, this.#root, this.#refs.search); return; }
    const active = doc.activeElement;
    if (!active || !active.closest) return;
    if (active.closest('.gd-tree') && this.#ready()) treeKeys(event, active, { tree: this.#refs.body.querySelector('.gd-tree'), index: this.#show.data.index,
      open: this.#open,
      toggle: row => this.#toggle(row) });
    else if (active === this.#refs.search || active.closest('.gd-list, .gd-tiles')) {
      listKeys(event, { search: this.#refs.search, items: [...this.#refs.body.querySelectorAll('.gd-row, .gd-tile')] });
    }
  }
}
