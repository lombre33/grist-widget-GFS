// La fenêtre « Modifier » d'une fiche (module Annuaire, demande du porteur du 25/11) : le formulaire de la personne (ses colonnes directes, par groupes), puis
// la relecture (ce qui change, avant et après), puis l'écriture : trois temps, le dernier seulement sur le geste « Enregistrer ». Une fenêtre du widget sur la
// base commune (js/ui/modal.js, charte) ; chaque choix passe par la liste avec recherche (js/ui/pick-window.js). Elle ne parle pas à Grist : l'écriture est
// `save`, que le contrôle lui donne (js/annuaire/annuaire-control.js) ; une réponse de Grist qui refuse (ses règles d'accès) est dite telle quelle, la fenêtre
// reste ouverte. Rend vrai quand la fiche a été écrite, faux quand la personne renonce. Grisé, jamais masqué : les valeurs qu'une autre table porte restent
// dans la fenêtre, avec leur raison.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openModal } from '../ui/modal.js';
import { pickFrom } from '../ui/pick-window.js';
import { GROUPS, changesOf, problemOf, updateOf, refOptions, choiceOptions } from './annuaire-edit.js';
import { controlOf, lockedRow, say, labelsOf } from './annuaire-edit-controls.js';
import { formRow } from './annuaire-setup-shared.js';

const GROUP_TITLES = Object.freeze({ identity: 'an.edit.identity', contact: 'an.fiche.contact', relations: 'an.tab.relations', info: 'an.fiche.fields' });
const NONE = '__none';

export class EditWindow {
  #o;
  #values;
  #refs = {};
  #mode = 'edit';
  #labels;
  #busy = false;
  #done = null;

  // opts : { container, inertTargets(), t, locale, person ({ row, name }), table, fields, locked, values (ce que la fiche a : { clé: valeur }),
  //   lockedText(entrée) ->
  //   texte, options ({ data, people, table }: de quoi proposer les personnes et les lignes liées), save(action) -> Promise (l'`UpdateRecord`) }
  constructor(opts) {
    this.#o = opts;
    this.#values = structuredClone(opts.values);
    this.#labels = labelsOf(opts.fields, opts.options);
  }

  get #host() { return { t: this.#o.t, locale: this.#o.locale, labels: this.#labels }; }

  // La fenêtre : rend une promesse (vrai quand la fiche est écrite).
  run() {
    const refs = this.#refs = { body: h('div', { class: 'mod-body an-set-body an-ed-body' }),
      note: h('p', { class: 'mod-note an-set-note', 'aria-live': 'polite' }),
      title: h('h2', { id: 'an-ed-title' }), cancel: h('button', { type: 'button', class: 'btn', dataset: { fk: 'ed-cancel' } }),
      next: h('button', { type: 'button', class: 'btn primary', dataset: { fk: 'ed-next' } }) };
    const section = h('section', { class: 'mod an-set an-edit', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'an-ed-title' },
      h('header', { class: 'mod-head an-ed-head' }, refs.title, h('span', { class: 'an-ed-who' }, this.#o.person.name)), refs.body,
      h('footer', { class: 'mod-foot' }, refs.note, refs.cancel, refs.next));
    this.#paint();
    const first = refs.body.querySelector('input:not([disabled]), button[data-fk^="ef:"]') || refs.next;
    const { done, result } = openModal({ container: this.#o.container, section, inertTargets: this.#o.inertTargets, first, cancel: false });
    this.#done = done;
    refs.cancel.addEventListener('click', () => this.#cancel());
    refs.next.addEventListener('click', () => void this.#next());
    refs.body.addEventListener('click', event => this.#click(event));
    refs.body.addEventListener('input', event => this.#input(event));
    return result.then(Boolean);
  }

  // ---------- ce qui se voit ----------

  #changes() { return changesOf(this.#o.fields, this.#o.values, this.#values); }

  #say(text, warn = false) {
    this.#refs.note.textContent = text;
    this.#refs.note.classList.toggle('is-warn', warn);
  }

  // Redessine la fenêtre dans son temps (le formulaire ou la relecture), en gardant le clavier et le défilement.
  #paint() {
    const { body, title, cancel, next } = this.#refs;
    const doc = body.ownerDocument;
    const kept = doc.activeElement && body.contains(doc.activeElement) ? doc.activeElement.dataset.fk : null;
    const top = body.scrollTop;
    const t = this.#o.t;
    const review = this.#mode === 'review';
    title.textContent = t(review ? 'an.edit.reviewTitle' : 'an.edit.title');
    cancel.textContent = t(review ? 'an.edit.back' : 'an.set.cancel');
    next.textContent = t(review ? 'an.edit.save' : 'an.edit.review');
    body.replaceChildren(...(review ? this.#reviewNodes() : this.#formNodes()));
    body.scrollTop = top;
    const again = kept && [...body.querySelectorAll('[data-fk]')].find(node => node.dataset.fk === kept);
    if (again) again.focus({ preventScroll: true });
    this.#paintFoot();
  }

  // Le pied : combien de champs ont changé (le bouton se grise tant que rien n'a changé).
  #paintFoot() {
    const n = this.#changes().length;
    const review = this.#mode === 'review';
    this.#refs.next.setAttribute('aria-disabled', !review && n === 0 ? 'true' : 'false');
    if (this.#busy) return;
    this.#say(review ? '' : this.#o.t(n ? 'an.edit.count' : 'an.edit.nothing', { n }), false);
  }

  #formNodes() {
    const { fields, locked, t } = this.#o;
    const host = this.#host;
    const rows = group => [...fields.filter(field => field.group === group).map(field => formRow(field.label, controlOf(field, this.#values[field.key], host))),
      ...locked.filter(entry => entry.group === group).map(entry => lockedRow(entry, this.#o.lockedText(entry), t))];
    return GROUPS.map(group => {
      const list = rows(group);
      return list.length ? h('section', { class: 'an-sec an-ed-sec' }, h('h3', null, t(GROUP_TITLES[group])), ...list) : null;
    }).filter(Boolean);
  }

  // La relecture : pour chaque champ changé, la valeur d'avant (barrée) et celle d'après.
  #reviewNodes() {
    const { t, locale, table } = this.#o;
    const labels = this.#labels;
    const changes = this.#changes();
    const nothing = t('an.fiche.empty');
    const text = (field, value) => say(field, value, { t, locale, labels }) || nothing;
    return [h('p', { class: 'an-set-help an-ed-intro' }, t('an.edit.reviewText', { n: changes.length, table })),
      h('dl', { class: 'an-ed-review' }, ...changes.map(({ field, before, after }) => h('div', { class: 'an-ed-change' }, h('dt', null, field.label),
        h('dd', null, h('s', { class: 'an-ed-was' }, text(field, before)), icon('chev-right'), h('b', { class: 'an-ed-now' }, text(field, after))))))];
  }

  // ---------- les gestes ----------

  #cancel() {
    if (this.#busy) return;
    if (this.#mode === 'review') { this.#mode = 'edit'; this.#paint(); this.#focus('ed-next'); return; }
    this.#done(false);
  }

  // Le premier de ces repères (`data-fk`) qui existe prend le clavier.
  #focus(...keys) {
    const nodes = [...this.#refs.body.querySelectorAll('[data-fk]'), ...[this.#refs.next, this.#refs.cancel]];
    for (const key of keys) {
      const node = nodes.find(each => each.dataset.fk === key);
      if (node) { node.focus({ preventScroll: false }); return; }
    }
  }

  // Le bouton du pied : du formulaire à la relecture (après avoir vérifié chaque valeur), puis de la relecture à l'écriture.
  async #next() {
    if (this.#busy || this.#refs.next.getAttribute('aria-disabled') === 'true') {
      if (this.#mode === 'edit') this.#say(this.#o.t('an.edit.nothing'));
      return;
    }
    if (this.#mode === 'edit') {
      const bad = this.#o.fields.find(field => problemOf(field, this.#values[field.key]));
      if (bad) { this.#problem(bad); return; }
      this.#mode = 'review';
      this.#paint();
      this.#focus('ed-next');
      return;
    }
    await this.#write();
  }

  #problem(field) {
    this.#say(this.#o.t(problemOf(field, this.#values[field.key]), { what: field.label }), true);
    this.#focus(`ef:${field.key}`);
    const node = [...this.#refs.body.querySelectorAll('[data-fk]')].find(each => each.dataset.fk === `ef:${field.key}`);
    if (node) node.setAttribute('aria-invalid', 'true');
  }

  async #write() {
    const t = this.#o.t;
    this.#busy = true;
    this.#refs.next.setAttribute('aria-disabled', 'true');
    this.#say(t('an.edit.saving'));
    try {
      await this.#o.save(updateOf(this.#o.table, this.#o.person.row, this.#changes()));
      this.#busy = false;
      this.#done(true);
    } catch (error) {
      this.#busy = false;
      this.#refs.next.setAttribute('aria-disabled', 'false');
      this.#say(t('an.edit.refused', { reason: String(error && error.message ? error.message : error) }), true);
    }
  }

  #input(event) {
    const input = event.target.closest('[data-input]');
    if (!input) return;
    this.#values[input.dataset.input] = input.value;
    input.removeAttribute('aria-invalid');
    this.#paintFoot();
  }

  #click(event) {
    const button = event.target.closest('[data-act]');
    if (!button || button.getAttribute('aria-disabled') === 'true' || this.#mode !== 'edit') return;
    const { act, key, value } = button.dataset;
    const field = this.#o.fields.find(each => each.key === key);
    if (!field) return;
    if (act === 'ed-bool') this.#set(field, !this.#values[key]);
    else if (act === 'ed-chip') this.#set(field, this.#toggled(this.#values[key], value));
    else if (act === 'ed-remove') this.#set(field, this.#values[key].filter(id => String(id) !== value));
    else if (act === 'ed-choice') void this.#choose(field);
    else if (act === 'ed-ref' || act === 'ed-add') void this.#chooseRef(field);
  }

  #toggled(list, value) {
    return list.includes(value) ? list.filter(each => each !== value) : [...list, value];
  }

  #set(field, value) {
    this.#values[field.key] = value;
    this.#paint();
  }

  // Une liste avec recherche : le choix (ou null).
  #list(opts) {
    return pickFrom({ container: this.#o.container, inertTargets: this.#o.inertTargets, t: this.#o.t, none: this.#o.t('an.noneFound'), ...opts });
  }

  async #choose(field) {
    const t = this.#o.t;
    const items = [{ value: NONE, label: t('an.edit.none'), glyph: 'x', pinned: true },
      ...choiceOptions(field, this.#values[field.key]).map(each => ({ value: each, label: each, glyph: 'check' }))];
    const chosen = await this.#list({ title: field.label, items, current: this.#values[field.key] || NONE });
    if (chosen !== null) this.#set(field, chosen === NONE ? '' : chosen);
    this.#focus(`ef:${field.key}`);
  }

  async #chooseRef(field) {
    const t = this.#o.t;
    const many = field.genre === 'reflist';
    const taken = many ? this.#values[field.key] : [];
    // une personne ne se choisit pas elle-même (son responsable, son assistant·e…)
    const options = refOptions(field, this.#o.options).filter(option => !taken.includes(option.id) &&
      !(field.ref === this.#o.table && option.id === this.#o.person.row));
    const items = [...(many ? [] : [{ value: NONE, label: t('an.edit.none'), glyph: 'x', pinned: true }]),
      ...options.map(option => ({ value: String(option.id), label: option.label, glyph: field.ref === this.#o.table ? 'user' : 'check' }))];
    const chosen = await this.#list({ title: field.label, items, current: many ? null : String(this.#values[field.key] || NONE) });
    if (chosen !== null) this.#set(field, many ? [...taken, Number(chosen)] : (chosen === NONE ? 0 : Number(chosen)));
    this.#focus(many ? `ea:${field.key}` : `ef:${field.key}`, `ef:${field.key}`);
  }
}
