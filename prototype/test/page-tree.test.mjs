// Le rangement des pages des tables de GFS (js/files/page-tree.js, contrats 6.6) : celles que Grist crée à plat, tout en bas du volet, passent sous la page de GFS,
// repliée par défaut, une seule fois. Un faux Grist ne sert ici qu'à vérifier ce que GFS lit et écrit ; que Grist montre vraiment les pages dessous, et repliées,
// se mesure dans un vrai Grist (labo/run-pages-gfs.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PageTree, PAGES_KEY, handledOf, planTidy } from '../js/files/page-tree.js';
import { OwnTable, onTableCreated } from '../js/files/own-table.js';
import { GristState } from '../js/broker/state.js';

const columnar = rows => Object.fromEntries(Object.keys(rows[0]).map(key => [key, rows.map(row => row[key])]));
const quiet = t => t.mock.method(console, 'warn', () => {});

// Un document : des tables (id = numéro de la table, sa vue propre = 100 + id), une page par vue, la section de GFS (10) sur la page 1.
const NAMES = ['GFS', 'GFS_Rangement', 'GFS_Groupes', 'GFS_Fichiers', 'GFS_Partages'];
function document({ names = NAMES, other = [], options = null } = {}) {
  const tables = [{ id: 1, tableId: 'Clients', primaryViewId: 101 }];
  const sections = [{ id: 10, parentId: 1, parentKey: 'custom', tableRef: 1 }];
  const pages = [{ id: 1, viewRef: 1, indentation: 0, pagePos: 1, options: options || '' }];
  let pos = 2;
  names.slice(1).forEach((name, i) => {
    const id = 20 + i;
    tables.push({ id, tableId: name, primaryViewId: 100 + id });
    sections.push({ id: 200 + id, parentId: 100 + id, parentKey: 'record', tableRef: id });
    pages.push({ id: 50 + i, viewRef: 100 + id, indentation: 0, pagePos: pos++, options: '' });
  });
  for (const extra of other) {
    pages.push({ id: 90 + extra.view, viewRef: extra.view, indentation: extra.indentation || 0, pagePos: extra.pagePos, options: '' });
    if (extra.table) { tables.push({ id: 80 + extra.view, tableId: extra.table, primaryViewId: extra.view }); sections.push({ id: 300 + extra.view, parentId: extra.view,
      parentKey: 'record', tableRef: 80 + extra.view }); }
  }
  return { tables, sections, pages, hasOptions: true };
}
// Les pages dans l'ordre du volet, avec leur retrait : [nom de la table ou « vue N », indentation].
const layout = meta => meta.pages.slice().sort((a, b) => a.pagePos - b.pagePos).map(page => {
  const table = meta.tables.find(item => item.primaryViewId === page.viewRef);
  return [table ? table.tableId : (page.viewRef === 1 ? 'GFS' : `vue ${page.viewRef}`), page.indentation];
});
function applied(meta, actions) {
  const next = { ...meta, pages: meta.pages.map(page => ({ ...page })) };
  for (const [verb, table, id, values] of actions) { assert.deepEqual([verb, table], ['UpdateRecord', '_grist_Pages']); Object.assign(next.pages.find(page => page.id === id), values); }
  return next;
}

test('planTidy : les pages à plat passent sous la page de GFS, dans leur ordre, et la page de GFS se replie', () => {
  const meta = document();
  const plan = planTidy(meta, 10, null);
  assert.deepEqual(plan.moved, ['GFS_Rangement', 'GFS_Groupes', 'GFS_Fichiers', 'GFS_Partages']);
  assert.equal(plan.collapsed, true);
  assert.deepEqual(layout(applied(meta, plan.actions)), [['GFS', 0], ['GFS_Rangement', 1], ['GFS_Groupes', 1], ['GFS_Fichiers', 1], ['GFS_Partages', 1]]);
  const [verb, table, id, values] = plan.actions.at(-1);
  assert.deepEqual([verb, table, id], ['UpdateRecord', '_grist_Pages', 1]);
  assert.deepEqual(JSON.parse(values.options), { collapsed: true });
});

test('planTidy : les pages d\'autres tables restent où elles sont ; celles de GFS viennent juste sous GFS, avant la page qui le suivait', () => {
  const meta = document({ other: [{ view: 7, pagePos: 1.5 }, { view: 8, pagePos: 9 }] });
  const rest = layout(applied(meta, planTidy(meta, 10, null).actions));
  assert.deepEqual(rest, [['GFS', 0], ['GFS_Rangement', 1], ['GFS_Groupes', 1], ['GFS_Fichiers', 1], ['GFS_Partages', 1], ['vue 7', 0], ['vue 8', 0]]);
});

test('planTidy : une page de GFS au-dessus de la page de GFS descend aussi sous elle', () => {
  const meta = document({ names: ['GFS', 'GFS_Rangement'] });
  meta.pages.find(page => page.viewRef === 1).pagePos = 5; // GFS_Rangement (pagePos 2) est maintenant avant la page de GFS
  const plan = planTidy(meta, 10, null);
  assert.deepEqual(layout(applied(meta, plan.actions)), [['GFS', 0], ['GFS_Rangement', 1]]);
});

test('planTidy : une page de GFS déjà sous une autre page (la personne l\'a rangée) n\'est pas touchée, mais GFS la sait vue', () => {
  const meta = document({ other: [{ view: 7, pagePos: 1.5 }] });
  Object.assign(meta.pages.find(page => page.viewRef === 100 + 21), { indentation: 1, pagePos: 1.6 }); // GFS_Groupes sous la vue 7
  const plan = planTidy(meta, 10, null);
  assert.deepEqual(plan.moved, ['GFS_Rangement', 'GFS_Fichiers', 'GFS_Partages']);
  assert.ok(plan.seen.includes('GFS_Groupes'));
  assert.equal(applied(meta, plan.actions).pages.find(page => page.viewRef === 121).indentation, 1);
  assert.equal(applied(meta, plan.actions).pages.find(page => page.viewRef === 121).pagePos, 1.6);
});

test('planTidy : une page qui montre autre chose que la table (la personne y a posé un autre widget) est la sienne : ni rangée ni notée', () => {
  const meta = document();
  meta.sections.push({ id: 999, parentId: 120, parentKey: 'custom', tableRef: 1 }); // la page de GFS_Rangement porte aussi un widget d'une autre table
  const plan = planTidy(meta, 10, null);
  assert.ok(!plan.moved.includes('GFS_Rangement') && !plan.seen.includes('GFS_Rangement'));
});

test('planTidy : seules les tables du préfixe GFS_ sont rangées (casse comprise), jamais les autres', () => {
  const meta = document({ names: ['GFS', 'gfs_Minuscule', 'GFSsansTiret', 'Synchro_Fiche', 'GFS_Rangement'] });
  assert.deepEqual(planTidy(meta, 10, null).moved, ['gfs_Minuscule', 'GFS_Rangement']);
});

test('planTidy : la page de GFS est celle de sa section ; sans section ou sans page de la liste, GFS ne sait pas où ranger et n\'écrit rien', () => {
  const meta = document();
  assert.equal(planTidy(meta, 999, null).reason, 'no-section');
  meta.pages = meta.pages.filter(page => page.viewRef !== 1); // la page de GFS n'est pas dans la liste
  assert.equal(planTidy(meta, 10, null).reason, 'no-page');
});

test('planTidy : si la page de GFS est celle d\'une table de GFS (GFS posé sur `GFS_Rangement`), elle reste au premier niveau et les autres passent dessous', () => {
  const meta = document({ names: ['GFS', 'GFS_Rangement', 'GFS_Groupes'] });
  meta.sections.find(section => section.id === 10).parentId = 120; // la section de GFS est sur la page de GFS_Rangement
  const plan = planTidy(meta, 10, null);
  assert.deepEqual(plan.moved, ['GFS_Groupes']);
  assert.deepEqual(layout(applied(meta, plan.actions)), [['GFS', 0], ['GFS_Rangement', 0], ['GFS_Groupes', 1]]);
});

test('planTidy : la marque connaît déjà les tables : une page que la personne a sortie ne revient pas, et la page de GFS n\'est pas replongée dans un repli', () => {
  const meta = document({ options: JSON.stringify({ collapsed: false }) });
  const known = ['GFS_Rangement', 'GFS_Groupes', 'GFS_Fichiers'];
  const plan = planTidy(meta, 10, known);
  assert.deepEqual(plan.moved, ['GFS_Partages']); // la seule table neuve
  assert.equal(plan.collapsed, false);
  assert.ok(plan.actions.every(action => action[2] !== 1)); // la page de GFS n'est pas touchée
});

test('planTidy : au premier rangement la page de GFS se replie sans perdre ses autres options, une page déjà repliée n\'est pas réécrite, ni sans colonne `options`', () => {
  const meta = document({ options: JSON.stringify({ other: 7 }) });
  const [replied] = planTidy(meta, 10, null).actions.filter(action => action[2] === 1);
  assert.deepEqual(JSON.parse(replied[3].options), { other: 7, collapsed: true });
  const already = document({ options: JSON.stringify({ collapsed: true }) });
  assert.equal(planTidy(already, 10, null).collapsed, false);
  const old = { ...document(), hasOptions: false };
  assert.equal(planTidy(old, 10, null).collapsed, false);
  assert.ok(planTidy(old, 10, null).actions.every(action => action[2] !== 1));
});

test('planTidy : rien à ranger (aucune table de GFS, ou déjà sous la page) : aucune action, et la page de GFS ne se replie pas', () => {
  const none = planTidy(document({ names: ['GFS'] }), 10, null);
  assert.deepEqual([none.actions, none.seen, none.collapsed], [[], [], false]);
  const meta = document();
  const done = applied(meta, planTidy(meta, 10, null).actions);
  const again = planTidy(done, 10, null);
  assert.deepEqual(again.actions.filter(action => action[2] !== 1), []); // plus aucune page à déplacer (la page de GFS est déjà repliée)
  assert.equal(again.moved.length, 0);
});

test('handledOf : la liste de la marque ; absente ou illisible : null (rien noté)', () => {
  assert.deepEqual(handledOf({ [PAGES_KEY]: ['GFS_Rangement', 4, 'GFS_Fichiers'] }), ['GFS_Rangement', 'GFS_Fichiers']);
  assert.equal(handledOf({}), null);
  assert.equal(handledOf({ [PAGES_KEY]: 'oui' }), null);
  assert.equal(handledOf(null), null);
});

// GFS dans un document : ce que Grist dit à GFS (`state`), les tables de métadonnées, ce que GFS écrit et marque.
function setup({ meta = document(), options = {}, own = { id: 10 }, enabled = true, rejects = false } = {}) {
  const state = new GristState();
  state.feed({ settings: { accessLevel: 'full' }, options });
  const live = { ...meta, pages: meta.pages.map(page => ({ ...page })) };
  const log = { applied: [], marked: [] };
  const doc = {
    fetchTable: async name => {
      const rows = { _grist_Tables: live.tables, _grist_Views_section: live.sections, _grist_Pages: live.pages }[name];
      assert.ok(rows, name);
      return { ...columnar(rows), ...(name === '_grist_Pages' && !meta.hasOptions ? { options: undefined } : {}) };
    },
    applyUserActions: async actions => {
      if (rejects) throw new Error('Blocked by table structure access rules');
      log.applied.push(actions);
      for (const [, , id, values] of actions) Object.assign(live.pages.find(page => page.id === id), values);
      return { retValues: [] };
    },
  };
  const tree = new PageTree({ doc, state, section: async () => own, enabled: () => enabled, mark: async list => { log.marked.push(list); return true; } });
  return { tree, log, live, state };
}

test('tidy : à l\'ouverture, les pages passent sous GFS en un lot, repliées, et la marque note les tables', async () => {
  const { tree, log, live } = setup();
  await tree.tidy();
  assert.equal(log.applied.length, 1);
  assert.deepEqual(layout(live), [['GFS', 0], ['GFS_Rangement', 1], ['GFS_Groupes', 1], ['GFS_Fichiers', 1], ['GFS_Partages', 1]]);
  assert.deepEqual(log.marked, [['GFS_Rangement', 'GFS_Groupes', 'GFS_Fichiers', 'GFS_Partages']]);
  assert.equal(JSON.parse(live.pages.find(page => page.id === 1).options).collapsed, true);
});

test('tidy : la marque d\'un passage précédent : rien n\'est écrit, une page que la personne a sortie ne revient pas', async () => {
  const meta = document();
  meta.pages.forEach(page => { if (page.id > 1) Object.assign(page, { indentation: 1 }); });
  Object.assign(meta.pages.find(page => page.id === 50), { indentation: 0, pagePos: 9 }); // GFS_Rangement ressortie par la personne
  const { tree, log } = setup({ meta, options: { [PAGES_KEY]: ['GFS_Rangement', 'GFS_Groupes', 'GFS_Fichiers', 'GFS_Partages'] } });
  await tree.tidy();
  assert.deepEqual([log.applied, log.marked], [[], []]);
});

test('tidy : une table créée plus tard se range seule, sous la page de GFS, sans replier ce que la personne a déplié, et la marque l\'ajoute', async () => {
  const { tree, log, live } = setup({ options: {} });
  await tree.tidy(); // premier rangement
  live.pages.find(page => page.id === 1).options = JSON.stringify({ collapsed: false }); // la personne a déplié
  live.tables.push({ id: 40, tableId: 'GFS_Corbeille', primaryViewId: 140 });
  live.sections.push({ id: 240, parentId: 140, parentKey: 'record', tableRef: 40 });
  live.pages.push({ id: 70, viewRef: 140, indentation: 0, pagePos: 20, options: '' });
  await tree.tidy();
  assert.deepEqual(layout(live).at(-1), ['GFS_Corbeille', 1]);
  assert.equal(JSON.parse(live.pages.find(page => page.id === 1).options).collapsed, false);
  assert.deepEqual(log.marked.at(-1), ['GFS_Rangement', 'GFS_Groupes', 'GFS_Fichiers', 'GFS_Partages', 'GFS_Corbeille']);
});

test('tidy : après son propre passage, GFS ne reprend pas ce que la personne a ressorti (même avant que Grist ne renvoie la marque)', async () => {
  const { tree, log, live } = setup({ options: {} });
  await tree.tidy();
  Object.assign(live.pages.find(page => page.id === 50), { indentation: 0, pagePos: 30 });
  await tree.tidy();
  assert.equal(layout(live).find(([name]) => name === 'GFS_Rangement')[1], 0);
  assert.equal(log.applied.length, 1);
});

test('tidy : niveau insuffisant, document en lecture seule, section de GFS non reconnue : rien n\'est écrit ni marqué', async () => {
  for (const extra of [{ enabled: false }, { own: { reason: 'no-section' } }, { own: { reason: 'draft' } }]) {
    const { tree, log } = setup(extra);
    await tree.tidy();
    assert.deepEqual([log.applied, log.marked], [[], []], JSON.stringify(extra));
  }
});

test('tidy : un document sans table de GFS ne note rien (la marque attend la première table)', async () => {
  const { tree, log } = setup({ meta: document({ names: ['GFS'] }) });
  await tree.tidy();
  assert.deepEqual([log.applied, log.marked], [[], []]);
});

test('tidy : Grist refuse l\'écriture (droits de structure) : aucune erreur, aucune marque, et un seul avertissement par ouverture', async t => {
  const warn = t.mock.method(console, 'warn', () => {});
  const { tree, log } = setup({ rejects: true });
  await tree.tidy();
  await tree.tidy();
  assert.deepEqual(log.marked, []);
  assert.equal(warn.mock.callCount(), 1);
});

test('une table que GFS crée annonce son identifiant réel, une écoute qui échoue ne gêne pas la création, et l\'écoute se retire', async t => {
  quiet(t);
  const created = [];
  const calls = [];
  const port = { doc: {
    fetchTable: async () => { throw new Error('Table not found'); },
    listTables: async () => [],
    applyUserActions: async actions => { calls.push(actions); return { retValues: [{ table_id: 'GFS_Rangement2' }] }; },
  } };
  const off = [onTableCreated(id => created.push(id)), onTableCreated(() => { throw new Error('écoute cassée'); }), onTableCreated(() => Promise.reject(new Error('rejet')))];
  const table = new OwnTable({ port, name: 'GFS_Rangement', columns: [{ id: 'Nom', type: 'Text' }], consent: async () => true });
  await table.ready();
  assert.deepEqual(created, ['GFS_Rangement2']);
  off.forEach(stop => stop());
  const second = new OwnTable({ port, name: 'GFS_Autre', columns: [{ id: 'Nom', type: 'Text' }], consent: async () => true });
  await second.ready();
  assert.deepEqual(created, ['GFS_Rangement2']);
});

// Un résumé de l'index des noms : Grist ne lui donne pas de vue propre (`primaryViewId` 0), seulement la page qu'on lui a créée, et une section « brute » sans page.
function withSummary(meta, name, view, pagePos) {
  const id = 70 + view;
  meta.tables.push({ id, tableId: name, primaryViewId: 0 });
  meta.sections.push({ id: 400 + view, parentId: 0, parentKey: 'record', tableRef: id }, { id: 500 + view, parentId: view, parentKey: 'record', tableRef: id });
  meta.pages.push({ id: 90 + view, viewRef: view, indentation: 0, pagePos, options: '' });
  return meta;
}

test('planTidy : la page d\'un résumé de l\'index des noms passe sous GFS, mais seulement quand GFS le dit sien (le nom est celui d\'une table d\'app)', () => {
  const meta = withSummary(document({ names: ['GFS', 'GFS_Rangement'] }), 'Publipostage_Modeles_summary_GFS_Cle', 9, 10);
  assert.deepEqual(planTidy(meta, 10, null).moved, ['GFS_Rangement'], 'sans le nom, c\'est la page de la personne : elle reste');
  const plan = planTidy(meta, 10, null, ['publipostage_modeles_summary_gfs_cle']);
  assert.deepEqual(plan.moved, ['GFS_Rangement', 'Publipostage_Modeles_summary_GFS_Cle']);
  assert.deepEqual(plan.seen, ['GFS_Rangement', 'Publipostage_Modeles_summary_GFS_Cle']);
  assert.deepEqual(layout(applied(meta, plan.actions)).slice(0, 2), [['GFS', 0], ['GFS_Rangement', 1]]);
  assert.equal(applied(meta, plan.actions).pages.find(page => page.viewRef === 9).indentation, 1);
});

test('planTidy : un résumé dont la page montre autre chose, ou que la personne a rangé, n\'est pas touché ; la marque l\'empêche de revenir', () => {
  const meta = withSummary(document({ names: ['GFS'] }), 'Pub_summary_GFS_Cle', 9, 10);
  meta.sections.push({ id: 900, parentId: 9, parentKey: 'record', tableRef: 1 }); // un autre widget sur la même page
  assert.deepEqual(planTidy(meta, 10, null, ['Pub_summary_GFS_Cle']).moved, []);
  const own = withSummary(document({ names: ['GFS'] }), 'Pub_summary_GFS_Cle', 9, 10);
  assert.deepEqual(planTidy(own, 10, ['Pub_summary_GFS_Cle'], ['Pub_summary_GFS_Cle']).moved, [], 'la marque connaît déjà ce résumé');
  own.pages.find(page => page.viewRef === 9).indentation = 1;
  assert.deepEqual(planTidy(own, 10, null, ['Pub_summary_GFS_Cle']).moved, [], 'rangé sous une autre page par la personne');
});

test('tidy : les noms de l\'index viennent de l\'environnement, à chaque passage', async t => {
  quiet(t);
  const meta = withSummary(document({ names: ['GFS'] }), 'Pub_summary_GFS_Cle', 9, 10);
  const writes = [];
  const doc = { fetchTable: async name => columnar({ _grist_Tables: meta.tables, _grist_Views_section: meta.sections, _grist_Pages: meta.pages }[name]),
    applyUserActions: async actions => { writes.push(...actions); } };
  const state = new GristState();
  const tree = new PageTree({ doc, state, section: async () => ({ id: 10 }), enabled: () => true, mark: async () => {}, names: () => ['Pub_summary_GFS_Cle'] });
  await tree.tidy();
  assert.ok(writes.some(action => action[2] === 99 && action[3].indentation === 1), 'la page du résumé est passée sous GFS');
});
