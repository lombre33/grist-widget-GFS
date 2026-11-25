// « À vérifier » et « Ma présence » (module Annuaire, demande du porteur du 25/11) : les contrôles qui relèvent les fiches à regarder, le tableau « Comparer » d'un
// doublon, et ce que l'option « Ma présence » montre à chacun. Du code sans effet de bord, sur des personnes fictives.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkNeeds, runChecks, compareRows } from '../js/annuaire/annuaire-check.js';
import { presenceView, maskedRows, mineOf, canSwitch, presenceCol } from '../js/annuaire/annuaire-presence.js';
import { readConfig } from '../js/annuaire/annuaire-config.js';

const person = (row, name, extra = {}) => ({ row, name, sort: name, title: '', email: `${name.split(' ')[0].toLowerCase()}@x.fr`, phone: '', levels: ['Pôle A'], fields: {},
  rel: {}, lead: false, manager: null, ...extra });
const config = extra => readConfig({ name: 'Nom', email: 'Email', manager: 'Responsable', levels: [{ label: 'Pôle', path: ['Pole'] }], ...extra });
const table = columns => ({ id: [1, 2, 3, 4, 5, 6], ...columns });
const read = (people, cfg, data = {}) => ({ people, config: cfg, annuaire: { table: 'Personnes', name: 'Annuaire' }, data: { Personnes: table(data) } });
const TODAY = new Date(Date.UTC(2026, 10, 25, 15, 30)); // le 25/11/2026, en milieu d'après-midi
const midnight = (y, m, d) => Date.UTC(y, m - 1, d) / 1000;

test('un contrôle ne s\'allume que si l\'annuaire a de quoi lire : l\'adresse, un niveau, le responsable, la date de départ', () => {
  const bare = readConfig({ name: 'Nom' });
  assert.equal(checkNeeds('dup', bare), null, 'les doublons se lisent sur le nom');
  assert.equal(checkNeeds('mail', bare), 'an.check.needs.mail');
  assert.equal(checkNeeds('att', bare), 'an.check.needs.att');
  assert.equal(checkNeeds('resp', bare), 'an.check.needs.resp');
  assert.equal(checkNeeds('dep', bare), 'an.check.needs.dep');
  assert.equal(checkNeeds('mail', readConfig({ name: 'Nom', email: 'Email' })), null);
  assert.equal(checkNeeds('dep', readConfig({ name: 'Nom', leave: 'Depart' })), null);
});

test('doublons : le même nom (accents et casse ignorés), puis la même adresse ; un groupe n\'est dit qu\'une fois', () => {
  const people = [person(1, 'Léa Garnier', { email: 'lea@x.fr' }), person(2, 'Lea  GARNIER', { email: 'lea.garnier@y.fr' }), person(3, 'Paul Roy', { email: 'paul@x.fr' }),
    person(4, 'Paula Roy', { email: 'PAUL@x.fr' }), person(5, 'Seul Nom', { email: 'seul@x.fr' }), person(6, 'Sacha Bernard', { email: '' }), person(7, 'Noé Petit', { email: '' })];
  const found = runChecks(read(people, config({ checks: ['dup'] })), TODAY);
  assert.equal(found.total, 2, 'un doublon de nom, un doublon d\'adresse ; les deux sans adresse ne sont pas « la même adresse »');
  const [byName, byMail] = found.issues;
  assert.deepEqual([byName.kind, byName.why, byName.rows, byName.others], ['dup', 'name', [1, 2], ['Lea  GARNIER']]);
  assert.deepEqual([byMail.why, byMail.rows], ['mail', [3, 4]]);
  assert.deepEqual(found.counts, { dup: 2 });
  const same = [person(1, 'Ana Roy', { email: 'a@x.fr' }), person(2, 'Ana Roy', { email: 'a@x.fr' })];
  assert.equal(runChecks(read(same, config({ checks: ['dup'] })), TODAY).total, 1, 'même nom et même adresse : une seule ligne');
});

test('adresse manquante et personne sans rattachement', () => {
  const people = [person(1, 'Ana Roy'), person(2, 'Sacha Bernard', { email: ' ' }), person(3, 'Noé Petit', { levels: [''] }), person(4, 'Ida Lu', { levels: ['', 'Dir'] })];
  const found = runChecks(read(people, config({ checks: ['mail', 'att'] })), TODAY);
  assert.deepEqual(found.issues.map(issue => [issue.kind, issue.row]), [['mail', 2], ['att', 3]]);
  assert.deepEqual(found.counts, { mail: 1, att: 1 });
});

test('responsable introuvable : une ligne qui n\'est pas dans l\'annuaire, soi-même, une chaîne qui boucle ; sans responsable, rien', () => {
  const people = [person(1, 'Ana Roy', { manager: 2 }), person(2, 'Bob Roy', { manager: 3 }), person(3, 'Cleo Roy', { manager: 1 }), person(4, 'Dan Roy', { manager: 99 }),
    person(5, 'Eli Roy', { manager: 5 }), person(6, 'Fay Roy'), person(7, 'Gus Roy', { manager: 6 })];
  const found = runChecks(read(people, config({ checks: ['resp'] })), TODAY);
  const why = Object.fromEntries(found.issues.map(issue => [issue.row, issue.why]));
  assert.deepEqual(why, { 1: 'cycle', 2: 'cycle', 3: 'cycle', 4: 'missing', 5: 'self' });
  assert.equal(found.issues.find(issue => issue.row === 4).manager, 99);
});

test('départ dépassé : une date avant aujourd\'hui ; aujourd\'hui et demain ne le sont pas ; une case vide non plus', () => {
  const people = [person(1, 'Ana Roy'), person(2, 'Bob Roy'), person(3, 'Cleo Roy'), person(4, 'Dan Roy'), person(5, 'Eli Roy')];
  const cfg = config({ checks: ['dep'], leave: 'Depart' });
  const data = { Depart: [midnight(2026, 9, 30), midnight(2026, 11, 25), midnight(2026, 11, 26), null, 'texte'] };
  const found = runChecks(read(people, cfg, data), TODAY);
  assert.deepEqual(found.issues.map(issue => [issue.row, issue.day]), [[1, '2026-09-30']]);
  assert.equal(runChecks(read(people, config({ checks: ['dep'] }), data), TODAY).total, 0, 'sans colonne de départ, le contrôle ne lit rien');
});

test('départ dépassé : une personne dont la fiche est masquée n\'est plus « encore active »', () => {
  const people = [person(1, 'Ana Roy'), person(2, 'Bob Roy')];
  const cfg = config({ checks: ['dep'], leave: 'Depart' });
  const data = { Depart: [midnight(2026, 9, 30), midnight(2026, 9, 30)] };
  const found = runChecks({ ...read(people, cfg, data), masked: new Set([1]) }, TODAY);
  assert.deepEqual(found.issues.map(issue => issue.row), [2]);
});

test('un contrôle éteint ne compte pas, et son compte n\'existe pas ; les contrôles par défaut ne comprennent pas le départ', () => {
  const people = [person(1, 'Ana Roy', { email: '' }), person(2, 'Bob Roy', { manager: 99 })];
  const found = runChecks(read(people, config({ checks: ['mail'] })), TODAY);
  assert.deepEqual(found.counts, { mail: 1 });
  assert.equal(found.total, 1);
  const byDefault = runChecks(read(people, config({})), TODAY);
  assert.deepEqual(Object.keys(byDefault.counts), ['dup', 'mail', 'att', 'resp']);
  assert.equal(runChecks(read([], config({})), TODAY).total, 0);
});

test('comparer : une ligne par information, « same » quand les personnes sont d\'accord, sans les lignes vides partout', () => {
  const cfg = config({ fields: [{ col: 'Site', filter: true }], levels: [{ label: 'Pôle', path: ['Pole'] }, { label: '', path: ['Direction'] }] });
  const a = person(1, 'Léa Garnier', { title: 'Cheffe', email: 'lea@x.fr', levels: ['Pôle A', ''], fields: { Site: ['Siège'] } });
  const b = person(2, 'Lea Garnier', { title: 'cheffe', email: 'lea.garnier@y.fr', levels: ['Pôle A', ''], fields: { Site: ['Campus'] } });
  const rows = compareRows([a, b], cfg, { name: 'Nom', title: 'Poste', email: 'Adresse', phone: 'Téléphone' });
  const by = Object.fromEntries(rows.map(row => [row.key, row]));
  assert.deepEqual(rows.map(row => row.key), ['name', 'title', 'email', 'level:0', 'field:Site'], 'le téléphone et le niveau vides des deux n\'y sont pas');
  assert.equal(by.name.same, false);
  assert.equal(by.title.same, true, 'la casse ne compte pas');
  assert.equal(by.email.same, false);
  assert.equal(by['level:0'].same, true);
  assert.deepEqual(by['field:Site'].values, ['Siège', 'Campus']);
  assert.equal(by.email.label, 'Adresse');
});

test('comparer : les valeurs de champ s\'écrivent dans la langue de la personne quand la fenêtre donne son `format` (un oui/non n\'est pas « true »)', () => {
  const cfg = config({ fields: [{ col: 'Teletravail', filter: true }] });
  const a = person(1, 'Ana Roy', { fields: { Teletravail: ['true'] } });
  const b = person(2, 'Ana Roy', { fields: { Teletravail: ['false'] } });
  const raw = compareRows([a, b], cfg, { name: 'Nom', title: 'Poste', email: 'E-mail', phone: 'Tél.' }).find(row => row.key === 'field:Teletravail');
  assert.deepEqual(raw.values, ['true', 'false'], 'sans `format`, la valeur brute');
  const said = compareRows([a, b], cfg, { name: 'Nom', title: 'Poste', email: 'E-mail', phone: 'Tél.' }, (col, value) => (value === 'true' ? 'Oui' : 'Non'))
    .find(row => row.key === 'field:Teletravail');
  assert.deepEqual(said.values, ['Oui', 'Non']);
  assert.equal(said.same, false);
});

// ---------- Ma présence ----------

const withPresence = (people, cells, extra = {}) => read(people, config({ presence: { on: true, col: 'Visible' }, ...extra }), { Visible: cells });
const THREE = [person(1, 'Ana Roy', { email: 'ana@x.fr' }), person(2, 'Bob Roy', { email: 'bob@x.fr' }), person(3, 'Cleo Roy', { email: 'cleo@x.fr' })];

test('ma présence : éteinte, ou sans colonne, rien n\'est masqué', () => {
  assert.equal(presenceCol(readConfig({ presence: { on: false, col: 'Visible' } })), '');
  assert.equal(presenceCol(readConfig({ presence: { on: true, col: '' } })), '');
  assert.equal(presenceCol(readConfig({ presence: { on: true, col: 'Visible' } })), 'Visible');
  const off = read(THREE, config({}), { Visible: [true, true, true] });
  assert.equal(maskedRows(off).size, 0);
  assert.equal(presenceView(off, {}).people.length, 3);
});

test('ma présence : la case cochée masque, une case décochée ou vide montre', () => {
  const data = withPresence(THREE, [false, true, null]);
  assert.deepEqual([...maskedRows(data)], [2]);
  const view = presenceView(data, { admin: false, identity: '' });
  assert.deepEqual(view.people.map(each => each.row), [1, 3]);
  assert.equal(view.masked.size, 0, 'rien de masqué ne reste à l\'écran pour un lecteur qui n\'est pas concerné');
});

test('ma présence : un administrateur voit tout le monde, les masqués grisés ; la personne se voit elle-même', () => {
  const data = withPresence(THREE, [false, true, null]);
  const admin = presenceView(data, { admin: true });
  assert.deepEqual(admin.people.map(each => each.row), [1, 2, 3]);
  assert.deepEqual([...admin.masked], [2]);
  const self = presenceView(data, { admin: false, identity: 'BOB@x.fr' });
  assert.deepEqual(self.people.map(each => each.row), [1, 2, 3], 'la personne masquée se retrouve pour revenir (adresse comparée sans la casse)');
  assert.deepEqual([...self.masked], [2]);
});

test('ma présence : l\'arbre se recalcule sans les masqués', () => {
  const people = [person(1, 'Ana Roy', { levels: ['Pôle A'] }), person(2, 'Bob Roy', { levels: ['Pôle B'] })];
  const view = presenceView(withPresence(people, [false, true]), {});
  assert.deepEqual(view.tree.ch.map(node => node.name), ['Pôle A'], 'un pôle sans personne visible n\'apparaît plus');
  assert.equal(view.tree.count, 1);
});

test('ma présence : qui peut changer l\'interrupteur : un administrateur, chacun de sa propre fiche', () => {
  assert.equal(mineOf(THREE, ' Cleo@X.fr ').row, 3);
  assert.equal(mineOf(THREE, ''), null);
  assert.equal(mineOf(THREE, 'inconnu@x.fr'), null);
  const [ana, bob] = THREE;
  assert.equal(canSwitch(ana, { admin: true, identity: '', people: THREE }), true);
  assert.equal(canSwitch(ana, { admin: false, identity: 'ana@x.fr', people: THREE }), true);
  assert.equal(canSwitch(bob, { admin: false, identity: 'ana@x.fr', people: THREE }), false, 'pas de la fiche d\'un autre');
  assert.equal(canSwitch(ana, { admin: false, identity: '', people: THREE }), false, 'adresse inconnue : personne ne s\'y retrouve');
});
