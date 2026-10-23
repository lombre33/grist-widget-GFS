// La page d'essai à trois pages (labo/essais-navigateur/profond.html), jouée à la vraie souris : LanguageTool travaille-t-il dans le cadre d'une app posé comme GFS le pose dans Grist (la page du dessus,
// une page qui joue GFS, puis l'app) ? Cinq cadres : P1 (le réglage d'aujourd'hui, l'app isolée au nom du site), P2 (l'app au nom du site écrit avec un point à la fin), P3 (de même, l'app isolée qui garde
// sa vraie origine), P4 et P5 (une page de moins, au nom du site puis au nom avec le point). `localhost` contre `localhost.` fait les deux noms : une adresse IP ne peut pas porter de point final.
// Sert à vérifier que la page marche (origines, niveaux, stockage, adresse et isolement de chaque cadre, rapport, avertissement) ; la réponse qui compte, « LanguageTool corrige-t-il ici ? », est celle de la
// personne, dans son Firefox. Seule différence avec la page en ligne : sa règle `frame-src 'self' https:` ne laisserait pas passer le nom avec le point en `http:`, le serveur du labo écrit `https: http:`.
import { join } from 'node:path';
import { engine, engineName, say, check, LAB, serveFolder } from './lab-common.mjs';

const DOSSIER = join(LAB, 'essais-navigateur');
const SANDBOX = 'allow-scripts allow-forms allow-popups allow-modals allow-downloads';
const { server, port } = await serveFolder(DOSSIER, 'profond.html', (name, body) => (name.endsWith('.html')
  ? Buffer.from(body.toString('utf8').replaceAll("frame-src 'self' https:", "frame-src 'self' https: http:")) : body));
const normal = `http://localhost:${port}`;
const point = `http://localhost.:${port}`;

const browser = await engine.launch(engineName === 'chromium' ? { args: ['--no-sandbox'] } : {});
const context = await browser.newContext({ viewport: { width: 1000, height: 1400 }, colorScheme: 'light', locale: 'fr-FR' });
if (engineName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.goto(`${normal}/profond.html`);
await page.waitForFunction(() => (document.getElementById('rapport').value.match(/origine du cadre/g) || []).length === 5, null, { timeout: 15000 });

const IDS = ['P1', 'P2', 'P3', 'P4', 'P5'];
check('cinq cadres posés par la page, trois d\'entre eux avec une page qui joue GFS', (await page.locator('iframe').count()) === 5 && (await page.locator('iframe.milieu').count()) === 3);
check('pas d\'avertissement quand la page est au nom du site', await page.locator('#avertissement').isHidden());
// Un clic dans les deux zones de chaque cadre, puis la réponse de la personne (ici : non, oui, oui, non, oui) : elle doit remonter de l'app, par la page qui joue GFS, jusqu'au rapport.
const answers = { P1: 'non', P2: 'oui', P3: 'oui', P4: 'non', P5: 'oui' };
const inner = id => (['P4', 'P5'].includes(id)
  ? page.frameLocator(`iframe[title^="${id} "]`)
  : page.frameLocator(`iframe[title^="${id} "]`).frameLocator('iframe[title="cadre intérieur"]'));
for (const id of IDS) {
  await page.locator(`iframe[title^="${id} "]`).scrollIntoViewIfNeeded();
  await inner(id).locator('#zone').click();
  await inner(id).locator('#edition').click();
  await inner(id).locator(`#lt input[value="${answers[id]}"]`).check();
}
await page.waitForTimeout(2200);
const report = await page.locator('#rapport').inputValue();
const part = id => report.split(/\nCadre /).find(text => text.startsWith(`${id} ·`)) || '';
say(report.split('\n').slice(0, 4).join(' | '));

check('le rapport dit le navigateur et la page qui porte les cadres', report.split('\n')[1].length > 10 && report.includes(`page qui porte les cadres : ${normal}`));
check('P1, P2 (trois pages, l\'app isolée) : origine vide, niveau 2, stockage refusé', ['P1', 'P2'].every(id => part(id).includes("origine du cadre : null ; niveau d'imbrication : 2 ; stockage du navigateur : non")));
check('P3 (l\'app isolée garde sa vraie origine, au nom avec le point) : cette origine, niveau 2, stockage permis, aucune lecture de la page qui le porte', part('P3').includes(`origine du cadre : ${point} ; niveau d'imbrication : 2 ; stockage du navigateur : oui`) && part('P3').includes('lit la page qui le porte : non (SecurityError)'));
check('P4, P5 (une page de moins, isolé) : origine vide, niveau 1, stockage refusé', ['P4', 'P5'].every(id => part(id).includes("origine du cadre : null ; niveau d'imbrication : 1 ; stockage du navigateur : non")));
check('sans LanguageTool, le rapport ne trouve rien et le dit', /data-lt-installed : non/.test(part('P1')) && /éléments lt-\* : aucun/.test(part('P1')));
check('les cinq réponses de la personne remontent dans le rapport', IDS.every(id => new RegExp(`corrige ici : ${answers[id]}`).test(part(id))), IDS.map(id => `${id}: ${(part(id).match(/corrige ici : (\S+)/) || [])[1]}`));

// L'adresse du cadre de l'app : au nom du site (P1, P4) ou au nom avec le point (P2, P3, P5) ; et ses attributs d'isolement.
const appFrame = id => page.frames().find(f => new RegExp(`/cadre\\.html\\?c=${id}&`).test(f.url()));
const host = id => new URL(appFrame(id).url()).hostname;
check('l\'adresse de chaque cadre d\'app : le nom du site pour P1 et P4, le nom avec le point pour P2, P3 et P5', ['P1', 'P4'].every(id => host(id) === 'localhost') && ['P2', 'P3', 'P5'].every(id => host(id) === 'localhost.'), IDS.map(id => `${id}: ${appFrame(id) && appFrame(id).url()}`));
const sandboxOf = async id => (await (await appFrame(id).frameElement()).getAttribute('sandbox'));
check('isolement des cadres d\'app : celui de GFS (P1, P2, P4, P5) ; P3 de plus allow-same-origin', (await Promise.all(['P1', 'P2', 'P4', 'P5'].map(sandboxOf))).every(s => s === SANDBOX) && (await sandboxOf('P3')) === `${SANDBOX} allow-same-origin`);
check('la page qui joue GFS n\'est pas isolée, comme le cadre de GFS dans Grist (créé sans `sandbox`)',(await Promise.all(['P1', 'P2', 'P3'].map(async id => (await (await appFrame(id).parentFrame().frameElement()).getAttribute('sandbox')) === null))).every(Boolean));
await page.locator('#copier').click();
await page.waitForTimeout(300);
const copied = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
check('le bouton copie le rapport', copied === report || engineName !== 'chromium', copied.length);
check('aucune erreur de script dans la page', errors.length === 0, errors);
say('--- rapport ---');
say(report);

await page.goto(`${point}/profond.html`);
check('l\'avertissement paraît quand la page est déjà au nom avec le point', await page.locator('#avertissement').isVisible());
await browser.close();
server.close();
