// Le message d'erreur du poids du document (demande du porteur du 25/11 : au-delà de 12 Go, un message d'erreur ; le 25/11 aussi : la limite est celle de La Suite numérique, 15 Go pour tous ses services, et le message ne
// paraît que dans une de ses instances ; choix : le fichier entier du document ; faits vérifiés, section 154), joué dans un VRAI serveur Grist (l'image officielle, `bash vrai-serveur.sh`), à 700 × 400, à la vraie souris :
// GFS ajouté comme widget à un document, la surveillance de js/weight/weight-guard.js lit le poids par le vrai cadre d'envoi et un vrai jeton. Le serveur d'essai n'est pas sous numerique.gouv.fr : les passes 1 à 3 ajoutent
// son hôte à ceux de La Suite par le réglage `suite` de l'adresse de GFS. Un document de 12 Go ne se fabrique pas ici : la lecture du fichier entier (`page_count × page_size`) reste celle de Grist, mais sa réponse est
// remplacée, sur le réseau, par 12,4 Go (Playwright : la requête part de Node, en-têtes, CORS et forme de la réponse sont ceux de Grist). Se joue en quatre passes :
//   1. le poids réel (quelques centaines de Ko) : aucune lecture avant 5 s, trois lectures ensuite, aucun bandeau ;
//   2. le fichier dit 12,4 Go : le bandeau rouge paraît dans l'explorateur ; texte, alerte, place, contraste, un clic sur « Voir le détail » ouvre la fenêtre « Poids du document » (lue avec le vrai poids), Échap la ferme ;
//   3. le fichier dit exactement 12 Go : rien (« au-delà » est strict) ;
//   4. un document d'un autre serveur que La Suite (sans le réglage `suite`) qui dirait 12,4 Go : aucune lecture de `/sql` et aucun bandeau.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { SQL } from '../js/weight/weight-reader.js';
import { GO } from '../js/weight/weight-guard.js';
import { alertText } from '../js/weight/weight-alert.js';
import { PAGE_PORT, GFS, contrastProblems, openGfs, shot } from './lab-pdf.mjs';
import { reopened } from './lab-poids.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const locale = lang === 'en' ? 'en-GB' : 'fr-FR';
const BANNER = '.ex-notices .banner--danger';
const SUITE = '&suite=127.0.0.1'; // l'hôte du serveur d'essai, donné comme instance de La Suite

// Ce que la surveillance demande à Grist : le moment de chaque lecture de `/sql` (relevé sur le réseau), celui où la page de GFS a été demandée, et le poids que le fichier « dit » (null : le vrai).
const net = { fake: null, sql: [], status: [], page: 0 };

async function install(context) {
  context.on('request', request => {
    if (request.url().startsWith(GFS.split('?')[0]) && request.resourceType() === 'document') net.page = Date.now();
    if (/\/sql\?/.test(request.url())) net.sql.push({ at: Date.now(), q: new URL(request.url()).searchParams.get('q') });
  });
  context.on('response', async response => { if (/\/sql\?/.test(response.url())) net.status.push(`${response.status()} ${(await response.text().catch(() => '')).slice(0, 120)}`); });
  // Seule la lecture du fichier entier est interceptée, quand `net.fake` le demande : la requête part de Node (sans le cookie de la session, que `route.fetch()` ajouterait et que Grist refuse sur un appel
  // d'une autre origine) avec la même adresse et le même jeton, et la réponse de Grist, en-têtes compris, rend le corps changé.
  await context.route(/\/api\/docs\/[^/]+\/sql\?/, async route => {
    const url = route.request().url();
    if (net.fake === null || new URL(url).searchParams.get('q') !== SQL.file) { await route.continue(); return; }
    const response = await fetch(url, { headers: { Origin: route.request().headers().origin || 'null' } });
    const body = await response.json();
    body.records = [{ fields: { octets: net.fake } }];
    const headers = Object.fromEntries(response.headers);
    delete headers['content-length'];
    delete headers['content-encoding'];
    await route.fulfill({ status: response.status, headers, body: JSON.stringify(body) });
  });
}

const state = frame => frame.evaluate(selector => {
  const bar = document.querySelector(selector);
  const text = node => (node ? node.textContent.replace(/\s+/g, ' ').trim() : null);
  const scroll = document.querySelector('.ex-scroll');
  const out = { banners: document.querySelectorAll('.ex-notices .banner').length, bar: Boolean(bar), listHeight: Math.round(scroll.getBoundingClientRect().height), rows: document.querySelectorAll('.ls-row').length };
  if (!bar) return out;
  const box = bar.getBoundingClientRect();
  const root = document.querySelector('.ex').getBoundingClientRect();
  const label = bar.querySelector('.banner-text');
  const button = bar.querySelector('button');
  const at = button.getBoundingClientRect();
  return { ...out, role: bar.getAttribute('role'), text: text(label), button: text(button), first: document.querySelector('.ex-notices').firstElementChild === bar, height: Math.round(box.height),
    inside: box.left >= root.left - 1 && box.right <= root.right + 1 && at.left >= box.left - 1 && at.right <= box.right + 1, twoLines: label.getBoundingClientRect().height < 40 && label.scrollWidth <= label.clientWidth + 1 };
}, BANNER);

// Attend que la page ait fait sa lecture de `delay` ms (jusqu'à `ms`), puis rend l'état.
async function until(frame, test, ms = 40000) {
  const started = Date.now();
  let now = await state(frame);
  while (!test(now) && Date.now() - started < ms) { await frame.page().waitForTimeout(250); now = await state(frame); }
  return now;
}

// Les trois lectures de la surveillance sont les trois lectures courtes, le fichier d'abord : jamais une table.
const reads = since => net.sql.filter(entry => entry.at >= since).map(entry => entry.q);

const unexpected = run => run.problems.filter(problem => !run.allow.some(known => known.test(problem)));

const pluginApi = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi, { colorScheme: scheme });
  await install(context);
  say('--- 1. le poids réel : rien avant 5 s, trois lectures, aucun bandeau ---');
  net.sql = [];
  const run = await openGfs(context, { lang, query: SUITE });
  const frame = run.frame;
  await run.page.waitForTimeout(9000);
  const first = net.sql[0];
  say(`  réponses : ${JSON.stringify(net.status)}`);
  say(`  lectures : ${net.sql.length}${first ? ` ; la première ${((first.at - net.page) / 1000).toFixed(1)} s après la demande de la page` : ''}`);
  check('aucune lecture avant 5 s après la demande de la page, et la première lecture est celle du fichier', Boolean(first) && first.at - net.page >= 5000 && first.q === SQL.file, { retard: first && first.at - net.page, q: first && first.q });
  check('une seule passe de trois lectures courtes (le fichier, les pièces jointes stockées, les pièces jointes comptées) : jamais une table', JSON.stringify(net.sql.map(entry => entry.q)) === JSON.stringify([SQL.file, SQL.stored, SQL.counted]), net.sql.map(entry => entry.q.slice(0, 60)));
  check('au poids réel, aucun bandeau', !(await state(frame)).bar);

  say('--- 2. le fichier dit 12,4 Go : le bandeau rouge ---');
  net.fake = Math.round(12.4 * GO);
  net.sql = [];
  await run.page.reload();
  const fresh = await reopened(run.page);
  const shown = await until(fresh, s => s.bar);
  const want = alertText(net.fake, locale, t);
  check('le bandeau paraît dans l\'explorateur', shown.bar, shown);
  check(`il dit « ${want} »`, shown.text === want, shown.text);
  check('il est en alerte, en tête des avis, seul, avec le bouton « Voir le détail »', shown.role === 'alert' && shown.first && shown.banners === 1 && shown.button === t('weight.alertDetail'), shown);
  check('le texte et le bouton tiennent dans la largeur (700 px), sur deux lignes au plus', shown.inside && shown.twoLines, shown);
  check(`la liste garde sa place (${shown.listHeight} px) sous un bandeau de ${shown.height} px`, shown.listHeight >= 130 && shown.height <= 64, shown);
  const contrast = await contrastProblems(fresh, BANNER);
  check('les textes du bandeau ont le contraste voulu (4,5:1), en ' + (scheme === 'dark' ? 'sombre' : 'clair'), contrast.length === 0, contrast);
  await shot(fresh, `poids-alerte-${lang}-${scheme}`);
  check('trois lectures courtes pour le fichier dit à 12,4 Go, une seule passe', JSON.stringify(reads(0)) === JSON.stringify([SQL.file, SQL.stored, SQL.counted]), reads(0).map(q => q.slice(0, 60)));

  say('--- le bouton, à la vraie souris ---');
  await fresh.locator('[data-weight-alert]').click();
  await fresh.locator('.mod.wd').waitFor({ timeout: 10000 });
  await fresh.waitForFunction(() => document.querySelector('.wd-exact').dataset.state !== 'loading', null, { timeout: 90000 });
  check('un clic sur « Voir le détail » ouvre la fenêtre « Poids du document », lue dans le vrai Grist', (await fresh.locator('.wd-sec').first().getAttribute('data-state')) === 'ok');
  await run.page.keyboard.press('Escape');
  await fresh.locator('.mod.wd').waitFor({ state: 'detached' });
  check('Échap la ferme et le bandeau reste', (await state(fresh)).bar);

  say('--- 3. le fichier dit exactement 12 Go : rien (« au-delà » est strict) ---');
  net.fake = 12 * GO;
  await run.page.reload();
  const exact = await reopened(run.page);
  await run.page.waitForTimeout(9000);
  check('à 12 Go pile, aucun bandeau', !(await state(exact)).bar, await state(exact));

  const bad = unexpected(run);
  check('aucune erreur ni avertissement de GFS dans la console', bad.length === 0, bad);

  say('--- 4. un autre serveur que La Suite numérique (sans le réglage `suite`) : rien ne se lit, aucun bandeau, même à 12,4 Go ---');
  net.fake = Math.round(12.4 * GO);
  net.sql = [];
  const elsewhere = await openGfs(context, { lang });
  await elsewhere.page.waitForTimeout(12000);
  check('aucune lecture de `/sql` (la porte est fermée avant la première lecture du poids)', net.sql.length === 0, net.sql.map(entry => entry.q.slice(0, 60)));
  check('aucun bandeau', !(await state(elsewhere.frame)).bar, await state(elsewhere.frame));
  const bad4 = unexpected(elsewhere);
  check('aucune erreur ni avertissement de GFS dans la console', bad4.length === 0, bad4);
} finally {
  await browser.close();
  pages.close();
}
