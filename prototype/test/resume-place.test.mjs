// La décision de la reprise après un rechargement (js/broker/resume-place.js ; demande du porteur, 26/11) : ce que le souvenir de l'onglet fait rouvrir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slotKey, parseMemory, serializeMemory, needsList, decide, MEMORY_PREFIX } from '../js/broker/resume-place.js';

const WHO = 'essai@example.com';
const file = (key, extra = {}) => ({ key, app: key.split(':')[0], id: key.split(':')[1], name: `Fichier ${key}`, folder: '', ...extra });
const FILES = [file('publipostage:16', { name: 'Contrat de prestation' }), file('publipostage:17', { name: 'Quittance de loyer', folder: 'Formation/Archives 2025' })];
const ctx = (extra = {}) => ({ who: WHO, files: FILES, folders: [], locale: 'fr', lockOf: () => null, ...extra });
const inFile = (key, extra = {}) => ({ v: 1, who: WHO, lieu: 'fichier', key, name: 'Contrat de prestation', ...extra });
const inExplorer = (view, path = '', extra = {}) => ({ v: 1, who: WHO, lieu: 'explorateur', view, path, ...extra });

test('slotKey : un souvenir par document et par table, jamais sans l\'un des deux, ni avec un nom étrange', () => {
  assert.equal(slotKey('9dz6hfbYUzgL9gtwTUjbhB', 'Clients'), `${MEMORY_PREFIX}9dz6hfbYUzgL9gtwTUjbhB.Clients`);
  assert.notEqual(slotKey('doc1', 'Clients'), slotKey('doc1', 'Factures'), 'deux tables : deux souvenirs');
  assert.equal(slotKey(null, 'Clients'), null);
  assert.equal(slotKey('doc1', undefined), null);
  assert.equal(slotKey('doc1', 'Clients.x/../y'), null);
  assert.equal(slotKey('doc 1', 'Clients'), null);
});

test('parseMemory : ce que GFS a écrit se relit, tout autre texte est tenu pour absent', () => {
  for (const record of [inFile('publipostage:16'), inExplorer('folder', 'Formation'), inExplorer('trash'), { v: 1, who: '', lieu: 'app' }]) {
    assert.deepEqual(parseMemory(serializeMemory(record)), record);
  }
  for (const raw of [null, undefined, '', 'pas du JSON', '42', '[]', '{}', JSON.stringify({ ...inFile('a:1'), v: 2 }), JSON.stringify({ ...inFile('a:1'), lieu: 'ailleurs' }),
    JSON.stringify({ ...inFile('a:1'), key: '' }), JSON.stringify({ ...inFile('a:1'), key: 7 }), JSON.stringify({ ...inFile('a:1'), who: null }),
    JSON.stringify(inExplorer('opened')), JSON.stringify(inExplorer('folder', 7)), JSON.stringify(inFile('a:1', { name: 'x'.repeat(301) }))]) {
    assert.equal(parseMemory(raw), null, String(raw).slice(0, 60));
  }
});

test('needsList : un fichier et un dossier se vérifient dans la liste, la racine et les autres vues n\'attendent rien', () => {
  assert.equal(needsList(inFile('publipostage:16')), true);
  assert.equal(needsList(inExplorer('folder', 'Formation')), true);
  for (const memory of [inExplorer('folder', ''), inExplorer('recent'), inExplorer('fav'), inExplorer('shared'), inExplorer('trash'), { v: 1, who: WHO, lieu: 'app' }]) {
    assert.equal(needsList(memory), false, JSON.stringify(memory));
  }
});

test('un fichier qui existe encore est rouvert, le même', () => {
  const outcome = decide(inFile('publipostage:16'), ctx());
  assert.equal(outcome.kind, 'file');
  assert.equal(outcome.file, FILES[0]);
});

test('un fichier supprimé, mis à la corbeille ou dont le partage est retiré n\'est plus dans la liste de la personne : « gone », avec son nom', () => {
  assert.deepEqual(decide(inFile('publipostage:99', { name: 'Ancien programme' }), ctx()), { kind: 'missing', why: 'gone', name: 'Ancien programme' });
});

test('un fichier dont l\'app n\'est plus installée ou l\'extension éteinte (grisé) n\'est pas rouvert : « locked »', () => {
  const outcome = decide(inFile('publipostage:16'), ctx({ lockOf: item => (item.key === 'publipostage:16' ? { text: 'grisé' } : null) }));
  assert.deepEqual(outcome, { kind: 'missing', why: 'locked', name: 'Contrat de prestation' });
});

test('une liste vide ne dit pas que le fichier n\'existe plus (une lecture qui a échoué la rend vide) : rien à reprendre, sans phrase', () => {
  assert.deepEqual(decide(inFile('publipostage:16'), ctx({ files: [] })), { kind: 'none' });
});

test('un autre compte dans le même onglet ne reçoit pas le souvenir de l\'autre', () => {
  assert.deepEqual(decide(inFile('publipostage:16', { who: 'autre@exemple.org' }), ctx()), { kind: 'none' });
  assert.deepEqual(decide(inExplorer('folder', 'Formation', { who: 'autre@exemple.org' }), ctx()), { kind: 'place', place: { view: 'folder', path: '' } }, 'son dossier : la racine');
  assert.deepEqual(decide(inFile('publipostage:16', { who: '' }), ctx({ who: '' })), { kind: 'file', file: FILES[0] }, 'adresse inconnue des deux fois : le même souvenir');
});

test('l\'explorateur revient au même dossier ; un dossier qui n\'existe plus ramène au dossier du dessus, jusqu\'à la racine', () => {
  assert.deepEqual(decide(inExplorer('folder', 'Formation/Archives 2025'), ctx()), { kind: 'place', place: { view: 'folder', path: 'Formation/Archives 2025' } });
  assert.deepEqual(decide(inExplorer('folder', 'Formation'), ctx()), { kind: 'place', place: { view: 'folder', path: 'Formation' } }, 'un parent existe par ses fichiers');
  assert.deepEqual(decide(inExplorer('folder', 'Formation/Archives 2025/Vieux'), ctx()), { kind: 'place', place: { view: 'folder', path: 'Formation/Archives 2025' } });
  assert.deepEqual(decide(inExplorer('folder', 'Stock/Etiquettes'), ctx()), { kind: 'place', place: { view: 'folder', path: '' } });
  assert.deepEqual(decide(inExplorer('folder', 'Archives'), ctx({ folders: ['Archives'] })), { kind: 'place', place: { view: 'folder', path: 'Archives' } }, 'un dossier gardé vide existe');
  assert.deepEqual(decide(inExplorer('folder', 'Formation'), ctx({ files: [] })), { kind: 'place', place: { view: 'folder', path: '' } }, 'sans liste, la racine');
});

test('les autres vues reviennent telles quelles, sans chemin', () => {
  for (const view of ['recent', 'fav', 'shared', 'trash']) assert.deepEqual(decide(inExplorer(view), ctx({ files: [] })), { kind: 'place', place: { view, path: '' } }, view);
  assert.deepEqual(decide(inExplorer('folder', ''), ctx()), { kind: 'place', place: { view: 'folder', path: '' } });
});

test('une app ouverte sans fichier connu, ou aucun souvenir : rien à reprendre, l\'arrivée est celle d\'avant', () => {
  assert.deepEqual(decide({ v: 1, who: WHO, lieu: 'app' }, ctx()), { kind: 'none' });
  assert.deepEqual(decide(null, ctx()), { kind: 'none' });
});
