// Le squelette de l'explorateur (27/11, choix du porteur après la mesure de fluidité ; index.html `#boot`, css/gfs.css `.boot`, js/shell/boot-skeleton.js ; faits vérifiés 197),
// dans un VRAI serveur Grist (Docker 1.7.19, `vrai-serveur.sh`) derrière un relais de latence (`ONE_WAY_MS`, 20 = 40 ms d'aller-retour, 60 = 120 ms), sous Chromium, à 700 × 400.
//   1. Le squelette est dans la page avant l'explorateur : sa première image (deux `requestAnimationFrame` après son insertion) vient avant celle de l'explorateur et avant la
//      première ligne de la liste, de LAB_RUNS rechargements (médianes ; les temps se comptent depuis la création du cadre de GFS). Avant, le cadre restait blanc jusque-là.
//   2. Le squelette tenu à l'écran (le démarrage est retenu un instant, `lab.hold`) : caché des lecteurs d'écran, sans texte, des barres de gris sur la grille de l'explorateur
//      (clair ou sombre : LAB_SCHEME), capture dans `labo/shots/`.
//   3. Une fois GFS prêt, le squelette n'est plus dans la page, un seul explorateur est montré, et son en-tête, son volet, sa liste et son pied tombent à 2 px près là où le
//      squelette les avait mis (rien ne saute au remplacement).
//   4. Aucune erreur ni avertissement de GFS dans la console.
// Le relais : `ONE_WAY_MS=20 node /mnt/project-files/gfs/audits/fluidite-2026-11-27/banc/delai-grist.mjs` (Grist sur 8485 avec APP_HOME_URL=http://127.0.0.1:8484, relais sur 8484).
//   REPO_DIR="$(realpath ../..)" LAB_RUNS=5 LAB_SCHEME=light|dark node run-squelette.mjs
import { createServer } from 'node:http';
import { join } from 'node:path';
import { serve } from './lab-server.mjs';
import { chromium, say, check, SHOTS } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { PAGE_PORT, openGfs } from './lab-pdf.mjs';
import { seedFiles } from './seed.mjs';

const RUNS = Number(process.env.LAB_RUNS || 5);
const scheme = process.env.LAB_SCHEME || 'light';
const lang = process.env.LAB_LANG || 'fr';
const median = list => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];

// Retient le démarrage tant que `lab.hold` est posé dans le stockage de l'onglet (le squelette reste à l'écran) : le cadre a déjà dit « prêt » à Grist.
const hold = [{ fichier: 'controller.js', de: 'await this.state.whenOptions();',
  vers: "await this.state.whenOptions();\n    if (sessionStorage.getItem('lab.hold') === '1') await new Promise(resolve => { globalThis.__hold = resolve; });" }];

// Dans chaque cadre de GFS : l'heure (depuis la création du cadre) de la première image du squelette, de l'explorateur et de la première ligne.
const timing = () => {
  if (!/\/prototype\/index\.html$/.test(location.pathname) || !/access=full/.test(location.search)) return;
  const t = (window.__timing = {});
  const watch = () => {
    if (document.getElementById('boot') && t.boot === undefined) {
      t.boot = -1;
      requestAnimationFrame(() => requestAnimationFrame(() => { t.boot = performance.now(); }));
    }
    if (t.explorer === undefined && document.querySelector('.ex:not(.boot):not([hidden])')) t.explorer = performance.now();
    if (t.rows === undefined && document.querySelector('.ls-row')) t.rows = performance.now();
  };
  new MutationObserver(watch).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
};

const gfsFrame = page => page.frames().find(each => /prototype\/index\.html/.test(each.url()) && /access=full/.test(each.url()));
async function frameOf(run) {
  let frame = null;
  for (let i = 0; i < 120 && !frame; i++) { frame = gfsFrame(run.page); if (!frame) await run.page.waitForTimeout(250); }
  return frame;
}
const rects = frame => frame.evaluate(() => {
  const box = node => { if (!node) return null; const r = node.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  const root = document.querySelector('.ex:not(.boot)') || document.getElementById('boot');
  return { head: box(root.querySelector('.ex-head')), tree: box(root.querySelector('.ex-tree')), main: box(root.querySelector('.ex-main')), foot: box(root.querySelector('.ex-foot')),
    row: box(root.querySelector('.boot-row:not(.boot-th), .ls-row')) };
});

const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, server, { colorScheme: scheme });
  const run = await openGfs(context, { lang, mirrors: true, patches: hold });
  const { page } = run;
  await page.addInitScript(timing);
  await seedFiles(run.frame, {});

  say('--- 1. la première image du squelette, avant l\'explorateur ---');
  const boots = []; const explorers = []; const rows = [];
  for (let i = 0; i < RUNS + 1; i++) {
    await page.reload({ waitUntil: 'load' });
    const frame = await frameOf(run);
    await frame.waitForFunction(() => window.__timing && window.__timing.rows !== undefined, null, { timeout: 60000 });
    const t = await frame.evaluate(() => window.__timing);
    if (i > 0) { boots.push(t.boot); explorers.push(t.explorer); rows.push(t.rows); } // le premier passage chauffe le cache
  }
  say(`squelette ${boots.map(Math.round).join(', ')} ms ; explorateur ${explorers.map(Math.round).join(', ')} ms ; première ligne ${rows.map(Math.round).join(', ')} ms`);
  const [bootAt, explorerAt, rowsAt] = [median(boots), median(explorers), median(rows)];
  check('le squelette a une première image à chaque rechargement', boots.every(each => each > 0), boots);
  check('elle vient avant celle de l\'explorateur (médianes)', bootAt < explorerAt, `${Math.round(bootAt)} ms contre ${Math.round(explorerAt)} ms`);
  say(`le cadre n'est plus blanc ${Math.round(explorerAt - bootAt)} ms plus tôt (squelette ${Math.round(bootAt)} ms, explorateur ${Math.round(explorerAt)} ms, première ligne ${Math.round(rowsAt)} ms)`);

  say('--- 2. le squelette tenu à l\'écran ---');
  let frame = gfsFrame(page);
  await frame.evaluate(() => sessionStorage.setItem('lab.hold', '1'));
  await page.reload({ waitUntil: 'load' });
  frame = await frameOf(run);
  await frame.waitForFunction(() => typeof globalThis.__hold === 'function', null, { timeout: 60000 });
  await page.waitForTimeout(400);
  const seen = await frame.evaluate(() => {
    const boot = document.getElementById('boot');
    const bar = boot.querySelector('.boot-bar');
    return { hidden: boot.getAttribute('aria-hidden'), text: boot.textContent.trim(), bars: boot.querySelectorAll('.boot-bar').length, rows: boot.querySelectorAll('.boot-row').length,
      inline: boot.querySelectorAll('[style]').length, focusable: boot.querySelectorAll('button, input, a, [tabindex]').length, shown: boot.getBoundingClientRect().width > 0,
      barBackground: getComputedStyle(bar).backgroundColor, pageBackground: getComputedStyle(boot.querySelector('.ex-head')).backgroundColor,
      realExplorer: document.querySelectorAll('.ex:not(.boot):not([hidden])').length };
  });
  check('le squelette est là, caché des lecteurs d\'écran, sans texte, sans style en ligne, rien de focalisable', seen.hidden === 'true' && seen.text === '' && seen.inline === 0 && seen.focusable === 0 && seen.shown, seen);
  check('des barres de gris sur la grille : de quoi remplir 400 px de haut, aucun explorateur encore', seen.bars >= 20 && seen.rows >= 8 && seen.realExplorer === 0, seen);
  check('les barres se voient sur l\'en-tête (deux couleurs différentes)', seen.barBackground !== seen.pageBackground && seen.barBackground !== 'rgba(0, 0, 0, 0)', { barre: seen.barBackground, en_tete: seen.pageBackground });
  const element = await frame.frameElement();
  await element.screenshot({ path: join(SHOTS, `squelette-${lang}-${scheme}.png`) });
  const before = await rects(frame);

  say('--- 3. le remplacement ---');
  await frame.evaluate(() => { sessionStorage.removeItem('lab.hold'); globalThis.__hold(); });
  await frame.waitForFunction(() => document.body.dataset.gfs === 'ready' && document.body.dataset.gfsFirstRun === 'done', null, { timeout: 60000 });
  await frame.waitForFunction(() => document.querySelector('.ls-row'), null, { timeout: 30000 });
  await page.waitForTimeout(500);
  const gone = await frame.evaluate(() => ({ skeleton: !!document.getElementById('boot'), explorers: document.querySelectorAll('.ex:not([hidden])').length }));
  check('le squelette n\'est plus dans la page, un seul explorateur est montré', !gone.skeleton && gone.explorers === 1, gone);
  const after = await rects(frame);
  const near = (a, b) => a && b && ['x', 'y', 'w', 'h'].every(key => Math.abs(a[key] - b[key]) <= 2);
  for (const key of ['head', 'tree', 'main', 'foot']) check(`${key} : le squelette et l'explorateur tombent au même endroit, à 2 px près`, near(before[key], after[key]), { squelette: before[key], explorateur: after[key] });
  check('une ligne du squelette a la hauteur d\'une ligne de la liste', before.row && after.row && before.row.h === after.row.h, { squelette: before.row, liste: after.row });

  say('--- 4. la console ---');
  const unexpected = run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
  check('aucune erreur ni avertissement inattendu de GFS', unexpected.length === 0, unexpected);
} finally {
  await browser.close();
  pages.close();
}
