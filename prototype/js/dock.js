// La barre de GFS au-dessus d'une app (cahier 6.3, contrats 5.2 point 7) : trois boutons à icône seule (« Fichiers », « Apps » et la position de la barre) posés par-dessus le cadre de l'app, au
// bord que la personne choisit, centrés sur ce bord. Le cadre de l'app reste plein : la barre ne prend de place à personne, et dit à l'app ce qu'elle recouvre (`dock-state.js`).
// Le bord est retenu dans le `localStorage` de GFS (clé `gfs.barre`), comme la langue : jamais dans le document.

import { icon } from './icons.js';
import { openMenu } from './menu.js';
import { StoredChoice, keyStore, watchKey } from './stored-choice.js';
import { DockState, EDGES, DEFAULT_EDGE, STORAGE_KEY, barHandlers } from './dock-state.js';

// L'icône de chaque bord : un cadre dont le trait montre de quel côté est la barre.
const EDGE_ICONS = Object.freeze({ gauche: 'dock-left', haut: 'dock-top', droite: 'dock-right', bas: 'dock-bottom' });
// Où s'ouvre le menu de position, pour ne pas recouvrir la barre : à côté d'une barre verticale, au-dessous ou au-dessus d'une barre horizontale.
const MENU_SIDE = Object.freeze({ gauche: 'right', droite: 'left', haut: 'below', bas: 'above' });

export class Dock {
  #root;
  #stage;
  #files;
  #apps;
  #place;
  #state;
  #t = key => key;
  #onNotKept;

  // root : l'élément de la barre, avec ses trois boutons ; stage : la scène (sa taille est celle du cadre de l'app) ; onFiles et onApps : les deux premiers boutons ;
  // onNotKept : le navigateur refuse de retenir le bord choisi (il vaut alors pour la page).
  constructor({ root, stage, onFiles, onApps, onNotKept, win = window }) {
    this.#root = root;
    this.#stage = stage;
    this.#files = root.querySelector('#floater-files');
    this.#apps = root.querySelector('#floater-apps');
    this.#place = root.querySelector('#floater-place');
    this.#onNotKept = onNotKept;
    const setting = new StoredChoice({ choices: EDGES, fallback: DEFAULT_EDGE, store: keyStore(win, STORAGE_KEY) });
    this.#state = new DockState({ setting, measure: () => this.#measure(), render: view => this.#render(view) });
    this.#files.addEventListener('click', onFiles);
    this.#apps.addEventListener('click', onApps);
    this.#place.addEventListener('click', () => this.#openPlaceMenu());
    watchKey(setting, STORAGE_KEY, win);
    // La barre est centrée sur son bord : un cadre qui change de taille la déplace.
    if (win.ResizeObserver) new win.ResizeObserver(() => this.#state.refresh()).observe(stage);
  }

  get edge() { return this.#state.edge; }
  barre() { return this.#state.barre(); }
  setPresent(present) { this.#state.setPresent(present); }
  mask(masked) { this.#state.mask(masked); }
  onChange(listener) { return this.#state.onChange(listener); }
  // Les appels de l'app pour la barre (contrats 5.1) : `barre.masquer`.
  handlers(appId) { return barHandlers(this.#state, appId); }

  // Les noms des boutons (l'info-bulle et le nom accessible : il n'y a pas d'autre texte) suivent la langue.
  relabel(t) {
    this.#t = t;
    this.#root.setAttribute('aria-label', t('gfs.title'));
    this.#name(this.#files, 'folder', t('gfs.filesTip'));
    this.#name(this.#apps, 'modules', t('gfs.appsTip'));
    this.#name(this.#place, EDGE_ICONS[this.edge], t('dock.place'));
    this.#place.dataset.edge = this.edge;
  }

  #name(button, iconName, text) {
    button.replaceChildren(icon(iconName));
    button.title = text;
    button.setAttribute('aria-label', text);
  }

  // Le bord choisi et l'affichage, avant que l'état mesure la barre.
  #render({ edge, visible }) {
    this.#root.dataset.edge = edge;
    this.#root.hidden = !visible;
    if (this.#place.dataset.edge !== edge) {
      this.#place.dataset.edge = edge;
      this.#place.replaceChildren(icon(EDGE_ICONS[edge]));
    }
  }

  // La barre dans le cadre de l'app, telle qu'elle est posée.
  #measure() {
    const box = this.#root.getBoundingClientRect();
    const stage = this.#stage.getBoundingClientRect();
    return { rect: { x: box.left - stage.left, y: box.top - stage.top, largeur: box.width, hauteur: box.height }, frame: { largeur: stage.width, hauteur: stage.height } };
  }

  #openPlaceMenu() {
    const items = EDGES.map(edge => ({ label: this.#t(`dock.${edge}`), icon: EDGE_ICONS[edge], check: edge === this.edge, run: () => this.#choose(edge) }));
    openMenu(this.#place, items, { host: this.#stage, side: MENU_SIDE[this.edge], label: this.#t('dock.place') });
  }

  #choose(edge) {
    if (!this.#state.choose(edge)) this.#onNotKept();
  }
}
