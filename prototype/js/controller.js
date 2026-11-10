// Le contrôleur de GFS (contrats 4.1, cahier 6) : le démarrage, l'explorateur, l'app active et le passage de l'un à l'autre.
// Deux lieux dans le cadre : l'explorateur (qui remplace le cadre) et le fichier ouvert (le sous-cadre de l'app, resté vivant et caché quand on explore).

import { CATALOGUE } from './catalogue.js';
import { loadAll, label } from './manifest.js';
import { GristState } from './state.js';
import { createPort } from './broker.js';
import { ViewOptions, addressOf } from './view-options.js';
import { ViewLink, LINK_KEY } from './view-link.js';
import { AppSession } from './session.js';
import { AppStatus } from './app-status.js';
import { readPreferences, liveSwitch } from './frames.js';
import { createI18n } from './i18n.js';
import { LanguageSetting, browserStore, languageOfGrist, localeFor, watchStorage } from './language.js';
import { ThemeSetting, browserStores } from './theme.js';
import { ThemeHost } from './theme-apply.js';
import { ThemeWindow } from './theme-window.js';
import { AppStorage, browserBackend, storageHandlers } from './app-storage.js';
import { installSprite } from './icons.js';
import { Dock } from './dock.js';
import { settingsItems } from './settings-menu.js';
import { aboutItems } from './about.js';
import { WorkControl } from './work-control.js';
import { Explorer } from './explorer.js';
import { loadFiles, loadAttachments } from './explorer-data.js';
import { AppLinks } from './links.js';
import { Filing } from './filing.js';
import { askName, chooseFolder } from './filing-window.js';
import { readCatalogue } from './libraries.js';
import { extensionsOf } from './extensions.js';
import { AppsState } from './apps-state.js';
import { arrivalApp, arrivalProbes } from './arrival.js';
import { arrivalTableApp } from './arrival-table.js';
import { Rangement, TableDeclined } from './rangement.js';
import { RightsControl } from './rights-control.js';
import { createOtherDocuments } from './share-other.js';
import { resumeSharing } from './sync-resume.js';
import { whenReceived } from './sync-service.js';
import { WeightControl } from './weight-control.js';
import { FILES_APP, FILES_MANIFEST, FILES_ENTRY, cleanName } from './gfs-files.js';
import { Transfer, buildTransferFrame } from './transfer.js';
import { Attach } from './attach.js';
import { Player } from './player.js';
import { buildAppFiles, buildKept } from './file-managers.js';
import { Trash } from './trash.js';
import { Copying } from './copying.js';
import { ask } from './ask-window.js';
import { carriesFile } from './import-file.js';
import { Entries } from './entries.js';
import { Openings } from './openings.js';
import { OpenedFiles } from './opened-files.js';
import { ReceivedControl } from './received-control.js';
import { loadReceived } from './received-files.js';
import { publicationQuestion } from './publication-window.js';
import { ModulesWindow, rowKey } from './modules-window.js';
import { buildContext, identityFor, instanceOf, pageOf } from './context.js';
import { Refus, ERR, levelOf } from './filter.js';

const NOTICE_MS = 6000;

const LIBRARIES_PATH = 'bibliotheques/catalogue.json';
const FIRST_RUN_KEY = 'gfs.premier-lancement.';

const readFile = async path => {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path} : ${response.status}`);
  return response;
};
const readJson = async path => (await readFile(path)).json();

export class GfsController {
  apps = [];
  session = null;
  explorer = null;
  modulesWindow = null;
  themeWindow = null;
  #noticeTimer = null;
  #facts = null;
  #sentExtensions = null;
  #sentIdentity = null; // l'identité donnée à l'app active (JSON), ou null tant qu'elle n'a pas demandé son contexte
  #contextServed = false; // l'app active a demandé son contexte : elle a lu l'ouverture qui s'y trouvait, et ne la relira pas
  #modulesWaiters = [];
  #idleWaiters = []; // ceux qui attendent la fin des écritures des apps installées (`unlock`)
  #fileStatus = { loading: false, restricted: false, problems: [] }; // ce que l'explorateur dit sous la liste, gardé pour être redit dans la langue qui vaut

  // env : { grist, router, search, doc }
  constructor({ grist, router, search, doc = document }) {
    this.grist = grist;
    this.router = router;
    this.doc = doc;
    this.status = new AppStatus(this.$('status')); // la phrase d'état de l'app active : l'explorateur la cache tant qu'il recouvre l'app
    this.params = new URLSearchParams(search);
    this.preferences = readPreferences(search);
    // La langue de GFS et de ses apps : le choix de la personne, retenu sur ce navigateur ; à défaut celle de Grist, ou du navigateur (contrats 5.2).
    this.language = new LanguageSetting({ grist: languageOfGrist(this.params.get('language'), navigator.language), store: browserStore(window) });
    this.#useLanguage();
    // Le thème de GFS et de ses apps : l'ambiance et la couleur que la personne a choisies, retenues sur ce navigateur comme la langue (js/theme.js) ; posées sur la page tout de suite, dites à l'app ouverte.
    this.theme = new ThemeSetting(browserStores(window));
    this.themeHost = new ThemeHost({ win: window, setting: this.theme, onMessage: message => { if (this.session) this.session.sendAmbiance(message); } });
    this.themeHost.start();
    this.state = new GristState();
    // Les choix de chaque app (contrats 5.3) : un espace par app dans le navigateur de GFS, jamais dans le document.
    this.appStorage = new AppStorage({ backend: browserBackend(window) });
    this.port = createPort(grist);
    this.readonly = this.params.get('readonly') === 'true';
    // Les réglages des apps s'écrivent dans la vue, sans « Enregistrer » (contrats 7.3) : GFS retrouve sa section par son adresse et sa table.
    this.viewOptions = new ViewOptions({
      doc: this.port.doc, widget: this.port.widget, address: addressOf(location.href), tableId: () => (this.state.table ? this.state.table.tableId : null),
      enabled: () => this.fullAccess && !this.readonly,
    });
    // La section de GFS se relie d'elle-même à la grille de la même table (js/view-link.js, contrats 4.5 point 8) : « La table de la page » suit alors la ligne que la personne clique.
    this.viewLink = new ViewLink({
      doc: this.port.doc, state: this.state, section: () => this.viewOptions.section(), enabled: () => this.fullAccess && !this.readonly && this.params.get('grille') !== '0',
      chosen: () => Boolean(this.workControl && this.workControl.work.choice), mark: value => this.viewOptions.write([[LINK_KEY, value]]), say: (key, vars) => this.notice(this.t(key, vars)),
    });
    // Les apps sont servies par leur site en ligne (le porteur, 22/10) ; `?live=0` : la copie figée du sous-module, celle des mesures de GFS.
    this.live = liveSwitch(search);
    // Les apps installées et leurs extensions : ce que le document retient dans la table `GFS_Rangement` (contrats 7.4), écrit seulement sur un geste
    // de la personne, et la table seulement avec son accord. Cette table apprend aussi à GFS l'adresse de la personne (6.4, point 6) : sans écriture possible, elle reste inconnue.
    this.rangement = new Rangement({ port: this.port, consent: () => this.#askTableConsent(), canWrite: () => !this.#writeBlock(), onIdentity: () => this.#onIdentity() });
    this.registry = new AppsState({ store: this.rangement, onChange: () => this.#onRegistryChange() });
    // Ce que l'explorateur et les liens demandent (grisé, types de « Nouveau » et d'« Importer », qui lit un fichier : js/entries.js), et les ouvertures (js/openings.js).
    const entries = new Entries(this);
    Object.assign(this, { lockOf: entries.lockOf, newTypes: entries.newTypes, importTypes: entries.importTypes, readerOf: entries.readerOf });
    this.opened = new OpenedFiles(); // les fichiers que GFS a ouverts dans une app, pour la vue « Ouverts » de l'explorateur (js/opened-files.js)
    this.openings = new Openings(this);
    this.links = this.#buildLinks();
    // Le cadre d'envoi (js/transfer.js) ne s'ouvre qu'à la première requête : les pièces jointes, et la preuve que la personne est propriétaire (js/rights-reader.js).
    this.transfer = new Transfer({ doc: this.port.doc, base: this.doc.baseURI, createFrame: url => buildTransferFrame(this.doc, url) });
    this.player = new Player({ container: this.$('frames') }); // le lecteur de vidéos posé par-dessus l'app (contrats 5.2, point 11)
    this.attach = new Attach({ doc: this.port.doc, transfer: this.transfer, session: () => this.session, readonly: () => this.readonly }); // `joindre` (contrats 5.4, point 12)
    // Le partage de fichiers avec d'autres documents Grist (js/share-other.js) : le moteur du kit, son port et les fenêtres ne se chargent qu'au premier besoin.
    this.otherDocuments = createOtherDocuments({
      t: this.t, container: this.$('stage'), inertTargets: this.inertTargets, docApi: () => this.grist.docApi, transfer: this.transfer,
      language: () => this.lang, notice: text => this.notice(text), writeBlock: () => this.#writeBlock(),
    });
    this.rights = new RightsControl({
      port: this.port, transfer: this.transfer, manifests: this.manifests, now: () => Date.now(), container: this.$('stage'),
      inertTargets: this.inertTargets, t: this.t, fullAccess: () => this.fullAccess,
      locale: () => this.locale, identity: () => this.identity, writeBlock: () => this.#writeBlock(), appName: this.appName, spaces: () => this.spaces,
      other: (file, state) => this.otherDocuments.tab(file, state), otherLinks: () => this.otherDocuments.links(), otherStop: link => this.otherDocuments.stop(link), otherNew: () => this.otherDocuments.link(),
    });
    this.weight = new WeightControl({ transfer: this.transfer, container: this.$('stage'), inertTargets: this.inertTargets, t: this.t, locale: () => this.locale });
  }

  $ = id => this.doc.getElementById(id);
  t = (key, vars) => this.i18n.t(key, vars);
  // Ce que chaque fenêtre du widget rend inerte tant qu'elle est ouverte : l'explorateur, les cadres des apps, la barre.
  inertTargets = () => [this.explorer.root, this.$('frames'), this.$('floaters')];
  // Les manifestes des apps valides (ce que les fenêtres et les liens lisent à chaque appel).
  manifests = () => this.validApps().map(item => item.manifest);

  // L'app active a demandé son contexte (les ouvertures en ont besoin pour savoir si elle a quelque chose à enregistrer avant de partir).
  get contextServed() { return this.#contextServed; }

  // L'adresse de la personne, '' tant que GFS ne la connaît pas : son rangement est alors commun au document (contrats 6.4, point 4).
  get identity() { return this.rangement.identity; }

  // ---------- noms, grisé, types à créer : ce que l'explorateur demande ----------

  // Sous `full`, GFS ne lit pas les tables de fichiers des apps (contrats 3.1, point 2) : l'explorateur le dit au lieu de rendre l'erreur de Grist.
  get fullAccess() { return levelOf(this.state.grantedAccess) >= levelOf('full'); }

  appById(id) { return this.apps.find(item => item.app.id === id && item.ok) || null; }
  // Le manifeste d'une app installable, ou celui des fichiers que GFS garde lui-même (js/gfs-files.js) : null quand l'id n'est ni l'un ni l'autre.
  manifestOf = id => (id === FILES_APP ? FILES_MANIFEST : (this.appById(id) || { manifest: null }).manifest);
  appName = id => { const manifest = this.manifestOf(id); return manifest ? label(manifest.nom, this.lang) : id; };
  validApps() { return this.apps.filter(item => item.ok); }
  typeLabel = file => (file.typeInfo ? label(file.typeInfo.nom, this.lang) : (file.type || '—'));

  // ---------- démarrage ----------

  async start() {
    const { doc } = this;
    if (window.parent === window) { this.status.say(this.t('gfs.noGrist'), true); doc.body.dataset.gfs = 'standalone'; return; }
    installSprite(doc);
    doc.documentElement.lang = this.lang;
    this.language.onChange(event => this.#onLanguage(event));
    watchStorage(this.language);
    this.grist.on('message', message => this.state.feed(message));
    this.grist.ready({ requiredAccess: 'full', onEditOptions: () => this.onEditOptions() });
    this.#installPrint();
    const libraries = this.#loadLibraries(); // la lecture part avec celles des manifestes : un seul aller-retour de réseau pour les deux (elle ne dépend d'aucun manifeste)
    this.apps = await loadAll(CATALOGUE, readJson);
    this.registry.setApps(this.apps);
    this.registry.setCatalogue(await libraries);
    await this.state.whenOptions();
    if (this.fullAccess) await Promise.all([this.registry.load(), this.rangement.identify()]);
    this.#buildExplorer();
    this.#buildDock();
    const arrived = await this.#arrive();
    doc.body.dataset.gfs = 'ready';
    if (!arrived) await this.#firstRun(); // une section qui s'ouvre sur son app n'est pas neuve : la fenêtre des apps ne passe pas par-dessus
    doc.body.dataset.gfsFirstRun = 'done';
    void this.state.whenTable().then(() => this.viewLink.ensure());
    // Un envoi laissé en route, ou un partage reçu dont le contenu arrive encore : les boucles du moteur reprennent d'où elles en étaient (js/sync-resume.js ; rien ne se charge sans table de partage).
    whenReceived(() => void this.#refreshReceived());
    if (!this.#writeBlock()) void resumeSharing({ docApi: this.grist.docApi, transfer: this.transfer, language: () => this.lang, busy: () => false, isOwner: () => this.transfer.isOwner() }).catch(error => console.warn('GFS : le partage entre documents ne reprend pas', error));
  }

  // L'arrivée (cahier 6.2, point 2 ; js/arrival.js) : une section qui servait à une app s'ouvre sur elle, sans consigne et sans rien écrire ; sinon l'explorateur. Les réglages de la section parlent d'abord ;
  // sans eux, la table d'une app qui garde sa vue dans le document (`arrivee` du manifeste) dit si la section est la sienne (js/arrival-table.js). Rend `true` si une app s'est ouverte.
  async #arrive() {
    const manifests = this.manifests();
    const rules = { installed: appId => this.registry.has(appId), granted: this.state.grantedAccess };
    let id = arrivalApp(this.state.allOptions, manifests, rules);
    const probes = id ? [] : arrivalProbes(this.state.allOptions, manifests, rules);
    if (probes.length) {
      const table = await this.state.whenTable();
      if (table) id = await arrivalTableApp(this.port.doc, probes, table.tableId);
    }
    if (id && this.activate(id, null)) {
      this.hideExplorer();
      return true;
    }
    this.showExplorer();
    return false;
  }

  // Le catalogue des bibliothèques d'extensions est livré avec GFS (contrats 2.6, point 6) : un fichier illisible ou une entrée invalide grise
  // les extensions qui en dépendent, rien d'autre ne s'arrête.
  async #loadLibraries() {
    try {
      const catalogue = readCatalogue(await readJson(LIBRARIES_PATH));
      for (const problem of catalogue.errors) console.warn(`GFS : catalogue des bibliothèques : ${problem}`);
      return catalogue;
    } catch (error) {
      console.warn('GFS : le catalogue des bibliothèques est illisible', error);
      return { entries: new Map(), errors: [String(error && error.message)] };
    }
  }

  // Les réglages de la vue dans Grist (la roue du panneau de droite) : la porte permanente de la fenêtre « Apps et extensions ».
  onEditOptions() { if (this.explorer) void this.openModules(); }

  // La fonction « print » du script d'API de Grist imprime la page de GFS ; GFS la remplace par un relais vers l'app active (contrats 4.3).
  #installPrint() {
    this.grist.rpc.unregisterFunc('print');
    this.grist.rpc.registerFunc('print', () => (this.session && this.session.isReady ? this.session.callApp('print', [], 10000) : window.print()));
  }

  #buildExplorer() {
    const askFor = opts => this.ask(opts);
    this.kept = buildKept(this, { ask: askFor, hideNotice: () => this.#hideNotice() });
    const managers = [this.kept, buildAppFiles(this, { ask: askFor })]; // les gardiens des fichiers : les PDF de GFS, les fichiers des apps (la corbeille et la copie les interrogent)
    const gestures = { t: this.t, notice: text => this.notice(text), refresh: () => this.refreshFiles() };
    const filing = this.#buildFiling();
    this.filing = filing;
    // « Partagés avec moi » (js/received-control.js) : les fichiers reçus d'un autre document, grisés tant qu'ils ne sont pas acceptés.
    this.received = new ReceivedControl({
      port: this.port, t: this.t, locale: () => this.locale, container: this.$('stage'), inertTargets: this.inertTargets, typeLabel: this.typeLabel, notice: text => this.notice(text),
      blocked: () => this.#writeBlock(), refresh: () => this.refreshFiles(), open: file => this.openings.openFile(file),
    });
    this.explorer = new Explorer({
      container: this.$('stage'), i18n: this.i18n, locale: this.locale, now: () => new Date(), appName: this.appName, received: this.received,
      typeLabel: file => (file.received ? this.received.typeLabel(file) : this.typeLabel(file)), lockOf: file => (file.received ? this.received.lockOf(file) : this.lockOf(file)),
      newTypes: this.newTypes, importTypes: this.importTypes, canClose: () => Boolean(this.session), notice: text => this.notice(text),
      opened: { keys: () => this.opened.keys(), shown: () => this.opened.shown(this.session), remove: key => this.opened.remove(key) },
      settings: () => settingsItems({
        t: this.t, language: () => ({ choice: this.language.choice, grist: this.language.grist }), onLanguage: choice => this.#chooseLanguage(choice), onTheme: () => this.openTheme(),
        place: () => this.dock.placeRow(), onAbout: () => this.#openAbout(),
      }),
      onRights: () => void this.rights.open(this.explorer), sharing: this.rights.sharing, onWeight: estimate => void this.weight.open(estimate),
      onOpen: file => this.openings.openFile(file), onNew: entry => this.openings.openNew(entry), onImport: entry => void this.openings.importFile(entry), onClose: () => this.hideExplorer(), onApps: () => void this.openModules(),
      personal: () => Boolean(this.identity), filing, kept: this.kept, attachments: () => loadAttachments(this.port),
      trash: new Trash({ managers, ask: opts => this.ask(opts), keepFolders: file => filing.keepFoldersOf(file), ...gestures }),
      copying: new Copying({ managers, file: (app, id, folder) => filing.rangeNew([{ app, file: id, pinned: false, folder }]), ...gestures }),
    });
  }

  // Les liens entre apps (js/links.js, contrats 5.4) : ce que le contrôleur prête à `choisir` et `ouvrir`, appelés par une app.
  #buildLinks() {
    return new AppLinks({
      explorer: () => this.explorer, session: () => this.session, manifests: this.manifests, appById: id => this.appById(id), appName: this.appName,
      fullAccess: () => this.fullAccess, t: this.t, notice: text => this.notice(text), lockOf: this.lockOf, unlock: lock => this.unlock(lock),
      showExplorer: () => this.showExplorer(), hideExplorer: () => this.hideExplorer(), loadFiles: apps => loadFiles(this.port, apps, this.identity),
      openIn: (appId, opening) => this.openings.openIn(appId, opening, 'ex.notice.open'),
    });
  }

  // Épingler, renommer, déplacer depuis l'explorateur (js/filing.js) : les fenêtres du widget par-dessus l'explorateur, et la liste relue après chaque geste.
  #buildFiling() {
    const layer = opts => ({ ...opts, t: this.t, container: this.$('stage'), inertTargets: this.inertTargets });
    return new Filing({
      port: this.port, rangement: this.rangement, t: this.t, locale: () => this.locale, files: () => this.explorer.files, folders: () => this.explorer.folders, appName: this.appName,
      spaces: { info: () => this.spaces, owner: async () => (await this.transfer.isOwner()) === true },
      here: () => (this.explorer.state.view === 'folder' ? this.explorer.state.path : ''), writeBlock: () => this.#writeBlock(), notice: text => this.notice(text),
      specOf: file => ((this.manifestOf(file.app) || {}).fichiers || []).find(spec => spec.table === file.table) || null,
      cleanName: file => (file.app === FILES_APP ? cleanName : undefined),
      refresh: () => this.refreshFiles(), windows: { name: opts => askName(layer(opts)), folder: opts => chooseFolder(layer(opts)) },
    });
  }

  // La barre de GFS au-dessus de l'app ouverte (js/dock.js) : ses boutons ouvrent l'explorateur et la fenêtre des apps ; quand ce qu'elle recouvre change, l'app ouverte le sait
  // (événement `barre`, contrats 5.2, point 7).
  #buildDock() {
    this.dock = new Dock({
      root: this.$('floaters'), stage: this.$('stage'), onFiles: () => this.showExplorer(), onApps: () => void this.openModules(), onWork: () => void this.workControl.open(),
      onNotKept: () => this.notice(this.t('lang.notKept')),
    });
    // La ligne de travail (contrats 4.5) : une autre table rouvre l'app active, qui la reçoit dès son démarrage.
    this.workControl = new WorkControl({
      port: this.port, state: this.state, dock: this.dock, container: this.$('stage'), t: this.t, appName: this.appName, manifests: this.manifests,
      session: () => this.session, inertTargets: this.inertTargets, notice: text => this.notice(text),
      reopen: id => { this.#closeSession(); this.activate(id, this.opening); }, hidden: () => this.doc.hidden,
    });
    this.dock.relabel(this.t);
    this.workControl.relabel();
    this.dock.onChange(barre => { if (this.session) this.session.sendBar(barre); });
  }

  // ---------- la langue ----------

  // Pose la langue qui vaut : les textes, les noms d'apps, le format des dates de GFS.
  #useLanguage() {
    this.i18n = createI18n(this.language.language);
    this.lang = this.i18n.lang;
    this.locale = localeFor({ culture: this.preferences.culture, language: this.lang, grist: this.language.grist });
  }

  // Les paramètres de Grist que les apps reçoivent (adresse du cadre, `contexte`) : ceux de Grist, sauf la langue, qui est celle que la personne a choisie dans GFS.
  #appPreferences() { return { ...this.preferences, language: this.lang }; }

  // La personne choisit la langue de GFS et de ses apps. Si le navigateur refuse de la retenir, elle vaut pour cette page, et GFS le dit (dans la langue choisie).
  #chooseLanguage(choice) {
    if (!this.language.choose(choice)) this.notice(this.t('lang.notKept'));
  }

  // La langue qui vaut a changé (un geste, ou un autre onglet de la personne) : tout ce que GFS écrit se redit dans la nouvelle langue, et l'app ouverte est prévenue
  // (contrats 5.2, points 2 et 6) sans que son cadre soit touché. Choisir la langue que Grist donne déjà ne change rien : les apps n'ont rien à apprendre.
  #onLanguage({ languageChanged }) {
    if (!languageChanged) return;
    this.#useLanguage();
    this.doc.documentElement.lang = this.lang;
    if (!this.explorer) return; // le démarrage n'a pas encore construit le cadre : il le fera dans cette langue
    const live = { i18n: this.i18n, locale: this.locale };
    this.explorer.relocalize(live);
    if (this.modulesWindow) this.modulesWindow.relocalize(live);
    if (this.themeWindow) this.themeWindow.relocalize(live);
    this.dock.relabel(this.t);
    this.workControl.relabel();
    this.#showFileStatus();
    if (this.session) this.session.sendLanguage(this.lang);
  }

  // ---------- les deux lieux ----------

  showExplorer() {
    this.status.cover(true);
    this.openings.moved(); // la personne repart explorer : une app qui répondrait « fermer » plus tard ne change plus rien
    this.$('frames').inert = true;
    this.dock.setPresent(false);
    if (this.session) this.session.show(false);
    this.explorer.open();
    void this.refreshFiles();
    void this.rights.refresh(this.explorer);
  }

  hideExplorer() {
    this.links.cancel(false); // un choix de fichier en cours finit sans choix (contrats 5.4, point 2)
    this.explorer.close();
    this.status.cover(false);
    this.$('frames').inert = false;
    this.dock.setPresent(Boolean(this.session));
    if (this.session) {
      this.session.show(true);
      this.session.focus();
    }
  }

  async refreshFiles() {
    if (!this.fullAccess) {
      this.explorer.setFiles([]);
      this.#fileStatus = { loading: false, restricted: true, problems: [{ key: 'gfs.needsFullAccess' }] };
      this.#showFileStatus();
      return;
    }
    this.#fileStatus = { loading: true, restricted: false, problems: [] };
    this.#showFileStatus();
    try {
      const { files, trash, folders, received, spaces, problems, stats } = await loadFiles(this.port, [...this.validApps(), FILES_ENTRY], this.identity);
      this.spaces = spaces;
      this.explorer.setFiles(files, trash, folders, received);
      this.#fileStatus = { loading: false, restricted: false, problems: problems.map(item => ({ key: 'ex.readFailed', app: item.app, reason: item.reason })) };
      this.#showFileStatus();
      this.doc.body.dataset.explorerStats = JSON.stringify(stats);
    } catch (error) {
      console.error('GFS : lecture des fichiers impossible', error);
      this.#fileStatus = { loading: false, restricted: false, problems: [{ key: 'gfs.loadFailed', reason: String(error && error.message) }] };
      this.#showFileStatus();
    }
  }

  #showFileStatus() {
    const { loading, restricted, problems } = this.#fileStatus;
    this.explorer.setStatus({ loading, restricted, problems: problems.map(({ key, app, reason }) => this.t(key, { app: app ? this.appName(app) : '', reason })) });
  }

  // ---------- la fenêtre « Thème » ----------

  // La ligne « Thème » du menu « Réglages » de l'explorateur : l'ambiance et la couleur de GFS et de ses apps (js/theme-window.js). La fenêtre suit le mode de la page : ses vignettes se repeignent quand
  // Grist passe du clair au sombre.
  openTheme() {
    if (!this.themeWindow) {
      this.themeWindow = new ThemeWindow({
        container: this.$('stage'), i18n: this.i18n, locale: this.locale, setting: this.theme, mode: () => this.themeHost.mode,
        inertTargets: this.inertTargets,
      });
      this.themeHost.onMode(() => this.themeWindow.refresh());
    }
    this.themeWindow.open();
  }

  // La ligne « À propos » du menu « Réglages » (js/about.js) : la version, l'auteur, le site et la licence, dans une fenêtre du widget qui n'a que son bouton « Fermer ».
  #openAbout() {
    void this.ask({ title: this.t('about.title'), message: this.t('about.text'), items: aboutItems(this.t), confirmLabel: this.t('about.close') });
  }

  // ---------- la fenêtre « Apps et extensions » ----------

  // La fenêtre s'ouvre ; la promesse se tient jusqu'à sa fermeture (l'appel `installer` de l'app attend le choix de la personne, 5.4).
  openModules({ focus = null } = {}) {
    if (this.themeWindow) this.themeWindow.close(); // une seule fenêtre à la fois : celle des apps passe devant
    if (!this.modulesWindow) this.modulesWindow = this.#buildModules();
    this.modulesWindow.open({ focus });
    return new Promise(resolve => this.#modulesWaiters.push(resolve));
  }

  #buildModules() {
    const change = pending => pending.catch(error => {
      if (error instanceof TableDeclined) { this.notice(this.t('table.declined')); return; }
      console.error('GFS : enregistrement des apps impossible', error);
      this.notice(this.t('gfs.settingsFailed', { reason: String(error && error.message) }));
    });
    return new ModulesWindow({
      container: this.$('stage'), i18n: this.i18n, locale: this.locale, model: () => this.registry.model(), blocked: () => this.#writeBlock(),
      inertTargets: this.inertTargets,
      on: {
        app: (id, on) => change(this.registry.setApp(id, on)),
        extension: (app, id, on) => change(this.registry.setExtension(app, id, on)),
        mode: (app, id, mode) => change(this.registry.setMode(app, id, mode)),
        open: id => this.#openApp(id),
      },
      onClose: () => this.#modulesWaiters.splice(0).forEach(resolve => resolve()),
    });
  }

  // Pourquoi rien ne peut s'enregistrer (contrats 7.4, point 5), ou null : le document est en lecture seule, ou GFS n'a pas l'accès complet.
  // Une écriture que Grist refuse malgré tout (une règle d'accès) revient par l'avis de `change`.
  #writeBlock() {
    if (this.readonly) return this.t('mod.readonly');
    return this.fullAccess ? null : this.t('mod.needsAccess');
  }

  // La table n'existe pas encore : la personne décide de la créer (contrats 6.2, point 1). Une fenêtre du widget, au-dessus de celle des apps.
  #askTableConsent() {
    return this.ask({ title: this.t('table.title'), message: this.t('table.text'), confirmLabel: this.t('table.create'), cancelLabel: this.t('table.cancel') });
  }

  // Une app publie un formulaire (contrats 3.3, point 9) : la personne dit si le lien peut ouvrir ce que le lot ouvre.
  #askPublication(manifest, opens) {
    return this.ask(publicationQuestion({ t: this.t, app: label(manifest.nom, this.lang), opens }));
  }

  // Une fenêtre du widget au-dessus de tout ce qui est ouvert (charte : jamais `confirm()`).
  ask(opts) {
    const above = this.modulesWindow && this.modulesWindow.element ? [this.modulesWindow.element] : [];
    return ask({ ...opts, container: this.$('stage'), inertTargets: () => [this.explorer.root, this.$('frames'), this.$('floaters'), ...above] });
  }

  // La troisième porte : une section qui n'a encore rien retenu ouvre la fenêtre une fois, pour qu'on y choisisse ses apps (maquette du 12/10).
  // « Une fois » se retient par document, dans le navigateur ; sans stockage, la fenêtre reste atteignable par les deux autres portes.
  async #firstRun() {
    if (this.registry.stored || this.readonly) return;
    const facts = await this.#readFacts();
    if (!facts.document) return;
    const key = `${FIRST_RUN_KEY}${facts.document}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch (error) { return; }
    void this.openModules();
  }

  // Un passage de la boucle qui reçoit a changé quelque chose (js/sync-service.js) : « Partagés avec moi » et la cloche se mettent à jour, sans relire le reste, et seulement explorateur ouvert (à l'ouverture, la
  // liste se relit de toute façon).
  async #refreshReceived() {
    if (!this.explorer || !this.explorer.isOpen || !this.fullAccess) return;
    try { this.explorer.setReceived(await loadReceived(this.port, (await this.port.doc.listTables()).map(String))); } catch (error) { console.warn('GFS : les arrivées ne se relisent pas', error); }
  }

  // GFS vient d'apprendre l'adresse de la personne (la table est née pendant la session) : sa liste de fichiers se relit avec son propre rangement.
  #onIdentity() {
    if (this.explorer && this.explorer.isOpen) void this.refreshFiles();
    this.#pushIdentity();
  }

  // L'événement `identite` (contrats 5.2, points 2 et 9) : seulement à l'app qui a déjà son contexte et que l'adresse vient de changer (une app qui ne l'a pas déclarée n'en reçoit rien).
  #pushIdentity() {
    if (!this.session || this.#sentIdentity === null) return;
    const identity = identityFor(this.session.policy, this.identity);
    const sent = JSON.stringify(identity);
    if (sent === this.#sentIdentity) return;
    this.#sentIdentity = sent;
    this.session.sendIdentity(identity);
  }

  // Un changement des apps installées (un geste, ou le retour à ce que la table dit) : tout ce qui en dépend se met à jour.
  // `data-registry` dit si une écriture est en cours : les essais du labo l'attendent.
  #onRegistryChange() {
    this.doc.body.dataset.registry = this.registry.busy ? 'busy' : 'idle';
    if (!this.registry.busy) this.#idleWaiters.splice(0).forEach(resolve => resolve());
    if (!this.explorer) return;
    if (this.modulesWindow) this.modulesWindow.refresh();
    if (this.explorer.isOpen) this.explorer.render();
    if (this.session && !this.registry.has(this.session.id)) {
      this.#closeSession();
      this.showExplorer();
    } else if (this.session) {
      this.#pushExtensions();
    }
  }

  #closeSession() {
    this.status.say('');
    this.links.drop(); // l'app qui demandait un choix n'est plus là
    this.dock.mask(false);
    this.session.close();
    this.session = null;
    this.#sentExtensions = null;
    this.#sentIdentity = null;
    this.#contextServed = false;
  }

  // L'événement `extensions` (contrats 5.2, point 2) : seulement quand ce que l'app doit charger a vraiment changé.
  #pushExtensions() {
    const given = this.registry.extensionsFor(this.session.id, this.doc.baseURI);
    const sent = JSON.stringify([given.extensions, given.bibliotheques]);
    if (sent === this.#sentExtensions) return;
    this.#sentExtensions = sent;
    this.session.sendExtensions(given);
  }

  // « Ouvrir » sur une ligne de la fenêtre : l'app s'ouvre sans consigne (elle applique son propre ordre d'arrivée, contrats 5.2, point 3).
  async #openApp(id) {
    const app = this.appById(id);
    if (app && levelOf(app.manifest.permissions.acces) > levelOf(this.state.grantedAccess)) { this.notice(this.t('gfs.needsFullAccess')); return; }
    if (!(await this.openings.leave('app', id))) return;
    if (!this.activate(id, null)) return;
    this.hideExplorer();
  }

  // ---------- ce que l'app demande à GFS (contrats 5.1) ----------

  // Les faits qui ne changent pas pendant la vie de la page : lus une fois.
  async #readFacts() {
    if (this.#facts) return this.#facts;
    let document = null;
    try { document = await this.port.doc.getDocName(); } catch (error) { console.warn('GFS : le nom du document est illisible', error); }
    const referrer = this.doc.referrer;
    this.#facts = { instance: instanceOf(referrer), page: pageOf(referrer), document, widgetAddress: `${location.origin}${location.pathname}` };
    return this.#facts;
  }

  #envelopeHandlers(session) {
    return {
      contexte: () => this.#contextFor(session),
      installer: args => this.#install(session, args),
      ...storageHandlers(this.appStorage, session.id),
      ...this.dock.handlers(session.id),
      ...this.links.handlers(session),
      ...this.kept.handlers(session),
      ...this.attach.handlers(session),
      ...this.player.handlers(session),
    };
  }

  async #contextFor(session) {
    this.dock.mask(false); // un cadre qui redemande son contexte repart avec la barre (contrats 5.2, point 7)
    const opening = this.#takeOpening(session);
    const given = this.registry.extensionsFor(session.id, this.doc.baseURI);
    this.#sentExtensions = JSON.stringify([given.extensions, given.bibliotheques]);
    const facts = await this.#readFacts();
    const storage = this.appStorage.read(session.id);
    const identity = identityFor(session.policy, this.identity);
    if (session === this.session) this.#sentIdentity = JSON.stringify(identity);
    const role = await this.rights.reader.role(); // ce que GFS a prouvé : propriétaire ou non, `null` sinon (contrats 5.2, point 8)
    session.announceSaved(); // d'avance, ce que deviendront ses réglages de vue : dans la vue (rien à enregistrer dans Grist) ou en brouillon (contrats 7.3, point 5)
    return buildContext(facts, { access: session.access, extensions: given.extensions, libraries: given.bibliotheques, opening, storage, bar: this.dock.barre(), identity, players: session.policy.lecteurs, ambiance: this.theme.message(), role }, { preferences: this.#appPreferences(), readonly: this.readonly });
  }

  // L'ouverture n'est rendue qu'au premier `contexte` de l'app qui vient d'être activée (contrats 5.2, point 3) : une app dont le cadre est rechargé sur place (sa langue, un
  // réglage qui le demande) retrouve son ordre habituel, au lieu de refaire un « Nouveau » déjà fait ou de rouvrir le modèle du dernier clic. Une app déjà ouverte reçoit l'appel `ouvrir`.
  #takeOpening(session) {
    if (session !== this.session) return null;
    const opening = this.#contextServed ? null : this.opening;
    this.#contextServed = true;
    if (carriesFile(opening)) this.opening = null; // le fichier part une seule fois : une réouverture de l'app ne le reprend pas
    return opening;
  }

  // L'appel `installer` (5.4, point 4) : la fenêtre s'ouvre sur la ligne de l'extension, rien ne se télécharge ; la réponse dit les extensions
  // actives après le choix de la personne.
  async #install(session, args) {
    const wanted = typeof args.extension === 'string' ? args.extension : '';
    if (!extensionsOf(session.manifest).some(item => item.id === wanted)) throw new Refus(ERR.REFUSE, `L'extension « ${wanted} » n'est pas déclarée dans le manifeste de l'app.`);
    await this.openModules({ focus: rowKey(session.id, wanted) });
    return { actives: this.registry.extensionsFor(session.id, this.doc.baseURI).extensions };
  }

  // ---------- ouvrir ----------

  // Un clic sur du grisé : la fenêtre qui le débloque s'ouvre sur sa ligne, ou, quand il n'y a rien à débloquer ici, la raison est dite. La promesse se tient jusqu'à la fermeture de la fenêtre et à
  // la fin des écritures qu'elle a lancées : l'appel `ouvrir` d'une app attend que la personne ait fini (contrats 5.4, point 7).
  async unlock(lock) {
    if (!lock.focus) { this.notice(lock.text); return; }
    await this.openModules({ focus: lock.focus });
    if (this.registry.busy) await new Promise(resolve => this.#idleWaiters.push(resolve));
  }

  // Active l'app : la même reste en place, une autre remplace l'app active (une seule à la fois, contrats 1.4).
  openable(id) { return Boolean(this.appById(id)) && this.registry.has(id); }

  activate(id, opening) {
    if (!this.openable(id)) return false;
    const app = this.appById(id);
    this.opening = opening;
    if (this.isOpen(id)) return true;
    if (this.session) this.#closeSession();
    const opened = new AppSession(this.#sessionContext(app));
    opened.onLeave(() => this.player.closeFor(opened));
    this.session = opened;
    this.session.open();
    return true;
  }

  // L'app est déjà ouverte et vivante : une app qui a renoncé (« ne répond pas ») ne l'est plus, la rouvrir la relance au lieu de rendre le cadre muet.
  isOpen(id) { return Boolean(this.session) && this.session.id === id && !this.session.gaveUp; }

  #sessionContext(app) {
    const { state, port } = this.workControl.sourceFor(app.manifest);
    return {
      entry: app.app, manifest: app.manifest, catalogue: this.manifests(), state, port, router: this.router,
      container: this.$('frames'), readonly: this.readonly, preferences: this.#appPreferences(), base: this.doc.baseURI, live: this.live, lang: this.lang, onStatus: (kind, current) => this.#onStatus(kind, current),
      envelopeHandlers: session => this.#envelopeHandlers(session), authorize: (manifest, opens) => this.#askPublication(manifest, opens), viewOptions: this.viewOptions,
    };
  }

  // ---------- phrases d'état ----------

  #onStatus(kind, current) {
    const app = label(current.manifest.nom, this.lang);
    this.doc.body.dataset.appStatus = kind;
    this.doc.body.dataset.appSource = current.source;
    if (kind === 'loading') this.status.say(this.t('gfs.loading', { app }));
    else if (kind === 'fallback') { this.status.say(this.t('gfs.loading', { app })); this.notice(this.t('gfs.fallback', { app })); }
    else if (kind === 'timeout') this.status.say(this.t('gfs.timeout', { app }), true);
    else this.status.say('');
  }

  // Une phrase qui disparaît seule : ce que GFS ne sait pas encore faire, dit une fois.
  notice(text) {
    const el = this.$('toast');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(this.#noticeTimer);
    this.#noticeTimer = setTimeout(() => { el.hidden = true; }, NOTICE_MS);
  }

  // La phrase s'efface quand ce qu'elle annonçait est fini.
  #hideNotice() {
    clearTimeout(this.#noticeTimer);
    this.$('toast').hidden = true;
  }
}
