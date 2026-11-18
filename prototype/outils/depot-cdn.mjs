// Le petit dépôt des fichiers que jsDelivr sert pour GFS (contrats 2.6, point 11) : un dépôt public à part, sous grist-factory, qui ne porte que les
// fichiers assemblés par GFS (aujourd'hui l'écriture en direct) et leurs licences. Il n'a pas la vie du dépôt de GFS : son adresse (dépôt + commit complet)
// ne change que lorsqu'un fichier change, et c'est celle que chaque app nomme dans sa politique de sécurité. Le dossier se fabrique ici ; seule la
// personne qui pousse sur grist-factory l'envoie, depuis sa machine (jamais depuis le cloud).
//
//   node outils/depot-cdn.mjs <dossier>                      remplit <dossier> d'après le catalogue (LICENSE, LISEZ-MOI.md, vendor/<id>/<version>/…)
//   node outils/depot-cdn.mjs <dossier> --depot <p>/<d>      autre nom de dépôt (défaut : grist-factory/gfs-bibliotheques)
//
// Le commit que donne l'envoi s'écrit ensuite dans `gfs.publication` de la liste (depot, commit, racine: "", dedie: true), puis `outils/bibliotheques.mjs --catalogue`.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { integrity, ROOT } from './bibliotheques.mjs';

export const DEFAULT_DEPOT = 'grist-factory/gfs-bibliotheques';
const OWN = new Set(['.git', 'LICENSE', 'LISEZ-MOI.md', 'vendor']);
const LICENCES_FILE = 'LICENCES.txt';

// Les fichiers à servir : ceux du catalogue qui ont une adresse de CDN et une forme de fichier assemblé (module), avec le fichier des licences du même dossier.
export function filesToServe(catalogue, root) {
  const files = [];
  for (const entry of catalogue.bibliotheques) {
    if (entry.forme !== 'module' || !entry.cdn) continue;
    files.push({ id: entry.id, version: entry.version, chemin: entry.vendorise.chemin, integrite: entry.vendorise.integrite });
    const licences = join(dirname(entry.vendorise.chemin), LICENCES_FILE);
    if (existsSync(join(root, licences))) files.push({ id: entry.id, version: entry.version, chemin: licences, integrite: null });
  }
  return files;
}

// Le dossier cible ne reçoit que ce que cet outil écrit : vide, ou déjà un dépôt fabriqué ici (son .git compris). Tout autre contenu est refusé, rien n'est écrasé.
function checkTarget(target) {
  if (!existsSync(target)) return;
  const foreign = readdirSync(target).filter(name => !OWN.has(name));
  if (foreign.length) throw new Error(`${target} contient autre chose que ce dépôt (${foreign.slice(0, 3).join(', ')}) : choisir un dossier vide`);
}

function readmeOf(depot, files) {
  const served = files.filter(file => file.integrite);
  const lines = served.map(file => `- \`${file.chemin}\` : \`${file.integrite}\``);
  return `# ${depot.split('/')[1]}

Les fichiers que le CDN (jsDelivr) sert pour **Grist Factory Suite** : des bibliothèques que GFS assemble lui-même (elles ne sont le fichier d'aucun paquet npm) et
qu'une app charge, avec leur empreinte, quand la personne choisit « Depuis un CDN » pour une extension.

Ce dépôt est **généré** par \`prototype/outils/depot-cdn.mjs\` de GFS : ne rien y modifier à la main. Chaque fichier garde le chemin \`vendor/<id>/<version>/<id>.js\`,
avec ses licences (\`LICENCES.txt\`) à côté.

## Fichiers et empreintes (sha384)

${lines.join('\n')}

## Adresse

\`https://cdn.jsdelivr.net/gh/${depot}@<commit complet>/vendor/<id>/<version>/<id>.js\`

L'adresse nomme toujours un commit **complet** : une branche ou une étiquette peut bouger sous l'empreinte, un commit non. Un nouveau commit est une nouvelle adresse,
que chaque app qui charge un de ces fichiers doit nommer dans sa politique de sécurité : n'ajouter un fichier que lorsqu'une extension en a besoin.

## Licences

Le code de GFS est sous GPL 3.0 (\`LICENSE\`). Les paquets qu'un fichier contient gardent leur licence, listée dans le \`LICENCES.txt\` de son dossier.
`;
}

// Écrit le dossier du petit dépôt ; rend la liste des fichiers écrits. Un fichier dont l'empreinte n'est pas celle du catalogue arrête tout : le catalogue et la copie divergent.
export function buildCdnRepo(root, target, depot = DEFAULT_DEPOT) {
  const catalogue = JSON.parse(readFileSync(join(root, 'bibliotheques/catalogue.json'), 'utf8'));
  const files = filesToServe(catalogue, root);
  if (!files.some(file => file.integrite)) throw new Error('aucun fichier assemblé à servir par CDN dans le catalogue');
  checkTarget(target);
  for (const file of files) {
    if (file.integrite && integrity(readFileSync(join(root, file.chemin))) !== file.integrite) throw new Error(`${file.chemin} : l'empreinte de la copie n'est pas celle du catalogue : relancer outils/bibliotheques.mjs`);
  }
  for (const file of files) {
    mkdirSync(join(target, dirname(file.chemin)), { recursive: true });
    copyFileSync(join(root, file.chemin), join(target, file.chemin));
  }
  copyFileSync(join(root, '..', 'LICENSE'), join(target, 'LICENSE'));
  writeFileSync(join(target, 'LISEZ-MOI.md'), readmeOf(depot, files));
  return ['LICENSE', 'LISEZ-MOI.md', ...files.map(file => file.chemin)];
}

// Ce que la personne lance chez elle pour envoyer le dossier ; le dernier mot donne le commit complet à transmettre.
export function pushSteps(target, depot) {
  const first = !existsSync(join(target, '.git'));
  return [
    `cd ${target}`,
    ...(first ? ['git init -b main', `git remote add origin https://github.com/${depot}.git`] : []),
    'git add -A',
    'git commit -m "Fichiers servis par CDN pour GFS"',
    'git push -u origin main',
    'git rev-parse HEAD',
  ];
}

function main(argv) {
  const [target] = argv.filter(arg => !arg.startsWith('--'));
  const at = argv.indexOf('--depot');
  const depot = at >= 0 ? argv[at + 1] : DEFAULT_DEPOT;
  if (!target || !/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9._-]+$/.test(depot || '')) {
    process.stderr.write('usage : node outils/depot-cdn.mjs <dossier> [--depot <propriétaire>/<dépôt>]\n');
    process.exitCode = 2;
    return;
  }
  const dir = resolve(target);
  const written = buildCdnRepo(ROOT, dir, depot);
  process.stdout.write(`${written.length} fichiers écrits dans ${dir}\n\nPour l'envoyer (chez vous, après avoir créé ${depot} vide sur GitHub) :\n`);
  process.stdout.write(`${pushSteps(dir, depot).map(line => `  ${line}`).join('\n')}\n\nLes 40 caractères de la dernière commande sont l'adresse à donner.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
