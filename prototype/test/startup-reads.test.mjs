// Une seule lecture de la structure du document au démarrage (js/broker/startup-reads.js ; faits vérifiés 197). Un faux Grist ne sert qu'à compter les appels qui lui parviennent ;
// ce que le partage change pour la personne (liste visible plus tôt) se mesure dans un vrai Grist (labo/run-lecture-unique.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shareStartupReads, warmStructure, endOnWrite, STRUCTURE, WINDOW_MS } from '../js/broker/startup-reads.js';
import { createPort } from '../js/broker/broker.js';

// Un faux GristDocAPI : chaque appel est compté ; `hold` retient les réponses jusqu'à `release()` (une lecture en vol).
function fakeDoc({ hold = false } = {}) {
  const calls = [];
  let release = () => {};
  const gate = hold ? new Promise(resolve => { release = resolve; }) : Promise.resolve();
  const doc = {
    calls,
    release: () => release(),
    failNext: null,
    async fetchTable(name) {
      calls.push(['fetchTable', name]);
      await gate;
      if (doc.failNext) { const error = doc.failNext; doc.failNext = null; throw error; }
      return { id: [1, 2], tableId: [`T${calls.length}`, 'B'], name };
    },
    async listTables() { calls.push(['listTables']); await gate; return ['A', 'B']; },
    async applyUserActions(actions) { calls.push(['applyUserActions', actions.length]); await gate; return { retValues: [] }; },
    async getDocName() { calls.push(['getDocName']); await gate; return 'doc'; },
    async getAccessToken() { calls.push(['getAccessToken']); return 'jeton'; },
  };
  return doc;
}
const count = (doc, name, arg) => doc.calls.filter(call => call[0] === name && (arg === undefined || call[1] === arg)).length;

test('la structure se lit une fois : la deuxième lecture de `_grist_Tables` et de `listTables` ne part pas chez Grist', async () => {
  const doc = fakeDoc();
  const { doc: shared } = shareStartupReads(doc);
  const first = await shared.fetchTable('_grist_Tables');
  const second = await shared.fetchTable('_grist_Tables');
  await shared.listTables();
  await shared.listTables();
  assert.deepEqual(second, first);
  assert.equal(count(doc, 'fetchTable', '_grist_Tables'), 1);
  assert.equal(count(doc, 'listTables'), 1);
});

test('des lectures qui se chevauchent partagent la même réponse', async () => {
  const doc = fakeDoc({ hold: true });
  const { doc: shared } = shareStartupReads(doc);
  const reads = [shared.fetchTable('_grist_Tables_column'), shared.fetchTable('_grist_Tables_column'), shared.fetchTable('_grist_Tables_column')];
  doc.release();
  const results = await Promise.all(reads);
  assert.equal(count(doc, 'fetchTable'), 1);
  assert.deepEqual(results[1], results[0]);
});

test('chaque lecteur a sa copie : changer ce qu\'on a reçu ne change rien pour les autres', async () => {
  const doc = fakeDoc();
  const { doc: shared } = shareStartupReads(doc);
  const first = await shared.fetchTable('_grist_Views');
  first.tableId.push('abîmé');
  first.id.length = 0;
  const second = await shared.fetchTable('_grist_Views');
  assert.deepEqual(second.id, [1, 2]);
  assert.equal(second.tableId.includes('abîmé'), false);
});

test('une table de la personne n\'est jamais partagée : chaque lecture part chez Grist', async () => {
  const doc = fakeDoc();
  const { doc: shared } = shareStartupReads(doc);
  await shared.fetchTable('Contrats');
  await shared.fetchTable('Contrats');
  assert.equal(count(doc, 'fetchTable', 'Contrats'), 2);
});

test('deux tables internes différentes se lisent chacune une fois', async () => {
  const doc = fakeDoc();
  const { doc: shared } = shareStartupReads(doc);
  await Promise.all([shared.fetchTable('_grist_Tables'), shared.fetchTable('_grist_Pages')]);
  await shared.fetchTable('_grist_Pages');
  assert.equal(count(doc, 'fetchTable'), 2);
});

test('une écriture par ce port efface le partage : la lecture d\'après est faite chez Grist', async () => {
  const doc = fakeDoc();
  const { doc: shared } = shareStartupReads(doc);
  await shared.listTables();
  await shared.fetchTable('_grist_Tables');
  await shared.applyUserActions([['AddTable', 'Nouvelle', []]]);
  await shared.listTables();
  await shared.fetchTable('_grist_Tables');
  assert.equal(count(doc, 'listTables'), 2);
  assert.equal(count(doc, 'fetchTable', '_grist_Tables'), 2);
  assert.equal(count(doc, 'applyUserActions'), 1);
});

test('une lecture lancée pendant une écriture n\'est pas gardée après elle', async () => {
  const doc = fakeDoc({ hold: true });
  const { doc: shared } = shareStartupReads(doc);
  const writing = shared.applyUserActions([['AddTable', 'X', []]]);
  const reading = shared.listTables(); // partie pendant l'écriture : sa réponse peut dater d'avant
  doc.release();
  await Promise.all([writing, reading]);
  await shared.listTables();
  assert.equal(count(doc, 'listTables'), 2);
});

test('close() met fin au partage : les lectures repartent chez Grist', async () => {
  const doc = fakeDoc();
  const { doc: shared, close } = shareStartupReads(doc);
  await shared.fetchTable('_grist_Tables');
  close();
  await shared.fetchTable('_grist_Tables');
  await shared.fetchTable('_grist_Tables');
  assert.equal(count(doc, 'fetchTable'), 3);
});

test('le délai met fin au partage, depuis la création du port', async () => {
  const doc = fakeDoc();
  let clock = 1000;
  const { doc: shared } = shareStartupReads(doc, { now: () => clock });
  await shared.listTables();
  clock += WINDOW_MS - 1;
  await shared.listTables();
  assert.equal(count(doc, 'listTables'), 1);
  clock += 2;
  await shared.listTables();
  await shared.listTables();
  assert.equal(count(doc, 'listTables'), 3);
});

test('une lecture qui échoue n\'est pas gardée : la suivante repart chez Grist, et chacun voit l\'erreur', async () => {
  const doc = fakeDoc();
  const { doc: shared } = shareStartupReads(doc);
  doc.failNext = new Error('Access not granted');
  await assert.rejects(shared.fetchTable('_grist_Tables'), /Access not granted/);
  const again = await shared.fetchTable('_grist_Tables');
  assert.equal(again.name, '_grist_Tables');
  assert.equal(count(doc, 'fetchTable', '_grist_Tables'), 2);
});

test('les autres appels passent tels quels, avec leurs arguments', async () => {
  const doc = fakeDoc();
  const { doc: shared } = shareStartupReads(doc);
  assert.equal(await shared.getAccessToken(), 'jeton');
  assert.equal(await shared.getAccessToken(), 'jeton');
  assert.equal(count(doc, 'getAccessToken'), 2);
});

test('le nom du document se lit une fois aussi', async () => {
  const doc = fakeDoc();
  const { doc: shared } = shareStartupReads(doc);
  assert.equal(await shared.getDocName(), 'doc');
  assert.equal(await shared.getDocName(), 'doc');
  assert.equal(count(doc, 'getDocName'), 1);
});

test('warmStructure lance les lectures ensemble, une fois chacune, et se tait sur un refus', async () => {
  const doc = fakeDoc({ hold: true });
  const { doc: shared } = shareStartupReads(doc);
  doc.failNext = new Error('Access not granted');
  warmStructure(shared);
  doc.release();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(count(doc, 'fetchTable'), STRUCTURE.length);
  assert.equal(count(doc, 'listTables'), 1);
  assert.equal(count(doc, 'getDocName'), 1);
  // les étapes suivantes retrouvent les lectures faites : seule la table refusée est relue
  for (const name of STRUCTURE) await shared.fetchTable(name).catch(() => {});
  await shared.listTables();
  await shared.getDocName();
  assert.equal(count(doc, 'fetchTable'), STRUCTURE.length + 1);
  assert.equal(count(doc, 'listTables'), 1);
  assert.equal(count(doc, 'getDocName'), 1);
});

test('createPort partage les lectures de la structure et rend de quoi y mettre fin', async () => {
  const stub = fakeDoc();
  const grist = { rpc: { getStub: name => (name === 'GristDocAPI@grist' ? stub : {}) } };
  const port = createPort(grist);
  await port.doc.fetchTable('_grist_Tables');
  await port.doc.fetchTable('_grist_Tables');
  assert.equal(count(stub, 'fetchTable', '_grist_Tables'), 1);
  assert.equal(typeof port.closeStartup, 'function');
  port.closeStartup();
  await port.doc.fetchTable('_grist_Tables');
  assert.equal(count(stub, 'fetchTable', '_grist_Tables'), 2);
});

test('endOnWrite : la première écriture par grist.docApi met fin au partage, une lecture non', async () => {
  const doc = fakeDoc();
  const { doc: shared, close } = shareStartupReads(doc);
  const written = [];
  const api = endOnWrite({ applyUserActions: async actions => { written.push(actions); return { retValues: [] }; }, fetchTable: async () => ({ id: [] }), tag: 'api' }, close);
  await shared.fetchTable('_grist_Tables');
  await api.fetchTable('_grist_Tables');
  await shared.fetchTable('_grist_Tables');
  assert.equal(count(doc, 'fetchTable', '_grist_Tables'), 1, 'une lecture par l\'API ne met pas fin au partage');
  assert.equal(api.tag, 'api');
  await api.applyUserActions([['AddTable', 'X', []]]);
  assert.equal(written.length, 1);
  await shared.fetchTable('_grist_Tables');
  assert.equal(count(doc, 'fetchTable', '_grist_Tables'), 2, 'après l\'écriture du moteur, la lecture repart chez Grist');
});
