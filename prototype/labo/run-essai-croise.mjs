// La page d'essai croisé (labo/essais-navigateur/croise.html), jouée à la vraie souris : trois cadres posés par une page d'une AUTRE origine que la leur, dont un cadre isolé qui garde
// sa vraie origine (`allow-same-origin`, la voie « une adresse propre à l'app »), et avec `?point` les mêmes cadres au même site écrit avec un point à la fin du nom (`localhost.` contre `localhost`)
// et la règle `frame-src` qui le nomme. Sert à vérifier que la page marche (origines, lectures croisées refusées, stockage, rapport, règle, avertissement) ; la réponse qui compte,
// « LanguageTool corrige-t-il dans le cadre Y ? », est celle de la personne, dans son Firefox. La page se sert elle-même (aucun Grist, aucun GFS) : deux petits serveurs, l'un pour les cadres,
// l'autre pour la page qui les porte, sur deux ports libres, donc deux origines.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { engine, engineName, say, check, LAB } from './lab-common.mjs';

const DOSSIER = join(LAB, 'essais-navigateur');
// Ce que le rapport doit dire d'un cadre à origine réelle venu d'un autre nom d'hôte que sa page : son origine, le stockage permis, et aucune lecture dans un sens ni dans l'autre.
const realOrigin = (text, origin) => text.includes(`origine du cadre : ${origin} ; niveau d'imbrication : 1 ; stockage du navigateur : oui`) && text.includes('lit la page qui le porte : non (SecurityError)') && text.includes('la page lit le cadre : non (SecurityError)');
const ADRESSE_EN_LIGNE = 'https://lombre33.github.io/grist-widget-GFS/prototype/labo/essais-navigateur/';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
// `target` : l'adresse que la page croise.html doit croire être celle de ses cadres ; 'self' : celle du serveur lui-même (la page du même site que ses cadres).
const serve = async (target, host = '127.0.0.1') => {
  const server = createServer(async (req, res) => {
    const name = new URL(req.url, 'http://x').pathname.replace(/^\/+/, '') || 'croise.html';
    try {
      let body = await readFile(join(DOSSIER, name.replace(/\.\./g, '')));
      if (target && name === 'croise.html') {
        const base = target === 'self' ? `http://${host}:${server.address().port}/` : target;
        body = Buffer.from(body.toString('utf8').replace(ADRESSE_EN_LIGNE, base));
      }
      res.writeHead(200, { 'content-type': TYPES[name.slice(name.lastIndexOf('.'))] || 'application/octet-stream' }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, origin: `http://${host}:${server.address().port}`, port: server.address().port };
};

// Les cadres (cadre.html, essai.js) d'un côté, qui servent aussi la page croise.html à elle-même (pour l'avertissement) ; la page qui les porte de l'autre, avec l'adresse des cadres changée pour celle du premier.
const frames = await serve('self');
const holder = await serve(`${frames.origin}/`);

const browser = await engine.launch(engineName === 'chromium' ? { args: ['--no-sandbox'] } : {});
const context = await browser.newContext({ viewport: { width: 1000, height: 1200 }, colorScheme: 'light', locale: 'fr-FR' });
if (engineName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.goto(`${holder.origin}/croise.html`);
await page.waitForFunction(() => (document.getElementById('rapport').value.match(/origine du cadre/g) || []).length === 3, null, { timeout: 15000 });

check('trois cadres posés', (await page.locator('iframe').count()) === 3);
check('pas d\'avertissement quand la page est d\'une autre origine que ses cadres', await page.locator('#avertissement').isHidden());
// Un clic dans chaque cadre (les deux zones), puis la réponse de la personne : ici « oui, oui, non », pour voir remonter les trois.
const answers = ['oui', 'oui', 'non'];
for (let i = 0; i < 3; i += 1) {
  const frame = page.frameLocator('iframe').nth(i);
  await page.locator('iframe').nth(i).scrollIntoViewIfNeeded();
  await frame.locator('#zone').click();
  await frame.locator('#edition').click();
  await frame.locator(`#lt input[value="${answers[i]}"]`).check();
}
await page.waitForTimeout(2200);
const report = await page.locator('#rapport').inputValue();
const part = id => report.split(/\nCadre /).find(text => text.startsWith(`${id} ·`)) || '';
say(report.split('\n').slice(0, 4).join(' | '));
check('la page qui porte les cadres et les cadres sont de deux origines', new RegExp(`origine de cette page : ${holder.origin}`).test(report) && new RegExp(`les cadres viennent de : ${frames.origin}`).test(report));
check('X (cadre simple) : la vraie origine des cadres, un niveau, stockage permis', part('X').includes(`origine du cadre : ${frames.origin} ; niveau d'imbrication : 1 ; stockage du navigateur : oui`));
check('Y (isolé avec allow-same-origin) : la vraie origine des cadres, stockage permis', part('Y').includes(`origine du cadre : ${frames.origin} ; niveau d'imbrication : 1 ; stockage du navigateur : oui`));
check('Z (isolé comme GFS) : origine vide, stockage refusé', part('Z').includes("origine du cadre : null ; niveau d'imbrication : 1 ; stockage du navigateur : non"));
check('sans LanguageTool, le rapport ne trouve rien et le dit', /data-lt-installed : non/.test(part('Y')) && /éléments lt-\* : aucun/.test(part('Y')));
check('les trois réponses de la personne remontent dans le rapport', /corrige ici : oui/.test(part('X')) && /corrige ici : oui/.test(part('Y')) && /corrige ici : non/.test(part('Z')));
await page.locator('#copier').click();
await page.waitForTimeout(300);
const copied = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
check('le bouton copie le rapport', copied === report || engineName !== 'chromium', copied.length);

await page.goto(`${frames.origin}/croise.html`);
check('l\'avertissement paraît quand la page est du même site que ses cadres', await page.locator('#avertissement').isVisible());
check('aucune erreur de script dans la page', errors.length === 0, errors);
say('--- rapport ---');
say(report);

// ?point : le même serveur sous deux noms, `localhost` pour la page et `localhost.` (point final) pour les cadres : deux origines pour le navigateur, une seule machine.
const solo = await serve('self', 'localhost');
const pointOrigin = `http://localhost.:${solo.port}`;
const pointPage = await context.newPage();
const pointErrors = [];
pointPage.on('pageerror', error => pointErrors.push(error.message));
await pointPage.goto(`${solo.origin}/croise.html?point`);
await pointPage.waitForFunction(() => (document.getElementById('rapport').value.match(/origine du cadre/g) || []).length === 3, null, { timeout: 15000 });
check('?point : pas d\'avertissement, la page et ses cadres sont de deux origines', await pointPage.locator('#avertissement').isHidden() && await pointPage.locator('#intro-point').isVisible() && await pointPage.locator('#intro-disque').isHidden());
for (let i = 0; i < 3; i += 1) {
  const frame = pointPage.frameLocator('iframe').nth(i);
  await pointPage.locator('iframe').nth(i).scrollIntoViewIfNeeded();
  await frame.locator('#zone').click();
  await frame.locator('#edition').click();
  await frame.locator(`#lt input[value="${answers[i]}"]`).check();
}
await pointPage.waitForFunction(() => /conclusion :/.test(document.getElementById('rapport').value), null, { timeout: 30000 });
await pointPage.waitForTimeout(2200);
const pointReport = await pointPage.locator('#rapport').inputValue();
const pointPart = id => pointReport.split(/\nCadre /).find(text => text.startsWith(`${id} ·`)) || '';
say(pointReport.split('\n').slice(0, 4).join(' | '));
check('?point : la page est à `localhost`, les cadres à `localhost.`', pointReport.includes(`origine de cette page : ${solo.origin}`) && pointReport.includes(`les cadres viennent de : ${pointOrigin}`));
check('?point, X : l\'origine à point final, stockage permis, ni lecture de la page ni lecture du cadre', realOrigin(pointPart('X'), pointOrigin));
check('?point, Y : l\'origine à point final, stockage permis, ni lecture de la page ni lecture du cadre', realOrigin(pointPart('Y'), pointOrigin));
check('?point, Z : origine vide, stockage refusé, aucune lecture', pointPart('Z').includes("origine du cadre : null ; niveau d'imbrication : 1 ; stockage du navigateur : non") && pointPart('Z').includes('lit la page qui le porte : non (SecurityError)') && pointPart('Z').includes('la page lit le cadre : non (SecurityError)'));
check('?point, la règle `frame-src` qui nomme l\'adresse avec le point est appliquée et l\'accepte (W chargé, V bloqué)', /cadre W, à l'adresse nommée : chargé/.test(pointReport) && /cadre V, au même site sans le point, non nommé : bloqué/.test(pointReport) && /conclusion : la règle est appliquée et accepte l'adresse avec le point/.test(pointReport), pointReport.split('\n').filter(l => /Règle|cadre [WV]|conclusion|signalements/.test(l)));
check('?point, les réponses de la personne remontent dans le rapport', /corrige ici : oui/.test(pointPart('X')) && /corrige ici : oui/.test(pointPart('Y')) && /corrige ici : non/.test(pointPart('Z')));
check('?point, aucune erreur de script', pointErrors.length === 0, pointErrors);
say('--- rapport ?point ---');
say(pointReport);
await pointPage.goto(`${pointOrigin}/croise.html?point`);
check('?point : l\'avertissement paraît quand la page est déjà à l\'adresse des cadres', await pointPage.locator('#avertissement').isVisible());
solo.server.close();
await browser.close();
for (const s of [frames, holder]) s.server.close();
