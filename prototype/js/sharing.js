// Ce que le document dit d'un geste de partage (contrats 3.3, point 6 : l'exception ; 3.4, point 8). La forme des actions est jugée avant, par
// js/sharing-rules.js ; ici on lit `_grist_Pages`, `_grist_Shares` et `_grist_Views_section` et on refuse ce qui, sans l'accord de la personne, ouvrirait un
// formulaire au public :
//   - rattacher un partage à une page qui porte déjà un formulaire marqué publié (il s'ouvrirait avec le partage) ;
//   - rattacher à une page un partage qui est déjà celui d'une autre : une clé qui fuit ouvrirait alors les deux formulaires (11.9, point 4a). Choix du porteur
//   du 11/11, « Au choix, non coché » :
//     ce n'est pas refusé, c'est demandé à la personne (js/publication-window.js, `sharedLinkQuestion`), qui reste sur « Refuser » par défaut ;
//   - rouvrir (`publish` à vrai) un partage dont une page porte un formulaire marqué publié.
// Le formulaire lui-même ne s'ouvre que par `shareOptions` : c'est CE geste qui demande l'accord de la personne (js/publication.js). GFS échoue fermé : un
// document illisible refuse le lot.

import { ERR, Refus } from './filter.js';
import { rowsOf } from './publication.js';
import { parseJson } from './sharing-rules.js';

const lower = name => String(name).toLowerCase();
const READ = ['_grist_Pages', '_grist_Shares', '_grist_Views_section', '_grist_Views', '_grist_Tables'];

const isPageShare = action => lower(action[1]) === '_grist_pages' && action[3] && typeof action[3] === 'object' && Object.hasOwn(action[3], 'shareRef');
const isShareRow = action => lower(action[1]) === '_grist_shares';
const isStep = action => Array.isArray(action) && action[0] === 'UpdateRecord' && (isShareRow(action) || isPageShare(action));

// Un lot a-t-il un geste de partage à juger d'après le document ? Poser une ligne de partage neuve (`AddRecord`) n'en demande aucun : sans page, elle n'ouvre
// rien.
export const touchesSharing = actions => actions.some(isStep);

const flaggedOn = (sections, viewRef) => sections.some(section => {
  const options = parseJson(section.shareOptions) || {};
  return section.parentId === viewRef && options.publish === true && options.form === true;
});

async function readState(port) {
  try {
    const [pages, shares, sections, views, tables] = await Promise.all(READ.map(tableId => port.doc.fetchTable(tableId)));
    return { pages: rowsOf(pages), shares: rowsOf(shares), sections: rowsOf(sections), views: rowsOf(views), tables: rowsOf(tables), asks: [] };
  } catch (error) {
    throw new Refus(ERR.REFUSE,
      `GFS ne peut pas juger ce partage : les pages, les partages ou les sections du document sont illisibles (${String((error && error.message) || error)}).`);
  }
}

// Ce que la personne lira dans la question : le nom de la page (celui de sa vue) et les tables de ses formulaires.
const nameOf = (state, page) => String((state.views.find(view => view.id === page.viewRef) || {}).name || '');
const tablesOf = (state, page) => [...new Set(state.sections.filter(section => section.parentId === page.viewRef && section.parentKey === 'form')
  .map(section => (state.tables.find(table => table.id === section.tableRef) || {}).tableId).filter(Boolean))];

function attachRefusal(state, [, , pageId, values]) {
  const page = state.pages.find(row => row.id === pageId);
  if (!page) return 'la page est introuvable.';
  if (!state.shares.some(row => row.id === values.shareRef)) return 'le partage est introuvable.';
  if (page.shareRef) return 'cette page a déjà un partage : GFS n\'en pose pas un second.';
  if (flaggedOn(state.sections,
    page.viewRef)) return 'cette page porte déjà un formulaire marqué publié : lui rattacher un partage l\'ouvrirait sans l\'accord de la personne.';
  const others = state.pages.filter(row => row.shareRef === values.shareRef);
  if (others.length) state.asks.push({ page: nameOf(state, page), others: others.map(other =>
    ({ page: nameOf(state, other), tables: tablesOf(state, other) })) });
  page.shareRef = values.shareRef;
  return null;
}

function reopenRefusal(state, [, , shareId, values]) {
  const share = state.shares.find(row => row.id === shareId);
  if (!share) return 'le partage est introuvable.';
  const wasOpen = (parseJson(share.options) || {}).publish === true;
  const opens = parseJson(values.options).publish === true && !wasOpen;
  if (opens && state.pages.some(page => page.shareRef === shareId && flaggedOn(state.sections,
    page.viewRef))) return 'rouvrir ce partage rouvrirait un formulaire marqué publié, sans l\'accord de la personne.';
  share.options = values.options;
  return null;
}

// Juge, dans l'ordre, les gestes de partage du lot ; chacun est jugé sur le document tel que les précédents du même lot le laisseraient. Rend ce qu'il faut
// demander à la personne : une entrée `{ page, others: [{ page, tables }] }` par page qui prendrait le lien d'autres pages (vide la plupart du temps).
export async function judgeSharing(port, actions) {
  const state = await readState(port);
  for (const action of actions.filter(isStep)) {
    const why = isShareRow(action) ? reopenRefusal(state, action) : attachRefusal(state, action);
    if (why) throw new Refus(ERR.REFUSE, `${action[0]} ${action[1]} : ${why}`);
  }
  return state.asks;
}
