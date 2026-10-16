// Le coût d'un cadre de plus (cahier 9, point 8) dans un vrai Grist, au panneau de 700 × 400 : GFS seul avec son explorateur, puis le sous-cadre d'une app. On relève,
// avant et après l'ouverture : la mémoire JavaScript de la page, les nœuds du document, les documents et cadres vivants (Chrome DevTools, `Performance.getMetrics`), la
// mémoire résidente de tous les processus du navigateur (`ps`), le nombre de processus, et le temps entre le clic sur « Ouvrir » et le moment où l'app est montrée.
//
//   COUT_APP=sonde-g|publipostage   l'app ouverte (une sonde sans bibliothèque, ou le vrai Publipostage+)
// Chromium seulement (Chrome DevTools). Un lancement par mesure : le lancer plusieurs fois pour avoir la dispersion.
import { execSync } from 'node:child_process';
import { startLab } from './lab-setup.mjs';
import { say } from './lab-common.mjs';

const appId = process.env.COUT_APP || 'sonde-g';
const pattern = appId === 'publipostage' ? /apps\/publipostage\// : /labo\/sondes\//;
const lab = await startLab({ lang: 'fr', probes: true });
await lab.fitPanel(undefined, 700, 400);
const { page, frame } = lab;
await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});

const cdp = await lab.context.newCDPSession(page);
await cdp.send('Performance.enable');
const browserCdp = await lab.browser.newBrowserCDPSession();

// Les processus du navigateur de ce lancement : la racine est celle dont la ligne de commande porte le profil de Playwright et pas de `--type=`.
function processes() {
  const rows = execSync('ps -eo pid=,ppid=,rss=,args=', { encoding: 'utf8' }).split('\n').map(line => line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/)).filter(Boolean)
    .map(([, pid, ppid, rss, args]) => ({ pid: Number(pid), ppid: Number(ppid), rss: Number(rss), args }));
  const roots = rows.filter(row => /playwright_chromiumdev_profile/.test(row.args) && !/--type=/.test(row.args));
  const mine = new Set(roots.map(row => row.pid));
  let grown = true;
  while (grown) { grown = false; for (const row of rows) if (!mine.has(row.pid) && mine.has(row.ppid)) { mine.add(row.pid); grown = true; } }
  const list = rows.filter(row => mine.has(row.pid));
  return { nombre: list.length, rendus: list.filter(row => /--type=renderer/.test(row.args)).length, rssMo: Math.round(list.reduce((sum, row) => sum + row.rss, 0) / 1024) };
}

async function snapshot() {
  await cdp.send('HeapProfiler.enable').catch(() => {});
  await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
  await page.waitForTimeout(1500);
  const metrics = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(({ name, value }) => [name, value]));
  const targets = (await browserCdp.send('Target.getTargets')).targetInfos.map(info => info.type);
  const count = type => targets.filter(item => item === type).length;
  return {
    tasJsMo: Math.round(metrics.JSHeapUsedSize / 1048576 * 10) / 10, noeuds: metrics.Nodes, documents: metrics.Documents, cadres: metrics.Frames, ecouteurs: metrics.JSEventListeners,
    cibles: { pages: count('page'), cadresHorsProcessus: count('iframe') }, ...processes(),
  };
}

say(`=== coût d'un cadre de plus : ${appId}, panneau ${JSON.stringify(await (await frame.frameElement()).boundingBox().then(box => ({ l: box.width, h: box.height })))} ===`);
const before = await snapshot();
say('GFS seul :', before);

await lab.openModules();
await frame.locator(`[data-fk="app:${appId}"]`).check();
await lab.settle(); // la table du document naît avec l'accord de la personne (contrats 7.4) : on répond, puis on mesure
const clicked = Date.now();
await frame.locator(`[data-open="${appId}"]`).click();
await frame.waitForFunction(() => { const el = document.querySelector('.app-frame'); return Boolean(el) && !el.classList.contains('app-frame--hidden') && !el.classList.contains('app-frame--behind'); }, null, { timeout: 60000 });
const shown = Date.now() - clicked;
const app = await lab.appFrame(pattern);
const timing = await app.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0] || {};
  const resources = performance.getEntriesByType('resource');
  return { domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd || 0), loadMs: Math.round(nav.loadEventEnd || 0), ressources: resources.length, octetsDecodes: resources.reduce((sum, entry) => sum + (entry.decodedBodySize || 0), 0) };
}).catch(error => ({ erreur: String(error.message).slice(0, 80) }));
say(`l'app est montrée ${shown} ms après le clic sur « Ouvrir » ; dans le cadre :`, timing);
// Publipostage+ continue de s'installer un moment après son premier affichage : on laisse passer ses chargements avant de mesurer.
await page.waitForTimeout(appId === 'publipostage' ? 6000 : 1000);
const after = await snapshot();
say('GFS + app :', after);
say('différence :', {
  tasJsMo: Math.round((after.tasJsMo - before.tasJsMo) * 10) / 10, noeuds: after.noeuds - before.noeuds, documents: after.documents - before.documents, cadres: after.cadres - before.cadres,
  ecouteurs: after.ecouteurs - before.ecouteurs, processus: after.nombre - before.nombre, rendus: after.rendus - before.rendus, rssMo: after.rssMo - before.rssMo,
});
await lab.shotPanel(`cout-${appId}`, 'app-ouverte', frame);
await lab.browser.close();
