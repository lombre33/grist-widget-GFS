// « Nouveau > Depuis un modèle » (décision du porteur du 18/11 : « Une galerie commune » ; contrats 5.4, point 13) : lit les catalogues des apps (des fichiers
// de GFS, que `outils/modeles.mjs` copie du dépôt de chaque app), tient la fenêtre (js/apps/templates-window.js) et lui rend ce qu'elle montre. Les catalogues
// se lisent à l'ouverture de la fenêtre, jamais au démarrage : GFS ne paie rien tant que la personne n'ouvre pas la galerie. Une app qui déclare `modeles` et
// dont le catalogue ne se lit pas garde sa pastille (grisée, avec la raison) ; une app sans `modeles` aussi (grisée « bientôt »). Rien ne s'écrit : « Créer »
// rend l'article choisi au contrôleur, qui ouvre l'app (js/broker/openings.js, `openTemplate`).

import { TemplatesWindow } from './templates-window.js';
import { loadCatalogue } from './templates-catalogue.js';

export class TemplatesControl {
  #opts;
  #window;
  #reads = new Map(); // l'id d'une app -> la lecture de son catalogue (gardée quand elle a réussi : ouvrir de nouveau la fenêtre ne relit rien)
  #loaded = [];

  // opts : { container, i18n, inertTargets(), manifests(), entries(loaded) -> { apps, models }, readJson(path), unlock(lock) -> Promise, onCreate(entry) }
  constructor(opts) {
    this.#opts = opts;
    this.#window = new TemplatesWindow({
      container: opts.container, i18n: opts.i18n, inertTargets: opts.inertTargets, model: () => opts.entries(this.#loaded),
      onCreate: entry => opts.onCreate(entry), onSeeApps: entry => void this.#seeApps(entry), onClose: () => {},
    });
  }

  get isOpen() { return this.#window.isOpen; }
  get element() { return this.#window.element; }

  close() { this.#window.close(); }

  // Lit les catalogues puis ouvre la fenêtre ; `memo` rend les réglages d'une visite précédente (la recherche, l'app choisie).
  async open(memo = null) {
    if (this.#window.isOpen) return;
    this.#loaded = await Promise.all(this.#opts.manifests().map(manifest => this.#read(manifest)));
    this.#window.open(memo);
  }

  relocalize(live) {
    this.#opts = { ...this.#opts, ...live };
    this.#window.relocalize(live);
  }

  // Un modèle grisé que la fenêtre « Apps et extensions » débloque : la galerie se ferme, la fenêtre des apps s'ouvre sur sa ligne, et la galerie revient à la
  // fermeture, avec ce que la personne avait réglé.
  async #seeApps(entry) {
    const memo = this.#window.memo();
    await this.#opts.unlock({ text: entry.reason, focus: entry.focus });
    await this.open(memo);
  }

  // Le catalogue d'une app (js/apps/templates-catalogue.js, `loadCatalogue`) : gardé quand il se lit, relu à l'ouverture suivante quand il ne se lit pas.
  async #read(manifest) {
    if (!this.#reads.has(manifest.id)) this.#reads.set(manifest.id, loadCatalogue(manifest, this.#opts.readJson));
    const loaded = await this.#reads.get(manifest.id);
    if (loaded.state === 'broken') this.#reads.delete(manifest.id);
    return loaded;
  }
}
