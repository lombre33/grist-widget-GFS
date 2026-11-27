// L'explorateur et ce qu'il appelle, montés pour le contrôleur (js/controller.js) : les gardiens des fichiers (les PDF de GFS, les fichiers des apps), le
// rangement (épingler, renommer, déplacer), « Partagés avec moi », la corbeille, la copie et l'explorateur lui-même. Sortis du contrôleur pour qu'il reste sous
// les 600 lignes de code de l'outil d'audit. Comme js/broker/entries.js, ce module reçoit le contrôleur et lui pose ce qu'il monte (`kept`, `filing`,
// `received`, `explorer`) ; il n'appelle que ce que le contrôleur donne en public.

import { Explorer } from './explorer.js';
import { loadAttachments } from './explorer-data.js';
import { Filing } from './filing.js';
import { askName, chooseFolder } from './filing-window.js';
import { FolderShares } from '../sharing/folder-shares.js';
import { FILES_APP, cleanName } from '../files/gfs-files.js';
import { isTable } from '../apps/doc-names.js';
import { buildAppFiles, buildKept } from '../files/file-managers.js';
import { Trash } from '../files/trash.js';
import { Copying } from '../files/copying.js';
import { ReceivedControl } from '../sharing/received-control.js';
import { settingsItems } from '../shell/settings-menu.js';
import { openAbout } from '../shell/about.js';
import { openAnnuaire } from '../shell/annuaire-entry.js';

// Épingler, renommer, déplacer depuis l'explorateur (js/explorer/filing.js) : les fenêtres du widget par-dessus l'explorateur, et la liste relue après chaque
// geste.
export function buildFiling(c) {
  const layer = opts => ({ ...opts, t: c.t, container: c.$('stage'), inertTargets: c.inertTargets });
  return new Filing({
    port: c.port, rangement: c.rangement, t: c.t, locale: () => c.locale, files: () => (c.explorer ? c.explorer.files : []),
      folders: () => c.explorer.folders, pinnedFolders: () => c.explorer.pinnedFolders, appName: c.appName,
    spaces: { info: () => c.spaces, owner: async () => (await c.transfer.isOwner()) === true },
    folderShares: new FolderShares({ port: c.port, rangement: c.rangement, identity: () => c.identity,
      owner: async () => (await c.transfer.isOwner()) === true }),
    here: () => (c.explorer.state.view === 'folder' ? c.explorer.state.path : ''), writeBlock: () => c.writeBlock(), notice: text => c.notice(text),
    specOf: file => ((c.manifestOf(file.app) || {}).fichiers || []).find(spec => isTable(spec, file.table)) || null,
    cleanName: file => (file.app === FILES_APP ? cleanName : undefined),
    refresh: opts => c.refreshFiles(opts), pending: c.pending, windows: { name: opts => askName(layer(opts)), folder: opts => chooseFolder(layer(opts)) },
  });
}

// Les articles du menu « Réglages » de l'explorateur (js/shell/settings-menu.js) : la langue, le thème, LanguageTool, la barre, les droits et « À propos ».
const settingsOf = c => () => settingsItems({
  t: c.t, language: () => ({ choice: c.language.choice, grist: c.language.grist }), onLanguage: choice => c.chooseLanguage(choice),
    onTheme: () => c.openTheme(),
  langtool: () => ({ shown: c.correcteurs.state.shown, toggle: () => c.langtool.choose() }),
  reopen: () => ({ on: c.resume.enabled, toggle: () => c.resume.toggle() }),
  place: () => c.dock.placeRow(), onAbout: () => openAbout({ t: c.t, ask: opts => c.ask(opts) }), onDependencies: () => c.openDependencies(),
  manage: () => ({ why: c.rights.manage.whyNot(), open: () => void c.rights.manage.open(), notice: text => c.notice(text) }),
  index: () => ({ why: c.rights.index.why(), open: () => void c.rights.index.open(), notice: text => c.notice(text) }),
});

export function buildExplorer(c) {
  const askFor = opts => c.ask(opts);
  c.kept = buildKept(c, { ask: askFor, hideNotice: () => c.hideNotice() });
  // les gardiens des fichiers : les PDF de GFS, les fichiers des apps (la corbeille et la copie les interrogent)
  c.appFiles = buildAppFiles(c, { ask: askFor });
  const managers = [c.kept, c.appFiles];
  const gestures = { t: c.t, notice: text => c.notice(text), refresh: () => c.refreshFiles() };
  c.filing = buildFiling(c);
  const { filing } = c;
  // la corbeille qui s'affiche d'avance (js/files/trash.js) : la liste des changements en attente, la file des écritures de rangement, les dossiers que le
  // fichier laisse
  const later = { pending: c.pending, queue: task => filing.queued(task), left: file => filing.foldersLeftBy(file), keep: file => filing.keepFoldersNow(file),
    refresh: opts => c.refreshFiles(opts) };
  // « Partagés avec moi » (js/sharing/received-control.js) : les fichiers reçus d'un autre document, grisés tant qu'ils ne sont pas acceptés.
  c.received = new ReceivedControl({
    port: c.port, t: c.t, locale: () => c.locale, container: c.$('stage'), inertTargets: c.inertTargets, typeLabel: c.typeLabel,
      notice: text => c.notice(text),
    blocked: () => c.writeBlock(), refresh: () => c.refreshFiles(), open: file => c.openings.openFile(file),
  });
  c.explorer = new Explorer({
    container: c.$('stage'), i18n: c.i18n, locale: c.locale, now: () => new Date(), appName: c.appName, received: c.received, notices: c.notices,
    typeLabel: file => (file.received ? c.received.typeLabel(file) : c.typeLabel(file)),
      lockOf: file => (file.received ? c.received.lockOf(file) : c.lockOf(file)),
    newTypes: c.newTypes, importTypes: c.importTypes, canClose: () => Boolean(c.session), notice: text => c.notice(text),
    opened: { keys: () => c.opened.keys(), shown: () => c.opened.shown(c.session), remove: key => c.opened.remove(key) },
    settings: settingsOf(c), onPlace: () => c.resume.sync(),
    sharing: c.rights.sharing, links: c.rights.links, onWeight: estimate => void c.weight.open(estimate), alerts: ctx => c.weight.alerts(ctx),
    onOpen: file => c.openings.openFile(file), onNew: entry => c.openings.openNew(entry), onImport: entry => void c.openings.importFile(entry),
      onTemplates: () => void c.templates.open(),
      onClose: () => c.hideExplorer(), onApps: () => void c.openModules(), onAnnuaire: () => void openAnnuaire(c),
    personal: () => Boolean(c.identity), filing, pending: c.pending, kept: c.kept, attachments: () => loadAttachments(c.port),
    trash: new Trash({ managers, ask: opts => c.ask(opts), keepFolders: file => filing.keepFoldersOf(file), later, ...gestures }),
    copying: new Copying({ managers, file: (app, id, folder) => filing.rangeNew([{ app, file: id, pinned: false, folder }]), ...gestures }),
  });
  c.pending.onChange = () => c.explorer.repaint(); // un geste de rangement s'affiche (ou s'en va, refusé) sans attendre la lecture des fichiers
}
