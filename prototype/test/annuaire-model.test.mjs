// Le modèle de l'annuaire (module Annuaire, 25/11) : la configuration, le schéma des tables, les personnes, l'arbre (niveaux par chemins de colonnes, niveau sauté),
// la recherche, les filtres et l'arbre des responsables. Sur un document fictif (test/annuaire-fixtures.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readConfig, writeConfig, annuairesOf, newRecord, addAction, ANNUAIRES_COLUMNS } from '../js/annuaire/annuaire-config.js';
import { schemaOf, genreOf, targetOf, isPeopleTable, tablesNeeded, columnOf } from '../js/annuaire/annuaire-schema.js';
import { valuesOf, followPath, buildPeople, buildTree, findNode, peopleIn, searchKey, filterPeople, filterOptions, managerTree } from '../js/annuaire/annuaire-model.js';
import { documentFixture, configFixture, metaTables, metaColumns } from './annuaire-fixtures.mjs';

const doc = documentFixture();
const schema = schemaOf(doc._grist_Tables, doc._grist_Tables_column);
const people = buildPeople(configFixture(), 'Personnes', doc, schema);
const named = name => people.find(person => person.name === name);

test('config : une configuration illisible donne une configuration vide, jamais une exception', () => {
  for (const source of [undefined, null, '', 'pas du json', '[]', '{"levels": 3}', 42]) {
    const config = readConfig(source);
    assert.deepEqual(config.levels, []);
    assert.deepEqual(config.fields, []);
    assert.equal(config.name, '');
    assert.equal(config.v, 1);
  }
});

test('config : les niveaux sans colonne et les champs en double sont écartés, le reste est gardé', () => {
  const config = readConfig({ name: ' Nom ', levels: [{ label: 'Pôle', path: ['Structure', 'Pole', ''] }, { label: 'Vide', path: [] }, null, { path: 'x' }],
    fields: [{ col: 'Contrat', filter: 1 }, { col: 'Contrat' }, { col: '' }, { col: 'Site', filter: false }], inconnue: 'perdue' });
  assert.equal(config.name, 'Nom');
  assert.deepEqual(config.levels, [{ label: 'Pôle', path: ['Structure', 'Pole'] }]);
  assert.deepEqual(config.fields, [{ col: 'Contrat', filter: true }, { col: 'Site', filter: false }]);
  assert.equal('inconnue' in config, false);
  assert.deepEqual(readConfig(writeConfig(config)), config);
});

test('config : les annuaires d\'une table lue ; une ligne sans nom ou sans table est ignorée', () => {
  const data = { id: [1, 2, 3], Nom: ['Principal', '', 'Sans table'], Table: ['Personnes', 'Personnes', ''], Config: [writeConfig(configFixture()), '', ''], Parent: ['', '', ''] };
  const found = annuairesOf(data);
  assert.equal(found.length, 1);
  assert.deepEqual([found[0].row, found[0].name, found[0].table, found[0].parent], [1, 'Principal', 'Personnes', '']);
  assert.deepEqual(found[0].config.levels.map(level => level.label), ['Pôle', 'Direction', 'Service']);
  assert.deepEqual(annuairesOf(null), []);
  assert.deepEqual(ANNUAIRES_COLUMNS.map(column => column.id), ['Nom', 'Table', 'Config', 'Parent']);
  assert.deepEqual(addAction('GFS_Annuaires', newRecord(' A ', 'Personnes', configFixture())).slice(0, 3), ['AddRecord', 'GFS_Annuaires', null]);
});

test('schéma : les colonnes de chaque table, leur genre et la table visée ; les colonnes de Grist sont ignorées', () => {
  assert.equal(genreOf('Ref:Structures'), 'ref');
  assert.equal(genreOf('RefList:X'), 'reflist');
  assert.equal(genreOf('DateTime:UTC'), 'date');
  assert.equal(genreOf('Choice'), 'choice');
  assert.equal(genreOf('Quelque chose'), 'text');
  assert.equal(targetOf('Ref:Structures'), 'Structures');
  assert.equal(targetOf('Text'), '');
  const ids = schema.Personnes.columns.map(column => column.id);
  assert.ok(ids.includes('Nom') && ids.includes('Structure'));
  assert.equal(ids.includes('gristHelper_Display'), false);
  assert.equal(ids.includes('manualSort'), false);
  assert.deepEqual(columnOf(schema, 'Personnes', 'Structure'), { id: 'Structure', type: 'Ref:Structures', genre: 'ref', ref: 'Structures', visible: 'Nom' });
  assert.equal(columnOf(schema, 'Personnes', 'Absente'), null);
  assert.equal(isPeopleTable('Personnes'), true);
  assert.equal(isPeopleTable('GFS_Annuaires'), false);
  assert.equal(isPeopleTable('_grist_Tables'), false);
});

test('schéma : une table de synthèse n\'est pas proposée', () => {
  const tables = { ...metaTables(), id: [1, 2, 3, 9], tableId: ['Personnes', 'Structures', 'GFS_Annuaires', 'Personnes_summary_Pole'], summarySourceTable: [0, 0, 0, 1] };
  assert.equal('Personnes_summary_Pole' in schemaOf(tables, metaColumns()), false);
});

test('schéma : les tables que la lecture demande suivent les références, de proche en proche', () => {
  assert.deepEqual([...tablesNeeded(configFixture(), 'Personnes', schema)].sort(), ['Personnes', 'Structures']);
  assert.deepEqual([...tablesNeeded(readConfig({ name: 'Nom' }), 'Personnes', schema)], ['Personnes']);
});

test('valeurs : un texte, un choix multiple, une date, un oui/non et une référence', () => {
  const ctx = (() => { const data = doc; return { data, schema, at: (table, id) => data[table].id.indexOf(id) }; })();
  const col = id => columnOf(schema, 'Personnes', id);
  assert.deepEqual(valuesOf('  Camille   Durand ', col('Nom'), ctx), ['Camille Durand']);
  assert.deepEqual(valuesOf(['L', 'Budget', 'Marchés publics'], col('Competences'), ctx), ['Budget', 'Marchés publics']);
  assert.deepEqual(valuesOf(null, col('Competences'), ctx), []);
  assert.deepEqual(valuesOf(true, col('Teletravail'), ctx), ['true']);
  assert.deepEqual(valuesOf(false, col('Teletravail'), ctx), ['false']);
  assert.deepEqual(valuesOf(null, col('Teletravail'), ctx), []);
  assert.deepEqual(valuesOf(1456790400, col('Arrivee'), ctx), ['2016-03-01']);
  assert.deepEqual(valuesOf(5, col('Structure'), ctx), ['Budget']);
  assert.deepEqual(valuesOf(0, col('Structure'), ctx), []);
  assert.deepEqual(valuesOf(999, col('Structure'), ctx), []);
});

test('chemins : une colonne, puis des références ; un maillon vide ou qui n\'est pas une référence ne donne rien', () => {
  const ctx = { data: doc, schema, at: (table, id) => doc[table].id.indexOf(id) };
  const at = name => doc.Personnes.Nom.indexOf(name);
  assert.deepEqual(followPath(ctx, 'Personnes', at('Camille Durand'), ['Structure', 'Pole']), ['Pôle Ressources']);
  assert.deepEqual(followPath(ctx, 'Personnes', at('Camille Durand'), ['Structure', 'Direction']), ['Direction des finances']);
  assert.deepEqual(followPath(ctx, 'Personnes', at('Emma Rolland'), ['Structure', 'Direction']), []); // un pôle n'a pas de direction
  assert.deepEqual(followPath(ctx, 'Personnes', at('Camille Durand'), ['Nom', 'Pole']), []); // « Nom » n'est pas une référence
  assert.deepEqual(followPath(ctx, 'Personnes', at('Camille Durand'), ['Absente']), []);
  assert.deepEqual(followPath(ctx, 'Personnes', 0, []), []);
});

test('personnes : triées par nom, leurs colonnes et leurs niveaux lus', () => {
  assert.deepEqual(people.map(person => person.name), ['Camille Durand', 'Emma Rolland', 'Inès Marchand', 'Louis Girard', 'Nathan Roussel', 'Yanis Morel']);
  const camille = named('Camille Durand');
  assert.deepEqual([camille.title, camille.email, camille.phone], ['Cheffe du service Budget', 'camille.durand@exemple.fr', '01 02 03 04 11']);
  assert.deepEqual(camille.levels, ['Pôle Ressources', 'Direction des finances', 'Budget']);
  assert.deepEqual(camille.fields.Competences, ['Budget', 'Marchés publics']);
  assert.equal(camille.lead, true);
  assert.equal(named('Inès Marchand').lead, false);
  assert.equal(named('Inès Marchand').manager, 3);
  assert.equal(named('Emma Rolland').manager, null);
  assert.deepEqual(named('Emma Rolland').levels, ['Pôle Ressources', '', '']); // niveaux sautés
});

test('personnes : une table absente, ou une ligne sans nom, ne donne personne', () => {
  assert.deepEqual(buildPeople(configFixture(), 'Absente', doc, schema), []);
  const blank = { ...doc, Personnes: { ...doc.Personnes, Nom: ['', ...doc.Personnes.Nom.slice(1)] } };
  assert.equal(buildPeople(configFixture(), 'Personnes', blank, schema).length, 5);
});

test('arbre : un niveau sauté range la personne au niveau qu\'elle a ; les comptes montent', () => {
  const tree = buildTree(people, configFixture().levels, 'Métropole Exemple');
  assert.equal(tree.count, 6);
  assert.deepEqual(tree.ch.map(node => [node.name, node.count]), [['Pôle Numérique', 1], ['Pôle Ressources', 4], ['Pôle Vie de campus', 1]]);
  const ressources = tree.ch[1];
  assert.deepEqual(ressources.own.map(person => person.name), ['Emma Rolland']); // sans direction : rangée dans son pôle
  assert.deepEqual(ressources.ch.map(node => [node.name, node.count, node.own.length]), [['Direction des finances', 3, 2]]);
  assert.deepEqual(ressources.ch[0].ch.map(node => [node.name, node.level, node.own.map(person => person.name)]), [['Budget', 2, ['Camille Durand']]]);
});

test('arbre : un même nom à deux endroits fait deux nœuds ; on retrouve un nœud par son identifiant', () => {
  const same = people.map((person, i) => ({ ...person, levels: i < 2 ? ['A', 'Commun', ''] : ['B', 'Commun', ''] }));
  const tree = buildTree(same, configFixture().levels, 'Tout');
  assert.deepEqual(tree.ch.map(node => node.name), ['A', 'B']);
  assert.notEqual(tree.ch[0].ch[0].id, tree.ch[1].ch[0].id);
  assert.equal(findNode(tree, tree.ch[1].ch[0].id), tree.ch[1].ch[0]);
  assert.equal(findNode(tree, ''), tree);
  assert.equal(findNode(tree, 'inconnu'), null);
  assert.deepEqual(peopleIn(tree.ch[0]).map(person => person.name), ['Camille Durand', 'Emma Rolland']);
});

test('arbre : sans niveau, tout le monde est à la racine', () => {
  const tree = buildTree(people, [], 'Tout');
  assert.equal(tree.ch.length, 0);
  assert.equal(tree.own.length, 6);
});

test('recherche : des mots dans n\'importe quel ordre, accents et casse ignorés, sur le nom, le poste, les niveaux et les champs', () => {
  const found = (query, filters) => filterPeople(people, { query, filters }).map(person => person.name);
  assert.deepEqual(found('durand camille'), ['Camille Durand']);
  assert.deepEqual(found('INES'), ['Inès Marchand']);
  assert.deepEqual(found('direction finances'), ['Camille Durand', 'Inès Marchand', 'Nathan Roussel']);
  assert.deepEqual(found('marches publics'), ['Camille Durand', 'Inès Marchand']);
  assert.deepEqual(found('introuvable'), []);
  assert.equal(found('').length, 6);
  assert.match(searchKey(people[0]), /durand/);
});

test('filtres : « ou » dans un champ, « et » entre les champs', () => {
  const found = filters => filterPeople(people, { filters }).map(person => person.name);
  assert.deepEqual(found({ Contrat: new Set(['Contractuelle']) }), ['Inès Marchand']);
  assert.deepEqual(found({ Competences: new Set(['Budget', 'Pilotage']) }), ['Camille Durand', 'Louis Girard']);
  assert.deepEqual(found({ Competences: new Set(['Budget', 'Pilotage']), Teletravail: new Set(['true']) }), ['Camille Durand', 'Louis Girard']);
  assert.deepEqual(found({ Competences: new Set(['Budget']), Contrat: new Set(['Contractuelle']) }), []);
  assert.deepEqual(found({ Contrat: new Set() }).length, 6);
});

test('filtres : un filtre par champ marqué, avec le nombre de personnes par valeur ; une date n\'en donne pas', () => {
  const options = filterOptions(people, configFixture(), schema, 'Personnes');
  assert.deepEqual(options.map(option => option.col), ['Contrat', 'Competences', 'Teletravail']);
  assert.deepEqual(options[0].values, [{ value: 'Titulaire', count: 5 }, { value: 'Contractuelle', count: 1 }]);
  assert.deepEqual(options[1].values.map(value => [value.value, value.count]), [['Marchés publics', 2], ['Budget', 1], ['Pilotage', 1]]);
  assert.deepEqual(options[2].values, [{ value: 'true', count: 3 }, { value: 'false', count: 2 }]);
});

test('responsables : l\'arbre des personnes d\'après leur responsable, un cycle est coupé', () => {
  const roots = managerTree(people);
  assert.deepEqual(roots.map(node => node.person.name), ['Emma Rolland', 'Yanis Morel']);
  const emma = roots[0];
  assert.deepEqual(emma.ch.map(node => node.person.name), ['Louis Girard', 'Nathan Roussel']);
  assert.deepEqual(emma.ch[1].ch.map(node => node.person.name), ['Camille Durand', 'Inès Marchand']);
  const loop = [{ row: 1, name: 'A', manager: 2 }, { row: 2, name: 'B', manager: 1 }, { row: 3, name: 'C', manager: 3 }, { row: 4, name: 'D', manager: 9 }];
  assert.equal(managerTree(loop).length, 4); // chacun est une racine : le cycle, le responsable de soi et l'absent
});
