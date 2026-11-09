// Les dossiers sans fichier de l'explorateur sous Firefox (décision du porteur du 04/11 : « créer des dossiers et sous-dossiers », tout se fait depuis l'explorateur ; règle du 03/11 : toute nouvelle interface
// ajoute ses mesures à test/interfaces-firefox.test.mjs). Les gestes se font à la vraie souris et au vrai clavier de Firefox, sur la page d'essai (test/pages/explorateur.js : le vrai explorateur, le vrai `Filing`
// et la vraie fenêtre « Nouveau dossier » sur un rangement de doublure qui tient les dossiers gardés) : l'article « Nouveau dossier » du menu « Nouveau » et sa fenêtre (à 700 px, le clavier dans le champ), le nom
// vide ou déjà pris, un dossier vide ouvert (« Dossier vide. », pas « Aucun fichier »), un sous-dossier, Suppr et « Supprimer le dossier » (grisé quand un fichier est dedans), « Nouveau dossier » depuis Récents,
// les vignettes et le volet, le choix d'un fichier pour une app, et le dossier qui reste quand son dernier fichier part à la corbeille. Ce que chaque geste écrit est dans test/filing.test.mjs.
import { createI18n } from '../js/i18n.js';
import { Run, centerOfName, delay, names } from './corbeille-firefox.mjs';
import { centerOfMenuItem, menuFits } from './copier-firefox.mjs';

const NEW = '.ex-nav-row .btn.primary';

// ---------- ce qui s'exécute dans la page (rien du module n'y est visible) ----------

// La pastille d'une ligne de la liste (« 0 fichier »), ou null.
function pillOf(name) {
  const row = [...document.querySelectorAll('.ls-row')].find(item => (item.querySelector('.t') || {}).textContent === name);
  const pill = row && row.querySelector('.pill');
  return pill ? pill.textContent.trim() : null;
}

// La légende d'une vignette (« 0 fichier »), ou null.
function captionOf(name) {
  const tile = [...document.querySelectorAll('.th')].find(item => (item.querySelector('.tn') || {}).textContent === name);
  const caption = tile && tile.querySelector('.tt');
  return caption ? caption.textContent.replace(/\s+/g, ' ').trim() : null;
}

// Les dossiers du volet (« Moi » compris), dans l'ordre.
const treeNames = () => [...document.querySelectorAll('.tr-folder .tr-row[data-path] .lbl')].map(node => node.textContent.trim());

// ---------- la conduite ----------

const type = (page, text) => page.press(...text.split(''));
const seed = (run, ...paths) => run.page.run(keep => window.__keep(...keep), paths);

// Le menu « Nouveau » puis son premier article : la fenêtre « Nouveau dossier » s'ouvre.
async function openNewFolder(run, t, where) {
  await run.clickSelector(NEW);
  await run.expect('menu « Nouveau »', 'le menu « Nouveau » devait s\'ouvrir sur « Nouveau dossier », dégrisé', state => state.menu.length > 0 && state.menu[0].label === t('ex.newFolder') && state.menu[0].greyed === false);
  const fits = await run.page.run(menuFits);
  if (fits.length) run.note('menu « Nouveau »', `le menu devait tenir dans la page (${fits.join(' ; ')})`);
  const item = await run.page.run(centerOfMenuItem, t('ex.newFolder'));
  if (!item) { run.note('menu « Nouveau »', 'l\'article « Nouveau dossier » est introuvable'); return; }
  await run.page.click(...item);
  await run.expect('fenêtre « Nouveau dossier »', `la fenêtre devait nommer où naît le dossier (« ${where} »), tenir dans la page et donner le clavier au champ`, state => state.modal
    && state.modal.title === t('ex.newFolderTitle', { folder: where }) && state.modal.focus === 'name-input' && state.modal.fits.length === 0);
}

// « Nouveau dossier » à la racine : le dossier est créé, il prend le clavier, il compte zéro fichier, une ligne d'état est écrite.
async function createFromMenu(run, t) {
  await run.reset();
  await openNewFolder(run, t, t('ex.me'));
  await type(run.page, 'contrats');
  await run.page.press('Enter');
  const state = await run.expect('créer le dossier', 'Entrée devait créer « contrats » : fenêtre fermée, ligne choisie et au clavier, une ligne d\'état écrite',
    now => now.modal === null && names(now).includes('contrats') && now.selected === 'contrats' && now.focus === 'contrats' && now.filing.join() === 'setFiling:+contrats');
  const pill = await run.page.run(pillOf, 'contrats');
  if (pill !== t('ex.fileCount', { n: 0 })) run.note('dossier créé', `la pastille de « contrats » devait dire « ${t('ex.fileCount', { n: 0 })} » (« ${pill} »)`);
  if (!state.info || !state.info.includes('contrats')) run.note('dossier créé', 'la barre d\'information devait nommer le dossier choisi');
  const tree = await run.page.run(treeNames);
  if (!tree.includes('contrats')) run.note('volet', `le volet devait montrer « contrats » (${tree.join(', ')})`);
}

// Un nom vide, ou celui d'un dossier voisin, est refusé dans la fenêtre, qui dit pourquoi ; renoncer n'écrit rien.
async function refusals(run, t) {
  await run.reset();
  await openNewFolder(run, t, t('ex.me'));
  await run.page.press('Enter');
  await run.expect('nom vide', 'un nom vide devait être refusé dans la fenêtre, qui reste ouverte', state => state.modal && state.modal.note === t('ex.nameEmpty') && state.modal.focus === 'name-input');
  await type(run.page, 'formation');
  await run.page.press('Enter');
  await run.expect('nom pris', '« formation » (casse ignorée) devait être refusé : le dossier « Formation » existe déjà à la racine', state => state.modal && state.modal.note === t('ex.folderTaken') && state.modal.fits.length === 0);
  await run.page.press('Escape');
  await run.expect('renoncer', 'Échap devait fermer la fenêtre sans rien écrire', state => state.modal === null && state.filing.length === 0 && names(state).filter(name => name.toLowerCase() === 'formation').length === 1);
}

// Un dossier vide s'ouvre : « Dossier vide. » (non « Aucun fichier »), et on y crée un sous-dossier ; la fenêtre dit où.
async function emptyFolder(run, t) {
  await run.reset();
  await seed(run, 'Vide');
  await run.expect('dossier gardé', '« Vide » devait être listé avec « 0 fichier »', state => names(state).includes('Vide'));
  await run.click('Vide');
  await run.page.press('Enter');
  await run.expect('ouvrir le dossier vide', 'Entrée devait ouvrir « Vide » : « Dossier vide. », sans le message « Aucun fichier »', state => state.crumbs.includes('Vide') && state.rows.length === 0 && state.empty === t('ex.emptyFolder'));
  await run.page.press('Backspace');
  await run.expect('Retour arrière dans un dossier vide', 'le clavier devait rester dans la liste, vide : Retour arrière devait ramener à la racine', state => !state.crumbs.includes('Vide') && names(state).includes('Vide'));
  await run.click('Vide');
  await run.page.press('Enter');
  await run.expect('rouvrir le dossier vide', 'Entrée devait rouvrir « Vide »', state => state.crumbs.includes('Vide') && state.rows.length === 0);
  await openNewFolder(run, t, 'Vide');
  await type(run.page, 'sous');
  await run.page.press('Enter');
  await run.expect('sous-dossier', 'le sous-dossier devait naître dans « Vide », y prendre le clavier, avec sa ligne d\'état', state => state.modal === null && names(state).join() === 'sous' && state.focus === 'sous'
    && state.crumbs.includes('Vide') && state.filing.join() === 'setFiling:+Vide/sous');
  await run.page.press('Backspace');
  await run.expect('retour à la racine', 'Retour arrière devait ramener à la racine, où « Vide » compte toujours zéro fichier', state => !state.crumbs.includes('Vide') && names(state).includes('Vide'));
  const tree = await run.page.run(treeNames);
  if (!tree.includes('Vide') || tree.indexOf('sous') !== tree.indexOf('Vide') + 1) run.note('volet', `le volet devait montrer « sous » sous « Vide » (${tree.join(', ')})`);
}

// Suppr sur un dossier vide : il disparaît sans question, la phrase le dit, ses sous-dossiers vides aussi, le clavier passe à la ligne suivante.
async function deleteEmpty(run, t) {
  await run.reset();
  await seed(run, 'Vide', 'Vide/sous');
  await run.click('Vide');
  await run.page.press('Delete');
  await run.expect('Suppr sur un dossier vide', 'Suppr devait supprimer « Vide » et « Vide/sous » sans fenêtre, le dire, et donner le clavier à la ligne suivante',
    state => state.modal === null && !names(state).includes('Vide') && state.notices.at(-1) === t('ex.folderDeleted', { name: 'Vide' }) && state.filing.join() === 'setFiling:-Vide:-Vide/sous'
      && state.selected !== null && state.focus === state.selected);
}

// Un dossier qui a des fichiers ne se supprime pas : Suppr le dit, l'article du menu est grisé et le dit aussi ; un dossier vide a l'article dégrisé, qui le supprime.
async function deleteRefused(run, t) {
  await run.reset();
  await run.click('Formation');
  await run.page.press('Delete');
  await run.expect('Suppr sur un dossier plein', 'Suppr devait dire qu\'un dossier qui a des fichiers ne se supprime pas, et ne rien écrire', state => state.notices.at(-1) === t('ex.folderNotEmpty')
    && names(state).includes('Formation') && state.filing.length === 0 && state.modal === null);
  const before = (await run.snap()).notices.length;
  const at = await run.page.run(centerOfName, 'Formation');
  await run.page.rightClick(...at);
  await run.expect('menu d\'un dossier plein', '« Supprimer le dossier » devait être grisé, avec Suppr pour touche', state => {
    const entry = state.menu.find(item => item.label === t('ex.deleteFolder'));
    return entry && entry.greyed === true && entry.hint === t('key.delete');
  });
  const fits = await run.page.run(menuFits);
  if (fits.length) run.note('menu d\'un dossier', `le menu devait tenir dans la page, ses touches à l'écart de leur nom (${fits.join(' ; ')})`);
  await run.page.click(...await run.page.run(centerOfMenuItem, t('ex.deleteFolder')));
  await run.expect('« Supprimer le dossier » grisé', 'un clic sur l\'article grisé devait redire pourquoi', state => state.notices.length === before + 1 && state.notices.at(-1) === t('ex.folderNotEmpty') && state.menu.length === 0);
  await seed(run, 'Vide');
  const empty = await run.page.run(centerOfName, 'Vide');
  await run.page.rightClick(...empty);
  await run.expect('menu d\'un dossier vide', '« Supprimer le dossier » devait être dégrisé pour « Vide »', state => { const entry = state.menu.find(item => item.label === t('ex.deleteFolder')); return entry && entry.greyed === false; });
  await run.page.click(...await run.page.run(centerOfMenuItem, t('ex.deleteFolder')));
  await run.expect('« Supprimer le dossier »', 'l\'article devait supprimer « Vide »', state => !names(state).includes('Vide') && state.notices.at(-1) === t('ex.folderDeleted', { name: 'Vide' }));
}

// F2 sur un dossier vide le renomme comme un autre ; Entrée l'ouvre.
async function renameEmpty(run) {
  await run.reset();
  await seed(run, 'Vide');
  await run.click('Vide');
  await run.page.press('F2');
  await run.expect('F2', 'F2 devait demander à renommer « Vide »', state => state.filing.includes('renameFolder:Vide'));
}

// Depuis Récents (une vue qui n'est pas un dossier), « Nouveau dossier » crée à la racine, la fenêtre dit « Moi », et la personne y est conduite.
async function fromRecent(run, t) {
  await run.reset();
  await run.clickSelector('.tr-row[data-view="recent"]');
  await run.expect('Récents', 'la vue « Récents » devait s\'afficher', state => state.rows.length > 5 && !state.crumbs.includes('Formation'));
  await openNewFolder(run, t, t('ex.me'));
  await type(run.page, 'depuis');
  await run.page.press('Enter');
  await run.expect('depuis Récents', 'le dossier devait naître à la racine, que la personne voit : « depuis » choisi et au clavier, la vue « Récents » quittée', state => state.modal === null && names(state).includes('depuis')
    && state.selected === 'depuis' && state.focus === 'depuis' && !state.crumbs.includes(t('ex.recent')) && state.filing.join() === 'setFiling:+depuis');
}

// En vignettes, un dossier vide a sa vignette (« 0 fichier ») ; il est dans le volet.
async function tilesAndTree(run, t) {
  await run.reset();
  await seed(run, 'Vide');
  await run.clickSelector('.tb-group .tb:nth-child(2)');
  await run.expect('vignettes', 'la vue en vignettes devait montrer « Vide »', state => state.tiles.includes('Vide'));
  const caption = await run.page.run(captionOf, 'Vide');
  if (caption !== t('ex.fileCount', { n: 0 })) run.note('vignette', `la vignette de « Vide » devait dire « ${t('ex.fileCount', { n: 0 })} » (« ${caption} »)`);
  await run.click('Vide');
  await run.page.press('Delete');
  await run.expect('Suppr en vignettes', 'Suppr devait supprimer la vignette « Vide »', state => !state.tiles.includes('Vide') && state.notices.at(-1) === t('ex.folderDeleted', { name: 'Vide' }));
  await run.clickSelector('.tb-group .tb:nth-child(1)');
}

// Pendant le choix d'un fichier pour une app (contrats 5.4), les dossiers sans fichier ne sont pas montrés (rien à y choisir) ; « Nouveau » est grisé ; la liste revient après.
async function whileChoosing(run, t) {
  await run.reset();
  await seed(run, 'Vide');
  await run.page.run(() => window.__explorer.enterChoice({ title: 'Choisir', accept: () => true, onPick: () => {}, onCancel: () => {} }));
  await run.expect('choix', 'pendant un choix, « Vide » ne devait pas être montré, « Formation » (des fichiers) si', state => !names(state).includes('Vide') && names(state).includes('Formation'));
  await run.clickSelector(NEW);
  await run.expect('« Nouveau » pendant un choix', '« Nouveau » devait dire qu\'il est indisponible pendant un choix', state => state.notices.at(-1) === t('ex.choose.newOff') && state.menu.length === 0);
  await run.page.run(() => window.__explorer.exitChoice());
  await run.expect('fin du choix', 'après le choix, « Vide » devait être de retour', state => names(state).includes('Vide'));
}

// Le dernier fichier d'un dossier part à la corbeille : le dossier reste (« Dossier vide. », zéro fichier), une ligne d'état est écrite ; le premier ne la déclenche pas, un autre fichier restant.
async function lastFileTrashed(run, t) {
  await run.reset();
  await run.click('Formation');
  await run.page.press('Enter');
  await run.expect('ouvrir « Formation »', 'Entrée devait ouvrir « Formation »', state => state.crumbs.includes('Formation') && names(state).length === 2);
  await run.click('Contrat de prestation');
  await run.page.press('Delete');
  await run.expect('Suppr sur le premier fichier', 'un fichier devait rester dans « Formation » : le dossier n\'a rien à garder', state => names(state).length === 1 && state.trashCount === '1' && !state.filing.some(entry => entry.startsWith('setFiling')));
  await run.click('Support de session');
  await run.page.press('Delete');
  await run.expect('Suppr sur le dernier fichier', 'le dossier devait rester, vide, avec sa ligne d\'état', state => state.empty === t('ex.emptyFolder') && state.trashCount === '2' && state.filing.join() === 'setFiling:+Formation');
  await run.page.press('Backspace');
  await run.expect('retour à la racine', '« Formation » devait rester à la racine, à zéro fichier', state => names(state).includes('Formation'));
  const pill = await run.page.run(pillOf, 'Formation');
  if (pill !== t('ex.fileCount', { n: 0 })) run.note('dossier vidé', `la pastille de « Formation » devait dire « ${t('ex.fileCount', { n: 0 })} » (« ${pill} »)`);
}

// Les espaces partagés (lot 4b) : « Espaces » est une racine du volet à côté de « Moi », « Moi » ne la liste pas, son fil d'Ariane ne passe pas par « Moi », l'espace, son dossier et son sous-dossier vide s'ouvrent à la souris.
async function spacesRoot(run, t) {
  await run.reset();
  await run.page.run(() => window.__spaces());
  const tree = await run.page.run(treeNames);
  if (tree[0] !== t('ex.me') || tree.filter(name => name === t('ex.spaces')).length !== 1) run.note('volet', `le volet devait montrer « Moi » puis la racine « ${t('ex.spaces')} » (${tree.join(' | ')})`);
  await run.expect('racine « Moi »', '« Moi » ne devait pas lister « Espaces » parmi ses dossiers', state => !names(state).includes('Espaces') && !names(state).includes(t('ex.spaces')));
  await run.clickSelector('.tr-row[data-path="Espaces"]');
  await run.expect('« Espaces »', 'la racine devait lister l\'espace Achats, sans passer par « Moi » dans le fil d\'Ariane', state => names(state).join() === 'Achats' && state.crumbs.startsWith(t('ex.spaces')) && !state.crumbs.includes(t('ex.me')));
  await run.click('Achats');
  await run.page.press('Enter');
  await run.expect('l\'espace', 'l\'espace devait montrer son dossier Contrats', state => names(state).join() === 'Contrats' && state.crumbs.includes('Achats'));
  await run.click('Contrats');
  await run.page.press('Enter');
  await run.expect('le dossier d\'espace', 'Contrats devait montrer le modèle rangé et le sous-dossier vide Sous', state => names(state).includes('Sous') && names(state).length === 2 && state.crumbs.includes('Contrats'));
  // « Partager… » : dégrisé sur un dossier d'espace, grisé sur « Espaces » et sur un dossier de « Moi » (le menu garde l'article)
  const menuOf = async name => {
    const at = await run.page.run(centerOfName, name);
    if (!at) { run.note('ligne introuvable', `« ${name} » n'est pas dans la liste`); return null; }
    await run.page.rightClick(...at);
    await run.expect('menu du dossier', `le menu de « ${name} » devait s'ouvrir`, state => state.menu.length > 0);
    const item = await run.page.run(label => { const node = [...document.querySelectorAll('.menu .menu-item')].find(each => ((each.querySelector('.menu-label') || {}).textContent || '').trim() === label); return node ? node.getAttribute('aria-disabled') === 'true' : null; }, t('share.menu'));
    await run.page.press('Escape');
    return item;
  };
  const sous = await menuOf('Sous');
  if (sous !== false && sous !== null) run.note('« Partager… » d\'un dossier d\'espace', 'l\'article devait être dégrisé sur « Sous » (dossier d\'un espace)');
  if (sous === null) run.note('« Partager… » d\'un dossier d\'espace', 'l\'article « Partager… » devait être dans le menu du dossier');
  await run.page.press('Backspace');
  await run.page.press('Backspace');
  await run.expect('retour à « Espaces »', 'Retour arrière deux fois devait revenir à la racine des espaces', state => names(state).join() === 'Achats');
  const space = await menuOf('Achats');
  if (space !== true) run.note('« Partager… » d\'un espace', 'l\'article devait être grisé sur un espace (ses droits se règlent dans « Gérer les partages… »)');
}

// Les mesures des dossiers sans fichier, dans la langue de la page ; rend les écarts { kind, text }.
export async function dossiersProblems(page, language, tag) {
  const found = [];
  const t = createI18n(language).t;
  const run = new Run(page, tag, found, 'dossiers sans fichier');
  const steps = [createFromMenu, refusals, emptyFolder, deleteEmpty, deleteRefused, renameEmpty, fromRecent, tilesAndTree, whileChoosing, lastFileTrashed, spacesRoot];
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
