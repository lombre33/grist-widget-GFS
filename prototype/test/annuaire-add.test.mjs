// Ajouter des personnes à un annuaire (module Annuaire ; choix du porteur, 27/11 : « Plusieurs à la suite, un seul ajout ») : ce que GFS sait écrire, sur le document
// fictif des essais (test/annuaire-fixtures.mjs). Rien ne parle à Grist ici : la fenêtre se mesure sous Firefox (test/annuaire-ajout-firefox.mjs), l'écriture dans un vrai
// Grist (labo/run-annuaire-ajout-ui.mjs).
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { schemaOf } from '../js/annuaire/annuaire-schema.js';
import { buildPeople } from '../js/annuaire/annuaire-model.js';
import { editableFields, personValues } from '../js/annuaire/annuaire-edit.js';
import { blankValues, isBlank, draftName, duplicatesOf, firstProblem, bulkAddOf, addBlock } from '../js/annuaire/annuaire-add.js';
import { createI18n } from '../js/i18n/i18n.js';
import { documentFixture, configFixture } from './annuaire-fixtures.mjs';

const doc = documentFixture();
const schema = schemaOf(doc._grist_Tables, doc._grist_Tables_column);
const t = key => key;
const config = configFixture();
const { fields } = editableFields(config, schema, 'Personnes', t);
const people = buildPeople(config, 'Personnes', doc, schema);
const draft = (extra = {}) => ({ before: blankValues(fields), values: { ...blankValues(fields), ...extra } });

test('une fiche vide : « rien » pour chaque champ, selon son type ; une fiche qui n\'a rien de plus est vide', () => {
  const blank = blankValues(fields);
  assert.equal(blank.name, '');
  assert.equal(blank.manager, 0, 'une référence vide est 0');
  assert.deepEqual(blank.Competences, []);
  assert.equal(blank.Teletravail, false);
  assert.equal(isBlank(fields, blank), true);
  assert.equal(isBlank(fields, { ...blank, name: '   ' }), true, 'des espaces ne font pas une fiche');
  assert.equal(isBlank(fields, { ...blank, Competences: ['Budget'] }), false);
  assert.equal(isBlank(fields, { ...blank, Teletravail: true }), false);
});

test('le nom d\'une fiche préparée : celui que l\'annuaire écrira (le prénom d\'une colonne à part, l\'ordre et les capitales du réglage), vide tant que le nom manque', () => {
  assert.equal(draftName({ name: ' Léa Garnier ' }, config), 'Léa Garnier');
  assert.equal(draftName({ first: 'Léa', name: '' }, config), '', 'sans nom de famille, pas de nom');
  assert.equal(draftName({ first: 'Léa', name: 'Garnier' }, { order: 'last-first', upper: true }), 'GARNIER Léa');
  assert.equal(draftName({ first: 'Léa', name: 'Garnier' }, {}), 'Léa Garnier');
});

test('les doublons : l\'adresse est comparée sans casse, le nom par ses mots dans n\'importe quel ordre ; l\'annuaire d\'abord, puis les autres fiches préparées', () => {
  const known = people.find(person => person.email);
  const drafts = [draft({ name: 'Nouvelle Personne', email: known.email.toUpperCase() }), draft({ name: 'Inconnu Total', email: 'nouvelle@exemple.fr' }),
    draft({ name: 'Total Inconnu', email: ' NOUVELLE@exemple.fr ' })];
  assert.deepEqual(duplicatesOf(drafts, 0, people, config).email, { kind: 'directory', name: known.name });
  assert.equal(duplicatesOf(drafts, 0, people, config).name, null);
  assert.deepEqual(duplicatesOf(drafts, 1, people, config).email, { kind: 'draft', name: 'Total Inconnu' });
  assert.deepEqual(duplicatesOf(drafts, 1, people, config).name, { kind: 'draft', name: 'Total Inconnu' }, 'même nom, autre ordre');
  const again = [draft({ name: ` ${people[0].name.split(' ').reverse().join(' ')} ` })];
  assert.deepEqual(duplicatesOf(again, 0, people, config).name, { kind: 'directory', name: people[0].name });
  assert.deepEqual(duplicatesOf([draft({ name: 'Seul' })], 0, people, config), { email: null, name: null });
  assert.equal(duplicatesOf([draft({ name: 'Seul', email: '' }), draft({ name: 'Autre', email: '' })], 0, people, config).email, null, 'deux adresses vides ne se ressemblent pas');
});

test('ce qui empêche d\'ajouter : une fiche sans nom, une valeur qui n\'en est pas une, une adresse déjà prise ; une fiche vide ne gêne pas ; la fiche en cause est dite', () => {
  assert.equal(firstProblem([draft(), draft({ name: 'Léa Garnier' })], fields, people, config), null, 'la fiche vide est ignorée');
  const noName = firstProblem([draft({ name: 'Léa Garnier' }), draft({ Contrat: 'Titulaire' })], fields, people, config);
  assert.deepEqual([noName.at, noName.key, noName.phrase], [1, 'name', 'an.edit.errName']);
  const badDate = firstProblem([draft({ name: 'Léa Garnier', Arrivee: '2026-02-31' })], fields, people, config);
  assert.deepEqual([badDate.at, badDate.key, badDate.phrase], [0, 'Arrivee', 'an.edit.errDate']);
  const taken = people.find(person => person.email);
  const mail = firstProblem([draft({ name: 'Léa Garnier' }), draft({ name: 'Noé Petit', email: taken.email })], fields, people, config);
  assert.deepEqual([mail.at, mail.key, mail.phrase, mail.vars.name], [1, 'email', 'an.add.dupEmailDir', taken.name]);
  const twice = firstProblem([draft({ name: 'A Un', email: 'x@exemple.fr' }), draft({ name: 'B Deux', email: 'x@exemple.fr' })], fields, people, config);
  assert.deepEqual([twice.at, twice.phrase], [0, 'an.add.dupEmailDraft']);
});

test('l\'action écrite : une seule `BulkAddRecord`, une ligne par fiche non vide, rien que les colonnes où une fiche au moins a une valeur, jamais une colonne absente', () => {
  const action = bulkAddOf('Personnes', [draft({ name: ' Léa Garnier ', Competences: ['Budget'], manager: 3 }), draft(),
    draft({ name: 'Noé Petit', email: 'noe@exemple.fr', Arrivee: '2016-03-01', Teletravail: true })], fields);
  assert.deepEqual(action, ['BulkAddRecord', 'Personnes', [null, null], {
    Nom: ['Léa Garnier', 'Noé Petit'], Email: ['', 'noe@exemple.fr'], Responsable: [3, 0], Competences: [['L', 'Budget'], null],
    Teletravail: [false, true], Arrivee: [null, 1456790400] }]);
  const known = new Set(schema.Personnes.columns.map(column => column.id));
  assert.ok(Object.keys(action[3]).every(col => known.has(col)), 'toutes les colonnes écrites existent');
  assert.deepEqual(bulkAddOf('Personnes', [draft(), draft()], fields), ['BulkAddRecord', 'Personnes', [], {}], 'rien de saisi : rien à écrire');
  const first = editableFields({ ...config, first: 'Poste' }, schema, 'Personnes', t).fields;
  const one = bulkAddOf('Personnes', [{ before: blankValues(first), values: { ...blankValues(first), first: 'Léa', name: 'Garnier' } }], first);
  assert.deepEqual(one[3], { Poste: ['Léa'], Nom: ['Garnier'] }, 'le prénom d\'une colonne à part s\'écrit dans sa colonne');
});

test('les valeurs d\'une personne déjà là ne sont pas celles d\'une fiche vide ; une colonne calculée reste grisée, hors de l\'action', () => {
  assert.equal(isBlank(fields, personValues(fields, doc.Personnes, 1)), false);
  const calculated = schemaOf(doc._grist_Tables, { ...doc._grist_Tables_column, isFormula: doc._grist_Tables_column.id.map(id => id === 12) });
  const { fields: kept, locked } = editableFields(config, calculated, 'Personnes', t);
  assert.equal(locked.some(entry => entry.key === 'email' && entry.why === 'formula'), true);
  const action = bulkAddOf('Personnes', [{ before: blankValues(kept), values: { ...blankValues(kept), name: 'Léa Garnier' } }], kept);
  assert.equal('Email' in action[3], false, 'une colonne que Grist calcule ne s\'écrit pas');
});

test('qui peut ajouter : les administrateurs ; une liste fusionnée, une copie et un document en lecture disent pourquoi', () => {
  assert.equal(addBlock({ admin: true }, null, t), '');
  assert.equal(addBlock({ admin: false }, null, t), 'an.add.whyAdmins');
  assert.equal(addBlock({ admin: true, merged: true }, null, t), 'an.add.noMerged');
  assert.equal(addBlock({ admin: true, sub: { at: 1 } }, null, t), 'an.add.noSub');
  assert.equal(addBlock({ admin: true }, 'Le document est en lecture seule.', t), 'Le document est en lecture seule.');
  assert.equal(addBlock(null, null, t), '', 'rien à lire : rien à dire');
});

test('chaque phrase de l\'ajout est dite dans les deux langues, avec le même nombre de variables', () => {
  const fr = createI18n('fr');
  const en = createI18n('en');
  const source = ['annuaire-add.js', 'annuaire-add-view.js', 'annuaire-edit-window.js', 'annuaire-add-window.js', 'annuaire-tools.js', 'annuaire-window.js', 'annuaire-control.js']
    .map(name => readFileSync(new URL(`../js/annuaire/${name}`, import.meta.url), 'utf8')).join('\n');
  const keys = [...new Set([...source.matchAll(/'(an\.add(?:\.[A-Za-z]+)?)'/g)].map(match => match[1]))];
  assert.ok(keys.length >= 10, `les phrases citées : ${keys.length}`);
  for (const key of keys) {
    assert.notEqual(fr.t(key), key, `${key} en français`);
    assert.notEqual(en.t(key), key, `${key} en anglais`);
    assert.deepEqual(fr.t(key).match(/\{[a-z]+/g) || [], (en.t(key).match(/\{[a-z]+/g) || []), `${key} : mêmes variables`);
  }
});
