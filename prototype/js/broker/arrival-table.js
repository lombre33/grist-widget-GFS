// La lecture de la table qui dit si la section est celle d'une app (contrats 7.4, point 7 ; `arrivee` du manifeste, 2.5, point 4). GFS la lit par sa propre
// connexion à Grist, seulement quand aucun réglage de la section ne désigne une app (js/broker/arrival.js, `arrivalProbes`), et n'en fait qu'une comparaison :
// rien n'est écrit, rien de ce qui est lu n'est jamais pris pour du code. Une table absente ou illisible ne dit rien : l'explorateur, comme avant.

import { arrivalByTable } from './arrival.js';

const sameName = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

// Les noms que l'app donne à sa table : `table`, puis ses `aussi` (contrats 2.5, point 4 : le nom d'avant le passage à l'anglais). Comme pour les tables de
// `noms` (2.4), c'est la table qui a des lignes que GFS lit ; si plusieurs en ont, ou aucune, la première de la liste (le nom du manifeste).
const rowCount = data => (data && Array.isArray(data.id) ? data.id.length : 0);

async function readTable(doc, name) {
  try { return await doc.fetchTable(name); } catch (error) {
    console.warn(`GFS : la table ${name} ne se lit pas pour l'arrivée`, error);
    return null;
  }
}

async function readOne(doc, tables, spec) {
  let first = null;
  for (const wanted of [spec.table, ...(spec.aussi || [])]) {
    const found = tables.find(name => sameName(name, wanted));
    if (!found) continue;
    const data = await readTable(doc, found);
    if (rowCount(data) > 0) return data;
    first = first || data;
  }
  return first;
}

// `probes` : les manifestes à interroger (leur `arrivee`), `tableId` : la table de la section. Rend l'id de l'app que sa table désigne, ou null.
export async function arrivalTableApp(doc, probes, tableId) {
  let tables;
  try { tables = (await doc.listTables()).map(String); } catch (error) { return null; }
  const found = await Promise.all(probes.map(async manifest => ({ id: manifest.id, spec: manifest.arrivee,
    data: await readOne(doc, tables, manifest.arrivee) })));
  return arrivalByTable(found, tableId);
}
