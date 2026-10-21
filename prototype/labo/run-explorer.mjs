// Tranche 2 : l'explorateur dans un vrai Grist (grist-static), à 700 × 400, à la vraie souris et au vrai clavier (Playwright : événements du
// pointeur et du clavier du navigateur, jamais dispatchEvent). LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const panelWidth = Number(process.env.LAB_W || 700);
const run = `explorateur-${lang}-${scheme}${panelWidth === 700 ? '' : `-${panelWidth}`}`;
const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const warnings = [];
page.on('console', m => { if (m.type() === 'warning' && m.text().startsWith('GFS')) warnings.push(m.text()); });
await lab.fitPanel(undefined, panelWidth, 400);
say('semis :', await seedFiles(lab.frame));
await lab.frame.evaluate(() => location.reload());
await page.waitForTimeout(1000);
const frame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(frame);
await page.waitForTimeout(800);
const shot = name => lab.shotPanel(run, name, frame);
const row = text => frame.locator('.ls-row', { hasText: text }).first();
// Revenir à « Moi » : le fil d'Ariane (toujours là), sinon le volet des dossiers.
const goMe = async () => {
  const link = frame.locator('.crumbs [data-path=""]');
  if (await link.count()) await link.click();
  else if (await frame.locator('.tr-row', { hasText: /^\s*(Moi|Me)\s*$/ }).isVisible()) await frame.locator('.tr-row', { hasText: /^\s*(Moi|Me)\s*$/ }).click();
};
const info = async () => (await frame.locator('.ex-info').innerText()).replace(/\s+/g, ' ');
say('panneau :', await (await frame.frameElement()).boundingBox());
say('apparence posée par Grist :', await frame.evaluate(() => document.documentElement.getAttribute('data-grist-appearance')));
say('langue de GFS :', await frame.evaluate(() => document.documentElement.lang + ' / ' + navigator.language));
say('stats de lecture :', await frame.evaluate(() => document.body.dataset.explorerStats));
await shot('1-liste');

await row('Contrat de prestation').click();
say('info après clic :', await info());
await shot('2-selection');

await row('Formation').dblclick();
await page.waitForTimeout(300);
say('fil d\'Ariane :', (await frame.locator('.crumbs').innerText()).replace(/\s+/g, ' '));
say('lignes du dossier :', await frame.locator('.ls-row').allInnerTexts().then(a => a.map(t => t.replace(/\s+/g, ' ').slice(0, 60))));
await shot('3-dossier-formation');

await frame.locator('.ex-nav-row button[aria-haspopup="menu"]').first().click();
await shot('4-menu-types');
await frame.locator('.menu-item', { hasText: /Grille|Grid/ }).click();
await page.waitForTimeout(200);
say('filtre grille :', await frame.locator('.ls-row').allInnerTexts().then(a => a.map(t => t.replace(/\s+/g, ' ').slice(0, 50))));
await shot('5-filtre-grille');
await frame.locator('.ex-nav-row button[aria-haspopup="menu"]').first().click();
await frame.locator('.menu-item').first().click();

await frame.locator('.inp-search input').click();
await page.keyboard.type(lang === 'fr' ? 'EMARGEMENT feuille' : 'emargement feuille', { delay: 30 });
await page.waitForTimeout(300);
say('recherche :', await frame.locator('.ls-row').allInnerTexts().then(a => a.map(t => t.replace(/\s+/g, ' ').slice(0, 60))));
await shot('6-recherche');
await page.keyboard.press('Escape');
say('Échap vide la recherche :', JSON.stringify(await frame.locator('.inp-search input').inputValue()));

await frame.locator('.tr-row', { hasText: /Récents|Recent/ }).click();
await shot('7-recents');
await frame.locator('.tr-row', { hasText: /Favoris|Favorites/ }).click();
say('favoris :', await frame.locator('.ls-row').allInnerTexts().then(a => a.map(t => t.replace(/\s+/g, ' ').slice(0, 50))));
await shot('8-favoris');
await goMe();
await frame.locator('button[aria-label]', { has: frame.locator('use[href="#i-tiles"]') }).click();
await shot('9-vignettes');
await frame.locator('button[aria-label]', { has: frame.locator('use[href="#i-list"]') }).click();

// Le clavier : flèches, Entrée sur un dossier, tri par la date.
await goMe();
await row('Contrat de prestation').click();
await page.keyboard.press('ArrowDown');
say('ArrowDown :', await info());
await page.keyboard.press('ArrowUp');
await page.keyboard.press('ArrowUp');
await page.keyboard.press('ArrowUp');
say('flèches vers le haut jusqu\'au premier :', await info());
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
say('Entrée sur un dossier :', (await frame.locator('.crumbs').innerText()).replace(/\s+/g, ' '));
await frame.locator('.crumbs [data-path=""]').click();
// En vue étroite la colonne « Modifié » est repliée : pas de tri par date.
if (await frame.locator('.hd[data-sort="mod"]').isVisible()) {
  await frame.locator('.hd[data-sort="mod"]').click();
  say('tri par date (décroissant) :', await frame.locator('.ls-row:not(.folder) .t').allInnerTexts());
  await shot('9b-tri-date');
  await frame.locator('.hd[data-sort="name"]').click();
}

await row('Contrat de prestation').hover();
await row('Contrat de prestation').locator('.rb.mn').click();
await shot('10-menu-ligne');
// Un article grisé reste cliquable (il explique) : le geste est forcé, mais c'est toujours la vraie souris. Épingler, renommer et déplacer : run-ranger.mjs.
await frame.locator('.menu-item', { hasText: /Dupliquer|Duplicate/ }).click({ force: true });
await page.waitForTimeout(200);
say('« Dupliquer », grisé :', await frame.locator('#toast').innerText());
await shot('11-notice');

await frame.locator('.btn.primary').click();
await shot('12-menu-nouveau');
await page.keyboard.press('Escape');

await row('Support de session').dblclick();
await page.waitForTimeout(300);
say('fichier grisé, phrase :', await frame.locator('#toast').innerText());
await shot('13-grise');

await row('Contrat de prestation').dblclick();
const app = await lab.appFrame();
await page.waitForTimeout(6000);
say('app ouverte :', app && app.url().replace(/\?.*/, ''));
say('explorateur caché :', await frame.locator('.ex').isHidden());
say('phrase de GFS (aucune : Publipostage+ ouvre le fichier lui-même) :', (await frame.locator('#toast').isVisible()) ? await frame.locator('#toast').innerText() : '(aucune)');
await shot('14-app-ouverte');

await frame.locator('#floater-files').click();
await page.waitForTimeout(500);
say('explorateur revenu :', await frame.locator('.ex').isVisible());
await shot('15-retour-explorateur');
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
say('Échap ramène à l\'app :', await frame.locator('.ex').isHidden());
say('avertissements GFS :', warnings);
await lab.browser.close();
