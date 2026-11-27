// Modifier un champ de l'annuaire (module Annuaire ; choix du porteur, 27/11 : « le nom du champ, la colonne, ses valeurs et son type »). Ce fichier est la
// part sans écran : ce qu'on peut changer dans Grist pour la colonne d'un champ (son type, ses valeurs), ce que Grist en fait, et les actions qui l'écrivent.
// Des fonctions sans effet de bord, essayées sous Node (test/annuaire-field-edit.test.mjs) ; la fenêtre est à js/annuaire/annuaire-field-window.js, l'écriture
// à js/annuaire/annuaire-store.js. Le nom du champ et sa colonne sont des réglages de l'annuaire (`label`, `col` : js/annuaire/annuaire-config.js) : rien n'en
// est écrit dans Grist.
//
// Ce que Grist fait d'un `ModifyColumn` qui change le type (mesuré dans un vrai Grist 1.7.19, faits vérifiés 191) : il convertit ce qu'il comprend (un texte
// « 12 » devient 12, « 2024-03-01 » une date) et laisse le reste tel quel ; mais un « Choix multiple » devient « ('A', 'B') » en texte, un lien devient un
// numéro de ligne, et un texte « A, B » ne devient pas une liste. GFS ne change donc le type d'une colonne qui a déjà des valeurs que depuis le texte ou un
// choix (et découpe lui-même en choix multiple) ; une colonne vide change de type librement ; le reste se fait dans Grist, qui propose de convertir.

// Les types qu'on propose : le type de Grist, son genre (js/annuaire/annuaire-schema.js), son texte.
export const FIELD_TYPES = Object.freeze([
  { type: 'Text', genre: 'text', key: 'an.type.text' }, { type: 'Choice', genre: 'choice', key: 'an.type.choice' },
  { type: 'ChoiceList', genre: 'choicelist', key: 'an.type.choicelist' }, { type: 'Bool', genre: 'bool', key: 'an.type.bool' },
  { type: 'Date', genre: 'date', key: 'an.type.date' }, { type: 'Numeric', genre: 'number', key: 'an.type.number' }]);

export const isChoiceGenre = genre => genre === 'choice' || genre === 'choicelist';
const TYPES = /^(Text|Choice|ChoiceList|Bool|Int|Numeric|Date)$/;
const MAX_SUGGESTED = 100; // au-delà, les valeurs trouvées ne se proposent pas toutes d'un coup

// Pourquoi la colonne ne se change pas d'ici : 'formula' (Grist la calcule), 'ref' (un lien vers une autre table), 'type' (un type que GFS ne connaît pas) ; ''
// quand elle se change.
export function editLock(col) {
  if (!col) return 'type';
  if (col.formula) return 'formula';
  if (col.genre === 'ref' || col.genre === 'reflist') return 'ref';
  return TYPES.test(col.type) ? '' : 'type';
}

// Une cellule est vide quand elle n'a rien d'autre que ce que Grist met par défaut (rien, le texte vide, zéro, « non », une liste vide).
export const isEmpty = value => value === null || value === undefined || value === '' || value === false || value === 0 ||
  (Array.isArray(value) && value.filter(each => each !== 'L').length === 0);

// Les choix d'une cellule de « Choix multiple » (['L', 'A', 'B'] donne ['A', 'B']) ; le texte d'un choix en donne un.
const itemsOf = value => (Array.isArray(value) ? value.filter(each => each !== 'L').map(String) : (isEmpty(value) ? [] : [String(value)]));

// Les valeurs d'un texte à découper en choix : à chaque virgule, point-virgule ou saut de ligne, sans doublon.
export const splitTags = text => [...new Set(String(text ?? '').split(/[,;\n]/).map(part => part.trim()).filter(Boolean))];

// Ce que la colonne peut devenir, selon ce qu'elle contient : { ok, why ('' ou la clé du texte qui dit pourquoi non), tags (le texte devient des choix),
// bestEffort (Grist convertit ce qu'il comprend) }. `cells` : les cellules de la colonne.
export function typeVerdict(col, to, cells) {
  const from = col.genre;
  if (from === to || !cells.some(cell => !isEmpty(cell))) return { ok: true, why: '', tags: false, bestEffort: false };
  if (from !== 'text' && from !== 'choice') return { ok: false, why: 'an.fld.win.noConvert', tags: false, bestEffort: false };
  return { ok: true, why: '', tags: to === 'choicelist', bestEffort: to === 'bool' || to === 'date' || to === 'number' };
}

// Les valeurs qu'on propose à une colonne qui devient un choix : celles que ses cellules portent déjà (jamais plus de MAX_SUGGESTED : au-delà, c'est du texte
// libre, pas une liste de choix).
export function suggestedChoices(to, cells) {
  const found = new Set();
  for (const cell of cells) for (const item of (to === 'choicelist' && typeof cell === 'string' ? splitTags(cell) : itemsOf(cell))) found.add(item.trim());
  found.delete('');
  return found.size <= MAX_SUGGESTED ? [...found] : [];
}

// Les options d'une colonne avec ses nouveaux choix : les autres réglages de Grist (couleurs, alignement…) restent tels qu'ils sont.
export function mergeOptions(raw, choices) {
  let object = {};
  try {
    const parsed = typeof raw === 'string' && raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) object = parsed;
  } catch (error) { object = {}; }
  return JSON.stringify({ ...object, choices });
}

// Les choix voulus pour la colonne : { wanted (la liste nette, ou null quand la colonne n'est pas un choix), added, removed, same (rien ne change) }.
function choicesPlan(col, genre, choices) {
  const wanted = isChoiceGenre(genre) ? [...new Set((choices || []).map(text => String(text).trim()).filter(Boolean))] : null;
  const current = isChoiceGenre(col.genre) ? col.choices : [];
  if (wanted === null) return { wanted, current, added: [], removed: [], same: true };
  const same = wanted.length === current.length && wanted.every((value, at) => value === current[at]);
  return { wanted, current, same, added: wanted.filter(value => !current.includes(value)), removed: current.filter(value => !wanted.includes(value)) };
}

// Ce qui s'écrit dans Grist : { type: { from, to, genre } ou null, options (le texte des options, ou null), added, removed, choices (les choix de la colonne
// après), rewrite: { ids, cells } ou null, bestEffort, changed }. `want` : { genre (le type voulu), choices }. `cells`, `ids` : les cellules de la colonne et
// leurs numéros de ligne ; `raw` : le texte des options que Grist garde pour la colonne.
export function planChange({ col, want, cells, ids, raw }) {
  const to = FIELD_TYPES.find(each => each.genre === want.genre) || FIELD_TYPES[0];
  const verdict = typeVerdict(col, to.genre, cells);
  const changing = to.genre !== col.genre && verdict.ok;
  const picked = choicesPlan(col, changing ? to.genre : col.genre, want.choices);
  const type = changing ? { from: col.type, to: to.type, genre: to.genre } : null;
  const options = picked.same ? null : mergeOptions(raw, picked.wanted);
  return { type, options, added: picked.added, removed: picked.removed, choices: picked.wanted === null ? picked.current : picked.wanted,
    rewrite: changing && verdict.tags ? tagsRewrite(cells, ids) : null, bestEffort: changing && verdict.bestEffort,
      changed: Boolean(type || options !== null) };
}

// Les cellules de texte qui deviennent des listes de choix : { ids, cells: [['L', 'A', 'B']] } ; null quand aucune cellule n'a de texte.
function tagsRewrite(cells, ids) {
  const picked = [];
  cells.forEach((cell, at) => { if (typeof cell === 'string' && cell.trim()) picked.push([ids[at], ['L', ...splitTags(cell)]]); });
  return picked.length ? { ids: picked.map(([id]) => id), cells: picked.map(([, list]) => list) } : null;
}

// Les actions de Grist d'un plan, en un seul lot (il s'applique en entier ou pas du tout) : le type et les options d'abord, puis les cellules qui deviennent
// des listes.
export function modifyActions(table, colId, plan) {
  const info = {};
  if (plan.type) info.type = plan.type.to;
  if (plan.options !== null) info.widgetOptions = plan.options;
  const actions = [['ModifyColumn', table, colId, info]];
  if (plan.rewrite) actions.push(['BulkUpdateRecord', table, plan.rewrite.ids, { [colId]: plan.rewrite.cells }]);
  return actions;
}
