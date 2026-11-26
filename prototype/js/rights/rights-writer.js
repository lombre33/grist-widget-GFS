// Poser et retirer des règles depuis le panneau « Permissions » (étape 7, lot a ; contrats 11.5) : relit les règles en place (un propriétaire prouvé
// seulement), fait le plan (js/rights/rights-plan.js) et l'envoie en UNE `applyUserActions`. Grist recharge alors la page de tout le monde, celle qui pose
// comprise (11.5, point 3) : avant d'écrire, GFS retient dans son navigateur (clé `gfs.reprise`, jamais dans le document) qu'il doit rouvrir le panneau au
// retour, et le retire si l'écriture échoue.

import { planShared, planRemoveLevel, planCloseStructure, planOpenStructure, planSharingFor, planUnsharing } from './rights-plan.js';
import { planIndex } from '../explorer/index-model.js';

const PLANS = { shared: planShared, 'remove-level': planRemoveLevel, close: planCloseStructure, open: planOpenStructure, sharing: planSharingFor,
  unsharing: planUnsharing, index: planIndex };
// L'index des noms ne lit pas les tables de fichiers (la plus lourde du document) : il n'a besoin que des tables et des colonnes ; son plan est à part
// (`indexPlan`), il n'est pas dans ceux du panneau.
const READING = { index: { files: false } };
// Un plan qui a besoin de plusieurs gestes (`again`, js/explorer/index-model.js) en fait au plus ce nombre.
const ROUNDS = 3;
export const KINDS = Object.freeze(Object.keys(PLANS));
export const RESUME_KEY = 'gfs.reprise';

export class RightsWriter {
  #opts;

  // opts : { port, reader, store } ; `store` : { read(), write(valeur | null) } sur la clé `gfs.reprise` du navigateur de GFS (js/shell/stored-choice.js,
  //   `keyStore` : sans exception).
  constructor(opts) { this.#opts = opts; }

  // Les plans pour des lignes déjà lues (`reader.raw()`) : un appelant qui a lu ces lignes n'a pas à les relire pour les plans.
  plansFrom(existing) {
    return existing ? Object.fromEntries(KINDS.filter(kind => !READING[kind]).map(kind => [kind, PLANS[kind](existing)])) : null;
  }

  // Les plans pour l'état du document (ou null quand GFS n'a pas pu le lire).
  async plans() {
    return this.plansFrom(await this.#opts.reader.raw());
  }

  // Le plan de l'index des noms (ou null quand GFS n'a pas pu lire le document, ou que la personne n'est pas propriétaire) : sans lire les tables de fichiers.
  async indexPlan() {
    const existing = await this.#opts.reader.raw(READING.index);
    return existing ? planIndex(existing) : null;
  }

  // Écrit le plan de `kind`, relu au moment même (rien n'est envoyé d'un plan périmé). Rend { ok: true } ou { ok: false, reason | message }.
  // `resume` : ce que GFS rouvre au retour du rechargement (`rights` : le panneau ; `share:<clé>` : la fenêtre « Partager » du fichier).
  async apply(kind, resume = 'rights') {
    const existing = await this.#opts.reader.raw(READING[kind]);
    if (!existing || !PLANS[kind]) return { ok: false, reason: 'unreadable' };
    const plan = PLANS[kind](existing);
    if (!plan.ok) return { ok: false, reason: plan.reason };
    this.#opts.store.write(resume);
    try {
      await this.#opts.port.doc.applyUserActions(plan.actions);
      const last = plan.again ? await this.#followUp(kind) : plan;
      // Aucune règle écrite par un geste de l'index : Grist ne recharge pas la page, il n'y a rien à rouvrir au retour.
      if (kind === 'index' && !last.actions.some(action => String(action[1]).startsWith('_grist_ACL'))) this.#opts.store.write(null);
      return { ok: true };
    } catch (error) {
      this.#opts.store.write(null);
      return { ok: false, message: String((error && error.message) || error).slice(0, 300) };
    }
  }

  // Les gestes qui suivent un plan `again` : chaque plan se refait d'après le document tel que le geste d'avant l'a laissé. Rend le dernier plan écrit.
  async #followUp(kind) {
    let last = { actions: [] };
    for (let round = 1; round < ROUNDS; round++) {
      const next = await this.#opts.reader.raw(READING[kind]);
      const plan = next ? PLANS[kind](next) : { ok: false };
      if (!plan.ok) break;
      await this.#opts.port.doc.applyUserActions(plan.actions);
      last = plan;
      if (!plan.again) break;
    }
    return last;
  }

  // Au retour du rechargement : vrai une fois, si GFS avait retenu de rouvrir le panneau.
  resume() { return this.take() === 'rights'; }

  // Ce que GFS avait retenu de rouvrir (une fois) : 'rights', 'share:<clé>' ou null.
  take() {
    const wanted = this.#opts.store.read();
    if (wanted) this.#opts.store.write(null);
    return wanted || null;
  }
}
