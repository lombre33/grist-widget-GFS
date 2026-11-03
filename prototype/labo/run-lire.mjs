// Lire un PDF que GFS garde (contrats 2.7 point 5, 5.2 point 3, 5.4 point 8), joué dans un VRAI serveur Grist (l'image officielle, `bash vrai-serveur.sh`) : le PDF est importé par
// « Nouveau > Importer > PDF », puis une app qui sait le lire (la sonde Y, `labo/sondes/y-lire-pdf/`, qui fait ce que fera Publipostage+ avec son extension « Lecture de PDF ») le reçoit
// de GFS, charge pdf.js par la source que GFS lui donne, et dessine la page. Tout se joue à 700 × 400, à la vraie souris et au vrai clavier. Chromium seulement.
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-lire.mjs        (LAB_LANG=fr|en, LAB_SCHEME=light|dark)
// Le labo seul range la sonde dans la ligne provisoire `ACCEPTS_OPEN` (`lire: true`) ; `LAB_LIRE=non` la laisse à « pas encore » pour mesurer ce grisé.
//   1. Avant l'app : « Lire » est le geste du PDF, grisé, et dit pourquoi ; un clic ouvre « Apps et extensions » sur la ligne de l'app, puis sur celle de l'extension.
//   2. L'app prête : « Lire » ouvre la sonde, qui reçoit un vrai `File` (empreinte identique), charge pdf.js (copie de GFS, empreinte, sans violation de politique), dessine la page et sa couche de texte.
//   3. Dans l'app : page suivante à la souris et au clavier, un mot sélectionné à la souris dans la couche de texte.
//   4. L'app déjà ouverte reçoit l'appel `ouvrir` (même cadre, non rechargé), et la raison `lire`.
//   5. « Télécharger » reste dans le menu de la ligne et télécharge le PDF octet pour octet ; lire n'écrit rien dans le document.
//   6. Quand le transfert échoue : la phrase le dit, l'app n'est pas ouverte.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n.js';
import { makePdf, pageTitle, ACCENTED_LINE } from './pdf-fixture.mjs';
import { PAGE_PORT, sha256, openGfs, waitForNames, waitForToast, importPdf, shot, rowOf, openRowMenu, pressGreyed, contrastProblems, waitFor, settle, closeModules } from './lab-pdf.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const ready = process.env.LAB_LIRE !== 'non';
const { t } = createI18n(lang);
const EXTENSION = lang === 'fr' ? 'Lecture de PDF' : 'PDF reading';
const APP = lang === 'fr' ? 'Sonde Y' : 'Probe Y';
const PROBE_URL = `http://127.0.0.1:${PAGE_PORT}/prototype/labo/sondes/y-lire-pdf/`;
const ACCEPTS = { fichier: 'controller.js', de: 'const ACCEPTS_OPEN = Object.freeze({', vers: `const ACCEPTS_OPEN = Object.freeze({ 'sonde-y': { lire: ${ready} },` };

const pdfFile = (name, pages, title) => {
  const buffer = makePdf({ pages, title });
  return { file: { name, mimeType: 'application/pdf', buffer }, hash: sha256(buffer), size: buffer.length, pages, title };
};

// Ce que dit la sonde (body[data-sonde]) et son cadre : l'app est dans un sous-cadre isolé (sandbox sans allow-same-origin) du site de GFS.
const probeFrame = page => page.frames().find(frame => frame.url().startsWith(PROBE_URL) && !frame.isDetached());
const probeSays = page => { const frame = probeFrame(page); return frame ? frame.evaluate(() => JSON.parse(document.body.dataset.sonde || '{}')) : Promise.resolve(null); };
const showsPage = (page, number) => waitFor(page, `page ${number}`, async () => (await probeSays(page)).pdf.page === number);

const focusedRow = frame => frame.evaluate(() => (document.activeElement && document.activeElement.dataset.fk) || null);
const openButton = frame => frame.locator('.ex-foot .btn').first();
const buttonState = async frame => ({ label: (await openButton(frame).textContent()).trim(), greyed: (await openButton(frame).getAttribute('aria-disabled')) === 'true' });
const menuItems = frame => frame.locator('.menu .menu-item').evaluateAll(nodes => nodes.map(node => ({ label: node.querySelector('.menu-label').textContent, greyed: node.getAttribute('aria-disabled') === 'true' })));

// ----- 0. Un PDF dans GFS (lot 1).
async function importFirst(run) {
  const { page, frame } = run;
  say('--- 0. un PDF dans GFS ---');
  run.facture = pdfFile('Facture.pdf', 3, 'Facture');
  await importPdf(page, frame, run.facture.file);
  await frame.locator('.mod.ask').waitFor();
  await frame.locator('[data-fk="ask-yes"]').click();
  check('le PDF de 3 pages est dans l\'explorateur', JSON.stringify(await waitForNames(frame, ['Facture.pdf'])) === '["Facture.pdf"]');
  await waitForToast(frame, /GFS/);
  run.id = (await run.rest.rows('GFS_Fichiers')).find(row => row.Nom === 'Facture.pdf').Identifiant;
  run.devis = pdfFile('Devis.pdf', 1, 'Devis');
  await importPdf(page, frame, run.devis.file);
  await waitForNames(frame, ['Devis.pdf', 'Facture.pdf']);
}

// ----- 1. Avant l'app : « Lire » grisé, la raison, ce qui débloque.
async function playBeforeApp(run) {
  const { page, frame } = run;
  say('--- 1. avant l\'app ---');
  await rowOf(frame, 'Facture.pdf').click();
  const state = await buttonState(frame);
  check('devant un PDF que l\'app Sonde Y lit, le geste est « Lire », grisé jamais masqué', state.label === t('files.read') && state.greyed, state);
  const info = await frame.locator('.ex-info').textContent();
  check('la barre dit ce qui manque, avec le nom de l\'app', info.includes(t('ex.lockedApp', { app: APP })), info);
  await shot(frame, 'lire-1-grise');
  await openRowMenu(frame, 'Facture.pdf');
  const items = await menuItems(frame);
  check('le menu de la ligne : Lire (grisé), puis Télécharger, Épingler, Renommer, Dupliquer (grisé), Déplacer, Supprimer',
    JSON.stringify(items) === JSON.stringify([{ label: t('files.read'), greyed: true }, { label: t('files.download'), greyed: false }, { label: t('ex.pin'), greyed: false }, { label: t('ex.rename'), greyed: false },
      { label: t('ex.duplicate'), greyed: true }, { label: t('ex.move'), greyed: false }, { label: t('ex.delete'), greyed: false }]), items);
  await shot(frame, 'lire-2-menu');
  await page.keyboard.press('Escape');
  await frame.locator('.menu').waitFor({ state: 'detached' });

  await installReader(run);
}

// La personne installe l'app (la case, à la vraie souris), puis active l'extension « Lecture de PDF » : chaque clic sur « Lire » grisé la mène à la bonne ligne de la fenêtre.
async function installReader(run) {
  const { page, frame } = run;
  await pressGreyed(page, openButton(frame));
  await frame.locator('.mod').waitFor();
  check('le clic sur « Lire » grisé ouvre « Apps et extensions » sur la ligne de l\'app', await focusedRow(frame) === 'app:sonde-y', await focusedRow(frame));
  check('aucune app n\'a été ouverte', !probeFrame(page));
  await shot(frame, 'lire-3-fenetre-app');
  await frame.locator('[data-fk="app:sonde-y"]').check();
  await settle(page, frame);
  await closeModules(page, frame);
  const afterApp = await frame.locator('.ex-info').textContent();
  check('l\'app installée, la barre demande l\'extension « Lecture de PDF »', afterApp.includes(t('ex.lockedExtension', { name: EXTENSION })), afterApp);
  await pressGreyed(page, openButton(frame));
  await frame.locator('.mod').waitFor();
  check('le clic ouvre la fenêtre sur la ligne de l\'extension', await focusedRow(frame) === 'ext:sonde-y/lecture-pdf', await focusedRow(frame));
  await frame.locator('[data-fk="ext:sonde-y/lecture-pdf"]').check();
  await settle(page, frame);
  const hint = (await frame.locator('.mr', { has: frame.locator('[data-ext="lecture-pdf"]') }).locator('.rd', { has: frame.locator('input[value="cdn"]') }).locator('.rd-hint').innerText()).trim();
  check('la copie de GFS est le seul mode de pdf.js (le CDN est grisé avec sa raison)', await frame.locator('[data-ext="lecture-pdf"]').isChecked() && hint.length > 0, hint);
  await shot(frame, 'lire-4-extension');
  await closeModules(page, frame);
}

// ----- 1 bis. Une app installée qui ne lit pas encore le PDF de GFS : « Lire » grisé, la phrase au clic, aucune fenêtre, aucune app ouverte.
async function playNotYet(run) {
  const { page, frame } = run;
  say('--- 1 bis. l\'app ne lit pas encore ---');
  await rowOf(frame, 'Facture.pdf').click();
  await installReader(run);
  const state = await buttonState(frame);
  check('l\'app et l\'extension sont là mais l\'app ne reçoit pas encore le PDF : « Lire » reste grisé', state.label === t('files.read') && state.greyed, state);
  check('la barre dit « pas encore » et le téléchargement', (await frame.locator('.ex-info').textContent()).includes(t('files.read.notYet', { app: APP })));
  await pressGreyed(page, openButton(frame));
  const said = await waitForToast(frame, /./);
  check('le clic dit la même chose, sans fenêtre et sans ouvrir l\'app', said === t('files.read.notYet', { app: APP }) && (await frame.locator('.mod').count()) === 0 && !probeFrame(page), said);
  await shot(frame, 'lire-9-pas-encore');
  await openRowMenu(frame, 'Facture.pdf');
  const [download] = await Promise.all([page.waitForEvent('download'), frame.getByRole('menuitem', { name: t('files.download') }).click()]);
  check('« Télécharger » du menu reste là et rend le PDF', download.suggestedFilename() === 'Facture.pdf');
}

// ----- 2. L'app prête : « Lire » ouvre la sonde, qui reçoit le fichier et dessine la page.
async function playRead(run) {
  const { page, frame, rest } = run;
  say('--- 2. lire ---');
  const before = { rows: (await rest.rows('GFS_Fichiers')).length, attachments: (await rest.attachments()).length, tables: await rest.tables() };
  const state = await buttonState(frame);
  check('« Lire » est maintenant dégrisé', state.label === t('files.read') && !state.greyed, state);
  check('la barre dit où le PDF s\'ouvre', (await frame.locator('.ex-info').textContent()).includes(t('ex.opensIn', { app: APP })));
  await shot(frame, 'lire-5-prete');
  await openButton(frame).click();
  await waitFor(page, 'la sonde a dessiné', async () => (await probeSays(page)).pdf);
  const said = await probeSays(page);
  check('l\'explorateur se ferme, l\'app est montrée', await frame.locator('.ex').isHidden() && Boolean(probeFrame(page)));
  const reading = said.lectures[0] || {};
  check('l\'app reçoit un vrai File dans son cadre isolé : nom, taille, type, octets lus, même empreinte que le PDF choisi',
    reading.estFichier === true && reading.nom === 'Facture.pdf' && reading.taille === run.facture.size && reading.type === 'application/pdf' && reading.lus === run.facture.size && reading.entete === '%PDF-1.4' && reading.empreinte === run.facture.hash, reading);
  check('l\'ouverture dit pourquoi : raison « lire », type pdf, aucun fichier d\'app, l\'identifiant que GFS a donné au PDF', said.ouverture.raison === 'lire' && said.ouverture.type === 'pdf' && said.ouverture.fichier === null && said.ouverture.id === run.id, said.ouverture);
  check('l\'extension est active pour l\'app et GFS lui donne pdf.js', said.extensions.includes('lecture-pdf') && said.bibliotheque && said.bibliotheque.forme === 'module', said.bibliotheque);
  check('la source est la copie de GFS, avec son empreinte, et le script module s\'est chargé sans refus', said.bibliotheque.chargee === true && /\/prototype\/vendor\/pdfjs\/1\.0\.0\/pdfjs\.js$/.test(said.bibliotheque.src) && /^sha384-/.test(said.bibliotheque.integrite) && said.violations.length === 0, [said.bibliotheque, said.violations]);
  check('pdf.js 6.5.438 est celui de la liste de GFS', said.bibliotheque.version === '1.0.0' && said.bibliotheque.pdfjs === '6.5.438', said.bibliotheque);
  check('le PDF s\'ouvre : 3 pages, la première dessinée (de l\'encre sur le canevas, du texte noir)', said.pdf.pages === 3 && said.pdf.page === 1 && said.pdf.encre > 50 && said.pdf.sombre > 5, said.pdf);
  check('le texte est celui de la page, accents compris', said.pdf.texte.includes(pageTitle('Facture', 1)) && said.pdf.texte.includes(ACCENTED_LINE), said.pdf.texte);
  check('la couche de texte (sélection à la souris) porte le même texte', said.pdf.couche.spans >= 3 && said.pdf.couche.texte.includes(pageTitle('Facture', 1)), said.pdf.couche);
  check('aucune erreur dans l\'app', said.erreurs.length === 0, said.erreurs);
  await run.page.waitForTimeout(400);
  await shot(frame, 'lire-6-page');
  const after = { rows: (await rest.rows('GFS_Fichiers')).length, attachments: (await rest.attachments()).length, tables: await rest.tables() };
  check('lire n\'écrit rien : mêmes lignes, mêmes pièces jointes, mêmes tables', JSON.stringify(after) === JSON.stringify(before), [before, after]);
}

// ----- 3. Dans l'app : la souris, le clavier, la couche de texte.
async function playInsideApp(run) {
  const { page } = run;
  say('--- 3. dans l\'app ---');
  const app = probeFrame(page);
  const element = await app.frameElement();
  check('l\'app remplit le panneau de 700 × 400', Math.abs((await element.boundingBox()).width - 700) <= 1 && Math.abs((await element.boundingBox()).height - 400) <= 1, await element.boundingBox());
  const panel = await element.boundingBox();
  const canvas = await app.locator('#canvas').boundingBox();
  check('la page dessinée tient dans le panneau, sans défilement', canvas.x >= panel.x && canvas.y >= panel.y && canvas.x + canvas.width <= panel.x + 700 && canvas.y + canvas.height <= panel.y + 400, [canvas, panel]);
  await app.locator('#next').click();
  check('« page suivante » à la vraie souris : la page 2 et son texte', await showsPage(page, 2) && (await probeSays(page)).pdf.texte.includes(pageTitle('Facture', 2)), (await probeSays(page)).pdf);
  await page.keyboard.press('ArrowRight');
  check('la flèche droite, au vrai clavier : la page 3', await showsPage(page, 3) && (await probeSays(page)).pdf.texte.includes(pageTitle('Facture', 3)));
  await page.keyboard.press('ArrowLeft');
  check('la flèche gauche revient à la page 2', await showsPage(page, 2));
  await app.locator('#prev').click();
  await showsPage(page, 1);
  // Un mot de la couche de texte, double-clic à la vraie souris : la sélection du navigateur en rend le mot.
  const word = app.locator('#text span', { hasText: pageTitle('Facture', 1) }).first();
  const box = await word.boundingBox();
  await page.mouse.dblclick(box.x + 6, box.y + box.height / 2);
  const selected = await app.evaluate(() => String(getSelection()).trim());
  check('un double-clic dans le texte sélectionne un mot (la couche de texte se sélectionne)', /^Facture$/.test(selected), selected);
  await shot(run.frame, 'lire-7-selection');
}

// ----- 4. L'app déjà ouverte : l'appel `ouvrir`, le même cadre.
async function playAlreadyRunning(run) {
  const { page, frame } = run;
  say('--- 4. l\'app déjà ouverte ---');
  await frame.locator('#floater-files').click();
  await frame.locator('.ex').waitFor();
  const framesBefore = page.frames().filter(each => each.url().startsWith(PROBE_URL)).length;
  await rowOf(frame, 'Devis.pdf').click();
  await openButton(frame).click();
  await waitFor(page, 'le second PDF', async () => (await probeSays(page)).lectures.length === 2 && (await probeSays(page)).pdf.pages === 1 && (await probeSays(page)).pdf.page === 1);
  const said = await probeSays(page);
  check('la sonde reçoit l\'appel `ouvrir` avec la raison « lire » (pas de nouvelle ouverture)', said.appels.length === 1 && said.appels[0].raison === 'lire' && said.appels[0].lecture === true && said.appels[0].type === 'pdf', said.appels);
  check('le même cadre, non rechargé (le premier PDF est encore dans l\'historique de la sonde)', page.frames().filter(each => each.url().startsWith(PROBE_URL)).length === framesBefore && said.lectures[0].nom === 'Facture.pdf' && said.lectures[1].nom === 'Devis.pdf', said.lectures);
  check('le second PDF est lu : 1 page, son titre, de l\'encre', said.pdf.pages === 1 && said.pdf.texte.includes(pageTitle('Devis', 1)) && said.pdf.encre > 50 && said.lectures[1].empreinte === run.devis.hash, said.pdf);
  check('la bibliothèque n\'est pas rechargée : la même source', said.bibliotheque.chargee === true && said.violations.length === 0 && said.erreurs.length === 0, [said.bibliotheque, said.violations, said.erreurs]);
  check('l\'explorateur s\'est refermé', await frame.locator('.ex').isHidden());
}

// ----- 5. « Télécharger » reste là ; le double-clic et Entrée lisent.
async function playDownloadAndKeys(run) {
  const { page, frame, rest } = run;
  say('--- 5. télécharger, clavier ---');
  await frame.locator('#floater-files').click();
  await frame.locator('.ex').waitFor();
  await openRowMenu(frame, 'Facture.pdf');
  const [download] = await Promise.all([page.waitForEvent('download'), frame.getByRole('menuitem', { name: t('files.download') }).click()]);
  const bytes = await readFile(await download.path());
  check('« Télécharger » du menu rend le PDF octet pour octet', download.suggestedFilename() === 'Facture.pdf' && sha256(bytes) === run.facture.hash, [download.suggestedFilename(), bytes.length]);
  check('la lecture et le téléchargement n\'ont rien écrit', (await rest.rows('GFS_Fichiers')).length === 2 && (await rest.attachments()).length === 2);
  await rowOf(frame, 'Facture.pdf').click();
  const before = (await probeSays(page)).appels.length;
  await page.keyboard.press('Enter');
  await waitFor(page, 'Entrée lit', async () => (await probeSays(page)).appels.length === before + 1);
  const said = await probeSays(page);
  check('Entrée sur la ligne choisie lit le PDF (et ne le télécharge pas)', said.appels.length === before + 1 && said.lectures.at(-1).nom === 'Facture.pdf' && said.pdf.pages === 3, said.appels);
  await frame.locator('#floater-files').click();
  await frame.locator('.ex').waitFor();
  await rowOf(frame, 'Devis.pdf').dblclick();
  await waitFor(page, 'le double-clic lit', async () => (await probeSays(page)).lectures.at(-1).nom === 'Devis.pdf' && (await probeSays(page)).lectures.length === 4);
  check('le double-clic lit aussi', (await probeSays(page)).lectures.at(-1).nom === 'Devis.pdf');
}

// ----- 6. Quand le transfert échoue : la phrase le dit, rien ne s'ouvre.
async function playFailure(run) {
  const { page, frame } = run;
  say('--- 6. le transfert échoue ---');
  run.allow.push(/le fichier n’a pas pu être traité/);
  await frame.locator('#floater-files').click();
  await frame.locator('.ex').waitFor();
  const reads = (await probeSays(page)).lectures.length;
  await page.context().route(/\/attachments\/\d+\/download/, route => route.abort('failed'));
  await rowOf(frame, 'Facture.pdf').click();
  await openButton(frame).click();
  const said = await waitForToast(frame, /n’a pas pu être ouvert|could not be opened/);
  await page.context().unroute(/\/attachments\/\d+\/download/);
  check('la phrase dit que le PDF n\'a pas pu être ouvert, avec la raison en mots', said.includes('Facture.pdf') && said.includes(t('files.err.network')), said);
  check('l\'explorateur reste ouvert et la sonde ne reçoit rien', !(await frame.locator('.ex').isHidden()) && (await probeSays(page)).lectures.length === reads);
  await shot(frame, 'lire-8-echec');
}

// ----- Les textes de l'explorateur tiennent la charte (4,5:1) avec le geste « Lire » prêt.
async function checkLook(run) {
  const { frame } = run;
  await rowOf(frame, 'Facture.pdf').click();
  const problems = await contrastProblems(frame, '.ex-foot, .ex-info');
  check('« Lire » prêt, son pied et sa barre d\'information tiennent la charte (4,5:1)', problems.length === 0, problems);
  const fits = await frame.evaluate(() => { const foot = document.querySelector('.ex-foot').getBoundingClientRect(); return foot.right <= window.innerWidth && foot.bottom <= window.innerHeight; });
  check('le pied tient dans le panneau', fits);
}

const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, server, { colorScheme: scheme });
  const run = await openGfs(context, { lang, probes: ['y'], patches: [ACCEPTS] });
  check(`GFS est à 700 × 400 dans le vrai Grist (${lang}, ${scheme})`, Math.abs(run.box.width - 700) <= 1 && Math.abs(run.box.height - 400) <= 1, run.box);
  await importFirst(run);
  if (!ready) await playNotYet(run);
  else {
    await playBeforeApp(run);
    await playRead(run);
    await playInsideApp(run);
    await playAlreadyRunning(run);
    await playDownloadAndKeys(run);
    await playFailure(run);
    await checkLook(run);
  }
  const unexpected = run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
  check('aucune erreur ni avertissement dans la console (GFS, la sonde, pdf.js), ni violation de politique', unexpected.length === 0, unexpected);
} finally {
  await browser.close();
  pages.close();
}
