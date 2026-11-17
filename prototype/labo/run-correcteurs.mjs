// Le bouton « LanguageTool » de la barre (demande du porteur, 12/11 ; contrats 5.2, point 13 ; faits vérifiés 104), dans un vrai Grist (grist-static), à 700 × 400, à la vraie souris et au vrai clavier
// (Playwright : événements du pointeur et du clavier du navigateur, jamais dispatchEvent). LAB_LANG=fr|en est la langue de Grist, LAB_SCHEME=light|dark, LAB_W la largeur du panneau (700).
// Un correcteur du navigateur (LanguageTool) juge chaque cadre d'après sa propre adresse : son interrupteur « pour ce site » ne coupe rien dans une app. GFS retient deux choix de la personne et
// les dit à l'app (`contexte.correcteurs` et événement `correcteurs`) ; la sonde ZL (labo/sondes/z-correcteurs/) fait ce que fera le kit : elle pose `data-lt-active="false"` sur ses zones de texte.
// `LAB_KIT=1` rejoue la même passe avec la sonde ZL kit (le vrai `Correcteurs.start()` du kit, branché sur le vrai `GfsLink`) et ajoute les zones qui naissent après (un `MutationObserver` réel) : 35 vérifications.
// Ce que la passe mesure :
//   1. le départ : rien n'est retenu, le bouton n'est pas dans la barre, le menu « Réglages » n'a pas de ligne LanguageTool mais « Réglages avancés », dont le sous-menu a « Bouton LanguageTool » (non cochée, avec son info-bulle) ; l'app reçoit `coupes: false`
//      dans son contexte, sans événement, et ses zones ne portent aucune marque ;
//   2. la ligne cochée à la souris : le bouton paraît dans la barre (enfoncé : LanguageTool travaille), GFS retient `gfs.langtool`, l'app n'apprend rien (rien n'est coupé) ;
//   3. le bouton à la souris : LanguageTool est coupé (relevé), `gfs.correcteurs` est retenue, l'app reçoit l'événement une seule fois et marque ses trois zones, sans que son cadre soit rechargé ;
//   4. le bouton au clavier (Espace, Entrée) : il rallume puis coupe, l'app suit à chaque fois, le nom du bouton dit l'état ;
//   5. GFS rechargé : le bouton revient dans l'état retenu, une app ouverte ensuite reçoit `coupes: true` dès le départ (contexte), sans événement ;
//   6. la ligne décochée alors que c'est coupé : le bouton disparaît, l'app reçoit `coupes: false` (rien n'est coupé sans bouton), le choix de couper est gardé et revient avec le bouton ;
//   7. un navigateur qui refuse de retenir : le choix vaut pour la page, GFS le dit ;
//   8. la barre tient dans le panneau, les boutons ne se chevauchent pas, le bouton a la taille des autres ; aucun avertissement de GFS.
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check } from './lab-common.mjs';
import { collectWarnings, waiter, reopenGfs } from './lab-gestes.mjs';
import { openSettings, openAdvancedMenu, settingsRows, subRows, ROW } from './reglages-gestes.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const panelWidth = Number(process.env.LAB_W || 700);
// LAB_KIT=1 : la sonde ZL kit (`kit.html`), qui coupe les correcteurs par le VRAI module du kit (`Correcteurs.start()`, le sous-module `prototype/kit`) au lieu de poser la marque à la main.
const KIT = process.env.LAB_KIT === '1';
const PROBE = KIT ? 'sonde-zlk' : 'sonde-zl';
const run = `correcteurs${KIT ? '-kit' : ''}-${lang}-${scheme}${panelWidth === 700 ? '' : `-${panelWidth}`}`;
// Ce que le labo cherche à l'écran, dans chaque langue (les textes de js/i18n/i18n.js).
const WORDS = {
  fr: { close: 'Fermer', advanced: 'Réglages avancés', row: 'Bouton LanguageTool', rowTip: 'Un bouton de la barre coupe ou rallume LanguageTool dans l’app ouverte', on: 'LanguageTool travaille dans les apps (un clic le coupe)',
    off: 'LanguageTool est coupé dans les apps (un clic le rallume)', notKept: 'Ce choix ne sera pas gardé : votre navigateur refuse l’enregistrement.' },
  en: { close: 'Close', advanced: 'Advanced settings', row: 'LanguageTool button', rowTip: 'A button in the bar turns LanguageTool off or back on in the open app', on: 'LanguageTool is working in the apps (click to turn it off)',
    off: 'LanguageTool is turned off in the apps (click to turn it back on)', notKept: 'This choice will not be kept: your browser refuses to store it.' },
};
const words = WORDS[lang];

const lab = await startLab({ lang, colorScheme: scheme, probes: true });
const { page } = lab;
const warnings = collectWarnings(page);
await lab.fitPanel(undefined, panelWidth, 400);
say('semis :', await seedFiles(lab.frame));
let frame = await reopenGfs(lab);
const shot = name => lab.shotPanel(run, name, frame);
const waitFor = waiter(page, 60);
const reload = async () => { frame = await reopenGfs(lab, frame, 500); };

const stored = key => frame.evaluate(name => { try { return localStorage.getItem(name); } catch (error) { return 'REFUSÉ'; } }, key);
const probe = app => app.evaluate(() => ({ contextes: [], evenements: [], marques: null, ...JSON.parse((document.body && document.body.dataset.sonde) || '{}') }));
// Les trois zones de la sonde (un contenteditable, un champ, une zone de texte) portent toutes la même marque : `value` (la chaîne « false », ou `null` quand l'attribut est absent).
const same = (found, value) => Boolean(found) && ['e1', 'i1', 't1'].every(id => found[id] === value) && Object.keys(found).length === 3;
const lt = () => frame.locator('#floater-lt');
const ltState = () => frame.evaluate(() => {
  const node = document.getElementById('floater-lt');
  const rect = node.getBoundingClientRect();
  return { hidden: node.hidden, pressed: node.getAttribute('aria-pressed'), title: node.title, label: node.getAttribute('aria-label'), text: node.textContent.trim(), focused: document.activeElement === node,
    width: Math.round(rect.width), height: Math.round(rect.height), icon: Boolean(node.querySelector('svg')) };
});
// La ligne « Bouton LanguageTool » du sous-menu « Réglages avancés » (menu « Réglages » → « Réglages avancés ») : le sous-menu est ouvert (explorateur ouvert), la ligne se lit puis se clique à la vraie souris.
const settingsRow = () => subRows(frame).first();
const rowState = () => settingsRow().evaluate(node => ({ text: node.querySelector('.menu-label').textContent.trim(), checked: node.getAttribute('aria-checked'), role: node.getAttribute('role'), title: node.title }));
const clickRow = async () => { await openAdvancedMenu(frame); await settingsRow().click(); await frame.locator('.menu').waitFor({ state: 'detached' }); };
// Entre l'explorateur et l'app : « Fermer » rend l'app et la barre, le bouton « Fichiers » rend l'explorateur.
const showApp = async () => {
  await frame.locator('.ex-foot .btn', { hasText: new RegExp(`^${words.close}$`) }).click();
  await frame.locator('#floaters').waitFor({ state: 'visible' });
};
const showExplorer = async () => {
  await frame.locator('#floater-files').click();
  await frame.locator('.ex').waitFor({ state: 'visible' });
};

// ---------- 1. le départ ----------
check('rien n\'est retenu tant que la personne n\'a rien choisi', (await stored('gfs.langtool')) === null && (await stored('gfs.correcteurs')) === null);
await openSettings(frame);
const rows = await frame.evaluate(() => [...document.querySelectorAll('.menu:not(.menu-sub) .menu-item')].map(node => node.querySelector('.menu-label').textContent.trim()));
say('lignes du menu « Réglages » :', rows);
check('le menu « Réglages » a cinq lignes et aucune ne nomme LanguageTool : « Réglages avancés » est entre « Thème » et « Position de la barre »', rows.length === 5 && rows[ROW.advanced] === words.advanced && !rows.some(text => /LanguageTool/.test(text)), rows);
await settingsRows(frame).nth(ROW.advanced).click();
await frame.locator('.menu-sub').waitFor();
const subNames = await subRows(frame).evaluateAll(nodes => nodes.map(node => node.querySelector('.menu-label').textContent.trim()));
check('« Réglages avancés » n\'a que « Bouton LanguageTool », non coché, avec son info-bulle', subNames.length === 1 && subNames[0] === words.row, subNames);
let row = await rowState();
check('la ligne est une case à cocher (rôle et état dits au lecteur d\'écran), décochée, et son info-bulle dit ce qu\'elle fait', row.role === 'menuitemcheckbox' && row.checked === 'false' && row.title === words.rowTip, row);
const menuBox = await frame.evaluate(() => { const box = document.querySelector('.menu-sub').getBoundingClientRect(); const main = document.querySelector('.menu:not(.menu-sub)').getBoundingClientRect(); return { right: Math.round(Math.max(box.right, main.right)), bottom: Math.round(Math.max(box.bottom, main.bottom)), view: [window.innerWidth, window.innerHeight] }; });
check('le menu et son sous-menu tiennent dans le panneau de 700 × 400', menuBox.right <= menuBox.view[0] && menuBox.bottom <= menuBox.view[1], menuBox);
await shot('1-menu');
await page.keyboard.press('Escape');

let app = await lab.openApp(PROBE, /z-correcteurs\//, frame);
await waitFor('le contexte de la sonde', async () => (await probe(app)).contextes.length >= 1);
let seen = await probe(app);
say('ce que la sonde a reçu au départ :', seen);
check('l\'app reçoit « correcteurs coupés : non » dans son contexte, sans événement, et ses trois zones ne portent aucune marque', JSON.stringify(seen.contextes) === JSON.stringify([{ coupes: false }])
  && seen.evenements.length === 0 && same(seen.marques, null), seen);
check('le bouton n\'est pas dans la barre (l\'espace est celui des cinq autres)', (await ltState()).hidden === true);

// ---------- 2. la ligne cochée ----------
await showExplorer();
await clickRow();
check('la ligne cochée : GFS retient `gfs.langtool`, pas `gfs.correcteurs`', (await stored('gfs.langtool')) === 'oui' && (await stored('gfs.correcteurs')) === null);
await openAdvancedMenu(frame);
row = await rowState();
check('la ligne est cochée au menu suivant', row.checked === 'true', row);
await shot('2-menu-coche');
await page.keyboard.press('Escape');
await showApp();
let button = await ltState();
say('le bouton :', button);
check('le bouton paraît dans la barre : enfoncé (LanguageTool travaille), son nom et son info-bulle disent l\'état, une icône, aucun autre texte',
  !button.hidden && button.pressed === 'true' && button.title === words.on && button.label === words.on && button.text === '' && button.icon, button);
await page.waitForTimeout(500);
seen = await probe(app);
check('l\'app n\'apprend rien : rien n\'est coupé, elle n\'a reçu aucun événement et ses zones ne portent aucune marque', seen.evenements.length === 0 && same(seen.marques, null), seen);
await shot('2-bouton-enfonce');

// ---------- 3. le bouton à la souris ----------
await lt().click();
await waitFor('l\'événement correcteurs', async () => (await probe(app)).evenements.length === 1);
seen = await probe(app);
button = await ltState();
say('après le clic :', { seen, button });
check('un clic coupe LanguageTool : le bouton se relève, son nom dit « coupé », `gfs.correcteurs` est retenue', button.pressed === 'false' && button.title === words.off && button.label === words.off && (await stored('gfs.correcteurs')) === 'oui', button);
check('l\'app reçoit l\'événement `correcteurs` ({ correcteurs: { coupes: true } }) une seule fois et marque ses trois zones de texte `data-lt-active="false"`',
  seen.evenements.length === 1 && JSON.stringify(seen.evenements[0]) === JSON.stringify({ correcteurs: { coupes: true } }) && same(seen.marques, 'false'), seen);
const attrs = await app.evaluate(() => ['e1', 'i1', 't1'].map(id => document.getElementById(id).getAttribute('data-lt-active')));
check('la marque est bien sur chacun des éléments éditables eux-mêmes (le contenteditable, le champ, la zone de texte), non sur un parent', JSON.stringify(attrs) === JSON.stringify(['false', 'false', 'false']), attrs);
if (KIT) {
  await app.evaluate(() => window.addZone('late'));
  await waitFor('les zones qui naissent ensuite', async () => (await app.evaluate(() => window.readZone('late-area'))) === 'false');
  const zones = await app.evaluate(() => ['late-dialog', 'late-area', 'late-editor', 'secret', 'wrap'].map(id => window.readZone(id)));
  check('le kit marque les zones qui naissent ensuite (une fenêtre ouverte après le clic : sa zone de texte et son éditeur), jamais la fenêtre, le conteneur ni le mot de passe', JSON.stringify(zones) === JSON.stringify([null, 'false', 'false', null, null]), zones);
}
check('GFS n\'a pas touché au cadre de l\'app : le même cadre, un seul cadre', !app.isDetached() && page.frames().filter(f => /z-correcteurs\//.test(f.url())).length === 1);
check('le bouton garde la taille des autres boutons de la barre (28 × 28)', button.width === 28 && button.height === 28, button);
await shot('3-bouton-releve');

// ---------- 4. le bouton au clavier ----------
await lt().focus();
await page.keyboard.press('Space');
await waitFor('le second événement', async () => (await probe(app)).evenements.length === 2);
seen = await probe(app);
button = await ltState();
check('au clavier, Espace rallume : le bouton est enfoncé, le clavier y reste, l\'app reçoit `coupes: false` et retire les marques',
  button.pressed === 'true' && button.focused && seen.evenements[1].correcteurs.coupes === false && same(seen.marques, null), { button, evenements: seen.evenements, marques: seen.marques });
check('et `gfs.correcteurs` est retirée (le choix par défaut ne se retient pas)', (await stored('gfs.correcteurs')) === null, await stored('gfs.correcteurs'));
await page.keyboard.press('Enter');
await waitFor('le troisième événement', async () => (await probe(app)).evenements.length === 3);
seen = await probe(app);
button = await ltState();
check('au clavier, Entrée coupe de nouveau : le bouton est relevé, l\'app marque ses zones', button.pressed === 'false' && button.focused && seen.evenements[2].correcteurs.coupes === true && same(seen.marques, 'false'), { button, marques: seen.marques });

// ---------- 5. GFS rechargé ----------
await reload();
check('GFS rechargé : les deux choix sont retenus', (await stored('gfs.langtool')) === 'oui' && (await stored('gfs.correcteurs')) === 'oui');
app = await lab.openApp(PROBE, /z-correcteurs\//, frame);
await waitFor('le contexte de la sonde rouverte', async () => (await probe(app)).contextes.length >= 1);
seen = await probe(app);
check('une app ouverte après le choix reçoit `coupes: true` dès le départ (contexte), sans événement, et marque ses zones tout de suite', JSON.stringify(seen.contextes) === JSON.stringify([{ coupes: true }])
  && seen.evenements.length === 0 && same(seen.marques, 'false'), seen);
button = await ltState();
check('le bouton est là, relevé (coupé), comme on l\'a laissé', !button.hidden && button.pressed === 'false' && button.title === words.off, button);

// ---------- 6. la ligne décochée alors que c'est coupé ----------
await showExplorer();
await clickRow();
await waitFor('l\'événement de la ligne décochée', async () => (await probe(app)).evenements.length === 1);
seen = await probe(app);
button = await ltState();
check('décochée, la ligne retire le bouton ; sans bouton rien n\'est coupé : l\'app reçoit `coupes: false` et retire ses marques', button.hidden && seen.evenements[0].correcteurs.coupes === false
  && same(seen.marques, null), { button, seen });
check('GFS retire `gfs.langtool` mais garde le choix de couper (`gfs.correcteurs`)', (await stored('gfs.langtool')) === null && (await stored('gfs.correcteurs')) === 'oui');
await clickRow();
await waitFor('l\'événement de la ligne recochée', async () => (await probe(app)).evenements.length === 2);
seen = await probe(app);
button = await ltState();
check('recochée, le bouton revient dans l\'état gardé (relevé) et l\'app est prévenue de nouveau', !button.hidden && button.pressed === 'false' && seen.evenements[1].correcteurs.coupes === true
  && same(seen.marques, 'false'), { button, seen });
await showApp();
const bar = await frame.evaluate(() => {
  const root = document.getElementById('floaters').getBoundingClientRect();
  const nodes = [...document.querySelectorAll('#floaters .floater:not([hidden])')].map(node => { const r = node.getBoundingClientRect(); return { id: node.id, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; });
  const overlaps = nodes.filter((a, i) => nodes.some((b, j) => j !== i && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h));
  return { root: { x: Math.round(root.x), y: Math.round(root.y), w: Math.round(root.width), h: Math.round(root.height) }, nodes: nodes.map(node => node.id), overlaps, view: [window.innerWidth, window.innerHeight],
    sameSize: nodes.every(node => node.w === 28 && node.h === 28) };
});
say('la barre :', bar);
check('la barre à six boutons tient dans le panneau de 700 × 400, ils ne se chevauchent pas et ont tous la taille de 28 px', bar.nodes.length === 6 && bar.overlaps.length === 0 && bar.sameSize
  && bar.root.x >= 0 && bar.root.y >= 0 && bar.root.x + bar.root.w <= bar.view[0] && bar.root.y + bar.root.h <= bar.view[1], bar);
await shot('4-barre-six-boutons');

// ---------- 7. un navigateur qui refuse de retenir ----------
await lt().click(); // rallume, pour repartir de « enfoncé » avant le refus
await waitFor('le rallumage', async () => (await probe(app)).evenements.length === 3);
await showExplorer();
await clickRow(); // décoche : la ligne repart de « absente »
await frame.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); }; });
await clickRow();
await page.waitForTimeout(300);
const toast = await frame.evaluate(() => { const node = document.querySelector('#toast'); return { hidden: node.hidden, text: node.textContent.trim() }; });
button = await ltState();
check('si le navigateur refuse, le choix vaut pour la page (le bouton paraît) et GFS le dit', !button.hidden && !toast.hidden && toast.text === words.notKept, { button, toast });
check('rien n\'a été retenu', (await stored('gfs.langtool')) === null, await stored('gfs.langtool'));
await showApp();
await lt().click();
await page.waitForTimeout(300);
const toast2 = await frame.evaluate(() => { const node = document.querySelector('#toast'); return { hidden: node.hidden, text: node.textContent.trim() }; });
seen = await probe(app);
button = await ltState();
check('et le bouton aussi : le clic coupe pour la page, l\'app est prévenue, GFS dit que ce n\'est pas gardé', button.pressed === 'false' && seen.evenements.at(-1).correcteurs.coupes === true && !toast2.hidden && toast2.text === words.notKept, { button, toast2 });
await shot('5-non-retenu');

check('aucun avertissement de GFS (texte inconnu, refus) pendant la passe', !warnings.some(text => /texte inconnu/.test(text)) && warnings.length === 0, warnings.map(text => text.slice(0, 120)));
await lab.browser.close();
