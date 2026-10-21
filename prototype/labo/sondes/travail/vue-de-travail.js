// Labo seulement : la « ligne de travail » choisie dans GFS (piste 3 de « où vit GFS, quelle ligne suit chaque app », 21/10). L'app ouverte reçoit la table et la ligne
// choisies comme si c'étaient celles de la section de GFS : les messages de table et de ligne de Grist sont remplacés, et les lectures de la vue (fetchSelectedTable,
// fetchSelectedRecord) sont rendues depuis la table choisie, lue par GFS (fetchTable). Grist ne prévient que des changements de la table de la section (contrats 5.5) :
// ceux de la table choisie sont vus en la relisant à intervalle. Rien de GFS publié n'importe ce fichier : l'essai run-travail.mjs l'injecte dans session.js.

const POLL_MS = 1500;
// Les codes des valeurs encodées de Grist (GristObjCode) : ce que la vue de Grist rend pour un nombre d'une colonne Date, DateTime ou Référence.
const CODES = { Date: 'd', DateTime: 'D', Ref: 'R' };

// Comme la vue de Grist (WidgetFrame, cellFormat par défaut) : un nombre d'une colonne Date, DateTime ou Référence devient une valeur encodée ; le reste passe tel quel.
function encode(value, type) {
  if (typeof value !== 'number') return value;
  const [base, rest] = type.split(/:(.*)/);
  if (base === 'Date') return [CODES.Date, value];
  if (base === 'DateTime') return [CODES.DateTime, value, rest];
  if (base === 'Ref') return [CODES.Ref, rest, value];
  return value;
}

// Les colonnes de la table que la vue de Grist montrerait (ni `manualSort` ni les colonnes d'aide), avec la colonne affichée d'une Référence (`expandRefs`).
async function columnsOf(doc, tableId) {
  const tables = await doc.fetchTable('_grist_Tables');
  const ref = tables.id[tables.tableId.indexOf(tableId)];
  const cols = await doc.fetchTable('_grist_Tables_column');
  const idOf = new Map(cols.id.map((id, i) => [id, cols.colId[i]]));
  return cols.id.map((id, i) => ({ colId: cols.colId[i], type: cols.type[i], parent: cols.parentId[i], shown: idOf.get(cols.displayCol[i]) || cols.colId[i] }))
    .filter(col => col.parent === ref && col.colId !== 'manualSort' && !col.colId.startsWith('gristHelper_'));
}

class WorkView {
  choice = null;
  stats = { reads: [], polls: 0, changes: 0, messages: 0 };
  #port = null;
  #columns = null;
  #signature = '';
  #timer = null;
  #listeners = new Set();

  // Le contexte d'une app ouverte, avec l'état et la vue remplacés tant qu'une ligne de travail est choisie ; sans choix, tout passe comme avant.
  wrap(ctx) {
    const work = this;
    const { state, port } = ctx;
    this.#port = port;
    const shown = { ...ctx, state: {
      get options() { return state.options; },
      get theme() { return state.theme; },
      get table() { return work.choice ? work.#message(true) : state.table; },
      get grantedAccess() { return state.grantedAccess; },
      tableNow: () => (work.choice ? work.#message(true) : state.tableNow()),
      subscribe: listener => work.#subscribe(state, listener),
    } };
    shown.port = { doc: port.doc, widget: port.widget, view: this.#view(port.view) };
    return shown;
  }

  #subscribe(state, listener) {
    this.#listeners.add(listener);
    const off = state.subscribe((kind, message) => { if (!(this.choice && (kind === 'table' || kind === 'record'))) listener(kind, message); });
    return () => { off(); this.#listeners.delete(listener); };
  }

  #view(view) {
    return {
      fetchSelectedTable: options => (this.choice ? this.#selectedTable(options || {}) : view.fetchSelectedTable(options)),
      fetchSelectedRecord: (rowId, options) => (this.choice ? this.#selectedRecord(rowId, options || {}) : view.fetchSelectedRecord(rowId, options)),
      allowSelectBy: () => view.allowSelectBy(),
      setSelectedRows: rowIds => (this.choice ? Promise.resolve() : view.setSelectedRows(rowIds)),
      setCursorPos: pos => (this.choice ? this.choose(this.choice.tableId, pos && pos.rowId) : view.setCursorPos(pos)),
    };
  }

  #message(dataChange) { return { tableId: this.choice.tableId, rowId: this.choice.rowId, dataChange, mappingsChange: false }; }

  #emit(kind) {
    this.stats.messages++;
    const message = this.#message(kind === 'table');
    for (const listener of this.#listeners) listener(kind, message);
  }

  // La connexion de GFS au document : celle de l'app ouverte, ou la sienne quand aucune app n'est encore ouverte.
  get #doc() { return this.#port ? this.#port.doc : globalThis.grist.rpc.getStub('GristDocAPI@grist'); }

  // La table choisie lue par GFS, avec la durée et le poids de la lecture.
  async #read() {
    const started = performance.now();
    const data = await this.#doc.fetchTable(this.choice.tableId);
    const text = JSON.stringify(data);
    this.stats.reads.push({ ms: Math.round((performance.now() - started) * 10) / 10, octets: text.length, lignes: data.id.length });
    return { data, text };
  }

  // Les valeurs d'une colonne aux lignes `rows` (positions dans `data`), comme la vue de Grist les rend.
  #values(data, col, rows, options) {
    const source = data[(options.expandRefs ?? options.cellFormat !== 'typed') ? col.shown : col.colId] || [];
    return rows.map(i => encode(source[i], col.type));
  }

  // Toutes les lignes, dans l'ordre du tableau (`manualSort`) : sans section, aucun filtre ni tri de la personne ne s'applique.
  async #selectedTable(options) {
    const { data } = await this.#read();
    const order = data.id.map((id, i) => i);
    if (data.manualSort) order.sort((a, b) => data.manualSort[a] - data.manualSort[b]);
    const out = {};
    for (const col of this.#columns) out[col.colId] = this.#values(data, col, order, options);
    out.id = order.map(i => data.id[i]);
    return out;
  }

  async #selectedRecord(rowId, options) {
    const { data } = await this.#read();
    const record = { id: rowId };
    for (const col of this.#columns) [record[col.colId]] = this.#values(data, col, [data.id.indexOf(rowId)], options);
    return record;
  }

  async #poll() {
    if (!this.choice) return;
    this.stats.polls++;
    try {
      const { text } = await this.#read();
      if (text !== this.#signature) { this.#signature = text; this.stats.changes++; this.#emit('table'); }
    } catch (error) {
      console.warn('GFS (labo) : la table de travail est illisible', error);
    }
    this.#timer = setTimeout(() => this.#poll(), POLL_MS);
  }

  // Choisit la table et la ligne de travail : une autre table est relue et annoncée comme un message de table (comme Grist au changement de table), une autre ligne de
  // la même table comme un message de ligne.
  async choose(tableId, rowId) {
    const sameTable = this.choice && this.choice.tableId === tableId;
    this.choice = { tableId, rowId };
    if (sameTable) return this.#emit('record');
    clearTimeout(this.#timer);
    this.#columns = await columnsOf(this.#doc, tableId);
    this.#signature = (await this.#read()).text;
    this.#emit('table');
    this.#timer = setTimeout(() => this.#poll(), POLL_MS);
  }

  // `n` lectures de suite d'une table (la relecture seule, sans app) : durées et poids.
  async measure(tableId, n) {
    const runs = [];
    let octets = 0;
    for (let i = 0; i < n; i++) {
      const started = performance.now();
      octets = JSON.stringify(await this.#doc.fetchTable(tableId)).length;
      runs.push(performance.now() - started);
    }
    runs.sort((a, b) => a - b);
    return { tableId, n, mediane: Math.round(runs[Math.floor(n / 2)] * 10) / 10, max: Math.round(runs[n - 1] * 10) / 10, octets };
  }
}

globalThis.__travail = new WorkView();
