// La fenêtre « À vérifier » (module Annuaire, demande du porteur du 25/11, scène 12 de la maquette) : à gauche les contrôles allumés avec leur nombre de
// points, à droite les fiches qui méritent un coup d'œil, chacune avec le geste qui convient (ouvrir la fiche, la modifier, comparer deux doublons, masquer une
// personne partie). Rien n'est changé tout seul : un geste ouvre la fenêtre « Modifier » (relecture avant d'écrire) ou écrit un seul oui/non, sur le clic. Une
// fenêtre du widget sur la base commune (js/ui/modal.js) ; elle ne parle pas à Grist : les contrôles sont à js/annuaire/annuaire-check.js, les gestes sont ceux
// que le contrôle lui donne. Rend quand la personne la ferme.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openModal } from '../ui/modal.js';
import { CHECK_KINDS } from './annuaire-config.js';
import { compareRows } from './annuaire-check.js';

const GLYPHS = Object.freeze({ dup: 'copy', mail: 'mail', att: 'stack', resp: 'user', dep: 'clock' });
const issueKey = issue => `${issue.kind}:${issue.rows.join('-')}:${issue.why || ''}`;

export class CheckWindow {
  #o;
  #result;
  #kind = 'all';
  #compared = '';
  #busy = false;
  #flash = ''; // la phrase du pied après un geste ; elle s'efface au geste suivant
  #refs = {};
  #done = null;

  // opts : { container, inertTargets(), t, locale, name (l'annuaire), result (le contrôle : voir runChecks), config, person(ligne) -> la personne ou rien,
  //   canHide (« Ma
  //   présence » est allumée), format(colonne, valeur) -> le texte d'une valeur de champ, open(ligne), edit(ligne) -> Promise<vrai si la fiche est écrite>,
  //   hide(ligne) -> Promise<vrai si elle est masquée>,
  //   recheck() -> Promise<résultat> }
  constructor(opts) {
    this.#o = opts;
    this.#result = opts.result;
  }

  // La fenêtre : rend une promesse, tenue quand elle se ferme.
  run() {
    const t = this.#o.t;
    const refs = this.#refs = { kinds: h('nav', { class: 'an-chk-kinds', 'aria-label': t('an.check.kinds') }), list: h('div', { class: 'an-chk-list' }),
      note: h('p', { class: 'mod-note an-set-note', 'aria-live': 'polite' }),
      again: h('button', { type: 'button', class: 'btn sm', dataset: { act: 'chk-again', fk: 'chk-again' } }, icon('search'), t('an.check.recheck')),
      close: h('button', { type: 'button', class: 'btn', dataset: { fk: 'chk-close' } }, t('an.close')) };
    const section = h('section', { class: 'mod an-set an-chk', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'an-chk-title' },
      h('header', { class: 'mod-head an-ed-head' }, h('h2', { id: 'an-chk-title' }, t('an.check.title')), h('span', { class: 'an-ed-who' }, this.#o.name),
        h('span', { class: 'an-grow' }), refs.again),
      h('div', { class: 'mod-body an-set-body an-chk-body' }, refs.kinds, refs.list), h('footer', { class: 'mod-foot' }, refs.note, refs.close));
    this.#paint();
    const { done, result } = openModal({ container: this.#o.container, section, inertTargets: this.#o.inertTargets, first: refs.close, cancel: null });
    this.#done = done;
    refs.close.addEventListener('click', () => done(true));
    section.addEventListener('click', event => this.#click(event));
    refs.kinds.addEventListener('keydown', event => this.#kindKeys(event));
    return result.then(() => undefined);
  }

  // ---------- ce qui se voit ----------

  #paint() {
    const doc = this.#refs.list.ownerDocument;
    const kept = doc.activeElement && this.#refs.list.contains(doc.activeElement) ? doc.activeElement.dataset.fk : null;
    const top = this.#refs.list.scrollTop;
    this.#paintKinds();
    this.#paintList();
    this.#refs.list.scrollTop = top;
    const again = kept && [...this.#refs.list.querySelectorAll('[data-fk]')].find(node => node.dataset.fk === kept);
    if (again) again.focus({ preventScroll: true });
    this.#paintNote();
  }

  // Le pied : la phrase du dernier geste, sinon combien de points restent à vérifier.
  #paintNote() {
    const { total } = this.#result;
    this.#refs.note.textContent = this.#flash || this.#o.t(total ? 'an.check.foot' : 'an.check.none', { n: total });
  }

  #say(text) {
    this.#flash = text;
    this.#paintNote();
  }

  #paintKinds() {
    const { t } = this.#o;
    const { counts, total } = this.#result;
    const kinds = CHECK_KINDS.filter(kind => kind in counts);
    const item = (id, label, count) => h('button', { type: 'button', class: 'an-chk-k', 'aria-pressed': String(this.#kind === id),
      dataset: { act: 'chk-kind', kind: id, fk: `ck:${id}` } }, h('span', { class: 'an-chk-kt' }, label), h('span', { class: 'an-pill' }, String(count)));
    this.#refs.kinds.replaceChildren(item('all', t('an.check.all'), total), ...kinds.map(kind => item(kind, t(`an.check.kind.${kind}`), counts[kind])));
  }

  #paintList() {
    const { t } = this.#o;
    const issues = this.#result.issues.filter(issue => this.#kind === 'all' || issue.kind === this.#kind);
    if (!issues.length) { this.#refs.list.replaceChildren(h('p', { class: 'an-note an-chk-none' }, icon('check'), t('an.check.none'))); return; }
    this.#refs.list.replaceChildren(...issues.map(issue => this.#issue(issue)));
  }

  // Le texte qui dit pourquoi une fiche est relevée.
  #why(issue) {
    const { t, locale } = this.#o;
    if (issue.kind === 'dup') return t(issue.why === 'mail' ? 'an.check.why.dupMail' : 'an.check.why.dupName', { others: issue.others.join(', ') });
    if (issue.kind === 'resp') return t({ self: 'an.check.why.respSelf', cycle: 'an.check.why.respCycle' }[issue.why] || 'an.check.why.respMissing',
      { row: issue.manager });
    if (issue.kind === 'dep') {
      const date = new Date(`${issue.day}T12:00:00Z`);
      return t('an.check.why.dep', { day: Number.isNaN(date.getTime()) ? issue.day :
        date.toLocaleDateString(locale, { dateStyle: 'medium', timeZone: 'UTC' }) });
    }
    return t(`an.check.why.${issue.kind}`);
  }

  // Les gestes d'une ligne : le premier est le principal.
  #gestures(issue) {
    const { t, canHide } = this.#o;
    const key = issueKey(issue);
    const button = (act, label, extra = {}, primary = false) => h('button', { type: 'button', class: `btn sm${primary ? ' primary' : ''}`,
      'aria-disabled': extra.disabled ? 'true' : null, title: extra.title || null, 'aria-expanded': extra.expanded ?? null,
      dataset: { act, row: String(issue.row), key, fk: `${act}:${key}` } }, label);
    const open = button('chk-open', t('an.check.open'));
    if (issue.kind === 'dup') return [button('chk-compare', t(this.#compared === key ? 'an.check.compareClose' : 'an.check.compare'),
      { expanded: String(this.#compared === key) }, true), open];
    if (issue.kind === 'dep') return [button('chk-hide', t('an.check.hide'), { disabled: !canHide, title: canHide ? '' : t('an.check.hideNeeds') }, true),
      open];
    return [button('chk-edit', t('an.check.edit'), {}, true), open];
  }

  #issue(issue) {
    const { t } = this.#o;
    const key = issueKey(issue);
    const row = h('div', { class: 'an-chk-row' }, h('span', { class: 'an-chk-ic' }, icon(GLYPHS[issue.kind])),
      h('div', { class: 'an-chk-t' }, h('b', null, issue.name, h('span', { class: 'an-chk-is' }, ` · ${t(`an.check.is.${issue.kind}`)}`)),
        h('small', null, this.#why(issue))),
      h('span', { class: 'an-chk-acts' }, ...this.#gestures(issue)));
    return h('div', { class: 'an-chk-item' }, row, this.#compared === key ? this.#comparison(issue) : null);
  }

  // Le tableau « Comparer » d'un doublon : une colonne par fiche, les lignes qui diffèrent marquées d'un mot (jamais par la couleur seule).
  #comparison(issue) {
    const { t, config } = this.#o;
    const found = issue.rows.map(row => this.#o.person(row)).filter(Boolean);
    const rows = compareRows(found, config, { name: t('an.col.name'), title: t('an.fiche.post'), email: t('an.mail'), phone: t('an.phone') },
      this.#o.format);
    return h('div', { class: 'an-chk-cmp' }, h('table', null, h('thead', null, h('tr', null, h('th', null),
      ...found.map(person => h('th', { scope: 'col' }, person.name)))),
    h('tbody', null, ...rows.map(row => h('tr', { class: row.same ? '' : 'is-diff' }, h('th', { scope: 'row' }, row.label,
      row.same ? null : h('span', { class: 'an-pill' }, t('an.check.diff'))), ...row.values.map(value => h('td', null, value || '—')))))));
  }

  // ---------- les gestes ----------

  #click(event) {
    const button = event.target.closest('[data-act]');
    if (!button || button.getAttribute('aria-disabled') === 'true' || this.#busy) {
      if (button && button.dataset.act === 'chk-hide') this.#say(this.#o.t('an.check.hideNeeds'));
      return;
    }
    const { act, row, key, kind } = button.dataset;
    this.#flash = '';
    if (act === 'chk-kind') { this.#kind = kind; this.#paint(); this.#focus(`ck:${kind}`); }
    else if (act === 'chk-compare') { this.#compared = this.#compared === key ? '' : key; this.#paint(); this.#focus(`chk-compare:${key}`); }
    else if (act === 'chk-open') { this.#done(true); this.#o.open(Number(row)); }
    else if (act === 'chk-edit') void this.#act(() => this.#o.edit(Number(row)), key);
    else if (act === 'chk-hide') void this.#act(() => this.#o.hide(Number(row)), key);
    else if (act === 'chk-again') void this.#again();
  }

  // Un geste qui écrit : la fenêtre « Modifier », ou le masquage ; quand il a écrit, les contrôles se relancent sur la lecture qui suit.
  async #act(run, key) {
    this.#busy = true;
    try {
      if (await run()) { this.#result = await this.#o.recheck(); this.#say(''); }
    } finally {
      this.#busy = false;
    }
    this.#compared = '';
    this.#paint();
    this.#focus(`chk-edit:${key}`, `chk-hide:${key}`, 'chk-again', 'chk-close');
  }

  async #again() {
    this.#busy = true;
    try { this.#result = await this.#o.recheck(); } finally { this.#busy = false; }
    this.#compared = '';
    this.#paint();
    this.#say(this.#o.t('an.check.rechecked'));
    this.#focus('chk-again');
  }

  #focus(...keys) {
    const nodes = [...this.#refs.kinds.querySelectorAll('[data-fk]'), ...this.#refs.list.querySelectorAll('[data-fk]'), this.#refs.again, this.#refs.close];
    for (const key of keys) {
      const node = nodes.find(each => each.dataset.fk === key);
      if (node) { node.focus({ preventScroll: false }); return; }
    }
  }

  // ↑ et ↓ d'un contrôle à l'autre dans la liste de gauche.
  #kindKeys(event) {
    const buttons = [...this.#refs.kinds.querySelectorAll('.an-chk-k')];
    const at = buttons.indexOf(event.target.closest('.an-chk-k'));
    const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: buttons.length - 1 }[event.key];
    if (at < 0 || to === undefined || !buttons[to]) return;
    event.preventDefault();
    buttons[to].focus();
  }
}
