// « Nouveau > Depuis un modèle » avec la vraie Form+, celle que GFS référence (consigne 033 de Form+ : cinq modèles de formulaire, l'ouverture `modele`), dans un vrai Grist, à 700 × 400, à la vraie souris.
// Le manifeste de Form+ déclare `modeles` et `ouverture.modele` : sa pastille dit « 5 », ses cartes sont libres une fois l'app installée. À mesurer : « Créer » sur un modèle quand l'app n'est pas ouverte (elle
// démarre sur CE modèle : le formulaire du modèle s'affiche dans le concepteur, sans rien écrire dans le document) ; l'app déjà ouverte reçoit un autre modèle dans le même cadre, sans rechargement ni phrase de GFS ;
// une app retirée garde ses cartes, grisées. LAB_LANG=fr|en.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';
import { installApp } from './lab-gestes.mjs';

const lang = process.env.LAB_LANG || 'fr';
const WORDS = lang === 'fr'
  ? { menu: 'Depuis un modèle…', first: 'Inscription à un événement', second: 'Enquête de satisfaction' }
  : { menu: 'From a template…', first: 'Event registration', second: 'Satisfaction survey' };
const FORM_URL = /(apps\/form|FormPlus)\//;
const LAB_ONLY = /Content Security Policy|Refused to connect/;

const lab = await startLab({ lang });
const { page } = lab;
const warnings = [];
const errors = [];
page.on('console', message => {
  if (message.type() === 'warning' && message.text().startsWith('GFS')) warnings.push(message.text());
  if (message.type() === 'error' && FORM_URL.test(message.location().url || '') && !LAB_ONLY.test(message.text())) errors.push(message.text());
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
const rowsOf = () => frame.evaluate(async () => {
  if (!(await grist.docApi.listTables()).map(String).includes('FormPlus_Formulaires')) return 'absente';
  const data = await grist.docApi.fetchTable('FormPlus_Formulaires');
  return JSON.stringify([data.id, data.Nom, data.Definition]);
});
const shown = app => app.evaluate(() => {
  const on = id => { const el = document.getElementById(id); return Boolean(el) && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none'; };
  const title = document.getElementById('opt-title');
  const panel = document.getElementById('start-panel-model');
  return { loading: on('loading'), choices: on('config') && on('step1') && on('start-choices'), editor: on('editor'), title: title ? title.value : '',
    model: on('start-panel-model'), modelText: panel ? panel.innerText.replace(/\s+/g, ' ').slice(0, 900) : '', texte: document.body.innerText.replace(/\s+/g, ' ').slice(0, 120) };
});
const settled = async app => {
  for (let i = 0; i < 75; i++) {
    const seen = await shown(app).catch(() => null);
    if (seen && !seen.loading && (seen.editor || seen.choices || seen.model)) { await page.waitForTimeout(1500); return shown(app); }
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

// Installer Form+ par la fenêtre, comme une personne.
await restart();
await lab.openModules(frame);
await installApp(frame, 'form');
await lab.settle(frame);
await page.keyboard.press('Escape');
await frame.locator('.mod').waitFor({ state: 'hidden' });
await restart();
const before = await rowsOf();

// 1. La galerie : la pastille de Form+ dit 5, ses cartes sont libres (l'app est installée et sait ouvrir un modèle). L'explorateur est déjà là : aucune app n'est ouverte.
await frame.locator('.ex').waitFor({ state: 'visible' });
await openGallery();
const chip = gallery.locator('.tp-chip', { hasText: 'Form+' });
check('la pastille de Form+ dit ses cinq modèles et n\'est pas grisée', (await chip.getAttribute('aria-disabled')) === null && (await chip.innerText()).includes('5'), await chip.innerText());
await chip.click();
check('Form+ ne montre que ses cinq cartes, libres', (await gallery.locator('.tp-card').count()) === 5 && (await gallery.locator('.tp-card[aria-disabled="true"]').count()) === 0, await gallery.locator('.tp-card').count());
await lab.shotPanel(`modeles-form-${lang}`, '1-galerie', frame);

// 2. « Créer » : l'app n'est pas ouverte, elle démarre sur CE modèle, sans rien écrire.
await card(WORDS.first).click();
await gallery.locator('[data-act="create"]').click();
const app = await lab.appFrame(FORM_URL);
let seen = await settled(app);
say('Form+ au démarrage sur le modèle :', seen, 'phrase de GFS :', await toast());
check('Form+ démarre sur le modèle choisi : son panneau « Modèle de départ » porte le nom du modèle, pas l\'écran de départ', seen && seen.model && !seen.choices && seen.modelText.includes(WORDS.first), seen);
check('GFS ne dit rien, l\'explorateur et la galerie sont fermés', (await toast()) === '' && (await frame.locator('.ex').isHidden()) && (await gallery.isHidden()), await toast());
check('rien n\'est écrit dans le document par cette ouverture (le modèle n\'est pas enregistré)', (await rowsOf()) === before, await rowsOf());
await lab.shotPanel(`modeles-form-${lang}`, '2-modele-ouvert', frame);

// 3. L'app est ouverte : un autre modèle arrive dans le même cadre, sans rechargement.
await app.evaluate(() => { window.__avant = true; });
await showFiles();
await openGallery();
await gallery.locator('.tp-chip', { hasText: 'Form+' }).click();
await card(WORDS.second).click();
await gallery.locator('[data-act="create"]').click();
await page.waitForTimeout(2500);
seen = await shown(app).catch(() => null);
const same = await app.evaluate(() => window.__avant === true).catch(() => false);
say('Form+ déjà ouverte sur un autre modèle :', seen, 'même cadre :', same);
check('Form+ déjà ouverte prend l\'autre modèle dans le même cadre (non rechargé) : le panneau porte son nom', same && seen && seen.model && seen.modelText.includes(WORDS.second) && !seen.modelText.includes(WORDS.first), { seen, same });
check('GFS ne dit rien, rien n\'est écrit dans le document', (await toast()) === '' && (await rowsOf()) === before, await toast());

// 4. « Créer ce formulaire » : c'est ici que Form+ écrit (avec le nom de table que la personne garde), par le courtier de GFS.
const button = app.locator('#start-panel-model button.primary, #start-panel-model button').last();
say('bouton du panneau :', await button.innerText());
await button.click();
// Form+ demande l'accord de la personne avant de créer sa table de formulaires (la fenêtre du kit) : un clic sur « Créer la table ».
const consent = app.getByRole('button', { name: lang === 'fr' ? 'Créer la table' : /Create the table/ });
await consent.waitFor({ state: 'visible', timeout: 8000 });
const written = await frame.evaluate(async () => (await grist.docApi.listTables()).map(String));
check('avant l\'accord de la personne, aucune table n\'est créée', !written.includes('FormPlus_Formulaires'), written);
await consent.click();
await page.waitForTimeout(8000);
seen = await shown(app).catch(() => null);
const tables = await frame.evaluate(async () => (await grist.docApi.listTables()).map(String));
say('après « Créer ce formulaire » :', seen, 'tables :', tables, 'fenêtres :', await app.locator('.qf-dialog, .kit-dialog, dialog, [role=dialog]').allInnerTexts().catch(() => []), 'GFS :', await toast());
check('« Créer ce formulaire » : le formulaire est créé (aucun message d\'échec), la table des formulaires et celle des réponses existent', seen && !/n’a pas pu être créé|could not be created/.test(seen.modelText + seen.texte) && tables.includes('FormPlus_Formulaires') && tables.length >= 4, { seen, tables });
await lab.shotPanel(`modeles-form-${lang}`, '3-cree', frame);
check('aucun avertissement de GFS, aucune erreur de script dans l\'app', warnings.length === 0 && errors.length === 0, { warnings, errors });
await lab.browser.close();
