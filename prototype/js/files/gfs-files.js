// Les fichiers que GFS garde lui-même (contrats 6.6) : les PDF. Ils vivent dans la table `GFS_Fichiers` du document (une ligne par fichier, le PDF en pièce
// jointe Grist), et ce module est tout ce que GFS en sait sans toucher à Grist : le manifeste « intégré » qui les fait lister par l'explorateur comme ceux
// d'une app, les colonnes de la table, les règles de nom (un nom est pris sans tenir compte de la casse ni des espaces ; une copie s'appelle « Nom (1).pdf »),
// l'identifiant d'un fichier et l'enregistrement qu'on écrit. Du code sans effet de bord.

export const FILES_APP = 'gfs-fichiers';
export const PDF_TYPE = 'pdf';
export const PDF_EXTENSION = '.pdf';
export const PDF_MIME = 'application/pdf';

// Les noms de la table et de ses colonnes, en deux jeux (retour n° 1 du porteur, 25/11 : tout en anglais) : `en`, ceux que GFS pose dans un document neuf ;
// `fr`, ceux d'avant, que GFS lit et écrit encore dans un document dont la table est utilisée par Sync+ (une table que Sync+ envoie ne se renomme jamais : un
// lien se romprait, faits vérifiés 160). `id` est le nom du fichier pour GFS (rangement, liens) : il ne change jamais, ni au renommage ni au remplacement, et
// n'est pas le numéro de ligne, que Grist réutilise après une suppression. `content` : la pièce jointe. `origin` : d'où vient le fichier (« import » ; plus
// tard le nom de l'app qui l'a rangé). `deletedAt` et `deletedBy` : la corbeille (contrats 6.6, point 7). Un fichier à la corbeille garde sa ligne, marquée de
// la date et de l'auteur du geste ; la pièce jointe reste citée, Grist ne l'efface pas. Un document dont la table est plus ancienne reçoit ces deux colonnes au
// premier fichier mis à la corbeille. `folder` : le nom du dossier d'un fichier partagé avec un autre document Grist (« Partager un dossier », 11/11), une
// colonne de PLUS, ajoutée par GFS au premier dossier partagé (elle n'est pas dans `filesColumns` : un document qui ne partage aucun dossier n'en a pas) ; le
// moteur de partage l'envoie avec le fichier, et l'autre document y lit le dossier (js/sharing/received-folders.js). `accepted` et `refused` : les deux marques
// d'une réception (js/sharing/received-files.js).
export const FILES_NAMES = Object.freeze({
  en: Object.freeze({ language: 'en', table: 'GFS_Files', id: 'FileId', name: 'Name', type: 'Type', date: 'Date', author: 'Author', content: 'Content',
    size: 'Size',
    origin: 'Origin', deletedAt: 'DeletedAt', deletedBy: 'DeletedBy', folder: 'SharedFolder', accepted: 'Accepted', refused: 'Refused' }),
  fr: Object.freeze({ language: 'fr', table: 'GFS_Fichiers', id: 'Identifiant', name: 'Nom', type: 'Type', date: 'Date', author: 'Auteur', content: 'Contenu',
    size: 'Taille', origin: 'Origine', deletedAt: 'SupprimeLe', deletedBy: 'SupprimePar', folder: 'Dossier_partage', accepted: 'Accepte', refused: 'Refuse' }),
});

const lower = value => String(value ?? '').toLowerCase();

// Les noms que le document utilise : une seule table de fichiers par document, sous l'un ou l'autre jeu (`useFilesNames` le dit une fois pour toutes à
// l'ouverture, après la mise à jour des noms). Sans table, ou avec les deux, l'anglais.
let current = FILES_NAMES.en;
export const filesNames = () => current;
export const useFilesNames = (names = FILES_NAMES.en) => { current = names; };
export function filesNamesOfTables(tables) {
  const have = new Set((tables || []).map(lower));
  return have.has(lower(FILES_NAMES.fr.table)) && !have.has(lower(FILES_NAMES.en.table)) ? FILES_NAMES.fr : FILES_NAMES.en;
}
// Les noms d'une table de fichiers d'après ses colonnes (une table reçue prend celles de l'envoyeur : elle peut être française dans un document anglais).
export function filesNamesOfColumns(columns) {
  const have = new Set((columns || []).map(lower));
  return have.has(lower(FILES_NAMES.fr.id)) && !have.has(lower(FILES_NAMES.en.id)) ? FILES_NAMES.fr : FILES_NAMES.en;
}

const TYPES = { id: 'Text', name: 'Text', type: 'Text', date: 'DateTime:UTC', author: 'Text', content: 'Attachments', size: 'Int', origin: 'Text',
  deletedAt: 'DateTime:UTC',
  deletedBy: 'Text' };
export const filesColumns = (names = current) => Object.freeze(Object.entries(TYPES).map(([key, type]) => Object.freeze({ id: names[key], type })));
export const filesColumnIds = (names = current) => filesColumns(names).map(column => column.id);
export const trashColumnIds = (names = current) => [names.deletedAt, names.deletedBy];

const bilingual = (fr, en) => Object.freeze({ fr, en });

// Le manifeste de ces fichiers, de la forme de celui d'une app (contrats 2.4, 2.7) : l'explorateur les lit comme les autres, avec les mêmes colonnes déclarées,
// sous les noms que le document utilise (`filesNames`). `integre` : il est dans le code de GFS, hors du catalogue des apps (rien à installer, aucun cadre,
// aucune permission à donner).
export const filesManifest = (names = current) => Object.freeze({
  id: FILES_APP,
  nom: bilingual('GFS', 'GFS'),
  integre: true,
  fichiers: Object.freeze([Object.freeze({
    table: names.table,
    colonnes: Object.freeze({ id: names.id, nom: names.name, type: names.type, date: names.date, par: names.author }),
    // `corbeille` : les deux colonnes qui disent qu'un fichier est à la corbeille (la date du geste, son auteur). Sans cette clé, le manifeste d'une app n'a
    //   pas de corbeille de cette forme.
    corbeille: Object.freeze({ date: names.deletedAt, par: names.deletedBy }),
    typeParDefaut: PDF_TYPE,
    // `poids.pieces` : le fichier EST une pièce jointe (contrats 2.4) ; son poids est celui de la pièce, que dit la colonne `size`.
    poids: Object.freeze({ pieces: Object.freeze({ colonne: names.content, taille: names.size }) }),
    types: Object.freeze([Object.freeze({ valeur: PDF_TYPE, nom: bilingual('PDF', 'PDF'), icone: 'pdf', couleur: 'pdf' })]),
  })]),
  actions: Object.freeze({
    importer: Object.freeze([Object.freeze({ valeur: PDF_TYPE, type: PDF_TYPE, nom: bilingual('PDF', 'PDF'), extensions: Object.freeze([PDF_EXTENSION]) })]),
  }),
});

// La forme que la lecture des fichiers attend pour une app installée (`{ manifest }`, js/explorer/explorer-data.js).
export const filesEntry = (names = current) => Object.freeze({ manifest: filesManifest(names) });

// Un nom est pris quand un autre lui est égal, casse et espaces autour ignorés (la règle de Publipostage+, `Templates.sameName`).
export const sameName = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

const isPdfName = name => name.toLowerCase().endsWith(PDF_EXTENSION);

// Le nom d'un fichier tel que GFS le garde : sans blancs autour, avec son « .pdf » (celui qui efface l'extension en renommant la retrouve). Vide quand il ne
// reste aucun nom.
export function cleanName(text) {
  const name = String(text ?? '').trim();
  const stem = isPdfName(name) ? name.slice(0, -PDF_EXTENSION.length).trim() : name;
  if (!stem) return '';
  return isPdfName(name) ? name : `${name}${PDF_EXTENSION}`;
}

// Le nom d'une copie : « Facture.pdf » devient « Facture (1).pdf », ou (2), (3)… au premier numéro libre parmi les noms `taken`. Un numéro déjà au bout du nom
// est remplacé, jamais empilé (« Facture (1).pdf » devient « Facture (2).pdf », pas « Facture (1) (1).pdf »). `extension: false` : le nom n'a pas d'extension
// (le nom d'un modèle d'une app : « Modèle 2.1 » reste « Modèle 2.1 (1) »).
export function freeName(name, taken, { extension: hasExtension = true } = {}) {
  const dot = hasExtension ? name.lastIndexOf('.') : -1;
  const extension = dot > 0 ? name.slice(dot) : '';
  const stem = (dot > 0 ? name.slice(0, dot) : name).replace(/\s*\(\d+\)$/, '').trim();
  for (let n = 1; ; n++) {
    const candidate = `${stem} (${n})${extension}`;
    if (!taken.some(other => sameName(other, candidate))) return candidate;
  }
}

// L'identifiant d'un nouveau fichier : douze signes hexadécimaux tirés au hasard (aucune table à interroger pour savoir s'il est libre).
export function newId(random = bytes => globalThis.crypto.getRandomValues(bytes)) {
  return Array.from(random(new Uint8Array(6)), byte => byte.toString(16).padStart(2, '0')).join('');
}

// Un PDF commence par « %PDF- » (la norme tolère quelques octets avant, jusqu'à 1 024) : un fichier renommé en .pdf n'en est pas un.
export function looksLikePdf(bytes) {
  let head = '';
  for (const byte of bytes.slice(0, 1024)) head += String.fromCharCode(byte);
  return head.includes('%PDF-');
}

// Les valeurs communes d'un enregistrement : la date en secondes (c'est ce que Grist garde d'une colonne DateTime), l'auteur (l'adresse de la personne, ou rien
// tant que GFS ne la connaît pas).
const stamp = ({ now, author, size }, names) => ({ [names.date]: Math.floor(now / 1000), [names.author]: author || '', [names.size]: size });

// Un nouveau fichier : la ligne à ajouter. `attachment` : le numéro de la pièce jointe que Grist a rendu à l'envoi.
export const newRecord = ({ id, name, attachment, size, author, now, origin }, names = current) => ({
  [names.id]: id, [names.name]: name, [names.type]: PDF_TYPE, [names.content]: ['L', attachment], [names.origin]: origin,
    ...stamp({ now, author, size }, names),
});

// Un fichier remplacé : le même fichier (même identifiant, même nom, donc même place et mêmes favoris), un autre contenu.
export const replacementRecord = ({ attachment, size, author, now, origin }, names = current) => (
  { [names.content]: ['L', attachment], [names.origin]: origin, ...stamp({ now, author, size }, names) });

// Mettre un fichier à la corbeille : la date du geste (en secondes) et son auteur. Sortir de la corbeille : les deux colonnes se vident, le fichier est tel
// qu'il était.
export const trashRecord = ({ now, author }, names = current) => ({ [names.deletedAt]: Math.floor(now / 1000), [names.deletedBy]: author || '' });
export const restoreRecord = (names = current) => ({ [names.deletedAt]: null, [names.deletedBy]: '' });
