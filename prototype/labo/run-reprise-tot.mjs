// L'app lancée plus tôt après un rechargement (27/11, choix du porteur après la mesure de fluidité : « Les deux, plus l'app lancée plus tôt », lot 3 ; js/broker/resume-early.js, js/broker/resume.js ;
// faits vérifiés 199), dans un VRAI serveur Grist (Docker 1.7.19, `vrai-serveur.sh`) derrière un relais de latence (`ONE_WAY_MS`, 20 = 40 ms d'aller-retour, 60 = 120 ms), avec la vraie GFS et la vraie
// Publipostage+, sous Chromium, à 700 × 400. Deux pages du même document sont comparées, rechargées tour à tour : la page « tôt » (GFS telle qu'elle est) et la page « témoin » (la même GFS dont le seul écart
// est que l'app ne part qu'après la liste, comme avant le lot ; un remplacement de `resume.js` pour cet essai seulement) :
//   1. avec un fichier ouvert, la page rechargée : l'app part AVANT la fin de la lecture de la liste (tôt) ou APRÈS (témoin) ; le modèle est montré plus tôt ; un seul cadre d'app, un seul fichier dans
//      « Ouverts », l'explorateur fermé, aucune phrase ;
//   2. fichier supprimé : l'app lancée tôt est refermée, l'explorateur est ouvert avec la phrase, aucun cadre d'app ne reste, « Ouverts » est vide ;
//   3. souvenir d'une autre personne : l'app lancée tôt est refermée, l'explorateur à la racine, sans phrase ;
//   4. souvenir d'avant le lot (sans app, numéro ni type) : rien ne part tôt, le fichier s'ouvre après la liste, comme avant ;
//   5. la console de GFS muette.
// Le relais : `ONE_WAY_MS=20 node /mnt/project-files/gfs/audits/fluidite-2026-11-27/banc/delai-grist.mjs` (Grist sur 8485 avec APP_HOME_URL=http://127.0.0.1:8484, relais sur 8484).
//   REPO_DIR="$(realpath ../..)" LAB_RUNS=5 LAB_LANG=fr|en node run-reprise-tot.mjs
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { seedFiles } from './seed.mjs';
import { PAGE_PORT, GFS, openGfs, rowOf, waitFor } from './lab-pdf.mjs';

const RUNS = Number(process.env.LAB_RUNS || 5);
const lang = process.env.LAB_LANG || 'fr';
const APP_URL = `http://127.0.0.1:${PAGE_PORT}/prototype/apps/publipostage/`;
const CONTRACT = { id: '16', name: 'Contrat de prestation' };
const RECEIPT = { id: '17', name: 'Quittance de loyer' };
const GONE = { fr: /n’existe plus, ou n’est plus à votre disposition/, en: /no longer exists, or is no longer available to you/ }[lang];
const now = () => performance.now();
const median = list => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];

// Le labo seul : le contrôleur de GFS sur `window`, l'heure à laquelle la liste est lue (`__listAt`) ; le témoin ne lance rien avant elle.
const EXPOSE = { fichier: 'gfs.js', de: 'controller.start().catch(', vers: 'window.__gfs = controller;\ncontroller.start().catch(' };
const STAMP = { fichier: 'broker/resume.js', de: 'await c.refreshFiles({ quiet: true });', vers: 'await c.refreshFiles({ quiet: true });\n      window.__listAt = performance.now();' };
const LATE = { fichier: 'broker/resume.js', de: 'const early = target ? startEarly(c, target) : null;', vers: 'const early = null;' };
const PATCHES = { tot: [EXPOSE, STAMP], temoin: [EXPOSE, STAMP, LATE] };

// Dans le cadre de GFS : l'heure (depuis sa création) à laquelle un cadre d'app apparaît pour la première fois.
const watchApp = () => {
  if (!/\/prototype\/index\.html$/.test(location.pathname) || !/access=full/.test(location.search)) return;
  const watch = () => { if (window.__appAt === undefined && document.querySelector('iframe[src*="/apps/"]')) window.__appAt = performance.now(); };
  new MutationObserver(watch).observe(document, { childList: true, subtree: true });
};

const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const gfsFrame = async page => {
  for (let i = 0; i < 120; i++) {
    const frame = page.frames().find(each => each.url().startsWith(GFS) && /access=full/.test(each.url()) && !each.isDetached());
    if (frame) return frame;
    await page.waitForTimeout(250);
  }
  return null;
};
const appFrames = page => page.frames().filter(each => each.url().startsWith(APP_URL) && !each.isDetached());
const shown = async page => { const [frame] = appFrames(page); return frame ? frame.evaluate(() => String(Templates.getCurrentId())).catch(() => null) : null; };
const ready = frame => frame.waitForFunction(() => Boolean(document.body) && document.body.dataset.gfs === 'ready', null, { timeout: 60000 });
const where = frame => frame.evaluate(() => ({
  open: window.__gfs.explorer.isOpen, path: window.__gfs.explorer.state.path, session: window.__gfs.session ? window.__gfs.session.id : null, opened: window.__gfs.opened.keys(),
  toast: (document.getElementById('toast') || {}).textContent || '', toastShown: Boolean(document.getElementById('toast') && document.getElementById('toast').offsetParent),
  appAt: window.__appAt === undefined ? null : Math.round(window.__appAt), listAt: window.__listAt === undefined ? null : Math.round(window.__listAt),
}));
const slotKey = frame => frame.evaluate(() => Object.keys(sessionStorage).find(each => each.startsWith('gfs.rouvrir.')));
const memory = frame => frame.evaluate(() => { const key = Object.keys(sessionStorage).find(each => each.startsWith('gfs.rouvrir.')); return key ? JSON.parse(sessionStorage.getItem(key)) : null; });
const putMemory = (frame, value) => frame.evaluate(text => { const key = Object.keys(sessionStorage).find(each => each.startsWith('gfs.rouvrir.')); sessionStorage.setItem(key, text); }, JSON.stringify(value));
const reload = async page => { await page.reload({ waitUntil: 'load' }); const frame = await gfsFrame(page); await ready(frame); return frame; };

// Un rechargement : rend le temps (depuis la demande de rechargement) où l'app montre le fichier attendu, et l'état de GFS ensuite.
async function reloadUntilShown(run, file, ms = 90000) {
  const t0 = now();
  await run.page.reload({ waitUntil: 'load' });
  const frame = await gfsFrame(run.page);
  run.frame = frame;
  let at = null;
  while (now() - t0 < ms) { if ((await shown(run.page)) === file.id) { at = now() - t0; break; } await run.page.waitForTimeout(20); }
  await ready(frame);
  await run.page.waitForTimeout(400);
  return { at, state: await where(frame), apps: appFrames(run.page).length };
}

try {
  const runs = {};
  for (const name of ['tot', 'temoin']) {
    const context = await newContext(browser, server, { colorScheme: 'light' });
    const run = await openGfs(context, { lang, mirrors: true, patches: PATCHES[name] });
    await run.page.addInitScript(watchApp);
    run.apply = actions => run.page.evaluate(async ([id, body]) => (await fetch(`/api/docs/${id}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).status, [run.docId, actions]);
    await seedFiles(run.frame);
    run.frame = await reload(run.page);
    await waitFor(run.page, 'la liste montre des fichiers', async () => (await run.frame.locator('.ls-row').count()) >= 3, 30000);
    await rowOf(run.frame, CONTRACT.name).dblclick();
    await waitFor(run.page, 'PP montre le contrat', async () => (await shown(run.page)) === CONTRACT.id, 90000);
    await run.page.waitForTimeout(600);
    runs[name] = run;
  }

  say('--- 1. un fichier ouvert, la page rechargée : l\'app part avant la fin de la liste, le modèle est montré plus tôt ---');
  const times = { tot: [], temoin: [] }; const last = {};
  for (let i = 0; i < RUNS + 1; i++) {
    for (const name of ['tot', 'temoin']) {
      const result = await reloadUntilShown(runs[name], CONTRACT);
      last[name] = result;
      if (i > 0 && result.at !== null) times[name].push(result.at); // le premier passage chauffe le cache
    }
  }
  say(`modèle montré : tôt ${times.tot.map(Math.round).join(', ')} ms ; témoin ${times.temoin.map(Math.round).join(', ')} ms`);
  const [early, late] = [median(times.tot), median(times.temoin)];
  say(`médianes : tôt ${Math.round(early)} ms, témoin ${Math.round(late)} ms ; gain ${Math.round(late - early)} ms`);
  check('le modèle est montré à chaque rechargement, dans les deux pages', times.tot.length === RUNS && times.temoin.length === RUNS, { tot: times.tot.length, temoin: times.temoin.length });
  check('l\'app lancée tôt montre le modèle plus tôt que l\'app lancée après la liste (médianes)', early < late, `${Math.round(early)} ms contre ${Math.round(late)} ms`);
  check('page « tôt » : le cadre de l\'app existe AVANT la fin de la lecture de la liste', last.tot.state.appAt !== null && last.tot.state.listAt !== null && last.tot.state.appAt < last.tot.state.listAt, last.tot.state);
  check('page « témoin » : le cadre de l\'app n\'existe qu\'APRÈS la lecture de la liste', last.temoin.state.appAt !== null && last.temoin.state.listAt !== null && last.temoin.state.appAt > last.temoin.state.listAt, last.temoin.state);
  for (const name of ['tot', 'temoin']) {
    const { state, apps } = last[name];
    check(`${name} : un seul cadre d'app, un seul fichier dans « Ouverts », l'explorateur fermé, aucune phrase`, apps === 1 && state.opened.length === 1 && state.opened[0] === `publipostage:${CONTRACT.id}` && !state.open && !state.toastShown && state.session === 'publipostage', { apps, ...state });
  }

  const run = runs.tot;
  say('--- 2. un fichier supprimé : l\'app lancée tôt est refermée, l\'explorateur dit pourquoi ---');
  await run.frame.locator('#floater-files').click();
  await run.frame.locator('.ls-row').first().waitFor();
  await rowOf(run.frame, RECEIPT.name).dblclick();
  check('« Quittance de loyer » est ouverte dans l\'app', await waitFor(run.page, 'PP montre la quittance', async () => (await shown(run.page)) === RECEIPT.id, 90000));
  await run.page.waitForTimeout(600);
  const stored = await memory(run.frame);
  check('le souvenir dit l\'app, le numéro et le type du fichier', stored.app === 'publipostage' && String(stored.id) === RECEIPT.id && typeof stored.type === 'string' && stored.type !== '', stored);
  check('la ligne est retirée par l\'API', (await run.apply([['RemoveRecord', 'Publipostage_Modeles', Number(RECEIPT.id)]])) === 200);
  run.frame = await reload(run.page);
  await waitFor(run.page, 'la liste est là', async () => (await run.frame.locator('.ls-row').count()) >= 1, 30000);
  await run.page.waitForTimeout(500);
  const gone = await where(run.frame);
  check('l\'app a bien été lancée tôt (son cadre est apparu avant la liste)', gone.appAt !== null && gone.listAt !== null && gone.appAt < gone.listAt, gone);
  check('puis refermée : l\'explorateur est ouvert, aucune app, aucun cadre, « Ouverts » est vide', gone.open && gone.session === null && appFrames(run.page).length === 0 && gone.opened.length === 0, { ...gone, cadres: appFrames(run.page).length });
  check(`la phrase dit pourquoi : « ${GONE} »`, GONE.test(gone.toast) && gone.toast.includes(RECEIPT.name), gone.toast);

  say('--- 3. le souvenir d\'une autre personne : l\'app lancée tôt est refermée, sans phrase ---');
  await rowOf(run.frame, CONTRACT.name).dblclick();
  check('le contrat est ouvert dans l\'app', await waitFor(run.page, 'PP montre le contrat', async () => (await shown(run.page)) === CONTRACT.id, 90000));
  await run.page.waitForTimeout(600);
  await putMemory(run.frame, { ...(await memory(run.frame)), who: 'autre@example.com' });
  run.frame = await reload(run.page);
  await waitFor(run.page, 'la liste est là', async () => (await run.frame.locator('.ls-row').count()) >= 1, 30000);
  await run.page.waitForTimeout(500);
  const other = await where(run.frame);
  check('l\'app a été lancée tôt, puis refermée : l\'explorateur à la racine, aucun cadre, rien dans « Ouverts », aucune phrase', other.appAt !== null && other.open && other.path === '' && other.session === null
    && appFrames(run.page).length === 0 && other.opened.length === 0 && !other.toastShown, { ...other, cadres: appFrames(run.page).length });

  say('--- 4. le souvenir d\'avant le lot : rien ne part tôt ---');
  await rowOf(run.frame, CONTRACT.name).dblclick();
  check('le contrat est ouvert dans l\'app', await waitFor(run.page, 'PP montre le contrat', async () => (await shown(run.page)) === CONTRACT.id, 90000));
  await run.page.waitForTimeout(600);
  const { app, id, type, ...old } = await memory(run.frame);
  await putMemory(run.frame, old);
  const oldWay = await reloadUntilShown(run, CONTRACT);
  check('le fichier s\'ouvre quand même, après la liste, comme avant', oldWay.at !== null && oldWay.state.appAt > oldWay.state.listAt && oldWay.apps === 1 && oldWay.state.opened.length === 1, { ...oldWay.state, cadres: oldWay.apps });

  say('--- 5. la console ---');
  for (const name of ['tot', 'temoin']) {
    const unexpected = runs[name].problems.filter(problem => !runs[name].allow.some(known => known.test(problem)));
    check(`${name} : aucune erreur ni avertissement inattendu de GFS`, unexpected.length === 0, unexpected);
  }
} finally {
  await browser.close();
  pages.close();
}
