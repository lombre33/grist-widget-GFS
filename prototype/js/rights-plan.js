// Les actions qui posent et retirent des règles d'accès (étape 7, lot a ; contrats 11.4, 11.5). Du code pur : il reçoit les lignes des tables internes de Grist (déjà lues par un propriétaire
// prouvé, js/rights-reader.js) et rend la liasse d'actions à envoyer en UNE `applyUserActions` (11.5, point 2), ou la raison de ne rien poser. Il ne touche qu'aux règles dont la note commence par
// « GFS : » et ne retire jamais celle d'un autre auteur (11.5, points 4, 5 et 7). Ce lot pose le niveau Partagé du rangement de GFS et la fermeture de la structure ; Encadré et les espaces suivent.

import { levelOfNote } from './rights.js';

export const RANGEMENT = 'GFS_Rangement';
export const NEEDED_COLUMNS = Object.freeze(['Utilisateur', 'Adresse']);
const GFS_ANY = /^\s*GFS\s*:/i;
const STRUCTURE_NOTE = 'GFS : Structure fermée · seul un propriétaire change les tables, les colonnes et les pages';
const STRUCTURE_ANY = /^\s*GFS\s*:\s*Structure/i;

export const isGfsNote = memo => GFS_ANY.test(String(memo ?? ''));
const isStructureNote = memo => STRUCTURE_ANY.test(String(memo ?? ''));
const maxId = rows => rows.reduce((top, row) => Math.max(top, Number(row.id) || 0), 0);
const isDefaultResource = resource => !resource || ((!resource.tableId || resource.tableId === '*') && (!resource.colIds || resource.colIds === '*'));

// Les six règles de Partagé pour une table de lignes par personne (11.4, point 2), de la première à la dernière ; chacune porte sa note, que Grist joint à son refus (lu, 10.2).
export function sharedRules() {
  const own = 'user.Email and rec.Utilisateur and rec.Utilisateur.lower() == user.Email.lower()';
  return [
    { formula: 'user.Access in [OWNER]', rights: '+CRUD', memo: 'GFS : Partagé · les propriétaires gardent la main' },
    { formula: 'rec.Utilisateur == "@document"', rights: '+R', memo: 'GFS : Partagé · la liste des apps du document se lit par tous' },
    { formula: own, rights: '+R', memo: 'GFS : Partagé · chacun lit son propre rangement' },
    { formula: `${own} and newRec.Utilisateur.lower() == user.Email.lower()`, rights: '+CUD', memo: 'GFS : Partagé · chacun écrit son propre rangement, jamais celui d’un autre' },
    { formula: 'rec.Utilisateur == "@sonde" and user.Email and rec.Adresse and rec.Adresse.lower() == user.Email.lower()', rights: '+CRD', memo: 'GFS : Partagé · la ligne-sonde de l’adresse' },
    { formula: '', rights: '-CRUD', memo: 'GFS : Partagé · le rangement d’une autre personne n’est pas à vous' },
  ];
}

// Les règles de la ressource `resourceId` rangées par position, avec leur ressource : la liasse qui les écrit (ressource en tête, puis les règles aux identifiants choisis).
function liasse(tableId, rules, existing) {
  const resourceId = maxId(existing.resources) + 1;
  const first = maxId(existing.rules) + 1;
  const ids = rules.map((_, at) => first + at);
  return [
    ['AddRecord', '_grist_ACLResources', resourceId, { tableId, colIds: '*' }],
    ['BulkAddRecord', '_grist_ACLRules', ids, {
      resource: rules.map(() => resourceId), aclFormula: rules.map(rule => rule.formula), permissionsText: rules.map(rule => rule.rights),
      rulePos: rules.map((_, at) => at + 1), memo: rules.map(rule => rule.memo),
    }],
  ];
}

const ruleTable = (rule, byId) => (byId.get(rule.resource) || {}).tableId || '';

// Le niveau Partagé sur le rangement. `existing` : { resources, rules, tables, columns } (lignes des tables internes). Rend { ok: true, actions, firstRule } ou { ok: false, reason } avec `reason` parmi
// 'no-table' (le rangement n'existe pas encore : Grist refuse une règle sur une table absente, 11.5 point 1), 'no-column', 'already' (déjà posé) et 'foreign' (une règle d'un autre auteur sur la table : GFS n'y touche pas).
export function planShared(existing) {
  const table = existing.tables.find(row => row.tableId === RANGEMENT);
  if (!table) return { ok: false, reason: 'no-table' };
  const columns = new Set(existing.columns.filter(column => column.parentId === table.id).map(column => column.colId));
  if (NEEDED_COLUMNS.some(colId => !columns.has(colId))) return { ok: false, reason: 'no-column' };
  const byId = new Map(existing.resources.map(resource => [resource.id, resource]));
  const onTable = existing.rules.filter(rule => ruleTable(rule, byId) === RANGEMENT);
  if (onTable.some(rule => isGfsNote(rule.memo))) return { ok: false, reason: 'already' };
  if (onTable.length) return { ok: false, reason: 'foreign' };
  const others = existing.rules.filter(rule => !isDefaultRule(rule, byId));
  return { ok: true, actions: liasse(RANGEMENT, sharedRules(), existing), firstRule: others.length === 0 };
}

const isDefaultRule = (rule, byId) => isDefaultResource(byId.get(rule.resource)) && !String(rule.aclFormula || '').trim() && (rule.permissionsText ? !String(rule.permissionsText).includes('-') : Number(rule.permissions) === 63);

// Retirer ce que GFS a posé : toutes les règles dont la note est « GFS : Partagé » ou « GFS : Encadré » (pas celle de la structure : voir `planStructure`), et la ressource qui n'en garde plus aucune.
// Rend { ok: true, actions } ou { ok: false, reason: 'none' }.
export function planRemoveLevel(existing) {
  const mine = existing.rules.filter(rule => levelOfNote(rule.memo) && levelOfNote(rule.memo) !== 'ouvert');
  if (!mine.length) return { ok: false, reason: 'none' };
  const dropped = new Set(mine.map(rule => rule.id));
  const resources = new Set(mine.map(rule => rule.resource));
  const emptied = [...resources].filter(id => !existing.rules.some(rule => rule.resource === id && !dropped.has(rule.id)));
  return { ok: true, actions: [['BulkRemoveRecord', '_grist_ACLRules', [...dropped]], ...(emptied.length ? [['BulkRemoveRecord', '_grist_ACLResources', emptied]] : [])] };
}

// Fermer la structure (11.4, point 5) : une seule règle sur la ressource « toutes les tables » (`*` / `*`, créée au besoin), `user.Access != OWNER` → `-S`. Mesuré (Grist 1.7.19) : la règle posée sur
// la ressource vide que Grist crée avec un document neuf ne ferme rien ; seule `*` / `*`, celle de l'interface de Grist, ferme la structure. Rend { ok: true, actions, firstRule } ou { ok: false, reason } :
// 'already' (déjà fermée, par GFS ou à la main).
export function planCloseStructure(existing) {
  const byId = new Map(existing.resources.map(resource => [resource.id, resource]));
  const all = existing.resources.find(resource => resource.tableId === '*' && resource.colIds === '*');
  if (existing.rules.some(rule => closesStructure(rule, byId))) return { ok: false, reason: 'already' };
  const id = maxId(existing.rules) + 1;
  const resourceId = all ? all.id : maxId(existing.resources) + 1;
  const there = existing.rules.filter(rule => rule.resource === resourceId).map(rule => Number(rule.rulePos) || 0);
  const rule = ['AddRecord', '_grist_ACLRules', id, { resource: resourceId, aclFormula: 'user.Access != OWNER', permissionsText: '-S', rulePos: (there.length ? Math.min(...there) : 2) - 1, memo: STRUCTURE_NOTE }];
  const firstRule = existing.rules.every(each => isDefaultRule(each, byId));
  return { ok: true, firstRule, actions: all ? [rule] : [['AddRecord', '_grist_ACLResources', resourceId, { tableId: '*', colIds: '*' }], rule] };
}

const closesStructure = (rule, byId) => isDefaultResource(byId.get(rule.resource)) && /^user\.Access\s*(!=\s*OWNER|not\s+in\s*\[\s*OWNER\s*\])$/.test(String(rule.aclFormula || '').trim()) && /-[A-Z]*S/.test(String(rule.permissionsText || ''));

// Rouvrir la structure : retire la règle que GFS a posée (sa note), jamais une règle écrite à la main.
export function planOpenStructure(existing) {
  const mine = existing.rules.filter(rule => isStructureNote(rule.memo));
  if (!mine.length) return { ok: false, reason: 'none' };
  const dropped = new Set(mine.map(rule => rule.id));
  const emptied = [...new Set(mine.map(rule => rule.resource))].filter(id => id !== 1 && !existing.rules.some(rule => rule.resource === id && !dropped.has(rule.id)));
  return { ok: true, actions: [['BulkRemoveRecord', '_grist_ACLRules', [...dropped]], ...(emptied.length ? [['BulkRemoveRecord', '_grist_ACLResources', emptied]] : [])] };
}

// La structure est-elle fermée par une règle de GFS (celle qu'on peut rouvrir) ?
export const structureClosedByGfs = rules => rules.some(rule => isStructureNote(rule.memo));

// Les deux lignes du bloc « Poser des règles » du panneau d'après les plans (`RightsWriter.plans()`) : chacune rend { kind | null, label, hint, why }. `kind` est le geste possible (celui que le
// bouton envoie) ; `null` veut dire grisé, avec `why` : la clé de la raison (jamais masqué, charte). Sans plans (règles illisibles), tout est grisé.
export function actionsOf(plans) {
  const none = reason => ({ kind: null, why: `rights.act.why.${reason}` });
  if (!plans) return [{ label: 'rights.act.shared', ...none('unreadable') }, { label: 'rights.act.close', ...none('unreadable') }];
  const level = plans.shared.ok ? { kind: 'shared', label: 'rights.act.shared', hint: 'rights.act.shared.hint' }
    : (plans.shared.reason === 'already' && plans['remove-level'].ok ? { kind: 'remove-level', label: 'rights.act.remove', hint: 'rights.act.remove.hint' } : { label: 'rights.act.shared', ...none(plans.shared.reason) });
  const structure = plans.close.ok ? { kind: 'close', label: 'rights.act.close', hint: 'rights.act.close.hint' }
    : (plans.close.reason === 'already' && plans.open.ok ? { kind: 'open', label: 'rights.act.open', hint: 'rights.act.open.hint' } : { label: 'rights.act.close', ...none(plans.close.reason) });
  return [level, structure];
}
