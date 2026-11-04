// La pile d'annulation (js/undo-stack.js) : un geste par appui, dans l'ordre inverse ; ce qu'une annulation écrit se refait (Ctrl+Y) et ce qu'un rétablissement écrit se défait ; un geste neuf vide le rétablissement ; une annulation qui échoue le dit.
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

test('ce que l\'annulation écrit dépose de quoi la refaire, dans la pile du rétablissement (pas dans celle des annulations : pas de va-et-vient)', async () => {
  const { stack } = make();
  stack.push({ run: async () => { stack.push({ run: async () => 'refait' }); return 'défait'; } });
  await stack.undo();
  assert.deepEqual([stack.size, stack.redoSize], [0, 1]);
  stack.push({ run: async () => 'après' });
  assert.deepEqual([stack.size, stack.redoSize], [1, 0], 'un geste neuf vide le rétablissement : ce qu\'on avait défait ne se refait plus');
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

test('`clear` vide les deux piles', async () => {
  const { stack } = make();
  stack.push({ run: async () => 'x' });
  stack.push({ run: async () => { stack.push({ run: async () => 'y' }); } });
  await stack.undo();
  assert.deepEqual([stack.size, stack.redoSize], [1, 1]);
  stack.clear();
  assert.deepEqual([stack.size, stack.redoSize], [0, 0]);
});

// Un geste qui se défait et se refait : ce que `run` dépose pendant qu'il joue est le contraire de ce qu'il fait.
const toggler = (log, state, name) => {
  const entry = (from, to) => ({ run: async () => { state.value = to; log.push(`${name}:${from}->${to}`); state.stack.push(entry(to, from)); return `${name} ${to}`; } });
  return entry;
};

test('Ctrl+Z puis Ctrl+Y : le geste revient puis repart, un par appui, et Ctrl+Y encore dit « Rien à rétablir »', async () => {
  const { stack, notices } = make();
  const state = { value: 'b', stack };
  const log = [];
  stack.push(toggler(log, state, 'x')('b', 'a')); // le geste a fait a -> b ; défaire remet a
  await stack.undo();
  assert.equal(state.value, 'a');
  await stack.redo();
  assert.equal(state.value, 'b');
  await stack.redo();
  assert.deepEqual([notices, stack.size, stack.redoSize], [['x a', 'x b', 'redo.nothing'], 1, 0]);
  await stack.undo();
  assert.equal(state.value, 'a', 'et défaire de nouveau remet a : les deux piles tournent sans fin, un cran par appui');
});

test('plusieurs gestes : Ctrl+Z trois fois puis Ctrl+Y trois fois, chacun dans son ordre', async () => {
  const { stack } = make();
  const log = [];
  const state = { stack };
  for (const name of ['1', '2', '3']) stack.push(toggler(log, state, name)('b', 'a'));
  for (let i = 0; i < 3; i += 1) await stack.undo();
  for (let i = 0; i < 3; i += 1) await stack.redo();
  assert.deepEqual(log.map(line => line.split(':')[0]), ['3', '2', '1', '1', '2', '3']);
});

test('un geste neuf entre Ctrl+Z et Ctrl+Y vide le rétablissement : Ctrl+Y dit « Rien à rétablir »', async () => {
  const { stack, notices } = make();
  const state = { stack };
  stack.push(toggler([], state, 'x')('b', 'a'));
  await stack.undo();
  stack.push({ run: async () => 'neuf' });
  await stack.redo();
  assert.equal(notices.at(-1), 'redo.nothing');
});

test('un rétablissement qui lève une erreur est dit (la phrase du rétablissement) et ne se rejoue pas ; un second Ctrl+Y pendant l\'écriture est ignoré', async () => {
  const { stack, notices } = make();
  const warn = console.warn;
  console.warn = () => {};
  try {
    stack.push({ run: async () => { stack.push({ run: async () => { throw new Error('Grist refuse'); } }); } });
    await stack.undo();
    await stack.redo();
  } finally { console.warn = warn; }
  assert.deepEqual([notices, stack.redoSize], [['redo.failed:Grist refuse'], 0]);
  let release;
  stack.push({ run: async () => { stack.push({ run: () => new Promise(resolve => { release = () => resolve('fini'); }) }); } });
  await stack.undo();
  const first = stack.redo();
  const second = await stack.redo();
  release();
  await first;
  assert.deepEqual([second, notices.at(-1)], [false, 'fini']);
});

test('`again` au rétablissement : le geste reste à refaire', async () => {
  const { stack, notices } = make();
  let open = false;
  stack.push({ run: async () => { stack.push({ run: async () => (open ? 'refait' : { said: 'ouvre l\'app', again: true }) }); } });
  await stack.undo();
  await stack.redo();
  assert.deepEqual([notices.at(-1), stack.redoSize], ['ouvre l\'app', 1]);
  open = true;
  await stack.redo();
  assert.deepEqual([notices.at(-1), stack.redoSize], ['refait', 0]);
});
