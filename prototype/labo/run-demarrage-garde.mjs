// La garde de démarrage (js/shell/boot-guard.js, 27/11) dans un VRAI Grist (grist-static) : le cadre que Grist donne à GFS est rechargé alors que le serveur rend un 404 HTML pour un module
// (js/explorer/list-signature.js, le défaut vu sous Firefox : « disallowed MIME type (text/html) »), à son chemin seul, comme le CDN de GitHub Pages qui garde la réponse. Ce que Grist fait de la
// reprise (le cadre navigue vers `prototype//index.html`) ne se devine pas : il faut qu'il rende encore ses messages à la page reprise, que GFS démarre, lise le document, et que l'adresse que GFS
// donne à son code (la section de la vue, les apps) soit toujours celle que la personne a saisie dans Grist.
//   1. Le cadre repart sous `prototype//index.html` (une barre de plus), avec la requête de Grist intacte (`access=full`, `language`) ; GFS se déclare prêt.
//   2. Grist répond encore à la page reprise : les tables du document se lisent par l'API des widgets.
//   3. L'adresse de la vue que GFS calcule est celle de Grist (`addressOf`), sans les barres de plus.
//   4. Un module refusé sous tous les chemins : la phrase et le bouton « Recharger » dans le cadre de GFS, pas de page blanche, aucune boucle.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `demarrage-garde-${lang}-${scheme}`;
const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const asked = [];
page.on('request', request => { if (request.url().includes('list-signature.js')) asked.push(new URL(request.url()).pathname); });

// Le « CDN » : le 404 HTML de Pages pour le chemin simple du module ; les chemins à barres doublées passent (le serveur du labo les fusionne, comme Pages).
const NOT_FOUND = '<!doctype html><title>404</title><p>There isn\'t a GitHub Pages site here.</p>';
let poisoned = /\/prototype\/js\/explorer\/list-signature\.js/;
await page.route('**/list-signature.js*', route => {
  const path = new URL(route.request().url()).pathname;
  return poisoned.test(path) ? route.fulfill({ status: 404, contentType: 'text/html; charset=utf-8', body: NOT_FOUND }) : route.continue();
});

say('1. Le cadre de GFS est rechargé, le module est refusé à son chemin simple');
let frame = lab.frame;
await frame.evaluate(() => location.reload());
// `gfsFrame` cherche une adresse qui commence par celle du widget : la page reprise n'en est plus une, on la cherche par sa barre de plus.
for (let i = 0; i < 80 && !(frame && /prototype\/\/index\.html/.test(frame.url())); i++) {
  await page.waitForTimeout(500);
  frame = page.frames().find(each => /^http:\/\/127\.0\.0\.1:8911\/prototype\/\/index\.html/.test(each.url())) || null;
}
check('le cadre repart sous « prototype//index.html »', Boolean(frame), frame ? frame.url() : page.frames().map(each => each.url()));
if (frame) {
  check('la requête de Grist est intacte', /access=full/.test(frame.url()) && new RegExp(`language=${lang}`).test(frame.url()), frame.url());
  await lab.gfsReady(frame);
  const state = await frame.evaluate(() => ({ gfs: document.body.dataset.gfs, box: Boolean(document.getElementById('boot-failure')) }));
  check('GFS se déclare prêt, sans phrase de défaut', state.gfs === 'ready' && !state.box, state);
  check('le module a été demandé au chemin simple (refusé), puis sous le chemin neuf (servi)',
    asked.includes('/prototype/js/explorer/list-signature.js') && asked.some(path => path.includes('//js/explorer/list-signature.js')), asked);

  say('2. Grist répond à la page reprise');
  const tables = await frame.evaluate(() => grist.docApi.listTables());
  check('les tables du document se lisent par l\'API des widgets', Array.isArray(tables) && tables.length > 0, tables);

  say('3. L\'adresse de la vue est celle que la personne a saisie');
  const addressOf = await frame.evaluate(async () => (await import('./js/broker/view-options.js')).addressOf(location.href));
  check('addressOf(location.href) n\'a pas de barres de plus', addressOf === 'http://127.0.0.1:8911/prototype', addressOf);
  await lab.shotPanel(run, '1-repris', frame);
}

say('4. Le module est refusé sous tous les chemins : la phrase et le bouton, rien de blanc');
poisoned = /list-signature\.js/;
asked.length = 0;
await (frame || lab.frame).evaluate(() => location.reload());
let last = null;
for (let i = 0; i < 80 && !last; i++) {
  await page.waitForTimeout(500);
  const found = page.frames().find(each => each.url().startsWith('http://127.0.0.1:8911/prototype/'));
  if (found && /\/{4}index\.html/.test(found.url()) && await found.locator('#boot-failure button').count()) last = found;
}
check('après trois reprises, la phrase et le bouton « Recharger » sont dans le cadre', Boolean(last), page.frames().map(each => each.url()));
if (last) {
  const text = await last.locator('#boot-failure').innerText();
  check('la phrase nomme le fichier refusé', /list-signature\.js \(404, text\/html\)/.test(text), text);
  check('le cadre de GFS n\'est pas blanc : la phrase est visible dans le panneau', await last.locator('#boot-failure').isVisible());
  const before = asked.length;
  await page.waitForTimeout(2500);
  check('plus rien ne se demande : pas de boucle', asked.length === before, { before, after: asked.length });
  await lab.shotPanel(run, '2-final', last);
}
await lab.browser.close();
