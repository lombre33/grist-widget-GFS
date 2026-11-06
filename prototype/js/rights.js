// Les droits tels que Grist les range, lus pour le panneau « Permissions » et le pied de GFS (contrats 11.4 point 7 ; 11.9 point 8). Du code sans effet de bord : il reçoit les lignes des tables
// internes de Grist et en tire des mots. Il ne pose rien (étape 7) et ne parle jamais des tables de données : elles relèvent de Grist seul (11.1, point 2).
//
// Les règles d'accès sont dans `_grist_ACLResources` (la table ou la colonne visée) et `_grist_ACLRules` (la condition, les droits, la note). GFS note chaque règle qu'il pose « GFS : <niveau> » :
// c'est ce qui permet de relire, plus tard, quel niveau une table porte, et de ne jamais prendre pour sienne une règle que la personne a écrite à la main.

import { exposureOf, rowsOf } from './publication.js';

// Du plus ouvert au plus fermé : le mot d'un ensemble de tables est celui de la moins fermée.
export const LEVELS = Object.freeze(['ouvert', 'autre', 'partage', 'encadre']);
const GFS_NOTE = /^\s*GFS\s*:\s*(.+?)\s*$/i;
const plain = text => String(text ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Le niveau que la note d'une règle annonce, ou null quand la note n'est pas de GFS ou ne dit pas un niveau connu.
export function levelOfNote(memo) {
  const found = GFS_NOTE.exec(String(memo ?? ''));
  if (!found) return null;
  const word = plain(found[1]).split(/[\s·,;:(]/)[0];
  return word === 'partage' || word === 'encadre' || word === 'ouvert' ? word : null;
}

const isDefaultResource = resource => !resource || (!resource.tableId && !resource.colIds);

// La règle que Grist crée avec tout document : « tout le monde peut tout » sur la ressource par défaut, sans condition. Ce n'est pas une règle de la personne.
function isBuiltIn(rule, resource) {
  if (!isDefaultResource(resource) || String(rule.aclFormula || '').trim() || rule.aclColumn) return false;
  const text = String(rule.permissionsText || '').trim();
  return text === '' ? Number(rule.permissions) === 63 : !text.includes('-');
}

// Les règles de la personne (et de GFS), chacune avec sa table : [{ id, tableId, colIds, formula, rights, note, level }]. `tableId` vaut '' pour la ressource par défaut et '*' pour « toutes les tables ».
export function userRules(resources, rules) {
  const byId = new Map(resources.map(resource => [resource.id, resource]));
  return rules.filter(rule => !isBuiltIn(rule, byId.get(rule.resource))).map(rule => {
    const resource = byId.get(rule.resource) || {};
    return { id: rule.id, tableId: String(resource.tableId || ''), colIds: String(resource.colIds || ''), formula: String(rule.aclFormula || ''), rights: String(rule.permissionsText || ''), note: String(rule.memo || ''), level: levelOfNote(rule.memo) };
  });
}

// La structure est fermée aux éditeurs (11.4, point 5) : une règle sur la ressource par défaut, qui retire `S` à qui n'est pas propriétaire.
// Mesuré (Grist 1.7.19) : la ressource que l'interface de Grist écrit pour « toutes les tables » est `*` / `*` ; celle que Grist crée avec un document neuf (vide / vide) n'est qu'un reste, et une règle
// posée dessus ne ferme rien. GFS écrit sur `*` / `*` et lit les deux (une règle écrite à la main peut être sur l'une ou l'autre).
const isAllTables = rule => rule.tableId === '' || (rule.tableId === '*' && (rule.colIds === '*' || rule.colIds === ''));
const structureOnly = rights => /^[-+]S$/.test(String(rights).trim());
export function structureClosed(rules) {
  return rules.some(rule => isAllTables(rule) && /-[A-Z]*S/.test(rule.rights) && /^user\.Access\s*(!=\s*OWNER|not\s+in\s*\[\s*OWNER\s*\])$/.test(rule.formula.trim()));
}

// Le niveau de chaque table donnée : le plus fermé des niveaux que GFS a noté sur ses règles ; `autre` quand elle porte des règles que GFS n'a pas posées (ou que la note ne décrit pas) ;
// `ouvert` sans règle. Une règle sur « toutes les tables » (`*`) compte pour chacune.
export function tableLevels(rules, tableIds) {
  return new Map(tableIds.map(tableId => {
    const mine = rules.filter(rule => (rule.tableId === tableId || rule.tableId === '*') && !structureOnly(rule.rights));
    const noted = mine.map(rule => rule.level).filter(level => level && level !== 'ouvert');
    if (noted.length) return [tableId, noted.includes('encadre') ? 'encadre' : 'partage'];
    return [tableId, mine.length ? 'autre' : 'ouvert'];
  }));
}

// Le mot du pied (11.4, point 7) : `pas` (Pas protégé), `partie` (Protégé en partie), `protege` (Protégé : Encadré partout ET structure fermée), `autre` (des règles que GFS n'a pas posées),
// ou null quand il n'y a aucune table de GFS ni d'app à juger. Il ne se calcule que sur les règles qu'un propriétaire a lues (js/rights-control.js) : mesuré le 04/11 sur Grist 1.7.19, dès qu'une
// règle refuse la lecture d'une table à une personne, `_grist_ACLRules` et `_grist_ACLResources` lui arrivent vides (et la table disparaît de ses tables) ; une lecture vide ne dit donc rien.
export function wordOf(levels, closed) {
  if (!levels.size) return null;
  const lowest = Math.min(...[...levels.values()].map(level => LEVELS.indexOf(level)));
  const level = LEVELS[lowest];
  if (level === 'ouvert') return 'pas';
  if (level === 'autre') return 'autre';
  if (level === 'partage') return 'partie';
  return closed ? 'protege' : 'partie';
}

// Les tables dont le pied parle : celles de GFS (`GFS_…`) et celles des apps (leur préfixe, sans casse ni accent), jamais celles de la personne.
export function ownedTables(tableIds, prefixes) {
  const starts = ['gfs_', ...prefixes.filter(Boolean).map(plain)];
  return tableIds.filter(tableId => !/^_grist_/i.test(tableId) && starts.some(prefix => plain(tableId).replace(/[^a-z0-9_]/g, '_').startsWith(prefix)));
}

// Les mots du pied et du panneau pour un état des règles (`RightsReader.rules()`) : la clé du texte du mot, et celle de sa phrase.
export const chipKey = rules => (rules && rules.readable && rules.word ? `rights.chip.${rules.word}` : 'rights.chip.none');
export function leadKey(rules) {
  if (!rules || !rules.readable) return rules && rules.reason === 'owner-only' ? 'rights.lead.ownerOnly' : (rules && rules.reason === 'unknown' ? 'rights.lead.unknown' : 'rights.lead.unreadable');
  return rules.word ? `rights.lead.${rules.word}` : 'rights.lead.none';
}

const parse = text => {
  try { const value = JSON.parse(text || '{}'); return value && typeof value === 'object' ? value : {}; } catch { return {}; }
};

// Tous les partages du document (11.9, point 8), publiés par GFS ou par l'interface de Grist. `meta` : les lignes de `_grist_Shares` (shares), `_grist_Pages` (pages), `_grist_Views` (views),
// `_grist_Views_section`, `_grist_Views_section_field`, `_grist_Tables` et `_grist_Tables_column`. Pour chacun : ses pages, ce que ses formulaires publiés laissent écrire (colonnes montrées ou non)
// et lire, et celles de ces tables qui sont protégées (`isProtected`). La clé du lien (`linkId`) n'est jamais lue ici : elle ne sort pas de ce code.
export function linksOf(meta, isProtected) {
  const viewName = new Map(meta.views.map(view => [view.id, view.name]));
  return meta.shares.map(share => {
    const pages = meta.pages.filter(page => page.shareRef === share.id);
    const views = new Set(pages.map(page => page.viewRef));
    const sections = meta.sections.filter(section => views.has(section.parentId));
    const { writes, reads } = exposureOf({ tables: meta.tables, columns: meta.columns, fields: meta.fields, sections });
    const filled = [...writes.values()].map(entry => ({ tableId: entry.tableId, shown: entry.columns.filter(colId => entry.shown.has(colId)), unshown: entry.columns.filter(colId => !entry.shown.has(colId)) }));
    const readable = [...reads.values()].map(({ tableId, colId }) => ({ tableId, colId }));
    const open = [...new Set([...filled.map(entry => entry.tableId), ...readable.map(entry => entry.tableId)])].filter(isProtected);
    return { id: share.id, published: Boolean(parse(share.options).publish), pages: pages.map(page => viewName.get(page.viewRef) || ''), filled, readable, protectedOpen: open };
  });
}

export { rowsOf };
