// La lecture et l'écriture d'un annuaire dans le document (module Annuaire, demande du porteur du 25/11). La définition vit dans `GFS_Annuaires` (une table de
// GFS, créée avec l'accord de la personne : js/files/own-table.js et js/annuaire/annuaire-config.js) ; les personnes restent dans la table que la définition
// désigne : GFS la lit et n'en garde aucune copie (cahier 2, « deux zones ») ; elle ne l'écrit que sur le geste « Enregistrer » de la fenêtre « Modifier »
// (`update`). Lire ne crée rien ; seule la création d'un annuaire, qui écrit
// une ligne, peut demander à la personne de créer la table. Les gestes s'enchaînent l'un après l'autre.

import { OwnTable, TableDeclined } from '../files/own-table.js';
import { ANNUAIRES_TABLE, ANNUAIRES_COLUMNS, annuairesOf, newRecord, addAction, updateAction, addColumnAction, displayAction, writeConfig, readConfig,
  effectiveConfig } from './annuaire-config.js';
import { SHARES_TABLE, PLACE_TABLE } from '../sharing/sharing-model.js';
import { TABLE as FILING_TABLE } from '../files/rangement.js';
import { schemaOf, tablesNeeded, targetOf } from './annuaire-schema.js';
import { buildPeople, buildTree } from './annuaire-model.js';
import { isSub, unpackFiches, subRecord, refreshRecord } from './annuaire-sub.js';

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

  // Un annuaire lu : { annuaire, config, schema, people, tree }. `config` est celle que les écrans suivent (`effectiveConfig` : sans le poste ni les niveaux
  // quand l'option « postes et hiérarchie » est éteinte). Une lecture par table (celle des personnes et celles que ses niveaux et ses champs suivent) ; `cache`
  // (une Map) garde les tables lues, pour que le réglage, qui relit à chaque choix, ne les lise qu'une fois.
  async read(annuaire, knownSchema = null, cache = null) {
    if (isSub(annuaire)) return this.#readSub(annuaire);
    const schema = knownSchema || await this.schema();
    if (!schema[annuaire.table]) throw new MissingTable(annuaire.table);
    const config = effectiveConfig(annuaire.config);
    const data = {};
    const fetch = name => {
      if (!cache) return this.#port.doc.fetchTable(name);
      if (!cache.has(name)) cache.set(name, this.#port.doc.fetchTable(name));
      return cache.get(name);
    };
    await Promise.all([...tablesNeeded(config, annuaire.table, schema)].map(async name => { data[name] = await fetch(name); }));
    const people = buildPeople(config, annuaire.table, data, schema);
    return { annuaire, config, schema, people, tree: buildTree(people, config.levels, annuaire.name), data };
  }

  // Un sous-annuaire lu : sa copie (js/annuaire/annuaire-sub.js), sans toucher à la table des personnes ni lire le schéma du document : la copie porte le sien.
  // `data` est vide : rien dans la copie ne se modifie (les fiches se modifient dans l'annuaire d'origine) et « Ma présence » n'y a pas de colonne à lire.
  #readSub(annuaire) {
    const base = effectiveConfig(annuaire.config);
    const config = { ...base, presence: { ...base.presence, on: false } }; // « Ma présence » se règle et se lit dans l'annuaire d'origine
    const { people, schema, at } = unpackFiches(annuaire.fiches, config.levels.length);
    return { annuaire, config, schema, people, tree: buildTree(people, config.levels, annuaire.name), data: {}, copy: { at } };
  }

  // Écrit la fiche d'une personne : `action` est l'`UpdateRecord` de js/annuaire/annuaire-edit.js (une ligne, les colonnes changées). Le geste vient du bouton
  // « Enregistrer » d'une fenêtre qui a dit ce qui change ; Grist répond par ses règles d'accès (une erreur dit pourquoi : la fenêtre la montre telle quelle).
  update(action) {
    return this.#then(() => this.#port.doc.applyUserActions([action]));
  }

  // Une table du document, en tableaux de colonnes (pour les exemples du réglage).
  table(name) { return this.#port.doc.fetchTable(name); }

  // Ajoute la colonne `name` (vide, du type `type` : « Text », « Ref:Personnes »…) à `table` : { id }. Grist choisit l'identifiant (il peut différer du nom) :
  // on le relit dans sa réponse. Le geste vient d'une fenêtre qui a dit ce qui s'écrit (js/annuaire/annuaire-setup-path.js).
  // Une référence montre la colonne `show` de sa table (le nom de la personne, pas son numéro : sans cela, la table montrerait des chiffres dans Grist) ; si ce
  // réglage échoue, la colonne reste créée, avec ses numéros.
  addColumn(table, name, type, show = '') {
    return this.#then(async () => {
      const target = targetOf(type);
      const shown = target && show ? await this.#columnRef(target, show) : 0;
      const result = await this.#port.doc.applyUserActions([addColumnAction(table, name, type, shown)]);
      const made = result && Array.isArray(result.retValues) ? result.retValues[0] : null;
      const id = made && typeof made.colId === 'string' && made.colId ? made.colId : String(name).trim();
      if (shown && made && made.colRef) {
        try { await this.#port.doc.applyUserActions([displayAction(table, made.colRef, id, show)]); }
          catch (error) { console.warn('GFS : la colonne créée montre des numéros', error); }
      }
      return { id };
    });
  }

  // Le numéro (interne à Grist) d'une colonne d'une table : 0 quand on ne le trouve pas ou que la lecture est refusée.
  async #columnRef(table, column) {
    try {
      const [tables, columns] = await Promise.all([this.#port.doc.fetchTable('_grist_Tables'), this.#port.doc.fetchTable('_grist_Tables_column')]);
      const parent = tables.id[tables.tableId.indexOf(table)];
      return columns.id.find((ref, i) => columns.parentId[i] === parent && columns.colId[i] === column) || 0;
    } catch (error) {
      return 0;
    }
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

  // Crée le sous-annuaire `name` : une ligne de `GFS_Annuaires` qui porte sa copie des personnes. `parent` : l'annuaire d'origine ; `sub` : { key, label,
  // values } ;
  // `read` : la lecture de l'annuaire d'origine. Rend { annuaire } (la ligne relue) ; `TableDeclined` quand la personne refuse de créer la table, `NameTaken`
  //   quand le nom est pris. La ligne n'est écrite qu'une fois les règles du partage en place (js/annuaire/annuaire-control.js : le verrou d'abord, la copie
  //   ensuite).
  createSub({ name, parent, sub, read, at }) {
    return this.#then(async () => {
      const state = await this.#own.ready(ANNUAIRES_COLUMNS.map(column => column.id));
      if ((state.data ? annuairesOf(state.data) : []).some(each => sameName(each.name, name))) throw new NameTaken(name);
      const { people, record } = subRecord({ name, parent, sub, read, at });
      const result = await this.#port.doc.applyUserActions([addAction(this.#own.id, record)]);
      const row = result && Array.isArray(result.retValues) ? result.retValues[0] : null;
      return { row, name: record.Nom, table: record.Table, config: readConfig(record.Config), parent: record.Parent, fiches: record.Fiches,
        count: people.length };
    });
  }

  // Reprend la copie d'un sous-annuaire (et la définition de son annuaire d'origine) : « Actualiser ». Rend { annuaire, count } ; ne crée jamais la table.
  refreshSub(annuaire, { parent, read, at }) {
    return this.#then(async () => {
      const state = await this.#own.existing(ANNUAIRES_COLUMNS.map(column => column.id));
      if (!state || !annuairesOf(state.data).some(each => each.row === annuaire.row)) throw new MissingTable(ANNUAIRES_TABLE);
      const { people, record } = refreshRecord({ sub: annuaire.config.sub, parent, read, at });
      await this.#port.doc.applyUserActions([updateAction(this.#own.id, annuaire.row, record)]);
      return { annuaire: { ...annuaire, table: record.Table, config: readConfig(record.Config), fiches: record.Fiches }, count: people.length };
    });
  }

  // Supprime un sous-annuaire : sa ligne (la copie avec elle) et les lignes qui parlaient de lui (partages, placement, rangement), pour qu'un numéro de ligne
  // que Grist réutilise n'hérite d'aucun droit. Un annuaire principal ne se supprime pas d'ici.
  removeSub(annuaire, { shares = [], places = [], filing = [] } = {}) {
    return this.#then(async () => {
      if (!isSub(annuaire)) throw new Error('GFS : seul un sous-annuaire se supprime');
      const state = await this.#own.existing();
      if (!state || !annuairesOf(state.data).some(each => each.row === annuaire.row)) throw new MissingTable(ANNUAIRES_TABLE);
      const gone = (table, rows) => (rows.length ? [['BulkRemoveRecord', table, rows]] : []);
      await this.#port.doc.applyUserActions([...gone(SHARES_TABLE, shares), ...gone(PLACE_TABLE, places), ...gone(FILING_TABLE, filing),
        ['RemoveRecord', this.#own.id, annuaire.row]]);
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
