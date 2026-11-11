// « Partagés avec moi », côté données (js/received-files.js, contrats 6.6, point 17) : les tables reçues se reconnaissent, l'état d'une arrivée se lit de ses deux marques, la réponse s'écrit sur la ligne,
// sans jamais créer de table. Le port est un faux Grist en mémoire (fake-grist.mjs) ; ce que le moteur de Sync+ fait de ces colonnes aux mises à jour (elles tiennent, une ligne effacée revient) se mesure
// dans un vrai Grist (labo/run-recus-etat.mjs, faits vérifiés 72).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isReceivedTable, receivedTables, readReceived, loadReceived, answerFile, shownReceived, pendingOf, isAcceptedReceived, stateOf, PENDING, ACCEPTED, REFUSED, RECEIVED_APP,
} from '../js/received-files.js';
import { FILES_COLUMN_IDS } from '../js/gfs-files.js';
import { fakeGrist } from './fake-grist.mjs';

const COLUMNS = ['id', ...FILES_COLUMN_IDS, 'Supprimee_a_la_source'];
const arrival = (row, name, extra = {}) => ({ id: row, Identifiant: `f${row}`, Nom: name, Type: 'pdf', Date: 1762000000 + row, Auteur: 'compta@exemple.fr', Contenu: ['L', row], Taille: 2000 + row, Origine: 'import', Supprimee_a_la_source: false, ...extra });
const table = (rows, columns = COLUMNS) => ({ columns, rows });
const dataOf = async (tables, name) => (await fakeGrist(tables).port.doc.fetchTable(name));

test('les tables reçues : GFS_Recus, GFS_Recus_2… dans l\'ordre de leur numéro, casse ignorée ; aucune autre table, même au nom proche', () => {
  assert.equal(isReceivedTable('GFS_Recus'), true);
  assert.equal(isReceivedTable('gfs_recus_12'), true);
  for (const other of ['GFS_Recus_', 'GFS_Recus_x', 'GFS_RecusX', 'GFS_Fichiers', 'GFS_Recus_2_bis', 'Mes_GFS_Recus']) assert.equal(isReceivedTable(other), false, other);
  assert.deepEqual(receivedTables(['Table1', 'GFS_Recus_10', 'GFS_Recus_2', 'GFS_Recus', 'GFS_Fichiers', 'GFS_Recus_3']), ['GFS_Recus', 'GFS_Recus_2', 'GFS_Recus_3', 'GFS_Recus_10']);
  assert.deepEqual(receivedTables(null), []);
});

test('l\'état d\'une arrivée : sans marque « à accepter », une marque l\'accepte ou la refuse, le refus passe devant', () => {
  assert.equal(stateOf({ accepted: false, refused: false }), PENDING);
  assert.equal(stateOf({ accepted: true, refused: false }), ACCEPTED);
  assert.equal(stateOf({ accepted: false, refused: true }), REFUSED);
  assert.equal(stateOf({ accepted: true, refused: true }), REFUSED);
});

test('une table reçue sans les colonnes de GFS : tout est à accepter ; avec elles : chaque ligne a son état, le refusé n\'est pas montré', async () => {
  const bare = readReceived('GFS_Recus', await dataOf({ GFS_Recus: table([arrival(1, 'Facture.pdf'), arrival(2, 'Devis.pdf')]) }, 'GFS_Recus'));
  assert.deepEqual(bare.map(file => file.received.state), [PENDING, PENDING]);
  const marked = [arrival(1, 'Facture.pdf', { Accepte: true, Refuse: false }), arrival(2, 'Devis.pdf', { Accepte: false, Refuse: true }), arrival(3, 'Contrat.pdf', { Accepte: false, Refuse: false })];
  const files = readReceived('GFS_Recus', await dataOf({ GFS_Recus: table(marked, [...COLUMNS, 'Accepte', 'Refuse']) }, 'GFS_Recus'));
  assert.deepEqual(files.map(file => [file.name, file.received.state]), [['Facture.pdf', ACCEPTED], ['Devis.pdf', REFUSED], ['Contrat.pdf', PENDING]]);
  assert.deepEqual(shownReceived(files).map(file => file.name), ['Facture.pdf', 'Contrat.pdf']);
  assert.deepEqual(pendingOf(files).map(file => file.name), ['Contrat.pdf']);
  assert.deepEqual(files.map(isAcceptedReceived), [true, false, false]);
});

test('une arrivée est un fichier de l\'explorateur : type, icône, poids de sa pièce jointe, auteur, date ; sa clé porte la table (deux partages, un même identifiant)', async () => {
  const data = await dataOf({ GFS_Recus_2: table([arrival(7, 'Facture.pdf')]) }, 'GFS_Recus_2');
  const [file] = readReceived('GFS_Recus_2', data);
  assert.equal(file.app, RECEIVED_APP);
  assert.equal(file.key, `${RECEIVED_APP}:GFS_Recus_2:f7`);
  assert.deepEqual([file.id, file.type, file.icon, file.family, file.known, file.by, file.ts, file.trashed], ['f7', 'pdf', 'pdf', 'pdf', true, 'compta@exemple.fr', 1762000007, null]);
  assert.ok(file.weight >= 2007, `le poids compte la pièce jointe (${file.weight})`);
  assert.deepEqual(file.received, { table: 'GFS_Recus_2', row: 7, state: PENDING, gone: false, folder: '' });
  assert.equal(file.search, 'facture pdf', 'le texte de la recherche est posé (accents et casse ignorés)');
  const other = readReceived('GFS_Recus', data);
  assert.notEqual(other[0].key, file.key);
});

test('un fichier retiré chez l\'envoyeur (réception en archive) reste montré, marqué « gone »', async () => {
  const data = await dataOf({ GFS_Recus: table([arrival(1, 'Vieux.pdf', { Supprimee_a_la_source: true })]) }, 'GFS_Recus');
  assert.equal(readReceived('GFS_Recus', data)[0].received.gone, true);
});

test('loadReceived lit toutes les tables reçues ; une table illisible est dite et ne cache pas les autres ; sans liste de tables : rien', async () => {
  const grist = fakeGrist({ GFS_Recus: table([arrival(1, 'A.pdf')]), GFS_Recus_2: table([arrival(1, 'B.pdf')]), GFS_Fichiers: table([arrival(1, 'Mien.pdf')]) });
  const names = await grist.port.doc.listTables();
  assert.deepEqual((await loadReceived(grist.port, names)).map(file => file.name), ['A.pdf', 'B.pdf']);
  const warnings = [];
  const warn = console.warn;
  console.warn = (...args) => warnings.push(args[0]);
  try {
    const broken = { doc: { fetchTable: async name => { if (name === 'GFS_Recus') throw new Error('illisible'); return grist.port.doc.fetchTable(name); } } };
    assert.deepEqual((await loadReceived(broken, names)).map(file => file.name), ['B.pdf']);
  } finally { console.warn = warn; }
  assert.match(warnings.join(), /GFS_Recus est illisible/);
  assert.deepEqual(await loadReceived(grist.port, null), []);
});

test('répondre : les deux colonnes de GFS sont ajoutées AVANT d\'être écrites (une colonne inconnue annulerait le lot), puis la marque se pose sur la ligne', async () => {
  const grist = fakeGrist({ GFS_Recus: table([arrival(1, 'Facture.pdf'), arrival(2, 'Devis.pdf')]) });
  const files = readReceived('GFS_Recus', await grist.port.doc.fetchTable('GFS_Recus'));
  assert.equal(await answerFile(grist.port, files[0], true), true);
  assert.deepEqual(grist.actions.map(action => action.slice(0, 2).join(' ')), ['AddColumn GFS_Recus', 'AddColumn GFS_Recus', 'UpdateRecord GFS_Recus']);
  assert.deepEqual(grist.actions.slice(0, 2).map(action => action[2]), ['Accepte', 'Refuse']);
  assert.deepEqual(grist.tables.GFS_Recus.rows.map(row => [row.Accepte, row.Refuse]), [[true, false], [undefined, undefined]]);
  assert.equal(await answerFile(grist.port, files[1], false), true);
  assert.deepEqual(grist.tables.GFS_Recus.rows.map(row => [row.Accepte, row.Refuse]), [[true, false], [false, true]]);
  assert.equal(grist.actions.filter(action => action[0] === 'AddColumn').length, 2, 'les colonnes ne sont ajoutées qu\'une fois');
  const after = readReceived('GFS_Recus', await grist.port.doc.fetchTable('GFS_Recus'));
  assert.deepEqual(after.map(file => file.received.state), [ACCEPTED, REFUSED]);
});

test('répondre ne crée jamais de table et n\'écrit rien quand la table ou la ligne n\'est plus là', async () => {
  const empty = fakeGrist({});
  const ghost = { received: { table: 'GFS_Recus', row: 1 } };
  assert.equal(await answerFile(empty.port, ghost, true), false);
  assert.deepEqual(empty.actions, []);
  const grist = fakeGrist({ GFS_Recus: table([arrival(5, 'Facture.pdf')]) });
  assert.equal(await answerFile(grist.port, { received: { table: 'GFS_Recus', row: 99 } }, true), false);
  assert.deepEqual(grist.actions, [], 'une ligne qui n\'est plus là ne coûte aucune colonne');
  assert.deepEqual(Object.keys(grist.tables), ['GFS_Recus']);
});
