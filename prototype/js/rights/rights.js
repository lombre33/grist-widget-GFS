// Les droits tels que Grist les range (contrats 11.4). Du code sans effet de bord : il reçoit les lignes des tables internes de Grist et en tire des niveaux.
// Il ne pose rien et ne parle jamais des tables de données : elles relèvent de Grist seul (11.1, point 2). Le mot du pied et le panneau « Permissions » qui
// s'en servaient ont disparu (12 et 13/11) ; les niveaux restent ceux que lisent les essais du partage.
//
// Les règles d'accès sont dans `_grist_ACLResources` (la table ou la colonne visée) et `_grist_ACLRules` (la condition, les droits, la note). GFS note chaque
// règle qu'il pose « GFS : <niveau> » : c'est ce qui permet de relire, plus tard, quel niveau une table porte, et de ne jamais prendre pour sienne une règle
// que la personne a écrite à la main.

import { rowsOf } from '../broker/publication.js';

const GFS_NOTE = /^\s*GFS\s*:\s*(.+?)\s*$/i;
const plain = text => String(text ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Le niveau que la note d'une règle annonce, ou null quand la note n'est pas de GFS ou ne dit pas un niveau connu.
export function levelOfNote(memo) {
  const found = GFS_NOTE.exec(String(memo ?? ''));
  if (!found) return null;
  const word = plain(found[1]).split(/[\s·,;:(]/)[0];
  // « GFS : Partages · … » (les règles de « Partager », js/sharing/sharing-model.js) : les tables de fichiers et de partages sont encadrées, par la liste de
  // ceux qui lisent chaque fichier.
  if (word === 'partages') return 'encadre';
  return word === 'partage' || word === 'encadre' || word === 'ouvert' ? word : null;
}

const isDefaultResource = resource => !resource || (!resource.tableId && !resource.colIds);

// La règle que Grist crée avec tout document : « tout le monde peut tout » sur la ressource par défaut, sans condition. Ce n'est pas une règle de la personne.
function isBuiltIn(rule, resource) {
  if (!isDefaultResource(resource) || String(rule.aclFormula || '').trim() || rule.aclColumn) return false;
  const text = String(rule.permissionsText || '').trim();
  return text === '' ? Number(rule.permissions) === 63 : !text.includes('-');
}

// Les règles de la personne (et de GFS), chacune avec sa table : [{ id, tableId, colIds, formula, rights, note, level }]. `tableId` vaut '' pour la ressource
// par défaut et '*' pour « toutes les tables ».
export function userRules(resources, rules) {
  const byId = new Map(resources.map(resource => [resource.id, resource]));
  return rules.filter(rule => !isBuiltIn(rule, byId.get(rule.resource))).map(rule => {
    const resource = byId.get(rule.resource) || {};
    return { id: rule.id, tableId: String(resource.tableId || ''), colIds: String(resource.colIds || ''), formula: String(rule.aclFormula || ''),
      rights: String(rule.permissionsText || ''), note: String(rule.memo || ''), level: levelOfNote(rule.memo) };
  });
}

// La structure est fermée aux éditeurs (11.4, point 5) : une règle sur la ressource par défaut, qui retire `S` à qui n'est pas propriétaire. Mesuré (Grist
// 1.7.19) : la ressource que l'interface de Grist écrit pour « toutes les tables » est `*` / `*` ; celle que Grist crée avec un document neuf (vide / vide)
// n'est qu'un reste, et une règle posée dessus ne ferme rien. GFS écrit sur `*` / `*` et lit les deux (une règle écrite à la main peut être sur l'une ou
// l'autre).
const isAllTables = rule => rule.tableId === '' || (rule.tableId === '*' && (rule.colIds === '*' || rule.colIds === ''));
const structureOnly = rights => /^[-+]S$/.test(String(rights).trim());
export function structureClosed(rules) {
  return rules.some(rule => isAllTables(rule) && /-[A-Z]*S/.test(rule.rights) &&
    /^user\.Access\s*(!=\s*OWNER|not\s+in\s*\[\s*OWNER\s*\])$/.test(rule.formula.trim()));
}

// Le niveau de chaque table donnée : le plus fermé des niveaux que GFS a noté sur ses règles ; `autre` quand elle porte des règles que GFS n'a pas posées (ou
// que la note ne décrit pas) ; `ouvert` sans règle. Une règle sur « toutes les tables » (`*`) compte pour chacune.
export function tableLevels(rules, tableIds) {
  return new Map(tableIds.map(tableId => {
    const mine = rules.filter(rule => (rule.tableId === tableId || rule.tableId === '*') && !structureOnly(rule.rights));
    const noted = mine.map(rule => rule.level).filter(level => level && level !== 'ouvert');
    if (noted.length) return [tableId, noted.includes('encadre') ? 'encadre' : 'partage'];
    return [tableId, mine.length ? 'autre' : 'ouvert'];
  }));
}

export { rowsOf };
