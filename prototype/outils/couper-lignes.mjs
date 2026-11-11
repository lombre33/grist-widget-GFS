// Coupe les lignes trop longues du code publié (js/ et transfer/), sans changer ce que le code fait.
//
//   node outils/couper-lignes.mjs            coupe toute ligne de plus de 160 caractères des fichiers de js/ et de transfer/
//   node outils/couper-lignes.mjs --verifier dit les lignes de plus de 160 caractères que l'outil sait couper (code de sortie 1 s'il y en a) ; c'est ce que
//   contrôle `test/hygiene.test.mjs`
//   node outils/couper-lignes.mjs js/a.js …  ne regarde que ces fichiers
//
// Ce que l'outil touche :
//   - un commentaire sur sa ligne : le paragraphe est refait à 160 caractères (les listes, les étiquettes « mot : » et les lignes en retrait gardent leur début
//   de ligne) ;
//   - un commentaire à la fin d'une ligne de code : il passe sur la ligne d'au-dessus ;
//   - une ligne de code : coupée après une virgule, `&&`, `||`, `??`, `?`, `:`, `+`, `-`, `=>` ou une parenthèse ouvrante, jamais dans une chaîne, une
//   expression régulière,
//     un gabarit ni un commentaire. Les tables de textes (js/i18n*.js) ne sont pas coupées : une phrase ne se coupe pas ; leurs commentaires seulement. Chaque
//     fichier est vérifié avant d'être écrit : l'arbre du programme est le même (aux positions près), et les mots des commentaires aussi, dans le même ordre.
//     Sinon le fichier reste tel quel et l'outil le dit. L'outil est sans effet sur un fichier déjà coupé : après un conflit de fusion sur un fichier, prendre
//     une des deux versions puis relancer l'outil.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';

export const WIDTH = 160; // la largeur où l'outil coupe, et la limite que contrôle l'essai d'hygiène
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const FOLDERS = ['js', 'transfer'];

// Les mots après lesquels une fin de ligne ne change pas le sens du programme, du plus naturel (1) au moins naturel (3) pour couper.
const TIER = { ',': 1, ';': 1, '&&': 1, '||': 1, '??': 1, '+/-': 2, '?': 2, ':': 2, '=>': 3, '(': 3 };
const AFTER_BLOCK = new Set(['else', 'catch', 'finally']); // une accolade fermante suivie de l'un d'eux s'arrête là aussi
const OPEN = new Set(['(', '[', '{', '${']);
const CLOSE = new Set([')', ']', '}']);

// Le code lu comme module, sinon comme script : { ast, tokens, comments }.
function parse(source) {
  let failure;
  for (const sourceType of ['module', 'script']) {
    const tokens = [];
    const comments = [];
    try {
      const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType, locations: true, onToken: tokens, onComment: comments, allowHashBang: true });
      return { ast, tokens: tokens.filter(token => token.type !== acorn.tokTypes.eof), comments };
    } catch (error) { failure ??= error; }
  }
  throw failure;
}

// Tous les nœuds d'un arbre.
function nodesOf(node, out = []) {
  out.push(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc') continue;
    for (const item of Array.isArray(value) ? value : [value]) if (item && typeof item.type === 'string') nodesOf(item, out);
  }
  return out;
}

// Les lignes qui touchent un mot ou un commentaire s'étendant sur plusieurs lignes (gabarit, commentaire en bloc, chaîne continuée) : l'outil n'y touche pas.
function protectedLines({ tokens, comments }) {
  const lines = new Set();
  for (const item of [...tokens, ...comments]) {
    if (item.loc.start.line === item.loc.end.line) continue;
    for (let line = item.loc.start.line; line <= item.loc.end.line; line++) lines.add(line);
  }
  return lines;
}

const wordsOf = text => text.split(/\s+/).filter(Boolean);

// Un commentaire sur sa ligne : { indent, lead (les espaces après `//`), text } ; null pour une autre ligne.
function commentLine(line) {
  const found = /^(\s*)\/\/( *)(.*)$/.exec(line);
  return found ? { indent: found[1], lead: found[2], text: found[3].trimEnd() } : null;
}

const prefixOf = (parts, extra) => `${parts.indent}//${parts.lead.length ? parts.lead : ' '}${extra}`;

// Un début de ligne qui ouvre un paragraphe : un commentaire vide, un retrait, une puce, un numéro, une étiquette (« mot : »).
const LIST = /^([-*•]\s|\d+[.)]\s)/;
const LABEL = /^\S{1,28}\s+:\s/;
const isStructural = parts => parts.text === '' || parts.lead.length > 1 || LIST.test(parts.text) || LABEL.test(parts.text);

// Les mots d'un texte, chacun avec ce qui ne se sépare pas de lui à la coupe : le « qui ouvre une citation tient à son mot, et le » ou la ponctuation à espace
// avant (: ; ? ! %) tient au sien.
function unitsOf(words) {
  const units = [];
  for (const word of words) {
    if (units.length && (/^[»:;?!%]$/.test(word) || units[units.length - 1].endsWith('«'))) units[units.length - 1] += ` ${word}`;
    else units.push(word);
  }
  return units;
}

// Le texte réparti en lignes de `width` caractères au plus : la première commence par `first`, les suivantes par `rest`. Un mot plus long que la place reste
// seul sur sa ligne.
function fill(words, first, rest, width) {
  const out = [];
  let line = first;
  let empty = true;
  for (const word of unitsOf(words)) {
    if (!empty && line.length + 1 + word.length > width) { out.push(line); line = rest; empty = true; }
    line += (empty ? '' : ' ') + word;
    empty = false;
  }
  out.push(line);
  return out;
}

// Un bloc de lignes de commentaire (même retrait), coupé en paragraphes (une ligne qui commence autrement que la précédente ouvre le sien) ; rend les nouvelles
// lignes.
function rewrapBlock(block, width) {
  const paragraphs = [];
  for (const line of block) {
    const parts = commentLine(line);
    const last = paragraphs[paragraphs.length - 1];
    if (!last || isStructural(parts) || commentLine(last[0]).lead.length !== parts.lead.length) paragraphs.push([line]);
    else last.push(line);
  }
  return paragraphs.flatMap(paragraph => rewrapParagraph(paragraph, width));
}

// Une ligne qui range ses colonnes avec des espaces (« étiquette description » : une étiquette de 40 caractères au plus, qui ne finit pas une phrase, puis deux
// espaces ou plus).
const ROW_PATTERN = /^(\S.{0,38}?\S|\S)( {2,})(\S.*)$/;
const ROW = { exec: text => { const found = ROW_PATTERN.exec(text); return found && !/[.;:!?]$/.test(found[1]) ? found : null; },
  test: text => ROW.exec(text) !== null };

// Un paragraphe sans ligne trop longue reste tel quel. Une ligne rangée en colonnes se refait dans sa colonne de description ; un paragraphe qui range ses
// colonnes autrement reste tel quel. Écrit large (toutes ses lignes sauf la dernière font les trois quarts de la largeur), un paragraphe est refait d'un
// trait ; sinon seules ses lignes trop longues se coupent.
function rewrapParagraph(paragraph, width) {
  if (!paragraph.some(line => line.length > width)) return paragraph;
  const head = commentLine(paragraph[0]);
  const row = ROW.exec(head.text);
  if (row) return paragraph.length === 1 ? fill(wordsOf(row[3]), `${prefixOf(head, '')}${row[1]}${row[2]}`,
    prefixOf(head, ' '.repeat(row[1].length + row[2].length)), width) : paragraph;
  if (paragraph.some(line => ROW.test(commentLine(line).text))) return paragraph;
  const hanging = head.lead.length <= 1 && (LIST.test(head.text) || LABEL.test(head.text)) ? '  ' : '';
  const wide = paragraph.length > 1 && paragraph.slice(0, -1).every(line => line.length >= width * 0.75);
  if (wide) {
    const words = wordsOf(paragraph.map(line => commentLine(line).text).join(' '));
    return fill(words, prefixOf(head, ''), prefixOf(head, hanging), width);
  }
  return paragraph.flatMap((line, at) => {
    if (line.length <= width) return [line];
    const parts = commentLine(line);
    const extra = at === 0 ? hanging : '';
    return fill(wordsOf(parts.text), prefixOf(parts, ''), prefixOf(parts, extra), width);
  });
}

// Passe 1 : les commentaires, sur leur ligne, puis ceux qui terminent une ligne de code trop longue (ils passent au-dessus).
function wrapComments(source, width) {
  const parsed = parse(source);
  const skip = protectedLines(parsed);
  const lines = source.split('\n');
  const trailing = new Map(); // ligne → le commentaire `//` qui termine une ligne de code
  for (const comment of parsed.comments) {
    if (comment.type === 'Line' && lines[comment.loc.start.line - 1].slice(0, comment.loc.start.column).trim() !== '') trailing.set(comment.loc.start.line,
      comment);
  }
  const out = [];
  let block = [];
  const flush = () => { if (block.length) out.push(...rewrapBlock(block, width)); block = []; };
  lines.forEach((line, at) => {
    const number = at + 1;
    const own = commentLine(line);
    if (own && !skip.has(number)) {
      if (block.length && commentLine(block[0]).indent !== own.indent) flush();
      block.push(line);
      return;
    }
    flush();
    const comment = trailing.get(number);
    if (comment && line.length > width && !skip.has(number)) {
      const indent = /^\s*/.exec(line)[0];
      out.push(...rewrapBlock([`${indent}// ${comment.value.trim()}`], width), line.slice(0, comment.loc.start.column).trimEnd());
      return;
    }
    out.push(line);
  });
  flush();
  return out.join('\n');
}

// Une ligne de code coupée en morceaux de `width` caractères au plus. `cuts` : les endroits où une coupe est permise, de gauche à droite : { column, tier,
// depth }. Parmi ceux qui tiennent dans la largeur et remplissent au moins la moitié de la place (ou ouvrent un bloc), on prend le moins profond dans les
// parenthèses (on ne coupe pas un appel dans un appel quand on peut couper l'objet qui le contient), puis le plus naturel (une virgule avant un `=>`), puis le
// plus loin ; si aucun ne remplit la moitié, le meilleur qui tient et avance d'au moins 20 caractères ; si rien ne tient, le premier après la largeur. Les
// morceaux suivants sont en retrait de deux espaces.
const better = (a, b) => (a === undefined || b.depth < a.depth || (b.depth === a.depth && (b.tier < a.tier || (b.tier === a.tier && b.column > a.column))) ? b :
  a);
function splitLine(line, cuts, indent, width) {
  const pieces = [];
  let start = 0;
  let prefix = '';
  for (;;) {
    const current = prefix + line.slice(start);
    const options = cuts.filter(cut => cut.column > start + 10);
    const fits = options.filter(cut => prefix.length + cut.column - start <= width);
    const advancing = fits.filter(cut => cut.column - start >= 20);
    const filled = advancing.filter(cut => cut.tier === 0 || prefix.length + cut.column - start >= width / 2);
    const cut = (filled.length ? filled : advancing).reduce(better, undefined) || fits[fits.length - 1] || options[0];
    if (current.length <= width || cut === undefined) { pieces.push(current); return pieces; }
    pieces.push((prefix + line.slice(start, cut.column)).trimEnd());
    start = cut.column;
    while (line[start] === ' ') start++;
    prefix = `${indent}  `;
  }
}

// Les `?` et les `:` qui sont ceux d'une condition ternaire (les autres `:` sont ceux d'un objet, d'une étiquette ou d'un `case` : on n'y coupe pas).
function ternaryMarks(parsed) {
  const marks = new Set();
  for (const node of nodesOf(parsed.ast)) {
    if (node.type !== 'ConditionalExpression') continue;
    const question = parsed.tokens.find(token => token.start >= node.test.end && token.type.label === '?');
    const colon = parsed.tokens.find(token => token.start >= node.consequent.end && token.type.label === ':');
    if (question) marks.add(question.start);
    if (colon) marks.add(colon.start);
  }
  return marks;
}

// Le rang d'une coupe après ce mot (0 : la meilleure), ou `undefined` quand on ne coupe pas ici. Une accolade qui ouvre un bloc (après `)`, `=>`, `else`,
// `try`...) est la meilleure ; celle d'un objet n'en est pas une.
const BLOCK_OPENERS = new Set([')', '=>', 'else', 'try', 'finally', 'do']);
function tierOf(tokens, index) {
  const label = tokens[index].type.label;
  const next = tokens[index + 1] && tokens[index + 1].type.label;
  if (label === '{') return index > 0 && BLOCK_OPENERS.has(tokens[index - 1].type.label) ? 0 : undefined;
  if (label === '}') return AFTER_BLOCK.has(next) ? 1 : undefined;
  return TIER[label];
}

// Les endroits où couper une ligne : après une virgule, un opérateur de liaison, un `?` ou un `:` de condition ternaire, un `=>` ou une parenthèse ouvrante qui
// ne se referme pas aussitôt.
function cutsOf(tokens, ternary, inTemplate) {
  const cuts = [];
  let depth = 0;
  tokens.forEach((token, index) => {
    const label = token.type.label;
    if (OPEN.has(label)) depth++;
    if (CLOSE.has(label)) depth--;
    const tier = tierOf(tokens, index);
    if (tier === undefined || index === tokens.length - 1 || inTemplate(token.end)) return;
    if ((label === '?' || label === ':') && !ternary.has(token.start)) return;
    if (label === '(' && tokens[index + 1].type.label === ')') return;
    cuts.push({ column: token.loc.end.column, tier, depth });
  });
  return cuts;
}

// Passe 2 : les lignes de code trop longues.
function splitCode(source, width) {
  const parsed = parse(source);
  const skip = protectedLines(parsed);
  const templates = nodesOf(parsed.ast).filter(node => node.type === 'TemplateLiteral').map(node => [node.start, node.end]);
  const inTemplate = offset => templates.some(([start, end]) => offset > start && offset < end);
  const ternary = ternaryMarks(parsed);
  const byLine = new Map();
  for (const token of parsed.tokens) {
    if (!byLine.has(token.loc.start.line)) byLine.set(token.loc.start.line, []);
    byLine.get(token.loc.start.line).push(token);
  }
  return source.split('\n').flatMap((line, at) => {
    if (line.length <= width || skip.has(at + 1) || commentLine(line)) return [line];
    const indent = /^\s*/.exec(line)[0];
    return splitLine(line, cutsOf(byLine.get(at + 1) || [], ternary, inTemplate), indent, width);
  }).join('\n');
}

// Ce qui ne doit pas changer : l'arbre du programme sans ses positions, et les mots des commentaires dans l'ordre.
export function fingerprint(source) {
  const { ast, comments } = parse(source);
  const POSITIONS = new Set(['start', 'end', 'loc', 'range', 'raw']);
  return { tree: JSON.stringify(ast, (key, value) => (POSITIONS.has(key) ? undefined : value)),
    words: comments.flatMap(comment => wordsOf(comment.value)).join(' ') };
}

// Pourquoi `after` n'est pas `before` mis en lignes autrement, ou `null` quand c'est bien le même programme avec les mêmes commentaires.
export function verdict(before, after) {
  const was = fingerprint(before);
  const now = fingerprint(after);
  if (was.tree !== now.tree) return 'le programme a changé';
  if (was.words !== now.words) return 'les mots des commentaires ont changé';
  return null;
}

// Le texte coupé, ou `{ text: source, error }` quand la vérification refuse. `code: false` : les commentaires seulement.
export function wrapSource(source, { width = WIDTH, code = true } = {}) {
  try {
    const comments = wrapComments(source, width);
    const text = code ? splitCode(comments, width) : comments;
    if (text === source) return { text };
    const error = verdict(source, text);
    return error ? { text: source, error } : { text };
  } catch (error) {
    return { text: source, error: `le fichier ne se lit pas (${error.message})` };
  }
}

// Les tables de textes ne se coupent pas ailleurs que dans leurs commentaires.
export const isTextTable = file => /(^|\/)i18n[\w-]*\.js$/.test(file);

// Les fichiers publiés : ceux de js/ et de transfer/ dont le nom finit par .js ou .mjs.
export function publishedScripts(folders = FOLDERS) {
  const out = [];
  const scan = path => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = join(path, entry.name);
      if (entry.isDirectory()) scan(full);
      else if (/\.m?js$/.test(entry.name) && !entry.name.endsWith('.min.js')) out.push(full);
    }
  };
  for (const folder of folders) {
    try { scan(join(ROOT, folder)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return out.sort();
}

// Les lignes de plus de `width` caractères qu'une coupe fait tenir : [« fichier:ligne », longueur].
export function overlong(file, source, width = WIDTH) {
  const { text, error } = wrapSource(source, { width, code: !isTextTable(file) });
  if (error || text === source) return [];
  const kept = new Set(text.split('\n'));
  const found = [];
  source.split('\n').forEach((line, at) => { if (line.length > width && !kept.has(line)) found.push([`${relative(ROOT, file)}:${at + 1}`, line.length]); });
  return found;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const check = args.includes('--verifier');
  const named = args.filter(arg => !arg.startsWith('--')).map(arg => join(process.cwd(), arg));
  let changed = 0;
  let refused = 0;
  let found = 0;
  for (const file of named.length ? named : publishedScripts()) {
    const source = readFileSync(file, 'utf8');
    if (check) {
      for (const [where, length] of overlong(file, source)) { found++; process.stdout.write(`${where} : ${length} caractères (${WIDTH} au plus)\n`); }
      continue;
    }
    const { text, error } = wrapSource(source, { code: !isTextTable(file) });
    if (error) { refused++; process.stdout.write(`${relative(ROOT, file)} : laissé tel quel, ${error}\n`); continue; }
    if (text !== source) { writeFileSync(file, text); changed++; }
  }
  if (check) process.exit(found ? 1 : 0);
  process.stdout.write(`${changed} fichier(s) coupé(s)${refused ? `, ${refused} laissé(s) tel quel` : ''}\n`);
}
