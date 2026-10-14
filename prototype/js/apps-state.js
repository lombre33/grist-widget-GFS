// Les apps installées et leurs extensions (contrats 7.3, 7.4) : ce que la section retient dans `gfs.apps`, borné par les manifestes.
// La fenêtre répond tout de suite : l'état change d'abord, l'écriture suit, et si Grist la refuse l'état revient à ce que Grist a dit en dernier.
// Une écriture n'a lieu que sur un geste de la personne (7.3, point 2) : `read` ne fait que lire.

import { readApps, toOption, withApp, withExtension, withMode, APPS_KEY } from './settings.js';
import { extensionsState, extensionsOf } from './extensions.js';
import { modulesModel } from './modules-model.js';

export class AppsState {
  #loaded = [];
  #manifests = new Map();
  #order = [];
  #last = null;
  #pending = 0;
  #write;
  #onChange;
  catalogue = { entries: new Map(), errors: [] };
  apps = {};
  stored = false;

  // opts : { always: [id], write(key, value) -> Promise, onChange() }
  constructor({ always, write, onChange }) {
    this.always = always;
    this.#write = write;
    this.#onChange = onChange;
  }

  // `loaded` : le résultat de loadAll (toutes les apps du catalogue, valides ou non).
  setApps(loaded) {
    this.#loaded = loaded;
    const valid = loaded.filter(item => item.ok);
    this.#manifests = new Map(valid.map(item => [item.manifest.id, item.manifest]));
    this.#order = valid.map(item => item.manifest.id);
    this.#apply(this.#last);
  }

  setCatalogue(catalogue) { this.catalogue = catalogue; }

  manifest(id) { return this.#manifests.get(id) || null; }
  has(id) { return Object.hasOwn(this.apps, id); }
  installedIds() { return this.#order.filter(id => this.has(id)); }
  model() { return modulesModel(this.#loaded, { apps: this.apps }, this.catalogue, this.always); }
  extensionsFor(id, base) { return extensionsState(this.manifest(id), this.apps[id], this.catalogue, base); }

  // Ce que Grist a dit en dernier (le message de réglages). Pendant une écriture en cours, l'écho d'une écriture plus ancienne ne défait pas
  // le choix que la personne vient de faire : l'état se recalera sur le dernier écho.
  read(allOptions) {
    this.#last = allOptions;
    if (!this.#pending) this.#apply(allOptions);
  }

  #apply(allOptions) {
    const before = JSON.stringify(this.apps);
    const { apps, stored } = readApps(allOptions, this.#manifests, this.always);
    this.apps = apps;
    this.stored = stored;
    if (JSON.stringify(apps) !== before) this.#onChange();
  }

  // Les gestes de la personne : chacun rend `true` quand l'état a changé (et donc qu'une écriture est partie).
  setApp(id, on) {
    const manifest = this.manifest(id);
    if (!manifest || this.always.includes(id) || this.has(id) === on) return Promise.resolve(false);
    return this.#change(withApp(this.apps, manifest, on));
  }

  setExtension(id, extensionId, on) {
    const manifest = this.manifest(id);
    if (!manifest || !extensionsOf(manifest).some(ext => ext.id === extensionId)) return Promise.resolve(false);
    return this.#change(withExtension(this.apps, manifest, extensionId, on));
  }

  setMode(id, extensionId, mode) {
    const manifest = this.manifest(id);
    if (!manifest) return Promise.resolve(false);
    return this.#change(withMode(this.apps, manifest, extensionId, mode));
  }

  async #change(next) {
    if (JSON.stringify(next) === JSON.stringify(this.apps)) return false;
    this.apps = next;
    this.#onChange();
    this.#pending += 1;
    let failure = null;
    try { await this.#write(APPS_KEY, toOption(next, this.#order)); } catch (error) { failure = error; }
    this.#pending -= 1;
    // Écriture refusée et plus rien en cours : l'état redevient celui que Grist a dit en dernier. Une écriture réussie ne relit rien : l'écho
    // qui peut encore venir est celui d'une écriture plus ancienne, le dernier dira la même chose que l'état.
    if (failure && !this.#pending) this.#apply(this.#last);
    if (failure) throw failure;
    return true;
  }
}
