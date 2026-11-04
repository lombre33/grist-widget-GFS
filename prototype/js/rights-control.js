// Ce que le contrôleur fait des droits (étape 6, contrats 11.4 point 7 ; 5.2 point 8) : le lecteur (js/rights-reader.js), le mot du pied de l'explorateur, le panneau « Permissions » (js/rights-window.js)
// et le rôle que `contexte` rend aux apps. Tout est en lecture ; le fichier est à part pour que le contrôleur ne grossisse que de quelques lignes.

import { RightsReader } from './rights-reader.js';
import { openRights } from './rights-window.js';

export class RightsControl {
  #opts;
  reader;

  // opts : { port, transfer, prefixes() → les préfixes de table des apps, now(), container, inertTargets(), t(clé, variables), fullAccess() }
  constructor(opts) {
    this.#opts = opts;
    this.reader = new RightsReader({ port: opts.port, transfer: opts.transfer, prefixes: opts.prefixes, now: opts.now });
  }

  // Les règles ne se lisent qu'avec l'accès complet (les tables internes de Grist), et ne se rendent qu'à un propriétaire prouvé : mesuré (Grist 1.7.19), les règles arrivent vides à qui n'a pas le droit de lire
  // une table, et vides, elles ne disent pas « aucune règle ». Sinon le mot du pied reste « Permissions » et le panneau dit pourquoi (`reason` : 'access', 'owner-only' ou 'unknown').
  async rules() {
    const none = reason => ({ readable: false, reason, tables: [], closed: false, hasRules: false, count: 0, word: null });
    if (!this.#opts.fullAccess()) return none('access');
    const owner = await this.reader.owner();
    if (owner !== true) return none(owner === false ? 'owner-only' : 'unknown');
    return this.reader.rules();
  }

  // Redonne à l'explorateur le mot du pied d'après les règles du moment.
  async refresh(explorer) { explorer.setRights(await this.rules()); }

  // Le panneau : tout se relit à l'ouverture (une règle posée dans Grist recharge la page, mais un partage publié ne la recharge pas).
  open(explorer) {
    const { container, inertTargets, t } = this.#opts;
    return openRights({
      container, inertTargets, t,
      load: async () => {
        const [rules, owner, links] = await Promise.all([this.rules(), this.reader.owner(), this.#opts.fullAccess() ? this.reader.links() : { status: 'unreadable', links: [] }]);
        explorer.setRights(rules);
        return { rules, owner, links };
      },
    });
  }
}
