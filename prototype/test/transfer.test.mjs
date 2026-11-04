// Le cadre d'envoi, côté GFS (js/transfer.js, contrats 6.6) : le jeton est demandé à Grist pour chaque requête, l'adresse qui le porte part au cadre par un canal privé, la réponse (ou
// l'échec) lui revient par le même canal. Le cadre est une doublure sur un vrai MessageChannel ; ce que le vrai cadre fait de la requête (CSP, origine opaque, le serveur) se mesure
// dans le labo, sur un vrai serveur (labo/run-pdf.mjs).
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Transfer, TransferError } from '../js/transfer.js';

const BASE = 'https://pages.exemple.fr/gfs/index.html';
const GIVEN = { token: 'jeton+secret/=', baseUrl: 'https://grist.exemple.fr/o/docs/api/docs/DOC123/' };

// Une doublure du cadre : à la poignée de main elle reçoit le port, dit `ready` (sauf `mute`) et répond à chaque requête par `answer(requête)`.
function fakeFrames({ answer = request => ({ id: request.id, ok: true, value: 5 }), mute = false } = {}) {
  const frames = { created: [], requests: [], removed: 0, ports: [] };
  const createFrame = url => {
    frames.created.push(url);
    return {
      loaded: Promise.resolve(),
      remove: () => { frames.removed += 1; },
      window: {
        postMessage(message, origin, ports) {
          frames.handshake = message;
          const [port] = ports;
          frames.ports.push(port);
          port.onmessage = async event => {
            frames.requests.push(event.data);
            const reply = await answer(event.data);
            if (reply) port.postMessage(reply);
          };
          if (!mute) port.postMessage({ ready: true });
        },
      },
    };
  };
  return { frames, createFrame };
}

function setup(options = {}) {
  const { frames, createFrame } = fakeFrames(options.frame);
  const asked = [];
  const doc = { getAccessToken: async request => { asked.push(request); if (options.tokenError) throw options.tokenError; return options.given || GIVEN; } };
  const transfer = new Transfer({ doc, base: BASE, createFrame });
  return { transfer, frames, asked };
}

const finish = ({ transfer, frames }) => { transfer.close(); frames.ports.forEach(port => port.close()); };

test('envoyer : un jeton en écriture, le fichier et son nom au cadre, l\'adresse porte le jeton encodé ; le numéro de la pièce jointe revient', async () => {
  const run = setup({ frame: { answer: request => ({ id: request.id, ok: true, value: 12 }) } });
  const file = { name: 'x.pdf', size: 3 };
  assert.equal(await run.transfer.upload(file, 'Facture.pdf'), 12);
  assert.deepEqual(run.asked, [{ readOnly: false }]);
  const [request] = run.frames.requests;
  assert.deepEqual([request.op, request.name], ['upload', 'Facture.pdf']);
  assert.equal(request.url, 'https://grist.exemple.fr/o/docs/api/docs/DOC123/attachments?auth=jeton%2Bsecret%2F%3D', 'un seul « / » entre l\'adresse et le chemin, le jeton encodé');
  assert.deepEqual(request.file, file);
  finish(run);
});

test('télécharger : un jeton en lecture seule, l\'adresse de la pièce jointe, le Blob revient', async () => {
  const blob = new Blob(['%PDF-1.4']);
  const run = setup({ frame: { answer: request => ({ id: request.id, ok: true, value: blob }) } });
  const got = await run.transfer.download(42);
  assert.equal(await got.text(), '%PDF-1.4');
  assert.deepEqual(run.asked, [{ readOnly: true }]);
  assert.equal(run.frames.requests[0].url, 'https://grist.exemple.fr/o/docs/api/docs/DOC123/attachments/42/download?auth=jeton%2Bsecret%2F%3D');
  assert.equal(run.frames.requests[0].op, 'download');
  finish(run);
});

test('le cadre est celui de transfer/index.html, ouvert une fois et gardé ; le canal est remis par une poignée de main', async () => {
  const run = setup();
  await run.transfer.upload({}, 'a.pdf');
  await run.transfer.upload({}, 'b.pdf');
  assert.deepEqual(run.frames.created, ['https://pages.exemple.fr/gfs/transfer/index.html']);
  assert.deepEqual(run.frames.handshake, { gfs: 'transfer' });
  finish(run);
});

test('des requêtes qui se chevauchent retrouvent chacune leur réponse, même rendues dans le désordre', async () => {
  const held = [];
  const run = setup({ frame: { answer: request => new Promise(resolve => held.push(() => resolve({ id: request.id, ok: true, value: request.name === 'a.pdf' ? 1 : 2 }))) } });
  const first = run.transfer.upload({}, 'a.pdf');
  const second = run.transfer.upload({}, 'b.pdf');
  while (held.length < 2) await new Promise(resolve => setTimeout(resolve, 5));
  held[1]();
  held[0]();
  assert.deepEqual(await Promise.all([first, second]), [1, 2]);
  finish(run);
});

test('un refus du serveur : le code et le texte du serveur sont gardés', async () => {
  const run = setup({ frame: { answer: request => ({ id: request.id, ok: false, network: false, status: 413, message: 'Payload Too Large' }) } });
  await assert.rejects(run.transfer.upload({}, 'a.pdf'), error => error instanceof TransferError && error.kind === 'http' && error.status === 413 && error.message === 'Payload Too Large');
  finish(run);
});

test('un serveur qui ne répond pas : « network » ; une réponse mal formée : « answer »', async () => {
  const run = setup({ frame: { answer: request => (request.name === 'a.pdf' ? { id: request.id, ok: false, network: true, status: 0, message: 'Failed to fetch' } : { id: request.id, ok: false, network: false, status: 0, message: 'pas un numéro' }) } });
  await assert.rejects(run.transfer.upload({}, 'a.pdf'), error => error.kind === 'network' && error.message === 'Failed to fetch');
  await assert.rejects(run.transfer.upload({}, 'b.pdf'), error => error.kind === 'answer');
  finish(run);
});

test('un numéro de pièce jointe qui n\'en est pas un est refusé', async () => {
  const run = setup({ frame: { answer: request => ({ id: request.id, ok: true, value: 'abc' }) } });
  await assert.rejects(run.transfer.upload({}, 'a.pdf'), error => error.kind === 'answer');
  finish(run);
});

test('Grist ne donne pas de jeton : « token », et rien n\'est envoyé au cadre', async () => {
  const run = setup({ tokenError: new Error('accès refusé') });
  await assert.rejects(run.transfer.upload({}, 'a.pdf'), error => error.kind === 'token' && /accès refusé/.test(error.message));
  assert.deepEqual(run.frames.created, [], 'le cadre ne s\'ouvre même pas');
  const bad = setup({ given: { baseUrl: 'https://x' } });
  await assert.rejects(bad.transfer.download(1), error => error.kind === 'token');
});

test('un cadre qui ne dit jamais « ready » (page absente, politique de sécurité) : « frame » au bout du délai, et le transfert suivant rouvre un cadre', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const run = setup({ frame: { mute: true } });
  const attempt = run.transfer.upload({}, 'a.pdf');
  await new Promise(resolve => setImmediate(resolve));
  t.mock.timers.tick(8000);
  await assert.rejects(attempt, error => error instanceof TransferError && error.kind === 'frame');
  assert.equal(run.frames.removed, 1, 'le cadre muet est retiré');
  const again = run.transfer.upload({}, 'b.pdf').catch(() => null);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.frames.created.length, 2, 'une nouvelle tentative ouvre un nouveau cadre');
  t.mock.timers.tick(8000);
  await again;
  finish(run);
});

test('un transfert trop long : « timeout » ; close() fait échouer ce qui attend et le suivant repart d\'un cadre neuf', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const run = setup({ frame: { answer: () => null } });
  const slow = run.transfer.upload({}, 'a.pdf');
  while (!run.frames.requests.length) await new Promise(resolve => setImmediate(resolve));
  t.mock.timers.tick(10 * 60 * 1000);
  await assert.rejects(slow, error => error.kind === 'timeout');
  const waiting = run.transfer.download(1);
  while (run.frames.requests.length < 2) await new Promise(resolve => setImmediate(resolve));
  run.transfer.close();
  await assert.rejects(waiting, error => error.kind === 'frame');
  assert.equal(run.frames.removed, 1);
  finish(run);
});

// La preuve de propriétaire (contrats 5.2, point 8) : `GET /webhooks` avec un jeton qui peut écrire. Mesuré dans un vrai Grist 1.7.19 (labo/run-droits-reel.mjs) : 200 pour un propriétaire,
// 403 « No owner access » pour un éditeur et un lecteur. Tout autre cas reste « on ne sait pas ».
test('isOwner : 200 → vrai ; 403 « No owner access » → faux ; tout le reste → null ; jeton qui peut écrire, adresse /webhooks', async () => {
  const owner = setup({ frame: { answer: request => ({ id: request.id, ok: true, value: 200 }) } });
  assert.equal(await owner.transfer.isOwner(), true);
  assert.deepEqual(owner.asked, [{ readOnly: false }], 'le jeton en lecture seule est refusé à tous : il faut celui qui peut écrire');
  assert.equal(owner.frames.requests[0].op, 'status');
  assert.equal(owner.frames.requests[0].url, 'https://grist.exemple.fr/o/docs/api/docs/DOC123/webhooks?auth=jeton%2Bsecret%2F%3D');
  finish(owner);
  const editor = setup({ frame: { answer: request => ({ id: request.id, ok: false, network: false, status: 403, message: 'No owner access' }) } });
  assert.equal(await editor.transfer.isOwner(), false);
  finish(editor);
  const other403 = setup({ frame: { answer: request => ({ id: request.id, ok: false, network: false, status: 403, message: 'access denied' }) } });
  assert.equal(await other403.transfer.isOwner(), null, 'un 403 qui ne parle pas des propriétaires ne prouve rien');
  finish(other403);
  const absent = setup({ frame: { answer: request => ({ id: request.id, ok: false, network: false, status: 404, message: 'not found' }) } });
  assert.equal(await absent.transfer.isOwner(), null, 'une version de Grist sans cette route : on ne sait pas');
  finish(absent);
  const offline = setup({ frame: { answer: request => ({ id: request.id, ok: false, network: true, status: 0, message: 'Failed to fetch' }) } });
  assert.equal(await offline.transfer.isOwner(), null);
  finish(offline);
  const noToken = setup({ tokenError: new Error('pas de jeton') });
  assert.equal(await noToken.transfer.isOwner(), null);
  assert.equal(noToken.frames.created.length, 0, 'sans jeton, le cadre ne s\'ouvre même pas');
  finish(noToken);
});

test('sql : un jeton en lecture seule, l\'adresse /sql porte le jeton et la lecture encodée, les lignes reviennent sans leur enveloppe', async () => {
  const records = [{ fields: { octets: 1048576 } }];
  const run = setup({ frame: { answer: request => ({ id: request.id, ok: true, value: { statement: 'x', records } }) } });
  assert.deepEqual(await run.transfer.sql('SELECT 1 AS octets'), [{ octets: 1048576 }]);
  assert.deepEqual(run.asked, [{ readOnly: true }], 'une lecture : le jeton ne peut pas écrire');
  const [request] = run.frames.requests;
  assert.equal(request.op, 'json');
  assert.equal(request.url, 'https://grist.exemple.fr/o/docs/api/docs/DOC123/sql?auth=jeton%2Bsecret%2F%3D&q=SELECT%201%20AS%20octets');
  finish(run);
});

test('sql : `writable` demande le jeton qui peut écrire (un propriétaire d\'un document à règles d\'accès), et seulement lui', async () => {
  const run = setup({ frame: { answer: request => ({ id: request.id, ok: true, value: { records: [{ fields: { octets: 1 } }] } }) } });
  await run.transfer.sql('SELECT 1 AS octets');
  await run.transfer.sql('SELECT 1 AS octets', { writable: true });
  await run.transfer.sql('SELECT 1 AS octets', {});
  assert.deepEqual(run.asked, [{ readOnly: true }, { readOnly: false }, { readOnly: true }]);
  finish(run);
});

test('sql : un refus du serveur (403 : pas le droit de tout copier ; 400 : lecture coupée) revient en « http » avec son code ; une réponse sans lignes est « answer »', async () => {
  const denied = setup({ frame: { answer: request => ({ id: request.id, ok: false, network: false, status: 403, message: 'Insufficient access' }) } });
  await assert.rejects(denied.transfer.sql('SELECT 1'), error => error instanceof TransferError && error.kind === 'http' && error.status === 403);
  finish(denied);
  const cut = setup({ frame: { answer: request => ({ id: request.id, ok: false, network: false, status: 400, message: 'a slow statement resulted in a database interrupt' }) } });
  await assert.rejects(cut.transfer.sql('SELECT 1'), error => error.kind === 'http' && error.status === 400);
  finish(cut);
  const odd = setup({ frame: { answer: request => ({ id: request.id, ok: true, value: { not: 'records' } }) } });
  await assert.rejects(odd.transfer.sql('SELECT 1'), error => error.kind === 'answer');
  finish(odd);
});
