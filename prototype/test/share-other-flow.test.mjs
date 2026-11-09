// Le parcours de celui qui envoie un fichier à un autre document (js/share-other-flow.js) : ce qu'il demande au moteur, dans quel ordre, et quand il arrête le partage. Le moteur est ici un faux qui note
// ses appels ; ce que le vrai moteur fait dans un vrai Grist est mesuré par labo/run-sync-partage.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSourceFlow, exportName, selectionOf, SENT_COLUMNS, HELPER_COLUMNS, PASSES } from '../js/share-other-flow.js';

const FILE = { id: 'abc123', name: 'Facture 2026.pdf' };

// Un moteur qui répond comme celui du kit et note ce qu'on lui demande ; `passes` : ce que dit `catchState` à chaque passage du rattrapage.
function fakeEngine({ passes = [{ why: 'sent' }, { why: 'idle' }], sent = 4, pending = [0], fail = {} } = {}) {
  const calls = [];
  let at = -1;
  const note = (name, value) => async (...args) => { calls.push([name, ...args]); if (fail[name]) throw fail[name]; return typeof value === 'function' ? value(...args) : value; };
  return {
    calls,
    saveChosenExport: note('save', args => ({ id: 'exp1', created: { id: 'exp1', name: args.name, tables: [], recipients: [] } })),
    startInvitation: note('invite', () => ({ entry: { id: 'inv1' }, secret: 's3cret' })),
    invitationCode: note('code', () => ({ code: 'GRISTSYNC2.abc', expire: 1700000000 })),
    checkReply: note('checkReply', () => ({ code: 'WGV-ME3', share: { name: 'Réception', folder: 'Home', teamName: 'Personal', personal: true } })),
    approveReply: note('approve', 'hook-1'),
    sendExisting: note('sendExisting', sent),
    catchUp: note('catchUp', () => { at += 1; }),
    catchState: () => ({ why: (passes[Math.min(at, passes.length - 1)] || {}).why, running: Boolean((passes[Math.min(at, passes.length - 1)] || {}).running) }),
    filesPending: () => pending[Math.min(Math.max(at, 0), pending.length - 1)],
    endExport: note('end', undefined),
    cancelPendingInvitation: note('cancelInvitation', undefined),
  };
}
const flow = (engine, extra = {}) => createSourceFlow({ engine, file: FILE, wait: async () => {}, ...extra });
const names = engine => engine.calls.map(call => call[0]);

test('le nom de l\'export est celui du fichier sans « .pdf » ; la sélection est ce seul fichier, par son identifiant, sans les colonnes de la corbeille', () => {
  assert.equal(exportName(FILE), 'Facture 2026');
  assert.equal(exportName({ id: 'x', name: '.pdf' }), '.pdf');
  const [selection] = selectionOf(FILE);
  assert.equal(selection.table, 'GFS_Fichiers');
  assert.deepEqual(selection.filter, { mode: 'all', conds: [{ id: 'Identifiant', op: 'eq', values: ['abc123'] }] });
  assert.ok(SENT_COLUMNS.includes('Contenu') && SENT_COLUMNS.includes('Identifiant'));
  assert.ok(!SENT_COLUMNS.includes('SupprimeLe') && !SENT_COLUMNS.includes('SupprimePar'));
  assert.ok(HELPER_COLUMNS.every(name => !SENT_COLUMNS.includes(name)), 'les colonnes d\'aide du moteur ne sont pas des colonnes du fichier');
});

test('prepare : l\'export du seul fichier, l\'invitation, son code ; rien n\'est envoyé encore', async () => {
  const engine = fakeEngine();
  const made = await flow(engine).prepare();
  assert.deepEqual(made, { code: 'GRISTSYNC2.abc', expire: 1700000000 });
  assert.deepEqual(names(engine), ['save', 'invite', 'code']);
  assert.equal(engine.calls[0][1].name, 'Facture 2026');
  assert.deepEqual(engine.calls[0][1].selection, selectionOf(FILE));
  assert.deepEqual(engine.calls[2].slice(1, 3), [{ id: 'exp1', name: 'Facture 2026', tables: [], recipients: [] }, { id: 'inv1' }]);
});

test('check : le document que Grist désigne et le code de contrôle ; un refus du moteur remonte tel quel', async () => {
  const engine = fakeEngine();
  const run = flow(engine);
  await run.prepare();
  assert.deepEqual(await run.check('  GRISTSYNC2.reponse  '), { name: 'Réception', folder: 'Home', team: 'Personal', personal: true, control: 'WGV-ME3' });
  assert.equal(engine.calls.at(-1)[3], 'GRISTSYNC2.reponse', 'le texte collé est rogné');
  const refused = fakeEngine({ fail: { checkReply: new Error('shareOtherDoc') } });
  const other = flow(refused);
  await other.prepare();
  await assert.rejects(() => other.check('x'), /^Error: shareOtherDoc$/);
});

test('send : le webhook, l\'existant, le rattrapage jusqu\'à « rien à envoyer », puis l\'arrêt du partage', async () => {
  const engine = fakeEngine();
  const run = flow(engine);
  await run.prepare();
  await run.check('r');
  const phases = [];
  const done = await run.send(step => phases.push(step.phase));
  assert.deepEqual(done, { document: 'Réception' });
  assert.deepEqual(names(engine).slice(3), ['checkReply', 'approve', 'sendExisting', 'catchUp', 'catchUp', 'end']);
  assert.deepEqual(phases, ['rows', 'files', 'files']);
  assert.equal(run.started, true);
});

test('send : tant que des fichiers restent, un autre passage ; un passage encore en cours n\'est pas la fin ; le partage ne s\'arrête qu\'une fois tout parti', async () => {
  const engine = fakeEngine({ passes: [{ why: 'sent' }, { why: 'idle', running: true }, { why: 'idle' }, { why: 'idle' }], pending: [2, 2, 1, 0] });
  const run = flow(engine);
  await run.prepare(); await run.check('r');
  await run.send();
  assert.equal(names(engine).filter(name => name === 'catchUp').length, 4);
  assert.equal(names(engine).at(-1), 'end');
});

test('send : si une autre page renvoyait déjà (sendExisting rend null), il attend qu\'un passage ait envoyé avant de croire que tout est parti', async () => {
  const engine = fakeEngine({ sent: null, passes: [{ why: 'idle' }, { why: 'idle' }, { why: 'sent' }, { why: 'idle' }] });
  const run = flow(engine);
  await run.prepare(); await run.check('r');
  await run.send();
  assert.equal(names(engine).filter(name => name === 'catchUp').length, 4, 'les deux premiers « rien à envoyer » ne comptent pas');
});

test('send : un lien de réception qui ne répond pas arrête l\'attente (« blocked ») sans arrêter le partage ; un envoi trop long dit « timeout »', async () => {
  const blocked = fakeEngine({ passes: [{ why: 'blocked' }] });
  const run = flow(blocked);
  await run.prepare(); await run.check('r');
  await assert.rejects(() => run.send(), error => error.share === 'blocked');
  assert.ok(!names(blocked).includes('end'), 'le partage reste là pour être repris ou arrêté par la personne');
  const slow = fakeEngine({ passes: [{ why: 'sent' }] });
  const late = flow(slow);
  await late.prepare(); await late.check('r');
  await assert.rejects(() => late.send(), error => error.share === 'timeout');
  assert.equal(names(slow).filter(name => name === 'catchUp').length, PASSES);
});

test('abort : avant l\'envoi, l\'invitation en attente et l\'export sont défaits ; après le début, seul l\'arrêt du partage ; sans rien préparé, rien', async () => {
  const before = fakeEngine();
  const run = flow(before);
  await run.prepare();
  await run.abort();
  assert.deepEqual(names(before).slice(3), ['cancelInvitation', 'end']);
  await run.abort();
  assert.equal(names(before).length, 5, 'une seconde annulation ne fait plus rien');
  const started = fakeEngine({ passes: [{ why: 'blocked' }] });
  const second = flow(started);
  await second.prepare(); await second.check('r');
  await assert.rejects(() => second.send());
  await second.abort();
  assert.ok(!names(started).includes('cancelInvitation'));
  assert.equal(names(started).at(-1), 'end');
  const nothing = fakeEngine();
  await flow(nothing).abort();
  assert.deepEqual(nothing.calls, []);
});
