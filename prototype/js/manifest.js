// Le manifeste `gfs.json` d'une app : validation (contrats 2.8) et chargement. Un manifeste invalide ne fait pas échouer GFS : l'app est
// listée grisée, avec le motif (2.1, point 3).

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
  }
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

function checkCapabilities(perm, errors) {
  for (const key of ['jeton', 'formules', 'structure']) {
    if (perm[key] !== undefined && (!isObject(perm[key]) || !isBilingual(perm[key].pourquoi))) errors.push(`permissions.${key} : pourquoi doit porter fr et en`);
  }
}

function checkPermissions(m, errors) {
  const perm = m.permissions;
  if (!isObject(perm) || !ACCESS.includes(perm.acces)) { errors.push('permissions.acces : none, read table ou full'); return; }
  const declares = ['lit', 'ecrit', 'gristInterne', 'jeton', 'formules', 'structure'].some(key => perm[key] !== undefined);
  if (perm.acces !== 'full' && declares) errors.push('lit, ecrit, gristInterne et capacités demandent l\'accès full');
  checkPatterns(perm, errors);
  if (perm.gristInterne !== undefined && !Array.isArray(perm.gristInterne)) errors.push('permissions.gristInterne : liste attendue');
  for (const entry of Array.isArray(perm.gristInterne) ? perm.gristInterne : []) checkInternalEntry(entry, errors);
  checkCapabilities(perm, errors);
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
