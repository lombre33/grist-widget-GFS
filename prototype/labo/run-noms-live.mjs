// La version PUBLIÉE de Publipostage+ (grist-factory/Publipostage-Plus, 1.1.2, noms français) devant un document que la version de développement a déjà renommé en anglais : que voit la personne,
// et que devient le document ? (rapport des noms en anglais, cas 5 ; question de la consigne 102, point 4.a). Dans un VRAI Grist (grist-static, 700 × 400), l'app seule (sans GFS), comme chez les gens.
//   Le dossier servi comme `prototype/apps/publipostage` est la copie de la version publiée (le labo lit `REPO_DIR`) ; le lot de renommage est celui que calcule `schema-columns.js` de la version
//   de développement (`PP_DIR`, le sous-module à sa pointe) :
//   REPO_DIR=<arbre> node lab-server.mjs &   puis   PP_DIR=<dev> REPO_DIR=<arbre> node run-noms-live.mjs        (CHOICE=create|refuse : la réponse à la fenêtre « Créer les tables ? » ; FRESH=1 : un navigateur qui n'a pas gardé le premier oui ; LAB_LANG=fr|en)
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';
import { appRegistry, frameSend, frameTables, frameRows } from './lab-noms.mjs';

const lang = process.env.LAB_LANG || 'fr';
const choice = process.env.CHOICE || 'create';
const WIDGET = 'http://127.0.0.1:8911/prototype/apps/publipostage/index.html';
const create = lang === 'fr' ? /Créer les tables/ : /Create the tables/;
const refuse = lang === 'fr' ? /Ne pas créer/ : /Don.t create/;
const lab = await startLab({ widget: WIDGET, lang, colorScheme: 'light' });
const { page } = lab;
const widgetFrame = () => page.frames().find(frame => frame.url().startsWith(WIDGET) && !frame.isDetached());
const answer = async (pattern) => {
  const button = widgetFrame().getByRole('button', { name: pattern });
  await button.first().waitFor({ state: 'visible', timeout: 20000 });
  await button.first().click();
  await page.waitForTimeout(6000);
};
const app = widgetFrame();
check('la version servie est la 1.1.2 publiée', await app.evaluate(() => typeof PP_VERSION !== 'undefined' && PP_VERSION), 'PP_VERSION');
say('version :', await app.evaluate(() => PP_VERSION));

// ----- 1. Le premier lancement de la version publiée : elle propose de créer ses tables, sous leurs noms français.
await answer(create);
const own = list => list.filter(name => /^Publipostage_/.test(name));
const first = own(await frameTables(widgetFrame()));
say('tables du widget après le premier lancement :', JSON.stringify(first));
check('la version publiée crée ses tables sous les noms FRANÇAIS (`Publipostage_Modeles`)', first.includes('Publipostage_Modeles') && !first.includes('Publipostage_Templates'), first);

// ----- 2. Quelques modèles, comme chez une personne qui s'en sert.
const columns = await widgetFrame().evaluate(async () => { const c = await grist.docApi.fetchTable('_grist_Tables_column'); const t = await grist.docApi.fetchTable('_grist_Tables');
  const ref = t.id[t.tableId.indexOf('Publipostage_Modeles')]; return c.colId.filter((id, i) => c.parentId[i] === ref); });
say('colonnes de la table des modèles :', JSON.stringify(columns));
const seeded = await frameSend(widgetFrame(), [['BulkAddRecord', 'Publipostage_Modeles', [null, null, null], {
  Nom: ['Facture', 'Devis', 'Contrat'], Contenu: ['<p>a</p>', '<p>b</p>', '<p>c</p>'], TypeModele: ['document', 'document', 'grille'] }]]);
check('trois modèles posés dans la table d\'avant', seeded.ok, seeded);

// ----- 3. La version de développement renomme le document (le lot que calcule son `planRenames`, comme elle l'envoie hors de GFS).
const registry = appRegistry();
const meta = await widgetFrame().evaluate(async () => {
  const t = await grist.docApi.fetchTable('_grist_Tables'); const c = await grist.docApi.fetchTable('_grist_Tables_column');
  return { t: { id: t.id, tableId: t.tableId }, c: { parentId: c.parentId, colId: c.colId, label: c.label } }; });
const byRef = new Map(meta.t.id.map((id, i) => [id, meta.t.tableId[i]]));
const labels = new Map();
meta.c.colId.forEach((colId, i) => { const table = byRef.get(meta.c.parentId[i]); if (!table) return; if (!labels.has(table)) labels.set(table, new Map()); labels.get(table).set(colId, meta.c.label[i]); });
const batch = registry.planRenames(new Set(meta.t.tableId), id => labels.get(id) || null);
const actions = batch && batch.actions ? batch.actions : batch;
say('lot de la version de développement :', actions.length, 'actions, dont', actions.filter(a => a[0] === 'RenameTable').length, 'tables');
const renamed = await frameSend(widgetFrame(), actions);
check('le document est renommé en anglais par la version de développement', renamed.ok, renamed);
const afterRename = own(await frameTables(widgetFrame()));
say('tables après le renommage :', JSON.stringify(afterRename));
check('plus aucune table française, les anglaises portent les trois modèles', !afterRename.includes('Publipostage_Modeles') && (await frameRows(widgetFrame(), 'Publipostage_Templates')).length === 3, afterRename);

// ----- 4. Une personne ouvre le document avec la version PUBLIÉE (l'adresse qu'elle a toujours utilisée) : la page du widget est rechargée.
// FRESH=1 : une personne dont le navigateur n'a pas gardé le oui du premier lancement (un autre poste, un autre profil, un stockage vidé).
if (process.env.FRESH) await widgetFrame().evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) { /* stockage indisponible */ } });
await widgetFrame().evaluate(() => location.reload());
await page.waitForTimeout(6000);
const dialog = await widgetFrame().getByRole('button', { name: choice === 'create' ? create : refuse }).count();
say(dialog > 0 ? 'FAIT   la version publiée ne retrouve pas `Publipostage_Modeles` : elle repose la question « Créer les tables du widget dans ce document ? »' : 'FAIT   aucune fenêtre : la version publiée ne repose pas la question');
await page.screenshot({ path: `${process.env.SHOTS || '/tmp'}/noms-live-1.1.2-${choice}-${lang}-1.png` });
if (dialog) await answer(choice === 'create' ? create : refuse);
const after = own(await frameTables(widgetFrame()));
say('tables après l\'ouverture :', JSON.stringify(after));
const picker = await widgetFrame().evaluate(() => [...document.querySelectorAll('select option')].map(o => o.textContent.trim()).slice(0, 12));
say('ce que la liste des modèles de la version publiée montre :', JSON.stringify(picker));
await page.screenshot({ path: `${process.env.SHOTS || '/tmp'}/noms-live-1.1.2-${choice}-${lang}-2.png` });
const legacyRows = after.includes('Publipostage_Modeles') ? (await frameRows(widgetFrame(), 'Publipostage_Modeles')).length : null;
const englishRows = (await frameRows(widgetFrame(), 'Publipostage_Templates')).length;
if (choice === 'create') {
  say('FAIT   la version publiée recrée `Publipostage_Modeles` à côté de l\'anglaise : lignes dans la française', legacyRows, ', dans l\'anglaise', englishRows);
  check('aucune ligne perdue : les trois modèles sont toujours dans la table anglaise', englishRows === 3, englishRows);
} else {
  say('FAIT   « Ne pas créer » : tables après', after, '; lignes dans l\'anglaise', englishRows);
}
process.exit(0);
