// Le lecteur des droits (étape 6, contrats 5.2 point 8 ; 11.4) : lit dans le document, sans rien écrire, les règles d'accès (pour les plans de pose) et la
// preuve que la personne est propriétaire. Mesuré dans un vrai Grist 1.7.19 (labo/run-droits-reel.mjs, 04/11) : les tables des règles ne disent PAS qui est
// propriétaire (un éditeur et un lecteur dont le widget a l'accès complet les lisent comme lui tant qu'aucune règle ne leur refuse la lecture d'une table, puis
// elles leur arrivent vides) ; seul `GET /webhooks` les distingue (Transfer.isOwner). Les lignes ne se rendent donc (`raw`) qu'à un propriétaire prouvé. La
// lecture des règles pour un mot du pied, et celle des liens publics, ont disparu avec la fenêtre « Permissions » (13/11).

import { FILES_TABLE } from '../files/gfs-files.js';
import { TARGETS } from '../sharing/sharing-model.js';
import { rowsOf } from './rights.js';

const RETRY_MS = 30 * 1000;

// Les colonnes que ce lecteur garde de chaque table interne : le reste n'est pas recopié.
const KEEP = {
  _grist_Tables: ['id', 'tableId'],
  _grist_Tables_column: ['id', 'parentId', 'colId', 'type', 'isFormula', 'formula', 'visibleCol'],
};
const pick = (rows, keys) => rows.map(row => Object.fromEntries(keys.map(key => [key, row[key]])));

export class RightsReader {
  #opts;
  #owner = null;

  // opts : { port (port.doc.fetchTable), transfer (isOwner()), targets() → les tables de fichiers, now() }
  constructor(opts) { this.#opts = opts; }

  async #rows(name) {
    const rows = rowsOf(await this.#opts.port.doc.fetchTable(name));
    return KEEP[name] ? pick(rows, KEEP[name]) : rows;
  }

  // La personne est-elle propriétaire du document : true, false, ou null quand GFS ne l'a pas prouvé (contrats 5.2, point 8). Une réponse sûre se garde pour la
  // vie de la page (une règle posée la recharge) ; un « on ne sait pas » se redemande au bout de 30 secondes.
  owner() {
    const kept = this.#owner;
    if (kept && (kept.value !== null || this.#opts.now() - kept.at < RETRY_MS)) return kept.promise;
    const promise = Promise.resolve().then(() => this.#opts.transfer.isOwner()).catch(() => null);
    this.#owner = { promise, at: this.#opts.now(), value: undefined };
    const entry = this.#owner;
    void promise.then(value => { entry.value = value; });
    return promise;
  }

  // Les lignes dont les plans de pose ont besoin (js/rights/rights-plan.js) : les règles et leurs ressources en entier, les tables et leurs colonnes. Seulement
  // pour un propriétaire prouvé ; null sinon. `files: false` : sans lire les tables de fichiers en entier (leurs identifiants ne servent qu'à l'activation du
  // partage ; « Gérer les partages » n'en a pas besoin, et une table de fichiers est la plus lourde du document).
  async raw({ files: withFiles = true } = {}) {
    if ((await this.owner()) !== true) return null;
    try {
      const [resources, rules, tables, columns] = await Promise.all(['_grist_ACLResources', '_grist_ACLRules', '_grist_Tables',
        '_grist_Tables_column'].map(name => this.#rows(name)));
      // Les identifiants des fichiers que GFS garde déjà : l'activation du partage les laisse lisibles de tous, comme avant (contrats 11.7, point 13).
      const targets = this.#opts.targets ? this.#opts.targets() : TARGETS;
      const files = {};
      for (const target of withFiles ? targets : []) {
        if (!tables.some(row => row.tableId === target.table)) continue;
        files[target.table] = rowsOf(await this.#opts.port.doc.fetchTable(target.table)).map(row => String(target.id ? row[target.id] || '' : row.id)).filter(
          Boolean);
      }
      return { resources, rules, tables, columns, fileIds: files[FILES_TABLE] || [], files, targets };
    } catch (error) {
      return null;
    }
  }

  // Ce que `contexte.role` dit (contrats 5.2, point 8). `responsableDe` reste vide tant que les espaces n'existent pas (étape 7, 11.3). Au plus `waitMs`
  // d'attente : l'app ne démarre pas plus tard pour cela.
  async role(waitMs = 1500) {
    let timer;
    const late = new Promise(resolve => { timer = setTimeout(() => resolve(null), waitMs); });
    const proprietaire = await Promise.race([this.owner(), late]);
    clearTimeout(timer);
    return { proprietaire: proprietaire === true || proprietaire === false ? proprietaire : null, responsableDe: [] };
  }
}
