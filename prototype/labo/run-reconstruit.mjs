// Le cadre reconstruit (contrats 3.1 point 6 et 9 point 10) dans un vrai Grist : la personne change le niveau d'accès de la section dans le panneau de droite de
// Grist, de « Full document access » à « Read selected table », puis revient. Grist reconstruit le cadre du widget avec la nouvelle adresse (`access=…`). On relève :
// ce qui disparaît (le document de GFS, le cadre de l'app), ce qui reste (les apps installées, retenues dans la table du document, et les tables de l'app),
// ce que GFS dit à la personne, le temps.
//
//   RECO_APP=publipostage|sonde-g   l'app ouverte avant le changement (Publipostage+ par défaut : le vrai code, ses tables)
//   LAB_LANG=fr|en
import { startLab } from './lab-setup.mjs';
import { say, check, engineName } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const appId = process.env.RECO_APP || 'publipostage';
const appPattern = appId === 'publipostage' ? /apps\/publipostage\// : /labo\/sondes\//;
const run = `reconstruit-${lang}`;
const lab = await startLab({ lang, probes: true });
const { page } = lab;
await lab.fitPanel(undefined, 700, 400);
let frame = lab.frame;

const levelOf = f => (/access=([^&]+)/.exec(f.url()) || [])[1];
const text = async locator => (await locator.innerText()).replace(/\s+/g, ' ').trim();
const tables = f => f.evaluate(async () => (await grist.docApi.listTables()).slice().sort());
// Les apps installées : la ligne réservée de la table `GFS_Rangement` (null tant qu'aucune app n'a été installée). Sous « read table », Grist refuse la lecture.
const option = async f => (await lab.rangement(f)).value ?? null;
const facts = async f => f.evaluate(() => ({
  etat: document.body.dataset.gfs,
  explorateurVisible: !document.querySelector('.ex').hidden,
  cadresDApp: document.querySelectorAll('.app-frame').length,
  statut: (document.getElementById('status').hidden ? '' : document.getElementById('status').textContent).trim().slice(0, 160),
  marque: window.__marque || null,
}));

// Le niveau d'accès, dans le panneau de droite de Grist (le geste de la personne : la vraie souris sur la liste).
// Rend l'instant du clic sur le nouveau niveau (le temps se compte à partir de là).
async function chooseAccess(from, to) {
  await page.locator('.test-right-panel').getByText(from, { exact: true }).first().click();
  await page.waitForTimeout(300);
  const clicked = Date.now();
  await page.getByText(to, { exact: true }).last().click();
  return clicked;
}
async function rebuilt(accessRegex, label, clicked) {
  const next = await lab.gfsFrame(accessRegex);
  const found = Date.now();
  await next.waitForFunction(() => Boolean(document.body) && document.body.dataset.gfs === 'ready', null, { timeout: 60000 }).catch(() => {});
  const ready = Date.now();
  say(`${label} : cadre reconstruit ${found - clicked} ms après le clic, GFS prêt ${ready - clicked} ms après`);
  await page.waitForTimeout(800);
  return next;
}

// ----- Avant : GFS à l'accès complet, une app ouverte.
await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
const app = await lab.openApp(appId, appPattern);
await page.waitForTimeout(appId === 'publipostage' ? 7000 : 1500);
const tablesBefore = await tables(frame);
const optionBefore = await option(frame);
await frame.evaluate(() => { window.__marque = 'avant'; });
await app.evaluate(() => { window.__marque = 'avant'; });
say('avant :', { acces: levelOf(frame), gfs: await facts(frame), tables: tablesBefore.length, reglage: optionBefore });
await lab.shot(run, '1-page-grist-avant');

// ----- Le niveau baisse : « Read selected table ».
const downAt = await chooseAccess('Full document access', 'Read selected table');
frame = await rebuilt(/access=read/, 'accès « read table »', downAt);
const low = await facts(frame);
say('après (read table) :', { acces: levelOf(frame), gfs: low });
check('le cadre de GFS est un document neuf (la marque posée avant a disparu)', low.marque === null, low);
check('l\'app ouverte n\'est plus là : GFS repart de zéro, avec ses sous-cadres', low.cadresDApp === 0, low);
await lab.shot(run, '2-page-grist-read-table');
await lab.shotPanel(run, '2-panneau-read-table', frame);
say('texte du panneau de GFS :', (await text(frame.locator('body'))).slice(0, 300));
let tablesLow = null;
try { tablesLow = await tables(frame); } catch (error) { tablesLow = `refus : ${String(error.message).slice(0, 100)}`; }
say('lecture des tables sous « read table » :', Array.isArray(tablesLow) ? `${tablesLow.length} table(s)` : tablesLow);
const optionLow = await option(frame).catch(error => `refus : ${String(error.message).slice(0, 100)}`);
say('lecture des apps installées sous « read table » :', typeof optionLow === 'string' ? optionLow : 'lisible');
await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
say('fenêtre « Apps » ouverte toute seule ?', await frame.locator('.mod').count() > 0);

// ----- Le niveau remonte : « Full document access ».
const upAt = await chooseAccess('Read selected table', 'Full document access');
frame = await rebuilt(/access=full/, 'accès « full »', upAt);
const high = await facts(frame);
say('après (full) :', { acces: levelOf(frame), gfs: high });
check('le cadre de GFS est encore un document neuf', high.marque === null, high);
const optionAfter = await option(frame);
check('les apps installées (retenues dans la table du document) survivent à la reconstruction', JSON.stringify(optionAfter) === JSON.stringify(optionBefore), { avant: optionBefore, apres: optionAfter });
const tablesAfter = await tables(frame);
check('aucune table de l\'app perdue ni créée en double', JSON.stringify(tablesAfter) === JSON.stringify(tablesBefore), { avant: tablesBefore, apres: tablesAfter });
const reopenedAt = Date.now();
const reopened = await lab.openApp(appId, appPattern, frame);
await page.waitForTimeout(appId === 'publipostage' ? 7000 : 1500);
check('l\'app se rouvre', Boolean(reopened) && (await frame.evaluate(() => document.querySelectorAll('.app-frame').length)) === 1, `${Date.now() - reopenedAt} ms`);
const tablesFinal = await tables(frame);
check('rouverte, l\'app ne recrée aucune table', JSON.stringify(tablesFinal) === JSON.stringify(tablesBefore), { avant: tablesBefore.length, apres: tablesFinal.length });
await lab.shot(run, '3-page-grist-apres');
await lab.browser.close();
say(`(${engineName})`);
