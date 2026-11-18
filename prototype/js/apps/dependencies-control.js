// Ce que le contrôleur fait de la fenêtre « Dépendances » des réglages (demande du porteur, 18/11) : lit le relevé daté de GFS (bibliotheques/releve.json, tiré
// du registre par outils/releve-dependances.mjs, jamais par le navigateur), calcule les lignes d'après le catalogue des bibliothèques et les apps installées,
// ouvre la fenêtre (js/apps/dependencies-window.js) et lui prête la vérification d'une copie. Le fichier est à part pour que le contrôleur ne grossisse que de
// quelques lignes. Rien ne s'écrit : aucune table, aucun réglage.

import { dependencyRows } from './dependencies-model.js';
import { openDependencies } from './dependencies-window.js';
import { verifyCopy } from './dependencies-audit.js';

export const RELEVE_PATH = 'bibliotheques/releve.json';
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export class DependenciesControl {
  #opts;
  #releve = null; // le relevé, gardé quand il s'est lu ; un fichier absent ou illisible se relit à l'ouverture suivante
  #checks = new Map(); // l'id d'un fichier -> sa vérification (rendue à la personne qui rouvre la fenêtre : la copie ne change pas entre deux ouvertures)
  #opened = false;

  // opts : { container, inertTargets(), t, locale() -> 'fr-FR', lang() -> 'fr', base (l'adresse de GFS), model() -> modulesModel, catalogue() -> readCatalogue,
  //   readJson(chemin),
  //   readBytes(adresse) -> Promise<ArrayBuffer> }
  constructor(opts) { this.#opts = opts; }

  get isOpen() { return this.#opened; }

  async open() {
    if (this.#opened) return;
    this.#opened = true;
    try {
      const { container, inertTargets, t, locale, lang, model, catalogue } = this.#opts;
      const releve = await this.#read();
      const rows = dependencyRows({ catalogue: catalogue(), releve, modules: model(), lang: lang() });
      await openDependencies({ container, inertTargets, t, locale: locale(), rows, surveyed: releve ? releve.releve : null, verify: row => this.#verify(row) });
    } finally { this.#opened = false; }
  }

  // Le relevé daté, ou null (le fichier manque, ou n'a pas la forme attendue : la fenêtre montre alors ce que GFS sert, sans dernières versions ni avis, et le
  // dit).
  async #read() {
    if (this.#releve) return this.#releve;
    try {
      const releve = await this.#opts.readJson(RELEVE_PATH);
      if (!isObject(releve) || !isObject(releve.paquets) || Number.isNaN(Date.parse(releve.releve))) throw new Error('forme inattendue');
      this.#releve = releve;
    } catch (error) {
      console.warn('GFS : le relevé des dépendances est illisible', error);
    }
    return this.#releve;
  }

  // Relit chaque fichier de la ligne et recalcule son empreinte ; un fichier déjà vérifié, intact, n'est pas relu.
  async #verify(row) {
    const { readBytes, base } = this.#opts;
    return Promise.all(row.files.map(async file => {
      const kept = this.#checks.get(file.id);
      if (kept && kept.state === 'ok') return kept;
      const result = await verifyCopy(file, { readBytes, base });
      this.#checks.set(file.id, result);
      return result;
    }));
  }
}
