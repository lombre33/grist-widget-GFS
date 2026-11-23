// Épingler, ranger et renommer depuis l'explorateur (js/explorer/filing.js, contrats 6.4 et 6.3 point 2) : ce que chaque geste écrit, et ce qu'il n'écrit pas.
// Les fenêtres et le rangement sont remplacés par des doublures ; ce que Grist fait vraiment de ces écritures se mesure dans le labo (run-ranger.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Filing } from '../js/explorer/filing.js';
import { TableDeclined } from '../js/files/rangement.js';
import { createI18n } from '../js/i18n/i18n.js';
import { Pending } from '../js/explorer/pending.js';

const { t } = createI18n('fr');
const file = (id, folder = '', extra = {}) => ({ key: `publipostage:${id}`, app: 'publipostage', id: String(id), table: 'Publipostage_Modeles', row: Number(id) * 10, name: `Modèle ${id}`, folder, pinned: false, ...extra });
const SPEC = { table: 'Publipostage_Modeles', colonnes: { id: 'id', nom: 'Nom' } };
// Les deux tables internes que lit « renommer » : la table de fichiers (nom réel « Publipostage_modeles ») et ses colonnes.
const META = {
  _grist_Tables: { id: [1, 2], tableId: ['Publipostage_modeles', 'Autre'] },
  _grist_Tables_column: { id: [1, 2, 3], parentId: [1, 1, 2], colId: ['Nom', 'Contenu', 'Nom'] },
};

// Une doublure de tout ce que le contrôleur donne : `stored` est ce que la table de GFS retient, et la liste relue après chaque geste en part.
// `spare` : les dossiers que la personne garde sans fichier (les lignes d'état de `GFS_Rangement`) ; la doublure les suit quand un lot en ajoute ou en retire. Un lot de dossiers n'est noté que s'il y en a.
function harness({ files = [file(1), file(2, 'A/B'), file(3, 'A/B/C'), file(4, 'X')], spare = [], block = null, answers = [], setFiling = null, meta = META, cleanName = undefined, folderShares = null, pending = null, known = true, hold = null, refuse = null } = {}) {
  const log = { writes: [], actions: [], notices: [], windows: [], refreshes: 0, refreshed: [] };
  let list = files;
  let kept = [...spare];
  // `pending` : les gestes affichés d'avance (la liste que les gestes lisent est alors celle que la personne voit) ; `known` : la table du rangement a été vue
  // `hold` : une promesse que l'écriture attend avant de partir ; `refuse` : le message dont Grist refuse le lot
  const rangement = { ...(pending ? { known } : {}), setFiling: setFiling || (async (entries, folders = {}) => {
    if (hold) await hold;
    if (refuse) throw new Error(refuse);
    const add = folders.add || [];
    const drop = folders.drop || [];
    const moved = folders.moved || [];
    const merged = folders.merged || [];
    log.writes.push(add.length || drop.length || moved.length || merged.length ? { entries, folders } : { entries });
    list = list.map(item => { const entry = entries.find(e => e.app === item.app && e.file === item.id); return entry ? { ...item, pinned: entry.pinned, folder: entry.folder } : item; });
    kept = [...kept.filter(path => !drop.includes(path) && !merged.some(([from]) => from === path)).map(path => (moved.find(([from]) => from === path) || [0, path])[1]), ...add.filter(path => !kept.includes(path))];
  }) };
  const ask = kind => async opts => { log.windows.push({ kind, ...opts }); return answers.shift() ?? null; };
  const port = { doc: { fetchTable: async name => meta[name], applyUserActions: async actions => { log.actions.push(...actions); for (const action of actions) if (action[0] === 'UpdateRecord') list = list.map(item => (item.row === action[2] ? { ...item, name: Object.values(action[3])[0] } : item)); } } };
  const filing = new Filing({
    port, rangement, t, locale: () => 'fr', files: () => (pending ? pending.apply({ files: list, folders: kept }).files : list),
    folders: () => (pending ? pending.apply({ files: list, folders: kept }).folders : kept), pending, here: () => 'X', specOf: () => SPEC, appName: () => 'Publipostage+', cleanName, folderShares,
    writeBlock: () => block, notice: text => log.notices.push(text), refresh: async opts => { log.refreshes += 1; log.refreshed.push(opts); }, windows: { name: ask('name'), folder: ask('folder') },
  });
  return { filing, log, current: () => list, kept: () => kept, shown: () => (pending ? pending.apply({ files: list, folders: kept }) : { files: list, folders: kept }) };
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

test('renommer : la mise en forme du nom saisi vient de l\'appelant (un PDF garde son « .pdf »), et la fenêtre la reçoit ; sans elle, le nom est seulement rogné', async () => {
  const withPdf = harness({ answers: [null], cleanName: now => (now.id === '1' ? text => `${text.trim()}.pdf` : undefined) });
  await withPdf.filing.rename(file(1));
  assert.equal(withPdf.log.windows[0].clean(' Facture '), 'Facture.pdf');
  const plain = harness({ answers: [null], cleanName: now => (now.id === '1' ? text => `${text.trim()}.pdf` : undefined) });
  await plain.filing.rename(file(2));
  assert.equal(plain.log.windows[0].clean, undefined, 'la fenêtre prend alors sa mise en forme habituelle');
});

// Couper puis coller (Ctrl+X, Ctrl+V) : le fichier ou le dossier va dans le dossier ouvert, sans fenêtre.
test('coller un fichier coupé : il va dans le dossier ouvert, sans fenêtre, avec son étoile, et la liste est relue', async () => {
  const { filing, log } = harness({ files: [file(1, 'A/B', { pinned: true }), file(2, 'A/B')] });
  assert.equal(await filing.moveFileTo(file(1, 'A/B', { pinned: true }), 'X/Neuf'), 'moved');
  assert.deepEqual(log.writes, [{ entries: [{ app: 'publipostage', file: '1', pinned: true, folder: 'X/Neuf' }] }]);
  assert.deepEqual([log.windows, log.refreshes], [[], 1]);
  assert.equal(await filing.moveFileTo(file(2, 'A/B'), ''), 'moved', 'la racine est un dossier d\'arrivée comme un autre');
  assert.equal(log.writes[1].entries[0].folder, '');
});

test('coller un fichier coupé dans le dossier où il est déjà : rien n\'est écrit, la liste n\'est pas relue ; le fichier est cherché dans la liste relue, pas dans celle que la personne avait', async () => {
  const { filing, log } = harness({ files: [file(1, 'A'), file(2, 'B')] });
  assert.equal(await filing.moveFileTo(file(1, 'ancien dossier'), 'A'), 'same', 'la liste relue dit que le fichier est déjà dans A');
  assert.deepEqual([log.writes, log.refreshes], [[], 0]);
});

test('coller : un document qui ne s\'enregistre pas, ou un rangement refusé, ne déplace rien ; la phrase le dit', async () => {
  const blocked = harness({ block: t('mod.readonly') });
  assert.equal(await blocked.filing.moveFileTo(file(1), 'A'), undefined);
  assert.equal(await blocked.filing.moveFolderTo('A/B', 'X'), undefined);
  assert.deepEqual([blocked.log.notices, blocked.log.writes], [[t('mod.readonly'), t('mod.readonly')], []]);
  const declined = harness({ setFiling: async () => { throw new TableDeclined('GFS_Rangement'); } });
  assert.equal(await declined.filing.moveFileTo(file(1), 'A'), undefined);
  assert.deepEqual(declined.log.notices, [t('ex.filingDeclined')]);
  assert.equal(declined.log.refreshes, 0, 'rien n\'a changé : la liste n\'est pas relue');
});

test('coller un dossier coupé : il va dans le dossier ouvert avec ses sous-dossiers, sous son nom ; chez lui, dans lui-même ou sans fichier, rien ne s\'écrit', async () => {
  const { filing, log } = harness();
  assert.equal(await filing.moveFolderTo('A/B', 'X'), 'moved');
  assert.deepEqual(log.writes[0].entries, [{ app: 'publipostage', file: '2', pinned: false, folder: 'X/B' }, { app: 'publipostage', file: '3', pinned: false, folder: 'X/B/C' }]);
  assert.equal(await filing.moveFolderTo('A/B', 'A'), 'same', 'il est déjà là');
  assert.equal(await filing.moveFolderTo('A', 'A/B'), 'inside', 'un dossier ne va pas dans un de ses sous-dossiers');
  assert.equal(await filing.moveFolderTo('A', 'A'), 'inside');
  assert.equal(await filing.moveFolderTo('Z', 'X'), 'gone', 'plus aucun fichier ne le nomme');
  assert.equal(log.writes.length, 1);
});

// ---------- les dossiers sans fichier (le porteur, 04/11 : « créer des dossiers et sous-dossiers », contrats 6.4, point 11) ----------

test('nouveau dossier : la fenêtre dit où il naît, le dossier est une ligne d\'état, la liste est relue, le chemin est rendu', async () => {
  const { filing, log, kept } = harness({ answers: ['Neuf'] });
  assert.equal(await filing.newFolder(), 'X/Neuf', 'il naît dans le dossier ouvert');
  assert.deepEqual(log.writes, [{ entries: [], folders: { add: ['X/Neuf'] } }]);
  assert.deepEqual(kept(), ['X/Neuf']);
  assert.equal(log.refreshes, 1);
  assert.equal(log.windows[0].title, t('ex.newFolderTitle', { folder: 'X' }));
  assert.equal(log.windows[0].confirmLabel, t('ex.newFolderConfirm'));
  assert.equal(log.windows[0].value, '', 'le champ est vide');
});

test('nouveau dossier : à la racine la fenêtre dit « Moi », un chemin se lit avec « / », dans un dossier donné il naît dedans ; renoncer n\'écrit rien', async () => {
  const { filing, log } = harness({ answers: ['Un', null, 'Deux'] });
  assert.equal(await filing.newFolder(''), 'Un');
  assert.equal(log.windows[0].title, t('ex.newFolderTitle', { folder: t('ex.me') }));
  assert.equal(await filing.newFolder('A/B'), undefined, 'la personne renonce');
  assert.equal(log.windows[1].title, t('ex.newFolderTitle', { folder: 'A / B' }));
  assert.equal(await filing.newFolder('A/B'), 'A/B/Deux');
  assert.deepEqual(log.writes.map(write => write.folders.add), [['Un'], ['A/B/Deux']]);
});

test('nouveau dossier : un nom vide, ou celui d\'un voisin (dossier de fichiers ou dossier gardé ; accents et casse ignorés), est refusé dans la fenêtre ; ailleurs le même nom va', async () => {
  const { filing, log } = harness({ spare: ['X/Vide'], answers: ['ok'] });
  await filing.newFolder('');
  const refuse = log.windows[0].refuse;
  assert.equal(refuse(''), t('ex.nameEmpty'));
  assert.equal(refuse('x'), t('ex.folderTaken'), 'X existe à la racine (un fichier y est)');
  assert.equal(refuse('a'), t('ex.folderTaken'), 'A existe à la racine (ses fichiers sont dessous)');
  assert.equal(refuse('Nouveau'), null);
  await filing.newFolder('X');
  assert.equal(log.windows[1].refuse('vidé'), t('ex.folderTaken'), 'un dossier gardé sans fichier est un voisin comme un autre, accents ignorés');
  assert.equal(log.windows[1].refuse('Vide 2'), null);
  assert.equal(log.windows[1].refuse('B'), null, '« B » existe sous A, pas sous X');
});

test('nouveau dossier : un document qui ne s\'enregistre pas, une table refusée ou un lot que Grist refuse ne créent rien ; la phrase le dit', async () => {
  const blocked = harness({ block: t('mod.readonly'), answers: ['Neuf'] });
  assert.equal(await blocked.filing.newFolder(), undefined);
  assert.deepEqual([blocked.log.notices, blocked.log.windows, blocked.log.writes], [[t('mod.readonly')], [], []]);
  const declined = harness({ answers: ['Neuf'], setFiling: async () => { throw new TableDeclined('GFS_Rangement'); } });
  assert.equal(await declined.filing.newFolder(), undefined);
  assert.deepEqual(declined.log.notices, [t('ex.filingDeclined')]);
  assert.equal(declined.log.refreshes, 0);
});

test('supprimer un dossier : possible sans fichier dedans, ses lignes d\'état et celles de ses sous-dossiers partent, sans fenêtre ; la phrase le dit', async () => {
  const { filing, log, kept } = harness({ spare: ['E', 'E/F', 'EE', 'G'] });
  assert.equal(await filing.deleteFolder('E'), true);
  assert.deepEqual(log.writes, [{ entries: [], folders: { drop: ['E', 'E/F'] } }], '« EE » n\'est pas dans « E »');
  assert.deepEqual(kept(), ['EE', 'G']);
  assert.deepEqual([log.windows, log.refreshes, log.notices], [[], 1, [t('ex.folderDeleted', { name: 'E' })]]);
});

test('supprimer un dossier : un fichier dedans (ou dans un de ses sous-dossiers) le refuse, un dossier qui n\'existe plus aussi ; rien ne s\'écrit', async () => {
  const { filing, log } = harness({ spare: ['A/Vide'] });
  assert.equal(await filing.deleteFolder('A'), false, 'des fichiers sont dans A/B');
  assert.equal(await filing.deleteFolder('A/B/C'), false);
  assert.equal(await filing.deleteFolder('Z'), false, 'plus rien ne le nomme');
  assert.deepEqual(log.notices, [t('ex.folderNotEmpty'), t('ex.folderNotEmpty'), t('ex.folderGone')]);
  assert.deepEqual([log.writes, log.refreshes], [[], 0]);
});

test('supprimer un dossier : un document qui ne s\'enregistre pas ne supprime rien', async () => {
  const { filing, log } = harness({ spare: ['E'], block: t('mod.readonly') });
  assert.equal(await filing.deleteFolder('E'), undefined);
  assert.deepEqual([log.notices, log.writes], [[t('mod.readonly')], []]);
});

test('déplacer un fichier hors de son dernier dossier : le dossier reste, dans le même lot que le fichier ; pas un dossier qui a encore un fichier', async () => {
  const { filing, log, kept } = harness({ files: [file(1, 'P/Q'), file(2, 'P/R'), file(3, 'X')] });
  await filing.moveFileTo(file(1, 'P/Q'), 'X');
  assert.deepEqual(log.writes[0], { entries: [{ app: 'publipostage', file: '1', pinned: false, folder: 'X' }], folders: { add: ['P/Q'], drop: undefined } }, '« P » a encore le fichier 2');
  assert.deepEqual(kept(), ['P/Q']);
  await filing.moveFileTo(file(2, 'P/R'), 'X');
  assert.deepEqual(log.writes[1].folders.add, ['P/R'], 'le dernier fichier de « P » part : « P/R » reste, et « P » est nommé par « P/Q » (gardé)');
  assert.deepEqual(kept(), ['P/Q', 'P/R']);
});

test('déplacer un fichier par la fenêtre, comme le couper-coller : le dossier qu\'il laisse vide reste ; l\'étoile n\'en change aucun', async () => {
  const { filing, log } = harness({ files: [file(1, 'P'), file(2, 'X')], answers: ['X'] });
  await filing.moveFile(file(1, 'P'));
  assert.deepEqual(log.writes[0].folders.add, ['P']);
  await filing.togglePin(file(2, 'X'));
  assert.equal('folders' in log.writes[1], false, 'épingler ne change aucun dossier');
});

test('renommer un dossier gardé sans fichier : sa ligne d\'état est réécrite, rien d\'autre ; son nom passe les mêmes règles', async () => {
  const { filing, log, kept } = harness({ spare: ['E', 'E/F'], answers: ['Neuf'] });
  await filing.renameFolder('E');
  assert.deepEqual(log.writes, [{ entries: [], folders: { add: [], drop: [], merged: [], moved: [['E', 'Neuf'], ['E/F', 'Neuf/F']] } }], 'leur ligne change de chemin sur place');
  assert.deepEqual(kept(), ['Neuf', 'Neuf/F']);
  assert.equal(log.refreshes, 1);
});

test('renommer un dossier : ses fichiers et ses sous-dossiers vides le suivent dans le même lot ; ses parents ne restent pas derrière quand un fichier les nomme encore', async () => {
  const { filing, log } = harness({ spare: ['A/B/Vide', 'A/Autre'], answers: ['Neuf'] });
  await filing.renameFolder('A/B');
  assert.deepEqual(log.writes[0].entries.map(entry => entry.folder), ['A/Neuf', 'A/Neuf/C']);
  assert.deepEqual(log.writes[0].folders, { add: [], drop: [], merged: [], moved: [['A/B/Vide', 'A/Neuf/Vide']] }, '« A » a encore ses fichiers : rien ne reste derrière');
});

test('déplacer un dossier hors de son parent : le parent qui n\'a plus rien reste, comme après un déplacement de fichier ; le dossier lui-même ne reste pas derrière', async () => {
  const { filing, log } = harness({ files: [file(1, 'P/Q'), file(2, 'X')] });
  assert.equal(await filing.moveFolderTo('P/Q', 'X'), 'moved');
  assert.deepEqual(log.writes[0], { entries: [{ app: 'publipostage', file: '1', pinned: false, folder: 'X/Q' }], folders: { add: ['P'], drop: [], merged: [], moved: [] } });
});

test('déplacer un dossier gardé sans fichier : il va dans le dossier d\'arrivée avec ses sous-dossiers ; « gone » seulement quand plus rien ne le nomme', async () => {
  const { filing, log, kept } = harness({ spare: ['E', 'E/F'] });
  assert.equal(await filing.moveFolderTo('E', 'X'), 'moved');
  assert.deepEqual(log.writes[0], { entries: [], folders: { add: [], drop: [], merged: [], moved: [['E', 'X/E'], ['E/F', 'X/E/F']] } });
  assert.deepEqual(kept(), ['X/E', 'X/E/F']);
  assert.equal(await filing.moveFolderTo('Z', 'X'), 'gone');
  assert.equal(log.writes.length, 1);
});

test('déplacer ou renommer un dossier que plus rien ne nomme : la phrase dit qu\'il n\'existe plus, rien ne s\'écrit', async () => {
  const { filing, log } = harness({ answers: ['Neuf', 'X'] });
  await filing.renameFolder('Z');
  await filing.moveFolder('Z');
  assert.deepEqual(log.notices, [t('ex.folderGone'), t('ex.folderGone')]);
  assert.deepEqual([log.writes, log.refreshes], [[], 0]);
});

test('la fenêtre du déplacement propose aussi les dossiers gardés sans fichier (on y range ce qu\'on veut)', async () => {
  const { filing, log } = harness({ spare: ['E', 'E/F'], answers: [null] });
  await filing.moveFile(file(1));
  assert.deepEqual(log.windows[0].folders, ['A', 'A/B', 'A/B/C', 'E', 'E/F', 'X']);
});

test('mettre un fichier à la corbeille : son dossier, resté sans fichier, est gardé, en sourdine (sans la table, rien ne s\'écrit et rien n\'est demandé) ; la liste peut déjà l\'avoir perdu', async () => {
  const calls = [];
  const { filing } = harness({ files: [file(1, 'P/Q'), file(2, 'P/R'), file(3, 'X')], setFiling: async (entries, folders) => { calls.push({ entries, folders }); } });
  await filing.keepFoldersOf(file(1, 'P/Q'));
  assert.deepEqual(calls, [{ entries: [], folders: { add: ['P/Q'], quiet: true } }], '« P » a encore le fichier 2');
  calls.length = 0;
  await filing.keepFoldersOf(file(2, 'P/R'));
  await filing.keepFoldersOf(file(3, 'X'));
  assert.deepEqual(calls.map(call => call.folders.add), [['P/R'], ['X']], 'le fichier 2 était le dernier de « P/R », le 3 le seul de « X » ; « P » a toujours le fichier 1');
  calls.length = 0;
  await filing.keepFoldersOf(file(9, 'Z/Z'));
  assert.deepEqual(calls.map(call => call.folders.add), [['Z', 'Z/Z']], 'un fichier que la liste ne connaît plus (relue avant) garde son dossier aussi');
});

test('mettre à la corbeille un fichier dont le dossier a un autre fichier, ou est déjà gardé : rien ne s\'écrit', async () => {
  const calls = [];
  const { filing } = harness({ files: [file(1, 'P'), file(2, 'P')], spare: ['E'], setFiling: async (entries, folders) => { calls.push({ entries, folders }); } });
  await filing.keepFoldersOf(file(1, 'P'));
  assert.deepEqual(calls, []);
});

// ---------- Ctrl+Z : chaque geste qui a abouti dépose de quoi se défaire (js/files/undo-stack.js) ----------

const placesOf = list => list.map(item => [item.id, item.folder, item.pinned]);

test('Ctrl+Z après l\'étoile : le fichier retrouve son état d\'avant, et la phrase le dit ; défaire ne se défait pas', async () => {
  const { filing, log, current } = harness();
  const first = placesOf(current());
  await filing.togglePin(file(1));
  assert.equal(current()[0].pinned, true);
  assert.equal(filing.undoStack.size, 1);
  await filing.undoStack.undo();
  assert.deepEqual(placesOf(current()), first);
  assert.equal(log.notices.at(-1), t('undo.unpinned', { name: 'Modèle 1' }));
  assert.equal(filing.undoStack.size, 0, 'l\'annulation n\'a rien déposé');
  await filing.undoStack.undo();
  assert.equal(log.notices.at(-1), t('undo.nothing'));
});

test('Ctrl+Z après avoir épinglé puis retiré l\'épingle : les deux se défont dans l\'ordre inverse', async () => {
  const { filing, current, log } = harness();
  await filing.togglePin(file(1));
  await filing.togglePin(file(1));
  assert.equal(current()[0].pinned, false);
  await filing.undoStack.undo();
  assert.equal(current()[0].pinned, true);
  assert.equal(log.notices.at(-1), t('undo.pinned', { name: 'Modèle 1' }));
  await filing.undoStack.undo();
  assert.equal(current()[0].pinned, false);
});

test('Ctrl+Z après un déplacement (fenêtre, couper-coller, glisser-déposer) : le fichier revient dans son dossier ; « Moi » dit la racine', async () => {
  const { filing, log, current } = harness({ answers: ['Z'] });
  await filing.moveFile(file(2, 'A/B'));
  assert.equal(current()[1].folder, 'Z');
  await filing.undoStack.undo();
  assert.equal(current()[1].folder, 'A/B');
  assert.equal(log.notices.at(-1), t('undo.moved', { name: 'Modèle 2', folder: 'A/B' }));
  await filing.moveFileTo(file(4, 'X'), '');
  await filing.undoStack.undo();
  assert.equal(current()[3].folder, 'X');
  await filing.moveFileTo(file(1), 'Q');
  await filing.undoStack.undo();
  assert.equal(current()[0].folder, '');
  assert.equal(log.notices.at(-1), t('undo.moved', { name: 'Modèle 1', folder: t('ex.me') }));
});

test('Ctrl+Z après un déplacement qui laissait un dossier vide : le dossier gardé par le déplacement n\'est plus gardé, le fichier est de retour', async () => {
  const { filing, current, kept } = harness();
  await filing.moveFileTo(file(4, 'X'), 'Y');
  assert.deepEqual(kept(), ['X'], 'le déplacement garde le dossier que le fichier laisse vide');
  await filing.undoStack.undo();
  assert.equal(current()[3].folder, 'X');
  assert.deepEqual(kept(), [], 'le fichier est revenu dans « X » : plus rien à y garder');
});

test('Ctrl+Z après avoir déplacé ou renommé un dossier : ses fichiers et les dossiers qu\'on y gardait sans fichier reviennent', async () => {
  const { filing, current, kept } = harness({ spare: ['A/B/Vide'], answers: ['X', 'Bis'] });
  const first = placesOf(current());
  await filing.moveFolder('A/B');
  assert.deepEqual(current().map(item => item.folder), ['', 'X/B', 'X/B/C', 'X']);
  assert.deepEqual(kept(), ['X/B/Vide', 'A'], 'le dossier vidé (A) est gardé avec le dossier qu\'on y gardait');
  await filing.undoStack.undo();
  assert.deepEqual(placesOf(current()), first);
  assert.deepEqual(kept(), ['A/B/Vide']);
  await filing.renameFolder('A/B');
  await filing.undoStack.undo();
  assert.deepEqual(placesOf(current()), first);
  assert.deepEqual(kept(), ['A/B/Vide']);
  const { filing: other, log, current: list } = harness();
  await other.moveFolderTo('A/B', 'X');
  await other.undoStack.undo();
  assert.deepEqual(list().map(item => item.folder), ['', 'A/B', 'A/B/C', 'X']);
  assert.equal(log.notices.at(-1), t('undo.folder', { name: 'B' }));
});

test('Ctrl+Z après « Nouveau dossier » : le dossier est supprimé ; après « Supprimer le dossier » : il revient', async () => {
  const { filing, kept, log } = harness({ answers: ['Neuf'] });
  assert.equal(await filing.newFolder('X'), 'X/Neuf');
  assert.deepEqual(kept(), ['X/Neuf']);
  await filing.undoStack.undo();
  assert.deepEqual(kept(), []);
  assert.equal(log.notices.at(-1), t('undo.folderCreated', { name: 'Neuf' }));
  const empty = harness({ spare: ['Vide', 'Vide/Sous'] });
  assert.equal(await empty.filing.deleteFolder('Vide'), true);
  assert.deepEqual(empty.kept(), []);
  await empty.filing.undoStack.undo();
  assert.deepEqual(empty.kept(), ['Vide', 'Vide/Sous']);
  assert.equal(empty.log.notices.at(-1), t('undo.folder', { name: 'Vide' }));
});

test('Ctrl+Z après un renommage : l\'ancien nom est réécrit dans la colonne du nom, la liste est relue', async () => {
  const { filing, log, current } = harness({ answers: ['Convocation 2026'] });
  await filing.rename(file(2));
  assert.equal(current()[1].name, 'Convocation 2026');
  await filing.undoStack.undo();
  assert.deepEqual(log.actions.at(-1), ['UpdateRecord', 'Publipostage_modeles', 20, { Nom: 'Modèle 2' }]);
  assert.equal(current()[1].name, 'Modèle 2');
  assert.equal(log.notices.at(-1), t('undo.renamed', { name: 'Modèle 2' }));
  assert.equal(log.refreshes, 2);
  assert.equal(filing.undoStack.size, 0);
});

test('Ctrl+Z après deux renommages : le second est défait en premier, puis le premier', async () => {
  const { filing, current } = harness({ answers: ['Neuf', 'Encore'] });
  await filing.rename(file(2));
  await filing.rename(file(2));
  await filing.undoStack.undo();
  assert.equal(current()[1].name, 'Neuf');
  await filing.undoStack.undo();
  assert.equal(current()[1].name, 'Modèle 2');
});

test('Ctrl+Z après un renommage : un fichier qui a changé depuis, qui n\'est plus là, ou dont l\'ancien nom est pris n\'est pas touché, et la phrase le dit', async () => {
  const drifted = harness({ answers: ['Neuf'] });
  await drifted.filing.rename(file(2));
  drifted.current()[1].name = 'Par une autre personne';
  await drifted.filing.undoStack.undo();
  assert.equal(drifted.log.notices.at(-1), t('undo.changed', { name: 'Neuf' }));
  assert.equal(drifted.log.actions.length, 1, 'rien n\'est écrit');
  const gone = harness({ answers: ['Neuf'] });
  await gone.filing.rename(file(2));
  gone.current().splice(1, 1);
  await gone.filing.undoStack.undo();
  assert.equal(gone.log.notices.at(-1), t('undo.gone', { name: 'Neuf' }));
  const taken = harness({ answers: ['Neuf'] });
  await taken.filing.rename(file(2));
  taken.current()[0].name = 'Modèle 2';
  await taken.filing.undoStack.undo();
  assert.equal(taken.log.notices.at(-1), t('ex.nameTaken', { app: 'Publipostage+' }));
  assert.equal(taken.log.actions.length, 1);
});

test('un geste qui n\'aboutit pas ne dépose rien à défaire (table refusée, écriture refusée, même nom, même dossier)', async () => {
  const declined = harness({ setFiling: async () => { throw new TableDeclined(); } });
  await declined.filing.togglePin(file(1));
  assert.equal(declined.filing.undoStack.size, 0);
  const same = harness({ answers: ['Modèle 1', null, 'A/B'] });
  await same.filing.rename(file(1));
  await same.filing.rename(file(1));
  await same.filing.moveFile(file(2, 'A/B'));
  await same.filing.moveFileTo(file(2, 'A/B'), 'A/B');
  assert.equal(same.filing.undoStack.size, 0);
});

test('Ctrl+Z dans un document qui ne s\'enregistre plus : rien n\'est écrit, la personne lit pourquoi', async () => {
  const { filing, log } = harness({ block: t('mod.readonly') });
  filing.undoStack.push({ run: () => filing.togglePin(file(1)) });
  await filing.undoStack.undo();
  assert.deepEqual([log.notices, log.writes], [[t('mod.readonly')], []]);
});

// ---------- Ctrl+Y : ce que Ctrl+Z a défait se refait, avec sa phrase « Rétabli » ----------

test('Ctrl+Y après Ctrl+Z d\'une étoile : l\'étoile revient, la phrase le dit ; Ctrl+Z puis Ctrl+Y ne tournent pas en rond, un cran par appui', async () => {
  const { filing, log, current } = harness();
  await filing.togglePin(file(1));
  assert.equal(current()[0].pinned, true);
  await filing.undoStack.undo();
  assert.equal(current()[0].pinned, false);
  await filing.undoStack.redo();
  assert.equal(current()[0].pinned, true);
  assert.equal(log.notices.at(-1), t('redo.pinned', { name: 'Modèle 1' }));
  await filing.undoStack.redo();
  assert.equal(log.notices.at(-1), t('redo.nothing'));
  await filing.undoStack.undo();
  assert.equal(current()[0].pinned, false, 'le rétablissement a déposé de quoi se défaire de nouveau');
  assert.equal(log.notices.at(-1), t('undo.unpinned', { name: 'Modèle 1' }));
});

test('Ctrl+Y après avoir retiré une étoile : « n\'est plus épinglé »', async () => {
  const { filing, log, current } = harness({ files: [{ ...file(1), pinned: true }] });
  await filing.togglePin(file(1));
  await filing.undoStack.undo();
  assert.equal(current()[0].pinned, true);
  await filing.undoStack.redo();
  assert.equal([current()[0].pinned, log.notices.at(-1)].join('|'), `false|${t('redo.unpinned', { name: 'Modèle 1' })}`);
});

test('Ctrl+Y après un déplacement : le fichier retourne dans le dossier où il était allé, « Moi » dit la racine', async () => {
  const { filing, log, current } = harness({ answers: ['Z'] });
  await filing.moveFile(file(2, 'A/B'));
  await filing.undoStack.undo();
  assert.equal(current()[1].folder, 'A/B');
  await filing.undoStack.redo();
  assert.equal(current()[1].folder, 'Z');
  assert.equal(log.notices.at(-1), t('redo.moved', { name: 'Modèle 2', folder: 'Z' }));
  await filing.moveFileTo(file(4, 'X'), '');
  await filing.undoStack.undo();
  await filing.undoStack.redo();
  assert.equal(current()[3].folder, '');
  assert.equal(log.notices.at(-1), t('redo.moved', { name: 'Modèle 4', folder: t('ex.me') }));
});

test('Ctrl+Y après un déplacement qui laissait un dossier vide : le dossier gardé revient aussi', async () => {
  const { filing, current, kept } = harness();
  await filing.moveFileTo(file(4, 'X'), 'Y');
  await filing.undoStack.undo();
  assert.deepEqual(kept(), []);
  await filing.undoStack.redo();
  assert.deepEqual([current()[3].folder, kept()], ['Y', ['X']]);
});

test('Ctrl+Y après un dossier créé, supprimé, déplacé ou renommé : chacun se refait, avec sa phrase', async () => {
  const created = harness({ answers: ['Neuf'] });
  await created.filing.newFolder('');
  await created.filing.undoStack.undo();
  assert.deepEqual(created.kept(), []);
  await created.filing.undoStack.redo();
  assert.deepEqual(created.kept(), ['Neuf']);
  assert.equal(created.log.notices.at(-1), t('redo.folderCreated', { name: 'Neuf' }));
  const deleted = harness({ spare: ['Vide'] });
  await deleted.filing.deleteFolder('Vide');
  await deleted.filing.undoStack.undo();
  assert.deepEqual(deleted.kept(), ['Vide']);
  await deleted.filing.undoStack.redo();
  assert.deepEqual(deleted.kept(), []);
  assert.equal(deleted.log.notices.at(-1), t('redo.folderDeleted', { name: 'Vide' }));
  const moved = harness();
  await moved.filing.moveFolderTo('A/B', 'Q');
  const after = moved.current().map(each => each.folder);
  await moved.filing.undoStack.undo();
  await moved.filing.undoStack.redo();
  assert.deepEqual(moved.current().map(each => each.folder), after);
  assert.equal(moved.log.notices.at(-1), t('redo.folder', { name: 'B' }));
});

test('Ctrl+Y après un renommage : le nom d\'après revient, la phrase le dit ; Ctrl+Z puis Ctrl+Y puis Ctrl+Z défait encore', async () => {
  const { filing, log, current } = harness({ answers: ['Neuf'] });
  await filing.rename(file(2));
  await filing.undoStack.undo();
  assert.equal(current()[1].name, 'Modèle 2');
  await filing.undoStack.redo();
  assert.equal(current()[1].name, 'Neuf');
  assert.equal(log.notices.at(-1), t('redo.renamed', { name: 'Neuf' }));
  await filing.undoStack.undo();
  assert.equal(current()[1].name, 'Modèle 2');
});

test('Ctrl+Y d\'un renommage : un fichier qui a changé depuis, ou qui n\'est plus là, n\'est pas touché, et la phrase dit « rétabli » (pas « annulé »)', async () => {
  const drifted = harness({ answers: ['Neuf'] });
  await drifted.filing.rename(file(2));
  await drifted.filing.undoStack.undo();
  drifted.current()[1].name = 'Par une autre personne';
  await drifted.filing.undoStack.redo();
  assert.equal(drifted.log.notices.at(-1), t('redo.changed', { name: 'Modèle 2' }));
  const gone = harness({ answers: ['Neuf'] });
  await gone.filing.rename(file(2));
  await gone.filing.undoStack.undo();
  gone.current().splice(1, 1);
  await gone.filing.undoStack.redo();
  assert.equal(gone.log.notices.at(-1), t('redo.gone', { name: 'Modèle 2' }));
});

test('un geste neuf après Ctrl+Z vide le rétablissement : Ctrl+Y n\'écrit rien', async () => {
  const { filing, log, current } = harness();
  await filing.togglePin(file(1));
  await filing.undoStack.undo();
  await filing.togglePin(file(2));
  const writes = log.writes.length;
  await filing.undoStack.redo();
  assert.equal(log.notices.at(-1), t('redo.nothing'));
  assert.deepEqual([log.writes.length, current()[0].pinned, current()[1].pinned], [writes, false, true]);
});

test('Ctrl+Y dans un document qui ne s\'enregistre plus : rien n\'est écrit, la personne lit pourquoi', async () => {
  const lock = harness({ block: t('mod.readonly') });
  lock.filing.undoStack.push({ run: () => { lock.filing.undoStack.push({ run: () => lock.filing.togglePin(file(1)) }); return 'défait'; } });
  await lock.filing.undoStack.undo();
  await lock.filing.undoStack.redo();
  assert.deepEqual([lock.log.notices.at(-1), lock.log.writes], [t('mod.readonly'), []]);
});

// Un dossier de « Moi » partagé : ses partages portent le numéro de sa ligne d'état (js/sharing/folder-identity.js), la ligne change de chemin sur place.
const shares = (over = {}) => {
  const calls = [];
  return { calls, relocation: async (...args) => { calls.push(['relocation', ...args]); return { refuse: null, extra: [], lost: 0, spare: [], ...over }; },
    removal: async paths => { calls.push(['removal', paths]); return { refuse: null, extra: [], removed: 0, ...over }; } };
};

test('renommer un dossier partagé : sa ligne d\'état change de chemin sur place, ses partages passent au numéro dans le même lot, rien n\'est refusé', async () => {
  const extra = [['UpdateRecord', 'GFS_Partages', 3, { Cible: 'dossier:moi:a@b.fr//9' }]];
  const folderShares = shares({ extra });
  const { filing, log, kept } = harness({ spare: ['A/B'], answers: ['Neuf'], folderShares });
  await filing.renameFolder('A/B');
  assert.deepEqual(folderShares.calls, [['relocation', 'A/B', 'A/Neuf', ['A', 'A/B', 'A/B/C', 'X']]], 'les dossiers qui existent sont dits (les chemins à l\'ancienne mode d\'un dossier disparu sont laissés)');
  assert.deepEqual(log.writes[0].folders, { add: [], drop: [], merged: [], moved: [['A/B', 'A/Neuf']], extra });
  assert.deepEqual(kept(), ['A/Neuf']);
  assert.deepEqual(log.notices, []);
});

test('renommer un dossier dont la ligne d\'état n\'est pas dans la liste de l\'explorateur (créée à l\'instant par la fenêtre « Partager… », ou pour un partage ancien) : elle suit le déplacement avec les autres', async () => {
  const folderShares = shares({ spare: ['A/B'] });
  const { filing, log } = harness({ answers: ['Neuf'], folderShares });
  await filing.renameFolder('A/B');
  assert.deepEqual(log.writes[0].folders.moved, [['A/B', 'A/Neuf']]);
});

test('un lien empêche de renommer, de déplacer ou de supprimer : la phrase est dite, rien n\'est écrit', async () => {
  const folderShares = shares({ refuse: 'ex.folderLinked' });
  const { filing, log } = harness({ spare: ['A/B', 'E'], answers: ['Neuf', 'X'], folderShares });
  await filing.renameFolder('A/B');
  assert.equal(await filing.moveFolderTo('A/B', 'X'), undefined);
  assert.equal(await filing.deleteFolder('E'), false);
  assert.deepEqual(log.notices, Array(3).fill(t('ex.folderLinked')));
  assert.deepEqual([log.writes, log.refreshes], [[], 0]);
});

test('un dossier fondu dans un dossier qui existe déjà : la phrase dit combien de partages n\'ont pas suivi', async () => {
  const { filing, log } = harness({ spare: ['A/B', 'X/B'], folderShares: shares({ lost: 2 }) });
  assert.equal(await filing.moveFolderTo('A/B', 'X'), 'moved');
  assert.equal(log.notices.at(-1), t('ex.folderMerged', { name: 'B', n: 2 }));
  assert.deepEqual([log.writes[0].folders.moved, log.writes[0].folders.merged], [[], [['A/B', 'X/B']]], 'sa ligne n\'est pas déplacée : elle est retirée');
});

test('supprimer un dossier partagé : ses partages partent dans le même lot (le numéro d\'une ligne supprimée peut être redonné à un dossier neuf), la phrase les compte', async () => {
  const extra = [['RemoveRecord', 'GFS_Partages', 4], ['RemoveRecord', 'GFS_Partages', 5]];
  const folderShares = shares({ extra, removed: 2 });
  const { filing, log, kept } = harness({ spare: ['E', 'E/F', 'G'], folderShares });
  assert.equal(await filing.deleteFolder('E'), true);
  assert.deepEqual(folderShares.calls, [['removal', ['E', 'E/F']]]);
  assert.deepEqual(log.writes, [{ entries: [], folders: { drop: ['E', 'E/F'], extra } }]);
  assert.deepEqual(kept(), ['G']);
  assert.equal(log.notices.at(-1), t('ex.folderDeletedShared', { name: 'E', n: 2 }));
});

test('Ctrl+Z après avoir renommé un dossier gardé : sa ligne retourne à son chemin, sur place (le numéro que les partages portent ne change pas)', async () => {
  const { filing, log, kept } = harness({ spare: ['E'], answers: ['Neuf'], folderShares: shares() });
  await filing.renameFolder('E');
  assert.deepEqual(kept(), ['Neuf']);
  await filing.undoStack.undo();
  assert.deepEqual(log.writes.at(-1).folders, { add: [], drop: [], moved: [['Neuf', 'E']] });
  assert.deepEqual(kept(), ['E']);
});

test('Ctrl+Z après une fusion : le dossier qui arrivait retrouve une ligne à son ancien chemin (celle qui a été retirée ne revient pas)', async () => {
  const { filing, kept } = harness({ spare: ['E', 'X/E'], folderShares: shares() });
  await filing.moveFolderTo('E', 'X');
  assert.deepEqual(kept(), ['X/E'], 'la ligne de « E » est retirée, celle de « X/E » reste');
  await filing.undoStack.undo();
  assert.deepEqual(kept().sort(), ['E', 'X/E']);
});

// ---------- afficher avant d'écrire (js/explorer/pending.js ; étude du 23/11) ----------

// Une écriture que le test laisse partir à la main : `go()` la libère.
const held = () => { let go; const hold = new Promise(resolve => { go = resolve; }); return { hold, go }; };
const instant = (options = {}) => { const pending = new Pending(); return { pending, ...harness({ pending, ...options }) }; };

test('un dossier neuf s\'affiche tout de suite, avant que Grist n\'ait rien reçu ; une fois écrit, il reste affiché et la liste se relit sans rien dire', async () => {
  const { hold, go } = held();
  const { filing, log, kept, shown } = instant({ answers: ['Neuf'], hold });
  assert.equal(await filing.newFolder(''), 'Neuf');
  assert.deepEqual([shown().folders, log.writes, kept()], [['Neuf'], [], []], 'la personne le voit ; Grist n\'a encore rien reçu');
  assert.equal(filing.undoStack.size, 0, 'rien à défaire tant que ce n\'est pas écrit');
  go();
  await filing.settled();
  assert.deepEqual(log.writes, [{ entries: [], folders: { add: ['Neuf'] } }]);
  assert.deepEqual([log.refreshes, log.refreshed], [1, [{ quiet: true }]], 'une seule relecture, et discrète');
  assert.equal(filing.undoStack.size, 1);
});

test('Grist refuse : le dossier s\'en va, la phrase dit pourquoi, rien n\'est à défaire', async () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    const { hold, go } = held();
    const { filing, log, shown } = instant({ answers: ['Neuf'], hold, refuse: 'Grist dit non' });
    await filing.newFolder('');
    assert.deepEqual(shown().folders, ['Neuf']);
    go();
    await filing.settled();
    assert.deepEqual(shown().folders, [], 'le dossier a disparu');
    assert.deepEqual(log.notices, [t('ex.filingFailed', { reason: 'Grist dit non' })]);
    assert.equal(filing.undoStack.size, 0);
  } finally { console.warn = warn; }
});

test('l\'étoile s\'allume tout de suite, et deux clics rapides s\'écrivent dans l\'ordre où ils ont été faits', async () => {
  const { hold, go } = held();
  const { filing, log, shown } = instant({ hold });
  const stale = file(1);
  await filing.togglePin(stale);
  assert.equal(shown().files[0].pinned, true);
  await filing.togglePin(stale); // le second part de ce que la personne voit : il éteint
  assert.equal(shown().files[0].pinned, false);
  go();
  await filing.settled();
  assert.deepEqual(log.writes.map(write => write.entries[0].pinned), [true, false]);
});

test('un geste refusé n\'emporte pas les autres : seul son changement s\'en va', async () => {
  const { filing, shown, log } = instant({ answers: ['Un', 'Deux'], setFiling: async (entries, folders = {}) => { if ((folders.add || []).includes('Un')) throw new Error('refus'); log2.push(folders.add); } });
  const log2 = [];
  const warn = console.warn;
  console.warn = () => {};
  try {
    await filing.newFolder('');
    await filing.newFolder('');
    await filing.settled();
  } finally { console.warn = warn; }
  assert.deepEqual([shown().folders, log2], [['Deux'], [['Deux']]]);
  assert.equal(log.notices.length, 1);
});

test('la table du rangement jamais vue : le geste s\'écrit d\'abord (elle se crée avec l\'accord de la personne), puis la liste se relit en entier', async () => {
  const { hold, go } = held();
  const { filing, log, shown } = instant({ answers: ['Neuf'], hold, known: false });
  const done = filing.newFolder('');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(shown().folders, [], 'rien ne s\'affiche avant l\'accord : la question pourrait être refusée');
  go();
  assert.equal(await done, 'Neuf');
  assert.deepEqual([shown().folders, log.refreshed], [['Neuf'], [undefined]], 'écrit puis relu, avec « Lecture des fichiers… »');
});

test('un dossier partagé qui s\'écrit avec ses partages : le geste attend Grist (le numéro de sa ligne est l\'identité du partage)', async () => {
  const { hold, go } = held();
  const folderShares = { removal: async () => ({ extra: [['RemoveRecord', 'GFS_Partages', 7]], removed: 1 }) };
  const { filing, log, shown } = instant({ spare: ['Partagé'], hold, folderShares });
  const done = filing.deleteFolder('Partagé');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(shown().folders, ['Partagé'], 'le dossier est encore là tant que Grist n\'a pas répondu');
  go();
  assert.equal(await done, true);
  assert.deepEqual([shown().folders, log.refreshes], [[], 1]);
});

test('un dossier vide qui se supprime s\'en va tout de suite ; Grist refuse : il revient avec la phrase', async () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    const { hold, go } = held();
    const { filing, shown, log } = instant({ spare: ['Vide'], hold, refuse: 'Grist dit non' });
    assert.equal(await filing.deleteFolder('Vide'), true);
    assert.deepEqual(shown().folders, [], 'disparu pour la personne');
    go();
    await filing.settled();
    assert.deepEqual(shown().folders, ['Vide'], 'il revient');
    assert.match(log.notices.at(-1), /Grist dit non/);
  } finally { console.warn = warn; }
});

test('renommer un dossier : ses fichiers et ses sous-dossiers suivent à l\'écran tout de suite, dans un seul changement', async () => {
  const { hold, go } = held();
  const { filing, shown, log } = instant({ answers: ['Bis'], hold, spare: ['A/B/Z'] });
  await filing.renameFolder('A/B');
  assert.deepEqual(shown().files.map(item => item.folder), ['', 'A/Bis', 'A/Bis/C', 'X']);
  assert.deepEqual(shown().folders, ['A/Bis/Z']);
  go();
  await filing.settled();
  assert.equal(log.writes.length, 1, 'un seul lot, comme avant');
});

test('déplacer un fichier : il change de dossier à l\'écran, et le dossier qu\'il laisse vide reste affiché', async () => {
  const { filing, shown } = instant({ answers: ['A'], hold: new Promise(() => {}) });
  await filing.moveFile(file(4, 'X'));
  assert.deepEqual(shown().files.map(item => item.folder), ['', 'A/B', 'A/B/C', 'A']);
  assert.deepEqual(shown().folders, ['X']);
});

test('renommer un fichier : le nom change tout de suite ; la colonne manque ou Grist refuse : l\'ancien nom revient avec la phrase', async () => {
  const { hold, go } = held();
  const ok = instant({ answers: ['Nouveau nom'], hold });
  await ok.filing.rename(file(1));
  assert.equal(ok.shown().files[0].name, 'Nouveau nom');
  assert.deepEqual(ok.log.actions, [], 'Grist n\'a encore rien reçu');
  go();
  await ok.filing.settled();
  assert.deepEqual(ok.log.actions, [['UpdateRecord', 'Publipostage_modeles', 10, { Nom: 'Nouveau nom' }]]);
  assert.equal(ok.filing.undoStack.size, 1);
  const missing = instant({ answers: ['Autre'], meta: { ...META, _grist_Tables_column: { id: [2], parentId: [2], colId: ['Nom'] } } });
  await missing.filing.rename(file(1));
  assert.equal(missing.shown().files[0].name, 'Autre');
  await missing.filing.settled();
  assert.equal(missing.shown().files[0].name, 'Modèle 1');
  assert.deepEqual(missing.log.notices, [t('ex.renameNoColumn', { app: 'Publipostage+' })]);
  assert.deepEqual(missing.log.actions, [], 'une colonne absente n\'est jamais écrite');
});

test('Ctrl+Z juste après un geste affiché d\'avance attend son écriture, puis le défait ; Ctrl+Y le refait', async () => {
  const { hold, go } = held();
  const { filing, shown, log } = instant({ answers: ['Neuf'], hold });
  await filing.newFolder('');
  const undone = filing.undoStack.undo(); // l'écriture n'est pas partie : il n'y a encore rien à défaire
  go();
  assert.equal(await undone, true);
  await filing.settled();
  assert.deepEqual(shown().folders, [], 'le dossier est retiré');
  assert.deepEqual(log.writes.map(write => write.folders), [{ add: ['Neuf'] }, { add: [], drop: ['Neuf'], moved: [] }]);
  assert.deepEqual([filing.undoStack.size, filing.undoStack.redoSize], [0, 1], 'de quoi refaire est dans la pile du rétablissement, pas dans celle des annulations');
  assert.equal(await filing.undoStack.redo(), true);
  await filing.settled();
  assert.deepEqual(shown().folders, ['Neuf']);
});

test('un geste qui s\'écrit d\'abord (un fichier rangé par une copie) attend derrière les écritures déjà parties', async () => {
  const { hold, go } = held();
  const { filing, log } = instant({ answers: ['Neuf'], hold });
  await filing.newFolder('');
  const copied = filing.rangeNew([{ app: 'publipostage', file: '9', pinned: false, folder: 'Neuf' }]);
  go();
  await copied;
  assert.deepEqual(log.writes.map(write => (write.folders ? 'dossier' : 'copie')), ['dossier', 'copie']);
});
