// L'ambiance de GFS avec les VRAIES apps (Form+ et Automation+, les versions que GFS référence), dans un vrai Grist (grist-static), à 700 × 400, à la vraie souris : le rejeu que le « Fait quand »
// des consignes d'ambiance promet (Form+ 016, Automation+ 006 ; contrats 5.2, point 10 ; guide des apps, règle 15), avec l'app à la place de la sonde N de run-ambiance-kit.mjs. Ce que la passe mesure :
//   1. le départ : rien n'est choisi, l'app a ses couleurs, aucun jeton du kit posé (l'app est hébergée : `gfs=<n>` dans son adresse) ;
//   2. dans chaque écran de l'app (ecrans-apps.mjs : ceux où passe une personne) et dans les quatre ambiances, en clair et en sombre : le kit a posé les dix-neuf jetons de couleur du mode que l'app
//      affiche, tels que GFS les calcule (`ambiancePalette`), et les jetons de forme ; le fond de la page est `--bg` ; chaque texte de l'écran garde 4,5:1 au moins (mesuré sur les couleurs affichées,
//      une fois les transitions de l'app finies) ;
//   3. la couleur libre (une pastille de la palette du kit) : l'accent de l'app suit, la forme de l'ambiance reste ;
//   4. « Revenir à Grist Factory » : l'app retire tout ce que le kit avait posé, retrouve ses couleurs, dans le même cadre ;
//   5. une app ouverte après le choix (Enseigne, GFS rechargé) : à son premier affichage, l'ambiance est déjà posée (pas de repeinture) ;
//   6. aucune erreur de page, aucun refus de la politique de sécurité du contenu, aucun avertissement de GFS ;
//   7. Automation+ seulement (consigne 007, point 3) : dans son écran « graphe », l'en-tête d'un déclencheur et celui d'une action restent distincts dans chaque ambiance, en clair et en sombre.
// Un CONSTAT dit ce que l'app fait de travers sans que GFS y puisse rien (à dire à l'app par une consigne) ; il ne fait pas échouer la passe.
// APP=form|automation, LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { say, check, contrastAudit, constat } from './lab-common.mjs';
import { themeGestures } from './theme-gestes.mjs';
import { screensOf } from './ecrans-apps.mjs';
import { ambiancePalette, COLOR_TOKENS } from '../js/theme/ambiance.js';
import { FORME } from '../js/theme/ambiance-forme.js';
import { hexToOklch, contrast } from '../js/theme/oklch.js';

const appId = process.env.APP || 'automation';
const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const other = scheme === 'light' ? 'dark' : 'light';
const run = `ambiance-${appId}-${lang}-${scheme}`;
const APP_URL = new RegExp(`/prototype/apps/${appId}/`);
// Ce que la passe mesure de chaque écran (tout le corps de la page). Pas mesuré : l'écran du répondant de Form+ (`#fill`, que l'app garde à l'aspect dessiné par la personne : consigne 016) ne s'affiche
// pas à qui conçoit, avec l'accès complet que GFS donne ; il faudrait un lien public ou un accès en lecture.
const SCOPE = 'body';

const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
let frame = lab.frame;
const noted = [];
page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') noted.push({ text: m.text().slice(0, 200), url: m.location().url || '' }); });
page.on('pageerror', error => noted.push({ text: error.message.slice(0, 200), url: 'pageerror' }));
await lab.fitPanel(undefined, 700, 400);

const { open: openWindow, close: closeWindow, tile, pickButton, resetButton } = themeGestures(() => frame);
const shot = name => lab.shotPanel(run, name, frame);
const until = async (probe, timeout = 8000) => {
  const end = Date.now() + timeout;
  let value;
  while (Date.now() < end) { value = await probe().catch(() => false); if (value) return value; await page.waitForTimeout(100); }
  return value;
};
const rgb = hex => { const n = parseInt(hex.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };
const showExplorer = async () => { await frame.locator('#floater-files').click(); await frame.locator('.ex').waitFor({ state: 'visible' }); };
const hideExplorer = async () => { await frame.locator('.ex-foot .btn', { hasText: /^(Fermer|Close)$/ }).click(); await frame.locator('#floaters').waitFor({ state: 'visible' }); };
// Les jetons que GFS donne (les couleurs et la forme de chaque ambiance) : les autres jetons de <html> sont à l'app (par exemple la zone que la barre de GFS lui fait écarter).
const AMBIANT = new Set([...COLOR_TOKENS, ...Object.values(FORME).flatMap(forme => Object.keys(forme))]);
const ambient = map => Object.fromEntries(Object.entries(map).filter(([name]) => AMBIANT.has(name)));
const modeKey = mode => (mode === 'dark' ? 'sombre' : 'clair');
const expected = (id, mode, custom = null) => { const palette = ambiancePalette(id, custom); return { colors: palette[modeKey(mode)], forme: palette.forme }; };

let app = await lab.openApp(appId, APP_URL, frame);
await page.waitForTimeout(3000);
await lab.fitPanel(undefined, 700, 400);

// Les jetons que le kit a posés sur <html> (par le CSSOM), et ce que la page en fait : son fond, ce que l'app garde.
const inline = () => app.evaluate(() => Object.fromEntries([...document.documentElement.style].filter(name => name.startsWith('--')).map(name => [name, document.documentElement.style.getPropertyValue(name).trim()])));
const body = () => app.evaluate(() => getComputedStyle(document.body).backgroundColor);
// L'app a pris les jetons quand son accent est celui du message ; ses couleurs ne sont celles à mesurer qu'une fois ses transitions finies (Form+ en a sur ses boutons et ses cartes).
const adopted = async (id, mode, custom = null) => {
  const want = expected(id, mode, custom).colors['--accent'].toLowerCase();
  const ok = await until(async () => ((await inline())['--accent'] || '').toLowerCase() === want);
  await app.waitForFunction(() => document.getAnimations().length === 0, null, { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(100);
  return ok;
};

// Le fond AFFICHÉ d'un élément de l'app (les fonds de ses ancêtres posés l'un sur l'autre : le canvas fait le mélange), en #rrggbb ; null si l'élément n'est pas à l'écran.
const shownBackground = selector => app.evaluate((css) => {
  const element = document.querySelector(css);
  if (!element) return null;
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  ctx.canvas.width = ctx.canvas.height = 1;
  const layers = [];
  for (let node = element; node; node = node.parentElement) layers.unshift(getComputedStyle(node).backgroundColor);
  for (const color of ['#fff', ...layers]) { ctx.fillStyle = '#000'; ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); }
  return `#${[...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(value => value.toString(16).padStart(2, '0')).join('')}`;
}, selector);
// L'écart de deux couleurs en OKLab : 0 pour la même, environ 0,02 pour ce qui se voit à peine, 0,1 et plus pour deux couleurs que personne ne confond.
const oklabGap = (a, b) => {
  const lab = (hex) => { const { L, C, h } = hexToOklch(hex); return [L, C * Math.cos(h * Math.PI / 180), C * Math.sin(h * Math.PI / 180)]; };
  const [x, y] = [lab(a), lab(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};
const thousandth = value => Math.round(value * 1000) / 1000;
// Les fonds de l'en-tête d'un déclencheur et de celui d'une action (Automation+ : `--accent-soft` et `--accent-solid`), leur rapport de luminance (WCAG 2) et leur écart en OKLab.
const headsApart = async () => {
  const [trigger, action] = await Promise.all(['.node-trigger .node-head', '.node-action .node-head'].map(shownBackground));
  return trigger && action ? { trigger, action, ratio: Math.round(contrast(trigger, action) * 100) / 100, gap: thousandth(oklabGap(trigger, action)) } : { missing: true };
};
const MIN_GAP = 0.1;

// ---------- 1. le départ ----------
const origin = { inline: await inline(), body: await body() };
const hosted = await app.evaluate(() => /[?&]gfs=\d/.test(location.search));
say('départ :', { jetons: origin.inline, body: origin.body, hosted });
check('au départ, l\'app est hébergée (`gfs=<n>` dans son adresse) et le kit n\'a posé aucun jeton de l\'ambiance', hosted && Object.keys(ambient(origin.inline)).length === 0, origin.inline);
const screens = screensOf(appId, { page, frame, lang });
const audits = [];
const verdicts = [];
const apart = [];
let originApart = null;
for (const [name, prepare] of screens) {
  await prepare(app);
  await page.waitForTimeout(800);
  const nodes = appId === 'automation' && name === 'graphe';
  await showExplorer();
  await openWindow();
  if (nodes) {
    // L'app seule, pour comparer : « Revenir à Grist Factory » (l'écran d'avant a laissé Enseigne), puis les en-têtes avec les couleurs d'origine de l'app.
    await resetButton().click();
    await until(async () => Object.keys(ambient(await inline())).length === 0);
    await closeWindow();
    await hideExplorer();
    await page.waitForTimeout(300);
    originApart = await headsApart();
    await showExplorer();
    await openWindow();
  }
  for (const id of ['pop', 'papier', 'brut', 'enseigne']) {
    await tile(id).click();
    for (const mode of [scheme, other]) {
      await page.emulateMedia({ colorScheme: mode });
      const ok = await adopted(id, mode);
      const tokens = await inline();
      const want = expected(id, mode);
      const wrong = COLOR_TOKENS.filter(token => (tokens[token] || '').toLowerCase() !== want.colors[token].toLowerCase());
      const wrongForme = Object.keys(want.forme).filter(token => token in tokens && tokens[token] !== want.forme[token]);
      const background = await body();
      const audit = await contrastAudit(app, SCOPE);
      verdicts.push({ name, id, mode, adopted: Boolean(ok), wrong, wrongForme, background: background === rgb(want.colors['--bg']) });
      audits.push({ name, id, mode, seen: audit.seen, failures: audit.failures });
      if (nodes) apart.push({ id, mode, ...(await headsApart()) });
    }
  }
  await page.emulateMedia({ colorScheme: scheme });
  await closeWindow();
  await hideExplorer();
  await adopted('enseigne', scheme);
  await shot(`${name}-enseigne`);
  if (nodes) {
    // Les autres ambiances, dans le mode de la passe, pour les voir (la fenêtre « Thème » cache l'app pendant les mesures).
    for (const id of ['pop', 'papier', 'brut']) {
      await showExplorer();
      await openWindow();
      await tile(id).click();
      await closeWindow();
      await hideExplorer();
      await adopted(id, scheme);
      await shot(`${name}-${id}`);
    }
  }
}
say('écrans :', screens.map(([name]) => name), 'mesures :', audits.length);
check('dans chaque écran et chaque ambiance, en clair et en sombre : le kit a posé les dix-neuf jetons de couleur du mode, tels que GFS les calcule, et ceux de forme',
  verdicts.every(item => item.adopted && item.wrong.length === 0 && item.wrongForme.length === 0), verdicts.filter(item => !item.adopted || item.wrong.length || item.wrongForme.length));
constat('le fond de la page est `--bg` (guide, règle 15) dans chaque écran et chaque ambiance', verdicts.every(item => item.background), verdicts.filter(item => !item.background).map(item => [item.name, item.id, item.mode]));
const weak = audits.filter(item => item.failures.length);
say('contrastes :', audits.map(item => [item.name, item.id, item.mode, item.seen, item.failures.length]));
check('chaque texte de chaque écran garde 4,5:1 au moins (3:1 pour un grand texte) dans les quatre ambiances, en clair et en sombre, mesuré sur les couleurs affichées', audits.length > 0 && audits.every(item => item.seen > 0) && weak.length === 0, weak.slice(0, 6));
if (apart.length) {
  const loose = apart.filter(item => item.missing || item.gap < MIN_GAP);
  const gaps = apart.filter(item => !item.missing);
  say('déclencheur et action, l\'app seule :', originApart);
  say('déclencheur et action, le plus petit écart OKLab :', { gap: Math.min(...gaps.map(item => item.gap)), ratio: Math.min(...gaps.map(item => item.ratio)), mesures: apart.length });
  say('déclencheur et action, par ambiance :', apart.map(item => [item.id, item.mode, item.trigger, item.action, item.ratio, item.gap]));
  constat('le déclencheur et l\'action (l\'en-tête de leurs nœuds) restent distincts dans chaque ambiance, en clair et en sombre : un écart OKLab de 0,1 au moins', apart.length === 8 && loose.length === 0, loose);
}

// ---------- 3. la couleur libre ----------
await showExplorer();
await openWindow();
await tile('pop').click();
await adopted('pop', scheme);
const popForme = FORME.pop;
await pickButton().click();
await frame.locator('.menu-panel').waitFor();
const colors = await frame.evaluate(() => [...document.querySelectorAll('.menu-panel .cp-grid .cp-swatch')].map(node => node.dataset.color));
await frame.locator('.menu-panel .cp-swatch').nth(17).click();
const free = await adopted('pop', scheme, colors[17]);
const tokens = await inline();
say('couleur libre :', { picked: colors[17], accent: tokens['--accent'] });
check('une pastille : l\'accent de l\'app est celui de la personne (éclairci ou assombri au besoin), la forme de Pop reste', Boolean(free) && tokens['--radius-md'] === popForme['--radius-md'], tokens['--accent']);

// ---------- 4. « Revenir à Grist Factory » ----------
await resetButton().click();
await until(async () => Object.keys(ambient(await inline())).length === 0);
const back = { inline: await inline(), body: await body() };
check('« Revenir à Grist Factory » : l\'app retire tout ce que le kit avait posé et retrouve ses couleurs d\'origine, dans le même cadre', Object.keys(ambient(back.inline)).length === 0 && back.body === origin.body
  && !app.isDetached() && page.frames().filter(f => APP_URL.test(f.url())).length === 1, { back, origin });

// ---------- 5. une app ouverte après le choix ----------
await tile('enseigne').click();
await page.waitForTimeout(300);
await closeWindow();
await hideExplorer();
await page.addInitScript(() => {
  if (!/\/prototype\/apps\//.test(location.pathname)) return;
  const samples = (window.__peinture = []);
  const start = performance.now();
  const held = (window.__attente = {});
  new MutationObserver(() => {
    const now = Math.round(performance.now() - start);
    if (document.documentElement.hasAttribute('data-gfs-pending')) held.posee = held.posee ?? now;
    else if (held.posee !== undefined) held.levee = held.levee ?? now;
  }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-gfs-pending'] });
  const tick = () => {
    const root = document.documentElement;
    if (document.body) {
      const style = getComputedStyle(document.body);
      samples.push({ t: Math.round(performance.now() - start), visible: style.visibility !== 'hidden' && document.body.innerText.trim().length > 0, inline: [...root.style].filter(name => name.startsWith('--')).length, bg: style.backgroundColor });
    }
    if (performance.now() - start < 6000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await frame.evaluate(() => location.reload());
await page.waitForTimeout(1000);
frame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(frame);
await page.waitForTimeout(500);
app = await lab.openApp(appId, APP_URL, frame);
await page.waitForTimeout(4000);
const painting = await app.evaluate(() => window.__peinture || []);
const first = painting.find(sample => sample.visible);
const arrived = painting.find(sample => sample.inline >= 19);
const enseigne = expected('enseigne', scheme);
const held = await app.evaluate(() => window.__attente || {});
say('premier affichage :', { first, ambianceArrivee: arrived ? arrived.t : null, attente: held, samples: painting.length });
constat('à son premier affichage, l\'app porte déjà l\'ambiance choisie (Enseigne) : pas de repeinture', Boolean(first) && first.inline >= 19 && first.bg === rgb(enseigne.colors['--bg']), { first, attente: held });
await shot('reouverte-enseigne');
const reopened = await inline();
check('l\'app ouverte après le choix porte Enseigne, au mode de l\'app', COLOR_TOKENS.every(token => (reopened[token] || '').toLowerCase() === enseigne.colors[token].toLowerCase()), reopened);

// ---------- 6. la politique de sécurité du contenu, les erreurs ----------
// Le Grist du labo est en http (127.0.0.1:8910) : le `connect-src 'self' https:` de Form+ refuse ses appels à l'adresse publique d'un formulaire, ce que le Grist de la personne (https) ne fait pas.
const ours = noted.filter(item => (item.url === 'pageerror' || /^GFS/.test(item.text) || APP_URL.test(item.url)) && !/127\.0\.0\.1:8910/.test(item.text));
say('avertissements et erreurs de la console (app, kit, GFS) :', ours);
check('aucune erreur de page, aucun refus de la politique de sécurité du contenu, aucun avertissement de GFS', ours.length === 0, ours);

await lab.browser.close();
process.exit(process.exitCode || 0);
