// La table du document où GFS retient ce qui vaut pour tout le document : `GFS_Rangement` (contrats 6.4). Ici, une seule ligne réservée, les apps installées
// (`@document` / `gfs` / `apps`, la valeur en JSON dans `Valeur`, contrats 7.4). GFS seul l'écrit, par sa propre connexion à Grist.
//   lire ne crée rien (7.4, point 6) ; écrire relit d'abord, et ne crée la table qu'avec l'accord de la personne (6.2, point 1) ;
//   après `AddTable`, l'identifiant réel est relu (6.2, point 2) ; une colonne absente est ajoutée avant d'être écrite (6.1, point 3).

export const TABLE = 'GFS_Rangement';
export const RESERVED = Object.freeze({ Utilisateur: '@document', App: 'gfs', Fichier: 'apps' });
const COLUMNS = Object.freeze([
  { id: 'Utilisateur', type: 'Text' }, { id: 'App', type: 'Text' }, { id: 'Fichier', type: 'Text' },
  { id: 'Favori', type: 'Bool' }, { id: 'Dossier', type: 'Text' }, { id: 'Replie', type: 'Bool' }, { id: 'Valeur', type: 'Text' },
]);
// Les colonnes sans lesquelles la ligne réservée ne s'écrit pas.
const REQUIRED = Object.freeze(['Utilisateur', 'App', 'Fichier', 'Valeur']);

const sameName = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

// La personne a refusé de créer la table : rien ne s'installe.
export class TableDeclined extends Error {
  code = 'GFS_TABLE_REFUSEE';
  constructor() { super('La personne a refusé de créer la table GFS_Rangement.'); }
}

function parseValue(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  try { return JSON.parse(text); } catch (error) { return null; }
}

export class Rangement {
  #port;
  #consent;
  #tableId = TABLE;

  // `port` : { doc } (les interfaces brutes de Grist) ; `consent()` : une promesse, true quand la personne accepte la création de la table.
  constructor({ port, consent }) {
    this.#port = port;
    this.#consent = consent;
  }

  // Ce que la table dit : { exists, columns, rowId, raw }. `raw` est la valeur JSON de la ligne réservée, ou null (pas de table, pas de ligne, texte illisible).
  async read() {
    const tables = (await this.#port.doc.listTables()).map(String);
    const found = tables.find(name => sameName(name, TABLE));
    if (!found) return { exists: false, columns: [], rowId: null, raw: null };
    this.#tableId = found;
    const data = await this.#port.doc.fetchTable(found);
    const columns = Object.keys(data || {});
    const rows = (data && data.id) || [];
    const at = rows.findIndex((rowId, i) => Object.keys(RESERVED).every(column => data[column] && data[column][i] === RESERVED[column]));
    return { exists: true, columns, rowId: at >= 0 ? rows[at] : null, raw: at >= 0 && data.Valeur ? parseValue(data.Valeur[at]) : null };
  }

  // Écrit la ligne réservée : relit, applique `mutate(raw) -> nouvelle valeur`, écrit. Rend la valeur écrite. Sans table : demande l'accord, puis la crée.
  async update(mutate) {
    let state = await this.read();
    if (!state.exists) {
      if (!(await this.#consent())) throw new TableDeclined();
      state = await this.read(); // la table a pu naître pendant la question
      if (!state.exists) state = await this.#create();
    }
    const missing = REQUIRED.filter(column => !state.columns.includes(column));
    for (const column of missing) await this.#port.doc.applyUserActions([['AddColumn', this.#tableId, column, { type: 'Text' }]]);
    const next = mutate(state.raw);
    const record = { Valeur: JSON.stringify(next) };
    await this.#port.doc.applyUserActions([state.rowId ? ['UpdateRecord', this.#tableId, state.rowId, record] : ['AddRecord', this.#tableId, null, { ...RESERVED, ...record }]]);
    return next;
  }

  // La table naît avec toutes ses colonnes ; l'identifiant que Grist a vraiment donné est celui des écritures suivantes.
  async #create() {
    const result = await this.#port.doc.applyUserActions([['AddTable', TABLE, COLUMNS.map(column => ({ ...column }))]]);
    const made = result && Array.isArray(result.retValues) && result.retValues[0];
    this.#tableId = (made && made.table_id) || TABLE;
    if (!sameName(this.#tableId, TABLE)) console.warn(`GFS : Grist a nommé la table ${this.#tableId} au lieu de ${TABLE}`);
    return { exists: true, columns: COLUMNS.map(column => column.id), rowId: null, raw: null };
  }
}
