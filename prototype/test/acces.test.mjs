// L'accessibilité renforcée, second temps (décision du porteur du 04/11, feu vert du 10/11 ; css/acces.css), sans navigateur : les garde-fous qui tiennent la promesse d'une feuille à l'autre. Ce que Firefox calcule
// (le texte, les cibles, la barre, le mouvement, le contraste forcé) est mesuré par test/acces-firefox.mjs, et l'anneau de focus, que le Firefox sans écran ne peut pas montrer, par labo/run-acces.mjs (vrai Grist).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';
import { Dock } from '../js/dock.js';
import { FORME_TOKENS } from '../js/ambiance-forme.js';

const cssDir = join(ROOT, 'css');
const sheets = readdirSync(cssDir).filter(name => name.endsWith('.css')).map(name => ({ name, text: readFileSync(join(cssDir, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '') }));
const sheet = name => sheets.find(one => one.name === name).text;

// Les éléments d'une liste de sélecteurs, séparés aux virgules du premier niveau (celles d'un `:is(…)` n'en font pas).
function listOf(selector) {
  const parts = [];
  let depth = 0;
  let start = 0;
  [...selector].forEach((char, index) => {
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (char === ',' && depth === 0) { parts.push(selector.slice(start, index).trim()); start = index + 1; }
  });
  parts.push(selector.slice(start).trim());
  return parts;
}

// Les règles à plat d'une feuille (les règles d'un bloc `@media` comprises) : { selector, body }.
function rules(text) {
  return [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({ selector: selector.trim(), body })).filter(rule => !rule.selector.startsWith('@'));
}

// Ce que le texte fait de petit : le dessin d'une vignette d'ambiance (`.mn-t`, 9,5 px) n'est pas du texte à lire.
const PICTURES = ['.mn-t'];

test('chaque taille de texte de GFS sous 14 px se lit `max(Npx, var(--fs-min))` : l\'accessibilité renforcée monte le plancher à 14 px, et rien ne change sans elle', () => {
  const bad = [];
  for (const { name, text } of sheets) {
    for (const { selector, body } of rules(text)) {
      if (PICTURES.includes(selector)) continue;
      for (const [, value] of body.matchAll(/(?:^|[;\s])font-size:\s*([^;]+)/g)) {
        const plain = value.trim().match(/^([\d.]+)px$/);
        if (plain && Number(plain[1]) < 14) bad.push(`${name} : ${selector} { font-size: ${value.trim()} }`);
      }
      for (const [, size] of body.matchAll(/(?:^|[;\s])font:\s*(?:[\w-]+\s+)*([\d.]+)px/g)) {
        if (Number(size) < 14 && !/font-size:\s*max\(/.test(body)) bad.push(`${name} : ${selector} { font: ${size}px… } sans « font-size: max(…) » après lui`);
      }
    }
  }
  assert.deepEqual(bad, [], 'chaque taille sous 14 px passe par `max(Npx, var(--fs-min))`');
});

test('la garde n\'est pas vide : la feuille de l\'explorateur écrit bien ses tailles par `max(…, var(--fs-min))`, et le plancher vaut 0 d\'origine, 14 px avec l\'interrupteur', () => {
  assert.ok((sheet('explorer.css').match(/font-size: max\([\d.]+px, var\(--fs-min\)\)/g) || []).length > 20);
  assert.match(sheet('gfs.css'), /:root, \.amb-mini \{[^}]*--fs-min: 0px;/, 'la vignette d\'ambiance repart de zéro : c\'est un dessin');
  assert.match(sheet('acces.css'), /:root\[data-ambiance="renforcee"\] \{[^}]*--fs-min: 14px;/, 'à 14 px avec l\'interrupteur : la règle des couleurs d\'état de gfs.css n\'en porte aucun autre (test/ambiance.test.mjs)');
});

test('css/acces.css : hors du contraste forcé (un réglage du système), chaque règle est sous `data-ambiance="renforcee"` : sans l\'interrupteur, rien ne change', () => {
  const text = sheet('acces.css');
  const forced = text.indexOf('@media (forced-colors: active)');
  assert.ok(forced > 0, 'la feuille a son bloc de contraste forcé');
  const bare = [];
  for (const { selector } of rules(text.slice(0, forced))) {
    for (const one of listOf(selector)) if (!one.startsWith(':root[data-ambiance="renforcee"]')) bare.push(one);
  }
  assert.deepEqual(bare, []);
  assert.equal(text.slice(forced).split('@media').length, 2, 'le contraste forcé est le dernier bloc, et le seul');
});

// Mesuré dans un vrai Grist le 10/11 : sans ce préfixe, `:root[data-ambiance="renforcee"] .ls-row { border-left: … transparent }` (poids 0,3,0) l'emportait sur `.ls-row { border-left: … Canvas }` du contraste forcé, et la barre de la ligne
// choisie prenait la même couleur du système que ses voisines : elle ne se lisait plus.
test('le contraste forcé pèse autant que l\'accessibilité renforcée : chacune de ses règles commence par `:is(:root, :root[data-ambiance="renforcee"])`', () => {
  const text = sheet('acces.css');
  const block = text.slice(text.indexOf('@media (forced-colors: active)'));
  const bare = [];
  for (const { selector } of rules(block)) {
    for (const one of listOf(selector)) if (!one.startsWith(':is(:root, :root[data-ambiance="renforcee"]) ')) bare.push(one);
  }
  assert.deepEqual(bare, []);
  assert.ok(rules(block).length >= 10, 'le bloc n\'est pas vide');
});

test('la case d\'une app ou d\'une extension (22 px) se coche par son nom, qui fait 36 px : la cible est le nom', () => {
  assert.match(sheet('acces.css'), /:root\[data-ambiance="renforcee"\] \.mr-title label \{ min-height: var\(--target\); \}/);
});

test('css/acces.css est la dernière feuille de la page : à poids égal, c\'est la dernière qui gagne', () => {
  const links = readFileSync(join(ROOT, 'index.html'), 'utf8').match(/<link rel="stylesheet" href="([^"?]+)/g).map(link => link.replace(/.*href="/, ''));
  assert.equal(links.at(-1), 'css/acces.css');
});

test('le mouvement : avec l\'interrupteur ou avec le réglage du système, plus de transition, d\'animation ni de défilement doux, y compris sur les pseudo-éléments', () => {
  const acces = sheet('acces.css');
  assert.match(acces, /:root\[data-ambiance="renforcee"\] \*, :root\[data-ambiance="renforcee"\] \*::before, :root\[data-ambiance="renforcee"\] \*::after \{[^}]*transition: none !important; animation: none !important; scroll-behavior: auto !important;/);
  assert.match(sheet('gfs.css'), /@media \(prefers-reduced-motion: reduce\) \{ \*, \*::before, \*::after \{ transition: none !important; animation: none !important; scroll-behavior: auto !important; \} \}/);
});

test('le second temps n\'ajoute aucun jeton au message des apps : ni `--fs-min` ni `--target` ne sont des jetons de forme (le kit n\'a rien à changer, une app qui veut la même chose lit l\'`id` `renforcee`)', () => {
  assert.deepEqual(FORME_TOKENS.filter(token => /^--(fs-min|target)/.test(token)), []);
});

// La barre de GFS (css/gfs.css : 36 px par bouton avec l'accessibilité renforcée) change de taille sans que le cadre bouge : la zone que l'app doit laisser libre se relit alors, la barre est donc observée comme la scène.
test('la barre de GFS : le cadre ET la barre sont observés, pour que la zone dite à l\'app suive la taille de la barre', () => {
  const observed = [];
  const node = () => ({ setAttribute() {}, append() {} });
  globalThis.document = { createElementNS: node, createElement: node };
  class FakeObserver { constructor(callback) { this.callback = callback; } observe(target) { observed.push(target); } }
  const button = () => ({ addEventListener() {}, setAttribute() {}, replaceChildren() {}, dataset: {} });
  const root = { querySelector: () => button(), dataset: {}, setAttribute() {}, hidden: false, getBoundingClientRect: () => ({ left: 0, top: 0, width: 36, height: 150 }) };
  const stage = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 700, height: 400 }) };
  const win = { ResizeObserver: FakeObserver, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, addEventListener() {}, removeEventListener() {} };
  new Dock({ root, stage, onFiles() {}, onApps() {}, onWork() {}, onNotKept() {}, win });
  assert.deepEqual(observed, [stage, root]);
});
