// Ce que la fenêtre du verrou montre (js/annuaire/annuaire-lock-view.js ; choix du porteur, 26/11 : « Oui, sur demande, avec aperçu ») : l'état, les phrases des règles, ce que
// cela change, les règles exactes, les gestes possibles. Du code pur, d'après les lignes des tables internes de Grist ; le dessin se mesure sous Firefox
// (test/annuaire-verrou-firefox.mjs) et ce que Grist en fait dans le labo (labo/run-annuaire-verrou.mjs).
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createI18n } from '../js/i18n/i18n.js';
import { readConfig } from '../js/annuaire/annuaire-config.js';
import { lockSpec, planLock } from '../js/annuaire/annuaire-lock.js';
import { lockModel } from '../js/annuaire/annuaire-lock-view.js';

const col = (id, type, extra = {}) => ({ id, type, genre: type.startsWith('Ref:') ? 'ref' : type === 'Bool' ? 'bool' : 'text', ref: type.startsWith('Ref:') ? type.slice(4) : '',
  visible: '', ...extra });
const SCHEMA = {
  People: { columns: [col('Name', 'Text'), col('Email', 'Text'), col('Structure', 'Ref:Structures', { visible: 'Pole' }), col('Service', 'Text'), col('Role', 'Bool'),
    col('Visible', 'Bool')] },
  Structures: { columns: [col('Pole', 'Text'), col('Direction', 'Text')] },
};
const LEVELS = [{ label: 'Pôle', path: ['Structure', 'Pole'] }, { label: 'Direction', path: ['Structure', 'Direction'] }, { label: 'Service', path: ['Service'] }];
const config = (edit = {}, extra = {}) => readConfig({ name: 'Name', email: 'Email', levels: LEVELS, edit, ...extra });
const DEFAULT = { resources: [{ id: 1, tableId: '', colIds: '' }], rules: [{ id: 1, resource: 1, aclFormula: '', permissionsText: 'all', permissions: 63, rulePos: 1 }] };
const TABLES = [{ id: 7, tableId: 'People' }, { id: 8, tableId: 'Structures' }];
const COLUMNS = [{ id: 70, parentId: 7, colId: 'Name' }, { id: 71, parentId: 7, colId: 'Email' }];
const raw = (columns = COLUMNS, resources = DEFAULT.resources, rules = DEFAULT.rules) => ({ tables: TABLES, columns, resources, rules });
const withHelpers = (edit, extra) => {
  const wanted = lockSpec({ table: 'People', config: config(edit, extra), schema: SCHEMA });
  return [...COLUMNS, ...wanted.helpers.map((each, at) => ({ id: 80 + at, parentId: 7, colId: each.id, isFormula: true, formula: each.formula }))];
};
// Les lignes que pose la liasse du réglage `edit` : le document tel qu'il est une fois le verrou posé.
function placed(edit, extra, { structure = false } = {}) {
  const columns = withHelpers(edit, extra);
  const wanted = lockSpec({ table: 'People', config: config(edit, extra), schema: SCHEMA });
  const plan = planLock(raw(columns), wanted, key => `note ${key}`, { structure });
  const rows = name => plan.actions.filter(action => action[1] === name).map(action => ({ id: action[2], ...action[3] }));
  return raw(columns, [...DEFAULT.resources, ...rows('_grist_ACLResources')], [...DEFAULT.rules, ...rows('_grist_ACLRules')]);
}

const i18n = createI18n('fr');
const model = (document, edit = {}, extra = {}, language = 'fr') => lockModel({ raw: document, table: 'People', config: config(edit, extra), schema: SCHEMA,
  t: createI18n(language).t, locale: language });

test('aucun verrou : il se pose, la structure est proposée, rien n\'est à retirer ni à fermer seul', () => {
  const view = model(raw(withHelpers({ self: true })), { self: true });
  assert.equal(view.state, 'none');
  assert.equal(view.ready, true);
  assert.equal(view.put, 'put');
  assert.equal(view.remove, false);
  assert.equal(view.offer, true, 'fermer la structure en même temps est proposé');
  assert.equal(view.close, false);
  assert.equal(view.text, i18n.t('an.lock.state.none'));
});

test('les phrases disent la table d\'abord, puis ce qui se protège ; chaque règle de l\'aperçu a sa ligne exacte', () => {
  const view = model(raw(withHelpers({ self: true, level: 'below', role: 'Role' })), { self: true, level: 'below', role: 'Role' }, { presence: { on: true, col: 'Visible' } });
  assert.equal(view.rules[0], i18n.t('an.lock.r.owners'));
  assert.match(view.rules[1], /^Peuvent aussi modifier une fiche : la personne elle-même/);
  assert.equal(view.rules[2], i18n.t('an.lock.r.others'));
  assert.ok(view.rules.some(rule => rule.startsWith('Seul un propriétaire change Email, Role, Structure, Service')), 'les colonnes qui donnent des droits');
  assert.ok(view.rules.some(rule => rule === 'Chacun garde la main sur « Visible » de sa propre fiche.'), 'la présence');
  assert.deepEqual(view.codes.groups.map(group => group.where), ['colonnes Email, Role, Structure, Service', 'colonnes Visible', 'toute la table']);
  assert.deepEqual(view.codes.helpers.map(each => each.id), ['GFS_Node', 'GFS_Editors']);
  assert.deepEqual(view.codes.groups.at(-1).lines.map(line => line.rights), ['+CRUD', '+U', '-U']);
  assert.equal(view.codes.groups.at(-1).lines.at(-1).formula, i18n.t('an.lock.code.rest'), 'la dernière ligne n\'a pas de condition : « toute autre personne »');
});

test('ce que cela change : les colonnes ajoutées, les outils qui écrivent, le rechargement, la première règle du document', () => {
  const view = model(raw(COLUMNS), { self: true, level: 'own' });
  assert.ok(view.costs[0].startsWith('GFS ajoute 2 colonnes à « People » : GFS_Node, GFS_Editors.'));
  assert.ok(view.costs.includes(i18n.t('an.lock.c.tools')));
  assert.ok(view.costs.includes(i18n.t('an.lock.c.who')), 'la personne est reconnue à son adresse');
  assert.ok(view.costs.includes(i18n.t('rights.ask.firstRule')), 'aucune règle de la personne dans le document');
  assert.equal(view.costs.at(-1), i18n.t('an.lock.c.reload'));
  const fixed = model(raw([...COLUMNS, { id: 72, parentId: 7, colId: 'GFS_Editors', isFormula: true, formula: 'return ()' }]), { self: true });
  assert.ok(fixed.costs[0].startsWith('GFS corrige 1 colonne d’aide : GFS_Editors.'));
  const none = model(raw(COLUMNS), {});
  assert.equal(none.costs.some(cost => /ajoute/.test(cost)), false, 'sans règle de plus, aucune colonne d\'aide');
  assert.equal(none.put, 'put');
});

test('en anglais : mêmes phrases, mêmes gestes, le pluriel suit', () => {
  const view = model(raw(COLUMNS), { self: true, level: 'own' }, {}, 'en');
  assert.ok(view.costs[0].startsWith('GFS adds 2 columns to “People”: GFS_Node, GFS_Editors.'));
  assert.equal(view.rules[0], createI18n('en').t('an.lock.r.owners'));
  assert.equal(view.text, createI18n('en').t('an.lock.state.none'));
});

test('posé : à jour, rien à redire de ce que cela change ; retirer est possible ; la structure ouverte se ferme seule', () => {
  const view = model(placed({ self: true }), { self: true });
  assert.equal(view.state, 'current');
  assert.equal(view.put, '', 'rien à poser : le bouton reste là, grisé');
  assert.equal(view.remove, true);
  assert.equal(view.costs.length, 0);
  assert.equal(view.offer, false, 'l\'interrupteur est pour la pose ; la fermeture seule est un geste du pied');
  assert.equal(view.close, true);
  const closed = model(placed({ self: true }, {}, { structure: true }), { self: true });
  assert.equal(closed.closed, true);
  assert.equal(closed.close, false, 'déjà fermée : rien à fermer');
});

test('un réglage qui a changé depuis la pose : mise à jour', () => {
  const view = model(placed({ self: true }), { self: true, role: 'Role' });
  assert.equal(view.state, 'stale');
  assert.equal(view.put, 'update');
  assert.equal(view.remove, true);
  assert.equal(view.ready, true);
});

test('ce que le verrou ne sait pas poser est dit, rien n\'est proposé : ni règles, ni interrupteur, ni pose', () => {
  const noEmail = lockModel({ raw: raw(), table: 'People', config: readConfig({ name: 'Name' }), schema: SCHEMA, t: i18n.t, locale: 'fr' });
  assert.equal(noEmail.state, 'no-email');
  assert.equal(noEmail.ready, false);
  assert.equal(noEmail.put, '');
  assert.deepEqual([noEmail.rules, noEmail.costs, noEmail.codes], [[], [], null]);
  assert.equal(noEmail.text, i18n.t('an.lock.state.no-email'));
  const foreign = model(raw(COLUMNS, [...DEFAULT.resources, { id: 9, tableId: 'People', colIds: '*' }],
    [...DEFAULT.rules, { id: 9, resource: 9, aclFormula: 'user.Access == EDITOR', permissionsText: '-U', rulePos: 1, memo: 'à la main' }]), {});
  assert.equal(foreign.state, 'foreign');
  assert.equal(foreign.put, '');
  assert.equal(foreign.remove, false, 'GFS ne retire pas la règle d\'un autre');
  assert.equal(foreign.rules.length, 0);
});

test('le verrou suit le réglage enregistré : sa clé change avec ce qui donne des droits, pas avec le nom', () => {
  const one = model(raw(COLUMNS), { self: true });
  assert.equal(one.key, model(raw(COLUMNS), { self: true }).key);
  assert.notEqual(one.key, model(raw(COLUMNS), { self: true, role: 'Role' }).key);
  assert.equal(one.key, lockModel({ raw: raw(COLUMNS), table: 'People', config: readConfig({ name: 'Name', email: 'Email', levels: LEVELS, edit: { self: true }, title: 'Autre nom' }),
    schema: SCHEMA, t: i18n.t, locale: 'fr' }).key);
});

test('chaque mot de reprise que le verrou retient est reconnu par le contrôleur, avec sa phrase (sinon l\'annuaire ne rouvrirait pas, ou dirait celle du sous-annuaire)', () => {
  const control = readFileSync(new URL('../js/annuaire/annuaire-lock-control.js', import.meta.url), 'utf8');
  const controller = readFileSync(new URL('../js/controller.js', import.meta.url), 'utf8');
  const words = [...control.matchAll(/'(annuaire:[a-z]+)'[,)]/g)].map(match => match[1]);
  assert.deepEqual([...new Set(words)].sort(), ['annuaire:close', 'annuaire:lock', 'annuaire:unlock']);
  const phrases = { 'annuaire:lock': 'an.lock.done', 'annuaire:unlock': 'an.lock.removed', 'annuaire:close': 'an.lock.closed' };
  for (const [word, phrase] of Object.entries(phrases)) {
    assert.match(controller, new RegExp(`'${word}': \\(\\) => void openAnnuaire\\(this\\)\\.then\\(\\(\\) => this\\.notice\\(this\\.t\\('${phrase.replace('.', '\\.')}'\\)\\)\\)`), word);
    assert.ok(createI18n('fr').t(phrase) !== phrase && createI18n('en').t(phrase) !== phrase, `${phrase} est dite dans les deux langues`);
  }
});
