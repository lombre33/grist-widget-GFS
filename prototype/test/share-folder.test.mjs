// Partager un dossier avec un autre document Grist (js/share-folder.js) : quels fichiers partent, le nom du dossier écrit sur eux (la colonne de plus), et ce qu'on efface quand le partage s'arrête.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filesOfFolder, folderLabel, isFolderTarget, skippedInFolder, tooBigInFolder, writeFolderName } from '../js/sharing/share-folder.js';
import { SEND_MAX } from '../js/sharing/share-links.js';
import { FILES_APP, filesNames } from '../js/files/gfs-files.js';
import { fakeGrist } from './fake-grist.mjs';

const file = (id, extra = {}) => ({ app: FILES_APP, id, row: Number(id.slice(1)), name: `${id}.pdf`, folder: 'Contrats', trashed: null, ...extra });

test('les fichiers d\'un dossier qui partent : les PDF de GFS rangés dans ce dossier même, ni à la corbeille, ni reçus, ni donnés par une adresse ; ceux d\'une app restent, et se comptent', () => {
  const files = [file('p1'), file('p2', { folder: 'Contrats/Sous' }), file('p3', { folder: '' }), file('p4', { trashed: { ts: 1 } }), file('p5', { received: { table: 'GFS_Received' } }), file('p6', { direct: { url: 'x' } }), file('p7', { app: 'publipostage' }), file('p8')];
  const sent = filesOfFolder(files, 'Contrats');
  assert.deepEqual(sent.map(each => each.id), ['p1', 'p8'], 'le niveau du dossier seulement : un sous-dossier est un autre dossier');
  assert.equal(skippedInFolder(files, 'Contrats'), 1, 'le fichier d\'une app ne part pas : il se compte, pour le dire');
  assert.deepEqual(filesOfFolder(undefined, 'Contrats'), []);
  assert.equal(skippedInFolder(null, 'Contrats'), 0);
});

test('un PDF de plus de 25 Mo ne part pas avec son dossier (le moteur ne l\'enverrait pas) : il ne se compte ni parmi ceux qui partent ni parmi les fichiers d\'une app, il a son propre compte', () => {
  const big = size => ({ pieces: [['9', size]] });
  const files = [file('p1', big(1000)), file('p2', big(SEND_MAX)), file('p3', big(SEND_MAX + 1)), file('p4', { ...big(SEND_MAX + 5), trashed: { ts: 1 } }),
    file('p5', { ...big(SEND_MAX + 5), folder: 'Contrats/Sous' }), file('p6', { app: 'autre', ...big(SEND_MAX + 5) })];
  const sent = filesOfFolder(files, 'Contrats');
  assert.deepEqual(sent.map(each => each.id), ['p1', 'p2'], 'p3 pèse plus de 25 Mo : il reste ; p2 pèse pile 25 Mo : il part');
  assert.equal(tooBigInFolder(files, 'Contrats'), 1, 'p3 seul : p4 est à la corbeille, p5 dans un autre dossier, p6 est d\'une app');
  assert.equal(skippedInFolder(files, 'Contrats'), 1, 'p6 seul : les fichiers d\'une app, gros ou non');
  assert.equal(tooBigInFolder(null, 'Contrats'), 0);
});

test('un dossier est un chemin sans app ; son nom chez l\'autre est le dernier mot du chemin', () => {
  assert.equal(isFolderTarget({ key: 'dossier:moi/A', name: 'A', path: 'A', mine: true }), true);
  assert.equal(isFolderTarget({ key: 'dossier:achats/Contrats', name: 'Contrats', path: 'Espaces/Achats/Contrats', shared: {} }), true);
  assert.equal(isFolderTarget({ key: 'x', app: FILES_APP, id: 'p1', name: 'F.pdf', path: undefined }), false);
  assert.equal(isFolderTarget({ app: FILES_APP, path: 'A' }), false, 'un fichier d\'une app n\'est pas un dossier');
  assert.equal(isFolderTarget(null), false);
  assert.equal(folderLabel('Contrats'), 'Contrats');
  assert.equal(folderLabel('Espaces/Achats/Contrats'), 'Contrats');
  assert.equal(folderLabel('A/B/'), 'B');
  assert.equal(folderLabel(''), '');
});

const table = () => ({ columns: ['id', 'FileId', 'Name', 'Type', 'Date', 'Author', 'Content', 'Size', 'Origin', 'DeletedAt', 'DeletedBy'], rows: [1, 2, 3].map(id => ({ id, FileId: `p${id}`, Name: `p${id}.pdf` })) });

test('le nom du dossier s\'écrit sur les lignes, la colonne ajoutée avant (une seule colonne absente annulerait tout le lot) ; une ligne qui n\'est plus là est laissée', async () => {
  const grist = fakeGrist({ [filesNames().table]: table() });
  assert.equal(await writeFolderName(grist.port.doc, [1, 3, 99], 'Contrats'), 2);
  assert.ok(grist.tables[filesNames().table].columns.includes(filesNames().folder));
  assert.deepEqual(grist.tables[filesNames().table].rows.map(row => row[filesNames().folder]), ['Contrats', undefined, 'Contrats']);
  const verbs = grist.actions.map(action => action[0]);
  assert.deepEqual(verbs, ['AddColumn', 'BulkUpdateRecord'], 'une colonne, puis UNE écriture pour toutes les lignes');
  assert.equal(await writeFolderName(grist.port.doc, [2], 'Autres'), 1);
  assert.equal(grist.actions.filter(action => action[0] === 'AddColumn').length, 1, 'la colonne existe déjà : pas rajoutée');
  assert.equal(await writeFolderName(grist.port.doc, [], 'X'), 0);
});

test('sans la table des fichiers, rien ne s\'écrit et rien ne se crée', async () => {
  const none = fakeGrist({});
  assert.equal(await writeFolderName(none.port.doc, [1], 'Contrats'), 0);
  assert.equal(none.actions.length, 0);
});

test('un raccourci (js/files/shortcuts.js) rangé dans le dossier ne part pas avec lui et ne se compte pas parmi les fichiers « d\'une app » : il reste à la personne', () => {
  const link = file('s1', { app: 'gfs-shortcut', shortcut: { target: 'gfs-fichiers:p1', state: 'ok' } });
  const files = [file('p1'), link];
  assert.deepEqual(filesOfFolder(files, 'Contrats').map(each => each.id), ['p1']);
  assert.equal(skippedInFolder(files, 'Contrats'), 0, 'sans le raccourci, aucun fichier d\'une app ne reste dans le dossier');
});
