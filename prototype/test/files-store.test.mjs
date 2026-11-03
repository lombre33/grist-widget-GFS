// Les fichiers que GFS garde, côté données (js/files-store.js, contrats 6.6) : la table naît avec l'accord de la personne avant tout envoi, le fichier part avant la ligne, un nom pris se décide,
// la table est relue avant d'écrire. Le port est un faux Grist en mémoire (fake-grist.mjs) et le cadre d'envoi une doublure ; ce que Grist et le serveur rendent vraiment (la pièce jointe,
// la cellule Attachments, le téléchargement) se mesure dans le labo, sur un vrai serveur (labo/run-pdf.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FilesStore, filesOf } from '../js/files-store.js';
import { TableDeclined } from '../js/own-table.js';
import { FILES_TABLE, FILES_COLUMN_IDS } from '../js/gfs-files.js';
import { fakeGrist } from './fake-grist.mjs';

const NOW = 1762000123456;
const file = (name = 'Facture.pdf', size = 1234) => ({ name, size });

// Une doublure du cadre d'envoi : elle numérote les pièces jointes dans l'ordre, et garde ce qu'on lui a demandé.
function fakeTransfer({ failWith = null } = {}) {
  const calls = { uploads: [], downloads: [] };
  let next = 1;
  return {
    calls,
    upload: async (sent, name) => { calls.uploads.push({ name, size: sent.size }); if (failWith) throw failWith; return next++; },
    download: async attachment => { calls.downloads.push(attachment); return new Blob(['%PDF-1.4']); },
  };
}

const present = (name, id, row, extra = {}) => ({ id: row, Identifiant: id, Nom: name, Type: 'pdf', Date: 100, Auteur: 'a@b.fr', Contenu: ['L', row], Taille: 10, Origine: 'import', ...extra });
const tableWith = rows => ({ [FILES_TABLE]: { columns: ['id', ...FILES_COLUMN_IDS], rows } });

function setup({ tables = {}, consent = async () => true, transfer = fakeTransfer(), identity = 'marie@exemple.fr' } = {}) {
  const grist = fakeGrist(tables);
  const store = new FilesStore({ port: grist.port, transfer, consent, identity: () => identity, now: () => NOW });
  return { ...grist, store, transfer };
}

const rowsOf = grist => grist.tables[FILES_TABLE].rows;

test('un premier PDF : la table naît avec ses colonnes (accord donné), le fichier part avec son nom, la ligne s\'écrit ensuite', async () => {
  const grist = setup();
  const result = await grist.store.add({ file: file(), name: 'Facture.pdf', decide: () => assert.fail('aucun nom pris') });
  assert.deepEqual([result.status, result.name], ['added', 'Facture.pdf']);
  assert.match(result.id, /^[0-9a-f]{12}$/);
  assert.deepEqual(grist.transfer.calls.uploads, [{ name: 'Facture.pdf', size: 1234 }]);
  const create = grist.actions.find(action => action[0] === 'AddTable');
  assert.equal(create[1], FILES_TABLE);
  assert.deepEqual(create[2].map(column => [column.id, column.type]), [['Identifiant', 'Text'], ['Nom', 'Text'], ['Type', 'Text'], ['Date', 'DateTime:UTC'], ['Auteur', 'Text'], ['Contenu', 'Attachments'], ['Taille', 'Int'], ['Origine', 'Text']]);
  const [row] = rowsOf(grist);
  assert.deepEqual([row.Identifiant, row.Nom, row.Type, row.Contenu, row.Date, row.Auteur, row.Taille, row.Origine], [result.id, 'Facture.pdf', 'pdf', ['L', 1], 1762000123, 'marie@exemple.fr', 1234, 'import']);
  assert.equal(result.row, row.id);
});

test('l\'accord est demandé avant tout : refusé, rien n\'est créé, rien n\'est envoyé', async () => {
  const grist = setup({ consent: async () => false });
  await assert.rejects(grist.store.add({ file: file(), name: 'Facture.pdf', decide: () => assert.fail() }), error => error instanceof TableDeclined && error.table === FILES_TABLE);
  assert.deepEqual(grist.actions, []);
  assert.deepEqual(grist.transfer.calls.uploads, []);
});

test('la table existe : aucune question, aucune création ; un nom libre n\'appelle pas la décision', async () => {
  const grist = setup({ tables: tableWith([present('Devis.pdf', 'dd', 1)]), consent: () => assert.fail('la table existe') });
  const result = await grist.store.add({ file: file(), name: 'Facture.pdf', decide: () => assert.fail() });
  assert.equal(result.status, 'added');
  assert.equal(grist.actions.some(action => action[0] === 'AddTable'), false);
  assert.deepEqual(rowsOf(grist).map(row => row.Nom), ['Devis.pdf', 'Facture.pdf']);
});

test('un nom pris : la décision reçoit le fichier existant et le nom de la copie ; « Garder les deux » envoie et écrit le nouveau sous « Nom (1).pdf »', async () => {
  const grist = setup({ tables: tableWith([present('Facture.pdf', 'aa', 1)]) });
  let asked;
  const result = await grist.store.add({ file: file(), name: ' facture.PDF'.trim(), decide: (existing, copy) => { asked = [existing, copy]; return 'both'; } });
  assert.equal(asked[0].id, 'aa');
  assert.equal(asked[0].name, 'Facture.pdf');
  assert.equal(asked[1], 'facture (1).PDF', 'la copie garde la casse du nouveau nom');
  assert.deepEqual([result.status, result.name], ['added', 'facture (1).PDF']);
  assert.deepEqual(grist.transfer.calls.uploads.map(call => call.name), ['facture (1).PDF']);
  assert.deepEqual(rowsOf(grist).map(row => row.Nom), ['Facture.pdf', 'facture (1).PDF']);
});

test('« Remplacer » : le fichier existant garde sa ligne, son identifiant et son nom, et prend le contenu, la date, l\'auteur et la taille du nouveau', async () => {
  const grist = setup({ tables: tableWith([present('Facture.pdf', 'aa', 1), present('Devis.pdf', 'dd', 2)]) });
  const result = await grist.store.add({ file: file('FACTURE.pdf', 77), name: 'FACTURE.pdf', decide: () => 'replace' });
  assert.deepEqual([result.status, result.id, result.name, result.row], ['replaced', 'aa', 'Facture.pdf', 1]);
  assert.deepEqual(grist.transfer.calls.uploads, [{ name: 'Facture.pdf', size: 77 }], 'Grist garde le nom que la personne voit');
  const [first, second] = rowsOf(grist);
  assert.deepEqual([first.Identifiant, first.Nom, first.Contenu, first.Date, first.Auteur, first.Taille], ['aa', 'Facture.pdf', ['L', 1], 1762000123, 'marie@exemple.fr', 77]);
  assert.equal(second.Nom, 'Devis.pdf');
  assert.equal(rowsOf(grist).length, 2, 'aucune ligne de plus');
});

test('la personne renonce : rien n\'est envoyé ni écrit', async () => {
  const grist = setup({ tables: tableWith([present('Facture.pdf', 'aa', 1)]) });
  assert.equal(await grist.store.add({ file: file(), name: 'Facture.pdf', decide: () => null }), null);
  assert.deepEqual(grist.transfer.calls.uploads, []);
  assert.equal(grist.actions.length, 0);
});

test('un envoi qui échoue n\'ajoute aucune ligne, et l\'erreur est rendue telle quelle', async () => {
  const failure = Object.assign(new Error('refus du serveur'), { kind: 'http', status: 413 });
  const grist = setup({ tables: tableWith([]), transfer: fakeTransfer({ failWith: failure }) });
  await assert.rejects(grist.store.add({ file: file(), name: 'Facture.pdf', decide: () => assert.fail() }), error => error === failure);
  assert.deepEqual(rowsOf(grist), []);
});

test('une table d\'une version plus ancienne reçoit d\'abord ses colonnes absentes, avec leur type ; une colonne inconnue n\'est jamais écrite', async () => {
  const grist = setup({ tables: { [FILES_TABLE]: { columns: ['id', 'Identifiant', 'Nom'], rows: [] } } });
  await grist.store.add({ file: file(), name: 'Facture.pdf', decide: () => assert.fail() });
  const added = grist.actions.filter(action => action[0] === 'AddColumn').map(action => [action[2], action[3].type]);
  assert.deepEqual(added, [['Type', 'Text'], ['Date', 'DateTime:UTC'], ['Auteur', 'Text'], ['Contenu', 'Attachments'], ['Taille', 'Int'], ['Origine', 'Text']]);
  assert.ok(grist.actions.findIndex(action => action[0] === 'AddRecord') > grist.actions.findLastIndex(action => action[0] === 'AddColumn'));
  assert.equal(rowsOf(grist)[0].Nom, 'Facture.pdf');
});

test('la table est relue avant d\'écrire : un nom pris pendant que la personne décidait reçoit son numéro', async () => {
  const grist = setup({ tables: tableWith([present('Facture.pdf', 'aa', 1)]) });
  const result = await grist.store.add({
    file: file(), name: 'Facture.pdf',
    decide: () => { rowsOf(grist).push(present('Facture (1).pdf', 'bb', 2)); return 'both'; },
  });
  assert.equal(result.name, 'Facture (2).pdf');
  assert.deepEqual(rowsOf(grist).map(row => row.Nom), ['Facture.pdf', 'Facture (1).pdf', 'Facture (2).pdf']);
});

test('le fichier à remplacer a été retiré pendant que la personne décidait : il est ajouté sous son nom', async () => {
  const grist = setup({ tables: tableWith([present('Facture.pdf', 'aa', 1)]) });
  const result = await grist.store.add({ file: file(), name: 'Facture.pdf', decide: () => { rowsOf(grist).splice(0, 1); return 'replace'; } });
  assert.deepEqual([result.status, result.name], ['added', 'Facture.pdf']);
  assert.deepEqual(rowsOf(grist).map(row => row.Nom), ['Facture.pdf']);
  assert.notEqual(rowsOf(grist)[0].Identifiant, 'aa');
});

test('deux ajouts demandés ensemble passent l\'un après l\'autre : le second voit le nom du premier', async () => {
  const grist = setup({ tables: tableWith([]) });
  const decisions = [];
  const first = grist.store.add({ file: file(), name: 'Facture.pdf', decide: () => assert.fail('le premier est seul') });
  const second = grist.store.add({ file: file(), name: 'Facture.pdf', decide: (existing, copy) => { decisions.push(copy); return 'both'; } });
  await Promise.all([first, second]);
  assert.deepEqual(decisions, ['Facture (1).pdf']);
  assert.deepEqual(rowsOf(grist).map(row => row.Nom), ['Facture.pdf', 'Facture (1).pdf']);
});

test('sans adresse connue, l\'auteur est vide', async () => {
  const grist = setup({ tables: tableWith([]), identity: '' });
  await grist.store.add({ file: file(), name: 'Facture.pdf', decide: () => assert.fail() });
  assert.equal(rowsOf(grist)[0].Auteur, '');
});

test('onUpload est appelé juste avant l\'envoi, pas avant la décision', async () => {
  const grist = setup({ tables: tableWith([present('Facture.pdf', 'aa', 1)]) });
  const order = [];
  await grist.store.add({ file: file(), name: 'Facture.pdf', decide: () => { order.push('décision'); return 'both'; }, onUpload: () => order.push('envoi') });
  assert.deepEqual(order, ['décision', 'envoi']);
});

test('remove : la ligne est retirée (relue d\'abord) ; un fichier déjà parti rend false', async () => {
  const grist = setup({ tables: tableWith([present('Facture.pdf', 'aa', 1), present('Devis.pdf', 'dd', 2)]) });
  assert.equal(await grist.store.remove({ id: 'aa' }), true);
  assert.deepEqual(rowsOf(grist).map(row => row.Nom), ['Devis.pdf']);
  assert.equal(await grist.store.remove({ id: 'aa' }), false);
  assert.equal(grist.actions.filter(action => action[0] === 'RemoveRecord').length, 1);
});

test('download : la pièce jointe de la ligne relue, sous le nom actuel du fichier', async () => {
  const grist = setup({ tables: tableWith([present('Facture.pdf', 'aa', 1, { Contenu: ['L', 42, 43] })]) });
  const { blob, name } = await grist.store.download({ id: 'aa' });
  assert.equal(name, 'Facture.pdf');
  assert.equal(await blob.text(), '%PDF-1.4');
  assert.deepEqual(grist.transfer.calls.downloads, [42]);
});

test('download : un fichier retiré par une autre personne, ou sans contenu, est dit', async () => {
  const grist = setup({ tables: tableWith([present('Vide.pdf', 'vv', 1, { Contenu: null })]) });
  await assert.rejects(grist.store.download({ id: 'zz' }), /n’est plus dans le document/);
  await assert.rejects(grist.store.download({ id: 'vv' }), /pas de contenu/);
  assert.deepEqual(grist.transfer.calls.downloads, []);
});

test('filesOf : une ligne sans identifiant est ignorée, la pièce jointe est le premier numéro de la cellule', () => {
  const data = { id: [1, 2, 3], Identifiant: ['aa', '', 'cc'], Nom: ['A.pdf', 'B.pdf', 'C.pdf'], Date: [1, 2, 3], Auteur: ['x', 'y', 'z'], Contenu: [['L', 9, 10], ['L', 1], null] };
  assert.deepEqual(filesOf(data).map(entry => [entry.id, entry.attachment, entry.row]), [['aa', 9, 1], ['cc', null, 3]]);
  assert.deepEqual(filesOf(null), []);
});
