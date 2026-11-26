// Le geste du propriétaire pour l'index des noms (js/explorer/index-model.js) : « Index des noms… » dans le menu « Réglages ». Choix du porteur (26/11, « Index
// tenu par Grist ») : Grist tient pour chaque table de fichiers une table-résumé qui ne garde que les noms, les dates et le poids, sous les mêmes règles
// d'accès que la table d'origine ; l'explorateur la lit pour se rafraîchir seul, sans lire le contenu d'aucun fichier. Une table de plus : elle ne se crée
// qu'avec l'accord du propriétaire, dit dans une fenêtre du widget (js/rights/rights-actions.js) ; rien ne s'écrit sans lui.

import { runAction } from './rights-actions.js';
import { ask } from '../ui/ask-window.js';

export class IndexControl {
  #o;

  // opts : { writer (js/rights/rights-writer.js), t, container, inertTargets(), fullAccess(), writeBlock() (pourquoi le document ne s'écrit pas, ou null),
  //   notice(texte),
  //   refresh() (relire les fichiers), tidy?() (ranger les pages des tables-résumés sous celle de GFS, js/files/page-tree.js), ask?(options) }
  constructor(opts) { this.#o = opts; }

  // Pourquoi « Index des noms… » est grisé (une phrase), ou null. Le propriétaire est vérifié au clic (le geste dit à qui s'adresser).
  why() { return this.#o.fullAccess() ? (this.#o.writeBlock() || null) : this.#o.t('share.noAccess'); }

  // Le geste entier : le plan, la question, l'écriture. Rend true quand Grist a accepté.
  async open() {
    const o = this.#o;
    const why = this.why();
    if (why) { o.notice(why); return false; }
    const plan = await o.writer.indexPlan();
    if (!plan) { o.notice(o.t('index.notOwner')); return false; }
    if (!plan.ok) { o.notice(o.t(`index.${plan.reason}`)); return false; }
    const done = await runAction({ kind: 'index', plans: { index: plan }, t: o.t, writer: o.writer, resume: 'index',
      ask: options => (o.ask || ask)({ container: o.container, inertTargets: o.inertTargets, ...options }) });
    if (done) this.done();
    return done;
  }

  // Après l'écriture (et au retour du rechargement que Grist impose quand des règles se recopient) : la liste se relit par l'index, les pages se rangent.
  done() {
    const o = this.#o;
    if (o.tidy) void o.tidy();
    o.refresh();
    o.notice(o.t('index.done'));
  }
}
