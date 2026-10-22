// Les choix de chaque personne gardés par GFS, avec la vraie app (consigne 024 ; contrats 5.3) : Publipostage+ à `1f336ac` ou après (la fenêtre des nouveautés), dans un vrai Grist (grist-static), à 700 × 400, à la vraie
// souris et au vrai clavier. run-stockage.mjs mesure le côté de GFS avec deux sondes ; cette passe rejoue avec l'app ce que sa page propose (« choisir le thème sombre dans Réglages, recharger la
// page de GFS, l'app revient en sombre »). LAB_LANG=fr|en, LAB_SCHEME=light|dark (le thème choisi est l'autre : sombre en clair, clair en sombre, pour qu'il se voie). Ce que la passe mesure :
//   0. la fenêtre des nouveautés (`1f336ac`, la onzième clé, `pp_news_seen`) : au premier départ chez GFS elle s'ouvre toute seule, GFS garde d'abord « 0 » ; « Suivant » à la souris puis Échap au
//      clavier la ferment, GFS garde la version vue ; GFS rechargé, le modèle rouvert, elle ne revient pas ;
//   1. le départ : l'app a l'espace de GFS (`PersonStore.shared()`), son cadre refuse son propre stockage, GFS n'a gardé pour elle que la version vue des nouveautés ;
//   2. le thème, à la souris dans ses Réglages puis au clavier (les flèches du groupe) : l'app l'applique à l'instant, GFS le garde sous `gfs.stockage.publipostage.pp_theme`, l'app n'envoie
//      aucun lot au document et le courtier ne refuse rien ;
//   3. le zoom de la page au clavier (Ctrl + plus) : GFS garde `pp_page_zoom`, le niveau du modèle ouvert ;
//   4. GFS rechargé, le même modèle rouvert depuis l'explorateur : l'app revient dans le thème choisi (ses Réglages le cochent) et au même zoom ;
//   5. Ctrl + 0 rend l'affichage d'origine : l'app retire la clé (`valeur: null`), GFS ne la garde plus ;
//   6. les bulles et les puces de l'éditeur (`84002e4`, la douzième clé, `pp_bubble_marks`) : « Mise en forme » choisi à la souris dans l'onglet Thème, l'app l'applique à l'instant et GFS le garde ;
//      GFS rechargé, le modèle rouvert, le choix est revenu (case cochée, attribut posé dès le départ) ; aucun lot au document.
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `stockage-publipostage-${lang}-${scheme}`;
const WANT = scheme === 'light' ? 'dark' : 'light';
const BY_KEYBOARD = WANT === 'dark' ? 'light' : 'system'; // la case d'avant dans le groupe (Système, Clair, Sombre) : la flèche vers le haut y mène
const OPEN = 'Contrat de prestation';
const PREFIX = 'gfs.stockage.publipostage.';

// `newsSeen: false` : le labo ne dit pas la fenêtre des nouveautés déjà vue, cette passe la mesure (lab-common.mjs).
const lab = await startLab({ lang, colorScheme: scheme, newsSeen: false });
const { page } = lab;
const warnings = [];
const errors = [];
page.on('console', m => { if (m.type() === 'warning' && m.text().startsWith('GFS')) warnings.push(m.text()); });
page.on('pageerror', error => errors.push(String(error && error.message).slice(0, 160)));
await lab.fitPanel(undefined, 700, 400);
await seedFiles(lab.frame);

let frame = lab.frame;
let app = null;
const waitFor = async (label, test, tries = 80) => {
  for (let i = 0; i < tries; i++) {
    if (await test().catch(() => false)) return true;
    await page.waitForTimeout(100);
  }
  say(`(pas arrivé : ${label})`);
  return false;
};
const waitStarted = async () => {
  await app.waitForFunction(() => { const e = document.getElementById('status-msg'); return Boolean(e && e.textContent); }, null, { timeout: 30000 });
  await page.waitForTimeout(800);
};
const restart = async () => {
  await frame.evaluate(() => location.reload());
  await page.waitForTimeout(1000);
  frame = await lab.gfsFrame(/access=full/);
  await lab.gfsReady(frame);
  await page.waitForTimeout(800);
};
const openFromExplorer = async () => {
  await frame.locator('.ls-row', { hasText: OPEN }).first().dblclick();
  app = await lab.appFrame(/\/apps\/publipostage\//);
  await waitStarted();
  await app.waitForFunction(name => document.getElementById('template-name').value === name, OPEN, { timeout: 20000 }).catch(() => {});
};
// Ce que GFS garde pour l'app dans son navigateur : les clés `gfs.stockage.publipostage.*`, sans le préfixe.
const kept = () => frame.evaluate(prefix => Object.fromEntries(Object.keys(localStorage).filter(key => key.startsWith(prefix)).sort()
  .map(key => [key.slice(prefix.length), localStorage.getItem(key)])), PREFIX);
const appState = () => app.evaluate(() => {
  let own = 'permis';
  try { void localStorage.length; } catch (error) { own = 'refusé'; }
  return { shared: PersonStore.shared(), theme: document.documentElement.getAttribute('data-theme'), stored: PersonStore.get('pp_theme'), zoom: PersonStore.get('pp_page_zoom'), own };
});
const checkedTheme = () => app.evaluate(() => { const r = document.querySelector('input[name="settings-theme"]:checked'); return r ? r.value : null; });
const focusedTheme = () => app.evaluate(() => (document.activeElement && document.activeElement.name === 'settings-theme' ? document.activeElement.value : null));
// Les lots que l'app envoie au document à partir d'ici (le reste de l'app n'en a pas besoin pendant ces gestes).
const watchLots = () => app.evaluate(() => {
  window.__lots = [];
  const real = grist.docApi.applyUserActions.bind(grist.docApi);
  grist.docApi.applyUserActions = (actions, ...rest) => { window.__lots.push(actions.map(action => `${action[0]} ${action[1]}`)); return real(actions, ...rest); };
});
const lots = () => app.evaluate(() => window.__lots || []);
const openThemeTab = async () => {
  await app.locator('#v2-btn-settings').click();
  await app.locator('[data-settings-tab="theme"]').click();
  await page.waitForTimeout(200);
};
const closeSettings = async () => { await app.locator('#settings-close').click(); await page.waitForTimeout(200); };
const zoomEntry = text => { try { return JSON.parse(text || '[]').find(entry => entry.n === OPEN) || null; } catch (error) { return null; } };
const newsOpen = () => app.evaluate(() => { const m = document.getElementById('pp-news-modal'); return Boolean(m && m.isConnected && getComputedStyle(m).display !== 'none'); });

// ---------- 0. GFS repart, la personne ouvre un modèle depuis l'explorateur ----------
// Le premier départ de l'app écrit lui-même dans le document (des colonnes ajoutées à ses tables) : il passe par la fenêtre des apps, avant la première mesure.
await lab.openModules(frame);
await frame.locator('[data-open="publipostage"]').click();
app = await lab.appFrame(/\/apps\/publipostage\//);
await waitStarted();
const reads = await app.evaluate(() => typeof PersonStore !== 'undefined' && typeof GfsLink.hasStorage === 'function' && typeof WhatsNew.openOnFirstConnection === 'function');
check('l\'app garde ses choix par `PersonStore` et l\'espace de GFS (consigne 024), nouveautés comprises : c\'est une version à `1f336ac` ou après', reads);
if (!reads) { await lab.browser.close(); process.exit(1); }

// ---------- 0. la fenêtre des nouveautés, une fois par personne ----------
const version = await app.evaluate(() => WhatsNew.VERSION);
const opened = await waitFor('la fenêtre des nouveautés', newsOpen, 60);
const whileOpen = await kept();
say('fenêtre des nouveautés :', opened, 'chez GFS :', whileOpen);
check('au premier départ chez GFS, la fenêtre des nouveautés s\'ouvre toute seule, et GFS garde d\'abord « 0 » (aucune version vue) sous pp_news_seen',
  opened && JSON.stringify(whileOpen) === JSON.stringify({ pp_news_seen: '0' }), whileOpen);
await lab.shotPanel(run, '0-nouveautes');
const nextLabel = await app.evaluate(() => I18n.t('news.next'));
await app.locator('#pp-news-modal').getByRole('button', { name: nextLabel, exact: true }).click();
await page.waitForTimeout(300);
const stillOpen = await newsOpen();
await page.keyboard.press('Escape');
await waitFor('la version vue gardée par GFS', async () => (await kept()).pp_news_seen === version);
check(`« Suivant » à la souris la laisse ouverte, Échap au clavier la ferme : GFS garde la version vue (pp_news_seen « ${version} »)`,
  stillOpen && !(await newsOpen()) && JSON.stringify(await kept()) === JSON.stringify({ pp_news_seen: version }), { stillOpen, kept: await kept() });
await restart();
await openFromExplorer();
await page.waitForTimeout(1500);
check('GFS rechargé, le modèle rouvert depuis l\'explorateur : la fenêtre ne revient pas', !(await newsOpen()) && (await kept()).pp_news_seen === version, await kept());

// ---------- 1. le départ ----------
let state = await appState();
say('au départ :', state, 'chez GFS :', await kept());
check('l\'app a l\'espace de GFS, et son cadre refuse son propre stockage', state.shared === true && state.own === 'refusé', state);
check('au départ, GFS n\'a gardé pour l\'app que la version vue des nouveautés, et elle suit le thème du système',
  JSON.stringify(await kept()) === JSON.stringify({ pp_news_seen: version }) && state.theme === null && state.stored === null, { state, kept: await kept() });

// ---------- 2. le thème, à la souris puis au clavier ----------
await watchLots();
await openThemeTab();
await app.locator(`label:has(input[name="settings-theme"][value="${WANT}"])`).click();
await waitFor('le thème gardé par GFS', async () => (await kept()).pp_theme === WANT);
state = await appState();
check(`le thème « ${WANT} » choisi à la souris : l'app l'applique à l'instant et GFS le garde (gfs.stockage.publipostage.pp_theme)`,
  state.theme === WANT && state.stored === WANT && (await kept()).pp_theme === WANT, { state, kept: await kept() });
await lab.shotPanel(run, '1-theme-choisi');
const focused = await focusedTheme();
await page.keyboard.press('ArrowUp');
await waitFor('le thème d\'avant gardé par GFS', async () => (await kept()).pp_theme === BY_KEYBOARD);
const back = { kept: (await kept()).pp_theme, theme: (await appState()).theme };
await page.keyboard.press('ArrowDown');
await waitFor('le thème choisi de nouveau', async () => (await kept()).pp_theme === WANT);
state = await appState();
check('au clavier (flèches du groupe), chaque choix part chez GFS : la case d\'avant, puis de nouveau la première',
  focused === WANT && back.kept === BY_KEYBOARD && back.theme === (BY_KEYBOARD === 'system' ? null : BY_KEYBOARD) && state.theme === WANT && (await kept()).pp_theme === WANT, { focused, back, state });
await closeSettings();
const themeLots = await lots();
check('choisir le thème n\'envoie aucun lot au document, et le courtier ne refuse rien', themeLots.length === 0 && warnings.length === 0, { themeLots, warnings });

// ---------- 3. le zoom de la page, au clavier ----------
// Au départ, la feuille est réduite pour tenir dans le panneau (« auto ») : Ctrl + plus monte d'un cran à partir de là.
const percent = async () => Number(((await app.locator('.pp-page-zoom-value').textContent()) || '').replace(/\D/g, ''));
const paragraph = await app.locator('.ProseMirror p').first().boundingBox();
await page.mouse.click(paragraph.x + Math.min(40, paragraph.width / 2), paragraph.y + paragraph.height / 2);
await page.waitForTimeout(500);
const clickLots = (await lots()).length;
const shownBefore = await percent();
await page.keyboard.press('Control+Equal');
await waitFor('le zoom gardé par GFS', async () => Boolean(zoomEntry((await kept()).pp_page_zoom)), 100);
const zoom = zoomEntry((await kept()).pp_page_zoom);
const shownAfter = await percent();
say('zoom affiché :', shownBefore, '->', shownAfter, '; gardé :', zoom);
check('Ctrl + plus : la feuille grandit d\'un cran et GFS garde le niveau choisi pour ce modèle (pp_page_zoom)',
  Boolean(zoom) && zoom.m === 'manual' && shownAfter > shownBefore && Math.round(zoom.z * 100) === shownAfter, { zoom, shownBefore, shownAfter });
// Un clic dans le texte fait lire à l'app l'identité de la personne (sa table-sonde, une ligne ajoutée puis retirée) : c'est d'avant la 024, pas le stockage.
const written = await lots();
say('lots de l\'app après le clic dans le texte et le zoom :', JSON.stringify(written));
check('le zoom n\'envoie aucun lot au document : rien de plus que ce que le clic dans le texte envoyait déjà (la sonde d\'identité de l\'app)',
  written.length === clickLots && written.flat().every(action => / Publipostage_UserProbe$/.test(action)) && warnings.length === 0, { written, clickLots, warnings });
await lab.shotPanel(run, '2-zoom');

// ---------- 4. GFS rechargé ----------
const before = await kept();
await restart();
await openFromExplorer();
state = await appState();
await openThemeTab();
const checked = await checkedTheme();
await closeSettings();
say('après le rechargement de GFS :', state, 'case cochée :', checked);
check(`GFS rechargé, le même modèle rouvert : l'app revient en « ${WANT} », ses Réglages le cochent`, state.shared === true && state.theme === WANT && state.stored === WANT && checked === WANT, { state, checked });
check('et au même zoom : le contexte lui a rendu le niveau gardé, GFS n\'a rien changé', JSON.stringify(zoomEntry(state.zoom)) === JSON.stringify(zoom) && JSON.stringify(await kept()) === JSON.stringify(before), { zoom: state.zoom, kept: await kept() });
await lab.shotPanel(run, '3-apres-rechargement');

// ---------- 5. Ctrl + 0 ----------
await watchLots();
const again = await app.locator('.ProseMirror p').first().boundingBox();
await page.mouse.click(again.x + Math.min(40, again.width / 2), again.y + again.height / 2);
await page.waitForTimeout(500);
const resetClickLots = (await lots()).length;
await page.keyboard.press('Control+Digit0');
await waitFor('la clé du zoom retirée chez GFS', async () => !('pp_page_zoom' in (await kept())), 100);
const after = await kept();
check('Ctrl + 0 rend l\'affichage d\'origine : l\'app retire la clé, GFS ne garde plus que la version vue et le thème', JSON.stringify(after) === JSON.stringify({ pp_news_seen: version, pp_theme: WANT }), after);
const resetLots = await lots();
check('Ctrl + 0 n\'envoie aucun lot non plus ; aucun refus du courtier, aucune erreur de page pendant la passe',
  resetLots.length === resetClickLots && resetLots.flat().every(action => / Publipostage_UserProbe$/.test(action)) && warnings.length === 0 && errors.length === 0, { resetLots, warnings, errors });

// ---------- 6. les bulles et les puces de l'éditeur (la douzième clé, `pp_bubble_marks`) ----------
// « Par défaut » ou « Mise en forme » : un seul choix pour tous les modèles de la personne ; comme le thème, il s'applique à l'instant (un attribut sur <html>) et dès le chargement de la page.
const bubbleAttr = () => app.evaluate(() => document.documentElement.getAttribute('data-bubble-marks'));
const checkedBubble = () => app.evaluate(() => { const r = document.querySelector('input[name="settings-bubble-marks"]:checked'); return r ? r.value : null; });
await watchLots();
await openThemeTab();
const bubbleAtStart = { checked: await checkedBubble(), attr: await bubbleAttr(), kept: (await kept()).pp_bubble_marks };
await app.locator('label:has(input[name="settings-bubble-marks"][value="marks"])').click();
await waitFor('le choix des bulles gardé par GFS', async () => (await kept()).pp_bubble_marks === 'marks');
const bubbleChosen = { checked: await checkedBubble(), attr: await bubbleAttr(), kept: (await kept()).pp_bubble_marks };
say('bulles et puces, au départ :', bubbleAtStart, '; « Mise en forme » choisi :', bubbleChosen);
check('au départ, « Par défaut » est coché, aucun attribut sur <html> et GFS ne garde rien sous pp_bubble_marks',
  bubbleAtStart.checked === 'default' && bubbleAtStart.attr === null && bubbleAtStart.kept === undefined, bubbleAtStart);
check('« Mise en forme » choisi à la souris : l\'app l\'applique à l\'instant (data-bubble-marks sur <html>) et GFS le garde (gfs.stockage.publipostage.pp_bubble_marks, la douzième clé)',
  bubbleChosen.checked === 'marks' && bubbleChosen.attr === 'marks' && bubbleChosen.kept === 'marks', bubbleChosen);
await lab.shotPanel(run, '4-bulles-choisies');
await closeSettings();
const bubbleLots = await lots();
await restart();
await openFromExplorer();
const bubbleReloaded = { attr: await bubbleAttr() };
await openThemeTab();
bubbleReloaded.checked = await checkedBubble();
await closeSettings();
const keptAfter = await kept();
check('GFS rechargé, le modèle rouvert : l\'attribut est posé et « Mise en forme » est cochée, le choix a survécu au rechargement du cadre ; GFS garde la clé telle quelle',
  bubbleReloaded.attr === 'marks' && bubbleReloaded.checked === 'marks' && keptAfter.pp_bubble_marks === 'marks', { bubbleReloaded, keptAfter });
check('ce choix n\'envoie aucun lot au document, le courtier ne refuse rien et la page n\'a aucune erreur',
  bubbleLots.length === 0 && warnings.length === 0 && errors.length === 0, { bubbleLots, warnings, errors });
await lab.browser.close();
