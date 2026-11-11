// Le parcours de celui qui reçoit (js/sharing/share-receive-flow.js) : ce qu'il demande au moteur, dans quel ordre, et ce qu'il défait. Le moteur est ici un faux qui note ses appels ; ce que le vrai moteur fait
// dans un vrai Grist est mesuré par labo/run-partager-recevoir.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTargetFlow, RECEIVED_TABLE } from '../js/sharing/share-receive-flow.js';

const INVITATION = { id: 'i1', export: 'e1', name: 'Fichiers GFS', mode: 'reponse', expire: 1800000000, tables: [{ table: 'GFS_Fichiers', columns: ['Identifiant', 'Nom'] }] };

function fakeEngine({ invitation = INVITATION, known = null, fail = {}, taken = [] } = {}) {
  const calls = [];
  const note = (name, value) => async (...args) => { calls.push([name, ...args]); if (fail[name]) throw fail[name]; return typeof value === 'function' ? value(...args) : value; };
  return {
    calls,
    readInvitation: note('read', invitation),
    knownReception: note('known', known),
    tableTaken: async name => taken.includes(name),
    checkDestinations: note('check', { existing: [] }),
    createReception: note('create', () => ({ journal: 'GFS_Journal_Fichiers_GFS', note: {}, created: [RECEIVED_TABLE] })),
    relinkReception: note('relink', () => ({ journal: 'GFS_Journal_Ancien', note: {} })),
    receptionReply: note('reply', { code: 'GRISTSYNC2.reponse', control: 'WGV-ME3' }),
    undoReception: note('undo', undefined),
  };
}
const names = engine => engine.calls.map(call => call[0]);

test('read : le code est rogné, lu par le moteur, et une réception déjà là est signalée', async () => {
  const engine = fakeEngine();
  const flow = createTargetFlow({ engine });
  assert.deepEqual(await flow.read('  GRISTSYNC2.abc \n'), { name: 'Fichiers GFS', tables: 1, expire: 1800000000, known: false, table: 'GFS_Recus' });
  assert.equal(engine.calls[0][1], 'GRISTSYNC2.abc');
  const again = createTargetFlow({ engine: fakeEngine({ known: { journal: 'J', note: {} } }) });
  assert.equal((await again.read('x')).known, true);
});

test('read : GFS ne reçoit ni un lien public ni un échange (d\'autres modes du moteur), et un refus du moteur remonte tel quel', async () => {
  for (const mode of ['public', 'echange']) {
    await assert.rejects(() => createTargetFlow({ engine: fakeEngine({ invitation: { ...INVITATION, mode } }) }).read('x'), error => error.share === 'mode');
  }
  await assert.rejects(() => createTargetFlow({ engine: fakeEngine({ fail: { read: new Error('invitationExpired') } }) }).read('x'), /^Error: invitationExpired$/);
  assert.equal((await createTargetFlow({ engine: fakeEngine({ invitation: { ...INVITATION, mode: undefined } }) }).read('x')).name, 'Fichiers GFS', 'sans mode : une invitation d\'avant, en réponse');
});

test('accept : tout va dans GFS_Recus, en archive, après la vérification des destinations ; rien n\'est créé avant', async () => {
  const engine = fakeEngine();
  const flow = createTargetFlow({ engine });
  await flow.read('x');
  assert.deepEqual(names(engine), ['read', 'known'], 'lire ne crée rien');
  assert.equal(flow.created, false);
  assert.deepEqual(await flow.accept(), { journal: 'GFS_Journal_Fichiers_GFS', relinked: false, table: 'GFS_Recus' });
  assert.deepEqual(names(engine).slice(2), ['check', 'create']);
  const [, invitation, plans, options] = engine.calls[3];
  assert.equal(invitation, INVITATION);
  assert.deepEqual(plans, [{ tb: INVITATION.tables[0], dest: 'GFS_Recus' }]);
  assert.deepEqual(options, { reserve: true, options: { archive: true } });
  assert.equal(flow.created, true);
});

test('accept : un partage déjà reçu de ce document reprend sa réception (nouvelle invitation), sans rien créer', async () => {
  const known = { journal: 'GFS_Journal_Ancien', note: {} };
  const engine = fakeEngine({ known });
  const flow = createTargetFlow({ engine });
  await flow.read('x');
  assert.deepEqual(await flow.accept(), { journal: 'GFS_Journal_Ancien', relinked: true, table: 'GFS_Recus' });
  assert.deepEqual(names(engine).slice(2), ['relink']);
  await flow.abort();
  assert.ok(!names(engine).includes('undo'), 'une réception qui existait avant reste');
});

test('reply : le lien collé est rogné, le moteur le vérifie, la fenêtre reçoit la réponse et le code de contrôle', async () => {
  const engine = fakeEngine();
  const flow = createTargetFlow({ engine });
  await flow.read('x'); await flow.accept();
  assert.deepEqual(await flow.reply('  https://exemple.fr/o/eq/forms/cle/1  '), { code: 'GRISTSYNC2.reponse', control: 'WGV-ME3' });
  assert.equal(engine.calls.at(-1)[2], 'https://exemple.fr/o/eq/forms/cle/1');
  const refused = fakeEngine({ fail: { reply: new Error('linkElsewhere') } });
  const other = createTargetFlow({ engine: refused });
  await other.read('x'); await other.accept();
  await assert.rejects(() => other.reply('x'), /^Error: linkElsewhere$/);
  await other.abort();
  assert.deepEqual(names(refused).slice(-2), ['reply', 'undo'], 'un lien refusé laisse la possibilité de tout défaire');
});

test('abort : avant la réponse, le journal et ses tables vides sont défaits une seule fois ; après la réponse rendue, la réception reste ; sans rien créé, rien', async () => {
  const before = fakeEngine();
  const flow = createTargetFlow({ engine: before });
  await flow.read('x'); await flow.accept();
  await flow.abort();
  await flow.abort();
  assert.equal(names(before).filter(name => name === 'undo').length, 1);
  assert.equal(flow.created, false);
  const after = fakeEngine();
  const done = createTargetFlow({ engine: after });
  await done.read('x'); await done.accept(); await done.reply('l');
  await done.abort();
  assert.ok(!names(after).includes('undo'));
  const nothing = fakeEngine();
  await createTargetFlow({ engine: nothing }).abort();
  assert.deepEqual(nothing.calls, []);
});

test('accept : un second partage ne reprend pas la table du premier (une destination ne reçoit qu\'un partage : règle du moteur, mesurée) mais la première libre, jamais une table qui existe déjà', async () => {
  const engine = fakeEngine({ taken: ['GFS_Recus', 'GFS_Recus_2'] });
  const flow = createTargetFlow({ engine });
  assert.equal((await flow.read('x')).table, 'GFS_Recus_3');
  assert.deepEqual((await flow.accept()).table, 'GFS_Recus_3');
  assert.deepEqual(engine.calls.find(call => call[0] === 'create')[2], [{ tb: INVITATION.tables[0], dest: 'GFS_Recus_3' }]);
  const full = createTargetFlow({ engine: fakeEngine({ taken: ['GFS_Recus', ...Array.from({ length: 60 }, (_, n) => `GFS_Recus_${n + 2}`)] }) });
  await assert.rejects(() => full.read('x'), error => error.share === 'tables');
});

test('une réception déjà là garde sa table, même quand GFS_Recus est prise', async () => {
  const known = { journal: 'GFS_Journal_Ancien', note: { tables: [{ dest: 'GFS_Recus_2' }] } };
  const flow = createTargetFlow({ engine: fakeEngine({ known, taken: ['GFS_Recus', 'GFS_Recus_2'] }) });
  assert.equal((await flow.read('x')).table, 'GFS_Recus_2');
  assert.deepEqual(await flow.accept(), { journal: 'GFS_Journal_Ancien', relinked: true, table: 'GFS_Recus_2' });
});
