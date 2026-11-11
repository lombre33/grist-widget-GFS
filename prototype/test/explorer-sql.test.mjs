// La lecture légère des tables de fichiers (js/explorer/explorer-sql.js, carte « Lire seulement les colonnes utiles » de l'audit vitesse du 10/11, faits vérifiés 83) : les mêmes fichiers et le même poids que la
// lecture complète, sans la cellule lourde, et rien de changé tant que le document n'est pas lourd ou que Grist refuse. Les lectures SQL se jouent dans un vrai SQLite (`node:sqlite`) qui garde les tables
// comme Grist les garde (texte, entiers de toutes tailles, réels, listes en JSON) ; la lecture dans un vrai Grist se mesure au labo (faits vérifiés 83).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFiles } from '../js/explorer/explorer-data.js';
import { createLightReader, neededColumns, rowsStatement, schemaStatement, readRows, HEAVY_BYTES } from '../js/explorer/explorer-sql.js';
import { rowWeigher } from '../js/weight/weight.js';
import { FILES_ENTRY, FILES_MANIFEST } from '../js/files/gfs-files.js';
import { BIN_COLUMNS } from '../js/files/gfs-trash.js';
import { publipostage, form, bi } from './helpers.mjs';

const sqlite = await import('node:sqlite').catch(() => null);
const skip = sqlite ? false : 'node:sqlite absent de ce Node';
const AFFINITY = { Text: 'TEXT', Int: 'INTEGER', Numeric: 'REAL', Bool: 'BOOLEAN', Attachments: 'TEXT', ChoiceList: 'TEXT' };
const gristType = type => type.split(':')[0];

// Une base comme celle de Grist : ses tables internes (`_grist_Tables`, `_grist_Tables_column`) et des tables d'utilisateur { colonnes: [{ id, type }], lignes: [{ colonne: valeur }] }.
function makeDb(tables) {
  const db = new sqlite.DatabaseSync(':memory:');
  db.exec('CREATE TABLE _grist_Tables (id INTEGER PRIMARY KEY, tableId TEXT); CREATE TABLE _grist_Tables_column (id INTEGER PRIMARY KEY, parentId INTEGER, colId TEXT, type TEXT)');
  let table = 0;
  for (const [name, { colonnes, lignes }] of Object.entries(tables)) {
    table += 1;
    db.prepare('INSERT INTO _grist_Tables (id, tableId) VALUES (?, ?)').run(table, name);
    const all = [...colonnes, { id: 'manualSort', type: 'ManualSortPos' }, { id: 'gristHelper_Display', type: 'Any' }];
    for (const column of all) db.prepare('INSERT INTO _grist_Tables_column (parentId, colId, type) VALUES (?, ?, ?)').run(table, column.id, column.type);
    db.exec(`CREATE TABLE "${name}" (id INTEGER PRIMARY KEY, manualSort REAL, gristHelper_Display TEXT, ${colonnes.map(column => `"${column.id}" ${AFFINITY[gristType(column.type)] || 'NUMERIC'}`).join(', ')})`);
    lignes.forEach((row, i) => {
      const names = ['id', 'manualSort', 'gristHelper_Display', ...colonnes.map(column => column.id)];
      db.prepare(`INSERT INTO "${name}" (${names.map(n => `"${n}"`).join(', ')}) VALUES (${names.map(() => '?').join(', ')})`)
        .run(i + 1, i + 1, 'aide de Grist', ...colonnes.map(column => (row[column.id] === undefined ? null : row[column.id])));
    });
  }
  const read = statement => db.prepare(statement).all();
  const calls = [];
  // Ce que `fetchTable` rend : toutes les colonnes (sans celle d'aide), les booléens en booléens, les listes à la façon de l'API des widgets (['L', …]).
  const fetchTable = name => {
    const { colonnes } = tables[name];
    const rows = read(`SELECT * FROM "${name}" ORDER BY id`);
    const data = { id: rows.map(row => row.id), manualSort: rows.map(row => row.manualSort) };
    for (const { id, type } of colonnes) {
      data[id] = rows.map(row => {
        const value = row[id];
        if (gristType(type) === 'Bool') return Boolean(value);
        if (value !== null && (type === 'ChoiceList' || type === 'Attachments')) return ['L', ...JSON.parse(value)];
        return value;
      });
    }
    return data;
  };
  return {
    sql: async statement => { calls.push(statement); return read(statement); },
    port: { doc: { listTables: async () => Object.keys(tables), fetchTable: async name => { calls.push(`fetchTable ${name}`); return fetchTable(name); } } },
    calls,
    fetchTable,
  };
}

const heavy = size => `<p>${'é💥'.repeat(Math.ceil(size / 6))}</p>`;
const INTS = [0, 1, -1, 127, 128, -128, 32767, 32768, 8388607, 8388608, 2147483647, 2147483648, 140737488355327, 140737488355328];

const modeles = () => ({
  colonnes: [
    { id: 'Nom', type: 'Text' }, { id: 'Contenu', type: 'Text' }, { id: 'TypeModele', type: 'Text' }, { id: 'DateModif', type: 'DateTime:UTC' }, { id: 'ModifiePar', type: 'Text' },
    { id: 'Jeton', type: 'Text' }, { id: 'EstParDefaut', type: 'Bool' }, { id: 'Taille', type: 'Int' }, { id: 'Reel', type: 'Numeric' }, { id: 'Etiquettes', type: 'ChoiceList' },
  ],
  lignes: [
    { Nom: 'Convocation', Contenu: heavy(3000), TypeModele: 'document', DateModif: 1762000000, ModifiePar: 'paul@exemple.fr', Jeton: 'j1', EstParDefaut: 1, Taille: INTS[0], Reel: 3.5, Etiquettes: '["a","b"]' },
    { Nom: 'Attestation', Contenu: heavy(40), TypeModele: 'grille', DateModif: 1762000100.5, ModifiePar: '', Jeton: 'j2', EstParDefaut: 0, Taille: INTS[9], Reel: 3, Etiquettes: '[]' },
    { Nom: 'Réglages', Contenu: heavy(100), TypeModele: 'reglages', DateModif: null, ModifiePar: null, Jeton: 'j3', EstParDefaut: 0, Taille: INTS[13], Reel: null },
    { Nom: 'Sans jeton', Contenu: '', TypeModele: 'document', DateModif: 1, ModifiePar: 'x', Jeton: '', EstParDefaut: 0, Taille: INTS[12], Reel: -2.25, Etiquettes: null },
    ...INTS.map((n, i) => ({ Nom: `Entier ${i}`, Contenu: 'x'.repeat(i), TypeModele: 'document', DateModif: n, ModifiePar: 'a', Jeton: `i${i}`, EstParDefaut: 0, Taille: n, Reel: n })),
  ],
});

const document = () => ({
  Publipostage_Modeles: modeles(),
  Publipostage_Versions: { colonnes: [{ id: 'Jeton', type: 'Text' }, { id: 'Contenu', type: 'Text' }, { id: 'Numero', type: 'Int' }], lignes: [
    { Jeton: 'j1', Contenu: heavy(2000), Numero: 1 }, { Jeton: 'j1', Contenu: heavy(500), Numero: 2 }, { Jeton: 'j2', Contenu: heavy(90), Numero: 1 }, { Jeton: '', Contenu: 'orpheline', Numero: 7 },
  ] },
  GFS_Fichiers: { colonnes: [{ id: 'Identifiant', type: 'Text' }, { id: 'Nom', type: 'Text' }, { id: 'Type', type: 'Text' }, { id: 'Date', type: 'DateTime:UTC' }, { id: 'Auteur', type: 'Text' },
    { id: 'Contenu', type: 'Attachments' }, { id: 'Taille', type: 'Int' }, { id: 'Origine', type: 'Text' }, { id: 'SupprimeLe', type: 'DateTime:UTC' }, { id: 'SupprimePar', type: 'Text' }], lignes: [
    { Identifiant: 'aa', Nom: 'A.pdf', Type: 'pdf', Date: 10, Auteur: 'p', Contenu: '[7]', Taille: 90000, Origine: 'import' },
    { Identifiant: 'bb', Nom: 'B.pdf', Type: 'pdf', Date: 20, Auteur: 'p', Contenu: '[8]', Taille: 500, Origine: 'import', SupprimeLe: 1762000000, SupprimePar: 'paul@exemple.fr' },
  ] },
  GFS_Corbeille: { colonnes: BIN_COLUMNS.map(column => ({ id: column.id, type: column.type })), lignes: [
    { Identifiant: 'x1', App: 'publipostage', Table: 'Publipostage_Modeles', FichierId: '9', Nom: 'Vieux modèle', Type: 'document', Date: 5, Auteur: 'p', SupprimeLe: 1762000500, SupprimePar: 'p', Instantane: heavy(1200) },
    { Identifiant: 'x2', App: 'form', Table: 'FormPlus_Formulaires', FichierId: '3', Nom: 'Autre app', Type: 'formulaire', Date: 6, Auteur: 'q', SupprimeLe: 1762000600, SupprimePar: 'q', Instantane: heavy(300) },
  ] },
});

test('neededColumns : les colonnes que readFiles lit, d\'après le manifeste, sans `id` ni doublon', () => {
  assert.deepEqual(neededColumns(publipostage().fichiers[0]), ['Nom', 'TypeModele', 'DateModif', 'ModifiePar', 'Jeton']);
  assert.deepEqual(neededColumns(form().fichiers[0]), ['Nom', 'TypeFormulaire', 'DateModif', 'ModifiePar']);
  assert.deepEqual(neededColumns(FILES_MANIFEST.fichiers[0]), ['Identifiant', 'Nom', 'Type', 'Date', 'Auteur', 'SupprimeLe', 'SupprimePar', 'Contenu', 'Taille']);
});

test('rowsStatement : la cellule lourde n\'est jamais lue, seulement comptée ; les colonnes voulues et les nombres le sont ; les noms viennent de Grist et restent entre guillemets', () => {
  const columns = [{ colId: 'Nom', type: 'Text' }, { colId: 'Contenu', type: 'Text' }, { colId: 'Taille', type: 'Int' }, { colId: 'Etiquettes', type: 'ChoiceList' }, { colId: 'a"; DROP TABLE x; --', type: 'Text' }];
  const { statement, keep } = rowsStatement('Publipostage_Modeles', columns, new Set(['Nom']));
  assert.deepEqual(keep.map(column => column.colId), ['Nom', 'Taille']);
  assert.ok(statement.startsWith('SELECT id, "Nom", "Taille", COALESCE(length(CAST("Contenu" AS BLOB)), 0) + COALESCE(length(CAST("Etiquettes" AS BLOB)), 0) AS gfs_octets FROM "Publipostage_Modeles"'), statement);
  assert.ok(!/DROP/.test(statement), 'un nom qui n\'est pas un identifiant de Grist est écarté');
  assert.equal(schemaStatement(['bien', 'mal; DROP']).includes('DROP'), false);
  assert.equal(schemaStatement(['mal; DROP']), null);
  const wide = Array.from({ length: 40 }, (_, i) => ({ colId: `Colonne_assez_longue_${i}`, type: i % 3 ? 'Text' : 'Int' }));
  assert.ok(encodeURIComponent(rowsStatement('Une_table', wide, new Set()).statement).length < 3500, 'l\'adresse de la lecture reste courte (un GET : les serveurs coupent vers 8 Ko)');
});

test('readRows : une liste de Grist se lit comme fetchTable la rend ; un texte qui n\'en est pas une reste tel quel ; le poids ajoute les octets comptés par SQL à ceux des colonnes lues', () => {
  const keep = [{ colId: 'Contenu', type: 'Attachments' }, { colId: 'Taille', type: 'Int' }, { colId: 'Nom', type: 'Text' }];
  const { data, weights } = readRows([{ id: 4, Contenu: '[7,9]', Taille: 300, Nom: 'é', gfs_octets: 10 }, { id: 5, Contenu: 'pas une liste', Taille: null, Nom: null, gfs_octets: 0 }], keep, new Set(['Contenu', 'Nom']));
  assert.deepEqual(data, { id: [4, 5], Contenu: [['L', 7, 9], 'pas une liste'], Taille: [300, null], Nom: ['é', null] });
  assert.deepEqual(weights, [10 + 5 + 2 + 2, 13]);
});

test('les deux lectures donnent les mêmes fichiers, le même poids et les mêmes lignes liées, à l\'octet près, pour chaque manifeste (SQLite réel)', { skip }, async () => {
  const db = makeDb(document());
  const reader = createLightReader({ sql: db.sql, threshold: 0 });
  await reader.prepare(['Publipostage_Modeles', 'Publipostage_Versions', 'GFS_Fichiers', 'GFS_Corbeille'].map(table => ({ table, wanted: [] })));
  reader.learn(1);
  for (const manifest of [publipostage(), FILES_MANIFEST]) {
    const spec = manifest.fichiers[0];
    const full = db.fetchTable(spec.table);
    const light = await reader.read(spec.table, neededColumns(spec));
    assert.deepEqual(light.weights, full.id.map((unused, i) => rowWeigher(full)(i)), `${spec.table} : les poids des lignes`);
    assert.ok(!('Contenu' in light.data) || spec.table === 'GFS_Fichiers', 'la cellule lourde n\'est pas rendue');
  }
  const versions = db.fetchTable('Publipostage_Versions');
  const lightVersions = await reader.read('Publipostage_Versions', ['Jeton']);
  assert.deepEqual(lightVersions.weights, versions.id.map((unused, i) => rowWeigher(versions)(i)));
});

test('loadFiles : la première lecture est complète et apprend que le document est lourd ; la suivante est légère, sans toucher aux tables lourdes, et rend exactement la même chose', { skip }, async () => {
  const db = makeDb(document());
  const reader = createLightReader({ sql: db.sql, threshold: 1000 });
  const apps = [{ manifest: publipostage() }, { manifest: form() }, FILES_ENTRY];
  const first = await loadFiles(db.port, apps, '', reader);
  assert.equal(first.stats.light, false);
  assert.ok(first.stats.bytes >= 1000, 'la lecture complète a compté le poids des fichiers');
  assert.ok(db.calls.includes('fetchTable Publipostage_Modeles') && !db.calls.some(call => call.startsWith('SELECT')), 'la première lecture n\'a demandé aucun SQL');
  db.calls.length = 0;
  const second = await loadFiles(db.port, apps, '', reader);
  assert.equal(second.stats.light, true);
  assert.deepEqual(second.files, first.files);
  assert.deepEqual(second.trash, first.trash);
  assert.deepEqual(second.problems, []);
  assert.equal(second.stats.bytes, first.stats.bytes);
  assert.ok(first.files.some(file => file.weight > 2000) && first.trash.some(file => file.app === 'publipostage'), 'les modèles lourds et la corbeille des apps y sont');
  const heavyTables = ['Publipostage_Modeles', 'Publipostage_Versions', 'GFS_Corbeille'];
  assert.ok(!db.calls.some(call => heavyTables.some(name => call === `fetchTable ${name}`)), `aucune table lourde n'est relue en entier : ${db.calls.filter(call => call.startsWith('fetch'))}`);
  const selected = call => call.split(', COALESCE')[0].split(', 0 AS gfs_octets')[0]; // la part de la lecture qui rend des cellules, sans le compte des octets
  const reads = db.calls.filter(call => call.startsWith('SELECT id'));
  assert.equal(reads.length, 4, 'une lecture SQL par table : modèles, versions, fichiers de GFS, corbeille');
  for (const call of reads) {
    if (/FROM "Publipostage_(Modeles|Versions)"$/.test(call)) assert.ok(!selected(call).includes('"Contenu"'), `le contenu d'un modèle n'est pas rendu : ${call}`);
    if (call.endsWith('FROM "GFS_Corbeille"')) assert.ok(!selected(call).includes('"Instantane"'), `la copie JSON de la corbeille n'est pas rendue : ${call}`);
  }
  assert.ok(reads.some(call => call.includes('length(CAST("Contenu" AS BLOB))')) && reads.some(call => call.includes('length(CAST("Instantane" AS BLOB))')), 'elles sont comptées, pour le poids');
});

test('un document léger ne demande rien de SQL, jamais : la lecture complète d\'avant reste la seule', { skip }, async () => {
  const db = makeDb(document());
  const reader = createLightReader({ sql: db.sql });
  await loadFiles(db.port, [{ manifest: publipostage() }], '', reader);
  await loadFiles(db.port, [{ manifest: publipostage() }], '', reader);
  assert.equal(reader.isActive(), false);
  assert.ok(HEAVY_BYTES > 100000);
  assert.deepEqual(db.calls.filter(call => call.startsWith('SELECT')), []);
});

test('un refus de Grist (403 : qui ne peut pas tout copier), une lecture coupée ou un serveur muet éteignent la lecture légère pour la session : l\'explorateur relit comme avant, sans rien perdre', { skip }, async () => {
  for (const failure of [Object.assign(new Error('refus'), { kind: 'http', status: 403 }), Object.assign(new Error('trop lent'), { kind: 'http', status: 400 }), new Error('muet')]) {
    const db = makeDb(document());
    let asked = 0;
    const reader = createLightReader({ sql: async () => { asked += 1; throw failure; }, threshold: 0 });
    const apps = [{ manifest: publipostage() }, FILES_ENTRY];
    const first = await loadFiles(db.port, apps, '', reader);
    const second = await loadFiles(db.port, apps, '', reader);
    assert.equal(second.stats.light, false);
    assert.equal(reader.isActive(), false, failure.message);
    assert.deepEqual(second.files, first.files, 'les mêmes fichiers, lus en entier');
    assert.equal(asked, 1, 'une seule tentative : plus aucune requête une fois éteinte');
    assert.deepEqual(second.problems, []);
  }
});

test('une lecture de lignes coupée (la lecture de la structure a réussi) éteint aussi la lecture légère, et la table se lit en entier à ce tour-là', { skip }, async () => {
  const db = makeDb(document());
  let asked = 0;
  const sql = async statement => { asked += 1; if (statement.includes('_grist_Tables_column')) return db.sql(statement); throw new Error('lecture coupée'); };
  const reader = createLightReader({ sql, threshold: 0 });
  const apps = [{ manifest: publipostage() }];
  const first = await loadFiles(db.port, apps, '', reader);
  const second = await loadFiles(db.port, apps, '', reader);
  assert.equal(reader.isActive(), false);
  assert.deepEqual(second.files, first.files, 'les mêmes fichiers : la table est relue en entier, rien ne manque');
  assert.deepEqual(second.problems, []);
  const third = await loadFiles(db.port, apps, '', reader);
  assert.equal(third.stats.light, false);
  assert.equal(asked, 4, 'la structure, puis les trois lectures de lignes lancées ensemble (modèles, versions, corbeille) : plus rien ensuite');
});

test('les lectures de lignes partent ensemble, après la structure : un seul tour de jeton et de réseau pour toutes les tables, pas un par table', { skip }, async () => {
  const db = makeDb(document());
  let inFlight = 0;
  let peak = 0;
  const sql = async statement => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise(resolve => setTimeout(resolve, 5)); // un aller-retour : les lectures concurrentes se chevauchent, les autres se suivent
    try { return await db.sql(statement); } finally { inFlight -= 1; }
  };
  const reader = createLightReader({ sql, threshold: 0 });
  const apps = [{ manifest: publipostage() }, FILES_ENTRY];
  await loadFiles(db.port, apps, '', reader); // la première lecture est complète : elle apprend
  peak = 0;
  const second = await loadFiles(db.port, apps, '', reader);
  assert.equal(second.stats.light, true);
  assert.equal(peak, 4, 'les quatre lectures de lignes (modèles, versions, fichiers de GFS, corbeille) sont en vol en même temps');
  assert.equal(db.calls.filter(call => call.startsWith('SELECT id')).length, 4, 'et chaque table n\'est lue qu\'une fois');
});

test('une lecture qui n\'est pas au plan (colonnes autres) se fait au moment où on la demande, et rend la même chose', { skip }, async () => {
  const db = makeDb(document());
  const reader = createLightReader({ sql: db.sql, threshold: 0 });
  reader.learn(1);
  await reader.prepare([{ table: 'Publipostage_Modeles', wanted: ['Nom'] }]);
  const planned = await reader.read('Publipostage_Modeles', ['Nom']);
  const other = await reader.read('Publipostage_Modeles', ['Nom', 'Jeton']);
  assert.deepEqual(Object.keys(planned.data).sort(), ['DateModif', 'EstParDefaut', 'Nom', 'Reel', 'Taille', 'id'], 'le nom voulu et toutes les colonnes qui ne sont pas du texte');
  assert.ok(Object.keys(other.data).includes('Jeton') && !Object.keys(planned.data).includes('Jeton'));
  assert.equal(db.calls.filter(call => call.startsWith('SELECT id')).length, 2);
});

test('la lecture légère dit une fois pourquoi elle s\'éteint, même quand plusieurs lectures échouent ensemble', { skip }, async () => {
  const db = makeDb(document());
  const said = [];
  const sql = async statement => { if (statement.includes('_grist_Tables_column')) return db.sql(statement); throw new Error('refus'); };
  const reader = createLightReader({ sql, threshold: 0, warn: error => said.push(error.message) });
  reader.learn(1);
  await reader.prepare(['Publipostage_Modeles', 'Publipostage_Versions', 'GFS_Corbeille'].map(table => ({ table, wanted: [] })));
  assert.equal(await reader.read('Publipostage_Modeles', []), null);
  assert.equal(await reader.read('GFS_Corbeille', []), null);
  assert.deepEqual(said, ['refus']);
});

test('une colonne que le document n\'a pas (un document ancien) se lit comme vide, dans les deux lectures ; une table que Grist ne connaît pas n\'est pas lue en SQL', { skip }, async () => {
  const data = document();
  data.Publipostage_Modeles.colonnes = data.Publipostage_Modeles.colonnes.filter(column => column.id !== 'ModifiePar');
  const db = makeDb(data);
  const reader = createLightReader({ sql: db.sql, threshold: 0 });
  const apps = [{ manifest: publipostage() }];
  const first = await loadFiles(db.port, apps, '', reader);
  const second = await loadFiles(db.port, apps, '', reader);
  assert.equal(second.stats.light, true);
  assert.deepEqual(second.files, first.files);
  assert.ok(second.files.every(file => file.by === ''));
  assert.equal(await reader.read('Table_inconnue', ['Nom']), null);
});
