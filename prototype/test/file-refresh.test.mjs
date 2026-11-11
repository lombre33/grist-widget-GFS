// La garde de séquence de la lecture des fichiers (js/explorer/file-refresh.js ; audit du code du 09/11, défaut 9) : deux lectures qui se chevauchent, la plus ancienne finissant en dernier, ne remplacent pas la liste récente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFileRefresh } from '../js/explorer/file-refresh.js';

// Un banc : chaque lecture lancée attend qu'on la termine à la main (`finish(n, résultat)` ou `fail(n, erreur)`), et le banc note ce que la lecture a fait de l'état.
function bench({ access = true } = {}) {
  const log = [];
  const pending = [];
  const state = { access };
  const refresh = createFileRefresh({
    canRead: () => state.access,
    load: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
    onRestricted: () => log.push('restricted'),
    onLoading: () => log.push('loading'),
    onLoaded: result => log.push(`loaded:${result}`),
    onFailed: error => log.push(`failed:${error.message}`),
  });
  const settle = () => new Promise(resolve => setImmediate(resolve));
  return { log, state, refresh, finish: async (at, result) => { pending[at].resolve(result); await settle(); }, fail: async (at, message) => { pending[at].reject(new Error(message)); await settle(); } };
}

test('une lecture seule : elle dit qu\'elle commence, puis son résultat', async () => {
  const b = bench();
  const done = b.refresh();
  await b.finish(0, 'A');
  await done;
  assert.deepEqual(b.log, ['loading', 'loaded:A']);
});

test('deux lectures qui se chevauchent, la plus ancienne finissant en dernier : la liste récente reste', async () => {
  const b = bench();
  const first = b.refresh();
  const second = b.refresh();
  await b.finish(1, 'récente');
  await b.finish(0, 'ancienne');
  await Promise.all([first, second]);
  assert.deepEqual(b.log, ['loading', 'loading', 'loaded:récente']);
});

test('la plus ancienne qui finit la première ne pose rien : la plus récente fait foi quand elle finit', async () => {
  const b = bench();
  const first = b.refresh();
  const second = b.refresh();
  await b.finish(0, 'ancienne');
  assert.deepEqual(b.log, ['loading', 'loading'], 'la lecture dépassée ne pose rien');
  await b.finish(1, 'récente');
  await Promise.all([first, second]);
  assert.deepEqual(b.log, ['loading', 'loading', 'loaded:récente']);
});

test('l\'échec d\'une lecture dépassée n\'efface pas le résultat de la récente', async () => {
  const b = bench();
  const first = b.refresh();
  const second = b.refresh();
  await b.finish(1, 'récente');
  await b.fail(0, 'réseau');
  await Promise.all([first, second]);
  assert.deepEqual(b.log, ['loading', 'loading', 'loaded:récente']);
});

test('l\'échec de la lecture la plus récente se dit', async () => {
  const b = bench();
  const first = b.refresh();
  await b.fail(0, 'réseau');
  await first;
  assert.deepEqual(b.log, ['loading', 'failed:réseau']);
});

test('deux lectures l\'une après l\'autre posent chacune leur résultat', async () => {
  const b = bench();
  const first = b.refresh();
  await b.finish(0, 'A');
  await first;
  const second = b.refresh();
  await b.finish(1, 'B');
  await second;
  assert.deepEqual(b.log, ['loading', 'loaded:A', 'loading', 'loaded:B']);
});

test('l\'accès complet perdu pendant une lecture : la liste reste vide, la lecture en cours ne la remplit pas', async () => {
  const b = bench();
  const first = b.refresh();
  b.state.access = false;
  await b.refresh();
  await b.finish(0, 'tardive');
  await first;
  assert.deepEqual(b.log, ['loading', 'restricted']);
});

test('sans l\'accès complet, rien n\'est lu', async () => {
  const b = bench({ access: false });
  await b.refresh();
  assert.deepEqual(b.log, ['restricted']);
});
