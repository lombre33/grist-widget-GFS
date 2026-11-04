// Une app qui ne répond pas (contrats 1.4, point 2), dans un vrai Grist, à 700 × 400, à la vraie souris et au vrai clavier. Le porteur a vu (04/11) Form+ muette : « Form+ ne répond pas. »
// restait en rouge sur l'explorateur quand il y revenait, et « Nouveau > Formulaire » ne relançait rien. Ici Form+ est rendue muette (une page vide à son site en ligne comme à sa copie
// figée : elle ne dit jamais « prête »), puis rendue à elle-même.
//   1. Au premier délai (15 s) GFS ouvre la copie figée et le dit ; au second il écrit « Form+ ne répond pas. », en rouge ; la console dit, les deux fois, où il a attendu.
//   2. L'explorateur recouvre l'app : la phrase se tait (rien de visible, rien à lire) ; l'explorateur fermé, elle revient, la même.
//   3. Form+ répond de nouveau : « Nouveau > Formulaire » relance l'app (un nouveau cadre, sur le site en ligne), elle est prête, la phrase a disparu et son écran est là.
// L'essai porte sur GFS, pas sur Form+ : l'app muette comme l'app qui répond sont des pages d'essai (l'autre dit « prête » par le vrai script d'API de Grist, comme toute app), servies à l'adresse de Form+ ;
// il ne lit rien du sous-module de Form+ (l'app elle-même s'ouvre dans run-ouvrir-form), et le script d'API enveloppé d'`eval` (`LAB_API_EVAL=1`) ne le change pas.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark. Un peu plus d'une minute : deux délais de 15 secondes sont attendus pour de bon.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `app-muette-${lang}-${scheme}`;
const WORDS = lang === 'fr'
  ? { timeout: 'Form+ ne répond pas.', fallback: /^Form\+ : la dernière version ne répond pas, GFS ouvre sa copie figée\.$/, form: /^Formulaire/, close: 'Fermer' }
  : { timeout: 'Form+ is not responding.', fallback: /^Form\+: the latest version is not responding, GFS opens its pinned copy\.$/, form: /^Form/, close: 'Close' };
const SILENT_PAGE = '<!doctype html><html><head><meta charset="utf-8"><title>Form+</title></head><body><p>Rien ne répond ici.</p></body></html>';
// L'app qui répond : sa page charge le script d'API de Grist (le labo le sert, enveloppé ou non) et dit « prête », ce que fait toute app ; son écran est ce mot.
const ANSWERING_SCREEN = 'Écran de l\'essai';
const ANSWERING_PAGE = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Form+</title></head><body><p>${ANSWERING_SCREEN}</p>`
  + '<script src="https://docs.getgrist.com/grist-plugin-api.js"></script><script>grist.ready({ requiredAccess: "full" });</script></body></html>';
const FORM_PAGE = /\/(FormPlus|prototype\/apps\/form)\/poc\/widget\.html/;

const lab = await startLab({ lang, colorScheme: scheme, live: true });
const { page } = lab;
const warnings = [];
const loads = []; // les chargements de la page de Form+, dans l'ordre : le site en ligne, la copie figée, puis chaque relance
page.on('console', message => { if (message.type() === 'warning' && message.text().startsWith('GFS')) warnings.push(message.text()); });
page.on('request', request => { if (FORM_PAGE.test(request.url()) && request.resourceType() === 'document') loads.push(request.url().replace(/\?.*/, '')); });
await lab.fitPanel(undefined, 700, 400);
const frame = lab.frame;

// Form+ muette tant que `silent`, puis qui répond : une route posée après celles du labo passe avant elles, et la page de Form+ n'est lue nulle part (ni sur le site en ligne, ni dans la copie figée).
let silent = true;
await page.route(/^http:\/\/127\.0\.0\.1:8911\/(FormPlus|prototype\/apps\/form)\//, route => (FORM_PAGE.test(route.request().url())
  ? route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: silent ? SILENT_PAGE : ANSWERING_PAGE })
  : route.fallback()));

const state = () => frame.evaluate(() => ({ status: document.body.dataset.appStatus, source: document.body.dataset.appSource }));
const waitState = async (test, ms) => {
  for (let i = 0; i < ms / 250; i++) {
    const seen = await state().catch(() => ({}));
    if (test(seen)) return seen;
    await page.waitForTimeout(250);
  }
  return state().catch(() => ({}));
};
const status = locator => ({ visible: locator.isVisible(), text: locator.innerText(), bad: locator.evaluate(el => el.classList.contains('status--bad')) });
const phrase = async () => {
  const locator = frame.locator('#status');
  const visible = await locator.isVisible();
  return { visible, text: visible ? (await locator.innerText()).trim() : '', bad: await locator.evaluate(el => el.classList.contains('status--bad')) };
};
const explorerShown = () => frame.locator('.ex').isVisible();

// 1. Form+ muette : le site en ligne, puis la copie figée, puis plus rien.
await lab.openApp('form', /FormPlus\//);
const asked = Date.now();
const fallen = await waitState(seen => seen.source === 'pinned', 25000);
const waited = (Date.now() - asked) / 1000;
check('au premier délai (15 s) GFS ouvre la copie figée de Form+', fallen.source === 'pinned' && waited > 13 && waited < 22, `${waited.toFixed(1)} s, ${fallen.status}/${fallen.source}`);
const toast = (await frame.locator('#toast').isVisible()) ? (await frame.locator('#toast').innerText()).replace(/\s+/g, ' ').trim() : '';
check('et il le dit à la personne', WORDS.fallback.test(toast), toast);
const gaveUp = await waitState(seen => seen.status === 'timeout', 25000);
const total = (Date.now() - asked) / 1000;
check('au second délai Form+ « ne répond pas » : l\'état est « timeout », 30 s après l\'ouverture', gaveUp.status === 'timeout' && total > 28 && total < 40, `${total.toFixed(1)} s, ${gaveUp.status}/${gaveUp.source}`);
const red = await phrase();
check('la phrase est visible, en rouge, au bas de l\'app', red.visible && red.bad && red.text === WORDS.timeout, red);
check('la console de GFS dit où il a attendu : le site en ligne, puis la copie figée (sans la recherche de l\'adresse)',
  warnings.length === 2 && /pas de « prête » en 15 s sur le site en ligne \(http:\/\/127\.0\.0\.1:8911\/FormPlus\/poc\/widget\.html\)$/.test(warnings[0])
    && /pas de « prête » en 15 s sur la copie figée \(http:\/\/127\.0\.0\.1:8911\/prototype\/apps\/form\/poc\/widget\.html\)$/.test(warnings[1]), warnings);
await lab.shotPanel(run, '1-muette-rouge', frame);

// 2. L'explorateur recouvre l'app : la phrase se tait ; il se ferme, elle revient.
await frame.locator('#floater-files').click();
await frame.locator('.ex').waitFor();
await page.waitForTimeout(400);
const covered = await phrase();
check('sur l\'explorateur, la phrase rouge ne reste pas : elle n\'est plus visible', (await explorerShown()) && !covered.visible && covered.text === '', covered);
check('et l\'app, elle, n\'est pas relancée par le simple passage dans l\'explorateur', (await state()).status === 'timeout' && loads.length === 2, loads);
await lab.shotPanel(run, '2-explorateur', frame);
await frame.locator('.ex-foot .btn', { hasText: WORDS.close }).click();
await frame.locator('.ex').waitFor({ state: 'hidden' });
const back = await phrase();
check('l\'explorateur fermé, la phrase revient, la même et toujours en rouge', back.visible && back.bad && back.text === WORDS.timeout, back);

// 3. Form+ répond de nouveau : « Nouveau > Formulaire » relance l'app au lieu de rester devant le cadre muet.
silent = false;
await frame.locator('#floater-files').click();
await frame.locator('.ex').waitFor();
await frame.locator('.btn.primary').click();
await frame.locator('.menu').waitFor();
await frame.locator('.menu-item', { hasText: WORDS.form }).first().click();
const relaunched = await waitState(seen => seen.status === 'ready', 25000);
check('« Nouveau > Formulaire » relance Form+ : un nouveau chargement de son site en ligne, et elle est prête', relaunched.status === 'ready' && relaunched.source === 'live' && loads.length === 3 && /\/FormPlus\//.test(loads[2]), { etat: relaunched, chargements: loads });
check('l\'explorateur est refermé et la phrase rouge a disparu', !(await explorerShown()) && !(await phrase()).visible, await phrase());
const app = await lab.appFrame(/FormPlus\/poc\/widget\.html/);
const screen = app ? await app.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim()).catch(() => '') : '';
check('l\'app montre son écran, dans un seul cadre (le cadre muet a été retiré)', screen.startsWith(ANSWERING_SCREEN) && page.frames().filter(f => FORM_PAGE.test(f.url())).length === 1, screen.slice(0, 80));
await lab.shotPanel(run, '3-relancee', frame);
check('GFS n\'a rien dit de plus en console que ses deux phrases d\'attente', warnings.length === 2, warnings);

say('fini', run);
await lab.browser.close();
