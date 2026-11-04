// Une app qui ne répond pas (js/session.js, contrats 1.4, point 2) : GFS attend 15 secondes son site en ligne, ouvre sa copie figée, attend 15 secondes de plus, puis renonce.
// Le porteur a vu (04/11) « Form+ ne répond pas. » et rouvrir l'app ne la relançait pas : une session qui a renoncé le dit (`gaveUp`), et le contrôleur ne la réutilise plus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppSession } from '../js/session.js';
import { CATALOGUE } from '../js/catalogue.js';
import { form, catalogue } from './helpers.mjs';

const DELAY = 15000;
const MSG_READY = { mtype: 5 };
// Les deux délais de suite (le site en ligne, puis la copie figée) : le second ne démarre que quand le premier est écoulé, d'où deux pas.
const waitBoth = t => { t.mock.timers.tick(DELAY); t.mock.timers.tick(DELAY); };

// Un cadre et une page réduits à ce que la session en demande ; les cadres créés sont gardés pour lire leur adresse.
function fakeFrame() {
  const classes = new Set();
  return {
    className: '', title: '', src: '', removed: false, contentWindow: { postMessage() {} },
    setAttribute() {},
    classList: { add: name => classes.add(name), remove: name => classes.delete(name), toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)), contains: name => classes.has(name) },
    remove() { this.removed = true; },
  };
}

function setup(t, { live = true } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const warnings = [];
  t.mock.method(console, 'warn', (...args) => { warnings.push(args.join(' ')); });
  const frames = [];
  globalThis.document = { createElement: () => { const frame = fakeFrame(); frames.push(frame); return frame; } };
  t.after(() => { delete globalThis.document; });
  const events = [];
  const route = { handler: null, setActive(win, handler) { this.handler = handler; }, clearActive() {} };
  const session = new AppSession({
    entry: CATALOGUE.find(item => item.id === 'form'), manifest: form(), catalogue: catalogue(),
    state: { grantedAccess: 'full', subscribe: () => () => {} }, port: {}, router: route, container: { append() {} },
    readonly: false, preferences: {}, base: 'https://exemple.github.io/grist-widget-GFS/prototype/index.html', live, lang: 'fr',
    onStatus: kind => events.push(kind), envelopeHandlers: () => ({}),
  });
  session.open();
  return { session, frames, events, route, warnings };
}

test('une app muette : au premier délai GFS ouvre la copie figée, au second il renonce, et la session le dit', t => {
  const { session, frames, events } = setup(t);
  assert.deepEqual(events, ['loading']);
  assert.equal(session.gaveUp, false);
  assert.match(frames[0].src, /\/FormPlus\/poc\/widget\.html/);
  t.mock.timers.tick(DELAY);
  assert.deepEqual(events, ['loading', 'fallback']);
  assert.equal(session.source, 'pinned');
  assert.match(frames[0].src, /\/apps\/form\/poc\/widget\.html/, 'le même cadre ouvre la copie figée');
  assert.equal(session.gaveUp, false, 'la copie a encore son délai');
  t.mock.timers.tick(DELAY);
  assert.deepEqual(events, ['loading', 'fallback', 'timeout']);
  assert.equal(session.gaveUp, true);
});

test('une app sans copie à ouvrir (live=0) renonce dès le premier délai', t => {
  const { session, events } = setup(t, { live: false });
  t.mock.timers.tick(DELAY);
  assert.deepEqual(events, ['loading', 'timeout']);
  assert.equal(session.gaveUp, true);
});

test('une app qui finit par répondre après avoir renoncé n\'a plus renoncé', t => {
  const { session, events, route } = setup(t);
  waitBoth(t);
  assert.equal(session.gaveUp, true);
  route.handler(MSG_READY); // le `ready` de son script d'API, arrivé tard
  assert.equal(session.isReady, true);
  assert.equal(session.gaveUp, false);
  assert.equal(events.at(-1), 'ready');
});

test('une app prête dans le délai ne renonce jamais', t => {
  const { session, events, route } = setup(t);
  t.mock.timers.tick(5000);
  route.handler(MSG_READY);
  waitBoth(t);
  assert.deepEqual(events, ['loading', 'ready']);
  assert.equal(session.gaveUp, false);
});

test('une session fermée ne renonce pas après coup, et le cadre est retiré', t => {
  const { session, frames, events } = setup(t);
  session.close();
  waitBoth(t);
  assert.deepEqual(events, ['loading']);
  assert.equal(frames[0].removed, true);
});

test('GFS dit dans la console où il a attendu, sans l\'adresse de recherche : la cause est dans la console du cadre de l\'app', t => {
  const { warnings } = setup(t);
  waitBoth(t);
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /^GFS : form : pas de « prête » en 15 s sur le site en ligne \(https:\/\/exemple\.github\.io\/FormPlus\/poc\/widget\.html\)$/);
  assert.match(warnings[1], /^GFS : form : pas de « prête » en 15 s sur la copie figée \(https:\/\/exemple\.github\.io\/grist-widget-GFS\/prototype\/apps\/form\/poc\/widget\.html\)$/);
});
