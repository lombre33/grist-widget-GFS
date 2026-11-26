// Poser et retirer (js/rights/rights-writer.js, js/rights/rights-actions.js ; étape 7 lot a) : une seule liasse envoyée, plan relu au moment d’écrire, rien d’écrit pour un non-propriétaire, la reprise après le
// rechargement que Grist impose, et la question posée avant d’écrire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RightsWriter } from '../js/rights/rights-writer.js';
import { runAction, askOptions } from '../js/rights/rights-actions.js';
import { RANGEMENT } from '../js/rights/rights-plan.js';

const BUILT_IN = { id: 1, resource: 1, permissions: 63, aclFormula: '', permissionsText: '', rulePos: 1, memo: '' };
const RAW = () => ({ resources: [{ id: 1, tableId: '', colIds: '' }], rules: [{ ...BUILT_IN }], tables: [{ id: 5, tableId: RANGEMENT }], columns: [{ parentId: 5, colId: 'User' }, { parentId: 5, colId: 'Address' }] });
const memoryStore = () => { let value = null; return { read: () => value, write: next => { value = next; return true; } }; };

function setup({ raw = RAW(), fail = null } = {}) {
  const sent = [];
  const store = memoryStore();
  const port = { doc: { applyUserActions: async actions => { if (fail) throw new Error(fail); sent.push(actions); } } };
  const writer = new RightsWriter({ port, reader: { raw: async () => raw }, store });
  return { writer, sent, store };
}

test('apply : une seule liasse, et la reprise retenue avant d’écrire', async () => {
  const { writer, sent, store } = setup();
  assert.deepEqual(await writer.apply('shared'), { ok: true });
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0][1], '_grist_ACLResources');
  assert.equal(store.read(), 'rights');
});

test('apply : un refus de Grist se rend, et la reprise est retirée', async () => {
  const { writer, store } = setup({ fail: 'Only owners can modify access rules' });
  const result = await writer.apply('shared');
  assert.equal(result.ok, false);
  assert.match(result.message, /Only owners/);
  assert.equal(store.read(), null);
});

test('apply : sans lecture des règles (pas propriétaire), ou plan périmé, rien n’est envoyé', async () => {
  const none = setup({ raw: null });
  assert.equal((await none.writer.apply('shared')).reason, 'unreadable');
  assert.equal(none.sent.length, 0);
  const stale = setup({ raw: { ...RAW(), tables: [] } });
  assert.equal((await stale.writer.apply('shared')).reason, 'no-table');
  assert.equal(stale.sent.length, 0);
  assert.equal((await setup().writer.apply('inconnu')).ok, false);
});

test('resume : vrai une seule fois après une pose', async () => {
  const { writer } = setup();
  assert.equal(writer.resume(), false);
  await writer.apply('close');
  assert.equal(writer.resume(), true);
  assert.equal(writer.resume(), false);
});

test('plans : les six plans, ou null sans lecture', async () => {
  assert.deepEqual(Object.keys(await setup().writer.plans()).sort(), ['close', 'open', 'remove-level', 'shared', 'sharing', 'unsharing']);
  assert.equal(await setup({ raw: null }).writer.plans(), null);
});

const t = (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key);

test('la question dit le prix : première règle, rechargement, et sur la structure ce qu’elle coûte', () => {
  const first = askOptions(t, 'close', { firstRule: true });
  assert.ok(first.items.includes('rights.ask.firstRule') && first.items.includes('rights.ask.close.item1'));
  assert.equal(first.note, 'rights.ask.reload');
  assert.equal(first.safeFirst, true);
  assert.deepEqual(askOptions(t, 'shared', { firstRule: false }).items, []);
});

test('runAction : Annuler n’écrit rien ; accepter écrit ; un échec est dit', async () => {
  const cases = [{ answer: false, written: 0, told: 0 }, { answer: true, written: 1, told: 0 }];
  for (const { answer, written, told } of cases) {
    const { writer, sent } = setup();
    const asked = [];
    const done = await runAction({ kind: 'shared', plans: await writer.plans(), t, ask: async options => { asked.push(options); return answer; }, writer });
    assert.equal(done, answer);
    assert.equal(sent.length, written);
    assert.equal(asked.length - 1, told);
  }
  const bad = setup({ fail: 'refus' });
  const asked = [];
  assert.equal(await runAction({ kind: 'shared', plans: await bad.writer.plans(), t, ask: async options => { asked.push(options); return true; }, writer: bad.writer }), false);
  assert.equal(asked.length, 2);
  assert.match(asked[1].message, /refus/);
});

test('activer le partage depuis la fenêtre « Partager » : la reprise retenue est celle du fichier (`share:<clé>`), pas celle du panneau', async () => {
  const { writer, sent, store } = setup();
  assert.deepEqual(await writer.apply('sharing', 'share:gfs-fichiers:f1'), { ok: true });
  assert.equal(sent.length, 1);
  assert.equal(store.read(), 'share:gfs-fichiers:f1');
  assert.equal(writer.resume(), false, 'ce n’est pas la reprise du panneau');
  assert.equal(store.read(), null, 'la reprise a été prise (une seule fois)');
  await writer.apply('close');
  assert.equal(writer.take(), 'rights');
  assert.equal(writer.take(), null);
});

test('activer le partage : UNE liasse écrit le partage et ferme la structure ; une structure déjà fermée n\u2019en reçoit pas une seconde', async () => {
  const { writer, sent } = setup();
  assert.deepEqual(await writer.apply('sharing'), { ok: true });
  assert.equal(sent.length, 1, 'une seule écriture : la page ne se recharge qu\u2019une fois');
  const closing = sent[0].filter(action => action[1] === '_grist_ACLRules' && action[3].permissionsText === '-S');
  assert.equal(closing.length, 1);
  assert.equal(closing[0][3].aclFormula, 'user.Access != OWNER');
  assert.ok(sent[0].indexOf(closing[0]) > sent[0].findIndex(action => action[0] === 'AddTable'), 'la structure se ferme après la création des tables');
  const closed = setup({ raw: { ...RAW(), rules: [{ ...BUILT_IN }, { id: 9, resource: 1, aclFormula: 'user.Access != OWNER', permissionsText: '-S', memo: '', rulePos: 1 }] } });
  await closed.writer.apply('sharing');
  assert.equal(closed.sent[0].filter(action => action[1] === '_grist_ACLRules' && action[3].permissionsText === '-S').length, 0);
});

test('la question d\u2019activation dit que la structure se ferme, et ce que les éditeurs gardent, à la place de « rien ne change pour les tables »', () => {
  const closes = askOptions(t, 'sharing', { ok: true, closes: true, firstRule: false });
  assert.deepEqual(closes.items, ['rights.ask.sharing.structure', 'rights.ask.close.item2', 'rights.ask.sharing.item1'], 'le prix en tête : il se lit sans défiler');
  const stays = askOptions(t, 'sharing', { ok: true, firstRule: false });
  assert.deepEqual(stays.items, ['rights.ask.sharing.item1', 'rights.ask.sharing.item2']);
});

test('activer le partage : les PDF déjà rangés restent lisibles de tous (un partage « tout le document » par fichier), les nouveaux ne le sont pas', async () => {
  const { writer, sent } = setup({ raw: { ...RAW(), fileIds: ['a1', 'b2'] } });
  await writer.apply('sharing');
  const bulk = sent[0].find(action => action[0] === 'BulkAddRecord' && action[1] === 'GFS_Shares');
  assert.deepEqual(bulk[3].Target, ['gfs-fichiers:a1', 'gfs-fichiers:b2']);
  assert.deepEqual(bulk[3].Person, ['@tous', '@tous']);
  assert.deepEqual(bulk[3].Right, ['lecture', 'lecture']);
  const none = setup();
  await none.writer.apply('sharing');
  assert.ok(!none.sent[0].some(action => action[0] === 'BulkAddRecord'), 'aucun fichier : aucune ligne à écrire');
});

test('la question d’activation dit le prix : ce que deviennent les PDF d’avant, et la première règle', () => {
  const options = askOptions(t, 'sharing', { firstRule: true });
  assert.deepEqual(options.items, ['rights.ask.sharing.item1', 'rights.ask.sharing.item2', 'rights.ask.firstRule']);
  assert.equal(options.title, 'rights.ask.sharing.title');
  assert.equal(options.confirmLabel, 'rights.ask.sharing.confirm');
});

test('la question du partage cite les tables des apps touchées ; sur un partage déjà là, elle dit « compléter », pas « activer »', () => {
  const fresh = askOptions(t, 'sharing', { ok: true, firstRule: true, appTables: ['Publipostage_Modeles', 'FormPlus_Formulaires'], extends: false });
  assert.equal(fresh.title, t('rights.ask.sharing.title'));
  assert.ok(fresh.items.some(item => item.startsWith('rights.ask.sharing.apps') && item.includes('Publipostage_Modeles, FormPlus_Formulaires')));
  const later = askOptions(t, 'sharing', { ok: true, firstRule: false, appTables: ['FormPlus_Formulaires'], extends: true });
  assert.equal(later.title, t('rights.ask.sharing.extend.title'));
  assert.equal(later.confirmLabel, t('rights.ask.sharing.extend.confirm'));
  assert.ok(!askOptions(t, 'sharing', { ok: true, appTables: [], extends: false }).items.some(item => item.startsWith('rights.ask.sharing.apps')));
});

test('plansFrom : les plans de lignes déjà lues, sans les relire (un appelant qui a lu raw() ne le relit pas) ; rien lu, rien à planifier', async () => {
  let reads = 0;
  const writer = new RightsWriter({ port: { doc: {} }, reader: { raw: async () => { reads += 1; return null; } }, store: { read: () => null, write: () => {} } });
  assert.equal(writer.plansFrom(null), null);
  assert.equal(await writer.plans(), null);
  assert.equal(reads, 1, 'plans() relit ; plansFrom() ne lit rien');
});

// ---------- l'index des noms (js/rights/rights-writer.js, js/rights/index-control.js ; choix du porteur du 26/11) ----------

// Un document qui a une table de fichiers d'app (`Pub_Modeles`, ses fichiers sont ses lignes) : le lecteur le relit après chaque geste, comme Grist le laisse.
function indexDocument({ withKey = false, rules = false } = {}) {
  const spec = { table: 'Pub_Modeles', colonnes: { id: 'id', nom: 'Nom' } };
  const tables = [{ id: 1, tableId: 'Pub_Modeles' }];
  const columns = [{ id: 1, parentId: 1, colId: 'Nom', type: 'Text', isFormula: false, formula: '' },
    ...(withKey ? [{ id: 2, parentId: 1, colId: 'GFS_Key', type: 'Int', isFormula: true, formula: '$id' }] : [])];
  const resources = rules ? [{ id: 1, tableId: 'Pub_Modeles', colIds: '*' }] : [];
  const acl = rules ? [{ id: 1, resource: 1, aclFormula: 'user.Access in [OWNER]', permissionsText: '+CRUD', rulePos: 1, memo: 'GFS : Partages · les propriétaires gardent la main' }] : [];
  const targets = [{ table: 'Pub_Modeles', prefix: 'pub:', app: 'pub' }];
  return { resources, rules: acl, tables, columns, specs: [{ table: 'Pub_Modeles', spec }], targets, fileIds: [], files: {} };
}
// Un lecteur qui rend le document tel que les gestes déjà écrits l'ont laissé : la colonne d'aide posée par le premier se lit au deuxième.
function indexSetup({ rules = false, fail = null, owner = true } = {}) {
  const sent = []; const reads = [];
  const store = memoryStore();
  const port = { doc: { applyUserActions: async actions => { if (fail) throw new Error(fail); sent.push(actions); } } };
  const reader = { raw: async options => { reads.push(options); return owner ? indexDocument({ rules, withKey: sent.some(actions => actions.some(action => action[2] === 'GFS_Key')) }) : null; } };
  return { writer: new RightsWriter({ port, reader, store }), sent, store, reads };
}

test('index : le plan se lit sans les tables de fichiers, et rend null pour qui n\'est pas propriétaire', async () => {
  const { writer, reads } = indexSetup();
  const plan = await writer.indexPlan();
  assert.equal(plan.ok, true);
  assert.deepEqual(reads, [{ files: false }]);
  assert.equal(await indexSetup({ owner: false }).writer.indexPlan(), null);
  assert.ok(!('index' in await setup().writer.plans()), 'ni le panneau ni « Gérer les partages » ne calculent le plan de l\'index');
});

test('index : deux gestes pour une table dont l\'identifiant est le numéro de ligne (la colonne d\'aide, puis les résumés), le deuxième relu après le premier', async () => {
  const { writer, sent, store } = indexSetup();
  assert.deepEqual(await writer.apply('index', 'index'), { ok: true });
  assert.equal(sent.length, 2);
  assert.deepEqual(sent[0].map(action => action[0]), ['AddColumn']);
  assert.equal(sent[1][0][0], 'CreateViewSection');
  assert.equal(store.read(), null, 'aucune règle écrite : Grist ne recharge pas la page, rien à rouvrir');
});

test('index : des règles recopiées font recharger la page, GFS retient de le dire au retour', async () => {
  const { writer, sent, store } = indexSetup({ rules: true });
  assert.deepEqual(await writer.apply('index', 'index'), { ok: true });
  assert.ok(sent.at(-1).some(action => action[1] === '_grist_ACLRules'));
  assert.equal(store.read(), 'index');
  assert.equal(writer.take(), 'index');
});

test('index : un refus de Grist se rend et la reprise est retirée ; un plan déjà posé n\'écrit rien', async () => {
  const refused = indexSetup({ fail: 'Only owners can modify access rules' });
  const result = await refused.writer.apply('index', 'index');
  assert.equal(result.ok, false);
  assert.match(result.message, /Only owners/);
  assert.equal(refused.store.read(), null);
  const none = indexSetup({ owner: false });
  assert.equal((await none.writer.apply('index', 'index')).reason, 'unreadable');
  assert.equal(none.sent.length, 0);
});

test('index : la question dit les tables, la colonne d\'aide, les règles recopiées, les pages, et le rechargement seulement quand des règles se recopient', async () => {
  const t = (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key);
  const free = askOptions(t, 'index', await indexSetup().writer.indexPlan());
  assert.equal(free.title, 'rights.ask.index.title');
  assert.equal(free.confirmLabel, 'rights.ask.index.confirm');
  assert.deepEqual(free.items.map(item => item.split(' ')[0]), ['rights.ask.index.item1', 'rights.ask.index.item2', 'rights.ask.index.item4']);
  assert.match(free.items[0], /Pub_Modeles/);
  assert.equal(free.note, '', 'sans règle à recopier la page ne se recharge pas : pas de mot sur le rechargement');
  const ruled = askOptions(t, 'index', await indexSetup({ rules: true }).writer.indexPlan());
  assert.ok(ruled.items.includes('rights.ask.index.item3'));
  assert.equal(ruled.note, 'rights.ask.index.reload');
});

test('index : un refus de Grist se dit avec les mots de l\'index (« L\'index n\'a pas été créé »), pas ceux des règles', async () => {
  const { writer } = indexSetup({ fail: 'boom' });
  const shown = [];
  const t = key => key;
  const done = await runAction({ kind: 'index', plans: { index: await indexSetup().writer.indexPlan() }, t, ask: async options => { shown.push(options); return true; }, writer, resume: 'index' });
  assert.equal(done, false);
  assert.equal(shown.at(-1).title, 'rights.ask.index.failed.title');
});
