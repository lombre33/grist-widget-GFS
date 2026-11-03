// Les fichiers que GFS garde, côté personne (js/kept-files.js, contrats 6.6) : l'article « PDF » du sous-menu « Importer » (grisé avec sa raison), les vérifications du fichier choisi, les phrases
// qui disent ce qui s'est passé, le rangement dans le dossier ouvert, le téléchargement. Les fenêtres (nom pris, confirmation) et le vrai sélecteur de fichier se jouent dans le labo,
// avec une vraie souris (labo/run-pdf.mjs) ; ici le magasin de données, le sélecteur et le rangement sont des doublures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveBlob } from '../js/kept-files.js';
import { FR, EN, PDF_BYTES, entryOf, fakeDoc, setup, pdf } from './kept-setup.mjs';
import { TransferError } from '../js/transfer.js';
import { TableDeclined } from '../js/own-table.js';

test('l\'article « PDF » de « Importer » : l\'icône et le mot du type ensemble, sans couleur de famille, avec ce que GFS en fait', () => {
  const { kept } = setup();
  const [entry] = kept.importEntries();
  assert.deepEqual([entry.app, entry.label, entry.icon, entry.family, entry.greyed, entry.extensions, entry.valeur], ['gfs-fichiers', 'PDF', 'pdf', null, false, ['.pdf'], 'pdf']);
  assert.equal(entry.hint, FR.t('files.import.hint'));
  assert.equal(setup({ i18n: EN }).kept.importEntries()[0].hint, EN.t('files.import.hint'));
});

test('grisé, jamais masqué : sans l\'accès complet ou en lecture seule, l\'article est là avec sa raison', () => {
  const noAccess = setup({ fullAccess: false }).kept.importEntries()[0];
  assert.deepEqual([noAccess.greyed, noAccess.reason, noAccess.hint], [true, FR.t('gfs.needsFullAccess'), FR.t('gfs.needsFullAccessHint')]);
  const readonly = setup({ readonly: true }).kept.importEntries()[0];
  assert.deepEqual([readonly.greyed, readonly.reason, readonly.hint], [true, FR.t('files.readonly'), FR.t('files.readonlyHint')]);
});

test('un article grisé n\'ouvre pas le sélecteur : la raison est dite', async () => {
  const { kept, log } = setup({ readonly: true });
  await kept.importFile(kept.importEntries()[0]);
  assert.deepEqual(log.notices, [FR.t('files.readonly')]);
  assert.equal(log.doc.appended.length, 0);
});

test('le sélecteur s\'ouvre dans le geste (avant tout await) et n\'accepte que les .pdf', () => {
  const { kept, log } = setup();
  void kept.importFile(kept.importEntries()[0]);
  const [input] = log.doc.appended;
  assert.deepEqual([input.type, input.accept, input.clicks], ['file', '.pdf', 1]);
});

test('un PDF choisi : le magasin le reçoit sous son nom, la phrase le dit, la liste est relue', async () => {
  const { importing, log } = setup();
  await importing(pdf('Facture.pdf'));
  assert.equal(log.adds.length, 1);
  assert.deepEqual([log.adds[0].name, log.adds[0].file.name], ['Facture.pdf', 'Facture.pdf']);
  assert.deepEqual(log.notices, [FR.t('files.added', { name: 'Facture.pdf' })]);
  assert.equal(log.refreshes, 1);
});

test('annuler le sélecteur : rien ne se passe', async () => {
  const { importing, log } = setup();
  await importing(null);
  assert.deepEqual([log.adds, log.notices, log.refreshes], [[], [], 0]);
});

test('un fichier qui n\'est pas un .pdf, un fichier vide, un « .pdf » qui n\'en est pas un : dits, sans rien envoyer', async () => {
  const wrong = setup();
  await wrong.importing(new File([PDF_BYTES], 'notes.txt'));
  assert.deepEqual(wrong.log.notices, [FR.t('ex.import.wrong', { name: 'notes.txt', format: 'PDF', extensions: '.pdf' })]);
  const empty = setup();
  await empty.importing(pdf('Vide.pdf', ''));
  assert.deepEqual(empty.log.notices, [FR.t('files.empty', { name: 'Vide.pdf' })]);
  const fake = setup();
  await fake.importing(pdf('Classeur.pdf', 'PK\u0003\u0004 un classeur renommé'));
  assert.deepEqual(fake.log.notices, [FR.t('files.notPdf', { name: 'Classeur.pdf' })]);
  for (const run of [wrong, empty, fake]) assert.deepEqual(run.log.adds, []);
});

test('le nom du fichier choisi est gardé tel quel, « .PDF » en capitales compris : rien n\'est ajouté à une extension qui y est déjà', async () => {
  const { importing, log } = setup();
  await importing(new File([PDF_BYTES], 'rapport.PDF'));
  assert.equal(log.adds[0].name, 'rapport.PDF');
});

test('les trois issues sont dites : remplacé, ajouté sous un autre nom, annulé (rien)', async () => {
  const replaced = setup({ add: async () => ({ status: 'replaced', id: 'aa', name: 'Facture.pdf', row: 1 }) });
  await replaced.importing(pdf());
  assert.deepEqual(replaced.log.notices, [FR.t('files.replaced', { name: 'Facture.pdf' })]);
  const copied = setup({ add: async () => ({ status: 'added', id: 'bb', name: 'Facture (1).pdf', row: 2 }) });
  await copied.importing(pdf());
  assert.deepEqual(copied.log.notices, [FR.t('files.copied', { name: 'Facture (1).pdf' })]);
  const cancelled = setup({ add: async () => null });
  await cancelled.importing(pdf());
  assert.deepEqual([cancelled.log.notices, cancelled.log.refreshes], [[], 1]);
});

test('le dossier ouvert reçoit le nouveau fichier (rangement de la personne) ; un fichier remplacé garde sa place ; sans dossier ouvert, rien n\'est rangé', async () => {
  const inFolder = setup({ folder: 'Factures/2026' });
  await inFolder.importing(pdf());
  assert.deepEqual(inFolder.log.filings, [[{ app: 'gfs-fichiers', file: 'aa', pinned: false, folder: 'Factures/2026' }]]);
  const replaced = setup({ folder: 'Factures', add: async () => ({ status: 'replaced', id: 'aa', name: 'Facture.pdf', row: 1 }) });
  await replaced.importing(pdf());
  assert.deepEqual(replaced.log.filings, []);
  const root = setup();
  await root.importing(pdf());
  assert.deepEqual(root.log.filings, []);
});

test('le rangement dans le dossier refusé ou en échec : le fichier est gardé, la personne lit pourquoi', async () => {
  const declined = setup({ folder: 'A', setFiling: async () => { throw new TableDeclined('GFS_Rangement'); } });
  await declined.importing(pdf());
  assert.deepEqual(declined.log.notices.at(-1), FR.t('ex.filingDeclined'));
  const failed = setup({ folder: 'A', setFiling: async () => { throw new Error('refusé par Grist'); } });
  const warn = console.warn; console.warn = () => {};
  try { await failed.importing(pdf()); } finally { console.warn = warn; }
  assert.match(failed.log.notices.at(-1), /refusé par Grist/);
});

test('la table refusée : la phrase le dit ; un envoi qui échoue : le code du serveur est traduit en mots', async () => {
  const declined = setup({ add: async () => { throw new TableDeclined('GFS_Fichiers'); } });
  await declined.importing(pdf());
  assert.deepEqual(declined.log.notices, [FR.t('files.declined')]);
  const warn = console.warn; console.warn = () => {};
  try {
    const tooBig = setup({ add: async () => { throw new TransferError('http', 'Payload Too Large', 413); } });
    await tooBig.importing(pdf());
    assert.deepEqual(tooBig.log.notices, [FR.t('files.failed', { name: 'Facture.pdf', reason: FR.t('files.err.tooBig') })]);
    const down = setup({ add: async () => { throw new TransferError('network', 'Failed to fetch'); }, i18n: EN });
    await down.importing(pdf());
    assert.deepEqual(down.log.notices, [EN.t('files.failed', { name: 'Facture.pdf', reason: EN.t('files.err.network') })]);
  } finally { console.warn = warn; }
});

test('télécharger : le fichier est offert au navigateur sous son nom ; un échec est dit avec sa raison', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const ok = setup();
  await ok.kept.open({ id: 'aa', name: 'Facture.pdf' });
  assert.deepEqual(ok.log.notices, [FR.t('files.downloading', { name: 'Facture.pdf' }), FR.t('files.downloaded', { name: 'Facture.pdf' })]);
  const link = ok.log.doc.appended.at(-1);
  assert.deepEqual([link.download, link.clicks, link.removed, link.hidden], ['Facture.pdf', 1, true, true]);
  const warn = console.warn; console.warn = () => {};
  try {
    const gone = setup({ download: async () => { throw new TransferError('http', 'Not found', 404); } });
    await gone.kept.open({ id: 'aa', name: 'Facture.pdf' });
    assert.equal(gone.log.notices.at(-1), FR.t('files.downloadFailed', { name: 'Facture.pdf', reason: FR.t('files.err.gone') }));
    const unknown = setup({ download: async () => { throw new Error('Ce fichier n’est plus dans le document.'); } });
    await unknown.kept.open({ id: 'aa', name: 'Facture.pdf' });
    assert.match(unknown.log.notices.at(-1), /n’est plus dans le document/);
  } finally { console.warn = warn; }
});

test('supprimer sans pouvoir écrire : la raison est dite, aucune fenêtre', async () => {
  const { kept, log } = setup({ readonly: true });
  await kept.remove({ id: 'aa', name: 'Facture.pdf' });
  assert.deepEqual(log.notices, [FR.t('files.readonly')]);
});

test('ce que dit l\'explorateur d\'un fichier gardé : se télécharge, ne se copie pas encore', () => {
  const { kept } = setup();
  assert.equal(kept.has({ app: 'gfs-fichiers' }), true);
  assert.equal(kept.has({ app: 'publipostage' }), false);
  assert.deepEqual(kept.openAs({ app: 'gfs-fichiers' }), { label: FR.t('files.download'), icon: 'download', greyed: false });
  assert.equal(kept.opensIn({ app: 'gfs-fichiers' }), FR.t('files.opensIn'));
  assert.deepEqual(kept.extras({ app: 'gfs-fichiers' }), [], 'rien de plus : télécharger est déjà le geste principal');
  assert.equal(kept.copyNotice(), FR.t('files.noCopy'));
});

// Lire (js/reading.js, contrats 5.4 point 8) : quand une app du catalogue lit le PDF, « Lire » devient le geste principal, « Télécharger » passe dans le menu de la ligne.
const FILE = { app: 'gfs-fichiers', id: 'aa', name: 'Facture.pdf' };

test('une app lit le PDF et elle est prête : « Lire » est le geste, la barre dit où il s\'ouvre, « Télécharger » reste dans le menu', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { kept, log } = setup({ reader: () => ({ name: 'Publipostage+', lock: null }) });
  assert.deepEqual(kept.openAs(FILE), { label: FR.t('files.read'), icon: 'read', greyed: false });
  assert.equal(kept.opensIn(FILE), FR.t('ex.opensIn', { app: 'Publipostage+' }));
  const [extra, ...others] = kept.extras(FILE);
  assert.deepEqual([extra.label, extra.icon, others.length], [FR.t('files.download'), 'download', 0]);
  extra.run();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(log.notices, [FR.t('files.downloading', { name: 'Facture.pdf' }), FR.t('files.downloaded', { name: 'Facture.pdf' })], 'le menu télécharge vraiment');
});

test('grisé, jamais masqué : l\'app qui lit n\'est pas prête, « Lire » est là, grisé, et la barre dit pourquoi (au clic, ce qui la débloque)', () => {
  const lock = { text: 'Publipostage+ n’est pas installée : installe-la pour lire ce PDF.', focus: 'app:publipostage' };
  const { kept } = setup({ reader: () => ({ name: 'Publipostage+', lock }) });
  assert.deepEqual(kept.openAs(FILE), { label: FR.t('files.read'), icon: 'read', greyed: true });
  assert.equal(kept.opensIn(FILE), lock.text);
  assert.equal(kept.extras(FILE).length, 1, 'on peut toujours télécharger');
});

test('« Lire » et « Télécharger » se disent dans les deux langues', () => {
  const { kept } = setup({ i18n: EN, reader: () => ({ name: 'Publipostage+', lock: null }) });
  assert.deepEqual([kept.openAs(FILE).label, kept.extras(FILE)[0].label, kept.opensIn(FILE)], [EN.t('files.read'), EN.t('files.download'), EN.t('ex.opensIn', { app: 'Publipostage+' })]);
  assert.notEqual(EN.t('files.read'), FR.t('files.read'));
});

test('lire : GFS va chercher les octets, les rend en objet File au nom du fichier, et le dit', async () => {
  const bytes = new Blob([PDF_BYTES], { type: 'application/octet-stream' });
  const { kept, log } = setup({ download: async () => ({ blob: bytes, name: 'Facture.pdf' }) });
  const file = await kept.load(FILE);
  assert.ok(file instanceof File);
  assert.deepEqual([file.name, file.type, file.size], ['Facture.pdf', 'application/pdf', PDF_BYTES.length]);
  assert.equal(await file.text(), PDF_BYTES);
  assert.deepEqual(log.notices, [FR.t('files.reading', { name: 'Facture.pdf' })]);
  assert.deepEqual(log.doc.appended, [], 'lire n\'offre rien au navigateur : pas de téléchargement');
});

test('lire, le transfert échoue : rien n\'est ouvert (null), la raison est dite en mots, dans les deux langues', async () => {
  const warn = console.warn; console.warn = () => {};
  try {
    const gone = setup({ download: async () => { throw new TransferError('http', 'Not found', 404); } });
    assert.equal(await gone.kept.load(FILE), null);
    assert.equal(gone.log.notices.at(-1), FR.t('files.readFailed', { name: 'Facture.pdf', reason: FR.t('files.err.gone') }));
    const down = setup({ download: async () => { throw new TransferError('network', 'Failed to fetch'); }, i18n: EN });
    assert.equal(await down.kept.load(FILE), null);
    assert.equal(down.log.notices.at(-1), EN.t('files.readFailed', { name: 'Facture.pdf', reason: EN.t('files.err.network') }));
    const unknown = setup({ download: async () => { throw new Error('Ce fichier n’est plus dans le document.'); } });
    assert.equal(await unknown.kept.load(FILE), null);
    assert.match(unknown.log.notices.at(-1), /n’est plus dans le document/);
  } finally { console.warn = warn; }
});

test('saveBlob : un lien invisible, cliqué et retiré ; le nom garde son .pdf', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const doc = fakeDoc();
  saveBlob(doc, new Blob(['x']), 'Facture');
  const [link] = doc.appended;
  assert.deepEqual([link.download, link.clicks, link.removed], ['Facture.pdf', 1, true]);
  assert.match(link.href, /^blob:/);
  t.mock.timers.tick(60000);
});
