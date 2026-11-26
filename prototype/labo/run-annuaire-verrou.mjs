// Le verrou réel de « qui modifie les fiches » (js/annuaire/annuaire-lock.js ; choix du porteur, 26/11 : « Oui, sur demande, avec aperçu »), dans un VRAI serveur Grist
// (l'image officielle, `GRIST_MULTI=1 bash vrai-serveur.sh`), sans navigateur : chaque personne a sa session (lab-multi.mjs) et attaque la donnée brute par l'API REST,
// sans passer par GFS. Le verrou n'est pas dans l'écran : c'est ce que Grist répond à une personne qui n'a pas le droit.
//   1. le plan de GFS pose les colonnes d'aide, puis les règles ; les formules calculent, dans Grist, ce que la règle de GFS (`editRight`) dit, pour chaque couple
//      « adresse, fiche » ;
//   2. l'éditeur de la structure, l'éditeur désigné par un rôle et le lecteur essaient chaque fiche, puis les colonnes qui donnent des droits (adresse, structure, rôle),
//      la case de « Ma présence », l'ajout et la suppression d'une fiche (inchangés), la formule d'une colonne d'aide (le trou tant que la structure est ouverte) ;
//   3. un changement du document (une personne change de structure) se répercute aussitôt ; un réglage qui change se met à jour ; la structure se ferme ;
//   4. une règle d'un autre auteur sur la table : GFS n'y touche pas ; le retrait ne laisse rien (règles, ressources, colonnes d'aide).
//   GRIST_MULTI=1 bash vrai-serveur.sh && node run-annuaire-verrou.mjs
import { say, check, constat } from './lab-common.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { schemaOf } from '../js/annuaire/annuaire-schema.js';
import { readConfig } from '../js/annuaire/annuaire-config.js';
import { lockSpec, planLock, planUnlock, lockState, isLockNote } from '../js/annuaire/annuaire-lock.js';
import { planCloseStructure } from '../js/rights/rights-plan.js';
import { editRight } from '../js/annuaire/annuaire-edit-rights.js';
import { buildPeople } from '../js/annuaire/annuaire-model.js';
import { login, newDocument, share, applyAs, rowsOf, columnar } from './lab-multi.mjs';

const { t } = createI18n(process.env.LAB_LANG || 'fr');
const say_ = key => t(`an.lock.note.${key}`);
const EDITOR = 'editor@example.com', ROLE = 'editor2@example.com', VIEWER = 'viewer@example.com';
const LEVELS = [{ label: 'Pôle', path: ['Structure', 'Pole'] }, { label: 'Direction', path: ['Structure', 'Direction'] }, { label: 'Service', path: ['Service'] }];
const config = edit => readConfig({ name: 'Name', email: 'Email', levels: LEVELS, edit, presence: { on: true, col: 'Visible' } });
const EDIT = { self: true, level: 'below', role: 'Role' };

const STRUCTURES = [['Ressources', 'Finances'], ['Ressources', 'Personnel'], ['Recherche', 'Finances']];
// nom, adresse, structure (numéro, 0 : aucune), service, rôle
const PEOPLE = [['Ana', 'ana@exemple.fr', 1, 'Paie', false], ['Bob', 'bob@exemple.fr', 1, 'Paie', false], ['Cleo', 'cleo@exemple.fr', 1, 'Achats', false],
  ['Dan', EDITOR, 1, '', false], ['Eve', 'eve@exemple.fr', 2, 'Recrutement', false], ['Fay', 'fay@exemple.fr', 3, 'Paie', false], ['Gus', 'gus@exemple.fr', 0, '', false],
  ['Hal', 'hal@exemple.fr', 0, 'Paie', false], ['Ivy', ROLE, 0, '', true], ['Zoe', VIEWER, 0, '', false]];

const owner = await login('owner@example.com');
const editor = await login(EDITOR);
const designated = await login(ROLE);
const viewer = await login(VIEWER);
const docId = await newDocument(owner, `Verrou ${new Date().toISOString()}`);
check('le document est créé par le propriétaire', typeof docId === 'string' && docId.length > 10, docId);
const into = (person, actions) => applyAs(person, docId, actions);
const ok = answer => answer.status === 200;
const attempt = (person, id, fields) => into(person, [['UpdateRecord', 'People', id, fields]]);

// ---------- le document ----------
await into(owner, [['AddTable', 'Structures', [{ id: 'Pole', type: 'Text' }, { id: 'Direction', type: 'Text' }]],
  ['AddTable', 'People', [{ id: 'Name', type: 'Text' }, { id: 'Email', type: 'Text' }, { id: 'Structure', type: 'Ref:Structures' }, { id: 'Service', type: 'Text' },
    { id: 'Role', type: 'Bool' }, { id: 'Visible', type: 'Bool' }, { id: 'Note', type: 'Text' }]],
  ['BulkAddRecord', 'Structures', STRUCTURES.map((_, i) => i + 1), { Pole: STRUCTURES.map(row => row[0]), Direction: STRUCTURES.map(row => row[1]) }],
  ['BulkAddRecord', 'People', PEOPLE.map((_, i) => i + 1), { Name: PEOPLE.map(row => row[0]), Email: PEOPLE.map(row => row[1]), Structure: PEOPLE.map(row => row[2]),
    Service: PEOPLE.map(row => row[3]), Role: PEOPLE.map(row => row[4]), Visible: PEOPLE.map(() => true) }]]);
check('les personnes, éditeurs et lecteur ont accès au document', ok(await share(owner, docId, { [EDITOR]: 'editors', [ROLE]: 'editors', [VIEWER]: 'viewers' })));
const at = name => PEOPLE.findIndex(row => row[0] === name) + 1;

// Ce que Grist dit des tables et des règles, lu par le propriétaire : de quoi faire les plans de GFS.
async function existing() {
  const [resources, rules, tables, columns] = await Promise.all(['_grist_ACLResources', '_grist_ACLRules', '_grist_Tables', '_grist_Tables_column'].map(name => rowsOf(owner, docId, name)));
  return { resources, rules, tables, columns, schema: schemaOf(columnar(tables), columnar(columns)) };
}
const specOf = async (edit, state) => lockSpec({ table: 'People', config: config(edit), schema: (state || await existing()).schema });

// Ce que la règle de GFS dit de chaque fiche, pour chaque adresse : les adresses qui la modifient.
function expected(edit, rows, schema) {
  const cfg = config(edit);
  const grid = { People: columnar(rows.People), Structures: columnar(rows.Structures) };
  const people = buildPeople(cfg, 'People', grid, schema);
  const editors = new Set(rows.People.filter(row => row.Role === true).map(row => row.id));
  return Object.fromEntries(people.map(person => [person.row, rows.People.map(row => row.Email).filter(Boolean).filter(mail => editRight(person, { identity: mail, people,
    config: cfg, editors }).can).map(mail => mail.trim().toLowerCase()).sort()]));
}
const listOf = cell => (Array.isArray(cell) ? (cell[0] === 'L' ? cell.slice(1) : cell) : []);
const tableRows = async () => ({ People: await rowsOf(owner, docId, 'People'), Structures: await rowsOf(owner, docId, 'Structures') });

// ---------- 1. poser ----------
say('--- 1. le plan de GFS : les colonnes d\'aide, puis les règles ---');
let state = await existing();
let spec = await specOf(EDIT, state);
check('GFS sait lire le réglage (adresse, niveaux, rôle, présence)', spec.ok && spec.helpers.length === 2, spec.reason || spec.helpers.map(each => each.id));
let plan = planLock(state, spec, say_);
check('le plan commence par les colonnes d\'aide (Grist refuse une règle sur une colonne absente)', plan.reason === 'no-helper' && plan.columns.length === 2, plan.reason);
const added = await into(owner, plan.columns);
check('Grist accepte les deux colonnes d\'aide (formules)', ok(added), added.text);
state = await existing();
plan = planLock(state, spec, say_);
check('le plan des règles est prêt, première règle du document', plan.ok && plan.firstRule === true, plan.reason);
const written = await into(owner, plan.actions);
check('Grist accepte la liasse des règles (une seule écriture)', ok(written), written.text);
state = await existing();
check('GFS relit l\'état : « posé, à jour »', lockState(state, spec, say_) === 'current', lockState(state, spec, say_));
check('toutes les règles portent la note « GFS : Annuaire · … »', state.rules.filter(rule => isLockNote(rule.memo)).length === 8 && state.rules.every(rule => rule.memo === '' || isLockNote(rule.memo) || rule.memo === undefined),
  state.rules.map(rule => rule.memo));

say('--- ce que les formules calculent dans Grist, comparé à la règle de GFS ---');
const rows = await tableRows();
const want = expected(EDIT, rows, state.schema);
const got = Object.fromEntries(rows.People.map(row => [row.id, listOf(row.GFS_Editors).slice().sort()]));
const mismatches = Object.keys(want).filter(id => JSON.stringify(want[id]) !== JSON.stringify(got[id]));
check('GFS_Editors vaut, pour chaque fiche, les adresses que `editRight` accepte', mismatches.length === 0, mismatches.map(id => [id, want[id], got[id]]));
say('CONSTAT GFS_Node de Dan :', JSON.stringify(rows.People.find(row => row.Name === 'Dan').GFS_Node));

// ---------- 2. les attaques ----------
say('--- 2. chacun essaie chaque fiche (colonne libre « Note ») ---');
async function sweep(person, who) {
  const wrong = [];
  for (const row of PEOPLE) {
    const id = at(row[0]);
    const answer = await attempt(person, id, { Note: `par ${who}` });
    const shouldPass = (want[id] || []).includes(person.email);
    if (ok(answer) !== shouldPass) wrong.push([row[0], answer.status, shouldPass]);
  }
  return wrong;
}
check('Dan (sa fiche, sa structure et dessous, rôle non) : exactement les fiches que GFS lui ouvre', (await sweep(editor, 'Dan')).length === 0, await sweep(editor, 'Dan'));
check('Ivy (rôle désigné) : toutes les fiches', (await sweep(designated, 'Ivy')).length === 0, await sweep(designated, 'Ivy'));
const read = await viewer.call('GET', `/api/docs/${docId}/tables/People/records`);
check('le lecteur lit toujours l\'annuaire (la lecture ne change pas)', read.status === 200 && read.json.records.length === PEOPLE.length, read.status);
check('le lecteur n\'écrit rien, pas même sa fiche', !ok(await attempt(viewer, at('Zoe'), { Note: 'x' })));
const refused = await attempt(editor, at('Eve'), { Note: 'hors de sa structure' });
check('un refus de Grist cite la note de la règle (de quoi l\'expliquer à la personne)', !ok(refused) && /Annuaire/.test(refused.text) , refused.text);
say('CONSTAT le refus dit :', refused.text.slice(0, 300));

say('--- les colonnes qui donnent des droits : seul un propriétaire ---');
const cols = [['Email', { Email: 'dan2@exemple.fr' }], ['Structure', { Structure: 2 }], ['Service', { Service: 'Paie' }], ['Role', { Role: true }]];
for (const [name, fields] of cols) check(`Dan ne change pas sa propre colonne « ${name} »`, !ok(await attempt(editor, at('Dan'), fields)));
check('Dan ne change pas non plus l\'adresse d\'une fiche qu\'il peut modifier (Ana)', !ok(await attempt(editor, at('Ana'), { Email: 'ana2@exemple.fr' })));
check('Ivy (rôle) ne se donne pas de droits en changeant une colonne protégée', !ok(await attempt(designated, at('Eve'), { Structure: 1 })));
check('mais Dan écrit la colonne libre de sa fiche en même temps qu\'un refus ailleurs : tout ou rien', !ok(await attempt(editor, at('Dan'), { Note: 'ok', Email: 'x@y.z' })));
check('le propriétaire change ces colonnes (il garde la main)', ok(await attempt(owner, at('Gus'), { Email: 'gus@exemple.fr', Role: false, Structure: 0 })));

say('--- « Ma présence » : chacun garde la main sur sa propre case ---');
check('Dan change sa propre case « Visible »', ok(await attempt(editor, at('Dan'), { Visible: false })));
check('mais pas celle d\'Ana, qu\'il peut pourtant modifier', !ok(await attempt(editor, at('Ana'), { Visible: false })));
check('Ivy (rôle) non plus : seule la personne et un propriétaire changent la présence', !ok(await attempt(designated, at('Ana'), { Visible: false })));
check('le propriétaire change la case de qui il veut', ok(await attempt(owner, at('Ana'), { Visible: true })));

say('--- ajouter et supprimer une fiche : inchangé (Grist décide) ---');
const added2 = await into(editor, [['AddRecord', 'People', null, { Name: 'Nouveau', Email: 'nouveau@exemple.fr' }]]);
constat('un éditeur ajoute une fiche (le verrou ne règle que la modification)', ok(added2), added2.text);
if (ok(added2)) constat('un éditeur supprime une fiche qu\'il a ajoutée', ok(await into(editor, [['RemoveRecord', 'People', added2.json.retValues[0]]])));

say('--- le trou tant que la structure est ouverte ---');
const hole = await into(editor, [['ModifyColumn', 'People', 'GFS_Editors', { formula: 'return ("editor@example.com",)' }]]);
constat('structure ouverte : un éditeur réécrit la formule de la colonne d\'aide (le verrou est alors partiel)', !ok(hole), hole.text);
if (ok(hole)) {
  check('…et se donne alors la fiche d\'Eve', ok(await attempt(editor, at('Eve'), { Note: 'trou' })));
  await into(owner, [['ModifyColumn', 'People', 'GFS_Editors', { formula: spec.helpers.find(each => each.id === 'GFS_Editors').formula }]]);
}
state = await existing();
const closing = planCloseStructure(state);
check('GFS ferme la structure (la règle d\'avant le partage : un seul geste)', closing.ok, closing.reason);
check('Grist accepte', ok(await into(owner, closing.actions)));
const after = await into(editor, [['ModifyColumn', 'People', 'GFS_Editors', { formula: 'return ("editor@example.com",)' }]]);
check('structure fermée : la formule d\'une colonne d\'aide ne se réécrit plus', !ok(after), after.text.slice(0, 200));
check('structure fermée : un éditeur n\'ajoute plus de colonne', !ok(await into(editor, [['AddColumn', 'People', 'Pirate', { type: 'Text' }]])));
check('structure fermée : Dan modifie toujours les fiches qu\'on lui a ouvertes', ok(await attempt(editor, at('Ana'), { Note: 'toujours' })));

// ---------- 3. le document bouge, le réglage change ----------
say('--- 3. une personne change de structure : les droits suivent aussitôt ---');
check('avant : Dan ne modifie pas Eve (autre direction)', !ok(await attempt(editor, at('Eve'), { Note: 'non' })));
await attempt(owner, at('Eve'), { Structure: 1, Service: 'Paie' });
check('après : Eve est dans la structure de Dan, il la modifie', ok(await attempt(editor, at('Eve'), { Note: 'oui' })));
await attempt(owner, at('Eve'), { Structure: 2, Service: 'Recrutement' });
check('Eve repart : Dan ne la modifie plus', !ok(await attempt(editor, at('Eve'), { Note: 'non' })));
await attempt(owner, at('Dan'), { Role: true });
check('Dan reçoit le rôle désigné : il modifie Eve', ok(await attempt(editor, at('Eve'), { Note: 'rôle' })));
await attempt(owner, at('Dan'), { Role: false });
check('le rôle retiré, il ne la modifie plus', !ok(await attempt(editor, at('Eve'), { Note: 'non' })));

say('--- le réglage change : mise à jour des règles, sans reste ---');
const own = { self: true, level: 'own', role: '' };
state = await existing();
spec = await specOf(own, state);
check('l\'état dit « posé, mais plus à jour »', lockState(state, spec, say_) === 'stale', lockState(state, spec, say_));
plan = planLock(state, spec, say_);
check('le plan retire les règles de GFS d\'avant puis pose les nouvelles', plan.ok && plan.replaces && plan.actions[0][0] === 'BulkRemoveRecord', plan.reason);
check('Grist accepte', ok(await into(owner, [...plan.columns, ...plan.actions])));
state = await existing();
check('GFS relit : « posé, à jour »', lockState(state, spec, say_) === 'current', lockState(state, spec, say_));
const mine = state.rules.filter(rule => isLockNote(rule.memo));
const resources = new Set(state.resources.filter(resource => resource.tableId === 'People').map(resource => resource.id));
check('aucune règle d\'avant ne reste (colonnes protégées : Email, Structure, Service ; présence ; table : huit règles)', mine.length === 8 && [...resources].every(id => state.rules.some(rule => rule.resource === id)),
  mine.map(rule => rule.permissionsText));
const rows2 = await tableRows();
const want2 = expected(own, rows2, state.schema);
const got2 = Object.fromEntries(rows2.People.map(row => [row.id, listOf(row.GFS_Editors).slice().sort()]));
check('GFS_Editors suit le nouveau réglage', Object.keys(want2).every(id => JSON.stringify(want2[id]) === JSON.stringify(got2[id])), Object.keys(want2).filter(id => JSON.stringify(want2[id]) !== JSON.stringify(got2[id])));
check('Dan ne modifie plus Ana (« sa structure » sans « en dessous » : seulement la sienne)', !ok(await attempt(editor, at('Ana'), { Note: 'non' })));
check('Dan modifie toujours sa fiche', ok(await attempt(editor, at('Dan'), { Note: 'sa fiche' })));
check('Ivy n\'a plus le rôle désigné : elle ne modifie plus Eve', !ok(await attempt(designated, at('Eve'), { Note: 'non' })));
check('Ivy modifie sa propre fiche', ok(await attempt(designated, at('Ivy'), { Note: 'sa fiche' })));

// ---------- 4. un autre auteur, puis le retrait ----------
say('--- 4. une règle d\'un autre auteur sur la table ---');
state = await existing();
const top = Math.max(...state.resources.map(resource => resource.id)) + 1, topRule = Math.max(...state.rules.map(rule => rule.id)) + 1;
const hand = await into(owner, [['AddRecord', '_grist_ACLResources', top, { tableId: 'People', colIds: 'Note' }], ['AddRecord', '_grist_ACLRules', topRule,
  { resource: top, aclFormula: 'user.Access == EDITOR', permissionsText: '-R', rulePos: 1, memo: 'à la main' }]]);
check('une règle écrite à la main est posée sur la même table', ok(hand), hand.text);
state = await existing();
check('GFS le voit : « règles d\'un autre auteur » (il n\'y touche pas)', lockState(state, spec, say_) === 'foreign' && planLock(state, spec, say_).reason === 'foreign', lockState(state, spec, say_));
check('le retrait retire les siennes seulement', planUnlock(state, 'People').ok && !planUnlock(state, 'People').actions.flat(2).includes(topRule));
const gone = await into(owner, planUnlock(state, 'People').actions);
check('Grist accepte le retrait (règles, ressources, colonnes d\'aide, en une écriture)', ok(gone), gone.text);
state = await existing();
check('il ne reste de GFS aucune règle ni colonne d\'aide ; la règle à la main est intacte', !state.rules.some(rule => isLockNote(rule.memo)) &&
  state.rules.some(rule => rule.id === topRule) && !state.columns.some(column => /^GFS_(Node|Editors)$/.test(column.colId)),
  { rules: state.rules.map(rule => rule.memo), columns: state.columns.map(column => column.colId).filter(name => /^GFS_/.test(name)) });
await into(owner, [['BulkRemoveRecord', '_grist_ACLRules', [topRule]], ['BulkRemoveRecord', '_grist_ACLResources', [top]]]);
check('sans verrou, Dan écrit de nouveau où Grist le laisse faire (Eve, hors de sa structure)', ok(await attempt(editor, at('Eve'), { Note: 'libre' })));
check('et plus rien n\'est « GFS : Annuaire » dans le document', !(await existing()).rules.some(rule => isLockNote(rule.memo)));

// ---------- 5. un annuaire chargé (LOAD=3000) ----------
if (Number(process.env.LOAD)) {
  const n = Number(process.env.LOAD);
  say(`--- 5. ${n} personnes : ce que le verrou coûte à Grist ---`);
  const clock = async (label, work) => { const start = Date.now(); const answer = await work(); say('CONSTAT', label, `${Date.now() - start} ms`); return answer; };
  const ids = Array.from({ length: n }, (_, i) => 100 + i);
  const lines = i => ({ Name: `P${i}`, Email: `p${i}@exemple.fr`, Structure: (i % 3) + 1, Service: `S${i % 40}`, Role: false, Visible: true });
  const many = { Name: [], Email: [], Structure: [], Service: [], Role: [], Visible: [] };
  ids.forEach((_, i) => { const line = lines(i); for (const key of Object.keys(many)) many[key].push(line[key]); });
  await clock(`ajouter ${n} fiches SANS verrou`, () => into(owner, [['BulkAddRecord', 'People', ids, many]]));
  state = await existing();
  spec = await specOf(EDIT, state);
  await clock('poser les colonnes d\'aide (calcul des formules sur toute la table)', () => into(owner, planLock(state, spec, say_).columns));
  state = await existing();
  plan = planLock(state, spec, say_);
  await clock('poser les règles', () => into(owner, plan.actions));
  const mover = at('Dan');
  await clock('un propriétaire change la structure d\'une personne (les formules se recalculent)', () => attempt(owner, mover, { Service: 'S3' }));
  await clock('Dan modifie une fiche de sa structure', () => attempt(editor, at('Ana'), { Note: 'charge' }));
  const more = { ...many, Name: many.Name.slice(0, 200), Email: many.Email.slice(0, 200).map(mail => `x${mail}`), Structure: many.Structure.slice(0, 200), Service: many.Service.slice(0, 200),
    Role: many.Role.slice(0, 200), Visible: many.Visible.slice(0, 200) };
  await clock('ajouter 200 fiches AVEC le verrou', () => into(owner, [['BulkAddRecord', 'People', Array.from({ length: 200 }, (_, i) => 5000 + i), more]]));
  state = await existing();
  await clock('retirer le verrou (règles et colonnes d\'aide)', () => into(owner, planUnlock(state, 'People').actions));
}
say(process.exitCode ? 'ÉCHEC : voir les lignes ci-dessus' : 'TOUT PASSE');
