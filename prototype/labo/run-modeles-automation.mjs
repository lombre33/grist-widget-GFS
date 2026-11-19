// « Nouveau > Depuis un modèle » avec la vraie Automation+, celle que GFS référence (03ca9ba : l'app 0.15.4 ouvre le modèle que GFS demande, consignes 020 et 021 d'Automation+ ; choix du porteur du 18/11,
// « L'app demande »), dans un vrai Grist, à 700 × 400, à la vraie souris. Le manifeste de GFS déclare `ouverture.modele` : la pastille d'Automation+ dit « 5 », ses cartes sont libres une fois l'app installée.
// À mesurer : « Créer » quand l'app n'est pas ouverte (elle démarre sur CE modèle : son graphe s'affiche, une phrase de l'app dit que rien n'est enregistré, rien n'est écrit dans le document) ; l'app déjà ouverte
// prend un autre modèle dans le même cadre, sans rechargement ni phrase de GFS ; quand la table de la vue porte déjà un workflow, c'est l'APP qui demande avant de le remplacer (GFS ne repère rien, ne grise rien) :
// « Garder le workflow » ne change rien dans le document ni dans l'éditeur, « Remplacer » ouvre le modèle ; une app retirée garde ses cartes, grisées. LAB_LANG=fr|en.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';
import { installApp } from './lab-gestes.mjs';

const lang = process.env.LAB_LANG || 'fr';
const WORDS = lang === 'fr'
  ? { menu: 'Depuis un modèle…', first: 'Archiver une ligne quand son statut change', second: 'Remplir une colonne à la création d\'une ligne', replace: 'Remplacer', keep: 'Garder le workflow', kind: 'Automatisme', decline: 'Ne pas créer' }
  : { menu: 'From a template…', first: 'Archive a row when its status changes', second: 'Fill in a column when a row is created', replace: 'Replace', keep: 'Keep the workflow', kind: 'Automation', decline: 'Do not create' };
const APP_URL = /(apps\/automation|GRIST_automation)\//;
const LAB_ONLY = /Content Security Policy|Refused to connect/;

const lab = await startLab({ lang });
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
const tablesOf = () => frame.evaluate(async () => (await grist.docApi.listTables()).map(String));
const workflowRows = () => frame.evaluate(async () => {
  if (!(await grist.docApi.listTables()).map(String).includes('Automation')) return 'absente';
  const data = await grist.docApi.fetchTable('Automation');
  return JSON.stringify([data.id, data.Type, data.Table, data.Config]);
});
const shown = app => app.evaluate(() => {
  const visible = element => Boolean(element) && getComputedStyle(element).display !== 'none' && !element.hidden;
  const notice = document.getElementById('model-notice');
  return { nodes: document.querySelectorAll('.node').length, kinds: [...document.querySelectorAll('.node')].map(node => node.className.replace(/\s+/g, ' ').trim().slice(0, 40)),
    notice: visible(notice) ? notice.innerText.replace(/\s+/g, ' ') : '', dialog: [...document.querySelectorAll('.kit-dialog, dialog, [role=dialog], .modal-box')].filter(visible).map(each => each.innerText.replace(/\s+/g, ' ').slice(0, 260)) };
});
const settled = async app => {
  for (let i = 0; i < 75; i++) {
    const seen = await shown(app).catch(() => null);
    if (seen && (seen.notice || seen.dialog.length)) { await page.waitForTimeout(800); return shown(app); }
    await page.waitForTimeout(200);
  }
  return shown(app).catch(() => null);
};
const gallery = frame.locator('.mod.tp');
const toast = async () => ((await frame.locator('#toast').isVisible()) ? (await frame.locator('#toast').innerText()).replace(/\s+/g, ' ') : '');
const showFiles = async () => { await frame.locator('#floater-files').click(); await frame.locator('.ex').waitFor({ state: 'visible' }); };
const openGallery = async () => {
  await frame.locator('.btn.primary').click();
  await frame.locator('.menu-item', { hasText: WORDS.menu }).click();
  await gallery.waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
};
const card = name => gallery.locator('.tp-card', { hasText: name }).first();
const create = async name => { await gallery.locator('.tp-chip', { hasText: 'Automation+' }).click(); await card(name).click(); await gallery.locator('[data-act="create"]').click(); };

// Installer Automation+ par la fenêtre, comme une personne.
await restart();
await lab.openModules(frame);
await installApp(frame, 'automation');
await lab.settle(frame);
await page.keyboard.press('Escape');
await frame.locator('.mod').waitFor({ state: 'hidden' });
await restart();
const before = await tablesOf();

// 1. La galerie : la pastille dit 5, les cinq cartes sont libres (l'app est installée et sait ouvrir un modèle).
await frame.locator('.ex').waitFor({ state: 'visible' });
await openGallery();
const chip = gallery.locator('.tp-chip', { hasText: 'Automation+' });
check('la pastille d\'Automation+ dit ses cinq modèles et n\'est pas grisée', (await chip.getAttribute('aria-disabled')) === null && (await chip.innerText()).includes('5'), await chip.innerText());
await chip.click();
check('Automation+ ne montre que ses cinq cartes, libres, sous le type « ' + WORDS.kind + ' »',
  (await gallery.locator('.tp-card').count()) === 5 && (await gallery.locator('.tp-card[aria-disabled="true"]').count()) === 0 && (await gallery.locator('.tp-card', { hasText: WORDS.kind }).count()) === 5,
  await gallery.locator('.tp-card').count());
await lab.shotPanel(`modeles-automation-${lang}`, '1-galerie', frame);

// 2. « Créer » : l'app n'est pas ouverte, elle démarre sur CE modèle, sans rien écrire.
await card(WORDS.first).click();
check('« Créer » est allumé pour un modèle d\'Automation+', (await gallery.locator('[data-act="create"]').getAttribute('disabled')) === null);
await gallery.locator('[data-act="create"]').click();
let app = await lab.appFrame(APP_URL);
let seen = await settled(app);
say('Automation+ au démarrage sur le modèle :', seen, 'phrase de GFS :', await toast());
if (seen && seen.dialog.length && !seen.notice) {
  say('fenêtre de l\'app au démarrage (sa propre question sur sa table, pas celle de GFS) : on répond « ' + WORDS.decline + ' » :', seen.dialog);
  await app.getByRole('button', { name: WORDS.decline }).click();
  await page.waitForTimeout(1200);
  seen = await settled(app);
}
check('Automation+ démarre sur le modèle choisi : trois nœuds (événement, condition, action) et la phrase « rien n\'est enregistré » avec le nom du modèle',
  seen && seen.nodes === 3 && seen.notice.includes(WORDS.first), seen);
check('GFS ne dit rien, l\'explorateur et la galerie sont fermés', (await toast()) === '' && (await frame.locator('.ex').isHidden()) && (await gallery.isHidden()), await toast());
check('rien n\'est écrit dans le document par cette ouverture (aucune table de plus, le modèle n\'est pas enregistré)', JSON.stringify(await tablesOf()) === JSON.stringify(before), await tablesOf());
await lab.shotPanel(`modeles-automation-${lang}`, '2-modele-ouvert', frame);

// 3. L'app est ouverte : un autre modèle arrive dans le même cadre, sans rechargement.
await app.evaluate(() => { window.__avant = true; });
await showFiles();
await openGallery();
await create(WORDS.second);
await page.waitForTimeout(2500);
seen = await shown(app).catch(() => null);
const same = await app.evaluate(() => window.__avant === true).catch(() => false);
say('Automation+ déjà ouverte sur un autre modèle :', seen, 'même cadre :', same);
check('Automation+ déjà ouverte prend l\'autre modèle dans le même cadre (non rechargé) : deux nœuds, la phrase porte son nom', same && seen && seen.nodes === 2 && seen.notice.includes(WORDS.second) && !seen.notice.includes(WORDS.first), { seen, same });
check('GFS ne dit rien, rien n\'est écrit dans le document', (await toast()) === '' && JSON.stringify(await tablesOf()) === JSON.stringify(before), await toast());

// 4. La table de la vue porte déjà un workflow : c'est l'app qui demande avant de le remplacer. Le workflow est posé comme l'app le range (table `Automation`, une ligne `Workflow`).
const viewTable = (await tablesOf()).find(name => !/^(GFS_|Automation)/.test(name));
const seed = await frame.evaluate(async table => {
  const types = { Date: 'DateTime:UTC', Actif: 'Bool', Version: 'Int', Ligne: 'Int' };
  const columns = ['Type', 'Table', 'Date', 'Actif', 'Version', 'Resume', 'Config', 'Evenement', 'Ligne', 'Resultat', 'Detail', 'Auteur'].map(id => ({ id, type: types[id] || 'Text' }));
  const graph = { version: 3, active: false, nodes: [{ id: 'trigger-1', type: 'trigger', x: 0, y: 40, config: { action: 'update', column: '', targetColumn: '', targetValue: '' } },
    { id: 'action-1', type: 'action', x: 268, y: 40, config: { type: 'AddRecord', table: '', matchColumn: '', matchValue: '', column: '', value: '' } }], edges: [{ from: 'trigger-1', to: 'action-1' }] };
  try {
    await grist.docApi.applyUserActions([['AddTable', 'Automation', columns], ['AddRecord', 'Automation', null, { Type: 'Workflow', Table: table, Actif: false, Version: 3, Config: JSON.stringify(graph) }]]);
    return 'posé';
  } catch (error) { return String(error && error.message || error).slice(0, 160); }
}, viewTable);
say('workflow posé dans le document :', seed, 'table de la vue :', viewTable);
const withWork = await workflowRows();
await restart();
app = await lab.appFrame(APP_URL);
await page.waitForTimeout(2500);
say('Automation+ rouverte avec le workflow du document :', await shown(app).catch(() => null), await workflowRows());
await showFiles();
await openGallery();
await create(WORDS.first);
await page.waitForTimeout(2500);
seen = await shown(app).catch(() => null);
say('la question de l\'app :', seen);
check('une table qui porte déjà un workflow : l\'app demande avant de le remplacer (une fenêtre de l\'app, ni confirm() ni prompt()), GFS ne dit rien',
  seen && seen.dialog.some(text => text.includes(WORDS.replace) && text.includes(WORDS.keep)) && (await toast()) === '', { seen, toast: await toast() });
await lab.shotPanel(`modeles-automation-${lang}`, '3-question', frame);
await app.getByRole('button', { name: WORDS.keep }).click();
await page.waitForTimeout(1500);
seen = await shown(app).catch(() => null);
check('« ' + WORDS.keep + ' » : rien n\'est ouvert ni écrit (l\'éditeur garde le workflow du document, deux nœuds, sans phrase de modèle ; le document est le même)', seen && seen.nodes === 2 && seen.notice === '' && (await workflowRows()) === withWork, { seen, rows: await workflowRows() });
await showFiles();
await openGallery();
await create(WORDS.first);
await page.waitForTimeout(2000);
await app.getByRole('button', { name: WORDS.replace }).click();
await page.waitForTimeout(2000);
seen = await shown(app).catch(() => null);
check('« ' + WORDS.replace + ' » : le modèle s\'ouvre dans l\'éditeur, et le workflow du document est encore le même tant que la personne ne change rien', seen && seen.nodes === 3 && seen.notice.includes(WORDS.first) && (await workflowRows()) === withWork, { seen, rows: await workflowRows() });
await lab.shotPanel(`modeles-automation-${lang}`, '4-remplace', frame);
check('aucun avertissement de GFS, aucune erreur de script dans l\'app', warnings.length === 0 && errors.length === 0, { warnings, errors });
await lab.browser.close();
