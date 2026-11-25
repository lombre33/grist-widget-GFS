// Relier un document qui n'a encore AUCUN PDF de GFS (donc pas de table `GFS_Fichiers`) : « Relier un autre document Grist… » > « Continuer » (retour du porteur du
// 25/11, docs.getgrist.com, Firefox : « Failed: Error: can't access property "some", cols is null » : le moteur de partage ne crée pas la table des fichiers et lisait
// ses colonnes nulles ; js/sharing/share-files-table.js). Dans un VRAI Grist (`GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash vrai-serveur.sh`), à 700 × 400, à la vraie
// souris, des DEUX côtés, dans GFS lui-même :
//   1. un document qui ne garde que des lignes de Form+ : « Gérer les partages > Autres documents > Relier un document… » dit, dans l'accord, que la table des fichiers naît ;
//      rien n'est écrit avant « Continuer » (le menu et l'accord n'ont créé aucune table) ; « Continuer » ne dit pas « Échec », rend le code ;
//   2. l'autre document reçoit, répond, le même code de contrôle des deux côtés, les documents sont reliés : un webhook, `GFS_Fichiers` vide avec les trois colonnes d'aide,
//      `GFS_Recus` vide chez l'autre ;
//   3. un PDF importé ensuite entre dans la table que le lien a créée (sans nouvelle question : elle existe) et, en « Copie à jour », arrive chez l'autre sans nouveau code ;
//   4. un document qui a déjà des PDF : l'accord garde ses mots d'avant (les trois colonnes d'aide dans la table), rien de la table n'est dit créé.
//   LAB_LANG=fr|en, LAB_SCHEME=light|dark. REPO_DIR="$(realpath ../..)" node run-relier-document-neuf.mjs
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { PAGE_PORT, openGfs, importPdf, pdfFile, waitForNames, openRowMenu, contrastProblems, shot as pdfShot } from './lab-pdf.mjs';
import { fits, gfsFrame } from './lab-droits.mjs';
import { startEngine, formLink, sendComparing, reopenedFrame } from './lab-partage.mjs';
import { seedForms } from './seed.mjs';
import { FILES_COLUMN_IDS, FILES_TABLE } from '../js/files/gfs-files.js';
import { HELPER_COLUMNS } from '../js/sharing/share-other-flow.js';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const shot = (frame, name) => pdfShot(frame, `relier-neuf-${lang}-${scheme}-${name}`);
const unexpected = run => run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
const text = async (frame, selector) => (await frame.locator(selector).innerText()).replace(/\s+/g, ' ');
const webhooks = ({ page, docId }) => page.evaluate(async id => (await (await fetch(`/api/docs/${id}/webhooks`)).json()).webhooks.length, docId);
const closeAll = async (page, frame) => { await page.keyboard.press('Escape'); await frame.locator('.mod-scrim').first().waitFor({ state: 'detached' }).catch(() => {}); };
const paste = async (page, frame, key, value) => { await frame.locator(`[data-fk="${key}"]`).click(); await page.keyboard.insertText(value); };
const columnsOf = async (run, table) => ((await run.page.evaluate(async ({ doc, table }) => (await (await fetch(`/api/docs/${doc}/tables/${table}/columns`)).json()).columns || [], { doc: run.docId, table })).map(column => column.id));
const FORM = 'Inscription à une formation';

// « Gérer les partages > Autres documents > Relier un document… » : l'accord du lien est ouvert.
async function openLink(run, rowName) {
  await openRowMenu(run.frame, rowName);
  await run.frame.getByRole('menuitem', { name: new RegExp(`^${t('share.menu')}`) }).click();
  await run.frame.locator('.mod.sh').waitFor();
  await run.frame.locator('[data-fk="share-manage"]').click();
  await run.frame.locator('.mod.mg [data-fk="manage-tab-other"]').click();
  await run.frame.locator('.mod.mg [data-fk="manage-other-new"]').waitFor();
  await run.frame.locator('.mod.mg [data-fk="manage-other-new"]').click();
  await run.frame.locator('.mod.so [data-fk="so-continue"]').waitFor();
}

const pluginApi = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi, { colorScheme: scheme });
  const source = await openGfs(context, { lang });
  say('--- 0. un document sans aucun PDF de GFS : seulement une ligne de Form+ ---');
  await seedForms(source.frame);
  await source.page.reload();
  source.frame = await gfsFrame(source.page);
  await source.frame.locator('.ls-row').first().waitFor();
  const target = await openGfs(context, { lang });
  await startEngine(target.frame);
  check('le document de départ n\'a pas la table des fichiers', !(await source.rest.tables()).includes(FILES_TABLE), await source.rest.tables());

  say('--- 1. « Relier un document… » : l\'accord dit que la table naît, rien n\'est écrit avant « Continuer » ---');
  await openLink(source, FORM);
  const accord = await text(source.frame, '.mod.so');
  const created = t('so.accord.files', { table: FILES_TABLE, columns: HELPER_COLUMNS.join(', ') });
  check('l\'accord dit que la table « GFS_Fichiers » naît vide, avec les trois colonnes d\'aide', accord.includes(created), accord);
  check('et ne dit plus « trois colonnes d\'aide dans la table » (elle n\'existe pas encore)', !accord.includes(t('so.accord.columns', { table: FILES_TABLE, columns: HELPER_COLUMNS.join(', ') })), accord);
  check('la fenêtre tient dans le panneau, contraste de 4,5:1', await fits(source.frame, '.mod.so'), await contrastProblems(source.frame, '.mod.so'));
  check('le menu et l\'accord n\'ont créé aucune table', !(await source.rest.tables()).includes(FILES_TABLE), await source.rest.tables());
  await shot(source.frame, '1-accord');
  await source.frame.locator('[data-fk="so-continue"]').click();
  await source.frame.locator('[data-fk="so-code"]').waitFor({ timeout: 30000 });
  check('« Continuer » donne le code, sans « Échec »', !(await text(source.frame, '.mod.so')).includes(lang === 'fr' ? 'Échec' : 'Failed'), await text(source.frame, '.mod.so'));
  const code = await source.frame.locator('[data-fk="so-code"]').inputValue();
  await shot(source.frame, '2-code');
  const columns = await columnsOf(source, FILES_TABLE);
  check('la table des fichiers est là, avec ses colonnes et les trois colonnes d\'aide du moteur', FILES_COLUMN_IDS.every(id => columns.includes(id)) && HELPER_COLUMNS.every(id => columns.includes(id)), columns);
  check('elle est vide', (await source.rest.rows(FILES_TABLE)).length === 0);

  say('--- 2. l\'autre document reçoit, répond, les deux comparent le code ---');
  await target.frame.getByRole('button', { name: /^(Nouveau|New)$/ }).click();
  await target.frame.getByRole('menuitem', { name: /^(Importer|Import)/ }).click();
  await target.frame.locator('.menu-sub').getByRole('menuitem', { name: new RegExp(`^${t('sr.entry').replace('…', '')}`) }).click();
  await paste(target.page, target.frame, 'sr-invite', code);
  await target.frame.locator('[data-fk="sr-continue"]').click();
  await target.frame.locator('[data-fk="sr-accept"]').waitFor({ timeout: 20000 });
  await target.frame.locator('[data-fk="sr-accept"]').click();
  await target.frame.locator('[data-fk="sr-link"]').waitFor({ timeout: 30000 });
  const { link } = await formLink(target);
  await paste(target.page, target.frame, 'sr-link', link);
  await target.frame.locator('[data-fk="sr-check"]').click();
  await target.frame.locator('[data-fk="sr-control"]').waitFor({ timeout: 30000 });
  const reply = await target.frame.locator('[data-fk="sr-code"]').inputValue();
  const control = await target.frame.locator('[data-fk="sr-control"]').innerText();
  await paste(source.page, source.frame, 'so-reply', reply);
  await source.frame.locator('[data-fk="so-check"]').click();
  await source.frame.locator('[data-fk="so-control"]').waitFor({ timeout: 30000 });
  check('le même code de contrôle des deux côtés', (await source.frame.locator('[data-fk="so-control"]').innerText()) === control, control);
  await sendComparing(source.frame);
  let done = false;
  for (let i = 0; i < 120 && !done; i += 1) { done = (await text(source.frame, '.mod.so')).includes(t('so.done.link.hint')); if (!done) await source.page.waitForTimeout(1000); }
  check('la fenêtre dit que les documents sont reliés et que rien n\'est parti', done, await text(source.frame, '.mod.so'));
  await shot(source.frame, '3-relie');
  await source.frame.locator('[data-fk="so-close"]').click();
  await target.frame.locator('[data-fk="so-close"]').click();
  await Promise.all([reopenedFrame(source), reopenedFrame(target)]);
  check('un webhook chez l\'envoyeur', (await webhooks(source)) === 1);
  check('la table des fichiers reste là, vide', (await source.rest.tables()).includes(FILES_TABLE) && (await source.rest.rows(FILES_TABLE)).length === 0);
  await source.page.waitForTimeout(6000);
  check('chez l\'autre, GFS_Recus existe et reste vide', (await target.rest.tables()).includes('GFS_Recus') && (await target.rest.rows('GFS_Recus')).length === 0, await target.rest.tables());

  say('--- 3. un PDF importé ensuite entre dans la table du lien, puis part en « Copie à jour » ---');
  const bill = pdfFile('Facture.pdf', 2, 'Facture');
  await importPdf(source.page, source.frame, bill.file);
  check('le PDF entre dans l\'explorateur sans nouvelle question (la table existe)', (await waitForNames(source.frame, ['Facture.pdf'])).includes('Facture.pdf') && (await source.frame.locator('.mod.ask').count()) === 0);
  await openRowMenu(source.frame, 'Facture.pdf');
  await source.frame.getByRole('menuitem', { name: new RegExp(`^${t('share.menu')}`) }).click();
  await source.frame.locator('.mod.sh .rt-content').waitFor();
  await source.frame.locator('[data-fk="share-tab-other"]').click();
  await source.frame.locator('.mod.sh .rr[data-link]').waitFor({ timeout: 20000 });
  await source.frame.locator('.mod.sh .rr[data-link] .lvl').first().click();
  await source.frame.locator('.menu .menu-item', { hasText: t('so.level.live') }).click();
  let rows = [];
  for (let i = 0; i < 90 && !rows.some(row => row.Nom === 'Facture.pdf' && row.Contenu); i += 1) { rows = await target.rest.rows('GFS_Recus'); if (!rows.some(row => row.Contenu)) await source.page.waitForTimeout(1500); }
  check('Facture arrive chez l\'autre avec son contenu, sans nouveau code', rows.some(row => row.Nom === 'Facture.pdf' && row.Contenu) && (await source.frame.locator('.mod.so').count()) === 0, rows.map(row => row.Nom));
  await closeAll(source.page, source.frame);
  await closeAll(source.page, source.frame);

  say('--- 4. un document qui a déjà des PDF : l\'accord garde ses mots d\'avant ---');
  const other = await openGfs(context, { lang });
  await importPdf(other.page, other.frame, pdfFile('Devis.pdf', 1, 'Devis').file);
  await other.frame.locator('.mod.ask').waitFor();
  await other.frame.locator('[data-fk="ask-yes"]').click();
  await waitForNames(other.frame, ['Devis.pdf']);
  await openLink(other, 'Devis.pdf');
  const known = await text(other.frame, '.mod.so');
  check('l\'accord dit « trois colonnes d\'aide dans GFS_Fichiers », pas qu\'une table naît', known.includes(t('so.accord.columns', { table: FILES_TABLE, columns: HELPER_COLUMNS.join(', ') })) && !known.includes(created), known);
  await shot(other.frame, '4-accord-avec-pdf');
  await closeAll(other.page, other.frame);
  check('aucune erreur de GFS dans la console, des trois documents', [source, target, other].every(run => unexpected(run).length === 0), [source, target, other].flatMap(unexpected));
} finally {
  await browser.close();
  pages.close();
}
