// Une extension dont la bibliothèque n'a pas de CDN (un fichier assemblé par GFS, tant que GFS n'a pas d'adresse publique : contrats 2.6, point 11), dans la
// fenêtre « Apps et extensions » d'un vrai Grist (grist-static), à 700 × 400, à la vraie souris (Playwright : événements du pointeur du navigateur, jamais
// dispatchEvent). LAB_LANG=fr|en, LAB_SCHEME=light|dark.
// Les données sont les vraies : l'extension « Édition collaborative » du manifeste de Publipostage+ exige edition-live 1.0.0, dont l'entrée du catalogue n'a pas de CDN.
// Ce que la fenêtre doit montrer : le CDN grisé avec la raison, la copie de GFS choisie, rien d'écrit dans les réglages sans un geste, et l'extension du graphique
// (avec CDN) inchangée.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `sans-cdn-${lang}-${scheme}`;
const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
await lab.fitPanel(undefined, 700, 400);
const frame = lab.frame;
// Ce que le document retient (la table `GFS_Rangement`, contrats 7.4) : la valeur de sa ligne réservée, ou rien tant qu'aucun geste ne l'a fait naître.
const stored = async () => (await lab.rangement(frame)).value;
// La première écriture demande l'accord de la personne pour créer la table ; elle le donne, à la vraie souris.
const agree = async () => {
  await frame.locator('.ask').waitFor();
  await frame.locator('[data-fk="ask-yes"]').click();
  await frame.waitForFunction(() => document.body.dataset.registry === 'idle' && document.querySelectorAll('.ask').length === 0, null, { timeout: 15000 });
};
const row = id => frame.locator('.mr', { has: frame.locator(`[data-ext="${id}"]`) });
const radio = (id, mode) => row(id).locator(`input[type="radio"][value="${mode}"]`);
const option = (id, mode) => row(id).locator('.rd', { has: frame.locator(`input[type="radio"][value="${mode}"]`) });

await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
await frame.locator('.mod').waitFor();
await page.waitForTimeout(400);
check('la fenêtre montre les deux extensions', (await row('edition').count()) === 1 && (await row('graphique').count()) === 1);
check('rien n\'est écrit avant un geste : pas de table', (await lab.rangement(frame)).table === false);

// ----- Activer l'extension sans CDN, puis celle du graphique, à la vraie souris.
await row('edition').locator('label', { hasText: /Édition collaborative|Collaborative editing/ }).click();
await agree();
await page.waitForTimeout(500);
await row('graphique').locator('label', { hasText: /^\s*Graphique|^\s*Chart/ }).click();
await page.waitForTimeout(500);
check('les deux extensions sont cochées', (await row('edition').locator('[data-ext]').isChecked()) && (await row('graphique').locator('[data-ext]').isChecked()));
check('le mode se choisit maintenant (les deux)', !(await row('edition').locator('.mr-mode').evaluate(node => node.disabled)) && !(await row('graphique').locator('.mr-mode').evaluate(node => node.disabled)));

// ----- Sans CDN : l'option CDN reste là, grisée, avec la raison ; la copie de GFS est choisie. Avec CDN : rien ne change.
check('édition : l\'option CDN est grisée', await radio('edition', 'cdn').isDisabled());
check('édition : l\'option CDN n\'est pas cochée', !(await radio('edition', 'cdn').isChecked()));
check('édition : le pointeur dit « interdit » sur l\'option grisée, pas sur l\'autre', (await option('edition', 'cdn').evaluate(node => getComputedStyle(node).cursor)) === 'not-allowed' && (await option('edition', 'vendorise').evaluate(node => getComputedStyle(node).cursor)) === 'pointer');
check('édition : la copie de GFS est cochée et se choisit', (await radio('edition', 'vendorise').isChecked()) && !(await radio('edition', 'vendorise').isDisabled()));
const hint = (await option('edition', 'cdn').locator('.rd-hint').innerText()).trim();
say('raison affichée :', hint);
check('édition : la raison est dite, jamais muette', lang === 'fr' ? /^Indisponible : GFS n’a pas encore d’adresse publique/.test(hint) : /^Unavailable: GFS has no public address yet/.test(hint), hint);
check('graphique : l\'option CDN reste choisie et libre', (await radio('graphique', 'cdn').isChecked()) && !(await radio('graphique', 'cdn').isDisabled()));
check('graphique : sa raison est celle du CDN, pas celle de l\'absence', /jsDelivr/.test(await option('graphique', 'cdn').locator('.rd-hint').innerText()));
await lab.shotPanel(run, '1-deux-extensions');

// ----- Un clic sur l'option grisée ne change rien (vraie souris, au centre de la ligne).
const box = await option('edition', 'cdn').boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(400);
check('un clic sur l\'option grisée ne change rien', !(await radio('edition', 'cdn').isChecked()) && (await radio('edition', 'vendorise').isChecked()));
const saved = await stored();
say('ce que le document retient :', saved);
check('seules les cases cochées sont écrites : la copie imposée par l\'absence de CDN n\'est pas un choix de la personne', JSON.stringify(saved && saved.publipostage) === JSON.stringify({ extensions: ['graphique', 'edition'] }), saved && saved.publipostage);

// ----- Le choix du graphique reste libre : copie de GFS, puis retour au CDN.
await row('graphique').locator('.rd', { hasText: /Copie de GFS|GFS copy/ }).click();
await page.waitForTimeout(400);
check('graphique : la copie de GFS se choisit et s\'écrit', JSON.stringify((await stored()).publipostage.modes) === JSON.stringify({ graphique: 'vendorise' }), (await stored()).publipostage);
await row('graphique').locator('.rd', { hasText: /CDN/ }).first().click();
await page.waitForTimeout(400);
check('graphique : retour au CDN, le défaut ne s\'écrit pas', (await stored()).publipostage.modes === undefined, (await stored()).publipostage);
await lab.shotPanel(run, '2-apres-les-choix');
await lab.browser.close();
