// Une classe de l'explorateur n'est stylée que par la feuille de l'explorateur. Le 03/11, la vignette d'une ambiance (`div.mn.amb-mini`) a pris `mn`, la classe du bouton « ⋯ » d'une ligne
// (`.rb.mn`), dans css/modules.css, chargée après celle de l'explorateur : chaque « ⋯ » est devenu une boîte bordée de 58 px, et la souris, sur une ligne, tombait sur le bouton de la ligne du dessus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

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
