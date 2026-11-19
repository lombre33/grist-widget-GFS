// Publipostage+ (vraie app, sommet de `main` servi par GFS ou seule) : les colonnes d'une table que la personne ajoute ou retype DANS GRIST après l'ouverture de l'app, face à la fenêtre
// « Condition de la case » (faits vérifiés 143). Une colonne vide passée en case à cocher et une colonne neuve en case à cocher doivent se lister avec « (case à cocher) », et leur champ
// Valeur doit proposer « Oui / Non » ; les `CONSTAT` disent ce que la 093 demande à l'app (un défaut de l'app, pas de GFS : le même sans GFS, `LAB_DIRECT=1`). Après que la liste « # » a relu
// le schéma (ce que l'app fait déjà à chaque ouverture de cette liste), les `check` doivent tous tenir : c'est la preuve de la cause.
// LAB_LANG=fr|en n'est pas lu : les mots cherchés sont français. À 700 × 400 sous GFS, à la vraie souris et au vrai clavier ; clair seulement.
import { startLab } from './lab-setup.mjs';
import { installApp } from './lab-gestes.mjs';
import { say, check, constat } from './lab-common.mjs';

const DIRECT = process.env.LAB_DIRECT === '1';
const APP_URL = 'http://127.0.0.1:8911/prototype/apps/publipostage/index.html';
const lab = await startLab(DIRECT ? { lang: 'fr', widget: APP_URL } : { lang: 'fr' });
const { page } = lab;
if (!DIRECT) await lab.fitPanel(undefined, 700, 400);

// Les appels à Grist se font depuis le cadre qui a l'accès complet (GFS, ou l'app seule).
const docApi = (fn, arg) => page.frames().find(f => f.url().startsWith(DIRECT ? APP_URL : 'http://127.0.0.1:8911/prototype/index.html') && /access=full/.test(f.url())).evaluate(fn, arg);

await docApi(async () => {
  await grist.docApi.applyUserActions([
    ['AddColumn', 'Clients', 'Urgent', { type: 'Bool', label: 'Urgent', isFormula: false }],
    ['AddColumn', 'Clients', 'Ancienne_vide', { type: 'Any', label: 'Ancienne vide', isFormula: true, formula: '' }],
  ]);
});

let app;
if (DIRECT) {
  for (let i = 0; i < 60 && !app; i++) { app = page.frames().find(f => f.url().startsWith(APP_URL)); if (!app) await page.waitForTimeout(500); }
} else {
  await lab.openModules(lab.frame);
  await installApp(lab.frame, 'publipostage');
  await lab.settle(lab.frame);
  await lab.frame.locator('[data-open="publipostage"]').click();
  app = await lab.appFrame(/publipostage/);
}
// La première ouverture sur un document sans ses tables : l'app pose sa question, la personne répond à la souris.
await app.getByRole('button', { name: 'Créer les tables' }).click({ timeout: 30000 }).catch(() => say('(pas de question de création)'));
await app.locator('.ProseMirror').first().waitFor({ timeout: 60000 });
await page.waitForTimeout(3000);

const known = () => app.evaluate(() => { const t = GristAPI.getCurrentTableId(); return GristAPI.getColumns(t).map(c => c + ':' + GristAPI.getColumnType(t, c)); });
say('l\'app voit au départ :', await known());

// La personne pose une case conditionnelle par la liste « # » (onglet Puces) : cette liste relit le schéma, ce qui est fait AVANT les changements dans Grist.
const insertCase = async () => {
  await page.keyboard.type('#', { delay: 50 });
  await page.waitForTimeout(600);
  await app.getByText('Puces', { exact: true }).first().click();
  await page.keyboard.type('case', { delay: 60 });
  await page.waitForTimeout(400);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
};
await app.locator('.ProseMirror').first().click();
await insertCase();

// Dans Grist, pendant que l'app reste ouverte : une colonne vide passée en case à cocher (interrupteur) et une colonne neuve.
await docApi(async () => {
  await grist.docApi.applyUserActions([
    ['ModifyColumn', 'Clients', 'Ancienne_vide', { type: 'Bool', widgetOptions: JSON.stringify({ widget: 'Switch' }) }],
    ['AddColumn', 'Clients', 'Signature_tardive', { type: 'Bool', label: 'Signature tardive', isFormula: false, widgetOptions: JSON.stringify({ widget: 'Switch' }) }],
  ]);
});
await page.waitForTimeout(3000);

const columnList = () => app.evaluate(() => Array.from(document.querySelectorAll('[class*=option], li')).filter(e => e.getBoundingClientRect().width > 0)
  .map(e => (e.textContent || '').trim().replace(/\s+/g, ' ')).filter(Boolean));
const openWindow = async () => {
  await app.locator('[aria-label="Condition de la case : cochée si…"]').first().click();
  await app.getByText('Condition de la case', { exact: true }).first().waitFor();
  await page.waitForTimeout(500);
};
const openList = async () => {
  const label = await app.getByText('Si', { exact: true }).first().boundingBox();
  await page.mouse.click(label.x + 100, label.y + label.height / 2);
  await page.waitForTimeout(600);
  return columnList();
};
const pick = async name => {
  await app.locator('[class*=option]', { hasText: name }).filter({ visible: true }).first().click();
  await page.waitForTimeout(500);
};
const offersYesNo = () => app.evaluate(() => Array.from(document.querySelectorAll('.macro-rule-row select option')).some(o => o.textContent === 'Oui')
  && Array.from(document.querySelectorAll('.macro-rule-row select option')).some(o => o.textContent === 'Non'));
const cancel = async () => { await app.locator('#var-condition-modal').getByRole('button', { name: 'Annuler' }).click(); await page.waitForTimeout(400); };

say('=== 1. la fenêtre, ouverte juste après les changements faits dans Grist ===');
await openWindow();
let list = await openList();
say('liste :', list);
check('« Urgent » (créée avant) est listée avec « (case à cocher) »', list.includes('Urgent(case à cocher)'), list);
constat('« Signature_tardive » (ajoutée dans Grist après l\'ouverture) est listée', list.some(t => t.startsWith('Signature_tardive')), list);
constat('« Ancienne_vide » (passée en case à cocher après l\'ouverture) porte « (case à cocher) »', list.includes('Ancienne_vide(case à cocher)'), list);
await pick('Ancienne_vide');
constat('le champ Valeur d\'« Ancienne_vide » propose Oui / Non', await offersYesNo(), 'champ de saisie libre : la personne tape « true » à la main');
await cancel();

say('=== 2. la liste « # » relit le schéma (ce que l\'app fait déjà à chaque ouverture de cette liste) ===');
await app.locator('span.conditional-checkbox').first().click();
await page.keyboard.press('ArrowRight');
await page.keyboard.type(' #', { delay: 50 });
await page.waitForTimeout(1500);
await page.keyboard.press('Escape');
await page.keyboard.press('Backspace');
await page.keyboard.press('Backspace');
await app.locator('span.conditional-checkbox').first().click();
await page.waitForTimeout(400);
await openWindow();
list = await openList();
say('liste :', list);
check('les trois colonnes sont listées avec « (case à cocher) »', ['Urgent', 'Ancienne_vide', 'Signature_tardive'].every(c => list.includes(`${c}(case à cocher)`)), list);
await pick('Signature_tardive');
check('le champ Valeur d\'une colonne case à cocher propose Oui / Non (rien à saisir à la main)', await offersYesNo());
await cancel();
await lab.browser.close();
