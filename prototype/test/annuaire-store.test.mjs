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

test('lire un annuaire : l\'option « postes et hiérarchie » éteinte, l\'arbre n\'a que sa racine et le poste n\'est pas lu', async () => {
  const grist = world();
  const one = store(grist);
  const made = await one.create({ name: 'Principal', table: 'Personnes', config: { ...configFixture(), hierarchy: false } });
  const read = await one.read(made);
  assert.equal(read.people.length, 6);
  assert.deepEqual(read.tree.ch, []);
  assert.equal(read.tree.own.length, 6);
  assert.deepEqual(read.config.levels, []);
  assert.equal(read.people.every(person => person.title === ''), true);
  assert.equal(made.config.levels.length, 3, 'la définition garde ses niveaux écrits');
});

test('lire un annuaire avec un cache : une table n\'est lue qu\'une fois, même pour plusieurs lectures (l\'aperçu du réglage)', async () => {
  const grist = world();
  const one = store(grist);
  const made = await one.create({ name: 'Principal', table: 'Personnes', config: configFixture() });
  const fetched = [];
  const original = grist.port.doc.fetchTable.bind(grist.port.doc);
  grist.port.doc.fetchTable = name => { fetched.push(name); return original(name); };
  const cache = new Map();
  const first = await one.read(made, null, cache);
  const afterFirst = fetched.filter(name => !name.startsWith('_grist_')).length;
  const again = await one.read({ ...made, config: { ...made.config, levels: made.config.levels.slice(0, 1) } }, first.schema, cache);
  assert.equal(again.tree.ch.length, 3);
  assert.ok(cache.has('Personnes') && cache.has('Structures'));
  assert.equal(fetched.filter(name => !name.startsWith('_grist_')).length, afterFirst, 'la seconde lecture ne relit aucune table');
  await one.read(made, first.schema);
  assert.ok(fetched.filter(name => !name.startsWith('_grist_')).length > afterFirst, 'sans cache, on relit');
});

test('créer une colonne : une seule action « AddColumn », vide, du type dit ; l\'identifiant que Grist rend est celui qu\'on garde, sinon le nom', async () => {
  const grist = world();
  const made = await store(grist).addColumn('Personnes', ' Matricule ', 'Text');
  assert.deepEqual(made, { id: 'Matricule' });
  assert.deepEqual(grist.batches.at(-1), [['AddColumn', 'Personnes', 'Matricule', { type: 'Text', isFormula: false, label: 'Matricule' }]]);
  assert.ok(grist.tables.Personnes.columns.includes('Matricule'));
  const asked = { port: { doc: { applyUserActions: async () => ({ retValues: [{ colRef: 9, colId: 'Date_d_arrivee' }] }), fetchTable: async () => ({ id: [] }) } }, consent: async () => true };
  assert.deepEqual(await new AnnuaireStore(asked).addColumn('Personnes', 'Date d\'arrivée', 'Date'), { id: 'Date_d_arrivee' }, 'Grist peut changer l\'identifiant : on garde le sien');
});

test('créer une colonne de référence : le type désigne la table des personnes ; une écriture refusée remonte à la fenêtre qui l\'a demandée', async () => {
  const grist = world();
  await store(grist).addColumn('Personnes', 'Tuteur', 'Ref:Personnes');
  assert.equal(grist.batches.at(-1)[0][3].type, 'Ref:Personnes');
  const refused = { port: { doc: { applyUserActions: async () => { throw new Error('refusé'); } } }, consent: async () => true };
  await assert.rejects(() => new AnnuaireStore(refused).addColumn('Personnes', 'X', 'Text'), /refusé/);
});

test('créer une colonne de personne : elle montre le nom de la personne (colonne montrée + formule d\'affichage), pas son numéro ; sans la colonne, elle reste créée', async () => {
  const batches = [];
  const meta = { _grist_Tables: { id: [1, 2], tableId: ['Structures', 'Personnes'] },
    _grist_Tables_column: { id: [10, 11, 12], parentId: [1, 2, 2], colId: ['Nom', 'Prenom', 'Nom'] } };
  const port = { doc: { fetchTable: async name => meta[name], applyUserActions: async actions => { batches.push(actions); return { retValues: [{ colRef: 40, colId: 'Assistant' }] }; } } };
  assert.deepEqual(await new AnnuaireStore({ port, consent: async () => true }).addColumn('Personnes', 'Assistant', 'Ref:Personnes', 'Nom'), { id: 'Assistant' });
  assert.deepEqual(batches, [[['AddColumn', 'Personnes', 'Assistant', { type: 'Ref:Personnes', isFormula: false, label: 'Assistant', visibleCol: 12 }]],
    [['SetDisplayFormula', 'Personnes', null, 40, '$Assistant.Nom']]], 'la colonne montrée est celle de la table visée, pas celle d\'une autre table qui porte le même nom');
  batches.length = 0;
  await new AnnuaireStore({ port, consent: async () => true }).addColumn('Personnes', 'Matricule', 'Text', 'Nom');
  assert.equal(batches.length, 1, 'un texte ne montre rien d\'autre');
  assert.equal(batches[0][0][3].visibleCol, undefined);
  batches.length = 0;
  const failing = { doc: { fetchTable: async () => { throw new Error('refusé'); }, applyUserActions: async actions => { batches.push(actions); return { retValues: [{ colRef: 41, colId: 'Suppleant' }] }; } } };
  assert.deepEqual(await new AnnuaireStore({ port: failing, consent: async () => true }).addColumn('Personnes', 'Suppleant', 'Ref:Personnes', 'Nom'), { id: 'Suppleant' });
  assert.equal(batches.length, 1);
  assert.equal(batches[0][0][3].visibleCol, undefined, 'sans lecture des numéros, la colonne est créée quand même (avec ses numéros)');
});

test('lire une table pour les exemples : une lecture, sans rien écrire', async () => {
  const grist = world();
  const data = await store(grist).table('Personnes');
  assert.ok(Array.isArray(data.id) && data.id.length > 0);
  assert.equal(grist.actions.length, 0);
});

test('modifier une fiche : une seule écriture de la ligne, rien que les colonnes données ; Grist qui refuse laisse le document intact', async () => {
  const grist = world();
  const made = await store(grist).create({ name: 'Annuaire principal', table: 'Personnes', config: configFixture() });
  assert.ok(made.row);
  const before = grist.actions.length;
  await store(grist).update(['UpdateRecord', 'Personnes', 1, { Poste: 'Cheffe', Tel: '01 02 03 04 12' }]);
  assert.deepEqual(grist.actions.slice(before), [['UpdateRecord', 'Personnes', 1, { Poste: 'Cheffe', Tel: '01 02 03 04 12' }]]);
  const row = grist.tables.Personnes.rows.find(each => each.id === 1);
  assert.equal(row.Poste, 'Cheffe');
  assert.equal(row.Nom, 'Camille Durand', 'les autres colonnes ne bougent pas');
  await assert.rejects(store(grist).update(['UpdateRecord', 'Personnes', 1, { Absente: 'x' }]), /Invalid column Absente/, 'une colonne absente annule tout le lot');
  assert.equal(grist.tables.Personnes.rows.find(each => each.id === 1).Poste, 'Cheffe');
});

test('la lecture rend aussi les tables lues : de quoi proposer les valeurs et les choix du formulaire « Modifier »', async () => {
  const grist = world();
  const made = await store(grist).create({ name: 'Annuaire principal', table: 'Personnes', config: configFixture() });
  const read = await store(grist).read(made);
  assert.deepEqual(Object.keys(read.data).sort(), ['Personnes', 'Structures']);
  assert.deepEqual(read.data.Personnes.id, [1, 2, 3, 4, 5, 6]);
});

test('créer une table pour l\'annuaire : une seule action « AddTable » (le nom et l\'adresse), les identifiants que Grist a donnés ; sans réponse lisible, ceux qu\'on a demandés', async () => {
  const grist = world();
  const made = await store(grist).addTable('Directory_People');
  assert.deepEqual(grist.batches.at(-1), [['AddTable', 'Directory_People', [{ id: 'Name', type: 'Text' }, { id: 'Email', type: 'Text' }]]]);
  assert.deepEqual(made, { id: 'Directory_People', columns: [{ id: 'Name', type: 'Text' }, { id: 'Email', type: 'Text' }] }, 'sans identifiants dans la réponse : ceux du nom demandé');
  const batches = [];
  const port = { doc: { applyUserActions: async actions => { batches.push(actions); return { retValues: [{ table_id: 'Directory_People2', columns: ['Name2', 'Email2'] }] }; } } };
  assert.deepEqual(await new AnnuaireStore({ port, consent: async () => true }).addTable(' Directory_People '), { id: 'Directory_People2',
    columns: [{ id: 'Name2', type: 'Text' }, { id: 'Email2', type: 'Text' }] }, 'Grist peut renommer la table et ses colonnes : on prend sa réponse');
  assert.equal(batches.length, 1, 'un seul lot : tout ou rien');
  const refused = { port: { doc: { applyUserActions: async () => { throw new Error('refusé'); } } }, consent: async () => true };
  await assert.rejects(() => new AnnuaireStore(refused).addTable('Directory_People'), /refusé/);
});

test('le nom proposé pour la table des personnes : « Directory_People », puis _2, _3 tant qu\'une table du document le porte (casse ignorée)', async () => {
  const { suggestedName } = await import('../js/annuaire/annuaire-setup-table.js');
  assert.equal(suggestedName({ Personnes: {} }), 'Directory_People');
  assert.equal(suggestedName({ Personnes: {}, directory_people: {} }), 'Directory_People_2');
  assert.equal(suggestedName({ Directory_People: {}, DIRECTORY_PEOPLE_2: {} }), 'Directory_People_3');
});
