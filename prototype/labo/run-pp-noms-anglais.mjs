// Publipostage+ renomme ses tables et ses colonnes en anglais (son traducteur, js/schema-columns.js, lots 1 à 4 sur 5 ; l'interrupteur `englishOnDisk` est encore éteint) :
// ce que GFS voit d'un document qui porte DÉJÀ les noms anglais, dans un vrai Grist (grist-static), à 700 × 400. Le manifeste de GFS ne connaît qu'un jeu de noms
// (`Publipostage_Modeles` et ses colonnes, `Publipostage_Versions`, `Publipostage_PreferencesModeles`) : cet essai MESURE ce qui se passe quand un document est renommé.
//   1. Témoin : le document d'essai aux noms d'avant, l'explorateur montre les modèles de Publipostage+.
//   2. Le même document renommé comme le registre de l'app le dit (RenameTable et RenameColumn de Grist, les lignes suivent) : ce que l'explorateur montre.
// Cet essai décrit l'état d'AVANT la prise en compte des noms anglais par GFS : son « OK » dit que la liste est perdue ; il s'inverse le jour où GFS lit les deux jeux de noms.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check } from './lab-common.mjs';
import { explorerTools } from './lab-gestes.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const ANA = { Email: 'ana@exemple.org', Name: 'Ana', IsLoggedIn: true, UserID: 101 };
// [table d'avant, table anglaise, [[colonne d'avant, colonne anglaise]…]] : le registre de l'app à b32f450 (js/schema-columns.js), pour les tables que GFS lit.
const RENAMES = [
  ['Publipostage_Modeles', 'Publipostage_Templates', [['Nom', 'Name'], ['TypeModele', 'TemplateType'], ['DateModif', 'ModifiedAt'], ['ModifiePar', 'ModifiedBy'],
    ['Jeton', 'Token'], ['EstParDefaut', 'IsDefault']]],
  ['Publipostage_Versions', 'Publipostage_Versions', [['Jeton', 'Token']]],
  ['Publipostage_PreferencesModeles', 'Publipostage_TemplatePreferences', [['Utilisateur', 'User'], ['ModeleId', 'TemplateId'], ['Dossier', 'Folder'], ['Epingle', 'Pinned']]],
];

const lab = await startLab({ lang, colorScheme: scheme, user: ANA });
const { page } = lab;
const warnings = [];
page.on('console', m => { if ((m.type() === 'warning' || m.type() === 'error') && m.text().startsWith('GFS')) warnings.push(m.text()); });
page.on('pageerror', error => warnings.push(error.message));
await lab.fitPanel(undefined, 700, 400);
await seedFiles(lab.frame);
let frame = lab.frame;
const reopen = async () => {
  await frame.evaluate(() => location.reload());
  await page.waitForTimeout(1000);
  frame = await lab.gfsFrame(/access=full/);
  await lab.gfsReady(frame);
  await page.waitForTimeout(1000);
  if (await frame.locator('.mod').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
};
await reopen();
const { fileNames } = explorerTools(() => frame, page);
const goHome = () => frame.locator('.tr-row', { hasText: /^\s*Moi|^\s*Me/ }).first().click().then(() => page.waitForTimeout(400));

say('\n1. Témoin : le document aux noms d\'avant');
await goHome();
const before = await fileNames();
check('l\'explorateur montre des fichiers de Publipostage+ (noms d\'avant)', before.length > 0, before.slice(0, 5));
check('« Contrat de prestation » est dans la liste', before.includes('Contrat de prestation'), before.slice(0, 5));

say('\n2. Le même document, renommé en anglais comme le registre de l\'app');
const renamed = await frame.evaluate(async renames => {
  const report = [];
  const have = (await grist.docApi.listTables()).map(table => (typeof table === 'string' ? table : table.id));
  for (const [legacy, english, columns] of renames) {
    if (!have.includes(legacy)) { report.push(`${legacy} : absente du document d'essai`); continue; }
    const cols = Object.keys(await grist.docApi.fetchTable(legacy));
    const actions = columns.filter(([from]) => cols.includes(from)).map(([from, to]) => ['RenameColumn', legacy, from, to]);
    if (legacy !== english) actions.push(['RenameTable', legacy, english]);
    try { await grist.docApi.applyUserActions(actions); report.push(`${legacy} : ${actions.length} actions`); } catch (error) { report.push(`${legacy} : ${error && error.message}`); }
  }
  return report;
}, RENAMES);
console.log('renommage :', JSON.stringify(renamed));
const tables = await frame.evaluate(async () => (await grist.docApi.listTables()).map(table => (typeof table === 'string' ? table : table.id)));
check('le document porte maintenant les noms anglais et plus ceux d\'avant', tables.includes('Publipostage_Templates') && !tables.includes('Publipostage_Modeles'), tables);
await reopen();
await goHome();
const after = await fileNames();
console.log('MESURE  fichiers montrés avant :', before.length, ' après le renommage :', after.length, after.slice(0, 5));
check('MESURE : l\'explorateur de GFS ne montre plus les modèles de Publipostage+ une fois la table renommée', !after.includes('Contrat de prestation'), after.slice(0, 5));
check('la console de GFS est restée muette (aucun avertissement)', warnings.length === 0, warnings);
await lab.browser.close();
