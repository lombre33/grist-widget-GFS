// Étude du lecteur vidéo de Slides+ (docs/etude-lecteur-video.md) : ce qu'un VRAI Grist laisse faire à un cadre que GFS poserait par-dessus l'app, sans réseau (un faux lecteur local d'une autre origine).
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-lecteur-mesures.mjs        (LAB_LANG=fr|en, LAB_SCHEME=light|dark)
//   1. Les attributs du cadre que Grist donne à GFS (`sandbox`, `allow`).
//   2. Un cadre posé par GFS (origine à lui, non isolé) : son origine, son stockage, les fonctions qu'un lecteur demande, sous la `frame-src` élargie à l'adresse du faux lecteur (la seule modification de GFS).
//   3. Le même cadre, isolé comme celui d'une app (`sandbox="allow-scripts"`) : origine « null », stockage refusé (ce que subirait un lecteur posé dans l'app).
//   5. LAB_RELAIS=1 (sans toucher à la politique de GFS) : le lecteur dans une page relais de GFS, qui seule nomme son adresse dans sa propre politique.
//   4. L'activation de la personne : un vrai clic dans le cadre de l'app arrive-t-il à la page de GFS, et au cadre du lecteur ?
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n.js';
import { PAGE_PORT, openGfs, settle, closeModules } from './lab-pdf.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const ID = 'sonde-j';
const PLAYER = `http://localhost:${PAGE_PORT}/prototype/labo/sondes/l-lecteur/policy.html`;
const PROBE_URL = `http://127.0.0.1:${PAGE_PORT}/prototype/labo/sondes/j-joindre/`;
const ALWAYS = { fichier: 'controller.js', de: "export const ALWAYS_ON = Object.freeze(['publipostage']);", vers: `export const ALWAYS_ON = Object.freeze(['publipostage', '${ID}']);` };
// Le seul changement de GFS pour cet essai : l'adresse du faux lecteur dans `frame-src` (la ligne de la politique, pas son commentaire).
const RELAY = process.env.LAB_RELAIS === '1';
const OPEN_CSP = { chemin: '/prototype/index.html', de: "frame-src 'self' blob:; connect-src", vers: `frame-src 'self' blob: http://localhost:${PAGE_PORT}; connect-src` };
const probeFrame = page => page.frames().find(frame => frame.url().startsWith(PROBE_URL) && !frame.isDetached());

async function openProbe({ page, frame }) {
  await frame.locator('.tb', { hasText: t('gfs.apps') }).first().click();
  await frame.locator('.mod').waitFor();
  await frame.locator(`[data-open="${ID}"]`).click();
  for (let i = 0; i < 60 && !(probeFrame(page) && await probeFrame(page).evaluate(() => document.body.dataset.sonde || '').catch(() => '')); i++) await page.waitForTimeout(250);
  return Boolean(probeFrame(page));
}

// Pose un cadre de lecteur dans la page de GFS et rend ce qu'il dit. Le routeur de GFS jette tout message d'une fenêtre qui n'est ni Grist ni l'app active (js/router.js, contrats 1.2) :
// l'essai écoute les messages jetés par `GFSRouter.setStrayListener` (le seul moyen, aujourd'hui, de les voir).
async function playerFrame(frame, { sandbox = null, name, url = PLAYER }) {
  await frame.evaluate(({ url, sandboxValue, id }) => {
    window.__lecteurs = window.__lecteurs || {};
    window.GFSRouter.setStrayListener((event) => {
      const mine = ['lecteur-vrai', 'lecteur-isole'].find(each => document.getElementById(each) && event.source === document.getElementById(each).contentWindow);
      if (mine && event.data && event.data.lecteur) window.__lecteurs[mine] = event.data.lecteur;
    });
    const player = document.createElement('iframe');
    player.id = id; player.src = url;
    player.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
    if (sandboxValue) player.setAttribute('sandbox', sandboxValue);
    player.style.cssText = 'position:fixed;left:10px;bottom:10px;width:200px;height:120px;border:0';
    document.body.appendChild(player);
  }, { url, sandboxValue: sandbox, id: name });
  for (let i = 0; i < 40 && !(await frame.evaluate(id => Boolean(window.__lecteurs[id]), name)); i++) await frame.page().waitForTimeout(250);
  return frame.evaluate(id => window.__lecteurs[id] || null, name);
}

// Ce que la console de GFS a dit pendant l'essai (hors les messages connus) ; une violation de politique n'est pas une erreur ici quand l'essai la cherche.
function finish(run) {
  const unexpected = run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
  say('problèmes de console :', JSON.stringify(unexpected).slice(0, 600));
}

async function playRelay({ frame }) {
  say('--- 5. le lecteur dans une page relais de GFS (la politique de GFS reste celle du dépôt) ---');
  const relay = await playerFrame(frame, { name: 'lecteur-vrai', url: `http://127.0.0.1:${PAGE_PORT}/prototype/labo/sondes/l-lecteur/relais.html` });
  say('lecteur par le relais :', JSON.stringify(relay));
  check('par la page relais, le lecteur d\'une autre origine répond sous la politique de GFS inchangée (`frame-src \'self\' blob:`)', Boolean(relay) && relay.via === 'relais' && /^http:\/\/localhost:/.test(relay.origin) && relay.storage === 'ok', relay);
  check('par la page relais, les mêmes fonctions manquent (Grist ne les délègue pas à GFS)', relay.features.autoplay === false && relay.features.fullscreen === false && relay.features['encrypted-media'] === false, relay.features);
  const direct = await playerFrame(frame, { name: 'lecteur-isole', url: PLAYER });
  check('la même adresse, posée directement dans la page de GFS, est refusée par sa politique inchangée', direct === null, direct);
}

async function playDirect(run) {
  const { page, frame } = run;
  say('--- 2. un cadre de lecteur posé par GFS ---');
  const real = await playerFrame(frame, { name: 'lecteur-vrai' });
  say('lecteur de GFS :', JSON.stringify(real));
  check('le cadre de lecteur répond, d\'une autre origine que GFS, avec son stockage', Boolean(real) && /^http:\/\/localhost:/.test(real.origin) && real.storage === 'ok', real);
  check('Grist ne délègue ni la lecture automatique, ni les médias protégés, ni le plein écran à GFS : le lecteur ne les a pas (l\'image dans l\'image, oui)', Boolean(real) && real.features.autoplay === false && real.features['encrypted-media'] === false && real.features.fullscreen === false && real.features['picture-in-picture'] === true, real && real.features);
  say('--- 3. le même cadre isolé comme celui d\'une app ---');
  const boxed = await playerFrame(frame, { name: 'lecteur-isole', sandbox: 'allow-scripts allow-forms allow-popups allow-modals allow-downloads' });
  say('lecteur isolé :', JSON.stringify(boxed));
  check('isolé, le cadre a l\'origine « null » et son stockage lève une erreur', Boolean(boxed) && boxed.origin === 'null' && boxed.storage !== 'ok', boxed);
  say('--- 4. l\'activation de la personne ---');
  await closeModules(page, frame).catch(() => {});
  await settle(page, frame);
  check('la sonde est ouverte dans son cadre isolé', await openProbe(run));
  // Playwright donne lui-même une activation à chaque `evaluate` : l'essai relève donc l'activation DANS les pages (toutes les 40 ms), attend que la sienne soit éteinte, clique pour de vrai
  // dans le cadre de l'app, puis relit les relevés et les date.
  const sampler = () => { window.__samples = []; setInterval(() => { window.__samples.push([Date.now(), navigator.userActivation.isActive]); if (window.__samples.length > 400) window.__samples.shift(); }, 40); };
  const probe = probeFrame(page);
  await frame.evaluate(sampler);
  await probe.evaluate(sampler);
  await page.waitForTimeout(7500);
  const box = await (await probe.frameElement()).boundingBox();
  const clicked = Date.now();
  await page.mouse.click(box.x + 40, box.y + 40);
  await page.waitForTimeout(1200);
  const read = Date.now();
  const gfsSamples = await frame.evaluate(() => window.__samples);
  const appSamples = await probe.evaluate(() => window.__samples);
  await frame.evaluate(() => { document.getElementById('lecteur-vrai').contentWindow.postMessage('q', '*'); });
  await page.waitForTimeout(500);
  const playerSamples = await frame.evaluate(() => window.__lecteurs['lecteur-vrai'].samples);
  const count = (samples, from, to) => samples.filter(([time, active]) => time > from && time < to && active).length;
  const rows = [['GFS', gfsSamples], ['app', appSamples], ['lecteur de GFS', playerSamples]].map(([who, samples]) => `${who} : ${count(samples, clicked - 2000, clicked)} avant, ${count(samples, clicked, read)} après`);
  say('relevés d\'activation (nombre de relevés « active », sur les 2 s avant le clic, quand l\'activation donnée par l\'essai lui-même est éteinte, puis sur 1,2 s après) :', rows.join(' | '));
  check('avant le clic, ni la page de GFS, ni l\'app, ni le lecteur n\'ont d\'activation en cours', [gfsSamples, appSamples, playerSamples].every(samples => count(samples, clicked - 2000, clicked) === 0), rows);
  check('le clic dans l\'app donne l\'activation à l\'app', count(appSamples, clicked, read) > 0, rows);
  check('l\'activation arrive à la page de GFS (l\'ancêtre du cadre de l\'app)', count(gfsSamples, clicked, read) > 0, rows);
  say('au cadre du lecteur que GFS pose (une autre origine) :', count(playerSamples, clicked, read) > 0 ? 'oui' : 'non');
}

process.env.LAB_PAGES_PORT = String(PAGE_PORT);
const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, server, { colorScheme: scheme });
  const run = await openGfs(context, { lang, probes: ['j'], patches: RELAY ? [ALWAYS] : [ALWAYS, OPEN_CSP] });
  const { page, frame } = run;
  say('--- 1. les attributs du cadre que Grist donne à GFS ---');
  const grist = await page.evaluate(() => [...document.querySelectorAll('iframe')].filter(each => /prototype\/index\.html/.test(each.src)).map(each => ({ allow: each.getAttribute('allow'), sandbox: each.getAttribute('sandbox') })));
  say('cadre de GFS dans Grist :', JSON.stringify(grist));
  check('Grist donne à GFS un cadre (attributs lus)', grist.length === 1, grist);
  await (RELAY ? playRelay(run) : playDirect(run));
  finish(run);
} finally {
  await browser.close();
  pages.close();
}
