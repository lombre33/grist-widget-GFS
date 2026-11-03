// La ligne de la table de la page (contrats 4.5, point 7), dans un vrai Grist, à 700 × 400, à la vraie souris et au vrai clavier. GFS reste sur la page Clients, sa section n'est
// pas reliée par « Select by » et rien n'est réglé dans Grist.
// A. Grist ne dit aucune ligne à GFS (un filtre enregistré sur la section écarte toutes celles de Clients : le curseur n'a plus de ligne, `rowId` vaut `undefined` dans le message de
//    table, WidgetFrame.ts) : Publipostage+, ouverte ensuite en Lecture, reçoit quand même la première ligne du tableau, sans le guide « Reliez ce widget ».
// B. Le bouton « Ligne » du premier article, « La table de la page » : la ligne choisie est celle de l'app, un changement de données ne la défait pas, et une ligne que Grist dit
//    ensuite (`setCursorPos` dans la section) la remplace. Au clavier : flèche droite, flèche bas, Entrée.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `page-ligne-${lang}-${scheme}`;
const WORDS = lang === 'fr'
  ? { page: 'La table de la page : Clients', tipPage: /celle de la page \(Clients\)$/, tipRow: /celle de la page \(Clients\), ligne /, rowOf: 'Choisir aussi la ligne de Clients', guide: /Reliez ce widget/i }
  : { page: 'The page’s table: Clients', tipPage: /the page’s \(Clients\)$/, tipRow: /the page’s \(Clients\), row /, rowOf: 'Also choose the row of Clients', guide: /Link (this )?widget|Reliez ce widget/i };

const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const errors = [];
page.on('console', m => { if ((m.type() === 'warning' || m.type() === 'error') && /^GFS/.test(m.text())) errors.push(m.text()); });
await lab.fitPanel(undefined, 700, 400);
await seedFiles(lab.frame);
await lab.frame.evaluate(() => location.reload());
await page.waitForTimeout(1000);
let frame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(frame);
await page.waitForTimeout(800);
await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
if (await frame.locator('.mod').count()) await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// Le document du labo n'a que deux clients : deux de plus, pour choisir une troisième ligne.
await frame.evaluate(async () => {
  const have = (await grist.docApi.fetchTable('Clients')).id.length;
  if (have < 4) await grist.docApi.applyUserActions([['BulkAddRecord', 'Clients', [null, null], { Nom: ['Garnier', 'Lefèvre'], Ville: ['Nice', 'Lille'] }]]);
});
const clients = await frame.evaluate(async () => {
  const data = await grist.docApi.fetchTable('Clients');
  return data.id.map((id, i) => ({ id, sort: data.manualSort[i], nom: (data.Nom || [])[i] })).sort((a, b) => a.sort - b.sort);
});
say('Clients, dans l\'ordre du tableau :', clients);
check('Clients a au moins quatre lignes', clients.length >= 4, clients.length);
const workButton = () => frame.locator('#floater-work');
const openFile = async name => {
  await frame.locator('#floater-files').click().catch(() => {});
  await frame.locator('.ls-row').first().waitFor();
  await frame.locator('.ls-row', { hasText: name }).first().dblclick();
};
// L'app Publipostage+ ouverte en ce moment (un cadre rouvert est un autre cadre), prête, en mode lecture.
const readingApp = async () => {
  const app = await lab.appFrame(/publipostage/);
  await app.waitForFunction(() => { const e = document.getElementById('status-msg'); return Boolean(e && e.textContent); }, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  if (!(await app.locator('#btn-mode-read').getAttribute('class') || '').includes('active')) await app.locator('#btn-mode-read').click();
  await page.waitForTimeout(1500);
  return app;
};
const readerText = app => app.evaluate(() => (document.getElementById('reader-container')?.innerText || '').replace(/\s+/g, ' ').slice(0, 200));
const currentId = app => app.evaluate(() => { const record = GristAPI.getCurrentRecord(); return record ? record.id : null; });
const waitId = (app, wanted) => app.waitForFunction(id => { const r = GristAPI.getCurrentRecord(); return Boolean(r) && r.id === id; }, wanted, { timeout: 15000 }).then(() => true, () => false);
const items = () => frame.locator('.wk-item').allInnerTexts().then(list => list.map(text => text.replace(/\s+/g, ' ').trim()));

// A. Un filtre enregistré écarte toutes les lignes de la section : Grist n'a plus de ligne à dire.
const sectionRows = () => frame.evaluate(async () => (await grist.fetchSelectedTable()).id.length);
const before = await sectionRows();
const filterId = await frame.evaluate(async () => {
  const sections = await grist.docApi.fetchTable('_grist_Views_section');
  const at = sections.id.findIndex((id, i) => sections.parentKey[i] === 'custom');
  const tables = await grist.docApi.fetchTable('_grist_Tables');
  const columns = await grist.docApi.fetchTable('_grist_Tables_column');
  const tableRef = tables.id[tables.tableId.indexOf('Clients')];
  const colRef = columns.id.find((id, i) => columns.parentId[i] === tableRef && columns.colId[i] === 'Nom');
  const result = await grist.docApi.applyUserActions([['AddRecord', '_grist_Filters', null, { viewSectionRef: sections.id[at], colRef, filter: JSON.stringify({ included: [] }), pinned: false }]]);
  return result.retValues[0];
});
await page.waitForTimeout(1500);
const after = await sectionRows();
say('lignes de la section avant / après le filtre :', before, after);
check('le filtre écarte toutes les lignes de la section : Grist n\'a plus de ligne à dire', before >= 4 && after === 0, { avant: before, apres: after });

await openFile('Contrat de prestation');
let app = await readingApp();
say('état du lien vu par l\'app :', await app.evaluate(() => GristAPI.getLinkState()));
const text = await readerText(app);
say('Lecture sans ligne de Grist :', text);
check('A. l\'app reçoit la première ligne du tableau : pas de guide « Reliez ce widget »', !WORDS.guide.test(text) && await currentId(app) === clients[0].id, { lu: text, ligne: await currentId(app), attendu: clients[0].id });
await lab.shotPanel(run, 'A-lecture-sans-ligne', frame);

// On retire le filtre : Grist redit sa ligne (la première).
await frame.evaluate(id => grist.docApi.applyUserActions([['RemoveRecord', '_grist_Filters', id]]), filterId);
await page.waitForTimeout(1500);
check('le filtre retiré, la section a de nouveau ses lignes', await sectionRows() === clients.length);
check('le bouton ne dit rien de plus que la page', await workButton().getAttribute('aria-pressed') === 'false' && WORDS.tipPage.test(await workButton().getAttribute('title')), await workButton().getAttribute('title'));

// B. Le bouton « Ligne » de la table de la page, à la souris.
await workButton().click();
await frame.locator('.wk').waitFor();
const tables = await items();
check('le premier article est « La table de la page »', tables[0] === WORDS.page, tables);
const pageRows = frame.locator('[data-fk="work-rows-page"]');
check('« La table de la page » a son bouton « Ligne »', await pageRows.isVisible() && await pageRows.getAttribute('aria-label') === WORDS.rowOf, await pageRows.getAttribute('aria-label'));
await lab.shotPanel(run, 'B-1-tables', frame);
await pageRows.click();
await frame.locator('.wk-back').waitFor({ state: 'visible' });
await frame.waitForFunction(count => document.querySelectorAll('.wk-item').length >= count, clients.length, { timeout: 15000 });
const listed = await items();
say('lignes proposées :', listed);
check('la liste est celle des lignes de Clients, dans l\'ordre du tableau', listed.length === clients.length && clients.every((row, i) => !row.nom || listed[i].includes(row.nom)), listed);
await lab.shotPanel(run, 'B-2-lignes', frame);
await frame.locator('.wk-item').nth(2).click();
await page.waitForTimeout(800);
check('la fenêtre s\'est fermée', !(await frame.locator('.wk').count()));
check('B. l\'app travaille sur la ligne choisie, sans être rouverte', await waitId(app, clients[2].id) && !app.isDetached(), await currentId(app));
check('le bouton est enfoncé et nomme la page et la ligne', await workButton().getAttribute('aria-pressed') === 'true' && WORDS.tipRow.test(await workButton().getAttribute('title')), await workButton().getAttribute('title'));
await lab.shotPanel(run, 'B-3-ligne-choisie', frame);

// Un changement de données dans Grist : Grist redit sa ligne, la ligne choisie ici reste.
await frame.evaluate(id => grist.docApi.applyUserActions([['UpdateRecord', 'Clients', id, { Nom: 'Nom modifié par l\'essai' }]]), clients[0].id);
await page.waitForTimeout(2000);
check('un changement de données ne défait pas la ligne choisie', await currentId(app) === clients[2].id, await currentId(app));

// Grist change de ligne : la sienne passe avant.
await frame.evaluate(id => grist.setCursorPos({ rowId: id }), clients[1].id);
check('C. une ligne que Grist dit ensuite remplace la ligne choisie', await waitId(app, clients[1].id), await currentId(app));
await page.waitForTimeout(500);
check('le bouton est relâché et ne dit que la page', await workButton().getAttribute('aria-pressed') === 'false' && WORDS.tipPage.test(await workButton().getAttribute('title')), await workButton().getAttribute('title'));

// B au clavier : le bouton de la barre, la recherche, flèche bas sur la page, flèche droite vers ses lignes, flèche bas, Entrée.
await workButton().focus();
await page.keyboard.press('Enter');
await frame.locator('.wk').waitFor();
check('la recherche a le clavier', await frame.evaluate(() => document.activeElement && document.activeElement.dataset.fk === 'work-search'));
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowRight');
await frame.locator('.wk-back').waitFor({ state: 'visible' });
await frame.waitForFunction(count => document.querySelectorAll('.wk-item').length >= count, clients.length, { timeout: 15000 });
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
await page.waitForTimeout(800);
const keyed = await currentId(app);
check('au clavier, la troisième ligne', keyed === clients[2].id, keyed);

// Revenir à « La table de la page » sans ligne : la page décide, la ligne choisie est oubliée.
await workButton().click();
await frame.locator('.wk').waitFor();
check('la page est marquée, et la ligne choisie l\'est dans sa liste', await frame.locator('.wk-item[aria-current="true"]').first().innerText().then(t => t.includes('Clients')));
await frame.locator('.wk-item').first().click();
await page.waitForTimeout(800);
check('revenu à la page : le bouton est relâché', await workButton().getAttribute('aria-pressed') === 'false' && WORDS.tipPage.test(await workButton().getAttribute('title')));

const own = errors.filter(text => !/Current access level none/.test(text));
say('erreurs et avertissements de GFS :', own);
check('aucune erreur ni avertissement de GFS', own.length === 0, own);
await lab.browser.close();
