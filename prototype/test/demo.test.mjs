// La démo des inscriptions (js/demo.js) : le parcours lu à sa place (la famille « formation » et l'émargement de la galerie de Publipostage+),
// les lots qu'il donne à Grist, et le geste entier contre un faux Grist en mémoire qui refuse, comme le vrai, une colonne absente. Ce que Grist
// fait vraiment des lots (identifiants rendus, Références affichées, formules) se mesure dans le labo (run-demo.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';
import { createI18n } from '../js/i18n.js';
import { APP_TABLES, DemoError, dateValue, demoReport, demoSummary, displayActions, formulaActions, freeName, loadDemo, modelRecord, ownAddress, planDemo,
  rowsAction, runDemo, tableActions } from '../js/demo.js';

const read = { json: async path => JSON.parse(await readFile(join(ROOT, path), 'utf8')), text: path => readFile(join(ROOT, path), 'utf8') };
const NOW = new Date(2026, 9, 21, 15, 30);
const TODAY = Date.UTC(2026, 9, 21) / 1000;
const ADDRESS = 'https://exemple.org/gfs/index.html';
const OWN = `${ADDRESS}?language=fr&dev`;

// Un faux Grist : des tables en mémoire, leurs métadonnées lues comme `_grist_Tables`, `_grist_Tables_column` et `_grist_Views_section`. Chaque
// table a sa page (le numéro de la page est celui de la table) avec son tableau ; la section de GFS posée par la personne est sur la page 0.
function fakeGrist(initial = {}, { failOn = null, refuse = () => false } = {}) {
  const tables = structuredClone(initial);
  const actions = [];
  const custom = [{ id: 900, parentId: 0, parentKey: 'custom', options: JSON.stringify({ customView: JSON.stringify({ mode: 'url', url: OWN }) }) }];
  let ref = 0;
  const refs = new Map();
  const refOf = key => { if (!refs.has(key)) refs.set(key, ++ref); return refs.get(key); };
  const meta = () => {
    const names = Object.keys(tables);
    const columns = names.flatMap(name => tables[name].columns.map(column => [name, column]));
    const sections = [...names.map(name => ({ id: refOf(`grid:${name}`), parentId: refOf(name), parentKey: 'record', options: '' })), ...custom];
    return {
      _grist_Tables: { id: names.map(name => refOf(name)), tableId: names, primaryViewId: names.map(name => refOf(name)) },
      _grist_Tables_column: { id: columns.map(([name, column]) => refOf(`${name}.${column}`)), parentId: columns.map(([name]) => refOf(name)), colId: columns.map(([, column]) => column) },
      _grist_Views_section: Object.fromEntries(['id', 'parentId', 'parentKey', 'options'].map(key => [key, sections.map(section => section[key])])),
    };
  };
  const section = (tableRef, view, kind) => { custom.push({ id: 1000 + custom.length, tableRef, parentId: view, parentKey: kind, options: '' }); return { sectionRef: 1000 + custom.length - 1 }; };
  const update = (name, id, values) => { if (name === '_grist_Views_section') Object.assign(custom.find(item => item.id === id), values); return null; };
  const insert = (name, record) => {
    const table = tables[name];
    const unknown = Object.keys(record).filter(column => !table.columns.includes(column));
    if (unknown.length) throw new Error(`Invalid column ${unknown[0]}`);
    table.rows.push({ id: table.rows.length + 1, ...record });
    return table.rows.length;
  };
  const apply = ([verb, name, a, b, c]) => {
    if (failOn === verb || refuse([verb, name, a])) throw new Error(`refus de ${verb}`);
    if (verb === 'AddTable') { tables[name] = { columns: a.map(column => column.id), rows: [] }; return { table_id: name }; }
    if (verb === 'RemoveTable') { delete tables[name]; return null; }
    if (verb === 'AddColumn') { tables[name].columns.push(a); return null; }
    if (verb === 'AddRecord') return insert(name, b);
    if (verb === 'BulkAddRecord') return a.map((_, i) => insert(name, Object.fromEntries(Object.entries(b).map(([column, values]) => [column, values[i]]))));
    if (verb === 'CreateViewSection') return section(name, a, b);
    if (verb === 'UpdateRecord') return update(name, a, b);
    if (verb === 'SetDisplayFormula') return null;
    throw new Error(`verbe inattendu ${verb} ${c ?? ''}`);
  };
  const doc = {
    fetchTable: async name => {
      if (name.startsWith('_grist_')) return meta()[name];
      const table = tables[name];
      return Object.fromEntries(['id', ...table.columns].map(column => [column, table.rows.map(row => row[column])]));
    },
    applyUserActions: async list => {
      actions.push(...list);
      const snapshot = structuredClone(tables);
      try { return { retValues: list.map(apply) }; } catch (error) { for (const key of Object.keys(tables)) delete tables[key]; Object.assign(tables, snapshot); throw error; }
    },
  };
  return { doc, tables, actions, custom };
}

test('une date du parcours : n jours après aujourd\'hui, ou une date ISO de la galerie, en secondes à minuit UTC', () => {
  assert.equal(dateValue({ jours: 0 }, NOW), TODAY);
  assert.equal(dateValue({ jours: -15 }, NOW), TODAY - 15 * 86400);
  assert.equal(dateValue('2026-11-09', NOW), Date.UTC(2026, 10, 9) / 1000);
  assert.equal(dateValue('texte', NOW), 'texte');
});

test('le parcours reprend la famille « formation » et l\'émargement de la galerie de Publipostage+, complétés', async () => {
  const pack = await loadDemo(read);
  assert.deepEqual(pack.tables.map(table => table.id), ['Sessions', 'Participants']);
  const sessions = pack.tables[0].columns.map(column => column.id);
  assert.ok(['Numero', 'Intitule', 'Debut', 'Fin', 'Lieu', 'Formateur', 'Duree', 'Places', 'PlacesRestantes'].every(id => sessions.includes(id)));
  assert.equal(pack.rows.Sessions.length, 2);
  assert.equal(pack.rows.Participants.length, 20);
  assert.deepEqual(pack.rows.Sessions[0].Debut, { jours: -15 }); // la date de la galerie est remplacée
  assert.ok(pack.rows.Participants.every(row => row.Nom && row.Session && row.Statut));
  assert.deepEqual(pack.models.map(model => model.name), ['Convocation', 'Émargement', 'Attestation de formation']);
  const sheet = pack.models[1];
  assert.equal(sheet.page.orientation, 'landscape');
  assert.ok(sheet.headerFooter && sheet.headerFooter.enabled);
  assert.match(sheet.html, /data-key="Sessions\.Numero"/);
  assert.match(pack.models[0].html, /data-key="Participants\.Nom"/);
  assert.equal(pack.links.length, 2);
  assert.equal(pack.workflow.table, 'Participants');
  assert.equal(pack.workflow.graphe.active, false);
});

test('les lots : les tables sans leurs formules, puis les formules ; les lignes avec dates en secondes et Références traduites', async () => {
  const pack = await loadDemo(read);
  const [sessions, participants] = tableActions(pack);
  assert.equal(sessions[0], 'AddTable');
  assert.ok(!sessions[2].some(column => column.id === 'PlacesRestantes'));
  assert.equal(participants[2].find(column => column.id === 'Statut').widgetOptions, JSON.stringify({ choices: ['Confirmée', 'Liste d’attente', 'Annulée'] }));
  const formulas = formulaActions(pack);
  assert.ok(formulas.every(action => action[0] === 'AddColumn' && action[3].isFormula && action[3].formula));
  assert.ok(formulas.some(action => action[1] === 'Participants' && action[2] === 'AConvoquer'));
  const ids = new Map([['Sessions', new Map([[1, 7], [2, 8]])]]);
  const [verb, table, rowIds, values] = rowsAction(pack.tables[1], pack.rows.Participants, NOW, ids);
  assert.equal(verb, 'BulkAddRecord');
  assert.equal(table, 'Participants');
  assert.equal(rowIds.length, 20);
  assert.deepEqual([...new Set(values.Session)], [7, 8]);
  assert.equal(values.DateInscription[0], TODAY - 45 * 86400);
  assert.equal(values.ConvoqueLe[12], null); // en liste d'attente : jamais convoquée
  assert.equal(values.Present[13], false);
  assert.ok(!('AConvoquer' in values));
});

test('le plan : une table du parcours déjà là arrête tout ; les tables des apps et de GFS qui manquent seront créées', async () => {
  const pack = await loadDemo(read);
  const schema = new Map([['participants', { id: 'participants' }], ['automation', { id: 'Automation' }]]);
  assert.deepEqual(planDemo(pack, schema), { taken: ['Participants'], created: ['Publipostage_Modeles', 'Publipostage_LiensTables', 'GFS_Rangement'] });
});

test('un modèle s\'écrit dans les seules colonnes que la table a ; un nom pris reçoit un numéro', async () => {
  const pack = await loadDemo(read);
  const record = modelRecord(pack.models[1], 'Émargement', new Set(['nom', 'contenu', 'typemodele', 'margins']), NOW);
  assert.deepEqual(Object.keys(record).sort(), ['Contenu', 'Margins', 'Nom', 'TypeModele']);
  assert.deepEqual(JSON.parse(record.Margins), { top: 18, right: 12, bottom: 16, left: 12, orientation: 'landscape', format: 'A4' });
  assert.equal(freeName('Convocation', ['convocation', 'Convocation (2)']), 'Convocation (3)');
  assert.equal(freeName('Attestation', ['Convocation']), 'Attestation');
});

test('le geste entier : tables, formules, lignes, Références affichées, apps installées, modèles, règles et automatisme', async () => {
  const pack = await loadDemo(read);
  const { doc, tables, actions } = fakeGrist({ Clients: { columns: ['Nom'], rows: [] } });
  const installed = [];
  const report = await runDemo({ doc, pack, now: NOW, install: async ids => installed.push(...ids), address: ADDRESS });
  assert.equal(tables.Sessions.rows.length, 2);
  assert.equal(tables.Participants.rows.length, 20);
  assert.deepEqual([...new Set(tables.Participants.rows.map(row => row.Session))], [1, 2]);
  assert.ok(actions.some(action => action[0] === 'SetDisplayFormula' && action[4] === '$Session.Numero'));
  assert.deepEqual(installed, ['automation']);
  assert.deepEqual(tables.Publipostage_Modeles.rows.map(row => row.Nom), ['Convocation', 'Émargement', 'Attestation de formation']);
  assert.ok(tables.Publipostage_Modeles.rows.every(row => row.TypeModele === 'document' && row.ModifiePar));
  assert.deepEqual(tables.Publipostage_LiensTables.rows.map(row => [row.TableCible, row.ColonneCible, row.ColonneSource]), [['Sessions', 'id', 'Session'], ['Participants', 'Session', 'id']]);
  const workflow = tables.Automation.rows[0];
  assert.equal(workflow.Type, 'Workflow');
  assert.equal(workflow.Actif, false);
  assert.equal(JSON.parse(workflow.Config).nodes.length, 4);
  assert.ok(tables.Automation.columns.includes('Auteur'));
  assert.deepEqual(report, { models: { count: 3 }, links: { count: 2 }, workflow: { count: 1 }, pages: { count: 2 } });
});

test('le parcours déjà posé : rien n\'est écrit', async () => {
  const pack = await loadDemo(read);
  const { doc, actions } = fakeGrist({ Sessions: { columns: ['Numero'], rows: [] } });
  await assert.rejects(runDemo({ doc, pack, now: NOW, install: async () => assert.fail('rien à installer') }), error => error instanceof DemoError && error.code === 'taken');
  assert.deepEqual(actions, []);
});

test('un lot refusé après la création des tables : les tables du parcours sont retirées, rien d\'autre n\'est fait', async () => {
  const pack = await loadDemo(read);
  const { doc, tables } = fakeGrist({}, { failOn: 'AddColumn' });
  await assert.rejects(runDemo({ doc, pack, now: NOW, install: async () => assert.fail('rien à installer') }), /refus de AddColumn/);
  assert.deepEqual(Object.keys(tables), []);
});

test('les tables des apps déjà là : leurs colonnes sont respectées, une règle et un automatisme déjà posés restent tels quels', async () => {
  const pack = await loadDemo(read);
  const { doc, tables } = fakeGrist({
    Publipostage_Modeles: { columns: ['Nom', 'Contenu', 'DateModif'], rows: [{ id: 1, Nom: 'Convocation', Contenu: '<p></p>' }] },
    Publipostage_LiensTables: { columns: ['TableCible', 'Mode', 'ColonneCible', 'ColonneSource'], rows: [{ id: 1, TableCible: 'Sessions', Mode: 'singleton' }] },
    Automation: { columns: APP_TABLES.automation.columns.map(([id]) => id), rows: [{ id: 1, Type: 'Workflow', Table: 'Participants', Config: '{}' }] },
  });
  const report = await runDemo({ doc, pack, now: NOW, install: async () => {} });
  assert.deepEqual(tables.Publipostage_Modeles.rows.map(row => row.Nom), ['Convocation', 'Convocation (2)', 'Émargement', 'Attestation de formation']);
  assert.deepEqual(tables.Publipostage_LiensTables.rows.map(row => [row.TableCible, row.Mode]), [['Sessions', 'singleton'], ['Participants', 'match']]);
  assert.equal(tables.Automation.rows.length, 1);
  assert.deepEqual(report, { models: { count: 3 }, links: { count: 1 }, workflow: { count: 0, skipped: 'Automation' }, pages: { count: 2 } });
});

test('un Grist qui refuse la formule d\'auteur reçoit la table d\'Automation+ sans elle, comme l\'app la crée', async () => {
  const pack = await loadDemo(read);
  const { doc, tables } = fakeGrist({}, { refuse: ([verb, name, columns]) => verb === 'AddTable' && name === 'Automation' && columns.some(column => column.id === 'Auteur') });
  const report = await runDemo({ doc, pack, now: NOW, install: async () => {} });
  assert.ok(!tables.Automation.columns.includes('Auteur'));
  assert.equal(tables.Automation.rows.length, 1);
  assert.deepEqual(report.workflow, { count: 1 });
});

test('une table d\'app sans ses colonnes essentielles ne sert pas : rien n\'y est écrit', async () => {
  const pack = await loadDemo(read);
  const { doc, tables } = fakeGrist({ Publipostage_Modeles: { columns: ['Nom'], rows: [] } });
  const report = await runDemo({ doc, pack, now: NOW, install: async () => {} });
  assert.deepEqual(report.models, { count: 0, skipped: 'Publipostage_Modeles' });
  assert.equal(tables.Publipostage_Modeles.rows.length, 0);
});

test('ce que la personne lit, en français et en anglais', async () => {
  const pack = await loadDemo(read);
  for (const lang of ['fr', 'en']) {
    const { t } = createI18n(lang);
    const lines = demoSummary(pack, { created: ['Automation'] }, t);
    assert.equal(lines.length, 6);
    assert.ok(lines.every(line => !/\{|demo\./.test(line)), lines.join(' | '));
    const report = demoReport({ models: { count: 3 }, links: { count: 1 }, workflow: { count: 0, skipped: 'Automation' }, pages: { count: 2 } }, t);
    assert.equal(report.length, 5);
    assert.ok(report.every(line => !/\{|demo\./.test(line)), report.join(' | '));
    const manual = demoReport({ models: { count: 3 }, links: { count: 2 }, workflow: { count: 1 }, pages: { count: 0, error: 'refus' } }, t);
    assert.equal(manual.length, 1);
    assert.match(manual[0], /refus/);
  }
  assert.match(demoSummary(pack, { created: [] }, createI18n('fr').t)[0], /2 sessions, 20 inscriptions/);
});

test('les colonnes affichées des Références : seulement quand les deux colonnes existent', async () => {
  const pack = await loadDemo(read);
  const schema = new Map([
    ['participants', { id: 'Participants', columns: new Map([['session', { id: 'Session', ref: 11 }]]) }],
    ['sessions', { id: 'Sessions', columns: new Map([['numero', { id: 'Numero', ref: 5 }]]) }],
  ]);
  assert.deepEqual(displayActions(pack, schema), [
    ['UpdateRecord', '_grist_Tables_column', 11, { visibleCol: 5 }],
    ['SetDisplayFormula', 'Participants', null, 11, '$Session.Numero'],
  ]);
  assert.deepEqual(displayActions(pack, new Map()), []);
});

test('l\'adresse des pages prêtes : celle que la personne a posée pour GFS, sinon celle de la page avec `?dev`', () => {
  const sections = { options: ['', '{"customView":"{\\"mode\\":\\"url\\",\\"url\\":\\"https://autre.org/x\\"}"}', JSON.stringify({ customView: JSON.stringify({ mode: 'url', url: OWN }) }), '{illisible'] };
  assert.equal(ownAddress(sections, ADDRESS), OWN);
  assert.equal(ownAddress({ options: [] }, ADDRESS), `${ADDRESS}?dev`);
});

test('les pages prêtes : GFS à droite du tableau de Participants et de Sessions, à son adresse, qui suit la ligne choisie, sans accès donné', async () => {
  const pack = await loadDemo(read);
  const { doc, actions, custom } = fakeGrist();
  await runDemo({ doc, pack, now: NOW, install: async () => {}, address: ADDRESS });
  const meta = await doc.fetchTable('_grist_Tables');
  const added = custom.filter(item => item.id !== 900);
  assert.equal(added.length, 2);
  pack.pages.forEach((id, i) => {
    const view = meta.primaryViewId[meta.tableId.indexOf(id)];
    const layout = (actions.find(action => action[0] === 'UpdateRecord' && action[1] === '_grist_Views' && action[2] === view) || [])[3];
    assert.equal(added[i].tableRef, meta.id[meta.tableId.indexOf(id)]);
    assert.equal(added[i].parentId, view);
    assert.equal(added[i].parentKey, 'custom');
    assert.ok(added[i].linkSrcSectionRef && added[i].linkSrcColRef === 0 && added[i].linkTargetColRef === 0);
    const customView = JSON.parse(JSON.parse(added[i].options).customView);
    assert.equal(customView.url, OWN);
    assert.equal(customView.access, '');
    assert.deepEqual(JSON.parse(layout.layoutSpec), { children: [{ children: [{ leaf: added[i].linkSrcSectionRef }, { leaf: added[i].id }] }] });
  });
});

test('des pages qui ne se préparent pas n\'annulent rien : le compte rendu le dit', async () => {
  const pack = await loadDemo(read);
  const { doc, tables } = fakeGrist({}, { failOn: 'CreateViewSection' });
  const warn = console.warn;
  console.warn = () => {};
  try {
    const report = await runDemo({ doc, pack, now: NOW, install: async () => {}, address: ADDRESS });
    assert.deepEqual(report.pages, { count: 0, error: 'refus de CreateViewSection' });
    assert.equal(tables.Participants.rows.length, 20);
    assert.equal(tables.Publipostage_Modeles.rows.length, 3);
  } finally { console.warn = warn; }
});
