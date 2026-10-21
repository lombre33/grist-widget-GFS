// Le stockage des choix de chaque app (contrats 5.3) : un espace par app dans le navigateur de GFS, des clés et des valeurs réglées, un quota, un navigateur qui refuse.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppStorage, browserBackend, storageHandlers, QUOTA, PREFIX, KEY_PATTERN } from '../js/app-storage.js';
import { EnvelopePeer } from '../js/envelope.js';

// Un navigateur de pied, au plus près de `localStorage` : des chaînes, rangées dans l'ordre d'écriture. `refuse` dit ce qu'il ne veut plus faire.
function fakeBackend(refuse = {}) {
  const data = new Map();
  return {
    data, refuse,
    list: prefix => (refuse.read ? [] : [...data].filter(([key]) => key.startsWith(prefix))),
    write(key, value) { if (refuse.write) return false; data.set(key, value); return true; },
    remove(key) { if (refuse.remove) return false; data.delete(key); return true; },
  };
}
const make = (quota, refuse) => {
  const backend = fakeBackend(refuse);
  return { backend, storage: new AppStorage({ backend, quota }) };
};
const settle = () => new Promise(resolve => setTimeout(resolve, 5));
const thrown = (fn, code) => assert.throws(fn, error => error.code === code, `doit lever ${code}`);

test('un espace vide ; ce qu\'une app écrit, elle le relit, rangé sous gfs.stockage.<id>.<clé> dans le navigateur', () => {
  const { backend, storage } = make();
  assert.deepEqual(storage.read('publipostage'), {});
  assert.deepEqual(storage.write('publipostage', 'pp_theme', 'dark'), { retenu: true });
  storage.write('publipostage', 'pp_page_zoom', '{"m1":120}');
  assert.deepEqual(storage.read('publipostage'), { pp_theme: 'dark', pp_page_zoom: '{"m1":120}' });
  assert.deepEqual([...backend.data], [['gfs.stockage.publipostage.pp_theme', 'dark'], ['gfs.stockage.publipostage.pp_page_zoom', '{"m1":120}']]);
  assert.equal(PREFIX, 'gfs.stockage.');
});

test('chaque app a son espace : rien ne passe de l\'une à l\'autre, pas même entre « form » et « form-plus »', () => {
  const { storage } = make();
  storage.write('form', 'theme', 'a');
  storage.write('form-plus', 'theme', 'b');
  storage.write('form-plus', 'seulement-ici', '1');
  assert.deepEqual(storage.read('form'), { theme: 'a' });
  assert.deepEqual(storage.read('form-plus'), { theme: 'b', 'seulement-ici': '1' });
  assert.deepEqual(storage.read('automation'), {});
  storage.write('form', 'theme', null);
  assert.deepEqual(storage.read('form-plus').theme, 'b', 'vider une clé de « form » ne touche pas « form-plus »');
});

test('une clé garde ses points : seul le premier sépare l\'identifiant de la clé', () => {
  const { backend, storage } = make();
  storage.write('form', 'a.b.c', 'x');
  storage.write('form', 'a', 'y');
  assert.deepEqual(storage.read('form'), { 'a.b.c': 'x', a: 'y' });
  assert.deepEqual([...backend.data.keys()], ['gfs.stockage.form.a.b.c', 'gfs.stockage.form.a']);
});

test('remplacer une valeur ; la retirer par null (une clé absente se retire sans bruit)', () => {
  const { backend, storage } = make();
  storage.write('form', 'k', '1');
  storage.write('form', 'k', '2');
  assert.deepEqual(storage.read('form'), { k: '2' });
  assert.deepEqual(storage.write('form', 'k', null), { retenu: true });
  assert.deepEqual(storage.read('form'), {});
  assert.equal(backend.data.size, 0);
  assert.deepEqual(storage.write('form', 'jamais-ecrite', null), { retenu: true });
});

test('une clé hors règle est refusée (GFS_REFUSE) sans rien écrire', () => {
  const { backend, storage } = make();
  for (const key of ['', 'x'.repeat(65), 'a b', 'é', 'a/b', 'a=b', 'a\n', '<b>', undefined, null, 7, {}, ['a']]) {
    thrown(() => storage.write('form', key, 'v'), 'GFS_REFUSE');
  }
  assert.equal(backend.data.size, 0);
  assert.equal(KEY_PATTERN.test('A-Za-z0-9_.:-'), true);
});

test('une valeur qui n\'est pas une chaîne est refusée ; absente (undefined), elle ne retire rien', () => {
  const { backend, storage } = make();
  storage.write('form', 'k', 'gardée');
  for (const value of [undefined, 1, true, {}, ['a'], () => 'x']) thrown(() => storage.write('form', 'k', value), 'GFS_REFUSE');
  assert.deepEqual(storage.read('form'), { k: 'gardée' });
  assert.equal(backend.data.size, 1);
});

test('les bornes : une clé de 64 caractères, la chaîne vide, des clés qui ressemblent à celles d\'un objet', () => {
  const { storage } = make();
  const long = 'k'.repeat(64);
  storage.write('form', long, '');
  storage.write('form', '__proto__', 'p');
  storage.write('form', 'constructor', 'c');
  storage.write('form', 'toString', 't');
  const space = storage.read('form');
  assert.equal(space[long], '', 'une valeur vide est une valeur');
  assert.deepEqual(Object.keys(space).sort(), [long, '__proto__', 'constructor', 'toString'].sort());
  assert.equal(Object.getPrototypeOf(space), Object.prototype, '« __proto__ » est une clé, pas le prototype');
  assert.equal(Object.hasOwn(space, '__proto__'), true);
  assert.equal(space.__proto__, 'p');
});

test('un identifiant qui n\'est pas celui d\'une app n\'a pas d\'espace et ne peut pas écrire', () => {
  const { backend, storage } = make();
  for (const id of ['', 'A', 'a', 'form.plus', 'form plus', '1form', undefined, null, 'x'.repeat(25)]) {
    thrown(() => storage.write(id, 'k', 'v'), 'GFS_REFUSE');
    assert.deepEqual(storage.read(id), {});
  }
  assert.equal(backend.data.size, 0);
});

test('le quota compte les clés et les valeurs, par app ; un dépassement est refusé (GFS_QUOTA) sans rien changer', () => {
  const { storage } = make(20);
  storage.write('form', 'a', 'x'.repeat(10)); // 11
  storage.write('form', 'b', 'y'.repeat(8)); // + 9 = 20 : pile le quota
  thrown(() => storage.write('form', 'c', 'z'), 'GFS_QUOTA'); // 22
  thrown(() => storage.write('form', 'a', 'x'.repeat(12)), 'GFS_QUOTA'); // un remplacement plus gros
  assert.deepEqual(storage.read('form'), { a: 'x'.repeat(10), b: 'y'.repeat(8) });
  assert.deepEqual(storage.write('form', 'a', 'x'.repeat(5)), { retenu: true }); // plus petit : passe, et libère de la place
  storage.write('form', 'c', 'z');
  assert.equal(Object.keys(storage.read('form')).length, 3);
  storage.write('form', 'c', null);
  storage.write('form', 'a', null);
  storage.write('form', 'd', 'w'.repeat(10));
  assert.deepEqual(storage.write('automation', 'a', 'x'.repeat(19)), { retenu: true }, 'le quota est celui de chaque app');
});

test('le quota par défaut est de 1 Mo (1 048 576 caractères) : pile le quota passe, un caractère de plus non', () => {
  const { storage } = make();
  assert.equal(QUOTA, 1048576);
  storage.write('form', 'k', 'x'.repeat(QUOTA - 1));
  thrown(() => storage.write('form', 'k2', ''), 'GFS_QUOTA'); // 1 + 0 de plus
  thrown(() => storage.write('form', 'k', 'x'.repeat(QUOTA)), 'GFS_QUOTA');
  assert.equal(storage.read('form').k.length, QUOTA - 1);
});

test('une app au-dessus de son quota (il a baissé, ou un autre code a écrit) peut se vider, mais pas grossir', () => {
  const { backend, storage } = make(10);
  backend.data.set('gfs.stockage.form.gros', 'x'.repeat(30));
  thrown(() => storage.write('form', 'z', 'y'), 'GFS_QUOTA');
  thrown(() => storage.write('form', 'gros', 'x'.repeat(40)), 'GFS_QUOTA');
  assert.deepEqual(storage.write('form', 'gros', 'x'.repeat(30)), { retenu: true }, 'même taille : passe');
  assert.deepEqual(storage.write('form', 'gros', 'x'), { retenu: true });
  assert.deepEqual(storage.write('form', 'z', 'y'), { retenu: true }, 'redevenue sous le quota, l\'app écrit de nouveau');
});

test('le navigateur refuse d\'écrire : la valeur vaut pour la page (retenu: false), et le navigateur qui accepte de nouveau reprend la main', () => {
  const { backend, storage } = make(undefined, { write: true });
  assert.deepEqual(storage.write('form', 'theme', 'dark'), { retenu: false });
  assert.deepEqual(storage.read('form'), { theme: 'dark' }, 'l\'app relit ce qu\'elle vient d\'écrire');
  assert.equal(backend.data.size, 0);
  assert.deepEqual(storage.read('automation'), {}, 'ni l\'une ni l\'autre ne déborde sur une autre app');
  backend.data.set('gfs.stockage.form.theme', 'light'); // une valeur plus ancienne, gardée avant le refus
  assert.deepEqual(storage.read('form'), { theme: 'dark' }, 'ce que le navigateur a refusé couvre ce qu\'il avait');
  backend.refuse.write = false;
  assert.deepEqual(storage.write('form', 'theme', 'blue'), { retenu: true });
  assert.deepEqual(storage.read('form'), { theme: 'blue' });
  assert.equal(backend.data.get('gfs.stockage.form.theme'), 'blue');
});

test('le navigateur refuse de retirer : la clé reste retirée pour la page ; le quota vaut aussi sans navigateur', () => {
  const { backend, storage } = make(30, { remove: true });
  storage.write('form', 'k', 'v');
  assert.deepEqual(storage.write('form', 'k', null), { retenu: false });
  assert.deepEqual(storage.read('form'), {}, 'la page ne la revoit pas');
  backend.refuse.remove = false;
  assert.deepEqual(storage.write('form', 'k', null), { retenu: true });
  assert.equal(backend.data.size, 0);
  const closed = make(10, { read: true, write: true });
  closed.storage.write('form', 'a', 'x'.repeat(8));
  thrown(() => closed.storage.write('form', 'b', 'xx'), 'GFS_QUOTA');
});

test('le navigateur refuse de lire : l\'espace paraît vide, sans erreur, et ce qu\'on écrit ensuite vaut pour la page', () => {
  const { storage } = make(undefined, { read: true, write: true });
  assert.deepEqual(storage.read('form'), {});
  assert.deepEqual(storage.write('form', 'k', 'v'), { retenu: false });
  assert.deepEqual(storage.read('form'), { k: 'v' });
});

test('un autre onglet a écrit : la relecture le voit ; écrire une clé ne touche pas celles des autres', () => {
  const { backend, storage } = make();
  storage.write('form', 'a', '1');
  backend.data.set('gfs.stockage.form.b', '2'); // l'autre onglet
  assert.deepEqual(storage.read('form'), { a: '1', b: '2' });
  storage.write('form', 'a', '3');
  assert.deepEqual(storage.read('form'), { a: '3', b: '2' }, 'la clé de l\'autre onglet est intacte');
});

test('browserBackend : ne liste que le préfixe demandé ; écrit et retire ; un localStorage qui lève ne casse rien', () => {
  const data = new Map([['gfs.langue', 'en'], ['gfs.premier-lancement.abc', '1'], ['gfs.stockage.form.k', 'v'], ['gfs.stockage.form-plus.k', 'w'], ['gfs.stockage.automation.k', 'x']]);
  const keys = () => [...data.keys()];
  const area = {
    get length() { return data.size; }, key: index => keys()[index] ?? null,
    getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key),
  };
  const backend = browserBackend({ localStorage: area });
  assert.deepEqual(backend.list('gfs.stockage.form.'), [['gfs.stockage.form.k', 'v']]);
  assert.deepEqual(backend.list('gfs.stockage.form-plus.'), [['gfs.stockage.form-plus.k', 'w']]);
  assert.equal(backend.write('gfs.stockage.form.z', 'ok'), true);
  assert.equal(data.get('gfs.stockage.form.z'), 'ok');
  assert.equal(backend.remove('gfs.stockage.form.z'), true);
  assert.equal(data.has('gfs.stockage.form.z'), false);
  assert.equal(data.get('gfs.langue'), 'en', 'les autres clés de GFS ne sont pas touchées');
  // Une clé qui disparaît entre le décompte et la lecture (un autre onglet) : ignorée.
  const racing = { ...area, getItem: key => (key === 'gfs.stockage.form.k' ? null : data.get(key) ?? null) };
  assert.deepEqual(browserBackend({ localStorage: racing }).list('gfs.stockage.form.'), []);
  // Un navigateur qui refuse.
  const blocked = browserBackend({ get localStorage() { throw new Error('SecurityError'); } });
  assert.deepEqual(blocked.list('gfs.'), []);
  assert.equal(blocked.write('gfs.stockage.form.k', 'v'), false);
  assert.equal(blocked.remove('gfs.stockage.form.k'), false);
  const full = browserBackend({ localStorage: { ...area, setItem() { throw new Error('QuotaExceededError'); }, removeItem() { throw new Error('x'); } } });
  assert.equal(full.write('gfs.stockage.form.k', 'v'), false);
  assert.equal(full.remove('gfs.stockage.form.k'), false);
});

test('stockage.ecrire par l\'enveloppe : sans id aucune réponse ; avec un id, { retenu } ; l\'espace est celui de la session', async () => {
  const { storage } = make();
  const sent = [];
  const warnings = [];
  const peer = new EnvelopePeer({ send: msg => sent.push(msg), handlers: storageHandlers(storage, 'form', text => warnings.push(text)) });
  peer.receive({ gfs: 0, type: 'appel', nom: 'stockage.ecrire', args: { cle: 'theme', valeur: 'dark' } });
  await settle();
  assert.deepEqual(sent, [], 'un appel sans id n\'attend rien');
  assert.deepEqual(storage.read('form'), { theme: 'dark' });
  peer.receive({ gfs: 0, type: 'appel', id: 4, nom: 'stockage.ecrire', args: { cle: 'zoom', valeur: '120' } });
  await settle();
  assert.deepEqual(sent, [{ gfs: 0, type: 'reponse', id: 4, data: { retenu: true } }]);
  sent.length = 0;
  peer.receive({ gfs: 0, type: 'appel', id: 5, nom: 'stockage.ecrire', args: { cle: 'theme', valeur: null } });
  await settle();
  assert.deepEqual(sent, [{ gfs: 0, type: 'reponse', id: 5, data: { retenu: true } }]);
  assert.deepEqual(storage.read('form'), { zoom: '120' });
  // Ce que le message dirait de l'app, de l'espace ou de l'identifiant ne compte pas : GFS range sous la session.
  peer.receive({ gfs: 0, type: 'appel', nom: 'stockage.ecrire', args: { cle: 'intrus', valeur: 'x', app: 'automation', id: 'automation', espace: 'automation' } });
  await settle();
  assert.deepEqual(storage.read('automation'), {});
  assert.equal(storage.read('form').intrus, 'x');
  assert.deepEqual(warnings, []);
});

test('stockage.ecrire refusé : l\'erreur revient à l\'app qui a donné un id ; sans id elle est silencieuse pour l\'app, mais dite en console', async () => {
  const { storage } = make(10);
  const sent = [];
  const warnings = [];
  const peer = new EnvelopePeer({ send: msg => sent.push(msg), handlers: storageHandlers(storage, 'form', text => warnings.push(text)) });
  peer.receive({ gfs: 0, type: 'appel', id: 1, nom: 'stockage.ecrire', args: { cle: 'pas valable', valeur: 'v' } });
  peer.receive({ gfs: 0, type: 'appel', id: 2, nom: 'stockage.ecrire', args: { cle: 'k', valeur: 12 } });
  peer.receive({ gfs: 0, type: 'appel', id: 3, nom: 'stockage.ecrire', args: { cle: 'k', valeur: 'x'.repeat(20) } });
  peer.receive({ gfs: 0, type: 'appel', id: 4, nom: 'stockage.ecrire', args: { cle: 'k' } });
  peer.receive({ gfs: 0, type: 'appel', nom: 'stockage.ecrire', args: {} });
  peer.receive({ gfs: 0, type: 'appel', id: 6, nom: 'stockage.ecrire' });
  await settle();
  assert.deepEqual(sent.map(m => [m.id, m.type, m.code]).sort((a, b) => a[0] - b[0]), [[1, 'erreur', 'GFS_REFUSE'], [2, 'erreur', 'GFS_REFUSE'], [3, 'erreur', 'GFS_QUOTA'], [4, 'erreur', 'GFS_REFUSE'], [6, 'erreur', 'GFS_REFUSE']]);
  assert.equal(warnings.length, 6, 'chaque refus est dit en console, avec l\'app et le code');
  assert.match(warnings[0], /^GFS : form : stockage\.ecrire refusé \(GFS_[A-Z]+\)/);
  assert.deepEqual(storage.read('form'), {});
});
