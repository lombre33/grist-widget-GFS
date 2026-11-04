// Le choix de thème de GFS (décision du porteur, 03/11) : retenu sur le navigateur (deux clés), un seul geste pour revenir à l'origine, suivi d'un autre onglet ; le message que les apps reçoivent ;
// l'ambiance posée sur la page par le CSSOM, au mode de la page, et reposée quand il change.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AMBIANCE_KEY, COLOR_KEY, ThemeSetting, ambianceMessage, browserStores, previewMessage } from '../js/theme.js';
import { ThemeHost, modeOf, paint, watchAppearance } from '../js/theme-apply.js';
import { AMBIANCES, COLOR_TOKENS, ORIGIN } from '../js/ambiance.js';
import { FORME_TOKENS } from '../js/ambiance-forme.js';
import { TYPE_TOKENS, typeTokens } from '../js/ambiance-types.js';

function fakeStore(initial = null, { accepts = true } = {}) {
  const store = { value: initial, writes: [], read: () => store.value, write(value) { store.writes.push(value); if (!accepts) return false; store.value = value; return true; } };
  return store;
}
const setting = (ambiance = null, color = null, options) => {
  const ambianceStore = fakeStore(ambiance, options);
  const colorStore = fakeStore(color, options);
  return { setting: new ThemeSetting({ ambianceStore, colorStore }), ambianceStore, colorStore };
};

test('rien de retenu : l\'ambiance d\'origine, sans couleur ; une valeur étrangère est tenue pour absente', () => {
  const origin = setting().setting;
  assert.equal(origin.ambiance, 'defaut');
  assert.equal(origin.color, null);
  assert.equal(origin.isOrigin, true);
  assert.equal(origin.palette, null);
  assert.equal(origin.message(), null);
  for (const odd of ['', 'rose', 'POP', '{"id":"pop"}', 'defaut', '<b>pop</b>']) assert.equal(setting(odd).setting.ambiance, 'defaut', odd);
  for (const odd of ['', 'rose', '#12345', '#D6336C', 'd6336c', '#d6336c80', '<b>']) assert.equal(setting(null, odd).setting.color, null, odd);
  assert.equal(setting('pop', '#0f766e').setting.ambiance, 'pop');
  assert.equal(setting('pop', '#0f766e').setting.color, '#0f766e');
});

test('choose : retient l\'ambiance (l\'ambiance d\'origine est la clé absente), prévient une fois, ignore ce qui n\'en est pas une', () => {
  const { setting: theme, ambianceStore } = setting();
  const heard = [];
  theme.onChange(event => heard.push(event));
  assert.equal(theme.choose('neon'), true);
  assert.deepEqual(ambianceStore.writes, ['neon']);
  assert.deepEqual(heard, [{ ambiance: 'neon', color: null }]);
  theme.choose('neon');
  for (const odd of ['rose', '', null, undefined, {}, 'POP']) assert.equal(theme.choose(odd), true);
  assert.equal(heard.length, 1);
  assert.equal(theme.isOrigin, false);
  theme.choose('defaut');
  assert.equal(ambianceStore.writes.at(-1), null, 'revenir à l\'origine retire la clé');
  assert.equal(ambianceStore.value, null);
  assert.equal(heard.length, 2);
});

test('chooseColor : une couleur `#rrggbb` (le texte d\'une personne est remis en forme), null pour celle de l\'ambiance, le reste est ignoré', () => {
  const { setting: theme, colorStore } = setting('pop');
  const heard = [];
  theme.onChange(event => heard.push(event));
  assert.equal(theme.chooseColor('D6336C'), true);
  assert.deepEqual(colorStore.writes, ['#d6336c']);
  assert.equal(theme.color, '#d6336c');
  assert.equal(theme.chooseColor(' #0f7 '), true);
  assert.equal(theme.color, '#00ff77');
  for (const odd of ['rose', '', '#12345', undefined, 12, {}]) theme.chooseColor(odd);
  assert.equal(theme.color, '#00ff77');
  theme.chooseColor(null);
  assert.deepEqual(colorStore.writes, ['#d6336c', '#00ff77', null]);
  assert.equal(theme.color, null);
  assert.equal(heard.length, 3);
});

test('reset : ambiance d\'origine et pas de couleur, en un seul avertissement', () => {
  const { setting: theme, ambianceStore, colorStore } = setting('brut', '#d6336c');
  const heard = [];
  theme.onChange(event => heard.push(event));
  assert.equal(theme.reset(), true);
  assert.deepEqual(heard, [{ ambiance: 'defaut', color: null }]);
  assert.equal(theme.isOrigin, true);
  assert.deepEqual([ambianceStore.writes, colorStore.writes], [[null], [null]]);
  theme.reset();
  assert.equal(heard.length, 1, 'déjà à l\'origine : rien à dire');
});

test('un navigateur qui refuse de retenir : le choix vaut pour la page, et `choose` le dit', () => {
  const { setting: theme } = setting(null, null, { accepts: false });
  assert.equal(theme.choose('pop'), false);
  assert.equal(theme.ambiance, 'pop');
  assert.equal(theme.chooseColor('#d6336c'), false);
  assert.equal(theme.color, '#d6336c');
  assert.equal(theme.reset(), false);
  assert.equal(theme.isOrigin, true);
  const broken = new ThemeSetting({ ambianceStore: { read() { throw new Error('SecurityError'); }, write: () => false }, colorStore: { read() { throw new Error('SecurityError'); }, write: () => false } });
  assert.equal(broken.isOrigin, true, 'une lecture qui échoue : l\'aspect d\'origine, sans erreur');
});

test('un autre onglet change une clé (événement `storage`) : on relit, une seule fois, et on s\'arrête quand on le demande', () => {
  const { setting: theme, ambianceStore, colorStore } = setting();
  const heard = [];
  theme.onChange(event => heard.push(event));
  const handlers = [];
  const win = { addEventListener: (type, handler) => handlers.push([type, handler]), removeEventListener: (type, handler) => handlers.splice(handlers.findIndex(entry => entry[1] === handler), 1) };
  const stop = theme.watch(win);
  assert.deepEqual(handlers.map(([type]) => type), ['storage', 'storage']);
  ambianceStore.value = 'papier';
  colorStore.value = '#1d4ed8';
  for (const [, handler] of handlers) handler({ key: AMBIANCE_KEY });
  assert.deepEqual(heard, [{ ambiance: 'papier', color: '#1d4ed8' }], 'les deux relus d\'un coup, un seul avertissement');
  for (const [, handler] of handlers) handler({ key: 'gfs.langue' });
  for (const [, handler] of handlers) handler({ key: COLOR_KEY });
  assert.equal(heard.length, 1, 'une autre clé, ou rien de changé : rien à dire');
  ambianceStore.value = null;
  for (const [, handler] of handlers) handler({ key: null });
  assert.equal(theme.ambiance, 'defaut');
  stop();
  assert.equal(handlers.length, 0);
});

test('browserStores : les deux clés du localStorage de GFS, et un navigateur qui refuse n\'arrête rien', () => {
  const kept = new Map();
  const win = { localStorage: { getItem: key => kept.get(key) ?? null, setItem: (key, value) => kept.set(key, value), removeItem: key => kept.delete(key) } };
  const { ambianceStore, colorStore } = browserStores(win);
  assert.equal(ambianceStore.write('pop'), true);
  assert.equal(colorStore.write('#d6336c'), true);
  assert.deepEqual([...kept], [['gfs.theme', 'pop'], ['gfs.couleur', '#d6336c']]);
  assert.equal(colorStore.write(null), true);
  assert.deepEqual([...kept.keys()], ['gfs.theme']);
  const refusing = browserStores({ get localStorage() { throw new Error('SecurityError'); } });
  assert.equal(refusing.ambianceStore.read(), null);
  assert.equal(refusing.colorStore.write('#d6336c'), false);
});

test('le message aux apps : null à l\'origine ; sinon l\'ambiance, la couleur, les deux modes et la forme', () => {
  assert.equal(ambianceMessage('defaut', null), null);
  assert.equal(ambianceMessage('inconnue', null), null);
  const pop = ambianceMessage('pop', null);
  assert.deepEqual(Object.keys(pop).sort(), ['ajustee', 'clair', 'couleur', 'forme', 'id', 'sombre']);
  assert.equal(pop.id, 'pop');
  assert.equal(pop.couleur, null);
  assert.deepEqual(Object.keys(pop.clair).sort(), [...COLOR_TOKENS].sort());
  assert.deepEqual(Object.keys(pop.sombre).sort(), [...COLOR_TOKENS].sort());
  assert.ok(Object.keys(pop.forme).every(name => FORME_TOKENS.includes(name)));
  const own = ambianceMessage('defaut', '#D6336C');
  assert.equal(own.id, 'defaut');
  assert.equal(own.couleur, '#d6336c');
  assert.deepEqual(own.forme, {});
  assert.doesNotThrow(() => JSON.stringify(own), 'le message passe par postMessage : des données seules');
  assert.deepEqual(JSON.parse(JSON.stringify(own)), own);
});

// Le kit (sous-module `kit/`) pose l'ambiance dans les apps (js/ambiance.js) et lit le message de GFS avec sa propre liste de jetons : elle reste celle du moteur de GFS, et rien de ce que GFS écrit n'est refusé.
test('le kit lit le message de GFS tel quel : mêmes jetons de couleur et de forme, aucune valeur perdue, pour chaque ambiance et pour une couleur libre', async () => {
  const kit = await import('../kit/js/ambiance-message.js').catch(() => null);
  assert.ok(kit, 'le sous-module du kit n\'est pas là : git submodule update --init prototype/kit');
  assert.deepEqual([...kit.COLOR_TOKENS].sort(), [...COLOR_TOKENS].sort(), 'jetons de couleur : le kit et GFS ne disent plus la même liste');
  assert.deepEqual([...kit.SHAPE_TOKENS].sort(), [...FORME_TOKENS].sort(), 'jetons de forme : le kit et GFS ne disent plus la même liste');
  for (const id of AMBIANCES) {
    for (const color of [null, '#d6336c', '#0f766e', '#ffe066', '#000000', '#ffffff']) {
      const sent = JSON.parse(JSON.stringify(ambianceMessage(id, color) || { id, couleur: null, ajustee: false, clair: ORIGIN.clair, sombre: ORIGIN.sombre, forme: {} }));
      assert.deepEqual(kit.normalizeAmbiance(sent), sent, `${id} ${color}`);
    }
  }
});

// Un élément de pied : l'attribut `style` du CSSOM et les attributs.
function fakeElement() {
  const props = new Map();
  const attributes = new Map();
  return {
    props, attributes,
    style: { setProperty: (name, value) => props.set(name, value), removeProperty: name => props.delete(name) },
    setAttribute: (name, value) => attributes.set(name, value), removeAttribute: name => attributes.delete(name),
  };
}

test('paint : pose les jetons du mode, la forme et les couleurs de type par le CSSOM, retire tout ce qu\'il avait posé', () => {
  const el = fakeElement();
  const brut = ambianceMessage('brut', null);
  paint(el, brut, 'clair');
  assert.equal(el.attributes.get('data-ambiance'), 'brut');
  assert.equal(el.props.get('--accent-solid'), brut.clair['--accent-solid']);
  assert.equal(el.props.get('--bw'), '2px');
  assert.equal(el.props.size, COLOR_TOKENS.length + Object.keys(brut.forme).length + TYPE_TOKENS.length);
  paint(el, brut, 'sombre');
  assert.equal(el.props.get('--accent-solid'), brut.sombre['--accent-solid']);
  paint(el, ambianceMessage('defaut', '#d6336c'), 'clair');
  assert.equal(el.props.has('--bw'), false, 'la forme de Brut est retirée');
  assert.equal(el.props.size, COLOR_TOKENS.length + TYPE_TOKENS.length, 'la couleur libre sur l\'origine : les couleurs et les types d\'origine, aucune forme');
  el.props.set('--font-ui', 'autre');
  paint(el, null, 'clair');
  assert.equal(el.props.size, 0, 'retiré : les feuilles de style disent l\'aspect d\'origine');
  assert.equal(el.attributes.has('data-ambiance'), false);
});

test('paint : les couleurs de type sont celles de l\'ambiance et du mode de la page, et changent avec eux', () => {
  const el = fakeElement();
  for (const id of AMBIANCES.slice(1)) {
    const message = ambianceMessage(id, null);
    for (const mode of ['clair', 'sombre']) {
      paint(el, message, mode);
      for (const [name, value] of Object.entries(typeTokens(id, mode))) assert.equal(el.props.get(name), value, `${id} ${mode} ${name}`);
    }
  }
  paint(el, ambianceMessage('pop', null), 'clair');
  const pop = el.props.get('--t-pdf');
  paint(el, ambianceMessage('papier', null), 'clair');
  assert.notEqual(el.props.get('--t-pdf'), pop, 'le rouge du PDF suit l\'ambiance');
  paint(el, ambianceMessage('papier', '#0f766e'), 'clair');
  assert.equal(el.props.get('--t-pdf'), typeTokens('papier', 'clair')['--t-pdf'], 'la couleur libre ne change que l\'accent : les types gardent ceux de l\'ambiance');
});

test('paint : la vignette de l\'ambiance d\'origine pose les couleurs de type d\'origine (la page peut porter celles d\'une autre ambiance)', () => {
  const page = fakeElement();
  const mini = fakeElement();
  paint(page, ambianceMessage('neon', null), 'sombre');
  paint(mini, previewMessage('defaut', null), 'sombre');
  assert.equal(mini.attributes.get('data-ambiance'), 'defaut');
  for (const [name, value] of Object.entries(typeTokens('defaut', 'sombre'))) assert.equal(mini.props.get(name), value, name);
  assert.notEqual(mini.props.get('--t-doc'), page.props.get('--t-doc'), 'la vignette ne reprend pas les types de la page');
});

test('paint : ne touche pas à ce qui n\'est pas un jeton d\'ambiance', () => {
  const el = fakeElement();
  el.props.set('--d', '3');
  el.props.set('--z-menu', '300');
  paint(el, ambianceMessage('pop', null), 'clair');
  paint(el, null, 'clair');
  assert.deepEqual([...el.props], [['--d', '3'], ['--z-menu', '300']]);
});

// Une fenêtre de pied : le mode, l'attribut de Grist qui change, la préférence du système qui change.
function fakeWindow(scheme = 'light') {
  const root = fakeElement();
  const win = {
    scheme, observers: [], queries: [], document: { documentElement: root },
    getComputedStyle: () => ({ colorScheme: win.scheme }),
    MutationObserver: class { constructor(callback) { this.callback = callback; win.observers.push(this); } observe(target, options) { this.target = target; this.options = options; } disconnect() { this.gone = true; } },
    matchMedia: query => { const media = { query, listeners: [], addEventListener: (type, fn) => media.listeners.push(fn), removeEventListener: (type, fn) => media.listeners.splice(media.listeners.indexOf(fn), 1) }; win.queries.push(media); return media; },
    addEventListener() {}, removeEventListener() {},
    flip(next) { win.scheme = next; win.observers.forEach(observer => observer.callback()); },
  };
  return win;
}

test('modeOf et watchAppearance : le color-scheme que css/gfs.css tire de Grist ou du système, suivi quand l\'attribut de Grist ou le système change', () => {
  const win = fakeWindow('light');
  assert.equal(modeOf(win), 'clair');
  win.scheme = 'dark';
  assert.equal(modeOf(win), 'sombre');
  const seen = [];
  const stop = watchAppearance(win, mode => seen.push(mode));
  assert.deepEqual(win.observers[0].options, { attributes: true, attributeFilter: ['data-grist-appearance'] }, 'seul l\'attribut de Grist est suivi (l\'écriture du style de GFS ne boucle pas)');
  assert.equal(win.queries[0].query, '(prefers-color-scheme: dark)');
  win.flip('light');
  win.queries[0].listeners.forEach(fn => fn());
  assert.deepEqual(seen, ['clair', 'clair']);
  stop();
  assert.equal(win.observers[0].gone, true);
  assert.equal(win.queries[0].listeners.length, 0);
});

test('ThemeHost : pose l\'ambiance au démarrage, la repose quand le choix ou le mode change, dit aux apps ce qui vaut', () => {
  const win = fakeWindow('light');
  const { setting: theme } = setting();
  const told = [];
  const host = new ThemeHost({ win, setting: theme, onMessage: message => told.push(message) });
  const root = win.document.documentElement;
  const stop = host.start();
  assert.equal(root.props.size, 0, 'à l\'origine, rien n\'est écrit');
  theme.choose('pop');
  assert.equal(root.attributes.get('data-ambiance'), 'pop');
  const pop = ambianceMessage('pop', null);
  assert.equal(root.props.get('--bg'), pop.clair['--bg']);
  assert.equal(told.length, 1);
  assert.equal(told[0].id, 'pop');
  const modes = [];
  host.onMode(mode => modes.push(mode));
  win.flip('dark');
  assert.equal(host.mode, 'sombre');
  assert.equal(root.props.get('--bg'), pop.sombre['--bg'], 'le sombre de Grist : les jetons du sombre');
  assert.deepEqual(modes, ['sombre']);
  win.flip('dark');
  assert.deepEqual(modes, ['sombre'], 'le même mode une seconde fois : rien de nouveau');
  assert.equal(told.length, 1, 'un changement de mode n\'apprend rien aux apps : elles reçoivent les deux');
  theme.reset();
  assert.equal(root.props.size, 0);
  assert.equal(told.length, 2);
  assert.equal(told[1], null);
  stop();
  theme.choose('neon');
  assert.equal(root.props.size, 0, 'arrêté : plus rien ne se pose');
});

test('la vignette : le message de l\'ambiance pour la couleur choisie ; l\'origine, sans couleur, montre la charte d\'origine (et non ce que la page porte)', () => {
  assert.deepEqual(previewMessage('pop', null), ambianceMessage('pop', null));
  assert.deepEqual(previewMessage('papier', '#0f766e'), ambianceMessage('papier', '#0f766e'));
  const origin = previewMessage('defaut', null);
  assert.equal(origin.id, 'defaut');
  assert.deepEqual(origin.forme, {});
  assert.deepEqual(origin.clair, ORIGIN.clair);
  assert.deepEqual(origin.sombre, ORIGIN.sombre);
  assert.equal(ambianceMessage('defaut', null), null, 'la page, elle, n\'écrit rien');
  assert.equal(previewMessage('defaut', '#d6336c').id, 'defaut');
  assert.notDeepEqual(previewMessage('defaut', '#d6336c').clair, ORIGIN.clair);
  assert.equal(previewMessage('inconnue', null).id, 'defaut', 'une ambiance inconnue : la vignette montre l\'origine');
});
