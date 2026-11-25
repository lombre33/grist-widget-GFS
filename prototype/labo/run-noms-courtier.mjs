// Le renommage sur place par une app, vu du courtier (contrats 3.3, point 10 : la capacité `renommage`), dans un VRAI Grist (grist-static, 700 × 400) avec la VRAIE Publipostage+
// (le lot de renommage que calcule SON `SchemaColumns.planRenames`, envoyé depuis son cadre isolé) puis la vraie Automation+, qui ne déclare pas la capacité.
//   REPO_DIR="$(realpath ../..)" node lab-server.mjs &   puis   REPO_DIR="$(realpath ../..)" node run-noms-courtier.mjs        (LAB_LANG=fr|en)
//   1. Un document aux noms d'avant (tables françaises, quelques lignes) : le lot de l'app passe par le courtier, en entier, et le document est aux noms anglais.
//   2. Aucune ligne n'est perdue : mêmes numéros, mêmes contenus ; les libellés suivent les identifiants.
//   3. Ce que le courtier refuse, même avec la capacité : une table de la personne, un nom de GFS ou d'une autre app, un type de colonne changé, un nom manquant.
//   4. Une app qui ne déclare pas la capacité (Automation+) ne renomme ni table ni colonne.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';
import { frameSend, frameTables, frameRows, legacyDocument, planInFrame } from './lab-noms.mjs';

const lang = process.env.LAB_LANG || 'fr';
const lab = await startLab({ lang, colorScheme: process.env.LAB_SCHEME || 'light' });
const { page } = lab;
await lab.fitPanel(undefined, 700, 400);
await lab.frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
const app = await lab.openApp('publipostage');
await page.waitForTimeout(4000);
const consent = app.getByRole('button', { name: /Create the tables|Créer les tables/ });
if (await consent.count()) { await consent.first().click(); await page.waitForTimeout(6000); }

const send = frameSend;
const tablesOf = frameTables;
const rowsOf = frameRows;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ----- Un document aux noms d'avant : les tables anglaises que l'app vient de créer sont retirées, celles d'avant posées avec quelques lignes.
const start = await legacyDocument(app);
check('témoin : l\'app retire ses tables anglaises neuves (le document redevient « d\'avant »)', start.gone.ok, start.gone);
check('témoin : les tables d\'avant se créent', start.made.ok);
check('témoin : cinq modèles et deux préférences', start.added.ok, start.added);
const before = start.before;
say('   tables avant :', JSON.stringify(await tablesOf(app)));

// ----- 1. Le lot de l'app, tel qu'elle le calcule, passe par le courtier.
const plan = await app.evaluate(planInFrame);
const verbs = {};
for (const action of plan || []) verbs[action[0]] = (verbs[action[0]] || 0) + 1;
say('   le lot de l\'app :', JSON.stringify(verbs));
check('l\'app calcule un lot de renommage (tables, colonnes, libellés)', Array.isArray(plan) && verbs.RenameTable >= 2 && verbs.RenameColumn >= 5, verbs);
await lab.forgetActions();
const renamed = await send(app, plan);
check('le courtier laisse passer le lot de l\'app, en entier (Publipostage+ déclare « renommage »)', renamed.ok, renamed);
const received = await lab.actions();
check('le vrai moteur de Grist a reçu le lot (les renommages ont été envoyés)', received.some(line => /^RenameTable /.test(line)), received.slice(0, 3));
const after = await tablesOf(app);
say('   tables après :', JSON.stringify(after));
check('le document est aux noms anglais : plus aucune table d\'avant à côté', after.includes('Publipostage_Templates') && after.includes('Publipostage_TemplatePreferences') && !after.includes('Publipostage_Modeles') && !after.includes('Publipostage_PreferencesModeles'), after);

// ----- 2. Rien de perdu.
const models = await rowsOf(app, 'Publipostage_Templates');
const prefs = await rowsOf(app, 'Publipostage_TemplatePreferences');
check('aucune ligne perdue : mêmes numéros, mêmes contenus (modèles et préférences)', models.length === 5 && prefs.length === 2
  && before.modeles.every((row, i) => models[i].id === row.id && models[i].Name === row.Nom && models[i].Content === row.Contenu && models[i].Token === row.Jeton)
  && before.prefs.every((row, i) => prefs[i].id === row.id && prefs[i].User === row.Utilisateur && prefs[i].TemplateId === row.ModeleId && prefs[i].Pinned === row.Epingle), { models: models.length, prefs: prefs.length });
const labels = await app.evaluate(async () => {
  const columns = await grist.docApi.fetchTable('_grist_Tables_column');
  const tables = await grist.docApi.fetchTable('_grist_Tables');
  const ref = tables.id[tables.tableId.indexOf('Publipostage_Templates')];
  return columns.id.map((id, i) => ({ id: columns.colId[i], label: columns.label[i], table: columns.parentId[i] })).filter(column => column.table === ref && /^(Name|Content|Token)$/.test(column.id));
});
check('les libellés suivent les identifiants (l\'app les change par `ModifyColumn`, que Grist ne fait pas seul)', labels.length === 3 && labels.every(column => column.label === column.id), labels);

// ----- 3. Ce que le courtier refuse, même avec la capacité.
const unchanged = async () => same(await tablesOf(app), after);
const refusals = [
  ['une table de la personne', [['RenameTable', 'Clients', 'Clients2']]],
  ['une colonne d\'une table de la personne', [['RenameColumn', 'Clients', 'Nom', 'Name']]],
  ['un nom de GFS', [['RenameTable', 'Publipostage_Templates', 'GFS_Templates']]],
  ['le nom d\'une autre app', [['RenameTable', 'Publipostage_Templates', 'Automation_Templates']]],
  ['une table interne de Grist', [['RenameColumn', '_grist_Tables_column', 'label', 'Label']]],
  ['un type de colonne changé (ModifyColumn)', [['ModifyColumn', 'Publipostage_Templates', 'Name', { type: 'Int' }]]],
  ['une formule posée par ModifyColumn', [['ModifyColumn', 'Publipostage_Templates', 'Name', { formula: '1', isFormula: true }]]],
  ['un nom de colonne manquant', [['RenameColumn', 'Publipostage_Templates', 'Name']]],
  ['un lot dont une action est refusée (rien ne part)', [['RenameColumn', 'Publipostage_Templates', 'Content', 'Body'], ['RenameTable', 'Clients', 'Clients3']]],
];
for (const [label, actions] of refusals) {
  const result = await send(app, actions);
  say('   ', label, '→', JSON.stringify(result.error || result));
  check(`le courtier refuse : ${label}`, result.ok === false && /GFS|refus|REFUSE|renommage|table|colonne|libell/i.test(result.error || ''), result);
}
check('aucun refus n\'a changé le document (mêmes tables, mêmes colonnes)', await unchanged() && same(await rowsOf(app, 'Publipostage_Templates'), models));

// ----- 4. Une app qui ne déclare pas la capacité ne renomme rien.
const auto = await lab.openApp('automation', /(apps\/automation|GRIST_automation)\//);
await page.waitForTimeout(4000);
const made = await send(auto, [['AddTable', 'Automation_Essai', [{ id: 'Nom', type: 'Text' }]]]);
check('témoin : Automation+ crée une table à elle', made.ok, made);
for (const [label, actions] of [
  ['RenameTable', [['RenameTable', 'Automation_Essai', 'Automation_Test']]],
  ['RenameColumn', [['RenameColumn', 'Automation_Essai', 'Nom', 'Name']]],
  ['ModifyColumn (libellé)', [['ModifyColumn', 'Automation_Essai', 'Nom', { label: 'Name' }]]],
]) {
  const result = await send(auto, actions);
  say('   ', label, '→', JSON.stringify(result.error || result));
  check(`Automation+ ne déclare pas « renommage » : ${label} refusé`, result.ok === false && /renommage/.test(result.error || ''), result);
}
check('la table d\'Automation+ garde son nom', (await auto.evaluate(() => grist.docApi.listTables())).includes('Automation_Essai'));
await lab.browser.close();
