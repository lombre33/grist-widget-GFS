// Le fichier qu'une app crée après « Nouveau », « Depuis un modèle » ou « Importer » va dans le dossier où la personne était (contrats 5.4, point 1 ; demande
// du porteur du 25/11 : « quand on fait Nouveau, ça met à la racine et pas là où l'on est »). L'ouverture porte bien `dossier`, mais ce n'est qu'une
// indication : Publipostage+ ne la lit pas, les autres apps n'ont pas de colonne de dossier, et le dossier d'un espace ne s'écrit que par GFS (le placement).
// GFS range donc lui-même, comme il range un PDF importé : le courtier voit l'app écrire (c'est lui qui parle à Grist), reconnaît la ligne neuve de la table de
// fichiers de l'app (le numéro que Grist rend à l'ajout) et la range une seule fois (`Filing.rangeNew`). Rien n'est lu ni écrit tant que l'app n'a pas créé son
// fichier : un modèle vierge qu'on n'enregistre pas ne laisse rien.

import { isTable } from '../apps/doc-names.js';
import { openingKind } from '../files/import-file.js';

const KINDS = new Set(['nouveau', 'modele', 'importer']);
const ADDS = new Set(['AddRecord', 'BulkAddRecord']);

// Les numéros des lignes que ce lot ajoute aux tables de fichiers de l'app : `retValues` suit les actions, un numéro pour `AddRecord`, une liste pour
// `BulkAddRecord`. Rien quand Grist ne les rend pas.
export function createdRows(manifest, actions, result) {
  const specs = manifest && Array.isArray(manifest.fichiers) ? manifest.fichiers : [];
  const values = result && Array.isArray(result.retValues) ? result.retValues : [];
  const ids = [];
  (Array.isArray(actions) ? actions : []).forEach((action, at) => {
    if (!Array.isArray(action) || !ADDS.has(action[0]) || !specs.some(spec => isTable(spec, action[1]))) return;
    ids.push(...[].concat(values[at]).filter(id => Number.isInteger(id) && id > 0));
  });
  return ids;
}

export class CreatedFiles {
  #opts;
  #waiting = null; // { app, folder, session } : la création que la personne vient de demander, qui attend l'écriture de l'app

  // opts : { manifestOf(id) -> le manifeste de l'app, place(entries) -> Promise (le rangement de fichiers neufs : `Filing.rangeNew`), done() (la liste montre
  //   le
  //   dossier : elle se relit si l'explorateur est ouvert) }
  constructor(opts) { this.#opts = opts; }

  // L'app vient d'ouvrir ce que la personne demandait (`opening` : js/files/import-file.js ; `session` : l'app qui l'a ouvert). Une création (« Nouveau », un
  // modèle de départ, « Importer ») attend l'écriture de l'app et retient `opening.dossier` (le dossier ouvert, vide à la racine) ; tout autre geste, ou rien
  // (`null`), fait oublier l'attente : ce que l'app créerait ensuite n'est plus ce « Nouveau ».
  opened(appId, opening, session) {
    const creating = Boolean(opening) && KINDS.has(openingKind(opening));
    this.#waiting = creating ? { app: appId, folder: opening.dossier || '', session } : null;
  }

  // Le courtier a appliqué ce lot pour l'app `session`. Le premier ajout à une table de fichiers, tant que cette app est celle que la personne a ouverte, est
  // le fichier de la création : il part dans le dossier retenu. Rend sans attendre : l'app n'a pas à patienter pour le rangement, et un rangement qui échoue ne
  // perd rien (le fichier est à la racine).
  written(session, actions, result) {
    const waiting = this.#waiting;
    if (!waiting || waiting.session !== session || waiting.app !== session.id) return;
    const ids = createdRows(this.#opts.manifestOf(session.id), actions, result);
    if (!ids.length) return;
    this.#waiting = null;
    if (waiting.folder) void this.#shelve(waiting.app, ids, waiting.folder);
  }

  async #shelve(app, ids, folder) {
    try {
      await this.#opts.place(ids.map(id => ({ app, file: String(id), pinned: false, folder })));
      this.#opts.done();
    } catch (error) {
      console.warn('GFS : le fichier que l\'app vient de créer n\'a pas pu être rangé dans son dossier', error);
    }
  }
}
