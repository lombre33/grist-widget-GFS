// Un choix retenu sur le navigateur de GFS (la langue, le bord de la barre) : la logique commune, essayée avec un choix qui n'est pas la langue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StoredChoice, keyStore, watchKey } from '../js/stored-choice.js';

const EDGES = ['gauche', 'haut', 'droite', 'bas'];
function fakeStore(initial = null, { accepts = true } = {}) {
  const store = {
    value: initial, writes: [],
    read: () => store.value,
    write(value) { store.writes.push(value); if (!accepts) return false; store.value = value; return true; },
  };
  return store;
}
const edges = store => new StoredChoice({ choices: EDGES, fallback: 'gauche', store });

test('rien de retenu : la valeur par défaut ; une valeur retenue l\'emporte ; une valeur étrangère est tenue pour absente', () => {
  assert.equal(edges(fakeStore()).value, 'gauche');
  assert.equal(edges(fakeStore('bas')).value, 'bas');
  for (const odd of ['', 'milieu', 'Bas', '{"bord":"bas"}', '<b>bas</b>', 'undefined']) assert.equal(edges(fakeStore(odd)).value, 'gauche', odd);
  assert.equal(edges({ read() { throw new Error('SecurityError'); }, write: () => false }).value, 'gauche', 'un navigateur qui refuse de lire : la valeur par défaut, sans erreur');
});

test('choose : écrit ce que `keep` donne, prévient avec la valeur et la valeur d\'avant, une seule fois', () => {
  const store = fakeStore();
  const choice = edges(store);
  const heard = [];
  choice.onChange((value, before) => heard.push([value, before]));
  assert.equal(choice.choose('droite'), true);
  assert.deepEqual(store.writes, ['droite']);
  assert.equal(choice.value, 'droite');
  assert.deepEqual(heard, [['droite', 'gauche']]);
  choice.choose('droite');
  assert.equal(heard.length, 1, 'le même choix une seconde fois : rien de nouveau à dire');
  const language = new StoredChoice({ choices: ['auto', 'fr', 'en'], fallback: 'auto', store: fakeStore(), keep: value => (value === 'auto' ? null : value) });
  language.choose('en');
  language.choose('auto');
  assert.equal(language.value, 'auto');
});

test('choose ignore une valeur qui n\'est pas dans la liste, sans rien écrire', () => {
  const store = fakeStore();
  const choice = edges(store);
  const heard = [];
  choice.onChange(value => heard.push(value));
  for (const odd of ['milieu', '', null, undefined, {}, ['bas'], '<script>']) assert.equal(choice.choose(odd), true);
  assert.deepEqual(store.writes, []);
  assert.deepEqual(heard, []);
  assert.equal(choice.value, 'gauche');
});

test('un navigateur qui refuse d\'écrire : choose le dit (false), le choix vaut pour la page', () => {
  const choice = edges(fakeStore(null, { accepts: false }));
  assert.equal(choice.choose('haut'), false);
  assert.equal(choice.value, 'haut');
});

test('reload : un autre onglet a changé la clé, on suit une seule fois ; une clé inchangée ne dit rien ; on peut se désabonner', () => {
  const store = fakeStore();
  const choice = edges(store);
  const heard = [];
  const stop = choice.onChange((value, before) => heard.push([value, before]));
  choice.reload();
  assert.deepEqual(heard, []);
  store.value = 'bas';
  choice.reload();
  choice.reload();
  assert.deepEqual(heard, [['bas', 'gauche']]);
  stop();
  store.value = 'haut';
  choice.reload();
  assert.equal(heard.length, 1);
  assert.equal(choice.value, 'haut');
});

test('keyStore : une clé à soi ; lit, écrit, retire ; un localStorage qui lève ne fait rien de pire que de ne pas retenir', () => {
  const data = new Map([['gfs.langue', 'en']]);
  const ok = { localStorage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) } };
  const store = keyStore(ok, 'gfs.barre');
  assert.equal(store.read(), null, 'la clé d\'un autre choix n\'est pas la sienne');
  assert.equal(store.write('bas'), true);
  assert.equal(data.get('gfs.barre'), 'bas');
  assert.equal(data.get('gfs.langue'), 'en');
  assert.equal(store.read(), 'bas');
  assert.equal(store.write(null), true);
  assert.equal(data.has('gfs.barre'), false);
  const blocked = keyStore({ get localStorage() { throw new Error('SecurityError'); } }, 'gfs.barre');
  assert.equal(blocked.read(), null);
  assert.equal(blocked.write('bas'), false);
  const full = keyStore({ localStorage: { getItem: () => null, setItem() { throw new Error('QuotaExceededError'); }, removeItem() { throw new Error('x'); } } }, 'gfs.barre');
  assert.equal(full.write('bas'), false);
  assert.equal(full.write(null), false);
});

test('watchKey : suit la clé donnée (ou un effacement général), rien d\'autre ; se retire', () => {
  const listeners = new Map();
  const win = {
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type, fn) => { if (listeners.get(type) === fn) listeners.delete(type); },
  };
  const calls = [];
  const stop = watchKey({ reload: () => calls.push('reload') }, 'gfs.barre', win);
  const fire = event => listeners.get('storage')(event);
  fire({ key: 'gfs.langue' });
  fire({ key: 'gfs.barre.autre' });
  assert.deepEqual(calls, []);
  fire({ key: 'gfs.barre' });
  fire({ key: null });
  assert.deepEqual(calls, ['reload', 'reload']);
  stop();
  assert.equal(listeners.has('storage'), false);
});
