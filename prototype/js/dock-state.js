// La barre de GFS vue de l'app (contrats 5.2, point 7) : de quel côté elle est, ce qu'elle recouvre, et quand elle ne recouvre rien. Aucun DOM ici : la page mesure la barre telle qu'elle
// est posée (`dock.js`), ce module décide de ce que l'app en apprend et de quand GFS le lui dit.

import { ERR, Refus } from './filter.js';

// Les quatre bords, dans l'ordre du menu de position.
export const EDGES = Object.freeze(['gauche', 'haut', 'droite', 'bas']);
export const DEFAULT_EDGE = 'gauche';
export const STORAGE_KEY = 'gfs.barre';
// Le dégagement, en px : entre la barre et le bord du cadre, et autour d'elle. La zone que l'app laisse libre contient la barre et ce dégagement.
export const GAP = 4;

const isVertical = edge => edge === 'gauche' || edge === 'droite';

// rect : la barre dans le cadre de l'app, { x, y, largeur, hauteur } en px ; frame : le cadre, { largeur, hauteur }. Rend ce que l'app reçoit :
// { bord, epaisseur, zone: { x, y, largeur, hauteur } }, où `epaisseur` est la largeur (bord gauche ou droit) ou la hauteur (bord haut ou bas) de la bande que la zone prend au cadre.
export function barreOf(edge, rect, frame) {
  const left = Math.max(0, Math.round(rect.x) - GAP);
  const top = Math.max(0, Math.round(rect.y) - GAP);
  const right = Math.min(frame.largeur, Math.round(rect.x + rect.largeur) + GAP);
  const bottom = Math.min(frame.hauteur, Math.round(rect.y + rect.hauteur) + GAP);
  const zone = { x: left, y: top, largeur: Math.max(0, right - left), hauteur: Math.max(0, bottom - top) };
  return { bord: edge, epaisseur: isVertical(edge) ? zone.largeur : zone.hauteur, zone };
}

// Deux descriptions de la barre disent la même chose (ou aucune des deux).
export function sameBarre(a, b) {
  if (a === null || b === null) return a === b;
  return a.bord === b.bord && a.epaisseur === b.epaisseur && ['x', 'y', 'largeur', 'hauteur'].every(key => a.zone[key] === b.zone[key]);
}

export class DockState {
  #setting;
  #measure;
  #render;
  #present = false; // une app est ouverte et l'explorateur est fermé : la barre est au-dessus d'elle
  #masked = false; // l'app a demandé à ne pas l'avoir (`barre.masquer`, le diaporama de Publipostage+)
  #last = null;
  #listeners = [];

  // setting : le choix du bord (`StoredChoice` sur `EDGES`) ; measure() → { rect, frame } ou null : la page mesure la barre posée ;
  // render({ edge, visible }) : la page se met à jour (le bord, l'affichage) avant la mesure.
  constructor({ setting, measure, render }) {
    this.#setting = setting;
    this.#measure = measure;
    this.#render = render;
    setting.onChange(() => this.#settle()); // un autre onglet a changé le bord
    this.#render({ edge: this.edge, visible: this.visible });
  }

  get edge() { return this.#setting.value; }
  get visible() { return this.#present && !this.#masked; }
  get masked() { return this.#masked; }

  // Ce que l'app voit maintenant : la barre qui la recouvre, ou `null` (rien ne la recouvre : l'explorateur est ouvert, l'app a demandé à ne pas l'avoir, ou la barre n'est pas à l'écran).
  barre() {
    if (!this.visible) return null;
    const found = this.#measure();
    return found && found.rect.largeur > 0 && found.rect.hauteur > 0 ? barreOf(this.edge, found.rect, found.frame) : null;
  }

  // La barre est au-dessus d'une app ou non. Quand ce n'est plus le cas, la demande de l'app de ne pas l'avoir tombe : elle ne sert que pendant que l'app est montrée.
  setPresent(present) {
    this.#present = Boolean(present);
    if (!this.#present) this.#masked = false;
    this.#settle();
  }

  // La demande de l'app (`barre.masquer`) ne vaut que pendant que l'app est montrée : une app cachée derrière l'explorateur ne peut pas retirer la barre à la personne qui revient.
  mask(masked) {
    this.#masked = this.#present && Boolean(masked);
    this.#settle();
  }

  // Le choix de la personne. Rend `true` si le navigateur l'a retenu (`StoredChoice.choose`).
  choose(edge) {
    const kept = this.#setting.choose(edge);
    this.#settle();
    return kept;
  }

  // La taille du cadre a changé (la barre est centrée sur son bord) : la zone peut avoir bougé.
  refresh() { this.#settle(); }

  // listener(barre | null) : appelé quand ce que l'app voit change vraiment.
  onChange(listener) {
    this.#listeners.push(listener);
    return () => { this.#listeners = this.#listeners.filter(item => item !== listener); };
  }

  #settle() {
    this.#render({ edge: this.edge, visible: this.visible });
    const now = this.barre();
    if (sameBarre(now, this.#last)) return;
    this.#last = now;
    for (const listener of [...this.#listeners]) listener(now);
  }
}

// Les appels de l'app à GFS pour la barre (contrats 5.1) : `barre.masquer` `{ masquee: true | false }`. Un refus se lit en console (comme `stockage.ecrire`) : sans `id`,
// l'app n'attend pas de réponse et n'aurait aucun autre moyen de l'apprendre. Avec un `id`, la réponse dit l'état qui vaut : `{ masquee }`.
export function barHandlers(state, id, warn = console.warn) {
  return {
    'barre.masquer': ({ masquee }) => {
      if (typeof masquee !== 'boolean') {
        const error = new Refus(ERR.REFUSE, 'barre.masquer attend { masquee: true | false }.');
        warn(`GFS : ${id} : barre.masquer refusé (${error.code}) : ${error.message}`);
        throw error;
      }
      state.mask(masquee);
      return { masquee: state.masked };
    },
  };
}
