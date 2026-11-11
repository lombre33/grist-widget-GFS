// Partager un DOSSIER avec un autre document Grist (« Partager… » sur un dossier > « Dans un autre document Grist » ; choix du porteur, 11/11 : « un seul lien
// par document »). Un dossier n'est pas dans `GFS_Fichiers` (le rangement est ailleurs, js/rangement.js) : partager un dossier, c'est partager les PDF qui y
// sont, dans la condition du lien déjà fait avec ce document, en donnant à chacun le nom du dossier dans une colonne de plus de `GFS_Fichiers`
// (`Dossier_partage`, js/gfs-files.js) que le moteur envoie avec le fichier. Chez l'autre, les fichiers de même nom forment un dossier
// (js/received-folders.js).
//   - le niveau du dossier est le niveau de TOUS ses fichiers (js/share-links.js, `levelOf`) : « Copie à jour » = tous dans la condition, « Une partie » =
//   certains seulement (un fichier partagé ou retiré à part) ;
//   - seuls les PDF de GFS partent (le premier lot du partage entre documents) ; les sous-dossiers et les fichiers d'une app ne partent pas encore ;
//   - un fichier ne porte qu'UN nom de dossier : le dernier écrit, qui RESTE quand le dossier s'arrête (effacé à la sortie de la condition, le nom vide partait
//   chez l'autre avec l'archive de la copie : mesuré,
//     labo/run-partager-dossier.mjs) ; un fichier qui repart seul plus tard garde donc le nom de son dernier dossier partagé ;
//   - la colonne est écrite AVANT la condition : le moteur ne compose ses colonnes que d'après ce que la table porte au moment de l'enregistrement.
import { FILES_APP, FILES_COLUMNS, FILES_TABLE, SHARED_FOLDER_COLUMN } from './gfs-files.js';
import { OwnTable } from './own-table.js';

// Les fichiers d'un dossier qui peuvent partir : les PDF de GFS rangés dans ce dossier même, ni à la corbeille, ni reçus d'un autre document, ni donnés par une
// adresse.
export const filesOfFolder = (files, path) => (files || []).filter(file => file.app === FILES_APP && !file.trashed && !file.received && !file.direct &&
  file.folder === path);

// Les fichiers du dossier qui ne partent pas (ceux d'une app : le premier lot du partage entre documents ne couvre que les PDF de GFS) : leur nombre, pour le
// dire à la personne.
export const skippedInFolder = (files, path, sent) => (files || []).filter(file => file.folder === path && !file.trashed && !file.received && !file.direct &&
  !(sent || []).includes(file)).length;

// L'objet que la fenêtre « Partager » reçoit pour un dossier (js/share-control.js, `folderFile`) : un chemin, jamais une app (un fichier de l'explorateur a
// toujours la sienne).
export const isFolderTarget = target => Boolean(target) && typeof target.path === 'string' && !target.app;

// Le nom que les fichiers portent chez l'autre : le dernier mot du chemin.
export const folderLabel = path => String(path || '').split('/').filter(Boolean).pop() || '';

const columns = [...FILES_COLUMNS, { id: SHARED_FOLDER_COLUMN, type: 'Text' }];

// Écrit `name` sur les lignes `rows` de GFS_Fichiers, la colonne ajoutée d'abord si elle manque (une colonne absente annulerait tout le lot). Rend le nombre de
// lignes écrites (0 : la table n'est plus là).
export async function writeFolderName(docApi, rows, name) {
  if (!rows.length) return 0;
  const own = new OwnTable({ port: { doc: docApi }, name: FILES_TABLE, columns, consent: async () => false });
  const state = await own.existing([SHARED_FOLDER_COLUMN]);
  if (!state) return 0;
  const known = rows.filter(row => state.data.id.includes(row));
  if (known.length) await docApi.applyUserActions([['BulkUpdateRecord', own.id, known, { [SHARED_FOLDER_COLUMN]: known.map(() => name) }]]);
  return known.length;
}
