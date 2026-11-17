// Les droits lus dans les tables internes de Grist (js/rights/rights.js) : le niveau d'une table, la structure fermée. Les lignes d'essai sont celles qu'un vrai Grist 1.7.19 a rendues
// (labo/run-droits-reel.mjs, 04/11) : la règle intégrée « tout le monde peut tout » (permissions 63), puis une règle posée par action.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelOfNote, userRules, structureClosed, tableLevels, rowsOf } from '../js/rights/rights.js';

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

test('rowsOf : les colonnes de Grist deviennent des lignes (réexporté pour le lecteur)', () => {
  assert.deepEqual(rowsOf({ id: [1, 2], a: ['x', 'y'] }), [{ id: 1, a: 'x' }, { id: 2, a: 'y' }]);
});
