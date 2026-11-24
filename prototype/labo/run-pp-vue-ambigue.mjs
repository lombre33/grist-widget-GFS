// « Le widget ne sait pas quelle vue de la page lui est liée par « Sélectionner par » : plusieurs widgets de cette table ont la même adresse que lui » (Publipostage+,
// `js/view-source.js`, état « ambiguous », vu par le porteur le 24/11 dans un document de la DINUM, sous Firefox). Mesuré dans un vrai Grist (grist-static), avec la vraie Publipostage+
// que GFS référence :
//   1. le cas : deux pages, chacune avec sa grille CLIENTS et son GFS (même adresse, même table). GFS relie chaque section à la grille de SA page (contrats 4.5, point 8) : deux GFS reliés
//      à deux grilles différentes. Publipostage+, ouverte dans chacun, répond « ambiguous » (le message du porteur) ;
//   2. ce que Publipostage+ sait déjà par Grist (`getLinkState`) ne départage pas ces deux sections : les deux sont « reliées » ;
//   3. ce que GFS sait : chaque GFS retrouve SA section (`ViewOptions.section()`, le code de GFS, importé tel quel) et la grille qui la pilote est celle de sa page, sans qu'aucune marque ne
//      reste dans les réglages, sans barre « Enregistrer », sans cadre reconstruit ; le temps que cela prend ;
//   4. ce que GFS dit à l'app (contrats 5.4, point 15, choix du porteur le 24/11) : l'appel `section`, posté depuis le cadre de la vraie Publipostage+ comme le ferait son lien avec GFS,
//      rend l'identifiant de la section de CE GFS, et la grille qui la pilote est celle de sa page : de quoi lever l'ambiguïté. Aucune marque ne reste, aucune barre, aucun cadre reconstruit.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
//   REPO_DIR=<dépôt> node lab-server.mjs &   puis   REPO_DIR=<dépôt> node run-pp-vue-ambigue.mjs
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `pp-vue-ambigue-${lang}-${scheme}`;
const ADDRESS = 'http://127.0.0.1:8911/prototype/index.html';
const QUERY = `language=${lang}&culture=${lang === 'en' ? 'en-GB' : 'fr-FR'}&live=0`;

const lab = await startLab({ lang, colorScheme: scheme, grille: true });
const { page } = lab;
await lab.fitPanel(undefined, 700, 400);

const saveBars = () => page.locator('.test-section-menu-small-btn-save').count();
const gfsFrames = () => page.frames().filter(f => f.url().startsWith(ADDRESS) && /access=full/.test(f.url()));
const settled = async frame => {
  await frame.waitForFunction(() => document.body && document.body.dataset.gfs === 'ready', null, { timeout: 60000 }).catch(() => {});
  await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
  if (await frame.locator('.mod').count()) await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
};
// Les sections que Grist garde : page, genre, table, lien (`linkSrcSectionRef`) et, pour un widget personnalisé, adresse et réglages.
const sections = frame => frame.evaluate(async () => {
  const data = await grist.docApi.fetchTable('_grist_Views_section');
  return data.id.map((id, i) => {
    let custom = null;
    if (data.parentKey[i] === 'custom') { try { custom = JSON.parse(JSON.parse(data.options[i]).customView); } catch (error) { custom = null; } }
    return { id, page: data.parentId[i], kind: data.parentKey[i], table: data.tableRef[i], link: data.linkSrcSectionRef[i], url: custom && custom.url, widgetOptions: custom && custom.widgetOptions };
  });
});
const appFrame = () => page.frames().find(f => /^http:\/\/127\.0\.0\.1:8911\/prototype\/apps\/publipostage\//.test(f.url()));
const link = (list, id) => (list.find(item => item.id === id) || {}).link;
// L'appel `section`, tel que le cadre d'une app le poste à GFS (l'enveloppe de 5.1) ; la réponse revient par un message du cadre parent.
const askSection = app => app.evaluate(() => new Promise(resolve => {
  const id = 9000 + Math.floor(Math.random() * 900);
  const timer = setTimeout(() => { removeEventListener('message', on); resolve({ delai: true }); }, 15000);
  function on(event) {
    const data = event.data;
    if (!data || data.gfs !== 0 || data.id !== id || (data.type !== 'reponse' && data.type !== 'erreur')) return;
    clearTimeout(timer);
    removeEventListener('message', on);
    resolve(data.type === 'reponse' ? data.data : { erreur: data.code });
  }
  addEventListener('message', on);
  window.parent.postMessage({ gfs: 0, type: 'appel', id, nom: 'section' }, '*');
}));

say('--- 1. première page : GFS, relié à la grille de sa page, et Publipostage+ ouverte dedans');
const first = lab.frame;
await settled(first);
const toast = target => target.evaluate(() => { const el = document.getElementById('toast'); return el && !el.hidden ? el.textContent : ''; });
for (let i = 0; i < 80 && !(await toast(first)); i++) await page.waitForTimeout(100);
let list = await sections(first);
// Les sections des pages (page 0 : les vues brutes des données, que Grist garde sans les montrer).
const customs = () => list.filter(item => item.kind === 'custom');
const grids = () => list.filter(item => item.kind === 'record' && item.page > 0);
check('une grille et un GFS sur la première page', grids().length === 1 && customs().length === 1, list);
const A = customs()[0].id;
const gridA = grids()[0].id;
check('GFS a relié sa section à la grille de la page', link(list, A) === gridA, list);
const ppA = await lab.openApp('publipostage', /\/apps\/publipostage\//);
await ppA.waitForFunction(() => { const e = document.getElementById('status-msg'); return Boolean(e && e.textContent); }, null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1500);
const linked = app => app.evaluate(async () => ({ state: GristAPI.getLinkState(), found: await ViewSource.linkedRows('Clients', []) }));
let seenA = await linked(ppA);
check('un seul GFS sur la table : Publipostage+ sait quelle vue lui est liée (aucun « ambiguous »)', seenA.found && !seenA.found.unreadable && Array.isArray(seenA.found.ids), seenA);
check('et Grist lui dit qu\'elle est reliée', seenA.state === 'linked', seenA.state);

say('--- 2. une deuxième page, avec sa grille CLIENTS, et un deuxième GFS sur la même table');
await page.locator('.test-dp-add-new').first().click();
await page.locator('.test-dp-add-new-page').click();
await page.waitForTimeout(500);
await page.locator('.test-wselect-type').filter({ hasText: /^Table$/ }).click();
await page.locator('.test-wselect-table-label').filter({ hasText: /^clients$/i }).first().click().catch(() => {});
await page.locator('.test-wselect-addBtn').click();
await page.waitForTimeout(2000);
await lab.addSection(`${ADDRESS}?${QUERY}`);
await page.waitForTimeout(1500);
await page.locator('.test-right-panel').getByText('No document access', { exact: true }).first().click();
await page.waitForTimeout(400);
await page.getByText('Full document access', { exact: true }).last().click();
for (let i = 0; i < 40 && gfsFrames().length < 1; i++) await page.waitForTimeout(500);
const second = gfsFrames()[0];
await settled(second);
await page.waitForTimeout(4500); // le lien se pose quelques secondes après l'ouverture
list = await sections(second);
const pages = [...new Set(list.map(item => item.page).filter(p => p > 0))];
check('deux pages, deux grilles CLIENTS, deux GFS à la même adresse', pages.length === 2 && grids().length === 2 && customs().length === 2 && customs()[0].url === customs()[1].url, list);
const B = customs().find(item => item.id !== A).id;
const gridB = grids().find(item => item.page === customs().find(c => c.id === B).page).id;
check('chaque GFS est relié à la grille de SA page', link(list, A) === gridA && link(list, B) === gridB && gridA !== gridB, list.map(({ id, kind, page: p, link: l }) => ({ id, kind, page: p, link: l })));
check('aucune marque de recherche ne reste dans les réglages', list.every(item => !(item.widgetOptions && 'gfs.sonde' in item.widgetOptions)), list.map(item => item.widgetOptions));
check('aucune barre « Enregistrer »', (await saveBars()) === 0, await saveBars());
await lab.shot(run, '1-deux-pages');

say('--- 3. Publipostage+ dans le deuxième GFS : le message du porteur');
const ppB = await lab.openApp('publipostage', /\/apps\/publipostage\//, second);
await ppB.waitForFunction(() => { const e = document.getElementById('status-msg'); return Boolean(e && e.textContent); }, null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1500);
const seenB = await linked(ppB);
check('Publipostage+ du deuxième GFS : « ambiguous » (« plusieurs widgets de cette table ont la même adresse que lui »)', seenB.found && seenB.found.unreadable === 'ambiguous', seenB);
check('ce que Grist lui dit ne la départage pas : sa section est « reliée », comme l\'autre', seenB.state === 'linked', seenB.state);
await lab.shotPanel(run, '2-pp-deuxieme-gfs', second);
await lab.forgetActions();
const calledB = await askSection(ppB);
check('l\'appel `section` de la Publipostage+ du deuxième GFS rend la section de CE GFS', calledB.id === B && Object.keys(calledB).join() === 'id', calledB);
{
  const after = await sections(second);
  check('la grille qui pilote cette section est celle de sa page', link(after, calledB.id) === gridB, after.map(({ id, link: l }) => ({ id, link: l })));
  check('aucune marque ne reste, aucune barre « Enregistrer »', after.every(item => !(item.widgetOptions && 'gfs.sonde' in item.widgetOptions)) && (await saveBars()) === 0);
  const again = await askSection(ppB);
  const writes2 = (await lab.actions()).filter(line => /^UpdateRecord _grist_Views_section/.test(line)).length;
  check('une deuxième demande rend la même réponse sans écrire de plus', again.id === B && writes2 === 4, { again, writes2 });
}

say('--- 4. ce que GFS sait de sa propre section');
// `ViewOptions.section()` : la recherche que le courtier fait déjà (réglages d'une app, lien « Select by »), avec les mêmes arguments que le contrôleur (js/controller.js).
const own = frame => frame.evaluate(async () => {
  const { ViewOptions, addressOf } = await import('./js/broker/view-options.js');
  const t0 = performance.now();
  const options = new ViewOptions({ doc: grist.docApi, widget: grist, address: addressOf(location.href), tableId: () => 'Clients', enabled: () => true });
  const found = await options.section();
  return { found, ms: Math.round(performance.now() - t0) };
});
await lab.forgetActions();
const answerB = await own(second);
check('le deuxième GFS retrouve sa section', answerB.found.id === B, answerB);
const writes = (await lab.actions()).filter(line => /^UpdateRecord _grist_Views_section/.test(line)).length;
say('écritures de section pendant la recherche :', writes, '; durée (ms) :', answerB.ms);
list = await sections(second);
check('aucune marque de recherche ne reste', list.every(item => !(item.widgetOptions && 'gfs.sonde' in item.widgetOptions)), list.map(item => item.widgetOptions));
check('aucune barre « Enregistrer »', (await saveBars()) === 0, await saveBars());
check('la grille qui pilote cette section est celle de sa page : l\'identifiant suffit à lever l\'ambiguïté', link(list, answerB.found.id) === gridB, list.map(({ id, link: l }) => ({ id, link: l })));

say('--- 5. retour à la première page : le premier GFS retrouve la sienne, de même');
await page.locator('.test-docpage-label').first().click();
await page.waitForTimeout(2500);
const firstAgain = gfsFrames().find(f => f !== second && f.url().startsWith(ADDRESS));
if (firstAgain) {
  await settled(firstAgain);
  const answerA = await own(firstAgain);
  check('le premier GFS retrouve sa section', answerA.found.id === A, answerA);
  list = await sections(firstAgain);
  check('et la grille de sa page', link(list, answerA.found.id) === gridA, list.map(({ id, link: l }) => ({ id, link: l })));
  const ppA2 = await lab.openApp('publipostage', /\/apps\/publipostage\//, firstAgain);
  await ppA2.waitForFunction(() => { const e = document.getElementById('status-msg'); return Boolean(e && e.textContent); }, null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const calledA = await askSection(ppA2);
  check('l\'appel `section` de la Publipostage+ du premier GFS rend la sienne, pas celle de l\'autre page', calledA.id === A, calledA);
} else say('CONSTAT le premier GFS n\'a pas rechargé après le changement de page', page.frames().map(f => f.url()).filter(u => /8911/.test(u)));

say('--- 6. une troisième page, avec un GFS NON relié (`grille=0` : GFS ne pose pas le lien) : le cas où Grist suffit à départager');
await page.locator('.test-dp-add-new').first().click();
await page.locator('.test-dp-add-new-page').click();
await page.waitForTimeout(500);
await page.locator('.test-wselect-type').filter({ hasText: /^Table$/ }).click();
await page.locator('.test-wselect-table-label').filter({ hasText: /^clients$/i }).first().click().catch(() => {});
await page.locator('.test-wselect-addBtn').click();
await page.waitForTimeout(2000);
await lab.addSection(`${ADDRESS}?${QUERY}&grille=0`);
await page.waitForTimeout(1500);
await page.locator('.test-right-panel').getByText('No document access', { exact: true }).first().click();
await page.waitForTimeout(400);
await page.getByText('Full document access', { exact: true }).last().click();
let third = null;
for (let i = 0; i < 40 && !third; i++) { third = gfsFrames().find(f => /grille=0/.test(f.url())); if (!third) await page.waitForTimeout(500); }
await settled(third);
await page.waitForTimeout(2000);
list = await sections(third);
check('trois GFS à la même adresse, sur trois pages', customs().length === 3 && new Set(customs().map(item => item.url.split('&grille')[0])).size === 1, customs());
const C = customs().find(item => item.id !== A && item.id !== B).id;
check('le troisième n\'est pas relié', link(list, C) === 0, list.map(({ id, kind, link: l }) => ({ id, kind, link: l })));
const ppC = await lab.openApp('publipostage', /\/apps\/publipostage\//, third);
await ppC.waitForFunction(() => { const e = document.getElementById('status-msg'); return Boolean(e && e.textContent); }, null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1500);
const seenC = await linked(ppC);
check('Publipostage+ du troisième GFS : « ambiguous » aussi (la table a des GFS reliés à des grilles et un qui ne l\'est pas)', seenC.found && seenC.found.unreadable === 'ambiguous', seenC);
check('mais Grist lui dit que SA section n\'est pas reliée : « unlinked » départage ce cas', seenC.state === 'unlinked', seenC.state);
const calledC = await askSection(ppC);
check('l\'appel `section` du troisième GFS (non relié) rend la sienne parmi trois', calledC.id === C, calledC);
const answerC = await own(third);
check('le troisième GFS retrouve sa section parmi trois candidates', answerC.found.id === C, answerC);
list = await sections(third);
check('aucune marque de recherche ne reste', list.every(item => !(item.widgetOptions && 'gfs.sonde' in item.widgetOptions)), list.map(item => item.widgetOptions));
check('aucune barre « Enregistrer »', (await saveBars()) === 0, await saveBars());
await lab.browser.close();
