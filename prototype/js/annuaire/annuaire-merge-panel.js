// Le panneau « Annuaires affichés » de la vue fusionnée (module Annuaire, demande du porteur du 25/11, scène 11 de la maquette) : une case par annuaire du
// document (avec le nombre de personnes qu'il montre et, pour une copie verrouillée, la mention « Sous-annuaire »), la phrase qui dit qu'une adresse ne fait
// qu'une fiche, et le moyen de revenir à un seul annuaire. Le panneau est celui du menu commun (js/ui/menu.js, `openPanel`), comme celui des filtres
// (js/annuaire/annuaire-filters.js) : un clic dehors le ferme, Échap aussi ; la fenêtre le garde ouvert quand une case change, pour qu'on en coche plusieurs
// sans le rouvrir.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openPanel } from '../ui/menu.js';

// Le contenu du panneau. `model` : { sources: [{ row, name, sub, count, on }], joined } ; `t` : les textes.
export function mergeContent(model, t) {
  const rows = model.sources.map(source => h('button', { type: 'button', class: 'an-fv', role: 'checkbox', 'aria-checked': String(source.on),
    title: source.name,
    dataset: { act: 'merge-pick', row: String(source.row), fk: `mp:${source.row}` } },
  h('span', { class: 'an-box', 'aria-hidden': 'true' }, source.on ? icon('check') : null),
  h('span', { class: 'an-fv-t' }, source.name, source.sub ? h('span', { class: 'an-pill an-mp-tag' }, t('an.sub.tag')) : null),
  h('span', { class: 'an-fv-n' }, String(source.count))));
  const same = [t('an.merge.same'), model.joined ? t('an.merge.joined', { n: model.joined }) : ''].filter(Boolean).join(' · ');
  return h('div', { class: 'an-fpanel an-mp' }, h('div', { class: 'an-mp-h' }, t('an.merge.shown')),
    h('div', { role: 'group', 'aria-label': t('an.merge.shown') }, ...rows),
    h('p', { class: 'an-note an-mp-note' }, same),
    h('button', { type: 'button', class: 'an-fv an-mp-one', dataset: { act: 'merge-one', fk: 'mp-one' } }, icon('annuaire'),
      h('span', { class: 'an-fv-t' }, t('an.merge.one')),
      icon('chev-right')));
}

export class MergePanel {
  #o;
  #close = null;
  #content = null;
  #model = { sources: [], joined: 0 };

  // opts : { host() (l'élément qui porte le panneau : la fenêtre), t() (la fonction des textes du moment) }
  constructor(opts) { this.#o = opts; }

  get isOpen() { return this.#close !== null; }

  // Ouvre le panneau sous `anchor` (le bouton du nom de l'annuaire) ; un second appel le ferme.
  toggle(anchor, model) {
    if (this.#close) { this.close(); return; }
    this.#model = model;
    this.#content = h('div', { class: 'an-mpw' });
    this.#fill();
    this.#close = openPanel(anchor, this.#content, { host: this.#o.host(), align: 'left', label: this.#o.t()('an.merge.shown'),
      onClose: () => { this.#close = null; this.#content = null; } }).close;
    const first = this.#content.querySelector('button');
    if (first) first.focus({ preventScroll: true });
  }

  close() { if (this.#close) this.#close(); }

  // Les cases ont changé (ou la langue) : le panneau ouvert se redessine sur place, sans perdre le clavier ; fermé, il garde ce que dit `model`.
  refresh(model) {
    this.#model = model;
    const content = this.#content;
    if (!content) return;
    const doc = content.ownerDocument;
    const kept = doc.activeElement && content.contains(doc.activeElement) ? doc.activeElement.dataset.fk : null;
    this.#fill();
    const again = kept && [...content.querySelectorAll('[data-fk]')].find(node => node.dataset.fk === kept);
    if (again) again.focus({ preventScroll: true });
  }

  #fill() { this.#content.replaceChildren(mergeContent(this.#model, this.#o.t())); }
}
