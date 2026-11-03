// Les fichiers que GFS garde lui-même (js/gfs-files.js, contrats 6.6) : le manifeste intégré, les règles de nom, l'identifiant, la reconnaissance d'un PDF, les enregistrements.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest } from '../js/manifest.js';
import { readFiles } from '../js/explorer-model.js';
import { importFormats } from '../js/import-file.js';
import { loadFiles } from '../js/explorer-data.js';
import {
  FILES_APP, FILES_TABLE, FILES_COLUMNS, FILES_MANIFEST, FILES_ENTRY, sameName, cleanName, freeName, newId, looksLikePdf, newRecord, replacementRecord,
} from '../js/gfs-files.js';

test('le manifeste intégré se lit comme celui d\'une app : l\'explorateur y trouve la table, les colonnes déclarées, le type PDF et l\'icône du type', () => {
  const spec = FILES_MANIFEST.fichiers[0];
  assert.deepEqual([FILES_MANIFEST.id, spec.table, spec.typeParDefaut], [FILES_APP, FILES_TABLE, 'pdf']);
  const data = { id: [4, 9], Identifiant: ['aa', 'bb'], Nom: ['Facture.pdf', 'Devis.pdf'], Type: ['pdf', 'pdf'], Date: [1762000000, 1762100000], Auteur: ['marie@exemple.fr', ''], Contenu: [['L', 1], ['L', 2]] };
  const files = readFiles(FILES_MANIFEST, spec, data);
  assert.deepEqual(files.map(file => [file.key, file.id, file.name, file.type, file.known, file.icon, file.family, file.ts, file.by, file.row]), [
    ['gfs-fichiers:aa', 'aa', 'Facture.pdf', 'pdf', true, 'pdf', '', 1762000000, 'marie@exemple.fr', 4],
    ['gfs-fichiers:bb', 'bb', 'Devis.pdf', 'pdf', true, 'pdf', '', 1762100000, '', 9],
  ]);
  assert.equal(files[0].table, FILES_TABLE);
});

test('le PDF est un format que « Importer » propose, avec le type qu\'il crée', () => {
  const [format] = importFormats(FILES_MANIFEST);
  assert.deepEqual([format.item.valeur, format.item.extensions, format.type.valeur, format.type.icone], ['pdf', ['.pdf'], 'pdf', 'pdf']);
});

test('les colonnes déclarées par le manifeste existent toutes dans la table', () => {
  const declared = Object.values(FILES_MANIFEST.fichiers[0].colonnes);
  const ids = FILES_COLUMNS.map(column => column.id);
  for (const column of declared) assert.ok(ids.includes(column), column);
  assert.equal(FILES_COLUMNS.find(column => column.id === 'Contenu').type, 'Attachments');
  assert.equal(FILES_COLUMNS.find(column => column.id === 'Date').type, 'DateTime:UTC');
});

test('la table des fichiers que GFS garde est lue avec celles des apps ; une table absente n\'est pas un problème', async () => {
  const data = { id: [1], Identifiant: ['aa'], Nom: ['Facture.pdf'], Type: ['pdf'], Date: [0], Auteur: [''], Contenu: [['L', 3]] };
  const port = tables => ({ doc: { listTables: async () => Object.keys(tables), fetchTable: async name => tables[name] } });
  const found = await loadFiles(port({ GFS_Fichiers: data }), [FILES_ENTRY], '');
  assert.deepEqual(found.files.map(file => file.key), ['gfs-fichiers:aa']);
  assert.deepEqual(found.problems, []);
  const none = await loadFiles(port({ Clients: { id: [] } }), [FILES_ENTRY], '');
  assert.deepEqual([none.files.length, none.problems.length], [0, 0]);
});

test('un nom est pris sans tenir compte de la casse ni des espaces autour', () => {
  assert.equal(sameName('Facture.pdf', ' FACTURE.PDF '), true);
  assert.equal(sameName('Facture.pdf', 'Facture (1).pdf'), false);
  assert.equal(sameName(undefined, ''), true);
});

test('cleanName : le nom garde son « .pdf » (celui qui l\'efface le retrouve), sans blancs autour ; sans nom, rien', () => {
  assert.equal(cleanName('Facture.pdf'), 'Facture.pdf');
  assert.equal(cleanName('  Facture  '), 'Facture.pdf');
  assert.equal(cleanName('Facture.PDF'), 'Facture.PDF');
  assert.equal(cleanName('Facture été (1).pdf'), 'Facture été (1).pdf');
  assert.equal(cleanName('rapport.pdf.pdf'), 'rapport.pdf.pdf');
  assert.equal(cleanName(''), '');
  assert.equal(cleanName('   '), '');
  assert.equal(cleanName('.pdf'), '');
  assert.equal(cleanName(null), '');
});

test('freeName : « Nom (1).pdf » au premier numéro libre, sans empiler les numéros', () => {
  assert.equal(freeName('Facture.pdf', []), 'Facture (1).pdf');
  assert.equal(freeName('Facture.pdf', ['Facture.pdf']), 'Facture (1).pdf');
  assert.equal(freeName('Facture.pdf', ['Facture.pdf', 'Facture (1).pdf']), 'Facture (2).pdf');
  assert.equal(freeName('Facture.pdf', ['Facture.pdf', 'facture (1).PDF', 'Facture (2).pdf']), 'Facture (3).pdf', 'la casse ne distingue pas deux noms');
  assert.equal(freeName('Facture (1).pdf', ['Facture (1).pdf']), 'Facture (2).pdf', 'un numéro déjà au bout du nom est remplacé');
  assert.equal(freeName('Facture (4).pdf', ['Facture.pdf']), 'Facture (1).pdf');
  assert.equal(freeName('Sans extension', ['Sans extension']), 'Sans extension (1)');
  assert.equal(freeName('Facture été.pdf', ['Facture été.pdf']), 'Facture été (1).pdf');
});

test('newId : douze signes hexadécimaux, tirés au hasard', () => {
  assert.match(newId(), /^[0-9a-f]{12}$/);
  assert.notEqual(newId(), newId());
  assert.equal(newId(bytes => bytes.fill(255)), 'ffffffffffff');
  assert.equal(newId(bytes => bytes), '000000000000');
});

test('looksLikePdf : « %PDF- » dans les 1 024 premiers octets', () => {
  const bytes = text => Uint8Array.from(Buffer.from(text, 'latin1'));
  assert.equal(looksLikePdf(bytes('%PDF-1.4\n1 0 obj')), true);
  assert.equal(looksLikePdf(bytes(`${' '.repeat(100)}%PDF-1.7`)), true, 'la norme tolère quelques octets avant');
  assert.equal(looksLikePdf(bytes(`${'x'.repeat(1030)}%PDF-1.7`)), false, 'au-delà de 1 024 octets, ce n\'est plus un en-tête');
  assert.equal(looksLikePdf(bytes('PK\u0003\u0004 un classeur renommé en .pdf')), false);
  assert.equal(looksLikePdf(new Uint8Array(0)), false);
});

test('newRecord : toutes les colonnes d\'un nouveau fichier, la date en secondes et la pièce jointe citée par son numéro', () => {
  const record = newRecord({ id: 'aa', name: 'Facture.pdf', attachment: 7, size: 1234, author: 'marie@exemple.fr', now: 1762000123456, origin: 'import' });
  assert.deepEqual(record, { Identifiant: 'aa', Nom: 'Facture.pdf', Type: 'pdf', Contenu: ['L', 7], Origine: 'import', Date: 1762000123, Auteur: 'marie@exemple.fr', Taille: 1234 });
  for (const column of Object.keys(record)) assert.ok(FILES_COLUMNS.some(known => known.id === column), `la colonne ${column} existe`);
  assert.equal(newRecord({ id: 'bb', name: 'x.pdf', attachment: 1, size: 1, now: 0, origin: 'import' }).Auteur, '', 'sans adresse connue, l\'auteur est vide');
});

test('replacementRecord : le contenu change, ni l\'identifiant ni le nom ne sont écrits (la place et les favoris restent)', () => {
  const record = replacementRecord({ attachment: 8, size: 99, author: 'paul@exemple.fr', now: 5000, origin: 'import' });
  assert.deepEqual(record, { Contenu: ['L', 8], Origine: 'import', Date: 5, Auteur: 'paul@exemple.fr', Taille: 99 });
  assert.equal('Identifiant' in record || 'Nom' in record, false);
});

test('le manifeste intégré n\'est pas un manifeste d\'app : il garde un préfixe réservé et n\'est jamais accepté par la validation des apps', () => {
  assert.equal(validateManifest(JSON.parse(JSON.stringify(FILES_MANIFEST))).ok, false);
  assert.equal(FILES_MANIFEST.integre, true);
});
