// Un faux Grist en mémoire pour les essais des tables de GFS (js/own-table.js, rangement.js, files-store.js) : il refuse, comme le vrai, d'écrire une colonne absente.
// Ce qui dépend de ce que Grist envoie vraiment (identifiant rendu par AddTable, colonnes lues, adresse écrite par la formule déclenchée, pièces jointes) se mesure dans
// le labo, sur un vrai serveur (labo/run-reel-serveur.mjs, labo/run-pdf.mjs).

// `email` : l'adresse que le faux Grist inscrit, à la création d'une ligne-sonde, dans une colonne à formule déclenchée `user.Email` (null : Grist ne connaît pas la personne).
// `fail` : { AddRecord, RemoveRecord } : un message, et ce verbe échoue.
export function fakeGrist(tables = {}, { renameTo = null, email = null, fail = {} } = {}) {
  const actions = [];
  const specs = {};
  const apply = ([verb, name, a, b]) => {
    actions.push([verb, name, a, b]);
    if (verb === 'AddTable') {
      const id = renameTo || name;
      tables[id] = { columns: ['id', ...a.map(column => column.id)], rows: [] };
      specs[id] = Object.fromEntries(a.map(column => [column.id, column]));
      return { table_id: id, id: 1, columns: [], views: [] };
    }
    const table = tables[name];
    if (verb === 'AddColumn') { table.columns.push(a); (specs[name] ||= {})[a] = { id: a, ...b }; return null; }
    if (fail[verb] && verb !== 'AddTable') throw new Error(fail[verb]);
    if (verb === 'RemoveRecord') { table.rows.splice(table.rows.findIndex(row => row.id === a), 1); return null; }
    const known = Object.keys(b);
    const unknown = known.filter(column => !table.columns.includes(column));
    if (unknown.length) throw new Error(`Invalid column ${unknown[0]}`);
    if (verb === 'AddRecord') {
      table.nextId = (table.nextId || Math.max(0, ...table.rows.map(row => row.id)) + 1);
      const made = { id: table.nextId++, ...b };
      // Une colonne à formule déclenchée est remplie par Grist à la création de la ligne : l'adresse de la personne pour la ligne-sonde, rien pour les autres.
      for (const column of table.columns) {
        // Une table donnée qui a déjà sa colonne `Adresse` l'a reçue de GFS : à formule déclenchée.
        const spec = (specs[name] || {})[column] || (column === 'Adresse' ? { isFormula: false, formula: 'user.Email' } : null);
        if (spec && spec.isFormula === false && /user\.Email/.test(spec.formula || '')) made[column] = b.Utilisateur === '@sonde' ? email : '';
      }
      table.rows.push(made);
      return made.id;
    }
    if (verb === 'UpdateRecord') { Object.assign(table.rows.find(row => row.id === a), b); return null; }
    throw new Error(`verbe inattendu ${verb}`);
  };
  const doc = {
    listTables: async () => Object.keys(tables),
    fetchTable: async name => {
      const table = tables[name];
      const data = {};
      for (const column of table.columns) data[column] = table.rows.map(row => row[column]);
      return data;
    },
    applyUserActions: async list => ({ retValues: list.map(apply) }),
  };
  return { port: { doc }, tables, actions };
}
