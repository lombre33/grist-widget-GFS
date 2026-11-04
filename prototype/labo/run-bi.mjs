// Grist-BI (référencée à fef9af8) dans GFS, dans un vrai Grist (consigne 006 de GFS à Grist-BI) : à la vraie souris et au vrai clavier, à 700 × 400, l'app telle qu'elle est.
//   1. Le menu « Nouveau » propose « Rapport BI » (type du manifeste `bi.json`), grisé tant que Grist-BI n'est pas installée, dégrisé ensuite.
//   2. « Nouveau > Rapport BI » : l'app s'ouvre dans le sous-cadre isolé (origine « null », sans stockage). CONSTAT : son script de langue lit `localStorage` hors d'un `try`, ce que
//      le sous-cadre refuse : tant que ce n'est pas gardé, l'app ne démarre pas (`GristBI.i18n` n'existe pas, « Grist-BI se charge… » reste affiché).
//   3. Si elle a démarré : le choix de la table de travail crée ses trois tables (`BI_Dashboard_Config`, `_Comments`, `_UserProbe`) et UNE ligne de configuration ; le courtier ne refuse rien,
//      aucune erreur de script ; la table de configuration n'a que `TableId` et `ConfigJSON` (ni nom, ni type, ni date, ni auteur).
//   4. L'explorateur lit `BI_Dashboard_Config` (deux lignes semées, comme une version d'avant) : un fichier « Rapport BI » par ligne, icône en barres, type par défaut, sans couleur de famille ;
//      CONSTAT : sans colonne `Nom`, tous s'appellent « (sans nom) » et se renomment dans l'app (F2 : la phrase de GFS, rien n'est écrit).
//   5. Le double-clic d'un rapport et « Nouveau » : l'app ne connaît pas encore l'ouverture, GFS le dit (phrase provisoire) et rien n'est écrit dans le document.
// Un CONSTAT dit ce que l'app fait en deçà de ce que GFS attend sans que GFS y puisse rien (à dire par une consigne) ; il ne fait pas échouer l'essai.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark ; LAB_LIVE=1 pour jouer le site en ligne de l'app au lieu de sa copie.
import { startLab } from './lab-setup.mjs';
import { say, check, constat } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `bi-${lang}-${scheme}`;
const WORDS = lang === 'fr'
  ? { report: /^Rapport BI/, label: 'Rapport BI', untitled: '(sans nom)', provisional: /Provisoire/ }
  : { report: /^BI report/, label: 'BI report', untitled: '(untitled)', provisional: /Provisional/ };
const BI_URL = /(apps\/bi|Grist-BI)\//;
const CONFIG = 'BI_Dashboard_Config';

const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const warnings = [];
const errors = [];
page.on('console', message => {
  if (message.type() === 'warning' && message.text().startsWith('GFS')) warnings.push(message.text());
  if (message.type() === 'error' && BI_URL.test(message.location().url || '')) errors.push(message.text());
});
page.on('pageerror', error => errors.push(error.message));
await lab.fitPanel(undefined, 700, 400);

let frame = lab.frame;
const restart = async () => {
  await frame.evaluate(() => location.reload());
  await page.waitForTimeout(1000);
  frame = await lab.gfsFrame(/access=full/);
  await lab.gfsReady(frame);
  await page.waitForTimeout(800);
};
const toast = async () => ((await frame.locator('#toast').isVisible()) ? (await frame.locator('#toast').innerText()).replace(/\s+/g, ' ') : '');
// La table de configuration relue : { table: false } quand elle n'existe pas, sinon ses colonnes (sans `id` ni `manualSort`) et ses lignes.
const configState = () => frame.evaluate(async name => {
  if (!(await grist.docApi.listTables()).map(String).includes(name)) return { table: false };
  const data = await grist.docApi.fetchTable(name);
  const columns = Object.keys(data).filter(key => key !== 'id' && key !== 'manualSort');
  return { table: true, columns, rows: data.id.map((id, i) => ({ id, TableId: data.TableId[i] })) };
}, CONFIG);
const listTables = () => frame.evaluate(async () => (await grist.docApi.listTables()).map(String));
const showFiles = async () => {
  if (await frame.locator('.ex').isHidden()) await frame.locator('#floater-files').click();
  await frame.locator('.ls-row').first().waitFor();
  if (await frame.locator('.crumbs [data-path=""]').count()) await frame.locator('.crumbs [data-path=""]').click();
};
const newMenuItem = async () => {
  await frame.locator('.btn.primary').click();
  await frame.locator('.menu').waitFor();
  return frame.locator('.menu-item', { hasText: WORDS.report }).first();
};

// ----- 1. Le menu « Nouveau » : Grist-BI n'est pas installée, la ligne est là, grisée ; un clic dit pourquoi.
await restart();
let item = await newMenuItem();
check('« Nouveau » propose « Rapport BI » (le manifeste de Grist-BI ouvre ce type), grisé tant que Grist-BI n\'est pas installée', (await item.count()) === 1 && (await item.getAttribute('aria-disabled')) === 'true', await item.count());
await lab.shotPanel(run, '0-menu-grise', frame);
const greyed = await item.boundingBox();
await page.mouse.click(greyed.x + greyed.width / 2, greyed.y + greyed.height / 2);
await page.waitForTimeout(500);
check('un clic sur la ligne grisée ne lance rien : la fenêtre « Apps et extensions » ou une phrase dit pourquoi', (await frame.locator('.mod').count()) > 0 || (await toast()) !== '', { fenetre: await frame.locator('.mod').count(), phrase: await toast() });
await page.keyboard.press('Escape');

await lab.openModules(frame);
await frame.locator('[data-fk="app:bi"]').check();
await lab.settle(frame);
await page.keyboard.press('Escape');
await frame.locator('.mod').waitFor({ state: 'hidden' });
await restart();
const before = await configState();
const tablesBefore = await listTables();

// ----- 2. « Nouveau > Rapport BI » : l'app s'ouvre sur son modèle habituel.
item = await newMenuItem();
check('Grist-BI installée, la ligne « Rapport BI » n\'est plus grisée', (await item.getAttribute('aria-disabled')) !== 'true', await item.getAttribute('aria-disabled'));
await item.click();
const app = await lab.appFrame(BI_URL);
check('l\'app a un cadre', Boolean(app));
// La phrase de GFS ne reste que quelques secondes : elle se lit tout de suite.
let phrase = '';
for (let i = 0; i < 30 && !phrase; i++) { phrase = await toast(); if (!phrase) await page.waitForTimeout(100); }
await page.waitForTimeout(6000);
const seen = await app.evaluate(() => ({
  origine: window.origin,
  langue: typeof GristBI !== 'undefined' && Boolean(GristBI.i18n),
  texte: document.body.innerText.replace(/\s+/g, ' ').slice(0, 90),
  stockage: (() => { try { localStorage.setItem('x', '1'); return 'ok'; } catch (error) { return error.name; } })(),
}));
say('ce que l\'app voit :', JSON.stringify(seen), 'phrase de GFS :', phrase);
check('l\'app est ouverte dans le sous-cadre isolé (origine null, pas de stockage)', seen.origine === 'null' && seen.stockage === 'SecurityError', seen);
check('GFS dit que l\'app ne sait pas encore créer un fichier de ce type (phrase provisoire) et n\'écrit rien', WORDS.provisional.test(phrase) && JSON.stringify(await configState()) === JSON.stringify(before), phrase);
constat('l\'app démarre dans le sous-cadre : son script de langue (js/i18n.js, lignes 332 et 389) et ses lectures de `localStorage` (js/main.js, lignes 886 et 890) sont gardées par un `try`',
  seen.langue, { erreurs: errors.slice(0, 3), stockage: seen.stockage });
await lab.shotPanel(run, '1-nouveau', frame);
const started = seen.langue;

// ----- 3. Si l'app a démarré : le choix de sa table de travail.
if (started) {
  await app.locator('#table-select').click();
  await app.locator('#table-select').fill('Clients');
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5000);
  const tables = await listTables();
  const created = tables.filter(name => !tablesBefore.includes(name));
  const config = await configState();
  say('tables créées par l\'app :', JSON.stringify(created), 'configuration :', JSON.stringify(config));
  check('l\'app crée ses trois tables (configuration, commentaires, sonde de l\'adresse), toutes du préfixe BI_', ['BI_Dashboard_Config', 'BI_Dashboard_Comments', 'BI_Dashboard_UserProbe'].every(name => created.includes(name)) && created.every(name => name.startsWith('BI_')), created);
  check('une ligne de configuration par table de travail : une ligne, pour Clients', config.rows.length === 1 && config.rows[0].TableId === 'Clients', config);
  constat('la table de configuration porte le nom, le type, la date et l\'auteur d\'un rapport (colonnes Nom, TypeRapport, DateModif, ModifiePar)', ['Nom', 'TypeRapport', 'DateModif', 'ModifiePar'].every(name => config.columns.includes(name)), config.columns);
  check('le courtier ne refuse rien à l\'app (accès full, tables BI_, tables internes déclarées, capacité `formules`)', warnings.length === 0, warnings);
  check('aucune erreur de script dans l\'app', errors.length === 0, errors);
  await lab.shotPanel(run, '2-table-choisie', frame);
} else {
  say('l\'app n\'a pas démarré : le choix de la table n\'est pas mesuré ; la table de configuration est semée comme celle d\'une version d\'avant.');
}

// ----- 4. L'explorateur lit la table de configuration (deux lignes : une version d'avant, deux colonnes seulement).
await frame.evaluate(async () => {
  const have = (await grist.docApi.listTables()).map(String);
  if (!have.includes('Commandes')) await grist.docApi.applyUserActions([['AddTable', 'Commandes', [{ id: 'Produit', type: 'Text' }]]]);
  if (!have.includes('BI_Dashboard_Config')) {
    await grist.docApi.applyUserActions([['AddTable', 'BI_Dashboard_Config', [{ id: 'TableId', type: 'Text' }, { id: 'ConfigJSON', type: 'Text' }]]]);
  }
  const data = await grist.docApi.fetchTable('BI_Dashboard_Config');
  const json = JSON.stringify({ pages: [{ id: 'page_default', name: 'Page 1', tiles: [] }], currentPageId: 'page_default', bookmarks: [], blend: null });
  for (const name of ['Clients', 'Commandes']) {
    if (!data.TableId.includes(name)) await grist.docApi.applyUserActions([['AddRecord', 'BI_Dashboard_Config', null, { TableId: name, ConfigJSON: json }]]);
  }
});
const seeded = await configState();
await restart();
say('après le rechargement :', JSON.stringify(await frame.evaluate(() => ({ app: document.body.dataset.gfs, ex: document.querySelector('.ex') ? getComputedStyle(document.querySelector('.ex')).display : null, floater: document.querySelector('#floater-files') ? getComputedStyle(document.querySelector('#floater-files')).display : null }))));
await lab.shotPanel(run, '2b-rechargement', frame);
await showFiles();
const rows = await frame.locator('.ls-row').evaluateAll(list => list.map(row => ({
  nom: row.querySelector('.t')?.textContent, type: row.querySelector('.pill')?.textContent, icone: row.querySelector('.nm use')?.getAttribute('href'), famille: row.getAttribute('data-fam'),
})));
say('lignes de l\'explorateur :', JSON.stringify(rows));
await lab.shotPanel(run, '3-explorateur', frame);
const reports = rows.filter(row => row.icone === '#i-chart');
check('l\'explorateur montre un fichier par ligne de configuration, avec l\'icône en barres', reports.length === seeded.rows.length && reports.length === 2, reports);
check('leur type s\'écrit « Rapport BI » / « BI report » dans la langue de la personne (le type par défaut du manifeste)', reports.every(row => row.type === WORDS.label), reports.map(row => row.type));
check('sans couleur de famille (réservée au document, à la grille et à la présentation)', reports.every(row => !row.famille), reports.map(row => row.famille));
constat('chaque rapport a son nom dans la liste (la table n\'a pas de colonne `Nom` : « (sans nom) » partout)', reports.every(row => row.nom !== WORDS.untitled), reports.map(row => row.nom));

// Renommer depuis l'explorateur : la colonne `Nom` est absente, GFS ne l'écrit jamais et le dit.
await frame.locator('.ls-row').filter({ has: frame.locator('use[href="#i-chart"]') }).first().click();
await page.keyboard.press('F2');
await frame.locator('#nw-title').waitFor();
await page.keyboard.type('Ventes 2026');
await page.keyboard.press('Enter');
await page.waitForTimeout(800);
say('F2 sur un rapport sans colonne Nom :', await toast());
check('F2 : GFS dit que l\'app ne dit pas où est le nom de ses fichiers, et n\'écrit aucune colonne absente', /Grist-BI/.test(await toast()) && JSON.stringify(await configState()) === JSON.stringify(seeded), await toast());

// ----- 5. Le double-clic d'un rapport : l'app ne connaît pas encore l'ouverture d'un fichier précis.
await showFiles();
await frame.locator('.ls-row').filter({ has: frame.locator('use[href="#i-chart"]') }).first().dblclick();
await page.waitForTimeout(1200);
say('après le double-clic :', await toast());
check('le double-clic ouvre Grist-BI sur son modèle habituel et GFS le dit (phrase provisoire)', WORDS.provisional.test(await toast()), await toast());
check('l\'ouverture n\'écrit rien dans le document', JSON.stringify(await configState()) === JSON.stringify(seeded), await configState());
check('aucun avertissement de GFS' + (started ? ', aucune erreur de script dans l\'app' : ''), warnings.length === 0 && (!started || errors.length === 0), { avertissements: warnings, erreurs: errors });
await lab.browser.close();
