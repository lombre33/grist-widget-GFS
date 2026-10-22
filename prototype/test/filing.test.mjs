// Épingler, ranger et renommer depuis l'explorateur (js/filing.js, contrats 6.4 et 6.3 point 2) : ce que chaque geste écrit, et ce qu'il n'écrit pas.
// Les fenêtres et le rangement sont remplacés par des doublures ; ce que Grist fait vraiment de ces écritures se mesure dans le labo (run-ranger.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Filing } from '../js/filing.js';
import { TableDeclined } from '../js/rangement.js';
import { createI18n } from '../js/i18n.js';

const { t } = createI18n('fr');
const file = (id, folder = '', extra = {}) => ({ key: `publipostage:${id}`, app: 'publipostage', id: String(id), table: 'Publipostage_Modeles', row: Number(id) * 10, name: `Modèle ${id}`, folder, pinned: false, ...extra });
const SPEC = { table: 'Publipostage_Modeles', colonnes: { id: 'id', nom: 'Nom' } };
// Les deux tables internes que lit « renommer » : la table de fichiers (nom réel « Publipostage_modeles ») et ses colonnes.
const META = {
  _grist_Tables: { id: [1, 2], tableId: ['Publipostage_modeles', 'Autre'] },
  _grist_Tables_column: { id: [1, 2, 3], parentId: [1, 1, 2], colId: ['Nom', 'Contenu', 'Nom'] },
};

// Une doublure de tout ce que le contrôleur donne : `stored` est ce que la table de GFS retient, et la liste relue après chaque geste en part.
function harness({ files = [file(1), file(2, 'A/B'), file(3, 'A/B/C'), file(4, 'X')], block = null, answers = [], setFiling = null, meta = META } = {}) {
  const log = { writes: [], actions: [], notices: [], windows: [], refreshes: 0 };
  let list = files;
  const rangement = { setFiling: setFiling || (async entries => {
    log.writes.push({ entries });
    list = list.map(item => { const entry = entries.find(e => e.app === item.app && e.file === item.id); return entry ? { ...item, pinned: entry.pinned, folder: entry.folder } : item; });
  }) };
  const ask = kind => async opts => { log.windows.push({ kind, ...opts }); return answers.shift() ?? null; };
  const port = { doc: { fetchTable: async name => meta[name], applyUserActions: async actions => { log.actions.push(...actions); } } };
  const filing = new Filing({
    port, rangement, t, locale: () => 'fr', files: () => list, here: () => 'X', specOf: () => SPEC, appName: () => 'Publipostage+',
    writeBlock: () => block, notice: text => log.notices.push(text), refresh: async () => { log.refreshes += 1; }, windows: { name: ask('name'), folder: ask('folder') },
  });
  return { filing, log, current: () => list };
}

test('épingler : une ligne pour ce fichier, son dossier gardé, puis la liste est relue', async () => {
  const { filing, log } = harness();
  await filing.togglePin(file(2, 'A/B'));
  assert.deepEqual(log.writes, [{ entries: [{ app: 'publipostage', file: '2', pinned: true, folder: 'A/B' }] }]);
  assert.equal(log.refreshes, 1);
});

test('deux clics rapides sur l\'étoile : le second part de ce que le premier a écrit, et l\'éteint', async () => {
  const { filing, log } = harness();
  const stale = file(1);
  await Promise.all([filing.togglePin(stale), filing.togglePin(stale)]);
  assert.deepEqual(log.writes.map(write => write.entries[0].pinned), [true, false]);
});

test('rien ne s\'enregistre : la personne le lit, aucune fenêtre ne s\'ouvre, rien n\'est écrit', async () => {
  const { filing, log } = harness({ block: t('mod.readonly') });
  await filing.togglePin(file(1));
  await filing.moveFile(file(1));
  await filing.rename(file(1));
  await filing.renameFolder('A/B');
  assert.deepEqual(log.notices, Array(4).fill(t('mod.readonly')));
  assert.deepEqual([log.windows, log.writes, log.actions], [[], [], []]);
});

test('déplacer un fichier : la liste des dossiers (parents compris), le dossier où il est, et le nouveau dossier naît dans le dossier ouvert', async () => {
  const { filing, log } = harness({ answers: ['X/Nouveau'] });
  await filing.moveFile(file(2, 'A/B'));
  const [window] = log.windows;
  assert.deepEqual([window.kind, window.folders, window.current, window.base], ['folder', ['A', 'A/B', 'A/B/C', 'X'], 'A/B', 'X']);
  assert.equal(window.title, 'Déplacer « Modèle 2 »');
  assert.equal(window.clean(' a/b '), 'a b', 'un nom de dossier ne porte pas de « / »');
  assert.deepEqual(log.writes[0].entries, [{ app: 'publipostage', file: '2', pinned: false, folder: 'X/Nouveau' }]);
});

test('déplacer vers le dossier où il est déjà, ou renoncer : rien n\'est écrit', async () => {
  const { filing, log } = harness({ answers: ['A/B', null] });
  await filing.moveFile(file(2, 'A/B'));
  await filing.moveFile(file(2, 'A/B'));
  assert.deepEqual([log.writes, log.refreshes], [[], 0]);
});

test('déplacer un dossier : ni lui ni ses sous-dossiers ne sont proposés ; ses fichiers suivent, sous-dossiers compris', async () => {
  const { filing, log } = harness({ answers: ['X'] });
  await filing.moveFolder('A/B');
  const [window] = log.windows;
  assert.deepEqual([window.folders, window.current, window.base], [['A', 'X'], 'A', 'A']);
  assert.equal(window.title, 'Déplacer le dossier « B »');
  assert.deepEqual(log.writes[0].entries.map(entry => [entry.file, entry.folder]), [['2', 'X/B'], ['3', 'X/B/C']]);
});

test('renommer un dossier : un nom sans « / », ses fichiers suivent ; le même nom n\'écrit rien', async () => {
  const { filing, log } = harness({ answers: ['Bis', 'Bis'] });
  await filing.renameFolder('A/B');
  const [window] = log.windows;
  assert.deepEqual([window.kind, window.value, window.title], ['name', 'B', 'Renommer le dossier « B »']);
  assert.equal(window.clean('x / y'), 'x y');
  assert.deepEqual(log.writes[0].entries.map(entry => [entry.file, entry.folder]), [['2', 'A/Bis'], ['3', 'A/Bis/C']]);
  await filing.renameFolder('A/Bis');
  assert.equal(log.writes.length, 1);
});

test('renommer un fichier : le nom seul, dans la colonne du nom, sur sa ligne, avec le nom réel de la table ; puis la liste est relue', async () => {
  const { filing, log } = harness({ answers: ['Convocation 2026'] });
  await filing.rename(file(2));
  assert.deepEqual([log.windows[0].value, log.windows[0].title], ['Modèle 2', 'Renommer « Modèle 2 »']);
  assert.deepEqual(log.actions, [['UpdateRecord', 'Publipostage_modeles', 20, { Nom: 'Convocation 2026' }]]);
  assert.deepEqual([log.writes, log.refreshes], [[], 1], 'le rangement de GFS n\'est pas touché');
});

test('renommer : une colonne du nom absente de la table n\'est jamais écrite, la personne lit pourquoi', async () => {
  const meta = { ...META, _grist_Tables_column: { id: [2], parentId: [1], colId: ['Contenu'] } };
  const { filing, log } = harness({ answers: ['Neuf'], meta });
  await filing.rename(file(1));
  assert.deepEqual(log.actions, []);
  assert.deepEqual(log.notices, [t('ex.renameNoColumn', { app: 'Publipostage+' })]);
});

test('renommer : le même nom, ou renoncer, n\'écrit rien', async () => {
  const { filing, log } = harness({ answers: ['Modèle 1', null] });
  await filing.rename(file(1));
  await filing.rename(file(1));
  assert.deepEqual([log.actions, log.refreshes], [[], 0]);
});

test('la table refusée, ou une écriture qui échoue : la personne le lit, la liste n\'est pas relue', async () => {
  const declined = harness({ setFiling: async () => { throw new TableDeclined(); } });
  await declined.filing.togglePin(file(1));
  assert.deepEqual([declined.log.notices, declined.log.refreshes], [[t('ex.filingDeclined')], 0]);
  const warn = console.warn;
  const warned = [];
  console.warn = (...args) => warned.push(args[0]);
  try {
    const failed = harness({ setFiling: async () => { throw new Error('Invalid column Favori'); } });
    await failed.filing.togglePin(file(1));
    assert.deepEqual(failed.log.notices, [t('ex.filingFailed', { reason: 'Invalid column Favori' })]);
    assert.equal(warned.length, 1);
  } finally { console.warn = warn; }
});

test('un geste qui échoue ne bloque pas le suivant', async () => {
  let calls = 0;
  const { filing, log } = harness({ setFiling: async () => { calls += 1; if (calls === 1) throw new TableDeclined(); } });
  await Promise.all([filing.togglePin(file(1)), filing.togglePin(file(1))]);
  assert.equal(calls, 2);
  assert.equal(log.refreshes, 1);
});

test('renommer un fichier : un nom vide, ou celui d\'un autre fichier de la même table (casse et espaces ignorés), est refusé dans la fenêtre', async () => {
  const { filing, log } = harness({ answers: [null] });
  await filing.rename(file(1));
  const { refuse } = log.windows[0];
  assert.equal(refuse(''), t('ex.nameEmpty'));
  assert.equal(refuse('  modèle 2 '), t('ex.nameTaken', { app: 'Publipostage+' }));
  assert.equal(refuse('Modèle 1'), null, 'son propre nom, en changeant la casse par exemple');
  assert.equal(refuse('Neuf'), null);
});

test('renommer un dossier : le nom d\'un dossier voisin est refusé (accents et casse ignorés, comme la recherche) ; un dossier ailleurs ne gêne pas', async () => {
  const { filing, log } = harness({ answers: [null] });
  await filing.renameFolder('X');
  const { refuse } = log.windows[0];
  assert.equal(refuse('À'), t('ex.folderTaken'), '« A » est à côté de « X »');
  assert.equal(refuse('B'), null, '« B » est dans « A », pas à côté');
  assert.equal(refuse(''), t('ex.nameEmpty'));
});
