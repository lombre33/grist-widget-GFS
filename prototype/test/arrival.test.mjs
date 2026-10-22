// L'arrivée de GFS (cahier 6.2, point 2 ; contrats 7.4, point 7) : l'app que servait la section s'ouvre seule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrivalApp } from '../js/arrival.js';
import { publipostage, automation, form } from './helpers.mjs';

const manifests = [publipostage(), automation(), form()];
const both = { installed: () => true, granted: 'full' };
const only = (...ids) => ({ installed: id => ids.includes(id), granted: 'full' });

test('cahier 6.2 point 2 : une vue qui a son modèle s\'ouvre sur Publipostage+', () => {
  assert.equal(arrivalApp({ modeleDeLaVue: '16' }, manifests, both), 'publipostage');
  assert.equal(arrivalApp({ modeleDeLaVue: 16 }, manifests, both), 'publipostage', 'l\'identifiant d\'un modèle peut être un nombre');
});

test('cahier 6.2 point 2 : toute clé que le manifeste déclare compte, pas seulement le modèle de la vue', () => {
  for (const key of publipostage().reglages) {
    assert.equal(arrivalApp({ [key]: { a: 1 } }, manifests, both), 'publipostage', key);
  }
  assert.equal(arrivalApp({ workflow: '{"noeuds":[]}' }, manifests, both), 'automation', 'Automation+ pareil, pour son graphe');
});

test('cahier 6.2 point 2 : sans clé d\'une app, l\'explorateur', () => {
  assert.equal(arrivalApp({}, manifests, both), null);
  assert.equal(arrivalApp(null, manifests, both), null, 'la section n\'a aucun réglage');
  assert.equal(arrivalApp({ 'gfs.depart': 'form', 'gfs.apps': {}, autre: 1 }, manifests, both), null, 'les clés de GFS et les clés inconnues ne désignent aucune app');
  assert.equal(arrivalApp([{ modeleDeLaVue: '16' }], manifests, both), null);
  assert.equal(arrivalApp('modeleDeLaVue', manifests, both), null);
});

test('un choix retiré ne compte pas : `null` ou un texte vide laissent la clé sans valeur', () => {
  assert.equal(arrivalApp({ modeleDeLaVue: null }, manifests, both), null, 'Publipostage+ retire le modèle de la vue en écrivant null');
  assert.equal(arrivalApp({ modeleDeLaVue: '' }, manifests, both), null);
  assert.equal(arrivalApp({ modeleDeLaVue: null, droitsAcces: { lecteurs: [] } }, manifests, both), 'publipostage', 'une autre clé qui a sa valeur suffit');
  assert.equal(arrivalApp({ modeleDeLaVue: 0 }, manifests, both), 'publipostage', '0 est une valeur');
  assert.equal(arrivalApp({ modeleDeLaVue: false }, manifests, both), 'publipostage', 'false aussi');
});

test('une app qui n\'est pas installée ne s\'ouvre pas : l\'explorateur, rien ne s\'installe sans un geste', () => {
  assert.equal(arrivalApp({ workflow: '{}' }, manifests, only('publipostage')), null);
  assert.equal(arrivalApp({ workflow: '{}' }, manifests, only('publipostage', 'automation')), 'automation');
});

test('deux apps servies par la section : GFS ne devine pas, l\'explorateur', () => {
  const options = { modeleDeLaVue: '16', workflow: '{}' };
  assert.equal(arrivalApp(options, manifests, both), null);
  assert.equal(arrivalApp(options, manifests, only('publipostage')), 'publipostage', 'une seule des deux s\'ouvre ici : c\'est elle');
  assert.equal(arrivalApp(options, manifests, only('automation')), 'automation');
  assert.equal(arrivalApp(options, manifests, only('form')), null);
});

test('un accès que Grist n\'a pas donné : l\'app qui demande plus ne s\'ouvre pas', () => {
  const options = { modeleDeLaVue: '16' };
  assert.equal(arrivalApp(options, manifests, { installed: () => true, granted: 'read table' }), null);
  assert.equal(arrivalApp(options, manifests, { installed: () => true, granted: 'none' }), null);
  assert.equal(arrivalApp(options, manifests, { installed: () => true, granted: undefined }), null, 'un niveau inconnu vaut « none »');
  assert.equal(arrivalApp(options, manifests, { installed: () => true, granted: 'full' }), 'publipostage');
});

test('Form+ ne déclare aucune clé : elle ne s\'ouvre jamais à l\'arrivée', () => {
  assert.deepEqual(form().reglages || [], []);
  assert.equal(arrivalApp({ formTitle: 'Inscription', questions: [] }, manifests, both), null);
  assert.equal(arrivalApp({ formTitle: 'Inscription' }, [form()], both), null);
});

test('rien à ouvrir sans app valide', () => {
  assert.equal(arrivalApp({ modeleDeLaVue: '16' }, [], both), null);
});
