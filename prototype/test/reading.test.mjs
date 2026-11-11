// Lire un fichier que GFS garde (js/broker/reading.js, contrats 2.7 point 5 et 5.4 point 8) : quelles apps lisent un type, laquelle sert, et l'ouverture qu'on lui passe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readersOf, chooseReader, readOpening } from '../js/broker/reading.js';
import { openingKind, carriesFile } from '../js/files/import-file.js';

const manifest = (id, lire) => ({ id, actions: lire === undefined ? {} : { lire } });
const APPS = [manifest('form'), manifest('bi', [{ type: 'pdf' }]), manifest('publipostage', [{ type: 'pdf', extension: 'lecture-pdf' }, { type: 'image' }]), { id: 'sans-actions' }];

test('readersOf : les apps qui déclarent lire ce type, dans l\'ordre du catalogue, avec leur entrée', () => {
  assert.deepEqual(readersOf(APPS, 'pdf').map(({ manifest: m, item }) => [m.id, item.extension]), [['bi', undefined], ['publipostage', 'lecture-pdf']]);
  assert.deepEqual(readersOf(APPS, 'image').map(({ manifest: m }) => m.id), ['publipostage']);
  assert.deepEqual(readersOf(APPS, 'tableur'), [], 'aucune app ne lit ce type : le fichier se télécharge');
  assert.deepEqual(readersOf([], 'pdf'), []);
});

test('chooseReader : le premier lecteur prêt sert, sinon le premier déclaré avec son grisé, sinon rien', () => {
  const readers = readersOf(APPS, 'pdf');
  const locks = { bi: { text: 'à installer', focus: 'app:bi' }, publipostage: null };
  const chosen = chooseReader(readers, reader => locks[reader.manifest.id]);
  assert.deepEqual([chosen.reader.manifest.id, chosen.lock], ['publipostage', null], 'BI n\'est pas prête : la suivante sert');
  locks.publipostage = { text: 'extension éteinte', focus: 'ext:publipostage:lecture-pdf' };
  const none = chooseReader(readers, reader => locks[reader.manifest.id]);
  assert.deepEqual([none.reader.manifest.id, none.lock.text], ['bi', 'à installer'], 'aucune n\'est prête : la première déclarée dit pourquoi');
  locks.bi = null;
  assert.equal(chooseReader(readers, reader => locks[reader.manifest.id]).reader.manifest.id, 'bi', 'la première prête passe avant les suivantes');
  assert.equal(chooseReader([], () => null), null);
});

test('readOpening : le fichier n\'est pas à l\'app (fichier: null), le genre est « lire », et l\'app reçoit l\'identifiant de GFS avec les octets', () => {
  const bytes = new File(['%PDF-1.4'], 'Facture.pdf', { type: 'application/pdf' });
  const opening = readOpening({ id: 'a1b2c3d4e5f6', type: 'pdf' }, bytes, 'Clients');
  assert.deepEqual(opening, { fichier: null, type: 'pdf', dossier: 'Clients', raison: 'lire', lecture: { id: 'a1b2c3d4e5f6', fichier: bytes } });
  assert.equal(opening.lecture.fichier, bytes, 'le même objet File : GFS ne le lit ni ne le copie');
  assert.equal(openingKind(opening), 'lire');
  assert.equal(carriesFile(opening), true);
});

test('openingKind et carriesFile : lire se distingue d\'ouvrir, de « Nouveau » et d\'« Importer » ; deux genres portent un fichier du navigateur', () => {
  assert.equal(openingKind({ fichier: { id: '3', type: 'document' }, type: 'document', raison: 'explorateur' }), 'fichier');
  assert.equal(openingKind({ fichier: null, type: 'document', raison: 'nouveau' }), 'nouveau');
  assert.equal(openingKind({ fichier: null, type: 'grille', raison: 'importer', importation: { valeur: 'excel', fichier: {} } }), 'importer');
  assert.equal(carriesFile({ fichier: null, type: 'grille', raison: 'importer', importation: { valeur: 'excel', fichier: {} } }), true);
  assert.equal(carriesFile({ fichier: { id: '3', type: 'document' }, raison: 'explorateur' }), false);
  assert.equal(carriesFile({ fichier: null, type: 'document', raison: 'nouveau' }), false);
  assert.equal(carriesFile(null), false);
});
