// Les notifications de GFS (js/sharing/notice-model.js et notice-store.js ; étude du 25/11, choix du porteur : la cloche annonce « ce qu'on me partage », « lu » dans
// une table du document). Le calcul de ce qui est donné, les règles de la table, et le magasin avec un document de doublure ; ce que Grist accepte vraiment des
// règles (un éditeur n'écrit que ses lignes, seule « Lu » change) se mesure dans un vrai Grist (banc `n9-notifications-gfs.mjs` des fichiers du projet, faits vérifiés 179).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOTICES_TABLE, noticeColumns, noticeRules, noticeFixedRules, noticeReadRules, givenToMe, noticeRows, planNotices, sharesToMe } from '../js/sharing/notice-model.js';
import { NoticeStore, loadNoticeSources } from '../js/sharing/notice-store.js';

const share = (over = {}) => ({ id: 1, Cible: 'espace:fin', Personne: 'Moi@Exemple.org', PersonneL: 'moi@exemple.org', Droit: 'lecture', Auteur: 'chef@exemple.org', Actif: true, ...over });
const space = { spaces: [{ key: 'fin', name: 'Finances', path: 'Espaces/Finances' }, { key: 'rh', name: 'RH', path: 'Espaces/RH' }], placed: new Map(), folders: [], links: [] };

test('la table : sept colonnes, la date posée par Grist ; ses règles disent qui écrit, qui lit, ce qui ne change jamais', () => {
  const columns = noticeColumns();
  assert.deepEqual(columns.map(column => column.id), ['Pour', 'Type', 'Cible', 'Par', 'Cle', 'Quand', 'Lu']);
  const when = columns.find(column => column.id === 'Quand');
  assert.deepEqual([when.isFormula, when.formula, when.recalcWhen], [false, 'NOW()', 0], 'une formule déclenchée à la création : GFS ne choisit pas l\'heure');
  const rules = noticeRules();
  assert.deepEqual(rules.map(rule => rule.rights), ['+CRUD', '+C', '+RD', '-CRUD']);
  assert.match(rules[1].formula, /user\.Access in \[EDITOR\]/);
  assert.match(rules[1].formula, /newRec\.Pour\.lower\(\) == user\.Email\.lower\(\)/, 'un éditeur n\'écrit que les siennes');
  assert.match(rules[2].formula, /rec\.Pour\.lower\(\) == user\.Email\.lower\(\)/, 'chacun lit les siennes');
  assert.equal(rules[3].formula, '', 'le reste est refusé');
  assert.deepEqual(noticeReadRules().map(rule => rule.rights), ['+U']);
  assert.deepEqual(noticeFixedRules().map(rule => rule.rights), ['-U']);
  assert.ok([...rules, ...noticeReadRules(), ...noticeFixedRules()].every(rule => !/\bnow\b|NOW|TODAY|lookup/.test(rule.formula)), 'une règle ne lit que `rec` et `newRec`');
});

test('ce qui est donné : les fichiers donnés par adresse, jamais ceux de la corbeille ni sans adresse de personne', () => {
  const files = [{ key: 'pp:1', name: 'Convocation', direct: { by: 'Chef@Exemple.org' } }, { key: 'pp:2', name: 'Autre' }, { key: 'pp:3', name: 'Vieux', direct: { by: 'x@y.fr' }, trashed: true }];
  assert.deepEqual(givenToMe({ files, identity: 'moi@exemple.org' }), [{ cle: 'fichier|pp:1', type: 'fichier', cible: 'pp:1', nom: 'Convocation', par: 'chef@exemple.org' }]);
  assert.deepEqual(givenToMe({ files, identity: '' }), [], 'sans adresse, GFS ne sait pas pour qui annoncer');
});

test('les espaces : un éditeur est prévenu de tout espace qu\'il lit ; un propriétaire, seulement de ceux qu\'on lui a donnés par son adresse', () => {
  const given = givenToMe({ spaces: space, shares: [share()], identity: 'moi@exemple.org', owner: false });
  assert.deepEqual(given.map(item => [item.cle, item.nom, item.par]), [['espace|fin', 'Finances', 'chef@exemple.org'], ['espace|rh', 'RH', '']], 'RH vient d\'un groupe : sans nom de qui l\'a ouvert');
  const owner = givenToMe({ spaces: space, shares: [share()], identity: 'moi@exemple.org', owner: true });
  assert.deepEqual(owner.map(item => item.cle), ['espace|fin'], 'un propriétaire voit tous les espaces : il n\'est pas prévenu de ceux qu\'il a faits');
});

test('les partages qui ne comptent pas : les siens, un retrait, une fin dépassée, un groupe, une autre personne', () => {
  const rows = [share({ Auteur: 'moi@exemple.org' }), share({ Droit: 'aucun' }), share({ Actif: false }), share({ Personne: '#compta', PersonneL: '#compta' }),
    share({ Personne: 'autre@exemple.org', PersonneL: 'autre@exemple.org' }), share({ PersonneL: '@tous', Personne: '@tous' })];
  assert.deepEqual(sharesToMe(rows, 'moi@exemple.org').map(row => row.PersonneL), ['@tous']);
});

test('les dossiers donnés par adresse : leur nom est le dernier du chemin', () => {
  const rows = [share({ Cible: 'dossier:moi:chef@exemple.org/Formation/2025' }), share({ Cible: 'gfs-fichiers:4' }), share({ Cible: '*' })];
  assert.deepEqual(givenToMe({ shares: rows, identity: 'moi@exemple.org' }).map(item => [item.type, item.nom, item.par]), [['dossier', '2025', 'chef@exemple.org']]);
});

test('les lignes de la table : seulement celles de la personne ; deux lignes de la même clé n\'en font qu\'une, lue si l\'une l\'est', () => {
  const data = { id: [1, 2, 3, 4], Pour: ['moi@exemple.org', 'autre@exemple.org', 'MOI@exemple.org', 'moi@exemple.org'], Cle: ['espace|fin', 'espace|fin', 'espace|fin', ''],
    Type: ['espace', 'espace', 'espace', ''], Cible: ['fin', 'fin', 'fin', ''], Par: ['Chef@Exemple.org', '', '', ''], Quand: [1700000000, 1700000001, 1700000002, 0], Lu: [false, true, true, false] };
  assert.deepEqual(noticeRows(data, 'moi@exemple.org'), [{ id: 1, cle: 'espace|fin', type: 'espace', cible: 'fin', par: 'chef@exemple.org', quand: 1700000000, lu: true }]);
  assert.deepEqual(noticeRows(null, 'moi@exemple.org'), []);
});

test('le plan : les lignes qui manquent, jamais deux fois ; un lecteur n\'écrit rien ; le navigateur dit ce qui est lu ; les non lues passent devant', () => {
  const given = [{ cle: 'a', type: 'fichier', cible: 'pp:1', nom: 'A', par: 'x@y.fr' }, { cle: 'b', type: 'espace', cible: 'b', nom: 'B', par: '' }, { cle: 'c', type: 'fichier', cible: 'pp:3', nom: 'C', par: '' }];
  const rows = [{ id: 7, cle: 'a', quand: 100, lu: true }, { id: 8, cle: 'c', quand: 200, lu: false }];
  const plan = planNotices({ given, rows, read: [], identity: 'Moi@Exemple.org' });
  assert.deepEqual(plan.add, [{ Pour: 'moi@exemple.org', Type: 'espace', Cible: 'b', Par: '', Cle: 'b' }]);
  assert.deepEqual(plan.items.map(item => [item.cle, item.lu]), [['b', false], ['c', false], ['a', true]], 'la non écrite est la plus récente, puis les non lues, puis les lues');
  assert.equal(plan.unread, 2);
  assert.deepEqual(planNotices({ given, rows, read: [], identity: 'moi@exemple.org', write: false }).add, [], 'un lecteur n\'écrit rien');
  const known = planNotices({ given, rows, read: ['b', 'c'], identity: 'moi@exemple.org', write: false });
  assert.equal(known.unread, 0, 'le navigateur sait « lu » de ce que la table ne sait pas');
});

// Un document de doublure : une table de notifications, ce qu'on lui écrit.
function bench({ canWrite = true, table = true, refuse = false, storage = true } = {}) {
  const data = table ? { id: [], Pour: [], Type: [], Cible: [], Par: [], Cle: [], Quand: [], Lu: [] } : null;
  const calls = [];
  const kept = { value: null };
  const doc = {
    fetchTable: async name => { calls.push(['fetch', name]); return structuredClone(data); },
    applyUserActions: async actions => {
      calls.push(['write', actions]);
      if (refuse) throw new Error('refusé par Grist');
      const [kind, , ids, cols] = actions[0];
      if (kind === 'BulkAddRecord') ids.forEach((_, at) => { data.id.push(data.id.length + 1); for (const name of Object.keys(data)) if (name !== 'id') data[name].push(name === 'Quand' ? 1700000000 + at : name === 'Lu' ? false : cols[name][at]); });
      if (kind === 'BulkUpdateRecord') ids.forEach(id => { data.Lu[data.id.indexOf(id)] = true; });
    },
  };
  const states = [];
  const store = new NoticeStore({ doc, identity: () => 'moi@exemple.org', canWrite: () => canWrite, owner: async () => false,
    storage: async () => (storage ? { read: () => kept.value, write: value => { kept.value = value; } } : null), onChange: state => states.push(state) });
  const input = () => ({ files: [{ key: 'pp:1', name: 'Convocation', direct: { by: 'chef@exemple.org' } }], spaces: space, sources: { shares: [share()], data: structuredClone(data), table: table ? NOTICES_TABLE : null } });
  return { store, calls, data, kept, states, input };
}

test('le magasin : la première lecture écrit ses lignes d\'un seul lot, la seconde n\'écrit rien, la cloche dit ce qu\'il y a de nouveau', async () => {
  const b = bench();
  assert.equal(await b.store.update(b.input()), 3);
  const writes = b.calls.filter(call => call[0] === 'write');
  assert.equal(writes.length, 1);
  assert.equal(writes[0][1][0][0], 'BulkAddRecord');
  assert.deepEqual(writes[0][1][0][3].Pour, ['moi@exemple.org', 'moi@exemple.org', 'moi@exemple.org'], 'chaque ligne est à son nom, jamais à celui d\'un autre');
  assert.equal(b.store.state.items.length, 3);
  assert.ok(b.store.state.items.every(item => item.row !== null && item.quand > 0), 'la date vient de Grist');
  await b.store.update(b.input());
  assert.equal(b.calls.filter(call => call[0] === 'write').length, 1, 'rien n\'est écrit deux fois');
});

test('marquer lu : « Lu » s\'écrit sur les lignes de la table, et reste lu à la lecture suivante', async () => {
  const b = bench();
  await b.store.update(b.input());
  assert.equal(await b.store.markRead(['fichier|pp:1']), 1);
  const update = b.calls.filter(call => call[0] === 'write').pop()[1][0];
  assert.deepEqual([update[0], update[1], update[3]], ['BulkUpdateRecord', NOTICES_TABLE, { Lu: [true] }]);
  assert.equal(b.store.state.unread, 2);
  await b.store.update(b.input());
  assert.equal(b.store.state.unread, 2, 'la lecture suivante le sait : « lu » vient de la table');
  assert.equal(await b.store.markRead(), 2, 'tout marquer comme lu');
  assert.equal(b.store.state.unread, 0);
  assert.equal(b.kept.value, null, 'rien dans le navigateur quand la table a tout gardé');
});

test('un lecteur du document n\'écrit rien : « lu » reste dans son navigateur, et y est encore à la lecture suivante', async () => {
  const b = bench({ canWrite: false });
  await b.store.update(b.input());
  assert.equal(b.calls.filter(call => call[0] === 'write').length, 0);
  assert.equal(b.store.state.unread, 3);
  await b.store.markRead(['espace|rh']);
  assert.deepEqual(JSON.parse(b.kept.value), ['espace|rh']);
  await b.store.update(b.input());
  assert.equal(b.store.state.unread, 2);
});

test('sans table (le partage ne l\'a pas encore créée) : tout se garde dans le navigateur, et GFS ne crée rien', async () => {
  const b = bench({ table: false });
  await b.store.update(b.input());
  assert.equal(b.calls.length, 0, 'aucune lecture ni écriture de la table');
  assert.equal(b.store.state.unread, 3);
  await b.store.markRead();
  assert.equal(b.store.state.unread, 0);
  assert.equal(JSON.parse(b.kept.value).length, 3);
});

test('un refus de Grist : un avertissement, plus d\'essai de cette session, « lu » reste dans le navigateur', async () => {
  const b = bench({ refuse: true });
  const warn = console.warn;
  const seen = [];
  console.warn = (...args) => seen.push(args[0]);
  try {
    await b.store.update(b.input());
    await b.store.update(b.input());
    await b.store.markRead();
  } finally { console.warn = warn; }
  assert.equal(b.calls.filter(call => call[0] === 'write').length, 1, 'un seul essai d\'écriture');
  assert.equal(b.store.state.unread, 0);
  assert.equal(JSON.parse(b.kept.value).length, 3);
  assert.ok(seen.length >= 1);
});

test('sans stockage du navigateur : tout marche, la notification redevient non lue au rechargement', async () => {
  const b = bench({ canWrite: false, storage: false });
  await b.store.update(b.input());
  await b.store.markRead();
  assert.equal(b.store.state.unread, 3, 'rien ne se retient : c\'est dit par le code, pas par une exception');
});

test('les sources : les partages lisibles et la table, ou rien quand elles manquent ou se refusent', async () => {
  const doc = { fetchTable: async name => { if (name === 'GFS_Partages') return { id: [1], Cible: ['espace:fin'], PersonneL: ['moi@exemple.org'], Auteur: ['c@x.fr'] }; throw new Error('refusé'); } };
  const sources = await loadNoticeSources(doc, ['GFS_Partages', 'gfs_notifications']);
  assert.equal(sources.shares.length, 1);
  assert.deepEqual([sources.data, sources.table], [null, null], 'une table illisible n\'arrête rien');
  assert.deepEqual(await loadNoticeSources(doc, null), { shares: [], data: null, table: null });
});
