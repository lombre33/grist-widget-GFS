// Les plans de pose (js/rights-plan.js, étape 7 lot a ; contrats 11.4, 11.5) : la liasse de Partagé, la structure fermée et rouverte, ce que GFS refuse de toucher, les gestes du panneau.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planShared, planRemoveLevel, planCloseStructure, planOpenStructure, planSharingFor, planUnsharing, sharedRules, actionsOf, RANGEMENT } from '../js/rights-plan.js';
import { userRules, structureClosed, tableLevels } from '../js/rights.js';

const BUILT_IN = { id: 1, resource: 1, permissions: 63, principals: '[1]', aclFormula: '', aclColumn: 0, permissionsText: '', rulePos: null, memo: '' };
const base = () => ({
  resources: [{ id: 1, tableId: '', colIds: '' }], rules: [{ ...BUILT_IN }],
  tables: [{ id: 5, tableId: RANGEMENT }], columns: [{ parentId: 5, colId: 'Utilisateur' }, { parentId: 5, colId: 'Adresse' }],
});
// Applique une liasse à une copie des tables internes, comme le ferait Grist (assez pour relire les règles ensuite).
function apply(existing, actions) {
  const next = { ...existing, resources: [...existing.resources], rules: [...existing.rules] };
  for (const [name, table, id, values] of actions) {
    if (name === 'AddRecord' && table === '_grist_ACLResources') next.resources.push({ id, ...values });
    if (name === 'AddRecord' && table === '_grist_ACLRules') next.rules.push({ id, ...values });
    if (name === 'BulkAddRecord') id.forEach((one, at) => next.rules.push({ id: one, ...Object.fromEntries(Object.entries(values).map(([key, list]) => [key, list[at]])) }));
    if (name === 'BulkRemoveRecord' && table === '_grist_ACLRules') next.rules = next.rules.filter(rule => !id.includes(rule.id));
    if (name === 'BulkRemoveRecord' && table === '_grist_ACLResources') next.resources = next.resources.filter(resource => !id.includes(resource.id));
  }
  return next;
}

test('Partagé : une liasse (ressource, puis six règles à identifiants choisis), la règle des propriétaires en tête, le reste en dernier', () => {
  const plan = planShared(base());
  assert.equal(plan.ok, true);
  assert.equal(plan.firstRule, true);
  const [resource, rules] = plan.actions;
  assert.deepEqual(resource, ['AddRecord', '_grist_ACLResources', 2, { tableId: RANGEMENT, colIds: '*' }]);
  assert.equal(rules[0], 'BulkAddRecord');
  assert.deepEqual(rules[2], [2, 3, 4, 5, 6, 7]);
  assert.equal(rules[3].aclFormula[0], 'user.Access in [OWNER]');
  assert.equal(rules[3].permissionsText[0], '+CRUD');
  assert.equal(rules[3].aclFormula[5], '');
  assert.equal(rules[3].permissionsText[5], '-CRUD');
  assert.deepEqual(rules[3].rulePos, [1, 2, 3, 4, 5, 6]);
  assert.ok(rules[3].resource.every(id => id === 2));
});

test('Partagé : chaque règle porte « GFS : Partagé » et GFS les relit comme les siennes', () => {
  assert.ok(sharedRules().every(rule => /^GFS : Partagé/.test(rule.memo)));
  const after = apply(base(), planShared(base()).actions);
  const found = userRules(after.resources, after.rules);
  assert.equal(found.length, 6);
  assert.ok(found.every(rule => rule.level === 'partage' && rule.tableId === RANGEMENT));
});

test('Partagé : une règle de lecture ne cite que rec ; seules celles d’écriture citent newRec (11.4, point 1)', () => {
  const rules = sharedRules();
  for (const rule of rules) if (rule.rights.includes('R') && !rule.rights.startsWith('+CUD')) assert.ok(!rule.formula.includes('newRec'), rule.formula);
  assert.ok(rules[3].formula.includes('newRec'));
  assert.ok(rules.filter(rule => rule.formula.includes('user.Email')).every(rule => rule.formula.startsWith('user.Email and') || rule.formula.includes('and user.Email and')));
});

test('Partagé : refusé sans le rangement, sans une colonne, déjà posé, ou sous des règles d’un autre auteur', () => {
  assert.equal(planShared({ ...base(), tables: [] }).reason, 'no-table');
  assert.equal(planShared({ ...base(), columns: [{ parentId: 5, colId: 'Utilisateur' }] }).reason, 'no-column');
  assert.equal(planShared(apply(base(), planShared(base()).actions)).reason, 'already');
  const foreign = { ...base(), resources: [...base().resources, { id: 2, tableId: RANGEMENT, colIds: '*' }], rules: [...base().rules, { id: 2, resource: 2, aclFormula: '', permissionsText: '-C', rulePos: 1, memo: 'à moi' }] };
  assert.equal(planShared(foreign).reason, 'foreign');
});

test('firstRule : vrai seulement quand le document n’a encore que la règle que Grist crée', () => {
  assert.equal(planShared(base()).firstRule, true);
  const closed = apply(base(), planCloseStructure(base()).actions);
  assert.equal(planShared(closed).firstRule, false);
});

test('Retirer : toutes les règles de GFS et la ressource qui n’en garde plus, jamais une règle d’un autre auteur', () => {
  const withMine = apply(base(), planShared(base()).actions);
  const mixed = { ...withMine, resources: [...withMine.resources, { id: 3, tableId: 'Autre', colIds: '*' }], rules: [...withMine.rules, { id: 9, resource: 3, aclFormula: '', permissionsText: '-R', rulePos: 1, memo: 'écrite à la main' }] };
  const plan = planRemoveLevel(mixed);
  assert.equal(plan.ok, true);
  const after = apply(mixed, plan.actions);
  assert.deepEqual(after.rules.map(rule => rule.id), [1, 9]);
  assert.deepEqual(after.resources.map(resource => resource.id), [1, 3]);
  assert.equal(planRemoveLevel(base()).reason, 'none');
});

test('Structure fermée : une règle sur la ressource « toutes les tables » (*/*), créée au besoin, que GFS relit comme fermée', () => {
  const plan = planCloseStructure(base());
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.actions[0], ['AddRecord', '_grist_ACLResources', 2, { tableId: '*', colIds: '*' }]);
  const [name, table, id, values] = plan.actions[1];
  assert.deepEqual([name, table, id, values.resource, values.aclFormula, values.permissionsText], ['AddRecord', '_grist_ACLRules', 2, 2, 'user.Access != OWNER', '-S']);
  assert.match(values.memo, /^GFS : Structure/);
  const after = apply(base(), plan.actions);
  assert.equal(structureClosed(userRules(after.resources, after.rules)), true);
  assert.equal(planCloseStructure(after).reason, 'already');
  // La ressource vide que Grist crée avec un document neuf ne ferme rien (mesuré, 1.7.19) : GFS n'y pose pas sa règle.
  assert.ok(plan.actions.every(action => action[1] !== '_grist_ACLRules' || action[3].resource !== 1));
});

test('Structure fermée : la ressource */* existe déjà, GFS s’y ajoute sans en créer une seconde', () => {
  const existing = { ...base(), resources: [...base().resources, { id: 7, tableId: '*', colIds: '*' }] };
  const plan = planCloseStructure(existing);
  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0][3].resource, 7);
});

test('Structure : fermée à la main, GFS ne la change pas ; rouvrir ne retire que la règle de GFS (et sa ressource)', () => {
  const byHand = { ...base(), resources: [...base().resources, { id: 2, tableId: '*', colIds: '*' }], rules: [...base().rules, { id: 2, resource: 2, aclFormula: 'user.Access != OWNER', permissionsText: '-S', rulePos: 1, memo: '' }] };
  assert.equal(planCloseStructure(byHand).reason, 'already');
  assert.equal(planOpenStructure(byHand).reason, 'none');
  const mine = apply(base(), planCloseStructure(base()).actions);
  const open = planOpenStructure(mine);
  assert.equal(open.ok, true);
  const after = apply(mine, open.actions);
  assert.deepEqual(after.rules.map(rule => rule.id), [1]);
  assert.deepEqual(after.resources.map(resource => resource.id), [1]);
});

test('Structure : la règle -S ne rend aucune table « Règles de Grist » (elle ne touche pas aux lignes)', () => {
  const shared = apply(base(), planShared(base()).actions);
  const after = apply(shared, planCloseStructure(shared).actions);
  const levels = tableLevels(userRules(after.resources, after.rules), [RANGEMENT, 'GFS_Autre']);
  assert.equal(levels.get(RANGEMENT), 'partage');
  assert.equal(levels.get('GFS_Autre'), 'ouvert');
});

test('Panneau : le geste possible, ou le bouton grisé avec sa raison, jamais masqué', () => {
  const plans = existing => ({ shared: planShared(existing), 'remove-level': planRemoveLevel(existing), close: planCloseStructure(existing), open: planOpenStructure(existing), sharing: planSharingFor(existing), unsharing: planUnsharing(existing) });
  assert.deepEqual(actionsOf(plans(base())).map(row => row.kind), ['shared', 'close', 'sharing']);
  const shared = apply(base(), planShared(base()).actions);
  const done = apply(shared, planCloseStructure(shared).actions);
  assert.deepEqual(actionsOf(plans(done)).map(row => row.kind), ['remove-level', 'open', 'sharing']);
  const withSharing = apply(done, planSharingFor(done).actions.filter(action => action[1] === '_grist_ACLResources' || action[1] === '_grist_ACLRules').concat([]));
  assert.deepEqual(actionsOf({ ...plans(done), sharing: { ok: false, reason: 'already' }, unsharing: planUnsharing(withSharing) }).map(row => row.kind), ['remove-level', 'open', 'unsharing']);
  assert.equal(actionsOf({ ...plans(done), sharing: { ok: false, reason: 'foreign' } })[2].why, 'rights.act.why.sharing.foreign');
  const empty = actionsOf(plans({ ...base(), tables: [] }));
  assert.equal(empty[0].kind, null);
  assert.equal(empty[0].why, 'rights.act.why.no-table');
  assert.equal(actionsOf(null).length, 3);
  assert.ok(actionsOf(null).every(row => row.kind === null && row.why));
});

test('« Retirer » (remove-level) ne touche pas aux règles du partage de fichiers : ce sont celles d\u2019un autre geste', () => {
  const shared = apply(base(), planShared(base()).actions);
  const both = apply(shared, planSharingFor({ ...shared, tables: [...shared.tables] }).actions.filter(action => action[1] === '_grist_ACLResources' || action[1] === '_grist_ACLRules'));
  const plan = planRemoveLevel(both);
  assert.equal(plan.ok, true);
  const left = apply(both, plan.actions);
  assert.ok(left.rules.some(rule => /^GFS : Partages/.test(rule.memo || '')), 'les règles de partage restent');
  assert.ok(!left.rules.some(rule => /^GFS : Partagé/.test(rule.memo || '')), 'les règles de Partagé sont retirées');
});
