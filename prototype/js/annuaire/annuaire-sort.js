// Le tri de la liste de l'annuaire (module Annuaire, demande du porteur du 25/11 : « tri par colonne ») : des fonctions sans effet de bord, essayées sous Node
// (test/annuaire-sort.test.mjs). Un tri est { key, dir } (`dir` : 'asc' ou 'desc') ; rien (`null`) veut dire l'ordre de l'annuaire, par nom.
// Les clés : 'name', 'title' (le poste), 'email', 'phone', la clé d'un niveau (`levelKey`, js/annuaire/annuaire-model.js) ou le nom de colonne d'un champ.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { levelKey, valuesFor } from './annuaire-model.js';
import { levelLabel } from './annuaire-items.js';
import { fieldLabel } from './annuaire-config.js';

// Le texte par lequel une personne se trie pour une clé : un champ à plusieurs valeurs se trie par ses valeurs mises à la suite.
function sortText(person, key) {
  if (key === 'name') return person.sort ?? person.name;
  if (key === 'title' || key === 'email' || key === 'phone') return person[key] || '';
  return valuesFor(person, key).join(', ');
}

// Les personnes triées par `sort.key` (les chiffres se comparent comme des nombres, les accents et la casse ne comptent pas) ; ce qui est vide va toujours à la
// fin, dans les deux sens, et deux personnes à égalité restent dans l'ordre du nom. Sans tri, l'ordre reçu.
export function sortPeople(people, sort, locale = 'fr') {
  if (!sort) return people;
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  const sign = sort.dir === 'desc' ? -1 : 1;
  return people.map((person, at) => ({ person, at, text: sortText(person, sort.key) })).sort((a, b) => {
    if (!a.text !== !b.text) return a.text ? -1 : 1;
    return (a.text && b.text ? sign * collator.compare(a.text, b.text) : 0) || a.at - b.at;
  }).map(entry => entry.person);
}

// Le tri qu'un clic sur le titre d'une colonne donne : croissant, puis décroissant, puis plus de tri ; une autre colonne repart du croissant.
export function nextSort(sort, key) {
  if (!sort || sort.key !== key) return { key, dir: 'asc' };
  return sort.dir === 'asc' ? { key, dir: 'desc' } : null;
}

// Les colonnes qu'on peut trier : le nom, le poste, l'adresse et le numéro quand l'annuaire les règle, un niveau par niveau de la hiérarchie, puis chaque champ
// de la fiche. [{ key, label }] ; `t` dit les libellés des colonnes fixes.
export function sortKeys(config, t) {
  const fixed = [['name', t('an.col.name')], ['title', t('an.fiche.post')], ['email', t('an.mail')], ['phone', t('an.phone')]];
  const wanted = key => key === 'name' || Boolean(config[key]);
  return [...fixed.filter(([key]) => wanted(key)).map(([key, label]) => ({ key, label })),
    ...config.levels.map((level, at) => ({ key: levelKey(at), label: levelLabel(level) })).filter(entry => entry.label),
    ...config.fields.map(field => ({ key: field.col, label: fieldLabel(field) }))];
}

// Le libellé d'un tri, à écrire sur le bouton : « Poste ↑ » n'existe pas en mots : « Poste, croissant ». `''` sans tri.
export function sortLabel(sort, keys, t) {
  const found = sort && keys.find(entry => entry.key === sort.key);
  return found ? t(sort.dir === 'desc' ? 'an.sort.desc' : 'an.sort.asc', { col: found.label }) : '';
}

// Le bouton « Trier » du fil de la liste et des cartes : il ouvre la liste des colonnes à trier ; une fois un tri choisi, il dit la colonne et le sens (une
// flèche) et s'allume d'un accent. `keys` : voir `sortKeys`.
export function sortButton(sort, keys, t) {
  const found = sort && keys.find(entry => entry.key === sort.key);
  const label = t('an.sort');
  return h('button', { type: 'button', class: `btn sm an-tbtn an-sbtn${found ? ' is-on' : ''}`, 'aria-haspopup': 'dialog', title: label,
    'aria-label': found ? `${label} : ${sortLabel(sort, keys, t)}` : label, dataset: { act: 'sort-pick', fk: 'sort-pick' } },
  icon('sort'), h('span', { class: 'an-tb-t' }, found ? found.label : label), found ? icon(sort.dir === 'desc' ? 'chev-down' : 'chev-up') : null);
}
