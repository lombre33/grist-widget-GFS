// Les articles du menu d'une ligne de l'explorateur (js/explorer/explorer.js, « Plus d'actions » ou clic droit) : ceux d'un dossier, d'un fichier, d'un fichier
// à la corbeille et d'une arrivée de « Partagés avec moi ». Sortis de l'explorateur pour qu'il reste sous les 600 lignes de code de l'outil d'audit. Rien ne
// s'y
// garde : l'explorateur donne, à chaque ouverture, ce qu'il montre (`x`) et ses gestes (`x.act`), et reçoit des articles (des objets simples, dessinés par
// js/ui/menu.js).
//
// x : { t, opts (filing, sharing, notice, appName), view ('folder', 'recent', 'trash', 'shared', 'opened'…), choice (un mode choix est ouvert), rows, shown
//   (les fichiers de la vue), kept, bin, copying, shared, openAs(file),
//       act: { activate(key), deleteFolder(key), restore(key), purge(key), trashKey(key), duplicate(file), dropOpened(key) } }

import { rowKey } from './explorer-model.js';

const item = (label, glyph, run, hint) => ({ label, icon: glyph, run, hint });

// Les articles de la ligne `key` (« dir:<chemin> » pour un dossier), ou `null` quand le fichier n'est plus dans la vue.
export function rowItems(x, key) {
  const { t, opts, choice, act } = x;
  if (key.startsWith('grp:')) return groupItems(x, key);
  if (key.startsWith('dir:')) {
    const path = key.slice(4);
    const { filing } = opts;
    const link = opts.links ? opts.links.linkAt(path) : null;
    if (link) return linkFolderItems(x, key, link);
    return [item(t('ex.openFolder'), 'open', () => act.activate(key), t('key.enter')), item(t('ex.rename'), 'edit', () => void filing.renameFolder(path), 'F2'),
      item(t('ex.move'), 'move', () => void filing.moveFolder(path), choice ? undefined : 'Ctrl+X, V'), shareFolderItem(x, path), ...linkFolderItem(x, path),
        '-',
        deleteFolderItem(x, key)];
  }
  const file = x.shown.find(entry => entry.key === key);
  if (!file) return null;
  return ({ trash: () => trashItems(x, file), shared: () => sharedItems(x, file) })[x.view]?.() || fileItems(x, file);
}

// Le menu d'un dossier reçu d'un autre document (« Partagés avec moi », clé « grp:<id> ») : l'ouvrir, et répondre pour tous ses fichiers à accepter. Il n'est
// pas à la personne : ni renommer, ni déplacer, ni supprimer.
function groupItems(x, key) {
  const { t } = x;
  const row = x.rows.find(entry => rowKey(entry) === key);
  if (!row) return null;
  return [item(t('ex.openFolder'), 'open', () => x.act.activate(key), t('key.enter')),
    ...(row.pending ? [item(t('rx.folder.answer'), 'check', () => void x.shared.askFolder(row))] : [])];
}

// « Partager… » d'un dossier (js/sharing/share-control.js) : seuls les dossiers d'un espace se partagent ; les autres l'article reste, grisé, et le clic dit
// pourquoi.
function shareFolderItem(x, path) {
  const { t, opts } = x;
  const { sharing } = opts;
  const why = x.choice ? t('ex.choose.newOff') : (sharing && sharing.whyNotFolder ? sharing.whyNotFolder(path) : t('share.unsupported'));
  return { label: t('share.menu'), icon: 'user', greyed: why !== null, run: () => (why ? opts.notice(why) : void sharing.open(sharing.folderFile(path))) };
}

// « Lier dans un espace… » d'un dossier (js/sharing/link-control.js) : un dossier d'espace ou de « Moi » se montre dans un autre espace ; les autres, l'article
// reste grisé et le clic dit pourquoi. Rien (liste vide) sans le contrôle des liens (les essais de l'explorateur seul).
function linkFolderItem(x, path) {
  const { t, opts } = x;
  const { links, sharing } = opts;
  if (!links) return [];
  const why = x.choice ? t('ex.choose.newOff') : ((sharing && sharing.whyNotFolder ? sharing.whyNotFolder(path) : t('share.unsupported')) || links.whyNot());
  return [{ label: t('slink.menu'), icon: 'link', greyed: why !== null,
    run: () => { if (why) opts.notice(why); else {
      const folder = sharing.folderFile(path); void links.open({ target: folder.key, name: folder.name, kind: 'folder' }); } } }];
}

// Le menu du dossier d'un lien (un autre espace y montre ses fichiers) : l'ouvrir, ou retirer le lien. Le reste est grisé : le nom, la place et le partage se
// règlent dans l'espace d'origine ; le clic dit pourquoi.
function linkFolderItems(x, key, link) {
  const { t, opts, choice, act } = x;
  const fixed = (label, glyph) => ({ label, icon: glyph, greyed: true, run: () => opts.notice(t('slink.fixed')) });
  const why = choice ? t('ex.choose.newOff') : null;
  return [item(t('ex.openFolder'), 'open', () => act.activate(key), t('key.enter')), fixed(t('ex.rename'), 'edit'), fixed(t('ex.move'), 'move'),
    { label: t('share.menu'), icon: 'user', greyed: true, run: () => opts.notice(t('share.folder.link')) }, '-',
    { label: t('slink.remove'), icon: 'trash', greyed: why !== null, run: () => (why ? opts.notice(why) : void opts.links.remove(link)) }];
}

// L'article « Supprimer le dossier » : grisé tant qu'un fichier est dans le dossier (ou un de ses sous-dossiers) et pendant un choix ; le clic dit pourquoi.
function deleteFolderItem(x, key) {
  const { t } = x;
  const row = x.rows.find(entry => entry.kind === 'folder' && `dir:${entry.path}` === key);
  const why = x.choice ? t('ex.choose.newOff') : (row && row.count > 0 ? t('ex.folderNotEmpty') : null);
  return { label: t('ex.deleteFolder'), icon: 'trash', hint: t('key.delete'), greyed: why !== null,
    run: () => (why ? x.opts.notice(why) : void x.act.deleteFolder(key)) };
}

function trashItems(x, file) {
  const { t, act } = x;
  return [{ label: t('trash.restore'), icon: 'restore', hint: t('key.enter'), run: () => void act.restore(file.key) }, '-',
    { label: t('trash.purge'), icon: 'trash', hint: t('key.delete'), run: () => void act.purge(file.key) }];
}

// Le menu d'une ligne de « Partagés avec moi » : répondre à une arrivée en attente ; lire ou télécharger une arrivée acceptée (comme un PDF que GFS garde).
function sharedItems(x, file) {
  if (file.direct) return fileItems(x, file);
  const open = x.openAs(file);
  return x.shared.menu(file) || [{ label: open.label, icon: open.icon, hint: x.t('key.enter'), greyed: open.greyed, run: () => x.act.activate(file.key) },
    ...x.kept.extras(file)];
}

// Pourquoi un geste (la corbeille ou la copie) est grisé pour ce fichier, en une phrase, ou null : pendant un choix ; pour un fichier qu'aucun gardien ne
// connaît (`unknown`) ; quand l'app doit être ouverte et ne l'est pas.
function whyGreyed(x, file, gesture, unknown) {
  if (x.choice) return x.t('ex.choose.newOff');
  if (!gesture.handles(file)) return unknown;
  const wait = typeof gesture.appLockOf === 'function' ? gesture.appLockOf(file) : null;
  return wait ? wait.text : null;
}

// « Lier dans un espace… » d'un fichier : grisé pour ce qui ne se partage pas (même raison que « Partager… »), sans partage activé et sans espace.
function linkFileItem(x, file, whyShare) {
  const { t, opts } = x;
  const why = whyShare || opts.links.whyNot();
  return { label: t('slink.menu'), icon: 'link', greyed: why !== null, run: () => (why ? opts.notice(why) :
    void opts.links.open({ target: file.key, name: file.name, kind: 'file' })) };
}

function fileItems(x, file) {
  const { t, opts, choice, act } = x;
  const { filing, sharing } = opts;
  const grey = (label, glyph, notice) => ({ label, icon: glyph, greyed: true, run: () => opts.notice(notice) });
  const appOnly = t('ex.notice.appOnly', { app: opts.appName(file.app) });
  const open = choice ? { label: t('ex.choose.pick'), icon: 'open', greyed: false } : x.openAs(file);
  const extras = x.kept.has(file) && !choice ? x.kept.extras(file) : [];
  // Mettre à la corbeille et dupliquer : grisés pendant un choix, pour un fichier qu'aucun gardien ne connaît, et pour un fichier que seule l'app ouverte sait
  // fermer ou copier (contrats 2.4 `appel`) ; le clic dit pourquoi. Le presse-papiers (Ctrl+C puis Ctrl+V, Ctrl+X puis Ctrl+V) et Ctrl+D ne sont pas offerts
  // pendant un choix.
  const whyRemove = whyGreyed(x, file, x.bin, t('trash.appOnly', { app: opts.appName(file.app) }));
  const remove = whyRemove ? grey(t('trash.move'), 'trash', whyRemove) : item(t('trash.move'), 'trash', () => void act.trashKey(file.key), t('key.delete'));
  const whyDuplicate = whyGreyed(x, file, x.copying, appOnly);
  const duplicate = whyDuplicate ? grey(t('ex.duplicate'), 'copy', whyDuplicate) : item(t('ex.duplicate'), 'copy', () => void act.duplicate(file), 'Ctrl+D');
  // « Partager… » (js/sharing/share-control.js) : grisé pendant un choix et pour un fichier qui ne se partage pas encore, le clic dit pourquoi.
  const whyShare = choice ? t('ex.choose.newOff') : (sharing ? sharing.whyNot(file) : t('share.unsupported'));
  const share = whyShare ? grey(t('share.menu'), 'user', whyShare) : item(t('share.menu'), 'user', () => void sharing.open(file));
  // Dans « Ouverts » : sortir le fichier de la liste, sans le fermer ni le toucher.
  const drop = x.view === 'opened' ? [item(t('ex.openedDrop'), 'x', () => void act.dropOpened(file.key))] : [];
  const linkTo = opts.links ? [linkFileItem(x, file, whyShare)] : [];
  return [{ ...item(open.label, open.icon, () => act.activate(file.key), t('key.enter')), greyed: open.greyed }, ...drop, ...extras, share, ...linkTo,
    item(file.pinned ? t('ex.unpin') : t('ex.pin'), 'pin', () => void filing.togglePin(file)),
    item(t('ex.rename'), 'edit', () => void filing.rename(file), 'F2'), duplicate,
      item(t('ex.move'), 'move', () => void filing.moveFile(file), choice ? undefined : 'Ctrl+X, V'),
    '-', remove];
}
