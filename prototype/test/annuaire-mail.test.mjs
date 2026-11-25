// « Écrire au groupe » (module Annuaire, demande du porteur du 25/11) : les adresses, la longueur du lien, les lots qui tiennent et le CSV. Du code sans effet de bord.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addressesOf, mailLink, linkLength, mailBatches, mailPlan, csvOf, csvName, MAILTO_LIMIT } from '../js/annuaire/annuaire-mail.js';

const person = email => ({ email });
const many = n => Array.from({ length: n }, (unused, i) => `personne.numero${i + 1}@universite-exemple.fr`);

test('les adresses : sans les vides, sans doublons (à la casse près), dans l\'ordre', () => {
  assert.deepEqual(addressesOf([person('a@x.fr'), person(''), person(undefined), person(' B@x.fr '), person('b@X.fr'), person('c@x.fr')]), ['a@x.fr', 'B@x.fr', 'c@x.fr']);
  assert.deepEqual(addressesOf([]), []);
});

test('le lien : en Cci par défaut, « @ » reste lisible, le reste est protégé', () => {
  assert.equal(mailLink(['a@x.fr', 'b@x.fr']), 'mailto:?bcc=a@x.fr,b@x.fr');
  assert.equal(mailLink(['a@x.fr', 'b@x.fr'], 'to'), 'mailto:a@x.fr,b@x.fr');
  assert.equal(mailLink(['a&b@x.fr']), 'mailto:?bcc=a%26b@x.fr');
  assert.equal(linkLength(['a@x.fr']), 'mailto:?bcc=a@x.fr'.length);
});

test('un seul message tient jusqu\'à la limite, pas au-delà', () => {
  const few = mailPlan(many(10));
  assert.equal(few.fits, true);
  assert.equal(few.batches.length, 1);
  const lots = mailPlan(many(60));
  assert.equal(lots.fits, false, 'soixante adresses de cette longueur dépassent un lien');
  assert.ok(lots.length > MAILTO_LIMIT);
  assert.equal(lots.limit, MAILTO_LIMIT);
  assert.equal(mailPlan([]).fits, false, 'aucune adresse : rien à ouvrir');
});

test('les lots : au plus `per` adresses, un lien qui tient, toutes les adresses une fois, dans l\'ordre', () => {
  const all = many(100);
  const batches = mailBatches(all, { per: 40 });
  assert.ok(batches.every(batch => batch.length <= 40 && linkLength(batch) <= MAILTO_LIMIT));
  assert.deepEqual(batches.flat(), all);
  const short = mailBatches(all, { per: 7 });
  assert.equal(short.length, Math.ceil(100 / 7));
  assert.ok(short.slice(0, -1).every(batch => batch.length === 7));
  assert.deepEqual(mailBatches([], { per: 10 }), []);
});

test('une adresse seule plus longue que la limite a son lot ; la limite coupe avant `per` quand les adresses sont longues', () => {
  const long = `${'x'.repeat(2000)}@y.fr`;
  assert.deepEqual(mailBatches(['a@x.fr', long, 'b@x.fr'], { per: 10 }), [['a@x.fr'], [long], ['b@x.fr']]);
  const wide = Array.from({ length: 30 }, (unused, i) => `${'n'.repeat(80)}${i}@y.fr`);
  const batches = mailBatches(wide, { per: 40 });
  assert.ok(batches.length > 1 && batches.every(batch => linkLength(batch) <= MAILTO_LIMIT));
});

test('le CSV : point-virgule, BOM, guillemets doublés, pas de formule injectée', () => {
  const columns = [{ label: 'Nom', of: row => row.name }, { label: 'E-mail', of: row => row.email }];
  const text = csvOf([{ name: 'Durand; Camille', email: 'c@x.fr' }, { name: '=2+2', email: '"q"' }, { name: 'Ligne\nde trop', email: '' }], columns);
  assert.equal(text, '﻿Nom;E-mail\r\n"Durand; Camille";c@x.fr\r\n\'=2+2;"""q"""\r\nLigne de trop;\r\n');
  assert.equal(csvOf([], columns), '﻿Nom;E-mail\r\n');
});

test('le nom du fichier exporté : celui de l\'annuaire, sans ce qu\'un nom de fichier refuse', () => {
  assert.equal(csvName('Annuaire de l’établissement', '2026-11-25'), 'annuaire-de-l-etablissement-2026-11-25.csv');
  assert.equal(csvName('///', '2026-11-25'), 'annuaire-2026-11-25.csv');
});
