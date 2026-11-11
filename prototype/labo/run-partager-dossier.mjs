// Partager un DOSSIER avec un autre document Grist (js/share-folder.js ; choix du porteur, 11/11 : « le dossier, à accepter d'un coup », « un seul lien par document »), joué dans le VRAI GFS à 700 × 400, à la vraie
// souris, dans un VRAI Grist (`GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash vrai-serveur.sh`). Le premier document est celui de la personne (tout passe par les fenêtres de GFS) ; le second est piloté par
// l'essai avec les fonctions du moteur, puis rouvert dans GFS pour voir ce que la personne y verra.
//   0. un dossier « Contrats » de « Moi » (la table du rangement naît avec l'accord de la personne) et deux PDF dedans ; un premier lien « à jour » par un fichier hors dossier (Facture) ;
//   1. « Partager… » sur le dossier : l'article est libre, la fenêtre s'ouvre sur « Dans un autre document Grist » (l'onglet « Dans ce document » dit que « Moi » n'a pas de droits), le dossier est « Pas partagé » ;
//   2. « Copie à jour » : la colonne `Dossier_partage` naît dans la table des fichiers (une écriture), porte « Contrats » sur les deux PDF du dossier et rien sur les autres ; les deux fichiers arrivent chez l'autre avec le
//      nom du dossier, sans nouveau code, Facture reste sans dossier ; rouvert, GFS de l'autre montre le dossier « Contrats » grisé, « 2 à accepter » ;
//   3. « Arrêter la copie » : le dossier sort de la condition (Facture reste), les copies restent chez l'autre avec leur dossier ; les noms RESTENT écrits chez l'envoyeur (effacés, ils partaient chez l'autre avec l'archive) ;
//   4. un fichier du dossier partagé à part : le dossier est « Une partie du dossier » ; « Copie à jour » complète le dossier ;
//   5. « Une copie, une fois » : les fichiers repartent puis sortent de la condition tout seuls, la copie garde son dossier ;
//   6. la console reste muette.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark. REPO_DIR="$(realpath ../..)" node run-partager-dossier.mjs
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n.js';
import { PAGE_PORT, openGfs, importSamples, importPdf, pdfFile, waitForNames, openRowMenu, rowOf, goTo, contrastProblems, shot as pdfShot } from './lab-pdf.mjs';
import { fits } from './lab-droits.mjs';
import { startEngine, formLink, sendComparing, reopenedFrame } from './lab-partage.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const shot = (frame, name) => pdfShot(frame, `partager-dossier-${lang}-${scheme}-${name}`);
const RACE = /KeyError 'GFS_Synchro'/; // connu (faits vérifiés 71) : voir run-partager-recevoir.mjs
const races = [];
const unexpected = run => run.problems.filter(problem => !run.allow.some(known => known.test(problem)) && (RACE.test(problem) ? (races.push(problem), false) : true));
const FOLDER = 'Dossier_partage';
const exact = text => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
const text = async (frame, selector) => (await frame.locator(selector).innerText()).replace(/\s+/g, ' ');
const webhooks = ({ page, docId }) => page.evaluate(async id => (await (await fetch(`/api/docs/${id}/webhooks`)).json()).webhooks.length, docId);
const closeAll = async (page, frame) => { await page.keyboard.press('Escape'); await frame.locator('.mod-scrim').first().waitFor({ state: 'detached' }).catch(() => {}); };
const folderRow = (frame, name) => frame.locator('.ls-row.folder', { has: frame.locator('.t', { hasText: exact(name) }) });
const goHome = frame => goTo(frame, new RegExp(`^\\s*${t('ex.me')}\\s*\\d*\\s*$`));
const level = async frame => (await frame.locator('.mod.sh .rr[data-link]').first().getAttribute('data-level'));
const waitLevel = (frame, wanted) => frame.waitForFunction(value => document.querySelector('.mod.sh .rr[data-link]').dataset.level === value, wanted, { timeout: 40000 });
async function pickLevel(frame, label) {
  await frame.locator('.mod.sh .rr[data-link] .lvl').first().click();
  await frame.locator('.menu .menu-item', { hasText: label }).click();
}

// « Partager… » d'un fichier de la liste, l'onglet « Dans un autre document Grist » ouvert, ses liens lus.
async function openFileTab(frame, name) {
  await openRowMenu(frame, name);
  await frame.getByRole('menuitem', { name: new RegExp(`^${t('share.menu')}`) }).click();
  await frame.locator('.mod.sh .rt-content').waitFor();
  await frame.locator('[data-fk="share-tab-other"]').click();
  await frame.locator('[data-fk="other-new"]').waitFor();
  await frame.waitForFunction(loading => !document.querySelector('.mod.sh .sh-body').textContent.includes(loading), t('so.tab.loading'));
}

// « Partager… » sur la ligne d'un dossier (à la vraie souris : clic droit) : rend l'article du menu.
async function openFolderShare(frame, name) {
  await folderRow(frame, name).click({ button: 'right' });
  const entry = frame.getByRole('menuitem', { name: new RegExp(`^${t('share.menu')}`) });
  await entry.waitFor();
  const greyed = (await entry.getAttribute('aria-disabled')) === 'true';
  await entry.click();
  await frame.locator('.mod.sh .rt-content').waitFor();
  await frame.waitForFunction(loading => !document.querySelector('.mod.sh .sh-body').textContent.includes(loading), t('so.tab.loading'));
  return greyed;
}

const pluginApi = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi, { colorScheme: scheme });
  const source = await openGfs(context, { lang });
  const { page } = source;
  let frame = source.frame;
  await importSamples(source);
  for (const [name, pages] of [['Contrat.pdf', 2], ['Avenant.pdf', 1]]) await importPdf(page, frame, pdfFile(name, pages, name.replace('.pdf', '')).file);
  await waitForNames(frame, ['Avenant.pdf', 'Contrat.pdf', 'Devis.pdf', 'Facture.pdf']);
  let target = await openGfs(context, { lang });
  await startEngine(target.frame);
  const pass = async () => {
    await target.frame.evaluate(() => window.__s.consolidateAll({ reread: true }));
    return target.rest.rows('GFS_Recus');
  };
  const until = async (test, tries = 60) => { let rows = []; for (let i = 0; i < tries; i += 1) { rows = await pass(); if (test(rows)) return rows; await page.waitForTimeout(1500); } return rows; };
  const has = (rows, name) => rows.some(row => row.Nom === name && row.Contenu);
  const folderOf = (rows, name) => (rows.find(row => row.Nom === name) || {})[FOLDER];
  const sourceFolders = async () => Object.fromEntries((await source.rest.rows('GFS_Fichiers')).map(row => [row.Nom, row[FOLDER]]));
  const waitSource = async (test, tries = 40) => { let now = {}; for (let i = 0; i < tries; i += 1) { now = await sourceFolders(); if (test(now)) return now; await page.waitForTimeout(1000); } return now; };

  say('--- 0. un dossier « Contrats » et un premier lien ---');
  await frame.getByRole('button', { name: exact(t('ex.new')) }).click();
  await frame.getByRole('menuitem', { name: new RegExp(`^${t('ex.newFolder')}`) }).click();
  await frame.locator('#nw-title').waitFor();
  await page.keyboard.type('Contrats');
  await page.keyboard.press('Enter');
  await frame.locator('[data-fk="ask-yes"]').click();
  await folderRow(frame, 'Contrats').waitFor();
  for (const name of ['Contrat.pdf', 'Avenant.pdf']) {
    await goHome(frame);
    await openRowMenu(frame, name);
    await frame.getByRole('menuitem', { name: new RegExp(`^${t('ex.move')}`) }).click();
    await frame.locator('[data-fk="move-Contrats"]').click();
    await frame.locator('.mod').waitFor({ state: 'detached' }).catch(() => {});
  }
  await goHome(frame);
  await folderRow(frame, 'Contrats').waitFor();
  check('le dossier « Contrats » est dans « Moi » avec ses deux PDF, Facture et Devis restent à la racine', (await folderRow(frame, 'Contrats').locator('.pill').innerText()).includes('2') && (await rowOf(frame, 'Facture.pdf').count()) === 1, await folderRow(frame, 'Contrats').innerText());
  check('la table des fichiers n\'a pas encore la colonne du nom de dossier', !(await source.rest.columns('GFS_Fichiers')).some(each => each.id === FOLDER), (await source.rest.columns('GFS_Fichiers')).map(each => each.id));

  await openFileTab(frame, 'Facture.pdf');
  await frame.locator('[data-fk="other-new"]').click();
  await frame.locator('[data-fk="so-mode-live"]').click();
  await frame.locator('[data-fk="so-continue"]').click();
  await frame.locator('[data-fk="so-code"]').waitFor();
  const code = await frame.locator('[data-fk="so-code"]').inputValue();
  const invitation = await target.frame.evaluate(value => window.__try(() => window.__s.readInvitation(value)), code);
  const made = await target.frame.evaluate(invite => window.__try(async () => {
    const reception = await window.__s.createReception(invite, invite.tables.map(tb => ({ tb, dest: 'GFS_Recus' })), { reserve: true, options: { archive: true } });
    return { journal: reception.journal, note: reception.note };
  }), invitation.value);
  check('l\'autre document lit l\'invitation et crée sa réception (en archive)', invitation.ok && made.ok, { invitation, made });
  const { link } = await formLink(target);
  const replied = await target.frame.evaluate(args => window.__try(() => window.__s.receptionReply(args.made, args.link)), { made: made.value, link });
  await frame.locator('[data-fk="so-reply"]').click();
  await page.keyboard.insertText(replied.value.code);
  await frame.locator('[data-fk="so-check"]').click();
  await frame.locator('[data-fk="so-control"]').waitFor({ timeout: 20000 });
  await sendComparing(frame);
  const done = async () => { for (let i = 0; i < 120; i++) { if ((await text(frame, '.mod.so')).includes(t('so.done.live.hint'))) return true; await page.waitForTimeout(1000); } return false; };
  check('le premier lien est fait, il reste', await done(), await text(frame, '.mod.so'));
  await frame.locator('[data-fk="so-close"]').click();
  await reopenedFrame(source);
  frame = source.frame;
  let rows = await until(list => has(list, 'Facture.pdf'));
  check('Facture est chez l\'autre, sans dossier (la colonne n\'existe pas encore chez l\'envoyeur)', has(rows, 'Facture.pdf') && rows.length === 1 && !(FOLDER in rows[0]), rows.map(row => row.Nom));

  say('--- 1. « Partager… » sur le dossier ---');
  await goHome(frame);
  const greyed = await openFolderShare(frame, 'Contrats');
  check('l\'article « Partager… » d\'un dossier de « Moi » est libre, la fenêtre s\'ouvre', !greyed && (await frame.locator('.mod.sh').count()) === 1, greyed);
  const head = await text(frame, '.mod.sh .mod-head');
  check('le titre nomme le dossier, le sous-titre dit « Dossier de « Moi » »', head.includes('Contrats') && head.includes(t('share.folder.inMine', { name: t('ex.me') })), head);
  check('la fenêtre s\'ouvre sur « Dans un autre document Grist », le dossier est « Pas partagé »', (await frame.locator('[data-fk="share-tab-other"]').getAttribute('aria-selected')) === 'true' && (await level(frame)) === 'none', await text(frame, '.mod.sh'));
  const body = await text(frame, '.mod.sh .sh-body');
  check('le texte dit les deux PDF du dossier', body.includes(t('so.tab.lead.folder', { n: 2 })), body);
  check('la fenêtre tient dans le panneau, contraste de 4,5:1', await fits(frame, '.mod.sh'), await contrastProblems(frame, '.mod.sh'));
  await shot(frame, '1-onglet');
  await frame.locator('[data-fk="share-tab-here"]').click();
  check('« Dans ce document » dit que « Moi » n\'a pas de droits à donner, sans rien écrire', (await text(frame, '.mod.sh .sh-body')).includes(t('share.folder.mine')) && (await frame.locator('[data-fk="share-new-level"]').count()) === 0, await text(frame, '.mod.sh .sh-body'));
  await shot(frame, '2-ici');
  await frame.locator('[data-fk="share-tab-other"]').click();
  await frame.locator('.mod.sh .rr[data-link]').waitFor();

  say('--- 2. « Copie à jour » : le dossier arrive chez l\'autre ---');
  const before = await source.rest.rows('GFS_Fichiers');
  await pickLevel(frame, t('so.level.live'));
  await waitLevel(frame, 'live');
  check('aucune fenêtre d\'envoi (pas de nouveau code)', (await frame.locator('.mod.so').count()) === 0);
  const columns = await source.rest.columns('GFS_Fichiers');
  check('la colonne « Dossier_partage » est née dans la table des fichiers (une colonne de plus, rien d\'autre)', columns.some(each => each.id === FOLDER) && before.length === (await source.rest.rows('GFS_Fichiers')).length, columns.map(each => each.id));
  const labeled = await waitSource(now => now['Contrat.pdf'] === 'Contrats' && now['Avenant.pdf'] === 'Contrats');
  check('« Contrats » est écrit sur les deux PDF du dossier, et rien sur Facture ni Devis', labeled['Contrat.pdf'] === 'Contrats' && labeled['Avenant.pdf'] === 'Contrats' && !labeled['Facture.pdf'] && !labeled['Devis.pdf'], labeled);
  check('la condition du lien porte les trois fichiers (Facture et les deux du dossier)', (await text(frame, '.mod.sh .rr[data-link]')).includes(t('so.link.sub', { n: 3 })), await text(frame, '.mod.sh .rr[data-link]'));
  rows = await until(list => has(list, 'Contrat.pdf') && has(list, 'Avenant.pdf') && FOLDER in list[0]);
  check('les deux PDF sont arrivés chez l\'autre avec leur contenu et le nom du dossier', has(rows, 'Contrat.pdf') && has(rows, 'Avenant.pdf') && folderOf(rows, 'Contrat.pdf') === 'Contrats' && folderOf(rows, 'Avenant.pdf') === 'Contrats', rows.map(row => [row.Nom, row[FOLDER]]));
  check('Facture, déjà là, est restée sans dossier', has(rows, 'Facture.pdf') && !folderOf(rows, 'Facture.pdf'), rows.map(row => [row.Nom, row[FOLDER]]));
  await shot(frame, '3-a-jour');
  await closeAll(page, frame);

  say('--- 2 bis. ce que la personne verra chez l\'autre ---');
  const targetPath = target.path;
  await target.page.close();
  target = await openGfs(context, { lang, path: targetPath });
  await goTo(target.frame, new RegExp(t('rx.view')));
  await folderRow(target.frame, 'Contrats').waitFor({ timeout: 30000 });
  const pill = (await folderRow(target.frame, 'Contrats').locator('.pill').innerText()).replace(/\s+/g, ' ');
  check('« Partagés avec moi » montre le dossier « Contrats », grisé, ses deux PDF à accepter', pill.includes(t('rx.folder.pending', { n: 2 })) && (await folderRow(target.frame, 'Contrats').getAttribute('class')).split(' ').includes('lk'), pill);
  await shot(target.frame, '4-chez-l-autre');
  await startEngine(target.frame);

  say('--- 3. « Arrêter la copie » du dossier ---');
  await goHome(frame);
  await openFolderShare(frame, 'Contrats');
  check('le dossier, rouvert, est « Copie à jour »', (await level(frame)) === 'live', await text(frame, '.mod.sh'));
  await pickLevel(frame, t('so.level.stop'));
  await waitLevel(frame, 'none');
  check('Facture reste dans la condition du lien (un fichier à la racine, hors du dossier)', (await text(frame, '.mod.sh .rr[data-link]')).includes(t('so.link.sub', { n: 1 })), await text(frame, '.mod.sh .rr[data-link]'));
  rows = await until(list => list.filter(row => row.Supprimee_a_la_source).length === 2, 30);
  check('les deux PDF restent chez l\'autre avec leur dossier, marqués « supprimés à la source » (réception en archive)', has(rows, 'Contrat.pdf') && has(rows, 'Avenant.pdf') && folderOf(rows, 'Contrat.pdf') === 'Contrats' && folderOf(rows, 'Avenant.pdf') === 'Contrats' && rows.length === 3 && rows.filter(row => row.Supprimee_a_la_source).length === 2, rows.map(row => [row.Nom, row[FOLDER], row.Supprimee_a_la_source]));
  check('les noms de dossier restent écrits chez l\'envoyeur (un nom vidé partirait chez l\'autre avec l\'archive)', (await sourceFolders())['Contrat.pdf'] === 'Contrats' && (await sourceFolders())['Avenant.pdf'] === 'Contrats', await sourceFolders());
  await closeAll(page, frame);

  say('--- 4. un fichier partagé à part : « Une partie du dossier » ---');
  await folderRow(frame, 'Contrats').dblclick();
  await openFileTab(frame, 'Contrat.pdf');
  check('Contrat.pdf, rangé dans un dossier, se partage comme un fichier (l\'onglet n\'est pas grisé)', (await frame.locator('[data-fk="other-new"]').getAttribute('aria-disabled')) !== 'true' && (await level(frame)) === 'none', await text(frame, '.mod.sh'));
  await pickLevel(frame, t('so.level.live'));
  await waitLevel(frame, 'live');
  await closeAll(page, frame);
  await goHome(frame);
  await openFolderShare(frame, 'Contrats');
  check('le dossier est « Une partie du dossier » (un fichier sur deux)', (await level(frame)) === 'part' && (await text(frame, '.mod.sh .rr[data-link] .lvl')).includes(t('so.level.part')), await text(frame, '.mod.sh .rr[data-link]'));
  await shot(frame, '5-partie');
  await pickLevel(frame, t('so.level.live'));
  await waitLevel(frame, 'live');
  const completed = await waitSource(now => now['Contrat.pdf'] === 'Contrats' && now['Avenant.pdf'] === 'Contrats');
  check('« Copie à jour » complète le dossier : les deux fichiers portent « Contrats »', completed['Contrat.pdf'] === 'Contrats' && completed['Avenant.pdf'] === 'Contrats', completed);
  await closeAll(page, frame);

  say('--- 5. « Une copie, une fois » ---');
  await goHome(frame);
  await openFolderShare(frame, 'Contrats');
  await pickLevel(frame, t('so.level.stop'));
  await waitLevel(frame, 'none');
  await pickLevel(frame, t('so.level.once'));
  let said = '';
  for (let i = 0; i < 40 && !said.includes('Contrats'); i += 1) { said = `${await text(frame, '.mod.sh .mod-note')} ${await frame.locator('#toast').textContent()}`; if (!said.includes('Contrats')) await page.waitForTimeout(250); }
  check('un avis dit que le dossier part', said.includes('Contrats'), said);
  let out = false;
  for (let i = 0; i < 40 && !out; i += 1) {
    await closeAll(page, frame);
    await goHome(frame);
    await openFolderShare(frame, 'Contrats');
    out = (await level(frame)) === 'none';
    if (!out) await page.waitForTimeout(1500);
  }
  check('les deux fichiers sont sortis de la condition tout seuls (le dossier est « Pas partagé »), Facture y est restée', out && (await text(frame, '.mod.sh .rr[data-link]')).includes(t('so.link.sub', { n: 1 })), await text(frame, '.mod.sh .rr[data-link]'));
  rows = await until(() => false, 4);
  check('la copie garde son dossier chez l\'autre', has(rows, 'Contrat.pdf') && folderOf(rows, 'Contrat.pdf') === 'Contrats' && folderOf(rows, 'Avenant.pdf') === 'Contrats', rows.map(row => [row.Nom, row[FOLDER]]));
  await closeAll(page, frame);

  say('--- 6. la console ---');
  check('aucune erreur de GFS dans la console', unexpected(source).length === 0 && unexpected(target).length === 0, [...unexpected(source), ...unexpected(target)]);
  check('rien d\'autre n\'a bougé chez l\'envoyeur : les PDF sont intacts', (await source.rest.rows('GFS_Fichiers')).map(row => row.Nom).sort().join() === 'Avenant.pdf,Contrat.pdf,Devis.pdf,Facture.pdf' && (await webhooks(source)) === 1);
  if (races.length) say(`(courses connues, faits vérifiés 71 : ${races.length})`);
} finally {
  await browser.close();
  pages.close();
}
