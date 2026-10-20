// Les icônes de GFS : au trait, une icône = une fonction, jamais d'emoji ni de police d'icônes (charte). Le tracé vient de la maquette du 12/10
// (`maquettes/maquette-widget-suite.html`) ; la liste des icônes (`icone` du manifeste) passe au kit à l'étape 3.
// Le dessin est dans la page une seule fois (une feuille de symboles) ; chaque icône est un `<use>` : pas de style en ligne, la politique de
// sécurité du contenu de GFS le refuse.

const NS = 'http://www.w3.org/2000/svg';

const ICONS = {
  doc: '<path d="M7 2h7l4 4v16H7z"/><path d="M14 2v4h4"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M3 6l9 7 9-7"/>',
  macro: '<rect x="2" y="6" width="14" height="16" rx="1.5"/><path d="M7 2h11a1.5 1.5 0 0 1 1.5 1.5V18"/>',
  grid: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9.3h18M3 14.6h18M9 4v16M15 4v16"/>',
  folder: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/>',
  slides: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8"/>',
  dash: '<rect x="3" y="3" width="8" height="10" rx="1.2"/><rect x="13" y="3" width="8" height="6" rx="1.2"/><rect x="3" y="15" width="8" height="6" rx="1.2"/><rect x="13" y="11" width="8" height="10" rx="1.2"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pin: '<path d="M9 3h6l-1 6 3 3H7l3-3z"/><path d="M12 12v9"/>',
  'chev-right': '<path d="M9 6l6 6-6 6"/>',
  'chev-down': '<path d="M6 9l6 6 6-6"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.8" cy="6" r="1"/><circle cx="3.8" cy="12" r="1"/><circle cx="3.8" cy="18" r="1"/>',
  tiles: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  more: '<circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.1"/>',
  warning: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.2v.1"/>',
  modules: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M17.5 14v7M14 17.5h7"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8 20v-6M12.5 20V9M17 20v-9"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14"/>',
  bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.7 3.9 5.7 3.9 9s-1.3 6.3-3.9 9c-2.6-2.7-3.9-5.7-3.9-9s1.3-6.3 3.9-9z"/>',
  // Les gestes sur un fichier (menu d'une ligne) : un tracé chacun.
  open: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  edit: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  move: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M9 14h6M13 11l3 3-3 3"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/>',
};

export const iconNames = () => Object.keys(ICONS);

// Pose la feuille de symboles dans la page (une fois).
export function installSprite(doc = document) {
  if (doc.getElementById('gfs-sprite')) return;
  const symbols = Object.entries(ICONS).map(([id, body]) => `<symbol id="i-${id}" viewBox="0 0 24 24">${body}</symbol>`).join('');
  const xml = `<svg xmlns="${NS}" id="gfs-sprite" class="sprite" aria-hidden="true" focusable="false"><defs>${symbols}</defs></svg>`;
  const parsed = new DOMParser().parseFromString(xml, 'image/svg+xml');
  doc.body.prepend(doc.importNode(parsed.documentElement, true));
}

// Une icône : un `<svg class="ic">` qui renvoie au symbole. Un nom inconnu donne l'icône de document (jamais un trou).
export function icon(name, extraClass = '') {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', extraClass ? `ic ${extraClass}` : 'ic');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(NS, 'use');
  use.setAttribute('href', `#i-${Object.hasOwn(ICONS, name) ? name : 'doc'}`);
  svg.append(use);
  return svg;
}
