// La fenêtre « Types et champs » du guide (module Guide, demande du porteur du 27/11 : types de démarche, champs par type, plus de liberté) : les types du
// guide et leurs champs, « Ajouter les types livrés » (Demande, Information, Signalement, Rendez-vous, Parcours, Contact seul), un champ à soi (un nom et une
// forme), un type à soi (un nom et les champs qu'il demande). Chaque champ est une colonne de texte de la table des démarches : une colonne se crée avec
// l'accord de la personne (`createColumns`, que le contrôle fournit : la fenêtre qui nomme les colonnes, puis l'écriture). Elle ne parle pas à Grist : elle
// rend { kind, fields, types }, ou null.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openModal } from '../ui/modal.js';
import { pickFrom } from '../ui/pick-window.js';
import { FIELD_SHAPES, MAX_FIELDS, MAX_TYPES } from './guide-config.js';
import { KIND_COLUMN, missingBuiltins, withBuiltins, newId, typeLabel, fieldLabel } from './guide-types.js';

const SHAPE_GLYPH = Object.freeze({ text: 'edit', long: 'doc', list: 'list', link: 'link' });
const columnName = label => String(label).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) ||
  'Field';

export class GuideTypes {
  #o;
  #draft;
  #refs = null;
  #newField = { label: '', shape: 'text' };
  #newType = { label: '', fields: new Set() };
  #note = '';
  #busy = false;

  // opts : { container, inertTargets(), t, config ({ kind, fields, types }), createColumns(specs: [{ key, name }]) -> Promise<{ key: identifiant de colonne }
  //   ou null>,
  //   writeBlock() -> texte ou null }
  constructor(opts) {
    this.#o = opts;
    const { kind, fields, types } = opts.config;
    this.#draft = { ...opts.config, kind, fields: fields.map(field => ({ ...field })),
      types: types.map(type => ({ ...type, fields: [...type.fields], roles: [...type.roles] })) };
  }

  get #blocked() { return this.#o.writeBlock ? this.#o.writeBlock() : null; }

  async #columns(specs) {
    this.#busy = true;
    try { return await this.#o.createColumns(specs); } finally { this.#busy = false; }
  }

  // ---------- les gestes ----------

  async #install() {
    const todo = missingBuiltins(this.#draft);
    if (!todo.types.length) return;
    const specs = [...todo.fields.map(field => ({ key: field.id, name: field.col })), ...(todo.kind ? [{ key: 'kind', name: KIND_COLUMN }] : [])];
    const made = specs.length ? await this.#columns(specs) : {};
    if (!made) return;
    this.#draft = withBuiltins(this.#draft, made);
    this.#paint();
  }

  async #addField() {
    const { t } = this.#o;
    const { label, shape } = this.#newField;
    if (!label.trim() || this.#draft.fields.length >= MAX_FIELDS) return;
    const id = newId(label, this.#draft.fields.map(field => field.id), 'x');
    const made = await this.#columns([{ key: id, name: columnName(label) }]);
    if (!made || !made[id]) return;
    this.#draft.fields.push({ id, label: label.trim(), col: made[id], shape });
    this.#newField = { label: '', shape };
    this.#note = t('gd.types.fieldAdded', { name: label.trim() });
    this.#paint();
  }

  async #addType() {
    const { t } = this.#o;
    const { label, fields } = this.#newType;
    if (!label.trim() || this.#draft.types.length >= MAX_TYPES) return;
    if (!this.#draft.kind) {
      const made = await this.#columns([{ key: 'kind', name: KIND_COLUMN }]);
      if (!made || !made.kind) return;
      this.#draft.kind = made.kind;
    }
    const id = newId(label, this.#draft.types.map(type => type.id), 't');
    this.#draft.types.push({ id, label: label.trim(), glyph: 'guide', fields: this.#draft.fields.filter(field => fields.has(field.id)).map(field => field.id),
      roles: [] });
    this.#newType = { label: '', fields: new Set() };
    this.#note = t('gd.types.typeAdded', { name: label.trim() });
    this.#paint();
  }

  async #pickShape() {
    const { t, container, inertTargets } = this.#o;
    const items = FIELD_SHAPES.map(shape => ({ value: shape, label: t(`gd.shape.${shape}`), glyph: SHAPE_GLYPH[shape], hint: t(`gd.shape.${shape}Hint`) }));
    const chosen = await pickFrom({ container, inertTargets, t, title: t('gd.types.shape'), items, current: this.#newField.shape, none: '' });
    if (chosen !== null) { this.#newField.shape = chosen; this.#paint(); }
  }

  #remove(kind, id) {
    if (kind === 'type') this.#draft.types = this.#draft.types.filter(type => type.id !== id);
    else {
      this.#draft.fields = this.#draft.fields.filter(field => field.id !== id);
      for (const type of this.#draft.types) type.fields = type.fields.filter(each => each !== id);
    }
    this.#paint();
  }

  // ---------- ce qui se voit ----------

  #typeRow(type) {
    const { t } = this.#o;
    const fields = type.fields.map(id => this.#draft.fields.find(field => field.id === id)).filter(Boolean);
    return h('li', { class: 'gd-ty-row' }, icon(type.glyph, 'gd-ty-ic'), h('span', { class: 'gd-ty-t' }, h('b', null, typeLabel(type, t)),
      h('span', { class: 'gd-chips' }, ...(fields.length ? fields.map(field => h('span', { class: 'gd-chip' }, fieldLabel(field, t))) :
        [h('span', { class: 'gd-note' }, t('gd.types.noFields'))]))),
    h('button', { type: 'button', class: 'gd-ib', title: t('gd.types.removeType', { name: typeLabel(type, t) }),
      'aria-label': t('gd.types.removeType', { name: typeLabel(type, t) }),
      dataset: { act: 'rm-type', id: type.id, fk: `rm-type:${type.id}` } }, icon('x')));
  }

  #fieldRow(field) {
    const { t } = this.#o;
    return h('li', { class: 'gd-ty-row' }, icon(SHAPE_GLYPH[field.shape], 'gd-ty-ic'), h('span', { class: 'gd-ty-t' }, h('b', null, fieldLabel(field, t)),
      h('span', { class: 'gd-note' }, `${field.col} · ${t(`gd.shape.${field.shape}`)}`)),
    h('button', { type: 'button', class: 'gd-ib', title: t('gd.types.removeField', { name: fieldLabel(field, t) }),
      'aria-label': t('gd.types.removeField', { name: fieldLabel(field, t) }),
      dataset: { act: 'rm-field', id: field.id, fk: `rm-field:${field.id}` } }, icon('x')));
  }

  #paint() {
    const { t } = this.#o;
    const d = this.#draft;
    const blocked = this.#blocked;
    const todo = missingBuiltins(d);
    const doc = this.#refs.body.ownerDocument;
    const kept = doc.activeElement && doc.activeElement.dataset ? doc.activeElement.dataset.fk : null;
    const off = (extra = false) => ({ 'aria-disabled': blocked || this.#busy || extra ? 'true' : null, title: blocked || null });
    const columns = todo.fields.length + (todo.kind ? 1 : 0);
    this.#refs.body.replaceChildren(
      h('p', { class: 'an-set-hint' }, t('gd.types.intro')),
      h('h3', { class: 'gd-set-h' }, t('gd.types.types', { n: d.types.length })),
      d.types.length ? h('ul', { class: 'gd-ty-list' }, ...d.types.map(type => this.#typeRow(type))) : h('p', { class: 'gd-note' }, t('gd.types.noTypes')),
      h('button', { type: 'button', class: 'btn sm gd-set-add', ...off(!todo.types.length), dataset: { act: 'install', fk: 'install' } }, icon('plus'),
        todo.types.length ? t('gd.types.install', { n: columns }) : t('gd.types.installed')),
      h('h3', { class: 'gd-set-h' }, t('gd.types.fields', { n: d.fields.length })),
      d.fields.length ? h('ul', { class: 'gd-ty-list' }, ...d.fields.map(field => this.#fieldRow(field))) :
        h('p', { class: 'gd-note' }, t('gd.types.noFieldsYet')),
      h('div', { class: 'gd-ty-new' }, h('input', { type: 'text', class: 'an-set-input', autocomplete: 'off', placeholder: t('gd.types.fieldName'),
        'aria-label': t('gd.types.fieldName'),
        value: this.#newField.label, dataset: { fk: 'new-field' } }),
      h('button', { type: 'button', class: 'an-pickbtn', dataset: { act: 'shape', fk: 'new-shape' } }, t(`gd.shape.${this.#newField.shape}`),
        icon('chev-down')),
      h('button', { type: 'button', class: 'btn sm', ...off(!this.#newField.label.trim()), dataset: { act: 'add-field', fk: 'add-field' } }, icon('plus'),
        t('gd.types.addField'))),
      h('h3', { class: 'gd-set-h' }, t('gd.types.mine')),
      h('div', { class: 'gd-ty-new' }, h('input', { type: 'text', class: 'an-set-input', autocomplete: 'off', placeholder: t('gd.types.typeName'),
        'aria-label': t('gd.types.typeName'),
        value: this.#newType.label, dataset: { fk: 'new-type' } })),
      d.fields.length ? h('div', { class: 'gd-ty-pick', role: 'group', 'aria-label': t('gd.types.pickFields') },
        ...d.fields.map(field => h('button', { type: 'button',
        class: 'gd-chip is-toggle', 'aria-pressed': String(this.#newType.fields.has(field.id)),
          dataset: { act: 'toggle-field', id: field.id, fk: `tf:${field.id}` } },
      fieldLabel(field, t)))) : null,
      h('button', { type: 'button', class: 'btn sm', ...off(!this.#newType.label.trim()), dataset: { act: 'add-type', fk: 'add-type' } }, icon('plus'),
        t('gd.types.addType')));
    this.#refs.note.textContent = blocked || this.#note;
    const again = kept && [...this.#refs.body.querySelectorAll('[data-fk]')].find(node => node.dataset.fk === kept);
    if (again) again.focus({ preventScroll: true });
  }

  #click(event) {
    const button = event.target.closest('[data-act]');
    if (!button || button.getAttribute('aria-disabled') === 'true' || this.#busy) return;
    const { act, id } = button.dataset;
    const run = { install: () => this.#install(), 'add-field': () => this.#addField(), 'add-type': () => this.#addType(), shape: () => this.#pickShape(),
      'rm-type': () => this.#remove('type', id), 'rm-field': () => this.#remove('field', id),
      'toggle-field': () => { const set = this.#newType.fields; if (set.has(id)) set.delete(id); else set.add(id); this.#paint(); } }[act];
    if (run) void run();
  }

  // La fenêtre : rend { kind, fields, types } ou null.
  run() {
    const { t } = this.#o;
    const refs = this.#refs = { body: h('div', { class: 'mod-body an-set-body gd-set-body' }),
      note: h('p', { class: 'mod-note an-set-note', 'aria-live': 'polite' }) };
    const ok = h('button', { type: 'button', class: 'btn primary', dataset: { fk: 'types-ok' } }, t('gd.types.done'));
    const cancel = h('button', { type: 'button', class: 'btn', dataset: { fk: 'types-cancel' } }, t('an.set.cancel'));
    const section = h('section', { class: 'mod an-set gd-set gd-types', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'gd-types-title' },
      h('header', { class: 'mod-head' }, h('h2', { id: 'gd-types-title' }, t('gd.types.title'))), refs.body,
        h('footer', { class: 'mod-foot' }, refs.note, cancel, ok));
    this.#paint();
    const { done, result } = openModal({ container: this.#o.container, section, inertTargets: this.#o.inertTargets, first: ok, cancel: null });
    refs.body.addEventListener('click', event => this.#click(event));
    refs.body.addEventListener('input', event => {
      const fk = event.target.dataset ? event.target.dataset.fk : '';
      if (fk === 'new-field') this.#newField.label = event.target.value;
      else if (fk === 'new-type') this.#newType.label = event.target.value;
      else return;
      const addField = refs.body.querySelector('[data-fk="add-field"]');
      const addType = refs.body.querySelector('[data-fk="add-type"]');
      addField.setAttribute('aria-disabled', this.#newField.label.trim() && !this.#blocked ? 'false' : 'true');
      addType.setAttribute('aria-disabled', this.#newType.label.trim() && !this.#blocked ? 'false' : 'true');
    });
    ok.addEventListener('click', () => { if (!this.#busy) done({ kind: this.#draft.kind, fields: this.#draft.fields, types: this.#draft.types }); });
    cancel.addEventListener('click', () => done(null));
    return result;
  }
}
