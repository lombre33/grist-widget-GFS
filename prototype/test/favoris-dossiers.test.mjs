// Les dossiers de « Moi » en favori (demande du porteur, 27/11 ; étude favoris-dossiers-espaces-27-11, lot 1) : la colonne « Favori » de la ligne d'état d'un dossier
// (contrats 6.4, point 11) se lit, s'écrit, se défait et se montre dans « Favoris ». Le faux Grist en mémoire (fake-grist.mjs) et des doublures remplacent Grist ;
// ce que Grist fait vraiment de ces écritures (une colonne « Favori » vraie sur une ligne d'état) se mesure dans un vrai Grist (labo/lab-dossier-moi.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDocument } from './fake-dom.mjs';
import { readGfsFolders, readGfsFolderRows, readGfsPinnedFolders, existingPinned, favoriteFolders, listItems } from '../js/explorer/explorer-model.js';
import { Rangement, TABLE } from '../js/files/rangement.js';
import { Filing } from '../js/explorer/filing.js';
import { Pending } from '../js/explorer/pending.js';
import { listSignature } from '../js/explorer/list-signature.js';
import { loadFiles } from '../js/explorer/explorer-data.js';
import { createI18n } from '../js/i18n/i18n.js';
import { fakeGrist } from './fake-grist.mjs';
import { publipostage } from './helpers.mjs';

installFakeDocument();
const { folderRow } = await import('../js/explorer/explorer-view.js');

const { t } = createI18n('fr');
const ANA = 'ana@exemple.org';
const BEN = 'ben@exemple.org';

// ---------- lire ----------

// La table du rangement telle que `fetchTable` la rend, d'après des lignes { User, App, File, Folder, Favorite }.
const table = lines => {
  const data = { id: [], User: [], App: [], File: [], Favorite: [], Folder: [] };
  lines.forEach((line, at) => {
    const row = { User: '', App: '', File: '', Favorite: false, Folder: '', ...line };
    data.id.push(at + 1);
    for (const column of ['User', 'App', 'File', 'Favorite', 'Folder']) data[column].push(row[column]);
  });
  return data;
};

test('lire : les dossiers en favori sont ceux dont la ligne d\'état de la personne a la colonne « Favori » vraie ; ni les fichiers, ni les lignes réservées, ni les autres', () => {
  const data = table([
    { User: ANA, Folder: 'Contrats', Favorite: true },
    { User: ANA, Folder: 'Archives', Favorite: false },
    { User: BEN, Folder: 'Contrats/2026', Favorite: true },
    { User: ANA, App: 'publipostage', File: '3', Folder: 'Contrats', Favorite: true },
    { User: '@document', Folder: 'Réservé', Favorite: true },
    { User: ANA, Folder: ' Factures // 2025/ ', Favorite: true },
    { User: ANA, Folder: '', Favorite: true },
    { User: ANA, Folder: 'Archives', Favorite: true },
    { User: ANA, Folder: 'Rien', Favorite: 'oui' },
  ]);
  assert.deepEqual(readGfsPinnedFolders(data, ANA), ['Contrats', 'Factures/2025', 'Archives'], 'une ligne en favori suffit, un chemin sans doublon, normalisé');
  assert.deepEqual(readGfsPinnedFolders(data, BEN), ['Contrats/2026']);
  assert.deepEqual(readGfsPinnedFolders(data, ''), [], 'sans adresse, le rangement est celui des lignes sans personne : aucune ici');
  assert.deepEqual(readGfsPinnedFolders(null, ANA), []);
  assert.deepEqual(readGfsFolders(data, ANA), ['Contrats', 'Archives', 'Factures/2025', 'Rien'], 'les dossiers gardés ne changent pas : le favori n\'en fait ni plus ni moins');
  assert.deepEqual(readGfsFolderRows(data, ANA).map(row => [row.id, row.path]), [[1, 'Contrats'], [2, 'Archives'], [6, 'Factures/2025'], [8, 'Archives'], [9, 'Rien']]);
});

test('la lecture des fichiers rend aussi les dossiers en favori, pour la personne seule ; une table du rangement illisible n\'en cache aucun fichier', async () => {
  const manifest = publipostage();
  const gfs = [
    { id: 1, User: ANA, App: '', File: '', Favorite: true, Folder: 'Contrats' },
    { id: 2, User: ANA, App: '', File: '', Favorite: false, Folder: 'Archives' },
    { id: 3, User: BEN, App: '', File: '', Favorite: true, Folder: 'De Ben' },
  ];
  const { port } = fakeGrist({ GFS_Filing: { columns: ['id', 'User', 'App', 'File', 'Favorite', 'Folder'], rows: gfs } });
  const mine = await loadFiles(port, [{ manifest }], ANA);
  assert.deepEqual([mine.folders, mine.pinned], [['Contrats', 'Archives'], ['Contrats']]);
  assert.deepEqual((await loadFiles(port, [{ manifest }], BEN)).pinned, ['De Ben']);
  const none = await loadFiles(fakeGrist({}).port, [{ manifest }], ANA);
  assert.deepEqual(none.pinned, [], 'sans table du rangement : aucun');
});

test('l\'empreinte d\'une lecture change quand un dossier entre dans les favoris : la relecture automatique redessine la liste', () => {
  const read = pinned => ({ files: [], trash: [], folders: ['A'], pinned, received: [], spaces: null, notices: null, problems: [] });
  assert.notEqual(listSignature(read([])), listSignature(read(['A'])));
  assert.equal(listSignature(read(['A'])), listSignature(read(['A'])));
});

// ---------- montrer ----------

const file = (id, folder, extra = {}) => ({ key: `publipostage:${id}`, app: 'publipostage', id: String(id), name: `Modèle ${id}`, type: 'document', folder, pinned: false, ts: 1000 + id,
  weight: 100 * id, pieces: [], search: `modele ${id} ${folder}`.toLowerCase(), ...extra });
const FILES = [file(1, 'Contrats', { pinned: true }), file(2, 'Contrats/2026'), file(3, 'Archives'), file(4, 'Contrats/2026/Q1', { pinned: true }), file(5, '')];
const state = (extra = {}) => ({ view: 'fav', path: '', q: '', type: 'all', sort: { key: 'name', dir: 1 }, ...extra });
const OPTIONS = { locale: 'fr', typeLabel: item => item.type };
const names = result => result.rows.map(row => (row.kind === 'folder' ? `dossier ${row.path}` : row.file.name));

test('Favoris : les dossiers en favori viennent d\'abord (par nom), puis les fichiers ; chaque dossier dit son nombre de fichiers, son poids et sa dernière date', () => {
  const result = listItems(FILES, state(), { ...OPTIONS, spare: ['Vide'], pinned: ['Contrats/2026', 'Archives', 'Contrats'] });
  assert.deepEqual(names(result), ['dossier Contrats/2026', 'dossier Archives', 'dossier Contrats', 'Modèle 1', 'Modèle 4'], 'par le nom du dossier (« 2026 » avant « Archives »)');
  const [year, archives, contracts] = result.rows;
  assert.deepEqual([archives.count, archives.weight, archives.ts, archives.parent, archives.pinned], [1, 300, 1003, '', true]);
  assert.deepEqual([contracts.count, contracts.weight, contracts.ts, contracts.name], [3, 700, 1004, 'Contrats'], 'sous-dossiers compris');
  assert.deepEqual([year.count, year.parent, year.name], [2, 'Contrats', '2026']);
  assert.equal(result.flat, true);
  assert.equal(result.covered.length, 4, 'un fichier que deux lignes couvrent (le 4 est en favori et dans un dossier en favori) n\'est compté qu\'une fois dans le total');
});

test('Favoris : un dossier qui n\'existe plus (ni ligne d\'état, ni fichier) n\'est pas montré ; un dossier vide gardé l\'est, avec zéro fichier', () => {
  assert.deepEqual(existingPinned(FILES, ['Disparu', 'Vide', 'Contrats'], ['Vide']), ['Vide', 'Contrats']);
  const result = listItems(FILES, state(), { ...OPTIONS, spare: ['Vide'], pinned: ['Disparu', 'Vide'] });
  assert.deepEqual(names(result), ['dossier Vide', 'Modèle 1', 'Modèle 4']);
  assert.deepEqual([result.rows[0].count, result.rows[0].weight, result.rows[0].ts], [0, 0, null]);
  assert.deepEqual(favoriteFolders(FILES, [], []), [], 'rien en favori : aucune ligne');
});

test('Favoris : la recherche trouve un dossier par son nom ou son chemin, mots dans n\'importe quel ordre ; un filtre de type l\'écarte (un dossier n\'a pas de type)', () => {
  const options = { ...OPTIONS, pinned: ['Contrats/2026', 'Archives'] };
  assert.deepEqual(names(listItems(FILES, state({ q: '2026 CONTRATS' }), options)), ['dossier Contrats/2026', 'Modèle 4'], 'le chemin entier compte, accents et casse ignorés ; les fichiers de ce chemin aussi');
  assert.deepEqual(names(listItems(FILES, state({ q: 'archive' }), options)), ['dossier Archives']);
  assert.deepEqual(names(listItems(FILES, state({ q: 'zzz' }), options)), []);
  assert.deepEqual(names(listItems(FILES, state({ type: 'document' }), options)), ['Modèle 1', 'Modèle 4'], 'un type est choisi : les dossiers n\'en ont pas');
});

test('Favoris : le tri par nom renversé renverse les dossiers ; le tri par poids les range comme les fichiers', () => {
  const options = { ...OPTIONS, pinned: ['Contrats', 'Archives'] };
  assert.deepEqual(names(listItems(FILES, state({ sort: { key: 'name', dir: -1 } }), options)).slice(0, 2), ['dossier Contrats', 'dossier Archives']);
  assert.deepEqual(names(listItems(FILES, state({ sort: { key: 'poids', dir: 1 } }), options)).slice(0, 2), ['dossier Archives', 'dossier Contrats']);
});

test('dans un dossier, les sous-dossiers disent s\'ils sont en favori (l\'épingle s\'allume) ; les autres vues n\'ont pas de ligne de dossier en favori', () => {
  const result = listItems(FILES, state({ view: 'folder', path: 'Contrats' }), { ...OPTIONS, pinned: ['Contrats/2026'] });
  assert.deepEqual(result.rows.filter(row => row.kind === 'folder').map(row => [row.path, row.pinned]), [['Contrats/2026', true]]);
  const root = listItems(FILES, state({ view: 'folder' }), { ...OPTIONS, pinned: ['Archives'] });
  assert.deepEqual(root.rows.filter(row => row.kind === 'folder').map(row => [row.path, row.pinned]), [['Archives', true], ['Contrats', false]]);
  assert.deepEqual(names(listItems(FILES, state({ view: 'recent' }), { ...OPTIONS, pinned: ['Archives'] })).filter(name => name.startsWith('dossier')), []);
});

// La ligne d'un dossier : l'épingle (allumée quand il est en favori), et dans Favoris le dossier du dessus à côté du nom.
const ctx = (view, extra = {}) => ({ t, locale: 'fr', now: new Date('2026-11-27T10:00:00Z'), state: { view, sel: null }, ...extra });
const textOf = node => node.textContent;
const find = (node, test) => (typeof node === 'string' ? [] : [...(test(node) ? [node] : []), ...node.children.flatMap(child => find(child, test))]);
const folder = (path, extra = {}) => ({ kind: 'folder', path, name: path.split('/').pop(), parent: path.split('/').slice(0, -1).join('/'), count: 2, weight: 10, ts: null, ...extra });

test('la ligne d\'un dossier de « Moi » a son épingle (allumée en favori) ; celle d\'un espace ou d\'un dossier reçu n\'en a pas', () => {
  const pins = row => find(row, node => node.className.includes('rb pin'));
  const off = pins(folderRow(ctx('folder'), folder('Contrats')));
  assert.equal(off.length, 1);
  assert.deepEqual([off[0].dataset.pin, off[0].attrs['aria-pressed'], off[0].attrs.title, off[0].className], ['dir:Contrats', 'false', t('ex.pin'), 'rb pin']);
  const on = pins(folderRow(ctx('folder'), folder('Contrats', { pinned: true })))[0];
  assert.deepEqual([on.attrs['aria-pressed'], on.attrs.title, on.className], ['true', t('ex.unpin'), 'rb pin on']);
  assert.equal(pins(folderRow(ctx('folder'), folder('Espaces/Achats'))).length, 0);
  assert.equal(pins(folderRow(ctx('folder'), folder('Espaces'))).length, 0);
  assert.equal(pins(folderRow(ctx('shared'), folder('Compta:Q3', { shared: true }))).length, 0);
});

test('dans Favoris, le dossier du dessus se dit à côté du nom (rien à la racine) ; ailleurs rien', () => {
  const hints = (view, row) => find(folderRow(ctx(view), row), node => node.className === 'hint').map(textOf);
  assert.deepEqual(hints('fav', folder('Contrats/2026', { pinned: true })), ['Contrats']);
  assert.deepEqual(hints('fav', folder('A/B/C', { pinned: true })), ['B']);
  assert.deepEqual(hints('fav', folder('Archives', { pinned: true })), []);
  assert.deepEqual(hints('folder', folder('Contrats/2026')), []);
});

// ---------- écrire (la table du rangement) ----------

const row = (id, extra) => ({ id, User: ANA, App: '', File: '', Favorite: false, Folder: '', Collapsed: false, Value: '', Address: '', ...extra });
const full = ['id', 'User', 'App', 'File', 'Favorite', 'Folder', 'Collapsed', 'Value', 'Address'];
const noProbe = { canWrite: () => false };
const written = (rows, ana = ANA) => rows.filter(line => line.User === ana && !line.App).map(line => [line.Folder, line.Favorite]);
// Un rangement sur une table qui a déjà ces lignes ; la personne est reconnue par la sonde (adresse écrite par Grist).
async function filed(rows, folders, entries = []) {
  const grist = fakeGrist({ [TABLE]: { columns: full, rows } }, { email: ANA });
  const rangement = new Rangement({ port: grist.port, consent: async () => true });
  const done = await rangement.setFiling(entries, folders);
  return { ...grist, done, lines: () => grist.tables[TABLE].rows };
}
const mine = rows => rows.filter(line => line.User === ANA);

test('épingler un dossier : la colonne « Favori » de sa ligne d\'état s\'allume, sur place ; une ligne déjà en favori n\'est pas réécrite ; celles des autres ne bougent pas', async () => {
  const { lines, done } = await filed([row(1, { Folder: 'Contrats' }), row(2, { Folder: 'Archives', Favorite: true }), row(3, { User: BEN, Folder: 'Contrats' })],
    { pin: ['Contrats', 'Archives'] });
  assert.equal(done, true);
  assert.deepEqual(written(lines()), [['Contrats', true], ['Archives', true]]);
  assert.deepEqual(lines().filter(line => line.User === BEN).map(line => line.Favorite), [false], 'le dossier de Ben n\'est pas le sien');
  const again = await filed([row(1, { Folder: 'Contrats', Favorite: true })], { pin: ['Contrats'] });
  assert.deepEqual(again.actions.filter(action => action[0] === 'UpdateRecord'), [], 'rien à écrire : le dossier l\'est déjà');
});

test('épingler un dossier qui n\'existe que par ses fichiers : sa ligne d\'état naît, déjà en favori (une seule ligne, jamais deux)', async () => {
  const { lines, done } = await filed([row(1, { App: 'publipostage', File: '3', Folder: 'Contrats' })], { pin: ['Contrats'] });
  assert.equal(done, true);
  assert.deepEqual(written(lines()), [['Contrats', true]]);
  const twice = await filed([row(1, { Folder: 'Contrats' })], { pin: ['Contrats'], add: ['Contrats'] });
  assert.deepEqual(written(twice.lines()), [['Contrats', true]], 'un dossier à garder ET à épingler : la ligne qui existe suffit, elle s\'allume');
  const born = await filed([], { add: ['Neuf', 'Autre'], pin: ['Neuf'] });
  assert.deepEqual(written(born.lines()).sort(), [['Autre', false], ['Neuf', true]], 'à la naissance du dossier, son favori naît avec lui ; les autres restent à faux');
});

test('retirer un dossier des favoris : sa colonne « Favori » s\'éteint, sur toutes ses lignes ; son dossier reste gardé', async () => {
  const { lines } = await filed([row(1, { Folder: 'Contrats', Favorite: true }), row(2, { Folder: 'Contrats', Favorite: true }), row(3, { Folder: 'Archives', Favorite: true })],
    { unpin: ['Contrats'] });
  assert.deepEqual(written(lines()), [['Contrats', false], ['Contrats', false], ['Archives', true]]);
});

test('supprimer un dossier en favori : sa ligne s\'en va, le favori avec elle ; un dossier qui change de chemin garde son favori, sa ligne et son numéro', async () => {
  const gone = await filed([row(1, { Folder: 'Contrats', Favorite: true })], { drop: ['Contrats'] });
  assert.deepEqual(written(gone.lines()), []);
  const moved = await filed([row(1, { Folder: 'Contrats', Favorite: true }), row(2, { Folder: 'Contrats/2026' })], { moved: [['Contrats', 'Marchés'], ['Contrats/2026', 'Marchés/2026']] });
  assert.deepEqual(mine(moved.lines()).map(line => [line.id, line.Folder, line.Favorite]), [[1, 'Marchés', true], [2, 'Marchés/2026', false]]);
});

test('un dossier fondu dans un dossier qui existe déjà : le favori passe à celui d\'arrivée quand l\'autre l\'était ; sinon rien ne change', async () => {
  const lit = await filed([row(1, { Folder: 'Contrats', Favorite: true }), row(2, { Folder: 'Marchés' })], { merged: [['Contrats', 'Marchés']] });
  assert.deepEqual(written(lit.lines()), [['Marchés', true]]);
  const plain = await filed([row(1, { Folder: 'Contrats' }), row(2, { Folder: 'Marchés', Favorite: true })], { merged: [['Contrats', 'Marchés']] });
  assert.deepEqual(written(plain.lines()), [['Marchés', true]], 'celui d\'arrivée l\'était déjà : il le reste');
  const none = await filed([row(1, { Folder: 'Contrats' }), row(2, { Folder: 'Marchés' })], { merged: [['Contrats', 'Marchés']] });
  assert.deepEqual(written(none.lines()), [['Marchés', false]]);
  const bare = await filed([row(1, { Folder: 'Contrats', Favorite: true })], { merged: [['Contrats', 'Marchés']] });
  assert.deepEqual(written(bare.lines()), [['Marchés', true]], 'le dossier d\'arrivée n\'avait pas de ligne : il en reçoit une, en favori');
});

test('l\'épingle d\'un dossier part dans le même lot que le rangement des fichiers : un seul appel à Grist ; rien à écrire, rien n\'est demandé', async () => {
  const grist = fakeGrist({ [TABLE]: { columns: full, rows: [row(1, { User: '', Folder: 'Contrats' })] } });
  const rangement = new Rangement({ port: grist.port, consent: async () => true, ...noProbe });
  await rangement.setFiling([{ app: 'publipostage', file: '3', pinned: true, folder: 'Contrats' }], { pin: ['Contrats'] });
  assert.deepEqual(grist.batches[0].map(action => action[0]).sort(), ['AddRecord', 'UpdateRecord'], 'le fichier rangé et le dossier épinglé : un lot');
  assert.equal(grist.batches.filter(batch => batch.some(action => action[0] === 'UpdateRecord')).length, 1, 'pas d\'autre écriture que le numéro de structure');
  const idle = new Rangement({ port: fakeGrist().port, consent: () => assert.fail('aucune question'), ...noProbe });
  assert.equal(await idle.setFiling([], { pin: [], unpin: [] }), false);
});

// ---------- le geste (Filing) ----------

const held = () => { let go; const hold = new Promise(resolve => { go = resolve; }); return { hold, go }; };
// Une doublure de ce que le contrôleur donne ; le rangement double applique les lots comme la table (`pin`, `unpin`, `drop`, `moved`, `merged`).
function harness({ files = FILES, spare = [], pinned = [], pending = null, hold = null, answers = [], spaces = null, refuse = null, block = null } = {}) {
  const log = { writes: [], notices: [], refreshes: 0 };
  let kept = [...spare];
  let pins = [...pinned];
  const rangement = { ...(pending ? { known: true } : {}), setFiling: async (entries, folders = {}) => {
    if (hold) await hold;
    if (refuse) throw new Error(refuse);
    log.writes.push({ entries, folders });
    const moves = [...(folders.moved || []), ...(folders.merged || [])];
    const follow = path => (moves.find(([from]) => from === path) || [0, path])[1];
    const gone = [...(folders.drop || []), ...(folders.merged || []).map(([from]) => from)];
    kept = [...new Set([...kept.filter(path => !gone.includes(path)).map(path => ((folders.moved || []).find(([from]) => from === path) || [0, path])[1]),
      ...(folders.add || []), ...(folders.pin || [])])];
    pins = [...new Set([...pins.map(follow).filter(path => !(folders.drop || []).includes(path)), ...(folders.pin || [])])].filter(path => !(folders.unpin || []).includes(path));
  } };
  const shown = () => (pending ? pending.apply({ files, folders: kept, pinned: pins }) : { files, folders: kept, pinned: pins });
  const filing = new Filing({ port: { doc: {} }, rangement, t, locale: () => 'fr', files: () => shown().files, folders: () => shown().folders, pinnedFolders: () => shown().pinned,
    pending, here: () => '', specOf: () => null, appName: () => 'Publipostage+', writeBlock: () => block, notice: text => log.notices.push(text),
    refresh: async () => { log.refreshes += 1; }, windows: { name: async () => answers.shift() ?? null, folder: async () => null }, spaces });
  return { filing, log, shown, pins: () => pins, kept: () => kept };
}

test('épingler un dossier : « pin » dans un seul lot, la liste est relue ; un second geste le retire des favoris', async () => {
  const { filing, log, pins } = harness({ spare: ['Contrats'] });
  await filing.togglePinFolder('Contrats');
  assert.deepEqual(log.writes, [{ entries: [], folders: { pin: ['Contrats'] } }]);
  assert.deepEqual([pins(), log.refreshes], [['Contrats'], 1]);
  await filing.togglePinFolder('Contrats');
  assert.deepEqual(log.writes.at(-1), { entries: [], folders: { unpin: ['Contrats'] } });
  assert.deepEqual(pins(), []);
});

test('deux clics rapides sur l\'épingle d\'un dossier : le second part de ce que le premier a écrit, et l\'éteint', async () => {
  const { filing, log } = harness({ spare: ['Contrats'] });
  await Promise.all([filing.togglePinFolder('Contrats'), filing.togglePinFolder('Contrats')]);
  assert.deepEqual(log.writes.map(write => Object.keys(write.folders)[0]), ['pin', 'unpin']);
});

test('un espace et ses dossiers ne s\'épinglent pas encore : rien n\'est écrit, la personne lit pourquoi', async () => {
  const { filing, log } = harness();
  for (const path of ['Espaces', 'Espaces/Achats', 'Espaces/Achats/Contrats']) assert.equal(await filing.togglePinFolder(path), false);
  assert.deepEqual(log.notices, Array(3).fill(t('ex.favFolderSpace')));
  assert.deepEqual([log.writes, log.refreshes], [[], 0]);
});

test('rien ne s\'enregistre (lecture seule) : l\'épingle ne part pas, la phrase est dite', async () => {
  const { filing, log } = harness({ block: t('mod.readonly') });
  await filing.togglePinFolder('Contrats');
  assert.deepEqual([log.notices, log.writes], [[t('mod.readonly')], []]);
});

test('l\'épingle s\'affiche d\'avance, avant que Grist n\'ait rien reçu ; refusée par Grist, elle s\'en va ; Ctrl+Z attend l\'écriture puis l\'éteint, Ctrl+Y la rallume', async () => {
  const { hold, go } = held();
  const pending = new Pending();
  const { filing, shown, log } = harness({ spare: ['Contrats'], pending, hold });
  await filing.togglePinFolder('Contrats');
  assert.deepEqual([shown().pinned, log.writes], [['Contrats'], []], 'la personne la voit ; Grist n\'a encore rien reçu');
  const undone = filing.undoStack.undo();
  go();
  assert.equal(await undone, true);
  await filing.settled();
  assert.deepEqual(shown().pinned, []);
  assert.deepEqual(log.writes.map(write => write.folders), [{ pin: ['Contrats'] }, { add: [], drop: [], moved: [], unpin: ['Contrats'] }]);
  assert.equal(await filing.undoStack.redo(), true);
  await filing.settled();
  assert.deepEqual(shown().pinned, ['Contrats']);
});

test('Grist refuse l\'épingle : elle disparaît de la liste et la phrase du refus est dite', async () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    const pending = new Pending();
    const { hold, go } = held();
    const { filing, shown, log } = harness({ spare: ['Contrats'], pending, hold, refuse: 'refusé par Grist' });
    await filing.togglePinFolder('Contrats');
    assert.deepEqual(shown().pinned, ['Contrats'], 'elle s\'affiche d\'abord');
    go();
    await filing.settled();
    assert.deepEqual(shown().pinned, [], 'le changement a été retiré');
    assert.match(log.notices.at(-1), /refusé par Grist/);
  } finally { console.warn = warn; }
});

test('supprimer un dossier en favori : son favori part avec lui ; Ctrl+Z remet le dossier ET son favori', async () => {
  const { filing, log, pins, kept } = harness({ files: [file(5, '')], spare: ['Vide'], pinned: ['Vide'] });
  assert.equal(await filing.deleteFolder('Vide'), true);
  assert.deepEqual([pins(), kept()], [[], []]);
  assert.deepEqual(log.writes.at(-1).folders, { drop: ['Vide'] });
  await filing.undoStack.undo();
  assert.deepEqual(log.writes.at(-1).folders, { add: ['Vide'], drop: [], moved: [], pin: ['Vide'] });
  assert.deepEqual([pins(), kept()], [['Vide'], ['Vide']]);
});

test('supprimer un dossier qui n\'est pas en favori puis Ctrl+Z : il revient, et ne devient pas favori', async () => {
  const { filing, log, pins } = harness({ files: [file(5, '')], spare: ['Vide'] });
  await filing.deleteFolder('Vide');
  await filing.undoStack.undo();
  assert.deepEqual(log.writes.at(-1).folders, { add: ['Vide'], drop: [], moved: [] });
  assert.deepEqual(pins(), []);
});

test('renommer un dossier en favori : son favori le suit (affiché d\'avance aussi) ; Ctrl+Z le remet au chemin d\'avant, toujours en favori', async () => {
  const { hold, go } = held();
  const pending = new Pending();
  const { filing, shown, pins } = harness({ files: [file(5, '')], spare: ['E', 'E/F'], pinned: ['E', 'E/F'], answers: ['Neuf'], pending, hold });
  await filing.renameFolder('E');
  assert.deepEqual([shown().folders, shown().pinned], [['Neuf', 'Neuf/F'], ['Neuf', 'Neuf/F']], 'sous-dossiers compris, sans clignoter');
  go();
  await filing.settled();
  assert.deepEqual(pins(), ['Neuf', 'Neuf/F']);
  await filing.undoStack.undo();
  await filing.settled();
  assert.deepEqual([shown().folders, shown().pinned], [['E', 'E/F'], ['E', 'E/F']]);
});

test('un dossier en favori fondu dans un dossier qui existe déjà : celui d\'arrivée l\'est ; Ctrl+Z remet le dossier d\'avant en favori et l\'autre comme il était', async () => {
  const { filing, pins, kept } = harness({ files: [file(5, '')], spare: ['E', 'X/E'], pinned: ['E'] });
  assert.equal(await filing.moveFolderTo('E', 'X'), 'moved');
  assert.deepEqual([kept(), pins()], [['X/E'], ['X/E']]);
  await filing.undoStack.undo();
  assert.deepEqual([kept().sort(), pins()], [['E', 'X/E'], ['E']], 'l\'arrivée n\'était pas en favori : elle ne l\'est plus');
});

test('épingler un dossier puis Ctrl+Z : il sort des favoris ; Ctrl+Z d\'un retrait : il y rentre', async () => {
  const { filing, log, pins } = harness({ spare: ['Contrats', 'Archives'], pinned: ['Archives'] });
  await filing.togglePinFolder('Contrats');
  await filing.undoStack.undo();
  assert.deepEqual([pins(), log.writes.at(-1).folders.unpin], [['Archives'], ['Contrats']]);
  assert.equal(log.notices.at(-1), t('undo.unpinned', { name: 'Contrats' }));
  await filing.togglePinFolder('Archives');
  await filing.undoStack.undo();
  assert.deepEqual(pins().sort(), ['Archives']);
  assert.equal(log.notices.at(-1), t('undo.pinned', { name: 'Archives' }));
});
