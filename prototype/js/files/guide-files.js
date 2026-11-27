// Les guides des démarches, vus comme des fichiers de l'explorateur (module Guide, demande du porteur du 27/11 : « le guide aussi comme un type de fichier,
// avec de l'héritage et des sous-démarches comme l'annuaire »). Ils vivent dans la table `GFS_Guides` que GFS crée avec l'accord de la personne
// (js/guide/guide-store.js) ; ce module est tout ce que le reste de GFS en sait, sans charger le module Guide (qui ne se charge qu'au premier clic) : le
// manifeste « intégré » qui les fait lister par l'explorateur comme les fichiers d'une app, et la clé du guide dans l'explorateur et le rangement. Du code sans
// effet de bord.

export const GUIDES_APP = 'gfs-guides';
export const GUIDES_TABLE = 'GFS_Guides';
export const GUIDE_TYPE = 'guide';

const bilingual = (fr, en) => Object.freeze({ fr, en });

// Le manifeste de ces fichiers, de la forme de celui d'une app (contrats 2.4, 2.7) : le fichier est la ligne du guide (son numéro, `id`, en est l'identifiant),
// son nom est la colonne `Name` ; l'auteur est celui que Grist écrit (`GFS_Author`, js/sharing/sharing-model.js) quand le partage a étendu la table.
// `integre` : il est dans le code de GFS, hors du catalogue des apps.
export const GUIDES_MANIFEST = Object.freeze({
  id: GUIDES_APP,
  nom: bilingual('Guide', 'Guide'),
  integre: true,
  fichiers: Object.freeze([Object.freeze({
    table: GUIDES_TABLE,
    colonnes: Object.freeze({ id: 'id', nom: 'Name', par: 'GFS_Author' }),
    typeParDefaut: GUIDE_TYPE,
    types: Object.freeze([Object.freeze({ valeur: GUIDE_TYPE, nom: bilingual('Guide', 'Guide'), icone: 'guide', couleur: 'guide' })]),
  })]),
});

// La forme que la lecture des fichiers attend pour une app installée (`{ manifest }`, js/explorer/explorer-data.js).
export const GUIDES_ENTRY = Object.freeze({ manifest: GUIDES_MANIFEST });

// La clé d'un guide dans l'explorateur, le rangement et le partage : `gfs-guides:<numéro de ligne>`.
export const guideKey = row => `${GUIDES_APP}:${row}`;
