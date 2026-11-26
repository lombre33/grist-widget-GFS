// Les sous-annuaires (module Annuaire, 25/11) : le critère, la copie des personnes (ce qu'elle garde, ce qu'elle ne garde jamais), sa relecture sans exception,
// l'ordre de la liste, et la cible de partage de `GFS_Directories` (le verrou est celui du moteur de partage de GFS). Sur le document fictif des essais.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readConfig, writeConfig, annuairesOf, ANNUAIRES_COLUMNS } from '../js/annuaire/annuaire-config.js';
import { schemaOf } from '../js/annuaire/annuaire-schema.js';
import { buildPeople, buildTree, filterOptions, levelKey } from '../js/annuaire/annuaire-model.js';
import { isSub, parentOf, subsOf, orderAnnuaires, criteriaOf, peopleOfSub, copyable, miniSchema, packFiches, unpackFiches, subRecord, refreshRecord,
  FICHES_VERSION } from '../js/annuaire/annuaire-sub.js';
import { ANNUAIRES_TARGET, targetsOf, helperColumns, fileRules, planSharing, filesTarget } from '../js/sharing/sharing-model.js';
import { ANNUAIRES_MANIFEST, ANNUAIRES_APP, annuaireKey, annuaireFile } from '../js/files/annuaire-files.js';
import { filesColumns } from '../js/files/gfs-files.js';
import { documentFixture, configFixture } from './annuaire-fixtures.mjs';

const doc = documentFixture();
const schema = schemaOf(doc._grist_Tables, doc._grist_Tables_column);
const config = configFixture();
const people = buildPeople(config, 'Personnes', doc, schema);
const main = { row: 1, name: 'Annuaire principal', table: 'Personnes', config: readConfig(config), parent: '' };
const read = { annuaire: main, config: readConfig(config), schema, people, tree: buildTree(people, readConfig(config).levels, main.name), masked: new Set() };
const RESSOURCES = { key: levelKey(0), label: 'Pôle', values: ['Pôle Ressources'] };

test('config : le critère d\'un sous-annuaire se relit, et un critère incomplet n\'en fait pas un', () => {
  const kept = readConfig({ sub: { key: '@L0', label: 'Pôle', values: ['Pôle Ressources', ' Pôle Ressources ', ''], at: '2026-11-25T14:00:00.000Z' } });
  assert.deepEqual(kept.sub, { key: '@L0', label: 'Pôle', values: ['Pôle Ressources'], at: '2026-11-25T14:00:00.000Z' });
  assert.deepEqual(readConfig(JSON.parse(writeConfig(kept))).sub, kept.sub, 'écrit puis relu : rien ne se perd');
  for (const sub of [undefined, null, 'x', {}, { key: '@L0' }, { key: '@L0', values: [] }, { values: ['a'] }]) assert.equal(readConfig({ sub }).sub, undefined, JSON.stringify(sub));
});

test('colonnes : GFS_Directories garde sa copie dans une colonne « Copy », en plus des quatre d\'avant', () => {
  assert.deepEqual(ANNUAIRES_COLUMNS.map(column => column.id), ['Name', 'Table', 'Config', 'Parent', 'Copy']);
});

test('annuairesOf : le numéro de l\'annuaire d\'origine, la copie et ce que Grist dit des droits de la ligne', () => {
  const data = { id: [1, 2], Name: ['Principal', 'RH'], Table: ['Personnes', 'Personnes'], Config: ['{}', '{}'], Parent: ['', '1'], Copy: ['', '{"people":[]}'],
    GFS_Writers: [null, ['L', 'Ecrit@Exemple.fr']], GFS_Admins: [null, ['L', 'chef@exemple.fr', ' ']] };
  const [first, second] = annuairesOf(data);
  assert.equal(first.parent, '');
  assert.equal(second.parent, '1');
  assert.equal(second.fiches, '{"people":[]}');
  assert.deepEqual(second.access, { writers: ['ecrit@exemple.fr'], admins: ['chef@exemple.fr'] }, 'adresses en minuscules, sans blanc');
  assert.deepEqual(first.access, { writers: [], admins: [] });
  assert.deepEqual(annuairesOf({ id: [1], Name: ['A'], Table: ['T'] })[0].access, { writers: [], admins: [] }, 'sans partage, la table n\'a pas ces colonnes');
});

test('liste : chaque annuaire principal est suivi de ses sous-annuaires ; un sous-annuaire orphelin reste, à la fin', () => {
  const list = [{ row: 3, name: 'RH', parent: '1' }, { row: 1, name: 'Principal', parent: '' }, { row: 2, name: 'Autre', parent: '' }, { row: 4, name: 'Orphelin', parent: '99' },
    { row: 5, name: 'Finances', parent: '1' }];
  assert.deepEqual(orderAnnuaires(list).map(each => each.name), ['Principal', 'RH', 'Finances', 'Autre', 'Orphelin']);
  assert.equal(isSub(list[0]), true);
  assert.equal(isSub(list[1]), false);
  assert.equal(parentOf(list, list[0]).name, 'Principal');
  assert.equal(parentOf(list, list[3]), null, 'l\'annuaire d\'origine n\'existe plus');
  assert.equal(parentOf(list, list[1]), null, 'un annuaire principal n\'a pas d\'origine');
  assert.deepEqual(subsOf(list, list[1]).map(each => each.name), ['RH', 'Finances']);
});

test('critères : les niveaux et les champs « filtre » de l\'annuaire d\'origine, avec leurs valeurs et leurs nombres', () => {
  const criteria = criteriaOf(read);
  assert.deepEqual(criteria.map(each => each.col), [levelKey(0), levelKey(1), levelKey(2), 'Contrat', 'Competences', 'Teletravail']);
  const pole = criteria[0].values.find(entry => entry.value === 'Pôle Ressources');
  assert.equal(pole.count, 4);
  assert.deepEqual(criteriaOf(read, people.slice(0, 1)).map(each => each.col), [levelKey(0), levelKey(1), levelKey(2), 'Contrat', 'Competences', 'Teletravail'].filter(
    col => filterOptions(people.slice(0, 1), read.config, schema, 'Personnes').some(option => option.col === col && option.values.length)), 'sans les critères vides');
});

test('contenu : « ou » entre les valeurs d\'un critère ; les personnes masquées ne sont jamais copiées', () => {
  const ress = peopleOfSub(people, RESSOURCES);
  assert.deepEqual(ress.map(each => each.name), people.filter(each => each.levels[0] === 'Pôle Ressources').map(each => each.name));
  assert.equal(ress.length, 4);
  assert.equal(peopleOfSub(people, { key: levelKey(0), values: ['Pôle Ressources', 'Pôle Numérique'] }).length, 5);
  assert.equal(peopleOfSub(people, { key: 'Contrat', values: ['Contractuelle'] }).length, 1);
  assert.equal(peopleOfSub(people, { key: levelKey(0), values: ['Inconnu'] }).length, 0);
  const masked = { ...read, masked: new Set([people[0].row]) };
  assert.equal(copyable(masked).length, people.length - 1);
  assert.equal(copyable({ ...read, masked: undefined }).length, people.length);
});

test('schéma de la copie : seulement les colonnes des champs, jamais les autres colonnes du document', () => {
  const mini = miniSchema(read.config, 'Personnes', schema);
  const names = Object.values(mini).flatMap(table => table.columns.map(col => col.id)).sort();
  assert.deepEqual(names, ['Arrivee', 'Competences', 'Contrat', 'Teletravail']);
  assert.equal(Object.keys(mini).join(), 'Personnes');
  assert.ok(Object.values(mini).every(table => table.columns.every(col => col.formula === false && col.choices.length === 0)), 'ni formule ni liste de choix');
  const viaRef = miniSchema({ fields: [{ col: 'Structure › Pole', path: ['Structure', 'Pole'] }] }, 'Personnes', schema);
  assert.deepEqual(Object.keys(viaRef).sort(), ['Personnes', 'Structures']);
  assert.deepEqual(viaRef.Personnes.columns.map(col => col.id), ['Structure']);
  assert.deepEqual(viaRef.Structures.columns.map(col => col.id), ['Pole']);
  assert.deepEqual(miniSchema({ fields: [{ col: 'Absente' }] }, 'Personnes', schema), {}, 'une colonne qui n\'existe plus n\'entre pas');
});

test('copie : les personnes reviennent telles qu\'elles étaient, avec tout ce que l\'écran lit', () => {
  const at = '2026-11-25T14:00:00.000Z';
  const text = packFiches({ people, schema: miniSchema(read.config, 'Personnes', schema), at });
  assert.equal(JSON.parse(text).v, FICHES_VERSION);
  const back = unpackFiches(text, 3);
  assert.equal(back.at, at);
  assert.deepEqual(back.people, people.map(person => ({ ...person, rel: person.rel })), 'la copie est la lecture, sans rien en plus ni en moins');
  assert.deepEqual(Object.keys(back.schema), ['Personnes']);
  assert.ok(!Object.keys(JSON.parse(text).people[0]).includes('Salaire'), 'seules les clés d\'une personne de l\'annuaire');
});

test('copie : une copie vide, abîmée ou plus courte ne fait jamais d\'exception', () => {
  for (const source of ['', 'pas du json', '[]', 'null', '{"people": 3}', '{"people": [null, 3, {}, {"row": "x", "name": "a"}]}']) {
    const back = unpackFiches(source, 2);
    assert.deepEqual(back.people, [], source);
    assert.deepEqual(back.schema, {});
    assert.equal(back.at, '');
  }
  const short = unpackFiches('{"people":[{"row":4,"name":"Une personne","levels":["Pôle"],"fields":{"A":["x",3]},"rel":{"Assistant":[2,"y"]},"manager":-1}]}', 3).people[0];
  assert.deepEqual(short.levels, ['Pôle', '', ''], 'les niveaux manquants sont vides');
  assert.deepEqual(short.fields, { A: ['x', '3'] });
  assert.deepEqual(short.rel, { Assistant: [2] });
  assert.equal(short.manager, null);
  assert.equal(short.sort, 'Une personne');
  assert.equal(short.lead, false);
  assert.equal(short.email, '');
});

test('enregistrement : la ligne d\'un sous-annuaire porte son annuaire d\'origine, son critère daté et sa copie', () => {
  const at = '2026-11-25T14:00:00.000Z';
  const { people: kept, record } = subRecord({ name: '  Pôle Ressources ', parent: main, sub: RESSOURCES, read, at });
  assert.equal(kept.length, 4);
  assert.deepEqual(Object.keys(record).sort(), ['Config', 'Copy', 'Name', 'Parent', 'Table']);
  assert.equal(record.Name, 'Pôle Ressources');
  assert.equal(record.Parent, '1', 'le numéro de la ligne de l\'annuaire d\'origine');
  assert.equal(record.Table, 'Personnes');
  assert.deepEqual(readConfig(record.Config).sub, { ...RESSOURCES, at });
  assert.deepEqual(readConfig(record.Config).levels, read.config.levels, 'la définition de l\'annuaire d\'origine est reprise');
  assert.equal(unpackFiches(record.Copy, 3).people.length, 4);
  assert.ok(record.Copy.includes('Camille Durand') && !record.Copy.includes('Louis Girard'), 'la copie ne contient que les personnes du critère');
  const masked = subRecord({ name: 'x', parent: main, sub: RESSOURCES, read: { ...read, masked: new Set([people.find(each => each.name === 'Camille Durand').row]) }, at });
  assert.equal(masked.people.length, 3);
  assert.ok(!masked.record.Copy.includes('Camille Durand'), 'une fiche masquée n\'entre pas dans la copie');
});

test('actualiser : la copie, la définition et le moment changent ; le nom, l\'origine et le partage restent', () => {
  const { record } = refreshRecord({ sub: RESSOURCES, parent: main, read, at: '2026-11-26T08:00:00.000Z' });
  assert.deepEqual(Object.keys(record).sort(), ['Config', 'Copy', 'Table']);
  assert.equal(readConfig(record.Config).sub.at, '2026-11-26T08:00:00.000Z');
});

test('partage : GFS_Directories est une cible du moteur, ouverte pour les annuaires principaux et verrouillée pour les sous-annuaires', () => {
  assert.equal(ANNUAIRES_TARGET.table, 'GFS_Directories');
  assert.equal(ANNUAIRES_TARGET.prefix, `${ANNUAIRES_APP}:`);
  assert.equal(ANNUAIRES_TARGET.id, null, 'la clé d\'un annuaire est le numéro de sa ligne');
  assert.equal(ANNUAIRES_TARGET.stamped, true, 'Grist écrit l\'auteur à la création');
  assert.equal(ANNUAIRES_TARGET.open, 'not rec.Parent', 'un annuaire principal reste lisible comme avant');
  assert.deepEqual(targetsOf([]).map(target => target.table), [filesTarget().table, 'GFS_Directories']);
  const rules = fileRules(ANNUAIRES_TARGET);
  assert.ok(rules.some(rule => rule.formula === 'not rec.Parent' && rule.rights === '+R'), 'les annuaires principaux se lisent');
  assert.equal(rules.at(-1).formula, '', 'la dernière règle refuse le reste');
  assert.equal(rules.at(-1).rights, '-CRUD');
  assert.ok(helperColumns(ANNUAIRES_TARGET).some(column => column.id === 'GFS_Readers'), 'les colonnes d\'aide que lisent les règles');
  assert.equal(annuaireKey(7), 'gfs-annuaires:7');
  assert.deepEqual(annuaireFile({ row: 7, name: 'RH' }), { key: 'gfs-annuaires:7', app: 'gfs-annuaires', id: '7', table: 'GFS_Directories', row: 7, name: 'RH',
    type: 'annuaire', by: '' });
});

test('partage : activer le partage d\'un document qui a des annuaires étend GFS_Directories (colonnes d\'aide et règles), sans toucher à ses données', () => {
  const existing = { resources: [], rules: [], tables: [{ id: 1, tableId: 'GFS_Directories' }], columns: ['Name', 'Table', 'Config', 'Parent', 'Copy'].map(colId => ({ parentId: 1,
    colId })), files: { GFS_Directories: ['1'] }, targets: targetsOf([]) };
  const plan = planSharing(existing, filesColumns(), existing.targets);
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.appTables, ['GFS_Directories']);
  const added = plan.actions.filter(action => action[0] === 'AddColumn' && action[1] === 'GFS_Directories').map(action => action[2]);
  assert.ok(added.includes('GFS_Readers') && added.includes('GFS_Author'), added.join());
  assert.ok(!plan.actions.some(action => action[0] === 'AddRecord' && action[1] === 'GFS_Directories'), 'aucune ligne d\'annuaire n\'est écrite');
  assert.ok(!plan.actions.some(action => ['UpdateRecord', 'BulkUpdateRecord', 'RemoveRecord'].includes(action[0]) && action[1] === 'GFS_Directories'));
});

test('explorateur : l\'annuaire est un fichier intégré, de type « annuaire », dont la clé est le numéro de ligne', () => {
  const [spec] = ANNUAIRES_MANIFEST.fichiers;
  assert.equal(ANNUAIRES_MANIFEST.integre, true);
  assert.equal(spec.table, 'GFS_Directories');
  assert.deepEqual(spec.colonnes, { id: 'id', nom: 'Name', par: 'GFS_Author' });
  assert.deepEqual(spec.types.map(type => [type.valeur, type.icone, type.couleur]), [['annuaire', 'annuaire', 'annuaire']]);
});
