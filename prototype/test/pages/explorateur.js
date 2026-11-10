// La page d'essai de l'interface sous Firefox (test/interfaces-firefox.test.mjs) : le vrai explorateur (js/explorer.js) et son vrai menu « Réglages » (js/settings-menu.js, avec la vraie fenêtre « À propos »), la vraie fenêtre « Thème » (js/theme-window.js) et la vraie fenêtre « Ce nom est
// déjà pris » (js/conflict-window.js), sur des fichiers que le vrai modèle (js/explorer-model.js) lit dans des tables de la forme de celles de Grist, avec les feuilles de style et la carte d'importation de
// index.html (le test les recopie de la page, dans l'ordre). Aucun Grist : ce que l'essai mesure est la mise en page et la souris. La langue vient de `?lang=fr|en` ; `window.__opened` garde le nom du
// dernier fichier que l'explorateur a ouvert ; `window.__askConflict({ app, repeat })` ouvre la fenêtre du nom pris et `window.__conflict` garde la réponse de la personne quand elle se ferme.
// La corbeille et le clavier (test/corbeille-firefox.mjs) : le vrai `Trash` (js/trash.js) et la vraie fenêtre d'accord (js/ask-window.js) sur un gardien de doublure qui déplace les fichiers entre deux
// listes ; `window.__filing` note ce que l'explorateur demande au rangement (renommer, déplacer, épingler), `window.__notices` les phrases qu'il dit, `window.__explorer` est l'explorateur, et
// `window.__reset()` remet les fichiers, la vue et la recherche comme au départ ; `window.__language` et `window.__place` gardent le dernier choix du menu « Réglages » (la langue, le bord de la barre : la ligne de la barre est ici une doublure,
// celle du vrai Dock se mesure dans le labo) et `window.__resetSettings()` les remet au départ. L'ambiance (décision du 03/11) et l'accessibilité renforcée (04/11) : `window.__theme` est le réglage du thème (`choose`, `chooseAccess`), et la page prend
// ce qu'il dit comme celle de GFS. La copie et le presse-papiers (test/copier-firefox.mjs) : le vrai `Copying` (js/copying.js) sur un gardien de doublure qui
// ajoute une copie à la liste (premier nom libre), et un rangement de doublure qui déplace vraiment les fichiers et les dossiers ; `window.__copies` note [identifiant, dossier] de chaque copie rangée.
// Les icônes des types (test/icones-firefox.mjs) : l'ambiance se pose comme dans GFS, par le vrai `ThemeSetting` et le vrai `ThemeHost` (`window.__ambiance(id)`, le mode vient de `data-grist-appearance`), et
// `window.__withPdf()` ajoute à la liste un PDF gardé par GFS, lu par le vrai modèle avec le vrai manifeste de GFS (la famille « pdf », rouge) ; `window.__reset()` le retire et rend l'ambiance d'origine.
// Les dossiers sans fichier (test/dossiers-firefox.mjs) : le vrai `Filing` (js/filing.js) et les vraies fenêtres du rangement (js/filing-window.js) sur un rangement de doublure qui tient les dossiers gardés
// (`window.__keep(...chemins)` en pose, `window.__filing` note chaque lot « setFiling:+gardé:-retiré »), et la corbeille y garde le dossier du dernier fichier qui part, comme le contrôleur.
// Un fichier que seule l'app ouverte sait fermer ou copier (test/composite-firefox.mjs) : la « Grille de suivi » en fait office ; `window.__appOpen = false` : l'app n'est pas ouverte, le geste est grisé et dit
// d'ouvrir l'app ; ouverte, l'app ajoute sa phrase (`window.__appSaid`) à celle de GFS.
// La case « + pièces jointes » : la table `_grist_Attachments` que l'explorateur lirait dans Grist est une doublure, de la forme que `fetchTable` la rend (voir `ATTACHMENTS`) ; `window.__attachments` compte ses lectures
// et `window.__attachmentsFail = 'texte'` les fait échouer. Ce que Grist rend vraiment se mesure dans un vrai Grist (labo/run-poids.mjs).
// Ctrl+Z (test/annuler-firefox.mjs) : l'explorateur prend la pile d'annulation du vrai `Filing` (`filing.undoStack`) ; la corbeille et la copie y déposent leur geste, `window.__reset()` la vide.
import { ask } from '/js/ask-window.js';
import { askConflict } from '/js/conflict-window.js';
import { Explorer } from '/js/explorer.js';
import { OpenedFiles } from '/js/opened-files.js';
import { Filing } from '/js/filing.js';
import { askName, chooseFolder } from '/js/filing-window.js';
import { applyFiling, folderMoves, inside, normalizePath, readFiles, readFiling } from '/js/explorer-model.js';
import { Copying } from '/js/copying.js';
import { applyPlacement, readSpaces } from '/js/spaces-filing.js';
import { FILES_MANIFEST, FILES_COLUMN_IDS } from '/js/gfs-files.js';
import { ReceivedControl } from '/js/received-control.js';
import { loadReceived, answerFile } from '/js/received-files.js';
import { fakeGrist } from '/test/fake-grist.mjs';
import { createI18n } from '/js/i18n.js';
import { installSprite } from '/js/icons.js';
import { leaveQuestion } from '/js/leave.js';
import { ThemeHost } from '/js/theme-apply.js';
import { settingsItems } from '/js/settings-menu.js';
import { aboutItems } from '/js/about.js';
import { ThemeSetting } from '/js/theme.js';
import { ThemeWindow } from '/js/theme-window.js';
import { Trash } from '/js/trash.js';
import { openRights } from '/js/rights-window.js';
import { openShare } from '/js/share-window.js';
import { openManage } from '/js/manage-window.js';
import { whyNot } from '/js/share-other.js';
import { openShareOther } from '/js/share-other-window.js';
import { openShareReceive } from '/js/share-receive-window.js';
import { openWeight } from '/js/weight-window.js';
import { ModulesWindow } from '/js/modules-window.js';
import { WorkWindow } from '/js/work-window.js';
import { SQL, readWeight } from '/js/weight-reader.js';
import { TransferError } from '/js/transfer.js';

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
  const show = () => explorer.setFiles(live, trashed, kept, arrivals);
  const folders = new Map(files.map(file => [file.key, file.folder])); // où chaque fichier est au départ : couper puis coller en déplace, `__reset` les remet
  const pick = (list, wanted) => list.findIndex(file => file.key === wanted.key);
  const move = (from, to, wanted) => { const at = pick(from, wanted); if (at < 0) return null; const [file] = from.splice(at, 1); to.push(file); return file; };
  window.__filing = [];
  window.__notices = [];
  window.__attachments = 0;
  window.__attachmentsFail = '';
  const noted = (name, ...args) => async file => { window.__filing.push([name, ...args.map(arg => (arg === 'name' ? file.name : file))]); };
  // Un fichier que seule l'app ouverte sait fermer ou copier (contrats 2.4 `appel`, test/composite-firefox.mjs) : les fichiers de type `grille` en font office ; `window.__appOpen = false` : l'app n'est pas ouverte, le geste
  // attend (les phrases de js/i18n-trash.js, comme dans js/app-files.js) ; ouverte, l'app ajoute sa phrase (`window.__appSaid`) à celle de GFS.
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
  // Le rangement de doublure d'un fichier ou d'un dossier collé après Ctrl+X : il déplace vraiment, et rend ce que rend js/filing.js.
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
  // Les dossiers sans fichier : le vrai `Filing` sur un rangement de doublure qui range les fichiers et tient les dossiers gardés, comme `GFS_Rangement` (un lot noté « setFiling:+gardé:-retiré »).
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
  // Un espace « Achats » (les espaces partagés, lot 4b) : le premier modèle est rangé dans son dossier Contrats, qui a un sous-dossier vide ; « Espaces » est une racine à côté de « Moi ».
  window.__spaces = () => {
    const info = readSpaces({ id: [1], Cle: ['achats'], Nom: ['Achats'] }, { id: [1, 2], Cible: [live[0].key, ''], Espace: ['achats', 'achats'], Dossier: ['Contrats', 'Contrats/Sous'] });
    applyPlacement(live, info);
    kept = [...new Set([...kept, ...info.folders])];
    show();
  };
  window.__keep = (...paths) => { kept = [...new Set([...kept, ...paths])]; show(); };
  // Le menu « Réglages » : la langue et le bord de la barre que la personne a choisis en dernier (la ligne de la barre est une doublure : le vrai Dock se mesure dans le labo), et la vraie fenêtre « À propos ».
  const EDGES = [['gauche', 'dock-left'], ['haut', 'dock-top'], ['droite', 'dock-right'], ['bas', 'dock-bottom']];
  window.__resetSettings = () => { window.__language = language; window.__place = 'gauche'; };
  window.__resetSettings();
  const place = () => ({
    label: i18n.t('dock.place'), icon: 'dock-left', submenu: EDGES.map(([edge, glyph]) => ({ label: i18n.t(`dock.${edge}`), icon: glyph, check: window.__place === edge, run: () => { window.__place = edge; } })),
  });
  window.__about = () => void ask({ title: i18n.t('about.title'), message: i18n.t('about.text'), items: aboutItems(i18n.t), confirmLabel: i18n.t('about.close'), container: stage, inertTargets: () => [explorer.root] });
  // « Apps et extensions » et « Table de travail » (js/modules-window.js, js/work-window.js ; test/voile-firefox.mjs) : des fenêtres à part de la base commune, dont le fond ne ferme rien non plus.
  window.__modulesWindow = () => void new ModulesWindow({ container: stage, i18n, locale, model: () => ({ items: [], active: 0, total: 0 }), blocked: () => null, inertTargets: () => [explorer.root], on: {}, onClose: () => {} }).open();
  window.__workWindow = () => void new WorkWindow({ container: stage, i18n, inertTargets: () => [explorer.root], source: { pageTable: 'Inscrits', pageRow: null, current: null, tables: () => [{ id: 'Inscrits', locked: null }], rows: async () => [] }, onPick: () => {}, onClose: () => {} }).open();
  // « Partagés avec moi » (js/received-control.js, test/partager-recevoir-firefox.mjs) : le vrai contrôle, la vraie fenêtre « Accepter ? » et les vraies marques, écrites dans un faux Grist en mémoire (`window.__sharedTables`).
  // `window.__shared(kind)` y pose des arrivées et ouvre la vue ; `window.__sharedBlocked` : la phrase qui dit pourquoi rien ne s'écrit.
  const baseLabel = file => (file.typeInfo ? file.typeInfo.nom[language] || file.typeInfo.nom.fr : file.type);
  let sharedGrist = fakeGrist({});
  const readArrivals = async () => { arrivals = await loadReceived(sharedGrist.port, await sharedGrist.port.doc.listTables()); show(); };
  const received = new ReceivedControl({
    port: sharedGrist.port, t: i18n.t, locale: () => locale, container: stage, inertTargets: () => [explorer.root], typeLabel: baseLabel, notice: text => window.__notices.push(text), blocked: () => window.__sharedBlocked || null,
    refresh: readArrivals, open: file => { window.__opened = file.name; }, answerFile: (port, file, accepted) => answerFile(sharedGrist.port, file, accepted),
  });
  window.__sharedBlocked = '';
  // Un fichier arrive pendant que l'explorateur est ouvert : la ligne est posée dans le faux Grist, puis la liste des arrivées se remplace seule (`Explorer.setReceived`, comme le fait le contrôleur).
  window.__arrive = async name => {
    const rows = sharedGrist.tables.GFS_Recus.rows;
    const id = rows.length + 1;
    rows.push({ ...rows[0], id, Identifiant: `r${id}`, Nom: name, Accepte: false, Refuse: false, Contenu: ['L', id] });
    arrivals = await loadReceived(sharedGrist.port, await sharedGrist.port.doc.listTables());
    explorer.setReceived(arrivals);
  };
  window.__shared = async kind => {
    const day = Math.floor(Date.now() / 1000) - 86400;
    const row = (id, name, extra = {}) => ({ id, Identifiant: `r${id}`, Nom: name, Type: 'pdf', Date: day - id * 3600, Auteur: 'Comptabilité <compta@exemple.fr>', Contenu: ['L', id], Taille: 1500 * id, Origine: 'import', Supprimee_a_la_source: false, ...extra });
    const rows = kind === 'vide' ? [] : [row(1, 'Facture de la session de formation de septembre 2026.pdf'), row(2, 'Devis.pdf'), row(3, 'Contrat.pdf', { Accepte: true, Refuse: false }), row(4, 'Ancien refus.pdf', { Accepte: false, Refuse: true }), row(5, 'Retiré.pdf', { Accepte: true, Refuse: false, Supprimee_a_la_source: true })];
    const columns = ['id', ...FILES_COLUMN_IDS, 'Supprimee_a_la_source', 'Accepte', 'Refuse'];
    sharedGrist = fakeGrist(kind === 'vide' ? {} : { GFS_Recus: { columns, rows } });
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
    typeLabel: file => (file.received ? received.typeLabel(file) : baseLabel(file)),
    lockOf: file => (file.received ? received.lockOf(file) : (file.type === 'macro' ? { text: i18n.t('ex.lockedExtension', { name: 'Macro-modèles' }) } : null)), newTypes: () => [], importTypes: () => [], canClose: () => true,
    notice: text => window.__notices.push(text), settings: () => settingsItems({ t: i18n.t, language: () => ({ choice: window.__language, grist: language }), onLanguage: value => { window.__language = value; }, onTheme: () => theme.open(), place, onAbout: () => window.__about() }),
    onOpen: file => { window.__opened = file.name; }, onNew: () => {},
    opened: { keys: () => openedFiles.keys(), shown: () => openedFiles.shown(SESSION), remove: key => openedFiles.remove(key) },
    onImport: () => {}, onClose: () => {}, onApps: () => {}, onRights: () => window.__rights(window.__rightsKind || 'protege'), sharing: { whyNot: () => null, whyNotFolder: path => (path.split('/').length > 2 && path.startsWith('Espaces/') ? null : i18n.t(path.startsWith('Espaces') ? 'share.folder.space' : 'share.folder.personal')), folderFile: path => ({ key: `dossier:${path}`, name: path.split('/').pop() }), open: () => window.__share(window.__shareKind || 'actif') }, onWeight: estimate => window.__weight(estimate), personal: () => true, kept: null, trash: bin, copying,
    attachments: async () => { window.__attachments += 1; if (window.__attachmentsFail) return { error: new Error(window.__attachmentsFail) }; return { data: attachmentsTable() }; },
    filing: { togglePin: noted('pin', 'name'), rename: noted('rename', 'name'), moveFile: noted('move', 'name'), renameFolder: async path => { window.__filing.push(['renameFolder', path]); }, moveFolder: async path => { window.__filing.push(['moveFolder', path]); }, ...moving,
      newFolder: () => filing.newFolder(), deleteFolder: path => filing.deleteFolder(path), undoStack: filing.undoStack },
  });
  window.__explorer = explorer;
  window.__open = names => { for (const name of names) openedFiles.add(live.find(file => file.name === name).key, SESSION); explorer.render(); };
  window.__reset = () => {
    explorer.close(); // la fermeture vide le presse-papiers : chaque mesure part de rien
    filing.undoStack.clear(); // et la pile de Ctrl+Z
    live = [...files];
    for (const file of live) { file.trashed = null; file.folder = folders.get(file.key); delete file.space; delete file.ownFolder; }
    trashed = [];
    kept = [];
    arrivals = [];
    window.__sharedBlocked = '';
    window.__filing.length = 0;
    window.__copies.length = 0;
    window.__notices.length = 0;
    window.__attachments = 0;
    window.__attachmentsFail = '';
    window.__opened = null;
    for (const key of openedFiles.keys()) openedFiles.remove(key);
    window.__appOpen = true;
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
  // Un PDF gardé par GFS, lu comme l'explorateur le lit : les colonnes de `GFS_Fichiers` et le manifeste de GFS. `__reset` remet `live` aux fichiers de départ : le PDF disparaît.
  window.__withPdf = () => {
    const [pdf] = readFiles(FILES_MANIFEST, FILES_MANIFEST.fichiers[0], { id: [900], Identifiant: ['essai-pdf'], Nom: ['Attestation.pdf'], Type: ['pdf'], Date: [Math.floor(Date.now() / 1000) - 3600], Auteur: ['Service RH'], Contenu: [['L', 900]], Taille: [640000] });
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
  // La question de « fermer » (contrats 5.4, point 3) quand l'app se tait ou répond par une erreur : la fenêtre d'accord et les vrais textes de js/leave.js, avec le plus long nom d'app ; `window.__leave` garde
  // la réponse de la personne (`force` : « Fermer quand même », `stay` : « Attendre » ou « Rester »).
  window.__askLeave = reason => {
    window.__leave = null;
    ask({ ...leaveQuestion({ t: i18n.t, app: 'Publipostage+', fault: reason === null ? null : new Error(reason) }), container: stage, inertTargets: () => [explorer.root] })
      .then(answer => { window.__leave = answer ? 'force' : 'stay'; });
  };
  // Le panneau « Permissions » (js/rights-window.js, test/droits-firefox.mjs) : la vraie fenêtre sur un état que le lecteur aurait rendu ; `kind` : 'pas' (rien posé, un lien public qui ouvre une table protégée),
  // 'protege' (Encadré partout, structure fermée, deux liens), 'autre' (des règles à la main), 'proprietaire-seul' (une personne qui n'est pas propriétaire). `window.__rightsKind` désigne celui que le mot du pied ouvre.
  const LONG = 'Publipostage_Modeles_Attestations_De_Formation_Fin_De_Session';
  const FRESH = { shared: { ok: true, firstRule: true }, 'remove-level': { ok: false, reason: 'none' }, close: { ok: true, firstRule: true }, open: { ok: false, reason: 'none' }, sharing: { ok: true, firstRule: true }, unsharing: { ok: false, reason: 'none' } };
  const DONE = { shared: { ok: false, reason: 'already' }, 'remove-level': { ok: true }, close: { ok: false, reason: 'already' }, open: { ok: true }, sharing: { ok: true, firstRule: true }, unsharing: { ok: false, reason: 'none' } };
  const BYHAND = { shared: { ok: false, reason: 'foreign' }, 'remove-level': { ok: false, reason: 'none' }, close: { ok: false, reason: 'already' }, open: { ok: false, reason: 'none' }, sharing: { ok: false, reason: 'foreign' }, unsharing: { ok: false, reason: 'none' } };
  const states = {
    pas: { rules: { readable: true, word: 'pas', closed: false, tables: [{ tableId: 'GFS_Rangement', level: 'ouvert' }, { tableId: LONG, level: 'ouvert' }] }, owner: true, plans: FRESH,
      links: { status: 'ok', links: [{ id: 1, published: true, pages: ['Inscription à la session de formation de septembre'], filled: [{ tableId: 'FormPlus_Pub_3', shown: ['Nom'], unshown: ['Statut', 'Note interne', 'Montant', 'Reçu le'], rows: 1204 }], readable: [{ tableId: 'Villes', colId: 'Nom' }], protectedOpen: ['FormPlus_Pub_3'] }] } },
    protege: { rules: { readable: true, word: 'protege', closed: true, tables: [{ tableId: 'GFS_Rangement', level: 'encadre' }, { tableId: LONG, level: 'encadre' }] }, owner: true, plans: DONE,
      links: { status: 'ok', links: [{ id: 1, published: true, pages: ['Inscription'], filled: [{ tableId: 'Inscrits', shown: ['Nom', 'Ville'], unshown: [], rows: 12 }], readable: [], protectedOpen: [] }, { id: 2, published: false, pages: [], filled: [], readable: [], protectedOpen: [] }] } },
    autre: { rules: { readable: true, word: 'autre', closed: false, tables: [{ tableId: 'GFS_Rangement', level: 'autre' }] }, owner: true, plans: BYHAND, links: { status: 'ok', links: [] } },
    'proprietaire-seul': { rules: { readable: false, reason: 'owner-only', tables: [], closed: false, word: null }, owner: false, links: { status: 'owner-only', links: [] } },
  };
  window.__rights = kind => {
    const state = states[kind];
    explorer.setRights(state.rules);
    window.__rightsActs = [];
    return openRights({ container: stage, t: i18n.t, inertTargets: () => [explorer.root], load: async () => state,
      act: async act => { window.__rightsActs.push(act); await ask({ title: act, message: act, confirmLabel: 'OK', cancelLabel: 'Annuler', safeFirst: true, container: stage, inertTargets: () => [explorer.root] }); } });
  };
  window.__rightsState = kind => explorer.setRights(states[kind].rules);
  // La fenêtre « Partager » (js/share-window.js, test/partager-firefox.mjs) : la vraie fenêtre sur un état que le contrôleur aurait lu ; `kind` : 'inactif' (le partage n'est pas activé, une personne propriétaire),
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
  // La fenêtre « Gérer les partages » (js/manage-window.js, test/partager-firefox.mjs) sur un état que le contrôleur aurait lu ; `window.__manageActs` note ce que la fenêtre demande d'écrire.
  const manageState = {
    owner: true, active: true, rows: [], tables: [{ id: 'Contacts', emails: ['Mail'], groups: ['Equipe'] }], root: { '@editeurs': { id: 1, right: 'lecture' }, '@tous': null },
    groups: [{ id: 1, name: 'Achats', count: 3, source: '', here: 'a@example.com\nb@example.com' }, { id: 2, name: 'Comptabilité fournisseurs de la région Nord-Est', count: 1, source: 'Contacts_de_toute_la_societe_internationale', here: '' }],
    structure: { kind: 'close', label: 'rights.act.close', hint: 'rights.act.close.hint' },
    spaces: [{ id: 1, key: 'achats', name: 'Achats', people: 3, groups: [{ id: 1, group: 'Achats', right: 'lecture' }] }, { id: 2, key: 'long', name: 'Espace de la comptabilité fournisseurs de la région Nord-Est', people: 12, groups: [] }],
  };
  window.__manage = () => {
    window.__manageActs = [];
    window.__removed = [];
    const record = act => { window.__manageActs.push(act); return Promise.resolve({ ok: true }); };
    return openManage({ container: stage, t: i18n.t, inertTargets: () => [explorer.root], load: async () => JSON.parse(JSON.stringify(manageState)),
      onAddGroup: (state, group) => record(['addGroup', group.name, group.people]), onUpdateGroup: (id, people) => record(['updateGroup', id, people]), onRemoveGroup: id => record(['removeGroup', id]),
      onReadTable: async () => { window.__manageActs.push(['readTable']); return null; }, onRoot: (state, who, right) => record(['root', who, right]), onStructure: async () => { window.__manageActs.push(['structure']); return true; }, onConfirmRemove: async name => { window.__manageActs.push(['confirmRemove', name]); return true; },
      onAddSpace: async () => { window.__manageActs.push(['addSpace']); return null; }, onRemoveSpace: async (state, space) => { window.__manageActs.push(['removeSpace', space.key]); return null; },
      onSpaceGroup: (state, space, group, right) => record(['spaceGroup', space.key, group, right]), onPickGroup: async () => null,
      onLinks: async () => linksNow(),
      onNewLink: async () => { window.__manageActs.push(['newLink']); await window.__sendOther('lien'); },
      onStopLink: async link => { window.__manageActs.push([link.state === 'pending' ? 'cancelLink' : 'stopLink', link.id]); window.__removed.push(link.id); return { ok: true }; } });
  };
  // La fenêtre « Envoyer à un autre document » (js/share-other-window.js, test/partager-autre-firefox.mjs) : la vraie fenêtre, sur un parcours dont les réponses sont des doublures (le moteur de partage et Grist se
  // mesurent dans un vrai Grist : labo/run-partager-autre.mjs ; ici, la mise en page et les gestes). `kind` : 'ok' (le document qui répond est dans un dossier, son nom très long), 'perso' (dans l'espace personnel), 'lien' (relier deux documents sans fichier : « Gérer les partages > Autres documents > Relier un document… »),
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
    return openShareOther({ container: stage, t: i18n.t, inertTargets: () => [explorer.root], file: kind === 'lien' ? null : { id: 'abc', name: 'Facture de la session de formation de septembre.pdf' }, createFlow: (chosen, strict) => { mode = chosen; acts.push(['mode', chosen, Boolean(strict)]); return flow; }, errorText: error => String(error.message), notice: text => acts.push(['notice', text]) });
  };
  // La fenêtre « Recevoir d'un autre document Grist » (js/share-receive-window.js, test/partager-recevoir-firefox.mjs) : la vraie fenêtre, sur un parcours dont les réponses sont des doublures (le moteur et Grist se mesurent
  // dans un vrai Grist : labo/run-partager-recevoir.mjs). `kind` : 'ok' (un premier partage : GFS_Recus), 'second' (la table libre suivante : GFS_Recus_2), 'connu' (une réception qui reprend), 'refus' (accepter échoue).
  // `window.__receiveActs` note ce que le parcours a reçu.
  window.__receive = kind => {
    const acts = window.__receiveActs = [];
    const table = kind === 'second' ? 'GFS_Recus_2' : 'GFS_Recus';
    let replied = false;
    const flow = {
      read: async text => {
        acts.push(['read', text]);
        if (!text.startsWith('GRISTSYNC2.')) throw new Error('Ce texte n’est pas un code de synchro.');
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
    };
    return openShareReceive({ container: stage, t: i18n.t, inertTargets: () => [explorer.root], createFlow: () => flow, errorText: error => String(error.message), notice: text => acts.push(['notice', text]) });
  };
  // L'onglet « Dans un autre document Grist » de « Partager » (js/share-other-tab.js) sur des liens que le contrôleur aurait lus : `window.__shareOther = true` le branche ; `window.__links` donne les liens ('actifs'
  // par défaut : un document à jour, un en attente de réponse, un bloqué ; 'aucun', 'illisible') ; `window.__shareActs` note les niveaux demandés. « Relier un nouveau document… » ouvre la fenêtre d'envoi (`__sendOther`).
  const LINK_DOC = 'Comptabilité fournisseurs de la région Nord-Est';
  const LINKS = {
    actifs: [{ id: 'e1', name: 'Compta', files: ['abc', 'x', 'y'], state: 'active', doc: { name: LINK_DOC, id: 'd1' } }, { id: 'e2', name: 'Direction', files: [], state: 'pending', doc: { name: '', id: '' } }, { id: 'e3', name: 'Archives', files: ['x'], state: 'blocked', doc: { name: 'Archives', id: 'd3' } }],
    aucun: [],
  };
  const linksNow = () => { if (window.__links === 'illisible') throw new Error('illisible'); return JSON.parse(JSON.stringify(LINKS[window.__links || 'actifs'])).filter(each => !(window.__removed || []).includes(each.id)); };
  const otherTab = state => ({
    why: whyNot(i18n.t, { file: { id: 'abc', name: 'Facture.pdf', app: 'gfs-fichiers' }, state }), fileId: 'abc',
    loadLinks: async () => linksNow(),
    onLevel: async (link, level) => { window.__shareActs.push(['level', link.id, level]); return { ok: true, note: level === 'once' ? i18n.t('so.once.going', { name: 'Facture.pdf' }) : undefined }; },
    onNew: async () => { window.__shareActs.push(['new']); await window.__sendOther(window.__shareSend || 'ok'); },
  });
  window.__share = kind => {
    window.__shareActs = [];
    window.__removed = [];
    const record = act => { window.__shareActs.push(act); return Promise.resolve({ ok: true }); };
    return openShare({ container: stage, t: i18n.t, locale: language === 'en' ? 'en-GB' : 'fr-FR', inertTargets: () => [explorer.root], other: window.__shareOther ? state => otherTab(state) : null, file: { key: 'gfs-fichiers:abc', name: 'Facture de la session de formation de septembre.pdf', app: 'GFS' },
      load: async () => shareStates[kind], onAdd: row => record(['add', row.Personne, row.Droit]), onChange: (id, patch) => record(['change', id, patch.Droit]), onRemove: id => record(['remove', id]), onActivate: async () => { window.__shareActs.push(['activate']); return false; }, onManage: kind === 'actif' ? () => window.__manage() : null });
  };
  // La fenêtre « Poids du document » (js/weight-window.js, test/poids-fenetre-firefox.mjs) : la vraie fenêtre et le vrai lecteur (js/weight-reader.js) sur une doublure de `Transfer.sql`. `window.__weightKind` choisit ce
  // que le serveur répond : 'ok' (un document de dix-huit tables dont une au nom très long et une trop longue à lire), 'refuse' (pas le droit de tout copier : 403), 'muet' (le serveur ne répond pas).
  // `window.__weightEstimate` garde ce que le total a donné à l'ouverture.
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
  window.__weight = estimate => {
    window.__weightEstimate = estimate;
    return openWeight({ container: stage, t: i18n.t, locale, inertTargets: () => [explorer.root], estimate, load: (update, cancelled) => readWeight(fakeSql(window.__weightKind), update, cancelled) });
  };
  show();
  explorer.open();
}

window.__ready = mount().then(() => true);
