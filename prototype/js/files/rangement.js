// La table du document où GFS retient ce qui vaut pour tout le document et le rangement des fichiers : `GFS_Rangement` (contrats 6.4). Quatre sortes de lignes
// (la dernière, les dossiers suivis, plus bas) : la ligne réservée des apps installées (`@document` / `gfs` / `apps`, la valeur en JSON dans `Valeur`, contrats
// 7.4), la ligne-sonde qui apprend à GFS l'adresse de la personne (`@sonde`, ajoutée puis retirée aussitôt, 6.4 point 6) et une ligne par (personne, app,
// fichier) qui a un favori ou un dossier (6.4, point 1). GFS seul l'écrit, par sa propre connexion à Grist. Les règles d'une table de GFS (lire ne crée rien,
// 7.4 point 6 ; écrire relit d'abord et ne crée la table qu'avec l'accord de la personne, 6.2 point 1 ; l'identifiant réel relu après `AddTable`, 6.2 point 2 ;
// une colonne absente ajoutée avant d'être écrite, 6.1 point 3) sont celles de `OwnTable` (js/files/own-table.js).

import { OwnTable, TableDeclined } from './own-table.js';
import { appActions, carryOver, usable } from './app-filing.js';
import { readGfsFolderRows } from '../explorer/explorer-model.js';
import { DocumentNewer, STRUCTURE, STRUCTURE_ROW, isNewer, stamped, structureFrom } from './structure.js';

export { TableDeclined, DocumentNewer };

export const TABLE = 'GFS_Rangement';
export const RESERVED = Object.freeze({ Utilisateur: '@document', App: 'gfs', Fichier: 'apps' });
// La ligne-sonde : ajoutée puis retirée aussitôt, c'est elle seule que Grist remplit de l'adresse de la personne (formule déclenchée de `Adresse`, 6.4 point
// 6).
const PROBE = Object.freeze({ Utilisateur: '@sonde' });
export const COLUMNS = Object.freeze([
  { id: 'Utilisateur', type: 'Text' }, { id: 'App', type: 'Text' }, { id: 'Fichier', type: 'Text' },
  { id: 'Favori', type: 'Bool' }, { id: 'Dossier', type: 'Text' }, { id: 'Replie', type: 'Bool' }, { id: 'Valeur', type: 'Text' },
  // Une formule déclenchée (`recalcWhen: 0` : à la création d'une ligne ; `recalcDeps: null` : jamais ensuite) : Grist y écrit `user.Email` pour la
  // ligne-sonde, rien pour les autres.
  { id: 'Adresse', type: 'Text', isFormula: false, formula: `user.Email if $Utilisateur == '${PROBE.Utilisateur}' else ''`, recalcWhen: 0, recalcDeps: null },
]);
// Les colonnes sans lesquelles la ligne réservée ne s'écrit pas, puis celles d'une ligne de rangement.
const REQUIRED = Object.freeze(['Utilisateur', 'App', 'Fichier', 'Valeur']);
// Les dossiers partagés « à jour » avec un document relié (11/11) : une ligne par (personne, document relié, dossier), `App` = FOLLOW_APP, `Fichier` = l'export
// du lien, `Dossier` = le chemin, `Valeur` = la liste JSON des fichiers du dossier au dernier passage (js/share-follow.js). Ni un fichier rangé ni un dossier
// gardé : `readGfsFiling` ne trouve aucun fichier sous cette app.
export const FOLLOW_APP = 'gfs-suivi';
const FOLLOW = Object.freeze(['Utilisateur', 'App', 'Fichier', 'Dossier', 'Valeur']);
const followKey = (identity, link, path) => ({ Utilisateur: identity, App: FOLLOW_APP, Fichier: String(link), Dossier: path });
const FILING = Object.freeze(['Utilisateur', 'App', 'Fichier', 'Favori', 'Dossier']);

const ANONYMOUS = 'anon@getgrist.com'; // l'adresse que Grist donne à quiconque n'est pas connecté

// Ce que Grist a écrit dans `Adresse`, ou '' quand ce n'est pas l'adresse d'une personne : rien, une erreur de la formule, l'anonyme de Grist, un nom réservé à
// GFS (en « @ »).
function addressOf(value) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  return /^[^@\s]+@[^@\s]+$/.test(text) && text.toLowerCase() !== ANONYMOUS ? text : '';
}

function parseValue(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  try { return JSON.parse(text); } catch (error) { return null; }
}

// Une liste JSON de textes (les fichiers d'un dossier suivi), ou [] quand la cellule n'en est pas une.
function parseList(text) {
  const value = parseValue(text);
  return Array.isArray(value) ? value.map(String) : [];
}

// La ligne de `data` (une table telle que `fetchTable` la rend) dont les colonnes valent `values`, ou -1.
function findRow(data, values) {
  const rows = (data && data.id) || [];
  return rows.findIndex((rowId, i) => Object.keys(values).every(column => data[column] && data[column][i] === values[column]));
}

// Les numéros de toutes les lignes de `data` dont les colonnes valent `values`.
const rowsOf = (data, values) => ((data && data.id) || []).filter((rowId, i) => Object.keys(values).every(column => data[column] &&
  data[column][i] === values[column]));

// La ligne d'état d'un dossier que la personne garde sans fichier : ni app ni fichier (6.4, point 11).
const folderKey = (identity, path) => ({ Utilisateur: identity, App: '', Fichier: '', Dossier: path });

// Les dossiers gardés qui changent de chemin (`moved` : [[de, vers]]) : leur ligne d'état change de chemin, sur place ; sans ligne, le chemin d'arrivée est
// gardé comme avant ; si le chemin d'arrivée a déjà sa ligne, celle du dossier qui arrive est retirée (le dossier d'arrivée garde ses partages).
function movedActions(tableId, data, identity, moved) {
  const actions = [];
  for (const [from, to] of moved) {
    const rows = rowsOf(data, folderKey(identity, from));
    const taken = findRow(data, folderKey(identity, to)) >= 0;
    if (!rows.length) { if (!taken) actions.push(['AddRecord', tableId, null, { ...folderKey(identity, to), Favori: false }]); continue; }
    actions.push(...rows.map(rowId => (taken ? ['RemoveRecord', tableId, rowId] : ['UpdateRecord', tableId, rowId, { Dossier: to }])));
  }
  return actions;
}

// Les actions sur les lignes d'état des dossiers gardés (`add`, `drop`, `moved`, `merged` : voir `setFiling`) : celles qu'on retire, celles qu'on ajoute (si le
// chemin n'a pas déjà sa ligne), celles qui changent de chemin sur place, celles qui se fondent dans un dossier qui existe déjà.
function folderActions(tableId, data, identity, { add, drop, moved, merged }) {
  const removal = rowId => ['RemoveRecord', tableId, rowId];
  return [...drop.flatMap(path => rowsOf(data, folderKey(identity, path)).map(removal)),
    ...add.filter(path => !drop.includes(path) && findRow(data, folderKey(identity, path)) < 0).map(path => (
      ['AddRecord', tableId, null, { ...folderKey(identity, path), Favori: false }])),
    ...movedActions(tableId, data, identity, moved),
    ...merged.flatMap(([from]) => rowsOf(data, folderKey(identity, from)).map(removal))];
}

export class Rangement {
  #port;
  #table;
  #canWrite;
  #onIdentity;
  #appFilings;
  #appTables = new Map(); // une `OwnTable` par table d'app : elle retient l'identifiant vu, la lecture suivante part d'avance (js/files/own-table.js)
  #identity = null; // null : pas encore lue ; '' : lue, sans adresse de personne ; sinon l'adresse
  #pending = null;
  #stamped = false; // le numéro de structure a été tenté (noté ou refusé) pendant cette ouverture

  // `port` : { doc } (les interfaces brutes de Grist) ; `consent()` : une promesse, true quand la personne accepte la création de la table ;
  // `canWrite()` : faux quand le document est en lecture seule (la sonde n'écrirait que des refus) ; `onIdentity(adresse)` : appelé quand GFS apprend l'adresse
  //   de la personne ; `appFilings()` : les rangements que les apps tiennent elles-mêmes et que GFS écrit (js/files/app-filing.js, `appFilingOf`), lus au
  //   moment
  //   de ranger.
  constructor({ port, consent, canWrite = () => true, onIdentity = () => {}, appFilings = () => [] }) {
    this.#port = port;
    this.#table = new OwnTable({ port, name: TABLE, columns: COLUMNS, consent });
    this.#canWrite = canWrite;
    this.#onIdentity = onIdentity;
    this.#appFilings = appFilings;
  }

  // La table du rangement existe-t-elle, d'après ce que GFS a lu ou écrit ? Sans elle, le premier geste de rangement pose une question (créer la table) : il ne
  // s'affiche pas avant d'être écrit (js/explorer/filing.js).
  get known() { return this.#table.known; }

  // La lecture des fichiers a vu la table du rangement sous ce nom (null : elle n'existe pas) : le geste suivant s'en sert sans la chercher.
  note(tableId) { this.#table.note(tableId); }

  // L'adresse de la personne, '' tant que GFS ne la connaît pas : son rangement est alors commun au document (contrats 6.4, point 4).
  get identity() { return this.#identity || ''; }

  // Ce qui dit l'adresse sans rien refaire : la promesse de la sonde quand elle est en route, sinon ce que GFS en sait (`identity`). La lecture des fichiers
  // part sans attendre la sonde et ne l'attend qu'au moment de ranger (js/explorer/explorer-data.js).
  get learning() { return this.#pending || this.identity; }

  // Apprend l'adresse de la personne (6.4, point 6) : une ligne-sonde est ajoutée, Grist en remplit `Adresse`, GFS la lit et la retire. Une fois par
  // ouverture : la réponse, avec adresse ou sans, est gardée en mémoire (jamais dans le navigateur : une autre personne sur le même poste doit être reconnue).
  // Sans table (elle ne se crée pas ici), en lecture seule ou sur une erreur, rien n'est gardé et le geste suivant réessaie. Ne lève jamais : une adresse non
  // lue, c'est une personne inconnue.
  identify() {
    if (this.#identity !== null) return Promise.resolve(this.#identity);
    if (!this.#pending) {
      this.#pending = this.#probe()
        .then(found => this.#learn(found), error => {
          console.warn('GFS : l’adresse de la personne n’a pas pu être lue', error);
          return this.identity;
        })
        .finally(() => { this.#pending = null; });
    }
    return this.#pending;
  }

  #learn(found) {
    if (found === null) return this.identity;
    this.#identity = found;
    if (found) this.#onIdentity(found);
    return found;
  }

  // La sonde : l'adresse que Grist a écrite dans `Adresse` de la ligne ajoutée ('' si ce n'est pas celle d'une personne), ou null quand rien ne peut être tenté
  // (pas de table, lecture seule). Une colonne absente est ajoutée avant.
  async #probe() {
    if (!this.#canWrite()) return null;
    const { exists, columns } = await this.#table.load();
    if (!exists || !columns.includes('Utilisateur')) return null;
    const { doc } = this.#port;
    const tableId = this.#table.id;
    if (!columns.includes('Adresse')) await this.#table.addColumn('Adresse');
    const added = await doc.applyUserActions([['AddRecord', tableId, null, { ...PROBE }]]);
    const rowId = added && Array.isArray(added.retValues) ? added.retValues[0] : null;
    if (rowId == null) throw new Error(`AddRecord sur ${tableId} n’a renvoyé aucun identifiant de ligne`);
    try {
      const table = await doc.fetchTable(tableId);
      const at = (table.id || []).indexOf(rowId);
      return addressOf(at >= 0 && table.Adresse ? table.Adresse[at] : '');
    } finally {
      // La ligne part sans que l'adresse l'attende : une écriture de plus à Grist, c'est un aller-retour de réseau (deux fois le prix d'une lecture) que
      // l'explorateur n'a pas à patienter pour une adresse déjà lue.
      doc.applyUserActions([['RemoveRecord', tableId, rowId]]).catch(error => console.warn('GFS : la ligne-sonde n’a pas pu être retirée', error));
    }
  }

  // Ce que la table dit : { exists, columns, rowId, raw, structure }. `raw` est la valeur JSON de la ligne réservée, ou null (pas de table, pas de ligne,
  // texte illisible) ; `structure` est le numéro de structure que le document a retenu (structure.js), ou null.
  async read() {
    const { exists, columns, data } = await this.#table.load();
    if (!exists) return { exists: false, columns: [], rowId: null, raw: null, structure: null };
    const at = findRow(data, RESERVED);
    return { exists: true, columns, rowId: at >= 0 ? data.id[at] : null, raw: at >= 0 && data.Valeur ? parseValue(data.Valeur[at]) : null,
      structure: this.#structureIn(data).found };
  }

  // Le numéro de structure que `data` (la table telle que `fetchTable` la rend, ou null) retient : { at, raw, found } (`at` : la ligne ou -1, `raw` : sa
  // valeur lue en JSON, `found` : le numéro ou null).
  #structureIn(data) {
    const at = findRow(data, STRUCTURE_ROW);
    const raw = at >= 0 && data.Valeur ? parseValue(data.Valeur[at]) : null;
    return { at, raw, found: structureFrom(raw) };
  }

  // Un document qu'une version plus récente a préparé ne s'écrit pas (structure.js) : l'erreur, avant tout geste.
  #guard(data) {
    const { found } = this.#structureIn(data);
    if (isNewer(found)) throw new DocumentNewer(found);
  }

  // Note le numéro de structure de cette version dans le document, après un geste qui a écrit dans la table : jamais avant (un geste refusé ne note rien),
  // jamais plus d'une fois par ouverture, et jamais en faisant échouer le geste (un document où la personne n'a pas le droit d'écrire les lignes `@document`
  // garde son rangement : GFS n'y note rien). La ligne se garde quand sa valeur porte autre chose (6.5, point 4) ; une valeur illisible n'est pas touchée.
  async #stamp(data) {
    if (this.#stamped) return;
    this.#stamped = true;
    const { at, raw, found } = this.#structureIn(data);
    if (found === STRUCTURE || (at >= 0 && raw === null)) return;
    const record = { Valeur: JSON.stringify(stamped(raw)) };
    const tableId = this.#table.id;
    try {
      await this.#port.doc.applyUserActions([at >= 0 ? ['UpdateRecord', tableId, data.id[at], record] :
        ['AddRecord', tableId, null, { ...STRUCTURE_ROW, ...record }]]);
    } catch (error) {
      console.warn('GFS : le numéro de structure n’a pas pu être noté dans le document', error);
    }
  }

  // La table prête à être écrite (js/files/own-table.js), avec les colonnes `needed`. La personne est reconnue avant la première écriture. Lève `DocumentNewer`
  // pour un document qu'une version plus récente a préparé.
  async #ready(needed) {
    const state = await this.#table.ready(needed);
    this.#guard(state.data);
    await this.identify();
    return state;
  }

  // Écrit la ligne réservée : relit, applique `mutate(raw) -> nouvelle valeur`, écrit. Rend la valeur écrite. Sans table : demande l'accord, puis la crée.
  async update(mutate) {
    const { data } = await this.#ready(REQUIRED);
    const at = findRow(data, RESERVED);
    const next = mutate(at >= 0 && data.Valeur ? parseValue(data.Valeur[at]) : null);
    const record = { Valeur: JSON.stringify(next) };
    const tableId = this.#table.id;
    await this.#port.doc.applyUserActions([at >= 0 ? ['UpdateRecord', tableId, data.id[at], record] :
      ['AddRecord', tableId, null, { ...RESERVED, ...record }]]);
    await this.#stamp(data);
    return next;
  }

  // Les dossiers que la personne partage « à jour » : [{ link, path, ids }] (`ids` : les fichiers du dossier au dernier passage). Sans table, ou sans la
  // colonne des valeurs : rien.
  async followed() {
    const { exists, columns, data } = await this.#table.load();
    if (!exists || FOLLOW.some(column => !columns.includes(column))) return [];
    await this.identify();
    const identity = this.identity;
    return data.id.map((rowId, i) => ({ user: data.Utilisateur[i], app: data.App[i], link: String(data.Fichier[i] || ''), path: String(data.Dossier[i] || ''),
      ids: parseList(data.Valeur[i]) }))
      .filter(row => row.user === identity && row.app === FOLLOW_APP && row.link && row.path).map(({ link, path, ids }) => ({ link, path, ids }));
  }

  // Suit le dossier `path` pour le lien `link` (ou met à jour ses fichiers, `ids`). Sans la table du rangement, rien n'est écrit et rien n'est demandé (un
  // dossier d'espace peut n'en avoir aucune) : rend false.
  async follow(link, path, ids) {
    const state = await this.#table.existing(FOLLOW);
    if (!state || isNewer(this.#structureIn(state.data).found)) return false;
    await this.identify();
    const key = followKey(this.identity, link, path);
    const at = findRow(state.data, key);
    const record = { Valeur: JSON.stringify(ids) };
    const tableId = this.#table.id;
    await this.#port.doc.applyUserActions([at >= 0 ? ['UpdateRecord', tableId, state.data.id[at], record] :
      ['AddRecord', tableId, null, { ...key, ...record }]]);
    return true;
  }

  // Ne suit plus le dossier `path` pour le lien `link` (ses lignes s'en vont). Rend le nombre de lignes retirées.
  async unfollow(link, path) {
    const { exists, data } = await this.#table.load();
    if (!exists || isNewer(this.#structureIn(data).found)) return 0;
    await this.identify();
    const rows = rowsOf(data, followKey(this.identity, link, path));
    if (rows.length) await this.#port.doc.applyUserActions(rows.map(rowId => ['RemoveRecord', this.#table.id, rowId]));
    return rows.length;
  }

  // La table du rangement telle qu'elle est, sans la créer ni poser de question : null quand elle manque ou qu'une colonne du rangement lui manque (aucune
  // n'est ajoutée ici). Pour ce qui ne vaut pas qu'on dérange la personne.
  async #loaded() {
    const state = await this.#table.load();
    if (!state.exists || FILING.some(column => !state.columns.includes(column)) || isNewer(this.#structureIn(state.data).found)) return null;
    await this.identify();
    return state;
  }

  // Les rangements que les apps tiennent elles-mêmes et que GFS écrit, pour celles dont la table est là avec ses colonnes (js/files/app-filing.js) : une Map,
  // app -> { filing, tableId, data }. Pour les autres (la table n'est pas née, une colonne manque), GFS range comme avant, dans `GFS_Rangement`. Les tables des
  // apps se lisent toutes ensemble : un aller-retour de réseau pour toutes, non un par app.
  async #appTargets() {
    const found = await Promise.all(this.#appFilings().map(async filing => {
      if (!this.#appTables.has(filing.table)) this.#appTables.set(filing.table, new OwnTable(
        { port: this.#port, name: filing.table, columns: [], consent: async () => false }));
      const table = this.#appTables.get(filing.table);
      const { data } = await table.load();
      return usable(filing, data) ? [filing.app, { filing, tableId: table.id, data }] : null;
    }));
    return new Map(found.filter(Boolean));
  }

  // Les lignes d'état des dossiers de la personne, relues : [{ id, path }] (un dossier de « Moi » se désigne dans les partages par le numéro de sa ligne,
  // js/sharing/folder-identity.js). Sans la table : aucune.
  async folderRows() {
    const state = await this.#loaded();
    return state ? readGfsFolderRows(state.data, this.identity) : [];
  }

  // Le numéro de la ligne d'état de chaque dossier de `paths` : une Map chemin -> numéro. `create` : le dossier qui n'a pas de ligne en reçoit une (aux deux
  // endroits, comme un dossier gardé sans fichier : ici et chez l'app qui tient une ligne d'état) ; sans cela, les dossiers sans ligne manquent à la Map.
  async folderIds(paths, create = false) {
    if (create && paths.length) await this.setFiling([], { add: paths, quiet: true });
    const rows = await this.folderRows();
    return new Map(paths.map(path => [path, (rows.find(row => row.path === path) || {}).id]).filter(([, id]) => id !== undefined));
  }

  // Range des fichiers pour la personne que Grist connaît (`identity`, ou '' quand son adresse n'est pas lue : le rangement est alors commun au document, 6.4
  // point 4) : la ligne de chaque (personne, app, fichier) est mise à jour si elle existe, ajoutée sinon. `entries` : [{ app, file, pinned, folder }], le
  // dossier en chemin normalisé. **Les fichiers d'une app qui tient son rangement et le laisse écrire (6.4, point 8) sont rangés dans la table de l'app**, pas
  // ici ; ce que `GFS_Rangement` disait déjà d'elle passe alors chez elle, dans le même lot.
  // `folders` : { add, drop, moved, merged, extra, quiet }, les dossiers que la personne garde sans fichier (6.4, point 11) :
  // - `add` : les chemins à garder (une ligne chacun, s'il n'y en a pas déjà, ici et chez chaque app qui a une ligne d'état de dossier) ;
  // - `drop` : ceux à ne plus garder (toutes leurs lignes) ;
  // - `moved` : [[de, vers]], un dossier gardé qui change de chemin : sa ligne d'état est **changée sur place** ici (son numéro, que les partages portent, ne
  //   change pas ; js/sharing/folder-identity.js), et retirée puis ajoutée chez l'app ;
  // - `merged` : [[de, vers]], un dossier gardé qui se fond dans un dossier qui existe déjà : sa ligne est retirée (le dossier d'arrivée garde ses partages,
  //   ceux du dossier qui arrive ne le suivent pas) ;
  // - `extra` : des actions de plus (les partages et les liens de ces dossiers) pour le même lot ;
  // - `quiet` : sans la table, rien n'est écrit et rien n'est demandé.
  // Relit d'abord ; fichiers et dossiers partent dans un seul lot, que Grist rejoue en entier ou pas du tout : un dossier déplacé n'est jamais rangé à moitié.
  // Rend true quand le lot est parti.
  async setFiling(entries, folders = {}) {
    const moved = folders.moved || [];
    const merged = folders.merged || [];
    const add = [...new Set(folders.add || [])];
    const drop = [...new Set(folders.drop || [])];
    if (!entries.length && !add.length && !drop.length && !moved.length && !merged.length) return false;
    // La table du rangement et celles des apps se lisent en même temps. Quand la table du rangement vient de naître (la personne a été interrogée entre-temps),
    // ce que les apps ont rendu peut avoir vieilli : leurs tables se relisent.
    const [state, firstTargets] = await Promise.all([folders.quiet === true ? this.#loaded() : this.#ready(FILING), this.#appTargets()]);
    if (!state) return false;
    const targets = state.created ? await this.#appTargets() : firstTargets;
    const actions = this.#actionsOf(state.data, targets, entries, { add, drop, moved, merged, extra: folders.extra || [] });
    if (!actions.length) return false;
    await this.#port.doc.applyUserActions(actions);
    await this.#stamp(state.data);
    return true;
  }

  // Les actions d'un lot de rangement : les lignes des fichiers dans `GFS_Rangement` (ceux des apps qui tiennent leur rangement vont chez elles), les lignes
  // d'état des dossiers, ce que les apps tiennent, puis les actions de plus (`extra`).
  #actionsOf(data, targets, entries, { add, drop, moved, merged, extra }) {
    const identity = this.identity;
    const tableId = this.#table.id;
    const actions = entries.filter(({ app }) => !targets.has(app)).map(({ app, file, pinned, folder }) => {
      const key = { Utilisateur: identity, App: app, Fichier: String(file) };
      const at = findRow(data, key);
      const record = { Favori: pinned === true, Dossier: folder || '' };
      return at >= 0 ? ['UpdateRecord', tableId, data.id[at], record] : ['AddRecord', tableId, null, { ...key, ...record }];
    });
    actions.push(...folderActions(tableId, data, identity, { add, drop, moved, merged }));
    // Chez une app, un dossier déplacé est une ligne d'état retirée puis ajoutée : son numéro ne désigne rien dans les partages.
    const batch = { entries, add: [...add, ...moved.map(([, to]) => to)], drop: [...drop, ...moved.map(([from]) => from), ...merged.map(([from]) => from)] };
    for (const [app, target] of targets) actions.push(...this.#appBatch(app, target, batch, { tableId, data }, identity));
    return [...actions, ...extra];
  }

  // Les actions d'un lot pour une app qui tient son rangement : ses fichiers du lot, les dossiers gardés ou retirés, et ce que `GFS_Rangement` disait d'elle
  // (`carryOver`), que le lot reprend sans le doubler.
  #appBatch(app, target, { entries, add, drop }, gfs, identity) {
    const own = entries.filter(entry => entry.app === app).map(({ file, pinned, folder }) => ({ file, pinned, folder }));
    const carried = carryOver(target.filing, target, gfs, identity);
    const named = new Set(own.map(entry => String(entry.file)));
    const folders = [...new Set([...add, ...carried.folders.filter(path => !drop.includes(path))])];
    return [...appActions(target.filing, target.tableId, target.data, identity, {
      entries: [...own, ...carried.entries.filter(entry => !named.has(entry.file))], add: folders, drop }), ...carried.removed];
  }
}
