// La lecture des fichiers pour l'explorateur (js/explorer-data.js, contrats 2.4 et 6.4) : le rangement de GFS passe devant celui de l'app, et un rangement
// illisible ne cache aucun fichier. Le port est une doublure ; ce que Grist rend vraiment se mesure dans le labo (run-explorer.mjs, run-ranger.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFiles, loadAttachments } from '../js/explorer-data.js';
import { FILES_ENTRY } from '../js/gfs-files.js';
import { sumWeights } from '../js/weight.js';
import { publipostage } from './helpers.mjs';

const manifest = publipostage();
const spec = manifest.fichiers[0];

const tables = () => ({
  [spec.table]: { id: [1, 2], Nom: ['Convocation', 'Attestation'], TypeModele: ['', ''], DateModif: [0, 0], ModifiePar: ['', ''] },
  [spec.rangement.table]: { id: [1, 2], Utilisateur: ['', ''], ModeleId: [1, 2], Dossier: ['Formation', 'Formation'], Epingle: [true, false] },
  gfs_rangement: { id: [1, 2], Utilisateur: ['@document', ''], App: ['gfs', 'publipostage'], Fichier: ['apps', '2'], Favori: [false, true], Dossier: ['', 'Archives'] },
});

function port(data, { broken = null } = {}) {
  return { doc: {
    listTables: async () => Object.keys(data),
    fetchTable: async name => { if (name === broken) throw new Error('accès refusé'); if (!data[name]) throw new Error(`table inconnue ${name}`); return data[name]; },
  } };
}

test('le rangement de GFS passe devant celui de l\'app (nom de table sans tenir compte de la casse) ; sans ligne de GFS, celui de l\'app reste', async () => {
  const { files, problems } = await loadFiles(port(tables()), [{ manifest }], '');
  const of = id => files.find(file => file.id === id);
  assert.deepEqual(problems, []);
  assert.deepEqual([of('1').folder, of('1').pinned], ['Formation', true]);
  assert.deepEqual([of('2').folder, of('2').pinned], ['Archives', true]);
});

test('le rangement de GFS d\'une autre personne ne s\'applique pas', async () => {
  const { files } = await loadFiles(port(tables()), [{ manifest }], 'quelqu.un@exemple.org');
  assert.deepEqual(files.map(file => [file.id, file.folder, file.pinned]), [['1', '', false], ['2', '', false]]);
});

test('un rangement de GFS illisible ne cache aucun fichier : ils restent à leur place d\'avant, et la console le dit', async () => {
  const warn = console.warn;
  const warned = [];
  console.warn = (...args) => warned.push(args[0]);
  try {
    const { files, problems } = await loadFiles(port(tables(), { broken: 'gfs_rangement' }), [{ manifest }], '');
    assert.deepEqual(files.map(file => [file.id, file.folder]), [['1', 'Formation'], ['2', 'Formation']]);
    assert.deepEqual(problems, []);
    assert.deepEqual(warned, ['GFS : le rangement de GFS est illisible']);
  } finally { console.warn = warn; }
});

test('les fichiers à la corbeille sont rendus à part : `files` ne montre que les vivants (ce que lisent « choisir » et « ouvrir »), `trash` les supprimés, avec leur dossier de retour', async () => {
  const data = {
    GFS_Fichiers: { id: [1, 2, 3], Identifiant: ['aa', 'bb', 'cc'], Nom: ['A.pdf', 'B.pdf', 'C.pdf'], Type: ['pdf', 'pdf', 'pdf'], Date: [10, 20, 30], Auteur: ['', '', ''], SupprimeLe: [null, 1762000000, null], SupprimePar: ['', 'paul@exemple.fr', ''] },
    gfs_rangement: { id: [1], Utilisateur: [''], App: ['gfs-fichiers'], Fichier: ['bb'], Favori: [true], Dossier: ['Factures'] },
  };
  const found = await loadFiles(port(data), [FILES_ENTRY], '');
  assert.deepEqual(found.files.map(file => file.key), ['gfs-fichiers:aa', 'gfs-fichiers:cc']);
  assert.deepEqual(found.trash.map(file => [file.key, file.trashed, file.folder]), [['gfs-fichiers:bb', { ts: 1762000000, by: 'paul@exemple.fr' }, 'Factures']]);
  assert.deepEqual(found.problems, []);
  assert.equal(found.stats.rows, 3);
});

test('sans fichier à la corbeille, ou avec des apps seulement : `trash` est vide', async () => {
  const found = await loadFiles(port(tables()), [{ manifest }], '');
  assert.deepEqual([found.files.length, found.trash], [2, []]);
});

test('les fichiers d\'une app mis à la corbeille ne sont plus dans sa table : ils se lisent dans GFS_Corbeille, gardent leur dossier (celui du rangement de l\'app), et ne se mêlent jamais aux vivants', async () => {
  const data = tables();
  data.GFS_Corbeille = {
    id: [5, 6], App: ['publipostage', 'form'], Table: [spec.table, spec.table], FichierId: ['9', '9'], Nom: ['Relance', 'D\'une autre app'], Type: ['email', ''], Date: [300, null], Auteur: ['', ''],
    SupprimeLe: [1762000000, 1762000000], SupprimePar: ['paul@exemple.fr', ''],
  };
  data[spec.rangement.table] = { id: [1, 2, 3], Utilisateur: ['', '', ''], ModeleId: [1, 2, 9], Dossier: ['Formation', 'Formation', 'Relances'], Epingle: [true, false, true] };
  const found = await loadFiles(port(data), [{ manifest }], '');
  assert.deepEqual(found.files.map(file => file.id), ['1', '2']);
  assert.deepEqual(found.trash.map(file => [file.key, file.row, file.name, file.type, file.folder, file.pinned, file.trashed]), [['publipostage:9', 5, 'Relance', 'email', 'Relances', true, { ts: 1762000000, by: 'paul@exemple.fr' }]]);
  assert.deepEqual(found.problems, []);
  assert.equal(found.stats.rows, 2, 'les statistiques comptent les fichiers de la table de l\'app, pas ceux de la corbeille');
});

test('une corbeille des apps illisible ne cache aucun fichier vivant, et la console le dit ; sans la table, la corbeille des apps est vide', async () => {
  const warn = console.warn;
  const warned = [];
  console.warn = (...args) => warned.push(args[0]);
  try {
    const data = { ...tables(), GFS_Corbeille: { id: [] } };
    const found = await loadFiles(port(data, { broken: 'GFS_Corbeille' }), [{ manifest }], '');
    assert.deepEqual(found.files.map(file => file.id), ['1', '2']);
    assert.deepEqual(found.trash, []);
    assert.deepEqual(warned, ['GFS : la corbeille des apps est illisible']);
  } finally { console.warn = warn; }
  assert.deepEqual((await loadFiles(port(tables()), [{ manifest }], '')).trash, []);
});

test('les dossiers que la personne garde sans fichier (lignes d\'état de GFS_Rangement : ni app ni fichier) sont rendus à part, pour elle seule ; ils ne sont jamais des fichiers ni des favoris', async () => {
  const data = tables();
  data.gfs_rangement = {
    id: [1, 2, 3, 4, 5, 6],
    Utilisateur: ['@document', 'ana@exemple.org', 'ana@exemple.org', 'ben@exemple.org', 'ana@exemple.org', 'ana@exemple.org'],
    App: ['gfs', '', '', '', 'publipostage', ''],
    Fichier: ['apps', '', '', '', '2', ''],
    Favori: [false, false, false, false, true, false],
    Dossier: ['', 'Contrats/2026', ' Contrats // 2026/ ', 'De Ben', 'Archives', ''],
  };
  const ana = await loadFiles(port(data), [{ manifest }], 'ana@exemple.org');
  assert.deepEqual(ana.folders, ['Contrats/2026'], 'une seule fois, normalisé ; le dossier d\'un autre, la ligne réservée, la ligne d\'un fichier et une ligne sans dossier n\'en sont pas');
  assert.deepEqual(ana.files.map(file => [file.id, file.folder, file.pinned]), [['1', '', false], ['2', 'Archives', true]], 'les lignes d\'état ne rangent aucun fichier ; la ligne du fichier 2 est la sienne');
  assert.deepEqual((await loadFiles(port(data), [{ manifest }], 'ben@exemple.org')).folders, ['De Ben']);
  assert.deepEqual((await loadFiles(port(data), [{ manifest }], '')).folders, [], 'sans adresse connue, le rangement est celui des lignes sans personne : aucune ici');
});

test('sans la table de GFS, ou avec une table illisible, aucun dossier n\'est gardé', async () => {
  const data = tables();
  delete data.gfs_rangement;
  assert.deepEqual((await loadFiles(port(data), [{ manifest }], '')).folders, []);
  const warn = console.warn;
  console.warn = () => {};
  try { assert.deepEqual((await loadFiles(port(tables(), { broken: 'gfs_rangement' }), [{ manifest }], '')).folders, []); } finally { console.warn = warn; }
});

// ---------- le poids ----------

test('le poids : un PDF de GFS pèse sa ligne et sa pièce jointe (`Taille`), une copie qui cite la même pièce ne la compte pas deux fois dans une somme', async () => {
  const data = {
    GFS_Fichiers: {
      id: [1, 2, 3], Identifiant: ['aa', 'bb', 'cc'], Nom: ['Facture.pdf', 'Facture (1).pdf', 'Devis.pdf'], Type: ['pdf', 'pdf', 'pdf'], Date: [10, 10, 30], Auteur: ['', '', ''],
      Contenu: [['L', 7], ['L', 7], ['L', 8]], Taille: [3000000, 3000000, 500000], SupprimeLe: [null, null, 1762000000], SupprimePar: ['', '', 'paul@exemple.fr'],
    },
  };
  const { files, trash } = await loadFiles(port(data), [FILES_ENTRY], '');
  assert.deepEqual(files.map(file => file.pieces), [[['7', 3000000]], [['7', 3000000]]]);
  assert.ok(files[0].weight > 3000000 && files[0].weight < 3000100, 'la pièce et quelques octets de ligne');
  assert.equal(sumWeights(files), files[0].weight + files[1].weight - 3000000, 'la pièce citée deux fois est comptée une fois');
  assert.ok(trash[0].weight > 500000 && trash[0].weight < 500100, 'à la corbeille, le fichier pèse encore (sa pièce jointe est gardée)');
});

test('le poids : un fichier d\'une app pèse les octets de sa ligne, et une entrée de GFS_Corbeille tout ce que la corbeille garde (la copie JSON de la ligne y est pour presque tout)', async () => {
  const data = tables();
  data[spec.table].Contenu = ['x'.repeat(1000), 'é'.repeat(500)];
  const snapshot = JSON.stringify({ format: 1, id: 9, valeurs: { Nom: 'Relance', Contenu: 'é'.repeat(3000) } });
  data.GFS_Corbeille = {
    id: [5], Identifiant: ['aabbccddeeff'], App: ['publipostage'], Table: [spec.table], FichierId: ['9'], Nom: ['Relance'], Type: ['email'], Date: [300], Auteur: [''],
    SupprimeLe: [1762000000], SupprimePar: ['paul@exemple.fr'], Instantane: [snapshot],
  };
  const found = await loadFiles(port(data), [{ manifest }], '');
  const bytes = text => Buffer.byteLength(text);
  // Convocation : « Convocation » 11, type vide 0, date 0 (1 octet), par vide 0, contenu 1000 ; Attestation : « Attestation » 11, 1, 0, 500 × 2.
  assert.deepEqual(found.files.map(file => file.weight), [11 + 0 + 1 + 0 + 1000, 11 + 0 + 1 + 0 + 1000]);
  // La ligne de la corbeille : ses onze colonnes (la date 300 : 2 octets, celle du geste : 4) et le JSON.
  const entry = bytes('aabbccddeeff') + bytes('publipostage') + bytes(spec.table) + 1 + 7 + 5 + 2 + 0 + 4 + bytes('paul@exemple.fr') + bytes(snapshot);
  assert.equal(found.trash[0].weight, entry);
  assert.ok(found.trash[0].weight > 6000, 'la copie JSON compte : c\'est elle que la corbeille garde dans le document');
});

// Les versions d'un modèle (contrats 2.4, `poids.liees`) : la table `Publipostage_Versions`, rangée par `Jeton`, que le manifeste de GFS déclare liée aux modèles.
const withVersions = () => {
  const data = tables();
  data[spec.table].Jeton = ['jeton-1', ''];
  data.Publipostage_Versions = { id: [1, 2, 3], Jeton: ['jeton-1', 'jeton-1', 'orphelin'], Donnees: ['v'.repeat(400), 'w'.repeat(600), 'o'.repeat(900)] };
  return data;
};

test('le poids : un modèle compte ses versions (les lignes de Publipostage_Versions qui portent son jeton) ; un modèle sans jeton, ou dont aucune version ne porte le jeton, ne compte que sa ligne', async () => {
  const alone = await loadFiles(port(tables()), [{ manifest }], '');
  const found = await loadFiles(port(withVersions()), [{ manifest }], '');
  // « jeton-1 » : sa colonne Jeton 7 octets dans la ligne du modèle ; les deux versions : jeton 7 + id absent + 400 ou 600 octets.
  const versions = (7 + 400) + (7 + 600);
  assert.equal(found.files[0].weight, alone.files[0].weight + 7 + versions, 'la ligne (avec sa colonne Jeton de plus) et ses deux versions');
  assert.equal(found.files[1].weight, alone.files[1].weight, 'le modèle sans jeton n\'a pas de versions');
  assert.ok(found.files[0].pieces.every(([key]) => key.startsWith('liee:')), 'les versions ne sont pas des pièces jointes');
});

test('le poids : les versions d\'un même jeton ne comptent qu\'une fois dans une somme (deux modèles au même jeton, une anomalie) ; un dossier somme les modèles et leurs versions', async () => {
  const data = withVersions();
  data[spec.table].Jeton = ['jeton-1', 'jeton-1'];
  const { files } = await loadFiles(port(data), [{ manifest }], '');
  const versions = (7 + 400) + (7 + 600);
  assert.equal(sumWeights(files), files[0].weight + files[1].weight - versions);
});

test('le poids : sans la table des versions (l\'app ne l\'a pas encore créée), le modèle ne pèse que sa ligne ; une table illisible est dite, ne cache aucun fichier et ne compte rien', async () => {
  const data = withVersions();
  delete data.Publipostage_Versions;
  const bare = await loadFiles(port(data), [{ manifest }], '');
  assert.equal(bare.files.length, 2);
  assert.deepEqual(bare.files.map(file => file.pieces), [[], []]);
  const warnings = [];
  const realWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    const broken = await loadFiles(port(withVersions(), { broken: 'Publipostage_Versions' }), [{ manifest }], '');
    assert.equal(broken.files.length, 2, 'les fichiers sont tous là');
    assert.equal(broken.files[0].weight, bare.files[0].weight, 'sans les versions : la ligne seule');
    assert.equal(broken.problems.length, 0, 'une estimation qui perd une table n\'est pas un problème de l\'app');
  } finally { console.warn = realWarn; }
  assert.ok(warnings.some(line => /Publipostage_Versions.*illisible/.test(line)), 'la console le dit');
});

test('le poids : à la corbeille, une entrée ne compte que ce que GFS_Corbeille garde ; les versions restent dans leur table (l\'app les purge comme orphelines) et ne la suivent pas', async () => {
  const data = withVersions();
  data.GFS_Corbeille = {
    id: [5], Identifiant: ['aabbccddeeff'], App: ['publipostage'], Table: [spec.table], FichierId: ['9'], Nom: ['Relance'], Type: ['email'], Date: [300], Auteur: [''],
    SupprimeLe: [1762000000], SupprimePar: [''], Instantane: [JSON.stringify({ format: 1, id: 9, valeurs: { Nom: 'Relance', Jeton: 'jeton-1' } })],
  };
  const { trash } = await loadFiles(port(data), [{ manifest }], '');
  assert.equal(trash.length, 1);
  assert.deepEqual(trash[0].pieces, []);
});

test('la case « + pièces jointes » : la table `_grist_Attachments` est lue telle que l\'API des widgets la rend, et seulement quand on la demande ; un refus de Grist est rendu, sans arrêter personne', async () => {
  const table = { id: [1, 2], fileIdent: ['a.pdf', 'b.jpg'], fileSize: [10, 20], timeDeleted: [null, null] };
  const asked = [];
  const reading = { doc: { fetchTable: async name => { asked.push(name); return table; } } };
  assert.deepEqual(asked, [], 'rien n\'est lu tant qu\'on ne le demande pas');
  assert.deepEqual(await loadAttachments(reading), { data: table });
  assert.deepEqual(asked, ['_grist_Attachments']);
  const refused = await loadAttachments({ doc: { fetchTable: async () => { throw new Error('accès refusé'); } } });
  assert.equal(refused.data, undefined);
  assert.equal(refused.error.message, 'accès refusé');
});

test('une table d\'app illisible est dite (l\'app et la raison) et n\'arrête pas la lecture des autres', async () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    const data = { ...tables(), GFS_Fichiers: { id: [1], Identifiant: ['aa'], Nom: ['A.pdf'], Type: ['pdf'], Date: [10], Auteur: [''] } };
    const found = await loadFiles(port(data, { broken: spec.table }), [{ manifest }, FILES_ENTRY], '');
    assert.deepEqual(found.problems, [{ app: 'publipostage', reason: 'accès refusé' }]);
    assert.deepEqual(found.files.map(file => file.key), ['gfs-fichiers:aa'], 'les fichiers de GFS se lisent quand même');
    assert.deepEqual([found.stats.tables, found.stats.rows], [1, 1], 'seules les tables lues comptent');
  } finally { console.warn = warn; }
});

test('la corbeille des apps ne rend que les fichiers des apps dont la table se supprime par ligne (`suppression.ligne`), et rien d\'une autre app ni d\'une autre table', async () => {
  const bin = {
    id: [1, 2, 3], Identifiant: ['b1', 'b2', 'b3'], App: ['publipostage', 'form', 'publipostage'], Table: [spec.table, spec.table, 'Autre'], FichierId: ['7', '8', '9'], Nom: ['Vieux', 'Autre app', 'Autre table'],
    Type: ['', '', ''], Date: [0, 0, 0], Auteur: ['', '', ''], SupprimeLe: [1762000000, 1762000000, 1762000000], SupprimePar: ['', '', ''], Instantane: ['{}', '{}', '{}'], Dossier: ['', '', ''],
  };
  const data = { ...tables(), GFS_Corbeille: bin };
  const withRecipe = await loadFiles(port(data), [{ manifest }], '');
  assert.deepEqual(withRecipe.trash.map(file => file.name), ['Vieux'], 'la ligne de cette app et de cette table seulement');
  const without = { ...manifest, fichiers: [{ ...spec, suppression: undefined }] };
  const none = await loadFiles(port(data), [{ manifest: without }], '');
  assert.deepEqual(none.trash, [], 'sans `suppression.ligne`, la table n\'a pas de corbeille de GFS');
});

test('un fichier placé dans un espace en prend le dossier ; les dossiers de l\'espace sont ajoutés à ceux de la personne', async () => {
  const data = {
    ...tables(),
    GFS_Espaces: { id: [1], Cle: ['achats'], Nom: ['Achats'] },
    GFS_Placement: { id: [1], Cible: ['publipostage:1'], Espace: ['achats'], Dossier: ['Contrats'] },
  };
  const { files, folders, spaces } = await loadFiles(port(data), [{ manifest }], '');
  assert.equal(files.find(file => file.id === '1').folder, 'Espaces/Achats/Contrats');
  assert.equal(files.find(file => file.id === '2').folder, 'Archives');
  assert.ok(folders.includes('Espaces/Achats'), 'l\'espace est un dossier');
  assert.equal(spaces.spaces.length, 1);
});

test('les fichiers reçus d\'un autre document (GFS_Recus, GFS_Recus_2…) sont lus à part : jamais dans `files`, tous états confondus, un document sans partage en rend une liste vide', async () => {
  const arrival = (id, name, extra = {}) => ({ id: [1], Identifiant: [id], Nom: [name], Type: ['pdf'], Date: [1762000000], Auteur: ['compta@exemple.fr'], Contenu: [['L', 1]], Taille: [100], ...Object.fromEntries(Object.entries(extra).map(([key, value]) => [key, [value]])) });
  const data = { ...tables(), GFS_Recus: arrival('r1', 'Facture.pdf'), GFS_Recus_2: arrival('r2', 'Devis.pdf', { Accepte: true, Refuse: false }) };
  const loaded = await loadFiles(port(data), [{ manifest }], '');
  assert.deepEqual(loaded.received.map(file => [file.name, file.received.table, file.received.state]), [['Facture.pdf', 'GFS_Recus', 'pending'], ['Devis.pdf', 'GFS_Recus_2', 'accepted']]);
  assert.deepEqual(loaded.files.map(file => file.id).sort(), ['1', '2'], 'les arrivées ne sont pas des fichiers vivants : choisir, ouvrir et lire ne les voient pas');
  assert.deepEqual((await loadFiles(port(tables()), [{ manifest }], '')).received, []);
});
