// La lecture par l'index des noms (js/explorer/index-model.js) : à la place de la table entière d'une app, la table-résumé que Grist tient, qui ne porte que
// les colonnes que l'explorateur montre et le poids que le moteur a compté. Elle rend la même chose que la lecture légère (js/explorer/explorer-sql.js) : {
// data, weights } dans la forme de `fetchTable`, avec `id` le numéro de la ligne d'origine ; et pour une table liée au poids d'un fichier, les octets de chaque
// clé.
//
// Une lecture par l'index se refuse (rend null : l'appelant lit comme avant) quand elle risquerait de cacher un fichier ou d'en dire un autre : un résumé
// absent ou illisible, une colonne que l'explorateur demande et que le résumé n'a pas encore (une app en a ajouté une : le propriétaire remet l'index à jour),
// deux lignes d'origine dans un même groupe (une clé qui n'est pas unique : le résumé les fusionnerait). Rien n'est écrit, rien n'est gardé.

import { neededColumns } from './explorer-sql.js';
import { wantedBoth } from '../sharing/helper-names.js';
import { ROW, WEIGHT, keyOf, summaryName } from './index-model.js';

const sameName = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const LEFT_OUT = new Set(['id', 'manualSort', 'group', 'count', ROW, WEIGHT]);

// Le nom, dans le document, du résumé de `table` groupé par `key` (la casse que le document lui donne), ou null.
export const indexNameIn = (tables, table, key) => {
  const name = summaryName(table, key);
  return (tables && tables.find(each => sameName(each, name))) || null;
};

// Le résumé d'une table de fichiers existe-t-il pour cette déclaration (et pour ses tables liées) ? Sans lire une ligne : d'après la liste des tables.
export function hasIndex(tables, spec) {
  if (!tables || !indexNameIn(tables, spec.table, keyOf(spec))) return false;
  return ((spec.poids && spec.poids.liees) || []).every(rule => !tables.some(each => sameName(each, rule.table)) ||
    indexNameIn(tables, rule.table, rule.colonne));
}

// Les colonnes que la table d'origine porte vraiment (les tables internes de Grist, que la page a déjà : une lecture en mémoire), ou null. Une colonne que le
// manifeste nomme et que le document n'a pas (une app plus ancienne) n'est pas au résumé et n'a pas à y être : il ne manque rien.
async function baseColumns(doc, table) {
  try {
    const [tables, columns] = await Promise.all(['_grist_Tables', '_grist_Tables_column'].map(name => doc.fetchTable(name)));
    const at = (tables.tableId || []).findIndex(id => sameName(id, table));
    if (at < 0) return null;
    return (columns.colId || []).filter((id, index) => columns.parentId[index] === tables.id[at]).map(String);
  } catch (error) { return null; }
}

const usable = (raw, wanted) => Boolean(raw && Array.isArray(raw[ROW]) && Array.isArray(raw[WEIGHT]) && Array.isArray(raw.count) &&
  wanted.every(name => Array.isArray(raw[name]))
  && raw.count.every(n => n === 1));

// Les lignes de la table `spec.table` d'après son résumé : { data, weights }, ou null.
export async function readIndexedTable(doc, tables, spec) {
  const key = keyOf(spec);
  const name = indexNameIn(tables, spec.table, key);
  if (!name) return null;
  let raw;
  try { raw = await doc.fetchTable(name); } catch (error) { return null; }
  const have = await baseColumns(doc, spec.table);
  const found = name => (have || []).find(column => sameName(column, name));
  const wanted = [key, ...wantedBoth(neededColumns(spec)).filter(column => column !== key)].map(found).filter(Boolean);
  if (!found(key) || !usable(raw, wanted)) return null;
  const data = { id: raw[ROW] };
  for (const column of Object.keys(raw)) if (!LEFT_OUT.has(column)) data[column] = raw[column];
  return { data, weights: raw[WEIGHT] };
}

// Les tables liées d'une table de fichiers (`poids.liees`) d'après leurs résumés : [{ table, fichier, bytes }] comme `readLinked`
// (js/explorer/explorer-data.js), ou null quand l'une manque ou n'est pas lisible.
export async function readIndexedLinks(doc, tables, spec) {
  const links = [];
  for (const rule of (spec.poids && spec.poids.liees) || []) {
    if (!tables.some(each => sameName(each, rule.table))) continue; // une table que l'app n'a pas encore créée ne pèse rien
    const name = indexNameIn(tables, rule.table, rule.colonne);
    let raw = null;
    try { raw = name ? await doc.fetchTable(name) : null; } catch (error) { raw = null; }
    if (!raw || !Array.isArray(raw[rule.colonne]) || !Array.isArray(raw[WEIGHT])) return null;
    const bytes = new Map();
    raw[rule.colonne].forEach((value, at) => {
      const clef = value === null || value === undefined ? '' : String(value);
      if (clef !== '') bytes.set(clef, (bytes.get(clef) || 0) + raw[WEIGHT][at]);
    });
    links.push({ table: rule.table, fichier: rule.fichier, bytes });
  }
  return links;
}
