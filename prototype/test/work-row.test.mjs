// La ligne de travail (contrats 4.5) : ce que l'app reçoit, la relecture, les tables qu'on peut choisir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorkRow, encode, pollDelay, rowLabel, viewColumns, workTables } from '../js/work-row.js';

// Un document : Participants (une Référence affichée par le numéro de la session, une date) et Sessions ; les métadonnées comme Grist les rend.
const META = {
  _grist_Tables: { id: [1, 2], tableId: ['Sessions', 'Participants'] },
  _grist_Tables_column: {
    id: [1, 2, 3, 4, 5, 6, 7],
    colId: ['Numero', 'manualSort', 'Nom', 'Session', 'gristHelper_Display', 'DateInscription', 'manualSort'],
    type: ['Text', 'ManualSortPos', 'Text', 'Ref:Sessions', 'Any', 'Date', 'ManualSortPos'],
    parentId: [1, 1, 2, 2, 2, 2, 2],
    displayCol: [0, 0, 0, 5, 0, 0, 0],
  },
};
const PARTICIPANTS = () => ({ id: [1, 2, 3], manualSort: [3, 1, 2], Nom: ['Martin', 'Durand', 'Ben Saïd'], Session: [2, 1, 2], gristHelper_Display: ['S-2', 'S-1', 'S-2'], DateInscription: [86400, null, 0] });

function fakeDoc(tables = {}) {
  const data = { ...META, Participants: PARTICIPANTS(), Sessions: { id: [1, 2], manualSort: [1, 2], Numero: ['S-1', 'S-2'] }, ...tables };
  const reads = [];
  return { data, reads, fetchTable: async id => { reads.push(id); return JSON.parse(JSON.stringify(data[id])); } };
}
function fakeTimers() {
  const pending = new Map();
  let next = 1;
  return {
    pending,
    setTimeout: (fn, ms) => { pending.set(next, { fn, ms }); return next++; },
    clearTimeout: id => pending.delete(id),
    async fire() { const [[id, { fn }]] = [...pending]; pending.delete(id); await fn(); await new Promise(resolve => setImmediate(resolve)); },
  };
}
// L'état de Grist pour la section (la table Clients) et sa vue.
function gristSide() {
  const listeners = new Set();
  const calls = [];
  const base = {
    options: { settings: { accessLevel: 'full' } }, theme: { appearance: 'light' }, table: { tableId: 'Clients', rowId: 1, dataChange: true }, grantedAccess: 'full',
    tableNow: () => ({ tableId: 'Clients', rowId: 2, dataChange: true }),
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    feed: (kind, message) => listeners.forEach(listener => listener(kind, message)),
  };
  const view = new Proxy({}, { get: (target, name) => (...args) => { calls.push([name, ...args]); return Promise.resolve(`grist:${name}`); } });
  return { base, port: { doc: null, widget: { w: 1 }, view }, calls };
}

test('une valeur est encodée comme la vue de Grist la rend : Date, DateTime, Référence ; le reste tel quel', () => {
  assert.deepEqual(encode(86400, 'Date'), ['d', 86400]);
  assert.deepEqual(encode(10, 'DateTime:Europe/Paris'), ['D', 10, 'Europe/Paris']);
  assert.deepEqual(encode(2, 'Ref:Sessions'), ['R', 'Sessions', 2]);
  assert.equal(encode(2, 'Numeric'), 2);
  assert.equal(encode('S-2', 'Ref:Sessions'), 'S-2');
  assert.equal(encode(null, 'Date'), null);
});

test('les colonnes de la vue : sans manualSort ni colonnes d\'aide, la Référence par sa colonne affichée', () => {
  assert.deepEqual(viewColumns(META._grist_Tables, META._grist_Tables_column, 'Participants'), [
    { colId: 'Nom', type: 'Text', shown: 'Nom' }, { colId: 'Session', type: 'Ref:Sessions', shown: 'gristHelper_Display' }, { colId: 'DateInscription', type: 'Date', shown: 'DateInscription' }]);
});

test('les tables qu\'on peut choisir : ni Grist, ni GFS, ni les tables des apps', () => {
  const manifests = [{ tables: { prefixe: 'Publipostage_' }, fichiers: [{ table: 'Publipostage_Modeles' }] }, { tables: { prefixe: 'Automation_' } }, { fichiers: [{ table: 'Modeles' }] }];
  assert.deepEqual(workTables(['Clients', '_grist_Tables', 'GFS_Rangement', 'Publipostage_LiensTables', 'Automation', 'Automation_Log', 'Modeles', 'Participants'], manifests), ['Clients', 'Participants']);
});

test('le texte d\'une ligne : ses quatre premières valeurs, une date en jour, la recherche sur toutes ; sans valeur, son numéro', () => {
  const columns = viewColumns(META._grist_Tables, META._grist_Tables_column, 'Participants');
  assert.deepEqual(rowLabel(PARTICIPANTS(), 0, columns), { label: 'Martin · S-2 · 1970-01-02', search: 'Martin S-2 1970-01-02' });
  const many = ['A', 'B', 'C', 'D', 'E'].map(colId => ({ colId, type: 'Text', shown: colId }));
  assert.deepEqual(rowLabel({ id: [1], A: ['a'], B: [''], C: ['c'], D: ['d'], E: ['e'] }, 0, [...many, { colId: 'F', type: 'Text', shown: 'F' }]), { label: 'a · c · d · e', search: 'a c d e' });
  assert.deepEqual(rowLabel({ id: [7], Nom: [''] }, 0, [{ colId: 'Nom', type: 'Text', shown: 'Nom' }]), { label: '#7', search: '' });
});

test('le rythme de la relecture suit la taille de la table', () => {
  assert.deepEqual([0, 5000, 5001, 20000, 20001].map(pollDelay), [2000, 2000, 5000, 5000, 10000]);
});

test('sans choix, tout est celui de Grist', async () => {
  const { base, port, calls } = gristSide();
  const work = new WorkRow({ doc: fakeDoc(), timers: fakeTimers() });
  const state = work.state(base);
  assert.deepEqual(state.tableNow(), { tableId: 'Clients', rowId: 2, dataChange: true });
  const seen = [];
  state.subscribe((kind, message) => seen.push([kind, message.tableId]));
  base.feed('record', { tableId: 'Clients', rowId: 1 });
  assert.deepEqual(seen, [['record', 'Clients']]);
  const view = work.port(port).view;
  assert.equal(await view.fetchSelectedRecord(1, { includeColumns: 'shown' }), 'grist:fetchSelectedRecord');
  await view.setCursorPos({ rowId: 3 });
  assert.deepEqual(calls.map(call => call[0]), ['fetchSelectedRecord', 'setCursorPos']);
  assert.deepEqual(work.port(port).widget, { w: 1 });
});

test('une ligne choisie : l\'app reçoit sa table et sa ligne, ses lignes comme la vue de Grist les rend, et plus les messages de la section', async () => {
  const { base, port, calls } = gristSide();
  const doc = fakeDoc();
  const work = new WorkRow({ doc, timers: fakeTimers() });
  const state = work.state(base);
  const seen = [];
  state.subscribe((kind, message) => seen.push([kind, message.tableId, message.rowId]));
  assert.deepEqual(await work.choose('Participants', 3), { tableChanged: true });
  assert.deepEqual(state.tableNow(), { tableId: 'Participants', rowId: 3, dataChange: true, mappingsChange: false });
  assert.equal(state.options, base.options);
  base.feed('record', { tableId: 'Clients', rowId: 1 });
  base.feed('options', { settings: {} });
  assert.deepEqual(seen, [['options', undefined, undefined]]);
  const view = work.port(port).view;
  assert.deepEqual(await view.fetchSelectedRecord(3, {}), { id: 3, Nom: 'Ben Saïd', Session: 'S-2', DateInscription: ['d', 0] });
  assert.deepEqual(await view.fetchSelectedRecord(3, { expandRefs: false }), { id: 3, Nom: 'Ben Saïd', Session: ['R', 'Sessions', 2], DateInscription: ['d', 0] });
  assert.deepEqual(await view.fetchSelectedTable({}), { Nom: ['Durand', 'Ben Saïd', 'Martin'], Session: ['S-1', 'S-2', 'S-2'], DateInscription: [null, ['d', 0], ['d', 86400]], id: [2, 3, 1] });
  await view.setSelectedRows([1]);
  assert.deepEqual(calls, []);
});

test('une autre ligne de la même table part en message de ligne, sans rouvrir ; setCursorPos de l\'app aussi', async () => {
  const { base, port } = gristSide();
  const work = new WorkRow({ doc: fakeDoc(), timers: fakeTimers() });
  const seen = [];
  work.state(base).subscribe((kind, message) => seen.push([kind, message.rowId, message.dataChange]));
  await work.choose('Participants', 1);
  assert.deepEqual(await work.choose('Participants', 2), { tableChanged: false });
  await work.port(port).view.setCursorPos({ rowId: 3 });
  assert.deepEqual(seen, [['record', 2, false], ['record', 3, false]]);
  assert.deepEqual(work.choice, { tableId: 'Participants', rowId: 3 });
});

test('une table choisie seule : sa ligne est la première du tableau, ou la ligne d\'ajout d\'une table vide ; la même table de nouveau ne change rien', async () => {
  const { base } = gristSide();
  const work = new WorkRow({ doc: fakeDoc({ Vide: { id: [], manualSort: [], Nom: [] } }), timers: fakeTimers() });
  const seen = [];
  work.state(base).subscribe((kind, message) => seen.push([kind, message.rowId]));
  assert.deepEqual(await work.choose('Participants'), { tableChanged: true });
  assert.deepEqual(work.choice, { tableId: 'Participants', rowId: 2 });
  await work.choose('Participants', 3);
  assert.deepEqual(await work.choose('Participants'), { tableChanged: false });
  assert.deepEqual(work.choice, { tableId: 'Participants', rowId: 3 });
  assert.deepEqual(seen, [['record', 3]]);
  assert.deepEqual(await work.choose('Vide'), { tableChanged: true });
  assert.deepEqual(work.choice, { tableId: 'Vide', rowId: 'new' });
});

test('la relecture : un changement part en message de table, rien sinon ; à l\'arrêt sans app qui écoute, en attente quand la page est cachée', async () => {
  const { base } = gristSide();
  const doc = fakeDoc();
  const timers = fakeTimers();
  let hidden = false;
  const work = new WorkRow({ doc, timers, hidden: () => hidden });
  await work.choose('Participants', 1);
  assert.equal(timers.pending.size, 0, 'aucune app n\'écoute : pas de relecture');
  const seen = [];
  const off = work.state(base).subscribe((kind, message) => seen.push([kind, message.tableId, message.dataChange]));
  assert.equal([...timers.pending.values()][0].ms, 2000);
  await timers.fire();
  assert.deepEqual(seen, []);
  doc.data.Participants.Nom[0] = 'Martine';
  await timers.fire();
  assert.deepEqual(seen, [['table', 'Participants', true]]);
  hidden = true;
  const before = doc.reads.length;
  await timers.fire();
  assert.equal(doc.reads.length, before, 'page cachée : rien n\'est lu');
  assert.equal(timers.pending.size, 1);
  off();
  assert.equal(timers.pending.size, 0);
});

test('une colonne ajoutée à la table choisie : les colonnes de la vue se relisent', async () => {
  const { base, port } = gristSide();
  const doc = fakeDoc();
  const timers = fakeTimers();
  const work = new WorkRow({ doc, timers });
  work.state(base).subscribe(() => {});
  await work.choose('Participants', 1);
  doc.data.Participants.Ville = ['Lyon', 'Paris', 'Nice'];
  doc.data._grist_Tables_column = { ...META._grist_Tables_column, id: [...META._grist_Tables_column.id, 8], colId: [...META._grist_Tables_column.colId, 'Ville'],
    type: [...META._grist_Tables_column.type, 'Text'], parentId: [...META._grist_Tables_column.parentId, 2], displayCol: [...META._grist_Tables_column.displayCol, 0] };
  await timers.fire();
  assert.equal((await work.port(port).view.fetchSelectedRecord(1, {})).Ville, 'Lyon');
});

test('deux lectures demandées en même temps n\'en font qu\'une', async () => {
  const { port } = gristSide();
  const doc = fakeDoc();
  const work = new WorkRow({ doc, timers: fakeTimers() });
  await work.choose('Participants', 1);
  const before = doc.reads.length;
  const view = work.port(port).view;
  await Promise.all([view.fetchSelectedRecord(1, {}), view.fetchSelectedRecord(1, { includeColumns: 'normal' })]);
  assert.equal(doc.reads.length - before, 1);
});

test('revenir à la page : les messages de la section passent de nouveau, l\'app est à rouvrir', async () => {
  const { base } = gristSide();
  const work = new WorkRow({ doc: fakeDoc(), timers: fakeTimers() });
  const seen = [];
  work.state(base).subscribe((kind, message) => seen.push([kind, message.tableId]));
  await work.choose('Participants', 1);
  assert.deepEqual(work.clear(), { tableChanged: true });
  assert.deepEqual(work.clear(), { tableChanged: false });
  base.feed('record', { tableId: 'Clients', rowId: 2 });
  assert.deepEqual(seen, [['record', 'Clients']]);
  assert.equal(work.choice, null);
});

test('les lignes d\'une table pour la liste : dans l\'ordre du tableau, avec leur texte', async () => {
  const work = new WorkRow({ doc: fakeDoc(), timers: fakeTimers() });
  assert.deepEqual((await work.rows('Participants')).map(row => [row.id, row.label]), [[2, 'Durand · S-1'], [3, 'Ben Saïd · S-2 · 1970-01-01'], [1, 'Martin · S-2 · 1970-01-02']]);
});
