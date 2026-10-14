// Ce que GFS montre sans l'accès complet (contrats 3.1, point 4) dans un vrai Grist : « none », le niveau d'une section que l'on vient d'ajouter par son adresse (c'est
// ce que voit une personne la première fois), puis « read table ». À 700 × 400, à la vraie souris. LAB_LANG=fr|en LAB_SCHEME=light|dark
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `acces-${lang}-${scheme}`;
const wording = lang === 'en' ? { access: /full access/i, hint: /Needs full access/i, empty: /full access is granted/i, appsButton: /Apps/, newButton: /New/ }
  : { access: /accès complet/i, hint: /Demande l’accès complet/i, empty: /accès complet sera accordé/i, appsButton: /Apps/, newButton: /Nouveau/ };

const lab = await startLab({ lang, colorScheme: scheme, fullAccess: false });
// Le panneau de droite de Grist, où se règle le niveau d'accès (il montre déjà la section de GFS, la dernière ajoutée) : ouvert avant d'ajuster la fenêtre.
await lab.page.mouse.click(1263, 24);
await lab.page.waitForTimeout(800);
await lab.fitPanel(undefined, 700, 400);
let frame = lab.frame;
const { page } = lab;
await page.waitForTimeout(1200);
const text = async locator => (await locator.innerText()).replace(/\s+/g, ' ').trim();

async function checkPanel(label, levelPattern) {
  say(`--- ${label} ---`);
  check(`${label} : GFS est prêt, au niveau attendu`, (await frame.evaluate(() => document.body.dataset.gfs)) === 'ready' && levelPattern.test(frame.url()), frame.url().replace(/^.*\?/, '?').slice(0, 90));
  const banner = await text(frame.locator('.banner'));
  say('bandeau :', banner);
  check(`${label} : le bandeau dit quoi faire (l'accès complet)`, wording.access.test(banner) && !/Access not granted/.test(banner), banner);
  const empty = await text(frame.locator('.empty').first()).catch(() => '');
  say('liste vide :', empty);
  check(`${label} : la liste ne prétend pas qu'il n'y a aucun fichier`, wording.empty.test(empty), empty);
  await lab.shotPanel(run, `1-${label.replace(/\W+/g, '-')}`, frame);
  // La première ouverture d'une section ouvre la fenêtre « Apps » une fois (dès que GFS lit le nom du document, ce que « none » ne permet pas) : la personne la ferme.
  if (await frame.locator('.mod').count()) { say('la fenêtre « Apps » s\'est ouverte toute seule (première ouverture) : Échap'); await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
  // « Nouveau » : le menu s'ouvre, chaque article est grisé avec la raison ; un clic la dit.
  await frame.locator('.btn.primary', { hasText: wording.newButton }).first().click();
  await page.waitForTimeout(250);
  const items = await frame.locator('[role="menuitem"]').evaluateAll(nodes => nodes.map(node => ({ grise: node.getAttribute('aria-disabled'), texte: node.textContent.replace(/\s+/g, ' ').trim().slice(0, 140) })));
  say('menu Nouveau :', items);
  check(`${label} : le menu « Nouveau » est grisé, avec la raison`, items.length > 0 && items.every(item => item.grise === 'true' && wording.hint.test(item.texte)), items);
  await frame.locator('[role="menuitem"]').first().click({ force: true });
  await page.waitForTimeout(300);
  const toast = await text(frame.locator('#toast'));
  check(`${label} : un clic sur le grisé dit la raison`, wording.access.test(toast), toast);
  await lab.shotPanel(run, `2-${label.replace(/\W+/g, '-')}-menu`, frame);
  // La fenêtre « Apps » : « Ouvrir » ne démarre pas une app qui demande plus que le niveau accordé.
  await frame.locator('.ex-title-row .tb', { hasText: wording.appsButton }).click();
  await frame.locator('.mod').waitFor();
  await frame.locator('[data-open="publipostage"]').click();
  await page.waitForTimeout(500);
  const state = await frame.evaluate(() => ({ cadresDApp: document.querySelectorAll('.app-frame').length, toast: document.getElementById('toast').textContent.trim() }));
  check(`${label} : « Ouvrir » ne démarre pas Publipostage+, et dit pourquoi`, state.cadresDApp === 0 && wording.access.test(state.toast), state);
  await lab.shotPanel(run, `3-${label.replace(/\W+/g, '-')}-apps`, frame);
  await page.keyboard.press('Escape');
}

async function chooseAccess(from, to) {
  await page.locator('.test-right-panel').getByText(from, { exact: true }).first().click();
  await page.waitForTimeout(300);
  await page.getByText(to, { exact: true }).last().click();
}

await checkPanel('sans accès (none)', /access=none/);
await chooseAccess('No document access', 'Read selected table');
frame = await lab.gfsFrame(/access=read/);
await frame.waitForFunction(() => Boolean(document.body) && document.body.dataset.gfs === 'ready', null, { timeout: 30000 });
await page.waitForTimeout(600);
await checkPanel('lecture de la table (read table)', /access=read/);
await chooseAccess('Read selected table', 'Full document access');
frame = await lab.gfsFrame(/access=full/);
await frame.waitForFunction(() => Boolean(document.body) && document.body.dataset.gfs === 'ready', null, { timeout: 30000 });
await page.waitForTimeout(800);
const full = await frame.evaluate(() => ({ banners: document.querySelectorAll('.banner').length, apps: document.querySelectorAll('[data-open]').length }));
check('accès complet accordé : plus de bandeau', full.banners === 0, full);
await lab.shotPanel(run, '4-acces-complet', frame);
await lab.browser.close();
