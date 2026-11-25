// Une table d'app qui sert de SOURCE à un partage de Sync+ (le widget autonome, tables `Synchro…`), puis le renommage de l'app : que devient le lien ? Dans un VRAI serveur Grist
// (`bash vrai-serveur.sh`), avec le VRAI moteur de Sync+ (le kit, préfixe vide comme le widget autonome) et le lot de la VRAIE Publipostage+ (`lab-noms.mjs`).
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-noms-sync.mjs
//   1. Un document aux tables d'avant ; un export Sync+ de `Publipostage_Modeles` (tables `Synchro`, colonnes `id_sync`, `MajLe`).
//   2. Le lot de l'app est envoyé (REST) : ce que disent ensuite `Synchro`, ses formules, la table source ; le moteur, rouvert comme le fait le widget, retrouve-t-il son export ?
//   3. Une ligne ajoutée à la table renommée : le lot d'envoi du moteur la reprend-il ?
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check, constat } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { PAGE_PORT, openGfs } from './lab-pdf.mjs';
import { call, apply, rowsOf } from './lab-rest.mjs';
import { appRegistry, appBatch } from './lab-noms.mjs';

const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const OLD = 'Publipostage_Modeles';
const NEW = 'Publipostage_Templates';
// VARIANT : `all` (le lot entier de l'app), `table` (seulement `RenameTable`), `columns` (seulement les colonnes et les libellés, sur l'ancienne table).
const VARIANT = process.env.VARIANT || 'all';
const NOW = VARIANT === 'columns' ? OLD : NEW;
const COLS = VARIANT === 'table' ? { name: 'Nom', content: 'Contenu', token: 'Jeton' } : { name: 'Name', content: 'Content', token: 'Token' };
try {
  const context = await newContext(browser, server);
  const run = await openGfs(context);
  const { frame } = run;
  await frame.waitForFunction(() => document.body.dataset.gfs === 'ready', null, { timeout: 60000 }).catch(() => {});

  // ----- 1. Un document aux tables d'avant et un export Sync+ d'une table de l'app.
  await apply(run, [['AddTable', OLD, ['Nom', 'Contenu', 'Jeton'].map(id => ({ id, type: 'Text' }))]]);
  await apply(run, [['BulkAddRecord', OLD, [null, null, null], { Nom: ['Facture', 'Devis', 'Contrat'], Contenu: ['a', 'b', 'c'], Jeton: ['t1', 't2', 't3'] }]]);
  const started = await frame.evaluate(async () => {
    const { Transfer, buildTransferFrame } = await import('./js/broker/transfer.js');
    const { createSyncPort } = await import('./js/sharing/sync-port.js');
    const { startEngine } = await import('./kit/js/synchro/index.js');
    const source = await import('./kit/js/synchro/source/synchro.js');
    const common = await import('./kit/js/synchro/logic/common.js');
    const exportsModule = await import('./kit/js/synchro/logic/exports.js');
    const transfer = new Transfer({ doc: grist.docApi, base: document.baseURI, createFrame: url => buildTransferFrame(document, url) });
    const port = createSyncPort({ docApi: grist.docApi, transfer, language: () => 'fr' });
    startEngine({ port, prefix: '' });
    window.__s = { source, common, exportsModule };
    window.__try = async job => { try { return { ok: true, value: await job() }; } catch (error) { return { ok: false, message: String(error.message || error).slice(0, 240) }; } };
    return { table: common.SYNC_TABLE };
  });
  check('le moteur de Sync+ démarre comme le widget autonome : sa table s\'appelle `Synchro`', started.table === 'Synchro', started);
  const saved = await frame.evaluate(({ table }) => window.__try(async () => {
    const { saveChosenExport } = await import('./kit/js/synchro/source/export.js');
    const done = await saveChosenExport({ name: 'Essai', selection: [{ table, columns: ['Nom', 'Contenu', 'Jeton'], filter: null }] });
    window.__s.exportId = done.id;
    return { id: done.id, tables: done.tables.map(entry => entry.table) };
  }), { table: OLD });
  check('un export de `Publipostage_Modeles` est enregistré par le vrai parcours du moteur (table `Synchro`, `id_sync`, `MajLe`)', saved.ok, saved);
  const exportId = saved.ok ? saved.value.id : EXPORT;
  const before = { synchro: await rowsOf(run, 'Synchro'), source: await rowsOf(run, OLD), columns: await frame.evaluate(table => window.__try(async () => (await grist.docApi.fetchTable('_grist_Tables_column')).colId.length), OLD) };
  say('   lignes de Synchro avant :', JSON.stringify((before.synchro || []).map(row => [row.Synchro_Table, row.Synchro_Type])));
  say('   colonnes de la table source avant :', JSON.stringify(Object.keys((before.source || [{}])[0] || {})));
  check('la table source garde ses trois modèles, avec `id_sync` posé', (before.source || []).length === 3 && (before.source || []).every(row => row.id_sync), (before.source || []).map(row => row.id_sync));

  // ----- 2. Le lot de renommage de la vraie Publipostage+.
  const batch = await appBatch(run, appRegistry());
  const everything = batch && batch.actions;
  const plan = !everything ? everything : VARIANT === 'table' ? everything.filter(action => action[0] === 'RenameTable')
    : VARIANT === 'columns' ? everything.filter(action => action[0] !== 'RenameTable').map(action => (action[1] === NEW ? [action[0], OLD, ...action.slice(2)] : action)) : everything;
  say('   variante :', VARIANT, '— actions envoyées :', (plan || []).length);
  check('l\'app calcule son lot de renommage', Array.isArray(plan) && plan.length > 0 && (VARIANT === 'columns' || plan.some(action => action[0] === 'RenameTable' && action[1] === OLD)), (plan || []).length);
  const lotBefore = ((await rowsOf(run, 'Synchro')) || []).filter(row => row.Synchro_Type === 'lot').map(row => String(row.Synchro_Lot || ''));
  say('   lot d\'envoi avant : lignes', JSON.stringify(lotBefore.map(cell => { try { return JSON.parse(cell).lignes.length; } catch { return 'illisible'; } })));
  const renamed = await apply(run, plan);
  say('   le renommage (REST) :', renamed.status, renamed.text.slice(0, 120));
  const tables = (await rowsOf(run, '_grist_Tables')).map(row => row.tableId);
  check(`la table de l'app après le lot (${VARIANT}) : ${NOW}`, tables.includes(NOW), tables.filter(id => !/^_grist/.test(id)));
  const synchro = await rowsOf(run, 'Synchro');
  say('   lignes de Synchro après :', JSON.stringify((synchro || []).map(row => [row.Synchro_Table, row.Synchro_Type])));
  constat('Synchro nomme encore l\'ancienne table : le lien Sync+ ne suit PAS le renommage (le texte `Synchro_Table` n\'est pas une référence que Grist met à jour)', (synchro || []).every(row => row.Synchro_Table === OLD || row.Synchro_Table === ''), (synchro || []).map(row => row.Synchro_Table));
  const formulas = await rowsOf(run, '_grist_Tables_column');
  const synchroRef = (await rowsOf(run, '_grist_Tables')).find(row => row.tableId === 'Synchro').id;
  const text = formulas.filter(column => column.parentId === synchroRef && column.formula).map(column => `${column.colId}: ${String(column.formula).slice(0, 120)}`);
  say('   formules de Synchro après :', JSON.stringify(text));
  constat('les formules de Synchro nomment la nouvelle table (Grist les réécrit)', text.some(line => line.includes(NEW)) && !text.some(line => line.includes(OLD)), text);

  // ----- Le moteur, rouvert comme le fait le widget : retrouve-t-il son export ?
  const reopened = await frame.evaluate(id => window.__try(async () => {
    const changed = await window.__s.source.ensureSyncTable();
    const rows = await window.__s.source.syncRows();
    const exp = window.__s.exportsModule.exportTables(rows, id);
    return { changed, tables: exp.map(entry => entry.table) };
  }), exportId);
  say('   le moteur rouvert :', JSON.stringify(reopened));
  constat('le moteur rouvert retrouve son export sur la table renommée', reopened.ok && reopened.value.tables.includes(NOW), reopened);

  // ----- 3. Une ligne ajoutée à la table renommée : le lot d'envoi la reprend-il ?
  await apply(run, [['AddRecord', NOW, null, { [COLS.name]: 'Nouvelle lettre', [COLS.content]: 'd', [COLS.token]: 't4' }]]);
  await run.page.waitForTimeout(1500);
  const after = await rowsOf(run, NOW);
  const added = after.find(row => row[COLS.name] === 'Nouvelle lettre');
  say('   ligne ajoutée après :', JSON.stringify(added));
  constat('la nouvelle ligne reçoit son `id_sync` (le lien Sync+ la suivrait)', Boolean(added && added.id_sync), added);
  const lotCells = (await rowsOf(run, 'Synchro')).filter(row => row.Synchro_Type === 'lot').map(row => row.Synchro_Lot);
  const count = cell => { try { return JSON.parse(cell).lignes.length; } catch { return typeof cell === 'string' && cell === '' ? 'vide' : JSON.stringify(cell).slice(0, 80); } };
  say('   lot d\'envoi après (lignes) :', JSON.stringify(lotCells.map(count)), '— avant :', JSON.stringify(lotBefore.map(cell => { try { return JSON.parse(cell).lignes.length; } catch { return 'tronqué'; } })));
  say('   contenu du lot après :', JSON.stringify(lotCells.map(cell => String(cell).slice(0, 260))));
  constat('le lot d\'envoi du moteur reprend les quatre lignes (le lien Sync+ continue d\'envoyer)', lotCells.some(cell => count(cell) === 4), lotCells.map(count));
  say('   (la CIBLE reçoit des lignes dont `Synchro_Table` dit l\'ancien nom : à mesurer côté cible si le porteur le demande)');
} finally {
  await browser.close();
  pages.close();
}
