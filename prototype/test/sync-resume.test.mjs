// La reprise du partage à l'ouverture de la page (js/sync-resume.js) : un document sans table de partage ne charge rien ; la table technique reprend l'envoi ; un journal reçu reprend la réception.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeSharing, sharingNeeds } from '../js/sync-resume.js';

const engineFor = calls => ({ load: async () => { calls.push('load'); }, receive: async () => { calls.push('receive'); } });
const docOf = tables => ({ listTables: async () => tables });

test('les tables disent ce qui est à reprendre', () => {
  assert.deepEqual(sharingNeeds(['Clients', 'GFS_Fichiers']), { sending: false, receiving: false });
  assert.deepEqual(sharingNeeds(['Clients', 'GFS_Synchro']), { sending: true, receiving: false });
  assert.deepEqual(sharingNeeds(['GFS_Recus', 'GFS_Journal_Facture']), { sending: false, receiving: true });
  assert.deepEqual(sharingNeeds(['Journal_Facture', 'Synchro']), { sending: false, receiving: false }, 'les tables de Sync+ lui-même ne sont pas celles de GFS');
});

test('un document qui ne partage rien ne charge rien', async () => {
  const calls = [];
  assert.deepEqual(await resumeSharing({ docApi: docOf(['Clients', 'GFS_Fichiers']) }, engineFor(calls)), { sending: false, receiving: false });
  assert.deepEqual(calls, []);
});

test('un envoi laissé en route reprend par le moteur', async () => {
  const calls = [];
  await resumeSharing({ docApi: docOf(['GFS_Fichiers', 'GFS_Synchro']) }, engineFor(calls));
  assert.deepEqual(calls, ['load']);
});

test('un document qui a reçu un partage reprend la réception (le moteur est chargé par elle)', async () => {
  const calls = [];
  await resumeSharing({ docApi: docOf(['GFS_Recus', 'GFS_Journal_Facture']) }, engineFor(calls));
  assert.deepEqual(calls, ['receive']);
});

test('des tables illisibles ne reprennent rien et ne lèvent rien', async () => {
  const calls = [];
  const unreadable = { listTables: async () => { throw new Error('Access not granted'); } };
  assert.deepEqual(await resumeSharing({ docApi: unreadable }, engineFor(calls)), { sending: false, receiving: false });
  assert.deepEqual(calls, []);
});
