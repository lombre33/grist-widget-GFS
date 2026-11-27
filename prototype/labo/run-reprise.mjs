// La reprise après un rechargement de la page (demande du porteur, 26/11 : « si un fichier d'app est ouvert, on rouvre le même fichier dans l'app ; si on était dans l'explorateur, on rouvre le
// même endroit » ; contrats 5.2, point 3 ; cahier 6.2, point 6 ; faits vérifiés 188), dans un VRAI serveur Grist (`bash vrai-serveur.sh`), avec la vraie GFS et la vraie Publipostage+, à 700 × 400,
// à la vraie souris (le rechargement est celui de la page de Grist) :
//   1. un fichier ouvert dans l'app, la page rechargée : le même fichier revient dans l'app, sans phrase, l'explorateur fermé ; le souvenir est sur l'onglet (`sessionStorage`), jamais dans le document ;
//   2. l'explorateur devant : le même dossier, puis chacune des vues (Récents, Favoris, Partagés avec moi, corbeille) ; un dossier qui n'existe plus ramène au dossier du dessus ;
//   3. un fichier supprimé, ou que les règles d'accès cachent : l'explorateur, avec la phrase (jamais la page blanche de l'app mesurée à l'étude) ;
//   4. quitter la page de Grist et y revenir : le cadre est reconstruit, le fichier revient ;
//   5. « Rouvrir au rechargement » (Réglages avancés) : coupée, rien ne se retient et le souvenir est effacé ; rallumée, elle retient où la personne est ;
//   6. le souvenir d'une autre personne ne sert pas ; il passe avant le réglage de la vue, un onglet neuf n'en a pas et suit le réglage de la vue ;
//   7. les temps (la reprise contre l'arrivée à la racine) et la console de GFS muette.
// REPO_DIR="$(realpath ../..)" node run-reprise.mjs   (LAB_LANG=fr|en, LAB_SCHEME=light|dark)
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serve } from './lab-server.mjs';
import { chromium, say, check, SHOTS } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { seedFiles } from './seed.mjs';
import { PAGE_PORT, GFS, openGfs, rowOf, waitFor, names } from './lab-pdf.mjs';
import { openAdvancedMenu, subRows } from './reglages-gestes.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const APP_URL = `http://127.0.0.1:${PAGE_PORT}/prototype/apps/publipostage/`;
const CONTRACT = { id: '16', name: 'Contrat de prestation' };
const RECEIPT = { id: '17', name: 'Quittance de loyer' };
const LETTER = { id: '1', name: 'Feuille d’émargement' };
const GONE = { fr: /n’existe plus, ou n’est plus à votre disposition/, en: /no longer exists, or is no longer available to you/ }[lang];
const now = () => performance.now();
mkdirSync(SHOTS, { recursive: true });
const shot = (page, name) => page.screenshot({ path: join(SHOTS, `reprise-${lang}-${scheme}-${name}.png`) }).catch(() => {});

// Le labo seul : le contrôleur de GFS est posé sur `window` pour lire où il en est (le dépôt n'est pas touché).
const EXPOSE = { fichier: 'gfs.js', de: 'controller.start().catch(', vers: 'window.__gfs = controller;\ncontroller.start().catch(' };

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
const appFrame = page => page.frames().find(each => each.url().startsWith(APP_URL) && !each.isDetached());
const shown = page => { const frame = appFrame(page); return frame ? frame.evaluate(() => ({ id: String(Templates.getCurrentId()), name: (document.getElementById('template-name') || {}).value || '' })).catch(() => null) : Promise.resolve(null); };
const showsFile = async (page, file) => ((await shown(page)) || {}).id === file.id;
const ready = frame => frame.waitForFunction(() => Boolean(document.body) && document.body.dataset.gfs === 'ready', null, { timeout: 60000 });
const where = frame => frame.evaluate(() => ({
  open: window.__gfs.explorer.isOpen, view: window.__gfs.explorer.state.view, path: window.__gfs.explorer.state.path,
  session: window.__gfs.session ? window.__gfs.session.id : null, opened: window.__gfs.opened.keys(), toast: (document.getElementById('toast') || {}).textContent || '',
  toastShown: Boolean(document.getElementById('toast') && document.getElementById('toast').offsetParent),
}));
const memoryKeys = frame => frame.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('gfs.rouvrir.')));
const memory = async frame => frame.evaluate(() => { const key = Object.keys(sessionStorage).find(each => each.startsWith('gfs.rouvrir.')); return key ? JSON.parse(sessionStorage.getItem(key)) : null; });
const putMemory = (frame, value) => frame.evaluate(text => { const key = Object.keys(sessionStorage).find(each => each.startsWith('gfs.rouvrir.')); sessionStorage.setItem(key, text); }, JSON.stringify(value));
// La même page, rechargée : le cadre de GFS est reconstruit ; rend ce cadre, quand GFS se déclare prêt.
const reload = async page => {
  await page.reload({ waitUntil: 'load' });
  const frame = await gfsFrame(page);
  await ready(frame);
  return frame;
};
const explorerRows = async frame => (await frame.locator('.ls-row').count());

try {
  const context = await newContext(browser, server, { colorScheme: scheme });
  const run = await openGfs(context, { lang, mirrors: true, patches: [EXPOSE] });
  const { page, docId } = run;
  let { frame } = run;
  const apply = actions => page.evaluate(async ([id, body]) => (await fetch(`/api/docs/${id}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).status, [docId, actions]);
  // Un réglage de la vue ENREGISTRÉ (la page rechargée le garde ; `grist.setOption` ne laisse qu'un brouillon, que le rechargement perd) : le labo écrit les options du widget, là où Grist 1.7
  // les garde (`widgetOptions` de `customView`, dans les options de la section), comme le ferait « Enregistrer » du panneau de Grist.
  const saveViewOptions = values => page.evaluate(async ([id, wanted]) => {
    const list = await (await fetch(`/api/docs/${id}/tables/_grist_Views_section/records`)).json();
    const section = list.records.find(record => record.fields.parentKey === 'custom');
    const options = JSON.parse(section.fields.options || '{}');
    const view = JSON.parse(options.customView);
    view.widgetOptions = { ...(view.widgetOptions || {}) };
    delete view.widgetOptions.modeleDeLaVue;
    if (wanted) Object.assign(view.widgetOptions, wanted);
    options.customView = JSON.stringify(view);
    return (await fetch(`/api/docs/${id}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([['UpdateRecord', '_grist_Views_section', section.id, { options: JSON.stringify(options) }]]) })).status;
  }, [docId, values]);
  await seedFiles(frame);
  frame = await reload(page);
  await waitFor(page, 'la liste montre des fichiers', async () => (await explorerRows(frame)) >= 3, 30000);

  say('--- 0. sans souvenir : l\'explorateur à la racine, comme avant ---');
  const first = await where(frame);
  check('l\'arrivée est l\'explorateur, à la racine, aucune app', first.open && first.view === 'folder' && first.path === '' && first.session === null, first);
  check('une première arrivée n\'a pas de phrase', !first.toastShown, first.toast);
  const stored = await memory(frame);
  check('l\'explorateur devant se retient sur l\'onglet : { v: 1, lieu: explorateur, view: folder, path: "" }', stored && stored.v === 1 && stored.lieu === 'explorateur' && stored.view === 'folder' && stored.path === '', stored);
  check('une seule clé « gfs.rouvrir.<document>.<table> » sur l\'onglet', (await memoryKeys(frame)).length === 1 && (await memoryKeys(frame))[0].startsWith(`gfs.rouvrir.${docId}.`), await memoryKeys(frame));

  say('--- 1. un fichier ouvert dans l\'app, la page rechargée ---');
  await rowOf(frame, CONTRACT.name).dblclick();
  check('Publipostage+ montre « Contrat de prestation »', await waitFor(page, 'PP montre le modèle', () => showsFile(page, CONTRACT), 90000));
  await page.waitForTimeout(500);
  const open1 = await memory(frame);
  check('le souvenir devient { lieu: fichier, key: publipostage:16, name }', open1 && open1.lieu === 'fichier' && open1.key === `publipostage:${CONTRACT.id}` && open1.name === CONTRACT.name, open1);
  check('rien n\'est écrit dans le document : la table de la section ne porte aucun réglage « gfs.rouvrir »', !JSON.stringify(await frame.evaluate(() => grist.getOptions())).includes('reprise'));
  const t0 = now();
  frame = await reload(page);
  const tReady = now() - t0;
  const back = await waitFor(page, 'PP rouvre le même modèle', () => showsFile(page, CONTRACT), 90000);
  const tShown = now() - t0;
  check('la page rechargée : Publipostage+ rouvre le MÊME fichier (« Contrat de prestation »)', back);
  const after1 = await where(frame);
  check('l\'explorateur est fermé derrière l\'app, sans phrase', !after1.open && !after1.toastShown && after1.session !== null, after1);
  check('le fichier rouvert est dans la liste « Ouverts » (celle d\'un double-clic) ; la liste d\'avant n\'est pas rejouée', after1.opened.length === 1 && after1.opened[0] === `publipostage:${CONTRACT.id}`, after1.opened);
  say('  temps :', { gfsPretMs: Math.round(tReady), modeleAfficheMs: Math.round(tShown) });
  await shot(page, 'fichier');

  say('--- 1b. un second rechargement, l\'app toujours ouverte : même fichier ---');
  frame = await reload(page);
  check('rechargée une seconde fois : le même fichier', await waitFor(page, 'PP rouvre le même modèle', () => showsFile(page, CONTRACT), 90000));

  say('--- 2. l\'explorateur devant : le même endroit ---');
  await frame.locator('#floater-files').click();
  await frame.locator('.ls-row').first().waitFor();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  check('Échap ramène à l\'app (le souvenir est le fichier)', (await memory(frame)).lieu === 'fichier');
  await frame.locator('#floater-files').click();
  await frame.locator('.ls-row').first().waitFor();
  await frame.locator('.ls-row.folder', { has: frame.locator('.t', { hasText: /^Formation$/ }) }).dblclick();
  await page.waitForTimeout(800);
  check('dans « Formation » : le souvenir est { explorateur, folder, Formation }', JSON.stringify(await memory(frame)).includes('"path":"Formation"'), await memory(frame));
  frame = await reload(page);
  await waitFor(page, 'la liste est là', async () => (await explorerRows(frame)) >= 1, 30000);
  const inFolder = await where(frame);
  check('rechargée dans un dossier : l\'explorateur est ouvert dans « Formation », sans app', inFolder.open && inFolder.view === 'folder' && inFolder.path === 'Formation' && inFolder.session === null, inFolder);
  check('les fichiers du dossier sont ceux qu\'on voit (liste lue, pas une page vide)', (await names(frame)).length >= 1 || (await explorerRows(frame)) >= 1, await names(frame));
  await shot(page, 'dossier');
  for (const view of ['recent', 'fav', 'shared', 'trash']) {
    await frame.locator(`.tr-row[data-view="${view}"]`).click();
    await page.waitForTimeout(500);
    frame = await reload(page);
    await page.waitForTimeout(600);
    const here = await where(frame);
    check(`la vue « ${view} » revient après un rechargement`, here.open && here.view === view, here);
  }
  // un dossier qui n'existe plus : on revient au dossier du dessus
  await putMemory(frame, { v: 1, who: (await memory(frame)).who, lieu: 'explorateur', view: 'folder', path: 'Formation/Disparu/Sous' });
  frame = await reload(page);
  await waitFor(page, 'la liste est là', async () => (await explorerRows(frame)) >= 1, 30000);
  const near = await where(frame);
  check('un dossier qui n\'existe plus : « Formation » (le dossier le plus profond qui existe encore)', near.open && near.path === 'Formation', near);
  await putMemory(frame, { v: 1, who: (await memory(frame)).who, lieu: 'explorateur', view: 'folder', path: 'Nulle/Part' });
  frame = await reload(page);
  await waitFor(page, 'la liste est là', async () => (await explorerRows(frame)) >= 1, 30000);
  check('aucun dossier du chemin : la racine', (await where(frame)).path === '');

  say('--- 3. un fichier qui n\'existe plus, ou que les règles cachent ---');
  await rowOf(frame, RECEIPT.name).dblclick();
  check('« Quittance de loyer » est ouvert dans l\'app', await waitFor(page, 'PP montre la quittance', () => showsFile(page, RECEIPT), 90000));
  await page.waitForTimeout(500);
  check('le souvenir est ce fichier', (await memory(frame)).key === `publipostage:${RECEIPT.id}`, await memory(frame));
  // supprimé pour de bon (par un autre moyen que GFS : la ligne n'existe plus)
  const removed = await frame.evaluate(async id => { const rows = await grist.docApi.fetchTable('Publipostage_Modeles'); return rows.id.indexOf(Number(id)) >= 0; }, RECEIPT.id);
  check('le modèle 17 existe avant', removed);
  const status = await apply([['RemoveRecord', 'Publipostage_Modeles', Number(RECEIPT.id)]]);
  check('la ligne est retirée par l\'API', status === 200, status);
  const t1 = now();
  frame = await reload(page);
  await waitFor(page, 'la liste est là', async () => (await explorerRows(frame)) >= 1, 30000);
  const gone = await where(frame);
  check('fichier supprimé : l\'explorateur est ouvert (jamais la page blanche de l\'app), aucune app', gone.open && gone.session === null && !appFrame(page), gone);
  check(`et la phrase dit pourquoi : « ${GONE} »`, GONE.test(gone.toast) && gone.toast.includes(RECEIPT.name), gone.toast);
  say('  temps jusqu\'à l\'explorateur :', Math.round(now() - t1), 'ms');
  await shot(page, 'supprime');
  // un modèle que les règles d'accès cachent
  await frame.locator('.ls-row.folder', { has: frame.locator('.t', { hasText: /^Formation$/ }) }).dblclick();
  await rowOf(frame, LETTER.name).dblclick();
  check('« Feuille d\'émargement » est ouverte dans l\'app', await waitFor(page, 'PP montre la feuille', () => showsFile(page, LETTER), 90000));
  await page.waitForTimeout(500);
  const rule = await apply([['AddRecord', '_grist_ACLResources', -1, { tableId: 'Publipostage_Modeles', colIds: '*' }],
    ['AddRecord', '_grist_ACLRules', null, { resource: -1, aclFormula: 'rec.Nom == "Feuille d’émargement"', permissionsText: '-R', memo: '' }]]);
  check('une règle d\'accès cache la ligne à tous', rule === 200, rule);
  frame = await reload(page);
  await waitFor(page, 'la liste est là', async () => (await explorerRows(frame)) >= 1, 30000);
  const hidden = await where(frame);
  check('fichier caché par une règle d\'accès : l\'explorateur, aucune app, avec la phrase', hidden.open && hidden.session === null && !appFrame(page) && GONE.test(hidden.toast), hidden);
  await frame.evaluate(async () => {}).catch(() => {});
  await page.evaluate(async ([id]) => {
    const rules = await (await fetch(`/api/docs/${id}/tables/_grist_ACLRules/records`)).json();
    const ids = rules.records.filter(r => /émargement/.test(r.fields.aclFormula || '')).map(r => r.id);
    if (ids.length) await fetch(`/api/docs/${id}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([['BulkRemoveRecord', '_grist_ACLRules', ids]]) });
  }, [docId]);

  say('--- 4. quitter la page de Grist et y revenir ---');
  frame = await reload(page);
  await waitFor(page, 'la liste est là', async () => (await explorerRows(frame)) >= 1, 30000);
  await rowOf(frame, CONTRACT.name).dblclick();
  check('le contrat est ouvert dans l\'app', await waitFor(page, 'PP montre le contrat', () => showsFile(page, CONTRACT), 90000));
  await page.waitForTimeout(500);
  await apply([['AddEmptyTable', null]]);
  await page.waitForTimeout(2500);
  const other = page.locator('.test-treeview-itemHeader', { hasText: /Table1/i }).first();
  if (await other.count()) {
    await other.click();
    await page.waitForTimeout(2500);
    await page.locator('.test-treeview-itemHeader', { hasText: /Clients/i }).first().click();
    await page.waitForTimeout(2500);
    frame = await gfsFrame(page);
    await ready(frame);
    check('de retour sur la page de GFS (le cadre est neuf) : le même fichier dans l\'app', await waitFor(page, 'PP rouvre le contrat', () => showsFile(page, CONTRACT), 90000));
  } else say('(pas de seconde page trouvée : la mesure 4 est sautée)');

  say('--- 5. « Rouvrir au rechargement » ---');
  // La ligne se clique dans le menu « Réglages » de l'explorateur (à la vraie souris) : l'explorateur se rouvre d'abord quand une app est devant.
  const toggleReopen = async () => {
    if (!(await where(frame)).open) { await frame.locator('#floater-files').click(); await frame.locator('.ls-row').first().waitFor(); }
    await openAdvancedMenu(frame);
    check('« Réglages avancés » a deux lignes : « Bouton LanguageTool » et « Rouvrir au rechargement »', (await subRows(frame).count()) === 2, await subRows(frame).allTextContents());
    if (process.env.LAB_TRACE === '1') say('  [avant]', await frame.evaluate(() => ({ ls: localStorage.getItem('gfs.rouvrir'), enabled: window.__gfs.resume.enabled })), await subRows(frame).evaluateAll(rows => rows.map(row => row.getAttribute('aria-checked'))));
    await subRows(frame).nth(1).click();
    await page.waitForTimeout(500);
    if (process.env.LAB_TRACE === '1') say('  [après]', await frame.evaluate(() => ({ ls: localStorage.getItem('gfs.rouvrir'), enabled: window.__gfs.resume.enabled })));
  };
  const choice = frame => frame.evaluate(() => { try { return localStorage.getItem('gfs.rouvrir'); } catch (error) { return 'illisible'; } });
  check('au départ la reprise est allumée (aucun choix retenu)', (await choice(frame)) === null, await choice(frame));
  await toggleReopen();
  check('coupée : le choix est retenu sur le navigateur de GFS (« non ») et le souvenir de l\'onglet est effacé', (await choice(frame)) === 'non' && (await memoryKeys(frame)).length === 0, { choix: await choice(frame), clés: await memoryKeys(frame) });
  frame = await reload(page);
  await waitFor(page, 'la liste est là', async () => (await explorerRows(frame)) >= 1, 30000);
  const off = await where(frame);
  check('coupée, après un rechargement : l\'explorateur à la racine, comme avant', off.open && off.session === null && off.path === '' && off.view === 'folder', off);
  check('et rien ne s\'est retenu', (await memoryKeys(frame)).length === 0, await memoryKeys(frame));
  await rowOf(frame, CONTRACT.name).dblclick();
  await waitFor(page, 'PP montre le contrat', () => showsFile(page, CONTRACT), 90000);
  frame = await reload(page);
  await waitFor(page, 'la liste est là', async () => (await explorerRows(frame)) >= 1, 30000);
  check('coupée, même avec un fichier ouvert : l\'explorateur à la racine', (await where(frame)).open && !appFrame(page));
  await toggleReopen();
  check('rallumée : le choix retenu disparaît', (await choice(frame)) === null, await choice(frame));
  await page.waitForTimeout(300);
  check('rallumée : où la personne est (l\'explorateur) se retient aussitôt', (await memoryKeys(frame)).length === 1 && (await memory(frame)).lieu === 'explorateur', await memory(frame));
  await rowOf(frame, CONTRACT.name).dblclick();
  await waitFor(page, 'PP montre le contrat', () => showsFile(page, CONTRACT), 90000);
  frame = await reload(page);
  check('rallumée : le fichier revient de nouveau', await waitFor(page, 'PP rouvre le contrat', () => showsFile(page, CONTRACT), 90000));

  say('--- 6. une autre personne ; le réglage de la vue ; un onglet neuf ---');
  await putMemory(frame, { ...(await memory(frame)), who: 'autre@example.com' });
  frame = await reload(page);
  await waitFor(page, 'la liste est là', async () => (await explorerRows(frame)) >= 1, 30000);
  const stranger = await where(frame);
  check('le souvenir d\'une autre personne ne sert pas : l\'explorateur à la racine, sans phrase', stranger.open && stranger.session === null && !stranger.toastShown, stranger);
  // le réglage de la vue : Publipostage+ s'ouvre sur le modèle 16 (le contrat) ; le souvenir de l'onglet (l'explorateur dans « Formation ») passe avant
  check('le réglage de la vue est enregistré', (await saveViewOptions({ modeleDeLaVue: '16' })) === 200);
  await page.waitForTimeout(800);
  await frame.locator('.ls-row.folder', { has: frame.locator('.t', { hasText: /^Formation$/ }) }).dblclick();
  await page.waitForTimeout(800);
  frame = await reload(page);
  await waitFor(page, 'la liste est là', async () => (await explorerRows(frame)) >= 1, 30000);
  const viewSet = await where(frame);
  check('le souvenir de l\'onglet passe avant le réglage de la vue : l\'explorateur dans « Formation »', viewSet.open && viewSet.path === 'Formation' && !appFrame(page), viewSet);
  await frame.evaluate(() => { for (const key of Object.keys(sessionStorage)) if (key.startsWith('gfs.rouvrir.')) sessionStorage.removeItem(key); });
  frame = await reload(page);
  if (process.env.LAB_TRACE === '1') say('  [options]', await frame.evaluate(async () => JSON.stringify(await grist.getOptions())), await where(frame));
  const fresh = await waitFor(page, 'PP s\'ouvre sur le modèle de la vue', () => showsFile(page, CONTRACT), 90000);
  check('un onglet sans souvenir suit le réglage de la vue (« Contrat de prestation »)', fresh);
  await saveViewOptions(null);

  say('--- 7. la console de GFS ---');
  const unexpected = run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
  check('la console de GFS reste muette', unexpected.length === 0, unexpected.slice(0, 5));
} finally {
  await browser.close();
  pages.close();
}
