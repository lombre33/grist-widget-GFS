// Un menu de GFS se referme au clic ailleurs, y compris dans le cadre d'une app (demande du porteur, 23/11 : « le menu des onglets reste ouvert malgré des clics dans la page »).
// Un clic dans un sous-cadre ne remonte pas à la page qui le porte : elle ne reçoit aucun `pointerdown` (le menu n'écoutait que lui). Deux gestes ferment maintenant le menu
// (js/ui/menu.js, css/gfs.css) : la page reçoit le clic parce que le cadre ne prend plus la souris le temps du menu (`:root:has(.menu) .app-frame`), et la fenêtre qui perd le
// focus (`blur` : un clic dans un cadre, ou sur la page de Grist autour du widget) referme le menu. Sous Firefox sans écran la fenêtre n'a jamais le focus (`document.hasFocus()`
// reste faux, aucun `blur` ne vient) : le premier geste se mesure dans test/barre-ouverts-firefox.mjs (étape « un clic dans le cadre »), le second ici, sous Chromium, à la vraie
// souris, sur la page d'essai de la barre (la vraie barre, le vrai menu, un vrai cadre sandboxé). Sans Grist ni serveur : `node run-menu-hors-widget.mjs`.
import { check, engine } from './lab-common.mjs';
import { serveSite } from '../test/firefox.mjs';
import { barrePages, PAGE } from '../test/barre-ouverts-firefox.mjs';
import { ROOT } from '../test/helpers.mjs';

const site = await serveSite(ROOT, barrePages());
const browser = await engine.launch();

// `guard` faux : la règle CSS qui rend la souris à la page est écartée, pour mesurer le seul `blur` ; le point cliqué est dans le cadre de l'app (à droite, en bas).
async function clickInFrame(guard) {
  const page = await (await browser.newContext({ viewport: { width: 700, height: 400 } })).newPage();
  await page.goto(`${site.url}${PAGE}?lang=fr`);
  await page.evaluate(() => window.__ready);
  if (!guard) await page.addStyleTag({ content: '.app-frame { pointer-events: auto !important; }' });
  await page.evaluate(() => { window.__bar.clear(); window.__bar.fill(3); });
  const box = await page.locator('#floater-opened').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const opened = await page.evaluate(() => Boolean(document.querySelector('.menu-opened')));
  await page.mouse.click(640, 360);
  await page.waitForTimeout(300);
  const state = await page.evaluate(() => ({ menu: Boolean(document.querySelector('.menu-opened')), expanded: document.getElementById('floater-opened').getAttribute('aria-expanded'),
    active: document.activeElement.tagName }));
  await page.context().close();
  return { opened, ...state };
}

for (const [guard, label] of [[true, 'le cadre ne prend plus la souris'], [false, 'seule la perte du focus de la page (`blur`)']]) {
  const state = await clickInFrame(guard);
  // Sans la règle CSS, le focus a bien quitté la page pour le cadre (`active` : IFRAME) : c'est lui qui a refermé le menu.
  check(`un clic dans le cadre de l'app referme le menu : ${label}`, state.opened && !state.menu && state.expanded === 'false' && (guard || state.active === 'IFRAME'), state);
}
await browser.close();
await site.close();
