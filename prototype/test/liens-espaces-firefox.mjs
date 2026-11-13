// Les liens entre espaces sous Firefox (règle du 03/11 : toute nouvelle interface ajoute ses mesures à test/interfaces-firefox.test.mjs ; contrats 11.7, point 13.o, 13/11). Le vrai explorateur, le vrai contrôle
// (js/sharing/link-control.js), ses trois vraies fenêtres (choisir, nommer, demander) et le vrai calcul des lignes à écrire, sur un faux Grist en mémoire (test/pages/explorateur.js, `window.__spaceLinks`) : ce que Grist en fait
// (qui lit, qui écrit, ce qu'un éditeur forge) se mesure dans un vrai Grist (labo/run-liens-espaces.mjs). Ici, la mise en page à 700 × 400 et les gestes, à la vraie souris et au vrai clavier :
//   le menu d'un dossier d'espace : « Lier dans un espace… » (dégrisé pour un propriétaire, il tient dans la page, son nom ne touche pas sa touche) ; sans être propriétaire, la phrase le dit et aucune fenêtre ne s'ouvre ;
//   les trois fenêtres d'un dossier : l'espace (la recherche a le clavier, Échap n'écrit rien, choisir l'espace d'origine dit pourquoi et n'écrit rien), le nom (le nom du dossier en tête, vide ou déjà pris : refusé sous le champ,
//   la fenêtre reste), le droit (le texte nomme le dossier et les groupes de l'espace) ; chacune tient dans la page, titre et boutons en place, rien n'en sort ; à la fin, deux lignes écrites (le partage et le lien), la phrase dite,
//   le dossier lié dans l'espace ; un fichier : la deuxième fenêtre est la liste des dossiers de l'espace, la racine d'abord ;
//   le menu d'un dossier lié : « Ouvrir » dégrisé, renommer, déplacer et partager grisés, « Retirer le lien » dégrisé ; « Retirer le lien » pose sa question (« Annuler » a le clavier, rien n'est écrit), un oui écrit le retrait
//   du lien et de ses droits seulement.
import { createI18n } from '../js/i18n/i18n.js';
import { Run, centerOfName, names } from './corbeille-firefox.mjs';
import { centerOfMenuItem, menuFits } from './copier-firefox.mjs';
import { windowMeasure, windowTools } from './fenetre-firefox.mjs';

const BODIES = { pick: '.mod-body', ask: '.ask-body' };

// La fenêtre ouverte (les trois sont des `.mod` ; `pk` : la liste, `nw` et `ask` : le champ ou la question), avec ce que le parcours a écrit et dit.
function measure(page, kind) {
  return page.run(windowMeasure, '.mod', BODIES[kind], {
    search: ['[data-fk="pick-search"]', 'value'], name: ['[data-fk="name-input"]', 'value'], hint: ['.mod-note', 'text'], asked: ['.ask-body p', 'text'],
  }, { notices: ['__notices', []], actions: ['__linkActions', []] });
}

function toolsFor(page, run, kind) {
  const snap = () => measure(page, kind);
  const tools = windowTools(page, run, snap);
  return { ...tools, snap };
}

// Se rend dans « Espaces > Achats » (le dossier Contrats et son sous-dossier), ou dans « Espaces > Ventes », et rend l'état ; `variant` : 'lie' quand Contrats est déjà lié dans Ventes.
async function goTo(run, t, space, variant = 'neuf') {
  await run.reset();
  await run.page.run(which => window.__spaceLinks(which), variant);
  await run.clickSelector('.tr-row[data-path="Espaces"]');
  await run.expect('« Espaces »', 'la racine devait lister les deux espaces', state => names(state).includes('Achats') && names(state).includes('Ventes'));
  await run.click(space);
  await run.page.press('Enter');
  return run.expect(`l'espace ${space}`, `l'espace ${space} devait s'ouvrir`, state => state.crumbs.includes(space) && names(state).length > 0);
}

// Le menu d'une ligne, à la vraie souris : ses articles, ou null quand la ligne n'est pas là.
async function menuOf(run, name) {
  const at = await run.page.run(centerOfName, name);
  if (!at) { run.note('ligne introuvable', `« ${name} » n'est pas dans la liste`); return null; }
  await run.page.rightClick(...at);
  const state = await run.expect('menu', `le menu de « ${name} » devait s'ouvrir`, now => now.menu.length > 0);
  const problems = await run.page.run(menuFits);
  for (const problem of problems) run.note('menu', `le menu de « ${name} » : ${problem}`);
  return state.menu;
}

const itemOf = (menu, label) => (menu || []).find(item => item.label === label);

async function pressItem(run, label) {
  const at = await run.page.run(centerOfMenuItem, label);
  if (!at) { run.note('article introuvable', `« ${label} » devait être dans le menu`); return false; }
  await run.page.click(...at);
  return true;
}

// Les trois fenêtres d'un dossier : l'espace, le nom, le droit ; `kind` de chaque écran dans le parcours.
async function folderFlow(run, t) {
  const page = run.page;
  await goTo(run, t, 'Achats');
  const menu = await menuOf(run, 'Contrats');
  const item = itemOf(menu, t('slink.menu'));
  if (!item) { run.note('« Lier dans un espace… »', `l'article devait être dans le menu d'un dossier d'espace (${(menu || []).map(each => each.label).join(' | ')})`); await page.press('Escape'); return; }
  if (item.greyed) run.note('« Lier dans un espace… »', 'l\'article devait être dégrisé pour un propriétaire');
  await pressItem(run, t('slink.menu'));

  const pick = toolsFor(page, run, 'pick');
  const space = await pick.expect('fenêtre de l\'espace', 'la liste des espaces devait s\'ouvrir, la recherche au clavier', s => s.modal && s.modal.keys.includes('pick-search') && s.modal.focus === 'pick-search');
  pick.fits('fenêtre de l\'espace', space, 'l\'espace');
  if (space.modal && !space.modal.title.includes(t('slink.pick.title', { name: 'Contrats' }))) run.note('fenêtre de l\'espace', `le titre devait nommer le dossier (« ${space.modal.title} »)`);
  if (space.modal && !(space.modal.keys.includes('pick-ventes') && space.modal.keys.includes('pick-achats'))) run.note('fenêtre de l\'espace', 'les deux espaces devaient être dans la liste');
  await page.press('Escape');
  const closed = await pick.expect('Échap sur l\'espace', 'Échap devait fermer la fenêtre', s => s.modal === null);
  if (closed.actions.length) run.note('Échap sur l\'espace', 'fermer la fenêtre ne devait rien écrire');

  // l'espace d'origine : la phrase dit pourquoi, rien n'est écrit
  await pressItemAgain(run, t, 'Contrats');
  await pick.expect('fenêtre de l\'espace', 'la liste des espaces devait se rouvrir', s => s.modal && s.modal.keys.includes('pick-ventes'));
  await pick.press('l\'espace d\'origine', 'pick-achats');
  const same = await pick.expect('l\'espace d\'origine', 'choisir l\'espace d\'origine devait fermer la fenêtre et dire pourquoi', s => s.modal === null && s.notices.includes(t('slink.err.sameSpace', { space: 'Achats' })));
  if (same.actions.length) run.note('l\'espace d\'origine', 'rien ne devait être écrit');

  // l'espace Ventes : le nom
  await pressItemAgain(run, t, 'Contrats');
  await pick.expect('fenêtre de l\'espace', 'la liste des espaces devait se rouvrir', s => s.modal && s.modal.keys.includes('pick-ventes'));
  await pick.press('l\'espace Ventes', 'pick-ventes');
  const named = toolsFor(page, run, 'ask');
  const name = await named.expect('fenêtre du nom', 'la fenêtre du nom devait s\'ouvrir, le nom du dossier en tête, le clavier sur le champ', s => s.modal && s.modal.keys.includes('name-input') && s.modal.focus === 'name-input' && s.modal.name === 'Contrats');
  named.fits('fenêtre du nom', name, 'le nom');
  if (name.modal && !name.modal.title.includes(t('slink.name.title', { space: 'Ventes' }))) run.note('fenêtre du nom', `le titre devait nommer l'espace (« ${name.modal.title} »)`);
  await page.chord('Control', 'a');
  await page.press('Delete');
  await named.press('nom vide', 'name-ok');
  const empty = await named.expect('nom vide', 'un nom vide devait être refusé sous le champ, la fenêtre rester', s => s.modal && s.modal.keys.includes('name-input') && s.modal.hint === t('slink.err.invalid'));
  named.fits('nom vide', empty, 'le refus');
  await page.press(...'Contrats achats'.split(''));
  await named.press('nom', 'name-ok');

  // le droit
  const right = toolsFor(page, run, 'pick');
  const rights = await right.expect('fenêtre du droit', 'la fenêtre du droit devait s\'ouvrir', s => s.modal && s.modal.keys.includes('pick-lecture') && s.modal.keys.includes('pick-ecriture'));
  right.fits('fenêtre du droit', rights, 'le droit');
  if (rights.modal && !rights.modal.title.includes('Ventes')) run.note('fenêtre du droit', `le titre devait nommer l'espace (« ${rights.modal.title} »)`);
  const text = await page.run(() => (document.querySelector('.mod .wk-text') || {}).textContent || '');
  if (!text.includes('Contrats') || !text.includes('Commerciaux')) run.note('fenêtre du droit', `le texte devait nommer le dossier et les groupes de l'espace (« ${text.slice(0, 160)} »)`);
  await right.press('lecture', 'pick-lecture');
  const done = await right.expect('le lien écrit', 'le lien devait s\'écrire (le partage, puis le lien), la phrase dite', s => s.modal === null && s.actions.length === 2 && s.notices.some(note => note.includes('Ventes') && note.includes('Contrats')));
  const verbs = done.actions.map(action => `${action[0]}:${action[1]}`).join();
  if (verbs !== 'AddRecord:GFS_Partages,AddRecord:GFS_Placement') run.note('le lien écrit', `deux lignes devaient s'écrire, le partage puis le lien (écrit : ${verbs})`);
  await run.page.press('Backspace');
  await run.expect('retour à « Espaces »', 'Retour arrière devait revenir à la racine des espaces', state => names(state).includes('Ventes'));
  await run.click('Ventes');
  await page.press('Enter');
  await run.expect('le dossier lié', 'l\'espace Ventes devait montrer le dossier lié « Contrats achats »', state => names(state).includes('Contrats achats'));
}

// Rouvre « Lier dans un espace… » sur ce dossier, depuis son menu.
async function pressItemAgain(run, t, name) {
  await menuOf(run, name);
  await pressItem(run, t('slink.menu'));
}

// Un dossier qui a déjà son nom dans l'espace : refusé sous le champ (le lien est déjà là).
async function takenName(run, t) {
  const page = run.page;
  await goTo(run, t, 'Achats', 'lie');
  await menuOf(run, 'Contrats');
  await pressItem(run, t('slink.menu'));
  const pick = toolsFor(page, run, 'pick');
  await pick.expect('fenêtre de l\'espace', 'la liste des espaces devait s\'ouvrir', s => s.modal && s.modal.keys.includes('pick-ventes'));
  await pick.press('l\'espace Ventes', 'pick-ventes');
  const named = toolsFor(page, run, 'ask');
  await named.expect('fenêtre du nom', 'la fenêtre du nom devait s\'ouvrir', s => s.modal && s.modal.keys.includes('name-input'));
  await page.chord('Control', 'a');
  await page.press(...'Contrats achats'.split(''));
  await named.press('nom pris', 'name-ok');
  const refused = await named.expect('nom pris', 'un nom déjà pris dans l\'espace devait être refusé sous le champ', s => s.modal && s.modal.hint === t('slink.err.nameTaken'));
  named.fits('nom pris', refused, 'le refus');
  await named.press('nom pris', 'name-cancel');
  const after = await named.expect('Annuler le nom', '« Annuler » devait fermer la fenêtre sans rien écrire', s => s.modal === null && s.actions.length === 0);
  void after;
}

// Un fichier : la deuxième fenêtre est la liste des dossiers de l'espace, la racine d'abord ; le lien s'écrit sans dossier.
async function fileFlow(run, t) {
  const page = run.page;
  await goTo(run, t, 'Achats');
  await run.click('Contrats');
  await page.press('Enter');
  const inside = await run.expect('le dossier', 'Contrats devait montrer son modèle', state => names(state).length >= 1 && state.crumbs.includes('Contrats'));
  const file = names(inside).find(each => !inside.rows.find(row => row.name === each).folder);
  if (!file) { run.note('fichier', 'Contrats devait contenir un fichier'); return; }
  const menu = await menuOf(run, file);
  if (!itemOf(menu, t('slink.menu'))) { run.note('« Lier dans un espace… » d\'un fichier', 'l\'article devait être dans le menu d\'un fichier'); await page.press('Escape'); return; }
  await pressItem(run, t('slink.menu'));
  const pick = toolsFor(page, run, 'pick');
  await pick.expect('fenêtre de l\'espace', 'la liste des espaces devait s\'ouvrir', s => s.modal && s.modal.keys.includes('pick-ventes'));
  await pick.press('l\'espace Ventes', 'pick-ventes');
  const where = await pick.expect('dossier du fichier', 'la liste des dossiers de l\'espace devait s\'ouvrir, la racine d\'abord', s => s.modal && s.modal.keys[0] === 'pick-search' && s.modal.keys[1] === 'pick-');
  pick.fits('dossier du fichier', where, 'le dossier du fichier');
  if (where.modal && !where.modal.title.includes(t('slink.dir.title', { space: 'Ventes' }))) run.note('dossier du fichier', `le titre devait nommer l'espace (« ${where.modal.title} »)`);
  await pick.press('la racine', 'pick-'); // la valeur de la racine est vide : sa clé est « pick- »
  await pick.expect('le droit du fichier', 'la fenêtre du droit devait s\'ouvrir', s => s.modal && s.modal.keys.includes('pick-ecriture'));
  await pick.press('écriture', 'pick-ecriture');
  const done = await pick.expect('le lien du fichier écrit', 'le lien devait s\'écrire', s => s.modal === null && s.actions.length === 2);
  const place = done.actions.find(action => action[1] === 'GFS_Placement');
  if (!place || place[3].Dossier !== '' || place[3].Cible !== '') run.note('le lien du fichier écrit', `le lien devait être à la racine de l'espace, sans cible (écrit : ${JSON.stringify(place && place[3])})`);
  const share = done.actions.find(action => action[1] === 'GFS_Partages');
  if (!share || share[3].Droit !== 'ecriture') run.note('le lien du fichier écrit', `le droit devait être l'écriture (écrit : ${JSON.stringify(share && share[3])})`);
}

// Sans être propriétaire : la phrase, aucune fenêtre.
async function notOwner(run, t) {
  await goTo(run, t, 'Achats');
  await run.page.run(() => { window.__linkOwner = false; });
  await menuOf(run, 'Contrats');
  await pressItem(run, t('slink.menu'));
  const state = await run.expect('pas propriétaire', 'la phrase devait dire que seul un propriétaire lie', now => now.notices.includes(t('slink.why.owner')));
  const open = await run.page.run(() => Boolean(document.querySelector('.mod')));
  if (open) run.note('pas propriétaire', 'aucune fenêtre ne devait s\'ouvrir');
  void state;
}

// Le menu d'un dossier lié : ouvrir, retirer ; le reste grisé. « Retirer le lien » pose sa question.
async function linkMenu(run, t) {
  const page = run.page;
  await goTo(run, t, 'Ventes', 'lie');
  const menu = await menuOf(run, 'Contrats achats');
  if (!menu) return;
  const open = itemOf(menu, t('ex.openFolder'));
  if (!open || open.greyed) run.note('menu du dossier lié', '« Ouvrir » devait être dégrisé');
  const remove = itemOf(menu, t('slink.remove'));
  if (!remove) { run.note('menu du dossier lié', `« ${t('slink.remove')} » devait être dans le menu (${menu.map(each => each.label).join(' | ')})`); await page.press('Escape'); return; }
  if (remove.greyed) run.note('menu du dossier lié', '« Retirer le lien » devait être dégrisé pour un propriétaire');
  for (const label of [t('ex.rename'), t('ex.move'), t('share.menu')]) {
    const item = itemOf(menu, label);
    if (!item) run.note('menu du dossier lié', `« ${label} » devait rester dans le menu, grisé`);
    else if (!item.greyed) run.note('menu du dossier lié', `« ${label} » devait être grisé : un lien se travaille dans l'espace d'origine`);
  }
  await pressItem(run, t('ex.rename'));
  await run.expect('renommer un lien', 'un clic sur « Renommer » grisé devait dire pourquoi', now => now.notices.includes(t('slink.fixed')));
  await menuOf(run, 'Contrats achats');
  await pressItem(run, t('slink.remove'));
  const ask = toolsFor(page, run, 'ask');
  const question = await ask.expect('la question', 'la question devait s\'ouvrir, « Annuler » au clavier', s => s.modal && s.modal.keys.includes('ask-no') && s.modal.focus === 'ask-no');
  ask.fits('la question', question, 'la question');
  if (question.modal && !question.modal.body.includes(t('slink.remove.message', { space: 'Ventes' }))) run.note('la question', `la question devait dire que rien n'est supprimé (« ${question.modal.body.slice(0, 160)} »)`);
  await ask.press('Annuler', 'ask-no');
  const kept = await ask.expect('Annuler le retrait', '« Annuler » devait fermer la question sans rien écrire', s => s.modal === null && s.actions.length === 0);
  void kept;
  await menuOf(run, 'Contrats achats');
  await pressItem(run, t('slink.remove'));
  await ask.expect('la question', 'la question devait se rouvrir', s => s.modal && s.modal.keys.includes('ask-yes'));
  await ask.press('Retirer', 'ask-yes');
  const gone = await ask.expect('le retrait écrit', 'le retrait devait s\'écrire : la ligne du lien et le droit qu\'il avait posé', s => s.modal === null && s.actions.length === 2);
  const verbs = gone.actions.map(action => `${action[0]}:${action[1]}`).join();
  if (verbs !== 'BulkRemoveRecord:GFS_Partages,RemoveRecord:GFS_Placement') run.note('le retrait écrit', `deux lignes devaient partir, le droit et le lien, aucun fichier (écrit : ${verbs})`);
}

// Les mesures des liens entre espaces, dans la langue de la page ; rend les écarts { kind, text }.
export async function liensEspacesProblems(page, language, tag) {
  const found = [];
  const t = createI18n(language).t;
  const run = new Run(page, tag, found, 'liens entre espaces');
  for (const step of [folderFlow, takenName, fileFlow, notOwner, linkMenu]) {
    try {
      await step(run, t);
    } catch (error) {
      run.note('geste impossible', `${step.name} : ${String(error.message).slice(0, 200)}`);
      await page.press('Escape').catch(() => {});
    }
    if (await page.run(() => Boolean(document.querySelector('.mod')))) { run.note('fenêtre restée ouverte', `${step.name} devait laisser la page sans fenêtre`); await page.press('Escape'); }
  }
  await run.reset();
  return found;
}
