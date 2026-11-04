// La pile d'annulation (js/undo-stack.js) : un geste par appui, dans l'ordre inverse ; défaire ne se défait pas ; une annulation qui échoue le dit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { UndoStack } from '../js/undo-stack.js';

const t = (key, params = {}) => `${key}${params.reason ? `:${params.reason}` : ''}`;
const make = () => {
  const notices = [];
  return { stack: new UndoStack({ t, notice: text => notices.push(text) }), notices };
};

test('Ctrl+Z défait le dernier geste, puis l\'avant-dernier : un par appui, dans l\'ordre inverse', async () => {
  const { stack, notices } = make();
  const order = [];
  for (const name of ['a', 'b', 'c']) stack.push({ run: async () => { order.push(name); return `défait ${name}`; } });
  assert.equal(stack.size, 3);
  assert.deepEqual([await stack.undo(), await stack.undo(), await stack.undo()], [true, true, true]);
  assert.deepEqual(order, ['c', 'b', 'a']);
  assert.deepEqual(notices, ['défait c', 'défait b', 'défait a']);
});

test('sans geste à défaire, la phrase le dit et rien ne s\'écrit', async () => {
  const { stack, notices } = make();
  assert.equal(await stack.undo(), false);
  assert.deepEqual(notices, ['undo.nothing']);
});

test('ce que l\'annulation écrit elle-même n\'est pas déposé : défaire ne se défait pas (pas de va-et-vient)', async () => {
  const { stack } = make();
  stack.push({ run: async () => { stack.push({ run: async () => 'ne doit pas exister' }); return 'ok'; } });
  await stack.undo();
  assert.equal(stack.size, 0);
  stack.push({ run: async () => 'après' });
  assert.equal(stack.size, 1, 'une fois l\'annulation finie, la pile dépose de nouveau');
});

test('une annulation qui lève une erreur est dite, et le geste n\'est pas rejoué ; les suivants restent', async () => {
  const { stack, notices } = make();
  const warn = console.warn;
  console.warn = () => {};
  try {
    stack.push({ run: async () => 'premier' });
    stack.push({ run: async () => { throw new Error('Grist refuse'); } });
    await stack.undo();
  } finally { console.warn = warn; }
  assert.deepEqual(notices, ['undo.failed:Grist refuse']);
  assert.equal(stack.size, 1);
  await stack.undo();
  assert.equal(notices.at(-1), 'premier');
});

test('un refus voulu (`expected`) est dit sans bruit dans la console', async () => {
  const { stack, notices } = make();
  const calls = [];
  const warn = console.warn;
  console.warn = (...args) => calls.push(args);
  try {
    stack.push({ run: async () => { throw Object.assign(new Error('refusé'), { expected: true }); } });
    await stack.undo();
  } finally { console.warn = warn; }
  assert.deepEqual([calls.length, notices], [0, ['undo.failed:refusé']]);
});

test('un second Ctrl+Z pendant que le premier écrit est ignoré : le geste suivant n\'est pas défait en même temps', async () => {
  const { stack, notices } = make();
  let release;
  let fast = 0;
  stack.push({ run: async () => { fast += 1; } });
  stack.push({ run: () => new Promise(resolve => { release = () => resolve('fini'); }) });
  const first = stack.undo(); // le dernier déposé, qui attend Grist
  const second = await stack.undo();
  release();
  await first;
  assert.deepEqual([second, fast, stack.size, notices], [false, 0, 1, ['fini']]);
});

test('`again` : rien n\'a pu se faire mais cela pourra (l\'app doit être ouverte) : la phrase le dit et le geste reste à défaire', async () => {
  const { stack, notices } = make();
  let open = false;
  stack.push({ run: async () => (open ? 'revenu' : { said: 'ouvre l\'app', again: true }) });
  await stack.undo();
  assert.deepEqual([notices, stack.size], [['ouvre l\'app'], 1]);
  open = true;
  await stack.undo();
  assert.deepEqual([notices.at(-1), stack.size], ['revenu', 0]);
});

test('la pile garde les 50 derniers gestes : les plus anciens s\'oublient', async () => {
  const { stack } = make();
  const ran = [];
  for (let i = 0; i < 60; i += 1) stack.push({ run: async () => { ran.push(i); } });
  assert.equal(stack.size, 50);
  while (stack.size) await stack.undo();
  assert.equal(ran.at(-1), 10, 'le plus ancien gardé');
});

test('`clear` vide la pile', async () => {
  const { stack } = make();
  stack.push({ run: async () => 'x' });
  stack.clear();
  assert.equal(stack.size, 0);
});
