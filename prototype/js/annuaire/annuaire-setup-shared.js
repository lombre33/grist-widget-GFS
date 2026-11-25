// Ce que les trois onglets du réglage de l'annuaire partagent (module Annuaire, demande du porteur du 25/11 : réglage en onglets, sur la maquette) : les
// colonnes d'une table dites à la personne (nom, type), le bouton qui ouvre la liste avec recherche, la ligne « libellé, choix, aide » et l'interrupteur. Des
// fonctions qui construisent des nœuds ; aucune ne parle à Grist (js/annuaire/annuaire-setup.js tient l'état et les gestes).

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';

export const GLYPHS = Object.freeze({ ref: 'link', reflist: 'link', bool: 'check', date: 'clock', number: 'chart', choice: 'list', choicelist: 'list',
  file: 'pdf' });
export const FILTERABLE = Object.freeze(['choice', 'choicelist', 'bool', 'ref', 'reflist']);
export const MAX_PATH = 4;
const TYPE_KEYS = Object.freeze({ choice: 'an.type.choice', choicelist: 'an.type.choicelist', bool: 'an.type.bool', date: 'an.type.date',
  number: 'an.type.number',
  ref: 'an.type.ref', reflist: 'an.type.reflist', text: 'an.type.text' });

// Le type d'une colonne, en un mot (« Choix », « Oui / non », « Personne » pour une référence à la table des personnes elle-même).
export function typeLabel(col, table, t) {
  if (!col) return t('an.type.absent');
  if ((col.genre === 'ref' || col.genre === 'reflist') && col.ref === table) return t(col.genre === 'ref' ? 'an.type.person' : 'an.type.people');
  return t(TYPE_KEYS[col.genre] || 'an.type.text');
}

// Le bouton qui ouvre une liste avec recherche : le choix en cours (ou « — Choisir … — »), une flèche.
export function chooser(t, fk, text, data, { disabled = false, title = '' } = {}) {
  return h('button', { type: 'button', class: 'an-pickbtn', 'aria-disabled': disabled ? 'true' : null, title: title || null, dataset: { ...data, fk } },
    text || t('an.set.choose'), icon('chev-down'));
}

// Une ligne du formulaire : son libellé, son choix, son aide.
export function formRow(label, control, hint = '') {
  return h('div', { class: 'an-set-row' }, h('span', { class: 'an-set-label' }, label),
    h('div', { class: 'an-set-control' }, control, hint ? h('span', { class: 'an-set-hint' }, hint) : null));
}

// L'interrupteur de la maquette : un bouton à rôle « switch » (Espace ou Entrée le bascule). Grisé, il garde sa place et dit pourquoi au survol.
export function switchButton({ on, label, fk, data, disabled = false, title = '' }) {
  return h('button', { type: 'button', role: 'switch', class: `an-sw${on ? ' is-on' : ''}`, 'aria-checked': String(on), 'aria-label': label,
    'aria-disabled': disabled ? 'true' : null, title: title || null, dataset: { ...data, fk } }, h('span', { class: 'an-sw-k' }));
}

// Un petit bouton à icône : monter, descendre, retirer.
export function iconButton(t, { glyph, label, fk, data, disabled = false }) {
  return h('button', { type: 'button', class: 'an-ib', title: label, 'aria-label': label, 'aria-disabled': disabled ? 'true' : null, dataset: { ...data, fk } },
    icon(glyph));
}

// Déplace l'élément `at` de la liste d'un cran (-1 vers le haut, 1 vers le bas) ; rend true quand il a bougé.
export function shift(list, at, by) {
  const to = at + by;
  if (to < 0 || to >= list.length) return false;
  [list[at], list[to]] = [list[to], list[at]];
  return true;
}
