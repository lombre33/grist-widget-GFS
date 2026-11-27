// L'éditeur du guide (module Guide, 27/11) : les champs que GFS sait écrire, le dossier d'une démarche (seulement ce qui change, seulement les colonnes qui existent),
// les actions de Grist, les mères possibles (jamais une boucle) et les choix d'un rôle. Sur le document fictif de test/guide-fixtures.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readConfig } from '../js/guide/guide-config.js';
import { buildProcedures, buildIndex } from '../js/guide/guide-model.js';
import { directoryOf } from '../js/guide/guide-contacts.js';
import { fieldsOf, valuesFrom, recordOf, problemOf, mothersFor, descendantsOf, removeActions, addRecordAction, updateRecordAction, choicesFor } from '../js/guide/guide-write.js';
import { schemaOf } from '../js/annuaire/annuaire-schema.js';
import { buildPeople, buildTree } from '../js/annuaire/annuaire-model.js';
import { guideDocument, guideConfig, configFixture, PROCEDURES_TABLE } from './guide-fixtures.mjs';

const doc = guideDocument();
const schema = schemaOf(doc._grist_Tables, doc._grist_Tables_column);
const config = readConfig(guideConfig());
const procs = buildProcedures(config, PROCEDURES_TABLE, doc, schema);
const index = buildIndex(procs);
const titled = title => procs.find(proc => proc.title === title);
const dirConfig = configFixture();
const people = buildPeople(dirConfig, 'Personnes', doc, schema);
const directory = directoryOf({ annuaire: { table: 'Personnes', name: 'Annuaire' }, people, tree: buildTree(people, dirConfig.levels, 'Annuaire') });
const fields = fieldsOf(config, schema, PROCEDURES_TABLE, directory);
const field = key => fields.find(item => item.key === key);

test('champs : le titre, la mère, les mots-clés, les étapes, les détails, puis un champ par rôle, avec ce que son type dit', () => {
  assert.deepEqual(fields.map(item => item.key), ['title', 'parent', 'keywords', 'steps', 'details', 'role:Demander', 'role:Valider', 'role:Probleme', 'role:Defaut']);
  assert.equal(field('title').mode, 'text');
  assert.equal(field('parent').mode, 'ref');
  assert.deepEqual([field('role:Demander'), field('role:Valider'), field('role:Probleme')].map(item => [item.mode, item.kind]), [['ref', 'service'], ['ref', 'person'], ['text', 'post']]);
  const none = fieldsOf(readConfig({ title: 'Titre', parent: 'Mots', roles: [{ col: 'Absente' }] }), schema, PROCEDURES_TABLE, directory);
  assert.deepEqual(none.map(item => item.key), ['title', 'role:Absente'], 'une mère qui n\'est pas une référence à la table n\'est pas proposée');
  assert.equal(none[1].mode, '', 'une colonne absente ne s\'écrit pas');
});

test('dossier : une démarche neuve écrit tous ses champs ; une démarche changée n\'écrit que ce qui a changé', () => {
  const fresh = valuesFrom(null, 1);
  assert.deepEqual(recordOf(fields, { ...fresh, title: ' Nouvelle ', steps: 'Une\nDeux', roles: { Valider: { id: 3, text: '' }, Probleme: { id: null, text: ' Poste X ' } } }), {
    Titre: 'Nouvelle', Mere: 1, Mots: '', Etapes: 'Une\nDeux', Details: '', Demander: 0, Valider: 3, Probleme: 'Poste X', Defaut: 0 });
  const proc = titled('Poser des congés');
  const before = valuesFrom(proc);
  assert.equal(before.keywords, 'vacances, RTT, jours');
  assert.deepEqual(recordOf(fields, before, before), {}, 'rien n\'a changé : rien ne s\'écrit (les mots-clés ne sont pas réécrits)');
  assert.deepEqual(recordOf(fields, { ...before, title: 'Poser un congé', roles: { ...before.roles, Valider: { id: 4, text: '' } } }, before), { Titre: 'Poser un congé', Valider: 4 });
  assert.deepEqual(recordOf(fields, { ...before, parent: null }, before), { Mere: 0 }, 'sans mère : la référence vide est 0');
});

test('dossier : une colonne absente ou d\'un type que GFS ne sait pas écrire n\'est jamais dans le dossier', () => {
  const odd = fieldsOf(readConfig({ title: 'Titre', keywords: 'Absente', roles: [{ col: 'Absente' }] }), schema, PROCEDURES_TABLE, directory);
  assert.deepEqual(Object.keys(recordOf(odd, { ...valuesFrom(null), title: 'A', keywords: 'x' })), ['Titre']);
});

test('refus : un titre vide, ou pas de colonne de titre', () => {
  assert.equal(problemOf(fields, valuesFrom(null)), 'gd.proc.errTitle');
  assert.equal(problemOf(fields, { ...valuesFrom(null), title: ' ' }), 'gd.proc.errTitle');
  assert.equal(problemOf(fields, { ...valuesFrom(null), title: 'A' }), '');
  assert.equal(problemOf(fieldsOf(readConfig({}), schema, PROCEDURES_TABLE, directory), { title: 'A' }), 'gd.proc.errNoTitleCol');
});

test('mères possibles : jamais la démarche elle-même ni ce qui est dessous (une boucle)', () => {
  assert.deepEqual(descendantsOf(index, 1).sort(), [2, 3]);
  const mothers = mothersFor(procs, index, 1).map(proc => proc.row);
  assert.ok(!mothers.includes(1) && !mothers.includes(2) && !mothers.includes(3));
  assert.ok(mothers.includes(4));
  assert.equal(mothersFor(procs, index, null).length, procs.length, 'une démarche neuve peut avoir n\'importe quelle mère');
});

test('actions : ajouter, réécrire, retirer (les filles passent à la racine dans le même lot)', () => {
  assert.deepEqual(addRecordAction('T', { A: 1 }), ['AddRecord', 'T', null, { A: 1 }]);
  assert.deepEqual(updateRecordAction('T', 4, { A: 1 }), ['UpdateRecord', 'T', 4, { A: 1 }]);
  assert.deepEqual(removeActions('T', 1, [2, 5], 'Mere'), [['UpdateRecord', 'T', 2, { Mere: 0 }], ['UpdateRecord', 'T', 5, { Mere: 0 }], ['RemoveRecord', 'T', 1]]);
  assert.deepEqual(removeActions('T', 1, [2], ''), [['RemoveRecord', 'T', 1]], 'sans colonne de mère, rien à relever');
});

test('choix d\'un rôle : les personnes de l\'annuaire, ou les lignes de la table que la colonne vise (par leur valeur visible)', () => {
  const persons = choicesFor(field('role:Valider'), { directory, data: doc });
  assert.ok(persons.some(choice => choice.label === 'Nathan Roussel' && choice.value === 3 && choice.hint === 'Directeur des finances'));
  const services = choicesFor(field('role:Demander'), { directory, data: doc });
  assert.ok(services.some(choice => choice.label === 'Budget'));
  assert.deepEqual(services.map(choice => choice.label), [...services.map(choice => choice.label)].sort((a, b) => a.localeCompare(b, 'fr')));
  assert.deepEqual(choicesFor(field('role:Probleme'), { directory, data: doc }), [], 'un poste est un texte : aucun choix');
});
