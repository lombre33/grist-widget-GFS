// « Ma présence » (module Annuaire, demande du porteur du 25/11, scène 13 de la maquette) : une option que l'administrateur allume, avec une colonne oui/non de
// la table des personnes (« apparaître dans l'annuaire »). Allumée, chacun voit sur sa propre fiche un interrupteur « Apparaître dans l'annuaire » ; une
// personne qui a choisi de ne pas apparaître (la case est décochée ; une case vide veut dire « apparaît ») ne se voit plus dans l'annuaire des autres, et reste
// grisée, avec sa pastille « Masquée », pour les administrateurs et pour elle-même (sans cela, elle ne pourrait plus se retrouver pour revenir).
//
// Cela masque la fiche dans l'annuaire de GFS ; ce n'est pas un verrou : la table des personnes reste lisible par qui la lit dans Grist. Un verrou réel est une
// règle d'accès de Grist. Des fonctions sans effet de bord, essayées sous Node (test/annuaire-check.test.mjs).
// « Masquée » : le mot de la pastille est `an.pres.masked` (« Fiche masquée »).

import { buildTree } from './annuaire-model.js';

// La colonne de présence quand l'option est allumée, sinon ''.
export const presenceCol = config => (config.presence && config.presence.on ? config.presence.col : '');

// Les lignes de la table des personnes dont la case « apparaître » est décochée.
export function maskedRows(read) {
  const col = presenceCol(read.config);
  const table = col && read.data && read.annuaire ? read.data[read.annuaire.table] : null;
  const cells = table && Array.isArray(table[col]) && Array.isArray(table.id) ? table[col] : null;
  return new Set(cells ? table.id.filter((row, i) => cells[i] === false) : []);
}

// La personne dont l'adresse est celle de la personne qui lit (GFS la connaît quand le document la lui dit : js/controller.js, `identity`), ou null.
export function mineOf(people, identity) {
  const address = String(identity || '').trim().toLowerCase();
  return address ? people.find(person => String(person.email || '').trim().toLowerCase() === address) || null : null;
}

// Qui peut changer l'interrupteur d'une fiche : un administrateur (de toutes), chacun de la sienne. Grist garde le dernier mot (ses règles d'accès).
export const canSwitch = (person, { admin, identity, people }) => admin || (mineOf(people, identity) || {}).row === person.row;

// Ce que la personne qui lit voit : sans les personnes masquées, sauf pour un administrateur et pour la personne elle-même. { ...read, people, tree, masked }
// où `masked` est l'ensemble des lignes masquées qui restent à l'écran (elles s'y voient grisées). Sans l'option, rien ne change.
export function presenceView(read, { admin = false, identity = '' } = {}) {
  const masked = maskedRows(read);
  if (!masked.size) return { ...read, masked };
  const mine = mineOf(read.people, identity);
  const people = read.people.filter(person => !masked.has(person.row) || admin || (mine && mine.row === person.row));
  const shown = new Set([...masked].filter(row => people.some(person => person.row === row)));
  return { ...read, people, tree: buildTree(people, read.config.levels, read.annuaire.name), masked: shown };
}
