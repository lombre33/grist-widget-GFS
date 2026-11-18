// Les modèles de départ que les apps proposent (contrats 5.4, point 13 ; « Nouveau > Depuis un modèle », décision du porteur du 18/11 : « Une galerie commune »).
// Une app déclare `modeles` dans son manifeste (contrats 2.2) et range son catalogue dans SON dépôt : `modeles/modeles.json` et une vignette par modèle à côté. GFS ne charge
// jamais rien depuis le dépôt d'une app (sa politique de sécurité du contenu ne lit et ne montre que GFS) : cet outil copie le catalogue et ses vignettes dans le dossier
// `modeles/<app>/` de GFS, après avoir lu chaque entrée comme GFS la lira (js/apps/templates-catalogue.js). Un catalogue qui s'écarte (une entrée mal formée, une vignette
// absente ou trop lourde) n'est pas copié : les raisons sont dites, rien n'est à moitié écrit. Une app dont le dépôt n'a pas encore de `modeles/modeles.json` garde le catalogue
// provisoire que GFS porte.
//
//   node outils/modeles.mjs                    copie les catalogues et vignettes (l'app lue dans apps/<id>/, son sous-module) ; retire les vignettes d'un modèle retiré
//   node outils/modeles.mjs --app form         une seule app
//   node outils/modeles.mjs --verifier         dit ce qui est périmé, sans rien écrire (code de sortie 1)
//   node outils/modeles.mjs --depuis <dossier> lit le dépôt de l'app dans <dossier> (avec --app) : le dépôt d'une app qu'on teste, avant d'avancer sa référence

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readManifests } from './capacites.mjs';
import { parseCatalogue, TEMPLATES_FOLDER } from '../js/apps/templates-catalogue.js';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SOURCE_CATALOGUE = 'modeles/modeles.json'; // où l'app range son catalogue, dans son dépôt
export const THUMB_MAX = 50 * 1024; // une vignette plus lourde ralentit la fenêtre : 12 Ko conseillés, 50 Ko au plus
const IMAGE_RE = /\.(webp|png|jpe?g)$/i;

const same = (path, bytes) => existsSync(path) && readFileSync(path).equals(bytes);

// Ce que la copie ferait pour une app : { app, state: 'copie' | 'sans-source' | 'refusee', problems, writes: [{ path, bytes }], removes: [path] }. `from` : le dossier du
// dépôt de l'app (par défaut `apps/<id>/`).
export function planApp(manifest, { root = ROOT, from = join(root, 'apps', manifest.id) } = {}) {
  const plan = { app: manifest.id, state: 'copie', problems: [], writes: [], removes: [] };
  const sourceFile = join(from, SOURCE_CATALOGUE);
  if (!existsSync(sourceFile)) return { ...plan, state: 'sans-source' };
  let raw;
  try { raw = JSON.parse(readFileSync(sourceFile, 'utf8')); } catch (error) { return { ...plan, state: 'refusee', problems: [`${SOURCE_CATALOGUE} : ${error.message}`] }; }
  const { models, dropped } = parseCatalogue(raw, manifest);
  plan.problems.push(...dropped);
  const sourceDir = dirname(sourceFile);
  const target = join(root, TEMPLATES_FOLDER, manifest.modeles.catalogue);
  const targetDir = dirname(target);
  const kept = new Set([target.slice(targetDir.length + 1)]);
  plan.writes.push({ path: target, bytes: readFileSync(sourceFile) });
  for (const model of models) {
    if (!model.vignette) continue;
    const file = join(sourceDir, model.vignette);
    if (!existsSync(file)) { plan.problems.push(`modèle « ${model.id} » : la vignette ${model.vignette} est absente de ${SOURCE_CATALOGUE.replace(/[^/]*$/, '')}`); continue; }
    const bytes = readFileSync(file);
    if (bytes.length > THUMB_MAX) { plan.problems.push(`modèle « ${model.id} » : la vignette ${model.vignette} pèse ${Math.ceil(bytes.length / 1024)} Ko (${THUMB_MAX / 1024} Ko au plus)`); continue; }
    kept.add(model.vignette);
    plan.writes.push({ path: join(targetDir, model.vignette), bytes });
  }
  if (existsSync(targetDir)) for (const name of readdirSync(targetDir)) if (IMAGE_RE.test(name) && !kept.has(name)) plan.removes.push(join(targetDir, name));
  if (plan.problems.length) return { ...plan, state: 'refusee', writes: [], removes: [] };
  return plan;
}

// Ce qui change sur le disque : les fichiers à écrire (absents ou différents) et à retirer.
export const pending = plan => ({ writes: plan.writes.filter(item => !same(item.path, item.bytes)), removes: plan.removes });

export function main(argv, root = ROOT, write = text => process.stdout.write(`${text}\n`)) {
  const only = argv.includes('--app') ? argv[argv.indexOf('--app') + 1] : null;
  const fromFolder = argv.includes('--depuis') ? resolve(argv[argv.indexOf('--depuis') + 1]) : null;
  const check = argv.includes('--verifier');
  const manifests = readManifests(root).filter(manifest => manifest.modeles && (!only || manifest.id === only));
  if (only && !manifests.length) { write(`${only} : aucune app du catalogue qui déclare « modeles ».`); return 1; }
  let status = 0;
  for (const manifest of manifests) {
    const plan = planApp(manifest, { root, ...(fromFolder ? { from: fromFolder } : {}) });
    if (plan.state === 'sans-source') { write(`${manifest.id} : pas de ${SOURCE_CATALOGUE} dans le dépôt de l'app, le catalogue de GFS reste tel quel.`); continue; }
    if (plan.state === 'refusee') { status = 1; write(`${manifest.id} : catalogue refusé, rien n'est copié.`); plan.problems.forEach(problem => write(`  - ${problem}`)); continue; }
    const change = pending(plan);
    const count = change.writes.length + change.removes.length;
    if (!count) { write(`${manifest.id} : à jour.`); continue; }
    if (check) { status = 1; write(`${manifest.id} : périmé (${change.writes.length} fichier(s) à écrire, ${change.removes.length} à retirer).`); continue; }
    for (const item of change.writes) { mkdirSync(dirname(item.path), { recursive: true }); writeFileSync(item.path, item.bytes); }
    for (const path of change.removes) rmSync(path);
    write(`${manifest.id} : ${change.writes.length} fichier(s) écrits, ${change.removes.length} retirés.`);
  }
  return status;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv.slice(2));
