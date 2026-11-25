// Les relations d'un annuaire (module Annuaire, 25/11 : assistant·e, référent·e, suppléant·e) : la configuration qui les garde, la lecture des cellules de
// référence, l'index « qui désigne qui » (dans les deux sens), les petites lignes de l'organigramme. Sur un document fictif (test/annuaire-fixtures.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readConfig, writeConfig, effectiveConfig } from '../js/annuaire/annuaire-config.js';
import { schemaOf } from '../js/annuaire/annuaire-schema.js';
import { buildPeople } from '../js/annuaire/annuaire-model.js';
import { idsOf, relationsOf, relationIndex, cardLines, cardLineCount, TEMPLATES } from '../js/annuaire/annuaire-relations.js';
import { documentFixture, configFixture } from './annuaire-fixtures.mjs';

const doc = documentFixture();
const schema = schemaOf(doc._grist_Tables, doc._grist_Tables_column);
const config = configFixture();
const people = buildPeople(config, 'Personnes', doc, schema);
const named = name => people.find(person => person.name === name);
const t = key => ({ 'an.rel.manager': 'Responsable direct', 'an.rel.team': 'Équipe' })[key] || key;

test('relations : une cellule de référence donne des numéros de ligne, jamais le zéro ni le vide de Grist', () => {
  assert.deepEqual(idsOf(5), [5]);
  assert.deepEqual(idsOf(['L', 1, 2, 0]), [1, 2]);
  for (const empty of [0, null, undefined, '', ['L'], 'texte', 1.5]) assert.deepEqual(idsOf(empty), []);
});

test('relations : la configuration garde le nom, le sens inverse et la ligne de carte ; une colonne ne sert qu\'une fois', () => {
  const read = readConfig({ manager: 'Responsable', relations: [{ col: 'Assistant', label: ' Assistant·e ', inverse: ' de ' }, { col: 'Responsable' }, { col: 'Assistant' },
    { col: 'Referents', card: false }, { label: 'sans colonne' }, null] });
  assert.deepEqual(read.relations, [{ col: 'Assistant', label: 'Assistant·e', inverse: 'de', card: true }, { col: 'Referents', label: '', inverse: '', card: false }]);
  assert.deepEqual(readConfig(writeConfig(read)).relations, read.relations);
  assert.deepEqual(readConfig({}).relations, []);
  assert.deepEqual(readConfig('pas du json').relations, []);
});

test('relations : l\'option « postes et hiérarchie » éteinte ne touche pas aux relations', () => {
  assert.deepEqual(effectiveConfig({ ...config, hierarchy: false }).relations, config.relations);
});

test('relations : les personnes gardent les numéros de ligne désignés, par colonne de relation', () => {
  assert.deepEqual(named('Nathan Roussel').rel, { Assistant: [2], Referents: [] });
  assert.deepEqual(named('Camille Durand').rel, { Assistant: [], Referents: [5, 3] });
  assert.deepEqual(buildPeople({ ...config, relations: [] }, 'Personnes', doc, schema)[0].rel, {});
});

test('relations : le responsable direct passe en premier, avec son nom et son sens inverse', () => {
  const list = relationsOf(config, t);
  assert.deepEqual(list.map(rel => [rel.key, rel.label, rel.inverse, rel.card, rel.manager]),
    [['manager', 'Responsable direct', 'Équipe', false, true], ['rel:Assistant', 'Assistant·e', 'Assistant·e de', true, false], ['rel:Referents', 'Référent·e', '', false, false]]);
  assert.deepEqual(relationsOf({ ...config, manager: '' }, t).map(rel => rel.key), ['rel:Assistant', 'rel:Referents']);
  assert.equal(relationsOf({ ...config, manager: '', relations: [{ col: 'Autre', label: '', inverse: '', card: true }] }, t)[0].label, 'Autre', 'sans nom : la colonne');
});

test('relations : qui désigne qui, dans les deux sens', () => {
  const list = relationsOf(config, t);
  const [manager, assistant, referents] = list;
  const index = relationIndex(people, list);
  const names = each => each.map(person => person.name);
  assert.deepEqual(names(index.direct(named('Nathan Roussel'), assistant)), ['Inès Marchand']);
  assert.deepEqual(names(index.inverse(named('Inès Marchand'), assistant)), ['Emma Rolland', 'Nathan Roussel']);
  assert.deepEqual(names(index.direct(named('Camille Durand'), referents)).sort(), ['Emma Rolland', 'Nathan Roussel']);
  assert.deepEqual(names(index.inverse(named('Emma Rolland'), referents)), ['Camille Durand', 'Inès Marchand']);
  assert.deepEqual(names(index.direct(named('Camille Durand'), manager)), ['Nathan Roussel']);
  assert.deepEqual(names(index.inverse(named('Nathan Roussel'), manager)), ['Camille Durand', 'Inès Marchand']);
  assert.deepEqual(index.direct(named('Yanis Morel'), assistant), []);
  assert.deepEqual(index.inverse(named('Yanis Morel'), assistant), []);
});

test('relations : une ligne désignée qui n\'est pas dans la liste est ignorée (sans nom, ou supprimée)', () => {
  const some = people.filter(person => person.name !== 'Inès Marchand');
  const list = relationsOf(config, t);
  assert.deepEqual(relationIndex(some, list).direct(named('Nathan Roussel'), list[1]), []);
});

test('relations : les petites lignes de la carte, au plus deux, seulement pour les relations qui les demandent', () => {
  const list = relationsOf(config, t);
  const index = relationIndex(people, list);
  assert.deepEqual(cardLines(named('Nathan Roussel'), list, index), ['Assistant·e : Inès Marchand']);
  assert.deepEqual(cardLines(named('Camille Durand'), list, index), [], 'les référents ne demandent pas de ligne');
  const all = list.filter(rel => !rel.manager).map(rel => ({ ...rel, card: true }));
  assert.deepEqual(cardLines(named('Camille Durand'), all, index), ['Référent·e : Emma Rolland, Nathan Roussel']);
  const crowded = [...all, { ...all[0], key: 'rel:Troisieme' }, { ...all[0], key: 'rel:Quatrieme' }];
  const every = { direct: () => [{ name: 'Camille' }] };
  assert.equal(cardLines(named('Camille Durand'), crowded, every).length, 2, 'au plus deux lignes');
  assert.equal(cardLines(named('Camille Durand'), crowded, every, { max: 1 }).length, 1);
  assert.deepEqual(cardLines(named('Camille Durand'), crowded, { direct: () => [] }), [], 'une relation sans personne ne laisse pas de ligne vide');
  assert.equal(cardLineCount(list), 1);
  assert.equal(cardLineCount(crowded), 2);
  assert.equal(cardLineCount([]), 0);
});

test('relations : trois modèles tout prêts', () => assert.deepEqual([...TEMPLATES], ['assistant', 'referent', 'substitute']));
