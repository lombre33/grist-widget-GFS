// « Nouveau > Depuis un modèle » avec la vraie Publipostage+, celle que GFS référence (consigne 075 de Publipostage+ : 22 modèles, l'ouverture `modele`), dans un vrai Grist, à 700 × 400, à la vraie souris.
// À mesurer : la pastille de Publipostage+ dit 22 et ses cartes sont libres ; « Créer » sur un modèle quand l'app n'est pas ouverte : elle démarre sur CE modèle, non enregistré (rien n'est écrit dans la table des
// modèles) ; l'app déjà ouverte en prend un autre dans le même cadre. LAB_LANG=fr|en.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';
import { seedFiles } from './seed.mjs';

const lang = process.env.LAB_LANG || 'fr';
const WORDS = lang === 'fr'
  ? { menu: 'Depuis un modèle…', first: 'Facture, devis ou avoir', second: 'Courrier de relance', namePart: 'acture' }
  : { menu: 'From a template…', first: 'Invoice, quote or credit note', second: 'Payment reminder letter', namePart: 'nvoice' };
const lab = await startLab({ lang });
const { page } = lab;
const warnings = [];
page.on('console', message => { if (message.type() === 'warning' && message.text().startsWith('GFS')) warnings.push(message.text()); });
await lab.fitPanel(undefined, 700, 400);
await seedFiles(lab.frame);
// Le document d'essai a déjà une table « Clients » que les modèles de Publipostage+ voudraient créer (colonnes différentes : l'app refuse alors, et le dit) : on la renomme (la page du labo reste sur elle) pour mesurer la création.

let frame = lab.frame;
const restart = async () => {
  await frame.evaluate(() => location.reload());
  await page.waitForTimeout(1000);
  frame = await lab.gfsFrame(/access=full/);
  await lab.gfsReady(frame);
  await page.waitForTimeout(800);
};
await restart();
await frame.evaluate(() => grist.docApi.applyUserActions([['RenameTable', 'Clients', 'Contacts']]));
await restart();
const rowsOf = () => frame.evaluate(async () => { const data = await grist.docApi.fetchTable('Publipostage_Modeles'); return JSON.stringify([data.id, data.Nom]); });
const shown = app => app.evaluate(() => ({ name: (document.getElementById('template-name') || {}).value || '', text: (document.querySelector('.ProseMirror') || {}).textContent || '',
  status: (document.getElementById('status-msg') || {}).textContent || '', dialogs: [...document.querySelectorAll('dialog[open], [role=dialog], .gfs-dialog, .kit-dialog')].map(node => node.innerText.slice(0, 160)) }));
const waitStarted = async app => {
  await app.waitForFunction(() => { const e = document.getElementById('status-msg'); return Boolean(e && e.textContent); }, null, { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(1500);
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

await frame.locator('.ex').waitFor({ state: 'visible' });
const before = await rowsOf();
await openGallery();
const chip = gallery.locator('.tp-chip', { hasText: 'Publipostage+' });
check('la pastille de Publipostage+ dit ses 22 modèles et n\'est pas grisée', (await chip.getAttribute('aria-disabled')) === null && (await chip.innerText()).includes('22'), await chip.innerText());
await chip.click();
check('Publipostage+ montre ses 22 cartes ; seule la présentation commerciale, qui demande l\'extension du graphique (non cochée ici), est grisée', (await gallery.locator('.tp-card').count()) === 22 && (await gallery.locator('.tp-card[aria-disabled="true"]').count()) === 1, await gallery.locator('.tp-card[aria-disabled="true"]').count());
await lab.shotPanel(`modeles-pp-${lang}`, '1-galerie', frame);

await card(WORDS.first).click();
check('le pied d\'un modèle avec tables dit que l\'app demande l\'accord avant de créer des tables', /accord|consent/.test(await gallery.locator('.mod-note').innerText()), await gallery.locator('.mod-note').innerText());
await gallery.locator('[data-act="create"]').click();
const app = await lab.appFrame(/publipostage/);
await waitStarted(app);
const bodyText = () => app.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
const tablesOf = () => frame.evaluate(async () => (await grist.docApi.listTables()).map(String).join(','));
let text = await bodyText();
say('Publipostage+ au démarrage sur le modèle :', text.slice(0, 260), 'phrase de GFS :', await toast());
check('Publipostage+ démarre sur le modèle choisi et demande l\'accord avant de créer ses tables (la fenêtre porte le nom du modèle)', text.includes('« ' + WORDS.first + ' »'), text.slice(0, 200));
check('GFS ne dit rien, l\'explorateur et la galerie sont fermés', (await toast()) === '' && (await frame.locator('.ex').isHidden()) && (await gallery.isHidden()), await toast());
check('avant l\'accord de la personne, rien n\'est créé : ni table, ni modèle', (await rowsOf()) === before && !(await tablesOf()).includes('LignesFacture'), await tablesOf());
await lab.shotPanel(`modeles-pp-${lang}`, '2-accord', frame);

// « Créer » (la fenêtre de l'app) : les tables du modèle naissent, le modèle s'affiche.
await app.getByRole('button', { name: lang === 'fr' ? 'Créer' : 'Create', exact: true }).click();
await page.waitForTimeout(9000);
const created = await tablesOf();
const seen = await app.evaluate(() => ({ name: (document.getElementById('template-name') || {}).value || '', text: ((document.querySelector('.ProseMirror') || {}).textContent || '').slice(0, 80) }));
say('après l\'accord :', seen, 'tables :', created);
check('après l\'accord : les quatre tables du modèle existent (Entreprise, Clients, Factures, LignesFacture) et le modèle est dans l\'éditeur', ['Entreprise', 'Clients', 'Factures', 'LignesFacture'].every(name => created.includes(name)) && seen.name !== '' && seen.text.length > 5, { seen, created });
await lab.shotPanel(`modeles-pp-${lang}`, '3-cree', frame);

// L'app est ouverte : un autre modèle arrive dans le même cadre (non rechargé).
await app.evaluate(() => { window.__avant = true; });
await showFiles();
await openGallery();
await gallery.locator('.tp-chip', { hasText: 'Publipostage+' }).click();
await card(WORDS.second).click();
await gallery.locator('[data-act="create"]').click();
await page.waitForTimeout(4000);
const second = await app.evaluate(() => ({ name: (document.getElementById('template-name') || {}).value || '', text: ((document.querySelector('.ProseMirror') || {}).textContent || '').slice(0, 80),
  status: (document.getElementById('status-msg') || {}).textContent || '' }));
const same = await app.evaluate(() => window.__avant === true).catch(() => false);
say('Publipostage+ déjà ouverte sur un autre modèle :', second, 'même cadre :', same);
check('Publipostage+ déjà ouverte prend l\'autre modèle dans le même cadre (non rechargé) : un modèle non enregistré, au texte de l\'autre modèle',
  same && second.text !== '' && second.text !== seen.text && second.name !== seen.name && /non enregistré|not saved/i.test(second.status), { same, second, first: seen });
check('rien n\'est écrit dans la table des modèles par ces ouvertures', (await rowsOf()) === before, await rowsOf());
check('GFS ne dit rien', (await toast()) === '', await toast());
check('aucun avertissement de GFS', warnings.length === 0, warnings);
await lab.browser.close();
