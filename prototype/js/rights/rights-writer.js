// Poser et retirer des règles depuis le panneau « Permissions » (étape 7, lot a ; contrats 11.5) : relit les règles en place (un propriétaire prouvé
// seulement), fait le plan (js/rights/rights-plan.js) et l'envoie en UNE `applyUserActions`. Grist recharge alors la page de tout le monde, celle qui pose
// comprise (11.5, point 3) : avant d'écrire, GFS retient dans son navigateur (clé `gfs.reprise`, jamais dans le document) qu'il doit rouvrir le panneau au
// retour, et le retire si l'écriture échoue.

import { planShared, planRemoveLevel, planCloseStructure, planOpenStructure, planSharingFor, planUnsharing } from './rights-plan.js';

const PLANS = { shared: planShared, 'remove-level': planRemoveLevel, close: planCloseStructure, open: planOpenStructure, sharing: planSharingFor,
  unsharing: planUnsharing };
export const KINDS = Object.freeze(Object.keys(PLANS));
export const RESUME_KEY = 'gfs.reprise';

export class RightsWriter {
  #opts;

  // opts : { port, reader, store } ; `store` : { read(), write(valeur | null) } sur la clé `gfs.reprise` du navigateur de GFS (js/shell/stored-choice.js,
  //   `keyStore` : sans exception).
  constructor(opts) { this.#opts = opts; }

  // Les quatre plans pour l'état du document (ou null quand GFS n'a pas pu le lire).
  async plans() {
    const existing = await this.#opts.reader.raw();
    if (!existing) return null;
    return Object.fromEntries(KINDS.map(kind => [kind, PLANS[kind](existing)]));
  }

  // Écrit le plan de `kind`, relu au moment même (rien n'est envoyé d'un plan périmé). Rend { ok: true } ou { ok: false, reason | message }.
  // `resume` : ce que GFS rouvre au retour du rechargement (`rights` : le panneau ; `share:<clé>` : la fenêtre « Partager » du fichier).
  async apply(kind, resume = 'rights') {
    const existing = await this.#opts.reader.raw();
    if (!existing || !PLANS[kind]) return { ok: false, reason: 'unreadable' };
    const plan = PLANS[kind](existing);
    if (!plan.ok) return { ok: false, reason: plan.reason };
    this.#opts.store.write(resume);
    try {
      await this.#opts.port.doc.applyUserActions(plan.actions);
      return { ok: true };
    } catch (error) {
      this.#opts.store.write(null);
      return { ok: false, message: String((error && error.message) || error).slice(0, 300) };
    }
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
