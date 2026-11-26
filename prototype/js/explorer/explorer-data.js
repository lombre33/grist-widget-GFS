// La lecture des fichiers pour l'explorateur (contrats 2.4) : GFS lit les tables de fichiers que les manifestes déclarent, par sa propre
// connexion à Grist, et n'en garde que les colonnes déclarées. Une table que l'app n'a pas encore créée n'est pas un problème (aucun fichier) ;
// une table présente mais illisible est dite, app par app. Le rangement de GFS (`GFS_Rangement`, 6.4) passe devant celui de chaque app.

import { readFiles, readFiling, readGfsFiling, readGfsFolders, applyFiling } from './explorer-model.js';
import { TABLE } from '../files/rangement.js';
import { readAppFolders, usable } from '../files/app-filing.js';
import { BIN_TABLE, recipeOf, binFiles } from '../files/gfs-trash.js';
import { linkedWeights } from '../weight/weight.js';
import { applyPlacement, loadSpaces } from '../sharing/spaces-filing.js';
import { addressFromShares, applyDirect } from '../sharing/direct-shares.js';
import { applyLinks } from '../sharing/space-links.js';
import { SHARES_TABLE } from '../sharing/sharing-model.js';
import { rowsOf } from '../rights/rights.js';
import { loadReceived } from '../sharing/received-files.js';
import { loadNoticeSources } from '../sharing/notice-store.js';
import { neededColumns } from './explorer-sql.js';
import { hasIndex, readIndexedTable, readIndexedLinks } from './index-reader.js';

const sameName = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

// Les colonnes de la corbeille que l'explorateur montre (js/files/gfs-trash.js, `binFiles`) : l'identifiant de l'entrée et la copie JSON de la ligne
// (`Instantane`) n'y sont pas, mais pèsent dans le poids.
const BIN_LIGHT = ['App', 'Table', 'FichierId', 'Nom', 'Type', 'Date', 'Auteur', 'SupprimeLe', 'SupprimePar'];

// Les lectures que la lecture légère aura à faire (js/explorer/explorer-sql.js, `prepare`) : [{ table, wanted }], une par table lue plus bas avec les mêmes
// colonnes voulues : les tables des fichiers des apps, leurs tables liées et la corbeille, sous le nom que le document leur donne.
function lightPlan(tables, apps) {
  const plan = [{ table: nameIn(tables, BIN_TABLE), wanted: BIN_LIGHT }];
  for (const { manifest } of apps) {
    for (const spec of manifest.fichiers || []) {
      if (hasIndex(tables, spec)) continue; // l'index des noms rend ces lignes sans la lecture SQL (js/explorer/index-reader.js)
      plan.push({ table: nameIn(tables, spec.table), wanted: neededColumns(spec) });
      for (const rule of (spec.poids && spec.poids.liees) || []) plan.push({ table: nameIn(tables, rule.table), wanted: [rule.colonne] });
    }
  }
  return plan;
}

// L'adresse que disent les lignes de partage lues, quand la personne n'a pu l'apprendre autrement (js/sharing/direct-shares.js) ;
// '' sans table de partages ou sans certitude.
async function sharedAddress(port, tables) {
  if (!tables || !tables.some(name => sameName(name, SHARES_TABLE))) return '';
  try { return addressFromShares(rowsOf(await port.doc.fetchTable(SHARES_TABLE))); } catch (error) { return ''; }
}

async function existingTables(port) {
  try { return (await port.doc.listTables()).map(String); } catch (error) { return null; }
}

const nameIn = (tables, tableId) => (tables && tables.find(name => sameName(name, tableId))) || tableId;

// Lit une table si elle existe ; rend { data } ou { error } (ou { data: null } pour une table absente). Avec `light` (la lecture légère,
// js/explorer/explorer-sql.js) et les colonnes voulues `wanted`, une table qu'elle sait lire rend { data, weights } : seulement ces colonnes, et le poids de
// chaque ligne (celui de la lecture complète) ; sinon, la lecture complète d'avant.
async function readTable(port, tables, tableId, light = null, wanted = null) {
  if (tables && !tables.some(name => sameName(name, tableId))) return { data: null };
  const found = nameIn(tables, tableId);
  const one = light && wanted ? await light.read(found, wanted) : null;
  if (one) return one;
  try { return { data: await port.doc.fetchTable(found) }; } catch (error) { return { error }; }
}

// Les tables liées aux fichiers d'une table (`poids.liees`, contrats 2.4, point 5) : [{ table, fichier, bytes }], `bytes` les octets des lignes de la table
// liée par clé (js/weight/weight.js, `linkedWeights`). Une table que l'app n'a pas encore créée ne pèse rien ; une table illisible est dite et ne cache aucun
// fichier : le poids est une estimation, il perd ces lignes. Les tables liées sont lues ensemble.
async function readLinked(port, tables, spec, light) {
  const rules = (spec.poids && spec.poids.liees) || [];
  const reads = await Promise.all(rules.map(rule => readTable(port, tables, rule.table, light, [rule.colonne])));
  const links = [];
  reads.forEach((linked, index) => {
    const rule = rules[index];
    if (linked.error) console.warn(`GFS : la table liée ${rule.table} est illisible`, linked.error);
    else if (linked.data) links.push({ table: rule.table, fichier: rule.fichier, bytes: linkedWeights(linked.data, rule.colonne, linked.weights) });
  });
  return links;
}

// La case « + pièces jointes » de l'explorateur (faits vérifiés, section 39) : la table des pièces jointes de Grist, telle que l'API des widgets la rend avec
// l'accès complet que GFS a déjà. Lue seulement quand la personne coche la case. Rend { data } ou { error } : une lecture qui échoue n'arrête rien, la case
// se grise avec la raison.
export async function loadAttachments(port) {
  try { return { data: await port.doc.fetchTable('_grist_Attachments') }; } catch (error) { return { error }; }
}

// Les lignes d'une table de fichiers d'après son index des noms (js/explorer/index-reader.js) : { main, links }, ou null (pas d'index, ou il n'est pas sûr).
async function readIndexed(port, tables, spec) {
  if (!tables || !hasIndex(tables, spec)) return null;
  const [main, links] = await Promise.all([readIndexedTable(port.doc, tables, spec), readIndexedLinks(port.doc, tables, spec)]);
  return main && links ? { main, links } : null;
}

// Les tables d'une table de fichiers d'une app, lues ensemble : { main, filing, links, indexed } (la table des fichiers, son rangement, ses tables liées ;
// `indexed` : les deux premières viennent de l'index des noms, sans lire de contenu).
async function readSpec(port, tables, spec, light) {
  const filing = spec.rangement ? readTable(port, tables, spec.rangement.table) : { data: null };
  const indexed = await readIndexed(port, tables, spec);
  if (indexed) return { ...indexed, filing: await filing, indexed: true };
  const [main, rest, links] = await Promise.all([readTable(port, tables, spec.table, light, neededColumns(spec)), filing,
    readLinked(port, tables, spec, light)]);
  return { main, filing: rest, links, indexed: false };
}

// Tout ce que la lecture demande à Grist, en deux temps : la liste des tables, puis toutes les tables ensemble (chacune ne dépend que de son nom, jamais d'une
// autre ni de l'adresse de la personne). Une lecture qui allait table après table coûtait un aller-retour de réseau par table, et l'explorateur paraissait lent
// dès que Grist n'était pas sur la même machine. Rend { tables, light, gfs, spaces, bin, received, notices, reads: [{ manifest, spec, main, filing, links }] }.
// `real` : le port de GFS ; `guard` : le garde-fou des lectures complètes, ou rien.
async function readEverything(real, apps, reader, guard) {
  const tables = await existingTables(real);
  const light = reader && reader.isActive() && tables ? reader : null;
  // les lectures complètes des tables de fichiers passent par le garde-fou (js/explorer/read-guard.js) : une table que Grist ne sait plus envoyer n'est
  // pas redemandée sans fin
  const port = guard ? { doc: { fetchTable: name => guard.run(name, () => real.doc.fetchTable(name)) } } : real;
  // le rangement de GFS, les espaces et les fichiers reçus se lisent pendant que la lecture légère prépare la sienne
  const own = Promise.all([readTable(port, tables, TABLE), loadSpaces(real.doc, tables), loadReceived(real, tables), loadNoticeSources(real.doc, tables)]);
  // seulement les tables que le document a : un document sans aucune table de fichiers ne demande ni cadre d'envoi ni jeton
  const plan = tables ? lightPlan(tables, apps).filter(item => tables.includes(item.table)) : [];
  if (light && plan.length) await light.prepare(plan);
  const specs = apps.flatMap(({ manifest }) => (manifest.fichiers || []).map(spec => ({ manifest, spec })));
  const [bin, ...found] = await Promise.all([readTable(port, tables, BIN_TABLE, light, BIN_LIGHT),
    ...specs.map(({ spec }) => readSpec(port, tables, spec, light))]);
  const [gfs, spaces, received, notices] = await own;
  return { tables, light, usedLight: Boolean(light && plan.length), gfs, spaces, bin, received, notices,
    reads: specs.map((item, index) => ({ ...item, ...found[index] })) };
}

// `apps` : les apps installées dont le manifeste est valide, { manifest }. `identity` : l'adresse de la personne, '' tant que GFS ne la connaît pas ; ou la
//   promesse de cette adresse, quand GFS l'apprend encore (js/files/rangement.js, `identify`) : la lecture des tables n'en dépend pas, elle part tout de suite,
//   et l'adresse n'est attendue qu'au moment de ranger.
// Rend { files, trash, folders, received, spaces, problems: [{ app, reason, held }], stats: { ms, tables, rows } } :
//   `spaces` ce que disent les espaces partagés (js/sharing/spaces-filing.js, null sans partage), dont les dossiers sont ajoutés à `folders` ;
//   `files` les fichiers vivants, `trash` ceux qui sont à la corbeille (js/explorer/explorer-model.js, `trashed`) : ils ne sont jamais mêlés, pour que rien de
//   ce qui lit `files` (choisir, ouvrir, lire) ne voie un fichier supprimé ; `folders` les dossiers que la personne garde sans fichier (6.4, point 11) ;
//   `gfsTable` le nom que le document donne à la table du rangement, ou null quand elle n'existe pas ; `binTable` celui de la table de la corbeille
//   (js/files/gfs-trash.js), ou null. Un rangement de GFS illisible ne cache aucun fichier : ils restent à leur place d'avant.
// `reader` : la lecture légère (js/explorer/explorer-sql.js), qui lit d'abord et tant que le document n'est pas connu léger ; sans elle, ou éteinte, tout
//   se lit en entier.
// `guard` : le garde-fou des lectures complètes (js/explorer/read-guard.js) ; une table qu'il retient est un problème de son app, marqué `held`.
export async function loadFiles(port, apps, identity = '', reader = null, guard = null) {
  const started = performance.now();
  const raw = await readEverything(port, apps, reader, guard);
  const who = await identity;
  const { context, folders } = await arrange(port, raw, who);
  const files = [];
  const trash = [];
  const problems = [];
  const stats = { ms: 0, tables: 0, rows: 0 };
  for (const read of raw.reads) {
    const one = readAppFiles(context, read);
    if (one.problem) { problems.push(one.problem); continue; }
    for (const file of one.found) (file.trashed ? trash : files).push(file);
    trash.push(...one.binned);
    for (const path of one.folders) if (!folders.includes(path)) folders.push(path);
    stats.tables += 1;
    stats.rows += one.found.length;
  }
  stats.bytes = [...files, ...trash].reduce((sum, file) => sum + file.weight, 0);
  stats.light = Boolean(raw.usedLight && raw.light.isActive());
  stats.indexed = noContent(raw);
  if (reader) reader.learn(stats.bytes, problems.length > 0);
  stats.ms = Math.round(performance.now() - started);
  return { files, trash, folders, received: raw.received, spaces: raw.spaces, notices: raw.notices, problems, stats,
    gfsTable: raw.gfs.data ? nameIn(raw.tables, TABLE) : null,
    binTable: raw.bin.data ? nameIn(raw.tables, BIN_TABLE) : null };
}

// La lecture n'a lu le contenu d'aucun fichier : chaque table de fichiers que le document a vient de son index des noms, et la corbeille de GFS (qui garde une
// copie de chaque ligne supprimée) est absente, vide ou lue par la lecture légère (js/explorer/live-list.js : seule une telle lecture se refait toute seule sur
// un gros document).
function noContent(raw) {
  const present = raw.reads.filter(({ spec }) => raw.tables && raw.tables.some(name => sameName(name, spec.table)));
  const bin = raw.bin;
  const binRows = bin && bin.data && Array.isArray(bin.data.id) ? bin.data.id.length : 0;
  return present.length > 0 && present.every(read => read.indexed) && (binRows === 0 || Boolean(bin.weights));
}

// Ce que la lecture range avec l'adresse de la personne : le rangement de GFS, les espaces partagés et la corbeille des apps. Rend { context, folders },
// `context` ce que `readAppFiles` reçoit, `folders` les dossiers de GFS et ceux des espaces.
async function arrange(port, raw, identity) {
  const { tables, light, gfs, spaces, bin } = raw;
  if (gfs.error) console.warn('GFS : le rangement de GFS est illisible', gfs.error);
  const folders = gfs.data ? readGfsFolders(gfs.data, identity) : [];
  if (spaces) folders.push(...spaces.folders);
  const address = identity || await sharedAddress(port, tables);
  if (bin.error) console.warn('GFS : la corbeille des apps est illisible', bin.error);
  return { folders, context: { identity, address, spaces, bin, gfsFiling: gfs.data ? readGfsFiling(gfs.data, identity) : null } };
}

// Les fichiers d'une table de fichiers d'une app, rangés et placés : { found, binned } (`binned` : ceux qu'elle a mis à la corbeille de GFS), ou { problem }
// quand sa table est illisible.
function readAppFiles({ identity, address, spaces, bin, gfsFiling }, { manifest, spec, main, filing: filingTable, links }) {
  if (main.error) return { problem: { app: manifest.id, reason: String(main.error.message || main.error), held: Boolean(main.error.held) } };
  const filing = filingTable.data ? readFiling(spec.rangement, filingTable.data, identity) : null;
  // L'app tient son rangement et laisse GFS l'écrire (6.4, point 8) : le sien fait foi, et ses dossiers sans fichier s'ajoutent à ceux de la personne.
  const appFirst = Boolean(spec.rangement && spec.rangement.ecriture) && usable(spec.rangement, filingTable.data);
  const found = readFiles(manifest, spec, main.data, main.weights || null, links);
  applyFiling(found, filing, gfsFiling, appFirst);
  applyPlacement(found, spaces);
  applyDirect(found, main.data, address);
  applyLinks(found, main.data, spaces, identity || address);
  const folders = appFirst ? readAppFolders({ ...spec.rangement, marque: spec.rangement.ecriture.dossiers }, filingTable.data, identity) : [];
  return { found, folders, binned: binnedFiles(manifest, spec, bin, { filing, gfsFiling, appFirst }) };
}

// Les fichiers de l'app que la personne a mis à la corbeille ne sont plus dans sa table : ils sont dans `GFS_Corbeille` (js/files/gfs-trash.js), et gardent
// leur dossier, que le rangement n'a pas quitté.
function binnedFiles(manifest, spec, bin, { filing, gfsFiling, appFirst }) {
  if (!recipeOf(spec) || !bin.data) return [];
  const gone = binFiles(spec, bin.data, manifest.id, bin.weights);
  const entries = readFiles(manifest, gone.spec, gone.data, gone.weights);
  applyFiling(entries, filing, gfsFiling, appFirst);
  return entries;
}
