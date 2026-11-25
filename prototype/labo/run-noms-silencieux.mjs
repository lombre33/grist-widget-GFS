// La version de DÉVELOPPEMENT de Publipostage+ (celle du sous-module, servie par lombre33.github.io), seule dans Grist, devant un document aux noms d'avant : renomme-t-elle sans rien demander ?
// (rapport des noms en anglais, défaut 1 ; consigne 104). grist-static, 700 × 400, sans GFS. Le document est posé aux noms d'avant comme `run-noms-fenetre` le fait ; on recharge le widget et on regarde.
//   REPO_DIR="$(realpath ../..)" node lab-server.mjs &   puis   REPO_DIR="$(realpath ../..)" node run-noms-silencieux.mjs        (ROLE=owner : le compte du labo est propriétaire ; LAB_LANG=fr|en)
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';
import { legacyDocument, frameTables, frameRows } from './lab-noms.mjs';

const lang = process.env.LAB_LANG || 'fr';
const WIDGET = 'http://127.0.0.1:8911/prototype/apps/publipostage/index.html';
const lab = await startLab({ widget: WIDGET, lang, colorScheme: 'light' });
const { page } = lab;
const widgetFrame = () => page.frames().find(frame => frame.url().startsWith(WIDGET) && !frame.isDetached());
const consent = lang === 'fr' ? /Créer les tables/ : /Create the tables/;
const ask = widgetFrame().getByRole('button', { name: consent });
await ask.first().waitFor({ state: 'visible', timeout: 20000 });
await ask.first().click();
await page.waitForTimeout(6000);
const start = await legacyDocument(widgetFrame());
check('témoin : le document est aux noms d\'avant (tables d\'avant, cinq modèles)', start.gone.ok && start.made.ok && start.added.ok, start);
const own = list => list.filter(name => /^Publipostage_/.test(name));
say('tables avant :', JSON.stringify(own(await frameTables(widgetFrame()))));
let asked = 0;
page.on('dialog', async dialog => { asked += 1; await dialog.dismiss(); });
await widgetFrame().evaluate(() => location.reload());
await page.waitForTimeout(9000);
const modals = await widgetFrame().evaluate(() => [...document.querySelectorAll('.modal-content, .pp-modal-box, [role=dialog]')].filter(el => el.offsetParent).map(el => el.textContent.trim().slice(0, 90)));
const buttons = await widgetFrame().evaluate(() => [...document.querySelectorAll('button')].filter(b => b.offsetParent && /Mettre à jour|Update|Renommer|Rename|Continuer|Continue|Migrer/.test(b.textContent)).map(b => b.textContent.trim()));
const after = own(await frameTables(widgetFrame()));
say('tables après la réouverture :', JSON.stringify(after));
say('fenêtres visibles :', JSON.stringify(modals), '; boutons de mise à jour :', JSON.stringify(buttons), '; boîtes natives :', asked);
const rows = after.includes('Publipostage_Templates') ? (await frameRows(widgetFrame(), 'Publipostage_Templates')).length : null;
check('le document est renommé en anglais sans qu\'aucune fenêtre ne l\'ait demandé', after.includes('Publipostage_Templates') && !after.includes('Publipostage_Modeles') && modals.length === 0 && buttons.length === 0 && asked === 0, { after, modals, buttons, asked });
check('les cinq modèles sont là (rien perdu)', rows === 5, rows);
await page.screenshot({ path: `${process.env.SHOTS || '/tmp'}/noms-silencieux-${lang}.png` });
process.exit(0);
