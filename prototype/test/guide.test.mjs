// Le modèle du guide des démarches (module Guide, 27/11) : la configuration, les guides d'une table, les démarches, l'arbre (mère, boucle, orpheline), l'héritage des
// rôles, la recherche, et les contacts retrouvés dans l'annuaire avec leur repli « À défaut ». Sur un document fictif (test/guide-fixtures.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readConfig, writeConfig, guidesOf, newRecord, GUIDES_COLUMNS, MAX_ROLES } from '../js/guide/guide-config.js';
import { buildProcedures, buildIndex, ancestors, below, roleOf, rolesFor, searchProcedures, filled } from '../js/guide/guide-model.js';
import { directoryOf, kindOf, entriesOf, answerOf } from '../js/guide/guide-contacts.js';
import { schemaOf, columnOf } from '../js/annuaire/annuaire-schema.js';
import { buildPeople, buildTree } from '../js/annuaire/annuaire-model.js';
import { guideDocument, guideConfig, configFixture, PROCEDURES_TABLE } from './guide-fixtures.mjs';

const doc = guideDocument();
const schema = schemaOf(doc._grist_Tables, doc._grist_Tables_column);
const config = readConfig(guideConfig());
const procs = buildProcedures(config, PROCEDURES_TABLE, doc, schema);
const index = buildIndex(procs);
const titled = title => procs.find(proc => proc.title === title);

// L'annuaire des essais, lu comme le contrôle le lit : les personnes et l'arbre de leurs structures.
const dirConfig = configFixture();
const people = buildPeople(dirConfig, 'Personnes', doc, schema);
const directory = directoryOf({ annuaire: { table: 'Personnes', name: 'Annuaire' }, people, tree: buildTree(people, dirConfig.levels, 'Annuaire') });
const answerFor = title => answerOf(rolesFor(index, config, titled(title).row), col => columnOf(schema, PROCEDURES_TABLE, col), directory);
const by = (answer, col) => answer.find(item => item.role.col === col);
const names = item => item.entries.flatMap(entry => entry.people.map(person => person.name));

test('config : une configuration illisible donne une configuration vide, jamais une exception', () => {
  for (const source of [undefined, null, '', 'pas du json', '[]', '{"roles": 3}', 42]) {
    const read = readConfig(source);
    assert.deepEqual(read.roles, []);
    assert.equal(read.title, '');
    assert.equal(read.directory, '');
    assert.equal(read.v, 1);
  }
});

test('config : une colonne ne sert qu\'une fois, « À défaut » est unique, l\'annuaire se dit par un numéro de ligne', () => {
  const read = readConfig({ title: ' Titre ', parent: 'Titre', keywords: 'Mots', directory: 3, roles: [{ col: 'Titre', label: 'Trop' }, { col: 'A', label: ' Un ',
    preset: 'fallback' }, { col: 'B', preset: 'fallback' }, { col: 'A', label: 'Doublon' }, { col: 'C', preset: 'inconnu' }, { col: '' }, null] });
  assert.equal(read.title, 'Titre');
  assert.equal(read.parent, '', 'la colonne du titre ne sert pas de mère');
  assert.equal(read.directory, '3');
  assert.deepEqual(read.roles, [{ col: 'A', label: 'Un', preset: 'fallback' }, { col: 'B', label: 'B', preset: 'other' }, { col: 'C', label: 'C', preset: 'other' }]);
  assert.equal(readConfig({ directory: 'abc' }).directory, '');
  assert.equal(readConfig({ roles: Array.from({ length: 40 }, (_, at) => ({ col: `R${at}` })) }).roles.length, MAX_ROLES);
  assert.deepEqual(readConfig(writeConfig(guideConfig())), config, 'ce qu\'on écrit se relit à l\'identique');
});

test('guides : une ligne sans nom ou sans table est ignorée, les adresses du partage se lisent en minuscules', () => {
  const found = guidesOf({ id: [1, 2, 3], Name: ['Guide RH', '', 'Sans table'], Table: ['Demarches', 'Demarches', ''], Config: [JSON.stringify(guideConfig()), '', ''],
    Parent: ['', '', ''], GFS_Writers: [['L', 'A@Exemple.fr'], null, null] });
  assert.deepEqual(found.map(guide => [guide.row, guide.name, guide.table]), [[1, 'Guide RH', 'Demarches']]);
  assert.deepEqual(found[0].access.writers, ['a@exemple.fr']);
  assert.deepEqual(guidesOf(null), []);
  assert.deepEqual(newRecord(' Guide ', ' T ', guideConfig()), { Name: 'Guide', Table: 'T', Config: writeConfig(guideConfig()), Parent: '' });
  assert.deepEqual(GUIDES_COLUMNS.map(column => column.id), ['Name', 'Table', 'Config', 'Parent', 'Copy']);
});

test('démarches : triées par titre, étapes une par ligne sans les lignes vides, mots-clés coupés, rôles en lignes et en textes', () => {
  assert.equal(procs.length, 8);
  assert.deepEqual(procs.map(proc => proc.title), [...procs.map(proc => proc.title)].sort((a, b) => a.localeCompare(b, 'fr')));
  const leave = titled('Poser des congés');
  assert.deepEqual(leave.steps, ['Saisir la demande', 'Faire valider par la direction', 'Attendre la confirmation']);
  assert.deepEqual(leave.keywords, ['vacances', 'RTT', 'jours']);
  assert.equal(leave.parent, 1);
  assert.deepEqual(leave.roles.Valider, { ids: [3], texts: ['Nathan Roussel'] }, 'une référence garde sa ligne et la valeur que Grist montre');
  assert.deepEqual(titled('Congés et absences').roles.Demander, { ids: [5], texts: ['Budget'] });
  assert.deepEqual(titled('Poser des congés exceptionnels').roles.Probleme, { ids: [], texts: ['Directeur du numérique'] }, 'un texte : un poste');
  assert.equal(filled(titled('Poser des congés').roles.Demander), false);
  const blank = buildProcedures(config, PROCEDURES_TABLE, { ...doc, [PROCEDURES_TABLE]: { ...doc[PROCEDURES_TABLE], Titre: doc[PROCEDURES_TABLE].Titre.map(() => '') } }, schema);
  assert.deepEqual(blank, [], 'une ligne sans titre est ignorée');
  assert.deepEqual(buildProcedures({ ...config, title: '' }, PROCEDURES_TABLE, doc, schema), [], 'sans colonne de titre, rien à lire');
  assert.deepEqual(buildProcedures(config, 'Absente', doc, schema), []);
});

test('arbre : les thèmes à la racine, les filles sous leur mère, une orpheline à la racine, une boucle dite et mise à la racine', () => {
  assert.deepEqual(index.roots.map(proc => proc.title).sort(), ['Boucle A', 'Boucle B', 'Congés et absences', 'Démarche orpheline', 'Missions et déplacements']);
  assert.deepEqual(index.children.get(1).map(proc => proc.title), ['Poser des congés']);
  assert.deepEqual([...index.loops].sort(), [6, 7]);
  assert.equal(index.parentOf.get(3), 2);
  assert.equal(index.parentOf.get(8), null, 'une mère qui n\'existe pas ne rattache pas');
  assert.deepEqual(ancestors(index, 3).map(proc => proc.title), ['Congés et absences', 'Poser des congés']);
  assert.deepEqual(ancestors(index, 1), []);
  assert.equal(below(index, 1), 2);
  assert.equal(below(index, 8), 0);
  const self = buildIndex(buildProcedures(config, PROCEDURES_TABLE, { ...doc, [PROCEDURES_TABLE]: { ...doc[PROCEDURES_TABLE], Mere: doc[PROCEDURES_TABLE].Mere.map((mother, at) => (at === 0 ?
    1 : mother)) } }, schema));
  assert.ok(self.loops.has(1), 'une démarche mère d\'elle-même est une boucle');
  assert.equal(self.parentOf.get(1), null);
});

test('héritage : un rôle vide prend celui de la mère, de proche en proche ; en choisir un le remplace pour la démarche et ce qui est dessous', () => {
  assert.deepEqual(roleOf(index, 3, 'Demander'), { cell: { ids: [5], texts: ['Budget'] }, from: 1, own: false }, 'trois niveaux plus haut');
  assert.deepEqual(roleOf(index, 3, 'Valider').from, 2, 'celui de la mère directe');
  assert.deepEqual(roleOf(index, 2, 'Valider').own, true);
  assert.equal(roleOf(index, 1, 'Valider'), null, 'personne ne le dit jusqu\'à la racine');
  assert.deepEqual(roleOf(index, 5, 'Demander'), { cell: { ids: [6], texts: ['Pôle Vie de campus'] }, from: 5, own: true }, 'son propre choix remplace celui des mères');
  assert.equal(roleOf(index, 6, 'Defaut'), null, 'une boucle ne tourne pas sans fin');
  assert.equal(roleOf(index, 999, 'Demander'), null);
  const all = rolesFor(index, config, 3);
  assert.deepEqual(all.map(item => item.role.col), ['Demander', 'Valider', 'Probleme', 'Defaut']);
  assert.deepEqual(all.map(item => item.own), [false, false, true, false]);
  assert.deepEqual(all.map(item => item.from), [1, 2, 3, 1]);
});

test('recherche : des mots dans n\'importe quel ordre, accents et casse ignorés, dans le titre, les mots-clés et les étapes ; le titre d\'abord', () => {
  assert.deepEqual(searchProcedures(procs, 'conges poser').map(proc => proc.title), ['Poser des congés', 'Poser des congés exceptionnels']);
  assert.deepEqual(searchProcedures(procs, 'VOYAGE').map(proc => proc.title), ['Missions et déplacements'], 'un mot-clé');
  assert.deepEqual(searchProcedures(procs, 'justificatifs').map(proc => proc.title), ['Remboursement de frais'], 'une étape');
  assert.deepEqual(searchProcedures(procs, 'direction').map(proc => proc.title), ['Poser des congés'], 'les étapes sont cherchées');
  assert.deepEqual(searchProcedures(procs, 'confirmation congés').map(proc => proc.title), ['Poser des congés']);
  assert.deepEqual(searchProcedures(procs, '   '), []);
  assert.deepEqual(searchProcedures(procs, 'zzz'), []);
  const ranked = searchProcedures(procs, 'rtt');
  assert.deepEqual(ranked.map(proc => proc.title), ['Poser des congés']);
  const both = searchProcedures([{ title: 'Autre', keywords: ['congés'], steps: [] }, { title: 'Congés', keywords: [], steps: [] }], 'conges');
  assert.deepEqual(both.map(proc => proc.title), ['Congés', 'Autre'], 'le titre qui porte les mots passe avant');
});

test('contacts : le type de la colonne dit ce que le rôle désigne', () => {
  const col = id => columnOf(schema, PROCEDURES_TABLE, id);
  assert.equal(kindOf(col('Valider'), directory), 'person');
  assert.equal(kindOf(col('Demander'), directory), 'service');
  assert.equal(kindOf(col('Probleme'), directory), 'post');
  assert.equal(kindOf(col('Valider'), null), 'text', 'sans annuaire, tout se lit comme du texte');
  assert.equal(kindOf(null, directory), 'text');
  assert.equal(kindOf({ genre: 'date' }, directory), 'text');
});

test('contacts : un service donne son ou sa responsable, un poste ceux qui le tiennent, une personne la fiche de l\'annuaire', () => {
  const answer = answerFor('Poser des congés');
  assert.deepEqual(names(by(answer, 'Demander')), ['Camille Durand'], 'le service Budget, hérité du thème : sa cheffe');
  assert.equal(by(answer, 'Demander').own, false);
  assert.deepEqual(names(by(answer, 'Valider')), ['Nathan Roussel'], 'une personne');
  assert.equal(by(answer, 'Probleme').empty, true);
  assert.deepEqual(names(by(answerFor('Poser des congés exceptionnels'), 'Probleme')), ['Louis Girard'], 'un poste');
  assert.deepEqual(entriesOf('post', { ids: [], texts: ['directeur du NUMERIQUE'] }, directory)[0].people.map(person => person.name), ['Louis Girard'], 'accents et casse ignorés');
  assert.deepEqual(entriesOf('post', { ids: [], texts: ['directeur'] }, directory)[0].people.map(person => person.name).sort(), ['Louis Girard', 'Nathan Roussel'],
    'à défaut d\'un poste identique, ceux qui le contiennent');
});

test('contacts : un contact introuvable se remplace par « À défaut » (le rôle de la démarche ou de sa mère), et la fiche le dit', () => {
  const trip = answerFor('Missions et déplacements');
  const validate = by(trip, 'Valider');
  assert.equal(validate.viaFallback, true, 'la personne n\'est pas dans l\'annuaire');
  assert.deepEqual(names(validate), ['Nathan Roussel'], 'le service « Direction des finances » : son responsable');
  assert.equal(validate.fallbackFrom, 4);
  assert.deepEqual(validate.replaced.map(entry => entry.found), [false]);
  const claim = answerFor('Remboursement de frais');
  assert.equal(by(claim, 'Demander').viaFallback, true, 'un service sans responsable');
  assert.equal(by(claim, 'Probleme').viaFallback, true, 'un poste vacant');
  assert.deepEqual(names(by(claim, 'Probleme')), ['Nathan Roussel']);
  assert.equal(by(claim, 'Defaut').viaFallback, false, '« À défaut » ne se remplace pas lui-même');
  const found = answerFor('Poser des congés');
  assert.ok(found.every(item => !item.viaFallback), 'un contact retrouvé ne passe jamais par le repli');
});

test('contacts : sans annuaire, le rôle se lit comme du texte, rien n\'est remplacé ; sans repli, le contact perdu reste dit introuvable', () => {
  const plain = answerOf(rolesFor(index, config, titled('Poser des congés').row), col => columnOf(schema, PROCEDURES_TABLE, col), null);
  assert.deepEqual(by(plain, 'Demander').entries, [{ label: 'Budget', people: [], found: true, plain: true }]);
  assert.ok(plain.every(item => !item.viaFallback));
  const bare = { ...config, roles: config.roles.filter(role => role.preset !== 'fallback') };
  const lost = answerOf(rolesFor(index, bare, titled('Remboursement de frais').row), col => columnOf(schema, PROCEDURES_TABLE, col), directory);
  assert.equal(by(lost, 'Demander').viaFallback, false);
  assert.deepEqual(by(lost, 'Demander').entries.map(entry => entry.found), [false], 'le service est dit, sans personne');
});

test('la page porte le bouton du guide que la barre cherche (sans lui, GFS ne démarre pas)', async () => {
  const { readFileSync } = await import('node:fs');
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(page, /id="floater-guide"/);
  assert.match(page, /css\/guide\.css\?v=/);
});

test('contacts à l\'envers : qui est cité par quoi, les contacts introuvables en tête, le repli compté une seule fois', async () => {
  const { contactsIndex, citingPerson } = await import('../js/guide/guide-contacts-index.js');
  const found = contactsIndex(procs, row => answerFor(procs.find(proc => proc.row === row).title));
  assert.ok(found.length > 0);
  const lostAt = found.findIndex(group => group.found);
  assert.ok(found.slice(0, lostAt < 0 ? 0 : lostAt).every(group => !group.found), 'les introuvables d\'abord');
  const vacant = found.find(group => group.label === 'Poste vacant');
  assert.ok(vacant && !vacant.found && vacant.kind === 'post', 'un poste vacant est cité et perdu');
  assert.deepEqual(vacant.procs.map(proc => proc.title), ['Remboursement de frais']);
  const budget = found.find(group => group.label === 'Budget');
  assert.equal(budget.kind, 'service');
  assert.ok(budget.procs.length > budget.own, 'les démarches filles qui l\'héritent comptent, sans être propres');
  const dir = found.find(group => group.label === 'Directeur du numérique');
  assert.ok(dir && dir.found && dir.people.length === 1);
  const of = row => answerFor(procs.find(proc => proc.row === row).title);
  const nathan = citingPerson(procs, of, 3);
  assert.deepEqual(nathan.map(cite => cite.title), ['Congés et absences', 'Missions et déplacements', 'Poser des congés', 'Poser des congés exceptionnels', 'Remboursement de frais'],
    'cité directement, par héritage, par le rôle « À défaut » ou par le responsable d\'un service ; sans doublon, par titre');
  assert.deepEqual([nathan[2], nathan[3]].map(cite => [cite.via, cite.own]), [['person', true], ['person', false]], 'directement, puis par héritage');
  assert.ok(citingPerson(procs, of, budget.people[0].row).some(cite => cite.title === 'Congés et absences' && cite.via === 'service'), 'la responsable d\'un service est citée par son service');
  assert.deepEqual(citingPerson(procs, of, 9999), []);
});

test('annuaire : le bouton « Démarches » est grisé tant que le document n\'a pas de table GFS_Guides, et le dit', async () => {
  const { guideBlock } = await import('../js/annuaire/annuaire-guide-link.js');
  const t = key => key;
  assert.equal(guideBlock({ schema: { Personnes: { columns: [] } } }, t), 'an.guide.none');
  assert.equal(guideBlock(null, t), 'an.guide.none');
  assert.equal(guideBlock({ schema: { GFS_Guides: { columns: [] } } }, t), '');
});
