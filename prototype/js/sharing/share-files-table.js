// La table des fichiers de GFS (`GFS_Files`) pour relier un document qui n'a encore aucun PDF. Le moteur de partage du kit (kit/js/synchro/) écrit ses
// colonnes d'aide (id_sync, MajLe, RecalculLe) dans la table de l'export et ne la crée jamais : sans elle, il lisait des colonnes nulles et le lien échouait
// (« can't access property "some", cols is null », retour du porteur du 25/11, docs.getgrist.com). Relier deux documents sans fichier (« Gérer les partages >
// Autres documents > Relier un document… ») nomme pourtant cette table dans sa condition (js/sharing/share-links.js, `selectionFor`) : un document sans PDF
// doit
// donc la recevoir, vide, avant que le moteur ne la prépare.
// L'accord de la personne est celui de la fenêtre du lien : elle dit, avant « Continuer », que la table naît quand le document n'en a pas (`so.accord.files`),
// et ne rien créer avant ce geste est ce que garde `exists` (il lit seulement). Une table qui existe déjà n'est pas touchée.
import { OwnTable } from '../files/own-table.js';
import { filesColumns, filesNames } from '../files/gfs-files.js';

// `docApi` : `grist.docApi`. `exists()` : le document a-t-il la table (rien n'est créé) ; `ensure()` : la table est là, créée vide si elle manquait (rend vrai
//   quand elle vient de naître).
export function filesTableOf(docApi) {
  const own = new OwnTable({ port: { doc: docApi }, name: filesNames().table, columns: filesColumns(), consent: async () => true });
  return {
    exists: async () => (await own.load()).exists,
    ensure: async () => Boolean((await own.ready()).created),
  };
}
