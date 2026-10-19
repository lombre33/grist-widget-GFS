// « Select by » et le mode lecture de Publipostage+ : la ligne que la personne choisit dans le widget lié, et le lien lui-même, arrivent à l'app de GFS, qu'elle s'ouvre après le
// choix ou qu'elle soit déjà ouverte (contrats 4.2, points 2 et 3, et 4.3). Dans un vrai Grist (grist-static), à la vraie souris : la personne règle « Select by » dans le panneau
// de droite de la section de GFS, puis choisit les lignes du tableau CLIENTS.
//   1. la sonde I (labo/sondes/i-lecture/), qui s'abonne comme Publipostage+ : ce que le vrai script d'API de Grist lui livre ;
//   2. Publipostage+ lui-même (le miroir de `build-mirror.sh`) : ce que son `GristAPI` en lit, et ce que montre son mode lecture (le document rempli avec la ligne choisie).
// L'essai est en français (la question des tables de Publipostage+ se répond par son libellé).
//
//   REPO_DIR=<dépôt> node lab-server.mjs &   puis   REPO_DIR=<dépôt> node run-select-by.mjs
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';

// Ce que Grist dit d'une section reliée au tableau de la même table (WidgetFrame.ts, `ConfigNotifier` : `settings.linking.asTarget`).
const LINKED = 'Cursor:Same-Table';

const lab = await startLab({ lang: 'fr', probes: true });
const { page } = lab;

// La personne règle « Select by » de la section de GFS (panneau de droite, onglet « Data ») : `label` est le widget qui choisit la ligne, ou « Select widget » pour retirer le lien.
async function selectBy(label) {
  await page.getByText('CLIENTS Custom', { exact: false }).first().click({ position: { x: 20, y: 5 } });
  await page.waitForTimeout(500);
  const panel = page.locator('.test-right-panel');
  await panel.getByText('Data', { exact: true }).first().click();
  await panel.getByText(/^(Select widget|CLIENTS)$/).first().click();
  await page.waitForTimeout(400);
  await page.getByText(label, { exact: true }).last().click();
  await page.waitForTimeout(1200);
}
// Elle choisit une ligne du tableau CLIENTS.
async function chooseRow(name) {
  await page.getByText(name, { exact: true }).first().click();
  await page.waitForTimeout(1000);
}
// Ce que la sonde a reçu ; `until` attend (au plus 4 s) l'état voulu : Grist prévient en quelques dizaines de millisecondes, GFS relaie.
const readProbe = app => app.evaluate(() => JSON.parse(document.body.dataset.lecture || '{}'));
async function until(app, wanted) {
  for (let i = 0; i < 40; i++) {
    const seen = await readProbe(app);
    if (wanted(seen)) return seen;
    await page.waitForTimeout(100);
  }
  return readProbe(app);
}
const named = name => seen => Boolean(seen.ligne && seen.ligne.Nom === name);
const linkIs = value => seen => Boolean(seen.lien && seen.lien.asTarget === value);

say('\n=== « Select by » : la ligne choisie et le lien de la section arrivent à l\'app (sonde I) ===');
// 1. La section est reliée au tableau, la personne y choisit la ligne 2 : puis seulement elle ouvre l'app. Grist ne dit la ligne au `ready` que dans le message de table, qui date
// du démarrage de GFS (la ligne 1) : le rejeu de GFS doit dire la ligne d'à présent.
await selectBy('CLIENTS');
await chooseRow('Martin');
await lab.shot('select-by', '1-martin-choisie');
const app = await lab.openApp('sonde-i', /i-lecture\//);
await page.waitForTimeout(2500);
let seen = await readProbe(app);
say('rejeu :', seen.journal.map(entry => ({ nom: entry.nom, via: entry.via, ligne: entry.ligne && entry.ligne.Nom, lien: entry.lien && entry.lien.asTarget })));
check('app ouverte APRÈS le choix : elle lit la ligne choisie (Martin), pas celle du démarrage de GFS', named('Martin')(seen), seen.ligne);
check('elle sait sa section reliée : settings.linking.asTarget', linkIs(LINKED)(seen), seen.lien);
check('elle lit son niveau d\'accès dans les mêmes réglages', seen.acces === 'full', seen.acces);

// 2. L'app est ouverte : les lignes choisies ensuite arrivent (le message de ligne de Grist, relayé tel quel).
await chooseRow('Dupont');
seen = await until(app, named('Dupont'));
check('app ouverte : la ligne choisie ensuite (Dupont) arrive', named('Dupont')(seen), seen.ligne);
await chooseRow('Martin');
seen = await until(app, named('Martin'));
check('app ouverte : puis la suivante (Martin)', named('Martin')(seen), seen.ligne);

// 3. L'app est ouverte : la personne retire « Select by », puis le remet. Grist redit le lien à GFS, qui le redit à l'app (les réglages de l'app n'ont pas changé : seul le lien).
await selectBy('Select widget');
seen = await until(app, linkIs(null));
await lab.shot('select-by', '2-lien-retire');
check('app ouverte : « Select by » retiré, l\'app le sait (asTarget = null)', linkIs(null)(seen), seen.lien);
await selectBy('CLIENTS');
seen = await until(app, linkIs(LINKED));
check('app ouverte : « Select by » posé de nouveau, l\'app le sait', linkIs(LINKED)(seen), seen.lien);

// 4. Publipostage+ lui-même (il remplace la sonde : une seule app à la fois) : sa Lecture s'appuie sur `GristAPI.getCurrentRecord()` et `getLinkState()`, et le mode lecture
// remplit le document avec cette ligne.
say('\n=== Publipostage+ : ce que son GristAPI lit, et ce que montre son mode lecture ===');
await chooseRow('Martin');
const real = await lab.openApp('publipostage');
// La question des tables du widget (la Lecture n'en a pas besoin) : la personne répond « Ne pas créer » ; l'essai est en français.
await real.getByRole('button', { name: 'Ne pas créer' }).click({ timeout: 30000 });
await page.waitForTimeout(1000);
const readApp = () => real.evaluate(() => ({
  ligne: GristAPI.getCurrentRecord() && GristAPI.getCurrentRecord().Nom, lien: GristAPI.getLinkState(), table: GristAPI.getCurrentTableId(),
})).catch(error => ({ erreur: String(error && error.message).slice(0, 120) }));
let pp = await readApp();
say('Publipostage+ ouvert après le choix de Martin :', pp);
check('Publipostage+ ouvert APRÈS le choix : getCurrentRecord() rend la ligne choisie (Martin)', pp.ligne === 'Martin', pp);
check('Publipostage+ : getLinkState() dit « linked »', pp.lien === 'linked', pp);
// Le document porte la bulle #Nom (posée par l'éditeur de l'app, comme le ferait la personne en tapant « # ») ; le bouton « Mode lecture » se clique à la vraie souris.
await real.evaluate(html => EditorCore.getEditor().commands.setContent(html),
  '<p>Client : <span class="var-badge" data-table="Clients" data-column="Nom" data-key="Nom">#Nom</span></p>');
await real.locator('#btn-mode-read').click();
const reading = () => real.evaluate(() => document.getElementById('reader-container').innerText.trim());
async function readingIs(wanted) {
  for (let i = 0; i < 50; i++) {
    if ((await reading()) === wanted) return wanted;
    await page.waitForTimeout(100);
  }
  return reading();
}
let shown = await readingIs('Client : Martin');
await lab.shot('select-by', '3-lecture-martin');
check('mode lecture, app ouverte APRÈS le choix : le document est rempli avec la ligne choisie (Martin)', shown === 'Client : Martin', shown);
await chooseRow('Dupont');
shown = await readingIs('Client : Dupont');
check('mode lecture : la ligne choisie ensuite (Dupont) remplit le document', shown === 'Client : Dupont', shown);
pp = await readApp();
check('Publipostage+ ouvert : la ligne choisie ensuite (Dupont) arrive', pp.ligne === 'Dupont', pp);
await selectBy('Select widget');
await page.waitForTimeout(1500);
pp = await readApp();
check('Publipostage+ ouvert : « Select by » retiré, getLinkState() dit « unlinked »', pp.lien === 'unlinked', pp);
await selectBy('CLIENTS');
await page.waitForTimeout(1500);
pp = await readApp();
check('Publipostage+ ouvert : « Select by » posé de nouveau, getLinkState() dit « linked »', pp.lien === 'linked', pp);
await lab.shot('select-by', '4-publipostage');
await lab.browser.close();
