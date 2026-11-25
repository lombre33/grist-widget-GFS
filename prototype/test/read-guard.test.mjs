// Le garde-fou des lectures complètes (js/explorer/read-guard.js) : une table dont la lecture entière ne finit jamais (Grist coupe la connexion et reconstruit le cadre de GFS, faits vérifiés 161 et 166)
// n'est pas redemandée sans fin. Un « onglet » de doublure garde les notes d'une page à la suivante, comme `sessionStorage` ; ce que Grist fait vraiment se mesure au labo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReadGuard, ReadHeldError, holdOf, GUARD_PREFIX, LIMIT, FRESH_MS, HOLD_MS, MAX_HOLD_MS } from '../js/explorer/read-guard.js';
import { loadFiles } from '../js/explorer/explorer-data.js';
import { keyStore } from '../js/shell/stored-choice.js';
import { publipostage } from './helpers.mjs';

const DOC = 'AbC123xyz';
const keyOf = table => `${GUARD_PREFIX}${DOC}.${table}`;

// Un onglet : ce que `sessionStorage` garde, l'heure, et des pages qui s'y suivent. `refuse` : un navigateur qui ne garde rien.
function tab({ values = {}, refuse = false } = {}) {
  const clock = { now: 1_000_000 };
  const win = { sessionStorage: {
    getItem: key => { if (refuse) throw new Error('stockage refusé'); return key in values ? values[key] : null; },
    setItem: (key, value) => { if (refuse) throw new Error('stockage refusé'); values[key] = value; },
    removeItem: key => { if (refuse) throw new Error('stockage refusé'); delete values[key]; },
  } };
  const page = (docId = async () => DOC) => createReadGuard({ docId, store: key => keyStore(win, key, 'sessionStorage'), now: () => clock.now });
  return { values, clock, page };
}
// Une lecture qui ne finit jamais : la page meurt avant (Grist a coupé, ou la personne a rechargé).
const never = () => new Promise(() => {});
const settle = () => new Promise(resolve => setImmediate(resolve));
// La page meurt pendant la lecture entière de `tables` : rien ne revient.
async function dies(t, tables, seconds = 9) {
  const guard = t.page();
  for (const table of tables) void guard.run(table, never).catch(() => {});
  await settle();
  t.clock.now += seconds * 1000;
}

test('une lecture qui rend ne laisse rien : la note est posée avant, effacée après, que Grist réponde ou refuse', async () => {
  const t = tab();
  const guard = t.page();
  let during = null;
  assert.deepEqual(await guard.run('Publipostage_Modeles', async () => { during = t.values[keyOf('Publipostage_Modeles')]; return { id: [1] }; }), { id: [1] });
  assert.equal(during, `1:${t.clock.now}`, 'pendant la lecture, la note dit « une lecture en vol »');
  assert.deepEqual(t.values, {});
  await assert.rejects(guard.run('Publipostage_Modeles', async () => { throw new Error('accès refusé'); }), /accès refusé/);
  assert.deepEqual(t.values, {}, 'un refus de Grist est une fin : le cadre a tenu');
});

test(`la boucle s'arrête : après ${LIMIT} lectures de suite que la page n'a pas vues finir, la table n'est plus relancée, et les autres se lisent`, async () => {
  const t = tab();
  for (let start = 1; start <= LIMIT; start += 1) {
    const guard = t.page();
    const asked = [];
    void guard.run('Publipostage_Modeles', () => { asked.push('Publipostage_Modeles'); return never(); }).catch(() => {});
    await settle();
    assert.deepEqual(asked, ['Publipostage_Modeles'], `au démarrage ${start}, la table est encore demandée`);
    assert.equal(t.values[keyOf('Publipostage_Modeles')].split(':')[0], String(start));
    t.clock.now += 9000;
  }
  const guard = t.page();
  let asked = 0;
  await assert.rejects(guard.run('Publipostage_Modeles', async () => { asked += 1; }), error => error instanceof ReadHeldError && error.held === true && error.count === LIMIT);
  assert.equal(asked, 0, 'la table retenue n\'est pas demandée à Grist');
  assert.deepEqual(await guard.run('GFS_Fichiers', async () => 'lue'), 'lue', 'une autre table se lit');
  await assert.rejects(guard.run('Publipostage_Modeles', async () => { asked += 1; }), ReadHeldError, 'ni à la lecture suivante de la même page');
  assert.equal(asked, 0);
});

test('plusieurs tables étaient en vol quand Grist a coupé : au démarrage suivant elles se lisent une à une, celle qui coupe se désigne et les autres sont blanchies', async () => {
  const t = tab();
  await dies(t, ['Publipostage_Modeles', 'Publipostage_PreferencesModeles', 'GFS_Fichiers']);
  assert.deepEqual(Object.keys(t.values).sort(), [keyOf('GFS_Fichiers'), keyOf('Publipostage_Modeles'), keyOf('Publipostage_PreferencesModeles')].sort());
  // démarrage 2 : une table innocente d'abord (elle finit), puis celle qui coupe ; la troisième attend son tour et n'est jamais lancée
  const second = t.page();
  const order = [];
  let release;
  const first = second.run('Publipostage_PreferencesModeles', () => { order.push('préférences'); return new Promise(resolve => { release = resolve; }); });
  void second.run('Publipostage_Modeles', () => { order.push('modèles'); return never(); }).catch(() => {});
  void second.run('GFS_Fichiers', () => { order.push('fichiers'); return never(); }).catch(() => {});
  const fresh = second.run('GFS_Filing', async () => { order.push('rangement'); return 'lue'; });
  await settle();
  assert.deepEqual([...order].sort(), ['préférences', 'rangement'], 'une seule table suspecte en vol ; une table sans note n\'attend personne');
  assert.equal(await fresh, 'lue');
  release('lue');
  assert.equal(await first, 'lue');
  await settle();
  assert.deepEqual([...order].sort(), ['modèles', 'préférences', 'rangement'], 'la suivante part quand la première a rendu ; la troisième attend encore');
  assert.equal(t.values[keyOf('Publipostage_PreferencesModeles')], undefined, 'la table qui a rendu est blanchie');
  assert.equal(t.values[keyOf('Publipostage_Modeles')].split(':')[0], '2');
  assert.equal(t.values[keyOf('GFS_Fichiers')].split(':')[0], '1', 'une table qui n\'a pas été lancée ne compte pas une lecture de plus');
  t.clock.now += 9000;
  await dies(t, ['Publipostage_Modeles']); // démarrage 3 : elle coupe encore
  const fourth = t.page();
  await assert.rejects(fourth.run('Publipostage_Modeles', async () => 'lue'), ReadHeldError);
  assert.equal(await fourth.run('GFS_Fichiers', async () => 'lue'), 'lue', 'la table qui attendait se lit enfin, seule');
  assert.deepEqual(Object.keys(t.values), [keyOf('Publipostage_Modeles')]);
});

test('une table retenue est réessayée après un délai, seule ; le délai double à chaque nouvel échec, jusqu\'à une demi-heure', async () => {
  assert.deepEqual([LIMIT, LIMIT + 1, LIMIT + 2, LIMIT + 3, LIMIT + 4, LIMIT + 9].map(count => holdOf(count)), [HOLD_MS, 2 * HOLD_MS, 4 * HOLD_MS, 8 * HOLD_MS, MAX_HOLD_MS, MAX_HOLD_MS]);
  const t = tab();
  for (let start = 1; start <= LIMIT; start += 1) await dies(t, ['Publipostage_Modeles']);
  const guard = t.page();
  await assert.rejects(guard.run('Publipostage_Modeles', async () => 'lue'), ReadHeldError);
  t.clock.now += HOLD_MS;
  let asked = 0;
  void guard.run('Publipostage_Modeles', () => { asked += 1; return never(); }).catch(() => {});
  await settle();
  assert.equal(asked, 1, 'le délai passé, la même page la redemande');
  assert.equal(t.values[keyOf('Publipostage_Modeles')].split(':')[0], String(LIMIT + 1));
  t.clock.now += 9000; // elle coupe encore : la page suivante la retient tout de suite, deux fois plus longtemps
  const next = t.page();
  await assert.rejects(next.run('Publipostage_Modeles', async () => 'lue'), error => error.count === LIMIT + 1);
  t.clock.now += HOLD_MS;
  await assert.rejects(next.run('Publipostage_Modeles', async () => 'lue'), ReadHeldError, 'deux minutes ne suffisent plus');
  t.clock.now += HOLD_MS;
  assert.equal(await next.run('Publipostage_Modeles', async () => 'lue'), 'lue', 'une lecture qui rend remet tout à zéro');
  assert.deepEqual(t.values, {});
  assert.equal(await t.page().run('Publipostage_Modeles', async () => 'lue'), 'lue');
});

test('une lecture interrompue il y a longtemps ne compte plus : la personne est partie pendant une lecture, puis revenue', async () => {
  const t = tab();
  await dies(t, ['Publipostage_Modeles']);
  await dies(t, ['Publipostage_Modeles'], FRESH_MS / 1000);
  const guard = t.page();
  void guard.run('Publipostage_Modeles', never).catch(() => {});
  await settle();
  assert.equal(t.values[keyOf('Publipostage_Modeles')].split(':')[0], '1', 'le compte repart de un');
});

test('sans stockage, sans identifiant de document ou avec un nom de table étrange : pas de garde-fou, la lecture est celle d\'avant et rien ne lève', async () => {
  const refusing = tab({ refuse: true });
  assert.equal(await refusing.page().run('Publipostage_Modeles', async () => 'lue'), 'lue');
  for (const docId of [async () => { throw new Error('Grist ne répond pas'); }, async () => '../autre/clé', async () => null]) {
    const t = tab();
    assert.equal(await t.page(docId).run('Publipostage_Modeles', async () => 'lue'), 'lue');
    assert.deepEqual(t.values, {}, 'aucune clé sans identifiant sûr');
  }
  const t = tab();
  assert.equal(await t.page().run('table.étrange', async () => 'lue'), 'lue');
  assert.deepEqual(t.values, {});
});

test('une note étrangère (texte, nombre nul, date illisible) est tenue pour absente ; une date à venir vaut maintenant', async () => {
  for (const value of ['', 'trois', '0:5', '-1:5', '3', '3:demain', '100:5']) {
    const t = tab({ values: { [keyOf('Publipostage_Modeles')]: value } });
    assert.equal(await t.page().run('Publipostage_Modeles', async () => 'lue'), 'lue', `« ${value} »`);
  }
  const t = tab();
  t.values[keyOf('Publipostage_Modeles')] = `${LIMIT}:${t.clock.now + 86400000}`;
  const guard = t.page();
  await assert.rejects(guard.run('Publipostage_Modeles', async () => 'lue'), ReadHeldError);
  t.clock.now += HOLD_MS;
  assert.equal(await guard.run('Publipostage_Modeles', async () => 'lue'), 'lue', 'retenue deux minutes à partir de maintenant, pas jusqu\'à demain');
});

test('deux documents dans le même onglet ne se mêlent pas : la table retenue de l\'un se lit dans l\'autre', async () => {
  const t = tab();
  for (let start = 1; start <= LIMIT; start += 1) await dies(t, ['Publipostage_Modeles']);
  assert.equal(await t.page(async () => 'AutreDocument').run('Publipostage_Modeles', async () => 'lue'), 'lue');
  await assert.rejects(t.page().run('Publipostage_Modeles', async () => 'lue'), ReadHeldError);
});

// ---------- dans la lecture des fichiers ----------

const manifest = publipostage();
const spec = manifest.fichiers[0];
const data = () => ({
  [spec.table]: { id: [1], Nom: ['Convocation'], TypeModele: [''], DateModif: [0], ModifiePar: [''] },
  GFS_Fichiers: { id: [1], Identifiant: ['aa'], Nom: ['A.pdf'], Type: ['pdf'], Date: [10], Auteur: ['p'], Contenu: [['L', 7]], Taille: [900], Origine: ['import'], SupprimeLe: [null], SupprimePar: [''] },
});

test('loadFiles : toutes les lectures complètes des tables de fichiers passent par le garde-fou ; une table retenue est le problème de son app (`held`), et les fichiers des autres se montrent', async () => {
  const { FILES_ENTRY } = await import('../js/files/gfs-files.js');
  const tables = data();
  const asked = [];
  const port = { doc: { listTables: async () => Object.keys(tables), fetchTable: async name => { asked.push(name); return tables[name]; } } };
  const t = tab();
  for (let start = 1; start <= LIMIT; start += 1) await dies(t, [spec.table]);
  const found = await loadFiles(port, [{ manifest }, FILES_ENTRY], '', null, t.page());
  assert.equal(asked.includes(spec.table), false, 'la table retenue n\'est pas demandée à Grist');
  assert.deepEqual(found.problems.map(problem => [problem.app, problem.held]), [['publipostage', true]]);
  assert.deepEqual(found.files.map(file => file.name), ['A.pdf'], 'les fichiers de GFS sont là');
  const free = await loadFiles(port, [{ manifest }, FILES_ENTRY], '', null, tab().page());
  assert.deepEqual([free.problems, free.files.map(file => file.name).sort()], [[], ['A.pdf', 'Convocation']]);
  const refused = { doc: { listTables: port.doc.listTables, fetchTable: async name => { if (name === spec.table) throw new Error('accès refusé'); return tables[name]; } } };
  const plain = await loadFiles(refused, [{ manifest }, FILES_ENTRY], '', null, tab().page());
  assert.deepEqual(plain.problems.map(problem => [problem.app, problem.held, problem.reason]), [['publipostage', false, 'accès refusé']], 'un refus ordinaire de Grist garde sa phrase');
});
