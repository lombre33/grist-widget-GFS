// Le modèle de l'annuaire (module Annuaire, 25/11) : la configuration, le schéma des tables, les personnes, l'arbre (niveaux par chemins de colonnes, niveau sauté),
// la recherche, les filtres et l'arbre des responsables. Sur un document fictif (test/annuaire-fixtures.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readConfig, writeConfig, annuairesOf, newRecord, addAction, effectiveConfig, fieldPath, fieldLabel, keyPath, ANNUAIRES_COLUMNS } from '../js/annuaire/annuaire-config.js';
import { schemaOf, genreOf, targetOf, isPeopleTable, tablesNeeded, columnOf, columnAt } from '../js/annuaire/annuaire-schema.js';
import { valuesOf, followPath, buildPeople, buildTree, findNode, peopleIn, searchKey, filterPeople, filterOptions, managerTree, withManagers, nameOf, fieldGenres,
  levelKey, valuesFor } from '../js/annuaire/annuaire-model.js';
import { telHref, listColumns } from '../js/annuaire/annuaire-items.js';
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

test('config : les options (À vérifier, Ma présence, Écrire au groupe) ont leurs valeurs par défaut et se relisent sans rien perdre', () => {
  const bare = readConfig({});
  assert.deepEqual(bare.checks, ['dup', 'mail', 'att', 'resp'], 'tous les contrôles sauf « départ dépassé », qui demande une colonne');
  assert.deepEqual(bare.mail, { per: 40, to: 'bcc' });
  assert.deepEqual(bare.presence, { on: false, col: '' });
  assert.equal(bare.leave, '');
  const set = readConfig({ checks: ['dep', 'dup', 'inconnu', 'dup'], leave: ' Depart ', presence: { on: true, col: ' Visible ' }, mail: { per: 12.4, to: 'to' } });
  assert.deepEqual(set.checks, ['dup', 'dep'], 'l\'ordre est celui de la fenêtre, sans inconnu ni doublon');
  assert.equal(set.leave, 'Depart');
  assert.deepEqual(set.presence, { on: true, col: 'Visible' });
  assert.deepEqual(set.mail, { per: 12, to: 'to' });
  assert.equal(readConfig({ presence: { on: true, col: '' } }).presence.on, false, 'sans colonne, « Ma présence » ne peut pas être allumée');
  assert.equal(readConfig({ mail: { per: 1 } }).mail.per, 5);
  assert.equal(readConfig({ mail: { per: 9999 } }).mail.per, 200);
  assert.equal(readConfig({ mail: { per: 'x', to: 'cc' } }).mail.per, 40);
  assert.equal(readConfig({ mail: { to: 'cc' } }).mail.to, 'bcc');
  assert.deepEqual(readConfig({ checks: [] }).checks, [], 'tous les contrôles éteints : permis');
  assert.deepEqual(readConfig(writeConfig(set)), set);
});

test('config : les niveaux sans colonne et les champs en double sont écartés, le reste est gardé', () => {
  const config = readConfig({ name: ' Nom ', levels: [{ label: 'Pôle', path: ['Structure', 'Pole', ''] }, { label: 'Vide', path: [] }, null, { path: 'x' }],
    fields: [{ col: 'Contrat', filter: 1 }, { col: 'Contrat' }, { col: '' }, { col: 'Site', filter: false }], inconnue: 'perdue' });
  assert.equal(config.name, 'Nom');
  assert.deepEqual(config.levels, [{ label: 'Pôle', path: ['Structure', 'Pole'] }]);
  assert.deepEqual(config.fields, [{ col: 'Contrat', path: [], filter: true, list: false, column: false }, { col: 'Site', path: [], filter: false, list: false, column: false }]);
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
  assert.deepEqual(columnOf(schema, 'Personnes', 'Structure'), { id: 'Structure', type: 'Ref:Structures', genre: 'ref', ref: 'Structures', visible: 'Nom', formula: false, choices: [] });
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
  const options = filterOptions(people, configFixture(), schema, 'Personnes').filter(option => !option.col.startsWith('@L'));
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

// ---------- le réglage en onglets (demande du porteur du 25/11) ----------

test('config : l\'option « postes et hiérarchie » est éteinte par défaut, et allumée pour une ligne écrite avant elle qui a un poste ou des niveaux', () => {
  assert.equal(readConfig({}).hierarchy, false);
  assert.equal(readConfig({ name: 'Nom', email: 'Email' }).hierarchy, false);
  assert.equal(readConfig({ levels: [{ label: 'Pôle', path: ['Pole'] }] }).hierarchy, true);
  assert.equal(readConfig({ title: 'Poste' }).hierarchy, true);
  assert.equal(readConfig({ lead: 'Chef' }).hierarchy, true);
  assert.equal(readConfig({ title: 'Poste', hierarchy: false }).hierarchy, false);
  assert.equal(readConfig({ hierarchy: 'oui' }).hierarchy, false);
  assert.equal(readConfig(writeConfig(readConfig({ hierarchy: true }))).hierarchy, true);
});

test('config : éteinte, l\'option met de côté le poste, « responsable de sa structure » et les niveaux, qu\'elle garde écrits ; le responsable direct reste', () => {
  const written = readConfig({ name: 'Nom', title: 'Poste', lead: 'Chef', manager: 'Responsable', levels: [{ label: 'Pôle', path: ['Pole'] }], hierarchy: false });
  assert.equal(written.levels.length, 1);
  const used = effectiveConfig(written);
  assert.deepEqual([used.title, used.lead, used.levels, used.manager, used.name], ['', '', [], 'Responsable', 'Nom']);
  assert.equal(effectiveConfig({ ...written, hierarchy: true }).levels.length, 1);
  assert.equal(effectiveConfig({ levels: [{ label: 'x', path: ['y'] }] }).levels.length, 1, 'une configuration qui n\'a pas passé par readConfig est lue comme allumée');
});

test('config : l\'ordre du nom est celui qu\'on a dit, sinon « prénom nom » ; les champs gardent « liste »', () => {
  assert.equal(readConfig({}).order, 'first-last');
  assert.equal(readConfig({ order: 'last-first' }).order, 'last-first');
  assert.equal(readConfig({ order: 'au hasard' }).order, 'first-last');
  assert.equal(readConfig({ order: 'last-comma' }).order, 'last-comma');
  assert.deepEqual([readConfig({}).upper, readConfig({ upper: true }).upper, readConfig({ upper: 'oui' }).upper], [false, true, false]);
  assert.equal(readConfig({ first: ' Prénom ' }).first, 'Prénom');
  assert.deepEqual(readConfig({ fields: [{ col: 'Contrat', list: true }] }).fields, [{ col: 'Contrat', path: [], filter: false, list: true, column: false }]);
});

test('nom : une colonne seule, ou le prénom et le nom dans l\'ordre dit ; le tri est par nom de famille, les initiales celles du prénom et du nom', () => {
  assert.deepEqual(nameOf('', 'Camille Martin', 'first-last'), { name: 'Camille Martin', sort: 'Camille Martin', initials: 'CM' });
  assert.deepEqual(nameOf('Camille', 'Martin', 'first-last'), { name: 'Camille Martin', sort: 'Martin Camille', initials: 'CM' });
  assert.deepEqual(nameOf('Camille', 'Martin', 'last-first'), { name: 'Martin Camille', sort: 'Martin Camille', initials: 'CM' });
  assert.equal(nameOf('Élodie', 'de la Fontaine', 'first-last').initials, 'ÉD');
  assert.equal(nameOf('Jean-Pierre', 'Roux', 'last-first').initials, 'JR');
  assert.deepEqual(nameOf('', '', 'first-last'), { name: '', sort: '', initials: '' });
});

test('nom : les autres écritures (retour du porteur, 25/11) : « Prénom NOM », « NOM Prénom », « Nom, Prénom » ; le tri et les initiales gardent le nom tel qu\'il est écrit dans la table', () => {
  assert.equal(nameOf('Camille', 'Martin', 'first-last', true).name, 'Camille MARTIN');
  assert.equal(nameOf('Camille', 'Martin', 'last-first', true).name, 'MARTIN Camille');
  assert.equal(nameOf('Camille', 'Martin', 'last-comma').name, 'Martin, Camille');
  assert.equal(nameOf('Camille', 'Martin', 'last-comma', true).name, 'MARTIN, Camille');
  assert.equal(nameOf('Élodie', 'de la Fontaine', 'first-last', true).name, 'Élodie DE LA FONTAINE');
  assert.deepEqual(nameOf('Camille', 'Martin', 'first-last', true), { name: 'Camille MARTIN', sort: 'Martin Camille', initials: 'CM' });
  assert.equal(nameOf('', 'Camille Martin', 'first-last', true).name, 'Camille Martin', 'un nom en une seule colonne s\'écrit comme la table l\'écrit');
});

test('personnes : avec une colonne de prénom, le nom s\'écrit dans l\'ordre dit, la liste est triée par nom de famille et la recherche trouve les deux', () => {
  const split = structuredClone(doc);
  split.Personnes.Prenom = ['Camille', 'Inès', 'Nathan', 'Louis', 'Emma', 'Yanis'];
  split.Personnes.Famille = ['Durand', 'Marchand', 'Roussel', 'Girard', 'Rolland', 'Morel'];
  const wide = structuredClone(schema);
  wide.Personnes.columns.push({ id: 'Prenom', type: 'Text', genre: 'text', ref: '', visible: '' }, { id: 'Famille', type: 'Text', genre: 'text', ref: '', visible: '' });
  const config = { ...configFixture(), name: 'Famille', first: 'Prenom' };
  const list = buildPeople(config, 'Personnes', split, wide);
  assert.deepEqual(list.map(person => person.name), ['Louis Girard', 'Camille Durand', 'Inès Marchand', 'Yanis Morel', 'Emma Rolland', 'Nathan Roussel'].sort((a, b) =>
    a.split(' ').at(-1).localeCompare(b.split(' ').at(-1), 'fr')));
  assert.equal(list.find(person => person.name === 'Camille Durand').initials, 'CD');
  const reversed = buildPeople({ ...config, order: 'last-first' }, 'Personnes', split, wide);
  assert.equal(reversed.find(person => person.row === 1).name, 'Durand Camille');
  assert.deepEqual(filterPeople(list, { query: 'durand camille' }).map(person => person.row), [1]);
  assert.deepEqual(tablesNeeded(config, 'Personnes', wide).has('Personnes'), true);
});

test('numéro : le lien d\'appel ne garde que ce qui se compose (chiffres, « + » du début, sans « (0) » ni numéro de poste) ; un texte ou un numéro trop court n\'en donne pas', () => {
  assert.equal(telHref('01 02 03 04 05'), 'tel:0102030405');
  assert.equal(telHref('06.12.34.56.78'), 'tel:0612345678');
  assert.equal(telHref('+33 (0)1 02 03 04 55'), 'tel:+33102030455');
  assert.equal(telHref('01 02 03 04 55, poste 12'), 'tel:0102030455');
  assert.equal(telHref('01 02 03 04 55 p. 12'), 'tel:0102030455');
  for (const none of ['', null, undefined, 'poste 12', 'ext. 4455', '12', 'standard du lundi 0102030405']) assert.equal(telHref(none), null);
});

test('champs : une colonne de la table, ou un chemin à suivre (retour du porteur, 25/11) ; sa clé, son nom, son genre, ses valeurs, son filtre et les tables lues', () => {
  const read = readConfig({ fields: [{ col: 'Contrat' }, { path: ['Structure', 'Pole'], filter: true, list: true }, { col: 'Structure', path: ['Structure'] }, { path: ['Structure', 'Pole'] }] });
  assert.deepEqual(read.fields, [{ col: 'Contrat', path: [], filter: false, list: false, column: false },
    { col: 'Structure › Pole', path: ['Structure', 'Pole'], filter: true, list: true, column: false },
    { col: 'Structure', path: [], filter: false, list: false, column: false }], 'une colonne seule garde sa clé ; le même chemin ne compte qu\'une fois');
  const [contrat, chemin] = read.fields;
  assert.deepEqual([fieldPath(contrat), fieldPath(chemin), fieldLabel(contrat), fieldLabel(chemin)], [['Contrat'], ['Structure', 'Pole'], 'Contrat', 'Pole']);
  assert.deepEqual(JSON.parse(writeConfig(read)).fields[1], { col: 'Structure › Pole', path: ['Structure', 'Pole'], filter: true, list: true, column: false });
  const config = { ...configFixture(), fields: [{ col: 'Pôle de la structure', path: ['Structure', 'Pole'], filter: true, list: true }] };
  const built = buildPeople(config, 'Personnes', doc, schema);
  assert.deepEqual(built.find(person => person.row === 1).fields['Pôle de la structure'], ['Pôle Ressources']);
  assert.deepEqual(fieldGenres(config, 'Personnes', schema), { 'Pôle de la structure': 'ref' });
  const options = filterOptions(built, config, schema, 'Personnes').filter(option => !option.col.startsWith('@L'));
  assert.equal(options[0].col, 'Pôle de la structure');
  assert.equal(options[0].label, 'Pole');
  assert.ok(options[0].values.some(entry => entry.value === 'Pôle Ressources'));
  assert.equal(columnAt(schema, 'Personnes', ['Structure', 'Pole']).id, 'Pole');
  assert.equal(columnAt(schema, 'Personnes', ['Nom', 'Pole']), null, 'on ne suit qu\'une référence simple');
  assert.equal(columnAt(schema, 'Personnes', ['Inconnue']), null);
  assert.ok(tablesNeeded(config, 'Personnes', schema).has('Structures'), 'le chemin d\'un champ fait lire la table qu\'il suit');
});

// ---------- les sept retours du 25/11 (colonnes de la liste, sous-attribut d'une référence, filtres d'organigramme, recherche) ----------

test('config : un champ garde « colonne », les colonnes fixes (adresse, numéro) se gardent dans l\'ordre de la liste, le reste est écarté', () => {
  const read = readConfig({ columns: ['phone', 'email', 'phone', 'poste', 3], fields: [{ col: 'Contrat', column: true }, { col: 'Site', column: 1 }, { col: 'Service' }] });
  assert.deepEqual(read.columns, ['email', 'phone']);
  assert.deepEqual(read.fields.map(field => field.column), [true, true, false]);
  assert.deepEqual(readConfig({}).columns, []);
  assert.deepEqual(readConfig(writeConfig(read)), read);
  const config = readConfig({ email: 'Email', phone: 'Tel', columns: ['email', 'phone'], fields: [{ col: 'Contrat', column: true }, { col: 'Site', column: false }] });
  const t = key => ({ 'an.mail': 'E-mail', 'an.phone': 'Téléphone' })[key];
  assert.deepEqual(listColumns(config, t), [{ key: 'email', label: 'E-mail', fixed: true }, { key: 'phone', label: 'Téléphone', fixed: true },
    { key: 'Contrat', label: 'Contrat', fixed: false }]);
  assert.deepEqual(listColumns(readConfig({ phone: 'Tel', columns: ['email'] }), t), [], 'une colonne fixe sans colonne de la table n\'a rien à montrer');
});

test('chemins : le poste, le nom, l\'adresse peuvent suivre une référence (« Structure › Niveau ») ; les tables suivies sont lues', () => {
  assert.deepEqual(keyPath('Structure › Niveau'), ['Structure', 'Niveau']);
  assert.deepEqual(keyPath('Poste'), ['Poste']);
  assert.deepEqual(keyPath(''), []);
  const config = { ...configFixture(), title: 'Structure › Niveau' };
  const list = buildPeople(config, 'Personnes', doc, schema);
  assert.equal(list.find(person => person.row === 1).title, 'Service', 'le poste est la colonne choisie de la table liée, pas ce que la référence affiche');
  assert.equal(list.find(person => person.row === 3).title, 'Direction');
  assert.ok(tablesNeeded(config, 'Personnes', schema).has('Structures'));
  assert.equal(buildPeople({ ...configFixture(), title: 'Structure › Inconnue' }, 'Personnes', doc, schema).every(person => person.title === ''), true);
});

test('recherche : le nom (prénom compris), le poste, l\'adresse, le numéro avec ou sans espaces, les niveaux et les champs', () => {
  const found = query => filterPeople(people, { query }).map(person => person.row);
  assert.deepEqual(found('camille'), [1]);
  assert.deepEqual(found('0102030411'), [1], 'le numéro se trouve sans ses espaces');
  assert.deepEqual(found('01 02 03'), [1]);
  assert.deepEqual(found('titulaire pilotage'), [4], 'un champ de la fiche (le contrat, une compétence) se cherche');
  assert.deepEqual(found('siège'), [], 'une colonne que l\'annuaire ne montre pas (ici « Site ») n\'est pas cherchée');
  assert.deepEqual(found('ressources'), [1, 5, 2, 3], 'un niveau de la hiérarchie se cherche');
});

test('filtres : un filtre par niveau de la hiérarchie, puis ceux des champs ; les mêmes valeurs pour l\'un et pour l\'autre', () => {
  const options = filterOptions(people, configFixture(), schema, 'Personnes');
  assert.deepEqual(options.slice(0, 3).map(option => [option.col, option.label]), [[levelKey(0), 'Pôle'], [levelKey(1), 'Direction'], [levelKey(2), 'Service']]);
  assert.deepEqual(options[0].values.map(entry => [entry.value, entry.count]), [['Pôle Ressources', 4], ['Pôle Numérique', 1], ['Pôle Vie de campus', 1]]);
  const person = people.find(each => each.row === 1);
  assert.deepEqual([valuesFor(person, levelKey(0)), valuesFor(person, levelKey(2)), valuesFor(person, 'Contrat'), valuesFor(person, 'Inconnu')],
    [['Pôle Ressources'], ['Budget'], ['Titulaire'], []]);
  const found = filters => filterPeople(people, { filters }).map(each => each.row);
  assert.deepEqual(found({ [levelKey(0)]: new Set(['Pôle Numérique']) }), [4]);
  assert.deepEqual(found({ [levelKey(0)]: new Set(['Pôle Ressources']), Contrat: new Set(['Contractuelle']) }), [2], 'un niveau et un champ se cumulent (« et »)');
  assert.deepEqual(found({ [levelKey(0)]: new Set(['Pôle Numérique', 'Pôle Vie de campus']) }), [4, 6], 'plusieurs valeurs d\'un niveau s\'additionnent (« ou »)');
  assert.deepEqual(filterOptions(people, { ...configFixture(), levels: [] }, schema, 'Personnes').some(option => option.col.startsWith('@L')), false);
});

test('responsables : une recherche garde aussi leurs responsables, jusqu\'au sommet, pour que le fil ne casse pas', () => {
  const found = filterPeople(people, { query: 'camille' });
  const kept = withManagers(people, found).map(person => person.row);
  assert.deepEqual(kept.sort(), [1, 3, 5], 'Camille, son responsable Nathan, puis Emma');
  assert.deepEqual(managerTree(withManagers(people, found)).map(node => node.person.row), [5]);
  assert.deepEqual(withManagers(people, []), []);
  const loop = [{ row: 1, name: 'A', manager: 2 }, { row: 2, name: 'B', manager: 1 }];
  assert.equal(withManagers(loop, [loop[0]]).length, 2, 'un cycle ne boucle pas');
});
