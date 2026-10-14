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

const NOTICE_MS = 6000;

// Provisoire : tant que l'app ne comprend pas l'action « ouvrir » (consigne 003), GFS ouvre l'app sur son modèle habituel et le dit.
// Une app qui l'accepte passe à `true` ici (puis la ligne disparaît avec le catalogue provisoire).
const ACCEPTS_OPEN = Object.freeze({ publipostage: false, automation: false });

// Provisoire (étape 2) : les apps installées quand la section n'a encore rien enregistré. Publipostage+ ne se décoche pas dans la maquette.
export const DEFAULT_INSTALLED = Object.freeze(['publipostage']);

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
  installed = new Set(DEFAULT_INSTALLED);
  #noticeTimer = null;

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
  }

  $ = id => this.doc.getElementById(id);
  t = (key, vars) => this.i18n.t(key, vars);

  // ---------- noms, grisé, types à créer : ce que l'explorateur demande ----------

  appById(id) { return this.apps.find(item => item.app.id === id && item.ok) || null; }
  appName = id => { const app = this.appById(id); return app ? label(app.manifest.nom, this.lang) : id; };
  installedApps() { return this.apps.filter(item => item.ok && this.installed.has(item.app.id)); }
  typeLabel = file => (file.typeInfo ? label(file.typeInfo.nom, this.lang) : (file.type || '—'));

  // Un type absent du manifeste, ou d'une extension non active, est grisé avec la raison (contrats 6.5, point 3).
  lockOf = file => {
    if (!file.known) return { text: this.t('ex.lockedType', { app: this.appName(file.app) }) };
    const extension = file.typeInfo.extension;
    if (extension && !this.isExtensionActive(file.app, extension)) {
      const app = this.appById(file.app);
      const entry = app && (app.manifest.extensions || []).find(item => item.id === extension);
      return { text: this.t('ex.lockedExtension', { name: entry ? label(entry.nom, this.lang) : extension }) };
    }
    return null;
  };

  isExtensionActive() { return false; }

  // Le menu « Nouveau » : un article par type que l'app sait ouvrir (`actions.ouvrir`), le nom de l'app quand il y en a plusieurs.
  newTypes = () => {
    const apps = this.installedApps();
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
            greyed: Boolean(lock), hint: lock ? lock.text : (apps.length > 1 ? label(manifest.nom, this.lang) : ''),
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
    await this.state.whenOptions();
    this.#buildExplorer();
    this.#buildFloaters();
    const wanted = this.params.get('ouvrir');
    if (wanted && catalogueEntry(wanted) && this.#activate(wanted, null)) this.hideExplorer();
    else this.showExplorer();
    doc.body.dataset.gfs = 'ready';
  }

  onEditOptions() {}

  // La fonction « print » du script d'API de Grist imprime la page de GFS ; GFS la remplace par un relais vers l'app active (contrats 4.3).
  #installPrint() {
    this.grist.rpc.unregisterFunc('print');
    this.grist.rpc.registerFunc('print', () => (this.session && this.session.isReady ? this.session.callApp('print', [], 10000) : window.print()));
  }

  #buildExplorer() {
    this.explorer = new Explorer({
      container: this.$('stage'), i18n: this.i18n, locale: this.locale, now: () => new Date(), appName: this.appName, typeLabel: this.typeLabel, lockOf: this.lockOf,
      newTypes: this.newTypes, canClose: () => Boolean(this.session), notice: text => this.notice(text),
      onOpen: file => this.#openFile(file), onNew: entry => this.#openNew(entry), onClose: () => this.hideExplorer(),
    });
  }

  #buildFloaters() {
    const files = this.$('floater-files');
    files.replaceChildren(icon('folder'), this.t('gfs.files'));
    files.title = this.t('gfs.filesTip');
    files.addEventListener('click', () => this.showExplorer());
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
      const { files, problems, stats } = await loadFiles(this.port, this.installedApps());
      this.explorer.setFiles(files);
      this.explorer.setStatus({ problems: problems.map(item => this.t('ex.readFailed', { app: this.appName(item.app), reason: item.reason })) });
      this.doc.body.dataset.explorerStats = JSON.stringify(stats);
    } catch (error) {
      console.error('GFS : lecture des fichiers impossible', error);
      this.explorer.setStatus({ problems: [this.t('gfs.loadFailed', { reason: String(error && error.message) })] });
    }
  }

  // ---------- ouvrir ----------

  #openFile(file) {
    const lock = this.lockOf(file);
    if (lock) { this.notice(lock.text); return; }
    if (!this.appById(file.app)) { this.notice(this.t('ex.notice.noApp')); return; }
    this.#openIn(file.app, { fichier: { id: file.id, type: file.type }, type: file.type, dossier: this.explorer.state.path, raison: 'explorateur' }, 'ex.notice.open');
  }

  #openNew(entry) {
    if (entry.greyed) { this.notice(entry.hint); return; }
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
    if (!app) return false;
    this.opening = opening;
    if (this.session && this.session.id === id) return true;
    if (this.session) this.session.close();
    this.session = new AppSession(this.#sessionContext(app));
    this.session.open();
    return true;
  }

  #sessionContext(app) {
    return {
      entry: app.app, manifest: app.manifest, catalogue: this.apps.filter(item => item.ok).map(item => item.manifest), state: this.state, port: this.port, router: this.router,
      container: this.$('frames'), readonly: this.readonly, preferences: this.preferences, base: this.doc.baseURI, lang: this.lang, onStatus: (kind, current) => this.#onStatus(kind, current),
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
