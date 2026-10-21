// La lecture des fichiers pour l'explorateur (contrats 2.4) : GFS lit les tables de fichiers que les manifestes déclarent, par sa propre
// connexion à Grist, et n'en garde que les colonnes déclarées. Une table que l'app n'a pas encore créée n'est pas un problème (aucun fichier) ;
// une table présente mais illisible est dite, app par app. Le rangement de GFS (`GFS_Rangement`, 6.4) passe devant celui de chaque app.

import { readFiles, readFiling, readGfsFiling, applyFiling } from './explorer-model.js';
import { TABLE } from './rangement.js';

const sameName = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

async function existingTables(port) {
  try { return (await port.doc.listTables()).map(String); } catch (error) { return null; }
}

// Lit une table si elle existe ; rend { data } ou { error } (ou { data: null } pour une table absente).
async function readTable(port, tables, tableId) {
  if (tables && !tables.some(name => sameName(name, tableId))) return { data: null };
  const found = (tables && tables.find(name => sameName(name, tableId))) || tableId;
  try { return { data: await port.doc.fetchTable(found) }; } catch (error) { return { error }; }
}

// `apps` : les apps installées dont le manifeste est valide, { manifest }. `identity` : l'adresse de la personne, '' tant que GFS ne la connaît pas.
// Rend { files, problems: [{ app, reason }], stats: { ms, tables, rows } }. Un rangement de GFS illisible ne cache aucun fichier : ils restent à leur place d'avant.
export async function loadFiles(port, apps, identity = '') {
  const started = performance.now();
  const tables = await existingTables(port);
  const files = [];
  const problems = [];
  const stats = { ms: 0, tables: 0, rows: 0 };
  const gfs = await readTable(port, tables, TABLE);
  if (gfs.error) console.warn('GFS : le rangement de GFS est illisible', gfs.error);
  const gfsFiling = gfs.data ? readGfsFiling(gfs.data, identity) : null;
  for (const { manifest } of apps) {
    for (const spec of manifest.fichiers || []) {
      const main = await readTable(port, tables, spec.table);
      if (main.error) { problems.push({ app: manifest.id, reason: String(main.error.message || main.error) }); continue; }
      const filingTable = spec.rangement ? await readTable(port, tables, spec.rangement.table) : { data: null };
      const found = readFiles(manifest, spec, main.data);
      applyFiling(found, filingTable.data ? readFiling(spec.rangement, filingTable.data, identity) : null, gfsFiling);
      files.push(...found);
      stats.tables += 1;
      stats.rows += found.length;
    }
  }
  stats.ms = Math.round(performance.now() - started);
  return { files, problems, stats };
}
