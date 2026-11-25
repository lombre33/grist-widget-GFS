// Le bouton « Filtres » et son panneau (module Annuaire, retour du porteur du 25/11 : « le bouton filtre doit se rapprocher des exemples du suivi de projet ou
// de la maquette de l'annuaire » ; une barre de pastilles qui s'étalait au-dessus de la liste est devenue un bouton, avec le nombre de choix, qui ouvre un
// panneau posé
// dessous : un titre par filtre, une case par valeur avec son nombre de personnes, les filtres au-delà des deux premiers repliés). Les mêmes filtres dans la
//   liste, les cartes et l'organigramme : le bouton est un seul nœud, que la fenêtre pose où elle le veut (le fil de la liste ou la barre de l'organigramme).
//   Le panneau est celui du menu commun (js/ui/menu.js, `openPanel`) : un clic dehors le ferme, Échap aussi (et le clavier revient au bouton) ; la fenêtre le
//   garde ouvert quand une case change, pour qu'on en coche plusieurs sans le rouvrir.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openPanel } from '../ui/menu.js';
import { filterPanel, shown } from './annuaire-panes.js';

// Les valeurs choisies, dites à la personne, d'un filtre à l'autre (« Titulaire, Siège ») : de quoi écrire ce que le pied de la fenêtre montre. `ctx` : { t,
// locale }.
export function activeValues(options, filters, ctx) {
  return options.flatMap(option => [...(filters[option.col] || [])].map(value => shown(value, option.genre, ctx))).join(', ');
}

// La place que le panneau peut prendre sous le bouton : jusqu'au pied de la fenêtre (le pied reste libre : « Réinitialiser » s'y trouve), jamais plus de 420 px
// ni moins de 120 px (au-delà, le panneau défile).
function roomBelow(host, anchor) {
  const foot = host.querySelector('.mod-foot');
  const limit = (foot || host).getBoundingClientRect()[foot ? 'top' : 'bottom'];
  return Math.max(120, Math.min(limit - anchor.getBoundingClientRect().bottom - 12, 420));
}

export class FilterMenu {
  #o;
  #button = null;
  #panel = null;
  #content = null;
  #opened = new Map(); // colonne -> filtre déplié ou non, quand la personne l'a décidé
  #model = { options: [], active: 0 };
  #filters = {};

  // opts : { host() (l'élément qui porte le panneau : la fenêtre), t() (la fonction des textes du moment), locale() }
  constructor(opts) { this.#o = opts; }

  get isOpen() { return this.#panel !== null; }

  // Le bouton, mis à jour pour ce que `model` dit ({ options, active }) ; rien (et le panneau se ferme) quand aucun filtre n'est réglé.
  button(model, filters) {
    this.#model = model;
    this.#filters = filters;
    if (!model.options.length) { this.close(); return null; }
    const t = this.#o.t();
    const label = t('an.filters');
    if (!this.#button) {
      this.#button = h('button', { type: 'button', class: 'btn sm an-tbtn an-fbtn', 'aria-haspopup': 'dialog', 'aria-expanded': 'false',
        dataset: { act: 'filters', fk: 'filters' } });
    }
    const button = this.#button;
    button.classList.toggle('is-on', model.active > 0);
    button.title = label;
    button.setAttribute('aria-label', model.active ? `${label} (${model.active})` : label);
    button.replaceChildren(...[icon('filter'), h('span', { class: 'an-tb-t' }, label),
      model.active ? h('b', { class: 'an-badge' }, String(model.active)) : null].filter(Boolean));
    this.#refresh();
    return button;
  }

  // Ce que les filtres de `model` disent des choix en cours, pour le pied de la fenêtre.
  summary(model, filters) { return activeValues(model.options, filters, { t: this.#o.t(), locale: this.#o.locale() }); }

  toggle() {
    if (this.#panel) { this.close(); return; }
    if (!this.#button || !this.#button.isConnected) return;
    const host = this.#o.host();
    this.#content = h('div', { class: 'an-fpanel' });
    this.#fill();
    this.#content.style.maxHeight = `${roomBelow(host, this.#button)}px`;
    const left = this.#button.getBoundingClientRect().left - host.getBoundingClientRect().left;
    // Le panneau s'aligne sur le bord du bouton le plus proche du bord de la fenêtre (le fil de la liste : à droite ; la barre de l'organigramme : à gauche).
    this.#panel = openPanel(this.#button, this.#content, { host, align: left < host.getBoundingClientRect().width / 2 ? 'left' : 'right',
      label: this.#o.t()('an.filters'),
      onClose: () => { this.#panel = null; this.#content = null; } }).close;
    const first = this.#content.querySelector('[aria-checked="true"]') || this.#content.querySelector('button');
    if (first) first.focus({ preventScroll: true });
  }

  close() {
    if (this.#panel) this.#panel();
  }

  // Un filtre qu'on replie ou déplie : ce que la personne a décidé prend le pas sur le réglage par défaut.
  toggleSection(col) {
    const head = this.#content && this.#content.querySelector(`[data-fk="fs:${col}"]`);
    if (!head) return;
    this.#opened.set(col, head.getAttribute('aria-expanded') !== 'true');
    this.#refresh(`fs:${col}`);
  }

  // Les filtres ont changé (une case, une autre recherche, une autre langue) : le panneau ouvert se redessine sur place, sans perdre sa position ni le clavier.
  refresh() { this.#refresh(); }

  #fill() {
    this.#content.replaceChildren(filterPanel(this.#model.options, this.#filters, { t: this.#o.t(), locale: this.#o.locale(), opened: this.#opened }));
  }

  #refresh(focusKey = null) {
    const content = this.#content;
    if (!content) return;
    const doc = content.ownerDocument;
    const kept = focusKey || (doc.activeElement && content.contains(doc.activeElement) ? doc.activeElement.dataset.fk : null);
    const top = content.scrollTop;
    this.#fill();
    content.scrollTop = top;
    const again = kept && [...content.querySelectorAll('[data-fk]')].find(node => node.dataset.fk === kept);
    if (again) again.focus({ preventScroll: true });
  }
}
