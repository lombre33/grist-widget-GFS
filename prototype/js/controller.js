// Le contrôleur de GFS (contrats 4.1, cahier 6) : le démarrage, l'explorateur, l'app active et le passage de l'un à l'autre.
// Deux lieux dans le cadre : l'explorateur (qui remplace le cadre) et le fichier ouvert (le sous-cadre de l'app, resté vivant et caché quand on explore).

import { CATALOGUE } from './catalogue.js';
import { loadAll, label } from './manifest.js';
import { GristState } from './state.js';
import { createPort } from './broker.js';
import { AppSession } from './session.js';
import { readPreferences } from './frames.js';
import { createI18n } from './i18n.js';
import { LanguageSetting, browserStore, languageOfGrist, localeFor, watchStorage } from './language.js';
import { AppStorage, browserBackend, storageHandlers } from './app-storage.js';
import { installSprite } from './icons.js';
import { Dock } from './dock.js';
import { WorkControl } from './work-control.js';
import { Explorer } from './explorer.js';
import { loadFiles } from './explorer-data.js';
import { Filing } from './filing.js';
import { askName, chooseFolder } from './filing-window.js';
import { readCatalogue } from './libraries.js';
import { activeExtensionIds, extensionsOf } from './extensions.js';
import { AppsState } from './apps-state.js';
import { Rangement, TableDeclined } from './rangement.js';
import { ask } from './ask-window.js';
import { ModulesWindow, rowKey } from './modules-window.js';
import { buildContext, instanceOf, pageOf } from './context.js';
import { Refus, ERR, levelOf } from './filter.js';
import { loadDemo, readSchema, planDemo, runDemo, demoSummary, demoReport, DemoError } from './demo.js';

const NOTICE_MS = 6000;

// Provisoire : ce que chaque app sait faire d'une ouverture. `fichier` : ouvrir le fichier désigné, au démarrage (`ouverture` du contexte) comme déjà ouverte (appel `ouvrir`), consigne 010 ;
// `nouveau` : créer un fichier vierge du type demandé (contrats 5.4, point 1), consigne 014 (Publipostage+ depuis bfbe112). Ce qu'une app ne sait pas, GFS ouvre l'app sur son modèle habituel et le dit.
// Une app qui le sait passe à `true` ici (puis la ligne disparaît avec le catalogue provisoire).
const ACCEPTS_OPEN = Object.freeze({ publipostage: { fichier: true, nouveau: true }, automation: { fichier: false, nouveau: false } });

// Provisoire (étape 2) : les apps qui ne se retirent pas, comme dans la maquette (Publipostage+ ne se décoche pas).
export const ALWAYS_ON = Object.freeze(['publipostage']);

const LIBRARIES_PATH = 'bibliotheques/catalogue.json';
const FIRST_RUN_KEY = 'gfs.premier-lancement.';

const readFile = async path => {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path} : ${response.status}`);
  return response;
};
const readJson = async path => (await readFile(path)).json();
const readText = async path => (await readFile(path)).text();

export class GfsController {
  apps = [];
  session = null;
  explorer = null;
  modulesWindow = null;
  // L'adresse de la personne, '' tant que GFS ne la lit pas : son rangement est alors commun au document (contrats 6.4, point 4).
  identity = '';
  #noticeTimer = null;
  #facts = null;
  #sentExtensions = null;
  #contextServed = false; // l'app active a demandé son contexte : elle a lu l'ouverture qui s'y trouvait, et ne la relira pas
  #consented = false; // la démo a déjà l'accord de la personne pour les tables qu'elle crée, dont GFS_Rangement : pas de seconde question
  #modulesWaiters = [];
  #fileStatus = { loading: false, restricted: false, problems: [] }; // ce que l'explorateur dit sous la liste, gardé pour être redit dans la langue qui vaut

  // env : { grist, router, search, doc }
  constructor({ grist, router, search, doc = document }) {
    this.grist = grist;
    this.router = router;
    this.doc = doc;
    this.params = new URLSearchParams(search);
    this.preferences = readPreferences(search);
    // La langue de GFS et de ses apps : le choix de la personne, retenu sur ce navigateur ; à défaut celle de Grist, ou du navigateur (contrats 5.2).
    this.language = new LanguageSetting({ grist: languageOfGrist(this.params.get('language'), navigator.language), store: browserStore(window) });
    this.#useLanguage();
    this.state = new GristState();
    // Les choix de chaque app (contrats 5.3) : un espace par app dans le navigateur de GFS, jamais dans le document.
    this.appStorage = new AppStorage({ backend: browserBackend(window) });
    this.port = createPort(grist);
    this.readonly = this.params.get('readonly') === 'true';
    // Le mode développement (`?dev` dans l'adresse du widget, comme la galerie de développement de Publipostage+) : le bouton « Démo » de l'explorateur.
    this.devMode = this.params.has('dev');
    // Les apps installées et leurs extensions : ce que le document retient dans la table `GFS_Rangement` (contrats 7.4), écrit seulement sur un geste
    // de la personne, et la table seulement avec son accord.
    this.rangement = new Rangement({ port: this.port, consent: () => this.#askTableConsent() });
    this.registry = new AppsState({ always: ALWAYS_ON, store: this.rangement, onChange: () => this.#onRegistryChange() });
  }

  $ = id => this.doc.getElementById(id);
  t = (key, vars) => this.i18n.t(key, vars);

  // ---------- noms, grisé, types à créer : ce que l'explorateur demande ----------

  // Sous `full`, GFS ne lit pas les tables de fichiers des apps (contrats 3.1, point 2) : l'explorateur le dit au lieu de rendre l'erreur de Grist.
  get fullAccess() { return levelOf(this.state.grantedAccess) >= levelOf('full'); }

  appById(id) { return this.apps.find(item => item.app.id === id && item.ok) || null; }
  appName = id => { const app = this.appById(id); return app ? label(app.manifest.nom, this.lang) : id; };
  validApps() { return this.apps.filter(item => item.ok); }
  typeLabel = file => (file.typeInfo ? label(file.typeInfo.nom, this.lang) : (file.type || '—'));

  // Grisé, jamais masqué (charte) : un fichier d'une app non installée, un type absent du manifeste, un type d'une extension non active sont listés
  // avec la raison (contrats 5.4, point 1, et 6.5, point 3). `focus` : la ligne de la fenêtre « Apps et extensions » qui le débloque, s'il y en a une.
  lockOf = file => {
    if (!this.fullAccess) return { text: this.t('gfs.needsFullAccess'), hint: this.t('gfs.needsFullAccessHint') };
    if (!this.registry.has(file.app)) return { text: this.t('ex.lockedApp', { app: this.appName(file.app) }), focus: rowKey(file.app) };
    if (!file.known) return { text: this.t('ex.lockedType', { app: this.appName(file.app) }) };
    const extension = file.typeInfo.extension;
    if (extension && !this.isExtensionActive(file.app, extension)) {
      const entry = extensionsOf(this.registry.manifest(file.app)).find(item => item.id === extension);
      return { text: this.t('ex.lockedExtension', { name: entry ? label(entry.nom, this.lang) : extension }), focus: rowKey(file.app, extension) };
    }
    return null;
  };

  isExtensionActive = (appId, extensionId) => activeExtensionIds(this.registry.manifest(appId), this.registry.apps[appId], this.registry.catalogue).includes(extensionId);

  // Le menu « Nouveau » : un article par type que l'app sait ouvrir (`actions.ouvrir`), le nom de l'app quand il y en a plusieurs.
  newTypes = () => {
    const several = this.registry.installedIds().length > 1;
    const entries = [];
    for (const { manifest } of this.validApps()) {
      const canOpen = new Set((manifest.actions && manifest.actions.ouvrir) || []);
      for (const spec of manifest.fichiers || []) {
        for (const type of spec.types || []) {
          if (canOpen.has(type.valeur)) entries.push(this.#newEntry(manifest, type, several));
        }
      }
    }
    return entries;
  };

  // Un article du menu « Nouveau » : grisé avec sa raison (`reason`, dite au clic) et son rappel court (`hint`, sous le nom).
  #newEntry(manifest, type, several) {
    const lock = this.lockOf({ app: manifest.id, known: true, typeInfo: type });
    return {
      app: manifest.id, type: type.valeur, label: label(type.nom, this.lang), icon: type.icone || 'doc', family: lock ? null : ({ document: 'doc', grille: 'grid', presentation: 'slides' })[type.couleur] || null,
      greyed: Boolean(lock), focus: lock ? lock.focus : null, hint: lock ? (lock.hint || lock.text) : (several ? label(manifest.nom, this.lang) : ''), reason: lock ? lock.text : '',
    };
  }

  // ---------- démarrage ----------

  async start() {
    const { doc } = this;
    if (window.parent === window) { this.#setStatus(this.t('gfs.noGrist'), true); doc.body.dataset.gfs = 'standalone'; return; }
    installSprite(doc);
    doc.documentElement.lang = this.lang;
    this.language.onChange(event => this.#onLanguage(event));
    watchStorage(this.language);
    this.grist.on('message', message => this.state.feed(message));
    this.grist.ready({ requiredAccess: 'full', onEditOptions: () => this.onEditOptions() });
    this.#installPrint();
    this.apps = await loadAll(CATALOGUE, readJson);
    this.registry.setApps(this.apps);
    this.registry.setCatalogue(await this.#loadLibraries());
    await this.state.whenOptions();
    if (this.fullAccess) await this.registry.load();
    this.#buildExplorer();
    this.#buildDock();
    this.showExplorer();
    doc.body.dataset.gfs = 'ready';
    await this.#firstRun();
    doc.body.dataset.gfsFirstRun = 'done';
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
    this.explorer = new Explorer({
      container: this.$('stage'), i18n: this.i18n, locale: this.locale, now: () => new Date(), appName: this.appName, typeLabel: this.typeLabel, lockOf: this.lockOf,
      newTypes: this.newTypes, canClose: () => Boolean(this.session), notice: text => this.notice(text),
      language: () => ({ choice: this.language.choice, grist: this.language.grist }), onLanguage: choice => this.#chooseLanguage(choice),
      onOpen: file => this.#openFile(file), onNew: entry => this.#openNew(entry), onClose: () => this.hideExplorer(), onApps: () => void this.openModules(),
      personal: () => Boolean(this.identity), filing: this.#buildFiling(), onDemo: this.devMode ? () => void this.#runDemo() : null,
    });
  }

  // Épingler, renommer, déplacer depuis l'explorateur (js/filing.js) : les fenêtres du widget par-dessus l'explorateur, et la liste relue après chaque geste.
  #buildFiling() {
    const layer = opts => ({ ...opts, t: this.t, container: this.$('stage'), inertTargets: () => [this.explorer.root, this.$('frames'), this.$('floaters')] });
    return new Filing({
      port: this.port, rangement: this.rangement, t: this.t, locale: () => this.locale, identity: () => this.identity, files: () => this.explorer.files, appName: this.appName,
      here: () => (this.explorer.state.view === 'folder' ? this.explorer.state.path : ''), writeBlock: () => this.#writeBlock(), notice: text => this.notice(text),
      specOf: file => ((this.appById(file.app) || { manifest: {} }).manifest.fichiers || []).find(spec => spec.table === file.table) || null,
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
      port: this.port, state: this.state, dock: this.dock, container: this.$('stage'), t: this.t, appName: this.appName, manifests: () => this.validApps().map(item => item.manifest),
      session: () => this.session, inertTargets: () => [this.explorer.root, this.$('frames'), this.$('floaters')], notice: text => this.notice(text),
      reopen: id => { this.#closeSession(); this.#activate(id, this.opening); }, hidden: () => this.doc.hidden,
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
    this.dock.relabel(this.t);
    this.workControl.relabel();
    this.#showFileStatus();
    if (this.session) this.session.sendLanguage(this.lang);
  }

  // ---------- les deux lieux ----------

  showExplorer() {
    this.$('frames').inert = true;
    this.dock.setPresent(false);
    if (this.session) this.session.show(false);
    this.explorer.open();
    void this.refreshFiles();
  }

  hideExplorer() {
    this.explorer.close();
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
      const { files, problems, stats } = await loadFiles(this.port, this.validApps(), this.identity);
      this.explorer.setFiles(files);
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

  // ---------- la fenêtre « Apps et extensions » ----------

  // La fenêtre s'ouvre ; la promesse se tient jusqu'à sa fermeture (l'appel `installer` de l'app attend le choix de la personne, 5.4).
  openModules({ focus = null } = {}) {
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
      inertTargets: () => [this.explorer.root, this.$('frames'), this.$('floaters')],
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
    if (this.#consented) return Promise.resolve(true);
    return this.#ask({ title: this.t('table.title'), message: this.t('table.text'), confirmLabel: this.t('table.create'), cancelLabel: this.t('table.cancel') });
  }

  // Une fenêtre du widget au-dessus de tout ce qui est ouvert (charte : jamais `confirm()`).
  #ask(opts) {
    const above = this.modulesWindow && this.modulesWindow.element ? [this.modulesWindow.element] : [];
    return ask({ ...opts, container: this.$('stage'), inertTargets: () => [this.explorer.root, this.$('frames'), this.$('floaters'), ...above] });
  }

  // ---------- la démo (mode développement) ----------

  // Le bouton « Démo » : le parcours des inscriptions posé en un geste, après l'accord de la personne (js/demo.js). `data-demo` dit où il en est : les essais du labo l'attendent.
  async #runDemo() {
    const blocked = this.#writeBlock();
    if (blocked) { this.notice(blocked); return; }
    const say = state => { this.doc.body.dataset.demo = state; };
    try {
      const pack = await loadDemo({ json: readJson, text: readText });
      const plan = planDemo(pack, await readSchema(this.port.doc));
      if (plan.taken.length) { this.notice(this.t('demo.taken', { tables: plan.taken.join(', ') })); return; }
      const items = demoSummary(pack, plan, this.t);
      if (!(await this.#ask({ title: this.t('demo.title'), message: this.t('demo.text'), items, confirmLabel: this.t('demo.create'), cancelLabel: this.t('table.cancel') }))) return;
      say('busy');
      this.notice(this.t('demo.busy'));
      this.#consented = true;
      const address = `${location.origin}${location.pathname}`;
      const report = await runDemo({ doc: this.port.doc, pack, now: new Date(), install: ids => this.#installAll(ids), address });
      say('done');
      this.#hideNotice();
      void this.refreshFiles();
      await this.#ask({ title: this.t('demo.doneTitle'), message: this.t('demo.doneText'), items: demoReport(report, this.t), confirmLabel: this.t('demo.close') });
    } catch (error) {
      say('failed');
      if (error instanceof DemoError && error.code === 'taken') { this.notice(this.t('demo.taken', { tables: error.detail })); return; }
      console.error('GFS : la démo n’a pas pu être posée', error);
      this.notice(this.t('demo.failed', { reason: String(error && error.message) }));
    } finally {
      this.#consented = false;
    }
  }

  async #installAll(ids) {
    for (const id of ids) await this.registry.setApp(id, true);
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

  // Un changement des apps installées (un geste, ou le retour à ce que la table dit) : tout ce qui en dépend se met à jour.
  // `data-registry` dit si une écriture est en cours : les essais du labo l'attendent.
  #onRegistryChange() {
    this.doc.body.dataset.registry = this.registry.busy ? 'busy' : 'idle';
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
    this.dock.mask(false);
    this.session.close();
    this.session = null;
    this.#sentExtensions = null;
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
  #openApp(id) {
    const app = this.appById(id);
    if (app && levelOf(app.manifest.permissions.acces) > levelOf(this.state.grantedAccess)) { this.notice(this.t('gfs.needsFullAccess')); return; }
    if (!this.#activate(id, null)) return;
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
    };
  }

  async #contextFor(session) {
    this.dock.mask(false); // un cadre qui redemande son contexte repart avec la barre (contrats 5.2, point 7)
    const opening = this.#takeOpening(session);
    const given = this.registry.extensionsFor(session.id, this.doc.baseURI);
    this.#sentExtensions = JSON.stringify([given.extensions, given.bibliotheques]);
    const facts = await this.#readFacts();
    const storage = this.appStorage.read(session.id);
    return buildContext(facts, { access: session.access, extensions: given.extensions, libraries: given.bibliotheques, opening, storage, bar: this.dock.barre() }, { preferences: this.#appPreferences(), readonly: this.readonly });
  }

  // L'ouverture n'est rendue qu'au premier `contexte` de l'app qui vient d'être activée (contrats 5.2, point 3) : une app dont le cadre est rechargé sur place (sa langue, un
  // réglage qui le demande) retrouve son ordre habituel, au lieu de refaire un « Nouveau » déjà fait ou de rouvrir le modèle du dernier clic. Une app déjà ouverte reçoit l'appel `ouvrir`.
  #takeOpening(session) {
    if (session !== this.session) return null;
    const opening = this.#contextServed ? null : this.opening;
    this.#contextServed = true;
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

  // Un clic sur du grisé : la fenêtre qui le débloque s'ouvre sur sa ligne, ou, quand il n'y a rien à débloquer ici, la raison est dite.
  #greyedClick(lock) {
    if (lock.focus) void this.openModules({ focus: lock.focus });
    else this.notice(lock.text);
  }

  #openFile(file) {
    const lock = this.lockOf(file);
    if (lock) { this.#greyedClick(lock); return; }
    if (!this.appById(file.app)) { this.notice(this.t('ex.notice.noApp')); return; }
    this.#openIn(file.app, { fichier: { id: file.id, type: file.type }, type: file.type, dossier: this.explorer.state.path, raison: 'explorateur' }, 'ex.notice.open');
  }

  #openNew(entry) {
    if (entry.greyed) { this.#greyedClick({ text: entry.reason || entry.hint, focus: entry.focus }); return; }
    this.#openIn(entry.app, { fichier: null, type: entry.type, dossier: this.explorer.state.path, raison: 'nouveau' }, 'ex.notice.new');
  }

  #openIn(appId, opening, noticeKey) {
    // L'app déjà ouverte a lu son contexte : elle n'y relira pas l'ouverture, GFS la lui dit par l'appel `ouvrir` (contrats 5.4, point 1).
    // Sinon (une autre app, ou celle-ci qui démarre) l'ouverture part dans le contexte qu'elle va demander.
    const running = Boolean(this.session) && this.session.id === appId && this.#contextServed;
    if (!this.#activate(appId, opening)) return;
    this.hideExplorer();
    const knows = ACCEPTS_OPEN[appId] && ACCEPTS_OPEN[appId][opening.fichier ? 'fichier' : 'nouveau']; // ouvrir un fichier précis, ou en créer un vierge (« Nouveau »)
    if (!knows) this.notice(this.t(noticeKey, { app: this.appName(appId) }));
    else if (running) void this.#askToOpen(this.session, opening, noticeKey);
  }

  // L'app ouvre le fichier elle-même, après sa propre question d'enregistrement : `{ ouvert: false }` veut dire que la personne a annulé, GFS n'ajoute rien.
  // Une app qui ne connaît pas l'appel (GFS_INCONNU) reçoit la phrase provisoire ; une autre erreur est dite avec son texte.
  async #askToOpen(session, opening, noticeKey) {
    try {
      await session.openFile(opening);
    } catch (error) {
      if (session !== this.session) return; // l'app a été fermée ou remplacée pendant l'attente : plus rien à dire
      const app = this.appName(session.id);
      if (error && error.code === ERR.INCONNU) this.notice(this.t(noticeKey, { app }));
      else this.notice(this.t('ex.notice.openFailed', { app, reason: String((error && error.message) || '').slice(0, 120) }));
    }
  }

  // Active l'app : la même reste en place, une autre remplace l'app active (une seule à la fois, contrats 1.4).
  #activate(id, opening) {
    const app = this.appById(id);
    if (!app || !this.registry.has(id)) return false;
    this.opening = opening;
    if (this.session && this.session.id === id) return true;
    if (this.session) this.#closeSession();
    this.session = new AppSession(this.#sessionContext(app));
    this.session.open();
    return true;
  }

  #sessionContext(app) {
    const { state, port } = this.workControl.sourceFor(app.manifest);
    return {
      entry: app.app, manifest: app.manifest, catalogue: this.apps.filter(item => item.ok).map(item => item.manifest), state, port, router: this.router,
      container: this.$('frames'), readonly: this.readonly, preferences: this.#appPreferences(), base: this.doc.baseURI, lang: this.lang, onStatus: (kind, current) => this.#onStatus(kind, current),
      envelopeHandlers: session => this.#envelopeHandlers(session),
    };
  }

  // ---------- phrases d'état ----------

  #onStatus(kind, current) {
    const app = label(current.manifest.nom, this.lang);
    this.doc.body.dataset.appStatus = kind;
    if (kind === 'loading') this.#setStatus(this.t('gfs.loading', { app }));
    else if (kind === 'timeout') this.#setStatus(this.t('gfs.timeout', { app }), true);
    else this.#setStatus('');
  }

  #setStatus(text, bad = false) {
    const el = this.$('status');
    el.hidden = !text;
    el.textContent = text || '';
    el.classList.toggle('status--bad', Boolean(bad));
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
