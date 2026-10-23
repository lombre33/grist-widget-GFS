// La politique de sécurité du contenu de GFS (prototype/index.html) : ce qu'elle ouvre, ligne par ligne. Toute adresse ajoutée l'est consciemment et avec son motif
// (CLAUDE.md) ; `blob:` n'est là que pour l'enregistrement d'un fichier que l'app fabrique (faits vérifiés 11).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';

const directives = () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const content = /<meta http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(html)?.[1] ?? '';
  const parts = content.split(';').map(part => part.trim().split(/\s+/)).filter(([name]) => name);
  return Object.fromEntries(parts.map(([name, ...sources]) => [name, sources]));
};

test('frame-src : le site de GFS et blob:, rien d\'autre (Firefox applique cette ligne à un fichier fabriqué dans un cadre et l\'enregistre ou non)', () => {
  assert.deepEqual(directives()['frame-src'], ["'self'", 'blob:']);
});

test('blob: n\'est dans aucune autre ligne : il n\'ouvre ni script, ni image, ni connexion', () => {
  for (const [name, sources] of Object.entries(directives())) {
    if (name !== 'frame-src') assert.ok(!sources.includes('blob:'), name);
  }
});

test('le reste est fermé : tout est refusé par défaut, sans joker ni script en ligne, et data: seulement pour les images', () => {
  const policy = directives();
  assert.deepEqual(policy['default-src'], ["'none'"]);
  for (const [name, sources] of Object.entries(policy)) {
    assert.ok(!sources.includes('*') && !sources.includes("'unsafe-inline'"), `${name} : joker ou script en ligne`);
    if (name !== 'img-src') assert.ok(!sources.includes('data:'), `${name} : data:`);
  }
});
