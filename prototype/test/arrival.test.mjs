// L'arrivée de GFS (cahier 6.2, point 2 ; contrats 7.4, point 7) : l'app que servait la section s'ouvre seule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrivalApp, arrivalProbes, arrivalByTable, tableServes } from '../js/broker/arrival.js';
import { arrivalTableApp } from '../js/broker/arrival-table.js';
import { publipostage, automation, form } from './helpers.mjs';

const manifests = [publipostage(), automation(), form()];
const both = { installed: () => true, granted: 'full' };
const only = (...ids) => ({ installed: id => ids.includes(id), granted: 'full' });

test('cahier 6.2 point 2 : une vue qui a son modèle s\'ouvre sur Publipostage+', () => {
  assert.equal(arrivalApp({ modeleDeLaVue: '16' }, manifests, both), 'publipostage');
  assert.equal(arrivalApp({ modeleDeLaVue: 16 }, manifests, both), 'publipostage', 'l\'identifiant d\'un modèle peut être un nombre');
});

test('cahier 6.2 point 2 : toute clé que le manifeste déclare compte, pas seulement le modèle de la vue', () => {
  for (const key of publipostage().reglages) {
    assert.equal(arrivalApp({ [key]: { a: 1 } }, manifests, both), 'publipostage', key);
  }
  assert.equal(arrivalApp({ workflow: '{"noeuds":[]}' }, manifests, both), 'automation', 'Automation+ pareil, pour son graphe');
});

test('cahier 6.2 point 2 : sans clé d\'une app, l\'explorateur', () => {
  assert.equal(arrivalApp({}, manifests, both), null);
  assert.equal(arrivalApp(null, manifests, both), null, 'la section n\'a aucun réglage');
  assert.equal(arrivalApp({ 'gfs.depart': 'form', 'gfs.apps': {}, autre: 1 }, manifests, both), null, 'les clés de GFS et les clés inconnues ne désignent aucune app');
  assert.equal(arrivalApp([{ modeleDeLaVue: '16' }], manifests, both), null);
  assert.equal(arrivalApp('modeleDeLaVue', manifests, both), null);
});

test('un choix retiré ne compte pas : `null` ou un texte vide laissent la clé sans valeur', () => {
  assert.equal(arrivalApp({ modeleDeLaVue: null }, manifests, both), null, 'Publipostage+ retire le modèle de la vue en écrivant null');
  assert.equal(arrivalApp({ modeleDeLaVue: '' }, manifests, both), null);
  assert.equal(arrivalApp({ modeleDeLaVue: null, droitsAcces: { lecteurs: [] } }, manifests, both), 'publipostage', 'une autre clé qui a sa valeur suffit');
  assert.equal(arrivalApp({ modeleDeLaVue: 0 }, manifests, both), 'publipostage', '0 est une valeur');
  assert.equal(arrivalApp({ modeleDeLaVue: false }, manifests, both), 'publipostage', 'false aussi');
});

test('une app qui n\'est pas installée ne s\'ouvre pas : l\'explorateur, rien ne s\'installe sans un geste', () => {
  assert.equal(arrivalApp({ workflow: '{}' }, manifests, only('publipostage')), null);
  assert.equal(arrivalApp({ workflow: '{}' }, manifests, only('publipostage', 'automation')), 'automation');
});

test('deux apps servies par la section : GFS ne devine pas, l\'explorateur', () => {
  const options = { modeleDeLaVue: '16', workflow: '{}' };
  assert.equal(arrivalApp(options, manifests, both), null);
  assert.equal(arrivalApp(options, manifests, only('publipostage')), 'publipostage', 'une seule des deux s\'ouvre ici : c\'est elle');
  assert.equal(arrivalApp(options, manifests, only('automation')), 'automation');
  assert.equal(arrivalApp(options, manifests, only('form')), null);
});

test('un accès que Grist n\'a pas donné : l\'app qui demande plus ne s\'ouvre pas', () => {
  const options = { modeleDeLaVue: '16' };
  assert.equal(arrivalApp(options, manifests, { installed: () => true, granted: 'read table' }), null);
  assert.equal(arrivalApp(options, manifests, { installed: () => true, granted: 'none' }), null);
  assert.equal(arrivalApp(options, manifests, { installed: () => true, granted: undefined }), null, 'un niveau inconnu vaut « none »');
  assert.equal(arrivalApp(options, manifests, { installed: () => true, granted: 'full' }), 'publipostage');
});

test('Form+ ne déclare aucune clé : elle ne s\'ouvre jamais à l\'arrivée', () => {
  assert.deepEqual(form().reglages || [], []);
  assert.equal(arrivalApp({ formTitle: 'Inscription', questions: [] }, manifests, both), null);
  assert.equal(arrivalApp({ formTitle: 'Inscription' }, [form()], both), null);
});

test('rien à ouvrir sans app valide', () => {
  assert.equal(arrivalApp({ modeleDeLaVue: '16' }, [], both), null);
});

// L'arrivée par la table (contrats 2.5, point 4 ; 7.4, point 7) : Automation+ 0.15.0 garde son graphe dans sa table `Automation` et n'écrit plus la clé `workflow` de la vue ;
// la ligne `Workflow` dont `Table` est la table de la vue dit que la section est la sienne.
const spec = automation().arrivee;
const graph = (rows) => ({ id: rows.map((_, i) => i + 1), Type: rows.map(r => r[0]), Table: rows.map(r => r[1]), Date: rows.map(() => 0) });

test('contrats 2.5 point 4 : Automation+ déclare sa table, la colonne qui dit la table de la vue et le type de ligne', () => {
  assert.deepEqual(spec, { table: 'Automation', colonne: 'Table', lignes: { Type: 'Workflow' } });
  assert.equal(publipostage().arrivee, undefined, 'Publipostage+ se repère par un réglage de la vue : elle ne déclare rien');
  assert.equal(form().arrivee, undefined);
});

test('une ligne Workflow dont Table est la table de la vue : la section est celle de l\'app', () => {
  const data = graph([['Workflow', 'Clients'], ['Log', 'Commandes'], ['Workflow', 'Commandes']]);
  assert.equal(tableServes(data, spec, 'Clients'), true);
  assert.equal(tableServes(data, spec, 'Commandes'), true);
  assert.equal(tableServes(data, spec, 'Participants'), false, 'aucune ligne pour cette table');
  assert.equal(tableServes(data, spec, 'clients'), true, 'les identifiants de Grist se comparent sans la casse');
});

test('une ligne Log ou Lock de la table ne désigne pas la vue : seul le type Workflow compte', () => {
  const data = graph([['Log', 'Clients'], ['Lock', 'Clients']]);
  assert.equal(tableServes(data, spec, 'Clients'), false);
});

test('une table absente, vide ou sans la colonne attendue ne dit rien', () => {
  assert.equal(tableServes(null, spec, 'Clients'), false);
  assert.equal(tableServes({}, spec, 'Clients'), false);
  assert.equal(tableServes({ id: [], Type: [], Table: [] }, spec, 'Clients'), false);
  assert.equal(tableServes({ id: [1], Table: ['Clients'] }, spec, 'Clients'), false, 'sans la colonne Type, le type exigé ne peut pas être lu');
  assert.equal(tableServes({ id: [1], Type: ['Workflow'] }, spec, 'Clients'), false, 'sans la colonne Table');
  assert.equal(tableServes({ id: [1], Type: 'Workflow', Table: 'Clients' }, spec, 'Clients'), false, 'des colonnes qui ne sont pas des listes');
});

test('arrivalByTable : une seule app reconnue s\'ouvre ; deux, GFS ne devine pas', () => {
  const data = graph([['Workflow', 'Clients']]);
  assert.equal(arrivalByTable([{ id: 'automation', spec, data }], 'Clients'), 'automation');
  assert.equal(arrivalByTable([{ id: 'automation', spec, data }], 'Commandes'), null);
  assert.equal(arrivalByTable([{ id: 'automation', spec, data: null }], 'Clients'), null, 'la table n\'existe pas');
  assert.equal(arrivalByTable([{ id: 'automation', spec, data }, { id: 'autre', spec, data }], 'Clients'), null);
  assert.equal(arrivalByTable([], 'Clients'), null);
});

test('arrivalProbes : la table n\'est lue que si aucune app qu\'on peut ouvrir n\'est servie par un réglage de la vue', () => {
  const ids = options => arrivalProbes(options, manifests, both).map(manifest => manifest.id);
  assert.deepEqual(ids({}), ['automation'], 'aucun réglage : Automation+ déclare sa table');
  assert.deepEqual(ids(null), ['automation']);
  assert.deepEqual(ids({ 'gfs.apps': {}, autre: 1 }), ['automation'], 'les clés de GFS et les clés inconnues ne parlent pas');
  assert.deepEqual(ids({ modeleDeLaVue: '16' }), [], 'la vue a son modèle : Publipostage+ garde la vue, la table n\'est pas lue');
  assert.deepEqual(ids({ workflow: '{"noeuds":[]}' }), [], 'la clé workflow (Automation+ avant 0.15.0) parle déjà');
  assert.deepEqual(ids({ modeleDeLaVue: null }), ['automation'], 'un modèle retiré ne parle plus');
  assert.deepEqual(arrivalProbes({}, manifests, only('publipostage')), [], 'Automation+ n\'est pas installée');
  assert.deepEqual(arrivalProbes({}, manifests, { installed: () => true, granted: 'read table' }), [], 'GFS n\'a pas l\'accès que l\'app demande');
});

const fakeDoc = (tables, onFetch = () => {}) => ({
  listTables: async () => Object.keys(tables),
  fetchTable: async name => { onFetch(name); if (tables[name] instanceof Error) throw tables[name]; return tables[name]; },
});

test('arrivalTableApp : lit la table de l\'app et rend l\'app que sa ligne désigne', async () => {
  const read = [];
  const doc = fakeDoc({ Clients: graph([]), Automation: graph([['Workflow', 'Clients']]) }, name => read.push(name));
  assert.equal(await arrivalTableApp(doc, [automation()], 'Clients'), 'automation');
  assert.deepEqual(read, ['Automation'], 'seule la table déclarée est lue');
  assert.equal(await arrivalTableApp(doc, [automation()], 'Commandes'), null);
});

test('arrivalTableApp : table absente, illisible ou document illisible : l\'explorateur, rien d\'écrit', async () => {
  assert.equal(await arrivalTableApp(fakeDoc({ Clients: graph([]) }), [automation()], 'Clients'), null, 'Automation+ n\'a pas encore créé sa table');
  const warned = [];
  const warn = console.warn; console.warn = (...args) => warned.push(args);
  try {
    assert.equal(await arrivalTableApp(fakeDoc({ Automation: new Error('refusé') }), [automation()], 'Clients'), null);
  } finally { console.warn = warn; }
  assert.equal(warned.length, 1, 'une table illisible est dite, une fois');
  const broken = { listTables: async () => { throw new Error('hors ligne'); }, fetchTable: async () => { throw new Error('jamais appelé'); } };
  assert.equal(await arrivalTableApp(broken, [automation()], 'Clients'), null);
  assert.equal(await arrivalTableApp(fakeDoc({ automation: graph([['Workflow', 'Clients']]) }), [automation()], 'Clients'), 'automation', 'l\'identifiant se compare sans la casse');
});
