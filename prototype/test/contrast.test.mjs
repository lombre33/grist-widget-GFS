// La charte demande 4,5:1 en clair et en sombre : les jetons de css/gfs.css, pris par paires texte / fond comme les feuilles de style les emploient.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../css/gfs.css', import.meta.url), 'utf8');

// Les jetons d'un bloc : « --nom: valeur; ».
function tokens(block) {
  const out = {};
  for (const [, name, value] of block.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)) out[name] = value;
  return out;
}
// Le bloc qui suit un sélecteur, accolades comprises.
function blockAfter(selector) {
  const start = css.indexOf(selector);
  assert.notEqual(start, -1, `${selector} absent de gfs.css`);
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}' && --depth === 0) return css.slice(css.indexOf('{', start) + 1, i);
  }
  return '';
}

const light = tokens(blockAfter(':root {'));
const dark = { ...light, ...tokens(blockAfter(':root[data-grist-appearance="dark"] {')) };
const darkSystem = { ...light, ...tokens(blockAfter('@media (prefers-color-scheme: dark)')) };

const channel = value => { const v = value / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const luminance = hex => { const n = parseInt(hex.slice(1), 16); return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255); };
export const ratio = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

// [texte, fond] : ce que explorer.css, modules.css et gfs.css posent l'un sur l'autre.
const PAIRS = [
  ['--text', '--surface'], ['--text', '--bg'], ['--text', '--surface-sunken'], ['--text', '--accent-soft'],
  ['--text-muted', '--surface'], ['--text-muted', '--surface-sunken'], ['--text-muted', '--bg'], ['--text-muted', '--accent-soft'],
  ['--accent-ink', '--surface'], ['--accent-ink', '--accent-soft'], ['--on-accent', '--accent-solid'], ['--on-accent', '--solid-neutral'],
  ['--good', '--good-soft'], ['--good', '--surface'],
  ['--warn-ink', '--warn-soft'], ['--warn-ink', '--surface'],
  ['--danger-ink', '--surface'], ['--danger-ink', '--danger-soft'],
  ['--t-doc-ink', '--t-doc-soft'], ['--t-doc-ink', '--surface'], ['--t-grid-ink', '--t-grid-soft'], ['--t-grid-ink', '--surface'],
  ['--t-slides-ink', '--t-slides-soft'], ['--t-slides-ink', '--surface'],
];

for (const [name, set] of [['clair', light], ['sombre (réglage de Grist)', dark], ['sombre (système)', darkSystem]]) {
  test(`contraste de 4,5:1 au moins en ${name}`, () => {
    const failures = [];
    for (const [text, background] of PAIRS) {
      assert.ok(set[text] && set[background], `jeton absent : ${text} ou ${background}`);
      const value = ratio(set[text], set[background]);
      if (value < 4.5) failures.push(`${text} sur ${background} : ${value.toFixed(2)}:1`);
    }
    assert.deepEqual(failures, []);
  });
}

test('le thème sombre posé par Grist et celui du système disent la même chose', () => {
  for (const key of Object.keys(dark)) assert.equal(darkSystem[key], dark[key], `${key} diffère entre les deux thèmes sombres`);
});
