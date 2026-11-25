// La lecture légère des tables de fichiers (carte « Lire seulement les colonnes utiles » de l'audit vitesse du 10/11, faits vérifiés 83). L'explorateur relit
// les tables des apps à chaque fois qu'il s'affiche ; `fetchTable` rend TOUTES les colonnes, et un modèle de Publipostage+ garde son contenu entier dans une
// cellule : 100 modèles de 500 Ko, c'est 1,75 s et 1 Go de mémoire à chaque retour. Le fichier n'en montre pourtant que cinq colonnes et son poids. Une lecture
// SQL (`GET /sql`, par le cadre d'envoi, `Transfer.sql`) rend ces colonnes et le poids de la ligne, sans la cellule lourde : 30 ms.
//
// Trois règles font la forme de ce module :
//   - elle sert d'abord (25/11, choix du porteur : « la liste légère dès la première visite ») : tant que GFS ne sait rien du poids du document, puis tant
//     qu'il le sait lourd (`learn`, plus de 4 Mo de fichiers, à cette visite ou à une précédente : le souvenir de js/explorer/heavy-hint.js). Un document
//     connu léger garde la lecture complète, sans cadre d'envoi ni jeton de plus. Avant, la première lecture d'un document était toujours complète : 23 s
//     pour 118 Mo sur un serveur lent, et au-delà de 500 Mo Grist coupait la connexion et GFS redémarrait sans fin (faits vérifiés 161) ;
//   - elle part avec le jeton en lecture seule, et passe au jeton qui peut écrire après le refus de Grist (js/broker/sql-gate.js ; choix du porteur du 25/11) :
//   Grist ne
//     rend `/sql` qu'à qui peut tout copier, et dans un document à règles d'accès le jeton en lecture seule est refusé même au propriétaire (faits vérifiés
//     43). Un
//     éditeur, un lecteur ou un serveur muet l'éteignent pour la session et l'explorateur relit comme avant ; les lectures sont toutes écrites ici, jamais d'un
//     texte lu
//     ailleurs ;
//   - le poids rendu est celui de `js/weight/weight.js` : les colonnes du texte (texte, choix, listes, pièces jointes) se comptent en SQL
//     (`length(CAST(… AS BLOB))`, les octets UTF-8 que SQLite garde) quand la lecture ne les rend pas, toutes les autres sont lues (ce sont des nombres) et
//     pèsent par `cellBytes`, la fonction de la lecture complète : les deux lectures donnent le même poids à l'octet près.
// Rien n'est écrit, rien n'est gardé : les noms de tables et de colonnes viennent du manifeste et des tables internes de Grist, jamais d'un texte lu ailleurs,
// et passent par `TABLE_ID`.

import { TABLE_ID } from '../weight/weight-reader.js';
import { cellBytes } from '../weight/weight.js';

// Un document est lourd quand la dernière lecture a compté au moins ces octets pour ses fichiers : plus bas, le gain d'une lecture SQL ne paie pas le cadre
// d'envoi et le jeton qu'elle demande.
export const HEAVY_BYTES = 4 * 1024 * 1024;

const TEXT_TYPES = new Set(['Text', 'Choice', 'ChoiceList', 'Attachments']);
const isText = type => TEXT_TYPES.has(type) || String(type).startsWith('RefList:');
const isList = type => type === 'ChoiceList' || type === 'Attachments' || String(type).startsWith('RefList:');

// Les colonnes d'une table de fichiers que `readFiles` lit (js/explorer/explorer-model.js) d'après `spec` ; `id` est toujours rendu. Tout ce qui lit une
// colonne de plus d'une table d'app doit être dit ici : `test/explorer-sql.test.mjs` compare les deux lectures sur chaque manifeste.
export function neededColumns(spec) {
  const cols = spec.colonnes || {};
  const weight = spec.poids || {};
  const names = [cols.id, cols.nom, cols.type, cols.date, cols.par, cols.dossier, ...Object.keys(spec.exclure || {}),
    spec.corbeille && spec.corbeille.date, spec.corbeille && spec.corbeille.par,
    weight.pieces && weight.pieces.colonne, weight.pieces && weight.pieces.taille, ...(weight.liees || []).map(rule => rule.fichier)];
  return [...new Set(names.filter(name => name && name !== 'id'))];
}

const quote = name => `"${name}"`;
const valid = name => typeof name === 'string' && TABLE_ID.test(name);

// Les colonnes (identifiant et type de Grist) des tables `tables`, sans les colonnes d'aide de Grist ni le rang. Une seule lecture pour toutes les tables. Le
// filtre s'écrit `NOT LIKE` et `!=`, pas `substr(…) <> …` (25/11, faits vérifiés 173) : le pare-feu devant le Grist de la DINUM refuse en 403 la forme avec
// `substr(` et `<>` (sonde lancée par le porteur sur son instance : cette forme-là 403 « PARE-FEU », celle-ci 200 « Grist »). `LIKE` ignore la casse en
// SQLite : un identifiant « GRISTHELPER… » serait écarté lui aussi ; Grist ne crée que `gristHelper_…`, et aucun manifeste d'app n'en porte un autre.
export function schemaStatement(tables) {
  const names = tables.filter(valid).map(name => `'${name}'`);
  if (!names.length) return null;
  return 'SELECT t.tableId AS tableId, c.colId AS colId, c.type AS type FROM _grist_Tables_column AS c JOIN _grist_Tables AS t ON t.id = c.parentId '
    + `WHERE t.tableId IN (${names.join(', ')}) AND c.colId NOT LIKE 'gristHelper%' AND c.colId != 'manualSort' ORDER BY c.parentId, c.colId`;
}

// La lecture d'une table : le numéro de ligne, les colonnes voulues (`wanted`) et toutes celles qui ne sont pas du texte, et la somme des octets des colonnes
// de texte que la lecture ne rend pas. Rend { statement, keep } : `keep` sont les colonnes lues, dans l'ordre de la lecture.
export function rowsStatement(table, columns, wanted) {
  const keep = columns.filter(column => valid(column.colId) && (wanted.has(column.colId) || !isText(column.type)));
  const counted = columns.filter(column => valid(column.colId) && isText(column.type) && !wanted.has(column.colId));
  const bytes = counted.length ? counted.map(column => `COALESCE(length(CAST(${quote(column.colId)} AS BLOB)), 0)`).join(' + ') : '0';
  return { statement: `SELECT id${keep.map(column => `, ${quote(column.colId)}`).join('')}, ${bytes} AS gfs_octets FROM ${quote(table)}`, keep };
}

// Une liste de Grist telle que `fetchTable` la rend (`['L', 3, 5]`) d'après le texte JSON que SQLite garde (`[3,5]`).
function decodeList(value) {
  if (typeof value !== 'string' || !value.startsWith('[')) return value;
  try { const items = JSON.parse(value); return Array.isArray(items) ? ['L', ...items] : value; } catch (error) { return value; }
}

// Les lignes de la lecture, dans la forme de `fetchTable` ({ id: [..], <colonne>: [..] }), et le poids de chacune.
export function readRows(records, keep, wanted) {
  const byColumn = { id: records.map(row => row.id) };
  for (const { colId, type } of keep) byColumn[colId] = records.map(row => (wanted.has(colId) && isList(type) ? decodeList(row[colId]) : row[colId]));
  const weights = records.map(row => keep.reduce((sum, { colId }) => sum + cellBytes(row[colId]), Number(row.gfs_octets) || 0));
  return { data: byColumn, weights };
}

// Les lectures d'un même passage sont demandées ensemble : le jeton d'une requête est demandé à Grist à chaque fois (js/broker/transfer.js), et deux lectures
// de suite coûtent deux fois cet aller-retour (mesuré : 55 ms de plus par table, sans rien lire). Le plan (`prepare`) dit toutes les tables du passage et leurs
// colonnes voulues ; `read` rend la lecture déjà partie.
const planKey = (table, wanted) => `${table}\u0000${[...new Set(wanted)].sort().join('\u0001')}`;

// `sql(statement)` rend les lignes (`Transfer.sql`, jeton en lecture seule) ; `threshold` : le poids sous lequel celle-ci fait place à la lecture
// complète ; `warn` : dit pourquoi elle s'éteint.
export function createLightReader({ sql, threshold = HEAVY_BYTES, warn = () => {} }) {
  let heavy = null; // ce que GFS sait du document : rien encore (null : la lecture légère d'abord), lourd (true) ou léger (false : la lecture complète)
  let broken = false;
  let schema = null;
  let prepared = new Map();
  const stop = error => { if (!broken) warn(error); broken = true; schema = null; return null; };
  // La lecture d'une table : { data, weights }, ou null (lecture éteinte, table inconnue, échec : l'appelant lit comme avant).
  async function fetchRows(table, wanted) {
    if (broken || !schema || !schema.has(table)) return null;
    const want = new Set(wanted);
    const { statement, keep } = rowsStatement(table, schema.get(table), want);
    try { return readRows(await sql(statement), keep, want); } catch (error) { return stop(error); }
  }
  return {
    // Prête à servir : le document n'est pas connu léger, et rien n'a échoué depuis.
    isActive: () => heavy !== false && !broken,
    // `bytes` : ce que la dernière lecture (l'une ou l'autre : elles comptent le même poids) a compté pour les fichiers du document. `partial` : une app n'a
    //   pas pu être lue, son poids manque ; « lourd » reste sûr, « léger » ne le serait pas.
    learn(bytes, partial = false) {
      if (bytes >= threshold) heavy = true;
      else if (!partial) heavy = false;
    },
    // `plan` : [{ table, wanted }], toutes les lectures du prochain passage. Lit les colonnes de ces tables en une fois, puis lance les lectures ensemble ; une
    //   erreur éteint la lecture légère pour la session.
    async prepare(plan) {
      schema = null;
      prepared = new Map();
      const statement = schemaStatement([...new Set(plan.map(item => item.table))]);
      if (!statement || broken) return null;
      try {
        const found = new Map();
        for (const row of await sql(statement)) {
          if (!found.has(row.tableId)) found.set(row.tableId, []);
          found.get(row.tableId).push({ colId: String(row.colId), type: String(row.type) });
        }
        schema = found;
      } catch (error) { return stop(error); }
      for (const { table, wanted } of plan) {
        const key = planKey(table, wanted);
        if (!prepared.has(key)) prepared.set(key, fetchRows(table, wanted));
      }
      return schema;
    },
    // Les lignes de `table` pour les colonnes `wanted` : { data, weights }, ou null.
    async read(table, wanted) {
      if (!this.isActive()) return null;
      const key = planKey(table, wanted);
      return prepared.has(key) ? prepared.get(key) : fetchRows(table, wanted);
    },
  };
}
