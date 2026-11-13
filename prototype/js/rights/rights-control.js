// Ce que le contrôleur fait des droits (étape 6, contrats 11.4 point 7 ; 5.2 point 8) : le lecteur (js/rights/rights-reader.js), l'écrivain
// (js/rights/rights-writer.js), « Partager » et « Gérer les partages » qui s'en servent, et la reprise d'après un rechargement ; le fichier est à part pour que
// le contrôleur ne grossisse que de quelques lignes. La fenêtre « Permissions » et le mot « Pas protégé » du pied de l'explorateur n'existent plus (retirés les
// 12 et 13/11, choix du porteur).

import { RightsReader } from './rights-reader.js';
import { RightsWriter, RESUME_KEY } from './rights-writer.js';
import { targetsOf } from '../sharing/sharing-model.js';
import { ShareControl } from '../sharing/share-control.js';
import { ManageControl } from '../sharing/manage-control.js';
import { keyStore } from '../shell/stored-choice.js';

export class RightsControl {
  #opts;
  reader;
  writer;
  sharing;

  // opts : { port, transfer, manifests() → les manifestes des apps valides (leurs préfixes de table, leurs tables
  //   de fichiers : `targetsOf`, js/sharing/sharing-model.js), now(), container, inertTargets(), t(clé, variables), fullAccess(), locale(), identity(),
  //   writeBlock(),
  //   appName(id), other(file, state) → l'onglet « Dans un autre document Grist » ou null, otherLinks(), otherStop(lien) (js/sharing/share-other.js) }
  constructor(opts) {
    this.#opts = opts;
    const manifests = opts.manifests || (() => []);
    this.targets = () => targetsOf(manifests());
    this.reader = new RightsReader({ port: opts.port, transfer: opts.transfer, now: opts.now, targets: () => targetsOf(manifests()) });
    this.writer = new RightsWriter({ port: opts.port, reader: this.reader, store: opts.container ?
      keyStore(opts.container.ownerDocument.defaultView, RESUME_KEY) : { read: () => null, write: () => false } });
    // « Partager » : le même lecteur et le même écrivain, pour la fenêtre du fichier (js/sharing/share-control.js).
    this.manage = new ManageControl({ ...opts, reader: this.reader, writer: this.writer });
    this.sharing = new ShareControl({ ...opts, targets: this.targets, reader: this.reader, writer: this.writer, other: opts.other || (() => null),
      manage: this.manage });
  }

  // Au retour du rechargement que Grist impose après une pose (contrats 11.5, point 3).
  // Ce que GFS avait retenu de rouvrir : « Gérer les partages », ou la fenêtre « Partager » d'un fichier (que l'explorateur a peut-être pas encore lu : on
  // attend ses
  // fichiers un instant).
  resume(explorer) {
    const wanted = this.writer.take();
    if (wanted === 'manage') void this.manage.open();
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
