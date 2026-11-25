// Les deux jeux de noms d'une app (js/apps/doc-names.js, contrats 2.4 `noms`) : Publipostage+ renomme ses tables et ses colonnes en anglais, et un document porte l'un ou
// l'autre (ou un mélange, le temps du renommage). GFS lit le document et réécrit le manifeste sous les noms que celui-ci porte : la liste de l'explorateur, le rangement, le poids, la
// corbeille, la copie et le renommage doivent alors marcher sur un document anglais comme sur un document d'avant. Ce que Grist fait vraiment d'un renommage se mesure dans le labo
// (labo/run-pp-noms-anglais.mjs) ; ici, des doublures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adaptManifest, schemaOf, DocNames, isTable, canonicalTable, documentColumn, canonicalColumn } from '../js/apps/doc-names.js';
import { countRows } from '../js/apps/row-count.js';
import { validateManifest } from '../js/apps/manifest.js';
import { loadFiles } from '../js/explorer/explorer-data.js';
import { AppFiles } from '../js/files/app-files.js';
import { BIN_TABLE, parseSnapshot, entryRecord } from '../js/files/gfs-trash.js';
import { Filing } from '../js/explorer/filing.js';
import { appFilingOf, appActions } from '../js/files/app-filing.js';
import { createI18n } from '../js/i18n/i18n.js';
import { fakeGrist } from './fake-grist.mjs';
import { publipostage, form, bi } from './helpers.mjs';

const FR = createI18n('fr');
const manifest = publipostage();
const NOW = 1762000000000;

// Les noms d'avant et les noms anglais, tels que le registre de l'app les dit (js/schema-columns.js de Publipostage+, b32f450).
const LEGACY = {
  Publipostage_Modeles: ['Nom', 'Contenu', 'TypeModele', 'DateModif', 'ModifiePar', 'EstParDefaut', 'Jeton', 'PJ'],
  Publipostage_PreferencesModeles: ['Utilisateur', 'ModeleId', 'Epingle', 'Dossier'],
  Publipostage_Versions: ['Jeton', 'Auteur', 'Nom', 'Genre', 'Donnees'],
};
const ENGLISH = {
  Publipostage_Templates: ['Name', 'Content', 'TemplateType', 'ModifiedAt', 'ModifiedBy', 'IsDefault', 'Token', 'Attachments'],
  Publipostage_TemplatePreferences: ['User', 'TemplateId', 'Pinned', 'Folder'],
  Publipostage_Versions: ['Token', 'Author', 'Name', 'Kind', 'Data'],
};

// Le schéma d'un document : { table: [colonnes] } rendu comme les deux tables internes de Grist.
const schemaFrom = tables => {
  const names = Object.keys(tables);
  const rows = names.flatMap((name, i) => tables[name].map(colId => ({ parentId: i + 1, colId })));
  return schemaOf({ id: names.map((unused, i) => i + 1), tableId: names }, { id: rows.map((unused, i) => i + 1), parentId: rows.map(row => row.parentId), colId: rows.map(row => row.colId) });
};
const quiet = () => { const said = []; return { said, warn: text => said.push(text) }; };

test('un document aux noms d\'avant : les noms du manifeste ne changent pas', () => {
  const adapted = adaptManifest(manifest, schemaFrom(LEGACY), quiet().warn);
  const [spec] = adapted.fichiers;
  assert.equal(spec.table, 'Publipostage_Modeles');
  assert.deepEqual(spec.colonnes, manifest.fichiers[0].colonnes);
  assert.deepEqual(spec.rangement, manifest.fichiers[0].rangement);
  assert.deepEqual(spec.suppression, manifest.fichiers[0].suppression);
  assert.deepEqual(spec.poids, manifest.fichiers[0].poids);
  assert.deepEqual(spec.renommees, {});
});

test('un document aux noms anglais : la table, les colonnes, le rangement, les recettes et les tables liées prennent les noms du document', () => {
  const adapted = adaptManifest(manifest, schemaFrom(ENGLISH), quiet().warn);
  const [spec] = adapted.fichiers;
  assert.equal(spec.table, 'Publipostage_Templates');
  assert.equal(spec.canonique, 'Publipostage_Modeles', 'le manifeste garde son nom : c\'est la clé de ce que GFS écrit');
  assert.deepEqual(spec.colonnes, { id: 'id', nom: 'Name', type: 'TemplateType', date: 'ModifiedAt', par: 'ModifiedBy' });
  assert.deepEqual(spec.exclure, { TemplateType: ['reglages'] });
  assert.deepEqual(spec.rangement, { table: 'Publipostage_TemplatePreferences', utilisateur: 'User', fichier: 'TemplateId', dossier: 'Folder', epingle: 'Pinned', ecriture: { dossiers: 0 } });
  assert.deepEqual([spec.suppression.uniques, spec.suppression.exclusives], [['Token'], ['IsDefault']]);
  assert.deepEqual([spec.copie.uniques, spec.copie.exclusives], [['Token'], ['IsDefault']]);
  assert.deepEqual(spec.poids.liees, [{ table: 'Publipostage_Versions', colonne: 'Token', fichier: 'Token' }]);
  assert.equal(spec.renommees.Nom, 'Name');
  assert.equal(spec.renommees.Jeton, 'Token');
  assert.equal(manifest.fichiers[0].table, 'Publipostage_Modeles', 'le manifeste lu n\'est pas modifié');
});

test('un document à moitié renommé : chaque table, chaque colonne a le nom qu\'elle porte', () => {
  const half = { Publipostage_Templates: LEGACY.Publipostage_Modeles, Publipostage_PreferencesModeles: ENGLISH.Publipostage_TemplatePreferences, Publipostage_Versions: LEGACY.Publipostage_Versions };
  const [spec] = adaptManifest(manifest, schemaFrom(half), quiet().warn).fichiers;
  assert.deepEqual([spec.table, spec.colonnes.nom, spec.rangement.table, spec.rangement.utilisateur, spec.poids.liees[0].colonne], ['Publipostage_Templates', 'Nom', 'Publipostage_PreferencesModeles', 'User', 'Jeton']);
});

test('une table que le document n\'a pas encore (l\'app ne l\'a pas créée) garde le nom du manifeste ; le nom se trouve sans tenir compte de la casse', () => {
  const [bare] = adaptManifest(manifest, schemaFrom({ Autre: ['A'] }), quiet().warn).fichiers;
  assert.deepEqual([bare.table, bare.colonnes.nom, bare.rangement.table], ['Publipostage_Modeles', 'Nom', 'Publipostage_PreferencesModeles']);
  const [cased] = adaptManifest(manifest, schemaFrom({ publipostage_templates: ['name', 'typetemplate'] }), quiet().warn).fichiers;
  assert.deepEqual([cased.table, cased.colonnes.nom], ['publipostage_templates', 'name'], 'le nom que le document porte, avec sa casse');
});

test('un document qui porte les deux noms, sans savoir lequel a des lignes : l\'autre nom du manifeste (celui où l\'app va) gagne, et GFS le dit', () => {
  const both = { ...LEGACY, Publipostage_Templates: ENGLISH.Publipostage_Templates };
  const { said, warn } = quiet();
  const [spec] = adaptManifest(manifest, schemaFrom(both), warn).fichiers;
  assert.equal(spec.table, 'Publipostage_Templates');
  assert.equal(spec.canonique, 'Publipostage_Modeles', 'la clé de ce que GFS écrit reste le nom du manifeste');
  assert.ok(said.some(text => text.includes('Publipostage_Modeles') && text.includes('Publipostage_Templates')), said.join(' | '));
  const twin = { Publipostage_Modeles: ['Nom', 'Name', 'TypeModele'] };
  const { said: columns, warn: warnColumns } = quiet();
  assert.equal(adaptManifest(manifest, schemaFrom(twin), warnColumns).fichiers[0].colonnes.nom, 'Name');
  assert.ok(columns.some(text => text.includes('Nom') && text.includes('Name')));
});

test('deux noms pour une table : celle qui a des lignes ; si les deux en ont, ou qu\'aucune n\'en a, l\'anglaise (la règle de l\'app, consigne 096)', () => {
  const both = schemaFrom({ ...LEGACY, Publipostage_Templates: ENGLISH.Publipostage_Templates });
  const tableFor = rows => adaptManifest(manifest, both, quiet().warn, new Map(Object.entries(rows))).fichiers[0].table;
  const old = 'publipostage_modeles';
  const english = 'publipostage_templates';
  assert.equal(tableFor({ [old]: 0, [english]: 18 }), 'Publipostage_Templates');
  assert.equal(tableFor({ [old]: 2, [english]: 0 }), 'Publipostage_Modeles', 'l\'anglaise est vide : GFS lit celle qui a des lignes, comme l\'app');
  assert.equal(tableFor({ [old]: 2, [english]: 18 }), 'Publipostage_Templates', 'les deux en ont : l\'anglaise');
  assert.equal(tableFor({ [old]: 0, [english]: 0 }), 'Publipostage_Templates', 'aucune n\'en a : l\'anglaise');
  assert.equal(tableFor({}), 'Publipostage_Templates', 'le nombre de lignes est inconnu : l\'anglaise');
  assert.equal(tableFor({ [old]: 2 }), 'Publipostage_Templates', 'le compte de l\'anglaise est inconnu : on ne sait pas qu\'elle est vide, donc l\'anglaise');
});

test('un manifeste sans `noms`, ou un schéma inconnu : le même objet, rien ne change', () => {
  const plain = { id: 'x', fichiers: [{ table: 'X_T' }] };
  assert.equal(adaptManifest(plain, schemaFrom(ENGLISH)), plain);
  assert.equal(adaptManifest(manifest, null), manifest);
  assert.equal(adaptManifest(null, schemaFrom(ENGLISH)), null);
});

test('le manifeste de Publipostage+ est valide, et `noms` est contrôlé : table hors du préfixe, nom pris, colonne sans liste, clé inconnue', () => {
  assert.deepEqual(validateManifest(manifest).errors, []);
  const broken = patch => { const copy = structuredClone(manifest); patch(copy.noms); return validateManifest(copy).errors; };
  assert.ok(broken(noms => { noms.Publipostage_Modeles.aussi = ['Autre_Templates']; }).some(error => error.includes('hors du préfixe')));
  assert.ok(broken(noms => { noms.Publipostage_Modeles.aussi = ['Publipostage_PreferencesModeles']; }).some(error => error.includes('déjà un nom')));
  assert.ok(broken(noms => { noms.Publipostage_Modeles.colonnes.Nom = 'Name'; }).some(error => error.includes('liste de noms de colonnes')));
  assert.ok(broken(noms => { noms.Publipostage_Modeles.colonnes.Nom = ['nom']; }).some(error => error.includes('déjà celui du manifeste')));
  assert.ok(broken(noms => { noms.Autre_Table = {}; }).some(error => error.includes('hors du préfixe')));
  assert.ok(broken(noms => { noms.Publipostage_Modeles.autre = 1; }).some(error => error.includes('inconnu')));
});

// Un document en mémoire : { table: { columns, rows } } ; les tables internes de Grist en sont lues comme le vrai les rend.
function docOf(tables) {
  const names = Object.keys(tables);
  const rows = names.flatMap((name, i) => tables[name].columns.filter(column => column !== 'id').map(colId => ({ parentId: i + 1, colId })));
  const internals = {
    _grist_Tables: { id: names.map((unused, i) => i + 1), tableId: names },
    _grist_Tables_column: { id: rows.map((unused, i) => i + 1), parentId: rows.map(row => row.parentId), colId: rows.map(row => row.colId) },
  };
  const fake = fakeGrist(tables);
  const doc = { ...fake.port.doc, fetchTable: async name => internals[name] || fake.port.doc.fetchTable(name) };
  doc.listTables = async () => Object.keys(tables);
  return { ...fake, port: { doc }, doc };
}

const englishRows = () => [
  { id: 1, Name: 'Convocation', Content: '<p></p>', TemplateType: 'document', ModifiedAt: 100, ModifiedBy: '', IsDefault: true, Token: 'j1', Attachments: null },
  { id: 2, Name: 'Attestation', Content: '<p></p>', TemplateType: 'grille', ModifiedAt: 200, ModifiedBy: '', IsDefault: false, Token: 'j2', Attachments: null },
  { id: 3, Name: '@reglages', Content: '', TemplateType: 'reglages', ModifiedAt: 0, ModifiedBy: '', IsDefault: false, Token: '', Attachments: null },
];
const englishDocument = () => ({
  Publipostage_Templates: { columns: ['id', ...ENGLISH.Publipostage_Templates], rows: englishRows() },
  Publipostage_TemplatePreferences: { columns: ['id', ...ENGLISH.Publipostage_TemplatePreferences], rows: [
    { id: 1, User: '', TemplateId: 1, Pinned: true, Folder: 'Contrats' }, { id: 2, User: '', TemplateId: 0, Pinned: false, Folder: 'Archives' }] },
  Publipostage_Versions: { columns: ['id', ...ENGLISH.Publipostage_Versions], rows: [{ id: 1, Token: 'j1', Author: '', Name: 'v1', Kind: '', Data: 'x'.repeat(500) }] },
});

async function adaptedOver(tables) {
  const run = docOf(tables);
  const names = new DocNames({ doc: run.doc });
  const item = { app: { id: 'publipostage' }, manifest, ok: true };
  await names.refresh([item]);
  return { ...run, names, item, adapted: names.adaptItem(item).manifest };
}

test('DocNames : lit le schéma une fois, rend le même objet tant que rien ne change, et un autre quand le document est renommé', async () => {
  const run = await adaptedOver(englishDocument());
  assert.equal(run.adapted.fichiers[0].table, 'Publipostage_Templates');
  assert.equal(run.names.adaptItem(run.item), run.names.adaptItem(run.item), 'la même copie à chaque appel');
  assert.equal(await run.names.refresh([run.item]), false, 'rien n\'a changé : la copie reste');
  const before = run.names.adapt(manifest);
  const legacy = docOf({ Publipostage_Modeles: { columns: ['id', ...LEGACY.Publipostage_Modeles], rows: [] } });
  const names = new DocNames({ doc: legacy.doc });
  assert.equal(await names.refresh([{ manifest }]), true);
  assert.equal(names.adapt(manifest).fichiers[0].table, 'Publipostage_Modeles');
  assert.notEqual(names.adapt(manifest), before);
  const without = new DocNames({ doc: { fetchTable: async () => { throw new Error('ne doit pas être lu'); } } });
  assert.equal(await without.refresh([{ manifest: { id: 'x' } }]), false, 'aucun manifeste ne dit `noms` : aucune lecture');
  assert.equal(without.adaptItem({ manifest: { id: 'x' } }).manifest.id, 'x');
});

test('DocNames : des tables internes illisibles ne cassent rien, le manifeste reste tel quel et la console le dit', async () => {
  const warn = console.warn;
  const warned = [];
  console.warn = text => warned.push(text);
  try {
    const names = new DocNames({ doc: { fetchTable: async () => { throw new Error('refusé'); } } });
    await names.refresh([{ manifest }]);
    assert.equal(names.adapt(manifest), manifest);
    assert.equal(warned.length, 1);
  } finally { console.warn = warn; }
});

test('l\'explorateur : un document aux noms anglais montre ses modèles, leur dossier, leur étoile et le poids de leurs versions (le manifeste d\'avant n\'en voit aucun)', async () => {
  const run = await adaptedOver(englishDocument());
  const blind = await loadFiles(run.port, [{ manifest }], '');
  assert.deepEqual(blind.files, [], 'la perte mesurée : le manifeste d\'avant ne lit pas la table renommée');
  const { files, problems } = await loadFiles(run.port, [{ manifest: run.adapted }], '');
  assert.deepEqual(problems, []);
  assert.deepEqual(files.map(file => [file.id, file.name, file.type, file.folder, file.pinned, file.table]), [
    ['1', 'Convocation', 'document', 'Contrats', true, 'Publipostage_Templates'], ['2', 'Attestation', 'grille', '', false, 'Publipostage_Templates']]);
  const one = files.find(file => file.id === '1');
  const two = files.find(file => file.id === '2');
  assert.ok(one.weight > two.weight + 500, 'la ligne de Publipostage_Versions liée par `Token` pèse dans le fichier');
});

test('le rangement de l\'app : GFS écrit les colonnes anglaises de la table renommée, et rien d\'autre', async () => {
  const run = await adaptedOver(englishDocument());
  const filing = appFilingOf(run.adapted);
  assert.deepEqual([filing.table, filing.utilisateur, filing.fichier, filing.dossier, filing.epingle], ['Publipostage_TemplatePreferences', 'User', 'TemplateId', 'Folder', 'Pinned']);
  const data = await run.port.doc.fetchTable('Publipostage_TemplatePreferences');
  const actions = appActions(filing, 'Publipostage_TemplatePreferences', data, '', { entries: [{ file: '2', pinned: true, folder: 'Contrats' }, { file: '1', pinned: false, folder: '' }] });
  assert.deepEqual(actions, [
    ['AddRecord', 'Publipostage_TemplatePreferences', null, { User: '', TemplateId: 2, Pinned: true, Folder: 'Contrats' }],
    ['UpdateRecord', 'Publipostage_TemplatePreferences', 1, { Pinned: false, Folder: '' }]]);
  await run.port.doc.applyUserActions(actions);
});

test('renommer un modèle : le nom s\'écrit dans la colonne `Name` de la table `Publipostage_Templates`', async () => {
  const run = await adaptedOver(englishDocument());
  const spec = run.adapted.fichiers[0];
  const { files } = await loadFiles(run.port, [{ manifest: run.adapted }], '');
  const doc = { ...run.port.doc, fetchTable: run.doc.fetchTable };
  const notices = [];
  const filing = new Filing({
    port: { doc }, rangement: { setFiling: async () => true }, t: FR.t, locale: () => 'fr', files: () => files, folders: () => [], here: () => '',
    specOf: file => run.adapted.fichiers.find(entry => isTable(entry, file.table)) || null, appName: () => 'Publipostage+', writeBlock: () => null, notice: text => notices.push(text),
    refresh: async () => {}, windows: { name: async () => 'Convocation 2025', folder: async () => null },
  });
  await filing.rename(files.find(file => file.id === '1'));
  assert.deepEqual(notices, []);
  assert.deepEqual(run.batches.at(-1), [['UpdateRecord', 'Publipostage_Templates', 1, { Name: 'Convocation 2025' }]]);
  assert.equal(spec.colonnes.nom, 'Name');
});

// Le gardien des fichiers de l'app sur un document aux noms anglais.
function guard(run, apps) {
  const columns = ENGLISH.Publipostage_Templates.map(id => ({ id, type: id === 'Attachments' ? 'Attachments' : 'Text' }));
  return new AppFiles({ port: run.port, apps: () => apps, consent: async () => true, identity: () => 'paul@exemple.fr', now: () => NOW, readonly: () => false, fullAccess: () => true, t: FR.t,
    columnsOf: async () => columns });
}

test('la corbeille : un modèle d\'un document anglais part et revient sous ses noms, et l\'entrée garde le nom du manifeste', async () => {
  const run = await adaptedOver(englishDocument());
  const keeper = guard(run, [{ manifest: run.adapted }]);
  const { files } = await loadFiles(run.port, [{ manifest: run.adapted }], '');
  assert.equal(keeper.manages(files[1]), true);
  assert.equal(await keeper.trash(files[1]), true);
  assert.deepEqual(run.tables.Publipostage_Templates.rows.map(row => row.id), [1, 3]);
  const [stored] = run.tables[BIN_TABLE].rows;
  assert.equal(stored.Table, 'Publipostage_Modeles', 'la clé de la corbeille est le nom du manifeste : elle ne change pas quand le document est renommé');
  const snapshot = parseSnapshot(stored.Instantane);
  assert.equal(snapshot.valeurs.Nom, 'Attestation', 'l\'instantané garde les noms du manifeste');
  assert.equal(snapshot.valeurs.Name, undefined);
  const after = await loadFiles(run.port, [{ manifest: run.adapted }], '');
  assert.deepEqual(after.trash.map(file => [file.id, file.name, file.type]), [['2', 'Attestation', 'grille']]);
  assert.deepEqual(await keeper.restore(after.trash[0]), { name: 'Attestation', renamed: false });
  const back = run.tables.Publipostage_Templates.rows.find(row => row.id === 2);
  assert.deepEqual([back.Name, back.TemplateType, back.Token], ['Attestation', 'grille', 'j2']);
  assert.deepEqual(run.tables[BIN_TABLE].rows, []);
});

test('la corbeille : un modèle mis de côté AVANT le renommage du document se restaure APRÈS, sans perdre son nom, son type ni son contenu', async () => {
  const legacyRows = [{ id: 1, Nom: 'Convocation', Contenu: '<p>texte</p>', TypeModele: 'document', DateModif: 100, ModifiePar: '', EstParDefaut: false, Jeton: 'j1', PJ: null }];
  const before = docOf({ Publipostage_Modeles: { columns: ['id', ...LEGACY.Publipostage_Modeles], rows: structuredClone(legacyRows) } });
  const legacyColumns = LEGACY.Publipostage_Modeles.map(id => ({ id, type: 'Text' }));
  const first = new AppFiles({ port: before.port, apps: () => [{ manifest }], consent: async () => true, identity: () => 'paul@exemple.fr', now: () => NOW, readonly: () => false, fullAccess: () => true, t: FR.t,
    columnsOf: async () => legacyColumns });
  const { files } = await loadFiles(before.port, [{ manifest }], '');
  assert.equal(await first.trash(files[0]), true);
  const bin = structuredClone(before.tables[BIN_TABLE]);
  // Le document est renommé (la table vide, la corbeille de GFS gardée) : la corbeille de GFS est restée la même.
  const renamed = docOf({ ...englishDocument(), Publipostage_Templates: { columns: ['id', ...ENGLISH.Publipostage_Templates], rows: [] }, [BIN_TABLE]: bin });
  const names = new DocNames({ doc: renamed.doc });
  await names.refresh([{ manifest }]);
  const adapted = names.adapt(manifest);
  const { trash } = await loadFiles(renamed.port, [{ manifest: adapted }], '');
  assert.deepEqual(trash.map(file => [file.id, file.name]), [['1', 'Convocation']], 'l\'entrée d\'avant se retrouve sous la table renommée');
  const keeper = guard(renamed, [{ manifest: adapted }]);
  assert.deepEqual(await keeper.restore(trash[0]), { name: 'Convocation', renamed: false });
  const [back] = renamed.tables.Publipostage_Templates.rows;
  assert.deepEqual([back.Name, back.Content, back.TemplateType, back.Token], ['Convocation', '<p>texte</p>', 'document', 'j1']);
});

test('copier : la ligne se recopie sous les noms du document, le jeton vidé et l\'étoile éteinte (recette sous les noms anglais)', async () => {
  const run = await adaptedOver(englishDocument());
  const keeper = guard(run, [{ manifest: run.adapted }]);
  const { files } = await loadFiles(run.port, [{ manifest: run.adapted }], '');
  const copy = await keeper.copy(files.find(file => file.id === '1'));
  assert.deepEqual(copy, { id: '4', name: 'Convocation (1)' });
  const made = run.tables.Publipostage_Templates.rows.find(row => row.id === 4);
  assert.deepEqual([made.Name, made.IsDefault, made.Token, made.TemplateType], ['Convocation (1)', false, '', 'document']);
});

test('les clés de la corbeille : le nom du manifeste, quel que soit le nom que le document porte ; une entrée se retrouve sous l\'un ou l\'autre', () => {
  const [spec] = adaptManifest(manifest, schemaFrom(ENGLISH), quiet().warn).fichiers;
  const record = entryRecord({ id: 'a', app: 'publipostage', spec, file: { id: '1', name: 'N', type: 'document' }, snapshot: {}, now: NOW, author: '' });
  assert.equal(record.Table, 'Publipostage_Modeles');
  assert.equal(canonicalTable(spec), 'Publipostage_Modeles');
  assert.equal(canonicalTable({ table: 'Form_T' }), 'Form_T');
  assert.deepEqual([isTable(spec, 'Publipostage_Modeles'), isTable(spec, 'Publipostage_Templates'), isTable(spec, 'Autre'), isTable(null, 'x')], [true, true, false, false]);
  assert.deepEqual([documentColumn(spec, 'Nom'), documentColumn(spec, 'Inconnue'), canonicalColumn(spec, 'Name'), canonicalColumn(spec, 'Inconnue'), canonicalColumn(null, 'Name')],
    ['Name', 'Inconnue', 'Nom', 'Inconnue', 'Name']);
});

// Un document qui porte les deux jeux de noms : les tables d'avant (`oldRows` lignes) et les tables anglaises (`englishRows`), comme après le passage d'une ancienne
// copie de l'app sur un document renommé (mesuré dans un vrai Grist : labo/run-noms-cas.mjs, cas `doublons`).
const bothDocument = (oldCount, englishCount) => {
  const legacyRow = id => ({ id, Nom: `Ancien ${id}`, Contenu: '<p></p>', TypeModele: 'document', DateModif: 100 + id, ModifiePar: '', EstParDefaut: false, Jeton: `a${id}`, PJ: null });
  const english = englishRows().filter(row => row.id < 3).slice(0, englishCount);
  return {
    Publipostage_Modeles: { columns: ['id', ...LEGACY.Publipostage_Modeles], rows: Array.from({ length: oldCount }, (unused, i) => legacyRow(i + 1)) },
    Publipostage_Templates: { columns: ['id', ...ENGLISH.Publipostage_Templates], rows: english },
    Publipostage_PreferencesModeles: { columns: ['id', ...LEGACY.Publipostage_PreferencesModeles], rows: [] },
    Publipostage_TemplatePreferences: { columns: ['id', ...ENGLISH.Publipostage_TemplatePreferences], rows: [] },
    Publipostage_Versions: { columns: ['id', ...ENGLISH.Publipostage_Versions], rows: [] },
  };
};

async function namesOver(tables, { count = true } = {}) {
  const run = docOf(tables);
  const asked = [];
  const names = new DocNames({ doc: run.doc, count: count ? async table => { asked.push(table); return (await run.doc.fetchTable(table)).id.length; } : null });
  const item = { app: { id: 'publipostage' }, manifest, ok: true };
  await names.refresh([item]);
  return { ...run, names, item, asked, adapted: names.adaptItem(item).manifest };
}

test('DocNames : un document aux deux jeux de noms, la liste montre la table que l\'app lit (celle qui a des lignes, l\'anglaise si les deux en ont ou aucune)', async () => {
  const shown = async (oldCount, englishCount) => {
    const run = await namesOver(bothDocument(oldCount, englishCount));
    const { files } = await loadFiles(run.port, [{ manifest: run.adapted }], '');
    return [run.adapted.fichiers[0].table, files.map(file => file.name)];
  };
  assert.deepEqual(await shown(0, 2), ['Publipostage_Templates', ['Convocation', 'Attestation']], 'la défaut mesuré : la table d\'avant vide cachait les modèles de l\'anglaise');
  assert.deepEqual(await shown(2, 0), ['Publipostage_Modeles', ['Ancien 1', 'Ancien 2']], 'l\'anglaise est vide : les modèles de l\'ancienne copie se voient');
  assert.deepEqual(await shown(2, 2), ['Publipostage_Templates', ['Convocation', 'Attestation']], 'les deux en ont : l\'anglaise, celle de l\'app');
  assert.deepEqual((await shown(0, 0))[0], 'Publipostage_Templates', 'aucune n\'en a : l\'anglaise');
});

test('DocNames : le nombre de lignes ne se lit que pour les tables que le document porte sous deux noms ; il change la copie quand la table se remplit', async () => {
  const single = await namesOver(englishDocument());
  assert.deepEqual(single.asked, [], 'un document à un seul jeu de noms : aucune lecture de plus');
  const run = await namesOver(bothDocument(0, 2));
  assert.deepEqual(run.asked.sort(), ['Publipostage_Modeles', 'Publipostage_PreferencesModeles', 'Publipostage_TemplatePreferences', 'Publipostage_Templates'],
    'seules les deux paires de tables portées sous deux noms (les modèles, leurs préférences) ; pas `Publipostage_Versions`');
  assert.equal(await run.names.refresh([run.item]), false, 'rien n\'a changé : la copie reste');
  const before = run.names.adapt(manifest);
  await run.doc.applyUserActions([['AddRecord', 'Publipostage_Modeles', null, { Nom: 'Ancien A', TypeModele: 'document' }], ['AddRecord', 'Publipostage_Modeles', null, { Nom: 'Ancien B', TypeModele: 'document' }]]);
  assert.equal(await run.names.refresh([run.item]), false, 'la table d\'avant a des lignes, mais l\'anglaise aussi : toujours l\'anglaise, la copie reste');
  assert.equal(run.names.adapt(manifest), before);
  await run.doc.applyUserActions([['BulkRemoveRecord', 'Publipostage_Templates', [1, 2]]]);
  assert.equal(await run.names.refresh([run.item]), true, 'l\'anglaise est vidée : GFS lit celle qui a des lignes');
  assert.equal(run.names.adapt(manifest).fichiers[0].table, 'Publipostage_Modeles');
});

test('DocNames : sans lecture du nombre de lignes, ou quand elle échoue, l\'autre nom du manifeste gagne', async () => {
  assert.equal((await namesOver(bothDocument(2, 0), { count: false })).adapted.fichiers[0].table, 'Publipostage_Templates');
  const run = docOf(bothDocument(2, 0));
  const names = new DocNames({ doc: run.doc, count: async () => { throw new Error('refusé'); } });
  const item = { manifest };
  await names.refresh([item]);
  assert.equal(names.adapt(manifest).fichiers[0].table, 'Publipostage_Templates');
});

test('countRows : le SQL d\'abord, puis la table entière, puis null ; un nom qui n\'est pas un identifiant ne part jamais en SQL', async () => {
  const statements = [];
  const doc = { fetchTable: async name => ({ id: name === 'Pleine' ? [1, 2, 3] : [] }) };
  const sql = async statement => { statements.push(statement); return [{ n: 5 }]; };
  assert.equal(await countRows('Pleine', { sql, doc }), 5);
  assert.deepEqual(statements, ['SELECT COUNT(*) AS n FROM "Pleine"']);
  assert.equal(await countRows('Pleine', { sql: async () => { throw new Error('403'); }, doc }), 3, 'la lecture légère est refusée : la table entière');
  assert.equal(await countRows('Pleine', { doc }), 3, 'pas de lecture légère');
  assert.equal(await countRows('a"; DROP TABLE x', { sql, doc }), 0, 'jamais en SQL : la table entière (ici rien)');
  assert.equal(statements.length, 1);
  assert.equal(await countRows('Autre', { doc: { fetchTable: async () => { throw new Error('absente'); } } }), null);
});

// Les noms anglais que GFS propose à Form+ et à Grist-BI (consignes 040 et 030) : déclarés AVANT que ces apps renomment, pour que leur liste ne devienne pas vide sans un mot (fait 127).
test('Form+ et Grist-BI : les manifestes disent leurs noms anglais, et un document anglais ou d\'avant montre les mêmes fichiers', async () => {
  for (const [id, load, legacyTable, englishTable, legacy, english] of [
    ['form', form, 'FormPlus_Formulaires', 'FormPlus_Forms', ['Nom', 'TypeFormulaire', 'DateModif', 'ModifiePar'], ['Name', 'FormType', 'ModifiedAt', 'ModifiedBy']],
    ['bi', bi, 'BI_Dashboard_Config', 'BI_Dashboard_Config', ['Nom', 'TypeRapport', 'DateModif', 'ModifiePar'], ['Name', 'ReportType', 'ModifiedAt', 'ModifiedBy']],
  ]) {
    const original = load();
    assert.deepEqual(validateManifest(original).errors, [], `${id} : le manifeste reste valide avec \`noms\``);
    const rowsFor = names => [{ id: 1, [names[0]]: 'Premier', [names[1]]: original.fichiers[0].typeParDefaut, [names[2]]: 100, [names[3]]: '' }];
    const listed = async (table, names) => {
      const run = docOf({ [table]: { columns: ['id', ...names], rows: rowsFor(names) } });
      const resolved = new DocNames({ doc: run.doc });
      const item = { app: { id }, manifest: original, ok: true };
      await resolved.refresh([item]);
      const { files, problems } = await loadFiles(run.port, [{ manifest: resolved.adaptItem(item).manifest }], '');
      return [problems, files.map(file => [file.name, file.type, file.table])];
    };
    assert.deepEqual((await listed(legacyTable, legacy))[1].map(([name, type]) => [name, type]), [['Premier', original.fichiers[0].typeParDefaut]], `${id} : un document d'avant`);
    const [problems, files] = await listed(englishTable, english);
    assert.deepEqual(problems, [], `${id} : un document anglais se lit sans problème`);
    assert.deepEqual(files.map(([name, type]) => [name, type]), [['Premier', original.fichiers[0].typeParDefaut]], `${id} : un document anglais montre le même fichier`);
    assert.equal(files[0][2], englishTable);
    const blind = await loadFiles(docOf({ [englishTable]: { columns: ['id', ...english], rows: rowsFor(english) } }).port, [{ manifest: original }], '');
    assert.ok(!blind.files.some(file => file.name === 'Premier'), `${id} : sans la réécriture, la liste d'un document anglais ne montrerait pas le fichier (fait 127)`);
  }
});
