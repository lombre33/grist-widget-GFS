// Les présentations de Publipostage+ (extension « Diapositives », type « Présentation ») dans un vrai Grist (grist-static), avec la vraie app, celle que GFS référence, à 700 × 400, à la vraie
// souris et au vrai clavier (Playwright : événements du pointeur et du clavier du navigateur, jamais dispatchEvent). LAB_LANG=fr|en, LAB_SCHEME=light|dark.
//   1. Extension éteinte (le défaut) : la ligne « Nouvelle présentation » du menu « + » de l'app est grisée avec sa raison ; son clic appelle `installer` et la fenêtre de GFS s'ouvre sur la ligne
//      « Diapositives », sans bibliothèque (ni mode, ni poids à choisir).
//   2. La personne la coche : l'app la reçoit, sans rien charger ; la ligne s'utilise, une présentation vierge s'ouvre à la page 16:9 en paysage, nommée et enregistrée sous le type « presentation ».
//   3. L'explorateur de GFS : la présentation y est connue (famille orange, pastille « Présentation »), le menu « Nouveau » la propose et, l'app ouverte, y ouvre une présentation vierge (consigne 014),
//      et le double-clic ouvre l'app sur elle, le bouton ▶ à sa place. Puis, dans une présentation de trois diapositives, le copier-coller de l'app : Ctrl+C sur une miniature, Ctrl+V sur une autre, dans le cadre isolé de GFS
//      (sans `allow-same-origin`) où seuls les événements `copy` et `paste` du navigateur servent, sans autorisation du presse-papiers ; le menu des mises en page de « Ajouter » ; une miniature glissée
//      à la vraie souris jusqu'à sa place ; « Présenter » (le bouton ▶, F5, les flèches, la barre du bas, Échap), dont le plein écran du navigateur dépend des cadres au-dessus de l'app.
//   3 bis. Les diapositives liées (case « Garder liée » du volet « Importer », 8d68bb4) : une diapositive importée liée à sa source ; l'app écrit d'autres lignes de sa table que celle qui est
//      ouverte (le numéro de la diapositive dans sa source, son jeton, la colonne créée au premier besoin, puis ce qui change, dans le même lot) : le courtier laisse tout passer.
//   4. La personne éteint l'extension : la ligne de l'app se grise, la présentation ouverte reste ouverte, Ctrl+V, Ctrl+C et le bouton ▶ ouvrent la fenêtre de GFS sur la ligne « Diapositives »
//      (appel `installer`) sans rien changer, et elle s'enregistre toujours sous son type ; dans l'explorateur la présentation est grisée avec sa raison, et son double-clic ouvre cette même fenêtre.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startLab } from './lab-setup.mjs';
import { say, check, SHOTS } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `diapositives-${lang}-${scheme}`;
const WORDS = lang === 'fr'
  ? { row: 'Nouvelle présentation', reason: /Demande l.extension Diapositives \(Grist Factory Suite\)/, type: 'Présentation', name: 'Ma présentation', opened: /Ouvert depuis l.explorateur\./, unsaved: /^Modèle non enregistré/, text: 'Première diapositive', deck: 'Trois diapositives', point1: 'Premier point', copied: n => `Diapositive ${n} copiée.` }
  : { row: 'New presentation', reason: /Needs the Slides extension \(Grist Factory Suite\)/, type: 'Presentation', name: 'My presentation', opened: /Opened from the explorer\./, unsaved: /^Template not saved/, text: 'First slide', deck: 'Three slides', point1: 'First point', copied: n => `Slide ${n} copied.` };
const FK = 'ext:publipostage/diapositives';
// Le poids que le manifeste de l'app donne à l'extension (contrats 2.6, point 1, en Ko) : la ligne de la fenêtre de GFS doit le dire.
const WEIGHT = JSON.parse(readFileSync(new URL('../manifestes/publipostage.json', import.meta.url), 'utf8')).extensions.find(extension => extension.id === 'diapositives').poids;

const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const warnings = [];
page.on('console', message => { if (message.type() === 'warning' && message.text().startsWith('GFS')) warnings.push(message.text()); });
await page.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', event => window.__csp.push(`${event.violatedDirective} ${event.blockedURI}`)); });
await lab.fitPanel(undefined, 700, 400);

let gfs = lab.frame;
let app = await lab.openApp('publipostage');
const tables = app.getByRole('button', { name: /Create the tables|Créer les tables/ });
await tables.first().waitFor({ timeout: 30000 });
await tables.first().click();
await app.locator('#editor-container .ProseMirror').waitFor();
await page.waitForTimeout(3000);

// ----- Les outils : la ligne « Nouvelle présentation » du menu « + » (la souris descend du bouton jusqu'à la ligne sans quitter le menu), ce que la personne voit de l'app et du document.
const presentationRow = () => app.locator('#v2-btn-new-presentation');
async function hoverRow() {
  const plus = await app.locator('#btn-new').boundingBox();
  const cx = plus.x + plus.width / 2;
  const cy = plus.y + plus.height / 2;
  await page.mouse.move(cx - 25, cy);
  await page.mouse.move(cx, cy, { steps: 4 });
  await page.waitForTimeout(600);
  const row = await presentationRow().boundingBox();
  if (!row) throw new Error('la ligne « Nouvelle présentation » n\'est pas montrée par le menu « + »');
  const x = Math.min(Math.max(cx, row.x + 6), row.x + row.width - 6);
  await page.mouse.move(x, cy + 10, { steps: 2 });
  await page.mouse.move(x, row.y + row.height / 2, { steps: 6 });
  await page.mouse.move(row.x + row.width / 2, row.y + row.height / 2, { steps: 4 });
  await page.waitForTimeout(200);
  return row;
}
const rowCenter = async () => { const row = await presentationRow().boundingBox(); return [row.x + row.width / 2, row.y + row.height / 2]; };
const clickRow = async () => { await hoverRow(); await page.mouse.click(...(await rowCenter())); };
const leaveMenu = async () => { await page.mouse.move(690, 390, { steps: 5 }); await page.waitForTimeout(500); };
const rowState = () => app.evaluate(() => {
  const row = document.getElementById('v2-btn-new-presentation');
  const flyout = document.getElementById('v2-new-template-flyout');
  const box = flyout ? flyout.getBoundingClientRect() : null;
  return {
    label: row.textContent.trim(), ariaDisabled: row.getAttribute('aria-disabled'), grey: row.classList.contains('v2-hover-row-disabled'), explains: row.hasAttribute('data-explains'), title: row.title,
    inPanel: Boolean(box) && box.height > 0 && box.top >= -0.5 && box.bottom <= innerHeight + 0.5 && box.left >= -0.5 && box.right <= innerWidth + 0.5,
  };
});
const pageState = () => app.evaluate(() => ({
  slide: PageLayout.getFormat() === PageLayout.SLIDE_FORMAT, landscape: PageLayout.getOrientation() === PageLayout.LANDSCAPE, label: PageLayout.getFormatLabel(),
  ratio: Math.round((PageLayout.getPageSizeMm().width / PageLayout.getPageSizeMm().height) * 1000) / 1000,
}));
const shown = () => app.evaluate(() => ({
  id: Templates.getCurrentId(), name: document.getElementById('template-name').value, text: document.querySelector('.ProseMirror').textContent, status: document.getElementById('status-msg').textContent,
}));
const savedRow = name => gfs.evaluate(async wanted => {
  const data = await grist.docApi.fetchTable('Publipostage_Modeles');
  const at = data.Nom.indexOf(wanted);
  if (at < 0) return null;
  let margins = null;
  try { margins = data.Margins && data.Margins[at] ? JSON.parse(data.Margins[at]) : null; } catch (error) { margins = 'illisible'; }
  return { id: data.id[at], type: data.TypeModele[at], content: data.Contenu[at], margins, count: data.id.length };
}, name);
const openWindow = async () => { await gfs.locator('#floater-apps').click(); await gfs.locator('.mod').waitFor(); };
const focusedRow = () => gfs.evaluate(() => (document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk : null));
// Le même geste que la personne : un clic sur la case de la ligne « Diapositives », la table du document déjà là, puis Échap pour fermer la fenêtre.
async function toggleSlides(wantOn) {
  if (!(await gfs.locator('.mod').count())) await openWindow();
  const box = gfs.locator(`[data-fk="${FK}"]`);
  if ((await box.isChecked()) !== wantOn) await gfs.locator(`[data-row="${FK}"] label`).click();
  await lab.settle(gfs);
  check(`la case « Diapositives » est ${wantOn ? 'cochée' : 'décochée'}`, (await box.isChecked()) === wantOn);
  await page.keyboard.press('Escape');
  await gfs.locator('.mod').waitFor({ state: 'hidden' });
}

// La bande des diapositives, au clavier et à la souris : la miniature `n` (la première : 1) à la souris, puis Échap et Tab rendent le clavier à la bande, sur elle (le clic le rend au document).
const thumbFocus = () => app.evaluate(() => {
  const item = document.activeElement && document.activeElement.closest('.pp-slide-item');
  return item ? Array.from(document.querySelectorAll('.pp-slide-item')).indexOf(item) + 1 : 0;
});
async function intoStrip(n) {
  await app.locator('.pp-slide-thumb').nth(n - 1).click();
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  for (let i = 0; i < 10 && (await thumbFocus()) === 0; i++) { await page.keyboard.press('Tab'); await page.waitForTimeout(150); }
  return thumbFocus();
}
// Le bouton ▶ « Présenter » et la pastille du zoom, tels que la personne les voit : le bouton à gauche de la pastille, sur sa ligne, en bas du panneau.
const playGeometry = () => app.evaluate(() => {
  const button = document.querySelector('.pp-slide-show-open');
  const pill = document.getElementById('pp-page-zoom');
  if (!button || !pill) return null;
  const at = button.getBoundingClientRect();
  const zoom = pill.getBoundingClientRect();
  return {
    hidden: button.hidden, shown: getComputedStyle(button).visibility !== 'hidden', disabled: button.getAttribute('aria-disabled'), leftOfZoom: at.right <= zoom.left + 1,
    sameLine: Math.abs(at.bottom - zoom.bottom) <= 1, low: at.top >= innerHeight / 2, inPanel: at.width > 0 && at.bottom <= innerHeight + 0.5 && at.right <= innerWidth + 0.5,
  };
});
// Ce que la personne voit de la présentation ouverte : ses miniatures, le texte de chaque diapositive, le coin d'état, et le document.
const slidesNow = () => app.evaluate(() => {
  const editor = EditorCore.getEditor();
  return {
    count: document.querySelectorAll('.pp-slide-item').length, status: document.getElementById('status-msg').textContent, html: editor.getHTML(),
    texts: SlideStrip.slidesOf(editor.state.doc).map(slide => slide.nodes.map(entry => entry.node.textContent).join('')),
  };
});

// ===== 1. Extension éteinte
check('éteinte par défaut : l\'app ne reçoit pas l\'extension « diapositives »', await app.evaluate(() => !Extensions.isActive('diapositives') && !GfsLink.extensions().includes('diapositives')));
let state = await (async () => { await hoverRow(); return rowState(); })();
check(`la ligne « ${WORDS.row} » est là, grisée, jamais cachée, avec sa raison`, state.label === WORDS.row && state.ariaDisabled === 'true' && state.grey && state.explains && WORDS.reason.test(state.title), state);
check('le menu « + » tient dans le panneau de 700 × 400', state.inPanel, state);
await lab.shotPanel(run, '1-ligne-grisee');
await page.mouse.click(...(await rowCenter()));
await gfs.locator('.mod').waitFor({ timeout: 15000 });
check('un clic sur la ligne grisée ouvre la fenêtre de GFS sur la ligne « Diapositives » (appel `installer`)', (await focusedRow()) === FK, await focusedRow());
const line = gfs.locator(`[data-row="${FK}"]`);
const text = (await line.innerText()).replace(/\s+/g, ' ');
say('la ligne dans la fenêtre :', text);
const sizes = await line.locator('.sz').allInnerTexts();
check(`la ligne dit ce qu'elle apporte et sa taille du manifeste (≈ ${WEIGHT} Ko), sans choix de bibliothèque (rien à charger)`,
  (lang === 'fr' ? /Diapositives.*présentations en 16:9/ : /Slides.*16:9 presentations/).test(text) && (await line.locator('.mr-mode').count()) === 0
    && sizes.length === 1 && new RegExp(`^≈\\s${WEIGHT}\\s(Ko|KB)$`).test(sizes[0].trim()), `${text} | ${JSON.stringify(sizes)}`);
check('elle n\'est pas grisée : aucune bibliothèque ne peut lui manquer', !(await line.evaluate(node => node.classList.contains('is-locked'))));
await lab.shotPanel(run, '2-fenetre-diapositives');

// ===== 2. La personne la coche
const filesNow = () => app.evaluate(() => ({ scripts: [...document.scripts].map(node => node.src).filter(Boolean), styles: [...document.querySelectorAll('link[rel="stylesheet"]')].map(node => node.href) }));
const filesBefore = await filesNow();
await toggleSlides(true);
await app.waitForFunction(() => Extensions.isActive('diapositives'), null, { timeout: 15000 });
check('l\'app reçoit l\'extension, et aucune bibliothèque avec elle', await app.evaluate(() => GfsLink.extensions().join() === 'diapositives' && GfsLink.library('edition-live') === null && GfsLink.library('plotly') === null), await app.evaluate(() => GfsLink.extensions()));
await hoverRow();
state = await rowState();
check('la ligne « Nouvelle présentation » s\'utilise', state.ariaDisabled !== 'true' && !state.grey, state);
await lab.shotPanel(run, '3-ligne-utilisable');
await clickRow();
await app.waitForFunction(() => PageLayout.getFormat() === PageLayout.SLIDE_FORMAT, null, { timeout: 15000 });
let pageNow = await pageState();
check('une présentation vierge s\'ouvre à la page 16:9 en paysage', pageNow.slide && pageNow.landscape && pageNow.ratio === 1.778, pageNow);
const filesAfter = await filesNow();
const newScripts = filesAfter.scripts.filter(src => !filesBefore.scripts.includes(src));
const newStyles = filesAfter.styles.filter(href => !filesBefore.styles.includes(href));
// Les neuf scripts de l'extension (la bande, le volet « Importer », « Objets », les diapositives liées, les transitions et leur fenêtre, le fond, les notes, « Présenter ») et ses sept feuilles de
// style (version 0.23, app à 2d9d4ed), tous du dossier de l'app, chargés ensemble.
const SCRIPTS = ['slide-strip', 'slide-import', 'slide-objects', 'slide-links-ui', 'slide-transitions', 'slide-transitions-ui', 'slide-background-ui', 'slide-notes-ui', 'slide-show'];
const STYLES = ['slide-strip', 'slide-import', 'slide-objects', 'slide-transitions', 'slide-background', 'slide-notes', 'slide-show'];
const fromFolder = (list, names, kind) => list.length === names.length
  && names.every(name => list.filter(url => new RegExp(`/apps/publipostage/extensions/diapositives/${name}\\.${kind}\\?`).test(url)).length === 1);
check('l\'extension charge ses seize fichiers (neuf scripts, sept feuilles de style), depuis le dossier de l\'app, rien d\'une autre adresse, aucun refus de la politique de sécurité',
  fromFolder(newScripts, SCRIPTS, 'js') && fromFolder(newStyles, STYLES, 'css')
    && (await app.evaluate(() => window.__csp)).length === 0, { newScripts, newStyles, csp: await app.evaluate(() => window.__csp) });
await leaveMenu();
await app.locator('#editor-container .ProseMirror').click();
await page.keyboard.type(WORDS.text, { delay: 15 });
await app.locator('#btn-rename-template').click();
await page.keyboard.type(WORDS.name, { delay: 20 });
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
await app.locator('#btn-save').click();
let saved = null;
for (let i = 0; i < 60; i++) { saved = await savedRow(WORDS.name); if (saved) break; await page.waitForTimeout(250); }
check('enregistrée, sa ligne porte le type « presentation » et son contenu', Boolean(saved) && saved.type === 'presentation' && saved.content.includes(WORDS.text), saved);
check('et la page de la diapositive (16:9, paysage) dans la colonne des marges', Boolean(saved) && saved.margins && saved.margins.format === '190.5x338.7' && saved.margins.orientation === 'landscape', saved && saved.margins);
await lab.shotPanel(run, '4-presentation-ouverte');

// ===== 3. L'explorateur de GFS
// Un document de plus, déjà là quand l'app démarre (l'app lit ses modèles au démarrage) : de quoi passer d'un type à l'autre.
const BREAK = '<div class="page-break-marker" contenteditable="false">Saut de page</div>';
const DECK = `<h2>Titre un</h2><p>Premier texte</p>${BREAK}<h2>Titre deux</h2><p>Deuxième texte <strong>gras</strong></p>${BREAK}<p>Trois</p>`;
await gfs.evaluate(({ deck, html }) => grist.docApi.applyUserActions([
  ['AddRecord', 'Publipostage_Modeles', null, { Nom: 'Lettre', TypeModele: 'document', Contenu: '<p>Cher client</p>' }],
  ['AddRecord', 'Publipostage_Modeles', null, { Nom: deck, TypeModele: 'presentation', Contenu: html }],
]), { deck: WORDS.deck, html: DECK });
const restart = async () => {
  await gfs.evaluate(() => location.reload());
  await page.waitForTimeout(1000);
  gfs = await lab.gfsFrame(/access=full/);
  await lab.gfsReady(gfs);
  await page.waitForTimeout(800);
};
await restart();
const fileRow = () => gfs.locator('.ls-row', { hasText: WORDS.name }).first();
await fileRow().waitFor({ timeout: 15000 });
let facts = await fileRow().evaluate(node => ({ fam: node.getAttribute('data-fam'), locked: node.classList.contains('lk'), pill: node.querySelector('.ty .pill').textContent.trim(), icon: (node.querySelector('.nm use') || {}).getAttribute ? node.querySelector('.nm use').getAttribute('href') : '' }));
check('l\'explorateur connaît la présentation : famille orange, pastille « Présentation », icône des diapositives, ni grisée ni inconnue', facts.fam === 'slides' && !facts.locked && facts.pill === WORDS.type && /slides/.test(facts.icon), facts);
await gfs.locator('.btn.primary').click();
const entry = gfs.locator('.menu-item', { hasText: new RegExp(`^\\s*${WORDS.type}`) });
check('le menu « Nouveau » propose la présentation, utilisable', (await entry.count()) === 1 && (await entry.getAttribute('aria-disabled')) !== 'true' && (await entry.getAttribute('data-fam')) === 'slides', await entry.count());
await lab.shotPanel(run, '5-explorateur-nouveau');
await page.keyboard.press('Escape');
await fileRow().dblclick();
app = await lab.appFrame(/publipostage/);
let seen = null;
for (let i = 0; i < 120 && !(seen && seen.name === WORDS.name); i++) { seen = await shown().catch(() => null); await page.waitForTimeout(100); }
check('le double-clic ouvre l\'app sur la présentation, dans le coin d\'état « ouvert depuis l\'explorateur »', Boolean(seen) && seen.name === WORDS.name && seen.text.includes(WORDS.text) && WORDS.opened.test(seen.status), seen);
pageNow = await pageState();
check('elle s\'ouvre à la page de la diapositive', pageNow.slide && pageNow.landscape, pageNow);
check('GFS n\'a ajouté aucune phrase', (await gfs.locator('#toast').isVisible()) === false);
// Ouverte au démarrage de l'app par GFS : le bouton ▶ est à sa place. Depuis 4f00ac2, sans pastille du zoom posée, il attend, invisible, et la pastille qui arrive le place à sa gauche ;
// la page de l'app dit qu'avant, il pouvait rester au coin haut gauche du panneau. Ce geste ne le reproduit pas : la vérification passe aussi avec l'app à 487d66b (21/10, soir).
let play = null;
for (let i = 0; i < 30 && !(play && play.shown && play.leftOfZoom && play.sameLine && play.low); i++) { play = await playGeometry(); await page.waitForTimeout(100); }
check('ouverte au démarrage par GFS, le bouton ▶ « Présenter » est déjà à gauche de la pastille du zoom, sur sa ligne, en bas du panneau (pas au coin haut gauche)',
  Boolean(play) && play.shown && play.leftOfZoom && play.sameLine && play.low, play);

// L'app est déjà ouverte : GFS lui envoie l'appel `ouvrir`, de la présentation vers un document, puis du document vers la présentation, dans le même cadre (l'app n'est pas rechargée).
await app.evaluate(() => { window.__marque = 'avant'; });
const showFiles = async name => {
  await gfs.locator('#floater-files').click();
  await gfs.locator('.ls-row', { hasText: name }).first().waitFor();
};
const waitShown = async name => {
  let current = null;
  for (let i = 0; i < 120 && !(current && current.name === name); i++) { current = await shown().catch(() => null); await page.waitForTimeout(100); }
  return current;
};
await showFiles('Lettre');
await gfs.locator('.ls-row', { hasText: 'Lettre' }).first().dblclick();
seen = await waitShown('Lettre');
pageNow = await pageState();
check('de la présentation au document : l\'app déjà ouverte change de modèle, et retrouve la page d\'un document', Boolean(seen) && seen.text === 'Cher client' && !pageNow.slide, { seen, pageNow });
await showFiles(WORDS.name);
await fileRow().dblclick();
seen = await waitShown(WORDS.name);
pageNow = await pageState();
check('du document à la présentation : l\'appel `ouvrir` d\'une présentation passe, dans le même cadre, à la page de la diapositive',
  Boolean(seen) && seen.text.includes(WORDS.text) && pageNow.slide && pageNow.landscape && (await app.evaluate(() => window.__marque)) === 'avant' && WORDS.opened.test(seen.status), { seen, pageNow });

// « Nouveau » > « Présentation » de l'explorateur (consignes 014 et 015 : cinq types) : l'app déjà ouverte ouvre une présentation vierge à la page de la diapositive, dans le même cadre, sans phrase
// de GFS et sans rien écrire dans le document (le modèle naît à son premier « Enregistrer »).
const rowsBefore = (await savedRow(WORDS.name)).count;
await showFiles(WORDS.name);
await gfs.locator('.btn.primary').click();
await entry.click();
let blank = null;
for (let i = 0; i < 120 && !(blank && blank.name === '' && blank.slide); i++) {
  blank = await app.evaluate(() => ({ name: document.getElementById('template-name').value, text: document.querySelector('.ProseMirror').textContent, status: document.getElementById('status-msg').textContent, slide: PageLayout.getFormat() === PageLayout.SLIDE_FORMAT, landscape: PageLayout.getOrientation() === PageLayout.LANDSCAPE })).catch(() => null);
  await page.waitForTimeout(100);
}
say('« Nouveau » > « Présentation » :', blank, 'phrase de GFS :', (await gfs.locator('#toast').isVisible()) ? await gfs.locator('#toast').innerText() : '');
check('« Nouveau » > « Présentation » avec l\'app ouverte : une présentation vierge à la page 16:9 en paysage, dans le même cadre, le coin d\'état garde « modèle non enregistré », GFS ne dit rien',
  Boolean(blank) && blank.slide && blank.landscape && blank.text === '' && WORDS.unsaved.test(blank.status) && (await app.evaluate(() => window.__marque)) === 'avant' && (await gfs.locator('#toast').isVisible()) === false, blank);
check('rien n\'est écrit dans le document par cette ouverture (aucune ligne de plus)', (await savedRow(WORDS.name)).count === rowsBefore);
await lab.shotPanel(run, '5b-nouveau-presentation');

// Copier et coller une diapositive, l'extension cochée : Ctrl+C sur une miniature, Ctrl+V sur une autre. L'app n'écoute que les événements `copy` et `paste` du navigateur, dans son cadre isolé (sans
// `allow-same-origin`), sans demander le presse-papiers à Grist.
await showFiles(WORDS.deck);
await gfs.locator('.ls-row', { hasText: WORDS.deck }).first().dblclick();
seen = await waitShown(WORDS.deck);
await app.waitForFunction(() => document.querySelectorAll('.pp-slide-item').length === 3, null, { timeout: 15000 }).catch(() => {});
const deck = await slidesNow();
check('une présentation de trois diapositives s\'ouvre, avec sa bande de trois miniatures', Boolean(seen) && deck.count === 3 && deck.texts.length === 3 && deck.texts[1] === 'Titre deuxDeuxième texte gras', { seen, count: deck.count, texts: deck.texts });
await lab.shotPanel(run, '5c-trois-diapositives');
const onSecond = await intoStrip(2);
await page.keyboard.press('Control+c');
await page.waitForTimeout(400);
let clip = await slidesNow();
check(`Ctrl+C sur la miniature 2 : le coin d'état dit « ${WORDS.copied(2)} », le clavier reste sur elle et le document ne change pas`,
  onSecond === 2 && clip.status === WORDS.copied(2) && (await thumbFocus()) === 2 && clip.html === deck.html, { onSecond, status: clip.status, focus: await thumbFocus(), same: clip.html === deck.html });
await intoStrip(1);
await page.keyboard.press('Control+v');
await page.waitForTimeout(900);
clip = await slidesNow();
check('Ctrl+V sur la miniature 1 : la diapositive copiée arrive après elle, en deuxième, avec son titre et son texte en gras ; le clavier reste sur sa miniature',
  clip.count === 4 && JSON.stringify(clip.texts) === JSON.stringify([deck.texts[0], deck.texts[1], deck.texts[1], deck.texts[2]]) && (clip.html.match(/<strong>gras<\/strong>/g) || []).length === 2
    && (await thumbFocus()) === 2, { count: clip.count, texts: clip.texts, focus: await thumbFocus() });
await lab.shotPanel(run, '5d-diapositive-collee');
await page.keyboard.press('Control+z');
await page.waitForTimeout(600);
clip = await slidesNow();
check('un seul Ctrl+Z, sans quitter la bande, rend la présentation à l\'identique', clip.html === deck.html && clip.count === 3 && (await thumbFocus()) > 0, { count: clip.count, same: clip.html === deck.html, focus: await thumbFocus() });
// Le copier de toujours : un mot du texte, choisi au clavier, se copie et se colle au curseur, sans diapositive de plus.
// Une pause entre deux touches : l'éditeur relit la sélection du navigateur après chaque touche, et des touches trop serrées la lui font perdre.
const press = async (key, pause = 120) => { await page.keyboard.press(key); await page.waitForTimeout(pause); };
await app.locator('.ProseMirror p', { hasText: 'Premier texte' }).first().click();
await page.waitForTimeout(200);
await press('Home');
for (let i = 0; i < 'Premier'.length; i++) await press('Shift+ArrowRight', 80);
await press('Control+c', 250);
await press('End');
await press('Control+v', 600);
clip = await slidesNow();
check('un mot choisi dans le texte garde le copier-coller de toujours : « Premier » se colle au curseur, sans diapositive de plus', clip.count === 3 && clip.texts[0] === 'Titre unPremier textePremier', { count: clip.count, texts: clip.texts });
await page.keyboard.press('Control+z');
await page.waitForTimeout(600);
check('la présentation est revenue à l\'identique, prête pour la suite', (await slidesNow()).html === deck.html);

// « Ajouter » ouvre un menu de cinq mises en page ; « Titre et contenu » ajoute une diapositive après celle du curseur, avec son texte à remplacer ; un seul Ctrl+Z la retire.
await app.locator('button.pp-slide-add').first().click();
await app.locator('.pp-slide-layouts button[data-action="titleContent"]').waitFor();
const layouts = await app.evaluate(() => {
  const menu = document.querySelector('.pp-slide-layouts');
  const box = menu.getBoundingClientRect();
  return { items: Array.from(menu.querySelectorAll('[data-action]')).map(button => button.dataset.action), inPanel: box.height > 0 && box.top >= -0.5 && box.bottom <= innerHeight + 0.5 && box.left >= -0.5 && box.right <= innerWidth + 0.5 };
});
check('« Ajouter » ouvre un menu de cinq mises en page, entier dans le panneau de 700 × 400', layouts.items.length === 5 && layouts.inPanel, layouts);
await lab.shotPanel(run, '5e-menu-mises-en-page');
await app.locator('.pp-slide-layouts button[data-action="titleContent"]').click();
await page.waitForTimeout(900);
clip = await slidesNow();
check('« Titre et contenu » ajoute une diapositive après celle du curseur, avec son texte à remplacer', clip.count === 4 && clip.texts[1].includes(WORDS.point1) && clip.texts[0] === deck.texts[0], { count: clip.count, texts: clip.texts });
await page.keyboard.press('Control+z');
await page.waitForTimeout(600);
clip = await slidesNow();
check('un seul Ctrl+Z la retire : la présentation revient à l\'identique', clip.count === 3 && clip.html === deck.html, { count: clip.count, same: clip.html === deck.html });

// Glisser une miniature jusqu'à sa nouvelle place, à la vraie souris : l'app suit le pointeur par les événements du pointeur, que sa liste capture, dans le cadre isolé de GFS.
const itemBox = n => app.locator('.pp-slide-item').nth(n - 1).boundingBox();
const dragFrom = await itemBox(1);
const dragTo = await itemBox(2);
const gx = dragFrom.x + dragFrom.width / 2;
const gy = dragFrom.y + dragFrom.height / 2;
await page.mouse.move(gx, gy);
await page.mouse.down();
await page.mouse.move(gx + 6, gy + 12, { steps: 3 });
await page.mouse.move(gx, dragTo.y + dragTo.height * 0.8, { steps: 12 });
const dragging = await app.evaluate(() => ({ ghost: Boolean(document.querySelector('.pp-slide-ghost')), line: Boolean(document.querySelector('.pp-slide-drop')) }));
await page.mouse.up();
await page.waitForTimeout(800);
clip = await slidesNow();
check('une miniature se glisse à la vraie souris : la première passe après la deuxième (copie sous le pointeur et ligne d\'accent pendant le geste, rien d\'oublié après)',
  dragging.ghost && dragging.line && clip.count === 3 && JSON.stringify(clip.texts) === JSON.stringify([deck.texts[1], deck.texts[0], deck.texts[2]])
    && (await app.evaluate(() => document.querySelectorAll('.pp-slide-ghost, .pp-slide-drop').length)) === 0, { dragging, count: clip.count, texts: clip.texts });
await page.keyboard.press('Control+z');
await page.waitForTimeout(600);
clip = await slidesNow();
check('un seul Ctrl+Z la remet à sa place', clip.count === 3 && clip.html === deck.html, { count: clip.count, same: clip.html === deck.html });

// « Présenter » : le bouton ▶ à gauche de la pastille du zoom. Le plein écran du navigateur dépend de chaque cadre au-dessus de l'app (celui de GFS ne donne que `clipboard-write`) : ce que le
// navigateur en dit est relevé, et le diaporama couvre le panneau de l'app dans tous les cas, sans erreur ; la souris et le clavier l'avancent, Échap le ferme, la page ne se recharge pas.
const playButton = await playGeometry();
check('le bouton ▶ « Présenter » est là, actif, à gauche de la pastille du zoom, dans le panneau', Boolean(playButton) && !playButton.hidden && playButton.disabled === 'false' && playButton.leftOfZoom && playButton.inPanel, playButton);
await app.evaluate(() => { window.__pres = 'avant'; });
await intoStrip(2);
const counterNow = () => app.evaluate(() => { const counter = document.querySelector('.pp-slide-show-counter'); return counter ? counter.textContent.trim() : null; });
const waitCounter = async wanted => { for (let i = 0; i < 100 && (await counterNow()) !== wanted; i++) await page.waitForTimeout(100); return counterNow(); };
// Le bouton est-il sous un autre ? (la barre de GFS est posée par-dessus l'app, au bord gauche par défaut ; avant elle, deux boutons de GFS recouvraient le coin bas droit) : un essai de clic, sans cliquer, le dit.
const clickable = await app.locator('.pp-slide-show-open').click({ trial: true, timeout: 2500 }).then(() => true, () => false);
check('le bouton ▶ « Présenter » se clique à la vraie souris : aucun bouton de GFS ne le recouvre', clickable);
// Le coin bas droit du panneau tel que la personne le voit (le ▶ et la pastille du zoom de l'app), puis sans la barre de GFS.
const panel = await (await gfs.frameElement()).boundingBox();
const corner = { x: panel.x + panel.width - 250, y: panel.y + panel.height - 64, width: 250, height: 64 };
await page.screenshot({ path: join(SHOTS, `${run}-5g-coin-bas-droit.png`), clip: corner });
await gfs.evaluate(() => { document.querySelector('.floaters').style.visibility = 'hidden'; });
await page.screenshot({ path: join(SHOTS, `${run}-5h-coin-bas-droit-sans-gfs.png`), clip: corner });
await gfs.evaluate(() => { document.querySelector('.floaters').style.visibility = ''; });
if (clickable) await app.locator('.pp-slide-show-open').click();
else await page.keyboard.press('Shift+F5');
await app.locator('.pp-slide-show').waitFor({ timeout: 15000 });
const first = await waitCounter('2 / 3');
const covers = await app.evaluate(() => {
  const box = document.querySelector('.pp-slide-show').getBoundingClientRect();
  return { x: box.x, y: box.y, w: box.width, h: box.height, innerW: innerWidth, innerH: innerHeight, fullscreen: Boolean(document.fullscreenElement), allowed: document.fullscreenEnabled };
});
say('plein écran du navigateur :', covers.fullscreen ? 'accordé' : 'refusé', '· document.fullscreenEnabled =', covers.allowed);
check('le diaporama couvre tout le panneau de l\'app et part de la diapositive du curseur (la deuxième : « 2 / 3 »)', first === '2 / 3' && covers.x === 0 && covers.y === 0 && covers.w === covers.innerW && covers.h === covers.innerH, { first, covers });
await lab.shotPanel(run, '5f-diaporama');
await page.keyboard.press('ArrowRight');
const second = await waitCounter('3 / 3');
await page.keyboard.press('ArrowLeft');
const back = await waitCounter('2 / 3');
check('→ avance d\'une diapositive, ← recule', second === '3 / 3' && back === '2 / 3', { second, back });
await page.mouse.move(350, 200);
await page.mouse.move(360, 300, { steps: 4 });
await app.locator('.pp-slide-show-next').click();
const clicked = await waitCounter('3 / 3');
await page.mouse.move(350, 250, { steps: 3 });
await app.locator('.pp-slide-show-exit').click();
await app.locator('.pp-slide-show').waitFor({ state: 'detached', timeout: 10000 });
clip = await slidesNow();
check('à la souris, « › » avance et « ✕ » quitte ; la présentation n\'a pas bougé et la page ne s\'est pas rechargée', clicked === '3 / 3' && clip.html === deck.html && (await app.evaluate(() => window.__pres)) === 'avant', { clicked, same: clip.html === deck.html });
await intoStrip(2);
await page.keyboard.press('F5');
const fromStart = await waitCounter('1 / 3');
await page.keyboard.press('Escape');
await app.locator('.pp-slide-show').waitFor({ state: 'detached', timeout: 10000 });
check('F5 lance le diaporama depuis la première diapositive sans recharger la page, Échap le ferme', fromStart === '1 / 3' && (await app.evaluate(() => window.__pres)) === 'avant', { fromStart });
check('aucun refus de la politique de sécurité pendant le copier-coller, les mises en page, le glisser et le diaporama', (await app.evaluate(() => window.__csp)).length === 0, await app.evaluate(() => window.__csp));
// L'enregistrement automatique de l'app range ces essais dans la ligne de la présentation : on attend qu'il ait fini, sans quoi l'ouverture suivante ouvrirait sa question « Enregistrer ? ».
await app.waitForFunction(() => !LiveEntry.hasUnsavedEdits(), null, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(500);
// La présentation nommée revient à l'écran (le vierge n'a rien à garder) : la suite part d'elle.
await showFiles(WORDS.name);
await fileRow().dblclick();
await waitShown(WORDS.name);

// ===== 3 bis. Les diapositives liées (8d68bb4), l'extension cochée, « Ma présentation » à l'écran : la diapositive 2 de « Trois diapositives » importée liée après la première. L'app écrit
// alors d'autres lignes de Publipostage_Modeles que celle qui est ouverte : le numéro de la diapositive dans sa source et le jeton de la source (colonne `Jeton`, créée au premier besoin), puis
// ce qui change, dans le même lot que sa propre ligne. Les lots sont relevés dans le cadre de l'app, sans rien changer à ce qu'elle envoie.
const LINK = lang === 'fr'
  ? { keep: 'Garder liée', search: 'Trois', both: `Liée à « ${WORDS.deck} », dans les deux sens` }
  : { keep: 'Keep linked', search: 'Three', both: `Linked to “${WORDS.deck}”, both ways` };
const plain = html => String(html || '').replace(/<[^>]+>/g, '');
const sourceRow = () => gfs.evaluate(async name => {
  const data = await grist.docApi.fetchTable('Publipostage_Modeles');
  const at = data.Nom.indexOf(name);
  return at < 0 ? null : { id: data.id[at], content: data.Contenu[at], tokenColumn: 'Jeton' in data, token: data.Jeton ? String(data.Jeton[at] || '') : '' };
}, WORDS.deck);
const linkedBefore = await sourceRow();
await app.locator('.ProseMirror p', { hasText: WORDS.text }).first().click();
await app.locator('.pp-slide-import-open').click();
await app.locator('.pp-slide-import .ss-trigger').click();
await page.keyboard.type(LINK.search, { delay: 30 });
await page.keyboard.press('Enter');
const keepRow = app.locator('.pp-slide-import-keep');
await keepRow.waitFor({ timeout: 10000 });
const keep = await keepRow.evaluate(row => {
  const box = row.getBoundingClientRect();
  return { text: row.textContent.trim(), checked: row.querySelector('input').checked, inPanel: box.width > 0 && box.bottom <= innerHeight + 0.5 && box.right <= innerWidth + 0.5 };
});
check(`le volet « Importer », « ${WORDS.deck} » choisie : la case « ${LINK.keep} » est là, décochée, dans le panneau`, keep.text === LINK.keep && !keep.checked && keep.inPanel, keep);
await keepRow.locator('input').click();
await lab.shotPanel(run, '5i-importer-garder-liee');
await app.evaluate(() => {
  window.__lots = [];
  const real = grist.docApi.applyUserActions.bind(grist.docApi);
  grist.docApi.applyUserActions = (actions, ...rest) => { window.__lots.push(actions.map(action => [action[0], action[1], action[2]])); return real(actions, ...rest); };
});
await app.locator('.pp-slide-import .pp-slide-thumb').nth(1).click();
await app.waitForFunction(() => document.querySelectorAll('.pp-slide-strip .pp-slide-item').length === 2, null, { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(1500);
let linked = await slidesNow();
const badges = await app.evaluate(() => Array.from(document.querySelectorAll('.pp-slide-strip .pp-slide-item'))
  .map(item => { const mark = item.querySelector('.pp-slide-link-badge'); return mark && !mark.hidden ? mark.title : null; }));
// Le volet est encore ouvert, avec les miniatures de la source : les diapositives se comptent dans le document.
check('un clic sur la miniature 2 l\'importe, liée, après la première ; sa pastille dit le lien', linked.texts.length === 2 && linked.texts[1] === deck.texts[1] && badges[1] === LINK.both && !badges[0], { texts: linked.texts, badges });
let source = await sourceRow();
check('la ligne de la source reçoit tout de suite le numéro de sa diapositive et son jeton : le courtier laisse passer',
  Boolean(source) && /data-slide-id="[a-z0-9]+"/.test(source.content) && !/data-slide-id/.test(linkedBefore.content) && source.tokenColumn && source.token !== '' && warnings.length === 0,
  { tokenColumnBefore: linkedBefore.tokenColumn, token: source && source.token, warnings });
await lab.shotPanel(run, '5j-diapositive-liee');
// La barre de GFS est posée par-dessus l'app, au bord gauche par défaut (contrats 5.2, point 7) : recouvre-t-elle la pastille ? Relevé seulement : l'app s'écarte de sa zone (consigne 025).
const barBox = await gfs.locator('#floaters').boundingBox();
const badgeBox = await app.locator('.pp-slide-strip .pp-slide-item').nth(1).locator('.pp-slide-link-badge').boundingBox();
const overlaps = (a, b) => Boolean(a && b) && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
say('la pastille du lien sous la barre de GFS (bord gauche, le défaut) :', overlaps(barBox, badgeBox) ? 'oui' : 'non', JSON.stringify({ barBox, badgeBox }));
await app.locator('.pp-slide-import-close').click();
await app.locator('.ProseMirror p', { hasText: 'Deuxième texte' }).first().click();
await page.keyboard.press('End');
await page.keyboard.type(' ici', { delay: 30 });
await page.keyboard.press('Control+s');
for (let i = 0; i < 60 && !plain(source.content).includes('gras ici'); i++) { await page.waitForTimeout(250); source = await sourceRow(); }
const lots = await app.evaluate(() => window.__lots);
const actions = lots.flat();
const together = lots.some(lot => [saved.id, source.id].every(id => lot.some(action => action[1] === 'Publipostage_Modeles' && [].concat(action[2]).includes(id))));
say('lots de l\'app pendant les diapositives liées :', JSON.stringify([...new Set(actions.map(action => `${action[0]} ${action[1]}`))]));
check('du texte tapé dans la diapositive liée, puis Ctrl+S : la source le reçoit, dans le même lot que la présentation ouverte ; rien hors des tables de l\'app, aucun refus du courtier',
  plain(source.content).includes('gras ici') && together && actions.every(action => /^Publipostage_/.test(String(action[1]))) && warnings.length === 0, { together, lots: lots.length, warnings });
await app.waitForFunction(() => !LiveEntry.hasUnsavedEdits(), null, { timeout: 20000 }).catch(() => {});
await showFiles(WORDS.deck);
await gfs.locator('.ls-row', { hasText: WORDS.deck }).first().dblclick();
await waitShown(WORDS.deck);
await page.waitForTimeout(800);
linked = await slidesNow();
check(`« ${WORDS.deck} » ouverte depuis l'explorateur : sa diapositive 2 porte le changement`, linked.count === 3 && linked.texts[1].includes('gras ici'), linked.texts);
await lab.shotPanel(run, '5k-source-changee');
check('aucun refus de la politique de sécurité pendant les diapositives liées', (await app.evaluate(() => window.__csp)).length === 0, await app.evaluate(() => window.__csp));
await showFiles(WORDS.name);
await fileRow().dblclick();
await waitShown(WORDS.name);

// ===== 4. La personne éteint l'extension
await toggleSlides(false);
await app.waitForFunction(() => !Extensions.isActive('diapositives'), null, { timeout: 15000 });
await hoverRow();
state = await rowState();
check('la ligne « Nouvelle présentation » se grise de nouveau, avec sa raison', state.ariaDisabled === 'true' && state.grey && WORDS.reason.test(state.title), state);
await leaveMenu();
seen = await shown();
check('la présentation ouverte reste ouverte, intacte', seen.name === WORDS.name && seen.text.includes(WORDS.text), seen);
// Ctrl+V puis Ctrl+C sur sa miniature : l'app explique (appel `installer`, la fenêtre de GFS s'ouvre sur la ligne « Diapositives »), le document ne change pas.
const idle = await slidesNow();
await intoStrip(1);
await page.keyboard.press('Control+v');
await gfs.locator('.mod').waitFor({ timeout: 15000 });
check('éteinte, Ctrl+V sur une miniature ouvre la fenêtre de GFS sur la ligne « Diapositives » (appel `installer`), et le document ne change pas',
  (await focusedRow()) === FK && (await slidesNow()).html === idle.html, { focus: await focusedRow(), same: (await slidesNow()).html === idle.html });
await page.keyboard.press('Escape');
await gfs.locator('.mod').waitFor({ state: 'hidden' });
await intoStrip(1);
await page.keyboard.press('Control+c');
await gfs.locator('.mod').waitFor({ timeout: 15000 });
clip = await slidesNow();
check('Ctrl+C sur la miniature aussi : la même fenêtre, et le coin d\'état ne dit pas « copiée »', (await focusedRow()) === FK && clip.html === idle.html && clip.status !== WORDS.copied(1), { focus: await focusedRow(), status: clip.status });
await page.keyboard.press('Escape');
await gfs.locator('.mod').waitFor({ state: 'hidden' });
// Le bouton ▶ « Présenter » reste là, grisé avec sa raison (jamais caché) ; son clic explique de la même façon et ne lance rien.
const playOff = await app.evaluate(() => { const button = document.querySelector('.pp-slide-show-open'); return button ? { hidden: button.hidden, disabled: button.getAttribute('aria-disabled'), title: button.title } : null; });
check('éteinte, le bouton ▶ « Présenter » reste là, grisé avec sa raison', Boolean(playOff) && !playOff.hidden && playOff.disabled === 'true' && WORDS.reason.test(playOff.title), playOff);
// Son clic, ou sa touche (Maj+F5) quand un bouton de GFS le recouvre : l'app explique, sans lancer de diaporama.
const playClickOff = await app.locator('.pp-slide-show-open').click({ trial: true, timeout: 2500 }).then(() => true, () => false);
if (playClickOff) await app.locator('.pp-slide-show-open').click();
else { await intoStrip(1); await page.keyboard.press('Shift+F5'); }
await gfs.locator('.mod').waitFor({ timeout: 15000 });
check('son clic (ou Maj+F5) ouvre la fenêtre de GFS sur la ligne « Diapositives » (appel `installer`), sans lancer de diaporama', (await focusedRow()) === FK && (await app.locator('.pp-slide-show').count()) === 0, { focus: await focusedRow(), byMouse: playClickOff });
await page.keyboard.press('Escape');
await gfs.locator('.mod').waitFor({ state: 'hidden' });
await app.locator('#editor-container .ProseMirror').click();
await page.keyboard.press('End');
await page.keyboard.type(' bis', { delay: 20 });
await app.locator('#btn-save').click();
let again = null;
for (let i = 0; i < 60; i++) { again = await savedRow(WORDS.name); if (again && again.content.includes('bis')) break; await page.waitForTimeout(250); }
check('éteinte, elle s\'enregistre toujours sous son type (jamais sous un autre)', Boolean(again) && again.type === 'presentation' && again.content.includes('bis'), again);
await gfs.locator('#floater-files').click();
await fileRow().waitFor();
facts = await fileRow().evaluate(node => ({ fam: node.getAttribute('data-fam'), locked: node.classList.contains('lk'), title: node.getAttribute('title'), pill: node.querySelector('.ty .pill').textContent.trim() }));
check('dans l\'explorateur, la présentation est grisée avec sa raison (jamais cachée, toujours dans la liste)', facts.locked && facts.fam === null && WORDS.reason.test(facts.title || '') && facts.pill === WORDS.type, facts);
await lab.shotPanel(run, '6-explorateur-grise');
await fileRow().dblclick();
await gfs.locator('.mod').waitFor({ timeout: 15000 });
check('son double-clic ouvre la fenêtre de GFS sur la ligne « Diapositives »', (await focusedRow()) === FK, await focusedRow());
await page.keyboard.press('Escape');
check('aucun avertissement de GFS dans la console', warnings.length === 0, warnings);
await lab.browser.close();
