// Les filtres de l'annuaire et leur menu (module Annuaire, retour du porteur du 25/11 : « le bouton filtre doit se rapprocher des exemples du suivi de projet
// ou de la maquette de l'annuaire » ; une barre de pastilles qui s'étalait au-dessus de la liste est devenue un bouton, avec le nombre de choix, qui ouvre un
// panneau posé dessous : un titre par filtre, une case par valeur avec son nombre de personnes, les filtres au-delà des deux premiers repliés). Les mêmes
// filtres
//   dans la liste, les cartes et l'organigramme : le bouton est un seul nœud, que la fenêtre pose où elle le veut (le fil de la liste ou la barre de
//   l'organigramme).
//   Le panneau est celui du menu commun (js/ui/menu.js, `openPanel`) : un clic dehors le ferme, Échap aussi (et le clavier revient au bouton) ; la fenêtre le
//   garde ouvert quand une case change, pour qu'on en coche plusieurs sans le rouvrir.
//
// Deuxième présentation, au choix de chaque annuaire (retour du porteur, 25/11 : « en mode horizontal avec le nom de chaque champ, comme l'annuaire PUI ») : la
// barre. Une rangée de boutons, un par filtre, qui porte son nom et le nombre de choix ; chacun ouvre le menu de ses valeurs, avec sa recherche. Elle est un
// seul nœud aussi (`bar`). Dans les deux présentations, chaque filtre a sa recherche, et « Réinitialiser » est là dès qu'une valeur est cochée. Le contenu
// (js/annuaire/annuaire-filter-panel.js) est redessiné sur place à chaque changement : la frappe garde son champ, son curseur et la position.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openPanel } from '../ui/menu.js';
import { shown } from './annuaire-panes.js';
import { filterPanel, filterMenuContent, resetButton } from './annuaire-filter-panel.js';

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

// Pose `node` dans `slot` sans le déplacer quand il y est déjà (un nœud qu'on retire de la page perd le clavier) ; sans nœud, `slot` se vide (et se cache :
// voir `:empty` dans css/annuaire.css).
export function place(slot, node) {
  if (!node) slot.replaceChildren();
  else if (node.parentNode !== slot) slot.replaceChildren(node);
}

export class FilterMenu {
  #o;
  #button = null;
  #bar = null;
  #reset = null; // « Réinitialiser » de la barre (un seul nœud)
  #barButtons = new Map(); // colonne -> son bouton dans la barre
  #panel = null;
  #content = null;
  #openCol = null; // le filtre dont le menu est ouvert (la barre), ou null pour le panneau
  #opened = new Map(); // colonne -> filtre déplié ou non, quand la personne l'a décidé
  #search = new Map(); // colonne -> ce qui est tapé dans la recherche du filtre (jusqu'à la fermeture)
  #model = { options: [], active: 0, mode: 'panel' };
  #filters = {};

  // opts : { host() (l'élément qui porte le panneau : la fenêtre), t() (la fonction des textes du moment), locale() }
  constructor(opts) { this.#o = opts; }

  get isOpen() { return this.#panel !== null; }

  // Le bouton, mis à jour pour ce que `model` dit ({ options, active, mode }) ; rien (et le panneau se ferme) quand aucun filtre n'est réglé, et rien non plus
  // quand l'annuaire montre ses filtres en barre.
  button(model, filters) {
    this.#model = model;
    this.#filters = filters;
    if (!model.options.length || model.mode === 'bar') { if (this.#openCol === null) this.close(); return null; }
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

  // La barre : un bouton par filtre (son nom, le nombre de choix) puis « Réinitialiser ». Les boutons gardent leur nœud d'un dessin à l'autre : un menu ouvert
  // reste accroché au sien, et le clavier ne perd pas son bouton.
  bar(model, filters) {
    this.#model = model;
    this.#filters = filters;
    if (!model.options.length || model.mode !== 'bar') { if (this.#openCol !== null) this.close(); return null; }
    const t = this.#o.t();
    this.#bar ??= h('div', { class: 'an-fbar', role: 'group' });
    this.#bar.setAttribute('aria-label', t('an.filters'));
    const cols = new Set(model.options.map(option => option.col));
    for (const [col, node] of this.#barButtons) if (!cols.has(col)) { node.remove(); this.#barButtons.delete(col); }
    const wanted = [...model.options.map(option => this.#barButton(option, t)), this.#barReset(model.active, t)];
    if (this.#bar.children.length !== wanted.length || wanted.some((node, at) => this.#bar.children[at] !== node)) this.#bar.replaceChildren(...wanted);
    this.#refresh();
    return this.#bar;
  }

  #barButton(option, t) {
    const on = this.#filters[option.col] ? this.#filters[option.col].size : 0;
    let node = this.#barButtons.get(option.col);
    if (!node) {
      node = h('button', { type: 'button', class: 'btn sm an-tbtn an-fb', 'aria-haspopup': 'dialog', 'aria-expanded': String(this.#openCol === option.col),
        dataset: { act: 'filter-menu', col: option.col, fk: `fb:${option.col}` } });
      this.#barButtons.set(option.col, node);
    }
    const label = option.label || option.col;
    node.classList.toggle('is-on', on > 0);
    node.title = on ? `${label} (${on})` : label;
    node.setAttribute('aria-label', on ? `${label} (${on})` : label);
    node.replaceChildren(...[h('span', { class: 'an-fb-t' }, label), on ? h('b', { class: 'an-badge' }, String(on)) : null, icon('chev-down')].filter(Boolean));
    return node;
  }

  #barReset(active, t) {
    const node = this.#reset ??= resetButton(active, t, ' an-fb-reset');
    if (active) node.removeAttribute('aria-disabled'); else node.setAttribute('aria-disabled', 'true');
    node.title = t(active ? 'an.filters.resetTip' : 'an.filters.resetNone');
    node.textContent = t('an.filters.reset');
    return node;
  }

  // Ce que les filtres de `model` disent des choix en cours, pour le pied de la fenêtre.
  summary(model, filters) { return activeValues(model.options, filters, { t: this.#o.t(), locale: this.#o.locale() }); }

  // Le panneau (le bouton « Filtres ») ou le menu d'un filtre (`col`, un bouton de la barre) : s'ouvre, ou se ferme quand c'est déjà lui.
  toggle(col = null) {
    if (this.#panel) { const same = this.#openCol === col; this.close(); if (same) return; }
    const anchor = col === null ? this.#button : this.#barButtons.get(col);
    if (!anchor || !anchor.isConnected) return;
    const host = this.#o.host();
    this.#openCol = col;
    this.#content = h('div', { class: col === null ? 'an-fpanel' : 'an-fpanel an-fpanel-bar' });
    this.#fill();
    this.#content.style.maxHeight = `${roomBelow(host, anchor)}px`;
    this.#content.addEventListener('input', event => this.#typed(event));
    const left = anchor.getBoundingClientRect().left - host.getBoundingClientRect().left;
    // Le panneau s'aligne sur le bord du bouton le plus proche du bord de la fenêtre (le fil de la liste : à droite ; la barre de l'organigramme : à gauche).
    this.#panel = openPanel(anchor, this.#content, { host, align: left < host.getBoundingClientRect().width / 2 ? 'left' : 'right',
      label: col === null ? this.#o.t()('an.filters') : anchor.getAttribute('aria-label'),
      onClose: () => { this.#panel = null; this.#content = null; this.#openCol = null; this.#search.clear(); } }).close;
    const first = col !== null ? this.#content.querySelector('input') : this.#content.querySelector('[aria-checked="true"]') ||
      this.#content.querySelector('.an-fsec-h');
    if (first) first.focus({ preventScroll: true });
  }

  close() {
    if (this.#panel) this.#panel();
  }

  // Un filtre qu'on replie ou déplie dans le panneau : ce que la personne a décidé prend le pas sur le réglage par défaut.
  toggleSection(col) {
    const head = this.#content && this.#content.querySelector(`[data-fk="fs:${col}"]`);
    if (!head) return;
    this.#opened.set(col, head.getAttribute('aria-expanded') !== 'true');
    this.#refresh(`fs:${col}`);
  }

  // Les filtres ont changé (une case, une autre recherche, une autre langue) : le panneau ouvert se redessine sur place, sans perdre sa position ni le clavier.
  refresh() { this.#refresh(); }

  // La frappe dans la recherche d'un filtre : ses valeurs se réduisent, le champ garde le clavier (et le curseur).
  #typed(event) {
    const box = event.target.closest && event.target.closest('.an-fq');
    if (!box) return;
    this.#search.set(box.dataset.col, box.value);
    this.#refresh(box.dataset.fk);
  }

  #fill() {
    const ctx = { t: this.#o.t(), locale: this.#o.locale(), opened: this.#opened, search: this.#search };
    const option = this.#openCol === null ? null : this.#model.options.find(each => each.col === this.#openCol);
    if (this.#openCol !== null && !option) { this.close(); return; }
    this.#content.replaceChildren(option ? filterMenuContent(option, this.#filters, ctx) : filterPanel(this.#model.options, this.#filters, ctx));
  }

  #refresh(focusKey = null) {
    const content = this.#content;
    if (!content) return;
    const doc = content.ownerDocument;
    const active = doc.activeElement && content.contains(doc.activeElement) ? doc.activeElement : null;
    const kept = focusKey || (active ? active.dataset.fk : null);
    const caret = active && active.type === 'search' ? [active.selectionStart, active.selectionEnd] : null;
    const top = content.scrollTop;
    this.#fill();
    if (!this.#content) return;
    content.scrollTop = top;
    const again = kept && [...content.querySelectorAll('[data-fk]')].find(node => node.dataset.fk === kept);
    if (again) {
      again.focus({ preventScroll: true });
      if (caret && again.type === 'search') again.setSelectionRange(...caret);
    }
  }
}
