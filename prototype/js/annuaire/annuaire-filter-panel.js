// Le contenu des filtres de l'annuaire (module Annuaire, retours du porteur du 25/11 : « un bouton pour réinitialiser dès qu'au moins une valeur est cochée »,
// « un champ de recherche par filtre », « une option par annuaire pour afficher les filtres en barre, avec le nom de chaque champ, comme l'annuaire PUI ») :
// des fonctions qui construisent des nœuds à partir des filtres et de ce qui est coché, sans jamais lire une valeur comme du HTML. Deux présentations, les
// mêmes
// cases : le panneau (un seul bouton « Filtres », un titre par filtre, les deux premiers dépliés) et le menu d'un filtre de la barre
//   (js/annuaire/annuaire-filters.js les pose). Les clics se lisent par délégation, d'après les attributs `data-*` posés ici (js/annuaire/annuaire-window.js) ;
//   la frappe dans une recherche, elle, est lue par le menu qui porte le contenu.
//
// `options` : voir `filterOptions` ; `filters` : { colonne: Set(valeurs) } ; `ctx` : { t, locale, opened (Map : colonne -> déplié ou non, ce que la personne a
// décidé), search (Map : colonne -> ce qui est tapé dans la recherche de ce filtre) }.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { normalize, words, matchesWords } from '../ui/search.js';
import { shown } from './annuaire-panes.js';

// Combien de valeurs un filtre montre dans le panneau avant « Voir les n autres… » (le reste se choisit dans la liste avec recherche, ou en tapant dans la
// recherche du filtre).
export const VALUES_SHOWN = 8;
// Combien de valeurs le menu d'un filtre de la barre écrit d'un coup : les plus nombreuses d'abord, la recherche trouve les autres.
export const MENU_SHOWN = 100;

// Combien de cases sont cochées, tous filtres confondus.
export const activeCount = filters => Object.values(filters).reduce((sum, set) => sum + (set ? set.size : 0), 0);

// Les valeurs d'un filtre qui répondent à ce qui est tapé dans sa recherche (des mots dans n'importe quel ordre, accents, casse et ponctuation ignorés, sur le
// texte que la personne lit) ; toutes les valeurs quand rien n'est tapé.
export function valuesMatching(option, query, ctx) {
  const needles = words(query);
  return needles.length ? option.values.filter(entry => matchesWords(needles, normalize(shown(entry.value, option.genre, ctx)))) : option.values;
}

// Un filtre ouvert par défaut : celui qui a une valeur choisie, sinon les deux premiers (la maquette du porteur : les premiers filtres dépliés, les autres
// repliés avec le nombre de leurs valeurs).
export function sectionOpen(option, index, filters, opened) {
  if (opened.has(option.col)) return opened.get(option.col);
  return index < 2 || Boolean(filters[option.col] && filters[option.col].size > 0);
}

// Le bouton « Réinitialiser » : grisé tant que rien n'est coché (il reste là, avec sa place), sinon il retire toutes les valeurs d'un clic.
export function resetButton(active, t, extra = '') {
  return h('button', { type: 'button', class: `an-reset an-freset${extra}`, 'aria-disabled': active ? null : 'true',
    title: t(active ? 'an.filters.resetTip' : 'an.filters.resetNone'),
    dataset: { act: 'filters-reset', fk: 'fp-reset' } }, t('an.filters.reset'));
}

// La recherche d'un filtre : un champ au-dessus de ses valeurs ; ce qu'on y tape réduit ses valeurs, jamais les autres filtres.
function searchBox(option, query, ctx) {
  const name = option.label || option.col;
  const input = h('input', { type: 'search', class: 'an-fq', value: query, autocomplete: 'off', placeholder: ctx.t('an.filter.search'),
    'aria-label': ctx.t('an.filter.searchIn', { name }), dataset: { col: option.col, fk: `fq:${option.col}` } });
  return h('label', { class: 'inp-search an-fsearch' }, icon('search'), input);
}

// Une ligne du panneau des filtres : une case, la valeur, son nombre de personnes (retour du porteur, 25/11 : le bouton « Filtres » ouvre un panneau, comme la
// maquette de l'annuaire, au lieu d'une barre de pastilles).
function valueRow(option, entry, on, ctx) {
  const text = shown(entry.value, option.genre, ctx);
  return h('button', { type: 'button', class: 'an-fv', role: 'checkbox', 'aria-checked': String(on), title: text,
    dataset: { act: 'filter', col: option.col, value: entry.value, fk: `fl:${option.col}:${entry.value}` } },
  h('span', { class: 'an-box', 'aria-hidden': 'true' }, on ? icon('check') : null), h('span', { class: 'an-fv-t' }, text),
    h('span', { class: 'an-fv-n' }, String(entry.count)));
}

// La phrase d'un filtre dont la recherche ne trouve rien.
const noMatch = (query, found, ctx) => (query.trim() && !found.length ? h('p', { class: 'an-fnone', role: 'status' }, ctx.t('an.filter.noMatch')) : null);

// Un filtre du panneau : son titre (un bouton qui le replie ou le déplie, avec le nombre de choix ou de valeurs) puis sa recherche et ses valeurs, les plus
// nombreuses d'abord ; une valeur choisie reste visible même au-delà des premières. Quand on cherche, toutes les valeurs trouvées se montrent.
function sectionOf(option, index, filters, ctx) {
  const on = filters[option.col] || new Set();
  const open = sectionOpen(option, index, filters, ctx.opened);
  const label = option.label || option.col;
  const query = ctx.search.get(option.col) || '';
  const found = valuesMatching(option, query, ctx);
  const visible = query.trim() ? found : found.filter((entry, at) => at < VALUES_SHOWN || on.has(entry.value));
  const rest = found.length - visible.length;
  const head = h('button', { type: 'button', class: 'an-fsec-h', 'aria-expanded': String(open),
    dataset: { act: 'fsec', col: option.col, fk: `fs:${option.col}` } },
  icon(open ? 'chev-down' : 'chev-right'), h('span', { class: 'an-fsec-t' }, label),
  on.size ? h('b', { class: 'an-badge' }, String(on.size)) : h('span', { class: 'an-fsec-n' }, ctx.t('an.filter.values', { n: option.values.length })));
  return h('section', { class: 'an-fsec' }, head, open ? h('div', { class: 'an-fvals', role: 'group', 'aria-label': label },
    searchBox(option, query, ctx), ...visible.map(entry => valueRow(option, entry, on.has(entry.value), ctx)), noMatch(query, found, ctx),
    rest > 0 ? h('button', { type: 'button', class: 'an-fv an-fmore', dataset: { act: 'filter-more', col: option.col, fk: `fm:${option.col}` } },
      h('span', { class: 'an-fv-t' }, ctx.t('an.filter.more', { n: rest })), icon('chev-right')) : null) : null);
}

// Le panneau des filtres : sa tête (ce qui est choisi et « Réinitialiser »), puis un titre et ses valeurs par filtre (un par niveau de la hiérarchie, puis un
// par champ réglé « Filtre »).
export function filterPanel(options, filters, ctx) {
  const active = activeCount(filters);
  return h('div', { class: 'an-fp' },
    h('div', { class: 'an-fp-head' }, h('span', { class: 'an-fp-n', 'aria-live': 'polite' },
      ctx.t(active ? 'an.filters.chosen' : 'an.filters.nothing', { n: active })),
      resetButton(active, ctx.t)),
    ...options.filter(option => option.values.length).map((option, index) => sectionOf(option, index, filters, ctx)));
}

// Le menu d'un filtre de la barre : sa recherche, puis ses valeurs (les plus nombreuses d'abord, une valeur choisie reste visible) ; « Réinitialiser » est dans
// la barre, pas ici. Rend le contenu que le menu pose.
export function filterMenuContent(option, filters, ctx) {
  const on = filters[option.col] || new Set();
  const query = ctx.search.get(option.col) || '';
  const found = valuesMatching(option, query, ctx);
  const visible = found.filter((entry, at) => at < MENU_SHOWN || on.has(entry.value));
  const rest = found.length - visible.length;
  return h('div', { class: 'an-fp an-fmenu' }, searchBox(option, query, ctx),
    h('div', { class: 'an-fvals', role: 'group', 'aria-label': option.label || option.col },
      ...visible.map(entry => valueRow(option, entry, on.has(entry.value), ctx)),
      noMatch(query, found, ctx), rest > 0 ? h('p', { class: 'an-fnone' }, ctx.t('an.filter.refine', { n: rest })) : null));
}
