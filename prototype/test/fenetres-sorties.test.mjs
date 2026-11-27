// Un bouton de fenêtre qui n'a aucun gestionnaire (demande du porteur du 27/11 : le bouton « Annuler » de la fenêtre « Déplacer » ne fermait pas la fenêtre) : `chooseFolder` (js/explorer/filing-window.js) bâtissait
// `const cancel = h('button', …)` et le posait dans le pied, mais personne n'écoutait son clic ; seul Échap fermait la fenêtre. Cet essai lit le code publié (`js/`) et refuse tout bouton NOMMÉ (une variable ou une propriété :
// `const cancel = h('button', …)`, `{ close: h('button', …) }`) qui n'a ni `on: { click }` dans sa construction, ni `data-act` (la fenêtre l'écoute par délégation), ni `nom.addEventListener(…)` / `nom.onclick` quelque part
// dans le fichier. Il tourne sans navigateur, en une fraction de seconde : il garde la faute avant que l'essai sous Firefox (test/sorties-firefox.test.mjs, qui clique chaque sortie de chaque fenêtre à la vraie souris) la voie.
// Un bouton qui a une autre manière d'être écouté va dans `LISTENED_ELSEWHERE`, avec sa raison.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as acorn from 'acorn';
import { ROOT } from './helpers.mjs';

// `fichier:nom` -> pourquoi son clic est écouté sans `addEventListener` sur ce nom.
const LISTENED_ELSEWHERE = {
  'sharing/share-window.js:manage': 'le bouton « Gérer les partages… » est donné à `wireManage`, qui l\'écoute (plus bas dans le même fichier)',
  'ui/pick-window.js:main': 'le bouton d\'une ligne de la liste : le clic est écouté une fois sur la liste (`list.addEventListener(\'click\')`, délégation)',
};

function scripts(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...scripts(path));
    else if (entry.name.endsWith('.js')) found.push(path);
  }
  return found;
}

// Tous les nœuds de l'arbre, avec la liste de leurs ancêtres (le plus proche en dernier).
function walk(node, ancestors, visit) {
  if (!node || typeof node.type !== 'string') return;
  visit(node, ancestors);
  const below = [...ancestors, node];
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) for (const child of value) walk(child, below, visit);
    else if (value && typeof value === 'object') walk(value, below, visit);
  }
}

const keyName = property => (property.key.type === 'Identifier' ? property.key.name : property.key.value);
const ownsKey = (object, key) => object && object.type === 'ObjectExpression' && object.properties.some(property => property.type === 'Property' && keyName(property) === key);

// Les boutons nommés du fichier qui ne sont écoutés nulle part : [{ name, line }]. Un bouton gardé dans une variable est cherché dans la fonction qui le bâtit (un `cancel` d'une autre fenêtre du même fichier ne compte pas : c'est
// ce qui cachait la faute du 27/11) ; un bouton rangé dans une propriété (`refs.cancel`) est cherché dans tout le fichier, par `.nom.addEventListener`.
export function unlistened(source) {
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true, allowHashBang: true });
  const found = [];
  walk(ast, [], (node, ancestors) => {
    const isButton = node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'h' && node.arguments[0] && node.arguments[0].value === 'button';
    if (!isButton) return;
    const parent = ancestors[ancestors.length - 1];
    const variable = parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier';
    const name = variable ? parent.id.name : (parent.type === 'Property' && parent.key.type === 'Identifier' ? parent.key.name : null);
    if (!name) return;
    const props = node.arguments[1];
    const dataset = props && props.type === 'ObjectExpression' ? props.properties.find(property => property.type === 'Property' && keyName(property) === 'dataset') : null;
    if (ownsKey(props, 'on') || (dataset && ownsKey(dataset.value, 'act'))) return;
    const owner = variable ? [...ancestors].reverse().find(each => /Function/.test(each.type)) : null;
    const where = owner ? source.slice(owner.start, owner.end) : source;
    if (new RegExp(`\\b${name}\\.(addEventListener|onclick)\\b`).test(where)) return;
    found.push({ name, line: node.loc.start.line });
  });
  return found;
}

test('le détecteur voit le bouton « Annuler » sans gestionnaire que le code d\'avant le 27/11 posait', () => {
  const old = `export function chooseFolder() {
    const cancel = h('button', { type: 'button', class: 'btn', dataset: { fk: 'move-cancel' } }, 'Annuler');
    const section = h('section', {}, h('footer', {}, note, cancel));
    const { done } = openModal({ section });
    list.addEventListener('click', () => done('x'));
  }`;
  assert.deepEqual(unlistened(old), [{ name: 'cancel', line: 2 }]);
  assert.deepEqual(unlistened(old.replace('list.addEventListener', 'cancel.addEventListener(\'click\', () => done(null));\n    list.addEventListener')), []);
  assert.deepEqual(unlistened('const close = h(\'button\', { on: { click: () => this.close() } }, \'Fermer\');'), []);
  assert.deepEqual(unlistened('const edit = h(\'button\', { dataset: { act: \'edit\', fk: \'edit\' } }, \'Modifier\');'), []);
  assert.deepEqual(unlistened('const refs = { cancel: h(\'button\', {}, \'Annuler\') };\nrefs.cancel.addEventListener(\'click\', go);'), []);
  // le `cancel` d'une AUTRE fonction du même fichier ne sauve pas celui-ci (la faute du 27/11 se cachait derrière celui de « Nouveau dossier »)
  const twice = `function ask() {\n  const cancel = h('button', {}, 'Annuler');\n  cancel.addEventListener('click', stop);\n}\nfunction move() {\n  const cancel = h('button', {}, 'Annuler');\n}`;
  assert.deepEqual(unlistened(twice), [{ name: 'cancel', line: 6 }]);
});

test('chaque bouton nommé d\'une fenêtre du widget a un gestionnaire de clic', () => {
  const faults = [];
  for (const path of scripts(join(ROOT, 'js'))) {
    const file = relative(join(ROOT, 'js'), path).split('\\').join('/');
    for (const { name, line } of unlistened(readFileSync(path, 'utf8'))) {
      if (!Object.hasOwn(LISTENED_ELSEWHERE, `${file}:${name}`)) faults.push(`js/${file}:${line} : le bouton « ${name} » n'a aucun gestionnaire de clic`);
    }
  }
  assert.deepEqual(faults, [], `un bouton sans gestionnaire ne fait rien au clic (la fenêtre « Déplacer », 27/11) : écoutez-le, ou dites pourquoi il n'a pas besoin de l'être dans LISTENED_ELSEWHERE\n${faults.join('\n')}`);
});
