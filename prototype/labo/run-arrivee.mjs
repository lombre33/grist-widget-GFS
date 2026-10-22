// L'arrivée de GFS (cahier 6.2, point 2 ; contrats 7.4, point 7) dans un vrai Grist, avec les vraies apps, celles que GFS référence, à 700 × 400, à la vraie souris et au vrai clavier : une vue qui
// porte le réglage d'une app s'ouvre sur cette app, sans consigne et sans rien écrire (l'app applique son propre ordre d'arrivée : la ligne, le modèle de la vue, le ★) ; sinon l'explorateur.
//   1. Sans réglage, ou avec un choix retiré (`null`, comme Publipostage+ le retire) : l'explorateur, comme avant.
//   2. Le modèle de la vue de Publipostage+ (`modeleDeLaVue`) : un document, une grille, une présentation (l'extension éteinte : le ★ s'ouvre, comme dans l'app seule ; cochée : la présentation),
//      un modèle disparu (le ★). Rien n'est écrit : ni modèle, ni table, ni réglage ; la barre de GFS est là, « Fichiers » ouvre l'explorateur et Échap ramène à la même app, intacte.
//   3. La fenêtre « Apps et extensions » du premier lancement ne passe pas par-dessus une app qui s'ouvre toute seule ; sans app, elle s'ouvre comme avant.
//   4. Automation+ pour son graphe (`workflow`) : installée, elle s'ouvre ; non installée, l'explorateur ; Publipostage+ et Automation+ servies toutes deux, GFS ne devine pas : l'explorateur.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark, LAB_READONLY=1 (la section est en lecture seule : l'app s'ouvre aussi, et la fenêtre du premier lancement ne vient pas).
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const readonly = process.env.LAB_READONLY === '1';
const run = `arrivee-${lang}-${scheme}${readonly ? '-lecture-seule' : ''}`;
// Les modèles d'essai (seed.mjs) : le ★ du document, le modèle de la vue, une grille, une présentation.
const STAR = { id: '1', name: 'Feuille d’émargement' };
const DOCUMENT = { id: '16', name: 'Contrat de prestation' };
const GRID = { id: '2', name: 'Émargement (grille)' };
const SLIDES = { id: '18', name: 'Support de session' };
const GRAPH = JSON.stringify({ version: 3, active: false, nodes: [], edges: [] });

const lab = await startLab({ lang, colorScheme: scheme, query: readonly ? 'readonly=true' : '' });
const { page } = lab;
const warnings = [];
const errors = [];
page.on('console', message => {
  if (message.type() === 'warning' && message.text().startsWith('GFS')) warnings.push(message.text());
  if (message.type() === 'error' && /127\.0\.0\.1:8911/.test(message.location().url || '')) errors.push(message.text());
});
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', event => window.__csp.push(`${event.violatedDirective} ${event.blockedURI}`)); });
await lab.fitPanel(undefined, 700, 400);
await seedFiles(lab.frame);
await lab.frame.evaluate(() => grist.docApi.applyUserActions([
  ['UpdateRecord', 'Publipostage_Modeles', 1, { EstParDefaut: true }],
  ['UpdateRecord', 'Publipostage_Modeles', 18, { TypeModele: 'presentation' }],
]));

let frame = lab.frame;
let app = null;

// GFS repart : le cadre se recharge, le document et les réglages de la section restent. `firstRun` : comme une personne qui n'est jamais venue (le navigateur n'a pas retenu la fenêtre du premier lancement).
const restart = async ({ firstRun = false } = {}) => {
  if (firstRun) await frame.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('gfs.premier-lancement.')).forEach(key => localStorage.removeItem(key)));
  await frame.evaluate(() => location.reload());
  await page.waitForTimeout(1000);
  frame = await lab.gfsFrame(/access=full/);
  await lab.gfsReady(frame);
  await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(800);
};
const options = () => frame.evaluate(() => grist.getOptions());
const setOptions = async (values, rest = {}) => {
  await frame.evaluate(async ({ values, rest }) => { await grist.clearOptions(); for (const [key, value] of Object.entries({ ...values, ...rest })) await grist.setOption(key, value); }, { values, rest });
  await page.waitForTimeout(800);
};
const appIds = () => page.frames().filter(f => /^http:\/\/127\.0\.0\.1:8911\/prototype\/apps\//.test(f.url())).map(f => f.url().match(/\/apps\/([^/]+)\//)[1]);
const explorerShown = async () => !(await frame.locator('.ex').isHidden());
const toast = async () => ((await frame.locator('#toast').isVisible()) ? (await frame.locator('#toast').innerText()).replace(/\s+/g, ' ') : '');
const windowOpen = async () => (await frame.locator('.mod').count()) > 0;
const barShown = () => frame.locator('#floaters').isVisible();
// L'app a fini de démarrer quand son coin d'état a dit quelque chose.
const waitStarted = async id => {
  app = await lab.appFrame(new RegExp(`/apps/${id}/`));
  if (!app) return false; // aucune app ne s'est ouverte : l'essai qui la voulait échoue, les suivants continuent
  if (id === 'publipostage') await app.waitForFunction(() => { const e = document.getElementById('status-msg'); return Boolean(e && e.textContent); }, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  return true;
};
// Ce que la personne voit de Publipostage+ : le modèle ouvert, son espace (document, grille, présentation) et ce que l'app tient du réglage de la vue.
const shown = () => app.evaluate(() => ({
  id: String(Templates.getCurrentId()), name: document.getElementById('template-name').value, grid: GridEditor.isActive(),
  slides: PageLayout.getFormat() === PageLayout.SLIDE_FORMAT, view: ViewTemplate.getId(), usable: ViewTemplate.usableId(), extension: Extensions.isActive('diapositives'),
}));
// Ce que le document retient : les modèles, les réglages enregistrés de la section, la table du rangement et le nombre de pages.
const snapshot = () => frame.evaluate(async () => JSON.stringify({
  modeles: await grist.docApi.fetchTable('Publipostage_Modeles'), vue: (await grist.docApi.fetchTable('_grist_Views_section')).options,
  tables: await grist.docApi.listTables(), pages: (await grist.docApi.fetchTable('_grist_Pages')).id.length,
}));
// L'arrivée sur Publipostage+ : l'explorateur est caché, la barre est là, et l'app montre ce qu'on attend.
const arrivesOnPublipostage = async (model, label, extra = () => true) => {
  const started = await waitStarted('publipostage');
  const seen = started ? await shown() : null;
  const ok = started && !(await explorerShown()) && appIds().join() === 'publipostage' && (await barShown()) && seen.name === model.name && seen.id === model.id && extra(seen);
  check(label, ok, { seen, explorateur: await explorerShown(), apps: appIds(), barre: await barShown() });
  return seen;
};
const showsExplorer = async label => {
  const ok = (await explorerShown()) && appIds().length === 0 && !(await barShown());
  check(label, ok, { explorateur: await explorerShown(), apps: appIds(), barre: await barShown() });
};

// ===== 0. Le premier départ de l'app écrit lui-même dans le document (des colonnes ajoutées à ses tables) : il passe par la fenêtre des apps, sans consigne, avant la première mesure.
await lab.openModules(frame);
await frame.locator('[data-open="publipostage"]').click();
await waitStarted('publipostage');
await restart();

// ===== 1. Sans réglage, ou avec un choix retiré : l'explorateur, comme avant.
say('--- 1. sans réglage');
await setOptions({});
await restart({ firstRun: true });
await showsExplorer('sans réglage : l\'explorateur, comme avant, sans app ni barre');
if (!readonly) check('sans app, la fenêtre « Apps et extensions » du premier lancement s\'ouvre comme avant', await windowOpen());
else check('en lecture seule, la fenêtre du premier lancement ne s\'ouvre pas', !(await windowOpen()));
await lab.shotPanel(run, '1-sans-reglage', frame);
if (await windowOpen()) await page.keyboard.press('Escape');

await setOptions({ modeleDeLaVue: null });
await restart();
await showsExplorer('un modèle de la vue retiré (`null`, comme Publipostage+ le retire) : l\'explorateur');
await setOptions({ modeleDeLaVue: '' });
await restart();
await showsExplorer('un modèle de la vue vide : l\'explorateur');
await setOptions({}, { 'gfs.depart': 'publipostage', autre: 'x' });
await restart();
await showsExplorer('des clés de GFS ou inconnues seules ne désignent aucune app : l\'explorateur');

// ===== 2. Le modèle de la vue : un document.
say('--- 2. le modèle de la vue est un document');
await setOptions({ modeleDeLaVue: DOCUMENT.id });
const before = await snapshot();
const rangementBefore = await lab.rangement(frame);
const optionsBefore = await options();
await lab.forgetActions();
await restart({ firstRun: true });
await arrivesOnPublipostage(DOCUMENT, 'le modèle de la vue (un document) : Publipostage+ s\'ouvre sur lui, l\'explorateur reste fermé, la barre de GFS est là');
check('GFS n\'a rien dit (ni phrase, ni fenêtre), même pour un navigateur où le premier lancement n\'a jamais eu lieu', (await toast()) === '' && !(await windowOpen()), { phrase: await toast(), fenetre: await windowOpen() });
const after = await snapshot();
check('rien n\'est écrit : ni modèle, ni réglage enregistré, ni table, ni page', after === before, { avant: JSON.parse(before).tables, apres: JSON.parse(after).tables });
const rangementAfter = await lab.rangement(frame);
check('la table du rangement n\'a pas été créée ni touchée', JSON.stringify(rangementBefore) === JSON.stringify(rangementAfter), { avant: rangementBefore, apres: rangementAfter });
check('les réglages de la section sont intacts, aucune clé de GFS n\'y est ajoutée', JSON.stringify(await options()) === JSON.stringify(optionsBefore), { avant: optionsBefore, apres: await options() });
const actions = await lab.actions();
say('ce que le moteur a reçu pendant l\'arrivée :', JSON.stringify([...new Set(actions)]));
check('aucune action de structure ni d\'écriture de GFS (pas d\'AddTable, ni d\'écriture dans GFS_Rangement)', !actions.some(action => /^AddTable|GFS_Rangement|^RemoveTable|^RenameTable/.test(action)), actions);
await lab.shotPanel(run, '2-modele-de-la-vue', frame);

// La barre de GFS et l'explorateur : « Fichiers » ouvre l'explorateur, Échap ramène à la même app, restée vivante.
await app.evaluate(() => { window.__marque = 'vivante'; });
await frame.locator('#floater-files').click();
await frame.locator('.ls-row').first().waitFor();
check('« Fichiers » (la barre) ouvre l\'explorateur par-dessus l\'app', await explorerShown());
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
check('Échap ramène au même modèle, dans la même app (le cadre n\'a pas été rechargé)', !(await explorerShown()) && (await app.evaluate(() => window.__marque)) === 'vivante' && (await shown()).name === DOCUMENT.name, { seen: await shown() });

// ===== 3. Une grille, une présentation, un modèle disparu.
say('--- 3. une grille, une présentation, un modèle disparu');
await setOptions({ modeleDeLaVue: GRID.id });
await restart();
await arrivesOnPublipostage(GRID, 'le modèle de la vue (une grille) : Publipostage+ s\'ouvre sur la grille', seen => seen.grid);
await lab.shotPanel(run, '3-grille', frame);

await setOptions({ modeleDeLaVue: SLIDES.id });
await restart();
await arrivesOnPublipostage(STAR, 'une présentation, l\'extension « Diapositives » éteinte : l\'app ouvre le ★, comme dans l\'app seule (rien d\'écrit, la vue garde son choix)', seen => !seen.extension && seen.view === SLIDES.id && seen.usable === null);

await setOptions({ modeleDeLaVue: '9999' });
await restart();
await arrivesOnPublipostage(STAR, 'un modèle disparu : l\'app l\'ignore et ouvre le ★', seen => seen.view === '9999' && seen.usable === null);

// Une autre clé de l'app suffit : la vue servait à Publipostage+ (la règle de ligne, les droits, la date du dernier export), même sans modèle de la vue.
await setOptions({ modeleDeLaVue: null, dateDernierExport: 'Date' });
await restart();
await arrivesOnPublipostage(STAR, 'une autre clé de l\'app (ici la colonne de la date du dernier export), sans modèle de la vue : l\'app s\'ouvre, sur son ordre habituel (le ★)');

// ===== 4. L'extension cochée : la présentation s'ouvre. Cocher écrit la table du rangement (l'accord de la personne) : après les mesures « rien n'est écrit ».
if (!readonly) {
  say('--- 4. la présentation, l\'extension cochée');
  await lab.openModules(frame);
  await frame.locator('[data-fk="ext:publipostage/diapositives"]').check();
  await lab.settle(frame);
  await frame.locator('.mod [data-fk="close"]').click();
  await setOptions({ modeleDeLaVue: SLIDES.id });
  await restart();
  await arrivesOnPublipostage(SLIDES, 'une présentation, l\'extension cochée : l\'app s\'ouvre sur la présentation', seen => seen.extension && seen.slides);
  await lab.shotPanel(run, '4-presentation', frame);
}

// ===== 5. Automation+ pour son graphe.
if (!readonly) {
  say('--- 5. Automation+');
  await setOptions({ workflow: GRAPH });
  await restart();
  await showsExplorer('le graphe d\'Automation+ dans la vue, l\'app non installée : l\'explorateur (rien ne s\'installe sans un geste)');
  app = await lab.openApp('automation', /\/apps\/automation\//, frame);
  await page.waitForTimeout(3000);
  await restart();
  await page.waitForTimeout(1500);
  check('le graphe d\'Automation+ dans la vue, l\'app installée : Automation+ s\'ouvre, l\'explorateur reste fermé', !(await explorerShown()) && appIds().join() === 'automation' && (await barShown()), { explorateur: await explorerShown(), apps: appIds() });
  await lab.shotPanel(run, '5-automation', frame);

  await setOptions({ workflow: GRAPH, modeleDeLaVue: DOCUMENT.id });
  await restart();
  await showsExplorer('Publipostage+ et Automation+ toutes deux servies et installées : GFS ne devine pas, l\'explorateur');

  await setOptions({ modeleDeLaVue: DOCUMENT.id });
  await restart();
  await arrivesOnPublipostage(DOCUMENT, 'le modèle de la vue seul, Automation+ installée : Publipostage+ s\'ouvre sur le modèle');
}

// En lecture seule, le courtier refuse (GFS_LECTURE_SEULE) les écritures que l'app tente à son premier départ (la migration de ses colonnes, dans un document que la lecture seule n'a pas laissé la migrer d'abord) :
// ce sont ces refus-là, et eux seuls, que l'essai n'écarte pas ; ils ne viennent pas de l'arrivée.
const expected = text => readonly && /GFS_LECTURE_SEULE|Document ouvert en lecture seule/.test(text);
say('refus attendus en lecture seule (migration des colonnes de l\'app) :', warnings.filter(expected).length + errors.filter(expected).length);
check('aucune phrase d\'avertissement de GFS (courtier, refus) pendant tout l\'essai', warnings.filter(text => !expected(text)).length === 0, warnings.filter(text => !expected(text)));
check('aucune erreur de script', errors.filter(text => !expected(text)).length === 0, errors.filter(text => !expected(text)));
// Le seul refus connu et accepté (rapport.md, « Accepté ») : le style en ligne que pose le script d'API de Grist dans le cadre de GFS ; il vient à chaque chargement de GFS, sans effet visible.
const refused = { gfs: (await frame.evaluate(() => window.__csp || [])).filter(item => item !== 'style-src-elem inline'), app: app ? await app.evaluate(() => window.__csp || []).catch(() => []) : [] };
check('aucun refus de la politique de sécurité du contenu, hors le style en ligne que le script de Grist pose chez GFS (connu, accepté)', refused.gfs.length === 0 && refused.app.length === 0, refused);
await lab.browser.close();
