// Les écrans où passe une personne dans chaque app (Form+, Automation+, Grist-BI), et les gestes de la vraie souris qui y mènent : un seul endroit pour les essais qui les parcourent
// (run-barre-apps.mjs : ce que la barre de GFS recouvre ; run-ambiance-apps.mjs : le contraste de chaque texte dans chaque ambiance). `screensOf(appId, { page, frame, lang })` rend la
// liste [nom, async (cadre de l'app) => {…}] : chaque geste amène l'app à l'écran du nom, dans l'ordre.
import { say } from './lab-common.mjs';
import { seedFormDesigner } from './seed.mjs';

const visibleText = (app, text) => app.locator(`text="${text}" >> visible=true`);

// La molette de la vraie souris, au milieu du cadre de l'app : vers le bas (dy > 0) ou vers le haut, jusqu'au bout.
const wheel = async (page, app, dy) => {
  const box = await (await app.frameElement()).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, dy);
};

// Un onglet du concepteur de Form+, cliqué en haut de la page : l'écran en haut, puis au bout de son défilement (ce qui reste sous la barre quand plus rien ne peut monter).
const tab = (page, lang, name) => [
  [`${name.id}`, async (app) => { await wheel(page, app, -800); await app.getByRole('button', { name: name.label[lang] }).first().click(); }],
  [`${name.id}-fin`, async app => wheel(page, app, 800)],
];

// Une liste avec recherche de Grist-BI : la saisie, puis l'option à la souris.
const pick = async (app, input, option) => {
  await app.locator(input).click();
  await app.locator('.combobox-option:visible', { hasText: new RegExp(`^${option}$`) }).first().click();
};

export function screensOf(appId, { page, frame, lang }) {
  return {
    form: [
      ['departs', async app => { await app.locator('[data-startgo="link"]').waitFor({ timeout: 30000 }); }],
      ['concepteur', async (app) => {
        say('formulaire semé :', JSON.stringify(await seedFormDesigner(frame)));
        await app.evaluate(() => location.reload());
        await app.locator('#editor:not(.hidden)').waitFor({ timeout: 30000 });
      }],
      ['concepteur-fin', async app => wheel(page, app, 800)],
      ...tab(page, lang, { id: 'reponses', label: { fr: 'Réponses', en: 'Responses' } }),
      ...tab(page, lang, { id: 'parametres', label: { fr: 'Paramètres', en: 'Settings' } }),
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
        await wheel(page, app, 800);
      }],
      ['reglages', async (app) => {
        await wheel(page, app, -800);
        await app.locator('#open-settings').click();
        await app.locator('#settings-modal:not([hidden])').waitFor();
      }],
    ],
  }[appId];
}
