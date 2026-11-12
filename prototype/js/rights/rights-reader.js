// Le lecteur des droits (étape 6, contrats 11.4 point 7 ; 5.2 point 8 ; 11.9 point 8) : lit dans le document, sans rien écrire, les règles d'accès, les
// partages publics et la preuve que la personne est propriétaire. Il ne garde que ce qu'il rend : la clé d'un lien public (`linkId`) est jetée dès la lecture.
// Mesuré dans un vrai Grist 1.7.19 (labo/run-droits-reel.mjs, run-droits.mjs, 04/11) : les tables des règles ne disent PAS qui est propriétaire (un éditeur et
// un lecteur dont le widget a l'accès complet les lisent comme lui tant qu'aucune règle ne leur refuse la lecture d'une table, puis elles leur arrivent
// vides) ; seul `GET /webhooks` les distingue (Transfer.isOwner). Ce lecteur lit ; c'est js/rights/rights-control.js qui ne rend les règles qu'à un
// propriétaire prouvé.

import { FILES_TABLE } from '../files/gfs-files.js';
import { TARGETS } from '../sharing/sharing-model.js';
import { rowsOf, userRules, structureClosed, tableLevels, wordOf, ownedTables, linksOf } from './rights.js';

const RETRY_MS = 30 * 1000;

// Les colonnes que ce lecteur garde de chaque table interne : le reste (la clé d'un lien, la formule d'une règle d'une autre table…) n'est pas recopié.
const KEEP = {
  _grist_Shares: ['id', 'options'],
  _grist_Pages: ['id', 'viewRef', 'shareRef'],
  _grist_Views: ['id', 'name'],
  _grist_Views_section: ['id', 'parentId', 'tableRef', 'shareOptions'],
  _grist_Views_section_field: ['id', 'parentId', 'colRef', 'widgetOptions'],
  _grist_Tables: ['id', 'tableId'],
  _grist_Tables_column: ['id', 'parentId', 'colId', 'type', 'isFormula', 'formula', 'visibleCol'],
};
const pick = (rows, keys) => rows.map(row => Object.fromEntries(keys.map(key => [key, row[key]])));

export class RightsReader {
  #opts;
  #owner = null;

  // opts : { port (port.doc.fetchTable), transfer (isOwner()), prefixes() → les préfixes de table des apps, now() }
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

  // Ce que le pied et le panneau disent des règles : { readable, tables: [{ tableId, level }], closed, hasRules, word, count }. `readable: false` quand Grist
  // ne rend pas les tables internes (accès trop bas).
  async rules() {
    try {
      const [resources, rules, tables] = await Promise.all([this.#rows('_grist_ACLResources'), this.#rows('_grist_ACLRules'), this.#rows('_grist_Tables')]);
      const found = userRules(resources, rules);
      // Les tables que les règles nomment comptent aussi : une table que les règles retirent à la personne n'est plus dans ses tables internes (mesuré dans un
      // vrai Grist, 04/11), mais ses règles, elles, sont lues.
      const owned = ownedTables([...new Set([...tables, ...resources].map(row => row.tableId).filter(Boolean))], this.#opts.prefixes());
      const levels = tableLevels(found, owned);
      const closed = structureClosed(found);
      return { readable: true, tables: [...levels].map(([tableId, level]) => ({ tableId, level })), closed, hasRules: found.length > 0, count: found.length,
        word: wordOf(levels, closed) };
    } catch (error) {
      return { readable: false, tables: [], closed: false, hasRules: false, count: 0, word: null };
    }
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

  // Tous les partages du document, publiés par GFS ou par l'interface de Grist, avec le nombre de lignes de chaque table qu'un lien remplit. Seul un
  // propriétaire les voit (contrats 11.9, point 8) : `status` vaut 'ok', 'owner-only' (la personne n'est pas propriétaire), 'unknown' (GFS ne l'a pas prouvé)
  // ou 'unreadable'.
  async links() {
    const owner = await this.owner();
    if (owner !== true) return { status: owner === false ? 'owner-only' : 'unknown', links: [] };
    try {
      const names = ['_grist_Shares', '_grist_Pages', '_grist_Views', '_grist_Views_section', '_grist_Views_section_field', '_grist_Tables',
        '_grist_Tables_column'];
      const [shares, pages, views, sections, fields, tables, columns] = await Promise.all(names.map(name => this.#rows(name)));
      const owned = new Set(ownedTables(tables.map(table => table.tableId), this.#opts.prefixes()));
      const links = linksOf({ shares, pages, views, sections, fields, tables, columns }, tableId => owned.has(tableId));
      for (const link of links) for (const entry of link.filled) entry.rows = await this.#count(entry.tableId);
      return { status: 'ok', links };
    } catch (error) {
      return { status: 'unreadable', links: [] };
    }
  }

  async #count(tableId) {
    try { return ((await this.#opts.port.doc.fetchTable(tableId)).id || []).length; } catch (error) { return null; }
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
