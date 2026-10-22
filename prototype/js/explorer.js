// L'explorateur de fichiers (cahier 4.4, 6.3) : le cadre qu'ouvre GFS pour choisir un fichier de n'importe quelle app. Il n'écrit rien lui-même.
// Il remplace le cadre (défaut 6.7, point 1) ; « Fermer » ou Échap ramène à l'app, restée vivante et cachée. Il ne connaît pas les apps :
// le contrôleur lui donne les fichiers, les noms, le grisé et ce qu'on peut créer, et reçoit « ouvrir », « nouveau » et « fermer ». Épingler, renommer
// et déplacer passent à `filing` (js/filing.js) ; dupliquer et supprimer restent grisés : ils se font dans l'app (contrats 6.4).

import { h } from './dom.js';
import { icon } from './icons.js';
import { listItems, treeRows, typeChoices } from './explorer-model.js';
import { words } from './search.js';
import { buildShell, relabel, crumbs, tree, listHead, fileRow, folderRow, tile, emptyMessage, infoBar } from './explorer-view.js';
import { LANGUAGE_NAMES } from './language.js';
import { openMenu, closeMenu } from './menu.js';

export class Explorer {
  #opts;
  #refs;
  #files = [];
  #rows = [];
  #loading = false;
  #problems = [];
  #restricted = false;
  // Deux tris : celui des dossiers et des favoris (par nom), celui de Récents (par date, le plus récent d'abord).
  state = { view: 'folder', path: '', open: new Set(), display: 'list', sort: { key: 'name', dir: 1 }, recentSort: { key: 'mod', dir: -1 }, type: 'all', q: '', sel: null };

  // opts : { container, i18n, locale, now(), appName(id), typeLabel(file), lockOf(file), newTypes(), importTypes(), onOpen(file), onNew(entry), onImport(entry), onClose(), onApps(), canClose(), notice(text),
  //          language() → { choice, grist }, onLanguage(choice), personal() → le rangement est-il à la personne seule ?,
  //          filing: { togglePin(file), rename(file), moveFile(file), renameFolder(path), moveFolder(path) }, onDemo()? (le bouton « Démo », en mode développement seulement) }
  constructor(opts) {
    this.#opts = opts;
    const { root, refs } = buildShell(opts.i18n);
    this.root = root;
    this.#refs = refs;
    opts.container.append(root);
    this.#bind();
    this.render();
  }

  get isOpen() { return !this.root.hidden; }

  get files() { return this.#files; }

  setFiles(files) {
    this.#files = files;
    const keys = new Set(files.map(file => file.key));
    if (this.state.sel && !this.state.sel.startsWith('dir:') && !keys.has(this.state.sel)) this.state.sel = null;
    if (this.isOpen) this.render();
  }

  // `restricted` : GFS n'a pas l'accès complet, la liste est vide pour cette raison et non parce qu'il n'y a aucun fichier.
  setStatus({ loading = false, problems = [], restricted = false }) {
    this.#loading = loading;
    this.#problems = problems;
    this.#restricted = restricted;
    if (this.isOpen) this.#renderList();
  }

  open() {
    this.root.hidden = false;
    this.render();
    const row = this.#refs.list.querySelector('[tabindex="0"]');
    (row || this.#refs.search).focus({ preventScroll: true });
  }

  close() {
    closeMenu();
    this.root.hidden = true;
  }

  // La langue de GFS a changé : les textes du cadre fixe se réécrivent, et tout le reste se redessine dans la nouvelle langue (dates comprises).
  relocalize({ i18n, locale }) {
    this.#opts = { ...this.#opts, i18n, locale };
    closeMenu();
    relabel(this.#refs, i18n);
    if (this.isOpen) this.render();
  }

  // ---------- état ----------

  #sort() { return this.state.view === 'recent' ? this.state.recentSort : this.state.sort; }

  get #filtering() { return words(this.state.q).length > 0 || this.state.type !== 'all'; }

  #ctx(extra = {}) {
    const { state } = this;
    const sel = state.sel;
    const row = sel ? this.#rows.find(r => (r.kind === 'folder' ? `dir:${r.path}` : r.file.key) === sel) : null;
    return {
      t: this.#opts.i18n.t, state, locale: this.#opts.locale, now: this.#opts.now(), appName: this.#opts.appName, typeLabel: this.#opts.typeLabel,
      lockOf: this.#opts.lockOf, sort: this.#sort(), filtering: this.#filtering, favCount: this.#files.filter(file => file.pinned).length, totalFiles: this.#files.length,
      selected: row, personal: this.#opts.personal(), ...extra,
    };
  }

  // ---------- dessin ----------

  render() {
    this.#renderHead();
    this.#renderCrumbs();
    this.#renderTree();
    this.#renderList();
  }

  #renderHead() {
    const { state } = this;
    const { t } = this.#opts.i18n;
    const { viewList, viewTiles, typeBtn, closeBtn } = this.#refs;
    for (const [button, mode] of [[viewList, 'list'], [viewTiles, 'tiles']]) {
      const on = state.display === mode;
      button.classList.toggle('on', on);
      button.setAttribute('aria-pressed', String(on));
    }
    const choice = state.type === 'all' ? null : this.#types().find(item => item.value === state.type);
    typeBtn.replaceChildren(...(choice ? [h('span', { class: 'tyi', 'data-fam': choice.known ? choice.family : null }, icon(choice.icon))] : []), choice ? choice.label : t('ex.allTypes'), icon('chev-down'));
    closeBtn.setAttribute('aria-disabled', String(!this.#opts.canClose()));
  }

  #renderCrumbs() { this.#refs.crumbs.replaceChildren(...crumbs(this.#ctx())); }

  #renderTree() {
    const top = this.#refs.tree.scrollTop;
    this.#refs.tree.replaceChildren(...tree(this.#ctx({ treeRows: treeRows(this.#files, this.state.open, this.#opts.locale) })));
    this.#refs.tree.scrollTop = top;
  }

  #renderList() {
    const { list, scroll, empty, notices } = this.#refs;
    const top = scroll.scrollTop;
    const focused = this.#focusedKey();
    const result = listItems(this.#files, { ...this.state, sort: this.#sort() }, { locale: this.#opts.locale, typeLabel: this.#opts.typeLabel });
    this.#rows = result.rows;
    const keys = this.#rows.map(r => (r.kind === 'folder' ? `dir:${r.path}` : r.file.key));
    if (this.state.sel && !keys.includes(this.state.sel)) this.state.sel = null;
    const ctx = this.#ctx();
    const tiles = this.state.display === 'tiles';
    const cards = this.#rows.map(r => (tiles ? tile(ctx, r) : (r.kind === 'folder' ? folderRow(ctx, r) : fileRow(ctx, r.file, result.flat))));
    list.replaceChildren(...(tiles ? [h('div', { class: 'th-grid' }, ...cards)] : [listHead(ctx), ...cards]));
    list.classList.toggle('is-tiles', tiles);
    notices.replaceChildren(...this.#problems.map(text => h('div', { class: 'banner', role: 'alert' }, icon('warning'), text)));
    const message = this.#loading ? this.#opts.i18n.t('ex.loading') : (this.#rows.length ? '' : (this.#restricted ? this.#opts.i18n.t('ex.emptyNoAccess') : emptyMessage(ctx)));
    empty.textContent = message;
    empty.hidden = !message;
    scroll.scrollTop = top;
    this.#roving();
    this.#renderInfo();
    if (focused) this.#focusKey(focused);
  }

  // Redessiner la liste ne doit pas faire perdre la ligne où se trouve le clavier, ni celle dont un bouton l'a (l'étoile, « Plus d'actions »).
  #focusedKey() {
    const active = this.root.ownerDocument.activeElement;
    const row = active && this.#refs.list.contains(active) ? active.closest('[data-key]') : null;
    return row ? row.dataset.key : null;
  }

  #focusKey(key) {
    const row = [...this.#refs.list.querySelectorAll('[data-key]')].find(item => item.dataset.key === key) || this.#refs.list.querySelector('[tabindex="0"]');
    if (row) row.focus({ preventScroll: true });
  }

  #renderInfo() {
    const ctx = this.#ctx();
    this.#refs.info.replaceChildren(infoBar(ctx));
    const off = !ctx.selected;
    this.#refs.openBtn.setAttribute('aria-disabled', String(off));
  }

  // Une seule ligne dans l'ordre de tabulation : la ligne choisie, sinon la première.
  #roving() {
    const rows = [...this.#refs.list.querySelectorAll('[data-key]')];
    const chosen = rows.find(row => row.dataset.key === this.state.sel) || rows[0];
    for (const row of rows) row.tabIndex = row === chosen ? 0 : -1;
  }

  #types() { return typeChoices(this.#files, this.#opts.typeLabel); }

  // ---------- gestes ----------

  #bind() {
    const { search, viewList, viewTiles, typeBtn, newBtn, openBtn, closeBtn, appsBtn, langBtn, demoBtn, crumbs: crumbsNav, tree: treeNav, list } = this.#refs;
    if (this.#opts.onDemo) {
      demoBtn.hidden = false;
      demoBtn.addEventListener('click', () => this.#opts.onDemo());
    }
    search.addEventListener('input', () => { this.state.q = search.value; this.state.sel = null; this.#renderCrumbs(); this.#renderList(); });
    appsBtn.addEventListener('click', () => this.#opts.onApps());
    langBtn.addEventListener('click', () => this.#languageMenu());
    viewList.addEventListener('click', () => this.#setDisplay('list'));
    viewTiles.addEventListener('click', () => this.#setDisplay('tiles'));
    typeBtn.addEventListener('click', () => this.#typeMenu());
    newBtn.addEventListener('click', () => this.#newMenu());
    openBtn.addEventListener('click', () => this.#openSelected());
    closeBtn.addEventListener('click', () => this.#requestClose());
    crumbsNav.addEventListener('click', event => { const link = event.target.closest('[data-path]'); if (link) this.#goFolder(link.dataset.path); });
    treeNav.addEventListener('click', event => this.#onTree(event));
    list.addEventListener('click', event => this.#onList(event));
    list.addEventListener('dblclick', event => { const row = event.target.closest('[data-key]'); if (row && !event.target.closest('button')) this.#activate(row.dataset.key); });
    list.addEventListener('keydown', event => this.#onListKey(event));
    // Échap sur le document : il ferme aussi quand le focus est tombé sur le fond (clic dans une zone vide, liste redessinée). Un menu ou une
    // fenêtre qui l'a pris pour lui (preventDefault, stopPropagation) passe avant.
    this.root.ownerDocument.addEventListener('keydown', event => { if (this.isOpen) this.#onKey(event); });
  }

  #setDisplay(mode) { this.state.display = mode; this.#renderHead(); this.#renderList(); }

  #goFolder(path) {
    const { state } = this;
    state.view = 'folder';
    state.path = path;
    state.q = '';
    state.type = 'all';
    state.sel = null;
    this.#refs.search.value = '';
    path.split('/').filter(Boolean).reduce((acc, part) => { const next = acc ? `${acc}/${part}` : part; state.open.add(next); return next; }, '');
    this.render();
  }

  #goView(view) {
    Object.assign(this.state, { view, q: '', type: 'all', sel: null });
    this.#refs.search.value = '';
    this.render();
  }

  #onTree(event) {
    const toggle = event.target.closest('[data-toggle]');
    if (toggle) {
      const path = toggle.dataset.toggle;
      if (this.state.open.has(path)) this.state.open.delete(path); else this.state.open.add(path);
      this.#renderTree();
      return;
    }
    const row = event.target.closest('.tr-row');
    if (!row) return;
    if (row.dataset.view) this.#goView(row.dataset.view);
    else this.#goFolder(row.dataset.path);
  }

  #onList(event) {
    const sort = event.target.closest('[data-sort]');
    const pin = event.target.closest('[data-pin]');
    const more = event.target.closest('[data-menu]');
    const row = event.target.closest('[data-key]');
    if (sort) this.#setSort(sort.dataset.sort);
    else if (pin) this.#togglePin(pin.dataset.pin);
    else if (more) this.#rowMenu(more.dataset.menu, more);
    else if (row) this.#select(row.dataset.key, false);
  }

  #setSort(key) {
    const sort = this.#sort();
    if (sort.key === key) sort.dir = -sort.dir;
    else { sort.key = key; sort.dir = key === 'mod' ? -1 : 1; }
    this.#renderList();
  }

  // Choisir une ligne sans redessiner la liste : un double-clic a besoin de ses deux clics sur la même ligne.
  #select(key, focus) {
    this.state.sel = key;
    for (const row of this.#refs.list.querySelectorAll('[data-key]')) {
      const on = row.dataset.key === key;
      row.setAttribute('aria-selected', String(on));
      row.tabIndex = on ? 0 : -1;
      if (on && focus) { row.focus({ preventScroll: true }); row.scrollIntoView({ block: 'nearest' }); }
    }
    this.#renderInfo();
  }

  #onListKey(event) {
    const rows = [...this.#refs.list.querySelectorAll('[data-key]')];
    if (!rows.length || event.target.closest('button')) return;
    const at = rows.findIndex(row => row.dataset.key === this.state.sel);
    const go = index => { event.preventDefault(); this.#select(rows[Math.min(Math.max(index, 0), rows.length - 1)].dataset.key, true); };
    const tiles = this.state.display === 'tiles';
    const forward = tiles ? 'ArrowRight' : 'ArrowDown';
    const back = tiles ? 'ArrowLeft' : 'ArrowUp';
    if (event.key === forward) go(at + 1);
    else if (event.key === back) go(at < 0 ? 0 : at - 1);
    else if (event.key === 'Home') go(0);
    else if (event.key === 'End') go(rows.length - 1);
    else if (event.key === 'Enter' && at >= 0) { event.preventDefault(); this.#activate(rows[at].dataset.key); }
  }

  #onKey(event) {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    if (event.target === this.#refs.search && this.#refs.search.value) {
      this.#refs.search.value = '';
      this.state.q = '';
      this.#renderCrumbs();
      this.#renderList();
    } else {
      this.#requestClose();
    }
    event.preventDefault();
  }

  #requestClose() {
    if (this.#opts.canClose()) this.#opts.onClose();
    else this.#opts.notice(this.#opts.i18n.t('ex.closeNone'));
  }

  #openSelected() { if (this.state.sel) this.#activate(this.state.sel); }

  #activate(key) {
    if (key.startsWith('dir:')) { this.#goFolder(key.slice(4)); return; }
    const file = this.#files.find(item => item.key === key);
    if (file) this.#opts.onOpen(file);
  }

  #togglePin(key) {
    const file = this.#files.find(item => item.key === key);
    if (file) void this.#opts.filing.togglePin(file);
  }

  // ---------- menus ----------

  #typeMenu() {
    const { t } = this.#opts.i18n;
    const items = [{ label: t('ex.allTypes'), icon: 'list', check: this.state.type === 'all', run: () => this.#setType('all') }, '-',
      ...this.#types().map(item => ({
        label: `${item.label} (${item.count})`, icon: item.icon, family: item.known ? item.family : null, check: this.state.type === item.value, run: () => this.#setType(item.value),
      }))];
    openMenu(this.#refs.typeBtn, items, { host: this.root, label: t('ex.typeFilter') });
  }

  #setType(value) { this.state.type = value; this.state.sel = null; this.render(); }

  // Le menu de langue : « comme Grist », le français, l'anglais. Le choix est rendu au contrôleur, qui le retient et le fait suivre aux apps.
  #languageMenu() {
    const { t } = this.#opts.i18n;
    const { choice, grist } = this.#opts.language();
    const item = (value, label) => ({ label, check: choice === value, run: () => this.#opts.onLanguage(value) });
    const items = [item('auto', t('lang.auto', { name: LANGUAGE_NAMES[grist] })), '-', item('fr', LANGUAGE_NAMES.fr), item('en', LANGUAGE_NAMES.en)];
    openMenu(this.#refs.langBtn, items, { host: this.root, align: 'right', label: t('lang.menu') });
  }

  // Le menu « Nouveau » : un article par type de fichier à créer, et « Importer » (un sous-menu : un article par format qu'une app reçoit d'un autre logiciel, contrats 2.7, point 4).
  #newMenu() {
    const { t } = this.#opts.i18n;
    const article = (entry, run) => ({ label: entry.label, icon: entry.icon, family: entry.family, greyed: entry.greyed, hint: entry.hint, run });
    const items = this.#opts.newTypes().map(entry => article(entry, () => this.#opts.onNew(entry)));
    // Un format grisé garde sa mention courte, coupée si le panneau est étroit : l'infobulle dit la raison en entier (le clic aussi).
    const imports = this.#opts.importTypes().map(entry => ({ ...article(entry, () => this.#opts.onImport(entry)), title: entry.greyed ? entry.reason : null }));
    if (imports.length) items.push('-', { label: t('ex.import'), icon: 'import', submenu: imports });
    openMenu(this.#refs.newBtn, items, { host: this.root, align: 'right', label: t('ex.new') });
  }

  // Le menu d'une ligne. Dupliquer et supprimer touchent au fichier lui-même : grisés, ils disent que l'app le fait.
  #rowMenu(key, anchor) {
    const { t } = this.#opts.i18n;
    const { filing } = this.#opts;
    this.#select(key, false);
    const item = (label, glyph, run) => ({ label, icon: glyph, run });
    let items;
    if (key.startsWith('dir:')) {
      const path = key.slice(4);
      items = [item(t('ex.openFolder'), 'open', () => this.#activate(key)), item(t('ex.rename'), 'edit', () => void filing.renameFolder(path)),
        item(t('ex.move'), 'move', () => void filing.moveFolder(path))];
    } else {
      const file = this.#files.find(entry => entry.key === key);
      if (!file) return;
      const appOnly = () => this.#opts.notice(t('ex.notice.appOnly', { app: this.#opts.appName(file.app) }));
      const grey = (label, glyph) => ({ label, icon: glyph, greyed: true, run: appOnly });
      items = [item(t('ex.open'), 'open', () => this.#activate(key)), item(file.pinned ? t('ex.unpin') : t('ex.pin'), 'pin', () => void filing.togglePin(file)),
        item(t('ex.rename'), 'edit', () => void filing.rename(file)), grey(t('ex.duplicate'), 'copy'), item(t('ex.move'), 'move', () => void filing.moveFile(file)),
        '-', grey(t('ex.delete'), 'trash')];
    }
    openMenu(anchor, items, { host: this.root, align: 'right', label: t('ex.more') });
  }
}
