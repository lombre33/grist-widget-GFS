// La lecture et l'écriture d'un annuaire (js/annuaire/annuaire-store.js) sur un faux Grist en mémoire : lire ne crée rien, créer demande l'accord de la personne,
// une colonne absente n'est jamais écrite, deux annuaires ne portent pas le même nom. Ce que Grist envoie vraiment se mesure dans le labo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeGrist } from './fake-grist.mjs';
import { AnnuaireStore, MissingTable, NameTaken, TableDeclined } from '../js/annuaire/annuaire-store.js';
import { documentFixture, configFixture } from './annuaire-fixtures.mjs';

// Les tables du document fictif, au format du faux Grist (des lignes), les tables internes comprises.
const rowsOf = data => {
  const names = Object.keys(data).filter(name => name !== 'id');
  return { columns: ['id', ...names], rows: data.id.map((id, i) => Object.fromEntries([['id', id], ...names.map(name => [name, data[name][i]])])) };
};
function world() {
  const fixture = documentFixture();
  const tables = Object.fromEntries(Object.entries(fixture).map(([name, data]) => [name, rowsOf(data)]));
  return fakeGrist(tables);
}
const store = (grist, consent = async () => true) => new AnnuaireStore({ port: grist.port, consent });

test('lire sans la table ne crée rien : aucun annuaire, aucune écriture', async () => {
  const grist = world();
  assert.deepEqual(await store(grist).list(), []);
  assert.equal(grist.actions.length, 0);
  assert.equal('GFS_Annuaires' in grist.tables, false);
});

test('le schéma vient des tables internes de Grist', async () => {
  const schema = await store(world()).schema();
  assert.deepEqual(Object.keys(schema).sort(), ['GFS_Annuaires', 'Personnes', 'Structures']);
  assert.equal(schema.Personnes.columns.find(column => column.id === 'Structure').ref, 'Structures');
});

test('créer : la table naît avec l\'accord de la personne, puis la ligne s\'écrit', async () => {
  const grist = world();
  let asked = 0;
  const made = await store(grist, async () => { asked++; return true; }).create({ name: ' Annuaire principal ', table: 'Personnes', config: configFixture() });
  assert.equal(asked, 1);
  assert.equal(made.name, 'Annuaire principal');
  assert.ok(Number.isInteger(made.row));
  assert.deepEqual(grist.actions.map(action => action[0]), ['AddTable', 'AddRecord']);
  const list = await store(grist).list();
  assert.deepEqual(list.map(each => [each.name, each.table]), [['Annuaire principal', 'Personnes']]);
  assert.deepEqual(list[0].config.levels.map(level => level.label), ['Pôle', 'Direction', 'Service']);
});

test('créer : un refus ne laisse rien derrière lui', async () => {
  const grist = world();
  await assert.rejects(store(grist, async () => false).create({ name: 'A', table: 'Personnes', config: configFixture() }), TableDeclined);
  assert.equal('GFS_Annuaires' in grist.tables, false);
});

test('créer : la table qui existe déjà ne redemande rien, et un nom pris est refusé', async () => {
  const grist = world();
  const one = store(grist);
  await one.create({ name: 'Principal', table: 'Personnes', config: configFixture() });
  let asked = 0;
  const two = store(grist, async () => { asked++; return true; });
  await two.create({ name: 'RH', table: 'Personnes', config: configFixture() });
  assert.equal(asked, 0);
  await assert.rejects(two.create({ name: ' principal ', table: 'Personnes', config: configFixture() }), NameTaken);
  assert.equal((await two.list()).length, 2);
});

test('lire un annuaire : les personnes, l\'arbre calculé et le schéma', async () => {
  const grist = world();
  const one = store(grist);
  const made = await one.create({ name: 'Principal', table: 'Personnes', config: configFixture() });
  const read = await one.read(made);
  assert.equal(read.people.length, 6);
  assert.equal(read.tree.count, 6);
  assert.deepEqual(read.tree.ch.map(node => node.name), ['Pôle Numérique', 'Pôle Ressources', 'Pôle Vie de campus']);
  assert.ok(read.schema.Personnes);
});

test('lire un annuaire dont la table a disparu : une erreur qui le dit', async () => {
  const grist = world();
  const one = store(grist);
  const made = await one.create({ name: 'Principal', table: 'Disparue', config: configFixture() });
  await assert.rejects(one.read(made), MissingTable);
});

test('enregistrer : la définition est réécrite, la table n\'est jamais créée par ce geste', async () => {
  const grist = world();
  const one = store(grist);
  const made = await one.create({ name: 'Principal', table: 'Personnes', config: configFixture() });
  const next = { ...configFixture(), levels: [configFixture().levels[0]] };
  const saved = await one.save(made, next);
  assert.equal(saved.config.levels.length, 1);
  assert.equal((await one.list())[0].config.levels.length, 1);
  assert.equal(grist.actions.at(-1)[0], 'UpdateRecord');
  const empty = world();
  await assert.rejects(store(empty).save({ row: 1, name: 'X', table: 'Personnes', config: configFixture() }, configFixture()), MissingTable);
  assert.equal('GFS_Annuaires' in empty.tables, false);
});
