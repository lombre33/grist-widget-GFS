// Les icônes de GFS : au trait, une icône = une fonction, jamais d'emoji ni de police d'icônes (charte). Le tracé vient de la maquette du 12/10
// (`maquettes/maquette-widget-suite.html`) ; la liste des icônes (`icone` du manifeste) passe au kit à l'étape 3.
// Le dessin est dans la page une seule fois (une feuille de symboles) ; chaque icône est un `<use>` : pas de style en ligne, la politique de
// sécurité du contenu de GFS le refuse.

import { LOOK_ICONS } from './icons-looks.js';

const NS = 'http://www.w3.org/2000/svg';

const ICONS = {
  doc: '<path d="M7 2h7l4 4v16H7z"/><path d="M14 2v4h4"/>',
  // Un raccourci vers un fichier (js/files/shortcuts.js) : la page, et la flèche qui renvoie ailleurs (le mot « Raccourci » l'accompagne toujours).
  shortcut: '<path d="M7 2h7l4 4v16H7z"/><path d="M14 2v4h4"/><path d="M10.5 18l5-5M11 13h4.5v4.5"/>',
  // Un PDF gardé par GFS : la page, et les lignes de ce qu'elle porte (le mot « PDF » l'accompagne toujours).
  pdf: '<path d="M7 2h7l4 4v16H7z"/><path d="M14 2v4h4"/><path d="M10 12h5M10 15.5h5M10 19h3"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M3 6l9 7 9-7"/>',
  // Un macro-modèle : trois feuilles empilées, celles d'un document, d'une grille et d'une présentation (décision du porteur, 24/11). Dans
  // l'explorateur, une ligne de cette famille les peint du bleu, du vert et de l'orange du document, de la grille et de la présentation (variables
  // `--mc-*`, css/explorer.css) ; ailleurs, et grisée, elle est au trait, d'une seule couleur.
  macro: '<rect class="mc-1" x="2" y="10" width="12" height="12" rx="1.5"/><path class="mc-2" d="M6 6.5h9.5A1.5 1.5 0 0 1 17 8v11"/>'
    + '<path class="mc-3" d="M10 3h9a1.5 1.5 0 0 1 1.5 1.5V15"/>',
  grid: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9.3h18M3 14.6h18M9 4v16M15 4v16"/>',
  folder: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/>',
  // Créer un dossier : le dossier et un « + » (l'article « Nouveau dossier » du menu « Nouveau »).
  'folder-plus': '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M12 10.5v6M9 13.5h6"/>',
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
  users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5c0-3.2 2.7-5.2 6-5.2s6 2 6 5.2"/><path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8"/><path d="M17 14.6c2.4.5 4 2.3 4 4.9"/>',
  // Ajouter une personne (le bouton « Ajouter » de l'annuaire) : la personne, et un « + » à sa droite.
  'user-plus': '<circle cx="9.5" cy="8" r="3.6"/><path d="M3 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M19 6.5v6M16 9.5h6"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  // Les fichiers ouverts (la vue « Ouverts ») : trois feuilles en pile.
  stack: '<path d="M12 3.5l8.5 4.2L12 12 3.5 7.7z"/><path d="M3.5 12L12 16.2 20.5 12"/><path d="M3.5 16.3L12 20.5l8.5-4.2"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.1"/>',
  warning: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.2v.1"/>',
  modules: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M17.5 14v7M14 17.5h7"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8 20v-6M12.5 20V9M17 20v-9"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14"/>',
  // Lire un fichier que GFS garde : un livre ouvert (télécharger garde sa flèche).
  read: '<path d="M12 6.5C10.2 5.2 7.7 4.5 4 4.5v13c3.7 0 6.2.7 8 2 1.8-1.3 4.3-2 8-2v-13c-3.7 0-6.2.7-8 2z"/><path d="M12 6.5v13"/>',
  // Importer : la flèche qui entre dans un bac (le fichier choisi arrive dans l'app).
  import: '<path d="M12 3v12M7.5 10.5L12 15l4.5-4.5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.7 3.9 5.7 3.9 9s-1.3 6.3-3.9 9c-2.6-2.7-3.9-5.7-3.9-9s1.3-6.3 3.9-9z"/>',
  // Le thème (l'ambiance et la couleur de GFS et de ses apps) : une palette de peintre et ses trois pastilles.
  palette: '<path d="M12 3C7 3 3 6.9 3 11.7S7 21 12 21c1.2 0 2-.9 2-1.9 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H18a3 3 0 0 0 3-3C21 6.7 17 3 12 3Z"/><circle cx="7.6" cy="11.2" r="1"/><circle cx="10.2" cy="7.4" r="1"/><circle cx="14.8" cy="7.4" r="1"/>',
  // Les réglages de GFS (langue, thème, position de la barre, « À propos ») : deux curseurs. Ce n'est pas une roue : Publipostage+ a la sienne, en haut à
  // droite, pour ses propres réglages (une icône = une fonction).
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  // Les notifications (la cloche, à droite de l'en-tête de l'explorateur) : une cloche et son battant. À ajouter à la charte (icônes de la section 1).
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.6 2.4H4.4z"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  // Les gestes sur un fichier (menu d'une ligne) : un tracé chacun.
  // « Ouvrir dans un nouvel onglet » (la recherche de fichiers de la barre, js/explorer/opened-bar.js) : un onglet et son « + ».
  'tab-plus': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 9v6M9 12h6"/>',
  open: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  edit: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  move: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M9 14h6M13 11l3 3-3 3"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/>',
  // Restaurer : la flèche qui revient en arrière (le fichier sort de la corbeille et reprend sa place).
  refresh: '<path d="M20 11a8 8 0 0 0-14.7-3"/><path d="M4.5 4v4h4"/><path d="M4 13a8 8 0 0 0 14.7 3"/><path d="M19.5 20v-4h-4"/>',
  restore: '<path d="M3 4v5.5h5.5"/><path d="M3.8 15a8.5 8.5 0 1 0 2.2-8.2L3 9.5"/>',
  // Un modèle de départ (l'article « Depuis un modèle… » du menu « Nouveau ») : une page, son bandeau et ses deux blocs.
  template: '<rect x="3" y="4" width="18" height="5" rx="1.2"/><rect x="3" y="12" width="8" height="8" rx="1.2"/><rect x="14" y="12" width="7" height="8" rx="1.2"/>',
  // Un formulaire : des questions à cocher (type « Formulaire » de Form+, et l'app elle-même).
  form: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M7.5 8.2l1.2 1.2 2-2.4M13 8.5h4"/><path d="M7.5 14.2l1.2 1.2 2-2.4M13 14.5h4"/>',
  // Le correcteur du navigateur (bouton « LanguageTool » de la barre, contrats 5.2, point 13) : un A que coche un trait.
  spell: '<path d="M3 17.5l4.5-11 4.5 11M4.9 13h5.2"/><path d="M13.5 15l3 3 5-7"/>',
  // La position de la barre de GFS : un cadre dont le trait dit de quel côté elle est.
  'dock-left': '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M9 4v16"/>',
  'dock-right': '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M15 4v16"/>',
  'dock-top': '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 10h18"/>',
  'dock-bottom': '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 14h18"/>',
  // La ligne de travail (contrats 4.5) : la ligne d'un tableau que désigne la flèche ; une table de Grist ; la page qui décide (le lien) ; revenir.
  'work-row': '<rect x="5" y="4" width="16" height="16" rx="1.5"/><path d="M5 9.3h16M5 14.6h16"/><path d="M1.5 10.2l2.5 1.8-2.5 1.8"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9h18M9 9v11"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  // Les dépendances (le menu « Réglages ») : une caisse et ses arêtes.
  package: '<path d="M12 3l8.5 4.5v9L12 21l-8.5-4.5v-9z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9"/>',
  shield: '<path d="M12 3l7.5 3v5.6c0 4.3-3 8-7.5 9.4-4.5-1.4-7.5-5.1-7.5-9.4V6z"/>',
  'chev-left': '<path d="M15 6l-6 6 6 6"/>',
  'chev-up': '<path d="M6 15l6-6 6 6"/>',
  // Le module Annuaire (la barre de GFS et l'en-tête de l'explorateur) : un carnet d'adresses, sa silhouette et ses onglets ; le moins du zoom, « Tout voir »
  // (quatre coins), l'organigramme (une carte, deux cartes dessous) et le téléphone d'une fiche.
  annuaire: '<rect x="5.5" y="3" width="16" height="18" rx="2.2"/><circle cx="13.5" cy="9.8" r="3"/><path d="M8.7 18c.6-2.3 2.6-3.6 4.8-3.6s4.2 1.3 4.8 3.6"/><path d="M2.2 7.5h3.3M2.2 12h3.3M2.2 16.5h3.3"/>',
  minus: '<path d="M5 12h14"/>',
  // Les filtres de la liste de l'annuaire : un entonnoir.
  filter: '<path d="M4 5h16l-6 7v6l-4 2v-8z"/>',
  // Trier : une flèche qui monte et une qui descend (le bouton « Trier » de l'annuaire).
  sort: '<path d="M8 20V4M4.5 7.5 8 4l3.5 3.5M16 4v16M12.5 16.5 16 20l3.5-3.5"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  org: '<rect x="8.5" y="3" width="7" height="5" rx="1"/><rect x="2.5" y="16" width="7" height="5" rx="1"/><rect x="14.5" y="16" width="7" height="5" rx="1"/><path d="M12 8v4M6 16v-4h12v4"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1.5 1.5 0 0 1-1.5 1.5A15.5 15.5 0 0 1 3.5 5.5 1.5 1.5 0 0 1 5 4Z"/>',
  // Le module Guide (la barre de GFS, l'explorateur, l'en-tête) : un poteau et ses deux panneaux de direction ; ce que désigne un rôle d'une démarche : un
  // service (un bâtiment) ou un poste (une mallette) ; et la flèche « hérité de la démarche mère » (un retour en équerre).
  guide: '<path d="M12 3v18M9 21h6"/><path d="M6 5h10l3 2.5-3 2.5H6z"/><path d="M18 12H8l-3 2.5L8 17h10z"/>',
  building: '<path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16"/><path d="M14 10h5a1 1 0 0 1 1 1v10"/><path d="M8 8h2M8 12h2M8 16h2M2.5 21h19"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18"/>',
  // Les types de démarche du guide : un livre (information), un chemin (parcours).
  book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6"/>',
  corner: '<path d="M5 4v9a3 3 0 0 0 3 3h11"/><path d="M15 12l4 4-4 4"/>',
  // Le plan des bâtiments de l'annuaire (27/11) : le plan d'un étage (des murs) et un local (sa porte) ; l'étage est « stack » et
  // le site « pin ».
  plan: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 11h8M11 4v9M11 17v3M15 11h6M15 11v9"/>',
  door: '<path d="M7 21V3.5h10V21M4 21h16"/><path d="M14 12.5v.1"/>',
  // Les repères dessinés dans un dossier et la goutte de « Apparence… » (js/ui/icons-looks.js).
  ...LOOK_ICONS,
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
