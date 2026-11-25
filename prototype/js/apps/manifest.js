// Le manifeste `gfs.json` d'une app : validation (contrats 2.8) et chargement. Un manifeste invalide ne fait pas échouer GFS : l'app est
// listée grisée, avec le motif (2.1, point 3).

import { covers } from '../broker/filter.js';
import { PROVIDERS } from '../broker/player-sites.js';
import { checkNames } from './manifest-names.js';
import { checkCarried } from './manifest-carried.js';

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

// Un seul rangement écrit par app : un identifiant de fichier n'a de sens que dans la table qui le porte (js/files/app-filing.js).
function checkOneFilingWrite(m, errors) {
  const writing = (m.fichiers || []).filter(file => file && file.rangement && file.rangement.ecriture !== undefined);
  if (writing.length > 1) errors.push('fichiers[].rangement.ecriture : une seule table de fichiers par app');
}

function checkFiles(m, errors) {
  checkOneFilingWrite(m, errors);
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
    checkWeight(file.poids, prefix, errors);
  }
}

// Le poids d'un fichier (2.4, point 5) : `pieces` { colonne, taille } (le fichier EST une pièce jointe), `liees` [{ table, colonne, fichier }] (les lignes
// d'une table de l'app, du préfixe, qui suivent le fichier : `colonne` de cette table porte la clé que `fichier`, une colonne de la table du fichier, porte
// aussi). Facultatif.
function checkWeight(weight, prefix, errors) {
  if (weight === undefined) return;
  if (!isObject(weight)) { errors.push('fichiers[].poids : objet attendu'); return; }
  const pieces = weight.pieces;
  if (pieces !== undefined && !(isObject(pieces) && isText(pieces.colonne) && isText(pieces.taille))) errors.push(
    'fichiers[].poids.pieces : { colonne, taille } attendu');
  if (weight.liees === undefined) return;
  if (!Array.isArray(weight.liees)) { errors.push('fichiers[].poids.liees : liste attendue'); return; }
  for (const link of weight.liees) checkLink(link, prefix, errors);
}

// Une table liée au poids d'un fichier (`poids.liees[]`) : { table, colonne, fichier } en texte, la table du préfixe de l'app.
function checkLink(link, prefix, errors) {
  if (!isObject(link) || !isText(link.table) || !isText(link.colonne) || !isText(link.fichier)) errors.push(
    'fichiers[].poids.liees : { table, colonne, fichier } attendu');
  else if (!link.table.toLowerCase().startsWith(prefix.toLowerCase())) errors.push('fichiers[].poids.liees[].table hors du préfixe');
}

// Une recette (2.4 ; contrats 6.7) : comment GFS retire et remet un fichier de cette table (`suppression`), ou le copie (`copie`). `ligne: true` (un fichier
// est une ligne) est le mode de base ; `appel: true` dit que l'app ouverte a aussi son mot (un fichier qui tient à plus qu'une ligne : `supprimer` avant de
// retirer la ligne, `dupliquer` à la place de la copie de la ligne, qui n'a alors pas besoin de `ligne`) ; `uniques` et `exclusives` : des noms de colonnes ;
// `values` (`remettre` pour la suppression, `valeurs` pour la copie) : { colonne: valeur }.
function checkRecipe(recipe, name, values, errors) {
  if (recipe === undefined) return;
  const alone = name === 'copie' && isObject(recipe) && recipe.appel === true; // la copie par l'app n'a pas besoin de la ligne
  if (!isObject(recipe) || (recipe.ligne !== true && !alone)) { errors.push(`fichiers[].${name}.ligne : true attendu`); return; }
  if (recipe.appel !== undefined && typeof recipe.appel !== 'boolean') errors.push(`fichiers[].${name}.appel : true ou false attendu`);
  checkRecipeLists(recipe, name, values, errors);
}

// Ce que la recette dit de colonnes : `uniques` et `exclusives` (listes de noms) et `values` (un objet { colonne: valeur }).
function checkRecipeLists(recipe, name, values, errors) {
  for (const key of ['uniques', 'exclusives']) {
    if (recipe[key] !== undefined && !(Array.isArray(recipe[key]) && recipe[key].every(isText))) errors.push(
      `fichiers[].${name}.${key} : liste de noms de colonnes attendue`);
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
  for (const [key, value] of Object.entries(filing)) if (key !== 'ecriture' && !isText(value)) errors.push(`fichiers[].rangement.${key} : chaîne attendue`);
  checkFilingWrite(filing, errors);
}

// `ecriture` (facultatif, 2.4 et 6.4 point 8) : l'app laisse GFS écrire son rangement, qui fait alors foi pour ses fichiers. GFS lit et écrit les quatre
// colonnes (personne, fichier, dossier, épingle) : toutes doivent être nommées. `dossiers` (facultatif) : la valeur de la colonne du fichier qui marque une
// ligne d'état de dossier (un dossier gardé sans fichier), un entier ou un texte.
function checkFilingWrite(filing, errors) {
  if (filing.ecriture === undefined) return;
  const write = filing.ecriture;
  if (!isObject(write)) { errors.push('fichiers[].rangement.ecriture : objet attendu'); return; }
  const mark = write.dossiers;
  if (mark !== undefined && !(Number.isInteger(mark) || isText(mark))) errors.push('fichiers[].rangement.ecriture.dossiers : entier ou chaîne attendu');
  for (const key of Object.keys(write)) if (key !== 'dossiers') errors.push(`fichiers[].rangement.ecriture.${key} : inconnu`);
  for (const key of ['utilisateur', 'fichier', 'dossier', 'epingle']) {
    if (!isText(filing[key])) errors.push(`fichiers[].rangement.ecriture demande la colonne ${key}`);
  }
}

function checkSettings(m, errors) {
  for (const key of m.reglages || []) {
    if (!isText(key)) errors.push('reglages : chaînes attendues');
    else if (key.startsWith('gfs.')) errors.push(`la clé ${key} commence par gfs.`);
  }
  // `reglagesArrivee` (facultatif, contrats 2.5, point 5) : celles des clés de `reglages` dont une valeur fait s'ouvrir l'app à l'arrivée
  // (js/broker/arrival.js).
  if (m.reglagesArrivee === undefined) return;
  if (!Array.isArray(m.reglagesArrivee) || !m.reglagesArrivee.every(isText)) { errors.push('reglagesArrivee : liste de chaînes attendue'); return; }
  for (const key of m.reglagesArrivee) {
    if (!(m.reglages || []).includes(key)) errors.push(`reglagesArrivee : ${key} n'est pas une clé de reglages`);
  }
}

const covered = (lit, pattern) => lit.includes('*') || lit.includes(pattern) || lit.some(p => p.endsWith('*') && pattern.startsWith(p.slice(0, -1)));

// `arrivee.aussi` : les autres noms de la table de l'app (celui d'avant son passage à l'anglais), que GFS lit comme `table`.
function checkArrivalNames(arrival, m, errors) {
  const others = arrival.aussi;
  if (!Array.isArray(others) || !others.length || !others.every(isText)) { errors.push('arrivee.aussi : liste de noms de tables attendue'); return; }
  const lit = isObject(m.permissions) && Array.isArray(m.permissions.lit) ? m.permissions.lit : null;
  for (const other of others) {
    if (isText(arrival.table) && other.toLowerCase() === arrival.table.toLowerCase()) errors.push(`arrivee.aussi : ${other} est déjà la table de l'arrivée`);
    else if (lit && !covered(lit, other)) errors.push(`arrivee.aussi ${other} : une table que l'app ne lit pas`);
  }
}

// `arrivee` (facultatif, contrats 2.5, point 4) : où GFS lit, sans réglage de la vue, que la section est celle de l'app. { table, colonne, lignes } : la table
// de l'app, la colonne qui dit la table de la vue, et les valeurs que doit porter la ligne (des textes, comparés tels quels). La table doit être de celles que
// l'app lit.
function checkArrival(m, errors) {
  if (m.arrivee === undefined) return;
  const arrival = m.arrivee;
  if (!isObject(arrival)) { errors.push('arrivee : objet attendu'); return; }
  if (!isText(arrival.table)) errors.push('arrivee.table : chaîne attendue');
  else if (isObject(m.permissions) && Array.isArray(m.permissions.lit) && !covered(m.permissions.lit, arrival.table)) errors.push(
    `arrivee.table ${arrival.table} : une table que l'app ne lit pas`);
  if (arrival.aussi !== undefined) checkArrivalNames(arrival, m, errors);
  if (!isText(arrival.colonne)) errors.push('arrivee.colonne : chaîne attendue');
  if (arrival.lignes !== undefined && (!isObject(arrival.lignes) || !Object.values(arrival.lignes).every(isText))) errors.push(
    'arrivee.lignes : un objet de chaînes attendu');
}

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
  if (writes && key === '_grist_views_section' && (entry.ecrit || []).includes('options')) errors.push(
    'gristInterne : la colonne options de _grist_Views_section n\'est jamais écrite');
  if (writes && key === '_grist_pages' && (entry.ecrit || []).includes('shareRef')) errors.push(
    'gristInterne : la colonne shareRef de _grist_Pages n\'est jamais écrite');
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

// `identite` (3.4, point 6) donne à l'app l'adresse e-mail de la personne : elle ne contourne aucun filtre de tables, donc elle ne demande pas l'accès `full`
// (voir checkPermissions).
function checkCapabilities(perm, errors) {
  for (const key of ['jeton', 'formules', 'structure', 'renommage', 'identite', 'lecteurs', 'partage']) {
    if (perm[key] !== undefined && (!isObject(perm[key]) || !isBilingual(perm[key].pourquoi))) errors.push(
      `permissions.${key} : pourquoi doit porter fr et en`);
  }
  checkPlayers(perm.lecteurs, errors);
}

// `lecteurs` (3.4, point 7) : les sites de vidéos dont l'app demande à GFS de poser le lecteur, `{ fournisseurs: ["youtube", "vimeo"], pourquoi }`. Comme
// `identite`, elle ne contourne aucun filtre de tables : pas d'accès `full`.
function checkPlayers(players, errors) {
  if (players === undefined || !isObject(players)) return;
  const list = players.fournisseurs;
  if (!Array.isArray(list) || !list.length) { errors.push('permissions.lecteurs.fournisseurs : liste de sites attendue'); return; }
  const seen = new Set();
  for (const name of list) {
    if (!PROVIDERS.includes(name)) errors.push(
      `permissions.lecteurs.fournisseurs : ${JSON.stringify(name)} n'est pas un site que GFS sait jouer (${PROVIDERS.join(', ')})`);
    else if (seen.has(name)) errors.push(`permissions.lecteurs.fournisseurs ${name} : site déjà déclaré`);
    seen.add(name);
  }
}

// Les capacités et les raisons que les apps déclarent (3.4), pour qui doit les relire (un client, son responsable de la sécurité) : une ligne par capacité
// déclarée, { app, nom, capacite, detail, pourquoi }. `detail` dit sur quoi elle porte quand c'est utile (les tables d'une entrée de `gristInterne`, les motifs
// de `lienPublic`).
const CAPABILITIES = ['jeton', 'formules', 'structure', 'renommage', 'identite', 'lecteurs', 'lienPublic', 'partage'];
const reasonOf = entry => (isObject(entry) && isBilingual(entry.pourquoi) ? entry.pourquoi : null);
const namesOf = list => (Array.isArray(list) ? list.join(', ') : '');
export function listCapabilities(manifests) {
  const rows = [];
  for (const m of manifests) {
    const perm = isObject(m && m.permissions) ? m.permissions : {};
    const add = (capacite, entry, names) => rows.push({ app: m.id, nom: m.nom, capacite, detail: namesOf(names), pourquoi: reasonOf(entry) });
    for (const key of CAPABILITIES) {
      if (perm[key] === undefined) continue;
      const entry = isObject(perm[key]) ? perm[key] : {};
      add(key, perm[key], key === 'lienPublic' ? entry.lit : key === 'lecteurs' ? entry.fournisseurs : null);
    }
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
  else for (const table of filesTables(m)) if (covers([pattern], table, 'propre')) errors.push(
    `${where} couvre ${table}, la table des fichiers de l'app : un lien public ne la lit jamais`);
}

// Les tables de l'app qu'un lien public peut lire, si la personne y consent à la publication (contrats 3.3, point 9 ; 11.9, point 4c) : des petites tables
// nommées une à une ou par un préfixe plus précis que celui de l'app, jamais celle des fichiers (Form+ : `FormPlus_Formulaires` garde la définition et la clé
// de partage de tous ses formulaires).
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
  const declares = ['lit', 'ecrit', 'gristInterne', 'jeton', 'formules', 'structure', 'renommage', 'lienPublic',
    'partage'].some(key => perm[key] !== undefined);
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

// Un format que l'app reçoit de GFS (`actions.importer`, 2.7 point 4) : une valeur à elle, un nom (fr, en), le type de fichier qu'il crée (un type que l'app
// ouvre) et les extensions du sélecteur.
function checkImport(item, opens, seen, errors) {
  if (!isObject(item) || !isText(item.valeur) || !isBilingual(item.nom)) { errors.push('actions.importer[] : valeur et nom (fr, en) attendus'); return; }
  const where = `actions.importer ${item.valeur}`;
  if (seen.has(item.valeur)) errors.push(`${where} : valeur déjà prise`);
  seen.add(item.valeur);
  if (!opens.has(item.type)) errors.push(`${where} : le type ${item.type} n'est pas dans actions.ouvrir`);
  if (!Array.isArray(item.extensions) || !item.extensions.length || !item.extensions.every(extension => EXTENSION_RE.test(extension))) errors.push(
    `${where} : extensions : une liste de « .ext » attendue`);
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

// Ce que l'app lit de ce que GFS garde (`actions.lire`, 2.7 point 5) : le type du fichier (un mot, comme `pdf`) et, quand c'est une extension de l'app qui le
// lit, son identifiant, déclaré dans `extensions`.
function checkRead(item, extensions, seen, errors) {
  if (!isObject(item) || !FILE_TYPE_RE.test(item.type || '')) { errors.push('actions.lire[] : un type de fichier attendu (un mot, comme pdf)'); return; }
  const where = `actions.lire ${item.type}`;
  if (seen.has(item.type)) errors.push(`${where} : type déjà déclaré`);
  seen.add(item.type);
  if (item.extension !== undefined && !extensions.has(item.extension)) errors.push(
    `${where} : l'extension ${item.extension} n'est pas déclarée dans extensions`);
}

function checkReads(m, errors) {
  const actions = isObject(m.actions) ? m.actions : {};
  if (actions.lire === undefined) return;
  if (!Array.isArray(actions.lire)) { errors.push('actions.lire : liste attendue'); return; }
  const extensions = new Set((Array.isArray(m.extensions) ? m.extensions : []).map(ext => ext && ext.id));
  const seen = new Set();
  for (const item of actions.lire) checkRead(item, extensions, seen, errors);
}

// Ce que l'app range chez GFS (`actions.ranger`, 2.7 point 6) et ce qu'elle lui donne à joindre à une cellule (`actions.joindre`, point 7) : les types de
// fichiers que GFS garde ou joint (aujourd'hui `pdf`). L'appel d'un type qui n'y est pas est refusé (5.4, points 9 et 12).
function checkFiled(m, errors) {
  const actions = isObject(m.actions) ? m.actions : {};
  for (const name of ['ranger', 'joindre']) {
    if (actions[name] === undefined) continue;
    if (!Array.isArray(actions[name])) { errors.push(`actions.${name} : liste attendue`); continue; }
    const seen = new Set();
    for (const type of actions[name]) {
      if (typeof type !== 'string' || !FILE_TYPE_RE.test(type)) errors.push(`actions.${name}[] : un type de fichier attendu (un mot, comme pdf)`);
      else if (seen.has(type)) errors.push(`actions.${name} ${type} : type déjà déclaré`);
      seen.add(type);
    }
  }
}

// Les personnes de l'annuaire (`actions.personnes`, 2.7 point 8) : `choisir` (l'app peut demander à GFS de lui faire choisir une personne) en booléen, et
// `inserer` (l'app en reçoit une, et dit où elle la pose) en texte français et anglais.
function checkPeople(m, errors) {
  const actions = isObject(m.actions) ? m.actions : {};
  const people = actions.personnes;
  if (people === undefined) return;
  if (!isObject(people)) { errors.push('actions.personnes : objet attendu'); return; }
  if (people.choisir !== undefined && typeof people.choisir !== 'boolean') errors.push('actions.personnes.choisir : true ou false attendu');
  if (people.inserer !== undefined && !isBilingual(people.inserer)) errors.push(
    'actions.personnes.inserer : un texte en français et en anglais attendu (où l\'app pose la personne)');
}

// `cdnAccepte` (facultatif, contrats 2.6 point 15) : faux quand la politique de sécurité de l'app ne nomme pas encore l'adresse du CDN de GFS pour cette
// extension ; la fenêtre le dit sous le choix « CDN » (qui reste libre) et conseille « Copie figée ». Absent ou vrai : rien à dire.
function checkExtensions(m, errors) {
  for (const ext of m.extensions || []) {
    if (!isText(ext.id) || !isBilingual(ext.nom)) errors.push('extensions[] : id et nom (fr, en) attendus');
    checkDisplay(ext, `extension ${ext.id}`, errors);
    if (!isSafePath(String(ext.dossier || '').replace(/\/$/, ''))) errors.push(`extension ${ext.id} : dossier hors de l'app`);
    checkLibraries(ext, errors);
    if (ext.cdnAccepte !== undefined && typeof ext.cdnAccepte !== 'boolean') errors.push(`extension ${ext.id} : cdnAccepte : vrai ou faux attendu`);
  }
}

// La fonction dont la copie est dans l'app : son poids se dit, rien ne se liste, et `sansCdn` (la copie est le seul mode) est vrai ou faux.
function checkInAppNative(group, errors) {
  if (group.bibliotheques !== undefined) errors.push(`natives ${group.id} : une fonction dont la copie est dans l'app n'a pas de bibliotheques`);
  if (!Number.isInteger(group.poids) || group.poids <= 0) errors.push(`natives ${group.id} : poids (octets) attendu`);
  if (group.sansCdn !== undefined && typeof group.sansCdn !== 'boolean') errors.push(`natives ${group.id} : sansCdn : vrai ou faux attendu`);
}
// Les bibliothèques natives de l'app, rangées par fonction (`natives`, facultatif, contrats 2.6 point 14) : { id, nom (fr, en), bibliotheques: [{ id, version
// exacte }] }, ou, quand la copie figée est dans le
// dépôt de l'app (l'éditeur : sa copie est une carte d'importation), { id, nom, copieDansApp: true, poids, sansCdn? } (`sansCdn: true` : la copie est le seul
// mode, l'app n'a pas de CDN pour
// cette fonction, kit 0.30.0). L'app les
// emploie déjà (sa liste) ; GFS en garde la copie figée, que la personne peut choisir à la place du CDN, fonction par fonction. Une bibliothèque n'est que dans
// une seule fonction.
function checkNativeLibraries(group, libraries, errors) {
  // la copie est dans le dépôt de l'app : GFS n'a aucune bibliothèque à lister, seulement le poids à dire (contrats 2.6, point 14)
  if (group.copieDansApp === true) { checkInAppNative(group, errors); return; }
  if (group.sansCdn !== undefined) errors.push(`natives ${group.id} : sansCdn ne se dit que pour une fonction dont la copie est dans l'app (copieDansApp)`);
  if (!Array.isArray(group.bibliotheques) || !group.bibliotheques.length) {
    errors.push(`natives ${group.id} : bibliotheques : liste non vide attendue`); return; }
  for (const lib of group.bibliotheques) {
    if (!isObject(lib) || !LIBRARY_ID_RE.test(lib.id || '')) errors.push(`natives ${group.id} : une bibliothèque sans id valable`);
    else if (!EXACT_VERSION_RE.test(lib.version || '')) errors.push(`natives ${group.id} : la version de ${lib.id} doit être exacte (ni intervalle ni latest)`);
    else if (libraries.has(lib.id)) errors.push(`natives ${group.id} : ${lib.id} est déjà dans une autre fonction`);
    else libraries.add(lib.id);
  }
}
function checkNatives(m, errors) {
  if (m.natives === undefined) return;
  if (!Array.isArray(m.natives)) { errors.push('natives : liste attendue'); return; }
  const groups = new Set();
  const libraries = new Set();
  for (const group of m.natives) {
    if (!isObject(group) || !LIBRARY_ID_RE.test(group.id || '') || !isBilingual(group.nom)) {
      errors.push('natives[] : id et nom (fr, en) attendus'); continue; }
    if (groups.has(group.id)) errors.push(`natives ${group.id} : fonction déjà déclarée`);
    groups.add(group.id);
    checkDisplay(group, `natives ${group.id}`, errors);
    checkNativeLibraries(group, libraries, errors);
  }
}

const OPENINGS = ['fichier', 'nouveau', 'importer', 'lire', 'modele', 'personne'];

// `ouverture` (facultatif, contrats 2.2) : ce que l'app sait faire d'une ouverture que GFS lui passe, `{ fichier, nouveau, importer, lire, modele }` en
// booléens (`personne` : l'app reçoit une personne de l'annuaire, contrats 5.2 point 3) ; un genre absent vaut faux (GFS ouvre alors l'app sur son modèle
// habituel et le dit). `permanente` (facultatif) : l'app ne se retire pas de la fenêtre « Apps et extensions ».
function checkOpening(m, errors) {
  if (m.ouverture !== undefined) {
    if (!isObject(m.ouverture)) errors.push('ouverture : objet attendu');
    else for (const key of OPENINGS) if (m.ouverture[key] !== undefined && typeof m.ouverture[key] !== 'boolean') errors.push(
      `ouverture.${key} : true ou false attendu`);
  }
  if (m.permanente !== undefined && typeof m.permanente !== 'boolean') errors.push('permanente : true ou false attendu');
}

const SHOT_FILE_RE = /\.(webp|png|jpe?g)$/i;
const SHOT_MAX = 6;

// `vitrine` (facultatif, contrats 2.2) : ce que la fenêtre des apps montre de l'app, une description plus longue que `texte` et jusqu'à six captures, des
// fichiers de GFS rangés dans `vitrine/` (la politique de sécurité du contenu ne charge une image que de GFS) : `{ description: { fr, en }, captures: [{
// fichier, legende: { fr, en } }] }`.
function checkVitrine(m, errors) {
  const shown = m.vitrine;
  if (shown === undefined) return;
  if (!isObject(shown)) { errors.push('vitrine : objet attendu'); return; }
  if (shown.description !== undefined && !isBilingual(shown.description)) errors.push('vitrine.description doit porter fr et en');
  if (shown.captures === undefined) return;
  if (!Array.isArray(shown.captures) || shown.captures.length > SHOT_MAX) {
    errors.push(`vitrine.captures : une liste de ${SHOT_MAX} captures au plus est attendue`); return; }
  for (const capture of shown.captures) {
    if (!isObject(capture) || !isSafePath(capture.fichier) || !SHOT_FILE_RE.test(capture.fichier)) errors.push(
      'vitrine.captures[].fichier : chemin relatif sûr d\'une image (.webp, .png, .jpg) attendu');
    else if (!isBilingual(capture.legende)) errors.push('vitrine.captures[].legende doit porter fr et en');
  }
}

// Le niveau d'une app (`maturite`, facultatif, contrats 2.2) : « alpha », « beta », ou sa version stable, « v1 » ou « v1.1 » (V1 et plus).
export const MATURITY_RE = /^(alpha|beta|v[1-9]\d{0,2}(\.\d{1,3})?)$/;

function checkMaturity(m, errors) {
  if (m.maturite !== undefined && !(typeof m.maturite === 'string' && MATURITY_RE.test(m.maturite))) errors.push(
    'maturite : « alpha », « beta » ou une version stable comme « v1 » ou « v1.1 » attendu');
}

// `modeles` (facultatif, contrats 2.2 et 5.4, point 13) : où sont les modèles de départ de l'app, `{ catalogue: "publipostage/modeles.json" }`, le chemin
// relatif sûr d'un fichier JSON rangé dans le dossier `modeles/` de GFS (comme les captures de la vitrine : GFS ne lit et ne montre que ses propres fichiers).
// `type` (facultatif, pour une app SANS type de fichier : Automation+, dont un automatisme est une ligne de sa table) : le type que GFS donne aux modèles de
// son catalogue, `{ valeur, nom: { fr, en }, icone? }` ; il n'ouvre rien d'autre (ni « Nouveau », ni une ligne de l'explorateur).
const TEMPLATE_TYPE_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;

function checkTemplateType(m, errors) {
  const type = m.modeles.type;
  if (type === undefined) return;
  if (!isObject(type) || typeof type.valeur !== 'string' || !TEMPLATE_TYPE_RE.test(type.valeur) || !isBilingual(type.nom)
    || (type.icone !== undefined && !isText(type.icone))) { errors.push('modeles.type : valeur, nom (fr, en) et, au besoin, icone attendus'); return; }
  if ((m.fichiers || []).some(file => (file.types || []).some(known => known.valeur === type.valeur))) errors.push(
    `modeles.type ${type.valeur} : valeur déjà prise par un type de fichier`);
}

function checkTemplates(m, errors) {
  if (m.modeles === undefined) return;
  if (!isObject(m.modeles) || !isSafePath(m.modeles.catalogue) || !/\.json$/i.test(m.modeles.catalogue)) { errors.push(
    'modeles.catalogue : chemin relatif sûr d\'un fichier .json attendu'); return; }
  checkTemplateType(m, errors);
}

// Rend { ok, errors }. `others` : les manifestes déjà acceptés du catalogue (unicité des id, des préfixes et des clés de réglages).
export function validateManifest(m, others = []) {
  const errors = [];
  if (!isObject(m)) return { ok: false, errors: ['le manifeste n\'est pas un objet'] };
  checkIdentity(m, errors);
  checkDisplay(m, 'app', errors);
  checkCatalogue(m, others, errors);
  checkFiles(m, errors);
  checkNames(m, errors);
  checkSettings(m, errors);
  checkPermissions(m, errors);
  checkArrival(m, errors);
  checkOpening(m, errors);
  checkPeople(m, errors);
  checkImports(m, errors);
  checkReads(m, errors);
  checkFiled(m, errors);
  checkExtensions(m, errors);
  checkNatives(m, errors);
  checkCarried(m, errors);
  checkVitrine(m, errors);
  checkMaturity(m, errors);
  checkTemplates(m, errors);
  return { ok: errors.length === 0, errors };
}

// Un manifeste lu (ou la raison pour laquelle il ne l'a pas été), jugé contre les manifestes déjà acceptés : { app, manifest, ok, errors }.
function judge(entry, read, accepted) {
  let manifest = null;
  let errors;
  try {
    if (read.error) throw read.error;
    manifest = read.manifest;
    errors = validateManifest(manifest, accepted).errors;
    if (manifest && manifest.id !== entry.id) errors.push(`l'id ${manifest.id} ne correspond pas au catalogue (${entry.id})`);
  } catch (e) {
    errors = [`manifeste illisible : ${e && e.message}`];
  }
  return { app: entry, manifest, ok: errors.length === 0, errors };
}

// Charge les manifestes du catalogue : { app, manifest, ok, errors }. Un manifeste illisible ou invalide reste dans la liste, grisé.
// Les lectures partent toutes ensemble (un aller-retour de réseau pour tout le catalogue, au lieu d'un par app : audit vitesse du 10/11, faits vérifiés 82) ;
// le jugement garde l'ordre du catalogue, car l'unicité des id, des préfixes et des clés se juge contre les manifestes déjà acceptés.
export async function loadAll(catalogue, fetchJson) {
  const readOne = async entry => {
    try { return { manifest: await fetchJson(entry.manifeste) }; } catch (error) { return { error }; }
  };
  const reads = await Promise.all(catalogue.map(readOne));
  const loaded = [];
  catalogue.forEach((entry, index) => loaded.push(judge(entry, reads[index], loaded.filter(item => item.ok).map(item => item.manifest))));
  return loaded;
}

// Le nom d'un champ bilingue dans la langue de la personne, repli sur l'autre.
export const label = (field, lang) => (field && (field[lang] || field.fr || field.en)) || '';
