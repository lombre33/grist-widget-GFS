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
      filing: { togglePin: note('togglePin'), togglePinFolder: note('togglePinFolder'), rename: note('rename'), moveFile: note('moveFile'), renameFolder: note('renameFolder'), moveFolder: note('moveFolder') },
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

test('un dossier : ouvrir, épingler, renommer, déplacer, partager, un trait, supprimer ; chaque clic appelle le bon geste avec le chemin', () => {
  const x = context();
  const items = rowItems(x, 'dir:Contrats/2026');
  assert.deepEqual(labels(items), [t('ex.openFolder'), t('ex.pin'), t('ex.rename'), t('ex.move'), t('share.menu'), '-', t('ex.deleteFolder')]);
  assert.deepEqual(items.filter(entry => entry !== '-').map(entry => entry.hint), [t('key.enter'), undefined, 'F2', 'Ctrl+X, V', undefined, t('key.delete')]);
  for (const at of [0, 1, 2, 3, 4, 6]) items[at].run();
  assert.deepEqual(x.calls, [['activate', 'dir:Contrats/2026'], ['togglePinFolder', 'Contrats/2026'], ['renameFolder', 'Contrats/2026'], ['moveFolder', 'Contrats/2026'],
    ['share', { folder: 'Contrats/2026' }], ['deleteFolder', 'dir:Contrats/2026']]);
});

test('un dossier en favori : l\'article dit « Retirer des favoris » ; un dossier d\'espace garde l\'article grisé et le clic dit pourquoi ; un dossier reçu n\'en a pas', () => {
  const rows = [{ kind: 'folder', path: 'Contrats', count: 0, pinned: true }, { kind: 'folder', path: 'Autres', count: 0, pinned: false }];
  const pinned = rowItems(context({ rows }), 'dir:Contrats')[1];
  assert.deepEqual([pinned.label, pinned.greyed], [t('ex.unpin'), undefined]);
  assert.equal(rowItems(context({ rows }), 'dir:Autres')[1].label, t('ex.pin'));
  assert.equal(rowItems(context({ rows: [] }), 'dir:Inconnu')[1].label, t('ex.pin'), 'une ligne que la liste ne connaît pas : « Épingler »');
  for (const path of ['Espaces', 'Espaces/Achats', 'Espaces/Achats/Contrats']) {
    const space = context();
    const item = rowItems(space, `dir:${path}`)[1];
    assert.deepEqual([item.label, item.greyed], [t('ex.pin'), true]);
    item.run();
    assert.deepEqual([space.notices, space.calls], [[t('ex.favFolderSpace')], []]);
  }
  const received = context({ rows: [{ kind: 'folder', shared: true, path: 'Compta:Q3', count: 2 }] });
  assert.equal(labels(rowItems(received, 'grp:Compta:Q3')).includes(t('ex.pin')), false, 'comme un fichier reçu : pas d\'épingle');
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
  assert.equal(items[3].hint, undefined);
});

test('« Partager… » sur la ligne d\'un espace entier ouvre le partage de l\'espace (25/11) ; « Lier dans un espace… » reste grisé pour lui', () => {
  const x = context();
  x.opts.links = { whyNot: () => null, open: () => {}, linkAt: () => null };
  const space = { key: 'espace:achats', name: 'Achats', space: { name: 'Achats' }, wholeSpace: true };
  x.opts.sharing.whyNotFolder = path => (path === 'Espaces/Achats' ? 'les droits d\'un espace se règlent dans « Gérer les partages… »' : null);
  x.opts.sharing.whyNotShareFolder = () => null;
  x.opts.sharing.shareFolderFile = path => (path === 'Espaces/Achats' ? space : { folder: path });
  const items = rowItems(x, 'dir:Espaces/Achats');
  const share = items.find(entry => entry !== '-' && entry.label === t('share.menu'));
  assert.equal(share.greyed, false);
  share.run();
  assert.deepEqual(x.calls, [['share', space]]);
  const link = items.find(entry => entry !== '-' && entry.label === t('slink.menu'));
  assert.equal(link.greyed, true, 'un espace entier ne se lie pas dans un autre espace');
  const grey = context();
  grey.opts.sharing.whyNotShareFolder = () => 'pas ici';
  const blocked = rowItems(grey, 'dir:Espaces').find(entry => entry !== '-' && entry.label === t('share.menu'));
  assert.equal(blocked.greyed, true);
  blocked.run();
  assert.deepEqual([grey.notices, grey.calls], [['pas ici'], []]);
});

test('un dossier : « Partager… » ouvre la fenêtre du dossier d\'un espace ; sinon il est grisé avec la phrase de GFS, sans partage connu avec « pas encore », pendant un choix avec la phrase du choix', () => {
  const open = context();
  const ok = rowItems(open, 'dir:Espaces/Achats/Contrats')[4];
  assert.equal(ok.greyed, false);
  ok.run();
  assert.deepEqual(open.calls, [['share', { folder: 'Espaces/Achats/Contrats' }]]);
  const no = context(); no.opts.sharing.whyNotFolder = () => 'pas un espace';
  const grey = rowItems(no, 'dir:Perso')[4];
  assert.equal(grey.greyed, true);
  grey.run();
  assert.deepEqual([no.notices, no.calls], [['pas un espace'], []]);
  const bare = context(); bare.opts.sharing = null;
  const unsupported = rowItems(bare, 'dir:Perso')[4];
  assert.equal(unsupported.greyed, true);
  unsupported.run();
  assert.deepEqual(bare.notices, [t('share.unsupported')]);
  const noMethod = context(); noMethod.opts.sharing = { open() {} };
  assert.equal(rowItems(noMethod, 'dir:Perso')[4].greyed, true, 'un partage qui ne sait pas dire pour un dossier : pas encore');
  const choosing = context({ choice: true });
  rowItems(choosing, 'dir:Perso')[4].run();
  assert.deepEqual(choosing.notices, [t('ex.choose.newOff')]);
});

test('un fichier : ouvrir, ce que GFS garde en plus, partager, épingler, renommer, dupliquer, déplacer, un trait, mettre à la corbeille ; les clics appellent le rangement et les gestes', () => {
  const f = file();
  const x = context({ shown: [f], kept: { has: () => true, extras: () => [{ label: 'Télécharger' }] } });
  const items = rowItems(x, f.key);
  assert.deepEqual(labels(items), [t('ex.open'), 'Télécharger', t('share.menu'), t('ex.pin'), t('ex.rename'), t('ex.duplicate'), t('ex.move'), '-', t('trash.move')]);
  assert.deepEqual(items.filter(entry => entry !== '-' && entry.label !== 'Télécharger').map(entry => [entry.hint, Boolean(entry.greyed)]),
    [[t('key.enter'), false], [undefined, false], [undefined, false], ['F2', false], ['Ctrl+D', false], ['Ctrl+X, V', false], [t('key.delete'), false]]);
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

test('un dossier : « Lier dans un espace… » porte la clé que donne `keyOf` (le numéro de la ligne d\'état d\'un dossier de « Moi »), à défaut celle de `folderFile`', async () => {
  const make = keyOf => {
    const x = context();
    x.opts.sharing = { ...x.opts.sharing, folderFile: path => ({ key: `ancienne:${path}`, name: 'Contrats', path, mine: true }), ...(keyOf ? { keyOf } : {}) };
    x.opts.links = { whyNot: () => null, linkAt: () => null, open: async source => { x.calls.push(['link', source]); return true; } };
    return x;
  };
  const item = x => rowItems(x, 'dir:Contrats').find(entry => entry !== '-' && entry.label === t('slink.menu'));
  const withId = make(async folder => `dossier:moi:a@b.fr//${folder.path.length}`);
  item(withId).run();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(withId.calls, [['link', { target: 'dossier:moi:a@b.fr//8', name: 'Contrats', kind: 'folder' }]]);
  const old = make(null);
  item(old).run();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(old.calls, [['link', { target: 'ancienne:Contrats', name: 'Contrats', kind: 'folder' }]]);
});

// Les raccourcis de fichiers (js/files/shortcuts.js ; demande du porteur, 27/11) : le bouton est dans le menu de tout fichier, dans toutes les vues.
const withShortcuts = (extra = {}) => {
  const x = context(extra);
  x.opts.shortcuts = { whyNot: f => (f.shortcut ? t('sc.why.shortcut') : null), create: (...args) => x.calls.push(['createShortcut', ...args]), rename: (...args) => x.calls.push(['renameShortcut', ...args]),
    remove: (...args) => x.calls.push(['removeShortcut', ...args]) };
  return x;
};

test('« Créer un raccourci… » : dans le menu d\'un fichier de chaque vue (dossier, récents, favoris, ouverts, partagés), avec l\'icône du raccourci, et le clic crée', () => {
  for (const view of ['folder', 'recent', 'fav', 'opened']) {
    const x = withShortcuts({ view });
    const entry = rowItems(x, 'publipostage:7').find(each => each.label === t('sc.menu'));
    assert.ok(entry, `dans « ${view} »`);
    assert.deepEqual([entry.icon, entry.greyed], ['shortcut', false]);
    entry.run();
    assert.deepEqual(x.calls, [['createShortcut', x.shown[0]]]);
  }
  const given = withShortcuts({ view: 'shared', shown: [{ ...file(), direct: { by: 'marc@x.fr' } }] });
  assert.ok(rowItems(given, 'publipostage:7').some(each => each.label === t('sc.menu')), 'un fichier donné par une adresse');
  const arrived = withShortcuts({ view: 'shared', shown: [{ ...file(), received: { state: 'accepted' } }] });
  assert.ok(rowItems(arrived, 'publipostage:7').some(each => each.label === t('sc.menu')), 'une arrivée d\'un autre document acceptée');
});

test('« Créer un raccourci… » : grisé pendant un choix et pour ce que la personne ne peut pas viser ; le clic dit pourquoi, rien ne part ; absent sans le contrôle des raccourcis', () => {
  const choosing = withShortcuts({ choice: true });
  const entry = rowItems(choosing, 'publipostage:7').find(each => each.label === t('sc.menu'));
  assert.equal(entry.greyed, true);
  entry.run();
  assert.deepEqual([choosing.notices, choosing.calls], [[t('ex.choose.newOff')], []]);
  const pending = withShortcuts();
  pending.opts.shortcuts.whyNot = () => t('sc.why.pending');
  const grey = rowItems(pending, 'publipostage:7').find(each => each.label === t('sc.menu'));
  grey.run();
  assert.deepEqual([grey.greyed, pending.notices, pending.calls], [true, [t('sc.why.pending')], []]);
  assert.equal(labels(rowItems(context(), 'publipostage:7')).includes(t('sc.menu')), false, 'les essais de l\'explorateur seul ne le montrent pas');
});

test('le menu d\'un raccourci : ouvrir, aller au fichier d\'origine, renommer, déplacer, un trait, retirer ; jamais « Créer un raccourci… », jamais la corbeille', () => {
  const link = { ...file({ key: 'gfs-shortcut:s1' }), shortcut: { target: 'publipostage:7', state: 'ok' } };
  const x = withShortcuts({ shown: [link] });
  x.act.showOrigin = (...args) => x.calls.push(['showOrigin', ...args]);
  const items = rowItems(x, link.key);
  assert.deepEqual(labels(items), [t('ex.open'), t('sc.origin'), t('ex.rename'), t('ex.move'), '-', t('sc.remove')]);
  for (const at of [0, 1, 2, 3, 5]) items[at].run();
  assert.deepEqual(x.calls, [['activate', link.key], ['showOrigin', link], ['renameShortcut', link], ['moveFile', link], ['removeShortcut', link]]);
  assert.deepEqual(items.filter(each => each !== '-').map(each => each.hint), [t('key.enter'), undefined, 'F2', 'Ctrl+X, V', t('key.delete')]);
});

test('le menu d\'un raccourci grisé (cible qu\'on ne lit plus) : « Aller au fichier d\'origine » dit pourquoi, retirer reste possible ; pendant un choix tout est grisé', () => {
  const link = { ...file({ key: 'gfs-shortcut:s1' }), shortcut: { target: 'x', state: 'missing' } };
  const x = withShortcuts({ shown: [link] });
  const items = rowItems(x, link.key);
  assert.equal(items[1].greyed, true);
  items[1].run();
  assert.deepEqual(x.notices, [t('sc.missing')]);
  assert.equal(items.at(-1).greyed, false);
  const choosing = withShortcuts({ shown: [link], choice: true });
  const during = rowItems(choosing, link.key);
  during[2].run(); during.at(-1).run();
  assert.deepEqual([during[2].greyed, during.at(-1).greyed, choosing.calls, choosing.notices], [true, true, [], [t('ex.choose.newOff'), t('ex.choose.newOff')]]);
});
