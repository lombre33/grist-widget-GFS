// Ce que GFS a recopié du kit (audit du code du 09/11, choix du porteur : « garder les copies, ajouter un essai »). GFS démarre sans le kit (le sous-module n'est lu que pour le moteur de partage, à la demande) : ces
// copies restent donc dans GFS, et cet essai échoue dès qu'une copie diverge du kit, pour qu'une correction faite d'un côté ne reste pas seule.
//   - `h` (js/dom.js) : le même code que `h` du kit (kit/js/dom.js), commentaires exceptés ;
//   - le contraste de la WCAG 2 (js/oklch.js) : les mêmes nombres que `ColorMath.contrast` et `ColorMath.luminance` du kit (kit/js/color-math.js) ;
//   - les jetons de couleur de css/gfs.css : les mêmes valeurs que kit/css/tokens.css, en clair et en sombre, sauf les couches (`--z-menu`, `--z-window` : GFS les compte de 100 en 100, le kit de 1500 à 2100).
// Les deux `Layers` et les deux bases de fenêtres ne sont pas des copies (ils n'ont pas les mêmes fonctions) : rien à comparer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const KIT = join(ROOT, 'kit');
const skip = existsSync(join(KIT, 'js', 'dom.js')) ? false : 'le sous-module du kit n\'est pas récupéré (git submodule update --init prototype/kit)';
// Les jetons que GFS et le kit ne disent pas de la même façon, avec la raison.
const DIFFERENT = new Map([['--z-menu', 'les couches de GFS vont de 100 en 100 (1 à 400), celles du kit de 1500 à 2100'], ['--z-window', 'idem']]);

// Le code d'une fonction, sans commentaires ni espaces : la suite de ses mots (type et valeur).
export function codeOf(source, name) {
  const tokens = [];
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true, ranges: true, onToken: tokens });
  const fn = ast.body.map(node => (node.type === 'ExportNamedDeclaration' ? node.declaration : node)).find(node => node && node.type === 'FunctionDeclaration' && node.id.name === name);
  assert.ok(fn, `la fonction ${name} est introuvable`);
  return tokens.filter(token => token.start >= fn.start && token.end <= fn.end).map(token => `${token.type.label}:${token.value === undefined ? '' : token.value}`);
}

// Les jetons d'une feuille de style : { nom → valeur } des blocs dont le sélecteur est l'un de `selectors` (espaces réduits), les derniers gagnant.
export function tokensOf(css, selectors) {
  const out = new Map();
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, selector, body] of bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectors.includes(selector.replace(/\s+/g, ' ').trim())) continue;
    for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);?/g)) out.set(name, value.replace(/\s+/g, ' ').trim());
  }
  return out;
}

// Les jetons de GFS qui existent aussi dans le kit : [nom, valeur de GFS, valeur du kit] pour ceux qui diffèrent, et leur nombre.
export function compareTokens(gfs, kit) {
  const shared = [...gfs.keys()].filter(name => kit.has(name));
  return { shared: shared.length, differing: shared.filter(name => gfs.get(name) !== kit.get(name)).map(name => [name, gfs.get(name), kit.get(name)]) };
}

test('`h` : le code de js/dom.js est celui de kit/js/dom.js, commentaires exceptés', { skip }, () => {
  const mine = codeOf(readFileSync(join(ROOT, 'js', 'dom.js'), 'utf8'), 'h');
  const theirs = codeOf(readFileSync(join(KIT, 'js', 'dom.js'), 'utf8'), 'h');
  assert.ok(mine.length > 100, 'la comparaison porte sur du code');
  assert.deepEqual(mine, theirs, '`h` a changé d\'un côté : reporter la correction de l\'autre');
});

test('le contraste de la WCAG 2 : js/oklch.js et kit/js/color-math.js rendent les mêmes nombres, de 1 à 21', { skip }, async () => {
  const { contrast } = await import('../js/oklch.js');
  const { ColorMath } = await import(join(KIT, 'js', 'color-math.js'));
  const colors = ['#000000', '#ffffff', '#2f6fed', '#d84343', '#146c48', '#5f6b7e', '#f4f6fa', '#1b2430', '#8a5300', '#ffeb3b'];
  let seed = 7;
  for (let i = 0; i < 60; i++) { seed = (seed * 1103515245 + 12345) % 2147483648; colors.push(`#${(seed % 16777216).toString(16).padStart(6, '0')}`); }
  for (const a of colors) {
    for (const b of colors) assert.ok(Math.abs(contrast(a, b) - ColorMath.contrast(a, b)) < 1e-9, `${a} sur ${b} : ${contrast(a, b)} contre ${ColorMath.contrast(a, b)}`);
    assert.ok(Math.abs(contrast(a, '#000000') - (ColorMath.luminance(a) + 0.05) / 0.05) < 1e-9, `la luminance de ${a}`);
  }
  assert.equal(contrast('#000000', '#ffffff'), 21);
});

test('les jetons de couleur de css/gfs.css : les valeurs de kit/css/tokens.css, en clair et en sombre, aux couches près', { skip }, () => {
  const gfs = readFileSync(join(ROOT, 'css', 'gfs.css'), 'utf8');
  const kit = readFileSync(join(KIT, 'css', 'tokens.css'), 'utf8');
  const light = compareTokens(tokensOf(gfs, [':root', ':root, .amb-mini']), tokensOf(kit, [':root']));
  const kitDark = tokensOf(kit, [':root[data-theme="dark"], :root[data-grist-appearance="dark"]:not([data-theme="light"])']);
  // Le sombre de GFS est dit deux fois : quand Grist le demande (`data-grist-appearance`), et quand le système le préfère et que Grist ne dit rien.
  const dark = compareTokens(tokensOf(gfs, [':root[data-grist-appearance="dark"]']), kitDark);
  const system = compareTokens(tokensOf(gfs, [':root:not([data-grist-appearance="light"])']), kitDark);
  assert.ok(light.shared >= 25, `en clair, ${light.shared} jetons en commun (25 au moins : sinon l'essai ne lit plus rien)`);
  assert.ok(dark.shared >= 20 && system.shared >= 20, `en sombre, ${dark.shared} et ${system.shared} jetons en commun (20 au moins)`);
  const unexpected = [...light.differing, ...dark.differing, ...system.differing].filter(([name]) => !DIFFERENT.has(name));
  assert.deepEqual(unexpected, [], 'un jeton a une valeur d\'un côté et une autre de l\'autre : reporter le changement (ou le dire dans DIFFERENT, avec sa raison)');
});

test('l\'outil de comparaison voit ce qu\'il doit voir : un mot de plus dans `h`, un commentaire qui ne compte pas, un jeton qui diverge, un bloc d\'une autre sélection', () => {
  const base = 'export function h(a) {\n  return a + 1;\n}\nfunction other() { return 2; }\n';
  assert.deepEqual(codeOf(base, 'h'), codeOf('// un mot\nexport function h(a) {\n  /* ici */ return a   +   1; // fin\n}\n', 'h'));
  assert.notDeepEqual(codeOf(base, 'h'), codeOf(base.replace('a + 1', 'a + 2'), 'h'));
  assert.notDeepEqual(codeOf(base, 'h'), codeOf(base.replace('a + 1', 'a + 1 + 0'), 'h'));
  assert.throws(() => codeOf(base, 'absente'), /introuvable/);
  const css = ':root {\n  --a: #fff; /* clair */\n  --b: 1px;\n}\n@media (prefers-color-scheme: dark) {\n  :root:not([data-theme]) {\n    --a: #000;\n  }\n}\n:root[data-x="1"],\n:root[data-y="2"] { --a: #111; }';
  assert.deepEqual([...tokensOf(css, [':root'])], [['--a', '#fff'], ['--b', '1px']]);
  assert.deepEqual([...tokensOf(css, [':root[data-x="1"], :root[data-y="2"]'])], [['--a', '#111']]);
  assert.deepEqual(compareTokens(new Map([['--a', '1'], ['--b', '2'], ['--c', '3']]), new Map([['--a', '1'], ['--b', '9']])), { shared: 2, differing: [['--b', '2', '9']] });
});
