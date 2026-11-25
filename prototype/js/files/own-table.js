// Une table que GFS crée et écrit lui-même dans le document (`GFS_Filing`, contrats 6.4 ; `GFS_Fichiers`, contrats 6.6) : la relire, la créer avec l'accord
// de la personne, lui ajouter une colonne absente. Un seul lieu pour ces règles, pour que chaque table de GFS les suive :
//   lire ne crée rien ; écrire relit d'abord, et ne crée la table qu'avec l'accord de la personne (6.2, point 1) ;
//   après `AddTable`, l'identifiant réel est relu (6.2, point 2) ; une colonne absente est ajoutée avant d'être écrite (6.1, point 3) : une seule colonne
//   inconnue annulerait tout le lot.
// Un document dont les tables de GFS portent encore leurs noms d'avant (js/files/gfs-names.js) n'en reçoit jamais une seconde à côté : tant que la mise à jour
// des noms n'a pas eu lieu (propriétaire absent, refus), GFS ne crée rien et n'ajoute aucune colonne.

import { isLegacyForm } from './gfs-names.js';

const sameName = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

// Qui veut savoir qu'une table de GFS vient de naître (js/files/page-tree.js range sa page sous celle de GFS) : `listener(tableId)`, appelé après chaque
// `AddTable` réussi ; ce qu'il lève ou rejette ne gêne jamais la création. Rend la fonction qui retire l'écoute.
const creationListeners = new Set();
export function onTableCreated(listener) {
  creationListeners.add(listener);
  return () => creationListeners.delete(listener);
}
function announceCreated(tableId) {
  for (const listener of creationListeners) {
    try { Promise.resolve(listener(tableId)).catch(() => {}); } catch (error) { /* une écoute ne gêne pas la création */ }
  }
}

// La personne a refusé de créer la table : rien ne s'installe, rien ne se range.
export class TableDeclined extends Error {
  code = 'GFS_TABLE_REFUSEE';
  constructor(table) {
    super(`La personne a refusé de créer la table ${table}.`);
    this.table = table;
  }
}

// La table est encore sous son nom d'avant : rien n'est créé ni ajouté, la mise à jour des noms doit passer d'abord. Comme un refus de la personne, pour qui
// l'attrape : rien n'a été écrit.
export class LegacyNames extends TableDeclined {
  code = 'GFS_NOMS_D_AVANT';
  constructor(table) {
    super(table);
    this.message = `La table ${table} porte encore ses noms d'avant : la mise à jour des noms de GFS doit passer d'abord.`;
  }
}

export class OwnTable {
  #port;
  #name;
  #columns;
  #consent;
  #tableId;
  #seen = null; // l'identifiant que Grist a donné à la table la dernière fois qu'elle a été lue ou créée ; null tant qu'elle n'a jamais été vue

  // `port` : { doc } (les interfaces brutes de Grist) ; `columns` : [{ id, type, … }] telles que `AddTable` les reçoit ; `consent()` : une promesse, `true`
  //   quand la personne accepte la création.
  constructor({ port, name, columns, consent }) {
    this.#port = port;
    this.#name = name;
    this.#columns = columns;
    this.#consent = consent;
    this.#tableId = name;
  }

  // L'identifiant que Grist a vraiment donné à la table (le nom voulu tant qu'elle n'est pas lue).
  get id() { return this.#tableId; }

  // La table a-t-elle été vue (lue ou créée) ? Un geste qui n'a pas à la créer peut alors s'afficher avant d'être écrit (js/explorer/pending.js).
  get known() { return this.#seen !== null; }

  // Une lecture qu'un autre a faite dit où en est la table : son identifiant réel, ou null quand elle n'existe pas.
  note(id) {
    this.#seen = id || null;
    if (id) this.#tableId = id;
  }

  // La table telle qu'elle est : { exists, columns, data, legacy }. Ne crée rien. `legacy` : elle est encore sous la forme d'avant (js/files/gfs-names.js). Une
  // table déjà vue est lue en même temps que la liste des tables qui confirme son nom (un aller-retour de réseau de moins avant chaque écriture) : la liste
  // fait foi, et la lecture d'avance est jetée si la table a changé de nom ou disparu.
  async load() {
    const known = this.#seen;
    const guess = known === null ? null : this.#port.doc.fetchTable(known).catch(() => null);
    const tables = (await this.#port.doc.listTables()).map(String);
    const found = tables.find(name => sameName(name, this.#name));
    if (!found) {
      this.#seen = null;
      return { exists: false, columns: [], data: null, legacy: isLegacyForm(this.#name, tables) };
    }
    this.#tableId = found;
    this.#seen = found;
    const fetched = (guess && found === known && (await guess)) || (await this.#port.doc.fetchTable(found));
    const columns = Object.keys(fetched || {});
    return { exists: true, columns, data: fetched, legacy: isLegacyForm(this.#name, tables, columns) };
  }

  // La table prête à être écrite, relue juste avant, avec les colonnes `needed` : sans table, l'accord de la personne, puis la création. `created` : la table
  // vient de naître (ou la personne vient d'être interrogée) : ce que l'appelant a lu pendant ce temps est à relire.
  async ready(needed = []) {
    let state = await this.load();
    let created = false;
    if (state.legacy) throw new LegacyNames(this.#name);
    if (!state.exists) {
      created = true;
      if (!(await this.#consent())) throw new TableDeclined(this.#name);
      state = await this.load(); // la table a pu naître pendant la question
      if (!state.exists) state = await this.#create();
    }
    for (const column of needed.filter(name => !state.columns.includes(name))) await this.addColumn(column);
    return created ? { ...state, created } : state;
  }

  // La table seulement si elle existe, relue juste avant, avec les colonnes `needed` ajoutées au besoin ; null sans table. Pour un geste sur une ligne qui y
  // est déjà (mettre un fichier à la corbeille, le restaurer) : un geste de ce genre ne crée jamais la table, et ne demande donc jamais son accord.
  async existing(needed = []) {
    const state = await this.load();
    if (!state.exists || state.legacy) return null;
    for (const column of needed.filter(name => !state.columns.includes(name))) await this.addColumn(column);
    return state;
  }

  // Ajoute une colonne que la table n'a pas encore, avec le type et la formule que `columns` lui donne.
  async addColumn(id) {
    const info = Object.fromEntries(Object.entries(this.#columns.find(column => column.id === id)).filter(([key]) => key !== 'id'));
    await this.#port.doc.applyUserActions([['AddColumn', this.#tableId, id, info]]);
  }

  // La table naît avec toutes ses colonnes ; l'identifiant que Grist a vraiment donné est celui des écritures suivantes.
  async #create() {
    const result = await this.#port.doc.applyUserActions([['AddTable', this.#name, this.#columns.map(column => ({ ...column }))]]);
    const made = result && Array.isArray(result.retValues) && result.retValues[0];
    this.#tableId = (made && made.table_id) || this.#name;
    this.#seen = this.#tableId;
    if (!sameName(this.#tableId, this.#name)) console.warn(`GFS : Grist a nommé la table ${this.#tableId} au lieu de ${this.#name}`);
    announceCreated(this.#tableId);
    return { exists: true, columns: this.#columns.map(column => column.id), data: null };
  }
}
