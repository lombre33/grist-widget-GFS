// Le routeur (contrats 1.2) : le vrai fichier, évalué dans un contexte avec une fenêtre minimale.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';

function load() {
  const listeners = [];
  const parent = { name: 'grist' };
  const window = { parent, addEventListener: (type, fn, capture) => listeners.push({ type, fn, capture }) };
  vm.runInNewContext(readFileSync(join(ROOT, 'js/router.js'), 'utf8'), { window });
  // Comme le navigateur : les écouteurs dans l'ordre, jusqu'à stopImmediatePropagation().
  const dispatch = (source, data) => {
    let stopped = false;
    const event = { source, data, origin: 'null', stopImmediatePropagation: () => { stopped = true; } };
    const seenBy = [];
    for (const l of listeners.filter(l => l.type === 'message')) {
      if (stopped) break;
      seenBy.push(l.capture);
      l.fn(event);
    }
    return { stopped, seenBy };
  };
  return { window, parent, listeners, dispatch, router: window.GFSRouter };
}

test('contrats 1.2 point 2 (a) : un message de Grist passe, intact', () => {
  const { dispatch, parent, router } = load();
  const got = [];
  router.setActive({ name: 'app' }, data => got.push(data));
  const r = dispatch(parent, { mtype: 4 });
  assert.equal(r.stopped, false);
  assert.deepEqual(got, []);
});

test('contrats 1.2 point 2 (b) : un message du sous-cadre actif est traité par le courtier et la propagation s\'arrête', () => {
  const { dispatch, router } = load();
  const app = { name: 'app' };
  const got = [];
  router.setActive(app, data => got.push(data));
  const r = dispatch(app, { mtype: 1, reqId: 3 });
  assert.equal(r.stopped, true);
  assert.deepEqual(got, [{ mtype: 1, reqId: 3 }]);
});

test('contrats 1.2 point 2 (c) : tout autre message est jeté, sans toucher le courtier', () => {
  const { dispatch, router } = load();
  const got = [];
  const stray = [];
  router.setActive({ name: 'app' }, data => got.push(data));
  router.setStrayListener(event => stray.push(event.source.name));
  assert.equal(dispatch({ name: 'voisin' }, { mtype: 2, reqId: 1, data: 'faux' }).stopped, true);
  assert.deepEqual(got, []);
  assert.deepEqual(stray, ['voisin']);
  router.clearActive();
  assert.equal(dispatch({ name: 'app' }, {}).stopped, true);
  assert.deepEqual(got, []);
});

test('le routeur est un écouteur de capture, posé dès le chargement du script', () => {
  const { listeners } = load();
  assert.equal(listeners.length, 1);
  assert.equal(listeners[0].capture, true);
});

test('isActive reconnaît le sous-cadre actif seulement', () => {
  const { router } = load();
  const app = {};
  assert.equal(router.isActive(app), false);
  router.setActive(app, () => {});
  assert.equal(router.isActive(app), true);
  assert.equal(router.isActive({}), false);
  assert.equal(router.isActive(null), false);
  router.clearActive();
  assert.equal(router.isActive(app), false);
});
