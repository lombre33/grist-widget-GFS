// L'outil qui coupe les lignes trop longues (outils/couper-lignes.mjs) : il ne change que la mise en lignes, jamais le programme ni les mots des commentaires.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrapSource, fingerprint, verdict, overlong, isTextTable, WIDTH } from '../outils/couper-lignes.mjs';

const long = (word, n) => Array.from({ length: n }, (_, i) => `${word}${i}`).join(' ');
const lines = text => text.split('\n');
const widest = text => Math.max(...lines(text).map(line => line.length));

test('un commentaire trop long est refait en paragraphe, mot pour mot', () => {
  const source = `function a() {\n  // ${long('mot', 60)}\n  return 1;\n}\n`;
  const { text, error } = wrapSource(source);
  assert.equal(error, undefined);
  assert.ok(widest(text) <= WIDTH);
  assert.equal(fingerprint(text).words, fingerprint(source).words);
  assert.ok(lines(text).filter(line => line.startsWith('  // ')).length >= 2);
});

test('un paragraphe écrit large est refait d\'un trait, deux paragraphes ne se mélangent pas', () => {
  const first = long('un', 38);
  const second = long('deux', 20);
  const source = `// ${first}\n// ${first}\n//\n// ${second}\nconst x = 1;\n`;
  const { text } = wrapSource(source);
  assert.ok(widest(text) <= WIDTH);
  const paragraphs = text.split('\n//\n');
  assert.equal(paragraphs.length, 2);
  assert.ok(paragraphs[1].startsWith('// deux0'));
});

test('les puces et les étiquettes gardent leur début de ligne et mettent leur suite en retrait', () => {
  const source = `// - ${long('puce', 50)}\n// - court\nconst x = 1;\n`;
  const { text } = wrapSource(source);
  assert.ok(widest(text) <= WIDTH);
  const out = lines(text);
  assert.ok(out[0].startsWith('// - puce0'));
  assert.ok(out[1].startsWith('//   puce'));
  assert.ok(out.includes('// - court'));
});

test('une ligne qui commence autrement que la précédente n\'est pas fondue dans son paragraphe', () => {
  const source = `//       ${long('suite', 22)}\n// ${long('autre', 24)}\nconst x = 1;\n`;
  const out = lines(wrapSource(source).text);
  assert.ok(widest(out.join('\n')) <= WIDTH);
  assert.ok(out.some(line => line.startsWith('// autre0')), 'le second paragraphe garde son début de ligne');
  assert.ok(out.filter(line => line.startsWith('//       suite')).length >= 1);
  assert.ok(!out.some(line => line.startsWith('//       autre')), 'aucune ligne du second paragraphe ne prend le retrait du premier');
});

test('une ligne rangée en colonnes garde sa colonne de description, ses sœurs courtes ne bougent pas', () => {
  const source = `//   court()    un mot\n//   etiquette  ${long('texte', 40)}\nconst x = 1;\n`;
  const { text } = wrapSource(source);
  const out = lines(text);
  assert.equal(out[0], '//   court()    un mot');
  assert.ok(out[1].startsWith('//   etiquette  texte0'));
  assert.ok(out[2].startsWith(`//${' '.repeat('   etiquette  '.length)}texte`));
  assert.ok(widest(text) <= WIDTH);
});

test('un « ne finit pas une ligne, un » ou un « : » ne commence pas la suivante', () => {
  for (let pad = 120; pad < 170; pad++) {
    const source = `// ${'x'.repeat(pad)} la « citation longue » : suite ${long('mot', 30)}\nconst x = 1;\n`;
    for (const line of lines(wrapSource(source).text)) assert.ok(!/«$/.test(line) && !/^\/\/\s*[»:]/.test(line), line);
  }
});

test('un commentaire à la fin d\'une ligne de code trop longue passe au-dessus', () => {
  const code = `const value = compute(${long('argument', 12).replaceAll(' ', ', ')}); `;
  const source = `function f() {\n  ${code}// ce que fait la ligne\n}\n`;
  const { text, error } = wrapSource(source);
  assert.equal(error, undefined);
  assert.ok(lines(text).includes('  // ce que fait la ligne'));
  assert.ok(widest(text) <= WIDTH);
});

test('une ligne de code se coupe après une virgule ou un opérateur, en retrait de deux espaces, et le programme ne change pas', () => {
  const items = Array.from({ length: 24 }, (_, i) => `item${i}: value${i}`).join(', ');
  const source = `const object = { ${items} };\nconst test = first && ${Array.from({ length: 12 }, (_, i) => `second${i}`).join(' && ')};\n`;
  const { text, error } = wrapSource(source);
  assert.equal(error, undefined);
  assert.ok(widest(text) <= WIDTH);
  assert.equal(fingerprint(text).tree, fingerprint(source).tree);
  for (const line of lines(text).slice(1, -1)) if (!line.startsWith('const')) assert.ok(line.startsWith('  '), line);
});

test('on ne coupe ni dans une chaîne, ni dans un gabarit, ni dans une expression régulière', () => {
  const sentence = long('phrase', 40);
  const source = [`const s = '${sentence}';`, `const t = \`${sentence} \${a, b} ${sentence}\`;`, `const r = /${'a|'.repeat(90)}b/;`].join('\n') + '\n';
  const { text } = wrapSource(source);
  assert.equal(text, source);
});

test('pas de coupe après un « : » d\'objet ni après « return » (le sens changerait)', () => {
  const source = `function f(a) {\n  return ${Array.from({ length: 20 }, (_, i) => `a.field${i}`).join(' + ')};\n}\nconst o = { ${long('clef', 1)}: ${Array.from({ length: 20 }, (_, i) => `a.field${i}`).join(' + ')} };\n`;
  const { text, error } = wrapSource(source);
  assert.equal(error, undefined);
  assert.equal(fingerprint(text).tree, fingerprint(source).tree);
  for (const line of lines(text)) assert.ok(!/(^|\s)return$/.test(line) && !/\w:$/.test(line), line);
});

test('la vérification refuse un programme ou des commentaires qui ont changé, et accepte une simple mise en lignes', () => {
  assert.match(verdict('function f() { return 1; }', 'function f() { return\n1; }'), /programme/);
  assert.match(verdict('a(); // un mot', 'a(); // un autre mot'), /mots/);
  assert.match(verdict('// a\n// b\na();', '// a\na();'), /mots/);
  assert.equal(verdict('f(1, 2); // un mot', '// un mot\nf(1,\n  2);'), null);
});

test('on ne coupe pas après le « : » d\'une clef d\'objet', () => {
  const source = `const o = { ${'k'.repeat(100)}: ${'v'.repeat(80)} };\n`;
  assert.equal(wrapSource(source).text, source);
});

test('l\'empreinte voit un changement du programme et des mots des commentaires', () => {
  assert.notEqual(fingerprint('function f() { return\n1; }').tree, fingerprint('function f() { return 1; }').tree);
  assert.notEqual(fingerprint('a(); // un mot').words, fingerprint('a(); // un autre mot').words);
  assert.equal(fingerprint('a(\n1,\n2\n);').tree, fingerprint('a(1, 2);').tree);
});

test('un fichier qui ne se lit pas reste tel quel, avec la raison', () => {
  const source = `const x = ;\n// ${long('mot', 60)}\n`;
  const { text, error } = wrapSource(source);
  assert.equal(text, source);
  assert.match(error, /ne se lit pas/);
});

test('l\'outil est sans effet sur un texte déjà coupé', () => {
  const source = `function a() {\n  // ${long('mot', 80)}\n  const items = [${Array.from({ length: 40 }, (_, i) => `'x${i}'`).join(', ')}];\n}\n`;
  const once = wrapSource(source).text;
  assert.notEqual(once, source);
  assert.equal(wrapSource(once).text, once);
});

test('les tables de textes ne se coupent que dans leurs commentaires', () => {
  assert.ok(isTextTable('js/i18n/i18n.js') && isTextTable('js/i18n/i18n-share.js') && isTextTable('/a/b/js/i18n-explorer.js'));
  assert.ok(!isTextTable('js/controller.js'));
  const phrase = long('mot', 40);
  const source = `export const FR = { 'a.b': '${phrase}', 'c.d': '${phrase}' }; // ${long('note', 20)}\n`;
  const { text } = wrapSource(source, { code: false });
  assert.ok(lines(text).some(line => line.includes(`'a.b': '${phrase}', 'c.d'`)));
});

test('`overlong` nomme les lignes qu\'une coupe fait tenir, et seulement celles-là', () => {
  const cuttable = `const list = [${Array.from({ length: 40 }, (_, i) => `'x${i}'`).join(', ')}];\n`;
  const string = `const s = '${long('phrase', 40)}';\n`;
  assert.equal(overlong('js/a.js', cuttable).length, 1);
  assert.deepEqual(overlong('js/a.js', string), []);
  assert.deepEqual(overlong('js/a.js', 'const a = 1;\n'), []);
});
