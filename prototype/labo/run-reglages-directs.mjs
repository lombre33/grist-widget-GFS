// Les réglages d'une app écrits dans la vue, sans « Enregistrer » (contrats 7.3), dans un vrai Grist, avec la vraie Publipostage+ que GFS référence, à 700 × 400, à la vraie souris et au vrai clavier.
// Le geste qui a fait naître le besoin (03/11) : Réglages > Vue > « Utiliser le modèle ouvert pour cette vue » ouvrait la barre « Enregistrer » de Grist.
//   1. Le geste : aucune barre ; le réglage est dans `_grist_Views_section.options` (`customView.widgetOptions.modeleDeLaVue`), le reste de la section tel quel (accès, adresse, autres options) ; aucun cadre
//      reconstruit (GFS ni l'app) ; l'app reçoit l'écho des réglages et l'événement `reglages` (`enregistres: true`).
//   2. « Retirer » : la clé repasse à `null` dans la vue, toujours sans barre.
//   3. Le réglage tient : GFS rechargé, la vue s'ouvre sur l'app et sur ce modèle (arrivée, contrats 7.4, point 7) : il est dans le document, donc pour toutes les personnes.
//   4. Deux GFS sur la même table : chaque app écrit dans SA vue, l'autre ne bouge pas, aucune marque de recherche ne reste, aucune barre ; deux vues semblables se distinguent par la recherche (marques),
//      deux vues qui ne se ressemblent plus par ce que Grist dit à GFS, d'une seule écriture.
//   5. Un brouillon déjà posé (« Enregistrer » est là) : le réglage rejoint le brouillon, rien n'est écrit dans la vue, l'app est prévenue (`enregistres: false`) ; « Retour » rend la vue comme elle était.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `reglages-directs-${lang}-${scheme}`;
const DOCUMENT = { id: '16', name: 'Contrat de prestation' };
const SECOND = { id: '17', name: 'Quittance de loyer' };
const ADDRESS = 'http://127.0.0.1:8911/prototype/index.html';

const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const warnings = [];
page.on('console', message => { if (message.type() === 'warning' && message.text().startsWith('GFS')) warnings.push(message.text()); });
await lab.fitPanel(undefined, 700, 400);
await seedFiles(lab.frame);

const saveBars = () => page.locator('.test-section-menu-small-btn-save').count();
const gfsFrames = () => page.frames().filter(f => f.url().startsWith(ADDRESS) && /access=full/.test(f.url()));
const appFrames = () => page.frames().filter(f => /^http:\/\/127\.0\.0\.1:8911\/prototype\/apps\/publipostage\//.test(f.url()));
const settled = async frame => {
  await frame.waitForFunction(() => document.body && document.body.dataset.gfs === 'ready', null, { timeout: 60000 }).catch(() => {});
  await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
  if (await frame.locator('.mod').count()) await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
};
// Ce que Grist garde des sections personnalisées : leur réglages de widget, leur accès, leur adresse, et tout le reste de `options` (ce que GFS ne doit pas toucher).
const sections = frame => frame.evaluate(async () => {
  const data = await grist.docApi.fetchTable('_grist_Views_section');
  return data.id.map((id, i) => ({ id, parentKey: data.parentKey[i], text: data.options[i] })).filter(item => item.parentKey === 'custom').map(item => {
    const options = JSON.parse(item.text);
    const custom = JSON.parse(options.customView);
    const { customView, ...others } = options;
    return { id: item.id, widgetOptions: custom.widgetOptions, access: custom.access, url: custom.url, others, otherCustom: { ...custom, widgetOptions: undefined } };
  });
});
const keys = widgetOptions => (widgetOptions ? Object.keys(widgetOptions).sort() : []);
const noMark = list => list.every(item => !('gfs.sonde' in (item.widgetOptions || {})));

const appOf = async (frame, name) => {
  await frame.locator('#floater-files').click().catch(() => {});
  await frame.locator('.ls-row').first().waitFor();
  await frame.locator('.ls-row', { hasText: name }).first().dblclick();
  const app = await lab.appFrame(/\/apps\/publipostage\//);
  await app.waitForFunction(() => { const e = document.getElementById('status-msg'); return Boolean(e && e.textContent); }, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  return app;
};
// Ce que l'app et son cadre gardent pour prouver qu'ils n'ont pas été reconstruits, et les événements `reglages` de GFS qu'elle reçoit.
const watch = async (frame, app) => {
  await frame.evaluate(() => { window.__marque = 'avant'; });
  await app.evaluate(() => {
    window.__marque = 'avant';
    window.__reglages = [];
    if (window.__ecoute) return; // une seule écoute par cadre, sinon chaque événement est compté autant de fois qu'on a appelé `watch`
    window.__ecoute = true;
    window.addEventListener('message', event => { const d = event.data; if (d && d.gfs === 0 && d.type === 'evenement' && d.nom === 'reglages') window.__reglages.push(d.data); });
  });
};
const marks = (frame, app) => Promise.all([frame.evaluate(() => window.__marque).catch(() => 'rechargé'), app.evaluate(() => window.__marque).catch(() => 'rechargé')]);
const received = app => app.evaluate(() => window.__reglages.slice());
const viewState = app => app.evaluate(() => ({ view: ViewTemplate.getId(), options: GristAPI.getWidgetOptions(), reminder: document.getElementById('settings-save-reminder').textContent }));
// Les gestes de la personne, à la vraie souris : Réglages > Vue > le bouton.
const openViewSettings = async app => {
  if (!(await app.locator('#settings-modal').isVisible())) await app.locator('#v2-btn-settings').click();
  await app.locator('[data-settings-tab="rowTemplate"]').click();
  await page.waitForTimeout(300);
};
const clickAndWait = async (app, selector) => { await app.locator(selector).click(); await page.waitForTimeout(1500); };

// ===== 0. Départ : GFS, une table, Publipostage+ ouverte sur un modèle depuis l'explorateur.
say('--- 0. départ');
// Les modèles d'essai sont semés : GFS repart pour lire la liste des fichiers du document.
await lab.frame.evaluate(() => location.reload());
await page.waitForTimeout(1000);
let frame = await lab.gfsFrame(/access=full/);
await settled(frame);
const start = await sections(frame);
check('une seule section de GFS, sans réglage de widget', start.length === 1 && keys(start[0].widgetOptions).length === 0, start);
check('aucune barre « Enregistrer » au départ', (await saveBars()) === 0);
let app = await appOf(frame, DOCUMENT.name);
await watch(frame, app);

// ===== 1. Le geste de la personne.
say('--- 1. Réglages > Vue > « Utiliser le modèle ouvert pour cette vue »');
await openViewSettings(app);
await lab.shotPanel(run, '1-avant', frame);
await clickAndWait(app, '#settings-viewtemplate-set');
const set = await sections(frame);
check('aucune barre « Enregistrer » dans Grist', (await saveBars()) === 0, await saveBars());
check('le modèle de la vue est dans la section de GFS (`widgetOptions.modeleDeLaVue`)', set[0].widgetOptions && set[0].widgetOptions.modeleDeLaVue === DOCUMENT.id, set[0].widgetOptions);
check('rien d\'autre n\'a bougé dans la section : accès, adresse, autres options', set[0].access === start[0].access && set[0].url === start[0].url && JSON.stringify(set[0].others) === JSON.stringify(start[0].others)
  && JSON.stringify(set[0].otherCustom) === JSON.stringify(start[0].otherCustom), { avant: start[0], apres: set[0] });
const afterSet = await viewState(app);
check('l\'app relit son réglage (écho de Grist) : le modèle de la vue est celui du modèle ouvert', afterSet.view === DOCUMENT.id && afterSet.options.modeleDeLaVue === DOCUMENT.id, afterSet);
check('l\'app reçoit l\'événement `reglages` : enregistré dans la vue', JSON.stringify(await received(app)) === JSON.stringify([{ enregistres: true }]), await received(app));
check('ni le cadre de GFS ni celui de l\'app n\'ont été reconstruits', (await marks(frame, app)).join() === 'avant,avant', await marks(frame, app));
check('GFS n\'a rien dit en console (aucun repli sur le brouillon)', warnings.length === 0, warnings);
say('rappel « Enregistrer » de Publipostage+ (son texte, à taire quand GFS dit que c\'est enregistré) :', JSON.stringify(afterSet.reminder));
await lab.shotPanel(run, '1-apres', frame);

// ===== 2. « Retirer ».
say('--- 2. « Retirer »');
await clickAndWait(app, '#settings-viewtemplate-clear');
const cleared = await sections(frame);
check('« Retirer » : la clé est à `null` dans la vue, toujours sans barre', cleared[0].widgetOptions && cleared[0].widgetOptions.modeleDeLaVue === null && (await saveBars()) === 0, { options: cleared[0].widgetOptions, barres: await saveBars() });
check('l\'app a reçu un second événement : enregistré', JSON.stringify(await received(app)) === JSON.stringify([{ enregistres: true }, { enregistres: true }]), await received(app));
await clickAndWait(app, '#settings-viewtemplate-set');
check('de nouveau choisi : `modeleDeLaVue` est revenu', (await sections(frame))[0].widgetOptions.modeleDeLaVue === DOCUMENT.id);

// ===== 3. Le réglage tient : GFS rechargé, la vue s'ouvre sur l'app et sur ce modèle.
say('--- 3. GFS rechargé');
await app.locator('#settings-close').click();
await frame.evaluate(() => location.reload());
await page.waitForTimeout(1000);
frame = await lab.gfsFrame(/access=full/);
await settled(frame);
app = await lab.appFrame(/\/apps\/publipostage\//);
await app.waitForFunction(() => { const e = document.getElementById('status-msg'); return Boolean(e && e.textContent); }, null, { timeout: 30000 });
await page.waitForTimeout(1500);
const reopened = await app.evaluate(() => ({ id: String(Templates.getCurrentId()), name: document.getElementById('template-name').value, view: ViewTemplate.getId() }));
check('la vue s\'ouvre d\'elle-même sur Publipostage+ et sur le modèle retenu, sans rien demander', reopened.id === DOCUMENT.id && reopened.name === DOCUMENT.name && reopened.view === DOCUMENT.id, reopened);
check('toujours aucune barre « Enregistrer »', (await saveBars()) === 0);
await lab.shotPanel(run, '3-recharge', frame);
await watch(frame, app);

// ===== 4. Deux GFS sur la même table.
say('--- 4. deux GFS sur la même table');
await lab.addSection(`${ADDRESS}?language=${lang}&culture=${lang === 'en' ? 'en-GB' : 'fr-FR'}&live=0`);
await page.waitForTimeout(1500);
await page.locator('.test-right-panel').getByText('No document access', { exact: true }).first().click();
await page.waitForTimeout(400);
await page.getByText('Full document access', { exact: true }).last().click();
for (let i = 0; i < 40 && gfsFrames().length < 2; i++) await page.waitForTimeout(500);
await page.waitForTimeout(1500);
check('deux cadres de GFS en accès complet', gfsFrames().length === 2, gfsFrames().length);
let [first, second] = gfsFrames();
for (const each of [first, second]) await settled(each);
const both = await sections(first);
const ids = both.map(item => item.id).sort((a, b) => a - b);
check('deux sections de GFS, même adresse, sur la même table', both.length === 2 && both[0].url === both[1].url, both.map(item => ({ id: item.id, url: item.url })));
// La première GFS a rechargé à l'ajout de la section : son app s'est rouverte d'elle-même (le réglage de la vue est dans le document). La seconde ouvre la sienne par l'explorateur.
await appOf(second, SECOND.name);
const ppOf = frame => appFrames().find(each => each.parentFrame() === frame);
let ppFirst = ppOf(first);
const ppSecond = ppOf(second);
check('chaque GFS a sa Publipostage+', Boolean(ppFirst) && Boolean(ppSecond));
// Les deux vues disent la même chose (aucun réglage) : GFS ne peut les distinguer que par la recherche (marques posées un instant, relues par `getOptions`).
await first.evaluate(async id => {
  const data = await grist.docApi.fetchTable('_grist_Views_section');
  const options = JSON.parse(data.options[data.id.indexOf(id)]);
  const custom = JSON.parse(options.customView);
  custom.widgetOptions = null;
  options.customView = JSON.stringify(custom);
  await grist.docApi.applyUserActions([['UpdateRecord', '_grist_Views_section', id, { options: JSON.stringify(options) }]]);
}, ids[0]);
await page.waitForTimeout(1000);
await watch(second, ppSecond);
await lab.forgetActions();
await openViewSettings(ppSecond);
await clickAndWait(ppSecond, '#settings-viewtemplate-set');
const writesOf = async () => (await lab.actions()).filter(line => /^UpdateRecord _grist_Views_section/.test(line)).length;
const probed = await writesOf();
const afterProbe = await sections(first);
const byId = Object.fromEntries(afterProbe.map(item => [item.id, item]));
check('deux vues semblables : le modèle choisi dans la seconde GFS est écrit dans SA vue, la première reste sans réglage', byId[ids[1]].widgetOptions && byId[ids[1]].widgetOptions.modeleDeLaVue === SECOND.id && keys(byId[ids[0]].widgetOptions).length === 0,
  afterProbe.map(item => ({ id: item.id, options: item.widgetOptions })));
check('la recherche a posé des marques, les a retirées, puis a écrit (plus d\'une écriture de section)', probed > 1, probed);
check('aucune marque de recherche ne reste dans aucune vue', noMark(afterProbe), afterProbe.map(item => item.widgetOptions));
check('toujours aucune barre « Enregistrer »', (await saveBars()) === 0, await saveBars());
check('l\'app de la seconde GFS a reçu : enregistré', JSON.stringify(await received(ppSecond)) === JSON.stringify([{ enregistres: true }]), await received(ppSecond));
check('aucun cadre reconstruit par la recherche et l\'écriture', (await marks(second, ppSecond)).join() === 'avant,avant', await marks(second, ppSecond));
await lab.shotPanel(run, '4-deux-gfs', second);
// Les vues ne se ressemblent plus : la première GFS se reconnaît à ce que Grist lui dit, sans recherche, d'une seule écriture.
ppFirst = ppOf(first);
await watch(first, ppFirst);
await lab.forgetActions();
await openViewSettings(ppFirst);
await clickAndWait(ppFirst, '#settings-viewtemplate-set');
const direct = await writesOf();
const afterDirect = await sections(first);
const byId2 = Object.fromEntries(afterDirect.map(item => [item.id, item]));
check('deux vues qui ne se ressemblent plus : la première écrit dans la sienne, la seconde garde la sienne', byId2[ids[0]].widgetOptions && byId2[ids[0]].widgetOptions.modeleDeLaVue === DOCUMENT.id && byId2[ids[1]].widgetOptions.modeleDeLaVue === SECOND.id,
  afterDirect.map(item => ({ id: item.id, options: item.widgetOptions })));
check('sans recherche : une seule écriture de section', direct === 1, direct);
check('toujours aucune barre « Enregistrer »', (await saveBars()) === 0, await saveBars());

// ===== 5. Un brouillon déjà posé.
say('--- 5. un brouillon déjà posé');
await first.evaluate(() => grist.setOption('gfs.essai', 1));
await page.waitForTimeout(800);
check('le brouillon fait apparaître « Enregistrer »', (await saveBars()) === 1, await saveBars());
const beforeDraft = await sections(first);
await watch(first, ppFirst);
await lab.forgetActions();
await clickAndWait(ppFirst, '#settings-viewtemplate-clear');
for (let i = 0; i < 40 && (await received(ppFirst)).length === 0; i++) await page.waitForTimeout(250);
const draftAfter = await sections(first);
check('rien n\'est écrit dans la vue (ni réglage, ni marque) : elle est comme avant, le réglage rejoint le brouillon', JSON.stringify(draftAfter) === JSON.stringify(beforeDraft) && (await writesOf()) === 0,
  { avant: beforeDraft.map(item => item.widgetOptions), apres: draftAfter.map(item => item.widgetOptions), ecritures: await writesOf() });
check('l\'app est prévenue : brouillon (`enregistres: false`)', JSON.stringify(await received(ppFirst)) === JSON.stringify([{ enregistres: false }]), await received(ppFirst));
const draftOptions = await first.evaluate(() => grist.getOptions());
check('le brouillon porte le réglage de l\'app et la clé de GFS', draftOptions && draftOptions.modeleDeLaVue === null && draftOptions['gfs.essai'] === 1, draftOptions);
check('« Enregistrer » est toujours là, comme avant', (await saveBars()) === 1);
await lab.shotPanel(run, '5-brouillon', first);
await page.locator('.test-section-menu-small-btn-revert').first().click();
await page.waitForTimeout(800);
check('« Retour » : la barre disparaît et la vue est comme avant le brouillon', (await saveBars()) === 0 && JSON.stringify(await sections(first)) === JSON.stringify(beforeDraft));
const draftWarnings = warnings.filter(text => /brouillon/.test(text));
check('GFS dit en console pourquoi c\'est un brouillon (une seule fois)', draftWarnings.length === 1 && /brouillon est déjà posé/.test(draftWarnings[0]), draftWarnings);

await lab.browser.close();
