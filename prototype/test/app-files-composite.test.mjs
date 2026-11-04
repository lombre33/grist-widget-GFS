// Un fichier qui tient à plus qu'une ligne (js/app-files.js, contrats 2.4 `appel`, 5.4 points 10 et 11) : un formulaire de Form+ et son lien public. GFS demande à l'app ouverte de le fermer (`supprimer`) avant
// de retirer la ligne, ou de le copier (`dupliquer`) ; seule l'app ouverte répond. Un faux Grist (test/fake-grist.mjs) et une app de doublure ; ce que Grist rend vraiment et la vraie question de l'accord se mesurent
// dans le labo (labo/run-composite.mjs, avec une app d'essai qui répond comme le fera Form+).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppFiles } from '../js/app-files.js';
import { loadFiles } from '../js/explorer-data.js';
import { BIN_TABLE } from '../js/gfs-trash.js';
import { createI18n } from '../js/i18n.js';
import { fakeGrist } from './fake-grist.mjs';
import { form } from './helpers.mjs';

const FR = createI18n('fr');
const COLUMNS = [['Nom', 'Text'], ['TypeFormulaire', 'Text'], ['DateModif', 'DateTime'], ['ModifiePar', 'Text'], ['Definition', 'Text'], ['IdSectionWidget', 'Numeric']].map(([id, type]) => ({ id, type }));
const rows = () => [
  { id: 1, Nom: 'Inscription atelier', TypeFormulaire: 'formulaire', DateModif: 100, ModifiePar: '', Definition: '{"vsId":7}', IdSectionWidget: 3 },
  { id: 2, Nom: 'Inscription atelier (1)', TypeFormulaire: 'formulaire', DateModif: 200, ModifiePar: '', Definition: '{"vsId":8}', IdSectionWidget: 4 },
  { id: 3, Nom: 'Enquête', TypeFormulaire: 'formulaire', DateModif: 300, ModifiePar: '', Definition: '{"vsId":9}', IdSectionWidget: 5 },
];
// Le manifeste de Form+ tel que GFS le lira quand l'app répondra aux deux appels (le dépôt ne le dit pas encore : il ne bouge qu'avec la réponse de l'app).
const composite = () => { const manifest = form(); manifest.fichiers[0].suppression = { ligne: true, appel: true }; manifest.fichiers[0].copie = { appel: true }; return manifest; };

function setup({ ready = true, reply = async () => ({ fait: true }), consent = async () => true, over = {} } = {}) {
  const fake = fakeGrist({ FormPlus_Formulaires: { columns: ['id', ...COLUMNS.map(column => column.id)], rows: rows() } });
  const log = { order: [], calls: [] };
  const state = { ready };
  const files = new AppFiles({
    port: fake.port, apps: () => [{ manifest: composite() }], consent: async () => { log.order.push('accord'); return consent(); }, identity: () => 'paul@exemple.fr', now: () => 1762000000000,
    readonly: () => false, fullAccess: () => true, t: FR.t, columnsOf: async () => COLUMNS, appReady: () => state.ready, appName: () => 'Form+',
    appCall: async (app, name, body) => { log.order.push(name); log.calls.push([app, name, body]); return reply(body); }, ...over,
  });
  const load = async () => (await loadFiles(fake.port, [{ manifest: composite() }], '')).files;
  const fileOf = async id => (await load()).find(each => each.id === String(id));
  return { ...fake, files, log, state, load, fileOf, live: () => fake.tables.FormPlus_Formulaires.rows, verbs: () => fake.batches.map(batch => batch.map(action => action[0])) };
}

test('le gardien gère et copie un formulaire quand le manifeste le dit (`appel`) ; sans `ligne`, la copie n\'en a pas besoin', async () => {
  const run = setup();
  const file = await run.fileOf(1);
  assert.deepEqual([run.files.manages(file), run.files.copies(file)], [true, true]);
  assert.equal(file.type, 'formulaire');
});

test('l\'app n\'est pas ouverte : « mettre à la corbeille » et « dupliquer » le disent (le clic, et l\'article grisé), « restaurer » et « supprimer pour de bon » n\'ont pas besoin d\'elle', async () => {
  const run = setup({ ready: false });
  const file = await run.fileOf(1);
  assert.deepEqual(run.files.waitsForApp(file, 'trash'), { text: FR.t('trash.openApp', { app: 'Form+' }) });
  assert.deepEqual(run.files.waitsForApp(file, 'copy'), { text: FR.t('copy.openApp', { app: 'Form+' }) });
  assert.deepEqual(run.files.lock(file, 'trash'), { text: FR.t('trash.openApp', { app: 'Form+' }) });
  assert.equal(run.files.lock(file, undefined), null, 'restaurer, supprimer pour de bon : aucun geste n\'est nommé');
  assert.equal(run.files.lock(), null, 'vider la corbeille : pas de fichier');
  run.state.ready = true;
  assert.deepEqual([run.files.waitsForApp(file, 'trash'), run.files.waitsForApp(file, 'copy'), run.files.lock(file, 'trash')], [null, null, null]);
  const readonly = setup({ ready: false, over: { readonly: () => true } });
  assert.deepEqual(readonly.files.lock(await readonly.fileOf(1), 'trash'), { text: FR.t('trash.readonly') }, 'le document en lecture seule passe devant');
});

test('un fichier dont la recette n\'a pas `appel` n\'attend jamais l\'app, ouverte ou non (Publipostage+ : une ligne suffit)', async () => {
  const lineOnly = form();
  lineOnly.fichiers[0].suppression = { ligne: true };
  lineOnly.fichiers[0].copie = { ligne: true };
  const run = setup({ ready: false, over: { apps: () => [{ manifest: lineOnly }] } });
  const file = await run.fileOf(1);
  assert.deepEqual([run.files.waitsForApp(file, 'trash'), run.files.waitsForApp(file, 'copy')], [null, null]);
  assert.equal(run.files.waitsForApp({ app: 'inconnue', table: 'X' }, 'trash'), null);
});

test('mettre à la corbeille : l\'accord de la table d\'abord, puis l\'app ferme ce qui est lié, puis UN SEUL lot copie la ligne dans GFS_Corbeille et la retire ; l\'app reçoit le fichier et la raison', async () => {
  const run = setup();
  assert.equal(await run.files.trash(await run.fileOf(1)), true);
  assert.deepEqual(run.log.order, ['accord', 'supprimer'], 'un lien n\'est jamais fermé pour un fichier que GFS ne pourrait pas mettre à la corbeille');
  assert.deepEqual(run.log.calls, [['form', 'supprimer', { fichier: { id: '1', type: 'formulaire' }, raison: 'corbeille' }]]);
  assert.deepEqual(run.verbs(), [['AddTable'], ['AddRecord', 'RemoveRecord']]);
  assert.deepEqual(run.live().map(each => each.id), [2, 3]);
  const [stored] = run.tables[BIN_TABLE].rows;
  assert.deepEqual([stored.App, stored.Table, stored.FichierId, stored.Nom], ['form', 'FormPlus_Formulaires', '1', 'Inscription atelier']);
  assert.equal(JSON.parse(stored.Instantane).valeurs.Definition, '{"vsId":7}', 'la définition est gardée, pour la restauration');
});

test('l\'app ajoute sa phrase (`dit`) : GFS la rend, sur une ligne et coupée à 200 signes ; sans phrase, c\'est `true`', async () => {
  const long = `Son lien   public\nest fermé. ${'x'.repeat(300)}`;
  const run = setup({ reply: async () => ({ fait: true, dit: long }) });
  const done = await run.files.trash(await run.fileOf(1));
  assert.equal(done.said.length, 200);
  assert.equal(done.said.startsWith('Son lien public est fermé. xxx'), true);
  assert.equal(await setup({ reply: async () => ({ fait: true, dit: 3 }) }).files.trash(await run.fileOf(2)), true, 'une phrase qui n\'en est pas une est ignorée');
});

test('sans l\'accord de la table, l\'app n\'est pas appelée et rien n\'est écrit : le lien n\'est pas fermé pour rien', async () => {
  const run = setup({ consent: async () => false });
  await assert.rejects(run.files.trash(await run.fileOf(1)), { message: FR.t('trash.table.declined'), expected: true });
  assert.deepEqual([run.log.calls, run.verbs(), run.live().length], [[], [], 3]);
});

test('l\'app ne ferme pas le fichier (`fait: false`, ou pas de `fait`) : rien n\'est mis à la corbeille, sa phrase est rendue', async () => {
  const refused = setup({ reply: async () => ({ fait: false, dit: 'Ce formulaire est en cours de publication.' }) });
  assert.deepEqual(await refused.files.trash(await refused.fileOf(1)), { declined: 'Ce formulaire est en cours de publication.' });
  assert.deepEqual([refused.live().length, refused.tables[BIN_TABLE].rows.length, refused.verbs()], [3, 0, [['AddTable']]], 'la table est née (l\'accord est donné), mais la ligne est restée');
  const silent = setup({ reply: async () => ({}) });
  assert.deepEqual(await silent.files.trash(await silent.fileOf(1)), { declined: '' }, 'une réponse sans `fait: true` n\'est pas un oui');
});

test('les refus de l\'app se disent en mots et n\'écrivent rien : appel inconnu, app partie, app muette (le délai), réponse illisible ; une autre erreur est celle de l\'app', async () => {
  const fail = (code, message = 'x') => async () => { throw Object.assign(new Error(message), { code }); };
  for (const [reply, expected] of [[fail('GFS_INCONNU'), FR.t('app.unknown', { app: 'Form+' })], [fail('GFS_INACTIF'), FR.t('app.gone', { app: 'Form+' })]]) {
    const run = setup({ reply });
    await assert.rejects(run.files.trash(await run.fileOf(1)), error => error.message === expected && error.expected === true);
    assert.equal(run.live().length, 3);
    assert.equal(run.tables[BIN_TABLE].rows.length, 0);
  }
  const mute = setup({ reply: () => new Promise(() => {}), over: { patience: 5 } });
  await assert.rejects(mute.files.trash(await mute.fileOf(1)), error => error.message === FR.t('app.silent', { app: 'Form+' }) && error.expected === true);
  assert.equal(mute.live().length, 3);
  const unreadable = setup({ reply: async () => null });
  await assert.rejects(unreadable.files.trash(await unreadable.fileOf(1)), { message: FR.t('app.unreadable', { app: 'Form+' }) });
  const own = setup({ reply: fail('GFS_ERREUR', 'Grist a refusé de fermer le lien.') });
  await assert.rejects(own.files.trash(await own.fileOf(1)), error => error.message === 'Grist a refusé de fermer le lien.' && error.expected !== true);
  assert.equal(own.live().length, 3);
});

test('l\'app s\'est fermée entre le clic et l\'appel : « ouvre l\'app », sans appel ; la ligne est relue après la réponse de l\'app (retirée entre-temps : rien n\'est écrit)', async () => {
  const run = setup({ ready: false });
  await assert.rejects(run.files.trash(await run.fileOf(1)), error => error.message === FR.t('trash.openApp', { app: 'Form+' }) && error.expected === true);
  assert.deepEqual(run.log.calls, []);
  const gone = setup({ reply: async () => { gone.live().splice(0, 1); return { fait: true }; } });
  assert.equal(await gone.files.trash(await gone.fileOf(1)), false, 'la ligne a disparu pendant l\'appel : « n\'est plus dans le document »');
  assert.equal(gone.tables[BIN_TABLE].rows.length, 0);
});

test('dupliquer : l\'app reçoit le fichier et le premier nom libre, copie elle-même ; GFS n\'écrit rien, il rend l\'identifiant que l\'app a donné (un nombre devient un texte) et sa phrase', async () => {
  const run = setup({ reply: async () => ({ id: 9, nom: 'Inscription atelier (2) !', dit: 'Elle n\'est pas publiée.' }) });
  assert.deepEqual(await run.files.copy(await run.fileOf(1)), { id: '9', name: 'Inscription atelier (2) !', said: 'Elle n\'est pas publiée.' });
  assert.deepEqual(run.log.calls, [['form', 'dupliquer', { fichier: { id: '1', type: 'formulaire' }, nom: 'Inscription atelier (2)' }]], '« (1) » est pris : le nom donné est « (2) »');
  assert.deepEqual(run.verbs(), [], 'GFS n\'écrit rien : c\'est l\'app qui copie');
  const plain = setup({ reply: async () => ({ id: '11' }) });
  assert.deepEqual(await plain.files.copy(await plain.fileOf(3)), { id: '11', name: 'Enquête (1)', said: '' }, 'sans nom de l\'app, le nom que GFS a donné');
});

test('dupliquer : l\'app n\'a rien copié (`id` absent, nul ou vide) : sa phrase est rendue, rien n\'est rangé ; app fermée, inconnue ou muette : le refus se dit', async () => {
  for (const reply of [{ id: null, dit: 'Il faut un titre.' }, { dit: 'Il faut un titre.' }, { id: '  ', dit: 'Il faut un titre.' }]) {
    const run = setup({ reply: async () => reply });
    assert.deepEqual(await run.files.copy(await run.fileOf(1)), { declined: 'Il faut un titre.' });
  }
  const closed = setup({ ready: false });
  await assert.rejects(closed.files.copy(await closed.fileOf(1)), error => error.message === FR.t('copy.openApp', { app: 'Form+' }) && error.expected === true);
  const unknown = setup({ reply: async () => { throw Object.assign(new Error('x'), { code: 'GFS_INCONNU' }); } });
  await assert.rejects(unknown.files.copy(await unknown.fileOf(1)), { message: FR.t('app.unknown', { app: 'Form+' }) });
  const mute = setup({ reply: () => new Promise(() => {}), over: { patience: 5 } });
  await assert.rejects(mute.files.copy(await mute.fileOf(1)), { message: FR.t('app.silent', { app: 'Form+' }) });
  assert.equal(await setup().files.copy({ ...(await setup().fileOf(1)), id: '99' }), null, 'un fichier qui n\'est plus là ne se copie pas, et l\'app n\'est pas appelée');
});
