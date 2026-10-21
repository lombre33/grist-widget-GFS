// La barre de GFS devant Form+, Automation+ et Grist-BI, dans un vrai Grist (grist-static), à 700 × 400, à la vraie souris : ce que la barre recouvre de chaque app aux quatre
// bords, tant que l'app n'écarte rien (le porteur, 21/10 : « Mesurer d'abord », avant d'écrire à chaque app ; contrats 5.2, point 7). Même mesure que
// run-barre-publipostage.mjs (barre-lab.mjs), sur les écrans où passe une personne :
//   Form+ (la version que GFS référence) : ses départs, puis son concepteur, sur un formulaire semé comme Form+ l'enregistre (seedFormDesigner), qu'elle lit en rechargeant son
//   cadre, et ses trois onglets, chacun en haut puis au bout de son défilement ;
//   Automation+ (la version que GFS référence) : sa question d'accord au démarrage, puis son graphe sans table (« Ne pas créer », deux nœuds ajoutés par « Ajouter »), son
//   journal ouvert, ses réglages ;
//   Grist-BI : GFS ne la référence pas encore (ni sous-module ni manifeste) ; elle se mesure seule, comme widget de la section, la barre posée par le calcul à la place que dit
//   le contrat (barRect), dessinée sur les captures. Son accueil (reliée d'elle-même à la table Clients), une tuile ajoutée au bout de la page, ses réglages. BI_DIR : une
//   copie de son dépôt au commit lu (docs/apps.md), servie le temps de la passe (`git -C <clone> archive <commit> | tar -x -C <dossier>`).
// Elle vérifie aussi ce qui doit rester vrai : la barre est à l'écran à chaque bord, à la place que dit le contrat, le courtier ne refuse rien et aucune erreur de page ne survient.
// APP=form|automation|bi, LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { startLab } from './lab-setup.mjs';
import { seedFormDesigner } from './seed.mjs';
import { say, check } from './lab-common.mjs';
import { measureEdges } from './barre-lab.mjs';

const appId = process.env.APP || 'form';
const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `barre-${appId}-${lang}-${scheme}`;
const alone = appId === 'bi';
const ALONE_PORT = 8912;
if (alone && !process.env.BI_DIR) throw new Error('APP=bi demande BI_DIR : une copie du dépôt de Grist-BI au commit lu (LISEZ-MOI du labo)');
const server = alone ? createServer(serve(process.env.BI_DIR)).listen(ALONE_PORT, '127.0.0.1') : null;
const lab = await startLab({ lang, colorScheme: scheme, ...(alone ? { widget: `http://127.0.0.1:${ALONE_PORT}/index.html` } : {}) });
const { page, frame } = lab;
const refusals = [];
const errors = [];
page.on('console', message => { if (message.type() === 'warning' && message.text().startsWith('GFS')) refusals.push(message.text().slice(0, 160)); });
page.on('pageerror', error => errors.push(String(error && error.message).slice(0, 160)));
await lab.fitPanel(undefined, 700, 400);

const visibleText = (app, text) => app.locator(`text="${text}" >> visible=true`);
// La molette de la vraie souris, au milieu du cadre de l'app : vers le bas (dy > 0) ou vers le haut, jusqu'au bout.
const wheel = async (app, dy) => {
  const box = await (await app.frameElement()).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, dy);
};
// Un onglet du concepteur de Form+, cliqué en haut de la page : l'écran en haut, puis au bout de son défilement (ce qui reste sous la barre quand plus rien ne peut monter).
const tab = name => [
  [`${name.id}`, async (app) => { await wheel(app, -800); await app.getByRole('button', { name: name.label[lang] }).first().click(); }],
  [`${name.id}-fin`, async app => wheel(app, 800)],
];
// Une liste avec recherche de Grist-BI : la saisie, puis l'option à la souris.
const pick = async (app, input, option) => {
  await app.locator(input).click();
  await app.locator('.combobox-option:visible', { hasText: new RegExp(`^${option}$`) }).first().click();
};
const SCREENS = {
  form: [
    ['departs', async app => { await app.locator('[data-startgo="link"]').waitFor({ timeout: 30000 }); }],
    ['concepteur', async (app) => {
      say('formulaire semé :', JSON.stringify(await seedFormDesigner(frame)));
      await app.evaluate(() => location.reload());
      await app.locator('#editor:not(.hidden)').waitFor({ timeout: 30000 });
    }],
    ['concepteur-fin', async app => wheel(app, 800)],
    ...tab({ id: 'reponses', label: { fr: 'Réponses', en: 'Responses' } }),
    ...tab({ id: 'parametres', label: { fr: 'Paramètres', en: 'Settings' } }),
  ],
  automation: [
    ['accord', async app => { await app.getByRole('button', { name: /Ne pas créer|Do not create/ }).waitFor({ timeout: 30000 }); }],
    ['graphe', async (app) => {
      await app.getByRole('button', { name: /Ne pas créer|Do not create/ }).click();
      for (const kind of lang === 'fr' ? ['Déclencheur', 'Action'] : ['Trigger', 'Action']) {
        await app.locator('#add-node').click();
        await visibleText(app, kind).last().click();
        await page.waitForTimeout(500);
      }
    }],
    ['journal', async (app) => { await app.locator('#toggle-logs').click(); }],
    ['reglages', async (app) => { await app.locator('#open-settings').click(); }],
  ],
  bi: [
    ['accueil', async app => { await app.waitForFunction(() => document.getElementById('table-select')?.value === 'Clients', null, { timeout: 40000 }); }],
    ['tuile', async (app) => {
      await pick(app, '#tile-dimension', 'Ville');
      await pick(app, '#tile-measure', 'Nom');
      await app.locator('#tile-agg').click();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      await app.locator('#submit-tile').click();
      await app.locator('.tile-header').first().waitFor();
      await wheel(app, 800);
    }],
    ['reglages', async (app) => {
      await wheel(app, -800);
      await app.locator('#open-settings').click();
      await app.locator('#settings-modal:not([hidden])').waitFor();
    }],
  ],
}[appId];

const app = alone ? frame : await lab.openApp(appId, new RegExp(`/apps/${appId}/`));
await page.waitForTimeout(3000);
await lab.fitPanel(undefined, 700, 400);
const results = {};
for (const [screen, prepare] of SCREENS) {
  await prepare(app);
  await page.waitForTimeout(1000);
  results[screen] = await measureEdges({ lab, frame: alone ? null : frame, app, run, lang, screen });
}
say('en tout :', JSON.stringify(results));
if (!alone) check('le courtier n\'a rien refusé à l\'app pendant la passe', refusals.length === 0, refusals);
check('aucune erreur de page pendant la passe', errors.length === 0, errors);
await lab.browser.close();
server?.close();
