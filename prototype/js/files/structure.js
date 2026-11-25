// Le numéro de structure du document (contrats 6.4, point 16) : un entier que GFS note dans une ligne réservée de `GFS_Filing` (`@document` / `gfs` /
// `structure`, la valeur en JSON dans `Value` : `{ "structure": 1 }`) quand la personne fait un geste qui écrit dans cette table. Il dit quelle forme GFS a
// donnée à ses tables dans CE document ; une version de GFS plus ancienne que ce numéro ne l'écrit plus (« document plus récent ») au lieu de le défaire.
//
// Le numéro monte quand une version change ce qu'une version plus ancienne ne sait ni relire ni ignorer (une colonne renommée, une ligne dont le sens change,
// un format qui n'est plus lisible). Un ajout seul (une colonne, une ligne, une clé de plus) ne le monte pas : les changements restent additifs (6.1, point 3).
// Du code sans effet de bord, sans dépendance : la lecture et l'écriture de la ligne sont dans rangement.js.

export const STRUCTURE = 1;
export const STRUCTURE_ROW = Object.freeze({ User: '@document', App: 'gfs', File: 'structure' });

// Le numéro que dit la valeur de la ligne (déjà lue en JSON), ou null : pas de ligne, valeur illisible, numéro qui n'est pas un entier de 1 ou plus.
export function structureFrom(raw) {
  const isObject = raw !== null && typeof raw === 'object' && !Array.isArray(raw);
  return isObject && Number.isInteger(raw.structure) && raw.structure >= 1 ? raw.structure : null;
}

// Ce que dit le numéro lu : 'unmarked' (rien de noté : un document d'avant, ou que GFS n'a pas encore écrit), 'older' (une version plus ancienne l'a noté),
// 'current', ou 'newer' (une version plus récente que celle-ci l'a noté : GFS lit, n'écrit pas).
export function verdictOf(found) {
  if (found === null || found === undefined) return 'unmarked';
  return found > STRUCTURE ? 'newer' : (found < STRUCTURE ? 'older' : 'current');
}

export const isNewer = found => verdictOf(found) === 'newer';

// La valeur à écrire dans la ligne : celle qu'elle avait (un objet), avec le numéro de cette version ; ce qu'une version plus récente y a ajouté se garde
// (contrats 6.5, point 4).
export function stamped(raw) {
  const kept = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return { ...kept, structure: STRUCTURE };
}

// Une écriture de GFS dans un document qu'une version plus récente a préparé : refusée, la table n'est pas touchée.
export class DocumentNewer extends Error {
  code = 'GFS_DOCUMENT_PLUS_RECENT';
  constructor(found) {
    super(`Ce document a été préparé par une version plus récente de GFS (structure ${found}, celle-ci connaît la ${STRUCTURE}).`);
    this.structure = found;
  }
}
