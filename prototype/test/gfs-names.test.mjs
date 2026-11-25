// Les noms des tables de GFS en anglais (retour n° 1 du porteur, 25/11) : le lot calculé d'après les noms du document, la reconnaissance d'un document d'avant, la garde de
// `OwnTable` (jamais une seconde table à côté de celle d'avant) et le déroulé de la mise à jour (noyau du kit, sans fenêtre). Ce que Grist fait vraiment d'un renommage
// (règles d'accès, formules qui suivent) se mesure dans un vrai Grist : labo/run-noms-gfs.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GFS_RENAMES, LOOP_VARIABLES, planGfsNames, legacyTables, isLegacyForm, renamedOf, rewriteFormula, staleFormulas } from '../js/files/gfs-names.js';
import { OwnTable, LegacyNames, TableDeclined } from '../js/files/own-table.js';
import { updateNames, readSchema, mendFormulas } from '../js/files/names-update.js';
import { COLUMNS as FILING_COLUMNS } from '../js/files/rangement.js';
import { groupColumns, spaceColumns, placeColumns, shareColumns, helperColumns, targetsOf, HELPERS } from '../js/sharing/sharing-model.js';
import { readFileSync } from 'node:fs';
import { BIN_COLUMNS } from '../js/files/gfs-trash.js';
import { ANNUAIRES_COLUMNS } from '../js/annuaire/annuaire-config.js';
import { fakeGrist } from './fake-grist.mjs';
import { fakeDoc } from '../kit/test/names-update-fake.mjs';

// Les colonnes de chaque table telles que la version d'avant les posait (relevées dans le code d'avant le renommage, f1c7f7e) : un document d'avant en porte exactement ces noms.
const BEFORE = {
  GFS_Rangement: ['Utilisateur', 'App', 'Fichier', 'Favori', 'Dossier', 'Replie', 'Valeur', 'Adresse'],
  GFS_Groupes: ['Nom', 'NomL', 'PersonnesIci', 'Source', 'SourceEmail', 'SourceGroupe', 'Membres', 'Nb'],
  GFS_Espaces: ['Cle', 'Nom', 'Voit'],
  GFS_Placement: ['Cible', 'Espace', 'Dossier', 'Voit', 'Lien', 'Partages'],
  GFS_Partages: ['Cible', 'Personne', 'Droit', 'Telecharger', 'Fin', 'Auteur', 'AuteurAcces', 'PersonneL', 'Actif', 'Valide1', 'AdminsBase', 'Valide', 'AdminsCible'],
  GFS_Corbeille: ['Identifiant', 'App', 'Table', 'FichierId', 'Nom', 'Type', 'Date', 'Auteur', 'SupprimeLe', 'SupprimePar', 'Instantane'],
  GFS_Annuaires: ['Nom', 'Table', 'Config', 'Parent', 'Fiches'],
};
const NOW = {
  GFS_Filing: FILING_COLUMNS, GFS_Groups: groupColumns(), GFS_Spaces: spaceColumns(), GFS_Placement: placeColumns(), GFS_Shares: shareColumns(), GFS_Trash: BIN_COLUMNS,
  GFS_Directories: ANNUAIRES_COLUMNS,
};
const idsOf = list => list.map(column => column.id);

const oldDocument = extra => ({ tables: { ...Object.fromEntries(Object.entries(BEFORE).map(([name, columns]) => [name, ['id', ...columns]])), Clients: ['id', 'Nom', 'Ville'], ...extra } });
const newDocument = () => ({ tables: Object.fromEntries(Object.entries(NOW).map(([name, columns]) => [name, ['id', ...idsOf(columns)]])) });

test('la table des noms dit, pour chaque table de GFS, le nom d\'avant, et chaque colonne d\'arrivée est une colonne que le code pose aujourd\'hui', () => {
  assert.deepEqual(GFS_RENAMES.map(entry => entry.table), Object.keys(NOW));
  for (const entry of GFS_RENAMES) {
    const current = new Set(idsOf(NOW[entry.table]));
    for (const [before, after] of Object.entries(entry.columns)) {
      assert.ok(current.has(after), `${entry.table}.${after} : le code ne pose pas cette colonne`);
      assert.ok(!current.has(before), `${entry.table}.${before} : le code pose encore le nom d'avant`);
    }
  }
});

test('un document d\'avant, une fois le lot joué, a exactement les colonnes que le code d\'aujourd\'hui pose (aucune oubliée, aucune en trop)', () => {
  const doc = fakeDoc(Object.fromEntries(Object.entries(oldDocument().tables).map(([name, columns]) => [name, { columns, rows: 3 }])));
  const actions = planGfsNames(oldDocument());
  assert.ok(actions.length > 40, 'sept tables, et leurs colonnes');
  return doc.port.apply(actions).then(() => {
    const after = doc.tables();
    for (const [name, columns] of Object.entries(NOW)) assert.deepEqual(after[name], ['id', ...idsOf(columns)], name);
    assert.deepEqual(Object.keys(after).sort(), [...Object.keys(NOW), 'Clients'].sort(), 'rien d\'autre ne change de nom');
    assert.deepEqual(after.Clients, ['id', 'Nom', 'Ville'], 'les tables de l\'app et des personnes ne sont pas touchées');
  });
});

test('planGfsNames : les tables d\'abord renommées, puis leurs colonnes sur le nom d\'arrivée ; rien à faire sur un document à jour ou sans table de GFS', () => {
  const actions = planGfsNames(oldDocument());
  assert.deepEqual(actions.slice(0, 2), [['RenameTable', 'GFS_Rangement', 'GFS_Filing'], ['RenameColumn', 'GFS_Filing', 'Utilisateur', 'User']]);
  assert.ok(actions.some(action => action[0] === 'RenameColumn' && action[1] === 'GFS_Placement' && action[2] === 'Cible'), 'GFS_Placement garde son nom : ses colonnes seules changent');
  assert.ok(!actions.some(action => action[0] === 'RenameTable' && action[1] === 'GFS_Placement'));
  assert.ok(actions.every(action => action[0] !== 'RenameTable' || /^GFS_/.test(action[2])));
  assert.equal(planGfsNames(newDocument()), null);
  assert.equal(planGfsNames({ tables: { Clients: ['id', 'Nom'] } }), null);
  assert.equal(planGfsNames(null), null);
});

test('planGfsNames ne touche ni les tables que Sync+ tient ni leurs colonnes (décision du 25/11 : elles gardent leurs noms d\'avant)', () => {
  const kept = { GFS_Fichiers: ['id', 'Identifiant', 'Nom', 'Auteur', 'id_sync'], GFS_Recus: ['id', 'Identifiant', 'Nom', 'Accepte', 'Refuse'], GFS_Recus_2: ['id', 'Nom'], GFS_Synchro: ['id', 'Cle'], GFS_Journal_1: ['id', 'Cle'] };
  const actions = planGfsNames(oldDocument(kept));
  assert.deepEqual(actions.filter(action => Object.keys(kept).some(name => String(action[1]).toLowerCase() === name.toLowerCase())), []);
  assert.deepEqual(planGfsNames({ tables: kept }), null);
});

test('planGfsNames : sans tenir compte de la casse ; une colonne déjà renommée ou absente n\'est pas rejouée ; une colonne que la personne a ajoutée reste', () => {
  const doc = { tables: { gfs_rangement: ['id', 'utilisateur', 'App', 'Fichier', 'Dossier', 'Colonne perso'], GFS_Partages: ['id', 'Cible', 'Target', 'Droit'] } };
  const actions = planGfsNames(doc);
  assert.deepEqual(actions.filter(action => action[1] === 'GFS_Filing'), [
    ['RenameColumn', 'GFS_Filing', 'Utilisateur', 'User'], ['RenameColumn', 'GFS_Filing', 'Fichier', 'File'], ['RenameColumn', 'GFS_Filing', 'Dossier', 'Folder']]);
  assert.deepEqual(actions.filter(action => action[1] === 'GFS_Shares'), [['RenameColumn', 'GFS_Shares', 'Droit', 'Right']], '« Cible » reste : « Target » existe déjà');
});

test('legacyTables et isLegacyForm : un document d\'avant est reconnu, un document à jour ou nouveau ne l\'est pas ; GFS_Placement se reconnaît à ses colonnes', () => {
  assert.deepEqual(legacyTables(oldDocument()), Object.keys(NOW));
  assert.deepEqual(legacyTables(newDocument()), []);
  assert.deepEqual(legacyTables({ tables: {} }), []);
  assert.deepEqual(legacyTables({ tables: { GFS_Placement: ['id', 'Target', 'Space'] } }), []);
  assert.deepEqual(legacyTables({ tables: { GFS_Placement: ['id', 'Cible', 'Espace'] } }), ['GFS_Placement']);
  assert.equal(isLegacyForm('GFS_Filing', ['GFS_Rangement', 'Clients']), true);
  assert.equal(isLegacyForm('GFS_Filing', ['GFS_Filing', 'GFS_Rangement']), false, 'les deux existent : la table d\'arrivée est là, GFS ne la recrée pas');
  assert.equal(isLegacyForm('GFS_Filing', ['Clients']), false);
  assert.equal(isLegacyForm('GFS_Fichiers', ['GFS_Fichiers']), false);
  assert.equal(isLegacyForm('GFS_Placement', ['GFS_Placement'], ['id', 'Cible']), true);
  assert.equal(isLegacyForm('GFS_Placement', ['GFS_Placement'], ['id', 'Target']), false);
  assert.equal(isLegacyForm('GFS_Placement', ['GFS_Placement']), false, 'sans les colonnes, seul le nom compte : il n\'a pas changé');
});

test('renamedOf : une marque notée avant la mise à jour (les pages déjà rangées) parle des noms d\'avant, elle est lue sous les noms d\'arrivée', () => {
  assert.equal(renamedOf('GFS_Rangement'), 'GFS_Filing');
  assert.equal(renamedOf('gfs_corbeille'), 'GFS_Trash');
  assert.equal(renamedOf('GFS_Placement'), 'GFS_Placement');
  assert.equal(renamedOf('GFS_Fichiers'), 'GFS_Fichiers');
  assert.equal(renamedOf('Clients'), 'Clients');
});

test('OwnTable : une table encore sous son nom d\'avant n\'est jamais recréée à côté, ni reçoit une colonne ; lire ne crée rien', async () => {
  const tables = { GFS_Rangement: { columns: ['id', 'Utilisateur', 'App'], rows: [] } };
  const { port } = fakeGrist(tables);
  let asked = 0;
  const own = new OwnTable({ port, name: 'GFS_Filing', columns: FILING_COLUMNS, consent: async () => { asked++; return true; } });
  const state = await own.load();
  assert.deepEqual([state.exists, state.legacy], [false, true]);
  await assert.rejects(() => own.ready(['User']), error => error instanceof LegacyNames && error instanceof TableDeclined);
  assert.equal(asked, 0, 'la personne n\'est pas interrogée : il n\'y a rien à lui faire créer');
  assert.equal(await own.existing(['User']), null);
  assert.deepEqual(Object.keys(tables), ['GFS_Rangement'], 'aucune table ajoutée');
  assert.deepEqual(tables.GFS_Rangement.columns, ['id', 'Utilisateur', 'App'], 'aucune colonne ajoutée');
});

test('OwnTable : GFS_Placement, dont le nom ne change pas, ne reçoit pas de colonne d\'arrivée à côté de celles d\'avant', async () => {
  const tables = { GFS_Placement: { columns: ['id', 'Cible', 'Espace', 'Dossier'], rows: [] } };
  const own = new OwnTable({ port: { doc: fakeGrist(tables).port.doc }, name: 'GFS_Placement', columns: placeColumns(), consent: async () => true });
  await assert.rejects(() => own.ready(['Target']), LegacyNames);
  assert.deepEqual(tables.GFS_Placement.columns, ['id', 'Cible', 'Espace', 'Dossier']);
});

test('OwnTable : à jour, ou sans aucune table de GFS, elle se comporte comme avant (la table naît avec l\'accord de la personne)', async () => {
  const tables = { GFS_Filing: { columns: ['id', 'User', 'App', 'File', 'Value'], rows: [] } };
  const own = new OwnTable({ port: { doc: fakeGrist(tables).port.doc }, name: 'GFS_Filing', columns: FILING_COLUMNS, consent: async () => true });
  const state = await own.ready(['Favorite']);
  assert.deepEqual([state.exists, state.legacy], [true, false]);
  assert.ok(tables.GFS_Filing.columns.includes('Favorite'), 'une colonne absente s\'ajoute avant d\'être écrite');
  const fresh = {};
  const created = await new OwnTable({ port: { doc: fakeGrist(fresh).port.doc }, name: 'GFS_Filing', columns: FILING_COLUMNS, consent: async () => true }).ready();
  assert.equal(created.created, true);
  assert.deepEqual(Object.keys(fresh), ['GFS_Filing']);
});

// Le document que GFS voit : `fetchTable` des tables internes de Grist et `applyUserActions`, sur le faux document du kit (lot atomique, nom pris = suffixe « 2 »).
// `formulas` : { '<table>.<colonne>': formule } que le document porte (celles que Grist a laissées) ; une reprise (`ModifyColumn` avec `formula`) les change.
function docOf(fake, formulas = {}) {
  const doc = {
    formulas,
    fetchTable: async name => {
      const tables = Object.entries(fake.tables());
      if (name === '_grist_Tables') return { id: tables.map((entry, at) => at + 1), tableId: tables.map(([id]) => id) };
      const rows = tables.flatMap(([id, columns], at) => columns.map(column => ({ parentId: at + 1, colId: column, formula: doc.formulas[`${id}.${column}`] || '' })));
      return { id: rows.map((row, at) => at + 1), parentId: rows.map(row => row.parentId), colId: rows.map(row => row.colId), formula: rows.map(row => row.formula),
        isFormula: rows.map(row => row.formula !== '') };
    },
    applyUserActions: async actions => {
      await fake.port.apply(actions);
      for (const [verb, table, column, values] of actions) if (verb === 'ModifyColumn' && values && values.formula !== undefined) doc.formulas[`${table}.${column}`] = values.formula;
    },
  };
  return doc;
}
const flow = (fake, extra = {}) => ({ doc: extra.doc || docOf(fake), isOwner: () => true, readOnly: () => false, language: () => 'fr', container: null, inertTargets: () => [], ...extra });
const documentOf = schema => fakeDoc(Object.fromEntries(Object.entries(schema.tables).map(([name, columns]) => [name, { columns, rows: 2 }])));

test('readSchema : les tables et leurs colonnes, sans les tables internes de Grist', async () => {
  const fake = documentOf(oldDocument({ _grist_Pages: ['id'], GristHidden_x: ['id'] }));
  const schema = await readSchema(docOf(fake));
  assert.deepEqual(Object.keys(schema.tables).includes('GFS_Rangement'), true);
  assert.deepEqual(Object.keys(schema.tables).filter(name => /^_?grist/i.test(name)), []);
  assert.deepEqual(schema.tables.GFS_Espaces, ['id', 'Cle', 'Nom', 'Voit']);
});

test('updateNames : un propriétaire, un document d\'avant : la fenêtre est montrée, le lot part d\'un seul envoi, et le document n\'est plus d\'avant', async () => {
  const fake = documentOf(oldDocument());
  let shownPrepared = null;
  const show = async ({ prepared, run }) => { shownPrepared = prepared; const result = await run(); return { state: result.state, result }; };
  const outcome = await updateNames(flow(fake, { show }));
  assert.equal(shownPrepared.state, 'ready');
  assert.equal(shownPrepared.summary.tables.length, 7 - 1, 'six tables renommées (GFS_Placement ne change que ses colonnes)');
  assert.equal(fake.applied.length, 1, 'un seul lot');
  assert.deepEqual([outcome.state, outcome.legacy], ['done', []]);
  assert.deepEqual(Object.keys(fake.tables()).sort(), [...Object.keys(NOW), 'Clients'].sort());
});

test('updateNames : un document à jour ne montre rien et n\'écrit rien ; une personne qui n\'est pas propriétaire non plus, et le document reste d\'avant', async () => {
  const upToDate = documentOf(newDocument());
  let opened = 0;
  const show = async () => { opened++; return { state: 'done' }; };
  assert.deepEqual(await updateNames(flow(upToDate, { show })), { state: 'none', legacy: [] });
  const old = documentOf(oldDocument());
  const outcome = await updateNames(flow(old, { show, isOwner: () => false }));
  assert.equal(outcome.state, 'wait');
  assert.deepEqual(outcome.legacy, Object.keys(NOW));
  assert.equal((await updateNames(flow(old, { show, isOwner: () => null }))).state, 'wait', 'une propriété non prouvée vaut « non »');
  assert.equal((await updateNames(flow(old, { show, readOnly: () => true }))).state, 'wait', 'une page en lecture seule non plus');
  assert.deepEqual([opened, old.applied.length, upToDate.applied.length], [0, 0, 0]);
});

test('updateNames : un nom d\'arrivée déjà pris : pas de fenêtre, rien n\'est renommé, le document reste d\'avant', async () => {
  const fake = documentOf(oldDocument({ GFS_Filing: ['id', 'User'] }));
  let opened = 0;
  const outcome = await updateNames(flow(fake, { show: async () => { opened++; return { state: 'done' }; } }));
  assert.equal(outcome.state, 'blocked');
  assert.equal(opened, 0);
  assert.equal(fake.applied.length, 0);
  assert.ok(outcome.legacy.includes('GFS_Spaces'), 'les autres tables restent d\'avant, et GFS n\'y écrit rien');
});

test('updateNames : « Continuer sans mettre à jour » (refus de Grist) laisse le document d\'avant ; la panne de lecture ne fait jamais lever', async () => {
  const fake = documentOf(oldDocument());
  fake.next = { refuse: 'Blocked by table structure access rules' };
  const show = async ({ run }) => { const result = await run(); return { state: 'skipped', result }; };
  const outcome = await updateNames(flow(fake, { show }));
  assert.deepEqual([outcome.state, outcome.legacy.length], ['skipped', 7]);
  assert.deepEqual(Object.keys(fake.tables()).includes('GFS_Rangement'), true);
  const broken = { fetchTable: async () => { throw new Error('boom'); }, applyUserActions: async () => {} };
  assert.deepEqual(await updateNames({ ...flow(fake), doc: broken }), { state: 'wait', legacy: [] });
});

// ---- Les formules que Grist ne suit pas (mesuré dans Grist 1.7.19 : labo/run-noms-gfs.mjs) ----

const GOLDEN = JSON.parse(readFileSync(new URL('./golden/formules-apres-renommage.json', import.meta.url), 'utf8'));
const owned = (table, column) => /^GFS_(Shares|Spaces|Placement)$/.test(table) || HELPERS.includes(column);

test('formules : celles que Grist a laissées à l\'ancien nom (mesurées) deviennent exactement celles que GFS écrit aujourd\'hui, et les autres ne bougent pas', () => {
  const keys = Object.keys(GOLDEN.stale);
  assert.equal(keys.length, 15, 'quinze formules mesurées à reprendre');
  for (const key of keys) assert.equal(rewriteFormula(GOLDEN.stale[key]), GOLDEN.expected[key], key);
  for (const [key, text] of Object.entries(GOLDEN.untouched)) assert.equal(rewriteFormula(text), text, `${key} : déjà suivie par Grist, rien à reprendre`);
  assert.deepEqual(staleFormulas(GOLDEN.untouched, owned), []);
  assert.deepEqual(staleFormulas(GOLDEN.stale, owned).map(item => `${item.table}.${item.column}`).sort(), keys.sort());
});

test('formules : reprendre est idempotent, et ne touche que les variables de boucle des tables de GFS (jamais celle de la table d\'une source de groupes)', () => {
  const stale = GOLDEN.stale['GFS_Fichiers.GFS_Calc'];
  assert.notEqual(rewriteFormula(stale), stale);
  assert.equal(rewriteFormula(rewriteFormula(stale)), rewriteFormula(stale));
  assert.equal(rewriteFormula('x = p.Droit + found.Droit + pp.Droit + p.Valide1 + p.Valide'), 'x = p.Right + found.Droit + pp.Droit + p.AuthorOwner + p.Valid');
  assert.equal(rewriteFormula('for r in Equipes.lookupRecords(Groupe=$Name): out.add(r.Dossier)'), 'for r in Equipes.lookupRecords(Groupe=$Name): out.add(r.Folder)',
    'la variable seule ne dit pas la table : c\'est `owned` qui écarte GFS_Groups.Members');
  const members = { 'GFS_Groups.Members': 'for r in T.lookupRecords(G=$Name):\n  out.add(r.Dossier)', 'Clients.Total': 'p.Droit', 'GFS_Shares.Valid': 'p.Droit' };
  assert.deepEqual(staleFormulas(members, owned).map(item => `${item.table}.${item.column}`), ['GFS_Shares.Valid']);
});

test('formules : le code d\'aujourd\'hui n\'écrit aucun ancien nom sur une variable de boucle, et chaque boucle sur une table de GFS a sa variable dans la liste', () => {
  const app = { id: 'publipostage', fichiers: [{ table: 'Publipostage_Modeles', colonnes: { id: 'Identifiant' } }] };
  const targets = targetsOf([app]);
  const texts = [...shareColumns(targets), ...spaceColumns(), ...placeColumns(), ...groupColumns([{ table: 'Equipes', email: 'Courriel', group: 'Equipe' }]),
    ...targets.flatMap(target => helperColumns(target))].filter(column => column.isFormula).map(column => column.formula);
  assert.ok(texts.length > 20);
  const ours = new Set(GFS_RENAMES.map(entry => entry.table));
  for (const text of texts) {
    assert.equal(rewriteFormula(text), text, 'une formule écrite aujourd\'hui n\'a rien à reprendre');
    for (const [, variable, table] of [...text.matchAll(/for (\w+) in (\w+)\.lookupRecords/g)]) {
      if (ours.has(table)) assert.equal(LOOP_VARIABLES[variable], table, `la boucle « ${variable} in ${table} » doit être dans LOOP_VARIABLES`);
    }
  }
});

// Un document dont les tables portent leurs noms d'arrivée mais dont des formules sont restées à l'ancien nom (ce que Grist laisse : mesuré).
const staleDocument = () => ({ tables: { ...newDocument().tables, Publipostage_Modeles: ['id', 'Nom', 'GFS_Calc', 'GFS_Dossier'] } });
const STALE = { 'GFS_Shares.Valid': 'if p.Valide and p.Actif: pass', 'Publipostage_Modeles.GFS_Calc': 'for p in GFS_Shares.lookupRecords(Target=1):\n  x = p.Droit',
  'Publipostage_Modeles.GFS_Dossier': 'for r in GFS_Filing.lookupRecords(App="a"):\n  x = r.Utilisateur', 'GFS_Groups.Members': 'for r in T.lookupRecords(G=1):\n  x = r.Dossier' };

test('mendFormulas : un seul lot de ModifyColumn, rien d\'autre que le texte de formules ; une seconde fois, rien à faire', async () => {
  const fake = documentOf(staleDocument());
  const doc = docOf(fake, { ...STALE });
  assert.deepEqual(await mendFormulas(doc), { ok: true, count: 3, detail: '' });
  assert.equal(fake.applied.length, 1);
  assert.ok(fake.applied[0].every(action => action[0] === 'ModifyColumn' && Object.keys(action[3]).join() === 'formula'));
  assert.equal(doc.formulas['GFS_Shares.Valid'], 'if p.Valid and p.Active: pass');
  assert.equal(doc.formulas['Publipostage_Modeles.GFS_Dossier'], 'for r in GFS_Filing.lookupRecords(App="a"):\n  x = r.User');
  assert.equal(doc.formulas['GFS_Groups.Members'], STALE['GFS_Groups.Members'], 'la table d\'une source de groupes n\'est pas à GFS');
  assert.deepEqual(await mendFormulas(doc), { ok: true, count: 0, detail: '' });
  assert.equal(fake.applied.length, 1);
});

test('mendFormulas : Grist qui refuse ou qui ne répond pas rend ok: false avec le détail, sans lever', async () => {
  const fake = documentOf(staleDocument());
  const doc = docOf(fake, { ...STALE });
  doc.applyUserActions = async () => { throw new Error('Blocked by table structure access rules'); };
  const result = await mendFormulas(doc);
  assert.deepEqual([result.ok, /Blocked/.test(result.detail)], [false, true]);
  assert.equal((await mendFormulas({ fetchTable: async () => { throw new Error('boom'); } })).ok, false);
});

test('updateNames : après les noms, la même fenêtre reprend les formules ; elles échouent : résultat inconnu (« Vérifier » rejoue, les noms sont faits)', async () => {
  const fake = documentOf(oldDocument());
  const doc = docOf(fake, { 'GFS_Shares.Valid': 'p.Valide', 'GFS_Placement.Sees': 'ok' });
  const results = [];
  const show = async ({ run }) => { const result = await run(); results.push(result); return { state: result.state, result }; };
  const outcome = await updateNames(flow(fake, { doc, show }));
  assert.deepEqual([outcome.state, outcome.legacy, doc.formulas['GFS_Shares.Valid']], ['done', [], 'p.Valid']);
  assert.equal(fake.applied.length, 2, 'le lot des noms, puis celui des formules');
  const again = documentOf(oldDocument());
  const failing = docOf(again, { 'GFS_Shares.Valid': 'p.Valide' });
  const apply = failing.applyUserActions;
  failing.applyUserActions = async actions => { if (actions[0][0] === 'ModifyColumn') throw new Error('panne'); return apply(actions); };
  const outcome2 = await updateNames(flow(again, { doc: failing, show }));
  assert.equal(results[1].state, 'unknown');
  assert.match(results[1].detail, /GFS_Shares|panne/);
  assert.deepEqual(outcome2.legacy, ['GFS_Shares'], 'noms faits, formule restée : GFS n\'écrit rien tant que ce n\'est pas repris');
  const retry = await updateNames(flow(again, { doc: Object.assign(failing, { applyUserActions: apply }), show }));
  assert.deepEqual([retry.state, retry.legacy, failing.formulas['GFS_Shares.Valid']], ['none', [], 'p.Valid'], 'interrompue : reprise sans fenêtre à l\'ouverture suivante');
});

test('updateNames : formules restées à l\'ancien nom, plus aucun nom à changer : reprise sans fenêtre pour qui peut écrire ; sinon GFS n\'écrit rien', async () => {
  let opened = 0;
  const show = async () => { opened++; return { state: 'done' }; };
  const mine = documentOf(staleDocument());
  const doc = docOf(mine, { ...STALE });
  assert.deepEqual(await updateNames(flow(mine, { doc, show })), { state: 'none', legacy: [] });
  assert.equal(doc.formulas['GFS_Shares.Valid'], 'if p.Valid and p.Active: pass');
  assert.equal(opened, 0);
  for (const extra of [{ isOwner: () => false }, { isOwner: () => null }, { readOnly: () => true }]) {
    const other = documentOf(staleDocument());
    const stale = docOf(other, { ...STALE });
    const outcome = await updateNames(flow(other, { doc: stale, show, ...extra }));
    assert.deepEqual([outcome.state, outcome.legacy.sort(), other.applied.length], ['none', ['GFS_Shares', 'Publipostage_Modeles'], 0], JSON.stringify(Object.keys(extra)));
  }
});
