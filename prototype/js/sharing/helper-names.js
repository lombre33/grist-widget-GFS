// Les colonnes d'aide que le partage pose sur les tables de fichiers (js/sharing/sharing-model.js) : leurs noms d'arrivée (anglais, ceux que GFS écrit) et ceux
// d'avant (français), que porte encore une table que Sync+ tient (décision du porteur, 25/11 : elle garde ses noms, colonnes comprises) ou un document que la
// mise à jour n'a pas encore atteint. Les huit autres (`GFS_Ids`, `GFS_Calc`, `GFS_Admins`, `GFS_Cats`) ont le même nom des deux côtés.
//
// Tout le code de GFS parle anglais. Deux endroits seulement connaissent le français :
//   - à la lecture, `aliased` donne à une table lue ses colonnes d'aide sous leur nom d'arrivée (la colonne d'avant garde aussi le sien) ;
//   - à l'écriture, `inSet` met en français le texte d'une formule, d'une règle ou d'un nom de colonne quand la table qu'on complète est restée sous les noms
//     d'avant : jamais deux colonnes pour la même chose, jamais une règle qui lit une colonne absente.
// Du code sans effet de bord.

export const HELPER_BEFORE = Object.freeze({
  GFS_Author: 'GFS_Auteur', GFS_Folder: 'GFS_Dossier', GFS_Readers: 'GFS_Lecteurs', GFS_Writers: 'GFS_Ecrivains', GFS_Denied: 'GFS_Refus',
  GFS_CatsWrite: 'GFS_CatsEcrit', GFS_Direct: 'GFS_Directs', GFS_Seen: 'GFS_Vus',
});
const HELPER_AFTER = Object.freeze(Object.fromEntries(Object.entries(HELPER_BEFORE).map(([after, before]) => [before, after])));
const lower = value => String(value ?? '').toLowerCase();
const FRENCH = new Map(Object.entries(HELPER_AFTER).map(([before, after]) => [lower(before), after]));
const ENGLISH = new Set(Object.keys(HELPER_BEFORE).map(lower));
const TO_FRENCH = new RegExp(`\\b(${Object.keys(HELPER_BEFORE).join('|')})\\b`, 'g');

// Sous quels noms une table porte-t-elle ses colonnes d'aide ? `'fr'` : au moins une colonne d'avant et aucune d'arrivée ; `'en'` sinon (aucune colonne
// d'aide, les nouvelles, ou un mélange : GFS n'en continue pas moins sous les noms d'arrivée).
export function helperSetOf(columnIds) {
  const ids = (columnIds || []).map(lower);
  return ids.some(id => FRENCH.has(id)) && !ids.some(id => ENGLISH.has(id)) ? 'fr' : 'en';
}

// Un texte (le nom d'une colonne, une formule Python, une règle) dans le jeu de noms de la table : en français, chaque nom d'arrivée devient celui d'avant ;
// en anglais, rien ne change.
export const inSet = (text, set) => (set === 'fr' && typeof text === 'string' ? text.replace(TO_FRENCH, name => HELPER_BEFORE[name]) : text);

// Les actions qui mettent les colonnes d'aide d'une table au nom d'arrivée : `RenameColumn` pour chaque colonne d'avant dont la colonne d'arrivée n'existe pas.
export function helperRenames(table, columnIds) {
  const have = new Set((columnIds || []).map(lower));
  return (columnIds || []).filter(id => FRENCH.has(lower(id)) && !have.has(lower(FRENCH.get(lower(id))))).map(id =>
    ['RenameColumn', table, id, FRENCH.get(lower(id))]);
}

// La table lue (`{ id: [..], <colonne>: [..] }`) avec ses colonnes d'aide sous leur nom d'arrivée, en plus de celles d'avant : le reste du code ne lit que les
// noms d'arrivée. Rend la table elle-même quand elle n'a rien d'avant (pas de copie).
export function aliased(data) {
  if (!data || typeof data !== 'object') return data;
  const old = Object.keys(data).filter(key => FRENCH.has(lower(key)) && !Object.keys(data).some(other => lower(other) === lower(FRENCH.get(lower(key)))));
  if (!old.length) return data;
  return { ...data, ...Object.fromEntries(old.map(key => [FRENCH.get(lower(key)), data[key]])) };
}

// Les colonnes voulues d'une lecture légère, avec leur nom d'avant à côté de celui d'arrivée : la table lue peut les porter sous l'un ou l'autre.
export const wantedBoth = wanted => (wanted ? [...new Set(wanted.flatMap(id => [id, HELPER_BEFORE[id]].filter(Boolean)))] : wanted);
