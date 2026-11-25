// Le réglage d'un annuaire (module Annuaire, demande du porteur du 25/11) : sa table de personnes, les colonnes que GFS y lit (nom, poste, adresse, téléphone,
// responsable), les niveaux de la hiérarchie (un niveau = une colonne au choix, éventuellement après des références : « Structure › Pôle ») et les champs
// libres, dont certains donnent des filtres. Une fenêtre du widget sur la base commune (js/ui/modal.js) ; chaque choix de table ou de colonne passe par la
// liste avec recherche (js/ui/pick-window.js, charte). Elle ne parle pas à Grist : elle rend { name, table, config }, ou null quand la personne renonce ;
// l'écriture est à js/annuaire/annuaire-store.js. Grisé, jamais masqué : un champ qui ne se prête pas à un filtre garde sa case, grisée, avec la raison au
// survol.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openModal } from '../ui/modal.js';
import { pickFrom } from '../ui/pick-window.js';
import { isPeopleTable, columnOf } from './annuaire-schema.js';
import { CONFIG_VERSION, readConfig } from './annuaire-config.js';

const GLYPHS = Object.freeze({ ref: 'link', reflist: 'link', bool: 'check', date: 'clock', number: 'chart', choice: 'list', choicelist: 'list', file: 'pdf' });
const FILTERABLE = Object.freeze(['choice', 'choicelist', 'bool', 'ref', 'reflist']);
const MAX_PATH = 4;
// Les colonnes que GFS lit par un nom : [clé de la configuration, clé du texte, obligatoire].
const PERSON_ROWS = Object.freeze([['name', 'an.set.name', true], ['title', 'an.set.title', false], ['email', 'an.set.email', false],
  ['phone', 'an.set.phone', false],
  ['lead', 'an.set.lead', false], ['manager', 'an.set.manager', false]]);

// Une colonne dite à la personne : son nom et son type.
const columnItem = (col, hint) => ({ value: `use:${col.id}`, label: col.id, glyph: GLYPHS[col.genre] || 'table', hint: hint ?? col.type });

// Les articles d'une liste de colonnes : une colonne de référence en donne deux (sa valeur affichée, ou « suivre » vers les colonnes de la table visée).
function columnItems(schema, tableId, t, { follow }) {
  const cols = (schema[tableId] ? schema[tableId].columns : []).filter(col => col.genre !== 'file');
  return cols.flatMap(col => {
    const items = [columnItem(col, col.ref ? t('an.set.shows', { table: col.ref }) : col.type)];
    if (follow && col.genre === 'ref' && schema[col.ref]) items.push({ value: `go:${col.id}`, label: `${col.id} ›`, glyph: 'chev-right',
      hint: t('an.set.follow', { table: col.ref }) });
    return items;
  });
}

export class AnnuaireSetup {
  #o;
  #draft;
  #refs = {};
  #error = '';

  // opts : { container, inertTargets(), t, schema, annuaire (celui qu'on règle, ou null), taken: [noms déjà pris] }
  constructor(opts) {
    this.#o = opts;
    const base = opts.annuaire;
    this.#draft = base ? { name: base.name, table: base.table, config: readConfig(base.config) } : { name: '', table: '', config: readConfig({}) };
  }

  // La fenêtre : rend { name, table, config } ou null.
  run() {
    const t = this.#o.t;
    const editing = Boolean(this.#o.annuaire);
    const { body, note } = this.#refs = { body: h('div', { class: 'mod-body an-set-body' }),
      note: h('p', { class: 'mod-note an-set-note', 'aria-live': 'polite' }) };
    const cancel = h('button', { type: 'button', class: 'btn', dataset: { fk: 'set-cancel' } }, t('an.set.cancel'));
    const save = h('button', { type: 'button', class: 'btn primary', dataset: { fk: 'set-save' } }, t(editing ? 'an.set.save' : 'an.set.create'));
    const section = h('section', { class: 'mod an-set', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'an-set-title' },
      h('header', { class: 'mod-head' }, h('h2', { id: 'an-set-title' }, t(editing ? 'an.set.titleEdit' : 'an.set.titleNew'))), body,
      h('footer', { class: 'mod-foot' }, note, cancel, save));
    this.#paint();
    const { done, result } = openModal({ container: this.#o.container, section, inertTargets: this.#o.inertTargets, first: this.#firstFocus(), cancel: null });
    cancel.addEventListener('click', () => done(null));
    save.addEventListener('click', () => { if (this.#valid()) done({ name: this.#draft.name.trim(), table: this.#draft.table, config: this.#draft.config }); });
    body.addEventListener('click', event => this.#click(event));
    body.addEventListener('input', event => this.#input(event));
    return result;
  }

  #firstFocus() {
    return this.#refs.body.querySelector('input:not([disabled])') || this.#refs.body.querySelector('button');
  }

  // Ce qui empêche d'enregistrer, dit dans le pied ; rend true quand tout va.
  #valid() {
    const t = this.#o.t;
    const { name, table, config } = this.#draft;
    const taken = this.#o.taken.some(each => each.trim().toLowerCase() === name.trim().toLowerCase());
    const problem = !name.trim() ? 'an.set.errName' : (taken ? 'an.set.errTaken' : (!table ? 'an.set.errTable' : (!config.name ? 'an.set.errColumn' :
      (config.levels.some(level => !level.path.length) ? 'an.set.errLevel' : ''))));
    this.#error = problem ? t(problem) : '';
    this.#refs.note.textContent = this.#error;
    this.#refs.note.classList.toggle('is-warn', Boolean(problem));
    return !problem;
  }

  #field(label, control, hint = '') {
    return h('div', { class: 'an-set-row' }, h('span', { class: 'an-set-label' }, label),
      h('div', { class: 'an-set-control' }, control, hint ? h('span', { class: 'an-set-hint' }, hint) : null));
  }

  #chooser(fk, text, data, { disabled = false, title = '' } = {}) {
    return h('button', { type: 'button', class: 'an-pickbtn', 'aria-disabled': disabled ? 'true' : null, title: title || null, dataset: { ...data, fk } },
      text || this.#o.t('an.set.choose'), icon('chev-down'));
  }

  // Redessine tout le formulaire en gardant le clavier là où il était et le défilement.
  #paint() {
    const { body } = this.#refs;
    const doc = body.ownerDocument;
    const kept = doc.activeElement && body.contains(doc.activeElement) ? doc.activeElement.dataset.fk : null;
    const top = body.scrollTop;
    body.replaceChildren(this.#personsSection(), this.#levelsSection(), this.#fieldsSection());
    body.scrollTop = top;
    const again = kept && [...body.querySelectorAll('[data-fk]')].find(node => node.dataset.fk === kept);
    if (again) again.focus({ preventScroll: true });
  }

  #personsSection() {
    const t = this.#o.t;
    const { name, table, config } = this.#draft;
    const editing = Boolean(this.#o.annuaire);
    const fixed = editing && Boolean(this.#o.schema[table]); // une table qui a disparu du document se remplace
    const nameInput = h('input', { type: 'text', class: 'an-set-input', value: name, disabled: editing, autocomplete: 'off',
      'aria-label': t('an.set.nameLabel'),
      placeholder: t('an.set.namePlaceholder'), dataset: { fk: 'set-name', input: 'name' } });
    const rows = PERSON_ROWS.map(([key, label, required]) => this.#field(t(label) + (required ? ' *' : ''),
      this.#chooser(`pc:${key}`, config[key], { act: 'pick-person', key },
      { disabled: !table, title: table ? '' : t('an.set.needTable') }), t(`${label}Hint`)));
    return h('section', { class: 'an-sec' }, h('h3', null, t('an.set.persons')),
      this.#field(t('an.set.nameLabel') + ' *', nameInput), this.#field(t('an.set.table') + ' *',
        this.#chooser('pt', table, { act: 'pick-table' }, { disabled: fixed,
        title: fixed ? t('an.set.tableFixed') : '' }), fixed ? '' : t('an.set.tableHint')), ...rows);
  }

  #levelsSection() {
    const t = this.#o.t;
    const { table, config } = this.#draft;
    const rows = config.levels.map((level, i) => h('div', { class: 'an-set-lvl' },
      h('input', { type: 'text', class: 'an-set-input', value: level.label, placeholder: level.path.at(-1) || t('an.set.levelName'),
        'aria-label': t('an.set.levelName'), autocomplete: 'off',
        dataset: { fk: `ll:${i}`, input: 'level', index: String(i) } }),
      this.#chooser(`lp:${i}`, level.path.join(' › '), { act: 'pick-level', index: String(i) },
        { disabled: !table, title: table ? '' : t('an.set.needTable') }),
      h('button', { type: 'button', class: 'an-ib', title: t('an.set.up'), 'aria-label': t('an.set.up'), 'aria-disabled': i === 0 ? 'true' : null,
        dataset: { act: 'level-up', index: String(i), fk: `lu:${i}` } },
        icon('chev-up')),
      h('button', { type: 'button', class: 'an-ib', title: t('an.set.down'), 'aria-label': t('an.set.down'),
        'aria-disabled': i === config.levels.length - 1 ? 'true' : null,
        dataset: { act: 'level-down', index: String(i), fk: `ld:${i}` } }, icon('chev-down')),
      h('button', { type: 'button', class: 'an-ib', title: t('an.set.remove'), 'aria-label': t('an.set.remove'),
        dataset: { act: 'level-remove', index: String(i), fk: `lr:${i}` } }, icon('trash'))));
    return h('section', { class: 'an-sec' }, h('h3', null, t('an.set.levels')), h('p', { class: 'an-set-help' }, t('an.set.levelsHelp')), ...rows,
      h('button', { type: 'button', class: 'btn sm', 'aria-disabled': table ? null : 'true', title: table ? null : t('an.set.needTable'),
        dataset: { act: 'level-add', fk: 'level-add' } },
        icon('plus'), t('an.set.addLevel')));
  }

  #fieldsSection() {
    const t = this.#o.t;
    const { table, config } = this.#draft;
    const rows = config.fields.map((field, i) => {
      const col = columnOf(this.#o.schema, table, field.col);
      const can = col ? FILTERABLE.includes(col.genre) : false;
      return h('div', { class: 'an-set-fld' }, h('span', { class: 'an-set-fname' }, icon(GLYPHS[col ? col.genre : ''] || 'table'), field.col),
        h('label', { class: 'an-check', title: can ? '' : t('an.set.noFilter') }, h('input', { type: 'checkbox', checked: can && field.filter, disabled: !can,
          dataset: { act: 'field-filter', index: String(i), fk: `ff:${i}` } }), t('an.set.filter')),
        h('button', { type: 'button', class: 'an-ib', title: t('an.set.remove'), 'aria-label': t('an.set.remove'),
          dataset: { act: 'field-remove', index: String(i), fk: `fr:${i}` } },
          icon('trash')));
    });
    return h('section', { class: 'an-sec' }, h('h3', null, t('an.set.fields')), h('p', { class: 'an-set-help' }, t('an.set.fieldsHelp')), ...rows,
      h('button', { type: 'button', class: 'btn sm', 'aria-disabled': table ? null : 'true', title: table ? null : t('an.set.needTable'),
        dataset: { act: 'field-add', fk: 'field-add' } },
        icon('plus'), t('an.set.addField')));
  }

  // ---------- les gestes ----------

  #input(event) {
    const input = event.target.closest('[data-input]');
    if (!input) return;
    if (input.dataset.input === 'name') this.#draft.name = input.value;
    else if (this.#draft.config.levels[Number(input.dataset.index)]) this.#draft.config.levels[Number(input.dataset.index)].label = input.value;
  }

  #click(event) {
    const button = event.target.closest('[data-act]');
    if (!button || button.getAttribute('aria-disabled') === 'true') return;
    const { act, index, key } = button.dataset;
    const at = Number(index);
    const { levels, fields } = this.#draft.config;
    const moves = { 'level-up': () => this.#swap(levels, at, at - 1), 'level-down': () => this.#swap(levels, at, at + 1),
      'level-remove': () => levels.splice(at, 1),
      'field-remove': () => fields.splice(at, 1), 'field-filter': () => { fields[at].filter = button.checked; } };
    if (moves[act]) { moves[act](); this.#paint(); return; }
    if (act === 'pick-table') void this.#pickTable();
    else if (act === 'pick-person') void this.#pickPerson(key);
    else if (act === 'pick-level') void this.#pickLevel(at);
    else if (act === 'level-add') void this.#pickLevel(-1);
    else if (act === 'field-add') void this.#pickField();
  }

  #swap(list, a, b) {
    if (b < 0 || b >= list.length) return;
    [list[a], list[b]] = [list[b], list[a]];
  }

  #list(opts) {
    return pickFrom({ container: this.#o.container, inertTargets: this.#o.inertTargets, t: this.#o.t, ...opts });
  }

  async #pickTable() {
    const t = this.#o.t;
    const items = Object.keys(this.#o.schema).filter(isPeopleTable).sort((a, b) => a.localeCompare(b)).map(name => ({ value: name, label: name, glyph: 'table',
      hint: t('an.set.columns', { n: this.#o.schema[name].columns.length }) }));
    const chosen = await this.#list({ title: t('an.set.pickTable'), text: t('an.set.pickTableText'), items, current: this.#draft.table,
      none: t('an.set.noTable') });
    if (chosen === null || chosen === this.#draft.table) return;
    this.#draft.table = chosen;
    this.#draft.config = { ...readConfig({}), v: CONFIG_VERSION };
    this.#paint();
  }

  // Une colonne que GFS lit par un nom : le nom (obligatoire), le poste, l'adresse, le téléphone, « responsable » (oui/non) et le responsable direct (une
  // référence à la même table). Les facultatives se vident par le premier article de la liste.
  async #pickPerson(key) {
    const t = this.#o.t;
    const { table, config } = this.#draft;
    const [, label, required] = PERSON_ROWS.find(row => row[0] === key);
    let items = columnItems(this.#o.schema, table, t, { follow: false });
    if (key === 'manager') items = items.filter(item => {
      const col = columnOf(this.#o.schema, table, item.label); return col && col.genre === 'ref' && col.ref === table; });
    const clear = required ? [] : [{ value: 'none', label: t('an.set.none'), glyph: 'x', hint: '' }];
    const chosen = await this.#list({ title: t(label), text: t(`${label}Hint`), items: [...clear, ...items],
      current: config[key] ? `use:${config[key]}` : null, none: t(key === 'manager' ? 'an.set.noManagerColumn' : 'an.set.noColumn') });
    if (chosen === null) return;
    config[key] = chosen === 'none' ? '' : chosen.slice(4);
    this.#paint();
  }

  // Le chemin d'un niveau : on choisit une colonne ; une référence se prend telle quelle (sa valeur affichée) ou se suit vers la table qu'elle vise, et on
  // recommence.
  async #pickLevel(at) {
    const t = this.#o.t;
    const path = [];
    let table = this.#draft.table;
    while (path.length < MAX_PATH) {
      const chosen = await this.#list({ title: t('an.set.pickLevel'), text: path.length ? `${path.join(' › ')} ›` : t('an.set.pickLevelText'),
        items: columnItems(this.#o.schema, table, t, { follow: path.length < MAX_PATH - 1 }), none: t('an.set.noColumn') });
      if (chosen === null) return;
      path.push(chosen.slice(chosen.indexOf(':') + 1));
      if (chosen.startsWith('use:')) break;
      table = columnOf(this.#o.schema, table, path.at(-1)).ref;
    }
    const levels = this.#draft.config.levels;
    if (at >= 0) levels[at].path = path;
    else levels.push({ label: '', path });
    this.#paint();
    const again = this.#refs.body.querySelector(`[data-fk="lp:${at >= 0 ? at : levels.length - 1}"]`);
    if (again) again.focus({ preventScroll: true });
  }

  async #pickField() {
    const t = this.#o.t;
    const used = new Set(this.#draft.config.fields.map(field => field.col));
    const items = columnItems(this.#o.schema, this.#draft.table, t, { follow: false }).filter(item => !used.has(item.label));
    const chosen = await this.#list({ title: t('an.set.pickField'), text: t('an.set.pickFieldText'), items, none: t('an.set.noColumn') });
    if (chosen === null) return;
    const col = columnOf(this.#o.schema, this.#draft.table, chosen.slice(4));
    this.#draft.config.fields.push({ col: chosen.slice(4), filter: Boolean(col) && FILTERABLE.includes(col.genre) });
    this.#paint();
  }
}
