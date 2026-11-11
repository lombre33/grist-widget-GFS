// Le courtier devant les réglages d'une app (contrats 7.2 et 7.3) : il les écrit dans la vue quand GFS sait le faire (view-options.js), sinon en brouillon, comme avant ; et il dit
// à l'app ce qui s'est passé. Un faux `WidgetAPI` ne sert ici qu'à voir quels appels partent ; ce que Grist en fait se mesure dans le labo (run-reglages-directs.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCallHandler } from '../js/broker/broker.js';
import { ERR } from '../js/broker/filter.js';
import { policyOf, publipostage } from './helpers.mjs';

const DECLARED = new Set(['modeleDeLaVue', 'droitsAcces']);

function setup({ viewOptions, current = null, readonly = false } = {}) {
  const drafts = [];
  const saved = [];
  const widget = { getOptions: async () => current, setOption: async (key, value) => { drafts.push([key, value]); } };
  const env = { policy: policyOf(publipostage()), port: { doc: {}, view: {}, widget }, level: 'none', readonly, declared: DECLARED, onConfigure() {}, viewOptions, onSaved: value => saved.push(value) };
  const call = (meth, args) => makeCallHandler(env)({ iface: 'WidgetAPI', meth, args });
  return { drafts, saved, call };
}
const viewThat = answer => { const writes = []; return { writes, write: async changes => { writes.push(changes); return answer; } }; };

test('setOption : écrit dans la vue, pas de brouillon, et l\'app est prévenue', async () => {
  const view = viewThat(true);
  const { call, drafts, saved } = setup({ viewOptions: view });
  await call('setOption', ['modeleDeLaVue', '16']);
  assert.deepEqual(view.writes, [[['modeleDeLaVue', '16']]]);
  assert.deepEqual(drafts, []);
  assert.deepEqual(saved, [true]);
});

test('setOption : quand la vue n\'a pas pu s\'écrire, le brouillon part comme avant, et l\'app le sait', async () => {
  const { call, drafts, saved } = setup({ viewOptions: viewThat(false) });
  await call('setOption', ['modeleDeLaVue', '16']);
  assert.deepEqual(drafts, [['modeleDeLaVue', '16']]);
  assert.deepEqual(saved, [false]);
});

test('sans module d\'écriture dans la vue, le courtier reste ce qu\'il était : un brouillon', async () => {
  const { call, drafts, saved } = setup();
  await call('setOption', ['droitsAcces', { a: 1 }]);
  assert.deepEqual(drafts, [['droitsAcces', { a: 1 }]]);
  assert.deepEqual(saved, [false]);
});

test('setOptions : toutes les clés déclarées en une seule écriture (écrites, puis retirées) ; les autres sont ignorées', async t => {
  const warn = t.mock.method(console, 'warn', () => {});
  const view = viewThat(true);
  const { call, drafts } = setup({ viewOptions: view, current: { droitsAcces: 'x', 'gfs.y': 1 } });
  await call('setOptions', [{ modeleDeLaVue: '16', inconnue: 1 }]);
  assert.deepEqual(view.writes, [[['modeleDeLaVue', '16'], ['droitsAcces', undefined]]]);
  assert.deepEqual(drafts, []);
  assert.match(warn.mock.calls[0].arguments[0], /inconnue/);
});

test('setOptions en brouillon : clé par clé, comme avant', async () => {
  const { call, drafts } = setup({ viewOptions: viewThat(false), current: { droitsAcces: 'x' } });
  await call('setOptions', [{ modeleDeLaVue: '16' }]);
  assert.deepEqual(drafts, [['modeleDeLaVue', '16'], ['droitsAcces', undefined]]);
});

test('clearOptions retire les clés déclarées présentes, rien d\'autre ; sans clé à retirer, rien n\'est écrit ni dit', async () => {
  const view = viewThat(true);
  const first = setup({ viewOptions: view, current: { modeleDeLaVue: '16', 'gfs.y': 1, autre: 2 } });
  await first.call('clearOptions', []);
  assert.deepEqual(view.writes, [[['modeleDeLaVue', undefined]]]);
  const none = viewThat(true);
  const second = setup({ viewOptions: none, current: { 'gfs.y': 1 } });
  await second.call('clearOptions', []);
  assert.deepEqual(none.writes, []);
  assert.deepEqual(second.saved, []);
});

test('une clé non déclarée est refusée avant tout, et une vue en lecture seule n\'écrit rien', async () => {
  const view = viewThat(true);
  const { call, drafts } = setup({ viewOptions: view });
  await assert.rejects(() => call('setOption', ['autre', 1]), error => error.code === ERR.CLE);
  const readonly = setup({ viewOptions: view, readonly: true });
  await assert.rejects(() => readonly.call('setOption', ['modeleDeLaVue', '16']), error => error.code === ERR.LECTURE_SEULE);
  assert.deepEqual(view.writes, []);
  assert.deepEqual(drafts, []);
});
