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
  assert.deepEqual(sharingNeeds(['Clients', 'GFS_Files']), { sending: false, receiving: false });
  assert.deepEqual(sharingNeeds(['Clients', 'GFS_Synchro']), { sending: true, receiving: false });
  assert.deepEqual(sharingNeeds(['GFS_Received', 'GFS_Journal_Facture']), { sending: false, receiving: true });
  assert.deepEqual(sharingNeeds(['Journal_Facture', 'Synchro']), { sending: false, receiving: false }, 'les tables de Sync+ lui-même ne sont pas celles de GFS');
});

test('un document qui ne partage rien ne charge rien', async () => {
  const calls = [];
  assert.deepEqual(await resumeSharing({ docApi: docOf(['Clients', 'GFS_Files']), isOwner: owner }, engineFor(calls), closing(calls)), { sending: false, receiving: false });
  assert.deepEqual(calls, []);
});

test('un envoi laissé en route reprend par le moteur', async () => {
  const calls = [];
  await resumeSharing({ docApi: docOf(['GFS_Files', 'GFS_Synchro']), isOwner: owner }, engineFor(calls), closing(calls));
  assert.deepEqual(calls, ['close', 'load'], 'les règles d\'abord, puis les boucles');
});

test('un document qui a reçu un partage reprend la réception (le moteur est chargé par elle)', async () => {
  const calls = [];
  await resumeSharing({ docApi: docOf(['GFS_Received', 'GFS_Journal_Facture']), isOwner: owner }, engineFor(calls), closing(calls), async () => []);
  assert.deepEqual(calls, ['close', 'receive']);
});

test('un document qui a reçu un partage pose d\'abord les colonnes de marque de ses tables reçues (propriétaire seulement), puis reprend la réception', async () => {
  const calls = [];
  const marks = async (docApi, tables) => { calls.push(['marks', tables]); };
  await resumeSharing({ docApi: docOf(['GFS_Received', 'GFS_Journal_Facture', 'Clients']), isOwner: owner }, engineFor(calls), closing(calls), marks);
  assert.deepEqual(calls, ['close', ['marks', ['GFS_Received', 'GFS_Journal_Facture', 'Clients']], 'receive']);
  const sending = [];
  await resumeSharing({ docApi: docOf(['GFS_Files', 'GFS_Synchro']), isOwner: owner }, engineFor(sending), closing(sending), marks);
  assert.deepEqual(sending, ['close', 'load'], 'qui n\'a rien reçu n\'a pas de marque à poser');
  const failing = [];
  await resumeSharing({ docApi: docOf(['GFS_Received', 'GFS_Journal_Facture']), isOwner: owner }, engineFor(failing), closing(failing), async () => { throw new Error('refusé'); });
  assert.deepEqual(failing, ['close', 'receive'], 'un échec est dit en console mais la réception reprend');
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
    const needs = await resumeSharing({ docApi: docOf(['GFS_Received', 'GFS_Journal_Facture', 'GFS_Synchro']), isOwner: proof }, engineFor(calls), closing(calls));
    assert.deepEqual(needs, { sending: true, receiving: true });
    assert.deepEqual(calls, [], `rien n'est lancé (preuve : ${proof})`);
  }
});

test('quand les règles viennent d\'être posées, Grist recharge le document : les boucles reprendront à l\'ouverture suivante', async () => {
  const calls = [];
  await resumeSharing({ docApi: docOf(['GFS_Files', 'GFS_Synchro']), isOwner: owner }, engineFor(calls), closing(calls, true));
  assert.deepEqual(calls, ['close']);
});

test('la reprise ne demande jamais la fermeture de la structure : un propriétaire qui l\'a rouverte la garde ouverte (elle ne se ferme qu\'à la fermeture de la fenêtre de liaison)', async () => {
  const asked = [];
  const close = async options => { asked.push(options); return { changed: false, tables: [] }; };
  const docApi = docOf(['GFS_Files', 'GFS_Synchro']);
  await resumeSharing({ docApi, isOwner: owner }, engineFor([]), close);
  assert.equal(asked.length, 1);
  assert.equal(asked[0].docApi, docApi);
  assert.equal(asked[0].structure, undefined);
});

test('une réception qui attendait le lien du formulaire rouvre sa fenêtre APRÈS la reprise des boucles, et seulement si la page n\'est pas sur le point d\'être rechargée par Grist', async () => {
  const calls = [];
  const resumeReception = async () => { calls.push('window'); };
  await resumeSharing({ docApi: docOf(['GFS_Recus', 'GFS_Journal_Facture']), isOwner: owner, resumeReception }, engineFor(calls), closing(calls), async () => []);
  assert.deepEqual(calls, ['close', 'receive', 'window'], 'les règles, la boucle, puis la fenêtre');
  const reloading = [];
  await resumeSharing({ docApi: docOf(['GFS_Recus', 'GFS_Journal_Facture']), isOwner: owner, resumeReception: async () => { reloading.push('window'); } }, engineFor(reloading), closing(reloading, true), async () => []);
  assert.deepEqual(reloading, ['close'], 'Grist recharge la page : la fenêtre s\'ouvrirait pour être fermée aussitôt');
  const sending = [];
  await resumeSharing({ docApi: docOf(['GFS_Fichiers', 'GFS_Synchro']), isOwner: owner, resumeReception: async () => { sending.push('window'); } }, engineFor(sending), closing(sending), async () => []);
  assert.deepEqual(sending, ['close', 'load'], 'sans journal reçu, aucune réception n\'attend');
  const stranger = [];
  await resumeSharing({ docApi: docOf(['GFS_Recus', 'GFS_Journal_Facture']), isOwner: async () => false, resumeReception: async () => { stranger.push('window'); } }, engineFor(stranger), closing(stranger));
  assert.deepEqual(stranger, [], 'sans la preuve d\'être propriétaire, rien ne s\'ouvre');
});
