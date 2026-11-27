// Le modèle du guide des démarches (module Guide, demande du porteur du 27/11) : les démarches d'une table, l'arbre qui s'en déduit (une démarche a une
// démarche mère ; sans mère, c'est un thème), l'héritage des rôles (un rôle vide prend celui de la mère, de proche en proche), la recherche. Du code sans effet
// de bord, essayé sous Node ; la lecture est à js/guide/guide-store.js et les écrans à js/guide/guide-window.js.
//
// L'arbre se CALCULE à chaque lecture d'après les données : rien n'est rangé nœud par nœud. Une mère qui n'existe plus ou qui fermerait une boucle ne rattache
// pas : la démarche reste à la racine, et la boucle se dit (`loops`) pour que « À vérifier » la signale.

import { lookup, valuesOf } from '../annuaire/annuaire-model.js';
import { columnOf } from '../annuaire/annuaire-schema.js';
import { normalize, words, matchesWords } from '../ui/search.js';

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const lines = value => String(value ?? '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
const listOf = cell => (Array.isArray(cell) ? cell.slice(cell[0] === 'L' ? 1 : 0) : []);
const rowId = cell => (Number.isInteger(cell) && cell > 0 ? cell : null);

// Un rôle vide n'a ni numéro de ligne ni texte : c'est lui qui laisse la mère parler.
export const filled = cell => Boolean(cell && (cell.ids.length || cell.texts.length));

// Ce qu'une cellule de rôle contient : { ids (les lignes qu'une référence désigne), texts (ce qui s'écrit : la valeur que Grist montre pour une référence, le
// texte d'une colonne de texte) }.
function roleCell(cell, col, ctx) {
  if (!col) return { ids: [], texts: [] };
  const ids = col.genre === 'ref' ? [rowId(cell)].filter(Boolean) : col.genre === 'reflist' ? listOf(cell).map(rowId).filter(Boolean) : [];
  const texts = col.genre === 'text' || col.genre === 'choice' ? [clean(cell)].filter(Boolean) : valuesOf(cell, col, ctx);
  return { ids, texts };
}

// Les mots-clés d'une cellule : un choix multiple en donne plusieurs, un texte se coupe aux virgules, aux points-virgules et aux retours à la ligne.
const keywordsOf = (cell, col, ctx) => (col && col.genre === 'choicelist' ? valuesOf(cell, col, ctx) :
  String(cell ?? '').split(/[,;\n]/).map(clean).filter(Boolean));

// Les démarches de la table : [{ row, title, parent (la ligne de la mère, ou null), keywords, steps (une étape par ligne), details, roles: { colonne: { ids,
// texts } }, kind (l'identifiant du type), extra: { champ: texte } }], triées par titre. Une ligne sans titre est ignorée (GFS ne saurait pas la nommer).
// `config` : js/guide/guide-config.js.
export function buildProcedures(config, tableId, data, schema) {
  const table = data[tableId];
  if (!table || !Array.isArray(table.id) || !config.title) return [];
  const ctx = { ...lookup(data), schema };
  const col = key => (config[key] ? columnOf(schema, tableId, config[key]) : null);
  const cell = (id, i) => (id && Array.isArray(table[id]) ? table[id][i] : undefined);
  const procs = table.id.map((row, i) => {
    const mother = col('parent') && col('parent').genre === 'ref' ? rowId(cell(config.parent, i)) : null;
    return { row, title: valuesOf(cell(config.title, i), col('title'), ctx)[0] || clean(cell(config.title, i)), parent: mother,
      keywords: keywordsOf(cell(config.keywords, i), col('keywords'), ctx), steps: lines(cell(config.steps, i)),
      details: String(cell(config.details, i) ?? '').trim(),
      kind: clean(cell(config.kind, i)), extra: Object.fromEntries(config.fields.map(field => [field.id, String(cell(field.col, i) ?? '').trim()])),
      roles: Object.fromEntries(config.roles.map(role => [role.col, roleCell(cell(role.col, i), columnOf(schema, tableId, role.col), ctx)])) };
  });
  return procs.filter(proc => proc.title).sort((a, b) => a.title.localeCompare(b.title, 'fr'));
}

// L'arbre : { byRow, parentOf (la mère retenue : la ligne, ou null), children (par ligne : les démarches filles, par titre), roots (les thèmes, par titre),
//   loops (les lignes dont la mère fermerait une boucle) }. Une démarche dont la mère est absente de la liste, ou est elle-même, reste à la racine ; une boucle
//   (A mère de B, B mère de A) met ses membres à la racine, et la dit.
export function buildIndex(procs) {
  const byRow = new Map(procs.map(proc => [proc.row, proc]));
  const reaches = (start, target) => {
    for (let at = start, steps = 0; at !== null && at !== undefined && steps <= procs.length; steps++) {
      if (at === target) return true;
      at = byRow.has(at) ? byRow.get(at).parent : null;
    }
    return false;
  };
  const parentOf = new Map();
  const children = new Map(procs.map(proc => [proc.row, []]));
  const roots = [];
  const loops = new Set();
  for (const proc of procs) {
    const mother = proc.parent !== null && proc.parent !== proc.row ? byRow.get(proc.parent) : null;
    if (proc.parent === proc.row || (mother && reaches(mother.parent, proc.row))) loops.add(proc.row);
    if (mother && !loops.has(proc.row)) { parentOf.set(proc.row, mother.row); children.get(mother.row).push(proc); }
      else { parentOf.set(proc.row, null); roots.push(proc); }
  }
  return { byRow, parentOf, children, roots, loops };
}

// Les mères d'une démarche, de la racine à la plus proche : [démarches].
export function ancestors(index, row) {
  const path = [];
  for (let at = index.parentOf.get(row); at !== null && at !== undefined && path.length <= index.byRow.size;
    at = index.parentOf.get(at)) path.unshift(index.byRow.get(at));
  return path;
}

// Combien de démarches sont sous celle-ci, tous niveaux confondus.
export function below(index, row) {
  const count = at => (index.children.get(at) || []).reduce((sum, child) => sum + 1 + count(child.row), 0);
  return count(row);
}

// Le rôle `col` d'une démarche, l'héritage compris : { cell, from (la ligne dont il vient), own (vient d'elle-même) }, ou null quand personne ne le dit jusqu'à
// la racine. Choisir un rôle pour une démarche remplace celui de sa mère pour elle et pour tout ce qui est dessous.
export function roleOf(index, row, col) {
  for (let at = row, steps = 0; at !== null && at !== undefined && steps <= index.byRow.size; steps++) {
    const proc = index.byRow.get(at);
    if (!proc) return null;
    if (filled(proc.roles[col])) return { cell: proc.roles[col], from: at, own: at === row };
    at = index.parentOf.get(at);
  }
  return null;
}

// Tous les rôles d'une démarche, dans l'ordre du guide : [{ role, cell, from, own }] ; un rôle que personne ne dit a `cell: null`.
export const rolesFor = (index, config, row) => config.roles.map(role => ({ role,
  ...(roleOf(index, row, role.col) || { cell: null, from: null, own: false }) }));

// Le texte de recherche d'une démarche : son titre, ses mots-clés et ses étapes, comparables (js/ui/search.js : accents, casse et ponctuation ignorés).
const keys = new WeakMap();
export function searchKey(proc) {
  if (!keys.has(proc)) keys.set(proc, { title: normalize(proc.title), all: normalize([proc.title, ...proc.keywords, ...proc.steps].join(' ')) });
  return keys.get(proc);
}

// Les démarches qui répondent à la recherche (des mots dans n'importe quel ordre) : celles dont le titre porte tous les mots d'abord, puis les autres, chaque
// groupe par titre.
export function searchProcedures(procs, query) {
  const needles = words(query);
  if (!needles.length) return [];
  const found = procs.filter(proc => matchesWords(needles, searchKey(proc).all));
  const inTitle = proc => matchesWords(needles, searchKey(proc).title);
  return [...found.filter(inTitle), ...found.filter(proc => !inTitle(proc))];
}
