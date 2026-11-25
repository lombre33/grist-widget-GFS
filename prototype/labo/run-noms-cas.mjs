// Les cas du renommage en anglais de Publipostage+ face à GFS, dans un VRAI serveur Grist (`bash vrai-serveur.sh`), avec la vraie app à son sommet de `main` (copie du sous-module) et la vraie GFS.
// Un cas = un document neuf ; chaque ligne dit OK, ÉCHEC (une attente que le code ne tient pas) ou CONSTAT (un fait que l'essai mesure sans le juger : ce que la personne verrait).
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" CAS=doublons node run-noms-cas.mjs        (CAS = doublons, atomique, direct, partage ; LAB_LANG=fr|en)
//   doublons   un document qui porte les DEUX jeux de noms (une copie plus ancienne de l'app recrée ses tables vides sous les anciens noms) : qui lit quoi, GFS ou l'app ?
//   atomique   le lot de renommage de l'app (celui que calcule SON `planRenames`) : tout ou rien, et deux renommages en même temps.
//   direct     la VRAIE app ouverte seule dans le document (hors de GFS) : elle renomme, et GFS suit.
//   partage    « Partager » activé sur les modèles, puis le lot de renommage de l'app : les règles d'accès, la formule des partages et les colonnes d'aide suivent-elles ?
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { serve } from './lab-server.mjs';
import { chromium, say, check, constat } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { seedFiles } from './seed.mjs';
import { addCustomWidget } from './lab-setup.mjs';
import { PAGE_PORT, openGfs, openRowMenu, rowOf, goTo } from './lab-pdf.mjs';
import { call, apply, rowsOf } from './lab-rest.mjs';
import { gfsFrame } from './lab-droits.mjs';

const lang = process.env.LAB_LANG || 'fr';
const { t } = createI18n(lang);
const wanted = (process.env.CAS || 'doublons,atomique').split(',');
const ME = 'essai@example.com';
const MODELS = 'Publipostage_Templates';
const OLD_MODELS = 'Publipostage_Modeles';
const PREFS = 'Publipostage_TemplatePreferences';
const OLD_PREFS = 'Publipostage_PreferencesModeles';
const REPO = process.env.REPO_DIR;

// Le traducteur de l'app, chargé tel qu'elle l'écrit : son `planRenames` donne le lot que l'app enverrait à Grist (les deux interrupteurs allumés, comme dans le widget servi).
function appRegistry() {
  const source = readFileSync(join(REPO, 'prototype/apps/publipostage/js/schema-columns.js'), 'utf8');
  const sandbox = { grist: { docApi: {} }, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(`${source}\n;globalThis.__SC = SchemaColumns;`, sandbox);
  return sandbox.__SC;
}

const sorted = list => [...list].sort();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fileNames = frame => frame.locator('.ls-row:not(.folder) .t').allInnerTexts();
const reload = async run => {
  await run.page.reload();
  run.frame = await gfsFrame(run.page);
  await run.page.waitForTimeout(1500);
};
const goHome = frame => frame.evaluate(label => { const rows = [...document.querySelectorAll('.tr-row')]; const home = rows.find(row => new RegExp(`^\\s*${label}\\s*\\d*\\s*$`).test(row.textContent)); if (home) home.click(); }, t('ex.me'));

// Ce que l'app lit du document pour calculer son lot : les noms des tables et le libellé de chaque colonne (les métadonnées de Grist, comme son `readSchema`).
async function appBatch(run, registry) {
  const tables = await rowsOf(run, '_grist_Tables');
  const columns = await rowsOf(run, '_grist_Tables_column');
  const names = new Set(tables.map(row => row.tableId));
  const byRef = new Map(tables.map(row => [row.id, row.tableId]));
  const labels = new Map();
  for (const column of columns) {
    const table = byRef.get(column.parentId);
    if (!table) continue;
    if (!labels.has(table)) labels.set(table, new Map());
    labels.get(table).set(column.colId, column.label);
  }
  return registry.planRenames(names, id => labels.get(id) || null);
}

// Les tables de l'app d'avant, plus complètes que celles de `seedFiles` : commentaires, versions et abréviations avec quelques lignes, comme un document qui a servi.
async function seedLegacy(run) {
  await seedFiles(run.frame);
  const have = await run.rest.tables();
  const add = [];
  if (!have.includes('Publipostage_Commentaires')) add.push(['AddTable', 'Publipostage_Commentaires', ['ModeleId:Int', 'Auteur', 'Texte', 'CreeLe', 'LectureId', 'Debut:Int', 'Fin:Int', 'Citation', 'Avant', 'Apres', 'Resolu:Bool']
    .map(spec => { const [id, type] = spec.split(':'); return { id, type: type || 'Text' }; })]);
  if (!have.includes('Publipostage_Versions')) add.push(['AddTable', 'Publipostage_Versions', ['Jeton', 'Auteur', 'Nom', 'Genre', 'Donnees'].map(id => ({ id, type: 'Text' }))]);
  if (!have.includes('Publipostage_Abreviations')) add.push(['AddTable', 'Publipostage_Abreviations', ['Utilisateur', 'Abreviation', 'Texte'].map(id => ({ id, type: 'Text' }))]);
  if (add.length) await apply(run, add);
  const models = await rowsOf(run, OLD_MODELS);
  await apply(run, [['AddColumn', OLD_MODELS, 'Jeton', { type: 'Text' }]]);
  const ids = models.map(row => row.id);
  await apply(run, [['BulkUpdateRecord', OLD_MODELS, ids, { Jeton: ids.map(id => `j${id}`) }]]);
  await apply(run, [
    ['BulkAddRecord', 'Publipostage_Commentaires', [null, null], { ModeleId: [ids[0], ids[0]], Auteur: ['a@exemple.org', 'b@exemple.org'], Texte: ['Premier', 'Second'], CreeLe: ['2026-11-01', '2026-11-02'] }],
    ['BulkAddRecord', 'Publipostage_Versions', [null], { Jeton: [`j${ids[0]}`], Auteur: ['a@exemple.org'], Nom: ['v1'], Genre: ['manuel'], Donnees: ['{}'] }],
    ['BulkAddRecord', 'Publipostage_Abreviations', [null], { Utilisateur: [ME], Abreviation: ['bj'], Texte: ['Bonjour'] }],
  ]);
  const prefs = (await rowsOf(run, OLD_PREFS)).filter(row => row.Utilisateur === '').map(row => row.id);
  await apply(run, [['BulkUpdateRecord', OLD_PREFS, prefs, { Utilisateur: prefs.map(() => ME) }]]);
}


// La vraie app, ajoutée seule (hors de GFS) comme second widget de la page, avec l'accès complet : c'est ce qu'une personne fait quand elle ouvre l'app sans GFS.
async function addDirectApp(run) {
  const address = `http://127.0.0.1:${PAGE_PORT}/prototype/apps/publipostage/index.html`;
  await addCustomWidget(run.page, address);
  await run.page.waitForTimeout(3000);
  await run.page.locator('.test-right-panel').getByText('No document access', { exact: true }).first().click();
  await run.page.waitForTimeout(400);
  await run.page.getByText('Full document access', { exact: true }).last().click();
  const frame = () => run.page.frames().find(each => each.url().startsWith(address) && /access=full/.test(each.url()) && !each.isDetached());
  for (let i = 0; i < 60 && !frame(); i++) await run.page.waitForTimeout(500);
  return frame;
}
const waitUntil = async (page, test, ms = 30000) => { for (let t0 = Date.now(); Date.now() - t0 < ms;) { if (await test().catch(() => false)) return true; await page.waitForTimeout(500); } return false; };
const registryTables = names => names.filter(name => /^Publipostage_/.test(name)).sort();

const snapshot = async (run, tables) => Object.fromEntries(await Promise.all(tables.map(async name => [name, await rowsOf(run, name)])));

// ----- Cas « doublons » : les deux jeux de noms dans le même document.
async function playDoubles(run) {
  say('--- doublons : le document aux noms d\'avant, puis renommé par l\'app, puis recréé vide par une copie plus ancienne ---');
  const registry = appRegistry();
  await seedLegacy(run);
  await reload(run);
  await goHome(run.frame);
  const before = sorted(await fileNames(run.frame));
  check('témoin : GFS liste les modèles du document aux noms d\'avant', before.length >= 3, before);
  const batch = await appBatch(run, registry);
  say('   le lot de l\'app :', batch.actions.length, 'actions, tables', batch.tables, ', colonnes', batch.columns, ', libellés', batch.labels, ', écartées', JSON.stringify(batch.skipped));
  const before1 = await snapshot(run, [OLD_MODELS, OLD_PREFS, 'Publipostage_Commentaires', 'Publipostage_Versions', 'Publipostage_Abreviations']);
  const answer = await apply(run, batch.actions);
  check('Grist applique le lot de l\'app en une fois', answer.status === 200, answer.text);
  const afterTables = await run.rest.tables();
  check('toutes les tables de l\'app sont aux noms anglais, aucune aux noms d\'avant', [MODELS, PREFS, 'Publipostage_Comments', 'Publipostage_Versions', 'Publipostage_Abbreviations'].every(name => afterTables.includes(name)) &&
    !afterTables.some(name => ['Publipostage_Modeles', 'Publipostage_PreferencesModeles', 'Publipostage_Commentaires', 'Publipostage_Abreviations'].includes(name)), afterTables);
  const after1 = await snapshot(run, [MODELS, PREFS, 'Publipostage_Comments', 'Publipostage_Versions', 'Publipostage_Abbreviations']);
  const count = obj => Object.fromEntries(Object.entries(obj).map(([name, rows]) => [name, rows.length]));
  check('aucune ligne perdue ni ajoutée', same(Object.values(count(before1)), Object.values(count(after1))), [count(before1), count(after1)]);
  const modelsBefore = before1[OLD_MODELS];
  const modelsAfter = after1[MODELS];
  check('mêmes numéros de ligne, mêmes noms, mêmes contenus (Nom→Name, Contenu→Content, Jeton→Token)', modelsBefore.every((row, i) => modelsAfter[i].id === row.id && modelsAfter[i].Name === row.Nom &&
    modelsAfter[i].Content === row.Contenu && modelsAfter[i].Token === row.Jeton), modelsAfter.slice(0, 2));
  await reload(run);
  await goHome(run.frame);
  check('GFS montre les mêmes modèles après le renommage', same(sorted(await fileNames(run.frame)), before), sorted(await fileNames(run.frame)));

  say('--- une copie plus ancienne de l\'app (ou son hôte) recrée ses tables vides sous les noms d\'avant ---');
  await apply(run, [
    ['AddTable', OLD_MODELS, [{ id: 'Nom', type: 'Text' }, { id: 'Contenu', type: 'Text' }, { id: 'NomFichierPDF', type: 'Text' }, { id: 'DateModif', type: 'DateTime' }, { id: 'TypeModele', type: 'Text' },
      { id: 'ModifiePar', type: 'Text' }, { id: 'EstParDefaut', type: 'Bool' }]],
    ['AddTable', OLD_PREFS, [{ id: 'Utilisateur', type: 'Text' }, { id: 'ModeleId', type: 'Int' }, { id: 'Epingle', type: 'Bool' }, { id: 'Dossier', type: 'Text' }, { id: 'Replie', type: 'Bool' }]],
  ]);
  const both = await run.rest.tables();
  check('le document porte maintenant les deux jeux de noms', both.includes(MODELS) && both.includes(OLD_MODELS) && both.includes(PREFS) && both.includes(OLD_PREFS), both.filter(name => /^Publipostage_/.test(name)));
  await reload(run);
  await goHome(run.frame);
  const empty = sorted(await fileNames(run.frame));
  const shows = await run.frame.locator('.ls-row .t').allInnerTexts();
  say('   GFS affiche :', JSON.stringify(shows));
  constat('table anglaise (18 modèles) + table d\'avant vide : GFS montre les modèles de la table qui a des lignes (la règle promise à l\'app, consigne 096)', same(empty, before), { montre: empty.length, attendu: before.length });
  await apply(run, [['BulkAddRecord', OLD_MODELS, [null, null], { Nom: ['Écrit par l\'ancienne copie 1', 'Écrit par l\'ancienne copie 2'], TypeModele: ['document', 'document'], DateModif: [Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000)],
    Contenu: ['<p>a</p>', '<p>b</p>'], ModifiePar: ['', ''], EstParDefaut: [false, false], NomFichierPDF: ['', ''] }]]);
  await reload(run);
  await goHome(run.frame);
  const mixed = sorted(await fileNames(run.frame));
  say('   GFS affiche :', JSON.stringify(mixed));
  constat('les deux tables ont des lignes : GFS montre les modèles de la table anglaise, celle que l\'app lit (règle promise : l\'anglaise)', mixed.includes('Contrat de prestation') && !mixed.some(name => /ancienne copie/.test(name)), mixed);
  const written = await rowsOf(run, OLD_MODELS);
  check('témoin : la table d\'avant porte bien les deux modèles de l\'ancienne copie, la table anglaise garde les siens', written.length === 2 && (await rowsOf(run, MODELS)).length === modelsAfter.length, [written.length]);
  // Un geste de GFS sur ce document : où s'écrit-il ?
  const target = mixed[0];
  if (target) {
    await rowOf(run.frame, target).click();
    await run.page.keyboard.press('F2');
    await run.frame.locator('[data-fk="name-input"]').fill(`${target} renommé par GFS`);
    await run.page.keyboard.press('Enter');
    await run.page.waitForTimeout(2500);
    const inOld = (await rowsOf(run, OLD_MODELS)).some(row => /renommé par GFS/.test(row.Nom || ''));
    const inNew = (await rowsOf(run, MODELS)).some(row => /renommé par GFS/.test(row.Name || ''));
    say('   F2 de GFS :', JSON.stringify({ tableAnglaise: inNew, tableDAvant: inOld }));
    constat('F2 dans GFS s\'écrit dans la table que l\'app lit (l\'anglaise)', inNew && !inOld, { inNew, inOld });
  }
}

// ----- Cas « atomique » : tout ou rien, et deux renommages en même temps.
async function playAtomic(run) {
  say('--- atomique : un lot qui échoue ne renomme rien ; deux lots en même temps ---');
  const registry = appRegistry();
  await seedLegacy(run);
  const plan = await appBatch(run, registry);
  const failing = [...plan.actions, ['RenameTable', 'Table_qui_n_existe_pas', 'Autre']];
  const bad = await apply(run, failing);
  const tables = await run.rest.tables();
  check('un lot dont la dernière action échoue est refusé en entier : aucune table renommée', bad.status !== 200 && tables.includes(OLD_MODELS) && !tables.includes(MODELS), { statut: bad.status, tables: tables.filter(name => /^Publipostage_/.test(name)) });
  const snapshotBefore = await snapshot(run, [OLD_MODELS, OLD_PREFS]);
  const outcomes = await run.page.evaluate(async ([docId, actions]) => Promise.all([0, 1].map(async () => {
    const response = await fetch(`/api/docs/${docId}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(actions) });
    return { status: response.status, text: (await response.text()).slice(0, 160) };
  })), [run.docId, plan.actions]);
  say('   deux lots identiques en même temps :', JSON.stringify(outcomes));
  const wins = outcomes.filter(outcome => outcome.status === 200).length;
  check('un seul des deux lots passe, l\'autre est refusé', wins === 1, outcomes);
  const final = await run.rest.tables();
  check('le document est complètement renommé, une seule fois (pas de table « 2 »)', final.includes(MODELS) && final.includes(PREFS) && !final.some(name => /Publipostage_.*\d$/.test(name)), final.filter(name => /^Publipostage_/.test(name)));
  const rowsAfter = await snapshot(run, [MODELS, PREFS]);
  check('aucune ligne perdue', rowsAfter[MODELS].length === snapshotBefore[OLD_MODELS].length && rowsAfter[PREFS].length === snapshotBefore[OLD_PREFS].length, [rowsAfter[MODELS].length, snapshotBefore[OLD_MODELS].length]);
  // Ce que l'app d'avant (qui ne connaît que le français) ferait ensuite : sa table n'existe plus.
  const old = await call(run.page, 'GET', `/api/docs/${run.docId}/tables/${OLD_MODELS}/records`);
  check('une copie d\'avant qui lit « Publipostage_Modeles » n\'a plus de table : Grist répond 404', old.status === 404, old.status);
}


// ----- Cas « direct » : la vraie app ouverte seule renomme le document ; GFS suit.
async function playDirect(run) {
  say('--- direct : la vraie app ouverte seule dans un document aux noms d\'avant ---');
  await seedLegacy(run);
  await reload(run);
  await goHome(run.frame);
  const names = sorted(await fileNames(run.frame));
  const folders = await run.frame.locator('.ls-row.folder .t').allInnerTexts();
  check('témoin : GFS liste les modèles du document aux noms d\'avant', names.length >= 3, [names.length, folders]);
  const before = await snapshot(run, [OLD_MODELS, OLD_PREFS, 'Publipostage_Commentaires', 'Publipostage_Versions', 'Publipostage_Abreviations']);
  const ppFrame = await addDirectApp(run);
  const migrated = await waitUntil(run.page, async () => (await run.rest.tables()).includes(MODELS), 40000);
  check('la vraie app, ouverte seule, renomme le document (hors de GFS)', migrated, registryTables(await run.rest.tables()));
  await run.page.waitForTimeout(4000);
  const tables = await run.rest.tables();
  check('toutes ses tables sont aux noms anglais, aucune aux noms d\'avant', !tables.some(name => ['Publipostage_Modeles', 'Publipostage_PreferencesModeles', 'Publipostage_Commentaires', 'Publipostage_Abreviations'].includes(name)), registryTables(tables));
  const after = await snapshot(run, [MODELS, PREFS, 'Publipostage_Comments', 'Publipostage_Versions', 'Publipostage_Abbreviations']);
  check('aucune ligne perdue : mêmes effectifs avant et après', same([before[OLD_MODELS].length, before[OLD_PREFS].length, before.Publipostage_Commentaires.length, before.Publipostage_Versions.length, before.Publipostage_Abreviations.length],
    [after[MODELS].length, after[PREFS].length, after.Publipostage_Comments.length, after.Publipostage_Versions.length, after.Publipostage_Abbreviations.length]));
  check('mêmes numéros de ligne, mêmes noms et mêmes contenus', before[OLD_MODELS].every((row, i) => after[MODELS][i].id === row.id && after[MODELS][i].Name === row.Nom && after[MODELS][i].Content === row.Contenu));
  const columns = await run.rest.columns(MODELS);
  const labels = await call(run.page, 'GET', `/api/docs/${run.docId}/tables/${MODELS}/columns`);
  const named = (labels.json.columns || []).filter(column => ['Name', 'Content', 'Token'].includes(column.id));
  check('les libellés suivent les identifiants (Grist ne les renomme pas : l\'app le fait)', named.length === 3 && named.every(column => column.fields.label === column.id), named.map(column => [column.id, column.fields.label]));
  say('   tables de l\'app après :', JSON.stringify(registryTables(tables)));
  say('   colonnes de la table des modèles :', JSON.stringify(columns.map(column => column.id)));
  await reload(run);
  await goHome(run.frame);
  await run.frame.locator('.ls-row').first().waitFor({ timeout: 20000 }).catch(() => {});
  await run.page.screenshot({ path: join(process.env.SCRATCH || '/tmp', 'direct-gfs-apres.png') });
  check('GFS rechargé montre les mêmes modèles, les mêmes dossiers', same(sorted(await fileNames(run.frame)), names) && same(await run.frame.locator('.ls-row.folder .t').allInnerTexts(), folders), sorted(await fileNames(run.frame)));
  const pagesAfter = (await rowsOf(run, '_grist_Views')).map(row => row.name).filter(name => /^Publipostage_/.test(name || ''));
  constat('les pages de Grist (volet de gauche) portent les noms des tables après le renommage', pagesAfter.every(name => !/Modeles|PreferencesModeles|Commentaires|Abreviations/.test(name)), pagesAfter);
  check('GFS_Rangement ne garde rien de l\'app (le rangement de l\'app fait foi)', (await rowsOf(run, 'GFS_Rangement') || []).filter(row => row.App === 'publipostage').length === 0);
  if (!ppFrame()) say('   (le cadre de l\'app a été rechargé)');
}

// ----- Cas « partage » : « Partager » activé sur les modèles, puis le renommage de l'app.
async function openShareFor(frame, name) {
  await openRowMenu(frame, name);
  await frame.getByRole('menuitem', { name: new RegExp(`^${t('share.menu')}`) }).click();
  await frame.locator('.mod.sh .rt-content').waitFor();
}
async function waitReload(page, old) {
  for (let i = 0; i < 240 && !old.isDetached(); i++) await page.waitForTimeout(250);
  return gfsFrame(page, { keep: true });
}
const aclOf = async run => {
  const resources = await rowsOf(run, '_grist_ACLResources');
  const rules = await rowsOf(run, '_grist_ACLRules');
  const byId = new Map(resources.map(row => [row.id, `${row.tableId}:${row.colIds}`]));
  return rules.map(rule => ({ ressource: byId.get(rule.resource) || rule.resource, formule: rule.aclFormula, droits: rule.permissionsText, lecture: rule.memo || '' })).filter(rule => rule.ressource !== undefined);
};
async function playShare(run) {
  say('--- partage : « Partager » actif sur les modèles, puis le lot de renommage de l\'app ---');
  const registry = appRegistry();
  await seedLegacy(run);
  await reload(run);
  let frame = run.frame;
  await frame.locator('.ls-row').first().waitFor();
  await openShareFor(frame, 'Contrat de prestation');
  await frame.locator('[data-fk="share-activate"]').click();
  await frame.locator('.mod.ask').waitFor();
  await Promise.all([waitReload(run.page, frame).then(next => { frame = next; }), frame.locator('[data-fk="ask-yes"]').click()]);
  await frame.locator('.mod.sh .rt-content').waitFor({ timeout: 40000 });
  await frame.locator('[data-fk="share-close"]').click();
  run.frame = frame;
  const columnsBefore = (await run.rest.columns(OLD_MODELS)).map(column => column.id);
  check('« Partager » est actif : la table de l\'app porte les colonnes d\'aide de GFS', ['GFS_Auteur', 'GFS_Lecteurs', 'GFS_Ecrivains', 'GFS_Admins'].every(id => columnsBefore.includes(id)), columnsBefore);
  const aclBefore = await aclOf(run);
  const sharesColumns = await call(run.page, 'GET', `/api/docs/${run.docId}/tables/GFS_Partages/columns`);
  const formulaBefore = JSON.stringify((sharesColumns.json.columns || []).map(column => column.fields.formula || '')).includes(OLD_MODELS);
  say('   règles d\'accès avant :', aclBefore.length, ', ressources :', JSON.stringify([...new Set(aclBefore.map(rule => rule.ressource))]));
  check('avant : les règles et la formule des partages nomment la table de l\'app d\'avant', aclBefore.some(rule => String(rule.ressource).startsWith(OLD_MODELS)) && formulaBefore, [aclBefore.length, formulaBefore]);
  const sharedBefore = await rowsOf(run, 'GFS_Partages');
  const authorBefore = (await rowsOf(run, OLD_MODELS)).map(row => [row.id, row.GFS_Auteur]);

  const batch = await appBatch(run, registry);
  const answer = await apply(run, batch.actions);
  check('le propriétaire envoie le lot de renommage de l\'app : Grist l\'accepte', answer.status === 200, answer.text);
  const tables = await run.rest.tables();
  const aclAfter = await aclOf(run);
  say('   ressources après :', JSON.stringify([...new Set(aclAfter.map(rule => rule.ressource))]));
  check('les règles d\'accès suivent la table (Grist met à jour ses ressources) : plus aucune ne nomme « Publipostage_Modeles »', aclAfter.length === aclBefore.length && !aclAfter.some(rule => String(rule.ressource).startsWith(OLD_MODELS)) &&
    aclAfter.some(rule => String(rule.ressource).startsWith(MODELS)), aclAfter.slice(0, 6));
  const formulas = await call(run.page, 'GET', `/api/docs/${run.docId}/tables/GFS_Partages/columns`);
  const formulaText = JSON.stringify((formulas.json.columns || []).map(column => column.fields.formula || ''));
  check('la formule de la table des partages suit le renommage (elle appelle la table renommée)', formulaText.includes(MODELS) && !formulaText.includes(OLD_MODELS), formulaText.slice(0, 300));
  const conditions = JSON.stringify(aclAfter.map(rule => rule.formule));
  constat('les conditions des règles (ex. `rec.TypeModele`) suivent la colonne renommée (`rec.TemplateType`)', !conditions.includes('TypeModele'), conditions.slice(0, 300));
  const helpers = (await run.rest.columns(MODELS)).map(column => column.id);
  check('les colonnes d\'aide de GFS sont toujours sur la table renommée', ['GFS_Auteur', 'GFS_Lecteurs', 'GFS_Ecrivains', 'GFS_Admins'].every(id => helpers.includes(id)), helpers.filter(id => /^GFS_/.test(id)));
  const authorAfter = (await rowsOf(run, MODELS)).map(row => [row.id, row.GFS_Auteur]);
  check('les auteurs des lignes (GFS_Auteur) sont intacts', same(authorBefore, authorAfter), [authorBefore.slice(0, 2), authorAfter.slice(0, 2)]);
  const sharedAfter = await rowsOf(run, 'GFS_Partages');
  check('les partages posés avant sont intacts et valides', sharedAfter.length === sharedBefore.length && same(sharedBefore.map(row => row.Cible), sharedAfter.map(row => row.Cible)) && sharedAfter.every(row => row.Valide !== false), [sharedBefore.length, sharedAfter.length]);
  // Un modèle créé sous les noms anglais par le propriétaire : l'auteur est écrit par Grist, la lecture se calcule.
  const created = await apply(run, [['AddRecord', MODELS, null, { Name: 'Créé après le renommage', TemplateType: 'document', ModifiedAt: Math.floor(Date.now() / 1000) }]]);
  check('une ligne créée sous les noms anglais reçoit son auteur de Grist', created.status === 200 && (await rowsOf(run, MODELS)).some(row => row.Name === 'Créé après le renommage' && row.GFS_Auteur === ME), created.text);
  await reload(run);
  await run.frame.locator('.ls-row').first().waitFor({ timeout: 20000 }).catch(() => {});
  await goHome(run.frame);
  const listed = sorted(await fileNames(run.frame));
  check('GFS liste les modèles du document partagé et renommé, avec celui créé après', listed.includes('Contrat de prestation') && listed.includes('Créé après le renommage'), listed.length);
  await openShareFor(run.frame, 'Contrat de prestation');
  const panel = (await run.frame.locator('.mod.sh').innerText()).replace(/\s+/g, ' ');
  constat('la fenêtre « Partager… » du document renommé reste active (pas de question « activer » ni « compléter »)', (await run.frame.locator('[data-fk="share-activate"]').count()) === 0, panel.slice(0, 200));
  say('   (tables de l\'app :', JSON.stringify(registryTables(tables)), ')');
}

const server = await requireServer();
const pages = createServer(serve(REPO, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const CASES = { doublons: playDoubles, atomique: playAtomic, direct: playDirect, partage: playShare };
try {
  for (const name of wanted) {
    if (!CASES[name]) continue;
    const context = await newContext(browser, server, { colorScheme: 'light' });
    let run = null;
    for (let attempt = 0; attempt < 3 && !run; attempt++) {
      try { run = await openGfs(context, { lang, mirrors: true }); } catch (error) { say('   (GFS ne s\'est pas monté, nouvel essai)', String(error.message).split('\n')[0]); }
    }
    if (!run) { check(`le cas ${name} : GFS s'ouvre dans le vrai Grist`, false); continue; }
    await CASES[name](run);
    await context.close();
  }
} finally {
  await browser.close();
  pages.close();
}
