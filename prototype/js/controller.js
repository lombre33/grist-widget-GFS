// Le contrôleur de GFS (contrats 4.1, cahier 6) : le démarrage, l'explorateur, l'app active et le passage de l'un à l'autre.
// Deux lieux dans le cadre : l'explorateur (qui remplace le cadre) et le fichier ouvert (le sous-cadre de l'app, resté vivant et caché quand on explore).

import { CATALOGUE } from './apps/catalogue.js';
import { loadAll, label } from './apps/manifest.js';
import { GristState } from './broker/state.js';
import { createPort } from './broker/broker.js';
import { TableCache } from './broker/table-cache.js';
import { ViewOptions, addressOf } from './broker/view-options.js';
import { ownSectionHandlers } from './broker/own-section.js';
import { ViewLink, LINK_KEY } from './broker/view-link.js';
import { AppSession } from './broker/session.js';
import { AppStatus } from './broker/app-status.js';
import { readPreferences, liveSwitch } from './broker/frames.js';
import { createI18n } from './i18n/i18n.js';
import { LanguageSetting, browserStore, languageOfGrist, localeFor, watchStorage } from './shell/language.js';
import { ThemeSetting, browserStores } from './theme/theme.js';
import { ThemeHost } from './theme/theme-apply.js';
import { ThemeWindow } from './theme/theme-window.js';
import { AppStorage, browserBackend, storageHandlers } from './broker/app-storage.js';
import { installSprite } from './ui/icons.js';
import { loadFiles } from './explorer/explorer-data.js';
import { createLightReader } from './explorer/explorer-sql.js';
import { AppLinks } from './broker/links.js';
import { readCatalogue } from './apps/libraries.js';
import { extensionsOf } from './apps/extensions.js';
import { AppsState } from './apps/apps-state.js';
import { DocNames } from './apps/doc-names.js';
import { arrivalApp, arrivalProbes } from './broker/arrival.js';
import { arrivalTableApp } from './broker/arrival-table.js';
import { Rangement, TableDeclined } from './files/rangement.js';
import { isNewer } from './files/structure.js';
import { appFilingOf } from './files/app-filing.js';
import { RightsControl } from './rights/rights-control.js';
import { createOtherDocuments } from './sharing/share-other.js';
import { createFollower } from './sharing/share-follow.js';
import { resumeSharing } from './sharing/sync-resume.js';
import { whenReceived } from './sharing/sync-service.js';
import { WeightControl } from './weight/weight-control.js';
import { FILES_APP, FILES_MANIFEST } from './files/gfs-files.js';
import { Transfer, buildTransferFrame } from './broker/transfer.js';
import { Attach } from './broker/attach.js';
import { Player } from './broker/player.js';
import { SecurityRelay } from './broker/security-relay.js';
import { ask } from './ui/ask-window.js';
import { Entries } from './broker/entries.js';
import { Openings } from './broker/openings.js';
import { OpenedFiles } from './explorer/opened-files.js';
import { FilesReading } from './explorer/files-reading.js';
import { createHeavyHint } from './explorer/heavy-hint.js';
import { keyStore } from './shell/stored-choice.js';
import { Pending } from './explorer/pending.js';
import { buildExplorer } from './explorer/explorer-assembly.js';
import { buildDock } from './shell/dock-assembly.js';
import { loadReceived } from './sharing/received-files.js';
import { publicationQuestion, sharedLinkQuestion } from './broker/publication-window.js';
import { ModulesWindow, rowKey } from './apps/modules-window.js';
import { TemplatesControl } from './apps/templates-control.js';
import { DependenciesControl } from './apps/dependencies-control.js';
import { AppContext } from './broker/app-context.js';
import { Refus, ERR, levelOf } from './broker/filter.js';

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
  #told = new AppContext(this); // ce que GFS a dit à l'app active (js/broker/app-context.js)
  #modulesWaiters = [];
  #idleWaiters = []; // ceux qui attendent la fin des écritures des apps installées (`unlock`)
  #reading; // la lecture des fichiers et ce qu'elle dit sous la liste (js/explorer/files-reading.js)

  // env : { grist, router, search, doc }
  constructor({ grist, router, search, doc = document }) {
    Object.assign(this, { grist, router, doc });
    this.status = new AppStatus(this.$('status')); // la phrase d'état de l'app active : l'explorateur la cache tant qu'il recouvre l'app
    this.params = new URLSearchParams(search);
    this.preferences = readPreferences(search);
    // La langue de GFS et de ses apps : le choix de la personne, retenu sur ce navigateur ; à défaut celle de Grist, ou du navigateur (contrats 5.2).
    this.language = new LanguageSetting({ grist: languageOfGrist(this.params.get('language'), navigator.language), store: browserStore(window) });
    this.#useLanguage();
    // Le thème de GFS et de ses apps : l'ambiance et la couleur que la personne a choisies, retenues sur ce navigateur comme la langue (js/theme/theme.js) ;
    // posées sur la page tout de suite, dites à l'app ouverte.
    this.theme = new ThemeSetting(browserStores(window));
    this.themeHost = new ThemeHost({ win: window, setting: this.theme, onMessage: message => { if (this.session) this.session.sendAmbiance(message); } });
    this.themeHost.start();
    this.state = new GristState();
    // Les choix de chaque app (contrats 5.3) : un espace par app dans le navigateur de GFS, jamais dans le document.
    this.appStorage = new AppStorage({ backend: browserBackend(window) });
    // la copie d'une table lourde que l'explorateur lit, rendue à l'app qu'il ouvre (js/broker/table-cache.js) ; son empreinte vient du cadre d'envoi, plus bas
    this.tableCache = new TableCache({ head: () => this.#stateHead() });
    this.port = createPort(grist, this.tableCache);
    this.readonly = this.params.get('readonly') === 'true';
    // Les réglages des apps s'écrivent dans la vue, sans « Enregistrer » (contrats 7.3) : GFS retrouve sa section par son adresse et sa table.
    this.viewOptions = new ViewOptions({
      doc: this.port.doc, widget: this.port.widget, address: addressOf(location.href), tableId: () => (this.state.table ? this.state.table.tableId : null),
      enabled: () => this.fullAccess && !this.readonly, readable: () => this.fullAccess,
    });
    // La section de GFS se relie d'elle-même à la grille de la même table (js/broker/view-link.js, contrats 4.5 point 8) : « La table de la page » suit alors
    // la ligne que la personne clique.
    this.viewLink = new ViewLink({
      doc: this.port.doc, state: this.state, section: () => this.viewOptions.section(), enabled: () => this.fullAccess && !this.readonly &&
        this.params.get('grille') !== '0',
      chosen: () => Boolean(this.workControl && this.workControl.work.choice), mark: value => this.viewOptions.write([[LINK_KEY, value]]),
        say: (key, vars) => this.notice(this.t(key, vars)),
    });
    // Les apps sont servies par leur site en ligne (le porteur, 22/10) ; `?live=0` : la copie figée du sous-module, celle des mesures de GFS.
    this.live = liveSwitch(search);
    // Les noms que le document donne aux tables et aux colonnes des apps (js/apps/doc-names.js) : lus avant chaque lecture des fichiers.
    this.names = new DocNames({ doc: this.port.doc });
    // Les apps installées et leurs extensions : ce que le document retient dans la table `GFS_Rangement` (contrats 7.4), écrit seulement sur un geste de la
    // personne, et la table seulement avec son accord. Cette table apprend aussi à GFS l'adresse de la personne (6.4, point 6) : sans écriture possible, elle
    // reste inconnue.
    this.rangement = new Rangement({ port: this.port, consent: () => this.#askTableConsent(), canWrite: () => !this.writeBlock(),
      onIdentity: () => this.#onIdentity(), appFilings: () => this.manifests().map(appFilingOf).filter(Boolean) });
    this.registry = new AppsState({ store: this.rangement, onChange: () => this.#onRegistryChange() });
    // Ce que l'explorateur et les liens demandent (grisé, types de « Nouveau » et d'« Importer », qui lit un fichier : js/broker/entries.js), et les ouvertures
    // (js/broker/openings.js).
    const entries = new Entries(this);
    Object.assign(this, { lockOf: entries.lockOf, newTypes: entries.newTypes, importTypes: entries.importTypes, readerOf: entries.readerOf });
    this.opened = new OpenedFiles(); // les fichiers que GFS a ouverts dans une app, pour la vue « Ouverts » de l'explorateur (js/explorer/opened-files.js)
    this.openings = new Openings(this);
    this.links = this.#buildLinks();
    // Le cadre d'envoi (js/broker/transfer.js) ne s'ouvre qu'à la première requête : les pièces jointes, et la preuve que la personne est propriétaire
    // (js/rights/rights-reader.js).
    this.transfer = new Transfer({ doc: this.port.doc, base: this.doc.baseURI, createFrame: url => buildTransferFrame(this.doc, url) });
    // la lecture des fichiers d'un document lourd sans ses cellules lourdes (js/explorer/explorer-sql.js) : jeton en lecture seule, éteinte au premier refus
    this.fileReader = createLightReader({ sql: statement => this.transfer.sql(statement),
      warn: error => console.warn('GFS : la lecture légère des fichiers est éteinte pour cette session, l\'explorateur relit les tables en entier', error) });
    this.player = new Player({ container: this.$('frames') }); // le lecteur de vidéos posé par-dessus l'app (contrats 5.2, point 11)
    // `joindre` (contrats 5.4, point 12)
    this.attach = new Attach({ doc: this.port.doc, transfer: this.transfer, session: () => this.session, readonly: () => this.readonly });
    // les appels que la politique d'une app bloque, relayés par le kit (contrats 5.4, point 14), pour la session seulement
    this.relay = new SecurityRelay({ appName: this.appName, t: this.t, notice: text => this.notice(text), now: () => new Date() });
    this.#buildSharing();
    this.pending = new Pending(); // les gestes de rangement affichés avant d'être écrits (js/explorer/pending.js) ; l'explorateur se redessine à chacun
    this.#reading = new FilesReading({
      pending: this.pending, cache: this.tableCache, noteBin: id => { if (this.appFiles) this.appFiles.noteBin(id); }, port: this.port,
        apps: () => this.validApps(), fullAccess: () => this.fullAccess,
        rangement: this.rangement,
        reader: this.fileReader,
        // un document vu lourd à la visite d'avant se lit d'emblée en lecture légère (js/explorer/heavy-hint.js) ; ses tables se lisent derrière la liste
        hint: createHeavyHint({ docId: () => this.port.doc.getDocName(), store: key => keyStore(window, key) }),
      prepare: () => this.names.refresh(this.apps.filter(item => item.ok)),
      explorer: () => this.explorer, openedBar: () => this.openedBar, appName: this.appName, t: this.t, onSpaces: spaces => { this.spaces = spaces; },
      onFiles: files => void this.followFolders(files), onStats: stats => { this.doc.body.dataset.explorerStats = JSON.stringify(stats); },
    });
    this.templates = this.#buildTemplates(entries); // « Nouveau > Depuis un modèle » (js/apps/templates-control.js)
  }

  // La galerie commune des modèles de départ des apps (contrats 5.4, point 13) : ses catalogues se lisent à l'ouverture de la fenêtre, pas au démarrage.
  #buildTemplates(entries) {
    return new TemplatesControl({
      container: this.$('stage'), i18n: this.i18n, inertTargets: this.inertTargets, manifests: this.manifests, entries: entries.templates, readJson,
      unlock: lock => this.unlock(lock), onCreate: entry => this.openings.openTemplate(entry),
    });
  }

  // Le partage entre documents, les droits et le poids : ce que les fenêtres du widget lisent du document (js/sharing/, js/rights/, js/weight/).
  #buildSharing() {
    // Le partage de fichiers avec d'autres documents Grist (js/sharing/share-other.js) : le moteur du kit, son port et les fenêtres ne se chargent qu'au
    // premier besoin.
    this.otherDocuments = createOtherDocuments({
      t: this.t, container: this.$('stage'), inertTargets: this.inertTargets, docApi: () => this.grist.docApi, transfer: this.transfer,
      language: () => this.lang, notice: text => this.notice(text), writeBlock: () => this.writeBlock(),
        files: () => (this.explorer ? this.explorer.files : []),
      following: { follow: (link, path, ids) => this.rangement.follow(link, path, ids), unfollow: (link, path) => this.rangement.unfollow(link, path) },
    });
    // Les dossiers partagés « à jour » (js/share-follow.js) : à chaque lecture des fichiers, la condition du lien suit le contenu du dossier.
    this.followFolders = createFollower({
      rangement: this.rangement, writeBlock: () => this.writeBlock(), isOwner: () => this.transfer.isOwner(), engine: () => this.otherDocuments.engine(),
        docApi: () => this.grist.docApi,
    });
    this.rights = new RightsControl({
      port: this.port, transfer: this.transfer, manifests: this.manifests, now: () => Date.now(), container: this.$('stage'),
      inertTargets: this.inertTargets, t: this.t, fullAccess: () => this.fullAccess, rangement: this.rangement,
      locale: () => this.locale, identity: () => this.identity, writeBlock: () => this.writeBlock(), appName: this.appName, spaces: () => this.spaces,
      other: (file, state) => this.otherDocuments.tab(file, state), otherLinks: () => this.otherDocuments.links(),
        otherStop: link => this.otherDocuments.stop(link), otherNew: () => this.otherDocuments.link(), refresh: () => this.refreshFiles(),
      notice: text => this.notice(text), files: () => this.explorer.files,
    });
    this.weight = new WeightControl({ transfer: this.transfer, container: this.$('stage'), inertTargets: this.inertTargets, t: this.t,
      locale: () => this.locale });
  }

  $ = id => this.doc.getElementById(id);
  t = (key, vars) => this.i18n.t(key, vars);
  // Ce que chaque fenêtre du widget rend inerte tant qu'elle est ouverte : l'explorateur, les cadres des apps, la barre.
  inertTargets = () => [this.explorer.root, this.$('frames'), this.$('floaters')];
  // Les manifestes des apps valides (ce que les fenêtres et les liens lisent à chaque appel).
  manifests = () => this.validApps().map(item => item.manifest);

  // L'app active a demandé son contexte (les ouvertures en ont besoin pour savoir si elle a quelque chose à enregistrer avant de partir).
  get contextServed() { return this.#told.served; }

  // L'adresse de la personne, '' tant que GFS ne la connaît pas : son rangement est alors commun au document (contrats 6.4, point 4).
  get identity() { return this.rangement.identity; }

  // ---------- noms, grisé, types à créer : ce que l'explorateur demande ----------

  // Sous `full`, GFS ne lit pas les tables de fichiers des apps (contrats 3.1, point 2) : l'explorateur le dit au lieu de rendre l'erreur de Grist.
  get fullAccess() { return levelOf(this.state.grantedAccess) >= levelOf('full'); }

  appById(id) { return this.names.adaptItem(this.apps.find(item => item.app.id === id && item.ok) || null); }
  // Le manifeste d'une app installable, ou celui des fichiers que GFS garde lui-même (js/files/gfs-files.js) : null quand l'id n'est ni l'un ni l'autre.
  manifestOf = id => (id === FILES_APP ? FILES_MANIFEST : (this.appById(id) || { manifest: null }).manifest);
  appName = id => { const manifest = this.manifestOf(id); return manifest ? label(manifest.nom, this.lang) : id; };
  validApps() { return this.apps.filter(item => item.ok).map(item => this.names.adaptItem(item)); }
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
    // la lecture part avec celles des manifestes : un seul aller-retour de réseau pour les deux (elle ne dépend d'aucun manifeste)
    const libraries = this.#loadLibraries();
    this.apps = await loadAll(CATALOGUE, readJson);
    this.registry.setApps(this.apps);
    this.registry.setCatalogue(await libraries);
    await this.state.whenOptions();
    // L'adresse de la personne s'apprend pendant que le reste se lit : la sonde coûte plusieurs allers-retours de réseau, et la liste des fichiers n'en a
    // besoin qu'au moment de ranger (js/explorer/explorer-data.js). Une app qui s'ouvre d'emblée, et « prêt », l'attendent.
    const identified = this.fullAccess ? this.rangement.identify() : Promise.resolve('');
    if (this.fullAccess) await this.registry.load();
    if (isNewer(this.registry.structure)) this.notice(this.t('doc.newer'));
    buildExplorer(this);
    buildDock(this);
    const arrived = await this.#arrive(identified);
    await identified;
    doc.body.dataset.gfs = 'ready';
    if (!arrived) await this.#firstRun(); // une section qui s'ouvre sur son app n'est pas neuve : la fenêtre des apps ne passe pas par-dessus
    doc.body.dataset.gfsFirstRun = 'done';
    void this.state.whenTable().then(() => this.viewLink.ensure());
    // Un envoi laissé en route, ou un partage reçu dont le contenu arrive encore : les boucles du moteur reprennent d'où elles en étaient
    // (js/sharing/sync-resume.js ; rien ne se charge sans table de partage).
    whenReceived(() => void this.#refreshReceived());
    if (!this.writeBlock()) void resumeSharing({ docApi: this.grist.docApi, transfer: this.transfer, language: () => this.lang, busy: () => false,
      isOwner: () => this.transfer.isOwner() }).catch(error => console.warn('GFS : le partage entre documents ne reprend pas', error));
  }

  // L'arrivée (cahier 6.2, point 2 ; js/broker/arrival.js) : une section qui servait à une app s'ouvre sur elle, sans consigne et sans rien écrire ; sinon
  // l'explorateur. Les réglages de la section parlent d'abord ; sans eux, la table d'une app qui garde sa vue dans le document (`arrivee` du manifeste) dit si
  // la section est la sienne (js/broker/arrival-table.js). Rend `true` si une app s'est ouverte.
  async #arrive(identified) {
    const manifests = this.manifests();
    const rules = { installed: appId => this.registry.has(appId), granted: this.state.grantedAccess };
    let id = arrivalApp(this.state.allOptions, manifests, rules);
    const probes = id ? [] : arrivalProbes(this.state.allOptions, manifests, rules);
    if (probes.length) {
      const table = await this.state.whenTable();
      if (table) id = await arrivalTableApp(this.port.doc, probes, table.tableId);
    }
    if (id) await identified; // l'app reçoit l'adresse de la personne dans son contexte (contrats 5.2, point 9)
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

  // Les liens entre apps (js/broker/links.js, contrats 5.4) : ce que le contrôleur prête à `choisir` et `ouvrir`, appelés par une app.
  #buildLinks() {
    return new AppLinks({
      explorer: () => this.explorer, session: () => this.session, manifests: this.manifests, appById: id => this.appById(id), appName: this.appName,
      fullAccess: () => this.fullAccess, t: this.t, notice: text => this.notice(text), lockOf: this.lockOf, unlock: lock => this.unlock(lock),
      showExplorer: () => this.showExplorer(), hideExplorer: () => this.hideExplorer(),
        loadFiles: async apps => {
          await this.names.refresh(this.apps.filter(item => item.ok));
          return loadFiles(this.port, apps.map(item => this.appById(item.app.id) || item), this.rangement.learning, this.fileReader);
        },
      openIn: (appId, opening) => this.openings.openIn(appId, opening, 'ex.notice.open'),
    });
  }

  // ---------- la langue ----------

  // Pose la langue qui vaut : les textes, les noms d'apps, le format des dates de GFS.
  #useLanguage() {
    this.i18n = createI18n(this.language.language);
    this.lang = this.i18n.lang;
    this.locale = localeFor({ culture: this.preferences.culture, language: this.lang, grist: this.language.grist });
  }

  // Les paramètres de Grist que les apps reçoivent (adresse du cadre, `contexte`) : ceux de Grist, sauf la langue, qui est celle que la personne a choisie dans
  // GFS.
  appPreferences() { return { ...this.preferences, language: this.lang }; }

  // La personne choisit la langue de GFS et de ses apps. Si le navigateur refuse de la retenir, elle vaut pour cette page, et GFS le dit (dans la langue
  // choisie).
  chooseLanguage(choice) {
    if (!this.language.choose(choice)) this.notice(this.t('lang.notKept'));
  }

  // La langue qui vaut a changé (un geste, ou un autre onglet de la personne) : tout ce que GFS écrit se redit dans la nouvelle langue, et l'app ouverte est
  // prévenue (contrats 5.2, points 2 et 6) sans que son cadre soit touché. Choisir la langue que Grist donne déjà ne change rien : les apps n'ont rien à
  // apprendre.
  #onLanguage({ languageChanged }) {
    if (!languageChanged) return;
    this.#useLanguage();
    this.doc.documentElement.lang = this.lang;
    if (!this.explorer) return; // le démarrage n'a pas encore construit le cadre : il le fera dans cette langue
    const live = { i18n: this.i18n, locale: this.locale };
    this.explorer.relocalize(live);
    if (this.modulesWindow) this.modulesWindow.relocalize(live);
    if (this.themeWindow) this.themeWindow.relocalize(live);
    this.templates.relocalize(live);
    if (this.annuaire) this.annuaire.relocalize();
    this.dock.relabel(this.t);
    this.workControl.relabel();
    this.#reading.show();
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
    this.rights.resume(this.explorer);
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

  // L'empreinte de l'état du document (`GET /states`, le dernier : elle change à chaque écriture, de qui qu'elle vienne) ; rien quand le serveur ne la rend
  // pas.
  async #stateHead() {
    const { body } = await this.transfer.rest('GET', '/states', { writable: false, params: { limit: 1 } });
    const [state] = (body && body.states) || [];
    return state && typeof state.h === 'string' ? state.h : null;
  }

  // Une seule lecture des fichiers fait foi, la dernière lancée (js/explorer/files-reading.js). `quiet` : sans « Lecture des fichiers… ».
  refreshFiles(opts) {
    return this.#reading.refresh(opts);
  }

  // ---------- la fenêtre « Thème » ----------

  // La ligne « Thème » du menu « Réglages » de l'explorateur : l'ambiance et la couleur de GFS et de ses apps (js/theme/theme-window.js). La fenêtre suit le
  // mode de la page : ses vignettes se repeignent quand Grist passe du clair au sombre.
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

  // La ligne « Dépendances… » du menu « Réglages » : la fenêtre des bibliothèques que GFS sert, avec le choix de leur source et l'export du rapport
  // (js/apps/dependencies-control.js).
  openDependencies() {
    this.dependencies ??= new DependenciesControl({ container: this.$('stage'), inertTargets: this.inertTargets, t: this.t, locale: () => this.locale,
      lang: () => this.lang,
      base: this.doc.baseURI, model: () => this.registry.model(), catalogue: () => this.registry.catalogue, readJson, relay: () => this.relay.snapshot(),
      readBytes: async address => (await readFile(address)).arrayBuffer(), blocked: () => this.writeBlock(), ask: opts => this.ask(opts), doc: this.doc,
      apply: (plan, mode) => Promise.all(plan.map(({ app, extensions, natives }) =>
        this.#saved(this.registry.setSources(app, { extensions, natives }, mode)))) });
    void this.dependencies.open();
  }

  // ---------- la fenêtre « Apps et extensions » ----------

  // La fenêtre s'ouvre ; la promesse se tient jusqu'à sa fermeture (l'appel `installer` de l'app attend le choix de la personne, 5.4).
  openModules({ focus = null } = {}) {
    if (this.themeWindow) this.themeWindow.close(); // une seule fenêtre à la fois : celle des apps passe devant
    if (!this.modulesWindow) this.modulesWindow = this.#buildModules();
    this.modulesWindow.open({ focus });
    return new Promise(resolve => this.#modulesWaiters.push(resolve));
  }

  // L'écriture d'un choix sur les apps : un refus (la table, une règle d'accès) se dit à la personne, il ne casse rien (l'état revient à ce que la table dit).
  #saved(pending) {
    return pending.catch(error => {
      if (error instanceof TableDeclined) { this.notice(this.t('table.declined')); return; }
      console.error('GFS : enregistrement des apps impossible', error);
      this.notice(this.t('gfs.settingsFailed', { reason: String(error && error.message) }));
    });
  }

  #buildModules() {
    const change = pending => this.#saved(pending);
    return new ModulesWindow({
      container: this.$('stage'), i18n: this.i18n, locale: this.locale, model: () => this.registry.model(), blocked: () => this.writeBlock(),
      inertTargets: this.inertTargets,
      on: {
        app: (id, on) => change(this.registry.setApp(id, on)),
        extension: (app, id, on) => change(this.registry.setExtension(app, id, on)),
        mode: (app, id, mode) => change(this.registry.setMode(app, id, mode)),
        nativeMode: (app, group, mode) => change(this.registry.setNativeMode(app, group, mode)),
        open: id => this.#openApp(id),
      },
      onClose: () => this.#modulesWaiters.splice(0).forEach(resolve => resolve()),
    });
  }

  // Pourquoi rien ne peut s'enregistrer (contrats 7.4, point 5), ou null : le document est en lecture seule, GFS n'a pas l'accès complet, ou une version plus
  // récente de GFS a préparé le document (contrats 6.4, point 16 : GFS lit, n'écrit pas). Une écriture que Grist refuse malgré tout (une règle d'accès) revient
  // par l'avis de `change`.
  writeBlock() {
    if (this.readonly) return this.t('mod.readonly');
    if (!this.fullAccess) return this.t('mod.needsAccess');
    return this.registry && isNewer(this.registry.structure) ? this.t('doc.newer') : null;
  }

  // La table n'existe pas encore : la personne décide de la créer (contrats 6.2, point 1). Une fenêtre du widget, au-dessus de celle des apps.
  #askTableConsent() {
    return this.ask({ title: this.t('table.title'), message: this.t('table.text'), confirmLabel: this.t('table.create'), cancelLabel: this.t('table.cancel') });
  }

  // Une app publie un formulaire (contrats 3.3, point 9) : la personne dit si le lien peut ouvrir ce que le lot ouvre.
  #askPublication(manifest, opens) {
    const app = label(manifest.nom, this.lang);
    return this.ask(opens.sharedLink ? sharedLinkQuestion({ t: this.t, app, shared: opens.sharedLink }) : publicationQuestion({ t: this.t, app, opens }));
  }

  // Une fenêtre du widget au-dessus de tout ce qui est ouvert (charte : jamais `confirm()`).
  ask(opts) {
    // Les fenêtres déjà ouvertes (leurs voiles, relevés avant que la question monte) deviennent inertes à leur tour : « Dépendances », « Apps et extensions ».
    const above = [...(this.modulesWindow && this.modulesWindow.element ? [this.modulesWindow.element] : []),
      ...this.$('stage').querySelectorAll('.mod-scrim')];
    return ask({ ...opts, container: this.$('stage'), inertTargets: () => [this.explorer.root, this.$('frames'), this.$('floaters'), ...new Set(above)] });
  }

  // La troisième porte : une section qui n'a encore rien retenu ouvre la fenêtre une fois, pour qu'on y choisisse ses apps (maquette du 12/10).
  // « Une fois » se retient par document, dans le navigateur ; sans stockage, la fenêtre reste atteignable par les deux autres portes.
  async #firstRun() {
    if (this.registry.stored || this.readonly) return;
    const facts = await this.#told.readFacts();
    if (!facts.document) return;
    const key = `${FIRST_RUN_KEY}${facts.document}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch (error) { return; }
    void this.openModules();
  }

  // Un passage de la boucle qui reçoit a changé quelque chose (js/sharing/sync-service.js) : « Partagés avec moi » et la cloche se mettent à jour, sans relire
  // le reste, et seulement explorateur ouvert (à l'ouverture, la liste se relit de toute façon).
  async #refreshReceived() {
    if (!this.explorer || !this.explorer.isOpen || !this.fullAccess) return;
    try { this.explorer.setReceived(await loadReceived(this.port, (await this.port.doc.listTables()).map(String))); }
      catch (error) { console.warn('GFS : les arrivées ne se relisent pas', error); }
  }

  // GFS vient d'apprendre l'adresse de la personne (la table est née pendant la session) : sa liste de fichiers se relit avec son propre rangement.
  // Sauf la lecture qui l'attend en ce moment : elle range déjà avec cette adresse (la relancer jetterait ce qu'elle a lu).
  #onIdentity() {
    if (this.explorer && this.explorer.isOpen && !this.#reading.waitingForIdentity) void this.refreshFiles();
    this.#told.pushIdentity();
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
      this.closeSession();
      this.showExplorer();
    } else if (this.session) {
      this.#told.pushExtensions();
    }
  }

  closeSession() {
    this.status.say('');
    this.links.drop(); // l'app qui demandait un choix n'est plus là
    this.dock.mask(false);
    this.session.close();
    this.session = null;
    this.#told.reset();
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

  #envelopeHandlers(session) {
    return {
      contexte: () => this.#told.contextFor(session),
      installer: args => this.#install(session, args),
      ...ownSectionHandlers({ locate: () => this.viewOptions.locate() }),
      ...storageHandlers(this.appStorage, session.id),
      ...this.dock.handlers(session.id),
      ...this.links.handlers(session),
      ...this.kept.handlers(session),
      ...this.attach.handlers(session),
      ...this.player.handlers(session),
      ...this.relay.handlers(session),
    };
  }

  // L'appel `installer` (5.4, point 4) : la fenêtre s'ouvre sur la ligne de l'extension, rien ne se télécharge ; la réponse dit les extensions
  // actives après le choix de la personne.
  async #install(session, args) {
    const wanted = typeof args.extension === 'string' ? args.extension : '';
    if (!extensionsOf(session.manifest).some(item => item.id === wanted)) throw new Refus(ERR.REFUSE,
      `L'extension « ${wanted} » n'est pas déclarée dans le manifeste de l'app.`);
    await this.openModules({ focus: rowKey(session.id, wanted) });
    return { actives: this.registry.extensionsFor(session.id, this.doc.baseURI).extensions };
  }

  // ---------- ouvrir ----------

  // Un clic sur du grisé : la fenêtre qui le débloque s'ouvre sur sa ligne, ou, quand il n'y a rien à débloquer ici, la raison est dite. La promesse se tient
  // jusqu'à la fermeture de la fenêtre et à la fin des écritures qu'elle a lancées : l'appel `ouvrir` d'une app attend que la personne ait fini (contrats 5.4,
  // point 7).
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
    if (this.session) this.closeSession();
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
      container: this.$('frames'), readonly: this.readonly, preferences: this.appPreferences(), copies: this.registry.copiesFor(app.app.id),
        base: this.doc.baseURI, live: this.live, lang: this.lang, onStatus: (kind, current) => this.#onStatus(kind, current),
      envelopeHandlers: session => this.#envelopeHandlers(session), authorize: (manifest, opens) => this.#askPublication(manifest, opens),
        viewOptions: this.viewOptions,
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
  hideNotice() {
    clearTimeout(this.#noticeTimer);
    this.$('toast').hidden = true;
  }
}
