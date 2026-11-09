// Le modèle de l'explorateur : lecture des tables d'après le manifeste (contrats 2.4), rangement (6.4), dossiers, recherche, tri.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFiles, readFiling, readGfsFiling, readGfsFolders, applyFiling, folderPaths, folderName, folderMoves, spareMoves, vacatedFolders, subfolders, treeRows, pathParts, listItems, typeChoices, person,
  formatDate, normalizePath, inside, stampOf, authorOf, familyOf, FAMILY_NAMES } from '../js/explorer-model.js';
import { FILES_MANIFEST } from '../js/gfs-files.js';
import { sumWeights } from '../js/weight.js';
import { createI18n } from '../js/i18n.js';
import { publipostage } from './helpers.mjs';

const manifest = publipostage();
const spec = manifest.fichiers[0];
const T0 = Date.UTC(2026, 9, 12, 10, 15) / 1000;
const DAY = 86400;

const models = () => ({
  id: [1, 2, 3, 4, 5, 6],
  Nom: ['Feuille d’émargement', 'Convocation de session', 'Réglages du document', 'Support', '', 'Émargement (grille)'],
  TypeModele: ['', 'email', 'reglages', 'diaporama', 'macro', 'grille'],
  DateModif: [T0 - 3 * DAY, T0 - 8 * DAY, T0, T0 - DAY, null, ['D', T0 - 2 * DAY, 'UTC']],
  ModifiePar: ['Alice Martin <a.martin@exemple.org>', 'b.dupont@exemple.org', '', '', '', 'Service RH'],
  Contenu: ['x', 'y', 'z', 'w', 'v', 'u'],
});
const prefs = () => ({
  id: [1, 2, 3, 4, 5, 6],
  Utilisateur: ['', '', '', 'autre@exemple.org', '', ''],
  ModeleId: [1, 2, 0, 1, 2, 99],
  Dossier: ['Formation', ' Formation / Sessions ', 'Formation', 'Prive', 'Doublon', 'Fantome'],
  Epingle: [true, false, false, true, true, true],
});
const files = () => applyFiling(readFiles(manifest, spec, models()), readFiling(spec.rangement, prefs(), ''));
const typeLabel = file => (file.typeInfo ? file.typeInfo.nom.fr : file.type);
const OPTIONS = { locale: 'fr', typeLabel };
const state = (extra = {}) => ({ view: 'folder', path: '', q: '', type: 'all', sort: { key: 'name', dir: 1 }, ...extra });

test('readFiles : la ligne réservée est exclue, le type vide devient le type par défaut, un type inconnu est marqué', () => {
  const list = readFiles(manifest, spec, models());
  assert.deepEqual(list.map(f => f.id), ['1', '2', '4', '5', '6']);
  const [first, mail, unknown, noName, grid] = list;
  assert.equal(first.type, 'document');
  assert.equal(first.family, 'doc');
  assert.equal(mail.family, '', 'e-mail : neutre');
  assert.equal(unknown.known, false);
  assert.equal(unknown.typeInfo, null);
  assert.equal(unknown.family, '');
  assert.equal(noName.name, '');
  assert.equal(grid.family, 'grid');
  assert.equal(first.key, 'publipostage:1');
});

test('familyOf : le champ `couleur` du manifeste dit la famille de la charte (cahier 6.5) ; tout autre mot, et jamais un mot de la chaîne de prototypes, est neutre', () => {
  assert.deepEqual(['document', 'grille', 'presentation', 'pdf'].map(familyOf), ['doc', 'grid', 'slides', 'pdf']);
  assert.deepEqual(FAMILY_NAMES, ['doc', 'grid', 'slides', 'pdf']);
  for (const odd of ['neutre', '', 'rouge', 'DOCUMENT', undefined, null, 3, 'constructor', 'toString', '__proto__', 'hasOwnProperty']) assert.equal(familyOf(odd), '', String(odd));
});

test('readFiles : un type qui déclare la couleur « pdf » est de la famille rouge ; un mot inconnu reste neutre', () => {
  const custom = { ...spec, types: [{ valeur: 'pdf', nom: { fr: 'PDF', en: 'PDF' }, icone: 'pdf', couleur: 'pdf' }, { valeur: 'autre', nom: { fr: 'Autre', en: 'Other' }, icone: 'doc', couleur: 'toString' }] };
  const data = { id: [1, 2], Nom: ['a.pdf', 'b'], TypeModele: ['pdf', 'autre'], DateModif: [T0, T0], ModifiePar: ['', ''], Contenu: ['x', 'y'] };
  const [pdf, other] = readFiles(manifest, custom, data);
  assert.equal(pdf.family, 'pdf');
  assert.equal(other.family, '', 'une couleur qui n\'en est pas une : neutre, et non une fonction de l\'objet');
});

test('readFiles : une présentation est un type connu, de la famille orange, possédé par l\'extension des diapositives', () => {
  const data = { id: [1, 2], Nom: ['Cours', 'Lettre'], TypeModele: ['presentation', ''], DateModif: [T0, T0], ModifiePar: ['', ''], Contenu: ['x', 'y'] };
  const [slides, letter] = readFiles(manifest, spec, data);
  assert.equal(slides.known, true);
  assert.equal(slides.family, 'slides');
  assert.equal(slides.typeInfo.icone, 'slides');
  assert.equal(slides.typeInfo.extension, 'diapositives', 'grisée tant que l\'extension est éteinte (contrats 2.4)');
  assert.equal(letter.typeInfo.extension, undefined, 'un document est du socle : jamais grisé par une extension');
});

test('readFiles : une date codée est lue, une cellule vide n\'est pas une date', () => {
  const list = readFiles(manifest, spec, models());
  assert.equal(list.find(f => f.id === '6').ts, T0 - 2 * DAY);
  assert.equal(list.find(f => f.id === '5').ts, null);
});

test('contrats 2.4 point 2 : une colonne déclarée mais absente se lit comme vide', () => {
  const data = models();
  delete data.ModifiePar;
  delete data.DateModif;
  const list = readFiles(manifest, spec, data);
  assert.equal(list.length, 5);
  assert.ok(list.every(f => f.by === '' && f.ts === null));
  assert.deepEqual(readFiles(manifest, spec, null), []);
  assert.deepEqual(readFiles(manifest, spec, {}), []);
});

test('readFiling : seule la personne courante, ni les lignes d\'état, la première ligne fait foi', () => {
  const filing = readFiling(spec.rangement, prefs(), '');
  assert.deepEqual([...filing.keys()].sort(), ['1', '2', '99']);
  assert.deepEqual(filing.get('1'), { folder: 'Formation', pinned: true });
  assert.deepEqual(filing.get('2'), { folder: 'Formation/Sessions', pinned: false }, 'la première ligne du fichier 2');
  const other = readFiling(spec.rangement, prefs(), 'autre@exemple.org');
  assert.deepEqual([...other.keys()], ['1']);
  assert.equal(other.get('1').folder, 'Prive');
  assert.equal(readFiling(undefined, prefs(), '').size, 0);
  assert.equal(readFiling(spec.rangement, null, '').size, 0);
});

test('applyFiling : un fichier garde son rangement, une ligne dont le fichier n\'existe plus est ignorée', () => {
  const list = files();
  assert.equal(list.find(f => f.id === '1').folder, 'Formation');
  assert.equal(list.find(f => f.id === '1').pinned, true);
  assert.equal(list.find(f => f.id === '4').folder, '');
  assert.ok(!list.some(f => f.id === '99'));
  assert.match(list.find(f => f.id === '2').search, /convocation de session formation sessions/);
});

test('readFiles : chaque fichier dit sa table et sa ligne de Grist (renommer écrit là, et seulement là)', () => {
  const list = readFiles(manifest, spec, models());
  assert.deepEqual(list.map(f => [f.table, f.row]), [[spec.table, 1], [spec.table, 2], [spec.table, 4], [spec.table, 5], [spec.table, 6]]);
});

// Le rangement de GFS (`GFS_Rangement`, contrats 6.4) : une ligne par (personne, app, fichier), qui passe devant celui de l'app.
const gfsRows = () => ({
  id: [1, 2, 3, 4, 5, 6, 7],
  Utilisateur: ['', '@document', '', 'autre@exemple.org', '', '', ''],
  App: ['publipostage', 'gfs', 'publipostage', 'publipostage', '', 'publipostage', 'form'],
  Fichier: ['2', 'apps', '4', '1', '', '2', '9'],
  Favori: [true, false, false, true, false, false, true],
  Dossier: ['Archives / 2026', '', 'Formation', 'Prive', 'Vide', 'Doublon', ''],
});

test('readGfsFiling : la personne seule, ni la ligne réservée ni une ligne sans fichier, la première ligne fait foi', () => {
  const filing = readGfsFiling(gfsRows(), '');
  assert.deepEqual([...filing.keys()], ['publipostage:2', 'publipostage:4', 'form:9']);
  assert.deepEqual(filing.get('publipostage:2'), { folder: 'Archives/2026', pinned: true });
  assert.deepEqual([...readGfsFiling(gfsRows(), 'autre@exemple.org').keys()], ['publipostage:1']);
  assert.equal(readGfsFiling(gfsRows(), '@document').size, 0, 'une identité réservée ne lit rien');
  assert.equal(readGfsFiling(null).size, 0);
});

test('applyFiling : le rangement de GFS passe devant celui de l\'app, fichier par fichier ; sans ligne, celui de l\'app reste', () => {
  const list = applyFiling(readFiles(manifest, spec, models()), readFiling(spec.rangement, prefs(), ''), readGfsFiling(gfsRows(), ''));
  const of = id => list.find(f => f.id === id);
  assert.deepEqual([of('2').folder, of('2').pinned], ['Archives/2026', true], 'GFS a rangé le fichier 2');
  assert.deepEqual([of('4').folder, of('4').pinned], ['Formation', false], 'GFS seul connaît le fichier 4');
  assert.deepEqual([of('1').folder, of('1').pinned], ['Formation', true], 'le fichier 1 garde le rangement de l\'app');
  assert.match(of('2').search, /archives 2026/);
});

test('folderPaths : chaque dossier et ses parents, une fois, triés ; folderName : sans « / » ni espaces autour', () => {
  const list = [{ folder: 'B/C' }, { folder: '' }, { folder: 'a' }, { folder: 'B/C/D' }, { folder: 'B' }];
  assert.deepEqual(folderPaths(list, 'fr'), ['a', 'B', 'B/C', 'B/C/D']);
  assert.equal(folderName('  Factures / 2026  '), 'Factures 2026');
  assert.equal(folderName(' // '), '');
  assert.equal(folderName(null), '');
});

test('folderMoves : un dossier renommé ou déplacé emporte ses fichiers et ses sous-dossiers ; jamais en lui-même', () => {
  const list = [
    { app: 'p', id: '1', pinned: true, folder: 'A/B' }, { app: 'p', id: '2', pinned: false, folder: 'A/B/C' },
    { app: 'f', id: '3', pinned: false, folder: 'A' }, { app: 'p', id: '4', pinned: false, folder: 'A/Bis' },
  ];
  assert.deepEqual(folderMoves(list, 'A/B', 'A/Z'), [
    { app: 'p', file: '1', pinned: true, folder: 'A/Z' }, { app: 'p', file: '2', pinned: false, folder: 'A/Z/C' },
  ], '« A/Bis » n\'est pas dans « A/B »');
  assert.deepEqual(folderMoves(list, 'A/B', 'X/B').map(entry => entry.folder), ['X/B', 'X/B/C']);
  assert.deepEqual(folderMoves(list, 'A/B', 'B').map(entry => entry.folder), ['B', 'B/C'], 'vers la racine');
  assert.deepEqual(folderMoves(list, 'A', 'A/B/A'), [], 'dans un de ses sous-dossiers : rien');
  assert.deepEqual(folderMoves(list, 'A/B', 'A/B'), []);
  assert.deepEqual(folderMoves(list, '', 'X'), [], 'la racine ne se déplace pas');
});

test('dossiers : un dossier existe tant qu\'un fichier le nomme, avec ses sous-dossiers', () => {
  const list = files();
  assert.deepEqual(subfolders(list, '', 'fr').map(f => [f.path, f.count]), [['Formation', 2]]);
  assert.deepEqual(subfolders(list, 'Formation', 'fr').map(f => [f.path, f.name, f.count]), [['Formation/Sessions', 'Sessions', 1]]);
  assert.deepEqual(subfolders(list, 'Formation/Sessions', 'fr'), []);
  assert.equal(subfolders(list, '', 'fr')[0].ts, T0 - 3 * DAY, 'la date du dossier est celle de son fichier le plus récent');
  assert.equal(inside('Formation/Sessions', 'Formation'), true);
  assert.equal(inside('Formations', 'Formation'), false);
  assert.equal(inside('', ''), true);
});

test('treeRows : l\'arbre suit les dossiers ouverts', () => {
  const list = files();
  const closed = treeRows(list, new Set(), 'fr');
  assert.deepEqual(closed.map(r => [r.path, r.depth, r.hasChildren, r.open]), [['Formation', 0, true, false]]);
  const open = treeRows(list, new Set(['Formation']), 'fr');
  assert.deepEqual(open.map(r => [r.path, r.depth]), [['Formation', 0], ['Formation/Sessions', 1]]);
});

test('pathParts et normalizePath', () => {
  assert.deepEqual(pathParts('A/B/C').map(p => p.path), ['A', 'A/B', 'A/B/C']);
  assert.deepEqual(pathParts(''), []);
  assert.equal(normalizePath('  Factures // 2024/ '), 'Factures/2024');
  assert.equal(normalizePath(3), '');
});

test('listItems : un dossier montre ses sous-dossiers d\'abord, puis ses fichiers', () => {
  const root = listItems(files(), state(), OPTIONS);
  assert.equal(root.flat, false);
  assert.deepEqual(root.rows.map(r => (r.kind === 'folder' ? `dossier:${r.name}` : r.file.id)), ['dossier:Formation', '5', '6', '4'], 'un fichier sans nom passe en tête, puis l\'ordre alphabétique');
  const sub = listItems(files(), state({ path: 'Formation' }), OPTIONS);
  assert.deepEqual(sub.rows.map(r => (r.kind === 'folder' ? `dossier:${r.name}` : r.file.id)), ['dossier:Sessions', '1']);
});

test('listItems : la recherche parcourt tout l\'arbre, mots dans n\'importe quel ordre, accents et casse ignorés', () => {
  const found = listItems(files(), state({ q: 'EMARGEMENT feuille' }), OPTIONS);
  assert.equal(found.flat, true);
  assert.deepEqual(found.rows.map(r => r.file.id), ['1']);
  assert.deepEqual(listItems(files(), state({ q: 'sessions convocation' }), OPTIONS).rows.map(r => r.file.id), ['2'], 'le dossier compte dans la recherche');
  assert.deepEqual(listItems(files(), state({ q: 'zzz' }), OPTIONS).rows, []);
});

test('listItems : le filtre de type', () => {
  const grids = listItems(files(), state({ type: 'grille' }), OPTIONS);
  assert.deepEqual(grids.rows.map(r => r.file.id), ['6']);
  assert.deepEqual(listItems(files(), state({ type: 'diaporama' }), OPTIONS).rows.map(r => r.file.id), ['4'], 'un type inconnu se filtre aussi');
});

test('listItems : Récents (les plus récents d\'abord, huit au plus) et Favoris', () => {
  const byDate = { key: 'mod', dir: -1 };
  const recent = listItems(files(), state({ view: 'recent', sort: byDate }), OPTIONS);
  assert.deepEqual(recent.rows.map(r => r.file.id), ['4', '6', '1', '2', '5']);
  const many = Array.from({ length: 12 }, (_, i) => ({ ...files()[0], id: String(i), ts: i, search: '' }));
  assert.equal(listItems(many, state({ view: 'recent', sort: byDate }), OPTIONS).rows.length, 8);
  // Le tri choisi s'applique aux huit retenus, il ne change pas lesquels sont retenus.
  const named = listItems(many.map((file, i) => ({ ...file, name: `Fichier ${String.fromCharCode(97 + i)}` })), state({ view: 'recent', sort: { key: 'name', dir: 1 } }), OPTIONS);
  assert.deepEqual(named.rows.map(r => r.file.id), ['4', '5', '6', '7', '8', '9', '10', '11']);
  assert.deepEqual(listItems(files(), state({ view: 'fav' }), OPTIONS).rows.map(r => r.file.id), ['1']);
});

test('listItems : tri par date et par nom, descendant, le nom départage', () => {
  const byDate = listItems(files(), state({ sort: { key: 'mod', dir: -1 } }), OPTIONS);
  assert.deepEqual(byDate.rows.filter(r => r.kind === 'file').map(r => r.file.id), ['4', '6', '5'], 'sans date en dernier');
  const byNameDesc = listItems(files(), state({ sort: { key: 'name', dir: -1 } }), OPTIONS);
  assert.deepEqual(byNameDesc.rows.filter(r => r.kind === 'file').map(r => r.file.id), ['4', '6', '5']);
  const byType = listItems(files(), state({ sort: { key: 'type', dir: 1 } }), OPTIONS);
  assert.deepEqual(byType.rows.filter(r => r.kind === 'file').map(r => r.file.id), ['4', '6', '5'], 'diaporama (valeur brute d\'un type inconnu), Grille, Macro-modèle');
});

test('typeChoices : les types présents, connus ou non', () => {
  const choices = typeChoices(files(), typeLabel);
  assert.deepEqual(choices.map(c => c.value).sort(), ['diaporama', 'document', 'email', 'grille', 'macro']);
  assert.equal(choices.find(c => c.value === 'diaporama').known, false);
  assert.equal(choices.find(c => c.value === 'grille').count, 1);
});

test('person : « Nom <adresse> », adresse seule, rien', () => {
  assert.deepEqual(person('Alice Martin <a.martin@exemple.org>'), { name: 'Alice Martin', initials: 'AM' });
  assert.deepEqual(person('b.dupont@exemple.org'), { name: 'b.dupont@exemple.org', initials: 'BD' });
  assert.deepEqual(person('Service RH'), { name: 'Service RH', initials: 'SR' });
  assert.deepEqual(person('<x@y.z>'), { name: 'x@y.z', initials: 'X' });
  assert.deepEqual(person(''), { name: '', initials: '' });
  assert.deepEqual(person(null), { name: '', initials: '' });
});

test('formatDate : aujourd\'hui, hier, jour et mois, avec l\'année quand elle change', () => {
  const now = new Date(2026, 9, 12, 12, 50);
  const t = createI18n('fr').t;
  const at = (y, m, d, h = 9, mi = 0) => new Date(y, m, d, h, mi).getTime() / 1000;
  assert.match(formatDate(at(2026, 9, 12, 10, 15), now, 'fr-FR', t), /^Auj\. 10:15$/);
  assert.equal(formatDate(at(2026, 9, 11, 23, 59), now, 'fr-FR', t), 'Hier');
  assert.equal(formatDate(at(2026, 9, 2), now, 'fr-FR', t), '02/10');
  assert.equal(formatDate(at(2025, 5, 3), now, 'fr-FR', t), '03/06/2025');
  assert.equal(formatDate(null, now, 'fr-FR', t), '—');
  const en = createI18n('en').t;
  assert.match(formatDate(at(2026, 9, 12, 10, 15), now, 'en-GB', en), /^Today 10:15$/);
});

// ---------- la corbeille ----------

const gfsSpec = FILES_MANIFEST.fichiers[0];
const pdfs = () => ({
  id: [1, 2, 3, 4], Identifiant: ['aa', 'bb', 'cc', 'dd'], Nom: ['Facture.pdf', 'Devis.pdf', 'Contrat été.pdf', 'Bon.pdf'], Type: ['pdf', 'pdf', 'pdf', 'pdf'], Date: [T0 - 9 * DAY, T0 - 8 * DAY, T0 - 7 * DAY, T0 - 6 * DAY],
  Auteur: ['marie@exemple.fr', 'marie@exemple.fr', 'marie@exemple.fr', 'marie@exemple.fr'],
  SupprimeLe: [null, T0 - 2 * DAY, ['D', T0 - DAY, 'UTC'], 0], SupprimePar: ['', 'paul@exemple.fr', 'Léa <lea@exemple.fr>', 'x'],
});

test('readFiles : un fichier dont la date de corbeille est remplie est à la corbeille, avec la date et l\'auteur du geste ; vide ou zéro : il est vivant', () => {
  const list = readFiles(FILES_MANIFEST, gfsSpec, pdfs());
  assert.deepEqual(list.map(file => file.trashed), [null, { ts: T0 - 2 * DAY, by: 'paul@exemple.fr' }, { ts: T0 - DAY, by: 'Léa <lea@exemple.fr>' }, null]);
  assert.deepEqual(list.map(file => [file.name, file.ts]), [['Facture.pdf', T0 - 9 * DAY], ['Devis.pdf', T0 - 8 * DAY], ['Contrat été.pdf', T0 - 7 * DAY], ['Bon.pdf', T0 - 6 * DAY]], 'la dernière modification reste lue');
});

test('readFiles : sans la clé `corbeille` du manifeste (une app), ou sans les colonnes dans la table (un document plus ancien), aucun fichier n\'est à la corbeille', () => {
  assert.deepEqual(readFiles(FILES_MANIFEST, { ...gfsSpec, corbeille: undefined }, pdfs()).map(file => file.trashed), [null, null, null, null]);
  const old = { id: [1], Identifiant: ['aa'], Nom: ['Facture.pdf'], Type: ['pdf'], Date: [T0] };
  assert.deepEqual(readFiles(FILES_MANIFEST, gfsSpec, old).map(file => file.trashed), [null]);
  assert.ok(files().every(file => file.trashed === null), 'les modèles d\'une app n\'ont jamais de corbeille de cette forme');
});

test('stampOf et authorOf : la date et l\'auteur de la dernière modification, ou, à la corbeille, ceux du geste qui l\'y a mis', () => {
  const [live, trashed] = readFiles(FILES_MANIFEST, gfsSpec, pdfs());
  assert.deepEqual([stampOf(live), authorOf(live)], [T0 - 9 * DAY, 'marie@exemple.fr']);
  assert.deepEqual([stampOf(trashed), authorOf(trashed)], [T0 - 2 * DAY, 'paul@exemple.fr']);
});

test('listItems : la corbeille est une liste à plat, la suppression la plus récente en haut ; le tri, le filtre de type et la recherche y valent', () => {
  const trashed = applyFiling(readFiles(FILES_MANIFEST, gfsSpec, pdfs()), null).filter(file => file.trashed);
  const view = extra => state({ view: 'trash', sort: { key: 'mod', dir: -1 }, ...extra });
  const result = listItems(trashed, view(), OPTIONS);
  assert.equal(result.flat, true);
  assert.deepEqual(result.rows.map(row => [row.kind, row.file.name]), [['file', 'Contrat été.pdf'], ['file', 'Devis.pdf']]);
  assert.deepEqual(listItems(trashed, view({ sort: { key: 'mod', dir: 1 } }), OPTIONS).rows.map(row => row.file.name), ['Devis.pdf', 'Contrat été.pdf']);
  assert.deepEqual(listItems(trashed, view({ sort: { key: 'by', dir: 1 } }), OPTIONS).rows.map(row => row.file.name), ['Contrat été.pdf', 'Devis.pdf'], 'par l\'auteur du geste : Léa avant Paul');
  assert.deepEqual(listItems(trashed, view({ q: 'ete' }), OPTIONS).rows.map(row => row.file.name), ['Contrat été.pdf'], 'accents ignorés');
  assert.deepEqual(listItems(trashed, view({ type: 'docx' }), OPTIONS).rows, []);
});

test('listItems : « Partagés avec moi » est une liste à plat, sans dossier, même quand un dossier est ouvert ; la recherche et le filtre de type y valent', () => {
  const arrivals = applyFiling(readFiles(FILES_MANIFEST, gfsSpec, pdfs()), null).filter(file => !file.trashed);
  const view = extra => state({ view: 'shared', path: 'Un/dossier', sort: { key: 'mod', dir: -1 }, ...extra });
  const result = listItems(arrivals, view(), OPTIONS);
  assert.equal(result.flat, true);
  assert.equal(result.rows.length, arrivals.length, 'toutes les arrivées sont montrées, quel que soit le dossier ouvert avant');
  assert.ok(result.rows.every(row => row.kind === 'file'));
  assert.deepEqual(listItems(arrivals, view({ q: arrivals[0].name.slice(0, 3) }), OPTIONS).rows.map(row => row.file.name).includes(arrivals[0].name), true);
  assert.deepEqual(listItems(arrivals, view({ type: 'docx' }), OPTIONS).rows, []);
});

// ----- les dossiers gardés sans fichier (contrats 6.4, point 11)

const folderTable = () => ({
  id: [1, 2, 3, 4, 5, 6, 7, 8],
  Utilisateur: ['moi@exemple.org', 'moi@exemple.org', 'autre@exemple.org', '@document', 'moi@exemple.org', 'moi@exemple.org', '', 'moi@exemple.org'],
  App: ['', '', '', 'gfs', 'publipostage', '', '', ''],
  Fichier: ['', '', '', 'apps', '12', '', '', ''],
  Dossier: ['Contrats', ' Factures // 2024/ ', 'Prive', '', 'Contrats', '', 'Commun', 'Contrats'],
});

test('readGfsFolders : les lignes d\'état de la personne (ni app ni fichier), normalisées, sans doublon ; ni les lignes de fichiers, ni les réservées, ni les autres personnes, ni un chemin vide', () => {
  assert.deepEqual(readGfsFolders(folderTable(), 'moi@exemple.org'), ['Contrats', 'Factures/2024']);
  assert.deepEqual(readGfsFolders(folderTable(), 'autre@exemple.org'), ['Prive']);
  assert.deepEqual(readGfsFolders(folderTable(), ''), ['Commun'], 'sans identité : le rangement commun au document');
  assert.deepEqual(readGfsFolders(null, 'moi@exemple.org'), []);
  assert.deepEqual(readGfsFolders({ id: [1], Utilisateur: ['moi@exemple.org'] }, 'moi@exemple.org'), [], 'une table sans les autres colonnes ne nomme aucun dossier');
});

test('un dossier gardé sans fichier existe : dans la liste des dossiers, avec ses parents, et dans l\'arbre, avec zéro fichier', () => {
  const list = files();
  const spare = ['Archives/2023', 'Formation/Vide'];
  assert.deepEqual(folderPaths(list, 'fr', spare), ['Archives', 'Archives/2023', 'Formation', 'Formation/Sessions', 'Formation/Vide']);
  assert.deepEqual(subfolders(list, '', 'fr', spare).map(f => [f.path, f.count, f.ts]), [['Archives', 0, null], ['Formation', 2, T0 - 3 * DAY]]);
  assert.deepEqual(subfolders(list, 'Archives', 'fr', spare).map(f => [f.path, f.name, f.count]), [['Archives/2023', '2023', 0]]);
  assert.deepEqual(subfolders(list, 'Formation', 'fr', spare).map(f => [f.path, f.count]), [['Formation/Sessions', 1], ['Formation/Vide', 0]], 'à côté de ceux que les fichiers nomment');
  assert.deepEqual(subfolders(list, 'Archives/2023', 'fr', spare), [], 'un dossier gardé n\'est pas son propre sous-dossier');
  assert.deepEqual(subfolders(list, 'Formation', 'fr', ['Formation/Sessions']).map(f => [f.path, f.count]), [['Formation/Sessions', 1]], 'gardé et nommé par un fichier : une seule fois, avec ses fichiers');
  const tree = treeRows(list, new Set(['Archives']), 'fr', spare);
  assert.deepEqual(tree.map(r => [r.path, r.depth, r.hasChildren, r.open]), [['Archives', 0, true, true], ['Archives/2023', 1, false, false], ['Formation', 0, true, false]]);
  assert.deepEqual(treeRows(list, new Set(), 'fr').map(r => r.path), ['Formation'], 'sans eux, rien ne change');
});

test('listItems : un dossier gardé est une ligne de la vue des dossiers, avant les fichiers ; une recherche, Récents et Favoris ne les montrent pas', () => {
  const options = { ...OPTIONS, spare: ['Archives', 'Formation/Vide'] };
  const root = listItems(files(), state(), options);
  assert.deepEqual(root.rows.map(r => (r.kind === 'folder' ? `dossier:${r.name}:${r.count}` : r.file.id)), ['dossier:Archives:0', 'dossier:Formation:2', '5', '6', '4']);
  const sub = listItems(files(), state({ path: 'Formation' }), options);
  assert.deepEqual(sub.rows.map(r => (r.kind === 'folder' ? `dossier:${r.name}` : r.file.id)), ['dossier:Sessions', 'dossier:Vide', '1']);
  const empty = listItems(files(), state({ path: 'Archives' }), options);
  assert.deepEqual(empty.rows, [], 'ouvert, il est vide');
  assert.equal(listItems(files(), state({ q: 'support' }), options).rows.every(r => r.kind === 'file'), true, 'une recherche liste des fichiers');
  assert.equal(listItems(files(), state({ view: 'recent' }), options).rows.every(r => r.kind === 'file'), true);
  assert.equal(listItems(files(), state({ view: 'fav' }), options).rows.every(r => r.kind === 'file'), true);
});

test('spareMoves : un dossier renommé ou déplacé emporte les dossiers gardés qu\'il est ou contient ; jamais en lui-même', () => {
  const spare = ['A/B', 'A/B/C', 'A/Bis', 'A', 'Z'];
  assert.deepEqual(spareMoves(spare, 'A/B', 'A/Q'), { drop: ['A/B', 'A/B/C'], add: ['A/Q', 'A/Q/C'] }, '« A/Bis » n\'est pas dans « A/B »');
  assert.deepEqual(spareMoves(spare, 'A/B', 'X/B'), { drop: ['A/B', 'A/B/C'], add: ['X/B', 'X/B/C'] });
  assert.deepEqual(spareMoves(spare, 'A/B', 'B'), { drop: ['A/B', 'A/B/C'], add: ['B', 'B/C'] }, 'vers la racine');
  assert.deepEqual(spareMoves(spare, 'A', 'M'), { drop: ['A/B', 'A/B/C', 'A/Bis', 'A'], add: ['M/B', 'M/B/C', 'M/Bis', 'M'] }, 'le dossier lui-même aussi');
  assert.deepEqual(spareMoves(spare, 'A', 'A/B/A'), { drop: [], add: [] }, 'dans un de ses sous-dossiers : rien');
  assert.deepEqual(spareMoves(spare, 'A/B', 'A/B'), { drop: [], add: [] });
  assert.deepEqual(spareMoves(spare, '', 'X'), { drop: [], add: [] }, 'la racine ne se déplace pas');
  assert.deepEqual(spareMoves([], 'A', 'B'), { drop: [], add: [] });
});

test('vacatedFolders : le dossier que le dernier fichier quitte est gardé, avec ses parents que plus rien ne nomme ; pas un dossier qui a encore un fichier, ni déjà gardé', () => {
  const list = [
    { key: 'p:1', app: 'p', id: '1', folder: 'A/B/C' }, { key: 'p:2', app: 'p', id: '2', folder: 'A/B' }, { key: 'p:3', app: 'p', id: '3', folder: 'A/D' }, { key: 'p:4', app: 'p', id: '4', folder: '' },
  ];
  const move = (id, folder) => ({ app: 'p', file: id, pinned: false, folder });
  assert.deepEqual(vacatedFolders(list, [move('1', 'X')]), ['A/B/C'], '« A/B » a encore le fichier 2, « A » le 3');
  assert.deepEqual(vacatedFolders(list, [move('3', '')]), ['A/D'], '« A » a encore les fichiers qui sont dans « A/B »');
  assert.deepEqual(vacatedFolders(list, [move('1', 'X'), move('2', 'X'), move('3', 'X')]), ['A', 'A/B', 'A/B/C', 'A/D'], 'tout un dossier part : lui et ses sous-dossiers, du plus haut au plus bas');
  assert.deepEqual(vacatedFolders(list, [move('1', 'X')], ['A/B/C']), [], 'déjà gardé');
  assert.deepEqual(vacatedFolders(list, [move('1', 'A/B/C/Z')]), [], 'le fichier va dans un sous-dossier : le dossier a toujours un fichier');
  assert.deepEqual(vacatedFolders(list, [move('1', 'A/B/C')]), [], 'rangé où il est déjà : rien ne part');
  assert.deepEqual(vacatedFolders(list, [move('4', 'X')]), [], 'la racine existe toujours');
  assert.deepEqual(vacatedFolders(list, []), []);
  assert.deepEqual(vacatedFolders(list, [move('1', 'X'), move('2', 'A/B/C')]), [], 'un fichier prend la place d\'un autre : « A/B/C » a toujours un fichier, « A/B » et « A » l\'ont en dessous');
});

test('vacatedFolders : un fichier qui part à la corbeille (`folder: null`) laisse son dossier ; un dossier gardé nomme ses parents ; un dossier gardé qui part laisse le sien', () => {
  const list = [{ key: 'p:1', app: 'p', id: '1', folder: 'A/B' }, { key: 'p:2', app: 'p', id: '2', folder: 'A' }];
  const trash = id => ({ app: 'p', file: id, folder: null });
  assert.deepEqual(vacatedFolders(list, [trash('1')]), ['A/B'], '« A » a encore le fichier 2');
  assert.deepEqual(vacatedFolders(list, [trash('2')]), [], '« A » a encore le fichier 1 dessous');
  assert.deepEqual(vacatedFolders(list, [trash('1'), trash('2')]), ['A', 'A/B'], 'le dernier fichier de chaque dossier part');
  assert.deepEqual(vacatedFolders(list, [trash('1')], ['A/B/C']), [], '« A/B » nomme le dossier gardé « A/B/C » : il n\'a pas besoin d\'une ligne de plus');
  assert.deepEqual(vacatedFolders([], [], ['P/E'], { drop: ['P/E'], add: ['Z/E'] }), ['P', 'P/E'], 'un dossier gardé qui change de place laisse son parent (l\'appelant ôte celui qui part) ; « Z » est nommé par la nouvelle ligne');
  assert.deepEqual(vacatedFolders([], [], ['P/E', 'P/F'], { drop: ['P/E'], add: ['Z/E'] }), ['P/E'], 'son parent reste nommé par un autre dossier gardé');
});

// ---------- le poids ----------

const weighted = () => ({
  id: [1, 2, 3], manualSort: [1, 2, 3], Nom: ['Convocation', 'Émargement', 'Support'], TypeModele: ['email', '', 'diaporama'], DateModif: [T0, null, T0 - DAY], ModifiePar: ['', 'Service RH', ''],
  Contenu: ['x'.repeat(1000), 'é'.repeat(500), 'y'.repeat(200)],
});

test('readFiles : le poids d\'un fichier est celui des octets de sa ligne, comme Grist les range (l\'identifiant et le rang n\'en sont pas)', () => {
  const list = readFiles(manifest, spec, weighted());
  // « Convocation » 11 + « email » 5 + date 4 + 1000 ; « Émargement » 11 + « Service RH » 10 + 1000 (500 « é » de 2 octets) ; « Support » 7 + « diaporama » 9 + date 4 + 200.
  assert.deepEqual(list.map(file => file.weight), [1020, 1021, 220]);
  assert.deepEqual(list.map(file => file.pieces), [[], [], []], 'un modèle n\'est pas une pièce jointe');
  assert.deepEqual(readFiles(manifest, spec, weighted(), [7, 8, 9]).map(file => file.weight), [7, 8, 9], 'l\'appelant qui a compté lui-même (la corbeille) donne les octets');
  assert.deepEqual(readFiles(manifest, spec, { id: [1], Nom: ['Seul'] }).map(file => file.weight), [4], 'des colonnes absentes ne pèsent rien');
});

test('readFiles : un PDF de GFS pèse sa ligne et sa pièce jointe (la colonne `Taille`) ; une copie qui cite la même pièce a le même poids, la somme la compte une fois', () => {
  const data = {
    id: [1, 2, 3], Identifiant: ['aa', 'bb', 'cc'], Nom: ['Facture.pdf', 'Facture (1).pdf', 'Vide.pdf'], Type: ['pdf', 'pdf', 'pdf'], Date: [T0, T0, T0], Auteur: ['', '', ''],
    Contenu: [['L', 7], ['L', 7], null], Taille: [3000000, 3000000, null],
  };
  const list = readFiles(FILES_MANIFEST, gfsSpec, data);
  // Ses cellules : « aa » 2, « Facture.pdf » 11, « pdf » 3, la date 4, l'auteur vide 0, `[7]` 3, la taille (3 000 000 : 3 octets) ; puis la pièce jointe elle-même.
  assert.equal(list[0].weight, 2 + 11 + 3 + 4 + 0 + 3 + 3 + 3000000);
  assert.equal(list[1].weight, 2 + 15 + 3 + 4 + 0 + 3 + 3 + 3000000, 'la copie : « Facture (1).pdf » fait 15 octets, la pièce est la même');
  assert.deepEqual(list.map(file => file.pieces), [[['7', 3000000]], [['7', 3000000]], []]);
  assert.equal(sumWeights(list.slice(0, 2)), list[0].weight + list[1].weight - 3000000, 'la somme compte la pièce une fois');
  assert.ok(list[2].weight < 100, 'sans pièce jointe : sa ligne seule');
});

test('subfolders : le poids d\'un dossier est celui de tous ses fichiers, sous-dossiers compris, une pièce jointe citée deux fois comptée une fois', () => {
  const file = (folder, weight, ...pieces) => ({ folder, weight, pieces, ts: null });
  const list = [file('A', 100), file('A/B', 50), file('A/B/C', 25, ['7', 20]), file('A/D', 30, ['7', 20]), file('E', 1000), file('', 5)];
  assert.deepEqual(subfolders(list, '', 'fr').map(f => [f.path, f.weight]), [['A', 100 + 50 + 25 + 30 - 20], ['E', 1000]]);
  assert.deepEqual(subfolders(list, 'A', 'fr').map(f => [f.path, f.weight]), [['A/B', 75], ['A/D', 30]]);
  assert.deepEqual(subfolders(list, 'A/B', 'fr').map(f => [f.path, f.weight]), [['A/B/C', 25]]);
  assert.ok(subfolders(list, '', 'fr').every(folder => !('sum' in folder)), 'le cumul de travail ne sort pas du modèle');
});

test('listItems : tri par poids, le plus lourd d\'abord ; les dossiers suivent le même ordre (par leur poids) ; à poids égal, l\'ordre des noms', () => {
  const list = applyFiling(readFiles(manifest, spec, weighted()), null);
  const folder = (name, ids) => ids.forEach(id => { list.find(file => file.id === id).folder = name; });
  folder('Petits', ['3']);
  folder('Gros', ['1', '2']);
  const names = result => result.rows.map(row => (row.kind === 'folder' ? `dossier:${row.name}` : row.file.id));
  assert.deepEqual(names(listItems(list, state({ sort: { key: 'poids', dir: -1 } }), OPTIONS)), ['dossier:Gros', 'dossier:Petits'], 'le plus lourd d\'abord');
  assert.deepEqual(names(listItems(list, state({ sort: { key: 'poids', dir: 1 } }), OPTIONS)), ['dossier:Petits', 'dossier:Gros']);
  assert.deepEqual(names(listItems(list, state({ sort: { key: 'name', dir: -1 } }), OPTIONS)), ['dossier:Petits', 'dossier:Gros'], 'par nom, descendant : l\'ordre d\'avant ne change pas');
  const flat = listItems(list, state({ q: 'e', sort: { key: 'poids', dir: -1 } }), OPTIONS);
  assert.deepEqual(flat.rows.map(row => row.file.weight), [1021, 1020, 220].filter(weight => flat.rows.some(row => row.file.weight === weight)), 'à plat : du plus lourd au plus léger');
  const same = applyFiling(readFiles(manifest, spec, { id: [1, 2, 3], Nom: ['Cc', 'Aa', 'Bb'] }), null);
  assert.deepEqual(listItems(same, state({ sort: { key: 'poids', dir: -1 } }), OPTIONS).rows.map(row => row.file.name), ['Aa', 'Bb', 'Cc'], 'même poids : l\'ordre des noms');
});

test('listItems : `covered` est ce que la liste couvre : les fichiers du dossier et de ses sous-dossiers, ou, à plat, ceux que la recherche garde', () => {
  const list = files();
  const root = listItems(list, state(), OPTIONS);
  assert.deepEqual(root.covered.map(file => file.id).sort(), ['1', '2', '4', '5', '6'], 'à la racine : tout, dossiers compris');
  assert.deepEqual(listItems(list, state({ path: 'Formation' }), OPTIONS).covered.map(file => file.id).sort(), ['1', '2'], 'un dossier : lui et ses sous-dossiers');
  assert.deepEqual(listItems(list, state({ path: 'Formation/Sessions' }), OPTIONS).covered.map(file => file.id), ['2']);
  assert.deepEqual(listItems(list, state({ q: 'convocation' }), OPTIONS).covered.map(file => file.id), ['2'], 'une recherche : ses résultats');
  assert.deepEqual(listItems(list, state({ view: 'fav' }), OPTIONS).covered.map(file => file.id), ['1']);
  assert.deepEqual(listItems(list, state({ type: 'grille' }), OPTIONS).covered.map(file => file.id), ['6']);
});
