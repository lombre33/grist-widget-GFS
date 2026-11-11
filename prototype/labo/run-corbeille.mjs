// La corbeille de GFS (décision du porteur, 04/11 : tout se fait depuis l'explorateur, avec une corbeille ; contrats 6.6), jouée dans un VRAI serveur Grist (l'image officielle, `bash vrai-serveur.sh`) :
// mettre un PDF de GFS à la corbeille, le restaurer, le supprimer pour de bon, vider la corbeille, au clavier et à la souris, à 700 × 400. Ce que ni grist-static (pas de pièces jointes) ni un faux
// Grist écrit par nous ne peuvent dire : ce que Grist rend d'une cellule de date vide, une colonne ajoutée à une table qui a déjà des lignes, plusieurs suppressions dans un seul lot, et si le clavier
// arrive jusqu'au panneau quand il est dans le cadre de Grist. Chromium seulement : le Firefox de la personne reste à elle (test/corbeille-firefox.mjs le mesure dans un vrai Firefox).
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-corbeille.mjs        (LAB_LANG=fr|en, LAB_SCHEME=light|dark)
//   1. Une table d'une version plus ancienne (sans les deux colonnes de la corbeille) : Suppr les ajoute sans rien demander ; la ligne est marquée (date, personne), sa pièce jointe reste citée.
//   2. La vue « Corbeille » : le compte, la liste, la colonne « Supprimé » ; Entrée restaure, et la table efface les marques.
//   3. Un nom pris pendant que le fichier était à la corbeille : « Restaurer » le rend sous un autre nom, et la phrase le dit.
//   4. Supprimer pour de bon : la fenêtre donne le clavier à « Annuler », Échap ne supprime rien, « Supprimer définitivement » retire la ligne ; la pièce jointe reste (Grist l'efface seul).
//   5. Vider la corbeille : une seule question qui nomme les fichiers, un seul lot d'écriture, et seulement ce que la personne avait sous les yeux.
//   6. Le menu de la ligne (clic droit, Maj+F10, « Plus d'actions ») dit le raccourci de chaque geste ; la console de GFS reste muette.
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { PAGE_PORT, openGfs, importSamples, pdfFile, importPdf, names, waitForNames, waitForToast, toast, shot, rowOf, goTo, openRowMenu, contrastProblems, windowFits } from './lab-pdf.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const TAG = `${lang}-${scheme}`;
const ME = 'essai@example.com';
const IN_PANEL = '{"shown":true,"inPanel":true,"overflowing":[]}';
const sorted = list => [...list].sort();
const sameNames = async (frame, expected) => JSON.stringify(sorted(await waitForNames(frame, expected))) === JSON.stringify(sorted(expected));
// Une phrase de GFS, mot pour mot (les nombres et les noms viennent de `t`, donc la mesure suit la langue).
const exact = text => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
const said = (frame, key, params) => waitForToast(frame, exact(t(key, params)));

// Ce que le serveur retient de la table des PDF.
const rowNamed = async (rest, name) => (await rest.rows('GFS_Fichiers')).find(row => row.Nom === name);
const columnTypes = async rest => Object.fromEntries((await rest.columns('GFS_Fichiers')).map(column => [column.id, column.type]));
const marked = row => Boolean(row) && row.SupprimeLe > 0;

// Une écriture directe dans le document (le serveur de la personne d'essai : la page de Grist est de son origine, sa session suffit).
const apply = (run, actions) => run.page.evaluate(async ([docId, body]) => (await fetch(`/api/docs/${docId}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(), [run.docId, actions]);

// Les gestes de la vue « Corbeille » à la vraie souris.
const openTrash = (frame, name = t('trash.view')) => goTo(frame, new RegExp(`^\\s*${name}`));
const goHome = frame => goTo(frame, new RegExp(`^\\s*${t('ex.me')}\\s*\\d*\\s*$`));
// Le texte d'un élément s'il est là, sinon null tout de suite (`textContent` attendrait 30 s qu'il vienne).
const textOf = async locator => ((await locator.count()) ? locator.first().textContent() : null);
const selectedName = frame => textOf(frame.locator('.ls-row[aria-selected="true"] .nm .t'));
const trashCount = frame => textOf(frame.locator('.tr-row[data-view="trash"] .cnt'));

// ----- 0. GFS ne connaît l'adresse de la personne qu'une fois sa table de rangement lue : un premier favori la fait naître (avec l'accord), et l'adresse est celle que Grist donne.
async function pinFirst(run) {
  const { frame, rest } = run;
  say('--- 0. un premier favori, pour que GFS connaisse la personne ---');
  await rowOf(frame, 'Facture.pdf').hover();
  await rowOf(frame, 'Facture.pdf').locator('.rb.pin').click();
  await frame.locator('.mod.ask').waitFor();
  await frame.locator('[data-fk="ask-yes"]').click();
  await frame.waitForFunction(() => document.querySelector('.ls-row .rb.pin.on'), null, { timeout: 20000 });
  const lines = (await rest.rows('GFS_Rangement')).filter(row => row.App === 'gfs-fichiers');
  check('le favori est rangé pour la personne que Grist connaît', lines.length === 1 && lines[0].Utilisateur === ME, lines);
}

// ----- 1. Une table d'une version plus ancienne : Suppr ajoute les colonnes et marque la ligne.
async function playFirstTrash(run) {
  const { page, frame, rest } = run;
  say('--- 1. Suppr, sur une table d\'une version plus ancienne ---');
  const types = await columnTypes(rest);
  check('la table de GFS a les deux colonnes de la corbeille, dans les types voulus', types.SupprimeLe === 'DateTime:UTC' && types.SupprimePar === 'Text', types);
  const before = await rowNamed(rest, 'Devis.pdf');
  check('une cellule de date jamais écrite est vide pour Grist (null), pas une date', before.SupprimeLe === null || before.SupprimeLe === 0 || before.SupprimeLe === undefined, before.SupprimeLe);
  await apply(run, [['RemoveColumn', 'GFS_Fichiers', 'SupprimeLe'], ['RemoveColumn', 'GFS_Fichiers', 'SupprimePar']]);
  const old = await columnTypes(rest);
  check('la table devient celle d\'une version plus ancienne : sans les deux colonnes, avec ses lignes', !('SupprimeLe' in old) && !('SupprimePar' in old) && (await rest.rows('GFS_Fichiers')).length === 2, old);
  const tables = await rest.tables();

  await rowOf(frame, 'Devis.pdf').click();
  check('un clic à la vraie souris donne le clavier au panneau : la ligne est choisie et porte le focus', await frame.evaluate(() => document.activeElement.classList.contains('ls-row') && document.activeElement.getAttribute('aria-selected') === 'true'));
  await page.keyboard.press('ArrowDown');
  check('↓ au vrai clavier passe à la ligne suivante', await selectedName(frame) === 'Facture.pdf', await selectedName(frame));
  await page.keyboard.press('ArrowUp');
  check('↑ revient', await selectedName(frame) === 'Devis.pdf', await selectedName(frame));
  await page.keyboard.press('Delete');
  const moved = await said(frame, 'trash.moved', { name: 'Devis.pdf' });
  check('Suppr met le fichier à la corbeille : une phrase, aucune question, la liste n\'a plus que l\'autre PDF', moved === t('trash.moved', { name: 'Devis.pdf' }) && await frame.locator('.mod.ask').count() === 0 && JSON.stringify(await waitForNames(frame, ['Facture.pdf'])) === '["Facture.pdf"]', moved);
  check('et le clavier passe à la ligne qui reste', await selectedName(frame) === 'Facture.pdf', await selectedName(frame));

  const after = await columnTypes(rest);
  check('GFS a ajouté les deux colonnes sans demander (la table existait) et sans en créer une autre', after.SupprimeLe === 'DateTime:UTC' && after.SupprimePar === 'Text' && JSON.stringify(await rest.tables()) === JSON.stringify(tables), [after, await rest.tables()]);
  const devis = await rowNamed(rest, 'Devis.pdf');
  check('la ligne reste dans la table, marquée de la date (en secondes) et de la personne ; son contenu n\'a pas bougé', marked(devis) && Math.abs(devis.SupprimeLe - Date.now() / 1000) < 120 && devis.SupprimePar === ME && devis.Contenu.length === 2 && devis.Identifiant === run.devisId, devis);
  check('la pièce jointe reste citée : rien n\'est perdu, rien n\'est copié', (await rest.attachments()).length === 2 && (await rest.attachment(devis.Contenu[1])).hash === run.devis.hash);
  check('l\'autre ligne n\'est pas marquée', !marked(await rowNamed(rest, 'Facture.pdf')));
  await shot(frame, `${TAG}-1-liste`);
}

// ----- 2. La vue « Corbeille » : le compte, la liste, Entrée restaure.
async function playTrashView(run) {
  const { page, frame, rest } = run;
  say('--- 2. la vue « Corbeille » ---');
  check('l\'arbre dit combien de fichiers y sont', await trashCount(frame) === '1', await trashCount(frame));
  await openTrash(frame);
  check('la corbeille montre le PDF, sa colonne s\'appelle « Supprimé », la barre dit que rien ne part seul', JSON.stringify(await waitForNames(frame, ['Devis.pdf'])) === '["Devis.pdf"]' && (await frame.locator('.ls-head').textContent()).includes(t('trash.deleted')) && (await frame.locator('.trash-bar').textContent()).includes(t('trash.bar')), await frame.locator('.ls-head').textContent());
  check('la ligne dit qui l\'a supprimé (ses initiales) et un bouton « Restaurer » prend la place de l\'épingle', await rowOf(frame, 'Devis.pdf').locator('.who').count() === 1 && await rowOf(frame, 'Devis.pdf').locator('.rb.rs').count() === 1);
  await shot(frame, `${TAG}-2-corbeille`);
  check('la liste, la barre de la corbeille et la barre d\'information sont lisibles (4,5:1)', (await contrastProblems(frame, '.ex-main')).length === 0 && (await contrastProblems(frame, '.ex-info')).length === 0, [await contrastProblems(frame, '.ex-main'), await contrastProblems(frame, '.ex-info')]);

  await rowOf(frame, 'Devis.pdf').click();
  const info = await frame.locator('.ex-info').textContent();
  check('la barre d\'information donne la date de suppression', info.includes(t('trash.deletedOn', { date: '' }).trim()), info);
  await page.keyboard.press('Enter');
  const restored = await said(frame, 'trash.restored', { name: 'Devis.pdf' });
  check('Entrée restaure le fichier : la phrase le dit, la corbeille est vide et le dit', restored === t('trash.restored', { name: 'Devis.pdf' }) && JSON.stringify(await waitForNames(frame, [])) === '[]' && (await frame.locator('.ex-scroll').textContent()).includes(t('trash.emptyList')), restored);
  const back = await rowNamed(rest, 'Devis.pdf');
  check('la table efface les marques (la date redevient vide) ; la ligne et son identifiant sont les mêmes', !marked(back) && !back.SupprimePar && back.Identifiant === run.devisId && back.Contenu.length === 2, back);
  check('le compte de l\'arbre disparaît avec la dernière ligne', (await trashCount(frame)) === null, await trashCount(frame));
  await goHome(frame);
  check('le PDF est de retour dans « Moi »', await sameNames(frame, ['Devis.pdf', 'Facture.pdf']), await names(frame));
}

// ----- 3. Un nom pris pendant que le fichier était à la corbeille.
async function playNameTaken(run) {
  const { page, frame, rest } = run;
  say('--- 3. restaurer un nom devenu pris ---');
  await rowOf(frame, 'Devis.pdf').click();
  await page.keyboard.press('Delete');
  await said(frame, 'trash.moved', { name: 'Devis.pdf' });
  const second = pdfFile('Devis.pdf', 2, 'Devis bis');
  await importPdf(page, frame, second.file);
  const added = await said(frame, 'files.added', { name: 'Devis.pdf' });
  check('le nom d\'un fichier à la corbeille est libre : le nouveau PDF entre sans fenêtre « nom pris »', added === t('files.added', { name: 'Devis.pdf' }) && await frame.locator('.mod.ask').count() === 0 && await sameNames(frame, ['Devis.pdf', 'Facture.pdf']), added);
  await openTrash(frame);
  await rowOf(frame, 'Devis.pdf').hover();
  await rowOf(frame, 'Devis.pdf').locator('.rb.rs').click();
  const renamed = await said(frame, 'trash.restoredAs', { name: 'Devis.pdf', as: 'Devis (1).pdf' });
  check('« Restaurer » (à la souris) prend un autre nom, et la phrase dit lequel', renamed === t('trash.restoredAs', { name: 'Devis.pdf', as: 'Devis (1).pdf' }), renamed);
  const rows = await rest.rows('GFS_Fichiers');
  const old = rows.find(row => row.Identifiant === run.devisId);
  const fresh = rows.find(row => row.Nom === 'Devis.pdf');
  check('la table : l\'ancienne ligne porte le nouveau nom et plus de marque, la nouvelle garde « Devis.pdf »', old.Nom === 'Devis (1).pdf' && !marked(old) && fresh && fresh.Identifiant !== run.devisId && !marked(fresh), rows.map(row => [row.Nom, row.SupprimeLe]));
  await goHome(frame);
  check('les trois PDF sont dans « Moi »', await sameNames(frame, ['Devis (1).pdf', 'Devis.pdf', 'Facture.pdf']), await names(frame));
}

// ----- 4. Supprimer pour de bon.
async function playPurge(run) {
  const { page, frame, rest } = run;
  say('--- 4. supprimer pour de bon ---');
  await openRowMenu(frame, 'Devis (1).pdf');
  await frame.getByRole('menuitem', { name: new RegExp(`^${t('trash.move')}`) }).click();
  await said(frame, 'trash.moved', { name: 'Devis (1).pdf' });
  const attachmentsBefore = (await rest.attachments()).length;
  const rowsBefore = (await rest.rows('GFS_Fichiers')).length;
  await openTrash(frame);
  await rowOf(frame, 'Devis (1).pdf').click();
  await page.keyboard.press('Delete');
  await frame.locator('.mod.ask').waitFor();
  const focused = await frame.evaluate(() => document.activeElement.dataset.fk);
  const title = await frame.locator('#ask-title').textContent();
  check('Suppr à la corbeille pose une question qui nomme le fichier et donne le clavier à « Annuler »', focused === 'ask-no' && title === t('trash.purge.title', { name: 'Devis (1).pdf' }), [focused, title]);
  check('la fenêtre est lisible (4,5:1) et tient dans le panneau', (await contrastProblems(frame, '.mod')).length === 0 && JSON.stringify(await windowFits(frame)) === IN_PANEL, [await contrastProblems(frame, '.mod'), await windowFits(frame)]);
  await shot(frame, `${TAG}-3-supprimer`);
  await page.keyboard.press('Escape');
  await frame.locator('.mod.ask').waitFor({ state: 'detached' });
  check('Échap : rien n\'est supprimé', (await rest.rows('GFS_Fichiers')).length === rowsBefore && await sameNames(frame, ['Devis (1).pdf']));
  await page.keyboard.press('Delete');
  await frame.locator('.mod.ask').waitFor();
  await frame.locator('[data-fk="ask-yes"]').click();
  const purged = await said(frame, 'trash.purged', { name: 'Devis (1).pdf' });
  check('« Supprimer définitivement » le dit', purged === t('trash.purged', { name: 'Devis (1).pdf' }), purged);
  check('la ligne n\'est plus dans la table ; les autres n\'ont pas bougé', (await rest.rows('GFS_Fichiers')).length === rowsBefore - 1 && !(await rowNamed(rest, 'Devis (1).pdf')) && Boolean(await rowNamed(rest, 'Devis.pdf')) && Boolean(await rowNamed(rest, 'Facture.pdf')));
  check('la pièce jointe reste sur le serveur (Grist l\'efface seul au bout de 7 jours)', (await rest.attachments()).length === attachmentsBefore);
  check('la corbeille est vide', JSON.stringify(await waitForNames(frame, [])) === '[]');
  await goHome(frame);
}

// ----- 5. Vider la corbeille : seulement ce que la personne avait sous les yeux.
async function playEmpty(run) {
  const { page, frame, rest } = run;
  say('--- 5. vider la corbeille ---');
  await importPdf(page, frame, pdfFile('Contrat.pdf', 1, 'Contrat').file);
  await said(frame, 'files.added', { name: 'Contrat.pdf' });
  for (const name of ['Devis.pdf', 'Facture.pdf']) {
    await rowOf(frame, name).click();
    await page.keyboard.press('Delete');
    await waitForNames(frame, name === 'Devis.pdf' ? ['Contrat.pdf', 'Facture.pdf'] : ['Contrat.pdf']);
  }
  await openTrash(frame);
  check('deux fichiers à la corbeille, le compte le dit', await sameNames(frame, ['Devis.pdf', 'Facture.pdf']) && await trashCount(frame) === '2', await trashCount(frame));
  await frame.locator('[data-empty-trash]').click();
  await frame.locator('.mod.ask').waitFor();
  const items = await frame.locator('.ask-items li').allTextContents();
  check('une seule question, qui nomme les fichiers et donne le clavier à « Annuler »', await frame.evaluate(() => document.activeElement.dataset.fk) === 'ask-no' && JSON.stringify(sorted(items)) === JSON.stringify(['Devis.pdf', 'Facture.pdf']) && (await frame.locator('#ask-title').textContent()) === t('trash.emptyAll.title'), items);
  await shot(frame, `${TAG}-4-vider`);
  // Pendant que la fenêtre est ouverte, une autre personne met « Contrat.pdf » à la corbeille : la personne ne l'a pas sous les yeux, il doit rester.
  const contract = await rowNamed(rest, 'Contrat.pdf');
  await apply(run, [['UpdateRecord', 'GFS_Fichiers', contract.id, { SupprimeLe: Math.floor(Date.now() / 1000), SupprimePar: 'autre@example.com' }]]);
  await frame.locator('[data-fk="ask-yes"]').click();
  const emptied = await said(frame, 'trash.emptied', { n: 2 });
  check('la phrase dit combien de fichiers sont partis', emptied === t('trash.emptied', { n: 2 }), emptied);
  const rows = await rest.rows('GFS_Fichiers');
  check('un seul lot a retiré les deux lignes vues ; la ligne que l\'autre personne vient de supprimer reste, marquée', rows.length === 1 && rows[0].Nom === 'Contrat.pdf' && marked(rows[0]) && rows[0].SupprimePar === 'autre@example.com', rows.map(row => row.Nom));
  check('la liste est relue : la corbeille montre ce fichier-là, avec le nom de l\'autre personne', await sameNames(frame, ['Contrat.pdf']) && await trashCount(frame) === '1');
  await rowOf(frame, 'Contrat.pdf').click();
  await page.keyboard.press('Enter');
  await said(frame, 'trash.restored', { name: 'Contrat.pdf' });
  await goHome(frame);
  check('restauré, il est de retour dans « Moi », seul', await sameNames(frame, ['Contrat.pdf']) && !marked(await rowNamed(rest, 'Contrat.pdf')));
}

// ----- 6. Le menu de la ligne et ses raccourcis.
async function playMenus(run) {
  const { page, frame } = run;
  say('--- 6. le menu de la ligne ---');
  const row = rowOf(frame, 'Contrat.pdf');
  await row.click({ button: 'right' });
  await frame.locator('.menu').waitFor();
  const entries = await frame.locator('.menu .menu-item').evaluateAll(nodes => nodes.map(node => ({ label: node.querySelector('.menu-label').textContent, hint: (node.querySelector('.menu-hint') || {}).textContent || '', greyed: node.getAttribute('aria-disabled') === 'true' })));
  const remove = entries.find(entry => entry.label === t('trash.move'));
  check('le clic droit ouvre le menu de la ligne ; « Mettre à la corbeille » dit sa touche', Boolean(remove) && !remove.greyed && remove.hint === t('key.delete') && entries.find(entry => entry.label === t('ex.rename')).hint === 'F2', entries);
  await shot(frame, `${TAG}-5-menu`);
  await page.keyboard.press('Escape');
  await frame.locator('.menu').waitFor({ state: 'detached' });
  await row.click();
  await page.keyboard.press('Shift+F10');
  await frame.locator('.menu').waitFor();
  check('Maj+F10 ouvre le même menu au clavier', await frame.locator('.menu .menu-item').count() === entries.length);
  await page.keyboard.press('Escape');
  await frame.locator('.menu').waitFor({ state: 'detached' });
  check('Échap ferme le menu et laisse le fichier choisi', await selectedName(frame) === 'Contrat.pdf', await selectedName(frame));
  await page.keyboard.press('F2');
  await frame.locator('[data-fk="name-input"]').waitFor();
  check('F2 ouvre « Renommer » sur le fichier choisi', (await frame.locator('[data-fk="name-input"]').inputValue()) === 'Contrat.pdf');
  await page.keyboard.press('Escape');
  await frame.locator('.mod').waitFor({ state: 'detached' });
}

const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, server, { colorScheme: scheme });
  const run = await openGfs(context, { lang });
  check('GFS est à 700 × 400 dans le vrai Grist', Math.abs(run.box.width - 700) <= 1 && Math.abs(run.box.height - 400) <= 1, run.box);
  await importSamples(run);
  await pinFirst(run);
  run.devisId = (await rowNamed(run.rest, 'Devis.pdf')).Identifiant;
  await playFirstTrash(run);
  await playTrashView(run);
  await playNameTaken(run);
  await playPurge(run);
  await playEmpty(run);
  await playMenus(run);
  const unexpected = run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
  check('aucune erreur ni avertissement de GFS dans la console', unexpected.length === 0, unexpected);
} finally {
  await browser.close();
  pages.close();
}
