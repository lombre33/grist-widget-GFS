// La lecture des fichiers pour l'explorateur (js/explorer-data.js, contrats 2.4 et 6.4) : le rangement de GFS passe devant celui de l'app, et un rangement
// illisible ne cache aucun fichier. Le port est une doublure ; ce que Grist rend vraiment se mesure dans le labo (run-explorer.mjs, run-ranger.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFiles } from '../js/explorer-data.js';
import { FILES_ENTRY } from '../js/gfs-files.js';
import { publipostage } from './helpers.mjs';

const manifest = publipostage();
const spec = manifest.fichiers[0];

const tables = () => ({
  [spec.table]: { id: [1, 2], Nom: ['Convocation', 'Attestation'], TypeModele: ['', ''], DateModif: [0, 0], ModifiePar: ['', ''] },
  [spec.rangement.table]: { id: [1, 2], Utilisateur: ['', ''], ModeleId: [1, 2], Dossier: ['Formation', 'Formation'], Epingle: [true, false] },
  gfs_rangement: { id: [1, 2], Utilisateur: ['@document', ''], App: ['gfs', 'publipostage'], Fichier: ['apps', '2'], Favori: [false, true], Dossier: ['', 'Archives'] },
});

function port(data, { broken = null } = {}) {
  return { doc: {
    listTables: async () => Object.keys(data),
    fetchTable: async name => { if (name === broken) throw new Error('accès refusé'); if (!data[name]) throw new Error(`table inconnue ${name}`); return data[name]; },
  } };
}

test('le rangement de GFS passe devant celui de l\'app (nom de table sans tenir compte de la casse) ; sans ligne de GFS, celui de l\'app reste', async () => {
  const { files, problems } = await loadFiles(port(tables()), [{ manifest }], '');
  const of = id => files.find(file => file.id === id);
  assert.deepEqual(problems, []);
  assert.deepEqual([of('1').folder, of('1').pinned], ['Formation', true]);
  assert.deepEqual([of('2').folder, of('2').pinned], ['Archives', true]);
});

test('le rangement de GFS d\'une autre personne ne s\'applique pas', async () => {
  const { files } = await loadFiles(port(tables()), [{ manifest }], 'quelqu.un@exemple.org');
  assert.deepEqual(files.map(file => [file.id, file.folder, file.pinned]), [['1', '', false], ['2', '', false]]);
});

test('un rangement de GFS illisible ne cache aucun fichier : ils restent à leur place d\'avant, et la console le dit', async () => {
  const warn = console.warn;
  const warned = [];
  console.warn = (...args) => warned.push(args[0]);
  try {
    const { files, problems } = await loadFiles(port(tables(), { broken: 'gfs_rangement' }), [{ manifest }], '');
    assert.deepEqual(files.map(file => [file.id, file.folder]), [['1', 'Formation'], ['2', 'Formation']]);
    assert.deepEqual(problems, []);
    assert.deepEqual(warned, ['GFS : le rangement de GFS est illisible']);
  } finally { console.warn = warn; }
});

test('les fichiers à la corbeille sont rendus à part : `files` ne montre que les vivants (ce que lisent « choisir » et « ouvrir »), `trash` les supprimés, avec leur dossier de retour', async () => {
  const data = {
    GFS_Fichiers: { id: [1, 2, 3], Identifiant: ['aa', 'bb', 'cc'], Nom: ['A.pdf', 'B.pdf', 'C.pdf'], Type: ['pdf', 'pdf', 'pdf'], Date: [10, 20, 30], Auteur: ['', '', ''], SupprimeLe: [null, 1762000000, null], SupprimePar: ['', 'paul@exemple.fr', ''] },
    gfs_rangement: { id: [1], Utilisateur: [''], App: ['gfs-fichiers'], Fichier: ['bb'], Favori: [true], Dossier: ['Factures'] },
  };
  const found = await loadFiles(port(data), [FILES_ENTRY], '');
  assert.deepEqual(found.files.map(file => file.key), ['gfs-fichiers:aa', 'gfs-fichiers:cc']);
  assert.deepEqual(found.trash.map(file => [file.key, file.trashed, file.folder]), [['gfs-fichiers:bb', { ts: 1762000000, by: 'paul@exemple.fr' }, 'Factures']]);
  assert.deepEqual(found.problems, []);
  assert.equal(found.stats.rows, 3);
});

test('sans fichier à la corbeille, ou avec des apps seulement : `trash` est vide', async () => {
  const found = await loadFiles(port(tables()), [{ manifest }], '');
  assert.deepEqual([found.files.length, found.trash], [2, []]);
});

test('les fichiers d\'une app mis à la corbeille ne sont plus dans sa table : ils se lisent dans GFS_Corbeille, gardent leur dossier (celui du rangement de l\'app), et ne se mêlent jamais aux vivants', async () => {
  const data = tables();
  data.GFS_Corbeille = {
    id: [5, 6], App: ['publipostage', 'form'], Table: [spec.table, spec.table], FichierId: ['9', '9'], Nom: ['Relance', 'D\'une autre app'], Type: ['email', ''], Date: [300, null], Auteur: ['', ''],
    SupprimeLe: [1762000000, 1762000000], SupprimePar: ['paul@exemple.fr', ''],
  };
  data[spec.rangement.table] = { id: [1, 2, 3], Utilisateur: ['', '', ''], ModeleId: [1, 2, 9], Dossier: ['Formation', 'Formation', 'Relances'], Epingle: [true, false, true] };
  const found = await loadFiles(port(data), [{ manifest }], '');
  assert.deepEqual(found.files.map(file => file.id), ['1', '2']);
  assert.deepEqual(found.trash.map(file => [file.key, file.row, file.name, file.type, file.folder, file.pinned, file.trashed]), [['publipostage:9', 5, 'Relance', 'email', 'Relances', true, { ts: 1762000000, by: 'paul@exemple.fr' }]]);
  assert.deepEqual(found.problems, []);
  assert.equal(found.stats.rows, 2, 'les statistiques comptent les fichiers de la table de l\'app, pas ceux de la corbeille');
});

test('une corbeille des apps illisible ne cache aucun fichier vivant, et la console le dit ; sans la table, la corbeille des apps est vide', async () => {
  const warn = console.warn;
  const warned = [];
  console.warn = (...args) => warned.push(args[0]);
  try {
    const data = { ...tables(), GFS_Corbeille: { id: [] } };
    const found = await loadFiles(port(data, { broken: 'GFS_Corbeille' }), [{ manifest }], '');
    assert.deepEqual(found.files.map(file => file.id), ['1', '2']);
    assert.deepEqual(found.trash, []);
    assert.deepEqual(warned, ['GFS : la corbeille des apps est illisible']);
  } finally { console.warn = warn; }
  assert.deepEqual((await loadFiles(port(tables()), [{ manifest }], '')).trash, []);
});

test('les dossiers que la personne garde sans fichier (lignes d\'état de GFS_Rangement : ni app ni fichier) sont rendus à part, pour elle seule ; ils ne sont jamais des fichiers ni des favoris', async () => {
  const data = tables();
  data.gfs_rangement = {
    id: [1, 2, 3, 4, 5, 6],
    Utilisateur: ['@document', 'ana@exemple.org', 'ana@exemple.org', 'ben@exemple.org', 'ana@exemple.org', 'ana@exemple.org'],
    App: ['gfs', '', '', '', 'publipostage', ''],
    Fichier: ['apps', '', '', '', '2', ''],
    Favori: [false, false, false, false, true, false],
    Dossier: ['', 'Contrats/2026', ' Contrats // 2026/ ', 'De Ben', 'Archives', ''],
  };
  const ana = await loadFiles(port(data), [{ manifest }], 'ana@exemple.org');
  assert.deepEqual(ana.folders, ['Contrats/2026'], 'une seule fois, normalisé ; le dossier d\'un autre, la ligne réservée, la ligne d\'un fichier et une ligne sans dossier n\'en sont pas');
  assert.deepEqual(ana.files.map(file => [file.id, file.folder, file.pinned]), [['1', '', false], ['2', 'Archives', true]], 'les lignes d\'état ne rangent aucun fichier ; la ligne du fichier 2 est la sienne');
  assert.deepEqual((await loadFiles(port(data), [{ manifest }], 'ben@exemple.org')).folders, ['De Ben']);
  assert.deepEqual((await loadFiles(port(data), [{ manifest }], '')).folders, [], 'sans adresse connue, le rangement est celui des lignes sans personne : aucune ici');
});

test('sans la table de GFS, ou avec une table illisible, aucun dossier n\'est gardé', async () => {
  const data = tables();
  delete data.gfs_rangement;
  assert.deepEqual((await loadFiles(port(data), [{ manifest }], '')).folders, []);
  const warn = console.warn;
  console.warn = () => {};
  try { assert.deepEqual((await loadFiles(port(tables(), { broken: 'gfs_rangement' }), [{ manifest }], '')).folders, []); } finally { console.warn = warn; }
});
