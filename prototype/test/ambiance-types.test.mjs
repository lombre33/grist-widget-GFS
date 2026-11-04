// Les couleurs de type de chaque ambiance (décision du porteur, 04/11 : « adapter les icônes des types de fichier aussi au thème », et une icône colorée pour le PDF) : leur forme, leurs teintes, et les
// règles de l'explorateur qui les lisent. Leur contraste (4,5:1 pour le texte, 3:1 pour l'icône, avec toute couleur libre) et leur accord avec css/gfs.css sont mesurés avec les ambiances (test/ambiance.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AMBIANCES } from '../js/ambiance.js';
import { TYPES, TYPE_TOKENS, typeTokens } from '../js/ambiance-types.js';
import { hexToOklch, isHex } from '../js/oklch.js';

const MODES = ['clair', 'sombre'];
const read = name => readFileSync(new URL(`../css/${name}`, import.meta.url), 'utf8');

test('quatre types, quatre jetons chacun : le document, la grille, la présentation et le PDF', () => {
  assert.deepEqual(TYPES, ['doc', 'grid', 'slides', 'pdf']);
  assert.equal(TYPE_TOKENS.length, 16);
  for (const type of TYPES) for (const part of ['', '-ink', '-soft', '-line']) assert.ok(TYPE_TOKENS.includes(`--t-${type}${part}`), `--t-${type}${part}`);
});

test('typeTokens : les seize jetons en `#rrggbb` pour chaque ambiance et chaque mode ; une ambiance ou un mode inconnu ne pose rien', () => {
  for (const id of AMBIANCES) for (const mode of MODES) {
    const tokens = typeTokens(id, mode);
    assert.deepEqual(Object.keys(tokens).sort(), [...TYPE_TOKENS].sort(), `${id} ${mode}`);
    for (const [name, value] of Object.entries(tokens)) assert.ok(isHex(value), `${id} ${mode} ${name} : ${value}`);
  }
  for (const odd of ['', 'inconnue', null, undefined, 'POP', '__proto__', 'constructor']) assert.deepEqual(typeTokens(odd, 'clair'), {}, String(odd));
  for (const odd of ['', 'light', null, undefined, '__proto__']) assert.deepEqual(typeTokens('pop', odd), {}, String(odd));
});

test('typeTokens rend des objets neufs : on ne change pas les couleurs d\'une ambiance en changeant le résultat', () => {
  const first = typeTokens('pop', 'clair');
  first['--t-pdf'] = '#000000';
  assert.notEqual(typeTokens('pop', 'clair')['--t-pdf'], '#000000');
});

// Les quatre familles gardent leur teinte d'une ambiance à l'autre (OKLCH, en degrés) : le bleu, le vert, l'orange et le rouge se reconnaissent partout, seule leur nuance suit l'ambiance.
const HUES = { doc: [235, 285], grid: [135, 175], slides: [35, 95] };
const inHues = (type, hue) => (type === 'pdf' ? hue >= 340 || hue <= 45 : hue >= HUES[type][0] && hue <= HUES[type][1]);

test('les quatre familles gardent leur teinte dans chaque ambiance : bleu, vert, orange, rouge', () => {
  const off = [];
  for (const id of AMBIANCES) for (const mode of MODES) {
    const tokens = typeTokens(id, mode);
    for (const type of TYPES) for (const part of ['', '-ink']) {
      const { h } = hexToOklch(tokens[`--t-${type}${part}`]);
      if (!inHues(type, h)) off.push(`${id} ${mode} ${type}${part} : teinte ${h.toFixed(0)}°`);
    }
  }
  assert.deepEqual(off, []);
});

// L'écart de deux couleurs dans OKLab : en dessous, deux types se confondent d'un coup d'œil.
const lab = hex => { const { L, C, h } = hexToOklch(hex); return [L, C * Math.cos(h * Math.PI / 180), C * Math.sin(h * Math.PI / 180)]; };
const gap = (a, b) => Math.hypot(...lab(a).map((value, i) => value - lab(b)[i]));

test('les quatre types se distinguent l\'un de l\'autre dans chaque ambiance et chaque mode', () => {
  const close = [];
  for (const id of AMBIANCES) for (const mode of MODES) {
    const tokens = typeTokens(id, mode);
    for (let i = 0; i < TYPES.length; i++) for (let j = i + 1; j < TYPES.length; j++) {
      const value = gap(tokens[`--t-${TYPES[i]}`], tokens[`--t-${TYPES[j]}`]);
      if (value < 0.1) close.push(`${id} ${mode} ${TYPES[i]} / ${TYPES[j]} : écart ${value.toFixed(3)}`);
    }
  }
  assert.deepEqual(close, []);
});

test('chaque ambiance a ses propres couleurs de type (l\'origine, Pop, Papier, Brut, Enseigne ne se ressemblent pas)', () => {
  for (const mode of MODES) {
    const seen = new Map();
    for (const id of AMBIANCES) {
      const key = JSON.stringify(typeTokens(id, mode));
      assert.ok(!seen.has(key), `${id} ${mode} a les couleurs de ${seen.get(key)}`);
      seen.set(key, id);
    }
  }
});

test('explorer.css lit une famille par type : la règle `[data-fam]` qui pose les quatre jetons du type', () => {
  const css = read('explorer.css');
  for (const type of TYPES) {
    const rule = css.match(new RegExp(`\\[data-fam="${type}"\\]\\s*\\{([^}]*)\\}`));
    assert.ok(rule, `explorer.css n'a pas de règle pour la famille ${type}`);
    for (const [token, part] of [['--tc', ''], ['--tc-ink', '-ink'], ['--tc-soft', '-soft'], ['--tc-line', '-line']]) {
      assert.ok(new RegExp(`${token}:\\s*var\\(--t-${type}${part}\\)`).test(rule[1]), `${type} : ${token} ne lit pas --t-${type}${part}`);
    }
  }
});

test('gfs.css dit les seize jetons de type dans ses trois blocs (clair, sombre de Grist, sombre du système)', () => {
  const css = read('gfs.css');
  const blocks = [css.indexOf(':root {'), css.indexOf(':root:not([data-grist-appearance="light"]) {'), css.indexOf(':root[data-grist-appearance="dark"] {')];
  assert.ok(blocks.every(at => at >= 0), 'les trois blocs sont là');
  for (const at of blocks) {
    const body = css.slice(css.indexOf('{', at), css.indexOf('}', at));
    for (const token of TYPE_TOKENS) assert.ok(new RegExp(`${token}:\\s*#[0-9a-f]{6}`, 'i').test(body), `${token} manque dans le bloc qui commence par ${css.slice(at, at + 40).split('\n')[0]}`);
  }
});
