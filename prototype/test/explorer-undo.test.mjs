// Ctrl+Z et Ctrl+Y pour la corbeille et la copie (js/explorer/explorer-undo.js) : la corbeille et la copie entourées déposent dans la pile le geste qui les défait, et ce geste dépose le contraire (le rétablissement) ; supprimer pour de bon ne dépose rien.
import test from 'node:test';
import assert from 'node:assert/strict';
import { UndoStack } from '../js/files/undo-stack.js';
import { undoable } from '../js/explorer/explorer-undo.js';

const t = (key, params = {}) => `${key}${params.name ? `[${params.name}]` : ''}${params.app ? `<${params.app}>` : ''}`;
const entry = (id, name, extra = {}) => ({ key: `zf:${id}`, app: 'zf', id: String(id), name, ...extra });

// Une corbeille de papier : `live` et `trashed` sont les deux listes de l'explorateur ; chaque geste les change comme la relecture des fichiers le ferait.
function harness({ restoreAs = null, lock = null, handles = true } = {}) {
  const live = [entry(1, 'Un'), entry(2, 'Deux')];
  const trashed = [];
  const said = [];
  const calls = [];
  const revealed = [];
  const stack = new UndoStack({ t, notice: text => said.push(text) });
  const bin = {
    handles: () => handles,
    appLockOf: () => lock,
    async move(file) {
      calls.push(['move', file.key]);
      const at = live.findIndex(item => item.key === file.key);
      if (at < 0) return false;
      const [item] = live.splice(at, 1);
      trashed.push({ ...item, trashed: { ts: 100 + trashed.length, by: '' } });
      said.push(`à la corbeille ${item.name}`);
      return true;
    },
    async restore(file) {
      calls.push(['restore', file.key, file.trashed.ts]);
      const at = trashed.indexOf(file);
      if (at < 0) return false;
      const [item] = trashed.splice(at, 1);
      live.push({ ...item, key: restoreAs ? `zf:${restoreAs}` : item.key, trashed: null });
      said.push(`restauré ${item.name}`);
      return true;
    },
    async purge(file) { calls.push(['purge', file.key]); trashed.splice(trashed.indexOf(file), 1); return true; },
    async empty(files) { calls.push(['empty', files.length]); trashed.length = 0; return true; },
  };
  let copied = 0;
  const copying = {
    handles: () => true,
    async copy(file) {
      calls.push(['copy', file.key]);
      copied += 1;
      const made = entry(100 + copied, `Copie de ${file.name}`);
      live.push(made);
      return { key: made.key, name: made.name };
    },
  };
  const wrapped = undoable({ stack, bin, copying, trashed: () => trashed, live: () => live, t, appName: id => id, reveal: key => revealed.push(key) });
  return { ...wrapped, stack, live, trashed, said, calls, revealed };
}

test('mettre à la corbeille puis Ctrl+Z : le fichier revient, par la corbeille, avec sa phrase', async () => {
  const { bin, stack, live, said } = harness();
  assert.equal(await bin.move(live[0]), true);
  assert.deepEqual(live.map(item => item.name), ['Deux']);
  await stack.undo();
  assert.deepEqual(live.map(item => item.name).sort(), ['Deux', 'Un']);
  assert.deepEqual(said, ['à la corbeille Un', 'restauré Un']);
});

test('trois suppressions puis trois Ctrl+Z : les fichiers reviennent dans l\'ordre inverse, puis « rien à annuler »', async () => {
  const h = harness();
  h.live.push(entry(3, 'Trois'));
  for (const name of ['Un', 'Deux', 'Trois']) await h.bin.move(h.live.find(item => item.name === name));
  await h.stack.undo();
  assert.deepEqual(h.live.map(item => item.name), ['Trois']);
  await h.stack.undo();
  await h.stack.undo();
  assert.deepEqual(h.live.map(item => item.name).sort(), ['Deux', 'Trois', 'Un']);
  await h.stack.undo();
  assert.equal(h.said.at(-1), 'undo.nothing');
});

test('deux entrées de la corbeille pour une même clé : Ctrl+Z restaure la plus récente, quel que soit leur ordre dans la liste', async () => {
  const h = harness();
  await h.bin.move(h.live[0]); // l'entrée du geste, daté 100
  h.trashed.push({ ...entry(1, 'Un'), trashed: { ts: 50, by: '' } }); // une plus ancienne, après elle dans la liste
  h.calls.length = 0;
  await h.stack.undo();
  assert.deepEqual(h.calls, [['restore', 'zf:1', 100]]);
});

test('restaurer puis Ctrl+Z : le fichier retourne à la corbeille, même sous une autre clé (nouvelle ligne)', async () => {
  const h = harness({ restoreAs: 77 });
  await h.bin.move(h.live[0]);
  await h.bin.restore(h.trashed[0]);
  assert.ok(h.live.some(item => item.key === 'zf:77'));
  await h.stack.undo(); // défait la restauration
  assert.deepEqual([h.live.some(item => item.key === 'zf:77'), h.trashed.map(item => item.key)], [false, ['zf:77']]);
});

test('copier puis Ctrl+Z : la copie, et elle seule, part à la corbeille', async () => {
  const h = harness();
  const made = await h.copying.copy(h.live[0], '');
  assert.equal(made.key, 'zf:101');
  await h.stack.undo();
  assert.deepEqual([h.live.map(item => item.name), h.trashed.map(item => item.name)], [['Un', 'Deux'], ['Copie de Un']]);
});

test('supprimer pour de bon et vider la corbeille ne déposent rien : ils ne s\'annulent pas', async () => {
  const h = harness();
  await h.bin.move(h.live[0]);
  h.stack.clear();
  await h.bin.purge(h.trashed[0]);
  await h.bin.empty([]);
  assert.equal(h.stack.size, 0);
});

test('Ctrl+Z d\'une suppression dont l\'entrée a été supprimée pour de bon depuis : « n\'est plus là », sans écriture', async () => {
  const h = harness();
  await h.bin.move(h.live[0]);
  await h.bin.purge(h.trashed[0]);
  h.calls.length = 0;
  await h.stack.undo();
  assert.deepEqual([h.said.at(-1), h.calls], ['undo.gone[Un]', []]);
});

test('Ctrl+Z d\'une copie que la personne a déjà supprimée : « n\'est plus là », sans écriture', async () => {
  const h = harness();
  await h.copying.copy(h.live[0], '');
  h.live.splice(2, 1);
  h.calls.length = 0;
  await h.stack.undo();
  assert.deepEqual([h.said.at(-1), h.calls], ['undo.gone[Copie de Un]', []]);
});

test('un geste qui n\'a pas abouti ne dépose rien', async () => {
  const h = harness();
  assert.equal(await h.bin.move({ ...entry(9, 'Absent') }), false);
  assert.equal(h.stack.size, 0);
});

test('remettre à la corbeille attend l\'app ouverte : la phrase le dit, rien n\'est écrit, et le geste reste à défaire', async () => {
  const lock = { text: 'Ouvre Form+ pour continuer.' };
  const h = harness({ lock });
  await h.bin.move(h.live[0]);
  await h.bin.restore(h.trashed[0]);
  h.calls.length = 0;
  await h.stack.undo(); // défaire la restauration = remettre à la corbeille : l'app est fermée
  assert.deepEqual([h.said.at(-1), h.calls, h.stack.size], [lock.text, [], 2], 'la restauration reste à défaire (et, dessous, la suppression)');
});

test('restaurer, lui, n\'a pas besoin de l\'app : Ctrl+Z d\'une suppression marche app fermée', async () => {
  const h = harness({ lock: { text: 'Ouvre Form+ pour continuer.' } });
  await h.bin.move(h.live[0]);
  h.calls.length = 0;
  await h.stack.undo();
  assert.deepEqual(h.calls, [['restore', 'zf:1', 100]]);
});

test('une copie dont l\'app ne sait pas supprimer les fichiers : Ctrl+Z dit de passer par l\'app, rien n\'est écrit', async () => {
  const h = harness({ handles: false });
  await h.copying.copy(h.live[0], '');
  h.calls.length = 0;
  await h.stack.undo();
  assert.deepEqual([h.said.at(-1), h.calls], ['trash.appOnly<zf>', []]);
});

test('la corbeille entourée garde la forme de l\'autre : handles, appLockOf', () => {
  const h = harness({ lock: { text: 'x' } });
  assert.deepEqual([h.bin.handles({}), h.bin.appLockOf({}), h.copying.handles({}), h.copying.appLockOf({})], [true, { text: 'x' }, true, null]);
});

test('Ctrl+Z d\'une suppression puis Ctrl+Y : le fichier retourne à la corbeille, puis Ctrl+Z le ramène encore', async () => {
  const h = harness();
  await h.bin.move(h.live[0]);
  await h.stack.undo();
  assert.deepEqual([h.live.map(item => item.name).sort(), h.trashed.length, h.stack.redoSize], [['Deux', 'Un'], 0, 1]);
  await h.stack.redo();
  assert.deepEqual([h.live.map(item => item.name), h.trashed.map(item => item.name), h.said.at(-1)], [['Deux'], ['Un'], 'à la corbeille Un']);
  await h.stack.undo();
  assert.deepEqual([h.live.map(item => item.name).sort(), h.trashed.length], [['Deux', 'Un'], 0]);
});

test('Ctrl+Z d\'une restauration puis Ctrl+Y : le fichier est de nouveau restauré, même sous une autre clé', async () => {
  const h = harness({ restoreAs: 77 });
  await h.bin.move(h.live[0]);
  await h.bin.restore(h.trashed[0]); // restauré sous zf:77
  await h.stack.undo(); // retourne à la corbeille
  assert.deepEqual([h.live.some(item => item.key === 'zf:77'), h.trashed.length], [false, 1]);
  await h.stack.redo();
  assert.deepEqual([h.live.some(item => item.key === 'zf:77'), h.trashed.length, h.said.at(-1)], [true, 0, 'restauré Un']);
});

test('Ctrl+Z d\'une copie puis Ctrl+Y : la même copie sort de la corbeille ; un nouveau Ctrl+Z la remet', async () => {
  const h = harness();
  await h.copying.copy(h.live[0], '');
  await h.stack.undo();
  assert.deepEqual(h.live.map(item => item.name), ['Un', 'Deux']);
  await h.stack.redo();
  assert.deepEqual([h.live.map(item => item.name), h.trashed.length], [['Un', 'Deux', 'Copie de Un'], 0]);
  await h.stack.undo();
  assert.deepEqual([h.live.map(item => item.name), h.trashed.map(item => item.name)], [['Un', 'Deux'], ['Copie de Un']]);
});

test('un nouveau geste après Ctrl+Z vide le rétablissement : Ctrl+Y dit « Rien à rétablir »', async () => {
  const h = harness();
  await h.bin.move(h.live[0]);
  await h.stack.undo();
  await h.bin.move(h.live.find(item => item.name === 'Deux'));
  await h.stack.redo();
  assert.equal(h.said.at(-1), 'redo.nothing');
  assert.deepEqual(h.live.map(item => item.name), ['Un'], 'rien n\'est refait');
});

test('Ctrl+Y d\'une suppression que la personne a refaite à la main (le fichier n\'est plus vivant) : « n\'est plus là », rien n\'est écrit', async () => {
  const h = harness();
  await h.bin.move(h.live[0]);
  await h.stack.undo(); // revenu
  h.live.splice(h.live.findIndex(item => item.name === 'Un'), 1); // disparu depuis
  h.calls.length = 0;
  await h.stack.redo();
  assert.deepEqual([h.said.at(-1), h.calls], ['redo.gone[Un]', []]);
});

test('remettre à la corbeille (Ctrl+Y d\'une suppression) attend l\'app ouverte : la phrase le dit, rien n\'est écrit, et le geste reste à refaire ; restaurer (Ctrl+Z) n\'en a pas besoin', async () => {
  const lock = { text: 'Ouvre Form+ pour continuer.' };
  const h = harness({ lock });
  await h.bin.move(h.live[0]);
  await h.stack.undo(); // restaurer : pas besoin de l'app
  h.calls.length = 0;
  await h.stack.redo();
  assert.deepEqual([h.said.at(-1), h.calls, h.stack.redoSize], [lock.text, [], 1]);
});

// Audit des parcours du 10/11 : après Ctrl+Z, le fichier ramené n'était pas la ligne choisie (la sélection restait sur un voisin, et un Suppr de plus agissait sur lui). L'explorateur reçoit la clé du fichier sorti de la corbeille.
test('Ctrl+Z d\'une suppression : la clé du fichier ramené est donnée à l\'explorateur pour qu\'il le choisisse', async () => {
  const { bin, stack, live, revealed } = harness();
  await bin.move(live[0]);
  assert.deepEqual(revealed, [], 'mettre à la corbeille ne choisit rien');
  await stack.undo();
  assert.deepEqual(revealed, ['zf:1']);
});

test('Ctrl+Z quand la restauration donne une autre clé (nouvelle ligne) : c\'est la nouvelle clé qui est donnée', async () => {
  const { bin, stack, live, revealed } = harness({ restoreAs: 9 });
  await bin.move(live[0]);
  await stack.undo();
  assert.deepEqual(revealed, ['zf:9']);
});

test('Ctrl+Y d\'une copie défaite : la copie qui sort de la corbeille est donnée à l\'explorateur', async () => {
  const { copying, stack, live, revealed } = harness();
  const made = await copying.copy(live[0]);
  await stack.undo();
  assert.deepEqual(revealed, [], 'défaire la copie la met à la corbeille : rien à choisir');
  await stack.redo();
  assert.deepEqual(revealed, [made.key]);
});

test('un fichier qui n\'est plus à la corbeille : rien n\'est donné à l\'explorateur', async () => {
  const { bin, stack, live, trashed, revealed } = harness();
  await bin.move(live[0]);
  trashed.length = 0;
  await stack.undo();
  assert.deepEqual(revealed, []);
});
