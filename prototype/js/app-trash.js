// Le gardien des fichiers des apps (décision du porteur, 04/11 ; contrats 6.7) : il met à la corbeille un fichier dont le manifeste de l'app dit comment le retirer et le remettre (`suppression`,
// js/gfs-trash.js), le restaure, le supprime pour de bon. C'est un « gardien » de js/trash.js : celui-là demande la confirmation, dit la phrase et relit la liste ; celui-ci écrit.
//
// Mettre à la corbeille : la ligne du fichier est relue (c'est elle qui compte, pas la liste que la personne avait sous les yeux), copiée en JSON dans `GFS_Corbeille` (la table naît avec l'accord de la
// personne, au premier fichier mis à la corbeille) et retirée de la table de l'app, dans UN SEUL lot : Grist applique tout ou rien, un fichier n'est jamais ni perdu ni en double. Restaurer : la ligne est
// remise, au même numéro quand il est libre (les commentaires, le rangement et les choix d'export d'une app le désignent), et l'entrée de la corbeille part dans le même lot. Supprimer pour de bon :
// l'entrée seule est retirée. Seules les colonnes de données (sans formule) sont gardées : Grist refuse d'écrire une formule. Les écritures se font l'une après l'autre.

import { OwnTable, TableDeclined } from './own-table.js';
import { newId, sameName } from './gfs-files.js';
import { isExcluded } from './explorer-model.js';
import { BIN_TABLE, BIN_COLUMNS, BIN_COLUMN_IDS, recipeOf, writable, snapshotOf, parseSnapshot, entryRecord, restorePlan } from './gfs-trash.js';

// Un refus voulu (la personne n'a pas créé la table, la ligne a des pièces jointes) : la phrase le dit à la personne (js/trash.js), la console n'a rien à en dire.
class Refusal extends Error {
  expected = true;
}

const cell = (data, column, i) => (column && data && Array.isArray(data[column]) ? data[column][i] : undefined);
const text = value => (typeof value === 'string' ? value : '');
// Une cellule de pièces jointes dit ['L', numéro, …] ; vide, c'est null (ou la liste sans numéro).
const hasAttachments = value => (Array.isArray(value) ? value.length > 1 : Boolean(value));

// Les colonnes de données de la table `tableId` (celles qui ne sont pas des formules), relues dans les tables internes de Grist : [{ id, type }]. Vide quand la table n'existe pas.
export async function dataColumnsOf(doc, tableId) {
  const tables = await doc.fetchTable('_grist_Tables');
  const at = (tables.tableId || []).findIndex(name => sameName(name, tableId));
  if (at < 0) return [];
  const columns = await doc.fetchTable('_grist_Tables_column');
  const found = [];
  (columns.id || []).forEach((_, i) => {
    const id = text(columns.colId[i]);
    if (columns.parentId[i] === tables.id[at] && columns.isFormula[i] !== true && id && id !== 'manualSort' && !id.startsWith('gristHelper_')) found.push({ id, type: text(columns.type[i]) });
  });
  return found;
}

export class AppTrash {
  #opts;
  #bin;
  #queue = Promise.resolve();

  // opts : { port ({ doc }), apps() -> [{ manifest }] (les apps installées), consent() -> Promise<boolean> (créer GFS_Corbeille ?), identity() -> l'adresse de la personne ou '', now() -> millisecondes,
  // readonly(), fullAccess(), t, columnsOf(doc, tableId) -> [{ id, type }] (par défaut : les tables internes de Grist) }
  constructor(opts) {
    this.#opts = { identity: () => '', now: () => Date.now(), columnsOf: dataColumnsOf, ...opts };
    this.#bin = new OwnTable({ port: opts.port, name: BIN_TABLE, columns: BIN_COLUMNS, consent: opts.consent });
  }

  // L'entrée `fichiers[]` du manifeste qui a la recette de ce fichier, ou null : GFS ne sait pas le supprimer.
  #specOf(file) {
    for (const { manifest } of this.#opts.apps()) {
      const spec = manifest.id === file.app ? (manifest.fichiers || []).find(entry => entry.table === file.table && recipeOf(entry)) : null;
      if (spec) return spec;
    }
    return null;
  }

  manages = file => this.#specOf(file) !== null;

  // Ce qui empêche d'écrire : pas l'accès complet (les tables internes de Grist ne se lisent pas sans lui), ou un document en lecture seule.
  lock() {
    const { t, readonly, fullAccess } = this.#opts;
    if (!fullAccess()) return { text: t('gfs.needsFullAccess') };
    return readonly() ? { text: t('trash.readonly') } : null;
  }

  #exclusive(task) {
    const run = this.#queue.then(task);
    this.#queue = run.catch(() => {});
    return run;
  }

  // La table de l'app telle qu'elle est : { id, data }, ou null quand elle n'existe plus.
  async #read(spec) {
    const { doc } = this.#opts.port;
    const id = (await doc.listTables()).map(String).find(name => sameName(name, spec.table));
    return id ? { id, data: await doc.fetchTable(id) } : null;
  }

  // Les colonnes de données de la table de l'app : [{ id, type }].
  #columns(spec) {
    return this.#opts.columnsOf(this.#opts.port.doc, spec.table);
  }

  // La table de la corbeille, prête à être écrite : sans elle, l'accord de la personne ; un refus dit ce qui n'a pas été fait.
  async #readyBin() {
    try {
      return await this.#bin.ready(BIN_COLUMN_IDS);
    } catch (error) {
      if (error instanceof TableDeclined) throw new Refusal(this.#opts.t('trash.table.declined'));
      throw error;
    }
  }

  // La place du fichier dans `data` (la table de l'app relue), ou -1 : une ligne réservée n'est pas un fichier.
  #rowOf(spec, data, file) {
    const column = (spec.colonnes || {}).id;
    return (data.id || []).findIndex((row, i) => String(cell(data, column, i)) === file.id && !isExcluded(spec, data, i));
  }

  // La place de l'entrée de `file` dans `GFS_Corbeille` (relue), ou -1 : le numéro de ligne, l'app, le fichier et la date du geste doivent tous correspondre à ce que la personne avait sous les yeux.
  #entryOf(bin, file) {
    return (bin.id || []).findIndex((row, i) => row === file.row && text(cell(bin, 'App', i)) === file.app && text(cell(bin, 'FichierId', i)) === file.id && cell(bin, 'SupprimeLe', i) === file.trashed.ts);
  }

  // La ligne du fichier, relue : { table, at }, ou null quand elle n'est plus dans la table de l'app.
  async #found(spec, file) {
    const table = await this.#read(spec);
    const at = table ? this.#rowOf(spec, table.data, file) : -1;
    return at < 0 ? null : { table, at };
  }

  // Une ligne qui a des pièces jointes n'est pas mise à la corbeille : la copie en JSON ne les garderait pas, et Grist les effacerait au bout de sept jours.
  #refuseAttachments(columns, { table, at }) {
    if (columns.some(column => column.type === 'Attachments' && hasAttachments(cell(table.data, column.id, at)))) throw new Refusal(this.#opts.t('trash.attachments'));
  }

  // Met le fichier à la corbeille. Rend false quand sa ligne n'est plus dans la table de l'app. Lève quand la personne refuse la table, ou quand la ligne a des pièces jointes. La ligne est relue
  // après la table : la personne a pu être longue à répondre à la question, et une autre a pu modifier ou supprimer la ligne entre-temps (la copie garde l'état d'après, jamais celui d'avant).
  trash(file) {
    return this.#exclusive(async () => {
      const { port, identity, now } = this.#opts;
      const spec = this.#specOf(file);
      let found = spec ? await this.#found(spec, file) : null;
      if (!found) return false;
      const columns = await this.#columns(spec);
      this.#refuseAttachments(columns, found);
      await this.#readyBin();
      found = await this.#found(spec, file);
      if (!found) return false;
      this.#refuseAttachments(columns, found);
      const { table, at } = found;
      const snapshot = snapshotOf(table.data, at, writable(table.data, columns.map(column => column.id)));
      const name = text(cell(table.data, spec.colonnes.nom, at));
      const record = entryRecord({ id: newId(), app: file.app, spec, file: { id: file.id, name, type: file.type, ts: file.ts, by: file.by }, snapshot, now: now(), author: identity() });
      await port.doc.applyUserActions([['AddRecord', this.#bin.id, null, record], ['RemoveRecord', table.id, table.data.id[at]]]);
      return true;
    });
  }

  // Remet le fichier dans la table de l'app. Rend { name, renamed }, ou null quand il n'est plus à la corbeille. Lève quand la copie est illisible ou que la table de l'app n'existe plus.
  restore(file) {
    return this.#exclusive(async () => {
      const { t, port } = this.#opts;
      const spec = this.#specOf(file);
      const state = spec ? await this.#bin.existing() : null;
      const entry = state ? this.#entryOf(state.data, file) : -1;
      if (entry < 0) return null;
      const snapshot = parseSnapshot(cell(state.data, 'Instantane', entry));
      if (!snapshot) throw new Error(t('trash.unreadable'));
      const table = await this.#read(spec);
      if (!table) throw new Error(t('trash.tableGone'));
      const columns = writable(table.data, (await this.#columns(spec)).map(column => column.id));
      const plan = restorePlan({ snapshot, spec, data: table.data, columns });
      const actions = plan.present ? [] : [['AddRecord', table.id, plan.rowId, plan.values]];
      await port.doc.applyUserActions([...actions, ['RemoveRecord', this.#bin.id, state.data.id[entry]]]);
      return { name: plan.name, renamed: Boolean(plan.renamed) };
    });
  }

  // Supprime pour de bon les fichiers `files`, s'ils sont toujours à la corbeille : un fichier restauré entre-temps n'est pas touché. Rend le nombre d'entrées retirées.
  empty(files) {
    return this.#exclusive(async () => {
      const state = await this.#bin.existing();
      const rows = state ? [...new Set(files.map(file => this.#entryOf(state.data, file)).filter(at => at >= 0).map(at => state.data.id[at]))] : [];
      if (rows.length) await this.#opts.port.doc.applyUserActions(rows.map(row => ['RemoveRecord', this.#bin.id, row]));
      return rows.length;
    });
  }
}
