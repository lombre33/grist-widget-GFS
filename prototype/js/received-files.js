// Les fichiers reçus d'un autre document Grist (« Partagés avec moi », contrats 6.6, point 17) : ce que GFS en sait sans toucher à Grist. Ils arrivent dans des tables `GFS_Recus`, `GFS_Recus_2`… (une par partage :
// le moteur de Sync+ ne remplit une destination que pour un seul partage, faits vérifiés 71), avec les colonnes des fichiers de GFS ; chaque arrivée attend la réponse de la personne :
//   à accepter  ni `Accepte` ni `Refuse` : le fichier est dans ce document, grisé, et nulle app ne le voit (l'explorateur de GFS seul le montre) ;
//   accepté     `Accepte` vrai : la ligne se lit comme un PDF de GFS ;
//   refusé      `Refuse` vrai : la ligne reste dans la table, mais n'est plus montrée.
// Deux colonnes Bool, ajoutées par GFS : elles TIENNENT aux mises à jour de l'envoyeur, alors qu'une ligne effacée REVIENT à la mise à jour suivante (mesuré, faits vérifiés 72) : refuser, c'est marquer, jamais effacer.
// Du code sans effet de bord, sauf `loadReceived` (lecture) et `answerFile` (écriture d'une marque, par OwnTable).

import { FILES_MANIFEST } from './gfs-files.js';
import { readFiles, applyFiling, fileKey } from './explorer-model.js';
import { OwnTable } from './own-table.js';

export const RECEIVED_APP = 'gfs-recus';
export const RECEIVED_TABLE = 'GFS_Recus';
export const ACCEPTED_COLUMN = 'Accepte';
export const REFUSED_COLUMN = 'Refuse';
export const ARCHIVE_COLUMN = 'Supprimee_a_la_source'; // le moteur de Sync+ (kit/js/synchro/logic/common.js, ARCHIVE_COL) : le fichier n'est plus chez l'envoyeur
export const MARK_COLUMNS = Object.freeze([{ id: ACCEPTED_COLUMN, type: 'Bool' }, { id: REFUSED_COLUMN, type: 'Bool' }].map(column => Object.freeze(column)));

// `GFS_Recus`, `GFS_Recus_2`, `GFS_Recus_3`… (casse ignorée, comme Grist) : jamais une autre table, même si son nom commence pareil.
export const isReceivedTable = name => new RegExp(`^${RECEIVED_TABLE}(_[0-9]+)?$`, 'i').test(String(name));

// Les tables reçues d'une liste de noms, dans l'ordre de leur numéro (`GFS_Recus` d'abord).
export function receivedTables(names) {
  const number = name => Number(String(name).split('_')[2] || 1);
  return (names || []).map(String).filter(isReceivedTable).sort((a, b) => number(a) - number(b));
}

// Le manifeste des fichiers reçus, de la forme de celui d'une app (contrats 2.4) : les colonnes et les types de ceux de GFS, sans corbeille ; `spec(table)` donne la déclaration d'une table reçue.
export const RECEIVED_MANIFEST = Object.freeze({ id: RECEIVED_APP, nom: FILES_MANIFEST.nom, integre: true });
const FILES_SPEC = FILES_MANIFEST.fichiers[0];
const spec = table => ({ ...FILES_SPEC, table, corbeille: null });

const flag = (data, column, i) => Array.isArray(data[column]) && data[column][i] === true;

export const PENDING = 'pending';
export const ACCEPTED = 'accepted';
export const REFUSED = 'refused';

// L'état d'une arrivée d'après ses deux marques : un refus passe devant un accord (une ligne marquée des deux n'est pas un cas que GFS écrit, mais que l'envoyeur ne peut pas produire non plus).
export const stateOf = ({ accepted, refused }) => (refused ? REFUSED : accepted ? ACCEPTED : PENDING);

// Les fichiers d'une table reçue, tous états confondus : { …fichier de l'explorateur, key, received: { table, row, state, gone } }. La clé porte la table (deux partages peuvent citer un même identifiant) ;
// `gone` : le fichier est retiré chez l'envoyeur, la copie reste ici (réception « en archive »).
export function readReceived(table, data) {
  const files = applyFiling(readFiles(RECEIVED_MANIFEST, spec(table), data), null); // sans rangement : le texte de la recherche seul
  const byRow = new Map((data && Array.isArray(data.id) ? data.id : []).map((row, i) => [row, i]));
  return files.map(file => {
    const i = byRow.get(file.row);
    const state = stateOf({ accepted: flag(data, ACCEPTED_COLUMN, i), refused: flag(data, REFUSED_COLUMN, i) });
    return { ...file, key: fileKey(RECEIVED_APP, `${table}:${file.id}`), received: { table, row: file.row, state, gone: flag(data, ARCHIVE_COLUMN, i) } };
  });
}

// Sans « Partagés avec moi » (les essais de l'explorateur seul) : aucune arrivée à répondre, aucun geste de plus.
export const NO_RECEIVED = Object.freeze({ openAs: () => null, menu: () => null, activate: () => {} });

// Un fichier reçu et accepté : il se lit (js/kept-files.js).
export const isAcceptedReceived = file => Boolean(file && file.received && file.received.state === ACCEPTED);

// Ce que « Partagés avec moi » montre : les arrivées pas refusées.
export const shownReceived = files => files.filter(file => file.received.state !== REFUSED);
export const pendingOf = files => files.filter(file => file.received.state === PENDING);

// Lit toutes les tables reçues du document (`tables` : leurs noms, ou null quand la liste n'a pu être lue). Une table illisible est dite par la console et ne cache pas les autres. Rend les fichiers à plat.
export async function loadReceived(port, tables) {
  const found = tables ? receivedTables(tables) : [];
  const files = [];
  for (const table of found) {
    try { files.push(...readReceived(table, await port.doc.fetchTable(table))); } catch (error) { console.warn(`GFS : la table reçue ${table} est illisible`, error); }
  }
  return files;
}

// La réponse à une arrivée : les deux marques écrites sur sa ligne, relue juste avant (la ligne a pu disparaître : le moteur la remet à la mise à jour suivante, la réponse est alors dite sans rien écrire).
// Une table reçue plus ancienne n'a pas les colonnes : elles sont ajoutées avant d'être écrites (une seule colonne inconnue annulerait tout le lot, contrats 6.1, point 3). Rend `true` quand la marque est posée.
export async function answerFile(port, file, accepted) {
  const { table, row } = file.received;
  const own = new OwnTable({ port, name: table, columns: MARK_COLUMNS, consent: async () => false });
  const seen = await own.load();
  if (!seen.exists || !seen.data.id.includes(row)) return false;
  await own.existing([ACCEPTED_COLUMN, REFUSED_COLUMN]);
  await port.doc.applyUserActions([['UpdateRecord', own.id, row, { [ACCEPTED_COLUMN]: accepted, [REFUSED_COLUMN]: !accepted }]]);
  return true;
}
