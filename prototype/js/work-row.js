// La table de travail (contrats 4.5) : une table, et au besoin sa ligne, choisies dans GFS, que l'app ouverte reçoit comme celles de la section de GFS. Le
// courtier ne change pas : la session reçoit un état (`state`) et une vue de Grist (`port`) qui, sans choix, sont ceux de Grist ; avec un choix, ils disent la
// table et la ligne choisies et rendent leurs lignes depuis la table lue par GFS (`fetchTable`), sous la forme de la vue de Grist. Grist ne prévient pas des
// changements d'une autre table que celle de la section (5.5, point 1) : GFS relit la table choisie tant qu'une app l'écoute.

// Le rythme de la relecture (4.5, point 4) : [jusqu'à tant de lignes, toutes les tant de ms].
const PACE = [[5000, 2000], [20000, 5000], [Infinity, 10000]];
export const pollDelay = rows => PACE.find(([most]) => rows <= most)[1];

// Les codes des valeurs encodées de Grist (GristObjCode) : ce que la vue de Grist rend pour un nombre d'une colonne Date, DateTime ou Référence.
const CODES = Object.freeze({ Date: 'd', DateTime: 'D', Ref: 'R' });

// Comme la vue de Grist (WidgetFrame, format par défaut) : un nombre d'une colonne Date, DateTime ou Référence devient une valeur encodée ; le reste passe tel
// quel.
export function encode(value, type) {
  if (typeof value !== 'number') return value;
  const [base, rest] = String(type).split(/:(.*)/);
  if (base === 'Date') return [CODES.Date, value];
  if (base === 'DateTime') return [CODES.DateTime, value, rest];
  if (base === 'Ref') return [CODES.Ref, rest, value];
  return value;
}

// Les colonnes que la vue de Grist montrerait, lues dans `_grist_Tables` et `_grist_Tables_column` : ni `manualSort` ni les colonnes d'aide ; `shown`, la
// colonne affichée d'une Référence (`expandRefs`), la colonne elle-même pour les autres.
export function viewColumns(tables, columns, tableId) {
  const ref = tables.id[tables.tableId.indexOf(tableId)];
  const idOf = new Map(columns.id.map((id, i) => [id, columns.colId[i]]));
  return columns.id.map((id, i) => ({ colId: columns.colId[i], type: columns.type[i], parent: columns.parentId[i], shown: idOf.get(columns.displayCol[i]) ||
    columns.colId[i] }))
    .filter(col => col.parent === ref && col.colId !== 'manualSort' && !col.colId.startsWith('gristHelper_'))
    .map(({ colId, type, shown }) => ({ colId, type, shown }));
}

// Une ligne que Grist dit à l'app : un numéro. Le script d'API de Grist ignore le reste (rien, ou « new ») : `onRecord` n'est alors pas appelé (4.5, point 7).
export const hasRow = message => Boolean(message) && Number.isInteger(message.rowId) && message.rowId > 0;

// La section est reliée par « Select by » : Grist le dit dans les réglages (`settings.linking.asTarget`, une chaîne). Sans lien, ou sans cette information (un
// Grist plus ancien), elle ne l'est pas.
export function isLinked(options) {
  const linking = options && options.settings && options.settings.linking;
  return Boolean(linking) && typeof linking.asTarget === 'string' && linking.asTarget !== '';
}

// Une table appartient à une app quand elle porte son préfixe (2.3), ce préfixe sans son « _ » final, ou qu'elle est la table de ses fichiers (2.4).
const ownedBy = (manifest, id) => {
  const prefix = manifest.tables && manifest.tables.prefixe;
  if (prefix && (id.startsWith(prefix) || id === prefix.replace(/_$/, ''))) return true;
  return (manifest.fichiers || []).some(spec => spec.table === id);
};

// Les tables qu'on peut choisir (4.5, point 1) : ni celles de Grist, ni celles de GFS, ni celles des apps.
export const workTables = (tableIds, manifests) => tableIds.filter(id => !/^_grist_/.test(id) && !/^GFS_/.test(id) &&
  !manifests.some(manifest => ownedBy(manifest, id)));

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
  #page = null; // { tableId, rowId, picked } : la ligne que GFS donne pour la table de la page, première du tableau ou choisie ici (4.5, point 7)
  #seen = null; // la dernière ligne que Grist a dite pour la table de la page
  #following = null; // l'état de Grist dont les changements de ligne remplacent la ligne choisie sur la page
  #onPage;
  #filling = false;

  // doc : `GristDocAPI` de GFS (port.doc) ; timers : { setTimeout, clearTimeout } ; hidden() : la page est cachée (la relecture attend) ; onPageChange() :
  //   Grist a remplacé la ligne que la personne avait choisie sur la page.
  constructor({ doc, timers = globalThis, hidden = () => false, onPageChange = () => {} }) {
    this.#onPage = onPageChange;
    this.#doc = doc;
    this.#timers = timers;
    this.#hidden = hidden;
  }

  // { tableId, rowId } ou null : la page décide.
  get choice() { return this.#choice && { ...this.#choice }; }

  // { tableId, rowId, picked } ou null : la ligne que GFS donne pour la table de la page. `picked` : la personne l'a choisie ; sinon c'est la première du
  // tableau.
  get pageRow() { return this.#page && { ...this.#page }; }

  // L'état que reçoit une session (session.js) : celui de Grist, sauf la table et la ligne quand une ligne de travail est choisie.
  state(base) {
    const work = this;
    return {
      get options() { return base.options; },
      get theme() { return base.theme; },
      get table() { return work.#choice ? work.#message(true) : base.table; },
      get grantedAccess() { return base.grantedAccess; },
      tableNow: () => (this.#choice ? this.#message(true) : this.#viaPage(base, base.tableNow(), 'table')),
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

  // Choisit la table, et la ligne quand elle est donnée ; sans ligne, celle d'une section qui s'ouvre : la première du tableau, ou la ligne d'ajout (`new`)
  // d'une table vide (4.5, point 1). Rend `{ tableChanged }` : une autre table demande de rouvrir l'app (4.5, point 3) ; une autre ligne de la même table part
  // en message de ligne aux apps qui écoutent ; la même table sans ligne ne change rien.
  async choose(tableId, rowId = null) {
    if (this.#choice && this.#choice.tableId === tableId) {
      if (rowId === null || rowId === this.#choice.rowId) return { tableChanged: false };
      this.#choice = { tableId, rowId };
      this.#emit('record');
      return { tableChanged: false };
    }
    const [columns, data] = await Promise.all([this.#readColumns(tableId), this.#read(tableId)]);
    this.#stop();
    this.#page = null;
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
    this.#page = null;
    return { tableChanged: had };
  }

  // La personne choisit une ligne de la table de la page (« Ligne » du premier article) : l'app la reçoit tout de suite, et elle vaut tant que Grist ne change
  // pas de ligne (4.5, point 7). Sans table de travail choisie : la page décide toujours.
  pickPage(base, tableId, rowId) {
    const now = base.tableNow();
    this.#seen = now && now.tableId === tableId && hasRow(now) ? now.rowId : null;
    this.#page = { tableId, rowId, picked: true };
    this.#follow(base);
    this.#emitPage();
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
    // Les messages de table et de ligne de Grist parlent de la section : ils ne passent pas tant qu'une ligne de travail est choisie ; sans elle, la page
    // décide (`#viaPage`).
    const off = base.subscribe((kind, message) => {
      if (kind !== 'table' && kind !== 'record') listener(kind, message);
      else if (!this.#choice) { this.#noticeGrist(kind, message); listener(kind, this.#viaPage(base, message, kind)); }
    });
    if (!this.#choice) this.#viaPage(base, base.tableNow(), 'table');
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

  // Ce que l'app reçoit quand la page décide (4.5, point 7) : la ligne de Grist, sauf celle que la personne a choisie ici, qui vaut tant que Grist ne change
  // pas de ligne ; et quand Grist n'en dit aucune pour une section non reliée (cursor sans ligne, filtre qui les écarte toutes, ligne d'ajout), la première du
  // tableau.
  #viaPage(base, message, kind) {
    if (!message || !message.tableId) return message;
    if (this.#page && this.#page.tableId !== message.tableId) this.#page = null;
    const page = this.#page;
    if (page && page.picked) return { ...message, rowId: page.rowId };
    if (hasRow(message) || isLinked(base.options)) { this.#page = null; return message; }
    if (!page || kind === 'table') void this.#fillPage(base, message.tableId);
    return page ? { ...message, rowId: page.rowId } : message;
  }

  // Grist change de ligne (un message, de ligne ou de table, qui dit un autre numéro que celui qu'il a dit en dernier) : la sienne passe avant celle que la
  // personne avait choisie sur la page. Un message de table qui redit la même ligne (un changement de données) ne change rien.
  #noticeGrist(kind, message) {
    if (!hasRow(message) || (kind !== 'table' && kind !== 'record')) return;
    const moved = message.rowId !== this.#seen;
    this.#seen = message.rowId;
    if (moved && this.#page && this.#page.picked) { this.#page = null; this.#onPage(); }
  }

  // Tant que la personne a choisi une ligne sur la page, GFS écoute Grist même sans app ouverte : le jour où Grist change de ligne, la sienne a remplacé la
  // choisie.
  #follow(base) {
    if (this.#following === base) return;
    this.#following = base;
    base.subscribe((kind, message) => { if (!this.#choice) this.#noticeGrist(kind, message); });
  }

  // La première ligne se donne quand la page décide, que Grist n'en dit aucune pour cette table, que la section n'est pas reliée et que la personne n'en a pas
  // choisi.
  #wantsFirst(base, tableId) {
    const now = this.#choice ? null : base.tableNow();
    return Boolean(now) && now.tableId === tableId && !hasRow(now) && !isLinked(base.options) && !(this.#page && this.#page.picked);
  }

  // Lit la table de la page et donne sa première ligne aux apps ; une table vide n'en donne aucune (la ligne d'ajout reste à Grist). Une première ligne qui a
  // changé (retirée, déplacée) est redonnée.
  async #fillPage(base, tableId) {
    if (this.#filling) return;
    this.#filling = true;
    try {
      const table = await this.#read(tableId);
      const [at] = orderOf(table);
      if (at === undefined || !this.#wantsFirst(base, tableId)) return;
      if (this.#page && this.#page.rowId === table.id[at]) return;
      this.#page = { tableId, rowId: table.id[at], picked: false };
      this.#emitPage();
    } catch (error) {
      console.warn('GFS : la table de la page est illisible', error);
    } finally {
      this.#filling = false;
    }
  }

  #emitPage() {
    const message = { tableId: this.#page.tableId, rowId: this.#page.rowId, dataChange: false };
    for (const listener of [...this.#listeners]) listener('record', message);
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
    const promise = Promise.resolve(this.#doc.fetchTable(tableId)).finally(() =>
      { if (this.#reading && this.#reading.promise === promise) this.#reading = null; });
    this.#reading = { tableId, promise };
    return promise;
  }

  // Les valeurs d'une colonne aux positions `order`, comme la vue de Grist les rend.
  #values(data, col, order, options) {
    const source = data[(options.expandRefs ?? options.cellFormat !== 'typed') ? col.shown : col.colId] || [];
    return order.map(i => encode(source[i], col.type));
  }

  async #selectedTable(options) {
    const table = await this.#read(this.#choice.tableId);
    const order = orderOf(table);
    const out = {};
    for (const col of this.#columns) out[col.colId] = this.#values(table, col, order, options);
    out.id = order.map(i => table.id[i]);
    return out;
  }

  async #selectedRecord(rowId, options) {
    const table = await this.#read(this.#choice.tableId);
    const record = { id: rowId };
    for (const col of this.#columns) [record[col.colId]] = this.#values(table, col, [table.id.indexOf(rowId)], options);
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
      const table = await this.#read(choice.tableId);
      if (this.#choice !== choice) return; // une autre table a été choisie pendant la lecture : elle a sa propre relecture
      rows = table.id.length;
      const signature = JSON.stringify(table);
      if (signature !== this.#signature) {
        // Une colonne ajoutée, retirée ou renommée : les colonnes de la vue se relisent.
        if (Object.keys(table).join() !== this.#keys) this.#columns = await this.#readColumns(choice.tableId);
        this.#remember(table, signature);
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
