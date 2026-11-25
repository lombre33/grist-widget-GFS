// Qui modifie une fiche (js/annuaire/annuaire-edit-rights.js, retour du porteur du 25/11 : « par défaut les administrateurs, mais aussi chacun sa propre fiche,
// les personnes de son niveau hiérarchique avec en option celles du niveau en dessous, ou un rôle désigné »). La règle de GFS, essayée sans page : le dessin du
// bouton grisé se mesure sous Firefox (test/annuaire-droits-firefox.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createI18n } from '../js/i18n/i18n.js';
import { readConfig, writeConfig } from '../js/annuaire/annuaire-config.js';
import { editRight, editorRows, activeRules, editWhy } from '../js/annuaire/annuaire-edit-rights.js';
import { nodeId, buildTree } from '../js/annuaire/annuaire-model.js';

const LEVELS = [{ label: 'Pôle', path: ['Pole'] }, { label: 'Direction', path: ['Direction'] }, { label: 'Service', path: ['Service'] }];
const person = (row, email, ...levels) => ({ row, name: `Personne ${row}`, email, levels: [levels[0] || '', levels[1] || '', levels[2] || ''] });
const PEOPLE = [
  person(1, 'a@exemple.fr', 'Ressources', 'Finances', 'Paie'), person(2, 'b@exemple.fr', 'Ressources', 'Finances', 'Paie'),
  person(3, 'c@exemple.fr', 'Ressources', 'Finances', 'Achats'), person(4, 'd@exemple.fr', 'Ressources', 'Finances'),
  person(5, 'e@exemple.fr', 'Ressources', 'Personnel', 'Recrutement'), person(6, 'f@exemple.fr', 'Recherche', 'Finances', 'Paie'),
  person(7, 'g@exemple.fr'), person(8, 'h@exemple.fr', 'Ressources', '', 'Paie'),
];
const config = edit => readConfig({ levels: LEVELS, edit });
const can = (who, whom, edit, extra = {}) => editRight(PEOPLE.find(each => each.row === whom), { identity: PEOPLE.find(each => each.row === who).email, people: PEOPLE,
  config: config(edit), ...extra }).can;

test('par défaut, seuls les administrateurs modifient une fiche, et nul autre ne se sait propriétaire', () => {
  assert.deepEqual(readConfig({}).edit, { self: false, level: '', role: '' });
  assert.deepEqual(editRight(PEOPLE[0], { admin: true, config: config({}), people: PEOPLE }), { can: true, rule: 'admin' });
  assert.equal(can(1, 1, {}), false, 'sa propre fiche non plus : seule la règle « chacun la sienne » l\'ouvre');
  assert.equal(can(1, 2, {}), false);
  assert.deepEqual(activeRules(config({})), []);
});

test('« chacun sa propre fiche » : la sienne seulement, retrouvée par son adresse (casse et espaces ignorés)', () => {
  assert.equal(can(1, 1, { self: true }), true);
  assert.equal(can(1, 2, { self: true }), false);
  assert.equal(editRight(PEOPLE[0], { identity: '  A@Exemple.fr ', people: PEOPLE, config: config({ self: true }) }).rule, 'self');
  assert.equal(editRight(PEOPLE[0], { identity: '', people: PEOPLE, config: config({ self: true }) }).can, false, 'sans adresse connue : personne n\'est reconnu');
  assert.equal(editRight(PEOPLE[0], { identity: 'inconnu@exemple.fr', people: PEOPLE, config: config({ self: true }) }).can, false, 'une adresse qui n\'est pas dans l\'annuaire non plus');
});

test('« son niveau » : les personnes du même nœud ; « et en dessous » : aussi celles des nœuds qui sont dessous, jamais au-dessus ni à côté', () => {
  const own = { level: 'own' };
  assert.equal(can(1, 2, own), true, 'même pôle, même direction, même service');
  assert.equal(editRight(PEOPLE[1], { identity: 'a@exemple.fr', people: PEOPLE, config: config(own) }).rule, 'own');
  assert.equal(can(1, 3, own), false, 'un autre service : pas de son nœud');
  assert.equal(can(1, 4, own), false, 'la direction est au-dessus de son service');
  assert.equal(can(4, 1, own), false, 'sans « en dessous », la direction ne modifie pas ses services');
  const below = { level: 'below' };
  assert.equal(can(4, 1, below), true, 'la direction, avec « en dessous », modifie ses services');
  assert.equal(editRight(PEOPLE[0], { identity: 'd@exemple.fr', people: PEOPLE, config: config(below) }).rule, 'below');
  assert.equal(can(4, 3, below), true);
  assert.equal(can(4, 2, below), true);
  assert.equal(can(4, 5, below), false, 'une autre direction du même pôle : à côté, pas dessous');
  assert.equal(can(4, 6, below), false, 'une direction de même nom dans un autre pôle n\'est pas la sienne');
  assert.equal(can(1, 4, below), false, 'jamais vers le haut');
  assert.equal(can(4, 4, below), true, 'et le même nœud reste permis');
});

test('une personne sans niveau n\'a aucun droit de niveau, et un niveau sauté ne confond pas les nœuds', () => {
  assert.equal(nodeId(PEOPLE[6], config({}).levels), '');
  assert.equal(can(7, 7, { level: 'below' }), false, 'la racine n\'est pas un niveau : sinon elle modifierait tout le monde');
  assert.equal(can(7, 1, { level: 'below' }), false);
  assert.equal(can(8, 1, { level: 'own' }), false, 'le pôle et le service sans direction ne sont pas le nœud d\'un service complet');
  assert.equal(can(8, 8, { level: 'below' }), true);
  // le nœud d'une personne est celui que `buildTree` lui donne
  const tree = buildTree(PEOPLE, config({}).levels, 'Annuaire');
  const holder = tree.ch.flatMap(function walk(node) { return [node, ...node.ch.flatMap(walk)]; }).find(node => node.own.some(each => each.row === 8));
  assert.equal(holder.id, nodeId(PEOPLE[7], config({}).levels));
});

test('« postes et hiérarchie » éteint : plus de niveaux, donc plus de droit de niveau', () => {
  const off = readConfig({ levels: LEVELS, hierarchy: false, edit: { level: 'below' } });
  assert.equal(editRight(PEOPLE[0], { identity: 'd@exemple.fr', people: PEOPLE, config: off }).can, false);
});

test('« un rôle désigné » : les personnes dont la case oui/non est cochée modifient toutes les fiches', () => {
  const read = { config: config({ role: 'Gestionnaire' }), annuaire: { table: 'Personnes' },
    data: { Personnes: { id: [1, 2, 3, 4], Gestionnaire: [false, true, null, true] } } };
  assert.deepEqual([...editorRows(read)], [2, 4], 'seules les cases vraiment cochées comptent (une case vide non)');
  const editors = editorRows(read);
  assert.equal(can(2, 5, { role: 'Gestionnaire' }, { editors }), true);
  assert.equal(editRight(PEOPLE[4], { identity: 'b@exemple.fr', people: PEOPLE, config: read.config, editors }).rule, 'role');
  assert.equal(can(1, 5, { role: 'Gestionnaire' }, { editors }), false);
  assert.equal(can(3, 5, { role: 'Gestionnaire' }, { editors }), false, 'une case vide ne désigne personne');
  assert.deepEqual([...editorRows({ ...read, config: config({}) })], [], 'sans colonne de rôle : personne');
  assert.deepEqual([...editorRows({ ...read, data: { Personnes: { id: [1] } } })], [], 'une colonne absente de la table : personne, sans erreur');
});

test('les règles se cumulent, et la configuration lue et réécrite les garde', () => {
  assert.equal(can(1, 1, { self: true, level: 'own' }), true);
  assert.equal(can(1, 2, { self: true, level: 'own' }), true);
  assert.equal(can(1, 3, { self: true, level: 'own' }), false);
  const edit = { self: true, level: 'below', role: 'Gestionnaire' };
  assert.deepEqual(readConfig(writeConfig(config(edit))).edit, edit);
  assert.deepEqual(activeRules(config(edit)), ['self', 'below', 'role']);
  assert.deepEqual(readConfig({ edit: { self: 'oui', level: 'tout', role: 3 } }).edit, { self: false, level: '', role: '' }, 'une valeur inconnue : la règle par défaut');
});

test('la phrase du bouton grisé dit qui modifie, dans la langue de la personne', () => {
  const fr = createI18n('fr').t;
  const en = createI18n('en').t;
  assert.equal(editWhy(config({}), fr, 'fr'), fr('an.edit.whyAdmins'));
  assert.match(editWhy(config({}), fr, 'fr'), /administrateurs/);
  const all = config({ self: true, level: 'below', role: 'Gestionnaire' });
  const said = editWhy(all, fr, 'fr');
  assert.match(said, new RegExp(fr('an.edit.who.self')));
  assert.match(said, new RegExp(fr('an.edit.who.below')));
  assert.match(said, new RegExp(fr('an.edit.who.role')));
  assert.match(said, / et /, 'la liste se termine par « et »');
  assert.match(editWhy(all, en, 'en'), /, and |\band\b/, 'et en anglais « and »');
  assert.notEqual(editWhy(config({ level: 'own' }), fr, 'fr'), editWhy(config({ level: 'below' }), fr, 'fr'));
});

test('quand GFS ne connaît pas l\'adresse de la personne, la phrase le dit : c\'est ce qui l\'empêche d\'être reconnue', () => {
  const fr = createI18n('fr').t;
  const mine = config({ self: true });
  assert.equal(editWhy(mine, fr, 'fr', ''), `${editWhy(mine, fr, 'fr')} ${fr('an.edit.whyNoIdentity')}`);
  assert.equal(editWhy(mine, fr, 'fr', 'a@exemple.fr'), editWhy(mine, fr, 'fr'), 'une adresse connue : rien de plus');
  assert.equal(editWhy(config({}), fr, 'fr', ''), fr('an.edit.whyAdmins'), 'sans règle qui reconnaît quelqu\'un : rien de plus');
  assert.equal(editWhy(config({ role: 'Gestion' }), fr, 'fr', ''), editWhy(config({ role: 'Gestion' }), fr, 'fr'), 'le rôle désigné se reconnaît aussi à l\'adresse : rien de plus ici');
});
