// Le numéro de structure du document (contrats 6.4, point 16) : GFS le note après un geste qui écrit dans `GFS_Rangement`, et une version plus ancienne que lui
// lit le document sans y écrire. Le port est le faux Grist en mémoire (fake-grist.mjs) ; ce que Grist rend vraiment (la ligne réservée relue, la règle d'accès
// qui ne laisse écrire les lignes `@document` qu'aux propriétaires) se mesure dans le labo (labo/run-structure.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rangement, TABLE, RESERVED, DocumentNewer } from '../js/files/rangement.js';
import { STRUCTURE, STRUCTURE_ROW, isNewer, stamped, structureFrom, verdictOf } from '../js/files/structure.js';
import { AppsState } from '../js/apps/apps-state.js';
import { STRING_TABLES } from '../js/i18n/i18n.js';
import { fakeGrist } from './fake-grist.mjs';

const full = ['id', 'Utilisateur', 'App', 'Fichier', 'Favori', 'Dossier', 'Replie', 'Valeur', 'Adresse'];
const row = (id, extra) => ({ id, Utilisateur: '', App: '', Fichier: '', Favori: false, Dossier: '', Replie: false, Valeur: '', Adresse: '', ...extra });
const marked = value => row(9, { ...STRUCTURE_ROW, Valeur: typeof value === 'string' ? value : JSON.stringify(value) });
const accept = () => async () => true;
const noProbe = { canWrite: () => false };
const isMark = action => Boolean(action[3]) && action[3].Fichier === 'structure';
const gesture = () => ({ app: 'x', file: '1', pinned: true, folder: '' });

test('le numéro lu : un entier de 1 ou plus, sinon rien ; ce qu\'il dit de cette version', () => {
  assert.equal(STRUCTURE, 1);
  assert.equal(structureFrom({ structure: 3 }), 3);
  for (const bad of [null, undefined, {}, [], 'x', { structure: 0 }, { structure: -1 }, { structure: 1.5 }, { structure: '2' }, [{ structure: 2 }]]) {
    assert.equal(structureFrom(bad), null, JSON.stringify(bad));
  }
  assert.deepEqual([null, undefined, STRUCTURE + 1, STRUCTURE].map(verdictOf), ['unmarked', 'unmarked', 'newer', 'current']);
  assert.deepEqual([isNewer(STRUCTURE + 1), isNewer(STRUCTURE), isNewer(null)], [true, false, false]);
  assert.deepEqual(stamped({ autre: { a: 1 }, structure: 0 }), { autre: { a: 1 }, structure: STRUCTURE }, 'ce qu\'une version plus récente a ajouté se garde');
  assert.deepEqual([stamped(null), stamped([1])], [{ structure: STRUCTURE }, { structure: STRUCTURE }]);
});

test('le premier geste qui écrit note le numéro, dans un lot à part, après le geste ; rien d\'autre ne s\'écrit de plus', async () => {
  const { port, tables, actions, batches } = fakeGrist();
  await new Rangement({ port, consent: accept(), ...noProbe }).update(() => ({ publipostage: { extensions: [] } }));
  assert.deepEqual(actions.map(action => action[0]), ['AddTable', 'AddRecord', 'AddRecord']);
  assert.deepEqual(actions[2].slice(1), [TABLE, null, { ...STRUCTURE_ROW, Valeur: '{"structure":1}' }]);
  assert.equal(batches.at(-1).length, 1, 'le lot du geste est parti avant : un refus de la note ne le défait pas');
  assert.deepEqual(tables[TABLE].rows.map(line => [line.Utilisateur, line.App, line.Fichier]), [['@document', 'gfs', 'apps'], ['@document', 'gfs', 'structure']]);
});

test('le numéro est noté aussi par un rangement de fichier (setFiling), une seule fois par ouverture et plus du tout quand il est déjà là', async () => {
  const first = fakeGrist({ [TABLE]: { columns: full, rows: [row(1, { ...RESERVED, Valeur: '{}' })] } });
  const store = new Rangement({ port: first.port, consent: accept(), ...noProbe });
  await store.setFiling([gesture()]);
  await store.setFiling([{ ...gesture(), pinned: false }]);
  assert.equal(first.actions.filter(isMark).length, 1, 'une note, pas une par geste');
  const current = fakeGrist({ [TABLE]: { columns: full, rows: [marked({ structure: STRUCTURE })] } });
  await new Rangement({ port: current.port, consent: accept(), ...noProbe }).setFiling([gesture()]);
  assert.equal(current.actions.filter(isMark).length, 0, 'un document qui porte déjà ce numéro n\'écrit rien de plus');
  assert.equal(current.actions.length, 1);
});

test('une ligne du numéro sans le numéro est complétée en gardant le reste ; une valeur illisible n\'est pas touchée et le geste part quand même', async () => {
  const partial = fakeGrist({ [TABLE]: { columns: full, rows: [marked({ autre: 'gardé' })] } });
  await new Rangement({ port: partial.port, consent: accept(), ...noProbe }).setFiling([gesture()]);
  assert.deepEqual(partial.actions.at(-1), ['UpdateRecord', TABLE, 9, { Valeur: '{"autre":"gardé","structure":1}' }]);
  const broken = fakeGrist({ [TABLE]: { columns: full, rows: [marked('{pas du json')] } });
  assert.equal(await new Rangement({ port: broken.port, consent: accept(), ...noProbe }).setFiling([gesture()]), true);
  assert.equal(broken.tables[TABLE].rows[0].Valeur, '{pas du json');
  assert.equal(broken.actions.length, 1, 'le geste seul');
});

test('Grist refuse la note (une personne qui n\'est pas propriétaire) : le geste a réussi, GFS le dit en avertissement et n\'insiste pas', async () => {
  const warn = console.warn;
  const warned = [];
  console.warn = (...args) => warned.push(args);
  try {
    const { port, tables } = fakeGrist({ [TABLE]: { columns: full, rows: [] } });
    const apply = port.doc.applyUserActions;
    port.doc.applyUserActions = list => (list.some(isMark) ? Promise.reject(new Error('Blocked by table access rules')) : apply(list));
    const store = new Rangement({ port, consent: accept(), ...noProbe });
    assert.equal(await store.setFiling([gesture()]), true);
    assert.equal(await store.setFiling([{ ...gesture(), pinned: false }]), true);
    assert.equal(tables[TABLE].rows.length, 1, 'le fichier est rangé, la note est absente');
    assert.equal(warned.length, 1, 'une seule tentative');
  } finally { console.warn = warn; }
});

test('un document qu\'une version plus récente a préparé : la lecture dit son numéro, aucune écriture de GFS ne part', async () => {
  const tables = { [TABLE]: { columns: full, rows: [row(1, { ...RESERVED, Valeur: '{"form":{"extensions":[]}}' }), marked({ structure: STRUCTURE + 1 })] } };
  const { port, actions } = fakeGrist(tables);
  const store = new Rangement({ port, consent: () => assert.fail('aucune question'), ...noProbe });
  const state = await store.read();
  assert.deepEqual([state.structure, state.rowId, state.raw], [STRUCTURE + 1, 1, { form: { extensions: [] } }]);
  await assert.rejects(store.update(raw => raw), error => error instanceof DocumentNewer && error.code === 'GFS_DOCUMENT_PLUS_RECENT' && error.structure === STRUCTURE + 1);
  await assert.rejects(store.setFiling([gesture()]), DocumentNewer);
  assert.equal(await store.setFiling([gesture()], { quiet: true }), false);
  assert.equal(await store.follow('lien', 'A', ['1']), false);
  assert.equal(await store.unfollow('lien', 'A'), 0);
  assert.deepEqual(actions, [], 'ni geste, ni note, ni colonne ajoutée');
});

test('lire un document sans table, ou sans le numéro, ne dit rien et n\'écrit rien', async () => {
  const none = await new Rangement({ port: fakeGrist().port, consent: accept() }).read();
  assert.equal(none.structure, null);
  const { port, actions } = fakeGrist({ [TABLE]: { columns: full, rows: [row(1, { ...RESERVED, Valeur: '{}' })] } });
  assert.equal((await new Rangement({ port, consent: accept() }).read()).structure, null);
  assert.deepEqual(actions, []);
});

test('les apps retiennent le numéro lu avec leur ligne : le contrôleur y lit si le document est plus récent', async () => {
  const reading = result => new AppsState({ store: { read: async () => { if (result instanceof Error) throw result; return result; } }, onChange: () => {} });
  const newer = reading({ raw: null, structure: STRUCTURE + 1 });
  await newer.load();
  assert.equal(isNewer(newer.structure), true);
  const plain = reading({ raw: null });
  await plain.load();
  assert.equal(plain.structure, null, 'une table qui ne dit rien');
  const warn = console.warn;
  console.warn = () => {};
  try {
    const failing = reading(new Error('illisible'));
    failing.structure = STRUCTURE + 1;
    await failing.load();
    assert.equal(failing.structure, null, 'une table illisible vaut une table absente');
  } finally { console.warn = warn; }
});

test('la phrase « document plus récent » existe en français et en anglais et dit où mettre l\'adresse', () => {
  const { fr: FR, en: EN } = STRING_TABLES;
  assert.ok(FR['doc.newer'] && EN['doc.newer']);
  assert.match(FR['doc.newer'], /plus récente/);
  assert.match(FR['doc.newer'], /panneau de droite/);
  assert.match(EN['doc.newer'], /right panel/);
});
