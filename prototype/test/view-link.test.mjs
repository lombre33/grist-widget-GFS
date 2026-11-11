// Le lien « Select by » que GFS pose lui-même (contrats 4.5, point 8). Un faux Grist ne sert ici qu'à vérifier ce que GFS lit, écrit et attend : que Grist redise le lien
// à un widget, et que la ligne cliquée arrive ensuite à l'app, se mesure dans un vrai Grist (labo/run-lien-grille.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ViewLink, planLink, LINK_KEY, MARK } from '../js/view-link.js';
import { GristState } from '../js/state.js';

const columnar = rows => Object.fromEntries(Object.keys(rows[0]).map(key => [key, rows.map(row => row[key])]));
// Une section de Grist : la nôtre est la 10 (un widget personnalisé de la page 3, table Clients = 1).
const row = (id, parentKey, { parentId = 3, tableRef = 1, link = 0 } = {}) => ({ id, parentKey, parentId, tableRef, linkSrcSectionRef: link, linkSrcColRef: 0, linkTargetColRef: 0 });
const OWN = 10;

test('planLink : une seule grille de la même table sur la page : le lien est posé, comme le panneau de droite de Grist l\'écrit, et se défait', () => {
  const plan = planLink(columnar([row(7, 'record'), row(OWN, 'custom')]), OWN);
  assert.equal(plan.source, 7);
  assert.deepEqual(plan.actions, [['UpdateRecord', '_grist_Views_section', OWN, { linkSrcSectionRef: 7, linkSrcColRef: 0, linkTargetColRef: 0 }]]);
  assert.deepEqual(plan.undo, [['UpdateRecord', '_grist_Views_section', OWN, { linkSrcSectionRef: 0, linkSrcColRef: 0, linkTargetColRef: 0 }]]);
});

test('planLink : une fiche ou une liste de fiches de la même table vaut une grille', () => {
  assert.equal(planLink(columnar([row(7, 'single'), row(OWN, 'custom')]), OWN).source, 7);
  assert.equal(planLink(columnar([row(7, 'detail'), row(OWN, 'custom')]), OWN).source, 7);
});

test('planLink : une fiche liée à la grille suit son curseur : la grille seule est la source ; deux grilles indépendantes restent ambiguës', () => {
  assert.equal(planLink(columnar([row(7, 'record'), row(8, 'single', { link: 7 }), row(OWN, 'custom')]), OWN).source, 7);
  assert.equal(planLink(columnar([row(7, 'record'), row(8, 'single'), row(OWN, 'custom')]), OWN).reason, 'several');
});

test('planLink : ni une autre page, ni une autre table, ni un graphique, ni un autre widget, ni elle-même ne sont des candidates', () => {
  const sections = columnar([row(OWN, 'custom'), row(1, 'record', { parentId: 4 }), row(2, 'record', { tableRef: 2 }), row(3, 'chart'), row(4, 'custom'), row(5, 'form')]);
  assert.equal(planLink(sections, OWN).reason, 'none');
});

test('planLink : plusieurs grilles de la même table : GFS ne choisit pas pour la personne', () => {
  assert.equal(planLink(columnar([row(7, 'record'), row(8, 'record'), row(OWN, 'custom')]), OWN).reason, 'several');
});

test('planLink : déjà reliée (par la personne, à n\'importe quelle section) : rien n\'est touché ; section inconnue ou sans table : rien', () => {
  assert.equal(planLink(columnar([row(7, 'record'), row(OWN, 'custom', { link: 9 })]), OWN).reason, 'linked');
  assert.equal(planLink(columnar([row(7, 'record'), row(OWN, 'custom')]), 99).reason, 'no-section');
  assert.equal(planLink(columnar([row(7, 'record', { tableRef: 0 }), row(OWN, 'custom', { tableRef: 0 })]), OWN).reason, 'none');
});

// GFS dans un document : ce que Grist dit à GFS (`state`), la table des sections, et ce que GFS écrit.
function setup({ sections = [row(7, 'record'), row(OWN, 'custom')], options = { gfs: {} }, linked = false, own = { id: OWN }, enabled = true, chosen = false, confirms = true, rejects = false } = {}) {
  const state = new GristState();
  const feedOptions = asTarget => state.feed({ settings: { accessLevel: 'full', linking: { asTarget, asSource: null } }, options: options.gfs });
  feedOptions(linked ? 'Cursor:Same-Table' : null);
  state.feed({ tableId: 'Clients', rowId: 1, dataChange: true });
  const document = { sections: sections.map(item => ({ ...item })) };
  const log = { applied: [], said: [], marked: [] };
  const doc = {
    fetchTable: async name => { assert.equal(name, '_grist_Views_section'); return columnar(document.sections); },
    applyUserActions: async actions => {
      if (rejects) throw new Error('Blocked by table structure access rules');
      log.applied.push(actions);
      for (const [, , id, values] of actions) {
        Object.assign(document.sections.find(item => item.id === id), values);
        // Grist redit les réglages de la section de GFS quand son lien change.
        if (id === OWN && confirms) feedOptions(values.linkSrcSectionRef ? 'Cursor:Same-Table' : null);
      }
      return { retValues: [] };
    },
  };
  const link = new ViewLink({
    doc, state, section: async () => own, enabled: () => enabled, chosen: () => chosen,
    mark: async value => { log.marked.push(value); return true; }, say: (key, vars) => log.said.push([key, vars]), timers: { setTimeout: fn => setImmediate(fn) },
  });
  return { link, log, document };
}
const quiet = t => t.mock.method(console, 'warn', () => {});

test('ensure : le lien est posé une fois, confirmé par Grist, la marque écrite, et GFS le dit', async () => {
  const { link, log, document } = setup();
  await link.ensure();
  assert.equal(document.sections.find(item => item.id === OWN).linkSrcSectionRef, 7);
  assert.equal(log.applied.length, 1);
  assert.deepEqual(log.marked, [MARK.linked]);
  assert.deepEqual(log.said, [['link.done', { table: 'Clients' }]]);
  await link.ensure(); // une seule fois par ouverture
  assert.equal(log.applied.length, 1);
});

test('ensure : la marque d\'un passage précédent : rien n\'est écrit (une personne qui a retiré le lien ne le voit pas revenir)', async () => {
  const { link, log } = setup({ options: { gfs: { [LINK_KEY]: MARK.linked } } });
  await link.ensure();
  assert.deepEqual([log.applied, log.marked, log.said], [[], [], []]);
});

test('ensure : section déjà reliée, autre table de travail choisie, niveau insuffisant : rien n\'est écrit', async () => {
  for (const extra of [{ linked: true }, { chosen: true }, { enabled: false }]) {
    const { link, log } = setup(extra);
    await link.ensure();
    assert.deepEqual([log.applied, log.marked, log.said], [[], [], []], JSON.stringify(extra));
  }
});

test('ensure : plusieurs grilles de la même table : GFS le dit, retient qu\'il l\'a dit, et n\'écrit aucun lien', async () => {
  const { link, log } = setup({ sections: [row(7, 'record'), row(8, 'record'), row(OWN, 'custom')] });
  await link.ensure();
  assert.deepEqual(log.applied, []);
  assert.deepEqual(log.marked, [MARK.several]);
  assert.deepEqual(log.said, [['link.several', { table: 'Clients' }]]);
});

test('ensure : aucune grille, ou section de GFS non reconnue : rien n\'est écrit ni dit', async () => {
  for (const extra of [{ sections: [row(OWN, 'custom')] }, { own: { reason: 'no-section' } }, { own: { reason: 'draft' } }]) {
    const { link, log } = setup(extra);
    await link.ensure();
    assert.deepEqual([log.applied, log.marked, log.said], [[], [], []], JSON.stringify(extra));
  }
});

test('ensure : Grist ne confirme pas le lien dans nos réglages (ce n\'était pas notre section) : l\'écriture est défaite, rien n\'est marqué ni dit', async () => {
  const { link, log, document } = setup({ confirms: false });
  await link.ensure();
  assert.equal(log.applied.length, 2);
  assert.equal(document.sections.find(item => item.id === OWN).linkSrcSectionRef, 0);
  assert.deepEqual([log.marked, log.said], [[], []]);
});

test('ensure : Grist refuse l\'écriture (les droits du document) : GFS n\'insiste pas et ne lève pas d\'erreur', async t => {
  quiet(t);
  const { link, log } = setup({ rejects: true });
  await link.ensure();
  assert.deepEqual([log.marked, log.said], [[], []]);
});
