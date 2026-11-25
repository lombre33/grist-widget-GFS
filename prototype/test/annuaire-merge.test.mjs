// La vue fusionnée « Tous mes annuaires » (js/annuaire/annuaire-merge.js, module Annuaire, 25/11) : une même adresse ne fait qu'une fiche, l'annuaire d'origine et le
// rattachement se disent sur chaque ligne, deux personnes de même adresse d'un même annuaire restent deux, et la configuration de la vue ne parle d'aucune colonne du document.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeReads, mergedConfig, MERGED_ROW } from '../js/annuaire/annuaire-merge.js';
import { listColumns } from '../js/annuaire/annuaire-items.js';
import { buildTree } from '../js/annuaire/annuaire-model.js';

const LABELS = { origin: 'Annuaire', path: 'Rattachement' };
const person = (row, name, email, levels = [], extra = {}) => ({ row, name, sort: name.toLowerCase(), initials: name.slice(0, 2).toUpperCase(), title: '', email, phone: '', levels,
  fields: {}, rel: {}, lead: false, manager: null, ...extra });
const A = { annuaire: { row: 1, name: 'Annuaire principal' }, read: { people: [person(1, 'Camille Durand', 'camille@exemple.fr', ['Pôle Ressources', '', 'Budget'], { title: 'Cheffe' }),
  person(2, 'Hugo Lefèvre', 'Hugo@Exemple.fr', ['Pôle Ressources']), person(3, 'Sans Adresse', '', ['Pôle Numérique'])] } };
const B = { annuaire: { row: 3, name: 'Annuaire RH' }, read: { people: [person(1, 'Hugo LEFÈVRE', ' hugo@exemple.fr ', ['RH', 'Paie'], { phone: '01 02 03 04 05' }),
  person(2, 'Alix Moreau', 'alix@exemple.fr', []), person(3, 'Sans Adresse', '', ['RH'])] } };

test('mergeReads : une même adresse (casse et blancs ignorés) ne fait qu\'une fiche, qui dit ses annuaires et ses rattachements', () => {
  const { people, joined, counts } = mergeReads([A, B], LABELS);
  assert.equal(people.length, 5, 'six personnes, une réunie');
  assert.equal(joined, 1);
  assert.deepEqual(counts, { 1: 3, 3: 3 });
  const hugo = people.find(each => each.name === 'Hugo Lefèvre');
  assert.deepEqual(hugo.fields.Annuaire, ['Annuaire principal', 'Annuaire RH']);
  assert.deepEqual(hugo.fields.Rattachement, ['Pôle Ressources', 'RH · Paie'], 'les deux rattachements, dans l\'ordre des annuaires');
  assert.equal(hugo.phone, '01 02 03 04 05', 'ce que la première fiche ne dit pas vient de la suivante');
  assert.equal(hugo.title, '');
  assert.equal(people.find(each => each.name === 'Camille Durand').title, 'Cheffe', 'la première fiche garde son poste');
});

test('mergeReads : sans adresse, ou dans un même annuaire, des personnes de même nom ne se réunissent jamais', () => {
  const { people, joined } = mergeReads([A, B], LABELS);
  assert.equal(people.filter(each => each.name === 'Sans Adresse').length, 2, 'sans adresse, rien ne dit que c\'est la même personne');
  const twins = { annuaire: { row: 5, name: 'Doublons' }, read: { people: [person(1, 'Éric', 'eric@exemple.fr'), person(2, 'Eric', 'eric@exemple.fr')] } };
  const merged = mergeReads([twins], LABELS);
  assert.equal(merged.people.length, 2, 'un doublon d\'un même annuaire reste visible : « À vérifier » le dit');
  assert.equal(merged.joined, 0);
  assert.equal(joined, 1);
});

test('mergeReads : trié par nom, des numéros de ligne tous différents, aucune hiérarchie ni relation', () => {
  const { people } = mergeReads([B, A], LABELS);
  assert.deepEqual(people.map(each => each.name), ['Alix Moreau', 'Camille Durand', 'Hugo LEFÈVRE', 'Sans Adresse', 'Sans Adresse'], 'la première lecture donne la fiche (ici « Annuaire RH »)');
  assert.equal(new Set(people.map(each => each.row)).size, people.length);
  for (const one of people) assert.deepEqual([one.levels, one.rel, one.lead, one.manager], [[], {}, false, null]);
  assert.deepEqual(mergeReads([], LABELS), { people: [], joined: 0, counts: {} });
});

test('mergedConfig : l\'adresse et deux colonnes à eux, sans niveau ni poste ; la liste les montre dans cet ordre', () => {
  const config = mergedConfig(LABELS);
  assert.deepEqual(config.levels, []);
  assert.equal(config.hierarchy, false);
  assert.deepEqual(config.fields.map(field => [field.col, field.column]), [['Annuaire', true], ['Rattachement', true]]);
  const columns = listColumns(config, key => key);
  assert.deepEqual(columns.map(col => col.label), ['an.mail', 'Annuaire', 'Rattachement']);
  assert.equal(MERGED_ROW < 0, true, 'jamais le numéro d\'une ligne de Grist');
});

test('une vue fusionnée se range en un seul nœud : la racine', () => {
  const { people } = mergeReads([A, B], LABELS);
  const tree = buildTree(people, [], 'Tous mes annuaires');
  assert.equal(tree.ch.length, 0);
  assert.equal(tree.count, people.length);
});
