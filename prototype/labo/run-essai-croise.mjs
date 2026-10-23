// La page d'essai croisé (labo/essais-navigateur/croise.html), jouée à la vraie souris : trois cadres posés par une page d'une AUTRE origine que la leur, dont un cadre isolé qui garde
// sa vraie origine (`allow-same-origin`, la voie « un domaine par app »). Sert à vérifier que la page marche (origines, stockage, rapport, avertissement) ; la réponse qui compte,
// « LanguageTool corrige-t-il dans le cadre Y ? », est celle de la personne, dans son Firefox. La page se sert elle-même (aucun Grist, aucun GFS) : deux petits serveurs, l'un pour les cadres,
// l'autre pour la page qui les porte, sur deux ports libres, donc deux origines.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { engine, engineName, say, check, LAB } from './lab-common.mjs';

const DOSSIER = join(LAB, 'essais-navigateur');
const ADRESSE_EN_LIGNE = 'https://lombre33.github.io/grist-widget-GFS/prototype/labo/essais-navigateur/';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
// `target` : l'adresse que la page croise.html doit croire être celle de ses cadres ; 'self' : celle du serveur lui-même (la page du même site que ses cadres).
const serve = async target => {
  const server = createServer(async (req, res) => {
    const name = new URL(req.url, 'http://x').pathname.replace(/^\/+/, '') || 'croise.html';
    try {
      let body = await readFile(join(DOSSIER, name.replace(/\.\./g, '')));
      if (target && name === 'croise.html') {
        const base = target === 'self' ? `http://127.0.0.1:${server.address().port}/` : target;
        body = Buffer.from(body.toString('utf8').replace(ADRESSE_EN_LIGNE, base));
      }
      res.writeHead(200, { 'content-type': TYPES[name.slice(name.lastIndexOf('.'))] || 'application/octet-stream' }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
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
await browser.close();
for (const s of [frames, holder]) s.server.close();
