// Le rangement que l'app tient elle-même et que GFS écrit (js/files/app-filing.js ; contrats 2.4 `rangement.ecriture`, 6.4 point 8) : ce qu'il lit, les actions qu'il
// rend (jamais une colonne absente, toutes les lignes d'un fichier, une ligne d'état par dossier) et ce qu'il reprend de `GFS_Filing`. Les tables sont celles que
// `fetchTable` rend ; l'envoi du lot à Grist est essayé dans rangement.test.mjs, et dans un vrai Grist par labo/run-rangement-app.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appFilingOf, usable, readAppFolders, appActions, carryOver } from '../js/files/app-filing.js';
import { publipostage, automation, form } from './helpers.mjs';

const filing = appFilingOf(publipostage());
const T = filing.table;
const prefs = () => ({
  id: [1, 2, 3, 4, 5, 6], Utilisateur: ['moi@exemple.org', 'moi@exemple.org', 'moi@exemple.org', 'moi@exemple.org', 'autre@exemple.org', 'moi@exemple.org'],
  ModeleId: [7, 7, 0, 0, 0, 9], Dossier: ['Factures', 'Factures', 'Vide', ' Vide / Sous ', 'Prive', ''], Epingle: [false, true, false, false, false, false],
});

test('appFilingOf : le rangement du manifeste avec l\'app et la marque des lignes d\'état ; rien quand l\'app n\'a pas de rangement ou ne le laisse pas écrire', () => {
  assert.deepEqual(filing, { table: 'Publipostage_PreferencesModeles', utilisateur: 'Utilisateur', fichier: 'ModeleId', dossier: 'Dossier', epingle: 'Epingle',
    ecriture: { dossiers: 0 }, app: 'publipostage', marque: 0 });
  assert.equal(appFilingOf(form()), null, 'Form+ n\'a pas de rangement propre');
  assert.equal(appFilingOf(automation()), null, 'Automation+ n\'a pas de fichiers');
  const readOnly = publipostage();
  delete readOnly.fichiers[0].rangement.ecriture;
  assert.equal(appFilingOf(readOnly), null, 'sans `ecriture`, GFS ne l\'écrit pas');
  const noMark = publipostage();
  noMark.fichiers[0].rangement.ecriture = {};
  assert.equal(appFilingOf(noMark).marque, undefined, 'sans `dossiers`, l\'app n\'a pas de ligne d\'état de dossier');
  assert.equal(appFilingOf(null), null);
});

test('usable : la table est là avec ses quatre colonnes ; sinon GFS range dans son propre rangement', () => {
  assert.equal(usable(filing, prefs()), true);
  assert.equal(usable(filing, null), false);
  assert.equal(usable(filing, { ...prefs(), Epingle: undefined }), false);
  const { Dossier, ...noFolder } = prefs();
  assert.equal(usable(filing, noFolder), false);
  assert.equal(usable(null, prefs()), false);
});

test('readAppFolders : les lignes d\'état de la personne (la marque dans la colonne du fichier), normalisées, sans doublon ; ni les lignes de fichiers ni une autre personne', () => {
  assert.deepEqual(readAppFolders(filing, prefs(), 'moi@exemple.org'), ['Vide', 'Vide/Sous']);
  assert.deepEqual(readAppFolders(filing, prefs(), 'autre@exemple.org'), ['Prive']);
  assert.deepEqual(readAppFolders(filing, prefs(), ''), []);
  assert.deepEqual(readAppFolders({ ...filing, marque: undefined }, prefs(), 'moi@exemple.org'), [], 'une app sans ligne d\'état n\'a pas de dossier vide');
  assert.deepEqual(readAppFolders(filing, null, 'moi@exemple.org'), []);
});

test('appActions : toutes les lignes de la personne pour un fichier sont mises à jour, celle qui manque est ajoutée (l\'identifiant en nombre), les autres ne bougent pas', () => {
  const actions = appActions(filing, T, prefs(), 'moi@exemple.org', { entries: [
    { file: '7', pinned: true, folder: 'Factures/2026' },
    { file: '12', pinned: false, folder: '' },
    { file: '5', pinned: false, folder: 'Neuf' },
  ] });
  assert.deepEqual(actions, [
    ['UpdateRecord', T, 1, { Epingle: true, Dossier: 'Factures/2026' }],
    ['UpdateRecord', T, 2, { Epingle: true, Dossier: 'Factures/2026' }],
    ['AddRecord', T, null, { Utilisateur: 'moi@exemple.org', ModeleId: 12, Epingle: false, Dossier: '' }],
    ['AddRecord', T, null, { Utilisateur: 'moi@exemple.org', ModeleId: 5, Epingle: false, Dossier: 'Neuf' }],
  ]);
});

test('appActions : un dossier gardé s\'ajoute en ligne d\'état (la marque), une seule fois ; un dossier retiré perd toutes ses lignes d\'état, jamais celles d\'un fichier ni d\'une autre personne', () => {
  const actions = appActions(filing, T, prefs(), 'moi@exemple.org', { add: ['Vide', 'Nouveau', 'Nouveau', 'Perdu'], drop: ['Vide/Sous', 'Perdu', 'Prive', 'Factures'] });
  assert.deepEqual(actions, [
    ['RemoveRecord', T, 4],
    ['AddRecord', T, null, { Utilisateur: 'moi@exemple.org', ModeleId: 0, Epingle: false, Dossier: 'Nouveau' }],
  ]);
  const noMark = appActions({ ...filing, marque: undefined }, T, prefs(), 'moi@exemple.org', { add: ['Nouveau'], drop: ['Vide'] });
  assert.deepEqual(noMark, [], 'une app sans ligne d\'état n\'en reçoit pas');
});

test('appActions : sans identité, la ligne commune (Utilisateur vide) est celle qui s\'écrit', () => {
  const actions = appActions(filing, T, { id: [1], Utilisateur: ['moi@exemple.org'], ModeleId: [7], Dossier: ['A'], Epingle: [false] }, '', { entries: [{ file: '7', pinned: false, folder: 'B' }] });
  assert.deepEqual(actions, [['AddRecord', T, null, { Utilisateur: '', ModeleId: 7, Epingle: false, Dossier: 'B' }]]);
});

const gfs = rows => ({ tableId: 'GFS_Filing', data: { id: rows.map((row, i) => i + 1), ...Object.fromEntries(['User', 'App', 'File', 'Favorite', 'Folder'].map(column => [column,
  rows.map(row => row[column])])) } });
const line = (extra) => ({ User: 'moi@exemple.org', App: '', File: '', Favorite: false, Folder: '', ...extra });

test('carryOver : ce que GFS disait de l\'app passe chez elle (la première ligne de chaque fichier) et part de GFS_Filing ; ses dossiers sans fichier aussi ; une autre app ou une autre personne n\'est pas touchée', () => {
  const lines = gfs([
    line({ App: 'publipostage', File: '7', Favorite: true, Folder: 'Archives' }),
    line({ App: 'publipostage', File: '7', Folder: 'Doublon' }),
    line({ App: 'publipostage', File: '8', Folder: 'Contrats' }),
    line({ App: 'form', File: '3', Folder: 'Formulaires' }),
    line({ User: 'autre@exemple.org', App: 'publipostage', File: '9', Folder: 'Prive' }),
    line({ Folder: 'Gardé' }),
    line({ User: 'autre@exemple.org', Folder: 'Gardé par un autre' }),
    line({ User: '@document', App: 'gfs', File: 'apps' }),
  ]);
  const carried = carryOver(filing, { data: prefs() }, lines, 'moi@exemple.org');
  assert.deepEqual(carried.entries, [{ file: '7', pinned: true, folder: 'Archives' }, { file: '8', pinned: false, folder: 'Contrats' }]);
  assert.deepEqual(carried.folders, ['Gardé']);
  assert.deepEqual(carried.removed, [['RemoveRecord', 'GFS_Filing', 1], ['RemoveRecord', 'GFS_Filing', 2], ['RemoveRecord', 'GFS_Filing', 3]]);
});

test('carryOver : une ligne de GFS sans dossier ni favori n\'est reprise que pour défaire une ligne de l\'app (le fichier est revenu à la racine dans GFS) ; sinon elle part sans rien écrire chez l\'app', () => {
  const lines = gfs([line({ App: 'publipostage', File: '7' }), line({ App: 'publipostage', File: '8' })]);
  const carried = carryOver(filing, { data: prefs() }, lines, 'moi@exemple.org');
  assert.deepEqual(carried.entries, [{ file: '7', pinned: false, folder: '' }], 'l\'app range 7 dans Factures : GFS l\'avait remis à la racine');
  assert.equal(carried.removed.length, 2);
});

test('carryOver : sans table de GFS ni rien à reprendre, rien ; une app sans ligne d\'état ne reçoit pas les dossiers', () => {
  assert.deepEqual(carryOver(filing, { data: prefs() }, { tableId: 'GFS_Filing', data: null }, 'moi@exemple.org'), { entries: [], folders: [], removed: [] });
  const lines = gfs([line({ Folder: 'Gardé' })]);
  assert.deepEqual(carryOver({ ...filing, marque: undefined }, { data: prefs() }, lines, 'moi@exemple.org').folders, []);
});
