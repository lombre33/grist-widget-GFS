// Les marques « accepté » / « refusé » d'une table reçue sont à ce document, jamais à l'envoyeur (js/sharing/received-marks.js ; audit « contournement » du 11/11). Ce que le vrai moteur en fait dans un vrai
// Grist est mesuré par labo/run-securite-marques.mjs ; ici, la correspondance de noms et la pose des colonnes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reservedMap, missingMarks, ensureMarks } from '../js/sharing/received-marks.js';

test('reservedMap : une colonne envoyée qui porte le nom d\'une marque arrive sous un autre nom, casse ignorée', () => {
  assert.deepEqual(reservedMap([{ id: 'Name' }, { id: 'Content' }]), {}, 'rien ne recoupe : aucune correspondance');
  assert.deepEqual(reservedMap(['FileId', 'Accepted', 'Refused']), { Accepted: 'Accepted_sent', Refused: 'Refused_sent' });
  assert.deepEqual(reservedMap([{ id: 'ACCEPTE', type: 'Bool' }, { id: 'refuse', type: 'Bool' }]), { ACCEPTE: 'ACCEPTE_sent', refuse: 'refuse_sent' }, 'Grist ne distingue pas les majuscules');
  assert.deepEqual(reservedMap(undefined), {});
  assert.deepEqual(reservedMap([null, 42, { nom: 'x' }]), {}, 'des colonnes mal formées ne cassent rien');
});

test('reservedMap : le nouveau nom n\'est jamais celui d\'une colonne envoyée (ni d\'une autre arrivée)', () => {
  assert.deepEqual(reservedMap(['Accepted', 'Accepted_sent']), { Accepted: 'Accepted_sent_2' });
  assert.deepEqual(reservedMap(['Accepted', 'ACCEPTED_SENT', 'Accepted_sent_2']), { Accepted: 'Accepted_sent_3' });
  const both = reservedMap(['Accepted', 'accepte']);
  assert.equal(new Set(Object.values(both).map(name => name.toLowerCase())).size, 2, 'deux colonnes qui ne diffèrent que par la casse ne partagent pas leur nouveau nom');
});

test('missingMarks : les colonnes de marque qui manquent, casse ignorée', () => {
  assert.deepEqual(missingMarks(['id', 'Name']).map(column => column.id), ['Accepted', 'Refused']);
  assert.deepEqual(missingMarks(['Name', 'accepted']).map(column => column.id), ['Refused']);
  assert.deepEqual(missingMarks(['Accepted', 'Refused']), []);
  assert.deepEqual(missingMarks(undefined).map(column => column.id), ['Accepted', 'Refused']);
});

// Un faux document : les tables internes de Grist, en colonnes, et les écritures notées.
function fakeDoc(tables) {
  const calls = [];
  const rows = Object.entries(tables);
  const internal = {
    _grist_Tables: { id: rows.map((_, i) => i + 1), tableId: rows.map(([name]) => name) },
    _grist_Tables_column: rows.flatMap(([, columns], i) => columns.map(colId => ({ parentId: i + 1, colId }))).reduce((all, one, i) => ({
      id: [...all.id, i + 1], parentId: [...all.parentId, one.parentId], colId: [...all.colId, one.colId] }), { id: [], parentId: [], colId: [] }),
  };
  return { calls, fetchTable: async name => internal[name], applyUserActions: async actions => { calls.push(actions); } };
}

test('ensureMarks : les deux colonnes naissent dans chaque table reçue qui les n\'a pas, en UNE écriture', async () => {
  const doc = fakeDoc({ GFS_Received: ['id', 'Name', 'Content'], GFS_Received_2: ['id', 'Name', 'Accepted'], Clients: ['id', 'Name'] });
  assert.deepEqual(await ensureMarks(doc, ['GFS_Received', 'GFS_Received_2', 'Clients']), ['GFS_Received', 'GFS_Received_2']);
  assert.equal(doc.calls.length, 1, 'une seule écriture : un lot qui échoue n\'écrit rien');
  assert.deepEqual(doc.calls[0], [
    ['AddColumn', 'GFS_Received', 'Accepted', { type: 'Bool', isFormula: false }], ['AddColumn', 'GFS_Received', 'Refused', { type: 'Bool', isFormula: false }],
    ['AddColumn', 'GFS_Received_2', 'Refused', { type: 'Bool', isFormula: false }]]);
});

test('ensureMarks : rien à écrire quand tout est là, quand la table n\'existe pas, et jamais dans une table qui n\'est pas une table reçue', async () => {
  const doc = fakeDoc({ GFS_Received: ['id', 'Accepted', 'Refused'], GFS_Receivedees: ['id'], Clients: ['id'] });
  assert.deepEqual(await ensureMarks(doc, ['GFS_Received', 'GFS_Receivedees', 'Clients', 'GFS_Received_9']), []);
  assert.deepEqual(await ensureMarks(doc, []), []);
  assert.deepEqual(await ensureMarks(doc, undefined), []);
  assert.deepEqual(doc.calls, []);
});
