// Les droits lus dans les tables internes de Grist (js/rights/rights.js) : le niveau d'une table, la structure fermée, le mot du pied, les partages. Les lignes d'essai sont celles qu'un vrai Grist 1.7.19 a rendues
// (labo/run-droits-reel.mjs, 04/11) : la règle intégrée « tout le monde peut tout » (permissions 63), puis une règle posée par action.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelOfNote, userRules, structureClosed, tableLevels, wordOf, ownedTables, linksOf, rowsOf } from '../js/rights/rights.js';

const BUILT_IN = { id: 1, resource: 1, permissions: 63, principals: '[1]', aclFormula: '', aclColumn: 0, permissionsText: '', memo: '' };
const DEFAULT = { id: 1, tableId: '', colIds: '' };
const rule = (id, resource, aclFormula, permissionsText, memo = '') => ({ id, resource, permissions: 0, principals: '', aclFormula, aclColumn: 0, permissionsText, memo });

test('levelOfNote : la note « GFS : <niveau> », sans casse ni accent ; toute autre note n\'est pas de GFS', () => {
  assert.equal(levelOfNote('GFS : Encadré'), 'encadre');
  assert.equal(levelOfNote('gfs: partagé · espaces'), 'partage');
  assert.equal(levelOfNote('GFS : Ouvert'), 'ouvert');
  assert.equal(levelOfNote('GFS : inconnu'), null);
  assert.equal(levelOfNote('Réservé à la compta'), null);
  assert.equal(levelOfNote(''), null);
  assert.equal(levelOfNote(undefined), null);
});

test('userRules : la règle intégrée de Grist n\'est pas une règle de la personne', () => {
  assert.deepEqual(userRules([DEFAULT], [BUILT_IN]), []);
  const rules = userRules([DEFAULT, { id: 2, tableId: 'GFS_Rangement', colIds: '*' }], [BUILT_IN, rule(2, 2, 'user.Access == EDITOR', '-C', 'GFS : Encadré')]);
  assert.equal(rules.length, 1);
  assert.deepEqual(rules[0], { id: 2, tableId: 'GFS_Rangement', colIds: '*', formula: 'user.Access == EDITOR', rights: '-C', note: 'GFS : Encadré', level: 'encadre' });
  const closing = userRules([DEFAULT], [BUILT_IN, rule(3, 1, 'user.Access != OWNER', '-S')]);
  assert.equal(closing.length, 1, 'une règle sur la ressource par défaut avec une condition est bien une règle');
});

test('structureClosed : la règle « user.Access != OWNER » → -S sur la ressource par défaut, et rien d\'autre', () => {
  const closing = userRules([DEFAULT], [BUILT_IN, rule(3, 1, 'user.Access != OWNER', '-S')]);
  assert.equal(structureClosed(closing), true);
  assert.equal(structureClosed(userRules([DEFAULT], [BUILT_IN, rule(3, 1, 'user.Access not in [OWNER]', '-S')])), true);
  assert.equal(structureClosed(userRules([DEFAULT], [BUILT_IN, rule(3, 1, 'user.Access != OWNER', '-C')])), false, 'sans -S : la structure reste ouverte');
  assert.equal(structureClosed(userRules([DEFAULT, { id: 2, tableId: 'Clients', colIds: '*' }], [BUILT_IN, rule(3, 2, 'user.Access != OWNER', '-S')])), false, 'Grist écarte -S sur une table : ce n\'est pas la case');
  assert.equal(structureClosed([]), false);
});

test('tableLevels : le plus fermé des niveaux notés par GFS ; « autre » pour une règle à la main ; « ouvert » sans règle', () => {
  const resources = [DEFAULT, { id: 2, tableId: 'GFS_Rangement', colIds: '*' }, { id: 3, tableId: 'PP_Modeles', colIds: '*' }, { id: 4, tableId: 'FP_Reponses', colIds: '*' }];
  const rules = userRules(resources, [BUILT_IN, rule(2, 2, 'user.Access in [OWNER]', '+CRUD', 'GFS : Partagé'), rule(3, 2, '', '-CRUD', 'GFS : Encadré'), rule(4, 3, 'user.Email == "a@b.c"', '+R', 'pour la compta')]);
  const levels = tableLevels(rules, ['GFS_Rangement', 'PP_Modeles', 'FP_Reponses']);
  assert.deepEqual([...levels], [['GFS_Rangement', 'encadre'], ['PP_Modeles', 'autre'], ['FP_Reponses', 'ouvert']]);
  const everywhere = userRules([DEFAULT, { id: 5, tableId: '*', colIds: '*' }], [BUILT_IN, rule(5, 5, '', '-U', 'GFS : Partagé')]);
  assert.equal(tableLevels(everywhere, ['GFS_Espaces']).get('GFS_Espaces'), 'partage', 'une règle sur toutes les tables compte pour chacune');
});

test('wordOf : Pas protégé, Protégé en partie, Protégé (Encadré ET structure fermée), « autre », ou rien à juger', () => {
  const map = (...levels) => new Map(levels.map((level, i) => [`T${i}`, level]));
  assert.equal(wordOf(map(), false), null, 'aucune table de GFS ni d\'app : rien à dire');
  assert.equal(wordOf(map('ouvert', 'ouvert'), true), 'pas');
  assert.equal(wordOf(map('encadre', 'ouvert'), true), 'pas', 'une seule table ouverte suffit à dire « Pas protégé »');
  assert.equal(wordOf(map('partage', 'encadre'), true), 'partie');
  assert.equal(wordOf(map('encadre', 'encadre'), false), 'partie', 'Encadré sans structure fermée : en partie');
  assert.equal(wordOf(map('encadre', 'encadre'), true), 'protege');
  assert.equal(wordOf(map('autre', 'encadre'), true), 'autre', 'des règles que GFS n\'a pas posées : il ne dit pas « protégé »');
});

test('ownedTables : les tables de GFS et des apps, jamais celles de la personne ni les internes', () => {
  const ids = ['Clients', 'GFS_Rangement', 'gfs_espaces', 'PP_Modeles', 'FormPlus_Pub_3', 'Form_Plus', '_grist_Tables', 'Autre'];
  assert.deepEqual(ownedTables(ids, ['PP_', 'FormPlus_']), ['GFS_Rangement', 'gfs_espaces', 'PP_Modeles', 'FormPlus_Pub_3']);
  assert.deepEqual(ownedTables(ids, []), ['GFS_Rangement', 'gfs_espaces']);
});

// Un document avec un formulaire publié : la page 7 (partagée, `shareRef` 1) porte une section de formulaire sur la table 10 (`GFS_Espaces` ci-dessous, protégée) ; la page 8 n'est pas partagée.
const META = {
  shares: [{ id: 1, linkId: 'ne-doit-jamais-sortir', options: '{"publish":true}' }, { id: 2, linkId: 'autre-cle', options: '{}' }],
  pages: [{ id: 1, viewRef: 7, shareRef: 1 }, { id: 2, viewRef: 8, shareRef: 0 }],
  views: [{ id: 7, name: 'Inscription' }, { id: 8, name: 'Accueil' }],
  tables: [{ id: 10, tableId: 'Inscrits' }, { id: 11, tableId: 'Villes' }],
  columns: [{ id: 100, parentId: 10, colId: 'Nom', type: 'Text', isFormula: false }, { id: 101, parentId: 10, colId: 'Ville', type: 'Ref:Villes', isFormula: false, visibleCol: 110 }, { id: 102, parentId: 10, colId: 'Note', type: 'Text', isFormula: false },
    { id: 110, parentId: 11, colId: 'Nom', type: 'Text', isFormula: false }],
  sections: [{ id: 50, parentId: 7, tableRef: 10, shareOptions: '{"publish":true,"form":true}' }, { id: 51, parentId: 8, tableRef: 10, shareOptions: '{"publish":true,"form":true}' }],
  fields: [{ id: 1, parentId: 50, colRef: 100, widgetOptions: '{}' }, { id: 2, parentId: 50, colRef: 101, widgetOptions: '{}' }, { id: 3, parentId: 50, colRef: 102, widgetOptions: '{"formIsHidden":true}' }],
};

test('linksOf : chaque partage, ses pages, ce que son formulaire laisse écrire (montré ou non) et lire, et la table protégée ouverte', () => {
  const links = linksOf(META, tableId => tableId === 'Villes');
  assert.equal(links.length, 2);
  assert.deepEqual(links[0], {
    id: 1, published: true, pages: ['Inscription'],
    filled: [{ tableId: 'Inscrits', shown: ['Nom', 'Ville'], unshown: ['Note'] }],
    readable: [{ tableId: 'Villes', colId: 'Nom' }],
    protectedOpen: ['Villes'],
  });
  assert.deepEqual(links[1], { id: 2, published: false, pages: [], filled: [], readable: [], protectedOpen: [] }, 'un partage sans page ni formulaire n\'ouvre rien');
  assert.equal(JSON.stringify(links).includes('ne-doit-jamais-sortir'), false, 'la clé du lien ne sort pas');
});

test('rowsOf : les colonnes de Grist deviennent des lignes (réexporté pour le lecteur)', () => {
  assert.deepEqual(rowsOf({ id: [1, 2], a: ['x', 'y'] }), [{ id: 1, a: 'x' }, { id: 2, a: 'y' }]);
});
