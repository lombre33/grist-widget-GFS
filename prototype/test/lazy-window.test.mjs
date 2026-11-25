// Les fenêtres rarement ouvertes se chargent au premier clic (js/shell/lazy-window.js ; audit du 25/11 : 202 fichiers préchargés à chaque ouverture du widget) :
// le chargement qui échoue se dit sans rien casser, une erreur de la fenêtre elle-même garde son chemin, et le démarrage ne précharge plus leur code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openLazily } from '../js/shell/lazy-window.js';
import { createI18n } from '../js/i18n/i18n.js';
import { ROOT } from './helpers.mjs';

const host = () => { const notices = []; return { notices, c: { t: key => `texte:${key}`, notice: text => notices.push(text) } }; };

// Le console.error attendu d'un chargement qui échoue ne doit pas salir le journal de l'essai.
async function quietly(run) {
  const original = console.error;
  const said = [];
  console.error = (...args) => said.push(args);
  try { return { value: await run(), said }; } finally { console.error = original; }
}

test('un module qui se charge : la fenêtre s\'ouvre avec lui et rend ce qu\'elle rend (la promesse de sa fermeture)', async () => {
  const { c, notices } = host();
  const closing = Promise.resolve('fermée');
  const result = await openLazily(c, 'Partager', async () => ({ openShare: options => { assert.deepEqual(options, { file: 1 }); return closing; } }),
    ({ openShare }) => openShare({ file: 1 }));
  assert.equal(result, 'fermée');
  assert.deepEqual(notices, []);
});

test('un module qui ne se charge pas : la personne en est avertie, la fenêtre ne s\'ouvre pas et rien ne casse', async () => {
  const { c, notices } = host();
  let opened = false;
  const { value, said } = await quietly(() => openLazily(c, 'Thème', () => Promise.reject(new TypeError('Failed to fetch dynamically imported module')),
    () => { opened = true; }));
  assert.equal(value, undefined);
  assert.equal(opened, false);
  assert.deepEqual(notices, ['texte:gfs.windowLoadFailed']);
  assert.match(String(said[0][0]), /Thème/);
});

test('sans de quoi avertir (un contrôle d\'essai), un module qui ne se charge pas ne lève rien', async () => {
  const { value } = await quietly(() => openLazily({ t: key => key }, 'Gérer', () => Promise.reject(new Error('réseau coupé')), () => 'ouverte'));
  assert.equal(value, undefined);
});

test('une erreur de la fenêtre elle-même n\'est pas prise pour un chargement manqué : elle garde son chemin', async () => {
  const { c, notices } = host();
  await assert.rejects(openLazily(c, 'Dépendances', async () => ({}), () => { throw new RangeError('la fenêtre a levé'); }), /la fenêtre a levé/);
  assert.deepEqual(notices, []);
});

test('le texte du chargement manqué existe en français et en anglais', () => {
  assert.match(createI18n('fr').t('gfs.windowLoadFailed'), /Rechargez la page/);
  assert.match(createI18n('en').t('gfs.windowLoadFailed'), /Reload the page/);
});

// Le démarrage : un <link rel="modulepreload"> par module du chemin de démarrage (outils/versions.mjs). Les fenêtres rares n'y sont plus (elles s'ouvrent par
// `import()`), mais restent dans la carte d'import : leur adresse porte son `?v=`.
test('le démarrage ne précharge pas le code des fenêtres Thème, Dépendances, Partager et Gérer ; la carte d\'import les garde', () => {
  const page = readFileSync(join(ROOT, 'index.html'), 'utf8');
  for (const file of ['theme/theme-window.js', 'apps/dependencies-control.js', 'apps/dependencies-window.js', 'sharing/share-window.js', 'sharing/manage-window.js']) {
    assert.equal(page.includes(`<link rel="modulepreload" href="./js/${file}`), false, `${file} se charge au premier clic, pas au démarrage`);
    if (!file.includes('dependencies-window')) assert.ok(page.includes(`"./js/${file}": "./js/${file}?v=`), `${file} reste dans la carte d'import`);
  }
});
