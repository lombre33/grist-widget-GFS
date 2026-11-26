// La mise à jour des noms des tables de GFS dans le document (retour n° 1 du porteur, 25/11) : à l'ouverture, avant que GFS lise quoi que ce soit, GFS regarde
// si ses tables portent encore leurs noms d'avant (js/files/gfs-names.js). Si oui, le NOYAU du kit (`prepare` et `execute`, kit/js/names-update/run.js) décide,
// comme pour les apps :
//   rien à faire                 -> rien ne s'affiche ;
//   la personne n'est pas propriétaire (ou la page est en lecture seule) -> rien ne s'affiche, le document reste tel quel et GFS n'y écrit rien (`legacy`) ;
//   un nom d'arrivée est déjà pris -> pas de fenêtre, GFS le dit (`legacy`) ;
//   sinon la fenêtre commune (js/ui/names-window.js, textes du kit) : un seul lot atomique, relu avant et après, puis les formules et les titres de pages que
//   Grist ne suit pas (plus bas).
// GFS n'a pas besoin des lignes comptées : ses tables sont légères, et une table lourde (corbeille, fichiers) ne se compte pas en entier (guide des apps, point
// 15). Le résultat dit si le document porte encore ses noms d'avant (`legacy` : les noms d'arrivée des tables concernées) : GFS ne crée alors rien et n'écrit
// rien (js/files/own-table.js, `LegacyNames`).

import { prepare, execute } from '../../kit/js/names-update/run.js';
import { NAMES_STRINGS } from '../../kit/js/names-update/strings.js';
import { createI18n } from '../../kit/js/i18n.js';
import { planGfsNames, legacyTables, staleFormulas, stalePages } from './gfs-names.js';
import { HELPERS, SHARES_TABLE, SPACES_TABLE, PLACE_TABLE } from '../sharing/sharing-model.js';
import { HELPER_BEFORE } from '../sharing/helper-names.js';
import { SYNC_TABLE } from '../sharing/sync-rules.js';
import { FILES_NAMES } from './gfs-files.js';
import { showNamesWindow } from '../ui/names-window.js';

const isInternal = name => /^_?grist/i.test(name);

// Les noms du document tels que le kit les lit : { tables: { '<table>': ['<colonne>', …] } } (les tables internes de Grist n'y sont pas), et, à côté (le kit ne
// lit que `tables`), `formulas` : { '<table>.<colonne>': formule } pour les colonnes que Grist calcule, et `views` : [{ id, name }] les titres des pages.
export async function readSchema(doc) {
  const [tableRows, columnRows, viewRows] = await Promise.all([doc.fetchTable('_grist_Tables'), doc.fetchTable('_grist_Tables_column'),
    doc.fetchTable('_grist_Views').catch(() => null)]);
  const byRef = new Map(tableRows.id.map((id, at) => [id, String(tableRows.tableId[at])]));
  const tables = {};
  const formulas = {};
  const views = viewRows && viewRows.id ? viewRows.id.map((id, at) => ({ id, name: String(viewRows.name[at] ?? '') })) : [];
  for (const name of byRef.values()) if (!isInternal(name)) tables[name] = [];
  columnRows.id.forEach((id, at) => {
    const table = byRef.get(columnRows.parentId[at]);
    if (!table || !tables[table]) return;
    const colId = String(columnRows.colId[at]);
    tables[table].push(colId);
    if (columnRows.isFormula && columnRows.isFormula[at] === true && columnRows.formula[at]) formulas[`${table}.${colId}`] = String(columnRows.formula[at]);
  });
  // `shared` (lu par le kit, `syncTables`) : l'envoi de Sync+ est actif dans ce document (sa table technique est là), donc la table des PDF est envoyée, même
  // si sa colonne `id_sync` n'est pas encore là : elle ne se renomme pas.
  const sending = Object.keys(tables).some(name => name.toLowerCase() === SYNC_TABLE.toLowerCase());
  return { tables, formulas, views, shared: sending ? [FILES_NAMES.fr.table] : [] };
}

// Les colonnes à formule que GFS a écrites : celles des tables de partage, des espaces et du placement, et les colonnes d'aide posées sur chaque table de
// fichiers. Les groupes n'en font pas partie (`Members` lit la table d'une source qui n'est pas à GFS).
const OWN_TABLES = new Set([SHARES_TABLE, SPACES_TABLE, PLACE_TABLE].map(name => name.toLowerCase()));
const HELPER_SET = new Set([...HELPERS, ...Object.values(HELPER_BEFORE)]); // sous leurs deux noms : une table que Sync+ tient garde les siens
const isOwnFormula = (table, column) => OWN_TABLES.has(table.toLowerCase()) || HELPER_SET.has(column);

// Ce que Grist n'a pas suivi du renommage : les formules (js/files/gfs-names.js, `rewriteFormula`) et les titres des pages (`stalePages`).
const staleOf = schema => ({ formulas: staleFormulas(schema.formulas, isOwnFormula, schema.tables),
  pages: stalePages(schema.views, Object.keys(schema.tables)) });
const staleTables = stale => [...stale.formulas.map(item => item.table), ...stale.pages.map(item => item.name)];

// Les formules et les titres de pages que Grist n'a pas suivis, repris en UN lot atomique : une formule à l'ancien nom rend une colonne d'aide en erreur, donc
// plus aucun droit ; une page garde son titre français. Rend { ok, count, detail } ; le lot ne touche aucun nom de table ou de colonne, aucune ligne.
export async function mendDocument(doc, schema = null) {
  try {
    const stale = staleOf(schema || await readSchema(doc));
    const count = stale.formulas.length + stale.pages.length;
    if (!count) return { ok: true, count: 0, detail: '' };
    await doc.applyUserActions([...stale.formulas.map(({ table, column, formula }) => ['ModifyColumn', table, column, { formula }]),
      ...stale.pages.map(({ id, name }) => ['UpdateRecord', '_grist_Views', id, { name }])]);
    const left = staleTables(staleOf(await readSchema(doc)));
    return left.length ? { ok: false, count, detail: left.join(', ').slice(0, 200) } : { ok: true, count, detail: '' };
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
    const mended = await mendDocument(doc);
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

// Ce que le document dit à la fin : les tables encore sous leur nom d'avant, et celles dont une formule ou une page l'est encore (une mise à jour interrompue
// entre les noms et les formules : reprise ici, sans fenêtre, pour qui peut écrire quand il n'y a plus de nom à changer ; sinon GFS n'écrit rien, comme pour un
// nom d'avant).
async function outcomeOf(doc, state, canWrite) {
  try {
    let schema = await readSchema(doc);
    let stale = staleTables(staleOf(schema));
    if (stale.length && state === 'none' && await canWrite() && (await mendDocument(doc, schema)).ok) {
      schema = await readSchema(doc);
      stale = staleTables(staleOf(schema));
    }
    return { state, legacy: [...new Set([...legacyTables(schema), ...stale])], tables: Object.keys(schema.tables) };
  } catch (error) { return { state, legacy: [], tables: [] }; }
}
