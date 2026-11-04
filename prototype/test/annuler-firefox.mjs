// Ctrl+Z dans l'explorateur sous Firefox (demande du porteur, 04/11 : « Ctrl+Z doit aussi faire revenir un fichier supprimé, et plus globalement toutes les modifications » ; règle du 03/11 : toute nouvelle interface
// ajoute ses mesures à test/interfaces-firefox.test.mjs). Les gestes se font au vrai clavier de Firefox, sur la page d'essai (test/pages/explorateur.js : le vrai explorateur, le vrai `Trash`, le vrai `Copying`,
// le vrai `Filing`, qui partagent une pile) : Suppr puis Ctrl+Z, restaurer puis Ctrl+Z, copier puis Ctrl+Z, plusieurs gestes défaits un par appui dans l'ordre inverse, « Rien à annuler », la recherche qui garde son
// Ctrl+Z, Ctrl+Maj+Z qui n'est pas lié, le fichier que seule l'app ouverte sait fermer (remettre à la corbeille attend l'app, restaurer non), le choix d'un fichier pour une app. Ce que fait la pile est dans
// test/undo-stack.test.mjs, ce que la corbeille y dépose dans test/explorer-undo.test.mjs, ce que le rangement y dépose dans test/filing.test.mjs, et tout cela dans un vrai Grist dans labo/run-annuler.mjs.
import { createI18n } from '../js/i18n.js';
import { Run, centerOfName, delay, names } from './corbeille-firefox.mjs';

const FILE = 'Grille de suivi';
const APP = 'Publipostage+';
const undo = page => page.chord('Control', 'z');
const trashRow = '.tr-row[data-view="trash"]';

// Suppr puis Ctrl+Z : le fichier revient, la phrase le dit ; Ctrl+Z encore : il n'y a plus rien à annuler.
async function afterDelete(run, t) {
  await run.reset();
  await run.click('Convocation');
  await run.page.press('Delete');
  await run.expect('Suppr', 'Suppr devait mettre « Convocation » à la corbeille', state => state.trashCount === '1' && !names(state).includes('Convocation'));
  await undo(run.page);
  await run.expect('Ctrl+Z après Suppr', 'Ctrl+Z devait ramener « Convocation » et le dire (restauré), la corbeille vide', state => names(state).includes('Convocation') && !state.trashCount && state.notices.at(-1) === t('trash.restored', { name: 'Convocation' }));
  await undo(run.page);
  await run.expect('Ctrl+Z de plus', 'Ctrl+Z de plus devait dire qu\'il n\'y a rien à annuler', state => state.notices.at(-1) === t('undo.nothing') && names(state).includes('Convocation'));
}

// Restaurer à la corbeille (Entrée) puis Ctrl+Z : le fichier retourne à la corbeille.
async function afterRestore(run, t) {
  await run.reset();
  await run.click('Convocation');
  await run.page.press('Delete');
  await run.expect('Suppr', 'Suppr devait mettre « Convocation » à la corbeille', state => state.trashCount === '1');
  await run.clickSelector(trashRow);
  await run.click('Convocation');
  await run.page.press('Enter');
  await run.expect('Restaurer', 'Entrée devait restaurer « Convocation » : la corbeille est vide', state => !state.trashCount && state.notices.at(-1) === t('trash.restored', { name: 'Convocation' }));
  await undo(run.page);
  await run.expect('Ctrl+Z après Restaurer', 'Ctrl+Z devait remettre « Convocation » à la corbeille, et le dire', state => state.trashCount === '1' && state.notices.at(-1) === t('trash.moved', { name: 'Convocation' }));
}

// Copier-coller puis Ctrl+Z : la copie, et elle seule, part à la corbeille ; l'original est intact.
async function afterCopy(run, t) {
  await run.reset();
  await run.click('Convocation');
  await run.page.chord('Control', 'c');
  await run.page.chord('Control', 'v');
  await run.expect('Ctrl+V', 'Ctrl+V devait ajouter « Convocation (1) »', state => names(state).includes('Convocation (1)'));
  await undo(run.page);
  await run.expect('Ctrl+Z après la copie', 'Ctrl+Z devait mettre la copie à la corbeille et garder « Convocation »', state => names(state).includes('Convocation') && !names(state).includes('Convocation (1)')
    && state.trashCount === '1' && state.notices.at(-1) === t('trash.moved', { name: 'Convocation (1)' }));
}

// Deux suppressions, puis deux Ctrl+Z : un geste par appui, dans l'ordre inverse (la dernière supprimée revient la première) ; un troisième dit qu'il n'y a plus rien à annuler.
async function reverseOrder(run, t) {
  await run.reset();
  await run.click('Convocation');
  await run.page.press('Delete');
  await run.expect('Suppr 1', 'la première suppression devait aboutir', state => state.trashCount === '1');
  await run.click('Main');
  await run.page.press('Delete');
  await run.expect('Suppr 2', 'la seconde suppression devait aboutir', state => state.trashCount === '2');
  await undo(run.page);
  await run.expect('un appui', 'Ctrl+Z devait ramener « Main » (la dernière supprimée) et garder « Convocation » à la corbeille', state => names(state).includes('Main') && !names(state).includes('Convocation') && state.trashCount === '1' && state.notices.at(-1) === t('trash.restored', { name: 'Main' }));
  await undo(run.page);
  await run.expect('deux appuis', 'un deuxième Ctrl+Z devait ramener « Convocation »', state => names(state).includes('Convocation') && !state.trashCount);
  await undo(run.page);
  await run.expect('trois appuis', 'un troisième Ctrl+Z devait dire qu\'il n\'y a rien à annuler', state => state.notices.at(-1) === t('undo.nothing'));
}

// Dans la recherche, Ctrl+Z reste celui du texte : l'explorateur n'y touche pas.
async function searchKeepsKey(run) {
  await run.reset();
  await run.click('Convocation');
  await run.page.press('Delete');
  await run.expect('Suppr', 'Suppr devait mettre « Convocation » à la corbeille', state => state.trashCount === '1');
  await run.page.press('/');
  await run.expect('« / »', '« / » devait mettre le clavier dans la recherche', state => state.focus === '(recherche)');
  const before = await run.snap();
  await undo(run.page);
  await delay(250);
  const after = await run.snap();
  if (after.trashCount !== '1' || after.notices.length !== before.notices.length) run.note('Ctrl+Z dans la recherche', `dans la recherche, Ctrl+Z ne devait rien défaire à l'explorateur (corbeille ${after.trashCount}, phrases ${before.notices.length} puis ${after.notices.length})`);
  await run.page.press('Escape');
}

// Ctrl+Maj+Z (rétablir, ailleurs) n'est lié à rien : il n'y a pas de « rétablir », et il ne défait rien non plus.
async function noRedo(run) {
  await run.reset();
  await run.click('Convocation');
  await run.page.press('Delete');
  await run.expect('Suppr', 'Suppr devait mettre « Convocation » à la corbeille', state => state.trashCount === '1');
  const before = await run.snap();
  await run.page.chord('Control', 'Shift', 'z');
  await delay(250);
  const after = await run.snap();
  if (after.trashCount !== '1' || after.notices.length !== before.notices.length) run.note('Ctrl+Maj+Z', `Ctrl+Maj+Z ne devait rien faire (corbeille ${after.trashCount}, phrases ${before.notices.length} puis ${after.notices.length})`);
}

// Le fichier que seule l'app ouverte sait fermer : le restaurer puis défaire = le remettre à la corbeille, qui attend l'app ; la phrase le dit, rien ne bouge, et Ctrl+Z marche dès que l'app est ouverte.
async function compositeWaitsForApp(run, t) {
  await run.reset();
  await run.click(FILE);
  await run.page.press('Delete');
  await run.expect('Suppr', 'Suppr devait mettre « Grille de suivi » à la corbeille (l\'app est ouverte)', state => state.trashCount === '1');
  await run.clickSelector(trashRow);
  await run.click(FILE);
  await run.page.press('Enter');
  await run.expect('Restaurer', 'Entrée devait restaurer « Grille de suivi », sans avoir besoin de l\'app', state => !state.trashCount);
  await run.page.run(() => { window.__appOpen = false; });
  await undo(run.page);
  await run.expect('app fermée', 'app fermée, Ctrl+Z devait dire d\'ouvrir l\'app, sans rien mettre à la corbeille', state => state.notices.at(-1) === t('trash.openApp', { app: APP }) && !state.trashCount);
  await run.page.run(() => { window.__appOpen = true; });
  await undo(run.page);
  await run.expect('app ouverte', 'app ouverte, le même Ctrl+Z devait remettre « Grille de suivi » à la corbeille', state => state.trashCount === '1' && state.notices.at(-1).startsWith(t('trash.moved', { name: FILE })));
}

// Défaire une suppression n'a pas besoin de l'app : app fermée, Suppr était fait app ouverte, Ctrl+Z restaure.
async function compositeRestoreNeedsNoApp(run, t) {
  await run.reset();
  await run.click(FILE);
  await run.page.press('Delete');
  await run.expect('Suppr', 'Suppr devait mettre « Grille de suivi » à la corbeille', state => state.trashCount === '1');
  await run.page.run(() => { window.__appOpen = false; });
  await undo(run.page);
  await run.expect('Ctrl+Z app fermée', 'restaurer n\'a pas besoin de l\'app : « Grille de suivi » devait revenir', state => names(state).includes(FILE) && !state.trashCount && state.notices.at(-1) === t('trash.restored', { name: FILE }));
}

// Pendant le choix d'un fichier pour une app (contrats 5.4), Ctrl+Z est grisé comme le reste : la phrase le dit.
async function whileChoosing(run, t) {
  await run.reset();
  await run.page.run(() => window.__explorer.enterChoice({ title: 'Choisir', accept: () => true, onPick: () => {}, onCancel: () => {} }));
  await run.click('Convocation');
  await undo(run.page);
  await run.expect('Ctrl+Z pendant un choix', 'pendant un choix, Ctrl+Z devait dire que c\'est indisponible', state => state.notices.at(-1) === t('ex.choose.newOff'));
  await run.page.run(() => window.__explorer.exitChoice());
}

// Les mesures de Ctrl+Z, dans la langue de la page ; rend les écarts { kind, text }.
export async function annulerProblems(page, language, tag) {
  const found = [];
  const t = createI18n(language).t;
  const run = new Run(page, tag, found, 'Ctrl+Z');
  const steps = [afterDelete, afterRestore, afterCopy, reverseOrder, searchKeepsKey, noRedo, compositeWaitsForApp, compositeRestoreNeedsNoApp, whileChoosing];
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
