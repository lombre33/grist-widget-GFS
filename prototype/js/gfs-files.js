// Les fichiers que GFS garde lui-même (contrats 6.6) : les PDF. Ils vivent dans la table `GFS_Fichiers` du document (une ligne par fichier, le PDF en pièce jointe Grist), et ce
// module est tout ce que GFS en sait sans toucher à Grist : le manifeste « intégré » qui les fait lister par l'explorateur comme ceux d'une app, les colonnes de la table, les
// règles de nom (un nom est pris sans tenir compte de la casse ni des espaces ; une copie s'appelle « Nom (1).pdf »), l'identifiant d'un fichier et l'enregistrement qu'on écrit.
// Du code sans effet de bord.

export const FILES_APP = 'gfs-fichiers';
export const FILES_TABLE = 'GFS_Fichiers';
export const PDF_TYPE = 'pdf';
export const PDF_EXTENSION = '.pdf';
export const PDF_MIME = 'application/pdf';

// Les colonnes de la table. `Identifiant` est le nom du fichier pour GFS (rangement, liens) : il ne change jamais, ni au renommage ni au remplacement, et n'est pas le numéro de ligne,
// que Grist réutilise après une suppression. `Contenu` : la pièce jointe. `Origine` : d'où vient le fichier (« import » ; plus tard le nom de l'app qui l'a rangé).
// `SupprimeLe` et `SupprimePar` : la corbeille (contrats 6.6, point 7). Un fichier à la corbeille garde sa ligne, marquée de la date et de l'auteur du geste ; la pièce jointe reste citée,
// Grist ne l'efface pas. Un document dont la table est plus ancienne reçoit ces deux colonnes au premier fichier mis à la corbeille.
export const FILES_COLUMNS = Object.freeze([
  { id: 'Identifiant', type: 'Text' }, { id: 'Nom', type: 'Text' }, { id: 'Type', type: 'Text' }, { id: 'Date', type: 'DateTime:UTC' }, { id: 'Auteur', type: 'Text' },
  { id: 'Contenu', type: 'Attachments' }, { id: 'Taille', type: 'Int' }, { id: 'Origine', type: 'Text' }, { id: 'SupprimeLe', type: 'DateTime:UTC' }, { id: 'SupprimePar', type: 'Text' },
].map(column => Object.freeze(column)));
export const FILES_COLUMN_IDS = Object.freeze(FILES_COLUMNS.map(column => column.id));
export const TRASH_COLUMN_IDS = Object.freeze(['SupprimeLe', 'SupprimePar']);

const bilingual = (fr, en) => Object.freeze({ fr, en });

// Le manifeste de ces fichiers, de la forme de celui d'une app (contrats 2.4, 2.7) : l'explorateur les lit comme les autres, avec les mêmes colonnes déclarées. `integre` : il est dans
// le code de GFS, hors du catalogue des apps (rien à installer, aucun cadre, aucune permission à donner).
export const FILES_MANIFEST = Object.freeze({
  id: FILES_APP,
  nom: bilingual('GFS', 'GFS'),
  integre: true,
  fichiers: Object.freeze([Object.freeze({
    table: FILES_TABLE,
    colonnes: Object.freeze({ id: 'Identifiant', nom: 'Nom', type: 'Type', date: 'Date', par: 'Auteur' }),
    // `corbeille` : les deux colonnes qui disent qu'un fichier est à la corbeille (la date du geste, son auteur). Sans cette clé, le manifeste d'une app n'a pas de corbeille de cette forme.
    corbeille: Object.freeze({ date: 'SupprimeLe', par: 'SupprimePar' }),
    typeParDefaut: PDF_TYPE,
    types: Object.freeze([Object.freeze({ valeur: PDF_TYPE, nom: bilingual('PDF', 'PDF'), icone: 'pdf', couleur: 'neutre' })]),
  })]),
  actions: Object.freeze({
    importer: Object.freeze([Object.freeze({ valeur: PDF_TYPE, type: PDF_TYPE, nom: bilingual('PDF', 'PDF'), extensions: Object.freeze([PDF_EXTENSION]) })]),
  }),
});

// La forme que la lecture des fichiers attend pour une app installée (`{ manifest }`, js/explorer-data.js).
export const FILES_ENTRY = Object.freeze({ manifest: FILES_MANIFEST });

// Un nom est pris quand un autre lui est égal, casse et espaces autour ignorés (la règle de Publipostage+, `Templates.sameName`).
export const sameName = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

const isPdfName = name => name.toLowerCase().endsWith(PDF_EXTENSION);

// Le nom d'un fichier tel que GFS le garde : sans blancs autour, avec son « .pdf » (celui qui efface l'extension en renommant la retrouve). Vide quand il ne reste aucun nom.
export function cleanName(text) {
  const name = String(text ?? '').trim();
  const stem = isPdfName(name) ? name.slice(0, -PDF_EXTENSION.length).trim() : name;
  if (!stem) return '';
  return isPdfName(name) ? name : `${name}${PDF_EXTENSION}`;
}

// Le nom d'une copie : « Facture.pdf » devient « Facture (1).pdf », ou (2), (3)… au premier numéro libre parmi les noms `taken`. Un numéro déjà au bout du nom est remplacé, jamais empilé
// (« Facture (1).pdf » devient « Facture (2).pdf », pas « Facture (1) (1).pdf »). `extension: false` : le nom n'a pas d'extension (le nom d'un modèle d'une app : « Modèle 2.1 » reste « Modèle 2.1 (1) »).
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

// Les valeurs communes d'un enregistrement : la date en secondes (c'est ce que Grist garde d'une colonne DateTime), l'auteur (l'adresse de la personne, ou rien tant que GFS ne la connaît pas).
const stamp = ({ now, author, size }) => ({ Date: Math.floor(now / 1000), Auteur: author || '', Taille: size });

// Un nouveau fichier : la ligne à ajouter. `attachment` : le numéro de la pièce jointe que Grist a rendu à l'envoi.
export const newRecord = ({ id, name, attachment, size, author, now, origin }) => ({
  Identifiant: id, Nom: name, Type: PDF_TYPE, Contenu: ['L', attachment], Origine: origin, ...stamp({ now, author, size }),
});

// Un fichier remplacé : le même fichier (même identifiant, même nom, donc même place et mêmes favoris), un autre contenu.
export const replacementRecord = ({ attachment, size, author, now, origin }) => ({ Contenu: ['L', attachment], Origine: origin, ...stamp({ now, author, size }) });

// Mettre un fichier à la corbeille : la date du geste (en secondes) et son auteur. Sortir de la corbeille : les deux colonnes se vident, le fichier est tel qu'il était.
export const trashRecord = ({ now, author }) => ({ SupprimeLe: Math.floor(now / 1000), SupprimePar: author || '' });
export const restoreRecord = () => ({ SupprimeLe: null, SupprimePar: '' });
