// Ranger un fichier dans GFS, côté données et côté personne (KeptFiles.deposit, js/kept-files.js, contrats 5.4 point 9 et 6.6) : les verrous, les vérifications du contenu, les issues, le dossier,
// la mémoire d'un lot (« Faire pareil pour les suivants »), les refus et leurs codes. Le magasin, le rangement et la fenêtre du nom pris sont des doublures ; la fenêtre elle-même, le vrai
// Grist et la vraie souris se jouent dans le labo (labo/run-ranger-pdf.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ERR, Refus } from '../js/filter.js';
import { TransferError } from '../js/transfer.js';
import { TableDeclined } from '../js/own-table.js';
import { FR, EN, PDF_BYTES, setup, pdf } from './kept-setup.mjs';

const newBatch = () => ({ choice: null, declined: false, noFolder: false });
const request = (over = {}) => ({ file: pdf('export.pdf'), name: 'Facture.pdf', app: 'publipostage', appName: 'Publipostage+', folder: '', repeat: false, batch: newBatch(), ...over });
const quiet = async run => { const warn = console.warn; console.warn = () => {}; try { return await run(); } finally { console.warn = warn; } };

async function refusedWith(promise, code, message) {
  await assert.rejects(promise, error => error instanceof Refus && error.code === code && (message === undefined || error.message === message));
}

// Un nom déjà pris : le magasin appelle `decide` (comme FilesStore.add) avec le fichier existant et le nom de la copie, et fait ce que la décision dit.
const existing = { id: 'xx', name: 'Facture.pdf', ts: 1761000000, by: 'auteur@example.com' };
const taken = async options => {
  const choice = await options.decide(existing, 'Facture (1).pdf');
  if (choice === null) return null;
  return choice === 'replace' ? { status: 'replaced', id: 'xx', name: 'Facture.pdf', row: 1 } : { status: 'added', id: 'nn', name: 'Facture (1).pdf', row: 2 };
};

test('GFS n\'écrit rien sans l\'accès complet ni dans un document en lecture seule : le code dit lequel, la phrase est celle de l\'explorateur', async () => {
  const noAccess = setup({ fullAccess: false });
  await refusedWith(noAccess.kept.deposit(request()), ERR.ACCES, FR.t('gfs.needsFullAccess'));
  const readonly = setup({ readonly: true });
  await refusedWith(readonly.kept.deposit(request()), ERR.LECTURE_SEULE, FR.t('files.readonly'));
  assert.deepEqual([noAccess.log.adds, readonly.log.adds], [[], []]);
});

test('un fichier vide ou qui ne commence pas comme un PDF est refusé (GFS_REFUSE) avant tout envoi, avec la phrase de l\'import', async () => {
  const run = setup();
  await refusedWith(run.kept.deposit(request({ file: pdf('x.pdf', '') })), ERR.REFUSE, FR.t('files.empty', { name: 'Facture.pdf' }));
  await refusedWith(run.kept.deposit(request({ file: pdf('x.pdf', 'PK\u0003\u0004 un classeur') })), ERR.REFUSE, FR.t('files.notPdf', { name: 'Facture.pdf' }));
  assert.deepEqual(run.log.adds, []);
  const en = setup({ i18n: EN });
  await refusedWith(en.kept.deposit(request({ file: pdf('x.pdf', '') })), ERR.REFUSE, EN.t('files.empty', { name: 'Facture.pdf' }));
});

test('le fichier est rangé sous son nom, avec l\'identifiant de l\'app dans « Origine » ; GFS ne dit rien à la personne et ne relit pas la liste (l\'app rend compte)', async () => {
  const { kept, log } = setup();
  const sent = pdf('export.pdf');
  const result = await kept.deposit(request({ file: sent }));
  assert.deepEqual(result, { status: 'added', id: 'aa', name: 'Facture.pdf' });
  assert.equal(log.adds.length, 1);
  assert.deepEqual([log.adds[0].file === sent, log.adds[0].name, log.adds[0].origin], [true, 'Facture.pdf', 'publipostage']);
  assert.deepEqual([log.notices, log.refreshes], [[], 0]);
});

test('les issues : remplacé, ajouté sous un autre nom (copie), ajouté sous son nom, renoncé (skipped, sans identifiant ni nom)', async () => {
  const replaced = setup({ add: async () => ({ status: 'replaced', id: 'xx', name: 'Facture.pdf', row: 1 }) });
  assert.deepEqual(await replaced.kept.deposit(request()), { status: 'replaced', id: 'xx', name: 'Facture.pdf' });
  const copied = setup({ add: async () => ({ status: 'added', id: 'nn', name: 'Facture (1).pdf', row: 2 }) });
  assert.deepEqual(await copied.kept.deposit(request()), { status: 'copied', id: 'nn', name: 'Facture (1).pdf' });
  const skipped = setup({ add: async () => null });
  assert.deepEqual(await skipped.kept.deposit(request()), { status: 'skipped', id: null, name: null });
});

test('un fichier nouveau va dans le dossier que l\'app donne ; un fichier remplacé garde sa place ; sans dossier, rien n\'est rangé', async () => {
  const inFolder = setup();
  await inFolder.kept.deposit(request({ folder: 'Factures/2026' }));
  assert.deepEqual(inFolder.log.filings, [[{ app: 'gfs-fichiers', file: 'aa', pinned: false, folder: 'Factures/2026' }]]);
  const copy = setup({ add: async () => ({ status: 'added', id: 'nn', name: 'Facture (1).pdf', row: 2 }) });
  await copy.kept.deposit(request({ folder: 'Factures' }));
  assert.equal(copy.log.filings.length, 1, 'la copie est un fichier nouveau : elle va dans le dossier');
  const replaced = setup({ add: async () => ({ status: 'replaced', id: 'xx', name: 'Facture.pdf', row: 1 }) });
  await replaced.kept.deposit(request({ folder: 'Factures' }));
  const root = setup();
  await root.kept.deposit(request());
  assert.deepEqual([replaced.log.filings, root.log.filings], [[], []]);
});

test('le dossier du dépôt n\'est pas celui que la personne a ouvert dans l\'explorateur', async () => {
  const { kept, log } = setup({ folder: 'Autre' });
  await kept.deposit(request({ folder: 'Factures' }));
  await kept.deposit(request());
  assert.deepEqual(log.filings.map(entries => entries[0].folder), ['Factures']);
});

test('le rangement refusé (la table du rangement) : le fichier est gardé, l\'app n\'a pas d\'erreur, et le même lot n\'est plus interrogé', async () => {
  const run = setup({ setFiling: async () => { throw new TableDeclined('GFS_Rangement'); } });
  const batch = newBatch();
  assert.equal((await run.kept.deposit(request({ folder: 'A', batch }))).status, 'added');
  assert.equal(batch.noFolder, true);
  assert.equal((await run.kept.deposit(request({ folder: 'A', batch }))).status, 'added');
  assert.equal(run.log.filings.length, 1, 'la table du rangement n\'est demandée qu\'une fois pour le lot');
  assert.deepEqual(run.log.notices, [], 'GFS ne parle pas par-dessus l\'app');
});

test('le rangement en échec (autre cause) : le fichier est gardé, l\'avertissement est dans la console, le lot continue de ranger les suivants', async () => {
  const run = setup({ setFiling: async () => { throw new Error('refusé par Grist'); } });
  const batch = newBatch();
  const warnings = [];
  const warn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    assert.equal((await run.kept.deposit(request({ folder: 'A', batch }))).status, 'added');
    assert.equal((await run.kept.deposit(request({ folder: 'A', batch }))).status, 'added');
  } finally { console.warn = warn; }
  assert.equal(batch.noFolder, false);
  assert.equal(run.log.filings.length, 2);
  assert.equal(warnings.length, 2);
});

test('la table GFS_Fichiers refusée : GFS_ANNULE, et le reste du lot est refusé tout de suite, sans redemander la table', async () => {
  const run = setup({ add: async () => { throw new TableDeclined('GFS_Fichiers'); } });
  const batch = newBatch();
  await refusedWith(run.kept.deposit(request({ batch })), ERR.ANNULE, FR.t('files.declined'));
  assert.equal(batch.declined, true);
  await refusedWith(run.kept.deposit(request({ batch })), ERR.ANNULE, FR.t('files.declined'));
  assert.equal(run.log.adds.length, 1, 'le second fichier ne rouvre pas la question');
  const another = setup({ add: async () => { throw new TableDeclined('GFS_Fichiers'); } });
  await refusedWith(another.kept.deposit(request()), ERR.ANNULE);
  await refusedWith(another.kept.deposit(request()), ERR.ANNULE);
  assert.equal(another.log.adds.length, 2, 'sans lot, chaque fichier est seul : la question revient');
});

test('un envoi qui échoue : GFS_ECHEC, avec la phrase des fichiers (la raison en mots, dans la langue de la personne) ; une autre erreur aussi', async () => {
  await quiet(async () => {
    const tooBig = setup({ add: async () => { throw new TransferError('http', 'Payload Too Large', 413); } });
    await refusedWith(tooBig.kept.deposit(request()), ERR.ECHEC, FR.t('files.failed', { name: 'Facture.pdf', reason: FR.t('files.err.tooBig') }));
    const down = setup({ add: async () => { throw new TransferError('network', 'Failed to fetch'); }, i18n: EN });
    await refusedWith(down.kept.deposit(request()), ERR.ECHEC, EN.t('files.failed', { name: 'Facture.pdf', reason: EN.t('files.err.network') }));
    const other = setup({ add: async () => { throw new Error('ACL refuse l\'ajout'); } });
    await refusedWith(other.kept.deposit(request()), ERR.ECHEC, FR.t('files.failed', { name: 'Facture.pdf', reason: 'ACL refuse l\'ajout' }));
  });
});

test('un nom pris : la fenêtre nomme l\'app, offre la case quand le lot continue, décrit le fichier existant, et dit le nom de la copie', async () => {
  const asked = [];
  const conflict = async options => { asked.push(options); return { choice: 'both', again: false }; };
  const run = setup({ add: taken, conflict });
  assert.deepEqual(await run.kept.deposit(request({ repeat: true })), { status: 'copied', id: 'nn', name: 'Facture (1).pdf' });
  const [window] = asked;
  assert.deepEqual([window.app, window.repeat, window.name, window.copy], ['Publipostage+', true, 'Facture.pdf', 'Facture (1).pdf']);
  assert.match(window.detail, /auteur/);
  assert.equal(typeof window.t, 'function');
  await run.kept.deposit(request());
  assert.equal(asked[1].repeat, false, 'un dépôt isolé n\'offre pas la case');
});

test('« Faire pareil pour les suivants » : la réponse cochée vaut pour les noms pris suivants du lot, sans fenêtre', async () => {
  for (const choice of ['replace', 'both']) {
    let windows = 0;
    const run = setup({ add: taken, conflict: async () => { windows += 1; return { choice, again: true }; } });
    const batch = newBatch();
    const statuses = [];
    for (let i = 0; i < 3; i += 1) statuses.push((await run.kept.deposit(request({ repeat: true, batch }))).status);
    const expected = choice === 'replace' ? 'replaced' : 'copied';
    assert.deepEqual(statuses, [expected, expected, expected]);
    assert.equal(windows, 1, 'la fenêtre ne revient pas');
    assert.equal(batch.choice, choice);
  }
});

test('« Annuler » avec la case cochée : tous les noms pris suivants du lot sont passés, les fichiers sans conflit sont rangés', async () => {
  let windows = 0;
  const fresh = { status: 'added', id: 'zz', name: 'Autre.pdf', row: 3 };
  const run = setup({ add: options => (options.name === 'Facture.pdf' ? taken(options) : fresh), conflict: async () => { windows += 1; return { choice: 'skip', again: true }; } });
  const batch = newBatch();
  const done = [];
  for (const name of ['Facture.pdf', 'Autre.pdf', 'Facture.pdf']) done.push((await run.kept.deposit(request({ name, repeat: true, batch }))).status);
  assert.deepEqual(done, ['skipped', 'added', 'skipped']);
  assert.equal(windows, 1);
  assert.equal(batch.choice, 'skip');
});

test('sans la case cochée, la fenêtre revient à chaque nom pris ; les réponses se suivent', async () => {
  const answers = ['replace', 'both', 'skip'];
  let windows = 0;
  const run = setup({ add: taken, conflict: async () => ({ choice: answers[windows++], again: false }) });
  const batch = newBatch();
  const statuses = [];
  for (let i = 0; i < 3; i += 1) statuses.push((await run.kept.deposit(request({ repeat: true, batch }))).status);
  assert.deepEqual(statuses, ['replaced', 'copied', 'skipped']);
  assert.equal(windows, 3);
  assert.equal(batch.choice, null);
});

test('l\'import par la personne ne change pas : la fenêtre ne nomme aucune app, n\'offre pas la case, et « renoncer » rend null au magasin', async () => {
  const asked = [];
  const run = setup({ add: taken, conflict: async options => { asked.push(options); return { choice: 'skip', again: true }; } });
  await run.importing(pdf('Facture.pdf'));
  assert.equal(asked.length, 1);
  assert.deepEqual([asked[0].app, asked[0].repeat], [undefined, undefined]);
  assert.deepEqual(run.log.notices, [], 'renoncer ne dit rien (rien n\'a été fait)');
  const kept = setup({ add: taken, conflict: async () => ({ choice: 'replace', again: false }) });
  await kept.importing(pdf('Facture.pdf'));
  assert.deepEqual(kept.log.notices, [FR.t('files.replaced', { name: 'Facture.pdf' })]);
});

test('le contenu du fichier n\'est lu que pour son début : un gros fichier ne passe pas en mémoire pour la vérification', async () => {
  let sliced = null;
  const file = pdf('export.pdf', PDF_BYTES);
  const slice = file.slice.bind(file);
  file.slice = (...args) => { sliced = args; return slice(...args); };
  await setup().kept.deposit(request({ file }));
  assert.deepEqual(sliced, [0, 1024]);
});
