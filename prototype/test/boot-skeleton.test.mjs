// Le squelette de l'explorateur (27/11, demande du porteur : « une impression de fluidité à chaque ouverture » ; index.html `#boot`, css/gfs.css `.boot`,
// js/shell/boot-skeleton.js) : ce qui est dans la page avant que le code ait fini de lire le document. Ce que la personne voit (barres de gris, clair et sombre,
// 700 × 400, français et anglais) se mesure sous Chromium et Firefox : labo/run-squelette.mjs, test/squelette-firefox.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';
import { removeSkeleton } from '../js/shell/boot-skeleton.js';

const page = readFileSync(join(ROOT, 'index.html'), 'utf8');
const css = readFileSync(join(ROOT, 'css/gfs.css'), 'utf8');
const start = page.indexOf('<div class="ex boot" id="boot"');
const stop = page.indexOf('<div class="frames"');
const skeleton = start >= 0 ? page.slice(start, stop) : '';

test('la page porte le squelette, premier dans la scène, caché des lecteurs d\'écran', () => {
  assert.ok(start > 0, 'le squelette est dans index.html');
  assert.match(page.slice(page.indexOf('<main class="stage" id="stage">'), start), /^<main class="stage" id="stage">\s*(<!--[\s\S]*?-->\s*)?$/, 'avant les cadres des apps');
  assert.match(skeleton, /^<div class="ex boot" id="boot" aria-hidden="true">/);
});

test('le squelette ne dit rien : aucun texte, aucun style en ligne, rien à cliquer', () => {
  const block = skeleton.replace(/<!--[\s\S]*?-->/g, '');
  assert.equal(block.replace(/<[^>]*>/g, '').trim(), '', 'aucun texte');
  assert.equal(/\sstyle=/.test(block), false, 'la politique de sécurité interdit le style en ligne');
  assert.equal(/<(button|input|a|label|select|textarea)\b/.test(block), false, 'rien de focalisable');
  assert.equal(/\stabindex=/.test(block), false);
});

test('le squelette reprend la grille de l\'explorateur : en-tête, volet, liste, pied', () => {
  for (const name of ['ex-head', 'ex-title-row', 'ex-nav-row', 'ex-body', 'ex-tree', 'ex-main', 'ex-scroll', 'ex-foot', 'ex-info']) assert.ok(skeleton.includes(`class="${name}"`) || skeleton.includes(`"${name} `), name);
  assert.ok((skeleton.match(/class="boot-row"/g) || []).length >= 8, 'de quoi remplir 400 px de haut');
  assert.ok(skeleton.includes('class="boot-row boot-th"'), 'la ligne d\'en-tête de la liste : les lignes tombent à la hauteur des vraies');
});

test('le squelette passe sous les cadres des apps et sous l\'explorateur, et ne reçoit aucun geste', () => {
  const rule = css.match(/\.ex\.boot \{([^}]*)\}/);
  assert.ok(rule, 'la règle du squelette');
  assert.match(rule[1], /z-index:\s*0\b/, 'sous `--z-frames` (1) : tout ce qui arrive le recouvre');
  assert.match(rule[1], /pointer-events:\s*none/);
  assert.match(css, /--z-frames:\s*1;/);
});

test('les couleurs du squelette sont des jetons : aucune couleur en dur', () => {
  const rules = css.split('\n').filter(line => /^\.(ex\.boot|boot-[a-z]+|boot )/.test(line)).join('\n');
  assert.ok(rules.length > 0);
  assert.equal(/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(rules), false, rules);
});

test('removeSkeleton retire le squelette, et ne dit rien quand il n\'y est plus', () => {
  const removed = [];
  const node = { remove: () => removed.push('boot') };
  const doc = { getElementById: id => (id === 'boot' ? node : null) };
  removeSkeleton(doc);
  assert.deepEqual(removed, ['boot']);
  assert.doesNotThrow(() => removeSkeleton({ getElementById: () => null }));
});

test('GFS retire le squelette quand il est prêt, hors de Grist, et quand il ne démarre pas', () => {
  const controller = readFileSync(join(ROOT, 'js/controller.js'), 'utf8');
  assert.match(controller, /dataset\.gfs = 'ready';\s*removeSkeleton\(doc\);/);
  assert.match(controller, /dataset\.gfs = 'standalone'; removeSkeleton\(doc\)/);
  assert.match(readFileSync(join(ROOT, 'js/gfs.js'), 'utf8'), /démarrage impossible[\s\S]*removeSkeleton\(\)/);
});

test('la garde de démarrage retire le squelette avant de poser sa phrase', () => {
  const guard = readFileSync(join(ROOT, 'js/shell/boot-guard.js'), 'utf8');
  const render = guard.slice(guard.indexOf('function render('), guard.indexOf('function detailOf('));
  const removal = render.indexOf("getElementById('boot')");
  assert.ok(removal > 0, 'la phrase retire le squelette');
  assert.ok(removal < render.indexOf('appendChild(box)'), 'avant de se poser');
});
