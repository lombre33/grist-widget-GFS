// La page d'essai de l'interface sous Firefox (test/interfaces-firefox.test.mjs) : le vrai explorateur (js/explorer/explorer.js) et son vrai menu « Réglages » (js/shell/settings-menu.js, avec la vraie fenêtre « À propos »), la vraie fenêtre « Thème » (js/theme/theme-window.js) et la vraie fenêtre « Ce nom est
// déjà pris » (js/files/conflict-window.js), sur des fichiers que le vrai modèle (js/explorer/explorer-model.js) lit dans des tables de la forme de celles de Grist, avec les feuilles de style et la carte d'importation de
// index.html (le test les recopie de la page, dans l'ordre). Aucun Grist : ce que l'essai mesure est la mise en page et la souris. La langue vient de `?lang=fr|en` ; `window.__opened` garde le nom du
// dernier fichier que l'explorateur a ouvert ; `window.__askConflict({ app, repeat })` ouvre la fenêtre du nom pris et `window.__conflict` garde la réponse de la personne quand elle se ferme.
// La corbeille et le clavier (test/corbeille-firefox.mjs) : le vrai `Trash` (js/files/trash.js) et la vraie fenêtre d'accord (js/ui/ask-window.js) sur un gardien de doublure qui déplace les fichiers entre deux
// listes ; `window.__filing` note ce que l'explorateur demande au rangement (renommer, déplacer, épingler), `window.__notices` les phrases qu'il dit, `window.__explorer` est l'explorateur, et
// `window.__reset()` remet les fichiers, la vue et la recherche comme au départ ; `window.__language`, `window.__place`, `window.__langtool` et `window.__reopen` (« Rouvrir au rechargement », allumé au départ) gardent le dernier choix du menu « Réglages » (la langue, le bord de la barre : la ligne de la barre est ici une doublure,
// celle du vrai Dock se mesure dans le labo) et `window.__resetSettings()` les remet au départ. L'ambiance (décision du 03/11) et l'accessibilité renforcée (04/11) : `window.__theme` est le réglage du thème (`choose`, `chooseAccess`), et la page prend
// ce qu'il dit comme celle de GFS. La copie et le presse-papiers (test/copier-firefox.mjs) : le vrai `Copying` (js/files/copying.js) sur un gardien de doublure qui
// ajoute une copie à la liste (premier nom libre), et un rangement de doublure qui déplace vraiment les fichiers et les dossiers ; `window.__copies` note [identifiant, dossier] de chaque copie rangée.
// Les icônes des types (test/icones-firefox.mjs) : l'ambiance se pose comme dans GFS, par le vrai `ThemeSetting` et le vrai `ThemeHost` (`window.__ambiance(id)`, le mode vient de `data-grist-appearance`), et
// `window.__withPdf()` ajoute à la liste un PDF gardé par GFS, lu par le vrai modèle avec le vrai manifeste de GFS (la famille « pdf », rouge) ; `window.__reset()` le retire et rend l'ambiance d'origine.
// Les dossiers sans fichier (test/dossiers-firefox.mjs) : le vrai `Filing` (js/explorer/filing.js) et les vraies fenêtres du rangement (js/explorer/filing-window.js) sur un rangement de doublure qui tient les dossiers gardés
// (`window.__keep(...chemins)` en pose, `window.__filing` note chaque lot « setFiling:+gardé:-retiré »), et la corbeille y garde le dossier du dernier fichier qui part, comme le contrôleur.
// Un fichier que seule l'app ouverte sait fermer ou copier (test/composite-firefox.mjs) : la « Grille de suivi » en fait office ; `window.__appOpen = false` : l'app n'est pas ouverte, le geste est grisé et dit
// d'ouvrir l'app ; ouverte, l'app ajoute sa phrase (`window.__appSaid`) à celle de GFS.
// La case « + pièces jointes » : la table `_grist_Attachments` que l'explorateur lirait dans Grist est une doublure, de la forme que `fetchTable` la rend (voir `ATTACHMENTS`) ; `window.__attachments` compte ses lectures
// et `window.__attachmentsFail = 'texte'` les fait échouer. Ce que Grist rend vraiment se mesure dans un vrai Grist (labo/run-poids.mjs).
// Ctrl+Z (test/annuler-firefox.mjs) : l'explorateur prend la pile d'annulation du vrai `Filing` (`filing.undoStack`) ; la corbeille et la copie y déposent leur geste, `window.__reset()` la vide.
import { ask } from '/js/ui/ask-window.js';
import { askConflict } from '/js/files/conflict-window.js';
import { Explorer } from '/js/explorer/explorer.js';
import { OpenedFiles } from '/js/explorer/opened-files.js';
import { Filing } from '/js/explorer/filing.js';
import { askName, chooseFolder } from '/js/explorer/filing-window.js';
import { applyFiling, folderMoves, inside, normalizePath, readFiles, readFiling } from '/js/explorer/explorer-model.js';
import { Copying } from '/js/files/copying.js';
import { readShortcuts, shortcutFiles } from '/js/files/shortcuts.js';
import { ShortcutGestures } from '/js/explorer/shortcut-gestures.js';
import { applyPlacement, readSpaces } from '/js/sharing/spaces-filing.js';
import { LinkControl } from '/js/sharing/link-control.js';
import { filesManifest, filesColumnIds } from '/js/files/gfs-files.js';
import { showNamesWindow } from '/js/ui/names-window.js';
import { NAMES_STRINGS } from '/kit/js/names-update/strings.js';
import { createI18n as createKitI18n } from '/kit/js/i18n.js';
import { ReceivedControl } from '/js/sharing/received-control.js';
import { loadReceived, answerFile, answerFolder } from '/js/sharing/received-files.js';
import { fakeGrist } from '/test/fake-grist.mjs';
import { createI18n } from '/js/i18n/i18n.js';
import { installSprite } from '/js/ui/icons.js';
import { leaveQuestion } from '/js/broker/leave.js';
import { askOptions } from '/js/rights/rights-actions.js';
import { ThemeHost } from '/js/theme/theme-apply.js';
import { settingsItems } from '/js/shell/settings-menu.js';
import { aboutItems } from '/js/shell/about.js';
import { ThemeSetting } from '/js/theme/theme.js';
import { modulesModel } from '/js/apps/modules-model.js';
import { readCatalogue } from '/js/apps/libraries.js';
import { withApp, withExtension, withMode, withNativeMode } from '/js/apps/settings.js';
import { ThemeWindow } from '/js/theme/theme-window.js';
import { Trash } from '/js/files/trash.js';
import { openShare } from '/js/sharing/share-window.js';
import { openManage } from '/js/sharing/manage-window.js';
import { ManageControl } from '/js/sharing/manage-control.js';
import { limitOf, whyNot } from '/js/sharing/share-other.js';
import { openShareOther } from '/js/sharing/share-other-window.js';
import { openShareReceive } from '/js/sharing/share-receive-window.js';
import { openWeight } from '/js/weight/weight-window.js';
import { alertBar } from '/js/weight/weight-alert.js';
import { openDependencies } from '/js/apps/dependencies-window.js';
import { dependencyRows } from '/js/apps/dependencies-model.js';
import { carriedOf } from '/js/apps/dependencies-carried.js';
import { securityOf, carriedCheck } from '/js/apps/dependencies-security.js';
import { allUnits } from '/js/apps/dependencies-source.js';
import { newSerial } from '/js/apps/dependencies-export.js';
import { AppsState } from '/js/apps/apps-state.js';
import { verifyCopy } from '/js/apps/dependencies-audit.js';
import { ModulesWindow } from '/js/apps/modules-window.js';
import { WorkWindow } from '/js/apps/work-window.js';
import { SQL, readWeight } from '/js/weight/weight-reader.js';
import { TransferError } from '/js/broker/transfer.js';
import { Entries } from '/js/broker/entries.js';
import { TemplatesControl } from '/js/apps/templates-control.js';
import { label as manifestLabel } from '/js/apps/manifest.js';

const DAY = 86400;
// Nom, type (une valeur du manifeste ; `macro` est grisé, son extension étant éteinte), ancienneté en jours, auteur, dossier, poids en octets (de quelques octets à plusieurs Mo : toutes les unités
// de la colonne « Poids »). Assez de lignes pour remplir un panneau de 400 px.
const MODELS = [
  ['Attestation de formation de fin de session', 'document', 13, 'Grist Factory', '', 48200], ['Convocation', 'document', 13, 'Grist Factory', '', 21500], ['Émargement', 'document', 13, 'Grist Factory', '', 9800],
  ['Main', 'presentation', 1, 'Service RH', '', 2310000], ['Présentation commerciale', 'presentation', 12, 'Service RH', '', 4870000], ['Présentation commerciale (2)', 'presentation', 0.1, 'Service RH', '', 4890000],
  ['source', 'presentation', 12, 'Service RH', '', 1240000], ['test1', 'document', 0.3, 'Service RH', '', 1800], ['Grille de suivi', 'grille', 20, 'Équipe formation', '', 310000],
  ['Contrat de prestation', 'document', 5, 'Équipe formation', 'Formation', 1950000], ['Support de session', 'presentation', 6, 'Équipe formation', 'Formation', 3320000], ['Autre format', 'macro', 7, 'Service RH', '', 640],
];

// Les pièces jointes du document, [numéro, `fileIdent`, taille, `timeDeleted`] : celle du PDF de `__withPdf` (le numéro 900, citée par son fichier), trois photos qu'aucun fichier ne cite (2 000 000, 1 500 000 et 3 000 000
// octets), la copie de la deuxième (un autre numéro, le même `fileIdent` : Grist ne la compte pas deux fois) et une pièce supprimée (5 000 000 octets). La case « + pièces jointes » doit donc ajouter 6 500 000 octets.
const ATTACHMENTS = [
  [900, 'pdf-attestation.pdf', 640000, null], [901, 'photo-1.jpg', 2000000, null], [902, 'photo-2.jpg', 1500000, null], [903, 'photo-3.jpg', 3000000, null],
  [904, 'photo-2.jpg', 1500000, null], [905, 'photo-supprimee.jpg', 5000000, 1793784337.01],
];
const attachmentsTable = () => ({ id: ATTACHMENTS.map(row => row[0]), fileIdent: ATTACHMENTS.map(row => row[1]), fileSize: ATTACHMENTS.map(row => row[2]), timeDeleted: ATTACHMENTS.map(row => row[3]) });

// Les tables de Grist, en colonnes : les modèles, puis leur rangement (le dossier de chacun) ; `weights` : ce que pèse chaque modèle (le vrai calcul des octets est celui de test/weight.test.mjs).
function tables(now) {
  const models = { id: [], Nom: [], TypeModele: [], DateModif: [], ModifiePar: [] };
  const prefs = { id: [], Utilisateur: [], ModeleId: [], Dossier: [], Epingle: [] };
  const weights = MODELS.map(model => model[5]);
  MODELS.forEach(([name, type, days, by, folder], index) => {
    models.id.push(index + 1);
    models.Nom.push(name);
    models.TypeModele.push(type);
    models.DateModif.push(now - Math.round(days * DAY));
    models.ModifiePar.push(by);
    prefs.id.push(index + 1);
    prefs.Utilisateur.push('');
    prefs.ModeleId.push(index + 1);
    prefs.Dossier.push(folder);
    prefs.Epingle.push(false);
  });
  return { models, prefs, weights };
}

const memory = () => { const store = { value: null, read: () => store.value, write: value => { store.value = value; return true; } }; return store; };

async function mount() {
  const language = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'fr';
  const i18n = createI18n(language);
  const manifest = await (await fetch('/manifestes/publipostage.json')).json();
  const spec = manifest.fichiers[0];
  const { models, prefs, weights } = tables(Math.floor(Date.now() / 1000));
  const files = applyFiling(readFiles(manifest, spec, models, weights), readFiling(spec.rangement, prefs, ''));
  const stage = document.getElementById('stage');
  installSprite(document);
  const mode = () => (document.documentElement.getAttribute('data-grist-appearance') === 'dark' ? 'sombre' : 'clair');
  const locale = language === 'en' ? 'en-GB' : 'fr-FR';
  const theme = { open: () => {} };
  // Les fichiers vivants et ceux de la corbeille ; le gardien de doublure les déplace de l'une à l'autre, comme le ferait la table de GFS.
  let live = [...files];
  let trashed = [];
  let kept = []; // les dossiers que la personne garde sans fichier
  let arrivals = []; // les fichiers reçus d'un autre document (« Partagés avec moi », `window.__shared`)
  // Les raccourcis (test/raccourcis-firefox.mjs) : les lignes `gfs-shortcut` d'un rangement de doublure (la table telle que `fetchTable` la rend), lues par le vrai modèle ; `window.__shortcutsOn` allume le bouton.
  let shortcutRows = [];
  const shortcutData = () => ({ id: shortcutRows.map(row => row.id), ...Object.fromEntries(['User', 'App', 'File', 'Folder', 'Value'].map(column => [column, shortcutRows.map(row => row[column])])) });
  const show = () => explorer.setFiles([...live, ...shortcutFiles(readShortcuts(shortcutData(), 'essai@example.com'), live, arrivals)], trashed, kept, arrivals);
  const folders = new Map(files.map(file => [file.key, file.folder])); // où chaque fichier est au départ : couper puis coller en déplace, `__reset` les remet
  const pick = (list, wanted) => list.findIndex(file => file.key === wanted.key);
  const move = (from, to, wanted) => { const at = pick(from, wanted); if (at < 0) return null; const [file] = from.splice(at, 1); to.push(file); return file; };
  window.__filing = [];
  window.__notices = [];
  window.__attachments = 0;
  window.__attachmentsFail = '';
  const noted = (name, ...args) => async file => { window.__filing.push([name, ...args.map(arg => (arg === 'name' ? file.name : file))]); };
  // Un fichier que seule l'app ouverte sait fermer ou copier (contrats 2.4 `appel`, test/composite-firefox.mjs) : les fichiers de type `grille` en font office ; `window.__appOpen = false` : l'app n'est pas ouverte, le geste
  // attend (les phrases de js/i18n/i18n-trash.js, comme dans js/files/app-files.js) ; ouverte, l'app ajoute sa phrase (`window.__appSaid`) à celle de GFS.
  window.__appOpen = true;
  window.__appSaid = { trash: 'Son lien public est fermé.', copy: 'Elle n\u2019est pas publiée.' };
  const waits = (file, gesture) => (file && file.type === 'grille' && window.__appOpen === false && gesture ? { text: i18n.t(gesture === 'copy' ? 'copy.openApp' : 'trash.openApp', { app: 'Publipostage+' }) } : null);
  const guardian = {
    manages: () => true,
    lock: waits,
    waitsForApp: waits,
    trash: async file => {
      const done = Boolean(move(live, trashed, file) && Object.assign(file, { trashed: { ts: Math.floor(Date.now() / 1000), by: 'Service RH' } }));
      return done && file.type === 'grille' ? { said: window.__appSaid.trash } : done;
    },
    restore: async file => { const back = move(trashed, live, file); if (back) back.trashed = null; return back ? { name: back.name, renamed: false } : null; },
    empty: async list => list.filter(file => move(trashed, [], file)).length,
  };
  // La copie : un gardien de doublure ajoute à la liste un fichier de plus, sous le premier nom libre « Nom (1) » ; un fichier de type « macro » ne se copie pas (grisé, comme une app sans recette).
  window.__copies = [];
  let copied = 100;
  const copier = {
    copies: file => file.type !== 'macro',
    lock: waits,
    waitsForApp: waits,
    copy: async file => {
      const original = live.find(item => item.key === file.key);
      if (!original) return null;
      const id = String(++copied);
      const names = live.map(item => item.name);
      let n = 1;
      while (names.includes(`${original.name} (${n})`)) n += 1;
      const made = { ...original, key: `${original.app}:${id}`, id, row: copied, name: `${original.name} (${n})`, folder: '', pinned: false, search: '' };
      live.push(made);
      return file.type === 'grille' ? { id, name: made.name, said: window.__appSaid.copy } : { id, name: made.name };
    },
  };
  const copying = new Copying({
    managers: [copier], t: i18n.t, notice: text => window.__notices.push(text), refresh: async () => show(),
    file: async (app, id, folder) => { live.find(item => item.id === id).folder = folder; window.__copies.push([id, folder]); },
  });
  // Le rangement de doublure d'un fichier ou d'un dossier collé après Ctrl+X : il déplace vraiment, et rend ce que rend js/explorer/filing.js.
  const settle = result => { show(); return result; };
  const moving = {
    moveFileTo: async (file, folder) => {
      const at = live.find(item => item.key === file.key);
      if (!at) return undefined;
      window.__filing.push(['moveTo', at.name, folder]);
      if (at.folder === folder) return 'same';
      at.folder = folder;
      return settle('moved');
    },
    moveFolderTo: async (path, folder) => {
      const target = normalizePath(`${folder}/${path.split('/').pop()}`);
      window.__filing.push(['moveFolderTo', path, folder]);
      if (target === path) return 'same';
      if (inside(target, path)) return 'inside';
      const moves = folderMoves(live, path, target);
      if (!moves.length) return 'gone';
      for (const move of moves) live.find(item => item.id === move.file).folder = move.folder;
      return settle('moved');
    },
  };
  const bin = new Trash({
    managers: [guardian], ask: opts => ask({ ...opts, container: stage, inertTargets: () => [explorer.root] }), t: i18n.t, notice: text => window.__notices.push(text), refresh: async () => show(), keepFolders: file => filing.keepFoldersOf(file),
  });
  // Les dossiers sans fichier : le vrai `Filing` sur un rangement de doublure qui range les fichiers et tient les dossiers gardés, comme `GFS_Filing` (un lot noté « setFiling:+gardé:-retiré »).
  const layer = opts => ({ ...opts, t: i18n.t, container: stage, inertTargets: () => [explorer.root] });
  const rangement = {
    setFiling: async (entries, folders = {}) => {
      const add = folders.add || [];
      const drop = folders.drop || [];
      window.__filing.push(['setFiling', ...add.map(path => `+${path}`), ...drop.map(path => `-${path}`)]);
      for (const entry of entries) { const file = live.find(item => item.id === entry.file); if (file) file.folder = entry.folder; }
      kept = [...kept.filter(path => !drop.includes(path)), ...add.filter(path => !kept.includes(path))];
    },
  };
  const filing = new Filing({
    port: null, rangement, t: i18n.t, locale: () => locale, files: () => live, folders: () => kept, appName: () => 'Publipostage+', here: () => (explorer.state.view === 'folder' ? explorer.state.path : ''),
    writeBlock: () => null, notice: text => window.__notices.push(text), specOf: () => null, refresh: async () => show(), windows: { name: opts => askName(layer(opts)), folder: opts => chooseFolder(layer(opts)) },
  });
  let shortcutSeq = 0;
  const shortcuts = new ShortcutGestures({
    rangement: { identity: 'essai@example.com', writeShortcuts: async make => {
      const actions = make({ data: shortcutData(), tableId: 'GFS_Filing', identity: 'essai@example.com' });
      for (const [kind, , id, values] of actions) {
        if (kind === 'AddRecord') shortcutRows.push({ id: ++shortcutSeq, ...values });
        else if (kind === 'UpdateRecord') Object.assign(shortcutRows.find(row => row.id === id), values);
        else if (kind === 'RemoveRecord') shortcutRows = shortcutRows.filter(row => row.id !== id);
      }
      return actions.length > 0;
    } },
    t: i18n.t, notice: text => window.__notices.push(text), writeBlock: () => null, files: () => live, folders: () => kept, locale: () => locale,
    here: () => (explorer.state.view === 'folder' ? explorer.state.path : ''), windows: { name: opts => askName(layer(opts)), folder: opts => chooseFolder(layer(opts)) },
    queue: task => task(), undoStack: filing.undoStack, refresh: async () => show(),
  });
  window.__shortcutsOn = false;
  window.__shortcutGestures = shortcuts;
  window.__shortcutLines = () => shortcutRows.map(row => ({ folder: row.Folder, ...JSON.parse(row.Value) }));
  // Un espace « Achats » (les espaces partagés, lot 4b) : le premier modèle est rangé dans son dossier Contrats, qui a un sous-dossier vide ; « Espaces » est une racine à côté de « Moi ».
  window.__spaces = () => {
    const info = readSpaces({ id: [1], Key: ['achats'], Name: ['Achats'] }, { id: [1, 2], Target: [live[0].key, ''], Space: ['achats', 'achats'], Folder: ['Contrats', 'Contrats/Sous'] });
    applyPlacement(live, info);
    kept = [...new Set([...kept, ...info.folders])];
    show();
  };
  // Les liens entre espaces (js/sharing/link-control.js, test/liens-espaces-firefox.mjs) : le vrai contrôle, les vraies fenêtres (choisir, nommer, demander) et le vrai calcul des lignes à écrire, sur un faux Grist
  // en mémoire (`window.__linkTables`, `window.__linkActions`). Deux espaces : Achats (le dossier Contrats, le premier modèle) et Ventes (le groupe « Commerciaux » y lit) ; `variant` : 'neuf' (aucun lien) ou 'lie' (Contrats
  // est déjà lié dans Ventes, sous le nom « Contrats achats »). `window.__linkOwner` : false = la personne n'est pas propriétaire.
  window.__spaceLinks = (variant = 'neuf') => {
    const linked = variant === 'lie';
    const tables = {
      GFS_Spaces: { columns: ['id', 'Key', 'Name'], rows: [{ id: 1, Key: 'achats', Name: 'Achats' }, { id: 2, Key: 'ventes', Name: 'Ventes' }] },
      GFS_Shares: { columns: ['id', 'Target', 'Person', 'Right', 'Download', 'End'], rows: [{ id: 1, Target: 'espace:achats', Person: '#Achats', Right: 'lecture' }, { id: 2, Target: 'espace:ventes', Person: '#Commerciaux', Right: 'lecture' },
        ...(linked ? [{ id: 3, Target: 'dossier:achats/Contrats', Person: '#Commerciaux', Right: 'lecture' }] : [])] },
      GFS_Placement: { columns: ['id', 'Target', 'Space', 'Folder', 'Link', 'Shares'], rows: [
        { id: 1, Target: live[0].key, Space: 'achats', Folder: 'Contrats', Link: '', Shares: '' },
        { id: 2, Target: '', Space: 'achats', Folder: 'Contrats/Sous', Link: '', Shares: '' },
        ...(linked ? [{ id: 3, Target: '', Space: 'ventes', Folder: 'Contrats achats', Link: 'dossier:achats/Contrats', Shares: '#Commerciaux' }] : [])] },
    };
    const grist = fakeGrist(tables);
    window.__linkTables = grist.tables;
    window.__linkActions = grist.actions;
    window.__linkOwner = true;
    let info = null;
    const read = () => {
      const column = (rows, id) => rows.map(row => row[id]);
      const place = tables.GFS_Placement.rows;
      info = readSpaces({ id: column(tables.GFS_Spaces.rows, 'id'), Key: column(tables.GFS_Spaces.rows, 'Key'), Name: column(tables.GFS_Spaces.rows, 'Name') },
        { id: column(place, 'id'), Target: column(place, 'Target'), Space: column(place, 'Space'), Folder: column(place, 'Folder'), Link: column(place, 'Link'), Shares: column(place, 'Shares') });
      applyPlacement(live, info);
      kept = [...new Set([...kept, ...info.folders])];
      show();
    };
    read();
    const control = new LinkControl({ t: i18n.t, container: stage, inertTargets: () => [explorer.root], port: grist.port, fullAccess: () => true, writeBlock: () => null, spaces: () => info, files: () => live,
      notice: text => window.__notices.push(text), reader: { owner: async () => window.__linkOwner !== false }, refresh: async () => read() });
    window.__linkProxy = { whyNot: () => control.whyNot(), linkAt: path => control.linkAt(path), open: source => control.open(source), remove: link => control.remove(link) };
    explorer.render();
  };
  // Un fichier que quelqu'un a donné à la personne par son adresse (« Partagés avec moi », lot 4c) : le premier modèle, à la racine, jamais rangé par elle.
  window.__direct = () => { live[0].folder = ''; live[0].direct = { by: 'marc@example.com' }; show(); };
  window.__keep = (...paths) => { kept = [...new Set([...kept, ...paths])]; show(); };
  // Le menu « Réglages » : la langue et le bord de la barre que la personne a choisis en dernier (la ligne de la barre est une doublure : le vrai Dock se mesure dans le labo), et la vraie fenêtre « À propos ».
  const EDGES = [['gauche', 'dock-left'], ['haut', 'dock-top'], ['droite', 'dock-right'], ['bas', 'dock-bottom']];
  window.__resetSettings = () => { window.__language = language; window.__place = 'gauche'; window.__langtool = false; window.__reopen = true; };
  window.__resetSettings();
  const place = () => ({
    label: i18n.t('dock.place'), icon: 'dock-left', submenu: EDGES.map(([edge, glyph]) => ({ label: i18n.t(`dock.${edge}`), icon: glyph, check: window.__place === edge, run: () => { window.__place = edge; } })),
  });
  // « Index des noms… » (js/rights/index-control.js) : la vraie question, sur un plan d'exemple (deux tables de fichiers, des règles à recopier, une table laissée de côté).
  window.__indexAsk = () => void ask({ ...askOptions(i18n.t, 'index', { ok: true, tables: ['GFS_Fichiers', 'Publipostage_Modeles'], rules: true, skipped: ['Autre_Table'] }), container: stage,
    inertTargets: () => [explorer.root] });
  window.__about = () => void ask({ title: i18n.t('about.title'), message: i18n.t('about.text'), items: aboutItems(i18n.t), confirmLabel: i18n.t('about.close'), container: stage, inertTargets: () => [explorer.root] });
  // « Apps et extensions » et « Table de travail » (js/apps/modules-window.js, js/apps/work-window.js ; test/voile-firefox.mjs) : des fenêtres à part de la base commune, dont le fond ne ferme rien non plus.
  window.__modulesWindow = () => void new ModulesWindow({ container: stage, i18n, locale, model: () => ({ items: [], active: 0, total: 0 }), blocked: () => null, inertTargets: () => [explorer.root], on: {}, onClose: () => {} }).open();
  // « Apps et extensions » avec les bibliothèques natives, fonction par fonction (js/apps/modules-window.js, contrats 2.6 point 14 ; test/natives-firefox.mjs) : le vrai modèle, le vrai catalogue de GFS et le manifeste de
  // Publipostage+ à qui l'on donne quatre fonctions (ce que son manifeste dira quand l'app lira le choix). `variant` : 'ok', 'manque' (le catalogue n'a pas les polices : la copie du PDF est grisée), 'editeur-sans-cdn' (l'éditeur n'a pas de CDN : sa copie sert seule, le CDN est grisé), 'editeur' (l'éditeur, copie dans l'app), 'direct' (l'édition collaborative cochée) ou 'lecture' (rien ne peut s'écrire).
  window.__natives = async (variant = 'ok') => {
    const L = (id, version) => ({ id, version });
    const manifest = await (await fetch('/manifestes/publipostage.json')).json();
    manifest.natives = [
      { id: 'pdf', nom: { fr: 'Export PDF (pdfmake, polices, JSZip)', en: 'PDF export (pdfmake, fonts, JSZip)' }, bibliotheques: [L('pdfmake', '0.2.7'), L('pdfmake-polices', variant === 'manque' ? '9.9.9' : '0.2.7'), L('jszip', '3.10.1')] },
      { id: 'word', nom: { fr: 'Export Word (docx)', en: 'Word export (docx)' }, bibliotheques: [L('docx', '9.15.1'), L('docx-charts', '9.15.1')] },
      { id: 'excel', nom: { fr: 'Export Excel (ExcelJS)', en: 'Excel export (ExcelJS)' }, bibliotheques: [L('exceljs', '4.4.0')] },
      { id: 'divers', nom: { fr: 'Divers (marked, QR code, pdf-lib)', en: 'Other (marked, QR code, pdf-lib)' }, bibliotheques: [L('pdf-lib', '1.17.1'), L('marked', '15.0.12'), L('qrcode-generator', '1.4.4')] },
    ];
    // 'editeur' : l'éditeur a sa copie figée dans le dépôt de l'app (carte d'importation, contrats 2.6 point 14) : une fonction de plus, sans bibliothèque de GFS, dont le choix ne prend effet qu'au démarrage de l'app.
    if (variant === 'editeur' || variant === 'editeur-sans-cdn') manifest.natives.unshift({ id: 'editeur', nom: { fr: 'Éditeur (TipTap)', en: 'Editor (TipTap)' }, copieDansApp: true, poids: 1172757, ...(variant === 'editeur-sans-cdn' ? { sansCdn: true } : {}) });
    const catalogue = readCatalogue(await (await fetch('/bibliotheques/catalogue.json')).json());
    const loaded = [{ app: { id: manifest.id }, manifest, ok: true, errors: [] }];
    // 'direct' : l'édition collaborative est cochée (Publipostage+ ne nomme pas encore l'adresse de son CDN : la fenêtre le dit sous le choix « Depuis un CDN », test/natives-firefox.mjs).
    let apps = { [manifest.id]: { extensions: variant === 'direct' ? ['edition'] : [], modes: {} } };
    window.__nativeEvents = [];
    window.__modeEvents = [];
    const win = new ModulesWindow({
      container: stage, i18n, locale, model: () => modulesModel(loaded, { apps }, catalogue, [manifest.id]), blocked: () => (variant === 'lecture' ? 'lecture seule' : null), inertTargets: () => [explorer.root],
      on: {
        nativeMode(app, group, mode) { apps = withNativeMode(apps, manifest, group, mode); window.__nativeEvents.push([app, group, mode]); win.refresh(); },
        mode(app, extension, mode) { apps = withMode(apps, manifest, extension, mode); window.__modeEvents.push([app, extension, mode]); win.refresh(); },
      }, onClose: () => {},
    });
    win.open();
  };
  // « Apps et extensions » en vitrine (js/apps/vitrine.js, décision du 17/11, « A · Vitrine » ; test/vitrine-firefox.mjs) : les quatre manifestes de GFS, le vrai modèle et le vrai catalogue. Chaque geste est noté
  // dans `window.__vitrineEvents` et change l'état comme le registre le ferait ; la fenêtre se redessine ensuite. `variant` : 'ok' (Publipostage+, toujours active, est la seule installée), 'lecture' (document en lecture
  // seule), 'refusee' (le manifeste de Grist-BI est refusé), 'captures' (Publipostage+ déclare deux captures : un vrai fichier, un fichier absent ; Automation+ deux vrais fichiers), 'livrees' (les vraies vitrines des manifestes).
  window.__vitrine = async (variant = 'ok') => {
    const L = (fr, en) => ({ fr, en });
    const manifests = await Promise.all(['publipostage', 'automation', 'form', 'bi'].map(async id => (await fetch(`/manifestes/${id}.json`)).json()));
    // Sauf `livrees` (les vitrines que les apps ont rendues, vraies images de GFS comprises), la fenêtre est essayée sans vitrine : chaque variante pose les siennes.
    if (variant !== 'livrees') for (const manifest of manifests) delete manifest.vitrine;
    if (variant === 'captures') {
      manifests[0].vitrine = { description: L('Une description longue de Publipostage+.', 'A long description of Publipostage+.'), captures: [
        { fichier: '../test/pages/capture-essai.png', legende: L('Première capture', 'First screenshot') }, { fichier: 'absente.png', legende: L('Deuxième capture', 'Second screenshot') }] };
      // Automation+ (non installée) a deux captures qui se chargent : sa fiche est assez longue pour que la barre du haut reprenne « Installer ».
      manifests[1].vitrine = { captures: [{ fichier: '../test/pages/capture-essai.png', legende: L('Une capture', 'A screenshot') }, { fichier: '../test/pages/capture-essai.png', legende: L('Une autre', 'Another one') }] };
    }
    const refused = manifest => variant === 'refusee' && manifest.id === 'bi';
    const loaded = manifests.map(manifest => ({ app: { id: manifest.id }, manifest, ok: !refused(manifest), errors: refused(manifest) ? ['version « 1.0 » : une version exacte est attendue'] : [] }));
    const catalogue = readCatalogue(await (await fetch('/bibliotheques/catalogue.json')).json());
    const byId = id => manifests.find(manifest => manifest.id === id);
    let apps = { publipostage: { extensions: [], modes: {} } };
    window.__vitrineEvents = [];
    let before = apps;
    const change = (event, next) => { window.__vitrineEvents.push(event); before = apps; apps = next; win.refresh(); };
    window.__vitrineUndo = () => { apps = before; win.refresh(); }; // un refus (de créer la table) remet l'état d'avant
    const win = new ModulesWindow({
      container: stage, i18n, locale, model: () => modulesModel(loaded, { apps }, catalogue, ['publipostage']), blocked: () => (variant === 'lecture' ? i18n.t('mod.readonly') : null), inertTargets: () => [explorer.root],
      on: {
        app: (id, on) => change(['app', id, on], withApp(apps, byId(id), on)),
        extension: (app, id, on) => change(['extension', app, id, on], withExtension(apps, byId(app), id, on)),
        mode: (app, id, mode) => change(['mode', app, id, mode], withMode(apps, byId(app), id, mode)),
        nativeMode: (app, group, mode) => change(['nativeMode', app, group, mode], withNativeMode(apps, byId(app), group, mode)),
        open: id => window.__vitrineEvents.push(['open', id]),
      }, onClose: () => {},
    });
    win.open();
  };
  // « Nouveau > Depuis un modèle » (test/modeles-firefox.mjs) : le vrai contrôle, la vraie fenêtre et les vraies `Entries` (js/broker/entries.js) sur les quatre manifestes de GFS et les vrais
  // catalogues de modèles (Publipostage+ 22, Automation+ 5, Form+ 5, Grist-BI 3, leurs vignettes). `variant` : 'pret' (les apps savent ouvrir un modèle comme leur manifeste le dit, leurs extensions sont cochées), 'attente' (sans
  // `ouverture.modele`), 'bientot' (Automation+ sans catalogue), 'extension' (le graphique n'est pas coché), 'absente' (l'app n'est pas installée), 'illisible' (le catalogue ne se lit pas). `window.__templatesLog` note ce que la fenêtre
  // rend au contrôleur (`created` : « app/modèle » ; `unlocked` : le grisé débloqué) ; `window.__templatesLanguage(lang)` change la langue fenêtre ouverte, comme le contrôleur de GFS.
  window.__templates = async (variant = 'pret') => {
    const manifests = await Promise.all(['publipostage', 'automation', 'form', 'bi'].map(async id => (await fetch(`/manifestes/${id}.json`)).json()));
    // Les manifestes sont ceux de GFS : quatre apps déclarent un catalogue (`modeles`), trois savent ouvrir un modèle (Automation+ pas encore : ses cinq modèles sont grisés « pas encore »
    // dans toutes les variantes) ; 'attente' ôte ce savoir-faire aux trois ; 'bientot' ôte son catalogue à Automation+ (la pastille grisée « bientôt »).
    for (const manifest of manifests) if (manifest.ouverture && manifest.ouverture.modele) manifest.ouverture = { ...manifest.ouverture, modele: variant !== 'attente' };
    if (variant === 'bientot') delete manifests.find(manifest => manifest.id === 'automation').modeles;
    const catalogue = readCatalogue(await (await fetch('/bibliotheques/catalogue.json')).json());
    const apps = variant === 'absente' ? {} : { publipostage: { extensions: variant === 'extension' ? ['diapositives'] : ['diapositives', 'graphique'], modes: {} },
      automation: { extensions: [], modes: {} }, form: { extensions: [], modes: {} }, bi: { extensions: [], modes: {} } };
    const byId = new Map(manifests.map(manifest => [manifest.id, manifest]));
    let current = { i18n, lang: language };
    const host = {
      get lang() { return current.lang; }, t: (key, vars) => current.i18n.t(key, vars), fullAccess: true,
      registry: { apps, catalogue, has: id => id in apps, manifest: id => byId.get(id) || null, installedIds: () => Object.keys(apps) },
      validApps: () => manifests.map(manifest => ({ ok: true, manifest })), manifests: () => manifests, manifestOf: id => byId.get(id) || null,
      appName: id => manifestLabel(byId.get(id).nom, current.lang),
    };
    window.__templatesLog = { created: [], unlocked: [] };
    const readJson = async path => {
      const response = await fetch(`/${variant === 'illisible' ? 'absent/' : ''}${path}`);
      if (!response.ok) throw new Error(`${path} : ${response.status}`);
      return response.json();
    };
    const control = new TemplatesControl({
      container: stage, i18n, inertTargets: () => [explorer.root], manifests: () => manifests, entries: new Entries(host).templates, readJson,
      unlock: async lock => { window.__templatesLog.unlocked.push(lock); }, onCreate: entry => window.__templatesLog.created.push(`${entry.app}/${entry.id}`),
    });
    window.__templatesControl = control;
    window.__templatesLanguage = lang => { current = { i18n: createI18n(lang), lang }; control.relocalize({ i18n: current.i18n, locale: lang === 'en' ? 'en-GB' : 'fr-FR' }); };
    await control.open();
  };
  window.__workWindow = () => void new WorkWindow({ container: stage, i18n, inertTargets: () => [explorer.root], source: { pageTable: 'Inscrits', pageRow: null, current: null, tables: () => [{ id: 'Inscrits', locked: null }], rows: async () => [] }, onPick: () => {}, onClose: () => {} }).open();
  // « Partagés avec moi » (js/sharing/received-control.js, test/partager-recevoir-firefox.mjs) : le vrai contrôle, la vraie fenêtre « Accepter ? » et les vraies marques, écrites dans un faux Grist en mémoire (`window.__sharedTables`).
  // `window.__shared(kind)` y pose des arrivées et ouvre la vue ; `window.__sharedBlocked` : la phrase qui dit pourquoi rien ne s'écrit.
  const baseLabel = file => (file.typeInfo ? file.typeInfo.nom[language] || file.typeInfo.nom.fr : file.type);
  let sharedGrist = fakeGrist({});
  const readArrivals = async () => { arrivals = await loadReceived(sharedGrist.port, await sharedGrist.port.doc.listTables()); show(); };
  const received = new ReceivedControl({
    port: sharedGrist.port, t: i18n.t, locale: () => locale, container: stage, inertTargets: () => [explorer.root], typeLabel: baseLabel, notice: text => window.__notices.push(text), blocked: () => window.__sharedBlocked || null,
    refresh: readArrivals, open: file => { window.__opened = file.name; }, answerFile: (port, file, accepted) => answerFile(sharedGrist.port, file, accepted), answerFolder: (port, folder, accepted) => answerFolder(sharedGrist.port, folder, accepted),
  });
  window.__sharedBlocked = '';
  // Un fichier arrive pendant que l'explorateur est ouvert : la ligne est posée dans le faux Grist, puis la liste des arrivées se remplace seule (`Explorer.setReceived`, comme le fait le contrôleur).
  window.__arrive = async name => {
    const rows = sharedGrist.tables.GFS_Received.rows;
    const id = rows.length + 1;
    rows.push({ ...rows[0], id, FileId: `r${id}`, Name: name, Accepted: false, Refused: false, Content: ['L', id] });
    arrivals = await loadReceived(sharedGrist.port, await sharedGrist.port.doc.listTables());
    explorer.setReceived(arrivals);
  };
  window.__shared = async kind => {
    const day = Math.floor(Date.now() / 1000) - 86400;
    const row = (id, name, extra = {}) => ({ id, FileId: `r${id}`, Name: name, Type: 'pdf', Date: day - id * 3600, Author: 'Comptabilité <compta@exemple.fr>', Content: ['L', id], Size: 1500 * id, Origin: 'import', Supprimee_a_la_source: false, ...extra });
    const rows = kind === 'vide' ? [] : kind === 'dossier' ? [row(1, 'Contrat de prestation.pdf', { SharedFolder: 'Contrats' }), row(2, 'Avenant 1.pdf', { SharedFolder: 'Contrats' }), row(3, 'Avenant 2.pdf', { SharedFolder: 'Contrats', Accepted: true, Refused: false }),
      row(4, 'Plan.pdf', { SharedFolder: 'Archives', Accepted: true, Refused: false }), row(5, 'Rapport.pdf', { SharedFolder: 'Archives', Accepted: true, Refused: false }), row(6, 'Seul.pdf', { SharedFolder: '' })] : [row(1, 'Facture de la session de formation de septembre 2026.pdf'), row(2, 'Devis.pdf'), row(3, 'Contrat.pdf', { Accepted: true, Refused: false }), row(4, 'Ancien refus.pdf', { Accepted: false, Refused: true }), row(5, 'Retiré.pdf', { Accepted: true, Refused: false, Supprimee_a_la_source: true })];
    const columns = ['id', ...filesColumnIds(), 'Supprimee_a_la_source', 'Accepted', 'Refused', 'SharedFolder'];
    sharedGrist = fakeGrist(kind === 'vide' ? {} : { GFS_Received: { columns, rows } });
    window.__sharedTables = sharedGrist.tables;
    window.__sharedActions = sharedGrist.actions;
    await readArrivals();
    explorer.state.view = 'shared';
    explorer.render();
  };
  // Les fichiers « ouverts » (la vue « Ouverts », test/ouverts-firefox.mjs) : `window.__open(noms)` les ouvre dans l'ordre, le dernier est celui que l'app affiche ; `__reset` les vide.
  const SESSION = {};
  const openedFiles = new OpenedFiles();
  const explorer = new Explorer({
    container: stage, i18n, locale, now: () => new Date(), appName: () => 'Publipostage+', received,
    typeLabel: file => (file.shortcut ? shortcuts.typeLabel(file, baseLabel) : (file.received ? received.typeLabel(file) : baseLabel(file))),
    lockOf: file => (file.shortcut ? shortcuts.lockOf(file) : file.received ? received.lockOf(file) : (file.name === 'Autre format' ? { text: i18n.t('ex.lockedExtension', { name: 'Macro-modèles' }) } : null)), newTypes: () => [], importTypes: () => window.__importTypes || [], canClose: () => window.__canClose !== false,
    notice: text => window.__notices.push(text), settings: () => settingsItems({ t: i18n.t, language: () => ({ choice: window.__language, grist: language }), onLanguage: value => { window.__language = value; }, onTheme: () => theme.open(),
      langtool: () => ({ shown: window.__langtool, toggle: () => { window.__langtool = !window.__langtool; } }),
      reopen: () => ({ on: window.__reopen, toggle: () => { window.__reopen = !window.__reopen; } }), place, onAbout: () => window.__about(), onDependencies: () => { window.__dependenciesAsked = (window.__dependenciesAsked || 0) + 1; void window.__dependencies(); },
      manage: () => ({ why: null, open: () => { window.__manageFromSettings = (window.__manageFromSettings || 0) + 1; }, notice: text => window.__notices.push(text) }),
      index: () => ({ why: null, open: () => { window.__indexFromSettings = (window.__indexFromSettings || 0) + 1; window.__indexAsk(); }, notice: text => window.__notices.push(text) }) }),
    onOpen: file => { window.__opened = file.name; }, onNew: () => {}, get links() { return window.__linkProxy; }, get shortcuts() { return window.__shortcutsOn ? shortcuts : null; }, get notices() { return window.__noticeStore; },
    opened: { keys: () => openedFiles.keys(), shown: () => openedFiles.shown(SESSION), remove: key => openedFiles.remove(key) },
    onImport: entry => { window.__imported = entry.valeur; }, onTemplates: () => { window.__templatesAsked = (window.__templatesAsked || 0) + 1; }, onClose: () => {}, onApps: () => {}, sharing: { whyNot: () => null, whyNotFolder: path => (path.startsWith('Espaces') && path.split('/').length < 3 ? i18n.t('share.folder.space') : null), folderFile: path => ({ key: window.__linkProxy && path.startsWith('Espaces/') ? `dossier:${path.split('/').slice(1).join('/').replace(/^[^/]+/, word => word.toLowerCase())}` : `dossier:${path}`, name: path.split('/').pop(), path, mine: !path.startsWith('Espaces/') }), open: file => window.__share(window.__shareKind || 'actif', file),
      // « Partager… » sur la ligne d'un espace entier (demande du 25/11) : il ouvre le partage de l'espace ; « Espaces » seul et un espace inconnu restent grisés.
      whyNotShareFolder: path => (path === 'Espaces' ? i18n.t('share.folder.space') : null),
      shareFolderFile(path) { return /^Espaces\/[^/]+$/.test(path) ? { key: `espace:${path.split('/')[1].toLowerCase()}`, name: path.split('/')[1], space: { name: path.split('/')[1] }, wholeSpace: true } : this.folderFile(path); } }, onWeight: estimate => window.__weight(estimate), alerts: ({ detail }) => (window.__alertBytes ? [alertBar({ bytes: window.__alertBytes, locale, t: i18n.t, detail })] : []), personal: () => true, kept: null, trash: bin, copying,
    attachments: async () => { window.__attachments += 1; if (window.__attachmentsFail) return { error: new Error(window.__attachmentsFail) }; return { data: attachmentsTable() }; },
    filing: { togglePin: noted('pin', 'name'), rename: noted('rename', 'name'), moveFile: file => filing.moveFile(file), renameFolder: async path => { window.__filing.push(['renameFolder', path]); }, moveFolder: path => filing.moveFolder(path), ...moving,
      newFolder: () => filing.newFolder(), deleteFolder: path => filing.deleteFolder(path), undoStack: filing.undoStack },
  });
  window.__explorer = explorer;
  // Ce qu'on a donné à la personne dans le document (la cloche, test/notifications-firefox.mjs) : `window.__given(items)` pose la liste que le magasin rendrait (js/sharing/notice-store.js) et un faux magasin
  // qui note ce que la cloche lui demande de marquer lu (`window.__noticeMarked`) ; sans appel, l'explorateur n'a pas de magasin, comme avant.
  window.__given = items => {
    window.__noticeMarked = [];
    window.__noticeStore = { markRead: async keys => { window.__noticeMarked.push(keys ? keys.slice() : 'all'); } };
    explorer.setNotices({ items, unread: items.filter(item => !item.lu).length });
  };
  window.__open = names => { for (const name of names) openedFiles.add(live.find(file => file.name === name).key, SESSION); explorer.render(); };
  window.__reset = () => {
    explorer.close(); // la fermeture vide le presse-papiers : chaque mesure part de rien
    filing.undoStack.clear(); // et la pile de Ctrl+Z
    live = [...files];
    for (const file of live) { file.trashed = null; file.folder = folders.get(file.key); delete file.space; delete file.ownFolder; delete file.direct; }
    trashed = [];
    kept = [];
    arrivals = [];
    window.__sharedBlocked = '';
    window.__linkProxy = undefined; // plus de liens entre espaces : les menus redeviennent ceux d'avant
    window.__shortcutsOn = false; // ni bouton ni raccourci : les menus redeviennent ceux d'avant
    shortcutRows = [];
    window.__filing.length = 0;
    window.__copies.length = 0;
    window.__notices.length = 0;
    window.__noticeStore = undefined;
    explorer.setNotices({ items: [], unread: 0 });
    window.__attachments = 0;
    window.__attachmentsFail = '';
    window.__opened = null;
    for (const key of openedFiles.keys()) openedFiles.remove(key);
    window.__appOpen = true;
    window.__canClose = true; // `false` : aucune app n'est ouverte, « Fermer » se cache (test/pieces-jointes-firefox.mjs)
    setting.reset(); // l'ambiance d'origine, comme au départ ; « Revenir à Grist Factory » laisse l'accessibilité renforcée (un besoin, pas un goût) : on l'éteint aussi
    setting.chooseAccess(false);
    window.__resetSettings();
    Object.assign(explorer.state, { view: 'folder', path: '', display: 'list', type: 'all', q: '', sel: null });
    explorer.root.querySelector('input[type="search"]').value = '';
    show();
    explorer.open();
  };
  // Le thème comme dans GFS : un seul réglage, que la fenêtre « Thème » écrit et que l'hôte pose sur la page (l'ambiance et le mode de Grist, `data-grist-appearance`) ; les essais le changent par
  // `window.__ambiance(id)` (les icônes des types) et par `window.__theme` (`choose`, `chooseAccess` : l'ambiance et l'accessibilité renforcée).
  const setting = new ThemeSetting({ ambianceStore: memory(), colorStore: memory(), accessStore: memory() });
  window.__theme = setting;
  new ThemeHost({ win: window, setting }).start();
  window.__ambiance = id => setting.choose(id);
  const themeWindow = new ThemeWindow({ container: stage, i18n, locale, setting, mode, inertTargets: () => [explorer.root] });
  theme.open = () => themeWindow.open();
  // Un PDF gardé par GFS, lu comme l'explorateur le lit : les colonnes de `GFS_Files` et le manifeste de GFS. `__reset` remet `live` aux fichiers de départ : le PDF disparaît.
  window.__withPdf = () => {
    const [pdf] = readFiles(filesManifest(), filesManifest().fichiers[0], { id: [900], FileId: ['essai-pdf'], Name: ['Attestation.pdf'], Type: ['pdf'], Date: [Math.floor(Date.now() / 1000) - 3600], Author: ['Service RH'], Content: [['L', 900]], Size: [640000] });
    live.push(pdf);
    show();
  };
  // Un document de `count` fichiers de plus (la liste fenêtrée, test/fenetrage-firefox.mjs) : des modèles « Fichier 00001 », de poids et de dates qui varient, lus par le vrai modèle ; `__reset` les retire.
  window.__many = count => {
    const at = index => String(index + 1).padStart(5, '0');
    const indexes = Array.from({ length: count }, (unused, index) => index);
    const more = { id: indexes.map(index => 1000 + index), Nom: indexes.map(index => `Fichier ${at(index)}`), TypeModele: indexes.map(index => ['document', 'presentation', 'grille'][index % 3]), DateModif: indexes.map(index => Math.floor(Date.now() / 1000) - index * 600), ModifiePar: indexes.map(() => 'Service RH') };
    const nobody = { id: [], Utilisateur: [], ModeleId: [], Dossier: [], Epingle: [] }; // aucun rangement : tous à la racine ; `applyFiling` pose aussi ce que la recherche lit (`file.search`)
    live.push(...applyFiling(readFiles(manifest, spec, more, indexes.map(index => 1000 + (index % 97) * 5000)), readFiling(spec.rangement, nobody, '')));
    show();
  };
  // Un e-mail et un macro-modèle de plus (décision du 24/11 : le violet de l'e-mail, les trois feuilles du macro-modèle ; test/icones-firefox.mjs), lus par le vrai modèle avec le vrai manifeste de GFS ;
  // `__reset` les retire. « Autre format » est aussi un macro-modèle, mais grisé : son icône reste au trait d'une seule couleur.
  window.__withMailAndMacro = () => {
    const more = { id: [2001, 2002], Nom: ['Courrier de relance', 'Mailing annuel'], TypeModele: ['email', 'macro'], DateModif: [Math.floor(Date.now() / 1000) - 7200, Math.floor(Date.now() / 1000) - 9000], ModifiePar: ['Service RH', 'Service RH'] };
    const nobody = { id: [], Utilisateur: [], ModeleId: [], Dossier: [], Epingle: [] };
    live.push(...applyFiling(readFiles(manifest, spec, more, [4200, 9100]), readFiling(spec.rangement, nobody, '')));
    show();
  };
  // Le fichier gardé qui porte déjà le nom, tel que GFS le décrit (date et auteur) ; la copie prendrait « (1) ».
  const detail = `${i18n.t('ex.modifiedOn', { date: '12/10/2026' })} · ${i18n.t('ex.modifiedBy', { by: 'Service RH' })}`;
  window.__askConflict = ({ app, repeat }) => {
    window.__conflict = null;
    askConflict({ container: stage, inertTargets: () => [explorer.root], t: (key, params) => i18n.t(key, params), name: 'Facture Martin.pdf', detail, copy: 'Facture Martin (1).pdf', app, repeat })
      .then(answer => { window.__conflict = answer; });
  };
  // La question de la table de la corbeille des fichiers des apps (contrats 6.7) : la fenêtre du widget, avec ses vrais textes, que le vrai contrôleur pose au premier fichier d'app mis à la corbeille.
  window.__askTable = () => void ask({
    title: i18n.t('trash.table.title'), message: i18n.t('trash.table.text'), confirmLabel: i18n.t('table.create'), cancelLabel: i18n.t('table.cancel'), container: stage, inertTargets: () => [explorer.root],
  });
  // La question de « fermer » (contrats 5.4, point 3) quand l'app se tait ou répond par une erreur : la fenêtre d'accord et les vrais textes de js/broker/leave.js, avec le plus long nom d'app ; `window.__leave` garde
  // la réponse de la personne (`force` : « Fermer quand même », `stay` : « Attendre » ou « Rester »).
  window.__askLeave = reason => {
    window.__leave = null;
    ask({ ...leaveQuestion({ t: i18n.t, app: 'Publipostage+', fault: reason === null ? null : new Error(reason) }), container: stage, inertTargets: () => [explorer.root] })
      .then(answer => { window.__leave = answer ? 'force' : 'stay'; });
  };
  // La question d'activation du partage (js/rights/rights-actions.js, test/activation-firefox.mjs) : la plus longue, avec la fermeture de la structure, trois tables d'apps, le rangement et la première règle ;
  // `window.__sharing` garde la réponse de la personne (`yes` : « Activer le partage », `no` : « Annuler »).
  window.__askSharing = () => {
    window.__sharing = null;
    const plan = { ok: true, closes: true, firstRule: true, filing: true, extends: false, appTables: ['Publipostage_Modeles', 'FormPlus_Formulaires', 'Automation_Fichiers'] };
    ask({ ...askOptions(i18n.t, 'sharing', plan), container: stage, inertTargets: () => [explorer.root] }).then(answer => { window.__sharing = answer ? 'yes' : 'no'; });
  };
  // La fenêtre de mise à jour des noms (js/ui/names-window.js, test/noms-gfs-firefox.mjs) : la vraie fenêtre sur ce que `prepare` du kit rendrait (neuf tables, de longs noms) ; `kind` : 'fait' (le lot réussit après
  // un temps), 'refus' (Grist refuse : « Réessayer » et « Continuer sans mettre à jour »). `window.__names` garde l'état final dit à GFS (`done`, `skipped`).
  window.__namesWindow = kind => {
    window.__names = null;
    const pairs = [['GFS_Rangement', 'GFS_Filing'], ['GFS_Groupes', 'GFS_Groups'], ['GFS_Espaces', 'GFS_Spaces'], ['GFS_Placement', 'GFS_Placement'], ['GFS_Partages', 'GFS_Shares'],
      ['GFS_Corbeille', 'GFS_Trash'], ['GFS_Annuaires', 'GFS_Directories'], ['GFS_Notifications', 'GFS_Notifications'], ['GFS_Fichiers', 'GFS_Files']];
    const prepared = { state: 'ready', summary: { tables: pairs, columns: 74 } };
    const run = async () => {
      await new Promise(resolve => setTimeout(resolve, 400));
      return kind === 'refus' ? { state: 'refused', detail: 'Blocked by table structure access rules' } : { state: 'done', tables: 9, rows: null, mismatch: [] };
    };
    const t = createKitI18n({ strings: NAMES_STRINGS, language }).t;
    showNamesWindow({ container: stage, inertTargets: () => [explorer.root], t, appName: 'GFS', prepared, run }).then(answer => { window.__names = answer.state; });
  };
  // La fenêtre « Partager » (js/sharing/share-window.js, test/partager-firefox.mjs) : la vraie fenêtre sur un état que le contrôleur aurait lu ; `kind` : 'inactif' (le partage n'est pas activé, une personne propriétaire),
  // 'actif' (propriétaire : des lignes de personnes à l'adresse très longue, de catégories, une fin d'accès, un accès échu), 'lecture' (une personne qui ne peut rien changer). `window.__shareActs` note ce que la
  // fenêtre demande d'écrire.
  const LONG_MAIL = 'camille.dupont-martin.service-comptabilite-generale@exemple-tres-long-domaine.example.fr';
  const share = (id, who, right, extra = {}) => ({ id, who, right, download: false, end: null, valid: true, active: true, inherited: false, ...extra });
  const shareStates = {
    inactif: { active: false, owner: true, shares: [], people: [], me: '', author: '', canManage: false },
    upgrade: { active: false, extend: 'upgrade', owner: true, shares: [], people: [], me: '', author: '', canManage: false },
    etendre: { active: false, extend: true, owner: true, shares: [], people: [], me: '', author: '', canManage: false },
    actif: { active: true, owner: true, me: 'essai@example.com', author: LONG_MAIL, canManage: true, people: ['ami@example.com', 'ancien@example.com', 'collegue@example.com', LONG_MAIL, 'essai@example.com'],
      groups: [{ name: 'Achats', count: 3 }, { name: 'Comptabilité fournisseurs de la région Nord-Est', count: 12 }],
      shares: [share(1, '@tous', 'lecture', { download: true }), share(2, LONG_MAIL, 'ecriture', { end: 1893456000 }), share(3, 'ami@example.com', 'lecture', { end: 1577836800, active: false }), share(4, 'ancien@example.com', 'lecture', { valid: false })] },
    lecture: { active: true, owner: false, me: 'viewer@example.com', author: 'essai@example.com', canManage: false, people: [], shares: [share(1, 'viewer@example.com', 'lecture')] },
  };
  // La fenêtre « Gérer les partages » (js/sharing/manage-window.js, test/partager-firefox.mjs) sur un état que le contrôleur aurait lu ; `window.__manageActs` note ce que la fenêtre demande d'écrire.
  const manageState = {
    owner: true, active: true, rows: [], tables: [{ id: 'Contacts', emails: ['Mail'], groups: ['Equipe'] }], mail: [{ id: 'Contacts', emails: ['Mail'] }], root: { '@editeurs': { id: 1, right: 'lecture' }, '@tous': null },
    groups: [{ id: 1, name: 'Achats', count: 3, source: '', here: 'a@example.com\nb@example.com' }, { id: 2, name: 'Comptabilité fournisseurs de la région Nord-Est', count: 1, source: 'Contacts_de_toute_la_societe_internationale', here: '' }],
    structure: { kind: 'close', label: 'rights.act.close', hint: 'rights.act.close.hint' },
    spaces: [{ id: 1, key: 'achats', name: 'Achats', people: 3, groups: [{ id: 1, group: 'Achats', right: 'lecture' }] }, { id: 2, key: 'long', name: 'Espace de la comptabilité fournisseurs de la région Nord-Est', people: 12, groups: [] }],
  };
  // Le vrai choix du groupe d'un espace (js/sharing/manage-control.js `pickGroup` : la liste et son « Créer le groupe … »), seul : le reste du contrôleur parle à Grist.
  const picker = new ManageControl({ t: i18n.t, container: stage, inertTargets: () => [explorer.root] });
  window.__manage = () => {
    window.__manageActs = [];
    window.__removed = [];
    const record = act => { window.__manageActs.push(act); return Promise.resolve({ ok: true }); };
    return openManage({ container: stage, t: i18n.t, inertTargets: () => [explorer.root], load: async () => JSON.parse(JSON.stringify(manageState)),
      onAddGroup: (state, group) => record(['addGroup', group.name, group.people]), onUpdateGroup: (id, people) => record(['updateGroup', id, people]), onRemoveGroup: id => record(['removeGroup', id]),
      onReadTable: async () => { window.__manageActs.push(['readTable']); return null; },
      onSuggest: async (state, typed) => { window.__manageActs.push(['suggest', typed]); return 'lea@example.com'; },
      onColumn: async () => { window.__manageActs.push(['column']); return { ok: true, label: i18n.t('manage.suggest.chosen', { table: 'Contacts', column: 'Mail', n: 12 }) }; }, onRoot: (state, who, right) => record(['root', who, right]), onStructure: async () => { window.__manageActs.push(['structure']); return true; }, onConfirmRemove: async name => { window.__manageActs.push(['confirmRemove', name]); return true; },
      onAddSpace: async () => { window.__manageActs.push(['addSpace']); return null; }, onRemoveSpace: async (state, space) => { window.__manageActs.push(['removeSpace', space.key]); return null; },
      onSpaceGroup: (state, space, group, right) => record(['spaceGroup', space.key, group, right]),
      onPickGroup: (state, space) => picker.pickGroup(window.__noGroups ? { ...state, groups: [] } : state, window.__noGroups ? { ...space, groups: [] } : space), onNewSpaceGroup: (state, space, group) => record(['newSpaceGroup', space.key, group.name, group.people]),
      onLinks: async () => linksNow(),
      onNewLink: async () => { window.__manageActs.push(['newLink']); await window.__sendOther('lien'); },
      onStopLink: async link => { window.__manageActs.push([link.state === 'pending' ? 'cancelLink' : 'stopLink', link.id]); window.__removed.push(link.id); return { ok: true }; } });
  };
  // La fenêtre « Envoyer à un autre document » (js/sharing/share-other-window.js, test/partager-autre-firefox.mjs) : la vraie fenêtre, sur un parcours dont les réponses sont des doublures (le moteur de partage et Grist se
  // mesurent dans un vrai Grist : labo/run-partager-autre.mjs ; ici, la mise en page et les gestes). `kind` : 'ok' (le document qui répond est dans un dossier, son nom très long), 'perso' (dans l'espace personnel), 'lien' (relier deux documents sans fichier : « Gérer les partages > Autres documents > Relier un document… »), 'lien-neuf' (idem dans un document sans aucun PDF : la table des fichiers naît au « Continuer »),
  // 'refus' (préparer échoue), 'bloque' (l'envoi ne peut pas finir). `window.__sendActs` note ce que le parcours a reçu ; `window.__sendGo()` laisse l'envoi finir.
  const LONG_DOC = 'Essai de réception du service de la comptabilité fournisseurs de la région Nord-Est';
  window.__sendOther = kind => {
    const acts = window.__sendActs = [];
    const gate = new Promise(resolve => { window.__sendGo = resolve; });
    const flow = {
      prepare: async () => { acts.push(['prepare']); if (kind === 'refus') throw new Error('Grist a refusé la création'); return { code: `GRISTSYNC2.${'eyJraW5kIjoiaW52aXRhdGlvbiJ9'.repeat(30)}`, expire: Date.now() / 1000 + 7 * 86400 }; },
      check: async text => {
        acts.push(['check', text]);
        if (!text.startsWith('GRISTSYNC2.')) throw new Error('Ce texte n’est pas un code de synchro.');
        return { name: LONG_DOC, folder: 'Comptabilité fournisseurs de la région Nord-Est', team: 'Grande équipe', personal: kind === 'perso', control: 'N5H-2AH' };
      },
      send: async (progress, opts) => { acts.push(['send', mode, Boolean(opts && opts.compared)]); await gate; if (kind === 'bloque') throw Object.assign(new Error('blocked'), { share: 'blocked' }); return { document: LONG_DOC, live: mode === 'live' }; },
      abort: async () => { acts.push(['abort']); },
    };
    let mode = 'once';
    return openShareOther({ container: stage, t: i18n.t, inertTargets: () => [explorer.root], file: kind === 'lien' || kind === 'lien-neuf' ? null : { id: 'abc', name: 'Facture de la session de formation de septembre.pdf' }, filesTable: kind !== 'lien-neuf', createFlow: (chosen, strict) => { mode = chosen; acts.push(['mode', chosen, Boolean(strict)]); return flow; }, errorText: error => String(error.message), notice: text => acts.push(['notice', text]) });
  };
  // La fenêtre « Recevoir d'un autre document Grist » (js/sharing/share-receive-window.js, test/partager-recevoir-firefox.mjs) : la vraie fenêtre, sur un parcours dont les réponses sont des doublures (le moteur et Grist se mesurent
  // dans un vrai Grist : labo/run-partager-recevoir.mjs). `kind` : 'ok' (un premier partage : GFS_Received), 'second' (la table libre suivante : GFS_Received_2), 'connu' (une réception qui reprend), 'reprise' (Grist a rechargé la page pendant que la fenêtre attendait le lien du formulaire : la fenêtre s'ouvre directement sur ce lien), 'serveur' (le code vient d'un autre serveur Grist : refusé dès la lecture), 'refus' (accepter échoue).
  // `window.__receiveActs` note ce que le parcours a reçu.
  const SERVER_OTHER = 'grist-de-la-direction-des-systemes-d-information.exemple.gouv.fr'; // le même nom dans test/partager-recevoir-firefox.mjs
  window.__receive = kind => {
    const acts = window.__receiveActs = [];
    const table = kind === 'second' ? 'GFS_Received_2' : 'GFS_Received';
    let replied = false;
    const flow = {
      read: async text => {
        acts.push(['read', text]);
        if (!text.startsWith('GRISTSYNC2.')) throw new Error('Ce texte n’est pas un code de synchro.');
        if (kind === 'serveur') throw Object.assign(new Error('server'), { share: 'server', vars: { server: SERVER_OTHER } });
        return { name: LONG_DOC, tables: 1, expire: Date.now() / 1000 + 7 * 86400, known: kind === 'connu', table };
      },
      accept: async () => { acts.push(['accept']); if (kind === 'refus') throw new Error('Grist a refusé la création'); return { journal: `GFS_Journal_${LONG_DOC.replace(/ /g, '_')}`, relinked: kind === 'connu', table }; },
      reply: async link => {
        acts.push(['reply', link]);
        if (!link.includes('/forms/')) throw new Error('Ce lien n’écrit pas dans le journal de cette réception.');
        replied = true;
        return { code: `GRISTSYNC2.${'eyJraW5kIjoicmVwb25zZSJ9'.repeat(30)}`, control: 'N5H-2AH' };
      },
      abort: async () => { acts.push(['abort', replied]); },
      journal: `GFS_Journal_${LONG_DOC.replace(/ /g, '_')}`,
      table,
    };
    return openShareReceive({ container: stage, t: i18n.t, inertTargets: () => [explorer.root], createFlow: () => flow, errorText: error => String(error.message), notice: text => acts.push(['notice', text]),
      resumed: kind === 'reprise' ? { name: LONG_DOC } : undefined });
  };
  // L'onglet « Dans un autre document Grist » de « Partager » (js/sharing/share-other-tab.js) sur des liens que le contrôleur aurait lus : `window.__shareOther = true` le branche ; `window.__links` donne les liens ('actifs'
  // par défaut : un document à jour, un en attente de réponse, un bloqué ; 'aucun', 'illisible') ; `window.__shareActs` note les niveaux demandés (`window.__levelHold` : l'écriture d'un niveau attend `window.__levelRelease()`, comme sur un serveur lointain). « Relier un nouveau document… » ouvre la fenêtre d'envoi (`__sendOther`).
  const LINK_DOC = 'Comptabilité fournisseurs de la région Nord-Est';
  const LINKS = {
    actifs: [{ id: 'e1', name: 'Compta', files: ['abc', 'x', 'y'], state: 'active', doc: { name: LINK_DOC, id: 'd1' } }, { id: 'e2', name: 'Direction', files: [], state: 'pending', doc: { name: '', id: '' } }, { id: 'e3', name: 'Archives', files: ['x'], state: 'blocked', doc: { name: 'Archives', id: 'd3' } }],
    aucun: [],
    // Un DOSSIER (js/share-folder.js : `fileId` est la liste de ses fichiers) : un document qui les a tous (à jour), un qui n'en a qu'une partie, un qui attend sa réponse.
    dossier: [{ id: 'e1', name: 'Compta', files: ['f1', 'f2', 'f3', 'x'], state: 'active', doc: { name: LINK_DOC, id: 'd1' } }, { id: 'e2', name: 'Direction', files: ['f1'], state: 'active', doc: { name: 'Direction', id: 'd2' } }, { id: 'e3', name: 'Archives', files: [], state: 'pending', doc: { name: '', id: '' } }],
  };
  const linksNow = () => { if (window.__links === 'illisible') throw new Error('illisible'); return JSON.parse(JSON.stringify(LINKS[window.__links || 'actifs'])).filter(each => !(window.__removed || []).includes(each.id)); };
  // `folder` : le dossier que « Partager » a reçu (`window.__folderCount` PDF de GFS qui partent, 3 par défaut, `window.__folderTooBig` PDF de plus de 25 Mo qui ne partent pas, et `window.__folderSkipped` fichiers d'une app qui ne partent pas, 2 par défaut).
  const folderTab = (state, folder) => {
    const count = window.__folderCount === undefined ? 3 : window.__folderCount;
    const ids = ['f1', 'f2', 'f3', 'f4', 'f5'].slice(0, count);
    const tooBig = window.__folderTooBig || 0;
    return {
      why: whyNot(i18n.t, { file: folder, state, files: ids, tooBig }), fileId: ids, folder: true, count, skipped: window.__folderSkipped === undefined ? 2 : window.__folderSkipped, tooBig, limit: null,
      loadLinks: async () => linksNow(),
      onLevel: async (link, level) => { window.__shareActs.push(['level', link.id, level, 'dossier']); return { ok: true, note: level === 'once' ? i18n.t('so.once.going', { name: folder.name }) : undefined }; },
      onNew: async () => { window.__shareActs.push(['new']); await window.__sendOther(window.__shareSend || 'ok'); },
    };
  };
  // `window.__fileMb` : le fichier pèse autant de Mo (au-delà de 25, le partage le dit avant l'envoi : js/sharing/share-other.js, `limitOf`).
  const oneFile = () => ({ id: 'abc', name: 'Facture.pdf', app: 'gfs-fichiers', pieces: window.__fileMb ? [['9', window.__fileMb * 1024 * 1024]] : [] });
  const otherTab = (state, folder) => folder ? folderTab(state, folder) : ({
    why: whyNot(i18n.t, { file: oneFile(), state }), limit: limitOf(i18n.t, language, oneFile()), fileId: 'abc',
    loadLinks: async () => linksNow(),
    onLevel: async (link, level) => {
      window.__shareActs.push(['level', link.id, level]);
      if (window.__levelHold) await new Promise(resolve => { window.__levelRelease = resolve; }); // un serveur lointain : le niveau s'écrit en plusieurs secondes
      return { ok: true, note: level === 'once' ? i18n.t('so.once.going', { name: 'Facture.pdf' }) : undefined };
    },
    onNew: async () => { window.__shareActs.push(['new']); await window.__sendOther(window.__shareSend || 'ok'); },
  });
  // `folder` : l'objet d'un dossier (`mine` : un dossier de « Moi », sans droits à donner ici : la fenêtre s'ouvre sur l'onglet « Dans un autre document Grist »).
  window.__share = (kind, folder) => {
    window.__shareActs = [];
    window.__removed = [];
    const record = act => { window.__shareActs.push(act); return Promise.resolve({ ok: true }); };
    const dir = folder && typeof folder.path === 'string' ? folder : null;
    const space = folder && folder.wholeSpace ? folder : null;
    const file = space ? { key: space.key, name: space.name, app: i18n.t('share.space.kind') } : dir ? { key: dir.key, name: dir.name, app: dir.mine ? i18n.t('share.folder.inMine', { name: i18n.t('ex.me') }) : i18n.t('share.folder.in', { name: 'Achats' }) } : { key: 'gfs-fichiers:abc', name: 'Facture de la session de formation de septembre.pdf', app: 'GFS' };
    return openShare({ container: stage, t: i18n.t, locale: language === 'en' ? 'en-GB' : 'fr-FR', inertTargets: () => [explorer.root], other: window.__shareOther ? state => otherTab(state, dir) : null, file, startTab: 'here',
      load: async () => (dir && dir.mine ? { ...shareStates.actif, folder: true, author: '', shares: [share(1, 'marc@example.com', 'lecture')] } : shareStates[kind]), onAdd: row => record(['add', row.Person, row.Right]), onChange: (id, patch) => record(['change', id, patch.Right]), onRemove: id => record(['remove', id]), onActivate: async () => { window.__shareActs.push(['activate']); return false; }, onManage: kind === 'actif' ? () => window.__manage() : null });
  };
  // La fenêtre « Poids du document » (js/weight/weight-window.js, test/poids-fenetre-firefox.mjs) : la vraie fenêtre et le vrai lecteur (js/weight/weight-reader.js) sur une doublure de `Transfer.sql`. `window.__weightKind` choisit ce
  // que le serveur répond : 'ok' (un document de dix-huit tables dont une au nom très long et une trop longue à lire), 'refuse' (pas le droit de tout copier : 403), 'muet' (le serveur ne répond pas).
  // `window.__weightEstimate` garde ce que le total a donné à l'ouverture.
  const LONG = 'Publipostage_Modeles_Attestations_De_Formation_Fin_De_Session';
  const TABLE_BYTES = { [LONG]: 9437184, Clients: 2621440, Inscrits: 524288, Factures: 1310720, Stock: 40960, Notes: 4096 };
  const BIG = Array.from({ length: 12 }, (unused, i) => `Table_${String(i + 1).padStart(2, '0')}`);
  const fakeSql = kind => async statement => {
    await new Promise(resolve => setTimeout(resolve, 20));
    if (kind === 'refuse') throw new TransferError('http', 'Insufficient access', 403);
    if (kind === 'muet') throw new TransferError('network', 'NetworkError when attempting to fetch resource.');
    if (statement === SQL.file) return [{ octets: 67108864 }];
    if (statement === SQL.history) return [{ octets: 18874368 }];
    if (statement === SQL.stored) return [{ octets: 9437184 }];
    if (statement === SQL.counted) return [{ octets: 7340032 }];
    if (statement === SQL.tables) return [...Object.keys(TABLE_BYTES), ...BIG].map(tableId => ({ tableId }));
    const name = /name = '(\w+)'$/.exec(statement)[1];
    if (name === 'Table_03') throw new TransferError('http', 'a slow statement resulted in a database interrupt', 400);
    return [{ octets: TABLE_BYTES[name] || 8192 * (BIG.indexOf(name) + 1) }];
  };
  window.__weightKind = 'ok';
  // Le bandeau d'erreur du poids du document (js/weight/weight-alert.js, test/poids-alerte-firefox.mjs) : `window.__alert(octets)` le montre avec ce poids, `window.__alert(null)` le retire.
  window.__alert = bytes => { window.__alertBytes = bytes; explorer.repaint(); };
  window.__weight = estimate => {
    window.__weightEstimate = estimate;
    return openWeight({ container: stage, t: i18n.t, locale, inertTargets: () => [explorer.root], estimate, load: (update, cancelled) => readWeight(fakeSql(window.__weightKind), update, cancelled) });
  };
  // La fenêtre « Dépendances » (js/apps/dependencies-window.js, test/dependances-firefox.mjs) : la vraie fenêtre, le vrai catalogue et le vrai relevé de GFS (servis par la page d'essai), le vrai audit des copies
  // (les fichiers de vendor/, relus par la page) et les vraies apps : le vrai manifeste de Publipostage+ et le vrai `AppsState`, dont la table du document est une mémoire (`window.__dependencyMemory`). Publipostage+ est
  // installé, ses extensions « Graphique » et « Lecture de PDF » cochées : les lignes d'Écriture en direct, d'ExcelJS… restent « au catalogue ». `window.__tamper` (un bout de chemin) change les octets que la page lit
  // pour ce fichier : l'audit doit alors dire que la copie ne correspond pas. `window.__dependencyBlocked` (un texte) rend les choix impossibles ; `window.__saved` garde les rapports que la page aurait offerts.
  const docTable = { value: { publipostage: { extensions: ['graphique', 'lecture-pdf'] } }, writes: [] };
  const appsState = new AppsState({ onChange: () => {}, store: { read: async () => ({ raw: structuredClone(docTable.value) }),
    update: async mutate => { docTable.value = mutate(structuredClone(docTable.value)); docTable.writes.push(structuredClone(docTable.value)); return structuredClone(docTable.value); } } });
  window.__dependencyMemory = docTable;
  window.__saved = [];
  window.__dependencyBlocked = null;
  const dependencyData = Promise.all(['/bibliotheques/catalogue.json', '/bibliotheques/releve.json', '/manifestes/publipostage.json', '/bibliotheques/securite.json'].map(path => fetch(path).then(response => response.json()))).then(
    async ([catalogueJson, releve, manifest, securite]) => {
      const catalogue = readCatalogue(catalogueJson);
      appsState.setApps([{ app: { id: 'publipostage' }, manifest, ok: true, errors: [] }]);
      appsState.setCatalogue(catalogue);
      await appsState.load();
      return { catalogue, releve, securite };
    });
  window.__dependencyModules = () => dependencyData.then(() => appsState.model());
  // Ce que les apps déclarent charger elles-mêmes (« Portées par l'app », js/apps/dependencies-carried.js, test/dependances-carried-firefox.mjs) : sans `window.__carried`, aucune app ne déclare rien
  // (les mesures de la fenêtre sans cette partie) ; avec, le vrai manifeste de Publipostage+ déclare les siennes, Automation+ (installée) déclare n'en charger aucune, Form+ (pas installée) déclare Leaflet.
  const carriedModel = () => {
    const model = appsState.model();
    const app = (id, nom, installed, portees) => ({ kind: 'app', id, ok: true, installed, natives: [], manifest: { nom: { fr: nom, en: nom }, portees } });
    const items = model.items.map(item => (item.kind === 'app' ? { ...item, manifest: { ...item.manifest, portees: window.__carried ? item.manifest.portees : undefined } } : item));
    return window.__carried ? { ...model, items: [...items, app('automation', 'Automation+', true, []),
      app('form', 'Form+', false, [{ id: 'leaflet', nom: 'Leaflet', version: '1.9.4', adresse: 'https://unpkg.com/', quand: 'option', paquet: 'leaflet' }])] } : { ...model, items };
  };
  window.__dependencies = async () => {
    const { catalogue, releve, securite } = await dependencyData;
    // `window.__relay` : ce que le relais des appels bloqués a vu ({ relays, alerts }, js/broker/security-relay.js). `window.__security` : le contrôle de sécurité (bibliotheques/securite.json, vue « Sécurité » et textes « Ce que GFS en a retrouvé ») ; `window.__securityReport` le remplace par un fichier de la page de mesure.
    const report = window.__security ? (window.__securityReport || securite) : null;
    const readBytes = async address => (window.__tamper && address.includes(window.__tamper) ? new Uint8Array([1, 2, 3]).buffer : (await fetch(address)).arrayBuffer());
    return openDependencies({ container: stage, t: i18n.t, locale, lang: language, inertTargets: () => [explorer.root], surveyed: releve.releve,
      rows: () => dependencyRows({ catalogue, releve, modules: appsState.model(), lang: language }), units: () => allUnits(appsState.model(), language),
      carried: rows => carriedOf({ modules: carriedModel(), lang: language, rows }),
      security: report ? () => securityOf({ report, modules: carriedModel(), lang: language, relay: window.__relay || null }) : undefined, checkCarried: report ? entry => carriedCheck(report, entry) : undefined,
      verify: row => Promise.all(row.files.map(file => verifyCopy(file, { readBytes, base: location.href }))), blocked: () => window.__dependencyBlocked,
      apply: (plan, mode) => Promise.all(plan.map(({ app, extensions, natives }) => appsState.setSources(app, { extensions, natives }, mode))),
      ask: opts => ask({ ...opts, container: stage, inertTargets: () => [explorer.root] }), now: () => new Date('2026-11-18T10:30:00Z'), uuid: () => newSerial(),
      save: (name, text) => { window.__saved.push({ name, text }); } });
  };
  show();
  explorer.open();
}

window.__ready = mount().then(() => true);
