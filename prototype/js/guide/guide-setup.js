// Le réglage d'un guide (module Guide, demande du porteur du 27/11) : une fenêtre à une page. Le nom ; la table des démarches (une table du document, ou une
// que GFS crée avec l'accord de la personne) ; les colonnes que le guide lit (le titre, la démarche mère, les mots-clés, les étapes, les détails) ; l'annuaire
// dont viennent les contacts ; les rôles, une colonne chacun (« Pour demander », « Pour faire valider », « En cas de problème », « À défaut », ou un rôle à
// soi). Chaque choix de table ou de colonne passe par la liste avec recherche (js/ui/pick-window.js, charte) ; « Créer une colonne » reprend la fenêtre de
// l'annuaire (js/annuaire/annuaire-setup- path.js). Elle ne parle pas à Grist : elle rend { name, table, config }, ou null quand la personne renonce ;
// l'écriture est à js/guide/guide-store.js.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openModal } from '../ui/modal.js';
import { pickFrom } from '../ui/pick-window.js';
import { normalize } from '../ui/search.js';
import { pickColumn } from '../annuaire/annuaire-setup-path.js';
import { chooser, formRow, iconButton } from '../annuaire/annuaire-setup-shared.js';
import { isPeopleTable } from '../annuaire/annuaire-schema.js';
import { readConfig, ROLE_PRESETS, MAX_ROLES } from './guide-config.js';

const SAMPLE = Object.freeze({ state: 'none', load() {}, text: () => '', whenLoaded() {} }); // le choix d'une colonne n'a pas de personne d'exemple
const OPTIONAL = Object.freeze([['keywords', 'gd.set.keywords', 'gd.set.keywordsHint'], ['steps', 'gd.set.steps', 'gd.set.stepsHint'],
  ['details', 'gd.set.details',
  'gd.set.detailsHint']]);
const GUESS = Object.freeze({ title: ['title', 'titre', 'name', 'nom'], parent: ['parent', 'mere', 'mother', 'demarchemere'],
  keywords: ['keywords', 'motscles', 'mots'],
  steps: ['steps', 'etapes'], details: ['details', 'detail', 'description'] });

export class GuideSetup {
  #o;
  #draft;
  #refs = {};

  // opts : { container, inertTargets(), t, schema, guide (celui qu'on règle, ou null), taken: [noms déjà pris], directories: [{ row, name, table, show (la
  //   colonne qui montre le nom d'une personne) }], createTable() ->
  //   Promise<{ table, title, parent, keywords, steps, details } ou null> (la table que GFS crée, avec l'accord donné dans sa fenêtre), createColumn(table,
  //   nom, type, montre)
  //   -> { id }, writeBlock() -> texte ou null }
  constructor(opts) {
    this.#o = opts;
    const base = opts.guide;
    this.#draft = base ? { name: base.name, table: base.table, config: readConfig(base.config) } : { name: '', table: '', config: readConfig({}) };
  }

  // Ce que `pickColumn` de l'annuaire attend de son hôte.
  get #host() {
    const { t, schema, container, inertTargets } = this.#o;
    return { t, schema, draft: this.#draft, sample: SAMPLE, container, inertTargets, writeBlock: () => (this.#o.writeBlock ? this.#o.writeBlock() : null),
      list: opts => pickFrom({ container, inertTargets, t, ...opts }), createColumn: (table, made) => this.#createColumn(table, made) };
  }

  async #createColumn(table, { name, type }) {
    const [kind, target] = type.split(':');
    const directory = this.#o.directories.find(each => each.table === target);
    const show = target === this.#draft.table ? this.#draft.config.title : (directory ? directory.show : '');
    const made = await this.#o.createColumn(table, name, type, show);
    if (this.#o.schema[table]) this.#o.schema[table].columns.push({ id: made.id, type, genre: kind === 'Ref' ? 'ref' : 'text', ref: target || '',
      visible: '' });
    return made;
  }

  // Les colonnes déjà prises par un usage (le titre, la mère, un rôle… : une colonne ne sert qu'à un seul), sauf `keep`.
  #used(keep = '') {
    const { config } = this.#draft;
    return new Set([config.title, config.parent, config.keywords, config.steps, config.details, ...config.roles.map(role => role.col)].filter(col => col &&
      col !== keep));
  }

  // Choisit une colonne pour `key` ('title', 'parent'…) ; `types` : ce qu'on propose de créer ; `filter` : les colonnes qu'on propose.
  async #pick(key, { title, types = [], clear = false, filter = () => true, current = '' }) {
    const used = this.#used(current);
    const col = await pickColumn(this.#host, { title, types, clear, current, filter: each => !used.has(each.id) && filter(each) });
    return col;
  }

  async #chooseColumn(key) {
    const { t } = this.#o;
    const { table, config } = this.#draft;
    if (!table) return;
    const own = { parent: { filter: col => col.genre === 'ref' && col.ref === table, types: [{ type: `Ref:${table}`, label: t('gd.set.parentType') }] },
      title: { filter: col => col.genre === 'text', types: [{ type: 'Text', label: t('an.type.text') }] } }[key]
      || { filter: col => col.genre === 'text', types: [{ type: 'Text', label: t('an.type.text') }], clear: true };
    const label = key === 'title' ? t('gd.set.title') : key === 'parent' ? t('gd.set.parent') : t(OPTIONAL.find(entry => entry[0] === key)[1]);
    const col = await this.#pick(key, { title: label, current: config[key], clear: key !== 'title', ...own });
    if (col !== null) { config[key] = col; this.#paint(); }
  }

  // La table des démarches : une table du document, ou « Créer une table pour ce guide » ; les colonnes se retrouvent d'après leur nom.
  async #chooseTable() {
    const { t, schema } = this.#o;
    const items = [{ value: 'new:', label: t('gd.tbl.item'), glyph: 'plus', hint: t('gd.tbl.itemHint'), pinned: true, alt: false },
      ...Object.keys(schema).filter(isPeopleTable).map(id => ({ value: `use:${id}`, label: id, glyph: 'table',
        hint: t('gd.tbl.columns', { n: schema[id].columns.length }) }))];
    const chosen = await pickFrom({ container: this.#o.container, inertTargets: this.#o.inertTargets, t, title: t('gd.set.table'), items,
      none: t('an.noneFound'),
      current: this.#draft.table ? `use:${this.#draft.table}` : null });
    if (chosen === null) return;
    if (chosen === 'new:') {
      const made = await this.#o.createTable();
      if (made) { this.#draft.table = made.table; Object.assign(this.#draft.config,
        { title: made.title, parent: made.parent, keywords: made.keywords, steps: made.steps,
        details: made.details, roles: [] }); this.#paint(); }
      return;
    }
    this.#useTable(chosen.slice(4));
  }

  #useTable(table) {
    const { config } = this.#draft;
    if (table === this.#draft.table) return;
    this.#draft.table = table;
    const columns = this.#o.schema[table].columns;
    for (const key of Object.keys(GUESS)) {
      const found = columns.find(col => GUESS[key].includes(normalize(col.id).replace(/\s+/g, '')) &&
        (key !== 'parent' || (col.genre === 'ref' && col.ref === table)));
      config[key] = found ? found.id : '';
    }
    config.roles = [];
    this.#paint();
  }

  async #chooseDirectory() {
    const { t, directories } = this.#o;
    const items = [{ value: '', label: t('gd.set.noDirectory'), glyph: 'x', hint: t('gd.set.noDirectoryHint') },
      ...directories.map(each => ({ value: String(each.row), label: each.name, glyph: 'annuaire', hint: each.table }))];
    const chosen = await pickFrom({ container: this.#o.container, inertTargets: this.#o.inertTargets, t, title: t('gd.set.directory'), items,
      none: t('an.noneFound'),
      current: this.#draft.config.directory });
    if (chosen !== null) { this.#draft.config.directory = chosen; this.#paint(); }
  }

  async #chooseRoleColumn(at) {
    const { t } = this.#o;
    const { table, config } = this.#draft;
    const directory = this.#o.directories.find(each => String(each.row) === config.directory);
    const types = [{ type: 'Text', label: t('gd.kind.post') }, ...(directory ? [{ type: `Ref:${directory.table}`, label: t('gd.kind.person') }] : [])];
    const col = await this.#pick('role', { title: t('gd.set.roleColumn'), types, current: at === null ? '' : config.roles[at].col,
      filter: each => each.genre !== 'bool' });
    if (!col) return;
    if (at === null) config.roles.push({ col, label: col, preset: 'other' }); else config.roles[at].col = col;
    this.#paint();
    this.#refs.body.querySelector(`[data-fk="role-label:${at === null ? config.roles.length - 1 : at}"]`)?.focus();
  }

  async #choosePreset(at) {
    const { t } = this.#o;
    const role = this.#draft.config.roles[at];
    const taken = this.#draft.config.roles.some((each, i) => i !== at && each.preset === 'fallback');
    const items = ROLE_PRESETS.map(preset => ({ value: preset, label: t(`gd.preset.${preset}`), glyph: preset === 'fallback' ? 'warning' : 'user',
      hint: t(`gd.preset.${preset}Hint`),
      locked: preset === 'fallback' && taken }));
    const chosen = await pickFrom({ container: this.#o.container, inertTargets: this.#o.inertTargets, t, title: t('gd.set.preset'), items, current: role.preset,
      none: '' });
    if (chosen !== null && !(chosen === 'fallback' && taken)) {
      if (!role.label || role.label === role.col || ROLE_PRESETS.some(preset => role.label === t(`gd.preset.${preset}`))) role.label = chosen === 'other' ?
        role.col : t(`gd.preset.${chosen}`);
      role.preset = chosen;
      this.#paint();
    }
  }

  // ---------- la fenêtre ----------

  #choice(key, label, hint, fk) {
    const { t } = this.#o;
    const { config, table } = this.#draft;
    return formRow(label, chooser(t, fk, config[key], { act: key }, { disabled: !table, title: table ? '' : t('gd.set.needTable') }), hint);
  }

  #paint() {
    const { t, schema, directories } = this.#o;
    const { body, save, note } = this.#refs;
    const { config, table } = this.#draft;
    const directory = directories.find(each => String(each.row) === config.directory);
    const roles = config.roles.map((role, at) => h('div', { class: 'gd-set-role' },
      h('input', { type: 'text', class: 'an-set-input', value: role.label, 'aria-label': t('gd.set.roleName'),
        dataset: { fk: `role-label:${at}`, at: String(at) } }),
      chooser(t, `role-col:${at}`, role.col, { act: 'role-col', at: String(at) }, { title: t('gd.set.roleColumn') }),
      h('button', { type: 'button', class: 'btn sm gd-preset', dataset: { act: 'role-preset', at: String(at), fk: `role-preset:${at}` } },
        t(`gd.preset.${role.preset}`)),
      iconButton(t, { glyph: 'x', label: t('gd.set.roleRemove'), fk: `role-del:${at}`, data: { act: 'role-del', at: String(at) } })));
    body.replaceChildren(
      formRow(`${t('gd.set.name')} *`, h('input', { type: 'text', class: 'an-set-input', value: this.#draft.name, autocomplete: 'off',
        'aria-label': t('gd.set.name'),
        dataset: { fk: 'set-name' } })),
      formRow(`${t('gd.set.table')} *`, chooser(t, 'set-table', table, { act: 'table' }), t('gd.set.tableHint')),
      this.#choice('title', `${t('gd.set.title')} *`, t('gd.set.titleHint'), 'set-title'),
        this.#choice('parent', t('gd.set.parent'), t('gd.set.parentHint'), 'set-parent'),
      ...OPTIONAL.map(([key, label, hint]) => this.#choice(key, t(label), t(hint), `set-${key}`)),
      formRow(t('gd.set.directory'), chooser(t, 'set-directory', directory ? directory.name : '', { act: 'directory' }), t('gd.set.directoryHint')),
      h('h3', { class: 'gd-set-h' }, t('gd.set.roles')), h('p', { class: 'an-set-hint' }, t('gd.set.rolesHint')), ...roles,
      h('button', { type: 'button', class: 'btn sm gd-set-add', 'aria-disabled': !table || config.roles.length >= MAX_ROLES ? 'true' : null,
        dataset: { act: 'role-add', fk: 'role-add' } },
        icon('plus'), t('gd.set.roleAdd')));
    const problem = this.#problem(schema);
    note.textContent = problem;
    note.classList.toggle('is-warn', Boolean(problem));
    save.setAttribute('aria-disabled', problem ? 'true' : 'false');
  }

  // Ce qui empêche d'enregistrer : le texte, ou ''.
  #problem(schema) {
    const { t, taken } = this.#o;
    const { name, table, config } = this.#draft;
    if (this.#o.writeBlock && this.#o.writeBlock()) return this.#o.writeBlock();
    if (!name.trim()) return t('gd.set.errName');
    if (taken.some(each => normalize(each) === normalize(name))) return t('gd.set.errTaken');
    if (!table || !schema[table]) return t('gd.set.errTable');
    return config.title ? '' : t('gd.set.errTitle');
  }

  #click(event) {
    const button = event.target.closest('[data-act]');
    if (!button || button.getAttribute('aria-disabled') === 'true') return;
    const at = Number(button.dataset.at);
    const run = { table: () => this.#chooseTable(), directory: () => this.#chooseDirectory(), 'role-add': () => this.#chooseRoleColumn(null),
      'role-col': () => this.#chooseRoleColumn(at), 'role-preset': () => this.#choosePreset(at),
      'role-del': () => { this.#draft.config.roles.splice(at, 1); this.#paint(); } }[button.dataset.act] || (() => this.#chooseColumn(button.dataset.act));
    void run();
  }

  // La fenêtre : rend { name, table, config } ou null.
  run() {
    const { t } = this.#o;
    const editing = Boolean(this.#o.guide);
    const refs = this.#refs = { body: h('div', { class: 'mod-body an-set-body gd-set-body' }),
      note: h('p', { class: 'mod-note an-set-note', 'aria-live': 'polite' }) };
    refs.save = h('button', { type: 'button', class: 'btn primary', 'aria-disabled': 'true', dataset: { fk: 'set-save' } },
      t(editing ? 'gd.set.save' : 'gd.set.create'));
    const cancel = h('button', { type: 'button', class: 'btn', dataset: { fk: 'set-cancel' } }, t('an.set.cancel'));
    const section = h('section', { class: 'mod an-set gd-set', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'gd-set-title' },
      h('header', { class: 'mod-head' }, h('h2', { id: 'gd-set-title' }, t(editing ? 'gd.set.titleEdit' : 'gd.set.titleNew'))), refs.body,
      h('footer', { class: 'mod-foot' }, refs.note, cancel, refs.save));
    this.#paint();
    const { done, result } = openModal({ container: this.#o.container, section, inertTargets: this.#o.inertTargets, first: refs.body.querySelector('input'),
      cancel: null });
    refs.body.addEventListener('click', event => this.#click(event));
    refs.body.addEventListener('input', event => {
      const input = event.target;
      if (input.dataset.fk === 'set-name') this.#draft.name = input.value;
      else if (input.dataset.at !== undefined) this.#draft.config.roles[Number(input.dataset.at)].label = input.value;
      if (input.dataset.fk === 'set-name') this.#paintState();
    });
    refs.save.addEventListener('click', () => {
      if (refs.save.getAttribute('aria-disabled') !== 'true') done({ name: this.#draft.name.trim(), table: this.#draft.table,
      config: readConfig(this.#draft.config) }); });
    cancel.addEventListener('click', () => done(null));
    return result;
  }

  // Le pied et le bouton, sans redessiner la saisie en cours (le clavier reste dans le champ).
  #paintState() {
    const problem = this.#problem(this.#o.schema);
    this.#refs.note.textContent = problem;
    this.#refs.note.classList.toggle('is-warn', Boolean(problem));
    this.#refs.save.setAttribute('aria-disabled', problem ? 'true' : 'false');
  }
}
