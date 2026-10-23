// La page d'essai du navigateur (labo/essais-navigateur/), jouée à la vraie souris dans le navigateur du labo : ce que la personne fait dans son Firefox, et le rapport qu'elle copie.
// Sert à vérifier que la page marche et à garder la réponse de Chromium pour la comparer à celle de Firefox (LAB_BROWSER=firefox|webkit sur une machine qui les a).
// La page se sert elle-même (aucun Grist, aucun GFS) : un petit serveur sur un port libre.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { engine, engineName, say, check, LAB } from './lab-common.mjs';

const DOSSIER = join(LAB, 'essais-navigateur');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = createServer(async (req, res) => {
  const name = new URL(req.url, 'http://x').pathname.replace(/^\/+/, '') || 'index.html';
  try {
    const body = await readFile(join(DOSSIER, name.replace(/\.\./g, '')));
    res.writeHead(200, { 'content-type': TYPES[name.slice(name.lastIndexOf('.'))] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await engine.launch(engineName === 'chromium' ? { args: ['--no-sandbox'] } : {});
const context = await browser.newContext({ viewport: { width: 1000, height: 1200 }, colorScheme: 'light', locale: 'fr-FR' });
if (engineName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const arrived = [];
page.on('download', download => arrived.push(download.suggestedFilename()));
await page.goto(`${origin}/index.html`);

const report = () => page.locator('#rapport').inputValue();
await page.waitForFunction(() => (document.getElementById('rapport').value.match(/origine du cadre/g) || []).length === 5, null, { timeout: 15000 });
const text = await report();
say(text.split('\n').slice(0, 2).join(' | '));

// Les faits de chaque cadre : l'origine (opaque pour l'isolé), le niveau, le stockage.
const facts = id => text.split(/\nCadre /).find(part => part.startsWith(`${id} ·`)) || '';
const isOpaque = id => /origine du cadre : null/.test(facts(id));
check('les cinq cadres ont rendu leur rapport', ['A', 'B', 'C', 'D', 'E'].every(id => facts(id) !== ''), text.length);
check('B et E (isolés comme dans GFS) ont une origine opaque, A, C et D non', isOpaque('B') && isOpaque('E') && !isOpaque('A') && !isOpaque('C') && !isOpaque('D'));
check('le niveau d\'imbrication : 1 pour A, B et C ; 2 pour D et E', ['A', 'B', 'C'].every(id => /niveau d'imbrication : 1/.test(facts(id))) && ['D', 'E'].every(id => /niveau d'imbrication : 2/.test(facts(id))));
check('le stockage du navigateur est refusé dans les cadres isolés seulement', /stockage du navigateur : non/.test(facts('B')) && /stockage du navigateur : non/.test(facts('E')) && /stockage du navigateur : oui/.test(facts('A')) && /stockage du navigateur : oui/.test(facts('D')));
check('sans LanguageTool, le rapport ne trouve rien et le dit', /data-lt-installed : non/.test(facts('A')) && /éléments lt-\* : aucun/.test(facts('A')));

// Les téléchargements, un bouton après l'autre, à la vraie souris dans le cadre (A à C au premier niveau, D et E un cadre plus bas).
const frameOf = id => (id === 'D' || id === 'E'
  ? page.frameLocator(`iframe[title^="${id} "]`).frameLocator('iframe[title="cadre intérieur"]')
  : page.frameLocator(`iframe[title^="${id} "]`));
const matrix = {};
for (const id of ['A', 'B', 'C', 'D', 'E']) {
  // Un cadre hors de l'écran n'a pas d'image : le ramener dans la page avant de cliquer dedans.
  await page.locator(`iframe[title^="${id} "]`).scrollIntoViewIfNeeded();
  const frame = frameOf(id);
  const buttons = frame.locator('#tests button');
  const count = await buttons.count();
  for (let i = 0; i < count; i += 1) {
    const label = await buttons.nth(i).innerText();
    const before = arrived.length;
    await buttons.nth(i).click();
    const long = /7 secondes/.test(label);
    await page.waitForTimeout(long ? 8500 : 1200);
    matrix[`${id} · ${label.replace('Télécharger : ', '')}`] = arrived.length > before ? 'arrivé' : 'rien';
    if (arrived.length > before) await frame.locator('#tests .essai').nth(i).locator('input[value="ok"]').check();
    else await frame.locator('#tests .essai').nth(i).locator('input[value="ko"]').check();
  }
}
for (const [name, state] of Object.entries(matrix)) say(`${state === 'arrivé' ? 'arrivé' : 'RIEN  '} ${name}`);
say('fichiers reçus :', arrived);
check('le geste de Publipostage+ télécharge, seul et dans le cadre simple (A)', matrix['A · Comme Publipostage+ (adresse libérée aussitôt)'] === 'arrivé');
check('par la page du dessus, le fichier arrive depuis le cadre isolé (B, le fichier ; E, les octets)', matrix['B · Par la page du dessus (le fichier)'] === 'arrivé' && matrix['E · Par la page du dessus (les octets)'] === 'arrivé');

// La réponse de la personne à « LanguageTool corrige ici ? » et le rapport final.
await frameOf('A').locator('#lt input[value="non"]').check();
await page.waitForTimeout(400);
const final = await report();
check('le rapport garde ce que la personne a coché (arrivé, rien, LanguageTool)', /: arrivé/.test(final) && /LanguageTool corrige ici : non/.test(final) && /LanguageTool corrige ici : pas répondu/.test(final), final.split('\n').length);
await page.locator('#copier').click();
await page.waitForTimeout(300);
const copied = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
check('le bouton copie le rapport', copied === final || engineName !== 'chromium', copied.length);
check('aucune erreur de script dans la page', errors.length === 0, errors);
say('--- rapport final ---');
say(final);
await browser.close();
server.close();
