// L'écriture en direct de Publipostage+ dans un vrai Grist (grist-static), de bout en bout, à la vraie souris et au vrai clavier (Playwright : événements du pointeur et du
// clavier du navigateur, jamais dispatchEvent). LAB_LANG=fr|en, LAB_SCHEME=light|dark.
// Tout est vrai : le catalogue, le manifeste, l'app à la référence de GFS, le fichier assemblé `edition-live` (contrats 2.6, points 8 à 11) servi par GFS. L'empreinte est
// contrôlée par le navigateur (le labo ne neutralise pas `integrity` pour un script que GFS sert lui-même).
//   Partie 1 : la personne coche « Édition collaborative » dans la fenêtre « Apps et extensions » ; l'app reçoit le fichier de GFS (adresse, empreinte, forme « module »), ne le
//   demande qu'au premier clic, le charge dans son sous-cadre isolé sous sa politique de sécurité, et le direct démarre par le menu de l'app ; la table `Publipostage_Direct`
//   naît par le courtier, se remplit à la frappe, et se vide quand la dernière personne s'arrête.
//   Partie 2 : l'empreinte du catalogue est remplacée par une fausse (pour cet essai seulement) : le navigateur refuse le fichier, le direct ne démarre pas, l'app le dit.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startLab } from './lab-setup.mjs';
import { say, check, LAB } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `edition-${lang}-${scheme}`;
const ORIGIN = 'http://127.0.0.1:8911/prototype/';
const entry = JSON.parse(readFileSync(join(LAB, '..', 'bibliotheques', 'catalogue.json'), 'utf8')).bibliotheques.find(item => item.id === 'edition-live');
const KEYS = ['yjs', 'y-protocols/awareness', '@tiptap/y-tiptap', '@tiptap/extension-collaboration', '@tiptap/extension-collaboration-caret'];

// Ouvre Publipostage+, enregistre un premier modèle « Rapport » (le direct n'existe que pour un modèle enregistré), puis coche l'extension dans la fenêtre de GFS.
async function prepare(lab, observed) {
  const { page } = lab;
  await page.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`)); });
  page.on('request', request => { if (/edition-live/.test(request.url())) observed.requests.push(request.url()); });
  page.on('console', message => { if (['error', 'warning'].includes(message.type()) && /integrity|GFS|digest|edition-live/i.test(message.text())) observed.console.push(message.text().slice(0, 300)); });
  await lab.fitPanel(undefined, 700, 400);
  const app = await lab.openApp('publipostage');
  const tables = app.getByRole('button', { name: /Create the tables|Créer les tables/ });
  await tables.first().waitFor({ timeout: 30000 });
  await tables.first().click();
  await app.locator('#editor-container .ProseMirror').waitFor();
  await page.waitForTimeout(3000);
  await app.locator('#editor-container .ProseMirror').click();
  await page.keyboard.type('Bonjour tout le monde', { delay: 15 });
  await app.locator('#btn-rename-template').click();
  await page.keyboard.type('Rapport', { delay: 20 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  await app.locator('#btn-save').click();
  await app.waitForFunction(() => document.querySelectorAll('#template-select option').length === 2, null, { timeout: 15000 });
  const gfs = lab.frame;
  await gfs.locator('#floater-apps').click();
  await gfs.locator('.mod').waitFor();
  await gfs.locator('[data-fk="ext:publipostage/edition"]').check();
  await lab.settle(gfs);
  await lab.shotPanel(run, '1-fenetre-edition-cochee');
  await page.keyboard.press('Escape');
  await app.waitForFunction(() => Extensions.isActive('edition'), null, { timeout: 15000 });
  return { app, gfs };
}

// Un clic sur la ligne « Écriture en direct » du menu « Édition collaborative » de l'app, à la vraie souris.
async function clickLive(lab, app) {
  await app.locator('#v2-btn-collab').hover();
  await app.locator('#v2-btn-live').waitFor({ state: 'visible' });
  await app.locator('#v2-btn-live').click();
}
const rowsOf = gfs => gfs.evaluate(async () => {
  const table = await grist.docApi.fetchTable('Publipostage_Direct');
  return table.id.map((id, index) => ({ id, kind: table.Kind[index], client: String(table.Client[index]) }));
});

// ----- Partie 1 : le cas qui marche.
{
  const observed = { requests: [], console: [] };
  const lab = await startLab({ lang, colorScheme: scheme });
  const { app, gfs } = await prepare(lab, observed);
  const { page } = lab;
  const given = await app.evaluate(() => GfsLink.library('edition-live'));
  check('l\'app reçoit le fichier de GFS : adresse de la copie de GFS, empreinte du catalogue, forme « module »', given && given.src === ORIGIN + entry.vendorise.chemin && given.integrite === entry.vendorise.integrite && given.forme === 'module', given);
  check('rien n\'est demandé du fichier tant que la personne n\'a pas allumé le direct', observed.requests.length === 0 && (await app.evaluate(() => typeof GfsPaquets)) === 'undefined', observed.requests);
  check('la table du direct n\'existe pas encore', !(await gfs.evaluate(async () => (await grist.docApi.listTables()).includes('Publipostage_Direct'))));
  check('la ligne « Écriture en direct » est utilisable', await app.evaluate(() => LiveEntry.unavailable() === null));

  await clickLive(lab, app);
  await app.waitForFunction(() => LiveEntry.state() === 'live', null, { timeout: 30000 });
  check('le direct démarre : l\'extension est chargée, sans refus', await app.evaluate(() => Extensions.isLoaded('edition') && Extensions.failureOf('edition') === ''));
  const registered = await app.evaluate(() => {
    const given = GfsPaquets['edition-live'];
    return { version: given.version, keys: Object.keys(given.modules), doc: typeof given.modules['yjs'].Doc, awareness: typeof given.modules['y-protocols/awareness'].Awareness, sync: typeof given.modules['@tiptap/y-tiptap'].ySyncPlugin };
  });
  check('le fichier a posé GfsPaquets[\'edition-live\'] : version 1.0.0 et les cinq modules', registered.version === entry.version && JSON.stringify(registered.keys) === JSON.stringify(KEYS) && registered.doc === 'function' && registered.awareness === 'function' && registered.sync === 'function', registered);
  check('une seule demande du fichier, à l\'adresse exacte que GFS a donnée', observed.requests.length === 1 && observed.requests[0] === ORIGIN + entry.vendorise.chemin, observed.requests);
  const tag = await app.evaluate(() => [...document.scripts].filter(script => /edition-live/.test(script.src)).map(script => ({ type: script.type, integrity: script.getAttribute('integrity'), crossorigin: script.crossOrigin })));
  check('le navigateur contrôle l\'empreinte : <script type="module" integrity crossorigin="anonymous">', tag.length === 1 && tag[0].type === 'module' && tag[0].integrity === entry.vendorise.integrite && tag[0].crossorigin === 'anonymous', tag);
  check('la politique de sécurité de l\'app ne refuse rien', (await app.evaluate(() => window.__csp)).length === 0, await app.evaluate(() => window.__csp));
  check('GFS n\'a pas signalé de refus du courtier ni d\'erreur d\'empreinte', observed.console.length === 0, observed.console);
  check('la table du direct est née par le courtier', await gfs.evaluate(async () => (await grist.docApi.listTables()).includes('Publipostage_Direct')));
  const started = await rowsOf(gfs);
  check('au départ, la salle a ses lignes (état, document, présence)', started.length === 3 && ['d', 'p', 's'].every(kind => started.some(line => line.kind === kind)), started);
  await lab.shotPanel(run, '2-direct-demarre');

  await app.locator('#editor-container .ProseMirror').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' en direct', { delay: 30 });
  for (let i = 0; i < 40 && !(await rowsOf(gfs)).some(line => line.kind === 'u'); i++) await page.waitForTimeout(250);
  check('la frappe arrive dans la table du direct (une ligne de mise à jour)', (await rowsOf(gfs)).some(line => line.kind === 'u'), await rowsOf(gfs));
  check('le texte tapé est dans l\'éditeur', (await app.evaluate(() => EditorCore.getEditor().getText())) === 'Bonjour tout le monde en direct');

  await clickLive(lab, app);
  await app.waitForFunction(() => LiveEntry.state() === 'off', null, { timeout: 30000 });
  for (let i = 0; i < 40 && (await rowsOf(gfs)).length > 0; i++) await page.waitForTimeout(250);
  check('à l\'arrêt, la dernière personne vide la table du direct', (await rowsOf(gfs)).length === 0, await rowsOf(gfs));
  check('rien d\'autre n\'a bougé : aucune erreur de politique, aucun avertissement de GFS', (await app.evaluate(() => window.__csp)).length === 0 && observed.console.length === 0, observed.console);
  await lab.shotPanel(run, '3-direct-arrete');
  await lab.browser.close();
}

// ----- Partie 2 : une empreinte fausse dans le catalogue de GFS (cet essai seulement) : le navigateur refuse le fichier.
{
  const observed = { requests: [], console: [] };
  const wrong = `sha384-${'A'.repeat(64)}`;
  const lab = await startLab({ lang, colorScheme: scheme, patches: [{ chemin: '/prototype/bibliotheques/catalogue.json', de: entry.vendorise.integrite, vers: wrong }] });
  const { app, gfs } = await prepare(lab, observed);
  const { page } = lab;
  const given = await app.evaluate(() => GfsLink.library('edition-live'));
  check('l\'app reçoit l\'empreinte fausse du catalogue de cet essai', given && given.integrite === wrong, given);
  await clickLive(lab, app);
  // L'app dit l'échec dans une fenêtre simple, que la personne ferme à la souris.
  const closeButton = app.getByRole('button', { name: /^(Fermer|Close)$/ });
  await closeButton.first().waitFor({ timeout: 30000 });
  const message = (await app.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
  await lab.shotPanel(run, '4-empreinte-fausse');
  await closeButton.first().click();
  check('le navigateur refuse le fichier : la console le dit (empreinte)', observed.console.some(text => /integrity|digest/i.test(text)), observed.console);
  check('le direct ne démarre pas, l\'extension n\'est pas chargée, rien n\'est posé sous GfsPaquets', await app.evaluate(() => LiveEntry.state() === 'off' && !Extensions.isLoaded('edition') && typeof GfsPaquets === 'undefined'));
  check('l\'app dit pourquoi (jamais muette) : la raison est retenue et la ligne est grisée pour retenter', await app.evaluate(() => Extensions.failureOf('edition') !== '' && LiveEntry.unavailable() !== null && LiveEntry.unavailable().kind === 'load'), await app.evaluate(() => ({ failure: Extensions.failureOf('edition'), why: LiveEntry.unavailable() })));
  check('aucune table du direct n\'a été créée', !(await gfs.evaluate(async () => (await grist.docApi.listTables()).includes('Publipostage_Direct'))));
  say('ce que la personne a lu :', message.slice(message.search(/écriture en direct|live editing/i) >= 0 ? message.search(/écriture en direct|live editing/i) : 0).slice(0, 300));
  await lab.browser.close();
}
