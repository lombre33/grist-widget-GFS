// Le bouton « LanguageTool » de GFS avec la VRAIE Publipostage+ (consigne 068 ; kit 0.22.0 ; contrats 5.2, point 13 ; faits vérifiés 104), dans un vrai Grist (grist-static), à 700 × 400, à la vraie
// souris et au vrai clavier (Playwright : événements du pointeur et du clavier du navigateur, jamais dispatchEvent). C'est la seule mesure qui dise si le vrai éditeur de l'app (un TipTap bâti sur
// ProseMirror, le même pour le document, la grille et la présentation de Slides+) garde la marque `data-lt-active="false"` quand la personne tape, quand une fenêtre s'ouvre et quand le modèle change.
// L'app est servie par GFS dans son sous-cadre isolé (sans `allow-same-origin`), le lien est celui de l'app (`GfsLink`, `GfsCorrecteurs`), la pose est celle du kit (`createCorrecteurs`). Ce que LanguageTool
// fait de la marque (il l'obéit, à chaud, sur l'élément éditable lui-même) a été mesuré par le porteur dans son Firefox le 12/11 : ici on mesure ce que l'app pose, à l'endroit où il le lit.
// REPO_DIR : le dépôt de GFS, dont `prototype/apps/publipostage/` porte l'app (le sous-module n'est pas récupéré dans le cloud : `git archive` de la référence, plus son `kit/`).
// LAB_LANG=fr|en est la langue de Grist, LAB_SCHEME=light|dark. Ce que la passe mesure :
//   1. le départ : l'app hébergée lit `coupes: false`, la pose tourne (`GfsCorrecteurs.active()`), aucune zone de texte ne porte de marque (le document a déjà son éditeur, le nom, les champs) ;
//   2. la ligne « Bouton LanguageTool » cochée, puis le bouton de la barre à la souris : toutes les zones de texte de la page, celle de l'éditeur comprise, portent la marque, sans recharger le cadre ;
//   3. la personne tape et saute des lignes au vrai clavier, annule (Ctrl+Z) : la racine de l'éditeur garde sa marque, le texte est bien tapé ;
//   4. une fenêtre s'ouvre ensuite (les Réglages de l'app) : ses champs naissent marqués ; une grille ouverte à la place du document : ses zones aussi ; une présentation de Slides+ (l'extension
//      « Diapositives » cochée, trois diapositives et leur bande) : le même éditeur, ses zones aussi, et celles d'une diapositive ajoutée ensuite à la souris ;
//   5. le bouton rallume : plus aucune marque, et la saisie marche encore ;
//   6. GFS rechargé alors que c'est coupé : l'app ouverte ensuite lit `coupes: true` dans son contexte et ses zones sont marquées dès que l'éditeur est là ;
//   7. le cadre de l'app n'est jamais reconstruit, aucune erreur de page, aucun avertissement de GFS.
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check } from './lab-common.mjs';
import { collectWarnings, waiter, reopenGfs } from './lab-gestes.mjs';
import { openSettings, settingsRows, ROW } from './reglages-gestes.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `correcteurs-publipostage-${lang}-${scheme}`;
const WORDS = { fr: { close: 'Fermer' }, en: { close: 'Close' } }[lang];
const DOC = 'Contrat de prestation';
const GRID = 'Émargement (grille)';
const DECK = 'Trois diapositives';
const BREAK = '<div class="page-break-marker" contenteditable="false">Saut de page</div>';
const DECK_HTML = `<h2>Titre un</h2><p>Premier texte</p>${BREAK}<h2>Titre deux</h2><p>Deuxième texte <strong>gras</strong></p>${BREAK}<p>Trois</p>`;

const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const warnings = collectWarnings(page);
const errors = [];
page.on('pageerror', error => errors.push(String(error && error.message).slice(0, 160)));
await lab.fitPanel(undefined, 700, 400);
say('semis :', await seedFiles(lab.frame));
let frame = lab.frame;
let app = null;
const shot = name => lab.shotPanel(run, name, frame);
const waitFor = waiter(page, 60);
const row = text => frame.locator('.ls-row', { hasText: text }).first();
const lt = () => frame.locator('#floater-lt');
const appFrames = () => page.frames().filter(f => /\/apps\/publipostage\//.test(f.url())).length;
const stored = key => frame.evaluate(name => { try { return localStorage.getItem(name); } catch (error) { return 'REFUSÉ'; } }, key);

// Les zones de texte de la page (la même définition que le kit : `textarea`, `input` de texte, `contenteditable` qui ne l'est pas à « false ») et la marque que chacune porte.
const zones = () => app.evaluate(() => {
  const TEXT = new Set(['', 'text', 'search', 'email', 'url', 'tel']);
  const VALUES = new Set(['', 'true', 'plaintext-only']);
  const editable = node => {
    const tag = node.tagName.toLowerCase();
    if (tag === 'textarea') return true;
    if (tag === 'input') return TEXT.has((node.getAttribute('type') || '').trim().toLowerCase());
    const value = node.getAttribute('contenteditable');
    return value !== null && VALUES.has(value.trim().toLowerCase());
  };
  const all = [...document.querySelectorAll('textarea, input, [contenteditable]')].filter(editable);
  const name = node => `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ''}${node.className && typeof node.className === 'string' ? `.${node.className.trim().split(/\s+/)[0]}` : ''}`;
  const root = document.querySelector('.ProseMirror');
  return {
    total: all.length,
    marked: all.filter(node => node.getAttribute('data-lt-active') === 'false').length,
    missing: all.filter(node => node.getAttribute('data-lt-active') !== 'false').map(name).slice(0, 8),
    anywhere: document.querySelectorAll('[data-lt-active]').length,
    other: [...document.querySelectorAll('[data-lt-active]')].filter(node => !editable(node)).map(name).slice(0, 8),
    root: root ? root.getAttribute('data-lt-active') : 'ABSENTE',
  };
});
const link = () => app.evaluate(() => ({ hosted: GfsLink.hosted, coupes: GfsLink.correcteurs().coupes, active: GfsCorrecteurs.active() }));
const waitStarted = async () => {
  await app.waitForFunction(() => { const e = document.getElementById('status-msg'); return Boolean(e && e.textContent) && Boolean(document.querySelector('.ProseMirror')); }, null, { timeout: 30000 });
  await page.waitForTimeout(600);
};
const shownName = () => app.evaluate(() => document.getElementById('template-name').value);
const waitName = async name => { for (let i = 0; i < 200; i++) { if ((await shownName().catch(() => '')) === name) return true; await page.waitForTimeout(100); } return false; };
const showFiles = async () => {
  if (!(await frame.locator('.ex').isVisible())) await frame.locator('#floater-files').click();
  await frame.locator('.ls-row').first().waitFor();
  if (await frame.locator('.crumbs [data-path=""]').count()) await frame.locator('.crumbs [data-path=""]').click();
  await row(DOC).waitFor();
};
const closeExplorer = async () => {
  await frame.locator('.ex-foot .btn', { hasText: new RegExp(`^${WORDS.close}$`) }).click();
  await frame.locator('#floaters').waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
};
const clickRow = async () => { await openSettings(frame); await settingsRows(frame).nth(ROW.langtool).click(); await frame.locator('.menu').waitFor({ state: 'detached' }); };
const openModel = async (name, folder) => {
  await showFiles();
  if (folder) await row(folder).dblclick();
  await row(name).dblclick();
  await closeExplorer().catch(() => {});
  return waitName(name);
};

// ---------- 0. l'app démarre, une fois, pour écrire ses colonnes (fenêtre des apps), puis GFS repart et ouvre le document ----------
await frame.evaluate(({ name, html }) => grist.docApi.applyUserActions([
  ['AddRecord', 'Publipostage_Modeles', null, { Nom: name, TypeModele: 'presentation', Contenu: html }],
]), { name: DECK, html: DECK_HTML });
await lab.openModules(frame);
await frame.locator('[data-fk="ext:publipostage/diapositives"]').check();
await lab.settle(frame);
await frame.locator('[data-open="publipostage"]').click();
app = await lab.appFrame(/publipostage/);
await waitStarted();
frame = await reopenGfs(lab, frame, 500);
await showFiles();
await row(DOC).dblclick();
app = await lab.appFrame(/publipostage/);
await waitStarted();
check('le document est ouvert dans l\'app', await waitName(DOC));
await closeExplorer().catch(() => {});

// ---------- 1. le départ ----------
let state = await link();
let found = await zones();
say('au départ :', state, found);
check('l\'app hébergée lit « correcteurs coupés : non », la pose du kit tourne', state.hosted === true && state.coupes === false && state.active === true, state);
check('la page a des zones de texte (l\'éditeur, le nom du modèle…) et aucune ne porte de marque', found.total >= 2 && found.anywhere === 0 && found.root === null, found);
check('le bouton n\'est pas dans la barre de GFS', await lt().isHidden());
await shot('1-depart');

// ---------- 2. la ligne cochée, puis le bouton ----------
if (!(await frame.locator('.ex').isVisible())) await frame.locator('#floater-files').click();
await frame.locator('.ex').waitFor({ state: 'visible' });
await clickRow();
check('la ligne cochée : GFS retient `gfs.langtool`, rien n\'est encore coupé', (await stored('gfs.langtool')) === 'oui' && (await stored('gfs.correcteurs')) === null);
await closeExplorer().catch(() => {});
await page.waitForTimeout(400);
found = await zones();
check('le bouton est dans la barre, enfoncé (LanguageTool travaille), et l\'app ne marque encore rien', (await lt().getAttribute('aria-pressed')) === 'true' && found.anywhere === 0, found);
const before = app.url();
await lt().click();
await waitFor('la marque posée par l\'app', async () => (await zones()).root === 'false');
found = await zones();
state = await link();
say('après le clic :', state, found);
check('un clic coupe : l\'app lit `coupes: true`, la racine de l\'éditeur et chaque zone de texte portent `data-lt-active="false"`', state.coupes === true && found.marked === found.total && found.total >= 2, { state, found });
check('aucune marque ailleurs que sur une zone de texte (ni conteneur, ni bouton, ni mot de passe)', found.anywhere === found.total && found.other.length === 0, found);
check('le cadre de l\'app n\'a pas été rechargé (même adresse, un seul cadre)', app.url() === before && appFrames() === 1, { before, now: app.url() });
check('GFS retient `gfs.correcteurs`', (await stored('gfs.correcteurs')) === 'oui');
await shot('2-coupe');

// ---------- 3. la personne tape (vrai clavier) ----------
const editorBox = await app.locator('.ProseMirror p').first().boundingBox();
await page.mouse.click(editorBox.x + editorBox.width - 3, editorBox.y + editorBox.height / 2);
await page.keyboard.press('End');
await page.keyboard.type(' Bonjour');
await page.keyboard.press('Enter');
await page.keyboard.type('Deuxième ligne');
await page.waitForTimeout(300);
const typed = await app.evaluate(() => document.querySelector('.ProseMirror').textContent);
found = await zones();
check('le texte est bien tapé (au vrai clavier) et la racine de l\'éditeur garde sa marque', typed.includes('Bonjour') && typed.includes('Deuxième ligne') && found.root === 'false', { typed: typed.slice(-40), root: found.root });
await page.keyboard.press('Control+z');
await page.keyboard.press('Control+z');
await page.waitForTimeout(300);
found = await zones();
check('après Ctrl+Z, la marque est toujours là, sur chaque zone', found.root === 'false' && found.marked === found.total, found);

// ---------- 4. une fenêtre naît ensuite, une grille remplace le document ----------
await app.locator('#v2-btn-settings').click();
await page.waitForTimeout(500);
found = await zones();
say('Réglages ouverts :', found);
check('la fenêtre des Réglages s\'ouvre après la coupure : ses champs de texte naissent marqués, rien n\'est oublié', found.marked === found.total && found.missing.length === 0, found);
await shot('3-reglages');
await app.locator('#settings-close').click();
await page.waitForTimeout(300);
check('le modèle « grille » s\'ouvre à la place du document', await openModel(GRID, 'Formation'));
await page.waitForTimeout(600);
found = await zones();
say('grille :', found);
check('la grille a ses zones de texte, toutes marquées, racine de l\'éditeur comprise', found.total >= 2 && found.marked === found.total && found.root === 'false', found);
await shot('4-grille');

// ---------- 4 bis. Slides+ : une présentation (le même éditeur, la bande des diapositives) ----------
check('la présentation s\'ouvre à la place de la grille', await openModel(DECK));
await app.waitForFunction(() => document.querySelectorAll('.pp-slide-strip .pp-slide-item').length >= 3, null, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(600);
let deck = await app.evaluate(() => ({ items: document.querySelectorAll('.pp-slide-strip .pp-slide-item').length, text: document.querySelector('.ProseMirror').textContent.slice(0, 40) }));
found = await zones();
say('présentation :', deck, found);
check('c\'est bien une présentation : la bande montre ses trois diapositives', deck.items === 3, deck);
check('ses zones de texte sont toutes marquées, racine de l\'éditeur comprise (coupé avant qu\'elle s\'ouvre)', found.total >= 2 && found.marked === found.total && found.root === 'false', found);
await app.locator('.ProseMirror h2').first().click();
await page.keyboard.press('End');
await page.keyboard.type(' bis');
await page.waitForTimeout(300);
found = await zones();
check('on tape dans la diapositive (vrai clavier) : la marque reste', (await app.evaluate(() => document.querySelector('.ProseMirror').textContent)).includes('Titre un bis') && found.root === 'false' && found.marked === found.total, found);
const slideCount = await app.evaluate(() => document.querySelectorAll('.pp-slide-strip .pp-slide-item').length);
await app.locator('.pp-slide-strip .pp-slide-item').nth(1).click();
await page.waitForTimeout(500);
found = await zones();
check('une autre diapositive choisie à la souris : les zones qui apparaissent sont marquées aussi', found.marked === found.total && found.missing.length === 0 && slideCount === 3, { found, slideCount });
await shot('4b-presentation');

// ---------- 5. le bouton rallume ----------
await lt().click();
await waitFor('les marques retirées', async () => (await zones()).anywhere === 0);
found = await zones();
state = await link();
check('le bouton rallume : l\'app lit `coupes: false` et plus aucune zone ne porte de marque', state.coupes === false && found.anywhere === 0 && (await stored('gfs.correcteurs')) === null, { state, found });
const typedAfter = await (async () => {
  // Le titre de la diapositive à l'écran (les autres diapositives sont posées hors du panneau) : il se clique à la vraie souris.
  const onScreen = await app.evaluate(() => [...document.querySelectorAll('.ProseMirror h2')].findIndex(h => {
    const r = h.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
  }));
  const box = await app.locator('.ProseMirror h2').nth(onScreen).boundingBox();
  await page.mouse.click(box.x + 6, box.y + box.height / 2);
  await page.keyboard.press('End');
  await page.keyboard.type('X');
  await page.waitForTimeout(200);
  return app.evaluate(() => document.querySelector('.ProseMirror').textContent);
})();
check('et l\'éditeur marche encore : on peut y taper', typedAfter.includes('X'), typedAfter.slice(0, 80));
await lt().click();
await waitFor('la coupure de nouveau', async () => (await zones()).root === 'false');

// ---------- 6. GFS rechargé alors que c'est coupé ----------
frame = await reopenGfs(lab, frame, 500);
check('GFS rechargé : les deux choix sont retenus', (await stored('gfs.langtool')) === 'oui' && (await stored('gfs.correcteurs')) === 'oui');
await showFiles();
await row(DOC).dblclick();
app = await lab.appFrame(/publipostage/);
await waitStarted();
await closeExplorer().catch(() => {});
state = await link();
found = await zones();
say('après rechargement :', state, found);
check('l\'app ouverte ensuite lit `coupes: true` dans son contexte et ses zones de texte, l\'éditeur compris, portent la marque', state.coupes === true && found.total >= 2 && found.marked === found.total && found.root === 'false', { state, found });
check('le bouton est là, relevé (coupé), comme on l\'a laissé', (await lt().getAttribute('aria-pressed')) === 'false');
await shot('5-recharge');

// ---------- 7. rien d'anormal ----------
check('aucune erreur de page, aucun avertissement de GFS pendant la passe', errors.length === 0 && warnings.length === 0, { errors, warnings: warnings.map(text => text.slice(0, 120)) });
await lab.browser.close();
