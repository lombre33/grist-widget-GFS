// L'apparence des dossiers de « Moi » (js/files/folder-looks.js, js/explorer/look-gestures.js, js/explorer/folder-look-view.js ; étude du 27/11, choix du porteur : l'émoji
// se choisit dans la fenêtre « Apparence ») : ce qu'une ligne d'état dit de l'apparence, les actions écrites, ce que la liste en montre avant l'écriture, et le geste (avec
// Ctrl+Z et Ctrl+Y). Ce que Grist fait vraiment de ces lignes se mesure dans le labo (labo/run-apparence.mjs) ; la fenêtre et le dessin, sous Firefox (test/apparence-firefox.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDocument } from './fake-dom.mjs';
import { COLORS, GLYPHS, cleanEmoji, cleanLook, firstGrapheme, lookActions, lookOfValue, readFolderLooks, sameLook } from '../js/files/folder-looks.js';
import { LookGestures } from '../js/explorer/look-gestures.js';
import { Pending } from '../js/explorer/pending.js';
import { listSignature } from '../js/explorer/list-signature.js';
import { TableDeclined } from '../js/files/rangement.js';
import { UndoStack } from '../js/files/undo-stack.js';
import { isSpacePath } from '../js/sharing/spaces-filing.js';
import { iconNames } from '../js/ui/icons.js';
import { createI18n } from '../js/i18n/i18n.js';

installFakeDocument();
const { folderIcon, lookColor, lookIn } = await import('../js/explorer/folder-look-view.js');

const { t } = createI18n('fr');
const en = createI18n('en').t;
const ME = 'moi@exemple.org';
const OTHER = 'autre@exemple.org';
const state = (folder, value = '', extra = {}) => ({ User: ME, App: '', File: '', Folder: folder, Value: value, ...extra });
const tableOf = rows => ({ id: rows.map((row, i) => i + 1), ...Object.fromEntries(['User', 'App', 'File', 'Folder', 'Value'].map(column => [column, rows.map(row => row[column])])) });
const look = value => JSON.stringify({ look: value });

test('cleanEmoji : un seul émoji, rien d\'autre autour ; une lettre, un chiffre, une ponctuation ou deux émojis n\'en sont pas', () => {
  for (const good of ['🧾', '❤️', '👨‍👩‍👧', '🇫🇷', '1️⃣', '👍🏽', ' 📁 ', '⭐']) assert.equal(cleanEmoji(good), good.trim(), good);
  for (const bad of ['', '   ', 'a', 'A', '1', '12', '#', '*', '?', 'é', '🧾 Factures', 'ab 🧾', '🧾🧾', '🧾a', null, undefined, 3, {}]) assert.equal(cleanEmoji(bad), '', String(bad));
});

test('firstGrapheme : « 🧾 Factures » donne « 🧾 » ; un émoji composé reste entier', () => {
  assert.equal(firstGrapheme('🧾 Factures'), '🧾');
  assert.equal(firstGrapheme('👨‍👩‍👧 Famille'), '👨‍👩‍👧');
  assert.equal(firstGrapheme('Factures'), 'F');
  assert.equal(firstGrapheme('   '), '');
  assert.equal(firstGrapheme(null), '');
});

test('cleanLook : seul ce qui est connu reste, l\'émoji passe devant le repère, et rien ne reste → null', () => {
  assert.deepEqual(cleanLook({ color: 'red', glyph: 'star' }), { color: 'red', glyph: 'star' });
  assert.deepEqual(cleanLook({ color: 'red', glyph: 'star', emoji: '🧾' }), { color: 'red', emoji: '🧾' });
  assert.deepEqual(cleanLook({ color: 'pink', glyph: 'rocket', emoji: 'abc', extra: 1 }), null);
  assert.deepEqual(cleanLook({ color: 'pink', glyph: 'star' }), { glyph: 'star' });
  for (const bad of [null, undefined, 'rouge', 3, [], [{ color: 'red' }], {}]) assert.equal(cleanLook(bad), null);
  for (const color of COLORS) assert.deepEqual(cleanLook({ color }), { color });
  for (const glyph of GLYPHS) assert.deepEqual(cleanLook({ glyph }), { glyph });
});

test('sameLook : deux apparences qui disent la même chose sont les mêmes, quel que soit le reste', () => {
  assert.equal(sameLook(null, {}), true);
  assert.equal(sameLook({ color: 'red' }, { color: 'red', glyph: 'rocket' }), true);
  assert.equal(sameLook({ color: 'red' }, { color: 'blue' }), false);
  assert.equal(sameLook({ emoji: '🧾' }, { glyph: 'star' }), false);
  assert.equal(sameLook(null, { color: 'red' }), false);
});

test('chaque repère de la fenêtre a son dessin', () => {
  const names = iconNames();
  for (const glyph of GLYPHS) assert.ok(names.includes(`fl-${glyph}`), `fl-${glyph}`);
  assert.ok(names.includes('droplet'));
});

test('lookOfValue : une cellule illisible ou inconnue ne dit rien (jamais d\'erreur, jamais effacée)', () => {
  assert.deepEqual(lookOfValue(look({ color: 'green', emoji: '📁' })), { color: 'green', emoji: '📁' });
  for (const bad of ['', 'pas du JSON', '[]', '3', 'null', look(null), look('rouge'), JSON.stringify({ look: { color: 'pink' } }), undefined, null, 5]) assert.equal(lookOfValue(bad), null, String(bad));
});

test('readFolderLooks : les dossiers de la personne seule, le chemin normalisé, la première ligne qui dit quelque chose fait foi', () => {
  const data = tableOf([
    state(' Clients // ACME ', look({ color: 'red' })),
    state('Clients/ACME', look({ color: 'blue' })),
    state('Vide', ''),
    state('Autre', look({ color: 'green' }), { User: OTHER }),
    state('Fichier', look({ color: 'green' }), { File: '12' }),
    state('App', look({ color: 'green' }), { App: 'publipostage' }),
    state('Cassé', 'pas du JSON'),
    state('Inconnu', look({ color: 'pink' })),
    state('', look({ color: 'green' })),
    state('Sans', look({ glyph: 'star' }), { User: '@lien' }),
  ]);
  assert.deepEqual([...readFolderLooks(data, ME)], [['Clients/ACME', { color: 'red' }]]);
  assert.deepEqual([...readFolderLooks(data, OTHER)], [['Autre', { color: 'green' }]]);
  assert.equal(readFolderLooks(null, ME).size, 0);
  assert.equal(readFolderLooks({}, ME).size, 0);
  assert.equal(readFolderLooks(data, '@lien').size, 0, 'une adresse qui commence par « @ » n\'est pas une personne');
});

test('lookActions : une ligne d\'état à mettre à jour garde ses autres clés, une ligne qui manque est ajoutée, rétablir vide la cellule', () => {
  const ctx = (rows, identity = ME) => ({ data: tableOf(rows), tableId: 'GFS_Filing', identity });
  const rows = [state('Autre', look({ color: 'green' }), { User: OTHER }), state('Clients', JSON.stringify({ look: { color: 'red' }, ailleurs: 1 }))];
  // la ligne du dossier existe : mise à jour sur place, sans toucher à celle d'une autre personne
  assert.deepEqual(lookActions(ctx(rows), 'Clients', { color: 'blue', emoji: '🧾' }), [['UpdateRecord', 'GFS_Filing', 2, { Value: JSON.stringify({ ailleurs: 1, look: { color: 'blue', emoji: '🧾' } }) }]]);
  // rétablir : le reste de la cellule est gardé, la cellule est vide quand il ne reste rien
  assert.deepEqual(lookActions(ctx(rows), 'Clients', null), [['UpdateRecord', 'GFS_Filing', 2, { Value: JSON.stringify({ ailleurs: 1 }) }]]);
  assert.deepEqual(lookActions(ctx([state('Clients', look({ color: 'red' }))]), 'Clients', {}), [['UpdateRecord', 'GFS_Filing', 1, { Value: '' }]]);
  // pas de ligne : une ligne d'état est ajoutée, au chemin normalisé, à l'adresse de la personne
  assert.deepEqual(lookActions(ctx(rows), ' Neuf // Sous ', { glyph: 'star' }), [['AddRecord', 'GFS_Filing', null, { User: ME, App: '', File: '', Favorite: false, Folder: 'Neuf/Sous',
    Value: look({ glyph: 'star' }) }]]);
  // rétablir un dossier sans ligne : rien à écrire (pas de ligne créée pour rien) ; la racine n'est pas un dossier
  assert.deepEqual(lookActions(ctx(rows), 'Neuf', null), []);
  assert.deepEqual(lookActions(ctx(rows), '', { color: 'red' }), []);
  // la ligne d'un fichier ou d'une app qui porte le même chemin n'est pas celle du dossier
  const mixed = [state('Clients', '', { File: '9' }), state('Clients', '', { App: 'publipostage' })];
  assert.equal(lookActions(ctx(mixed), 'Clients', { color: 'red' })[0][0], 'AddRecord');
  // deux lignes d'état pour le même chemin (une ancienne synchro) : les deux disent la même chose
  assert.equal(lookActions(ctx([state('A'), state('A')]), 'A', { color: 'red' }).length, 2);
});

test('Pending : l\'apparence posée s\'affiche tout de suite sans toucher aux fichiers, et un rétablissement la retire', () => {
  const pending = new Pending();
  const read = () => ({ files: [{ key: 'a:1', app: 'a', id: '1', name: 'X', folder: 'A', pinned: false, search: 'x a' }], folders: ['A'], looks: new Map([['B', { color: 'blue' }]]) });
  const first = pending.add({ op: 'look', path: 'A', look: { color: 'red' } });
  const shown = pending.apply(read());
  assert.deepEqual([...shown.looks], [['B', { color: 'blue' }], ['A', { color: 'red' }]]);
  assert.deepEqual([shown.files.length, shown.folders], [1, ['A']]);
  pending.add({ op: 'look', path: 'B', look: null });
  assert.deepEqual([...pending.apply(read()).looks], [['A', { color: 'red' }]]);
  pending.cancel(first);
  assert.deepEqual([...pending.apply(read()).looks], [], 'un changement refusé s\'en va : la liste redevient celle qui est lue (ici B retiré par le second)');
  assert.deepEqual([...new Pending().apply({ files: [], folders: [] }).looks || []], [], 'une liste sans apparence reste sans apparence');
});

test('Pending : un dossier qu\'on renomme ou déplace garde son apparence, y compris celle des sous-dossiers qui le suivent ; celui qui s\'efface ou se fond dans un autre la perd', () => {
  const pending = new Pending();
  const looks = new Map([['A', { color: 'red' }], ['A/B', { glyph: 'star' }], ['C', { emoji: '🧾' }], ['D', { color: 'green' }]]);
  pending.add({ op: 'moveLooks', moved: [['A', 'Z/A'], ['A/B', 'Z/A/B']], gone: ['C'] });
  const shown = pending.apply({ files: [], folders: [], looks });
  assert.deepEqual([...shown.looks].sort(), [['D', { color: 'green' }], ['Z/A', { color: 'red' }], ['Z/A/B', { glyph: 'star' }]]);
  assert.equal(looks.size, 4, 'la liste lue n\'est pas modifiée');
});

test('listSignature : un dossier qui change d\'apparence dans une autre fenêtre redessine la liste ; sans changement, rien', () => {
  const read = looks => ({ files: [], trash: [], folders: ['A'], looks });
  const base = listSignature(read(new Map([['A', { color: 'red' }]])));
  assert.equal(listSignature(read(new Map([['A', { color: 'red' }]]))), base);
  assert.notEqual(listSignature(read(new Map([['A', { color: 'blue' }]]))), base);
  assert.notEqual(listSignature(read(new Map())), base);
  assert.equal(listSignature({ files: [], trash: [], folders: [] }), listSignature({ files: [], trash: [], folders: [], looks: new Map() }));
});

test('folderIcon : un émoji prend la place du dessin (caché pour la lecture d\'écran), un repère donne le dessin « fl- », sans rien le dossier d\'origine ; lookIn et lookColor', () => {
  const emoji = folderIcon({ emoji: '🧾', color: 'red' });
  assert.deepEqual([emoji.tag, emoji.className, emoji.attrs['aria-hidden'], emoji.textContent], ['span', 'fe', 'true', '🧾']);
  const glyph = folderIcon({ glyph: 'star' });
  assert.equal(glyph.tag, 'svg');
  assert.equal(glyph.attrs.class, 'ic fld');
  assert.equal(glyph.elements[0].attrs.href, '#i-fl-star');
  assert.equal(folderIcon(null).elements[0].attrs.href, '#i-folder');
  assert.equal(folderIcon(null, '').attrs.class, 'ic');
  assert.equal(lookColor({ color: 'red' }), 'red');
  assert.equal(lookColor({ glyph: 'star' }), null);
  assert.equal(lookColor(null), null);
  assert.equal(lookIn({ lookOf: path => ({ color: path }) }, 'blue').color, 'blue');
  assert.equal(lookIn({}, 'A'), null);
  assert.equal(lookIn(null, 'A'), null);
});

test('les textes : chaque couleur et chaque repère se nomment en français et en anglais, la fenêtre se vouvoie', () => {
  for (const [lang, say] of [['fr', t], ['en', en]]) {
    for (const key of ['lk.menu', 'lk.title', 'lk.who', 'lk.color', 'lk.glyph', 'lk.emoji', 'lk.apply', 'lk.reset', 'lk.c.default', 'lk.g.folder', 'lk.why.space', 'lk.noAddress']) {
      assert.notEqual(say(key), key, `${lang} ${key}`);
    }
    for (const color of COLORS) assert.notEqual(say(`lk.c.${color}`), `lk.c.${color}`, `${lang} ${color}`);
    for (const glyph of GLYPHS) assert.notEqual(say(`lk.g.${glyph}`), `lk.g.${glyph}`, `${lang} ${glyph}`);
  }
  assert.equal(t('lk.who'), 'Dossier de « Moi » · à vous seul');
});

// ----- Le geste. Une doublure de ce que le contrôleur donne : le rangement garde les lignes, la liste relue en part.
function harness({ block = null, identity = ME, answers = [], rows = [state('Clients')], declined = false, fails = false, known = true, space = isSpacePath } = {}) {
  const log = { notices: [], windows: [], refreshes: [], writes: 0 };
  const looks = new Map(readFolderLooks(tableOf(rows), ME));
  const folders = new Set(['Clients', 'Vide', 'Espaces/Achats']);
  const rangement = {
    known,
    get identity() { return identity; },
    writeLooks: async make => {
      if (declined) throw new TableDeclined();
      if (fails) throw new Error('Grist a refusé');
      const actions = make({ data: tableOf(rows), tableId: 'GFS_Filing', identity });
      if (!identity || !actions.length) return false;
      log.writes += 1;
      for (const [kind, , id, values] of actions) {
        if (kind === 'AddRecord') rows.push({ ...values });
        if (kind === 'UpdateRecord') Object.assign(rows[id - 1], values);
      }
      looks.clear();
      for (const [path, each] of readFolderLooks(tableOf(rows), identity)) looks.set(path, each);
      return true;
    },
  };
  const undoStack = new UndoStack({ t, notice: text => log.notices.push(text) });
  let queue = Promise.resolve();
  const pending = new Pending();
  const gestures = new LookGestures({
    rangement, t, notice: text => log.notices.push(text), writeBlock: () => block, looks: () => looks, exists: path => folders.has(path), isSpace: space,
    windows: { look: async opts => { log.windows.push({ ...opts, shown: pending.apply({ files: [], folders: [], looks }).looks }); return answers.shift() ?? null; } },
    queue: task => { queue = queue.then(task); return queue; }, undoStack, pending,
    refresh: async opts => { log.refreshes.push({ ...opts, pendingAtRead: pending.size }); },
  });
  return { gestures, log, rows, looks, undoStack, pending, folders };
}

test('whyNot : un dossier d\'un espace dit pourquoi (grisé, jamais masqué) ; un dossier de « Moi » n\'a pas de raison', () => {
  const { gestures } = harness();
  assert.equal(gestures.whyNot('Espaces/Achats/Contrats'), t('lk.why.space'));
  assert.equal(gestures.whyNot('Espaces'), t('lk.why.space'));
  assert.equal(gestures.whyNot('Clients/ACME'), null);
  assert.equal(gestures.whyNot('Espacesdisques'), null, 'un dossier qui commence par le même mot n\'est pas la racine des espaces');
});

test('changer : la fenêtre voit l\'apparence d\'aujourd\'hui, la ligne d\'état s\'écrit, l\'apparence s\'affiche tout de suite et la liste est relue sans bruit', async () => {
  const { gestures, log, rows, pending } = harness({ answers: [{ look: { color: 'red', emoji: '🧾' } }] });
  assert.equal(await gestures.change('Clients'), true);
  assert.deepEqual([log.windows[0].name, log.windows[0].look, log.windows[0].title], ['Clients', null, t('lk.title')]);
  assert.equal(rows.length, 1, 'la ligne d\'état du dossier est mise à jour, pas doublée');
  assert.deepEqual(JSON.parse(rows[0].Value), { look: { color: 'red', emoji: '🧾' } });
  assert.equal(log.refreshes.length, 1);
  assert.deepEqual([log.refreshes[0].quiet, log.refreshes[0].pendingAtRead], [true, 1], 'confirmé, encore affiché jusqu\'à la lecture suivante');
  assert.equal(log.notices.length, 0);
  assert.equal(pending.size, 1);
});

test('changer : un dossier qui n\'a pas de ligne en reçoit une ; une apparence déjà posée est celle que la fenêtre montre', async () => {
  const { gestures, log, rows } = harness({ rows: [], answers: [{ look: { glyph: 'star' } }, { look: { glyph: 'flag' } }] });
  assert.equal(await gestures.change('Vide'), true);
  assert.deepEqual([rows.length, rows[0].User, rows[0].Folder, rows[0].App, rows[0].File], [1, ME, 'Vide', '', '']);
  await gestures.change('Vide');
  assert.deepEqual(log.windows[1].look, { glyph: 'star' });
  assert.deepEqual(JSON.parse(rows[0].Value), { look: { glyph: 'flag' } });
});

test('changer : renoncer (Échap) ou ne rien changer n\'écrit rien et ne relit rien', async () => {
  const quit = harness({ answers: [null] });
  assert.equal(await quit.gestures.change('Clients'), false);
  assert.deepEqual([quit.rows[0].Value, quit.log.writes, quit.log.refreshes.length, quit.log.notices], ['', 0, 0, []]);
  const same = harness({ rows: [state('Clients', look({ color: 'red' }))], answers: [{ look: { color: 'red' } }] });
  assert.equal(await same.gestures.change('Clients'), false);
  assert.deepEqual([same.log.writes, same.log.refreshes.length], [0, 0]);
  const none = harness({ answers: [{ look: null }] });
  assert.equal(await none.gestures.change('Clients'), false, 'rétablir un dossier qui n\'a rien : rien à écrire');
  assert.equal(none.log.writes, 0);
});

test('changer : un dossier d\'un espace, la lecture seule et une adresse inconnue sont refusés avec leur phrase, sans fenêtre ni écriture', async () => {
  const space = harness({ answers: [{ look: { color: 'red' } }] });
  assert.equal(await space.gestures.change('Espaces/Achats'), false);
  assert.deepEqual([space.log.windows.length, space.log.notices], [0, [t('lk.why.space')]]);
  const locked = harness({ block: t('mod.readonly'), answers: [{ look: { color: 'red' } }] });
  assert.equal(await locked.gestures.change('Clients'), false);
  assert.deepEqual([locked.log.windows.length, locked.rows[0].Value, locked.log.notices], [0, '', [t('mod.readonly')]]);
  const unknown = harness({ identity: '', answers: [{ look: { color: 'red' } }] });
  assert.equal(await unknown.gestures.change('Clients'), false);
  assert.deepEqual([unknown.rows[0].Value, unknown.log.notices, unknown.pending.size], ['', [t('lk.noAddress')], 0]);
});

test('changer : la table refusée ou Grist qui refuse l\'écriture le disent, et ce qui s\'affichait d\'avance s\'en va', async () => {
  const declined = harness({ declined: true, answers: [{ look: { color: 'red' } }] });
  assert.equal(await declined.gestures.change('Clients'), false);
  assert.deepEqual([declined.log.notices, declined.pending.size], [[t('ex.filingDeclined')], 0]);
  const original = console.warn;
  console.warn = () => {};
  try {
    const failed = harness({ fails: true, answers: [{ look: { color: 'red' } }] });
    assert.equal(await failed.gestures.change('Clients'), false);
    assert.deepEqual([failed.log.notices, failed.pending.size, failed.log.refreshes.length], [[t('lk.failed', { reason: 'Grist a refusé' })], 0, 0]);
  } finally { console.warn = original; }
});

test('Ctrl+Z rend l\'apparence d\'avant, Ctrl+Y la remet ; un dossier qui n\'existe plus n\'est pas ressuscité', async () => {
  const { gestures, log, rows, undoStack, folders } = harness({ rows: [state('Clients', look({ color: 'blue' }))], answers: [{ look: { color: 'red', emoji: '🧾' } }] });
  await gestures.change('Clients');
  log.notices.length = 0;
  assert.equal(await undoStack.undo(), true);
  assert.deepEqual(JSON.parse(rows[0].Value), { look: { color: 'blue' } });
  assert.deepEqual(log.notices, [t('undo.look', { name: 'Clients' })]);
  assert.equal(await undoStack.redo(), true);
  assert.deepEqual(JSON.parse(rows[0].Value), { look: { color: 'red', emoji: '🧾' } });
  assert.equal(log.notices.at(-1), t('redo.look', { name: 'Clients' }));
  const writes = log.writes;
  folders.delete('Clients');
  await undoStack.undo();
  assert.equal(log.writes, writes, 'le dossier a disparu : rien n\'est écrit, aucune ligne fantôme');
});

test('Ctrl+Z d\'une première apparence rétablit l\'aspect d\'origine : la cellule est vidée', async () => {
  const { gestures, rows, undoStack } = harness({ answers: [{ look: { glyph: 'star' } }] });
  await gestures.change('Clients');
  assert.equal(rows[0].Value, look({ glyph: 'star' }));
  await undoStack.undo();
  assert.equal(rows[0].Value, '');
});

test('une version de GFS qui ne connaît pas l\'apparence lit le même rangement sans en être gênée : la ligne reste un dossier gardé, jamais un fichier', async () => {
  const { readGfsFiling, readGfsFolders, applyFiling } = await import('../js/explorer/explorer-model.js');
  const data = { ...tableOf([state('Clients', look({ color: 'red' }))]), Favorite: [false] };
  const [only] = applyFiling([{ key: 'a:1', app: 'a', id: '1', name: 'X', folder: 'A', pinned: false, search: '' }], null, readGfsFiling(data, ME));
  assert.deepEqual([only.folder, only.pinned], ['A', false]);
  assert.deepEqual(readGfsFolders(data, ME), ['Clients']);
});
