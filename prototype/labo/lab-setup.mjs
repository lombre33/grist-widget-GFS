// Mise en place commune des essais dans un VRAI Grist (grist-static 0.1.6) : ajoute le widget GFS par son adresse, lui donne l'accès complet
// et rend le cadre de GFS, ou celui d'une app (sous-cadre de GFS) quand on le demande.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, newLabPage, SHOTS } from './lab-common.mjs';

const WIDGET = 'http://127.0.0.1:8911/prototype/index.html';

export async function startLab({ lang = 'fr', colorScheme = 'light', width = 1280, height = 800, query = '', fullAccess = true, probes = false, frameAttributes = null, patches = [] } = {}) {
  await mkdir(SHOTS, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox', '--font-render-hinting=none'] });
  const { page, context } = await newLabPage(browser, { lang, colorScheme, width, height, probes, frameAttributes, patches });
  const gfsFrame = async (re = /./) => {
    for (let i = 0; i < 80; i++) {
      const f = page.frames().find(f => f.url().startsWith(WIDGET) && re.test(f.url()));
      if (f) return f;
      await page.waitForTimeout(500);
    }
    return null;
  };
  const appFrame = async (re = /./) => {
    for (let i = 0; i < 120; i++) {
      const f = page.frames().find(f => /^http:\/\/127\.0\.0\.1:8911\/prototype\/(apps|labo\/sondes)\//.test(f.url()) && re.test(f.url()));
      if (f) return f;
      await page.waitForTimeout(500);
    }
    return null;
  };
  const gfsReady = async frame => {
    await frame.waitForFunction(() => document.body.dataset.gfs === 'ready', null, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(500);
  };
  await page.goto('http://127.0.0.1:8910/lab.html', { waitUntil: 'load' });
  await page.waitForSelector('text=Dupont', { timeout: 60000 });
  await page.locator('.test-dp-add-new').first().click();
  await page.locator('.test-dp-add-widget-to-page').click();
  await page.waitForTimeout(500);
  await page.getByText('Custom', { exact: true }).click();
  await page.locator('[class*="wselect"]').getByText('clients').first().click().catch(() => {});
  await page.getByText('Add to page', { exact: true }).click();
  await page.waitForTimeout(1500);
  await page.getByText('Custom URL', { exact: true }).first().click();
  await page.getByPlaceholder('Widget URL').click();
  // Grist ajoute ses propres paramètres après ceux de l'adresse (searchParams.append) : le premier `language` gagne, c'est celui du labo.
  const address = `${WIDGET}?language=${lang}&culture=${lang === 'en' ? 'en-GB' : 'fr-FR'}${query ? '&' + query.replace(/^\?/, '') : ''}`;
  await page.getByPlaceholder('Widget URL').pressSequentially(address, { delay: 5 });
  await page.locator('.test-custom-widget-gallery-save').click();
  await page.waitForTimeout(800);
  await page.getByText('I confirm that I understand these warnings and accept the risks').click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  let frame = await gfsFrame(/access=none/);
  await page.waitForTimeout(1500);
  if (fullAccess) {
    await page.mouse.click(1263, 24);
    await page.waitForTimeout(800);
    await page.getByText('CLIENTS Custom', { exact: false }).first().click({ position: { x: 20, y: 5 } }).catch(() => {});
    await page.waitForTimeout(800);
    await page.locator('.test-right-panel').getByText('No document access', { exact: true }).first().click();
    await page.waitForTimeout(400);
    await page.getByText('Full document access', { exact: true }).last().click();
    await page.waitForTimeout(500);
    frame = await gfsFrame(/access=full/);
  }
  await gfsReady(frame);
  // Le panneau de référence : 700 × 400 (charte). On ajuste la fenêtre du navigateur jusqu'à ce que le cadre de GFS mesure cela dans la vraie page de
  // Grist ; le protocole entre Grist et le widget n'est pas touché.
  const fitPanel = async (target = frame, width = 700, height = 400) => {
    const element = await target.frameElement();
    // Le widget partage la page avec une autre section : la largeur ne suit qu'à moitié la fenêtre, d'où le gain de 2 (la hauteur suit 1 pour 1).
    for (let i = 0; i < 12; i++) {
      const box = await element.boundingBox();
      const dw = Math.round(width - box.width);
      const dh = Math.round(height - box.height);
      if (Math.abs(dw) <= 1 && Math.abs(dh) <= 1) return box;
      const size = page.viewportSize();
      await page.setViewportSize({ width: size.width + (Math.abs(dw) > 1 ? dw * 2 : 0), height: size.height + dh });
      await page.waitForTimeout(500);
    }
    return element.boundingBox();
  };
  // La fenêtre « Apps et extensions » : le bouton « Apps » de l'explorateur, ou le repère au-dessus d'une app.
  const openModules = async (target = frame) => {
    if (await target.locator('.mod').count()) return;
    if (await target.locator('#floater-apps').isVisible()) await target.locator('#floater-apps').click();
    else await target.locator('.ex-title-row .tb', { hasText: /Apps/ }).click();
    await target.locator('.mod').waitFor();
  };
  // Installe une app par la fenêtre (une personne : la case, puis « Ouvrir ») et rend son cadre.
  const openApp = async (id, pattern = /./) => {
    await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
    await openModules();
    await frame.locator(`[data-fk="app:${id}"]`).check();
    await frame.locator(`[data-open="${id}"]`).click();
    return appFrame(pattern);
  };
  return { browser, context, page, frame, gfsFrame, appFrame, openModules, openApp, gfsReady, fitPanel, shot: (run, name) => page.screenshot({ path: join(SHOTS, `${run}-${name}.png`) }),
    // La capture du cadre de GFS seul (le panneau), pas de la page de Grist.
    shotPanel: async (run, name, target = frame) => (await target.frameElement()).screenshot({ path: join(SHOTS, `${run}-${name}.png`) }) };
}
