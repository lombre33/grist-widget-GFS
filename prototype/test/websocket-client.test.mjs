// Le client WebSocket des essais sous Firefox (test/websocket-client.mjs) : les trames qu'il écrit et lit (RFC 6455), et, avec un vrai serveur, plus de 4 096 messages d'affilée, ce que le WebSocket de Node 22
// ne tient pas (sa 4 097e trame sort avec une clé de masque vide et Firefox ferme la connexion : mesuré le 04/11, voir l'en-tête du client).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { FrameReader, encodeFrame, openSocket } from './websocket-client.mjs';

const TEXT = 0x1;
const PING = 0x9;

test('encodeFrame et FrameReader : un message de 0, 5, 125, 126, 65 535, 65 536 et 70 000 octets fait l\'aller-retour, masqué (client) ou non (serveur), UTF-8 compris', () => {
  const sizes = [0, 5, 125, 126, 127, 65535, 65536, 70000];
  for (const size of sizes) {
    const text = 'é'.repeat(Math.floor(size / 2)) + 'x'.repeat(size % 2);
    for (const mask of [true, false]) {
      const [message, ...others] = new FrameReader().feed(encodeFrame(text, { mask }));
      assert.equal(others.length, 0);
      assert.equal(message.opcode, TEXT);
      assert.equal(message.payload.toString('utf8'), text, `${size} octets, ${mask ? 'masqué' : 'non masqué'}`);
    }
  }
});

test('encodeFrame : une clé de masque neuve à chaque trame, jamais vide (le WebSocket de Node 22 en sortait de vides après 4 096 trames)', () => {
  const keys = new Set();
  for (let i = 0; i < 6000; i++) {
    const frame = encodeFrame('x');
    const key = frame.subarray(2, 6);
    assert.ok(key.some(byte => byte !== 0) || i < 3, `la clé de la trame ${i} est vide`);
    keys.add(key.toString('hex'));
  }
  assert.ok(keys.size > 5900, `${keys.size} clés différentes sur 6 000 trames`);
});

test('FrameReader : un message arrivé octet par octet, deux messages dans un seul morceau, un message découpé en trames (continuation) avec un ping au milieu', () => {
  const frames = Buffer.concat([encodeFrame('un', { mask: false }), encodeFrame('deux', { mask: false })]);
  const reader = new FrameReader();
  const slow = [];
  for (const byte of frames) slow.push(...reader.feed(Buffer.from([byte])));
  assert.deepEqual(slow.map(message => message.payload.toString()), ['un', 'deux']);
  assert.deepEqual(new FrameReader().feed(frames).map(message => message.payload.toString()), ['un', 'deux']);

  const first = Buffer.from(encodeFrame('Bon', { mask: false }));
  first[0] = TEXT; // pas de bit FIN : la suite vient dans une trame de continuation
  const last = Buffer.from(encodeFrame('jour é', { mask: false }));
  last[0] = 0x80; // FIN, opcode 0 : continuation
  const ping = encodeFrame('?', { mask: false, opcode: PING });
  const messages = new FrameReader().feed(Buffer.concat([first, ping, last]));
  assert.deepEqual(messages.map(message => [message.opcode, message.payload.toString()]), [[PING, '?'], [TEXT, 'Bonjour é']]);
});

// Un serveur WebSocket de quelques lignes : il fait la poignée de main, répète chaque message reçu, répond au ping, et compte les messages lus.
function echoServer() {
  const server = createServer();
  const stats = { received: 0, masked: 0 };
  server.on('upgrade', (request, socket) => {
    const accept = createHash('sha1').update(`${request.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    const reader = new FrameReader();
    socket.on('data', chunk => {
      for (const { opcode, payload } of reader.feed(chunk)) {
        if (opcode !== TEXT) continue;
        stats.received += 1;
        socket.write(encodeFrame(payload, { mask: false }));
      }
    });
    socket.on('error', () => {});
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, stats, url: `ws://127.0.0.1:${server.address().port}/session` })));
}

test('openSocket : 5 000 messages d\'affilée, chacun répété par le serveur et lu en entier (le WebSocket de Node 22 s\'arrêtait au 4 097e envoi)', async () => {
  const { server, stats, url } = await echoServer();
  try {
    const socket = await openSocket(url);
    const waiting = [];
    socket.onmessage = event => waiting.shift()(event.data);
    const ask = text => new Promise(resolve => { waiting.push(resolve); socket.send(text); });
    for (let i = 0; i < 5000; i++) assert.equal(await ask(`message ${i} é`), `message ${i} é`);
    assert.equal(stats.received, 5000);
    let closed = false;
    socket.onclose = () => { closed = true; };
    socket.close();
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.ok(closed, 'close() ferme la connexion et prévient');
  } finally {
    server.close();
    server.closeAllConnections();
  }
});

test('openSocket : refuse quand rien n\'écoute ou que la réponse n\'est pas celle d\'un serveur WebSocket', async () => {
  const plain = createServer((request, response) => response.end('pas un WebSocket'));
  await new Promise(resolve => plain.listen(0, '127.0.0.1', resolve));
  const { port } = plain.address();
  try {
    await assert.rejects(openSocket(`ws://127.0.0.1:${port}/session`), /connexion refusée/);
  } finally {
    plain.close();
    plain.closeAllConnections();
  }
  const free = createServer();
  await new Promise(resolve => free.listen(0, '127.0.0.1', resolve));
  const closedPort = free.address().port;
  await new Promise(resolve => free.close(resolve));
  await assert.rejects(openSocket(`ws://127.0.0.1:${closedPort}/session`), /connexion refusée/);
});
