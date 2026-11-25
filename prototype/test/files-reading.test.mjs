// La lecture des fichiers du contrôleur et ce qu'elle dit sous la liste (js/explorer/files-reading.js) : le sens de chaque issue, l'attente de l'adresse de la personne
// et la phrase redite dans la langue qui vaut. La garde de séquence est celle de file-refresh.test.mjs ; ce que Grist rend vraiment se mesure dans le labo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FilesReading } from '../js/explorer/files-reading.js';
import { publipostage } from './helpers.mjs';

const manifest = publipostage();
const spec = manifest.fichiers[0];

const tables = () => ({ [spec.table]: { id: [1], Nom: ['Convocation'], TypeModele: [''], DateModif: [0], ModifiePar: [''] } });

// Un banc : un port de doublure, l'explorateur et ses voisins qui notent ce qu'on leur dit.
function bench({ data = tables(), broken = null, unreachable = false, access = true, learning = 'moi@exemple.org', apps = [{ manifest, app: { id: 'publipostage' } }], pending = null, hint = null, guard = null } = {}) { // `pending` : (log) => les gestes affichés d'avance, ou rien
  const log = [];
  const notes = []; // ce que la lecture dit du nom de la table du rangement
  const bins = []; // et de celle de la corbeille
  const state = { access, learning, lang: 'fr' };
  // Tant que `hold` est vrai, toute lecture du document attend `release()` : le temps de regarder ce que la lecture dit en route.
  let pass;
  const held = new Promise(resolve => { pass = resolve; });
  const gate = { hold: false, release: () => pass() };
  const wait = () => (gate.hold ? held : null);
  const x = {
    port: { doc: {
      listTables: async () => { await wait(); return Object.keys(data); },
      fetchTable: async name => { await wait(); if (name === broken) throw new Error('accès refusé'); return data[name]; },
    } },
    apps: () => apps,
    fullAccess: () => state.access,
    rangement: { get learning() { return unreachable ? { then: (ok, fail) => fail(new Error('réseau coupé')) } : state.learning; }, note: id => notes.push(id) },
    pending: pending && pending(log),
    reader: hint ? { marker: 'lecture légère', isActive: () => false, learn: () => {} } : null,
    hint: hint && hint(log),
    guard,
    explorer: () => ({
      setFiles: (...args) => log.push(['setFiles', args[0].length, (args[1] || []).length]),
      setStatus: status => log.push(['setStatus', status]),
    }),
    openedBar: () => ({ sync: () => log.push(['sync']) }),
    appName: id => `App ${id}`,
    t: (key, vars) => `${state.lang}:${key}${vars && vars.app ? `:${vars.app}` : ''}${vars && vars.reason ? `:${vars.reason}` : ''}`,
    onSpaces: spaces => log.push(['spaces', spaces ? 'oui' : 'non']),
    onFiles: files => log.push(['files', files.length]),
    onStats: stats => log.push(['stats', typeof stats]),
    noteBin: id => bins.push(id),
  };
  return { reading: new FilesReading(x), log, state, gate, notes, bins };
}

// Le souvenir d'un document lourd (js/explorer/heavy-hint.js) : la lecture le consulte avant de lire, et lui dit ce qu'elle a compté après.
const hinting = ({ order = [] } = {}) => log => ({
  prime: async reader => { log.push(['prime', reader.marker]); order.push('prime'); },
  note: bytes => log.push(['note', typeof bytes]),
});

const statuses = log => log.filter(entry => entry[0] === 'setStatus').map(entry => entry[1]);

test('sans l\'accès complet : la liste se vide et dit pourquoi, sans rien lire', async () => {
  const b = bench({ access: false });
  await b.reading.refresh();
  assert.deepEqual(b.log, [['setFiles', 0, 0], ['setStatus', { loading: false, restricted: true, problems: ['fr:gfs.needsFullAccess'] }]]);
});

test('une lecture réussie : « chargement » d\'abord, puis la liste, la suite donnée au contrôleur et la barre des ouverts mise à jour', async () => {
  const b = bench();
  await b.reading.refresh();
  assert.deepEqual(statuses(b.log), [{ loading: true, restricted: false, problems: [] }, { loading: false, restricted: false, problems: [] }]);
  const order = b.log.map(entry => entry[0]);
  assert.deepEqual(order, ['setStatus', 'spaces', 'setFiles', 'files', 'sync', 'setStatus', 'stats'], 'l\'ordre des gestes d\'une lecture réussie');
  assert.deepEqual(b.log.find(entry => entry[0] === 'files'), ['files', 1]);
});

test('une app qu\'on n\'a pas pu lire : la liste se montre, et la phrase nomme l\'app et la raison', async () => {
  const b = bench({ broken: spec.table });
  await b.reading.refresh();
  const last = statuses(b.log).pop();
  assert.equal(last.problems.length, 1);
  assert.match(last.problems[0], /^fr:ex\.readFailed:App publipostage:/);
});

test('une table que le garde-fou retient (Grist a coupé sa lecture plusieurs fois de suite) : la liste se montre, la phrase dit que les fichiers de l\'app manquent et que GFS réessaiera', async () => {
  const asked = [];
  const held = Object.assign(new Error('la lecture de la table a été interrompue 3 fois de suite'), { held: true });
  const guard = { run: async (table, read) => { asked.push(table); if (table === spec.table) throw held; return read(); } };
  const b = bench({ guard, hint: hinting() });
  await b.reading.refresh();
  assert.ok(asked.includes(spec.table), 'la lecture des fichiers passe par le garde-fou');
  const last = statuses(b.log).pop();
  assert.deepEqual(last.problems, ['fr:ex.readHeld:App publipostage:la lecture de la table a été interrompue 3 fois de suite']);
  assert.deepEqual(b.log.find(entry => entry[0] === 'setFiles'), ['setFiles', 0, 0]);
  assert.equal(b.log.some(entry => entry[0] === 'note'), false, 'le poids de cette app manque : le souvenir n\'est pas mis à jour');
});

test('une lecture qui échoue : la phrase le dit avec la raison, et la console l\'enregistre', async () => {
  const b = bench({ unreachable: true });
  const original = console.error;
  const seen = [];
  console.error = (...args) => seen.push(args[0]);
  try { await b.reading.refresh(); } finally { console.error = original; }
  assert.deepEqual(seen, ['GFS : lecture des fichiers impossible']);
  assert.deepEqual(statuses(b.log).pop(), { loading: false, restricted: false, problems: ['fr:gfs.loadFailed:réseau coupé'] });
});

test('l\'adresse de la personne s\'apprend encore : la lecture le sait tant qu\'elle dure, et plus après', async () => {
  const b = bench({ learning: null });
  assert.equal(b.reading.waitingForIdentity, false, 'rien n\'a été lancé');
  b.gate.hold = true;
  const done = b.reading.refresh();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(b.reading.waitingForIdentity, true, 'une lecture sans adresse est en cours : la relancer jetterait ce qu\'elle lit');
  b.gate.release();
  await done;
  assert.equal(b.reading.waitingForIdentity, false, 'la lecture est finie');
});

test('une lecture qui connaît déjà l\'adresse n\'attend rien : on peut la relancer', async () => {
  const b = bench({ learning: 'moi@exemple.org' });
  b.gate.hold = true;
  const done = b.reading.refresh();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(b.reading.waitingForIdentity, false);
  b.gate.release();
  await done;
});

test('`show` redit la dernière phrase dans la langue qui vaut maintenant, sans relire', async () => {
  const b = bench({ access: false });
  await b.reading.refresh();
  b.state.lang = 'en';
  b.reading.show();
  assert.deepEqual(statuses(b.log).pop(), { loading: false, restricted: true, problems: ['en:gfs.needsFullAccess'] });
});

// La table du rangement telle que `fetchTable` la rend : les colonnes que GFS lit, sans une ligne.
const rangementTable = () => ({ id: [], Utilisateur: [], App: [], Fichier: [], Favori: [], Dossier: [], Valeur: [] });

test('la lecture dit au rangement le nom que le document donne à sa table (ou qu\'elle manque) : un geste de rangement le sait sans la relire', async () => {
  const without = bench();
  await without.reading.refresh();
  assert.deepEqual(without.notes, [null]);
  const withTable = bench({ data: { ...tables(), gfs_rangement: rangementTable() } });
  await withTable.reading.refresh();
  assert.deepEqual(withTable.notes, ['gfs_rangement']);
});

test('la lecture dit aussi le nom que le document donne à la table de la corbeille (ou qu\'elle manque) : mettre un fichier à la corbeille le sait sans la relire', async () => {
  const without = bench();
  await without.reading.refresh();
  assert.deepEqual(without.bins, [null]);
  const withBin = bench({ data: { ...tables(), GFS_Corbeille: { id: [] } } });
  await withBin.reading.refresh();
  assert.deepEqual(withBin.bins, ['GFS_Corbeille']);
});

test('les gestes affichés d\'avance : la lecture note, au départ, ce qui était confirmé, et le retire avant que la liste lue ne soit posée', async () => {
  const b = bench({ pending: log => ({ stamp: () => 7, retire: stamp => log.push(['retire', stamp]) }) });
  await b.reading.refresh({ quiet: true });
  assert.deepEqual(b.log.map(entry => entry[0]).slice(0, 3), ['spaces', 'retire', 'setFiles'], 'une lecture discrète ne dit pas « chargement »');
  assert.deepEqual(b.log.find(entry => entry[0] === 'retire'), ['retire', 7]);
  const loud = bench({ pending: () => ({ stamp: () => 0, retire: () => {} }) });
  await loud.reading.refresh();
  assert.equal(statuses(loud.log)[0].loading, true, 'une lecture ordinaire dit toujours « chargement »');
});

test('le souvenir d\'un document lourd est consulté avant la première lecture, avec la lecture légère ; ce que la lecture a compté lui est dit ensuite', async () => {
  const b = bench({ hint: hinting() });
  await b.reading.refresh();
  const order = b.log.map(entry => entry[0]);
  assert.ok(order.indexOf('prime') >= 0 && order.indexOf('prime') < order.indexOf('setFiles'), order.join(' > '));
  assert.deepEqual(b.log.find(entry => entry[0] === 'prime'), ['prime', 'lecture légère']);
  assert.deepEqual(b.log.find(entry => entry[0] === 'note'), ['note', 'number']);
  assert.ok(order.indexOf('note') > order.indexOf('setFiles'));
});

test('une app qu\'on n\'a pas pu lire : son poids manque, le souvenir n\'est pas mis à jour (il dirait « léger » à tort)', async () => {
  const b = bench({ broken: spec.table, hint: hinting() });
  await b.reading.refresh();
  assert.equal(b.log.some(entry => entry[0] === 'note'), false);
});

// La relecture automatique (js/explorer/live-list.js) : une lecture silencieuse qui ne trouve rien de changé ne redessine rien ; une qui trouve un changement le pose.
test('relecture automatique : la même liste ne redessine rien, un renommage la redessine, un échec se tait', async () => {
  const data = tables();
  const b = bench({ data });
  await b.reading.refresh();
  b.log.length = 0;
  await b.reading.refresh({ quiet: true, live: true });
  assert.deepEqual(b.log, [['stats', 'object']], 'rien de changé : ni la liste, ni l\'état sous la liste, ni la barre des ouverts');
  data[spec.table].Nom = ['Convocation renommée'];
  await b.reading.refresh({ quiet: true, live: true });
  assert.ok(b.log.some(entry => entry[0] === 'setFiles'), 'un renommage fait par quelqu\'un d\'autre se voit');
  assert.deepEqual(statuses(b.log), [{ loading: false, restricted: false, problems: [] }], 'sans « Lecture des fichiers… » : la lecture est silencieuse');
  b.log.length = 0;
  data[spec.table].Nom = ['Convocation renommée'];
  await b.reading.refresh({ quiet: true, live: true });
  assert.deepEqual(b.log, [['stats', 'object']]);
});

test('relecture automatique : un geste de rangement affiché d\'avance est retiré par la lecture, même quand la liste ne change pas', async () => {
  const pend = { size: 0, retired: [] };
  const b = bench({ pending: () => ({ get size() { return pend.size; }, stamp: () => 3, retire: stamp => pend.retired.push(stamp), apply: lists => lists }) });
  await b.reading.refresh();
  pend.retired.length = 0;
  pend.size = 1;
  await b.reading.refresh({ quiet: true, live: true });
  assert.deepEqual(pend.retired, [3], 'sans cela, le geste resterait posé sur la liste');
});

test('relecture automatique qui échoue : aucune phrase d\'erreur sous la liste, un avertissement en console (la suivante réessaiera)', async () => {
  const b = bench({ unreachable: true });
  const error = console.error;
  const warn = console.warn;
  const seen = { error: [], warn: [] };
  console.error = (...args) => seen.error.push(args[0]);
  console.warn = (...args) => seen.warn.push(args[0]);
  try { await b.reading.refresh({ quiet: true, live: true }); } finally { console.error = error; console.warn = warn; }
  assert.deepEqual(seen.error, []);
  assert.deepEqual(seen.warn, ['GFS : la relecture automatique des fichiers a échoué']);
  assert.deepEqual(statuses(b.log), [], 'rien n\'est dit à la personne pour une lecture qu\'elle n\'a pas demandée');
});

test('`loading` : vrai pendant une lecture qui dit « Lecture des fichiers… », faux pendant une silencieuse', async () => {
  const b = bench();
  b.gate.hold = true;
  const first = b.reading.refresh();
  assert.equal(b.reading.loading, true);
  b.gate.release();
  await first;
  assert.equal(b.reading.loading, false);
});
