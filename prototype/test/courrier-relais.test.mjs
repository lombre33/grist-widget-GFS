// Le relais de courrier (outils/relais-courrier/) : la livraison ligne par ligne (règles, envoi, accusé, mémoire), le message, le secret et le petit serveur. Le serveur
// de messagerie, Grist et le formulaire public sont ici des fausses réponses ; ce que le VRAI Grist livre, et un VRAI échange SMTP chiffré, sont mesurés par
// labo/run-courrier-relais.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createDelivery } from '../outils/relais-courrier/livraison.mjs';
import { buildMessage, encodeHeader } from '../outils/relais-courrier/mime.mjs';
import { parseSmtpUrl } from '../outils/relais-courrier/smtp.mjs';
import { createRelay, authorized, formAck, fileMemory, relayFromEnv } from '../outils/relais-courrier/relais.mjs';

const KEY = 'a1b2c3d4e5f60718';
const row = (id, extra = {}) => ({ id, Cle: KEY, Relance: 0, Destinataires: 'a@exemple.fr', Objet: 'Bonjour', Corps: 'Texte', ...extra });

function harness({ failures = [], perHour = 200, now } = {}) {
  const sent = [];
  const acks = [];
  const seen = new Set();
  const queue = [...failures];
  const delivery = createDelivery({
    send: async (mail, id) => { const failure = queue.shift(); if (failure) throw failure; sent.push({ to: mail.to, id }); },
    ack: async (r, state, detail) => { acks.push([r.id, state, detail]); },
    memory: { has: key => seen.has(key), add: key => seen.add(key) },
    perHour,
    now,
  });
  return { delivery, sent, acks, seen };
}
const permanent = message => Object.assign(new Error(message), { permanent: true });

test('une ligne valide part une fois et son accusé « envoyé » est rendu', async () => {
  const h = harness();
  const done = await h.delivery.handle([row(1)]);
  assert.equal(done.status, 200);
  assert.deepEqual(h.sent, [{ to: ['a@exemple.fr'], id: `${KEY}.1.0` }]);
  assert.deepEqual(h.acks, [[1, 'envoye', `Message-ID <${KEY}.1.0>`]]);
});

test('une adresse refusée par le serveur sur plusieurs est dite dans l\'accusé, le message part pour les autres', async () => {
  const acks = [];
  const delivery = createDelivery({
    send: async () => ({ refused: ['x@exemple.fr'] }),
    ack: async (r, state, detail) => { acks.push([state, detail]); },
    memory: (() => { const set = new Set(); return { has: key => set.has(key), add: key => set.add(key) }; })(),
  });
  await delivery.handle([row(1)]);
  assert.deepEqual(acks, [['envoye', `Message-ID <${KEY}.1.0> ; 1 adresse(s) refusée(s) par le serveur`]]);
});

test('la même livraison reçue deux fois (Grist retente) n\'envoie qu\'une fois', async () => {
  const h = harness();
  await h.delivery.handle([row(1)]);
  const again = await h.delivery.handle([row(1)]);
  assert.equal(h.sent.length, 1);
  assert.deepEqual(again.results, [{ id: 1, state: 'deja' }]);
  assert.equal(h.acks.length, 1);
});

test('une relance voulue (le numéro monte) repart ; une autre ligne de la même livraison part aussi', async () => {
  const h = harness();
  await h.delivery.handle([row(1)]);
  await h.delivery.handle([row(1, { Relance: 1 }), row(2)]);
  assert.deepEqual(h.sent.map(item => item.id), [`${KEY}.1.0`, `${KEY}.1.1`, `${KEY}.2.0`]);
});

test('une règle refusée (retour à la ligne dans l\'objet) n\'envoie rien, accuse l\'erreur et ne bloque pas la ligne suivante', async () => {
  const h = harness();
  const done = await h.delivery.handle([row(1, { Objet: 'x\r\nBcc: espion@exemple.fr' }), row(2)]);
  assert.equal(done.status, 200);
  assert.deepEqual(h.sent.map(item => item.id), [`${KEY}.2.0`]);
  assert.deepEqual(h.acks.map(ack => ack.slice(0, 3)), [[1, 'erreur', 'headerBreak'], [2, 'envoye', `Message-ID <${KEY}.2.0>`]]);
});

test('un refus définitif du serveur de messagerie est accusé « erreur » ; il n\'est pas retenté', async () => {
  const h = harness({ failures: [permanent('SMTP 550 5.1.1 inconnu')] });
  const done = await h.delivery.handle([row(1)]);
  assert.equal(done.status, 200);
  assert.deepEqual(h.acks, [[1, 'erreur', 'SMTP 550 5.1.1 inconnu']]);
  assert.equal((await h.delivery.handle([row(1)])).results[0].state, 'deja');
});

test('un échec passager répond 502, ne retient rien, et la livraison suivante envoie (sans renvoyer ce qui est parti)', async () => {
  const h = harness({ failures: [undefined, new Error('Connexion impossible : ECONNREFUSED')] });
  const first = await h.delivery.handle([row(1), row(2)]);
  assert.equal(first.status, 502);
  assert.deepEqual(first.results.map(result => result.state), ['envoye', 'a-reessayer']);
  assert.equal(h.acks.length, 1, 'aucun accusé pour la ligne à réessayer');
  const second = await h.delivery.handle([row(1), row(2)]);
  assert.equal(second.status, 200);
  assert.deepEqual(second.results.map(result => result.state), ['deja', 'envoye']);
  assert.deepEqual(h.sent.map(item => item.id), [`${KEY}.1.0`, `${KEY}.2.0`]);
});

test('une ligne sans numéro ou sans clé valable est ignorée ; un corps qui n\'est pas une liste est refusé', async () => {
  const h = harness();
  const done = await h.delivery.handle([row(1, { Cle: '' }), row(1, { Cle: 'ZZ' }), { Destinataires: 'a@exemple.fr' }, null, row('7')]);
  assert.deepEqual(done.results.map(result => result.state), ['ignoree', 'ignoree', 'ignoree', 'ignoree', 'ignoree']);
  assert.equal(h.sent.length, 0);
  assert.equal((await h.delivery.handle({ id: 1 })).status, 400);
});

test('le plafond horaire : au-delà, 502 (Grist retentera) ; une heure plus tard, ça repart', async () => {
  let time = 0;
  const h = harness({ perHour: 2, now: () => time });
  const done = await h.delivery.handle([row(1), row(2), row(3)]);
  assert.deepEqual(done.results.map(result => result.state), ['envoye', 'envoye', 'a-reessayer']);
  assert.equal(done.status, 502);
  time = 3600 * 1000 + 1;
  assert.equal((await h.delivery.handle([row(3)])).results[0].state, 'envoye');
});

test('un accusé qui échoue ne fait pas renvoyer le message', async () => {
  const sent = [];
  const delivery = createDelivery({
    send: async (mail, id) => { sent.push(id); },
    ack: async () => { throw new Error('HTTP 500'); },
    memory: (() => { const set = new Set(); return { has: key => set.has(key), add: key => set.add(key) }; })(),
  });
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.equal((await delivery.handle([row(1)])).status, 200);
    assert.equal((await delivery.handle([row(1)])).results[0].state, 'deja');
  } finally { console.warn = warn; }
  assert.equal(sent.length, 1);
});

const parsed = text => {
  const [head, ...rest] = text.split('\r\n\r\n');
  return { head, body: rest.join('\r\n\r\n') };
};
const mail = extra => ({ to: ['a@exemple.fr'], cc: [], bcc: ['secret@exemple.fr'], subject: 'Bonjour', text: 'Texte', html: '', replyTo: '', ...extra });

test('le message : en-têtes, identifiant stable, corps en base64, copie cachée absente des en-têtes', () => {
  const { head, body } = parsed(buildMessage({ message: mail({ cc: ['c@exemple.fr'], replyTo: 'r@exemple.fr' }), from: 'courrier@admin.exemple.fr', id: 'abc.1.0', date: new Date(Date.UTC(2026, 10, 13, 15, 30)) }));
  assert.match(head, /^From: courrier@admin\.exemple\.fr\r\nTo: a@exemple\.fr\r\nCc: c@exemple\.fr\r\nReply-To: r@exemple\.fr\r\nSubject: Bonjour\r\n/);
  assert.match(head, /Date: Fri, 13 Nov 2026 15:30:00 \+0000/);
  assert.match(head, /Message-ID: <abc\.1\.0@admin\.exemple\.fr>/);
  assert.match(head, /Content-Type: text\/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64$/);
  assert.ok(!/secret@exemple\.fr/.test(head), 'Bcc n\'est jamais écrit dans les en-têtes');
  assert.equal(Buffer.from(body, 'base64').toString('utf8'), 'Texte');
});

test('un objet accentué et long devient des mots codés de 75 caractères au plus, qui se relisent à l\'identique', () => {
  const subject = 'Convocation à la réunion du comité d’éthique « ressources humaines » — ordre du jour et pièces à relire avant jeudi';
  const encoded = encodeHeader(subject);
  const words = encoded.split('\r\n ');
  assert.ok(words.length > 1 && words.every(word => word.length <= 75 && /^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/.test(word)), words.map(word => word.length).join());
  assert.equal(words.map(word => Buffer.from(word.slice(10, -2), 'base64').toString('utf8')).join(''), subject);
  assert.equal(encodeHeader('Simple'), 'Simple');
});

test('un message avec HTML : deux parties, texte puis HTML, chacune en base64 ; un HTML sans texte donne un texte de repli', () => {
  const text = buildMessage({ message: mail({ html: '<p>Bonjour <b>vous</b></p>', text: '' }), from: 'c@admin.exemple.fr', id: 'x.1.0' });
  const boundary = /boundary="([^"]+)"/.exec(text)[1];
  const parts = text.split(`--${boundary}`).slice(1, -1);
  assert.equal(parts.length, 2);
  const decode = part => Buffer.from(part.split('\r\n\r\n')[1].replace(/\s+/g, ''), 'base64').toString('utf8');
  assert.deepEqual([decode(parts[0]), decode(parts[1])], ['Bonjour vous', '<p>Bonjour <b>vous</b></p>']);
  assert.match(parts[0], /text\/plain; charset=utf-8/);
  assert.match(parts[1], /text\/html; charset=utf-8/);
});

test('l\'adresse SMTP : STARTTLS par défaut, TLS d\'emblée en smtps, et « sans chiffrement » seulement vers cette machine', () => {
  assert.deepEqual(parseSmtpUrl('smtp://moi%40admin:p%3Ass@smtp.admin.exemple.fr'), { host: 'smtp.admin.exemple.fr', port: 587, secure: false, plain: false, user: 'moi@admin', pass: 'p:ss' });
  assert.equal(parseSmtpUrl('smtps://smtp.admin.exemple.fr').port, 465);
  assert.equal(parseSmtpUrl('smtp://127.0.0.1:2525?tls=none').plain, true);
  assert.throws(() => parseSmtpUrl('smtp://smtp.admin.exemple.fr?tls=none'), /cette machine/);
  assert.throws(() => parseSmtpUrl('http://smtp.admin.exemple.fr'), /smtp:\/\//);
});

const request = (headers, url = '/') => ({ headers, url });
const SECRET = 'cd'.repeat(24);

test('le secret : en-tête Bearer ou ?cle=, comparé sans fuite de durée ; un autre secret, un secret absent, un secret plus court sont refusés', () => {
  assert.equal(authorized(request({ authorization: `Bearer ${SECRET}` }), SECRET), true);
  assert.equal(authorized(request({}, `/hook?cle=${SECRET}`), SECRET), true);
  assert.equal(authorized(request({ authorization: `Bearer ${'ef'.repeat(24)}` }), SECRET), false);
  assert.equal(authorized(request({ authorization: 'Bearer court' }), SECRET), false);
  assert.equal(authorized(request({}), SECRET), false);
});

async function startRelay(handle) {
  const server = createRelay({ secret: SECRET, delivery: { handle } });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/hook`;
  return { base, close: () => new Promise(resolve => server.close(resolve)) };
}

test('le serveur : 405 hors POST, 401 sans secret (rien n\'est lu), 400 sans JSON, sinon le statut de la livraison', async () => {
  const bodies = [];
  const relay = await startRelay(async rows => { bodies.push(rows); return { status: rows.length ? 200 : 502, results: [{ ok: true }] }; });
  const post = (body, headers = { Authorization: `Bearer ${SECRET}` }) => fetch(relay.base, { method: 'POST', headers, body });
  try {
    assert.equal((await fetch(relay.base)).status, 405);
    assert.equal((await post('[]', {})).status, 401);
    assert.equal((await post('[]', { Authorization: 'Bearer faux' })).status, 401);
    assert.equal(bodies.length, 0, 'une livraison non autorisée n\'arrive jamais à la livraison');
    assert.equal((await post('pas du json')).status, 400);
    assert.equal((await post('[{"id":1}]')).status, 200);
    assert.equal((await post('[]')).status, 502);
    assert.equal((await fetch(`${relay.base}?cle=${SECRET}`, { method: 'POST', body: '[{"id":2}]' })).status, 200);
  } finally { await relay.close(); }
});

test('le serveur : un corps de plus d\'un mégaoctet est refusé (413) sans arriver à la livraison', async () => {
  const bodies = [];
  const relay = await startRelay(async rows => { bodies.push(rows); return { status: 200, results: [] }; });
  try {
    const response = await fetch(relay.base, { method: 'POST', headers: { Authorization: `Bearer ${SECRET}` }, body: JSON.stringify([{ Corps: 'x'.repeat(1100000) }]) }).catch(error => ({ status: error.cause && error.cause.code }));
    assert.ok([413, 'ECONNRESET', 'UND_ERR_SOCKET', 'EPIPE'].includes(response.status), String(response.status));
    assert.equal(bodies.length, 0);
  } finally { await relay.close(); }
});

test('l\'accusé : une ligne pour GFS_Courrier_Retours avec la clé et la relance ; trois essais, puis l\'erreur', async () => {
  const calls = [];
  const ok = formAck('https://grist.exemple.fr/api/s/CLE/tables/GFS_Courrier_Retours/records?flat=1', async (url, options) => { calls.push([url, JSON.parse(options.body)]); return { ok: true }; });
  await ok({ id: 4, Cle: KEY, Relance: 2 }, 'envoye', 'Message-ID <x>');
  assert.deepEqual(calls[0][1], [{ Courrier: 4, Cle: KEY, Relance: 2, Etat: 'envoye', Detail: 'Message-ID <x>' }]);
  let attempts = 0;
  const failing = formAck('https://grist.exemple.fr/x', async () => { attempts++; return { ok: false, status: 500 }; });
  await assert.rejects(failing({ id: 1, Cle: KEY }, 'erreur', ''), /HTTP 500/);
  assert.equal(attempts, 3);
});

test('les réglages : chacun est exigé, le secret doit être long ; la mémoire d\'un envoi survit à un redémarrage', async () => {
  assert.throws(() => relayFromEnv({}), /RELAIS_SECRET/);
  assert.throws(() => relayFromEnv({ RELAIS_SECRET: 'court', SMTP_URL: 'smtps://h', DE: 'a@b.fr', ACCUSE_URL: 'https://x' }), /32 caractères/);
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'relais-'));
  try {
    let time = 1000;
    const first = fileMemory(join(dir, 'm.json'), () => time);
    first.add('k1');
    assert.equal(fileMemory(join(dir, 'm.json'), () => time).has('k1'), true);
    time += 8 * 24 * 3600 * 1000;
    assert.equal(fileMemory(join(dir, 'm.json'), () => time).has('k1'), false, 'oublié après sept jours');
    assert.equal(fileMemory(join(dir, 'absent.json')).has('k1'), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
