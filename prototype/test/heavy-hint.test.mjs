// Le souvenir du poids d'un document (js/explorer/heavy-hint.js) : la lecture légère d'emblée quand la visite précédente l'a vu lourd ou que GFS n'en sait rien, la lecture complète quand elle l'a vu
// léger ; jamais obligatoire.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createHeavyHint, HINT_PREFIX, DOC_ID_WAIT_MS } from '../js/explorer/heavy-hint.js';
import { createLightReader, HEAVY_BYTES } from '../js/explorer/explorer-sql.js';
import { keyStore } from '../js/shell/stored-choice.js';

const MIB = 1024 * 1024;

// Un navigateur de doublure : `values` ce qu'il garde ; `refuse` : un navigateur qui lève à chaque lecture et écriture (navigation privée, cadre sans stockage).
function browser({ values = {}, refuse = false } = {}) {
  const writes = [];
  const win = { localStorage: {
    getItem: key => { if (refuse) throw new Error('stockage refusé'); return key in values ? values[key] : null; },
    setItem: (key, value) => { if (refuse) throw new Error('stockage refusé'); values[key] = value; writes.push([key, value]); },
    removeItem: key => { if (refuse) throw new Error('stockage refusé'); delete values[key]; writes.push([key, null]); },
  } };
  return { values, writes, store: key => keyStore(win, key) };
}
const lightReader = () => createLightReader({ sql: async () => [] });
const hintFor = (b, docId = async () => 'AbC123xyz') => createHeavyHint({ docId, store: b.store });

test('un document vu lourd à la visite d\'avant : la lecture légère sert d\'emblée, avant toute lecture', async () => {
  const b = browser({ values: { [`${HINT_PREFIX}AbC123xyz`]: String(42 * MIB) } });
  const reader = lightReader();
  assert.equal(await hintFor(b).prime(reader), 42 * MIB);
  assert.equal(reader.isActive(), true);
});

test('un document vu léger à la visite d\'avant : la lecture complète d\'emblée, sans cadre d\'envoi ni jeton', async () => {
  for (const bytes of [0, 1200, HEAVY_BYTES - 1]) {
    const b = browser({ values: { [`${HINT_PREFIX}AbC123xyz`]: String(bytes) } });
    const reader = lightReader();
    assert.equal(await hintFor(b).prime(reader), bytes);
    assert.equal(reader.isActive(), false, `${bytes} octets`);
  }
});

test('sans souvenir, ou pour un autre document : la lecture légère sert d\'abord (la toute première visite ne lit plus le contenu des fichiers)', async () => {
  const b = browser({ values: { [`${HINT_PREFIX}AutreDocument`]: String(100) } });
  const reader = lightReader();
  assert.equal(await hintFor(b).prime(reader), null);
  assert.equal(reader.isActive(), true);
});

test('un souvenir étranger (texte, négatif, démesuré) est tenu pour absent : la lecture légère d\'abord', async () => {
  for (const value of ['lourd', '-5', '1.5e9', '', '99999999999999']) {
    const b = browser({ values: { [`${HINT_PREFIX}AbC123xyz`]: value } });
    const reader = lightReader();
    assert.equal(await hintFor(b).prime(reader), null, `« ${value} »`);
    assert.equal(reader.isActive(), true);
  }
});

test('un navigateur qui refuse de garder, ou un identifiant de document illisible : rien ne s\'arrête, la lecture légère sert d\'abord', async () => {
  const refusing = browser({ refuse: true });
  const reader = lightReader();
  const hint = hintFor(refusing);
  assert.equal(await hint.prime(reader), null);
  assert.doesNotThrow(() => hint.note(50 * MIB));
  assert.equal(reader.isActive(), true);
  for (const docId of [async () => { throw new Error('Grist ne répond pas'); }, async () => '../autre/clé', async () => '', async () => 'x'.repeat(65)]) {
    const b = browser();
    const odd = hintFor(b, docId);
    assert.equal(await odd.prime(reader), null);
    odd.note(50 * MIB);
    assert.deepEqual(b.writes, [], 'aucune clé n\'est écrite sans identifiant sûr');
  }
});

test('le poids se retient, lourd ou léger ; rien ne s\'écrit tant que le souvenir dit encore vrai (lourd ou léger, pas l\'octet près)', async () => {
  const b = browser();
  const hint = hintFor(b);
  await hint.prime(lightReader());
  hint.note(10 * MIB);
  hint.note(11 * MIB);
  assert.deepEqual(b.writes, [[`${HINT_PREFIX}AbC123xyz`, String(10 * MIB)]], 'une seule écriture');
  hint.note(HEAVY_BYTES - 1);
  assert.deepEqual(b.writes[1], [`${HINT_PREFIX}AbC123xyz`, String(HEAVY_BYTES - 1)], 'redevenu léger : il se retient léger, la visite suivante lit en entier');
  hint.note(100);
  assert.equal(b.writes.length, 2, 'toujours léger : rien de plus');
  hint.note(HEAVY_BYTES);
  assert.deepEqual(b.writes[2], [`${HINT_PREFIX}AbC123xyz`, String(HEAVY_BYTES)]);
});

test('un document léger se retient dès sa première lecture (0 octet compris) : sa visite suivante ne demande plus la lecture légère', async () => {
  for (const bytes of [0, 2048]) {
    const b = browser();
    const hint = hintFor(b);
    await hint.prime(lightReader());
    hint.note(bytes);
    assert.deepEqual(b.writes, [[`${HINT_PREFIX}AbC123xyz`, String(bytes)]]);
    const next = lightReader();
    assert.equal(await hintFor(b).prime(next), bytes);
    assert.equal(next.isActive(), false);
  }
  const odd = browser();
  const hint = hintFor(odd);
  await hint.prime(lightReader());
  for (const bytes of [NaN, Infinity, -1]) hint.note(bytes);
  assert.deepEqual(odd.writes, [], 'un compte qui n\'en est pas un ne s\'écrit pas');
});

test('le souvenir n\'est jamais lu deux fois pour un identifiant : `prime` demande l\'identifiant une seule fois', async () => {
  let asked = 0;
  const b = browser({ values: { [`${HINT_PREFIX}AbC123xyz`]: String(8 * MIB) } });
  const hint = hintFor(b, async () => { asked += 1; return 'AbC123xyz'; });
  await Promise.all([hint.prime(lightReader()), hint.prime(lightReader())]);
  await hint.prime(lightReader());
  assert.equal(asked, 1);
});

test('Grist qui ne dit jamais le nom du document (serveur lent ou muet) n\'arrête pas la liste : après un délai bref, la lecture part sans souvenir', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const b = browser({ values: { [`${HINT_PREFIX}AbC123xyz`]: String(42 * MIB) } });
    const reader = lightReader();
    const hint = hintFor(b, () => new Promise(() => {})); // la promesse ne se résout jamais
    const priming = hint.prime(reader);
    mock.timers.tick(DOC_ID_WAIT_MS + 1);
    assert.equal(await priming, null);
    assert.equal(reader.isActive(), true, 'sans identifiant, pas de souvenir : la lecture légère d\'abord');
    hint.note(50 * MIB);
    assert.deepEqual(b.writes, [], 'rien ne s\'écrit sans identifiant');
  } finally { mock.timers.reset(); }
});
