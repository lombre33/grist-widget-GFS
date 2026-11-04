// La lecture des fichiers pour l'explorateur (contrats 2.4) : GFS lit les tables de fichiers que les manifestes déclarent, par sa propre
// connexion à Grist, et n'en garde que les colonnes déclarées. Une table que l'app n'a pas encore créée n'est pas un problème (aucun fichier) ;
// une table présente mais illisible est dite, app par app. Le rangement de GFS (`GFS_Rangement`, 6.4) passe devant celui de chaque app.

import { readFiles, readFiling, readGfsFiling, readGfsFolders, applyFiling } from './explorer-model.js';
import { TABLE } from './rangement.js';
import { BIN_TABLE, recipeOf, binFiles } from './gfs-trash.js';

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
// Rend { files, trash, folders, problems: [{ app, reason }], stats: { ms, tables, rows } } : `files` les fichiers vivants, `trash` ceux qui sont à la corbeille (js/explorer-model.js, `trashed`) : ils
// ne sont jamais mêlés, pour que rien de ce qui lit `files` (choisir, ouvrir, lire) ne voie un fichier supprimé ; `folders` les dossiers que la personne garde sans fichier (6.4, point 11). Un rangement
// de GFS illisible ne cache aucun fichier : ils restent à leur place d'avant.
export async function loadFiles(port, apps, identity = '') {
  const started = performance.now();
  const tables = await existingTables(port);
  const files = [];
  const trash = [];
  const problems = [];
  const stats = { ms: 0, tables: 0, rows: 0 };
  const gfs = await readTable(port, tables, TABLE);
  if (gfs.error) console.warn('GFS : le rangement de GFS est illisible', gfs.error);
  const gfsFiling = gfs.data ? readGfsFiling(gfs.data, identity) : null;
  const folders = gfs.data ? readGfsFolders(gfs.data, identity) : [];
  const bin = await readTable(port, tables, BIN_TABLE);
  if (bin.error) console.warn('GFS : la corbeille des apps est illisible', bin.error);
  for (const { manifest } of apps) {
    for (const spec of manifest.fichiers || []) {
      const main = await readTable(port, tables, spec.table);
      if (main.error) { problems.push({ app: manifest.id, reason: String(main.error.message || main.error) }); continue; }
      const filingTable = spec.rangement ? await readTable(port, tables, spec.rangement.table) : { data: null };
      const filing = filingTable.data ? readFiling(spec.rangement, filingTable.data, identity) : null;
      const found = readFiles(manifest, spec, main.data);
      applyFiling(found, filing, gfsFiling);
      for (const file of found) (file.trashed ? trash : files).push(file);
      // Les fichiers de l'app que la personne a mis à la corbeille ne sont plus dans sa table : ils sont dans `GFS_Corbeille` (js/gfs-trash.js), et gardent leur dossier, que le rangement n'a pas quitté.
      if (recipeOf(spec) && bin.data) {
        const gone = binFiles(spec, bin.data, manifest.id);
        const entries = readFiles(manifest, gone.spec, gone.data, gone.weights);
        applyFiling(entries, filing, gfsFiling);
        trash.push(...entries);
      }
      stats.tables += 1;
      stats.rows += found.length;
    }
  }
  stats.ms = Math.round(performance.now() - started);
  return { files, trash, folders, problems, stats };
}
