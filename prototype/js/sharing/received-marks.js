// Les marques « accepté » et « refusé » d'une table reçue (`Accepte`, `Refuse`, js/sharing/received-files.js) sont à CE document : l'envoyeur ne doit jamais
// les écrire. Le moteur de partage
// remplit pourtant la table avec les colonnes que l'envoyeur déclare, et recopie une colonne envoyée dans la colonne de même nom de la destination. Mesuré dans
// un vrai Grist (audit « contournement »
// du 11/11, labo/run-securite-marques.mjs) : un envoyeur qui range une colonne `Accepte` vraie dans son export fait arriver ses fichiers DÉJÀ ACCEPTÉS, sans
// que la personne ait rien répondu — que la colonne
// soit dans l'invitation ou ajoutée plus tard, tant que la table reçue n'a pas encore ses propres colonnes de marque. Une fois ces colonnes là, le moteur donne
// un nom libre aux colonnes envoyées qui les
// recoupent (`Accepte_2`) et ne touche à rien (mesuré aussi).
// Deux gestes ferment le trou :
//   - `reservedMap` : à la réception, une colonne envoyée qui porte le nom d'une marque (casse ignorée, comme Grist) arrive sous un autre nom
//   (`Accepte_envoye`) ;
//   - `ensureMarks` : les deux colonnes de marque existent dans la table reçue dès la réception (additif : deux colonnes Bool), et à l'ouverture de la page par
//   un propriétaire pour les réceptions d'avant.
// Du code sans effet de bord, sauf `ensureMarks` (une écriture, par `applyUserActions`).

import { MARK_COLUMNS, isReceivedTable } from './received-files.js';

const lower = text => String(text).toLowerCase();
const RESERVED = Object.freeze(MARK_COLUMNS.map(column => column.id));
const isReserved = id => RESERVED.some(mark => lower(mark) === lower(id));

// Le nom sous lequel arrive une colonne qui porte le nom d'une marque : `Accepte_envoye`, puis `Accepte_envoye_2`… si le nom est pris (casse ignorée, par une
// colonne envoyée ou une marque).
// `columns` : les colonnes que l'envoyeur déclare (des textes, ou des { id }) ; rend la correspondance { nom envoyé: nom d'ici } du moteur, vide quand rien ne
//   recoupe.
export function reservedMap(columns) {
  const ids = (columns || []).map(column => (column && typeof column === 'object' ? column.id : column)).filter(id => typeof id === 'string');
  const taken = new Set([...ids, ...RESERVED].map(lower));
  const map = {};
  for (const id of ids.filter(isReserved)) {
    let name = `${id}_envoye`;
    for (let n = 2; taken.has(lower(name)); n += 1) name = `${id}_envoye_${n}`;
    taken.add(lower(name));
    map[id] = name;
  }
  return map;
}

// Les colonnes de marque qui manquent à une table dont `columnIds` sont les colonnes (casse ignorée).
export const missingMarks = columnIds => MARK_COLUMNS.filter(mark => !(columnIds || []).some(id => lower(id) === lower(mark.id)));

// Les colonnes de chaque table du document, lues dans les tables internes de Grist (petites : jamais le contenu des fichiers) : { nom de table: [colonnes] }.
async function columnsByTable(docApi, wanted) {
  const [tables, columns] = await Promise.all(['_grist_Tables', '_grist_Tables_column'].map(async name => {
    const data = await docApi.fetchTable(name);
    return (data.id || []).map((id, i) => Object.fromEntries(Object.keys(data).map(key => [key, data[key][i]])));
  }));
  const byRef = new Map(tables.filter(table => wanted.includes(String(table.tableId))).map(table => [table.id, String(table.tableId)]));
  const found = Object.fromEntries([...byRef.values()].map(name => [name, []]));
  for (const column of columns) if (byRef.has(column.parentId)) found[byRef.get(column.parentId)].push(String(column.colId));
  return found;
}

// Ajoute les colonnes de marque qui manquent aux tables reçues `tables` (leurs noms ; les autres sont laissées) : une seule écriture. Rend les tables qui en
// ont reçu. Pas de table : rien n'est créé.
export async function ensureMarks(docApi, tables) {
  const wanted = (tables || []).map(String).filter(isReceivedTable);
  if (!wanted.length) return [];
  const have = await columnsByTable(docApi, wanted);
  const actions = [];
  const done = [];
  for (const table of Object.keys(have)) {
    const missing = missingMarks(have[table]);
    if (!missing.length) continue;
    done.push(table);
    for (const mark of missing) actions.push(['AddColumn', table, mark.id, { type: mark.type, isFormula: false }]);
  }
  if (actions.length) await docApi.applyUserActions(actions);
  return done;
}
