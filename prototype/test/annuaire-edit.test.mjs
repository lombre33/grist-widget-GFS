// Modifier une fiche (module Annuaire, demande du porteur du 25/11) : ce que GFS sait écrire d'une personne, sur le document fictif des essais
// (test/annuaire-fixtures.mjs). Rien ne parle à Grist ici : la fenêtre et l'écriture se mesurent sous Firefox et dans le labo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaOf, columnOf } from '../js/annuaire/annuaire-schema.js';
import { buildPeople } from '../js/annuaire/annuaire-model.js';
import { editableFields, personValues, valueOf, secondsOf, problemOf, cellOf, changesOf, updateOf, refOptions, choiceOptions } from '../js/annuaire/annuaire-edit.js';
import { documentFixture, configFixture } from './annuaire-fixtures.mjs';
import { labelsOf, say, controlOf } from '../js/annuaire/annuaire-edit-controls.js';

const doc = documentFixture();
const schema = schemaOf(doc._grist_Tables, doc._grist_Tables_column);
const t = key => key;
const found = (config = configFixture()) => editableFields(config, schema, 'Personnes', t);
const byKey = (list, key) => list.find(entry => entry.key === key);

test('le schéma dit les choix d\'une colonne et si Grist la calcule', () => {
  assert.deepEqual(columnOf(schema, 'Personnes', 'Contrat').choices, ['Titulaire', 'Contractuelle', 'Stagiaire']);
  assert.deepEqual(columnOf(schema, 'Personnes', 'Nom').choices, []);
  assert.equal(columnOf(schema, 'Personnes', 'Nom').formula, false);
  const broken = schemaOf(doc._grist_Tables, { ...doc._grist_Tables_column, widgetOptions: doc._grist_Tables_column.id.map(() => '{pas du json'), isFormula: doc._grist_Tables_column.id.map(() => true) });
  assert.deepEqual(columnOf(broken, 'Personnes', 'Contrat').choices, [], 'un texte illisible ne casse rien');
  assert.equal(columnOf(broken, 'Personnes', 'Contrat').formula, true);
});

test('les champs d\'une fiche : les colonnes directes, dans l\'ordre des groupes', () => {
  const { fields, locked } = found();
  assert.deepEqual(fields.map(field => field.key), ['name', 'title', 'email', 'phone', 'manager', 'rel:Assistant', 'rel:Referents', 'Contrat', 'Competences', 'Teletravail', 'Arrivee']);
  assert.deepEqual(fields.map(field => field.group), ['identity', 'identity', 'contact', 'contact', 'relations', 'relations', 'relations', 'info', 'info', 'info', 'info']);
  assert.deepEqual(locked, []);
  assert.equal(byKey(fields, 'name').label, 'an.col.name');
  assert.equal(byKey(fields, 'rel:Assistant').label, 'Assistant·e');
  assert.deepEqual(byKey(fields, 'Contrat').choices, ['Titulaire', 'Contractuelle', 'Stagiaire']);
  assert.equal(byKey(fields, 'manager').ref, 'Personnes');
});

test('un prénom à part ajoute son champ ; le nom devient « nom de famille »', () => {
  const { fields } = found({ ...configFixture(), first: 'Poste' });
  assert.deepEqual(fields.slice(0, 2).map(field => [field.key, field.label]), [['first', 'an.set.first'], ['name', 'an.edit.family']]);
});

test('une valeur qui vient d\'une autre table, une colonne calculée ou un type qu\'on n\'écrit pas ne s\'écrit pas ici : grisée, avec sa raison', () => {
  const config = { ...configFixture(), title: 'Structure › Nom', fields: [...configFixture().fields, { col: 'Structure › Pole', path: ['Structure', 'Pole'], filter: false }] };
  const { fields, locked } = found(config);
  assert.equal(byKey(fields, 'title'), undefined);
  assert.deepEqual(byKey(locked, 'title'), { key: 'title', label: 'an.fiche.post', group: 'identity', why: 'path', table: 'Structures' });
  assert.equal(byKey(locked, 'Structure › Pole').why, 'path');
  assert.equal(byKey(locked, 'Structure › Pole').table, 'Structures');
  const calculated = schemaOf(doc._grist_Tables, { ...doc._grist_Tables_column, isFormula: doc._grist_Tables_column.id.map(id => id === 12) });
  const formula = editableFields(configFixture(), calculated, 'Personnes', t);
  assert.equal(byKey(formula.locked, 'email').why, 'formula');
  assert.equal(byKey(formula.fields, 'email'), undefined);
  const stamped = schemaOf(doc._grist_Tables, { ...doc._grist_Tables_column, type: doc._grist_Tables_column.type.map((type, at) => (doc._grist_Tables_column.id[at] === 30 ? 'DateTime:Europe/Paris' : type)) });
  assert.equal(byKey(editableFields(configFixture(), stamped, 'Personnes', t).locked, 'Arrivee').why, 'type', 'une date avec l\'heure s\'écraserait : elle ne s\'écrit pas ici');
});

test('une colonne qui n\'existe plus n\'est jamais proposée (une seule colonne absente annulerait tout le lot)', () => {
  const { fields, locked } = found({ ...configFixture(), phone: 'Absente', fields: [{ col: 'Disparue', filter: false }] });
  assert.equal(byKey(fields, 'phone'), undefined);
  assert.equal(byKey(locked, 'phone'), undefined);
  assert.equal(byKey(fields, 'Disparue'), undefined);
});

test('les valeurs d\'une personne : texte, choix multiple, oui/non, date, référence', () => {
  const { fields } = found();
  const camille = personValues(fields, doc.Personnes, 1);
  assert.equal(camille.name, 'Camille Durand');
  assert.deepEqual(camille.Competences, ['Budget', 'Marchés publics']);
  assert.equal(camille.Teletravail, true);
  assert.equal(camille.Arrivee, '2016-03-01');
  assert.equal(camille.manager, 3);
  assert.deepEqual(camille['rel:Referents'], [5, 3]);
  const emma = personValues(fields, doc.Personnes, 5);
  assert.equal(emma.Teletravail, false, 'un oui/non vide vaut « non »');
  assert.equal(emma.manager, 0);
  assert.deepEqual(emma.Competences, []);
  assert.equal(emma.Arrivee, '');
  assert.equal(valueOf({ genre: 'number' }, 12), '12');
  assert.equal(valueOf({ genre: 'text' }, null), '');
  assert.equal(personValues(fields, doc.Personnes, 99).name, '', 'une ligne qui n\'existe pas : des valeurs vides');
});

test('les dates : « AAAA-MM-JJ » donne les secondes de minuit en temps universel, un jour qui n\'existe pas donne rien', () => {
  assert.equal(secondsOf('2016-03-01'), 1456790400);
  assert.equal(secondsOf('2024-02-29'), 1709164800);
  assert.equal(secondsOf('2023-02-29'), null);
  assert.equal(secondsOf('2023-13-01'), null);
  assert.equal(secondsOf('demain'), null);
});

test('ce qui empêche d\'écrire : un nom vide, une date fausse, un nombre qui n\'en est pas un', () => {
  assert.equal(problemOf({ key: 'name', genre: 'text' }, '  '), 'an.edit.errName');
  assert.equal(problemOf({ key: 'name', genre: 'text' }, 'Camille'), null);
  assert.equal(problemOf({ key: 'title', genre: 'text' }, ''), null, 'un poste vide est permis');
  assert.equal(problemOf({ key: 'Arrivee', genre: 'date' }, '2023-02-29'), 'an.edit.errDate');
  assert.equal(problemOf({ key: 'Arrivee', genre: 'date' }, ''), null);
  assert.equal(problemOf({ key: 'Age', genre: 'number', type: 'Numeric' }, '12,5'), null);
  assert.equal(problemOf({ key: 'Age', genre: 'number', type: 'Numeric' }, 'douze'), 'an.edit.errNumber');
  assert.equal(problemOf({ key: 'Age', genre: 'number', type: 'Int' }, '12,5'), 'an.edit.errInt');
  assert.equal(problemOf({ key: 'Age', genre: 'number', type: 'Int' }, '12'), null);
});

test('la valeur écrite : ce que Grist attend pour chaque type', () => {
  assert.deepEqual(cellOf({ genre: 'choicelist' }, ['A', 'B']), ['L', 'A', 'B']);
  assert.equal(cellOf({ genre: 'choicelist' }, []), null);
  assert.deepEqual(cellOf({ genre: 'reflist' }, [5, 3]), ['L', 5, 3]);
  assert.equal(cellOf({ genre: 'ref' }, 0), 0);
  assert.equal(cellOf({ genre: 'ref' }, 7), 7);
  assert.equal(cellOf({ genre: 'bool' }, false), false);
  assert.equal(cellOf({ genre: 'date' }, '2016-03-01'), 1456790400);
  assert.equal(cellOf({ genre: 'date' }, ''), null);
  assert.equal(cellOf({ genre: 'number' }, '12,5'), 12.5);
  assert.equal(cellOf({ genre: 'number' }, ''), null);
  assert.equal(cellOf({ genre: 'text' }, '  Camille  '), 'Camille');
});

test('ce qui a changé : seulement les champs touchés, rien quand tout est comme avant (les espaces de bord ne comptent pas)', () => {
  const { fields } = found();
  const before = personValues(fields, doc.Personnes, 1);
  assert.deepEqual(changesOf(fields, before, { ...before }), []);
  assert.deepEqual(changesOf(fields, before, { ...before, title: ` ${before.title} ` }), []);
  const after = { ...before, title: 'Cheffe du service Budget et marchés', Teletravail: false, Competences: ['Budget'] };
  assert.deepEqual(changesOf(fields, before, after).map(change => change.field.key), ['title', 'Competences', 'Teletravail']);
});

test('l\'action écrite : une seule ligne, rien que les colonnes changées', () => {
  const { fields } = found();
  const before = personValues(fields, doc.Personnes, 1);
  const changes = changesOf(fields, before, { ...before, phone: '01 02 03 04 12', Competences: [], manager: 5, Arrivee: '' });
  assert.deepEqual(updateOf('Personnes', 1, changes), ['UpdateRecord', 'Personnes', 1,
    { Tel: '01 02 03 04 12', Responsable: 5, Competences: null, Arrivee: null }]);
});

test('les choix d\'une référence : les personnes de l\'annuaire, ou la colonne que Grist montre ; les choix d\'un choix, la valeur actuelle en plus', () => {
  const { fields } = found();
  const people = buildPeople(configFixture(), 'Personnes', doc, schema);
  const ctx = { data: doc, people, table: 'Personnes' };
  const manager = byKey(fields, 'manager');
  assert.deepEqual(refOptions(manager, ctx).map(option => option.label), people.map(person => person.name).sort((a, b) => a.localeCompare(b, 'fr')));
  assert.equal(refOptions(manager, ctx).find(option => option.label === 'Camille Durand').id, 1);
  const other = { genre: 'ref', ref: 'Structures', visible: 'Nom' };
  assert.deepEqual(refOptions(other, ctx).slice(0, 2).map(option => option.label), ['Budget', 'Direction des finances']);
  assert.deepEqual(refOptions({ genre: 'ref', ref: 'Structures', visible: '' }, ctx), [], 'sans colonne montrée, rien à proposer');
  assert.deepEqual(choiceOptions(byKey(fields, 'Contrat'), 'Titulaire'), ['Titulaire', 'Contractuelle', 'Stagiaire']);
  assert.deepEqual(choiceOptions(byKey(fields, 'Contrat'), 'Intérimaire'), ['Titulaire', 'Contractuelle', 'Stagiaire', 'Intérimaire']);
  assert.deepEqual(choiceOptions(byKey(fields, 'Competences'), ['Budget', 'Droit']), ['Budget', 'Marchés publics', 'Pilotage', 'Droit']);
});

// Retour du porteur, 27/11 : « dans Poste ça m'affiche ça, n'a pas l'air d'être un poste, son poste en fait c'est ça ». Le poste est une référence à une autre table que celle des
// personnes ; les numéros des deux tables se recouvrent (le poste 3 et la personne 3), et un seul jeu de noms pour tous les champs montrait le nom de la personne.
test('un poste (référence à une autre table) ne prend jamais le nom d\'une personne qui a le même numéro : un jeu de noms par champ', () => {
  const columns = doc._grist_Tables_column;
  const asRef = schemaOf(doc._grist_Tables, { ...columns, type: columns.type.map((type, at) => (columns.id[at] === 11 ? 'Ref:Structures' : type)),
    visibleCol: columns.visibleCol.map((visible, at) => (columns.id[at] === 11 ? 20 : visible)) });
  const withPost = { ...doc, Personnes: { ...doc.Personnes, Poste: [3, 5, 1, 7, 0, 2] } };
  const { fields } = editableFields(configFixture(), asRef, 'Personnes', t);
  const people = buildPeople(configFixture(), 'Personnes', withPost, asRef);
  const ctx = { data: withPost, people, table: 'Personnes' };
  const title = byKey(fields, 'title');
  assert.equal(title.genre, 'ref');
  assert.equal(title.ref, 'Structures');
  const labels = labelsOf(fields, ctx);
  assert.equal(labels.title[3], 'Direction des finances', 'le poste 3 est la ligne 3 de la table des postes');
  assert.equal(labels.manager[3], 'Nathan Roussel', 'la personne 3 reste la personne 3');
  assert.notEqual(labels.title[3], labels.manager[3]);
  const host = { t, locale: 'fr', labels };
  assert.equal(say(title, 3, host), 'Direction des finances');
  assert.equal(say(byKey(fields, 'manager'), 3, host), 'Nathan Roussel');
  assert.equal(say(byKey(fields, 'Contrat'), 'Titulaire', host), 'Titulaire', 'un champ qui n\'est pas une référence n\'a pas de noms, et ne casse rien');
  assert.equal(say(byKey(fields, 'rel:Referents'), [5, 3], host), 'Emma Rolland, Nathan Roussel');
  assert.equal(say(title, 99, host), '99', 'une ligne qui n\'existe plus se dit par son numéro');
});
