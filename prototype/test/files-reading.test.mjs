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
function bench({ data = tables(), broken = null, unreachable = false, access = true, learning = 'moi@exemple.org', apps = [{ manifest, app: { id: 'publipostage' } }] } = {}) {
  const log = [];
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
    rangement: { get learning() { return unreachable ? { then: (ok, fail) => fail(new Error('réseau coupé')) } : state.learning; } },
    reader: null,
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
  };
  return { reading: new FilesReading(x), log, state, gate };
}

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
