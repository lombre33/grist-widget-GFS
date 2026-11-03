// L'ambiance de GFS posée par le kit (kit 0.6.0, `Ambiance.start()` ; contrats 5.2, point 10 ; guide des apps, règle 15), dans un vrai Grist (grist-static), à 700 × 400, à la vraie souris. La sonde N
// (labo/sondes/n-ambiance-kit/) est une app écrite avec le VRAI kit, comme le seront les apps avec leur consigne : sous la politique d'une app hébergée (`style-src 'self'`), dans le cadre isolé de GFS
// (`sandbox="allow-scripts"`, origine opaque), avec une feuille qui lit les jetons de la charte. Ce que la passe mesure :
//   1. le départ : rien n'est choisi, `ready` s'est réglé, l'app n'a posé aucun jeton (sa propre propriété de page seule), aucun événement ;
//   2. un choix dans la fenêtre « Thème » (Pop) : un événement, le message est lu entier, le kit pose les dix-neuf jetons du mode de l'app et ceux de forme, et les valeurs calculées de la page sont celles du message ;
//   3. le mode de l'app change (la préférence du système) sans que GFS dise rien : les jetons suivent, la forme reste, aucun événement de plus ;
//   4. chaque texte de l'app garde 4,5:1 au moins dans les quatre ambiances, en clair et en sombre : l'app n'a rien à recalculer ;
//   5. la couleur libre (une pastille de la palette du kit) : l'accent de l'app suit, la forme de l'ambiance reste ;
//   6. « Revenir à Grist Factory » : l'app retire tout ce que le kit avait posé, jamais sa propre propriété, et retrouve les couleurs de la charte ;
//   7. une app ouverte après le choix (GFS rechargé, Néon retenu) : le contexte porte l'ambiance, posée avant que `ready` se règle ; aucun événement ;
//   8. aucun refus de la politique de sécurité du contenu, aucune erreur de page, aucun avertissement de GFS.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark, KIT_DIR=<dossier du kit> (par défaut le sous-module prototype/kit : ce que GFS référence).
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check, contrastAudit } from './lab-common.mjs';
import { themeGestures } from './theme-gestes.mjs';

const KIT = process.env.KIT_DIR || fileURLToPath(new URL('../kit', import.meta.url));
if (!existsSync(join(KIT, 'js/ambiance.js'))) {
  say(`le kit 0.6.0 n'est pas là (${KIT}) : git submodule update --init prototype/kit, ou KIT_DIR=<dossier du dépôt grist-factory-kit>`);
  process.exit(1);
}
const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const other = scheme === 'light' ? 'dark' : 'light';
const run = `ambiance-kit-${lang}-${scheme}`;

const lab = await startLab({ lang, colorScheme: scheme, probes: true });
const { page } = lab;
// Les avertissements et erreurs de la console, avec leur origine : la page de GFS en porte un connu (le script d'API de Grist y pose une feuille de style en ligne que sa politique refuse, index.html), qui n'est pas celui de l'app.
const noted = [];
page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') noted.push({ text: m.text().slice(0, 160), url: m.location().url || '' }); });
page.on('pageerror', error => noted.push({ text: error.message, url: 'pageerror' }));
// Le kit, servi sous /kit/ à l'adresse de GFS (même origine que la page de la sonde ; l'en-tête CORS ouvert comme celui de GitHub Pages, que demande un cadre d'origine opaque).
await page.route('http://127.0.0.1:8911/kit/**', async route => {
  const path = new URL(route.request().url()).pathname.replace(/^\/kit\//, '');
  try {
    const body = await readFile(join(KIT, path));
    await route.fulfill({ status: 200, contentType: path.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8', headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' }, body });
  } catch { await route.fulfill({ status: 404, body: 'not found' }); }
});
await lab.fitPanel(undefined, 700, 400);
say('semis :', await seedFiles(lab.frame));
await lab.frame.evaluate(() => location.reload());
await page.waitForTimeout(1000);
let frame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(frame);
await page.waitForTimeout(800);
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

// Ce que l'app a vu (labo/sondes/n-ambiance-kit/app.js) et ce que sa page porte : les jetons posés en ligne, et quelques valeurs calculées que lisent ses feuilles.
let app = await lab.openApp('sonde-n', /n-ambiance-kit\//, frame);
const state = () => app.evaluate(() => JSON.parse(document.body.dataset.sonde || '{}'));
const painted = () => app.evaluate(() => {
  const root = document.documentElement;
  const of = selector => getComputedStyle(document.querySelector(selector));
  return {
    inline: [...root.style].filter(name => name.startsWith('--')).length, own: root.style.getPropertyValue('--sonde-propre'), accent: getComputedStyle(root).getPropertyValue('--accent').trim(),
    surface: of('.card').backgroundColor, solid: of('.solid').backgroundColor, radius: of('.card').borderTopLeftRadius, weight: of('h1').fontWeight, font: of('h1').fontFamily.slice(0, 20),
  };
});
await until(async () => (await state()).pret === true, 15000);

// ---------- 1. le départ ----------
let seen = await state();
const origin = await painted();
say('départ :', { seen, origin });
check('au départ, rien n\'est choisi : l\'app est hébergée, `ready` s\'est réglé, aucun événement', seen.hosted === true && seen.pret === true && seen.abonne.length === 0, seen);
check('l\'app n\'a posé aucun jeton (sa propre propriété de page seule) et prend les couleurs de la charte du kit', origin.inline === 1 && origin.own === 'garde' && /^#[0-9a-f]{6}$/.test(origin.accent), origin);
check('le kit n\'a rien posé avant `ready` non plus : l\'app s\'est affichée sans repeindre', seen.auDepart.inline === 1, seen.auDepart);
await showExplorer();
await openWindow();

// ---------- 2. un choix : Pop ----------
await tile('pop').click();
await until(async () => (await state()).abonne.length === 1);
seen = await state();
let now = await painted();
const pop = seen.abonne[0];
const tokens = (message, mode) => message.tokens[mode === 'dark' ? 'sombre' : 'clair'];
say('Pop :', { pop, now });
check('Pop : un seul événement, le message est lu entier par le kit (dix-neuf jetons de couleur par mode, la forme)', seen.abonne.length === 1 && pop.id === 'pop' && pop.n.clair === 19 && pop.n.sombre === 19 && pop.n.forme > 10 && pop.couleur === null, pop);
check('le kit pose les dix-neuf jetons du mode affiché et ceux de forme, et rien de plus : la propriété de l\'app est intacte', now.inline === 1 + 19 + pop.n.forme && now.own === 'garde', now);
check('les valeurs calculées de la page sont celles du message : l\'accent du mode, la carte, le bouton plein, l\'arrondi, la police du titre', now.accent === tokens(pop, scheme)['--accent'] && now.surface === rgb(tokens(pop, scheme)['--surface'])
  && now.solid === rgb(tokens(pop, scheme)['--accent-solid']) && now.radius === pop.radius && now.accent !== origin.accent && now.weight !== origin.weight, { now, origin, tokens: tokens(pop, scheme) });
await closeWindow();
await hideExplorer();
await shot('2-pop-app');
await showExplorer();
await openWindow();

// ---------- 3. le mode change : sans événement ----------
await page.emulateMedia({ colorScheme: other });
await until(async () => (await painted()).accent === tokens(pop, other)['--accent']);
now = await painted();
check('le mode de l\'app change (la préférence du système) : les jetons suivent sans que GFS dise rien (aucun événement de plus), la forme reste, rien de plus n\'est posé',
  now.accent === tokens(pop, other)['--accent'] && now.surface === rgb(tokens(pop, other)['--surface']) && now.radius === pop.radius && now.inline === 1 + 19 + pop.n.forme && now.own === 'garde' && (await state()).abonne.length === 1, now);
await page.emulateMedia({ colorScheme: scheme });
await until(async () => (await painted()).accent === tokens(pop, scheme)['--accent']);
check('et revient', (await painted()).accent === tokens(pop, scheme)['--accent']);

// ---------- 4. chaque texte de l'app se lit, dans chaque ambiance et chaque mode ----------
const audits = [];
for (const id of ['papier', 'brut', 'neon', 'pop']) {
  const before = (await state()).abonne.length;
  await tile(id).click();
  await until(async () => (await state()).abonne.length === before + 1);
  const message = (await state()).abonne.at(-1);
  for (const mode of [scheme, other]) {
    await page.emulateMedia({ colorScheme: mode });
    await until(async () => (await painted()).accent === tokens(message, mode)['--accent']);
    audits.push({ id, mode, ...(await contrastAudit(app, 'body')) });
  }
  await page.emulateMedia({ colorScheme: scheme });
  await until(async () => (await painted()).accent === tokens(message, scheme)['--accent']);
}
say('contrastes :', audits.map(item => [item.id, item.mode, item.seen, item.failures.length]));
check('chaque texte de l\'app (le titre, les textes, le lien, les deux boutons : sept mesurés) garde 4,5:1 au moins dans les quatre ambiances, en clair et en sombre, mesuré sur les couleurs affichées',
  audits.length === 8 && audits.every(item => item.seen === 7 && item.failures.length === 0), audits.filter(item => item.failures.length));

// ---------- 5. la couleur libre : une pastille de la palette du kit ----------
const eventsBefore = (await state()).abonne.length;
await pickButton().click();
await frame.locator('.menu-panel').waitFor();
const colors = await frame.evaluate(() => [...document.querySelectorAll('.menu-panel .cp-grid .cp-swatch')].map(node => node.dataset.color));
await frame.locator('.menu-panel .cp-swatch').nth(17).click();
await until(async () => (await state()).abonne.length === eventsBefore + 1);
seen = await state();
now = await painted();
const own = seen.abonne.at(-1);
say('couleur libre :', { picked: colors[17], own, now });
check('une pastille : l\'app reçoit la couleur par un seul événement, avec la forme de Pop', seen.abonne.length === eventsBefore + 1 && own.id === 'pop' && own.couleur === colors[17] && own.radius === pop.radius && own.n.forme === pop.n.forme, own);
check('la page de l\'app prend l\'accent de la personne (celui du message, éclairci ou assombri au besoin), garde la forme de Pop et la même quantité de jetons', now.accent === tokens(own, scheme)['--accent'] && now.accent !== tokens(pop, scheme)['--accent']
  && now.radius === pop.radius && now.inline === 1 + 19 + pop.n.forme && now.own === 'garde', { now, own });

// ---------- 6. « Revenir à Grist Factory » ----------
await resetButton().click();
await until(async () => (await state()).abonne.length === eventsBefore + 2);
seen = await state();
now = await painted();
check('« Revenir à Grist Factory » : l\'app reçoit `null`', seen.abonne.at(-1) === null, seen.abonne.at(-1));
check('le kit retire tout ce qu\'il avait posé et rien d\'autre : la propriété de l\'app reste, les couleurs et la forme sont celles d\'origine', now.inline === 1 && now.own === 'garde' && now.accent === origin.accent
  && now.surface === origin.surface && now.solid === origin.solid && now.radius === origin.radius && now.weight === origin.weight && now.font === origin.font, { now, origin });
check('GFS n\'a pas touché au cadre de l\'app : le même cadre, un seul', !app.isDetached() && page.frames().filter(f => /n-ambiance-kit\//.test(f.url())).length === 1);

// ---------- 7. une app ouverte après le choix ----------
await tile('neon').click();
await page.waitForTimeout(300);
await closeWindow();
await hideExplorer();
await frame.evaluate(() => location.reload());
await page.waitForTimeout(1000);
frame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(frame);
await page.waitForTimeout(500);
app = await lab.openApp('sonde-n', /n-ambiance-kit\//, frame);
await until(async () => (await state()).pret === true, 15000);
seen = await state();
now = await painted();
const neon = seen.abonne[0];
say('Néon, app ouverte après le choix :', { neon, auDepart: seen.auDepart, now });
check('l\'app ouverte après le choix reçoit Néon dans son contexte : un seul rappel de l\'abonné (à l\'arrivée), les dix-neuf jetons par mode et la forme', seen.abonne.length === 1 && neon.id === 'neon' && neon.n.clair === 19 && neon.n.sombre === 19 && neon.n.forme > 10, seen.abonne);
check('l\'ambiance est posée avant que `ready` se règle : l\'app s\'affiche sans repeindre', seen.auDepart.inline === 1 + 19 + neon.n.forme && seen.auDepart.accent === tokens(neon, scheme)['--accent'] && seen.auDepart.propre === 'garde', seen.auDepart);
check('la page porte l\'accent de Néon, au mode de l\'app', now.accent === tokens(neon, scheme)['--accent'] && now.inline === 1 + 19 + neon.n.forme, now);
await shot('7-neon-app');
await page.emulateMedia({ colorScheme: other });
await until(async () => (await painted()).accent === tokens(neon, other)['--accent']);
await shot('7-neon-app-mode-autre');
await page.emulateMedia({ colorScheme: scheme });

// ---------- 8. la politique de sécurité du contenu ----------
seen = await state();
const origins = {};
for (const item of noted) { const key = item.url.replace(/\?.*$/, '').replace(/^https?:\/\/[^/]+/, '') || '(aucune)'; origins[key] = (origins[key] || 0) + 1; }
const ours = noted.filter(item => item.url === 'pageerror' || /^GFS/.test(item.text) || /n-ambiance-kit|\/kit\//.test(item.url));
say('refus de la politique vus par l\'app :', seen.violations, 'avertissements et erreurs de la console, par origine :', origins);
check('aucun refus de la politique de sécurité du contenu vu par l\'app (`style-src \'self\'` : le CSSOM passe), aucune erreur de page, aucun avertissement de GFS ni du kit', seen.violations.length === 0 && ours.length === 0, { violations: seen.violations, ours });

await lab.browser.close();
process.exit(process.exitCode || 0);
