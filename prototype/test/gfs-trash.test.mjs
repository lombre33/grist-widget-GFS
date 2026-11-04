// La corbeille des fichiers des apps, sans Grist (js/gfs-trash.js, contrats 2.4 `suppression` et 6.7) : la recette du manifeste, l'instantané d'une ligne, l'entrée de `GFS_Corbeille`, sa lecture
// pour l'explorateur et ce que la restauration remet. Ce que Grist fait de ces écritures se mesure dans le labo (labo/run-corbeille-apps.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BIN_COLUMN_IDS, recipeOf, writable, snapshotOf, parseSnapshot, entryRecord, binFiles, restorePlan } from '../js/gfs-trash.js';
import { readFiles } from '../js/explorer-model.js';
import { publipostage } from './helpers.mjs';

const manifest = publipostage();
const spec = manifest.fichiers[0];
const COLUMNS = ['Nom', 'Contenu', 'TypeModele', 'DateModif', 'ModifiePar', 'EstParDefaut', 'Jeton'];

// La table des modèles de Publipostage+ telle que `fetchTable` la rend : trois modèles et la ligne des réglages de l'app (que le manifeste exclut).
const models = () => ({
  id: [1, 2, 3, 4], Nom: ['Convocation', 'Attestation', 'Relance', '@reglages'], Contenu: ['<p>a</p>', '<p>b</p>', '<p>c</p>', '{}'], TypeModele: ['document', 'grille', 'email', 'reglages'],
  DateModif: [100, 200, 300, 0], ModifiePar: ['ana@exemple.org', '', '', ''], EstParDefaut: [true, false, false, false], Jeton: ['j1', 'j2', 'j3', ''],
});

test('la recette : `suppression.ligne: true` dit comment GFS retire et remet un fichier ; sans elle, ou autrement, rien ne se supprime', () => {
  assert.deepEqual(recipeOf(spec), { ligne: true, uniques: ['Jeton'], exclusives: ['EstParDefaut'] });
  assert.equal(recipeOf({ ...spec, suppression: undefined }), null);
  assert.equal(recipeOf({ ...spec, suppression: { ligne: false } }), null);
  assert.equal(recipeOf({ ...spec, suppression: {} }), null);
  assert.equal(recipeOf(null), null);
});

test('les colonnes qu\'on peut écrire : celles de données que Grist rend, jamais `id`, jamais une colonne absente', () => {
  assert.deepEqual(writable(models(), ['Nom', 'id', 'Absente', 'Jeton']), ['Nom', 'Jeton']);
  assert.deepEqual(writable(null, ['Nom']), []);
});

test('l\'instantané d\'une ligne garde son numéro et les colonnes demandées, et se relit', () => {
  const snapshot = snapshotOf(models(), 1, ['Nom', 'Jeton']);
  assert.deepEqual(snapshot, { format: 1, id: 2, valeurs: { Nom: 'Attestation', Jeton: 'j2' } });
  assert.deepEqual(parseSnapshot(JSON.stringify(snapshot)), snapshot);
});

test('un instantané illisible est refusé : du texte quelconque, un autre format, des valeurs absentes', () => {
  for (const bad of ['', 'pas du json', '[]', 'null', '{"format":2,"valeurs":{}}', '{"format":1}', '{"format":1,"valeurs":3}', undefined, null, 12]) assert.equal(parseSnapshot(bad), null, String(bad));
});

test('l\'entrée de la corbeille : ce que l\'explorateur montre, le geste (la date en secondes) et la ligne en JSON ; rien n\'est laissé indéfini', () => {
  const snapshot = snapshotOf(models(), 0, COLUMNS);
  const record = entryRecord({ id: 'ab12', app: 'publipostage', spec, file: { id: 1, name: 'Convocation', type: 'document', ts: 100, by: 'ana@exemple.org' }, snapshot, now: 1762000000999, author: 'paul@exemple.fr' });
  assert.deepEqual(Object.keys(record), BIN_COLUMN_IDS);
  assert.deepEqual({ ...record, Instantane: undefined }, {
    Identifiant: 'ab12', App: 'publipostage', Table: 'Publipostage_Modeles', FichierId: '1', Nom: 'Convocation', Type: 'document', Date: 100, Auteur: 'ana@exemple.org',
    SupprimeLe: 1762000000, SupprimePar: 'paul@exemple.fr', Instantane: undefined,
  });
  assert.deepEqual(parseSnapshot(record.Instantane), snapshot);
  const bare = entryRecord({ id: 'cd34', app: 'publipostage', spec, file: { id: 2, name: 'X', type: '', ts: null, by: '' }, snapshot, now: 5000, author: '' });
  assert.deepEqual([bare.Date, bare.Auteur, bare.SupprimePar, bare.Type], [null, '', '', '']);
});

// `GFS_Corbeille` telle que `fetchTable` la rend, avec deux fichiers de Publipostage+, un d'une autre app et un d'une autre table.
const bin = () => ({
  id: [7, 8, 9, 10], App: ['publipostage', 'publipostage', 'automation', 'publipostage'], Table: ['Publipostage_Modeles', 'Publipostage_Modeles', 'Publipostage_Modeles', 'Publipostage_Autre'],
  FichierId: ['1', '5', '1', '1'], Nom: ['Convocation', 'Bilan', 'Autre app', 'Autre table'], Type: ['document', 'grille', '', ''], Date: [100, 500, null, null], Auteur: ['ana@exemple.org', '', '', ''],
  SupprimeLe: [1762000000, 1762000100, 1762000200, 1762000300], SupprimePar: ['paul@exemple.fr', '', '', ''],
});

test('la corbeille relue pour l\'explorateur : seulement les entrées de l\'app et de la table, dans la forme de `readFiles` ; l\'identifiant du fichier est celui de l\'app, le numéro de ligne celui de la corbeille', () => {
  const gone = binFiles(spec, bin(), 'publipostage');
  const files = readFiles(manifest, gone.spec, gone.data);
  assert.deepEqual(files.map(file => [file.key, file.id, file.row, file.name, file.type, file.ts, file.by]), [
    ['publipostage:1', '1', 7, 'Convocation', 'document', 100, 'ana@exemple.org'],
    ['publipostage:5', '5', 8, 'Bilan', 'grille', 500, ''],
  ]);
  assert.deepEqual(files.map(file => file.trashed), [{ ts: 1762000000, by: 'paul@exemple.fr' }, { ts: 1762000100, by: '' }]);
  assert.deepEqual(files.map(file => file.table), ['Publipostage_Modeles', 'Publipostage_Modeles']);
  assert.equal(files[0].known, true, 'son type est reconnu : l\'icône et le mot du type restent');
});

test('la corbeille relue ne filtre pas les lignes d\'après `exclure` de la table de l\'app : une entrée dont le type est « reglages » est rendue comme les autres', () => {
  const data = { ...bin(), Type: ['reglages', 'grille', '', ''] };
  const gone = binFiles(spec, data, 'publipostage');
  assert.equal(gone.spec.exclure, undefined);
  assert.deepEqual(readFiles(manifest, gone.spec, gone.data).map(file => file.name), ['Convocation', 'Bilan']);
});

test('sans table, ou sans entrée de cette app : rien', () => {
  const none = binFiles(spec, null, 'publipostage');
  assert.deepEqual(readFiles(manifest, none.spec, none.data), []);
  const other = binFiles(spec, bin(), 'form');
  assert.deepEqual(readFiles(manifest, other.spec, other.data), []);
});

const plan = (over = {}) => {
  const data = over.data || models();
  const snapshot = over.snapshot || snapshotOf(models(), 1, COLUMNS);
  return restorePlan({ snapshot, spec, data, columns: over.columns || COLUMNS });
};

// Le modèle « Attestation » (ligne 2) a été supprimé : la table relue ne l'a plus.
const without = (rows = [2]) => {
  const all = models();
  const keep = all.id.map((row, i) => i).filter(i => !rows.includes(all.id[i]));
  return Object.fromEntries(Object.entries(all).map(([column, values]) => [column, keep.map(i => values[i])]));
};

test('restaurer : la ligne revient au même numéro, avec ses valeurs, quand le numéro est libre et que rien ne la gêne', () => {
  const result = plan({ data: without() });
  assert.equal(result.present, undefined);
  assert.equal(result.rowId, 2);
  assert.deepEqual(result.values, { Nom: 'Attestation', Contenu: '<p>b</p>', TypeModele: 'grille', DateModif: 200, ModifiePar: '', EstParDefaut: false, Jeton: 'j2' });
  assert.deepEqual([result.name, result.renamed], ['Attestation', false]);
});

test('restaurer : un numéro pris par une autre ligne donne un numéro neuf (null), jamais l\'écrasement', () => {
  const data = without();
  data.id.push(2); // quelqu'un a ajouté une ligne, qui a reçu le numéro libéré
  for (const column of Object.keys(data).filter(key => key !== 'id')) data[column].push(column === 'Nom' ? 'Autre' : '');
  assert.equal(plan({ data }).rowId, null);
});

test('restaurer : un nom pris devient le premier nom libre avec un numéro (sans traiter « .1 » comme une extension), et le dit', () => {
  const data = without();
  data.Nom[0] = 'Attestation';
  const result = plan({ data });
  assert.deepEqual([result.name, result.renamed, result.values.Nom], ['Attestation (1)', true, 'Attestation (1)']);
  const dotted = plan({ data: without(), snapshot: snapshotOf({ ...models(), Nom: ['x', 'Modèle 2.1', 'y', 'z'] }, 1, COLUMNS) });
  assert.equal(dotted.name, 'Modèle 2.1');
  const clash = without();
  clash.Nom[0] = 'modèle 2.1';
  assert.equal(plan({ data: clash, snapshot: snapshotOf({ ...models(), Nom: ['x', 'Modèle 2.1', 'y', 'z'] }, 1, COLUMNS) }).name, 'Modèle 2.1 (1)');
});

test('restaurer : le nom d\'une ligne exclue (les réglages de l\'app) ne compte pas comme un nom pris', () => {
  const data = without();
  data.Nom[data.Nom.length - 1] = 'Attestation'; // la ligne « reglages » porte ce nom
  assert.equal(plan({ data }).renamed, false);
});

test('restaurer : une ligne qui porte déjà le même jeton (`uniques`) : il n\'y a rien à remettre, et le dit avec son nom', () => {
  const data = without();
  data.Jeton[0] = 'j2';
  data.Nom[0] = 'Déjà là';
  assert.deepEqual(plan({ data }), { present: true, name: 'Déjà là' });
  const empty = plan({ data: without(), snapshot: snapshotOf({ ...models(), Jeton: ['j1', '', 'j3', ''] }, 1, COLUMNS) });
  assert.equal(empty.present, undefined, 'un jeton vide ne désigne personne');
});

test('restaurer : une colonne exclusive (« le modèle par défaut ») n\'est reprise que si personne d\'autre ne l\'a', () => {
  const taken = snapshotOf({ ...models(), EstParDefaut: [false, true, false, false] }, 1, COLUMNS);
  assert.equal(plan({ data: without(), snapshot: taken }).values.EstParDefaut, false, 'la ligne 1 est déjà le modèle par défaut');
  const free = without();
  free.EstParDefaut[0] = false;
  assert.equal(plan({ data: free, snapshot: taken }).values.EstParDefaut, true, 'plus personne : il la reprend');
  const settings = without();
  settings.EstParDefaut = [false, false, true]; // la ligne des réglages de l'app ne compte pas
  settings.TypeModele = ['document', 'email', 'reglages'];
  assert.equal(plan({ data: settings, snapshot: taken }).values.EstParDefaut, true);
});

test('restaurer : seules les colonnes d\'écriture sont écrites (une formule ne l\'est jamais) ; `remettre` l\'emporte sur la valeur gardée', () => {
  const only = plan({ data: without(), columns: ['Nom', 'Jeton'] });
  assert.deepEqual(only.values, { Nom: 'Attestation', Jeton: 'j2' });
  const reset = restorePlan({ snapshot: snapshotOf(models(), 1, COLUMNS), spec: { ...spec, suppression: { ligne: true, remettre: { ModifiePar: '' , Contenu: '<p></p>', Absente: 1 } } }, data: without(), columns: COLUMNS });
  assert.deepEqual([reset.values.ModifiePar, reset.values.Contenu, 'Absente' in reset.values], ['', '<p></p>', false]);
});
