// Les noms d'avant des tables de GFS (retour n° 1 du porteur, 25/11 : « GFS a encore des tables en français ») : tout ce que GFS garde dans un document passe
// aux noms anglais, en un seul lot, par la fenêtre commune du kit (`NamesUpdate`, js/files/names-update.js). Ce module ne parle ni à Grist ni à la page : il
// dit ce qui change, calcule le lot d'après les noms du document et reconnaît un document qui n'a pas encore été mis à jour.
//
// Ce qui ne change pas (décision du porteur, 25/11) : les tables que Sync+ tient (`GFS_Fichiers` partagée, `GFS_Recus*`, `GFS_Synchro`, `GFS_Journal_*`)
// gardent leurs noms d'avant, et avec elles leurs colonnes et les colonnes d'aide que GFS pose sur les tables des apps : un lien de Sync+ ne se rompt jamais
// (faits vérifiés, 160). Les valeurs que GFS écrit (les droits `lecture`, `ecriture`, `admin`, les clés `dossier:…`) ne sont pas des noms et ne changent pas.

// Une entrée par table : `table` (le nom d'arrivée), `before` (le nom d'avant ; le même quand seules les colonnes changent) et `columns` (colonne d'avant ->
// colonne d'arrivée ; une colonne qui ne change pas n'y est pas).
export const GFS_RENAMES = Object.freeze([
  { table: 'GFS_Filing', before: 'GFS_Rangement', columns: { Utilisateur: 'User', Fichier: 'File', Favori: 'Favorite', Dossier: 'Folder', Replie: 'Collapsed',
    Valeur: 'Value', Adresse: 'Address' } },
  { table: 'GFS_Groups', before: 'GFS_Groupes', columns: { Nom: 'Name', NomL: 'NameL', PersonnesIci: 'People', SourceGroupe: 'SourceGroup', Membres: 'Members',
    Nb: 'Count' } },
  { table: 'GFS_Spaces', before: 'GFS_Espaces', columns: { Cle: 'Key', Nom: 'Name', Voit: 'Sees' } },
  { table: 'GFS_Placement', before: 'GFS_Placement', columns: { Cible: 'Target', Espace: 'Space', Dossier: 'Folder', Voit: 'Sees', Lien: 'Link',
    Partages: 'Shares' } },
  { table: 'GFS_Shares', before: 'GFS_Partages', columns: {
    Cible: 'Target', Personne: 'Person', Droit: 'Right', Telecharger: 'Download', Fin: 'End', Auteur: 'Author', AuteurAcces: 'AuthorAccess',
      PersonneL: 'PersonL', Actif: 'Active',
    Valide1: 'AuthorOwner', Valide: 'Valid', AdminsCible: 'AdminsTarget' } },
  { table: 'GFS_Trash', before: 'GFS_Corbeille', columns: {
    Identifiant: 'EntryId', FichierId: 'FileId', Nom: 'Name', Auteur: 'Author', SupprimeLe: 'DeletedAt', SupprimePar: 'DeletedBy', Instantane: 'Snapshot' } },
  { table: 'GFS_Directories', before: 'GFS_Annuaires', columns: { Nom: 'Name', Fiches: 'Copy' } },
]);

const lower = value => String(value ?? '').toLowerCase();

// Les colonnes d'un tableau de noms, comparées sans tenir compte de la casse (Grist ne la distingue pas).
const columnSet = columns => new Set((columns || []).map(lower));

// La table du document qui porte ce nom (sans tenir compte de la casse) : { id, columns } ou null. `schema` : { tables: { '<table>': ['<colonne>', …] } },
// comme le kit le lit.
function findTable(schema, name) {
  for (const [id, columns] of Object.entries((schema && schema.tables) || {})) if (lower(id) === lower(name)) return { id, columns: columns || [] };
  return null;
}

// Le lot de GFS d'après les noms du document : pour chaque table de GFS encore sous son nom d'avant, son renommage (`RenameTable`) puis celui de ses colonnes
// d'avant (`RenameColumn`, sur le nom d'arrivée de la table : le kit rejoue le lot dans l'ordre). Une colonne d'avant dont la colonne d'arrivée existe déjà
// n'est pas touchée : c'est le kit qui dit « un nom d'arrivée est déjà pris » (état `blocked`) quand c'est la table qu'on renomme, et ici la colonne reste
// telle quelle. Rien d'écrit quand le document est déjà à jour (ou n'a pas de table de GFS) : null.
export function planGfsNames(schema) {
  const actions = [];
  for (const entry of GFS_RENAMES) {
    const old = findTable(schema, entry.before);
    if (!old) continue;
    const renamed = lower(entry.before) !== lower(entry.table);
    if (renamed) actions.push(['RenameTable', old.id, entry.table]);
    const have = columnSet(old.columns);
    for (const [before, after] of Object.entries(entry.columns)) {
      if (have.has(lower(before)) && !have.has(lower(after))) actions.push(['RenameColumn', renamed ? entry.table : old.id, before, after]);
    }
  }
  return actions.length ? actions : null;
}

// Le document porte-t-il encore une table de GFS sous la forme d'avant ? Rend les noms d'arrivée des tables concernées (vide : à jour). Une table est d'avant
// quand elle porte son ancien nom (sans la nouvelle), ou, pour `GFS_Placement` dont le nom ne change pas, une colonne d'avant sans sa colonne d'arrivée.
export function legacyTables(schema) {
  const found = [];
  for (const entry of GFS_RENAMES) {
    const old = findTable(schema, entry.before);
    if (!old) continue;
    if (lower(entry.before) !== lower(entry.table)) {
      if (!findTable(schema, entry.table)) found.push(entry.table);
      continue;
    }
    const have = columnSet(old.columns);
    if (Object.entries(entry.columns).some(([before, after]) => have.has(lower(before)) && !have.has(lower(after)))) found.push(entry.table);
  }
  return found;
}

// Cette table (par son nom d'arrivée), vue avec ses colonnes, est-elle encore sous la forme d'avant ? `tables` : les noms des tables du document ; `columns` :
// ses colonnes quand on les connaît (sinon, seul le nom compte). Sert à `OwnTable` : GFS ne crée jamais une seconde table à côté de celle d'avant.
export function isLegacyForm(name, tables, columns = null) {
  const entry = GFS_RENAMES.find(item => lower(item.table) === lower(name));
  if (!entry) return false;
  const names = new Set((tables || []).map(lower));
  if (lower(entry.before) !== lower(entry.table)) return names.has(lower(entry.before)) && !names.has(lower(entry.table));
  if (!columns || !names.has(lower(entry.table))) return false;
  const have = columnSet(columns);
  return Object.entries(entry.columns).some(([before, after]) => have.has(lower(before)) && !have.has(lower(after)));
}

// Les formules (mesuré dans Grist 1.7.19, labo/run-noms-gfs.mjs) : Grist réécrit seul `$colonne`, `rec.colonne`, les arguments d'un `lookupRecords(Colonne=…)` et
// ce qui se lit sur le résultat d'un `lookupOne`, mais PAS ce qui se lit sur la variable d'une boucle (`for p in GFS_Shares.lookupRecords(…): p.Droit`) : la
// formule resterait à l'ancien nom et rendrait `AttributeError`, donc plus aucun droit de lecture. Les formules de GFS n'ont que trois variables de boucle, chacune
// sur une table de GFS (`test/gfs-names.test.mjs` garde cette liste contre les formules du code) : `p` (partages), `l` (placement), `r` (rangement). `r` sert
// aussi, dans `Members`, à lire la table d'une source de groupes, qui n'est pas à nous : cette formule n'est jamais réécrite ici.
export const LOOP_VARIABLES = Object.freeze({ p: 'GFS_Shares', l: 'GFS_Placement', r: 'GFS_Filing' });

const columnsRenamedOf = table => (GFS_RENAMES.find(entry => entry.table === table) || { columns: {} }).columns;

// La formule d'une colonne de GFS, avec les noms d'arrivée sur les variables de boucle ; le texte tel quel quand il n'y a rien à changer (idempotent : un nom
// d'arrivée n'est jamais un nom d'avant d'une autre colonne de la même table).
export function rewriteFormula(text) {
  let out = String(text ?? '');
  for (const [variable, table] of Object.entries(LOOP_VARIABLES)) {
    for (const [before, after] of Object.entries(columnsRenamedOf(table))) out = out.replace(new RegExp(`(?<![\\w.])${variable}\\.${before}\\b`, 'g'), `${variable}.${after}`);
  }
  return out;
}

// Les formules à reprendre : `formulas` : { '<table>.<colonne>': formule } (les colonnes à formule du document, `readSchema`) ; `owned(table, colonne)` dit celles
// que GFS a écrites (les tables de partage, les colonnes d'aide). Rend [{ table, column, formula }] avec la formule réécrite, seulement pour celles qui changent.
export function staleFormulas(formulas, owned) {
  const out = [];
  for (const [key, text] of Object.entries(formulas || {})) {
    const at = key.indexOf('.');
    const table = key.slice(0, at); const column = key.slice(at + 1);
    const formula = rewriteFormula(text);
    if (owned(table, column) && formula !== text) out.push({ table, column, formula });
  }
  return out;
}

// Le nom d'arrivée d'une table de GFS dite par son nom d'avant (les marques que GFS a notées avant la mise à jour parlent encore des noms d'avant) ; tout autre
// nom est rendu tel quel.
export function renamedOf(name) {
  const entry = GFS_RENAMES.find(item => lower(item.before) === lower(name));
  return entry ? entry.table : name;
}
