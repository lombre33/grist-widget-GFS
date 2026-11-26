// Les fichiers reçus d'un autre document Grist (« Partagés avec moi », contrats 6.6, point 17) : ce que GFS en sait sans toucher à Grist. Ils arrivent dans des
// tables `GFS_Received`, `GFS_Received_2`… (`GFS_Recus`, `GFS_Recus_2`… pour les réceptions d'avant le passage à l'anglais : un lien ne se renomme jamais ; une
// par partage : le moteur de Sync+ ne remplit une destination que pour un seul partage, faits vérifiés 71), avec les colonnes des fichiers de l'ENVOYEUR (le
// moteur les recopie sous leur nom : françaises ou anglaises, `filesNamesOfColumns`) ; chaque arrivée attend la réponse de la personne :
//   à accepter  ni `Accepted` ni `Refused` : le fichier est dans ce document, grisé, et nulle app ne le voit (l'explorateur de GFS seul le montre) ;
//   accepté     `Accepted` vrai : la ligne se lit comme un PDF de GFS ;
//   refusé      `Refused` vrai : la ligne reste dans la table, mais n'est plus montrée.
// Deux colonnes Bool, ajoutées par GFS : elles TIENNENT aux mises à jour de l'envoyeur, alors qu'une ligne effacée REVIENT à la mise à jour suivante (mesuré,
// faits vérifiés 72) : refuser, c'est marquer, jamais effacer. Du code sans effet de bord, sauf `loadReceived` (lecture) et `answerFile` (écriture d'une
// marque, par OwnTable).

import { filesManifest, filesNamesOfColumns } from '../files/gfs-files.js';
import { readFiles, applyFiling, fileKey } from '../explorer/explorer-model.js';
import { OwnTable } from '../files/own-table.js';
import { PENDING, ACCEPTED, REFUSED, stateOf } from './received-state.js';

export const RECEIVED_APP = 'gfs-recus';
export const RECEIVED_TABLE = 'GFS_Received';
const RECEIVED_BEFORE = 'GFS_Recus';
// le moteur de Sync+ (kit/js/synchro/logic/common.js, ARCHIVE_COL) : le fichier n'est plus chez l'envoyeur
export const ARCHIVE_COLUMN = 'Supprimee_a_la_source';
// Les deux colonnes de marque, sous les noms de la table (ceux de l'envoyeur : `names` de `filesNamesOfColumns`).
export const markColumns = names => Object.freeze([{ id: names.accepted, type: 'Bool' },
  { id: names.refused, type: 'Bool' }].map(column => Object.freeze(column)));

// `GFS_Received`, `GFS_Received_2`… ou `GFS_Recus`, `GFS_Recus_2`… (casse ignorée, comme Grist) : jamais une autre table, même si son nom commence pareil.
export const isReceivedTable = name => new RegExp(`^(${RECEIVED_TABLE}|${RECEIVED_BEFORE})(_[0-9]+)?$`, 'i').test(String(name));

// Les tables reçues d'une liste de noms, dans l'ordre de leur numéro (celles d'avant d'abord, à numéro égal).
export function receivedTables(names) {
  const number = name => Number(String(name).split('_')[2] || 1);
  return (names || []).map(String).filter(isReceivedTable).sort((a, b) => number(a) - number(b) || a.localeCompare(b));
}

// Le manifeste des fichiers reçus, de la forme de celui d'une app (contrats 2.4) : les colonnes et les types de ceux de GFS, sans corbeille ; `spec(table)`
// donne la déclaration d'une table reçue.
export const RECEIVED_MANIFEST = Object.freeze({ id: RECEIVED_APP, nom: filesManifest().nom, integre: true });
const spec = (table, names) => ({ ...filesManifest(names).fichiers[0], table, corbeille: null });

const flag = (data, column, i) => Array.isArray(data[column]) && data[column][i] === true;
// Le dossier que l'envoyeur a donné au fichier (js/sharing/received-folders.js), ou '' : la colonne manque aux partages d'un fichier seul.
const folderName = (data, i, names) => (Array.isArray(data[names.folder]) ? String(data[names.folder][i] ?? '').trim() : '');

export { PENDING, ACCEPTED, REFUSED, stateOf };

// Les fichiers d'une table reçue, tous états confondus : { …fichier de l'explorateur, key, received: { table, row, state, gone, folder } }. La clé porte la
// table (deux partages peuvent citer un même identifiant) ;
// `gone` : le fichier est retiré chez l'envoyeur, la copie reste ici (réception « en archive »), `folder` : le nom du dossier partagé où il est chez
//   l'envoyeur, ou ''.
export function readReceived(table, data) {
  const names = filesNamesOfColumns(Object.keys(data || {}));
  const files = applyFiling(readFiles(RECEIVED_MANIFEST, spec(table, names), data), null); // sans rangement : le texte de la recherche seul
  const byRow = new Map((data && Array.isArray(data.id) ? data.id : []).map((row, i) => [row, i]));
  return files.map(file => {
    const i = byRow.get(file.row);
    const state = stateOf({ accepted: flag(data, names.accepted, i), refused: flag(data, names.refused, i) });
    return { ...file, key: fileKey(RECEIVED_APP, `${table}:${file.id}`), received: { table, row: file.row, state, gone: flag(data, ARCHIVE_COLUMN, i),
      folder: folderName(data, i, names) } };
  });
}

// Sans « Partagés avec moi » (les essais de l'explorateur seul) : aucune arrivée à répondre, aucun geste de plus.
export const NO_RECEIVED = Object.freeze({ openAs: () => null, menu: () => null, activate: () => {}, askFolder: () => {} });

// Un fichier reçu et accepté : il se lit (js/files/kept-files.js).
export const isAcceptedReceived = file => Boolean(file && file.received && file.received.state === ACCEPTED);

// Ce que « Partagés avec moi » montre : les arrivées pas refusées.
export const shownReceived = files => files.filter(file => file.received.state !== REFUSED);
export const pendingOf = files => files.filter(file => file.received.state === PENDING);

// Lit toutes les tables reçues du document (`tables` : leurs noms, ou null quand la liste n'a pu être lue). Une table illisible est dite par la console et ne
// cache pas les autres. Les tables sont lues ensemble. Rend les fichiers à plat.
export async function loadReceived(port, tables) {
  const found = tables ? receivedTables(tables) : [];
  const lists = await Promise.all(found.map(async table => {
    try { return readReceived(table, await port.doc.fetchTable(table)); } catch (error) {
      console.warn(`GFS : la table reçue ${table} est illisible`, error);
      return [];
    }
  }));
  return lists.flat();
}

// La réponse à une arrivée : les deux marques écrites sur sa ligne, relue juste avant (la ligne a pu disparaître : le moteur la remet à la mise à jour
// suivante, la réponse est alors dite sans rien écrire). Une table reçue plus ancienne n'a pas les colonnes : elles sont ajoutées avant d'être écrites (une
// seule colonne inconnue annulerait tout le lot, contrats 6.1, point 3). Rend `true` quand la marque est posée.
export async function answerFile(port, file, accepted) {
  const { table, row } = file.received;
  const { own, seen, names } = await markedTable(port, table);
  if (!seen.exists || !seen.data.id.includes(row)) return false;
  await own.existing([names.accepted, names.refused]);
  await port.doc.applyUserActions([['UpdateRecord', own.id, row, { [names.accepted]: accepted, [names.refused]: !accepted }]]);
  return true;
}

// La table reçue lue d'abord (ses colonnes disent si l'envoyeur parlait français ou anglais), puis la même avec les marques de ce jeu de noms.
async function markedTable(port, table) {
  const seen = await new OwnTable({ port, name: table, columns: [], consent: async () => false }).load();
  const names = filesNamesOfColumns(seen.columns);
  return { own: new OwnTable({ port, name: table, columns: markColumns(names), consent: async () => false }), seen, names };
}

// La réponse à un DOSSIER reçu (`folder` : js/sharing/received-folders.js) : les marques de TOUS ses fichiers à accepter, écrites en une seule action (un lot
// qui échoue n'écrit rien). La table est relue juste avant (une ligne a pu disparaître : le moteur la remet à la mise à jour suivante) et les deux colonnes de
// marques sont ajoutées d'abord, comme pour un fichier. Rend le nombre de fichiers marqués (0 : plus rien à répondre).
export async function answerFolder(port, folder, accepted) {
  const { own, seen, names } = await markedTable(port, folder.table);
  if (!seen.exists) return 0;
  const rows = folder.files.filter(file => file.received.state === PENDING).map(file => file.received.row).filter(row => seen.data.id.includes(row));
  if (!rows.length) return 0;
  await own.existing([names.accepted, names.refused]);
  await port.doc.applyUserActions([['BulkUpdateRecord', own.id, rows, { [names.accepted]: rows.map(() => accepted),
    [names.refused]: rows.map(() => !accepted) }]]);
  return rows.length;
}
