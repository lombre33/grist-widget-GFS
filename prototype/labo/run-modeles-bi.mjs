// « Nouveau > Depuis un modèle » avec le vrai Grist-BI, celui que GFS référence (consigne 016 de Grist-BI : trois modèles de rapport, l'ouverture `modele`), dans un vrai Grist, à 700 × 400, à la vraie souris.
// Le manifeste de Grist-BI déclare `modeles` et `ouverture.modele` ; un modèle y est un rapport de départ posé sur une table que la personne a déjà (aucun `tables`). À mesurer : la pastille dit 3 ;
// « Créer » sur un modèle quand l'app n'est pas ouverte (elle démarre, un rapport non enregistré s'affiche, avec des tuiles) ; rien n'est écrit dans le document ; l'app déjà ouverte prend un autre
// modèle dans le même cadre. LAB_LANG=fr|en.
import { startLab } from './lab-setup.mjs';
import { say, check, constat } from './lab-common.mjs';
import { installApp } from './lab-gestes.mjs';

const lang = process.env.LAB_LANG || 'fr';
const WORDS = lang === 'fr' ? { menu: 'Depuis un modèle…', first: 'Vue d’ensemble', second: 'Répartition par catégorie', third: 'Évolution dans le temps' } : { menu: 'From a template…', first: 'Overview', second: 'Breakdown by category', third: 'Change over time' };
const BI_URL = /(apps\/bi|Grist-BI)\//;

const lab = await startLab({ lang });
const { page } = lab;
const warnings = [];
const errors = [];
page.on('console', message => {
  if (message.type() === 'warning' && message.text().startsWith('GFS')) warnings.push(message.text());
  if (message.type() === 'error' && BI_URL.test(message.location().url || '')) errors.push(message.text().slice(0, 200));
});
page.on('pageerror', error => errors.push(error.message.slice(0, 200)));
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
const tiles = app => app.evaluate(() => ({ tiles: document.querySelectorAll('#tiles > *').length, canvases: document.querySelectorAll('#tiles canvas').length, texte: document.body.innerText.replace(/\s+/g, ' ').slice(0, 420) }));
const waitTiles = async app => {
  for (let i = 0; i < 100; i++) {
    const seen = await tiles(app).catch(() => null);
    if (seen && seen.tiles > 0) { await page.waitForTimeout(1500); return tiles(app); }
    await page.waitForTimeout(300);
  }
  return tiles(app).catch(() => null);
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

await restart();
await lab.openModules(frame);
await installApp(frame, 'bi');
await lab.settle(frame);
await page.keyboard.press('Escape');
await frame.locator('.mod').waitFor({ state: 'hidden' });
await restart();
const before = await tablesOf();

await frame.locator('.ex').waitFor({ state: 'visible' });
await openGallery();
const chip = gallery.locator('.tp-chip', { hasText: 'Grist-BI' });
check('la pastille de Grist-BI dit ses trois modèles et n\'est pas grisée', (await chip.getAttribute('aria-disabled')) === null && (await chip.innerText()).includes('3'), await chip.innerText());
await chip.click();
check('Grist-BI ne montre que ses trois cartes, libres', (await gallery.locator('.tp-card').count()) === 3 && (await gallery.locator('.tp-card[aria-disabled="true"]').count()) === 0, await gallery.locator('.tp-card').count());
await lab.shotPanel(`modeles-bi-${lang}`, '1-galerie', frame);

await card(WORDS.first).click();
await gallery.locator('[data-act="create"]').click();
const app = await lab.appFrame(BI_URL);
let seen = await waitTiles(app);
say('Grist-BI au démarrage sur le modèle :', seen, 'phrase de GFS :', await toast());
check('Grist-BI démarre sur le modèle : un rapport avec des tuiles (graphiques dessinés) s\'affiche', seen && seen.tiles > 0 && seen.canvases > 0, seen);
check('GFS ne dit rien, l\'explorateur et la galerie sont fermés', (await toast()) === '' && (await frame.locator('.ex').isHidden()) && (await gallery.isHidden()), await toast());
check('rien n\'est écrit dans le document par cette ouverture (le rapport n\'est pas enregistré)', (await tablesOf()) === before, await tablesOf());
await lab.shotPanel(`modeles-bi-${lang}`, '2-modele-ouvert', frame);
const firstTiles = seen && seen.tiles;

await app.evaluate(() => { window.__avant = true; });
await showFiles();
await openGallery();
await gallery.locator('.tp-chip', { hasText: 'Grist-BI' }).click();
await card(WORDS.second).click();
await gallery.locator('[data-act="create"]').click();
await page.waitForTimeout(4000);
seen = await tiles(app).catch(() => null);
const same = await app.evaluate(() => window.__avant === true).catch(() => false);
say('Grist-BI déjà ouverte sur un autre modèle :', seen, 'même cadre :', same, 'tuiles avant :', firstTiles);
check('Grist-BI déjà ouverte prend l\'autre modèle dans le même cadre (non rechargé) : le rapport change, sans phrase d\'échec', same && seen && seen.tiles > 0 && seen.texte.includes(WORDS.second.split(' ')[0]) && !seen.texte.includes(WORDS.first), { seen, same });
check('GFS ne dit rien, rien n\'est écrit dans le document', (await toast()) === '' && (await tablesOf()) === before, await toast());
// Un modèle qu'elle ne sait pas poser (ici : il lui faut une colonne de dates, le document n'en a pas) : l'app le dit dans une fenêtre et ne touche pas au rapport en cours (`{ ouvert: false }`).
await showFiles();
await openGallery();
await gallery.locator('.tp-chip', { hasText: 'Grist-BI' }).click();
await card(WORDS.third).click();
await gallery.locator('[data-act="create"]').click();
await page.waitForTimeout(3000);
seen = await tiles(app).catch(() => null);
check('un modèle qui ne convient à aucune table du document est refusé avec sa raison, le rapport en cours reste', seen && /colonne de dates|date column/i.test(seen.texte) && seen.tiles > 0, seen);
// Grist-BI lit `_grist_DocInfo` (la langue et la devise du document, pour « Format des nombres : comme dans la colonne ») : son manifeste dans GFS ne le déclare pas, le courtier refuse et l'app retombe sur « Automatique ».
const docInfo = warnings.filter(text => text.includes('_grist_DocInfo'));
constat('Grist-BI lit `_grist_DocInfo`, que son manifeste ne déclare pas : le courtier la refuse et le format retombe sur « Automatique » (à demander par « Demandes à GFS »)', docInfo.length === 0, docInfo.length);
check('aucun autre avertissement de GFS, aucune erreur de script dans l\'app', warnings.length === docInfo.length && errors.length === 0, { warnings: warnings.filter(text => !text.includes('_grist_DocInfo')), errors });
await lab.browser.close();
