// Les touches de l'explorateur (décision du porteur, 04/11 : tout se fait aussi au clavier). Des fonctions sans effet de bord : la touche tapée -> le nom du
// geste, ou null ; c'est l'explorateur (js/explorer/explorer.js) qui sait ce que chaque geste fait de la ligne choisie.
//
// Les touches : ↑ ↓ (← → en vignettes ; ↑ ↓ y changent de rangée), Début, Fin, Entrée (ouvrir ; à la corbeille : restaurer), F2 (renommer), Suppr (mettre à la
// corbeille ; à la corbeille : supprimer pour de bon), Retour arrière (le dossier parent), Maj+F10 ou la touche Menu (le menu de la ligne, comme le clic
// droit), « / » (la recherche), Échap (js/explorer/explorer.js), et, avec Ctrl ou ⌘ (`clipboardAction`), le presse-papiers Ctrl+C (copier), Ctrl+X (couper),
// Ctrl+V (coller), Ctrl+D (dupliquer, d'un geste : la copie se range à côté du fichier, comme « Dupliquer » du menu), Ctrl+Z (annuler le dernier geste, un par
// appui : js/files/undo-stack.js) et Ctrl+Y ou Ctrl+Maj+Z (rétablir le geste qu'on vient d'annuler).
// Toute autre touche tapée avec Ctrl, Alt ou Méta n'est pas une des nôtres : Ctrl+F (recherche dans la page), Alt+← (page précédente), Ctrl+N, Ctrl+T et Ctrl+W
// sont au navigateur, qui ne les laisse pas tous à une page. Ctrl+D est aussi le marque-page du navigateur, mais Firefox ne la réserve pas (faits vérifiés
// 106) : l'explorateur la retient (`preventDefault`) quand le clavier est chez lui ; dans un champ de saisie, `clipboardAction` rend null et elle reste le
// marque-page.

// Les touches qui valent le même geste en liste et en vignettes.
const PLAIN_KEYS = new Map([['Home', 'first'], ['End', 'last'], ['Enter', 'activate'], ['F2', 'rename'], ['Delete', 'delete'], ['ContextMenu', 'menu']]);
// Les flèches : le geste en liste, puis en vignettes (← → ne valent qu'en vignettes ; ↑ ↓ y changent de rangée).
const ARROWS = new Map([['ArrowDown', ['next', 'down']], ['ArrowUp', ['prev', 'up']], ['ArrowRight', [null, 'next']], ['ArrowLeft', [null, 'prev']]]);

// `view` : { display: 'list'|'tiles', filtering } -> 'next' | 'prev' | 'down' | 'up' | 'first' | 'last' | 'activate' | 'rename' | 'delete' | 'parent' | 'menu'
//   | null. 'down' et 'up' ne valent qu'en vignettes (une rangée plus bas, plus haut) ; en liste, ↓ et ↑ sont 'next' et 'prev'. Retour arrière ne remonte pas
//   pendant une recherche : c'est alors le champ de recherche qui l'efface, la liste ne montre pas un dossier.
export function listAction(event, { display, filtering }) {
  const { key, shiftKey, ctrlKey, altKey, metaKey } = event;
  if (ctrlKey || altKey || metaKey) return null;
  if (shiftKey) return key === 'F10' ? 'menu' : null;
  if (key === 'Backspace') return filtering ? null : 'parent';
  if (ARROWS.has(key)) return ARROWS.get(key)[display === 'tiles' ? 1 : 0];
  return PLAIN_KEYS.get(key) || null;
}

// Les gestes qui déplacent le choix : l'index visé, d'après l'index du choix (`at`, -1 sans choix) et le nombre de lignes ; `columns()` rend le nombre de
// colonnes de la grille (lu seulement en vignettes).
const MOVES = new Map([
  ['next', at => at + 1],
  ['prev', at => (at < 0 ? 0 : at - 1)],
  ['first', () => 0],
  ['last', (at, count) => count - 1],
  ['down', (at, count, columns) => stepRow(at, columns(), count, 1)],
  ['up', (at, count, columns) => stepRow(at, columns(), count, -1)],
]);

// L'index que vise un geste de déplacement (hors de la liste : l'appelant le ramène dedans), ou null quand le geste n'en est pas un.
export function moveTarget(action, at, count, columns) {
  const move = MOVES.get(action);
  return move ? move(at, count, columns) : null;
}

// La personne tape-t-elle dans un champ (la recherche, une fenêtre) ? Ses touches y gardent leur sens.
const typingIn = target => Boolean(target && typeof target.closest === 'function' && target.closest('input, textarea, select, [contenteditable]'));

// « / » met le clavier dans la recherche, sauf quand la personne tape déjà dans un champ (où « / » est un signe comme un autre).
export function isSearchKey(event) {
  if (event.key !== '/' || event.ctrlKey || event.altKey || event.metaKey) return false;
  return !typingIn(event.target);
}

// Le presse-papiers, la copie d'un geste, l'annulation et le rétablissement : Ctrl+C -> 'copy', Ctrl+X -> 'cut', Ctrl+V -> 'paste', Ctrl+D -> 'duplicate',
// Ctrl+Z -> 'undo', Ctrl+Y ou Ctrl+Maj+Z -> 'redo' (⌘ pour Ctrl sur Mac), ou null. Pas d'Alt (AltGr se tape avec Ctrl et Alt sur certains claviers) ; Maj ne
// compte qu'avec Z (Ctrl+Maj+V colle sans mise en forme, Ctrl+Maj+D met tous les onglets en marque-pages : ce n'est pas à nous) ; la majuscule d'un
// verrouillage des capitales compte. Dans un champ de saisie (la recherche), ces touches copient, coupent, collent, annulent et rétablissent le texte : elles
// ne sont pas à l'explorateur.
export function clipboardAction(event) {
  const { key, ctrlKey, metaKey, altKey, shiftKey, target } = event;
  if (!(ctrlKey || metaKey) || altKey || typeof key !== 'string' || typingIn(target)) return null;
  const letter = key.toLowerCase();
  if (shiftKey) return letter === 'z' ? 'redo' : null;
  return { c: 'copy', x: 'cut', v: 'paste', d: 'duplicate', z: 'undo', y: 'redo' }[letter] || null;
}

// Le chemin du dossier parent : « Factures/2024 » -> « Factures » ; la racine reste la racine.
export const parentPath = path => path.split('/').slice(0, -1).join('/');

// Où va le clavier après ↓ (`direction` 1) ou ↑ (-1) en vignettes : le rang de la vignette `at` déplacé d'une rangée (`columns` vignettes par rangée, `count`
// en tout). Il ne sort pas de la grille ; de l'avant-dernière rangée, ↓ va à la dernière vignette quand la dernière rangée est incomplète. `at` < 0 (rien n'est
// choisi) : la première ; sans vignette, -1.
export function stepRow(at, columns, count, direction) {
  if (count === 0) return -1;
  if (at < 0) return 0;
  const width = Math.max(1, columns);
  const next = at + direction * width;
  if (next >= 0 && next < count) return next;
  const lastRow = Math.floor((count - 1) / width);
  return direction > 0 && Math.floor(at / width) < lastRow ? count - 1 : at;
}
