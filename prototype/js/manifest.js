// Le manifeste `gfs.json` d'une app : validation (contrats 2.8) et chargement. Un manifeste invalide ne fait pas échouer GFS : l'app est
// listée grisée, avec le motif (2.1, point 3).

import { covers } from './filter.js';

export const CONTRACT = 0;

export const ID_RE = /^[a-z][a-z0-9-]{1,23}$/;
const PREFIX_RE = /^[A-Z][A-Za-z0-9]*_$/;
const ACCESS = ['none', 'read table', 'full'];
const NEVER_READ = ['_grist_shares', '_grist_triggers'];
const NEVER_WRITE = ['_grist_aclrules', '_grist_aclresources', '_grist_aclprincipals', '_grist_aclmemberships', '_grist_shares',
  '_grist_triggers', '_grist_docinfo'];
const isText = value => typeof value === 'string' && value !== '';
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isBilingual = value => isObject(value) && isText(value.fr) && isText(value.en);

// Un chemin relatif sûr : sans « .. », sans segment qui commence par « _ » ou « . » (GitHub Pages ne les sert pas), sans adresse absolue.
export function isSafePath(path) {
  if (!isText(path) || /^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('/') || path.includes('\\')) return false;
  return path.split('/').every(segment => segment !== '' && segment !== '..' && !/^[_.]/.test(segment));
}

function checkIdentity(m, errors) {
  if (m.contrat !== CONTRACT) errors.push(`contrat ${m.contrat} inconnu de cette version de GFS`);
  if (!ID_RE.test(m.id || '')) errors.push('id hors format');
  if (!isBilingual(m.nom)) errors.push('nom doit porter fr et en');
  if (!isText(m.version)) errors.push('version absente');
  if (!isSafePath(m.entree)) errors.push('entree : chemin relatif sûr attendu');
  const prefix = m.tables && m.tables.prefixe;
  if (!PREFIX_RE.test(prefix || '')) errors.push('tables.prefixe hors format');
  else if (prefix.toUpperCase() === 'GFS_') errors.push('le préfixe GFS_ est réservé');
}

function checkCatalogue(m, others, errors) {
  const prefix = m.tables && m.tables.prefixe;
  for (const other of others) {
    if (other.id === m.id) errors.push(`id déjà pris : ${m.id}`);
    const p = other.tables && other.tables.prefixe;
    if (isText(prefix) && isText(p) && (prefix.toLowerCase().startsWith(p.toLowerCase()) || p.toLowerCase().startsWith(prefix.toLowerCase()))) {
      errors.push(`le préfixe ${prefix} chevauche celui de ${other.id}`);
    }
    for (const key of m.reglages || []) {
      if ((other.reglages || []).includes(key)) errors.push(`la clé de réglage ${key} est déjà déclarée par ${other.id}`);
    }
  }
}

function checkFiles(m, errors) {
  for (const file of m.fichiers || []) {
    const prefix = (m.tables && m.tables.prefixe) || '';
    if (!isText(file.table) || !file.table.toLowerCase().startsWith(prefix.toLowerCase())) errors.push('fichiers[].table hors du préfixe');
    const cols = file.colonnes || {};
    if (!isText(cols.id) || !isText(cols.nom)) errors.push('fichiers[].colonnes.id et nom obligatoires');
    for (const [key, value] of Object.entries(cols)) if (!isText(value)) errors.push(`fichiers[].colonnes.${key} : chaîne attendue`);
    if (!Array.isArray(file.types) || file.types.some(t => !isText(t.valeur) || !isBilingual(t.nom))) errors.push('fichiers[].types mal formé');
    checkFiling(file.rangement, prefix, errors);
    checkRecipe(file.suppression, 'suppression', 'remettre', errors);
    checkRecipe(file.copie, 'copie', 'valeurs', errors);
  }
}

// Une recette (2.4 ; contrats 6.7) : comment GFS retire et remet un fichier de cette table (`suppression`), ou le copie (`copie`). `ligne: true` est le seul mode (un fichier est une ligne) ; `uniques` et
// `exclusives` : des noms de colonnes ; `values` (`remettre` pour la suppression, `valeurs` pour la copie) : { colonne: valeur }.
function checkRecipe(recipe, name, values, errors) {
  if (recipe === undefined) return;
  if (!isObject(recipe) || recipe.ligne !== true) { errors.push(`fichiers[].${name}.ligne : true attendu`); return; }
  for (const key of ['uniques', 'exclusives']) {
    if (recipe[key] !== undefined && !(Array.isArray(recipe[key]) && recipe[key].every(isText))) errors.push(`fichiers[].${name}.${key} : liste de noms de colonnes attendue`);
  }
  if (recipe[values] !== undefined && !isObject(recipe[values])) errors.push(`fichiers[].${name}.${values} : objet attendu`);
}

// Le rangement propre à une app (2.4, `rangement`) : proposé par le prototype, à fixer à l'étape 6. Une table du préfixe et des noms de colonnes.
function checkFiling(filing, prefix, errors) {
  if (filing === undefined) return;
  if (!isObject(filing) || !isText(filing.table) || !filing.table.toLowerCase().startsWith(prefix.toLowerCase())) {
    errors.push('fichiers[].rangement.table hors du préfixe');
    return;
  }
  for (const [key, value] of Object.entries(filing)) if (!isText(value)) errors.push(`fichiers[].rangement.${key} : chaîne attendue`);
}

function checkSettings(m, errors) {
  for (const key of m.reglages || []) {
    if (!isText(key)) errors.push('reglages : chaînes attendues');
    else if (key.startsWith('gfs.')) errors.push(`la clé ${key} commence par gfs.`);
  }
}

const covered = (lit, pattern) => lit.includes('*') || lit.includes(pattern) || lit.some(p => p.endsWith('*') && pattern.startsWith(p.slice(0, -1)));

function checkPatterns(perm, errors) {
  for (const key of ['lit', 'ecrit']) {
    if (perm[key] !== undefined && (!Array.isArray(perm[key]) || !perm[key].every(isText))) errors.push(`permissions.${key} : liste de motifs attendue`);
  }
  const lit = Array.isArray(perm.lit) ? perm.lit : [];
  for (const pattern of Array.isArray(perm.ecrit) ? perm.ecrit : []) {
    if (!covered(lit, pattern)) errors.push(`le motif ecrit ${pattern} n'est pas couvert par lit`);
  }
}

// Une table nommée par une entrée de `gristInterne` : interne, jamais lue ou jamais écrite selon les listes de refus (contrats 3.3).
function checkInternalTable(entry, table, writes, errors) {
  const key = String(table).toLowerCase();
  if (!key.startsWith('_grist_')) errors.push(`gristInterne : ${table} n'est pas une table interne`);
  if (entry.lit && NEVER_READ.includes(key)) errors.push(`gristInterne : ${table} ne se lit jamais`);
  if (writes && NEVER_WRITE.includes(key)) errors.push(`gristInterne : ${table} n'est jamais écrite`);
  if (writes && key === '_grist_views_section' && (entry.ecrit || []).includes('options')) errors.push('gristInterne : la colonne options de _grist_Views_section n\'est jamais écrite');
  if (writes && key === '_grist_pages' && (entry.ecrit || []).includes('shareRef')) errors.push('gristInterne : la colonne shareRef de _grist_Pages n\'est jamais écrite');
}

function checkInternalEntry(entry, errors) {
  if (!isObject(entry) || !Array.isArray(entry.tables) || !entry.tables.length) { errors.push('gristInterne : tables obligatoires'); return; }
  if (!isBilingual(entry.pourquoi)) errors.push('gristInterne : pourquoi doit porter fr et en');
  const writes = Array.isArray(entry.ecrit) || entry.retire === true;
  if (!entry.lit && !writes) errors.push('gristInterne : lit, ecrit ou retire attendu');
  for (const table of entry.tables) checkInternalTable(entry, table, writes, errors);
  if (writes && !entry.lit) errors.push('gristInterne : une entrée qui écrit porte aussi lit: true');
  if (writes && entry.tables.length !== 1) errors.push('gristInterne : une entrée qui écrit nomme une seule table');
}

// `identite` (3.4, point 6) donne à l'app l'adresse e-mail de la personne : elle ne contourne aucun filtre de tables, donc elle ne demande pas l'accès `full` (voir checkPermissions).
function checkCapabilities(perm, errors) {
  for (const key of ['jeton', 'formules', 'structure', 'identite']) {
    if (perm[key] !== undefined && (!isObject(perm[key]) || !isBilingual(perm[key].pourquoi))) errors.push(`permissions.${key} : pourquoi doit porter fr et en`);
  }
}

// Les capacités et les raisons que les apps déclarent (3.4), pour qui doit les relire (un client, son responsable de la sécurité) : une ligne par capacité déclarée,
// { app, nom, capacite, detail, pourquoi }. `detail` dit sur quoi elle porte quand c'est utile (les tables d'une entrée de `gristInterne`, les motifs de `lienPublic`).
const CAPABILITIES = ['jeton', 'formules', 'structure', 'identite', 'lienPublic'];
const reasonOf = entry => (isObject(entry) && isBilingual(entry.pourquoi) ? entry.pourquoi : null);
const namesOf = list => (Array.isArray(list) ? list.join(', ') : '');
export function listCapabilities(manifests) {
  const rows = [];
  for (const m of manifests) {
    const perm = isObject(m && m.permissions) ? m.permissions : {};
    const add = (capacite, entry, names) => rows.push({ app: m.id, nom: m.nom, capacite, detail: namesOf(names), pourquoi: reasonOf(entry) });
    for (const key of CAPABILITIES) if (perm[key] !== undefined) add(key, perm[key], key === 'lienPublic' && isObject(perm[key]) ? perm[key].lit : null);
    for (const entry of Array.isArray(perm.gristInterne) ? perm.gristInterne : []) add('gristInterne', entry, isObject(entry) ? entry.tables : null);
  }
  return rows;
}

// Les tables qui gardent la liste des fichiers de l'app (2.4) : `fichiers[].table` et `fichiers[].rangement.table`.
const filesTables = m => (Array.isArray(m.fichiers) ? m.fichiers : [])
  .flatMap(file => [file && file.table, file && isObject(file.rangement) ? file.rangement.table : null]).filter(isText);

// Un nom de table, ou un préfixe suivi de « * » : jamais « * » seul, qui ne désigne que les tables de la personne (3.2, point 2).
const PUBLIC_PATTERN_RE = /^[A-Za-z0-9_]+\*?$/;

function checkPublicPattern(pattern, m, errors) {
  const where = `permissions.lienPublic.lit : le motif ${pattern}`;
  const prefix = String((m.tables && m.tables.prefixe) || '').toLowerCase();
  const stem = pattern.replace(/\*$/, '').toLowerCase();
  if (!PUBLIC_PATTERN_RE.test(pattern)) errors.push(`${where} doit être un nom de table, ou un préfixe suivi de « * », sans accent`);
  else if (!stem.startsWith(prefix)) errors.push(`${where} est hors du préfixe de l'app`);
  else if (stem === prefix) errors.push(`${where} couvre toutes les tables de l'app : il faut nommer les petites tables`);
  else for (const table of filesTables(m)) if (covers([pattern], table, 'propre')) errors.push(`${where} couvre ${table}, la table des fichiers de l'app : un lien public ne la lit jamais`);
}

// Les tables de l'app qu'un lien public peut lire, si la personne y consent à la publication (contrats 3.3, point 9 ; 11.9, point 4c) : des petites tables nommées une à une
// ou par un préfixe plus précis que celui de l'app, jamais celle des fichiers (Form+ : `FormPlus_Formulaires` garde la définition et la clé de partage de tous ses formulaires).
function checkPublicLink(m, errors) {
  const link = m.permissions.lienPublic;
  if (link === undefined) return;
  if (!isObject(link) || !isBilingual(link.pourquoi)) errors.push('permissions.lienPublic : pourquoi doit porter fr et en');
  const patterns = isObject(link) ? link.lit : null;
  if (!Array.isArray(patterns) || !patterns.length || !patterns.every(isText)) { errors.push('permissions.lienPublic.lit : liste de motifs attendue'); return; }
  for (const pattern of patterns) checkPublicPattern(pattern, m, errors);
}

function checkPermissions(m, errors) {
  const perm = m.permissions;
  if (!isObject(perm) || !ACCESS.includes(perm.acces)) { errors.push('permissions.acces : none, read table ou full'); return; }
  const declares = ['lit', 'ecrit', 'gristInterne', 'jeton', 'formules', 'structure', 'lienPublic'].some(key => perm[key] !== undefined);
  if (perm.acces !== 'full' && declares) errors.push('lit, ecrit, gristInterne et capacités demandent l\'accès full');
  checkPatterns(perm, errors);
  if (perm.gristInterne !== undefined && !Array.isArray(perm.gristInterne)) errors.push('permissions.gristInterne : liste attendue');
  for (const entry of Array.isArray(perm.gristInterne) ? perm.gristInterne : []) checkInternalEntry(entry, errors);
  checkCapabilities(perm, errors);
  checkPublicLink(m, errors);
}

export const LIBRARY_ID_RE = /^[a-z][a-z0-9-]*$/;
export const EXACT_VERSION_RE = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

// Ce que le code d'une extension exige d'une bibliothèque (2.6, points 5 et 8) : un identifiant et une version EXACTE, jamais un intervalle,
// jamais `latest`. L'adresse, l'empreinte et le mode sont à GFS.
function checkLibraries(ext, errors) {
  if (ext.bibliotheques === undefined) return;
  if (!Array.isArray(ext.bibliotheques)) { errors.push(`extension ${ext.id} : bibliotheques : liste attendue`); return; }
  for (const lib of ext.bibliotheques) {
    if (!isObject(lib) || !LIBRARY_ID_RE.test(lib.id || '')) errors.push(`extension ${ext.id} : une bibliothèque sans id valable`);
    else if (!EXACT_VERSION_RE.test(lib.version || '')) errors.push(`extension ${ext.id} : la version de ${lib.id} doit être exacte (ni intervalle ni latest)`);
  }
}

// Ce que la fenêtre des apps et extensions affiche : un texte (fr, en), une icône du jeu de GFS, un poids en Ko. Facultatifs (proposés par le prototype).
function checkDisplay(item, where, errors) {
  if (item.texte !== undefined && !isBilingual(item.texte)) errors.push(`${where} : texte doit porter fr et en`);
  if (item.icone !== undefined && !isText(item.icone)) errors.push(`${where} : icone : chaîne attendue`);
  if (item.poids !== undefined && !(Number.isFinite(item.poids) && item.poids >= 0)) errors.push(`${where} : poids : nombre de Ko attendu`);
}

const EXTENSION_RE = /^\.[a-z0-9]{1,8}$/i;

// Un format que l'app reçoit de GFS (`actions.importer`, 2.7 point 4) : une valeur à elle, un nom (fr, en), le type de fichier qu'il crée (un type que l'app ouvre) et les extensions du sélecteur.
function checkImport(item, opens, seen, errors) {
  if (!isObject(item) || !isText(item.valeur) || !isBilingual(item.nom)) { errors.push('actions.importer[] : valeur et nom (fr, en) attendus'); return; }
  const where = `actions.importer ${item.valeur}`;
  if (seen.has(item.valeur)) errors.push(`${where} : valeur déjà prise`);
  seen.add(item.valeur);
  if (!opens.has(item.type)) errors.push(`${where} : le type ${item.type} n'est pas dans actions.ouvrir`);
  if (!Array.isArray(item.extensions) || !item.extensions.length || !item.extensions.every(extension => EXTENSION_RE.test(extension))) errors.push(`${where} : extensions : une liste de « .ext » attendue`);
}

function checkImports(m, errors) {
  const actions = isObject(m.actions) ? m.actions : {};
  if (actions.importer === undefined) return;
  if (!Array.isArray(actions.importer)) { errors.push('actions.importer : liste attendue'); return; }
  const opens = new Set(Array.isArray(actions.ouvrir) ? actions.ouvrir : []);
  const seen = new Set();
  for (const item of actions.importer) checkImport(item, opens, seen, errors);
}

const FILE_TYPE_RE = /^[a-z][a-z0-9-]{0,23}$/;

// Ce que l'app lit de ce que GFS garde (`actions.lire`, 2.7 point 5) : le type du fichier (un mot, comme `pdf`) et, quand c'est une extension de l'app qui le lit, son identifiant, déclaré dans `extensions`.
function checkRead(item, extensions, seen, errors) {
  if (!isObject(item) || !FILE_TYPE_RE.test(item.type || '')) { errors.push('actions.lire[] : un type de fichier attendu (un mot, comme pdf)'); return; }
  const where = `actions.lire ${item.type}`;
  if (seen.has(item.type)) errors.push(`${where} : type déjà déclaré`);
  seen.add(item.type);
  if (item.extension !== undefined && !extensions.has(item.extension)) errors.push(`${where} : l'extension ${item.extension} n'est pas déclarée dans extensions`);
}

function checkReads(m, errors) {
  const actions = isObject(m.actions) ? m.actions : {};
  if (actions.lire === undefined) return;
  if (!Array.isArray(actions.lire)) { errors.push('actions.lire : liste attendue'); return; }
  const extensions = new Set((Array.isArray(m.extensions) ? m.extensions : []).map(ext => ext && ext.id));
  const seen = new Set();
  for (const item of actions.lire) checkRead(item, extensions, seen, errors);
}

// Ce que l'app range chez GFS (`actions.ranger`, 2.7 point 6) : les types de fichiers que GFS garde (aujourd'hui `pdf`) qu'elle lui demande de ranger. L'appel `ranger` d'un type qui n'y est pas est refusé (5.4, point 9).
function checkFiled(m, errors) {
  const actions = isObject(m.actions) ? m.actions : {};
  if (actions.ranger === undefined) return;
  if (!Array.isArray(actions.ranger)) { errors.push('actions.ranger : liste attendue'); return; }
  const seen = new Set();
  for (const type of actions.ranger) {
    if (typeof type !== 'string' || !FILE_TYPE_RE.test(type)) errors.push('actions.ranger[] : un type de fichier attendu (un mot, comme pdf)');
    else if (seen.has(type)) errors.push(`actions.ranger ${type} : type déjà déclaré`);
    seen.add(type);
  }
}

function checkExtensions(m, errors) {
  for (const ext of m.extensions || []) {
    if (!isText(ext.id) || !isBilingual(ext.nom)) errors.push('extensions[] : id et nom (fr, en) attendus');
    checkDisplay(ext, `extension ${ext.id}`, errors);
    if (!isSafePath(String(ext.dossier || '').replace(/\/$/, ''))) errors.push(`extension ${ext.id} : dossier hors de l'app`);
    checkLibraries(ext, errors);
  }
}

// Rend { ok, errors }. `others` : les manifestes déjà acceptés du catalogue (unicité des id, des préfixes et des clés de réglages).
export function validateManifest(m, others = []) {
  const errors = [];
  if (!isObject(m)) return { ok: false, errors: ['le manifeste n\'est pas un objet'] };
  checkIdentity(m, errors);
  checkDisplay(m, 'app', errors);
  checkCatalogue(m, others, errors);
  checkFiles(m, errors);
  checkSettings(m, errors);
  checkPermissions(m, errors);
  checkImports(m, errors);
  checkReads(m, errors);
  checkFiled(m, errors);
  checkExtensions(m, errors);
  return { ok: errors.length === 0, errors };
}

// Charge les manifestes du catalogue : { app, manifest, ok, errors }. Un manifeste illisible ou invalide reste dans la liste, grisé.
export async function loadAll(catalogue, fetchJson) {
  const loaded = [];
  for (const entry of catalogue) {
    let manifest = null;
    let errors;
    try {
      manifest = await fetchJson(entry.manifeste);
      errors = validateManifest(manifest, loaded.filter(item => item.ok).map(item => item.manifest)).errors;
      if (manifest && manifest.id !== entry.id) errors.push(`l'id ${manifest.id} ne correspond pas au catalogue (${entry.id})`);
    } catch (e) {
      errors = [`manifeste illisible : ${e && e.message}`];
    }
    loaded.push({ app: entry, manifest, ok: errors.length === 0, errors });
  }
  return loaded;
}

// Le nom d'un champ bilingue dans la langue de la personne, repli sur l'autre.
export const label = (field, lang) => (field && (field[lang] || field.fr || field.en)) || '';
