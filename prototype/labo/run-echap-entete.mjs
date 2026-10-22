// « Échap » dans l'édition de l'en-tête et du pied de page de Publipostage+, dans GFS (demande du porteur du 22/10, consigne 034 de GFS à l'app), dans un vrai Grist (grist-static), à 700 × 400,
// au vrai clavier et à la vraie souris. Ce que la passe mesure :
//   1. la touche arrive jusqu'à l'app : GFS n'avale pas Échap dans le sous-cadre isolé (un écouteur en capture compte l'appui) ;
//   2. le mode en-tête s'ouvre, puis « Terminer » le quitte (la fonction que « Échap » doit appeler) ;
//   3. dans le mode, Échap quitte comme « Terminer », pied de page compris (CONSTAT tant que l'app ne le fait pas : elle n'a aucun gestionnaire de touche pour ce mode).
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `echap-entete-${lang}-${scheme}`;
const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const errors = [];
page.on('pageerror', error => errors.push(String(error && error.message).slice(0, 160)));
const constat = (label, ok, detail) => (ok ? say('OK    ', label) : say('CONSTAT', label, detail));
await lab.fitPanel(undefined, 700, 400);
await seedFiles(lab.frame);
const app = await lab.openApp('publipostage', /apps\/publipostage\/|publipostageGrist\//);
await page.waitForTimeout(5000);
await lab.fitPanel(undefined, 700, 400);
const editing = () => app.evaluate(() => HeaderFooterPreview.isEditingHeaderFooter());
const enter = zone => app.evaluate(zone => { HeaderFooterPreview.enterHeaderFooterMode(zone, 'default'); return HeaderFooterPreview.isEditingHeaderFooter(); }, zone);

// 1. La touche arrive dans l'app.
await app.evaluate(() => { window.__echap = 0; document.addEventListener('keydown', event => { if (event.key === 'Escape') window.__echap += 1; }, true); });
await app.locator('.ProseMirror').first().click();
await page.keyboard.press('Escape');
check('Échap, au vrai clavier, arrive dans le cadre de l\'app : GFS ne l\'avale pas', await app.evaluate(() => window.__echap) === 1);

// 2. Le mode en-tête et « Terminer ».
check('le mode « en-tête » s\'ouvre', await enter('header') === true);
await page.waitForTimeout(600);
await lab.shotPanel(run, '1-mode-en-tete', app);
await app.locator('#v2-hf-btn-done').click();
await page.waitForTimeout(400);
check('« Terminer » quitte le mode', await editing() === false);

// 3. Échap dans le mode : l'en-tête, puis le pied de page.
for (const zone of ['header', 'footer']) {
  await enter(zone);
  await page.waitForTimeout(500);
  await app.locator('.ProseMirror').first().click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  constat(`dans le mode « ${zone === 'header' ? 'en-tête' : 'pied de page'} », Échap quitte comme « Terminer »`, await editing() === false, 'le mode reste ouvert : aucun gestionnaire de touche dans js/header-footer-preview.js');
  if (await editing()) await app.locator('#v2-hf-btn-done').click();
  await page.waitForTimeout(300);
}

check('aucune erreur de page pendant la passe', errors.length === 0, errors);
await lab.browser.close();
