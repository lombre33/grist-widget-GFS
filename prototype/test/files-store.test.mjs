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
  assert.deepEqual(create[2].map(column => [column.id, column.type]), [['Identifiant', 'Text'], ['Nom', 'Text'], ['Type', 'Text'], ['Date', 'DateTime:UTC'], ['Auteur', 'Text'], ['Contenu', 'Attachments'], ['Taille', 'Int'], ['Origine', 'Text'], ['SupprimeLe', 'DateTime:UTC'], ['SupprimePar', 'Text']]);
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
  assert.deepEqual(added, [['Type', 'Text'], ['Date', 'DateTime:UTC'], ['Auteur', 'Text'], ['Contenu', 'Attachments'], ['Taille', 'Int'], ['Origine', 'Text'], ['SupprimeLe', 'DateTime:UTC'], ['SupprimePar', 'Text']]);
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

// ---------- la corbeille (contrats 6.6, point 7) ----------

const trashedRow = (name, id, row, extra = {}) => present(name, id, row, { SupprimeLe: 1762000000, SupprimePar: 'paul@exemple.fr', ...extra });
const actionsOf = (grist, verb) => grist.actions.filter(action => action[0] === verb);

test('mettre à la corbeille : la ligne reste, marquée de la date et de l\'auteur du geste ; rien n\'est effacé, la pièce jointe reste citée', async () => {
  const grist = setup({ tables: tableWith([present('Facture.pdf', 'aa', 1), present('Devis.pdf', 'dd', 2)]) });
  assert.equal(await grist.store.trash({ id: 'aa' }), true);
  const [row, other] = rowsOf(grist);
  assert.deepEqual([row.Nom, row.SupprimeLe, row.SupprimePar, row.Contenu], ['Facture.pdf', 1762000123, 'marie@exemple.fr', ['L', 1]]);
  assert.equal(other.SupprimeLe, undefined, 'l\'autre fichier n\'est pas touché');
  assert.equal(actionsOf(grist, 'RemoveRecord').length, 0);
  assert.equal(await grist.store.trash({ id: 'aa' }), false, 'déjà à la corbeille');
  assert.equal(await grist.store.trash({ id: 'zz' }), false, 'un fichier parti entre-temps');
});

test('mettre à la corbeille ne crée jamais la table, et ne demande donc jamais son accord', async () => {
  const grist = setup({ consent: () => assert.fail('aucun accord à demander') });
  assert.equal(await grist.store.trash({ id: 'aa' }), false);
  assert.deepEqual(grist.actions, []);
});

test('une table d\'une version plus ancienne reçoit ses deux colonnes de corbeille avant la première mise à la corbeille', async () => {
  const old = { columns: ['id', 'Identifiant', 'Nom', 'Type', 'Date', 'Auteur', 'Contenu', 'Taille', 'Origine'], rows: [present('Facture.pdf', 'aa', 1)] };
  const grist = setup({ tables: { [FILES_TABLE]: old } });
  assert.equal(await grist.store.trash({ id: 'aa' }), true);
  assert.deepEqual(actionsOf(grist, 'AddColumn').map(action => [action[2], action[3].type]), [['SupprimeLe', 'DateTime:UTC'], ['SupprimePar', 'Text']]);
  assert.ok(grist.actions.findIndex(action => action[0] === 'UpdateRecord') > grist.actions.findLastIndex(action => action[0] === 'AddColumn'));
  assert.equal(rowsOf(grist)[0].SupprimeLe, 1762000123);
});

test('un fichier à la corbeille ne compte plus pour les noms : un nouveau fichier reprend son nom sans que rien soit demandé', async () => {
  const grist = setup({ tables: tableWith([trashedRow('Facture.pdf', 'aa', 1)]) });
  const result = await grist.store.add({ file: file(), name: 'Facture.pdf', decide: () => assert.fail('le nom est libre : l\'ancien est à la corbeille') });
  assert.deepEqual([result.status, result.name], ['added', 'Facture.pdf']);
  assert.deepEqual(rowsOf(grist).map(row => [row.Identifiant === 'aa', row.Nom, Boolean(row.SupprimeLe)]), [[true, 'Facture.pdf', true], [false, 'Facture.pdf', false]]);
});

test('restaurer : le marqueur se vide, le fichier est tel qu\'il était ; un fichier qui n\'est pas à la corbeille ne se restaure pas', async () => {
  const grist = setup({ tables: tableWith([trashedRow('Facture.pdf', 'aa', 1), present('Devis.pdf', 'dd', 2)]) });
  assert.deepEqual(await grist.store.restore({ id: 'aa' }), { name: 'Facture.pdf', renamed: false });
  const [row] = rowsOf(grist);
  assert.deepEqual([row.SupprimeLe, row.SupprimePar, row.Nom, row.Contenu, row.Identifiant], [null, '', 'Facture.pdf', ['L', 1], 'aa']);
  assert.equal(await grist.store.restore({ id: 'aa' }), null, 'il est déjà revenu');
  assert.equal(await grist.store.restore({ id: 'dd' }), null);
  assert.equal(await grist.store.restore({ id: 'zz' }), null);
});

test('restaurer quand un autre fichier a pris le nom : rien n\'est écrasé, le restauré prend le premier nom libre', async () => {
  const grist = setup({ tables: tableWith([trashedRow('Facture.pdf', 'aa', 1), present('Facture.pdf', 'bb', 2), present('Facture (1).pdf', 'cc', 3), trashedRow('Facture (2).pdf', 'dd', 4)]) });
  assert.deepEqual(await grist.store.restore({ id: 'aa' }), { name: 'Facture (2).pdf', renamed: true });
  assert.deepEqual(rowsOf(grist).map(row => row.Nom), ['Facture (2).pdf', 'Facture.pdf', 'Facture (1).pdf', 'Facture (2).pdf']);
  assert.equal(rowsOf(grist)[0].SupprimeLe, null);
});

test('supprimer pour de bon : seules les lignes à la corbeille qu\'on désigne partent ; un fichier restauré entre-temps ou jamais supprimé n\'est pas touché', async () => {
  const grist = setup({ tables: tableWith([trashedRow('A.pdf', 'aa', 1), trashedRow('B.pdf', 'bb', 2), present('C.pdf', 'cc', 3), trashedRow('D.pdf', 'dd', 4)]) });
  assert.equal(await grist.store.empty([{ id: 'aa' }, { id: 'cc' }, { id: 'zz' }]), 1);
  assert.deepEqual(rowsOf(grist).map(row => row.Nom), ['B.pdf', 'C.pdf', 'D.pdf']);
  assert.equal(await grist.store.empty([{ id: 'bb' }, { id: 'dd' }]), 2);
  assert.deepEqual(rowsOf(grist).map(row => row.Nom), ['C.pdf']);
  assert.equal(await grist.store.empty([{ id: 'bb' }]), 0);
  assert.equal(actionsOf(grist, 'RemoveRecord').length, 3);
});

test('supprimer pour de bon sans table : rien à faire, rien n\'est créé', async () => {
  const grist = setup({ consent: () => assert.fail() });
  assert.equal(await grist.store.empty([{ id: 'aa' }]), 0);
  assert.deepEqual(grist.actions, []);
});

test('les gestes de la corbeille se font l\'un après l\'autre, sur la table relue', async () => {
  const grist = setup({ tables: tableWith([present('A.pdf', 'aa', 1), present('B.pdf', 'bb', 2)]) });
  const results = await Promise.all([grist.store.trash({ id: 'aa' }), grist.store.trash({ id: 'bb' }), grist.store.restore({ id: 'aa' }), grist.store.empty([{ id: 'bb' }])]);
  assert.deepEqual(results, [true, true, { name: 'A.pdf', renamed: false }, 1]);
  assert.deepEqual(rowsOf(grist).map(row => [row.Nom, row.SupprimeLe]), [['A.pdf', null]]);
});

// La copie (contrats 6.6, point 13) : une ligne de plus, la même pièce jointe, aucun envoi.
test('copier : une ligne de plus sous un nouvel identifiant et le premier nom libre, qui cite la même pièce jointe sans rien envoyer', async () => {
  const grist = setup({ tables: tableWith([present('Facture.pdf', 'aa', 1, { Contenu: ['L', 42], Taille: 777, Origine: 'publipostage', Auteur: 'ana@exemple.org', Date: 50 }), present('Devis.pdf', 'dd', 2)]) });
  const result = await grist.store.copy({ id: 'aa' });
  assert.deepEqual([result.name, result.row], ['Facture (1).pdf', 3]);
  assert.match(result.id, /^[0-9a-f]{12}$/);
  assert.notEqual(result.id, 'aa');
  const [original, , copy] = rowsOf(grist);
  assert.deepEqual([copy.Identifiant, copy.Nom, copy.Type, copy.Contenu, copy.Taille, copy.Origine], [result.id, 'Facture (1).pdf', 'pdf', ['L', 42], 777, 'publipostage'], 'la même pièce jointe, la même taille, la même origine');
  assert.deepEqual([copy.Auteur, copy.Date], ['marie@exemple.fr', 1762000123], 'la copie est de la personne qui la fait, d\'aujourd\'hui');
  assert.deepEqual([original.Nom, original.Contenu, original.Auteur, original.Date], ['Facture.pdf', ['L', 42], 'ana@exemple.org', 50], 'l\'original n\'est pas touché');
  assert.deepEqual(grist.transfer.calls.uploads, [], 'aucun envoi : la pièce jointe n\'est pas dupliquée');
  assert.equal(actionsOf(grist, 'AddRecord').length, 1, 'une seule écriture');
});

test('copier : le numéro est le premier libre (les noms à la corbeille ne comptent pas), et un numéro déjà au bout du nom est remplacé', async () => {
  const grist = setup({ tables: tableWith([present('Facture.pdf', 'aa', 1), present('Facture (1).pdf', 'bb', 2), trashedRow('Facture (2).pdf', 'cc', 3)]) });
  assert.equal((await grist.store.copy({ id: 'aa' })).name, 'Facture (2).pdf', 'le nom du fichier à la corbeille est libre');
  assert.equal((await grist.store.copy({ id: 'bb' })).name, 'Facture (3).pdf', '« Facture (1).pdf » ne devient pas « Facture (1) (1).pdf »');
});

test('copier : un fichier qui n\'est plus là, ou qui est à la corbeille, ne se copie pas ; une table sans fichier ne se crée pas', async () => {
  const grist = setup({ tables: tableWith([trashedRow('Facture.pdf', 'aa', 1), present('Devis.pdf', 'dd', 2)]), consent: () => assert.fail('la copie ne crée jamais la table') });
  assert.equal(await grist.store.copy({ id: 'aa' }), null, 'à la corbeille');
  assert.equal(await grist.store.copy({ id: 'zz' }), null, 'absent');
  assert.equal(actionsOf(grist, 'AddRecord').length, 0);
  const none = setup({ consent: () => assert.fail() });
  assert.equal(await none.store.copy({ id: 'aa' }), null);
  assert.deepEqual(none.actions, []);
});

test('copier : un fichier sans contenu ne se copie pas (rien n\'est écrit) ; une table plus ancienne reçoit les colonnes qui lui manquent avant l\'écriture', async () => {
  const empty = setup({ tables: tableWith([present('Vide.pdf', 'vv', 1, { Contenu: null })]) });
  await assert.rejects(empty.store.copy({ id: 'vv' }), /pas de contenu/);
  assert.equal(actionsOf(empty, 'AddRecord').length, 0);
  const old = setup({ tables: { [FILES_TABLE]: { columns: ['id', 'Identifiant', 'Nom', 'Type', 'Date', 'Auteur', 'Contenu', 'Taille'], rows: [{ id: 1, Identifiant: 'aa', Nom: 'A.pdf', Type: 'pdf', Date: 1, Auteur: '', Contenu: ['L', 5], Taille: 3 }] } } });
  assert.equal((await old.store.copy({ id: 'aa' })).name, 'A (1).pdf');
  assert.deepEqual(actionsOf(old, 'AddColumn').map(action => action[2]), ['Origine', 'SupprimeLe', 'SupprimePar'], 'les colonnes qui manquent sont ajoutées avant l\'écriture (comme à un ajout), jamais écrites absentes');
  assert.ok(old.actions.findIndex(action => action[0] === 'AddColumn') < old.actions.findIndex(action => action[0] === 'AddRecord'));
});

test('copier se fait à la suite des autres gestes, sur la table relue', async () => {
  const grist = setup({ tables: tableWith([present('A.pdf', 'aa', 1)]) });
  const results = await Promise.all([grist.store.copy({ id: 'aa' }), grist.store.copy({ id: 'aa' }), grist.store.trash({ id: 'aa' })]);
  assert.deepEqual([results[0].name, results[1].name, results[2]], ['A (1).pdf', 'A (2).pdf', true], 'deux copies de suite : deux numéros');
});

test('download : la pièce jointe de la ligne relue, sous le nom actuel du fichier', async () => {
  const grist = setup({ tables: tableWith([present('Facture.pdf', 'aa', 1, { Contenu: ['L', 42, 43] })]) });
  const { blob, name } = await grist.store.download({ id: 'aa' });
  assert.equal(name, 'Facture.pdf');
  assert.equal(await blob.text(), '%PDF-1.4');
  assert.deepEqual(grist.transfer.calls.downloads, [42]);
});

test('download d\'un fichier reçu d\'un autre document : lu dans sa table GFS_Recus*, par le numéro de sa ligne (deux partages peuvent citer un même identifiant)', async () => {
  const received = (name, row, attachment) => ({ ...present(name, 'aa', row, { Contenu: ['L', attachment] }) });
  const grist = setup({ tables: { ...tableWith([present('Mien.pdf', 'aa', 1, { Contenu: ['L', 7] })]), GFS_Recus: { columns: ['id', ...FILES_COLUMN_IDS], rows: [received('Recu.pdf', 3, 31)] }, GFS_Recus_2: { columns: ['id', ...FILES_COLUMN_IDS], rows: [received('Autre.pdf', 3, 32)] } } });
  const { name } = await grist.store.download({ id: 'aa', received: { table: 'GFS_Recus_2', row: 3 } });
  assert.equal(name, 'Autre.pdf');
  assert.deepEqual(grist.transfer.calls.downloads, [32], 'la pièce de la table reçue, ni celle de GFS_Fichiers ni celle de l\'autre table reçue');
  await assert.rejects(grist.store.download({ id: 'aa', received: { table: 'GFS_Recus', row: 9 } }), /n’est plus dans le document/);
});

test('download : un fichier à la corbeille ne se télécharge pas', async () => {
  const grist = setup({ tables: tableWith([trashedRow('Facture.pdf', 'aa', 1)]) });
  await assert.rejects(grist.store.download({ id: 'aa' }), /à la corbeille/);
  assert.deepEqual(grist.transfer.calls.downloads, []);
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

test('filesOf : un fichier est à la corbeille quand sa colonne de date porte une date ; une table sans ces colonnes, ou une date vide, n\'en met aucun', () => {
  const data = { id: [1, 2, 3, 4], Identifiant: ['aa', 'bb', 'cc', 'dd'], Nom: ['A.pdf', 'B.pdf', 'C.pdf', 'D.pdf'], SupprimeLe: [1762000000, null, 0, 5], SupprimePar: ['paul@exemple.fr', 'x', 'y', null] };
  assert.deepEqual(filesOf(data).map(entry => entry.trashed), [{ ts: 1762000000, by: 'paul@exemple.fr' }, null, null, { ts: 5, by: '' }]);
  assert.deepEqual(filesOf({ id: [1], Identifiant: ['aa'] }).map(entry => entry.trashed), [null]);
});
