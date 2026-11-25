// Ce que l'organigramme et les listes de l'annuaire montrent d'une personne ou d'une structure (module Annuaire, demande du porteur du 25/11), tiré du modèle
// (js/annuaire/annuaire-model.js) : des initiales, le libellé d'un niveau, les éléments des deux organigrammes. Du code sans effet de bord, essayé sous Node.

import { FIXED_COLUMNS, fieldLabel } from './annuaire-config.js';

// Les initiales d'un nom : la première lettre du premier mot et celle du dernier (« Camille Martin » : « CM »), une seule lettre pour un mot seul, rien sans
// lettre.
export function initials(name) {
  const letters = String(name ?? '').split(/[\s'’-]+/).map(word => [...word].find(char => /\p{L}/u.test(char))).filter(Boolean);
  const two = letters.length > 1 ? letters[0] + letters.at(-1) : (letters[0] || '');
  return two.toLocaleUpperCase();
}

// Le numéro tel que le lien d'appel l'attend (« 01 02 03 04 05 » : « tel:0102030405 », « +33 (0)1 02… » : « tel:+331… ») : les chiffres, avec le « + » du début
// et sans le « (0) » qui suit un indicatif ; ce qui vient après un « poste », un « ext. » ou une virgule (un numéro de poste) n'est pas composé. null quand il
// n'y a pas assez de chiffres pour un numéro ou qu'il y reste des mots (« standard du lundi »). Sur un téléphone, le lien lance l'application d'appel ;
// ailleurs, celle que la personne a choisie pour les numéros, s'il y en a une.
export function telHref(phone) {
  const main = String(phone ?? '').split(/\b(?:poste|post|ext|extension)\b|p\.|#|[;,]/i)[0].trim();
  const international = main.startsWith('+');
  const digits = (international ? main.replace(/\(0\)/g, '') : main).replace(/\D/g, '');
  return digits.length < 6 || /\p{L}{2}/u.test(main) ? null : `tel:${international ? '+' : ''}${digits}`;
}

// Le libellé d'un niveau : celui que la personne a écrit, sinon le nom de la dernière colonne de son chemin.
export const levelLabel = level => (level && (level.label || (level.path || []).at(-1))) || '';

// Les colonnes de la liste (le réglage « Colonne » de la fenêtre « Champs de la fiche ») : l'adresse et le téléphone quand ils sont réglés en colonne, puis les
// champs marqués « colonne », dans l'ordre des champs. [{ key, label, fixed }] ; `t` dit les libellés des colonnes fixes.
export function listColumns(config, t) {
  const fixed = FIXED_COLUMNS.filter(key => config[key] && (config.columns || []).includes(key)).map(key =>
    ({ key, label: t(key === 'email' ? 'an.mail' : 'an.phone'),
    fixed: true }));
  return [...fixed, ...config.fields.filter(field => field.column).map(field => ({ key: field.col, label: fieldLabel(field), fixed: false }))];
}

// Les personnes d'un nœud qui sont responsables de leur structure (colonne `lead`), les premières par nom.
export const headsOf = node => node.own.filter(person => person.lead);

// L'élément d'une personne dans un organigramme : sa petite carte (nom, poste) et ce que le clic désigne (la personne).
const personItem = person => ({ id: `p${person.row}`, ch: [], pick: { person: person.row }, card: { title: person.name, sub: person.title, count: 0, head: '',
  initials: person.initials ?? initials(person.name), lines: [] } });

// L'organigramme des structures : { id, ch, card, pick, people } pour chaque nœud de l'arbre des niveaux. `card` : ce que la carte écrit (le nom, le libellé du
// niveau, le nombre de personnes, le responsable) ; `pick` : ce que le clic désigne (le nœud) ; `people` : les personnes rangées là, quand `withPeople` (le
// bouton « Personnes » de l'organigramme : retour du porteur, 25/11).
export function structureItems(tree, levels, { withPeople = false } = {}) {
  const one = node => {
    const [head] = headsOf(node);
    const level = node.level >= 0 ? levels[node.level] : null;
    return { id: node.id || 'root', ch: node.ch.map(one), pick: { node: node.id }, people: withPeople ? node.own.map(personItem) : [],
      card: { title: node.name, sub: levelLabel(level), count: node.count, head: head ? head.name : '',
        initials: head ? (head.initials ?? initials(head.name)) : '' } };
  };
  return [one(tree)];
}

// L'organigramme des responsables : `roots` vient de `managerTree` ([{ person, ch }]). Le nombre d'une carte est celui de toutes les personnes dessous ;
// `linesOf(personne)` donne les petites lignes de sa carte (ses relations : « Assistant·e : Camille », js/annuaire/annuaire-relations.js) ; `dim(personne)` dit
// qu'elle n'est là que pour relier celles qui passent la recherche et les filtres (sa carte est estompée).
export function managerItems(roots, linesOf = () => [], dim = () => false) {
  const one = node => {
    const ch = node.ch.map(one);
    const below = ch.reduce((sum, child) => sum + child.card.count + 1, 0);
    const { person } = node;
    return { id: `p${person.row}`, ch, pick: { person: person.row }, card: { title: person.name, sub: person.title, count: below, head: '',
      initials: person.initials ?? initials(person.name), lines: linesOf(person), dim: dim(person) } };
  };
  return roots.map(one);
}

// Le nœud qu'une personne désigne dans l'arbre des structures : celui où elle est rangée (le chemin de ses niveaux, en sautant ceux qu'elle n'a pas).
export function nodeIdOf(person) {
  let id = '';
  person.levels.forEach((value, i) => { if (value) id = `${id}\u001f${i}:${value}`; });
  return id;
}

// Les identifiants du nœud et de tous ceux qui le portent, de la racine à lui : `\u001f0:Pôle\u001f1:Direction` donne la racine (''), le pôle, puis la
// direction.
export function pathIds(id) {
  const ids = [''];
  let at = '';
  for (const part of String(id).split('\u001f').filter(Boolean)) { at = `${at}\u001f${part}`; ids.push(at); }
  return ids;
}
