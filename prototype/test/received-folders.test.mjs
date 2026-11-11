// Les dossiers reçus d'un autre document Grist (js/sharing/received-folders.js, js/sharing/received-files.js `answerFolder` ; choix du porteur, 11/11 : « le dossier, à accepter d'un coup ») : le nom du dossier se lit de la colonne
// que l'envoyeur ajoute, les arrivées de même nom forment un dossier, un oui les marque toutes en UNE action, un fichier ajouté plus tard arrive seul à accepter. Faux Grist en mémoire : ce que le moteur fait de la
// colonne (elle suit, avec ses valeurs, même ajoutée après le premier partage) est mesuré dans un vrai Grist (labo/run-dossier-colonne.mjs, faits vérifiés 99).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readReceived, answerFolder, shownReceived, PENDING, ACCEPTED, REFUSED } from '../js/sharing/received-files.js';
import { receivedFolders, folderId } from '../js/sharing/received-folders.js';
import { FILES_COLUMN_IDS, SHARED_FOLDER_COLUMN } from '../js/files/gfs-files.js';
import { fakeGrist } from './fake-grist.mjs';

const COLUMNS = ['id', ...FILES_COLUMN_IDS, 'Supprimee_a_la_source', SHARED_FOLDER_COLUMN];
const arrival = (row, name, folder, extra = {}) => ({ id: row, Identifiant: `f${row}`, Nom: name, Type: 'pdf', Date: 1762000000 + row, Auteur: 'compta@exemple.fr', Contenu: ['L', row], Taille: 2000 + row, Origine: 'import', Supprimee_a_la_source: false, [SHARED_FOLDER_COLUMN]: folder, ...extra });
const table = (rows, columns = COLUMNS) => ({ columns, rows });
const load = async (tables, name = 'GFS_Recus') => readReceived(name, await fakeGrist(tables).port.doc.fetchTable(name));

test('le nom du dossier se lit de la colonne ; sans la colonne (un fichier partagé seul), il est vide', async () => {
  const files = await load({ GFS_Recus: table([arrival(1, 'A.pdf', 'Contrats'), arrival(2, 'B.pdf', '  Contrats  '), arrival(3, 'C.pdf', ''), arrival(4, 'D.pdf', null)]) });
  assert.deepEqual(files.map(file => file.received.folder), ['Contrats', 'Contrats', '', '']);
  const bare = await load({ GFS_Recus: table([arrival(1, 'A.pdf', 'Contrats')], COLUMNS.filter(column => column !== SHARED_FOLDER_COLUMN)) });
  assert.deepEqual(bare.map(file => file.received.folder), ['']);
});

test('les arrivées de même nom, dans la même table, forment un dossier ; deux tables ou deux noms, deux dossiers ; le reste est « sans dossier »', async () => {
  const one = await load({ GFS_Recus: table([arrival(1, 'A.pdf', 'Contrats'), arrival(2, 'B.pdf', 'Contrats'), arrival(3, 'C.pdf', 'Devis'), arrival(4, 'D.pdf', '')]) });
  const other = await load({ GFS_Recus_2: table([arrival(1, 'E.pdf', 'Contrats')]) }, 'GFS_Recus_2');
  const { folders, loose } = receivedFolders([...one, ...other]);
  assert.deepEqual(folders.map(folder => [folder.id, folder.name, folder.table, folder.count, folder.pending]), [
    [folderId('GFS_Recus', 'Contrats'), 'Contrats', 'GFS_Recus', 2, 2], [folderId('GFS_Recus', 'Devis'), 'Devis', 'GFS_Recus', 1, 1], [folderId('GFS_Recus_2', 'Contrats'), 'Contrats', 'GFS_Recus_2', 1, 1]]);
  assert.deepEqual(loose.map(file => file.name), ['D.pdf']);
  assert.equal(folders[0].weight, folders[0].files[0].weight + folders[0].files[1].weight, 'le poids est la somme de ses fichiers');
  assert.equal(folders[0].ts, 1762000002, 'la date est celle du fichier le plus récent');
  assert.equal(folders[0].by, 'compta@exemple.fr');
});

test('un fichier d\'ailleurs (donné par une adresse) n\'a pas de dossier reçu : il reste « sans dossier »', () => {
  const { folders, loose } = receivedFolders([{ name: 'Mien.pdf', direct: { by: 'marc@x.fr' } }]);
  assert.deepEqual([folders.length, loose.length], [0, 1]);
});

test('« à accepter » se lit des fichiers qui attendent : accepté et refusé seuls sortent du compte ; refusés, ils ne sont plus montrés, et un dossier sans fichier montré n\'existe plus', async () => {
  const marked = table([arrival(1, 'A.pdf', 'Contrats', { Accepte: true, Refuse: false }), arrival(2, 'B.pdf', 'Contrats', { Accepte: false, Refuse: false }), arrival(3, 'C.pdf', 'Contrats', { Accepte: false, Refuse: true }),
    arrival(4, 'D.pdf', 'Seul', { Accepte: false, Refuse: true })], [...COLUMNS, 'Accepte', 'Refuse']);
  const files = shownReceived(await load({ GFS_Recus: marked }));
  const { folders } = receivedFolders(files);
  assert.deepEqual(folders.map(folder => [folder.name, folder.count, folder.pending]), [['Contrats', 2, 1]], 'C.pdf refusé n\'est pas compté, « Seul » a disparu');
  assert.deepEqual(files.map(file => file.received.state), [ACCEPTED, PENDING]);
});

test('répondre au dossier : UNE action qui marque tous les fichiers à accepter (colonnes ajoutées d\'abord), sans toucher à ceux déjà répondus ni aux autres dossiers', async () => {
  const rows = [arrival(1, 'A.pdf', 'Contrats'), arrival(2, 'B.pdf', 'Contrats'), arrival(3, 'C.pdf', 'Devis'), arrival(4, 'D.pdf', 'Contrats')];
  const grist = fakeGrist({ GFS_Recus: table(rows) });
  const before = readReceived('GFS_Recus', await grist.port.doc.fetchTable('GFS_Recus'));
  assert.equal(await answerFolder(grist.port, receivedFolders(before).folders[0], false), 3, 'trois fichiers à répondre');
  assert.deepEqual(grist.actions.map(action => action.slice(0, 2).join(' ')), ['AddColumn GFS_Recus', 'AddColumn GFS_Recus', 'BulkUpdateRecord GFS_Recus']);
  assert.deepEqual(grist.actions[2][2], [1, 2, 4]);
  assert.deepEqual(grist.tables.GFS_Recus.rows.map(row => [row.Accepte, row.Refuse]), [[false, true], [false, true], [undefined, undefined], [false, true]]);
  const mid = readReceived('GFS_Recus', await grist.port.doc.fetchTable('GFS_Recus'));
  assert.deepEqual(mid.map(file => file.received.state), [REFUSED, REFUSED, PENDING, REFUSED]);
  // Un fichier déjà accepté seul n'est pas retouché par le refus du dossier ; un deuxième oui n'écrit plus rien.
  const grist2 = fakeGrist({ GFS_Recus: table([arrival(1, 'A.pdf', 'Contrats', { Accepte: true, Refuse: false }), arrival(2, 'B.pdf', 'Contrats', { Accepte: false, Refuse: false })], [...COLUMNS, 'Accepte', 'Refuse']) });
  const folder = receivedFolders(readReceived('GFS_Recus', await grist2.port.doc.fetchTable('GFS_Recus'))).folders[0];
  assert.equal(await answerFolder(grist2.port, folder, false), 1);
  assert.deepEqual(grist2.tables.GFS_Recus.rows.map(row => [row.Accepte, row.Refuse]), [[true, false], [false, true]]);
  const again = receivedFolders(readReceived('GFS_Recus', await grist2.port.doc.fetchTable('GFS_Recus'))).folders[0];
  const n = grist2.actions.length;
  assert.equal(await answerFolder(grist2.port, again, true), 0);
  assert.equal(grist2.actions.length, n, 'plus rien à répondre : aucune action');
});

test('répondre au dossier ne crée aucune table, ignore une ligne qui a disparu, et n\'écrit rien si la table n\'est plus là', async () => {
  const empty = fakeGrist({});
  const ghost = { table: 'GFS_Recus', files: [{ received: { row: 1, state: PENDING } }] };
  assert.equal(await answerFolder(empty.port, ghost, true), 0);
  assert.deepEqual(empty.actions, []);
  const grist = fakeGrist({ GFS_Recus: table([arrival(1, 'A.pdf', 'Contrats')]) });
  const folder = { table: 'GFS_Recus', files: [{ received: { row: 1, state: PENDING } }, { received: { row: 99, state: PENDING } }] };
  assert.equal(await answerFolder(grist.port, folder, true), 1, 'la ligne 99 n\'existe plus : seule la ligne 1 est marquée, le lot ne casse pas');
  assert.deepEqual(Object.keys(grist.tables), ['GFS_Recus']);
});

test('un fichier ajouté plus tard au dossier arrive seul à accepter : les autres gardent leur état', async () => {
  const first = table([arrival(1, 'A.pdf', 'Contrats', { Accepte: true, Refuse: false }), arrival(2, 'B.pdf', 'Contrats', { Accepte: true, Refuse: false })], [...COLUMNS, 'Accepte', 'Refuse']);
  assert.equal(receivedFolders(await load({ GFS_Recus: first })).folders[0].pending, 0);
  const later = table([...first.rows, arrival(3, 'C.pdf', 'Contrats')], first.columns);
  const folder = receivedFolders(await load({ GFS_Recus: later })).folders[0];
  assert.deepEqual([folder.count, folder.pending], [3, 1]);
  assert.deepEqual(folder.files.map(file => file.received.state), [ACCEPTED, ACCEPTED, PENDING]);
});
