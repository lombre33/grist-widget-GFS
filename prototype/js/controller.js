// Le contrôleur de GFS (contrats 4.1, cahier 6) : le démarrage, l'explorateur, l'app active et le passage de l'un à l'autre.
// Deux lieux dans le cadre : l'explorateur (qui remplace le cadre) et le fichier ouvert (le sous-cadre de l'app, resté vivant et caché quand on explore).

import { CATALOGUE, catalogueEntry } from './catalogue.js';
import { loadAll, label } from './manifest.js';
import { GristState } from './state.js';
import { createPort } from './broker.js';
import { AppSession } from './session.js';
import { readPreferences } from './frames.js';
import { createI18n } from './i18n.js';
import { installSprite, icon } from './icons.js';
import { Explorer } from './explorer.js';
import { loadFiles } from './explorer-data.js';
import { readCatalogue } from './libraries.js';
import { activeExtensionIds, extensionsOf } from './extensions.js';
import { AppsState } from './apps-state.js';
import { ModulesWindow, rowKey } from './modules-window.js';
import { buildContext, instanceOf, pageOf } from './context.js';
import { Refus, ERR } from './filter.js';

const NOTICE_MS = 6000;

// Provisoire : tant que l'app ne comprend pas l'action « ouvrir » (consigne 003), GFS ouvre l'app sur son modèle habituel et le dit.
// Une app qui l'accepte passe à `true` ici (puis la ligne disparaît avec le catalogue provisoire).
const ACCEPTS_OPEN = Object.freeze({ publipostage: false, automation: false });

// Provisoire (étape 2) : les apps qui ne se retirent pas, comme dans la maquette (Publipostage+ ne se décoche pas).
export const ALWAYS_ON = Object.freeze(['publipostage']);

const LIBRARIES_PATH = 'bibliotheques/catalogue.json';
const FIRST_RUN_KEY = 'gfs.premier-lancement.';

const readJson = async path => {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path} : ${response.status}`);
  return response.json();
};

function localeOf(preferences, lang) {
  const wanted = preferences.culture || (lang === 'en' ? 'en-GB' : 'fr-FR');
  try { return Intl.DateTimeFormat.supportedLocalesOf([wanted])[0] || (lang === 'en' ? 'en-GB' : 'fr-FR'); } catch (error) { return lang === 'en' ? 'en-GB' : 'fr-FR'; }
}

export class GfsController {
  apps = [];
  session = null;
  explorer = null;
  modulesWindow = null;
  #noticeTimer = null;
  #facts = null;
  #sentExtensions = null;
  #modulesWaiters = [];

  // env : { grist, router, search, doc }
  constructor({ grist, router, search, doc = document }) {
    this.grist = grist;
    this.router = router;
    this.doc = doc;
    this.params = new URLSearchParams(search);
    this.preferences = readPreferences(search);
    const language = (this.params.get('language') || navigator.language || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr';
    this.i18n = createI18n(language);
    this.lang = this.i18n.lang;
    this.locale = localeOf(this.preferences, this.lang);
    this.state = new GristState();
    this.port = createPort(grist);
    this.readonly = this.params.get('readonly') === 'true';
    // Les apps installées et leurs extensions : ce que la section retient dans `gfs.apps` (contrats 7.4), écrit seulement sur un geste de la personne.
    this.registry = new AppsState({ always: ALWAYS_ON, write: (key, value) => this.port.widget.setOption(key, value), onChange: () => this.#onRegistryChange() });
  }

  $ = id => this.doc.getElementById(id);
  t = (key, vars) => this.i18n.t(key, vars);

  // ---------- noms, grisé, types à créer : ce que l'explorateur demande ----------

  appById(id) { return this.apps.find(item => item.app.id === id && item.ok) || null; }
  appName = id => { const app = this.appById(id); return app ? label(app.manifest.nom, this.lang) : id; };
  validApps() { return this.apps.filter(item => item.ok); }
  typeLabel = file => (file.typeInfo ? label(file.typeInfo.nom, this.lang) : (file.type || '—'));

  // Grisé, jamais masqué (charte) : un fichier d'une app non installée, un type absent du manifeste, un type d'une extension non active sont listés
  // avec la raison (contrats 5.4, point 1, et 6.5, point 3). `focus` : la ligne de la fenêtre « Apps et extensions » qui le débloque, s'il y en a une.
  lockOf = file => {
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
    const apps = this.validApps();
    const several = this.registry.installedIds().length > 1;
    const entries = [];
    for (const { manifest } of apps) {
      const canOpen = new Set((manifest.actions && manifest.actions.ouvrir) || []);
      for (const spec of manifest.fichiers || []) {
        for (const type of spec.types || []) {
          if (!canOpen.has(type.valeur)) continue;
          const probe = { app: manifest.id, known: true, typeInfo: type };
          const lock = this.lockOf(probe);
          entries.push({
            app: manifest.id, type: type.valeur, label: label(type.nom, this.lang), icon: type.icone || 'doc', family: lock ? null : ({ document: 'doc', grille: 'grid', presentation: 'slides' })[type.couleur] || null,
            greyed: Boolean(lock), focus: lock ? lock.focus : null, hint: lock ? lock.text : (several ? label(manifest.nom, this.lang) : ''),
          });
        }
      }
    }
    return entries;
  };

  // ---------- démarrage ----------

  async start() {
    const { doc } = this;
    if (window.parent === window) { this.#setStatus(this.t('gfs.noGrist'), true); doc.body.dataset.gfs = 'standalone'; return; }
    installSprite(doc);
    doc.documentElement.lang = this.lang;
    this.grist.on('message', message => this.state.feed(message));
    this.grist.ready({ requiredAccess: 'full', onEditOptions: () => this.onEditOptions() });
    this.#installPrint();
    this.apps = await loadAll(CATALOGUE, readJson);
    this.registry.setApps(this.apps);
    this.registry.setCatalogue(await this.#loadLibraries());
    await this.state.whenOptions();
    this.registry.read(this.state.allOptions);
    this.state.subscribe(kind => { if (kind === 'options') this.registry.read(this.state.allOptions); });
    this.#buildExplorer();
    this.#buildFloaters();
    const wanted = this.params.get('ouvrir');
    if (wanted && catalogueEntry(wanted) && this.registry.has(wanted) && this.#activate(wanted, null)) this.hideExplorer();
    else this.showExplorer();
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
      onOpen: file => this.#openFile(file), onNew: entry => this.#openNew(entry), onClose: () => this.hideExplorer(), onApps: () => void this.openModules(),
    });
  }

  #buildFloaters() {
    const files = this.$('floater-files');
    files.replaceChildren(icon('folder'), this.t('gfs.files'));
    files.title = this.t('gfs.filesTip');
    files.addEventListener('click', () => this.showExplorer());
    const apps = this.$('floater-apps');
    apps.replaceChildren(icon('modules'), this.t('gfs.apps'));
    apps.title = this.t('gfs.appsTip');
    apps.addEventListener('click', () => void this.openModules());
  }

  // ---------- les deux lieux ----------

  showExplorer() {
    this.$('frames').inert = true;
    this.$('floaters').hidden = true;
    if (this.session) this.session.show(false);
    this.explorer.open();
    void this.refreshFiles();
  }

  hideExplorer() {
    this.explorer.close();
    this.$('frames').inert = false;
    this.$('floaters').hidden = !this.session;
    if (this.session) {
      this.session.show(true);
      this.session.focus();
    }
  }

  async refreshFiles() {
    this.explorer.setStatus({ loading: true });
    try {
      const { files, problems, stats } = await loadFiles(this.port, this.validApps());
      this.explorer.setFiles(files);
      this.explorer.setStatus({ problems: problems.map(item => this.t('ex.readFailed', { app: this.appName(item.app), reason: item.reason })) });
      this.doc.body.dataset.explorerStats = JSON.stringify(stats);
    } catch (error) {
      console.error('GFS : lecture des fichiers impossible', error);
      this.explorer.setStatus({ problems: [this.t('gfs.loadFailed', { reason: String(error && error.message) })] });
    }
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
      console.error('GFS : écriture des réglages impossible', error);
      this.notice(this.t('gfs.settingsFailed', { reason: String(error && error.message) }));
    });
    return new ModulesWindow({
      container: this.$('stage'), i18n: this.i18n, locale: this.locale, model: () => this.registry.model(), readonly: () => this.readonly,
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

  // Un changement des apps installées (un geste, ou ce que Grist dit après « Enregistrer » ou « Annuler ») : tout ce qui en dépend se met à jour.
  #onRegistryChange() {
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
    this.session.close();
    this.session = null;
    this.#sentExtensions = null;
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
    };
  }

  async #contextFor(session) {
    const given = this.registry.extensionsFor(session.id, this.doc.baseURI);
    this.#sentExtensions = JSON.stringify([given.extensions, given.bibliotheques]);
    const facts = await this.#readFacts();
    return buildContext(facts, { access: session.access, extensions: given.extensions, libraries: given.bibliotheques, opening: this.opening }, { preferences: this.preferences, readonly: this.readonly });
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
    if (entry.greyed) { this.#greyedClick({ text: entry.hint, focus: entry.focus }); return; }
    this.#openIn(entry.app, { fichier: null, type: entry.type, dossier: this.explorer.state.path, raison: 'nouveau' }, 'ex.notice.new');
  }

  #openIn(appId, opening, noticeKey) {
    if (!this.#activate(appId, opening)) return;
    this.hideExplorer();
    if (!ACCEPTS_OPEN[appId]) this.notice(this.t(noticeKey, { app: this.appName(appId) }));
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
    return {
      entry: app.app, manifest: app.manifest, catalogue: this.apps.filter(item => item.ok).map(item => item.manifest), state: this.state, port: this.port, router: this.router,
      container: this.$('frames'), readonly: this.readonly, preferences: this.preferences, base: this.doc.baseURI, lang: this.lang, onStatus: (kind, current) => this.#onStatus(kind, current),
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
}
