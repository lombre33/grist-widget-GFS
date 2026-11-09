// Les ambiances (décision du porteur, 03/11) : les couleurs que GFS calcule pour chacune, et pour la couleur libre de la personne, tiennent la charte (4,5:1 au moins, en clair et en sombre) quelle que soit
// la couleur choisie ; l'ambiance d'origine ne s'écrit pas ; la forme (arrondis, ombres, polices) est faite de jetons que les feuilles de style de GFS lisent. L'accessibilité renforcée (décision du 04/11)
// tient le texte à 7:1 et chaque trait à 3:1 sur toute ambiance, et prend sa propre forme, sans décor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ratio } from './helpers.mjs';
import { AMBIANCES, COLOR_TOKENS, ORIGIN, ORIGIN_SEED, ACCENT_PAIRS, TEXT_PAIRS, RENFORCEE, ambiancePalette, seedOf, weakestContrast, weakestEdge } from '../js/ambiance.js';
import { FORME, FORME_TOKENS } from '../js/ambiance-forme.js';
import { TYPES, typeTokens } from '../js/ambiance-types.js';
import { oklchToHex, hexToOklch, parseHex, isHex, contrast } from '../js/oklch.js';

const read = name => readFileSync(new URL(`../css/${name}`, import.meta.url), 'utf8');
const CSS = { gfs: read('gfs.css'), explorer: read('explorer.css'), modules: read('modules.css') };
const MODES = ['clair', 'sombre'];

// Les jetons `#rrggbb` d'un bloc de gfs.css, quel que soit son sélecteur.
const blockOf = start => {
  const open = CSS.gfs.indexOf('{', CSS.gfs.indexOf(start));
  let depth = 0;
  for (let i = open; i < CSS.gfs.length; i++) {
    if (CSS.gfs[i] === '{') depth += 1;
    if (CSS.gfs[i] === '}' && --depth === 0) return CSS.gfs.slice(open + 1, i);
  }
  return '';
};
const hexTokens = block => Object.fromEntries([...block.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map(([, name, value]) => [name, value.toLowerCase()]));
const charter = { clair: hexTokens(blockOf(':root {')), sombre: { ...hexTokens(blockOf(':root {')), ...hexTokens(blockOf(':root[data-grist-appearance="dark"] {')) } };

const PAIRS = [...TEXT_PAIRS, ...ACCENT_PAIRS];

// Ce qui ne change jamais d'une ambiance à l'autre (l'état) se pose sur ses fonds. Les couleurs de type, elles, sont celles de l'ambiance (js/ambiance-types.js, décision du 04/11) : `weakestType`, plus bas.
const FIXED = ['--danger-ink', '--good', '--warn-ink'];
const BACKGROUNDS = ['--surface', '--bg', '--surface-sunken'];

function weakest(palette, { fixed = true } = {}) {
  let low = { value: Infinity, where: '' };
  const note = (value, where) => { if (value < low.value) low = { value, where }; };
  for (const mode of MODES) {
    for (const [text, back] of PAIRS) note(ratio(palette[mode][text], palette[mode][back]), `${mode} ${text} sur ${back}`);
    if (fixed) for (const text of FIXED) for (const back of BACKGROUNDS) note(ratio(charter[mode][text], palette[mode][back]), `${mode} ${text} sur ${back}`);
  }
  return low;
}

// Des couleurs libres de toutes sortes : toutes les teintes, de l'ombre à la lumière, du gris à la couleur la plus vive, avec le blanc et le noir.
const FREE = [];
for (let h = 0; h < 360; h += 30) for (const [L, C] of [[0.3, 0.1], [0.5, 0.2], [0.7, 0.15], [0.85, 0.1], [0.95, 0.04], [0.15, 0.02], [0.6, 0], [0.97, 0]]) FREE.push(oklchToHex({ L, C, h }));
FREE.push('#ffffff', '#000000', '#ffff00', '#00ff00', '#ff0000', '#0000ff', '#808080', '#111111', '#ffe066', '#d6336c', '#0f766e');

test('les cinq ambiances : la première est celle d\'origine, qui ne s\'écrit pas ; les autres rendent leurs deux modes', () => {
  assert.deepEqual(AMBIANCES, ['defaut', 'pop', 'papier', 'brut', 'enseigne']);
  assert.equal(ambiancePalette('defaut'), null);
  for (const odd of ['', 'inconnue', null, undefined, 'POP', '__proto__']) assert.equal(ambiancePalette(odd), null, String(odd));
  for (const id of AMBIANCES.slice(1)) {
    const palette = ambiancePalette(id);
    for (const mode of MODES) assert.deepEqual(Object.keys(palette[mode]).sort(), [...COLOR_TOKENS].sort(), `${id} ${mode}`);
    assert.deepEqual(Object.keys(palette.forme).sort(), Object.keys(FORME[id]).sort());
  }
});

test('une couleur libre sur l\'ambiance d\'origine écrit les couleurs seulement : la forme reste celle d\'origine', () => {
  const palette = ambiancePalette('defaut', '#d6336c');
  assert.deepEqual(palette.forme, {});
  assert.equal(palette.graine, '#d6336c');
  assert.equal(ambiancePalette('defaut', 'rose'), null, 'un texte qui n\'est pas une couleur : rien ne s\'écrit');
  assert.equal(ambiancePalette('defaut', '#d6336c80'), null, 'une couleur avec opacité n\'en est pas une');
  assert.equal(ambiancePalette('pop', 'rose').clair['--accent'], ambiancePalette('pop').clair['--accent'], 'une couleur illisible est ignorée : l\'ambiance garde la sienne');
});

test('chaque jeton est un `#rrggbb` en minuscules', () => {
  for (const id of AMBIANCES) for (const hex of [null, '#6d4fd6']) {
    const palette = ambiancePalette(id, hex);
    if (!palette) continue;
    for (const mode of MODES) for (const [name, value] of Object.entries(palette[mode])) assert.ok(isHex(value), `${id} ${mode} ${name} : ${value}`);
  }
});

test('contraste de 4,5:1 au moins, en clair et en sombre, pour chaque ambiance telle quelle', () => {
  for (const id of AMBIANCES.slice(1)) {
    const low = weakest(ambiancePalette(id));
    assert.ok(low.value >= 4.5, `${id} : ${low.where} ${low.value.toFixed(2)}:1`);
  }
});

test('contraste de 4,5:1 au moins pour toute couleur libre, sur chaque ambiance', () => {
  const failures = [];
  for (const id of AMBIANCES) for (const hex of FREE) {
    const low = weakest(ambiancePalette(id, hex));
    if (low.value < 4.5) failures.push(`${id} ${hex} : ${low.where} ${low.value.toFixed(2)}:1`);
  }
  assert.deepEqual(failures, []);
});

// Les couleurs de type de chaque ambiance (décision du porteur, 04/11 : les icônes des types de fichier suivent l'ambiance). Les fonds d'une ambiance, pour une couleur libre ou non ; l'ambiance d'origine, sans
// couleur, n'écrit rien : ses fonds sont ceux de la charte.
const groundsOf = (id, hex, mode) => (ambiancePalette(id, hex) || { clair: ORIGIN.clair, sombre: ORIGIN.sombre })[mode];

// Le plus faible contraste des couleurs de type d'une ambiance : le texte de la pastille sur la carte, le fond, le fond creusé et son propre fond doux ; l'icône sur ces trois fonds et sur la ligne choisie.
function weakestType(id, hex) {
  const found = { ink: { value: Infinity, where: '' }, icon: { value: Infinity, where: '' } };
  const note = (kind, value, where) => { if (value < found[kind].value) found[kind] = { value, where }; };
  for (const mode of MODES) {
    const set = groundsOf(id, hex, mode);
    const tokens = typeTokens(id, mode);
    for (const type of TYPES) {
      const [icon, ink, soft] = ['', '-ink', '-soft'].map(part => tokens[`--t-${type}${part}`]);
      for (const back of BACKGROUNDS) {
        note('ink', ratio(ink, set[back]), `${mode} ${type} texte sur ${back}`);
        note('icon', ratio(icon, set[back]), `${mode} ${type} icône sur ${back}`);
      }
      note('ink', ratio(ink, soft), `${mode} ${type} texte sur son fond doux`);
      note('icon', ratio(icon, set['--accent-soft']), `${mode} ${type} icône sur la ligne choisie`);
    }
  }
  return found;
}

test('couleurs de type : le texte tient 4,5:1 et l\'icône 3:1 sur les fonds de chaque ambiance, avec toute couleur libre', () => {
  const failures = [];
  for (const id of AMBIANCES) for (const hex of [null, ...FREE]) {
    const low = weakestType(id, hex);
    if (low.ink.value < 4.5) failures.push(`${id} ${hex} : ${low.ink.where} ${low.ink.value.toFixed(2)}:1`);
    if (low.icon.value < 3) failures.push(`${id} ${hex} : ${low.icon.where} ${low.icon.value.toFixed(2)}:1`);
  }
  assert.deepEqual(failures, []);
});

test('couleurs de type : l\'ambiance d\'origine dit ce que css/gfs.css dit (le PDF compris), clair et sombre', () => {
  for (const mode of MODES) {
    const tokens = typeTokens('defaut', mode);
    assert.equal(Object.keys(tokens).length, 16, mode);
    for (const [name, value] of Object.entries(tokens)) assert.equal(charter[mode][name], value, `${mode} ${name}`);
  }
});

test('le bouton plein : la couleur libre telle quelle, son texte noir ou blanc, toujours lisible et toujours visible sur la carte', () => {
  const adjusted = [];
  for (const id of AMBIANCES) for (const hex of FREE) {
    const palette = ambiancePalette(id, hex);
    for (const mode of MODES) {
      const fill = palette[mode]['--accent-solid'];
      assert.ok(['#ffffff', '#0b0d12'].includes(palette[mode]['--on-accent']), `${id} ${hex} : le texte du bouton est blanc ou noir`);
      assert.ok(ratio(palette[mode]['--on-accent'], fill) >= 4.55, `${id} ${hex} ${mode} : texte du bouton ${ratio(palette[mode]['--on-accent'], fill).toFixed(2)}:1`);
      assert.ok(ratio(fill, palette[mode]['--surface']) >= 1.2, `${id} ${hex} ${mode} : le bouton se confond avec la carte (${ratio(fill, palette[mode]['--surface']).toFixed(2)}:1)`);
    }
    if (palette.clair['--accent-solid'] !== parseHex(hex)) adjusted.push(`${id} ${hex}`);
  }
  // Une couleur de teinte moyenne n'est pas touchée : le bouton prend celle de la personne.
  for (const hex of ['#d6336c', '#0f766e', '#808080', '#ff0000']) assert.equal(ambiancePalette('defaut', hex).clair['--accent-solid'], hex, hex);
  assert.ok(adjusted.length < FREE.length * AMBIANCES.length * 0.6, 'la plupart des couleurs passent telles quelles');
});

test('`ajustee` dit qu\'une couleur a bougé : le blanc et le noir, pas un rose', () => {
  assert.equal(ambiancePalette('pop', '#d6336c').ajustee, false);
  assert.equal(ambiancePalette('pop', '#ffffff').ajustee, true, 'un blanc se confondrait avec la carte');
  assert.equal(ambiancePalette('brut', '#000000').ajustee, true, 'un noir se confondrait avec la carte sombre de Brut');
  assert.equal(ambiancePalette('pop').ajustee, false);
  for (const id of AMBIANCES.slice(1)) assert.equal(ambiancePalette(id).ajustee, false, `${id} : ses couleurs sont celles qu'elle a voulues`);
});

test('le calcul est le même à chaque appel, et rend des objets neufs', () => {
  const first = ambiancePalette('pop', '#0f766e');
  assert.deepEqual(ambiancePalette('pop', '#0f766e'), first);
  first.clair['--bg'] = '#000000';
  assert.notEqual(ambiancePalette('pop', '#0f766e').clair['--bg'], '#000000');
});

test('Brut et Enseigne ont leur propre couleur de bouton, que l\'accent de lecture ne suit pas ; une couleur libre la remplace', () => {
  for (const id of ['brut', 'enseigne']) {
    const stock = ambiancePalette(id);
    assert.notEqual(stock.clair['--accent-solid'], stock.clair['--accent'], `${id} : le bouton n'a pas la couleur de l'accent de lecture`);
    assert.equal(ambiancePalette(id, '#d6336c').clair['--accent-solid'], '#d6336c', `${id} : une couleur libre devient le bouton`);
  }
  for (const id of ['pop', 'papier']) assert.equal(ambiancePalette(id).clair['--accent-solid'], ambiancePalette(id).clair['--accent'], `${id} : le bouton suit l'accent`);
});

test('la couleur libre change la couleur de l\'ambiance et laisse sa forme', () => {
  const own = ambiancePalette('papier', '#1d4ed8');
  const stock = ambiancePalette('papier');
  assert.notEqual(own.clair['--accent'], stock.clair['--accent']);
  assert.deepEqual(own.forme, stock.forme);
  assert.equal(own.graine, '#1d4ed8');
  assert.equal(stock.graine, seedOf('papier'));
  assert.equal(seedOf('defaut'), ORIGIN_SEED);
  assert.equal(seedOf('papier', 'clair'), stock.graine);
  assert.notEqual(seedOf('enseigne', 'sombre'), seedOf('enseigne', 'clair'), 'la pastille suit le mode : Enseigne est un rose profond en clair, un rose vif en sombre');
  assert.equal(seedOf('defaut', 'sombre'), ORIGIN_SEED);
});

test('l\'ambiance d\'origine de ce fichier est celle de css/gfs.css (la vignette la montre sans rien en lire)', () => {
  for (const mode of MODES) for (const [name, value] of Object.entries(ORIGIN[mode])) assert.equal(charter[mode][name], value, `${mode} ${name}`);
  assert.equal(Object.keys(ORIGIN.clair).length, 15);
});

test('la forme : chaque jeton a sa valeur d\'origine dans gfs.css et est lu par une feuille de style de GFS', () => {
  const defaults = [blockOf(':root {'), blockOf(':root, .amb-mini {')].join('\n');
  const sheets = Object.values(CSS).join('\n');
  const missing = [];
  for (const token of FORME_TOKENS) {
    if (!new RegExp(`${token}\\s*:`).test(defaults)) missing.push(`${token} : pas de valeur d'origine dans gfs.css`);
    if (!new RegExp(`var\\(${token}[,)]`).test(sheets) && !['--font-ui'].includes(token)) missing.push(`${token} : aucune règle ne le lit`);
  }
  assert.deepEqual(missing, []);
});

test('la forme : des textes de CSS sans accolade ni point-virgule qui sortirait de la valeur, et rien que des jetons connus', () => {
  for (const [id, forme] of Object.entries(FORME)) for (const [name, value] of Object.entries(forme)) {
    assert.match(name, /^--[a-z-]+$/, `${id} ${name}`);
    assert.equal(typeof value, 'string', `${id} ${name}`);
    assert.doesNotMatch(value, /[{};]|url\(|@import|expression/i, `${id} ${name} : ${value}`);
    for (const used of value.matchAll(/var\((--[a-z0-9-]+)/g)) assert.ok(COLOR_TOKENS.includes(used[1]) || used[1] === '--text' || FORME_TOKENS.includes(used[1]) || ['--border', '--bg'].includes(used[1]), `${id} ${name} lit ${used[1]}`);
  }
});

test('oklch : aller-retour, texte d\'une personne, contraste', () => {
  for (const hex of ['#2f6fed', '#ffffff', '#000000', '#d6336c', '#808080']) {
    const back = oklchToHex(hexToOklch(hex));
    assert.ok(ratio(hex, back) < 1.02, `${hex} → ${back}`);
  }
  assert.equal(parseHex('6D4FD6'), '#6d4fd6');
  assert.equal(parseHex(' #6df '), '#66ddff');
  for (const odd of ['', '#12345', '#gg0000', '#6d4fd680', null, undefined, 12, 'rouge']) assert.equal(parseHex(odd), null, String(odd));
  for (const [a, b] of [['#000000', '#ffffff'], ['#2f6fed', '#ffffff'], ['#767676', '#ffffff'], ['#5f6b7e', '#eef1f6']]) assert.ok(Math.abs(contrast(a, b) - ratio(a, b)) < 1e-9, `${a} / ${b}`);
});

test('`weakestContrast` : le plus faible contraste des paires de texte, celui que la fenêtre « Thème » annonce', () => {
  for (const id of AMBIANCES.slice(1)) {
    const palette = ambiancePalette(id);
    let oracle = Infinity;
    for (const mode of MODES) for (const [text, back] of TEXT_PAIRS) oracle = Math.min(oracle, ratio(palette[mode][text], palette[mode][back]));
    assert.ok(Math.abs(weakestContrast(palette) - oracle) < 1e-9, id);
    assert.ok(weakestContrast(palette) >= 4.5, id);
  }
  // L'ambiance d'origine n'a pas les jetons du décor : ses paires sont passées, et la charte tient sur les autres (son accent seul est à 4,2:1 sur le fond : il ne porte pas de texte).
  const origin = weakestContrast({ clair: ORIGIN.clair, sombre: ORIGIN.sombre });
  assert.ok(origin >= 4.5 && Number.isFinite(origin), `origine : ${origin}`);
  assert.ok(weakestContrast(ambiancePalette('pop', '#808080')) >= 4.5);
  assert.deepEqual(ACCENT_PAIRS.map(pair => pair[0]), ['--accent', '--accent']);
});

test('Néon est retiré (04/11) : plus d\'ambiance, plus de forme, rien ne s\'écrit', () => {
  assert.ok(!AMBIANCES.includes('neon'));
  assert.equal(ambiancePalette('neon'), null);
  assert.equal(FORME.neon, undefined);
  assert.equal(seedOf('neon'), ORIGIN_SEED, 'une ambiance inconnue : la pastille de l\'origine');
});

test('Enseigne : le halo (`--hard`) est l\'accent en sombre et la couleur du fond en clair, où il ne se voit pas ; les autres ambiances gardent leur trait fort', () => {
  const sign = ambiancePalette('enseigne');
  assert.equal(sign.sombre['--hard'], sign.sombre['--accent']);
  assert.equal(sign.clair['--hard'], sign.clair['--bg'], 'en clair rien ne brille : l\'enseigne de jour');
  for (const id of ['pop', 'papier', 'brut']) assert.equal(ambiancePalette(id).clair['--hard'], ambiancePalette(id).clair['--border-strong'], id);
});

test('l\'accessibilité renforcée : le texte à 7:1 et chaque trait à 3:1 au moins, sur chaque ambiance, avec ou sans couleur libre, en clair et en sombre', () => {
  const failures = [];
  for (const id of AMBIANCES) for (const hex of [null, ...FREE]) {
    const palette = ambiancePalette(id, hex, { renforcee: true });
    if (!palette) { failures.push(`${id} ${hex} : rien ne s'écrit`); continue; }
    const text = weakest(palette, { fixed: false });
    const edge = weakestEdge(palette);
    if (text.value < 7) failures.push(`${id} ${hex} : ${text.where} ${text.value.toFixed(2)}:1`);
    if (edge < 3) failures.push(`${id} ${hex} : un trait à ${edge.toFixed(2)}:1`);
    assert.ok(weakestContrast(palette) >= 7, `${id} ${hex} : la mesure annoncée tient 7:1`);
  }
  assert.deepEqual(failures, []);
});

test('l\'accessibilité renforcée garde la couleur de l\'ambiance et prend la forme du mode renforcé, jamais celle de l\'ambiance', () => {
  for (const id of AMBIANCES) {
    const strict = ambiancePalette(id, null, { renforcee: true });
    assert.ok(strict, `${id} : l'origine aussi s'écrit, avec son bleu`);
    assert.deepEqual(strict.forme, FORME[RENFORCEE], id);
    for (const mode of MODES) assert.deepEqual(Object.keys(strict[mode]).sort(), [...COLOR_TOKENS].sort(), `${id} ${mode}`);
  }
  assert.equal(RENFORCEE, 'renforcee');
  // La couleur reste celle de l'ambiance : la teinte de l'accent ne bouge pas, seule sa clarté s'ajuste.
  for (const id of ['pop', 'papier', 'brut', 'enseigne']) for (const mode of MODES) {
    const plain = hexToOklch(ambiancePalette(id)[mode]['--accent']);
    const strict = hexToOklch(ambiancePalette(id, null, { renforcee: true })[mode]['--accent']);
    const turn = Math.abs(((plain.h - strict.h + 540) % 360) - 180);
    assert.ok(turn < 8, `${id} ${mode} : la teinte de l'accent a tourné de ${turn.toFixed(1)}°`);
  }
  // Sans le réglage, rien ne change : l'origine ne s'écrit toujours pas, une ambiance inconnue non plus.
  assert.equal(ambiancePalette('defaut', null, { renforcee: false }), null);
  assert.equal(ambiancePalette('inconnue', null, { renforcee: true }), null);
  assert.equal(ambiancePalette('defaut', 'rose', { renforcee: true })?.graine, ORIGIN_SEED, 'un texte qui n\'est pas une couleur : le bleu d\'origine');
  // La couleur libre de la personne passe devant celle de l'ambiance, et l'accessibilité renforcée la tient aussi.
  assert.equal(ambiancePalette('pop', '#0f766e', { renforcee: true }).graine, '#0f766e');
});

test('l\'accessibilité renforcée monte les traits : plus haut que l\'ambiance telle quelle, et `weakestEdge` est le plus faible des traits sur les fonds', () => {
  for (const id of AMBIANCES.slice(1)) {
    const plain = weakestEdge(ambiancePalette(id));
    const strict = ambiancePalette(id, null, { renforcee: true });
    assert.ok(weakestEdge(strict) >= 3 && weakestEdge(strict) > plain, `${id} : ${plain.toFixed(2)} → ${weakestEdge(strict).toFixed(2)}`);
    let oracle = Infinity;
    for (const mode of MODES) for (const line of ['--border-strong', '--border']) for (const back of ['--bg', '--surface', '--surface-sunken']) oracle = Math.min(oracle, ratio(strict[mode][line], strict[mode][back]));
    assert.ok(Math.abs(weakestEdge(strict) - oracle) < 1e-9, id);
  }
  assert.ok(weakestEdge({ clair: ORIGIN.clair, sombre: ORIGIN.sombre }) < 2, 'le trait des champs d\'origine est à 1,5:1 : c\'est ce que le mode renforcé corrige');
});

test('la forme du mode renforcé tient ses promesses : traits de 2 px, barre de 6 px, aucun décor (trame, filet, ombre, dégradé), ni capitales ni lettres espacées', () => {
  const forme = FORME[RENFORCEE];
  assert.equal(forme['--bw'], '2px');
  assert.equal(forme['--bar-w'], '6px');
  assert.equal(forme['--divider-w'], '2px');
  for (const token of ['--wash', '--shadow-ctl', '--shadow-panel', '--shadow-float', '--stripe']) assert.equal(forme[token], 'none', token);
  assert.equal(forme['--stripe-h'], '0px');
  assert.equal(forme['--tt-head'], 'none');
  assert.equal(forme['--ls-head'], 'normal');
  assert.equal(forme['--ls-label'], 'normal');
  assert.equal(forme['--fill'], 'var(--accent-solid)', 'le bouton plein est uni');
  assert.doesNotMatch(Object.values(forme).join(' '), /gradient|blur|color-mix/, 'ni dégradé, ni halo, ni mélange');
});

test('css/gfs.css : en accessibilité renforcée, le texte d\'état et de type prend celui de la page (7:1), après les deux blocs sombres', () => {
  const rule = CSS.gfs.indexOf(':root[data-ambiance="renforcee"] {');
  assert.ok(rule > CSS.gfs.indexOf(':root[data-grist-appearance="dark"] {'), 'après le bloc sombre de Grist : à poids égal, le dernier gagne');
  assert.ok(rule > CSS.gfs.indexOf(':root:not([data-grist-appearance="light"]) {'), 'après le bloc sombre du système');
  const block = CSS.gfs.slice(CSS.gfs.indexOf('{', rule) + 1, CSS.gfs.indexOf('}', rule));
  const tokens = Object.fromEntries([...block.matchAll(/(--[a-z-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
  assert.deepEqual(Object.keys(tokens).sort(), [...FIXED, ...TYPES.map(type => `--t-${type}-ink`)].sort(), 'le texte d\'état et celui des quatre types : les couleurs que l\'ambiance ne règle pas à 7:1');
  for (const value of Object.values(tokens)) assert.equal(value, 'var(--text)');
});

// En accessibilité renforcée, le message a l'`id` `renforcee` et aucune couleur de type n'est posée avec lui (js/ambiance-types.js n'a pas d'entrée `renforcee`) : les feuilles de style disent celles d'origine.
// Le texte de type est celui de la page (la règle ci-dessus) ; l'icône garde sa couleur, et tient 3:1 sur les fonds de l'ambiance renforcée, avec toute couleur libre.
test('accessibilité renforcée : pas de couleurs de type propres, et l\'icône d\'origine tient 3:1 sur les fonds de chaque ambiance renforcée et de toute couleur libre', () => {
  assert.deepEqual(typeTokens(RENFORCEE, 'clair'), {});
  assert.deepEqual(typeTokens(RENFORCEE, 'sombre'), {});
  const failures = [];
  for (const id of AMBIANCES) for (const hex of [null, ...FREE]) {
    const palette = ambiancePalette(id, hex, { renforcee: true });
    for (const mode of MODES) {
      const tokens = typeTokens('defaut', mode);
      for (const type of TYPES) for (const back of [...BACKGROUNDS, '--accent-soft']) {
        const value = ratio(tokens[`--t-${type}`], palette[mode][back]);
        if (value < 3) failures.push(`${id} ${hex} ${mode} : l'icône ${type} sur ${back} ${value.toFixed(2)}:1`);
      }
    }
  }
  assert.deepEqual(failures, []);
});
