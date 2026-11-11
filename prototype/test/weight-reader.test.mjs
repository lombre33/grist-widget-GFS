// La lecture du poids exact (js/weight/weight-reader.js, lot 4 du poids) : les lectures SQL se font dans l'ordre (le fichier entier d'abord : c'est la sonde), une table à la fois (Grist coupe toute lecture de plus
// d'une seconde), un refus de droits grise tout, une table trop longue ne retient pas les autres, et la fenêtre qui se ferme arrête la lecture. `sql` est une doublure de `Transfer.sql` ; ce que le vrai
// Grist rend se mesure dans le labo (labo/run-poids.mjs, passe 8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SQL, TABLE_ID, escalating, failureKind, readWeight } from '../js/weight/weight-reader.js';
import { TransferError } from '../js/broker/transfer.js';

const http = (status, message = '') => new TransferError('http', message, status);

// Une doublure : `answers` associe le début d'une lecture à ce qu'elle rend (des lignes, ou une erreur à lever).
function fake(answers) {
  const asked = [];
  const sql = async statement => {
    asked.push(statement);
    const key = Object.keys(answers).find(prefix => statement.startsWith(prefix) || statement === prefix);
    const answer = answers[key];
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return { sql, asked };
}

const GOOD = {
  [SQL.file]: [{ octets: 1000 }], [SQL.history]: [{ octets: 300 }], [SQL.stored]: [{ octets: 200 }], [SQL.counted]: [{ octets: 150 }],
  [SQL.tables]: [{ tableId: 'Petite' }, { tableId: 'Grosse' }, { tableId: 'Vide' }],
  [SQL.table('Petite')]: [{ octets: 40 }], [SQL.table('Grosse')]: [{ octets: 400 }], [SQL.table('Vide')]: [{ octets: 0 }],
};

test('lire : le fichier, l\'historique, les pièces jointes, les tables une à une, puis le reste ; les tables finissent du plus lourd au plus léger', async () => {
  const { sql, asked } = fake(GOOD);
  const states = [];
  await readWeight(sql, state => states.push(state));
  assert.deepEqual(asked, [SQL.file, SQL.history, SQL.stored, SQL.counted, SQL.tables, SQL.table('Petite'), SQL.table('Grosse'), SQL.table('Vide')], 'dans l\'ordre, une table par lecture : jamais « toutes d\'un coup »');
  const last = states.at(-1);
  assert.equal(last.status, 'ok');
  assert.deepEqual([last.file, last.history, last.stored, last.counted], [1000, 300, 200, 150]);
  assert.deepEqual(last.tables.map(row => [row.name, row.bytes, row.state]), [['Grosse', 400, 'ok'], ['Petite', 40, 'ok'], ['Vide', 0, 'ok']]);
  assert.equal(last.rest, 1000 - 440 - 300 - 200, 'ce que ni les tables, ni les pièces jointes, ni l\'historique n\'expliquent');
  assert.equal(states[0].status, 'loading');
  assert.deepEqual(states.filter(state => state.tables).map(state => state.tables.filter(row => row.state === 'wait').length), [3, 2, 1, 0, 0], 'la liste arrive d\'abord, puis une table de moins en attente à chaque lecture');
});

test('un refus de droits sur la sonde (403) grise tout : une seule lecture, aucune autre n\'est tentée', async () => {
  const { sql, asked } = fake({ [SQL.file]: http(403, 'Insufficient access') });
  const states = [];
  await readWeight(sql, state => states.push(state));
  assert.deepEqual(asked, [SQL.file]);
  assert.deepEqual([states.at(-1).status, states.at(-1).reason], ['denied', 'Insufficient access']);
});

test('une lecture coupée (400) ou un serveur muet : « slow » ou « failed », avec la raison', async () => {
  const slow = fake({ [SQL.file]: http(400, 'a slow statement resulted in a database interrupt') });
  let state;
  await readWeight(slow.sql, each => { state = each; });
  assert.equal(state.status, 'slow');
  const mute = fake({ [SQL.file]: new TransferError('network', 'Failed to fetch') });
  await readWeight(mute.sql, each => { state = each; });
  assert.deepEqual([state.status, state.reason], ['failed', 'Failed to fetch']);
});

test('une autre lecture qui échoue laisse sa ligne vide sans retenir le reste ; un refus de droits en route, lui, grise', async () => {
  const history = fake({ ...GOOD, [SQL.history]: new TransferError('network', 'coupé') });
  let state;
  await readWeight(history.sql, each => { state = each; });
  assert.deepEqual([state.status, state.history, state.stored, state.tables.length], ['ok', null, 200, 3]);
  const lost = fake({ ...GOOD, [SQL.stored]: http(403, 'plus de droit') });
  await readWeight(lost.sql, each => { state = each; });
  assert.equal(state.status, 'denied');
});

test('une table trop longue (400) ou illisible ne retient pas les autres ; le reste compte alors sans elle', async () => {
  const { sql } = fake({ ...GOOD, [SQL.table('Grosse')]: http(400, 'slow'), [SQL.table('Petite')]: new TransferError('network', 'coupé') });
  let state;
  await readWeight(sql, each => { state = each; });
  assert.equal(state.status, 'ok');
  assert.deepEqual(state.tables.map(row => [row.name, row.state, row.bytes]), [['Vide', 'ok', 0], ['Grosse', 'slow', null], ['Petite', 'failed', null]]);
});

test('un identifiant qui n\'est pas celui d\'une table de Grist n\'entre jamais dans une lecture', async () => {
  const bad = "x'; DROP TABLE y; --";
  const { sql, asked } = fake({ ...GOOD, [SQL.tables]: [{ tableId: 'Bonne' }, { tableId: bad }, { tableId: '1abc' }], [SQL.table('Bonne')]: [{ octets: 5 }] });
  let state;
  await readWeight(sql, each => { state = each; });
  assert.equal(asked.some(statement => statement.includes('DROP')), false);
  assert.deepEqual(state.tables.map(row => [row.name, row.state]), [['Bonne', 'ok'], ['1abc', 'failed'], [bad, 'failed']], 'les tables illisibles ferment la liste, par nom');
  for (const ok of ['Clients', '_Privee', 'Publipostage_Modeles_summary_x', 'A1']) assert.match(ok, TABLE_ID);
  for (const no of ['', '1x', 'a b', "a'b", 'a-b', 'é']) assert.doesNotMatch(no, TABLE_ID);
});

test('fermer la fenêtre arrête la lecture : plus aucune lecture ni mise à jour après', async () => {
  const { sql, asked } = fake(GOOD);
  let closed = false;
  const states = [];
  await readWeight(sql, state => { states.push(state); if (state.tables) closed = true; }, () => closed);
  assert.equal(asked.includes(SQL.table('Petite')), false, 'la liste lue, la fenêtre se ferme : aucune table n\'est lue');
  assert.equal(states.every(state => state.status === 'loading'), true);
});

test('failureKind : 403 et 401 → denied, 400 → slow, le reste → failed', () => {
  assert.deepEqual([403, 401, 400, 500, 404].map(status => failureKind(http(status))), ['denied', 'denied', 'slow', 'failed', 'failed']);
  assert.equal(failureKind(new TransferError('network', 'x')), 'failed');
  assert.equal(failureKind(new Error('x')), 'failed');
});

test('les lectures sont des SELECT de lecture seule, celle d\'une table cite son nom', () => {
  for (const statement of [SQL.file, SQL.history, SQL.stored, SQL.counted, SQL.tables, SQL.table('Clients')]) assert.match(statement, /^SELECT /);
  assert.match(SQL.table('Clients'), /FROM dbstat WHERE name = 'Clients'$/);
});

test('escalating : lecture seule d\'abord ; refusée (403), un seul nouvel essai avec le jeton qui peut écrire, puis tout le reste avec lui', async () => {
  const calls = [];
  const sqlWith = async (statement, writable) => {
    calls.push([statement, writable]);
    if (!writable) throw http(403, 'insufficient document access');
    return [{ octets: 7 }];
  };
  const sql = escalating(sqlWith);
  assert.deepEqual(await sql('A'), [{ octets: 7 }]);
  assert.deepEqual(await sql('B'), [{ octets: 7 }]);
  assert.deepEqual(calls, [['A', false], ['A', true], ['B', true]], 'le refus coûte un essai, une seule fois');
});

test('escalating : une lecture qui passe en lecture seule ne monte jamais ; un refus des deux jetons (éditeur, lecteur) reste un refus, une lecture coupée (400) ne change pas de jeton', async () => {
  const quiet = [];
  const fine = escalating(async (statement, writable) => { quiet.push(writable); return [{ octets: 1 }]; });
  await fine('A'); await fine('B');
  assert.deepEqual(quiet, [false, false], 'sans règle d\'accès, le jeton qui peut écrire n\'est jamais demandé');
  const seen = [];
  const both = escalating(async (statement, writable) => { seen.push(writable); throw http(403, 'insufficient document access'); });
  await assert.rejects(both('A'), error => failureKind(error) === 'denied');
  assert.deepEqual(seen, [false, true], 'deux jetons, deux refus, pas de troisième essai');
  const slow = [];
  const cut = escalating(async (statement, writable) => { slow.push(writable); throw http(400, 'a slow statement resulted in a database interrupt'); });
  await assert.rejects(cut('A'), error => failureKind(error) === 'slow');
  assert.deepEqual(slow, [false], 'une lecture coupée n\'est pas un manque de droits');
});

test('un propriétaire d\'un document à règles d\'accès : la sonde est refusée en lecture seule, la lecture entière passe avec le jeton qui peut écrire', async () => {
  const writableCalls = [];
  const base = fake(GOOD);
  const guarded = escalating(async (statement, writable) => {
    if (!writable) throw http(403, 'insufficient document access');
    writableCalls.push(statement);
    return base.sql(statement);
  });
  const updates = [];
  await readWeight(guarded, state => updates.push(state));
  const last = updates.at(-1);
  assert.equal(last.status, 'ok');
  assert.ok(writableCalls.length >= 5, 'toutes les lectures ont suivi le jeton qui peut écrire');
});
