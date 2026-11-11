// La lecture de la table qui dit si la section est celle d'une app (contrats 7.4, point 7 ; `arrivee` du manifeste, 2.5, point 4). GFS la lit par sa propre
// connexion à Grist, seulement quand aucun réglage de la section ne désigne une app (js/broker/arrival.js, `arrivalProbes`), et n'en fait qu'une comparaison :
// rien n'est écrit, rien de ce qui est lu n'est jamais pris pour du code. Une table absente ou illisible ne dit rien : l'explorateur, comme avant.

import { arrivalByTable } from './arrival.js';

const sameName = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

async function readOne(doc, tables, spec) {
  const found = tables.find(name => sameName(name, spec.table));
  if (!found) return null;
  try { return await doc.fetchTable(found); } catch (error) {
    console.warn(`GFS : la table ${spec.table} ne se lit pas pour l'arrivée`, error);
    return null;
  }
}

// `probes` : les manifestes à interroger (leur `arrivee`), `tableId` : la table de la section. Rend l'id de l'app que sa table désigne, ou null.
export async function arrivalTableApp(doc, probes, tableId) {
  let tables;
  try { tables = (await doc.listTables()).map(String); } catch (error) { return null; }
  const found = await Promise.all(probes.map(async manifest => ({ id: manifest.id, spec: manifest.arrivee,
    data: await readOne(doc, tables, manifest.arrivee) })));
  return arrivalByTable(found, tableId);
}
