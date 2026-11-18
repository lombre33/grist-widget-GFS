// Les règles d'accès des tables techniques du partage entre documents (audit de sécurité du 09/11, choix du porteur : « Les fermer comme les fichiers »). Le
// moteur de partage range dans le document des morceaux de PDF, les clés qui signent les envois et les versions reçues : `GFS_Synchro` (celui qui envoie) et
// `GFS_Journal_*` (celui qui reçoit, un par réception). Sans règle, toute personne qui ouvre le document les lit, y compris un PDF qu'elle n'avait pas le droit
// de lire par fichier (js/sharing/sharing-model.js).
//   - `GFS_Synchro` : réservée aux propriétaires (lecture, écriture, effacement) ;
//   - un journal : réservé aux propriétaires pour lire, modifier, effacer ; la création reste ouverte, c'est par elle que le formulaire de réception y écrit
//   (mesuré : labo/run-securite-synchro.mjs).
// Les règles portent la note « GFS : Partages · … » comme celles des fichiers : le pied les dit « Encadré », « Retirer le partage » les retire avec les autres.
// Une table qui porte déjà une règle d'un autre auteur est laissée. Du code sans effet de bord : il reçoit les lignes des tables internes et rend les actions à
// écrire ; la lecture et l'écriture sont à `closeSharingTables`.
// La structure du document se ferme avec elles quand la fenêtre de liaison se ferme (`structure`, choix du porteur, 18/11 : « Oui, dans la même question »).
// Sans cela, un éditeur supprime la table `GFS_Synchro` ou le journal, change une colonne d'aide, et le partage s'arrête sans avis (audit « trois Grist »).
// Une seule fois par table protégée : la reprise à l'ouverture (js/sharing/sync-resume.js) ne referme jamais ce qu'un propriétaire a rouvert.

import { isSharingNote } from './sharing-model.js';
import { rowsOf } from '../rights/rights.js';
import { withStructureClosed } from '../rights/rights-plan.js';

export const SYNC_TABLE = 'GFS_Synchro';
const JOURNAL = /^GFS_Journal_/;
// La même note que js/sharing/sharing-model.js (`isSharingNote` la reconnaît : essai unitaire).
const NOTE = 'GFS : Partages · ';

export const isJournal = tableId => JOURNAL.test(String(tableId));
export const isTechnical = tableId => tableId === SYNC_TABLE || isJournal(tableId);

// Les règles voulues d'une table technique, dans l'ordre : les propriétaires, puis le reste refusé.
export function technicalRules(tableId) {
  const journal = isJournal(tableId);
  return [
    { formula: 'user.Access in [OWNER]', rights: '+CRUD', memo: `${NOTE}les propriétaires gardent la main` },
    journal
      ? { formula: '', rights: '-RUD', memo: `${NOTE}un journal reçu ne se lit qu’avec les droits de propriétaire ; le formulaire y ajoute` }
      : { formula: '', rights: '-CRUD', memo: `${NOTE}la table technique du partage est réservée aux propriétaires` },
  ];
}

const maxId = rows => rows.reduce((top, row) => Math.max(top, Number(row.id) || 0), 0);
const same = (rules, wanted) => rules.length === wanted.length && rules.every((rule, at) => String(rule.aclFormula || '') === wanted[at].formula &&
  String(rule.permissionsText || '') === wanted[at].rights);

// Ce qu'il y a à écrire : { ok: true, actions, tables } ou { ok: false, reason } : 'none' (aucune table technique), 'already' (tout est posé), 'foreign'
// (toutes celles qui restent portent la règle d'un autre auteur).
// `existing` : { resources, rules, tables } (les lignes de _grist_ACLResources, _grist_ACLRules, _grist_Tables). `structure` : ferme aussi la structure, dans
//   la même écriture, quand des tables se protègent à cet appel (`closes: true` dans le plan quand elle ne l'était pas déjà).
export function planTechnicalRules(existing, { structure = false } = {}) {
  const technical = existing.tables.map(row => String(row.tableId)).filter(isTechnical);
  if (!technical.length) return { ok: false, reason: 'none' };
  const resourceOf = new Map(existing.resources.map(resource => [resource.id, resource]));
  const onTable = tableId => existing.rules.filter(rule => (resourceOf.get(rule.resource) || {}).tableId === tableId).sort((a, b) => (a.rulePos || 0) -
    (b.rulePos || 0));
  const todo = []; let foreign = 0;
  for (const tableId of technical) {
    const here = onTable(tableId);
    const mine = here.filter(rule => isSharingNote(rule.memo));
    if (here.length > mine.length) { foreign += 1; continue; }
    if (!same(mine, technicalRules(tableId))) todo.push({ tableId, mine });
  }
  if (!todo.length) return { ok: false, reason: foreign ? 'foreign' : 'already' };
  const actions = [];
  // Des règles de GFS d'avant, différentes : elles partent avec leurs ressources vides, puis les bonnes se posent.
  const dropped = todo.flatMap(entry => entry.mine);
  if (dropped.length) {
    const gone = new Set(dropped.map(rule => rule.id));
    const emptied = [...new Set(dropped.map(rule => rule.resource))].filter(id => !existing.rules.some(rule => rule.resource === id && !gone.has(rule.id)));
    actions.push(['BulkRemoveRecord', '_grist_ACLRules', [...gone]], ...(emptied.length ? [['BulkRemoveRecord', '_grist_ACLResources', emptied]] : []));
  }
  let resource = maxId(existing.resources);
  let id = maxId(existing.rules);
  for (const { tableId } of todo) {
    resource += 1;
    actions.push(['AddRecord', '_grist_ACLResources', resource, { tableId, colIds: '*' }]);
    technicalRules(tableId).forEach((one, at) => actions.push(['AddRecord', '_grist_ACLRules', (id += 1),
      { resource, aclFormula: one.formula, permissionsText: one.rights, rulePos: at + 1, memo: one.memo }]));
  }
  const plan = { ok: true, actions, tables: todo.map(entry => entry.tableId) };
  return structure ? withStructureClosed(existing, plan) : plan;
}

// Pose les règles qui manquent. À n'appeler que par un propriétaire que GFS a prouvé tel (`transfer.isOwner() === true`, jamais deviné) : Grist recharge alors
// le document, comme pour toute règle d'accès. Rend { changed, tables } ; sans effet (et sans bruit) quand rien n'est à poser. Un échec d'écriture est dit en
// avertissement, jamais levé : le partage, lui, continue. `structure` : voir `planTechnicalRules` (seule la fermeture de la fenêtre de liaison la demande).
export async function closeSharingTables({ docApi, structure = false }) {
  try {
    const [resources, rules, tables] = await Promise.all(['_grist_ACLResources', '_grist_ACLRules',
      '_grist_Tables'].map(async name => rowsOf(await docApi.fetchTable(name))));
    const plan = planTechnicalRules({ resources, rules, tables }, { structure });
    if (!plan.ok) return { changed: false, tables: [] };
    await docApi.applyUserActions(plan.actions);
    return { changed: true, tables: plan.tables, ...(plan.closes ? { closes: true } : {}) };
  } catch (error) {
    console.warn('GFS : les règles des tables du partage entre documents ne se posent pas', error);
    return { changed: false, tables: [] };
  }
}
