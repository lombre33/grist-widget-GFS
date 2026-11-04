// Le gardien des fichiers des apps (décision du porteur, 04/11 ; contrats 6.7) : il met à la corbeille un fichier dont le manifeste de l'app dit comment le retirer et le remettre (`suppression`,
// js/gfs-trash.js), le restaure, le supprime pour de bon ; il le copie quand le manifeste dit comment (`copie`, js/gfs-copy.js). C'est un « gardien » de js/trash.js et de js/copying.js : ceux-là demandent
// la confirmation, disent la phrase et relisent la liste ; celui-ci écrit.
//
// Mettre à la corbeille : la ligne du fichier est relue (c'est elle qui compte, pas la liste que la personne avait sous les yeux), copiée en JSON dans `GFS_Corbeille` (la table naît avec l'accord de la
// personne, au premier fichier mis à la corbeille) et retirée de la table de l'app, dans UN SEUL lot : Grist applique tout ou rien, un fichier n'est jamais ni perdu ni en double. Restaurer : la ligne est
// remise, au même numéro quand il est libre (les commentaires, le rangement et les choix d'export d'une app le désignent), et l'entrée de la corbeille part dans le même lot. Supprimer pour de bon :
// l'entrée seule est retirée. Seules les colonnes de données (sans formule) sont gardées : Grist refuse d'écrire une formule. Copier : la ligne relue est ajoutée à la table de l'app (un seul `AddRecord`),
// sous le premier nom libre, sans ce qui désigne l'original (son jeton, son étoile). Les écritures se font l'une après l'autre.
//
// Un fichier qui tient à plus qu'une ligne (un formulaire, sa section, son lien public : `appel: true` dans la recette, contrats 2.4) a l'app ouverte pour partenaire : GFS lui demande `supprimer` avant de
// retirer la ligne (l'app ferme ce qui est lié au fichier ; GFS écrit la corbeille et retire la ligne), `dupliquer` à la place de la copie de la ligne (l'app copie en entier ; GFS lui donne le nom libre et range
// la copie). Seule l'app ouverte répond : sinon le geste est grisé et dit d'ouvrir l'app (`waitsForApp`). La table de la corbeille est accordée AVANT l'appel : un lien n'est jamais fermé pour un fichier que GFS
// ne pourrait pas mettre à la corbeille ; si l'écriture échoue après, le fichier est fermé et toujours là, jamais supprimé et resté ouvert.

import { OwnTable, TableDeclined } from './own-table.js';
import { newId, sameName } from './gfs-files.js';
import { copyRecipeOf, copiesByApp, copyNameOf, copyPlan } from './gfs-copy.js';
import { isExcluded } from './explorer-model.js';
import { BIN_TABLE, BIN_COLUMNS, BIN_COLUMN_IDS, recipeOf, asksApp, writable, snapshotOf, parseSnapshot, entryRecord, restorePlan } from './gfs-trash.js';
import { ERR } from './filter.js';

const APP_PATIENCE_MS = 20000; // l'app répond sans question à la personne : au bout de ce délai, GFS ne l'attend plus et n'écrit rien
const SAID_MAX = 200;

// Un refus voulu (la personne n'a pas créé la table, la ligne a des pièces jointes) : la phrase le dit à la personne (js/trash.js), la console n'a rien à en dire.
class Refusal extends Error {
  expected = true;
}

const cell = (data, column, i) => (column && data && Array.isArray(data[column]) ? data[column][i] : undefined);
const text = value => (typeof value === 'string' ? value : '');
// Une cellule de pièces jointes dit ['L', numéro, …] ; vide, c'est null (ou la liste sans numéro).
const hasAttachments = value => (Array.isArray(value) ? value.length > 1 : Boolean(value));
// La phrase que l'app ajoute à celle de GFS (déjà traduite, une ligne) : elle ne dépasse pas SAID_MAX signes.
const said = value => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, SAID_MAX) : '');

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

export class AppFiles {
  #opts;
  #bin;
  #queue = Promise.resolve();

  // opts : { port ({ doc }), apps() -> [{ manifest }] (les apps installées), consent() -> Promise<boolean> (créer GFS_Corbeille ?), identity() -> l'adresse de la personne ou '', now() -> millisecondes,
  // readonly(), fullAccess(), t, columnsOf(doc, tableId) -> [{ id, type }] (par défaut : les tables internes de Grist),
  // appReady(app) -> bool (l'app est ouverte et prête), appCall(app, nom, corps) -> Promise<réponse> (js/app-calls.js), appName(app) -> son nom, patience (ms) }
  constructor(opts) {
    this.#opts = { identity: () => '', now: () => Date.now(), columnsOf: dataColumnsOf, appReady: () => false, appCall: () => Promise.reject(new Error('pas d’app')), appName: id => id, patience: APP_PATIENCE_MS, ...opts };
    this.#bin = new OwnTable({ port: opts.port, name: BIN_TABLE, columns: BIN_COLUMNS, consent: opts.consent });
  }

  // L'entrée `fichiers[]` du manifeste qui a la recette de ce fichier (`recipe` : celle de la corbeille par défaut, ou `copyRecipeOf`), ou null : GFS ne sait pas le supprimer, ou le copier.
  #specOf(file, recipe = recipeOf) {
    for (const { manifest } of this.#opts.apps()) {
      const spec = manifest.id === file.app ? (manifest.fichiers || []).find(entry => entry.table === file.table && recipe(entry)) : null;
      if (spec) return spec;
    }
    return null;
  }

  manages = file => this.#specOf(file) !== null;

  copies = file => this.#specOf(file, copyRecipeOf) !== null;

  // Ce qui empêche d'écrire : pas l'accès complet (les tables internes de Grist ne se lisent pas sans lui), un document en lecture seule, ou, pour un fichier que l'app ouverte doit aider à supprimer ou à
  // copier (`gesture` : 'trash' ou 'copy'), l'app qui n'est pas ouverte.
  lock(file, gesture) {
    const { t, readonly, fullAccess } = this.#opts;
    if (!fullAccess()) return { text: t('gfs.needsFullAccess') };
    return readonly() ? { text: t('trash.readonly') } : this.waitsForApp(file, gesture);
  }

  // Le geste passe par l'app ouverte (`appel`) et elle ne l'est pas : { text } (« Ouvre Form+ … »), pour griser l'article et le dire au clic. Sinon null.
  waitsForApp(file, gesture) {
    if (!file || !this.#needsApp(file, gesture) || this.#opts.appReady(file.app)) return null;
    return { text: this.#opts.t(gesture === 'copy' ? 'copy.openApp' : 'trash.openApp', { app: this.#opts.appName(file.app) }) };
  }

  #needsApp(file, gesture) {
    if (gesture === 'trash') return asksApp(this.#specOf(file));
    return gesture === 'copy' && copiesByApp(this.#specOf(file, copyRecipeOf));
  }

  // L'appel à l'app ouverte. Rend sa réponse (un objet) ; un refus voulu (`expected`) quand elle n'est plus là, ne connaît pas l'appel ou ne répond pas dans le délai. Les autres erreurs sont celles de l'app :
  // leur texte est dit à la personne. Rien n'est jamais écrit par GFS tant que l'app n'a pas dit oui.
  async #askApp(file, name, body) {
    const { t, appCall, appReady, appName, patience } = this.#opts;
    const app = appName(file.app);
    let timer;
    try {
      if (!appReady(file.app)) throw new Refusal(t(name === 'dupliquer' ? 'copy.openApp' : 'trash.openApp', { app }));
      const silent = new Promise((resolve, reject) => { timer = setTimeout(reject, patience, new Refusal(t('app.silent', { app }))); });
      const answer = await Promise.race([appCall(file.app, name, body), silent]);
      if (!answer || typeof answer !== 'object') throw new Error(t('app.unreadable', { app }));
      return answer;
    } catch (error) {
      if (error && error.code === ERR.INCONNU) throw new Refusal(t('app.unknown', { app }));
      if (error && error.code === ERR.INACTIF) throw new Refusal(t('app.gone', { app }));
      throw error;
    } finally {
      clearTimeout(timer);
    }
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

  // Met le fichier à la corbeille. Rend true, ou { said } quand l'app a ajouté sa phrase ; false quand sa ligne n'est plus dans la table de l'app ; { declined } quand l'app ne ferme pas le fichier. Lève quand
  // la personne refuse la table, quand la ligne a des pièces jointes, ou quand l'app ne répond pas. La ligne est relue
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
      const asked = asksApp(spec) ? await this.#askApp(file, 'supprimer', { fichier: { id: file.id, type: file.type }, raison: 'corbeille' }) : null;
      if (asked && asked.fait !== true) return { declined: said(asked.dit) }; // l'app ne ferme pas ce fichier : rien n'est écrit
      found = await this.#found(spec, file);
      if (!found) return false;
      this.#refuseAttachments(columns, found);
      const { table, at } = found;
      const snapshot = snapshotOf(table.data, at, writable(table.data, columns.map(column => column.id)));
      const name = text(cell(table.data, spec.colonnes.nom, at));
      const record = entryRecord({ id: newId(), app: file.app, spec, file: { id: file.id, name, type: file.type, ts: file.ts, by: file.by }, snapshot, now: now(), author: identity() });
      await port.doc.applyUserActions([['AddRecord', this.#bin.id, null, record], ['RemoveRecord', table.id, table.data.id[at]]]);
      return asked && said(asked.dit) ? { said: said(asked.dit) } : true;
    });
  }

  // Copie le fichier : sa ligne, relue, est ajoutée à la table de l'app sous le premier nom libre, avec les valeurs de la recette (jeton vidé, étoile éteinte : js/gfs-copy.js) ; ou, quand la recette dit
  // `appel`, c'est l'app ouverte qui copie. Rend { id, name } (l'identifiant que l'explorateur donnera à la copie ; `said` : la phrase que l'app ajoute), { declined } quand l'app ne copie pas, ou null quand
  // la ligne n'est plus dans la table de l'app. Lève quand la table n'a pas la colonne du nom.
  copy(file) {
    return this.#exclusive(async () => {
      const { t, port } = this.#opts;
      const spec = this.#specOf(file, copyRecipeOf);
      const found = spec ? await this.#found(spec, file) : null;
      if (!found) return null;
      if (copiesByApp(spec)) return this.#copyByApp(file, spec, found);
      const plan = copyPlan({ spec, data: found.table.data, at: found.at, columns: await this.#columns(spec) });
      if (!plan) throw new Error(t('copy.noName'));
      const result = await port.doc.applyUserActions([['AddRecord', found.table.id, null, plan.values]]);
      const row = result && Array.isArray(result.retValues) ? result.retValues[0] : null;
      if (row === null || row === undefined) throw new Error(t('copy.noRow'));
      return { id: await this.#idOf(spec, found.table.id, row), name: plan.name };
    });
  }

  // L'app ouverte copie le fichier (`dupliquer`) : GFS lui donne le premier nom libre et n'écrit rien. Elle répond { id, nom?, dit? } ; sans `id`, elle n'a rien copié.
  async #copyByApp(file, spec, { table, at }) {
    const name = copyNameOf({ spec, data: table.data, at });
    const answer = await this.#askApp(file, 'dupliquer', { fichier: { id: file.id, type: file.type }, nom: name });
    const id = typeof answer.id === 'number' || typeof answer.id === 'string' ? String(answer.id).trim() : '';
    if (!id) return { declined: said(answer.dit) };
    const own = typeof answer.nom === 'string' ? answer.nom.trim() : '';
    return { id, name: own || name, said: said(answer.dit) };
  }

  // L'identifiant que l'explorateur lira pour la ligne `row` : le numéro de ligne quand la colonne `id` du manifeste est `id`, sinon la valeur de cette colonne, relue.
  async #idOf(spec, tableId, row) {
    const column = spec.colonnes.id;
    if (column === 'id') return String(row);
    const table = await this.#read(spec);
    const at = table ? table.data.id.indexOf(row) : -1;
    if (at < 0) throw new Error(this.#opts.t('copy.noRow'));
    return String(cell(table.data, column, at));
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
