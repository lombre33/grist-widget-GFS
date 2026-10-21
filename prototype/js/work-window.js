// La fenêtre « Table de travail » (contrats 4.5, point 1) : un clic sur une table la choisit ; son bouton « Ligne » mène, pour qui le veut, à la liste de ses lignes.
// Chaque liste a sa recherche (mots dans n'importe quel ordre, accents, casse et ponctuation ignorés). Le premier article rend la main à la page. Une table que l'app
// ouverte ne lit pas est grisée avec sa raison, jamais masquée.
// Une fenêtre sur une seule base : le titre, la recherche et le pied restent en place, seule la liste défile. Elle ne décide rien : le choix est rendu au contrôleur.

import { h } from './dom.js';
import { icon } from './icons.js';
import { Layers } from './layers.js';
import { LIST_SHOWN as SHOWN, listKeys } from './modal.js';
import { normalize, words, matchesWords } from './search.js';

const FOCUSABLE = 'input, button:not([disabled])';

export class WorkWindow {
  #opts;
  #root = null;
  #list;
  #search;
  #note;
  #step = { kind: 'tables', items: [] };
  #opener = null;
  #inert = [];
  #onKey = null;

  // opts : { container, i18n, inertTargets() -> [élément], source, onPick({ tableId, rowId, label } | null), onClose() } ; une table choisie seule a `rowId` null.
  // source : { pageTable, current, tables() -> [{ id, locked: texte | null }], rows(id) -> Promise<[{ id, label, search }]> } ; la recherche d'une ligne porte sur `search`.
  constructor(opts) { this.#opts = opts; }

  get isOpen() { return this.#root !== null; }

  open() {
    if (this.#root) return;
    const doc = this.#opts.container.ownerDocument;
    this.#opener = doc.activeElement;
    this.#root = this.#build();
    this.#opts.container.append(this.#root);
    Layers.raise(this.#root, '--z-window');
    this.#inert = this.#opts.inertTargets().map(target => [target, target.inert]);
    for (const [target] of this.#inert) target.inert = true;
    this.#onKey = event => this.#keydown(event);
    doc.addEventListener('keydown', this.#onKey, true);
    this.#showTables();
    try { doc.defaultView.focus(); } catch (error) { /* le cadre garde l'état qu'il avait */ }
    this.#search.focus({ preventScroll: true });
  }

  close() {
    if (!this.#root) return;
    this.#root.ownerDocument.removeEventListener('keydown', this.#onKey, true);
    this.#root.remove();
    this.#root = null;
    for (const [target, was] of this.#inert) target.inert = was;
    this.#inert = [];
    const back = this.#opener;
    this.#opener = null;
    if (back && back.isConnected && typeof back.focus === 'function') back.focus({ preventScroll: true });
    this.#opts.onClose();
  }

  #build() {
    const { t } = this.#opts.i18n;
    this.#search = h('input', { type: 'search', autocomplete: 'off', placeholder: t('work.search'), 'aria-label': t('work.search'), dataset: { fk: 'work-search' },
      on: { input: () => this.#render() } });
    this.#list = h('ul', { class: 'wk-list', 'aria-labelledby': 'wk-title' });
    this.#note = h('p', { class: 'mod-note', 'aria-live': 'polite' });
    const root = h('div', { class: 'mod-scrim' },
      h('section', { class: 'mod wk', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'wk-title' },
        h('header', { class: 'mod-head wk-head' },
          h('div', { class: 'wk-title-row' },
            h('button', { type: 'button', class: 'btn sm wk-back', hidden: true, dataset: { fk: 'work-back' }, on: { click: () => this.#showTables() } }, icon('chev-left'), t('work.back')),
            h('h2', { id: 'wk-title' })),
          h('p', { class: 'mod-count wk-text' }),
          h('label', { class: 'inp-search wk-search' }, icon('search'), this.#search)),
        h('div', { class: 'mod-body' }, this.#list),
        h('footer', { class: 'mod-foot' }, this.#note,
          h('button', { type: 'button', class: 'btn', dataset: { fk: 'work-close' }, on: { click: () => this.close() } }, t('work.close')))));
    root.addEventListener('pointerdown', event => { if (event.target === root) this.close(); });
    this.#list.addEventListener('click', event => this.#onClick(event));
    return root;
  }

  // ---------- les deux étapes ----------

  #showTables() {
    const { t } = this.#opts.i18n;
    const { source } = this.#opts;
    const current = source.current;
    const page = { id: null, label: t('work.page', { table: source.pageTable || '—' }), glyph: 'link', checked: !current };
    const tables = source.tables().map(table => ({ id: table.id, label: table.id, glyph: 'table', locked: table.locked, checked: Boolean(current) && current.tableId === table.id, more: true }));
    this.#step = { kind: 'tables', items: [page, ...tables] };
    this.#heading(t('work.title'), t('work.textTables'), false);
    this.#search.value = '';
    this.#render();
    this.#search.focus({ preventScroll: true });
  }

  async #showRows(tableId) {
    const { t } = this.#opts.i18n;
    this.#heading(tableId, t('work.textRows', { table: tableId }), true);
    this.#step = { kind: 'rows', tableId, items: [] };
    this.#search.value = '';
    this.#list.replaceChildren();
    this.#note.textContent = t('work.loading', { table: tableId });
    let rows;
    try {
      rows = await this.#opts.source.rows(tableId);
    } catch (error) {
      if (this.#step.tableId === tableId) this.#note.textContent = t('work.failed', { table: tableId, reason: String((error && error.message) || '').slice(0, 120) });
      return;
    }
    if (!this.#root || this.#step.tableId !== tableId) return; // la fenêtre a été fermée, ou la personne est revenue aux tables
    const current = this.#opts.source.current;
    this.#step.items = rows.map(row => ({ id: row.id, label: row.label, search: normalize(`${row.label} ${row.search || ''}`), glyph: null, checked: Boolean(current) && current.tableId === tableId && current.rowId === row.id }));
    this.#render();
    this.#search.focus({ preventScroll: true });
  }

  #heading(title, text, back) {
    this.#root.querySelector('#wk-title').textContent = title;
    this.#root.querySelector('.wk-text').textContent = text;
    this.#root.querySelector('.wk-back').hidden = !back;
  }

  // Les articles dont le texte contient tous les mots de la recherche.
  #found() {
    const needles = words(this.#search.value);
    return this.#step.items.filter(item => matchesWords(needles, item.search || normalize(item.label)));
  }

  // La liste d'après la recherche, les SHOWN premiers.
  #render() {
    const { t } = this.#opts.i18n;
    const found = this.#found();
    this.#list.replaceChildren(...found.slice(0, SHOWN).map((item, index) => this.#item(item, index)));
    if (!found.length) this.#note.textContent = t('work.none');
    else if (found.length > SHOWN) this.#note.textContent = t('work.more', { n: SHOWN, total: found.length });
    else this.#note.textContent = this.#step.kind === 'rows' ? t('work.rows', { n: found.length }) : '';
  }

  #item(item, index) {
    const { t } = this.#opts.i18n;
    const reason = item.locked ? h('span', { class: 'wk-reason' }, item.locked) : null;
    const locked = item.locked ? ' is-locked' : '';
    const disabled = item.locked ? 'true' : null;
    // Le bouton « Ligne » d'une table : facultatif, il mène à la liste de ses lignes ; grisé comme sa table.
    const rows = item.more ? h('button', { type: 'button', class: `btn sm wk-rows${locked}`, dataset: { index: String(index), fk: `work-rows-${item.id}` }, 'aria-disabled': disabled,
      'aria-label': t('work.rowOf', { table: item.label }) }, t('work.row'), icon('chev-right')) : null;
    return h('li', { class: 'wk-row' },
      h('button', { type: 'button', class: `wk-item${locked}`, dataset: { index: String(index), fk: `work-item-${item.id ?? 'page'}` }, 'aria-disabled': disabled,
        'aria-current': item.checked ? 'true' : null },
      item.glyph ? icon(item.glyph) : null, h('span', { class: 'wk-label' }, h('span', { class: 'wk-name' }, item.label), reason), item.checked ? icon('check') : null),
      rows);
  }

  #onClick(event) {
    const button = event.target.closest('.wk-item, .wk-rows');
    if (!button) return;
    const item = this.#found()[Number(button.dataset.index)];
    if (!item) return;
    if (item.locked) { this.#note.textContent = item.locked; return; }
    if (this.#step.kind === 'tables' && item.id === null) { this.#pick(null); return; }
    if (this.#step.kind === 'tables' && event.target.closest('.wk-rows')) { void this.#showRows(item.id); return; }
    if (this.#step.kind === 'tables') { this.#pick({ tableId: item.id, rowId: null, label: null }); return; }
    this.#pick({ tableId: this.#step.tableId, rowId: item.id, label: item.label });
  }

  #pick(choice) {
    const { onPick } = this.#opts;
    this.close();
    onPick(choice);
  }

  // ---------- le clavier ----------

  // Échap ferme ; les flèches vont de la recherche à la liste et d'un article à l'autre, la flèche droite d'une table à ses lignes ; Tab reste dans la fenêtre.
  #keydown(event) {
    if (!this.#root) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.close(); return; }
    const items = [...this.#list.querySelectorAll('.wk-item')];
    const active = this.#root.ownerDocument.activeElement;
    if (event.key === 'ArrowRight' && items.includes(active) && active.nextElementSibling) { event.preventDefault(); active.nextElementSibling.click(); return; }
    if (listKeys(event, { search: this.#search, items })) return;
    if (event.key !== 'Tab') return;
    const nodes = [...this.#root.querySelectorAll(FOCUSABLE)].filter(node => !node.hidden && node.offsetParent !== null);
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const to = node => { event.preventDefault(); node.focus(); };
    if (!this.#root.contains(active)) to(event.shiftKey ? last : first);
    else if (event.shiftKey && active === first) to(last);
    else if (!event.shiftKey && active === last) to(first);
  }
}
