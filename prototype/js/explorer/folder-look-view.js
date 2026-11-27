// Ce que l'explorateur dessine d'un dossier qui a une apparence (js/files/folder-looks.js) : l'icône (le dossier, le dossier avec un repère, ou l'émoji) et la
// couleur (l'attribut `data-look` de la ligne, que css/folder-looks.css peint). Rien ne se calcule ici : l'apparence est donnée par `ctx.lookOf(chemin)`.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';

// L'apparence du dossier `path` d'après le contexte de la vue, ou null (les essais de l'explorateur seul n'en donnent pas).
export const lookIn = (ctx, path) => (ctx && typeof ctx.lookOf === 'function' ? ctx.lookOf(path) : null);

// La couleur de l'apparence, pour l'attribut `data-look` ; null sans couleur.
export const lookColor = look => (look && look.color ? look.color : null);

// L'icône du dossier : un émoji prend la place du dessin (même taille, `aria-hidden` : le nom du dossier dit tout), sinon le dossier, avec son repère s'il en a
// un.
// `cls` : la classe du dessin ('fld' dans le volet, la liste et les vignettes, qui le remplissent ; '' dans la barre d'information, où le dossier est au
//   trait).
export function folderIcon(look, cls = 'fld') {
  if (look && look.emoji) return h('span', { class: 'fe', 'aria-hidden': 'true' }, look.emoji);
  return icon(look && look.glyph ? `fl-${look.glyph}` : 'folder', cls);
}
