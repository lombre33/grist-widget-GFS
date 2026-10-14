// Mise en place commune des essais dans un VRAI Grist (grist-static 0.1.6) : ajoute le widget GFS par son adresse, lui donne l'accès complet
// et rend le cadre de GFS, ou celui d'une app (sous-cadre de GFS) quand on le demande.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, newLabPage, SHOTS } from './lab-common.mjs';

const WIDGET = 'http://127.0.0.1:8911/prototype/index.html';

export async function startLab({ lang = 'fr', colorScheme = 'light', width = 1280, height = 800, query = '', fullAccess = true } = {}) {
  await mkdir(SHOTS, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox', '--font-render-hinting=none'] });
  const { page, context } = await newLabPage(browser, { lang, colorScheme, width, height });
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
      const f = page.frames().find(f => f.url().startsWith('http://127.0.0.1:8911/prototype/apps/') && re.test(f.url()));
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
  await page.getByPlaceholder('Widget URL').pressSequentially(WIDGET + query, { delay: 5 });
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
  return { browser, context, page, frame, gfsFrame, appFrame, gfsReady, shot: (run, name) => page.screenshot({ path: join(SHOTS, `${run}-${name}.png`) }) };
}
