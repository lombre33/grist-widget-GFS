// Grist-BI (référencée à 8eb479b, kit 0.9.0) dans GFS, dans un vrai Grist (consignes 006 et 007 de GFS à Grist-BI) : à la vraie souris et au vrai clavier, à 700 × 400, l'app telle qu'elle est.
//   1. Le menu « Nouveau » propose « Rapport BI » (type du manifeste `bi.json`), grisé tant que Grist-BI n'est pas installée, dégrisé ensuite.
//   2. « Nouveau > Rapport BI » : l'app s'ouvre dans le sous-cadre isolé (origine « null », sans stockage), démarre (ses lectures de `localStorage` sont gardées par un `try`) sur un rapport vierge
//      de la première table, sans phrase provisoire de GFS ; elle n'écrit rien dans le document (consigne 009, corrigée à 3144955).
//   3. Le choix de la table de travail n'écrit toujours aucune ligne de configuration ; au premier geste (« + Page »), ses trois tables (`BI_Dashboard_Config`, `_Comments`, `_UserProbe`) et une
//      seule ligne de configuration, nommée « Rapport BI 1 » (« BI report 1 »), avec les colonnes `Nom`, `TypeRapport`, `DateModif` et `ModifiePar` ; le courtier ne refuse rien, aucune erreur de script.
//   4. L'explorateur lit `BI_Dashboard_Config` (une ligne de l'app et une ligne semée sans nom, comme une version d'avant) : un fichier « Rapport BI » par ligne, icône en barres, type par
//      défaut, sans couleur de famille ; F2 écrit le nom dans la colonne `Nom`, elle seule.
//   5. Le double-clic d'un rapport : app fermée, elle démarre sur ce rapport (`ouverture` du contexte) ; app ouverte, elle l'ouvre (appel `ouvrir`) ; dans les deux cas sur la table du rapport
//      (Commandes, pas la première table), sans phrase provisoire, sans rien écrire dans le document.
//   6. Chaque « Nouveau », sans rien faire dans le rapport, ne laisse aucun fichier de plus (c'était le CONSTAT de la consigne 009 de GFS, corrigé par l'app le 07/11).
// LAB_LANG=fr|en, LAB_SCHEME=light|dark ; LAB_LIVE=1 pour jouer le site en ligne de l'app au lieu de sa copie.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';

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
// Le bouton « + Page » de l'app demande le nom de la page par `prompt()` (le sous-cadre a `allow-modals`) : la personne tape « Pause » et valide.
page.on('dialog', dialog => dialog.accept('Pause').catch(() => {}));
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
// Les phrases de GFS ne restent que quelques secondes : elles se relèvent tout au long de l'attente.
const watch = async ms => { const said = new Set(); for (let i = 0; i < ms / 150; i++) { const now = await toast(); if (now) said.add(now); await page.waitForTimeout(150); } return [...said]; };
// La table de configuration relue : { table: false } quand elle n'existe pas, sinon ses colonnes (sans `id` ni `manualSort`) et ses lignes.
const configState = () => frame.evaluate(async name => {
  if (!(await grist.docApi.listTables()).map(String).includes(name)) return { table: false };
  const data = await grist.docApi.fetchTable(name);
  const columns = Object.keys(data).filter(key => key !== 'id' && key !== 'manualSort');
  return { table: true, columns, rows: data.id.map((id, i) => ({ id, TableId: data.TableId[i], Nom: data.Nom ? data.Nom[i] : undefined })) };
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

// ----- 2. « Nouveau > Rapport BI » : l'app s'ouvre sur un rapport vierge (consigne 007, point 3) ; GFS ne dit rien de provisoire.
item = await newMenuItem();
check('Grist-BI installée, la ligne « Rapport BI » n\'est plus grisée', (await item.getAttribute('aria-disabled')) !== 'true', await item.getAttribute('aria-disabled'));
await item.click();
const app = await lab.appFrame(BI_URL);
check('l\'app a un cadre', Boolean(app));
const phrases = new Set(await watch(6000));
const seen = await app.evaluate(() => ({
  origine: window.origin,
  langue: typeof GristBI !== 'undefined' && Boolean(GristBI.i18n),
  table: (document.querySelector('#table-select') || {}).value || '',
  stockage: (() => { try { localStorage.setItem('x', '1'); return 'ok'; } catch (error) { return error.name; } })(),
}));
const afterNew = await configState();
const tablesAfterNew = (await listTables()).filter(name => !tablesBefore.includes(name));
say('ce que l\'app voit :', JSON.stringify(seen), 'phrases de GFS :', JSON.stringify([...phrases]), 'document :', JSON.stringify({ tables: tablesAfterNew, config: afterNew }));
check('l\'app est ouverte dans le sous-cadre isolé (origine null, pas de stockage)', seen.origine === 'null' && seen.stockage === 'SecurityError', seen);
check('l\'app démarre dans le sous-cadre : son script de langue et ses lectures de `localStorage` sont gardés par un `try` (consigne 007, point 1)', seen.langue, { erreurs: errors.slice(0, 3), stockage: seen.stockage });
check('GFS ne dit plus que l\'app ne sait pas créer un fichier de ce type : elle l\'ouvre vierge, par `GfsLink.opening()`', ![...phrases].some(text => WORDS.provisional.test(text)), [...phrases]);
await lab.shotPanel(run, '1-nouveau', frame);
const started = seen.langue;

// ----- 3. Le choix de sa table de travail n'écrit pas de ligne ; la ligne de configuration naît au premier geste (« + Page »), avec le nom « Rapport BI 1 ».
if (started) {
  await app.locator('#table-select').click();
  await app.locator('#table-select').fill('Clients');
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5000);
  const beforeGesture = await configState();
  const createdBefore = (await listTables()).filter(name => !tablesBefore.includes(name));
  say('avant tout geste : tables créées par l\'app :', JSON.stringify(createdBefore), 'configuration :', JSON.stringify(beforeGesture));
  check('choisir la table de travail sans rien faire de plus n\'écrit aucune ligne de configuration (la table de configuration n\'existe pas encore)', beforeGesture.table === false, beforeGesture);
  await app.locator('#add-page').click();
  await page.waitForTimeout(6000);
  const tables = await listTables();
  const created = tables.filter(name => !tablesBefore.includes(name));
  const config = await configState();
  say('après « + Page » : tables créées par l\'app :', JSON.stringify(created), 'configuration :', JSON.stringify(config));
  check('au premier geste, l\'app a ses trois tables (configuration, commentaires, sonde de l\'adresse), toutes du préfixe BI_', ['BI_Dashboard_Config', 'BI_Dashboard_Comments', 'BI_Dashboard_UserProbe'].every(name => created.includes(name)) && created.every(name => name.startsWith('BI_')), created);
  check('une ligne de configuration par table de travail : une ligne, pour Clients', config.rows.length === 1 && config.rows[0].TableId === 'Clients', config);
  check('la table de configuration porte le nom, le type, la date et l\'auteur d\'un rapport (colonnes Nom, TypeRapport, DateModif, ModifiePar)', ['Nom', 'TypeRapport', 'DateModif', 'ModifiePar'].every(name => config.columns.includes(name)), config.columns);
  check('le rapport neuf reçoit son nom, dans la langue de la personne', config.rows.length === 1 && WORDS.report.test(config.rows[0].Nom || ''), config.rows.map(row => row.Nom));
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
check('le rapport que l\'app a créé porte son nom ; la ligne d\'avant (semée sans nom) s\'affiche « (sans nom) » jusqu\'à son prochain enregistrement par l\'app (consigne 007, point 2)', JSON.stringify(reports.map(row => row.nom).sort()) === JSON.stringify([WORDS.untitled, `${WORDS.report.source.slice(1)} 1`].sort()), reports.map(row => row.nom));

// Renommer depuis l'explorateur : la colonne `Nom` existe maintenant (l'app l'a posée), GFS l'écrit, elle seule, sur la ligne choisie.
await frame.locator('.ls-row').filter({ has: frame.locator('use[href="#i-chart"]') }).filter({ hasText: WORDS.untitled }).first().click();
await page.keyboard.press('F2');
await frame.locator('#nw-title').waitFor();
await page.keyboard.type('Ventes 2026');
await page.keyboard.press('Enter');
await page.waitForTimeout(800);
const renamed = await configState();
say('après F2 :', JSON.stringify(renamed), 'phrase :', await toast());
check('F2 sur un rapport sans nom : GFS écrit le nom dans la colonne `Nom` de sa ligne, et nulle part ailleurs',
  JSON.stringify(renamed.rows.map(({ id, TableId, Nom }) => [id, TableId, Nom])) === JSON.stringify(seeded.rows.map(({ id, TableId, Nom }) => [id, TableId, id === 2 ? 'Ventes 2026' : Nom])) && renamed.columns.join() === seeded.columns.join(), renamed);

// ----- 5. Le double-clic d'un rapport : l'app l'ouvre elle-même (appel `ouvrir`, puis `ouverture` au démarrage), sans écrire.
const tableOf = target => target.evaluate(() => (document.querySelector('#table-select') || {}).value || '');
const reportRow = name => frame.locator('.ls-row').filter({ has: frame.locator('use[href="#i-chart"]') }).filter({ hasText: name }).first();
const rowsKept = async () => JSON.stringify((await configState()).rows) === JSON.stringify(renamed.rows);
const FIRST = `${WORDS.report.source.slice(1)} 1`; // le rapport de Clients, la première table : ce que l'app montrerait de toute façon ; « Ventes 2026 » (Commandes) ne se montre que si elle a lu la demande
await showFiles();
await reportRow('Ventes 2026').dblclick();
const appStarting = await lab.appFrame(BI_URL);
const saidStarting = await watch(6000);
const shownStarting = await tableOf(appStarting);
say('après le double-clic sur « Ventes 2026 » (app fermée, elle démarre) :', shownStarting, 'phrases :', JSON.stringify(saidStarting));
check('app fermée : le double-clic d\'un rapport la démarre sur ce rapport (`ouverture` du contexte : Commandes, pas la première table), sans phrase provisoire', shownStarting === 'Commandes' && !saidStarting.some(text => WORDS.provisional.test(text)), { table: shownStarting, phrases: saidStarting });
check('ce démarrage n\'écrit rien dans le document (mêmes lignes, mêmes noms)', await rowsKept(), await configState());
await showFiles();
await reportRow(FIRST).dblclick();
const saidRunning = await watch(3000);
const appRunning = await lab.appFrame(BI_URL);
const shownRunning = await tableOf(appRunning);
say(`après le double-clic sur « ${FIRST} » (app déjà ouverte sur Commandes) :`, shownRunning, 'phrases :', JSON.stringify(saidRunning));
check('app déjà ouverte : le double-clic d\'un autre rapport l\'ouvre (appel `ouvrir` : la table de ce rapport s\'affiche), sans phrase provisoire', shownRunning === 'Clients' && !saidRunning.some(text => WORDS.provisional.test(text)), { table: shownRunning, phrases: saidRunning });
check('cette ouverture n\'écrit rien non plus', await rowsKept(), await configState());
await lab.shotPanel(run, '4-ouvert', frame);
// « Nouveau » une deuxième fois, sans rien faire dans le rapport : l'app n'écrit pas la ligne de ce rapport vierge (consigne 009 de GFS, corrigée à 3144955), « Nouveau » ne laisse donc aucun fichier de plus.
await showFiles();
await frame.locator('.btn.primary').click();
await frame.locator('.menu').waitFor();
await frame.locator('.menu-item', { hasText: WORDS.report }).first().click();
await watch(4000);
const afterSecond = await configState();
check('« Nouveau > Rapport BI » sans rien faire dans le rapport ne laisse aucun fichier de plus dans le document (consigne 009 de GFS : la ligne ne naît qu\'au premier geste)', afterSecond.rows.length === renamed.rows.length, afterSecond.rows.map(row => [row.TableId, row.Nom]));
check('aucun avertissement de GFS' + (started ? ', aucune erreur de script dans l\'app' : ''), warnings.length === 0 && (!started || errors.length === 0), { avertissements: warnings, erreurs: errors });
await lab.browser.close();
