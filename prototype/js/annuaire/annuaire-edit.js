// Modifier une fiche (module Annuaire, demande du porteur du 25/11 : le bouton « Modifier ») : ce que GFS sait écrire d'une personne, sans parler à Grist ni à
// la page (des fonctions qu'on essaie sous Node : test/annuaire-edit.test.mjs). La fenêtre est à js/annuaire/annuaire-edit-window.js, l'écriture au store.
//
// Règles : GFS n'écrit que des colonnes DIRECTES de la table des personnes, qui existent (une colonne absente annulerait tout le lot), que Grist ne calcule pas
//   et dont le type s'écrit ici. Une valeur qui vient d'une autre table (« Poste › Intitulé ») se modifie dans cette table : elle reste dans la fiche, grisée,
//   avec sa raison. Seul Grist arrête une personne (ses règles d'accès) : GFS ne devine rien, il essaie l'écriture et dit ce que Grist a répondu.

import { columnOf } from './annuaire-schema.js';
import { keyPath, fieldLabel } from './annuaire-config.js';

const WRITABLE = Object.freeze(['text', 'choice', 'choicelist', 'bool', 'date', 'number', 'ref', 'reflist']);

// Les groupes de la fenêtre, dans l'ordre : l'identité, les coordonnées, les relations, les champs de la fiche.
export const GROUPS = Object.freeze(['identity', 'contact', 'relations', 'info']);

// Pourquoi une colonne ne s'écrit pas ici : `null` quand elle s'écrit. Une colonne absente du document n'est pas proposée du tout (le réglage la signale déjà).
function lockOf(col) {
  if (col.formula) return 'formula';
  if (String(col.type).startsWith('DateTime') || !WRITABLE.includes(col.genre)) return 'type';
  return null;
}

// La table où vit la dernière colonne d'un chemin (« Poste › Intitulé » : la table que « Poste » désigne), ou ''.
function tableOfPath(schema, table, steps) {
  let at = table;
  for (const id of steps.slice(0, -1)) { const col = at ? columnOf(schema, at, id) : null; at = col && col.ref ? col.ref : ''; }
  return at;
}

// Les champs d'une fiche : { fields: [{ key, col, label, genre, group, type, choices, ref, visible }], locked: [{ key, label, group, why, table }] }. `why` :
// 'path' (la valeur vient d'une autre table : `table` dit laquelle), 'formula' ou 'type'. `key` est la clé de la valeur dans la fenêtre : « name », « title »…
// ou la colonne du champ. `t` dit les libellés des colonnes fixes.
export function editableFields(config, schema, table, t) {
  const fields = [];
  const locked = [];
  const add = (key, label, source, group) => {
    const steps = Array.isArray(source) ? source : keyPath(source);
    if (!steps.length) return;
    if (steps.length > 1) { locked.push({ key, label, group, why: 'path', table: tableOfPath(schema, table, steps) }); return; }
    const col = columnOf(schema, table, steps[0]);
    if (!col) return;
    const why = lockOf(col);
    if (why) { locked.push({ key, label, group, why, table: '' }); return; }
    fields.push({ key, col: col.id, label, genre: col.genre, group, type: col.type, choices: col.choices || [], ref: col.ref, visible: col.visible });
  };
  if (config.first) add('first', t('an.set.first'), config.first, 'identity');
  add('name', config.first ? t('an.edit.family') : t('an.col.name'), config.name, 'identity');
  add('title', t('an.fiche.post'), config.title, 'identity');
  add('email', t('an.mail'), config.email, 'contact');
  add('phone', t('an.phone'), config.phone, 'contact');
  add('manager', t('an.rel.manager'), config.manager, 'relations');
  for (const rel of config.relations || []) add(`rel:${rel.col}`, rel.label, rel.col, 'relations');
  for (const field of config.fields) add(field.col, fieldLabel(field), field.path && field.path.length ? field.path : field.col, 'info');
  return { fields, locked };
}

const listOf = cell => (Array.isArray(cell) ? cell.slice(cell[0] === 'L' ? 1 : 0) : []);
const isoOf = seconds => new Date(seconds * 1000).toISOString().slice(0, 10);

// La valeur de la fenêtre d'une cellule de Grist : un texte pour du texte, un choix, une date (« AAAA-MM-JJ ») ou un nombre ; une liste pour un choix multiple
// ou une liste de références ; un nombre (0 : personne) pour une référence ; vrai ou faux pour un oui/non.
const READERS = Object.freeze({
  choicelist: cell => listOf(cell).map(String).filter(Boolean),
  reflist: cell => listOf(cell).filter(id => typeof id === 'number' && id > 0),
  ref: cell => (typeof cell === 'number' && cell > 0 ? cell : 0),
  bool: cell => cell === true,
  date: cell => (typeof cell === 'number' && Number.isFinite(cell) ? isoOf(cell) : ''),
  number: cell => (typeof cell === 'number' && Number.isFinite(cell) ? String(cell) : ''),
});
export function valueOf(field, cell) {
  if (READERS[field.genre]) return READERS[field.genre](cell);
  return cell === null || cell === undefined || typeof cell === 'object' ? '' : String(cell);
}

// Les valeurs de la personne de la ligne `row` d'une table lue (des tableaux de colonnes) : { clé: valeur de la fenêtre }.
export function personValues(fields, table, row) {
  const at = table && Array.isArray(table.id) ? table.id.indexOf(row) : -1;
  return Object.fromEntries(fields.map(field => [field.key, valueOf(field, at < 0 || !Array.isArray(table[field.col]) ? null : table[field.col][at])]));
}

// Une date « AAAA-MM-JJ » en secondes (comme Grist l'écrit : minuit, temps universel), ou null quand elle n'existe pas (le 31 février, par exemple).
export function secondsOf(day) {
  const found = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day));
  if (!found) return null;
  const ms = Date.UTC(Number(found[1]), Number(found[2]) - 1, Number(found[3]));
  return Number.isFinite(ms) && isoOf(ms / 1000) === day ? ms / 1000 : null;
}

const numberOf = text => Number(String(text).trim().replace(/\s/g, '').replace(',', '.'));

// Ce qui empêche d'écrire la valeur d'un champ : la clé du texte qui le dit (`an.edit.err…`), ou null. Une personne sans nom disparaîtrait de la liste
// (l'annuaire ne montre que celles qui en ont un) : le nom ne se vide pas.
export function problemOf(field, value) {
  if (field.key === 'name' && !String(value).trim()) return 'an.edit.errName';
  if (field.genre === 'date' && value && secondsOf(value) === null) return 'an.edit.errDate';
  if (field.genre === 'number' && String(value).trim()) {
    const number = numberOf(value);
    if (!Number.isFinite(number)) return 'an.edit.errNumber';
    if (field.type === 'Int' && !Number.isInteger(number)) return 'an.edit.errInt';
  }
  return null;
}

// La valeur de la fenêtre, telle que Grist la reçoit (une liste de choix : ['L', …] ; rien : null ou 0 pour une référence).
export function cellOf(field, value) {
  switch (field.genre) {
    case 'choicelist': return value.length ? ['L', ...value] : null;
    case 'reflist': return value.length ? ['L', ...value] : null;
    case 'ref': return value || 0;
    case 'bool': return Boolean(value);
    case 'date': return value ? secondsOf(value) : null;
    case 'number': return String(value).trim() ? numberOf(value) : null;
    default: return String(value).trim();
  }
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Un texte à écrire en retirant les espaces de bord : deux valeurs qui ne diffèrent que par là ne comptent pas comme un changement.
const comparable = (field, value) => (field.genre === 'text' || field.genre === 'choice' ? String(value).trim() : value);

// Ce que la personne a changé : [{ field, before, after }], dans l'ordre des champs ; rien quand tout est comme avant.
export function changesOf(fields, before, after) {
  return fields.filter(field => !same(comparable(field, before[field.key]), comparable(field, after[field.key])))
    .map(field => ({ field, before: before[field.key], after: after[field.key] }));
}

// L'action de Grist qui écrit ces changements : une seule ligne, rien que les colonnes changées (jamais une colonne absente : `editableFields` n'en propose
// pas).
export function updateOf(table, row, changes) {
  return ['UpdateRecord', table, row, Object.fromEntries(changes.map(({ field, after }) => [field.col, cellOf(field, after)]))];
}

// Les choix d'une référence : [{ id, label }] triés par nom. Une référence à la table des personnes elle-même donne les noms de l'annuaire (le prénom y est) ;
// une autre table donne la colonne que Grist montre pour elle (`field.visible`). Vide quand Grist ne dit pas quelle colonne montrer.
export function refOptions(field, { data, people, table }) {
  if (field.ref === table) return people.map(person => ({ id: person.row, label: person.name })).sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  const rows = data[field.ref];
  if (!rows || !Array.isArray(rows.id) || !field.visible || !Array.isArray(rows[field.visible])) return [];
  return rows.id.map((id, at) => ({ id, label: String(rows[field.visible][at] ?? '').trim() })).filter(option => option.label)
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}

// Les choix d'un choix : ceux de la colonne dans Grist, puis la valeur actuelle quand Grist ne la connaît pas (une valeur écrite hors liste reste visible).
export function choiceOptions(field, current) {
  const seen = new Set(field.choices);
  return [...field.choices, ...[].concat(current).filter(value => value && !seen.has(value))];
}
