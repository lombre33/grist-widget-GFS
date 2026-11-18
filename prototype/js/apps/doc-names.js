// Les noms que le document donne aux tables et aux colonnes d'une app (contrats 2.4, `noms`). Une app qui renomme ses tables et ses colonnes (Publipostage+ :
// de « Publipostage_Modeles » et « Nom » à « Publipostage_Templates » et « Name ») laisse des documents sous l'un ou l'autre jeu de noms, parfois sous les deux
// à la fois (une table renommée, une autre pas encore). Le manifeste garde ses noms d'avant et dit les autres (`noms`) ; GFS lit le document, puis réécrit les
// noms du manifeste (`fichiers[]`) en ceux que le document porte, une fois pour toutes : la lecture de l'explorateur, le rangement, la corbeille, la copie, le
// renommage, le poids et le partage parlent alors tous au document par ses vrais noms, sans rien savoir de ce qui précède.
//
// Trois règles :
//   - le manifeste reste ce que l'app a écrit : la copie réécrite est une autre valeur (`canonique` y garde le nom de table du manifeste), jamais une
//   modification ;
//   - un nom que le document ne porte pas ne change rien : la table ou la colonne garde le nom du manifeste (l'app ne l'a pas encore créée, ou une colonne
//   manque
//   et la lecture la dit comme avant) ;
//   - quand le document porte le nom du manifeste ET un autre, le nom du manifeste gagne et GFS le dit dans la console (un avertissement) : le document d'une
//   app
//   qui renomme ses tables par un renommage de Grist n'en porte jamais deux ; en porter deux est un reste que GFS ne devine pas.
// Rien n'est écrit dans le document : ces noms viennent du manifeste et des tables internes de Grist, jamais d'un texte lu ailleurs.

const lower = name => String(name).toLowerCase();

// Le schéma du document tel que le lisent les noms : Map (nom de table en minuscules -> { id, columns: Map (nom de colonne en minuscules -> identifiant) }).
// `tables` et `columns` sont `_grist_Tables` et `_grist_Tables_column` tels que `fetchTable` les rend.
export function schemaOf(tables, columns) {
  const byRef = new Map();
  const schema = new Map();
  (tables.id || []).forEach((ref, i) => {
    const entry = { id: String(tables.tableId[i]), columns: new Map() };
    byRef.set(ref, entry);
    schema.set(lower(entry.id), entry);
  });
  (columns.id || []).forEach((ref, i) => {
    const entry = byRef.get(columns.parentId[i]);
    const id = String(columns.colId[i]);
    if (entry && id !== 'manualSort' && !id.startsWith('gristHelper_')) entry.columns.set(lower(id), id);
  });
  return schema;
}

// Les deux tables internes de Grist, lues ensemble (petites : jamais le contenu des fichiers) : le schéma du document, ou null quand elles ne se lisent pas.
export async function readSchema(doc) {
  try {
    const [tables, columns] = await Promise.all([doc.fetchTable('_grist_Tables'), doc.fetchTable('_grist_Tables_column')]);
    return schemaOf(tables, columns);
  } catch (error) {
    console.warn('GFS : les noms que le document donne aux tables de l\'app ne se lisent pas, le manifeste reste tel quel', error);
    return null;
  }
}

// Le premier de `candidates` que `has` retient, ou null. Le nom du manifeste est le premier : s'il y en a deux, il gagne (`warn` le dit).
function firstOf(candidates, has, warn, what) {
  const found = candidates.filter(has);
  if (found.length > 1) warn(`GFS : ${what} porte deux noms dans le document (${found.join(', ')}) : GFS lit ${found[0]}`);
  return found.length ? found[0] : null;
}

// Les noms d'une app : { table(nom du manifeste) -> nom que le document porte, column(table du manifeste, colonne du manifeste) -> nom que le document porte }.
function resolver(noms, schema, warn) {
  const entryOf = table => (noms && Object.hasOwn(noms, table) ? noms[table] : {});
  const asked = new Map();
  const table = name => {
    if (asked.has(name)) return asked.get(name);
    const candidates = [name, ...(entryOf(name).aussi || [])];
    const found = firstOf(candidates, each => schema.has(lower(each)), warn, `la table ${name}`);
    const actual = found ? schema.get(lower(found)).id : name;
    asked.set(name, actual);
    return actual;
  };
  const column = (tableName, name) => {
    const here = schema.get(lower(table(tableName)));
    if (!here || name === 'id') return name;
    const candidates = [name, ...((entryOf(tableName).colonnes || {})[name] || [])];
    const found = firstOf(candidates, each => here.columns.has(lower(each)), warn, `la colonne ${name} de ${tableName}`);
    return found ? here.columns.get(lower(found)) : name;
  };
  return { table, column };
}

const mapKeys = (object, change) => (object && typeof object === 'object' ? Object.fromEntries(
  Object.entries(object).map(([key, value]) => [change(key), value])) :
  object);

// Une recette (`suppression`, `copie`) : ses colonnes (`uniques`, `exclusives`) et celles de ses valeurs imposées (`remettre`, `valeurs`).
function adaptRecipe(recipe, own) {
  if (!recipe || typeof recipe !== 'object') return recipe;
  const out = { ...recipe };
  for (const key of ['uniques', 'exclusives']) if (Array.isArray(recipe[key])) out[key] = recipe[key].map(own);
  for (const key of ['remettre', 'valeurs']) if (recipe[key] !== undefined) out[key] = mapKeys(recipe[key], own);
  return out;
}

// Le rangement propre à l'app : sa table et les quatre colonnes que GFS lit et écrit.
function adaptFiling(filing, at) {
  if (!filing || typeof filing !== 'object') return filing;
  const out = { ...filing, table: at.table(filing.table) };
  for (const key of ['utilisateur', 'fichier', 'dossier', 'epingle']) if (typeof filing[key] === 'string') out[key] = at.column(filing.table, filing[key]);
  return out;
}

// Le poids : les colonnes de la pièce jointe du fichier, et les tables liées (leur table, leur colonne, et la colonne du fichier qui porte la même clé).
function adaptWeight(weight, own, at) {
  if (!weight || typeof weight !== 'object') return weight;
  const out = { ...weight };
  if (weight.pieces) out.pieces = { ...weight.pieces, colonne: own(weight.pieces.colonne), taille: own(weight.pieces.taille) };
  if (Array.isArray(weight.liees)) {
    out.liees = weight.liees.map(rule => ({ ...rule, table: at.table(rule.table), colonne: at.column(rule.table, rule.colonne), fichier: own(rule.fichier) }));
  }
  return out;
}

// Les colonnes de la table du fichier que le document nomme autrement que le manifeste : { nom du manifeste: nom du document }.
function renamedColumns(spec, noms, at) {
  const changed = {};
  for (const column of Object.keys((noms && noms[spec.table] && noms[spec.table].colonnes) || {})) {
    const actual = at.column(spec.table, column);
    if (actual !== column) changed[column] = actual;
  }
  return changed;
}

// Une entrée de `fichiers[]` sous les noms du document. `canonique` : le nom de la table dans le manifeste ; `renommees` : celles de ses colonnes que le
// document nomme autrement ({ nom du manifeste: nom du document }). Ce sont les clés que GFS garde pour ce qu'il écrit (la corbeille : une ligne mise de côté
// avant le renommage du document se restaure après).
function adaptSpec(spec, at, noms) {
  const own = name => at.column(spec.table, name);
  const out = { ...spec, table: at.table(spec.table), canonique: spec.table, renommees: renamedColumns(spec, noms, at) };
  if (spec.colonnes) out.colonnes = Object.fromEntries(Object.entries(spec.colonnes).map(([key, name]) => [key, own(name)]));
  if (spec.exclure) out.exclure = mapKeys(spec.exclure, own);
  if (spec.rangement) out.rangement = adaptFiling(spec.rangement, at);
  if (spec.suppression) out.suppression = adaptRecipe(spec.suppression, own);
  if (spec.copie) out.copie = adaptRecipe(spec.copie, own);
  if (spec.poids) out.poids = adaptWeight(spec.poids, own, at);
  return out;
}

// Le manifeste sous les noms que le document porte : le même objet quand il ne dit pas `noms` (ou que le schéma est inconnu), sinon une copie dont les
// `fichiers[]` sont réécrits. `warn(texte)` dit un document qui porte deux noms.
export function adaptManifest(manifest, schema, warn = text => console.warn(text)) {
  if (!manifest || !manifest.noms || !schema || !Array.isArray(manifest.fichiers)) return manifest;
  const at = resolver(manifest.noms, schema, warn);
  return { ...manifest, fichiers: manifest.fichiers.map(spec => adaptSpec(spec, at, manifest.noms)) };
}

// Le nom de table du manifeste d'une entrée de `fichiers[]`, réécrite ou non : ce que GFS garde dans ce qu'il écrit (js/files/gfs-trash.js).
export const canonicalTable = spec => (spec && (spec.canonique || spec.table)) || '';

// Un nom de colonne du document, d'après celui du manifeste (et l'inverse) : les clés d'un instantané de la corbeille sont celles du manifeste, que le document
// les nomme ainsi ou autrement.
export const documentColumn = (spec, name) => (spec && spec.renommees && Object.hasOwn(spec.renommees, name) ? spec.renommees[name] : name);
export const canonicalColumn = (spec, name) => {
  const found = spec && spec.renommees ? Object.entries(spec.renommees).find(([, actual]) => actual === name) : null;
  return found ? found[0] : name;
};

// Cette entrée est-elle la table `name` ? Sous le nom que le document porte ou sous celui du manifeste : un fichier lu avant un renommage reste le sien.
export const isTable = (spec, name) => Boolean(spec) && (spec.table === name || spec.canonique === name);

// Les tables que les `noms` des manifestes regardent (leur nom dans le manifeste et leurs autres noms) : seul leur changement change ce que `adapt` rend.
const watched = items => new Set((items || []).flatMap(item => Object.entries((item && item.manifest && item.manifest.noms) || {})
  .flatMap(([table, entry]) => [table, ...((entry && entry.aussi) || [])])).map(lower));

// Les noms des apps pour le document ouvert : le schéma lu (`refresh`), et les manifestes qu'il réécrit (`adapt`, `adaptItem`), gardés tant que ce que le
// schéma dit des tables de `noms` ne change pas. Sans `noms` dans aucun manifeste, `refresh` ne lit rien.
export class DocNames {
  #doc;
  #schema = null;
  #version = 0;
  #seen = '';
  #manifests = new WeakMap();
  #items = new WeakMap();
  #warned = new Set();

  constructor({ doc }) { this.#doc = doc; }

  // Lit le schéma du document quand une des `items` ({ manifest }) dit `noms`. Rend true quand ce que les manifestes réécrits disent a changé.
  async refresh(items) {
    const tables = watched(items);
    if (!tables.size) return false;
    this.#schema = await readSchema(this.#doc);
    const now = this.#schema ? [...this.#schema].filter(([name]) => tables.has(name)).map(([, entry]) => `${entry.id}:${[...entry.columns.values()].join(',')}`)
      .sort().join(';') : '';
    if (now === this.#seen) return false;
    this.#seen = now;
    this.#version += 1;
    this.#warned = new Set();
    return true;
  }

  adapt(manifest) {
    if (!manifest || !manifest.noms || !this.#schema) return manifest;
    const memo = this.#manifests.get(manifest);
    if (memo && memo.version === this.#version) return memo.value;
    const value = adaptManifest(manifest, this.#schema, text => { if (!this.#warned.has(text)) { this.#warned.add(text); console.warn(text); } });
    this.#manifests.set(manifest, { version: this.#version, value });
    return value;
  }

  // Une app installée ({ app, manifest, ok, … }) sous les noms du document : le même objet quand rien ne change.
  adaptItem(item) {
    if (!item) return item;
    const manifest = this.adapt(item.manifest);
    if (manifest === item.manifest) return item;
    const memo = this.#items.get(item);
    if (memo && memo.manifest === manifest) return memo.value;
    const value = { ...item, manifest };
    this.#items.set(item, { manifest, value });
    return value;
  }
}
