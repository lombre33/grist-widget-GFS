// Ce que mesure la liste de l'explorateur, écrit une fois pour les deux essais qui la mesurent : `labo/run-liste.mjs` (dans un vrai Grist, sous Chromium, avec Playwright) et
// `test/interfaces-firefox.test.mjs` (sous Firefox, sans Grist). Les fonctions `measure…` s'exécutent DANS la page (Playwright ou `page.run` les y envoient en texte) : elles ne voient rien de ce module.
export const ROW_HEIGHT = 28; // la hauteur d'une ligne de la liste (css/explorer.css : `.ls-row`)
export const ROW_BUTTON = 24; // « Épingler » et « Plus d'actions » : 24 × 24
export const TILE_MIN = 112; // la plus petite vignette de la vue en vignettes
export const TILE_GAP = 8;
export const TILE_PAD = 8;

// Combien de colonnes la grille des vignettes (`repeat(auto-fill, minmax(112px, 1fr))`, 8 px d'écart et de remplissage) pose dans `gridWidth` px.
export const expectedTileColumns = gridWidth => Math.max(1, Math.floor((gridWidth - 2 * TILE_PAD + TILE_GAP) / (TILE_MIN + TILE_GAP)));

// Chaque ligne de la liste (fichier ou dossier) : sa hauteur, l'écart du centre de chaque cellule au centre de son contenu (le filet de 1 px du bas n'en fait pas partie), ce qui en sort par le bas, ses boutons.
export function measureRows() {
  const shown = element => element.getClientRects().length > 0;
  const middleOf = box => (box.top + box.bottom) / 2;
  const tenth = value => Math.round(value * 10) / 10;
  return [...document.querySelectorAll('.ls-row')].map(row => {
    const box = row.getBoundingClientRect();
    const bottom = box.bottom - 1;
    const middle = (box.top + bottom) / 2;
    const cells = [...row.children].filter(shown);
    const inside = [...row.querySelectorAll('.t, .pill, .md, .who, .rb, .nm .ic')].filter(shown);
    return {
      name: (row.querySelector('.t') || {}).textContent, folder: row.classList.contains('folder'), height: box.height,
      off: Math.max(...cells.map(cell => Math.abs(middleOf(cell.getBoundingClientRect()) - middle))),
      out: Math.max(...inside.map(element => element.getBoundingClientRect().bottom)) - bottom,
      buttons: [...row.querySelectorAll('.rb')].map(element => { const rect = element.getBoundingClientRect(); return [tenth(rect.width), tenth(rect.height)]; }),
    };
  });
}

// La vue en vignettes : la largeur de la grille, le nombre de vignettes, de colonnes posées, et la largeur de la plus étroite. Null quand la vue n'est pas celle des vignettes.
export function measureTiles() {
  const grid = document.querySelector('.th-grid');
  if (!grid) return null;
  const tiles = [...document.querySelectorAll('.th')];
  return { grid: grid.clientWidth, tiles: tiles.length, columns: new Set(tiles.map(tile => Math.round(tile.getBoundingClientRect().left))).size, narrowest: Math.min(...tiles.map(tile => tile.getBoundingClientRect().width)) };
}
