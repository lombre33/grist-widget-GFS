// Les noms anglais des tables de GFS (retour n° 1 du porteur, 25/11 ; js/files/gfs-names.js, names-update.js), dans un VRAI serveur Grist (l'image officielle, `bash vrai-serveur.sh`), à la
// vraie souris. Le document d'avant est bâti avec le CODE D'AVANT (le dépôt tel qu'il était avant le renommage, à extraire : voir plus bas), pas avec un faux : ses tables, ses colonnes, ses
// formules d'aide sur la table d'une app et ses règles d'accès sont ceux que l'ancienne version de GFS écrivait.
//   1. à l'ouverture, une fenêtre bloquante propose la mise à jour (rien d'autre n'est cliquable), le lot part d'un seul envoi, GFS finit de s'ouvrir ;
//   2. les tables et colonnes de GFS ont leurs noms anglais, les lignes et les valeurs sont celles d'avant (les valeurs écrites par Grist à la création aussi : l'auteur d'un partage), la table
//      de l'app et celle de la personne ne changent pas ;
//   3. Grist a réécrit tout seul les formules d'aide des tables d'apps et les règles d'accès : elles sont CELLES que le nouveau GFS écrirait (texte à l'octet près), et le nouveau plan du
//      partage dit « déjà fait » ;
//   4. les colonnes d'aide donnent les mêmes valeurs qu'avant ;
//   5. rouvert, GFS ne propose plus rien ; les pages des tables sont sous celle de GFS ;
//   6. (lot 2) la table des PDF devient `GFS_Files` (`FileId`, `Name`…), les colonnes d'aide du partage passent à leurs noms anglais sur la table de l'app comme sur celle des PDF, et
//      un document où Sync+ est actif (`GFS_Synchro`, `id_sync`) garde `GFS_Fichiers` et ses colonnes d'aide d'avant, que GFS lit et complète sous ces noms ; le PDF se lit dans les deux.
// LAB_STALE=<fichier> : joue le lot du kit seul, sans la fenêtre ni la reprise des formules (document sans Sync+), et y écrit { before, after, expected } : `stale` est ce que Grist laisse
//   (test/golden/formules-apres-renommage.json, refait par outils/formules-mesurees.mjs d'après ce fichier).
//
// L'ancien code : `mkdir -p /tmp/gfs-avant && git archive <commit d'avant le renommage> prototype/js | tar -x -C /tmp/gfs-avant` (AVANT_DIR pour un autre dossier).
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-noms-gfs.mjs
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { serve } from './lab-server.mjs';
import { chromium, say, check, constat, SHOTS } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { PAGE_PORT, openGfs, windowFits } from './lab-pdf.mjs';
import * as now from '../js/sharing/sharing-model.js';
import { filesColumns, FILES_NAMES, useFilesNames, filesNamesOfTables } from '../js/files/gfs-files.js';
import { HELPER_BEFORE } from '../js/sharing/helper-names.js';
import { NOTICES_TABLE, noticeColumns } from '../js/sharing/notice-model.js';
import { planGfsNames } from '../js/files/gfs-names.js';
import { COLUMNS as FILING_NOW } from '../js/files/rangement.js';
import { BIN_COLUMNS as TRASH_NOW } from '../js/files/gfs-trash.js';
import { ANNUAIRES_COLUMNS as DIRS_NOW } from '../js/annuaire/annuaire-config.js';
import { GFS_RENAMES } from '../js/files/gfs-names.js';
import { base } from '../test/sharing-fixtures.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
let TAG = `noms-gfs-${lang}-${scheme}`;
const HELPER_AFTER = Object.fromEntries(Object.entries(HELPER_BEFORE).map(([after, before]) => [before, after]));
const PDF = { Identifiant: 'ab12cd34', Nom: 'Facture.pdf', Type: 'pdf', Date: 200, Auteur: 'ana@example.org', Taille: 1200, Origine: 'import' };
const AVANT = process.env.AVANT_DIR || '/tmp/gfs-avant/prototype';
const loadBefore = async path => import(pathToFileURL(join(AVANT, path)).href);
const before = await loadBefore('js/sharing/sharing-model.js');
const { FILES_COLUMNS: FILES_BEFORE } = await loadBefore('js/files/gfs-files.js');
const { COLUMNS: FILING_BEFORE } = await loadBefore('js/files/rangement.js');
const { BIN_COLUMNS: TRASH_BEFORE } = await loadBefore('js/files/gfs-trash.js');
const { ANNUAIRES_COLUMNS: DIRS_BEFORE } = await loadBefore('js/annuaire/annuaire-config.js');

const PP = { id: 'publipostage', fichiers: [{ table: 'Publipostage_Modeles', colonnes: { id: 'id', nom: 'Nom' }, exclure: { TypeModele: ['reglages'] } }] };
const APP_TABLE = 'Publipostage_Modeles';
const PEOPLE = 'Clients';
const shot = (run, name) => run.page.screenshot({ path: join(SHOTS, `${TAG}-${name}.png`) });

const apply = (run, actions) => run.page.evaluate(async ([docId, body]) => (await fetch(`/api/docs/${docId}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body) })).json(), [run.docId, actions]);
// Grist refait parfois le cadre du widget quand des pages s'ajoutent : on reprend le cadre vivant avant de lire.
const alive = async run => { if (run.frame.isDetached()) run.frame = await findFrame(run); return run.frame; };
const fetchTable = async (run, name) => (await alive(run)).evaluate(table => grist.docApi.fetchTable(table), name);
const rowsOf = data => (data && data.id ? data.id.map((id, i) => Object.fromEntries(Object.keys(data).map(key => [key, data[key][i]]))) : []);
// La ligne-sonde de `GFS_Filing` (`@sonde`) est ajoutée par GFS puis retirée aussitôt (rangement.js) : on ne lit pas la table pendant qu'elle y est (jusqu'à 10 s). Il arrive (document
// tenu par Sync+, une fois sur deux ou trois) que la ligne reste : le retrait est perdu, cause non mesurée (le cadre refait ?). Ce n'est pas ce que cet essai mesure : elle n'est pas comptée.
const rows = async (run, name) => {
  for (let attempt = 0; ; attempt += 1) {
    const list = rowsOf(await fetchTable(run, name));
    if (!list.some(row => row.User === '@sonde')) return list;
    if (attempt >= 20) return list.filter(row => row.User !== '@sonde');
    await run.page.waitForTimeout(500);
  }
};
const pick = (list, keys) => list.map(row => Object.fromEntries(keys.map(key => [key, row[key]])));

// Les notifications d'avant (`Pour`, `Cible`, `Par`, `Cle`, `Quand`, `Lu` : faits vérifiés 179) : le code d'avant du labo ne les connaît pas (elles sont nées après lui). On les pose sous
// leurs noms d'avant, avec les règles que le code d'aujourd'hui écrit, les noms d'avant remis dans les formules et les colonnes des ressources (les notes restent telles quelles).
const NOTICE_WAS = Object.freeze({ Recipient: 'Pour', Target: 'Cible', By: 'Par', Key: 'Cle', When: 'Quand', Read: 'Lu' });
const noticeWas = text => String(text).replace(/\b(Recipient|Target|By|Key|When|Read)\b/g, name => NOTICE_WAS[name]);
function noticesBefore(existing) {
  let resource = Math.max(...existing.resources.map(item => item.id));
  let id = Math.max(...existing.rules.map(item => item.id));
  const actions = [['AddTable', NOTICES_TABLE, noticeColumns().map(column => ({ ...column, id: NOTICE_WAS[column.id] || column.id }))]];
  for (const { colIds, rules } of [...now.noticeColumnGroups(), { colIds: '*', rules: now.noticeTableRules() }]) {
    resource += 1;
    actions.push(['AddRecord', '_grist_ACLResources', resource, { tableId: NOTICES_TABLE, colIds: noticeWas(colIds) }]);
    rules.forEach((rule, at) => actions.push(['AddRecord', '_grist_ACLRules', (id += 1), { resource, aclFormula: noticeWas(rule.formula), permissionsText: rule.rights, rulePos: at + 1, memo: rule.memo }]));
  }
  return actions;
}

// Ce que le lecteur des droits de GFS rend (js/rights/rights-reader.js, `raw`) : les règles et ressources en entier, les tables et leurs colonnes.
async function existingOf(run, targets) {
  const [resources, rules, tables, columns] = await Promise.all(['_grist_ACLResources', '_grist_ACLRules', '_grist_Tables', '_grist_Tables_column'].map(name => rows(run, name)));
  return { resources, rules, tables: pick(tables, ['id', 'tableId']), columns: pick(columns, ['id', 'parentId', 'colId', 'type', 'isFormula', 'formula', 'visibleCol']), fileIds: [], files: {}, targets };
}
const schemaOf = async run => {
  const [tables, columns] = await Promise.all([rows(run, '_grist_Tables'), rows(run, '_grist_Tables_column')]);
  const byRef = new Map(tables.map(row => [row.id, row.tableId]));
  const out = {};
  for (const name of byRef.values()) if (!/^_?grist/i.test(name)) out[name] = [];
  for (const column of columns) { const table = byRef.get(column.parentId); if (out[table] && column.colId !== 'manualSort' && !/^gristHelper/.test(column.colId)) out[table].push(column.colId); }
  return out;
};
const formulasOf = async run => {
  const [tables, columns] = await Promise.all([rows(run, '_grist_Tables'), rows(run, '_grist_Tables_column')]);
  const byRef = new Map(tables.map(row => [row.id, row.tableId]));
  return Object.fromEntries(columns.filter(col => byRef.has(col.parentId) && !/^_?grist/i.test(byRef.get(col.parentId)) && col.formula && !/^gristHelper/.test(col.colId))
    .map(col => [`${byRef.get(col.parentId)}.${col.colId}`, col.formula]));
};
const rulesOf = async run => {
  const [resources, rules] = await Promise.all([rows(run, '_grist_ACLResources'), rows(run, '_grist_ACLRules')]);
  const by = new Map(resources.map(row => [row.id, row]));
  return rules.filter(rule => by.has(rule.resource)).map(rule => JSON.stringify([by.get(rule.resource).tableId, by.get(rule.resource).colIds, rule.aclFormula, rule.permissionsText, rule.memo])).sort();
};
// Ce que le plan d'un document SANS rien (que la table de l'app et les tables de GFS que les essais créent) écrit : les formules et les règles attendues, d'après le code d'aujourd'hui.
function expectedFrom(actions) {
  const formulas = {}; const resources = new Map(); const rules = [];
  for (const [verb, table, id, values] of actions) {
    if (verb === 'AddTable') for (const column of (values === undefined ? id : [])) if (column.formula) formulas[`${table}.${column.id}`] = column.formula;
    if (verb === 'AddColumn' && values && values.formula) formulas[`${table}.${id}`] = values.formula;
    if (verb === 'AddRecord' && table === '_grist_ACLResources') resources.set(id, values);
    if (verb === 'AddRecord' && table === '_grist_ACLRules') rules.push(values);
  }
  return { formulas, rules: rules.filter(rule => resources.has(rule.resource)).map(rule => JSON.stringify([resources.get(rule.resource).tableId, resources.get(rule.resource).colIds, rule.aclFormula,
    rule.permissionsText, rule.memo])).sort() };
}

async function findFrame(run, wanted = null) {
  for (let i = 0; i < 160; i++) {
    const frame = run.page.frames().find(each => /access=full/.test(each.url()) && !each.isDetached());
    if (frame && (!wanted || await frame.evaluate(wanted).catch(() => false))) return frame;
    await run.page.waitForTimeout(500);
  }
  throw new Error('Le cadre de GFS ne s\'est pas rouvert comme prévu.');
}
async function reopen(run, wanted) {
  await run.page.reload({ waitUntil: 'load' });
  await run.page.locator('.test-onboarding-popup').first().waitFor({ timeout: 4000 }).catch(() => {});
  await run.page.keyboard.press('Escape');
  for (let i = 0; i < 80 && !run.frame.isDetached(); i++) await run.page.waitForTimeout(100);
  run.frame = await findFrame(run, wanted);
}
const READY = () => document.body.dataset.gfs === 'ready' && document.body.dataset.gfsFirstRun === 'done';
const WINDOW = () => Boolean(document.querySelector('.mod.names'));

const server = await requireServer();
const pagesServer = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, server, { colorScheme: scheme });
  for (const held of process.env.LAB_ONLY ? [process.env.LAB_ONLY === 'sync'] : [false, true]) { // LAB_ONLY=sync|plain : un seul des deux documents
  TAG = `noms-gfs${held ? '-sync' : ''}-${lang}-${scheme}`;
  const run = await openGfs(context, { lang });
  say(`\n######## ${held ? 'Sync+ actif : GFS_Fichiers reste d\'avant' : 'Sync+ absent'} ########`);

  say('\n=== Le document d\'avant, bâti avec le code d\'avant ===');
  const targetsBefore = before.targetsOf([PP]);
  const col = (id, type = 'Text') => ({ id, type });
  let answer = await apply(run, [['AddTable', APP_TABLE, [col('Nom'), col('TypeModele'), col('Contenu')]], ['BulkAddRecord', APP_TABLE, [null, null, null], { Nom: ['Convocation', 'Attestation', 'Relance'],
    TypeModele: ['document', 'grille', 'email'], Contenu: ['<p>a</p>', '<p>b</p>', '<p>c</p>'] }],
    ['AddTable', 'GFS_Rangement', FILING_BEFORE.map(({ id, type, ...more }) => ({ id, type, ...more }))], ['AddTable', 'GFS_Corbeille', TRASH_BEFORE.map(({ id, type }) => ({ id, type }))],
    ['AddTable', 'GFS_Annuaires', DIRS_BEFORE.map(({ id, type }) => ({ id, type }))]]);
  check('les tables d\'avant sont posées (l\'app, le rangement, la corbeille, les annuaires)', !answer.error, answer);
  const planBefore = before.planSharing(await existingOf(run, targetsBefore), FILES_BEFORE, targetsBefore);
  check('le plan d\'avant du partage réussit (tables de partage, colonnes d\'aide sur la table de l\'app, règles d\'accès)', planBefore.ok === true, planBefore.reason);
  answer = await apply(run, planBefore.actions);
  check('Grist applique le plan d\'avant', !answer.error, answer);
  answer = await apply(run, noticesBefore(await existingOf(run, targetsBefore)));
  check('les notifications d\'avant sont posées (table sous ses noms d\'avant, règles d\'accès sur `Pour`)', !answer.error, answer);
  answer = await apply(run, [
    ['AddRecord', 'GFS_Rangement', null, { Utilisateur: '@document', App: 'gfs', Fichier: 'structure', Valeur: '{"structure":1}' }],
    ['AddRecord', 'GFS_Rangement', null, { Utilisateur: '', App: 'publipostage', Fichier: '2', Favori: true, Dossier: 'Contrats', Replie: false, Valeur: '' }],
    ['AddRecord', 'GFS_Partages', null, { Cible: 'publipostage:2', Personne: 'lea@example.org', Droit: 'lecture', Telecharger: true }],
    ['AddRecord', 'GFS_Partages', null, { Cible: 'publipostage:3', Personne: '@editeurs', Droit: 'ecriture' }],
    ['AddRecord', 'GFS_Groupes', null, { Nom: 'Achats', PersonnesIci: 'lea@example.org\nmarc@example.org' }],
    ['AddRecord', 'GFS_Espaces', null, { Cle: 'achats', Nom: 'Achats' }],
    ['AddRecord', 'GFS_Placement', null, { Cible: 'publipostage:2', Espace: 'achats', Dossier: 'Contrats' }],
    ['AddRecord', 'GFS_Corbeille', null, { Identifiant: 'aabbccddeeff', App: 'publipostage', Table: APP_TABLE, FichierId: '9', Nom: 'Vieux modèle', Type: 'email', Date: 300, Auteur: 'ana@example.org',
      SupprimeLe: 1762000000, SupprimePar: 'ana@example.org', Instantane: '{"format":1,"id":9,"valeurs":{"Nom":"Vieux modèle"}}' }],
    ['AddRecord', 'GFS_Annuaires', null, { Nom: 'Personnes', Table: PEOPLE, Config: '{"v":1}', Parent: '', Fiches: '' }],
    ['AddRecord', 'GFS_Fichiers', null, PDF],
    ['AddRecord', NOTICES_TABLE, null, { Pour: 'lea@example.org', Type: 'fichier', Cible: 'gfs-fichiers:ab12cd34', Par: 'ana@example.org', Cle: 'fichier|gfs-fichiers:ab12cd34', Lu: false }],
    ['AddRecord', NOTICES_TABLE, null, { Pour: 'marc@example.org', Type: 'espace', Cible: 'espace:achats', Par: 'ana@example.org', Cle: 'espace|achats', Lu: true }],
    ...(held ? [['AddTable', 'GFS_Synchro', [col('Cle')]], ['AddColumn', 'GFS_Fichiers', 'id_sync', { type: 'Text' }]] : [])]);
  check('les lignes d\'avant sont écrites (rangement, partages, groupe, espace, placement, corbeille, annuaire)', !answer.error, answer);
  const tablesBefore = await schemaOf(run);
  const dataBefore = Object.fromEntries(await Promise.all(Object.keys(tablesBefore).map(async name => [name, await rows(run, name)])));
  const formulasBefore = await formulasOf(run);
  check('un document d\'avant : les tables ont leurs noms français, les colonnes d\'aide sont sur la table de l\'app', Boolean(tablesBefore.GFS_Rangement && tablesBefore.GFS_Partages) &&
    tablesBefore[APP_TABLE].includes('GFS_Lecteurs'), Object.keys(tablesBefore));
  const HELPERS_SEEN = ['GFS_Lecteurs', 'GFS_Ecrivains', 'GFS_Admins', 'GFS_Ids', 'GFS_Dossier', 'GFS_Refus', 'GFS_CatsEcrit', 'GFS_Directs', 'GFS_Vus', 'GFS_Auteur'];
  const helpersOf = (data, table) => Object.fromEntries(HELPERS_SEEN.map(name => [name, data[table].map(row => JSON.stringify(row[name]))]));
  const helperBefore = { app: helpersOf(dataBefore, APP_TABLE), pdf: helpersOf(dataBefore, 'GFS_Fichiers') };
  say('   tables avant :', Object.keys(tablesBefore).join(', '));
  say('   valeurs d\'une colonne d\'aide avant :', JSON.stringify(helperBefore.app.GFS_Lecteurs));
  const staleMode = Boolean(process.env.LAB_STALE) && !held;
  let staleNow = null;
  const frame = () => run.frame;
  if (staleMode) {
    // Le lot du kit seul, joué à la main (sans fenêtre ni reprise de GFS) : les formules telles que Grist les laisse (DUMP_FORMULAS les écrit).
    answer = await apply(run, planGfsNames({ tables: tablesBefore }));
    check('le lot du kit part sans erreur', !answer.error, answer);
    staleNow = await formulasOf(run); // lues AVANT la réouverture : à l'ouverture, GFS reprend les formules tout seul
    await reopen(run, READY);
  }

  if (!staleMode) {
  say('\n=== La personne rouvre le document : la fenêtre de mise à jour des noms ===');
  await reopen(run, WINDOW);
  await run.page.waitForTimeout(400);
  const state = await frame().evaluate(() => ({ ready: document.body.dataset.gfs === 'ready', title: document.querySelector('.mod.names h2')?.textContent,
    buttons: [...document.querySelectorAll('.mod.names button:not([hidden])')].map(button => button.textContent), text: document.querySelector('.names-body')?.textContent || '' }));
  say('   fenêtre :', JSON.stringify(state).slice(0, 600));
  await shot(run, '1-fenetre');
  check('GFS ne s\'est pas ouvert derrière : la fenêtre passe avant toute lecture', state.ready === false);
  const words = lang === 'fr' ? { start: 'Mettre à jour', done: 'Terminé', cont: 'Continuer' } : { start: 'Update', done: 'Done', cont: 'Continue' };
  check(`un seul bouton, « ${words.start} » (fenêtre bloquante : ni Annuler ni Fermer)`, state.buttons.join() === words.start, state.buttons);
  check('elle dit que les données ne changent pas, que c\'est l\'affaire de quelques secondes, et le nombre de tables', /(mêmes lignes|same rows)/.test(state.text) && /(quelques secondes|few seconds)/.test(state.text), state.text.slice(0, 200));
  const fit = await windowFits(run.frame);
  check('la fenêtre tient dans le panneau de 700 × 400, rien n\'y déborde', fit.shown === true && fit.inPanel === true && fit.overflowing.length === 0, fit);
  // La liste des noms s'ouvre à la souris : la fenêtre reste dans le panneau (son corps défile), le bouton reste visible et la liste se lit en entier en défilant.
  const summary = await frame().locator('.names-details summary').boundingBox();
  await run.page.mouse.click(summary.x + 10, summary.y + summary.height / 2);
  await run.page.waitForTimeout(300);
  const opened = await windowFits(run.frame);
  const listing = await frame().evaluate(() => {
    const body = document.querySelector('.names-body'); const list = document.querySelector('.names-pairs'); const ok = document.querySelector('[data-fk="names-ok"]');
    const at = ok.getBoundingClientRect(); const mod = document.querySelector('.mod.names').getBoundingClientRect();
    return { items: list.children.length, scrolls: body.scrollHeight > body.clientHeight, sideways: body.scrollWidth > body.clientWidth + 1, okVisible: at.top >= mod.top && at.bottom <= mod.bottom,
      text: list.textContent.slice(0, 120) };
  });
  await shot(run, '1b-liste');
  check('la liste ouverte : la fenêtre tient toujours dans le panneau (son corps défile, rien ne déborde sur le côté), le bouton reste visible, cinq paires et « … et 1 autre »',
    opened.inPanel === true && !listing.sideways && listing.okVisible && listing.items === 6, { opened, listing });
  await run.page.mouse.click(summary.x + 10, summary.y + summary.height / 2);
  await run.page.waitForTimeout(200);
  await run.page.keyboard.press('Escape');
  await run.page.waitForTimeout(300);
  check('Échap ne ferme pas la fenêtre avant la mise à jour', await frame().evaluate(WINDOW));
  const scrim = await frame().locator('.mod-scrim').first().boundingBox();
  await run.page.mouse.click(scrim.x + 4, scrim.y + 4);
  await run.page.waitForTimeout(300);
  check('un clic sur le voile ne la ferme pas non plus', await frame().evaluate(WINDOW));
  const click = async text => {
    const box = await frame().locator('.mod.names button:not([hidden])').filter({ hasText: text }).boundingBox();
    await run.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  };
  await click(words.start);
  await frame().locator('.names-ok').waitFor({ timeout: 60000 });
  const doneText = await frame().locator('.names-body').textContent();
  say('   résultat :', doneText.slice(0, 160));
  await shot(run, '2-fait');
  check(`elle dit « ${words.done} »`, doneText.includes(words.done), doneText);
  await click(words.cont);
  await frame().waitForFunction(READY, null, { timeout: 60000 });
  await run.page.waitForTimeout(1500);
  }

  say('\n=== Les noms, les lignes et les valeurs ===');
  const tablesAfter = await schemaOf(run);
  say('   tables après :', Object.keys(tablesAfter).join(', '));
  const filesTable = held ? 'GFS_Fichiers' : 'GFS_Files';
  const newNames = { [filesTable]: held ? FILES_BEFORE : filesColumns(), GFS_Filing: FILING_NOW, GFS_Groups: now.groupColumns(), GFS_Spaces: now.spaceColumns(), GFS_Placement: now.placeColumns(), GFS_Shares: now.shareColumns(), GFS_Trash: TRASH_NOW,
    GFS_Directories: DIRS_NOW, [NOTICES_TABLE]: noticeColumns() };
  for (const [name, columns] of Object.entries(newNames)) {
    const actual = (tablesAfter[name] || []).filter(id => id !== 'id' && id !== 'id_sync' && !id.startsWith('GFS_')); // les colonnes d'aide, posées sur les tables de fichiers, ont leur propre contrôle ; `id_sync` est celle de Sync+
    check(`${name} : exactement les colonnes que le code d'aujourd'hui pose (aucune oubliée, aucune en trop)`, JSON.stringify(actual) === JSON.stringify(columns.map(column => column.id)), actual);
  }
  check('aucune table d\'avant ne reste (sauf celle que Sync+ tient), aucune ne s\'est ajoutée (pas de « 2 »)', GFS_RENAMES.every(entry => entry.before === entry.table ||
    !tablesAfter[entry.before] || (held && entry.table === 'GFS_Files')) && Boolean(tablesAfter[filesTable]) &&
    Object.keys(tablesAfter).length === Object.keys(tablesBefore).length, Object.keys(tablesAfter));
  check('la table de l\'app et celle des personnes gardent leurs noms et leurs colonnes (sauf celles d\'aide, qui suivent)', JSON.stringify(tablesAfter[PEOPLE]) === JSON.stringify(tablesBefore[PEOPLE]) &&
    JSON.stringify(tablesAfter[APP_TABLE]) === JSON.stringify(tablesBefore[APP_TABLE].map(id => HELPER_AFTER[id] || id)), [tablesAfter[PEOPLE], tablesAfter[APP_TABLE]]);
  const dataAfter = Object.fromEntries(await Promise.all(Object.keys(tablesAfter).map(async name => [name, await rows(run, name)])));
  for (const entry of GFS_RENAMES) {
    const keptAsIs = held && entry.table === 'GFS_Files'; // Sync+ tient la table : mêmes noms, mêmes colonnes d'aide
    const was = dataBefore[entry.before]; const is = dataAfter[keptAsIs ? entry.before : entry.table];
    const columnsMap = keptAsIs ? {} : { ...entry.columns, ...HELPER_AFTER };
    const mapped = was.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [columnsMap[key] || key, value])));
    const same = JSON.stringify(mapped.map(row => Object.entries(row).sort())) === JSON.stringify(pick(is, Object.keys(mapped[0] || {})).map(row => Object.entries(row).sort()));
    check(`${keptAsIs ? entry.before : entry.table} : ${was.length} ligne(s), les mêmes valeurs qu'avant sous les noms d'arrivée (l'auteur d'un partage, que Grist écrit à la création, n'est pas recalculé)`,
      was.length === is.length && same, { lengths: [was.length, is.length], was: mapped.slice(0, 3), is: is.slice(0, 3) });
  }
  check('les lignes de l\'app et des personnes sont inchangées', JSON.stringify(dataAfter[PEOPLE]) === JSON.stringify(dataBefore[PEOPLE]) &&
    JSON.stringify(pick(dataAfter[APP_TABLE], ['id', 'Nom', 'TypeModele', 'Contenu'])) === JSON.stringify(pick(dataBefore[APP_TABLE], ['id', 'Nom', 'TypeModele', 'Contenu'])));
  check('la table des PDF : la même ligne, lisible sous ses noms (`Name` dans le document mis à jour, `Nom` dans celui que Sync+ tient)',
    dataAfter[filesTable].length === 1 && (dataAfter[filesTable][0][held ? 'Nom' : 'Name'] === 'Facture.pdf') && dataAfter[filesTable][0][held ? 'Identifiant' : 'FileId'] === PDF.Identifiant, dataAfter[filesTable]);

  say('\n=== Les formules d\'aide et les règles d\'accès que Grist a réécrites seules ===');
  // Le document que Sync+ tient se lit sous les noms d'avant : la table des PDF y est `GFS_Fichiers` (js/files/gfs-files.js, `filesNamesOfTables`).
  useFilesNames(filesNamesOfTables(Object.keys(tablesAfter)));
  const targetsNow = now.targetsOf([PP]);
  const names = ['GFS_Filing', 'GFS_Trash', 'GFS_Directories'];
  const virtual = { ...base(), tables: [{ id: 1, tableId: APP_TABLE }, ...names.map((tableId, at) => ({ id: 2 + at, tableId }))],
    columns: [{ parentId: 1, colId: 'Nom' }, { parentId: 1, colId: 'TypeModele' }, { parentId: 1, colId: 'Contenu' }, ...FILING_NOW.map(c => ({ parentId: 2, colId: c.id })), ...TRASH_NOW.map(c => ({ parentId: 3, colId: c.id })),
      ...DIRS_NOW.map(c => ({ parentId: 4, colId: c.id }))], targets: targetsNow, files: {}, fileIds: [] };
  // La table que Sync+ tient existe déjà, avec son auteur d'avant : le plan écrit toutes ses autres colonnes d'aide, sous leurs noms d'avant (c'est le texte attendu).
  if (held) {
    virtual.tables.push({ id: 5, tableId: 'GFS_Fichiers' });
    virtual.columns.push(...filesColumns().map(c => ({ parentId: 5, colId: c.id })), { parentId: 5, colId: 'GFS_Auteur' });
  }
  const fresh = now.planSharing(virtual, filesColumns(), targetsNow);
  check('le plan d\'aujourd\'hui, sur un document sans partage, réussit (c\'est le texte attendu)', fresh.ok === true, fresh.reason);
  const expected = expectedFrom(fresh.actions);
  const formulasAfter = await formulasOf(run);
  const diffs = Object.entries(expected.formulas).filter(([key, formula]) => formulasAfter[key] !== formula);
  if (process.env.DUMP_FORMULAS || staleMode) (await import('node:fs')).writeFileSync(process.env.DUMP_FORMULAS || process.env.LAB_STALE, JSON.stringify({ before: formulasBefore, stale: staleNow, after: formulasAfter, expected: expected.formulas }, null, 1));
  if (diffs.length) say('   formules différentes :', JSON.stringify(diffs.slice(0, 3).map(([key, formula]) => ({ key, attendue: formula.slice(0, 220), réelle: String(formulasAfter[key]).slice(0, 220) }))));
  check(`les ${Object.keys(expected.formulas).length} formules que le plan écrit (colonnes de GFS et colonnes d'aide) sont présentes, À L'OCTET PRÈS, dans le document renommé`, diffs.length === 0, diffs.map(([key]) => key));
  const rulesAfter = await rulesOf(run);
  const missing = expected.rules.filter(rule => !rulesAfter.includes(rule));
  if (missing.length) say('   règles attendues et absentes :', missing.slice(0, 3).join('\n   '));
  check(`les ${expected.rules.length} règles d'accès que le plan écrit sont dans le document renommé, À L'OCTET PRÈS (table, colonnes, formule, droits, note)`, missing.length === 0, missing.slice(0, 2));
  const planAfter = now.planSharing(await existingOf(run, targetsNow), filesColumns(), targetsNow);
  check('le nouveau plan du partage dit « déjà fait » : GFS ne repose, ne complète et ne duplique rien', planAfter.ok === false && planAfter.reason === 'already', planAfter.reason);
  const formulaColumns = Object.keys(formulasBefore).filter(key => !key.startsWith('GFS_'));
  const afterName = (name, kept) => (kept ? name : HELPER_AFTER[name] || name);
  check('aucune formule n\'est devenue une erreur (« Invalid ») : les colonnes d\'aide de la table de l\'app et de celle des PDF donnent des valeurs',
    HELPERS_SEEN.every(name => dataAfter[APP_TABLE].every(row => !String(JSON.stringify(row[afterName(name, false)])).includes('Invalid')) &&
      dataAfter[filesTable].every(row => !String(JSON.stringify(row[afterName(name, held)])).includes('Invalid'))), dataAfter[APP_TABLE].map(row => row.GFS_Readers));
  const helperAfter = { app: Object.fromEntries(HELPERS_SEEN.map(name => [name, dataAfter[APP_TABLE].map(row => JSON.stringify(row[afterName(name, false)]))])),
    pdf: Object.fromEntries(HELPERS_SEEN.map(name => [name, dataAfter[filesTable].map(row => JSON.stringify(row[afterName(name, held)]))])) };
  check('les colonnes d\'aide donnent les MÊMES valeurs qu\'avant (qui lit, qui écrit, qui administre, le dossier)', JSON.stringify(helperAfter) === JSON.stringify(helperBefore), { before: helperBefore.app.GFS_Lecteurs, after: helperAfter.app.GFS_Lecteurs });
  say('   formules d\'avant hors GFS_ :', formulaColumns.length);

  say('\n=== Rouvert : plus rien à proposer, les pages sous celle de GFS ===');
  await reopen(run, READY);
  await run.page.waitForTimeout(2500);
  check('GFS s\'ouvre sans fenêtre de mise à jour', !(await frame().evaluate(WINDOW)));
  const pages = await frame().evaluate(async () => {
    const [tables, list, views] = await Promise.all(['_grist_Tables', '_grist_Pages', '_grist_Views'].map(name => grist.docApi.fetchTable(name)));
    return list.id.map((id, i) => ({ pos: list.pagePos[i], level: list.indentation[i], name: views.name[views.id.indexOf(list.viewRef[i])], table: tables.tableId[tables.primaryViewId.indexOf(list.viewRef[i])] || null }))
      .sort((a, b) => a.pos - b.pos);
  });
  say('   pages :', pages.map(item => `${'  '.repeat(item.level)}${item.table || item.name}`).join(' | '));
  const own = pages.filter(item => /^GFS_/.test(item.table || ''));
  const shownNames = await frame().evaluate(() => [...document.querySelectorAll('.ls-row:not(.folder) .nm .t')].map(node => node.textContent));
  check(`le PDF de la table des PDF se lit dans l'explorateur (${held ? 'GFS_Fichiers, noms d\'avant' : 'GFS_Files, noms anglais'})`, shownNames.includes('Facture.pdf'), shownNames);
  check('les pages des tables de GFS sont sous celle de GFS et portent les noms anglais (le titre d\'une page ne suit pas le renommage de sa table : GFS le reprend)', own.length > 0 && own.every(item => item.level === 1) && own.every(item => item.name === item.table), own.map(item => [item.table, item.name, item.level]));
  const unexpected = run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
  check('aucune erreur ni avertissement de GFS dans la console', unexpected.length === 0, unexpected);
  useFilesNames(FILES_NAMES.en);
  }
} finally {
  await browser.close();
  pagesServer.close();
}
