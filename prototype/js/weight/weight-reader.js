// Le poids exact du document, lu dans sa base (lot 4 du poids, demande du porteur du 04/11 ; contrats 2.4 point 5 et 6.6 point 14) : le fichier entier,
// l'historique des modifications, les pièces jointes (stockées, et comptées comme Grist les compte), et chaque table avec son poids exact. Tout passe par des
// lectures SQL que le cadre d'envoi fait avec un jeton en lecture seule (`Transfer.sql`) ; rien n'est écrit, rien n'est gardé.
//
// Deux faits mesurés sur un vrai Grist 1.7.19 (faits vérifiés 43) font la forme de ce module :
//   - Grist coupe toute lecture de plus d'une seconde (400, « a slow statement resulted in a database interrupt ») et le document ne répond plus à rien d'autre
//   pendant ce temps : le poids de toutes
//     les tables d'un coup (`dbstat` sans nom) est donc interdit ; chaque table se lit seule, l'une après l'autre ;
//   - `/sql` n'est rendu qu'à qui peut tout copier (un document sans règle d'accès, ou un propriétaire) : le refus (403) de la première lecture grise la
//   fenêtre, avec cette raison.

// Les lectures. Rien n'y entre que du texte écrit ici : le nom d'une table (un identifiant de Grist) n'est écrit dans une lecture qu'après `TABLE_ID`.
export const SQL = {
  // Le fichier entier : le nombre de pages fois leur taille (6 ms sur un document de 1,9 Go).
  file: 'SELECT (SELECT page_count FROM pragma_page_count()) * (SELECT page_size FROM pragma_page_size()) AS octets',
  // L'historique des modifications : le corps de chaque action gardée pour pouvoir annuler (10 ms sur 922 Mo).
  history: 'SELECT COALESCE(SUM(LENGTH(body)), 0) AS octets FROM _gristsys_ActionHistory',
  // Les pièces jointes stockées dans le fichier (celles qu'un stockage externe garde ailleurs n'y sont pas) : ce qui pèse dans le fichier, supprimées en
  // attente comprises.
  stored: 'SELECT COALESCE(SUM(LENGTH(data)), 0) AS octets FROM _gristsys_Files',
  // Les pièces jointes comme Grist les compte pour sa limite (`DocStorage.js` de la 1.7.19) : une par empreinte, sans les supprimées, à la plus grande taille.
  counted: 'SELECT COALESCE(SUM(len), 0) AS octets FROM (SELECT CASE WHEN files.storageId IS NOT NULL THEN MAX(meta.fileSize) ELSE MAX(LENGTH(files.data)) END AS len FROM _gristsys_Files AS files JOIN _grist_Attachments AS meta ON meta.fileIdent = files.ident WHERE meta.timeDeleted IS NULL GROUP BY meta.fileIdent)',
  tables: 'SELECT tableId FROM _grist_Tables ORDER BY tableId',
  // Le poids exact d'une table : ses pages moins l'espace libre (ce que Grist compte pour les données). `name` est celui d'une table ; 150 ms pour 461 Mo.
  table: name => `SELECT COALESCE(SUM(pgsize - unused), 0) AS octets FROM dbstat WHERE name = '${name}'`,
};

// Un identifiant de table de Grist : lettres, chiffres et soulignés, jamais un chiffre en tête. Rien d'autre n'entre dans une lecture.
export const TABLE_ID = /^[A-Za-z_][A-Za-z0-9_]*$/;

// Pourquoi une lecture a échoué : 'denied' (403 : la personne ne peut pas tout copier), 'slow' (400 : Grist a coupé la lecture) ou 'failed' (le reste : pas de
// jeton, pas de réponse, autre version de Grist).
export function failureKind(error) {
  const status = error && error.kind === 'http' ? error.status : 0;
  if (status === 403 || status === 401) return 'denied';
  return status === 400 ? 'slow' : 'failed';
}

// Le moins de droits d'abord : `sqlWith(statement, writable)` lit avec le jeton en lecture seule ; si Grist le refuse (403), un seul nouvel essai avec le jeton
// qui peut écrire, et tout le reste de la lecture avec lui. Un document à règles d'accès refuse `/sql` au jeton en lecture seule même à son propriétaire, mais
// le rend à son jeton qui peut écrire (mesuré, faits vérifiés 43) ; un éditeur ou un lecteur y est refusé des deux façons. Rien d'autre ne passe par ce jeton
// que des `SELECT` écrits ici.
export function escalating(sqlWith) {
  let writable = false;
  return async statement => {
    try {
      return await sqlWith(statement, writable);
    } catch (error) {
      if (writable || failureKind(error) !== 'denied') throw error;
      writable = true;
      return sqlWith(statement, true);
    }
  };
}

// Une lecture qui rend des octets, ou null (`optional` : un échec autre qu'un refus de droits laisse null au lieu de lever).
async function readOne(sql, statement, optional) {
  try {
    return bytesOf(await sql(statement));
  } catch (error) {
    if (!optional || failureKind(error) === 'denied') throw error;
    return null;
  }
}

const bytesOf = rows => (rows[0] && Number.isFinite(Number(rows[0].octets)) ? Number(rows[0].octets) : null);

// Lit le poids exact. `sql(statement)` rend les lignes (`Transfer.sql`) ; `update(état)` est appelé après chaque lecture avec une copie de l'état (la fenêtre
// se redessine) ; `cancelled()` dit que la fenêtre s'est fermée (on s'arrête). L'état : { status ('loading', 'ok', 'denied', 'slow' ou 'failed'), reason (le
// message du serveur), file, history, stored, counted (octets, ou null tant que non lus), tables ([{ name, bytes (octets, ou null), state ('wait', 'ok', 'slow'
// ou 'failed') }], ou null avant la liste), rest (octets que ni les tables, ni les pièces jointes, ni l'historique n'expliquent : pages libres, index, tables
// internes de Grist) }.
export async function readWeight(sql, update, cancelled = () => false) {
  const state = { status: 'loading', reason: '', file: null, history: null, stored: null, counted: null, tables: null, rest: null };
  const push = () => update({ ...state, tables: state.tables && state.tables.map(row => ({ ...row })) });
  const stop = () => cancelled();
  try {
    // Le fichier entier est la sonde : son échec (le refus de qui ne peut pas tout copier, un serveur qui ne répond pas) est celui de tout le reste. Une autre
    // lecture qui échoue laisse sa ligne vide.
    for (const [key, statement] of [['file', SQL.file], ['history', SQL.history], ['stored', SQL.stored], ['counted', SQL.counted]]) {
      state[key] = await readOne(sql, statement, key !== 'file');
      if (stop()) return;
      push();
    }
    const listed = await sql(SQL.tables);
    if (stop()) return;
    state.tables = listed.map(row => String(row.tableId)).map(name => ({ name, bytes: null, state: TABLE_ID.test(name) ? 'wait' : 'failed' }));
    push();
    await readTables(sql, state, push, stop);
  } catch (error) {
    if (stop()) return;
    Object.assign(state, { status: failureKind(error), reason: String((error && error.message) || error) });
    push();
    return;
  }
  if (stop()) return;
  finish(state);
  push();
}

// Les tables, une à la fois : un refus de lire l'une (trop longue) ne retient pas les autres.
async function readTables(sql, state, push, stop) {
  for (const row of state.tables) {
    if (row.state !== 'wait') continue;
    if (stop()) return; // la fenêtre s'est fermée : plus aucune lecture
    try {
      row.bytes = bytesOf(await sql(SQL.table(row.name)));
      row.state = row.bytes === null ? 'failed' : 'ok';
    } catch (error) {
      if (stop()) return;
      row.state = failureKind(error) === 'slow' ? 'slow' : 'failed';
    }
    if (stop()) return;
    push();
  }
}

// La fin de la lecture : les tables du plus lourd au plus léger, et le reste du fichier que rien d'autre n'explique.
function finish(state) {
  state.status = 'ok';
  state.tables.sort((a, b) => (b.bytes ?? -1) - (a.bytes ?? -1) || a.name.localeCompare(b.name));
  const known = state.tables.reduce((sum, row) => sum + (row.bytes || 0), 0) + (state.history || 0) + (state.stored || 0);
  state.rest = state.file === null ? null : Math.max(0, state.file - known);
}
