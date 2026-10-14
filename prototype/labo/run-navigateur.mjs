// La page de mesures du navigateur (labo/navigateur/), jouée à la vraie souris dans le navigateur du labo : ce qu'une personne ferait dans son Firefox ou son Safari,
// et le texte qu'elle copierait. Ici Chromium (ou LAB_BROWSER=firefox|webkit sur une machine qui les a). Sert à deux choses : vérifier que la page marche, et garder
// la réponse de Chromium pour la comparer à celles des autres navigateurs.
//
//   LAB_SCHEME=light|dark   le thème de la page (capture)
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { engine, engineName, say, check, SHOTS } from './lab-common.mjs';

const PAGE = 'http://127.0.0.1:8911/prototype/labo/navigateur/index.html';
const scheme = process.env.LAB_SCHEME || 'light';

await mkdir(SHOTS, { recursive: true });
const browser = await engine.launch(engineName === 'chromium' ? { args: ['--no-sandbox'] } : {});
const context = await browser.newContext({ viewport: { width: 900, height: 1100 }, colorScheme: scheme });
if (engineName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
const page = await context.newPage();
const seen = { telechargements: [], fenetres: 0, dialogues: 0 };
page.on('download', download => seen.telechargements.push(download.suggestedFilename()));
page.on('dialog', dialog => { seen.dialogues += 1; dialog.dismiss().catch(() => {}); });
context.on('page', popup => { seen.fenetres += 1; popup.close().catch(() => {}); });
await page.goto(PAGE);

await page.waitForFunction(() => /GFS/.test(document.getElementById('ordre-verdict').textContent), null, { timeout: 15000 });
const verdict = await page.locator('#ordre-verdict').innerText();
say('ordre des écouteurs :', verdict);
check('le routeur de GFS tient', /Le routeur de GFS tient/.test(verdict), verdict);

// Les essais du cadre, un par un : le geste est un vrai clic de souris dans le cadre.
const sonde = page.frameLocator('#sonde');
await sonde.locator('[data-test="stockage"]').waitFor({ timeout: 15000 });
const buttons = await sonde.locator('[data-test]').evaluateAll(nodes => nodes.map(node => node.dataset.test));
say('boutons proposés à la personne :', buttons);
check('aucun essai qui détruit le cadre n\'est proposé', !buttons.some(name => /^naviguer|^mailtoMeme$/.test(name)), buttons);
for (const name of ['stockage', 'impressionDirecte', 'telechargementBlob', 'telechargementData', 'fenetre', 'presse', 'lien', 'mailtoBlank']) {
  await sonde.locator(`[data-test="${name}"]`).click();
  await page.waitForTimeout(900);
}
say('vu par le navigateur :', seen);
check('les deux téléchargements sont arrivés', seen.telechargements.includes('essai-blob.txt') && seen.telechargements.includes('essai-data.txt'), seen.telechargements);

// Le collage, puis les réponses de la personne.
await page.locator('#colle').click();
await page.keyboard.press('Control+V');
for (const id of ['telechargementBlob', 'telechargementData', 'fenetre', 'lien', 'impression']) await page.locator(`input[name="${id}"][value="oui"]`).check();
await page.locator('textarea[aria-label^="Autre chose"]').fill('rien à signaler');

await page.locator('#copier').click();
await page.waitForTimeout(300);
const status = await page.locator('#copie-etat').innerText();
const text = await page.locator('#rapport').inputValue();
say('copie :', status);
say('--- le texte copié ---');
say(text);
say('--- fin ---');
check('le texte contient le navigateur, l\'ordre, le cadre et les réponses', ['Navigateur :', '1. Ordre des écouteurs', '2. Cadre isolé', '3. Ce que la personne a vu'].every(part => text.includes(part)), text.length);
check('le cadre a répondu à chaque essai fait', ['stockage', 'impressionDirecte', 'telechargementBlob', 'telechargementData', 'fenetre', 'presse', 'lien'].every(name => text.includes(`   ${name} :`)), text.length);
// Le dernier essai du presse-papiers écrit « essai » (execCommand) après « essai de GFS » (writeText) : le collage montre l'un ou l'autre.
check('le collage est relevé', /collage après « Presse-papiers » : « essai/.test(text), text.match(/collage[^\n]*/)[0]);
check('la copie dit qu\'elle a réussi', status === 'Copié.', status);
// La page entière, mais par une fenêtre assez haute : une capture « page entière » de Playwright laisse vide le cadre isolé.
await page.setViewportSize({ width: 900, height: Math.min(await page.evaluate(() => document.documentElement.scrollHeight), 4000) });
await page.waitForTimeout(500);
await page.screenshot({ path: join(SHOTS, `navigateur-${engineName}-${scheme}.png`) });
await browser.close();
