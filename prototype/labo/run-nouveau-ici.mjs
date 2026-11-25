// « Nouveau » crée là où la personne est (demande du porteur du 25/11 : « quand on fait Nouveau dans GFS, ça met à la racine et pas là où l'on est dans l'arborescence, testé dans un
// espace ça n'a pas fonctionné »), joué dans un VRAI serveur Grist (l'image officielle, `bash vrai-serveur.sh`) avec la vraie Publipostage+ (`bash build-mirror.sh` d'abord : ses bibliothèques
// viennent du miroir), à 700 × 400, à la vraie souris et au vrai clavier. Ce que ni grist-static ni un faux Grist écrit par nous ne disent : ce que la vraie app écrit à son premier
// « Enregistrer » (elle ne lit pas `dossier`), le numéro que Grist rend à l'ajout (`retValues`), la ligne de rangement et la ligne de placement qui en naissent. Chromium seulement.
//   bash vrai-serveur.sh && bash build-mirror.sh && REPO_DIR="$(realpath ../..)" node run-nouveau-ici.mjs        (LAB_LANG=fr|en)
//   1. « Nouveau dossier » naît là où l'on est : à la racine de « Moi », dans un sous-dossier, dans un dossier d'espace (il tenait déjà ; le test le garde).
//   2. « Nouveau > Document » depuis un sous-dossier de « Moi » : le modèle enregistré est dans ce sous-dossier (la ligne de rangement de l'app est à l'adresse de la personne), pas à la racine.
//   3. Depuis « Récents » : à la racine. Depuis la racine : à la racine, sans ligne de rangement. Un modèle vierge qu'on n'enregistre pas ne laisse rien.
//   4. Depuis un dossier d'espace : le modèle est placé dans l'espace (une ligne de `GFS_Placement`), le rangement de la personne ne reçoit jamais le chemin d'un espace.
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { seedFiles } from './seed.mjs';
import { PAGE_PORT, openGfs, folders, names, openRowMenu, goTo } from './lab-pdf.mjs';
import { gfsFrame } from './lab-droits.mjs';

const lang = process.env.LAB_LANG || 'fr';
const { t } = createI18n(lang);
const MODELS = 'Publipostage_Modeles';
const PREFS = 'Publipostage_PreferencesModeles';
const ME = 'essai@example.com';
const APP_URL = `http://127.0.0.1:${PAGE_PORT}/prototype/apps/publipostage/`;
const exact = text => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const call = (page, method, path, body) => page.evaluate(async ([m, p, b]) => {
  const response = await fetch(p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
  const text = await response.text();
  let json = null; try { json = JSON.parse(text); } catch { /* texte */ }
  return { status: response.status, json, text: text.slice(0, 400) };
}, [method, path, body]);
const apply = (run, actions) => call(run.page, 'POST', `/api/docs/${run.docId}/apply`, actions);
const rows = async (run, table) => { const answer = await call(run.page, 'GET', `/api/docs/${run.docId}/tables/${table}/records`); return answer.status === 200 ? answer.json.records.map(row => ({ id: row.id, ...row.fields })) : []; };
const crumbs = async frame => (await frame.locator('nav.crumbs').innerText()).replace(/\s+/g, ' ');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Le temps que la liste montre ce qu'on attend (les écritures de GFS sont rendues après l'app) ; rend ce qu'elle montre à la fin.
async function shows(frame, wanted, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const found = await names(frame);
    if (wanted(found)) return found;
    await sleep(300);
  }
  return names(frame);
}
const goHome = frame => goTo(frame, new RegExp(`^\\s*${t('ex.me')}\\s*\\d*\\s*$`));
const folderRow = (frame, name) => frame.locator('.ls-row.folder', { has: frame.locator('.t', { hasText: exact(name) }) });
async function enter(frame, ...path) {
  for (const part of path) { await folderRow(frame, part).dblclick(); await sleep(400); }
}
async function newFolder(run, name) {
  const { frame, page } = run;
  await frame.getByRole('button', { name: exact(t('ex.new')) }).click();
  await frame.getByRole('menuitem', { name: new RegExp(`^${t('ex.newFolder')}`) }).click();
  await frame.locator('#nw-title').waitFor();
  const title = (await frame.locator('#nw-title').textContent()).trim();
  await page.keyboard.type(name);
  await page.keyboard.press('Enter');
  try { await frame.locator('[data-fk="ask-yes"]').click({ timeout: 3000 }); } catch { /* la table du rangement existe déjà */ }
  await sleep(1200);
  return title;
}

const appFrame = page => page.frames().find(each => each.url().startsWith(APP_URL) && !each.isDetached());
// « Nouveau > Document » depuis l'endroit où la personne est ; l'app s'ouvre sur un modèle vierge ; on l'écrit, le nomme, l'enregistre ; rend la ligne neuve de la table, ou null.
async function createDocument(run, name, { save = true } = {}) {
  const { page, frame } = run;
  const before = (await rows(run, MODELS)).map(row => row.id);
  await frame.getByRole('button', { name: exact(t('ex.new')) }).click();
  await frame.getByRole('menuitem', { name: /^Document/ }).first().click();
  let app = null;
  for (let i = 0; i < 180 && !app; i++) { app = appFrame(page); if (!app) await sleep(500); }
  await app.waitForSelector('#btn-save', { timeout: 90000 });
  for (let i = 0; i < 40 && !(await app.locator('.ProseMirror p').count()); i++) {
    const create = app.getByRole('button', { name: lang === 'fr' ? /^Créer les tables$/ : /^Create the tables$/ });
    if (await create.count()) await create.click();
    await sleep(500);
  }
  await sleep(800);
  if (save) {
    const box = await app.locator('.ProseMirror p').first().boundingBox();
    const at = await (await app.frameElement()).boundingBox();
    await page.mouse.click(at.x + box.x + 20, at.y + box.y + box.height / 2);
    await page.keyboard.type(`Texte de ${name}`);
    await app.locator('#btn-rename-template').click();
    await page.keyboard.type(name);
    await page.keyboard.press('Enter');
    await app.locator('#btn-save').click();
    for (let i = 0; i < 40 && !(await rows(run, MODELS)).some(row => row.Nom === name); i++) await sleep(300);
  }
  const made = (await rows(run, MODELS)).find(row => !before.includes(row.id));
  await sleep(2500); // GFS range derrière l'app
  await frame.locator('#floater-files').click();
  await sleep(1200);
  return made || null;
}
const prefsOf = async (run, id) => (await rows(run, PREFS)).filter(row => String(row.ModeleId) === String(id));
const placements = run => rows(run, 'GFS_Placement');
const rangement = run => rows(run, 'GFS_Rangement');

const pluginApi = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi, { colorScheme: 'light' });
  const run = await openGfs(context, { lang, mirrors: true });
  const { page } = run;
  await seedFiles(run.frame);
  await page.reload();
  run.frame = await gfsFrame(page);
  let { frame } = run;
  await frame.locator('.ls-row').first().waitFor();

  say('--- 1. « Nouveau dossier » naît là où l\'on est ---');
  check('à la racine de « Moi » : la fenêtre le dit', (await newFolder(run, 'Alpha')) === t('ex.newFolderTitle', { folder: t('ex.me') }));
  await enter(frame, 'Alpha');
  check('dans « Alpha » : la fenêtre le dit, le dossier naît dedans', (await newFolder(run, 'Beta')) === t('ex.newFolderTitle', { folder: 'Alpha' }) && same(await folders(frame), ['Beta']), await folders(frame));
  check('les lignes d\'état sont « Alpha » et « Alpha/Beta » (jamais « Beta » à la racine)', same((await rangement(run)).filter(row => row.Utilisateur === ME && !row.App && row.Dossier).map(row => row.Dossier).sort(), ['Alpha', 'Alpha/Beta']));

  say('--- 2. « Nouveau > Document » depuis un sous-dossier de « Moi » ---');
  await goHome(frame);
  await enter(frame, 'Alpha');
  const inAlpha = await createDocument(run, 'Neuf dans Alpha');
  check('l\'app a créé son modèle', Boolean(inAlpha), inAlpha);
  const alphaPrefs = inAlpha ? await prefsOf(run, inAlpha.id) : [];
  check('le rangement de l\'app dit « Alpha », à l\'adresse de la personne (une seule ligne)', alphaPrefs.length === 1 && alphaPrefs[0].Dossier === 'Alpha' && alphaPrefs[0].Utilisateur === ME, alphaPrefs);
  await goHome(frame);
  check('à la racine de « Moi », le modèle neuf n\'est pas là', !(await shows(frame, () => false, 1500)).includes('Neuf dans Alpha'));
  await enter(frame, 'Alpha');
  check('il est dans « Alpha »', (await shows(frame, found => found.includes('Neuf dans Alpha'))).includes('Neuf dans Alpha'), await names(frame));

  say('--- 3. depuis « Récents », depuis la racine, un modèle qu\'on n\'enregistre pas ---');
  await goTo(frame, new RegExp(`^\\s*${t('ex.recent')}`));
  const fromRecent = await createDocument(run, 'Neuf depuis Récents');
  const recentPrefs = fromRecent ? await prefsOf(run, fromRecent.id) : [];
  check('depuis « Récents » (le dernier dossier visité était « Alpha »), le modèle naît à la racine : aucune ligne de rangement', Boolean(fromRecent) && recentPrefs.length === 0, recentPrefs);
  await goHome(frame);
  check('il est à la racine de « Moi »', (await shows(frame, found => found.includes('Neuf depuis Récents'))).includes('Neuf depuis Récents'));
  const root = await createDocument(run, 'Neuf à la racine');
  check('depuis la racine : à la racine, sans ligne de rangement', Boolean(root) && (await prefsOf(run, root.id)).length === 0);
  const countBefore = (await rows(run, MODELS)).length;
  await enter(frame, 'Alpha');
  const blank = await createDocument(run, 'jamais enregistré', { save: false });
  check('un modèle vierge qu\'on n\'enregistre pas ne laisse aucune ligne', blank === null && (await rows(run, MODELS)).length === countBefore);
  await goHome(frame);

  say('--- 4. depuis un dossier d\'espace ---');
  await openRowMenu(frame, (await names(frame))[0]);
  await frame.getByRole('menuitem', { name: new RegExp(`^${t('share.menu')}`) }).click();
  await frame.locator('[data-fk="share-activate"]').click();
  await frame.locator('.mod.ask').waitFor();
  const old = frame;
  await Promise.all([(async () => { for (let i = 0; i < 240 && !old.isDetached(); i++) await sleep(250); })(), frame.locator('[data-fk="ask-yes"]').click()]);
  frame = await gfsFrame(page, { keep: true }); run.frame = frame;
  await frame.locator('.mod.sh .rt-content').waitFor({ timeout: 40000 });
  await frame.locator('[data-fk="share-close"]').click();
  const decor = await apply(run, [['AddRecord', 'GFS_Espaces', null, { Cle: 'achats', Nom: 'Achats' }], ['AddRecord', 'GFS_Placement', null, { Cible: '', Espace: 'achats', Dossier: 'Contrats' }]]);
  check('le décor (un espace « Achats » et son dossier « Contrats ») s\'écrit', decor.status === 200, decor.text);
  await page.reload();
  frame = await gfsFrame(page); run.frame = frame;
  await frame.locator('.ls-row').first().waitFor();
  await frame.locator('.tr-row[data-path="Espaces"]').click();
  await enter(frame, 'Achats');
  check('« Nouveau dossier » dans l\'espace naît dans l\'espace', (await newFolder(run, 'Direct')) === t('ex.newFolderTitle', { folder: 'Espaces / Achats' }) && (await folders(frame)).includes('Direct'), await folders(frame));
  await enter(frame, 'Contrats');
  check('le fil d\'Ariane part d\'« Espaces »', (await crumbs(frame)).startsWith(t('ex.spaces')), await crumbs(frame));
  const inSpace = await createDocument(run, 'Neuf dans l\'espace');
  check('l\'app a créé son modèle', Boolean(inSpace), inSpace);
  const placed = inSpace ? (await placements(run)).filter(row => row.Cible === `publipostage:${inSpace.id}`) : [];
  check('le modèle est placé dans l\'espace « achats », dossier « Contrats » (une ligne de placement)', placed.length === 1 && placed[0].Espace === 'achats' && placed[0].Dossier === 'Contrats', placed);
  const mine = (await rangement(run)).map(row => row.Dossier).concat((await rows(run, PREFS)).map(row => row.Dossier));
  check('le rangement de la personne ne reçoit jamais le chemin d\'un espace', mine.every(path => !String(path || '').startsWith('Espaces')), mine.filter(path => String(path || '').startsWith('Espaces')));
  await frame.locator('.tr-row[data-path="Espaces"]').click();
  await enter(frame, 'Achats', 'Contrats');
  check('le modèle est dans « Espaces / Achats / Contrats »', (await shows(frame, found => found.includes('Neuf dans l\'espace'))).includes('Neuf dans l\'espace'), await names(frame));
  await goHome(frame);
  check('et il n\'est pas à la racine de « Moi »', !(await shows(frame, () => false, 1500)).includes('Neuf dans l\'espace'));

  // La console de GFS : les messages de la page de l'app elle-même (son sous-module `kit`, que le labo ne sert pas, répond sans en-tête CORS) ne comptent pas.
  const unexpected = run.problems.filter(problem => !run.allow.some(known => known.test(problem)) && !problem.includes('/prototype/apps/'));
  if (unexpected.length) say(JSON.stringify(unexpected, null, 1).slice(0, 1500));
  check('aucune erreur ni avertissement de GFS dans la console', unexpected.length === 0, unexpected);
} finally {
  await browser.close();
  pages.close();
}
