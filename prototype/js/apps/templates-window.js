// La fenêtre « Depuis un modèle » (décision du porteur du 18/11 : « Une galerie commune » ; contrats 5.4, point 13) : les modèles de départ que chaque app met
// à disposition, réunis. Une recherche (mots dans n'importe quel ordre), un filtre par app, une carte par modèle (vignette, nom, type, app), « Créer » qui
// ouvre l'app sur le modèle choisi. Grisé, jamais masqué : un modèle qui ne peut pas s'ouvrir garde sa carte, sa raison se dit dans le pied au clic, avec un
// accès à la fenêtre « Apps et extensions » quand une ligne la débloque ; une app sans modèle garde sa pastille, grisée « bientôt ». Une fenêtre sur une seule
// base : titre, recherche, pastilles et pied fixes, les cartes défilent. Elle ne décide rien : « Créer » et « Voir dans Apps » sont rendus au contrôleur.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { mountWindow, giveBackFocus, tabStops } from '../ui/modal.js';
import { filterModels } from './templates-catalogue.js';

const FOCUSABLE = 'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), [tabindex="0"]';

// La clé d'une carte : l'app et l'identifiant du modèle.
const keyOf = entry => `${entry.app}/${entry.id}`;

// La vignette du modèle, ou l'icône de son type quand il n'en a pas ou quand le fichier ne se charge pas (décoratif : le nom est écrit dessous).
function shot(entry) {
  const placeholder = () => h('span', { class: 'tp-ph' }, icon(entry.icon));
  if (!entry.thumb) return placeholder();
  const image = h('img', { class: 'tp-img', src: entry.thumb, alt: '', loading: 'lazy', decoding: 'async' });
  image.addEventListener('error', () => image.replaceWith(placeholder()), { once: true });
  return image;
}

export class TemplatesWindow {
  #opts;
  #root = null;
  #refs = null;
  #mounted = null; // { opener, unmount } de la fenêtre ouverte (modal.js, mountWindow)
  #app = 'all';
  #query = '';
  #selected = null; // la clé de la carte choisie
  #note = null; // une phrase posée par un clic sur une pastille grisée : { text }

  // opts : { container, i18n, inertTargets(), model() -> { apps, models }, onCreate(entry), onSeeApps(entry), onClose() }
  constructor(opts) { this.#opts = opts; }

  get isOpen() { return this.#root !== null; }
  get element() { return this.#root; }
  // Ce que la personne a réglé : le contrôleur le garde le temps d'une visite à la fenêtre « Apps et extensions ».
  memo() { return { app: this.#app, query: this.#query, selected: this.#selected }; }

  open(memo = null) {
    if (this.#root) return;
    this.#app = memo ? memo.app : 'all';
    this.#query = memo ? memo.query : '';
    this.#selected = memo ? memo.selected : null;
    this.#note = null;
    this.#build();
    this.#refs.search.value = this.#query; // la recherche d'une visite précédente se relit dans le champ
    this.#mounted = mountWindow({ container: this.#opts.container, root: this.#root, inertTargets: () => this.#opts.inertTargets(),
      onKey: event => this.#keydown(event) });
    this.refresh();
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
    this.#opts.onClose();
  }

  // La langue de GFS a changé : une fenêtre ouverte réécrit ses textes (refresh), une fenêtre fermée prendra les nouveaux à son ouverture.
  relocalize({ i18n }) {
    this.#opts = { ...this.#opts, i18n };
    this.refresh();
  }

  #build() {
    const search = h('input', { type: 'search', autocomplete: 'off', dataset: { fk: 'search' } });
    this.#refs = {
      title: h('h2', { id: 'tp-title' }), count: h('span', { class: 'tp-count' }), search, chips: h('div', { class: 'tp-chips', role: 'group' }),
      grid: h('div', { class: 'tp-grid' }), note: h('p', { class: 'mod-note tp-note', 'aria-live': 'polite' }),
      see: h('button', { type: 'button', class: 'btn quiet', hidden: true, dataset: { fk: 'see', act: 'see' } }),
      close: h('button', { type: 'button', class: 'btn', dataset: { fk: 'close', act: 'close' } }),
      create: h('button', { type: 'button', class: 'btn primary', dataset: { fk: 'create', act: 'create' } }),
    };
    const { title, count, chips, grid, note, see, close, create } = this.#refs;
    const section = h('section', { class: 'mod tp', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'tp-title' },
      h('header', { class: 'mod-head tp-head' },
        h('div', { class: 'tp-top' }, h('div', { class: 'tp-titles' }, title, count), h('label', { class: 'inp-search tp-search' }, icon('search'), search)),
          chips),
      h('div', { class: 'mod-body tp-body' }, grid), h('footer', { class: 'mod-foot' }, note, see, close, create));
    this.#root = h('div', { class: 'mod-scrim' }, section);
    search.addEventListener('input', () => { this.#query = search.value; this.#note = null; this.refresh(); });
    this.#root.addEventListener('click', event => this.#click(event));
    this.#root.addEventListener('dblclick', event => this.#doubleClick(event));
  }

  // Redessine d'après le modèle (les articles, leur grisé) en gardant le clavier là où il était.
  refresh() {
    if (!this.#root) return;
    const { t } = this.#opts.i18n;
    const { apps, models } = this.#opts.model();
    const refs = this.#refs;
    const doc = this.#root.ownerDocument;
    const kept = doc.activeElement && this.#root.contains(doc.activeElement) ? doc.activeElement.dataset.fk : null;
    if (this.#app !== 'all' && !apps.some(app => app.id === this.#app && app.state === 'ok')) this.#app = 'all'; // l'app choisie n'a plus de modèle
    const shown = filterModels(models, { app: this.#app, query: this.#query });
    if (this.#selected && !shown.some(entry => keyOf(entry) === this.#selected)) this.#selected = null;
    refs.title.textContent = t('tp.title');
    refs.count.textContent = t('tp.count', { n: shown.length });
    refs.search.placeholder = t('tp.search');
    refs.search.setAttribute('aria-label', t('tp.search'));
    refs.close.textContent = t('tp.close');
    refs.create.textContent = t('tp.create');
    refs.see.replaceChildren(icon('open'), t('tp.seeApps'));
    this.#paintChips(apps, models);
    this.#paintGrid(shown, models.length === 0);
    this.#paintFoot(shown);
    if (kept) this.#restoreFocus(kept);
  }

  #paintChips(apps, models) {
    const { t } = this.#opts.i18n;
    const chip = (id, name, state, extra) => h('button', { type: 'button', class: 'tp-chip', 'aria-pressed': String(this.#app === id && state === 'ok'),
      'aria-disabled': state === 'ok' ? null : 'true', dataset: { act: 'chip', app: id, fk: `chip:${id}` } }, name, h('b', null, extra));
    this.#refs.chips.replaceChildren(chip('all', t('tp.all'), 'ok', String(models.length)),
      ...apps.map(app => chip(app.id, app.name, app.state, app.state === 'ok' ? String(app.count) : t(app.state === 'broken' ? 'tp.broken' : 'tp.soon'))));
  }

  #paintGrid(shown, nothing) {
    const { t } = this.#opts.i18n;
    if (!shown.length) { this.#refs.grid.replaceChildren(h('p', { class: 'tp-none' }, t(nothing ? 'tp.empty' : 'tp.none'))); return; }
    const current = shown.find(entry => keyOf(entry) === this.#selected) || shown[0];
    this.#refs.grid.replaceChildren(...shown.map(entry => this.#card(entry, entry === current)));
  }

  // Une carte : un bouton (clic : choisir ; double-clic ou Entrée : créer). Une seule a l'arrêt de Tab, les flèches font le reste.
  #card(entry, tabStop) {
    const { t } = this.#opts.i18n;
    const locked = entry.greyed;
    return h('button', { type: 'button', class: 'tp-card', 'aria-pressed': String(keyOf(entry) === this.#selected), 'aria-disabled': locked ? 'true' : null,
      tabindex: tabStop ? '0' : '-1', title: locked ? entry.reason : (entry.description || null), ...(entry.family ? { 'data-fam': entry.family } : {}),
      dataset: { act: 'card', key: keyOf(entry), fk: `m:${keyOf(entry)}` } },
      h('span', { class: 'tp-shot' }, shot(entry)), h('span', { class: 'tp-name' }, entry.label),
      h('span', { class: 'tp-meta' }, h('span', { class: 'tp-type' }, icon(locked ? 'lock' : entry.icon), entry.typeLabel),
        h('span', { class: 'tp-app' }, entry.appLabel), entry.tables ? h('span', { class: 'tp-tables', title: t('tp.tablesTip') }, icon('table')) : null));
  }

  // Le pied : la phrase d'une pastille grisée, sinon celle du modèle choisi (sa raison quand il est grisé), sinon la consigne.
  #paintFoot(shown) {
    const { t } = this.#opts.i18n;
    const entry = shown.find(item => keyOf(item) === this.#selected) || null;
    const refs = this.#refs;
    let text = t('tp.idle');
    let seeApps = false;
    if (this.#note) text = this.#note.text;
    else if (entry && entry.greyed) { text = t('tp.locked', { name: entry.label, reason: entry.reason }); seeApps = Boolean(entry.focus); }
    else if (entry) text = t(entry.tables ? 'tp.chosenTables' : 'tp.chosen', { name: entry.label, app: entry.appLabel });
    refs.note.textContent = text;
    refs.note.classList.toggle('is-warn', Boolean(entry && entry.greyed && !this.#note));
    refs.see.hidden = !seeApps;
    refs.create.setAttribute('aria-disabled', entry && !entry.greyed ? 'false' : 'true');
  }

  #restoreFocus(key) {
    const target = [...this.#root.querySelectorAll('[data-fk]')].find(node => node.dataset.fk === key);
    if (target) target.focus({ preventScroll: true });
  }

  #entryOf(key) { return this.#opts.model().models.find(entry => keyOf(entry) === key) || null; }

  #click(event) {
    const button = event.target.closest('[data-act]');
    if (!button) return;
    const { act } = button.dataset;
    if (act === 'close') this.close();
    else if (act === 'chip') this.#chip(button.dataset.app);
    else if (act === 'card') { this.#selected = button.dataset.key; this.#note = null; this.refresh(); this.#restoreFocus(`m:${button.dataset.key}`); }
    else if (act === 'create') this.#create(this.#selected);
    else if (act === 'see') this.#seeApps(this.#selected);
  }

  #doubleClick(event) {
    const card = event.target.closest('[data-act="card"]');
    if (card) this.#create(card.dataset.key);
  }

  // Une pastille d'app : filtre (un second clic sur la même revient à toutes les apps) ; une pastille grisée dit pourquoi.
  #chip(id) {
    const { t } = this.#opts.i18n;
    const app = this.#opts.model().apps.find(item => item.id === id);
    if (app && app.state !== 'ok') {
      this.#note = { text: t(app.state === 'broken' ? 'tp.appBroken' : 'tp.appSoon', { app: app.name, reason: app.reason || '' }) }; this.refresh(); return; }
    this.#app = id === this.#app ? 'all' : id;
    this.#note = null;
    this.refresh();
  }

  // « Créer » : la fenêtre se ferme, l'app s'ouvre sur le modèle. Un modèle grisé n'ouvre rien : sa raison est dans le pied.
  #create(key) {
    const entry = key && this.#entryOf(key);
    if (!entry) return;
    if (entry.greyed) { this.#selected = key; this.#note = null; this.refresh(); return; }
    this.close();
    this.#opts.onCreate(entry);
  }

  #seeApps(key) {
    const entry = key && this.#entryOf(key);
    if (!entry || !entry.focus) return;
    this.close();
    this.#opts.onSeeApps(entry);
  }

  #keydown(event) {
    const doc = this.#root.ownerDocument;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); this.close(); return; }
    if (event.key === 'Tab') { this.#tab(event, doc); return; }
    const card = doc.activeElement && doc.activeElement.closest ? doc.activeElement.closest('.tp-card') : null;
    if (card && event.key === 'Enter') { event.preventDefault(); this.#create(card.dataset.key); return; }
    if (card && this.#arrow(event, card)) return;
    if (doc.activeElement === this.#refs.search && event.key === 'ArrowDown') {
      const first = this.#refs.grid.querySelector('.tp-card');
      if (first) { event.preventDefault(); first.focus(); }
    }
  }

  // Tab et Maj+Tab tournent dans la fenêtre.
  #tab(event, doc) {
    event.preventDefault();
    const nodes = tabStops([...this.#root.querySelectorAll(FOCUSABLE)].filter(node => !node.closest('[hidden]')));
    const at = nodes.indexOf(doc.activeElement);
    (at < 0 ? this.#refs.search : nodes[(at + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length]).focus();
  }

  // Les flèches vont d'une carte à l'autre : gauche et droite d'un cran, haut et bas d'une rangée (la rangée d'au-dessus de la première rend la recherche).
  #arrow(event, card) {
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 'down', ArrowUp: 'up' }[event.key];
    if (!step) return false;
    const cards = [...this.#refs.grid.querySelectorAll('.tp-card')];
    const at = cards.indexOf(card);
    const columns = cards.filter(other => other.offsetTop === cards[0].offsetTop).length || 1;
    const to = typeof step === 'number' ? at + step : at + (step === 'down' ? columns : -columns);
    event.preventDefault();
    const next = cards[to];
    if (next) { next.focus(); next.scrollIntoView({ block: 'nearest' }); } else if (to < 0) this.#refs.search.focus();
    return true;
  }
}
