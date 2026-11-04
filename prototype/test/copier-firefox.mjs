// La copie et le presse-papiers de l'explorateur sous Firefox (décision du porteur du 04/11 : tout se fait depuis l'explorateur, « Dupliquer » et Ctrl+C, Ctrl+X, Ctrl+V compris ; règle du 03/11 : toute
// nouvelle interface ajoute ses mesures à test/interfaces-firefox.test.mjs). Les gestes se font à la vraie souris et au vrai clavier de Firefox, sur la page d'essai (test/pages/explorateur.js : le vrai
// explorateur, le vrai `Copying`, un gardien de doublure qui ajoute la copie, un rangement de doublure qui déplace) : « Dupliquer » dans le menu et ses touches, Ctrl+C puis Ctrl+V dans un autre dossier,
// Ctrl+X puis Ctrl+V, un dossier qui se coupe et ne se copie pas, coller ailleurs que dans un dossier, un fichier que l'app ne laisse pas copier, la recherche qui garde son presse-papiers, Ctrl+D laissée
// au navigateur, la corbeille, le choix d'un fichier pour une app. Ce que fait chaque touche sans DOM est dans test/explorer-keys.test.mjs, ce que dit chaque phrase dans test/explorer-clipboard.test.mjs.
import { createI18n } from '../js/i18n.js';
import { Run, centerOfName, centerOfSelector, delay, names } from './corbeille-firefox.mjs';

// ---------- ce qui s'exécute dans la page (rien du module n'y est visible) ----------

// Le centre, à l'écran, de l'article du menu ouvert qui porte ce nom.
export function centerOfMenuItem(label) {
  const item = [...document.querySelectorAll('.menu .menu-item')].find(node => ((node.querySelector('.menu-label') || {}).textContent || '').trim() === label);
  if (!item) return null;
  const box = item.getBoundingClientRect();
  return [box.left + Math.min(50, box.width / 2), box.top + box.height / 2];
}

// Le menu tient dans la page, et dans chaque article le nom ne touche pas la touche : la liste des écarts.
export function menuFits() {
  const menu = document.querySelector('.menu');
  if (!menu) return ['pas de menu'];
  const box = menu.getBoundingClientRect();
  const problems = [];
  if (box.left < 0 || box.top < 0 || box.right > window.innerWidth + 1 || box.bottom > window.innerHeight + 1) problems.push('le menu sort de la page');
  for (const item of menu.querySelectorAll('.menu-item')) {
    const label = item.querySelector('.menu-label');
    const hint = item.querySelector('.menu-hint');
    if (!label || !hint) continue;
    const a = label.getBoundingClientRect();
    const b = hint.getBoundingClientRect();
    if (a.right > b.left + 1 || b.right > item.getBoundingClientRect().right + 1) problems.push(`« ${label.textContent.trim()} » touche sa touche « ${hint.textContent.trim()} »`);
  }
  return problems;
}

// Ctrl+D est laissée au navigateur (marque-page) : la page note, après l'explorateur, si l'événement a été retenu (`defaultPrevented`).
function watchCtrlD() {
  if (window.__ctrlD) { window.__ctrlD.length = 0; return; }
  window.__ctrlD = [];
  document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') window.__ctrlD.push(event.defaultPrevented); });
}

const readCtrlD = () => window.__ctrlD.slice();

// ---------- la conduite ----------

const copyKey = (page, key) => page.chord('Control', key);

async function openFolder(run, name) {
  await run.click(name);
  await run.page.press('Enter');
  await run.expect('ouvrir un dossier', `Entrée devait ouvrir le dossier « ${name} »`, state => state.crumbs.includes(name));
}

// Le menu d'une ligne : « Dupliquer » a ses touches, « Déplacer vers… » aussi, et rien ne se touche à 700 px ; un clic sur « Dupliquer » copie le fichier, la copie prend le clavier.
async function menuDuplicate(run, t) {
  await run.reset();
  const at = await run.page.run(centerOfName, 'Convocation');
  await run.page.rightClick(...at);
  await run.expect('menu', 'le menu de « Convocation » devait avoir « Dupliquer » (Ctrl+C, V) et « Déplacer vers… » (Ctrl+X, V), le premier dégrisé', state => {
    const entry = label => state.menu.find(item => item.label === label);
    return entry(t('ex.duplicate')) && entry(t('ex.duplicate')).hint === 'Ctrl+C, V' && entry(t('ex.duplicate')).greyed === false && entry(t('ex.move')) && entry(t('ex.move')).hint === 'Ctrl+X, V';
  });
  const fits = await run.page.run(menuFits);
  if (fits.length) run.note('menu de la ligne', `le menu devait tenir dans la page, ses touches à l'écart de leur nom (${fits.join(' ; ')})`);
  const item = await run.page.run(centerOfMenuItem, t('ex.duplicate'));
  await run.page.click(...item);
  await run.expect('« Dupliquer »', '« Dupliquer » devait ajouter « Convocation (1) », la dire, et lui donner le clavier ; à la racine, aucun rangement à écrire', state => names(state).includes('Convocation (1)') && state.selected === 'Convocation (1)'
    && state.focus === 'Convocation (1)' && state.notices.at(-1) === t('copy.done', { as: 'Convocation (1)' }) && state.copies.length === 0 && state.menu.length === 0);
  const folder = await run.page.run(centerOfName, 'Contrat de prestation').catch(() => null);
  if (folder) run.note('liste', '« Contrat de prestation » est dans « Formation » : il ne devait pas être à la racine');
}

// Dans un dossier, « Dupliquer » range la copie à côté de l'original (le même dossier), et le dit.
async function duplicateInFolder(run, t) {
  await run.reset();
  await openFolder(run, 'Formation');
  await run.click('Contrat de prestation');
  const at = await run.page.run(centerOfName, 'Contrat de prestation');
  await run.page.rightClick(...at);
  const item = await run.page.run(centerOfMenuItem, t('ex.duplicate'));
  await run.page.click(...item);
  await run.expect('« Dupliquer » dans un dossier', 'la copie devait être rangée dans « Formation » et la phrase le dire', state => names(state).includes('Contrat de prestation (1)') && state.copies.length === 1 && /:Formation$/.test(state.copies[0])
    && state.notices.at(-1) === t('copy.doneIn', { as: 'Contrat de prestation (1)', folder: 'Formation' }));
}

// Ctrl+C sur un fichier de la racine, Ctrl+V dans « Formation » : la copie y est, elle prend le clavier ; Ctrl+V encore : une deuxième copie, le premier numéro libre ; l'original n'a pas bougé.
async function copyPaste(run, t) {
  await run.reset();
  await run.click('Convocation');
  await copyKey(run.page, 'c');
  await run.expect('Ctrl+C', 'Ctrl+C devait dire que « Convocation » est copié', state => state.notices.at(-1) === t('clip.copied', { name: 'Convocation' }));
  await openFolder(run, 'Formation');
  await copyKey(run.page, 'v');
  await run.expect('Ctrl+V', 'Ctrl+V devait ajouter « Convocation (1) » à « Formation », le dire, et lui donner le clavier', state => names(state).includes('Convocation (1)') && state.selected === 'Convocation (1)'
    && state.focus === 'Convocation (1)' && state.notices.at(-1) === t('copy.doneIn', { as: 'Convocation (1)', folder: 'Formation' }) && state.copies.length === 1 && /:Formation$/.test(state.copies[0]));
  await copyKey(run.page, 'v');
  await run.expect('Ctrl+V encore', 'un deuxième Ctrl+V devait faire « Convocation (2) » : une copie se colle autant de fois qu\'on veut', state => names(state).includes('Convocation (2)') && state.copies.length === 2);
  await run.page.press('Backspace');
  await run.expect('retour à la racine', 'la racine devait garder « Convocation » et ne pas avoir les copies, qui sont dans « Formation »', state => names(state).includes('Convocation') && !names(state).includes('Convocation (1)'));
}

// Ctrl+X puis Ctrl+V : le fichier se déplace dans le dossier ouvert, sans copie, et n'est plus à coller ; coller encore le dit ; coller à la racine le dit « Moi ».
async function cutPaste(run, t) {
  await run.reset();
  await run.click('Main');
  await copyKey(run.page, 'x');
  await run.expect('Ctrl+X', 'Ctrl+X devait dire que « Main » est coupé, sans rien retirer de la liste', state => state.notices.at(-1) === t('clip.cut', { name: 'Main' }) && names(state).includes('Main'));
  await openFolder(run, 'Formation');
  await copyKey(run.page, 'v');
  await run.expect('Ctrl+V après Ctrl+X', 'Ctrl+V devait déplacer « Main » dans « Formation » (aucune copie), le dire et lui donner le clavier', state => names(state).includes('Main') && state.selected === 'Main'
    && state.notices.at(-1) === t('clip.moved', { name: 'Main', folder: 'Formation' }) && state.filing.includes('moveTo:Main:Formation') && state.copies.length === 0);
  await copyKey(run.page, 'v');
  await run.expect('Ctrl+V encore', 'ce qui est coupé n\'est collé qu\'une fois : la phrase doit dire qu\'il n\'y a rien à coller', state => state.notices.at(-1) === t('clip.empty'));
  await run.click('Main');
  await copyKey(run.page, 'x');
  await run.page.press('Backspace');
  await run.expect('retour à la racine', 'Retour arrière devait ramener à la racine, sans « Main »', state => !state.crumbs.includes('Formation') && !names(state).includes('Main'));
  await copyKey(run.page, 'v');
  await run.expect('Ctrl+V à la racine', '« Main » devait revenir à la racine, la phrase disant « Moi »', state => names(state).includes('Main') && state.notices.at(-1) === t('clip.moved', { name: 'Main', folder: t('ex.me') }));
}

// Un dossier se coupe et ne se copie pas ; il ne va pas dans lui-même ni chez lui.
async function folders(run, t) {
  await run.reset();
  await run.click('Formation');
  await copyKey(run.page, 'c');
  await run.expect('Ctrl+C sur un dossier', 'un dossier ne se copie pas : la phrase dit de le couper', state => state.notices.at(-1) === t('clip.folderCopy'));
  await copyKey(run.page, 'x');
  await run.expect('Ctrl+X sur un dossier', 'un dossier se coupe', state => state.notices.at(-1) === t('clip.cut', { name: 'Formation' }));
  await run.page.press('Enter');
  await run.expect('ouvrir le dossier', 'Entrée devait ouvrir « Formation »', state => state.crumbs.includes('Formation'));
  await copyKey(run.page, 'v');
  await run.expect('coller un dossier dans lui-même', 'un dossier ne va pas dans lui-même : la phrase le dit, rien ne bouge', state => state.notices.at(-1) === t('clip.folderInto') && state.filing.includes('moveFolderTo:Formation:Formation'));
  await run.page.press('Backspace');
  await run.expect('retour à la racine', 'Retour arrière devait ramener à la racine', state => !state.crumbs.includes('Formation'));
  await copyKey(run.page, 'v');
  await run.expect('coller un dossier chez lui', 'à la racine, « Formation » est déjà là : la phrase le dit', state => state.notices.at(-1) === t('clip.same', { name: 'Formation' }));
}

// Coller ailleurs que dans un dossier (Récents) n'a pas de sens : la phrase dit d'ouvrir un dossier ; sans rien de copié, elle dit qu'il n'y a rien à coller.
async function pasteElsewhere(run, t) {
  await run.reset();
  await copyKey(run.page, 'v');
  await run.expect('Ctrl+V sans rien copier', 'sans rien copié, la phrase devait dire qu\'il n\'y a rien à coller', state => state.notices.at(-1) === t('clip.empty'));
  await run.click('Convocation');
  await copyKey(run.page, 'c');
  await run.clickSelector('.tr-row[data-view="recent"]');
  await run.expect('Récents', 'la vue « Récents » devait s\'afficher', state => state.rows.length > 5 && !state.crumbs.includes('Formation'));
  await copyKey(run.page, 'v');
  await run.expect('Ctrl+V dans Récents', 'dans « Récents », la phrase devait dire d\'ouvrir un dossier ; rien n\'est copié', state => state.notices.at(-1) === t('clip.noFolder') && state.copies.length === 0 && !names(state).includes('Convocation (1)'));
}

// Un fichier que l'app ne laisse pas copier : « Dupliquer » est grisé, un clic dit pourquoi ; Ctrl+C le dit aussi ; rien n'est à coller.
async function withoutRecipe(run, t) {
  await run.reset();
  const at = await run.page.run(centerOfName, 'Autre format');
  await run.page.rightClick(...at);
  const app = 'Publipostage+';
  await run.expect('menu', '« Dupliquer » devait être grisé pour « Autre format »', state => { const entry = state.menu.find(item => item.label === t('ex.duplicate')); return entry && entry.greyed === true && entry.hint === null; });
  const item = await run.page.run(centerOfMenuItem, t('ex.duplicate'));
  await run.page.click(...item);
  await run.expect('« Dupliquer » grisé', 'un clic sur « Dupliquer » grisé devait dire de l\'ouvrir dans son app', state => state.notices.at(-1) === t('ex.notice.appOnly', { app }) && state.copies.length === 0);
  await run.page.run(() => { window.__notices.length = 0; });
  await run.click('Autre format');
  await copyKey(run.page, 'c');
  await run.expect('Ctrl+C sans recette', 'Ctrl+C devait dire la même chose, sans rien copier', state => state.notices.at(-1) === t('ex.notice.appOnly', { app }));
  await copyKey(run.page, 'v');
  await run.expect('Ctrl+V sans recette', 'il n\'y a rien à coller', state => state.notices.at(-1) === t('clip.empty'));
}

// Dans la recherche, Ctrl+C, X et V restent ceux du texte : l'explorateur n'y touche pas.
async function searchKeepsKeys(run, t) {
  await run.reset();
  await run.click('Convocation');
  await copyKey(run.page, 'c');
  await run.expect('Ctrl+C', 'Ctrl+C devait copier « Convocation »', state => state.notices.at(-1) === t('clip.copied', { name: 'Convocation' }));
  await run.page.press('/');
  await run.expect('« / »', '« / » devait mettre le clavier dans la recherche', state => state.focus === '(recherche)');
  const before = (await run.snap()).notices.length;
  await copyKey(run.page, 'v');
  await copyKey(run.page, 'x');
  await copyKey(run.page, 'c');
  await delay(250);
  const after = await run.snap();
  if (after.notices.length !== before || after.copies.length !== 0 || names(after).includes('Convocation (1)')) run.note('Ctrl+V dans la recherche', `dans la recherche, Ctrl+C, X et V ne devaient rien faire à l'explorateur (phrases ${before} puis ${after.notices.length}, copies ${after.copies.length})`);
  await run.page.press('Escape');
}

// Ctrl+D (marque-page) n'est liée à rien : l'événement n'est pas retenu par l'explorateur, le navigateur en fait ce qu'il veut.
async function noCtrlD(run) {
  await run.reset();
  await run.page.run(watchCtrlD);
  await run.click('Convocation');
  const before = await run.snap();
  await copyKey(run.page, 'd');
  await delay(250);
  const kept = await run.page.run(readCtrlD);
  const after = await run.snap();
  if (kept.length !== 1 || kept[0] !== false) run.note('Ctrl+D', `Ctrl+D ne devait pas être retenue par l'explorateur (defaultPrevented : ${JSON.stringify(kept)})`);
  if (after.notices.length !== before.notices.length || names(after).length !== names(before).length) run.note('Ctrl+D', 'Ctrl+D ne devait rien faire dans l\'explorateur');
}

// En vignettes, le presse-papiers vise la vignette choisie.
async function tiles(run, t) {
  await run.reset();
  await run.clickSelector('.tb-group .tb:nth-child(2)');
  await run.expect('vignettes', 'la vue en vignettes devait s\'afficher', state => state.tiles.length > 5);
  await run.click('Convocation');
  await copyKey(run.page, 'c');
  await run.expect('Ctrl+C en vignettes', 'Ctrl+C devait copier la vignette choisie', state => state.notices.at(-1) === t('clip.copied', { name: 'Convocation' }));
  await copyKey(run.page, 'v');
  await run.expect('Ctrl+V en vignettes', 'Ctrl+V devait ajouter la copie, dont la vignette prend le clavier', state => state.tiles.includes('Convocation (1)') && state.selected === 'Convocation (1)');
  await run.clickSelector('.tb-group .tb:nth-child(1)');
}

// À la corbeille, un fichier ne se copie ni ne se coupe : il se restaure d'abord.
async function inTrash(run, t) {
  await run.reset();
  await run.click('Convocation');
  await run.page.press('Delete');
  await run.expect('Suppr', 'Suppr devait mettre « Convocation » à la corbeille', state => state.trashCount === '1');
  await run.clickSelector('.tr-row[data-view="trash"]');
  await run.expect('la corbeille', 'la corbeille devait lister « Convocation »', state => names(state).join() === 'Convocation');
  await run.click('Convocation');
  await copyKey(run.page, 'c');
  await run.expect('Ctrl+C à la corbeille', 'à la corbeille, la phrase devait dire de restaurer d\'abord', state => state.notices.at(-1) === t('clip.inTrash'));
}

// Pendant le choix d'un fichier pour une app (contrats 5.4), le presse-papiers est grisé comme « Nouveau » et la corbeille : la phrase le dit, « Dupliquer » est grisé sans touche.
async function whileChoosing(run, t) {
  await run.reset();
  await run.page.run(() => window.__explorer.enterChoice({ title: 'Choisir', accept: () => true, onPick: () => {}, onCancel: () => {} }));
  await run.click('Convocation');
  await copyKey(run.page, 'c');
  await run.expect('Ctrl+C pendant un choix', 'pendant un choix, Ctrl+C devait dire que c\'est indisponible', state => state.notices.at(-1) === t('ex.choose.newOff'));
  const at = await run.page.run(centerOfName, 'Convocation');
  await run.page.rightClick(...at);
  await run.expect('menu pendant un choix', '« Dupliquer » devait être grisé, sans touche, pendant un choix', state => { const entry = state.menu.find(item => item.label === t('ex.duplicate')); return entry && entry.greyed === true && entry.hint === null; });
  await run.page.press('Escape');
  await run.page.run(() => window.__explorer.exitChoice());
}

// Les mesures de la copie et du presse-papiers, dans la langue de la page ; rend les écarts { kind, text }.
export async function copierProblems(page, language, tag) {
  const found = [];
  const t = createI18n(language).t;
  const run = new Run(page, tag, found, 'copier et coller');
  const steps = [menuDuplicate, duplicateInFolder, copyPaste, cutPaste, folders, pasteElsewhere, withoutRecipe, searchKeepsKeys, noCtrlD, tiles, inTrash, whileChoosing];
  for (const step of steps) {
    try {
      await step(run, t);
    } catch (error) {
      run.note('geste impossible', `${step.name} : ${String(error.message).slice(0, 200)}`);
      await page.press('Escape').catch(() => {});
    }
    await run.reset();
  }
  return found;
}
