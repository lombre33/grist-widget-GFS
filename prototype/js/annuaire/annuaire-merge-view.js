// La vue fusionnée « Tous mes annuaires » du module Annuaire, côté contrôle (demande du porteur du 25/11, scène 11 de la maquette) : quels annuaires la
// personne y réunit (tous au départ, elle en décoche), leur lecture avec ses droits, et la forme que la fenêtre attend d'une lecture
// (js/annuaire/annuaire-window.js). La réunion elle-même, sans effet de bord, est dans js/annuaire/annuaire-merge.js. Rien ne s'écrit : la vue ne fait que lire
// ce que Grist montre à la personne.

import { mergeReads, mergedConfig, MERGED_ROW } from './annuaire-merge.js';
import { buildTree } from './annuaire-model.js';
import { isSub } from './annuaire-sub.js';

// Une vue fusionnée n'a de sens qu'avec deux annuaires au moins.
export const canMerge = list => list.length >= 2;

export class MergedView {
  #off = new Set(); // les numéros de ligne des annuaires que la personne a décochés
  #counts = {}; // le nombre de personnes de chaque annuaire à sa dernière lecture (le panneau le montre aussi pour un annuaire décoché)

  // L'annuaire de la vue, tel que la fenêtre le prend (`current`) : aucune table, un nom dans la langue du moment.
  annuaire(t, n) { return { row: MERGED_ROW, name: t('an.merge.name', { n }), table: '', config: null, merged: true }; }

  on(list) { return list.filter(each => !this.#off.has(each.row)); }

  // Coche ou décoche un annuaire ; rend faux (sans rien changer) quand ce serait en décocher le dernier.
  toggle(row, list) {
    if (this.#off.has(row)) { this.#off.delete(row); return true; }
    if (this.on(list).length <= 1) return false;
    this.#off.add(row);
    return true;
  }

  // Lit les annuaires cochés (`read(annuaire)` rend leur lecture, vue de la personne) et les réunit. Un annuaire qu'on ne peut pas lire (sa table a disparu)
  // est dit dans `skipped` et laissé de côté. Rend la lecture que la fenêtre montre : { annuaire, config, schema, data, people, tree, masked, admin, identity,
  // found, checks, merged: { sources, joined, skipped } }.
  async read(list, { read, t, admin, identity }) {
    const wanted = this.on(list);
    const settled = await Promise.all(wanted.map(async annuaire => {
      try { return { annuaire, read: await read(annuaire) }; } catch (error) { return { annuaire, error }; }
    }));
    const sources = settled.filter(each => !each.error);
    const labels = { origin: t('an.merge.origin'), path: t('an.merge.path') };
    const { people, joined, counts } = mergeReads(sources, labels);
    Object.assign(this.#counts, counts);
    const view = this.annuaire(t, wanted.length);
    return { annuaire: view, config: mergedConfig(labels), schema: {}, data: {}, people, tree: buildTree(people, [], view.name), masked: new Set(), admin,
      identity,
      found: { issues: [], counts: {}, total: 0 }, checks: { admin: false, on: false, total: 0, merged: true },
      merged: { sources: this.sources(list), joined, skipped: settled.filter(each => each.error).map(each => each.annuaire.name) } };
  }

  // Ce que le panneau « Annuaires affichés » montre : une ligne par annuaire du document.
  sources(list) {
    return list.map(each => ({ row: each.row, name: each.name, sub: isSub(each), count: this.#counts[each.row] ?? 0, on: !this.#off.has(each.row) }));
  }
}
