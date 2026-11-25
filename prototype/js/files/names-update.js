// La mise à jour des noms des tables de GFS dans le document (retour n° 1 du porteur, 25/11) : à l'ouverture, avant que GFS lise quoi que ce soit, GFS regarde
// si ses tables portent encore leurs noms d'avant (js/files/gfs-names.js). Si oui, le NOYAU du kit (`prepare` et `execute`, kit/js/names-update/run.js) décide,
// comme pour les apps :
//   rien à faire                 -> rien ne s'affiche ;
//   la personne n'est pas propriétaire (ou la page est en lecture seule) -> rien ne s'affiche, le document reste tel quel et GFS n'y écrit rien (`legacy`) ;
//   un nom d'arrivée est déjà pris -> pas de fenêtre, GFS le dit (`legacy`) ;
//   sinon la fenêtre commune (js/ui/names-window.js, textes du kit) : un seul lot atomique, relu avant et après, puis les formules que Grist ne suit pas (plus bas).
// GFS n'a pas besoin des lignes comptées : ses tables sont légères, et une table lourde (corbeille, fichiers) ne se compte pas en entier (guide des apps, point
// 15). Le résultat dit si le document porte encore ses noms d'avant (`legacy` : les noms d'arrivée des tables concernées) : GFS ne crée alors rien et n'écrit
// rien (js/files/own-table.js, `LegacyNames`).

import { prepare, execute } from '../../kit/js/names-update/run.js';
import { NAMES_STRINGS } from '../../kit/js/names-update/strings.js';
import { createI18n } from '../../kit/js/i18n.js';
import { planGfsNames, legacyTables, staleFormulas } from './gfs-names.js';
import { HELPERS, SHARES_TABLE, SPACES_TABLE, PLACE_TABLE } from '../sharing/sharing-model.js';
import { showNamesWindow } from '../ui/names-window.js';

const isInternal = name => /^_?grist/i.test(name);

// Les noms du document tels que le kit les lit : { tables: { '<table>': ['<colonne>', …] } } (les tables internes de Grist n'y sont pas), et, à côté (le kit ne
// lit que `tables`), `formulas` : { '<table>.<colonne>': formule } pour les colonnes que Grist calcule.
export async function readSchema(doc) {
  const [tableRows, columnRows] = await Promise.all([doc.fetchTable('_grist_Tables'), doc.fetchTable('_grist_Tables_column')]);
  const byRef = new Map(tableRows.id.map((id, at) => [id, String(tableRows.tableId[at])]));
  const tables = {};
  const formulas = {};
  for (const name of byRef.values()) if (!isInternal(name)) tables[name] = [];
  columnRows.id.forEach((id, at) => {
    const table = byRef.get(columnRows.parentId[at]);
    if (!table || !tables[table]) return;
    const colId = String(columnRows.colId[at]);
    tables[table].push(colId);
    if (columnRows.isFormula && columnRows.isFormula[at] === true && columnRows.formula[at]) formulas[`${table}.${colId}`] = String(columnRows.formula[at]);
  });
  return { tables, formulas };
}

// Les colonnes à formule que GFS a écrites : celles des tables de partage, des espaces et du placement, et les colonnes d'aide posées sur chaque table de
// fichiers. Les groupes n'en font pas partie (`Members` lit la table d'une source qui n'est pas à GFS).
const OWN_TABLES = new Set([SHARES_TABLE, SPACES_TABLE, PLACE_TABLE].map(name => name.toLowerCase()));
const HELPER_SET = new Set(HELPERS);
const isOwnFormula = (table, column) => OWN_TABLES.has(table.toLowerCase()) || HELPER_SET.has(column);

// Les formules que Grist n'a pas suivies (js/files/gfs-names.js, `rewriteFormula`), reprises en UN lot atomique : un renommage qui laisse une formule à l'ancien nom
// rend une colonne d'aide en erreur, donc plus aucun droit. Rend { ok, count, detail } ; le lot ne touche aucun nom, aucune ligne : seul le texte de formules.
export async function mendFormulas(doc, schema = null) {
  try {
    const stale = staleFormulas((schema || await readSchema(doc)).formulas, isOwnFormula);
    if (!stale.length) return { ok: true, count: 0, detail: '' };
    await doc.applyUserActions(stale.map(({ table, column, formula }) => ['ModifyColumn', table, column, { formula }]));
    const left = staleFormulas((await readSchema(doc)).formulas, isOwnFormula);
    return left.length ? { ok: false, count: stale.length, detail: left.map(item => `${item.table}.${item.column}`).join(', ').slice(0, 200) } :
      { ok: true, count: stale.length, detail: '' };
  } catch (error) { return { ok: false, count: 0, detail: String((error && error.message) || error).slice(0, 200) }; }
}

// opts : { doc (les interfaces brutes de Grist), isOwner() -> true | false | null, readOnly() -> booléen, language() -> 'fr' | 'en', container, inertTargets()
//   -> [élément],
//   show (la fenêtre : celle de GFS, js/ui/names-window.js ; les essais en donnent une autre) }
// Rend { state, legacy } : `state` est celui du kit (none, wait, blocked, done, already, skipped, refused, unknown), `legacy` les tables de GFS encore sous
// leur nom d'avant.
export async function updateNames({ doc, isOwner, readOnly, language, container, inertTargets, show = showNamesWindow }) {
  const port = {
    readSchema: () => readSchema(doc),
    isOwner: async () => isOwner(),
    readOnly: () => readOnly(),
    apply: actions => doc.applyUserActions(actions),
  };
  const canWrite = async () => { try { return !readOnly() && (await isOwner()) === true; } catch (error) { return false; } };
  // Les noms (le lot atomique du kit), puis les formules que Grist n'a pas suivies : l'un sans l'autre laisse le document à moitié fait. Les formules qui
  // échouent rendent « résultat inconnu » : « Vérifier » rejoue (les noms sont alors faits, seules les formules restent).
  const run = async () => {
    const result = await execute({ port, plan: planGfsNames });
    if (result.state !== 'done' && result.state !== 'already') return result;
    const mended = await mendFormulas(doc);
    return mended.ok ? result : { state: 'unknown', detail: mended.detail };
  };
  let state = 'wait';
  try {
    const prepared = await prepare({ port, plan: planGfsNames });
    state = prepared.state;
    if (state === 'ready') {
      const t = createI18n({ strings: NAMES_STRINGS, language: language() }).t;
      const shown = await show({ container, inertTargets, t, appName: 'GFS', prepared, run });
      state = shown.state;
    }
  } catch (error) {
    console.warn('GFS : la mise à jour des noms ne s\'est pas faite', error);
  }
  return outcomeOf(doc, state, canWrite);
}

// Ce que le document dit à la fin : les tables encore sous leur nom d'avant, et celles dont une formule l'est encore (une mise à jour interrompue entre les noms
// et les formules : reprise ici, sans fenêtre, pour qui peut écrire quand il n'y a plus de nom à changer ; sinon GFS n'écrit rien, comme pour un nom d'avant).
async function outcomeOf(doc, state, canWrite) {
  try {
    let schema = await readSchema(doc);
    let stale = staleFormulas(schema.formulas, isOwnFormula);
    if (stale.length && state === 'none' && await canWrite() && (await mendFormulas(doc, schema)).ok) {
      schema = await readSchema(doc);
      stale = staleFormulas(schema.formulas, isOwnFormula);
    }
    return { state, legacy: [...new Set([...legacyTables(schema), ...stale.map(item => item.table)])] };
  } catch (error) { return { state, legacy: [] }; }
}
