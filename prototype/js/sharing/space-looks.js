// L'apparence d'un espace partagé (étude du 27/11, lot 2 : couleur, icône ou émoji d'un espace, comme celle d'un dossier de « Moi », js/files/folder-looks.js).
// Elle est à tous les membres de l'espace (c'est l'espace qui est colorié, pas la vue d'une personne) : elle se garde donc dans la table des espaces
// (`GFS_Spaces`), sur la ligne de l'espace, dans la colonne `Style`, en JSON `{ "look": { "color", "glyph", "emoji" } }` (la même forme que la cellule `Value`
// d'un dossier de « Moi »). Les règles de la table (js/sharing/sharing-model.js, `spaceRules`) disent déjà qui lit et qui écrit : les propriétaires du document
// tiennent les espaces, ceux qui y ont accès les lisent, les autres ne les voient pas. Aucune règle de plus. L'apparence suit l'espace (sa clé ne change pas
// quand on le renomme) et part avec lui.
//
// La colonne n'existe pas dans un document d'avant : elle est ajoutée au premier choix, avec l'accord de la personne (`consent`), seule, avant l'écriture
// (jamais écrire une colonne absente : une seule annule le lot). Ce module ne rend rien à l'écran ; il rend le résultat de l'écriture.

import { cleanLook, lookValue } from '../files/folder-looks.js';
import { SPACES_TABLE } from './sharing-model.js';
import { STYLE } from './spaces-filing.js';

// Écrit l'apparence `look` (null : l'aspect d'origine) de l'espace `key`. `doc` : les interfaces brutes de Grist ; `consent()` : une promesse, true quand la
// personne accepte que la colonne `Style` soit ajoutée à `GFS_Spaces`. Rend 'done' (écrit, ou rien à écrire), 'declined' (l'accord est refusé : rien n'a
// changé) ou 'missing' (cet espace n'est plus dans la table).
export async function writeSpaceLook({ doc, key, look, consent }) {
  const table = await doc.fetchTable(SPACES_TABLE);
  const ids = Array.isArray(table.id) ? table.id : [];
  const at = ids.findIndex((rowId, i) => Array.isArray(table.Key) && table.Key[i] === key);
  if (at < 0) return 'missing';
  if (!Array.isArray(table[STYLE])) {
    if (!cleanLook(look)) return 'done'; // rien à rétablir : l'espace n'a jamais eu d'apparence
    if (!(await consent())) return 'declined';
    await doc.applyUserActions([['AddColumn', SPACES_TABLE, STYLE, { type: 'Text' }]]);
  }
  await doc.applyUserActions([['UpdateRecord', SPACES_TABLE, ids[at], { [STYLE]: lookValue(look) }]]);
  return 'done';
}
