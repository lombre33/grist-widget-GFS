// Les trois volets de l'annuaire (module Annuaire, demande du porteur du 25/11 ; style des maquettes du projet de l'Université Paris Cité, retenu par le
// porteur) : à gauche la hiérarchie, au milieu les personnes, à droite la fiche. Des fonctions qui construisent des nœuds à partir de l'état, sans jamais lire
// un nom comme du HTML ; les clics se lisent par délégation, d'après les attributs `data-*` posés ici (js/annuaire/annuaire-window.js).

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { initials, levelLabel, headsOf, telHref } from './annuaire-items.js';

// Combien de valeurs un filtre montre avant « +n » (le reste se choisit dans une liste avec recherche).
export const CHIPS_SHOWN = 6;

// Une valeur lue d'une colonne, dite à la personne : un oui/non en toutes lettres, une date dans sa langue.
export function shown(value, genre, { t, locale }) {
  if (genre === 'bool') return t(value === 'true' ? 'an.yes' : 'an.no');
  if (genre === 'date') {
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(locale, { dateStyle: 'medium', timeZone: 'UTC' });
  }
  return value;
}

// La hiérarchie : une ligne par nœud visible, un bouton pour le déplier et un pour le choisir. `ctx` : { t, selected (l'identifiant du nœud), open (Set) }.
export function treeList(root, ctx) {
  const items = [];
  const walk = (node, depth) => {
    const opened = ctx.open.has(node.id);
    const fold = node.ch.length > 0;
    const label = ctx.t(opened ? 'an.tree.fold' : 'an.tree.unfold', { name: node.name });
    items.push(h('li', { role: 'none', vars: { '--d': depth } },
      h('div', { class: 'an-tn', role: 'treeitem', 'aria-level': String(depth + 1), 'aria-expanded': fold ? String(opened) : null,
        'aria-selected': String(node.id === ctx.selected) },
        fold ? h('button', { type: 'button', class: 'an-tt', tabindex: '-1', title: label, 'aria-label': label, dataset: { act: 'tree-toggle', id: node.id } },
          icon(opened ? 'chev-down' : 'chev-right')) : h('span', { class: 'an-tt' }),
        h('button', { type: 'button', class: 'an-tb',
          title: node.level >= 0 ? `${node.name} · ${ctx.levels[node.level] ? levelLabel(ctx.levels[node.level]) : ''}` : node.name,
          dataset: { act: 'tree-pick', id: node.id, fk: `tn:${node.id}` } }, h('span', { class: 'an-tn-name' }, node.name),
            h('span', { class: 'an-pill' }, String(node.count))))));
    if (opened) node.ch.forEach(child => walk(child, depth + 1));
  };
  walk(root, 0);
  return h('ul', { class: 'an-tree-list', role: 'tree', 'aria-label': ctx.t('an.tree.label') }, ...items);
}

// Les niveaux d'une personne, du plus haut au plus bas, sans ceux qu'elle saute.
const pathOf = person => person.levels.filter(Boolean);

const who = person => person.initials ?? initials(person.name);

// Une ligne de la liste : l'avatar à initiales, le nom, le poste, et le niveau le plus bas en pastille (le chemin entier est dans l'info-bulle) puis les champs
// que le réglage met en liste (`extra`, des textes : décision de la fenêtre « Champs de la fiche »). Un seul bouton : toute la ligne se choisit.
export function personRow(person, { selected, tabStop, extra = [] }) {
  return h('button', { type: 'button', class: 'an-person', 'aria-pressed': String(selected), tabindex: tabStop ? '0' : '-1',
    dataset: { act: 'person', row: String(person.row), fk: `pe:${person.row}` } },
  h('span', { class: 'an-av' }, who(person)),
  h('span', { class: 'an-pe-text' }, h('span', { class: 'an-pe-name' }, person.name), person.title ? h('span', { class: 'an-pe-sub' }, person.title) : null),
  h('span', { class: 'an-pe-pills', title: [...pathOf(person), ...extra].join(' › ') },
    ...[...pathOf(person).slice(-1), ...extra].slice(0, 3).map(value => h('span', { class: 'an-pill' }, value))));
}

// Une carte de contact (la vue « Cartes ») : l'avatar, le nom, le poste, les deux derniers niveaux, l'adresse et le téléphone.
export function personCard(person, { selected, tabStop, extra = [] }) {
  return h('button', { type: 'button', class: 'an-pcard', 'aria-pressed': String(selected), tabindex: tabStop ? '0' : '-1',
    dataset: { act: 'person', row: String(person.row), fk: `pe:${person.row}` } },
  h('span', { class: 'an-av an-av-l' }, who(person)),
  h('span', { class: 'an-pe-name' }, person.name), person.title ? h('span', { class: 'an-pe-sub' }, person.title) : null,
  h('span', { class: 'an-pe-pills' }, ...[...pathOf(person).slice(-2), ...extra].slice(0, 4).map(value => h('span', { class: 'an-pill' }, value))),
  person.email ? h('span', { class: 'an-pc-line' }, icon('mail'), person.email) : null,
    person.phone ? h('span', { class: 'an-pc-line' }, icon('phone'), person.phone) : null);
}

// Une ligne de la fiche : son libellé, sa valeur, et un bouton pour la copier quand elle s'y prête.
function ficheRow(label, content, copy, t) {
  return h('div', { class: 'an-fr' }, h('dt', null, label), h('dd', null, content,
    copy ? h('button', { type: 'button', class: 'an-ib an-copy', title: t('an.copy', { what: label }), 'aria-label': t('an.copy', { what: label }),
      dataset: { act: 'copy', value: copy, fk: `cp:${label}` } }, icon('copy')) : null));
}

// Les personnes d'une relation, en boutons (un clic ouvre la fiche de l'autre) ; au-delà de CHIPS_SHOWN, « +n ».
function peopleLinks(list, key, t) {
  const first = list.slice(0, CHIPS_SHOWN);
  return h('span', { class: 'an-fr-vals' }, ...first.map(each => h('button', { type: 'button', class: 'an-link-b',
    dataset: { act: 'person', row: String(each.row), fk: `${key}:${each.row}` } }, each.name)),
  list.length > first.length ? h('span', { class: 'an-pill' }, t('an.rel.more', { n: list.length - first.length })) : null);
}

// Les lignes de la fiche que les relations donnent : ce que la personne désigne (« Assistant·e : Camille »), puis ce qui la désigne (« Assistant·e de : … »),
// seulement quand la relation a un sens inverse. `ctx.relations` et `ctx.index` : voir js/annuaire/annuaire-relations.js.
function relationRows(person, ctx) {
  const { t, relations = [], index } = ctx;
  if (!index) return [];
  return relations.flatMap(rel => {
    const to = index.direct(person, rel);
    const from = rel.inverse ? index.inverse(person, rel) : [];
    return [to.length ? ficheRow(rel.label, peopleLinks(to, `${rel.key}>`, t), '', t) : null,
      from.length ? ficheRow(rel.inverse, peopleLinks(from, `${rel.key}<`, t), '', t) : null].filter(Boolean);
  });
}

// La fiche d'une personne. `ctx` : { t, locale, levels, config, genres: { colonne: genre }, relations, index }.
export function fiche(person, ctx) {
  const { t, config } = ctx;
  const levels = person.levels.map((value, i) => ({ value, label: levelLabel(ctx.levels[i]) })).filter(each => each.value);
  const rows = [];
  if (person.email) rows.push(ficheRow(t('an.mail'), h('a', { class: 'an-link', href: `mailto:${person.email}`, target: '_blank', rel: 'noopener' },
    person.email), person.email, t));
  const call = telHref(person.phone);
  if (person.phone) rows.push(ficheRow(t('an.phone'), call ? h('a', { class: 'an-link', href: call, title: t('an.call', { what: person.phone }),
    target: '_blank', rel: 'noopener' }, person.phone) : person.phone, person.phone, t));
  rows.push(...relationRows(person, ctx));
  for (const field of config.fields) {
    const values = (person.fields[field.col] || []).map(value => shown(value, ctx.genres[field.col], ctx));
    if (values.length) rows.push(ficheRow(field.col, h('span', { class: 'an-fr-vals' }, ...values.map(value => h('span', { class: 'an-pill' }, value))), '',
      t));
  }
  return h('div', { class: 'an-fiche-card' },
    h('div', { class: 'an-fiche-head' }, h('span', { class: 'an-av an-av-xl' }, who(person)),
      h('div', { class: 'an-fiche-id' }, h('h3', null, person.name), person.title ? h('p', { class: 'an-pe-sub' }, person.title) : null)),
    levels.length ? h('div', { class: 'an-fiche-levels' }, ...levels.map(each => h('span', { class: 'an-pill', title: each.label }, each.value))) : null,
    rows.length ? h('dl', { class: 'an-fiche-rows' }, ...rows) : h('p', { class: 'an-note' }, t('an.fiche.bare')));
}

// La fiche d'une structure (un clic sur sa carte de l'organigramme) : son nom, son niveau, combien de personnes, qui en est responsable, et le moyen de voir
// ses personnes dans la liste. `ctx` : { t, levels }.
export function nodeFiche(node, ctx) {
  const { t } = ctx;
  const heads = headsOf(node);
  const level = node.level >= 0 ? levelLabel(ctx.levels[node.level]) : '';
  const names = heads.map(person => h('button', { type: 'button', class: 'an-link-b',
    dataset: { act: 'person', row: String(person.row), fk: `ph:${person.row}` } }, person.name));
  return h('div', { class: 'an-fiche-card' },
    h('div', { class: 'an-fiche-head' }, h('span', { class: 'an-av an-av-xl' }, icon('users')),
      h('div', { class: 'an-fiche-id' }, h('h3', null, node.name), level ? h('p', { class: 'an-pe-sub' }, level) : null)),
    h('div', { class: 'an-fiche-levels' }, h('span', { class: 'an-pill' }, t('an.count', { n: node.count }))),
    heads.length ? h('dl', { class: 'an-fiche-rows' }, ficheRow(t('an.heads', { n: heads.length }), h('span', { class: 'an-fr-vals' }, ...names), '', t)) :
      null,
    h('button', { type: 'button', class: 'btn sm an-see', dataset: { act: 'node-list', id: node.id, fk: 'node-list' } }, icon('list'), t('an.seePeople')));
}

// Les filtres des champs : un groupe par champ, une pastille par valeur (les plus nombreuses d'abord), « +n » pour les autres.
// `options` : voir `filterOptions` ; `filters` : { colonne: Set(valeurs) } ; `ctx` : { t, locale }.
export function filterBar(options, filters, ctx) {
  const groups = options.filter(option => option.values.length).map(option => {
    const on = filters[option.col] || new Set();
    const chosen = option.values.filter(entry => on.has(entry.value));
    const visible = [...chosen, ...option.values.filter(entry => !on.has(entry.value))].slice(0, CHIPS_SHOWN);
    const rest = option.values.length - visible.length;
    const chip = entry => h('button', { type: 'button', class: 'an-chip', 'aria-pressed': String(on.has(entry.value)),
      dataset: { act: 'filter', col: option.col, value: entry.value, fk: `fl:${option.col}:${entry.value}` } },
    shown(entry.value, option.genre, ctx), h('b', null, String(entry.count)));
    return h('div', { class: 'an-fgroup', role: 'group', 'aria-label': option.col }, h('span', { class: 'an-flabel' }, option.col), ...visible.map(chip),
      rest > 0 ? h('button', { type: 'button', class: 'an-chip an-more', title: ctx.t('an.filter.more', { n: rest }),
        dataset: { act: 'filter-more', col: option.col, fk: `fm:${option.col}` } }, `+${rest}`) : null);
  });
  return h('div', { class: 'an-filters' }, ...groups);
}
