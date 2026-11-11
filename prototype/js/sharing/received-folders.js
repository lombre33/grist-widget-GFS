// Les dossiers reçus d'un autre document Grist (« Partagés avec moi », dossiers partagés ; choix du porteur, 11/11 : « le dossier, à accepter d'un coup »).
// L'envoyeur donne à chaque fichier d'un dossier partagé le nom de ce dossier (la colonne `Dossier_partage` de la table des fichiers, que le moteur envoie avec
// le fichier : js/files/gfs-files.js) ; ici, les arrivées de même nom, dans la même table reçue, forment un dossier.
//   - un dossier arrive grisé avec ses fichiers : tant qu'un d'eux attend, il est « à accepter » ; un oui les rend tous lisibles en UNE écriture
//   (`answerFolder`) ;
//   - un fichier ajouté plus tard au dossier arrive grisé, seul : le dossier redevient « à accepter » pour lui, les autres gardent leur état ;
//   - un fichier refusé seul n'est plus montré, donc ni compté ni accepté avec le dossier ; un dossier dont tous les fichiers sont refusés disparaît.
// Du code sans effet de bord ni dépendance à la lecture des tables (la réponse, qui écrit, est `answerFolder` de js/sharing/received-files.js).
import { PENDING } from './received-state.js';

// L'identifiant d'un dossier reçu : la table où il arrive et son nom (deux documents qui envoient chacun un dossier « Contrats » sont deux dossiers).
export const folderId = (table, name) => `${table}:${name}`;

const sum = (files, field) => files.reduce((total, file) => total + (Number(file[field]) || 0), 0);

// Les arrivées (celles de `shownReceived`, plus tout fichier d'ailleurs) rangées en { folders: [dossier], loose: [fichier] } : `loose` ce qui n'a pas de
// dossier. Un dossier : { id, name, table, files, count, pending (les fichiers à accepter), weight, ts (le plus récent), by (l'auteur du premier fichier qui en
// a un) }.
export function receivedFolders(files) {
  const found = new Map();
  const loose = [];
  for (const file of files) {
    const name = file.received ? file.received.folder : '';
    if (!name) { loose.push(file); continue; }
    const id = folderId(file.received.table, name);
    if (!found.has(id)) found.set(id, { id, name, table: file.received.table, files: [] });
    found.get(id).files.push(file);
  }
  const folders = [...found.values()].map(folder => ({
    ...folder, count: folder.files.length, pending: folder.files.filter(file => file.received.state === PENDING).length, weight: sum(folder.files, 'weight'),
    ts: folder.files.reduce((latest, file) => (file.ts !== null && file.ts !== undefined && (latest === null || file.ts > latest) ? file.ts : latest), null),
      by: (folder.files.find(file => file.by) || {}).by || '',
  }));
  return { folders, loose };
}
