// Les relations entre personnes d'un annuaire (module Annuaire, demande du porteur du 25/11 : « assistant·e », « référent·e », « suppléant·e » : une colonne de
// la table des personnes qui en désigne une autre, avec ses règles). Du code sans effet de bord, essayé sous Node : la configuration est à
// js/annuaire/annuaire-config.js, la lecture à js/annuaire/annuaire-model.js et le réglage à js/annuaire/annuaire-setup-relations.js.
//
// Une relation est une colonne de la table des personnes qui pointe vers cette même table : une référence (une personne) ou une liste de références
// (plusieurs). Sa ligne de configuration dit trois choses : `label` (ce qu'est la personne désignée pour celle qui la désigne : « Assistant·e »), `inverse` (ce
// que dit la fiche de la personne désignée : « Assistant·e de » ; vide : elle ne dit rien) et `card` (une petite ligne « Assistant·e : Camille » sur la carte
// de l'organigramme des responsables). Le responsable direct est la première relation, quand il y en a un : il donne cet organigramme.

// Les modèles que le réglage propose tout prêts (décision du porteur, 25/11) : leurs textes sont dans js/i18n/i18n-annuaire.js (`an.rel.tpl.<modèle>`).
export const TEMPLATES = Object.freeze(['assistant', 'referent', 'substitute']);

// Les numéros de ligne qu'une cellule de référence désigne : un numéro (une référence) ou une liste (`['L', 1, 2]`) ; rien pour le vide ou le zéro de Grist.
export function idsOf(cell) {
  const list = Array.isArray(cell) ? cell.slice(cell[0] === 'L' ? 1 : 0) : [cell];
  return list.filter(id => Number.isInteger(id) && id > 0);
}

// Les relations que les écrans montrent, dans l'ordre : le responsable direct (quand la configuration en a un), puis les relations. Chacune : { key, col,
// label, inverse, card, manager }. Une relation sans nom prend celui de sa colonne. `t` dit le nom du responsable direct et son sens inverse (l'équipe).
export function relationsOf(config, t) {
  const list = [];
  if (config.manager) list.push({ key: 'manager', col: config.manager, label: t('an.rel.manager'), inverse: t('an.rel.team'), card: false, manager: true });
  for (const rel of config.relations || []) list.push({ key: `rel:${rel.col}`, col: rel.col, label: rel.label || rel.col, inverse: rel.inverse, card: rel.card,
    manager: false });
  return list;
}

// Qui désigne qui : `direct(personne, relation)` rend les personnes que la sienne désigne, `inverse(personne, relation)` celles qui la désignent (dans l'ordre
// de `people`, celui de la liste). Rien n'est lu deux fois : l'index se construit une fois par lecture.
export function relationIndex(people, relations) {
  const byRow = new Map(people.map(person => [person.row, person]));
  const targets = (person, rel) => {
    if (rel.manager) return Number.isInteger(person.manager) ? [person.manager] : [];
    return (person.rel && person.rel[rel.col]) || [];
  };
  const pointers = new Map(relations.map(rel => [rel.key, new Map()]));
  for (const rel of relations) {
    const map = pointers.get(rel.key);
    for (const person of people) for (const id of targets(person, rel)) map.set(id, [...(map.get(id) || []), person]);
  }
  return {
    direct: (person, rel) => targets(person, rel).map(id => byRow.get(id)).filter(Boolean),
    inverse: (person, rel) => (pointers.get(rel.key) ? pointers.get(rel.key).get(person.row) || [] : []),
  };
}

// Les petites lignes d'une carte de l'organigramme des responsables : « Assistant·e : Camille Durand » pour chaque relation qui le demande et que la personne
// a. Au plus `max` lignes (la carte garde sa hauteur) ; `separator` sépare les noms d'une même ligne.
export function cardLines(person, relations, index, { max = 2, separator = ', ' } = {}) {
  const lines = [];
  for (const rel of relations) {
    if (!rel.card || lines.length >= max) continue;
    const names = index.direct(person, rel).map(each => each.name);
    if (names.length) lines.push(`${rel.label} : ${names.join(separator)}`);
  }
  return lines;
}

// Combien de lignes une carte peut avoir en plus de son nom : le nombre de relations qui demandent une ligne, au plus `max`.
export const cardLineCount = (relations, max = 2) => Math.min(max, relations.filter(rel => rel.card).length);
