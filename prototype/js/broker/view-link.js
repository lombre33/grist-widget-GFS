// Le lien « Select by » de la section de GFS (contrats 4.5, point 8). Grist ne dit à un widget que la ligne de sa propre section, ou de celle à laquelle il est
// relié : sans ce lien, « La table de la page » reste sur la première ligne, quelle que soit la ligne que la personne clique dans la grille. GFS a le niveau
// `full` : il écrit lui-même ce lien dans sa section, comme le fait le panneau de droite de Grist (`linkSrcSectionRef`, avec `linkSrcColRef` et
// `linkTargetColRef` à 0 pour un lien de la même table : mesuré le 21/10).
//
// Une seule fois par section, sans geste (choix du porteur, 10/11), et seulement quand rien n'est incertain : le lien n'existe pas, une seule grille de la même
// table est sur la page, GFS reconnaît sa section, et Grist confirme le lien dans ses réglages (sinon l'écriture est défaite). La marque `gfs.grille` (contrats
// 7.1, point 3) garde ce qui a été fait ou dit : une personne qui retire le lien dans Grist ne le voit jamais revenir.

import { isLinked } from '../apps/work-row.js';
import { gfsPart } from './options-slice.js';

const SECTIONS = '_grist_Views_section';
export const LINK_KEY = 'gfs.grille';
export const MARK = Object.freeze({ linked: 'lie', several: 'plusieurs' });
const SOURCES = ['record', 'single', 'detail']; // une grille, une fiche, une liste de fiches : celles d'où Grist donne un curseur
const ECHO_WAIT_MS = 3000;
const POLL_MS = 50;

// Ce que GFS fait de sa section `ownId` d'après `sections` (la table de Grist telle que `fetchTable` la rend, par colonnes) : `{ source, actions, undo }` pour
// relier ; sinon `{ reason }` : 'no-section', 'linked' (déjà relié, par la personne), 'none' (aucune grille de la même table sur la page), 'several'
// (plusieurs, qui ne se suivent pas l'une l'autre : GFS ne choisit pas pour la personne).
export function planLink(sections, ownId) {
  const at = sections.id.indexOf(ownId);
  if (at === -1) return { reason: 'no-section' };
  const before = { linkSrcSectionRef: sections.linkSrcSectionRef[at] || 0, linkSrcColRef: sections.linkSrcColRef[at] || 0,
    linkTargetColRef: sections.linkTargetColRef[at] || 0 };
  if (before.linkSrcSectionRef) return { reason: 'linked' };
  const [page, table] = [sections.parentId[at], sections.tableRef[at]];
  const found = table ? sections.id.filter((id, i) => id !== ownId && sections.parentId[i] === page && sections.tableRef[i] === table &&
    SOURCES.includes(sections.parentKey[i])) : [];
  // Une fiche déjà liée à la grille de la page suit son curseur : la grille seule est la source (une page « grille + fiche » n'est pas ambiguë).
  const sources = found.filter(id => !found.includes(sections.linkSrcSectionRef[sections.id.indexOf(id)]));
  if (sources.length !== 1) return { reason: sources.length ? 'several' : 'none' };
  return {
    source: sources[0],
    actions: [['UpdateRecord', SECTIONS, ownId, { linkSrcSectionRef: sources[0], linkSrcColRef: 0, linkTargetColRef: 0 }]],
    undo: [['UpdateRecord', SECTIONS, ownId, before]],
  };
}

export class ViewLink {
  #env;
  #done = false;

  // env : { doc (`GristDocAPI`), state (`GristState`), section() -> { id } | { reason } (la section de GFS : js/broker/view-options.js), enabled() (niveau
  //   `full`,
  //   document qui s'écrit),
  //   chosen() (une autre table de travail est choisie), mark(valeur) (écrit la marque dans les réglages de la vue), say(clé, variables), timers : { setTimeout
  //   } }
  constructor(env) { this.#env = { timers: globalThis, ...env }; }

  // À l'ouverture de GFS, une fois : relie la section à la grille de la même table quand tout est sûr. Ne lève jamais d'erreur : au pire, la section reste
  // comme elle était.
  async ensure() {
    const { state, enabled, chosen } = this.#env;
    if (this.#done || !enabled()) return;
    this.#done = true;
    const table = state.table && state.table.tableId;
    if (!table || chosen() || isLinked(state.options) || gfsPart(state.allOptions)[LINK_KEY] !== undefined) return;
    try {
      await this.#link(table);
    } catch (error) {
      console.warn('GFS : le lien de la section à la grille n\'a pas pu être posé', error);
    }
  }

  async #link(table) {
    const { doc, section, say, mark } = this.#env;
    const own = await section();
    if (!own.id) return;
    const plan = planLink(await doc.fetchTable(SECTIONS), own.id);
    if (plan.reason === 'several') { say('link.several', { table }); await mark(MARK.several); return; }
    if (!plan.actions) return;
    await doc.applyUserActions(plan.actions);
    if (await this.#confirmed()) { await mark(MARK.linked); say('link.done', { table }); return; }
    await doc.applyUserActions(plan.undo); // Grist n'a pas confirmé le lien dans nos réglages : ce n'était pas notre section, ou le lien n'a pas pris
  }

  // Grist redit les réglages de la section à chaque changement de son lien (`settings.linking.asTarget`) : le lien est posé quand il le dit.
  async #confirmed() {
    const { state, timers } = this.#env;
    for (let waited = 0; waited <= ECHO_WAIT_MS; waited += POLL_MS) {
      if (isLinked(state.options)) return true;
      await new Promise(resolve => timers.setTimeout(resolve, POLL_MS));
    }
    return false;
  }
}
