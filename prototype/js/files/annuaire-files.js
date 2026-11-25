// Les annuaires, vus comme des fichiers de l'explorateur (module Annuaire, demande du porteur du 25/11 : « l'annuaire comme nouveau type de fichier à la racine
// de l'explorateur, des sous-annuaires rangeables dans des dossiers ou des espaces »). Ils vivent dans la table `GFS_Directories` que GFS crée avec l'accord de
// la personne (js/annuaire/annuaire-store.js) ; ce module est tout ce que le reste de GFS en sait, sans charger le module Annuaire (qui ne se charge qu'au
// premier clic) : le manifeste « intégré » qui les fait lister par l'explorateur comme les fichiers d'une app, et la cible du partage. Du code sans effet de
// bord.

export const ANNUAIRES_APP = 'gfs-annuaires';
export const ANNUAIRES_TABLE = 'GFS_Directories';
export const ANNUAIRE_TYPE = 'annuaire';
// La colonne que Grist écrit à la création d'une ligne, quand le partage a étendu la table (`STAMP`, js/sharing/sharing-model.js, qui importe ce module : la
// valeur est redite ici plutôt qu'importée).
const AUTHOR = 'GFS_Author';

const bilingual = (fr, en) => Object.freeze({ fr, en });

// Le manifeste de ces fichiers, de la forme de celui d'une app (contrats 2.4, 2.7) : le fichier est la ligne de l'annuaire (son numéro, `id`, en est
// l'identifiant : un annuaire ne se renomme pas par sa clé), son nom est la colonne `Name` ; sans date ni auteur propres, l'auteur est celui que Grist écrit
// (`GFS_Author`, js/sharing/sharing-model.js) quand le partage a étendu la table. `integre` : il est dans le code de GFS, hors du catalogue des apps.
export const ANNUAIRES_MANIFEST = Object.freeze({
  id: ANNUAIRES_APP,
  nom: bilingual('Annuaire', 'Directory'),
  integre: true,
  fichiers: Object.freeze([Object.freeze({
    table: ANNUAIRES_TABLE,
    colonnes: Object.freeze({ id: 'id', nom: 'Name', par: AUTHOR }),
    typeParDefaut: ANNUAIRE_TYPE,
    types: Object.freeze([Object.freeze({ valeur: ANNUAIRE_TYPE, nom: bilingual('Annuaire', 'Directory'), icone: 'annuaire', couleur: 'annuaire' })]),
  })]),
});

// La forme que la lecture des fichiers attend pour une app installée (`{ manifest }`, js/explorer/explorer-data.js).
export const ANNUAIRES_ENTRY = Object.freeze({ manifest: ANNUAIRES_MANIFEST });

// La clé d'un annuaire dans l'explorateur, le rangement et le partage : `gfs-annuaires:<numéro de ligne>`.
export const annuaireKey = row => `${ANNUAIRES_APP}:${row}`;

// Le fichier d'un annuaire tel que le partage le prend (js/sharing/share-control.js) quand l'explorateur n'a pas lu ses fichiers.
export const annuaireFile = ({ row, name }) => ({ key: annuaireKey(row), app: ANNUAIRES_APP, id: String(row), table: ANNUAIRES_TABLE, row, name,
  type: ANNUAIRE_TYPE,
  by: '' });
