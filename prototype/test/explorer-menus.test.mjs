// Les articles du menu d'une ligne de l'explorateur (js/explorer/explorer-menus.js), en code pur : les objets que le menu dessine, leur ordre, leurs raisons de grisé et ce que chaque clic appelle. Le menu à la vraie souris se mesure
// sous Firefox (test/interfaces-firefox.test.mjs : corbeille, dossiers, copie, « Partager… »).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rowItems } from '../js/explorer/explorer-menus.js';
import { createI18n } from '../js/i18n/i18n.js';

const { t } = createI18n('fr');
const file = (extra = {}) => ({ key: 'publipostage:7', name: 'Convocation', app: 'publipostage', pinned: false, ...extra });
// Un contexte d'explorateur de poche : les gestes se notent dans `calls`, les avis dans `notices`.
function context(extra = {}) {
  const calls = []; const notices = [];
  const note = name => (...args) => { calls.push([name, ...args]); };
  const x = {
    t, calls, notices, view: 'folder', choice: false, rows: [], shown: [file()],
    opts: {
      notice: text => notices.push(text), appName: id => `App ${id}`,
      filing: { togglePin: note('togglePin'), rename: note('rename'), moveFile: note('moveFile'), renameFolder: note('renameFolder'), moveFolder: note('moveFolder') },
      sharing: { whyNot: () => null, whyNotFolder: () => null, open: note('share'), folderFile: path => ({ folder: path }) },
    },
    kept: { has: () => false, extras: () => [{ label: 'Télécharger' }] }, bin: { handles: () => true }, copying: { handles: () => true }, shared: { menu: () => null },
    openAs: () => ({ label: t('ex.open'), icon: 'open', greyed: false }),
    act: { activate: note('activate'), deleteFolder: note('deleteFolder'), restore: note('restore'), purge: note('purge'), trashKey: note('trashKey'), duplicate: note('duplicate'), dropOpened: note('dropOpened') },
    ...extra,
  };
  return x;
}
const labels = items => items.map(entry => (entry === '-' ? '-' : entry.label));

test('un dossier : ouvrir, renommer, déplacer, partager, un trait, supprimer ; chaque clic appelle le bon geste avec le chemin', () => {
  const x = context();
  const items = rowItems(x, 'dir:Contrats/2026');
  assert.deepEqual(labels(items), [t('ex.openFolder'), t('ex.rename'), t('ex.move'), t('share.menu'), '-', t('ex.deleteFolder')]);
  assert.deepEqual(items.filter(entry => entry !== '-').map(entry => entry.hint), [t('key.enter'), 'F2', 'Ctrl+X, V', undefined, t('key.delete')]);
  for (const at of [0, 1, 2, 3, 5]) items[at].run();
  assert.deepEqual(x.calls, [['activate', 'dir:Contrats/2026'], ['renameFolder', 'Contrats/2026'], ['moveFolder', 'Contrats/2026'], ['share', { folder: 'Contrats/2026' }], ['deleteFolder', 'dir:Contrats/2026']]);
});

test('un dossier : supprimer est grisé tant que des fichiers y sont, et pendant un choix ; le clic dit pourquoi ; « Déplacer » ne rappelle plus Ctrl+X pendant un choix', () => {
  const rows = [{ kind: 'file', path: 'Vide', count: 9 }, { kind: 'folder', path: 'Plein', count: 2 }, { kind: 'folder', path: 'Vide', count: 0 }];
  const full = context({ rows });
  const del = rowItems(full, 'dir:Plein').at(-1);
  assert.equal(del.greyed, true);
  del.run();
  assert.deepEqual([full.notices, full.calls], [[t('ex.folderNotEmpty')], []]);
  const empty = context({ rows });
  const free = rowItems(empty, 'dir:Vide').at(-1);
  assert.equal(free.greyed, false);
  free.run();
  assert.deepEqual([empty.notices, empty.calls], [[], [['deleteFolder', 'dir:Vide']]]);
  assert.equal(rowItems(context({ rows }), 'dir:Absent').at(-1).greyed, false, 'un dossier que la liste ne connaît pas se supprime comme un dossier vide');
  const choosing = context({ rows, choice: true });
  const items = rowItems(choosing, 'dir:Vide');
  assert.equal(items.at(-1).greyed, true);
  items.at(-1).run();
  assert.deepEqual(choosing.notices, [t('ex.choose.newOff')]);
  assert.equal(items[2].hint, undefined);
});

test('un dossier : « Partager… » ouvre la fenêtre du dossier d\'un espace ; sinon il est grisé avec la phrase de GFS, sans partage connu avec « pas encore », pendant un choix avec la phrase du choix', () => {
  const open = context();
  const ok = rowItems(open, 'dir:Espaces/Achats/Contrats')[3];
  assert.equal(ok.greyed, false);
  ok.run();
  assert.deepEqual(open.calls, [['share', { folder: 'Espaces/Achats/Contrats' }]]);
  const no = context(); no.opts.sharing.whyNotFolder = () => 'pas un espace';
  const grey = rowItems(no, 'dir:Perso')[3];
  assert.equal(grey.greyed, true);
  grey.run();
  assert.deepEqual([no.notices, no.calls], [['pas un espace'], []]);
  const bare = context(); bare.opts.sharing = null;
  const unsupported = rowItems(bare, 'dir:Perso')[3];
  assert.equal(unsupported.greyed, true);
  unsupported.run();
  assert.deepEqual(bare.notices, [t('share.unsupported')]);
  const noMethod = context(); noMethod.opts.sharing = { open() {} };
  assert.equal(rowItems(noMethod, 'dir:Perso')[3].greyed, true, 'un partage qui ne sait pas dire pour un dossier : pas encore');
  const choosing = context({ choice: true });
  rowItems(choosing, 'dir:Perso')[3].run();
  assert.deepEqual(choosing.notices, [t('ex.choose.newOff')]);
});

test('un fichier : ouvrir, ce que GFS garde en plus, partager, épingler, renommer, dupliquer, déplacer, un trait, mettre à la corbeille ; les clics appellent le rangement et les gestes', () => {
  const f = file();
  const x = context({ shown: [f], kept: { has: () => true, extras: () => [{ label: 'Télécharger' }] } });
  const items = rowItems(x, f.key);
  assert.deepEqual(labels(items), [t('ex.open'), 'Télécharger', t('share.menu'), t('ex.pin'), t('ex.rename'), t('ex.duplicate'), t('ex.move'), '-', t('trash.move')]);
  assert.deepEqual(items.filter(entry => entry !== '-' && entry.label !== 'Télécharger').map(entry => [entry.hint, Boolean(entry.greyed)]),
    [[t('key.enter'), false], [undefined, false], [undefined, false], ['F2', false], ['Ctrl+C, V', false], ['Ctrl+X, V', false], [t('key.delete'), false]]);
  for (const at of [0, 2, 3, 4, 5, 6, 8]) items[at].run();
  assert.deepEqual(x.calls, [['activate', f.key], ['share', f], ['togglePin', f], ['rename', f], ['duplicate', f], ['moveFile', f], ['trashKey', f.key]]);
  assert.equal(rowItems(context({ shown: [file({ pinned: true })] }), f.key)[2].label, t('ex.unpin'));
  assert.deepEqual(labels(rowItems(context(), f.key)).slice(0, 3), [t('ex.open'), t('share.menu'), t('ex.pin')], 'sans fichier gardé, pas d\'article en plus');
});

test('un fichier : la corbeille et la copie grisées disent pourquoi (aucun gardien, app à ouvrir) ; le clic donne la phrase, rien ne part', () => {
  const x = context({ bin: { handles: () => false }, copying: { handles: () => true, appLockOf: () => ({ text: 'Ouvrez Publipostage+ d\'abord' }) } });
  const items = rowItems(x, 'publipostage:7');
  const [duplicate, remove] = [items.at(-4), items.at(-1)];
  assert.deepEqual([duplicate.label, duplicate.greyed, remove.label, remove.greyed], [t('ex.duplicate'), true, t('trash.move'), true]);
  duplicate.run(); remove.run();
  assert.deepEqual([x.notices, x.calls], [['Ouvrez Publipostage+ d\'abord', t('trash.appOnly', { app: 'App publipostage' })], []]);
  const lock = context({ bin: { handles: () => true, appLockOf: () => ({ text: 'à ouvrir' }) }, copying: { handles: () => false } });
  const locked = rowItems(lock, 'publipostage:7');
  locked.at(-1).run(); locked.at(-4).run();
  assert.deepEqual(lock.notices, ['à ouvrir', t('ex.notice.appOnly', { app: 'App publipostage' })]);
  const free = context({ bin: { handles: () => true, appLockOf: () => null } });
  assert.equal(rowItems(free, 'publipostage:7').at(-1).greyed, undefined, 'une app qui n\'attend rien ne grise pas');
});

test('un fichier, partager : grisé avec la phrase de GFS quand le fichier ne se partage pas ; sans partage connu « pas encore »', () => {
  const x = context(); x.opts.sharing.whyNot = () => 'ce fichier ne se partage pas';
  const items = rowItems(x, 'publipostage:7');
  const share = items.find(entry => entry.label === t('share.menu'));
  assert.equal(share.greyed, true);
  share.run();
  assert.deepEqual([x.notices, x.calls], [['ce fichier ne se partage pas'], []]);
  const bare = context(); bare.opts.sharing = null;
  rowItems(bare, 'publipostage:7').find(entry => entry.label === t('share.menu')).run();
  assert.deepEqual(bare.notices, [t('share.unsupported')]);
});

test('pendant un choix : « Choisir » à la place de « Ouvrir », rien de ce que GFS garde, tout geste grisé avec la phrase du choix, « Déplacer » sans rappel de clavier', () => {
  const x = context({ choice: true, kept: { has: () => true, extras: () => [{ label: 'Télécharger' }] } });
  const items = rowItems(x, 'publipostage:7');
  assert.equal(items[0].label, t('ex.choose.pick'));
  assert.equal(items.some(entry => entry.label === 'Télécharger'), false);
  for (const entry of items.filter(each => [t('share.menu'), t('ex.duplicate'), t('trash.move')].includes(each.label))) { assert.equal(entry.greyed, true); entry.run(); }
  assert.deepEqual(x.notices, [t('ex.choose.newOff'), t('ex.choose.newOff'), t('ex.choose.newOff')]);
  assert.equal(items.find(entry => entry.label === t('ex.move')).hint, undefined);
  const greyOpen = rowItems(context({ openAs: () => ({ label: 'Lire', icon: 'read', greyed: true }) }), 'publipostage:7')[0];
  assert.deepEqual([greyOpen.label, greyOpen.icon, greyOpen.greyed], ['Lire', 'read', true], 'l\'article d\'ouverture suit ce que l\'app sait faire');
});

test('à la corbeille : restaurer et supprimer définitivement ; dans « Partagés avec moi » : l\'article de la liste des arrivées, sinon ouvrir et ce que GFS garde', () => {
  const f = file();
  const bin = context({ view: 'trash', shown: [f] });
  const trashed = rowItems(bin, f.key);
  assert.deepEqual(labels(trashed), [t('trash.restore'), '-', t('trash.purge')]);
  trashed[0].run(); trashed[2].run();
  assert.deepEqual(bin.calls, [['restore', f.key], ['purge', f.key]]);
  const answered = context({ view: 'shared', shown: [f], shared: { menu: () => [{ label: 'Accepter' }] } });
  assert.deepEqual(labels(rowItems(answered, f.key)), ['Accepter']);
  const read = context({ view: 'shared', shown: [f], openAs: () => ({ label: 'Lire', icon: 'read', greyed: false }) });
  const items = rowItems(read, f.key);
  assert.deepEqual(labels(items), ['Lire', 'Télécharger']);
  assert.equal(items[0].hint, t('key.enter'));
  items[0].run();
  assert.deepEqual(read.calls, [['activate', f.key]]);
});

test('une ligne qui n\'est plus dans la vue : pas de menu', () => {
  assert.equal(rowItems(context({ shown: [] }), 'publipostage:7'), null);
  assert.equal(rowItems(context({ view: 'trash', shown: [] }), 'publipostage:7'), null);
});

test('Ouverts : « Retirer des ouverts » vient juste après « Ouvrir », seulement dans cette vue, et appelle le geste avec la clé du fichier', () => {
  const opened = context({ view: 'opened' });
  const items = rowItems(opened, 'publipostage:7');
  assert.deepEqual(labels(items).slice(0, 2), [t('ex.open'), t('ex.openedDrop')]);
  assert.equal(items[1].icon, 'x');
  items[1].run();
  assert.deepEqual(opened.calls, [['dropOpened', 'publipostage:7']]);
  for (const view of ['folder', 'recent', 'fav']) assert.equal(labels(rowItems(context({ view }), 'publipostage:7')).includes(t('ex.openedDrop')), false, `pas dans « ${view} »`);
  assert.equal(labels(rowItems(context({ view: 'trash' }), 'publipostage:7')).includes(t('ex.openedDrop')), false, 'ni à la corbeille');
});

test('« Partagés avec moi » : un fichier donné par une adresse a le menu d\'un fichier ordinaire (ouvrir, partager…), pas celui d\'une arrivée', () => {
  const f = { ...file(), direct: { by: 'marc@x.fr' } };
  const items = rowItems(context({ view: 'shared', shown: [f], shared: { menu: () => { throw new Error('une arrivée seulement'); } } }), f.key);
  assert.equal(items[0].label, t('ex.open'));
  assert.ok(items.some(entry => entry.label === t('share.menu')));
});
