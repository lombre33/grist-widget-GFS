// Le poids dans l'explorateur (demande du porteur, 04/11 : « estimer le poids de chaque élément », une instance de Grist limitant l'ensemble des documents à 15 Go). Des fonctions sans effet de bord,
// sans bibliothèque. Ce qui a été lu dans Grist et mesuré (octet exact de `dbstat`, pièces jointes, historique) est dans docs/faits-verifies.md, section 32.
//
// Le poids d'un fichier est une ESTIMATION faite avec ce que GFS a déjà lu : les octets des cellules de sa ligne, comme SQLite les garde, plus, pour un fichier qui EST une pièce jointe (un PDF de
// GFS), la taille de cette pièce. Sur un vrai Grist 1.7.19 elle s'écarte de moins de 1 % pour de gros textes (les modèles de Publipostage+) et davantage pour de toutes petites lignes (SQLite y ajoute
// un en-tête : −16 % sur des lignes de 38 octets). Elle ne compte ni l'historique des actions de Grist, ni les pages libres du fichier : ce n'est pas la taille du fichier du document.
// Rien n'est écrit dans le document : le poids se recalcule à chaque lecture des fichiers.

const SKIPPED = new Set(['id', 'manualSort']);

// Les octets d'un texte en UTF-8, sans le copier : un modèle de Publipostage+ pèse des Mo, et `TextEncoder` en ferait une copie de plus. Une paire de substitution (4 octets) compte 2 + 2.
export function utf8Length(text) {
  const length = text.length;
  let bytes = length;
  for (let i = 0; i < length; i++) {
    const code = text.charCodeAt(i);
    if (code > 0x7f) bytes += code > 0x7ff && (code < 0xd800 || code > 0xdfff) ? 2 : 1;
  }
  return bytes;
}

// Les octets que SQLite met dans la ligne pour un entier : 1 à 8, selon sa grandeur.
const integerBytes = value => {
  const size = Math.abs(value);
  return size < 128 ? 1 : size < 32768 ? 2 : size < 2 ** 23 ? 3 : size < 2 ** 31 ? 4 : size < 2 ** 47 ? 6 : 8;
};

// Les octets d'une cellule, comme Grist la range : un texte en UTF-8, un entier de 1 à 8 octets, un flottant 8, un booléen 1, rien 0 ; une liste (`['L', 3, 5]`) ou une valeur codée, leur JSON
// (Grist range la liste sans son `L`).
export function cellBytes(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'string') return utf8Length(value);
  if (typeof value === 'boolean') return 1;
  if (typeof value === 'number') return Number.isInteger(value) ? integerBytes(value) : 8;
  return utf8Length(JSON.stringify(Array.isArray(value) && value[0] === 'L' ? value.slice(1) : value) ?? '');
}

// Le calcul des octets d'une ligne d'une table lue (`{ id: [..], <colonne>: [..] }`) : la somme de ses cellules, toutes colonnes lues comprises sauf `id` et `manualSort` (le rang, que Grist
// garde à part). Rend `i -> octets` : les colonnes sont choisies une fois pour toute la table.
export function rowWeigher(data) {
  const columns = Object.keys(data || {}).filter(name => !SKIPPED.has(name) && Array.isArray(data[name])).map(name => data[name]);
  return i => {
    let total = 0;
    for (const column of columns) total += cellBytes(column[i]);
    return total;
  };
}

const cellOf = (data, column, i) => (column && Array.isArray(data[column]) ? data[column][i] : undefined);

// Les numéros des pièces jointes d'une cellule `['L', 3, 5]` (rien d'autre n'en est une).
export const attachmentIds = value => (Array.isArray(value) && value[0] === 'L' ? value.slice(1).filter(Number.isInteger) : []);

// La pièce jointe qu'un fichier EST (contrats 2.4, `poids.pieces` : { colonne, taille }, les colonnes de la pièce jointe et de sa taille) : [[clé, taille]], ou [] quand le manifeste ne dit rien ou que
// la cellule n'en cite aucune. La clé nomme la pièce (un fichier copié cite la même : une somme la compte une fois) ; une taille absente compte pour zéro.
export function piecesOf(rule, data, i) {
  const spec = rule && rule.pieces;
  if (!spec || !data) return [];
  const [id] = attachmentIds(cellOf(data, spec.colonne, i));
  const size = Number(cellOf(data, spec.taille, i));
  return id === undefined ? [] : [[String(id), Number.isFinite(size) && size > 0 ? size : 0]];
}

// Les sommes : une pièce jointe citée par plusieurs fichiers n'est comptée qu'une fois. `file` : { weight, pieces } (js/explorer-model.js). Le total d'un dossier se construit fichier par fichier,
// sans refaire la somme de tous (la liste d'un dossier le demande à chaque ouverture).
export const newSum = () => ({ bytes: 0, seen: null });

export function addWeight(sum, file) {
  sum.bytes += file.weight;
  for (const [key, size] of file.pieces) {
    if (!sum.seen) sum.seen = new Set();
    if (sum.seen.has(key)) sum.bytes -= size; else sum.seen.add(key);
  }
  return sum;
}

export const sumWeights = files => files.reduce(addWeight, newSum()).bytes;

const formats = new Map();
const numberFormat = (locale, digits) => {
  const key = `${locale}|${digits}`;
  if (!formats.has(key)) formats.set(key, new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }));
  return formats.get(key);
};

const UNITS = ['weight.o', 'weight.ko', 'weight.mo', 'weight.go'];
const DIGITS = [0, 0, 1, 2];

// « 6 o », « 47 Ko », « 2,2 Mo », « 1,87 Go » (1 Ko = 1 024 octets, comme Windows et le reste de GFS) : jamais plus de trois chiffres avant la virgule, pour tenir dans une colonne étroite.
// `t` donne l'unité dans la langue (`weight.o` à `weight.go`), `locale` le séparateur décimal.
export function formatBytes(bytes, locale, t) {
  let value = Math.max(0, Number(bytes) || 0);
  let unit = 0;
  while (unit < UNITS.length - 1 && value >= 999.5) { value /= 1024; unit += 1; }
  return t(UNITS[unit], { n: numberFormat(locale, DIGITS[unit]).format(value) });
}
