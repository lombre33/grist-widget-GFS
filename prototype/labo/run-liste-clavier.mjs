// Le clavier dans la liste de l'explorateur (js/explorer/explorer.js `#onListKey`, js/explorer/explorer-keys.js ; décision du porteur du 04/11 : tout se fait aussi au clavier), dans un vrai Grist (grist-static), à 700 × 400,
// au vrai clavier (Playwright : touches du navigateur, jamais dispatchEvent). Les gestes qui déplacent le choix (↑ ↓ Début Fin, ← → ↑ ↓ en vignettes), ceux qui agissent sur la ligne choisie (Entrée, F2,
// la touche Menu) et Retour arrière, qui remonte d'un dossier. LAB_LANG=fr|en, LAB_SCHEME=light|dark.
//   REPO_DIR="$(realpath ../..)" node run-liste-clavier.mjs
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { check, say } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const warnings = [];
page.on('console', message => { if (message.type() === 'warning' && message.text().startsWith('GFS')) warnings.push(message.text()); });
await lab.fitPanel(undefined, 700, 400);
await seedFiles(lab.frame);
await lab.frame.evaluate(() => location.reload());
await page.waitForTimeout(1000);
const frame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(frame);
await page.waitForTimeout(800);

const rows = frame.locator('.ls-row');
const selected = () => frame.locator('.ls-row[aria-selected="true"]');
const names = async () => (await rows.locator('.t').allInnerTexts()).map(text => text.trim());
const current = async () => (await selected().count()) === 1 ? (await selected().locator('.t').innerText()).trim() : null;
const crumbs = async () => (await frame.locator('.crumbs').innerText()).replace(/\s+/g, ' ').trim();
// Revenir à « Moi » : le fil d'Ariane quand il montre un lien vers la racine, sinon le volet des dossiers (à la racine, rien à faire).
const goMe = async () => {
  const link = frame.locator('.crumbs [data-path=""]');
  const me = frame.locator('.tr-row', { hasText: /^\s*(Moi|Me)\s*$/ });
  if (await link.count()) await link.click();
  else if (await me.isVisible()) await me.click();
  await page.waitForTimeout(150);
};
const press = async key => { await page.keyboard.press(key); await page.waitForTimeout(80); };

await goMe();
const all = await names();
say('la liste à la racine :', all);
check('la liste a de quoi naviguer (dossiers et fichiers)', all.length >= 4, all);

// 1. Une ligne cliquée, puis les flèches, Début et Fin.
await rows.nth(1).click();
check('un clic choisit la ligne', (await current()) === all[1], await current());
await press('ArrowDown');
check('↓ choisit la ligne suivante', (await current()) === all[2], await current());
await press('ArrowUp');
await press('ArrowUp');
check('↑ choisit la ligne précédente', (await current()) === all[0], await current());
await press('ArrowUp');
check('↑ sur la première ligne reste sur la première', (await current()) === all[0], await current());
await press('End');
check('Fin choisit la dernière ligne', (await current()) === all[all.length - 1], await current());
await press('ArrowDown');
check('↓ sur la dernière ligne reste sur la dernière', (await current()) === all[all.length - 1], await current());
await press('Home');
check('Début choisit la première ligne', (await current()) === all[0], await current());
check('la ligne choisie reçoit le focus (tabindex 0)', (await selected().getAttribute('tabindex')) === '0');

// 2. ← et → ne font rien en liste ; une touche sans geste non plus.
await press('ArrowRight');
await press('ArrowLeft');
await press('a');
check('← → et une lettre ne déplacent rien en liste', (await current()) === all[0], await current());

// 3. Entrée ouvre un dossier ; Retour arrière remonte d'un dossier ; le focus revient sur la liste.
const folders = await rows.evaluateAll(list => list.map((row, i) => (row.classList.contains('folder') ? i : -1)).filter(i => i >= 0));
check('la liste montre au moins un dossier', folders.length > 0, folders);
await rows.nth(folders[0]).click();
const folderName = await current();
await press('Enter');
await page.waitForTimeout(200);
check('Entrée sur un dossier l\'ouvre', (await crumbs()).includes(folderName), await crumbs());
await press('Backspace');
await page.waitForTimeout(200);
check('Retour arrière remonte au dossier parent (la racine)', !(await crumbs()).includes(folderName), await crumbs());

// 4. Les vignettes : ← → d'une vignette à l'autre, ↑ ↓ d'une rangée à l'autre.
await frame.locator('button[aria-label]', { has: frame.locator('use[href="#i-tiles"]') }).click();
await page.waitForTimeout(200);
const tiles = frame.locator('.th');
const tileNames = (await tiles.locator('.tn').allInnerTexts()).map(text => text.trim());
const tileSelected = async () => (await frame.locator('.th[aria-selected="true"]').count()) === 1 ? (await frame.locator('.th[aria-selected="true"] .tn').innerText()).trim() : null;
await tiles.nth(0).click();
check('un clic choisit une vignette', (await tileSelected()) === tileNames[0], await tileSelected());
await press('ArrowRight');
check('→ choisit la vignette suivante', (await tileSelected()) === tileNames[1], await tileSelected());
await press('ArrowLeft');
check('← choisit la vignette précédente', (await tileSelected()) === tileNames[0], await tileSelected());
await press('ArrowDown');
const down = await tileSelected();
check('↓ en vignettes descend d\'une rangée (ou reste sur la dernière rangée)', down !== null && tileNames.indexOf(down) >= 0, down);
await press('ArrowUp');
check('↑ revient à la rangée du dessus', (await tileSelected()) === tileNames[0], await tileSelected());
await press('End');
check('Fin choisit la dernière vignette', (await tileSelected()) === tileNames[tileNames.length - 1], await tileSelected());
await frame.locator('button[aria-label]', { has: frame.locator('use[href="#i-list"]') }).click();
await page.waitForTimeout(200);

// 5. F2 ouvre la fenêtre de renommage de la ligne choisie ; la touche Menu ouvre son menu ; Échap ferme.
await goMe();
const fileRows = await rows.evaluateAll(list => list.map((row, i) => (row.classList.contains('folder') ? -1 : i)).filter(i => i >= 0));
await rows.nth(fileRows[0]).click();
const fileName = await current();
await press('F2');
await page.waitForTimeout(300);
const rename = frame.locator('.mod input');
check('F2 ouvre la fenêtre de renommage du fichier choisi', (await rename.count()) === 1 && (await rename.inputValue()) === fileName, { count: await rename.count(), value: (await rename.count()) ? await rename.inputValue() : null });
await press('Escape');
await page.waitForTimeout(200);
check('Échap ferme la fenêtre', (await frame.locator('.mod').count()) === 0);
await rows.nth(fileRows[0]).click();
await press('ContextMenu');
await page.waitForTimeout(200);
check('la touche Menu ouvre le menu de la ligne choisie', (await frame.locator('.menu').count()) === 1);
await press('Escape');
await rows.nth(fileRows[0]).click();
await page.keyboard.press('Shift+F10');
await page.waitForTimeout(200);
check('Maj+F10 ouvre aussi le menu de la ligne', (await frame.locator('.menu').count()) === 1);
await press('Escape');

// 6. Suppr sur un fichier choisi : la ligne est choisie, et GFS passe à la corbeille (une fenêtre demande, ou le fichier part).
await rows.nth(fileRows[0]).click();
const before = await names();
await press('Delete');
await page.waitForTimeout(500);
const after = await names();
const asked = (await frame.locator('.mod').count()) > 0;
say('après Suppr :', { asked, avant: before.length, apres: after.length, notice: (await frame.locator('#toast').isVisible()) ? await frame.locator('#toast').innerText() : '' });
check('Suppr agit sur le fichier choisi (une fenêtre demande, ou il quitte la liste, ou GFS dit pourquoi)', asked || after.length < before.length || (await frame.locator('#toast').isVisible()));
if (asked) await press('Escape');

check('aucun avertissement de GFS', warnings.length === 0, warnings);
await lab.browser.close();
