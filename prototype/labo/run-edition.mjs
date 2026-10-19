// L'écriture en direct de Publipostage+ dans un vrai Grist (grist-static), de bout en bout, à la vraie souris et au vrai clavier (Playwright : événements du pointeur et du
// clavier du navigateur, jamais dispatchEvent). LAB_LANG=fr|en, LAB_SCHEME=light|dark.
// Tout est vrai : le catalogue, le manifeste, l'app à la référence de GFS, le fichier assemblé `edition-live` (contrats 2.6, points 8 à 11), et l'empreinte, que le navigateur
// contrôle pour de bon (le labo ne neutralise pas `integrity` pour un script que GFS sert lui-même, ni pour l'adresse du CDN du catalogue : à cette adresse, son miroir rend les
// octets exacts de la copie de GFS, qui sont ceux que jsDelivr sert au commit épinglé).
//   Partie 1 : la personne coche « Édition collaborative » et choisit « Copie de GFS » ; l'app reçoit le fichier de GFS (adresse, empreinte, forme « module »), ne le demande
//   qu'au premier clic, le charge dans son sous-cadre isolé sous sa politique de sécurité, et le direct démarre par le menu de l'app ; la table `Publipostage_Direct` naît par le
//   courtier, se remplit à la frappe, et se vide quand la dernière personne s'arrête.
//   Partie 2 : l'empreinte de la copie dans le catalogue est remplacée par une fausse (pour cet essai seulement) : le navigateur refuse le fichier, le direct ne démarre pas.
//   Partie 3 : la personne garde le défaut, « Depuis un CDN » (jsDelivr, au commit épinglé), mais la politique de sécurité de l'app ne nomme pas encore cette adresse : le navigateur
//   la refuse, l'app le dit sans rien casser, et le choix de « Copie de GFS » remet le direct en marche.
//   Partie 4 : la politique de l'app nomme l'adresse exacte du catalogue (ce que demande la consigne 016) : le direct démarre par le CDN, comme la partie 1.
//   Partie 5 : de même, mais avec une fausse empreinte du CDN dans le catalogue : le navigateur refuse le fichier, ce qui prouve que la partie 4 contrôle bien l'empreinte.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startLab } from './lab-setup.mjs';
import { say, check, LAB } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `edition-${lang}-${scheme}`;
const ORIGIN = 'http://127.0.0.1:8911/prototype/';
const catalogueText = readFileSync(join(LAB, '..', 'bibliotheques', 'catalogue.json'), 'utf8');
const entry = JSON.parse(catalogueText).bibliotheques.find(item => item.id === 'edition-live');
const COPY = ORIGIN + entry.vendorise.chemin;
const CDN = entry.cdn.src;
const KEYS = ['yjs', 'y-protocols/awareness', '@tiptap/y-tiptap', '@tiptap/extension-collaboration', '@tiptap/extension-collaboration-caret'];
const WRONG = `sha384-${'A'.repeat(64)}`;
// Les deux blocs du catalogue (adresse et empreinte), tels que le fichier les écrit : un essai remplace l'empreinte de l'un, jamais de l'autre.
const copyBlock = `"chemin": "${entry.vendorise.chemin}",\n        "integrite": "${entry.vendorise.integrite}"`;
const cdnBlock = `"src": "${CDN}",\n        "integrite": "${entry.cdn.integrite}"`;
const catalogueWith = (block, wrong) => ({ chemin: '/prototype/bibliotheques/catalogue.json', de: block, vers: block.replace(/"integrite": "[^"]+"/, `"integrite": "${wrong}"`) });
// Ce que le projet de l'app écrit dans sa politique (consigne 016) : l'adresse exacte du catalogue, à côté de celle de Plotly, et rien d'autre.
const PLOTLY = 'https://cdn.jsdelivr.net/npm/plotly.js-basic-dist-min@2.13.2/plotly-basic.min.js';
const cspNamingTheAddress = { chemin: '/prototype/apps/publipostage/index.html', de: PLOTLY, vers: `${PLOTLY} ${CDN}` };
for (const text of [copyBlock, cdnBlock]) if (!catalogueText.includes(text)) throw new Error(`Le catalogue n'a plus la forme que l'essai remplace : ${text.slice(0, 60)}`);

// Le choix du mode dans la fenêtre de GFS, à la vraie souris, sur la ligne de l'extension.
const modeRow = gfs => gfs.locator('.mr', { has: gfs.locator('[data-ext="edition"]') });
const modeOption = (gfs, mode) => modeRow(gfs).locator('.rd', { has: gfs.locator(`input[type="radio"][value="${mode}"]`) });
const openWindow = async gfs => { await gfs.locator('#floater-apps').click(); await gfs.locator('.mod').waitFor(); };
async function chooseMode(lab, gfs, mode) {
  await modeOption(gfs, mode).click();
  await lab.settle(gfs);
}

// Ouvre Publipostage+, enregistre un premier modèle « Rapport » (le direct n'existe que pour un modèle enregistré), puis coche l'extension dans la fenêtre de GFS
// (et choisit son mode quand `mode` est donné ; sinon c'est le défaut).
async function prepare(lab, observed, mode = null) {
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
  await openWindow(gfs);
  await gfs.locator('[data-fk="ext:publipostage/edition"]').check();
  await lab.settle(gfs);
  if (mode) await chooseMode(lab, gfs, mode);
  const chosen = await gfs.evaluate(() => [...document.querySelectorAll('input[data-mode-for="edition"]')].map(input => ({ mode: input.value, checked: input.checked, disabled: input.disabled })));
  await lab.shotPanel(run, `1-fenetre-edition-cochee-${mode || 'defaut'}`);
  await page.keyboard.press('Escape');
  await app.waitForFunction(() => Extensions.isActive('edition'), null, { timeout: 15000 });
  return { app, gfs, chosen };
}

// Un clic sur la ligne « Écriture en direct » du menu « Édition collaborative » de l'app, à la vraie souris. Après un échec, la ligne est grisée mais cliquable (« Cliquer pour
// réessayer ») : `retry` passe la vérification « activé » de Playwright, qui prend `aria-disabled` pour un bouton inerte ; le clic reste celui de la souris.
async function clickLive(lab, app, retry = false) {
  await app.locator('#v2-btn-collab').hover();
  await app.locator('#v2-btn-live').waitFor({ state: 'visible' });
  await app.locator('#v2-btn-live').click({ force: retry });
}
const rowsOf = gfs => gfs.evaluate(async () => {
  const table = await grist.docApi.fetchTable('Publipostage_Direct');
  return table.id.map((id, index) => ({ id, kind: table.Kind[index], client: String(table.Client[index]) }));
});
const hasTable = gfs => gfs.evaluate(async () => (await grist.docApi.listTables()).includes('Publipostage_Direct'));
const violations = app => app.evaluate(() => window.__csp);
const scriptsOf = app => app.evaluate(() => [...document.scripts].filter(script => /edition-live/.test(script.src)).map(script => ({ src: script.src, type: script.type, integrity: script.getAttribute('integrity'), crossorigin: script.crossOrigin })));

// Le direct de bout en bout, par l'adresse `where` : démarrage, chargement, table, frappe, arrêt. `label` dit le mode dans les vérifications.
async function liveWorks(lab, { app, gfs }, observed, where, integrity, label) {
  const { page } = lab;
  const given = await app.evaluate(() => GfsLink.library('edition-live'));
  check(`${label} : l'app reçoit l'adresse du catalogue, son empreinte, la forme « module »`, given && given.src === where && given.integrite === integrity && given.forme === 'module', given);
  check(`${label} : rien n'est demandé du fichier tant que la personne n'a pas allumé le direct`, observed.requests.length === 0 && (await app.evaluate(() => typeof GfsPaquets)) === 'undefined', observed.requests);
  check(`${label} : la table du direct n'existe pas encore`, !(await hasTable(gfs)));
  check(`${label} : la ligne « Écriture en direct » est utilisable`, await app.evaluate(() => LiveEntry.unavailable() === null));

  await clickLive(lab, app);
  await app.waitForFunction(() => LiveEntry.state() === 'live', null, { timeout: 30000 });
  check(`${label} : le direct démarre, l'extension est chargée, sans refus`, await app.evaluate(() => Extensions.isLoaded('edition') && Extensions.failureOf('edition') === ''));
  const registered = await app.evaluate(() => {
    const loaded = GfsPaquets['edition-live'];
    return { version: loaded.version, keys: Object.keys(loaded.modules), doc: typeof loaded.modules['yjs'].Doc, awareness: typeof loaded.modules['y-protocols/awareness'].Awareness, sync: typeof loaded.modules['@tiptap/y-tiptap'].ySyncPlugin };
  });
  check(`${label} : le fichier a posé GfsPaquets['edition-live'] : version 1.0.0 et les cinq modules`, registered.version === entry.version && JSON.stringify(registered.keys) === JSON.stringify(KEYS) && registered.doc === 'function' && registered.awareness === 'function' && registered.sync === 'function', registered);
  check(`${label} : une seule demande du fichier, à l'adresse exacte que GFS a donnée`, observed.requests.length === 1 && observed.requests[0] === where, observed.requests);
  const tag = await scriptsOf(app);
  check(`${label} : le navigateur contrôle l'empreinte : <script type="module" integrity crossorigin="anonymous">`, tag.length === 1 && tag[0].src === where && tag[0].type === 'module' && tag[0].integrity === integrity && tag[0].crossorigin === 'anonymous', tag);
  check(`${label} : la politique de sécurité de l'app ne refuse rien`, (await violations(app)).length === 0, await violations(app));
  check(`${label} : GFS n'a pas signalé de refus du courtier ni d'erreur d'empreinte`, observed.console.length === 0, observed.console);
  check(`${label} : la table du direct est née par le courtier`, await hasTable(gfs));
  const started = await rowsOf(gfs);
  check(`${label} : au départ, la salle a ses lignes (état, document, présence)`, started.length === 3 && ['d', 'p', 's'].every(kind => started.some(line => line.kind === kind)), started);
  await lab.shotPanel(run, `2-direct-demarre-${label}`);

  await app.locator('#editor-container .ProseMirror').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' en direct', { delay: 30 });
  for (let i = 0; i < 40 && !(await rowsOf(gfs)).some(line => line.kind === 'u'); i++) await page.waitForTimeout(250);
  check(`${label} : la frappe arrive dans la table du direct (une ligne de mise à jour)`, (await rowsOf(gfs)).some(line => line.kind === 'u'), await rowsOf(gfs));
  check(`${label} : le texte tapé est dans l'éditeur`, (await app.evaluate(() => EditorCore.getEditor().getText())) === 'Bonjour tout le monde en direct');

  await clickLive(lab, app);
  await app.waitForFunction(() => LiveEntry.state() === 'off', null, { timeout: 30000 });
  for (let i = 0; i < 40 && (await rowsOf(gfs)).length > 0; i++) await page.waitForTimeout(250);
  check(`${label} : à l'arrêt, la dernière personne vide la table du direct`, (await rowsOf(gfs)).length === 0, await rowsOf(gfs));
  check(`${label} : rien d'autre n'a bougé : aucune erreur de politique, aucun avertissement de GFS`, (await violations(app)).length === 0 && observed.console.length === 0, observed.console);
  await lab.shotPanel(run, `3-direct-arrete-${label}`);
}

// Le refus : le direct ne démarre pas, l'app le dit (jamais muette) et la ligne reste grisée pour retenter. Rend ce que la personne a lu.
async function liveRefused(lab, { app, gfs }, label, shot) {
  await clickLive(lab, app);
  // L'app dit l'échec dans une fenêtre simple, que la personne ferme à la souris.
  const closeButton = app.getByRole('button', { name: /^(Fermer|Close)$/ });
  await closeButton.first().waitFor({ timeout: 30000 });
  const message = (await app.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
  await lab.shotPanel(run, shot);
  await closeButton.first().click();
  check(`${label} : le direct ne démarre pas, l'extension n'est pas chargée, rien n'est posé sous GfsPaquets`, await app.evaluate(() => LiveEntry.state() === 'off' && !Extensions.isLoaded('edition') && typeof GfsPaquets === 'undefined'));
  check(`${label} : l'app dit pourquoi (jamais muette) : la raison est retenue et la ligne est grisée pour retenter`, await app.evaluate(() => Extensions.failureOf('edition') !== '' && LiveEntry.unavailable() !== null && LiveEntry.unavailable().kind === 'load'), await app.evaluate(() => ({ failure: Extensions.failureOf('edition'), why: LiveEntry.unavailable() })));
  check(`${label} : aucune table du direct n'a été créée`, !(await hasTable(gfs)));
  const at = message.search(/écriture en direct|live editing/i);
  say('ce que la personne a lu :', message.slice(at >= 0 ? at : 0).slice(0, 300));
}

// ----- Partie 1 : la copie de GFS, le cas qui marche.
{
  const observed = { requests: [], console: [] };
  const lab = await startLab({ lang, colorScheme: scheme });
  const context = await prepare(lab, observed, 'vendorise');
  check('copie : « Copie de GFS » est cochée, « Depuis un CDN » reste libre', JSON.stringify(context.chosen) === JSON.stringify([{ mode: 'cdn', checked: false, disabled: false }, { mode: 'vendorise', checked: true, disabled: false }]), context.chosen);
  const saved = ((await lab.rangement(context.gfs)).value || {}).publipostage || {};
  check('copie : le choix de la personne s\'écrit dans le document (un geste)', JSON.stringify(saved.extensions) === '["edition"]' && JSON.stringify(saved.modes) === '{"edition":"vendorise"}', saved);
  await liveWorks(lab, context, observed, COPY, entry.vendorise.integrite, 'copie');
  await lab.browser.close();
}

// ----- Partie 2 : une empreinte fausse pour la copie dans le catalogue de GFS (cet essai seulement) : le navigateur refuse le fichier.
{
  const observed = { requests: [], console: [] };
  const lab = await startLab({ lang, colorScheme: scheme, patches: [catalogueWith(copyBlock, WRONG)] });
  const context = await prepare(lab, observed, 'vendorise');
  const given = await context.app.evaluate(() => GfsLink.library('edition-live'));
  check('copie fausse : l\'app reçoit l\'empreinte fausse du catalogue de cet essai', given && given.src === COPY && given.integrite === WRONG, given);
  await liveRefused(lab, context, 'copie fausse', '4-empreinte-fausse');
  check('copie fausse : le navigateur refuse le fichier : la console le dit (empreinte)', observed.console.some(text => /integrity|digest/i.test(text)), observed.console);
  await lab.browser.close();
}

// ----- Partie 3 : le défaut (le CDN), mais la politique de l'app ne nomme pas encore l'adresse : le navigateur la refuse, « Copie de GFS » remet le direct en marche.
{
  const observed = { requests: [], console: [] };
  const lab = await startLab({ lang, colorScheme: scheme });
  const context = await prepare(lab, observed);
  const { app, gfs } = context;
  check('CDN refusé : « Depuis un CDN » est cochée par défaut et libre, « Copie de GFS » aussi', JSON.stringify(context.chosen) === JSON.stringify([{ mode: 'cdn', checked: true, disabled: false }, { mode: 'vendorise', checked: false, disabled: false }]), context.chosen);
  check('CDN refusé : le défaut ne s\'écrit pas (rien sans un geste de la personne)', ((await lab.rangement(gfs)).value.publipostage || {}).modes === undefined, (await lab.rangement(gfs)).value);
  const given = await app.evaluate(() => GfsLink.library('edition-live'));
  check('CDN refusé : l\'app reçoit l\'adresse jsDelivr du catalogue, avec l\'empreinte du CDN', given && given.src === CDN && given.integrite === entry.cdn.integrite && given.forme === 'module', given);
  await liveRefused(lab, context, 'CDN refusé', '5-cdn-refuse-par-la-politique');
  const blocked = await violations(app);
  check('CDN refusé : c\'est la politique de sécurité de l\'app qui refuse, à l\'adresse exacte du CDN', blocked.length > 0 && blocked.every(item => /^script-src/.test(item) && item.includes(CDN)), blocked);
  check('CDN refusé : le navigateur de l\'app le dit dans sa console (Content Security Policy)', observed.console.some(text => /Content Security Policy/i.test(text)), observed.console);
  // La sortie, à la vraie souris : « Copie de GFS » dans la fenêtre de GFS, puis un clic sur la ligne du direct.
  await openWindow(gfs);
  await chooseMode(lab, gfs, 'vendorise');
  await lab.shotPanel(run, '6-copie-choisie-apres-le-refus');
  await lab.page.keyboard.press('Escape');
  await app.waitForFunction(() => /\/vendor\//.test((GfsLink.library('edition-live') || {}).src || ''), null, { timeout: 15000 });
  check('CDN refusé : le choix de la copie s\'écrit, et l\'app reçoit l\'adresse de la copie', JSON.stringify(((await lab.rangement(gfs)).value || {}).publipostage.modes) === JSON.stringify({ edition: 'vendorise' }) && (await app.evaluate(() => GfsLink.library('edition-live').src)) === COPY, (await lab.rangement(gfs)).value);
  observed.requests.length = 0;
  observed.console.length = 0;
  check('CDN refusé : la ligne grisée dit qu\'un clic réessaie', await app.evaluate(() => /(réessayer|try again)/i.test(document.querySelector('#v2-btn-live').title)), await app.evaluate(() => document.querySelector('#v2-btn-live').title));
  await clickLive(lab, app, true);
  await app.waitForFunction(() => LiveEntry.state() === 'live', null, { timeout: 30000 });
  check('CDN refusé : par la copie, le direct démarre au clic suivant, sans refus', await app.evaluate(() => Extensions.isLoaded('edition') && Extensions.failureOf('edition') === '' && typeof GfsPaquets !== 'undefined') && observed.requests.length > 0 && observed.requests.at(-1).split('?')[0] === COPY, observed.requests);
  await lab.shotPanel(run, '7-direct-par-la-copie-apres-le-refus');
  await lab.browser.close();
}

// ----- Partie 4 : la politique de l'app nomme l'adresse exacte du catalogue (consigne 016) : le direct démarre par le CDN.
{
  const observed = { requests: [], console: [] };
  const lab = await startLab({ lang, colorScheme: scheme, patches: [cspNamingTheAddress] });
  const context = await prepare(lab, observed);
  check('CDN : « Depuis un CDN » est cochée par défaut', context.chosen[0].mode === 'cdn' && context.chosen[0].checked, context.chosen);
  await liveWorks(lab, context, observed, CDN, entry.cdn.integrite, 'CDN');
  await lab.browser.close();
}

// ----- Partie 5 : la même politique, mais une empreinte fausse pour le CDN dans le catalogue (cet essai seulement) : le navigateur refuse le fichier du CDN.
{
  const observed = { requests: [], console: [] };
  const lab = await startLab({ lang, colorScheme: scheme, patches: [cspNamingTheAddress, catalogueWith(cdnBlock, WRONG)] });
  const context = await prepare(lab, observed);
  const given = await context.app.evaluate(() => GfsLink.library('edition-live'));
  check('CDN faux : l\'app reçoit l\'adresse jsDelivr et l\'empreinte fausse de cet essai', given && given.src === CDN && given.integrite === WRONG, given);
  await liveRefused(lab, context, 'CDN faux', '8-empreinte-du-cdn-fausse');
  check('CDN faux : la politique laisse passer l\'adresse, c\'est l\'empreinte que le navigateur refuse', (await violations(context.app)).length === 0 && observed.console.some(text => /integrity|digest/i.test(text)), observed.console);
  await lab.browser.close();
}
