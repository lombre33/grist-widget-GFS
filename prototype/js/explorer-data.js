// La lecture des fichiers pour l'explorateur (contrats 2.4) : GFS lit les tables de fichiers que les manifestes déclarent, par sa propre
// connexion à Grist, et n'en garde que les colonnes déclarées. Une table que l'app n'a pas encore créée n'est pas un problème (aucun fichier) ;
// une table présente mais illisible est dite, app par app. Le rangement de GFS (`GFS_Rangement`, 6.4) passe devant celui de chaque app.

import { readFiles, readFiling, readGfsFiling, readGfsFolders, applyFiling } from './explorer-model.js';
import { TABLE } from './rangement.js';
import { BIN_TABLE, recipeOf, binFiles } from './gfs-trash.js';
import { linkedWeights } from './weight.js';
import { applyPlacement, loadSpaces } from './spaces-filing.js';
import { addressFromShares, applyDirect } from './direct-shares.js';
import { SHARES_TABLE } from './sharing-model.js';
import { rowsOf } from './rights.js';
import { loadReceived } from './received-files.js';
import { neededColumns } from './explorer-sql.js';

const sameName = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

// Les colonnes de la corbeille que l'explorateur montre (js/gfs-trash.js, `binFiles`) : l'identifiant de l'entrée et la copie JSON de la ligne (`Instantane`)
// n'y sont pas, mais pèsent dans le poids.
const BIN_LIGHT = ['App', 'Table', 'FichierId', 'Nom', 'Type', 'Date', 'Auteur', 'SupprimeLe', 'SupprimePar'];

// Les lectures que la lecture légère aura à faire (js/explorer-sql.js, `prepare`) : [{ table, wanted }], une par table lue plus bas avec les mêmes colonnes
// voulues : les tables des fichiers des apps, leurs tables liées et la corbeille, sous le nom que le document leur donne.
function lightPlan(tables, apps) {
  const plan = [{ table: nameIn(tables, BIN_TABLE), wanted: BIN_LIGHT }];
  for (const { manifest } of apps) {
    for (const spec of manifest.fichiers || []) {
      plan.push({ table: nameIn(tables, spec.table), wanted: neededColumns(spec) });
      for (const rule of (spec.poids && spec.poids.liees) || []) plan.push({ table: nameIn(tables, rule.table), wanted: [rule.colonne] });
    }
  }
  return plan;
}

// L'adresse que disent les lignes de partage lues, quand la personne n'a pu l'apprendre autrement (js/direct-shares.js) ; '' sans table de partages ou sans
// certitude.
async function sharedAddress(port, tables) {
  if (!tables || !tables.some(name => sameName(name, SHARES_TABLE))) return '';
  try { return addressFromShares(rowsOf(await port.doc.fetchTable(SHARES_TABLE))); } catch (error) { return ''; }
}

async function existingTables(port) {
  try { return (await port.doc.listTables()).map(String); } catch (error) { return null; }
}

const nameIn = (tables, tableId) => (tables && tables.find(name => sameName(name, tableId))) || tableId;

// Lit une table si elle existe ; rend { data } ou { error } (ou { data: null } pour une table absente). Avec `light` (la lecture légère, js/explorer-sql.js) et
// les colonnes voulues `wanted`, une table qu'elle sait lire rend { data, weights } : seulement ces colonnes, et le poids de chaque ligne (celui de la lecture
// complète) ; sinon, la lecture complète d'avant.
async function readTable(port, tables, tableId, light = null, wanted = null) {
  if (tables && !tables.some(name => sameName(name, tableId))) return { data: null };
  const found = nameIn(tables, tableId);
  const one = light && wanted ? await light.read(found, wanted) : null;
  if (one) return one;
  try { return { data: await port.doc.fetchTable(found) }; } catch (error) { return { error }; }
}

// Les tables liées aux fichiers d'une table (`poids.liees`, contrats 2.4, point 5) : [{ table, fichier, bytes }], `bytes` les octets des lignes de la table
// liée par clé (js/weight.js, `linkedWeights`). Une table que l'app n'a pas encore créée ne pèse rien ; une table illisible est dite et ne cache aucun
// fichier : le poids est une estimation, il perd ces lignes.
async function readLinked(port, tables, spec, light) {
  const links = [];
  for (const rule of (spec.poids && spec.poids.liees) || []) {
    const linked = await readTable(port, tables, rule.table, light, [rule.colonne]);
    if (linked.error) console.warn(`GFS : la table liée ${rule.table} est illisible`, linked.error);
    else if (linked.data) links.push({ table: rule.table, fichier: rule.fichier, bytes: linkedWeights(linked.data, rule.colonne, linked.weights) });
  }
  return links;
}

// La case « + pièces jointes » de l'explorateur (faits vérifiés, section 39) : la table des pièces jointes de Grist, telle que l'API des widgets la rend avec
// l'accès complet que GFS a déjà. Lue seulement quand la personne coche la case. Rend { data } ou { error } : une lecture qui échoue n'arrête rien, la case se
// grise avec la raison.
export async function loadAttachments(port) {
  try { return { data: await port.doc.fetchTable('_grist_Attachments') }; } catch (error) { return { error }; }
}

// `apps` : les apps installées dont le manifeste est valide, { manifest }. `identity` : l'adresse de la personne, '' tant que GFS ne la connaît pas. Rend {
//   files, trash, folders, received, spaces, problems: [{ app, reason }], stats: { ms, tables, rows } } : `spaces` ce que disent les espaces partagés
//   (js/spaces-filing.js, null sans partage), dont les dossiers sont ajoutés à `folders` ; `files` les fichiers vivants, `trash` ceux qui sont à la corbeille
//   (js/explorer-model.js, `trashed`) : ils ne sont jamais mêlés, pour que rien de ce qui lit `files` (choisir, ouvrir, lire) ne voie un fichier supprimé ;
//   `folders` les dossiers que la personne garde sans fichier (6.4, point 11). Un rangement de GFS illisible ne cache aucun fichier : ils restent à leur place
//   d'avant.
// `reader` : la lecture légère (js/explorer-sql.js), qui prend la suite de la lecture complète quand un document lourd a été vu ; sans elle, ou éteinte, rien
//   ne change.
export async function loadFiles(port, apps, identity = '', reader = null) {
  const started = performance.now();
  const { context, folders } = await readShared(port, apps, identity, reader);
  const { tables, light } = context;
  const files = [];
  const trash = [];
  const problems = [];
  const stats = { ms: 0, tables: 0, rows: 0 };
  for (const { manifest } of apps) {
    for (const spec of manifest.fichiers || []) {
      const one = await readAppFiles(context, manifest, spec);
      if (one.problem) { problems.push(one.problem); continue; }
      for (const file of one.found) (file.trashed ? trash : files).push(file);
      trash.push(...one.binned);
      stats.tables += 1;
      stats.rows += one.found.length;
    }
  }
  // les fichiers reçus d'un autre document (js/received-files.js) : jamais mêlés aux fichiers vivants, rien de ce qui lit `files` ne les voit
  const received = await loadReceived(port, tables);
  stats.bytes = [...files, ...trash].reduce((sum, file) => sum + file.weight, 0);
  stats.light = Boolean(light && light.isActive());
  if (reader && !light) reader.learn(stats.bytes);
  stats.ms = Math.round(performance.now() - started);
  return { files, trash, folders, received, spaces: context.spaces, problems, stats };
}

// Ce que la lecture lit avant les tables des apps : l'état de la lecture légère (préparée ici quand elle sert), le rangement de GFS, les espaces partagés et la
// corbeille des apps. Rend { context, folders }, `context` ce que `readAppFiles` reçoit, `folders` les dossiers de GFS et ceux des espaces.
async function readShared(port, apps, identity, reader) {
  const tables = await existingTables(port);
  const light = reader && reader.isActive() && tables ? reader : null;
  if (light) await light.prepare(lightPlan(tables, apps));
  const gfs = await readTable(port, tables, TABLE);
  if (gfs.error) console.warn('GFS : le rangement de GFS est illisible', gfs.error);
  const folders = gfs.data ? readGfsFolders(gfs.data, identity) : [];
  const spaces = await loadSpaces(port.doc, tables);
  if (spaces) folders.push(...spaces.folders);
  const address = identity || await sharedAddress(port, tables);
  const bin = await readTable(port, tables, BIN_TABLE, light, BIN_LIGHT);
  if (bin.error) console.warn('GFS : la corbeille des apps est illisible', bin.error);
  return { folders, context: { port, tables, identity, address, spaces, bin, light, gfsFiling: gfs.data ? readGfsFiling(gfs.data, identity) : null } };
}

// Les fichiers d'une table de fichiers d'une app, rangés et placés : { found, binned } (`binned` : ceux qu'elle a mis à la corbeille de GFS), ou { problem }
// quand sa table est illisible.
async function readAppFiles({ port, tables, identity, address, spaces, bin, light, gfsFiling }, manifest, spec) {
  const main = await readTable(port, tables, spec.table, light, neededColumns(spec));
  if (main.error) return { problem: { app: manifest.id, reason: String(main.error.message || main.error) } };
  const filingTable = spec.rangement ? await readTable(port, tables, spec.rangement.table) : { data: null };
  const filing = filingTable.data ? readFiling(spec.rangement, filingTable.data, identity) : null;
  const found = readFiles(manifest, spec, main.data, main.weights || null, await readLinked(port, tables, spec, light));
  applyFiling(found, filing, gfsFiling);
  applyPlacement(found, spaces);
  applyDirect(found, main.data, address);
  return { found, binned: binnedFiles(manifest, spec, bin, filing, gfsFiling) };
}

// Les fichiers de l'app que la personne a mis à la corbeille ne sont plus dans sa table : ils sont dans `GFS_Corbeille` (js/gfs-trash.js), et gardent leur
// dossier, que le rangement n'a pas quitté.
function binnedFiles(manifest, spec, bin, filing, gfsFiling) {
  if (!recipeOf(spec) || !bin.data) return [];
  const gone = binFiles(spec, bin.data, manifest.id, bin.weights);
  const entries = readFiles(manifest, gone.spec, gone.data, gone.weights);
  applyFiling(entries, filing, gfsFiling);
  return entries;
}
