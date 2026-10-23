// « Nouveau > Importer » (contrats 2.7 point 4, 5.2 point 3 et 5.4 point 1), dans un vrai Grist, à 700 × 400, à la vraie souris et au vrai clavier : le menu « Nouveau » de l'explorateur
// a un sous-menu « Importer », un article par format que le manifeste d'une app déclare ; un clic ouvre le sélecteur de fichier de GFS (celui du navigateur), et l'app reçoit le fichier avec
// l'ouverture (au démarrage) ou avec l'appel `ouvrir` (déjà ouverte). Publipostage+ reçoit le fichier depuis sa consigne 035 (la vraie app : run-importer-pp.mjs) ; ici le labo la remet à « pas encore » (`importer: false`) pour mesurer le grisé d'une
// app qui déclare un format sans le recevoir : ses formats sont grisés, sans sélecteur.
// La sonde P (labo/sondes/p-importer/) fait ce que fait Publipostage+ : le labo seul la range dans la ligne provisoire `ACCEPTS_OPEN` (`importer: true`) et elle LIT le fichier reçu.
//   1. Rien n'est installé : le sous-menu liste les cinq formats (Publipostage+, puis la sonde), tous grisés, un clic ouvre la fenêtre des apps sur la ligne de l'app, sans sélecteur.
//   2. Publipostage+ installée : Excel et Markdown restent grisés (« Pas encore », la phrase au clic), PowerPoint attend l'extension « Diapositives » (le clic ouvre la fenêtre des apps).
//   3. La sonde P installée : Texte et Tableur se dégrisent, avec leur type et le nom de l'app en rappel.
//   4. « Texte » : le sélecteur propose les extensions du manifeste ; le fichier choisi arrive à l'app qui démarre (un vrai File : nom, taille, type, texte lisible dans le cadre isolé).
//   5. L'app déjà ouverte : « Tableur » lui envoie l'appel `ouvrir` avec le fichier, dans le même cadre (non rechargé).
//   6. Un fichier qui n'est pas du format est dit, sans ouvrir l'app ni envoyer d'appel.
//   7. Au clavier : Entrée, Fin, flèche droite (le sous-menu s'ouvre), Échap (il se referme, le focus revient à « Importer »), puis Entrée sur « Texte » ouvre le sélecteur.
//   8. Échap deux fois, puis un clic à côté : le sous-menu, puis le menu se referment.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { say, check, fileChooser, importMenu } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `importer-${lang}-${scheme}`;
const WORDS = lang === 'fr'
  ? { import: 'Importer', excel: 'Excel', markdown: 'Markdown', pptx: 'PowerPoint', text: 'Texte', sheet: 'Tableur', notYet: /ne reçoit pas encore de fichier de GFS/, wrong: /n’est pas un fichier Texte \(\.txt, \.md\)/, notYetHint: 'Pas encore', doc: 'Document', grid: 'Grille', probe: 'Sonde P', pp: 'Publipostage+', slides: /extension Diapositives/, probeApp: /app Sonde P/ }
  : { import: 'Import', excel: 'Excel', markdown: 'Markdown', pptx: 'PowerPoint', text: 'Text', sheet: 'Spreadsheet', notYet: /cannot receive a file from GFS yet/, wrong: /is not a Text file \(\.txt, \.md\)/, notYetHint: 'Not yet', doc: 'Document', grid: 'Grid', probe: 'Probe P', pp: 'Publipostage+', slides: /Slides extension/, probeApp: /Probe P app/ };
const ACCEPTS = {
  fichier: 'controller.js',
  de: 'const ACCEPTS_OPEN = Object.freeze({',
  vers: "const ACCEPTS_OPEN = Object.freeze({ 'sonde-p': { fichier: true, nouveau: true, importer: true },",
};
// Publipostage+ reçoit le fichier depuis sa consigne 035 (run-importer-pp.mjs) : le labo la remet à « pas encore » pour mesurer le grisé d'une app qui déclare un format sans le recevoir.
const NOT_YET = {
  fichier: 'controller.js',
  de: 'publipostage: { fichier: true, nouveau: true, importer: true }',
  vers: 'publipostage: { fichier: true, nouveau: true, importer: false }',
};
const PROBE = /p-importer\//;

const lab = await startLab({ lang, colorScheme: scheme, probes: true, patches: [ACCEPTS, NOT_YET] });
const { page } = lab;
const warnings = [];
const errors = [];
page.on('console', message => {
  if (message.type() === 'warning' && message.text().startsWith('GFS')) warnings.push(message.text());
  if (message.type() === 'error') errors.push(message.text());
});
page.on('pageerror', error => errors.push(error.message));
await lab.fitPanel(undefined, 700, 400);

const frame = lab.frame;
const toast = async () => ((await frame.locator('#toast').isVisible()) ? (await frame.locator('#toast').innerText()).replace(/\s+/g, ' ') : '');
const explorerHidden = () => frame.locator('.ex').isHidden();
const { sub, subItem, newButton, parent, openNew, openImport, mouseOn } = importMenu(page, () => frame, WORDS.import);
const inPanel = locator => locator.evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight; });
// Le clic qui ouvre le sélecteur de fichier : on attend l'événement du navigateur et on lui donne un fichier, comme la personne le ferait dans la fenêtre du système.
const { pickWith, noChooser } = fileChooser(page);
const probe = () => lab.appFrame(PROBE).then(app => app.evaluate(() => JSON.parse(document.body.dataset.sonde || '{}')));
const waitFor = async (label, test, ms = 10000) => {
  for (let i = 0; i < ms / 100; i++) {
    if (await test().catch(() => false)) return true;
    await page.waitForTimeout(100);
  }
  say(`(pas arrivé : ${label})`);
  return false;
};
const probeFrames = () => page.frames().filter(f => PROBE.test(f.url()) && !f.isDetached()).length;
const showFiles = async () => { await frame.locator('#floater-files').click(); await frame.locator('.ex').waitFor(); };
const closeModules = async () => { await page.keyboard.press('Escape'); await frame.locator('.mod').waitFor({ state: 'hidden' }); };
const install = async id => {
  await frame.waitForFunction(() => Boolean(document.body) && document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
  await lab.openModules(frame);
  await frame.locator(`[data-fk="app:${id}"]`).check();
  await lab.settle(frame);
  await closeModules();
};

// 1. Au départ (Publipostage+ est la seule app installée) : les cinq formats sont là, grisés, jamais masqués. (La fenêtre des apps s'ouvre seule à la première visite : la personne la ferme.)
await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
if (await frame.locator('.mod').count()) await closeModules();
await openNew();
const importRow = parent();
check('« Nouveau » a « Importer » après un séparateur, avec la flèche des sous-menus', (await importRow.count()) === 1 && (await frame.locator('.menu > hr').count()) === 1
  && (await importRow.getAttribute('aria-haspopup')) === 'menu' && (await importRow.getAttribute('aria-expanded')) === 'false' && (await importRow.locator('.sub-chev').count()) === 1,
{ parent: await importRow.count(), separateurs: await frame.locator('.menu > hr').count() });
check('« Importer » est la dernière ligne du menu', (await frame.locator('.menu > *').last().getAttribute('aria-haspopup')) === 'menu');
await importRow.click();
await sub().waitFor();
const labels = () => frame.locator('.menu-sub .menu-item .menu-label').allInnerTexts();
check('le clic ouvre le sous-menu : un article par format déclaré (Publipostage+, puis la sonde P)', JSON.stringify(await labels()) === JSON.stringify([WORDS.excel, WORDS.markdown, WORDS.pptx, WORDS.text, WORDS.sheet]), await labels());
check('« Importer » se dit déplié (aria-expanded) et le sous-menu est nommé', (await importRow.getAttribute('aria-expanded')) === 'true' && (await sub().getAttribute('aria-label')) === WORDS.import, await sub().getAttribute('aria-label'));
// Le menu « Nouveau » est large (ses mentions de grisé) : le sous-menu se rétrécit au lieu de recouvrir « Importer ».
const geometry = () => frame.evaluate(() => {
  const main = document.querySelector('.menu:not(.menu-sub)').getBoundingClientRect();
  const subMenu = document.querySelector('.menu-sub').getBoundingClientRect();
  const row = [...document.querySelectorAll('.menu:not(.menu-sub) .menu-item')].pop().getBoundingClientRect();
  const label = [...document.querySelectorAll('.menu:not(.menu-sub) .menu-item')].pop().querySelector('.menu-label').getBoundingClientRect();
  return { panneau: [window.innerWidth, window.innerHeight], menu: [main.left, main.right], sous: [subMenu.left, subMenu.right, subMenu.top, subMenu.bottom], ligne: [row.top, row.bottom], nom: [label.left, label.right] };
});
const where = await geometry();
say('géométrie :', where);
check('le sous-menu tient dans le panneau de 700 × 400', where.sous[0] >= 0 && where.sous[1] <= where.panneau[0] && where.sous[2] >= 0 && where.sous[3] <= where.panneau[1], where);
check('il se pose à côté du menu, sans recouvrir « Importer » ni aucune de ses lignes', where.sous[1] <= where.menu[0] + 1 || where.sous[0] >= where.menu[1] - 1, where);
const greyedAll = await Promise.all([WORDS.excel, WORDS.markdown, WORDS.pptx, WORDS.text, WORDS.sheet].map(async name => (await subItem(name).getAttribute('aria-disabled')) === 'true'));
check('au départ les cinq formats sont grisés : ceux de Publipostage+ attendent sa consigne, la sonde n\'est pas installée', greyedAll.every(Boolean), greyedAll);
const hints = await Promise.all([WORDS.excel, WORDS.markdown, WORDS.pptx, WORDS.text, WORDS.sheet].map(name => subItem(name).locator('.menu-hint').innerText()));
check('Excel et Markdown disent « Pas encore »', hints[0] === WORDS.notYetHint && hints[1] === WORDS.notYetHint, hints);
const titles = await Promise.all([WORDS.pptx, WORDS.text].map(name => subItem(name).getAttribute('title')));
check('PowerPoint demande l\'extension « Diapositives », Texte et Tableur l\'app de la sonde ; l\'infobulle dit la raison en entier (la mention se coupe par « … » dans un panneau étroit)',
  WORDS.slides.test(hints[2]) && WORDS.probeApp.test(hints[3]) && WORDS.probeApp.test(hints[4]) && WORDS.slides.test(titles[0]) && WORDS.probeApp.test(titles[1]), { hints, titles });
const excel = subItem(WORDS.excel);
check('un article grisé garde son icône de type, sans sa couleur', (await excel.locator('svg use').getAttribute('href')) === '#i-grid' && (await excel.getAttribute('data-fam')) === null);
await lab.shotPanel(run, '1-sous-menu', frame);

// 2. Les clics sur du grisé : jamais un sélecteur de fichier pour rien ; la phrase, ou la fenêtre qui débloque.
let none = await noChooser(() => mouseOn(excel));
check('un clic sur « Excel » grisé n\'ouvre aucun sélecteur de fichier', none);
const said = await toast();
check('il dit pourquoi : l\'app ne reçoit pas encore de fichier de GFS, avec son nom', WORDS.notYet.test(said) && said.includes(WORDS.pp), said);
check('l\'explorateur reste ouvert et le menu est refermé', (await frame.locator('.menu').count()) === 0 && !(await explorerHidden()));
await frame.locator('#toast').waitFor({ state: 'hidden', timeout: 20000 });
await openImport();
none = await noChooser(() => mouseOn(subItem(WORDS.pptx)));
await frame.locator('.mod').waitFor();
check('un clic sur « PowerPoint » grisé ouvre la fenêtre des apps (l\'extension « Diapositives » s\'y coche), sans sélecteur ni phrase', none && (await frame.locator('.mod').count()) > 0 && (await toast()) === '');
await closeModules();
await openImport();
none = await noChooser(() => mouseOn(subItem(WORDS.text)));
await frame.locator('.mod').waitFor();
check('un clic sur « Texte » (sonde non installée) ouvre la fenêtre des apps, sans sélecteur', none && (await frame.locator('.mod').count()) > 0);
await closeModules();

// 3. La sonde P installée.
await install('sonde-p');
await openImport();
const textItem = subItem(WORDS.text);
const sheetItem = subItem(WORDS.sheet);
const kinds = await Promise.all([textItem, sheetItem].map(item => item.locator('.menu-hint').innerText()));
check('la sonde P installée, « Texte » et « Tableur » ne sont plus grisés, avec le mot de leur type et le nom de l\'app',
  (await textItem.getAttribute('aria-disabled')) !== 'true' && (await sheetItem.getAttribute('aria-disabled')) !== 'true'
  && kinds[0] === `${WORDS.doc} · ${WORDS.probe}` && kinds[1] === `${WORDS.grid} · ${WORDS.probe}`, kinds);
check('ils prennent la couleur de leur type (document, grille), comme dans « Nouveau »', (await textItem.getAttribute('data-fam')) === 'doc' && (await sheetItem.getAttribute('data-fam')) === 'grid');
await lab.shotPanel(run, '2-sonde-installee', frame);

// 4. « Texte » : le sélecteur, puis l'app qui démarre reçoit le fichier.
const NOTES = 'Bonjour, importé ! éàü ☂';
const notes = { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from(NOTES, 'utf8') };
const picked = await pickWith(() => textItem.click(), notes);
check('le clic ouvre le sélecteur de fichier du navigateur, un seul fichier, avec les extensions du manifeste', picked.accept === '.txt,.md' && picked.multiple === false, picked);
await lab.appFrame(PROBE);
await waitFor('l\'ouverture lue par la sonde', async () => { const seen = await probe(); return seen.ouverture && seen.ouverture.importation && 'texte' in seen.ouverture.importation; });
let seen = await probe();
say('ouverture reçue :', seen.ouverture);
const got = seen.ouverture || {};
const imp = got.importation || {};
check('l\'app qui démarre reçoit l\'ouverture « importer » : type du format, pas de fichier de l\'app, dossier, valeur du format',
  got.raison === 'importer' && got.type === 'document' && got.fichier === null && got.dossier === '' && imp.valeur === 'texte', got);
check('elle reçoit un vrai File : nom, taille en octets, type, et son contenu se lit dans le cadre isolé (accents compris)',
  imp.estFichier === true && imp.nom === 'notes.txt' && imp.taille === Buffer.byteLength(NOTES, 'utf8') && imp.type === 'text/plain' && imp.texte === NOTES && !imp.erreur, imp);
check('l\'explorateur se ferme, GFS ne dit rien', (await explorerHidden()) && (await toast()) === '', await toast());

// 5. L'app déjà ouverte : l'appel `ouvrir` avec le fichier, dans le même cadre.
await showFiles();
const CSV = 'a;b\n1;2\n';
const table = { name: 'chiffres.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV, 'utf8') };
await openImport();
const second = await pickWith(() => sheetItem.click(), table);
check('« Tableur » propose les .csv', second.accept === '.csv', second);
await waitFor('l\'appel ouvrir', async () => (await probe()).appels.length === 1);
seen = await probe();
const call = seen.appels[0] || {};
say('appel reçu :', call);
check('l\'app déjà ouverte reçoit l\'appel « ouvrir » : type grille, raison importer, valeur tableur, et le fichier lisible',
  call.type === 'grille' && call.raison === 'importer' && call.fichier === null && call.importation && call.importation.valeur === 'tableur' && call.importation.estFichier === true
  && call.importation.nom === 'chiffres.csv' && call.importation.texte === CSV, call);
check('l\'app garde son cadre (non rechargée), l\'explorateur se ferme, GFS ne dit rien', probeFrames() === 1 && (await explorerHidden()) && (await toast()) === '', { cadres: probeFrames() });
const received = JSON.stringify(seen.ouverture);

// 6. Un fichier qui n'est pas du format : dit, sans ouvrir l'app ni envoyer d'appel.
await showFiles();
await openImport();
await pickWith(() => textItem.click(), { name: 'budget.xlsx', mimeType: 'application/vnd.ms-excel', buffer: Buffer.from('PK') });
await page.waitForTimeout(900);
const refused = await toast();
check('« budget.xlsx » pour « Texte » : GFS le dit (nom, format, extensions) et n\'envoie rien à l\'app', WORDS.wrong.test(refused) && refused.includes('budget.xlsx') && (await probe()).appels.length === 1 && !(await explorerHidden()), refused);
check('la sonde n\'a pas été rouverte (même ouverture de départ)', JSON.stringify((await probe()).ouverture) === received);
await frame.locator('#toast').waitFor({ state: 'hidden', timeout: 20000 });

// 7. Au clavier.
await newButton().focus();
await page.keyboard.press('Enter');
await frame.locator('.menu').first().waitFor();
await page.keyboard.press('End');
const focusedText = () => frame.evaluate(() => (document.activeElement.querySelector('.menu-label') || document.activeElement).textContent.trim());
check('Fin va à la dernière ligne, « Importer »', (await focusedText()) === WORDS.import, await focusedText());
await page.keyboard.press('ArrowRight');
await sub().waitFor();
check('la flèche droite ouvre le sous-menu et y met le focus sur le premier article', (await focusedText()) === WORDS.excel && (await parent().getAttribute('aria-expanded')) === 'true', await focusedText());
for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
check('la flèche bas descend d\'un article à l\'autre (« Texte » au quatrième)', (await focusedText()) === WORDS.text, await focusedText());
await page.keyboard.press('Escape');
await sub().waitFor({ state: 'detached' });
check('Échap referme le sous-menu, le menu reste ouvert, le focus revient sur « Importer »', (await focusedText()) === WORDS.import && (await frame.locator('.menu').count()) === 1 && (await parent().getAttribute('aria-expanded')) === 'false', await focusedText());
await page.keyboard.press('ArrowLeft');
check('la flèche gauche dans le menu ne ferme rien', (await frame.locator('.menu').count()) === 1);
await page.keyboard.press('Enter');
await sub().waitFor();
for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
const keyboard = await pickWith(() => page.keyboard.press('Enter'), { name: 'clavier.md', mimeType: 'text/markdown', buffer: Buffer.from('# Titre', 'utf8') });
check('Entrée sur « Texte » ouvre le sélecteur, comme la souris', keyboard.accept === '.txt,.md', keyboard);
await waitFor('le second appel', async () => (await probe()).appels.length === 2);
const last = (await probe()).appels[1] || {};
check('l\'app déjà ouverte reçoit ce fichier-là (« clavier.md », « # Titre »)', last.importation && last.importation.nom === 'clavier.md' && last.importation.texte === '# Titre', last);

// 8. Échap, deux fois : le sous-menu, puis le menu ; le focus rejoint « Nouveau ». Un clic à côté referme les deux.
await showFiles();
await newButton().focus();
await page.keyboard.press('Enter');
await page.keyboard.press('End');
await page.keyboard.press('ArrowRight');
await sub().waitFor();
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');
await frame.locator('.menu').waitFor({ state: 'detached' });
check('un second Échap referme le menu, l\'explorateur reste ouvert, le focus revient sur « Nouveau »', !(await explorerHidden()) && (await frame.evaluate(() => document.activeElement.classList.contains('primary'))));
await openImport();
const title = await frame.locator('.ex-title-row').boundingBox();
await page.mouse.click(title.x + 6, title.y + title.height / 2);
await frame.locator('.menu').waitFor({ state: 'detached' });
check('un clic à côté ferme le menu et son sous-menu', (await frame.locator('.menu-sub').count()) === 0 && (await frame.locator('.menu').count()) === 0);

check('GFS n\'a écrit aucun avertissement', warnings.length === 0, warnings);
check('aucune erreur dans la page', errors.length === 0, errors);
await lab.browser.close();
