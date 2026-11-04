// Une table que GFS crée et écrit lui-même dans le document (`GFS_Rangement`, contrats 6.4 ; `GFS_Fichiers`, contrats 6.6) : la relire, la créer avec l'accord de la personne,
// lui ajouter une colonne absente. Un seul lieu pour ces règles, pour que chaque table de GFS les suive :
//   lire ne crée rien ; écrire relit d'abord, et ne crée la table qu'avec l'accord de la personne (6.2, point 1) ;
//   après `AddTable`, l'identifiant réel est relu (6.2, point 2) ; une colonne absente est ajoutée avant d'être écrite (6.1, point 3) : une seule colonne inconnue annulerait tout le lot.

const sameName = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

// La personne a refusé de créer la table : rien ne s'installe, rien ne se range.
export class TableDeclined extends Error {
  code = 'GFS_TABLE_REFUSEE';
  constructor(table) {
    super(`La personne a refusé de créer la table ${table}.`);
    this.table = table;
  }
}

export class OwnTable {
  #port;
  #name;
  #columns;
  #consent;
  #tableId;

  // `port` : { doc } (les interfaces brutes de Grist) ; `columns` : [{ id, type, … }] telles que `AddTable` les reçoit ; `consent()` : une promesse, `true` quand la personne accepte la création.
  constructor({ port, name, columns, consent }) {
    this.#port = port;
    this.#name = name;
    this.#columns = columns;
    this.#consent = consent;
    this.#tableId = name;
  }

  // L'identifiant que Grist a vraiment donné à la table (le nom voulu tant qu'elle n'est pas lue).
  get id() { return this.#tableId; }

  // La table telle qu'elle est : { exists, columns, data }. Ne crée rien.
  async load() {
    const tables = (await this.#port.doc.listTables()).map(String);
    const found = tables.find(name => sameName(name, this.#name));
    if (!found) return { exists: false, columns: [], data: null };
    this.#tableId = found;
    const data = await this.#port.doc.fetchTable(found);
    return { exists: true, columns: Object.keys(data || {}), data };
  }

  // La table prête à être écrite, relue juste avant, avec les colonnes `needed` : sans table, l'accord de la personne, puis la création.
  async ready(needed = []) {
    let state = await this.load();
    if (!state.exists) {
      if (!(await this.#consent())) throw new TableDeclined(this.#name);
      state = await this.load(); // la table a pu naître pendant la question
      if (!state.exists) state = await this.#create();
    }
    for (const column of needed.filter(name => !state.columns.includes(name))) await this.addColumn(column);
    return state;
  }

  // La table seulement si elle existe, relue juste avant, avec les colonnes `needed` ajoutées au besoin ; null sans table. Pour un geste sur une ligne qui y est déjà (mettre un fichier à la
  // corbeille, le restaurer) : un geste de ce genre ne crée jamais la table, et ne demande donc jamais son accord.
  async existing(needed = []) {
    const state = await this.load();
    if (!state.exists) return null;
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
    if (!sameName(this.#tableId, this.#name)) console.warn(`GFS : Grist a nommé la table ${this.#tableId} au lieu de ${this.#name}`);
    return { exists: true, columns: this.#columns.map(column => column.id), data: null };
  }
}
