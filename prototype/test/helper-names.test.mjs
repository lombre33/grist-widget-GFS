// Les colonnes d'aide du partage sous leurs deux jeux de noms (js/sharing/helper-names.js) : celui d'arrivée (anglais) et celui d'avant (français), que garde une
// table que Sync+ tient. Ce que Grist fait d'un renommage de colonne dans les règles et les formules se mesure dans un vrai Grist : labo/run-noms-gfs.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HELPER_BEFORE, helperSetOf, inSet, helperRenames, aliased, wantedBoth } from '../js/sharing/helper-names.js';
import { HELPERS, STAMP, helperColumns, fileRules, filesTarget } from '../js/sharing/sharing-model.js';

test('helperSetOf : « fr » seulement quand la table porte au moins une colonne d\'avant et aucune d\'arrivée', () => {
  assert.equal(helperSetOf(['id', 'Name', 'GFS_Lecteurs']), 'fr');
  assert.equal(helperSetOf(['id', 'gfs_auteur']), 'fr', 'la casse ne compte pas (Grist ne la distingue pas)');
  assert.equal(helperSetOf(['id', 'GFS_Readers']), 'en');
  assert.equal(helperSetOf(['id', 'GFS_Lecteurs', 'GFS_Readers']), 'en', 'un mélange : GFS continue sous les noms d\'arrivée');
  assert.equal(helperSetOf(['id', 'GFS_Calc', 'GFS_Ids', 'GFS_Admins', 'GFS_Cats']), 'en', 'les quatre noms qui ne changent pas ne disent rien');
  assert.equal(helperSetOf([]), 'en');
  assert.equal(helperSetOf(undefined), 'en');
});

test('inSet : un texte passe aux noms d\'avant mot entier par mot entier, sans toucher à GFS_Directories ni aux noms qui ne changent pas', () => {
  const text = 'rec.GFS_Denied and newRec.GFS_Author.lower() and "x" in rec.GFS_CatsWrite and GFS_Directories.lookupRecords() and $GFS_Calc and rec.GFS_Direct';
  assert.equal(inSet(text, 'fr'), 'rec.GFS_Refus and newRec.GFS_Auteur.lower() and "x" in rec.GFS_CatsEcrit and GFS_Directories.lookupRecords() and $GFS_Calc and rec.GFS_Directs');
  assert.equal(inSet(text, 'en'), text);
  assert.equal(inSet(inSet(text, 'fr'), 'fr'), inSet(text, 'fr'), 'rejouer ne change plus rien');
  assert.equal(inSet(undefined, 'fr'), undefined);
  assert.equal(inSet(42, 'fr'), 42);
});

test('chaque nom d\'avant a son nom d\'arrivée, et le code ne pose plus que ceux d\'arrivée', () => {
  assert.equal(Object.keys(HELPER_BEFORE).length, 8);
  for (const [after, before] of Object.entries(HELPER_BEFORE)) assert.ok(HELPERS.includes(after) || after === STAMP, `${after} : le code ne pose pas cette colonne`);
  for (const before of Object.values(HELPER_BEFORE)) assert.ok(!HELPERS.includes(before) && before !== STAMP, `${before} : le code pose encore le nom d'avant`);
});

test('helperColumns et fileRules d\'une cible dans le jeu d\'avant : les mêmes colonnes, formules et règles, aux noms d\'avant (rien d\'autre ne change)', () => {
  const fr = { ...filesTarget(), set: 'fr' };
  const en = filesTarget();
  const back = text => inSet(text, 'fr');
  assert.deepEqual(helperColumns(fr).map(column => column.id), helperColumns(en).map(column => back(column.id)));
  assert.deepEqual(helperColumns(fr).map(column => column.formula), helperColumns(en).map(column => back(column.formula)));
  assert.deepEqual(fileRules(fr).map(rule => rule.formula), fileRules(en).map(rule => back(rule.formula)));
  assert.ok(!JSON.stringify([helperColumns(fr), fileRules(fr)]).match(/GFS_(Author|Folder|Readers|Writers|Denied|CatsWrite|Direct|Seen)\b/));
});

test('helperRenames : une colonne d\'avant sans sa colonne d\'arrivée, sur le nom que la table aura', () => {
  assert.deepEqual(helperRenames('Publipostage_Modeles', ['id', 'Name', 'GFS_Auteur', 'GFS_Lecteurs', 'GFS_Calc']),
    [['RenameColumn', 'Publipostage_Modeles', 'GFS_Auteur', 'GFS_Author'], ['RenameColumn', 'Publipostage_Modeles', 'GFS_Lecteurs', 'GFS_Readers']]);
  assert.deepEqual(helperRenames('T', ['GFS_Auteur', 'GFS_Author']), [], 'la colonne d\'arrivée existe déjà : rien n\'est renommé (Grist ajouterait « 2 »)');
  assert.deepEqual(helperRenames('T', ['gfs_vus']), [['RenameColumn', 'T', 'gfs_vus', 'GFS_Seen']]);
  assert.deepEqual(helperRenames('T', undefined), []);
});

test('aliased : la table lue garde ses colonnes d\'avant et les rend aussi sous les noms d\'arrivée ; une table à jour est rendue telle quelle', () => {
  const old = { id: [1], GFS_Auteur: ['a@x.fr'], GFS_Directs: [['b@x.fr>a@x.fr']], Name: ['x'] };
  const seen = aliased(old);
  assert.deepEqual(Object.keys(seen).sort(), ['GFS_Auteur', 'GFS_Author', 'GFS_Direct', 'GFS_Directs', 'Name', 'id']);
  assert.equal(seen.GFS_Author, old.GFS_Auteur);
  assert.equal(old.GFS_Author, undefined, 'la table lue n\'est pas modifiée');
  const fresh = { id: [1], GFS_Author: ['a'] };
  assert.equal(aliased(fresh), fresh);
  const both = { id: [1], GFS_Auteur: ['vieux'], GFS_Author: ['neuf'] };
  assert.equal(aliased(both).GFS_Author[0], 'neuf', 'la colonne d\'arrivée gagne');
  assert.equal(aliased(null), null);
});

test('wantedBoth : les colonnes voulues d\'une lecture légère, chacune avec son nom d\'avant', () => {
  assert.deepEqual(wantedBoth(['Name', 'GFS_Author']), ['Name', 'GFS_Author', 'GFS_Auteur']);
  assert.deepEqual(wantedBoth(['Name']), ['Name']);
  assert.equal(wantedBoth(null), null);
});
