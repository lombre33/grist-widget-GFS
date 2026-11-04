// Les dossiers sans fichier depuis l'explorateur (décision du porteur, 04/11 : « créer des dossiers et sous-dossiers », tout se fait depuis l'explorateur ; contrats 6.4, point 11), joués dans un VRAI serveur
// Grist (l'image officielle, `bash vrai-serveur.sh`) avec les modèles de Publipostage+, à 700 × 400, à la vraie souris et au vrai clavier. Ce que ni grist-static ni un faux Grist écrit par nous ne peuvent dire :
// la table du rangement qui naît avec l'accord de la personne au premier dossier, la ligne d'état écrite avec l'adresse que Grist donne, ce que Grist fait d'un lot qui mêle fichiers et dossiers, et que la
// personne retrouve ses dossiers vides en rechargeant GFS. Chromium seulement (test/dossiers-firefox.mjs mesure l'interface dans un vrai Firefox).
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-dossiers.mjs        (LAB_LANG=fr|en, LAB_SCHEME=light|dark)
//   1. Un modèle part à la corbeille avec la table du rangement absente : aucune question pour elle, aucune table créée ; le dossier d'un seul modèle disparaît (la limite dite), puis le modèle revient.
//   2. « Nouveau dossier » à la racine : la fenêtre dit où il naît, la question de la table du rangement, puis une ligne d'état à l'adresse de la personne (ni app ni fichier) ; la sonde n'a rien laissé.
//   3. GFS rechargé : le dossier vide est toujours là. Un sous-dossier, « Dossier vide. » dans l'un et l'autre.
//   4. Déplacer un modèle dans le dossier vide (la fenêtre le propose), puis le couper-coller dehors : le dossier reste, une seule ligne d'état par dossier.
//   5. Le dernier modèle d'un dossier (celui que l'app range seule) part à la corbeille : le dossier reste, une ligne d'état s'écrit ; restaurer ramène le modèle dedans.
//   6. F2 sur un dossier vide : lui et son sous-dossier changent de nom dans le même lot, sans reste ; Ctrl+X puis Ctrl+V le déplace ; Suppr le supprime avec son sous-dossier vide.
//   7. Un dossier qui a des fichiers ne se supprime pas (Suppr, et l'article grisé du menu) ; le dossier d'une autre personne n'est ni vu ni touché ; la table de l'app n'est pas touchée ; la console reste muette.
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n.js';
import { seedFiles } from './seed.mjs';
import { PAGE_PORT, openGfs, folders, names, waitForNames, waitForToast, shot, rowOf, goTo, openRowMenu, contrastProblems, windowFits, pressGreyed } from './lab-pdf.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const TAG = `dossiers-${lang}-${scheme}`;
const ME = 'essai@example.com';
const OTHER = 'autre@example.com';
const MODELS = 'Publipostage_Modeles';
const PREFS = 'Publipostage_PreferencesModeles';
const FILING = 'GFS_Rangement';
const IN_PANEL = '{"shown":true,"inPanel":true,"overflowing":[]}';
const sorted = list => [...list].sort();
const exact = text => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
const said = (frame, key, params) => waitForToast(frame, exact(t(key, params)));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sameNames = async (frame, expected) => {
  const found = await waitForNames(frame, expected);
  const ok = same(sorted(found), sorted(expected));
  if (!ok) say(`  (la liste montre : ${JSON.stringify(found)}, attendu : ${JSON.stringify(expected)})`);
  return ok;
};
// Les dossiers de la liste portent ces noms (dans n'importe quel ordre) ; sinon, le dit : ceux qu'on voit.
async function sameFolders(frame, expected) {
  await frame.waitForFunction(wanted => JSON.stringify([...document.querySelectorAll('.ls-row.folder .nm .t')].map(node => node.textContent).sort()) === JSON.stringify(wanted), sorted(expected), { timeout: 20000 }).catch(() => {});
  const found = await folders(frame);
  const ok = same(sorted(found), sorted(expected));
  if (!ok) say(`  (les dossiers montrés : ${JSON.stringify(found)}, attendu : ${JSON.stringify(expected)})`);
  return ok;
}

// Une écriture directe dans le document (la page de Grist est de l'origine du serveur : la session de la personne d'essai suffit).
const apply = (run, actions) => run.page.evaluate(async ([docId, body]) => (await fetch(`/api/docs/${docId}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(), [run.docId, actions]);
const modelRows = run => run.rest.rows(MODELS);
const byName = (rows, name) => rows.find(row => row.Nom === name);
const textOf = async locator => ((await locator.count()) ? locator.first().textContent() : null);
const selectedFolder = frame => textOf(frame.locator('.ls-row.folder[aria-selected="true"] .nm .t'));
const selectedName = frame => textOf(frame.locator('.ls-row[aria-selected="true"] .nm .t'));
const goHome = frame => goTo(frame, new RegExp(`^\\s*${t('ex.me')}\\s*\\d*\\s*$`));
const openTrash = frame => goTo(frame, new RegExp(`^\\s*${t('trash.view')}`));
const folderRow = (frame, name) => frame.locator('.ls-row.folder', { has: frame.locator('.t', { hasText: exact(name) }) });
const enterPath = async (frame, path) => { await goHome(frame); for (const part of path.split('/').filter(Boolean)) await folderRow(frame, part).dblclick(); };
const pillOf = frame => (name) => textOf(folderRow(frame, name).locator('.pill'));
// Le message de la liste vide, ou null ; attendu un instant, hors « Lecture des fichiers… » : la phrase d'un geste de la corbeille précède la relecture de la liste.
const emptyText = async frame => {
  await frame.waitForFunction(loading => { const node = document.querySelector('.ex-scroll .empty'); return node && !node.hidden && node.textContent.trim() && node.textContent.trim() !== loading; }, t('ex.loading'), { timeout: 8000 }).catch(() => {});
  return (await frame.locator('.ex-scroll .empty').isVisible()) ? (await frame.locator('.ex-scroll .empty').textContent()).trim() : null;
};
// Les lignes d'état de dossier d'une personne dans GFS_Rangement : ni app ni fichier, un chemin ; ce que la personne garde sans fichier.
const stateRows = async (run, who = ME) => (await run.rest.rows(FILING)).filter(row => row.Utilisateur === who && !row.App && !row.Fichier && row.Dossier).map(row => row.Dossier).sort();
const stateLines = async (run, who = ME) => (await run.rest.rows(FILING)).filter(row => row.Utilisateur === who && !row.App && !row.Fichier && row.Dossier);
const filingOf = async (run, app, id) => (await run.rest.rows(FILING)).filter(row => row.App === app && String(row.Fichier) === String(id));
const newButton = frame => frame.getByRole('button', { name: exact(t('ex.new')) });

// Le menu « Nouveau », « Nouveau dossier », et la fenêtre qui s'ouvre : rend son titre.
async function openNewFolder(run) {
  const { frame } = run;
  await newButton(frame).click();
  const item = frame.getByRole('menuitem', { name: new RegExp(`^${t('ex.newFolder')}`) });
  await item.waitFor();
  const first = (await frame.locator('.menu .menu-item').first().textContent()).trim();
  check('le menu « Nouveau » commence par « Nouveau dossier », dégrisé', first.startsWith(t('ex.newFolder')) && (await item.getAttribute('aria-disabled')) !== 'true', first);
  await item.click();
  await frame.locator('#nw-title').waitFor();
  return (await frame.locator('#nw-title').textContent()).trim();
}

async function typeAndEnter(run, name) {
  await run.page.keyboard.type(name);
  await run.page.keyboard.press('Enter');
}

const reload = async run => {
  await run.frame.evaluate(() => location.reload());
  await run.frame.waitForFunction(() => document.body.dataset.gfs === 'ready', null, { timeout: 60000 });
  await run.page.waitForTimeout(800);
};

// ----- 0. Les modèles de l'app, rangés par l'app seule (« Facturation » n'a qu'un modèle), comme dans un document où GFS n'a encore rien écrit.
async function prepare(run) {
  const { frame } = run;
  say('--- 0. les modèles de Publipostage+ ---');
  await seedFiles(frame);
  await apply(run, [['AddColumn', MODELS, 'Jeton', { type: 'Text' }]]);
  const ids = Array.from({ length: 18 }, (unused, i) => i + 1);
  await apply(run, [['BulkUpdateRecord', MODELS, ids, { Jeton: ids.map(id => `j${id}`) }]]);
  await reload(run);
  run.before = await modelRows(run);
  check('les modèles sont là, rangés par l\'app : quatre dossiers, « Facturation » n\'a qu\'un modèle ; la table du rangement de GFS n\'existe pas', await sameFolders(frame, ['Événementiel', 'Facturation', 'Formation', 'Stock'])
    && !(await run.rest.tables()).includes(FILING), await run.rest.tables());
}

// ----- 1. À la corbeille sans la table du rangement : aucune question pour elle, aucune table créée ; le dossier d'un seul modèle disparaît (la limite dite), le modèle revient.
async function playQuiet(run) {
  const { page, frame } = run;
  say('--- 1. à la corbeille, sans la table du rangement ---');
  await folderRow(frame, 'Facturation').dblclick();
  check('« Facturation » a un seul modèle', await sameNames(frame, ['Facture / devis multi-TVA']));
  await rowOf(frame, 'Facture / devis multi-TVA').click();
  await page.keyboard.press('Delete');
  await frame.locator('#ask-title').waitFor();
  check('la seule question est celle de la table de la corbeille (GFS_Corbeille), pas celle du rangement', (await frame.locator('#ask-title').textContent()) === t('trash.table.title'), await frame.locator('#ask-title').textContent());
  await frame.locator('[data-fk="ask-yes"]').click();
  const moved = await said(frame, 'trash.moved', { name: 'Facture / devis multi-TVA' });
  await goHome(frame);
  check('le modèle est à la corbeille ; la table du rangement n\'est pas née (on ne la crée pas pour garder un dossier) ; sans elle, le dossier d\'un seul modèle disparaît',
    moved === t('trash.moved', { name: 'Facture / devis multi-TVA' }) && !(await run.rest.tables()).includes(FILING) && await sameFolders(frame, ['Événementiel', 'Formation', 'Stock']), [moved, await run.rest.tables()]);
  await openTrash(frame);
  await rowOf(frame, 'Facture / devis multi-TVA').click();
  await page.keyboard.press('Enter');
  await said(frame, 'trash.restored', { name: 'Facture / devis multi-TVA' });
  await goHome(frame);
  check('restauré, le modèle est de retour dans « Facturation », qui revient avec lui', await sameFolders(frame, ['Événementiel', 'Facturation', 'Formation', 'Stock']));
  // Les modèles de l'app sont rangés pour la personne d'essai : GFS les verra dès qu'il connaîtra son adresse (la table du rangement la lui apprend).
  const prefs = (await run.rest.rows(PREFS)).filter(row => row.Utilisateur === '').map(row => row.id);
  await apply(run, [['BulkUpdateRecord', PREFS, prefs, { Utilisateur: prefs.map(() => ME) }]]);
  run.prefsBefore = await run.rest.rows(PREFS);
  await reload(run);
}

// ----- 2. « Nouveau dossier » à la racine : la table naît avec l'accord de la personne, la ligne d'état est à son adresse.
async function playCreate(run) {
  const { page, frame } = run;
  say('--- 2. « Nouveau dossier » à la racine ---');
  await goHome(frame);
  const title = await openNewFolder(run);
  check('la fenêtre dit où naît le dossier (« Moi »), le clavier est dans le champ, elle tient dans le panneau et se lit (4,5:1)', title === t('ex.newFolderTitle', { folder: t('ex.me') })
    && (await frame.locator('#nw-input').evaluate(node => node === document.activeElement)) && JSON.stringify(await windowFits(frame)) === IN_PANEL && (await contrastProblems(frame, '.mod')).length === 0, [title, await windowFits(frame), await contrastProblems(frame, '.mod')]);
  await shot(frame, `${TAG}-1-nouveau`);
  await typeAndEnter(run, 'Contrats');
  await frame.locator('#ask-title').waitFor();
  check('la table du rangement n\'existe pas : la question dit ce que GFS y garde (les dossiers y sont), et rien n\'est encore créé', (await frame.locator('#ask-title').textContent()) === t('table.title')
    && (await frame.locator('.ask').textContent()).includes(t('table.text').slice(0, 40)) && !(await run.rest.tables()).includes(FILING), await frame.locator('#ask-title').textContent());
  await frame.locator('[data-fk="ask-yes"]').click();
  check('le dossier est là, avec les quatre de l\'app (l\'adresse de la personne est connue : ses modèles retrouvent leurs dossiers)', await sameFolders(frame, ['Contrats', 'Événementiel', 'Facturation', 'Formation', 'Stock']));
  const lines = await stateLines(run);
  const all = await run.rest.rows(FILING);
  check('une ligne d\'état à l\'adresse de la personne : ni app ni fichier, le chemin, sans favori ; la ligne-sonde n\'a rien laissé', lines.length === 1 && lines[0].Dossier === 'Contrats' && lines[0].Favori === false && all.every(row => row.Utilisateur !== '@sonde'), all);
  check('le dossier prend le clavier, sans fichier (« 0 fichier »), et la barre d\'information le nomme', await selectedFolder(frame) === 'Contrats' && await pillOf(frame)('Contrats') === t('ex.fileCount', { n: 0 })
    && (await frame.locator('.ex-info').textContent()).includes('Contrats'), [await selectedFolder(frame), await pillOf(frame)('Contrats')]);
  await shot(frame, `${TAG}-2-cree`);
  check('la liste se lit (4,5:1)', (await contrastProblems(frame, '.ex-main')).length === 0 && (await contrastProblems(frame, '.ex-info')).length === 0, [await contrastProblems(frame, '.ex-main'), await contrastProblems(frame, '.ex-info')]);
  await page.keyboard.press('Enter');
  check('Entrée ouvre le dossier : « Dossier vide. », pas « Aucun fichier »', await emptyText(frame) === t('ex.emptyFolder'), await emptyText(frame));
  await page.keyboard.press('Backspace');
  check('Retour arrière, dans un dossier vide, ramène à la racine (le clavier n\'est pas perdu)', await folderRow(frame, 'Contrats').count() === 1);
}

// ----- 3. GFS rechargé : le dossier vide est toujours là ; un sous-dossier.
async function playReloadAndSub(run) {
  const { page, frame } = run;
  say('--- 3. GFS rechargé, un sous-dossier ---');
  const before = await run.rest.rows(FILING);
  await reload(run);
  check('GFS rechargé : « Contrats » est toujours là, sans fichier ; aucune ligne de plus', await sameFolders(frame, ['Contrats', 'Événementiel', 'Facturation', 'Formation', 'Stock']) && await pillOf(frame)('Contrats') === t('ex.fileCount', { n: 0 })
    && (await run.rest.rows(FILING)).length === before.length, before);
  await folderRow(frame, 'Contrats').dblclick();
  check('on y ouvre « Dossier vide. »', await emptyText(frame) === t('ex.emptyFolder'));
  const title = await openNewFolder(run);
  check('la fenêtre du sous-dossier nomme le dossier ouvert', title === t('ex.newFolderTitle', { folder: 'Contrats' }), title);
  await typeAndEnter(run, '2026');
  check('« 2026 » naît dans « Contrats », prend le clavier, avec sa ligne d\'état', await sameFolders(frame, ['2026']) && await selectedFolder(frame) === '2026' && same(await stateRows(run), ['Contrats', 'Contrats/2026']), await stateRows(run));
  await folderRow(frame, '2026').dblclick();
  check('le sous-dossier est vide aussi', await emptyText(frame) === t('ex.emptyFolder'));
  // Les refus : nom vide, nom d'un voisin.
  await goHome(frame);
  await openNewFolder(run);
  await page.keyboard.press('Enter');
  const empty = await textOf(frame.locator('.nw-note'));
  await typeAndEnter(run, 'formation');
  const taken = await textOf(frame.locator('.nw-note'));
  check('un nom vide ou celui d\'un voisin (« formation » pour « Formation ») est refusé dans la fenêtre, qui dit pourquoi ; rien n\'est écrit', empty === t('ex.nameEmpty') && taken === t('ex.folderTaken') && same(await stateRows(run), ['Contrats', 'Contrats/2026']), [empty, taken]);
  await page.keyboard.press('Escape');
  await frame.locator('#nw-title').waitFor({ state: 'hidden' });
}

// ----- 4. Déplacer un modèle dans le dossier vide, puis le couper-coller dehors.
async function playMoveInOut(run) {
  const { page, frame } = run;
  say('--- 4. un modèle entre dans le dossier vide et en sort ---');
  await goHome(frame);
  const quittance = byName(await modelRows(run), 'Quittance de loyer');
  await openRowMenu(frame, 'Quittance de loyer');
  await frame.getByRole('menuitem', { name: new RegExp(`^${t('ex.move')}`) }).click();
  const target = frame.locator('[data-fk="move-Contrats/2026"]');
  await target.waitFor();
  check('la fenêtre du déplacement propose le dossier vide et son sous-dossier', await frame.locator('[data-fk="move-Contrats"]').count() === 1 && await target.count() === 1);
  await target.click();
  await enterPath(frame, 'Contrats/2026');
  const lines = await filingOf(run, 'publipostage', quittance.id);
  check('le modèle est dans « Contrats/2026 » : une ligne de rangement à l\'adresse de la personne ; les lignes d\'état n\'ont pas bougé ; la table de l\'app n\'est pas touchée',
    await sameNames(frame, ['Quittance de loyer']) && lines.length === 1 && lines[0].Dossier === 'Contrats/2026' && lines[0].Utilisateur === ME && same(await stateRows(run), ['Contrats', 'Contrats/2026'])
    && same(await run.rest.rows(PREFS), run.prefsBefore), [lines, await stateRows(run)]);
  await goHome(frame);
  check('« Contrats » compte désormais un fichier (celui de son sous-dossier)', await pillOf(frame)('Contrats') === t('ex.fileCount', { n: 1 }), await pillOf(frame)('Contrats'));
  await enterPath(frame, 'Contrats/2026');
  await rowOf(frame, 'Quittance de loyer').click();
  await page.keyboard.press('Control+x');
  await said(frame, 'clip.cut', { name: 'Quittance de loyer' });
  await goHome(frame);
  await page.keyboard.press('Control+v');
  await said(frame, 'clip.moved', { name: 'Quittance de loyer', folder: t('ex.me') });
  const after = await filingOf(run, 'publipostage', quittance.id);
  const state = await stateLines(run);
  check('coupé-collé dehors, le modèle est à la racine ; le dossier qu\'il quitte reste : une seule ligne d\'état par dossier, pas de doublon', await sameNames(frame, ['Contrat de prestation', 'Quittance de loyer', 'Support de session'])
    && after.length === 1 && after[0].Dossier === '' && same(state.map(row => row.Dossier).sort(), ['Contrats', 'Contrats/2026']), [after, state]);
  await enterPath(frame, 'Contrats/2026');
  check('« Contrats/2026 » est de nouveau vide, et existe toujours', await emptyText(frame) === t('ex.emptyFolder'));
}

// ----- 5. Le dernier modèle d'un dossier (rangé par l'app seule) part à la corbeille : le dossier reste ; restaurer le ramène dedans.
async function playLastFile(run) {
  const { page, frame } = run;
  say('--- 5. le dernier modèle d\'un dossier part à la corbeille ---');
  await enterPath(frame, 'Facturation');
  check('« Facturation » a un seul modèle, et aucune ligne d\'état ne la garde encore', await sameNames(frame, ['Facture / devis multi-TVA']) && !(await stateRows(run)).includes('Facturation'), await stateRows(run));
  await rowOf(frame, 'Facture / devis multi-TVA').click();
  await page.keyboard.press('Delete');
  await said(frame, 'trash.moved', { name: 'Facture / devis multi-TVA' });
  const emptied = await emptyText(frame);
  check('la table du rangement existe : la ligne d\'état de « Facturation » s\'écrit, le dossier reste, vide', emptied === t('ex.emptyFolder') && (await stateRows(run)).includes('Facturation'), [emptied, await stateRows(run), await frame.locator('.crumbs').textContent(), await names(frame)]);
  await goHome(frame);
  check('à la racine, « Facturation » est toujours là, sans fichier ; un modèle de plus à la corbeille', await sameFolders(frame, ['Contrats', 'Événementiel', 'Facturation', 'Formation', 'Stock']) && await pillOf(frame)('Facturation') === t('ex.fileCount', { n: 0 }));
  await openTrash(frame);
  await rowOf(frame, 'Facture / devis multi-TVA').click();
  const info = await frame.locator('.ex-info').textContent();
  check('à la corbeille, la barre dit où le modèle reviendra (« Facturation »)', info.includes('Facturation'), info);
  await page.keyboard.press('Enter');
  await said(frame, 'trash.restored', { name: 'Facture / devis multi-TVA' });
  await enterPath(frame, 'Facturation');
  check('restauré, le modèle est de retour dans « Facturation » (même numéro, mêmes valeurs)', await sameNames(frame, ['Facture / devis multi-TVA']) && same(byName(await modelRows(run), 'Facture / devis multi-TVA'), byName(run.before, 'Facture / devis multi-TVA')));
}

// ----- 6. F2, Ctrl+X puis Ctrl+V et Suppr sur un dossier vide.
async function playEmptyFolderGestures(run) {
  const { page, frame } = run;
  say('--- 6. renommer, déplacer, supprimer un dossier vide ---');
  await goHome(frame);
  await folderRow(frame, 'Contrats').click();
  await page.keyboard.press('F2');
  await frame.locator('#nw-title').waitFor();
  await typeAndEnter(run, 'Contrats clients');
  check('F2 : le dossier et son sous-dossier changent de nom dans le même lot ; aucune ligne de l\'ancien nom ne reste', await sameFolders(frame, ['Contrats clients', 'Événementiel', 'Facturation', 'Formation', 'Stock'])
    && same(await stateRows(run), ['Contrats clients', 'Contrats clients/2026', 'Facturation']), await stateRows(run));
  await folderRow(frame, 'Contrats clients').click();
  await page.keyboard.press('Control+x');
  await said(frame, 'clip.cut', { name: 'Contrats clients' });
  await folderRow(frame, 'Stock').dblclick();
  await page.keyboard.press('Control+v');
  await said(frame, 'clip.moved', { name: 'Contrats clients', folder: 'Stock' });
  check('Ctrl+X puis Ctrl+V : le dossier vide et son sous-dossier vont dans « Stock » (leurs lignes d\'état suivent) ; il ne reste rien à la racine', await sameFolders(frame, ['Contrats clients'])
    && same(await stateRows(run), ['Facturation', 'Stock/Contrats clients', 'Stock/Contrats clients/2026']), await stateRows(run));
  await folderRow(frame, 'Contrats clients').click();
  await page.keyboard.press('Delete');
  const deleted = await said(frame, 'ex.folderDeleted', { name: 'Contrats clients' });
  check('Suppr : le dossier vide et son sous-dossier vide sont supprimés, sans question ; la phrase le dit ; il reste « Facturation »', deleted === t('ex.folderDeleted', { name: 'Contrats clients' }) && same(await stateRows(run), ['Facturation'])
    && await frame.locator('.ls-row.folder').count() === 0, [deleted, await stateRows(run)]);
}

// ----- 7. Un dossier plein ne se supprime pas ; une autre personne ; la table de l'app ; la console.
async function playRefusals(run) {
  const { page, frame } = run;
  say('--- 7. les refus, une autre personne ---');
  await goHome(frame);
  await folderRow(frame, 'Stock').click();
  await page.keyboard.press('Delete');
  const refused = await said(frame, 'ex.folderNotEmpty');
  check('Suppr sur un dossier qui a des fichiers : la phrase dit quoi faire, rien n\'est écrit', refused === t('ex.folderNotEmpty') && await folderRow(frame, 'Stock').count() === 1 && same(await stateRows(run), ['Facturation']), refused);
  await folderRow(frame, 'Stock').hover();
  await folderRow(frame, 'Stock').locator('.rb.mn').click();
  const item = frame.getByRole('menuitem', { name: new RegExp(`^${t('ex.deleteFolder')}`) });
  check('le menu du dossier plein a « Supprimer le dossier » grisé, avec Suppr pour touche', (await item.getAttribute('aria-disabled')) === 'true' && (await item.textContent()).includes(t('key.delete')), await item.textContent());
  await shot(frame, `${TAG}-3-menu`);
  await pressGreyed(page, item);
  check('un clic sur l\'article grisé redit pourquoi', await said(frame, 'ex.folderNotEmpty') === t('ex.folderNotEmpty'));
  // Une autre personne a un dossier à elle : GFS ne le montre pas, et ne le touche pas.
  await apply(run, [['AddRecord', FILING, null, { Utilisateur: OTHER, App: '', Fichier: '', Dossier: 'Chez l\'autre', Favori: false }]]);
  await reload(run);
  check('le dossier d\'une autre personne n\'est pas montré', await sameFolders(frame, ['Événementiel', 'Facturation', 'Formation', 'Stock']), await folders(frame));
  await openNewFolder(run);
  await typeAndEnter(run, 'Provisoire');
  await sameFolders(frame, ['Événementiel', 'Facturation', 'Formation', 'Provisoire', 'Stock']);
  await page.keyboard.press('Delete');
  await said(frame, 'ex.folderDeleted', { name: 'Provisoire' });
  check('supprimer un dossier de la personne ne touche pas celui de l\'autre', same(await stateRows(run, OTHER), ['Chez l\'autre']) && same(await stateRows(run), ['Facturation']), [await stateRows(run, OTHER), await stateRows(run)]);
  const rows = await modelRows(run);
  check('la table des modèles de l\'app et ses réglages n\'ont pas bougé (GFS écrit dans sa table, pas dans celle de l\'app)', same(rows, run.before) && same(await run.rest.rows(PREFS), run.prefsBefore), [rows.length, run.before.length]);
}

const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, server, { colorScheme: scheme });
  const run = await openGfs(context, { lang, mirrors: true });
  check('GFS est à 700 × 400 dans le vrai Grist', Math.abs(run.box.width - 700) <= 1 && Math.abs(run.box.height - 400) <= 1, run.box);
  await prepare(run);
  await playQuiet(run);
  await playCreate(run);
  await playReloadAndSub(run);
  await playMoveInOut(run);
  await playLastFile(run);
  await playEmptyFolderGestures(run);
  await playRefusals(run);
  const unexpected = run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
  check('aucune erreur ni avertissement de GFS dans la console (hors les refus de la politique que l\'essai a posés lui-même)', unexpected.length === 0, unexpected);
} finally {
  await browser.close();
  pages.close();
}
