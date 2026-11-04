// Un fichier que seule l'app ouverte sait fermer ou copier (contrats 2.4 `appel`, 5.4 points 10 et 11 : un formulaire de Form+ et son lien public) sous Firefox (décision du porteur du 04/11 : tout se fait depuis
// l'explorateur, pour toutes les apps ; règle du 03/11 : toute nouvelle interface ajoute ses mesures à test/interfaces-firefox.test.mjs). Les gestes se font à la vraie souris et au vrai clavier de Firefox, sur la page
// d'essai (test/pages/explorateur.js : le vrai explorateur, le vrai `Trash` et le vrai `Copying`, dont la « Grille de suivi » fait office de fichier composite, l'app étant « ouverte » ou non) : app fermée, « Mettre à
// la corbeille » et « Dupliquer » sont grisés (le clic, Suppr et Ctrl+C puis Ctrl+V disent d'ouvrir l'app, rien ne bouge) ; app ouverte, les gestes marchent et la phrase de l'app s'ajoute à celle de GFS ; à la
// corbeille, « Restaurer » et « Supprimer définitivement… » n'ont pas besoin de l'app. Ce que fait chaque garde sans DOM est dans test/app-files-composite.test.mjs.
import { createI18n } from '../js/i18n.js';
import { Run, centerOfName, names } from './corbeille-firefox.mjs';
import { centerOfMenuItem, menuFits } from './copier-firefox.mjs';

const FILE = 'Grille de suivi';
const APP = 'Publipostage+';

const setApp = (page, open) => page.run(value => { window.__appOpen = value; }, open);
const said = page => page.run(() => window.__appSaid);

async function openMenu(run) {
  const at = await run.page.run(centerOfName, FILE);
  await run.page.rightClick(...at);
}

// App fermée : le menu de la ligne grise « Mettre à la corbeille » et « Dupliquer » (sans touche), le menu tient dans la page ; un clic sur chacun dit d'ouvrir l'app, et rien ne bouge.
async function closedMenu(run, t) {
  await run.reset();
  await setApp(run.page, false);
  await openMenu(run);
  await run.expect('menu', '« Mettre à la corbeille » et « Dupliquer » devaient être grisés, sans touche, quand l\'app n\'est pas ouverte', state => {
    const entry = label => state.menu.find(item => item.label === label);
    return [t('trash.move'), t('ex.duplicate')].every(label => entry(label) && entry(label).greyed === true && entry(label).hint === null) && entry(t('ex.rename')).greyed === false;
  });
  const fits = await run.page.run(menuFits);
  if (fits.length) run.note('menu de la ligne', `le menu devait tenir dans la page, ses touches à l'écart de leur nom (${fits.join(' ; ')})`);
  const remove = await run.page.run(centerOfMenuItem, t('trash.move'));
  await run.page.click(...remove);
  await run.expect('« Mettre à la corbeille » grisé', 'le clic devait dire d\'ouvrir l\'app', state => state.notices.at(-1) === t('trash.openApp', { app: APP }) && names(state).includes(FILE) && !state.trashCount && state.menu.length === 0);
  await openMenu(run);
  const duplicate = await run.page.run(centerOfMenuItem, t('ex.duplicate'));
  await run.page.click(...duplicate);
  await run.expect('« Dupliquer » grisé', 'le clic devait dire d\'ouvrir l\'app, sans copie', state => state.notices.at(-1) === t('copy.openApp', { app: APP }) && state.copies.length === 0 && !names(state).includes(`${FILE} (1)`));
}

// App fermée : Suppr, et Ctrl+C puis Ctrl+V, disent la même chose et ne bougent rien ; la sélection reste sur la ligne.
async function closedKeys(run, t) {
  await run.reset();
  await setApp(run.page, false);
  await run.click(FILE);
  await run.page.press('Delete');
  await run.expect('Suppr', 'Suppr devait dire d\'ouvrir l\'app, sans rien mettre à la corbeille ni changer la ligne choisie', state => state.notices.at(-1) === t('trash.openApp', { app: APP }) && state.selected === FILE && !state.trashCount);
  await run.page.chord('Control', 'c');
  await run.page.chord('Control', 'v');
  await run.expect('Ctrl+C puis Ctrl+V', 'le collage devait dire d\'ouvrir l\'app, sans copie', state => state.notices.at(-1) === t('copy.openApp', { app: APP }) && state.copies.length === 0 && !names(state).includes(`${FILE} (1)`));
  await setApp(run.page, true);
  await run.page.chord('Control', 'v');
  await run.expect('Ctrl+V app ouverte', 'ce qui avait été copié devait se coller dès que l\'app est ouverte', state => names(state).includes(`${FILE} (1)`) && state.copies.length === 0);
}

// App ouverte : les gestes marchent, et la phrase de l'app s'ajoute à celle de GFS.
async function openApp(run, t) {
  await run.reset();
  const app = await said(run.page);
  await run.click(FILE);
  await run.page.chord('Control', 'c');
  await run.page.chord('Control', 'v');
  await run.expect('copier', 'la copie devait être faite, la phrase de l\'app ajoutée à celle de GFS, et la copie prendre le clavier', state => names(state).includes(`${FILE} (1)`) && state.selected === `${FILE} (1)`
    && state.notices.at(-1) === `${t('copy.done', { as: `${FILE} (1)` })} ${app.copy}`);
  await run.click(FILE);
  await run.page.press('Delete');
  await run.expect('mettre à la corbeille', 'le fichier devait aller à la corbeille, la phrase de l\'app ajoutée à celle de GFS', state => !names(state).includes(FILE) && state.trashCount === '1'
    && state.notices.at(-1) === `${t('trash.moved', { name: FILE })} ${app.trash}`);
}

// À la corbeille, restaurer et supprimer pour de bon n'ont pas besoin de l'app : leurs articles ne sont pas grisés app fermée.
async function trashWithoutApp(run, t) {
  await run.reset();
  await run.click(FILE);
  await run.page.press('Delete');
  await run.expect('Suppr', 'le fichier devait aller à la corbeille', state => state.trashCount === '1');
  await setApp(run.page, false);
  await run.clickSelector('.tr-row[data-view="trash"]');
  await run.expect('la corbeille', 'la corbeille devait lister le fichier', state => names(state).join() === FILE);
  await openMenu(run);
  await run.expect('menu de la corbeille', '« Restaurer » et « Supprimer définitivement… » ne devaient pas être grisés app fermée', state => [t('trash.restore'), t('trash.purge')].every(label => {
    const entry = state.menu.find(item => item.label === label);
    return entry && entry.greyed === false;
  }));
  const restore = await run.page.run(centerOfMenuItem, t('trash.restore'));
  await run.page.click(...restore);
  await run.expect('restaurer', 'le fichier devait être restauré, app fermée', state => !state.trashCount && state.notices.at(-1) === t('trash.restored', { name: FILE }));
}

// Les mesures du fichier composite, dans la langue de la page ; rend les écarts { kind, text }.
export async function compositeProblems(page, language, tag) {
  const found = [];
  const t = createI18n(language).t;
  const run = new Run(page, tag, found, 'fichier d\'une app ouverte');
  for (const step of [closedMenu, closedKeys, openApp, trashWithoutApp]) {
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
