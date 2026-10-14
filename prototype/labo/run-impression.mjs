// L'impression (contrats 4.3 et 9, point 3) dans un vrai Grist : la personne choisit « Print widget » dans le menu de la section. Grist appelle alors `print` sur le widget,
// c'est-à-dire sur GFS. Le script d'API de GFS en a enregistré un qui imprime la page de GFS ; GFS le remplace par un relais vers l'app active. On relève, dans chaque cadre,
// les événements `beforeprint` et `afterprint` que le navigateur lui envoie (un navigateur sans écran n'ouvre pas la boîte d'impression, mais les envoie).
//
//   sans app          GFS imprime sa propre page (l'explorateur) ;
//   sonde H           une app qui charge le vrai script d'API de Grist, donc a sa fonction `print` : c'est elle qui doit imprimer, pas GFS ;
//   sonde G           une app qui n'en a pas (elle parle au courtier à la main) : on relève ce que la personne voit, sans attente fixée.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';

const CASES = [
  { nom: 'sans app', app: null, attendu: 'gfs' },
  { nom: 'sonde H (a sa fonction print)', app: ['sonde-h', /h-courtier\//], attendu: 'app' },
  { nom: 'sonde G (sans fonction print)', app: ['sonde-g', /g-capacites\//], attendu: null },
];

const listen = frame => frame.evaluate(() => {
  window.__imp = [];
  for (const type of ['beforeprint', 'afterprint']) window.addEventListener(type, () => window.__imp.push({ type, t: Date.now() }));
});
const heard = frame => frame.evaluate(() => window.__imp.slice());
const types = list => list.map(item => item.type);

// Le geste de la personne : le menu de la section de GFS, puis « Print widget ».
async function printWidget(page) {
  const section = page.locator('[class*="test-viewlayout-section-"]').filter({ has: page.locator('iframe') }).first();
  await section.hover();
  await section.locator('.test-section-menu-viewLayout').first().click();
  await page.getByText('Print widget', { exact: true }).click();
}

async function measure({ nom, app, attendu }) {
  say(`=== ${nom} ===`);
  const lab = await startLab({ lang: 'fr', probes: true });
  await lab.fitPanel(undefined, 700, 400);
  const { page, frame } = lab;
  await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
  const appFrame = app ? await lab.openApp(app[0], app[1]) : null;
  if (appFrame) await page.waitForTimeout(1500);
  await listen(frame);
  if (appFrame) await listen(appFrame);
  const clicked = Date.now();
  await printWidget(page);
  // Le relais attend l'app au plus 10 s : on laisse passer ce délai avant de conclure à l'absence de réponse.
  await page.waitForTimeout(app && attendu === null ? 11000 : 1500);
  const raw = { gfs: await heard(frame), app: appFrame ? await heard(appFrame) : null };
  const first = list => (list && list.length ? `${list[0].t - clicked} ms après le clic` : 'jamais');
  const result = { gfs: types(raw.gfs), app: raw.app && types(raw.app), premierPourGfs: first(raw.gfs), premierPourLApp: first(raw.app), bandeau: (await frame.locator('#toast').textContent().catch(() => '')).trim().slice(0, 120) };
  say('événements d\'impression reçus :', result);
  if (attendu === 'gfs') check('sans app, GFS imprime sa propre page', result.gfs.includes('beforeprint'), result);
  if (attendu === 'app') {
    check('l\'app active imprime (elle reçoit l\'événement)', result.app.includes('beforeprint'), result);
    check('GFS n\'imprime pas sa propre page', !result.gfs.includes('beforeprint'), result);
  }
  if (attendu === null) say(`MESURE : ${result.app.includes('beforeprint') ? 'l\'app a imprimé' : 'l\'app n\'a pas imprimé'}, ${result.gfs.includes('beforeprint') ? 'GFS a imprimé sa page' : 'GFS n\'a pas imprimé sa page'}`);
  await lab.browser.close();
}

for (const item of CASES) await measure(item);
