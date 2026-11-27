// La lecture et l'écriture d'un guide dans le document (module Guide, demande du porteur du 27/11). La définition vit dans `GFS_Guides` (une table de GFS,
// créée avec l'accord de la personne : js/files/own-table.js et js/guide/guide-config.js) ; les démarches restent dans la table que la définition désigne : GFS
// la lit et n'en garde aucune copie (cahier 2, « deux zones »). Lire ne crée rien ; seule la création d'un guide, qui écrit une ligne, peut demander à la
// personne de créer la table. Les gestes s'enchaînent l'un après l'autre.

import { OwnTable, TableDeclined } from '../files/own-table.js';
import { DocTools } from '../files/doc-tools.js';
import { MissingTable, NameTaken } from '../annuaire/annuaire-store.js';
import { columnOf } from '../annuaire/annuaire-schema.js';
import { GUIDES_TABLE, GUIDES_COLUMNS, guidesOf, newRecord, addAction, updateAction, writeConfig } from './guide-config.js';
import { buildProcedures, buildIndex } from './guide-model.js';

export { TableDeclined, MissingTable, NameTaken };

const sameName = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
const MAX_DEPTH = 4; // les références qu'on suit pour montrer une valeur (une colonne visible qui est elle-même une référence)

// Les tables que la lecture d'un guide demande : celle des démarches et, pour chaque colonne lue qui est une référence, la table visée (et, de proche en
// proche, celle que sa colonne visible vise : la valeur que Grist montre d'une référence est dans la table visée).
export function guideTables(config, tableId, schema) {
  const needed = new Set([tableId]);
  const follow = (table, colId, depth) => {
    const col = columnOf(schema, table, colId);
    if (!col || !col.ref || !schema[col.ref] || depth >= MAX_DEPTH) return;
    needed.add(col.ref);
    follow(col.ref, col.visible, depth + 1);
  };
  for (const colId of [config.title, config.parent, config.keywords, config.steps, config.details, ...config.roles.map(role => role.col)]) follow(tableId,
    colId, 0);
  return needed;
}

export class GuideStore {
  #port;
  #own;
  #tools;
  #queue = Promise.resolve();

  // opts : { port ({ doc }), consent() -> Promise<boolean> (créer `GFS_Guides` ?) }
  constructor({ port, consent }) {
    this.#port = port;
    this.#tools = new DocTools(port);
    this.#own = new OwnTable({ port, name: GUIDES_TABLE, columns: GUIDES_COLUMNS, consent });
  }

  // Les tables et les colonnes du document (il faut l'accès complet : sans lui, Grist refuse cette lecture).
  schema() { return this.#tools.schema(); }

  // Les guides du document : [] quand `GFS_Guides` n'existe pas (lire ne la crée jamais).
  async list() {
    const state = await this.#own.load();
    return state.exists ? guidesOf(state.data) : [];
  }

  // Un guide lu : { guide, config, schema, procs, index, data }. Une lecture par table (celle des démarches et celles que ses colonnes de référence visent) ;
  // `cache` (une Map) garde les tables lues, pour que le réglage, qui relit à chaque choix, ne les lise qu'une fois.
  async read(guide, knownSchema = null, cache = null) {
    const schema = knownSchema || await this.schema();
    if (!schema[guide.table]) throw new MissingTable(guide.table);
    const { config } = guide;
    const data = {};
    const fetch = name => {
      if (!cache) return this.#port.doc.fetchTable(name);
      if (!cache.has(name)) cache.set(name, this.#port.doc.fetchTable(name));
      return cache.get(name);
    };
    await Promise.all([...guideTables(config, guide.table, schema)].map(async name => { data[name] = await fetch(name); }));
    const procs = buildProcedures(config, guide.table, data, schema);
    return { guide, config, schema, procs, index: buildIndex(procs), data };
  }

  // Une table du document, en tableaux de colonnes (pour l'aperçu du réglage).
  table(name) { return this.#port.doc.fetchTable(name); }

  #then(task) {
    const run = this.#queue.then(task);
    this.#queue = run.catch(() => {});
    return run;
  }

  // Ajoute une colonne vide à `table` (js/files/doc-tools.js) : { id }. Le geste vient d'une fenêtre qui a dit ce qui s'écrit.
  addColumn(table, name, type, show = '') { return this.#then(() => this.#tools.addColumn(table, name, type, show)); }

  // Crée une table avec ses colonnes : { id, columns: [{ id, type }] }. Le geste vient d'une fenêtre qui a dit ce qui s'écrit.
  addTable(name, columns) { return this.#then(() => this.#tools.addTable(name, columns)); }

  // Crée le guide `name` sur la table `table` : { row, name, table, config, parent } ; `TableDeclined` quand la personne refuse de créer `GFS_Guides`,
  // `NameTaken` quand le nom est pris.
  create({ name, table, config }) {
    return this.#then(async () => {
      const state = await this.#own.ready(GUIDES_COLUMNS.map(column => column.id));
      if ((state.data ? guidesOf(state.data) : []).some(each => sameName(each.name, name))) throw new NameTaken(name);
      const result = await this.#port.doc.applyUserActions([addAction(this.#own.id, newRecord(name, table, config))]);
      const row = result && Array.isArray(result.retValues) ? result.retValues[0] : null;
      return { row, name: String(name).trim(), table, config, parent: '' };
    });
  }

  // Réécrit la définition d'un guide qui existe déjà (son nom, sa table, ses colonnes, ses rôles) : ne crée jamais la table `GFS_Guides`.
  save(guide, { name = guide.name, table = guide.table, config }) {
    return this.#then(async () => {
      const state = await this.#own.existing();
      const found = state ? guidesOf(state.data) : [];
      if (!found.some(each => each.row === guide.row)) throw new MissingTable(GUIDES_TABLE);
      if (found.some(each => each.row !== guide.row && sameName(each.name, name))) throw new NameTaken(name);
      await this.#port.doc.applyUserActions([updateAction(this.#own.id, guide.row, { Name: String(name).trim(), Table: table, Config: writeConfig(config) })]);
      return { ...guide, name: String(name).trim(), table, config };
    });
  }
}
