// La lecture et l'écriture d'un annuaire dans le document (module Annuaire, demande du porteur du 25/11). La définition vit dans `GFS_Annuaires` (une table de
// GFS, créée avec l'accord de la personne : js/files/own-table.js et js/annuaire/annuaire-config.js) ; les personnes restent dans la table que la définition
// désigne : GFS la lit, ne l'écrit pas et n'en garde aucune copie (cahier 2, « deux zones »). Lire ne crée rien ; seule la création d'un annuaire, qui écrit
// une ligne, peut demander à la personne de créer la table. Les gestes s'enchaînent l'un après l'autre.

import { OwnTable, TableDeclined } from '../files/own-table.js';
import { ANNUAIRES_TABLE, ANNUAIRES_COLUMNS, annuairesOf, newRecord, addAction, updateAction, writeConfig } from './annuaire-config.js';
import { schemaOf, tablesNeeded } from './annuaire-schema.js';
import { buildPeople, buildTree } from './annuaire-model.js';

export { TableDeclined };

// La table que l'annuaire désigne n'existe plus dans le document (supprimée ou renommée) : l'annuaire reste dans la liste, la personne peut le corriger.
export class MissingTable extends Error {
  code = 'GFS_TABLE_ABSENTE';
  constructor(table) {
    super(`La table ${table} n'existe plus dans le document.`);
    this.table = table;
  }
}

// Un annuaire du même nom existe déjà : deux annuaires de même nom ne se distingueraient pas dans la liste.
export class NameTaken extends Error {
  code = 'GFS_NOM_PRIS';
}

const sameName = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

export class AnnuaireStore {
  #port;
  #own;
  #queue = Promise.resolve();

  // opts : { port ({ doc }), consent() -> Promise<boolean> (créer `GFS_Annuaires` ?) }
  constructor({ port, consent }) {
    this.#port = port;
    this.#own = new OwnTable({ port, name: ANNUAIRES_TABLE, columns: ANNUAIRES_COLUMNS, consent });
  }

  // Les tables et les colonnes du document, lues dans les tables internes de Grist (il faut l'accès complet : sans lui, Grist refuse cette lecture).
  async schema() {
    const [tables, columns] = await Promise.all([this.#port.doc.fetchTable('_grist_Tables'), this.#port.doc.fetchTable('_grist_Tables_column')]);
    return schemaOf(tables, columns);
  }

  // Les annuaires du document : [] quand `GFS_Annuaires` n'existe pas (lire ne la crée jamais).
  async list() {
    const state = await this.#own.load();
    return state.exists ? annuairesOf(state.data) : [];
  }

  // Un annuaire lu : { annuaire, schema, people, tree }. Une lecture par table (celle des personnes et celles que ses niveaux et ses champs suivent).
  async read(annuaire, knownSchema = null) {
    const schema = knownSchema || await this.schema();
    if (!schema[annuaire.table]) throw new MissingTable(annuaire.table);
    const data = {};
    await Promise.all([...tablesNeeded(annuaire.config, annuaire.table, schema)].map(async name => { data[name] = await this.#port.doc.fetchTable(name); }));
    const people = buildPeople(annuaire.config, annuaire.table, data, schema);
    return { annuaire, schema, people, tree: buildTree(people, annuaire.config.levels, annuaire.name) };
  }

  #then(task) {
    const run = this.#queue.then(task);
    this.#queue = run.catch(() => {});
    return run;
  }

  // Crée l'annuaire `name` sur la table `table` : { annuaire } ; `TableDeclined` quand la personne refuse de créer `GFS_Annuaires`, `NameTaken` quand le nom
  // est pris.
  create({ name, table, config }) {
    return this.#then(async () => {
      const state = await this.#own.ready(ANNUAIRES_COLUMNS.map(column => column.id));
      const found = state.data ? annuairesOf(state.data) : [];
      if (found.some(each => sameName(each.name, name))) throw new NameTaken(name);
      const result = await this.#port.doc.applyUserActions([addAction(this.#own.id, newRecord(name, table, config))]);
      const row = result && Array.isArray(result.retValues) ? result.retValues[0] : null;
      return { row, name: String(name).trim(), table, config, parent: '' };
    });
  }

  // Réécrit la définition d'un annuaire qui existe déjà (ses niveaux, ses champs, et sa table quand elle a changé) : ne crée jamais la table `GFS_Annuaires`.
  save(annuaire, config, table = annuaire.table) {
    return this.#then(async () => {
      const state = await this.#own.existing();
      if (!state || !annuairesOf(state.data).some(each => each.row === annuaire.row)) throw new MissingTable(ANNUAIRES_TABLE);
      await this.#port.doc.applyUserActions([updateAction(this.#own.id, annuaire.row, { Config: writeConfig(config), Table: table })]);
      return { ...annuaire, config, table };
    });
  }
}
