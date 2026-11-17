// Les adresses proposées en tapant les membres d'un groupe (js/sharing/group-suggest.js ; choix du porteur, 13/11 : « connues + une colonne d'e-mails »).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addressesIn, addressesOfColumn, knownAddresses, suggestionsFor, withAddress } from '../js/sharing/group-suggest.js';

test('les adresses d\'un texte : séparées par des espaces, retours, virgules ou points-virgules ; minuscules, sans doublon, le reste est ignoré', () => {
  assert.deepEqual(addressesIn('Lea@X.fr, marc@x.fr;\nlea@x.fr  zoe@x.fr'), ['lea@x.fr', 'marc@x.fr', 'zoe@x.fr']);
  assert.deepEqual(addressesIn('pas une adresse, @editeurs, #Equipe, a@b'), []);
  assert.deepEqual(addressesIn(null), []);
  assert.deepEqual(addressesIn('<lea@x.fr>'), [], 'une adresse entourée de signes n\'est pas reprise telle quelle');
});

test('les adresses d\'une colonne : texte, choix, liste de choix (tableau « L » de Grist) ; les cases vides et les noms sans adresse sont laissés', () => {
  assert.deepEqual(addressesOfColumn(['a@x.fr', '', null, 'Jean', ['L', 'b@x.fr', 'c@x.fr'], 'A@X.fr, d@x.fr', 12]), ['a@x.fr', 'b@x.fr', 'c@x.fr', 'd@x.fr']);
  assert.deepEqual(addressesOfColumn(undefined), []);
});

test('les adresses connues : la personne, les partages (personne et auteur), les membres tapés des groupes et le rangement de chacun ; ni catégories ni groupes', () => {
  const known = knownAddresses({ me: 'Moi@X.fr',
    shares: [{ Personne: 'Lea@x.fr', PersonneL: 'lea@x.fr', Auteur: 'moi@x.fr' }, { Personne: '@editeurs', Auteur: 'marc@x.fr' }, { Personne: '#Achats', Auteur: '' }],
    groups: [{ PersonnesIci: 'zoe@x.fr\nlea@x.fr' }, { PersonnesIci: '' }],
    filing: [{ Utilisateur: 'eve@x.fr' }, { Utilisateur: '@sonde' }, { Utilisateur: '@document' }, { Utilisateur: 'marc@x.fr' }] });
  assert.deepEqual(known, ['eve@x.fr', 'lea@x.fr', 'marc@x.fr', 'moi@x.fr', 'zoe@x.fr']);
  assert.deepEqual(knownAddresses({}), []);
});

test('les suggestions : les connues puis celles de la colonne, sans doublon et sans celles que le groupe a déjà ; chaque ligne a son adresse pour libellé', () => {
  const items = suggestionsFor({ known: ['a@x.fr', 'b@x.fr'], column: ['b@x.fr', 'c@x.fr', 'd@x.fr'], typed: 'D@x.fr\nz@x.fr' });
  assert.deepEqual(items.map(item => item.value), ['a@x.fr', 'b@x.fr', 'c@x.fr']);
  assert.ok(items.every(item => item.label === item.value && item.glyph === 'mail'));
  assert.deepEqual(suggestionsFor({}), []);
});

test('ajouter une adresse au champ : sur sa propre ligne, en minuscules ; inchangé si elle y est déjà ou si ce n\'est pas une adresse', () => {
  assert.equal(withAddress('', 'A@x.fr'), 'a@x.fr');
  assert.equal(withAddress('a@x.fr', 'b@x.fr'), 'a@x.fr\nb@x.fr');
  assert.equal(withAddress('a@x.fr\n\n', 'b@x.fr'), 'a@x.fr\nb@x.fr');
  assert.equal(withAddress('a@x.fr, b@x.fr', 'B@x.fr'), 'a@x.fr, b@x.fr');
  assert.equal(withAddress('a@x.fr', 'pas une adresse'), 'a@x.fr');
});
