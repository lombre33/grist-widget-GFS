// Le gardien des fichiers des apps (js/app-files.js, contrats 6.7) : mettre à la corbeille, restaurer, supprimer pour de bon, avec un faux Grist (test/fake-grist.mjs : un lot est atomique, un numéro
// de ligne pris est refusé). Ce que le vrai Grist en fait (les tables internes, les dates, la fenêtre de l'accord, le lot atomique) se mesure dans le labo : labo/run-corbeille-apps.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppFiles, dataColumnsOf } from '../js/app-files.js';
import { loadFiles } from '../js/explorer-data.js';
import { BIN_TABLE, parseSnapshot } from '../js/gfs-trash.js';
import { createI18n } from '../js/i18n.js';
import { fakeGrist } from './fake-grist.mjs';
import { publipostage, form } from './helpers.mjs';

const FR = createI18n('fr');
const manifest = publipostage();
const NOW = 1762000000000;
const DATA_COLUMNS = ['Nom', 'Contenu', 'TypeModele', 'DateModif', 'ModifiePar', 'EstParDefaut', 'Jeton'].map(id => ({ id, type: 'Text' })).concat({ id: 'Pieces', type: 'Attachments' });

const row = (id, over = {}) => ({ id, Nom: `Modèle ${id}`, Contenu: '<p></p>', TypeModele: 'document', DateModif: 100 * id, ModifiePar: '', EstParDefaut: false, Jeton: `j${id}`, Pieces: null, ...over });
const models = () => [row(1, { Nom: 'Convocation', EstParDefaut: true }), row(2, { Nom: 'Attestation', TypeModele: 'grille' }), row(3, { Nom: 'Relance' }), row(4, { Nom: '@reglages', TypeModele: 'reglages', Jeton: '' })];

function setup({ rows = models(), consent = async () => true, grist = {}, over = {} } = {}) {
  const fake = fakeGrist({ Publipostage_Modeles: { columns: ['id', ...DATA_COLUMNS.map(column => column.id)], rows } }, grist);
  const asked = [];
  const trash = new AppFiles({
    port: fake.port, apps: () => [{ manifest }], consent: async () => { asked.push('consent'); return consent(); }, identity: () => 'paul@exemple.fr', now: () => NOW,
    readonly: () => false, fullAccess: () => true, t: FR.t, columnsOf: async () => DATA_COLUMNS, ...over,
  });
  const load = () => loadFiles(fake.port, [{ manifest }], '');
  const bin = () => fake.tables[BIN_TABLE];
  const live = () => fake.tables.Publipostage_Modeles.rows;
  const verbs = () => fake.batches.map(batch => batch.map(action => action[0]));
  return { ...fake, trash, asked, load, bin, live, verbs };
}

// Met à la corbeille le fichier `id` de la liste lue, et rend l'entrée telle que l'explorateur la lit ensuite.
async function trashed(run, id) {
  const { files } = await run.load();
  assert.equal(await run.trash.trash(files.find(file => file.id === String(id))), true);
  return (await run.load()).trash.find(file => file.id === String(id));
}

test('le gardien ne gère que les fichiers d\'une app installée dont le manifeste déclare la recette', async () => {
  const run = setup();
  const { files } = await run.load();
  assert.deepEqual(files.map(file => run.trash.manages(file)), [true, true, true]);
  assert.equal(run.trash.manages({ ...files[0], table: 'Autre' }), false, 'une autre table');
  assert.equal(run.trash.manages({ ...files[0], app: 'automation' }), false, 'une app sans recette');
  const bare = form();
  delete bare.fichiers[0].suppression;
  delete bare.fichiers[0].copie;
  const withoutRecipe = setup({ over: { apps: () => [{ manifest: bare }] } });
  assert.equal(withoutRecipe.trash.manages({ app: 'form', table: 'FormPlus_Formulaires' }), false, 'sans recette : grisé, avec l\'explication');
  assert.equal(setup({ over: { apps: () => [{ manifest: form() }] } }).trash.manages({ app: 'form', table: 'FormPlus_Formulaires' }), true, 'Form+ déclare `suppression.appel` depuis ses consignes 020 et 021 faites (7057309)');
  assert.equal(setup({ over: { apps: () => [] } }).trash.manages(files[0]), false, 'l\'app n\'est pas installée');
});

test('le verrou : l\'accès complet est requis (les tables internes de Grist ne se lisent pas sans lui), et un document en lecture seule ne s\'écrit pas', () => {
  assert.equal(setup().trash.lock(), null);
  assert.deepEqual(setup({ over: { fullAccess: () => false } }).trash.lock(), { text: FR.t('gfs.needsFullAccess') });
  assert.deepEqual(setup({ over: { readonly: () => true } }).trash.lock(), { text: FR.t('trash.readonly') });
});

test('sans l\'accord de la personne, la table n\'est pas créée et rien n\'est supprimé : le refus le dit', async () => {
  const run = setup({ consent: async () => false });
  const { files } = await run.load();
  await assert.rejects(run.trash.trash(files[1]), { message: FR.t('trash.table.declined'), expected: true });
  assert.equal(BIN_TABLE in run.tables, false);
  assert.equal(run.live().length, 4);
  assert.deepEqual(run.batches, []);
});

test('mettre à la corbeille : la table naît avec l\'accord, puis UN SEUL lot copie la ligne dans GFS_Corbeille et la retire de la table de l\'app', async () => {
  const run = setup();
  const entry = await trashed(run, 2);
  assert.deepEqual(run.asked, ['consent']);
  assert.deepEqual(run.verbs(), [['AddTable'], ['AddRecord', 'RemoveRecord']]);
  assert.deepEqual(run.batches[1].map(action => action.slice(1, 3)), [[BIN_TABLE, null], ['Publipostage_Modeles', 2]]);
  assert.deepEqual(run.live().map(each => each.id), [1, 3, 4]);
  const [stored] = run.bin().rows;
  assert.match(stored.Identifiant, /^[0-9a-f]{12}$/);
  assert.deepEqual({ ...stored, Identifiant: null, Instantane: null }, {
    id: 1, Identifiant: null, App: 'publipostage', Table: 'Publipostage_Modeles', FichierId: '2', Nom: 'Attestation', Type: 'grille', Date: 200, Auteur: '', SupprimeLe: NOW / 1000,
    SupprimePar: 'paul@exemple.fr', Instantane: null,
  });
  assert.deepEqual(parseSnapshot(stored.Instantane).valeurs, { Nom: 'Attestation', Contenu: '<p></p>', TypeModele: 'grille', DateModif: 200, ModifiePar: '', EstParDefaut: false, Jeton: 'j2', Pieces: null });
  assert.deepEqual([entry.key, entry.name, entry.type, entry.trashed, entry.known], ['publipostage:2', 'Attestation', 'grille', { ts: NOW / 1000, by: 'paul@exemple.fr' }, true]);
});

test('la liste lue ensuite : le fichier a quitté les vivants et est à la corbeille ; les autres ne bougent pas, et la ligne des réglages n\'est jamais un fichier', async () => {
  const run = setup();
  await trashed(run, 2);
  const { files, trash, problems } = await run.load();
  assert.deepEqual(files.map(file => file.id), ['1', '3']);
  assert.deepEqual(trash.map(file => file.id), ['2']);
  assert.deepEqual(problems, []);
});

test('l\'accord n\'est demandé qu\'une fois : la table existe au deuxième fichier', async () => {
  const run = setup();
  await trashed(run, 2);
  await trashed(run, 3);
  assert.deepEqual(run.asked, ['consent']);
  assert.equal(run.bin().rows.length, 2);
});

test('un fichier qui n\'est plus dans la table de l\'app (supprimé entre-temps) ou qui n\'en est pas un (les réglages) : rien n\'est écrit, rien n\'est demandé, la table n\'est pas créée', async () => {
  const run = setup();
  const { files } = await run.load();
  run.live().splice(0, 1);
  assert.equal(await run.trash.trash(files[0]), false);
  assert.equal(await run.trash.trash({ ...files[1], id: '4', row: 4 }), false, 'la ligne des réglages est exclue par le manifeste');
  assert.equal(BIN_TABLE in run.tables, false);
  assert.deepEqual([run.asked, run.batches], [[], []]);
});

test('une ligne qui a des pièces jointes n\'est pas mise à la corbeille (la copie en JSON ne les garderait pas) : le refus le dit, sans table ni accord ; une liste vide de pièces n\'en est pas', async () => {
  const run = setup({ rows: [row(1, { Pieces: ['L', 12, 13] }), row(2, { Pieces: ['L'] })] });
  const { files } = await run.load();
  await assert.rejects(run.trash.trash(files[0]), { message: FR.t('trash.attachments'), expected: true });
  assert.equal(BIN_TABLE in run.tables, false);
  assert.deepEqual(run.asked, []);
  assert.equal(await run.trash.trash(files[1]), true);
});

test('la personne peut être longue à répondre à la question de la table : la copie garde la ligne telle qu\'elle est après la réponse, jamais telle qu\'elle était avant', async () => {
  let run;
  run = setup({ consent: async () => { run.live().find(each => each.id === 2).Nom = 'Modifiée pendant la question'; return true; } });
  const { files } = await run.load();
  assert.equal(await run.trash.trash(files[1]), true);
  assert.equal(parseSnapshot(run.bin().rows[0].Instantane).valeurs.Nom, 'Modifiée pendant la question');
  assert.equal(run.bin().rows[0].Nom, 'Modifiée pendant la question');
});

test('une ligne supprimée par une autre personne pendant la question de la table : rien n\'est copié (la table est née, mais elle reste vide), false', async () => {
  let run;
  run = setup({ consent: async () => { run.live().splice(1, 1); return true; } });
  const { files } = await run.load();
  assert.equal(await run.trash.trash(files[1]), false);
  assert.deepEqual(run.bin().rows, []);
  assert.deepEqual(run.live().map(each => each.id), [1, 3, 4]);
});

test('le lot est tout ou rien : si le retrait de la ligne échoue, la copie n\'est pas gardée (un fichier n\'est jamais à la fois dans l\'app et à la corbeille)', async () => {
  const run = setup({ grist: { fail: { RemoveRecord: 'accès refusé' } } });
  const { files } = await run.load();
  await assert.rejects(run.trash.trash(files[1]), { message: 'accès refusé' });
  assert.equal(run.live().length, 4);
  assert.deepEqual(run.bin().rows, []);
  assert.deepEqual((await run.load()).files.map(file => file.id), ['1', '2', '3']);
});

test('deux demandes à la fois sur le même fichier s\'enchaînent : la première le met à la corbeille, la seconde voit qu\'il n\'est plus là', async () => {
  const run = setup();
  const { files } = await run.load();
  const results = await Promise.all([run.trash.trash(files[1]), run.trash.trash(files[1])]);
  assert.deepEqual(results, [true, false]);
  assert.equal(run.bin().rows.length, 1);
});

test('restaurer : la ligne revient telle qu\'elle était, au même numéro, et son entrée quitte la corbeille dans le même lot', async () => {
  const run = setup();
  const before = structuredClone(run.live().find(each => each.id === 2));
  const entry = await trashed(run, 2);
  assert.deepEqual(await run.trash.restore(entry), { name: 'Attestation', renamed: false });
  assert.deepEqual(run.live().find(each => each.id === 2), before);
  assert.deepEqual(run.bin().rows, []);
  assert.deepEqual(run.verbs().at(-1), ['AddRecord', 'RemoveRecord']);
  assert.deepEqual(run.batches.at(-1).map(action => action.slice(0, 3)), [['AddRecord', 'Publipostage_Modeles', 2], ['RemoveRecord', BIN_TABLE, 1]]);
  const { files, trash } = await run.load();
  assert.deepEqual([files.map(file => file.id), trash], [['1', '3', '2'], []]);
});

test('restaurer deux fois : la seconde ne trouve plus l\'entrée, et n\'écrit rien', async () => {
  const run = setup();
  const entry = await trashed(run, 2);
  await run.trash.restore(entry);
  const count = run.batches.length;
  assert.equal(await run.trash.restore(entry), null);
  assert.equal(run.batches.length, count);
});

test('restaurer un fichier dont la date du geste a changé (remis puis re-supprimé depuis la liste affichée) : null, rien n\'est écrit', async () => {
  const run = setup();
  const entry = await trashed(run, 2);
  const count = run.batches.length;
  assert.equal(await run.trash.restore({ ...entry, trashed: { ...entry.trashed, ts: entry.trashed.ts - 5 } }), null);
  assert.equal(run.batches.length, count);
  assert.equal(run.bin().rows.length, 1);
});

test('restaurer quand le numéro de ligne a été pris : un numéro neuf, la ligne de l\'autre n\'est pas touchée', async () => {
  const run = setup();
  const entry = await trashed(run, 2);
  run.live().push(row(2, { Nom: 'Prise', Jeton: 'autre' }));
  assert.deepEqual(await run.trash.restore(entry), { name: 'Attestation', renamed: false });
  assert.equal(run.live().find(each => each.id === 2).Nom, 'Prise');
  const back = run.live().find(each => each.Jeton === 'j2');
  assert.deepEqual([back.Nom, back.id > 4], ['Attestation', true]);
  assert.deepEqual(run.bin().rows, []);
});

test('restaurer quand le nom est pris : le premier nom libre, et le gardien le dit pour que la fenêtre l\'annonce', async () => {
  const run = setup();
  const entry = await trashed(run, 2);
  run.live().push(row(9, { Nom: 'attestation', Jeton: 'autre' }));
  assert.deepEqual(await run.trash.restore(entry), { name: 'Attestation (1)', renamed: true });
  assert.equal(run.live().find(each => each.id === 2).Nom, 'Attestation (1)');
});

test('restaurer quand la ligne est déjà revenue (même jeton, par l\'app elle-même) : rien n\'est écrit dans la table de l\'app, l\'entrée quitte la corbeille', async () => {
  const run = setup();
  const entry = await trashed(run, 2);
  run.live().push(row(7, { Nom: 'Rétabli par l\'app', Jeton: 'j2' }));
  assert.deepEqual(await run.trash.restore(entry), { name: 'Rétabli par l\'app', renamed: false });
  assert.deepEqual(run.verbs().at(-1), ['RemoveRecord']);
  assert.deepEqual(run.live().filter(each => each.Jeton === 'j2').map(each => each.id), [7]);
  assert.deepEqual(run.bin().rows, []);
});

test('restaurer le modèle par défaut quand un autre l\'est devenu : il revient sans l\'étoile, jamais deux étoiles', async () => {
  const run = setup();
  const entry = await trashed(run, 1);
  run.live().find(each => each.id === 3).EstParDefaut = true;
  await run.trash.restore(entry);
  assert.deepEqual(run.live().filter(each => each.EstParDefaut).map(each => each.id), [3]);
  const alone = setup();
  const only = await trashed(alone, 1);
  await alone.trash.restore(only);
  assert.deepEqual(alone.live().filter(each => each.EstParDefaut).map(each => each.id), [1], 'personne d\'autre : il reprend son étoile');
});

test('restaurer quand la table de l\'app n\'existe plus, ou quand la copie est abîmée : l\'erreur le dit, l\'entrée reste à la corbeille', async () => {
  const gone = setup();
  const entry = await trashed(gone, 2);
  delete gone.tables.Publipostage_Modeles;
  await assert.rejects(gone.trash.restore(entry), { message: FR.t('trash.tableGone') });
  assert.equal(gone.bin().rows.length, 1);
  const broken = setup();
  const other = await trashed(broken, 2);
  broken.bin().rows[0].Instantane = 'abîmé';
  await assert.rejects(broken.trash.restore(other), { message: FR.t('trash.unreadable') });
  assert.equal(broken.bin().rows.length, 1);
});

test('restaurer sans table de corbeille : null, et la table n\'est pas créée', async () => {
  const run = setup();
  const entry = await trashed(run, 2);
  delete run.tables[BIN_TABLE];
  assert.equal(await run.trash.restore(entry), null);
  assert.equal(BIN_TABLE in run.tables, false);
});

test('supprimer pour de bon : seules les entrées désignées sont retirées, rien dans la table de l\'app ; un fichier restauré entre-temps n\'est pas touché', async () => {
  const run = setup();
  const first = await trashed(run, 2);
  const second = await trashed(run, 3);
  await run.trash.restore(first);
  assert.equal(await run.trash.empty([first, second, second]), 1);
  assert.deepEqual(run.bin().rows, []);
  assert.deepEqual(run.live().map(each => each.id).sort(), [1, 2, 4]);
  assert.equal(await run.trash.empty([second]), 0);
});

test('supprimer pour de bon sans table de corbeille : rien à retirer', async () => {
  const run = setup();
  const { files } = await run.load();
  assert.equal(await run.trash.empty([{ ...files[0], trashed: { ts: 1, by: '' } }]), 0);
  assert.equal(BIN_TABLE in run.tables, false);
});

// ---------- la copie (contrats 2.4 `copie`, 6.3 point 2) ----------

// Copie le fichier `id` de la liste lue ; rend { copy, files } : ce que le gardien dit, et la liste relue ensuite.
async function copied(run, id) {
  const { files } = await run.load();
  const copy = await run.trash.copy(files.find(file => file.id === String(id)));
  return { copy, files: (await run.load()).files };
}

test('copier : une ligne de plus, sous le premier nom libre, sans le jeton ni l\'étoile de l\'original, qui garde tout le reste ; la copie est un fichier comme les autres pour l\'explorateur', async () => {
  const run = setup({ rows: [row(1, { Nom: 'Convocation', EstParDefaut: true, Pieces: ['L', 9] }), row(2, { Nom: 'Convocation (1)' }), row(4, { Nom: '@reglages', TypeModele: 'reglages', Jeton: '' })] });
  const { copy, files } = await copied(run, 1);
  assert.deepEqual(copy, { id: '5', name: 'Convocation (2)' });
  const made = run.live().find(each => each.id === 5);
  assert.deepEqual([made.Nom, made.Contenu, made.TypeModele, made.DateModif, made.EstParDefaut, made.Jeton, made.Pieces], ['Convocation (2)', '<p></p>', 'document', 100, false, '', ['L', 9]]);
  const original = run.live().find(each => each.id === 1);
  assert.deepEqual([original.Nom, original.EstParDefaut, original.Jeton], ['Convocation', true, 'j1'], 'l\'original n\'est pas touché');
  assert.deepEqual(run.verbs(), [['AddRecord']], 'un seul lot, une seule écriture');
  assert.deepEqual(files.map(file => file.key).sort(), ['publipostage:1', 'publipostage:2', 'publipostage:5'], 'l\'explorateur la lit sous la clé que le gardien a rendue');
  assert.equal(BIN_TABLE in run.tables, false, 'copier ne crée aucune table : aucun accord à demander');
  assert.deepEqual(run.asked, []);
});

test('copier : le gardien ne copie que ce que le manifeste dit, et l\'un ne va pas sans l\'autre (une recette de suppression ne dit rien de la copie)', async () => {
  const run = setup();
  const { files } = await run.load();
  assert.deepEqual(files.map(file => run.trash.copies(file)), [true, true, true]);
  assert.equal(run.trash.copies({ ...files[0], table: 'Autre' }), false);
  assert.equal(run.trash.copies({ ...files[0], app: 'automation' }), false);
  const bareForm = form();
  delete bareForm.fichiers[0].copie;
  assert.equal(setup({ over: { apps: () => [{ manifest: bareForm }] } }).trash.copies({ app: 'form', table: 'FormPlus_Formulaires' }), false, 'composite, sans `copie.appel` : pas de recette');
  assert.equal(setup({ over: { apps: () => [{ manifest: form() }] } }).trash.copies({ app: 'form', table: 'FormPlus_Formulaires' }), true, 'Form+ déclare `copie.appel` depuis sa consigne 021 faite (7057309) : c\'est l\'app ouverte qui copie');
  const trashOnly = publipostage();
  delete trashOnly.fichiers[0].copie;
  const half = setup({ over: { apps: () => [{ manifest: trashOnly }] } });
  assert.deepEqual([half.trash.manages(files[0]), half.trash.copies(files[0])], [true, false], 'à la corbeille oui, à copier non : « Dupliquer » est grisé, le clic dit pourquoi');
  assert.equal(await half.trash.copy(files[0]), null, 'rien n\'est écrit sans recette');
  assert.deepEqual(half.verbs(), []);
});

test('copier : la ligne est relue (celle que la personne voyait a pu disparaître) ; une ligne qui n\'est plus là ne se copie pas', async () => {
  const run = setup();
  const { files } = await run.load();
  const first = files.find(file => file.id === '1');
  run.live().splice(0, 1);
  assert.equal(await run.trash.copy(first), null);
  assert.deepEqual(run.verbs(), []);
});

test('copier se fait à la suite des autres gestes : deux copies de suite donnent deux numéros, et une copie faite pendant une mise à la corbeille part de la table que celle-ci a laissée', async () => {
  const run = setup();
  const { files } = await run.load();
  const relance = files.find(file => file.id === '3');
  const results = await Promise.all([run.trash.copy(relance), run.trash.copy(relance), run.trash.trash(relance)]);
  assert.deepEqual([results[0].name, results[1].name, results[2]], ['Relance (1)', 'Relance (2)', true]);
  assert.deepEqual(run.live().map(each => each.Nom), ['Convocation', 'Attestation', '@reglages', 'Relance (1)', 'Relance (2)']);
});

test('copier : sans colonne du nom dans la table, rien n\'est écrit et la raison est dite ; le verrou est celui de la corbeille', async () => {
  const noName = setup({ over: { columnsOf: async () => DATA_COLUMNS.filter(column => column.id !== 'Nom') } });
  const { files } = await noName.load();
  await assert.rejects(noName.trash.copy(files[0]), error => error.message === FR.t('copy.noName'));
  assert.deepEqual(noName.verbs(), []);
  assert.deepEqual(setup({ over: { readonly: () => true } }).trash.lock(), { text: FR.t('trash.readonly') });
});

test('copier : l\'identifiant d\'une copie est celui que l\'explorateur lira (la colonne `id` du manifeste), même quand ce n\'est pas le numéro de ligne', async () => {
  const other = publipostage();
  other.fichiers[0].colonnes.id = 'Jeton';
  other.fichiers[0].copie = { ligne: true, valeurs: { Jeton: 'neuf' } };
  const run = setup({ over: { apps: () => [{ manifest: other }] } });
  const { files } = await loadFiles(run.port, [{ manifest: other }], '');
  assert.equal(files.find(file => file.name === 'Attestation').id, 'j2', 'l\'explorateur désigne le fichier par son jeton');
  const copy = await run.trash.copy(files.find(file => file.name === 'Attestation'));
  assert.deepEqual(copy, { id: 'neuf', name: 'Attestation (1)' });
  assert.equal(run.live().find(each => each.Nom === 'Attestation (1)').Jeton, 'neuf');
});

// Les colonnes de données d'une table, lues dans les tables internes de Grist (`_grist_Tables`, `_grist_Tables_column`).
const internals = () => ({
  _grist_Tables: { id: [1, 2], tableId: ['Publipostage_Modeles', 'Autre'] },
  _grist_Tables_column: {
    id: [1, 2, 3, 4, 5, 6, 7, 8], parentId: [1, 1, 1, 1, 1, 1, 1, 2],
    colId: ['manualSort', 'Nom', 'Pieces', 'Calcul', 'gristHelper_Display', 'Jeton', 'Contenu', 'Nom'],
    type: ['ManualSortPos', 'Text', 'Attachments', 'Text', 'Any', 'Text', 'Text', 'Text'], isFormula: [false, false, false, true, true, false, false, false],
  },
});
const docOf = tables => ({ fetchTable: async name => tables[name] });

test('les colonnes de données : celles de la table, sans les formules, sans la colonne de tri ni les colonnes cachées de Grist ; le nom de la table se lit sans tenir compte de la casse', async () => {
  assert.deepEqual(await dataColumnsOf(docOf(internals()), 'publipostage_modeles'), [{ id: 'Nom', type: 'Text' }, { id: 'Pieces', type: 'Attachments' }, { id: 'Jeton', type: 'Text' }, { id: 'Contenu', type: 'Text' }]);
  assert.deepEqual(await dataColumnsOf(docOf(internals()), 'Inconnue'), []);
});
