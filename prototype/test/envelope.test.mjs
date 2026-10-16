// L'enveloppe des messages propres à GFS (contrats 5.1) : appels, réponses, erreurs, numéro de contrat, appel sans `id`, événement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EnvelopePeer, isEnvelope, ENVELOPE } from '../js/envelope.js';

const make = handlers => {
  const sent = [];
  const peer = new EnvelopePeer({ send: msg => sent.push(msg), handlers });
  return { peer, sent };
};
const settle = () => new Promise(resolve => setTimeout(resolve, 5));

test('isEnvelope : un objet à numéro entier, sans mtype', () => {
  assert.equal(isEnvelope({ gfs: 0, type: 'appel' }), true);
  assert.equal(isEnvelope({ gfs: 0, mtype: 1 }), false, 'un message du protocole des widgets n\'est pas une enveloppe');
  assert.equal(isEnvelope({ gfs: '0' }), false);
  assert.equal(isEnvelope(null), false);
  assert.equal(isEnvelope('gfs'), false);
});

test('un appel connu reçoit sa réponse avec son id ; sans id, aucune réponse', async () => {
  const { peer, sent } = make({ contexte: async args => ({ eu: args }) });
  peer.receive({ gfs: ENVELOPE, type: 'appel', id: 7, nom: 'contexte', args: { a: 1 } });
  await settle();
  assert.deepEqual(sent, [{ gfs: 0, type: 'reponse', id: 7, data: { eu: { a: 1 } } }]);
  sent.length = 0;
  peer.receive({ gfs: ENVELOPE, type: 'appel', nom: 'contexte' });
  await settle();
  assert.deepEqual(sent, []);
});

test('un appel inconnu reçoit GFS_INCONNU ; une erreur du gestionnaire garde son code', async () => {
  const { peer, sent } = make({ casse: async () => { throw Object.assign(new Error('non'), { code: 'GFS_REFUSE' }); } });
  peer.receive({ gfs: 0, type: 'appel', id: 1, nom: 'ouvrir' });
  peer.receive({ gfs: 0, type: 'appel', id: 2, nom: 'casse' });
  peer.receive({ gfs: 0, type: 'appel', id: 3, nom: 'toString' });
  await settle();
  // Les réponses partent à leur rythme : l'id dit à quel appel chacune répond.
  assert.deepEqual(sent.map(m => [m.id, m.type, m.code]).sort((a, b) => a[0] - b[0]), [[1, 'erreur', 'GFS_INCONNU'], [2, 'erreur', 'GFS_REFUSE'], [3, 'erreur', 'GFS_INCONNU']]);
});

test('un message d\'un autre numéro de contrat, ou qui n\'est pas un appel, est ignoré', async () => {
  const { peer, sent } = make({ contexte: async () => ({}) });
  peer.receive({ gfs: 1, type: 'appel', id: 1, nom: 'contexte' });
  peer.receive({ gfs: 0, type: 'reponse', id: 1, data: {} });
  peer.receive({ gfs: 0, mtype: 1, type: 'appel', id: 1, nom: 'contexte' });
  await settle();
  assert.deepEqual(sent, []);
});

test('un événement part sans file d\'attente, une fois fermé plus rien ne part', async () => {
  const { peer, sent } = make({ contexte: async () => ({}) });
  peer.event('extensions', { extensions: ['graphique'] });
  assert.deepEqual(sent, [{ gfs: 0, type: 'evenement', nom: 'extensions', data: { extensions: ['graphique'] } }]);
  peer.close();
  peer.event('extensions', {});
  peer.receive({ gfs: 0, type: 'appel', id: 1, nom: 'contexte' });
  await settle();
  assert.equal(sent.length, 1);
});

// ----- GFS appelle l'app (contrats 5.1 : `ouvrir`, `fermer`) : la réponse revient par l'id, sans délai.

test('call : l\'appel part avec un id à partir de 1, la réponse de même id résout la promesse', async () => {
  const { peer, sent } = make({});
  const first = peer.call('ouvrir', { type: 'document' });
  const second = peer.call('ouvrir', { type: 'grille' });
  assert.deepEqual(sent, [
    { gfs: 0, type: 'appel', id: 1, nom: 'ouvrir', args: { type: 'document' } },
    { gfs: 0, type: 'appel', id: 2, nom: 'ouvrir', args: { type: 'grille' } },
  ]);
  peer.receive({ gfs: 0, type: 'reponse', id: 2, data: { ouvert: false } });
  peer.receive({ gfs: 0, type: 'reponse', id: 1, data: { ouvert: true } });
  assert.deepEqual(await second, { ouvert: false });
  assert.deepEqual(await first, { ouvert: true });
});

test('call : une erreur de l\'app rejette avec son code et son message ; une réponse sans corps vaut null', async () => {
  const { peer } = make({});
  const refused = peer.call('ouvrir', {});
  const empty = peer.call('fermer', {});
  peer.receive({ gfs: 0, type: 'erreur', id: 1, code: 'GFS_INCONNU', message: 'inconnu' });
  peer.receive({ gfs: 0, type: 'reponse', id: 2 });
  await assert.rejects(refused, error => error.code === 'GFS_INCONNU' && error.message === 'inconnu');
  assert.equal(await empty, null);
});

test('call : une réponse que personne n\'attend, d\'un autre numéro de contrat ou du protocole des widgets ne résout rien', async () => {
  const { peer } = make({});
  let settled = false;
  const pending = peer.call('ouvrir', {}).then(() => { settled = true; }, () => { settled = true; });
  peer.receive({ gfs: 0, type: 'reponse', id: 9, data: {} });
  peer.receive({ gfs: 1, type: 'reponse', id: 1, data: {} });
  peer.receive({ gfs: 0, mtype: 2, type: 'reponse', id: 1, data: {} });
  await settle();
  assert.equal(settled, false);
  peer.receive({ gfs: 0, type: 'reponse', id: 1, data: { ouvert: true } });
  peer.receive({ gfs: 0, type: 'reponse', id: 1, data: { ouvert: false } }); // une seconde réponse au même appel est ignorée
  await pending;
  assert.equal(settled, true);
});

test('call : l\'id d\'un appel de l\'app n\'a rien à voir avec celui d\'un appel de GFS', async () => {
  const { peer, sent } = make({ contexte: async () => ({ a: 1 }) });
  const pending = peer.call('ouvrir', {});
  peer.receive({ gfs: 0, type: 'appel', id: 1, nom: 'contexte' }); // l'app appelle `contexte` sous son propre id 1
  await settle();
  assert.deepEqual(sent.map(msg => [msg.type, msg.id]), [['appel', 1], ['reponse', 1]]);
  peer.receive({ gfs: 0, type: 'reponse', id: 1, data: { ouvert: true } });
  assert.deepEqual(await pending, { ouvert: true });
});

test('call : fermé, les appels en attente sont rejetés (l\'app n\'est plus active), un nouvel appel ne part pas', async () => {
  const { peer, sent } = make({});
  const pending = peer.call('ouvrir', {});
  peer.close();
  await assert.rejects(pending, error => error.code === 'GFS_INACTIF');
  await assert.rejects(peer.call('ouvrir', {}), error => error.code === 'GFS_INACTIF');
  assert.equal(sent.length, 1);
});
