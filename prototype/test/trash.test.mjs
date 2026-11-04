// La corbeille de l'explorateur (js/trash.js) : ce qui est commun à tous les gardiens de fichiers (vérifier qu'on peut écrire, poser la question avant ce qui ne s'annule pas, dire ce qui s'est
// passé, relire la liste). Les gardiens sont des doublures ; ce que fait le gardien des PDF est dans files-store.test.mjs et kept-files.test.mjs, ce que Grist rend vraiment se mesure dans le labo
// (labo/run-corbeille.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Trash } from '../js/trash.js';
import { FR, EN } from './kept-setup.mjs';

// Un gardien de doublure : il garde la trace de ce qu'on lui demande et rend ce qu'on lui a dit de rendre.
function guardian({ app = 'gfs-fichiers', lock = null, trash = async () => true, restore = async () => ({ name: 'Facture.pdf', renamed: false }), empty = async files => files.length } = {}) {
  const calls = [];
  return {
    calls, manages: file => file.app === app, lock: () => lock,
    trash: async file => { calls.push(['trash', file.id]); return trash(file); },
    restore: async file => { calls.push(['restore', file.id]); return restore(file); },
    empty: async files => { calls.push(['empty', files.map(file => file.id)]); return empty(files); },
  };
}

function setup({ managers = [guardian()], answer = true, i18n = FR, keepFolders = undefined } = {}) {
  const log = { notices: [], asked: [], refreshes: 0, order: [] };
  const bin = new Trash({
    managers, ask: async window => { log.asked.push(window); return answer; }, t: i18n.t, notice: text => log.notices.push(text), refresh: async () => { log.order.push('refresh'); log.refreshes += 1; },
    ...(keepFolders ? { keepFolders: async file => { log.order.push(`garder ${file.id}`); return keepFolders(file); } } : {}),
  });
  return { bin, log, managers };
}

const file = (id = 'aa', name = 'Facture.pdf', app = 'gfs-fichiers') => ({ app, id, name, key: `${app}:${id}` });
const quiet = async run => { const warn = console.warn; console.warn = () => {}; try { return await run(); } finally { console.warn = warn; } };

test('un fichier a un gardien quand l\'un d\'eux le gère ; sinon GFS ne sait pas le supprimer, et ne fait rien', async () => {
  const { bin, log, managers } = setup();
  assert.equal(bin.handles(file()), true);
  assert.equal(bin.handles(file('x', 'Convocation', 'publipostage')), false);
  assert.equal(await bin.move(file('x', 'Convocation', 'publipostage')), false);
  assert.deepEqual([log.notices, log.asked, log.refreshes, managers[0].calls], [[], [], 0, []]);
});

test('mettre à la corbeille : aucune question (rien ne s\'efface), la phrase le dit, la liste est relue', async () => {
  const { bin, log, managers } = setup();
  assert.equal(await bin.move(file()), true);
  assert.deepEqual(managers[0].calls, [['trash', 'aa']]);
  assert.deepEqual(log.notices, [FR.t('trash.moved', { name: 'Facture.pdf' })]);
  assert.deepEqual([log.asked.length, log.refreshes], [0, 1]);
});

test('mettre à la corbeille un fichier qui n\'est plus là : la phrase le dit, la liste est relue quand même, le geste n\'a pas abouti', async () => {
  const { bin, log } = setup({ managers: [guardian({ trash: async () => false })] });
  assert.equal(await bin.move(file()), false);
  assert.deepEqual(log.notices, [FR.t('trash.gone', { name: 'Facture.pdf' })]);
  assert.equal(log.refreshes, 1);
});

test('un échec est dit avec sa raison, en mots, et la liste est relue (une autre personne a pu changer les fichiers)', async () => {
  const { bin, log } = setup({ managers: [guardian({ trash: async () => { throw new Error('Grist refuse'); } })] });
  assert.equal(await quiet(() => bin.move(file())), false);
  assert.deepEqual(log.notices, [FR.t('trash.failed', { name: 'Facture.pdf', reason: 'Grist refuse' })]);
  assert.equal(log.refreshes, 1);
});

test('un refus voulu (`expected`) est dit à la personne avec sa raison, mais la console reste muette : seul un vrai échec y laisse un avertissement', async () => {
  const warned = [];
  const warn = console.warn;
  console.warn = (...args) => warned.push(args[0]);
  try {
    const refuse = Object.assign(new Error('la table n’a pas été créée'), { expected: true });
    const { bin, log } = setup({ managers: [guardian({ trash: async () => { throw refuse; } })] });
    assert.equal(await bin.move(file()), false);
    assert.deepEqual(log.notices, [FR.t('trash.failed', { name: 'Facture.pdf', reason: 'la table n’a pas été créée' })]);
    assert.deepEqual(warned, []);
    const broken = setup({ managers: [guardian({ trash: async () => { throw new Error('Grist refuse'); } })] });
    await broken.bin.move(file());
    assert.deepEqual(warned, ['GFS : le geste sur la corbeille a échoué']);
  } finally { console.warn = warn; }
});

test('rien ne peut s\'écrire (lecture seule, accès partiel) : la phrase dit pourquoi, le gardien n\'est pas sollicité, aucune question', async () => {
  const lock = { text: FR.t('trash.readonly') };
  const { bin, log, managers } = setup({ managers: [guardian({ lock })] });
  for (const gesture of [() => bin.move(file()), () => bin.restore(file()), () => bin.purge(file()), () => bin.empty([file()])]) assert.equal(await gesture(), false);
  assert.deepEqual(log.notices, [lock.text, lock.text, lock.text, lock.text]);
  assert.deepEqual([managers[0].calls, log.asked, log.refreshes], [[], [], 0]);
});

test('restaurer : la phrase dit le nom ; quand un autre fichier avait pris le nom, elle dit le nouveau ; un fichier déjà revenu est dit aussi', async () => {
  const names = [{ name: 'Facture.pdf', renamed: false }, { name: 'Facture (1).pdf', renamed: true }, null];
  const { bin, log } = setup({ managers: [guardian({ restore: async () => names.shift() })] });
  assert.equal(await bin.restore(file()), true);
  assert.equal(await bin.restore(file()), true);
  assert.equal(await bin.restore(file()), false);
  assert.deepEqual(log.notices, [FR.t('trash.restored', { name: 'Facture.pdf' }), FR.t('trash.restoredAs', { name: 'Facture.pdf', as: 'Facture (1).pdf' }), FR.t('trash.notIn', { name: 'Facture.pdf' })]);
  assert.equal(log.refreshes, 3);
});

test('supprimer pour de bon : la fenêtre nomme le fichier, donne le clavier à « Annuler » ; « Annuler » ne fait rien, ne dit rien', async () => {
  const no = setup({ answer: false });
  assert.equal(await no.bin.purge(file()), false);
  assert.deepEqual([no.managers[0].calls, no.log.notices, no.log.refreshes], [[], [], 0]);
  const [asked] = no.log.asked;
  assert.deepEqual([asked.title, asked.message, asked.confirmLabel, asked.cancelLabel, asked.safeFirst],
    [FR.t('trash.purge.title', { name: 'Facture.pdf' }), FR.t('trash.purge.text'), FR.t('trash.purge.confirm'), FR.t('table.cancel'), true]);
});

test('supprimer pour de bon, confirmé : le gardien reçoit ce seul fichier, la phrase le dit, la liste est relue', async () => {
  const { bin, log, managers } = setup();
  assert.equal(await bin.purge(file()), true);
  assert.deepEqual(managers[0].calls, [['empty', ['aa']]]);
  assert.deepEqual(log.notices, [FR.t('trash.purged', { name: 'Facture.pdf' })]);
  assert.equal(log.refreshes, 1);
  const gone = setup({ managers: [guardian({ empty: async () => 0 })] });
  assert.equal(await gone.bin.purge(file()), false);
  assert.deepEqual(gone.log.notices, [FR.t('trash.notIn', { name: 'Facture.pdf' })]);
});

test('vider la corbeille : la fenêtre dit combien et nomme les cinq premiers ; confirmé, chaque gardien reçoit ses fichiers, la phrase dit le total', async () => {
  const many = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(letter => file(letter.toLowerCase(), `${letter}.pdf`));
  const { bin, log, managers } = setup();
  assert.equal(await bin.empty(many), true);
  const [asked] = log.asked;
  assert.deepEqual([asked.title, asked.message, asked.items, asked.confirmLabel, asked.safeFirst], [FR.t('trash.emptyAll.title'), FR.t('trash.emptyAll.text', { n: 7 }), ['A.pdf', 'B.pdf', 'C.pdf', 'D.pdf', 'E.pdf', '…'], FR.t('trash.emptyAll.confirm'), true]);
  assert.deepEqual(managers[0].calls, [['empty', ['a', 'b', 'c', 'd', 'e', 'f', 'g']]]);
  assert.deepEqual(log.notices, [FR.t('trash.emptied', { n: 7 })]);
  assert.equal(log.refreshes, 1);
});

test('vider la corbeille : « Annuler » ne touche à rien ; une corbeille sans fichier d\'un gardien connu ne pose aucune question', async () => {
  const no = setup({ answer: false });
  assert.equal(await no.bin.empty([file()]), false);
  assert.deepEqual([no.managers[0].calls, no.log.notices, no.log.refreshes], [[], [], 0]);
  const none = setup();
  assert.equal(await none.bin.empty([]), false);
  assert.equal(await none.bin.empty([file('x', 'Convocation', 'publipostage')]), false);
  assert.deepEqual([none.log.asked, none.log.notices, none.log.refreshes], [[], [], 0]);
});

test('vider la corbeille avec deux gardiens : chacun reçoit seulement ses fichiers, les totaux s\'additionnent, une seule fenêtre', async () => {
  const mine = guardian();
  const theirs = guardian({ app: 'publipostage' });
  const { bin, log } = setup({ managers: [mine, theirs] });
  assert.equal(await bin.empty([file('a', 'A.pdf'), file('m', 'Modèle', 'publipostage'), file('b', 'B.pdf')]), true);
  assert.deepEqual([mine.calls, theirs.calls], [[['empty', ['a', 'b']]], [['empty', ['m']]]]);
  assert.deepEqual([log.asked.length, log.notices], [1, [FR.t('trash.emptied', { n: 3 })]]);
});

test('vider la corbeille : un échec en cours de route est dit avec sa raison, la liste est relue', async () => {
  const { bin, log } = setup({ managers: [guardian({ empty: async () => { throw new Error('Grist refuse'); } })] });
  assert.equal(await quiet(() => bin.empty([file()])), false);
  assert.deepEqual(log.notices, [FR.t('trash.emptyFailed', { reason: 'Grist refuse' })]);
  assert.equal(log.refreshes, 1);
});

test('un fichier sans nom est dit « (sans nom) » ; les phrases se disent aussi en anglais', async () => {
  const { bin, log } = setup({ i18n: EN });
  await bin.move(file('aa', ''));
  assert.deepEqual(log.notices, [EN.t('trash.moved', { name: '(untitled)' })]);
  assert.equal(EN.t('trash.moved', { name: 'Invoice.pdf' }), '“Invoice.pdf” is in the trash.');
});

test('mettre à la corbeille : le dossier du fichier est gardé une fois le fichier à la corbeille, avant que la liste soit relue ; la phrase dit seulement que le fichier y est', async () => {
  const { bin, log } = setup({ keepFolders: async () => {} });
  assert.equal(await bin.move(file()), true);
  assert.deepEqual(log.order, ['garder aa', 'refresh']);
  assert.deepEqual(log.notices, [FR.t('trash.moved', { name: 'Facture.pdf' })]);
});

test('un dossier qu\'on ne sait pas garder ne défait pas la corbeille : le fichier y est, la phrase le dit, seule la console le sait', async () => {
  const { bin, log } = setup({ keepFolders: async () => { throw new Error('Grist refuse le lot'); } });
  const warnings = [];
  const warn = console.warn;
  console.warn = (...args) => warnings.push(args);
  let moved;
  try { moved = await bin.move(file()); } finally { console.warn = warn; }
  assert.equal(moved, true);
  assert.deepEqual(log.notices, [FR.t('trash.moved', { name: 'Facture.pdf' })]);
  assert.equal(warnings.length, 1);
});

test('le dossier n\'est gardé que si le fichier est vraiment à la corbeille ; restaurer ou supprimer pour de bon n\'y touche pas', async () => {
  const kept = [];
  const { bin } = setup({ keepFolders: async item => { kept.push(item.id); }, managers: [guardian({ trash: async item => item.id !== 'absent' })] });
  assert.equal(await bin.move(file('absent')), false);
  await bin.restore(file('aa'));
  await bin.purge(file('bb'));
  await bin.empty([file('cc')]);
  assert.deepEqual(kept, []);
  assert.equal(await bin.move(file('dd')), true);
  assert.deepEqual(kept, ['dd']);
});
