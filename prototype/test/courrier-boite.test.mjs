// La boîte d'envoi des e-mails (js/mail/) : les règles d'un message (rules.js) et ce que GFS écrit dans le document (outbox.js), avec un port qui note ses appels. Ce
// que le VRAI Grist en fait (formules, condition du webhook, livraison, accusé par le formulaire) est mesuré par labo/run-courrier-relais.mjs, jamais par ces essais.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkMail, splitAddresses, LIMITS } from '../js/mail/rules.js';
import { OUTBOX, RETURNS, QUEUED, WEBHOOK_NAME, ensureOutbox, armRelay, disarmRelay, enqueue, requeue, checkRelayUrl, newSecret, outboxPlan } from '../js/mail/outbox.js';

const good = { Destinataires: 'a@exemple.fr', Objet: 'Bonjour', Corps: 'Texte' };

test('une adresse nue passe, une liste se coupe sur « , » et « ; »', () => {
  assert.deepEqual(splitAddresses('a@exemple.fr, b@exemple.fr ; c@sous.exemple.fr'), ['a@exemple.fr', 'b@exemple.fr', 'c@sous.exemple.fr']);
  assert.deepEqual(splitAddresses(''), []);
  assert.deepEqual(splitAddresses(null), []);
});

test('« Nom <adresse> », un nom accentué ou sans point refusés', () => {
  for (const bad of ['Nom <a@exemple.fr>', 'é@exemple.fr', 'a@localhost', 'a@@exemple.fr', 'a b@exemple.fr', 'a@exemple.fr,,x']) {
    assert.equal(splitAddresses(bad), null, bad);
  }
});

test('un retour à la ligne dans une adresse ou dans l\'objet est refusé (un en-tête « Bcc: » ne se glisse pas)', () => {
  assert.deepEqual(checkMail({ ...good, Destinataires: 'a@exemple.fr\r\nBcc: espion@exemple.fr' }), { ok: false, code: 'headerBreak' });
  assert.deepEqual(checkMail({ ...good, Copie: 'b@exemple.fr\nX: y' }), { ok: false, code: 'headerBreak' });
  assert.deepEqual(checkMail({ ...good, Objet: 'Bonjour\r\nBcc: espion@exemple.fr' }), { ok: false, code: 'headerBreak' });
  assert.deepEqual(checkMail({ ...good, RepondreA: 'a@exemple.fr\u2028' }), { ok: false, code: 'headerBreak' });
});

test('les autres refus : destinataire absent, trop de destinataires, objet trop long, corps vide, deux « répondre à »', () => {
  assert.equal(checkMail({ ...good, Destinataires: '' }).code, 'noRecipient');
  const many = Array.from({ length: LIMITS.recipients + 1 }, (_, i) => `u${i}@exemple.fr`).join(',');
  assert.equal(checkMail({ ...good, Destinataires: many }).code, 'tooMany');
  assert.equal(checkMail({ ...good, Objet: 'x'.repeat(LIMITS.subject + 1) }).code, 'tooLong');
  assert.equal(checkMail({ ...good, Corps: '  ', Html: '' }).code, 'noBody');
  assert.equal(checkMail({ ...good, RepondreA: 'a@exemple.fr,b@exemple.fr' }).code, 'badAddress');
  assert.equal(checkMail({ ...good, Corps: 'x'.repeat(LIMITS.body + 1) }).code, 'tooLong');
});

test('un message valide : listes, objet, texte ; le HTML seul suffit', () => {
  const ok = checkMail({ ...good, Copie: 'c@exemple.fr', CopieCachee: 'd@exemple.fr', RepondreA: 'r@exemple.fr' });
  assert.deepEqual([ok.ok, ok.to, ok.cc, ok.bcc, ok.replyTo, ok.subject, ok.text], [true, ['a@exemple.fr'], ['c@exemple.fr'], ['d@exemple.fr'], 'r@exemple.fr', 'Bonjour', 'Texte']);
  assert.equal(checkMail({ Destinataires: 'a@exemple.fr', Html: '<p>Bonjour</p>' }).ok, true);
});

// Un port qui note ses appels ; `existing` : { table: [colId…] } ; `renamed` : la table créée reçoit un autre nom (Grist en donne un si le sien est pris).
function fakePort({ existing = {}, renamed = {}, hooks = [] } = {}) {
  const calls = [];
  let nextHook = 100;
  const schema = {
    has: id => id in existing,
    columns: id => (existing[id] || []).map(colId => ({ colId })),
  };
  return {
    calls,
    readSchema: async () => schema,
    apply: async actions => {
      calls.push(['apply', actions]);
      return { retValues: actions.map(action => (action[0] === 'AddTable' ? { table_id: renamed[action[1]] || action[1] } : 7)) };
    },
    fetchRows: async () => [{ id: 3, Relance: 1 }, { id: 4 }],
    listWebhooks: async () => hooks,
    deleteWebhook: async id => { calls.push(['deleteWebhook', id]); },
    createWebhook: async fields => { calls.push(['createWebhook', fields]); return `hook${nextHook++}`; },
  };
}

test('ensureOutbox refusé : rien n\'est écrit', async () => {
  const port = fakePort();
  const seen = [];
  const result = await ensureOutbox(port, { accept: async wish => { seen.push(wish); return false; } });
  assert.deepEqual(result, { ready: false, declined: true });
  assert.deepEqual(port.calls, []);
  assert.deepEqual(seen[0].tables, [RETURNS, OUTBOX]);
});

test('ensureOutbox accepté : la table des accusés d\'abord, la boîte ensuite, avec le nom RÉEL de la première dans les formules', async () => {
  const port = fakePort({ renamed: { [RETURNS]: 'GFS_Courrier_Retours2' } });
  const result = await ensureOutbox(port, { accept: async () => true });
  assert.deepEqual(result, { ready: true, outbox: OUTBOX, returns: 'GFS_Courrier_Retours2', created: true });
  const [first, second] = port.calls.map(call => call[1][0]);
  assert.deepEqual([first[0], first[1], second[0], second[1]], ['AddTable', RETURNS, 'AddTable', OUTBOX]);
  const statut = second[2].find(column => column.id === 'Statut');
  assert.ok(statut.isFormula && statut.formula.includes('GFS_Courrier_Retours2.lookupRecords') && !statut.formula.includes('GFS_Courrier_Retours.'));
  assert.ok(second[2].find(column => column.id === 'Cle' && column.isFormula === false && column.formula.includes('uuid')));
  assert.ok(!first[2].some(column => column.id === 'id'), 'aucune colonne « id » (réservée)');
});

test('ensureOutbox : un document qui a déjà tout n\'est pas touché ; une colonne manquante est ajoutée seule', async () => {
  const full = outboxPlan({ has: () => false, columns: () => null });
  const all = column => column.id;
  const cols = {
    [RETURNS]: ['Courrier', 'Cle', 'Relance', 'Etat', 'Detail', 'RecuLe'],
    [OUTBOX]: ['Destinataires', 'Copie', 'CopieCachee', 'Objet', 'Corps', 'Html', 'RepondreA', 'Demande', 'Relance', 'Cle', 'Statut', 'Detail'],
  };
  assert.equal(full.outbox.missing.map(all).join() === cols[OUTBOX].join(), true);
  const done = fakePort({ existing: cols });
  assert.deepEqual(await ensureOutbox(done, { accept: async () => assert.fail('aucune question') }), { ready: true, outbox: OUTBOX, returns: RETURNS, created: false });
  assert.deepEqual(done.calls, []);
  const partial = fakePort({ existing: { ...cols, [OUTBOX]: cols[OUTBOX].filter(id => id !== 'Html') } });
  await ensureOutbox(partial, { accept: async wish => { assert.deepEqual(wish, { tables: [], columns: [`${OUTBOX}.Html`] }); return true; } });
  assert.deepEqual(partial.calls.map(call => call[1].map(action => action.slice(0, 3))), [[['AddColumn', OUTBOX, 'Html']]]);
});

test('une adresse de relais : https, ou la machine elle-même quand les essais le disent ; jamais d\'identifiants dans l\'adresse', () => {
  assert.equal(checkRelayUrl('https://relais.exemple.fr/hook'), null);
  assert.equal(checkRelayUrl('http://relais.exemple.fr/hook'), 'notHttps');
  assert.equal(checkRelayUrl('http://127.0.0.1:9000/hook'), 'notHttps');
  assert.equal(checkRelayUrl('http://127.0.0.1:9000/hook', { loopback: true }), null);
  assert.equal(checkRelayUrl('http://exemple.fr/hook', { loopback: true }), 'notHttps');
  assert.equal(checkRelayUrl('https://moi:mdp@relais.exemple.fr/'), 'badUrl');
  assert.equal(checkRelayUrl('pas une adresse'), 'badUrl');
});

test('newSecret : 48 caractères hexadécimaux, différents à chaque fois', () => {
  const a = newSecret();
  assert.match(a, /^[0-9a-f]{48}$/);
  assert.notEqual(a, newSecret());
});

const SECRET = 'ab'.repeat(24);

test('armRelay : l\'ancien relais est remplacé, la condition porte sur le statut, le secret va dans l\'en-tête', async () => {
  const port = fakePort({ hooks: [{ id: 'old', fields: { name: WEBHOOK_NAME } }, { id: 'autre', fields: { name: 'Synchro' } }] });
  const asked = [];
  const transfer = { rest: async (method, path, options) => { asked.push([method, path, options]); return { status: 200, body: '' }; } };
  const id = await armRelay({ port, transfer, url: 'https://relais.exemple.fr/hook', secret: SECRET });
  assert.equal(id, 'hook100');
  assert.deepEqual(port.calls[0], ['deleteWebhook', 'old']);
  assert.equal(port.calls.filter(call => call[0] === 'deleteWebhook').length, 1, 'le webhook d\'un autre usage n\'est pas touché');
  assert.deepEqual(port.calls[1][1], { name: WEBHOOK_NAME, memo: port.calls[1][1].memo, url: 'https://relais.exemple.fr/hook', tableId: OUTBOX, condition: '$Statut == "a-envoyer"' });
  assert.deepEqual(asked, [['PATCH', '/webhooks/hook100', { body: { authorization: `Bearer ${SECRET}` }, writable: true }]]);
});

test('armRelay : une adresse sans https ou un secret faible ne posent rien ; un secret que Grist refuse défait le webhook', async () => {
  const port = fakePort();
  const transfer = { rest: async () => { throw new Error('HTTP 400'); } };
  await assert.rejects(armRelay({ port, transfer, url: 'http://relais.exemple.fr/', secret: SECRET }), /notHttps/);
  await assert.rejects(armRelay({ port, transfer, url: 'https://relais.exemple.fr/', secret: 'court' }), /weakSecret/);
  assert.deepEqual(port.calls, []);
  await assert.rejects(armRelay({ port, transfer, url: 'https://relais.exemple.fr/', secret: SECRET }), /HTTP 400/);
  assert.deepEqual(port.calls.map(call => call[0]), ['createWebhook', 'deleteWebhook']);
  assert.equal(port.calls[1][1], 'hook100');
});

test('disarmRelay : seuls les webhooks du relais sont retirés', async () => {
  const port = fakePort({ hooks: [{ id: 'a', fields: { name: WEBHOOK_NAME } }, { id: 'b', fields: { name: 'Synchro' } }] });
  await disarmRelay(port);
  assert.deepEqual(port.calls, [['deleteWebhook', 'a']]);
});

test('enqueue : les règles d\'abord ; la ligne est « à envoyer » et ne porte que les champs de la table (ni clé ni statut)', async () => {
  const port = fakePort();
  await assert.rejects(enqueue(port, OUTBOX, { ...good, Destinataires: 'x@exemple.fr\r\nBcc: y@exemple.fr' }), /headerBreak/);
  assert.deepEqual(port.calls, []);
  await enqueue(port, OUTBOX, { ...good, Cle: 'forgee', Statut: 'envoye', id: 99 });
  const row = port.calls[0][1][0][3];
  assert.equal(row.Demande, QUEUED);
  assert.deepEqual(Object.keys(row).sort(), ['Copie', 'CopieCachee', 'Corps', 'Demande', 'Destinataires', 'Html', 'Objet', 'RepondreA']);
});

test('requeue : la relance monte et la ligne est de nouveau « à envoyer » ; une ligne inconnue ne fait rien', async () => {
  const port = fakePort();
  assert.equal(await requeue(port, OUTBOX, [3, 4, 5]), 2);
  assert.deepEqual(port.calls[0][1], [['UpdateRecord', OUTBOX, 3, { Relance: 2, Demande: QUEUED }], ['UpdateRecord', OUTBOX, 4, { Relance: 1, Demande: QUEUED }]]);
  const none = fakePort();
  assert.equal(await requeue(none, OUTBOX, [42]), 0);
  assert.deepEqual(none.calls, []);
});
