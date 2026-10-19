// Les présentations de Publipostage+ (extension « Diapositives », type « Présentation ») dans un vrai Grist (grist-static), avec la vraie app, celle que GFS référence, à 700 × 400, à la vraie
// souris et au vrai clavier (Playwright : événements du pointeur et du clavier du navigateur, jamais dispatchEvent). LAB_LANG=fr|en, LAB_SCHEME=light|dark.
//   1. Extension éteinte (le défaut) : la ligne « Nouvelle présentation » du menu « + » de l'app est grisée avec sa raison ; son clic appelle `installer` et la fenêtre de GFS s'ouvre sur la ligne
//      « Diapositives », sans bibliothèque (ni mode, ni poids à choisir).
//   2. La personne la coche : l'app la reçoit, sans rien charger ; la ligne s'utilise, une présentation vierge s'ouvre à la page 16:9 en paysage, nommée et enregistrée sous le type « presentation ».
//   3. L'explorateur de GFS : la présentation y est connue (famille orange, pastille « Présentation »), le menu « Nouveau » la propose, et le double-clic ouvre l'app sur elle.
//   4. La personne éteint l'extension : la ligne de l'app se grise, la présentation ouverte reste ouverte et s'enregistre toujours sous son type ; dans l'explorateur la présentation est grisée avec
//      sa raison, et son double-clic ouvre la fenêtre de GFS sur la ligne « Diapositives ».
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `diapositives-${lang}-${scheme}`;
const WORDS = lang === 'fr'
  ? { row: 'Nouvelle présentation', reason: /Demande l.extension Diapositives \(Grist Factory Suite\)/, type: 'Présentation', name: 'Ma présentation', opened: /Ouvert depuis l.explorateur\./, text: 'Première diapositive' }
  : { row: 'New presentation', reason: /Needs the Slides extension \(Grist Factory Suite\)/, type: 'Presentation', name: 'My presentation', opened: /Opened from the explorer\./, text: 'First slide' };
const FK = 'ext:publipostage/diapositives';

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
check('la ligne dit ce qu\'elle apporte et sa taille du manifeste (≈ 36 Ko), sans choix de bibliothèque (rien à charger)',
  (lang === 'fr' ? /Diapositives.*présentations en 16:9/ : /Slides.*16:9 presentations/).test(text) && (await line.locator('.mr-mode').count()) === 0
    && sizes.length === 1 && /^≈\s36\s(Ko|KB)$/.test(sizes[0].trim()), `${text} | ${JSON.stringify(sizes)}`);
check('elle n\'est pas grisée : aucune bibliothèque ne peut lui manquer', !(await line.evaluate(node => node.classList.contains('is-locked'))));
await lab.shotPanel(run, '2-fenetre-diapositives');

// ===== 2. La personne la coche
const scriptsBefore = await app.evaluate(() => document.scripts.length);
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
check('rien n\'a été chargé pour cela (aucun script de plus), aucun refus de la politique de sécurité', (await app.evaluate(() => document.scripts.length)) === scriptsBefore && (await app.evaluate(() => window.__csp)).length === 0, await app.evaluate(() => window.__csp));
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
await gfs.evaluate(() => grist.docApi.applyUserActions([['AddRecord', 'Publipostage_Modeles', null, { Nom: 'Lettre', TypeModele: 'document', Contenu: '<p>Cher client</p>' }]]));
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

// ===== 4. La personne éteint l'extension
await toggleSlides(false);
await app.waitForFunction(() => !Extensions.isActive('diapositives'), null, { timeout: 15000 });
await hoverRow();
state = await rowState();
check('la ligne « Nouvelle présentation » se grise de nouveau, avec sa raison', state.ariaDisabled === 'true' && state.grey && WORDS.reason.test(state.title), state);
await leaveMenu();
seen = await shown();
check('la présentation ouverte reste ouverte, intacte', seen.name === WORDS.name && seen.text.includes(WORDS.text), seen);
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
