// L'identité d'un dossier de « Moi » (js/sharing/folder-identity.js, contrats 11.7, point 13.n.g) : le partage et le lien portent le numéro de la ligne d'état du
// dossier, donc renommer ou déplacer le dossier ne les perd plus. Du code pur ; ce que Grist en fait vraiment se mesure dans le labo (run-renommer-dossier.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idKey, keysOf, legacyPath, legacyPaths, relocationExtra, removalExtra } from '../js/sharing/folder-identity.js';
import { FolderShares } from '../js/sharing/folder-shares.js';
import { PLACE_TABLE, SHARES_TABLE, personalTarget } from '../js/sharing/sharing-model.js';

const ME = 'Marie@Exemple.fr';
const share = (id, Target, extra = {}) => ({ id, Target, Person: 'luc@exemple.fr', Right: 'lecture', ...extra });
const link = (id, Link) => ({ id, Target: '', Space: 'ventes', Folder: 'Lien', Link });
const rows = [{ id: 11, path: 'Docs' }, { id: 12, path: 'Docs/Factures' }, { id: 13, path: 'Autre' }];

test('la cible par numéro : l\'adresse en minuscules, deux « / » de suite ; elle n\'est jamais un chemin, et un chemin n\'est jamais elle', () => {
  assert.equal(idKey(ME, 12), 'dossier:moi:marie@exemple.fr//12');
  assert.equal(legacyPath(idKey(ME, 12), ME), null, 'un numéro n\'est pas un chemin (même un dossier qui s\'appellerait « #12 »)');
  assert.equal(legacyPath(personalTarget(ME, ' Docs / #12 '), ME), 'Docs/#12');
  assert.equal(legacyPath(personalTarget('luc@exemple.fr', 'Docs'), ME), null, 'le dossier d\'une autre personne n\'est pas le sien');
  assert.equal(legacyPath('dossier:ventes/Docs', ME), null);
  assert.equal(legacyPath(personalTarget(ME, 'Docs'), ''), null, 'sans adresse connue, rien');
});

test('keysOf : un dossier se désigne par son chemin d\'avant et par chacune de ses lignes d\'état', () => {
  assert.deepEqual(keysOf(ME, 'Docs', rows), [personalTarget(ME, 'Docs'), idKey(ME, 11)]);
  assert.deepEqual(keysOf(ME, 'Sans', rows), [personalTarget(ME, 'Sans')], 'sans ligne : le chemin seul');
  assert.deepEqual(keysOf(ME, 'Docs', [...rows, { id: 20, path: 'Docs' }]), [personalTarget(ME, 'Docs'), idKey(ME, 11), idKey(ME, 20)]);
});

test('legacyPaths : les dossiers qui existent, dans le dossier déplacé, dont un partage ou un lien porte encore le chemin ; ni un numéro, ni un autre, ni un chemin disparu', () => {
  const shares = [share(1, personalTarget(ME, 'Docs')), share(2, personalTarget(ME, 'Docs/Factures')), share(3, idKey(ME, 13)), share(4, personalTarget(ME, 'Autre')),
    share(5, personalTarget(ME, 'Docs/Disparu')), share(6, personalTarget('luc@exemple.fr', 'Docs'))];
  const places = [link(1, personalTarget(ME, 'Docs/Factures'))];
  const known = ['Docs', 'Docs/Factures', 'Autre'];
  assert.deepEqual(legacyPaths({ identity: ME, from: 'Docs', known, shares, places }), ['Docs', 'Docs/Factures']);
  assert.deepEqual(legacyPaths({ identity: ME, from: 'Docs/Factures', known, shares, places }), ['Docs/Factures']);
  assert.deepEqual(legacyPaths({ identity: ME, from: 'Rien', known, shares, places }), []);
});

test('renommer : un partage à l\'ancienne mode passe au numéro de la ligne d\'état de son dossier ; celui qui porte déjà un numéro, et ceux d\'ailleurs, ne bougent pas', () => {
  const shares = [share(1, personalTarget(ME, 'Docs')), share(2, personalTarget(ME, 'Docs/Factures')), share(3, idKey(ME, 11)), share(4, personalTarget(ME, 'Autre')),
    share(5, personalTarget('luc@exemple.fr', 'Docs'))];
  const out = relocationExtra({ identity: ME, rows, from: 'Docs', to: 'Papiers', shares });
  assert.deepEqual(out, { refuse: null, lost: 0, extra: [['UpdateRecord', SHARES_TABLE, 1, { Target: idKey(ME, 11) }], ['UpdateRecord', SHARES_TABLE, 2, { Target: idKey(ME, 12) }]] });
});

test('un dossier qui se fond dans un dossier qui existe déjà : il prend les partages du dossier d\'arrivée, les siens (par numéro ou par chemin) sont retirés et comptés', () => {
  const fusedRows = [...rows, { id: 14, path: 'Papiers' }, { id: 15, path: 'Papiers/Factures' }];
  const known = ['Docs', 'Docs/Factures', 'Autre', 'Papiers', 'Papiers/Factures'];
  const shares = [share(1, idKey(ME, 11)), share(2, personalTarget(ME, 'Docs/Factures')), share(3, idKey(ME, 14)), share(4, idKey(ME, 13))];
  const out = relocationExtra({ identity: ME, rows: fusedRows, from: 'Docs', to: 'Papiers', known, shares });
  assert.deepEqual(out.extra, [['RemoveRecord', SHARES_TABLE, 1], ['RemoveRecord', SHARES_TABLE, 2]]);
  assert.equal(out.lost, 2);
  const moved = relocationExtra({ identity: ME, rows: fusedRows, from: 'Autre', to: 'Neuf', known, shares });
  assert.deepEqual([moved.extra, moved.lost], [[], 0], 'sans fusion, le partage par numéro suit sans rien écrire');
});

test('le dossier d\'arrivée existe par ses fichiers, sans ligne d\'état : c\'est une fusion aussi (le dossier qui arrive ne rend pas lisibles des fichiers qui ne l\'étaient pas)', () => {
  const shares = [share(1, idKey(ME, 11)), share(2, idKey(ME, 12))];
  const out = relocationExtra({ identity: ME, rows, from: 'Docs', to: 'Papiers', known: ['Docs', 'Docs/Factures', 'Papiers'], shares });
  assert.deepEqual([out.extra, out.lost], [[['RemoveRecord', SHARES_TABLE, 1]], 1], 'seul « Docs » arrive sur un dossier qui existe ; « Docs/Factures » devient « Papiers/Factures », nouveau');
});

test('un lien : il passe au numéro quand la personne est propriétaire ; sinon (ou si le dossier se fond dans un autre) le geste est refusé, rien n\'est écrit', () => {
  const places = [link(5, personalTarget(ME, 'Docs'))];
  const shares = [share(1, personalTarget(ME, 'Docs'))];
  assert.deepEqual(relocationExtra({ identity: ME, rows, from: 'Docs', to: 'Papiers', shares, places, owner: true }).extra,
    [['UpdateRecord', SHARES_TABLE, 1, { Target: idKey(ME, 11) }], ['UpdateRecord', PLACE_TABLE, 5, { Link: idKey(ME, 11) }]]);
  assert.deepEqual(relocationExtra({ identity: ME, rows, from: 'Docs', to: 'Papiers', shares, places, owner: false }), { refuse: 'ex.folderLinked', extra: [], lost: 1 - 1 });
  const byId = [link(6, idKey(ME, 11))];
  assert.deepEqual(relocationExtra({ identity: ME, rows, from: 'Docs', to: 'Papiers', places: byId }).extra, [], 'un lien par numéro suit sans rien écrire, même sans être propriétaire');
  const fused = relocationExtra({ identity: ME, rows: [...rows, { id: 14, path: 'Papiers' }], from: 'Docs', to: 'Papiers', known: ['Docs', 'Papiers'], places: byId, owner: true });
  assert.equal(fused.refuse, 'ex.folderLinked');
});

test('supprimer : les partages du dossier (par numéro et par chemin) partent avec lui, ceux des autres dossiers restent ; un dossier qu\'un lien montre ne se supprime pas', () => {
  const shares = [share(1, idKey(ME, 11)), share(2, personalTarget(ME, 'Docs')), share(3, idKey(ME, 12)), share(4, idKey(ME, 13)), share(5, personalTarget(ME, 'Autre'))];
  assert.deepEqual(removalExtra({ identity: ME, rows, paths: ['Docs', 'Docs/Factures'], shares }),
    { refuse: null, removed: 3, extra: [['RemoveRecord', SHARES_TABLE, 1], ['RemoveRecord', SHARES_TABLE, 2], ['RemoveRecord', SHARES_TABLE, 3]] });
  assert.deepEqual(removalExtra({ identity: ME, rows, paths: ['Sans'], shares }), { refuse: null, removed: 0, extra: [] });
  assert.deepEqual(removalExtra({ identity: ME, rows, paths: ['Docs'], shares, places: [link(1, idKey(ME, 11))] }), { refuse: 'ex.folderLinked', removed: 0, extra: [] });
  assert.equal(removalExtra({ identity: ME, rows, paths: ['Docs'], shares, places: [link(1, personalTarget(ME, 'Docs'))] }).refuse, 'ex.folderLinked');
});

// La lecture des tables : sans table des partages, aucune action ; la ligne d'un dossier à l'ancienne mode naît avant le lot.
function harness({ shares, places = [], folderRows = [], owner = true }) {
  const created = [];
  const tables = { [SHARES_TABLE]: shares, [PLACE_TABLE]: places };
  const asTable = list => (list ? { id: list.map(item => item.id), Target: list.map(item => item.Target), Link: list.map(item => item.Link) } : null);
  let state = [...folderRows];
  const rangement = { folderRows: async () => state,
    folderIds: async paths => { created.push(...paths); state = [...state, ...paths.map((path, at) => ({ id: 100 + at, path }))]; return new Map(); } };
  const port = { doc: { fetchTable: async name => { if (!tables[name]) throw new Error('absente'); return asTable(tables[name]); } } };
  return { created, shared: new FolderShares({ port, rangement, identity: () => ME, owner: async () => owner }) };
}

test('FolderShares : sans table des partages ou sans adresse, rien à suivre ; un dossier à l\'ancienne mode reçoit sa ligne d\'état d\'abord, puis son partage passe au numéro', async () => {
  assert.deepEqual(await harness({ shares: null }).shared.relocation('Docs', 'Papiers', ['Docs']), { refuse: null, extra: [], lost: 0, spare: [] });
  const { created, shared } = harness({ shares: [share(1, personalTarget(ME, 'Docs')), share(2, personalTarget(ME, 'Docs/Disparu'))], folderRows: [] });
  const out = await shared.relocation('Docs', 'Papiers', ['Docs', 'Autre']);
  assert.deepEqual(created, ['Docs'], 'seul le dossier qui existe reçoit sa ligne');
  assert.deepEqual(out, { refuse: null, lost: 0, spare: ['Docs'], extra: [['UpdateRecord', SHARES_TABLE, 1, { Target: idKey(ME, 100) }]] });
  const already = harness({ shares: [share(1, personalTarget(ME, 'Docs'))], folderRows: [{ id: 7, path: 'Docs' }] });
  assert.deepEqual((await already.shared.relocation('Docs', 'Papiers', ['Docs'])).spare, ['Docs']);
  assert.deepEqual(already.created, [], 'la ligne existe : rien n\'est écrit avant le lot');
});

test('FolderShares : une ligne d\'état que la liste de l\'explorateur ne connaît pas encore est relue : le dossier renommé la suit, un dossier d\'arrivée qui n\'a que cette ligne est un dossier qui existe', async () => {
  const rowsNow = [{ id: 7, path: 'Docs' }, { id: 8, path: 'Papiers' }];
  const { created, shared } = harness({ shares: [share(1, idKey(ME, 7)), share(2, idKey(ME, 8))], folderRows: rowsNow });
  const out = await shared.relocation('Docs', 'Papiers', ['Docs/Factures']);
  assert.deepEqual(created, []);
  assert.deepEqual(out.spare, ['Docs', 'Papiers'], 'les chemins qui ont une ligne d\'état, relus');
  assert.deepEqual([out.extra, out.lost], [[['RemoveRecord', SHARES_TABLE, 1]], 1], '« Papiers » existe par sa seule ligne d\'état : « Docs » s\'y fond');
});

test('FolderShares : la suppression rend les partages à retirer ; le propriétaire du document n\'est demandé que pour un lien à l\'ancienne mode', async () => {
  const { shared } = harness({ shares: [share(1, idKey(ME, 7)), share(2, idKey(ME, 8))], folderRows: [{ id: 7, path: 'Docs' }, { id: 8, path: 'Autre' }] });
  assert.deepEqual(await shared.removal(['Docs']), { refuse: null, removed: 1, extra: [['RemoveRecord', SHARES_TABLE, 1]] });
  let asked = 0;
  const port = { doc: { fetchTable: async () => ({ id: [], Target: [], Link: [] }) } };
  const counting = new FolderShares({ port, rangement: { folderRows: async () => [], folderIds: async () => new Map() }, identity: () => ME, owner: async () => { asked += 1; return true; } });
  await counting.relocation('Docs', 'Papiers', ['Docs']);
  assert.equal(asked, 0, 'aucun lien à l\'ancienne mode : la personne n\'est pas questionnée');
});
