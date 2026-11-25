// La fenêtre « Écrire au groupe » (module Annuaire, demande du porteur du 25/11, scène 14 de la maquette : « attention aux ~2 000 caractères d'un lien de
// messagerie ») : les personnes affichées, la longueur du lien qu'elles donneraient, et ce qui marche à coup sûr : copier toutes les adresses (aucune limite,
// pour les coller en Cci), ouvrir plusieurs messages de `per` adresses au plus (le réglage de l'annuaire), ouvrir un seul message quand il tient (grisé, avec
// sa raison, sinon), exporter la liste en CSV. La jauge le dit avant qu'un message s'ouvre coupé. Les adresses ne quittent pas le navigateur : un lien
// « mailto: » ouvre la messagerie de la personne, GFS n'envoie rien. Une fenêtre du widget sur la base commune (js/ui/modal.js) ; le calcul est à
// js/annuaire/annuaire-mail.js.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openModal } from '../ui/modal.js';
import { addressesOf, mailLink, mailPlan, csvOf, csvName } from './annuaire-mail.js';

export class MailWindow {
  #o;
  #addresses;
  #plan;
  #opened = 0; // combien de messages de la série sont déjà ouverts (le suivant se dégrise)
  #refs = {};

  // opts : { container, inertTargets(), t, locale (la langue des nombres), name (l'annuaire), people (les personnes affichées), options ({ per, to }), columns
  //   (celles de l'export : voir csvColumns),
  //   copy(texte) -> Promise<vrai si copié>, save(nom, texte, type) (offre le fichier au navigateur), day() -> « AAAA-MM-JJ » }
  constructor(opts) {
    this.#o = opts;
    this.#addresses = addressesOf(opts.people);
    this.#plan = mailPlan(this.#addresses, { per: opts.options.per, to: opts.options.to });
  }

  run() {
    const t = this.#o.t;
    const n = this.#o.people.length;
    const refs = this.#refs = { body: h('div', { class: 'mod-body an-set-body an-mail-body' }),
      note: h('p', { class: 'mod-note an-set-note', 'aria-live': 'polite' }),
      close: h('button', { type: 'button', class: 'btn', dataset: { fk: 'mail-close' } }, t('an.close')) };
    const section = h('section', { class: 'mod an-set an-mail', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'an-mail-title' },
      h('header', { class: 'mod-head an-ed-head' }, h('h2', { id: 'an-mail-title' }, t('an.mail.title', { n }))), refs.body,
      h('footer', { class: 'mod-foot' }, refs.note, refs.close));
    this.#paint();
    refs.note.textContent = t('an.mail.foot');
    const { done, result } = openModal({ container: this.#o.container, section, inertTargets: this.#o.inertTargets, first: refs.close, cancel: null });
    refs.close.addEventListener('click', () => done(true));
    refs.body.addEventListener('click', event => this.#click(event));
    return result.then(() => undefined);
  }

  get #toLabel() { return this.#o.t(this.#o.options.to === 'to' ? 'an.opt.toPlain' : 'an.opt.bcc'); }

  // ---------- ce qui se voit ----------

  #paint() {
    const doc = this.#refs.body.ownerDocument;
    const kept = doc.activeElement && this.#refs.body.contains(doc.activeElement) ? doc.activeElement.dataset.fk : null;
    this.#refs.body.replaceChildren(this.#gauge(), this.#copyOption(), this.#batchOption(), this.#singleOption(), this.#exportOption());
    const again = kept && [...this.#refs.body.querySelectorAll('[data-fk]')].find(node => node.dataset.fk === kept);
    if (again) again.focus({ preventScroll: true });
  }

  // La jauge : la longueur du lien que donneraient toutes les adresses, et la limite au-delà de laquelle des messageries le coupent.
  #gauge() {
    const { t, locale } = this.#o;
    const { count, length, limit, fits } = this.#plan;
    const over = count > 0 && !fits;
    const scale = Math.max(length, limit);
    const missing = this.#o.people.filter(person => !String(person.email || '').trim()).length;
    const text = t('an.mail.count', { n: count, length: length.toLocaleString(locale) });
    return h('div', { class: 'an-mbar' }, h('div', { class: 'an-mbar-t' }, h('b', null, text), h('span', { class: over ? 'is-over' : '' },
      t('an.mail.limit', { limit: limit.toLocaleString(locale) }))),
    h('div', { class: 'an-mbar-b', role: 'img', 'aria-label': `${t('an.mail.gauge')} : ${text}`, dataset: { over: String(over) },
      vars: { '--fill': `${Math.round((length / scale) * 100)}%`, '--limit': `${Math.round((limit / scale) * 100)}%` } }, h('i'), h('u')),
    h('p', { class: `an-set-hint an-mbar-s${over ? ' is-over' : ''}` }, t(count ? (fits ? 'an.mail.fits' : 'an.mail.over') : 'an.mail.noAddress')),
    missing > 0 ? h('p', { class: 'an-set-hint' }, t('an.mail.missing', { n: missing })) : null);
  }

  // Une ligne d'option : l'icône, le titre, l'aide, les boutons.
  #option({ glyph, title, hint, grey = false, buttons }) {
    return h('div', { class: `an-mopt${grey ? ' is-off' : ''}` }, h('span', { class: 'an-mopt-i' }, icon(glyph)),
      h('div', { class: 'an-mopt-t' }, h('b', null, title), h('small', null, hint)), h('span', { class: 'an-mopt-b' }, ...buttons));
  }

  #copyOption() {
    const t = this.#o.t;
    const none = this.#addresses.length === 0;
    return this.#option({ glyph: 'copy', title: t('an.mail.copy', { n: this.#addresses.length }), hint: t('an.mail.copyHint', { to: this.#toLabel }),
      grey: none,
      buttons: [h('button', { type: 'button', class: 'btn sm primary', 'aria-disabled': none ? 'true' : null, dataset: { act: 'mail-copy', fk: 'mail-copy' } },
        t('an.mail.copyButton'))] });
  }

  // Un lien « mailto: » : un vrai lien (clic du milieu, clavier), qui ouvre la messagerie de la personne dans un autre onglet.
  #link(batch, label, extra) {
    return h('a', { class: 'btn sm', href: mailLink(batch, this.#o.options.to), target: '_blank', rel: 'noopener', dataset: extra }, ...[].concat(label));
  }

  // Le bouton d'un lien qu'on ne peut pas ouvrir : grisé, avec sa raison (jamais retiré).
  #locked(label, why, fk) {
    return h('button', { type: 'button', class: 'btn sm', 'aria-disabled': 'true', title: why, dataset: { act: 'mail-locked', why, fk } }, label);
  }

  #batchOption() {
    const t = this.#o.t;
    const { batches, fits } = this.#plan;
    const many = batches.length > 1 && !fits;
    const buttons = batches.map((batch, i) => {
      const label = t('an.mail.batch', { i: i + 1, n: batches.length });
      if (!many) return this.#locked(label, t('an.mail.batchesFit'), `mail-b:${i}`);
      if (i > this.#opened) return this.#locked(label, t('an.mail.batchFirst', { k: i }), `mail-b:${i}`);
      return this.#link(batch, [i < this.#opened ? icon('check') : null, label].filter(Boolean), { act: 'mail-batch', index: String(i), fk: `mail-b:${i}` });
    });
    return this.#option({ glyph: 'mail', title: t('an.mail.batches', { n: Math.max(batches.length, 1), per: this.#o.options.per }),
      hint: t(many ? 'an.mail.batchesHint' : 'an.mail.batchesFit'), grey: !many, buttons });
  }

  #singleOption() {
    const t = this.#o.t;
    const { fits, count, batches } = this.#plan;
    const button = fits ? this.#link(batches[0], t('an.mail.open'), { act: 'mail-single', fk: 'mail-single' }) :
      this.#locked(t('an.mail.open'), t(count ? 'an.mail.singleNo' : 'an.mail.noAddress', { n: count }), 'mail-single');
    return this.#option({ glyph: 'mail', title: t('an.mail.single'), hint: fits ? t('an.mail.singleHint', { n: count, to: this.#toLabel }) :
      t(count ? 'an.mail.singleNo' : 'an.mail.noAddress', { n: count }), grey: !fits, buttons: [button] });
  }

  #exportOption() {
    const t = this.#o.t;
    return this.#option({ glyph: 'download', title: t('an.mail.export'), hint: t('an.mail.exportHint'),
      buttons: [h('button', { type: 'button', class: 'btn sm', dataset: { act: 'mail-export', fk: 'mail-export' } }, t('an.mail.exportButton'))] });
  }

  // ---------- les gestes ----------

  #say(text) { this.#refs.note.textContent = text; }

  #click(event) {
    const button = event.target.closest('[data-act]');
    if (!button) return;
    const { act, why } = button.dataset;
    if (act === 'mail-locked') { this.#say(why); return; }
    if (button.getAttribute('aria-disabled') === 'true') return;
    if (act === 'mail-copy') void this.#copy();
    else if (act === 'mail-export') this.#export();
    else if (act === 'mail-batch') {
      // le lien s'ouvre d'abord (le clic n'est pas retenu), puis la série avance d'un cran
      const next = Number(button.dataset.index) + 1;
      setTimeout(() => { this.#opened = Math.max(this.#opened, next); this.#paint(); }, 0);
      this.#say(this.#o.t('an.mail.foot'));
    } else if (act === 'mail-single') this.#say(this.#o.t('an.mail.foot'));
  }

  async #copy() {
    const t = this.#o.t;
    const copied = await this.#o.copy(this.#addresses.join('; '));
    this.#say(copied ? t('an.mail.copied', { n: this.#addresses.length }) : t('an.copyFailed'));
  }

  #export() {
    const t = this.#o.t;
    const name = csvName(this.#o.name, this.#o.day());
    this.#o.save(name, csvOf(this.#o.people, this.#o.columns), 'text/csv;charset=utf-8');
    this.#say(t('an.mail.exported', { name, n: this.#o.people.length }));
  }
}
