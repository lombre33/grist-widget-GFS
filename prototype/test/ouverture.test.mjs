// L'ouverture de GFS (audit vitesse du 10/11, faits vérifiés 82) : ce que le code fait à l'ordre, pour qu'un aller-retour de réseau ne se perde pas.
// Le temps lui-même se mesure dans un vrai Grist sous Firefox ; cet essai garde l'ordre des lignes de start().
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';

const start = () => {
  const source = readFileSync(join(ROOT, 'js/controller.js'), 'utf8');
  const from = source.indexOf('  async start() {');
  assert.ok(from > 0, 'start() est dans controller.js');
  return source.slice(from, source.indexOf('\n  }\n', from));
};

test('start() : la lecture du catalogue des bibliothèques part avant celle des manifestes, et on n\'attend sa réponse qu\'après (un aller-retour de moins, au lieu de deux de suite)', () => {
  const body = start();
  const launched = body.indexOf('const libraries = this.#loadLibraries()');
  const manifests = body.indexOf('await loadAll(');
  const awaited = body.indexOf('await libraries');
  assert.ok(launched > 0 && launched < manifests, 'la lecture des bibliothèques part avant d\'attendre les manifestes');
  assert.ok(awaited > manifests, 'sa réponse s\'attend après eux');
  assert.ok(!/await this\.#loadLibraries\(\)/.test(body), 'plus d\'attente directe, qui remettrait les deux lectures l\'une après l\'autre');
});
