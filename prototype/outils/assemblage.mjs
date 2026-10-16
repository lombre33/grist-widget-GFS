// Le fichier assemblé d'une bibliothèque d'extension (contrats 2.6, points 8 à 11) : plusieurs paquets npm, avec ce qu'ils tirent d'eux-mêmes (lib0,
// par exemple), en un seul module ES que GFS sert à l'extension. Les bibliothèques natives de l'app (celles de sa carte d'importation) restent en
// noms nus : l'extension et l'éditeur de l'app partagent ainsi les mêmes instances ; avec sa propre copie de ProseMirror, les curseurs des autres
// disparaissent sans une erreur (faits vérifiés, 9). L'outil refuse le fichier qui contiendrait un paquet que la liste ne nomme pas, ou dont les
// noms nus ne seraient pas exactement ceux de la liste : ce qui est servi est ce que la liste dit, rien de plus.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LIBRARY_ID_RE, EXACT_VERSION_RE } from '../js/manifest.js';

// Les réglages de la construction : les mêmes octets pour la même liste. Mesuré le 16/10 : 145 862 octets pour les six paquets de l'écriture en direct.
export const BUILD_OPTIONS = Object.freeze({ bundle: true, format: 'esm', target: 'es2022', platform: 'browser', minify: true, legalComments: 'none' });
export const LICENCES_FILE = 'LICENCES.txt';

const isNames = (value, min = 0) => Array.isArray(value) && value.length >= min && value.every(name => typeof name === 'string' && name !== '');
const ownedBy = (name, paquets) => paquets.some(paquet => name === paquet || name.startsWith(`${paquet}/`));
const sorted = values => [...values].sort();
export const sameSet = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));

export const assembledPath = ({ id, version }) => `vendor/${id}/${version}/${id}.js`;
export const licencesPath = ({ id, version }) => `vendor/${id}/${version}/${LICENCES_FILE}`;

function packageProblems(spec, dependencies) {
  if (!isNames(spec.paquets, 1)) return ['paquets : liste de noms attendue'];
  const found = [];
  if (new Set(spec.paquets).size !== spec.paquets.length) found.push('paquets : un nom est écrit deux fois');
  for (const paquet of spec.paquets) {
    if (!EXACT_VERSION_RE.test(dependencies[paquet] || '')) found.push(`la version de ${paquet} doit être exacte (reçu : ${dependencies[paquet]})`);
  }
  return found;
}

function moduleProblems(spec) {
  if (!isNames(spec.modules, 1)) return ['modules : liste de noms attendue'];
  const found = [];
  if (new Set(spec.modules).size !== spec.modules.length) found.push('modules : un nom est écrit deux fois');
  if (isNames(spec.paquets, 1)) {
    for (const name of spec.modules) if (!ownedBy(name, spec.paquets)) found.push(`le module ${name} n'est dans aucun des paquets`);
  }
  return found;
}

// Les noms nus que le fichier laisse à l'app, et les renvois (`@tiptap/pm/state` → `prosemirror-state`) : un renvoi qui mènerait ailleurs que vers un
// nom laissé à l'app ferait entrer une seconde copie de la bibliothèque dans le fichier, justement ce que l'assemblage doit éviter.
function externalProblems(spec) {
  const externes = spec.externes === undefined ? [] : spec.externes;
  if (!isNames(externes)) return ['externes : liste de noms attendue'];
  const found = [];
  if (isNames(spec.paquets, 1)) {
    for (const name of externes) if (ownedBy(name, spec.paquets)) found.push(`${name} est à la fois assemblé et laissé à l'app`);
  }
  const alias = spec.alias === undefined ? {} : spec.alias;
  if (alias === null || typeof alias !== 'object' || Array.isArray(alias)) return [...found, 'alias : objet attendu'];
  for (const [from, to] of Object.entries(alias)) {
    if (!externes.includes(to)) found.push(`alias ${from} : ${to} doit être l'un des noms laissés à l'app`);
  }
  return found;
}

// L'entrée de la liste de GFS (`gfs.bibliotheques.<id>.assemble`) lue et vérifiée : { id, forme: 'module', version, paquets, modules, externes, alias }.
// `dependencies` donne la version exacte de chaque paquet ; `version` est celle de GFS pour ce fichier, pas celle d'un paquet (2.6, point 10).
export function readAssembly(id, spec, dependencies) {
  const assemble = spec.assemble;
  const problems = [
    ...(LIBRARY_ID_RE.test(id) ? [] : ['identifiant hors format']),
    ...(EXACT_VERSION_RE.test(assemble.version || '') ? [] : [`la version du fichier de GFS doit être exacte (reçu : ${assemble.version})`]),
    ...packageProblems(assemble, dependencies), ...moduleProblems(assemble), ...externalProblems(assemble),
  ];
  if (problems.length) throw new Error(`${id} : ${problems.join(' ; ')}`);
  return {
    id, forme: 'module', version: assemble.version,
    paquets: assemble.paquets.map(paquet => ({ paquet, version: dependencies[paquet] })),
    modules: [...assemble.modules], externes: [...(assemble.externes || [])], alias: { ...(assemble.alias || {}) },
  };
}

// Le point d'entrée de la construction : chaque module demandé, rangé sous le nom de son paquet npm dans `globalThis.GfsPaquets[id]` (2.6, point 9).
export function registrySource(item) {
  const imports = item.modules.map((name, index) => `import * as m${index} from ${JSON.stringify(name)};`);
  const members = item.modules.map((name, index) => `${JSON.stringify(name)}: m${index}`);
  return `${imports.join('\n')}\n(globalThis.GfsPaquets ||= {})[${JSON.stringify(item.id)}] = { version: ${JSON.stringify(item.version)}, modules: { ${members.join(', ')} } };\n`;
}

// Le paquet (nom, dossier) auquel appartient un fichier d'entrée de esbuild : le dernier `node_modules/<nom>` du chemin.
function packageOf(path) {
  const found = [...path.matchAll(/node_modules\/((?:@[^/]+\/)?[^/]+)/g)].at(-1);
  return found ? { name: found[1], dir: path.slice(0, found.index + found[0].length) } : null;
}

// Ce que le fichier contient vraiment : Map(nom du paquet -> Set des versions), d'après les entrées que esbuild a lues.
function bundledPackages(metafile, workDir) {
  const contents = new Map();
  for (const path of Object.keys(metafile.inputs)) {
    const owner = packageOf(path);
    if (!owner) continue;
    const { version } = JSON.parse(readFileSync(join(workDir, owner.dir, 'package.json'), 'utf8'));
    contents.set(owner.name, (contents.get(owner.name) || new Set()).add(version));
  }
  return contents;
}

// Les écarts entre ce que le fichier contient (paquets, noms nus) et ce que la liste déclare. Vide : le fichier est exactement ce que la liste dit.
export function bundleProblems(item, metafile, workDir) {
  const found = [];
  const contents = bundledPackages(metafile, workDir);
  for (const { paquet, version } of item.paquets) {
    const versions = contents.get(paquet);
    if (!versions) found.push(`${paquet} est dans la liste mais le fichier n'en contient rien`);
    else if (versions.size !== 1 || !versions.has(version)) found.push(`${paquet} : le fichier contient ${[...versions].join(' et ')}, la liste dit ${version}`);
  }
  for (const name of contents.keys()) if (!item.paquets.some(({ paquet }) => paquet === name)) found.push(`${name} est dans le fichier mais pas dans la liste de GFS : l'ajouter en version exacte, ou le laisser à l'app (externes)`);
  const output = Object.values(metafile.outputs)[0];
  const bare = new Set(output.imports.filter(entry => entry.external).map(entry => entry.path));
  for (const name of bare) if (!item.externes.includes(name)) found.push(`${name} : nom nu laissé dans le fichier, absent des externes de la liste`);
  for (const name of item.externes) if (!bare.has(name)) found.push(`${name} : déclaré dans les externes mais jamais importé par le fichier`);
  return found;
}

// Construit le fichier. `workDir` contient `node_modules/<paquet>` pour chaque paquet de la liste (et rien d'autre) ; `esbuild` est le module esbuild.
// Rend { bytes, problems } : les octets du fichier et les écarts avec la liste (à refuser s'il y en a).
export async function assembleFile(item, workDir, esbuild) {
  let result;
  try {
    result = await esbuild.build({
      ...BUILD_OPTIONS, absWorkingDir: workDir, outfile: `${item.id}.js`, write: false, metafile: true, logLevel: 'silent',
      stdin: { contents: registrySource(item), resolveDir: workDir, sourcefile: 'registre.js' },
      alias: item.alias, external: item.externes,
    });
  } catch (error) {
    const reasons = (error.errors || [error]).map(entry => entry.text || entry.message).join(' ; ');
    throw new Error(`${item.id} : esbuild n'a pas pu assembler le fichier (${reasons})`);
  }
  return { bytes: Buffer.from(result.outputFiles[0].contents), problems: bundleProblems(item, result.metafile, workDir) };
}

// Les licences des paquets contenus : le texte de chaque fichier de licence, recopié tel quel, à côté du fichier assemblé (les licences MIT demandent que
// l'avis accompagne toute copie). Rend { text, problems } : un paquet sans fichier de licence ou sans licence déclarée est un écart.
export function licencesText(item, workDir) {
  const problems = [];
  const blocks = item.paquets.map(({ paquet, version }) => {
    const dir = join(workDir, 'node_modules', paquet);
    const file = existsSync(dir) ? readdirSync(dir).find(name => /^licen[cs]e(\.(md|txt))?$/i.test(name)) : null;
    const declared = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).license;
    if (!file) problems.push(`${paquet} : pas de fichier de licence dans le paquet`);
    if (!declared) problems.push(`${paquet} : licence non déclarée dans le paquet`);
    const bar = '='.repeat(72);
    return `${bar}\n${paquet}@${version} · ${declared || '?'}\n${bar}\n\n${file ? readFileSync(join(dir, file), 'utf8').trim() : ''}\n`;
  });
  const head = `Licences des paquets contenus dans ${item.id}@${item.version} (liste de GFS : bibliotheques/package.json).\nChaque texte est celui du fichier de licence livré avec le paquet, recopié par outils/bibliotheques.mjs.\n\n`;
  return { text: head + blocks.join('\n'), problems };
}

// Relit un fichier assemblé commité : il range bien ses modules sous la clé de GFS, avec la version de GFS (contrôle de bon sens, sans réseau).
// esbuild écrit une clé d'objet sans guillemets quand c'est un identifiant (`yjs:`) et avec guillemets sinon (`"y-protocols/awareness":`).
export function registeredProblems(item, bytes) {
  const text = bytes.toString('utf8');
  const found = [];
  if (!text.includes('GfsPaquets')) found.push(`${item.id} : le fichier ne range rien dans GfsPaquets`);
  if (!text.includes(`[${JSON.stringify(item.id)}]`) || !text.includes(`version:${JSON.stringify(item.version)}`)) found.push(`${item.id} : le fichier ne porte pas son identifiant et la version ${item.version}`);
  for (const name of item.modules) {
    if (![`{${name}:`, `,${name}:`, `${JSON.stringify(name)}:`].some(key => text.includes(key))) found.push(`${item.id} : le module ${name} n'est pas rangé dans le fichier`);
  }
  return found;
}
