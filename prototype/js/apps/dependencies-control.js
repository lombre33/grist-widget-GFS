// Ce que le contrôleur fait de la fenêtre « Dépendances » des réglages (demande du porteur, 18/11) : lit le relevé daté de GFS (bibliotheques/releve.json, tiré
// du registre par outils/releve-dependances.mjs, jamais par le navigateur), calcule les lignes d'après le catalogue des bibliothèques et les apps installées,
// ouvre la fenêtre (js/apps/dependencies-window.js) et lui prête la vérification d'une copie. Le fichier est à part pour que le contrôleur ne grossisse que de
// quelques lignes. Les lignes se relisent d'après les apps à chaque choix. Une écriture n'a lieu que sur un geste de la personne : le choix de la source d'une
// bibliothèque ou de toutes, que `apply` écrit comme la fiche d'une app (js/apps/dependencies-source.js) ; l'export ne fait que produire un fichier.

import { dependencyRows } from './dependencies-model.js';
import { openDependencies } from './dependencies-window.js';
import { verifyCopy } from './dependencies-audit.js';
import { allUnits } from './dependencies-source.js';
import { saveText, newSerial } from './dependencies-export.js';

export const RELEVE_PATH = 'bibliotheques/releve.json';
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export class DependenciesControl {
  #opts;
  #releve = null; // le relevé, gardé quand il s'est lu ; un fichier absent ou illisible se relit à l'ouverture suivante
  #checks = new Map(); // l'id d'un fichier -> sa vérification (rendue à la personne qui rouvre la fenêtre : la copie ne change pas entre deux ouvertures)
  #opened = false;

  // opts : { container, inertTargets(), t, locale() -> 'fr-FR', lang() -> 'fr', base (l'adresse de GFS), model() -> modulesModel, catalogue() -> readCatalogue,
  //   readJson(chemin), readBytes(adresse) -> Promise<ArrayBuffer>, blocked() -> la raison pour laquelle rien ne s'écrit (texte), ou null,
  //   apply(plan, mode) -> Promise (écrit les choix de source), ask(opts) -> Promise<booléen>, doc (la page : l'export s'y offre au téléchargement) }
  constructor(opts) { this.#opts = opts; }

  get isOpen() { return this.#opened; }

  async open() {
    if (this.#opened) return;
    this.#opened = true;
    try {
      const { container, inertTargets, t, locale, lang, model, catalogue } = this.#opts;
      const releve = await this.#read();
      const { blocked, apply, ask, doc } = this.#opts;
      await openDependencies({ container, inertTargets, t, locale: locale(), lang: lang(),
        rows: () => dependencyRows({ catalogue: catalogue(), releve, modules: model(), lang: lang() }),
        surveyed: releve ? releve.releve : null, verify: row => this.#verify(row), blocked, apply, ask, units: () => allUnits(model(), lang()),
          now: () => new Date(),
        uuid: () => newSerial(), save: (name, text) => saveText(doc, name, text) });
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
