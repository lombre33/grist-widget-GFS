// Le choix de langue de GFS (décision du 20/10) : un seul pour toutes les apps, retenu sur le navigateur, « comme Grist » par défaut.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LanguageSetting, STORAGE_KEY, browserStore, languageOfGrist, localeFor, watchStorage } from '../js/language.js';

// Un stockage de pied : ce que le navigateur garde, et s'il accepte d'écrire.
function fakeStore(initial = null, { accepts = true } = {}) {
  const store = {
    value: initial, writes: [],
    read: () => store.value,
    write(value) { store.writes.push(value); if (!accepts) return false; store.value = value; return true; },
  };
  return store;
}

test('languageOfGrist : le paramètre de Grist, la langue du navigateur à défaut, le français sauf pour l\'anglais', () => {
  assert.equal(languageOfGrist('fr', 'en-US'), 'fr');
  assert.equal(languageOfGrist('en', 'fr-FR'), 'en');
  assert.equal(languageOfGrist('EN-gb', null), 'en');
  assert.equal(languageOfGrist('de', 'en-US'), 'fr');
  assert.equal(languageOfGrist(null, 'en-US'), 'en');
  assert.equal(languageOfGrist('', ''), 'fr');
  assert.equal(languageOfGrist(undefined, undefined), 'fr');
});

test('par défaut : comme Grist ; un choix retenu l\'emporte ; une valeur étrangère est tenue pour absente', () => {
  assert.equal(new LanguageSetting({ grist: 'en', store: fakeStore() }).language, 'en');
  const kept = new LanguageSetting({ grist: 'fr', store: fakeStore('en') });
  assert.equal(kept.choice, 'en');
  assert.equal(kept.language, 'en');
  assert.equal(kept.grist, 'fr');
  for (const odd of ['de', '', '{"langue":"en"}', 'auto', '<b>en</b>']) {
    const setting = new LanguageSetting({ grist: 'fr', store: fakeStore(odd) });
    assert.equal(setting.choice, 'auto', odd);
    assert.equal(setting.language, 'fr', odd);
  }
  assert.equal(new LanguageSetting({ grist: 'xx', store: fakeStore() }).language, 'fr', 'une langue de Grist que GFS n\'a pas : le français');
});

test('choose : écrit la valeur, prévient une fois, dit si la langue a vraiment changé ; « comme Grist » retire la clé', () => {
  const store = fakeStore();
  const setting = new LanguageSetting({ grist: 'fr', store });
  const heard = [];
  setting.onChange(event => heard.push(event));
  assert.equal(setting.choose('en'), true);
  assert.deepEqual(store.writes, ['en']);
  assert.deepEqual(heard, [{ choice: 'en', language: 'en', languageChanged: true }]);
  assert.equal(setting.language, 'en');
  // Le même choix une seconde fois : rien de nouveau à dire.
  setting.choose('en');
  assert.equal(heard.length, 1);
  // Revenir à Grist : la clé disparaît (null), la langue redevient celle de Grist.
  assert.equal(setting.choose('auto'), true);
  assert.equal(store.writes.at(-1), null);
  assert.equal(store.value, null);
  assert.deepEqual(heard.at(-1), { choice: 'auto', language: 'fr', languageChanged: true });
});

test('choisir la langue que Grist donne déjà change le choix, pas la langue : les apps n\'ont rien à apprendre', () => {
  const setting = new LanguageSetting({ grist: 'fr', store: fakeStore() });
  const heard = [];
  setting.onChange(event => heard.push(event));
  setting.choose('fr');
  assert.deepEqual(heard, [{ choice: 'fr', language: 'fr', languageChanged: false }]);
  setting.choose('en');
  assert.equal(heard.at(-1).languageChanged, true);
});

test('un navigateur qui refuse d\'écrire : le choix vaut pour la page, et GFS le sait pour le dire', () => {
  const store = fakeStore(null, { accepts: false });
  const setting = new LanguageSetting({ grist: 'fr', store });
  assert.equal(setting.choose('en'), false);
  assert.equal(setting.language, 'en');
  assert.equal(setting.choice, 'en');
});

test('un navigateur qui refuse de lire : « comme Grist », sans erreur', () => {
  const store = { read() { throw new Error('SecurityError'); }, write: () => false };
  const setting = new LanguageSetting({ grist: 'en', store });
  assert.equal(setting.choice, 'auto');
  assert.equal(setting.language, 'en');
});

test('choose ignore une valeur qui n\'est pas dans la liste', () => {
  const store = fakeStore();
  const setting = new LanguageSetting({ grist: 'fr', store });
  const heard = [];
  setting.onChange(event => heard.push(event));
  for (const odd of ['de', '', null, undefined, {}, '<script>']) setting.choose(odd);
  assert.deepEqual(store.writes, []);
  assert.deepEqual(heard, []);
  assert.equal(setting.choice, 'auto');
});

test('reload : un autre onglet a changé la clé, on suit une seule fois ; une clé inchangée ne dit rien', () => {
  const store = fakeStore();
  const setting = new LanguageSetting({ grist: 'fr', store });
  const heard = [];
  setting.onChange(event => heard.push(event));
  setting.reload();
  assert.deepEqual(heard, []);
  store.value = 'en';
  setting.reload();
  setting.reload();
  assert.deepEqual(heard, [{ choice: 'en', language: 'en', languageChanged: true }]);
  store.value = null;
  setting.reload();
  assert.deepEqual(heard.at(-1), { choice: 'auto', language: 'fr', languageChanged: true });
});

test('onChange rend de quoi se désabonner', () => {
  const setting = new LanguageSetting({ grist: 'fr', store: fakeStore() });
  const heard = [];
  const stop = setting.onChange(event => heard.push(event));
  setting.choose('en');
  stop();
  setting.choose('fr');
  assert.equal(heard.length, 1);
});

test('browserStore : lit, écrit, retire ; un localStorage qui lève ne fait rien de pire que de ne pas retenir', () => {
  const data = new Map();
  const ok = { localStorage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) } };
  const store = browserStore(ok);
  assert.equal(store.read(), null);
  assert.equal(store.write('en'), true);
  assert.equal(data.get(STORAGE_KEY), 'en');
  assert.equal(store.read(), 'en');
  assert.equal(store.write(null), true);
  assert.equal(data.has(STORAGE_KEY), false);
  const blocked = browserStore({ get localStorage() { throw new Error('SecurityError'); } });
  assert.equal(blocked.read(), null);
  assert.equal(blocked.write('en'), false);
  const full = browserStore({ localStorage: { getItem: () => null, setItem() { throw new Error('QuotaExceededError'); }, removeItem() { throw new Error('x'); } } });
  assert.equal(full.write('fr'), false);
  assert.equal(full.write(null), false);
});

test('watchStorage : suit la clé de GFS (ou un effacement général), rien d\'autre ; se retire', () => {
  const listeners = new Map();
  const win = {
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type, fn) => { if (listeners.get(type) === fn) listeners.delete(type); },
  };
  const calls = [];
  const stop = watchStorage({ reload: () => calls.push('reload') }, win);
  const fire = event => listeners.get('storage')(event);
  fire({ key: 'gfs.premier-lancement.abc' });
  assert.deepEqual(calls, []);
  fire({ key: STORAGE_KEY });
  fire({ key: null });
  assert.deepEqual(calls, ['reload', 'reload']);
  stop();
  assert.equal(listeners.has('storage'), false);
});

test('localeFor : la culture de Grist suit la langue de Grist ; une autre langue choisie la quitte, sauf si la culture est de cette langue', () => {
  // Rien de changé par la personne : la culture de Grist est respectée, même d'une autre langue (comportement d'avant).
  assert.equal(localeFor({ culture: 'fr-CH', language: 'fr', grist: 'fr' }), 'fr-CH');
  assert.equal(localeFor({ culture: 'en-US', language: 'fr', grist: 'fr' }), 'en-US');
  assert.equal(localeFor({ culture: null, language: 'en', grist: 'en' }), 'en-GB');
  assert.equal(localeFor({ culture: null, language: 'fr', grist: 'fr' }), 'fr-FR');
  // Langue choisie différente de celle de Grist : les dates ne restent pas dans l'autre langue.
  assert.equal(localeFor({ culture: 'fr-FR', language: 'en', grist: 'fr' }), 'en-GB');
  assert.equal(localeFor({ culture: 'en-US', language: 'fr', grist: 'en' }), 'fr-FR');
  assert.equal(localeFor({ culture: 'en-US', language: 'en', grist: 'fr' }), 'en-US');
  assert.equal(localeFor({ culture: 'pas une culture !', language: 'en', grist: 'en' }), 'en-GB');
});
