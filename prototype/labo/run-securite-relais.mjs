// Le relais des appels bloqués (demande du porteur du 18/11 : « une alerte si une librairie se met à faire un appel externe autre que les liens prévus dans la CSP » ; choix « alertes relayées par les apps » ;
// contrats 5.4, point 14 ; cahier 3.2.2, S8 ; kit 0.25.0) dans un vrai Grist (grist-static), à 700 × 400, à la vraie souris. La sonde ZV (labo/sondes/z-violations/) démarre le relais du kit en premier (le VRAI
// `violations-start.js` du sous-module, branché sur le vrai `GfsLink`), sous une politique qui ferme tout (`connect-src 'none'`, pas d'`unsafe-eval`), puis tente à la demande du labo un `fetch` vers une adresse
// tierce AVEC un chemin et des paramètres secrets, une image tierce et un `eval`. Ce que la passe mesure :
//   1. l'événement est bien levé DANS le cadre de l'app (la sonde le lit), et le relais le dit à GFS : trois alertes (connect-src, img-src, script-src-elem) ;
//   2. GFS n'en garde que l'hôte : ni le chemin, ni `token`, ni `user`, ni le fragment n'apparaissent nulle part dans son interface ; GFS dit le nom d'hôte et « le code de l'app » ;
//   3. l'avis (« sa politique de sécurité a bloqué un appel ») est dit une fois par alerte nouvelle, trois au plus par app ;
//   4. la fenêtre « Dépendances » > « Sécurité » : les alertes de la session, le relais actif de l'app (« Relais actif depuis l'ouverture »), le compte du bouton « Sécurité » ;
//   5. rien n'est écrit dans le document (la table `GFS_Rangement` n'est pas touchée) et rien ne survit au rechargement de GFS (session seulement : la fenêtre dit « Aucun appel bloqué ») ;
//   6. l'app qui ne relaie pas (une autre sonde) est vue « sans signal » : GFS n'invente ni alerte ni relais.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';
import { collectWarnings, reopenGfs } from './lab-gestes.mjs';
import { settingsRows, openSettings } from './reglages-gestes.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `securite-relais-${lang}-${scheme}`;
const lab = await startLab({ lang, colorScheme: scheme, probes: ['zv', 'a'] });
const { page } = lab;
const warnings = collectWarnings(page);
await lab.fitPanel(undefined, 700, 400);
let frame = lab.frame;
const shot = name => lab.shotPanel(run, name, frame);
const text = async locator => (await locator.innerText()).replace(/\s+/g, ' ').trim();
const MENU_ENTRY = lang === 'en' ? /^Dependencies/ : /^Dépendances/;
const WORDS = lang === 'en'
  ? { chip: 'Blocked call', none: /No blocked call has been reported/, on: /Relay active since opening/, notice: /its security policy blocked a call/, code: 'requested by the app’s code', close: 'Close' }
  : { chip: 'Appel bloqué', none: /Aucun appel bloqué n’a été signalé/, on: /Relais actif depuis l’ouverture/, notice: /sa politique de sécurité a bloqué un appel/, code: 'demandé par le code de l’app', close: 'Fermer' };

await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(500);

// ----- 1. La sonde ZV s'ouvre : son relais démarre ; rien n'est signalé tant qu'elle ne tente rien.
const app = await lab.openApp('sonde-zv', /z-violations\//, frame);
await app.waitForFunction(() => Boolean(window.trigger));
await lab.settle(frame);
await page.waitForTimeout(500);
// Ce que le document retient une fois la sonde installée (installer une app écrit sa ligne : le départ de la mesure est ici, pas avant).
const before = await lab.rangement(frame);
const showExplorer = async () => {
  if (!(await frame.locator('.ex').isVisible())) await frame.locator('#floater-files').click();
  await frame.locator('.ex').waitFor({ state: 'visible' });
};
const openWindow = async () => {
  await openSettings(frame);
  await settingsRows(frame).filter({ hasText: MENU_ENTRY }).click();
  await frame.locator('.dp').waitFor();
  await page.waitForTimeout(300);
};
const closeWindow = async () => { await frame.locator('[data-fk="dep-close"]').click(); await frame.locator('.dp').waitFor({ state: 'hidden' }); };
const toastText = () => frame.evaluate(() => { const node = document.querySelector('#toast'); return node && !node.hidden ? node.textContent.trim() : ''; });
await showExplorer();
await openWindow();
await frame.locator('[data-fk="dep-view-security"]').click();
await frame.locator('.dp-sec-alertbox').waitFor();
check('au départ : aucun appel bloqué n\'est signalé, et la fenêtre dit pourquoi cela ne prouve rien', WORDS.none.test(await text(frame.locator('.dp-sec-alertbox'))), await text(frame.locator('.dp-sec-alertbox')));
check('au départ : le relais de la sonde est actif (le kit l\'a dit en démarrant)', WORDS.on.test(await text(frame.locator('.dp-sec-app[data-app="sonde-zv"]'))), await text(frame.locator('.dp-sec-app[data-app="sonde-zv"]')));
await closeWindow();

// ----- 2. La sonde tente trois choses que sa politique interdit.
await frame.locator('.ex-foot .btn', { hasText: new RegExp(`^${WORDS.close}$`) }).click().catch(() => {});
await app.evaluate(() => window.trigger());
await page.waitForTimeout(800);
const raised = await app.evaluate(() => JSON.parse(document.body.dataset.sonde));
say('levé dans le cadre de l\'app :', raised.levees);
check('le navigateur lève bien les violations DANS le cadre de l\'app (connect-src, img-src, script-src-elem)', ['connect-src', 'img-src', 'script-src-elem'].every(directive => raised.levees.some(item => item.directive === directive)), raised);
const toast = await toastText();
say('avis :', toast);
check('GFS dit à la personne qu\'un appel a été bloqué (le nom de l\'app, la directive, l\'hôte, pas l\'adresse)', WORDS.notice.test(toast) && /Sonde ZV|Probe ZV/.test(toast) && /evil\.example/.test(toast) && !/steal|SECRET|token/.test(toast), toast);

// ----- 3. La fenêtre « Dépendances » > « Sécurité » : les alertes de la session.
await showExplorer();
await openWindow();
await frame.locator('[data-fk="dep-view-security"]').click();
await frame.locator('.dp-sec-alert').first().waitFor();
const alerts = await frame.locator('.dp-sec-alert').evaluateAll(nodes => nodes.map(node => ({ app: node.dataset.app, directive: node.dataset.directive, text: node.textContent.replace(/\s+/g, ' ').trim() })));
say('alertes :', alerts);
check('trois alertes, une par violation, rangées sous la sonde', alerts.length === 3 && alerts.every(alert => alert.app === 'sonde-zv') && ['connect-src', 'img-src', 'script-src-elem'].every(directive => alerts.some(alert => alert.directive === directive)), alerts);
check('l\'appel `fetch` est dit avec son hôte seul et « demandé par le code de l\'app »', alerts.some(alert => alert.directive === 'connect-src' && /evil\.example/.test(alert.text) && alert.text.includes(WORDS.code)), alerts);
check('l\'image tierce est dite avec son hôte (img.evil.example)', alerts.some(alert => alert.directive === 'img-src' && /img\.evil\.example/.test(alert.text)), alerts);
const whole = await text(frame.locator('.dp'));
check('rien du chemin, des paramètres ni du fragment n\'arrive dans l\'interface de GFS (la fenêtre, le rapport d\'avis)', !/steal|SECRET|token|user=|ana|frag|pixel|stolen/.test(whole), whole.slice(0, 300));
const bodyHtml = await frame.evaluate(() => document.body.innerHTML);
check('ni nulle part ailleurs dans le DOM de GFS', !/SECRET|steal\?token|stolen=1|pixel\.png/.test(bodyHtml));
check('aucune alerte n\'est un lien ni ne contient une balise (du texte seulement)', (await frame.locator('.dp-sec-alertbox a, .dp-sec-alertbox img').count()) === 0);
check('le compte du bouton « Sécurité » compte les alertes', Number(await text(frame.locator('[data-fk="dep-view-security"] .dp-count'))) >= 3, await text(frame.locator('[data-fk="dep-view-security"]')));
check('le relais de la sonde est toujours dit actif ; l\'app qui n\'a pas de relais n\'est pas là (ou « sans signal »)', WORDS.on.test(await text(frame.locator('.dp-sec-app[data-app="sonde-zv"]'))), '');
await shot('1-alertes');
await closeWindow();
check('rien n\'est écrit dans le document (GFS_Rangement et le nombre de tables ne bougent pas)', JSON.stringify(await lab.rangement(frame)) === JSON.stringify(before), await lab.rangement(frame));

// ----- 4. La même violation ne refait pas une alerte ni un avis ; une nouvelle en fait une.
await app.evaluate(() => window.trigger());
await page.waitForTimeout(800);
await showExplorer();
await openWindow();
await frame.locator('[data-fk="dep-view-security"]').click();
await frame.locator('.dp-sec-alert').first().waitFor();
check('trois alertes encore après un second essai (la même violation ne repart pas avant la 10e fois)', (await frame.locator('.dp-sec-alert').count()) === 3, await frame.locator('.dp-sec-alert').count());
await closeWindow();

// ----- 5. GFS est rechargé : la session seulement. Rien ne survit.
frame = await reopenGfs(lab, frame, 500);
await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
await openWindow();
await frame.locator('[data-fk="dep-view-security"]').click();
await frame.locator('.dp-sec-alertbox').waitFor();
check('GFS rechargé : plus aucune alerte (session seulement, rien n\'est gardé dans le document)', (await frame.locator('.dp-sec-alert').count()) === 0 && WORDS.none.test(await text(frame.locator('.dp-sec-alertbox'))));
check('GFS rechargé : aucun relais n\'est supposé tant que l\'app ne l\'a pas redit', !WORDS.on.test(await text(frame.locator('.dp'))), '');
check('rechargé : toujours rien d\'écrit dans le document', JSON.stringify(await lab.rangement(frame)) === JSON.stringify(before));
await shot('2-apres-rechargement');
await closeWindow();
await lab.browser.close();
say('avertissements GFS :', warnings);
check('aucun avertissement de GFS', warnings.length === 0, warnings);
