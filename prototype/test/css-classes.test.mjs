// Une classe de l'explorateur n'est stylée que par la feuille de l'explorateur. Le 03/11, la vignette d'une ambiance (`div.mn.amb-mini`) a pris `mn`, la classe du bouton « ⋯ » d'une ligne
// (`.rb.mn`), dans css/modules.css, chargée après celle de l'explorateur : chaque « ⋯ » est devenu une boîte bordée de 58 px, et la souris, sur une ligne, tombait sur le bouton de la ligne du dessus.
// La première moitié de ce fichier garde ces trois noms ; la seconde généralise : entre la feuille de l'explorateur et celle des fenêtres, une classe nommée seule a un seul propriétaire (`th-grid` avait
// le même défaut : la grille des vignettes de l'explorateur recevait les cinq colonnes de la fenêtre « Thème »). La mesure dans un navigateur est labo/run-liste.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';

const dir = new URL('../css/', import.meta.url);
const sheets = readdirSync(dir).filter(name => name.endsWith('.css')).map(name => ({ name, text: readFileSync(new URL(name, dir), 'utf8') }));

// Les sélecteurs d'une feuille (sans commentaires, sans corps de règle ni ligne @media / @keyframes) : un par élément de chaque liste.
function selectors(text) {
  const out = [];
  for (const [, head] of text.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)) {
    if (!head.trim().startsWith('@')) out.push(...head.split(',').map(one => one.trim()));
  }
  return out;
}

// Les classes que js/explorer-view.js donne aux boutons d'une ligne (`rb pin`, `rb mn`) : seule css/explorer.css a le droit de les nommer. `.mn-p` et ses pareilles sont d'autres classes.
const ROW_BUTTON_CLASSES = ['rb', 'mn', 'pin'];
const names = (selector, name) => new RegExp(`\\.${name}(?![\\w-])`).test(selector);

test('les classes des boutons d\'une ligne de l\'explorateur ne sont reprises par aucune autre feuille', () => {
  const taken = [];
  for (const { name, text } of sheets) {
    if (name === 'explorer.css') continue;
    for (const selector of selectors(text)) for (const cls of ROW_BUTTON_CLASSES) if (names(selector, cls)) taken.push(`${name} : ${selector} (.${cls})`);
  }
  assert.deepEqual(taken, []);
});

test('la garde n\'est pas vide : l\'explorateur nomme bien ces classes, dans son code et dans sa feuille', () => {
  const view = readFileSync(new URL('../js/explorer-view.js', import.meta.url), 'utf8');
  const explorer = selectors(sheets.find(sheet => sheet.name === 'explorer.css').text);
  for (const cls of ROW_BUTTON_CLASSES) {
    assert.match(view, new RegExp(`class: [\`']rb[^\`']*\\b${cls}\\b|class: [\`']${cls}\\b`), `.${cls} n'est plus une classe de l'explorateur : mettre la liste à jour`);
    assert.ok(explorer.some(selector => names(selector, cls)), `explorer.css ne nomme plus .${cls}`);
  }
});

// ---- Une classe, un propriétaire : la liste de l'explorateur (css/explorer.css) et les fenêtres (css/modules.css) ----
// Ce test lit les classes que les modules construisent (`class: '…'`) et celles qu'une feuille nomme seule (`.nom`, `.nom:hover`, `.nom[attribut]`, et non `.liste .nom` ou `.btn.sm`, qui complètent une
// classe d'ailleurs).
const EXPLORER = ['js/explorer-view.js', 'js/explorer.js'];
// Les fenêtres : les modules dont le nom finit par `-window.js`, ceux qui ouvrent une fenêtre sur la base commune (ils importent js/modal.js), la base elle-même et les morceaux de la fenêtre « Ligne de travail ».
const WINDOWS = readdirSync(join(ROOT, 'js')).map(name => `js/${name}`).filter(file => /-window\.js$/.test(file) || ['js/modal.js', 'js/work-row.js', 'js/work-control.js'].includes(file)
  || /from '\.\/modal\.js'/.test(readFileSync(join(ROOT, file), 'utf8')));
// Partagées exprès : le bouton, le champ de recherche (la fenêtre « Ligne de travail » le reprend) et le filet de couleur que l'ambiance pose en tête de la liste et des fenêtres.
const SHARED = new Set(['btn', 'inp-search', 'mod']);

// Les classes que construisent des modules : tout `class: '…'` ou `class: \`…\`` ; les mots entre guillemets d'une expression `${…}` comptent.
function builtClasses(files) {
  const found = new Set();
  const words = text => { for (const word of text.split(/\s+/)) if (/^[A-Za-z][\w-]*$/.test(word)) found.add(word); };
  for (const file of files) {
    const source = readFileSync(join(ROOT, file), 'utf8');
    for (const [, quoted, template] of source.matchAll(/\bclass:\s*(?:'([^']*)'|`([^`]*)`)/g)) {
      if (quoted !== undefined) { words(quoted); continue; }
      words(template.replace(/\$\{[^}]*\}/g, ' '));
      for (const [, expression] of template.matchAll(/\$\{([^}]*)\}/g)) for (const [, literal] of expression.matchAll(/'([^']*)'/g)) words(literal);
    }
  }
  return found;
}

// Les classes qu'une feuille nomme seule : une règle dont le sélecteur est `.nom`, avec au plus des états (`:hover`, `::before`, `:has(…)`) ou des attributs.
const ALONE = /^\.([A-Za-z][\w-]*)(?:\[[^\]]*\]|::?[\w-]+(?:\([^)]*\))?)*$/;
function ownedClasses(sheet) {
  const owned = new Set();
  for (const selector of selectors(readFileSync(join(ROOT, sheet), 'utf8'))) {
    const hit = ALONE.exec(selector);
    if (hit) owned.add(hit[1]);
  }
  return owned;
}

const common = (a, b) => [...a].filter(name => b.has(name) && !SHARED.has(name)).sort();

test('la lecture des classes : ce que construit un module, ce qu\'une feuille nomme seule', () => {
  const built = builtClasses(EXPLORER);
  for (const name of ['ls-row', 'lk', 'rb', 'mn', 'pin', 'on', 'th-grid', 'th', 'pill']) assert.ok(built.has(name), `l'explorateur construit .${name}`);
  const owned = ownedClasses('css/explorer.css');
  for (const name of ['ls-row', 'rb', 'th-grid', 'th', 'pill', 'btn']) assert.ok(owned.has(name), `explorer.css nomme seule .${name}`);
  assert.ok(!owned.has('mn'), '`.rb.mn` complète `.rb` : `mn` n\'y est pas nommée seule');
  const windows = builtClasses(WINDOWS);
  for (const name of ['mod', 'mod-head', 'amb', 'amb-mini', 'amb-grid', 'mn-p']) assert.ok(windows.has(name), `les fenêtres construisent .${name}`);
  assert.ok(ownedClasses('css/modules.css').has('mod-head'), 'modules.css nomme seule .mod-head');
});

test('les fenêtres (modules.css) ne nomment seule aucune classe que l\'explorateur construit : la feuille qui passe après défait la liste', () => {
  assert.deepEqual(common(ownedClasses('css/modules.css'), builtClasses(EXPLORER)), []);
});

test('la liste (explorer.css) ne nomme seule aucune classe que les fenêtres construisent, hors les classes partagées exprès', () => {
  assert.deepEqual(common(ownedClasses('css/explorer.css'), builtClasses(WINDOWS)), []);
});
