// « Nouveau > Importer » avec la VRAIE Publipostage+ (consigne 035, `d76430c`), celle que GFS référence, dans un vrai Grist (grist-static), à 700 × 400, à la vraie souris et au vrai clavier.
// GFS ouvre le sélecteur de fichier du navigateur ; l'app reçoit le fichier avec l'ouverture (au démarrage) ou avec l'appel `ouvrir` (déjà ouverte) et en fait un modèle sans nom, pas encore
// enregistré, comme son menu « + » (contrats 2.7 point 4, 5.2 point 3, 5.4 point 1). La passe mesure :
//   1. Au départ (l'app installée, jamais ouverte) : « Excel » et « Markdown » ne sont plus grisés ; « PowerPoint » attend l'extension « Diapositives » (un clic ouvre la fenêtre des apps, sans sélecteur).
//   2. Au démarrage, « Markdown » : le sélecteur propose les extensions du manifeste ; l'app démarre, ouvre le ★ puis le document du fichier (sans nom, ni modèle courant), dit « Markdown importé… » ;
//      l'explorateur se ferme, GFS ne dit rien, l'app n'ouvre aucun sélecteur de plus, le document ne reçoit aucune écriture.
//   3. L'app déjà ouverte, « Excel » (appel `ouvrir`) : elle pose sa question d'enregistrement (le document importé attend), « Annuler » ne change rien, « Ne pas enregistrer » : la grille du fichier est là.
//   4. « Diapositives » cochée, « PowerPoint » (appel `ouvrir`) : la présentation du fichier, ses deux diapositives et leur bande.
//   5. GFS repart (l'app est fermée), au démarrage : « Excel » à la souris, puis « PowerPoint » au clavier (Entrée, Fin, flèche droite, bas, Entrée).
//   6. Un fichier illisible (`faux.xlsx`) : l'app le dit et garde son document, GFS ne dit rien.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { readFileSync } from 'node:fs';
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check, fileChooser, importMenu } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `importer-pp-${lang}-${scheme}`;
const WORDS = lang === 'fr'
  ? {
    import: 'Importer', excel: 'Excel', markdown: 'Markdown', pptx: 'PowerPoint', type: { excel: 'Grille', markdown: 'Document', powerpoint: 'Présentation' }, slides: /extension Diapositives/,
    buttons: ['Annuler', 'Ne pas enregistrer'], cancel: 'Annuler', discard: 'Ne pas enregistrer', unsaved: /^Modèle non enregistré/,
    imported: {
      markdown: 'Markdown importé. Nommez le modèle puis enregistrez-le.',
      excel: 'Excel importé : 3 lignes, 2 colonnes. Nommez le modèle puis enregistrez-le.',
      powerpoint: 'PowerPoint importé : 2 diapositives. Nommez le modèle puis enregistrez-le.',
    },
    unreadable: 'Ce fichier n’est pas un classeur Excel (.xlsx) lisible.',
  }
  : {
    import: 'Import', excel: 'Excel', markdown: 'Markdown', pptx: 'PowerPoint', type: { excel: 'Grid', markdown: 'Document', powerpoint: 'Presentation' }, slides: /Slides extension/,
    buttons: ['Cancel', 'Don’t save'], cancel: 'Cancel', discard: 'Don’t save', unsaved: /^Template not saved/,
    imported: {
      markdown: 'Markdown imported. Name the template, then save it.',
      excel: 'Excel imported: 3 rows, 2 columns. Name the template, then save it.',
      powerpoint: 'PowerPoint imported: 2 slides. Name the template, then save it.',
    },
    unreadable: 'This file is not a readable Excel (.xlsx) workbook.',
  };
const MANIFEST = JSON.parse(readFileSync(new URL('../manifestes/publipostage.json', import.meta.url), 'utf8'));
const EXTENSIONS = Object.fromEntries(MANIFEST.actions.importer.map(item => [item.valeur, item.extensions.join(',')]));
const APP = /apps\/publipostage\/|publipostageGrist\//;
const MARKDOWN = { name: 'note.md', mimeType: 'text/markdown', buffer: Buffer.from('# Titre importé\n\nTexte du fichier de GFS.', 'utf8') };
const MARKDOWN_TEXT = 'Titre importéTexte du fichier de GFS.';
const NOT_A_BOOK = { name: 'faux.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('ceci n’est pas un classeur', 'utf8') };
const MIME = { excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', powerpoint: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
const FK_SLIDES = 'ext:publipostage/diapositives';

const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const warnings = [];
const errors = [];
page.on('console', message => { if (message.type() === 'warning' && message.text().startsWith('GFS')) warnings.push(message.text()); });
page.on('pageerror', error => errors.push(String(error && error.message).slice(0, 160)));
// Un cadre qui se recharge peut proposer « quitter la page ? » : la personne répond oui (GFS repart exprès).
page.on('dialog', dialog => dialog.accept().catch(() => {}));
await lab.fitPanel(undefined, 700, 400);
await seedFiles(lab.frame);
// Un ★ existe : c'est lui que l'app ouvre d'elle-même, le fichier importé doit passer après lui, sans l'écrire.
await lab.frame.evaluate(() => grist.docApi.applyUserActions([['UpdateRecord', 'Publipostage_Modeles', 1, { EstParDefaut: true }]]));

let frame = lab.frame;
let app = null;
const toast = async () => ((await frame.locator('#toast').isVisible()) ? (await frame.locator('#toast').innerText()).replace(/\s+/g, ' ') : '');
const explorerHidden = () => frame.locator('.ex').isHidden();
const { sub, subItem, newButton, openImport, mouseOn } = importMenu(page, () => frame, WORDS.import);
const { pickWith, noChooser, strays } = fileChooser(page);
const closeModules = async () => { await page.keyboard.press('Escape'); await frame.locator('.mod').waitFor({ state: 'hidden' }); };
const showFiles = async () => { await frame.locator('#floater-files').click(); await frame.locator('.ex').waitFor(); };
// GFS repart (le document garde ses tables et ses choix) : l'explorateur d'abord, aucune app ouverte.
const restart = async () => {
  await frame.evaluate(() => location.reload());
  await page.waitForTimeout(1000);
  frame = await lab.gfsFrame(/access=full/);
  await lab.gfsReady(frame);
  await page.waitForTimeout(800);
};

// Ce que la personne voit dans l'app après un import (un document, une grille ou une présentation).
const shown = () => app.evaluate(() => ({
  current: Templates.getCurrentId(), list: document.getElementById('template-select').value, name: document.getElementById('template-name').value,
  text: document.querySelector('.ProseMirror').textContent, status: document.getElementById('status-msg').textContent, statusClass: document.getElementById('status-msg').className,
  grid: GridEditor.isActive(), cells: Array.from(document.querySelectorAll('.ProseMirror td, .ProseMirror th')).map(cell => cell.textContent.trim()),
  slides: document.querySelectorAll('.pp-slide-item').length, strip: !!document.querySelector('.pp-slide-strip') && !document.querySelector('.pp-slide-strip').hidden,
}));
const waitStatus = async (phrase, ms = 60000) => {
  for (let i = 0; i < ms / 100; i++) {
    const seen = await shown().catch(() => null);
    if (seen && seen.status === phrase) return seen;
    await page.waitForTimeout(100);
  }
  const seen = await shown().catch(() => null);
  say('(la phrase attendue n\'est pas arrivée)', phrase, seen);
  return seen;
};
const waitStarted = async () => {
  await app.waitForFunction(() => { const e = document.getElementById('status-msg'); return Boolean(e && e.textContent); }, null, { timeout: 60000 });
  await page.waitForTimeout(600);
};
const dialogOf = () => app.evaluate(() => {
  const overlay = document.getElementById('pp-dialog-modal');
  if (!overlay || getComputedStyle(overlay).display === 'none') return { open: false };
  const box = overlay.querySelector('.modal-content').getBoundingClientRect();
  return {
    open: true, title: overlay.querySelector('h3').textContent, message: overlay.querySelector('p, .pp-modal-message') ? overlay.querySelector('p, .pp-modal-message').textContent : '',
    buttons: Array.from(overlay.querySelectorAll('.pp-modal-actions button')).filter(button => !button.hidden).map(button => button.textContent.trim()),
    inPanel: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight,
  };
});
const waitDialog = async () => {
  for (let i = 0; i < 150; i++) {
    const seen = await dialogOf().catch(() => ({ open: false }));
    if (seen.open) return seen;
    await page.waitForTimeout(100);
  }
  return { open: false };
};
const pressDialog = async label => { await app.locator('#pp-dialog-modal .pp-modal-actions button', { hasText: label }).first().click(); await page.waitForTimeout(500); };
// Ce que le document retient : les modèles et les réglages de la section (rien ne doit s'y ajouter avant le premier « Enregistrer »).
const snapshot = () => frame.evaluate(async () => JSON.stringify({
  modeles: await grist.docApi.fetchTable('Publipostage_Modeles'), vue: (await grist.docApi.fetchTable('_grist_Views_section')).options,
}));

const diffOf = (a, b) => {
  const x = JSON.parse(a);
  const y = JSON.parse(b);
  const keys = (one, other) => one.flatMap((text, i) => { const [a, b] = [text, other[i]].map(value => { try { return JSON.parse(value || '{}'); } catch (error) { return {}; } }); return Object.keys({ ...a, ...b }).filter(key => JSON.stringify(a[key]) !== JSON.stringify(b[key])); });
  return { colonnes: Object.keys({ ...x.modeles, ...y.modeles }).filter(key => JSON.stringify(x.modeles[key]) !== JSON.stringify(y.modeles[key])), clesDeLaVue: keys(x.vue, y.vue), sections: [x.vue.length, y.vue.length], premiereDifference: x.vue.findIndex((text, i) => text !== y.vue[i]) };
};
let baseline = null; // l'état du document avant l'import mesuré ; cocher une extension est un geste de la personne qui le change, il redevient le point de départ
const untouched = async stage => { const now = await snapshot(); say(`document après ${stage} :`, now === baseline ? 'inchangé' : diffOf(baseline, now)); return now === baseline; };

// Les octets d'un classeur (ExcelJS, que l'app charge elle-même) et d'une présentation (les briques de dev-tests/scenarios-pptx-import.js de l'app) : fabriqués dans l'app une fois ouverte.
const buildFixtures = async () => {
  await app.addScriptTag({ url: '/prototype/apps/publipostage/dev-tests/scenarios-pptx-import.js' });
  const made = await app.evaluate(async () => {
    const base64 = buffer => {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(binary);
    };
    await ExportEngines.ensure('xlsx');
    await XlsxExport.ensureExcelLibLoaded();
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('Ventes');
    sheet.addRow(['Produit', 'Quantité']);
    sheet.addRow(['Vis', 12]);
    sheet.addRow(['Clou', 7]);
    const { pptx, textBox, para, run } = window.PptxFixtures;
    const slide = text => ({ shapes: textBox(60, 40, 840, 80, para(run(text, 'sz="4000"')), { id: 2 }) });
    return { xlsx: base64(await book.xlsx.writeBuffer()), deck: base64(await pptx({ slides: [slide('Bilan GFS'), slide('Suite')] })) };
  });
  return {
    excel: { name: 'ventes.xlsx', mimeType: MIME.excel, buffer: Buffer.from(made.xlsx, 'base64') },
    powerpoint: { name: 'bilan.pptx', mimeType: MIME.powerpoint, buffer: Buffer.from(made.deck, 'base64') },
  };
};
const isImported = (seen, format, phrase = WORDS.imported[format]) => Boolean(seen) && seen.status === phrase && seen.statusClass === '' && seen.current == null && seen.name === '' && seen.list === '';

// 0. Le premier départ de l'app écrit lui-même dans le document (des colonnes ajoutées à ses tables) : il passe par la fenêtre des apps, avant la première mesure.
await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
if (await frame.locator('.mod').count()) await closeModules();
await lab.openModules(frame);
await frame.locator('[data-open="publipostage"]').click();
app = await lab.appFrame(APP);
await waitStarted();
await restart();
const before = await snapshot();
baseline = before;

// 1. Au départ : « Excel » et « Markdown » ne sont plus grisés, « PowerPoint » attend « Diapositives ».
await openImport();
const labels = await frame.locator('.menu-sub .menu-item .menu-label').allInnerTexts();
check('le sous-menu « Importer » liste les trois formats de Publipostage+', JSON.stringify(labels) === JSON.stringify([WORDS.excel, WORDS.markdown, WORDS.pptx]), labels);
const disabled = await Promise.all([WORDS.excel, WORDS.markdown, WORDS.pptx].map(async name => (await subItem(name).getAttribute('aria-disabled')) === 'true'));
check('« Excel » et « Markdown » ne sont plus grisés ; « PowerPoint » l\'est (l\'extension « Diapositives » manque)', JSON.stringify(disabled) === JSON.stringify([false, false, true]), disabled);
const hints = await Promise.all([WORDS.excel, WORDS.markdown, WORDS.pptx].map(name => subItem(name).locator('.menu-hint').innerText()));
check('chacun dit son type (Grille, Document) ; « PowerPoint » dit ce qui manque', hints[0] === WORDS.type.excel && hints[1] === WORDS.type.markdown && WORDS.slides.test(hints[2]), hints);
check('ils portent la couleur de leur type (grille verte, document bleu), le grisé non', (await subItem(WORDS.excel).getAttribute('data-fam')) === 'grid' && (await subItem(WORDS.markdown).getAttribute('data-fam')) === 'doc' && (await subItem(WORDS.pptx).getAttribute('data-fam')) === null);
await lab.shotPanel(run, '1-sous-menu', frame);
const none = await noChooser(() => mouseOn(subItem(WORDS.pptx)));
await frame.locator('.mod').waitFor();
check('un clic sur « PowerPoint » grisé ouvre la fenêtre des apps, sans sélecteur ni phrase', none && (await toast()) === '');
await closeModules();

// 2. Au démarrage, « Markdown » : le ★ s'ouvre, puis le fichier de GFS le remplace.
await openImport();
const picked = await pickWith(() => subItem(WORDS.markdown).click(), MARKDOWN);
check('le sélecteur propose les extensions du manifeste, un seul fichier', picked.accept === EXTENSIONS.markdown && picked.multiple === false, { picked, attendu: EXTENSIONS.markdown });
app = await lab.appFrame(APP);
await waitStarted();
let seen = await waitStatus(WORDS.imported.markdown);
say('Markdown au démarrage :', seen);
check('l\'app démarre et importe le document : sans nom ni modèle courant, avec la phrase « Markdown importé… »', isImported(seen, 'markdown') && seen.text === MARKDOWN_TEXT && !seen.grid, seen);
check('l\'explorateur se ferme, GFS ne dit rien, l\'app n\'a ouvert aucun sélecteur de plus', (await explorerHidden()) && (await toast()) === '' && strays() === 0, { phrase: await toast(), selecteurs: strays() });
await lab.shotPanel(run, '2-markdown-au-demarrage', frame);
check('rien n\'est écrit dans le document par cet import', await untouched('Markdown au démarrage'));
const fixtures = await buildFixtures();
check('les fichiers d\'essai sont prêts (un classeur de 3 lignes, une présentation de 2 diapositives)', fixtures.excel.buffer.length > 1000 && fixtures.powerpoint.buffer.length > 1000, { xlsx: fixtures.excel.buffer.length, pptx: fixtures.powerpoint.buffer.length });

// 3. L'app déjà ouverte, « Excel » : sa question d'enregistrement, puis la grille.
await showFiles();
await openImport();
const excel = await pickWith(() => subItem(WORDS.excel).click(), fixtures.excel);
check('« Excel » propose les extensions du manifeste', excel.accept === EXTENSIONS.excel, { excel, attendu: EXTENSIONS.excel });
let asked = await waitDialog();
say('question de l\'app :', asked);
check('l\'app déjà ouverte pose sa question (le document importé n\'est pas enregistré), dans le panneau, sans « Enregistrer » (il n\'a pas de nom)',
  asked.open && asked.inPanel && JSON.stringify(asked.buttons) === JSON.stringify(WORDS.buttons), asked);
await lab.shotPanel(run, '3-question-enregistrement', app);
await pressDialog(WORDS.cancel);
seen = await shown();
check('« ' + WORDS.cancel + ' » ne change rien au document : le Markdown reste à l\'écran, la question se ferme, le coin d\'état redit qu\'il faut le nommer', seen.text === MARKDOWN_TEXT && !seen.grid && WORDS.unsaved.test(seen.status) && !(await dialogOf()).open, seen);
await showFiles();
await openImport();
await pickWith(() => subItem(WORDS.excel).click(), fixtures.excel);
await waitDialog();
await pressDialog(WORDS.discard);
seen = await waitStatus(WORDS.imported.excel);
say('Excel par ouvrir :', seen);
check('« ' + WORDS.discard + ' » : la grille du fichier est à l\'écran (3 lignes, 2 colonnes), sans nom, avec sa phrase', isImported(seen, 'excel') && seen.grid && seen.cells.join('|') === 'Produit|Quantité|Vis|12|Clou|7', seen);
check('l\'app garde son cadre (non rechargée), l\'explorateur est fermé, GFS ne dit rien', (await lab.appFrame(APP)) === app && (await explorerHidden()) && (await toast()) === '');
await lab.shotPanel(run, '4-excel-par-ouvrir', frame);
check('rien n\'est écrit dans le document par l\'import d\'Excel', await untouched('Excel par ouvrir'));

// 4. « Diapositives » cochée, « PowerPoint » par l'appel `ouvrir`.
await showFiles();
await lab.openModules(frame);
await frame.locator(`[data-fk="${FK_SLIDES}"]`).check();
await lab.settle(frame);
await closeModules();
// Cocher « Diapositives » est un geste de la personne : GFS crée les tables de l'extension avec son accord. L'état d'après devient le point de départ de l'import de PowerPoint.
say('cocher « Diapositives » a écrit :', diffOf(baseline, await snapshot()));
baseline = await snapshot();
await openImport();
check('« PowerPoint » se dégrise quand l\'extension est cochée', (await subItem(WORDS.pptx).getAttribute('aria-disabled')) !== 'true' && (await subItem(WORDS.pptx).getAttribute('data-fam')) === 'slides', await subItem(WORDS.pptx).getAttribute('aria-disabled'));
const deck = await pickWith(() => subItem(WORDS.pptx).click(), fixtures.powerpoint);
check('« PowerPoint » propose les extensions du manifeste', deck.accept === EXTENSIONS.powerpoint, { deck, attendu: EXTENSIONS.powerpoint });
asked = await waitDialog();
check('la grille importée attend d\'être enregistrée : la question se pose', asked.open && asked.inPanel, asked);
await pressDialog(WORDS.discard);
seen = await waitStatus(WORDS.imported.powerpoint);
say('PowerPoint par ouvrir :', seen);
check('la présentation du fichier est à l\'écran : deux diapositives et leur bande, sans nom', isImported(seen, 'powerpoint') && seen.slides === 2 && seen.strip && !seen.grid, seen);
check('GFS ne dit rien et l\'explorateur est fermé', (await toast()) === '' && (await explorerHidden()), await toast());
await lab.shotPanel(run, '5-powerpoint-par-ouvrir', frame);
check('rien n\'est écrit dans le document par l\'import de PowerPoint', await untouched('PowerPoint par ouvrir'));

// 6. Un fichier illisible : l'app le dit, garde son document, GFS ne dit rien.
await showFiles();
await openImport();
await pickWith(() => subItem(WORDS.excel).click(), NOT_A_BOOK);
seen = await waitStatus(WORDS.unreadable);
check('« faux.xlsx » : l\'app dit qu\'il n\'est pas lisible (état d\'erreur) et garde la présentation, sans question', seen.status === WORDS.unreadable && seen.statusClass !== '' && seen.slides === 2 && !(await dialogOf()).open, seen);
check('GFS ne dit rien, l\'explorateur est fermé', (await toast()) === '' && (await explorerHidden()), await toast());

// 5. GFS repart : l'app est fermée, l'import part avec l'ouverture du contexte.
await restart();
await openImport();
await pickWith(() => subItem(WORDS.excel).click(), fixtures.excel);
app = await lab.appFrame(APP);
await waitStarted();
seen = await waitStatus(WORDS.imported.excel);
check('au démarrage, « Excel » : la grille du fichier remplace le ★, sans nom', isImported(seen, 'excel') && seen.grid && seen.cells.join('|') === 'Produit|Quantité|Vis|12|Clou|7', seen);
check('GFS ne dit rien et l\'explorateur est fermé', (await toast()) === '' && (await explorerHidden()));

await restart();
await newButton().focus();
await page.keyboard.press('Enter');
await frame.locator('.menu').first().waitFor();
await page.keyboard.press('End');
await page.keyboard.press('ArrowRight');
await sub().waitFor();
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
const keyboard = await pickWith(() => page.keyboard.press('Enter'), fixtures.powerpoint);
check('au clavier, Entrée sur « PowerPoint » ouvre le sélecteur', keyboard.accept === EXTENSIONS.powerpoint, keyboard);
app = await lab.appFrame(APP);
await waitStarted();
seen = await waitStatus(WORDS.imported.powerpoint);
check('au démarrage, « PowerPoint » : la présentation du fichier remplace le ★ (deux diapositives, leur bande)', isImported(seen, 'powerpoint') && seen.slides === 2 && seen.strip, seen);
check('GFS ne dit rien et l\'explorateur est fermé', (await toast()) === '' && (await explorerHidden()), await toast());
await lab.shotPanel(run, '6-powerpoint-au-demarrage', frame);
check('aucune écriture dans le document pendant toute la passe', await untouched('la passe'));

check('l\'app n\'a ouvert aucun sélecteur de fichier de son côté pendant toute la passe', strays() === 0, strays());
check('GFS n\'a écrit aucun avertissement', warnings.length === 0, warnings);
check('aucune erreur de page', errors.length === 0, errors);
await lab.browser.close();
