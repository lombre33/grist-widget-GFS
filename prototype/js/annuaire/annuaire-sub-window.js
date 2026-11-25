// La fenêtre « Nouveau sous-annuaire » (module Annuaire, demande du porteur du 25/11, scène 10 de la maquette) : son nom, et ce qu'il contient : « les
// personnes dont <niveau ou champ> est <valeurs> » (le critère se choisit dans la liste avec recherche, les valeurs une à une, avec leur nombre de personnes).
// Qui le voit ne se règle pas ici : à la création, seuls les propriétaires du document le lisent, puis la fenêtre « Partager » de GFS (les mêmes lignes que
// pour un fichier : une personne, un groupe, une catégorie, un espace) dit qui d'autre. La fenêtre ne dit rien à Grist : elle rend ce que la personne a
// décidé ; l'écriture et le verrou sont à js/annuaire/annuaire-control.js. Une fenêtre du widget sur la base commune (js/ui/modal.js).

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openModal } from '../ui/modal.js';
import { pickFrom } from '../ui/pick-window.js';
import { chooser, formRow } from './annuaire-setup-shared.js';

const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

export class SubWindow {
  #o;
  #name = '';
  #key = '';
  #values = [];
  #refs = {};
  #done = null;

  // opts : { container, inertTargets(), t, parent (le nom de l'annuaire d'origine), criteria ([{ col, label, genre, values: [{ value, count }] }]), taken (les
  //   noms déjà pris), show(valeur, genre) -> le texte d'une valeur, count({ key, values }) -> combien de personnes le critère retient }
  constructor(opts) { this.#o = opts; }

  get #criterion() { return this.#o.criteria.find(each => each.col === this.#key) || null; }

  // Rend { name, sub: { key, label, values } } quand la personne crée, null quand elle renonce.
  run() {
    const t = this.#o.t;
    const refs = this.#refs = { name: h('input', { type: 'text', class: 'an-set-input', autocomplete: 'off', placeholder: t('an.sub.namePlaceholder'),
      'aria-label': t('an.sub.name'), dataset: { fk: 'sub-name' } }),
    contains: h('div', { class: 'an-sub-contains' }), count: h('span', { class: 'an-pill an-sub-count', 'aria-live': 'polite' }),
    note: h('p', { class: 'mod-note an-set-note', 'aria-live': 'polite' }),
    cancel: h('button', { type: 'button', class: 'btn', dataset: { fk: 'sub-cancel' } }, t('an.set.cancel')),
    ok: h('button', { type: 'button', class: 'btn primary', dataset: { fk: 'sub-ok' } }, t('an.sub.create')) };
    const body = h('div', { class: 'mod-body an-set-body an-sub-body' },
      this.#o.criteria.length ? null : h('p', { class: 'an-set-hint is-warn' }, icon('warning'), t('an.sub.noCriteria')),
      formRow(t('an.sub.name'), refs.name), formRow(t('an.sub.contains'), h('div', { class: 'an-sub-row' }, refs.contains, refs.count)),
      h('p', { class: 'an-set-why an-sub-lock' }, icon('shield'), h('span', null, t('an.sub.lock'))),
      h('p', { class: 'an-set-hint' }, t('an.sub.copy')));
    const section = h('section', { class: 'mod an-set an-sub', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'an-sub-title' },
      h('header', { class: 'mod-head an-ed-head' }, h('h2', { id: 'an-sub-title' }, t('an.sub.title')), h('small', { class: 'an-sub-of' },
        t('an.sub.sub', { name: this.#o.parent }))),
      body, h('footer', { class: 'mod-foot an-sub-foot' }, refs.note, refs.cancel, refs.ok));
    this.#paint();
    const { done, result } = openModal({ container: this.#o.container, section, inertTargets: this.#o.inertTargets, first: refs.name, cancel: null });
    this.#done = done;
    refs.name.addEventListener('input', () => { this.#name = refs.name.value; this.#say(''); });
    refs.cancel.addEventListener('click', () => done(null));
    refs.ok.addEventListener('click', () => this.#create());
    refs.contains.addEventListener('click', event => this.#click(event));
    return result;
  }

  // ---------- ce qui se voit ----------

  #paint() {
    const { t, show } = this.#o;
    const { contains, count, ok } = this.#refs;
    const criterion = this.#criterion;
    const chips = criterion ? this.#values.map(value => h('button', { type: 'button', class: 'an-sub-val',
      title: t('an.sub.removeValue', { value: show(value, criterion.genre) }),
      'aria-label': t('an.sub.removeValue', { value: show(value, criterion.genre) }), dataset: { act: 'sub-unval', value, fk: `sub-v:${value}` } },
    h('span', { class: 'an-sub-val-t' }, show(value, criterion.genre)), icon('x'))) : [];
    contains.replaceChildren(h('span', { class: 'an-sub-w' }, t('an.sub.whose')),
      chooser(t, 'sub-key', criterion ? criterion.label : '', { act: 'sub-key' }, { disabled: this.#o.criteria.length === 0 }),
      h('span', { class: 'an-sub-w' }, t('an.sub.is')), ...chips,
      h('button', { type: 'button', class: 'btn sm an-sub-add', 'aria-disabled': criterion ? null : 'true', title: criterion ? null : t('an.sub.errKey'),
        dataset: { act: 'sub-add', fk: 'sub-add' } }, icon('plus'), t('an.sub.addValue')));
    const n = this.#o.count({ key: this.#key, values: this.#values });
    count.textContent = t('an.sub.count', { n });
    ok.setAttribute('aria-disabled', this.#problem(n) ? 'true' : 'false');
  }

  // Ce qui empêche de créer : la clé du texte qui le dit, ou null.
  #problem(n) {
    if (!this.#name.trim()) return 'an.sub.errName';
    if (this.#o.taken.some(name => same(name, this.#name))) return 'an.sub.errTaken';
    if (!this.#key) return 'an.sub.errKey';
    if (!this.#values.length) return 'an.sub.errValues';
    return n > 0 ? null : 'an.sub.errEmpty';
  }

  #say(text) { this.#refs.note.textContent = text; }

  // ---------- les gestes ----------

  #click(event) {
    const button = event.target.closest('[data-act]');
    if (!button) return;
    const { act, value } = button.dataset;
    if (act === 'sub-key') void this.#pickKey();
    else if (act === 'sub-add') void this.#pickValue(button);
    else if (act === 'sub-unval') { this.#values = this.#values.filter(each => each !== value); this.#paint(); this.#focus('sub-add'); }
  }

  #focus(fk) {
    const node = [...this.#refs.contains.querySelectorAll('[data-fk]')].find(each => each.dataset.fk === fk);
    if (node) node.focus({ preventScroll: true });
  }

  async #pickKey() {
    const { t } = this.#o;
    const items = this.#o.criteria.map(each => ({ value: each.col, label: each.label, glyph: each.col.startsWith('@L') ? 'org' : 'filter',
      hint: t('an.sub.nValues', { n: each.values.length }) }));
    const chosen = await pickFrom({ container: this.#o.container, inertTargets: this.#o.inertTargets, t, title: t('an.sub.keyTitle'), items, current: this.#key,
      none: t('an.noneFound') });
    if (chosen === null || chosen === this.#key) { this.#focus('sub-key'); return; }
    this.#key = chosen;
    this.#values = [];
    this.#say('');
    this.#paint();
    this.#focus('sub-key');
  }

  async #pickValue(button) {
    const { t, show } = this.#o;
    const criterion = this.#criterion;
    if (!criterion || button.getAttribute('aria-disabled') === 'true') { this.#say(t('an.sub.errKey')); return; }
    const items = criterion.values.filter(each => !this.#values.includes(each.value)).map(each =>
      ({ value: each.value, label: show(each.value, criterion.genre),
      glyph: 'check', hint: t('an.sub.count', { n: each.count }) }));
    const chosen = await pickFrom({ container: this.#o.container, inertTargets: this.#o.inertTargets, t,
      title: t('an.sub.valueTitle', { label: criterion.label }),
      items, none: t('an.noneFound') });
    if (chosen !== null) { this.#values = [...this.#values, chosen]; this.#say(''); this.#paint(); }
    this.#focus('sub-add');
  }

  #create() {
    const criterion = this.#criterion;
    const problem = this.#problem(this.#o.count({ key: this.#key, values: this.#values }));
    if (problem) { this.#say(this.#o.t(problem)); return; }
    this.#done({ name: this.#name.trim(), sub: { key: this.#key, label: criterion.label, values: [...this.#values] } });
  }
}
