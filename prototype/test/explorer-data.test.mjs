// La lecture des fichiers pour l'explorateur (js/explorer-data.js, contrats 2.4 et 6.4) : le rangement de GFS passe devant celui de l'app, et un rangement
// illisible ne cache aucun fichier. Le port est une doublure ; ce que Grist rend vraiment se mesure dans le labo (run-explorer.mjs, run-ranger.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFiles } from '../js/explorer-data.js';
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
