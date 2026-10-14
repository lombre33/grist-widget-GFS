// V0.2 : la fenêtre « Apps et extensions » dans un vrai Grist (grist-static), à 700 × 400, à la vraie souris et au vrai clavier (Playwright :
// événements du pointeur et du clavier du navigateur, jamais dispatchEvent). LAB_LANG=fr|en, LAB_SCHEME=light|dark, LAB_W (largeur du panneau),
// LAB_READONLY=1 (la vue est ouverte en lecture seule : la fenêtre se grise).
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const panelWidth = Number(process.env.LAB_W || 700);
const readonly = process.env.LAB_READONLY === '1';
const run = `modules-${lang}-${scheme}${panelWidth === 700 ? '' : `-${panelWidth}`}${readonly ? '-lecture-seule' : ''}`;
const lab = await startLab({ lang, colorScheme: scheme, query: readonly ? 'readonly=true' : '' });
const { page } = lab;
const warnings = [];
page.on('console', m => { if ((m.type() === 'warning' || m.type() === 'error') && /GFS/.test(m.text())) warnings.push(m.text().slice(0, 200)); });
await lab.fitPanel(undefined, panelWidth, 400);
const frame = lab.frame;
const shot = name => lab.shotPanel(run, name, frame);
const text = async locator => (await locator.innerText()).replace(/\s+/g, ' ').trim();
const options = () => frame.evaluate(async () => (await grist.getOptions()) || {});
const appsOption = async () => (await options())['gfs.apps'];
const insideWindow = () => frame.evaluate(() => Boolean(document.activeElement && document.activeElement.closest('.mod')));
const count = () => text(frame.locator('.mod-count'));
const state = () => frame.evaluate(() => ({
  explorerInert: document.querySelector('.ex').inert, framesInert: document.getElementById('frames').inert, floatersInert: document.getElementById('floaters').inert,
  explorerHidden: document.querySelector('.ex').hidden, windows: document.querySelectorAll('.mod').length, appFrames: document.querySelectorAll('.app-frame').length,
}));
say('panneau :', await (await frame.frameElement()).boundingBox());

// ----- Porte 3 : la première ouverture d'une section sans choix retenu ouvre la fenêtre, une fois.
await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(500);
if (readonly) {
  check('lecture seule : la fenêtre ne s\'ouvre pas toute seule', (await state()).windows === 0);
  await frame.locator('.ex-title-row .tb', { hasText: /Apps/ }).click();
} else {
  check('première ouverture : la fenêtre est là', (await state()).windows === 1);
}
await frame.locator('.mod').waitFor();
say('titre :', await text(frame.locator('.mod-head')));
say('lignes :', await frame.locator('.mr').allInnerTexts().then(a => a.map(t => t.replace(/\s+/g, ' ').trim().slice(0, 90))));
say('rappel :', await text(frame.locator('.mod-note')));
check('le clavier est dans la fenêtre', await insideWindow());
check('le fond est inerte', (await state()).explorerInert === true && (await state()).framesInert === true);
check('Publipostage+ ne se décoche pas', await frame.locator('[data-fk="app:publipostage"]').isDisabled());
check('1 actif sur 3', /^1 /.test(await count()) || /^1 of 3/.test(await count()), await count());
await shot('1-premiere-ouverture');
await lab.shot(run, '1-page-grist');

// ----- Le clavier : Tab ne sort jamais de la fenêtre ; Échap la ferme et rend le fond.
let kept = true;
for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); kept = kept && await insideWindow(); }
for (let i = 0; i < 14; i++) { await page.keyboard.press('Shift+Tab'); kept = kept && await insideWindow(); }
check('Tab et Maj+Tab restent dans la fenêtre', kept);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
let now = await state();
check('Échap ferme la fenêtre et rend le fond', now.windows === 0 && now.explorerInert === false && now.framesInert === true, now);
check('l\'explorateur est toujours ouvert', !now.explorerHidden);

// ----- Porte « bouton Apps » de l'explorateur.
await frame.locator('.ex-title-row .tb', { hasText: /Apps/ }).click();
await frame.locator('.mod').waitFor();
check('le bouton Apps ouvre la fenêtre', (await state()).windows === 1);
await shot('2-fenetre');
if (readonly) {
  check('lecture seule : toutes les cases sont grisées', (await frame.locator('.mod input:not(:disabled)').count()) === 0);
  say('rappel :', await text(frame.locator('.mod-note')));
  await shot('2b-lecture-seule');
  await lab.browser.close();
  say('avertissements GFS :', warnings);
  process.exit(process.exitCode || 0);
}

// ----- Installer une app : un geste, un brouillon dans les réglages de la section.
check('rien n\'est écrit avant un geste', (await appsOption()) === undefined, await appsOption());
await frame.locator('label', { hasText: 'Automation+' }).first().click();
await page.waitForTimeout(500);
check('Automation+ installée : 2 actifs sur 3', /^2 /.test(await count()), await count());
check('le réglage est écrit pour la section', JSON.stringify(await appsOption()) === JSON.stringify({ publipostage: { extensions: [] }, automation: { extensions: [] } }), await appsOption());
check('Automation+ a son bouton Ouvrir', await frame.locator('[data-open="automation"]').isVisible());
await lab.shot(run, '3-page-grist-brouillon');
await shot('3-automation-installee');

// ----- Activer l'extension, choisir la copie de GFS.
check('le mode est grisé tant que l\'extension est décochée', await frame.locator('.mr-mode').evaluate(node => node.disabled));
await frame.locator('label', { hasText: /^\s*Graphique|^\s*Chart/ }).first().click();
await page.waitForTimeout(500);
check('Graphique cochée : 3 actifs sur 3', /^3 /.test(await count()), await count());
check('le mode se choisit maintenant', !(await frame.locator('.mr-mode').evaluate(node => node.disabled)));
await frame.locator('.rd', { hasText: /Copie de GFS|GFS copy/ }).click();
await page.waitForTimeout(500);
check('mode « copie de GFS » retenu pour l\'extension', JSON.stringify(await appsOption()) === JSON.stringify({ publipostage: { extensions: ['graphique'], modes: { graphique: 'vendorise' } }, automation: { extensions: [] } }), await appsOption());
await shot('4-extension-copie-de-gfs');
await frame.locator('.rd', { hasText: /CDN/ }).click();
await page.waitForTimeout(400);
check('retour au CDN : le défaut ne s\'écrit pas', JSON.stringify((await appsOption()).publipostage) === JSON.stringify({ extensions: ['graphique'] }), (await appsOption()).publipostage);

// ----- Ouvrir une app depuis sa ligne, puis la fenêtre depuis l'app (le bouton « Apps » flottant).
await frame.locator('[data-open="publipostage"]').click();
await page.waitForTimeout(600);
now = await state();
check('« Ouvrir » ferme la fenêtre et ouvre l\'app', now.windows === 0 && now.explorerHidden && now.appFrames === 1, now);
await frame.locator('#floater-apps').waitFor({ state: 'visible' });
await page.waitForTimeout(5000);
await frame.locator('#floater-apps').click();
await frame.locator('.mod').waitFor();
now = await state();
check('depuis l\'app : le cadre de l\'app est inerte', now.windows === 1 && now.framesInert === true, now);
await shot('5-depuis-une-app');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
now = await state();
check('Échap : le cadre de l\'app retrouve son état', now.windows === 0 && now.framesInert === false, now);
check('le clavier revient au bouton Apps', await frame.evaluate(() => document.activeElement && document.activeElement.id === 'floater-apps'));

// ----- Retirer l'app active : le cadre se ferme, l'explorateur revient.
await frame.locator('#floater-files').click();
await page.waitForTimeout(300);
await frame.locator('.ex-title-row .tb', { hasText: /Apps/ }).click();
await frame.locator('[data-open="automation"]').click();
await page.waitForTimeout(800);
check('Automation+ est l\'app active', await frame.evaluate(() => document.querySelector('.app-frame').title.startsWith('Automation')));
await frame.locator('#floater-apps').click();
await frame.locator('label', { hasText: 'Automation+' }).first().click();
await page.waitForTimeout(800);
now = await state();
check('retirer l\'app active ferme son cadre et rouvre l\'explorateur', now.appFrames === 0 && !now.explorerHidden, now);
check('Automation+ n\'est plus dans les réglages', !(await appsOption()).automation, await appsOption());
await shot('6-apres-retrait');
await page.keyboard.press('Escape');

// ----- La roue des réglages de la vue dans Grist : la porte permanente.
await page.getByText('Open configuration', { exact: false }).first().click({ timeout: 5000 }).catch(() => say('(pas de bouton « Open configuration » dans le panneau de Grist)'));
await page.waitForTimeout(800);
check('la roue de Grist ouvre la fenêtre', (await state()).windows === 1);
await lab.shot(run, '7-page-grist-roue');
await lab.browser.close();
say('avertissements GFS :', warnings);
