// Les espaces partagés dans l'explorateur (js/spaces-filing.js, contrats 11.7, point 13, lot 4b) : ce que l'explorateur montre d'un espace, et ce qu'un rangement écrit dans le placement plutôt que dans le rangement de la personne.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Filing } from '../js/filing.js';
import { applyPlacement, folderLabel, isInsideSpace, isSpaceItself, isSpacePath, locate, readSpaces, splitWrites, touchesSpaces, writePlacement } from '../js/spaces-filing.js';
import { listItems } from '../js/explorer-model.js';
import { createI18n } from '../js/i18n.js';

const { t } = createI18n('fr');
const SPACES = { id: [1, 2], Cle: ['achats', 'compta'], Nom: ['Achats', 'Compta'] };
const PLACE = { id: [1, 2, 3, 4], Cible: ['publipostage:2', 'publipostage:3', '', 'publipostage:9'], Espace: ['achats', 'achats', 'achats', 'inconnu'], Dossier: ['Contrats', '', 'Contrats/Sous', 'X'] };
const info = () => readSpaces(SPACES, PLACE);
const file = (id, folder = '', extra = {}) => ({ key: `publipostage:${id}`, app: 'publipostage', id: String(id), name: `Modèle ${id}`, folder, pinned: false, search: '', weight: 0, pieces: [], ts: null, ...extra });

test('lire les espaces : un dossier « Espaces/<nom> » par espace lu, les dossiers vides par les lignes sans fichier, un espace inconnu ignoré', () => {
  const read = info();
  assert.deepEqual(read.spaces.map(space => space.path), ['Espaces/Achats', 'Espaces/Compta']);
  assert.deepEqual([...read.folders].sort(), ['Espaces/Achats', 'Espaces/Achats/Contrats/Sous', 'Espaces/Compta']);
  assert.equal(read.placed.get('publipostage:2').folder, 'Contrats');
  assert.equal(read.placed.has('publipostage:9'), false, 'un placement dans un espace qu\'on ne lit pas n\'est pas montré');
  assert.equal(readSpaces(null, null).spaces.length, 0);
});

test('deux espaces de même nom : le second porte sa clé', () => {
  const read = readSpaces({ id: [1, 2], Cle: ['a', 'b'], Nom: ['Achats', 'achats'] }, null);
  assert.deepEqual(read.spaces.map(space => space.name), ['Achats', 'achats (b)']);
});

test('les fichiers placés changent de dossier, gardent le leur, et la recherche suit', () => {
  const files = applyPlacement([file(1, 'Perso'), file(2, 'Perso'), file(3), file(5, 'Z')], info());
  assert.deepEqual(files.map(each => each.folder), ['Perso', 'Espaces/Achats/Contrats', 'Espaces/Achats', 'Z']);
  assert.equal(files[1].ownFolder, 'Perso');
  assert.deepEqual(files[1].space, { key: 'achats', folder: 'Contrats' });
  assert.match(files[1].search, /achats/);
  assert.equal(files[0].space, undefined);
});

test('les chemins : la racine, un espace, un dossier d\'espace', () => {
  assert.ok(isSpacePath('Espaces') && isSpacePath('Espaces/Achats/Contrats') && !isSpacePath('Espaces2') && !isSpacePath('Perso/Espaces'));
  assert.ok(isSpaceItself('Espaces') && isSpaceItself('Espaces/Achats') && !isSpaceItself('Espaces/Achats/Contrats'));
  assert.ok(isInsideSpace('Espaces/Achats/Contrats') && !isInsideSpace('Espaces/Achats'));
  assert.deepEqual(locate('Espaces/Achats/Contrats/Sous', info()), { space: info().spaces[0], folder: 'Contrats/Sous' });
  assert.equal(locate('Espaces', info()), null);
  assert.equal(locate('Espaces/Nulle part', info()), null);
});

test('« Espaces » se dit dans la langue de la personne, les autres noms restent', () => {
  assert.equal(folderLabel(t, 'Espaces'), 'Espaces');
  assert.equal(folderLabel(createI18n('en').t, 'Espaces'), 'Spaces');
  assert.equal(folderLabel(createI18n('en').t, 'Espaces/Achats'), 'Achats');
});

test('« Moi » ne liste pas « Espaces » parmi ses dossiers', () => {
  const read = info();
  const files = applyPlacement([file(1, 'Perso'), file(2, 'Perso')], read);
  const state = { view: 'folder', path: '', q: '', type: 'all', sort: { key: 'name', dir: 1 } };
  const rows = listItems(files, state, { locale: 'fr', typeLabel: () => '', spare: read.folders }).rows;
  assert.deepEqual(rows.filter(row => row.kind === 'folder').map(row => row.path), ['Perso']);
  const inside = listItems(files, { ...state, path: 'Espaces' }, { locale: 'fr', typeLabel: () => '', spare: read.folders }).rows;
  assert.deepEqual(inside.filter(row => row.kind === 'folder').map(row => row.path), ['Espaces/Achats', 'Espaces/Compta']);
});

test('ranger dans un espace : un placement, le dossier de la personne ne change pas ; en sortir : le placement part', () => {
  const read = info();
  const files = applyPlacement([file(1, 'Perso'), file(2, 'Perso')], read);
  const into = splitWrites([{ app: 'publipostage', file: '1', pinned: true, folder: 'Espaces/Compta' }], {}, files, read);
  assert.deepEqual(into.ops, [{ place: 'publipostage:1', space: 'compta', folder: '' }]);
  assert.deepEqual(into.entries, [{ app: 'publipostage', file: '1', pinned: true, folder: 'Perso' }]);
  const out = splitWrites([{ app: 'publipostage', file: '2', pinned: false, folder: 'Autre' }], {}, files, read);
  assert.deepEqual(out.ops, [{ remove: 'publipostage:2' }]);
  assert.deepEqual(out.entries, [{ app: 'publipostage', file: '2', pinned: false, folder: 'Autre' }]);
  const pin = splitWrites([{ app: 'publipostage', file: '2', pinned: true, folder: 'Espaces/Achats/Contrats' }], {}, files, read);
  assert.equal(touchesSpaces(pin), false, 'épingler un fichier d\'un espace n\'écrit pas le placement');
  assert.equal(pin.entries[0].folder, 'Perso', 'et ne met jamais un chemin d\'espace dans le rangement de la personne');
});

test('ranger : un fichier de la personne qui change de dossier sans toucher aux espaces n\'écrit pas le placement ; un fichier d\'espace qui change de dossier dans son espace, si', () => {
  const read = info();
  const files = applyPlacement([file(1, 'Perso'), file(2, 'Perso')], read);
  const between = splitWrites([{ app: 'publipostage', file: '1', pinned: false, folder: 'Autre' }], {}, files, read);
  assert.deepEqual(between.ops, [], 'un fichier qui n\'est dans aucun espace n\'a rien à retirer du placement');
  assert.equal(touchesSpaces(between), false);
  const within = splitWrites([{ app: 'publipostage', file: '2', pinned: false, folder: 'Espaces/Achats' }], {}, files, read);
  assert.deepEqual(within.ops, [{ place: 'publipostage:2', space: 'achats', folder: '' }], 'du dossier « Contrats » à la racine de l\'espace');
  const stay = splitWrites([{ app: 'publipostage', file: '2', pinned: false, folder: 'Espaces/Achats/Contrats' }], {}, files, read);
  assert.deepEqual(stay.ops, [], 'le même dossier du même espace : rien à écrire');
  const other = splitWrites([{ app: 'publipostage', file: '2', pinned: false, folder: 'Espaces/Compta' }], {}, files, read);
  assert.deepEqual(other.ops, [{ place: 'publipostage:2', space: 'compta', folder: '' }], 'd\'un espace à un autre');
});

test('« Espaces » seul, ou un espace inconnu : refusé', () => {
  const read = info();
  assert.equal(splitWrites([{ app: 'publipostage', file: '1', pinned: false, folder: 'Espaces' }], {}, [], read).error, 'ex.spaceUnknown');
  assert.equal(splitWrites([{ app: 'publipostage', file: '1', pinned: false, folder: 'Espaces/Nulle' }], {}, [], read).error, 'ex.spaceUnknown');
});

test('les dossiers gardés : ceux d\'un espace vont au placement, les autres au rangement', () => {
  const plan = splitWrites([], { add: ['Perso/Neuf', 'Espaces/Achats/Neuf', 'Espaces/Achats'], drop: ['Espaces/Achats/Contrats/Sous', 'Vieux'] }, [], info());
  assert.deepEqual(plan.folders.add, ['Perso/Neuf']);
  assert.deepEqual(plan.folders.drop, ['Vieux']);
  assert.deepEqual(plan.markers, { add: [{ space: 'achats', folder: 'Neuf' }], drop: [{ space: 'achats', folder: 'Contrats/Sous' }] });
});

test('écrire le placement : mise à jour, ajout, retrait, dossiers vides, en un seul lot', async () => {
  const seen = [];
  const doc = { fetchTable: async () => PLACE, applyUserActions: async actions => { seen.push(...actions); } };
  const plan = { ops: [{ place: 'publipostage:2', space: 'compta', folder: '' }, { place: 'publipostage:7', space: 'achats', folder: 'Contrats' }, { remove: 'publipostage:3' }],
    markers: { add: [{ space: 'achats', folder: 'Neuf' }, { space: 'achats', folder: 'Contrats/Sous' }], drop: [{ space: 'achats', folder: 'Contrats/Sous' }] } };
  assert.equal(await writePlacement(doc, plan), true);
  assert.deepEqual(seen, [
    ['UpdateRecord', 'GFS_Placement', 1, { Espace: 'compta', Dossier: '' }],
    ['AddRecord', 'GFS_Placement', null, { Cible: 'publipostage:7', Espace: 'achats', Dossier: 'Contrats' }],
    ['RemoveRecord', 'GFS_Placement', 2],
    ['RemoveRecord', 'GFS_Placement', 3],
    ['AddRecord', 'GFS_Placement', null, { Cible: '', Espace: 'achats', Dossier: 'Neuf' }],
  ]);
  assert.equal(await writePlacement({ fetchTable: async () => PLACE, applyUserActions: async () => { throw new Error('rien à écrire'); } }, { ops: [], markers: { add: [], drop: [] } }), false);
});

// ---- le geste : Filing ----
function harness({ owner = true, files = [file(1, 'Perso'), file(2, 'Perso')], spare = [] } = {}) {
  const log = { placements: [], filings: [], notices: [] };
  let list = applyPlacement(files, info());
  const read = info();
  const filing = new Filing({
    port: { doc: { fetchTable: async () => PLACE, applyUserActions: async actions => { log.placements.push(...actions); } } },
    rangement: { setFiling: async (entries, folders = {}) => { log.filings.push({ entries, folders }); return true; } },
    t, locale: () => 'fr', files: () => list, folders: () => [...spare, ...read.folders], here: () => '', specOf: () => null, appName: () => 'Publipostage+', writeBlock: () => null,
    notice: text => log.notices.push(text), refresh: async () => {}, windows: { name: async () => null, folder: async () => null },
    spaces: { info: () => read, owner: async () => owner },
  });
  return { filing, log };
}

test('couper-coller dans un espace : un propriétaire écrit le placement, le rangement garde le dossier de la personne', async () => {
  const { filing, log } = harness();
  assert.equal(await filing.moveFileTo(file(1, 'Perso'), 'Espaces/Achats/Contrats'), 'moved');
  assert.deepEqual(log.placements, [['AddRecord', 'GFS_Placement', null, { Cible: 'publipostage:1', Espace: 'achats', Dossier: 'Contrats' }]]);
  assert.equal(log.filings[0].entries[0].folder, 'Perso');
});

test('une personne qui n\'est pas propriétaire ne range pas dans un espace : rien n\'est écrit, la phrase le dit', async () => {
  const { filing, log } = harness({ owner: false });
  assert.equal(await filing.moveFileTo(file(1, 'Perso'), 'Espaces/Achats'), undefined);
  assert.deepEqual(log.placements, []);
  assert.deepEqual(log.filings, []);
  assert.deepEqual(log.notices, [t('ex.spaceOwnersOnly')]);
});

test('épingler un fichier d\'espace : le rangement de la personne seulement, jamais le chemin de l\'espace', async () => {
  const { filing, log } = harness();
  await filing.togglePin(file(2, 'Espaces/Achats/Contrats'));
  assert.deepEqual(log.placements, []);
  assert.equal(log.filings[0].entries[0].folder, 'Perso');
  assert.equal(log.filings[0].entries[0].pinned, true);
});

test('un dossier d\'espace ne se renomme ni ne se déplace, un espace ne se supprime pas d\'ici, « Espaces » est réservé', async () => {
  const { filing, log } = harness();
  assert.equal(await filing.moveFolderTo('Espaces/Achats/Contrats', 'Perso'), undefined);
  assert.equal(await filing.deleteFolder('Espaces/Achats'), false);
  assert.equal(await filing.newFolder('Espaces'), undefined);
  assert.deepEqual(log.placements, []);
  assert.deepEqual(log.notices, [t('ex.spaceFolderFixed'), t('ex.spaceFixed'), t('ex.spaceCreateElsewhere')]);
});

test('un fichier neuf (copie, PDF importé) dans un espace : placé par un propriétaire, à la racine sinon', async () => {
  const owner = harness();
  await owner.filing.rangeNew([{ app: 'publipostage', file: '5', pinned: false, folder: 'Espaces/Achats/Contrats' }]);
  assert.equal(owner.log.placements.length, 1);
  assert.equal(owner.log.filings[0].entries[0].folder, '');
  const other = harness({ owner: false });
  await other.filing.rangeNew([{ app: 'publipostage', file: '5', pinned: false, folder: 'Espaces/Achats/Contrats' }]);
  assert.deepEqual(other.log.placements, []);
  assert.equal(other.log.filings[0].entries[0].folder, '');
  assert.deepEqual(other.log.notices, [t('ex.spaceOwnersOnly')]);
});

test('un chemin sous « Espaces » qui ne désigne aucun espace : rien n\'est écrit, la phrase le dit', async () => {
  const { filing, log } = harness();
  await filing.moveFileTo(file(1, 'Perso'), 'Espaces/Inconnu/Dossier');
  assert.deepEqual(log.placements, []);
  assert.deepEqual(log.filings, []);
  assert.deepEqual(log.notices, [t('ex.spaceUnknown')]);
});

test('retirer un dossier gardé dans un espace : seul le placement s\'écrit, le rangement de la personne n\'est pas touché', async () => {
  const { filing, log } = harness();
  await filing.deleteFolder('Espaces/Achats/Contrats/Sous');
  assert.deepEqual(log.placements, [['RemoveRecord', 'GFS_Placement', 3]]);
  assert.deepEqual(log.filings, [], 'rien à écrire dans GFS_Rangement : pas d\'écriture à vide');
  assert.deepEqual(log.notices.filter(text => text !== t('ex.folderDeleted', { name: 'Sous' })), []);
});
