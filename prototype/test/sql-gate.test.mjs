// La mémoire des lectures SQL refusées (js/broker/sql-gate.js ; faits vérifiés 173) : le premier refus du serveur ferme la lecture légère de la page, et l'onglet s'en souvient un temps.
// Relevé du porteur sur la DINUM : deux comptes de lignes refusés par Grist (403, en-têtes CORS lus), puis la lecture de la structure et celle du poids refusées par le pare-feu (403 sans
// en-tête CORS : une erreur de réseau pour la page). Chaque requête refusée s'écrit dans la console, et GFS les refaisait à chaque affichage de l'explorateur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSqlGate, reasonOf, SqlClosedError, GATE_PREFIX, HOLD_MS } from '../js/broker/sql-gate.js';
import { createLightReader } from '../js/explorer/explorer-sql.js';
import { countRows } from '../js/apps/row-count.js';
import { TransferError } from '../js/broker/transfer.js';
import { keyStore } from '../js/shell/stored-choice.js';

const DOC = 'mcXUUuqh7qz1';
const KEY = `${GATE_PREFIX}${DOC}`;
const refused = () => new TransferError('http', 'Grist a refusé', 403);
const silent = () => new TransferError('network', 'NetworkError when attempting to fetch resource.');

// Un onglet de doublure : `values` ce qu'il garde.
function tab({ values = {}, refuse = false } = {}) {
  const win = { sessionStorage: {
    getItem: key => { if (refuse) throw new Error('stockage refusé'); return key in values ? values[key] : null; },
    setItem: (key, value) => { if (refuse) throw new Error('stockage refusé'); values[key] = value; },
    removeItem: key => { if (refuse) throw new Error('stockage refusé'); delete values[key]; },
  } };
  return { values, store: key => keyStore(win, key, 'sessionStorage') };
}
// Un serveur de doublure : rend les lignes, ou lève ce que `fail` désigne ; `calls` : les requêtes parties.
function server(fail = null) {
  const calls = [];
  return { calls, sql: async statement => { calls.push(statement); if (fail) throw fail(); return [{ n: 1 }]; } };
}
const gateOver = (remote, { browser = tab(), now = () => 1000, docId = async () => DOC } = {}) => createSqlGate({ sql: remote.sql, docId, store: browser.store, now });

test('reasonOf : le refus de Grist, l\'erreur de réseau (le pare-feu sans en-tête CORS), la lecture coupée et le reste', () => {
  assert.equal(reasonOf(new TransferError('http', 'refusé', 403)), 'denied');
  assert.equal(reasonOf(new TransferError('http', 'refusé', 401)), 'denied');
  assert.equal(reasonOf(new TransferError('http', 'a slow statement resulted in a database interrupt', 400)), 'slow');
  assert.equal(reasonOf(new TransferError('http', 'erreur', 500)), 'failed');
  assert.equal(reasonOf(silent()), 'network');
  for (const kind of ['timeout', 'token', 'answer', 'frame']) assert.equal(reasonOf(new TransferError(kind, 'x')), 'failed', kind);
  assert.equal(reasonOf(new Error('autre')), 'failed');
  assert.equal(reasonOf(null), 'failed');
});

test('le premier refus de Grist ferme la lecture : plus aucune requête ne part, la lecture lève SqlClosedError', async () => {
  const remote = server(refused);
  const gate = gateOver(remote);
  await assert.rejects(gate.read('SELECT 1'), error => error.status === 403, 'le premier refus est celui du serveur');
  assert.equal(gate.isClosed(), true);
  for (let i = 0; i < 3; i++) await assert.rejects(gate.read('SELECT 2'), error => error instanceof SqlClosedError && error.reason === 'denied');
  assert.equal(remote.calls.length, 1, 'une seule requête refusée dans la console, pas une par lecture');
});

test('denied() : vrai après un refus de Grist (cette page ou une page de l\'onglet), faux après une erreur de réseau, un refus périmé ou sans rien lu', async () => {
  const browser = tab();
  const first = gateOver(server(refused), { browser });
  assert.equal(await first.denied(), false, 'rien n\'a encore été refusé');
  await assert.rejects(first.read('SELECT 1'));
  assert.equal(await first.denied(), true, 'le refus de cette page');
  const reloaded = gateOver(server(), { browser, now: () => 1000 + 60 * 1000 });
  assert.equal(await reloaded.denied(), true, 'la page rechargée sait le refus sans envoyer une requête');
  const later = gateOver(server(), { browser, now: () => 1000 + HOLD_MS.denied + 1 });
  assert.equal(await later.denied(), false, 'le refus a passé ses 30 minutes');
  const silenced = gateOver(server(silent));
  await assert.rejects(silenced.read('SELECT 1'));
  assert.equal(await silenced.denied(), false, 'une erreur de réseau n\'est pas un refus de droits : le jeton qui peut écrire n\'y changerait rien');
});

test('une erreur de réseau (le pare-feu) ferme aussi la lecture ; une lecture coupée par Grist (400) ne ferme rien', async () => {
  const blocked = server(silent);
  const gate = gateOver(blocked);
  await assert.rejects(gate.read('SELECT 1'));
  await assert.rejects(gate.read('SELECT 2'), error => error instanceof SqlClosedError && error.reason === 'network');
  assert.equal(blocked.calls.length, 1);
  const slow = server(() => new TransferError('http', 'a slow statement resulted in a database interrupt', 400));
  const open = gateOver(slow);
  await assert.rejects(open.read('SELECT 1'), error => error.status === 400);
  await assert.rejects(open.read('SELECT 2'), error => error.status === 400, 'la lecture suivante part : seule celle-ci était trop longue');
  assert.equal(slow.calls.length, 2);
  assert.equal(open.isClosed(), false);
});

test('une lecture qui réussit ne ferme rien et ne laisse aucune note', async () => {
  const remote = server();
  const browser = tab();
  const gate = gateOver(remote, { browser });
  assert.deepEqual(await gate.read('SELECT 1'), [{ n: 1 }]);
  assert.deepEqual(await gate.read('SELECT 2'), [{ n: 1 }]);
  assert.equal(remote.calls.length, 2);
  assert.deepEqual(browser.values, {});
});

test('le refus se garde sur l\'onglet : la page rechargée n\'envoie rien tant que la note est fraîche, puis réessaie et efface la note périmée', async () => {
  const browser = tab();
  const first = server(refused);
  await assert.rejects(gateOver(first, { browser }).read('SELECT 1'));
  assert.deepEqual(browser.values, { [KEY]: 'denied:1000' }, 'le motif et la date, rien d\'autre');
  const reload = server();
  const fresh = gateOver(reload, { browser, now: () => 1000 + HOLD_MS.denied - 1 });
  await assert.rejects(fresh.read('SELECT 1'), error => error instanceof SqlClosedError && error.reason === 'denied');
  assert.equal(reload.calls.length, 0, 'aucune requête : la console ne reçoit rien');
  const later = gateOver(reload, { browser, now: () => 1000 + HOLD_MS.denied });
  assert.deepEqual(await later.read('SELECT 1'), [{ n: 1 }], 'la note est périmée : le serveur est interrogé de nouveau');
  assert.equal(reload.calls.length, 1);
  assert.deepEqual(browser.values, {}, 'la note périmée est effacée');
});

test('l\'erreur de réseau ne se garde que moins longtemps que le refus de Grist ; le délai dépassé et le reste ne ferment que la page', async () => {
  assert.ok(HOLD_MS.network < HOLD_MS.denied);
  const browser = tab();
  await assert.rejects(gateOver(server(silent), { browser }).read('SELECT 1'));
  assert.deepEqual(browser.values, { [KEY]: 'network:1000' });
  const again = server();
  await assert.rejects(gateOver(again, { browser, now: () => 1000 + HOLD_MS.network - 1 }).read('SELECT 1'), SqlClosedError);
  assert.equal((await gateOver(again, { browser, now: () => 1000 + HOLD_MS.network }).read('SELECT 1')).length, 1);
  const timed = tab();
  const gate = gateOver(server(() => new TransferError('timeout', 'Le transfert est trop long.')), { browser: timed });
  await assert.rejects(gate.read('SELECT 1'));
  await assert.rejects(gate.read('SELECT 2'), SqlClosedError, 'la page ne réessaie pas');
  assert.deepEqual(timed.values, {}, 'mais l\'onglet ne retient pas un serveur lent');
});

test('sans stockage, sans identifiant de document ou avec une note illisible : la mémoire ne vaut que pour la page, rien ne lève', async () => {
  for (const options of [{ browser: tab({ refuse: true }) }, { docId: async () => null }, { docId: async () => { throw new Error('Grist tarde'); } },
    { browser: tab({ values: { [KEY]: 'denied:pas-une-date' } }) }, { browser: tab({ values: { [KEY]: 'dehors:1000' } }) }]) {
    const remote = server(refused);
    const gate = gateOver(remote, options);
    await assert.rejects(gate.read('SELECT 1'), error => error.status === 403);
    await assert.rejects(gate.read('SELECT 2'), SqlClosedError);
    assert.equal(remote.calls.length, 1);
  }
  const none = createSqlGate({ sql: server(refused).sql, docId: async () => DOC });
  await assert.rejects(none.read('SELECT 1'));
  await assert.rejects(none.read('SELECT 2'), SqlClosedError, 'sans magasin du tout');
});

test('des lectures lancées ensemble attendent la même note d\'avant ; une note venue d\'un autre document ne ferme rien', async () => {
  const browser = tab({ values: { [`${GATE_PREFIX}AUTREDOC`]: 'denied:1000' } });
  const remote = server();
  const gate = gateOver(remote, { browser });
  await Promise.all([gate.read('SELECT 1'), gate.read('SELECT 2'), gate.read('SELECT 3')]);
  assert.equal(remote.calls.length, 3);
  const closed = tab({ values: { [KEY]: 'denied:1000' } });
  const none = server();
  const together = gateOver(none, { browser: closed });
  const results = await Promise.allSettled([together.read('SELECT 1'), together.read('SELECT 2')]);
  assert.deepEqual(results.map(result => result.reason instanceof SqlClosedError), [true, true]);
  assert.equal(none.calls.length, 0);
});

test('les deux lectures légères partagent la mémoire : un compte de lignes refusé éteint la lecture des fichiers sans une requête de plus', async () => {
  const remote = server(refused);
  const gate = gateOver(remote);
  const doc = { fetchTable: async () => ({ id: [1, 2, 3] }) };
  assert.equal(await countRows('Publipostage_PreferencesModeles', { sql: statement => gate.read(statement), doc }), 3, 'la table entière, comme avant');
  assert.equal(await countRows('Publipostage_TemplatePreferences', { sql: statement => gate.read(statement), doc }), 3);
  const warned = [];
  const reader = createLightReader({ sql: statement => gate.read(statement), warn: error => warned.push(error) });
  assert.equal(await reader.prepare([{ table: 'Publipostage_Templates', wanted: ['Name'] }]), null, 'le plan ne part pas');
  assert.equal(reader.isActive(), false, 'la lecture légère est éteinte : l\'explorateur lit en entier');
  assert.equal(await reader.read('Publipostage_Templates', ['Name']), null);
  assert.equal(remote.calls.length, 1, 'une seule requête refusée pour tout ce passage (avant : deux comptes, la structure, puis les mêmes à chaque affichage)');
  assert.equal(warned.length, 1, 'un seul avertissement dans la console');
  assert.ok(warned[0] instanceof SqlClosedError);
});
