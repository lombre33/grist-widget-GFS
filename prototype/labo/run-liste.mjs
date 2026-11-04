// La liste de l'explorateur, dans un vrai Grist (grist-static), à 700 × 400 puis à d'autres largeurs, à la vraie souris (Playwright : événements du pointeur du navigateur, jamais dispatchEvent).
// Demande du porteur (03/11) : « le trait qui sépare les lignes passe au milieu du texte ». Cause : la fenêtre « Thème » (sa feuille, css/modules.css, passe après celle de la liste) avait pris deux noms
// de classe de l'explorateur, `mn` (le bouton « Plus d'actions », devenu une vignette de 58 px dans une ligne de 28) et `th-grid` (la grille des vignettes, devenue la grille de la fenêtre) ; le test
// test/css-classes.test.mjs garde la cause (une classe a un seul propriétaire), cette passe mesure ce qu'on voit. Ce que la passe mesure, à chaque largeur :
//   1. chaque ligne (fichier ou dossier) mesure 28 px, tout son contenu y est centré et n'en sort pas : le filet du bas passe sous le texte, jamais dedans ;
//   2. les boutons « Épingler » et « Plus d'actions » mesurent 24 × 24 ; la souris sur la ligne les montre dans la ligne, et « Plus d'actions » ouvre son menu ;
//   3. la vue en vignettes garde sa grille : des vignettes d'au moins 112 px, autant de colonnes que la place en donne (« auto-fill »), et la fenêtre « Thème » garde la sienne (cinq vignettes, 58 px de haut) ;
//   4. les colonnes de la liste, dont « Poids » (demande du porteur, 04/11) : les en-têtes ne se recouvrent pas (la liste perd « Modifié » et « Par » sous 600 px), aucune cellule n'est coupée, le poids est collé au
//      bord droit de sa colonne, le total du pied de fenêtre est entier, entre la barre d'information et les boutons ; chaque vignette dit son poids.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check } from './lab-common.mjs';
import { ROW_BUTTON, ROW_HEIGHT, TILE_MIN, columnFaults, expectedTileColumns, measureColumns, measureRows, measureTiles } from './mesures-liste.mjs';
import { openThemeWindow } from './reglages-gestes.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `liste-${lang}-${scheme}`;
// 700 : le panneau de référence ; 640 : le portable du porteur (961 px à 150 %) ; 600 : la plus étroite où la liste a toutes ses colonnes ; 520 : la dernière largeur où le volet reste (la liste a perdu « Modifié » et « Par ») ;
// 500 et 400 : la vue étroite (le volet est replié).
const WIDTHS = [700, 640, 600, 520, 500, 400];

const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const warnings = [];
page.on('console', m => { if ((m.type() === 'warning' || m.type() === 'error') && /GFS/.test(m.text())) warnings.push(m.text().slice(0, 200)); });
await lab.fitPanel(undefined, 700, 400);
say('semis :', await seedFiles(lab.frame));
await lab.frame.evaluate(() => location.reload());
await page.waitForTimeout(1000);
const frame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(frame);
await page.waitForTimeout(800);
const shot = name => lab.shotPanel(run, name, frame);

// Les mesures de la liste et des vignettes sont celles de labo/mesures-liste.mjs, que le test sous Firefox (test/interfaces-firefox.test.mjs) reprend.
const listGeometry = () => frame.evaluate(measureRows);
const tilesGeometry = () => frame.evaluate(measureTiles);
const columnsGeometry = () => frame.evaluate(measureColumns);

const display = glyph => frame.locator('button[aria-label]', { has: frame.locator(`use[href="#i-${glyph}"]`) }).click();

for (const width of WIDTHS) {
  await lab.fitPanel(undefined, width, 400);
  await page.waitForTimeout(400);
  const seen = await frame.evaluate(() => innerWidth);
  const tag = `${width} px (le cadre mesure ${seen})`;

  // ---------- 1. et 2. la liste ----------
  const rows = await listGeometry();
  const folders = await frame.locator('.ls-row.folder').count();
  check(`${tag} : la liste a des fichiers et un dossier`, rows.length >= 5 && folders >= 1, { lignes: rows.length, dossiers: folders });
  check(`${tag} : chaque ligne mesure ${ROW_HEIGHT} px`, rows.every(item => item.height === ROW_HEIGHT), rows.map(item => item.height));
  check(`${tag} : le contenu de chaque ligne est centré dedans (à 1 px)`, rows.every(item => item.off <= 1), rows.map(item => [item.name, item.off]));
  check(`${tag} : rien ne sort d'une ligne par le bas : le filet passe sous le texte`, rows.every(item => item.out <= 0.5), rows.map(item => [item.name, item.out]));
  check(`${tag} : les boutons de chaque ligne mesurent ${ROW_BUTTON} × ${ROW_BUTTON}`, rows.every(item => item.buttons.length >= 1 && item.buttons.every(([w, h]) => w === ROW_BUTTON && h === ROW_BUTTON)), rows.map(item => item.buttons));
  const columnProblems = columnFaults(await columnsGeometry(), width < 600, tag);
  check(`${tag} : les en-têtes (Nom, Type, Poids${width < 600 ? '' : ', Modifié, Par'}) ne se recouvrent pas, aucune cellule n'est coupée, le poids est collé au bord, le total du pied est entier`, columnProblems.length === 0, columnProblems.map(item => item.text));
  const target = frame.locator('.ls-row:not(.folder)').first();
  await target.hover();
  const rowBox = await target.boundingBox();
  const moreBox = await target.locator('.rb.mn').boundingBox();
  check(`${tag} : la souris sur la ligne montre « Plus d'actions » dans la ligne`, moreBox && moreBox.y >= rowBox.y - 0.5 && moreBox.y + moreBox.height <= rowBox.y + rowBox.height + 0.5, { ligne: rowBox, bouton: moreBox });
  if (width === 700) await shot('1-liste-survol');
  await target.locator('.rb.mn').click();
  await frame.locator('.menu').waitFor();
  check(`${tag} : « Plus d'actions » ouvre son menu`, (await frame.locator('.menu-item').count()) >= 3);
  await page.keyboard.press('Escape');
  await frame.locator('.menu').waitFor({ state: 'detached' });

  // ---------- 3. les vignettes ----------
  await display('tiles');
  await page.waitForTimeout(200);
  const tiles = await tilesGeometry();
  const expected = expectedTileColumns(tiles.grid);
  check(`${tag} : des vignettes d'au moins ${TILE_MIN} px`, tiles.tiles >= 5 && tiles.narrowest >= TILE_MIN - 0.5, tiles);
  check(`${tag} : autant de colonnes que la place en donne (${expected})`, tiles.columns === expected, { colonnes: tiles.columns, attendu: expected });
  check(`${tag} : chaque vignette dit son poids`, tiles.weighed === tiles.tiles, { vignettes: tiles.tiles, avecPoids: tiles.weighed });
  if (width === 700) await shot('2-vignettes');
  await display('list');
  await page.waitForTimeout(200);
}

// ---------- la fenêtre « Thème » garde sa grille ----------
await lab.fitPanel(undefined, 700, 400);
await openThemeWindow(frame);
const windowGrid = await frame.evaluate(() => {
  const grid = document.querySelector('.th-win [role="radiogroup"]');
  const minis = [...document.querySelectorAll('.th-win .amb-mini')];
  const lefts = new Set(minis.map(mini => Math.round(mini.getBoundingClientRect().left)));
  return { columns: lefts.size, vignettes: minis.length, height: [...new Set(minis.map(mini => Math.round(mini.getBoundingClientRect().height)))], pad: getComputedStyle(grid).paddingTop };
});
check('la fenêtre « Thème » : cinq vignettes en une rangée, de 58 px de haut, dans sa grille (`amb-grid`) et son remplissage de 8 px', windowGrid.columns === 5 && windowGrid.vignettes === 5 && windowGrid.height.join() === '58' && windowGrid.pad === '8px', windowGrid);
await shot('3-fenetre-theme');
await page.keyboard.press('Escape');
await lab.browser.close();
say('avertissements GFS :', warnings);
check('aucun avertissement ni erreur de GFS', warnings.length === 0, warnings);
