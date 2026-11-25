// Les exemples en direct du réglage de l'annuaire (retour du porteur, 25/11) : la personne la mieux remplie, les tables lues, le texte d'une colonne ou d'un chemin.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sampler, reachable, richestRow } from '../js/annuaire/annuaire-sample.js';
import { schemaOf } from '../js/annuaire/annuaire-schema.js';
import { documentFixture } from './annuaire-fixtures.mjs';

const doc = documentFixture();
const schema = schemaOf(doc._grist_Tables, doc._grist_Tables_column);

test('tables lues : celle des personnes et celles que ses références visent, en deux pas au plus', () => {
  assert.deepEqual([...reachable(schema, 'Personnes')].sort(), ['Personnes', 'Structures'].sort());
  assert.deepEqual([...reachable(schema, 'Personnes', 0)], ['Personnes']);
  assert.deepEqual([...reachable(schema, 'Absente')], []);
});

test('la personne d\'exemple : celle qui a le plus de cellules remplies (la première en cas d\'égalité), et pas plus loin que la limite', () => {
  const wide = {
    Personnes: { id: [1, 2, 3], Nom: ['A', 'B', 'C'], Poste: ['', 'Chef', 'Chef'], Email: ['', 'b@x.fr', 'c@x.fr'], Responsable: [0, 0, 0], Chef: [false, false, false] },
  };
  const small = { Personnes: { columns: [{ id: 'Nom', genre: 'text' }, { id: 'Poste', genre: 'text' }, { id: 'Email', genre: 'text' }, { id: 'Responsable', genre: 'ref', ref: 'Personnes' },
    { id: 'Chef', genre: 'bool' }] } };
  assert.equal(richestRow(wide, 'Personnes', small), 1, 'B et C ont autant de cellules : la première gagne ; zéro d\'une référence et « faux » ne comptent pas');
  assert.equal(richestRow(wide, 'Personnes', small, 1), 0, 'la limite : seule la première ligne est regardée');
  assert.equal(richestRow({ Personnes: { id: [] } }, 'Personnes', small), -1);
  assert.equal(richestRow({}, 'Personnes', small), -1);
});

test('exemples : le texte d\'une colonne, d\'une référence (la colonne que Grist montre) et d\'un chemin, court ; rien avant la lecture', async () => {
  const asked = [];
  const sampler = new Sampler({ schema, table: 'Personnes', fetch: async name => { asked.push(name); return doc[name]; }, format: (value, genre) => (genre === 'bool' ? (value === 'true' ? 'oui' : 'non') : value) });
  assert.equal(sampler.text(['Nom']), '', 'avant la lecture, pas d\'exemple');
  assert.equal(sampler.state, 'idle');
  let told = 0;
  sampler.whenLoaded(() => { told += 1; });
  await sampler.load();
  await sampler.load();
  assert.equal(told, 1);
  assert.deepEqual([...new Set(asked)].sort(), ['Personnes', 'Structures'], 'chaque table est lue une fois par la lecture');
  assert.ok(sampler.ready);
  assert.ok(sampler.text(['Nom']).length > 0);
  assert.equal(sampler.text(['Structure']).length > 0, true, 'une référence dit la valeur de la colonne que Grist montre');
  assert.ok(sampler.text(['Structure', 'Pole']).length > 0, 'un chemin suit la référence');
  assert.equal(sampler.text(['Inconnue']), '');
  assert.equal(sampler.text([]), '');
  sampler.whenLoaded(() => { told += 1; });
  assert.equal(told, 2, 'quand les exemples sont là, on est prévenu tout de suite');
});

test('exemples : une lecture qui échoue laisse le réglage sans exemples, sans lever', async () => {
  const sampler = new Sampler({ schema, table: 'Personnes', fetch: async () => { throw new Error('non'); } });
  const pending = sampler.load();
  assert.equal(sampler.state, 'loading');
  let told = 0;
  sampler.whenLoaded(() => { told += 1; });
  await pending;
  assert.equal(sampler.ready, false);
  assert.equal(sampler.state, 'none');
  assert.equal(told, 1, 'on est prévenu aussi quand il n\'y a pas d\'exemple');
  assert.equal(sampler.text(['Nom']), '');
});

test('exemples : un long texte est coupé avec « … »', async () => {
  const long = { Personnes: { id: [1], Nom: ['x'.repeat(200)] } };
  const sampler = new Sampler({ schema: { Personnes: { columns: [{ id: 'Nom', genre: 'text', ref: '' }] } }, table: 'Personnes', fetch: async name => long[name] });
  await sampler.load();
  assert.equal(sampler.text(['Nom']).length, 48);
  assert.ok(sampler.text(['Nom']).endsWith('…'));
});
