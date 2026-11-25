// Le modèle de l'annuaire (module Annuaire, demande du porteur du 25/11) : les personnes d'une table, la hiérarchie qui s'en déduit, la recherche et les
// filtres. Du code sans effet de bord, essayé sous Node ; la lecture est à js/annuaire/annuaire-store.js et les écrans à js/annuaire/annuaire-window.js.
//
// L'arbre se CALCULE à chaque lecture d'après les données (décision du porteur, 25/11 : « un niveau = une colonne au choix ») : rien n'est rangé nœud par
// nœud. Ajouter, déplacer ou retirer un niveau change la liste des niveaux et rien d'autre ; une personne qui n'a pas de valeur à un niveau le saute, et reste
// rangée au niveau qu'elle a (« niveau sauté »).

import { columnOf, columnAt } from './annuaire-schema.js';
import { fieldPath, fieldLabel } from './annuaire-config.js';
import { initials } from './annuaire-items.js';
import { idsOf } from './annuaire-relations.js';
import { normalize, words, matchesWords } from '../ui/search.js';

const MAX_DEPTH = 4; // les références qu'on suit pour montrer une valeur (une colonne visible qui est elle-même une référence)

// L'accès aux lignes de chaque table lue : `at(tableId, rowId)` rend la ligne (son rang dans les tableaux de colonnes), ou -1.
export function lookup(data) {
  const maps = new Map();
  return {
    data,
    at(tableId, rowId) {
      if (!maps.has(tableId)) maps.set(tableId, new Map(((data[tableId] && data[tableId].id) || []).map((id, i) => [id, i])));
      const found = maps.get(tableId).get(rowId);
      return found === undefined ? -1 : found;
    },
  };
}

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const isoDay = seconds => new Date(seconds * 1000).toISOString().slice(0, 10);

// Les valeurs d'une cellule, en textes : [] quand elle est vide. Un choix multiple en donne plusieurs, une référence la valeur de la colonne que Grist montre
// pour elle. Un oui/non donne « true » ou « false » (l'écran le dit dans la langue de la personne) ; une date « AAAA-MM-JJ ».
const listOf = cell => (Array.isArray(cell) ? cell.slice(cell[0] === 'L' ? 1 : 0) : []);
const single = cell => (Array.isArray(cell) || typeof cell === 'object' ? [] : [clean(cell)].filter(Boolean));
const READERS = {
  choicelist: cell => listOf(cell).map(clean).filter(Boolean),
  bool: cell => (cell === true ? ['true'] : (cell === false ? ['false'] : [])),
  date: cell => (typeof cell === 'number' && Number.isFinite(cell) ? [isoDay(cell)] : []),
  file: () => [],
  ref: (cell, col, ctx, depth) => refValues([cell], col, ctx, depth),
  reflist: (cell, col, ctx, depth) => refValues(listOf(cell), col, ctx, depth),
};

export function valuesOf(cell, col, ctx, depth = 0) {
  if (cell === null || cell === undefined || cell === '' || !col) return [];
  return (READERS[col.genre] || single)(cell, col, ctx, depth);
}

function refValues(ids, col, ctx, depth) {
  if (depth >= MAX_DEPTH || !col.ref || !col.visible) return [];
  const shown = columnOf(ctx.schema, col.ref, col.visible);
  const table = ctx.data[col.ref];
  if (!shown || !table || !Array.isArray(table[col.visible])) return [];
  return ids.flatMap(id => {
    const at = ctx.at(col.ref, id);
    return at < 0 ? [] : valuesOf(table[col.visible][at], shown, ctx, depth + 1);
  });
}

// Suit un chemin de colonnes depuis une ligne de `tableId` : toutes les colonnes sauf la dernière doivent être des références à une seule ligne ; la valeur est
// celle de la dernière colonne. [] quand un maillon est vide ou n'est pas une référence.
export function followPath(ctx, tableId, rowAt, columns) {
  let table = tableId;
  let at = rowAt;
  for (let i = 0; i < columns.length; i++) {
    const col = columnOf(ctx.schema, table, columns[i]);
    const cell = ctx.data[table] && Array.isArray(ctx.data[table][columns[i]]) ? ctx.data[table][columns[i]][at] : undefined;
    if (!col) return [];
    if (i === columns.length - 1) return valuesOf(cell, col, ctx);
    if (col.genre !== 'ref' || typeof cell !== 'number') return [];
    at = ctx.at(col.ref, cell);
    table = col.ref;
    if (at < 0) return [];
  }
  return [];
}

// Le nom qu'une personne porte : `last` seul (la colonne du nom complet), ou le prénom et le nom de famille dans l'ordre que l'annuaire dit quand le prénom est
// une colonne à part (`order` : voir `NAME_ORDERS`), le nom de famille en capitales quand `upper`. { name (ce qui s'écrit), sort (ce qui trie : le nom de
// famille d'abord, tel qu'il est écrit dans la table), initials }.
export function nameOf(first, last, order, upper = false) {
  if (!first) return { name: last, sort: last, initials: initials(last) };
  const family = upper ? last.toLocaleUpperCase('fr') : last;
  const joined = { 'last-first': `${family} ${first}`, 'last-comma': `${family}, ${first}` }[order] || `${first} ${family}`;
  const name = joined.trim();
  return { name, sort: `${last} ${first}`.trim(), initials: (initials(first)[0] || '') + (initials(last)[0] || '') || initials(name) };
}

const bySort = (a, b) => (a.sort ?? a.name).localeCompare(b.sort ?? b.name, 'fr');

// Les personnes de la table : [{ row, name, sort, initials, title, email, phone, levels: [texte ou ''], fields: { colonne: [textes] }, lead, manager }], triées
// par nom (de famille d'abord quand le prénom est une colonne à part).
// `lead` : la personne est responsable de sa structure (la colonne `lead` de la configuration est un oui/non, ou n'est pas vide) ; `manager` : le numéro de la
//   ligne de son responsable (la colonne `manager` est une référence à la même table), ou null ; `rel` : { colonne: [numéros de ligne] } pour chaque relation
//   de la configuration (js/annuaire/annuaire-relations.js).
export function buildPeople(config, tableId, data, schema) {
  const ctx = { ...lookup(data), schema };
  const table = data[tableId];
  if (!table || !Array.isArray(table.id)) return [];
  const one = (key, i) => (config[key] ? followPath(ctx, tableId, i, [config[key]])[0] || '' : '');
  const people = table.id.map((row, i) => {
    const managerCell = config.manager && Array.isArray(table[config.manager]) ? table[config.manager][i] : null;
    const lead = config.lead ? followPath(ctx, tableId, i, [config.lead]) : [];
    return { row, ...nameOf(one('first', i), one('name', i), config.order, config.upper), title: one('title', i), email: one('email', i),
      phone: one('phone', i),
      levels: config.levels.map(level => followPath(ctx, tableId, i, level.path)[0] || ''),
      fields: Object.fromEntries(config.fields.map(field => [field.col, followPath(ctx, tableId, i, fieldPath(field))])),
      rel: Object.fromEntries((config.relations || []).map(rel => [rel.col, idsOf(Array.isArray(table[rel.col]) ? table[rel.col][i] : null)])),
      lead: lead.length > 0 && lead[0] !== 'false', manager: typeof managerCell === 'number' && managerCell > 0 ? managerCell : null };
  });
  return people.filter(person => person.name).sort(bySort);
}

// La hiérarchie : { id, name, level (-1 pour la racine), own: [personnes rangées ici], count (ici et dessous), ch: [nœuds] }. Le nœud d'un niveau s'identifie
// par son chemin (« Pôle Ressources › Direction des finances » n'est pas « Direction des finances » d'un autre pôle). Les enfants sont triés par nom.
export function buildTree(people, levels, rootName) {
  const root = { id: '', name: rootName, level: -1, own: [], count: 0, ch: [] };
  for (const person of people) {
    let node = root;
    levels.forEach((level, i) => {
      const value = person.levels[i];
      if (!value) return; // niveau sauté
      const id = `${node.id}\u001f${i}:${value}`;
      let child = node.ch.find(each => each.id === id);
      if (!child) { child = { id, name: value, level: i, own: [], count: 0, ch: [] }; node.ch.push(child); }
      node = child;
    });
    node.own.push(person);
  }
  const total = node => {
    node.ch.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    node.count = node.own.length + node.ch.reduce((sum, child) => sum + total(child), 0);
    return node.count;
  };
  total(root);
  return root;
}

// Le nœud d'identifiant `id` (la racine pour ''), ou null.
export function findNode(root, id) {
  if (!id || root.id === id) return root;
  for (const child of root.ch) {
    const found = id.startsWith(child.id) ? findNode(child, id) : null;
    if (found) return found;
  }
  return null;
}

// Les personnes d'un nœud et de tout ce qui est dessous, triées par nom.
export function peopleIn(node) {
  const all = [...node.own];
  const walk = each => { for (const child of each.ch) { all.push(...child.own); walk(child); } };
  walk(node);
  return all.sort(bySort);
}

// Le texte de recherche d'une personne : son nom, son poste, son adresse, ses niveaux et ses champs, comparables (js/ui/search.js).
const keys = new WeakMap(); // le texte comparable de chaque personne, calculé une fois (une frappe ne le recalcule pas pour des milliers de personnes)
export function searchKey(person) {
  if (!keys.has(person)) keys.set(person, normalize([person.name, person.title, person.email, ...person.levels,
    ...Object.values(person.fields).flat()].join(' ')));
  return keys.get(person);
}

// Les personnes qui passent la recherche (des mots dans n'importe quel ordre) et les filtres : { colonne: Set(valeurs) } ; plusieurs valeurs d'une même colonne
// s'additionnent (« ou »), les colonnes se cumulent (« et »).
export function filterPeople(people, { query = '', filters = {} } = {}) {
  const needles = words(query);
  const active = Object.entries(filters).filter(([, set]) => set && set.size > 0);
  return people.filter(person => (!needles.length || matchesWords(needles, searchKey(person))) &&
    active.every(([col, set]) => (person.fields[col] || []).some(value => set.has(value))));
}

// Le genre de chaque champ, par sa clé (`field.col`) : celui de la dernière colonne de son chemin.
export function fieldGenres(config, tableId, schema) {
  return Object.fromEntries(config.fields.map(field => [field.col, (columnAt(schema, tableId, fieldPath(field)) || {}).genre]));
}

// Les filtres que les champs donnent : [{ col, values: [{ value, count }] }] pour chaque champ marqué « filtre » dont le genre s'y prête (un choix, un choix
// multiple, un oui/non, une référence), avec le nombre de personnes de `people` par valeur (les plus nombreuses d'abord).
export function filterOptions(people, config, schema, tableId) {
  const options = [];
  for (const field of config.fields.filter(each => each.filter)) {
    const col = columnAt(schema, tableId, fieldPath(field));
    if (!col || !['choice', 'choicelist', 'bool', 'ref', 'reflist'].includes(col.genre)) continue;
    const counts = new Map();
    for (const person of people) for (const value of new Set(person.fields[field.col] || [])) counts.set(value, (counts.get(value) || 0) + 1);
    const values = [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'fr'));
    options.push({ col: field.col, label: fieldLabel(field), genre: col.genre, values });
  }
  return options;
}

// L'arbre des responsables : chaque personne est rangée sous celle que sa colonne `manager` désigne ; sans responsable (ou un responsable qui n'est pas dans
// la liste, ou un cycle), elle est à la racine. [{ person, ch: [...] }], les racines d'abord par nom.
export function managerTree(people) {
  const byRow = new Map(people.map(person => [person.row, { person, ch: [] }]));
  const roots = [];
  const reaches = (start, target) => {
    for (let at = start, steps = 0; at !== null && steps <= people.length; steps++) {
      if (at === target) return true;
      at = byRow.has(at) ? byRow.get(at).person.manager : null;
    }
    return false;
  };
  for (const node of byRow.values()) {
    const parent = node.person.manager !== null && node.person.manager !== node.person.row ? byRow.get(node.person.manager) : null;
    if (parent && !reaches(parent.person.manager, node.person.row)) parent.ch.push(node);
    else roots.push(node);
  }
  return roots;
}
