// Suivre un dossier partagé « à jour » (js/share-follow.js) : ce que la condition d'un lien devient quand le dossier change, et le suiveur de la page qui ne charge rien tant qu'aucun dossier n'est suivi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFollower, followFolders, planFollow } from '../js/sharing/share-follow.js';
import { FILES_APP, FILES_TABLE, SHARED_FOLDER_COLUMN } from '../js/files/gfs-files.js';
import { fakeGrist } from './fake-grist.mjs';

const file = (id, extra = {}) => ({ app: FILES_APP, id, row: Number(id.slice(1)), name: `${id}.pdf`, folder: 'Contrats', trashed: null, ...extra });
const table = () => ({ columns: ['id', 'Identifiant', 'Nom', 'Type', 'Date', 'Auteur', 'Contenu', 'Taille', 'Origine', 'SupprimeLe', 'SupprimePar'], rows: [1, 2, 3, 4].map(id => ({ id, Identifiant: `p${id}`, Nom: `p${id}.pdf` })) });

test('le plan : un fichier nouveau dans le dossier entre, un fichier parti du dossier sort, un fichier retiré à part n\'est pas rajouté, un fichier déjà dans la condition n\'est pas rajouté', () => {
  assert.deepEqual(planFollow({ current: ['a', 'b', 'c'], previous: ['a', 'b'], inside: ['a', 'b'] }), { add: ['c'], drop: [] });
  assert.deepEqual(planFollow({ current: ['a'], previous: ['a', 'b'], inside: ['a', 'b', 'z'] }), { add: [], drop: ['b'] }, 'z, partagé à côté, reste');
  assert.deepEqual(planFollow({ current: ['a', 'b'], previous: ['a', 'b'], inside: ['a'] }), { add: [], drop: [] }, 'b, retiré à part de la condition, n\'y revient pas tout seul');
  assert.deepEqual(planFollow({ current: ['a', 'c'], previous: ['a'], inside: ['a', 'c'] }), { add: [], drop: [] }, 'c est déjà partagé');
  assert.deepEqual(planFollow({ current: ['a'], previous: ['a', 'b'], inside: ['a'] }), { add: [], drop: [] }, 'b est parti de la condition avant de partir du dossier');
});

function setup({ ids = ['p1', 'p2'], inside = ['p1', 'p2', 'x'], files = [file('p1'), file('p2'), file('p3')], links = null } = {}) {
  const grist = fakeGrist({ [FILES_TABLE]: table() });
  const calls = [];
  const engine = { saveChosenExport: async args => { calls.push(['save', args.selection[0].filter.conds[0].values, JSON.stringify(grist.tables[FILES_TABLE].rows.map(row => row[SHARED_FOLDER_COLUMN] || ''))]); return { changed: [FILES_TABLE] }; }, finishEdit: async () => { calls.push(['finish']); } };
  const memory = [];
  return {
    grist, calls, memory,
    args: {
      followed: [{ link: 'e1', path: 'Contrats', ids }], links: links || [{ id: 'e1', name: 'Compta', files: inside, exp: { id: 'e1' } }], files, engine, docApi: grist.port.doc,
      remember: async (link, path, list) => { memory.push(['remember', link, path, list]); }, forget: async (link, path) => { memory.push(['forget', link, path]); },
    },
  };
}

test('un fichier ajouté au dossier suivi : son nom de dossier est écrit AVANT la condition, la condition le reçoit avec les autres, le passage est retenu', async () => {
  const run = setup();
  const changed = await followFolders(run.args);
  assert.deepEqual(changed, [{ link: 'e1', path: 'Contrats', add: ['p3'], drop: [] }]);
  assert.deepEqual(run.calls, [['save', ['p1', 'p2', 'x', 'p3'], JSON.stringify(['', '', 'Contrats', ''])], ['finish']], 'au moment d\'enregistrer, p3 portait déjà son dossier');
  assert.deepEqual(run.memory, [['remember', 'e1', 'Contrats', ['p1', 'p2', 'p3']]]);
});

test('un fichier qui n\'est plus dans le dossier sort de la condition (la copie reste chez l\'autre), un fichier partagé à côté reste ; la condition ne devient jamais vide (`setCondition` nomme alors un identifiant qui n\'existe pas)', async () => {
  const run = setup({ files: [file('p1'), file('p2', { folder: 'Autre' })] });
  assert.equal((await followFolders(run.args))[0].drop[0], 'p2');
  assert.deepEqual(run.calls[0].slice(0, 2), ['save', ['p1', 'x']]);
  assert.deepEqual(run.memory, [['remember', 'e1', 'Contrats', ['p1']]]);
  assert.deepEqual(run.grist.actions.filter(action => action[0] !== 'AddColumn'), [], 'rien n\'est écrit sur les fichiers qui sortent');
  const last = setup({ ids: ['p1'], inside: ['p1'], files: [file('p9', { folder: 'Contrats' }), file('p1', { folder: 'Ailleurs' })] });
  await followFolders({ ...last.args, followed: [{ link: 'e1', path: 'Contrats', ids: ['p1'] }] });
  assert.ok(last.calls[0][1].includes('p9') && !last.calls[0][1].includes('p1'));
  const nothing = setup({ ids: ['p1'], inside: ['p1'], files: [file('p1', { folder: 'Ailleurs' })] });
  assert.deepEqual(await followFolders(nothing.args), [], 'un dossier sans fichier (vidé ou renommé) ne change rien : le suivi attend');
  assert.deepEqual([nothing.calls, nothing.memory], [[], []]);
});

test('rien à changer : ni condition, ni écriture ; un lien arrêté est oublié ; le dossier retenu suit les fichiers du jour même quand la condition ne bouge pas', async () => {
  const same = setup({ ids: ['p1', 'p2', 'p3'], inside: ['p1', 'p2', 'p3'] });
  assert.deepEqual(await followFolders(same.args), []);
  assert.deepEqual([same.calls, same.memory, same.grist.actions], [[], [], []]);
  const gone = setup({ links: [] });
  assert.deepEqual(await followFolders(gone.args), []);
  assert.deepEqual(gone.memory, [['forget', 'e1', 'Contrats']]);
  const apart = setup({ ids: ['p1', 'p2'], inside: ['p1', 'p2', 'p3'], files: [file('p1'), file('p2'), file('p3')] });
  assert.deepEqual(await followFolders(apart.args), [], 'p3 est déjà dans la condition : rien à changer');
  assert.deepEqual(apart.memory, [['remember', 'e1', 'Contrats', ['p1', 'p2', 'p3']]], 'mais le passage est retenu : p3 n\'est plus « nouveau »');
  assert.deepEqual(apart.calls, []);
});

test('le suiveur de la page : sans dossier suivi, sans la preuve d\'être propriétaire ou document en lecture seule, le moteur ne se charge pas ; un passage demandé pendant un autre est refait juste après', async () => {
  const log = [];
  const make = ({ followed = [{ link: 'e1', path: 'Contrats', ids: ['p1'] }], owner = true, block = null } = {}) => createFollower({
    rangement: { followed: async () => followed, follow: async () => true, unfollow: async () => 0 }, writeBlock: () => block, isOwner: async () => owner,
    engine: async () => { log.push('engine'); return { readLinks: async () => { log.push('links'); return []; } }; }, docApi: () => null,
  });
  await make({ followed: [] })([]);
  await make({ owner: null })([]);
  await make({ owner: false })([]);
  await make({ block: 'lecture seule' })([]);
  assert.deepEqual(log, [], 'aucun moteur chargé');
  await make()([]);
  assert.deepEqual(log, ['engine', 'links']);
  let release = () => {};
  const waiting = new Promise(resolve => { release = resolve; });
  let passes = 0;
  const slow = createFollower({
    rangement: { followed: async () => { passes += 1; if (passes === 1) await waiting; return []; }, follow: async () => true, unfollow: async () => 0 }, writeBlock: () => null, isOwner: async () => true, engine: async () => ({}), docApi: () => null,
  });
  const first = slow([file('p1')]);
  await slow([file('p1'), file('p2')]);
  release();
  await first;
  assert.equal(passes, 2, 'une lecture qui arrive pendant un passage en demande un autre, un seul');
});

test('une erreur du suivi ne remonte pas à la page : un avertissement, le passage suivant réessaie', async () => {
  const warnings = [];
  const original = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    const follower = createFollower({ rangement: { followed: async () => { throw new Error('table illisible'); } }, writeBlock: () => null, isOwner: async () => true, engine: async () => ({}), docApi: () => null });
    assert.deepEqual(await follower([]), []);
    assert.equal(warnings.length, 1);
  } finally { console.warn = original; }
});
