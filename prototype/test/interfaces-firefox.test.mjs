// L'interface de GFS sous Firefox, le navigateur du porteur (demande du 03/11 : vérifier aussi les interfaces dans les tests). Le 03/11, le trait qui sépare les lignes de l'explorateur passait dans le
// texte : la fenêtre « Thème » avait pris deux noms de classe à la liste, et ni Node ni le labo (Chromium seul) ne le voyaient. Ce fichier ouvre le vrai explorateur et les vraies fenêtres « Thème » et « Ce nom est déjà pris »
// (test/pages/explorateur.js, avec les feuilles de style de index.html) dans un vrai Firefox sans écran (test/firefox.mjs), puis mesure, en français et en anglais, en clair et en sombre, à 700, 640, 600, 520,
// 500 et 400 px de large, à 100 % et à 150 % : chaque ligne mesure 28 px, son contenu y est centré et n'en sort pas (le trait passe sous le texte), « Épingler » et « Plus d'actions » mesurent 24 × 24, la souris sur
// la ligne les montre dans la ligne, et un clic sur « Plus d'actions » ouvre le menu de CETTE ligne ; la vue en vignettes garde des vignettes de 112 px au moins et le nombre de colonnes que la place donne ;
// le menu « Réglages » (le bouton de l'en-tête, depuis le 04/11 : langue, thème, position de la barre, « À propos ») s'ouvre sous le bouton, garde ses quatre lignes de 28 px sans nom coupé, et ouvre sa langue et sa
// position en sous-menu à côté de la ligne, sans la recouvrir ; à 700 px, à la vraie souris et au vrai clavier, choisir une langue ou un bord le rend à la page et rend le clavier au bouton, Échap referme le sous-menu puis le menu ; « À propos » tient dans
// la page avec ses quatre lignes et son seul bouton ; la fenêtre « Thème » garde ses vignettes (cinq, ou trois en vue étroite), ouverte par la ligne « Thème… » de ce menu, sa ligne « Accessibilité renforcée » sur une seule ligne, sans que le corps défile à 520 px et au-delà, et son interrupteur répond à la vraie souris (Tab y arrive ; Espace et l'anneau de focus restent au labo, voir accessProblems) ; la page peinte
// par l'accessibilité renforcée et par Enseigne (décision du 04/11) garde ses lignes à 28 px, leur contenu dans la ligne, ses traits de 2 px et son absence de décor ; la fenêtre « Ce nom est déjà pris » (js/conflict-window.js, telle qu'une app qui range un lot la fait ouvrir, puis telle que
// « Nouveau > Importer » la fait ouvrir) tient dans la page sans défiler, garde son titre et ses trois boutons sur une ligne, met le clavier sur « Garder les deux », tourne avec Tab, et ses issues répondent à
// la vraie souris et au vrai clavier (la case « Faire pareil pour les suivants » se coche en cliquant son texte). Entrée et Espace sur un bouton ne se jouent pas ici (voir conflictProblems). La colonne « Poids » (demande du 04/11) : son titre et ses cases ne sont coupés nulle part, son tri
// va dans les deux sens sur le poids de chaque fichier, et le total du pied dit la somme de ce que la liste montre ; la case « + pièces jointes » du pied (test/pieces-jointes-firefox.mjs : à la souris et au clavier, le total qui
// prend les pièces jointes que nul fichier de l'explorateur ne cite, le grisé avec sa raison, le pied qui ne se recouvre pas). Les icônes des types
// de fichier suivent l'ambiance (test/icones-firefox.mjs : la couleur et le trait que Firefox calcule, par ambiance, en clair et en sombre ; le 04/11, Firefox a refusé le premier trait écrit, un nombre calculé). Le labo
// (labo/run-liste.mjs) fait les mêmes mesures de la liste dans un vrai Grist, sous Chromium.
// Firefox absent : l'essai est SAUTÉ, et le dit (`labo/installer-firefox.sh` le pose dans le cloud ; `GFS_FIREFOX=<fichier exécutable>` désigne celui de la machine).
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { request } from 'node:http';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';
import { findFirefox, serveSite, startFirefox } from './firefox.mjs';
import { corbeilleProblems } from './corbeille-firefox.mjs';
import { copierProblems } from './copier-firefox.mjs';
import { fermerProblems } from './fermer-firefox.mjs';
import { droitsProblems } from './droits-firefox.mjs';
import { partagerProblems } from './partager-firefox.mjs';
import { partagerAutreProblems } from './partager-autre-firefox.mjs';
import { poidsFenetreProblems } from './poids-fenetre-firefox.mjs';
import { iconProblems } from './icones-firefox.mjs';
import { dossiersProblems } from './dossiers-firefox.mjs';
import { compositeProblems } from './composite-firefox.mjs';
import { glisserProblems } from './glisser-firefox.mjs';
import { piecesJointesProblems } from './pieces-jointes-firefox.mjs';
import { annulerProblems } from './annuler-firefox.mjs';
import { ROW_BUTTON, ROW_HEIGHT, TILE_MIN, columnFaults, expectedTileColumns, measureColumns, measureRows, measureTiles } from '../labo/mesures-liste.mjs';
import { calendarLogs, calendarProblems } from './mesures-calendrier.mjs';

const WIDTHS = [700, 640, 600, 520, 500, 400]; // 700 : le panneau de référence ; 640 : le portable du porteur ; 600 : la plus étroite où la liste a toutes ses colonnes ; 520 : la dernière où le volet reste (liste sans « Modifié » ni « Par ») ; 500 et 400 : la vue étroite
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

// Les fichiers du premier niveau, dans l'ordre où la liste les montre : leur poids, et le sens du tri de la colonne « Poids » (le tri se juge sur ce que l'explorateur sait de chaque fichier, non sur le texte).
function weightOrder() {
  const weights = new Map(window.__explorer.files.map(file => [file.key, file.weight]));
  const seen = [...document.querySelectorAll('.ls-row:not(.folder)')].map(row => weights.get(row.dataset.key));
  const sort = document.querySelector('.ls-head .hd[data-sort="poids"]').getAttribute('aria-sort');
  const wanted = [...seen].sort((a, b) => (sort === 'descending' ? b - a : a - b));
  return { sort, seen, ok: seen.length > 5 && seen.every((value, i) => value === wanted[i]) };
}

// Le menu « Réglages » ouvert, et son sous-menu : leurs articles (nom, sous-menu ?, coché, hauteur, nom coupé ?, rectangle, centre), leur place dans la page, leurs séparateurs, le bouton qui les porte.
// Avec `needSub`, rien tant que le sous-menu n'est pas là.
function measureSettingsMenu(needSub = false) {
  const menu = document.querySelector('.menu:not(.menu-sub)');
  const sub = document.querySelector('.menu-sub');
  if (!menu || (needSub && !sub)) return null;
  const box = element => element.getBoundingClientRect();
  const describe = node => {
    const frame = box(node);
    const items = [...node.querySelectorAll('.menu-item')].map(item => {
      const rect = box(item);
      const label = item.querySelector('.menu-label');
      return { label: label.textContent, popup: item.getAttribute('aria-haspopup') === 'menu', checked: item.getAttribute('aria-checked'), height: rect.height, cut: label.scrollWidth > label.clientWidth + 0.5, rect: [rect.left, rect.top, rect.right, rect.bottom], center: [rect.left + rect.width / 2, rect.top + rect.height / 2] };
    });
    return { frame: [frame.left, frame.top, frame.right, frame.bottom], items, separators: node.querySelectorAll('hr').length };
  };
  const button = document.querySelector('button use[href="#i-sliders"]').closest('button');
  const rect = box(button);
  return { view: [document.documentElement.clientWidth, document.documentElement.clientHeight], menu: describe(menu), sub: sub ? describe(sub) : null, button: [rect.left, rect.top, rect.right, rect.bottom], expanded: button.getAttribute('aria-expanded') };
}

// Ce que la page sait après un geste : combien de menus restent ouverts, le dernier choix du menu, et si le clavier est sur le bouton « Réglages ».
const afterSettingsGesture = () => ({
  menus: document.querySelectorAll('.menu').length, language: window.__language, place: window.__place,
  onButton: Boolean(document.activeElement && document.activeElement.querySelector && document.activeElement.querySelector('use[href="#i-sliders"]')),
});

// La fenêtre « À propos » : son titre, ses lignes, ses boutons, sa place dans la page, ce qui prend le clavier, le centre de son bouton. Null sans fenêtre.
function measureAboutWindow() {
  const win = document.querySelector('.mod.ask');
  if (!win) return null;
  const box = element => element.getBoundingClientRect();
  const frame = box(win);
  const body = win.querySelector('.ask-body');
  const buttons = [...win.querySelectorAll('.ask-foot button')];
  const first = box(buttons[0]);
  return {
    view: [document.documentElement.clientWidth, document.documentElement.clientHeight], frame: [frame.left, frame.top, frame.right, frame.bottom], title: win.querySelector('h2').textContent,
    items: [...win.querySelectorAll('.ask-items li')].map(item => item.textContent), buttons: buttons.map(button => button.dataset.fk), wide: body.scrollWidth - body.clientWidth,
    active: document.activeElement ? document.activeElement.dataset.fk || null : null, close: [first.left + first.width / 2, first.top + first.height / 2],
  };
}


// La fenêtre « Thème » : sa grille (ses vignettes, ses colonnes, son remplissage), sa place dans la page, le défilement de son corps, et la ligne de l'interrupteur « Accessibilité renforcée » (son rôle, sa hauteur, son état, son centre).
function measureThemeWindow() {
  const grid = document.querySelector('.th-win [role="radiogroup"]');
  if (!grid) return null;
  const tiles = [...grid.querySelectorAll('label.amb')];
  const win = document.querySelector('.th-win').getBoundingClientRect();
  const body = document.querySelector('.th-win .mod-body');
  const row = document.querySelector('.th-win .th-acc');
  const input = row && row.querySelector('input');
  const box = row && row.getBoundingClientRect();
  return {
    tiles: tiles.length, columns: new Set(tiles.map(tile => Math.round(tile.getBoundingClientRect().left))).size, padding: getComputedStyle(grid).paddingTop,
    scrolls: body.scrollHeight > body.clientHeight + 1, fits: win.top >= -0.5 && win.left >= -0.5 && win.bottom <= innerHeight + 0.5 && win.right <= innerWidth + 0.5,
    access: row ? { role: input.getAttribute('role'), height: box.height, checked: input.checked, center: [box.left + box.width / 2, box.top + box.height / 2], ring: getComputedStyle(row).outlineStyle } : null,
  };
}

// Ce que la page porte quand une ambiance ou l'accessibilité renforcée est posée (js/theme-apply.js) : l'attribut, les traits, les capitales, la lueur, les ombres, la trame, le filet, la bordure d'une pastille.
function measureLook() {
  const css = (selector, property, pseudo = null) => { const node = document.querySelector(selector); return node ? getComputedStyle(node, pseudo)[property] : null; };
  return {
    ambiance: document.documentElement.getAttribute('data-ambiance'), bw: getComputedStyle(document.documentElement).getPropertyValue('--bw').trim(), titleCase: css('.ex-title', 'textTransform'), headCase: css('.ls-head .hd', 'textTransform'),
    titleGlow: css('.ex-title', 'textShadow'), mainShadow: css('.ex-main', 'boxShadow'), wash: css('.ex', 'backgroundImage'), stripe: css('.ex-main', 'height', '::before'), pillBorder: css('.ls-row .pill', 'borderTopWidth'),
  };
}

// Le centre de la ligne de l'interrupteur (amenée à l'écran), et l'état de l'interrupteur : allumé (la case cochée, le réglage pris) ou éteint ; la page prend alors `renforcee`, ou rend l'ambiance choisie.
const centerOfAccessRow = () => { const row = document.querySelector('.th-win .th-acc'); row.scrollIntoView({ block: 'nearest' }); const box = row.getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; };
const accessIsOn = () => { const input = document.querySelector('.th-win input[role="switch"]'); return input && input.checked && window.__theme.access ? { ambiance: document.documentElement.getAttribute('data-ambiance') } : null; };
const accessIsOff = () => { const input = document.querySelector('.th-win input[role="switch"]'); return input && !input.checked && !window.__theme.access ? { ambiance: document.documentElement.getAttribute('data-ambiance') } : null; };

// La fenêtre « Ce nom est déjà pris » : sa place dans la page, ses boutons (au pied, sur une ligne, dans la fenêtre), ce qui prend le clavier, la case des suivants et les points où cliquer. Null sans fenêtre.
function measureConflictWindow() {
  const win = document.querySelector('.mod.ask');
  if (!win) return null;
  const box = element => element.getBoundingClientRect();
  const center = rect => [rect.left + rect.width / 2, rect.top + rect.height / 2];
  const frame = box(win);
  const body = win.querySelector('.ask-body');
  const label = win.querySelector('.ask-again');
  const check = label && label.querySelector('input');
  let wording = null;
  if (label) { const range = document.createRange(); range.selectNodeContents(label.lastChild); wording = box(range); }
  const buttons = Object.fromEntries([...win.querySelectorAll('.ask-foot button')].map(button => [button.dataset.fk, box(button)]));
  const keys = Object.keys(buttons);
  const tops = keys.map(key => buttons[key].top);
  return {
    view: [document.documentElement.clientWidth, document.documentElement.clientHeight], frame: [frame.left, frame.top, frame.right, frame.bottom],
    head: box(win.querySelector('.mod-head')).top, foot: box(win.querySelector('.ask-foot')).bottom,
    keys, sameLine: Math.max(...tops) - Math.min(...tops), insideLeft: Math.min(...keys.map(key => buttons[key].left)), insideRight: Math.max(...keys.map(key => buttons[key].right)),
    wide: body.scrollWidth - body.clientWidth, active: document.activeElement ? document.activeElement.dataset.fk || null : null,
    items: win.querySelectorAll('.ask-items li').length, again: check ? { size: [box(check).width, box(check).height], off: Math.abs(center(box(check))[1] - center(box(label))[1]), checked: check.checked } : null,
    wording: wording && center(wording), centers: Object.fromEntries(keys.map(key => [key, center(buttons[key])])),
  };
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
  if (tiles.weighed !== tiles.tiles) found.push({ kind: 'vignette sans poids', text: `${tag} : ${tiles.tiles - tiles.weighed} vignette(s) sur ${tiles.tiles} ne disent pas leur poids` });
  if (tiles.tiles < 5 || tiles.narrowest < TILE_MIN - 0.5) found.push({ kind: 'vignettes trop étroites', text: `${tag} : la vue en vignettes a des vignettes de ${tiles.narrowest.toFixed(1)} px (au moins ${TILE_MIN})` });
  if (tiles.columns !== expected) found.push({ kind: 'colonnes des vignettes', text: `${tag} : la vue en vignettes pose ${tiles.columns} colonnes dans ${tiles.grid} px, la place en donne ${expected}` });
  await page.click(...await page.run(centerOfGlyph, 'list'));
  await page.until(() => !document.querySelector('.th-grid'));
  return found;
}

// Le texte du total du pied de fenêtre à la racine : les douze modèles de la page d'essai (test/pages/explorateur.js) pèsent 18 971 940 octets, soit 18,09 Mo.
const TOTAL = { fr: '18,1 Mo', en: '18.1 MB' };

// Les colonnes de la liste (le poids, demande du porteur du 04/11) et le total du pied : en-têtes qui ne se recouvrent pas, aucune cellule coupée, le poids collé à droite, le total entier et juste ;
// mesurés avec le tri de chaque colonne (sa flèche élargit l'en-tête), un clic puis deux ; la colonne « Poids » trie le plus lourd d'abord, puis le plus léger ; le tri par nom est rétabli à la fin.
async function columnProblems(page, width, language, tag) {
  const narrow = width < 600; // la liste perd « Modifié » et « Par » sous 600 px
  const found = [];
  const measure = async what => found.push(...columnFaults(await page.run(measureColumns), narrow, `${tag}, ${what}`, TOTAL[language]));
  const header = key => page.run(centerOfSelector, `.ls-head .hd[data-sort="${key}"]`);
  await measure('tri par nom');
  for (const key of narrow ? ['type', 'poids'] : ['type', 'poids', 'mod', 'by']) {
    await page.click(...await header(key));
    await measure(`tri par « ${key} », un clic`);
    if (key === 'poids') {
      const order = await page.run(weightOrder);
      if (order.sort !== 'descending' || !order.ok) found.push({ kind: 'tri par poids', text: `${tag} : un clic sur « Poids » doit montrer le plus lourd d'abord : ${order.sort} ${JSON.stringify(order.seen)}` });
    }
    await page.click(...await header(key));
    await measure(`tri par « ${key} », deux clics`);
    if (key === 'poids') {
      const order = await page.run(weightOrder);
      if (order.sort !== 'ascending' || !order.ok) found.push({ kind: 'tri par poids', text: `${tag} : un deuxième clic sur « Poids » doit montrer le plus léger d'abord : ${order.sort} ${JSON.stringify(order.seen)}` });
    }
  }
  await page.click(...await header('name'));
  return found;
}

// Le bouton « Réglages » à la vraie souris, puis la ligne `row` du menu (0 : Langue, 1 : Thème, 2 : Position de la barre, 3 : À propos) ; rend ce que le menu montrait avant ce clic.
async function openSettings(page, row) {
  await page.click(...await page.run(centerOfGlyph, 'sliders'));
  const shown = await page.until(measureSettingsMenu, [], 1500);
  await page.click(...shown.menu.items[row].center);
  return shown;
}

const SETTINGS_ROWS = { fr: ['Langue', 'Thème…', 'Position de la barre', 'À propos…'], en: ['Language', 'Theme…', 'Bar position', 'About…'] };
const LANGUAGE_ROWS = { fr: ['Comme Grist (Français)', 'Français', 'English'], en: ['Same as Grist (English)', 'Français', 'English'] };
const EDGE_ROWS = { fr: ['À gauche', 'En haut', 'À droite', 'En bas'], en: ['Left', 'Top', 'Right', 'Bottom'] };
const ABOUT_TITLE = { fr: 'À propos de Grist Factory Suite', en: 'About Grist Factory Suite' };
const ABOUT_LINES = { fr: ['Version : ', 'Auteur : Grist Factory', 'Site : grist-factory.fr', 'Licence : GNU GPL v3.0'], en: ['Version: ', 'Author: Grist Factory', 'Site: grist-factory.fr', 'License: GNU GPL v3.0'] };
const inside = (frame, [width, height]) => frame[0] >= -0.5 && frame[1] >= -0.5 && frame[2] <= width + 0.5 && frame[3] <= height + 0.5;
const overlaps = (a, b) => a[0] < b[2] - 0.5 && a[2] > b[0] + 0.5 && a[1] < b[3] - 0.5 && a[3] > b[1] + 0.5;

// Le menu qu'on vient d'ouvrir : ses quatre lignes dans l'ordre, une seule coupure, 28 px chacune, aucun nom coupé, dans la page, sous (ou sur) le bouton sans le recouvrir.
function settingsLayout(shown, language, note) {
  const { menu } = shown;
  const names = menu.items.map(item => item.label);
  if (names.join('|') !== SETTINGS_ROWS[language].join('|')) note('les lignes', `les lignes sont « ${names.join(' | ')} » au lieu de « ${SETTINGS_ROWS[language].join(' | ')} »`);
  if (menu.items.map(item => item.popup).join() !== 'true,false,true,false') note('les sous-menus', 'seules « Langue » et « Position de la barre » ouvrent un sous-menu');
  if (menu.separators !== 1) note('le séparateur', `le menu a ${menu.separators} séparateur(s) au lieu d'un, avant « À propos »`);
  for (const item of menu.items) {
    if (Math.abs(item.height - 28) > 0.5) note('hauteur d\'une ligne', `« ${item.label} » mesure ${item.height} px au lieu de 28`);
    if (item.cut) note('nom coupé', `le nom de « ${item.label} » est coupé`);
  }
  if (!inside(menu.frame, shown.view)) note('hors de la page', `le menu (${menu.frame.map(Math.round).join(', ')}) sort de la page de ${shown.view.join(' × ')} px`);
  if (overlaps(menu.frame, shown.button)) note('recouvre le bouton', 'le menu recouvre le bouton « Réglages »');
  if (shown.expanded !== 'true') note('état du bouton', `le bouton « Réglages » dit aria-expanded=${shown.expanded} menu ouvert`);
}

// Un sous-menu ouvert : ses lignes, son séparateur, la coche (une seule), sa place à côté de la ligne qui l'ouvre sans la recouvrir, dans la page.
function subLayout(shown, from, wanted, checkedAt, label, note) {
  const { sub } = shown;
  const names = sub.items.map(item => item.label);
  if (names.join('|') !== wanted.join('|')) note(`${label} : les lignes`, `le sous-menu « ${label} » a « ${names.join(' | ')} » au lieu de « ${wanted.join(' | ')} »`);
  const checked = sub.items.map((item, index) => (item.checked === 'true' ? index : -1)).filter(index => index >= 0);
  if (checked.join() !== String(checkedAt)) note(`${label} : la coche`, `le sous-menu « ${label} » coche la ligne ${checked.join(', ') || 'aucune'} au lieu de la ${checkedAt}`);
  if (label === 'Langue' && sub.separators !== 1) note('Langue : le séparateur', `le sous-menu de la langue a ${sub.separators} séparateur(s) au lieu d'un, après « Comme Grist »`);
  if (overlaps(sub.frame, from.rect)) note(`${label} : recouvre sa ligne`, `le sous-menu « ${label} » recouvre la ligne qui l'ouvre`);
  if (!inside(sub.frame, shown.view)) note(`${label} : hors de la page`, `le sous-menu « ${label} » (${sub.frame.map(Math.round).join(', ')}) sort de la page de ${shown.view.join(' × ')} px`);
}

// La fenêtre « À propos », ouverte par la ligne du menu : son titre, ses quatre lignes, son seul bouton « Fermer », dans la page, le clavier sur le bouton ; le clic sur le bouton la ferme et rend le clavier à « Réglages ».
async function aboutProblems(page, language, note) {
  await openSettings(page, 3);
  const win = await page.until(measureAboutWindow, [], 1500).catch(() => null);
  if (!win) { note('« À propos » sans fenêtre', 'la ligne « À propos » n\'ouvre aucune fenêtre'); return; }
  if (win.title !== ABOUT_TITLE[language]) note('« À propos » : le titre', `le titre est « ${win.title} » au lieu de « ${ABOUT_TITLE[language]} »`);
  const wanted = ABOUT_LINES[language];
  if (win.items.length !== 4 || !win.items.every((item, index) => item.startsWith(wanted[index]))) note('« À propos » : les lignes', `les lignes sont « ${win.items.join(' | ')} » au lieu de « ${wanted.join(' | ')}… »`);
  if (!/^Version ?: ?\d+\.\d+\.\d+/.test(win.items[0] || '')) note('« À propos » : la version', `la première ligne ne dit pas une version : « ${win.items[0]} »`);
  if (win.buttons.join() !== 'ask-yes') note('« À propos » : les boutons', `les boutons sont « ${win.buttons.join(', ')} » au lieu du seul « Fermer »`);
  if (win.active !== 'ask-yes') note('« À propos » : le clavier', `le clavier est sur « ${win.active} » au lieu du bouton « Fermer »`);
  if (!inside(win.frame, win.view)) note('« À propos » : hors de la page', `la fenêtre (${win.frame.map(Math.round).join(', ')}) sort de la page de ${win.view.join(' × ')} px`);
  if (win.wide > 1) note('« À propos » : texte coupé', `le texte déborde de ${win.wide} px`);
  await page.click(...win.close);
  await page.until(() => !document.querySelector('.mod.ask'), [], 1500).catch(() => note('« À propos » : se ferme', 'le bouton « Fermer » ne ferme pas la fenêtre'));
  if (!(await page.run(afterSettingsGesture)).onButton) note('« À propos » : le clavier revient', 'après « Fermer », le clavier n\'est pas revenu sur le bouton « Réglages »');
}

// Les gestes du menu à la vraie souris et au vrai clavier (à 700 px) : choisir l'autre langue, choisir un bord, Échap qui referme le sous-menu puis le menu.
async function settingsGestures(page, language, note) {
  const other = language === 'fr' ? { index: 2, value: 'en' } : { index: 1, value: 'fr' };
  const after = () => page.run(afterSettingsGesture);
  const from = await openSettings(page, 0);
  const lang = await page.until(measureSettingsMenu, [true], 1500).catch(() => null);
  if (!lang) { note('Langue : sans sous-menu', 'la ligne « Langue » n\'ouvre aucun sous-menu'); return; }
  await page.click(...lang.sub.items[other.index].center);
  let now = await after();
  if (now.language !== other.value) note('Langue : le choix', `choisir « ${LANGUAGE_ROWS[language][other.index]} » rend « ${now.language} » à la page au lieu de « ${other.value} »`);
  if (now.menus !== 0) note('Langue : le menu reste', `${now.menus} menu(s) restent ouverts après le choix d'une langue`);
  if (!now.onButton) note('Langue : le clavier', 'après le choix d\'une langue, le clavier n\'est pas revenu sur le bouton « Réglages »');
  await openSettings(page, 2);
  const edges = await page.until(measureSettingsMenu, [true], 1500).catch(() => null);
  if (!edges) { note('Position : sans sous-menu', 'la ligne « Position de la barre » n\'ouvre aucun sous-menu'); return; }
  subLayout(edges, from.menu.items[2], EDGE_ROWS[language], 0, from.menu.items[2].label, note);
  await page.click(...edges.sub.items[1].center);
  now = await after();
  if (now.place !== 'haut') note('Position : le choix', `choisir « ${EDGE_ROWS[language][1]} » rend « ${now.place} » à la page au lieu de « haut »`);
  await openSettings(page, 2);
  const again = await page.until(measureSettingsMenu, [true], 1500).catch(() => null);
  if (again && again.sub.items.findIndex(item => item.checked === 'true') !== 1) note('Position : la coche suit', 'la coche n\'est pas passée sur le bord choisi');
  await page.press('Escape');
  now = await page.run(() => ({ main: document.querySelectorAll('.menu:not(.menu-sub)').length, sub: document.querySelectorAll('.menu-sub').length }));
  if (now.sub !== 0 || now.main !== 1) note('Échap : le sous-menu d\'abord', `un premier Échap laisse ${now.main} menu et ${now.sub} sous-menu au lieu d'un menu seul`);
  await page.press('Escape');
  now = await after();
  if (now.menus !== 0 || !now.onButton) note('Échap : puis le menu', `un second Échap laisse ${now.menus} menu(s) ouverts, le clavier ${now.onButton ? 'sur' : 'hors de'} « Réglages »`);
}

// Le menu « Réglages » : sa mise en page à chaque largeur, le sous-menu de la langue, la fenêtre « À propos » ; à 700 px, 100 % seulement, les gestes à la souris et au clavier.
async function settingsProblems(page, language, width, scale, tag) {
  const found = [];
  const note = (kind, text) => found.push({ kind: `menu « Réglages » : ${kind}`, text: `${tag} : ${text}` });
  await page.run(() => window.__resetSettings());
  const shown = await page.click(...await page.run(centerOfGlyph, 'sliders')).then(() => page.until(measureSettingsMenu, [], 1500)).catch(() => null);
  if (!shown) { note('sans menu', 'le clic sur « Réglages » n\'ouvre aucun menu'); return found; }
  settingsLayout(shown, language, note);
  await page.click(...shown.menu.items[0].center);
  const lang = await page.until(measureSettingsMenu, [true], 1500).catch(() => null);
  if (!lang) note('Langue : sans sous-menu', 'la ligne « Langue » n\'ouvre aucun sous-menu');
  else subLayout(lang, shown.menu.items[0], LANGUAGE_ROWS[language], language === 'fr' ? 1 : 2, 'Langue', note);
  await page.press('Escape');
  await page.press('Escape');
  if (await page.run(() => Boolean(document.querySelector('.menu')))) { note('Échap ne ferme pas', 'des menus restent ouverts après deux Échap'); await page.run(() => { for (const menu of document.querySelectorAll('.menu')) menu.remove(); }); }
  if (width === 700 && scale === 1) await settingsGestures(page, language, note);
  await aboutProblems(page, language, note);
  await page.run(() => window.__resetSettings());
  return found;
}

async function themeProblems(page, width, tag) {
  await openSettings(page, 1);
  const theme = await page.until(measureThemeWindow);
  const columns = width >= 520 ? 5 : 3;
  const found = [];
  if (theme.tiles !== 5) found.push({ kind: 'fenêtre « Thème » : vignettes', text: `${tag} : la fenêtre « Thème » a ${theme.tiles} vignettes au lieu de 5` });
  if (theme.columns !== columns) found.push({ kind: 'fenêtre « Thème » : colonnes', text: `${tag} : la fenêtre « Thème » pose ses vignettes sur ${theme.columns} colonnes au lieu de ${columns}` });
  if (theme.padding !== '4px') found.push({ kind: 'fenêtre « Thème » : remplissage', text: `${tag} : la grille de la fenêtre « Thème » a un remplissage de ${theme.padding} au lieu de 4px` });
  found.push(...await accessProblems(page, width, tag, theme));
  await page.press('Escape');
  await page.until(() => !document.querySelector('.th-win'));
  return found;
}

// L'interrupteur « Accessibilité renforcée » de la fenêtre « Thème » (décision du 04/11) : sur une seule ligne à toute largeur, dans la page, sans défilement du corps à 520 px et au-delà (même peinte par l'accessibilité
// renforcée) ; au vrai clavier, trois Tab depuis la vignette choisie (la couleur, son bouton, l'interrupteur) y arrivent ; à la vraie souris, un clic sur la ligne l'allume (la page prend `renforcee`) et un second l'éteint.
// Son anneau de focus et la touche Espace NE sont PAS pilotables ici : dans ce Firefox sans écran `document.hasFocus()` reste faux, donc ni `:focus-visible` ne s'applique ni Espace n'active une case (mesuré le 04/11,
// comme pour les boutons ci-dessous) ; ils restent à la mesure du labo, sous Chromium (`run-theme`, section 10). L'essai le rend éteint : les essais suivants repartent de là.
async function accessProblems(page, width, tag, theme) {
  const found = [];
  const note = (kind, text) => found.push({ kind: `fenêtre « Thème » : ${kind}`, text: `${tag} : ${text}` });
  await page.run(() => window.__theme.chooseAccess(false));
  if (!theme.access) { note('interrupteur absent', 'la ligne « Accessibilité renforcée » n\'est pas dans la fenêtre « Thème »'); return found; }
  if (theme.access.role !== 'switch') note('rôle de l\'interrupteur', `l'interrupteur a le rôle « ${theme.access.role} » au lieu de « switch »`);
  if (theme.access.height > 34) note('ligne de l\'interrupteur', `la ligne de l'interrupteur mesure ${theme.access.height.toFixed(1)} px : elle passe sur plusieurs lignes (34 px au plus)`);
  if (!theme.fits) note('fenêtre hors de la page', 'la fenêtre « Thème » sort de la page');
  if (width >= 520 && theme.scrolls) note('le corps défile', `le corps de la fenêtre « Thème » défile à ${width} px de large (la ligne de l'accessibilité y a pris sa place)`);
  for (let i = 0; i < 3; i++) await page.press('Tab');
  if (!await page.run(() => document.activeElement === document.querySelector('.th-win input[role="switch"]'))) note('Tab n\'atteint pas l\'interrupteur', 'trois fois Tab depuis la vignette choisie n\'arrivent pas sur l\'interrupteur');
  await page.click(...await page.run(centerOfAccessRow));
  const on = await page.until(accessIsOn, [], 2000).catch(() => null);
  if (!on) { note('clic sans effet', 'un clic à la souris sur la ligne n\'allume pas l\'interrupteur'); return found; }
  if (on.ambiance !== 'renforcee') note('page non peinte', `la page porte « ${on.ambiance} » au lieu de « renforcee » quand l'interrupteur est allumé`);
  const painted = await page.run(measureThemeWindow);
  if (width >= 520 && painted.scrolls) note('le corps défile, accessibilité allumée', `le corps de la fenêtre « Thème » défile à ${width} px de large une fois l'accessibilité renforcée allumée`);
  if (!painted.fits) note('fenêtre hors de la page, accessibilité allumée', 'la fenêtre « Thème » sort de la page une fois l\'accessibilité renforcée allumée');
  await page.click(...await page.run(centerOfAccessRow));
  const off = await page.until(accessIsOff, [], 2000).catch(() => null);
  if (!off) note('second clic sans effet', 'un second clic à la souris sur la ligne n\'éteint pas l\'interrupteur');
  await page.run(() => window.__theme.chooseAccess(false));
  return found;
}

// La page peinte par l'ambiance et l'accessibilité renforcée (js/theme-apply.js, décision du 04/11) : ce que chaque feuille de style fait des jetons. Les lignes de la liste gardent leur hauteur et leur contenu (le 03/11, un trait
// passait dans le texte), le mode renforcé tient ses promesses (traits de 2 px, ni capitales, ni ombre, ni trame, ni filet, ni lueur, une bordure de 2 px aux pastilles) et Enseigne garde ses capitales et sa lueur ; la fenêtre « Thème »,
// peinte elle aussi, reste dans la page sans défiler. Le réglage se fait par `window.__theme` ; la page est rendue à l'origine à la fin.
async function lookProblems(page, tag) {
  const found = [];
  await page.run(() => window.__reset());
  const set = (ambiance, access) => page.run((choice, on) => { window.__theme.choose(choice); window.__theme.chooseAccess(on); }, ambiance, access);
  for (const [ambiance, access] of [['defaut', true], ['enseigne', false], ['enseigne', true], ['brut', true]]) {
    await set(ambiance, access);
    const label = `${tag}, ${ambiance}${access ? ' avec l\'accessibilité renforcée' : ''}`;
    const note = (kind, text) => found.push({ kind, text: `${label} : ${text}` });
    const look = await page.run(measureLook);
    const expected = access ? 'renforcee' : ambiance;
    if (look.ambiance !== expected) note('page non peinte', `la page porte « ${look.ambiance} » au lieu de « ${expected} »`);
    if (access) {
      if (look.bw !== '2px' || look.titleCase !== 'none' || look.headCase !== 'none' || look.mainShadow !== 'none' || look.wash !== 'none' || look.stripe !== '0px' || look.titleGlow !== 'none' || look.pillBorder !== '2px') {
        note('décor en accessibilité renforcée', `le mode renforcé a gardé du décor ou des traits fins : ${JSON.stringify(look)}`);
      }
    } else if (look.titleCase !== 'uppercase' || look.titleGlow === 'none') note('Enseigne sans son décor', `Enseigne a perdu ses capitales ou la lueur de son titre : ${JSON.stringify(look)}`);
    found.push(...await listProblems(page, label));
    await openSettings(page, 1);
    const theme = await page.until(measureThemeWindow);
    if (theme.scrolls) note('le corps de la fenêtre défile', 'la fenêtre « Thème », peinte par ce choix, défile dans 700 px');
    if (!theme.fits) note('fenêtre hors de la page', 'la fenêtre « Thème », peinte par ce choix, sort de la page');
    await page.press('Escape');
    await page.until(() => !document.querySelector('.th-win'));
  }
  await set('defaut', false);
  return found;
}

// Ce que la fenêtre mesure : elle tient dans la page, son titre et ses boutons sont à leur place (le texte défile, eux non), les trois boutons sont sur une ligne dans la fenêtre, le clavier est sur « Garder les deux ».
function conflictLayout(win, from, note) {
  const [left, top, right, bottom] = win.frame;
  const [width, height] = win.view;
  if (left < -0.5 || top < -0.5 || right > width + 0.5 || bottom > height + 0.5) note('hors de la page', `la fenêtre (${Math.round(left)}, ${Math.round(top)}, ${Math.round(right)}, ${Math.round(bottom)}) sort de la page de ${width} × ${height} px`);
  if (win.head < -0.5 || win.foot > height + 0.5) note('titre ou boutons qui défilent', `le titre (haut à ${Math.round(win.head)} px) ou le pied (bas à ${Math.round(win.foot)} px) sort de la page de ${height} px`);
  if (win.keys.join() !== 'conflict-cancel,conflict-replace,conflict-both') note('les trois boutons', `les boutons du pied sont ${win.keys.join(', ')}`);
  if (win.sameLine > 1) note('boutons sur deux lignes', `les boutons du pied ne sont pas sur une ligne (écart de ${win.sameLine.toFixed(1)} px)`);
  if (win.insideLeft < left - 0.5 || win.insideRight > right + 0.5) note('boutons hors de la fenêtre', 'un bouton du pied sort de la fenêtre');
  if (win.wide > 1) note('texte coupé', `le texte déborde de ${win.wide} px`);
  if (win.active !== 'conflict-both') note('clavier mal placé', `le clavier est sur « ${win.active} » au lieu de « Garder les deux »`);
  if (win.items !== (from.app ? 3 : 2)) note('les issues décrites', `la fenêtre décrit ${win.items} issues au lieu de ${from.app ? 3 : 2}`);
  if (Boolean(win.again) !== from.repeat) note('la case des suivants', from.repeat ? 'la case « Faire pareil pour les suivants » manque' : 'la case des suivants est offerte alors qu\'il n\'y a pas de lot');
  if (win.again && (win.again.size[0] !== 16 || win.again.size[1] !== 16 || win.again.off > 1)) note('la case des suivants', `la case mesure ${win.again.size.join(' × ')} px et a son centre à ${win.again.off.toFixed(1)} px de celui de sa ligne`);
}

// La fenêtre « Ce nom est déjà pris », ouverte comme une app qui range un lot la fait ouvrir (elle nomme l'app, offre « Annuler » et la case des suivants) puis comme « Nouveau > Importer » (sans l'un ni l'autre) ;
// chaque issue à la vraie souris ou au vrai clavier : la case cochée par son texte puis « Garder les deux », « Annuler », Échap, « Remplacer ». La touche Tab tourne dans la fenêtre (le clavier est posé sur « Garder les deux »,
// le dernier bouton : Tab revient à la case quand elle existe, à « Annuler » sinon). Entrée et Espace sur un bouton ne sont PAS pilotables ici : ce Firefox sans écran n'active pas même un `<button>` seul à ces touches
// (les événements arrivent, aucun clic ne part) ; elles restent à la mesure du labo, sous Chromium.
async function conflictProblems(page, tag) {
  const found = [];
  const lot = { app: 'Publipostage+', repeat: true };
  const press = key => page.press(key);
  const click = key => win => page.click(...win.centers[key]);
  const rounds = [
    { from: lot, name: 'rangée par une app, case cochée', act: async win => { await page.click(...win.wording); await click('conflict-both')(win); }, expect: { choice: 'both', again: true } },
    { from: lot, name: 'rangée par une app, Tab puis Échap', act: async () => { await press('Tab'); await expectFocus(page, 'conflict-again', found, tag); await press('Escape'); }, expect: { choice: 'skip', again: false } },
    { from: lot, name: 'rangée par une app, Annuler', act: click('conflict-cancel'), expect: { choice: 'skip', again: false } },
    { from: { app: '', repeat: false }, name: 'importée, Tab puis Remplacer', act: async win => { await press('Tab'); await expectFocus(page, 'conflict-cancel', found, tag); await click('conflict-replace')(win); }, expect: { choice: 'replace', again: false } },
  ];
  for (const { from, name, act, expect } of rounds) {
    const note = (kind, text) => found.push({ kind: `fenêtre « Ce nom est déjà pris » : ${kind}`, text: `${tag}, ${name} : ${text}` });
    await page.run(options => window.__askConflict(options), from);
    const win = await page.until(measureConflictWindow);
    conflictLayout(win, from, note);
    try { await act(win); } catch (error) { note('geste impossible', `${String(error.message).slice(0, 150)}`); await page.press('Escape'); continue; }
    const answer = await page.until(() => window.__conflict, [], 2000).catch(() => null);
    if (!answer) note('pas de réponse', 'la fenêtre ne rend aucune réponse');
    else if (answer.choice !== expect.choice || answer.again !== expect.again) note('mauvaise réponse', `la réponse est ${JSON.stringify(answer)} au lieu de ${JSON.stringify(expect)}`);
    if (await page.run(() => Boolean(document.querySelector('.mod.ask')))) { note('fenêtre restée ouverte', 'la fenêtre reste ouverte après la réponse'); await page.press('Escape'); }
  }
  return found;
}

// Après un Tab : le clavier est sur l'élément de clé `wanted` (`conflict-again` : la case des suivants).
async function expectFocus(page, wanted, found, tag) {
  const active = await page.run(() => (document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk || null : null));
  if (active !== wanted) found.push({ kind: 'fenêtre « Ce nom est déjà pris » : Tab', text: `${tag} : après Tab le clavier est sur « ${active} » au lieu de « ${wanted} »` });
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
    test(`l'explorateur, son menu « Réglages » et les fenêtres « Thème » et « Ce nom est déjà pris » en ${language === 'fr' ? 'français' : 'anglais'}`, { skip: SKIP, timeout: 240000 }, async () => {
      const { page } = browser;
      await page.goto(`${site.url}${PAGE}?lang=${language}`);
      await page.run(() => window.__ready);
      const problems = [];
      for (const width of WIDTHS) {
        for (const scale of SCALES) {
          for (const mode of MODES) {
            await page.view({ width, scale, mode });
            const tag = caption(language, width, scale, mode);
            problems.push(...await listProblems(page, tag), ...await columnProblems(page, width, language, tag), ...await piecesJointesProblems(page, width, language, tag), ...await mouseProblems(page, tag), ...await tilesProblems(page, tag), ...await settingsProblems(page, language, width, scale, tag), ...await themeProblems(page, width, tag), ...await conflictProblems(page, tag));
          }
        }
      }
      // La corbeille et le clavier (test/corbeille-firefox.mjs), la copie et le presse-papiers (test/copier-firefox.mjs), la question de « fermer » (test/fermer-firefox.mjs), les dossiers sans fichier
      // (test/dossiers-firefox.mjs), le fichier que seule l'app ouverte sait fermer ou copier (test/composite-firefox.mjs), Ctrl+Z (test/annuler-firefox.mjs) : à 700 px, la largeur du panneau de référence, en clair et en sombre.
      await page.view({ width: 700, scale: 1, mode: 'light' });
      for (const mode of MODES) {
        await page.view({ width: 700, scale: 1, mode });
        problems.push(...await corbeilleProblems(page, language, caption(language, 700, 1, mode)));
        problems.push(...await copierProblems(page, language, caption(language, 700, 1, mode)));
        problems.push(...await fermerProblems(page, language, caption(language, 700, 1, mode)));
        problems.push(...await droitsProblems(page, language, caption(language, 700, 1, mode)));
        problems.push(...await partagerProblems(page, language, caption(language, 700, 1, mode)));
        problems.push(...await partagerAutreProblems(page, language, caption(language, 700, 1, mode)));
        problems.push(...await poidsFenetreProblems(page, language, caption(language, 700, 1, mode)));
        problems.push(...await dossiersProblems(page, language, caption(language, 700, 1, mode)));
        problems.push(...await compositeProblems(page, language, caption(language, 700, 1, mode)));
        problems.push(...await annulerProblems(page, language, caption(language, 700, 1, mode)));
        problems.push(...await lookProblems(page, caption(language, 700, 1, mode)));
      }
      // Les icônes des types (test/icones-firefox.mjs) : une fois, en français (la couleur et le trait ne dépendent pas de la langue).
      if (language === 'fr') problems.push(...await iconProblems(page));
      // Les erreurs de script de la page et les avertissements de GFS (un texte inconnu, par exemple) ; sans le kit (sous-module non récupéré), le sélecteur de couleur dit qu'il ne se charge pas : ce n'est pas l'interface.
      const logged = page.logs.filter(entry => ((entry.level === 'error' && entry.type === 'javascript') || /GFS/.test(entry.text || '')) && !/sélecteur de couleur du kit/.test(entry.text || ''));
      for (const entry of logged) problems.push({ kind: 'la page écrit dans la console', text: `la page a écrit « ${String(entry.text).slice(0, 120)} »` });
      assert.equal(problems.length, 0, report(problems));
    });

    // Le glisser-déposer (test/glisser-firefox.mjs) : seul, sur une page rechargée, car Firefox sans écran laisse le glissement en cours après le lâcher (il ne mesure que les lignes qui se tiennent, le départ et le survol).
    test(`le glisser-déposer de l'explorateur en ${language === 'fr' ? 'français' : 'anglais'}, en clair et en sombre : lignes tenues, départ, cibles qui acceptent ou refusent`, { skip: SKIP, timeout: 120000 }, async () => {
      const { page } = browser;
      const problems = [];
      for (const mode of MODES) {
        await page.goto(`${site.url}${PAGE}?lang=${language}`);
        await page.run(() => window.__ready);
        await page.view({ width: 700, scale: 1, mode });
        problems.push(...await glisserProblems(page, language, caption(language, 700, 1, mode)));
      }
      assert.equal(problems.length, 0, report(problems));
    });
  }
});

// Le calendrier du kit (kit 0.8.0 : cahier 4.5, « le calendrier »), servi par GFS à Tuesday et à Calendar+ : sa page d'essai est celle du kit (`prototype/kit/navigateur/calendrier.html`), un vrai Firefox sans écran la joue
// à 700 × 400, en français et en anglais, en clair et en sombre (test/mesures-calendrier.mjs) : la mise en page du mois et de la semaine, la souris et le clavier, et le glisser-déposer du navigateur du porteur.
const KIT_CALENDAR = existsSync(join(ROOT, 'kit', 'js', 'calendrier', 'index.js'));
if (firefox && !KIT_CALENDAR) process.stderr.write('Le kit 0.8.0 est absent (git submodule update --init prototype/kit) : le calendrier n\'est PAS mesuré sous Firefox.\n');
const SKIP_CALENDAR = !firefox ? SKIP : (KIT_CALENDAR ? false : 'le kit 0.8.0 est absent (git submodule update --init prototype/kit)');

describe('le calendrier du kit sous Firefox', () => {
  let site;
  let browser;

  before(async () => {
    if (SKIP_CALENDAR) return;
    site = await serveSite(ROOT);
    browser = await startFirefox(firefox);
  });

  after(async () => {
    if (browser) await browser.close();
    if (site) await site.close();
  });

  for (const language of LANGUAGES) {
    test(`le calendrier en ${language === 'fr' ? 'français' : 'anglais'}, en clair et en sombre : mise en page, souris, clavier, glisser-déposer`, { skip: SKIP_CALENDAR, timeout: 240000 }, async () => {
      const { page } = browser;
      const logged = page.logs.length;
      const problems = [];
      for (const mode of MODES) problems.push(...await calendarProblems(page, site, language, mode));
      problems.push(...calendarLogs(page, logged));
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
