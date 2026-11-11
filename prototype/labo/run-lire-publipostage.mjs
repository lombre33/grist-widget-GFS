// Lire un PDF que GFS garde avec la VRAIE Publipostage+ (consigne 040, 044 ; contrats 2.7 point 5, 5.4 point 8), celle que GFS référence, dans un VRAI serveur Grist (l'image officielle,
// `bash vrai-serveur.sh`) : le PDF est importé par « Nouveau > Importer > PDF », l'extension « Lecture de PDF » cochée dans « Apps et extensions », puis « Lire » ouvre l'app, qui reçoit
// le fichier de GFS, charge pdf.js par la source que GFS lui donne et dessine les pages dans son mode Lecture. Tout se joue à 700 × 400, à la vraie souris et au vrai clavier. Chromium seulement.
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-lire-publipostage.mjs        (LAB_LANG=fr|en, LAB_SCHEME=light|dark)
// Le Chromium du cloud (141) n'a pas `getOrInsertComputed` de Map et de WeakMap, que pdf.js 6 attend (Chrome 145, Firefox 144) : le labo les pose (lab-pdf.mjs) ; `LAB_NAVIGATEUR_ANCIEN=1` ne les
// pose pas et mesure ce que voit la personne d'un navigateur ancien (étape 6 seulement).
//   1. Avant l'extension : « Lire » est grisé, dit pourquoi ; un clic ouvre « Apps et extensions » sur la ligne de l'extension ; pdf.js ne s'offre que par la copie de GFS.
//   2. Lire : l'app démarre sur la question de ses tables (la sienne, pas celle de GFS), reçoit le PDF, le lit dans son mode Lecture : texte, couche de texte, encre sur le canevas, pdf.js de GFS.
//   3. Dans l'app : la molette et le clavier font défiler, les pages se dessinent en approchant, un mot se sélectionne à la vraie souris.
//   4. L'app déjà ouverte reçoit l'appel `ouvrir` : même cadre non rechargé, le second PDF remplace le premier.
//   5. « Télécharger » reste dans le menu de la ligne et rend le PDF octet pour octet ; Entrée et le double-clic lisent ; lire n'écrit rien dans les PDF de GFS.
//   6. Navigateur ancien : l'app dit qu'il est trop ancien, GFS n'a rien de cassé.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { pageTitle, ACCENTED_LINE } from './pdf-fixture.mjs';
import { PAGE_PORT, sha256, oldBrowser, openGfs, importSamples, shot, rowOf, openRowMenu, pressGreyed, waitFor, settle, closeModules } from './lab-pdf.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const APP = 'Publipostage+';
const EXTENSION = lang === 'fr' ? 'Lecture de PDF' : 'PDF reading';
const APP_URL = `http://127.0.0.1:${PAGE_PORT}/prototype/apps/publipostage/`;
const FK = 'ext:publipostage/lecture-pdf';
const CREATE_TABLES = lang === 'fr' ? /^Créer les tables$/ : /^Create the tables$/;
// Les phrases du coin d'état de l'app (js/i18n.js de Publipostage+ : pdf.status.*).
const SAYS = lang === 'fr'
  ? { opened: (name, n) => `PDF « ${name} » : ${n} ${n > 1 ? 'pages' : 'page'}.`, oldBrowser: 'Ce navigateur est trop ancien pour lire un PDF : mettez-le à jour.' }
  : { opened: (name, n) => `PDF “${name}”: ${n} ${n > 1 ? 'pages' : 'page'}.`, oldBrowser: 'This browser is too old to read a PDF: please update it.' };
const PDFJS = 'pdfjs-dist/build/pdf.min.mjs';

const appFrame = page => page.frames().find(frame => frame.url().startsWith(APP_URL) && !frame.isDetached());
const openButton = frame => frame.locator('.ex-foot .btn').first();
const buttonState = async frame => ({ label: (await openButton(frame).textContent()).trim(), greyed: (await openButton(frame).getAttribute('aria-disabled')) === 'true' });
const focusedRow = frame => frame.evaluate(() => (document.activeElement && document.activeElement.dataset.fk) || null);

// Ce que la personne voit dans l'app et ce que l'app tient : le coin d'état, la Lecture (feuilles, dessinées ou non, leur encre et leur texte), le défilement, le PDF ouvert, pdf.js de GFS.
const appSays = frame => frame.evaluate(moduleName => {
  const container = document.getElementById('reader-container');
  const inkOf = sheet => {
    const canvas = sheet.querySelector('canvas.pp-pdf-canvas');
    const counts = { ink: 0, dark: 0 };
    if (!canvas || sheet.dataset.rendered !== 'true') return counts;
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    for (let at = 0; at < pixels.length; at += 28) {
      if (pixels[at] < 250 || pixels[at + 1] < 250 || pixels[at + 2] < 250) counts.ink += 1;
      if (pixels[at] < 110 && pixels[at + 1] < 110 && pixels[at + 2] < 110) counts.dark += 1;
    }
    return counts;
  };
  const sheets = [...document.querySelectorAll('.pp-pdf-page')].map(sheet => {
    const layer = sheet.querySelector('.pp-pdf-text');
    return { n: Number(sheet.dataset.page), drawn: sheet.dataset.rendered === 'true', ...inkOf(sheet), text: layer ? layer.textContent : '', spans: layer ? layer.querySelectorAll('span').length : 0 };
  });
  let scroller = document.querySelector('.pp-pdf-pages');
  while (scroller && !(scroller.scrollHeight > scroller.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
  const library = typeof GfsLink !== 'undefined' ? GfsLink.library('pdfjs') : null;
  const engine = typeof Extensions !== 'undefined' && library && Extensions.isLoaded('lecture-pdf') ? Extensions.moduleNamespaces('pdfjs') : null;
  return {
    status: (document.getElementById('status-msg') || {}).textContent || '',
    reading: Boolean(container && container.classList.contains('pp-pdf-reading')),
    sheets, scrollTop: scroller ? Math.round(scroller.scrollTop) : null, pdf: typeof PdfReading !== 'undefined' ? PdfReading.info() : null,
    library: library ? { src: library.src, integrite: library.integrite, forme: library.forme } : null, version: engine && engine[moduleName] ? engine[moduleName].version : null,
  };
}, PDFJS);

// L'app a dessiné le PDF (`pages` feuilles, la première dessinée) ; la question de ses tables, qu'elle pose au premier démarrage d'un document neuf, reçoit la réponse de la personne (une fois).
async function waitForReading(run, pages, ms = 90000) {
  const { page } = run;
  return waitFor(page, `Publipostage+ lit le PDF (${pages} page${pages > 1 ? 's' : ''})`, async () => {
    const app = appFrame(page);
    if (!app) return false;
    const create = app.getByRole('button', { name: CREATE_TABLES });
    if (await create.count()) { await create.click(); run.tableQuestions += 1; }
    if (await run.frame.locator('.mod.ask').count()) { run.gfsQuestions += 1; await run.frame.locator('[data-fk="ask-yes"]').click(); }
    const seen = await appSays(app);
    return seen.reading && seen.sheets.length === pages && seen.sheets[0].drawn;
  }, ms);
}

// L'état du document que la lecture ne doit pas changer : les PDF de GFS (lignes et pièces jointes) ; les tables servent à dire lesquelles sont nées.
const documentState = async rest => ({ rows: (await rest.rows('GFS_Fichiers')).length, attachments: (await rest.attachments()).length, tables: await rest.tables() });

// ----- 1. Avant l'extension : « Lire » grisé, la raison, ce qui débloque.
async function playBeforeExtension(run) {
  const { page, frame } = run;
  say('--- 1. avant l\'extension ---');
  await rowOf(frame, 'Facture.pdf').click();
  const state = await buttonState(frame);
  check(`devant un PDF que ${APP} lit, le geste est « Lire », grisé jamais masqué`, state.label === t('files.read') && state.greyed, state);
  const info = await frame.locator('.ex-info').textContent();
  check('la barre dit ce qui manque : l\'extension, avec son nom (l\'app est toujours là)', info.includes(t('ex.lockedExtension', { name: EXTENSION })), info);
  await shot(frame, 'lire-pp-1-grise');
  await pressGreyed(page, openButton(frame));
  await frame.locator('.mod').waitFor();
  check('le clic sur « Lire » grisé ouvre « Apps et extensions » sur la ligne de l\'extension', await focusedRow(frame) === FK, await focusedRow(frame));
  check('aucune app n\'a été ouverte', !appFrame(page));
  await frame.locator(`[data-fk="${FK}"]`).check();
  await settle(page, frame);
  const hint = (await frame.locator('.mr', { has: frame.locator('[data-parent="publipostage"][data-ext="lecture-pdf"]') }).locator('.rd', { has: frame.locator('input[value="cdn"]') }).locator('.rd-hint').innerText()).trim();
  check('la copie de GFS est le seul mode de pdf.js (le CDN est grisé avec sa raison)', await frame.locator(`[data-fk="${FK}"]`).isChecked() && hint.length > 0, hint);
  await shot(frame, 'lire-pp-2-extension');
  await closeModules(page, frame);
  const ready = await buttonState(frame);
  check('l\'extension cochée, « Lire » est dégrisé et la barre dit où le PDF s\'ouvre', ready.label === t('files.read') && !ready.greyed && (await frame.locator('.ex-info').textContent()).includes(t('ex.opensIn', { app: APP })), ready);
}

// ----- 2. Lire : l'app démarre, reçoit le PDF, le lit dans son mode Lecture.
async function playRead(run) {
  const { page, frame, rest } = run;
  say('--- 2. lire ---');
  run.before = await documentState(rest);
  await openButton(frame).click();
  const drawn = await waitForReading(run, 3);
  check('Publipostage+ démarre et lit le PDF de 3 pages dans son mode Lecture', drawn);
  check('au premier démarrage d\'un document neuf, la question des tables est celle de l\'app (une fois) et GFS n\'en pose aucune', run.tableQuestions === 1 && run.gfsQuestions === 0, [run.tableQuestions, run.gfsQuestions]);
  const app = appFrame(page);
  const seen = await appSays(app);
  check('l\'explorateur se ferme et l\'app est montrée', await frame.locator('.ex').isHidden() && Boolean(app));
  const element = await app.frameElement();
  const box = await element.boundingBox();
  check('l\'app remplit le panneau de 700 × 400', Math.abs(box.width - 700) <= 1 && Math.abs(box.height - 400) <= 1, box);
  check('le coin d\'état de l\'app dit le PDF et ses pages', seen.status === SAYS.opened('Facture.pdf', 3), seen.status);
  check('l\'app tient le PDF que GFS a donné : son nom, 3 pages, l\'identifiant que GFS lui a donné', seen.pdf && seen.pdf.name === 'Facture.pdf' && seen.pdf.pages === 3 && seen.pdf.id === run.id, seen.pdf);
  check('la première page est dessinée : de l\'encre sur le canevas, du texte noir', seen.sheets[0].drawn && seen.sheets[0].ink > 50 && seen.sheets[0].dark > 5, seen.sheets[0]);
  check('le texte est celui de la page, accents compris, dans la couche de texte (sélection à la souris)', seen.sheets[0].spans >= 3 && seen.sheets[0].text.includes(pageTitle('Facture', 1)) && seen.sheets[0].text.includes(ACCENTED_LINE), seen.sheets[0]);
  check('pdf.js est celui de la copie de GFS : sa source, son empreinte, la forme « module »', seen.library && seen.library.src === `http://127.0.0.1:${PAGE_PORT}/prototype/vendor/pdfjs/1.0.0/pdfjs.js` && /^sha384-/.test(seen.library.integrite) && seen.library.forme === 'module', seen.library);
  check('pdf.js 6.5.438 est celui de la liste de GFS, chargé sans refus', seen.version === '6.5.438', seen.version);
  await page.waitForTimeout(400);
  await shot(frame, 'lire-pp-3-page');
  const after = await documentState(rest);
  check('lire n\'écrit rien dans les PDF de GFS (mêmes lignes, mêmes pièces jointes) ; seules les tables de l\'app sont nées', after.rows === run.before.rows && after.attachments === run.before.attachments
    && after.tables.filter(name => !run.before.tables.includes(name)).every(name => /^Publipostage_/.test(name)), { avant: run.before, apres: after });
}

// ----- 3. Dans l'app : défilement à la molette et au clavier, pages dessinées en approchant, un mot sélectionné.
async function playInsideApp(run) {
  const { page } = run;
  say('--- 3. dans l\'app ---');
  const app = appFrame(page);
  const box = await (await app.frameElement()).boundingBox();
  await page.mouse.move(box.x + 400, box.y + 280);
  await page.mouse.wheel(0, 3000);
  const reachedThree = await waitFor(page, 'la page 3 se dessine', async () => (await appSays(app)).sheets[2].drawn);
  const scrolled = await appSays(app);
  check('la molette fait défiler la Lecture et la page 3 se dessine en approchant', reachedThree && scrolled.scrollTop > 100, [scrolled.scrollTop, scrolled.sheets.map(sheet => sheet.drawn)]);
  check('la page 3 porte son texte et de l\'encre', scrolled.sheets[2].text.includes(pageTitle('Facture', 3)) && scrolled.sheets[2].ink > 50, scrolled.sheets[2]);
  await page.mouse.click(box.x + 400, box.y + 280);
  await page.keyboard.press('Home');
  const top = await waitFor(page, 'Début remonte', async () => (await appSays(app)).scrollTop === 0);
  check('au vrai clavier, « Début » remonte à la première page', top, (await appSays(app)).scrollTop);
  await page.keyboard.press('PageDown');
  check('« Page suivante » fait défiler', await waitFor(page, 'PageDown défile', async () => (await appSays(app)).scrollTop > 100), (await appSays(app)).scrollTop);
  await page.mouse.wheel(0, -3000);
  await waitFor(page, 'retour en haut', async () => (await appSays(app)).scrollTop === 0);
  // Le titre de la page 1 passe sous la barre d'outils de l'app si on le défile trop : la molette l'amène au milieu de la zone de lecture, puis le double-clic le prend.
  const word = app.locator('.pp-pdf-text span', { hasText: pageTitle('Facture', 1) }).first();
  const lower = await word.boundingBox();
  await page.mouse.wheel(0, Math.round(lower.y + lower.height / 2 - (box.y + 290)));
  await page.waitForTimeout(600);
  const spot = await word.boundingBox();
  await page.mouse.dblclick(spot.x + 6, spot.y + spot.height / 2);
  const selected = await app.evaluate(() => String(getSelection()).trim());
  check('un double-clic dans le texte sélectionne un mot (la couche de texte se sélectionne)', /^Facture$/.test(selected), selected);
  await shot(run.frame, 'lire-pp-4-selection');
}

// ----- 4. L'app déjà ouverte : l'appel `ouvrir`, le même cadre.
async function playAlreadyOpen(run) {
  const { page, frame } = run;
  say('--- 4. l\'app déjà ouverte ---');
  const app = appFrame(page);
  await app.evaluate(() => { window.gfsLabMarker = 'avant'; });
  await frame.locator('#floater-files').click();
  await frame.locator('.ex').waitFor();
  await rowOf(frame, 'Devis.pdf').click();
  await openButton(frame).click();
  const read = await waitFor(page, 'le second PDF', async () => { const seen = await appSays(app); return seen.pdf && seen.pdf.name === 'Devis.pdf' && seen.sheets.length === 1 && seen.sheets[0].drawn; });
  const seen = await appSays(app);
  check('le second PDF est lu : 1 page, son titre, de l\'encre, le coin d\'état le dit', read && seen.sheets[0].text.includes(pageTitle('Devis', 1)) && seen.sheets[0].ink > 50 && seen.status === SAYS.opened('Devis.pdf', 1), seen);
  check('l\'app tient l\'identifiant que GFS a donné à ce PDF', seen.pdf.id === (await run.rest.rows('GFS_Fichiers')).find(row => row.Nom === 'Devis.pdf').Identifiant, seen.pdf);
  check('le même cadre, non rechargé : l\'app l\'a lu par l\'appel `ouvrir`', appFrame(page) === app && await app.evaluate(() => window.gfsLabMarker) === 'avant');
  check('l\'explorateur s\'est refermé', await frame.locator('.ex').isHidden());
  await shot(frame, 'lire-pp-5-second');
}

// ----- 5. « Télécharger » reste là ; Entrée et le double-clic lisent.
async function playDownloadAndKeys(run) {
  const { page, frame, rest } = run;
  say('--- 5. télécharger, clavier ---');
  await frame.locator('#floater-files').click();
  await frame.locator('.ex').waitFor();
  await openRowMenu(frame, 'Facture.pdf');
  const [download] = await Promise.all([page.waitForEvent('download'), frame.getByRole('menuitem', { name: t('files.download') }).click()]);
  const bytes = await readFile(await download.path());
  check('« Télécharger » du menu rend le PDF octet pour octet', download.suggestedFilename() === 'Facture.pdf' && sha256(bytes) === run.facture.hash, [download.suggestedFilename(), bytes.length]);
  await rowOf(frame, 'Facture.pdf').click();
  await page.keyboard.press('Enter');
  const app = appFrame(page);
  check('Entrée sur la ligne choisie lit le PDF (et ne le télécharge pas)', await waitFor(page, 'Entrée lit', async () => (await appSays(app)).pdf.name === 'Facture.pdf' && (await appSays(app)).sheets.length === 3), (await appSays(app)).pdf);
  await frame.locator('#floater-files').click();
  await frame.locator('.ex').waitFor();
  await rowOf(frame, 'Devis.pdf').dblclick();
  check('le double-clic lit aussi', await waitFor(page, 'le double-clic lit', async () => (await appSays(app)).pdf.name === 'Devis.pdf'));
  const after = await documentState(rest);
  check('lire et télécharger n\'ont rien écrit : mêmes lignes, mêmes pièces jointes', after.rows === run.before.rows && after.attachments === run.before.attachments, [run.before, after]);
}

// ----- 6. Navigateur ancien : l'app le dit, GFS n'a rien de cassé.
async function playOldBrowser(run) {
  const { page, frame } = run;
  say('--- 6. navigateur ancien (sans getOrInsertComputed) ---');
  await openButton(frame).click();
  await waitFor(page, 'Publipostage+ démarre', async () => {
    const app = appFrame(page);
    if (!app) return false;
    const create = app.getByRole('button', { name: CREATE_TABLES });
    if (await create.count()) await create.click();
    return (await appSays(app)).status === SAYS.oldBrowser;
  });
  const app = appFrame(page);
  const seen = await appSays(app);
  check('l\'app dit que le navigateur est trop ancien pour lire un PDF, avec la phrase de son coin d\'état', seen.status === SAYS.oldBrowser, seen.status);
  check('aucune feuille n\'est posée et aucun PDF n\'est tenu : l\'app reste sur son modèle habituel', !seen.reading && seen.sheets.length === 0 && seen.pdf === null, seen);
  check('l\'explorateur est fermé, l\'app est montrée (GFS a fait ce qu\'on lui demandait)', await frame.locator('.ex').isHidden() && Boolean(app));
  await shot(frame, 'lire-pp-6-ancien');
  await frame.locator('#floater-files').click();
  await frame.locator('.ex').waitFor();
  const state = await buttonState(frame);
  check('l\'explorateur revient, « Lire » reste prêt pour un autre navigateur', state.label === t('files.read') && !state.greyed, state);
}

const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, server, { colorScheme: scheme });
  const run = await openGfs(context, { lang, mirrors: true });
  Object.assign(run, { tableQuestions: 0, gfsQuestions: 0 });
  check(`GFS est à 700 × 400 dans le vrai Grist (${lang}, ${scheme}${oldBrowser ? ', navigateur ancien' : ''})`, Math.abs(run.box.width - 700) <= 1 && Math.abs(run.box.height - 400) <= 1, run.box);
  await importSamples(run);
  await playBeforeExtension(run);
  if (oldBrowser) await playOldBrowser(run);
  else {
    await playRead(run);
    await playInsideApp(run);
    await playAlreadyOpen(run);
    await playDownloadAndKeys(run);
  }
  const unexpected = run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
  check('aucune erreur ni avertissement dans la console (GFS, Publipostage+, pdf.js), ni violation de politique', unexpected.length === 0, unexpected);
} finally {
  await browser.close();
  pages.close();
}
