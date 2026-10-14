// L'ordre des écouteurs (contrats 1.2 et 9 point 4) dans un vrai navigateur, avec le VRAI script d'API de Grist : un cadre qui n'est ni Grist ni l'app
// active écrit à GFS un message `onOptions` (celui par lequel Grist donne ses réglages à une section). Le script d'API de Grist prend tout message de la
// fenêtre, quelle qu'en soit la source (`window.onmessage = e => rpc.receiveMessage(e.data)`) : s'il le reçoit, GFS croit qu'Automation+ est installée et que
// l'app ouverte ne l'est plus. Le routeur doit donc le jeter avant.
//
//   ROUTEUR=courant,apres-capture,apres-bulle   les variantes à jouer (toutes par défaut) :
//     courant        le routeur de GFS tel qu'il est publié (premier script de la page, écouteur de la phase de capture) ;
//     apres-capture  contrôle : le routeur s'enregistre APRÈS le script d'API de Grist, toujours en phase de capture (ce qui ne tient que si le navigateur
//                    passe les écouteurs de capture avant les autres sur la fenêtre elle-même) ;
//     apres-bulle    contrôle : le routeur s'enregistre après le script d'API de Grist, en phase de bulle : la fuite doit se voir (la mesure sait détecter).
//   LAB_BROWSER=chromium|firefox|webkit          le navigateur (Chromium par défaut ; les deux autres : sur une machine qui les a)
import { startLab } from './lab-setup.mjs';
import { say, check, engineName } from './lab-common.mjs';

const ROUTER_LINE = "window.addEventListener('message', route, true);";
const late = capture => ({ fichier: 'router.js', de: ROUTER_LINE, vers: `document.addEventListener('DOMContentLoaded', function () { window.addEventListener('message', route, ${capture}); });` });
// `attendu` : 'jete' (le message ne doit rien changer), 'fuite' (contrôle : il doit changer quelque chose), null (on mesure, le navigateur décide).
const VARIANTS = {
  courant: { patches: [], attendu: 'jete' },
  'apres-capture': { patches: [late(true)], attendu: null },
  'apres-bulle': { patches: [late(false)], attendu: 'fuite' },
};
const wanted = (process.env.ROUTEUR ? process.env.ROUTEUR.split(',') : Object.keys(VARIANTS)).filter(name => VARIANTS[name]);
const ROGUE = 'http://127.0.0.1:8911/prototype/labo/sondes/rogue/';
const FORGED = { mtype: 4, data: { settings: { accessLevel: 'full' }, options: { 'gfs.apps': { publipostage: { extensions: [] }, automation: { extensions: [] } } } } };

// L'état des apps vu de la fenêtre « Apps et extensions » (rouverte à chaque lecture : elle montre l'état du moment).
async function appsState(lab) {
  await lab.page.keyboard.press('Escape');
  await lab.page.waitForTimeout(200);
  await lab.openModules();
  return lab.frame.evaluate(() => ({
    compte: (document.querySelector('.mod-count') || { textContent: '' }).textContent.replace(/\s+/g, ' ').trim(),
    cochees: [...document.querySelectorAll('.mod input[data-fk^="app:"]')].filter(input => input.checked).map(input => input.dataset.fk.replace('app:', '')),
    cadresDApp: document.querySelectorAll('.app-frame').length,
  }));
}

// Une mesure : 'jete' et 'fuite' sont des vérifications, null est un relevé.
function verdict(variant, source, didLeak, detail) {
  if (variant.attendu === null) say(`MESURE ${source} : ${didLeak ? 'le faux message a atteint le script d\'API de Grist' : 'le faux message a été jeté avant le script d\'API de Grist'}`);
  else check(variant.attendu === 'fuite' ? `${source} : le faux message atteint le script d'API de Grist (la mesure sait voir la fuite)` : `${source} : le faux message est jeté, GFS ne bouge pas`, didLeak === (variant.attendu === 'fuite'), detail);
}

async function measure(name) {
  const variant = VARIANTS[name];
  say(`=== ${name} (${engineName}) ===`);
  const lab = await startLab({ lang: 'fr', probes: true, patches: variant.patches });
  await lab.fitPanel(undefined, 700, 400);
  const { frame, page } = lab;
  await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
  // Les messages jetés par le routeur, vus par son crochet de diagnostic.
  await frame.evaluate(() => { window.__jetes = []; window.GFSRouter.setStrayListener(event => window.__jetes.push(event.origin)); });
  const thrown = () => frame.evaluate(() => window.__jetes.length);
  const leaked = (before, after) => JSON.stringify(before) !== JSON.stringify(after);

  const base = await appsState(lab);
  say('départ :', base);
  // Un cadre voisin de GFS dans la page de Grist (comme un autre widget de la page).
  await page.evaluate(src => {
    const rogue = document.createElement('iframe');
    rogue.src = src;
    rogue.style.cssText = 'position:fixed;left:-1000px;top:0;width:10px;height:10px;border:0';
    document.body.append(rogue);
  }, `${ROGUE}index.html#voisins`);
  await page.waitForTimeout(1500);
  const afterNeighbour = await appsState(lab);
  const neighbourLeaked = leaked(base, afterNeighbour);
  say('après le cadre voisin :', afterNeighbour, '| messages jetés :', await thrown());
  verdict(variant, 'cadre voisin', neighbourLeaked, { avant: base, apres: afterNeighbour });

  // Une app ouverte (installée par une personne : la case, puis « Ouvrir »), puis un cadre dans son cadre, puis l'app elle-même.
  if (variant.attendu === 'fuite') {
    check('le routeur tardif a bien vu passer le message (il le jette, mais trop tard)', (await thrown()) >= 1, await thrown());
    await lab.browser.close();
    return;
  }
  const app = await lab.openApp('sonde-g', /g-capacites\//);
  await page.waitForTimeout(1200);
  const withApp = await appsState(lab);
  say('une app ouverte :', withApp);
  await app.evaluate(src => {
    const nested = document.createElement('iframe');
    nested.name = 'grandparent';
    nested.srcdoc = `<script src="${src}rogue.js"></script>`;
    document.body.append(nested);
  }, ROGUE);
  await page.waitForTimeout(1500);
  const afterNested = await appsState(lab);
  say('après le cadre du cadre de l\'app :', afterNested, '| messages jetés :', await thrown());
  verdict(variant, 'cadre du cadre de l\'app', leaked(withApp, afterNested), { avant: withApp, apres: afterNested });
  if (afterNested.cadresDApp === 0) {
    say('(le faux message a retiré l\'app ouverte : la suite est sans objet)');
    await lab.browser.close();
    return;
  }
  await app.evaluate(message => window.parent.postMessage(message, '*'), FORGED);
  await page.waitForTimeout(800);
  const afterApp = await appsState(lab);
  say('après l\'app active elle-même :', afterApp, '| messages jetés :', await thrown());
  check('l\'app active se fait passer pour Grist : le message va au courtier, pas au script d\'API de Grist', !leaked(afterNested, afterApp), { avant: afterNested, apres: afterApp });
  check('trois faux messages : deux jetés (voisin, cadre du cadre), un traité par le courtier', (await thrown()) === 2, await thrown());
  // Le sens inverse : un message de Grist passe (la personne coche Automation+, Grist rend ses réglages à GFS).
  await lab.openModules();
  await frame.locator('label', { hasText: 'Automation+' }).first().click();
  await page.waitForTimeout(700);
  const legit = await appsState(lab);
  say('une personne coche Automation+ :', legit);
  check('un message de Grist passe : le réglage écrit revient et la case reste cochée', legit.cochees.includes('automation') && legit.cochees.includes('sonde-g'), legit);
  await lab.browser.close();
}

for (const name of wanted) await measure(name);
