// Les feuilles de style : les fenêtres n'ont que les trois largeurs de la charte (400 px, 480 px, grande : 960 px plafonnés au panneau), par les jetons `--win-s`, `--win-m` et `--win-l`, et un cadre de 8 px de
// rayon (décision du porteur du 09/11). Les mesures de Firefox (test/fenetres-firefox.mjs) couvrent les fenêtres que la page d'essai ouvre ; celle-ci couvre toutes, « Thème » comprise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';

const sheets = readdirSync(join(ROOT, 'css')).filter(name => name.endsWith('.css')).map(name => [name, readFileSync(join(ROOT, 'css', name), 'utf8')]);
const css = sheets.map(([, text]) => text).join('\n');

test('trois jetons de largeur : 400, 480 et 960 px', () => {
  for (const [token, value] of [['--win-s', '400px'], ['--win-m', '480px'], ['--win-l', '960px']]) assert.match(css, new RegExp(`${token}:\\s*${value}`), token);
});

test('toute fenêtre (.mod…) prend sa largeur d\'un jeton, plafonnée à la place : min(var(--win-…), 100%)', () => {
  const bad = [];
  for (const [name, text] of sheets) {
    for (const rule of text.matchAll(/(^|\})\s*(\.mod(?:\.[\w-]+)*)\s*\{([^}]*)\}/g)) {
      const width = /(?<![-\w])width:\s*([^;]+);/.exec(rule[3]);
      if (width && !/^min\(var\(--win-[sml]\),\s*100%\)$/.test(width[1].trim())) bad.push(`${name} ${rule[2]} : width ${width[1].trim()}`);
    }
  }
  assert.deepEqual(bad, []);
  // La règle de base elle-même doit exister, sinon la boucle ci-dessus ne vérifierait rien.
  assert.match(css, /\.mod\s*\{[^}]*width:\s*min\(var\(--win-l\),\s*100%\)/);
});

test('le cadre d\'une fenêtre a 8 px de rayon (jeton --radius-lg), les ambiances le redisent à leur façon', () => {
  const root = /:root, \.amb-mini \{([^}]*)\}/.exec(readFileSync(join(ROOT, 'css', 'gfs.css'), 'utf8'));
  assert.ok(root, 'le bloc des jetons');
  assert.match(root[1], /--radius-lg:\s*8px/);
  assert.match(css, /\.mod\s*\{[^}]*border-radius:\s*var\(--radius-lg\)/);
});
