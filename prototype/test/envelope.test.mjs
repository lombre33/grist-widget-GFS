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
