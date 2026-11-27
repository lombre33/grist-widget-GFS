// « À vérifier » du guide (module Guide, 27/11) : les points que le relevé trouve (contact introuvable, poste vacant, aucun contact, pas relue, brouillon, boucle),
// la lecture du brouillon et de la date de relecture, et la valeur que « Marquer vérifiée » écrit selon la colonne. Sur le document fictif de test/guide-fixtures.mjs
// (deux colonnes en plus : « Brouillon » et « Relue »).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readConfig, REVIEW_MONTHS } from '../js/guide/guide-config.js';
import { buildProcedures, buildIndex, rolesFor } from '../js/guide/guide-model.js';
import { directoryOf, answerOf } from '../js/guide/guide-contacts.js';
import { checksOf, cutoffOf, verifiedValue, SEVERITY } from '../js/guide/guide-checks.js';
import { fieldsOf, recordOf, valuesFrom } from '../js/guide/guide-write.js';
import { schemaOf, columnOf } from '../js/annuaire/annuaire-schema.js';
import { buildPeople, buildTree } from '../js/annuaire/annuaire-model.js';
import { guideDocument, guideConfig, configFixture, PROCEDURES_TABLE } from './guide-fixtures.mjs';

const doc = guideDocument();
const columns = doc._grist_Tables_column;
for (const [id, colId, type] of [[59, 'Brouillon', 'Bool'], [60, 'Relue', 'Date']]) {
  columns.id.push(id);
  columns.parentId.push(4);
  columns.colId.push(colId);
  columns.type.push(type);
  columns.visibleCol.push(0);
  columns.widgetOptions.push('');
  columns.isFormula.push(false);
}
const DAY = 24 * 3600;
const at = iso => Date.parse(`${iso}T00:00:00Z`) / 1000;
doc[PROCEDURES_TABLE].Brouillon = doc[PROCEDURES_TABLE].id.map(row => row === 2);
doc[PROCEDURES_TABLE].Relue = doc[PROCEDURES_TABLE].id.map(row => (row === 1 ? at('2026-10-01') : row === 2 ? at('2024-01-15') : 0));
const schema = schemaOf(doc._grist_Tables, doc._grist_Tables_column);
const config = readConfig({ ...guideConfig(), draft: 'Brouillon', verified: 'Relue', reviewMonths: 12 });
const procs = buildProcedures(config, PROCEDURES_TABLE, doc, schema);
const index = buildIndex(procs);
const people = buildPeople(configFixture(), 'Personnes', doc, schema);
const directory = directoryOf({ annuaire: { table: 'Personnes', name: 'Annuaire' }, people, tree: buildTree(people, configFixture().levels, 'Annuaire') });
const answerFor = row => answerOf(rolesFor(index, config, row), col => columnOf(schema, PROCEDURES_TABLE, col), directory);
const model = { procs, index, config };
const checks = checksOf(model, { answerFor, today: '2026-11-27' });
const issuesOf = title => (checks.items.find(item => item.proc.title === title) || { issues: [] }).issues;
const codes = title => issuesOf(title).map(issue => issue.code);

test('config : le brouillon, la relecture et le délai se lisent, avec un délai par défaut', () => {
  assert.equal(config.draft, 'Brouillon');
  assert.equal(config.verified, 'Relue');
  assert.equal(config.reviewMonths, 12);
  assert.equal(readConfig({}).reviewMonths, REVIEW_MONTHS);
  assert.equal(readConfig({ reviewMonths: 0 }).reviewMonths, 0);
  assert.equal(readConfig({ reviewMonths: -3 }).reviewMonths, REVIEW_MONTHS);
  assert.equal(readConfig({ reviewMonths: 9999 }).reviewMonths, REVIEW_MONTHS);
  assert.equal(readConfig({ title: 'A', draft: 'A', verified: 'A' }).draft, '', 'une colonne ne sert qu\'une fois');
});

test('modèle : le brouillon (case ou texte) et la date de relecture (date Grist ou texte) se lisent', () => {
  const byTitle = title => procs.find(proc => proc.title === title);
  assert.equal(byTitle('Poser des congés').draft, true);
  assert.equal(byTitle('Congés et absences').draft, false);
  assert.equal(byTitle('Congés et absences').verified, '2026-10-01');
  assert.equal(byTitle('Poser des congés').verified, '2024-01-15');
  assert.equal(byTitle('Boucle A').verified, '');
});

test('relevé : un contact introuvable, un poste vacant, aucun contact, pas relue, brouillon, boucle', () => {
  assert.ok(codes('Remboursement de frais').includes('vacant'), 'un poste sans titulaire est vacant');
  assert.ok(codes('Missions et déplacements').includes('lostPerson'), 'une fiche qui n\'existe plus est introuvable');
  assert.ok(codes('Boucle A').includes('loop') && codes('Boucle B').includes('loop'));
  assert.ok(codes('Démarche orpheline').includes('noContact'), 'une démarche sans contact, sans mère, est signalée');
  assert.ok(!codes('Poser des congés exceptionnels').includes('noContact'), 'une fille sans contact le tient de sa mère : rien à dire');
  assert.deepEqual(codes('Poser des congés'), ['stale', 'draft'], 'relue il y a plus de douze mois, et en brouillon');
  assert.ok(!codes('Congés et absences').includes('stale'), 'relue le mois dernier : à jour');
  assert.ok(issuesOf('Remboursement de frais').find(issue => issue.code === 'stale').since === '', 'jamais relue : pas de date');
});

test('relevé : le plus grave d\'abord, puis par titre ; le compte est celui des démarches et des points', () => {
  const ranks = checks.items.map(item => SEVERITY[item.issues[0].code]);
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
  assert.equal(checks.count, checks.items.length);
  assert.equal(checks.total, checks.items.reduce((sum, item) => sum + item.issues.length, 0));
});

test('relevé : sans colonne « Vérifiée le » ou avec un délai de 0, rien n\'est dit de la relecture', () => {
  for (const changed of [{ verified: '' }, { reviewMonths: 0 }]) {
    const other = checksOf({ ...model, config: { ...config, ...changed } }, { answerFor, today: '2026-11-27' });
    assert.ok(!other.items.some(item => item.issues.some(issue => issue.code === 'stale')), JSON.stringify(changed));
  }
});

test('dates : le jour limite recule de n mois ; la valeur écrite suit le type de la colonne', () => {
  assert.equal(cutoffOf('2026-11-27', 12), '2025-11-27');
  assert.equal(cutoffOf('2026-03-31', 1), '2026-03-03', 'un mois sans 31 : Date reporte sur le mois suivant, sans exception');
  assert.equal(verifiedValue('date', '2026-11-27'), at('2026-11-27'));
  assert.equal(verifiedValue('text', '2026-11-27'), '2026-11-27');
  assert.equal(verifiedValue('bool', '2026-11-27'), null);
  assert.equal(verifiedValue('', '2026-11-27'), null);
  assert.equal(DAY, 86400);
});

test('éditeur : le brouillon s\'écrit en case, et seulement quand il change', () => {
  const fields = fieldsOf(config, schema, PROCEDURES_TABLE, directory);
  const draft = fields.find(item => item.key === 'draft');
  assert.equal(draft.mode, 'bool');
  assert.ok(!fields.some(item => item.col === 'Relue'), 'la date de relecture ne s\'écrit pas depuis le formulaire');
  const proc = procs.find(each => each.title === 'Poser des congés');
  const before = valuesFrom(proc, null);
  assert.deepEqual(recordOf(fields, { ...before }, before), {});
  assert.deepEqual(recordOf(fields, { ...before, draft: false }, before), { Brouillon: false });
});
