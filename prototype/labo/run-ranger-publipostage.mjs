// Ranger les exports PDF de la vraie Publipostage+ dans GFS (consigne 043 ; contrats 2.7 point 6, 5.4 point 9), celle que GFS référence, dans un VRAI serveur Grist (l'image officielle,
// `bash vrai-serveur.sh`) : un modèle de l'app est ouvert dans son éditeur, la personne choisit « Destination du PDF » dans le menu « Exporter », puis exporte. GFS garde le PDF (la table
// `GFS_Fichiers` naît avec l'accord de la personne), pose la question du nom pris et rend à l'app ce qu'il a fait ; l'app le dit dans son coin d'état. Tout se joue à 700 × 400, à la vraie souris
// et au vrai clavier. Chromium seulement. Les bibliothèques de l'app (pdfmake et ses polices comprises) viennent du miroir (`bash build-mirror.sh`).
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-ranger-publipostage.mjs        (LAB_LANG=fr|en, LAB_SCHEME=light|dark)
//   1. Le menu : « Destination du PDF » offre ses trois lignes, vivantes (le manifeste de GFS déclare `actions.ranger`) ; un clic coche « Ranger dans GFS » et GFS garde le choix de la personne.
//   2. Un premier export : GFS demande l'accord pour sa table (l'app n'en pose aucune), puis garde un vrai PDF ; aucun téléchargement ; l'explorateur le montre.
//   3. Le même modèle exporté une seconde fois : le nom est pris, la fenêtre de GFS nomme l'app ; « Garder les deux » range « … (1).pdf » et l'app dit le nom.
//   4. Une troisième fois : « Remplacer » garde la même ligne (même identifiant) ; « Annuler » ne range rien et l'app le dit.
//   5. « Télécharger et ranger dans GFS » : le PDF est téléchargé ET rangé (les mêmes octets) ; « Télécharger » ne range rien.
//   6. Une archive ZIP de trois lignes : trois PDF rangés l'un après l'autre sous les noms de ses entrées ; trois noms pris d'une seule fenêtre (« Garder les deux » ou « Remplacer » pour les suivants) ; rien n'est téléchargé.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { seedFiles } from './seed.mjs';
import { PAGE_PORT, openGfs, sha256, waitFor, shot, rowOf, contrastProblems, windowFits } from './lab-pdf.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const APP = 'Publipostage+';
const APP_URL = `http://127.0.0.1:${PAGE_PORT}/prototype/apps/publipostage/`;
const MODEL = 'Contrat de prestation';
const FILE_TEMPLATE = 'Contrat de prestation 2026';
const FILE_NAME = 'Contrat de prestation 2026.pdf';
const CREATE_TABLES = lang === 'fr' ? /^Créer les tables$/ : /^Create the tables$/;
const STORAGE_KEY = 'gfs.stockage.publipostage.pp_export_destination';
// Les mots du coin d'état de l'app (js/i18n.js de Publipostage+ : shelve.one.*) et des trois lignes de « Destination du PDF ».
const SAYS = lang === 'fr'
  ? { generated: 'PDF généré.', added: 'PDF rangé dans GFS.', replaced: 'PDF rangé dans GFS, à la place de l’ancien.', copied: name => `PDF rangé dans GFS sous le nom « ${name} ».`, ignored: 'PDF non rangé : annulé dans GFS.' }
  : { generated: 'PDF generated.', added: 'PDF saved to GFS.', replaced: 'PDF saved to GFS, replacing the old one.', copied: name => `PDF saved to GFS as “${name}”.`, ignored: 'PDF not saved: canceled in GFS.' };
const WORDS = lang === 'fr'
  ? { label: 'Destination du PDF', rows: ['Télécharger', 'Ranger dans GFS', 'Télécharger et ranger dans GFS'] }
  : { label: 'PDF destination', rows: ['Download', 'Save to GFS', 'Download and save to GFS'] };
const EXPORT_BUTTON = '#btn-export-pdf';
const FLYOUT = '#v2-export-pdf-flyout';
const ROW = value => `${FLYOUT} .v2-hover-row[data-destination="${value}"]`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const appFrame = page => page.frames().find(frame => frame.url().startsWith(APP_URL) && !frame.isDetached());
const statusOf = app => app.evaluate(() => { const el = document.getElementById('status-msg'); return { text: el.textContent, error: el.className === 'error-msg' }; });
const files = async rest => (await rest.rows('GFS_Fichiers')).sort((a, b) => a.id - b.id);
const hashOfRow = async (rest, row) => (await rest.attachment(row.Contenu[1])).hash;
const center = (app, selector) => app.evaluate(sel => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }, selector);
// La fenêtre du nom pris, vue par la personne (js/files/conflict-window.js).
const cf = frame => ({
  open: () => frame.locator('#cf-title').waitFor({ timeout: 30000 }),
  gone: () => frame.locator('.mod-scrim').waitFor({ state: 'detached' }),
  again: frame.locator('[data-fk="conflict-again"]'),
  both: frame.locator('[data-fk="conflict-both"]'),
  replace: frame.locator('[data-fk="conflict-replace"]'),
  cancel: frame.locator('[data-fk="conflict-cancel"]'),
  text: () => frame.locator('#cf-text').textContent(),
});

// ----- 0. Un modèle de l'app ouvert dans son éditeur, comme la personne le fait depuis l'explorateur.
async function openModel(run) {
  const { page, frame } = run;
  say('--- 0. un modèle de Publipostage+ ouvert ---');
  await seedFiles(frame);
  // Le modèle porte un nom de fichier PDF, comme la personne le règle dans la barre d'outils de l'app (sans lui, l'app nomme l'export « publipostage »).
  const model = (await run.rest.rows('Publipostage_Modeles')).find(row => row.Nom === MODEL);
  await page.evaluate(async ([doc, id, template]) => (await fetch(`/api/docs/${doc}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([['UpdateRecord', 'Publipostage_Modeles', id, { NomFichierPDF: template }]]) })).json(), [run.docId, model.id, FILE_TEMPLATE]);
  // GFS relit les tables des apps à son démarrage : le cadre repart, comme la personne qui recharge sa page.
  await frame.evaluate(() => location.reload());
  await frame.waitForFunction(() => document.body.dataset.gfs === 'ready', null, { timeout: 60000 });
  await page.waitForTimeout(800);
  await shot(frame, 'ranger-pp-0-debut');
  await rowOf(frame, MODEL).dblclick();
  const ready = await waitFor(page, 'Publipostage+ montre le modèle', async () => {
    const app = appFrame(page);
    if (!app) return false;
    const create = app.getByRole('button', { name: CREATE_TABLES });
    if (await create.count()) await create.click();
    return (await app.evaluate(() => Boolean(document.getElementById('btn-export-pdf')) && document.getElementById('template-name') && document.getElementById('template-name').value)) === MODEL;
  }, 90000);
  check(`${APP} s'ouvre sur « ${MODEL} » dans son éditeur, à 700 × 400`, ready);
  run.app = appFrame(page);
  await sleep(800);
  await shot(frame, 'ranger-pp-0-ouvert');
}

// La souris d'une personne dans le panneau : les coordonnées de l'app sont celles de son cadre, que la page de Grist place quelque part.
async function pointer(run, selector) {
  const box = await (await run.app.frameElement()).boundingBox();
  const at = await center(run.app, selector);
  return at && { ...at, x: box.x + at.x, y: box.y + at.y };
}
// La souris vient de la gauche sur le bouton « Exporter », le menu s'ouvre au survol, elle descend tout droit dedans puis va sur la ligne.
async function hoverRow(run, rowSelector) {
  const { page, app } = run;
  const button = await pointer(run, EXPORT_BUTTON);
  await page.mouse.move(button.x - 25, button.y);
  await page.mouse.move(button.x, button.y, { steps: 4 });
  await sleep(600);
  const row = await pointer(run, rowSelector);
  if (!row || !row.w) throw new Error(`ligne introuvable ou masquée : ${rowSelector}`);
  const inRow = Math.min(Math.max(button.x, row.x - row.w / 2 + 6), row.x + row.w / 2 - 6);
  await page.mouse.move(inRow, button.y + 10, { steps: 2 });
  await page.mouse.move(inRow, row.y, { steps: 6 });
  await page.mouse.move(row.x, row.y, { steps: 4 });
  await sleep(200);
  return row;
}
async function clickRow(run, rowSelector) {
  const row = await hoverRow(run, rowSelector);
  await run.page.mouse.click(row.x, row.y);
  await sleep(250);
  await run.page.mouse.move(run.away.x, run.away.y);
  await sleep(200);
}
// Ce que montre une ligne du menu : son texte, si elle est cochée, si elle est vivante (ni grisée ni retirée).
const rowsState = app => app.evaluate(selectors => selectors.map(sel => {
  const el = document.querySelector(sel);
  return el ? { text: el.textContent.trim(), checked: el.getAttribute('aria-checked') === 'true', live: !el.classList.contains('v2-hover-row-disabled') && !el.hasAttribute('aria-disabled') } : { missing: true };
}), ['download', 'gfs', 'both'].map(ROW));
const ticked = rows => rows.filter(row => row.checked).map(row => row.text).join('|');
// Le bouton « Exporter » à la souris : la ligne affichée, un PDF ; puis le coin d'état une fois l'export fini (ou la question de GFS, que la personne doit voir).
async function exportOne(run, until) {
  const { page, app } = run;
  await app.evaluate(() => { document.getElementById('status-msg').textContent = ''; });
  const button = await pointer(run, EXPORT_BUTTON);
  await page.mouse.move(button.x - 10, button.y, { steps: 2 });
  await page.mouse.click(button.x, button.y);
  await page.mouse.move(run.away.x, run.away.y);
  const finished = await waitFor(page, 'l\'export finit', async () => {
    if (until && await until()) return true;
    return /GFS|PDF généré|PDF generated/.test((await statusOf(app)).text);
  }, 60000);
  await sleep(250);
  return { finished, status: await statusOf(app) };
}
const bytesOf = (run, id) => run.page.evaluate(async ([doc, attachment]) => {
  const bytes = new Uint8Array(await (await fetch(`/api/docs/${doc}/attachments/${attachment}/download`)).arrayBuffer());
  return { head: String.fromCharCode(...bytes.slice(0, 5)), size: bytes.length };
}, [run.docId, id]);

// ----- 1. Le menu « Exporter » : « Destination du PDF », ses trois lignes vivantes, le choix gardé par GFS.
async function playMenu(run) {
  const { page, frame, app } = run;
  say('--- 1. le menu « Destination du PDF » ---');
  await hoverRow(run, ROW('gfs'));
  const label = await app.evaluate(sel => { const el = document.querySelector(`${sel} .v2-hover-flyout-label[data-i18n="destination.label"]`); return el ? el.textContent.trim() : null; }, FLYOUT);
  let rows = await rowsState(app);
  check(`« Exporter » porte l'intitulé « ${WORDS.label} » et ses trois lignes (${WORDS.rows.join(', ')})`, label === WORDS.label && rows.map(row => row.text).join('|') === WORDS.rows.join('|'), [label, rows]);
  check('GFS déclare le rangement : les deux lignes qui rangent sont vivantes (ni grisées, ni retirées)', rows.every(row => row.live), rows);
  check('au départ « Télécharger » est cochée, comme avant', ticked(rows) === WORDS.rows[0], rows);
  await shot(frame, 'ranger-pp-1-menu');
  await clickRow(run, ROW('gfs'));
  await hoverRow(run, ROW('gfs'));
  rows = await rowsState(app);
  check('un vrai clic sur « Ranger dans GFS » la coche (et décoche l\'autre)', ticked(rows) === WORDS.rows[1], rows);
  const kept = await frame.evaluate(key => { try { return localStorage.getItem(key); } catch (error) { return null; } }, STORAGE_KEY);
  check('GFS garde le choix de la personne pour l\'app (`stockage.ecrire`, clé `pp_export_destination`)', kept === 'gfs', kept);
  await page.mouse.move(run.away.x, run.away.y);
}

// ----- 2. Un premier export : GFS demande sa table, garde un vrai PDF, rien n'est téléchargé.
async function playFirstExport(run) {
  const { page, frame, rest, app } = run;
  say('--- 2. un premier export ---');
  check('au départ, GFS n\'a pas de table de fichiers (elle naît avec l\'accord de la personne)', (await files(rest)).length === 0 && !(await rest.tables()).includes('GFS_Fichiers'));
  const asked = () => frame.locator('.mod.ask').count().then(count => count > 0);
  const first = await exportOne(run, asked);
  check('c\'est GFS qui demande l\'accord pour sa table (l\'app n\'en pose aucune), devant le panneau', first.finished && await asked(), first);
  await shot(frame, 'ranger-pp-2-question');
  await frame.locator('[data-fk="ask-yes"]').click();
  const done = await waitFor(page, 'le coin d\'état dit le rangement', async () => (await statusOf(app)).text === SAYS.added, 60000);
  const rows = await files(rest);
  check(`le coin d'état de l'app dit « ${SAYS.added} » et aucun téléchargement n'a eu lieu`, done && run.downloads.length === 0, [await statusOf(app), run.downloads]);
  check('GFS garde un PDF : une ligne, un nom en .pdf, l\'app d\'origine, une pièce jointe', rows.length === 1 && /\.pdf$/.test(rows[0].Nom) && rows[0].Origine === 'publipostage' && Array.isArray(rows[0].Contenu) && rows[0].Contenu.length === 2, rows);
  run.name = rows[0].Nom;
  run.copyName = run.name.replace(/\.pdf$/, ' (1).pdf');
  const stored = await bytesOf(run, rows[0].Contenu[1]);
  check('la pièce jointe est un vrai PDF (`%PDF-`) de quelques ko', stored.head === '%PDF-' && stored.size > 800, stored);
  run.first = { row: rows[0], hash: await hashOfRow(rest, rows[0]) };
  await frame.locator('#floater-files').click();
  await frame.locator('.ex').waitFor();
  await rowOf(frame, run.name).waitFor();
  check('l\'explorateur montre le PDF rangé, avec son nom', await rowOf(frame, run.name).count() === 1);
  await shot(frame, 'ranger-pp-2-explorateur');
  await frame.locator('.ex').getByRole('button', { name: t('ex.close'), exact: true }).click();
  await frame.locator('.ex').waitFor({ state: 'hidden' });
}

// Un export qui tombe sur un nom pris : la fenêtre de GFS s'ouvre devant le panneau, la personne répond, l'app dit ce que GFS a fait.
const windowOpen = frame => () => frame.locator('#cf-title').count().then(count => count > 0);
async function exportWithName(run, answer, expectedText) {
  const { page, frame, app } = run;
  const win = cf(frame);
  const result = await exportOne(run, windowOpen(frame));
  await win.open();
  await answer(win);
  const done = await waitFor(page, `le coin d'état dit : ${expectedText}`, async () => (await statusOf(app)).text === expectedText, 60000);
  return { ...result, done, status: await statusOf(app) };
}

// ----- 3. Le même modèle exporté une seconde fois : le nom est pris.
async function playTaken(run) {
  const { page, frame, rest } = run;
  say('--- 3. un nom pris : garder les deux ---');
  check(`le premier PDF porte le nom de fichier que le modèle donne : « ${FILE_NAME} »`, run.name === FILE_NAME, run.name);
  const win = cf(frame);
  const result = await exportOne(run, windowOpen(frame));
  await win.open();
  check('la fenêtre de GFS s\'ouvre devant le panneau, avec son titre commun', (await frame.locator('#cf-title').textContent()) === t('files.conflict.title'), result);
  check('elle nomme l\'app qui range et le fichier pris', (await win.text()) === t('files.conflict.textFrom', { app: APP, name: run.name }), await win.text());
  check('le clavier est sur « Garder les deux » (un Entrée distrait n\'écrase rien)', await frame.evaluate(() => (document.activeElement && document.activeElement.dataset.fk) || null) === 'conflict-both');
  check('la fenêtre tient dans le panneau de 700 × 400 et ses textes sont lisibles (4,5:1)', (await contrastProblems(frame, '.mod')).length === 0 && JSON.stringify(await windowFits(frame)) === '{"shown":true,"inPanel":true,"overflowing":[]}', [await contrastProblems(frame, '.mod'), await windowFits(frame)]);
  check('rien n\'est écrit tant que la personne n\'a pas répondu', (await files(rest)).length === 1 && (await statusOf(run.app)).text !== SAYS.added);
  await shot(frame, 'ranger-pp-3-nom-pris');
  await win.both.click();
  const done = await waitFor(page, 'le coin d\'état dit la copie', async () => (await statusOf(run.app)).text === SAYS.copied(run.copyName), 60000);
  const rows = await files(rest);
  check(`« Garder les deux » : l'app dit « ${SAYS.copied(run.copyName)} »`, done, await statusOf(run.app));
  check('deux lignes : l\'ancien PDF garde son contenu, la copie est une ligne de plus, sans téléchargement', rows.length === 2 && rows[0].Nom === run.name && rows[1].Nom === run.copyName && await hashOfRow(rest, rows[0]) === run.first.hash && run.downloads.length === 0, rows.map(row => row.Nom));
}

// ----- 4. Une troisième fois : « Remplacer » garde la même ligne ; « Annuler » ne range rien.
async function playReplaceAndCancel(run) {
  const { rest } = run;
  say('--- 4. remplacer, annuler ---');
  const original = (await files(rest))[0];
  const replaced = await exportWithName(run, win => win.replace.click(), SAYS.replaced);
  const rows = await files(rest);
  check(`« Remplacer » : l'app dit « ${SAYS.replaced} »`, replaced.done, replaced.status);
  check('la même ligne (même identifiant) a un nouveau contenu, aucune ligne de plus, la copie n\'a pas bougé', rows.length === 2 && rows[0].Identifiant === original.Identifiant && rows[0].id === original.id && rows[0].Nom === run.name && await hashOfRow(rest, rows[0]) !== run.first.hash && rows[1].Nom === run.copyName, rows.map(row => [row.Nom, row.Identifiant]));
  const before = rows.map(row => [row.id, row.Nom, row.Contenu[1], row.Date]);
  const canceled = await exportWithName(run, win => win.cancel.click(), SAYS.ignored);
  const after = (await files(rest)).map(row => [row.id, row.Nom, row.Contenu[1], row.Date]);
  check(`« Annuler » : l'app dit « ${SAYS.ignored} », rien n'est rangé, rien n'est téléchargé`, canceled.done && JSON.stringify(after) === JSON.stringify(before) && run.downloads.length === 0, [canceled.status, run.downloads.length]);
}

// ----- 5. « Télécharger et ranger dans GFS » : les deux, avec les mêmes octets ; « Télécharger » seul ne range rien.
async function playBoth(run) {
  const { page, frame, rest, app } = run;
  say('--- 5. télécharger et ranger ---');
  await clickRow(run, ROW('both'));
  const thirdName = run.name.replace(/\.pdf$/, ' (2).pdf');
  const both = await exportWithName(run, win => win.both.click(), `${SAYS.copied(thirdName)} ${SAYS.generated}`);
  const rows = await files(rest);
  check(`« Télécharger et ranger dans GFS » : l'app dit le rangement puis le téléchargement (« ${SAYS.copied(thirdName)} ${SAYS.generated} » : « (1) » est pris, GFS donne le suivant libre)`, both.done, both.status);
  const downloaded = run.downloads[0] ? await readFile(await run.downloads[0].path()) : null;
  const newest = rows.find(row => row.Nom === thirdName);
  check('le PDF est téléchargé ET rangé : un fichier téléchargé au nom de l\'export, les mêmes octets que la pièce jointe de GFS', run.downloads.length === 1 && run.downloads[0].suggestedFilename() === run.name && Boolean(newest) && sha256(downloaded) === await hashOfRow(rest, newest), [run.downloads.map(each => each.suggestedFilename()), rows.map(row => row.Nom)]);
  await clickRow(run, ROW('download'));
  const kept = await frame.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  const rowsBefore = (await files(rest)).length;
  const plain = await exportOne(run);
  check('« Télécharger » seul : un PDF est téléchargé, GFS n\'en garde pas de plus, le coin d\'état dit seulement le téléchargement', run.downloads.length === 2 && (await files(rest)).length === rowsBefore && plain.status.text === SAYS.generated && kept === 'download', [plain.status, run.downloads.length, kept]);
  await shot(frame, 'ranger-pp-5-fin');
}

// ----- 6. Une archive ZIP de trois lignes : un rangement par PDF, tous du même lot. L'app donne à chaque PDF le nom de son entrée de l'archive (« nom », « nom (2) », « nom (3) ») ; GFS les prend l'un
// après l'autre. Trois fois le même export : aux noms libres (aucune fenêtre), puis aux trois noms pris (une seule fenêtre : « Faire pareil pour les suivants » + « Garder les deux »), puis encore (« Remplacer »).
const BATCH_NAME = 'Lot de contrats';
const BATCH_NAMES = [`${BATCH_NAME}.pdf`, `${BATCH_NAME} (2).pdf`, `${BATCH_NAME} (3).pdf`];
const BATCH_SAYS = lang === 'fr'
  ? { fresh: '3 PDF rangés dans GFS.', copied: '3 PDF rangés dans GFS (3 gardés en double).', replaced: '3 PDF rangés dans GFS (3 remplacés).' }
  : { fresh: '3 PDFs saved to GFS.', copied: '3 PDFs saved to GFS (3 kept as copies).', replaced: '3 PDFs saved to GFS (3 replaced).' };
// Le bouton « Exporter » lance l'export de la vue (mode ZIP) ; l'app demande confirmation pour les trois lignes (sa fenêtre, pas celle de GFS) ; rend le texte de sa question.
async function startBatch(run) {
  const { page, app } = run;
  await app.evaluate(() => { document.getElementById('status-msg').textContent = ''; });
  const button = await pointer(run, EXPORT_BUTTON);
  await page.mouse.move(button.x - 10, button.y, { steps: 2 });
  await page.mouse.click(button.x, button.y);
  await page.mouse.move(run.away.x, run.away.y);
  const generate = app.getByRole('button', { name: lang === 'fr' ? 'Générer' : 'Generate', exact: true });
  await generate.waitFor({ timeout: 30000 });
  const asked = await app.locator('#pp-dialog-message').textContent();
  await generate.click();
  return asked;
}
// Attend la fin du lot (le coin d'état de l'app, plus de fenêtre de GFS, toutes les lignes rangées) et compte les fenêtres que la personne a vues ; `opened` : la première est déjà ouverte.
async function finishBatch(run, rows, said, opened) {
  const { page, frame, rest, app } = run;
  const seen = { windows: opened ? 1 : 0, open: Boolean(opened) };
  const finished = await waitFor(page, 'le lot finit', async () => {
    const open = (await frame.locator('#cf-title').count()) > 0;
    if (open && !seen.open) seen.windows += 1;
    seen.open = open;
    return (await statusOf(app)).text === said && !open && (await files(rest)).length === rows;
  }, 90000);
  return { finished, windows: seen.windows, status: await statusOf(app) };
}
// La fenêtre de GFS du premier nom pris : la case « Faire pareil pour les suivants » est offerte, la fenêtre tient dans le panneau et se lit ; la personne coche la case puis répond.
async function answerBatch(run, answer, picture) {
  const { frame } = run;
  const win = cf(frame);
  await win.open();
  check('au premier nom pris du lot, la fenêtre de GFS offre « Faire pareil pour les suivants »', await win.again.count() === 1 && (await win.again.locator('xpath=..').textContent()).trim() === t('files.conflict.again'));
  check('la fenêtre avec la case tient dans le panneau et ses textes sont lisibles (4,5:1)', (await contrastProblems(frame, '.mod')).length === 0 && JSON.stringify(await windowFits(frame)) === '{"shown":true,"inPanel":true,"overflowing":[]}');
  await shot(frame, picture);
  await win.again.check();
  await answer(win);
}
const names = rows => rows.map(each => each.Nom);
async function playBatch(run) {
  const { page, frame, rest } = run;
  say('--- 6. une archive de trois PDF ---');
  await page.evaluate(async ([doc]) => (await fetch(`/api/docs/${doc}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([['BulkAddRecord', 'Clients', [null, null], { Nom: ['Martin', 'Durand'] }]]) })).json(), [run.docId]);
  await clickRow(run, ROW('gfs'));
  await clickRow(run, '#v2-export-lines-zip');   // « Toutes les lignes de la vue (ZIP) »
  // Le nom du fichier PDF, tel que la personne le tape dans la barre d'outils de l'app (sans variable : les trois lignes portent le même nom, l'archive les numérote).
  await run.app.evaluate(name => { const field = document.getElementById('pdf-filename-template'); field.value = name; }, BATCH_NAME);
  const downloadsBefore = run.downloads.length;
  const before = await files(rest);

  const asked = await startBatch(run);
  check('l\'app demande confirmation pour les trois lignes (sa fenêtre, pas celle de GFS)', asked.includes('3'), asked);
  const fresh = await finishBatch(run, before.length + 3, BATCH_SAYS.fresh, false);
  const first = (await files(rest)).slice(before.length);
  check(`trois PDF rangés sous les noms des entrées de l'archive (${BATCH_NAMES.join(', ')}), l'app dit « ${BATCH_SAYS.fresh} » et GFS ne pose aucune question`, fresh.finished && fresh.windows === 0 && JSON.stringify(names(first)) === JSON.stringify(BATCH_NAMES) && first.every(each => each.Origine === 'publipostage'), [names(first), fresh]);
  const hashes = await Promise.all(first.map(each => hashOfRow(rest, each)));

  await startBatch(run);
  await answerBatch(run, win => win.both.click(), 'ranger-pp-6-lot');
  const copied = await finishBatch(run, before.length + 6, BATCH_SAYS.copied, true);
  const second = (await files(rest)).slice(before.length + 3);
  const unchanged = (await Promise.all((await files(rest)).slice(before.length, before.length + 3).map(each => hashOfRow(rest, each)))).join() === hashes.join();
  check(`trois noms pris : une seule fenêtre, « Garder les deux » vaut pour les trois, l'app dit « ${BATCH_SAYS.copied} »`, copied.finished && copied.windows === 1, copied);
  check('trois copies de plus, d\'autres noms, aucun nom en double, les trois premiers PDF n\'ont pas bougé', second.length === 3 && second.every(each => /^Lot de contrats.*\.pdf$/.test(each.Nom) && !BATCH_NAMES.includes(each.Nom)) && new Set(names(await files(rest))).size === before.length + 6 && unchanged, names(second));

  await startBatch(run);
  await answerBatch(run, win => win.replace.click(), 'ranger-pp-6-lot-remplacer');
  const replaced = await finishBatch(run, before.length + 6, BATCH_SAYS.replaced, true);
  const rows = await files(rest);
  const again = rows.slice(before.length, before.length + 3);
  const renewed = (await Promise.all(again.map(each => hashOfRow(rest, each)))).every((hash, rank) => hash !== hashes[rank]);
  check(`« Remplacer » pour les suivants : l'app dit « ${BATCH_SAYS.replaced} », chacun des trois PDF reprend la ligne de son nom (même identifiant, nouveau contenu), aucune ligne de plus`, replaced.finished && replaced.windows === 1 && JSON.stringify(again.map(each => each.id)) === JSON.stringify(first.map(each => each.id)) && JSON.stringify(names(again)) === JSON.stringify(BATCH_NAMES) && renewed, [again.map(each => [each.id, each.Nom]), replaced]);
  check('l\'archive n\'est jamais téléchargée : les PDF sont rangés à sa place', run.downloads.length === downloadsBefore, run.downloads.length - downloadsBefore);
  await shot(frame, 'ranger-pp-6-fin');
}

async function main(run) {
  await openModel(run);
  run.away = { x: run.box.x + 5, y: run.box.y + run.box.height - 5 };
  run.downloads = [];
  run.page.on('download', download => run.downloads.push(download));
  await playMenu(run);
  await playFirstExport(run);
  await playTaken(run);
  await playReplaceAndCancel(run);
  await playBoth(run);
  await playBatch(run);
}

const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, server, { colorScheme: scheme });
  const run = await openGfs(context, { lang, mirrors: true });
  check(`GFS est à 700 × 400 dans le vrai Grist (${lang}, ${scheme})`, Math.abs(run.box.width - 700) <= 1 && Math.abs(run.box.height - 400) <= 1, run.box);
  await main(run);
  const unexpected = run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
  check('aucune erreur ni avertissement dans la console (GFS, Publipostage+), ni violation de politique', unexpected.length === 0, unexpected);
} finally {
  await browser.close();
  pages.close();
}
