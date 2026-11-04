// Le presse-papiers de l'explorateur (js/explorer-clipboard.js) : copier, couper, coller. La copie (js/copying.js) et le rangement (js/filing.js) sont des doublures ; ce que le vrai explorateur en fait,
// à la vraie touche, se mesure sous Firefox (test/interfaces-firefox.test.mjs) et dans un vrai Grist (labo/run-copie.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Clipboard } from '../js/explorer-clipboard.js';
import { FR, EN } from './kept-setup.mjs';

const file = (id, name = `Fichier ${id}`, app = 'gfs-fichiers') => ({ key: `${app}:${id}`, app, id, name });

function setup({ files = [file('aa', 'Facture.pdf'), file('bb', 'Devis.pdf'), file('cc', 'Convocation', 'publipostage')], where = { view: 'folder', path: 'Factures' }, i18n = FR, copyable = ['gfs-fichiers'], filing = {}, copy = null } = {}) {
  const log = { notices: [], copies: [], moves: [], revealed: [] };
  const place = { ...where };
  const clipboard = new Clipboard({
    t: i18n.t, notice: text => log.notices.push(text), appName: id => (id === 'publipostage' ? 'Publipostage+' : id), file: key => files.find(item => item.key === key), where: () => place,
    reveal: key => log.revealed.push(key),
    copying: {
      handles: item => copyable.includes(item.app),
      copy: copy || (async (item, folder) => { log.copies.push([item.key, folder]); return { key: `${item.app}:neuf`, name: `${item.name} (1)` }; }),
    },
    filing: {
      moveFileTo: async (item, folder) => { log.moves.push(['file', item.key, folder]); return 'moved'; },
      moveFolderTo: async (path, folder) => { log.moves.push(['folder', path, folder]); return 'moved'; },
      ...filing,
    },
  });
  return { clipboard, log, place };
}

test('copier un fichier : la phrase dit comment le coller ; rien n\'est écrit', () => {
  const { clipboard, log } = setup();
  clipboard.take('gfs-fichiers:aa', 'copy');
  assert.deepEqual(clipboard.held, { mode: 'copy', key: 'gfs-fichiers:aa', name: 'Facture.pdf' });
  assert.deepEqual(log.notices, [FR.t('clip.copied', { name: 'Facture.pdf' })]);
  assert.deepEqual([log.copies, log.moves], [[], []]);
});

test('coller une copie : le fichier est copié dans le dossier ouvert, la nouvelle ligne prend le clavier, et la copie peut se coller encore', async () => {
  const { clipboard, log } = setup();
  clipboard.take('gfs-fichiers:aa', 'copy');
  await clipboard.paste();
  await clipboard.paste();
  assert.deepEqual(log.copies, [['gfs-fichiers:aa', 'Factures'], ['gfs-fichiers:aa', 'Factures']]);
  assert.deepEqual(log.revealed, ['gfs-fichiers:neuf', 'gfs-fichiers:neuf']);
  assert.equal(clipboard.held.key, 'gfs-fichiers:aa', 'une copie reste à coller');
});

test('coller dans un autre dossier : la copie y va, à la racine aussi (« Moi » : le chemin vide)', async () => {
  const { clipboard, log, place } = setup();
  clipboard.take('gfs-fichiers:aa', 'copy');
  place.path = 'Autre/Dossier';
  await clipboard.paste();
  place.path = '';
  await clipboard.paste();
  assert.deepEqual(log.copies.map(copy => copy[1]), ['Autre/Dossier', '']);
});

test('couper puis coller : le fichier est déplacé dans le dossier ouvert (rien n\'est dupliqué) et n\'est plus à coller ; la phrase dit où', async () => {
  const { clipboard, log, place } = setup();
  clipboard.take('publipostage:cc', 'cut');
  assert.deepEqual(log.notices, [FR.t('clip.cut', { name: 'Convocation' })]);
  place.path = '';
  await clipboard.paste();
  assert.deepEqual(log.moves, [['file', 'publipostage:cc', '']]);
  assert.deepEqual(log.copies, []);
  assert.equal(log.notices.at(-1), FR.t('clip.moved', { name: 'Convocation', folder: FR.t('ex.me') }), 'la racine se dit « Moi »');
  assert.deepEqual(log.revealed, ['publipostage:cc']);
  assert.equal(clipboard.held, null);
  await clipboard.paste();
  assert.equal(log.notices.at(-1), FR.t('clip.empty'));
  assert.equal(log.moves.length, 1);
});

test('couper n\'est pas copier : un fichier qu\'aucun gardien ne copie se coupe quand même (le déplacer est le rangement de GFS), mais ne se copie pas : la phrase dit où le faire', () => {
  const { clipboard, log } = setup({ copyable: [] });
  clipboard.take('publipostage:cc', 'copy');
  assert.equal(clipboard.held, null);
  assert.deepEqual(log.notices, [FR.t('ex.notice.appOnly', { app: 'Publipostage+' })]);
  clipboard.take('publipostage:cc', 'cut');
  assert.equal(clipboard.held.mode, 'cut');
});

test('copier un dossier : la phrase dit de le couper ; couper puis coller un dossier le déplace avec son nom, et la ligne du dossier prend le clavier', async () => {
  const { clipboard, log, place } = setup();
  clipboard.take('dir:A/B', 'copy');
  assert.deepEqual([clipboard.held, log.notices], [null, [FR.t('clip.folderCopy')]]);
  clipboard.take('dir:A/B', 'cut');
  assert.deepEqual(clipboard.held, { mode: 'cut', key: 'dir:A/B', name: 'B' });
  place.path = 'X';
  await clipboard.paste();
  assert.deepEqual(log.moves, [['folder', 'A/B', 'X']]);
  assert.deepEqual(log.revealed, ['dir:X/B']);
  place.path = '';
  clipboard.take('dir:A/B', 'cut');
  await clipboard.paste();
  assert.deepEqual(log.revealed.at(-1), 'dir:B', 'à la racine, le dossier s\'appelle « B »');
});

test('un dossier ne va pas dans lui-même, ni chez lui : la phrase le dit, et ce qui est coupé reste à coller (la personne peut aller ailleurs)', async () => {
  const filing = { moveFolderTo: async (path, folder) => (folder === 'A/B' ? 'inside' : 'same') };
  const { clipboard, log, place } = setup({ filing });
  clipboard.take('dir:A/B', 'cut');
  place.path = 'A/B/C';
  await clipboard.paste();
  assert.equal(log.notices.at(-1), FR.t('clip.same', { name: 'B' }));
  place.path = 'A/B';
  await clipboard.paste();
  assert.equal(log.notices.at(-1), FR.t('clip.folderInto'));
  assert.notEqual(clipboard.held, null);
  assert.deepEqual(log.revealed, []);
});

test('coller un fichier coupé dans son dossier : « déjà dans ce dossier », sans rien écrire, et il reste à coller ; une écriture qui échoue ne dit rien de plus (le rangement l\'a dit)', async () => {
  const same = setup({ filing: { moveFileTo: async () => 'same' } });
  same.clipboard.take('gfs-fichiers:aa', 'cut');
  await same.clipboard.paste();
  assert.equal(same.log.notices.at(-1), FR.t('clip.same', { name: 'Facture.pdf' }));
  assert.notEqual(same.clipboard.held, null);
  const failed = setup({ filing: { moveFileTo: async () => undefined } });
  failed.clipboard.take('gfs-fichiers:aa', 'cut');
  const before = failed.log.notices.length;
  await failed.clipboard.paste();
  assert.equal(failed.log.notices.length, before, 'pas de phrase de plus : le rangement a dit pourquoi');
  assert.notEqual(failed.clipboard.held, null);
});

test('coller hors d\'un dossier (Récents, Favoris, corbeille) : la phrase dit d\'ouvrir un dossier, rien n\'est fait ; sans rien de copié, elle le dit aussi', async () => {
  const { clipboard, log, place } = setup();
  await clipboard.paste();
  assert.equal(log.notices.at(-1), FR.t('clip.empty'));
  clipboard.take('gfs-fichiers:aa', 'copy');
  for (const view of ['recent', 'favorites', 'trash']) {
    place.view = view;
    await clipboard.paste();
    assert.equal(log.notices.at(-1), FR.t('clip.noFolder'), view);
  }
  assert.deepEqual([log.copies, log.moves], [[], []]);
});

test('à la corbeille, un fichier ne se copie ni ne se coupe : il se restaure d\'abord', () => {
  const { clipboard, log, place } = setup();
  place.view = 'trash';
  clipboard.take('gfs-fichiers:aa', 'copy');
  clipboard.take('gfs-fichiers:aa', 'cut');
  assert.deepEqual([clipboard.held, log.notices], [null, [FR.t('clip.inTrash'), FR.t('clip.inTrash')]]);
});

test('le fichier copié ou coupé a disparu (supprimé, ou mis à la corbeille entre-temps) : la phrase le dit, il n\'est plus à coller', async () => {
  const files = [file('aa', 'Facture.pdf')];
  const { clipboard, log } = setup({ files });
  clipboard.take('gfs-fichiers:aa', 'copy');
  files.length = 0;
  await clipboard.paste();
  assert.equal(log.notices.at(-1), FR.t('clip.gone', { name: 'Facture.pdf' }));
  assert.equal(clipboard.held, null);
  assert.deepEqual(log.copies, []);
});

test('une ligne qui n\'est plus dans la liste ne se copie pas ; un fichier sans nom est « (sans nom) » ; les phrases sont aussi en anglais', () => {
  const { clipboard, log } = setup({ files: [file('aa', '')], i18n: EN });
  clipboard.take('gfs-fichiers:zz', 'copy');
  assert.deepEqual(log.notices, []);
  clipboard.take('gfs-fichiers:aa', 'copy');
  assert.deepEqual(log.notices, [EN.t('clip.copied', { name: EN.t('ex.untitled') })]);
  assert.match(log.notices[0], /“\(untitled\)” is copied/);
});

test('une copie qui n\'aboutit pas (verrou, échec : js/copying.js l\'a dit) ne met rien au clavier', async () => {
  const { clipboard, log } = setup({ copy: async () => null });
  clipboard.take('gfs-fichiers:aa', 'copy');
  await clipboard.paste();
  assert.deepEqual(log.revealed, []);
});

test('l\'explorateur qui se ferme vide le presse-papiers : ce qui était à coller a pu changer pendant que la personne était dans une app', async () => {
  const { clipboard, log } = setup();
  clipboard.take('gfs-fichiers:aa', 'cut');
  clipboard.clear();
  assert.equal(clipboard.held, null);
  await clipboard.paste();
  assert.equal(log.notices.at(-1), FR.t('clip.empty'));
  assert.deepEqual(log.moves, []);
});
