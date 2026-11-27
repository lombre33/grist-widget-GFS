// La page d'essai de la relance de LanguageTool (labo/essais-navigateur/relance.html, retour du 26/11 : « LanguageTool ne se lance pas toujours à l'arrivée en Lecture puis la bascule en Édition »), jouée à la vraie
// souris dans Chromium : un cadre isolé comme celui d'une app dans GFS, un témoin, quatre zones cachées au départ (partie A) et quatre zones gelées au départ (partie B). Ce banc vérifie la page : les zones naissent
// cachées ou gelées, « Montrer les zones » et « Rendre modifiables » les montrent et relancent chacune à sa façon (A0 et B0 jamais marquées ; A1 et B1 marque retirée à l'image suivante, après un rendu ; A2 et B2
// posée et retirée dans la même tâche ; A3 et B3 retirée 0,4 s plus tard), « Cacher de nouveau » les recache, les réponses de la personne remontent dans le rapport. La réponse qui compte, « LanguageTool
// démarre-t-il dans une zone cachée ou gelée ? », est celle de la personne, dans son Firefox avec l'extension : ici il n'y a pas d'extension, le rapport doit le dire.
import { join } from 'node:path';
import { engine, engineName, say, check, LAB, serveFolder } from './lab-common.mjs';

const SANDBOX = 'allow-scripts allow-forms allow-popups allow-modals allow-downloads';
const { server, port } = await serveFolder(join(LAB, 'essais-navigateur'), 'relance.html');
const browser = await engine.launch(engineName === 'chromium' ? { args: ['--no-sandbox'] } : {});
const context = await browser.newContext({ viewport: { width: 1000, height: 1300 }, colorScheme: 'light', locale: 'fr-FR' });
if (engineName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.goto(`http://localhost:${port}/relance.html`);
await page.waitForFunction(() => /origine du cadre/.test(document.getElementById('rapport').value), null, { timeout: 15000 });
const frame = page.frames().find(f => /relance-cadre\.html$/.test(f.url()));
const inner = page.frameLocator('iframe');

check('un seul cadre, isolé comme celui d\'une app dans GFS (même `sandbox`, origine vide)',
  (await page.locator('iframe').count()) === 1 && (await (await frame.frameElement()).getAttribute('sandbox')) === SANDBOX && (await frame.evaluate(() => self.origin)) === 'null');
const state = id => frame.evaluate(zone => { const e = document.getElementById(zone); return { shown: e.getClientRects().length > 0, editable: e.getAttribute('contenteditable'), mark: e.getAttribute('data-lt-active') }; }, id);
const ids = prefix => [0, 1, 2, 3].map(i => `${prefix}${i}`);
const states = async prefix => Object.fromEntries(await Promise.all(ids(prefix).map(async id => [id, await state(id)])));
let a = await states('a');
let b = await states('b');
check('partie A : les quatre zones naissent cachées, modifiables, sans marque', ids('a').every(id => !a[id].shown && a[id].editable === 'true' && a[id].mark === null), a);
check('partie B : les quatre zones naissent montrées et gelées (contenteditable="false"), sans marque', ids('b').every(id => b[id].shown && b[id].editable === 'false' && b[id].mark === null), b);
check('le témoin est montré et modifiable', (await state('t0')).shown && (await state('t0')).editable === 'true');

// Ce que la page fait de la marque, zone par zone : chaque changement, avec le lot de l'observateur (une tâche = un lot) et l'heure, pour la forme des trois relances.
await frame.evaluate(() => {
  window.__marks = [];
  let batch = 0;
  new MutationObserver(records => {
    batch += 1;
    for (const r of records) window.__marks.push({ id: r.target.id, mark: r.target.getAttribute('data-lt-active'), batch, t: performance.now(), attribute: r.attributeName });
  }).observe(document.body, { attributes: true, subtree: true, attributeFilter: ['data-lt-active'] });
});
const marks = () => frame.evaluate(() => window.__marks.splice(0));
const shape = (list, id) => list.filter(m => m.id === id);

await page.locator('iframe').scrollIntoViewIfNeeded();
await inner.locator('#t0').click();
await inner.locator('#montrer').click();
await page.waitForTimeout(900);
a = await states('a');
let log = await marks();
say('A, marques :', JSON.stringify(log.map(m => `${m.id}:${m.mark}@${m.batch}`)));
check('« Montrer les zones » montre les quatre zones de la partie A', ids('a').every(id => a[id].shown), a);
check('A0 (sans relance) n\'est jamais marquée', shape(log, 'a0').length === 0, shape(log, 'a0'));
const a1 = shape(log, 'a1'); const a2 = shape(log, 'a2'); const a3 = shape(log, 'a3');
check('A1 : marque posée, puis retirée à un autre lot (un rendu entre les deux)', a1.length === 2 && a1[0].mark === 'false' && a1[1].mark === null && a1[1].batch > a1[0].batch, a1);
// Dans le même lot, l'observateur lit la marque après les deux gestes : deux changements, une seule lecture de la valeur finale (retirée).
check('A2 : marque posée et retirée dans le même lot (la même tâche : deux changements au même lot, valeur lue à la fin : retirée)', a2.length === 2 && a2[1].batch === a2[0].batch && a2[1].mark === null, a2);
check('A3 : marque retirée environ 0,4 s après (350 à 700 ms)', a3.length === 2 && a3[1].t - a3[0].t >= 350 && a3[1].t - a3[0].t <= 700, a3.map(m => Math.round(m.t)));
check('à la fin, aucune zone de la partie A ne porte de marque', ids('a').every(id => a[id].mark === null), a);
// Un clic réel dans chaque zone montrée : elle prend le focus.
for (const id of ids('a')) {
  await inner.locator(`#${id}`).click();
  check(`${id.toUpperCase()} prend le focus au clic`, (await frame.evaluate(() => document.activeElement.id)) === id);
}
await inner.locator('#cacher').click();
await page.waitForTimeout(300);
a = await states('a');
check('« Cacher de nouveau » recache les quatre zones de la partie A', ids('a').every(id => !a[id].shown), a);
await marks();
await inner.locator('#montrer').click();
await page.waitForTimeout(900);
log = await marks();
check('« Montrer les zones » une seconde fois : A0 toujours sans marque, A1 à A3 relancées de nouveau', shape(log, 'a0').length === 0 && ['a1', 'a2', 'a3'].every(id => shape(log, id).length === 2), log.map(m => `${m.id}:${m.mark}`));

await inner.locator('#degeler').click();
await page.waitForTimeout(900);
b = await states('b');
log = await marks();
say('B, marques :', JSON.stringify(log.map(m => `${m.id}:${m.mark}@${m.batch}`)));
check('« Rendre modifiables » : les quatre zones de la partie B passent à contenteditable="true"', ids('b').every(id => b[id].editable === 'true'), b);
check('B0 (sans relance) n\'est jamais marquée', shape(log, 'b0').length === 0, shape(log, 'b0'));
const b1 = shape(log, 'b1'); const b2 = shape(log, 'b2'); const b3 = shape(log, 'b3');
check('B1 : marque retirée à un autre lot ; B2 : même lot ; B3 : 0,4 s plus tard',
  b1.length === 2 && b1[1].batch > b1[0].batch && b2.length === 2 && b2[1].batch === b2[0].batch && b3.length === 2 && b3[1].t - b3[0].t >= 350 && b3[1].t - b3[0].t <= 700, { b1, b2, b3 });
check('à la fin, aucune zone de la partie B ne porte de marque', ids('b').every(id => b[id].mark === null), b);
for (const id of ids('b')) {
  await inner.locator(`#${id}`).click();
  check(`${id.toUpperCase()} prend le focus au clic`, (await frame.evaluate(() => document.activeElement.id)) === id);
}

// Les réponses de la personne remontent dans le rapport.
const keys = ['t0', 'a0', 'a1', 'a2', 'a3', 'a0bis', 'b0', 'b1', 'b2', 'b3'];
for (const key of keys) await inner.locator(`#q-${key} input[value="${key === 'a0' || key === 't0' ? 'oui' : 'non'}"]`).check();
await page.waitForTimeout(2200);
const report = await page.locator('#rapport').inputValue();
say(report.split('\n').slice(0, 4).join(' | '));
check('le rapport dit le navigateur et la page qui porte le cadre', report.split('\n')[1].length > 10 && report.includes(`page qui porte le cadre : http://localhost:${port}`));
check('sans LanguageTool, le rapport ne trouve rien et le dit', /data-lt-installed : non/.test(report) && /éléments lt-\* : aucun/.test(report) && /attributs de LanguageTool sur les zones : aucun/.test(report));
check('origine vide, niveau 1, stockage refusé', /origine du cadre : null ; niveau d'imbrication : 1 ; stockage du navigateur : non/.test(report));
check('les dix réponses remontent dans le rapport (oui au témoin et à A0, non aux autres)', /zone 0 \(témoin[^\n]*: oui/.test(report) && /zone A0 \(cachée au départ, sans relance\)[^\n]*: oui/.test(report)
  && /zone A1[^\n]*: non/.test(report) && /zone A0, après « Cacher de nouveau »[^\n]*: non/.test(report) && /zone B3[^\n]*: non/.test(report) && !/pas répondu/.test(report));
check('chaque relance laisse ses deux lignes (posée, retirée) au rapport, avec l\'heure en millisecondes', /a1 : marque posée à \+0 ms/.test(report) && /a1 : marque retirée à \+\d+ ms/.test(report) && /b3 : marque retirée à \+(4\d\d) ms/.test(report));
check('les zones et leur état sont dits au rapport (vue / contenteditable / marque)', /zones \(vue\/contenteditable\/marque\) : t0 montrée\/true\/sans marque a0 montrée\/true\/sans marque/.test(report) && /b0 montrée\/true\/sans marque/.test(report));
await page.locator('#copier').click();
await page.waitForTimeout(300);
const copied = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
check('le bouton copie le rapport', copied === report || engineName !== 'chromium', copied.length);
check('aucune erreur de script dans la page', errors.length === 0, errors);
say('--- rapport ---');
say(report);
await browser.close();
server.close();
