// La table du document (contrats 6.4, 6.2, 7.4) : lire ne crée rien, écrire relit puis écrit, la table naît avec l'accord de la personne.
// Le port est un faux Grist en mémoire qui refuse, comme le vrai, d'écrire une colonne absente ; ce qui dépend de ce que Grist envoie vraiment
// (identifiant rendu par AddTable, colonnes lues) se mesure dans le labo (run-modules.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rangement, TableDeclined, TABLE, RESERVED } from '../js/rangement.js';

function fakeGrist(tables = {}, { renameTo = null } = {}) {
  const actions = [];
  const apply = ([verb, name, a, b]) => {
    actions.push([verb, name, a, b]);
    if (verb === 'AddTable') {
      const id = renameTo || name;
      tables[id] = { columns: ['id', ...a.map(column => column.id)], rows: [] };
      return { table_id: id, id: 1, columns: [], views: [] };
    }
    const table = tables[name];
    if (verb === 'AddColumn') { table.columns.push(a); return null; }
    const known = Object.keys(b);
    const unknown = known.filter(column => !table.columns.includes(column));
    if (unknown.length) throw new Error(`Invalid column ${unknown[0]}`);
    if (verb === 'AddRecord') { table.rows.push({ id: table.rows.length + 1, ...b }); return table.rows.length; }
    if (verb === 'UpdateRecord') { Object.assign(table.rows.find(row => row.id === a), b); return null; }
    throw new Error(`verbe inattendu ${verb}`);
  };
  const doc = {
    listTables: async () => Object.keys(tables),
    fetchTable: async name => {
      const table = tables[name];
      const data = {};
      for (const column of table.columns) data[column] = table.rows.map(row => row[column]);
      return data;
    },
    applyUserActions: async list => ({ retValues: list.map(apply) }),
  };
  return { port: { doc }, tables, actions };
}

const row = (id, extra) => ({ id, Utilisateur: '', App: '', Fichier: '', Favori: false, Dossier: '', Replie: false, Valeur: '', ...extra });
const full = ['id', 'Utilisateur', 'App', 'Fichier', 'Favori', 'Dossier', 'Replie', 'Valeur'];
const accept = () => async () => true;

test('lire sans la table : rien n\'existe, rien n\'est créé', async () => {
  const { port, actions } = fakeGrist({ Clients: { columns: ['id', 'Nom'], rows: [] } });
  const state = await new Rangement({ port, consent: () => assert.fail('aucune question en lecture') }).read();
  assert.deepEqual(state, { exists: false, columns: [], rowId: null, raw: null });
  assert.deepEqual(actions, []);
});

test('lire : la ligne réservée est retrouvée parmi les autres lignes ; un texte illisible vaut aucune valeur', async () => {
  const value = { publipostage: { extensions: ['graphique'] } };
  const tables = { [TABLE]: { columns: full, rows: [
    row(1, { Utilisateur: 'a@b.fr', App: 'publipostage', Fichier: '3', Favori: true }),
    row(2, { ...RESERVED, Valeur: JSON.stringify(value) }),
  ] } };
  const { port } = fakeGrist(tables);
  const state = await new Rangement({ port, consent: accept() }).read();
  assert.equal(state.exists, true);
  assert.equal(state.rowId, 2);
  assert.deepEqual(state.raw, value);
  tables[TABLE].rows[1].Valeur = '{pas du json';
  const broken = await new Rangement({ port, consent: accept() }).read();
  assert.deepEqual([broken.rowId, broken.raw], [2, null]);
});

test('lire : le nom de la table se reconnaît sans tenir compte de la casse', async () => {
  const { port } = fakeGrist({ gfs_rangement: { columns: full, rows: [row(1, { ...RESERVED, Valeur: '{}' })] } });
  const state = await new Rangement({ port, consent: accept() }).read();
  assert.deepEqual([state.exists, state.rowId, state.raw], [true, 1, {}]);
});

test('écrire sans la table, accord refusé : rien n\'est créé ni écrit, l\'erreur le dit', async () => {
  const { port, actions } = fakeGrist();
  let asked = 0;
  const store = new Rangement({ port, consent: async () => { asked += 1; return false; } });
  await assert.rejects(store.update(() => ({ a: 1 })), error => error instanceof TableDeclined && error.code === 'GFS_TABLE_REFUSEE');
  assert.equal(asked, 1);
  assert.deepEqual(actions, []);
});

test('écrire sans la table, accord donné : la table naît avec toutes ses colonnes, puis la ligne réservée', async () => {
  const { port, tables, actions } = fakeGrist();
  const store = new Rangement({ port, consent: accept() });
  const seen = [];
  const written = await store.update(raw => { seen.push(raw); return { publipostage: { extensions: [] } }; });
  assert.deepEqual(seen, [null]);
  assert.deepEqual(written, { publipostage: { extensions: [] } });
  assert.deepEqual(actions.map(action => action[0]), ['AddTable', 'AddRecord']);
  assert.deepEqual(tables[TABLE].columns, full);
  assert.deepEqual(actions[0][2].map(column => `${column.id}:${column.type}`), ['Utilisateur:Text', 'App:Text', 'Fichier:Text', 'Favori:Bool', 'Dossier:Text', 'Replie:Bool', 'Valeur:Text']);
  assert.deepEqual(tables[TABLE].rows, [{ id: 1, ...RESERVED, Valeur: '{"publipostage":{"extensions":[]}}' }]);
});

test('l\'identifiant que Grist a vraiment donné à la table est celui des écritures suivantes', async () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    const { port, tables, actions } = fakeGrist({}, { renameTo: 'GFS_Rangement2' });
    await new Rangement({ port, consent: accept() }).update(() => ({}));
    assert.equal(actions[1][1], 'GFS_Rangement2');
    assert.equal(tables.GFS_Rangement2.rows.length, 1);
  } finally { console.warn = warn; }
});

test('écrire une table qui existe : la ligne est relue puis mise à jour, les autres lignes ne bougent pas', async () => {
  const other = row(1, { Utilisateur: 'a@b.fr', App: 'publipostage', Fichier: '3', Favori: true });
  const tables = { [TABLE]: { columns: full, rows: [other, row(2, { ...RESERVED, Valeur: '{"automation":{"extensions":[]}}' })] } };
  const { port, actions } = fakeGrist(tables);
  const store = new Rangement({ port, consent: () => assert.fail('la table existe : pas de question') });
  const seen = [];
  await store.update(raw => { seen.push(raw); return { ...raw, publipostage: { extensions: [] } }; });
  assert.deepEqual(seen, [{ automation: { extensions: [] } }], 'la valeur est relue juste avant d\'écrire');
  assert.deepEqual(actions, [['UpdateRecord', TABLE, 2, { Valeur: '{"automation":{"extensions":[]},"publipostage":{"extensions":[]}}' }]]);
  assert.deepEqual(tables[TABLE].rows[0], other);
  tables[TABLE].rows[1].Valeur = '{"autre":{"extensions":[]}}'; // quelqu'un d'autre a écrit entre-temps
  await store.update(raw => { seen.push(raw); return raw; });
  assert.deepEqual(seen.at(-1), { autre: { extensions: [] } }, 'chaque écriture relit');
});

test('une table sans ligne réservée : la ligne est ajoutée, sans toucher aux autres', async () => {
  const tables = { [TABLE]: { columns: full, rows: [row(1, { Utilisateur: 'a@b.fr', App: 'x', Fichier: '1', Dossier: 'Factures' })] } };
  const { port, actions } = fakeGrist(tables);
  await new Rangement({ port, consent: () => assert.fail('pas de question') }).update(() => ({ x: { extensions: [] } }));
  assert.deepEqual(actions.map(action => action[0]), ['AddRecord']);
  assert.equal(tables[TABLE].rows.length, 2);
  assert.equal(tables[TABLE].rows[0].Dossier, 'Factures');
});

test('une colonne absente est ajoutée avant d\'être écrite : un seul écrit sur une colonne inconnue annulerait tout', async () => {
  const noValue = full.filter(column => column !== 'Valeur');
  const { port, tables, actions } = fakeGrist({ [TABLE]: { columns: noValue, rows: [row(1, { Utilisateur: 'a@b.fr' })] } });
  await new Rangement({ port, consent: accept() }).update(() => ({ x: { extensions: [] } }));
  assert.deepEqual(actions.map(action => [action[0], action[1]]), [['AddColumn', TABLE], ['AddRecord', TABLE]]);
  assert.equal(actions[0][2], 'Valeur');
  assert.ok(tables[TABLE].columns.includes('Valeur'));
});

test('la table est née pendant la question : pas de seconde création', async () => {
  const tables = {};
  const { port, actions } = fakeGrist(tables);
  const consent = async () => { tables[TABLE] = { columns: full, rows: [row(1, { ...RESERVED, Valeur: '{"a":{"extensions":[]}}' })] }; return true; };
  const seen = [];
  await new Rangement({ port, consent }).update(raw => { seen.push(raw); return raw; });
  assert.deepEqual(seen, [{ a: { extensions: [] } }], 'la valeur est relue après la question');
  assert.deepEqual(actions.map(action => action[0]), ['UpdateRecord']);
});

// Le rangement des fichiers par GFS (contrats 6.4) : une ligne par (personne, app, fichier), relue puis écrite en un seul lot.
const countLots = port => {
  const apply = port.doc.applyUserActions;
  const lots = [];
  port.doc.applyUserActions = list => { lots.push(list.length); return apply(list); };
  return lots;
};

test('setFiling : la ligne de la personne est mise à jour, celle qui manque est ajoutée, en un seul lot ; les autres ne bougent pas', async () => {
  const mine = row(1, { App: 'publipostage', Fichier: '3', Dossier: 'Factures' });
  const other = row(2, { Utilisateur: 'a@b.fr', App: 'publipostage', Fichier: '3', Favori: true, Dossier: 'Privé' });
  const reserved = row(3, { ...RESERVED, Valeur: '{}' });
  const tables = { [TABLE]: { columns: full, rows: [mine, other, reserved] } };
  const { port, actions } = fakeGrist(tables);
  const lots = countLots(port);
  await new Rangement({ port, consent: () => assert.fail('la table existe : pas de question') }).setFiling('', [
    { app: 'publipostage', file: 3, pinned: true, folder: 'Factures/2026' },
    { app: 'form', file: '7', pinned: false, folder: '' },
  ]);
  assert.deepEqual(lots, [2]);
  assert.deepEqual(actions, [
    ['UpdateRecord', TABLE, 1, { Favori: true, Dossier: 'Factures/2026' }],
    ['AddRecord', TABLE, null, { Utilisateur: '', App: 'form', Fichier: '7', Favori: false, Dossier: '' }],
  ]);
  assert.deepEqual(tables[TABLE].rows[1], other);
  assert.deepEqual(tables[TABLE].rows[2], reserved);
});

test('setFiling : une identité en « @ » est refusée, rien n\'est lu ni écrit ; une liste vide n\'écrit rien', async () => {
  const { port, actions } = fakeGrist({ [TABLE]: { columns: full, rows: [] } });
  const store = new Rangement({ port, consent: accept() });
  await assert.rejects(store.setFiling('@document', [{ app: 'gfs', file: 'apps', pinned: true, folder: '' }]), /réservée à GFS/);
  await store.setFiling('', []);
  assert.deepEqual(actions, []);
});

test('setFiling sans la table : la personne décide ; refus, rien n\'est écrit ; accord, la table naît puis la ligne', async () => {
  const refused = fakeGrist();
  await assert.rejects(new Rangement({ port: refused.port, consent: async () => false }).setFiling('', [{ app: 'x', file: '1', pinned: true, folder: '' }]),
    error => error instanceof TableDeclined);
  assert.deepEqual(refused.actions, []);
  const given = fakeGrist();
  await new Rangement({ port: given.port, consent: accept() }).setFiling('', [{ app: 'x', file: '1', pinned: true, folder: 'A' }]);
  assert.deepEqual(given.actions.map(action => action[0]), ['AddTable', 'AddRecord']);
  assert.deepEqual(given.tables[TABLE].rows, [{ id: 1, Utilisateur: '', App: 'x', Fichier: '1', Favori: true, Dossier: 'A' }]);
});

test('setFiling : une table d\'une version ancienne reçoit d\'abord ses colonnes de rangement, avec leur type', async () => {
  const old = ['id', 'Utilisateur', 'App', 'Fichier', 'Valeur'];
  const { port, tables, actions } = fakeGrist({ [TABLE]: { columns: [...old], rows: [row(1, { ...RESERVED, Valeur: '{}' })] } });
  await new Rangement({ port, consent: accept() }).setFiling('', [{ app: 'x', file: '1', pinned: true, folder: 'A' }]);
  assert.deepEqual(actions.slice(0, 2), [['AddColumn', TABLE, 'Favori', { type: 'Bool' }], ['AddColumn', TABLE, 'Dossier', { type: 'Text' }]]);
  assert.equal(actions[2][0], 'AddRecord');
  assert.deepEqual(tables[TABLE].columns, [...old, 'Favori', 'Dossier']);
});
