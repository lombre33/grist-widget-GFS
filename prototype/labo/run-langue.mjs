// Le choix de langue de GFS (décision du porteur, 20/10 ; contrats 1.3, 5.2 et 5.3), dans un vrai Grist (grist-static), à 700 × 400, à la vraie souris et au vrai clavier (Playwright :
// événements du pointeur et du clavier du navigateur, jamais dispatchEvent). LAB_LANG=fr|en est la langue de Grist (le paramètre `language` de l'adresse du widget), LAB_SCHEME=light|dark,
// LAB_W la largeur du panneau (700). Depuis le 04/11 la langue se choisit dans le menu « Réglages » (le dernier bouton de la ligne du titre, à icône seule) : sa ligne « Langue » ouvre un sous-menu.
// Ce que la passe mesure :
//   1. le départ : GFS parle la langue de Grist, le bouton « Réglages » est le dernier de la ligne du titre, rien n'est retenu, le sous-menu « Langue » offre « comme Grist », Français, English ;
//   2. un choix à la souris : tout ce que l'explorateur écrit (textes, dates, types, volet, liste) passe dans l'autre langue, la clé `gfs.langue` est retenue, le focus reste sur le bouton « Réglages » ;
//   3. le clavier : Entrée ouvre le menu puis le sous-menu, Début va à « comme Grist », Entrée choisit, la clé disparaît ;
//   4. « retenu sur le navigateur » : GFS rechargé repart dans la langue choisie, non dans celle de Grist ;
//   5. les apps suivent : la sonde L (labo/sondes/l-langue/) reçoit sa langue dans l'adresse et le contexte, puis l'événement `langue` à chaque changement de langue qui vaut (pas quand le choix
//      redit la langue de Grist), sans que son cadre soit rechargé ; une app ouverte après le choix la reçoit dès le départ ;
//   6. un navigateur qui refuse de retenir : le choix vaut pour la page, GFS le dit dans la langue choisie ;
//   7. une autre section de GFS dans la page change la clé (événement `storage` du navigateur) : GFS suit sans rechargement, la fenêtre « Apps et extensions » ouverte aussi.
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check } from './lab-common.mjs';
import { collectWarnings, waiter, reopenGfs } from './lab-gestes.mjs';
import { settingsButton, openSettings, openLanguageMenu, chooseLanguage, subRows } from './reglages-gestes.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const panelWidth = Number(process.env.LAB_W || 700);
const other = lang === 'fr' ? 'en' : 'fr';
const run = `langue-${lang}-${scheme}${panelWidth === 700 ? '' : `-${panelWidth}`}`;
const NAMES = { fr: 'Français', en: 'English' };
// Ce que le labo cherche à l'écran, dans chaque langue (les textes de js/i18n.js).
const WORDS = {
  fr: { title: 'Mes fichiers', add: 'Nouveau', open: 'Ouvrir', close: 'Fermer', search: 'Rechercher…', allTypes: 'Tous les types', recent: 'Récents', today: 'Auj.', locked: 'Créé avec une version plus récente', filesTip: 'Ouvrir l’explorateur de fichiers',
    appsTitle: 'Apps et extensions', settingsTip: 'Réglages de Grist Factory Suite', settingsMenu: 'Réglages', menu: 'Langue', auto: n => `Comme Grist (${n})`, notKept: 'Ce choix ne sera pas gardé : votre navigateur refuse l’enregistrement.' },
  en: { title: 'My files', add: 'New', open: 'Open', close: 'Close', search: 'Search…', allTypes: 'All types', recent: 'Recent', today: 'Today', locked: 'Created with a newer version', filesTip: 'Open the file explorer',
    appsTitle: 'Apps and extensions', settingsTip: 'Grist Factory Suite settings', settingsMenu: 'Settings', menu: 'Language', auto: n => `Same as Grist (${n})`, notKept: 'This choice will not be kept: your browser refuses to store it.' },
};
const words = WORDS[lang];
const wordsOther = WORDS[other];

const lab = await startLab({ lang, colorScheme: scheme, probes: true });
const { page } = lab;
const warnings = collectWarnings(page);
await lab.fitPanel(undefined, panelWidth, 400);
say('semis :', await seedFiles(lab.frame));
let frame = await reopenGfs(lab);
const shot = name => lab.shotPanel(run, name, frame);
const reload = async () => { frame = await reopenGfs(lab, frame, 500); };
const waitFor = waiter(page, 60);

// Ce que l'explorateur écrit à l'écran, relevé d'un coup.
const screen = () => frame.evaluate(() => {
  const text = selector => { const node = document.querySelector(selector); return node ? node.textContent.replace(/\s+/g, ' ').trim() : null; };
  const attr = (selector, name) => { const node = document.querySelector(selector); return node ? node.getAttribute(name) : null; };
  const rowText = re => { const row = [...document.querySelectorAll('.ls-row')].find(item => re.test(item.textContent)); return row ? row.textContent.replace(/\s+/g, ' ').trim() : null; };
  const foot = [...document.querySelectorAll('.ex-foot .btn')].map(node => node.textContent.trim());
  return {
    html: document.documentElement.lang, title: text('.ex-title'), settingsLabel: attr('.ex-title-row .tb[aria-haspopup="menu"]:not(.tb-bell)', 'aria-label'), settingsTip: attr('.ex-title-row .tb[aria-haspopup="menu"]:not(.tb-bell)', 'title'),
    add: text('.btn.primary'), open: foot[0], close: foot[1], search: attr('.inp-search input', 'placeholder'), allTypes: text('.ex-nav-row .btn[aria-haspopup="menu"]'),
    recent: text('.tr-row[data-view="recent"]'), head: text('.ls-head'), contract: rowText(/Contrat de prestation/), slides: rowText(/Support de session/),
    onSettings: document.activeElement === document.querySelector('.ex-title-row .tb[aria-haspopup="menu"]:not(.tb-bell)'),
  };
});
const stored = () => frame.evaluate(() => { try { return localStorage.getItem('gfs.langue'); } catch (error) { return 'REFUSÉ'; } });
const button = () => settingsButton(frame);
// Le sous-menu « Langue » ouvert (menu « Réglages », puis sa ligne « Langue ») et ses articles.
const openMenu = () => openLanguageMenu(frame);
const menuItems = () => subRows(frame).evaluateAll(nodes => nodes.map(node => ({ text: node.textContent.trim(), checked: node.getAttribute('aria-checked'), role: node.getAttribute('role') })));
// L'article du sous-menu qui porte exactement ce texte (« English » est aussi dans « Same as Grist (English) »).
const choose = name => chooseLanguage(frame, name);
const chooseAuto = () => chooseLanguage(frame, null);

// ---------- 1. le départ ----------
say('panneau :', await (await frame.frameElement()).boundingBox());
let now = await screen();
say('écran au départ :', now);
check('GFS parle la langue de Grist', now.html === lang && now.title === words.title && now.add === words.add && now.search === words.search, now);
check('le bouton « Réglages » porte son nom accessible et son info-bulle (il n\'a pas d\'autre texte : l\'icône seule)', now.settingsLabel === words.settingsTip && now.settingsTip === words.settingsTip, { label: now.settingsLabel, tip: now.settingsTip });
check('rien n\'est retenu tant que la personne n\'a rien choisi', (await stored()) === null, await stored());
const layout = await frame.evaluate(() => {
  const rect = selector => { const node = document.querySelector(selector); const r = node.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), width: Math.round(r.width) }; };
  const settings = '.ex-title-row .tb[aria-haspopup="menu"]:not(.tb-bell)';
  return { apps: rect('.ex-title-row .tb[aria-haspopup="dialog"]:not([hidden])'), group: rect('.tb-group'), settings: rect(settings), view: window.innerWidth, scroll: document.documentElement.scrollWidth, text: document.querySelector(settings).textContent.trim() };
});
say('mise en page de la ligne du titre :', layout);
check('la ligne du titre tient dans le panneau sans défilement horizontal, les boutons ne se chevauchent pas, « Réglages » est le dernier à droite', layout.scroll <= layout.view && layout.apps.right <= layout.group.left && layout.group.right <= layout.settings.left && layout.settings.right <= layout.view, layout);
check('« Réglages » n\'a que son icône, à toute largeur', layout.text === '', layout);
await shot('1-depart');

await openSettings(frame);
const main = await frame.evaluate(() => [...document.querySelectorAll('.menu:not(.menu-sub) .menu-item')].map(node => ({ text: node.querySelector('.menu-label').textContent.trim(), popup: node.getAttribute('aria-haspopup') })));
check('le menu « Réglages » a ses quatre lignes : Langue (sous-menu), Thème, Position de la barre (sous-menu), À propos', main.length === 4 && main[0].text === words.menu && main[0].popup === 'menu' && main[1].popup === null && main[2].popup === 'menu' && main[3].popup === null, main);
await page.keyboard.press('Escape');
await openMenu();
let items = await menuItems();
say('sous-menu :', items);
check('le sous-menu « Langue » offre « comme Grist », Français, English ; « comme Grist » est coché', items.length === 3 && items[0].text === words.auto(NAMES[lang]) && items[1].text === 'Français' && items[2].text === 'English' && items[0].checked === 'true' && items[1].checked === 'false' && items[2].checked === 'false' && items.every(item => item.role === 'menuitemradio'), items);
const menu = await frame.evaluate(() => {
  const box = document.querySelector('.menu-sub').getBoundingClientRect();
  const row = document.querySelector('.menu:not(.menu-sub) .menu-item').getBoundingClientRect();
  const item = document.querySelector('.menu-sub .menu-item').getBoundingClientRect();
  const hit = document.elementFromPoint(item.left + item.width / 2, item.top + item.height / 2);
  return { left: Math.round(box.left), right: Math.round(box.right), bottom: Math.round(box.bottom), view: [window.innerWidth, window.innerHeight], onTop: Boolean(hit && hit.closest('.menu-sub')), named: document.querySelector('.menu-sub').getAttribute('aria-label'), mainNamed: document.querySelector('.menu:not(.menu-sub)').getAttribute('aria-label'), focus: document.activeElement.textContent.trim(), covers: box.left < row.right - 0.5 && box.right > row.left + 0.5 };
});
check('le sous-menu tient dans le panneau, passe au-dessus de la liste, ne recouvre pas la ligne « Langue » qui l\'ouvre, porte le nom « Langue » (le menu, « Réglages ») et met le clavier sur l\'article coché', menu.left >= 0 && menu.right <= menu.view[0] && menu.bottom <= menu.view[1] && menu.onTop && !menu.covers && menu.named === words.menu && menu.mainNamed === words.settingsMenu && menu.focus === words.auto(NAMES[lang]), menu);
await shot('2-menu');
await page.keyboard.press('Escape');
check('Échap ferme d\'abord le sous-menu : le menu « Réglages » reste', (await frame.locator('.menu-sub').count()) === 0 && (await frame.locator('.menu').count()) === 1);
await page.keyboard.press('Escape');
check('un second Échap ferme le menu, le clavier revient au bouton « Réglages »', (await frame.locator('.menu').count()) === 0 && (await screen()).onSettings);

// ---------- 2. un choix à la souris ----------
await choose(NAMES[other]);
now = await screen();
say('écran après le choix :', now);
check('tout ce que l\'explorateur écrit passe dans l\'autre langue : page, titre, boutons, recherche, filtre, volet, en-têtes',
  now.html === other && now.title === wordsOther.title && now.add === wordsOther.add && now.open === wordsOther.open && now.search === wordsOther.search && now.allTypes === wordsOther.allTypes
  && now.recent === wordsOther.recent && (other === 'en' ? /Name.*Modified/.test(now.head) : /Nom.*Modifié/.test(now.head)), now);
check('les dates et les raisons de grisé de la liste aussi (Auj. / Today, Créé avec une version plus récente / Created with a newer version)', Boolean(now.contract && now.contract.includes(wordsOther.today)) && Boolean(now.slides && now.slides.includes(wordsOther.locked)), { contract: now.contract, slides: now.slides });
check('le bouton « Réglages » dit son nom dans la nouvelle langue', now.settingsLabel === wordsOther.settingsTip && now.settingsTip === wordsOther.settingsTip, { label: now.settingsLabel, tip: now.settingsTip });
check('le clavier reste sur le bouton « Réglages » (on ne perd pas sa place)', now.onSettings, now.onSettings);
check('le choix est retenu sur le navigateur, dans la clé de GFS', (await stored()) === other, await stored());
await openMenu();
items = await menuItems();
check('le menu coche le choix, et dit « comme Grist » avec la langue de Grist, écrite dans la sienne', items[0].text === wordsOther.auto(NAMES[lang]) && items[0].checked === 'false' && items[other === 'fr' ? 1 : 2].checked === 'true', items);
await shot('3-autre-langue');
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');

// ---------- 3. le clavier ----------
await button().focus();
await page.keyboard.press('Enter');
await frame.locator('.menu:not(.menu-sub)').waitFor();
await page.keyboard.press('Enter'); // le clavier est sur « Langue » : le sous-menu s'ouvre
await frame.locator('.menu-sub').waitFor();
await page.keyboard.press('Home');
const homeFocus = await frame.evaluate(() => document.activeElement.textContent.trim());
check('au clavier : Entrée ouvre le menu puis le sous-menu « Langue », Début va à « comme Grist »', homeFocus === wordsOther.auto(NAMES[lang]), homeFocus);
await page.keyboard.press('Enter');
now = await screen();
check('au clavier : Entrée choisit « comme Grist » ; GFS revient à la langue de Grist, la clé disparaît, le clavier reste sur le bouton « Réglages »', now.html === lang && now.title === words.title && (await stored()) === null && now.onSettings, { html: now.html, title: now.title, stored: await stored(), onSettings: now.onSettings });

// ---------- 4. retenu sur le navigateur ----------
await choose(NAMES[other]);
await reload();
now = await screen();
check('GFS rechargé repart dans la langue choisie, non dans celle de Grist', now.html === other && now.title === wordsOther.title && (await stored()) === other, { html: now.html, title: now.title, stored: await stored() });
await shot('4-apres-rechargement');
await chooseAuto();
check('« comme Grist » ramène à la langue de Grist et retire la clé', (await screen()).html === lang && (await stored()) === null);

// ---------- 5. les apps suivent ----------
// La sonde écrit son état quand son script a tourné : avant, rien (le cadre existe déjà, sa page se charge).
const probe = app => app.evaluate(() => ({ contextes: [], evenements: [], ...JSON.parse((document.body && document.body.dataset.sonde) || '{}') }));
let app = await lab.openApp('sonde-l', /l-langue\//, frame);
await waitFor('le contexte de la sonde', async () => (await probe(app)).contextes.length >= 1);
let seen = await probe(app);
check('l\'app ouverte dans la langue de Grist reçoit cette langue dans l\'adresse de son cadre et dans son contexte, sans événement', seen.adresse === lang && seen.contextes[0].langue === lang && seen.evenements.length === 0, seen);
await frame.locator('#floater-files').click();
await frame.locator('.ex').waitFor({ state: 'visible' });
await choose(NAMES[other]);
await waitFor('l\'événement langue', async () => (await probe(app)).evenements.length === 1);
await waitFor('le contexte redemandé', async () => (await probe(app)).contextes.length === 2);
seen = await probe(app);
say('ce que la sonde a reçu :', seen);
check('le changement de langue arrive à l\'app ouverte par l\'événement `langue` ({ langue }), une seule fois', seen.evenements.length === 1 && JSON.stringify(seen.evenements[0]) === JSON.stringify({ langue: other }), seen.evenements);
check('une app qui redemande son contexte (un rechargement de sa part) reçoit la nouvelle langue', seen.contextes[1].langue === other, seen.contextes);
check('GFS n\'a pas touché au cadre de l\'app : le même cadre, la même adresse (qui garde la langue de départ), un seul cadre', !app.isDetached() && seen.adresse === lang && page.frames().filter(f => /l-langue\//.test(f.url())).length === 1, { detached: app.isDetached(), adresse: seen.adresse });
await frame.locator('.ex-foot .btn', { hasText: new RegExp(`^${wordsOther.close}$`) }).click();
await frame.locator('#floaters').waitFor({ state: 'visible' });
const floaters = await frame.evaluate(() => { const b = document.querySelector('#floater-files'); return { text: b.textContent.trim(), filesTip: b.title, label: b.getAttribute('aria-label') }; });
check('les repères au-dessus de l\'app suivent la langue (le nom du bouton « Fichiers » est son info-bulle et son nom accessible : il n\'a pas d\'autre texte)', floaters.text === '' && floaters.filesTip === wordsOther.filesTip && floaters.label === wordsOther.filesTip, floaters);
await frame.locator('#floater-files').click();
await frame.locator('.ex').waitFor({ state: 'visible' });
await chooseAuto();
await waitFor('le second événement', async () => (await probe(app)).evenements.length === 2);
seen = await probe(app);
check('revenir à « comme Grist » prévient aussi l\'app', seen.evenements.length === 2 && seen.evenements[1].langue === lang && seen.contextes.at(-1).langue === lang, { evenements: seen.evenements, contextes: seen.contextes });
// Choisir la langue que Grist donne déjà : le choix change, la langue non, l'app n'a rien à apprendre.
await choose(NAMES[lang]);
await page.waitForTimeout(600);
seen = await probe(app);
check('choisir la langue que Grist donne déjà est retenu mais n\'envoie rien à l\'app', (await stored()) === lang && seen.evenements.length === 2, { stored: await stored(), evenements: seen.evenements.length });
await chooseAuto();
await page.waitForTimeout(400);
check('et revenir à « comme Grist » n\'envoie rien non plus', (await stored()) === null && (await probe(app)).evenements.length === 2);
// Une app ouverte après le choix : elle le reçoit dès le départ (adresse et contexte), sans événement.
await choose(NAMES[other]);
await reload();
app = await lab.openApp('sonde-l', /l-langue\//, frame);
await waitFor('le contexte de la sonde rouverte', async () => (await probe(app)).contextes.length >= 1);
seen = await probe(app);
check('une app ouverte après le choix reçoit la langue choisie dès le départ (adresse et contexte), non celle de Grist', seen.adresse === other && seen.contextes[0].langue === other && seen.evenements.length === 0, seen);
await frame.locator('#floater-files').click();
await frame.locator('.ex').waitFor({ state: 'visible' });
await chooseAuto();

// ---------- 6. un navigateur qui refuse de retenir ----------
await frame.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); }; });
await choose(NAMES[other]);
await page.waitForTimeout(300);
now = await screen();
const toast = await frame.evaluate(() => { const node = document.querySelector('#toast'); return { hidden: node.hidden, text: node.textContent.trim() }; });
check('si le navigateur refuse, le choix vaut pour la page (GFS passe dans la langue choisie)', now.html === other && now.title === wordsOther.title, { html: now.html, title: now.title });
check('et GFS le dit, dans la langue choisie', !toast.hidden && toast.text === wordsOther.notKept, toast);
check('rien n\'a été retenu', (await stored()) === null, await stored());
await shot('5-non-retenu');
await reload();
check('rechargé, GFS repart dans la langue de Grist (le choix n\'a pas été gardé)', (await screen()).html === lang);

// ---------- 7. une autre section de GFS (ou un autre onglet) change la clé ----------
// Deux sections de GFS dans la même page partagent le `localStorage` de GFS : le navigateur dit à l'une, par l'événement `storage`, que l'autre a écrit. (Mesuré dans ce labo : une page de
// l'origine de GFS ouverte seule dans un second onglet ne partage pas le stockage du cadre, la clé écrite par l'un n'est pas vue par l'autre ; d'où deux sections.) Grist recharge la première
// section quand on en ajoute une (run-section-ajoutee).
const WIDGET = 'http://127.0.0.1:8911/prototype/index.html';
const warningsBefore = warnings.length; // la seconde section n'a pas l'accès au document : GFS le dit en console, sans rapport avec la langue
await lab.addSection(`${WIDGET}?language=${lang}&culture=${lang === 'en' ? 'en-GB' : 'fr-FR'}`);
let sections = [];
for (let i = 0; i < 80 && sections.length < 2; i++) { sections = page.frames().filter(f => f.url().startsWith(WIDGET)); await page.waitForTimeout(500); }
for (const section of sections) await lab.gfsReady(section);
check('la page porte deux sections de GFS', sections.length === 2, sections.map(f => f.url().slice(-60)));
const mine = sections.find(f => /access=full/.test(f.url())) || sections[0];
const sibling = sections.find(f => f !== mine);
frame = mine;
const shape = await Promise.all(sections.map(async f => ({ access: /access=(\w+)/.exec(f.url())[1], box: await (await f.frameElement()).boundingBox(), lang: await f.evaluate(() => document.documentElement.lang) })));
say('les deux sections :', shape);
await chooseLanguage(sibling, NAMES[other]);
const followed = await waitFor('GFS suit l\'autre section', async () => (await screen()).html === other);
now = await screen();
check('une autre section change le choix : GFS suit sans rechargement (événement `storage` du navigateur)', followed && now.title === wordsOther.title && now.settingsLabel === wordsOther.settingsTip, { html: now.html, title: now.title });
check('l\'autre section est passée dans la langue choisie elle aussi', (await sibling.evaluate(() => document.documentElement.lang)) === other);
await shot('6-section-suivie');
await frame.locator('.ex-title-row .tb[aria-haspopup="dialog"]:not([hidden])').click();
await frame.locator('.mod').waitFor();
check('la fenêtre « Apps et extensions » s\'ouvre dans la langue qui vaut', (await frame.locator('#mod-title').textContent()) === wordsOther.appsTitle);
await shot('7-fenetre-apps');
await chooseLanguage(sibling, null);
await waitFor('la fenêtre ouverte suit', async () => (await frame.locator('#mod-title').textContent()) === words.appsTitle);
check('la fenêtre ouverte suit aussi, sans se fermer, quand l\'autre section revient à « comme Grist »', (await frame.locator('#mod-title').textContent()) === words.appsTitle && (await frame.locator('.mod').count()) === 1 && (await screen()).html === lang && (await stored()) === null);

check('aucun avertissement de GFS (texte inconnu, refus) pendant la passe, ni « texte inconnu » ensuite', warnings.slice(0, warningsBefore).length === 0 && !warnings.some(text => /texte inconnu/.test(text)), warnings.map(text => text.slice(0, 120)));
await lab.browser.close();
