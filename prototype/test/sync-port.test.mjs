// Le port de GFS pour le moteur de partage (js/sync-port.js) : ce que GFS dit au cadre d'envoi et à l'API des widgets pour chaque fonction du port, les erreurs que le moteur lit, les textes, la page et
// les préférences. Le cadre et Grist sont ici de faux interlocuteurs qui notent ce qu'on leur demande : ce que le VRAI Grist répond est mesuré par labo/run-sync-port.mjs, jamais par ces essais.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSyncPort, startSyncEngine, SYNC_PREFIX } from '../js/sync-port.js';
import { TransferError } from '../js/transfer.js';
import { PORT_SHAPE } from '../kit/js/synchro/port.js';
import { SYNC_TABLE } from '../kit/js/synchro/logic/common.js';
import { errorText } from '../kit/js/synchro/errors.js';

const BASE = 'https://grist.exemple.fr/o/docs/api/docs/DOC123';

// Un cadre d'envoi qui note ses requêtes ; `answers` : { 'METHOD /chemin': réponse | TransferError | fonction }.
function fakeTransfer(answers = {}) {
  const asked = [];
  const reply = (key, fallback) => {
    const answer = key in answers ? answers[key] : fallback;
    const value = typeof answer === 'function' ? answer() : answer;
    if (value instanceof Error) throw value;
    return value;
  };
  return {
    asked,
    baseUrl: async () => BASE,
    isOwner: async () => reply('isOwner', true),
    sql: async (statement, options) => { asked.push({ op: 'sql', statement, options }); return reply('sql', []); },
    rest: async (method, path, options = {}) => { asked.push({ op: 'rest', method, path, ...options }); return reply(`${method} ${path}`, { status: 200, body: '' }); },
    anonymous: async (method, url, options = {}) => { asked.push({ op: 'anonymous', method, url, ...options }); return reply(`${method} anonymous`, { status: 200, body: '' }); },
    download: async id => { asked.push({ op: 'download', id }); return reply('download', new Blob([new Uint8Array([1, 2, 3])])); },
    upload: async (file, name) => { asked.push({ op: 'upload', size: file.size, name }); return reply('upload', 41); },
  };
}

const fakeDocApi = () => {
  const calls = [];
  return {
    calls,
    fetchTable: async tableId => { calls.push(['fetchTable', tableId]); return tableId === '_grist_Triggers' ? { id: [1], condition: ['{"text":"$A"}'], actions: ['[{"type":"webhook","id":"hook-1"}]'] } : { id: [1, 2], Nom: ['a', 'b'] }; },
    applyUserActions: async actions => { calls.push(['apply', actions]); return { retValues: [7] }; },
  };
};

const port = (answers, extra = {}) => {
  const transfer = fakeTransfer(answers);
  const docApi = fakeDocApi();
  return { transfer, docApi, port: createSyncPort({ docApi, transfer, ...extra }) };
};

const http = (status, message = '') => new TransferError('http', message, status);

test('le moteur démarre sur ce port (forme complète) avec le préfixe GFS_', () => {
  const run = port();
  assert.equal(Object.keys(run.port).filter(name => [...PORT_SHAPE.data, ...PORT_SHAPE.files, ...PORT_SHAPE.hooks, ...PORT_SHAPE.publicDoc].includes(name)).length, 8 + 2 + 9 + 1);
  startSyncEngine({ docApi: run.docApi, transfer: run.transfer });
  assert.equal(SYNC_PREFIX, 'GFS_');
  assert.equal(SYNC_TABLE, 'GFS_Synchro', 'les tables du moteur sont à part de celles de la personne');
});

test('lignes : fetchRows rend des lignes décodées ; apply n\'envoie rien à Grist pour une liste vide', async () => {
  const run = port();
  assert.deepEqual(await run.port.fetchRows('Clients'), [{ id: 1, Nom: 'a' }, { id: 2, Nom: 'b' }]);
  assert.deepEqual(await run.port.apply([]), { retValues: [] });
  assert.deepEqual((await run.port.apply([['AddRecord', 'T', null, {}]])).retValues, [7]);
  assert.deepEqual(run.docApi.calls.map(call => call[0]), ['fetchTable', 'apply']);
});

test('docIdentity : instance, équipe, identifiant du document et adresse REST, d\'après l\'adresse que Grist donne', async () => {
  assert.deepEqual(await port().port.docIdentity(), { origin: 'https://grist.exemple.fr', team: 'docs', docId: 'DOC123', baseUrl: BASE });
});

test('isOwner : vrai ou faux gardé ; « Grist n\'a pas répondu » levé, dit dans la langue de la personne, et rien n\'est gardé', async () => {
  const run = port();
  assert.equal(await run.port.isOwner(), true);
  assert.equal(await run.port.isOwner(), true);
  let answers = [null, false];
  const unknown = port({ isOwner: () => answers.shift() }, { language: () => 'en' });
  await assert.rejects(() => unknown.port.isOwner(), /did not say whether you own/);
  assert.equal(await unknown.port.isOwner(), false, 'la réponse sûre suivante est prise');
});

test('lectures SQL : le jeton peut écrire (/sql le demande dans un document à règles) ; un refus rend null ; selectRows échappe', async () => {
  const run = port({ sql: () => [{ id: 1 }] });
  assert.deepEqual(await run.port.querySql('select 1'), [{ id: 1 }]);
  await run.port.selectRows('Mes "Tables"', ['A', 'B'], { Cle: "l'été", Autre: 3 });
  assert.deepEqual(run.transfer.asked.map(each => each.options), [{ writable: true }, { writable: true }]);
  assert.equal(run.transfer.asked[1].statement, `select "id", "A", "B" from "Mes "Tables"" where "Cle" = 'l''été' and "Autre" = '3'`);
  const refused = port({ sql: http(403, 'no') });
  assert.equal(await refused.port.querySql('select 1'), null);
  assert.equal(await refused.port.selectRows('T', ['A']), null);
});

test('docChanges : refus de la comparaison → null ; 404 → null ; état inconnu → relue depuis HEAD ; tables touchées', async () => {
  const delta = { status: 200, body: { right: { h: 'H2' }, details: { rightChanges: { tableDeltas: { Clients: {}, Autre: {} }, tableRenames: [] } } } };
  const ok = port({ 'GET /compare': delta });
  const changes = await ok.port.docChanges('H1');
  assert.equal(changes.hash, 'H2');
  assert.deepEqual([...changes.tables].sort(), ['Autre', 'Clients']);
  assert.deepEqual(ok.transfer.asked[0].params, { left: 'H1', right: 'HEAD', maxRows: 1 });
  assert.equal(ok.transfer.asked[0].writable, undefined, 'le jeton par défaut peut écrire : /compare est réservé à qui lit tout');
  assert.equal((await ok.port.docChanges('')).tables, null, 'sans état de départ : pas de liste de tables');
  assert.equal(await port({ 'GET /compare': http(403) }).port.docChanges('H1'), null);
  assert.equal(await port({ 'GET /compare': http(404) }).port.docChanges(''), null);
  let calls = 0;
  const retried = port({ 'GET /compare': () => { calls++; if (calls === 1) throw http(400, 'état inconnu'); return delta; } });
  const lost = await retried.port.docChanges('H0');
  assert.equal(lost.hash, 'H2');
  assert.equal(lost.tables, null, 'un état perdu : pas de liste de tables, jamais « rien n\'a changé »');
  assert.deepEqual(retried.transfer.asked.map(each => each.params.left), ['H0', 'HEAD']);
  assert.deepEqual(await port({ 'GET /compare': new TransferError('network', 'x') }).port.docChanges('H1'), { hash: 'H1', tables: null });
});

test('pièces jointes : octets rendus, fichier déposé sous son nom ; un échec est dit avec son code', async () => {
  const run = port();
  assert.deepEqual([...await run.port.downloadAttachment('5')], [1, 2, 3]);
  assert.equal(await run.port.uploadAttachment('a.pdf', new Uint8Array(10)), 41);
  assert.deepEqual(run.transfer.asked, [{ op: 'download', id: 5 }, { op: 'upload', size: 10, name: 'a.pdf' }]);
  await assert.rejects(() => port({ download: http(404, 'Not found') }).port.downloadAttachment(9), /^Error: HTTP 404 Not found$/);
});

test('webhooks : liste (le refus 403 est celui des propriétaires seuls), activation, file vidée avant l\'effacement', async () => {
  const run = port({ 'GET /webhooks': { status: 200, body: { webhooks: [{ id: 'a' }] } } });
  assert.deepEqual(await run.port.listWebhooks(), [{ id: 'a' }]);
  await assert.rejects(() => port({ 'GET /webhooks': http(403, 'No owner access') }).port.listWebhooks(), /^Error: ownerOnly$/);
  await run.port.setWebhookEnabled('a/b', false);
  await run.port.deleteWebhook('a/b');
  assert.deepEqual(run.transfer.asked.slice(1).map(each => [each.method, each.path, each.body]), [
    ['PATCH', '/webhooks/a%2Fb', { enabled: false }],
    ['DELETE', '/webhooks/queue/a%2Fb', undefined],
    ['DELETE', '/webhooks/a%2Fb', undefined],
  ]);
  const noRoute = port({ 'DELETE /webhooks/queue/x': http(404, 'no route') });
  await noRoute.port.deleteWebhook('x');
  assert.equal(noRoute.transfer.asked.at(-1).path, '/webhooks/x', 'une instance sans la route de file efface quand même');
});

test('createWebhook : la condition enregistrée est relue ; absente (Grist trop ancien), le webhook est effacé et l\'erreur est « gristTooOld »', async () => {
  const body = { status: 200, body: { webhooks: [{ id: 'hook-1' }] } };
  const good = port({ 'POST /webhooks': body });
  assert.equal(await good.port.createWebhook({ name: 'n', memo: 'm', url: 'https://grist.exemple.fr/api/s/CLE/x', tableId: 'GFS_Synchro', condition: '$A' }), 'hook-1');
  assert.deepEqual(good.transfer.asked[0].body.webhooks[0].fields, { name: 'n', memo: 'm', url: 'https://grist.exemple.fr/api/s/CLE/x', tableId: 'GFS_Synchro', condition: '$A', eventTypes: ['add', 'update'], enabled: true, isReadyColumn: null });
  const ignored = port({ 'POST /webhooks': body });
  await assert.rejects(() => ignored.port.createWebhook({ name: 'n', memo: 'm', url: 'u', tableId: 'T', condition: '$B' }), /^Error: gristTooOld$/);
  assert.equal(ignored.transfer.asked.at(-1).path, '/webhooks/hook-1', 'le webhook sans sa condition est effacé');
  const refused = port({ 'POST /webhooks': http(400, 'unknown field condition') });
  await assert.rejects(() => refused.port.createWebhook({ name: 'n', memo: 'm', url: 'u', tableId: 'T', condition: '$B' }), /^Error: gristTooOld$/);
});

test('envoi direct de lignes : jamais vers un autre serveur ; la clé d\'un formulaire n\'est jamais dite en entier ; l\'avis de fin ne retient pas l\'effacement', async () => {
  const url = 'https://grist.exemple.fr/api/s/ABCD1234EFGH/tables/T/data';
  const run = port();
  await run.port.postRows(url, [{ a: 1 }], 5000);
  assert.deepEqual(run.transfer.asked.at(-1), { op: 'anonymous', method: 'POST', url, body: [{ a: 1 }], timeout: 5000 });
  await assert.rejects(() => run.port.postRows('https://autre.example.org/api/s/CLE/x', []), /^Error: otherInstance$/);
  assert.equal(run.transfer.asked.filter(each => each.op === 'anonymous').length, 1, 'rien n\'est parti vers l\'autre serveur');
  await assert.rejects(() => port({ 'POST anonymous': http(403, `refus de ${url}`) }).port.postRows(url, []), error => !error.message.includes('EFGH') && error.message.includes('/api/s/ABCD…'));
  const dead = port({ 'POST anonymous': new TransferError('network', 'x') });
  await dead.port.deleteWebhookWithNotice({ id: 'h', fields: { url } }, []);
  assert.deepEqual(dead.transfer.asked.filter(each => each.op === 'rest').map(each => each.path), ['/webhooks/queue/h', '/webhooks/h']);
  assert.equal(dead.transfer.asked[0].timeout, 10000);
});

test('document public : les lignes filtrées ; tout refus, y compris une autre instance, est « publicClosed »', async () => {
  const records = [{ fields: { Nom: 'a' } }];
  const run = port({ 'GET anonymous': { status: 200, body: { records } } });
  assert.deepEqual(await run.port.publicRecords(BASE, 'Clients', { Nom: ['a'] }), records);
  assert.equal(run.transfer.asked[0].url, `${BASE}/tables/Clients/records?filter=${encodeURIComponent('{"Nom":["a"]}')}`);
  await assert.rejects(() => port({ 'GET anonymous': http(403) }).port.publicRecords(BASE, 'T', {}), /^Error: publicClosed$/);
  assert.deepEqual(await port({ 'GET anonymous': { status: 200, body: {} } }).port.publicRecords(BASE, 'T', {}), []);
});

test('textes : ceux du moteur dans la langue de la personne à l\'instant, la clé elle-même quand elle est inconnue (sans avertissement) ; les échecs du cadre sont dits', async () => {
  let lang = 'fr';
  const warnings = [];
  const warn = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    const run = port({ 'GET /webhooks': new TransferError('network', 'x') }, { language: () => lang });
    assert.equal(run.port.text('recv.result', { added: 2, updated: 1, removed: 0 }), '2 ajoutées, 1 mise à jour, 0 supprimée');
    lang = 'en';
    assert.equal(run.port.text('recv.result', { added: 2, updated: 1, removed: 0 }), '2 added, 1 updated, 0 removed');
    assert.equal(run.port.text('error.nePasConnue'), 'error.nePasConnue');
    await assert.rejects(() => run.port.listWebhooks(), /^Error: The Grist server is not answering\.$/);
    lang = 'fr';
    await assert.rejects(() => run.port.listWebhooks(), /^Error: Le serveur Grist ne répond pas\.$/);
    startSyncEngine({ docApi: run.docApi, transfer: run.transfer, language: () => 'en' });
    assert.equal(errorText(new Error('ownerOnly')), 'Only a document owner can do this.');
  } finally { console.warn = warn; }
  assert.deepEqual(warnings, []);
});

test('verrou, page et préférences : navigator.locks quand il existe ; la page suit sa visibilité ; le stockage refusé ne casse rien, clés préfixées', async () => {
  const stored = new Map();
  const listeners = {};
  const env = {
    navigator: { locks: { request: (name, job) => job().then(value => ({ name, value })) } },
    document: { visibilityState: 'hidden', addEventListener: (type, listener) => { listeners[type] = listener; } },
    addEventListener: (type, listener) => { listeners[type] = listener; },
    localStorage: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, String(value)) },
  };
  const { port: p } = port({}, { env, busy: () => true });
  assert.deepEqual(await p.withLock('x', async () => 5), { name: 'x', value: 5 });
  assert.equal(p.page.visible(), false);
  assert.equal(p.page.busy(), true);
  let shown = 0;
  p.page.onShow(() => shown++);
  listeners.visibilitychange();
  env.document.visibilityState = 'visible';
  listeners.visibilitychange();
  assert.equal(shown, 1, 'seulement quand la page redevient visible');
  let left = 0;
  p.page.onLeave(() => left++);
  listeners.pagehide();
  assert.equal(left, 1);
  assert.equal(p.prefs.write('visit.DOC', '123'), true);
  assert.equal(stored.get('gfs.synchro.visit.DOC'), '123');
  assert.equal(p.prefs.read('visit.DOC'), '123');
  const blocked = port({}, { env: { get localStorage() { throw new Error('SecurityError'); } } }).port;
  assert.equal(blocked.prefs.read('x'), null);
  assert.equal(blocked.prefs.write('x', 1), false);
  assert.equal(await blocked.withLock('y', async () => 6), 6, 'sans verrous : tout de suite');
});
