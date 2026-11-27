// La garde de démarrage (js/shell/boot-guard.js, 27/11) : le vrai fichier évalué dans une fenêtre minimale (les adresses de rechange), et la page de GFS qui la pose au bon endroit. Le comportement
// dans le navigateur (le 404 que garde le CDN, l'écran, la reprise) se mesure sous Firefox : test/demarrage-firefox.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';
import { addressOf } from '../js/broker/view-options.js';

function load() {
  const listeners = [];
  const window = { addEventListener: (type, fn, capture) => listeners.push({ type, fn, capture }) };
  vm.runInNewContext(readFileSync(join(ROOT, 'js/shell/boot-guard.js'), 'utf8'), { window, URL });
  return { window, listeners, guard: window.GFSBootGuard };
}

const PAGE = 'https://lombre33.github.io/grist-widget-GFS/prototype/index.html';

test('boot-guard : l\'essai que porte une adresse est le nombre de barres de plus avant le nom de la page', () => {
  const { guard } = load();
  assert.equal(guard.attemptOf(PAGE), 0);
  assert.equal(guard.attemptOf('https://x.example/prototype//index.html'), 1);
  assert.equal(guard.attemptOf('https://x.example/prototype////index.html?access=full'), 3);
  assert.equal(guard.attemptOf('https://x.example/prototype/'), 0, 'un dossier sans nom de page');
  assert.equal(guard.attemptOf('https://x.example/index.html'), 0);
});

test('boot-guard : l\'adresse de rechange garde le dossier, la requête et le fragment, et ne change que les barres', () => {
  const { guard } = load();
  assert.equal(guard.retryAddress(PAGE, 1), 'https://lombre33.github.io/grist-widget-GFS/prototype//index.html');
  assert.equal(guard.retryAddress(PAGE, 3), 'https://lombre33.github.io/grist-widget-GFS/prototype////index.html');
  assert.equal(guard.retryAddress('https://x.example/prototype/?access=full&language=en#y', 1), 'https://x.example/prototype//?access=full&language=en#y');
  assert.equal(guard.retryAddress('https://x.example/prototype//index.html', 2), 'https://x.example/prototype///index.html', 'depuis un essai déjà fait');
  assert.equal(guard.retryAddress('https://x.example/index.html', 1), 'https://x.example//index.html');
  assert.equal(guard.attemptOf(guard.retryAddress(PAGE, 2)), 2, 'le compteur se relit');
});

test('boot-guard : l\'écouteur d\'erreurs est en capture (l\'événement `error` d\'un script ne remonte pas)', () => {
  const { listeners } = load();
  const error = listeners.filter(each => each.type === 'error');
  assert.equal(error.length, 1);
  assert.equal(error[0].capture, true);
});

test('boot-guard : sans module de page, une erreur ordinaire ne déclenche rien', () => {
  const { listeners } = load();
  const handler = listeners.find(each => each.type === 'error').fn;
  // Un script classique qui échoue, une exception d'un code qui tourne : ni l'un ni l'autre n'est un module qui ne charge pas (aucun `document` ici : si la garde agissait, elle lèverait).
  assert.doesNotThrow(() => handler({ target: { tagName: 'SCRIPT', type: '' } }));
  assert.doesNotThrow(() => handler({ target: { tagName: 'LINK', type: '' } }));
});

test('index.html : la garde est un script classique, après le routeur et avant le script d\'API de Grist et le module d\'entrée', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const at = text => html.indexOf(text);
  const router = at('<script src="js/broker/router.js');
  const guard = at('<script src="js/shell/boot-guard.js');
  const api = at('<script src="https://docs.getgrist.com/grist-plugin-api.js"');
  const entry = at('<script type="module" src="js/gfs.js');
  assert.ok(router >= 0 && guard > router, 'après le routeur, qui reste le premier script');
  assert.ok(api > guard && entry > guard, 'avant l\'API de Grist et le module d\'entrée');
  assert.match(html, /<script src="js\/shell\/boot-guard\.js\?v=[0-9a-f]{10}"><\/script>/, 'versionnée comme tout script de la page');
  assert.ok(html.includes('data-gfs="starting"'), 'la page de rechange est reconnue à cette marque');
  assert.ok(/<link rel="modulepreload" href="\.\/js\/explorer\/list-signature\.js\?v=/.test(html), 'le préchargement que la garde lit cite le module du défaut du 27/11');
});

test('addressOf : les barres de plus de la page de rechange ne font pas une autre adresse de widget', () => {
  const given = 'https://lombre33.github.io/grist-widget-GFS/prototype';
  assert.equal(addressOf(PAGE), given);
  assert.equal(addressOf('https://lombre33.github.io/grist-widget-GFS/prototype//index.html?access=full'), given);
  assert.equal(addressOf('https://lombre33.github.io/grist-widget-GFS//prototype////index.html'), given);
});
