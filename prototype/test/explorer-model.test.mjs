// Le modèle de l'explorateur : lecture des tables d'après le manifeste (contrats 2.4), rangement (6.4), dossiers, recherche, tri.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFiles, readFiling, applyFiling, subfolders, treeRows, pathParts, listItems, typeChoices, person, formatDate, normalizePath, inside }
  from '../js/explorer-model.js';
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
