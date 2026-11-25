// La fenêtre de l'annuaire (module Annuaire, demande du porteur du 25/11) : à gauche la hiérarchie, au milieu les personnes (liste, cartes de contact ou
// organigramme), à droite la fiche. Une fenêtre sur la base commune (js/ui/modal.js, charte) : le titre, la recherche et le pied restent en place, seuls les
// volets défilent ; Échap la ferme, un clic à côté ne ferme rien. Elle ne lit ni n'écrit rien : la lecture et la création sont à
// js/annuaire/annuaire-control.js, qui lui donne ce qu'elle montre (`show`) et reçoit ce que la personne demande (changer d'annuaire, en créer un, le régler).

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { mountWindow, giveBackFocus, tabStops, LIST_SHOWN } from '../ui/modal.js';
import { keyStore } from '../shell/stored-choice.js';
import { findNode, peopleIn, filterPeople, filterOptions, fieldGenres } from './annuaire-model.js';
import { pathIds, levelLabel, listColumns } from './annuaire-items.js';
import { treeList, personRow, personCard, fiche, nodeFiche, columnHead, listedTexts, columnTexts } from './annuaire-panes.js';
import { PEOPLE_MAX, orgSignature, orgData, reducedTree } from './annuaire-org-data.js';
import { relationsOf, relationIndex, cardLines, cardLineCount } from './annuaire-relations.js';
import { OrgView } from './annuaire-org-view.js';
import { copyText } from './annuaire-copy.js';
import { FilterMenu } from './annuaire-filters.js';
import { sortPeople, nextSort, sortKeys, sortButton } from './annuaire-sort.js';
import { subButton, openSubMenu, copyDate } from './annuaire-sub-menu.js';
import { checkButton, mailButton } from './annuaire-tools.js';
import { listKeys, treeKeys } from './annuaire-keys.js';
import { addressesOf } from './annuaire-mail.js';
import { canSwitch, presenceCol } from './annuaire-presence.js';

const FOCUSABLE = 'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), [tabindex="0"], a[href]';
const VIEWS = Object.freeze([['list', 'list', 'an.view.list'], ['cards', 'tiles', 'an.view.cards'], ['org', 'org', 'an.view.org']]);
const PEOPLE_KEY = 'gfs.annuaire.orgPeople'; // le choix « Personnes » de l'organigramme, retenu sur le navigateur (js/shell/stored-choice.js)

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
  #menu; // le bouton « Filtres » et son panneau (js/annuaire/annuaire-filters.js)
  #sort = null; // le tri de la liste et des cartes : { key, dir }, ou rien (l'ordre de l'annuaire : par nom ; js/annuaire/annuaire-sort.js)
  #note = '';
  #store;
  #orgPeople = false; // l'organigramme des structures dessine aussi les personnes (le bouton « Personnes »)

  // opts : { container, t, locale() (la langue des dates), inertTargets(), writeBlock() (ce qui empêche d'écrire : le texte, ou rien), onSwitch(),
  //   onConfigure(),
  //   onNew(), onEdit(ligne) (la fenêtre « Modifier »), onCheck() (« À vérifier »), onMail(personnes) (« Écrire au groupe »), onPresence(ligne, apparaît) (« Ma
  //   présence »), onFilterMore(colonne, option) -> Promise<valeur ou null>, onSortPick(clés, tri), onClose() }
  constructor(opts) {
    this.#o = opts;
    this.#store = keyStore((opts.container && opts.container.ownerDocument && opts.container.ownerDocument.defaultView) || globalThis, PEOPLE_KEY);
    this.#orgPeople = this.#store.read() === '1';
    this.#menu = new FilterMenu({ host: () => this.#root, t: () => this.#o.t, locale: () => this.#o.locale() });
  }

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
    this.#menu.close();
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
    this.#menu.close();
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
    if (this.#view === 'org' && this.#show.state === 'ready' && !this.#orgPossible()) this.#view = 'list'; // le réglage vient d'éteindre la hiérarchie
    this.#paint();
  }

  // L'organigramme a de quoi se dessiner : des niveaux (par structures) ou une colonne de responsable direct (par responsables).
  #orgPossible() {
    const { data } = this.#show;
    return Boolean(data && (data.config.levels.length > 0 || data.config.manager));
  }

  #reset() {
    this.#node = '';
    this.#query = '';
    this.#filters = {};
    this.#sort = null;
    this.#person = null;
    this.#struct = null;
    this.#note = '';
    this.#open = new Set(['']);
    this.#menu.close();
    if (this.#refs) this.#refs.search.value = '';
  }

  // ---------- le cadre ----------

  #build() {
    const t = (key, vars) => this.#o.t(key, vars);
    const refs = {
      title: h('h2', { id: 'an-title' }), name: h('button', { type: 'button', class: 'an-name', 'aria-haspopup': 'dialog',
        dataset: { act: 'switch', fk: 'switch' } }), tag: h('span', { class: 'an-pill an-sub-tag' }),
      search: h('input', { type: 'search', autocomplete: 'off', dataset: { fk: 'search' } }),
      views: h('div', { class: 'an-seg', role: 'group' }), tools: h('span', { class: 'an-top-tools' }), config: h('button', { type: 'button', class: 'an-ib',
        dataset: { act: 'configure', fk: 'configure' } }, icon('sliders')),
      crumb: h('div', { class: 'an-crumb' }), list: h('div', { class: 'an-list' }),
      body: h('div', { class: 'mod-body an-body' }), state: h('div', { class: 'an-state' }), tree: h('nav', { class: 'an-card an-tree' }),
        main: h('div', { class: 'an-card an-main' }), side: h('aside', { class: 'an-card an-side' }),
      note: h('p', { class: 'mod-note an-foot', 'aria-live': 'polite' }), close: h('button',
        { type: 'button', class: 'btn', dataset: { act: 'close', fk: 'close' } }),
    };
    this.#org = new OrgView({ t, onPick: item => this.#orgPick(item), onMode: id => this.#orgMode(id),
      onTool: (act, data) => { const handler = ACTIONS[act]; if (handler) handler(this, data); } });
    refs.main.append(refs.crumb, refs.list, this.#org.element);
    refs.body.append(refs.state, refs.tree, refs.main, refs.side);
    this.#refs = refs;
    const section = h('section', { class: 'mod an', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'an-title' },
      h('header', { class: 'mod-head an-head' }, h('div', { class: 'an-top' }, refs.title, refs.name, refs.tag, h('span', { class: 'an-grow' }),
        h('label', { class: 'inp-search an-search' }, icon('search'), refs.search), refs.tools, refs.views, refs.config)),
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
    const { title, name, tag, search, views, config, close, tools } = this.#refs;
    const { current, data } = this.#show;
    const sub = this.#show.state === 'ready' && data && data.sub ? data.sub : null; // la copie verrouillée d'un sous-annuaire (js/annuaire/annuaire-sub.js)
    tag.hidden = !sub;
    tag.replaceChildren(...(sub ? [icon('lock'), h('span', { class: 'an-tb-t' }, t('an.sub.tag'))] : []));
    tag.title = sub ? t('an.sub.of', { name: sub.parent }) : '';
    title.textContent = t('an.title');
    name.replaceChildren(h('span', { class: 'an-name-t' }, current ? current.name : t('an.none.name')), icon('chev-down'));
    name.title = t('an.switch');
    name.setAttribute('aria-label', t('an.switch'));
    search.placeholder = t('an.search');
    search.setAttribute('aria-label', t('an.searchLabel'));
    views.setAttribute('aria-label', t('an.views'));
    const greyed = id => id === 'org' && this.#show.state === 'ready' && !this.#orgPossible(); // grisé, jamais masqué : un clic dit comment l'allumer
    views.replaceChildren(...VIEWS.map(([id, glyph, key]) => h('button', { type: 'button', class: 'an-seg-b', 'aria-pressed': String(this.#view === id),
      'aria-disabled': greyed(id) ? 'true' : null, title: greyed(id) ? t('an.org.noHierarchy') : t(key), 'aria-label': t(key),
      dataset: { act: 'view', view: id, fk: `v:${id}` } }, icon(glyph), h('span', { class: 'an-seg-t' }, t(key)))));
    tools.replaceChildren(...(this.#show.state === 'ready' && data ? [checkButton(data.checks, t), sub ? subButton(t) : null].filter(Boolean) : []));
    config.title = t('an.configure');
    config.setAttribute('aria-label', t('an.configure'));
    close.textContent = t('an.close');
  }

  // Les personnes que le volet du milieu montre : toute la liste quand on cherche, sinon le nœud choisi et ce qui est dessous ; puis la recherche et les
  // filtres.
  // Les personnes de tout l'annuaire qui passent la recherche et les filtres (l'organigramme, lui, ne se limite pas à un nœud).
  #matching() {
    return filterPeople(this.#show.data.people, { query: this.#query, filters: this.#filters });
  }

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
    refs.tree.hidden = !ready || this.#view === 'org' || data.config.levels.length === 0;
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
    const { tree, config } = this.#show.data;
    const levels = config.levels;
    this.#refs.tree.setAttribute('aria-label', this.#o.t('an.tree.label'));
    this.#refs.tree.replaceChildren(treeList(tree, { t: this.#o.t, selected: this.#node, open: this.#open, levels }));
  }

  #paintMain() {
    const { crumb, list, main } = this.#refs;
    const org = this.#view === 'org';
    crumb.hidden = org;
    list.hidden = org;
    this.#org.element.hidden = !org;
    main.dataset.view = this.#view;
    if (org) { this.#paintOrg(); return; }
    this.#paintList();
  }

  // Les filtres de ce que `base` contient (les mêmes dans la liste, les cartes et l'organigramme : retour du porteur, 25/11) : ce qu'on peut cocher, et combien
  // de cases le sont.
  #filterModel(base) {
    const { current, data } = this.#show;
    const options = filterOptions(base, data.config, data.schema, current.table).filter(option => option.values.length);
    const active = Object.values(this.#filters).reduce((sum, set) => sum + (set ? set.size : 0), 0);
    return { options, active };
  }

  #paintList() {
    const t = this.#o.t;
    const { current, data } = this.#show;
    const { node, base, found } = this.#scope();
    const levels = data.config.levels;
    const searching = this.#query.trim() !== '';
    const level = !searching && node.level >= 0 ? levelLabel(levels[node.level]) : '';
    const model = this.#filterModel(base);
    this.#refs.crumb.replaceChildren(...[h('h3', null, searching ? t('an.results') : node.name), level ? h('span', { class: 'an-pill' }, level) : null,
      h('span', { class: 'an-count' }, t('an.count', { n: found.length })), sortButton(this.#sort, sortKeys(data.config, t), t),
      this.#menu.button(model, this.#filters), mailButton(this.#mailState(found), t)].filter(Boolean));
    const ctx = { t, locale: this.#o.locale() };
    const rows = sortPeople(found, this.#sort, this.#o.locale()).slice(0, LIST_SHOWN);
    const cards = this.#view === 'cards';
    const columns = cards ? [] : listColumns(data.config, t);
    const genres = fieldGenres(data.config, current.table, data.schema);
    const extraOf = listedTexts(data.config, genres, ctx, columns);
    const cellsOf = columnTexts(columns, genres, ctx);
    const at = Math.max(0, rows.findIndex(person => person.row === this.#person));
    const { list } = this.#refs;
    list.className = `${cards ? 'an-list an-grid' : 'an-list'}${columns.length ? ' has-cols' : ''}`;
    list.style.setProperty('--n', String(columns.length));
    list.replaceChildren(...(columns.length ? [columnHead(columns, t, this.#sort)] : []), ...rows.map((person, i) => (cards ? personCard : personRow)(person,
      { selected: person.row === this.#person, tabStop: i === at, extra: extraOf(person), cells: columns.length ? cellsOf(person) : null,
      masked: data.masked.has(person.row), t })),
    ...(found.length > rows.length ? [h('p', { class: 'an-note' }, t('work.more', { n: LIST_SHOWN, total: found.length }))] : []),
    ...(found.length ? [] : [h('p', { class: 'an-note' }, t(data.people.length ? 'an.list.none' : 'an.list.empty'))]));
  }

  #orgSignature() { return orgSignature(this.#query, this.#filters); }

  // Les outils que la barre de l'organigramme reçoit : « Filtres » (les mêmes que la liste), et « Personnes » quand c'est celui des structures.
  #paintOrgTools(model, mode, found) {
    const t = this.#o.t;
    const many = found > PEOPLE_MAX;
    const on = this.#orgPeople && !many;
    const people = mode !== 'structures' ? null : h('button', { type: 'button', class: 'btn sm an-tbtn an-ptoggle', 'aria-pressed': String(on),
      'aria-disabled': many ? 'true' : null, 'aria-label': t('an.org.people'), title: many ? t('an.org.peopleMany', { n: found }) : t('an.org.peopleTip'),
      dataset: { act: 'org-people', fk: 'org-people' } }, icon('users'), h('span', { class: 'an-tb-t' }, t('an.org.people')));
    this.#org.tools.replaceChildren(...[this.#menu.button(model, this.#filters), people, mailButton(this.#mailState(this.#matching()), t)].filter(Boolean));
  }

  // L'organigramme : celui des structures (l'arbre des niveaux), ou celui des responsables quand l'annuaire dit qui est le responsable de chacun. Il montre
  // toujours tout l'annuaire (pas un nœud), réduit par la recherche et les filtres (les mêmes que la liste) ; déplié jusqu'au niveau le plus bas.
  #paintOrg() {
    const t = this.#o.t;
    const { current, data } = this.#show;
    const hasManager = Boolean(data.config.manager);
    const hasLevels = data.config.levels.length > 0;
    const mode = hasManager && (this.#mode === 'managers' || !hasLevels) ? 'managers' : 'structures';
    const relations = relationsOf(data.config, t);
    const index = relationIndex(data.people, relations);
    const model = this.#filterModel(data.people);
    const { roots, found, withPeople, signature } = orgData({ mode, data, query: this.#query, filters: this.#filters, wantPeople: this.#orgPeople,
      linesOf: person => cardLines(person, relations, index) });
    const person = this.#person === null ? '' : `p${this.#person}`;
    const selected = mode === 'managers' || (withPeople && person) ? person : this.#structId();
    this.#paintOrgTools(model, mode, found.length);
    this.#org.show(roots, { key: `${current.row}:${mode}`, expand: `${signature}|${withPeople}`, selected, mode,
      lines: mode === 'managers' ? cardLineCount(relations) : 0,
      empty: data.people.length ? t('an.list.none') : '',
      modes: [{ id: 'structures', label: t('an.org.structures'), greyed: !hasLevels, why: t('an.org.noLevels') },
        { id: 'managers', label: t('an.org.managers'), greyed: !hasManager, why: t('an.org.noManager') }] });
  }

  // L'identifiant de la carte de la structure dont la fiche est ouverte (« root » pour la racine), ou rien.
  #structId() { return this.#struct === null ? '' : (this.#struct || 'root'); }

  #paintSide() {
    const { current, data } = this.#show;
    const t = this.#o.t;
    const genres = fieldGenres(data.config, current.table, data.schema);
    const relations = relationsOf(data.config, t);
    const ctx = { t, locale: this.#o.locale(), levels: data.config.levels, config: data.config, genres, relations,
      index: relationIndex(data.people, relations), writeBlock: this.#writeBlock(), masked: data.masked,
        presence: person => this.#presenceOf(person) };
    const person = this.#person === null ? null : data.people.find(each => each.row === this.#person);
    // la fiche d'une carte de l'organigramme parle des mêmes personnes que la carte
    const tree = this.#view === 'org' ? reducedTree(data, this.#matching(), this.#orgSignature()) : data.tree;
    const node = this.#struct === null ? null : findNode(tree, this.#struct) || findNode(data.tree, this.#struct);
    const body = person ? fiche(person, ctx) : (node ? nodeFiche(node, ctx) : null);
    const closer = h('button', { type: 'button', class: 'an-ib an-side-x', title: t('an.fiche.close'), 'aria-label': t('an.fiche.close'),
      dataset: { act: 'side-close', fk: 'side-x' } },
      icon('x'));
    this.#refs.side.replaceChildren(...(body ? [closer, body] : []));
  }

  // Le pied : combien de personnes passent la recherche et les filtres et, quand des valeurs sont choisies, lesquelles, avec le moyen de les retirer d'un clic
  // (« 10 sur 16 personnes · Titulaire, Siège · Réinitialiser » : la maquette du porteur).
  #paintFoot() {
    const t = this.#o.t;
    const { state, data } = this.#show;
    const note = this.#refs.note;
    if (this.#note) { note.textContent = this.#note; return; }
    if (state !== 'ready' || !data) { note.textContent = ''; return; }
    const total = data.people.length;
    const found = this.#view === 'org' ? this.#matching().length : this.#scope().found.length;
    const chosen = this.#menu.summary(this.#filterModel(data.people), this.#filters);
    const count = found === total ? t('an.foot.all', { n: total }) : t('an.foot.some', { n: found, total });
    const date = data.sub ? copyDate(data.sub.at, this.#o.locale()) : '';
    const text = data.sub ? `${count} · ${date ? t('an.sub.stamp', { date }) : t('an.sub.stampNoDate')}` : count;
    note.replaceChildren(...[h('span', { class: 'an-foot-t' }, chosen ? `${text} · ${chosen}` : text),
      chosen ? h('button', { type: 'button', class: 'an-reset', dataset: { act: 'filters-reset', fk: 'filters-reset' } }, t('an.filters.reset')) :
        null].filter(Boolean));
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
    const { data } = this.#show;
    if (id === 'managers' && !data.config.manager) { this.#say(this.#o.t('an.org.noManager')); return; }
    if (id === 'structures' && !data.config.levels.length) { this.#say(this.#o.t('an.org.noLevels')); return; }
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

  // Une phrase dans le pied (la fiche qu'on vient d'enregistrer) ; elle s'efface au geste suivant.
  say(text) { if (this.#root) this.#say(text); }

  // Choisit un nœud de la hiérarchie : lui et tout ce qui le porte se déplient, pour qu'il se voie.
  // Un geste que le contrôle fait (changer d'annuaire, en créer un, le régler).
  callout(name, arg) { this.#o[name](arg); }

  // Ce qui empêche d'écrire une fiche : une copie ne s'y modifie pas (la fiche se modifie dans l'annuaire d'origine), sinon ce que dit le document.
  #writeBlock() {
    const { data } = this.#show;
    return data && data.sub ? this.#o.t('an.sub.noEdit') : (this.#o.writeBlock ? this.#o.writeBlock() : null);
  }

  // Le menu du sous-annuaire (actualiser, partager, supprimer), sous le cadenas de la barre.
  subTool() {
    const { data } = this.#show;
    const anchor = this.#refs.tools.querySelector('[data-act="sub"]');
    if (data && data.sub && anchor) openSubMenu({ anchor, host: this.#root, t: this.#o.t, locale: this.#o.locale(), state: data.sub,
      run: key => this.callout('onSub', key) });
  }

  // Le bouton « Modifier » de la fiche : grisé quand le document ne s'écrit pas (le pied dit pourquoi), sinon la fenêtre « Modifier » (le contrôle l'ouvre).
  editPerson(row) {
    const blocked = this.#writeBlock();
    if (blocked) { this.#say(blocked); return; }
    void this.#o.onEdit(row);
  }

  // Ce que « Écrire » sait des personnes affichées : combien, et si l'une au moins a une adresse.
  #mailState(people) { return { count: people.length, addresses: addressesOf(people).length > 0 }; }

  // La ligne « Apparaître dans l'annuaire » d'une fiche : rien quand l'option « Ma présence » est éteinte.
  #presenceOf(person) {
    const { data } = this.#show;
    if (!data || !presenceCol(data.config)) return null;
    return { on: !data.masked.has(person.row), can: canSwitch(person, { admin: data.admin, identity: data.identity, people: data.people }),
      blocked: this.#o.writeBlock ? this.#o.writeBlock() : null };
  }

  // L'interrupteur de la fiche : la personne (ou l'administrateur) choisit d'apparaître ou non ; le contrôle écrit, la fenêtre le dit dans le pied.
  togglePresence(row) {
    const person = this.#show.data.people.find(each => each.row === row);
    const state = person ? this.#presenceOf(person) : null;
    if (!state) return;
    if (state.blocked || !state.can) { this.#say(state.blocked || this.#o.t('an.pres.noRight')); return; }
    void this.#o.onPresence(row, !state.on);
  }

  // La pastille « À vérifier » : réservée aux administrateurs (grisée, avec sa raison, pour les autres) ; sans contrôle allumé, le pied dit où les allumer.
  checkTool() {
    const { checks, admin } = this.#show.data;
    if (checks.sub) { this.#say(this.#o.t('an.check.sub')); return; }
    if (!admin) { this.#say(this.#o.t('an.check.admin')); return; }
    if (!checks.on) { this.#say(this.#o.t('an.check.off')); return; }
    void this.#o.onCheck();
  }

  // Le bouton « Écrire » : les personnes affichées (celles du nœud, de la recherche et des filtres ; dans l'organigramme, tout l'annuaire filtré).
  mailTool() {
    const people = this.#view === 'org' ? this.#matching() : this.#scope().found;
    if (!addressesOf(people).length) { this.#say(this.#o.t('an.mail.noAddress')); return; }
    void this.#o.onMail(people);
  }

  // Une fiche qu'un autre écran demande (le bouton « Ouvrir la fiche » de « À vérifier ») : la fiche s'ouvre sur la liste, la recherche et le nœud remis à
  // zéro.
  showPerson(row) {
    this.#menu.close();
    this.#query = '';
    this.#refs.search.value = '';
    this.#node = '';
    this.#struct = null;
    this.#person = row;
    this.#note = '';
    if (this.#view === 'org') this.#view = 'list';
    this.#paint();
    this.#focus(`pe:${row}`, 'side-x');
  }

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
    if (view === 'org' && this.#show.state === 'ready' && !this.#orgPossible()) { this.#say(this.#o.t('an.org.noHierarchy')); return; }
    this.#menu.close();
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

  // Un clic sur le titre d'une colonne : croissant, décroissant, puis plus de tri.
  sortBy(key) {
    this.#sort = nextSort(this.#sort, key);
    this.#paintBody();
    this.#focus(`sort:${key}`, 'search');
  }

  // Le bouton « Trier » : la liste des colonnes (js/ui/pick-window.js, ouverte par le contrôle) ; Entrée trie en croissant, le second geste en décroissant.
  pickSort() {
    const { data } = this.#show;
    void this.#o.onSortPick(sortKeys(data.config, this.#o.t), this.#sort).then(result => {
      if (result === null) return;
      this.#sort = result.value === '__none' ? null : { key: result.value, dir: result.alt ? 'desc' : 'asc' };
      this.#paintBody();
      this.#focus('sort-pick', 'search');
    });
  }

  // Le bouton « Filtres » : ouvre ou ferme le panneau, posé sous lui.
  toggleFilters() { this.#menu.toggle(); }

  // Un filtre qu'on replie ou déplie dans le panneau.
  toggleFilterSection(col) { this.#menu.toggleSection(col); }

  // Le bouton « Réinitialiser » du pied : plus aucune valeur choisie.
  resetFilters() {
    this.#filters = {};
    this.#note = '';
    this.#paintBody();
    this.#paintFoot();
    this.#focus('filters', 'search');
  }

  // Le bouton « Personnes » de l'organigramme : dessiner ou non les personnes sous leur structure, sans clic de plus ; le choix est retenu sur le navigateur.
  // Au-delà de PEOPLE_MAX personnes, le bouton dit pourquoi il ne peut pas.
  toggleOrgPeople() {
    const found = this.#matching().length;
    if (found > PEOPLE_MAX) { this.#say(this.#o.t('an.org.peopleMany', { n: found })); return; }
    this.#orgPeople = !this.#orgPeople;
    this.#store.write(this.#orgPeople ? '1' : '0');
    this.#note = '';
    this.#paintBody();
    this.#paintFoot();
    this.#focus('org-people');
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
    const option = filterOptions(this.#scope().base, data.config, data.schema, current.table).find(each => each.col === col);
    this.#menu.close();
    if (option) void this.#o.onFilterMore(col, option).then(value => { if (value !== null) this.toggleFilter(col, value); });
  }

  async copy(value) {
    const t = this.#o.t;
    this.#say(await copyText(value, this.#root.ownerDocument) ? t('an.copied', { what: value }) : t('an.copyFailed'));
  }

  // La fiche se ferme : le clavier revient à la ligne ou à la carte qu'elle montrait (la recherche si elle n'est plus là).
  closeSide() {
    const row = this.#person;
    const back = row !== null ? (this.#view === 'org' ? `oc:p${row}` : `pe:${row}`) : (this.#struct !== null ? `oc:${this.#struct || 'root'}` : '');
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

  // Une fenêtre posée au-dessus (le réglage, une liste avec recherche) : le clavier est à elle, l'annuaire derrière n'écoute pas (sans cela, Échap dans la
  // liste le fermait).
  #covered() {
    const host = this.#root.parentElement;
    const later = node => node !== this.#root && node.classList.contains('mod-scrim') &&
      Boolean(this.#root.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING);
    return Boolean(host) && [...host.children].some(later);
  }

  #keydown(event) {
    if (this.#covered()) return;
    const doc = this.#root.ownerDocument;
    if (doc.activeElement && doc.activeElement.closest('[data-popover]')) return; // le panneau des filtres garde Échap et Tab
    if (event.key === 'Escape') { this.#escape(event); return; }
    if (event.key === 'Tab') { this.#tab(event, doc); return; }
    const active = doc.activeElement;
    if (!active || !active.closest) return;
    if (active.closest('.an-tn')) treeKeys(event, active, { tree: this.#refs.tree, root: this.#show.data.tree, open: this.#open,
      toggle: id => this.toggleNode(id) });
    else if (active.closest('.an-list')) listKeys(event, active, { list: this.#refs.list, view: this.#view, search: this.#refs.search });
    else if (active === this.#refs.search && event.key === 'ArrowDown') {
      const first = this.#refs.list.querySelector('.an-person, .an-pcard');
      if (first && !this.#refs.list.hidden) { event.preventDefault(); first.focus(); }
    }
  }

  // Échap : range d'abord le panneau des filtres quand il est ouvert (le clavier revient à son bouton), sinon ferme la fenêtre.
  #escape(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!this.#menu.isOpen) { this.close(); return; }
    this.#menu.close();
    this.#focus('filters', 'search');
  }

  #tab(event, doc) {
    event.preventDefault();
    // ce qui est caché (`hidden` ou un volet que la fiche recouvre) n'est pas un arrêt
    const nodes = tabStops([...this.#root.querySelectorAll(FOCUSABLE)].filter(node => node.getClientRects().length > 0));
    const at = nodes.indexOf(doc.activeElement);
    (at < 0 ? this.#refs.search : nodes[(at + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length]).focus();
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
  sort: (window_, data) => window_.sortBy(data.key),
  'sort-pick': window_ => window_.pickSort(),
  fsec: (window_, data) => window_.toggleFilterSection(data.col),
  'filters-reset': window_ => window_.resetFilters(),
  'org-people': window_ => window_.toggleOrgPeople(),
  filter: (window_, data) => window_.toggleFilter(data.col, data.value),
  'filter-more': (window_, data) => window_.moreFilter(data.col),
  copy: (window_, data) => void window_.copy(data.value),
  'side-close': window_ => window_.closeSide(),
  'node-list': (window_, data) => window_.listNode(data.id),
  edit: (window_, data) => window_.editPerson(Number(data.row)),
  check: window_ => window_.checkTool(),
  sub: window_ => window_.subTool(),
  mail: window_ => window_.mailTool(),
  presence: (window_, data) => window_.togglePresence(Number(data.row)),
});
