// Le parcours de celui qui reçoit (js/sharing/share-receive-flow.js) : ce qu'il demande au moteur, dans quel ordre, et ce qu'il défait. Le moteur est ici un faux qui note ses appels ; ce que le vrai moteur fait
// dans un vrai Grist est mesuré par labo/run-partager-recevoir.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTargetFlow, RECEIVED_TABLE } from '../js/sharing/share-receive-flow.js';

const OWN = 'https://grist.exemple.fr';
const INVITATION = { id: 'i1', export: 'e1', name: 'Fichiers GFS', mode: 'reponse', origin: OWN, expire: 1800000000, tables: [{ table: 'GFS_Files', columns: ['FileId', 'Name'] }] };

function fakeEngine({ invitation = INVITATION, known = null, fail = {}, taken = [], own = OWN } = {}) {
  const calls = [];
  const note = (name, value) => async (...args) => { calls.push([name, ...args]); if (fail[name]) throw fail[name]; return typeof value === 'function' ? value(...args) : value; };
  return {
    calls,
    ownOrigin: async () => own,
    readInvitation: note('read', invitation),
    knownReception: note('known', known),
    tableTaken: async name => taken.includes(name),
    checkDestinations: note('check', { existing: [] }),
    createReception: note('create', () => ({ journal: 'GFS_Journal_Fichiers_GFS', note: {}, created: [RECEIVED_TABLE] })),
    relinkReception: note('relink', () => ({ journal: 'GFS_Journal_Ancien', note: {} })),
    receptionReply: note('reply', { code: 'GRISTSYNC2.reponse', control: 'WGV-ME3' }),
    undoReception: note('undo', undefined),
    ensureMarks: note('marks', undefined),
    markAwaiting: note('await', undefined),
    clearAwaiting: note('clear', undefined),
  };
}
const names = engine => engine.calls.map(call => call[0]);

test('read : le code est rogné, lu par le moteur, et une réception déjà là est signalée', async () => {
  const engine = fakeEngine();
  const flow = createTargetFlow({ engine });
  assert.deepEqual(await flow.read('  GRISTSYNC2.abc \n'), { name: 'Fichiers GFS', tables: 1, expire: 1800000000, known: false, table: 'GFS_Received', marks: ['Accepted', 'Refused'] });
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

test('read : un code d\'un AUTRE serveur Grist est refusé tout de suite, avant que quoi que ce soit soit créé (choix du porteur, 18/11)', async () => {
  const engine = fakeEngine({ invitation: { ...INVITATION, origin: 'https://docs.autre-serveur.org' } });
  const flow = createTargetFlow({ engine });
  await assert.rejects(() => flow.read('x'), error => error.share === 'server' && error.vars.server === 'docs.autre-serveur.org');
  assert.deepEqual(names(engine), ['read'], 'ni la réception connue, ni la table, ni le journal ne sont cherchés ou créés');
  assert.equal(flow.created, false);
  await flow.abort();
  assert.deepEqual(names(engine), ['read'], 'rien à défaire');
  for (const origin of [OWN, '', undefined]) {
    assert.equal((await createTargetFlow({ engine: fakeEngine({ invitation: { ...INVITATION, origin } }) }).read('x')).name, 'Fichiers GFS', `origine « ${origin} » : le partage continue`);
  }
  assert.equal((await createTargetFlow({ engine: fakeEngine({ own: '' }) }).read('x')).name, 'Fichiers GFS', 'sans origine pour ce document : le moteur juge');
});

test('accept : tout va dans GFS_Received, en archive, après la vérification des destinations ; rien n\'est créé avant', async () => {
  const engine = fakeEngine();
  const flow = createTargetFlow({ engine });
  await flow.read('x');
  assert.deepEqual(names(engine), ['read', 'known'], 'lire ne crée rien');
  assert.equal(flow.created, false);
  assert.deepEqual(await flow.accept(), { journal: 'GFS_Journal_Fichiers_GFS', relinked: false, table: 'GFS_Received' });
  assert.deepEqual(names(engine).slice(2), ['check', 'create', 'marks', 'await'], 'les marques « accepté » et « refusé » naissent tout de suite, avant la réponse à l\'envoyeur');
  assert.deepEqual(engine.calls[4], ['marks', 'GFS_Received']);
  const [, invitation, plans, options] = engine.calls[3];
  assert.equal(invitation, INVITATION);
  assert.deepEqual(plans, [{ tb: INVITATION.tables[0], dest: 'GFS_Received' }]);
  assert.deepEqual(options, { reserve: true, options: { archive: true } });
  assert.equal(flow.created, true);
});

test('accept : un partage déjà reçu de ce document reprend sa réception (nouvelle invitation), sans rien créer', async () => {
  const known = { journal: 'GFS_Journal_Ancien', note: {} };
  const engine = fakeEngine({ known });
  const flow = createTargetFlow({ engine });
  await flow.read('x');
  assert.deepEqual(await flow.accept(), { journal: 'GFS_Journal_Ancien', relinked: true, table: 'GFS_Received' });
  assert.deepEqual(names(engine).slice(2), ['relink', 'marks', 'await'], 'une réception d\'avant reçoit aussi ses colonnes de marque (additif)');
  await flow.abort();
  assert.ok(!names(engine).includes('undo'), 'une réception qui existait avant reste');
});

test('accept : une colonne envoyée qui porte le nom d\'une marque arrive sous un autre nom ; les autres colonnes ne sont pas touchées', async () => {
  const columns = [{ id: 'FileId', type: 'Text' }, { id: 'Accepted', type: 'Bool' }, { id: 'refused', type: 'Bool' }, { id: 'Name', type: 'Text' }];
  const invitation = { ...INVITATION, tables: [{ table: 'GFS_Files', columns }, { table: 'Autre', columns: [{ id: 'Name' }] }] };
  const engine = fakeEngine({ invitation });
  const flow = createTargetFlow({ engine });
  await flow.read('x'); await flow.accept();
  const plans = engine.calls.find(call => call[0] === 'create')[2];
  assert.deepEqual(plans[0].map, { Accepted: 'Accepted_sent', refused: 'refused_sent' });
  assert.ok(!('map' in plans[1]), 'une table sans colonne de ce nom n\'a aucune correspondance');
  assert.deepEqual(engine.calls.find(call => call[0] === 'check')[2], plans, 'le moteur contrôle les destinations avec les mêmes choix');
});

test('accept : si les colonnes de marque ne se posent pas, la réception qui vient d\'être créée peut être défaite (jamais une réception sans elles)', async () => {
  const engine = fakeEngine({ fail: { marks: new Error('Blocked by structure access rules') } });
  const flow = createTargetFlow({ engine });
  await flow.read('x');
  await assert.rejects(() => flow.accept(), /Blocked by structure/);
  assert.equal(flow.created, true);
  await flow.abort();
  assert.ok(names(engine).includes('undo'));
});

test('reply : le lien collé est rogné, le moteur le vérifie, la fenêtre reçoit la réponse et le code de contrôle', async () => {
  const engine = fakeEngine();
  const flow = createTargetFlow({ engine });
  await flow.read('x'); await flow.accept();
  assert.deepEqual(await flow.reply('  https://exemple.fr/o/eq/forms/cle/1  '), { code: 'GRISTSYNC2.reponse', control: 'WGV-ME3' });
  assert.equal(engine.calls.find(call => call[0] === 'reply')[2], 'https://exemple.fr/o/eq/forms/cle/1');
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
  const engine = fakeEngine({ taken: ['GFS_Received', 'GFS_Received_2'] });
  const flow = createTargetFlow({ engine });
  assert.equal((await flow.read('x')).table, 'GFS_Received_3');
  assert.deepEqual((await flow.accept()).table, 'GFS_Received_3');
  assert.deepEqual(engine.calls.find(call => call[0] === 'create')[2], [{ tb: INVITATION.tables[0], dest: 'GFS_Received_3' }]);
  const full = createTargetFlow({ engine: fakeEngine({ taken: ['GFS_Received', ...Array.from({ length: 60 }, (_, n) => `GFS_Received_${n + 2}`)] }) });
  await assert.rejects(() => full.read('x'), error => error.share === 'tables');
});

test('une réception déjà là garde sa table, même quand GFS_Received est prise', async () => {
  const known = { journal: 'GFS_Journal_Ancien', note: { tables: [{ dest: 'GFS_Received_2' }] } };
  const flow = createTargetFlow({ engine: fakeEngine({ known, taken: ['GFS_Received', 'GFS_Received_2'] }) });
  assert.equal((await flow.read('x')).table, 'GFS_Received_2');
  assert.deepEqual(await flow.accept(), { journal: 'GFS_Journal_Ancien', relinked: true, table: 'GFS_Received_2' });
});

test('accept : la réception est notée « en attente de la réponse » dans son journal (pour reprendre si Grist recharge la page) ; une réception reprise le dit aussi ; un échec de la note ne gêne pas le parcours', async () => {
  const engine = fakeEngine();
  const flow = createTargetFlow({ engine });
  await flow.read('x'); await flow.accept();
  assert.deepEqual(engine.calls.find(call => call[0] === 'await'), ['await', 'GFS_Journal_Fichiers_GFS', { relinked: false, created: [RECEIVED_TABLE] }]);
  const again = fakeEngine({ known: { journal: 'GFS_Journal_Ancien', note: {} } });
  const relinked = createTargetFlow({ engine: again });
  await relinked.read('x'); await relinked.accept();
  assert.deepEqual(again.calls.find(call => call[0] === 'await'), ['await', 'GFS_Journal_Ancien', { relinked: true, created: [] }]);
  const failing = fakeEngine({ fail: { markAwaiting: null, await: new Error('refusé') } });
  const quiet = createTargetFlow({ engine: failing });
  const warn = console.warn;
  console.warn = () => {};
  try {
    await quiet.read('x');
    assert.equal((await quiet.accept()).journal, 'GFS_Journal_Fichiers_GFS', 'le parcours continue vers le lien du formulaire');
  } finally { console.warn = warn; }
});

test('reply : la réponse rendue efface la note « en attente » ; un lien refusé la laisse', async () => {
  const engine = fakeEngine();
  const flow = createTargetFlow({ engine });
  await flow.read('x'); await flow.accept(); await flow.reply('lien');
  assert.deepEqual(names(engine).slice(-2), ['reply', 'clear']);
  assert.equal(engine.calls.at(-1)[1], 'GFS_Journal_Fichiers_GFS');
  const refused = fakeEngine({ fail: { reply: new Error('linkElsewhere') } });
  const other = createTargetFlow({ engine: refused });
  await other.read('x'); await other.accept();
  await assert.rejects(() => other.reply('x'));
  assert.ok(!names(refused).includes('clear'), 'la réponse n\'est pas rendue : la réception attend toujours');
});

// Ce que le journal garde après le rechargement de Grist : la note de la réception, avec « en attente » (`gfsAwaiting`).
const waiting = (over = {}) => ({ journal: 'GFS_Journal_Fichiers_GFS', note: { name: 'Fichiers GFS', tables: [{ table: 'GFS_Fichiers', dest: 'GFS_Recus_2' }], gfsAwaiting: { relinked: false, created: ['GFS_Recus_2'] }, ...over } });

test('une réception retrouvée après un rechargement reprend à l\'étape du lien : le journal et la table viennent de la note, le lien collé donne la réponse, la note « en attente » s\'efface', async () => {
  const engine = fakeEngine();
  const resume = waiting();
  const flow = createTargetFlow({ engine, resume });
  assert.equal(flow.journal, 'GFS_Journal_Fichiers_GFS');
  assert.equal(flow.table, 'GFS_Recus_2', 'la table de la note, pas celle d\'une réception neuve');
  assert.equal(flow.created, true);
  assert.deepEqual(await flow.reply('  lien  '), { code: 'GRISTSYNC2.reponse', control: 'WGV-ME3' });
  assert.deepEqual(engine.calls[0], ['reply', { journal: 'GFS_Journal_Fichiers_GFS', note: resume.note, created: ['GFS_Recus_2'] }, 'lien'], 'le moteur reçoit la réception telle que le journal la garde');
  assert.deepEqual(names(engine), ['reply', 'clear']);
});

test('une réception reprise puis abandonnée : le journal et la table qu\'elle a créée sont défaits ; une réception qui existait avant reste, sans note « en attente »', async () => {
  const engine = fakeEngine();
  const flow = createTargetFlow({ engine, resume: waiting() });
  await flow.abort();
  await flow.abort();
  assert.deepEqual(engine.calls, [['undo', { journal: 'GFS_Journal_Fichiers_GFS', note: waiting().note, created: ['GFS_Recus_2'] }]], 'défaite une seule fois, avec les tables qu\'elle avait créées');
  const kept = fakeEngine();
  await createTargetFlow({ engine: kept, resume: waiting({ gfsAwaiting: { relinked: true, created: [] } }) }).abort();
  assert.deepEqual(kept.calls, [['clear', 'GFS_Journal_Fichiers_GFS']], 'rien n\'est défait, la note est effacée');
  const bare = createTargetFlow({ engine: fakeEngine(), resume: waiting({ gfsAwaiting: undefined, tables: [] }) });
  assert.equal(bare.table, RECEIVED_TABLE, 'une note sans table : le nom de GFS');
});

test('read : les marques annoncées sont celles de la langue de l\'envoyeur (ses colonnes la disent) : « Accepte » et « Refuse » pour un envoyeur d\'avant l\'anglais', async () => {
  const columns = [{ id: 'Identifiant' }, { id: 'Nom' }, { id: 'Contenu' }];
  const flow = createTargetFlow({ engine: fakeEngine({ invitation: { ...INVITATION, tables: [{ table: 'GFS_Fichiers', columns }] } }) });
  assert.deepEqual((await flow.read('x')).marks, ['Accepte', 'Refuse']);
});
