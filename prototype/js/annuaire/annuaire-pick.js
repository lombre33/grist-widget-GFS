// « Choisir une personne dans l'annuaire » (module Annuaire, demande du porteur du 25/11, scène 15 de la maquette ; contrats 5.4, point 16) : la fenêtre que
// GFS ouvre quand une app demande une personne (`choisirPersonne`). Une liste avec recherche (mots dans n'importe quel ordre, accents et casse ignorés), le
// choix de l'annuaire (« Tous mes annuaires » quand il y en a plusieurs) et un seul choix, rendu tel quel : `{ nom, email, titre, telephone, annuaire }`. La
// fenêtre ne lit rien : le contrôle (js/annuaire/annuaire-control.js) lui donne les personnes que la personne qui choisit lit déjà. Une fenêtre du widget sur
// la base commune (js/ui/modal.js).

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openModal, LIST_SHOWN } from '../ui/modal.js';
import { pickFrom } from '../ui/pick-window.js';
import { filterPeople } from './annuaire-model.js';

// La personne que l'app reçoit (5.4, point 16) : des textes, jamais autre chose de la fiche. `origin` : le nom de l'annuaire d'où elle vient.
export function personPayload(person, origin) {
  return { nom: String(person.name || ''), email: String(person.email || ''), titre: String(person.title || ''), telephone: String(person.phone || ''),
    annuaire: String(origin || '') };
}

export class PickWindow {
  #o;
  #group = 0;
  #query = '';
  #row = null;
  #refs = {};
  #done = null;

  // opts : { container, inertTargets(), t, title (le texte de l'app, déjà traduit, ou ''), app (son nom, ou ''), groups: [{ label, people, path(personne) ->
  //   son
  //   rattachement, montré sur sa ligne, origin(personne) -> le nom de l'annuaire d'où elle vient, que l'app reçoit }] (le premier est celui qui s'ouvre),
  //   problem (un texte à dire à la place de la liste, ou '') }
  constructor(opts) { this.#o = opts; }

  get #current() { return this.#o.groups[this.#group] || { label: '', people: [], path: () => '', origin: () => '' }; }

  // Rend la personne choisie (le texte de `personPayload`), ou `null` quand la personne renonce.
  run() {
    const t = this.#o.t;
    const refs = this.#refs = { from: h('button', { type: 'button', class: 'an-pickbtn an-pk-from', 'aria-haspopup': 'dialog', title: t('an.pick.fromTip'),
      dataset: { act: 'pk-from', fk: 'pk-from' } }), search: h('input', { type: 'search', autocomplete: 'off', placeholder: t('an.pick.search'),
      'aria-label': t('an.pick.search'), dataset: { fk: 'pk-search' } }),
    list: h('div', { class: 'an-pk-list', role: 'radiogroup', 'aria-label': t('an.pick.list') }),
    note: h('p', { class: 'mod-note an-set-note', 'aria-live': 'polite' }),
    only: h('span', { class: 'an-pk-only' }, icon('shield'), h('span', null, t(this.#o.app ? 'an.pick.only' : 'an.pick.onlyNoApp', { app: this.#o.app }))),
    cancel: h('button', { type: 'button', class: 'btn', dataset: { fk: 'pk-cancel' } }, t('an.set.cancel')),
    ok: h('button', { type: 'button', class: 'btn primary', dataset: { fk: 'pk-ok' } }, t('an.pick.choose')) };
    const head = h('header', { class: 'mod-head an-ed-head' }, icon('annuaire', 'an-pk-ic'), h('h2', { id: 'an-pk-title' }, t('an.pick.title')),
      this.#o.title ? h('small', { class: 'an-sub-of' }, this.#o.title) : null);
    const bar = h('div', { class: 'an-pk-bar' }, this.#o.groups.length > 1 ? refs.from : null,
      h('label', { class: 'inp-search an-pk-search' }, icon('search'), refs.search));
    const section = h('section', { class: 'mod an-set an-pk', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'an-pk-title' }, head,
      h('div', { class: 'mod-body an-pk-body' }, this.#o.problem ? h('p', { class: 'an-note an-pk-problem' }, this.#o.problem) : bar, refs.list),
      h('footer', { class: 'mod-foot an-pk-foot' }, refs.only, refs.note, refs.cancel, refs.ok));
    const { done, result } = openModal({ container: this.#o.container, section, inertTargets: this.#o.inertTargets, first: refs.search, cancel: null });
    this.#done = done;
    refs.search.addEventListener('input', () => { this.#query = refs.search.value; this.#paint(); });
    refs.search.addEventListener('keydown', event => this.#searchKey(event));
    refs.from.addEventListener('click', () => void this.#pickGroup());
    refs.list.addEventListener('click', event => this.#click(event));
    refs.list.addEventListener('dblclick', event => { if (this.#rowOf(event)) this.#choose(); });
    refs.list.addEventListener('keydown', event => this.#listKey(event));
    refs.cancel.addEventListener('click', () => done(null));
    refs.ok.addEventListener('click', () => this.#choose());
    this.#paint();
    return result;
  }

  // L'app qui demandait n'est plus là : la fenêtre se ferme sans rien rendre.
  cancel() { if (this.#done) this.#done(null); }

  // ---------- ce qui se voit ----------

  #found() { return filterPeople(this.#current.people, { query: this.#query, filters: {} }); }

  #paint() {
    const { t } = this.#o;
    const { from, list, ok, note } = this.#refs;
    from.replaceChildren(h('span', { class: 'an-pk-from-l' }, t('an.pick.from')), h('b', { class: 'an-pk-from-t' }, this.#current.label), icon('chev-down'));
    const found = this.#found();
    const rows = found.slice(0, LIST_SHOWN);
    if (this.#row !== null && !rows.some(person => person.row === this.#row)) this.#row = null;
    const stop = Math.max(0, rows.findIndex(person => person.row === this.#row));
    const path = this.#current.path;
    list.replaceChildren(...rows.map((person, at) => h('button', { type: 'button', class: 'an-pk-row', role: 'radio',
      'aria-checked': String(person.row === this.#row),
      tabindex: at === stop ? '0' : '-1', dataset: { act: 'pk-row', row: String(person.row), fk: `pk:${person.row}` } },
    h('span', { class: 'an-pk-radio', 'aria-hidden': 'true' }), h('span', { class: 'an-av' }, person.initials || ''),
    h('span', { class: 'an-pe-text' }, h('span', { class: 'an-pe-name' }, person.name), person.title ? h('span', { class: 'an-pe-sub' }, person.title) : null),
    h('span', { class: 'an-pk-path', title: path(person) }, path(person)))),
    ...(found.length > rows.length ? [h('p', { class: 'an-note' }, t('an.pick.more', { n: LIST_SHOWN }))] : []),
    ...(found.length ? [] : [h('p', { class: 'an-note' }, t(this.#current.people.length ? 'an.pick.none' : 'an.pick.empty'))]));
    ok.setAttribute('aria-disabled', this.#row === null ? 'true' : 'false');
    note.textContent = '';
  }

  // ---------- les gestes ----------

  #rowOf(event) {
    const button = event.target.closest('[data-act="pk-row"]');
    if (!button) return null;
    this.#row = Number(button.dataset.row);
    for (const each of this.#refs.list.querySelectorAll('[data-act="pk-row"]')) each.setAttribute('aria-checked', String(each === button));
    this.#refs.ok.setAttribute('aria-disabled', 'false');
    this.#refs.note.textContent = '';
    return button;
  }

  #click(event) { this.#rowOf(event); }

  // ↓ depuis la recherche : la première ligne ; Entrée : choisir la personne sélectionnée (ou la seule trouvée).
  #searchKey(event) {
    const first = this.#refs.list.querySelector('[data-act="pk-row"]');
    if (event.key === 'ArrowDown' && first) { event.preventDefault(); first.focus(); if (this.#row === null) first.click(); } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.#row === null && this.#found().length === 1 && first) first.click();
      this.#choose();
    }
  }

  #listKey(event) {
    const rows = [...this.#refs.list.querySelectorAll('[data-act="pk-row"]')];
    const at = rows.indexOf(this.#refs.list.ownerDocument.activeElement);
    if (at < 0) return;
    const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: rows.length - 1 }[event.key];
    if (to !== undefined) {
      event.preventDefault();
      if (to < 0) { this.#refs.search.focus(); return; }
      const next = rows[Math.min(rows.length - 1, to)];
      for (const row of rows) row.tabIndex = row === next ? 0 : -1;
      next.focus();
      next.click();
    } else if (event.key === 'Enter') { event.preventDefault(); this.#choose(); }
  }

  async #pickGroup() {
    const { t } = this.#o;
    const items = this.#o.groups.map((group, at) => ({ value: String(at), label: group.label, glyph: 'annuaire',
      hint: t('an.count', { n: group.people.length }) }));
    const chosen = await pickFrom({ container: this.#o.container, inertTargets: this.#o.inertTargets, t, title: t('an.pick.fromTip'), items,
      current: String(this.#group),
      none: t('an.noneFound') });
    if (chosen !== null && Number(chosen) !== this.#group) { this.#group = Number(chosen); this.#row = null; this.#paint(); }
    this.#refs.from.focus({ preventScroll: true });
  }

  #choose() {
    const person = this.#row === null ? null : this.#current.people.find(each => each.row === this.#row);
    if (!person) { this.#refs.note.textContent = this.#o.t('an.pick.needOne'); return; }
    this.#done(personPayload(person, this.#current.origin(person)));
  }
}
