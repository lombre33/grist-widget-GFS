// Les pages que Grist crée pour les tables de GFS (contrats 6.6). Grist ajoute une page au premier niveau, tout en bas du volet des pages, pour chaque
// `AddTable` : GFS en laissait six ou sept à plat sous sa propre page (`GFS_Rangement`, `GFS_Groupes`, `GFS_Fichiers`…), autant de lignes dans la navigation.
// Ici : la page de chaque table de GFS (préfixe `GFS_`) passe sous la page qui porte GFS, comme le glisser-déposer de Grist (`UpdateRecord` sur `_grist_Pages`,
// `indentation` et `pagePos`, vérifié dans un vrai Grist), et la page de GFS se replie par défaut (`_grist_Pages.options` = {"collapsed": true}, la case
// « Replier par défaut » du menu d'une page). La position vient du kit (`placeBelow`, js/synchro/logic/page-order.js) : juste après les dernières sous-pages,
// comme pour une page de formulaire.
//
// Une seule fois par page, sans geste (le porteur l'a demandé, 25/11), et jamais deux fois la même table : la marque `gfs.pages` (une clé de GFS, contrats 7.1
// point 3) liste les tables que GFS a déjà rangées ou vues. Une table qui n'y est pas se range (celle qu'une session a créée, celle d'un partage reçu) ; une
// table qui y est ne se touche plus : la personne qui déplace une page, ou la déplie, ne la voit jamais revenir. La page de GFS ne se replie qu'au premier
// rangement. Rien n'est déplacé quand GFS n'est pas sûr de sa page (section non reconnue, accès, lecture seule), ni pour une page que la personne a déjà mise
// sous une autre (indentation non nulle) ou qui montre autre chose que la table (une page à elle).

import { placeBelow } from '../../kit/js/synchro/logic/page-order.js';
import { toRows } from '../../kit/js/synchro/logic/common.js';
import { gfsPart } from '../broker/options-slice.js';

export const PAGES_KEY = 'gfs.pages';
export const OWN_PREFIX = 'GFS_';
const PAGES = '_grist_Pages';
const META = ['_grist_Tables', '_grist_Views_section', PAGES];

// Une table est à GFS quand son nom commence par `GFS_`, ou quand c'est l'une de ses tables-résumés de l'index des noms (`extra`, en minuscules : js/explorer/
// index-model.js, `indexNamesOf`) : celles-là portent le nom de la table de l'app.
const isOwn = (tableId, extra) => String(tableId).toLowerCase().startsWith(OWN_PREFIX.toLowerCase()) || extra.has(String(tableId).toLowerCase());

// La liste que dit la marque (des identifiants de tables, en texte), ou null quand GFS n'a encore rien noté : une marque illisible vaut « rien noté ».
export function handledOf(allOptions) {
  const value = gfsPart(allOptions)[PAGES_KEY];
  return Array.isArray(value) ? value.filter(item => typeof item === 'string') : null;
}

function parseOptions(text) {
  try {
    const value = text ? JSON.parse(text) : {};
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (error) { return {}; }
}

// La vue de la page d'une table : sa vue principale, ou, pour une table-résumé (elle n'en a pas : Grist ne lui donne que la page qu'on lui a créée), la vue de
// sa première section.
const viewOf = (table, sections) => table.primaryViewId || (sections.find(item => item.tableRef === table.id && item.parentId) || {}).parentId || 0;

// Les pages des tables de GFS : { table, page }, dans l'ordre du volet. Une page n'est « celle de la table » que si toutes ses sections montrent cette table.
function ownPages({ tables, sections, pages }, extra) {
  const found = [];
  for (const table of tables) {
    const view = isOwn(table.tableId, extra) ? viewOf(table, sections) : 0;
    const page = view ? pages.find(item => item.viewRef === view) : null;
    if (page && sections.filter(item => item.parentId === page.viewRef).every(item => item.tableRef === table.id)) found.push({ table, page });
  }
  return found.sort((a, b) => a.page.pagePos - b.page.pagePos);
}

// Le rangement à faire quand la section de GFS est `sectionId` : `{ reason }` quand GFS ne sait pas où est sa page ; sinon `{ actions, seen, moved, collapsed
// }`
// (`seen` : les tables de GFS qui ont une page, toutes ; `moved` : celles qui changent de place). `meta` : { tables, sections, pages, hasOptions } (lignes de
//   `_grist_Tables`, `_grist_Views_section` et `_grist_Pages`) ; `handled` : la marque (voir handledOf), null quand rien n'est noté ; `names` : les
//   tables-résumés de l'index des noms, qui sont à GFS aussi.
export function planTidy(meta, sectionId, handled, names = []) {
  const section = meta.sections.find(item => item.id === sectionId);
  const main = section && meta.pages.find(item => item.viewRef === section.parentId);
  if (!main) return { reason: section ? 'no-page' : 'no-section' };
  const known = new Set(handled || []);
  const local = meta.pages.map(page => ({ ...page }));
  const [anchor] = local.filter(page => page.id === main.id);
  const found = ownPages(meta, new Set(names.map(name => String(name).toLowerCase()))).filter(({ page }) => page.id !== main.id);
  const actions = []; const moved = [];
  for (const { table, page } of found.filter(({ table: { tableId } }) => !known.has(tableId))) {
    const mine = local.find(item => item.id === page.id);
    if (mine.indentation !== 0) continue; // la personne l'a rangée sous une autre page : elle la garde
    // La place d'une page neuve sous `main` : le kit la calcule pour un frère ; ici la page vient un niveau plus bas, `0` n'est la vue d'aucune page.
    const spot = placeBelow(local, [main.viewRef], 0);
    if (!spot) continue;
    Object.assign(mine, { pagePos: spot.pagePos, indentation: anchor.indentation + 1 });
    actions.push(['UpdateRecord', PAGES, page.id, { indentation: mine.indentation, pagePos: mine.pagePos }]);
    moved.push(table.tableId);
  }
  const options = parseOptions(main.options);
  const collapsed = handled === null && moved.length > 0 && meta.hasOptions && options.collapsed !== true;
  if (collapsed) actions.push(['UpdateRecord', PAGES, main.id, { options: JSON.stringify({ ...options, collapsed: true }) }]);
  return { actions, moved, collapsed, seen: found.map(({ table }) => table.tableId) };
}

export class PageTree {
  #env;
  #queue = Promise.resolve();
  #written = new Set(); // ce que la marque dit après NOTRE écriture : Grist renvoie les réglages un peu plus tard
  #warned = false;

  // env : { doc (`GristDocAPI`), state (`GristState`), section() -> { id } | { reason } (js/broker/view-options.js), enabled() (niveau `full`, document qui
  //   s'écrit), mark(liste) -> Promise (écrit la marque dans les réglages de la vue), names?() -> les tables-résumés de l'index des noms }
  constructor(env) { this.#env = env; }

  // À l'ouverture de GFS, et après chaque table que GFS vient de créer : range les pages que la marque ne connaît pas. Ne lève jamais d'erreur : au pire, les
  // pages restent où Grist les a mises. Les passages se suivent l'un l'autre.
  tidy() {
    const run = this.#queue.then(() => this.#run());
    this.#queue = run.catch(() => {});
    return run.catch(error => { this.#warn(error); });
  }

  async #run() {
    const { doc, state, section, enabled, mark } = this.#env;
    if (!enabled()) return;
    const stored = handledOf(state.allOptions);
    const handled = stored === null && !this.#written.size ? null : [...new Set([...(stored || []), ...this.#written])];
    const own = await section();
    if (!own.id) return;
    const loaded = await Promise.all(META.map(name => doc.fetchTable(name)));
    const meta = { tables: toRows(loaded[0]), sections: toRows(loaded[1]), pages: toRows(loaded[2]), hasOptions: Boolean(loaded[2]) && 'options' in loaded[2] };
    const plan = planTidy(meta, own.id, handled, this.#env.names ? this.#env.names() : []);
    if (plan.reason) return;
    if (plan.actions.length) await doc.applyUserActions(plan.actions);
    const next = [...new Set([...(handled || []), ...plan.seen])];
    if (!plan.seen.length || next.length === (handled || []).length) return;
    await mark(next);
    next.forEach(name => this.#written.add(name));
  }

  #warn(error) {
    if (this.#warned) return;
    this.#warned = true;
    console.warn('GFS : les pages de ses tables n\'ont pas pu être rangées', error);
  }
}
