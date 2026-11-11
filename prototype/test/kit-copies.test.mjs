// Ce que GFS tient du kit (audit du code du 09/11 ; choix du porteur : d'abord « garder les copies et ajouter un essai » (10/11), puis « reprendre les copies exactes du kit » (11/11)).
//   - `h` (js/ui/dom.js), le contraste de la WCAG 2 et `parseHex` (js/theme/oklch.js) ne sont plus des copies : GFS les reprend du kit (kit/js/dom.js, kit/js/color-math.js), et l'essai garde que ce sont bien les mêmes fonctions ;
//   - les jetons de couleur de css/gfs.css sont encore écrits des deux côtés (les sélecteurs du sombre ne sont pas ceux du kit) : l'essai échoue dès qu'une valeur diverge de kit/css/tokens.css, en clair et en
//     sombre, sauf les couches (`--z-menu`, `--z-window` : GFS les compte de 100 en 100, le kit de 1500 à 2100).
// Les deux `Layers` et les deux bases de fenêtres ne sont pas des copies (ils n'ont pas les mêmes fonctions) : rien à comparer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const KIT = join(ROOT, 'kit');
const skip = existsSync(join(KIT, 'js', 'dom.js')) ? false : 'le sous-module du kit n\'est pas récupéré (git submodule update --init prototype/kit)';
// Les jetons que GFS et le kit ne disent pas de la même façon, avec la raison.
const DIFFERENT = new Map([['--z-menu', 'les couches de GFS vont de 100 en 100 (1 à 400), celles du kit de 1500 à 2100'], ['--z-window', 'idem']]);

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

test('`h` : js/ui/dom.js rend le `h` du kit (kit/js/dom.js), pas une copie', { skip }, async () => {
  const mine = await import('../js/ui/dom.js');
  const theirs = await import(join(KIT, 'js', 'dom.js'));
  assert.equal(typeof theirs.h, 'function');
  assert.equal(mine.h, theirs.h);
});

test('le contraste de la WCAG 2 et `parseHex` : js/theme/oklch.js rend ceux du kit (kit/js/color-math.js), de 1 à 21', { skip }, async () => {
  const mine = await import('../js/theme/oklch.js');
  const { ColorMath } = await import(join(KIT, 'js', 'color-math.js'));
  assert.equal(mine.contrast, ColorMath.contrast);
  assert.equal(mine.parseHex, ColorMath.parseHex);
  assert.equal(mine.contrast('#000000', '#ffffff'), 21);
  assert.equal(mine.contrast('#777777', '#777777'), 1);
  assert.equal(mine.parseHex(' 6D4FD6 '), '#6d4fd6');
  assert.equal(mine.parseHex('#6df'), '#66ddff');
  assert.equal(mine.parseHex('#6d4fd6ff'), null);
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

test('l\'outil de comparaison voit ce qu\'il doit voir : un jeton qui diverge, un bloc d\'une autre sélection, les valeurs communes', () => {
  const css = ':root {\n  --a: #fff; /* clair */\n  --b: 1px;\n}\n@media (prefers-color-scheme: dark) {\n  :root:not([data-theme]) {\n    --a: #000;\n  }\n}\n:root[data-x="1"],\n:root[data-y="2"] { --a: #111; }';
  assert.deepEqual([...tokensOf(css, [':root'])], [['--a', '#fff'], ['--b', '1px']]);
  assert.deepEqual([...tokensOf(css, [':root[data-x="1"], :root[data-y="2"]'])], [['--a', '#111']]);
  assert.deepEqual(compareTokens(new Map([['--a', '1'], ['--b', '2'], ['--c', '3']]), new Map([['--a', '1'], ['--b', '9']])), { shared: 2, differing: [['--b', '2', '9']] });
});
