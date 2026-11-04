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

// La vue en vignettes : la largeur de la grille, le nombre de vignettes, de colonnes posées, la largeur de la plus étroite, et combien disent leur poids (toutes doivent). Null quand la vue n'est pas celle des vignettes.
export function measureTiles() {
  const grid = document.querySelector('.th-grid');
  if (!grid) return null;
  const tiles = [...document.querySelectorAll('.th')];
  const weighed = tiles.filter(tile => tile.querySelector('.tw') && tile.querySelector('.tw').textContent.trim() !== '').length;
  return { grid: grid.clientWidth, tiles: tiles.length, columns: new Set(tiles.map(tile => Math.round(tile.getBoundingClientRect().left))).size, narrowest: Math.min(...tiles.map(tile => tile.getBoundingClientRect().width)), weighed };
}

// Les colonnes de la liste et le pied de fenêtre (le poids, demande du porteur du 04/11) : où est chaque en-tête (ils ne doivent pas se recouvrir), ce que chaque cellule de type, de poids et de
// date coupe de son texte (rien : une cellule dont le texte dépasse est coupée par « … » ou déborde), l'écart du poids au bord droit de sa colonne (collé), et le total du pied de fenêtre (entier,
// entre la barre d'information et les boutons, sans les recouvrir) avec la case « + pièces jointes » (demande du 04/11, lot 2) : entière, sans recouvrir ni le total ni les boutons, sa case assez grande pour la souris.
// Null quand la vue n'est pas la liste.
export function measureColumns() {
  const head = document.querySelector('.ls-head');
  if (!head) return null;
  const shown = element => element.getClientRects().length > 0;
  const box = element => element.getBoundingClientRect();
  const tenth = value => Math.round(value * 10) / 10;
  const headers = [...head.querySelectorAll('.hd')].filter(shown).map(element => ({ key: element.dataset.sort, left: box(element).left, right: box(element).right, sort: element.getAttribute('aria-sort'), text: element.textContent }));
  const cut = [...document.querySelectorAll('.ls-row .wt, .ls-row .md, .ls-row .pill')].filter(shown)
    .filter(element => element.scrollWidth - element.clientWidth > 1)
    .map(element => ({ cell: element.classList.contains('wt') ? 'poids' : (element.classList.contains('md') ? 'date' : 'type'), text: element.textContent, by: tenth(element.scrollWidth - element.clientWidth) }));
  const textBox = element => { const range = document.createRange(); range.selectNodeContents(element); return range.getBoundingClientRect(); };
  const gaps = [...document.querySelectorAll('.ls-row .wt')].filter(shown).map(element => tenth(box(element).right - textBox(element).right));
  const foot = document.querySelector('.ex-foot');
  const total = foot && foot.querySelector('.ex-total');
  const info = foot && foot.querySelector('.ex-info');
  const open = foot && foot.querySelector('.ex-foot > button');
  const close = foot && foot.querySelector('.ex-foot > button:last-child');
  const pj = foot && foot.querySelector('.ex-pj');
  const pjInput = pj && pj.querySelector('input');
  const number = total && total.querySelector('.tot-n');
  // Les éléments du pied qui se recouvrent (deux rectangles qui se croisent : le total et la case s'empilent sous 520 px sans se recouvrir).
  const crossings = named => {
    const found = [];
    const items = Object.entries(named).filter(([, element]) => element);
    items.forEach(([nameA, a], i) => items.slice(i + 1).forEach(([nameB, b]) => {
      const [ra, rb] = [box(a), box(b)];
      if (ra.left < rb.right - 0.5 && rb.left < ra.right - 0.5 && ra.top < rb.bottom - 0.5 && rb.top < ra.bottom - 0.5) found.push(`${nameA}/${nameB}`);
    }));
    return found;
  };
  return {
    headers, cut, gaps: { max: gaps.length ? Math.max(...gaps) : null, min: gaps.length ? Math.min(...gaps) : null },
    foot: total ? {
      text: total.textContent, number: number ? number.textContent : '', shown: shown(total), cut: tenth(total.scrollWidth - total.clientWidth), crossings: crossings({ info, total, pj, open, close }),
      inside: box(total).left >= box(foot).left - 0.5 && box(total).right <= box(foot).right + 0.5, info: tenth(box(info).width), title: total.title,
      pj: pj ? {
        shown: shown(pj), text: pj.textContent.trim(), cut: tenth(pj.scrollWidth - pj.clientWidth),
        inside: box(pj).left >= box(foot).left - 0.5 && box(pj).right <= box(foot).right + 0.5, input: [Math.round(box(pjInput).width), Math.round(box(pjInput).height)], title: pj.title,
      } : null,
    } : null,
  };
}

// Les en-têtes et les cellules de `measureColumns` : les en-têtes de la vue (la liste sous 600 px perd « Modifié » et « Par »), qui ne se recouvrent pas ; aucune cellule coupée ; le poids collé au bord droit de sa colonne.
function bodyFaults(columns, narrow, note) {
  const expected = narrow ? ['name', 'type', 'poids'] : ['name', 'type', 'poids', 'mod', 'by'];
  const keys = columns.headers.map(header => header.key);
  if (keys.join() !== expected.join()) note('en-têtes de colonne', `les en-têtes sont ${keys.join(', ')} au lieu de ${expected.join(', ')}`);
  columns.headers.slice(1).forEach((header, i) => {
    const before = columns.headers[i];
    if (before.right > header.left + 0.5) note('en-têtes qui se recouvrent', `« ${before.text} » (jusqu'à ${before.right.toFixed(1)}) recouvre « ${header.text} » (dès ${header.left.toFixed(1)})`);
  });
  for (const cut of columns.cut) note(`cellule coupée (${cut.cell})`, `« ${cut.text} » est coupé de ${cut.by} px`);
  if (columns.gaps.max !== null && columns.gaps.max > 1) note('poids décollé du bord', `un poids est à ${columns.gaps.max} px du bord droit de sa colonne`);
}

// Le total du pied de fenêtre : affiché, égal à `total` (le texte attendu, quand l'essai le connaît), entier, dans le pied, entre la barre d'information et les boutons, avec son infobulle ; et la case
// « + pièces jointes » : là, entière (« + pièces jointes » se lit en entier), dans le pied, entre le total et les boutons, avec une case d'au moins 13 px et une infobulle.
function footFaults(foot, total, note) {
  if (!foot || !foot.shown || !foot.text.trim()) { note('total du pied', 'le total n\'est pas affiché'); return; }
  if (total !== null && foot.number !== total) note('total du pied', `le total est « ${foot.number} » au lieu de « ${total} »`);
  if (foot.cut > 1) note('total du pied', `le total « ${foot.text} » est coupé de ${foot.cut} px`);
  if (!foot.inside) note('total du pied', `le total « ${foot.text} » sort du pied de fenêtre`);
  if (foot.crossings.length) note('pied de fenêtre', `ces éléments du pied se recouvrent : ${foot.crossings.join(', ')}`);
  if (!foot.title) note('total du pied', 'le total n\'a pas d\'infobulle');
  const { pj } = foot;
  if (!pj || !pj.shown || !pj.text) { note('case « + pièces jointes »', 'la case n\'est pas affichée'); return; }
  if (pj.cut > 1) note('case « + pièces jointes »', `« ${pj.text} » est coupé de ${pj.cut} px`);
  if (!pj.inside) note('case « + pièces jointes »', `« ${pj.text} » sort du pied de fenêtre`);
  if (pj.input[0] < 13 || pj.input[1] < 13) note('case « + pièces jointes »', `la case à cocher mesure ${pj.input.join(' × ')} px (au moins 13 × 13)`);
  if (!pj.title) note('case « + pièces jointes »', 'la case n\'a pas d\'infobulle');
}

// Ce que `measureColumns` dit d'anormal (côté Node : un écart est { kind, text }), colonnes et pied de fenêtre. `tag` : où l'on mesure (largeur, langue, mode).
export function columnFaults(columns, narrow, tag, total = null) {
  if (!columns) return [{ kind: 'la liste', text: `${tag} : la liste n'a pas d'en-tête` }];
  const faults = [];
  const note = (kind, text) => faults.push({ kind, text: `${tag} : ${text}` });
  bodyFaults(columns, narrow, note);
  footFaults(columns.foot, total, note);
  return faults;
}
