// L'interface de GFS sous Firefox, le navigateur du porteur (demande du 03/11 : vérifier aussi les interfaces dans les tests). Le 03/11, le trait qui sépare les lignes de l'explorateur passait dans le
// texte : la fenêtre « Thème » avait pris deux noms de classe à la liste, et ni Node ni le labo (Chromium seul) ne le voyaient. Ce fichier ouvre le vrai explorateur et la vraie fenêtre « Thème »
// (test/pages/explorateur.js, avec les feuilles de style de index.html) dans un vrai Firefox sans écran (test/firefox.mjs), puis mesure, en français et en anglais, en clair et en sombre, à 700, 640, 520, 500
// et 400 px de large, à 100 % et à 150 % : chaque ligne mesure 28 px, son contenu y est centré et n'en sort pas (le trait passe sous le texte), « Épingler » et « Plus d'actions » mesurent 24 × 24, la souris sur
// la ligne les montre dans la ligne, et un clic sur « Plus d'actions » ouvre le menu de CETTE ligne ; la vue en vignettes garde des vignettes de 112 px au moins et le nombre de colonnes que la place donne ;
// la fenêtre « Thème » garde ses vignettes (cinq, ou trois en vue étroite). Le labo (labo/run-liste.mjs) fait les mêmes mesures dans un vrai Grist, sous Chromium.
// Firefox absent : l'essai est SAUTÉ, et le dit (`labo/installer-firefox.sh` le pose dans le cloud ; `GFS_FIREFOX=<fichier exécutable>` désigne celui de la machine).
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { request } from 'node:http';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';
import { findFirefox, serveSite, startFirefox } from './firefox.mjs';
import { ROW_BUTTON, ROW_HEIGHT, TILE_MIN, expectedTileColumns, measureRows, measureTiles } from '../labo/mesures-liste.mjs';

const WIDTHS = [700, 640, 520, 500, 400]; // 700 : le panneau de référence ; 640 : le portable du porteur ; 520 : la dernière largeur de la vue large ; 500 et 400 : la vue étroite
const SCALES = [1, 1.5];
const MODES = ['light', 'dark'];
const LANGUAGES = ['fr', 'en'];
const PAGE = '/essai-explorateur.html';

const firefox = findFirefox();
if (!firefox) process.stderr.write('Firefox introuvable : l\'interface n\'est PAS mesurée sous Firefox (labo/installer-firefox.sh, ou GFS_FIREFOX=<fichier exécutable>).\n');

// La page d'essai : les feuilles de style et la carte d'importation de index.html, dans son ordre ; le reste est test/pages/explorateur.js.
function essayPage() {
  const index = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const sheets = index.match(/<link rel="stylesheet"[^>]*>/g) || [];
  const importMap = (index.match(/<script type="importmap">[\s\S]*?<\/script>/) || [''])[0];
  assert.ok(sheets.length >= 3 && importMap, 'index.html : ses feuilles de style et sa carte d\'importation');
  return `<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>essai</title>\n${sheets.join('\n')}\n${importMap}\n</head>\n`
    + '<body><main class="stage" id="stage"></main><script type="module" src="/test/pages/explorateur.js"></script></body></html>';
}

// ---------- ce qui s'exécute dans la page (rien du module n'y est visible) ----------

// La troisième ligne de fichier (ni dossier ni grisée), amenée à l'écran : son nom, sa clé, le centre de la ligne et celui du signe « ⋯ » de son bouton.
function pickRow() {
  const row = [...document.querySelectorAll('.ls-row:not(.folder):not(.lk)')][2];
  row.scrollIntoView({ block: 'nearest' });
  const centerOf = element => { const box = element.getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; };
  window.__opened = null;
  return { name: row.querySelector('.t').textContent, key: row.dataset.key, row: centerOf(row), glyph: centerOf(row.querySelector('.rb.mn svg')) };
}

// Le bouton « Plus d'actions » de la ligne `key`, la souris étant sur la ligne : visible, et dans la ligne.
function moreButtonOf(key) {
  const row = document.querySelector(`.ls-row[data-key="${key}"]`);
  const button = row.querySelector('.rb.mn');
  const rowBox = row.getBoundingClientRect();
  const box = button.getBoundingClientRect();
  return { opacity: Number(getComputedStyle(button).opacity), inside: box.top >= rowBox.top - 0.5 && box.bottom <= rowBox.bottom + 0.5 };
}

// Ce que la page sait du menu ouvert : la ligne choisie, le centre de son premier article.
function openMenu() {
  const item = document.querySelector('.menu .menu-item');
  if (!item) return null;
  const box = item.getBoundingClientRect();
  const selected = document.querySelector('.ls-row[aria-selected="true"] .t');
  return { selected: selected ? selected.textContent : null, first: [box.left + box.width / 2, box.top + box.height / 2] };
}

// Le centre du bouton de la page qui porte l'icône `glyph` (le choix de la liste ou des vignettes), ou celui de l'élément `selector`.
const centerOfGlyph = glyph => { const button = document.querySelector(`button use[href="#i-${glyph}"]`).closest('button'); const box = button.getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; };
const centerOfSelector = selector => { const box = document.querySelector(selector).getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; };

// La grille de la fenêtre « Thème » : ses vignettes, ses colonnes, son remplissage.
function measureThemeWindow() {
  const grid = document.querySelector('.th-win [role="radiogroup"]');
  if (!grid) return null;
  const tiles = [...grid.querySelectorAll('label.amb')];
  return { tiles: tiles.length, columns: new Set(tiles.map(tile => Math.round(tile.getBoundingClientRect().left))).size, padding: getComputedStyle(grid).paddingTop };
}

// ---------- ce que l'essai constate : des écarts { kind, text }, un par constat ----------

async function listProblems(page, tag) {
  const rows = await page.run(measureRows);
  const found = [];
  const note = (row, kind, text) => found.push({ kind, text: `${tag} : « ${row.name} » ${text}` });
  if (rows.length < 8 || !rows.some(row => row.folder)) found.push({ kind: 'la liste', text: `${tag} : la liste n'a pas ses lignes (${rows.length}) ou son dossier` });
  for (const row of rows) {
    if (Math.abs(row.height - ROW_HEIGHT) > 0.5) note(row, 'hauteur d\'une ligne', `mesure ${row.height} px au lieu de ${ROW_HEIGHT}`);
    if (row.off > 1) note(row, 'contenu d\'une ligne décentré', `a son contenu décentré de ${row.off.toFixed(1)} px`);
    if (row.out > 0.5) note(row, 'le trait passe dans le texte', `a son contenu qui sort de ${row.out.toFixed(1)} px par le bas : le trait passe dans le texte`);
    for (const [width, height] of row.buttons) {
      if (Math.abs(width - ROW_BUTTON) > 0.5 || Math.abs(height - ROW_BUTTON) > 0.5) note(row, 'taille d\'un bouton de ligne', `a un bouton de ${width} × ${height} px au lieu de ${ROW_BUTTON} × ${ROW_BUTTON}`);
    }
  }
  return found;
}

// La souris, comme la personne : sur la ligne, puis un clic sur le signe « ⋯ », puis le premier article du menu (« Ouvrir ») : c'est le fichier de cette ligne qui doit s'ouvrir.
async function mouseProblems(page, tag) {
  const found = [];
  const target = await page.run(pickRow);
  const note = (kind, text) => found.push({ kind, text: `${tag} : « ${target.name} » ${text}` });
  await page.move(...target.row);
  const button = await page.run(moreButtonOf, target.key);
  if (button.opacity !== 1) note('« Plus d\'actions » caché sous la souris', `: « Plus d'actions » n'apparaît pas quand la souris est sur la ligne (opacité ${button.opacity})`);
  if (!button.inside) note('« Plus d\'actions » hors de sa ligne', ': « Plus d\'actions » déborde de sa ligne');
  await page.click(...target.glyph);
  const menu = await page.until(openMenu, [], 1500).catch(() => null);
  if (!menu) { note('« ⋯ » sans menu', ': le clic sur « ⋯ » n\'ouvre aucun menu'); return found; }
  if (menu.selected !== target.name) note('« ⋯ » ouvre le menu d\'une autre ligne', `: le clic sur « ⋯ » a ouvert le menu de « ${menu.selected} »`);
  await page.click(...menu.first);
  const opened = await page.until(() => window.__opened, [], 2000).catch(() => null);
  if (opened !== target.name) note('« Ouvrir » ouvre un autre fichier', `: « Ouvrir » a ouvert « ${opened} »`);
  if (await page.run(() => Boolean(document.querySelector('.menu')))) await page.press('Escape');
  return found;
}

async function tilesProblems(page, tag) {
  await page.click(...await page.run(centerOfGlyph, 'tiles'));
  const tiles = await page.until(measureTiles);
  const expected = expectedTileColumns(tiles.grid);
  const found = [];
  if (tiles.tiles < 5 || tiles.narrowest < TILE_MIN - 0.5) found.push({ kind: 'vignettes trop étroites', text: `${tag} : la vue en vignettes a des vignettes de ${tiles.narrowest.toFixed(1)} px (au moins ${TILE_MIN})` });
  if (tiles.columns !== expected) found.push({ kind: 'colonnes des vignettes', text: `${tag} : la vue en vignettes pose ${tiles.columns} colonnes dans ${tiles.grid} px, la place en donne ${expected}` });
  await page.click(...await page.run(centerOfGlyph, 'list'));
  await page.until(() => !document.querySelector('.th-grid'));
  return found;
}

async function themeProblems(page, width, tag) {
  await page.click(...await page.run(centerOfSelector, '.tb-theme'));
  const theme = await page.until(measureThemeWindow);
  const columns = width >= 520 ? 5 : 3;
  const found = [];
  if (theme.tiles !== 5) found.push({ kind: 'fenêtre « Thème » : vignettes', text: `${tag} : la fenêtre « Thème » a ${theme.tiles} vignettes au lieu de 5` });
  if (theme.columns !== columns) found.push({ kind: 'fenêtre « Thème » : colonnes', text: `${tag} : la fenêtre « Thème » pose ses vignettes sur ${theme.columns} colonnes au lieu de ${columns}` });
  if (theme.padding !== '8px') found.push({ kind: 'fenêtre « Thème » : remplissage', text: `${tag} : la grille de la fenêtre « Thème » a un remplissage de ${theme.padding} au lieu de 8px` });
  await page.press('Escape');
  await page.until(() => !document.querySelector('.th-win'));
  return found;
}

const caption = (language, width, scale, mode) => `${language}, ${width} px, ${scale === 1 ? '100 %' : `${scale * 100} %`}, ${mode === 'dark' ? 'sombre' : 'clair'}`;

// Le constat, par nature d'écart : combien, et les premiers exemples (sans cela, quelques centaines de lignes semblables cachent les autres natures).
function report(problems) {
  const kinds = new Map();
  for (const { kind, text } of problems) kinds.set(kind, [...(kinds.get(kind) || []), text]);
  const lines = [...kinds].map(([kind, texts]) => `— ${kind} (${texts.length}) :\n    ${texts.slice(0, 2).join('\n    ')}`);
  return `${problems.length} écart(s) sous Firefox, de ${kinds.size} nature(s) :\n${lines.join('\n')}`;
}

// Sans Firefox, chaque essai est sauté (le résumé de `node --test` le compte : `# skipped 2`), et le message du début de ce fichier le dit.
const SKIP = firefox ? false : 'Firefox introuvable (labo/installer-firefox.sh, ou GFS_FIREFOX)';

describe('l\'interface sous Firefox', () => {
  let site;
  let browser;

  before(async () => {
    if (!firefox) return;
    site = await serveSite(ROOT, { [PAGE]: essayPage() });
    browser = await startFirefox(firefox);
  });

  after(async () => {
    if (browser) await browser.close();
    if (site) await site.close();
  });

  for (const language of LANGUAGES) {
    test(`l'explorateur et la fenêtre « Thème » en ${language === 'fr' ? 'français' : 'anglais'}`, { skip: SKIP, timeout: 240000 }, async () => {
      const { page } = browser;
      await page.goto(`${site.url}${PAGE}?lang=${language}`);
      await page.run(() => window.__ready);
      const problems = [];
      for (const width of WIDTHS) {
        for (const scale of SCALES) {
          for (const mode of MODES) {
            await page.view({ width, scale, mode });
            const tag = caption(language, width, scale, mode);
            problems.push(...await listProblems(page, tag), ...await mouseProblems(page, tag), ...await tilesProblems(page, tag), ...await themeProblems(page, width, tag));
          }
        }
      }
      // Les erreurs de script de la page et les avertissements de GFS (un texte inconnu, par exemple) ; sans le kit (sous-module non récupéré), le sélecteur de couleur dit qu'il ne se charge pas : ce n'est pas l'interface.
      const logged = page.logs.filter(entry => ((entry.level === 'error' && entry.type === 'javascript') || /GFS/.test(entry.text || '')) && !/sélecteur de couleur du kit/.test(entry.text || ''));
      for (const entry of logged) problems.push({ kind: 'la page écrit dans la console', text: `la page a écrit « ${String(entry.text).slice(0, 120)} »` });
      assert.equal(problems.length, 0, report(problems));
    });
  }
});

// L'outil lui-même, sans Firefox : où il cherche le navigateur, et ce que son petit serveur sert (le dépôt, les pages fabriquées, rien d'autre).
describe('l\'outil de test Firefox', () => {
  test('findFirefox : le fichier que désigne GFS_FIREFOX passe avant tout, et un chemin qui n\'existe pas est ignoré', () => {
    assert.equal(findFirefox({ GFS_FIREFOX: process.execPath }), process.execPath);
    assert.notEqual(findFirefox({ GFS_FIREFOX: join(ROOT, 'absent', 'firefox') }), join(ROOT, 'absent', 'firefox'));
  });

  test('serveSite : le dépôt et les pages fabriquées, pas un fichier hors du dossier', async () => {
    const site = await serveSite(ROOT, { '/fabriquee.html': '<p>ok</p>' });
    const raw = path => new Promise((resolve, reject) => {
      const { port } = new URL(site.url);
      request({ host: '127.0.0.1', port, path }, response => { response.resume(); resolve(response.statusCode); }).on('error', reject).end();
    });
    try {
      assert.equal(await (await fetch(`${site.url}/fabriquee.html`)).text(), '<p>ok</p>');
      assert.equal((await fetch(`${site.url}/index.html`)).status, 200);
      assert.equal((await fetch(`${site.url}/absent.html`)).status, 404);
      assert.equal(await raw('/../LICENSE'), 404, 'le dossier au-dessus du prototype n\'est pas servi');
      assert.equal(await raw('/%2e%2e/LICENSE'), 404, 'même écrit en pourcentage');
      assert.equal(await raw('/%zz'), 400, 'une adresse illisible est refusée');
    } finally {
      await site.close();
    }
  });
});
