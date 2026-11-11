// Ce que le contrôleur fait des droits (étape 6, contrats 11.4 point 7 ; 5.2 point 8) : le lecteur (js/rights/rights-reader.js), le mot du pied de
// l'explorateur, le panneau « Permissions » (js/rights/rights-window.js) et le rôle que `contexte` rend aux apps. Tout est en lecture ; le fichier est à part
// pour que le contrôleur ne grossisse que de quelques lignes.

import { RightsReader } from './rights-reader.js';
import { openRights } from './rights-window.js';
import { RightsWriter, RESUME_KEY } from './rights-writer.js';
import { runAction } from './rights-actions.js';
import { targetsOf } from '../sharing/sharing-model.js';
import { ShareControl } from '../sharing/share-control.js';
import { ManageControl } from '../sharing/manage-control.js';
import { ask } from '../ui/ask-window.js';
import { keyStore } from '../shell/stored-choice.js';

export class RightsControl {
  #opts;
  reader;
  writer;
  sharing;

  // opts : { port, transfer, prefixes() → les préfixes de table des apps, manifests() → les manifestes des apps valides (leurs préfixes de table, leurs tables
  //   de fichiers : `targetsOf`, js/sharing/sharing-model.js), now(), container, inertTargets(), t(clé, variables), fullAccess(), locale(), identity(),
  //   writeBlock(),
  //   appName(id), other(file, state) → l'onglet « Dans un autre document Grist » ou null, otherLinks(), otherStop(lien) (js/sharing/share-other.js) }
  constructor(opts) {
    this.#opts = opts;
    const manifests = opts.manifests || (() => []);
    this.targets = () => targetsOf(manifests());
    this.reader = new RightsReader({ port: opts.port, transfer: opts.transfer, prefixes: opts.prefixes || (() => manifests().map(item => item.tables.prefixe)),
      now: opts.now, targets: () => targetsOf(manifests()) });
    this.writer = new RightsWriter({ port: opts.port, reader: this.reader, store: opts.container ?
      keyStore(opts.container.ownerDocument.defaultView, RESUME_KEY) : { read: () => null, write: () => false } });
    // « Partager » : le même lecteur et le même écrivain, pour la fenêtre du fichier (js/sharing/share-control.js).
    this.manage = new ManageControl({ ...opts, reader: this.reader, writer: this.writer });
    this.sharing = new ShareControl({ ...opts, targets: this.targets, reader: this.reader, writer: this.writer, other: opts.other || (() => null),
      manage: this.manage });
  }

  // Les règles ne se lisent qu'avec l'accès complet (les tables internes de Grist), et ne se rendent qu'à un propriétaire prouvé : mesuré (Grist 1.7.19), les
  // règles arrivent vides à qui n'a pas le droit de lire une table, et vides, elles ne disent pas « aucune règle ». Sinon le mot du pied reste « Permissions »
  // et le panneau dit pourquoi (`reason` : 'access', 'owner-only' ou 'unknown').
  async rules() {
    const none = reason => ({ readable: false, reason, tables: [], closed: false, hasRules: false, count: 0, word: null });
    if (!this.#opts.fullAccess()) return none('access');
    const owner = await this.reader.owner();
    if (owner !== true) return none(owner === false ? 'owner-only' : 'unknown');
    return this.reader.rules();
  }

  // Redonne à l'explorateur le mot du pied d'après les règles du moment.
  async refresh(explorer) {
    explorer.setRights(await this.rules());
    this.resume(explorer);
  }

  // Le panneau : tout se relit à l'ouverture (une règle posée dans Grist recharge la page, mais un partage publié ne la recharge pas). Un propriétaire y trouve
  // aussi les gestes « poser » et « retirer ».
  open(explorer) {
    const { container, inertTargets, t, fullAccess } = this.#opts;
    const asking = options => ask({ container, inertTargets, ...options });
    return openRights({
      container, inertTargets, t,
      load: async () => {
        const [rules, owner, links] = await Promise.all([this.rules(), this.reader.owner(),
          fullAccess() ? this.reader.links() : { status: 'unreadable', links: [] }]);
        const plans = rules.readable ? await this.writer.plans() : null;
        explorer.setRights(rules);
        return { rules, owner, links, plans };
      },
      act: async kind => {
        if (kind === 'manage') {
        await this.manage.open(); return; } await runAction({ kind, plans: await this.writer.plans(), t, ask: asking, writer: this.writer }); },
    });
  }

  // Au retour du rechargement que Grist impose après une pose : rouvre le panneau, une fois (contrats 11.5, point 3).
  // Ce que GFS avait retenu de rouvrir : le panneau, ou la fenêtre « Partager » d'un fichier (que l'explorateur a peut-être pas encore lu : on attend ses
  // fichiers un instant).
  resume(explorer) {
    const wanted = this.writer.take();
    if (wanted === 'rights') void this.open(explorer);
    else if (wanted === 'manage') void this.manage.open();
    else if (wanted && wanted.startsWith('share:')) void this.#reopenShare(explorer, wanted.slice(6));
  }

  async #reopenShare(explorer, key) {
    for (let tries = 0; tries < 40; tries++) {
      const file = (explorer.files || []).find(item => item.key === key);
      if (file) { await this.sharing.open(file); return; }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
}
