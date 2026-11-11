// Les DOSSIERS reçus (js/sharing/received-folders.js ; choix du porteur, 11/11 : « le dossier, à accepter d'un coup »), joués dans le VRAI GFS à 700 × 400, à la vraie souris et au vrai clavier, dans un VRAI Grist
// (`GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash vrai-serveur.sh`). Le premier document envoie par les fonctions du moteur (comme run-partages-recus.mjs) : un fichier seul, puis, avec la colonne
// `Dossier_partage` ajoutée à l'export (mesure : run-dossier-colonne.mjs), deux fichiers d'un dossier « Contrats » ; le second ouvre GFS :
//   1. « Partagés avec moi » : le dossier « Contrats » en tête (grisé, « 2 fichiers à accepter »), le fichier seul dessous ; le volet et la cloche comptent 3 fichiers, la cloche nomme le DOSSIER d'une ligne ;
//   2. un double clic entre dans le dossier : fil d'Ariane « Moi › Partagés avec moi › Contrats », ses deux fichiers grisés, la barre « Accepter le dossier… » ; Retour arrière revient à « Partagés avec moi » ;
//   3. « Accepter le dossier… » : la fenêtre dit le dossier, le nombre et le poids ; Échap n'écrit rien (ni marque, ni colonne) ; « Accepter » : les deux fichiers ne sont plus grisés, une seule écriture, le fichier seul attend toujours ;
//   4. l'envoyeur ajoute un fichier au dossier : il arrive seul, grisé, à accepter ; les deux autres restent acceptés ; le dossier redevient « 1 fichier à accepter » ;
//   5. le menu d'un dossier reçu n'offre ni renommer, ni déplacer, ni supprimer ; F2, Suppr et Ctrl+X ne font rien dessus ;
//   6. « Refuser le dossier » : le dossier et ses fichiers à accepter disparaissent, les fichiers déjà acceptés restent (ils ont leur propre état).
// LAB_LANG=fr|en, LAB_SCHEME=light|dark. REPO_DIR="$(realpath ../..)" node run-dossiers-recus.mjs
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { PAGE_PORT, openGfs, importSamples, importPdf, pdfFile, waitForNames, rowOf, goTo, contrastProblems, names, folders, toast, shot as pdfShot } from './lab-pdf.mjs';
import { fits } from './lab-droits.mjs';
import { startEngine, handshake } from './lab-partage.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const shot = (frame, name) => pdfShot(frame, `dossiers-${lang}-${scheme}-${name}`);
const RACE = /KeyError 'GFS_Synchro'/; // connu (faits vérifiés 71) : voir run-partager-recevoir.mjs
const races = [];
const unexpected = run => run.problems.filter(problem => !run.allow.some(known => known.test(problem)) && (RACE.test(problem) ? (races.push(problem), false) : true));
const COLUMNS = ['Identifiant', 'Nom', 'Type', 'Date', 'Auteur', 'Contenu', 'Taille', 'Origine'];
const FOLDER = 'Dossier_partage';
const text = async (frame, selector) => (await frame.locator(selector).innerText()).replace(/\s+/g, ' ');
const rail = frame => frame.locator('.tr-row', { hasText: t('rx.view') });
const badge = async frame => ((await rail(frame).locator('.cnt').count()) ? (await rail(frame).locator('.cnt').innerText()).trim() : '');
const bellBadge = async frame => ((await frame.locator('.tb-bell .tb-badge').isVisible()) ? (await frame.locator('.tb-bell .tb-badge').innerText()).trim() : '');
const folderRow = (frame, name) => frame.locator('.ls-row.folder').filter({ has: frame.locator('.nm .t', { hasText: new RegExp(`^${name}$`) }) });
const greyed = async (frame, name) => (await rowOf(frame, name).getAttribute('class')).split(' ').includes('lk');
const crumbText = frame => text(frame, '.crumbs');

const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const views = [];
try {
  const context = await newContext(browser, server, { colorScheme: scheme });
  const source = await openGfs(context, { lang });
  await importSamples(source);
  for (const [name, pages] of [['Contrat.pdf', 2], ['Avenant.pdf', 1]]) await importPdf(source.page, source.frame, pdfFile(name, pages, name.replace('.pdf', '')).file);
  await waitForNames(source.frame, ['Avenant.pdf', 'Contrat.pdf', 'Devis.pdf', 'Facture.pdf']);
  const target = await openGfs(context, { lang });
  await startEngine(source.frame);
  await startEngine(target.frame);
  const files = await source.rest.rows('GFS_Fichiers');
  const idOf = name => files.find(row => row.Nom === name).Identifiant;
  const rowIdOf = name => files.find(row => row.Nom === name).id;
  const first = await handshake(source, target, { name: 'Lot', ids: [idOf('Facture.pdf')], columns: COLUMNS, options: { archive: true } });
  const alive = async run => {
    try { await run.frame.evaluate(() => true); } catch (error) {
      const lost = run.problems;
      await run.page.close().catch(() => {});
      Object.assign(run, await openGfs(context, { lang, path: run.path }));
      run.problems.unshift(...lost);
      await startEngine(run.frame);
    }
  };
  const patch = (run, table, id, fields) => run.page.evaluate(async ([doc, name, row, values]) => (await fetch(`/api/docs/${doc}/tables/${name}/records`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify({ records: [{ id: row, fields: values }] }) })).status, [run.docId, table, id, fields]);
  const pass = async () => {
    await alive(source);
    await alive(target);
    await source.frame.evaluate(() => window.__try(() => window.__s.catchUp()));
    await target.frame.evaluate(() => window.__try(() => window.__s.consolidateAll({ reread: true })));
    return target.rest.rows('GFS_Recus');
  };
  const until = async (test, tries = 40) => { let rows = []; for (let i = 0; i < tries; i += 1) { rows = await pass(); if (test(rows)) return rows; await source.page.waitForTimeout(1500); } return rows; };
  const editExport = ids => source.frame.evaluate(args => window.__try(async () => {
    const selection = [{ table: 'GFS_Fichiers', columns: args.columns, filter: { mode: 'all', conds: [{ id: 'Identifiant', op: 'in', values: args.ids }] } }];
    const done = await window.__s.saveChosenExport({ exp: args.exp, name: args.exp.name, selection });
    return window.__s.finishEdit(args.exp, { name: args.exp.name, changed: done.changed });
  }), { exp: first.exp, columns: [...COLUMNS, FOLDER], ids });
  const view = async () => {
    while (views.length) await views.pop().page.close();
    const run = await openGfs(context, { lang, path: target.path });
    views.push(run);
    await goTo(run.frame, t('rx.view'));
    return run;
  };

  await until(list => list.length === 1 && list[0].Contenu);
  // L'envoyeur donne un dossier : la colonne, le nom du dossier sur deux fichiers, la condition étendue (mesuré : run-dossier-colonne.mjs).
  await source.frame.evaluate(column => grist.docApi.applyUserActions([['AddColumn', 'GFS_Fichiers', column, { type: 'Text', isFormula: false }]]), FOLDER);
  await patch(source, 'GFS_Fichiers', rowIdOf('Devis.pdf'), { [FOLDER]: 'Contrats' });
  await patch(source, 'GFS_Fichiers', rowIdOf('Contrat.pdf'), { [FOLDER]: 'Contrats' });
  await editExport([idOf('Facture.pdf'), idOf('Devis.pdf'), idOf('Contrat.pdf')]);
  const rows = await until(list => list.length === 3 && list.every(row => row.Contenu));
  check('trois fichiers arrivés, deux d\'un dossier « Contrats »', rows.length === 3 && rows.filter(row => row[FOLDER] === 'Contrats').length === 2, rows.map(row => [row.Nom, row[FOLDER]]));

  say('--- 1. « Partagés avec moi » : le dossier en tête, le fichier seul dessous ---');
  let ui = await view();
  let { page, frame } = ui;
  check('le dossier « Contrats » est listé, le fichier seul « Facture.pdf » dessous', JSON.stringify(await folders(frame)) === '["Contrats"]' && JSON.stringify(await names(frame)) === '["Facture.pdf"]', { folders: await folders(frame), names: await names(frame) });
  const folderClass = (await folderRow(frame, 'Contrats').getAttribute('class')).split(' ');
  const pill = await folderRow(frame, 'Contrats').locator('.ty .pill').innerText();
  check('le dossier est grisé et dit « 2 fichiers à accepter » (le mot avec la couleur)', folderClass.includes('lk') && pill === t('rx.folder.pending', { n: 2 }), { folderClass, pill });
  check('le volet et la cloche comptent 3 fichiers à accepter', (await badge(frame)) === '3' && (await bellBadge(frame)) === '3', { rail: await badge(frame), bell: await bellBadge(frame) });
  const noOverflow = await frame.evaluate(() => { const scroll = document.querySelector('.ex-scroll'); return scroll.scrollWidth <= scroll.clientWidth + 1; });
  const weak = [...await contrastProblems(frame, '.ex-body'), ...await contrastProblems(frame, '.ex-info')];
  check('la liste tient dans le panneau (sans défilement horizontal), contraste de 4,5:1', noOverflow && weak.length === 0, { noOverflow, weak });
  await shot(frame, '1-liste');
  await frame.locator('.tb-bell').click();
  const bellItems = (await frame.locator('.menu .menu-item .menu-label').allInnerTexts()).map(item => item.trim());
  check('la cloche nomme le DOSSIER d\'une ligne (et le fichier seul d\'une autre)', bellItems.length === 3 && bellItems[0].includes('Contrats') && bellItems[0].includes('2') && bellItems[1].includes('Facture.pdf') && bellItems[2] === t('nt.open'), bellItems);
  await shot(frame, '1-cloche');
  await frame.locator('.menu .menu-item').first().click();
  await frame.locator('.mod.so').waitFor();
  check('un clic sur la ligne du dossier, dans la cloche, pose la question du DOSSIER', (await text(frame, '.mod.so')).includes(t('rx.folder.title', { name: 'Contrats' })), await text(frame, '.mod.so'));
  await page.keyboard.press('Escape');
  await frame.locator('.mod.so').waitFor({ state: 'detached' });

  say('--- 2. entrer dans le dossier ---');
  await folderRow(frame, 'Contrats').dblclick();
  await frame.waitForFunction(() => document.querySelector('.crumbs .here .ic') && document.querySelectorAll('.ls-row:not(.folder)').length === 2, null, { timeout: 15000 });
  check('le fil d\'Ariane dit « Moi › Partagés avec moi › Contrats », seuls ses deux fichiers sont là, grisés', (await crumbText(frame)).includes(t('rx.view')) && (await crumbText(frame)).endsWith('Contrats') && JSON.stringify(await names(frame)) === '["Contrat.pdf","Devis.pdf"]' && (await greyed(frame, 'Contrat.pdf')) && (await greyed(frame, 'Devis.pdf')), { crumbs: await crumbText(frame), names: await names(frame) });
  check('la barre dit « Ce dossier a 2 fichiers à accepter » avec « Accepter le dossier… »', (await text(frame, '.trash-bar')).includes(t('rx.folder.bar', { n: 2 }).replace(/\.$/, '')) && (await frame.locator('.trash-bar .btn').innerText()).trim() === t('rx.folder.answer'), await text(frame, '.trash-bar'));
  check('la fenêtre tient (liste et barre) : 700 × 400, contraste de 4,5:1', (await contrastProblems(frame, '.ex-body')).length === 0 && (await contrastProblems(frame, '.trash-bar')).length === 0, await contrastProblems(frame, '.trash-bar'));
  await shot(frame, '2-dans-le-dossier');
  await page.keyboard.press('Backspace');
  await frame.waitForFunction(() => document.querySelectorAll('.ls-row.folder').length === 1, null, { timeout: 10000 });
  check('Retour arrière revient à « Partagés avec moi » (le dossier est de nouveau listé)', JSON.stringify(await folders(frame)) === '["Contrats"]' && !(await crumbText(frame)).endsWith('Contrats'), await crumbText(frame));
  await folderRow(frame, 'Contrats').dblclick();
  await frame.waitForFunction(() => document.querySelectorAll('.ls-row:not(.folder)').length === 2, null, { timeout: 10000 });
  await frame.locator('.crumbs button', { hasText: t('rx.view') }).click();
  await frame.waitForFunction(() => document.querySelectorAll('.ls-row.folder').length === 1, null, { timeout: 10000 });
  check('le fil d\'Ariane remonte aussi à « Partagés avec moi » à la souris', JSON.stringify(await folders(frame)) === '["Contrats"]', await crumbText(frame));

  say('--- 3. accepter le dossier ---');
  await folderRow(frame, 'Contrats').dblclick();
  await frame.waitForFunction(() => document.querySelectorAll('.ls-row:not(.folder)').length === 2, null, { timeout: 10000 });
  await frame.locator('.trash-bar .btn').click();
  await frame.locator('.mod.so').waitFor();
  const asked = await text(frame, '.mod.so');
  check('la fenêtre dit le dossier, 2 fichiers, le poids, et qu\'un fichier ajouté plus tard attend', asked.includes(t('rx.folder.title', { name: 'Contrats' })) && /Ko|KB|Mo|MB/.test(asked) && asked.includes(t('rx.folder.keep')), asked);
  check('la fenêtre tient dans le panneau, contraste de 4,5:1', await fits(frame, '.mod.so') && (await contrastProblems(frame, '.mod.so')).length === 0, await contrastProblems(frame, '.mod.so'));
  await shot(frame, '3-question');
  await page.keyboard.press('Escape');
  await frame.locator('.mod.so').waitFor({ state: 'detached' });
  const bare = await target.rest.rows('GFS_Recus');
  check('Échap n\'écrit rien : aucune colonne de marque, aucune ligne touchée', !Object.keys(bare[0]).some(key => /^(Accepte|Refuse)$/.test(key)), Object.keys(bare[0]));
  await frame.locator('.trash-bar .btn').click();
  await frame.locator('.mod.so').waitFor();
  await frame.locator('[data-fk="rx-accept"]').click();
  await frame.locator('.mod.so').waitFor({ state: 'detached' });
  await frame.waitForFunction(() => !document.querySelector('.trash-bar') && !document.querySelector('.ls-row.lk'), null, { timeout: 15000 });
  check('les deux fichiers ne sont plus grisés, la barre est partie, la phrase le dit', !(await greyed(frame, 'Contrat.pdf')) && !(await greyed(frame, 'Devis.pdf')) && (await toast(frame)).includes(t('rx.folder.accepted', { name: 'Contrats', n: 2 })), { toast: await toast(frame) });
  const marked = await target.rest.rows('GFS_Recus');
  const mark = name => marked.find(row => row.Nom === name);
  check('les marques sont sur les deux lignes du dossier, pas sur le fichier seul', mark('Contrat.pdf').Accepte === true && mark('Devis.pdf').Accepte === true && mark('Facture.pdf').Accepte !== true, marked.map(row => [row.Nom, row.Accepte]));
  await shot(frame, '3-accepte');
  await page.keyboard.press('Backspace');
  await frame.waitForFunction(() => document.querySelectorAll('.ls-row.folder').length === 1, null, { timeout: 10000 });
  const accepted = { folder: await folderRow(frame, 'Contrats').locator('.ty .pill').innerText(), grey: (await folderRow(frame, 'Contrats').getAttribute('class')).split(' ').includes('lk'), rail: await badge(frame), bell: await bellBadge(frame) };
  check('le dossier dit « 2 fichiers », n\'est plus grisé ; le volet et la cloche ne comptent plus que le fichier seul (1)', accepted.folder === '2 ' + (lang === 'fr' ? 'fichiers' : 'files') && !accepted.grey && accepted.rail === '1' && accepted.bell === '1', accepted);

  say('--- 4. un fichier de plus dans le dossier ---');
  await alive(source);
  await patch(source, 'GFS_Fichiers', rowIdOf('Avenant.pdf'), { [FOLDER]: 'Contrats' });
  await editExport([idOf('Facture.pdf'), idOf('Devis.pdf'), idOf('Contrat.pdf'), idOf('Avenant.pdf')]);
  await until(list => list.some(row => row.Nom === 'Avenant.pdf' && row.Contenu), 60);
  ui = await view();
  ({ page, frame } = ui);
  await frame.waitForFunction(() => document.querySelectorAll('.ls-row.folder').length === 1, null, { timeout: 15000 });
  const later = { folder: await folderRow(frame, 'Contrats').locator('.ty .pill').innerText(), grey: (await folderRow(frame, 'Contrats').getAttribute('class')).split(' ').includes('lk'), rail: await badge(frame) };
  check('le dossier redevient « 1 fichier à accepter » (grisé), le volet compte 2 (Avenant + le fichier seul)', later.folder === t('rx.folder.pending', { n: 1 }) && later.grey && later.rail === '2', later);
  await folderRow(frame, 'Contrats').dblclick();
  await frame.waitForFunction(() => document.querySelectorAll('.ls-row:not(.folder)').length === 3, null, { timeout: 10000 });
  check('« Avenant.pdf » arrive seul grisé, « Contrat.pdf » et « Devis.pdf » restent acceptés', (await greyed(frame, 'Avenant.pdf')) && !(await greyed(frame, 'Contrat.pdf')) && !(await greyed(frame, 'Devis.pdf')), await names(frame));
  await shot(frame, '4-un-de-plus');

  say('--- 5. un dossier reçu ne se range pas ---');
  await page.keyboard.press('Backspace');
  await frame.waitForFunction(() => document.querySelectorAll('.ls-row.folder').length === 1, null, { timeout: 10000 });
  await folderRow(frame, 'Contrats').click();
  await folderRow(frame, 'Contrats').locator('.rb.mn').click();
  const menu = (await frame.locator('.menu .menu-item .menu-label').allInnerTexts()).map(item => item.trim());
  check('le menu du dossier reçu offre « Ouvrir le dossier » et « Accepter le dossier… », ni renommer, ni déplacer, ni supprimer', menu.includes(t('ex.openFolder')) && menu.includes(t('rx.folder.answer')) && menu.length === 2, menu);
  await shot(frame, '5-menu');
  await page.keyboard.press('Escape');
  const before = await target.rest.rows('GFS_Rangement').catch(() => []);
  await folderRow(frame, 'Contrats').click();
  for (const key of ['F2', 'Delete', 'Control+x']) { await page.keyboard.press(key); await page.waitForTimeout(250); }
  const stillThere = { folders: await folders(frame), dialogs: await frame.locator('.mod').count(), rangement: (await target.rest.rows('GFS_Rangement').catch(() => [])).length === before.length };
  check('F2, Suppr et Ctrl+X ne font rien sur un dossier reçu (ni fenêtre, ni écriture dans le rangement)', JSON.stringify(stillThere.folders) === '["Contrats"]' && stillThere.dialogs === 0 && stillThere.rangement, stillThere);

  say('--- 6. refuser le dossier ---');
  await folderRow(frame, 'Contrats').dblclick();
  await frame.waitForFunction(() => document.querySelectorAll('.ls-row:not(.folder)').length === 3, null, { timeout: 10000 });
  await frame.locator('.trash-bar .btn').click();
  await frame.locator('.mod.so').waitFor();
  await frame.locator('[data-fk="rx-refuse"]').click();
  await frame.locator('.mod.so').waitFor({ state: 'detached' });
  await frame.waitForFunction(() => document.querySelectorAll('.ls-row:not(.folder)').length === 2, null, { timeout: 15000 });
  const refused = await target.rest.rows('GFS_Recus');
  check('« Avenant.pdf » (le seul qui attendait) est refusé ; « Contrat.pdf » et « Devis.pdf » restent acceptés', refused.find(row => row.Nom === 'Avenant.pdf').Refuse === true && refused.find(row => row.Nom === 'Contrat.pdf').Accepte === true && refused.find(row => row.Nom === 'Devis.pdf').Refuse !== true, refused.map(row => [row.Nom, row.Accepte, row.Refuse]));
  if (races.length) say(`(connu : ${races.length} erreur « KeyError 'GFS_Synchro' », sans suite)`);
  check('aucune erreur de GFS dans la console', [source, target, ...views].every(run => unexpected(run).length === 0), [source, target, ...views].map(run => unexpected(run).map(each => each.slice(each.indexOf('was delivered'), each.indexOf('was delivered') + 220))));
} finally {
  await browser.close();
  pages.close();
}
