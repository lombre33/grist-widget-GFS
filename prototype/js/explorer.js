// L'explorateur de fichiers (cahier 4.4, 6.3) : le cadre qu'ouvre GFS pour choisir un fichier de n'importe quelle app. Il n'écrit rien lui-même.
// Il remplace le cadre (défaut 6.7, point 1) ; « Fermer » ou Échap ramène à l'app, restée vivante et cachée. Il ne connaît pas les apps :
// le contrôleur lui donne les fichiers, les noms, le grisé et ce qu'on peut créer, et reçoit « ouvrir », « nouveau » et « fermer ». Épingler, renommer
// et déplacer passent à `filing` (js/filing.js) ; supprimer, restaurer et vider la corbeille à `trash` (js/trash.js) ; dupliquer à `copying` (js/copying.js), grisé pour un fichier qu'aucun gardien ne copie.
// Les touches sont décrites dans js/explorer-keys.js, le presse-papiers (Ctrl+C, Ctrl+X, Ctrl+V) dans js/explorer-clipboard.js.

import { h } from './dom.js';
import { icon } from './icons.js';
import { listItems, treeRows, typeChoices } from './explorer-model.js';
import { shownReceived, pendingOf, NO_RECEIVED } from './received-files.js';
import { NO_OPENED } from './opened-files.js';
import { words } from './search.js';
import { buildShell, relabel, paintBell, rightsChip, crumbs, tree, listHead, fileRow, folderRow, tile, emptyMessage, infoBar, trashBar, totalBar, pjBox } from './explorer-view.js';
import { sumWeights } from './weight.js';
import { PiecesBox } from './explorer-pj.js';
import { Removal } from './explorer-removal.js';
import { listAction, moveTarget, isSearchKey, clipboardAction, parentPath } from './explorer-keys.js';
import { UndoStack } from './undo-stack.js';
import { undoable } from './explorer-undo.js';
import { Clipboard } from './explorer-clipboard.js';
import { Dragging } from './explorer-drag.js';
import { RowWindow, WINDOW_FROM } from './explorer-window.js';
import { rowItems } from './explorer-menus.js';
import { notificationItems } from './notifications.js';
import { openMenu, closeMenu, menuIsOpen } from './menu.js';

// Sans fichiers que GFS garde lui-même (les essais de l'explorateur seul) : aucun fichier n'est de ceux-là.
const NO_KEPT = Object.freeze({ has: () => false, extras: () => [] });
// Sans corbeille (les essais de l'explorateur seul) : aucun fichier ne peut y aller.
const NO_TRASH = Object.freeze({ handles: () => false });
// Sans copie (les essais de l'explorateur seul) : aucun fichier ne peut se copier.
const NO_COPYING = Object.freeze({ handles: () => false, copy: async () => null });
// Ce que la case « + pièces jointes » ajoute tant que rien n'est lu.
// Les gestes d'une ligne qu'un clavier posé sur ☆ ou ⋯ (ou ailleurs dans la ligne) fait aussi ; les flèches et Entrée restent aux boutons.
const FROM_BUTTONS = new Set(['rename', 'delete', 'menu', 'parent']);

export class Explorer {
  #opts;
  #kept;
  #bin;
  #copying;
  #clipboard;
  #undo;
  #drag;
  #win; // la liste fenêtrée quand elle est longue (js/explorer-window.js)
  #refs;
  #files = [];
  #trashed = []; // les fichiers à la corbeille (la vue « Corbeille »)
  #arrivals = []; // les fichiers reçus d'un autre document, refusés exceptés (la vue « Partagés avec moi », js/received-files.js)
  #folders = []; // les dossiers que la personne garde sans fichier (js/explorer-data.js)
  #rows = [];
  #keys = []; // la clé de chaque ligne de la liste, dans l'ordre : le clavier et la sélection lisent ceci, non le DOM (une liste longue n'en construit qu'une part)
  #total = 0; // ce que pèse ce que la liste couvre, en octets (le total du pied de fenêtre)
  // La case « + pièces jointes » (js/explorer-pj.js) : son état et ses lectures.
  #pieces = new PiecesBox({
    t: (key, vars) => this.#opts.i18n.t(key, vars), hasSource: () => Boolean(this.#opts.attachments), load: () => this.#opts.attachments(), restricted: () => this.#restricted,
    files: () => this.#files, trashed: () => this.#trashed, changed: () => this.#renderTotal(),
  });
  // Les gestes qui font partir une ligne : corbeille, dossier supprimé, restauration (js/explorer-removal.js).
  #removal = new Removal({
    opts: () => this.#opts, view: () => this.state.view, choice: () => this.#choice, files: () => this.#files, trashed: () => this.#trashed, bin: () => this.#bin, keys: () => this.#keys, isOpen: () => this.isOpen,
    select: (key, focus) => this.#select(key, focus),
  });
  #loading = false;
  #problems = [];
  #restricted = false;
  #choice = null; // le mode choix (enterChoice) : { title, accept(file), onPick(file), onCancel() }, ou null
  #beforeChoice = null; // où la personne en était avant le mode choix
  // Trois tris : celui des dossiers et des favoris (par nom), ceux de Récents et de la corbeille (par date, la plus récente d'abord : le fichier qu'on vient de supprimer est en haut).
  state = {
    view: 'folder', path: '', open: new Set(), display: 'list', sort: { key: 'name', dir: 1 }, recentSort: { key: 'mod', dir: -1 }, trashSort: { key: 'mod', dir: -1 }, sharedSort: { key: 'mod', dir: -1 }, type: 'all', q: '', sel: null,
  };

  // opts : { container, i18n, locale, now(), appName(id), typeLabel(file), lockOf(file), newTypes(), importTypes(), onOpen(file), onNew(entry), onImport(entry), onClose(), onApps(), canClose(), notice(text),
  //          settings() → les articles du menu « Réglages » (js/settings-menu.js : langue, thème, position de la barre, « À propos »), onRights() (le mot du pied ouvre le panneau des permissions), onWeight({ list, pj }) (le total du pied ouvre la fenêtre « Poids du document » : la liste en octets et, case cochée et lue, les pièces jointes), personal() → le rangement est-il à la personne seule ?,
  //          filing: { togglePin(file), rename(file), moveFile(file), renameFolder(path), moveFolder(path), moveFileTo(file, dossier), moveFolderTo(path, dossier) },
  //          kept?: les fichiers que GFS garde lui-même (js/kept-files.js) : { has(file), openAs(file) -> { label, icon, greyed }, opensIn(file), extras(file) -> [article de menu] },
  //          trash?: la corbeille (js/trash.js) : { handles(file), appLockOf?(file) -> { text } | null (l'app doit être ouverte), move(file), restore(file), purge(file), empty(files) } (chaque geste rend une promesse, vraie quand il a abouti),
  //          copying?: la copie (js/copying.js) : { handles(file), appLockOf?(file) -> { text } | null, copy(file, dossier) -> Promise<{ key, name } | null> } },
  //          attachments?() -> Promise<{ data } | { error }> : la table des pièces jointes de Grist (js/explorer-data.js, `loadAttachments`), lue quand la case « + pièces jointes » est cochée ; sans elle, la case est grisée }
  constructor(opts) {
    this.#opts = opts;
    this.#kept = opts.kept || NO_KEPT;
    // Ctrl+Z (js/undo-stack.js) : la pile du rangement (js/filing.js), ou la sienne ; la corbeille et la copie y déposent de quoi se défaire (js/explorer-undo.js).
    this.#undo = (opts.filing && opts.filing.undoStack) || new UndoStack({ t: opts.i18n.t, notice: text => opts.notice(text) });
    const guarded = undoable({
      stack: this.#undo, bin: opts.trash || NO_TRASH, copying: opts.copying || NO_COPYING, trashed: () => this.#trashed, live: () => this.#files, t: opts.i18n.t, appName: id => opts.appName(id), reveal: key => this.#reveal(key),
    });
    this.#bin = opts.trash ? guarded.bin : NO_TRASH;
    this.#copying = opts.copying ? guarded.copying : NO_COPYING;
    this.#clipboard = new Clipboard({
      t: opts.i18n.t, notice: text => opts.notice(text), appName: id => opts.appName(id), file: key => this.#files.find(item => item.key === key), where: () => ({ view: this.state.view, path: this.state.path }),
      reveal: key => this.#reveal(key), copying: this.#copying, filing: opts.filing,
    });
    const { root, refs } = buildShell(opts.i18n);
    this.root = root;
    this.#refs = refs;
    opts.container.append(root);
    // Le glisser-déposer (js/explorer-drag.js) : une ligne se dépose sur un dossier du volet, du fil d'Ariane ou de la liste ; hors corbeille et hors choix.
    this.#drag = new Dragging({ root, may: () => !this.#choice && !['trash', 'shared'].includes(this.state.view), file: key => this.#files.find(item => item.key === key), moveTo: (key, path) => this.#clipboard.moveTo(key, path), expand: path => { this.state.open.add(path); this.#renderTree(); } });
    this.#win = new RowWindow({ scroll: refs.scroll, list: refs.list, held: () => this.#drag.holding, onPaint: () => { this.#roving(); this.#drag.mark(refs.list); } });
    this.#bind();
    this.render();
  }

  get isOpen() { return !this.root.hidden; }

  get files() { return this.#files; }

  get folders() { return this.#folders; }

  // Les fichiers que la liste peut montrer : tous, ou, en mode choix, ceux que la demande de l'app laisse passer.
  get #pool() { return this.#choice ? this.#files.filter(this.#choice.accept) : this.#files; }

  // Les dossiers sans fichier que la liste montre : tous, sauf en mode choix (il n'y a rien à y choisir).
  get #spare() { return this.#choice ? [] : this.#folders; }

  // « Partagés avec moi » : ce que la vue demande pour les arrivées d'un autre document (js/received-control.js), ou rien pour les essais de l'explorateur seul.
  get #shared() { return this.#opts.received || NO_RECEIVED; }

  // « Ouverts » : ce que la vue demande (js/opened-files.js : `keys()`, `shown()` le fichier que l'app affiche, `remove(key)`), ou rien pour les essais de l'explorateur seul ; les fichiers vivants qui y sont, à jour.
  get #openedSource() { return this.#opts.opened || NO_OPENED; }

  get #opened() { const keys = new Set(this.#openedSource.keys()); return this.#pool.filter(file => keys.has(file.key)); }

  // Ce que la vue montre : les fichiers de la corbeille dans la corbeille, les arrivées d'un autre document dans « Partagés avec moi », les fichiers ouverts dans « Ouverts », sinon les fichiers vivants.
  get #shown() {
    const { view } = this.state;
    return view === 'trash' ? this.#trashed : view === 'shared' ? this.#arrivals : view === 'opened' ? this.#opened : this.#pool;
  }

  // `files` : les fichiers vivants ; `trashed` : ceux qui sont à la corbeille ; `folders` : les dossiers gardés sans fichier ; `received` : les arrivées d'un autre document, tous états (js/explorer-data.js).
  setFiles(files, trashed = [], folders = [], received = []) {
    this.#files = files;
    this.#trashed = trashed;
    this.#folders = folders;
    this.#arrivals = shownReceived(received);
    const keys = new Set([...files, ...trashed, ...this.#arrivals].map(file => file.key));
    if (this.state.sel && !this.state.sel.startsWith('dir:') && !keys.has(this.state.sel)) this.state.sel = null;
    this.#pieces.filesChanged();
    if (this.isOpen) this.render();
    this.#pieces.reread();
  }

  // Les arrivées d'un autre document ont changé pendant que l'explorateur est ouvert (js/sync-service.js, `whenReceived`) : seule leur liste se remplace, le reste ne bouge pas.
  setReceived(received) { this.setFiles(this.#files, this.#trashed, this.#folders, received); }

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
    this.#clipboard.clear();
    this.#drag.reset();
    this.root.hidden = true;
  }

  // Le mode choix (contrats 5.4, point 2) : une app a demandé à la personne de désigner un fichier. L'explorateur ne montre que ceux que `accept` laisse passer, « Ouvrir » devient « Choisir », « Fermer »
  // « Annuler » et « Nouveau » est grisé ; `onPick(file)` reçoit le fichier désigné (double-clic, Entrée, « Choisir »), `onCancel()` l'abandon (Annuler, Échap). `exitChoice` rend l'explorateur
  // comme la personne l'avait laissé.
  enterChoice(choice) {
    if (!this.#choice) this.#beforeChoice = this.#place();
    this.#choice = choice;
    Object.assign(this.state, { view: 'folder', path: '', q: '', type: 'all', sel: null });
    this.#refs.search.value = '';
    this.root.classList.add('ex--choose');
    this.#labelChoice();
    if (this.isOpen) this.render();
  }

  exitChoice() {
    if (!this.#choice) return;
    this.#choice = null;
    Object.assign(this.state, this.#beforeChoice);
    this.#refs.search.value = this.state.q;
    this.root.classList.remove('ex--choose');
    const { openBtn, newBtn } = this.#refs;
    openBtn.classList.remove('primary');
    newBtn.removeAttribute('aria-disabled');
    newBtn.removeAttribute('title');
    relabel(this.#refs, this.#opts.i18n);
    if (this.isOpen) this.render();
  }

  #place() {
    const { view, path, q, type, sel } = this.state;
    return { view, path, q, type, sel };
  }

  #labelChoice() {
    const { t } = this.#opts.i18n;
    const { title, openBtn, closeBtn, newBtn } = this.#refs;
    title.replaceChildren(icon('link'), this.#choice.title || t('ex.choose.title'));
    openBtn.textContent = t('ex.choose.pick');
    openBtn.classList.add('primary');
    closeBtn.textContent = t('ex.choose.cancel');
    newBtn.setAttribute('aria-disabled', 'true');
    newBtn.title = t('ex.choose.newOff');
  }

  // Le mot du pied (contrats 11.4, point 7) d'après ce que le lecteur des droits a lu (`RightsReader.rules()`), ou null avant la lecture.
  setRights(rules) {
    this.#refs.rights = rules;
    rightsChip(this.#refs, this.#opts.i18n, rules);
  }

  // La langue de GFS a changé : les textes du cadre fixe se réécrivent, et tout le reste se redessine dans la nouvelle langue (dates comprises).
  relocalize({ i18n, locale }) {
    this.#opts = { ...this.#opts, i18n, locale };
    closeMenu();
    relabel(this.#refs, i18n);
    if (this.#choice) this.#labelChoice();
    if (this.isOpen) this.render();
  }

  // ---------- état ----------

  #sort() { return ({ recent: this.state.recentSort, trash: this.state.trashSort, shared: this.state.sharedSort })[this.state.view] || this.state.sort; }

  get #filtering() { return words(this.state.q).length > 0 || this.state.type !== 'all'; }

  #ctx(extra = {}) {
    const { state } = this;
    const sel = state.sel;
    const row = sel ? this.#rows.find(r => (r.kind === 'folder' ? `dir:${r.path}` : r.file.key) === sel) : null;
    return {
      t: this.#opts.i18n.t, state, locale: this.#opts.locale, now: this.#opts.now(), appName: this.#opts.appName, typeLabel: this.#opts.typeLabel,
      lockOf: this.#opts.lockOf, opensIn: file => this.#opensIn(file), sort: this.#sort(), filtering: this.#filtering, favCount: this.#pool.filter(file => file.pinned).length, totalFiles: this.#pool.length,
      openedCount: this.#opened.length, shownKey: this.#openedSource.shown(), trashCount: this.#trashed.length, sharedPending: pendingOf(this.#arrivals).length, selected: row, personal: this.#opts.personal(), choosing: this.#choice !== null, total: this.#total, pj: this.#pieces.facts(), ...extra,
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
    closeBtn.setAttribute('aria-disabled', String(!this.#choice && !this.#opts.canClose()));
    paintBell(this.#refs, t, pendingOf(this.#arrivals).length, this.#choice !== null);
  }

  #renderCrumbs() { this.#refs.crumbs.replaceChildren(...crumbs(this.#ctx())); }

  #renderTree() {
    const top = this.#refs.tree.scrollTop;
    this.#refs.tree.replaceChildren(...tree(this.#ctx({ treeRows: treeRows(this.#pool, this.state.open, this.#opts.locale, this.#spare) })));
    this.#refs.tree.scrollTop = top;
  }

  #renderList() {
    const { list, scroll, empty, notices } = this.#refs;
    const top = scroll.scrollTop;
    const focused = this.#focusedKey();
    const result = listItems(this.#shown, { ...this.state, sort: this.#sort() }, { locale: this.#opts.locale, typeLabel: this.#opts.typeLabel, spare: this.#spare });
    this.#rows = result.rows;
    this.#total = sumWeights(result.covered);
    this.#keys = this.#rows.map(r => (r.kind === 'folder' ? `dir:${r.path}` : r.file.key));
    if (this.state.sel && !this.#keys.includes(this.state.sel)) this.state.sel = null;
    const ctx = this.#ctx();
    const tiles = this.state.display === 'tiles';
    list.classList.toggle('is-tiles', tiles);
    this.#paintRows(ctx, tiles, result.flat);
    notices.replaceChildren(...this.#problems.map(text => h('div', { class: 'banner', role: 'alert' }, icon('warning'), text)), ...(this.state.view === 'trash' && this.#trashed.length ? [trashBar(ctx)] : []));
    const message = this.#loading ? this.#opts.i18n.t('ex.loading') : (this.#rows.length ? '' : (this.#restricted ? this.#opts.i18n.t('ex.emptyNoAccess') : emptyMessage(ctx)));
    empty.textContent = message;
    empty.hidden = !message;
    scroll.scrollTop = top;
    this.#win.paint();
    this.#roving();
    this.#renderInfo();
    this.#renderTotal();
    if (focused) this.#focusKey(focused);
  }

  // Les lignes (ou les vignettes) de la liste : toutes, ou, quand elles sont nombreuses, seulement celles qu'on voit (js/explorer-window.js).
  #paintRows(ctx, tiles, flat) {
    const { list } = this.#refs;
    const rows = this.#rows;
    const one = row => (tiles ? tile(ctx, row) : (row.kind === 'folder' ? folderRow(ctx, row) : fileRow(ctx, row.file, flat)));
    if (rows.length > WINDOW_FROM) {
      this.#win.mount({ body: tiles ? h('div', { class: 'th-grid is-windowed' }) : h('div', { class: 'ex-rows', role: 'rowgroup' }), count: rows.length, build: index => one(rows[index]), head: tiles ? null : listHead(ctx), rowIndexFrom: tiles ? null : 2 });
      return;
    }
    this.#win.release();
    const cards = rows.map(one);
    list.replaceChildren(...(tiles ? [h('div', { class: 'th-grid' }, ...cards)] : [listHead(ctx), ...cards]));
    this.#drag.mark(list);
  }

  // La ligne `key` en élément, construite et amenée à l'écran quand la liste est fenêtrée ; null si la liste ne l'a pas.
  #rowFor(key) {
    const index = this.#keys.indexOf(key);
    return (index >= 0 && this.#win.reveal(index)) || [...this.#refs.list.querySelectorAll('[data-key]')].find(row => row.dataset.key === key) || null;
  }

  // Redessiner la liste ne doit pas faire perdre la ligne où se trouve le clavier, ni celle dont un bouton l'a (l'étoile, « Plus d'actions »).
  #focusedKey() {
    const active = this.root.ownerDocument.activeElement;
    const row = active && this.#refs.list.contains(active) ? active.closest('[data-key]') : null;
    return row ? row.dataset.key : null;
  }

  #focusKey(key) {
    const row = [...this.#refs.list.querySelectorAll('[data-key]')].find(item => item.dataset.key === key) || this.#refs.list.querySelector('[tabindex="0"]');
    // Une liste sans ligne (un dossier vide) garde le clavier : Retour arrière y ramène au dossier parent.
    (row || this.#refs.list).focus({ preventScroll: true });
  }

  // Où s'ouvre le fichier : dans son app, ou, pour un fichier que GFS garde, sur l'ordinateur de la personne.
  #opensIn(file) {
    return this.#kept.has(file) ? this.#kept.opensIn(file) : this.#opts.i18n.t('ex.opensIn', { app: this.#opts.appName(file.app) });
  }

  #renderInfo() {
    const ctx = this.#ctx();
    this.#refs.info.replaceChildren(infoBar(ctx));
    const open = this.#openAs(ctx.selected && ctx.selected.file);
    // Grisé mais cliquable : sans fichier choisi le clic ne fait rien, devant un PDF dont l'app n'est pas prête il dit ce qui la débloque.
    this.#refs.openBtn.setAttribute('aria-disabled', String(!ctx.selected || open.greyed));
    // « Ouvrir » devient « Lire » ou « Télécharger » devant un fichier que GFS garde ; en mode choix, le bouton garde son mot (« Choisir »).
    if (!this.#choice) this.#refs.openBtn.textContent = open.label;
  }

  // Le geste principal d'un fichier : « Ouvrir », ou celui d'un fichier que GFS garde (js/kept-files.js) ; à la corbeille : « Restaurer ».
  #openAs(file) {
    if (this.state.view === 'trash') return { label: this.#opts.i18n.t('trash.restore'), icon: 'restore', greyed: false };
    const answer = this.state.view === 'shared' && file && this.#shared.openAs(file);
    if (answer) return answer;
    if (!this.#choice && file && this.#kept.has(file)) return this.#kept.openAs(file);
    return { label: this.#opts.i18n.t('ex.open'), icon: 'open', greyed: false };
  }

  // Une seule ligne dans l'ordre de tabulation : la ligne choisie, sinon la première.
  #roving() {
    const rows = [...this.#refs.list.querySelectorAll('[data-key]')];
    const chosen = rows.find(row => row.dataset.key === this.state.sel) || rows[0];
    for (const row of rows) row.tabIndex = row === chosen ? 0 : -1;
  }

  #types() { return typeChoices(this.#shown, this.#opts.typeLabel); }

  // ---------- la case « + pièces jointes » ----------

  // Un clic sur le total : la fenêtre « Poids du document » (js/weight-window.js), avec ce que le total montre à cet instant.
  #openWeight() {
    const pj = this.#pieces.facts();
    if (this.#opts.onWeight) this.#opts.onWeight({ list: this.#total, pj: pj.on && pj.ready ? { bytes: pj.bytes, count: pj.count } : null });
  }

  #renderTotal() {
    const ctx = this.#ctx();
    this.#refs.total.replaceChildren(...totalBar(ctx));
    pjBox(this.#refs, ctx);
  }

  // Un clic sur la case : grisée, il dit pourquoi ; sinon il coche ou décoche.
  #onPj(event) {
    const grey = this.#pieces.toggle(this.#refs.pjInput.checked);
    if (grey) { event.preventDefault(); this.#opts.notice(grey); }
  }

  // ---------- gestes ----------

  #bind() {
    const { search, viewList, viewTiles, typeBtn, newBtn, openBtn, closeBtn, appsBtn, settingsBtn, rightsBtn, pjInput, crumbs: crumbsNav, tree: treeNav, list, notices } = this.#refs;
    search.addEventListener('input', () => { this.state.q = search.value; this.state.sel = null; this.#renderCrumbs(); this.#renderList(); });
    appsBtn.addEventListener('click', () => this.#opts.onApps());
    settingsBtn.addEventListener('click', () => this.#settingsMenu());
    this.#refs.bellBtn.addEventListener('click', () => this.#bellMenu());
    rightsBtn.addEventListener('click', () => this.#opts.onRights());
    this.#refs.total.addEventListener('click', () => this.#openWeight());
    pjInput.addEventListener('click', event => this.#onPj(event));
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
    list.addEventListener('contextmenu', event => this.#onContext(event));
    this.root.addEventListener('dragend', () => this.#win.settle());
    notices.addEventListener('click', event => { if (event.target.closest('[data-empty-trash]')) void this.#removal.emptyTrash(); });
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
    if (['trash', 'shared'].includes(view) && this.#choice) { this.#opts.notice(this.#opts.i18n.t('ex.choose.newOff')); return; }
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
    const restore = event.target.closest('[data-restore]');
    const more = event.target.closest('[data-menu]');
    const row = event.target.closest('[data-key]');
    if (sort) this.#setSort(sort.dataset.sort);
    else if (pin) this.#togglePin(pin.dataset.pin);
    else if (restore) void this.#removal.restore(restore.dataset.restore);
    else if (more) this.#rowMenu(more.dataset.menu, more);
    else if (row) this.#select(row.dataset.key, false);
  }

  #setSort(key) {
    const sort = this.#sort();
    if (sort.key === key) sort.dir = -sort.dir;
    else { sort.key = key; sort.dir = key === 'mod' || key === 'poids' ? -1 : 1; } // la date et le poids : le plus récent, le plus lourd d'abord
    this.#renderList();
  }

  // Choisir une ligne sans redessiner la liste : un double-clic a besoin de ses deux clics sur la même ligne.
  #select(key, focus) {
    this.state.sel = key;
    const target = focus ? this.#rowFor(key) : null;
    for (const row of this.#refs.list.querySelectorAll('[data-key]')) {
      const on = row.dataset.key === key;
      row.setAttribute('aria-selected', String(on));
      row.tabIndex = on ? 0 : -1;
    }
    if (target) { target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'nearest' }); }
    this.#renderInfo();
  }

  // Les touches de la liste (js/explorer-keys.js). La ligne visée par un geste est la ligne choisie, sinon celle où est le clavier : à l'ouverture, le clavier est sur la première ligne sans qu'aucune
  // soit choisie, et Entrée, F2 ou Suppr doivent y répondre.
  #onListKey(event) {
    const action = listAction(event, { display: this.state.display, filtering: this.#filtering });
    if (!action || (event.target.closest('button') && !FROM_BUTTONS.has(action))) return;
    const keys = this.#keys;
    if (!keys.length) { if (action === 'parent') this.#goParent(event); return; }
    const at = keys.indexOf(this.state.sel);
    const to = moveTarget(action, at, keys.length, () => this.#columns());
    if (to !== null) this.#moveSelection(event, to);
    else if (action === 'parent') this.#goParent(event);
    else this.#keyOnRow(event, action, at >= 0 ? this.#rowFor(keys[at]) : event.target.closest('[data-key]'));
  }

  // Le choix va à la ligne d'index `to` (tenu dans la liste).
  #moveSelection(event, to) {
    event.preventDefault();
    this.#select(this.#keys[Math.min(Math.max(to, 0), this.#keys.length - 1)], true);
  }

  // Un geste sur la ligne choisie, ou sur celle où est le focus (`here`) ; rien quand il n'y en a pas.
  #keyOnRow(event, action, here) {
    if (!here) return;
    event.preventDefault();
    const key = here.dataset.key;
    if (action === 'activate') this.#activate(key);
    else if (action === 'rename') this.#renameKey(key);
    else if (action === 'delete') { this.#select(key, false); void this.#removal.trash(key); }
    else if (action === 'menu') this.#rowMenu(key, here.querySelector('[data-menu]') || here);
  }

  // Le nombre de vignettes par rangée : celles qui sont à la hauteur de la première.
  #columns() {
    const rows = [...this.#refs.list.querySelectorAll('[data-key]')];
    return rows.filter(row => row.offsetTop === rows[0].offsetTop).length;
  }

  // Retour arrière : le dossier parent ; depuis Récents, Favoris ou la corbeille, la racine ; à la racine, rien.
  #goParent(event) {
    const { view, path } = this.state;
    if (view === 'folder' && path === '') return;
    event.preventDefault();
    this.#goFolder(view === 'folder' ? parentPath(path) : '');
  }

  // Le clic droit : le menu de la ligne, comme « ⋯ » (le clavier le demande par Maj+F10 ou la touche Menu, dans #onListKey).
  #onContext(event) {
    const row = event.target.closest('[data-key]');
    if (!row) return;
    event.preventDefault();
    this.#rowMenu(row.dataset.key, row.querySelector('[data-menu]') || row);
  }

  #onKey(event) {
    if (event.defaultPrevented) return;
    if (isSearchKey(event) && this.root.contains(event.target) && !menuIsOpen()) {
      event.preventDefault();
      this.#refs.search.focus();
      this.#refs.search.select();
      return;
    }
    const clip = clipboardAction(event);
    if (clip && this.#keysAreOurs(event.target) && !menuIsOpen() && !(['copy', 'cut'].includes(clip) && this.#hasTextSelected())) { event.preventDefault(); this.#onClipboard(clip, event); return; }
    if (event.key !== 'Escape') return;
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

  // Les touches du presse-papiers sont à l'explorateur quand le clavier est chez lui, ou nulle part (le corps de la page : la liste vient d'être redessinée, la ligne qui l'avait n'existe plus) ; pas
  // quand une fenêtre, un menu ou un autre panneau l'a.
  #keysAreOurs(target) {
    const doc = this.root.ownerDocument;
    return this.root.contains(target) || target === doc.body || target === doc.documentElement;
  }

  // Du texte est choisi dans la page (la personne en a surligné) : Ctrl+C et Ctrl+X le copient, comme partout.
  #hasTextSelected() {
    const selection = this.root.ownerDocument.getSelection();
    return Boolean(selection && !selection.isCollapsed && String(selection).trim());
  }

  // Le presse-papiers (js/explorer-clipboard.js), l'annulation (Ctrl+Z : le dernier geste revient) et le rétablissement (Ctrl+Y ou Ctrl+Maj+Z : on le refait ; js/undo-stack.js). Copier et couper visent la ligne choisie, sinon celle où est le clavier ; coller n'a besoin d'aucune ligne (un dossier vide se colle). Pendant un choix de
  // fichier pour une app, rien de tout cela : comme « Nouveau » et la corbeille, il est grisé.
  #onClipboard(action, event) {
    if (this.#choice) { this.#opts.notice(this.#opts.i18n.t('ex.choose.newOff')); return; }
    if (action === 'undo' || action === 'redo') { void this.#undo[action](); return; }
    if (action === 'paste') { void this.#clipboard.paste(); return; }
    const key = this.#keyOf(event);
    if (key) this.#clipboard.take(key, action);
  }

  // La clé de la ligne que vise un geste : la ligne choisie, sinon celle où est le clavier (à l'ouverture, le clavier est sur la première ligne sans qu'aucune soit choisie).
  #keyOf(event) {
    if (this.state.sel && this.#keys.includes(this.state.sel)) return this.state.sel;
    const here = event.target && typeof event.target.closest === 'function' ? event.target.closest('[data-key]') : null;
    return here ? here.dataset.key : null;
  }

  // La ligne `key` prend le clavier, quand la liste la montre (le fichier qu'on vient de copier ou de déplacer).
  #reveal(key) {
    if (this.isOpen && this.#keys.includes(key)) this.#select(key, true);
  }

  // « Dupliquer » : une copie du fichier, rangée dans le même dossier que lui ; elle prend le clavier.
  async #duplicate(file) {
    const done = await this.#copying.copy(file, file.folder);
    if (done) this.#reveal(done.key);
  }

  #requestClose() {
    if (this.#choice) this.#choice.onCancel();
    else if (this.#opts.canClose()) this.#opts.onClose();
    else this.#opts.notice(this.#opts.i18n.t('ex.closeNone'));
  }

  #openSelected() { if (this.state.sel) this.#activate(this.state.sel); }

  // Un fichier s'ouvre dans son app, ou, en mode choix, est désigné à l'app qui le demandait.
  #activate(key) {
    if (key.startsWith('dir:')) { this.#goFolder(key.slice(4)); return; }
    if (this.state.view === 'trash') { void this.#removal.restore(key); return; }
    if (this.state.view === 'shared') { const arrival = this.#arrivals.find(item => item.key === key); if (arrival) this.#shared.activate(arrival); return; }
    const file = this.#files.find(item => item.key === key);
    if (!file) return;
    if (this.#choice) this.#choice.onPick(file); else this.#opts.onOpen(file);
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

  // La cloche : les arrivées qui attendent une réponse (js/notifications.js) ; pendant un choix, elle est grisée et le clic le dit.
  #bellMenu() {
    const { t } = this.#opts.i18n;
    if (this.#choice) { this.#opts.notice(t('ex.choose.newOff')); return; }
    const x = { t, pending: pendingOf(this.#arrivals), notice: this.#opts.notice, ask: file => this.#shared.activate(file), openShared: () => this.#goView('shared') };
    openMenu(this.#refs.bellBtn, notificationItems(x), { host: this.root, align: 'right', label: t('nt.menu') });
  }

  // Le menu « Réglages » : ses articles sont ceux du contrôleur (js/settings-menu.js : la langue, le thème, la position de la barre, « À propos »). Le choix d'une langue est rendu au contrôleur, qui le
  // retient et le fait suivre aux apps.
  #settingsMenu() {
    const { t } = this.#opts.i18n;
    openMenu(this.#refs.settingsBtn, this.#opts.settings(), { host: this.root, align: 'right', label: t('set.menu') });
  }

  // Le menu « Nouveau » : « Nouveau dossier » d'abord, puis un article par type de fichier à créer, et « Importer » (un sous-menu : un article par format qu'une app reçoit d'un autre logiciel, contrats 2.7, point 4).
  #newMenu() {
    const { t } = this.#opts.i18n;
    if (this.#choice) { this.#opts.notice(t('ex.choose.newOff')); return; }
    const article = (entry, run) => ({ label: entry.label, icon: entry.icon, family: entry.family, greyed: entry.greyed, hint: entry.hint, run });
    const types = this.#opts.newTypes().map(entry => article(entry, () => this.#opts.onNew(entry)));
    const items = [{ label: t('ex.newFolder'), icon: 'folder-plus', run: () => void this.#newFolder() }, ...(types.length ? ['-', ...types] : [])];
    // Un format grisé garde sa mention courte, coupée si le panneau est étroit : l'infobulle dit la raison en entier (le clic aussi).
    const imports = this.#opts.importTypes().map(entry => ({ ...article(entry, () => this.#opts.onImport(entry)), title: entry.greyed ? entry.reason : null }));
    if (imports.length) items.push('-', { label: t('ex.import'), icon: 'import', submenu: imports });
    openMenu(this.#refs.newBtn, items, { host: this.root, align: 'right', label: t('ex.new') });
  }

  // Le menu d'une ligne (js/explorer-menus.js). Dupliquer copie le fichier quand un gardien sait le copier (js/copying.js) ; sinon il est grisé et dit où le faire. Supprimer passe par la corbeille : un fichier qu'aucun gardien
  // ne connaît (js/trash.js) grise l'article et dit pourquoi ; un dossier se supprime quand plus aucun fichier n'est dedans, sinon son article est grisé et le dit. À la corbeille : « Restaurer » et « Supprimer définitivement… ».
  #rowMenu(key, anchor) {
    this.#select(key, false);
    const items = rowItems({
      t: this.#opts.i18n.t, opts: this.#opts, view: this.state.view, choice: Boolean(this.#choice), rows: this.#rows, shown: this.#shown, kept: this.#kept, bin: this.#bin, copying: this.#copying, shared: this.#shared,
      openAs: file => this.#openAs(file),
      act: { activate: at => this.#activate(at), deleteFolder: at => this.#removal.deleteFolder(at), restore: at => this.#removal.restore(at), purge: at => this.#removal.purge(at), trashKey: at => this.#removal.trash(at), duplicate: file => this.#duplicate(file), dropOpened: at => this.#dropOpened(at) },
    }, key);
    if (items) openMenu(anchor, items, { host: this.root, align: 'right', label: this.#opts.i18n.t('ex.more') });
  }

  // « Retirer des ouverts » : la ligne sort de la liste, le fichier reste où il est et l'app garde ce qu'elle affiche ; la ligne suivante prend le clavier.
  async #dropOpened(key) {
    await this.#removal.leaving(key, () => { this.#openedSource.remove(key); this.render(); return true; });
  }

  // ---------- dossiers et noms ----------

  // « Nouveau dossier » : dans le dossier ouvert (à la racine quand la vue n'en est pas un). La personne y est conduite et le dossier créé prend le clavier, prêt à être renommé (F2) ou ouvert (Entrée).
  async #newFolder() {
    const path = await this.#opts.filing.newFolder();
    if (!path) return;
    this.#goFolder(parentPath(path));
    this.#reveal(`dir:${path}`);
  }

  // F2 : renommer le dossier ou le fichier. À la corbeille, un fichier se restaure d'abord.
  #renameKey(key) {
    if (this.state.view === 'trash') return;
    const { filing } = this.#opts;
    if (key.startsWith('dir:')) { void filing.renameFolder(key.slice(4)); return; }
    const file = this.#files.find(item => item.key === key);
    if (file) void filing.rename(file);
  }
}
