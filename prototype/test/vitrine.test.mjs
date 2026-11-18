// La vitrine de la fenêtre « Apps » (décision du porteur, 17/11) : ce que le manifeste peut déclarer (`vitrine`, contrats 2.2) et ce que la fenêtre en tire (description, captures).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest } from '../js/apps/manifest.js';
import { vitrineOf, levelOf, SHOT_FOLDER } from '../js/apps/vitrine.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { STRING_TABLES } from '../js/i18n/i18n.js';
import { publipostage, bi, readJson, ROOT } from './helpers.mjs';

const L = (fr, en) => ({ fr, en });
const withVitrine = vitrine => ({ ...bi(), vitrine });
const withoutVitrine = ({ vitrine, ...rest }) => rest;
const errorsOf = vitrine => validateManifest(withVitrine(vitrine)).errors;

test('les manifestes livrés, sans `vitrine`, restent valides : le champ est facultatif', () => {
  assert.deepEqual(validateManifest(withoutVitrine(publipostage())).errors, []);
  assert.deepEqual(validateManifest(withoutVitrine(bi())).errors, []);
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
  const plain = withoutVitrine(bi());
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

// Les vitrines que les apps ont rendues (consignes 014, 018 et 031, 17/11) : ce que la consigne demandait, relu sur ce que GFS livre. Une description de 280 caractères au plus et des légendes de
// 60 au plus, dans les deux langues ; des images de GFS (le dossier `vitrine/`) : WebP de 960 × 600 px et 60 Ko au plus, car la politique de sécurité ne charge une image que de GFS.
function webpSize(buffer) {
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF');
  assert.equal(buffer.toString('ascii', 8, 12), 'WEBP');
  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') return [buffer.readUInt16LE(26) & 0x3fff, buffer.readUInt16LE(28) & 0x3fff];
  if (chunk === 'VP8L') { const bits = buffer.readUInt32LE(21); return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1]; }
  if (chunk === 'VP8X') return [1 + buffer.readUIntLE(24, 3), 1 + buffer.readUIntLE(27, 3)];
  return assert.fail(`morceau WebP inconnu : ${chunk}`);
}

const DELIVERED = ['publipostage', 'automation', 'bi', 'form'];

test('Publipostage+, Automation+, Grist-BI et Form+ ont leur vitrine : une description et de trois à six captures, dans les deux langues, des fichiers de GFS aux bonnes dimensions', () => {
  for (const id of DELIVERED) {
    const manifest = readJson(`manifestes/${id}.json`);
    assert.deepEqual(validateManifest(manifest).errors, [], id);
    const { vitrine } = manifest;
    assert.ok(vitrine, `${id} : le manifeste déclare \`vitrine\``);
    for (const lang of ['fr', 'en']) {
      assert.ok(vitrine.description[lang].length > 0 && vitrine.description[lang].length <= 280, `${id} : la description (${lang}) tient en 280 caractères au plus`);
    }
    assert.ok(vitrine.captures.length >= 3 && vitrine.captures.length <= 6, `${id} : de trois à six captures (${vitrine.captures.length})`);
    for (const { fichier, legende } of vitrine.captures) {
      assert.ok(fichier.startsWith(`${id}/`), `${id} : « ${fichier} » est rangé dans le dossier de l'app`);
      for (const lang of ['fr', 'en']) assert.ok(legende[lang].length > 0 && legende[lang].length <= 60, `${id} : la légende de ${fichier} (${lang}) tient en 60 caractères au plus`);
      const buffer = readFileSync(join(ROOT, 'vitrine', fichier));
      assert.ok(buffer.length <= 60000, `${id} : ${fichier} pèse ${buffer.length} octets (60 000 au plus)`);
      assert.deepEqual(webpSize(buffer), [960, 600], `${id} : ${fichier} mesure 960 × 600 px`);
    }
  }
});

// Le niveau de l'app (18/11, demande du porteur : « indiquer clairement si les widgets sont en alpha, bêta ou V1 et plus ») : `maturite`, contrats 2.2.
const withLevel = maturite => ({ ...bi(), maturite });
const withoutLevel = ({ maturite, ...rest }) => rest;

test('le niveau (`maturite`) est facultatif : « alpha », « beta » ou une version stable, rien d\'autre', () => {
  assert.deepEqual(validateManifest(withoutLevel(bi())).errors, [], 'sans niveau, le manifeste reste valide : aucune pastille');
  for (const level of ['alpha', 'beta', 'v1', 'v1.1', 'v2', 'v12.30']) assert.deepEqual(validateManifest(withLevel(level)).errors, [], level);
  for (const level of ['Alpha', 'gamma', 'v0', 'v0.9', 'v1.', 'v1.1.1', '1.1', 'v', '', 1, null, ['alpha']]) {
    assert.match(validateManifest(withLevel(level)).errors.join(), /maturite : « alpha », « beta » ou une version stable/, String(level));
  }
});

test('le niveau lu du manifeste : alpha, bêta, stable avec sa version ; rien quand le manifeste n\'en dit rien ou le dit mal', () => {
  assert.deepEqual(levelOf(withLevel('alpha')), { kind: 'alpha', version: null });
  assert.deepEqual(levelOf(withLevel('beta')), { kind: 'beta', version: null });
  assert.deepEqual(levelOf(withLevel('v1.1')), { kind: 'stable', version: '1.1' });
  assert.deepEqual(levelOf(withLevel('v2')), { kind: 'stable', version: '2' });
  for (const none of [withoutLevel(bi()), withLevel('gamma'), withLevel(7), null, undefined]) assert.equal(levelOf(none), null);
});

test('les textes du niveau sont dans les deux langues, et l\'anglais ne vouvoie rien : un mot, une info-bulle par niveau', () => {
  for (const language of ['fr', 'en']) {
    for (const key of ['prefix', 'alpha', 'beta', 'alphaTip', 'betaTip', 'stableTip']) assert.ok(STRING_TABLES[language][`ap.level.${key}`], `${language} : ap.level.${key}`);
  }
  assert.equal(STRING_TABLES.fr['ap.level.beta'], 'Bêta');
  assert.equal(STRING_TABLES.en['ap.level.beta'], 'Beta');
});

test('les manifestes livrés qui disent leur niveau le disent bien : Publipostage+ et Grist-BI le portent, et la liste « Version » d\'une app stable est retirée de sa fiche', () => {
  for (const id of ['publipostage', 'bi']) {
    const manifest = readJson(`manifestes/${id}.json`);
    assert.deepEqual(validateManifest(manifest).errors, [], id);
    assert.ok(levelOf(manifest), `${id} : le manifeste porte un niveau`);
  }
});
