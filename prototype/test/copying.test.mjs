// La copie depuis l'explorateur (js/files/copying.js) : ce qui est commun à tous les gardiens (vérifier qu'on peut écrire, ranger la copie dans son dossier, dire ce qui s'est passé, relire la liste). Les gardiens
// sont des doublures ; ce que fait celui des PDF est dans files-store.test.mjs, celui des apps dans app-files.test.mjs, et ce que Grist rend vraiment se mesure dans le labo (labo/run-copie.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Copying } from '../js/files/copying.js';
import { TableDeclined } from '../js/files/own-table.js';
import { FR, EN } from './kept-setup.mjs';

// Un gardien de doublure : il garde la trace de ce qu'on lui demande et rend ce qu'on lui a dit de rendre.
function guardian({ app = 'gfs-fichiers', lock = null, waits = null, copy = async () => ({ id: 'bb', name: 'Facture (1).pdf' }) } = {}) {
  const calls = [];
  const locked = [];
  return { calls, locked, copies: file => file.app === app, lock: (file, gesture) => { locked.push([file && file.id, gesture]); return lock; }, waitsForApp: (file, gesture) => (waits && gesture === 'copy' ? waits : null),
    copy: async file => { calls.push(file.id); return copy(file); } };
}

function setup({ managers = [guardian()], file = async () => {}, i18n = FR } = {}) {
  const log = { notices: [], refreshes: 0, filed: [] };
  const copying = new Copying({
    managers, t: i18n.t, notice: text => log.notices.push(text), refresh: async () => { log.refreshes += 1; },
    file: async (app, id, folder) => { log.filed.push([app, id, folder]); return file(app, id, folder); },
  });
  return { copying, log, managers };
}

const file = (id = 'aa', name = 'Facture.pdf', app = 'gfs-fichiers') => ({ app, id, name, key: `${app}:${id}` });
const quiet = async run => { const warn = console.warn; const warned = []; console.warn = (...args) => warned.push(args); try { return [await run(), warned]; } finally { console.warn = warn; } };

test('un fichier a un gardien quand l\'un d\'eux le copie ; un gardien qui ne sait que supprimer ne compte pas, et rien n\'est fait pour les autres', async () => {
  const trashOnly = { manages: () => true, lock: () => null };
  const { copying, log, managers } = setup({ managers: [trashOnly, guardian()] });
  assert.equal(copying.handles(file()), true);
  assert.equal(copying.handles(file('x', 'Convocation', 'publipostage')), false);
  assert.equal(await copying.copy(file('x', 'Convocation', 'publipostage'), ''), null);
  assert.deepEqual([log.notices, log.refreshes, log.filed, managers[1].calls], [[], 0, [], []]);
});

test('copier à la racine : le gardien copie, la phrase le dit, rien n\'est rangé, la liste est relue ; la clé rendue est celle de l\'explorateur', async () => {
  const { copying, log, managers } = setup();
  const result = await copying.copy(file(), '');
  assert.deepEqual(result, { key: 'gfs-fichiers:bb', name: 'Facture (1).pdf' });
  assert.deepEqual(managers[0].calls, ['aa']);
  assert.deepEqual(log.notices, [FR.t('copy.done', { as: 'Facture (1).pdf' })]);
  assert.deepEqual([log.filed, log.refreshes], [[], 1]);
});

test('copier dans un dossier : la copie y est rangée (la ligne du rangement porte l\'identifiant de la copie), la phrase dit où', async () => {
  const { copying, log } = setup();
  assert.equal((await copying.copy(file(), 'Factures/2024')).key, 'gfs-fichiers:bb');
  assert.deepEqual(log.filed, [['gfs-fichiers', 'bb', 'Factures/2024']]);
  assert.deepEqual(log.notices, [FR.t('copy.doneIn', { as: 'Facture (1).pdf', folder: 'Factures/2024' })]);
  assert.match(log.notices[0], /Factures\/2024/);
});

test('la copie existe même quand son dossier n\'a pas pu être écrit : la phrase le dit, sans bruit si la personne a refusé la table du rangement', async () => {
  const declined = setup({ file: async () => { throw new TableDeclined('GFS_Rangement'); } });
  const [result, warned] = await quiet(() => declined.copying.copy(file(), 'A'));
  assert.equal(result.name, 'Facture (1).pdf', 'la copie est rendue : elle existe');
  assert.deepEqual(declined.log.notices, [`${FR.t('copy.done', { as: 'Facture (1).pdf' })} ${FR.t('ex.filingDeclined')}`]);
  assert.deepEqual(warned, [], 'un refus de la personne n\'est pas un défaut');
  const failed = setup({ file: async () => { throw new Error('Grist dit non'); } });
  const [again, warnings] = await quiet(() => failed.copying.copy(file(), 'A'));
  assert.equal(again.name, 'Facture (1).pdf');
  assert.match(failed.log.notices[0], /Grist dit non/);
  assert.equal(warnings.length, 1, 'une vraie erreur est dite à la console, une fois');
  assert.equal(failed.log.refreshes, 1);
});

test('le verrou : le gardien dit pourquoi rien ne s\'écrit, rien n\'est demandé, rien n\'est copié, la liste n\'est pas relue', async () => {
  const { copying, log, managers } = setup({ managers: [guardian({ lock: { text: 'Document en lecture seule.' } })] });
  assert.equal(await copying.copy(file(), 'A'), null);
  assert.deepEqual([log.notices, log.refreshes, log.filed, managers[0].calls], [['Document en lecture seule.'], 0, [], []]);
});

test('un fichier qui n\'est plus là (retiré par une autre personne) : la phrase le dit, rien n\'est rangé, la liste est relue', async () => {
  const { copying, log } = setup({ managers: [guardian({ copy: async () => null })] });
  assert.equal(await copying.copy(file(), 'A'), null);
  assert.deepEqual(log.notices, [FR.t('copy.gone', { name: 'Facture.pdf' })]);
  assert.deepEqual([log.filed, log.refreshes], [[], 1]);
});

test('un échec du gardien : la phrase dit pourquoi, une fois à la console, et la liste est relue quand même', async () => {
  const { copying, log } = setup({ managers: [guardian({ copy: async () => { throw new Error('Grist a refusé'); } })] });
  const [result, warned] = await quiet(() => copying.copy(file(), ''));
  assert.equal(result, null);
  assert.deepEqual(log.notices, [FR.t('copy.failed', { name: 'Facture.pdf', reason: 'Grist a refusé' })]);
  assert.equal(warned.length, 1);
  assert.equal(log.refreshes, 1);
});

test('un refus voulu du gardien (`expected`) est dit à la personne, pas à la console', async () => {
  const refusal = Object.assign(new Error('pas de pièce jointe'), { expected: true });
  const { copying, log } = setup({ managers: [guardian({ copy: async () => { throw refusal; } })] });
  const [, warned] = await quiet(() => copying.copy(file(), ''));
  assert.deepEqual(warned, []);
  assert.match(log.notices[0], /pas de pièce jointe/);
});

test('un fichier sans nom est nommé « (sans nom) » dans la phrase, et les phrases sont aussi en anglais', async () => {
  const { copying, log } = setup({ managers: [guardian({ copy: async () => null })], i18n: EN });
  await copying.copy(file('aa', ''), '');
  assert.deepEqual(log.notices, [EN.t('copy.gone', { name: EN.t('ex.untitled') })]);
  assert.match(log.notices[0], /\(untitled\)/);
});

// Un fichier qui tient à plus qu'une ligne (contrats 2.4 `appel`) : c'est l'app ouverte qui le copie ; GFS range la copie et dit sa phrase, puis celle de l'app.
test('copier un fichier que l\'app copie : le verrou dit « copy », la phrase de l\'app suit celle de GFS (à la racine comme dans un dossier), et l\'article se grise quand l\'app n\'est pas ouverte', async () => {
  const wait = { text: 'Ouvre Form+ pour dupliquer ce fichier.' };
  const closed = setup({ managers: [guardian({ waits: wait, lock: wait })] });
  assert.deepEqual(closed.copying.appLockOf(file()), wait);
  assert.equal(await closed.copying.copy(file(), ''), null);
  assert.deepEqual(closed.log.notices, [wait.text]);
  assert.deepEqual(closed.managers[0].locked, [['aa', 'copy']]);
  assert.equal(closed.managers[0].calls.length, 0);
  const said = 'Elle n\'est pas publiée.';
  const root = setup({ managers: [guardian({ copy: async () => ({ id: 'bb', name: 'Facture (1)', said }) })] });
  assert.deepEqual(await root.copying.copy(file(), ''), { key: 'gfs-fichiers:bb', name: 'Facture (1)' });
  assert.deepEqual(root.log.notices, [`${FR.t('copy.done', { as: 'Facture (1)' })} ${said}`]);
  const inside = setup({ managers: [guardian({ copy: async () => ({ id: 'bb', name: 'Facture (1)', said }) })] });
  await inside.copying.copy(file(), 'Factures');
  assert.deepEqual(inside.log.notices, [`${FR.t('copy.doneIn', { as: 'Facture (1)', folder: 'Factures' })} ${said}`]);
  assert.deepEqual(inside.log.filed, [['gfs-fichiers', 'bb', 'Factures']]);
  assert.equal(setup().copying.appLockOf(file()), null, 'un gardien qui n\'attend pas l\'app');
});

test('l\'app n\'a rien copié (`declined`) : sa phrase est dite, rien n\'est rangé, la liste est relue ; sans phrase de sa part, GFS se tait', async () => {
  const some = setup({ managers: [guardian({ copy: async () => ({ declined: 'La copie demande un titre.' }) })] });
  assert.equal(await some.copying.copy(file(), 'Factures'), null);
  assert.deepEqual([some.log.notices, some.log.filed, some.log.refreshes], [['La copie demande un titre.'], [], 1]);
  const none = setup({ managers: [guardian({ copy: async () => ({ declined: '' }) })] });
  assert.equal(await none.copying.copy(file(), ''), null);
  assert.deepEqual([none.log.notices, none.log.refreshes], [[], 1]);
});
