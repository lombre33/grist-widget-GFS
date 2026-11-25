// Ce que les essais de la bascule des noms partagent : le traducteur de la vraie Publipostage+ (son `schema-columns.js`, chargé tel qu'elle l'écrit) et le lot de renommage qu'il calcule.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { rowsOf } from './lab-rest.mjs';

const REPO = process.env.REPO_DIR;

// Le traducteur de l'app, chargé tel qu'elle l'écrit : son `planRenames` donne le lot que l'app enverrait à Grist (les deux interrupteurs allumés, comme dans le widget servi).
export function appRegistry() {
  const source = readFileSync(join(process.env.PP_DIR || join(REPO, 'prototype/apps/publipostage'), 'js/schema-columns.js'), 'utf8');
  const sandbox = { grist: { docApi: {} }, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(`${source}\n;globalThis.__SC = SchemaColumns;`, sandbox);
  return sandbox.__SC;
}

// Ce que l'app lit du document pour calculer son lot : les noms des tables et le libellé de chaque colonne (les métadonnées de Grist, comme son `readSchema`).
export async function appBatch(run, registry) {
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


// ----- Ce que l'app envoie et lit, depuis son cadre isolé, par le courtier de GFS (les essais du courtier et de la fenêtre de mise à jour partagent ces gestes).
// Ce que l'app envoie : `try` / `catch` dans son cadre, la réponse du courtier telle quelle.
export const frameSend = (frame, actions) => frame.evaluate(async list => {
  try { await grist.docApi.applyUserActions(list); return { ok: true }; } catch (error) { return { ok: false, error: String((error && error.message) || error).slice(0, 220) }; }
}, actions);
export const frameTables = frame => frame.evaluate(async () => (await grist.docApi.fetchTable('_grist_Tables')).tableId.filter(id => !/^_?grist/i.test(id)).sort());
export const frameRows = (frame, table) => frame.evaluate(async id => {
  const data = await grist.docApi.fetchTable(id);
  return data.id.map((rowId, i) => ({ id: rowId, ...Object.fromEntries(Object.keys(data).filter(key => key !== 'id' && key !== 'manualSort').map(key => [key, data[key][i]])) }));
}, table);

// Un document aux noms d'avant : les tables anglaises que l'app vient de créer sont retirées, celles d'avant posées avec quelques lignes (cinq modèles, deux préférences). `extra` : des
// colonnes de plus sur la table des modèles (`id_sync` pour une table que Sync+ utilise). Rend ce que chaque envoi a répondu et les lignes posées.
export async function legacyDocument(frame, extra = []) {
  const english = ['Publipostage_Templates', 'Publipostage_TemplatePreferences', 'Publipostage_TableLinks'];
  const gone = await frameSend(frame, english.map(name => ['RemoveTable', name]));
  const columns = ['Nom', 'Contenu', 'Jeton', 'TypeModele', 'DateModif', 'ModifiePar', 'NomFichierPDF', ...extra].map(id => ({ id, type: 'Text' }));
  const made = await frameSend(frame, [
    ['AddTable', 'Publipostage_Modeles', columns],
    ['AddTable', 'Publipostage_PreferencesModeles', [{ id: 'Utilisateur', type: 'Text' }, { id: 'ModeleId', type: 'Int' }, { id: 'Epingle', type: 'Bool' }, { id: 'Dossier', type: 'Text' }]],
  ]);
  const added = await frameSend(frame, [
    ['BulkAddRecord', 'Publipostage_Modeles', [null, null, null, null, null], {
      Nom: ['Facture', 'Devis', 'Contrat', 'Lettre', 'Bon'], Contenu: ['<p>a</p>', '<p>b</p>', '<p>c</p>', '<p>d</p>', '<p>e</p>'], Jeton: ['t1', 't2', 't3', 't4', 't5'],
      TypeModele: ['document', 'document', 'grille', 'document', 'presentation'] }],
    ['BulkAddRecord', 'Publipostage_PreferencesModeles', [null, null], { Utilisateur: ['a@x.test', 'b@x.test'], ModeleId: [1, 2], Epingle: [true, false], Dossier: ['', 'Clients'] }],
  ]);
  return { gone, made, added, before: { modeles: await frameRows(frame, 'Publipostage_Modeles'), prefs: await frameRows(frame, 'Publipostage_PreferencesModeles') } };
}

// Le lot que l'app calcule DANS son cadre, d'après ce qu'elle lit du document (les métadonnées de Grist) : son `planRenames`, les deux interrupteurs allumés. À donner à `frame.evaluate`.
export async function planInFrame() {
  const tables = await grist.docApi.fetchTable('_grist_Tables');
  const columns = await grist.docApi.fetchTable('_grist_Tables_column');
  const byRef = new Map(tables.id.map((id, i) => [id, tables.tableId[i]]));
  const labels = new Map();
  columns.id.forEach((id, i) => {
    const table = byRef.get(columns.parentId[i]);
    if (!table) return;
    if (!labels.has(table)) labels.set(table, new Map());
    labels.get(table).set(columns.colId[i], columns.label[i]);
  });
  SchemaColumns.setEnglishOnDisk(true);
  SchemaColumns.setRenameDocuments(true);
  const batch = SchemaColumns.planRenames(new Set(tables.tableId), id => labels.get(id) || null);
  return batch && batch.actions ? batch.actions : batch;
}
