// La validation de `noms` (contrats 2.4) : les autres noms que le document peut donner aux tables et aux colonnes de l'app (js/apps/doc-names.js). Un fichier
// à part pour que `manifest.js` reste sous les seuils de l'audit.
//
//   "noms": { "<table du manifeste>": { "aussi": ["<autre nom de la table>", …], "colonnes": { "<colonne du manifeste>": ["<autre nom>", …] } }, … }
//
// Chaque table nommée ici est une table du préfixe de l'app que `fichiers[]` lit (sa table, son rangement ou une table liée) ; ses autres noms sont aussi du
// préfixe et ne sont ceux d'aucune autre table du manifeste.

const isText = value => typeof value === 'string' && value !== '';
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const lower = value => String(value).toLowerCase();

function checkTableNames(table, entry, prefix, errors) {
  const where = `noms.${table}`;
  for (const key of Object.keys(entry)) if (key !== 'aussi' && key !== 'colonnes') errors.push(`${where}.${key} : inconnu`);
  if (entry.aussi === undefined) return;
  if (!Array.isArray(entry.aussi) || !entry.aussi.every(isText)) { errors.push(`${where}.aussi : liste de noms de tables attendue`); return; }
  for (const other of entry.aussi) {
    if (!lower(other).startsWith(lower(prefix))) errors.push(`${where}.aussi : ${other} hors du préfixe`);
    if (lower(other) === lower(table)) errors.push(`${where}.aussi : ${other} est déjà le nom du manifeste`);
  }
}

function checkColumnNames(table, entry, errors) {
  if (entry.colonnes === undefined) return;
  const where = `noms.${table}.colonnes`;
  if (!isObject(entry.colonnes)) { errors.push(`${where} : objet attendu`); return; }
  for (const [column, others] of Object.entries(entry.colonnes)) {
    if (!Array.isArray(others) || !others.length || !others.every(isText)) errors.push(`${where}.${column} : liste de noms de colonnes attendue`);
    else if (others.some(other => lower(other) === lower(column))) errors.push(`${where}.${column} : ce nom est déjà celui du manifeste`);
  }
}

// Aucun autre nom d'une table n'est celui d'une autre table du manifeste, ni celui d'un autre nom.
function checkClashes(noms, errors) {
  const owner = new Map(Object.keys(noms).map(table => [lower(table), table]));
  for (const [table, entry] of Object.entries(noms)) {
    for (const other of (isObject(entry) && Array.isArray(entry.aussi) ? entry.aussi : []).filter(isText)) {
      const key = lower(other);
      if (owner.has(key) && owner.get(key) !== table) errors.push(`noms.${table}.aussi : ${other} est déjà un nom de ${owner.get(key)}`);
      else owner.set(key, table);
    }
  }
}

export function checkNames(m, errors) {
  if (m.noms === undefined) return;
  if (!isObject(m.noms)) { errors.push('noms : objet attendu'); return; }
  const prefix = (m.tables && m.tables.prefixe) || '';
  for (const [table, entry] of Object.entries(m.noms)) {
    if (!isObject(entry)) { errors.push(`noms.${table} : objet attendu`); continue; }
    if (!lower(table).startsWith(lower(prefix))) errors.push(`noms.${table} : hors du préfixe`);
    checkTableNames(table, entry, prefix, errors);
    checkColumnNames(table, entry, errors);
  }
  checkClashes(m.noms, errors);
}
