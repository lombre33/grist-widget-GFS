// La barre de GFS au-dessus d'une app (cahier 6.3, contrats 5.2 point 7) : cinq boutons à icône seule (« Fichiers », « Fichiers ouverts » avec son nombre,
// « Apps », la ligne de travail, contrats 4.5, et la position de la barre), et un sixième, « LanguageTool », que la personne ajoute par les réglages (contrats
// 5.2,
// point 13), posés par-dessus le cadre de l'app, au bord que la personne choisit, centrés sur ce
// bord. Le cadre de l'app reste plein : la barre ne prend de place à personne, et dit à l'app ce qu'elle recouvre (`dock-state.js`). Le bord est retenu dans le
// `localStorage` de GFS (clé `gfs.barre`), comme la langue : jamais dans le document.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openMenu } from '../ui/menu.js';
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
  #opened;
  #openedCount = 0;
  #apps;
  #work;
  #workTip = null;
  #lt;
  #ltState = { shown: false, coupes: false };
  #place;
  #state;
  #t = key => key;
  #onNotKept;

  // root : l'élément de la barre, avec ses boutons ; stage : la scène (sa taille est celle du cadre de l'app) ; onFiles, onOpened, onApps, onWork et onLt : les
  //   boutons qui font quelque chose (le menu de position est celui de la barre) ; onNotKept : le navigateur refuse de retenir le bord choisi (il vaut alors
  //   pour la page).
  constructor({ root, stage, onFiles, onOpened, onApps, onWork, onLt, onNotKept, win = window }) {
    this.#root = root;
    this.#stage = stage;
    this.#files = root.querySelector('#floater-files');
    this.#opened = root.querySelector('#floater-opened');
    this.#apps = root.querySelector('#floater-apps');
    this.#work = root.querySelector('#floater-work');
    this.#lt = root.querySelector('#floater-lt');
    this.#place = root.querySelector('#floater-place');
    this.#onNotKept = onNotKept;
    const setting = new StoredChoice({ choices: EDGES, fallback: DEFAULT_EDGE, store: keyStore(win, STORAGE_KEY) });
    this.#state = new DockState({ setting, measure: () => this.#measure(), render: view => this.#render(view) });
    this.#files.addEventListener('click', onFiles);
    this.#opened.addEventListener('click', onOpened);
    this.#apps.addEventListener('click', onApps);
    this.#work.addEventListener('click', onWork);
    this.#lt.addEventListener('click', onLt);
    this.#place.addEventListener('click', () => this.#openPlaceMenu());
    watchKey(setting, STORAGE_KEY, win);
    // La barre est centrée sur son bord : un cadre qui change de taille la déplace ; et la zone qu'elle dit à l'app est sa taille : l'accessibilité renforcée
    // (cibles de 36 px, css/acces.css) l'agrandit sans que le cadre bouge, la zone se relit donc aussi quand c'est la barre qui change de taille.
    if (win.ResizeObserver) {
      const observer = new win.ResizeObserver(() => this.#state.refresh());
      observer.observe(stage);
      observer.observe(root);
    }
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
    this.#paintOpened();
    this.#name(this.#apps, 'modules', t('gfs.appsTip'));
    this.#name(this.#work, 'work-row', this.#workTip || t('work.title'));
    this.#paintLt();
    this.#name(this.#place, EDGE_ICONS[this.edge], t('dock.place'));
    this.#place.dataset.edge = this.edge;
  }

  // La table de travail choisie, dite par l'info-bulle du bouton ; `active` : une table est choisie (le bouton est enfoncé), sinon la page décide.
  setWork(text, active) {
    this.#workTip = text;
    this.#name(this.#work, 'work-row', text);
    this.#work.setAttribute('aria-pressed', active ? 'true' : 'false');
  }

  // Le bouton « LanguageTool » : dans la barre seulement quand la personne l'a voulu (`shown`, grisé ou caché n'a pas de sens ici : le réglage le montre ou
  // non) ; enfoncé tant que LanguageTool travaille dans les apps, relevé quand il est coupé. Le nom dit l'état, l'info-bulle ce qu'un clic fait.
  setLt(state) {
    this.#ltState = state;
    this.#paintLt();
  }

  #paintLt() {
    const { shown, coupes } = this.#ltState;
    this.#lt.hidden = !shown;
    this.#name(this.#lt, 'spell', this.#t(coupes ? 'dock.ltOff' : 'dock.ltOn'));
    this.#lt.setAttribute('aria-pressed', coupes ? 'false' : 'true');
  }

  // Le nombre de fichiers ouverts, sur le bouton « Fichiers ouverts » : une pastille (pas d'elle seule : le nombre est aussi dans le nom du bouton) ; sans
  // fichier ouvert le bouton est grisé et reste là.
  setOpened(count) {
    this.#openedCount = count;
    this.#paintOpened();
  }

  #paintOpened() {
    const count = this.#openedCount;
    this.#name(this.#opened, 'stack', count > 0 ? this.#t('dock.openedCount', { n: count }) : this.#t('dock.opened'));
    if (count > 0) this.#opened.append(h('span', { class: 'badge', 'aria-hidden': 'true' }, String(count)));
    this.#opened.dataset.empty = String(count === 0);
  }

  // Le menu des fichiers ouverts, à côté du bouton ou au-dessous / au-dessus selon le bord (js/explorer/opened-bar.js fournit les articles).
  showOpened(items, start = null) {
    openMenu(this.#opened, items, { host: this.#stage, side: MENU_SIDE[this.edge], label: this.#t('dock.opened'), className: 'menu-opened', start });
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
    return { rect: { x: box.left - stage.left, y: box.top - stage.top, largeur: box.width, hauteur: box.height },
      frame: { largeur: stage.width, hauteur: stage.height } };
  }

  // Les quatre bords, un article chacun : celui qui vaut est coché.
  #edgeItems() {
    return EDGES.map(edge => ({ label: this.#t(`dock.${edge}`), icon: EDGE_ICONS[edge], check: edge === this.edge, run: () => this.#choose(edge) }));
  }

  #openPlaceMenu() {
    openMenu(this.#place, this.#edgeItems(), { host: this.#stage, side: MENU_SIDE[this.edge], label: this.#t('dock.place') });
  }

  // La ligne « Position de la barre » du menu « Réglages » de l'explorateur (js/shell/settings-menu.js) : le même choix que le dernier bouton de la barre, ses
  // quatre bords en sous-menu.
  placeRow() {
    return { label: this.#t('dock.place'), icon: EDGE_ICONS[this.edge], submenu: this.#edgeItems() };
  }

  #choose(edge) {
    if (!this.#state.choose(edge)) this.#onNotKept();
  }
}
