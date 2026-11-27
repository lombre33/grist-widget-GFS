// Les types de démarche du guide (module Guide, 27/11 ; option A du porteur : champs par type, plus un texte libre) : la configuration des champs et des types, les
// six types livrés et leur installation, ce qu'un champ montre (une adresse web seulement en http ou https), l'ordre d'un parcours, et ce que l'éditeur écrit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readConfig, writeConfig } from '../js/guide/guide-config.js';
import { BUILTIN_TYPES, BUILTIN_FIELDS, missingBuiltins, withBuiltins, newId, typeOf, fieldsOfType, showsRole, valueOf, dayOf, typeLabel, fieldLabel } from '../js/guide/guide-types.js';
import { fieldsOf, visibleFields, recordOf, valuesFrom, problemOf } from '../js/guide/guide-write.js';
import { buildProcedures } from '../js/guide/guide-model.js';
import { schemaOf } from '../js/annuaire/annuaire-schema.js';
import { guideConfig } from './guide-fixtures.mjs';

const base = readConfig(guideConfig());
const columnsFor = config => ({ kind: 'Type', ...Object.fromEntries(missingBuiltins(config).fields.map(field => [field.id, field.col])) });
const installed = withBuiltins(base, columnsFor(base));

test('config : les champs et les types se lisent sans exception ; une colonne ne sert qu\'une fois, un identifiant invalide ou répété est ignoré', () => {
  const read = readConfig({ title: 'T', kind: 'Type', fields: [{ id: 'delay', col: 'D', shape: 'text' }, { id: 'Bad Id', col: 'X' }, { id: 'delay', col: 'Y' }, { id: 'when', col: 'D' },
    { id: 'src', col: 'S', shape: 'inconnue' }], types: [{ id: 'req', label: ' Ma demande ', glyph: '', fields: ['delay', 'absent', 'delay', 'src'], roles: ['ask', 'nope', 'ask'] },
    { id: 'req' }, { id: 'X!' }] });
  assert.deepEqual(read.fields.map(field => [field.id, field.col, field.shape]), [['delay', 'D', 'text'], ['src', 'S', 'text']], 'colonne déjà prise, identifiant invalide, doublon');
  assert.deepEqual(read.types, [{ id: 'req', label: 'Ma demande', glyph: 'guide', fields: ['delay', 'src'], roles: ['ask'] }]);
  assert.equal(readConfig({ title: 'T', kind: 'T' }).kind, '', 'la colonne du type ne reprend pas celle du titre');
  assert.deepEqual(readConfig(writeConfig(installed)), installed, 'écrire puis relire rend la même configuration');
  for (const odd of [null, '', '{', { types: 3, fields: 'x' }]) { const empty = readConfig(odd); assert.deepEqual([empty.kind, empty.fields, empty.types], ['', [], []]); }
});

test('types livrés : six types, leurs champs sont tous des champs livrés, et l\'installation ne se fait qu\'une fois', () => {
  assert.deepEqual(BUILTIN_TYPES.map(type => type.id), ['request', 'info', 'report', 'meeting', 'route', 'contact']);
  const known = new Set(BUILTIN_FIELDS.map(field => field.id));
  for (const type of BUILTIN_TYPES) for (const id of type.fields) assert.ok(known.has(id), `${type.id} : ${id}`);
  const todo = missingBuiltins(base);
  assert.equal(todo.types.length, 6);
  assert.equal(todo.kind, true);
  assert.equal(todo.fields.length, BUILTIN_FIELDS.length);
  assert.equal(installed.kind, 'Type');
  assert.equal(installed.types.length, 6);
  assert.equal(installed.fields.length, BUILTIN_FIELDS.length);
  assert.ok(installed.types.every(type => type.fields.every(id => installed.fields.some(field => field.id === id))));
  const again = missingBuiltins(installed);
  assert.deepEqual([again.types.length, again.fields.length, again.kind], [0, 0, false]);
  assert.deepEqual(withBuiltins(installed, {}), installed, 'réinstaller ne change rien');
  const partial = withBuiltins(base, { kind: 'Type', delay: 'Delay' });
  assert.deepEqual(partial.fields.map(field => field.id), ['delay'], 'une colonne qui n\'a pas pu se créer ne fait pas de champ');
  assert.ok(partial.types.every(type => type.fields.every(id => id === 'delay')));
});

test('libellés, type d\'une démarche, champs d\'un type, rôles montrés', () => {
  const t = key => key;
  assert.equal(typeLabel(installed.types[0], t), 'gd.type.request', 'un type livré suit la langue');
  assert.equal(typeLabel({ id: 'tx', label: 'Ma démarche' }, t), 'Ma démarche');
  assert.equal(fieldLabel(installed.fields[0], t), 'gd.fld.pieces');
  assert.equal(typeOf(installed, { kind: 'info' }).id, 'info');
  assert.equal(typeOf(installed, { kind: 'absent' }), null);
  assert.equal(typeOf(installed, { kind: '' }), null);
  assert.deepEqual(fieldsOfType(installed, typeOf(installed, { kind: 'report' })).map(field => field.id), ['phone', 'hours', 'say']);
  assert.equal(showsRole(null, { preset: 'validate' }), true, 'sans type, tous les rôles');
  assert.equal(showsRole(typeOf(installed, { kind: 'info' }), { preset: 'validate' }), false);
  assert.equal(showsRole(typeOf(installed, { kind: 'info' }), { preset: 'ask' }), true);
  assert.equal(showsRole({ roles: [] }, { preset: 'other' }), true, 'un type sans liste montre tout');
});

test('valeur d\'un champ : une liste en éléments, une adresse web en lien seulement en http(s), le reste en texte ; vide : rien', () => {
  assert.equal(valueOf({ shape: 'text' }, '  '), null);
  assert.deepEqual(valueOf({ shape: 'list' }, 'Permis, Ordre de mission;RIB\n'), { items: ['Permis', 'Ordre de mission', 'RIB'] });
  assert.deepEqual(valueOf({ shape: 'link' }, 'https://exemple.fr/etat-de-frais/'), { href: 'https://exemple.fr/etat-de-frais/', text: 'exemple.fr/etat-de-frais' });
  assert.deepEqual(valueOf({ shape: 'link' }, 'javascript:alert(1)'), { text: 'javascript:alert(1)' }, 'jamais de lien pour une autre adresse');
  assert.deepEqual(valueOf({ shape: 'link' }, 'intranet/etat'), { text: 'intranet/etat' });
  assert.deepEqual(valueOf({ shape: 'long' }, 'Deux\nlignes'), { text: 'Deux\nlignes' });
});

test('parcours : « J−90 », « J+15 », « J-3 » donnent des jours ; un autre texte n\'en donne pas', () => {
  assert.deepEqual(['J−90', 'J-3', 'J+15', ' j – 5 '].map(dayOf), [-90, -3, 15, -5]);
  assert.deepEqual(['', 'bientôt', 'J', 'J15'].map(dayOf), [null, null, null, null]);
  assert.deepEqual(['J+15', 'J−90', 'J−45'].sort((a, b) => dayOf(a) - dayOf(b)), ['J−90', 'J−45', 'J+15']);
});

test('identifiants : un nom devient un identifiant sans accent ni espace, et ne reprend jamais un identifiant pris', () => {
  assert.equal(newId('Délai de réponse', [], 'x'), 'xdelaidereponse');
  assert.equal(newId('Délai', ['xdelai'], 'x'), 'xdelai2');
  assert.equal(newId('!!!', [], 't'), 't1');
  assert.match(newId('Un nom très très très très long', [], 'x'), /^x[a-z0-9]{1,23}$/);
});

const COLUMNS = [['Titre', 'Text'], ['Type', 'Text'], ['Delay', 'Text'], ['Booking_link', 'Text'], ['Answer', 'Text']];
const schema = schemaOf({ id: [1], tableId: ['T'], summarySourceTable: [0] }, { id: COLUMNS.map((_, at) => at + 1), parentId: COLUMNS.map(() => 1), colId: COLUMNS.map(col => col[0]),
  type: COLUMNS.map(col => col[1]), visibleCol: COLUMNS.map(() => 0), widgetOptions: COLUMNS.map(() => ''), isFormula: COLUMNS.map(() => false) });
const config = readConfig({ title: 'Titre', kind: 'Type', fields: [{ id: 'delay', col: 'Delay', shape: 'text' }, { id: 'booking', col: 'Booking_link', shape: 'link' },
  { id: 'answer', col: 'Answer', shape: 'long' }], types: [{ id: 'request', fields: ['delay', 'booking'] }, { id: 'info', fields: ['answer'] }] });

test('éditeur : le formulaire montre les champs du type choisi, et n\'écrit que ceux-là', () => {
  const fields = fieldsOf(config, schema, 'T', null);
  assert.deepEqual(fields.map(item => item.key), ['title', 'kind', 'x:delay', 'x:booking', 'x:answer']);
  assert.deepEqual(visibleFields(fields, config, 'request').map(item => item.key), ['title', 'kind', 'x:delay', 'x:booking']);
  assert.deepEqual(visibleFields(fields, config, 'info').map(item => item.key), ['title', 'kind', 'x:answer']);
  assert.deepEqual(visibleFields(fields, config, '').map(item => item.key), ['title', 'kind'], 'sans type, aucun champ de type');
  const values = { ...valuesFrom(null), title: 'Réserver', kind: 'request', extra: { delay: '3 semaines', booking: 'https://rdv.exemple.fr', answer: 'caché' } };
  assert.deepEqual(recordOf(visibleFields(fields, config, 'request'), values), { Titre: 'Réserver', Type: 'request', Delay: '3 semaines', Booking_link: 'https://rdv.exemple.fr' },
    'le champ d\'un autre type n\'est pas écrit');
});

test('éditeur : une démarche relue garde ses champs, et ne réécrit que ce qui change ; une adresse web fausse bloque', () => {
  const data = { id: [1], Titre: ['Réserver'], Type: ['request'], Delay: ['3 semaines'], Booking_link: ['https://rdv.exemple.fr'], Answer: [''] };
  const [proc] = buildProcedures(config, 'T', { T: data }, schema);
  assert.equal(proc.kind, 'request');
  assert.deepEqual(proc.extra, { delay: '3 semaines', booking: 'https://rdv.exemple.fr', answer: '' });
  const fields = visibleFields(fieldsOf(config, schema, 'T', null), config, 'request');
  const before = valuesFrom(proc);
  assert.deepEqual(recordOf(fields, before, before), {});
  assert.deepEqual(recordOf(fields, { ...before, extra: { ...before.extra, delay: '2 semaines' } }, before), { Delay: '2 semaines' });
  assert.equal(problemOf(fields, { ...before, extra: { ...before.extra, booking: 'rdv.exemple.fr' } }), 'gd.proc.errLink');
  assert.equal(problemOf(fields, { ...before, extra: { ...before.extra, booking: '' } }), '', 'un champ vide n\'est pas une erreur');
  assert.equal(problemOf(fields, before), '');
});
