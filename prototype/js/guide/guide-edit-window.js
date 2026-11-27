// La fenêtre qui écrit une démarche (module Guide, demande du porteur du 27/11 : « toute une interface pour créer les démarches ») : le titre, la démarche
// mère, les mots-clés, les étapes (une par ligne), les détails, puis un choix par rôle (qui contacter ; vide, la démarche prend celui de sa mère). Elle ne
// parle pas à Grist : elle rend ce que la personne a saisi, et js/guide/guide-control.js l'écrit. Les choix passent par la liste avec recherche (charte).

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openModal } from '../ui/modal.js';
import { pickFrom } from '../ui/pick-window.js';
import { formRow, chooser } from '../annuaire/annuaire-setup-shared.js';
import { ancestors } from './guide-model.js';
import { mothersFor, valuesFrom, problemOf, choicesFor } from './guide-write.js';

const TEXT_FIELDS = Object.freeze([['title', 'gd.proc.f.title', 'input'], ['keywords', 'gd.proc.f.keywords', 'input'], ['steps', 'gd.proc.f.steps', 'area'],
  ['details', 'gd.proc.f.details', 'area']]);
const HINTS = Object.freeze({ keywords: 'gd.proc.h.keywords', steps: 'gd.proc.h.steps', details: 'gd.proc.h.details' });

export class GuideEdit {
  #o;
  #values;
  #refs = null;

  // opts : { container, inertTargets(), t, fields (js/guide/guide-write.js `fieldsOf`), read (la lecture du guide : procs, index, data), directory, proc (la
  //   démarche
  //   écrite, ou null pour une neuve), parent (la mère proposée à une neuve), writeBlock() -> texte ou null }
  constructor(opts) {
    this.#o = opts;
    this.#values = valuesFrom(opts.proc, opts.parent ?? null);
  }

  get #fields() { return this.#o.fields; }

  get #ctx() { return { directory: this.#o.directory, data: this.#o.read.data }; }

  #field(key) { return this.#fields.find(item => item.key === key); }

  // Ce que dit un champ qu'on ne sait pas écrire (colonne absente ou d'un type que GFS n'écrit pas) : grisé, avec sa raison.
  #why(item) { return item.mode ? '' : this.#o.t(item.column ? 'gd.proc.noWrite' : 'gd.proc.noCol', { col: item.col }); }

  #labelOf(item) {
    const { read } = this.#o;
    if (item.key === 'parent') { const mother = this.#values.parent && read.index.byRow.get(this.#values.parent); return mother ? mother.title : ''; }
    const own = this.#values.roles[item.col];
    if (!own || !own.id) return '';
    const found = choicesFor(item, this.#ctx).find(choice => choice.value === own.id);
    return found ? found.label : own.text;
  }

  // ---------- les choix ----------

  async #pickMother() {
    const { t, read, proc, container, inertTargets } = this.#o;
    const items = [{ value: '', label: t('gd.proc.noMother'), glyph: 'x', hint: t('gd.proc.noMotherHint') },
      ...mothersFor(read.procs, read.index, proc ? proc.row : null).map(each => ({ value: String(each.row), label: each.title, glyph: 'guide',
        hint: ancestors(read.index, each.row).map(mother => mother.title).join(' › ') }))];
    const chosen = await pickFrom({ container, inertTargets, t, title: t('gd.proc.f.parent'), items, current: String(this.#values.parent || ''),
      none: t('an.noneFound') });
    if (chosen !== null) { this.#values.parent = chosen ? Number(chosen) : null; this.#paint(); }
  }

  async #pickRole(item) {
    const { t, container, inertTargets } = this.#o;
    const items = [{ value: '', label: t('gd.proc.noRole'), glyph: 'x', hint: t('gd.proc.noRoleHint') },
      ...choicesFor(item, this.#ctx).map(choice => ({ value: String(choice.value), label: choice.label, glyph: item.kind === 'person' ? 'user' : 'building',
        hint: choice.hint }))];
    const own = this.#values.roles[item.col];
    const chosen = await pickFrom({ container, inertTargets, t, title: item.role.label, items, current: own && own.id ? String(own.id) : '',
      none: t('an.noneFound') });
    if (chosen === null) return;
    this.#values.roles[item.col] = { id: chosen ? Number(chosen) : null, text: '' };
    this.#paint();
  }

  // ---------- la fenêtre ----------

  #textRow(key, labelKey, shape) {
    const { t } = this.#o;
    const item = this.#field(key);
    if (!item) return null;
    const why = this.#why(item);
    const control = h(shape === 'area' ? 'textarea' : 'input', { class: shape === 'area' ? 'an-set-input gd-area' : 'an-set-input', autocomplete: 'off',
      rows: shape === 'area' ? '4' : null,
      type: shape === 'area' ? null : 'text', 'aria-label': t(labelKey), 'aria-disabled': why ? 'true' : null, readonly: why ? '' : null, title: why || null,
      dataset: { fk: `pf:${key}` } });
    control.value = this.#values[key] ?? '';
    return formRow(key === 'title' ? `${t(labelKey)} *` : t(labelKey), control, why || (HINTS[key] ? t(HINTS[key]) : ''));
  }

  #roleRow(item) {
    const { t } = this.#o;
    const why = this.#why(item);
    if (item.mode === 'text') {
      const control = h('input', { type: 'text', class: 'an-set-input', autocomplete: 'off', 'aria-label': item.role.label,
        dataset: { fk: `pr:${item.col}` } });
      control.value = (this.#values.roles[item.col] || { text: '' }).text;
      return formRow(item.role.label, control, t('gd.proc.h.post'));
    }
    const label = this.#labelOf(item);
    return formRow(item.role.label, chooser(t, `pr:${item.col}`, label, { act: 'role', col: item.col }, { disabled: !item.mode, title: why }),
      why || t(label ? 'gd.proc.h.own' : 'gd.proc.h.inherit'));
  }

  #paint() {
    const { t } = this.#o;
    const { body, note, save } = this.#refs;
    const parent = this.#field('parent');
    const roles = this.#fields.filter(item => item.key.startsWith('role:'));
    const keep = body.ownerDocument.activeElement;
    const kept = keep && keep.dataset ? keep.dataset.fk : null;
    body.replaceChildren(this.#textRow('title', 'gd.proc.f.title', 'input'),
      parent ? formRow(t('gd.proc.f.parent'), chooser(t, 'pf:parent', this.#labelOf(parent) || t('gd.proc.noMother'), { act: 'mother' }),
        t('gd.proc.h.parent')) : null,
      ...TEXT_FIELDS.slice(1).map(([key, label, shape]) => this.#textRow(key, label, shape)),
      roles.length ? h('h3', { class: 'gd-set-h' }, t('gd.proc.contacts')) : null,
        roles.length ? h('p', { class: 'an-set-hint' }, t('gd.proc.contactsHint')) : null,
      ...roles.map(item => this.#roleRow(item)));
    const again = kept && [...body.querySelectorAll('[data-fk]')].find(node => node.dataset.fk === kept);
    if (again) again.focus({ preventScroll: true });
    const problem = this.#problem();
    note.textContent = problem;
    note.classList.toggle('is-warn', Boolean(problem));
    save.setAttribute('aria-disabled', problem ? 'true' : 'false');
  }

  #problem() {
    const { t, writeBlock } = this.#o;
    const blocked = writeBlock && writeBlock();
    if (blocked) return blocked;
    const key = problemOf(this.#fields, this.#values);
    return key ? t(key) : '';
  }

  // La saisie : le champ qui change met à jour la valeur sans redessiner (le clavier reste où il est).
  #input(event) {
    const fk = event.target.dataset ? event.target.dataset.fk : '';
    if (fk && fk.startsWith('pf:') && fk !== 'pf:parent') this.#values[fk.slice(3)] = event.target.value;
    else if (fk && fk.startsWith('pr:')) this.#values.roles[fk.slice(3)] = { id: null, text: event.target.value };
    const problem = this.#problem();
    this.#refs.note.textContent = problem;
    this.#refs.note.classList.toggle('is-warn', Boolean(problem));
    this.#refs.save.setAttribute('aria-disabled', problem ? 'true' : 'false');
  }

  #click(event) {
    const button = event.target.closest('[data-act]');
    if (!button || button.getAttribute('aria-disabled') === 'true') return;
    if (button.dataset.act === 'mother') void this.#pickMother();
    else if (button.dataset.act === 'role') void this.#pickRole(this.#field(`role:${button.dataset.col}`));
  }

  // La fenêtre : rend { values } (à enregistrer), { remove: true } (à retirer) ou null (rien).
  run() {
    const { t, proc } = this.#o;
    const refs = this.#refs = { body: h('div', { class: 'mod-body an-set-body gd-set-body' }),
      note: h('p', { class: 'mod-note an-set-note', 'aria-live': 'polite' }) };
    refs.save = h('button', { type: 'button', class: 'btn primary', 'aria-disabled': 'true', dataset: { fk: 'pe-save' } },
      t(proc ? 'gd.proc.save' : 'gd.proc.create'));
    const cancel = h('button', { type: 'button', class: 'btn', dataset: { fk: 'pe-cancel' } }, t('an.set.cancel'));
    const blocked = this.#o.writeBlock && this.#o.writeBlock();
    const remove = proc ? h('button', { type: 'button', class: 'btn danger gd-remove', 'aria-disabled': blocked ? 'true' : null, title: blocked || null,
      dataset: { fk: 'pe-remove' } },
      icon('trash'), t('gd.proc.remove')) : null;
    const section = h('section', { class: 'mod an-set gd-set gd-edit', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'gd-edit-title' },
      h('header', { class: 'mod-head' }, h('h2', { id: 'gd-edit-title' }, t(proc ? 'gd.proc.titleEdit' : 'gd.proc.titleNew'))), refs.body,
      h('footer', { class: 'mod-foot' }, remove, refs.note, cancel, refs.save));
    this.#paint();
    const { done, result } = openModal({ container: this.#o.container, section, inertTargets: this.#o.inertTargets, first: refs.body.querySelector('input'),
      cancel: null });
    refs.body.addEventListener('click', event => this.#click(event));
    refs.body.addEventListener('input', event => this.#input(event));
    refs.save.addEventListener('click', () => {
      if (refs.save.getAttribute('aria-disabled') !== 'true') done({ values: this.#values, before: proc ? valuesFrom(proc, null) : null }); });
    if (remove) remove.addEventListener('click', () => { if (remove.getAttribute('aria-disabled') !== 'true') done({ remove: true }); });
    cancel.addEventListener('click', () => done(null));
    return result;
  }
}
