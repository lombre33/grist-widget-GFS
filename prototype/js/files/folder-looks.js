// L'apparence d'un dossier de « Moi » : une couleur, une icône ou un émoji que la personne lui donne (étude du 27/11, choix du porteur : l'émoji se choisit
// dans la fenêtre « Apparence », jamais dans le nom). Elle se garde là où se garde déjà le dossier : la ligne d'état du dossier dans `GFS_Filing` (ni app ni
// fichier, contrats 6.4 point 11), dans `Value`, en JSON `{ "look": { "color", "glyph", "emoji" } }`. Aucune table ni colonne de plus ; renommer ou déplacer un
// dossier change `Folder` sur cette même ligne (js/files/rangement.js, `movedActions`), donc l'apparence suit le dossier. Un dossier qui n'a pas de ligne en
// reçoit une au premier choix (il est alors « gardé » : il ne disparaît plus quand on le vide). Ce module ne touche pas à Grist : il lit les lignes et rend les
// actions à écrire.
//
// `color` : un des COLORS (des teintes de la charte, js/theme/ambiance-types.js, rien de neuf), `glyph` : un des GLYPHS (un repère dessiné dans le dossier,
//   js/ui/icons-looks.js), `emoji` : un seul émoji, qui prend la place de l'icône (le repère n'est alors pas gardé). Une valeur illisible ou inconnue est
//   ignorée, jamais effacée : le dossier garde son aspect d'origine.

import { normalizePath } from '../explorer/explorer-model.js';

export const COLORS = Object.freeze(['gray', 'red', 'orange', 'green', 'teal', 'blue', 'purple']);
export const GLYPHS = Object.freeze(['star', 'flag', 'heart', 'house', 'case', 'calendar', 'image', 'book', 'box', 'euro', 'tag', 'bulb']);

const text = value => (typeof value === 'string' ? value : '');
const cell = (data, column, i) => (data && Array.isArray(data[column]) ? data[column][i] : undefined);

// Un émoji : une lettre, un chiffre ou un signe de ponctuation n'en est pas un (comme dans Grist : un chiffre au début d'un nom reste un chiffre).
const EMOJI = /^(?:\p{RI}\p{RI}|(?:[#*0-9]️?⃣)|\p{Extended_Pictographic}(?:\p{EMod}|️⃣?|[\u{E0020}-\u{E007E}]+\u{E007F})?(?:‍\p{Extended_Pictographic}(?:\p{EMod}|️)?)*)$/u;

// Le premier « caractère » (graphème) du texte, ou '' : « 🧾 Factures » donne « 🧾 », « 👨‍👩‍👧 » reste entier.
export function firstGrapheme(value) {
  const source = text(value).trim();
  if (!source) return '';
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const first = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(source)[Symbol.iterator]().next();
    return first.done ? '' : first.value.segment;
  }
  return Array.from(source)[0] || '';
}

// L'émoji que dit ce texte (un seul, rien d'autre autour), ou '' : ce n'est pas un émoji.
export function cleanEmoji(value) {
  const source = text(value).trim();
  return source && firstGrapheme(source) === source && EMOJI.test(source) ? source : '';
}

// Une apparence nettoyée : { color?, glyph?, emoji? } avec seulement ce qui est connu ; null quand il ne reste rien. L'émoji passe devant le repère.
export function cleanLook(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const look = {};
  if (COLORS.includes(value.color)) look.color = value.color;
  const emoji = cleanEmoji(value.emoji);
  if (emoji) look.emoji = emoji;
  else if (GLYPHS.includes(value.glyph)) look.glyph = value.glyph;
  return Object.keys(look).length ? look : null;
}

export const sameLook = (a, b) => {
  const left = cleanLook(a) || {};
  const right = cleanLook(b) || {};
  return left.color === right.color && left.glyph === right.glyph && left.emoji === right.emoji;
};

function parse(value) {
  try {
    const found = JSON.parse(value);
    return found && typeof found === 'object' && !Array.isArray(found) ? found : null;
  } catch (error) {
    return null;
  }
}

// L'apparence que dit la cellule `Value` d'une ligne d'état, ou null.
export const lookOfValue = value => { const found = parse(text(value)); return found ? cleanLook(found.look) : null; };

// Les apparences des dossiers de la personne `identity` d'après le rangement (la table telle que `fetchTable` la rend, ou null) : une Map chemin -> apparence.
// Seules comptent les lignes d'état de dossier (ni app ni fichier) ; plusieurs lignes pour un même chemin : la première qui dit quelque chose fait foi.
export function readFolderLooks(data, identity = '') {
  const found = new Map();
  const rows = data && Array.isArray(data.id) ? data.id : [];
  rows.forEach((rowId, i) => {
    const user = text(cell(data, 'User', i));
    if (user !== identity || user.startsWith('@') || text(cell(data, 'App', i)) || text(cell(data, 'File', i))) return;
    const path = normalizePath(cell(data, 'Folder', i));
    const look = path && !found.has(path) ? lookOfValue(cell(data, 'Value', i)) : null;
    if (look) found.set(path, look);
  });
  return found;
}

// La valeur de la cellule avec `look` posé (ou retiré) : le reste de ce que la cellule disait (d'autres clés, s'il y en a un jour) est gardé ; '' quand il ne
// reste rien.
function valueWith(current, look) {
  const kept = parse(text(current)) || {};
  delete kept.look;
  if (look) kept.look = look;
  return Object.keys(kept).length ? JSON.stringify(kept) : '';
}

// La cellule `Value` d'une ligne d'état neuve qui porte `look` (null ou rien de connu : ''), pour un dossier que Ctrl+Z rend avec son apparence.
export const lookValue = look => valueWith('', cleanLook(look));

// Les actions qui donnent l'apparence `look` (null : l'aspect d'origine) au dossier `path`, d'après la table relue `ctx` ({ data, tableId, identity }). La
// ligne d'état du dossier est mise à jour ; sans ligne, une est ajoutée (sauf pour rétablir : rien à écrire). Le chemin est celui du dossier, normalisé.
export function lookActions({ data, tableId, identity }, path, look) {
  const folder = normalizePath(path);
  const next = cleanLook(look);
  const rows = (data && Array.isArray(data.id) ? data.id : []).filter((rowId, i) => text(cell(data, 'User', i)) === identity && !text(cell(data, 'App', i)) &&
    !text(cell(data, 'File', i)) && normalizePath(cell(data, 'Folder', i)) === folder);
  if (rows.length) {
    return rows.map(rowId => ['UpdateRecord', tableId, rowId, { Value: valueWith(cell(data, 'Value', data.id.indexOf(rowId)), next) }]);
  }
  return next && folder ? [['AddRecord', tableId, null, { User: identity, App: '', File: '', Favorite: false, Folder: folder, Value: valueWith('', next) }]] :
    [];
}
