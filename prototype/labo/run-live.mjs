// Les apps servies par leur site en ligne (le porteur, 22/10 : « servir les dépôts live, pas une copie figée »), dans un vrai Grist, avec les vraies apps, à 700 × 400.
// GFS ouvre chaque app sur son site (js/catalogue.js, `site`), à la racine de l'origine de GFS ; le labo rend à ces adresses les fichiers de la copie de l'app (lab-setup.mjs, `routeLiveSites`).
// Trois passes : le site vivant (adresse, sous-cadre isolé, app prête, rien servi de la copie), `live=0` (la copie figée, celle des autres essais), et un site qui ne répond pas
// (repli sur la copie au bout de 15 secondes, dit à la personne). LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const WORDS = lang === 'fr'
  ? { fallback: /^Automation\+ : la dernière version ne répond pas, GFS ouvre sa copie figée\.$/ }
  : { fallback: /^Automation\+: the latest version is not responding, GFS opens its pinned copy\.$/ };
const SANDBOX = 'allow-scripts allow-forms allow-popups allow-modals allow-downloads';

const gfsOf = lab => lab.gfsFrame(/access=full/);
const sourceOf = async lab => (await gfsOf(lab)).evaluate(() => document.body.dataset.appSource);
const statusOf = async lab => (await gfsOf(lab)).evaluate(() => document.body.dataset.appStatus);
const waitFor = async (condition, ms = 30000) => {
  for (let i = 0; i < ms / 200; i++) {
    if (await condition().catch(() => false)) return true;
    await new Promise(done => setTimeout(done, 200));
  }
  return false;
};
// Ce que la personne n'a pas à voir : un avertissement de GFS (refus du courtier) ou une erreur de la politique de sécurité du contenu.
const watch = lab => {
  const seen = { warnings: [], violations: [], requests: [] };
  lab.page.on('console', message => {
    if (message.type() === 'warning' && message.text().startsWith('GFS')) seen.warnings.push(message.text());
    if (/Content Security Policy|Refused to/i.test(message.text())) seen.violations.push(message.text().slice(0, 200));
  });
  lab.page.on('request', request => { if (/\/(publipostageGrist|GRIST_automation|FormPlus)\/|\/prototype\/apps\//.test(request.url())) seen.requests.push(request.url()); });
  return seen;
};

// ---------- passe 1 : le site vivant ----------
{
  const lab = await startLab({ lang, colorScheme: scheme, live: true });
  const seen = watch(lab);
  await lab.fitPanel(undefined, 700, 400);

  const pp = await lab.openApp('publipostage', /publipostageGrist\//);
  const url = new URL(pp.url());
  check('Publipostage+ s\'ouvre sur son site en ligne, à la racine de l\'origine de GFS, avec les paramètres de Grist et le numéro de contrat',
    url.origin === 'http://127.0.0.1:8911' && url.pathname === '/publipostageGrist/index.html'
      && url.searchParams.get('access') === 'full' && url.searchParams.get('language') === lang && url.searchParams.get('gfs') === '0', pp.url().replace(/\?.*/, ''));
  check('le sous-cadre reste isolé : les mêmes permissions, jamais allow-same-origin', (await (await pp.frameElement()).getAttribute('sandbox')) === SANDBOX);
  check('GFS dit d\'où il sert l\'app : son site en ligne', (await sourceOf(lab)) === 'live');
  const tables = pp.getByRole('button', { name: /Create the tables|Créer les tables/ });
  await tables.first().waitFor({ timeout: 30000 });
  await tables.first().click();
  await pp.locator('#editor-container .ProseMirror').waitFor({ timeout: 30000 });
  await lab.page.waitForTimeout(1500);
  check('l\'app démarre depuis son site : son éditeur est là, GFS a fini de charger', (await statusOf(lab)) === 'ready', await statusOf(lab));
  const assets = seen.requests.filter(requestUrl => /\.(js|css)(\?|$)/.test(requestUrl));
  check('ses fichiers viennent tous de son site, aucun de la copie figée', assets.length > 20 && assets.every(requestUrl => requestUrl.includes('/publipostageGrist/')) && !assets.some(requestUrl => requestUrl.includes('/prototype/apps/')), { fichiers: assets.length, copie: assets.filter(requestUrl => requestUrl.includes('/prototype/apps/')).length });
  await lab.page.screenshot({ path: new URL(`./shots/live-publipostage-${lang}-${scheme}.png`, import.meta.url).pathname }).catch(() => {});

  // Form+ : l'entrée n'est pas à la racine de son site (`poc/widget.html`), le dossier du kit imbriqué non plus.
  const gfs = await gfsOf(lab);
  await lab.openModules(gfs);
  await gfs.locator('[data-fk="app:form"]').check();
  await lab.settle(gfs);
  await gfs.locator('[data-open="form"]').click();
  const form = await lab.appFrame(/FormPlus\//);
  check('Form+ s\'ouvre sur son site, par son entrée du manifeste (poc/widget.html)', new URL(form.url()).pathname === '/FormPlus/poc/widget.html', form.url().replace(/\?.*/, ''));
  check('Form+ est prête', await waitFor(async () => (await statusOf(lab)) === 'ready'), await statusOf(lab));
  check('aucun avertissement de GFS, aucune erreur de la politique de sécurité de l\'app', seen.warnings.length === 0 && seen.violations.length === 0, { avertissements: seen.warnings, politique: seen.violations });
  await lab.browser.close();
}

// ---------- passe 2 : `live=0`, la copie figée ----------
{
  const lab = await startLab({ lang, colorScheme: scheme, live: false });
  const seen = watch(lab);
  await lab.fitPanel(undefined, 700, 400);
  const pp = await lab.openApp('publipostage');
  check('avec live=0, l\'app s\'ouvre dans la copie figée du sous-module', new URL(pp.url()).pathname === '/prototype/apps/publipostage/index.html', pp.url().replace(/\?.*/, ''));
  check('GFS dit qu\'il sert la copie', (await sourceOf(lab)) === 'pinned');
  const tables = pp.getByRole('button', { name: /Create the tables|Créer les tables/ });
  await tables.first().waitFor({ timeout: 30000 });
  check('l\'app démarre de la copie, rien n\'est demandé à un site en ligne', await waitFor(async () => (await statusOf(lab)) === 'ready') && !seen.requests.some(requestUrl => /\/publipostageGrist\//.test(requestUrl)), seen.requests.filter(requestUrl => /\/publipostageGrist\//.test(requestUrl)).slice(0, 3));
  await lab.browser.close();
}

// ---------- passe 3 : un site qui ne répond pas ----------
{
  const lab = await startLab({ lang, colorScheme: scheme, live: true, liveAbsent: ['GRIST_automation'] });
  const seen = watch(lab);
  await lab.fitPanel(undefined, 700, 400);
  const gfs = await gfsOf(lab);
  await gfs.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
  await lab.openModules(gfs);
  await gfs.locator('[data-fk="app:automation"]').check();
  await lab.settle(gfs);
  const t0 = Date.now();
  await gfs.locator('[data-open="automation"]').click();
  const app = await lab.appFrame(/GRIST_automation\//);
  check('Automation+ est d\'abord demandée à son site (en ligne : 404)', new URL(app.url()).pathname === '/GRIST_automation/index.html', app.url().replace(/\?.*/, ''));
  check('GFS attend l\'app avant de se replier : « se charge »', (await statusOf(lab)) === 'loading', await statusOf(lab));
  const fellBack = await waitFor(async () => (await sourceOf(lab)) === 'pinned', 40000);
  const after = Date.now() - t0;
  check('au bout de 15 secondes, GFS ouvre la copie figée de l\'app dans le même cadre', fellBack && after >= 14000 && after < 25000, { apres: after });
  const g2 = await gfsOf(lab);
  check('GFS le dit à la personne, une fois', WORDS.fallback.test(await g2.locator('#toast').innerText().catch(() => '')), await g2.locator('#toast').innerText().catch(() => ''));
  check('le cadre est dans la copie figée', await waitFor(async () => /\/prototype\/apps\/automation\/index\.html/.test(app.url())), app.url().replace(/\?.*/, ''));
  check('l\'app démarre de la copie : prête, sans « ne répond pas »', await waitFor(async () => (await statusOf(lab)) === 'ready', 30000), await statusOf(lab));
  check('aucune erreur de GFS pendant le repli', seen.warnings.length === 0, seen.warnings);
  await lab.page.screenshot({ path: new URL(`./shots/live-repli-${lang}-${scheme}.png`, import.meta.url).pathname }).catch(() => {});
  await lab.browser.close();
}
say('fini');
