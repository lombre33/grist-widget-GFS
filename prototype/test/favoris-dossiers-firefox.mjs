// Les dossiers en favori de l'explorateur sous Firefox (demande du porteur du 27/11, « mettre des dossiers et des espaces en favori » ; choix : « Dans Favoris, avant les fichiers » ; lot 1, les dossiers de
// « Moi » ; règle du 03/11 : toute nouvelle interface ajoute ses mesures à test/interfaces-firefox.test.mjs). Les gestes se font à la vraie souris et au vrai clavier de Firefox, sur la page d'essai
// (test/pages/explorateur.js : le vrai explorateur, le vrai `Filing`, un rangement de doublure qui tient les dossiers gardés et ceux en favori) : l'épingle de la ligne d'un dossier (au survol, au clic), l'article
// « Épingler en favori » du menu (et « Retirer des favoris » une fois épinglé), « Favoris » (les dossiers avant les fichiers, le dossier du dessus à côté du nom, le compte du volet), Entrée et le double clic qui
// ouvrent le dossier, l'épingle qui le retire de « Favoris », Ctrl+Z, et les espaces (l'article grisé, qui dit pourquoi ; pas d'épingle sur la ligne). Ce que chaque geste écrit est dans test/favoris-dossiers.test.mjs.
import { createI18n } from '../js/i18n/i18n.js';
import { Run, centerOfName, delay, names } from './corbeille-firefox.mjs';
import { centerOfMenuItem, menuFits } from './copier-firefox.mjs';

const FAV = '.tr-row[data-view="fav"]';

// ---------- ce qui s'exécute dans la page (rien du module n'y est visible) ----------

// Le bouton d'une ligne (`selector`, relatif à la ligne qui porte ce nom) : son centre à l'écran, sa taille, s'il se voit, et s'il est allumé.
function buttonOf(name, selector) {
  const row = [...document.querySelectorAll('.ls-row')].find(item => (item.querySelector('.t') || {}).textContent === name);
  const button = row && row.querySelector(selector);
  if (!button) return null;
  const box = button.getBoundingClientRect();
  const rowBox = row.getBoundingClientRect();
  const sibling = row.querySelector('.rb.mn');
  const next = sibling && sibling !== button ? sibling.getBoundingClientRect() : null;
  return {
    at: [box.left + box.width / 2, box.top + box.height / 2], width: Math.round(box.width), height: Math.round(box.height), opacity: Number(getComputedStyle(button).opacity),
    inRow: box.left >= rowBox.left && box.right <= rowBox.right + 1 && box.top >= rowBox.top - 1 && box.bottom <= rowBox.bottom + 1, apart: next ? next.left >= box.right - 0.5 : true,
    pressed: button.getAttribute('aria-pressed'), label: button.getAttribute('aria-label'), title: button.getAttribute('title'),
  };
}

// Le compte de « Favoris » dans le volet, et si « Moi » y reste visible (à 700 × 400, le volet ne doit pas pousser « Moi » sous le bas).
const favCount = () => { const row = document.querySelector('.tr-row[data-view="fav"] .cnt'); return row ? row.textContent.trim() : null; };

// Ce que « Favoris » montre : pour chaque ligne son nom, si c'est un dossier, le mot du dossier du dessus, et si le nom et ce mot tiennent dans leur cellule.
function favoriteRows() {
  return [...document.querySelectorAll('.ls-row')].map(row => {
    const name = row.querySelector('.t');
    const hint = row.querySelector('.hint');
    const cell = row.querySelector('.nm');
    const cellBox = cell.getBoundingClientRect();
    const inside = node => { const box = node.getBoundingClientRect(); return box.width === 0 || (box.left >= cellBox.left - 1 && box.right <= cellBox.right + 1); };
    return { name: name.textContent, folder: row.classList.contains('folder'), hint: hint ? hint.textContent : null, hintTitle: hint ? hint.getAttribute('title') : null,
      fits: inside(name) && (!hint || inside(hint)) && !(hint && name.getBoundingClientRect().right > hint.getBoundingClientRect().left + 1) };
  });
}

// Le mot de l'article dont le nom est `label` dans le menu ouvert : grisé ou non, et sa position (le premier, le deuxième, …).
const menuIndex = label => [...document.querySelectorAll('.menu .menu-item')].findIndex(node => ((node.querySelector('.menu-label') || {}).textContent || '').trim() === label);

// ---------- la conduite ----------

// La ligne d'un dossier : son épingle, mesurée ; rend { at, … } ou null (avec un écart).
async function pinOf(run, name, kind) {
  const button = await run.page.run(buttonOf, name, '.rb.pin');
  if (!button) { run.note(kind, `la ligne « ${name} » devait avoir son épingle`); return null; }
  return button;
}

// Au survol, l'épingle d'un dossier se montre, tient dans la ligne à côté de « Plus d'actions », et un clic l'allume : la ligne d'état est écrite, « Favoris » compte un de plus.
async function pinFromRow(run, t) {
  await run.reset();
  const before = await run.page.run(favCount);
  const hidden = await pinOf(run, 'Formation', 'épingle d\'un dossier');
  if (!hidden) return;
  if (hidden.pressed !== 'false' || hidden.label !== t('ex.pin')) run.note('épingle d\'un dossier', `l'épingle d'un dossier non épinglé devait dire « ${t('ex.pin')} » et n'être pas allumée (${hidden.label}, ${hidden.pressed})`);
  await run.page.move(...hidden.at);
  await delay(120);
  const shown = await run.page.run(buttonOf, 'Formation', '.rb.pin');
  if (shown.opacity < 1) run.note('épingle d\'un dossier', `au survol, l'épingle devait se voir (opacité ${shown.opacity})`);
  if (shown.width < 24 || shown.height < 24 || !shown.inRow || !shown.apart) run.note('épingle d\'un dossier', `l'épingle devait faire 24 px au moins, tenir dans la ligne et ne pas toucher « Plus d'actions » (${JSON.stringify(shown)})`);
  await run.page.click(...shown.at);
  await run.expect('épingler un dossier', 'le clic sur l\'épingle devait écrire la ligne « pin:Formation » (rien d\'autre) sans rien dire', now => now.filing.join() === 'setFiling:pin:Formation' && now.notices.length === 0);
  const lit = await run.page.run(buttonOf, 'Formation', '.rb.pin');
  if (!lit || lit.pressed !== 'true' || lit.label !== t('ex.unpin') || lit.opacity < 1) run.note('épingler un dossier', `l'épingle devait être allumée, toujours visible, et dire « ${t('ex.unpin')} » (${JSON.stringify(lit)})`);
  const count = await run.page.run(favCount);
  if (Number(count || 0) !== Number(before || 0) + 1) run.note('compte de « Favoris »', `le volet devait compter un favori de plus (avant « ${before} », après « ${count} »)`);
  await run.page.click(...lit.at);
  await run.expect('retirer l\'épingle', 'un second clic devait retirer le dossier des favoris : « unpin:Formation », l\'épingle éteinte', now => now.filing.join() === 'setFiling:pin:Formation,setFiling:unpin:Formation');
}

// L'article du menu d'un dossier, juste après « Ouvrir le dossier » : « Épingler en favori », puis « Retirer des favoris ».
async function pinFromMenu(run, t) {
  await run.reset();
  const at = await run.page.run(centerOfName, 'Formation');
  await run.page.rightClick(...at);
  await run.expect('menu d\'un dossier', 'le menu devait s\'ouvrir', state => state.menu.length > 0);
  const place = await run.page.run(menuIndex, t('ex.pin'));
  const open = await run.page.run(menuIndex, t('ex.openFolder'));
  if (place < 0 || open < 0 || place !== open + 1) run.note('menu d\'un dossier', `« ${t('ex.pin')} » devait suivre « ${t('ex.openFolder')} » (rangs ${place} et ${open})`);
  const fits = await run.page.run(menuFits);
  if (fits.length) run.note('menu d\'un dossier', `le menu devait tenir dans la page, ses touches à l'écart de leur nom (${fits.join(' ; ')})`);
  const entry = (await run.snap()).menu.find(item => item.label === t('ex.pin'));
  if (!entry || entry.greyed) run.note('menu d\'un dossier', `« ${t('ex.pin')} » devait être dégrisé pour un dossier de « Moi »`);
  await run.page.click(...await run.page.run(centerOfMenuItem, t('ex.pin')));
  await run.expect('épingler par le menu', 'l\'article devait épingler « Formation » et fermer le menu', state => state.filing.join() === 'setFiling:pin:Formation' && state.menu.length === 0);
  await run.page.rightClick(...await run.page.run(centerOfName, 'Formation'));
  await run.expect('menu d\'un dossier épinglé', `l'article devait devenir « ${t('ex.unpin')} »`, state => state.menu.some(item => item.label === t('ex.unpin')) && !state.menu.some(item => item.label === t('ex.pin')));
  await run.page.click(...await run.page.run(centerOfMenuItem, t('ex.unpin')));
  await run.expect('retirer par le menu', 'l\'article devait retirer « Formation » des favoris', state => state.filing.length === 2 && state.filing[1] === 'setFiling:unpin:Formation' && state.menu.length === 0);
}

// « Favoris » : les dossiers d'abord (par nom), puis les fichiers ; un sous-dossier dit son dossier du dessus ; le volet compte le tout ; rien n'est coupé sans son texte entier au survol.
async function listed(run, t) {
  await run.reset();
  await run.page.run(() => { window.__pin('Formation', 'Formation/Sous'); window.__pinFile('Main'); });
  const count = await run.page.run(favCount);
  if (count !== '3') run.note('compte de « Favoris »', `le volet devait compter deux dossiers et un fichier : « 3 » (« ${count} »)`);
  await run.clickSelector(FAV);
  const state = await run.expect('« Favoris »', 'la vue devait lister « Formation » et « Sous » (dossiers) avant « Main » (fichier)', now => names(now).join() === 'Formation,Sous,Main' && now.crumbs.includes(t('ex.fav')));
  if (state.cut.length) run.note('texte coupé sans info-bulle', `des textes de « Favoris » sont coupés sans leur texte entier au survol : ${state.cut.slice(0, 3).join(' ; ')}`);
  const rows = await run.page.run(favoriteRows);
  const sous = rows.find(row => row.name === 'Sous');
  if (!sous || sous.hint !== 'Formation' || sous.hintTitle !== 'Formation') run.note('dossier du dessus', `« Sous » devait dire son dossier du dessus, « Formation » (${JSON.stringify(sous)})`);
  const root = rows.find(row => row.name === 'Formation');
  if (!root || root.hint !== null) run.note('dossier du dessus', `« Formation » est à la racine : rien à dire à côté de son nom (${JSON.stringify(root)})`);
  const cramped = rows.filter(row => !row.fits);
  if (cramped.length) run.note('nom et dossier du dessus', `le nom et le dossier du dessus devaient tenir dans leur cellule sans se chevaucher (${JSON.stringify(cramped)})`);
  if (rows.map(row => row.folder).join() !== 'true,true,false') run.note('ordre', `les dossiers devaient venir avant les fichiers (${rows.map(row => row.folder).join()})`);
  const pin = await run.page.run(buttonOf, 'Sous', '.rb.pin');
  if (!pin || pin.pressed !== 'true') run.note('épingle dans « Favoris »', `l'épingle d'un dossier de « Favoris » devait être allumée (${JSON.stringify(pin)})`);
  // la recherche garde les dossiers qui répondent : « sous » ne garde que « Sous »
  await run.click('Main');
  await run.page.press('/');
  await run.page.press(...'sous'.split(''));
  await run.expect('recherche dans « Favoris »', 'la recherche « sous » devait garder « Sous » seul', now => names(now).join() === 'Sous');
  await run.page.press('Escape');
  await run.expect('fin de la recherche', 'Échap devait vider la recherche', now => now.search === '' && names(now).length === 3);
}

// Entrée et le double clic ouvrent le dossier favori : son contenu, son fil d'Ariane ; Retour arrière ramène au dossier du dessus.
async function opening(run, t) {
  await run.reset();
  await run.page.run(() => window.__pin('Formation'));
  await run.clickSelector(FAV);
  await run.expect('« Favoris »', 'le dossier devait être listé', state => names(state).join() === 'Formation');
  await run.click('Formation');
  await run.page.press('Enter');
  await run.expect('Entrée sur un dossier favori', 'Entrée devait ouvrir « Formation » : ses deux fichiers, le fil d\'Ariane de « Moi »', state => state.crumbs.includes('Formation') && !state.crumbs.includes(t('ex.fav')) && names(state).length === 2);
  await run.clickSelector(FAV);
  await run.expect('retour dans « Favoris »', 'la vue « Favoris » devait revenir', state => names(state).join() === 'Formation');
  const at = await run.page.run(centerOfName, 'Formation');
  await run.page.doubleClick(...at);
  await run.expect('double clic sur un dossier favori', 'le double clic devait ouvrir « Formation »', state => state.crumbs.includes('Formation') && names(state).length === 2);
}

// Dans « Favoris », l'épingle retire le dossier de la liste, la phrase le dit, Ctrl+Z le remet ; le compte du volet suit.
async function unpinHere(run) {
  await run.reset();
  await run.page.run(() => { window.__pin('Formation'); window.__pinFile('Main'); });
  await run.clickSelector(FAV);
  await run.expect('« Favoris »', 'le dossier et le fichier devaient être listés', state => names(state).join() === 'Formation,Main');
  const pin = await pinOf(run, 'Formation', 'épingle dans « Favoris »');
  if (!pin) return;
  await run.page.click(...pin.at);
  await run.expect('retirer des favoris', 'le dossier devait quitter « Favoris » aussitôt, la ligne « unpin » écrite', state => names(state).join() === 'Main' && state.filing.join() === 'setFiling:unpin:Formation');
  const count = await run.page.run(favCount);
  if (count !== '1') run.note('compte de « Favoris »', `le volet devait compter un seul favori (« ${count} »)`);
  await run.page.chord('Control', 'z');
  await run.expect('Ctrl+Z', 'Ctrl+Z devait remettre le dossier en favori : la liste le montre, la ligne « pin » est écrite', state => names(state).join() === 'Formation,Main' && state.filing.at(-1) === 'setFiling:pin:Formation');
  await run.page.chord('Control', 'y');
  await run.expect('Ctrl+Y', 'Ctrl+Y devait le retirer de nouveau', state => names(state).join() === 'Main' && state.filing.at(-1) === 'setFiling:unpin:Formation');
}

// Les dossiers d'un espace ne s'épinglent pas encore : pas d'épingle sur la ligne, l'article du menu est grisé et dit pourquoi ; rien n'est écrit.
async function spaceRefused(run, t) {
  await run.reset();
  await run.page.run(() => window.__spaces());
  await run.clickSelector('.tr-row[data-path="Espaces"]');
  await run.click('Achats');
  await run.page.press('Enter');
  await run.expect('l\'espace', 'l\'espace devait montrer son dossier Contrats', state => names(state).join() === 'Contrats');
  const pin = await run.page.run(buttonOf, 'Contrats', '.rb.pin');
  if (pin) run.note('épingle d\'un dossier d\'espace', 'un dossier d\'espace ne devait pas avoir d\'épingle sur sa ligne (lot 2)');
  await run.page.rightClick(...await run.page.run(centerOfName, 'Contrats'));
  await run.expect('menu d\'un dossier d\'espace', `l'article « ${t('ex.pin')} » devait être là, grisé`, state => { const entry = state.menu.find(item => item.label === t('ex.pin')); return entry && entry.greyed === true; });
  const before = (await run.snap()).notices.length;
  await run.page.click(...await run.page.run(centerOfMenuItem, t('ex.pin')));
  await run.expect('article grisé', 'un clic sur l\'article grisé devait dire pourquoi, sans rien écrire', state => state.notices.length === before + 1 && state.notices.at(-1) === t('ex.favFolderSpace')
    && state.filing.length === 0 && state.menu.length === 0);
}

// Les mesures des dossiers en favori, dans la langue de la page ; rend les écarts { kind, text }.
export async function favorisDossiersProblems(page, language, tag) {
  const found = [];
  const t = createI18n(language).t;
  const run = new Run(page, tag, found, 'dossiers en favori');
  const steps = [pinFromRow, pinFromMenu, listed, opening, unpinHere, spaceRefused];
  for (const step of steps) {
    try {
      await step(run, t);
    } catch (error) {
      run.note('geste impossible', `${step.name} : ${String(error.message).slice(0, 200)}`);
      await page.press('Escape').catch(() => {});
    }
    await run.reset();
    await delay(30);
  }
  return found;
}
