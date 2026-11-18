// Les modèles de départ que les apps proposent (« Nouveau > Depuis un modèle », décision du porteur du 18/11 : « Une galerie commune » ; contrats 2.2, champ
// `modeles`, et 5.4, point 13). Du code sans effet de bord : il lit un catalogue déjà chargé, jamais le réseau. Le catalogue d'une app est un fichier de GFS
// (rangé dans `modeles/<app>/`, copié du dépôt de l'app par `outils/modeles.mjs`) : la politique de sécurité du contenu de GFS ne lit et ne montre que GFS.

import { extensionsOf } from './extensions.js';
import { isSafePath } from './manifest.js';
import { normalize, words, matchesWords } from '../ui/search.js';

export const TEMPLATES_FOLDER = 'modeles/';
const ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const IMAGE_RE = /\.(webp|png|jpe?g)$/i;
export const NAME_MAX = 60;
export const TEXT_MAX = 140;

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = value => typeof value === 'string' && value.trim() !== '';
// Un texte bilingue (fr et en), d'au plus `max` signes dans chaque langue.
const isBilingual = (value, max) => isObject(value) && isText(value.fr) && isText(value.en) && value.fr.length <= max && value.en.length <= max;

// L'adresse du catalogue d'une app (relative à la page de GFS), ou null quand son manifeste n'en déclare pas.
export const catalogueUrl = manifest => (manifest && manifest.modeles ? `${TEMPLATES_FOLDER}${manifest.modeles.catalogue}` : null);

// L'adresse de la vignette d'un modèle : à côté du catalogue de son app.
export const thumbUrl = (manifest, model) => {
  const base = catalogueUrl(manifest);
  return base && model.vignette ? `${base.slice(0, base.lastIndexOf('/') + 1)}${model.vignette}` : null;
};

// Pourquoi une entrée est écartée, ou '' quand elle est bonne. `types` : les types que l'app sait ouvrir ; `extensions` : les identifiants de ses extensions.
function problemWith(entry, types, extensions) {
  if (!isObject(entry)) return 'ce n\'est pas un objet';
  if (typeof entry.id !== 'string' || !ID_RE.test(entry.id)) return 'id inattendu';
  if (!types.has(entry.type)) return `type « ${entry.type} » que l'app ne sait pas ouvrir`;
  if (!isBilingual(entry.nom, NAME_MAX)) return `nom bilingue (${NAME_MAX} signes au plus) attendu`;
  if (entry.description !== undefined && !isBilingual(entry.description, TEXT_MAX)) return `description bilingue (${TEXT_MAX} signes au plus) attendue`;
  return optionsProblem(entry, extensions);
}

// Ce que l'entrée porte en plus, sans y être obligée : les étiquettes, la vignette, les extensions demandées, les tables.
function optionsProblem(entry, extensions) {
  if (entry.etiquettes !== undefined && !(Array.isArray(entry.etiquettes) && entry.etiquettes.every(tag =>
    isBilingual(tag, NAME_MAX)))) return 'étiquettes bilingues attendues';
  if (entry.vignette !== undefined && !(isSafePath(entry.vignette) && IMAGE_RE.test(
    entry.vignette))) return 'vignette : chemin relatif sûr d\'une image attendu';
  if (entry.extensions !== undefined && !(Array.isArray(entry.extensions) && entry.extensions.every(id =>
    extensions.has(id)))) return 'extension inconnue de l\'app';
  if (entry.tables !== undefined && typeof entry.tables !== 'boolean') return 'tables : true ou false attendu';
  return '';
}

// Lit un catalogue : { models, dropped } où `models` sont les entrées bien formées (dans l'ordre du fichier, un identifiant ne compte qu'une fois) et `dropped`
// les raisons des autres (un avertissement, jamais une panne : les autres modèles restent). Un catalogue qui n'est pas une liste ne donne aucun modèle.
export function parseCatalogue(raw, manifest) {
  if (!Array.isArray(raw)) return { models: [], dropped: ['le catalogue n\'est pas une liste'] };
  const types = new Set(((manifest.actions && manifest.actions.ouvrir) || []).filter(type =>
    (manifest.fichiers || []).some(spec => (spec.types || []).some(known => known.valeur === type))));
  const extensions = new Set(extensionsOf(manifest).map(item => item.id));
  const seen = new Set();
  const models = [];
  const dropped = [];
  raw.forEach((entry, index) => {
    const problem = problemWith(entry, types, extensions) || (seen.has(entry.id) ? `id « ${entry.id} » déjà pris` : '');
    if (problem) { dropped.push(`modèle ${index + 1} : ${problem}`); return; }
    seen.add(entry.id);
    models.push(entry);
  });
  return { models, dropped };
}

// Lit le catalogue d'une app avec `readJson` (le chemin d'un fichier de GFS -> son contenu) : { manifest, models, state, reason }. `state` : « ok » (au moins
// un modèle), « soon » (l'app ne déclare pas `modeles`, ou son catalogue est vide) ou « broken » (il ne se lit pas, ou chaque entrée est écartée : `reason` dit
// pourquoi). Une entrée écartée est dite à `warn`, les autres restent.
export async function loadCatalogue(manifest, readJson, warn = (...args) => console.warn(...args)) {
  const url = catalogueUrl(manifest);
  if (!url) return { manifest, models: [], state: 'soon', reason: '' };
  try {
    const { models, dropped } = parseCatalogue(await readJson(url), manifest);
    for (const problem of dropped) warn(`GFS : un modèle de ${manifest.id} est écarté (${problem})`);
    if (models.length) return { manifest, models, state: 'ok', reason: '' };
    return { manifest, models, state: dropped.length ? 'broken' : 'soon', reason: dropped[0] || '' };
  } catch (error) {
    return { manifest, models: [], state: 'broken', reason: String((error && error.message) || error).slice(0, 120) };
  }
}

// Le texte où la recherche cherche un article de la galerie (js/broker/entries.js, `templates`) : son nom, sa description, ses étiquettes, son type et son app,
// déjà dans la langue de la personne.
export const searchText = entry => normalize([entry.label, entry.description, ...entry.tags, entry.typeLabel, entry.appLabel].filter(Boolean).join(' '));

// Les articles à montrer : ceux de l'app choisie (`app`, ou 'all') dont le texte porte chaque mot de la recherche, dans n'importe quel ordre.
export function filterModels(entries, { app = 'all', query = '' } = {}) {
  const needles = words(query);
  return entries.filter(entry => (app === 'all' || entry.app === app) && matchesWords(needles, searchText(entry)));
}
