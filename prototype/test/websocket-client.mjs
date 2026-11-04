// Un client WebSocket (RFC 6455) de quelques lignes, pour piloter Firefox (test/firefox.mjs). Pourquoi pas le `WebSocket` de Node 22 ? Il range ses clés de masque dans un tampon de 16 386 octets qu'il consomme
// quatre par quatre : à la 4 097e trame envoyée par le processus, le tampon est épuisé, les clés sortent vides et Firefox ferme la connexion sans un mot (mesuré le 04/11 sur Node 22.23, Firefox 159 : 4 092
// commandes d'affilée, clics, touches ou scripts, puis « Firefox a fermé la connexion » ; deux Firefox à la suite dans le même processus se partagent ces 4 096 trames, et la commande qui suit reste sans réponse
// jusqu'à son délai). Un fichier d'essais en envoyait 3 100 avant le poids dans l'explorateur ; la colonne et ses mesures l'ont fait passer au-dessus. Ici, une clé neuve par trame, sans limite.
// Même forme que le `WebSocket` du navigateur pour ce que `Bidi` en utilise : `send`, `close`, `onmessage`, `onclose`.
import { createHash, randomBytes } from 'node:crypto';
import { request } from 'node:http';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const TEXT = 0x1;
const CLOSE = 0x8;
const PING = 0x9;
const PONG = 0xa;

// Une trame complète. Celles du client sont masquées par une clé tirée au hasard à chaque envoi (RFC 6455, 5.3), celles du serveur ne le sont pas.
export function encodeFrame(data, { opcode = TEXT, mask = true } = {}) {
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  const size = payload.length;
  const extra = size < 126 ? 0 : size < 65536 ? 2 : 8;
  const head = Buffer.alloc(2 + extra + (mask ? 4 : 0));
  head[0] = 0x80 | opcode;
  head[1] = (mask ? 0x80 : 0) | (extra === 0 ? size : extra === 2 ? 126 : 127);
  if (extra === 2) head.writeUInt16BE(size, 2);
  if (extra === 8) head.writeBigUInt64BE(BigInt(size), 2);
  if (!mask) return Buffer.concat([head, payload]);
  const key = randomBytes(4);
  key.copy(head, head.length - 4);
  const body = Buffer.alloc(size);
  for (let i = 0; i < size; i++) body[i] = payload[i] ^ key[i & 3];
  return Buffer.concat([head, body]);
}

// La première trame de `buffer`, ou null quand elle n'est pas arrivée en entier : { fin, opcode, payload, used }.
function readFrame(buffer) {
  if (buffer.length < 2) return null;
  const masked = (buffer[1] & 0x80) !== 0;
  const marker = buffer[1] & 0x7f;
  let size = marker;
  let offset = 2;
  if (marker === 126) { if (buffer.length < 4) return null; size = buffer.readUInt16BE(2); offset = 4; } else if (marker === 127) { if (buffer.length < 10) return null; size = Number(buffer.readBigUInt64BE(2)); offset = 10; }
  const key = masked ? buffer.subarray(offset, offset + 4) : null;
  if (masked) offset += 4;
  if (buffer.length < offset + size) return null;
  const payload = Buffer.from(buffer.subarray(offset, offset + size));
  if (key) for (let i = 0; i < size; i++) payload[i] ^= key[i & 3];
  return { fin: (buffer[0] & 0x80) !== 0, opcode: buffer[0] & 0x0f, payload, used: offset + size };
}

// Ce qui arrive du réseau, par morceaux de n'importe quelle taille : `feed` rend les messages complets { opcode, payload }, les messages découpés en trames (continuation) recollés, les trames de contrôle (ping, pong, close) telles quelles.
export class FrameReader {
  #pending = Buffer.alloc(0);
  #parts = [];
  #opcode = TEXT;

  feed(chunk) {
    this.#pending = Buffer.concat([this.#pending, chunk]);
    const messages = [];
    for (let frame = readFrame(this.#pending); frame; frame = readFrame(this.#pending)) {
      this.#pending = this.#pending.subarray(frame.used);
      if (frame.opcode >= CLOSE) { messages.push({ opcode: frame.opcode, payload: frame.payload }); continue; }
      if (frame.opcode !== 0) this.#opcode = frame.opcode;
      this.#parts.push(frame.payload);
      if (frame.fin) { messages.push({ opcode: this.#opcode, payload: Buffer.concat(this.#parts) }); this.#parts = []; }
    }
    return messages;
  }
}

class Connection {
  onmessage = null;
  onclose = null;
  #socket;
  #reader = new FrameReader();
  #closed = false;

  constructor(socket, head) {
    this.#socket = socket;
    socket.on('data', chunk => this.#receive(chunk));
    socket.on('error', () => {}); // « close » suit, et dit tout ce qui compte
    socket.on('close', () => { if (!this.#closed) { this.#closed = true; if (this.onclose) this.onclose(); } });
    if (head.length) this.#receive(head);
  }

  #receive(chunk) {
    for (const { opcode, payload } of this.#reader.feed(chunk)) {
      if (opcode === TEXT && this.onmessage) this.onmessage({ data: payload.toString('utf8') });
      else if (opcode === PING) this.#socket.write(encodeFrame(payload, { opcode: PONG }));
      else if (opcode === CLOSE) this.#socket.end(encodeFrame(Buffer.alloc(0), { opcode: CLOSE }));
    }
  }

  send(text) { this.#socket.write(encodeFrame(text)); }

  close() { this.#socket.destroy(); }
}

// Ouvre `ws://hôte:port/chemin` et rend la connexion, ou refuse quand rien n'écoute encore (l'appelant réessaie) ou que la réponse n'est pas celle d'un serveur WebSocket.
export function openSocket(url) {
  return new Promise((resolve, reject) => {
    const { hostname, port, pathname } = new URL(url);
    const key = randomBytes(16).toString('base64');
    const attempt = request({ host: hostname, port, path: pathname, headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': key, 'Sec-WebSocket-Version': '13' } });
    attempt.on('error', () => reject(new Error('connexion refusée')));
    attempt.on('response', response => { response.resume(); reject(new Error('connexion refusée')); });
    attempt.on('upgrade', (response, socket, head) => {
      if (response.headers['sec-websocket-accept'] !== createHash('sha1').update(key + GUID).digest('base64')) { socket.destroy(); reject(new Error('connexion refusée')); return; }
      resolve(new Connection(socket, head));
    });
    attempt.end();
  });
}
