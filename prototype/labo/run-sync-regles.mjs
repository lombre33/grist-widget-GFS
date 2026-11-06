// Les règles d'accès de GFS et celles du moteur de Sync+ dans le MÊME document, jouées dans un VRAI serveur Grist (`bash vrai-serveur.sh`) : étude « Partager un dossier avec un autre document », mesure 2.
// Les règles de Sync+ sont écrites par ses propres fonctions (`js/logic/acl.js`, dépôt `lombre33/grist-widget-one-way-sync`, cloné à part : SYNC_PLUS_DIR) ; celles de GFS par ses plans (`js/rights-plan.js`).
// Les deux ordres sont joués : GFS puis Sync+, Sync+ puis GFS. On regarde ce que Grist accepte, où chacun range ses règles, si l'un retire celles de l'autre, et si chacun reste idempotent.
//   SYNC_PLUS_DIR=/chemin/vers/grist-widget-one-way-sync node run-sync-regles.mjs
import { pathToFileURL } from 'node:url';
import { chromium, say, check } from './lab-common.mjs';
import { requireServer, newContext, createDocument, docIdOf } from './lab-serveur.mjs';
import { apply, records } from './lab-droits.mjs';
import { COLUMNS } from '../js/rangement.js';
import { planShared, planCloseStructure, planOpenStructure, planRemoveLevel } from '../js/rights-plan.js';

const dir = process.env.SYNC_PLUS_DIR;
if (!dir) { say('SYNC_PLUS_DIR : le dossier du dépôt de Sync+ (cloné à part).'); process.exit(2); }
const load = file => import(pathToFileURL(`${dir}/js/logic/${file}`).href);
const [acl, common] = await Promise.all([load('acl.js'), load('common.js')]);

const flat = rows => rows.map(row => ({ id: row.id, ...row.fields }));
const state = async (page, id) => {
  const [resources, rules, tables, columns] = await Promise.all(['_grist_ACLResources', '_grist_ACLRules', '_grist_Tables', '_grist_Tables_column'].map(async name => flat(await records(page, id, name))));
  return { resources, rules, tables, columns };
};
const describe = ({ resources, rules }) => rules.slice().sort((a, b) => (Number(a.rulePos) || 0) - (Number(b.rulePos) || 0)).map(rule => {
  const resource = resources.find(each => each.id === rule.resource) || {};
  return `${String(rule.rulePos ?? '').padStart(4)} ${(resource.tableId || '') + '/' + (resource.colIds || '')} :: ${rule.aclFormula || '(toujours)'} → ${rule.permissionsText} :: ${rule.memo || ''}`.slice(0, 190);
});
const byAuthor = rules => ({ gfs: rules.filter(rule => /^\s*GFS\s*:/i.test(rule.memo || '')).length, sync: rules.filter(rule => acl.isWidgetRule(rule)).length, others: rules.filter(rule => rule.memo && !/^\s*GFS\s*:/i.test(rule.memo) && !acl.isWidgetRule(rule)).length });

const EXPORT_ID = 'a1b2c3d4e5f60718';
const JOURNAL = `${common.JOURNAL_PREFIX}${EXPORT_ID}`;
const RECEIVED = 'Recus_essai';
const syncWanted = () => [...acl.publicAclRules([EXPORT_ID], { keepDeny: true }), ...acl.ownerAclRules([]), ...acl.journalAclRules([JOURNAL]), ...acl.lockAclRules([RECEIVED])];

async function build(page) {
  const path = await createDocument(page);
  const id = docIdOf(path);
  const text = names => names.map(name => ({ id: name, type: 'Text' }));
  const syncColumns = [common.EXPORT_COL, common.TABLE_COL, common.TYPE_COL, common.SCHEMA_COL, common.RESEND_COL, common.LIST_COL, common.LOT_COL, common.AUTHOR_COL, common.STATE_COL];
  const status = await apply(page, id, [
    ['AddTable', 'GFS_Rangement', COLUMNS.map(column => ({ ...column }))],
    ['AddTable', common.SYNC_TABLE, text(syncColumns)],
    ['AddTable', JOURNAL, text([common.STATE_COL])],
    ['AddTable', RECEIVED, text(['Nom'])],
  ]);
  check('le document d\'essai est créé (GFS_Rangement, Synchro, un journal, une table reçue)', status === 200, status);
  return id;
}

async function poseGfs(page, id, label) {
  let existing = await state(page, id);
  const shared = planShared(existing);
  check(`${label} : GFS peut poser Partagé`, shared.ok === true, shared);
  if (shared.ok) check(`${label} : Partagé s'écrit (200)`, (await apply(page, id, shared.actions)) === 200);
  existing = await state(page, id);
  const closing = planCloseStructure(existing);
  check(`${label} : GFS peut fermer la structure`, closing.ok === true, closing);
  if (closing.ok) check(`${label} : la fermeture s'écrit (200)`, (await apply(page, id, closing.actions)) === 200);
}

async function poseSync(page, id, label) {
  const existing = await state(page, id);
  const actions = acl.aclActions(existing.resources, existing.rules, syncWanted());
  check(`${label} : Sync+ a des règles à poser`, actions.length > 0, actions.length);
  check(`${label} : Grist accepte la liasse de Sync+ (200)`, (await apply(page, id, actions)) === 200);
  const after = await state(page, id);
  check(`${label} : Sync+ est idempotent (rien à poser une 2e fois)`, acl.aclActions(after.resources, after.rules, syncWanted()).length === 0);
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const pluginApi = await requireServer();
  for (const order of ['gfs-puis-sync', 'sync-puis-gfs']) {
    say(`\n=== Ordre : ${order} ===`);
    const context = await newContext(browser, pluginApi);
    const page = await context.newPage();
    const id = await build(page);
    if (order === 'gfs-puis-sync') { await poseGfs(page, id, 'GFS'); await poseSync(page, id, 'puis Sync+'); } else { await poseSync(page, id, 'Sync+'); await poseGfs(page, id, 'puis GFS'); }
    let now = await state(page, id);
    say('Règles, dans l\'ordre de Grist :'); describe(now).forEach(line => say('  ' + line));
    const counts = byAuthor(now.rules);
    check('GFS : 6 règles de Partagé + 1 de structure ; Sync+ : toutes les siennes ; aucune règle d\'un tiers', counts.gfs === 7 && counts.sync === syncWanted().length && counts.others === 0, counts);
    const mineBefore = JSON.stringify(now.rules.filter(rule => acl.isWidgetRule(rule)).map(rule => [rule.memo, rule.aclFormula, rule.permissionsText]));
    check('GFS ne voit rien à retirer de Sync+ : « Retirer Partagé » ne touche que « GFS : »', (() => { const plan = planRemoveLevel(now); return plan.ok && plan.actions[0][2].every(ruleId => /^\s*GFS\s*:/i.test((now.rules.find(rule => rule.id === ruleId) || {}).memo || '')); })());
    const removal = planRemoveLevel(now);
    if (removal.ok) check('« Retirer Partagé » s\'écrit (200)', (await apply(page, id, removal.actions)) === 200);
    const open = planOpenStructure(await state(page, id));
    if (open.ok) check('« Rouvrir la structure » s\'écrit (200)', (await apply(page, id, open.actions)) === 200);
    now = await state(page, id);
    check('après les retraits de GFS, les règles de Sync+ sont intactes (même texte, même ordre)', JSON.stringify(now.rules.filter(rule => acl.isWidgetRule(rule)).sort((a, b) => a.rulePos - b.rulePos).map(rule => [rule.memo, rule.aclFormula, rule.permissionsText])) === JSON.stringify(acl.currentRules(now.resources, now.rules).map(rule => [rule.memo, rule.aclFormula, rule.permissionsText])) && byAuthor(now.rules).gfs === 0 && byAuthor(now.rules).sync === syncWanted().length, byAuthor(now.rules));
    check('Sync+ n\'a toujours rien à reposer', acl.aclActions(now.resources, now.rules, syncWanted()).length === 0);
    void mineBefore;
    await context.close();
  }
} finally {
  await browser.close();
}
