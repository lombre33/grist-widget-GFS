// La conversation du courtier avec une app (contrats 1.1, 4.2), essayée contre le vrai grain-rpc 0.1.7 : celui que le script d'API de Grist
// embarque côté app. Le côté « app » de ces essais n'est donc pas une imitation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { AppPeer, MSG } from '../js/rpc.js';
import { Refus, ERR } from '../js/filter.js';

const { Rpc } = createRequire(import.meta.url)('grain-rpc');

// Une app (le vrai Rpc) reliée à un AppPeer par deux files synchrones ; `wire.toApp` garde ce que GFS lui envoie.
function connect({ onCall = async () => 'ok', onMessage, onReady } = {}) {
  const wire = { toApp: [], toGfs: [], ready: 0, received: [] };
  const app = new Rpc({ logger: {} });
  const peer = new AppPeer({
    send: msg => { wire.toApp.push(msg); app.receiveMessage(msg); },
    onCall: call => { wire.received.push(call); return onCall(call); },
    onMessage: onMessage || (data => wire.received.push({ message: data })),
    onReady: onReady || (() => { wire.ready++; }),
  });
  app.setSendMessage(msg => { wire.toGfs.push(msg); peer.receive(msg); });
  return { app, peer, wire };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 5));

test('contrats 4.2 point 1 : ce que GFS envoie, réponses comprises, attend le « ready » de l\'app', async () => {
  const { app, peer, wire } = connect({ onCall: async ({ meth }) => `reponse-${meth}` });
  const doc = app.getStub('GristDocAPI@grist');
  let answered = null;
  const pending = doc.getDocName().then(value => { answered = value; });
  await tick();
  assert.equal(wire.received.length, 1, 'l\'appel avant ready est reçu et exécuté');
  assert.equal(answered, null, 'sa réponse attend ready');
  assert.equal(wire.toApp.length, 0);
  peer.postMessage({ theme: 1 });
  assert.equal(wire.toApp.length, 0);
  await app.sendReadyMessage();
  await pending;
  assert.equal(answered, 'reponse-getDocName');
  assert.equal(wire.ready, 1);
  assert.deepEqual(wire.toApp.map(m => m.mtype), [MSG.RESP, MSG.CUSTOM], 'l\'ordre d\'envoi est gardé');
});

test('contrats 1.1 point 4 : un mdest autre que grist reçoit RPC_UNKNOWN_FORWARD_DEST', async () => {
  const { app } = connect();
  await app.sendReadyMessage();
  await assert.rejects(app.getStub('GristDocAPI@ailleurs').getDocName(), { code: 'RPC_UNKNOWN_FORWARD_DEST' });
  await assert.doesNotReject(app.getStub('GristView').fetchSelectedTable());
});

test('une erreur du courtier arrive à l\'app avec son code et son message', async () => {
  const { app } = connect({ onCall: async () => { throw new Refus(ERR.REFUSE, 'Table non déclarée'); } });
  await app.sendReadyMessage();
  await assert.rejects(app.getStub('GristDocAPI@grist').fetchTable('X'), { code: 'GFS_REFUSE', message: 'Table non déclarée' });
});

test('contrats 1.1 point 4 : un appel sans reqId n\'est ni exécuté ni répondu', async () => {
  const { peer, wire } = connect();
  peer.receive({ mtype: MSG.READY });
  peer.receive({ mtype: MSG.CALL, iface: 'WidgetAPI', meth: 'setOption', args: ['a', 1] });
  await tick();
  assert.equal(wire.received.length, 0);
  assert.equal(wire.toApp.length, 0);
});

test('contrats 1.1 point 4 : un message inconnu, mal formé ou adressé ailleurs est ignoré', async () => {
  const { peer, wire } = connect();
  for (const junk of [null, undefined, 'texte', 3, [], { mtype: 99 }, { mtype: 'x' }, {}, { mtype: MSG.CUSTOM, mdest: 'autre', data: { a: 1 } }]) peer.receive(junk);
  await tick();
  assert.equal(wire.received.length, 0);
  peer.receive({ mtype: MSG.CUSTOM, data: { message: 'themeInitialized' } });
  assert.deepEqual(wire.received, [{ message: { message: 'themeInitialized' } }]);
});

test('les arguments de l\'appel arrivent tels que l\'app les a envoyés', async () => {
  const { app, wire } = connect();
  await app.sendReadyMessage();
  await app.getStub('GristDocAPI@grist').applyUserActions([['AddRecord', 'T', null, { a: 1 }]], { desc: 'x' });
  assert.deepEqual(wire.received[0], { iface: 'GristDocAPI', meth: 'applyUserActions', args: [[['AddRecord', 'T', null, { a: 1 }]], { desc: 'x' }] });
});

test('GFS appelle une fonction de l\'app (print) et reçoit sa réponse ; l\'appel attend ready', async () => {
  const { app, peer, wire } = connect();
  let printed = 0;
  app.registerFunc('print', () => { printed++; return 'imprime'; });
  const result = peer.callApp('print');
  await tick();
  assert.equal(printed, 0);
  await app.sendReadyMessage();
  assert.equal(await result, 'imprime');
  assert.equal(printed, 1);
  assert.equal(wire.toApp[0].iface, 'print');
  assert.equal(wire.toApp[0].meth, 'invoke');
});

test('l\'app reçoit les événements de GFS par rpc.on("message"), dans l\'ordre', async () => {
  const { app, peer } = connect();
  const seen = [];
  app.on('message', data => seen.push(data));
  peer.postMessage({ options: null, settings: { accessLevel: 'full' }, fromReady: true });
  peer.postMessage({ theme: { appearance: 'dark' }, fromReady: true });
  await app.sendReadyMessage();
  assert.deepEqual(seen.map(m => Object.keys(m)[0]), ['options', 'theme']);
});

test('callApp : délai dépassé et fermeture du cadre rejettent l\'appel en attente', async () => {
  const { app, peer } = connect();
  app.registerFunc('editOptions', () => new Promise(() => {}));
  app.registerFunc('print', () => new Promise(() => {}));
  peer.receive({ mtype: MSG.READY });
  await assert.rejects(peer.callApp('editOptions', [], 20), { code: 'GFS_DELAI' });
  const closing = peer.callApp('print');
  peer.close();
  await assert.rejects(closing, { code: 'GFS_ANNULE' });
  peer.postMessage({ a: 1 });
});

test('un cadre fermé ne reçoit plus rien et ses messages sont jetés', async () => {
  const { app, peer, wire } = connect();
  await app.sendReadyMessage();
  peer.close();
  const before = wire.toApp.length;
  peer.postMessage({ a: 1 });
  peer.receive({ mtype: MSG.CALL, reqId: 5, iface: 'GristView', meth: 'allowSelectBy', args: [] });
  await tick();
  assert.equal(wire.toApp.length, before);
  assert.equal(wire.received.length, 0);
});
