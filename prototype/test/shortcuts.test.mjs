// Les raccourcis de fichiers dans « Moi » (js/files/shortcuts.js, js/explorer/shortcut-gestures.js ; demande du porteur, 27/11) : ce qu'une ligne du rangement dit
// d'un raccourci, ce que la liste en montre (ok ou grisé), les actions écrites, et les gestes (créer, renommer, retirer, avec Ctrl+Z et Ctrl+Y). Ce que Grist fait
// vraiment de ces lignes (les règles du rangement, la lecture d'une autre personne) se mesure dans le labo (labo/run-raccourcis.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHORTCUT_APP, addActions, newShortcutId, originOf, readShortcuts, removeActions, renameActions, shortcutFiles, shortcutKey } from '../js/files/shortcuts.js';
import { ShortcutGestures } from '../js/explorer/shortcut-gestures.js';
import { UndoStack } from '../js/files/undo-stack.js';
import { createI18n } from '../js/i18n/i18n.js';

const { t } = createI18n('fr');
const ME = 'moi@exemple.org';
const file = (id, extra = {}) => ({ key: `gfs-fichiers:${id}`, app: 'gfs-fichiers', id, name: `Fichier ${id}.pdf`, type: 'pdf', typeInfo: { valeur: 'pdf' }, known: true, family: 'pdf',
  icon: 'pdf', ts: 100, by: 'marc@exemple.org', folder: '', pinned: false, weight: 5000, pieces: [['p', 5000]], trashed: null, ...extra });
const line = (id, value, extra = {}) => ({ User: ME, App: SHORTCUT_APP, File: id, Folder: '', Value: JSON.stringify(value), ...extra });
// La table du rangement telle que `fetchTable` la rend, d'après des lignes.
const tableOf = rows => ({ id: rows.map((row, i) => i + 1), ...Object.fromEntries(['User', 'App', 'File', 'Folder', 'Value'].map(column => [column, rows.map(row => row[column])])) });

test('readShortcuts : les raccourcis de la personne seule, une ligne sans cible lisible n\'en est pas un', () => {
  const data = tableOf([
    line('s1', { target: 'gfs-fichiers:a', name: 'Contrat', type: 'pdf' }, { Folder: ' Clients // ACME ' }),
    line('s2', { target: 'gfs-fichiers:b' }, { User: 'autre@exemple.org' }),
    line('s3', 'pas du JSON'),
    line('s4', { name: 'sans cible' }),
    { User: ME, App: 'gfs-fichiers', File: 'x', Folder: 'Z', Value: '' },
    line('s1', { target: 'gfs-fichiers:doublon' }),
  ]);
  assert.deepEqual(readShortcuts(data, ME), [{ id: 's1', row: 1, folder: 'Clients/ACME', target: 'gfs-fichiers:a', name: 'Contrat', type: 'pdf' }]);
  assert.deepEqual(readShortcuts(null, ME), []);
  assert.deepEqual(readShortcuts(data, ''), []);
});

test('shortcutFiles : la cible lue donne une ligne du même type, qui ne pèse rien ; une cible qu\'on ne lit pas donne une ligne grisée', () => {
  const rows = [{ id: 's1', row: 1, folder: 'Clients', target: 'gfs-fichiers:a', name: 'Contrat', type: 'pdf' }, { id: 's2', row: 2, folder: '', target: 'gfs-fichiers:z', name: 'Perdu', type: 'pdf' }];
  const [ok, gone] = shortcutFiles(rows, [file('a')]);
  assert.deepEqual([ok.key, ok.app, ok.id, ok.name, ok.folder, ok.icon, ok.weight, ok.pinned, ok.shortcut], [shortcutKey('s1'), SHORTCUT_APP, 's1', 'Contrat', 'Clients', 'shortcut', 0, false, { target: 'gfs-fichiers:a', state: 'ok' }]);
  assert.deepEqual([ok.type, ok.family, ok.by, ok.known], ['pdf', 'pdf', 'marc@exemple.org', true]);
  assert.deepEqual([gone.shortcut, gone.known, gone.family, gone.name, gone.weight], [{ target: 'gfs-fichiers:z', state: 'missing' }, false, '', 'Perdu', 0]);
  assert.equal(shortcutFiles([], [file('a')]).length, 0);
});

test('shortcutFiles : un raccourci sans nom prend celui de la cible ; il ne porte ni « direct », ni espace, ni arrivée de sa cible', () => {
  const target = file('a', { direct: { by: 'marc@exemple.org' }, space: { key: 'achats' }, received: { state: 'accepted' }, linked: [1] });
  const [one] = shortcutFiles([{ id: 's1', row: 1, folder: '', target: target.key, name: '', type: '' }], [target]);
  assert.deepEqual([one.name, one.direct, one.space, one.received, one.linked], ['Fichier a.pdf', undefined, undefined, undefined, undefined]);
});

test('shortcutFiles : une cible à la corbeille, ou d\'un autre type que celui d\'avant (la ligne réutilisée), grise le raccourci ; un partage retiré aussi', () => {
  const row = { id: 's1', row: 1, folder: '', target: 'gfs-fichiers:a', name: 'Contrat', type: 'pdf' };
  assert.equal(shortcutFiles([row], [file('a', { trashed: { ts: 1 } })])[0].shortcut.state, 'missing');
  assert.equal(shortcutFiles([row], [file('a', { type: 'document' })])[0].shortcut.state, 'missing');
  assert.equal(shortcutFiles([row], [])[0].shortcut.state, 'missing');
  assert.equal(shortcutFiles([row], [file('a')])[0].shortcut.state, 'ok');
  assert.equal(shortcutFiles([{ ...row, type: '' }], [file('a', { type: 'document' })])[0].shortcut.state, 'ok', 'sans type noté à la création, rien à comparer');
});

test('shortcutFiles : une arrivée d\'un autre document se vise une fois acceptée, jamais avant ni après un refus', () => {
  const arrival = state => file('t:1', { key: 'gfs-recus:GFS_Recus:1', app: 'gfs-recus', received: { state } });
  const row = { id: 's1', row: 1, folder: '', target: 'gfs-recus:GFS_Recus:1', name: 'Reçu', type: 'pdf' };
  assert.equal(shortcutFiles([row], [], [arrival('accepted')])[0].shortcut.state, 'ok');
  assert.equal(shortcutFiles([row], [], [arrival('pending')])[0].shortcut.state, 'missing');
  assert.equal(shortcutFiles([row], [], [arrival('refused')])[0].shortcut.state, 'missing');
});

test('originOf : « Partagés avec moi » pour une arrivée ou un fichier donné jamais rangé, sinon le dossier de la cible', () => {
  assert.deepEqual(originOf(file('a', { received: { state: 'accepted' } })), { view: 'shared', path: '' });
  assert.deepEqual(originOf(file('a', { direct: { by: 'x' }, folder: '' })), { view: 'shared', path: '' });
  assert.deepEqual(originOf(file('a', { direct: { by: 'x' }, folder: 'Clients' })), { view: 'folder', path: 'Clients' });
  assert.deepEqual(originOf(file('a', { folder: 'Espaces/Achats/Contrats' })), { view: 'folder', path: 'Espaces/Achats/Contrats' });
});

test('les actions : ajouter écrit la ligne de la personne, ajouter deux fois met à jour, retirer et renommer ne touchent que ce raccourci', () => {
  const row = { id: 's1', folder: ' A // B ', target: 'gfs-fichiers:a', name: 'Contrat', type: 'pdf' };
  const empty = { data: tableOf([]), tableId: 'GFS_Filing', identity: ME };
  assert.deepEqual(addActions(empty, row), [['AddRecord', 'GFS_Filing', null, { User: ME, App: SHORTCUT_APP, File: 's1', Favorite: false, Folder: 'A/B',
    Value: JSON.stringify({ target: 'gfs-fichiers:a', name: 'Contrat', type: 'pdf' }) }]]);
  const data = tableOf([line('s1', { target: 'gfs-fichiers:a', name: 'Contrat', type: 'pdf' }), line('s2', { target: 'gfs-fichiers:b', name: 'Autre', type: 'pdf' }),
    line('s1', { target: 'gfs-fichiers:a', name: 'Pas le mien' }, { User: 'autre@exemple.org' })]);
  const ctx = { data, tableId: 'GFS_Filing', identity: ME };
  assert.equal(addActions(ctx, row)[0][0], 'UpdateRecord');
  assert.deepEqual(removeActions(ctx, 's1'), [['RemoveRecord', 'GFS_Filing', 1]]);
  assert.deepEqual(removeActions(ctx, 'absent'), []);
  assert.deepEqual(renameActions(ctx, 's2', 'Neuf'), [['UpdateRecord', 'GFS_Filing', 2, { Value: JSON.stringify({ target: 'gfs-fichiers:b', name: 'Neuf', type: 'pdf' }) }]]);
  assert.deepEqual(renameActions(ctx, 'absent', 'Neuf'), []);
});

test('newShortcutId : deux numéros ne se confondent pas', () => {
  const ids = new Set(Array.from({ length: 200 }, () => newShortcutId()));
  assert.equal(ids.size, 200);
  assert.match(newShortcutId(0, () => 0), /^s0{5}$/);
});

// Une doublure de tout ce que le contrôleur donne : le rangement garde les lignes, la liste relue en part.
function harness({ files = [file('a')], block = null, identity = ME, answers = [], here = '' } = {}) {
  const log = { notices: [], windows: [], refreshes: [], failures: [] };
  const rows = [];
  const answer = kind => async opts => { log.windows.push({ kind, ...opts }); return answers.shift() ?? null; };
  const rangement = {
    get identity() { return identity; },
    writeShortcuts: async make => {
      const actions = make({ data: tableOf(rows), tableId: 'GFS_Filing', identity });
      if (!identity || !actions.length) return false;
      for (const [kind, , id, values] of actions) {
        if (kind === 'AddRecord') rows.push({ ...values });
        if (kind === 'UpdateRecord') Object.assign(rows[id - 1], { ...values, ...(values.Value ? { Value: values.Value } : {}) });
        if (kind === 'RemoveRecord') rows.splice(id - 1, 1);
      }
      return true;
    },
  };
  const undoStack = new UndoStack({ t, notice: text => log.notices.push(text) });
  let queue = Promise.resolve();
  const gestures = new ShortcutGestures({
    rangement, t, notice: text => log.notices.push(text), writeBlock: () => block, files: () => files, folders: () => ['Vide'], locale: () => 'fr', here: () => here,
    windows: { name: answer('name'), folder: answer('folder') }, queue: task => { queue = queue.then(task); return queue; }, undoStack,
    refresh: async opts => { log.refreshes.push(opts); },
  });
  return { gestures, log, rows, undoStack };
}

test('créer : le dossier se choisit dans « Moi » (jamais un espace), la ligne est écrite, la liste est relue sans bruit, la phrase dit que le fichier reste', async () => {
  const { gestures, log, rows } = harness({ files: [file('a', { folder: 'Clients' }), file('b', { folder: 'Espaces/Achats' })], answers: ['Clients/ACME'] });
  assert.equal(await gestures.create(file('a', { folder: 'Clients' })), true);
  assert.deepEqual(log.windows[0].folders, ['Clients', 'Vide']);
  assert.equal(log.windows[0].title, t('sc.pick.title', { name: 'Fichier a.pdf' }));
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].User, rows[0].App, rows[0].Folder, JSON.parse(rows[0].Value)], [ME, SHORTCUT_APP, 'Clients/ACME', { target: 'gfs-fichiers:a', name: 'Fichier a.pdf', type: 'pdf' }]);
  assert.deepEqual(log.refreshes, [{ quiet: true }]);
  assert.deepEqual(log.notices, [t('sc.done', { name: 'Fichier a.pdf', folder: 'Clients / ACME' })]);
});

test('créer : un nouveau dossier se nomme depuis le dossier ouvert de « Moi », jamais depuis un espace', async () => {
  const inMe = harness({ here: 'Clients', answers: [null] });
  await inMe.gestures.create(file('a'));
  assert.equal(inMe.log.windows[0].base, 'Clients');
  const inSpace = harness({ here: 'Espaces/Achats', answers: [null] });
  await inSpace.gestures.create(file('a'));
  assert.equal(inSpace.log.windows[0].base, '');
});

test('créer : la personne renonce (Échap) : rien n\'est écrit ; un raccourci d\'un raccourci et une arrivée à accepter sont refusés avec leur phrase', async () => {
  const quit = harness({ answers: [null] });
  assert.equal(await quit.gestures.create(file('a')), false);
  assert.deepEqual([quit.rows, quit.log.notices], [[], []]);
  const again = harness();
  assert.equal(await again.gestures.create(file('a', { shortcut: { state: 'ok' } })), false);
  assert.equal(again.gestures.whyNot(file('a', { received: { state: 'pending' } })), t('sc.why.pending'));
  assert.equal(again.gestures.whyNot(file('a', { received: { state: 'accepted' } })), null);
  assert.deepEqual([again.log.windows, again.log.notices], [[], [t('sc.why.shortcut')]]);
});

test('lecture seule : rien ne s\'écrit, aucune fenêtre ne s\'ouvre, la phrase le dit ; sans adresse connue, la phrase le dit aussi', async () => {
  const locked = harness({ block: t('mod.readonly') });
  assert.equal(await locked.gestures.create(file('a')), false);
  assert.deepEqual([locked.log.windows, locked.rows, locked.log.notices], [[], [], [t('mod.readonly')]]);
  const unknown = harness({ identity: '', answers: [''] });
  assert.equal(await unknown.gestures.create(file('a')), false);
  assert.deepEqual([unknown.rows, unknown.log.notices], [[], [t('sc.noAddress')]]);
});

test('renommer : seul le nom du raccourci change (le fichier visé garde le sien), un nom vide est refusé par la fenêtre, le même nom n\'écrit rien', async () => {
  const { gestures, log, rows } = harness({ answers: ['Clients', 'Devis', 'Devis'] });
  await gestures.create(file('a'));
  const made = () => shortcutFiles(readShortcuts(tableOf(rows), ME), [file('a')])[0];
  assert.equal(await gestures.rename(made()), true);
  assert.deepEqual([JSON.parse(rows[0].Value).name, JSON.parse(rows[0].Value).target], ['Devis', 'gfs-fichiers:a']);
  const window = log.windows.at(-1);
  assert.equal(window.refuse(''), t('ex.nameEmpty'));
  assert.equal(window.refuse('Devis'), null);
  assert.equal(await gestures.rename(made()), false, 'le même nom : rien n\'est écrit');
});

test('retirer : la ligne s\'en va, le fichier visé n\'est pas touché, la phrase le dit', async () => {
  const { gestures, log, rows } = harness({ answers: ['Clients'] });
  await gestures.create(file('a'));
  log.notices.length = 0;
  const entry = shortcutFiles(readShortcuts(tableOf(rows), ME), [file('a')])[0];
  assert.equal(await gestures.remove(entry), true);
  assert.deepEqual([rows, log.notices], [[], [t('sc.removed', { name: 'Fichier a.pdf' })]]);
});

test('Ctrl+Z défait la création, Ctrl+Y la refait ; Ctrl+Z défait le retrait et le raccourci revient avec son nom et sa cible', async () => {
  const { gestures, log, rows, undoStack } = harness({ answers: ['Clients'] });
  await gestures.create(file('a'));
  const entry = () => shortcutFiles(readShortcuts(tableOf(rows), ME), [file('a')])[0];
  log.notices.length = 0;
  assert.equal(await undoStack.undo(), true);
  assert.deepEqual([rows.length, log.notices], [0, [t('undo.shortcutCreated', { name: 'Fichier a.pdf' })]]);
  assert.equal(await undoStack.redo(), true);
  assert.equal(rows.length, 1);
  assert.equal(log.notices.at(-1), t('redo.shortcutCreated', { name: 'Fichier a.pdf' }));
  const kept = entry();
  await gestures.remove(kept);
  assert.equal(rows.length, 0);
  await undoStack.undo();
  assert.deepEqual([rows.length, JSON.parse(rows[0].Value).target, rows[0].Folder], [1, 'gfs-fichiers:a', 'Clients']);
  assert.equal(log.notices.at(-1), t('undo.shortcutRemoved', { name: 'Fichier a.pdf' }));
});

test('lockOf et typeLabel : une cible qu\'on ne lit plus donne un cadenas et le mot « Raccourci » ; sinon le mot « Raccourci · PDF » et pas de cadenas', () => {
  const { gestures } = harness();
  const [ok, gone] = shortcutFiles([{ id: 's1', row: 1, folder: '', target: 'gfs-fichiers:a', name: 'A', type: 'pdf' }, { id: 's2', row: 2, folder: '', target: 'x', name: 'B', type: 'pdf' }], [file('a')]);
  assert.equal(gestures.lockOf(ok), null);
  assert.equal(gestures.lockOf(gone).text, t('sc.missing'));
  assert.equal(gestures.typeLabel(ok, () => 'PDF'), 'Raccourci · PDF');
  assert.equal(gestures.typeLabel(gone, () => 'PDF'), 'Raccourci');
});

test('une version de GFS qui ne connaît pas les raccourcis lit le même rangement sans en être gênée : la ligne n\'est ni un fichier ni un dossier gardé', async () => {
  const { readGfsFiling, readGfsFolders, applyFiling } = await import('../js/explorer/explorer-model.js');
  const data = { ...tableOf([line('s1', { target: 'gfs-fichiers:a', name: 'Contrat', type: 'pdf' }, { Folder: 'Clients' })]), Favorite: [false] };
  const filing = readGfsFiling(data, ME);
  const [only] = applyFiling([file('a', { folder: 'A' })], null, filing);
  assert.deepEqual([only.folder, only.pinned], ['A', false], 'le fichier visé garde son dossier : la ligne du raccourci ne lui est pas appliquée');
  assert.equal(readGfsFolders(data, ME).includes('Clients'), false, 'le dossier du raccourci n\'est pas un dossier « gardé » : il existe tant qu\'un raccourci y est');
});
