// La table de travail (contrats 4.5) : une table, et au besoin sa ligne, choisies dans GFS, que l'app ouverte reçoit comme celles de la section de GFS. Le courtier ne change pas :
// la session reçoit un état (`state`) et une vue de Grist (`port`) qui, sans choix, sont ceux de Grist ; avec un choix, ils disent la table et la ligne choisies et
// rendent leurs lignes depuis la table lue par GFS (`fetchTable`), sous la forme de la vue de Grist. Grist ne prévient pas des changements d'une autre table que celle
// de la section (5.5, point 1) : GFS relit la table choisie tant qu'une app l'écoute.

// Le rythme de la relecture (4.5, point 4) : [jusqu'à tant de lignes, toutes les tant de ms].
const PACE = [[5000, 2000], [20000, 5000], [Infinity, 10000]];
export const pollDelay = rows => PACE.find(([most]) => rows <= most)[1];

// Les codes des valeurs encodées de Grist (GristObjCode) : ce que la vue de Grist rend pour un nombre d'une colonne Date, DateTime ou Référence.
const CODES = Object.freeze({ Date: 'd', DateTime: 'D', Ref: 'R' });

// Comme la vue de Grist (WidgetFrame, format par défaut) : un nombre d'une colonne Date, DateTime ou Référence devient une valeur encodée ; le reste passe tel quel.
export function encode(value, type) {
  if (typeof value !== 'number') return value;
  const [base, rest] = String(type).split(/:(.*)/);
  if (base === 'Date') return [CODES.Date, value];
  if (base === 'DateTime') return [CODES.DateTime, value, rest];
  if (base === 'Ref') return [CODES.Ref, rest, value];
  return value;
}

// Les colonnes que la vue de Grist montrerait, lues dans `_grist_Tables` et `_grist_Tables_column` : ni `manualSort` ni les colonnes d'aide ; `shown`, la colonne
// affichée d'une Référence (`expandRefs`), la colonne elle-même pour les autres.
export function viewColumns(tables, columns, tableId) {
  const ref = tables.id[tables.tableId.indexOf(tableId)];
  const idOf = new Map(columns.id.map((id, i) => [id, columns.colId[i]]));
  return columns.id.map((id, i) => ({ colId: columns.colId[i], type: columns.type[i], parent: columns.parentId[i], shown: idOf.get(columns.displayCol[i]) || columns.colId[i] }))
    .filter(col => col.parent === ref && col.colId !== 'manualSort' && !col.colId.startsWith('gristHelper_'))
    .map(({ colId, type, shown }) => ({ colId, type, shown }));
}

// Une table appartient à une app quand elle porte son préfixe (2.3), ce préfixe sans son « _ » final, ou qu'elle est la table de ses fichiers (2.4).
const ownedBy = (manifest, id) => {
  const prefix = manifest.tables && manifest.tables.prefixe;
  if (prefix && (id.startsWith(prefix) || id === prefix.replace(/_$/, ''))) return true;
  return (manifest.fichiers || []).some(spec => spec.table === id);
};

// Les tables qu'on peut choisir (4.5, point 1) : ni celles de Grist, ni celles de GFS, ni celles des apps.
export const workTables = (tableIds, manifests) => tableIds.filter(id => !/^_grist_/.test(id) && !/^GFS_/.test(id) && !manifests.some(manifest => ownedBy(manifest, id)));

// Une valeur telle que la liste la montre : une date en jour, une liste en ses éléments ; rien pour une case ou une cellule vide.
function shownText(value, type) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return '';
  if (Array.isArray(value)) return value[0] === 'L' ? value.slice(1).join(', ') : '';
  if (typeof value === 'number' && /^Date/.test(type)) return new Date(value * 1000).toISOString().slice(0, 10);
  return String(value);
}

// Le texte d'une ligne dans la liste : les quatre premières valeurs, comme le tableau les montre ; la recherche porte sur toutes (`search`).
export function rowLabel(data, index, columns) {
  const parts = columns.map(col => shownText((data[col.shown] || [])[index], col.type)).filter(Boolean);
  return { label: parts.slice(0, 4).join(' · ') || `#${data.id[index]}`, search: parts.join(' ') };
}

export class WorkRow {
  #doc;
  #timers;
  #hidden;
  #choice = null;
  #columns = [];
  #signature = '';
  #keys = '';
  #timer = null;
  #reading = null;
  #listeners = new Set();

  // doc : `GristDocAPI` de GFS (port.doc) ; timers : { setTimeout, clearTimeout } ; hidden() : la page est cachée (la relecture attend).
  constructor({ doc, timers = globalThis, hidden = () => false }) {
    this.#doc = doc;
    this.#timers = timers;
    this.#hidden = hidden;
  }

  // { tableId, rowId } ou null : la page décide.
  get choice() { return this.#choice && { ...this.#choice }; }

  // L'état que reçoit une session (session.js) : celui de Grist, sauf la table et la ligne quand une ligne de travail est choisie.
  state(base) {
    const work = this;
    return {
      get options() { return base.options; },
      get theme() { return base.theme; },
      get table() { return work.#choice ? work.#message(true) : base.table; },
      get grantedAccess() { return base.grantedAccess; },
      tableNow: () => (this.#choice ? this.#message(true) : base.tableNow()),
      subscribe: listener => this.#subscribe(base, listener),
    };
  }

  // Le port que reçoit le courtier : `doc` et `widget` de Grist, et la vue (`GristView`) de la table choisie.
  port(base) {
    const view = base.view;
    const chosen = () => this.#choice !== null;
    return {
      doc: base.doc,
      widget: base.widget,
      view: {
        fetchSelectedTable: options => (chosen() ? this.#selectedTable(options || {}) : view.fetchSelectedTable(options)),
        fetchSelectedRecord: (rowId, options) => (chosen() ? this.#selectedRecord(rowId, options || {}) : view.fetchSelectedRecord(rowId, options)),
        allowSelectBy: () => view.allowSelectBy(),
        setSelectedRows: rowIds => (chosen() ? Promise.resolve() : view.setSelectedRows(rowIds)),
        setCursorPos: pos => (chosen() ? this.#moveTo(pos && pos.rowId) : view.setCursorPos(pos)),
      },
    };
  }

  // Choisit la table, et la ligne quand elle est donnée ; sans ligne, celle d'une section qui s'ouvre : la première du tableau, ou la ligne d'ajout (`new`) d'une
  // table vide (4.5, point 1). Rend `{ tableChanged }` : une autre table demande de rouvrir l'app (4.5, point 3) ; une autre ligne de la même table part en
  // message de ligne aux apps qui écoutent ; la même table sans ligne ne change rien.
  async choose(tableId, rowId = null) {
    if (this.#choice && this.#choice.tableId === tableId) {
      if (rowId === null || rowId === this.#choice.rowId) return { tableChanged: false };
      this.#choice = { tableId, rowId };
      this.#emit('record');
      return { tableChanged: false };
    }
    const [columns, data] = await Promise.all([this.#readColumns(tableId), this.#read(tableId)]);
    this.#stop();
    this.#choice = { tableId, rowId: rowId ?? firstRow(data) };
    this.#columns = columns;
    this.#remember(data);
    this.#schedule(data.id.length);
    return { tableChanged: true };
  }

  // Revenir à la page : la section de GFS décide de nouveau. Rend `{ tableChanged }`, comme `choose`.
  clear() {
    const had = this.#choice !== null;
    this.#stop();
    this.#choice = null;
    this.#columns = [];
    return { tableChanged: had };
  }

  // Les lignes d'une table pour la liste de la fenêtre : { id, label, search }, dans l'ordre du tableau.
  async rows(tableId) {
    const [columns, data] = await Promise.all([this.#readColumns(tableId), this.#read(tableId)]);
    return orderOf(data).map(i => ({ id: data.id[i], ...rowLabel(data, i, columns) }));
  }

  // ---------- l'état ----------

  #message(dataChange) { return { tableId: this.#choice.tableId, rowId: this.#choice.rowId, dataChange, mappingsChange: false }; }

  #subscribe(base, listener) {
    this.#listeners.add(listener);
    if (this.#choice && this.#listeners.size === 1) this.#schedule(0);
    // Les messages de table et de ligne de Grist parlent de la section : ils ne passent pas tant qu'une ligne de travail est choisie.
    const off = base.subscribe((kind, message) => { if (!(this.#choice && (kind === 'table' || kind === 'record'))) listener(kind, message); });
    return () => {
      off();
      this.#listeners.delete(listener);
      if (!this.#listeners.size) this.#stop();
    };
  }

  #emit(kind) {
    const message = this.#message(kind === 'table');
    for (const listener of [...this.#listeners]) listener(kind, message);
  }

  async #moveTo(rowId) {
    if (rowId === undefined || rowId === null || rowId === 'new') return;
    await this.choose(this.#choice.tableId, rowId);
  }

  // ---------- la lecture ----------

  async #readColumns(tableId) {
    const [tables, columns] = await Promise.all([this.#doc.fetchTable('_grist_Tables'), this.#doc.fetchTable('_grist_Tables_column')]);
    return viewColumns(tables, columns, tableId);
  }

  // Deux lectures de la même table demandées en même temps n'en font qu'une (4.5, point 4).
  #read(tableId) {
    if (this.#reading && this.#reading.tableId === tableId) return this.#reading.promise;
    const promise = Promise.resolve(this.#doc.fetchTable(tableId)).finally(() => { if (this.#reading && this.#reading.promise === promise) this.#reading = null; });
    this.#reading = { tableId, promise };
    return promise;
  }

  // Les valeurs d'une colonne aux positions `order`, comme la vue de Grist les rend.
  #values(data, col, order, options) {
    const source = data[(options.expandRefs ?? options.cellFormat !== 'typed') ? col.shown : col.colId] || [];
    return order.map(i => encode(source[i], col.type));
  }

  async #selectedTable(options) {
    const data = await this.#read(this.#choice.tableId);
    const order = orderOf(data);
    const out = {};
    for (const col of this.#columns) out[col.colId] = this.#values(data, col, order, options);
    out.id = order.map(i => data.id[i]);
    return out;
  }

  async #selectedRecord(rowId, options) {
    const data = await this.#read(this.#choice.tableId);
    const record = { id: rowId };
    for (const col of this.#columns) [record[col.colId]] = this.#values(data, col, [data.id.indexOf(rowId)], options);
    return record;
  }

  // ---------- la relecture ----------

  #remember(data, signature = JSON.stringify(data)) {
    this.#signature = signature;
    this.#keys = Object.keys(data).join();
  }

  #schedule(rows) {
    this.#timers.clearTimeout(this.#timer);
    if (!this.#choice || !this.#listeners.size) return;
    this.#timer = this.#timers.setTimeout(() => void this.#poll(), pollDelay(rows));
  }

  #stop() {
    this.#timers.clearTimeout(this.#timer);
    this.#timer = null;
  }

  async #poll() {
    const choice = this.#choice;
    if (!choice) return;
    if (this.#hidden()) { this.#schedule(0); return; }
    let rows = 0;
    try {
      const data = await this.#read(choice.tableId);
      if (this.#choice !== choice) return; // une autre table a été choisie pendant la lecture : elle a sa propre relecture
      rows = data.id.length;
      const signature = JSON.stringify(data);
      if (signature !== this.#signature) {
        // Une colonne ajoutée, retirée ou renommée : les colonnes de la vue se relisent.
        if (Object.keys(data).join() !== this.#keys) this.#columns = await this.#readColumns(choice.tableId);
        this.#remember(data, signature);
        this.#emit('table');
      }
    } catch (error) {
      console.warn('GFS : la table de travail est illisible', error);
    }
    if (this.#choice === choice) this.#schedule(rows);
  }
}

// Les positions des lignes dans l'ordre du tableau (`manualSort`), sinon dans l'ordre des identifiants.
function orderOf(data) {
  const order = data.id.map((id, i) => i);
  if (data.manualSort) order.sort((a, b) => data.manualSort[a] - data.manualSort[b]);
  return order;
}

// La ligne d'une section qui s'ouvre : la première du tableau, ou la ligne d'ajout d'une table vide.
function firstRow(data) {
  const [at] = orderOf(data);
  return at === undefined ? 'new' : data.id[at];
}
