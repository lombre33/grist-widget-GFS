// « Nouveau > Depuis un modèle » avec la vraie Automation+, celle que GFS référence (consigne 020 d'Automation+ : cinq modèles d'automatisme, rangés avec un type que GFS lui donne parce qu'elle n'a pas de fichier ;
// choix du porteur du 18/11, « L'app demande »), dans un vrai Grist, à 700 × 400, à la vraie souris. Automation+ n'ouvre encore aucun modèle (consigne 021) : son manifeste ne dit pas `ouverture.modele`.
// À mesurer : sa pastille dit « 5 » et filtre ; ses cinq cartes sont grisées « pas encore » avec la raison au clic, « Créer » reste éteint, rien n'est écrit dans le document et l'app ne s'ouvre pas ; les
// vignettes que GFS copie se chargent. LAB_FORCE=1 : constat seulement (aucune vérification) de ce que fait la vraie app quand le manifeste dit `ouverture.modele` (son kit est en 0.13.0 : `GfsLink.opening()`
// écarte `modele`, qui n'arrive qu'au kit 0.24.0). LAB_LANG=fr|en.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';
import { installApp } from './lab-gestes.mjs';

const lang = process.env.LAB_LANG || 'fr';
const force = process.env.LAB_FORCE === '1';
const WORDS = lang === 'fr'
  ? { menu: 'Depuis un modèle…', first: 'Archiver une ligne quand son statut change', notYet: /ne sait pas encore ouvrir un modèle de départ/, kind: 'Automatisme' }
  : { menu: 'From a template…', first: 'Archive a row when its status changes', notYet: /cannot open a starter template/, kind: 'Automation' };
const APP_URL = /(apps\/automation|GRIST_automation)\//;
const LAB_ONLY = /Content Security Policy|Refused to connect/;
const FORCED = { chemin: '/prototype/manifestes/automation.json', de: '"ouverture": { "fichier": false, "nouveau": false },', vers: '"ouverture": { "fichier": false, "nouveau": false, "modele": true },' };

const lab = await startLab({ lang, patches: force ? [FORCED] : [] });
const { page } = lab;
const warnings = [];
const errors = [];
page.on('console', message => {
  if (message.type() === 'warning' && message.text().startsWith('GFS')) warnings.push(message.text());
  if (message.type() === 'error' && APP_URL.test(message.location().url || '') && !LAB_ONLY.test(message.text())) errors.push(message.text());
});
page.on('pageerror', error => errors.push(error.message));
await lab.fitPanel(undefined, 700, 400);

let frame = lab.frame;
const restart = async () => {
  await frame.evaluate(() => location.reload());
  await page.waitForTimeout(1000);
  frame = await lab.gfsFrame(/access=full/);
  await lab.gfsReady(frame);
  await page.waitForTimeout(800);
};
const tablesOf = () => frame.evaluate(async () => (await grist.docApi.listTables()).map(String).join(','));
const gallery = () => frame.locator('.mod.tp');
const foot = async () => (await gallery().locator('.tp-note, .mod-foot .tp-note').first().innerText().catch(() => '')).replace(/\s+/g, ' ');
const showFiles = async () => { await frame.locator('#floater-files').click(); await frame.locator('.ex').waitFor({ state: 'visible' }); };
const openGallery = async () => {
  await frame.locator('.btn.primary').click();
  await frame.locator('.menu-item', { hasText: WORDS.menu }).click();
  await gallery().waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
};

// Installer Automation+ par la fenêtre, comme une personne.
await restart();
await lab.openModules(frame);
await installApp(frame, 'automation');
await lab.settle(frame);
await page.keyboard.press('Escape');
await frame.locator('.mod').waitFor({ state: 'hidden' });
await restart();
const before = await tablesOf();

await frame.locator('.ex').waitFor({ state: 'visible' });
await openGallery();
const chip = gallery().locator('.tp-chip', { hasText: 'Automation+' });
await chip.click();
if (!force) {
  check('la pastille d\'Automation+ dit ses cinq modèles et n\'est pas grisée', (await chip.getAttribute('aria-disabled')) === null && (await chip.innerText()).includes('5'), await chip.innerText());
  const cards = gallery().locator('.tp-card');
  check('Automation+ ne montre que ses cinq cartes, toutes grisées « pas encore »', (await cards.count()) === 5 && (await gallery().locator('.tp-card[aria-disabled="true"]').count()) === 5, await cards.count());
  check('chaque carte porte le type « ' + WORDS.kind + ' »', (await cards.locator('.tp-type').allInnerTexts()).every(text => text.includes(WORDS.kind)), await cards.locator('.tp-type').allInnerTexts());
  const loaded = await cards.locator('img').evaluateAll(images => images.map(image => image.complete && image.naturalWidth > 0));
  check('les cinq vignettes que GFS copie se chargent', loaded.length === 5 && loaded.every(Boolean), loaded);
  await lab.shotPanel(`modeles-automation-${lang}`, '1-galerie', frame);
  await cards.filter({ hasText: WORDS.first }).first().click({ force: true });
  check('un modèle d\'Automation+ grisé dit pourquoi, sans « Voir dans Apps »', WORDS.notYet.test(await foot()) && (await gallery().locator('[data-act="see"]').isHidden()), await foot());
  await gallery().locator('[data-act="create"]').click({ force: true });
  await page.waitForTimeout(500);
  const opened = page.frames().some(candidate => APP_URL.test(candidate.url()));
  check('« Créer » éteint n\'ouvre rien : la galerie reste, l\'app n\'est pas ouverte, le document n\'a pas changé', (await gallery().isVisible()) && !opened && (await tablesOf()) === before,
    { galerie: await gallery().isVisible(), ouverte: opened, tables: await tablesOf(), avant: before });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check('Échap ferme la galerie', await gallery().isHidden());
  check('aucun avertissement de GFS, aucune erreur de script', warnings.length === 0 && errors.length === 0, { warnings, errors });
} else {
  await gallery().locator('.tp-card', { hasText: WORDS.first }).first().click();
  await gallery().locator('[data-act="create"]').click();
  await page.waitForTimeout(6000);
  const app = await lab.appFrame(APP_URL).catch(() => null);
  const text = app ? await app.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 300)).catch(() => '') : '';
  say('constat (manifeste forcé) : app ouverte', Boolean(app), '| texte', text, '| tables', await tablesOf(), '| GFS', await frame.locator('#toast').innerText().catch(() => ''), '| avertissements', warnings, '| erreurs', errors);
  await lab.shotPanel(`modeles-automation-${lang}`, '9-constat-force', frame);
}
await lab.browser.close();
