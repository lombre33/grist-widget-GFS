// Les apps installées et leurs extensions (contrats 7.3, 7.4) : ce que le document retient dans la table `GFS_Rangement`, borné par les manifestes.
// La fenêtre répond tout de suite : l'état change d'abord, l'écriture suit (une à la fois, relue juste avant d'écrire), et si elle échoue l'état revient
// à ce que la table a dit en dernier. Une écriture n'a lieu que sur un geste de la personne (7.3, point 2) : `load` ne fait que lire.

import { readApps, toOption, patchApps, withApp, withExtension, withMode } from './settings.js';
import { extensionsState, extensionsOf } from './extensions.js';
import { modulesModel } from './modules-model.js';

export class AppsState {
  #loaded = [];
  #manifests = new Map();
  #order = [];
  #raw = null;
  #chain = Promise.resolve();
  #pending = 0;
  #store;
  #onChange;
  catalogue = { entries: new Map(), errors: [] };
  apps = {};
  stored = false;

  // opts : { always: [id], store: { read() -> { raw }, update(mutate) -> raw écrit }, onChange() }
  constructor({ always, store, onChange }) {
    this.always = always;
    this.#store = store;
    this.#onChange = onChange;
  }

  // `loaded` : le résultat de loadAll (toutes les apps du catalogue, valides ou non).
  setApps(loaded) {
    this.#loaded = loaded;
    const valid = loaded.filter(item => item.ok);
    this.#manifests = new Map(valid.map(item => [item.manifest.id, item.manifest]));
    this.#order = valid.map(item => item.manifest.id);
    this.#settle();
  }

  setCatalogue(catalogue) { this.catalogue = catalogue; }

  manifest(id) { return this.#manifests.get(id) || null; }
  has(id) { return Object.hasOwn(this.apps, id); }
  installedIds() { return this.#order.filter(id => this.has(id)); }
  get busy() { return this.#pending > 0; }
  model() { return modulesModel(this.#loaded, { apps: this.apps }, this.catalogue, this.always); }
  extensionsFor(id, base) { return extensionsState(this.manifest(id), this.apps[id], this.catalogue, base); }

  // Ce que la table dit. Une table illisible vaut une table absente : la liste par défaut, et un avertissement.
  async load() {
    try { this.#raw = (await this.#store.read()).raw; } catch (error) {
      console.warn('GFS : les apps installées sont illisibles', error);
      this.#raw = null;
    }
    this.#settle();
  }

  // L'état redevient ce que la table a dit en dernier (au démarrage, à la fin des écritures, après un refus).
  #settle() {
    const { apps, stored } = readApps(this.#raw, this.#manifests, this.always);
    this.apps = apps;
    this.stored = stored;
    this.#onChange();
  }

  // Les gestes de la personne : chacun rend `true` quand l'état a changé (et donc qu'une écriture est partie).
  setApp(id, on) {
    const manifest = this.manifest(id);
    if (!manifest || this.always.includes(id) || this.has(id) === on) return Promise.resolve(false);
    return this.#change(id, withApp(this.apps, manifest, on));
  }

  setExtension(id, extensionId, on) {
    const manifest = this.manifest(id);
    if (!manifest || !extensionsOf(manifest).some(ext => ext.id === extensionId)) return Promise.resolve(false);
    return this.#change(id, withExtension(this.apps, manifest, extensionId, on));
  }

  setMode(id, extensionId, mode) {
    const manifest = this.manifest(id);
    if (!manifest) return Promise.resolve(false);
    return this.#change(id, withMode(this.apps, manifest, extensionId, mode));
  }

  async #change(id, next) {
    if (JSON.stringify(next) === JSON.stringify(this.apps)) return false;
    const seed = toOption(this.apps, this.#order);
    const entry = next[id] || null;
    const manifest = this.manifest(id);
    this.apps = next;
    this.#pending += 1;
    this.#onChange();
    const job = this.#chain.then(() => this.#store.update(raw => patchApps(raw, id, entry, manifest, seed)));
    this.#chain = job.catch(() => {});
    let failure = null;
    try { this.#raw = await job; } catch (error) { failure = error; }
    this.#pending -= 1;
    // Plus rien en cours : l'état est celui de la table. Pendant une autre écriture, l'état attendu des gestes suivants reste celui de la fenêtre.
    if (!this.#pending) this.#settle();
    if (failure) throw failure;
    return true;
  }
}
