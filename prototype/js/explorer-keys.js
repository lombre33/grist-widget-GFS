// Les touches de l'explorateur (décision du porteur, 04/11 : tout se fait aussi au clavier). Des fonctions sans effet de bord : la touche tapée -> le nom du geste, ou null ; c'est l'explorateur
// (js/explorer.js) qui sait ce que chaque geste fait de la ligne choisie.
//
// Les touches : ↑ ↓ (← → en vignettes ; ↑ ↓ y changent de rangée), Début, Fin, Entrée (ouvrir ; à la corbeille : restaurer), F2 (renommer), Suppr (mettre à la corbeille ; à la corbeille : supprimer
// pour de bon), Retour arrière (le dossier parent), Maj+F10 ou la touche Menu (le menu de la ligne, comme le clic droit), « / » (la recherche), Échap (js/explorer.js), et, avec Ctrl ou ⌘ (`clipboardAction`), le presse-papiers
// Ctrl+C (copier), Ctrl+X (couper), Ctrl+V (coller) et Ctrl+Z (annuler le dernier geste, un par appui : js/undo-stack.js). Toute autre touche tapée avec Ctrl, Alt ou Méta n'est pas une des nôtres : Ctrl+D (marque-page), Ctrl+F (recherche dans
// la page), Alt+← (page précédente), Ctrl+N, Ctrl+T et Ctrl+W sont au navigateur, qui ne les laisse pas tous à une page ; aucun geste de GFS n'est lié à une touche qu'on ne peut pas avoir partout.
// Ctrl+D (dupliquer, dans d'autres explorateurs) n'est donc pas liée : « Dupliquer » est dans le menu de la ligne, et Ctrl+C puis Ctrl+V colle la copie.

// `view` : { display: 'list'|'tiles', filtering } -> 'next' | 'prev' | 'down' | 'up' | 'first' | 'last' | 'activate' | 'rename' | 'delete' | 'parent' | 'menu' | null.
// 'down' et 'up' ne valent qu'en vignettes (une rangée plus bas, plus haut) ; en liste, ↓ et ↑ sont 'next' et 'prev'. Retour arrière ne remonte pas pendant une recherche : c'est alors le champ de
// recherche qui l'efface, la liste ne montre pas un dossier.
export function listAction(event, { display, filtering }) {
  const { key, shiftKey, ctrlKey, altKey, metaKey } = event;
  if (ctrlKey || altKey || metaKey) return null;
  if (shiftKey) return key === 'F10' ? 'menu' : null;
  const tiles = display === 'tiles';
  switch (key) {
    case 'ArrowDown': return tiles ? 'down' : 'next';
    case 'ArrowUp': return tiles ? 'up' : 'prev';
    case 'ArrowRight': return tiles ? 'next' : null;
    case 'ArrowLeft': return tiles ? 'prev' : null;
    case 'Home': return 'first';
    case 'End': return 'last';
    case 'Enter': return 'activate';
    case 'F2': return 'rename';
    case 'Delete': return 'delete';
    case 'ContextMenu': return 'menu';
    case 'Backspace': return filtering ? null : 'parent';
    default: return null;
  }
}

// La personne tape-t-elle dans un champ (la recherche, une fenêtre) ? Ses touches y gardent leur sens.
const typingIn = target => Boolean(target && typeof target.closest === 'function' && target.closest('input, textarea, select, [contenteditable]'));

// « / » met le clavier dans la recherche, sauf quand la personne tape déjà dans un champ (où « / » est un signe comme un autre).
export function isSearchKey(event) {
  if (event.key !== '/' || event.ctrlKey || event.altKey || event.metaKey) return false;
  return !typingIn(event.target);
}

// Le presse-papiers et l'annulation : Ctrl+C -> 'copy', Ctrl+X -> 'cut', Ctrl+V -> 'paste', Ctrl+Z -> 'undo' (⌘ pour Ctrl sur Mac), ou null. Ni Alt (AltGr se tape avec Ctrl et Alt sur certains claviers) ni Maj (Ctrl+Maj+V colle sans mise
// en forme) ; la majuscule d'un verrouillage des capitales compte. Dans un champ de saisie (la recherche), ces touches copient, coupent, collent et annulent le texte : elles ne sont pas à l'explorateur. Ctrl+Maj+Z (rétablir, ailleurs) n'est pas liée : il n'y a pas de « rétablir ».
export function clipboardAction(event) {
  const { key, ctrlKey, metaKey, altKey, shiftKey, target } = event;
  if (!(ctrlKey || metaKey) || altKey || shiftKey || typeof key !== 'string' || typingIn(target)) return null;
  return { c: 'copy', x: 'cut', v: 'paste', z: 'undo' }[key.toLowerCase()] || null;
}

// Le chemin du dossier parent : « Factures/2024 » -> « Factures » ; la racine reste la racine.
export const parentPath = path => path.split('/').slice(0, -1).join('/');

// Où va le clavier après ↓ (`direction` 1) ou ↑ (-1) en vignettes : le rang de la vignette `at` déplacé d'une rangée (`columns` vignettes par rangée, `count` en tout). Il ne sort pas de la grille ;
// de l'avant-dernière rangée, ↓ va à la dernière vignette quand la dernière rangée est incomplète. `at` < 0 (rien n'est choisi) : la première ; sans vignette, -1.
export function stepRow(at, columns, count, direction) {
  if (count === 0) return -1;
  if (at < 0) return 0;
  const width = Math.max(1, columns);
  const next = at + direction * width;
  if (next >= 0 && next < count) return next;
  const lastRow = Math.floor((count - 1) / width);
  return direction > 0 && Math.floor(at / width) < lastRow ? count - 1 : at;
}
