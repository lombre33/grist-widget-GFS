// Le tri de la liste de l'annuaire (module Annuaire, demande du porteur du 25/11 : « tri par colonne ») : sur le document fictif des essais (test/annuaire-fixtures.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaOf } from '../js/annuaire/annuaire-schema.js';
import { buildPeople, levelKey } from '../js/annuaire/annuaire-model.js';
import { sortPeople, nextSort, sortKeys, sortLabel } from '../js/annuaire/annuaire-sort.js';
import { documentFixture, configFixture } from './annuaire-fixtures.mjs';

const doc = documentFixture();
const schema = schemaOf(doc._grist_Tables, doc._grist_Tables_column);
const people = buildPeople(configFixture(), 'Personnes', doc, schema);
const names = list => list.map(person => person.name);
const t = (key, vars = {}) => Object.entries(vars).reduce((text, [name, value]) => text.replace(`{${name}}`, value), key);

test('tri : sans tri, l\'ordre reçu (celui de l\'annuaire, par nom)', () => {
  assert.equal(sortPeople(people, null), people);
});

test('tri : par nom, croissant puis décroissant', () => {
  const asc = names(sortPeople(people, { key: 'name', dir: 'asc' }));
  assert.deepEqual(asc, names(people), 'croissant, c\'est l\'ordre de l\'annuaire');
  assert.deepEqual(names(sortPeople(people, { key: 'name', dir: 'desc' })), [...asc].reverse());
});

test('tri : par poste, par adresse, par téléphone ; une valeur vide va toujours à la fin, dans les deux sens', () => {
  const byMail = sortPeople(people, { key: 'email', dir: 'asc' });
  assert.equal(byMail.at(-1).name, 'Yanis Morel', 'la seule personne sans adresse est la dernière');
  assert.equal(byMail[0].email, 'camille.durand@exemple.fr');
  const reversed = sortPeople(people, { key: 'email', dir: 'desc' });
  assert.equal(reversed.at(-1).name, 'Yanis Morel', 'toujours la dernière, même en décroissant');
  assert.equal(reversed[0].email, 'nathan.roussel@exemple.fr');
  const byPhone = sortPeople(people, { key: 'phone', dir: 'asc' });
  assert.equal(byPhone[0].name, 'Camille Durand', 'la seule personne avec un numéro est la première');
  assert.deepEqual(byPhone.slice(1).map(person => person.phone), ['', '', '', '', ''], 'les autres sont à la suite, dans l\'ordre du nom');
  assert.deepEqual(names(byPhone.slice(1)), names(people.filter(person => person.phone === '')), 'à égalité, l\'ordre du nom');
  const byTitle = sortPeople(people, { key: 'title', dir: 'asc' });
  assert.equal(byTitle[0].title, 'Cheffe du pôle Ressources');
});

test('tri : par niveau et par champ (les valeurs d\'un champ à plusieurs se trient mises à la suite)', () => {
  const byPole = sortPeople(people, { key: levelKey(0), dir: 'asc' });
  assert.deepEqual(byPole.map(person => person.levels[0]), ['Pôle Numérique', 'Pôle Ressources', 'Pôle Ressources', 'Pôle Ressources', 'Pôle Ressources', 'Pôle Vie de campus']);
  const byContract = sortPeople(people, { key: 'Contrat', dir: 'asc' });
  assert.equal(byContract[0].fields.Contrat[0], 'Contractuelle');
  assert.equal(byContract.at(-1).fields.Contrat[0], 'Titulaire');
  const skills = sortPeople(people, { key: 'Competences', dir: 'desc' });
  assert.deepEqual(names(skills.slice(0, 3)), ['Louis Girard', 'Inès Marchand', 'Camille Durand'], 'les valeurs mises à la suite : « Pilotage », « Marchés publics », « Budget, Marchés publics »');
  assert.deepEqual(skills.slice(3).map(person => person.fields.Competences || []), [[], [], []], 'sans compétence : à la fin, même en décroissant');
});

test('tri : les nombres se comparent comme des nombres, la casse et les accents ne comptent pas', () => {
  const rows = ['b10', 'B2', 'à3', 'a1'].map((name, row) => ({ row, name, sort: name, title: '', email: '', phone: '', levels: [], fields: {} }));
  assert.deepEqual(names(sortPeople(rows, { key: 'name', dir: 'asc' })), ['a1', 'à3', 'B2', 'b10']);
});

test('tri : un clic sur un titre va de croissant à décroissant puis à plus de tri ; une autre colonne repart du croissant', () => {
  const first = nextSort(null, 'email');
  assert.deepEqual(first, { key: 'email', dir: 'asc' });
  const second = nextSort(first, 'email');
  assert.deepEqual(second, { key: 'email', dir: 'desc' });
  assert.equal(nextSort(second, 'email'), null);
  assert.deepEqual(nextSort(second, 'phone'), { key: 'phone', dir: 'asc' });
});

test('tri : les colonnes qu\'on peut trier suivent le réglage de l\'annuaire', () => {
  const keys = sortKeys(configFixture(), t);
  assert.deepEqual(keys.map(entry => entry.key), ['name', 'title', 'email', 'phone', '@L0', '@L1', '@L2', 'Contrat', 'Competences', 'Teletravail', 'Arrivee']);
  const bare = sortKeys({ levels: [], fields: [] }, t);
  assert.deepEqual(bare.map(entry => entry.key), ['name'], 'sans poste, adresse ni numéro réglés : le nom seul');
  assert.equal(sortLabel({ key: 'email', dir: 'desc' }, keys, t), 'an.sort.desc');
  assert.equal(sortLabel(null, keys, t), '');
});
