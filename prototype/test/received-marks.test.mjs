// Les marques « accepté » / « refusé » d'une table reçue sont à ce document, jamais à l'envoyeur (js/sharing/received-marks.js ; audit « contournement » du 11/11). Ce que le vrai moteur en fait dans un vrai
// Grist est mesuré par labo/run-securite-marques.mjs ; ici, la correspondance de noms et la pose des colonnes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reservedMap, missingMarks, ensureMarks } from '../js/sharing/received-marks.js';

test('reservedMap : une colonne envoyée qui porte le nom d\'une marque arrive sous un autre nom, casse ignorée', () => {
  assert.deepEqual(reservedMap([{ id: 'Nom' }, { id: 'Contenu' }]), {}, 'rien ne recoupe : aucune correspondance');
  assert.deepEqual(reservedMap(['Identifiant', 'Accepte', 'Refuse']), { Accepte: 'Accepte_envoye', Refuse: 'Refuse_envoye' });
  assert.deepEqual(reservedMap([{ id: 'ACCEPTE', type: 'Bool' }, { id: 'refuse', type: 'Bool' }]), { ACCEPTE: 'ACCEPTE_envoye', refuse: 'refuse_envoye' }, 'Grist ne distingue pas les majuscules');
  assert.deepEqual(reservedMap(undefined), {});
  assert.deepEqual(reservedMap([null, 42, { nom: 'x' }]), {}, 'des colonnes mal formées ne cassent rien');
});

test('reservedMap : le nouveau nom n\'est jamais celui d\'une colonne envoyée (ni d\'une autre arrivée)', () => {
  assert.deepEqual(reservedMap(['Accepte', 'Accepte_envoye']), { Accepte: 'Accepte_envoye_2' });
  assert.deepEqual(reservedMap(['Accepte', 'ACCEPTE_ENVOYE', 'Accepte_envoye_2']), { Accepte: 'Accepte_envoye_3' });
  const both = reservedMap(['Accepte', 'accepte']);
  assert.equal(new Set(Object.values(both).map(name => name.toLowerCase())).size, 2, 'deux colonnes qui ne diffèrent que par la casse ne partagent pas leur nouveau nom');
});

test('missingMarks : les colonnes de marque qui manquent, casse ignorée', () => {
  assert.deepEqual(missingMarks(['id', 'Nom']).map(column => column.id), ['Accepte', 'Refuse']);
  assert.deepEqual(missingMarks(['Nom', 'accepte']).map(column => column.id), ['Refuse']);
  assert.deepEqual(missingMarks(['Accepte', 'Refuse']), []);
  assert.deepEqual(missingMarks(undefined).map(column => column.id), ['Accepte', 'Refuse']);
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
  const doc = fakeDoc({ GFS_Recus: ['id', 'Nom', 'Contenu'], GFS_Recus_2: ['id', 'Nom', 'Accepte'], Clients: ['id', 'Nom'] });
  assert.deepEqual(await ensureMarks(doc, ['GFS_Recus', 'GFS_Recus_2', 'Clients']), ['GFS_Recus', 'GFS_Recus_2']);
  assert.equal(doc.calls.length, 1, 'une seule écriture : un lot qui échoue n\'écrit rien');
  assert.deepEqual(doc.calls[0], [
    ['AddColumn', 'GFS_Recus', 'Accepte', { type: 'Bool', isFormula: false }], ['AddColumn', 'GFS_Recus', 'Refuse', { type: 'Bool', isFormula: false }],
    ['AddColumn', 'GFS_Recus_2', 'Refuse', { type: 'Bool', isFormula: false }]]);
});

test('ensureMarks : rien à écrire quand tout est là, quand la table n\'existe pas, et jamais dans une table qui n\'est pas une table reçue', async () => {
  const doc = fakeDoc({ GFS_Recus: ['id', 'Accepte', 'Refuse'], GFS_Recusees: ['id'], Clients: ['id'] });
  assert.deepEqual(await ensureMarks(doc, ['GFS_Recus', 'GFS_Recusees', 'Clients', 'GFS_Recus_9']), []);
  assert.deepEqual(await ensureMarks(doc, []), []);
  assert.deepEqual(await ensureMarks(doc, undefined), []);
  assert.deepEqual(doc.calls, []);
});
