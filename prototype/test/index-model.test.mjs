// L'index des noms (js/explorer/index-model.js, js/explorer/index-reader.js ; choix du porteur du 26/11) : le plan de ce qu'on pose (deux gestes pour une table dont
// l'identifiant est le numéro de ligne), les règles recopiées en lecture seule, le poids écrit pour le moteur de Grist, et la lecture qui refuse ce qui n'est pas sûr.
// Ce que Grist en fait vraiment (le poids égal à l'octet près, le résumé qu'un éditeur lit sous règles) se mesure dans un vrai Grist (banc `n11-index-plan.mjs` des
// fichiers du projet, faits vérifiés 182).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEY, ROW, WEIGHT, keyOf, summaryName, planIndex, weightFormula, linkedWeightFormula, mirrored, indexNamesOf } from '../js/explorer/index-model.js';
import { hasIndex, readIndexedTable, readIndexedLinks } from '../js/explorer/index-reader.js';
import { targetsOf } from '../js/sharing/sharing-model.js';
import { publipostage } from './helpers.mjs';

const manifest = publipostage();
const spec = manifest.fichiers[0];
const linkedRule = spec.poids.liees[0];

let nextColumn = 100;
const columns = (parent, list) => list.map(([colId, type, extra = {}]) => ({ id: (nextColumn += 1), parentId: parent, colId, type, isFormula: false, formula: '', ...extra }));
// Un document qui a les tables de Publipostage+ ; `withKey` : la colonne d'aide est posée ; `rules` : les règles du partage de GFS sont là.
function document({ withKey = false, summaries = [], rules = false, foreign = false } = {}) {
  const tables = [{ id: 1, tableId: spec.table }, { id: 2, tableId: linkedRule.table }, ...summaries.map((name, at) => ({ id: 10 + at, tableId: name }))];
  const list = [
    ...columns(1, [['Nom', 'Text'], ['TypeModele', 'Text'], ['DateModif', 'DateTime:UTC'], ['ModifiePar', 'Text'], ['Jeton', 'Text'], ['Contenu', 'Text'], ['Ordre', 'Int'],
      ['GFS_Lecteurs', 'Any', { isFormula: true }], ...(withKey ? [[KEY, 'Int', { isFormula: true, formula: '$id' }]] : [])]),
    ...columns(2, [['Jeton', 'Text'], ['Contenu', 'Text']]),
  ];
  const resources = rules || foreign ? [{ id: 1, tableId: spec.table, colIds: '*' }] : [];
  const acl = rules ? [{ id: 1, resource: 1, aclFormula: 'user.Access in [OWNER]', permissionsText: '+CRUD', rulePos: 1, memo: 'GFS : Partages · les propriétaires gardent la main' }]
    : foreign ? [{ id: 1, resource: 1, aclFormula: '', permissionsText: '-C', rulePos: 1, memo: 'règle de quelqu’un d’autre' }] : [];
  return { tables, columns: list, resources, rules: acl, specs: [{ table: spec.table, spec }], targets: targetsOf([manifest]) };
}

test('le nom du résumé et sa clé : le numéro de ligne se groupe par une colonne d\'aide, un identifiant propre par lui-même', () => {
  assert.equal(keyOf(spec), KEY);
  assert.equal(keyOf({ colonnes: { id: 'Identifiant' } }), 'Identifiant');
  assert.equal(summaryName(spec.table, KEY), 'Publipostage_Modeles_summary_GFS_Key');
});

test('premier geste : sans la colonne d\'aide, le plan ne pose qu\'elle (`again`) ; le même geste, rejoué, pose les résumés', () => {
  const first = planIndex(document());
  assert.equal(first.ok, true);
  assert.equal(first.again, true);
  assert.deepEqual(first.actions, [['AddColumn', spec.table, KEY, { type: 'Int', isFormula: true, formula: '$id' }]]);
  const second = planIndex(document({ withKey: true }));
  assert.equal(second.ok, true);
  assert.equal(second.again, false);
  assert.deepEqual(second.creates, ['Publipostage_Modeles_summary_GFS_Key', 'Publipostage_Versions_summary_Jeton']);
  const kinds = second.actions.map(action => action[0]);
  assert.equal(kinds.filter(kind => kind === 'CreateViewSection').length, 2, 'un résumé pour la table, un pour sa table liée');
  assert.deepEqual(second.actions[0].slice(2, 4), [0, 'record'], 'la page est créée avec le résumé (Grist retire le résumé qui n\'a plus de page)');
});

test('les colonnes du résumé : celles que la lecture légère garde, le numéro de ligne, le poids ; Grist somme lui-même les colonnes numériques (ModifyColumn)', () => {
  const { actions } = planIndex(document({ withKey: true }));
  const put = (kind, name) => actions.find(action => action[0] === kind && action[1] === 'Publipostage_Modeles_summary_GFS_Key' && action[2] === name);
  for (const name of ['Nom', 'TypeModele', 'DateModif', 'ModifiePar', 'GFS_Lecteurs']) assert.ok(put('AddColumn', name), `${name} est reprise par une formule`);
  assert.ok(!put('AddColumn', 'Contenu'), 'le contenu n\'est jamais repris');
  assert.ok(put('AddColumn', 'Jeton'), 'la clé qui lie les versions est reprise (`poids.liees`)');
  assert.ok(put('ModifyColumn', 'Ordre'), 'la somme que Grist crée pour une colonne numérique change de formule (sinon « Ordre2 »)');
  assert.equal(put('AddColumn', 'Nom')[3].formula, '$group[0].Nom if len($group) else None');
  assert.equal(put('AddColumn', ROW)[3].formula, '$group[0].id if len($group) else 0');
  assert.match(put('AddColumn', WEIGHT)[3].formula, /_tx\(r\.Contenu\)/, 'le poids compte le contenu : le moteur le lit, pas le widget');
  const linked = actions.find(action => action[0] === 'AddColumn' && action[1] === 'Publipostage_Versions_summary_Jeton' && action[2] === WEIGHT);
  assert.match(linked[3].formula, /for r in \$group/, 'la table liée pèse la somme des lignes de chaque clé');
});

test('les règles du partage se posent sur le résumé en lecture seule (sans elles il laisserait voir les noms des autres) ; sans règle sur la table, aucune', () => {
  const ruled = planIndex(document({ withKey: true, rules: true }));
  const resource = ruled.actions.find(action => action[0] === 'AddRecord' && action[1] === '_grist_ACLResources');
  assert.equal(resource[3].tableId, 'Publipostage_Modeles_summary_GFS_Key');
  const rights = ruled.actions.filter(action => action[0] === 'AddRecord' && action[1] === '_grist_ACLRules').map(action => action[3].permissionsText);
  assert.ok(rights.length >= 4);
  assert.ok(rights.every(text => text === '+R' || text === '-CRUD'), `des droits de lecture seulement (${rights})`);
  assert.ok(!rights.includes('+C') && !rights.includes('+UD'));
  const free = planIndex(document({ withKey: true }));
  assert.ok(!free.actions.some(action => action[1] === '_grist_ACLResources'), 'sans règle sur la table, le résumé n\'en a pas non plus');
});

// Le document tel que Grist le laisse après ces actions (assez pour que le plan se relise) : un résumé par `CreateViewSection`, avec la somme que Grist crée pour chaque
// colonne numérique, puis les colonnes posées ou changées.
function afterwards(doc, actions) {
  const out = structuredClone(doc);
  let id = 500;
  for (const [kind, ...rest] of actions) {
    if (kind === 'AddColumn' || kind === 'ModifyColumn') {
      const [table, colId, fields] = rest;
      const owner = out.tables.find(each => each.tableId === table);
      const found = out.columns.find(col => col.parentId === owner.id && col.colId === colId);
      if (found) Object.assign(found, fields); else out.columns.push({ id: id += 1, parentId: owner.id, colId, ...fields });
    } else if (kind === 'CreateViewSection') {
      const [tableRef, , , groupby] = rest;
      const base = out.tables.find(each => each.id === tableRef);
      const key = out.columns.find(col => col.id === groupby[0]);
      const created = { id: id += 1, tableId: `${base.tableId}_summary_${key.colId}` };
      out.tables.push(created);
      out.columns.push({ id: id += 1, parentId: created.id, colId: key.colId, type: key.type }, { id: id += 1, parentId: created.id, colId: 'group', type: 'RefList' },
        { id: id += 1, parentId: created.id, colId: 'count', type: 'Int', isFormula: true, formula: 'len($group)' });
      for (const col of out.columns.filter(each => each.parentId === base.id && ['Int', 'Numeric'].includes(each.type) && each.colId !== key.colId)) {
        out.columns.push({ id: id += 1, parentId: created.id, colId: col.colId, type: col.type, isFormula: true, formula: `SUM($group.${col.colId})` });
      }
    }
  }
  return out;
}

test('une table qui porte la règle d\'un autre auteur n\'est pas indexée (ce qu\'elle protège est à elle)', () => {
  const foreign = planIndex(document({ withKey: true, foreign: true }));
  assert.deepEqual([foreign.ok, foreign.reason], [false, 'foreign']);
  assert.deepEqual(planIndex({ ...document({ withKey: true }), specs: [] }), { ok: false, reason: 'nothing' });
});

test('rejouer ne pose plus rien ; une colonne ajoutée à la table remet les formules à jour (le poids la compte), et rien d\'autre', () => {
  const start = document({ withKey: true });
  const first = planIndex(start);
  const done = afterwards(start, first.actions);
  assert.deepEqual(planIndex(done), { ok: false, reason: 'already' });
  const grown = afterwards(done, [['AddColumn', spec.table, 'Total', { type: 'Numeric', isFormula: false, formula: '' }]]);
  const update = planIndex(grown);
  assert.equal(update.ok, true);
  assert.deepEqual(update.creates, [], 'le résumé existe : rien à créer');
  const touched = update.actions.map(action => `${action[0]} ${action[1]} ${action[2]}`);
  assert.ok(touched.includes('AddColumn Publipostage_Modeles_summary_GFS_Key Total') || touched.includes('ModifyColumn Publipostage_Modeles_summary_GFS_Key Total'));
  assert.ok(touched.includes(`ModifyColumn Publipostage_Modeles_summary_GFS_Key ${WEIGHT}`), 'le poids est réécrit avec la nouvelle colonne');
  assert.ok(!touched.some(line => line.startsWith('CreateViewSection')));
});

test('le poids écrit pour le moteur suit `cellBytes` pour chaque type de colonne', () => {
  const formula = weightFormula([{ colId: 'A', type: 'Text' }, { colId: 'B', type: 'Int' }, { colId: 'C', type: 'Bool' }, { colId: 'D', type: 'Date' }, { colId: 'E', type: 'ChoiceList' },
    { colId: 'F', type: 'Ref:Autre' }, { colId: 'G', type: 'Any' }]);
  assert.match(formula, /_tx\(r\.A\)/);
  assert.match(formula, /_num\(r\.B\)/);
  assert.match(formula, /\(0 if r\.C is None else 1\)/);
  assert.match(formula, /\(0 if r\.D is None else 4\)/);
  assert.match(formula, /_ls\(r\.E\)/);
  assert.match(formula, /_num\(r\.F\.id\)/);
  assert.match(formula, /_any\(r\.G\)/);
  assert.match(formula, /^import json/);
  assert.match(linkedWeightFormula([{ colId: 'A', type: 'Text' }]), /total \+= _tx\(r\.A\)/);
});

test('les colonnes reprises sont celles de la lecture légère, la clé exceptée', () => {
  const cols = [{ colId: 'Nom', type: 'Text' }, { colId: 'Contenu', type: 'Text' }, { colId: 'Ordre', type: 'Int' }, { colId: KEY, type: 'Int' }];
  assert.deepEqual(mirrored(cols, spec, KEY).map(col => col.colId), ['Nom', 'Ordre']);
});

// ---------- la lecture ----------
const sumName = summaryName(spec.table, KEY);
const linkedName = summaryName(linkedRule.table, linkedRule.colonne);
const summaryData = (over = {}) => ({ id: [1, 2], [KEY]: [7, 9], group: [['L', 7], ['L', 9]], count: [1, 1], Nom: ['A', 'B'], TypeModele: ['document', 'document'], DateModif: [10, 20], ModifiePar: ['', ''], Jeton: ['j7', 'j9'],
  GFS_Lecteurs: [['L'], ['L']], [ROW]: [7, 9], [WEIGHT]: [1000, 2000], ...over });
// Les tables internes de Grist, telles que `fetchTable` les rend : la table de l'app et ses colonnes (`base`), la clé d'aide comprise.
const metaOf = base => ({
  _grist_Tables: { id: [1, 2], tableId: [spec.table, linkedRule.table] },
  _grist_Tables_column: { id: base.map((_, at) => at + 1), parentId: base.map(() => 1), colId: base },
});
const BASE_COLUMNS = ['Nom', 'TypeModele', 'DateModif', 'ModifiePar', 'Jeton', 'Contenu', 'Ordre', 'GFS_Lecteurs', KEY];
function indexed(extra = {}, base = BASE_COLUMNS) {
  const data = { [sumName]: summaryData(), [linkedName]: { id: [1, 2], Jeton: ['j7', ''], group: [], count: [1, 1], [WEIGHT]: [500, 70] }, ...metaOf(base), ...extra };
  const names = [spec.table, linkedRule.table, ...Object.keys(data)];
  return { names, doc: { fetchTable: async name => { if (!data[name]) throw new Error(`pas de ${name}`); return data[name]; } }, data };
}

test('lire par l\'index : `id` est la ligne d\'origine, le poids celui du moteur, rien de plus (ni le groupe, ni le nombre)', async () => {
  const { names, doc } = indexed();
  assert.equal(hasIndex(names, spec), true);
  const read = await readIndexedTable(doc, names, spec);
  assert.deepEqual(read.data.id, [7, 9]);
  assert.deepEqual(read.weights, [1000, 2000]);
  assert.deepEqual(Object.keys(read.data).sort(), ['DateModif', 'GFS_Key', 'GFS_Lecteurs', 'Jeton', 'ModifiePar', 'Nom', 'TypeModele', 'id']);
});

test('les tables liées : les octets de chaque clé, la clé vide ne désigne personne', async () => {
  const { names, doc } = indexed();
  const links = await readIndexedLinks(doc, names, spec);
  assert.deepEqual(links.map(link => [link.table, link.fichier, [...link.bytes]]), [[linkedRule.table, linkedRule.fichier, [['j7', 500]]]]);
});

test('une colonne que le manifeste nomme et que le document n\'a pas (une app plus ancienne) ne manque pas au résumé ; la clé d\'aide absente de la table, si', async () => {
  const old = BASE_COLUMNS.filter(column => column !== 'Jeton');
  const without = indexed({ [sumName]: (() => { const copy = summaryData(); delete copy.Jeton; return copy; })() }, old);
  const read = await readIndexedTable(without.doc, without.names, spec);
  assert.deepEqual(read.data.id, [7, 9], 'le résumé n\'a pas la colonne que la table n\'a pas : la lecture par l\'index passe');
  const keyless = indexed({}, BASE_COLUMNS.filter(column => column !== KEY));
  assert.equal(await readIndexedTable(keyless.doc, keyless.names, spec), null, 'sans la colonne d\'aide dans la table, le résumé n\'est pas celui que GFS a posé');
  const unreadable = indexed();
  const blind = { fetchTable: async name => { if (name.startsWith('_grist_')) throw new Error('refusé'); return unreadable.doc.fetchTable(name); } };
  assert.equal(await readIndexedTable(blind, unreadable.names, spec), null, 'sans savoir quelles colonnes la table a, rien n\'est sûr');
});

test('un index qui n\'est pas sûr se refuse : la lecture se fait alors comme avant', async () => {
  const fused = indexed({ [sumName]: summaryData({ count: [1, 2] }) });
  assert.equal(await readIndexedTable(fused.doc, fused.names, spec), null, 'deux lignes dans un groupe : le résumé en cacherait une');
  const missing = indexed({ [sumName]: (() => { const copy = summaryData(); delete copy.ModifiePar; return copy; })() });
  assert.equal(await readIndexedTable(missing.doc, missing.names, spec), null, 'une colonne que l\'explorateur demande manque : l\'index est à remettre à jour');
  const noWeight = indexed({ [sumName]: (() => { const copy = summaryData(); delete copy[WEIGHT]; return copy; })() });
  assert.equal(await readIndexedTable(noWeight.doc, noWeight.names, spec), null);
  const absent = indexed();
  assert.equal(hasIndex(absent.names.filter(name => name !== sumName), spec), false);
  assert.equal(await readIndexedTable(absent.doc, absent.names.filter(name => name !== sumName), spec), null);
  const noLinked = indexed();
  assert.equal(hasIndex(noLinked.names.filter(name => name !== linkedName), spec), false, 'une table liée sans son résumé : tout se lit comme avant');
  const refused = { fetchTable: async () => { throw new Error('accès refusé'); } };
  assert.equal(await readIndexedTable(refused, absent.names, spec), null);
  assert.equal(await readIndexedLinks(refused, absent.names, spec), null);
});

test('le plan dit les tables à indexer et si des règles se recopient (la question posée au propriétaire s\'en sert, avant même le premier geste)', () => {
  const first = planIndex(document({ rules: true }));
  assert.deepEqual(first.tables, [spec.table]);
  assert.equal(first.rules, true);
  assert.equal(planIndex(document()).rules, false);
  const second = planIndex(document({ withKey: true, rules: true }));
  assert.deepEqual(second.tables, [spec.table]);
  assert.equal(second.rules, true);
});

test('indexNamesOf : le résumé de chaque table de fichiers et de ses tables liées (la page de chacun se range sous GFS)', () => {
  assert.deepEqual(indexNamesOf([{ table: spec.table, spec }, { table: 'GFS_Fichiers', spec: { colonnes: { id: 'Identifiant' } } }]),
    ['Publipostage_Modeles_summary_GFS_Key', 'Publipostage_Versions_summary_Jeton', 'GFS_Fichiers_summary_Identifiant']);
  assert.deepEqual(indexNamesOf(null), []);
});

test('les règles du résumé reprennent le jeu de noms des colonnes d\'aide de la table (un document que la mise à jour des noms n\'a pas atteint les a en français)', () => {
  const texts = plan => plan.actions.filter(action => action[0] === 'AddRecord' && action[1] === '_grist_ACLRules').map(action => action[3].aclFormula).join('\n');
  const french = planIndex(document({ withKey: true, rules: true })); // la table d'essai porte `GFS_Lecteurs`
  assert.match(texts(french), /GFS_Lecteurs/);
  assert.doesNotMatch(texts(french), /GFS_Readers/);
  const english = document({ withKey: true, rules: true });
  english.columns = english.columns.map(col => (col.colId === 'GFS_Lecteurs' ? { ...col, colId: 'GFS_Readers' } : col));
  assert.match(texts(planIndex(english)), /GFS_Readers/);
  assert.doesNotMatch(texts(planIndex(english)), /GFS_Lecteurs/);
});
