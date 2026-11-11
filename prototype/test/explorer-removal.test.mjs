// Les gestes de l'explorateur qui font partir une ligne (js/explorer-removal.js), sortis de js/explorer.js : la corbeille, le dossier supprimé, la restauration, la suppression pour de bon, la corbeille vidée, et le clavier
// qui passe à la ligne voisine quand un geste a abouti.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Removal } from '../js/explorer-removal.js';

function bench({ view = 'folder', choice = false, files = [{ key: 'a', app: 'pp' }, { key: 'b', app: 'pp' }, { key: 'c', app: 'pp' }], trashed = [{ key: 't1' }, { key: 't2' }], handles = true, keys = ['a', 'b', 'c'], open = true, moved = true } = {}) {
  const calls = [];
  const state = { view, choice, keys, open };
  const bin = { handles: file => handles && file.app === 'pp', move: async file => { calls.push(`move:${file.key}`); return moved; }, restore: async file => { calls.push(`restore:${file.key}`); return true; }, purge: async file => { calls.push(`purge:${file.key}`); return true; }, empty: async list => { calls.push(`empty:${list.map(file => file.key).join(',')}`); return true; } };
  const opts = { i18n: { t: (key, vars) => (vars && vars.app ? `${key}:${vars.app}` : key) }, notice: text => calls.push(`notice:${text}`), appName: app => `App ${app}`, filing: { deleteFolder: async path => { calls.push(`folder:${path}`); return true; } } };
  const removal = new Removal({ opts: () => opts, view: () => state.view, choice: () => state.choice, files: () => files, trashed: () => trashed, bin: () => bin, keys: () => state.keys, isOpen: () => state.open, select: (key, focus) => calls.push(`select:${key}:${focus}`) });
  return { removal, calls, state };
}

test('mettre à la corbeille : le fichier part, et la ligne qui le suivait prend le clavier', async () => {
  const b = bench();
  await b.removal.trash('a');
  assert.deepEqual(b.calls, ['move:a', 'select:b:true']);
});

test('le dernier fichier de la liste : le clavier passe à la ligne qui le précédait', async () => {
  const b = bench();
  await b.removal.trash('c');
  assert.deepEqual(b.calls, ['move:c', 'select:b:true']);
});

test('un geste qui n\'aboutit pas ne déplace pas le clavier', async () => {
  const b = bench({ moved: false });
  await b.removal.trash('a');
  assert.deepEqual(b.calls, ['move:a']);
});

test('l\'explorateur fermé, ou la ligne voisine disparue pendant le geste : le clavier ne bouge pas', async () => {
  const closed = bench({ open: false });
  await closed.removal.trash('a');
  assert.deepEqual(closed.calls, ['move:a']);
  const b = bench();
  await b.removal.leaving('a', async () => { b.state.keys = ['c']; return true; });
  assert.deepEqual(b.calls, []);
});

test('pendant un choix : rien ne part, la phrase le dit', async () => {
  const b = bench({ choice: true });
  await b.removal.trash('a');
  assert.deepEqual(b.calls, ['notice:ex.choose.newOff']);
  const empty = bench({ choice: true });
  await empty.removal.emptyTrash();
  assert.deepEqual(empty.calls, []);
});

test('un fichier qu\'aucun gardien ne connaît : la phrase dit quelle app le fait', async () => {
  const b = bench({ handles: false });
  await b.removal.trash('a');
  assert.deepEqual(b.calls, ['notice:trash.appOnly:App pp']);
});

test('à la corbeille, Suppr supprime pour de bon ; un dossier se supprime par le rangement ; une clé inconnue ne fait rien', async () => {
  const b = bench({ view: 'trash', keys: ['t1', 't2'] });
  await b.removal.trash('t1');
  assert.deepEqual(b.calls, ['purge:t1', 'select:t2:true']);
  const folder = bench({ keys: ['dir:x', 'a'] });
  await folder.removal.trash('dir:x');
  assert.deepEqual(folder.calls, ['folder:x', 'select:a:true']);
  const unknown = bench();
  await unknown.removal.trash('zzz');
  await unknown.removal.restore('zzz');
  await unknown.removal.purge('zzz');
  assert.deepEqual(unknown.calls, []);
});

test('restaurer, supprimer pour de bon et vider la corbeille', async () => {
  const b = bench({ view: 'trash', keys: ['t1', 't2'] });
  await b.removal.restore('t1');
  await b.removal.purge('t2');
  await b.removal.emptyTrash();
  assert.deepEqual(b.calls, ['restore:t1', 'select:t2:true', 'purge:t2', 'select:t1:true', 'empty:t1,t2']);
  const none = bench({ trashed: [] });
  await none.removal.emptyTrash();
  assert.deepEqual(none.calls, [], 'une corbeille vide ne demande rien');
});
