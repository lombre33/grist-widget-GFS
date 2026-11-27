// Ce que les modules qui lisent les tables de la personne (l'annuaire, le guide) font de la même façon dans le document : lire les tables et leurs colonnes,
// ajouter une colonne, créer une table. Un seul lieu, pour que chaque module suive les mêmes règles (contrats 6.1 et 6.2) : l'identifiant que Grist donne est
// relu dans sa réponse (il peut différer du nom voulu), une référence montre la colonne `show` de sa table (le nom, pas un numéro), et rien n'est écrit sans
// que la fenêtre qui le demande ait dit ce qui s'écrit.

import { schemaOf, targetOf } from '../annuaire/annuaire-schema.js';
import { addColumnAction, addTableAction, displayAction } from '../annuaire/annuaire-config.js';

export class DocTools {
  #port;

  // `port` : { doc } (les interfaces brutes de Grist).
  constructor(port) { this.#port = port; }

  // Les tables et les colonnes du document, lues dans les tables internes de Grist (il faut l'accès complet : sans lui, Grist refuse cette lecture).
  async schema() {
    const [tables, columns] = await Promise.all([this.#port.doc.fetchTable('_grist_Tables'), this.#port.doc.fetchTable('_grist_Tables_column')]);
    return schemaOf(tables, columns);
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

  // Ajoute la colonne `name` (vide, du type `type` : « Text », « Ref:Personnes »…) à `table` : { id }. Grist choisit l'identifiant (il peut différer du nom) :
  // on le relit dans sa réponse. Une référence montre la colonne `show` de sa table ; si ce réglage échoue, la colonne reste créée, avec ses numéros.
  async addColumn(table, name, type, show = '', choices = []) {
    const target = targetOf(type);
    const shown = target && show ? await this.#columnRef(target, show) : 0;
    const result = await this.#port.doc.applyUserActions([addColumnAction(table, name, type, shown, choices)]);
    const made = result && Array.isArray(result.retValues) ? result.retValues[0] : null;
    const id = made && typeof made.colId === 'string' && made.colId ? made.colId : String(name).trim();
    if (shown && made && made.colRef) {
      try { await this.#port.doc.applyUserActions([displayAction(table, made.colRef, id, show)]); }
      catch (error) { console.warn('GFS : la colonne créée montre des numéros', error); }
    }
    return { id };
  }

  // Crée la table `name` avec `columns` ([{ id, type }]) : { id, columns: [{ id, type }] }. Grist choisit les identifiants (ils peuvent différer de ce qu'on
  // demande) : on les relit dans sa réponse.
  async addTable(name, columns) {
    const result = await this.#port.doc.applyUserActions([addTableAction(name, columns)]);
    const made = result && Array.isArray(result.retValues) ? result.retValues[0] : null;
    const id = made && typeof made.table_id === 'string' && made.table_id ? made.table_id : String(name).trim();
    const ids = made && Array.isArray(made.columns) && made.columns.length === columns.length ? made.columns.map(String) : columns.map(col => col.id);
    return { id, columns: columns.map((col, at) => ({ id: ids[at], type: col.type })) };
  }
}
