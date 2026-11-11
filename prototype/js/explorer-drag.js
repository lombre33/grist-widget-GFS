// Glisser-déposer dans l'explorateur (demande du porteur, 04/11 : « drag & drop des fichiers dans des dossiers, en amont, en aval ») : la personne prend une
// ligne (un fichier, ou un dossier) et la dépose sur un
// dossier : une ligne ou une vignette de dossier de la liste (en aval), une ligne du volet des dossiers, un lien du fil d'Ariane (en amont, comme la racine
//   « Moi »). Le déplacement est celui du couper-coller (js/explorer-clipboard.js, `moveTo`, puis js/filing.js) : il n'y a pas de geste de plus à écrire,
//   seulement une autre façon de le demander. Les dossiers du volet qu'on survole un instant s'ouvrent, pour atteindre un sous-dossier. Un dépôt qui ne
//   changerait rien (le dossier où est déjà la ligne, un dossier sur lui-même ou sur un de ses sous-dossiers) n'est pas accepté : la cible ne s'éclaire pas.
//   Rien ne glisse à la corbeille ni pendant un choix de fichier. Au clavier, le même déplacement est Ctrl+X puis Ctrl+V, ou « Déplacer » dans le menu de la
//   ligne. Seule la ligne tenue est gardée ici, pas dans `dataTransfer` : le navigateur ne la rend pas pendant le survol, et un glissement venu d'ailleurs (un
//   fichier de l'ordinateur) n'est pas le nôtre.

import { inside } from './explorer-model.js';
import { parentPath } from './explorer-keys.js';

const TYPE = 'application/x-gfs-ligne';
const SPRING_MS = 700; // un dossier fermé du volet qu'on survole depuis si longtemps s'ouvre
const TARGETS = '.tr-row[data-path], .crumbs [data-path], [data-key^="dir:"]';

// Peut-on déposer la ligne `key` (un fichier, ou « dir:chemin ») dans le dossier `path` ? Pas quand rien ne changerait : le dossier de la ligne, un dossier sur
// lui-même ou dans un de ses sous-dossiers.
export function canDrop({ key, path, file }) {
  if (key.startsWith('dir:')) {
    const from = key.slice(4);
    return path !== from && !inside(path, from) && parentPath(from) !== path;
  }
  const found = file(key);
  return Boolean(found) && found.folder !== path;
}

// Le dossier que vise un élément : { element, path }, ou null. Le volet et le fil d'Ariane le disent par `data-path`, une ligne ou une vignette de dossier par
// sa clé « dir:chemin » ; la racine est le chemin vide.
export function targetOf(node) {
  const element = node && typeof node.closest === 'function' ? node.closest(TARGETS) : null;
  if (!element) return null;
  return { element, path: element.dataset.path !== undefined ? element.dataset.path : element.dataset.key.slice(4) };
}

export class Dragging {
  #opts;
  #key = null; // la ligne tenue : un fichier, ou « dir:chemin »
  #lit = null; // le dossier éclairé
  #spring = { path: null, timer: null };

  // opts : { root (le cadre de l'explorateur), may() -> bool (la liste se glisse : pas à la corbeille, pas pendant un choix), file(key) -> le fichier vivant,
  //   ou undefined, moveTo(key, path) (js/explorer-clipboard.js),
  //          expand(path) (ouvre un dossier du volet), later?(fonction, ms) -> identifiant, cancel?(identifiant) (les minuteurs, pour les essais) }
  constructor(opts) {
    this.#opts = { later: (run, ms) => setTimeout(() => run(), ms), cancel: id => clearTimeout(id), ...opts };
    const { root } = this.#opts;
    root.addEventListener('dragstart', event => this.#start(event));
    root.addEventListener('dragenter', event => this.#over(event));
    root.addEventListener('dragover', event => this.#over(event));
    root.addEventListener('dragleave', event => this.#leave(event));
    root.addEventListener('drop', event => this.#drop(event));
    root.addEventListener('dragend', () => this.reset());
  }

  // Les lignes de `list` se prennent à la souris, sauf à la corbeille et pendant un choix. Appelé à chaque dessin de la liste.
  mark(list) {
    const may = this.#opts.may();
    for (const row of list.querySelectorAll('[data-key]')) row.draggable = may;
  }

  // Une ligne est tenue (un glissement est en cours) : la liste fenêtrée ne retire alors aucune ligne (js/explorer-window.js).
  get holding() { return this.#key !== null; }

  // On ne tient plus rien : la fermeture de l'explorateur, la fin d'un glissement, un dépôt.
  reset() {
    this.#key = null;
    this.#light(null);
    this.#opts.cancel(this.#spring.timer);
    this.#spring = { path: null, timer: null };
    for (const row of this.#opts.root.querySelectorAll('.is-dragging')) row.classList.remove('is-dragging');
  }

  #start(event) {
    const row = event.target && typeof event.target.closest === 'function' ? event.target.closest('[data-key]') : null;
    if (!row || !this.#opts.may()) return;
    this.#key = row.dataset.key;
    const { dataTransfer } = event;
    dataTransfer.effectAllowed = 'move';
    dataTransfer.setData(TYPE, this.#key); // Firefox ne lance aucun glissement sans une donnée
    this.#opts.later(() => row.classList.add('is-dragging'), 0); // après la capture de l'image qui suit le curseur : elle ne doit pas être effacée
  }

  // Survol d'une cible qui accepterait la ligne tenue : elle s'éclaire et le curseur dit « déplacer » ; sinon rien n'est accepté (le curseur dit « interdit »).
  #over(event) {
    const { dataTransfer } = event;
    const ours = this.#key !== null && dataTransfer && Array.prototype.includes.call(dataTransfer.types || [], TYPE);
    const target = ours ? targetOf(event.target) : null;
    if (!target || !canDrop({ key: this.#key, path: target.path, file: this.#opts.file })) { this.#light(null); this.#unspring(); return; }
    event.preventDefault();
    dataTransfer.dropEffect = 'move';
    this.#light(target.element);
    this.#springOpen(target);
  }

  #leave(event) {
    if (this.#lit && !(event.relatedTarget && this.#lit.contains(event.relatedTarget))) this.#light(null);
  }

  #drop(event) {
    const key = this.#key;
    const target = key === null ? null : targetOf(event.target);
    const allowed = Boolean(target) && canDrop({ key, path: target.path, file: this.#opts.file });
    this.reset();
    if (!allowed) return;
    event.preventDefault();
    void this.#opts.moveTo(key, target.path);
  }

  #light(element) {
    if (this.#lit === element) return;
    if (this.#lit) this.#lit.classList.remove('is-drop');
    this.#lit = element;
    if (element) element.classList.add('is-drop');
  }

  // Un dossier fermé du volet qu'on survole un instant s'ouvre : ses sous-dossiers deviennent des cibles.
  #springOpen({ element, path }) {
    const closed = element.classList.contains('tr-row') && element.querySelector('[data-toggle]') !== null && element.querySelector('.ic.open') === null;
    if (!closed) { this.#unspring(); return; }
    if (this.#spring.path === path) return;
    this.#unspring();
    this.#spring = { path, timer: this.#opts.later(() => { this.#spring = { path: null, timer: null }; this.#opts.expand(path); }, SPRING_MS) };
  }

  #unspring() {
    this.#opts.cancel(this.#spring.timer);
    this.#spring = { path: null, timer: null };
  }
}
