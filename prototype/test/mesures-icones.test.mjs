// Le jugement des mesures d'icônes de type (labo/mesures-icones.mjs, joué sous Firefox par test/icones-firefox.mjs et dans un vrai Grist par labo/run-theme.mjs) : une mesure qui ne voit pas un écart ne
// sert à rien, donc on lui montre des lignes lues à la main, bonnes puis fausses. Sans navigateur.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { typeTokens } from '../js/theme/ambiance-types.js';
import { BASE, STROKE, infoProblems, parseColor, rgbOf, rowProblems } from '../labo/mesures-icones.mjs';

const ctx = (id, mode = 'sombre', display = 'list') => ({ id, mode, display, tag: `${id}, ${mode}` });
// Une ligne « document » telle que le navigateur la calcule dans l'ambiance `id`.
function docRow(id, mode = 'sombre', display = 'list', changes = {}) {
  const stroke = STROKE[id];
  const color = rgbOf(typeTokens(id, mode)['--t-doc']);
  const [r, g, b] = parseColor(color).rgb;
  return {
    name: 'Convocation', fam: 'doc', locked: false, folder: false, color, width: BASE[display] * stroke.k, join: stroke.join, cap: stroke.cap,
    fill: stroke.fill ? `color(srgb ${r / 255} ${g / 255} ${b / 255} / 0.17)` : 'none', filter: stroke.glow ? 'drop-shadow(color(srgb 0.4 0.6 1 / 0.8) 0px 0px 2.2px)' : 'none',
    ink: rgbOf(typeTokens(id, mode)['--t-doc-ink']), ...changes,
  };
}
const kinds = (row, options) => rowProblems(row, options).map(item => item.kind.replace('icône de type : ', ''));

describe('mesures-icones : lire une couleur que le navigateur calcule', () => {
  test('rgb, rgba, mélange en color(srgb), et ce qui n\'est pas une couleur', () => {
    assert.equal(rgbOf('#2f6fed'), 'rgb(47, 111, 237)');
    assert.deepEqual(parseColor('rgb(91, 145, 245)'), { rgb: [91, 145, 245], alpha: 1 });
    assert.deepEqual(parseColor('rgba(45, 166, 250, 0.17)'), { rgb: [45, 166, 250], alpha: 0.17 });
    const mixed = parseColor('color(srgb 0.176471 0.65098 0.980392 / 0.17)');
    assert.ok(mixed.rgb.every((value, at) => Math.abs(value - [45, 166, 250][at]) < 0.5) && mixed.alpha === 0.17, 'un mélange se lit en 0 à 255');
    assert.equal(parseColor('none'), null);
    assert.equal(parseColor('transparent'), null);
  });
});

describe('mesures-icones : une ligne juste ne dit rien, une ligne fausse est vue', () => {
  test('chaque ambiance, en clair et en sombre, en liste et en vignettes : une ligne lue comme le tableau le dit est sans écart', () => {
    for (const id of Object.keys(STROKE)) for (const mode of ['clair', 'sombre']) for (const display of ['list', 'tiles']) assert.deepEqual(rowProblems(docRow(id, mode, display), ctx(id, mode, display)), [], `${id}, ${mode}, ${display}`);
  });

  test('une couleur d\'une autre ambiance, un trait de 1 px (Firefox et le nombre calculé), de mauvais angles ou bouts sont vus', () => {
    assert.deepEqual(kinds(docRow('pop', 'sombre', 'list', { color: rgbOf(typeTokens('papier', 'sombre')['--t-doc']) }), ctx('pop')).slice(0, 1), ['couleur']);
    assert.ok(kinds(docRow('papier', 'sombre', 'list', { width: 1 }), ctx('papier')).includes('épaisseur du trait'));
    assert.ok(kinds(docRow('papier', 'sombre', 'list', { join: 'round' }), ctx('papier')).includes('angles du trait'));
    assert.ok(kinds(docRow('brut', 'sombre', 'list', { cap: 'butt' }), ctx('brut')).includes('bouts du trait'));
  });

  test('en vignette, le mot du type a l\'encre du tableau', () => {
    assert.ok(kinds(docRow('brut', 'clair', 'tiles', { ink: 'rgb(1, 2, 3)' }), ctx('brut', 'clair', 'tiles')).includes('couleur du mot du type'));
  });

  test('Pop remplit à 17 % de la couleur de l\'icône ; ailleurs, rien', () => {
    assert.ok(kinds(docRow('pop', 'sombre', 'list', { fill: 'none' }), ctx('pop')).includes('remplissage doux'));
    assert.ok(kinds(docRow('pop', 'sombre', 'list', { fill: 'color(srgb 0.1 0.1 0.1 / 0.17)' }), ctx('pop')).includes('remplissage doux'), 'une autre couleur que celle de l\'icône');
    assert.ok(kinds(docRow('papier', 'sombre', 'list', { fill: 'color(srgb 0.1 0.1 0.1 / 0.17)' }), ctx('papier')).includes('remplissage'));
  });

  test('Enseigne a un halo de 2,2 px ; ailleurs, aucun filtre', () => {
    assert.ok(kinds(docRow('enseigne', 'sombre', 'list', { filter: 'none' }), ctx('enseigne')).includes('halo'));
    assert.ok(kinds(docRow('enseigne', 'sombre', 'list', { filter: 'drop-shadow(rgb(0, 0, 0) 0px 0px 4px)' }), ctx('enseigne')).includes('halo'));
    assert.ok(kinds(docRow('brut', 'sombre', 'list', { filter: 'drop-shadow(rgb(0, 0, 0) 0px 0px 2.2px)' }), ctx('brut')).includes('halo'));
  });

  test('un fichier grisé n\'a ni couleur de type, ni remplissage, ni halo ; un dossier garde son remplissage', () => {
    const grey = { name: 'Autre format', fam: null, locked: true, folder: false, color: 'rgb(163, 183, 218)', width: BASE.list * STROKE.enseigne.k, join: 'round', cap: 'round', fill: 'none', filter: 'none', ink: null };
    assert.deepEqual(rowProblems(grey, ctx('enseigne')), []);
    assert.ok(kinds({ ...grey, filter: 'drop-shadow(rgb(0, 0, 0) 0px 0px 2.2px)' }, ctx('enseigne')).includes('halo'), 'un fichier grisé ne s\'allume pas');
    assert.ok(kinds({ ...grey, color: rgbOf(typeTokens('enseigne', 'sombre')['--t-doc']) }, ctx('enseigne')).includes('couleur d\'un fichier sans famille'));
    const folder = { ...grey, name: 'Formation', locked: false, folder: true, fill: 'rgb(199, 219, 253)' };
    assert.deepEqual(rowProblems(folder, ctx('enseigne', 'sombre')).filter(item => /remplissage/.test(item.kind)), [], 'le remplissage d\'un dossier n\'est pas jugé');
  });

  test('la barre d\'information : la famille, la couleur et le trait', () => {
    const info = { fam: 'doc', color: rgbOf(typeTokens('papier', 'clair')['--t-doc']), width: BASE.info * STROKE.papier.k, join: 'miter', cap: 'butt', fill: 'none', filter: 'none' };
    assert.deepEqual(infoProblems(info, 'doc', ctx('papier', 'clair')), []);
    assert.equal(infoProblems({ ...info, width: 1 }, 'doc', ctx('papier', 'clair')).length, 1);
    assert.equal(infoProblems(null, 'doc', ctx('papier', 'clair'))[0].kind, 'barre d\'information : barre absente');
  });
});
