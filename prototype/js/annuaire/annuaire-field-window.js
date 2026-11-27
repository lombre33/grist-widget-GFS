// La fenêtre « Modifier le champ » du réglage de l'annuaire (module Annuaire ; choix du porteur, 27/11 : « pouvoir changer la colonne et changer le nom du
// champ, ce n'est pas forcément la même chose », « ajouter depuis là des valeurs et typer la colonne »). Un champ y a deux réglages de l'annuaire, le nom qu'il
// porte (liste, filtres, fiche, export) et la colonne qu'il lit (une autre, ou une nouvelle : js/annuaire/annuaire-setup-path.js), et, pour la colonne, ce que
// Grist en garde : son type et ses valeurs (js/annuaire/annuaire-field-edit.js dit ce qu'on peut en changer et ce qui s'écrit). Rien n'est écrit dans Grist
// avant « Écrire dans Grist » ; le nom et la colonne ne s'écrivent nulle part dans Grist (ils rejoignent le réglage, enregistré avec lui). `host` : voir
// js/annuaire/annuaire-setup.js.

import { h } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { normalize } from '../ui/search.js';
import { columnAt, genreOf } from './annuaire-schema.js';
import { FIELD_SEPARATOR, fieldLabel, fieldPath } from './annuaire-config.js';
import { chooser, formRow, takenColumns, FILTERABLE } from './annuaire-setup-shared.js';
import { pickPath, tableAfter } from './annuaire-setup-path.js';
import { FIELD_TYPES, editLock, isChoiceGenre, planChange, typeVerdict, suggestedChoices } from './annuaire-field-edit.js';
import { valuesEditor } from './annuaire-values-editor.js';

const typeKey = genre => (FIELD_TYPES.find(each => each.genre === genre) || FIELD_TYPES[0]).key;

class FieldWindow {
  #host;
  #field;
  #at;
  #label;
  #path;
  #state = { status: 'loading', ids: [], cells: [], raw: '', error: '' };
  #genre = 'text';
  #stamp = 0;
  #busy = false;
  #refs = {};
  #values;
  #done;

  constructor(host, at) {
    this.#host = host;
    this.#at = at;
    this.#field = host.draft.config.fields[at];
    this.#label = this.#field.label || '';
    this.#path = [...fieldPath(this.#field)];
    this.#values = valuesEditor({ t: host.t, fk: 'fw-val', onChange: () => this.#paintGrist() });
  }

  get #col() { return columnAt(this.#host.schema, this.#host.draft.table, this.#path); }

  // La table et la colonne que le champ lit : le chemin sans sa dernière colonne donne la table, la dernière en est la colonne.
  get #target() { return { table: tableAfter(this.#host.schema, this.#host.draft.table, this.#path.slice(0, -1)), colId: this.#path.at(-1) }; }

  // Ce qui empêche de changer la colonne dans Grist : le texte, ou ''. Pendant la lecture, rien n'empêche encore (les gestes attendent).
  get #lock() {
    const { t } = this.#host;
    const col = this.#col;
    if (!col) return t('an.fld.absent');
    const why = editLock(col);
    if (why) return t(`an.fld.win.lock.${why}`);
    if (this.#state.status === 'failed') return t('an.fld.win.loadFailed', { reason: this.#state.error });
    return this.#host.writeBlock() || '';
  }

  // Ce qui s'écrirait dans Grist pour la colonne, d'après ce que la personne a réglé ; null tant que la colonne n'est pas lue ou qu'elle ne se change pas.
  get #plan() {
    const col = this.#col;
    if (!col || this.#lock || this.#state.status !== 'ready') return null;
    const { ids, cells, raw } = this.#state;
    return planChange({ col, want: { genre: this.#genre, choices: this.#values.values() }, cells, ids, raw });
  }

  run() {
    const { t } = this.#host;
    const refs = this.#refs;
    refs.name = h('input', { type: 'text', class: 'an-set-input', autocomplete: 'off', value: this.#label, placeholder: this.#path.at(-1),
      'aria-label': t('an.fld.win.name'), dataset: { fk: 'fw-name' } });
    refs.column = h('div', null);
    refs.grist = h('div', { class: 'an-fw-grist' });
    refs.note = h('span', { class: 'mod-note', 'aria-live': 'polite' });
    refs.cancel = h('button', { type: 'button', class: 'btn', dataset: { fk: 'fw-cancel' } }, t('an.set.cancel'));
    refs.ok = h('button', { type: 'button', class: 'btn primary', dataset: { fk: 'fw-ok' } }, t('an.fld.win.save'));
    const section = refs.section = h('section', { class: 'mod an-nl an-fw', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'an-fw-title' },
      h('header', { class: 'mod-head' }, h('h2', { id: 'an-fw-title' }, t('an.fld.win.title', { name: fieldLabel(this.#field) }))),
      h('div', { class: 'mod-body an-set-body' }, formRow(t('an.fld.win.name'), refs.name, t('an.fld.win.nameHint')),
        formRow(t('an.fld.win.column'), refs.column, t('an.fld.win.columnHint')), refs.grist),
      h('footer', { class: 'mod-foot' }, refs.note, refs.cancel, refs.ok));
    this.#paintColumn();
    this.#paintGrist();
    const { done, result } = openModal({ container: this.#host.container, section, inertTargets: this.#host.inertTargets, first: refs.name, cancel: null });
    this.#done = done;
    refs.cancel.addEventListener('click', () => done(false));
    refs.ok.addEventListener('click', () => void this.#save());
    refs.name.addEventListener('input', () => { this.#label = refs.name.value; this.#say(''); });
    refs.name.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); void this.#save(); } });
    section.addEventListener('click', event => this.#click(event));
    void this.#load();
    return result;
  }

  // Le clavier va à l'élément de la fenêtre que `key` (son `data-fk`) désigne.
  #focus(key) {
    const node = this.#refs.section && [...this.#refs.section.querySelectorAll('[data-fk]')].find(each => each.dataset.fk === key);
    if (node) node.focus();
  }

  #say(text) {
    this.#refs.note.textContent = text;
    this.#refs.note.classList.toggle('is-warn', Boolean(text));
  }

  // La colonne que le champ lit, en bouton (la liste avec recherche s'ouvre dessus).
  #paintColumn() {
    this.#refs.column.replaceChildren(chooser(this.#host.t, 'fw-col', this.#path.join(' › '), { act: 'fw-col' }));
  }

  // Lit ce que Grist garde de la colonne ; le dessin attend (les gestes de la partie Grist sont grisés) et reprend à l'arrivée.
  async #load() {
    const stamp = ++this.#stamp;
    const col = this.#col;
    this.#state = { status: 'loading', ids: [], cells: [], raw: '', error: '' };
    this.#genre = col ? col.genre : 'text';
    this.#values.set(col && isChoiceGenre(col.genre) ? col.choices : []);
    this.#paintGrist();
    if (!col || editLock(col)) return;
    try {
      const { table, colId } = this.#target;
      const state = await this.#host.columnState(table, colId);
      if (stamp === this.#stamp) this.#state = { status: 'ready', ids: state.ids, cells: state.cells, raw: state.raw, error: '' };
    } catch (error) {
      if (stamp === this.#stamp) this.#state = { status: 'failed', ids: [], cells: [], raw: '', error: String(error && error.message ? error.message : error) };
    }
    if (stamp === this.#stamp) this.#paintGrist();
  }

  #click(event) {
    const button = event.target.closest('[data-act], [data-type]');
    if (!button || button.getAttribute('aria-disabled') === 'true' || this.#busy) return;
    if (button.dataset.act === 'fw-col') void this.#pickColumn();
    else if (button.dataset.type) this.#chooseType(button.dataset.type);
  }

  // Un autre type : si la colonne devient un choix sans en avoir, on propose les valeurs que ses cellules portent déjà.
  #chooseType(genre) {
    const col = this.#col;
    if (!col || this.#genre === genre) return;
    this.#genre = genre;
    if (isChoiceGenre(genre) && this.#values.values().length === 0) this.#values.set(suggestedChoices(genre, this.#state.cells));
    this.#paintGrist();
    this.#focus(`fw-type:${genre}`);
  }

  // Une autre colonne pour le champ : la liste avec recherche (une colonne de la personne, d'une table liée, ou à créer) ; la colonne choisie est relue.
  async #pickColumn() {
    const { t, draft } = this.#host;
    const taken = takenColumns(draft.config);
    const path = await pickPath(this.#host, { title: t('an.fld.win.pickColumn'), text: t('an.set.pickFieldText'), current: this.#path,
      types: FIELD_TYPES.map(({ type, key }) => ({ type, label: t(key) })),
      filter: (col, followed) => followed.length > 0 || !taken.has(col.id) || col.id === this.#path[0] });
    if (path === null || !path.length) return;
    this.#path = path;
    this.#paintColumn();
    this.#refs.name.placeholder = path.at(-1);
    this.#focus('fw-col');
    await this.#load();
  }

  // Ce qui empêche d'enregistrer : le texte, ou ''. Une colonne ne sert qu'à un champ ; deux champs ne portent pas le même nom.
  #problem() {
    const { t, draft } = this.#host;
    const key = this.#path.join(FIELD_SEPARATOR);
    const others = draft.config.fields.filter((_, at) => at !== this.#at);
    if (others.some(field => field.col === key)) return t('an.fld.win.errColumn');
    const name = normalize(this.#label.trim() || this.#path.at(-1));
    return others.some(field => normalize(fieldLabel(field)) === name) ? t('an.fld.win.errTaken') : '';
  }

  // Le nom et la colonne rejoignent le champ du réglage ; un champ qui ne donne plus de filtre n'en garde pas l'interrupteur allumé.
  #apply() {
    const field = this.#field;
    const name = this.#label.trim();
    field.label = name === this.#path.at(-1) ? '' : name;
    field.col = this.#path.join(FIELD_SEPARATOR);
    field.path = this.#path.length > 1 ? [...this.#path] : [];
    const col = this.#col;
    if (!col || !FILTERABLE.includes(col.genre)) field.filter = false;
  }

  async #save() {
    const { t } = this.#host;
    if (this.#busy) return;
    const problem = this.#problem();
    if (problem) { this.#say(problem); this.#focus('fw-name'); return; }
    const plan = this.#plan;
    if (plan && plan.changed) {
      this.#busy = true;
      this.#refs.ok.textContent = t('an.fld.win.writing');
      try {
        const { table, colId } = this.#target;
        await this.#host.modifyColumn(table, colId, plan);
      } catch (error) {
        this.#busy = false;
        this.#refs.ok.textContent = t('an.fld.win.write');
        this.#say(t('an.fld.win.refused', { reason: String(error && error.message ? error.message : error) }));
        return;
      }
    }
    this.#apply();
    this.#done(true);
  }

  // La partie « Dans Grist » : le type, les valeurs, ce qui s'écrira. Grisée, avec sa raison, quand la colonne ne se change pas d'ici.
  #paintGrist() {
    const { t, draft } = this.#host;
    const col = this.#col;
    const { table, colId } = this.#target;
    const lock = this.#lock;
    const off = Boolean(lock) || this.#state.status === 'loading';
    const plan = this.#plan;
    this.#values.disable(off ? lock || t('an.fld.win.loading') : '');
    this.#refs.grist.replaceChildren(...[h('p', { class: 'an-fw-head' }, t('an.fld.win.inGrist', { col: colId, table: table || draft.table })),
      formRow(t('an.fld.win.type'), this.#typeButtons(col, off), this.#typesNote(col, lock)),
      isChoiceGenre(this.#genre) ? formRow(t('an.fld.win.values'), this.#values.node) : null, plan && plan.changed ? this.#preview(plan, colId) : null]
      .filter(Boolean));
    this.#refs.ok.textContent = this.#busy ? t('an.fld.win.writing') : t(plan && plan.changed ? 'an.fld.win.write' : 'an.fld.win.save');
  }

  // Ce que la partie « Dans Grist » dit sous les types : la raison du verrou, la lecture en cours, ou pourquoi des types sont grisés (des valeurs que Grist
  // abîmerait).
  #typesNote(col, lock) {
    const { t } = this.#host;
    if (lock) return lock;
    if (this.#state.status === 'loading') return t('an.fld.win.loading');
    const held = col && this.#state.status === 'ready' && FIELD_TYPES.some(each => !typeVerdict(col, each.genre, this.#state.cells).ok);
    return held ? t('an.fld.win.noConvert') : '';
  }

  #typeButtons(col, off) {
    const { t } = this.#host;
    const seg = h('div', { class: 'an-seg', role: 'group', 'aria-label': t('an.fld.win.type') });
    const cells = this.#state.cells;
    seg.append(...FIELD_TYPES.map(each => {
      const verdict = col && !off ? typeVerdict(col, each.genre, cells) : { ok: true, why: '' };
      const disabled = off || !verdict.ok;
      return h('button', { type: 'button', class: 'an-seg-b', 'aria-pressed': String(this.#genre === each.genre), 'aria-disabled': disabled ? 'true' : null,
        title: verdict.ok ? null : t(verdict.why), dataset: { type: each.genre, fk: `fw-type:${each.genre}` } }, t(each.key));
    }));
    return seg;
  }

  // Ce que Grist va écrire, dit avant le bouton : le type, les valeurs ajoutées ou retirées, ce que Grist fait des valeurs déjà saisies.
  #preview(plan, colId) {
    const { t } = this.#host;
    const lines = [h('p', { class: 'an-fw-title' }, t('an.fld.win.previewTitle'))];
    if (plan.type) lines.push(h('p', null, t('an.fld.win.pvType', { col: colId, from: t(typeKey(genreOf(plan.type.from))), to: t(typeKey(plan.type.genre)) })));
    if (plan.rewrite) lines.push(h('p', null, t('an.fld.win.pvTags', { n: plan.rewrite.ids.length })));
    if (plan.bestEffort) lines.push(h('p', null, t('an.fld.win.pvBest')));
    if (plan.added.length) lines.push(h('p', null, t('an.fld.win.pvAdd', { values: plan.added.join(', ') })));
    if (plan.removed.length) lines.push(h('p', null, t('an.fld.win.pvRemove', { values: plan.removed.join(', ') })));
    return h('div', { class: 'an-fw-preview', role: 'status' }, ...lines);
  }
}

// Ouvre la fenêtre du champ `at` du réglage ; quand la personne enregistre, le champ est changé et le réglage se redessine.
export async function editField(host, at) {
  if (!host.draft.config.fields[at]) return;
  const changed = await new FieldWindow(host, at).run();
  if (changed) host.repaint();
  host.focus(`fe:${at}`, `fl:${at}`);
}
