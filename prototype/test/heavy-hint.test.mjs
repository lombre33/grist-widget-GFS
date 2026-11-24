// Le souvenir d'un document lourd (js/explorer/heavy-hint.js) : la lecture légère d'emblée quand la visite précédente l'a vu lourd ; jamais obligatoire.
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

test('un document vu lourd à la visite d\'avant : la lecture légère est prête d\'emblée, avant toute lecture', async () => {
  const b = browser({ values: { [`${HINT_PREFIX}AbC123xyz`]: String(42 * MIB) } });
  const reader = lightReader();
  assert.equal(reader.isActive(), false);
  assert.equal(await hintFor(b).prime(reader), 42 * MIB);
  assert.equal(reader.isActive(), true);
});

test('sans souvenir, ou pour un autre document : la première lecture se fait en entier, comme avant', async () => {
  const b = browser({ values: { [`${HINT_PREFIX}AutreDocument`]: String(42 * MIB) } });
  const reader = lightReader();
  assert.equal(await hintFor(b).prime(reader), null);
  assert.equal(reader.isActive(), false);
});

test('un souvenir étranger (texte, négatif, sous le seuil, démesuré) est tenu pour absent', async () => {
  for (const value of ['lourd', '-5', '1.5e9', '', String(HEAVY_BYTES - 1), '99999999999999']) {
    const b = browser({ values: { [`${HINT_PREFIX}AbC123xyz`]: value } });
    const reader = lightReader();
    assert.equal(await hintFor(b).prime(reader), null, `« ${value} »`);
    assert.equal(reader.isActive(), false);
  }
});

test('un navigateur qui refuse de garder, ou un identifiant de document illisible : rien ne s\'arrête, la lecture est celle d\'avant', async () => {
  const refusing = browser({ refuse: true });
  const reader = lightReader();
  const hint = hintFor(refusing);
  assert.equal(await hint.prime(reader), null);
  assert.doesNotThrow(() => hint.note(50 * MIB));
  assert.equal(reader.isActive(), false);
  for (const docId of [async () => { throw new Error('Grist ne répond pas'); }, async () => '../autre/clé', async () => '', async () => 'x'.repeat(65)]) {
    const b = browser();
    const odd = hintFor(b, docId);
    assert.equal(await odd.prime(reader), null);
    odd.note(50 * MIB);
    assert.deepEqual(b.writes, [], 'aucune clé n\'est écrite sans identifiant sûr');
  }
});

test('un document lourd se retient une fois ; un document redevenu léger s\'oublie ; rien ne s\'écrit tant que le souvenir est juste', async () => {
  const b = browser();
  const hint = hintFor(b);
  await hint.prime(lightReader());
  hint.note(10 * MIB);
  hint.note(11 * MIB);
  assert.deepEqual(b.writes, [[`${HINT_PREFIX}AbC123xyz`, String(10 * MIB)]], 'une seule écriture');
  hint.note(HEAVY_BYTES - 1);
  assert.deepEqual(b.writes[1], [`${HINT_PREFIX}AbC123xyz`, null]);
  hint.note(100);
  assert.equal(b.writes.length, 2, 'un document léger n\'écrit rien de plus');
});

test('le souvenir n\'est jamais lu deux fois pour un identifiant : `prime` demande l\'identifiant une seule fois', async () => {
  let asked = 0;
  const b = browser({ values: { [`${HINT_PREFIX}AbC123xyz`]: String(8 * MIB) } });
  const hint = hintFor(b, async () => { asked += 1; return 'AbC123xyz'; });
  await Promise.all([hint.prime(lightReader()), hint.prime(lightReader())]);
  await hint.prime(lightReader());
  assert.equal(asked, 1);
});

test('Grist qui ne dit jamais le nom du document (serveur lent ou muet) n\'arrête pas la liste : après un délai bref, la première lecture est celle d\'avant', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const b = browser({ values: { [`${HINT_PREFIX}AbC123xyz`]: String(42 * MIB) } });
    const reader = lightReader();
    const hint = hintFor(b, () => new Promise(() => {})); // la promesse ne se résout jamais
    const priming = hint.prime(reader);
    mock.timers.tick(DOC_ID_WAIT_MS + 1);
    assert.equal(await priming, null);
    assert.equal(reader.isActive(), false, 'sans identifiant, pas de souvenir : lecture complète comme avant');
    hint.note(50 * MIB);
    assert.deepEqual(b.writes, [], 'rien ne s\'écrit sans identifiant');
  } finally { mock.timers.reset(); }
});
