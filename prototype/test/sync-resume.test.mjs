// La reprise du partage à l'ouverture de la page (js/sharing/sync-resume.js) : un document sans table de partage ne charge rien ; la table technique reprend l'envoi ; un journal reçu reprend la réception.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeSharing, sharingNeeds } from '../js/sharing/sync-resume.js';

const engineFor = calls => ({ load: async () => { calls.push('load'); }, receive: async () => { calls.push('receive'); } });
const docOf = tables => ({ listTables: async () => tables });
// La pose des règles des tables techniques (js/sharing/sync-rules.js) est remplacée ici : elle a ses propres essais (test/sync-rules.test.mjs).
const closing = (calls, changed = false) => async () => { calls.push('close'); return { changed, tables: changed ? ['GFS_Synchro'] : [] }; };
const owner = async () => true;

test('les tables disent ce qui est à reprendre', () => {
  assert.deepEqual(sharingNeeds(['Clients', 'GFS_Fichiers']), { sending: false, receiving: false });
  assert.deepEqual(sharingNeeds(['Clients', 'GFS_Synchro']), { sending: true, receiving: false });
  assert.deepEqual(sharingNeeds(['GFS_Recus', 'GFS_Journal_Facture']), { sending: false, receiving: true });
  assert.deepEqual(sharingNeeds(['Journal_Facture', 'Synchro']), { sending: false, receiving: false }, 'les tables de Sync+ lui-même ne sont pas celles de GFS');
});

test('un document qui ne partage rien ne charge rien', async () => {
  const calls = [];
  assert.deepEqual(await resumeSharing({ docApi: docOf(['Clients', 'GFS_Fichiers']), isOwner: owner }, engineFor(calls), closing(calls)), { sending: false, receiving: false });
  assert.deepEqual(calls, []);
});

test('un envoi laissé en route reprend par le moteur', async () => {
  const calls = [];
  await resumeSharing({ docApi: docOf(['GFS_Fichiers', 'GFS_Synchro']), isOwner: owner }, engineFor(calls), closing(calls));
  assert.deepEqual(calls, ['close', 'load'], 'les règles d\'abord, puis les boucles');
});

test('un document qui a reçu un partage reprend la réception (le moteur est chargé par elle)', async () => {
  const calls = [];
  await resumeSharing({ docApi: docOf(['GFS_Recus', 'GFS_Journal_Facture']), isOwner: owner }, engineFor(calls), closing(calls));
  assert.deepEqual(calls, ['close', 'receive']);
});

test('des tables illisibles ne reprennent rien et ne lèvent rien', async () => {
  const calls = [];
  const unreadable = { listTables: async () => { throw new Error('Access not granted'); } };
  assert.deepEqual(await resumeSharing({ docApi: unreadable, isOwner: owner }, engineFor(calls), closing(calls)), { sending: false, receiving: false });
  assert.deepEqual(calls, []);
});

test('qui n\'est pas propriétaire, ou ne le prouve pas, ne reprend rien et ne pose rien (les tables techniques ne sont lisibles que des propriétaires)', async () => {
  for (const proof of [async () => false, async () => null, undefined]) {
    const calls = [];
    const needs = await resumeSharing({ docApi: docOf(['GFS_Recus', 'GFS_Journal_Facture', 'GFS_Synchro']), isOwner: proof }, engineFor(calls), closing(calls));
    assert.deepEqual(needs, { sending: true, receiving: true });
    assert.deepEqual(calls, [], `rien n'est lancé (preuve : ${proof})`);
  }
});

test('quand les règles viennent d\'être posées, Grist recharge le document : les boucles reprendront à l\'ouverture suivante', async () => {
  const calls = [];
  await resumeSharing({ docApi: docOf(['GFS_Fichiers', 'GFS_Synchro']), isOwner: owner }, engineFor(calls), closing(calls, true));
  assert.deepEqual(calls, ['close']);
});
