// La vitrine de la fenêtre « Apps » (décision du porteur, 17/11) : ce que le manifeste peut déclarer (`vitrine`, contrats 2.2) et ce que la fenêtre en tire (description, captures).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest } from '../js/apps/manifest.js';
import { vitrineOf, SHOT_FOLDER } from '../js/apps/vitrine.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { STRING_TABLES } from '../js/i18n/i18n.js';
import { publipostage, bi, ROOT } from './helpers.mjs';

const L = (fr, en) => ({ fr, en });
const withVitrine = vitrine => ({ ...bi(), vitrine });
const errorsOf = vitrine => validateManifest(withVitrine(vitrine)).errors;

test('les manifestes livrés, sans `vitrine`, restent valides : le champ est facultatif', () => {
  assert.deepEqual(validateManifest(publipostage()).errors, []);
  assert.deepEqual(validateManifest(bi()).errors, []);
});

test('une vitrine complète est acceptée : description, captures et légendes dans les deux langues', () => {
  const vitrine = { description: L('Des rapports.', 'Reports.'), captures: [{ fichier: 'bi/1.webp', legende: L('Un rapport', 'A report') }, { fichier: 'bi/2.png', legende: L('Un graphique', 'A chart') }] };
  assert.deepEqual(errorsOf(vitrine), []);
  assert.deepEqual(errorsOf({}), [], 'une vitrine vide est permise : la fenêtre montre alors la vignette d\'attente');
});

test('une vitrine mal formée invalide le manifeste, avec sa raison', () => {
  assert.match(errorsOf('rien').join(), /vitrine : objet attendu/);
  assert.match(errorsOf({ description: L('Seulement le français', '') }).join(), /vitrine\.description doit porter fr et en/);
  assert.match(errorsOf({ captures: 'une' }).join(), /vitrine\.captures : une liste de 6 captures au plus/);
  const seven = Array.from({ length: 7 }, (unused, i) => ({ fichier: `bi/${i}.webp`, legende: L('a', 'a') }));
  assert.match(errorsOf({ captures: seven }).join(), /6 captures au plus/);
  assert.match(errorsOf({ captures: [{ fichier: 'bi/1.webp', legende: L('Seulement le français', '') }] }).join(), /legende doit porter fr et en/);
});

test('une capture ne sort jamais du dossier de GFS : ni adresse, ni « .. », ni dossier caché, ni autre format qu\'une image', () => {
  for (const fichier of ['https://exemple.fr/1.webp', '../secret.png', '/etc/1.png', 'bi/_cache/1.webp', 'bi/.cache/1.png', 'bi/1.svg', 'bi/1', 'bi\\1.webp']) {
    assert.match(errorsOf({ captures: [{ fichier, legende: L('a', 'a') }] }).join(), /chemin relatif sûr d'une image/, fichier);
  }
});

test('la vitrine d\'une app : sa description (sinon le texte court), ses captures dans le dossier de GFS, ses légendes dans la langue de la personne', () => {
  const plain = bi();
  assert.deepEqual(vitrineOf(plain, 'fr'), { description: plain.texte.fr, captures: [] }, 'sans `vitrine`, le texte court tient lieu de description et il n\'y a pas de capture');
  const shown = vitrineOf(withVitrine({ description: L('Longue.', 'Long.'), captures: [{ fichier: 'bi/1.webp', legende: L('Un rapport', 'A report') }] }), 'en');
  assert.deepEqual(shown, { description: 'Long.', captures: [{ src: `${SHOT_FOLDER}bi/1.webp`, caption: 'A report' }] });
  assert.equal(SHOT_FOLDER, 'vitrine/');
});

test('un manifeste refusé ou absent n\'a rien à montrer que son nom : pas de plantage', () => {
  assert.deepEqual(vitrineOf(null, 'fr'), { description: '', captures: [] });
  assert.deepEqual(vitrineOf({ vitrine: 'x' }, 'fr'), { description: '', captures: [] });
});

// Mesuré le 17/11 dans un vrai Firefox : l'opacité de `.btn[aria-disabled]` (gfs.css) faisait tomber « Installer » grisé à 2:1 sur la fiche (app refusée, lecture seule). Une règle qui grise un
// bouton de la fenêtre en pointillé lui rend l'opacité pleine et laisse le texte au gris du texte discret (4,5:1) ; test/vitrine-firefox.mjs le mesure, celui-ci garde la règle.
test('un bouton grisé de la fenêtre « Apps » garde son opacité pleine : le texte discret, en pointillé, lisible à 4,5:1', () => {
  const css = readFileSync(join(ROOT, 'css/modules.css'), 'utf8');
  const rule = css.match(/\.ap-win \.btn\[aria-disabled="true"\] \{([^}]*)\}/);
  assert.ok(rule, 'une règle grise les boutons de la fenêtre');
  assert.match(rule[1], /opacity: 1;/);
  assert.match(rule[1], /border-style: dashed;/);
  assert.match(rule[1], /color: var\(--text-muted\);/);
});

test('la fiche dit « Copie figée » partout : plus « Copie de GFS » ni « Depuis un CDN » (une seule façon de nommer la même chose)', () => {
  for (const [language, banned] of [['fr', /Copie de GFS|Depuis un CDN/], ['en', /GFS copy|From a CDN/]]) {
    const found = Object.entries(STRING_TABLES[language]).filter(([, text]) => banned.test(text)).map(([key]) => key);
    assert.deepEqual(found, [], `${language} : ${found.join()}`);
  }
  assert.equal(STRING_TABLES.fr['mod.native.copy'], 'Copie figée');
  assert.equal(STRING_TABLES.en['mod.native.copy'], 'Frozen copy');
  assert.match(STRING_TABLES.fr['mod.mode.cdnRefused'], /« Copie figée »/);
});
