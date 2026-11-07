// Le cadre d'envoi, côté cadre (transfer/transfer.js) : un script classique lu ici dans un contexte à part, avec une fausse fenêtre et un faux `fetch`. Il ne répond qu'à la page qui le
// contient, ne reçoit son port qu'une fois, envoie avec l'en-tête X-Requested-With (sans lui Grist répond 401 sans en-têtes CORS : faits vérifiés 14) et dit pourquoi une requête échoue.
// Ce que le vrai navigateur et le vrai serveur en font se mesure dans le labo (labo/run-pdf.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { ROOT } from './helpers.mjs';

const SCRIPT = readFileSync(join(ROOT, 'transfer/transfer.js'), 'utf8');

function load(fetchImpl) {
  const listeners = [];
  const parent = { name: 'GFS' };
  const window = { parent, addEventListener: (type, listener) => listeners.push(listener), removeEventListener: (type, listener) => listeners.splice(listeners.indexOf(listener), 1) };
  vm.runInNewContext(SCRIPT, { window, fetch: fetchImpl, FormData, TypeError, JSON, Number, Array, Object, Promise, String });
  // Les objets que le script crée viennent d'un autre contexte (leur prototype n'est pas le nôtre) : une copie superficielle suffit à les comparer.
  const port = { sent: [], postMessage(message) { this.sent.push({ ...message }); } };
  const connect = (source = parent, ports = [port]) => { for (const listener of [...listeners]) listener({ source, data: { gfs: 'transfer' }, ports }); };
  const ask = async request => { port.onmessage({ data: request }); for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve)); return port.sent.at(-1); };
  return { listeners, connect, port, ask, parent };
}

const reply = (status, body, { json = true } = {}) => ({
  ok: status >= 200 && status < 300, status, statusText: `statut ${status}`,
  text: async () => (json ? JSON.stringify(body) : String(body)), blob: async () => new Blob([String(body)]),
});

test('le port n\'est reçu que de la page qui contient le cadre, une seule fois ; il dit « ready » par lui', () => {
  const frame = load(async () => reply(200, [1]));
  frame.connect({ name: 'une autre fenêtre' });
  assert.deepEqual(frame.port.sent, [], 'une autre source est ignorée');
  frame.connect(frame.parent, []);
  assert.deepEqual(frame.port.sent, [], 'un message sans port est ignoré');
  assert.equal(frame.listeners.length, 1);
  frame.connect();
  assert.deepEqual(frame.port.sent, [{ ready: true }]);
  assert.equal(frame.listeners.length, 0, 'plus rien n\'est écouté sur la fenêtre');
});

test('envoyer : un POST multipart (champ `upload`, nom donné) avec X-Requested-With ; le numéro de la pièce jointe revient', async () => {
  const seen = [];
  const frame = load(async (url, options) => { seen.push([url, options]); return reply(200, [17]); });
  frame.connect();
  const file = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
  const answer = await frame.ask({ id: 3, op: 'upload', url: 'https://grist.exemple.fr/api/docs/D/attachments?auth=t', file, name: 'Facture été (1).pdf' });
  assert.deepEqual(answer, { id: 3, ok: true, value: 17 });
  const [url, options] = seen[0];
  assert.equal(url, 'https://grist.exemple.fr/api/docs/D/attachments?auth=t');
  assert.equal(options.method, 'POST');
  assert.deepEqual({ ...options.headers }, { 'X-Requested-With': 'XMLHttpRequest' });
  const sent = options.body.get('upload');
  assert.equal(sent.name, 'Facture été (1).pdf');
  assert.equal(await sent.text(), '%PDF-1.4');
});

test('un refus du serveur : son code et le texte de son champ « error »', async () => {
  const frame = load(async () => reply(413, { error: 'File too large' }));
  frame.connect();
  assert.deepEqual(await frame.ask({ id: 1, op: 'upload', url: 'https://g/x', file: new Blob([]), name: 'a.pdf' }), { id: 1, ok: false, network: false, status: 413, message: 'File too large' });
});

test('un refus sans JSON : le début du texte, sur une ligne, au plus 200 signes', async () => {
  const frame = load(async () => reply(502, `Bad\n   Gateway ${'x'.repeat(500)}`, { json: false }));
  frame.connect();
  const answer = await frame.ask({ id: 1, op: 'download', url: 'https://g/x' });
  assert.equal(answer.status, 502);
  assert.equal(answer.message.length, 200);
  assert.ok(answer.message.startsWith('Bad Gateway xxx'));
});

test('le serveur ne répond pas (le navigateur refuse la requête) : « network » ; une réponse qui n\'est pas un numéro : pas « network »', async () => {
  let mode = 'down';
  const frame = load(async () => { if (mode === 'down') throw new TypeError('NetworkError when attempting to fetch resource.'); return reply(200, 'pas du JSON', { json: false }); });
  frame.connect();
  assert.deepEqual(await frame.ask({ id: 1, op: 'upload', url: 'https://g/x', file: new Blob([]), name: 'a.pdf' }), { id: 1, ok: false, network: true, status: 0, message: 'NetworkError when attempting to fetch resource.' });
  mode = 'up';
  const odd = await frame.ask({ id: 2, op: 'upload', url: 'https://g/x', file: new Blob([]), name: 'a.pdf' });
  assert.deepEqual([odd.ok, odd.network, odd.status], [false, false, 0]);
  mode = 'two';
  const frame2 = load(async () => reply(200, [1, 2]));
  frame2.connect();
  assert.equal((await frame2.ask({ id: 3, op: 'upload', url: 'https://g/x', file: new Blob([]), name: 'a.pdf' })).ok, false, 'deux numéros pour un fichier : refusé');
});

test('télécharger : un GET sans en-tête de plus (pas de demande préalable), le contenu revient en Blob', async () => {
  const seen = [];
  const frame = load(async (url, options) => { seen.push([url, options]); return reply(200, '%PDF-1.4', { json: false }); });
  frame.connect();
  const answer = await frame.ask({ id: 9, op: 'download', url: 'https://g/api/docs/D/attachments/4/download?auth=t' });
  assert.equal(answer.ok, true);
  assert.equal(await answer.value.text(), '%PDF-1.4');
  assert.equal(seen[0][1], undefined, 'aucune option : ni méthode ni en-tête');
});

test('une pièce jointe qui n\'existe plus : le code 404 est rendu', async () => {
  const frame = load(async () => reply(404, { error: 'Not found' }));
  frame.connect();
  const answer = await frame.ask({ id: 2, op: 'download', url: 'https://g/x' });
  assert.deepEqual([answer.ok, answer.status, answer.message], [false, 404, 'Not found']);
});

test('une opération inconnue est refusée, sans requête', async () => {
  let calls = 0;
  const frame = load(async () => { calls += 1; return reply(200, []); });
  frame.connect();
  const answer = await frame.ask({ id: 5, op: 'toString', url: 'https://g/x' });
  assert.deepEqual([answer.id, answer.ok], [5, false]);
  assert.equal(calls, 0);
});

test('status : un GET dont seul le code revient ; le corps n\'est pas lu pour un 200, et un refus rend son texte', async () => {
  let bodyRead = false;
  const ok = load(async () => ({ ok: true, status: 200, statusText: 'OK', text: async () => { bodyRead = true; return '{"webhooks":[]}'; }, blob: async () => new Blob([]) }));
  ok.connect();
  assert.deepEqual(await ok.ask({ id: 8, op: 'status', url: 'https://grist.exemple.fr/api/docs/D/webhooks?auth=t' }), { id: 8, ok: true, value: 200 });
  assert.equal(bodyRead, false, 'les webhooks du document ne sont jamais lus');
  const refused = load(async () => reply(403, { error: 'No owner access' }));
  refused.connect();
  assert.deepEqual(await refused.ask({ id: 9, op: 'status', url: 'https://grist.exemple.fr/api/docs/D/webhooks?auth=t' }), { id: 9, ok: false, network: false, status: 403, message: 'No owner access' });
});

test('json : un GET dont le JSON revient tel quel (une lecture SQL) ; une réponse qui n\'en est pas est un échec, un refus rend son texte', async () => {
  const sql = { statement: 'SELECT 1 AS octets', records: [{ fields: { octets: 7 } }] };
  const ok = load(async () => reply(200, sql));
  ok.connect();
  const answer = await ok.ask({ id: 3, op: 'json', url: 'https://grist.exemple.fr/api/docs/D/sql?auth=t&q=SELECT%201' });
  assert.deepEqual([answer.id, answer.ok, JSON.stringify(answer.value)], [3, true, JSON.stringify(sql)]);
  const html = load(async () => reply(200, '<html>', { json: false }));
  html.connect();
  const bad = await html.ask({ id: 4, op: 'json', url: 'https://grist.exemple.fr/api/docs/D/sql?auth=t' });
  assert.deepEqual([bad.ok, bad.network, bad.status], [false, false, 0], 'du texte qui n\'est pas du JSON : un échec « answer », pas un faux succès');
  const cut = load(async () => reply(400, { error: 'a slow statement resulted in a database interrupt' }));
  cut.connect();
  assert.deepEqual(await cut.ask({ id: 5, op: 'json', url: 'https://grist.exemple.fr/api/docs/D/sql?auth=t' }), { id: 5, ok: false, network: false, status: 400, message: 'a slow statement resulted in a database interrupt' });
});

test('rest : GET, POST, PATCH et DELETE sans cookie ; X-Requested-With sur tout sauf une lecture ; Content-Type JSON seulement avec un corps ; { status, body } (JSON, sinon texte) revient', async () => {
  const plain = value => JSON.parse(JSON.stringify(value));
  const seen = [];
  const bodies = { '/json': '{"webhooks":[1]}', '/vide': '', '/texte': 'ok' };
  const frame = load(async (url, options) => { seen.push([url, options]); const path = new URL(url).pathname; return { ...reply(200, ''), text: async () => bodies[path] ?? '' }; });
  frame.connect();
  assert.deepEqual(plain(await frame.ask({ id: 1, op: 'rest', method: 'GET', url: 'https://g.exemple.fr/json?auth=t' })), { id: 1, ok: true, value: { status: 200, body: { webhooks: [1] } } });
  assert.deepEqual(plain(seen[0][1].headers), {}, 'une lecture : aucun en-tête de plus');
  assert.equal(seen[0][1].credentials, 'omit');
  const posted = await frame.ask({ id: 2, op: 'rest', method: 'post', url: 'https://g.exemple.fr/vide', json: [{ A: 1 }] });
  assert.deepEqual(plain(posted.value), { status: 200, body: '' });
  assert.equal(seen[1][1].method, 'POST');
  assert.equal(seen[1][1].body, '[{"A":1}]');
  assert.deepEqual(plain(seen[1][1].headers), { 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/json' });
  await frame.ask({ id: 3, op: 'rest', method: 'DELETE', url: 'https://g.exemple.fr/texte' });
  assert.deepEqual(plain(seen[2][1].headers), { 'X-Requested-With': 'XMLHttpRequest' }, 'sans corps : pas de Content-Type');
  assert.equal(seen[2][1].body, undefined);
  assert.equal((await frame.ask({ id: 4, op: 'rest', method: 'PATCH', url: 'https://g.exemple.fr/texte', json: { enabled: false } })).value.body, 'ok');
});

test('rest : une autre méthode est refusée sans rien envoyer ; un refus du serveur garde son code et son texte ; un serveur muet est « network »', async () => {
  const seen = [];
  const frame = load(async url => { seen.push(url); if (url.includes('muet')) throw new TypeError('Failed to fetch'); return reply(403, { error: 'No owner access' }); });
  frame.connect();
  const refused = await frame.ask({ id: 1, op: 'rest', method: 'PUT', url: 'https://g.exemple.fr/x' });
  assert.deepEqual([refused.ok, refused.status], [false, 0]);
  assert.deepEqual(seen, [], 'PUT n\'est pas une méthode du cadre');
  const denied = await frame.ask({ id: 2, op: 'rest', method: 'GET', url: 'https://g.exemple.fr/webhooks' });
  assert.deepEqual([denied.ok, denied.status, denied.message], [false, 403, 'No owner access']);
  const down = await frame.ask({ id: 3, op: 'rest', method: 'GET', url: 'https://muet.exemple.fr/x' });
  assert.deepEqual([down.ok, down.network], [false, true]);
});
