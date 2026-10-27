// Points 3, 5 et 8 du cahier (section 9) : ce qu'une app peut faire dans son sous-cadre isolé, dans un vrai Grist. La sonde G (labo/sondes/g-capacites/) est ouverte
// par GFS comme n'importe quelle app ; chaque essai part d'un clic de la vraie souris (Playwright : événements du pointeur du navigateur, jamais dispatchEvent).
// Ce que la page ne voit pas d'elle-même (téléchargement arrivé, fenêtre ouverte, message du navigateur) est relevé ici.
//
//   CAP_CONFIG=courante|echappe|protocoles|memeOrigine|schemas|grist  le sous-cadre (courante : celui de GFS ; les autres ajoutent un drapeau ou une source de frame-src, labo
//                                                        seulement ; grist : la sonde est le widget de Grist, dans le cadre de Grist, sans GFS)
//   CAP_CONFIG=pleinGfs|pleinGrist|pleinDeux             le plein écran (demande de Publipostage+ du 21/10) : `fullscreen` ajouté à `allow` du sous-cadre de GFS seul, à celui du
//                                                        cadre que Grist donne à GFS seul, ou aux deux (labo seulement : Grist n'a que `clipboard-write`) ; CAP_ONLY=plein
//   CAP_ALONE=1                                          la sonde seule dans une page ordinaire (« comme seule ») : la référence
//   CAP_ONLY=essai1,essai2                               seulement ces essais
//   CAP_ORDINAIRE=1                                      le cadre de Grist sans le `credentialless` de grist-static (lab-setup.mjs) : sans lui, `window.open` rend la fenêtre et elle garde son ouvreur
//   CAP_SET=main|nav                                     les essais d'une page (main) ou les navigations du cadre (nav, un lancement de Grist par essai)
import { startLab } from './lab-setup.mjs';
import { say, chromium } from './lab-common.mjs';
import { SANDBOX } from '../js/frames.js';

const CONFIGS = {
  courante: undefined,
  echappe: { sandbox: `${SANDBOX} allow-popups-to-escape-sandbox` },
  protocoles: { sandbox: `${SANDBOX} allow-top-navigation-to-custom-protocols` },
  memeOrigine: { sandbox: `${SANDBOX} allow-same-origin` },
  schemas: { frameSrc: "'self' mailto: tel:" },
  pleinGfs: { allow: 'clipboard-write; fullscreen' },
  pleinGrist: undefined,
  pleinDeux: { allow: 'clipboard-write; fullscreen' },
};
// Le cadre que Grist donne à GFS est écrit par Grist (`WidgetFrame.ts`) : le labo remplace, pour l'essai, l'attribut de son fichier compilé.
const GRIST_FRAME = { chemin: '/dist/GristDoc.bundle.js', de: '{allow:"clipboard-write"}', vers: '{allow:"clipboard-write; fullscreen"}' };
const PATCHES = { pleinGrist: [GRIST_FRAME], pleinDeux: [GRIST_FRAME] };
const config = process.env.CAP_CONFIG || 'courante';
const alone = process.env.CAP_ALONE === '1';
const set = process.env.CAP_SET || 'main';
const only = process.env.CAP_ONLY ? process.env.CAP_ONLY.split(',') : null;
const wanted = names => (only ? names.filter(name => only.includes(name)) : names);
const PROBE = 'http://127.0.0.1:8911/prototype/labo/sondes/g-capacites/index.html';
const MAIN = ['stockage', 'cadreImpression', 'impressionDirecte', 'telechargementBlob', 'telechargementData', 'fenetre', 'fenetreNoopener', 'lien', 'mailtoBlank',
  'presse', 'plein', 'chercher'];
// Les essais qui peuvent détruire le cadre : un lancement de Grist chacun.
const NAV = ['mailtoMeme', 'naviguerMeme', 'naviguerAutre', 'naviguerHaut', 'naviguerParent'];

// Ce que le navigateur montre pendant un essai : téléchargements, fenêtres ouvertes, boîtes de dialogue, messages de la console.
function observe(page, context) {
  const seen = { telechargements: [], fenetres: [], dialogues: [], messages: [] };
  page.on('download', download => seen.telechargements.push(download.suggestedFilename()));
  context.on('page', popup => seen.fenetres.push(popup));
  page.on('dialog', dialog => { seen.dialogues.push(dialog.type()); dialog.dismiss().catch(() => {}); });
  page.on('console', message => { if (/essai|Ignored|blocked|Blocked|disallowed|not allowed|Refused|Failed|Unsafe|sandbox/i.test(message.text())) seen.messages.push(message.text().slice(0, 200)); });
  const reset = () => { seen.telechargements = []; seen.fenetres = []; seen.dialogues = []; seen.messages = []; };
  return { seen, reset };
}

async function popupFacts(popup) {
  await popup.waitForLoadState('load', { timeout: 4000 }).catch(() => {});
  const facts = await popup.evaluate(() => document.body.dataset.popup || null).catch(() => null);
  const out = { adresse: popup.url().replace(/^.*\/g-capacites\//, ''), faits: facts ? JSON.parse(facts) : null };
  await popup.close().catch(() => {});
  return out;
}

async function runOne(app, name, seen) {
  const frameBefore = app.url();
  await app.locator(`[data-test="${name}"]`).click();
  await app.page().waitForTimeout(NAV.includes(name) ? 1500 : 900);
  const popups = [];
  for (const popup of seen.fenetres.splice(0)) popups.push(await popupFacts(popup));
  const data = await app.evaluate(() => document.body.dataset.cap || '{}').catch(() => '{}');
  const arrival = await app.evaluate(() => document.body.dataset.ailleurs || null).catch(() => null);
  const out = { essai: name, page: JSON.parse(data)[name] || null };
  if (seen.telechargements.length) out.telechargements = seen.telechargements.splice(0);
  if (popups.length) out.fenetres = popups;
  if (seen.dialogues.length) out.dialogues = seen.dialogues.splice(0);
  if (seen.messages.length) out.messages = seen.messages.splice(0);
  if (app.url() !== frameBefore) out.cadre = { avant: frameBefore.replace(/^.*\/g-capacites\//, ''), apres: app.url().replace(/^.*\/g-capacites\//, '') };
  if (arrival) out.reponseDeGfs = arrival;
  return out;
}

async function openProbe() {
  if (alone) {
    const browser = await chromium.launch({ args: ['--no-sandbox'] });
    const context = await browser.newContext({ viewport: { width: 900, height: 700 } });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const page = await context.newPage();
    await page.goto(PROBE);
    return { browser, page, context, app: page.mainFrame() };
  }
  if (config === 'grist') {
    const lab = await startLab({ lang: 'fr', widget: PROBE, fullAccess: false });
    await lab.context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await lab.fitPanel(undefined, 700, 400);
    return { browser: lab.browser, page: lab.page, context: lab.context, app: lab.frame };
  }
  const lab = await startLab({ lang: 'fr', probes: true, frameAttributes: CONFIGS[config], patches: PATCHES[config] || [], ordinaryFrame: process.env.CAP_ORDINAIRE === '1' });
  // Sans cette permission au niveau du navigateur, un navigateur sans écran refuse le presse-papiers même à la page de plus haut niveau : on mesure ce que les cadres laissent passer.
  await lab.context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await lab.fitPanel(undefined, 700, 400);
  const app = await lab.openApp('sonde-g', /g-capacites\//);
  await lab.page.waitForTimeout(1200);
  return { browser: lab.browser, page: lab.page, context: lab.context, app };
}

async function session(names) {
  const { browser, page, context, app } = await openProbe();
  const { seen } = observe(page, context);
  if (!alone) {
    const attributes = await (await app.frameElement()).evaluate(el => ({ sandbox: el.getAttribute('sandbox'), allow: el.getAttribute('allow') }));
    // Le cadre que Grist donne à GFS (le parent du sous-cadre) : son `allow` borne ce que GFS peut passer à l'app.
    const gristFrame = await app.parentFrame()?.frameElement().then(el => el.evaluate(node => node.getAttribute('allow')), () => null);
    say('attributs du sous-cadre :', gristFrame === undefined || gristFrame === null ? attributes : { ...attributes, allowDuCadreDeGrist: gristFrame });
  }
  for (const name of names) say(await runOne(app, name, seen));
  await browser.close();
}

say(`=== sonde G, ${alone ? 'seule dans une page ordinaire' : config === 'grist' ? 'widget de Grist, sans GFS' : `sous GFS, configuration « ${config} »`}, essais « ${set} » ===`);
if (set === 'nav') for (const name of wanted(NAV)) await session([name]);
else await session(wanted(MAIN));
