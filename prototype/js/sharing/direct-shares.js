// « Partagés avec moi », ce que des personnes m'ont donné par mon adresse (contrats 11.7, point 13, lot 4c ; choix du porteur, 11/11) : un fichier est
// « donné » à la personne quand son droit vient d'une ligne de partage à son adresse, sur le fichier ou sur un dossier d'espace, écrite par quelqu'un d'autre.
// Grist le calcule pour chaque fichier (`GFS_Directs` : « adresse>auteur du partage », js/sharing/sharing-model.js) ; ni un groupe, ni une catégorie
// (« éditeurs », « tous »), ni la racine, ni un espace entier n'y comptent : ceux-là ont leur espace. Un fichier déjà rangé dans un espace que la personne voit
// reste dans cet espace.

const lower = value => String(value ?? '').trim().toLowerCase();

// Une liste de Grist : ['L', …] (une cellule d'un type quelconque), un tableau simple, ou son texte JSON (la lecture légère des gros documents,
// js/explorer/explorer-sql.js).
export function listOf(value) {
  let items = value;
  if (typeof value === 'string' && value.startsWith('[')) { try { items = JSON.parse(value); } catch (error) { items = []; } }
  return Array.isArray(items) ? (items[0] === 'L' ? items.slice(1) : items) : [];
}

// L'adresse d'une personne qui n'a pas pu l'apprendre par la sonde du rangement (un lecteur n'écrit rien dans le document) : les lignes de partage qu'elle lit
// sont celles qui la visent (« chacun lit les partages qui le concernent », js/sharing/sharing-model.js, `shareRules`) ; si une seule adresse de personne y
// figure, c'est la sienne. Plusieurs (elle administre un fichier d'autres personnes) ou aucune : on ne devine pas. `rows` : les lignes de `GFS_Partages`.
export function addressFromShares(rows) {
  const found = new Set((rows || []).map(row => lower(row.PersonneL || row.Personne)).filter(who => who && !who.startsWith('@') && !who.startsWith('#')));
  return found.size === 1 ? [...found][0] : '';
}

// Pose `direct: { by }` sur les fichiers donnés à `identity` (son adresse) ; `data` : la table de fichiers telle que `fetchTable` la rend, avec sa colonne
// `GFS_Directs` (un document sans partage n'en a pas : rien n'est posé). Rend la liste des fichiers.
export function applyDirect(files, data, identity) {
  const me = lower(identity);
  if (!me || !data || !Array.isArray(data.id) || !Array.isArray(data.GFS_Directs)) return files;
  const at = new Map(data.id.map((row, i) => [row, i]));
  for (const file of files) {
    if (file.space) continue;
    const mine = listOf(data.GFS_Directs[at.get(file.row)]).map(String).find(item => item.startsWith(`${me}>`));
    if (mine) file.direct = { by: mine.slice(me.length + 1) };
  }
  return files;
}

// Les fichiers à montrer dans « Partagés avec moi » : ceux qui sont donnés, avec celui qui les a donnés dans `by` (la colonne « Par »).
export const directFiles = files => files.filter(file => file.direct).map(file => ({ ...file, by: file.direct.by }));

// Un fichier donné et jamais rangé par la personne ne s'ajoute pas à ses dossiers : il est là où il a été donné.
export const keptInFolder = file => !(file.direct && file.folder === '');
