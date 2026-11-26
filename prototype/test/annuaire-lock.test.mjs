// Le verrou réel de « qui modifie les fiches » (js/annuaire/annuaire-lock.js ; choix du porteur, 26/11). Du code pur : les règles et les colonnes d'aide qu'il
// veut, les plans qu'il rend d'après les lignes des tables internes de Grist, et la preuve que les formules des colonnes d'aide disent la même chose que la règle
// de GFS (`editRight`) : les formules sont jouées par Python, pour chaque couple « celui qui modifie, la fiche ». Ce que Grist en fait (règles lues, refus à
// l'API) se mesure dans un vrai Grist : labo/run-annuaire-verrou.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readConfig } from '../js/annuaire/annuaire-config.js';
import { editRight } from '../js/annuaire/annuaire-edit-rights.js';
import { buildPeople } from '../js/annuaire/annuaire-model.js';
import { lockSpec, lockResources, planLock, planUnlock, lockState, isLockNote, NODE_COLUMN, EDITORS_COLUMN } from '../js/annuaire/annuaire-lock.js';

const col = (id, type, extra = {}) => ({ id, type, genre: type.startsWith('Ref:') ? 'ref' : type === 'Bool' ? 'bool' : 'text', ref: type.startsWith('Ref:') ? type.slice(4) : '',
  visible: '', ...extra });
const SCHEMA = {
  People: { columns: [col('Name', 'Text'), col('Email', 'Text'), col('Structure', 'Ref:Structures', { visible: 'Pole' }), col('Service', 'Text'), col('Role', 'Bool'),
    col('Visible', 'Bool')] },
  Structures: { columns: [col('Pole', 'Text'), col('Direction', 'Text')] },
};
const LEVELS = [{ label: 'Pôle', path: ['Structure', 'Pole'] }, { label: 'Direction', path: ['Structure', 'Direction'] }, { label: 'Service', path: ['Service'] }];
const config = (edit = {}, extra = {}) => readConfig({ name: 'Name', email: 'Email', levels: LEVELS, edit, ...extra });
const say = key => `note ${key}`;
const spec = (edit, extra) => lockSpec({ table: 'People', config: config(edit, extra), schema: SCHEMA });

// ---------- ce que le verrou veut ----------

test('sans règle de plus, seuls les propriétaires modifient : aucune colonne d\'aide, une seule ressource, la fiche se ferme à tous les autres', () => {
  const wanted = spec({});
  assert.equal(wanted.ok, true);
  assert.deepEqual(wanted.helpers, []);
  assert.deepEqual(wanted.protect, []);
  assert.deepEqual(lockResources(wanted, say).map(group => [group.colIds, group.rules.map(rule => `${rule.formula || '(reste)'} → ${rule.rights}`)]), [
    ['*', ['user.Access in [OWNER] → +CRUD', '(reste) → -U']]]);
});

test('chacun sa fiche : une colonne d\'aide, l\'adresse n\'est modifiable que par un propriétaire (sinon on se donnerait la fiche d\'un autre)', () => {
  const wanted = spec({ self: true });
  assert.deepEqual(wanted.helpers.map(each => each.id), [EDITORS_COLUMN]);
  assert.deepEqual(wanted.protect, ['Email']);
  const groups = lockResources(wanted, say);
  assert.deepEqual(groups.map(group => group.colIds), ['Email', '*']);
  assert.deepEqual(groups[0].rules.map(rule => rule.rights), ['+U', '-U']);
  assert.deepEqual(groups[1].rules.map(rule => rule.formula), ['user.Access in [OWNER]', 'user.Email and user.Email.lower() in rec.GFS_Editors', '']);
  assert.ok(groups.every(group => group.rules.every(rule => isLockNote(rule.memo))), 'toutes portent la note « GFS : Annuaire · … »');
});

test('sa structure et en dessous : deux colonnes d\'aide ; la colonne de chaque niveau et celle du rôle ne se changent que par un propriétaire', () => {
  const wanted = spec({ self: true, level: 'below', role: 'Role' });
  assert.deepEqual(wanted.helpers.map(each => each.id), [NODE_COLUMN, EDITORS_COLUMN]);
  assert.deepEqual(wanted.protect, ['Email', 'Role', 'Structure', 'Service']);
  assert.match(wanted.helpers[0].formula, /\$Structure\.Pole, \$Structure\.Direction, \$Service/);
  assert.match(wanted.helpers[1].formula, /range\(2, len\(parts\) \+ 1\)/);
  assert.match(spec({ level: 'own' }).helpers[1].formula, /\[len\(parts\)\]/, 'sans « en dessous », le seul nœud de la personne');
});

test('« Ma présence » : chacun garde la main sur la case de sa fiche, et sur elle seule', () => {
  const groups = lockResources(spec({}, { presence: { on: true, col: 'Visible' } }), say);
  assert.deepEqual(groups.map(group => group.colIds), ['Visible', '*']);
  assert.deepEqual(groups[0].rules.map(rule => rule.formula), ['user.Access in [OWNER]', 'user.Email and rec.Email and rec.Email.lower() == user.Email.lower()', '']);
});

test('ce que le verrou ne sait pas lire est dit, jamais deviné', () => {
  assert.equal(lockSpec({ table: '', config: config(), schema: SCHEMA }).reason, 'no-table');
  assert.equal(lockSpec({ table: 'Absente', config: config(), schema: SCHEMA }).reason, 'no-table');
  assert.equal(lockSpec({ table: 'People', config: readConfig({ name: 'Name' }), schema: SCHEMA }).reason, 'no-email');
  assert.equal(lockSpec({ table: 'People', config: config({}, { email: 'Structure › Pole' }), schema: SCHEMA }).reason, 'no-email', 'l\'adresse lue dans une table liée');
  assert.equal(spec({ role: 'Fantome' }).reason, 'no-column');
  assert.equal(spec({}, { presence: { on: true, col: 'Fantome' } }).reason, 'no-column');
  const lists = { ...SCHEMA, People: { columns: [...SCHEMA.People.columns, col('Tags', 'ChoiceList', { genre: 'choicelist' })] } };
  assert.equal(lockSpec({ table: 'People', config: config({ level: 'own' }, { levels: [{ label: 'Tags', path: ['Tags'] }] }), schema: lists }).reason, 'level');
  assert.equal(spec({ level: 'own' }, { hierarchy: false }).level, '', 'sans hiérarchie, aucune règle de structure');
});

// ---------- les plans ----------

const TABLES = [{ id: 7, tableId: 'People' }, { id: 8, tableId: 'Structures' }];
const COLUMNS = [{ id: 70, parentId: 7, colId: 'Name' }, { id: 71, parentId: 7, colId: 'Email' }];
const existing = (rules = [], resources = [], columns = COLUMNS) => ({ tables: TABLES, columns, rules, resources });
const DEFAULT = { resources: [{ id: 1, tableId: '', colIds: '' }], rules: [{ id: 1, resource: 1, aclFormula: '', permissionsText: 'all', permissions: 63, rulePos: 1 }] };

test('poser : les colonnes d\'aide d\'abord (le plan le dit et ne pose pas les règles), puis la liasse en une fois', () => {
  const wanted = spec({ self: true });
  const first = planLock(existing(), wanted, say);
  assert.equal(first.ok, false);
  assert.equal(first.reason, 'no-helper');
  assert.deepEqual(first.columns.map(action => action.slice(0, 3)), [['AddColumn', 'People', 'GFS_Editors']]);
  assert.equal(first.columns[0][3].isFormula, true);
  const helpers = [...COLUMNS, { id: 72, parentId: 7, colId: 'GFS_Editors', isFormula: true, formula: wanted.helpers[0].formula }];
  const plan = planLock(existing(DEFAULT.rules, DEFAULT.resources, helpers), wanted, say);
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.columns, []);
  assert.equal(plan.firstRule, true, 'aucune règle de la personne : la première règle du document coûte l\'import et la copie aux éditeurs');
  const resources = plan.actions.filter(action => action[1] === '_grist_ACLResources');
  assert.deepEqual(resources.map(action => [action[2], action[3].tableId, action[3].colIds]), [[2, 'People', 'Email'], [3, 'People', '*']]);
  const rules = plan.actions.filter(action => action[1] === '_grist_ACLRules');
  assert.deepEqual(rules.map(action => [action[2], action[3].resource, action[3].rulePos, action[3].permissionsText]), [
    [2, 2, 1, '+U'], [3, 2, 2, '-U'], [4, 3, 1, '+CRUD'], [5, 3, 2, '+U'], [6, 3, 3, '-U']]);
  assert.ok(rules.every(action => isLockNote(action[3].memo)));
  assert.equal(planLock(existing(DEFAULT.rules, DEFAULT.resources, helpers), wanted, say, { structure: true }).closes, true, 'la structure se ferme dans la même écriture, à la demande');
});

test('une colonne d\'aide dont la formule n\'est plus la bonne se corrige (ModifyColumn), sans toucher aux règles qui tiennent', () => {
  const wanted = spec({ self: true });
  const stale = [...COLUMNS, { id: 72, parentId: 7, colId: 'GFS_Editors', isFormula: true, formula: 'return ()' }];
  const plan = planLock(existing(DEFAULT.rules, DEFAULT.resources, stale), wanted, say);
  assert.deepEqual(plan.columns.map(action => action.slice(0, 3)), [['ModifyColumn', 'People', 'GFS_Editors']]);
});

test('déjà posé, le plan le dit ; un réglage qui change donne une mise à jour (les règles de GFS d\'avant partent, les nouvelles se posent)', () => {
  const columns = (wanted) => [...COLUMNS, ...wanted.helpers.map((each, at) => ({ id: 80 + at, parentId: 7, colId: each.id, isFormula: true, formula: each.formula }))];
  const first = spec({ self: true });
  const done = planLock(existing(DEFAULT.rules, DEFAULT.resources, columns(first)), first, say);
  const rows = done.actions.filter(action => action[1] === '_grist_ACLRules').map(action => ({ id: action[2], ...action[3] }));
  const resourceRows = done.actions.filter(action => action[1] === '_grist_ACLResources').map(action => ({ id: action[2], ...action[3] }));
  const placed = existing([...DEFAULT.rules, ...rows], [...DEFAULT.resources, ...resourceRows], columns(first));
  assert.equal(planLock(placed, first, say).reason, 'already');
  assert.equal(lockState(placed, first, say), 'current');
  assert.equal(lockState(existing(DEFAULT.rules, DEFAULT.resources), first, say), 'none');
  const changed = spec({ self: true, role: 'Role' });
  assert.equal(lockState({ ...placed, columns: columns(changed) }, changed, say), 'stale');
  const update = planLock({ ...placed, columns: columns(changed) }, changed, say);
  assert.equal(update.ok, true);
  assert.equal(update.replaces, true);
  assert.equal(update.actions[0][0], 'BulkRemoveRecord');
  assert.deepEqual(update.actions[0][2].sort(), rows.map(row => row.id).sort(), 'seules les règles de GFS partent');
  assert.equal(update.firstRule, true);
});

test('une règle d\'un autre auteur sur la table : GFS n\'y touche pas', () => {
  const wanted = spec({});
  const foreign = existing([...DEFAULT.rules, { id: 9, resource: 9, aclFormula: 'user.Access == EDITOR', permissionsText: '-U', rulePos: 1, memo: 'à la main' }],
    [...DEFAULT.resources, { id: 9, tableId: 'People', colIds: '*' }]);
  assert.equal(planLock(foreign, wanted, say).reason, 'foreign');
  assert.equal(lockState(foreign, wanted, say), 'foreign');
  assert.equal(planLock(existing(), { ok: false, reason: 'no-email' }, say).reason, 'no-email');
  assert.equal(planLock({ ...existing(), tables: [] }, wanted, say).reason, 'no-table');
});

test('retirer : les règles de GFS et les ressources qui n\'en gardent plus, avec les colonnes d\'aide ; jamais la règle d\'un autre', () => {
  const rules = [...DEFAULT.rules, { id: 5, resource: 6, aclFormula: '', permissionsText: '-U', rulePos: 1, memo: 'GFS : Annuaire · x' },
    { id: 6, resource: 6, aclFormula: 'a', permissionsText: '+U', rulePos: 2, memo: 'GFS : Annuaire · y' }, { id: 7, resource: 7, aclFormula: '', permissionsText: '-U', rulePos: 1, memo: 'GFS : Partagé' }];
  const resources = [...DEFAULT.resources, { id: 6, tableId: 'People', colIds: '*' }, { id: 7, tableId: 'GFS_Rangement', colIds: '*' }];
  const columns = [...COLUMNS, { id: 72, parentId: 7, colId: 'GFS_Editors' }, { id: 73, parentId: 7, colId: 'GFS_Node' }];
  const plan = planUnlock(existing(rules, resources, columns), 'People');
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.actions, [['BulkRemoveRecord', '_grist_ACLRules', [5, 6]], ['BulkRemoveRecord', '_grist_ACLResources', [6]], ['RemoveColumn', 'People', 'GFS_Editors'],
    ['RemoveColumn', 'People', 'GFS_Node']]);
  assert.equal(planUnlock(existing(DEFAULT.rules, DEFAULT.resources), 'People').reason, 'none');
});

// ---------- les formules disent ce que dit la règle de GFS ----------

const PYTHON = `
import json, re, sys
data = json.load(sys.stdin)
class Rec:
    def __init__(self, d):
        for k, v in d.items():
            setattr(self, k, Rec(v) if isinstance(v, dict) else v)
class Table:
    def __init__(self, rows): self.rows = rows
    def lookupRecords(self, **kw): return [r for r in self.rows if all(getattr(r, k, None) == v for k, v in kw.items())]
rows = [Rec(r) for r in data['rows']]
table = Table(rows)
def run(body, rec):
    code = 'def _f(rec):\\n' + '\\n'.join('    ' + line for line in re.sub(r'\\$(\\w+)', r'rec.\\1', body).splitlines())
    scope = {data['table']: table}
    exec(code, scope)
    return scope['_f'](rec)
for r in rows:
    r.GFS_Node = run(data['node'], r) if data['node'] else ''
out = {}
for r in rows:
    out[str(r.id)] = list(run(data['editors'], r))
print(json.dumps(out))
`;

const STRUCTURES = { id: [1, 2, 3], Pole: ['Ressources', 'Ressources', 'Recherche'], Direction: ['Finances', 'Personnel', 'Finances'] };
const PEOPLE_DATA = {
  id: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  Name: ['Ana', 'Bob', 'Cleo', 'Dan', 'Eve', 'Fay', 'Gus', 'Hal', 'Ivy'],
  Email: ['a@exemple.fr', ' B@Exemple.fr ', 'c@exemple.fr', 'd@exemple.fr', 'e@exemple.fr', 'f@exemple.fr', 'g@exemple.fr', 'h@exemple.fr', ''],
  Structure: [1, 1, 1, 1, 2, 3, 0, 0, 1],
  Service: ['Paie', 'Paie', 'Achats', '', 'Recrutement', 'Paie', '', 'Paie', 'Paie'],
  Role: [false, false, false, true, false, false, false, false, false],
};
const GRID = { People: PEOPLE_DATA, Structures: STRUCTURES };
const at = (table, id) => GRID[table].id.indexOf(id);
const python = spawnSync('python3', ['-c', 'import sys; sys.exit(0)']);

// Les lignes pour Python : la ligne et, pour une référence, la ligne visée (une référence vide donne des valeurs vides, comme Grist).
function pythonRows() {
  return PEOPLE_DATA.id.map((id, i) => {
    const ref = at('Structures', PEOPLE_DATA.Structure[i]);
    return { id, Email: PEOPLE_DATA.Email[i], Service: PEOPLE_DATA.Service[i], Role: PEOPLE_DATA.Role[i],
      Structure: ref < 0 ? { Pole: '', Direction: '' } : { Pole: STRUCTURES.Pole[ref], Direction: STRUCTURES.Direction[ref] } };
  });
}

function editorsOf(wanted) {
  const node = wanted.helpers.find(each => each.id === NODE_COLUMN);
  const run = spawnSync('python3', ['-I', '-c', PYTHON], { input: JSON.stringify({ table: 'People', rows: pythonRows(), node: node ? node.formula : '',
    editors: wanted.helpers.find(each => each.id === EDITORS_COLUMN).formula }), encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
}

const SCHEMA_DATA = { People: SCHEMA.People, Structures: SCHEMA.Structures };
const CASES = [{ self: true }, { level: 'own' }, { level: 'below' }, { role: 'Role' }, { self: true, level: 'below', role: 'Role' }, { self: true, level: 'own', role: 'Role' }];

for (const edit of CASES) {
  test(`les formules et la règle de GFS disent la même chose : ${JSON.stringify(edit)}`, { skip: python.status !== 0 && 'python3 absent' }, () => {
    const cfg = config(edit);
    const wanted = lockSpec({ table: 'People', config: cfg, schema: SCHEMA_DATA });
    assert.equal(wanted.ok, true);
    const found = editorsOf(wanted);
    const people = buildPeople(cfg, 'People', GRID, SCHEMA_DATA).filter(person => person.email.trim());
    const editors = new Set(PEOPLE_DATA.id.filter((id, i) => PEOPLE_DATA.Role[i] === true));
    const rows = PEOPLE_DATA.id.map((id, i) => [id, PEOPLE_DATA.Email[i].trim().toLowerCase()]).filter(([, mail]) => mail);
    for (const target of buildPeople(cfg, 'People', GRID, SCHEMA_DATA)) {
      for (const [, mail] of rows) {
        const expected = editRight(target, { identity: mail, people, config: cfg, editors }).can;
        assert.equal(found[String(target.row)].includes(mail), expected, `${mail} sur la fiche ${target.name} : GFS dit ${expected}, la formule ${found[String(target.row)]}`);
      }
    }
  });
}
