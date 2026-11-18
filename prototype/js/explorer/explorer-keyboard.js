// Ce que l'explorateur fait des touches (js/explorer/explorer.js) : celles de la liste (flèches, Début, Fin, Entrée, F2, Suppr, Retour arrière, la touche
// Menu), celles du document (« / » pour la recherche, Échap) et le presse-papiers (Ctrl+C, X, V, D, Z, Y). La table des touches est dans
// js/explorer/explorer-keys.js ; ici, ce que chaque geste fait de la ligne choisie. Sorti de l'explorateur pour qu'il reste sous les 600 lignes de code de
// l'outil d'audit. Rien ne s'y garde : l'explorateur donne, par des fonctions, ce qu'il montre à l'instant de la touche.
//
// x : { root(), state(), search() (le champ de recherche), list() (le conteneur des lignes), filtering(), keys() (la clé de chaque ligne, dans l'ordre),
//   choice() (un
//   mode choix est ouvert), opts() (i18n, notice), undo(), clipboard(), removal(), select(clé, focus), rowFor(clé), activate(clé), rename(clé), rowMenu(clé,
//   ancre),
//   goParent(event), searched() (la recherche a changé : fil d'Ariane et liste se redessinent), requestClose() }

import { listAction, moveTarget, isSearchKey, clipboardAction } from './explorer-keys.js';
import { menuIsOpen } from '../ui/menu.js';

// Les gestes d'une ligne qu'un clavier posé sur ☆ ou ⋯ (ou ailleurs dans la ligne) fait aussi ; les flèches et Entrée restent aux boutons.
const FROM_BUTTONS = new Set(['rename', 'delete', 'menu', 'parent']);

export class Keyboard {
  #x;

  constructor(x) { this.#x = x; }

  // Les touches de la liste. La ligne visée par un geste est la ligne choisie, sinon celle où est le clavier : à l'ouverture, le clavier est sur la première
  // ligne sans qu'aucune soit choisie, et Entrée, F2 ou Suppr doivent y répondre.
  onList(event) {
    const x = this.#x;
    const action = listAction(event, { display: x.state().display, filtering: x.filtering() });
    if (!action || (event.target.closest('button') && !FROM_BUTTONS.has(action))) return;
    const keys = x.keys();
    if (!keys.length) { if (action === 'parent') x.goParent(event); return; }
    const at = keys.indexOf(x.state().sel);
    const to = moveTarget(action, at, keys.length, () => this.#columns());
    if (to !== null) this.#move(event, to);
    else if (action === 'parent') x.goParent(event);
    else this.#onRow(event, action, at >= 0 ? x.rowFor(keys[at]) : event.target.closest('[data-key]'));
  }

  // Les touches du document : l'explorateur est ouvert, le clavier n'est pas forcément dans la liste (clic dans une zone vide, liste redessinée). Un menu ou
  // une fenêtre qui a pris la touche pour lui (preventDefault) passe avant.
  onDocument(event) {
    const x = this.#x;
    if (event.defaultPrevented) return;
    const search = x.search();
    if (isSearchKey(event) && x.root().contains(event.target) && !menuIsOpen()) {
      event.preventDefault();
      search.focus();
      search.select();
      return;
    }
    const clip = clipboardAction(event);
    if (clip && this.#ours(event.target) && !menuIsOpen() && !(['copy', 'cut'].includes(clip) && this.#hasTextSelected())) {
      event.preventDefault();
      this.#onClipboard(clip, event);
      return;
    }
    if (event.key !== 'Escape') return;
    if (event.target === search && search.value) {
      search.value = '';
      x.state().q = '';
      x.searched();
    } else {
      x.requestClose();
    }
    event.preventDefault();
  }

  // Le choix va à la ligne d'index `to` (tenu dans la liste).
  #move(event, to) {
    const keys = this.#x.keys();
    event.preventDefault();
    this.#x.select(keys[Math.min(Math.max(to, 0), keys.length - 1)], true);
  }

  // Un geste sur la ligne choisie, ou sur celle où est le focus (`here`) ; rien quand il n'y en a pas.
  #onRow(event, action, here) {
    if (!here) return;
    event.preventDefault();
    const x = this.#x;
    const key = here.dataset.key;
    if (action === 'activate') x.activate(key);
    else if (action === 'rename') x.rename(key);
    else if (action === 'delete') { x.select(key, false); void x.removal().trash(key); }
    else if (action === 'menu') x.rowMenu(key, here.querySelector('[data-menu]') || here);
  }

  // Le nombre de vignettes par rangée : celles qui sont à la hauteur de la première.
  #columns() {
    const rows = [...this.#x.list().querySelectorAll('[data-key]')];
    return rows.filter(row => row.offsetTop === rows[0].offsetTop).length;
  }

  // Les touches du presse-papiers sont à l'explorateur quand le clavier est chez lui, ou nulle part (le corps de la page : la liste vient d'être redessinée, la
  // ligne qui l'avait n'existe plus) ; pas quand une fenêtre, un menu ou un autre panneau l'a.
  #ours(target) {
    const root = this.#x.root();
    const doc = root.ownerDocument;
    return root.contains(target) || target === doc.body || target === doc.documentElement;
  }

  // Du texte est choisi dans la page (la personne en a surligné) : Ctrl+C et Ctrl+X le copient, comme partout.
  #hasTextSelected() {
    const selection = this.#x.root().ownerDocument.getSelection();
    return Boolean(selection && !selection.isCollapsed && String(selection).trim());
  }

  // Le presse-papiers et Ctrl+D (js/explorer/explorer-clipboard.js), l'annulation (Ctrl+Z : le dernier geste revient) et le rétablissement (Ctrl+Y ou
  // Ctrl+Maj+Z : on le refait ; js/files/undo-stack.js). Copier, couper et dupliquer visent la ligne choisie, sinon celle où est le clavier ; coller n'a besoin
  // d'aucune ligne (un dossier vide se colle). Pendant un choix de fichier pour une app, rien de tout cela : comme « Nouveau » et la corbeille, il est grisé.
  #onClipboard(action, event) {
    const x = this.#x;
    if (x.choice()) { x.opts().notice(x.opts().i18n.t('ex.choose.newOff')); return; }
    if (action === 'undo' || action === 'redo') { void x.undo()[action](); return; }
    if (action === 'paste') { void x.clipboard().paste(); return; }
    if (action === 'duplicate' && event.repeat) return; // la touche tenue enfoncée ne fait qu'une copie
    const key = this.#keyOf(event);
    if (key) void x.clipboard().take(key, action);
  }

  // La clé de la ligne que vise un geste : la ligne choisie, sinon celle où est le clavier (à l'ouverture, le clavier est sur la première ligne sans qu'aucune
  // soit choisie).
  #keyOf(event) {
    const x = this.#x;
    if (x.state().sel && x.keys().includes(x.state().sel)) return x.state().sel;
    const here = event.target && typeof event.target.closest === 'function' ? event.target.closest('[data-key]') : null;
    return here ? here.dataset.key : null;
  }
}
