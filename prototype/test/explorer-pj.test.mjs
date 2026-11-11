// La case « + pièces jointes » de l'explorateur (js/explorer/explorer-pj.js), sortie de js/explorer/explorer.js : le grisé et sa raison, la lecture à la coche, la course des lectures, l'échec, le recompte quand les fichiers changent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PiecesBox } from '../js/explorer/explorer-pj.js';

// La table des pièces jointes de Grist telle que `fetchTable` la rend : 3 pièces (numéros 1 à 3), de 100, 200 et 400 octets.
const table = { id: [1, 2, 3], fileIdent: ['a', 'b', 'c'], fileSize: [100, 200, 400], timeDeleted: [null, null, null] };
const t = (key, vars) => (vars && vars.reason ? `${key}:${vars.reason}` : key);

// Un banc : chaque lecture attend qu'on la termine à la main (`answer(n, réponse)`).
function bench({ hasSource = true, restricted = false, files = [], trashed = [] } = {}) {
  const calls = [];
  const state = { hasSource, restricted, files, trashed, changes: 0 };
  const box = new PiecesBox({
    t, hasSource: () => state.hasSource, restricted: () => state.restricted, files: () => state.files, trashed: () => state.trashed, changed: () => { state.changes += 1; },
    load: () => new Promise(resolve => calls.push(resolve)),
  });
  const settle = () => new Promise(resolve => setImmediate(resolve));
  return { box, state, calls, answer: async (at, response) => { calls[at](response); await settle(); } };
}

test('au départ : décochée, prête à rien, sans raison de grisé', () => {
  const { box } = bench();
  assert.deepEqual(box.facts(), { on: false, ready: false, busy: false, bytes: 0, count: 0, grey: '' });
});

test('grisée, jamais masquée : sans lecture possible, sans l\'accès complet, après un échec ; le clic rend la raison et ne coche rien', () => {
  const none = bench({ hasSource: false });
  assert.equal(none.box.facts().grey, 'weight.pjNone');
  assert.equal(none.box.toggle(true), 'weight.pjNone');
  assert.equal(none.box.facts().on, false);
  assert.equal(none.calls.length, 0, 'rien n\'est lu');
  const restricted = bench({ restricted: true });
  assert.equal(restricted.box.facts().grey, 'gfs.needsFullAccess');
  assert.equal(restricted.box.toggle(true), 'gfs.needsFullAccess');
});

test('cocher lit la table : occupée pendant la lecture, puis le total ajoute les pièces que la liste ne cite pas', async () => {
  const b = bench({ files: [{ key: 'f', pieces: [['1', 100]] }] });
  assert.equal(b.box.toggle(true), null);
  assert.equal(b.box.facts().busy, true);
  assert.equal(b.box.facts().on, true);
  await b.answer(0, { data: table });
  assert.deepEqual(b.box.facts(), { on: true, ready: true, busy: false, bytes: 600, count: 2, grey: '' }, 'la pièce 1, citée par un fichier, n\'est pas recomptée');
  assert.ok(b.state.changes >= 2, 'le total est redessiné au début et à la fin');
});

test('décocher efface ce qui était lu et abandonne la lecture en cours', async () => {
  const b = bench();
  b.box.toggle(true);
  b.box.toggle(false);
  assert.deepEqual(b.box.facts(), { on: false, ready: false, busy: false, bytes: 0, count: 0, grey: '' });
  await b.answer(0, { data: table });
  assert.equal(b.box.facts().ready, false, 'la réponse d\'une lecture abandonnée ne revient pas');
  assert.equal(b.box.facts().bytes, 0);
});

test('deux lectures qui se chevauchent : seule la dernière fait foi, même si l\'ancienne finit en dernier', async () => {
  const b = bench();
  b.box.toggle(true);
  b.box.reread();
  assert.equal(b.calls.length, 2);
  await b.answer(1, { data: table });
  await b.answer(0, { data: { id: [9], fileIdent: ['z'], fileSize: [5], timeDeleted: [null] } });
  assert.equal(b.box.facts().bytes, 700);
  assert.equal(b.box.facts().count, 3);
});

test('un échec décoche la case et la grise avec sa raison ; un changement de fichiers permet de réessayer', async () => {
  const b = bench();
  b.box.toggle(true);
  await b.answer(0, { error: new Error('refusé') });
  const failed = b.box.facts();
  assert.equal(failed.on, false);
  assert.equal(failed.grey, 'weight.pjFailed:refusé');
  assert.equal(b.box.toggle(true), 'weight.pjFailed:refusé', 'grisée tant que les fichiers n\'ont pas changé');
  b.box.filesChanged();
  assert.equal(b.box.facts().grey, '');
  assert.equal(b.box.toggle(true), null);
});

test('un échec qui lève (au lieu de rendre { error }) se dit pareil', async () => {
  const state = { changes: 0 };
  const box = new PiecesBox({ t, hasSource: () => true, restricted: () => false, files: () => [], trashed: () => [], changed: () => { state.changes += 1; }, load: async () => { throw new Error('réseau'); } });
  box.toggle(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(box.facts().grey, 'weight.pjFailed:réseau');
});

test('les fichiers changent pendant que la case est cochée : le compte est refait, et la table est relue', async () => {
  const b = bench({ files: [] });
  b.box.toggle(true);
  await b.answer(0, { data: table });
  assert.equal(b.box.facts().bytes, 700);
  b.state.files = [{ key: 'f', pieces: [['3', 400]] }];
  b.box.filesChanged();
  assert.equal(b.box.facts().bytes, 300, 'sans relire, le compte tient déjà compte du fichier ajouté');
  b.box.reread();
  assert.equal(b.calls.length, 2, 'cochée, la case relit');
  const off = bench();
  off.box.reread();
  assert.equal(off.calls.length, 0, 'décochée, elle ne lit rien');
});
