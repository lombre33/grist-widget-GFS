// La barre de GFS devant la vraie Publipostage+ (la version que GFS référence), dans un vrai Grist (grist-static), à 700 × 400, à la vraie souris : ce que la barre recouvre de l'app aux quatre bords, tant
// que l'app n'écarte rien (la mesure de départ de la consigne 025 ; depuis que l'app l'a faite, `run-barre-ecartee.mjs` vérifie que rien ne passe sous la barre, et cette passe dit ce qui reste dessous). L'app est ouverte sur le modèle que la personne ouvre (« Contrat de prestation »), le cadre de l'app est plein (aucune bande) ; pour chaque
// bord, la passe relève chaque contrôle visible de l'app (boutons, champs, liens, zone d'écriture) que la barre recouvre, en tout ou en partie, et le dit : c'est ce que l'app doit écarter pour que
// rien ne soit sous la barre. Elle vérifie aussi ce qui doit rester vrai quoi qu'il arrive : la barre est à l'écran à chaque bord, l'app répond encore (son état d'enregistrement ne change pas) et un clic dans le
// coin bas droit atteint l'app (là où la pastille du zoom et le ▶ sont). LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check } from './lab-common.mjs';
import { measureEdges } from './barre-lab.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `barre-publipostage-${lang}-${scheme}`;
const OPEN = 'Contrat de prestation';

const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const errors = [];
page.on('pageerror', error => errors.push(String(error && error.message).slice(0, 160)));
await lab.fitPanel(undefined, 700, 400);
await seedFiles(lab.frame);
const frame = lab.frame;
await frame.locator('.ls-row', { hasText: OPEN }).first().waitFor({ timeout: 30000 }).catch(() => {});
const app = await lab.openApp('publipostage', /\/apps\/publipostage\//, frame);
await app.waitForFunction(() => { const e = document.getElementById('status-msg'); return Boolean(e && e.textContent); }, null, { timeout: 30000 });
await page.waitForTimeout(1500);

const status0 = await app.evaluate(() => document.getElementById('status-msg').textContent);
say('état :', status0.trim().slice(0, 60));
await measureEdges({ lab, frame, app, run, lang });
const status1 = await app.evaluate(() => document.getElementById('status-msg').textContent);
check('l\'app répond toujours à chaque bord : son état n\'a pas changé', status0 === status1, { avant: status0.slice(0, 60), apres: status1.slice(0, 60) });
const corner = await app.locator('body').click({ position: { x: 690, y: 390 }, trial: true, timeout: 3000 }).then(() => true, () => false);
check('le coin bas droit de l\'app est atteint par la vraie souris (la barre ne le recouvre plus)', corner);
check('aucune erreur de page pendant la passe', errors.length === 0, errors);
await lab.browser.close();
