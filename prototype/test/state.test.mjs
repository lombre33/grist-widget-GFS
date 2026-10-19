// Ce que Grist a dit à GFS en dernier (contrats 4.1, point 2), et ce que GFS rejoue à l'app qui devient prête (4.2, point 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, GristState } from '../js/state.js';

const options = { options: null, settings: { accessLevel: 'full', linking: { asTarget: null, asSource: false } }, fromReady: true };
const table = (rowId, extra = {}) => ({ tableId: 'Clients', rowId, dataChange: true, mappingsChange: true, ...extra });
const record = rowId => ({ tableId: 'Clients', rowId, dataChange: false });

test('classify : les quatre sortes de messages de Grist, et rien d\'autre', () => {
  assert.equal(classify(options), 'options');
  assert.equal(classify({ theme: { name: 'GristLight' } }), 'theme');
  assert.equal(classify(table(1)), 'table');
  assert.equal(classify(record(2)), 'record');
  assert.equal(classify({ tableId: 'Clients', rowId: undefined, dataChange: false }), 'record');
  assert.equal(classify({ message: 'themeInitialized' }), null);
  assert.equal(classify(null), null);
});

test('contrats 4.2 point 2 : le rejeu de la table dit la ligne courante, pas celle du dernier message de table', () => {
  const state = new GristState();
  assert.equal(state.tableNow(), null);
  state.feed(table(1)); // Grist, au `ready` de GFS : la ligne sous le curseur d'alors
  assert.deepEqual(state.tableNow(), table(1));
  state.feed(record(2)); // la personne choisit la ligne 2 dans le widget lié (« Select by ») : Grist ne refait pas le message de table
  assert.equal(state.table.rowId, 1, 'le dernier message de table est gardé tel quel');
  assert.deepEqual(state.tableNow(), table(2), 'le rejeu à une app qui s\'ouvre dit la ligne 2');
});

test('contrats 4.2 point 2 : le plus récent des deux messages, de ligne ou de table, dit la ligne', () => {
  const state = new GristState();
  state.feed(table(1));
  state.feed(record(2));
  state.feed(table(5, { mappingsChange: false })); // la table change : son message porte la ligne d'alors
  assert.equal(state.tableNow().rowId, 5);
  assert.equal(state.tableNow().mappingsChange, false, 'le reste du message de table est gardé');
  state.feed(record(3));
  assert.equal(state.tableNow().rowId, 3);
});

test('contrats 4.2 point 2 : aucune ligne choisie (ou la ligne vide), c\'est ce que le rejeu dit aussi', () => {
  const state = new GristState();
  state.feed(table(1));
  state.feed(record(undefined));
  assert.equal(state.tableNow().rowId, undefined);
  assert.ok('rowId' in state.tableNow(), 'la clé reste là, comme dans le message de Grist');
  state.feed(record('new'));
  assert.equal(state.tableNow().rowId, 'new');
});

test('le rejeu ne touche ni les réglages, ni le thème, ni le message gardé', () => {
  const state = new GristState();
  const theme = { theme: { name: 'GristLight' } };
  state.feed(options);
  state.feed(theme);
  const kept = table(1);
  state.feed(kept);
  state.feed(record(4));
  assert.deepEqual(state.tableNow(), table(4));
  assert.equal(kept.rowId, 1, 'le message gardé n\'est pas modifié');
  assert.equal(state.options, options);
  assert.equal(state.theme, theme);
});

test('feed rend la sorte du message et prévient les abonnés', () => {
  const state = new GristState();
  const seen = [];
  const stop = state.subscribe((kind, message) => seen.push([kind, message.rowId]));
  assert.equal(state.feed(table(1)), 'table');
  assert.equal(state.feed(record(2)), 'record');
  assert.equal(state.feed({ message: 'autre' }), null);
  stop();
  state.feed(record(3));
  assert.deepEqual(seen, [['table', 1], ['record', 2]]);
});
