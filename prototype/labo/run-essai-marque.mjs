// La page d'essai de la marque `data-lt-active` (labo/essais-navigateur/marque.html), jouée à la vraie souris : deux cadres (G isolé comme celui d'une app dans GFS, H simple) avec quatre zones de texte
// chacun ; la marque posée dès le départ (zones 2 et 4, celle-ci sur l'élément qui entoure), posée puis retirée à la souris sans que la zone perde le focus (zone 3), et le rapport à copier.
// Sert à vérifier que la page marche (origines, marques, boutons, réponses qui remontent, rapport) ; la réponse qui compte, « LanguageTool obéit-il à la marque ? », est celle de la personne, dans son
// Firefox avec l'extension : ici il n'y a pas d'extension, le rapport doit le dire (aucune trace de LanguageTool).
import { join } from 'node:path';
import { engine, engineName, say, check, LAB, serveFolder } from './lab-common.mjs';

const SANDBOX = 'allow-scripts allow-forms allow-popups allow-modals allow-downloads';
const { server, port } = await serveFolder(join(LAB, 'essais-navigateur'), 'marque.html');
const browser = await engine.launch(engineName === 'chromium' ? { args: ['--no-sandbox'] } : {});
const context = await browser.newContext({ viewport: { width: 1300, height: 1100 }, colorScheme: 'light', locale: 'fr-FR' });
if (engineName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.goto(`http://localhost:${port}/marque.html`);
await page.waitForFunction(() => (document.getElementById('rapport').value.match(/origine du cadre/g) || []).length === 2, null, { timeout: 15000 });

const inner = id => page.frameLocator(`iframe[title^="${id} "]`);
const frameOf = id => page.frames().find(f => new RegExp(`marque-cadre\\.html\\?c=${id}$`).test(f.url()));
const mark = (id, zone) => frameOf(id).evaluate(z => (document.getElementById(z).getAttribute('data-lt-active')), zone);
const IDS = ['G', 'H'];
// Les lignes de réponses du rapport, dans les mots de la page.
const QUESTIONS_LINES = [
  ['z1', 'zone 1 (aucune marque) : LanguageTool corrige ici'], ['z2', 'zone 2 (marque dès le départ) : LanguageTool corrige ici'],
  ['z3a', 'zone 3, après « Poser la marque », sans cliquer'], ['z3b', 'zone 3, marque posée, après un clic ailleurs puis dans la zone'],
  ['z3c', 'zone 3, après « Retirer la marque », sans cliquer'], ['z3d', 'zone 3, marque retirée, après un clic ailleurs puis dans la zone'],
  ['z4', 'zone 4 (marque sur l\'élément qui entoure) : LanguageTool corrige ici'],
];

check('deux cadres posés par la page', (await page.locator('iframe').count()) === 2);
check('G est isolé comme le cadre d\'une app dans GFS, H n\'a pas de `sandbox`', (await (await frameOf('G').frameElement()).getAttribute('sandbox')) === SANDBOX && (await (await frameOf('H').frameElement()).getAttribute('sandbox')) === null);
const first = await page.locator('#rapport').inputValue();
check('G : origine vide, niveau 1, stockage refusé ; H : l\'origine du site, stockage permis', /Cadre G[^]*origine du cadre : null ; niveau d'imbrication : 1 ; stockage du navigateur : non/.test(first)
  && new RegExp(`Cadre H[^]*origine du cadre : http://localhost:${port} ; niveau d'imbrication : 1 ; stockage du navigateur : oui`).test(first));
for (const id of IDS) {
  const marks = await Promise.all(['e1', 'e2', 'e3', 'p4'].map(z => mark(id, z)));
  check(`${id} : la marque est posée dès le départ en zone 2 et sur l'élément qui entoure la zone 4, pas en zones 1 et 3`, JSON.stringify(marks) === '[null,"false",null,"false"]', marks);
}

// À la vraie souris : un clic dans chaque zone, puis les réponses ; en zone 3, les boutons posent et retirent la marque sans prendre le focus.
const answers = { z1: 'oui', z2: 'non', z3a: 'se tait', z3b: 'se tait', z3c: 'revient', z3d: 'revient', z4: 'non' };
for (const id of IDS) {
  await page.locator(`iframe[title^="${id} "]`).scrollIntoViewIfNeeded();
  for (const zone of ['e1', 'e2', 'e4']) await inner(id).locator(`#${zone}`).click();
  await inner(id).locator('#e3').click();
  await inner(id).locator('#poser').click();
  check(`${id} : « Poser la marque » pose la marque sur la zone 3, qui garde le focus`, (await mark(id, 'e3')) === 'false' && (await frameOf(id).evaluate(() => document.activeElement.id)) === 'e3');
  await inner(id).locator('#e1').click();
  await inner(id).locator('#e3').click();
  await inner(id).locator('#retirer').click();
  check(`${id} : « Retirer la marque » la retire de la zone 3, qui garde le focus`, (await mark(id, 'e3')) === null && (await frameOf(id).evaluate(() => document.activeElement.id)) === 'e3');
  for (const [key, value] of Object.entries(answers)) await inner(id).locator(`#q-${key} input[value="${value}"]`).check();
}
await page.waitForTimeout(2200);
const report = await page.locator('#rapport').inputValue();
const part = id => report.split(/\nCadre /).find(text => text.startsWith(`${id} ·`)) || '';
say(report.split('\n').slice(0, 4).join(' | '));

check('le rapport dit le navigateur et la page qui porte les cadres', report.split('\n')[1].length > 10 && report.includes(`page qui porte les cadres : http://localhost:${port}`));
check('sans LanguageTool, le rapport ne trouve rien et le dit', IDS.every(id => /data-lt-installed : non/.test(part(id)) && /éléments lt-\* : aucun/.test(part(id)) && /attributs de LanguageTool sur les zones : aucun/.test(part(id))));
check('les sept réponses de la personne remontent dans le rapport, pour chaque cadre', IDS.every(id => QUESTIONS_LINES.every(([key, label]) => part(id).includes(`${label} : ${answers[key]}`))), IDS.map(id => part(id).split('\n').filter(l => / : (oui|non|se tait|continue|revient|rien)$/.test(l)).length));
check('la marque vue par chaque zone est dite au rapport (retirée en zone 3 à la fin)', IDS.every(id => /marque vue par chaque zone : e1 absente \/ e2 false \/ e3 absente \/ e4 false/.test(part(id))));
check('chaque bouton laisse une ligne « 1,5 s plus tard » dans le rapport, avec la marque vue au moment du clic et le focus gardé par la zone 3', IDS.every(id => /après « Poser la marque », 1,5 s plus tard : [^\n]*marque vue au clic : e1 absente \/ e2 false \/ e3 false \/ e4 false ; focus encore dans la zone 3 : oui/.test(part(id)) && /après « Retirer la marque », 1,5 s plus tard : [^\n]*marque vue au clic : e1 absente \/ e2 false \/ e3 absente \/ e4 false ; focus encore dans la zone 3 : oui/.test(part(id))));
await page.locator('#copier').click();
await page.waitForTimeout(300);
const copied = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
check('le bouton copie le rapport', copied === report || engineName !== 'chromium', copied.length);
check('aucune erreur de script dans la page', errors.length === 0, errors);
say('--- rapport ---');
say(report);
await browser.close();
server.close();
