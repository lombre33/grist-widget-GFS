// Hygiène du code publié (audit du code du 09/11 ; CLAUDE.md, « Règles de code ») : les seuils de l'outil d'audit et quelques règles de forme, lus dans le code de `js/` et de `transfer/` (le kit et les apps
// sont des sous-modules : leurs dépôts ont leurs propres essais). Un fichier ou une fonction qui passe un seuil fait échouer l'essai AVANT le push, avec le nom et la ligne ; on découpe, on n'élargit pas la liste.
//
// Les seuils sont ceux de l'outil d'audit (cahier 3.3, point 1) : un fichier de 600 lignes de code au plus (une ligne de code porte au moins un mot du langage : ni vide ni commentaire), une fonction de 80 lignes au plus,
// une complexité de McCabe de 15 au plus sur le corps propre de la fonction (`if`, boucle, `case`, `catch`, ternaire, `&&`, `||` et `??` comptés ; une fonction interne se compte à part). Une fonction appelée
// aussitôt (le `(function () { … })()` de `transfer/transfer.js`) ne compte que ses propres lignes, sans celles des fonctions qu'elle contient.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import { overlong, publishedScripts, WIDTH } from '../outils/couper-lignes.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const MAX_FILE_LINES = 600;
const MAX_FUNCTION_LINES = 80;
const MAX_COMPLEXITY = 15;
// Ce qui est publié par GFS : les modules du courtier et de l'explorateur, et la page de transfert.
const SOURCES = ['js', 'transfer'];
// Les prénoms qu'aucun fichier publié ne doit porter, commentaires compris (CLAUDE.md : « aucun prénom de personne dans le code publié »). Ajouter ici celui qu'on découvre.
const FIRST_NAMES = ['Antoine'];
// Ce qui est publié et peut se lire : le code, les feuilles de style, les pages, les manifestes.
const PUBLISHED = [...SOURCES, 'css', 'manifestes', 'index.html'];

const FUNCTION = /Function/;
const BRANCHES = new Set(['IfStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement', 'WhileStatement', 'DoWhileStatement', 'ConditionalExpression', 'CatchClause', 'LogicalExpression']);

// Les fichiers sous `dir` (relatif à prototype/) dont le nom finit par `ending`, en ordre.
function filesUnder(dir, endings) {
  const out = [];
  const scan = path => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = join(path, entry.name);
      if (entry.isDirectory()) scan(full);
      else if (endings.some(ending => entry.name.endsWith(ending)) && !entry.name.endsWith('.min.js')) out.push(full);
    }
  };
  try { scan(join(ROOT, dir)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return out;
}

// Le fichier lu comme module, sinon comme script (`transfer/transfer.js` n'en est pas un) : { ast, codeLines }.
function parse(source) {
  for (const sourceType of ['module', 'script']) {
    const tokens = [];
    try {
      const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType, locations: true, onToken: tokens, allowHashBang: true });
      const lines = new Set();
      for (const token of tokens) if (token.type !== acorn.tokTypes.eof) for (let line = token.loc.start.line; line <= token.loc.end.line; line++) lines.add(line); // la fin du fichier n'est pas du code
      return { ast, codeLines: lines.size };
    } catch (error) { if (sourceType === 'script') throw error; }
  }
  return null;
}

// Les nœuds enfants d'un nœud.
function children(node) {
  const out = [];
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc') continue;
    for (const item of Array.isArray(value) ? value : [value]) if (item && typeof item.type === 'string') out.push(item);
  }
  return out;
}

// Tous les nœuds, le parent avec chacun : [node, parent].
function nodesOf(ast) {
  const out = [];
  const visit = (node, parent) => { out.push([node, parent]); for (const child of children(node)) visit(child, node); };
  visit(ast, null);
  return out;
}

// La complexité de McCabe du corps propre d'une fonction (une fonction interne se compte à part).
function complexity(fn) {
  let total = 1;
  const visit = (node, top) => {
    if (!top && FUNCTION.test(node.type)) return;
    if (BRANCHES.has(node.type) || (node.type === 'SwitchCase' && node.test) || (node.type === 'AssignmentExpression' && /^(&&|\|\||\?\?)=$/.test(node.operator))) total++;
    for (const child of children(node)) visit(child, false);
  };
  visit(fn, true);
  return total;
}

// Les lignes d'une fonction : de la première à la dernière ; pour une fonction appelée aussitôt, sans celles des fonctions qu'elle contient.
function lengthOf(fn, parent) {
  const whole = fn.loc.end.line - fn.loc.start.line + 1;
  if (!parent || parent.type !== 'CallExpression' || parent.callee !== fn) return whole;
  const inner = new Set();
  const visit = node => {
    for (const child of children(node)) {
      if (FUNCTION.test(child.type)) { for (let line = child.loc.start.line; line <= child.loc.end.line; line++) inner.add(line); } else visit(child);
    }
  };
  visit(fn);
  return whole - inner.size;
}

// Ce que l'audit trouverait à redire au code publié : une phrase par défaut.
function overruns() {
  const found = [];
  for (const file of SOURCES.flatMap(dir => filesUnder(dir, ['.js', '.mjs']))) {
    const name = relative(ROOT, file);
    const parsed = parse(readFileSync(file, 'utf8'));
    if (!parsed) { found.push(`${name} : illisible pour l'analyse`); continue; }
    if (parsed.codeLines > MAX_FILE_LINES) found.push(`${name} : ${parsed.codeLines} lignes de code (${MAX_FILE_LINES} au plus)`);
    for (const [node, parent] of nodesOf(parsed.ast)) {
      if (!FUNCTION.test(node.type)) continue;
      const where = `${name}:${node.loc.start.line} ${node.id ? node.id.name : '(sans nom)'}`;
      const length = lengthOf(node, parent);
      if (length > MAX_FUNCTION_LINES) found.push(`${where} : ${length} lignes (${MAX_FUNCTION_LINES} au plus)`);
      const cx = complexity(node);
      if (cx > MAX_COMPLEXITY) found.push(`${where} : complexité ${cx} (${MAX_COMPLEXITY} au plus)`);
    }
  }
  return found;
}

test('aucun fichier au-dessus de 600 lignes de code, aucune fonction au-dessus de 80 lignes ni de la complexité 15 (seuils de l\'outil d\'audit)', () => {
  assert.deepEqual(overruns(), [], 'on découpe (un module, un assistant), on ne relève pas le seuil');
});

// Pas de `console.log` dans le code publié (avertissements et erreurs seulement), jamais `window.onmessage =` (cela remplacerait l'écoute du script d'API de Grist : `addEventListener('message')`).
// Un port de message (`port.onmessage =`) n'a que nous pour l'écouter : permis.
const WINDOWS = new Set(['window', 'self', 'globalThis', 'top', 'parent']);
function formFaultsIn(ast, name) {
  const found = [];
  for (const [node] of nodesOf(ast)) {
    const member = node.type === 'CallExpression' ? node.callee : (node.type === 'AssignmentExpression' ? node.left : null);
    if (!member || member.type !== 'MemberExpression' || member.computed) continue;
    const where = `${name}:${node.loc.start.line}`;
    if (node.type === 'CallExpression' && member.object.name === 'console' && member.property.name === 'log') found.push(`${where} : console.log`);
    if (node.type === 'AssignmentExpression' && member.property.name === 'onmessage' && WINDOWS.has(member.object.name)) found.push(`${where} : ${member.object.name}.onmessage = (addEventListener('message') et event.source)`);
  }
  return found;
}

const formFaults = () => SOURCES.flatMap(dir => filesUnder(dir, ['.js', '.mjs'])).flatMap(file => {
  const parsed = parse(readFileSync(file, 'utf8'));
  return parsed ? formFaultsIn(parsed.ast, relative(ROOT, file)) : [];
});

test('ni console.log ni onmessage = dans le code publié', () => {
  assert.deepEqual(formFaults(), []);
});

// Le rangement de js/ (11/11 ; `mail/` ajouté le 13/11 pour la boîte d'envoi des e-mails) : un dossier par sujet, sans sous-dossier, et seuls l'entrée et le contrôleur à la racine. Un module nouveau va dans le dossier de son sujet ; un dossier nouveau se décide (CLAUDE.md, « Architecture en une minute »).
const JS_FOLDERS = ['apps', 'broker', 'explorer', 'files', 'i18n', 'mail', 'rights', 'sharing', 'shell', 'theme', 'ui', 'weight'];
const JS_ROOT = ['controller.js', 'gfs.js'];

test('js/ est rangé par sujet : douze dossiers sans sous-dossier, et à la racine seulement gfs.js et controller.js', () => {
  const entries = readdirSync(join(ROOT, 'js'), { withFileTypes: true });
  assert.deepEqual(entries.filter(entry => entry.isFile()).map(entry => entry.name).sort(), JS_ROOT, `à la racine de js/ : ${JS_ROOT.join(' et ')} seulement ; rangez le module nouveau dans le dossier de son sujet (${JS_FOLDERS.join(', ')})`);
  assert.deepEqual(entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort(), JS_FOLDERS, 'les dossiers de js/ sont ceux de la liste (hygiene.test.mjs) ; un dossier nouveau se décide');
  for (const folder of JS_FOLDERS) assert.deepEqual(readdirSync(join(ROOT, 'js', folder), { withFileTypes: true }).filter(entry => !entry.isFile() || !entry.name.endsWith('.js')).map(entry => entry.name), [], `js/${folder}/ : des modules seulement, sans sous-dossier`);
});

test(`aucune ligne de plus de ${WIDTH} caractères que l'outil de coupe sait couper`, () => {
  const found = publishedScripts().flatMap(file => overlong(file, readFileSync(file, 'utf8')));
  assert.deepEqual(found.slice(0, 10), [], `${found.length} ligne(s) trop longue(s) : lancez \`node outils/couper-lignes.mjs\` (dans prototype/), il les coupe sans changer le code`);
});

// Tous les fichiers lisibles de ce qui est publié (`PUBLISHED`), en chemins complets.
const publishedFiles = () => PUBLISHED.flatMap(entry => (entry.includes('.') ? [join(ROOT, entry)] : filesUnder(entry, ['.js', '.mjs', '.css', '.html', '.json', '.md'])));

test('aucun prénom de personne dans le code publié, commentaires compris', () => {
  const found = [];
  const pattern = new RegExp(`\\b(${FIRST_NAMES.join('|')})\\b`, 'i');
  for (const file of publishedFiles()) {
    readFileSync(file, 'utf8').split('\n').forEach((line, at) => { if (pattern.test(line)) found.push(`${relative(ROOT, file)}:${at + 1}`); });
  }
  assert.deepEqual(found, []);
});

// Un conflit de Git laissé tel quel dans un fichier publié (`<<<<<<<`, `=======`, `>>>>>>>` en début de ligne). Le 11/11, index.html en a porté pendant plusieurs commits : deux lignes de politique de sécurité,
// que le navigateur ne retient plus quand du texte les sort de l'en-tête de la page, donc aucune politique appliquée, sans qu'aucun essai ne le voie.
const CONFLICT = /^(<{7}( |$)|={7}$|>{7}( |$))/;
const conflictsIn = text => text.split('\n').flatMap((line, at) => (CONFLICT.test(line) ? [at + 1] : []));

test('aucun marqueur de conflit de Git dans ce qui est publié, et une seule politique de sécurité dans index.html', () => {
  const found = publishedFiles().flatMap(file => conflictsIn(readFileSync(file, 'utf8')).map(at => `${relative(ROOT, file)}:${at}`));
  assert.deepEqual(found, []);
  const page = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.equal(page.match(/http-equiv="Content-Security-Policy"/g)?.length, 1, 'une seule balise de politique de sécurité');
  const head = page.slice(0, page.indexOf('</head>'));
  assert.ok(head.includes('http-equiv="Content-Security-Policy"'), 'la politique est dans l\'en-tête de la page : ailleurs, le navigateur ne la retient pas');
});

test('le détecteur de conflit voit les trois marqueurs et rien d\'autre', () => {
  assert.deepEqual(conflictsIn('a\n<<<<<<< HEAD\nb\n=======\nc\n>>>>>>> dc61a14 (message)\nd'), [2, 4, 6]);
  assert.deepEqual(conflictsIn('x = a <<<<<<< b\n// =======\n  =======\n<<<<<<<<'), [], 'au milieu d\'une ligne, indentés ou trop longs : pas des marqueurs');
});

// Dependabot (cahier 3.3, point 5 ; 4.7) : les outils d'essai, la liste des bibliothèques que GFS porte pour les extensions, et les références des sous-modules. Une liste de bibliothèques que personne ne surveille
// laisse une faille sans alerte, alors que la version vendorisée en dépend.
function dependabotEntries() {
  const text = readFileSync(join(ROOT, '..', '.github', 'dependabot.yml'), 'utf8');
  return text.split(/^\s*- package-ecosystem:\s*/m).slice(1).map(block => ({ ecosystem: block.split(/\s/)[0].replace(/["']/g, ''), directory: (/^\s*directory:\s*["']?([^\s"']+)/m.exec(block) || [])[1] }));
}

test('Dependabot surveille les outils d\'essai, la liste des bibliothèques de GFS et les références des sous-modules', () => {
  const watched = dependabotEntries().map(entry => `${entry.ecosystem} ${entry.directory}`);
  for (const wanted of ['npm /prototype', 'npm /prototype/bibliotheques', 'gitsubmodule /']) assert.ok(watched.includes(wanted), `${wanted} : à ajouter à .github/dependabot.yml (reçu : ${watched.join(', ')})`);
});

// Les bibliothèques natives d'une app (`natifDe` dans la liste de GFS) suivent la version de leur app : Dependabot ne les propose pas, et rien d'autre n'est ignoré sans raison.
test('Dependabot ignore exactement les paquets natifs de la liste de GFS', () => {
  const text = readFileSync(join(ROOT, '..', '.github', 'dependabot.yml'), 'utf8');
  const block = text.split(/^\s*- package-ecosystem:\s*/m).find(part => /directory:\s*\/prototype\/bibliotheques\b/.test(part)) || '';
  const ignored = [...block.matchAll(/^\s*- dependency-name:\s*["']?([^\s"']+)/gm)].map(match => match[1]).sort();
  const list = JSON.parse(readFileSync(join(ROOT, 'bibliotheques', 'package.json'), 'utf8'));
  const natives = [...new Set(Object.values(list.gfs.bibliotheques).filter(spec => spec.natifDe).map(spec => spec.paquet))].sort();
  assert.deepEqual(ignored, natives, 'chaque paquet `natifDe` de bibliotheques/package.json est ignoré par Dependabot, et seulement eux');
});

test('l\'analyse voit bien ce qu\'elle doit voir : une fonction trop longue, trop complexe, un console.log, un onmessage =, une fonction appelée aussitôt, les lignes de code', () => {
  const long = `function long() {\n${'  doIt();\n'.repeat(80)}}`;
  const twisted = `function twisted(a) {\n${'  if (a) a = a && a;\n'.repeat(8)}}`;
  const iife = `(function () {\n  function inner() {\n${'    doIt();\n'.repeat(90)}  }\n  inner();\n})();`;
  const parsed = parse(`// un commentaire\n\n${long}\n\n${twisted}\nconsole.log(1);\nconsole.warn(1);\nwindow.onmessage = () => {};\nport.onmessage = () => {};\nwindow.addEventListener('message', () => {});\n${iife}\n`);
  const sizes = new Map(nodesOf(parsed.ast).filter(([node]) => FUNCTION.test(node.type)).map(([node, parent]) => [node.id ? node.id.name : 'iife', { length: lengthOf(node, parent), cx: complexity(node) }]));
  assert.equal(sizes.get('long').length, 82);
  assert.equal(sizes.get('twisted').cx, 1 + 8 + 8, 'chaque `if` et chaque `&&` compte');
  assert.equal(sizes.get('inner').length, 92, 'une fonction interne se compte quand même');
  assert.equal(sizes.get('iife').length, 3, 'la fonction appelée aussitôt ne compte que ses lignes à elle');
  assert.equal(parsed.codeLines, 82 + 10 + 5 + 95, 'ni les lignes vides ni les commentaires ne comptent');
  assert.deepEqual(formFaultsIn(parsed.ast, 'x.js').map(fault => fault.replace(/ \(.*/, '')), ['x.js:96 : console.log', 'x.js:98 : window.onmessage =']);
});
