// La table du document (contrats 6.4, 6.2, 7.4) : lire ne crée rien, écrire relit puis écrit, la table naît avec l'accord de la personne.
// Le port est un faux Grist en mémoire qui refuse, comme le vrai, d'écrire une colonne absente ; ce qui dépend de ce que Grist envoie vraiment
// (identifiant rendu par AddTable, colonnes lues, adresse écrite par la formule déclenchée) se mesure dans le labo (run-modules.mjs, run-identite.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rangement, TableDeclined, TABLE, RESERVED } from '../js/rangement.js';

// `email` : l'adresse que le faux Grist inscrit, à la création d'une ligne-sonde, dans une colonne à formule déclenchée `user.Email` (null : Grist ne connaît pas la personne).
// `fail` : { AddRecord, RemoveRecord } : un message, et ce verbe échoue.
function fakeGrist(tables = {}, { renameTo = null, email = null, fail = {} } = {}) {
  const actions = [];
  const specs = {};
  const apply = ([verb, name, a, b]) => {
    actions.push([verb, name, a, b]);
    if (verb === 'AddTable') {
      const id = renameTo || name;
      tables[id] = { columns: ['id', ...a.map(column => column.id)], rows: [] };
      specs[id] = Object.fromEntries(a.map(column => [column.id, column]));
      return { table_id: id, id: 1, columns: [], views: [] };
    }
    const table = tables[name];
    if (verb === 'AddColumn') { table.columns.push(a); (specs[name] ||= {})[a] = { id: a, ...b }; return null; }
    if (fail[verb] && verb !== 'AddTable') throw new Error(fail[verb]);
    if (verb === 'RemoveRecord') { table.rows.splice(table.rows.findIndex(row => row.id === a), 1); return null; }
    const known = Object.keys(b);
    const unknown = known.filter(column => !table.columns.includes(column));
    if (unknown.length) throw new Error(`Invalid column ${unknown[0]}`);
    if (verb === 'AddRecord') {
      table.nextId = (table.nextId || Math.max(0, ...table.rows.map(row => row.id)) + 1);
      const made = { id: table.nextId++, ...b };
      // Une colonne à formule déclenchée est remplie par Grist à la création de la ligne : l'adresse de la personne pour la ligne-sonde, rien pour les autres.
      for (const column of table.columns) {
        // Une table donnée qui a déjà sa colonne `Adresse` l'a reçue de GFS : à formule déclenchée.
        const spec = (specs[name] || {})[column] || (column === 'Adresse' ? { isFormula: false, formula: 'user.Email' } : null);
        if (spec && spec.isFormula === false && /user\.Email/.test(spec.formula || '')) made[column] = b.Utilisateur === '@sonde' ? email : '';
      }
      table.rows.push(made);
      return made.id;
    }
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

const row = (id, extra) => ({ id, Utilisateur: '', App: '', Fichier: '', Favori: false, Dossier: '', Replie: false, Valeur: '', Adresse: '', ...extra });
const full = ['id', 'Utilisateur', 'App', 'Fichier', 'Favori', 'Dossier', 'Replie', 'Valeur', 'Adresse'];
const accept = () => async () => true;
// Grist réutilise les numéros de ligne libérés : un essai ne s'appuie jamais sur le numéro d'une ligne que la sonde a précédée.
const withoutIds = rows => rows.map(({ id, ...line }) => line);
// Les essais qui ne portent pas sur l'identité : la sonde n'écrit rien (document en lecture seule), ils comptent les écritures de ce qu'ils testent.
const noProbe = { canWrite: () => false };

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

test('écrire sans la table, accord donné : la table naît avec toutes ses colonnes, la sonde passe, puis la ligne réservée', async () => {
  const { port, tables, actions } = fakeGrist();
  const store = new Rangement({ port, consent: accept() });
  const seen = [];
  const written = await store.update(raw => { seen.push(raw); return { publipostage: { extensions: [] } }; });
  assert.deepEqual(seen, [null]);
  assert.deepEqual(written, { publipostage: { extensions: [] } });
  assert.deepEqual(actions.map(action => action[0]), ['AddTable', 'AddRecord', 'RemoveRecord', 'AddRecord']);
  assert.deepEqual(tables[TABLE].columns, full);
  assert.deepEqual(actions[0][2].map(column => `${column.id}:${column.type}`), ['Utilisateur:Text', 'App:Text', 'Fichier:Text', 'Favori:Bool', 'Dossier:Text', 'Replie:Bool', 'Valeur:Text', 'Adresse:Text']);
  assert.deepEqual(withoutIds(tables[TABLE].rows), [{ ...RESERVED, Valeur: '{"publipostage":{"extensions":[]}}', Adresse: '' }], 'la ligne-sonde est partie, la ligne réservée est seule');
});

test('la colonne Adresse naît avec sa formule déclenchée : Grist la remplit à la création d\'une ligne, jamais ensuite, et seulement pour la ligne-sonde', async () => {
  const { port, actions } = fakeGrist();
  await new Rangement({ port, consent: accept() }).update(() => ({}));
  const column = actions[0][2].find(item => item.id === 'Adresse');
  assert.deepEqual([column.isFormula, column.recalcWhen, column.recalcDeps], [false, 0, null]);
  assert.equal(column.formula, "user.Email if $Utilisateur == '@sonde' else ''");
});

test('l\'identifiant que Grist a vraiment donné à la table est celui des écritures suivantes', async () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    const { port, tables, actions } = fakeGrist({}, { renameTo: 'GFS_Rangement2' });
    await new Rangement({ port, consent: accept() }).update(() => ({}));
    assert.ok(actions.slice(1).every(action => action[1] === 'GFS_Rangement2'), 'la sonde comme la ligne réservée vont à la table que Grist a nommée');
    assert.equal(tables.GFS_Rangement2.rows.length, 1);
  } finally { console.warn = warn; }
});

test('écrire une table qui existe : la ligne est relue puis mise à jour, les autres lignes ne bougent pas', async () => {
  const other = row(1, { Utilisateur: 'a@b.fr', App: 'publipostage', Fichier: '3', Favori: true });
  const tables = { [TABLE]: { columns: full, rows: [other, row(2, { ...RESERVED, Valeur: '{"automation":{"extensions":[]}}' })] } };
  const { port, actions } = fakeGrist(tables);
  const store = new Rangement({ port, consent: () => assert.fail('la table existe : pas de question'), ...noProbe });
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
  await new Rangement({ port, consent: () => assert.fail('pas de question'), ...noProbe }).update(() => ({ x: { extensions: [] } }));
  assert.deepEqual(actions.map(action => action[0]), ['AddRecord']);
  assert.equal(tables[TABLE].rows.length, 2);
  assert.equal(tables[TABLE].rows[0].Dossier, 'Factures');
});

test('une colonne absente est ajoutée avant d\'être écrite : un seul écrit sur une colonne inconnue annulerait tout', async () => {
  const noValue = full.filter(column => column !== 'Valeur');
  const { port, tables, actions } = fakeGrist({ [TABLE]: { columns: noValue, rows: [row(1, { Utilisateur: 'a@b.fr' })] } });
  await new Rangement({ port, consent: accept(), ...noProbe }).update(() => ({ x: { extensions: [] } }));
  assert.deepEqual(actions.map(action => [action[0], action[1]]), [['AddColumn', TABLE], ['AddRecord', TABLE]]);
  assert.equal(actions[0][2], 'Valeur');
  assert.ok(tables[TABLE].columns.includes('Valeur'));
});

test('la table est née pendant la question : pas de seconde création', async () => {
  const tables = {};
  const { port, actions } = fakeGrist(tables);
  const consent = async () => { tables[TABLE] = { columns: full, rows: [row(1, { ...RESERVED, Valeur: '{"a":{"extensions":[]}}' })] }; return true; };
  const seen = [];
  await new Rangement({ port, consent, ...noProbe }).update(raw => { seen.push(raw); return raw; });
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
  await new Rangement({ port, consent: () => assert.fail('la table existe : pas de question'), ...noProbe }).setFiling([
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

test('setFiling : une liste vide n\'écrit rien, pas même la sonde', async () => {
  const { port, actions } = fakeGrist({ [TABLE]: { columns: full, rows: [] } }, { email: 'ana@exemple.org' });
  await new Rangement({ port, consent: accept() }).setFiling([]);
  assert.deepEqual(actions, []);
});

test('setFiling sans la table : la personne décide ; refus, rien n\'est écrit ; accord, la table naît puis la ligne', async () => {
  const refused = fakeGrist();
  await assert.rejects(new Rangement({ port: refused.port, consent: async () => false }).setFiling([{ app: 'x', file: '1', pinned: true, folder: '' }]),
    error => error instanceof TableDeclined);
  assert.deepEqual(refused.actions, []);
  const given = fakeGrist();
  await new Rangement({ port: given.port, consent: accept(), ...noProbe }).setFiling([{ app: 'x', file: '1', pinned: true, folder: 'A' }]);
  assert.deepEqual(given.actions.map(action => action[0]), ['AddTable', 'AddRecord']);
  assert.deepEqual(given.tables[TABLE].rows, [{ id: 1, Utilisateur: '', App: 'x', Fichier: '1', Favori: true, Dossier: 'A', Adresse: '' }]);
});

test('setFiling : une table d\'une version ancienne reçoit d\'abord ses colonnes de rangement, avec leur type', async () => {
  const old = ['id', 'Utilisateur', 'App', 'Fichier', 'Valeur'];
  const { port, tables, actions } = fakeGrist({ [TABLE]: { columns: [...old], rows: [row(1, { ...RESERVED, Valeur: '{}' })] } });
  await new Rangement({ port, consent: accept(), ...noProbe }).setFiling([{ app: 'x', file: '1', pinned: true, folder: 'A' }]);
  assert.deepEqual(actions.slice(0, 2), [['AddColumn', TABLE, 'Favori', { type: 'Bool' }], ['AddColumn', TABLE, 'Dossier', { type: 'Text' }]]);
  assert.equal(actions[2][0], 'AddRecord');
  assert.deepEqual(tables[TABLE].columns, [...old, 'Favori', 'Dossier']);
});

// ---------- l'adresse de la personne (contrats 6.4, point 6) : une ligne-sonde, ajoutée puis retirée, dont Grist remplit `Adresse`

const ANA = 'ana@exemple.org';
const BEN = 'ben@exemple.org';
const PROBE_ROW = { Utilisateur: '@sonde' };
const verbs = actions => actions.map(action => action[0]);
const mine = (tables, who) => tables[TABLE].rows.filter(line => line.Utilisateur === who);

test('identify : la sonde est ajoutée puis retirée aussitôt, l\'adresse que Grist a écrite est retenue, et rien ne se rejoue', async () => {
  const tables = { [TABLE]: { columns: full, rows: [row(1, { ...RESERVED, Valeur: '{}' })] } };
  const { port, actions } = fakeGrist(tables, { email: ANA });
  const heard = [];
  const store = new Rangement({ port, consent: () => assert.fail('la sonde ne demande rien'), onIdentity: address => heard.push(address) });
  assert.equal(store.identity, '', 'avant la sonde, la personne est inconnue : rangement commun');
  assert.equal(await store.identify(), ANA);
  assert.deepEqual(actions, [['AddRecord', TABLE, null, PROBE_ROW], ['RemoveRecord', TABLE, 2, undefined]]);
  assert.deepEqual(tables[TABLE].rows.map(line => line.id), [1], 'la ligne-sonde n\'est plus là');
  assert.equal(store.identity, ANA);
  assert.equal(await store.identify(), ANA);
  assert.equal(actions.length, 2, 'une seule sonde par ouverture');
  assert.deepEqual(heard, [ANA]);
});

test('identify : sans table, rien n\'est créé ni écrit ; la table née plus tard, le geste suivant apprend l\'adresse', async () => {
  const tables = {};
  const { port, actions } = fakeGrist(tables, { email: ANA });
  const store = new Rangement({ port, consent: () => assert.fail('la sonde ne crée jamais la table') });
  assert.equal(await store.identify(), '');
  assert.deepEqual(actions, []);
  tables[TABLE] = { columns: full, rows: [] };
  assert.equal(await store.identify(), ANA, 'pas de refus gardé : la table existe maintenant');
});

test('identify : en lecture seule, rien n\'est tenté (un refus de plus pour rien) ; plus tard, quand l\'écriture est permise, la sonde passe', async () => {
  const tables = { [TABLE]: { columns: full, rows: [] } };
  const { port, actions } = fakeGrist(tables, { email: ANA });
  let writable = false;
  const store = new Rangement({ port, consent: accept(), canWrite: () => writable });
  assert.equal(await store.identify(), '');
  assert.deepEqual(actions, []);
  writable = true;
  assert.equal(await store.identify(), ANA);
});

test('identify : ce que Grist écrit n\'est pas toujours une adresse (anonyme, vide, erreur de la formule, nom réservé) : la personne reste inconnue, sans refaire la sonde', async () => {
  for (const email of [null, '', 'anon@getgrist.com', 'ANON@GetGrist.com', ['E', 'AttributeError'], '@document', 'sans-arobase', 'deux@arobases@exemple.org', 'avec espace@exemple.org']) {
    const { port, actions } = fakeGrist({ [TABLE]: { columns: full, rows: [] } }, { email });
    const heard = [];
    const store = new Rangement({ port, consent: accept(), onIdentity: address => heard.push(address) });
    assert.equal(await store.identify(), '', JSON.stringify(email));
    await store.identify();
    assert.deepEqual(verbs(actions), ['AddRecord', 'RemoveRecord'], `${JSON.stringify(email)} : une seule sonde, même sans adresse`);
    assert.deepEqual(heard, []);
  }
});

test('identify : l\'adresse est rendue sans les blancs autour', async () => {
  const { port } = fakeGrist({ [TABLE]: { columns: full, rows: [] } }, { email: `  ${ANA} ` });
  assert.equal(await new Rangement({ port, consent: accept() }).identify(), ANA);
});

test('identify ne lève jamais : une ligne refusée par Grist laisse la personne inconnue, le dit une fois, et le geste suivant réessaie', async () => {
  const warn = console.warn;
  const warned = [];
  console.warn = (...parts) => warned.push(parts.join(' '));
  try {
    const { port, actions } = fakeGrist({ [TABLE]: { columns: full, rows: [] } }, { email: ANA, fail: { AddRecord: 'accès refusé' } });
    const store = new Rangement({ port, consent: accept() });
    assert.equal(await store.identify(), '');
    assert.equal(warned.length, 1);
    assert.match(warned[0], /adresse de la personne/);
    assert.deepEqual(verbs(actions), ['AddRecord'], 'rien à retirer : la ligne n\'a pas été ajoutée');
    const retry = fakeGrist({ [TABLE]: { columns: full, rows: [] } }, { email: ANA });
    assert.equal(await new Rangement({ port: retry.port, consent: accept() }).identify(), ANA);
  } finally { console.warn = warn; }
});

test('identify : une sonde qu\'on ne peut pas retirer le dit, et l\'adresse lue vaut quand même', async () => {
  const warn = console.warn;
  const warned = [];
  console.warn = (...parts) => warned.push(parts.join(' '));
  try {
    const { port } = fakeGrist({ [TABLE]: { columns: full, rows: [] } }, { email: ANA, fail: { RemoveRecord: 'refusé' } });
    assert.equal(await new Rangement({ port, consent: accept() }).identify(), ANA);
    assert.equal(warned.length, 1);
    assert.match(warned[0], /ligne-sonde/);
  } finally { console.warn = warn; }
});

test('identify : une table d\'une version ancienne reçoit d\'abord sa colonne Adresse, à formule déclenchée, puis la sonde passe', async () => {
  const old = full.filter(column => column !== 'Adresse');
  const { port, tables, actions } = fakeGrist({ [TABLE]: { columns: [...old], rows: [row(1, { ...RESERVED, Valeur: '{}' })] } }, { email: ANA });
  assert.equal(await new Rangement({ port, consent: accept() }).identify(), ANA);
  assert.deepEqual(verbs(actions), ['AddColumn', 'AddRecord', 'RemoveRecord']);
  assert.deepEqual(actions[0].slice(0, 3), ['AddColumn', TABLE, 'Adresse']);
  assert.deepEqual([actions[0][3].type, actions[0][3].isFormula, actions[0][3].recalcWhen, actions[0][3].recalcDeps], ['Text', false, 0, null]);
  assert.match(actions[0][3].formula, /^user\.Email if \$Utilisateur == '@sonde'/);
  assert.deepEqual(tables[TABLE].columns, [...old, 'Adresse']);
});

test('identify : une table sans colonne Utilisateur n\'est pas touchée (la ligne-sonde ne s\'y écrirait pas)', async () => {
  const { port, actions } = fakeGrist({ [TABLE]: { columns: ['id', 'Autre'], rows: [] } }, { email: ANA });
  assert.equal(await new Rangement({ port, consent: accept() }).identify(), '');
  assert.deepEqual(actions, []);
});

test('identify : des demandes qui se chevauchent n\'ajoutent qu\'une seule ligne-sonde', async () => {
  const { port, actions } = fakeGrist({ [TABLE]: { columns: full, rows: [] } }, { email: ANA });
  const store = new Rangement({ port, consent: accept() });
  assert.deepEqual(await Promise.all([store.identify(), store.identify(), store.identify()]), [ANA, ANA, ANA]);
  assert.deepEqual(verbs(actions), ['AddRecord', 'RemoveRecord']);
});

test('setFiling : les lignes sont à la personne que Grist connaît ; une autre personne a les siennes, que la première ne touche pas', async () => {
  const tables = { [TABLE]: { columns: full, rows: [
    row(1, { Utilisateur: ANA, App: 'publipostage', Fichier: '3', Favori: true, Dossier: 'Factures' }),
    row(2, { Utilisateur: BEN, App: 'publipostage', Fichier: '3', Favori: false, Dossier: 'Privé' }),
    row(3, { Utilisateur: '', App: 'publipostage', Fichier: '3', Dossier: 'Commun' }),
  ] } };
  const ana = fakeGrist(tables, { email: ANA });
  await new Rangement({ port: ana.port, consent: accept() }).setFiling([{ app: 'publipostage', file: 3, pinned: false, folder: 'Factures/2026' }, { app: 'form', file: '7', pinned: true, folder: '' }]);
  assert.deepEqual(mine(tables, ANA).map(line => [line.App, line.Fichier, line.Favori, line.Dossier]), [['publipostage', '3', false, 'Factures/2026'], ['form', '7', true, '']]);
  assert.deepEqual(mine(tables, BEN).map(line => line.Dossier), ['Privé'], 'celles de Ben ne bougent pas');
  assert.deepEqual(mine(tables, '').map(line => line.Dossier), ['Commun'], 'le rangement commun d\'avant ne bouge pas');
  const ben = fakeGrist(tables, { email: BEN });
  await new Rangement({ port: ben.port, consent: accept() }).setFiling([{ app: 'form', file: '7', pinned: true, folder: 'Mes formulaires' }]);
  assert.deepEqual(mine(tables, BEN).map(line => [line.App, line.Dossier]), [['publipostage', 'Privé'], ['form', 'Mes formulaires']]);
  assert.deepEqual(mine(tables, ANA).map(line => line.Dossier), ['Factures/2026', ''], 'celles d\'Ana ne bougent pas');
});

test('setFiling sans la table : la personne accepte, la table naît, GFS apprend son adresse, et la première ligne est déjà à elle', async () => {
  const { port, tables, actions } = fakeGrist({}, { email: ANA });
  const heard = [];
  const store = new Rangement({ port, consent: accept(), onIdentity: address => heard.push(address) });
  await store.setFiling([{ app: 'x', file: '1', pinned: true, folder: 'A' }]);
  assert.deepEqual(verbs(actions), ['AddTable', 'AddRecord', 'RemoveRecord', 'AddRecord']);
  assert.deepEqual(withoutIds(tables[TABLE].rows), [{ Utilisateur: ANA, App: 'x', Fichier: '1', Favori: true, Dossier: 'A', Adresse: '' }]);
  assert.equal(store.identity, ANA);
  assert.deepEqual(heard, [ANA]);
});

test('setFiling : une personne que Grist ne connaît pas (anonyme, lecture seule) range dans le rangement commun, comme avant', async () => {
  const anonymous = fakeGrist({ [TABLE]: { columns: full, rows: [] } }, { email: 'anon@getgrist.com' });
  await new Rangement({ port: anonymous.port, consent: accept() }).setFiling([{ app: 'x', file: '1', pinned: true, folder: '' }]);
  assert.deepEqual(anonymous.tables[TABLE].rows.map(line => line.Utilisateur), ['']);
  const reader = fakeGrist({ [TABLE]: { columns: full, rows: [] } }, { email: ANA });
  await new Rangement({ port: reader.port, consent: accept(), ...noProbe }).setFiling([{ app: 'x', file: '1', pinned: true, folder: '' }]);
  assert.deepEqual(reader.tables[TABLE].rows.map(line => line.Utilisateur), ['']);
  assert.ok(!verbs(reader.actions).includes('RemoveRecord'), 'aucune sonde en lecture seule');
});

test('update (les apps installées) reconnaît aussi la personne avant d\'écrire : la table peut naître là', async () => {
  const { port, tables, actions } = fakeGrist({}, { email: ANA });
  const store = new Rangement({ port, consent: accept() });
  await store.update(() => ({ publipostage: { extensions: [] } }));
  assert.equal(store.identity, ANA);
  assert.deepEqual(verbs(actions), ['AddTable', 'AddRecord', 'RemoveRecord', 'AddRecord']);
  assert.deepEqual(tables[TABLE].rows.map(line => line.Utilisateur), ['@document']);
});
