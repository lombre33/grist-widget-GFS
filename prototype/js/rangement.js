// La table du document où GFS retient ce qui vaut pour tout le document et le rangement des fichiers : `GFS_Rangement` (contrats 6.4). Deux sortes de lignes :
// la ligne réservée des apps installées (`@document` / `gfs` / `apps`, la valeur en JSON dans `Valeur`, contrats 7.4) et une ligne par (personne, app, fichier)
// qui a un favori ou un dossier (6.4, point 1). GFS seul l'écrit, par sa propre connexion à Grist.
//   lire ne crée rien (7.4, point 6) ; écrire relit d'abord, et ne crée la table qu'avec l'accord de la personne (6.2, point 1) ;
//   après `AddTable`, l'identifiant réel est relu (6.2, point 2) ; une colonne absente est ajoutée avant d'être écrite (6.1, point 3).

export const TABLE = 'GFS_Rangement';
export const RESERVED = Object.freeze({ Utilisateur: '@document', App: 'gfs', Fichier: 'apps' });
const COLUMNS = Object.freeze([
  { id: 'Utilisateur', type: 'Text' }, { id: 'App', type: 'Text' }, { id: 'Fichier', type: 'Text' },
  { id: 'Favori', type: 'Bool' }, { id: 'Dossier', type: 'Text' }, { id: 'Replie', type: 'Bool' }, { id: 'Valeur', type: 'Text' },
]);
// Les colonnes sans lesquelles la ligne réservée ne s'écrit pas, puis celles d'une ligne de rangement.
const REQUIRED = Object.freeze(['Utilisateur', 'App', 'Fichier', 'Valeur']);
const FILING = Object.freeze(['Utilisateur', 'App', 'Fichier', 'Favori', 'Dossier']);

const sameName = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const typeOf = id => COLUMNS.find(column => column.id === id).type;

// La personne a refusé de créer la table : rien ne s'installe, rien ne se range.
export class TableDeclined extends Error {
  code = 'GFS_TABLE_REFUSEE';
  constructor() { super('La personne a refusé de créer la table GFS_Rangement.'); }
}

function parseValue(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  try { return JSON.parse(text); } catch (error) { return null; }
}

// La ligne de `data` (une table telle que `fetchTable` la rend) dont les colonnes valent `values`, ou -1.
function findRow(data, values) {
  const rows = (data && data.id) || [];
  return rows.findIndex((rowId, i) => Object.keys(values).every(column => data[column] && data[column][i] === values[column]));
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

  // La table telle qu'elle est : { exists, columns, data }.
  async #load() {
    const tables = (await this.#port.doc.listTables()).map(String);
    const found = tables.find(name => sameName(name, TABLE));
    if (!found) return { exists: false, columns: [], data: null };
    this.#tableId = found;
    const data = await this.#port.doc.fetchTable(found);
    return { exists: true, columns: Object.keys(data || {}), data };
  }

  // Ce que la table dit : { exists, columns, rowId, raw }. `raw` est la valeur JSON de la ligne réservée, ou null (pas de table, pas de ligne, texte illisible).
  async read() {
    const { exists, columns, data } = await this.#load();
    if (!exists) return { exists: false, columns: [], rowId: null, raw: null };
    const at = findRow(data, RESERVED);
    return { exists: true, columns, rowId: at >= 0 ? data.id[at] : null, raw: at >= 0 && data.Valeur ? parseValue(data.Valeur[at]) : null };
  }

  // La table prête à être écrite, relue juste avant, avec les colonnes `needed` : sans table, l'accord de la personne, puis la création.
  async #ready(needed) {
    let state = await this.#load();
    if (!state.exists) {
      if (!(await this.#consent())) throw new TableDeclined();
      state = await this.#load(); // la table a pu naître pendant la question
      if (!state.exists) state = await this.#create();
    }
    for (const column of needed.filter(name => !state.columns.includes(name))) {
      await this.#port.doc.applyUserActions([['AddColumn', this.#tableId, column, { type: typeOf(column) }]]);
    }
    return state;
  }

  // Écrit la ligne réservée : relit, applique `mutate(raw) -> nouvelle valeur`, écrit. Rend la valeur écrite. Sans table : demande l'accord, puis la crée.
  async update(mutate) {
    const { data } = await this.#ready(REQUIRED);
    const at = findRow(data, RESERVED);
    const next = mutate(at >= 0 && data.Valeur ? parseValue(data.Valeur[at]) : null);
    const record = { Valeur: JSON.stringify(next) };
    await this.#port.doc.applyUserActions([at >= 0 ? ['UpdateRecord', this.#tableId, data.id[at], record] : ['AddRecord', this.#tableId, null, { ...RESERVED, ...record }]]);
    return next;
  }

  // Range des fichiers pour la personne `identity` ('' quand son identité n'est pas résolue : le rangement est partagé, 6.4 point 4) : la ligne de chaque
  // (personne, app, fichier) est mise à jour si elle existe, ajoutée sinon. `entries` : [{ app, file, pinned, folder }], le dossier en chemin normalisé.
  // Relit d'abord ; tout part en un seul lot, que Grist rejoue en entier ou pas du tout.
  async setFiling(identity, entries) {
    if (String(identity).startsWith('@')) throw new Error('Une identité qui commence par « @ » est réservée à GFS (contrats 6.4, point 6).');
    if (!entries.length) return;
    const { data } = await this.#ready(FILING);
    const actions = entries.map(({ app, file, pinned, folder }) => {
      const key = { Utilisateur: identity, App: app, Fichier: String(file) };
      const at = findRow(data, key);
      const record = { Favori: pinned === true, Dossier: folder || '' };
      return at >= 0 ? ['UpdateRecord', this.#tableId, data.id[at], record] : ['AddRecord', this.#tableId, null, { ...key, ...record }];
    });
    await this.#port.doc.applyUserActions(actions);
  }

  // La table naît avec toutes ses colonnes ; l'identifiant que Grist a vraiment donné est celui des écritures suivantes.
  async #create() {
    const result = await this.#port.doc.applyUserActions([['AddTable', TABLE, COLUMNS.map(column => ({ ...column }))]]);
    const made = result && Array.isArray(result.retValues) && result.retValues[0];
    this.#tableId = (made && made.table_id) || TABLE;
    if (!sameName(this.#tableId, TABLE)) console.warn(`GFS : Grist a nommé la table ${this.#tableId} au lieu de ${TABLE}`);
    return { exists: true, columns: COLUMNS.map(column => column.id), data: null };
  }
}
