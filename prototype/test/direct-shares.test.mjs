// « Partagés avec moi », ce qu'on m'a donné par mon adresse (js/direct-shares.js, contrats 11.7, point 13, lot 4c) : qui compte comme « donné », et où le fichier apparaît.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addressFromShares, applyDirect, directFiles, keptInFolder } from '../js/direct-shares.js';
import { listItems } from '../js/explorer-model.js';

const file = (id, extra = {}) => ({ key: `publipostage:${id}`, app: 'publipostage', id: String(id), row: id * 10, name: `Modèle ${id}`, folder: '', by: 'dernier@x.fr', search: '', weight: 0, pieces: [], ts: null, ...extra });
const data = { id: [10, 20, 30, 40], GFS_Directs: [['L', 'moi@x.fr>marc@x.fr'], ['L', 'autre@x.fr>marc@x.fr'], ['L'], '["L","MOI@x.fr>lea@x.fr"]'] };

test('un fichier est donné quand sa liste « adresse>auteur du partage » nomme mon adresse ; les autres, et ceux sans liste, ne le sont pas', () => {
  const files = applyDirect([file(1), file(2), file(3), file(4)], data, 'Moi@X.fr');
  assert.deepEqual(files.map(each => each.direct), [{ by: 'marc@x.fr' }, undefined, undefined, undefined]);
  assert.equal(files[3].direct, undefined, 'la lecture légère rend un texte JSON dont l\'adresse garde sa casse : elle est comparée en minuscules côté Grist, pas ici');
});

test('le texte JSON de la lecture légère se lit comme une liste', () => {
  const files = applyDirect([file(4)], { id: [40], GFS_Directs: ['["L","moi@x.fr>lea@x.fr"]'] }, 'moi@x.fr');
  assert.deepEqual(files[0].direct, { by: 'lea@x.fr' });
});

test('sans adresse connue, sans colonne ou sans table : rien n\'est donné ; un fichier déjà rangé dans un espace que je vois y reste', () => {
  assert.equal(applyDirect([file(1)], data, '')[0].direct, undefined);
  assert.equal(applyDirect([file(1)], { id: [10] }, 'moi@x.fr')[0].direct, undefined);
  assert.equal(applyDirect([file(1)], null, 'moi@x.fr')[0].direct, undefined);
  assert.equal(applyDirect([file(1, { space: { key: 'achats', folder: '' } })], data, 'moi@x.fr')[0].direct, undefined);
});

test('la vue montre les fichiers donnés avec celui qui les a donnés dans « Par » ; à la racine de « Moi » ils ne figurent pas tant que je ne les ai pas rangés', () => {
  const files = applyDirect([file(1), file(2, { folder: 'Perso' }), file(3)], { id: [10, 20, 30], GFS_Directs: [['L', 'moi@x.fr>marc@x.fr'], ['L', 'moi@x.fr>lea@x.fr'], ['L']] }, 'moi@x.fr');
  assert.deepEqual(directFiles(files).map(each => [each.id, each.by]), [['1', 'marc@x.fr'], ['2', 'lea@x.fr']]);
  assert.equal(keptInFolder(files[0]), false);
  assert.equal(keptInFolder(files[1]), true);
  const state = { view: 'folder', path: '', q: '', type: 'all', sort: { key: 'name', dir: 1 } };
  const root = listItems(files, state, { locale: 'fr', typeLabel: () => '' }).rows.filter(row => row.kind === 'file').map(row => row.file.id);
  assert.deepEqual(root, ['3']);
  const filed = listItems(files, { ...state, path: 'Perso' }, { locale: 'fr', typeLabel: () => '' }).rows.filter(row => row.kind === 'file').map(row => row.file.id);
  assert.deepEqual(filed, ['2']);
});

test('un lecteur n\'écrit rien dans le document : son adresse est la seule adresse de personne parmi les partages qu\'il lit', () => {
  assert.equal(addressFromShares([{ PersonneL: '@tous' }, { PersonneL: 'Moi@x.fr' }, { PersonneL: 'moi@x.fr' }]), 'moi@x.fr');
  assert.equal(addressFromShares([{ PersonneL: 'moi@x.fr' }, { PersonneL: 'autre@x.fr' }]), '', 'plusieurs adresses : on ne devine pas');
  assert.equal(addressFromShares([{ PersonneL: '@editeurs' }, { PersonneL: '#achats' }]), '');
  assert.equal(addressFromShares(null), '');
});
