// Un faux Grist en mémoire pour les essais des tables de GFS (js/files/own-table.js, rangement.js, files-store.js, app-files.js) : il refuse, comme le vrai, d'écrire une colonne absente, et un lot
// s'applique en entier ou pas du tout (une action qui échoue défait les précédentes : le lot de la corbeille, qui ajoute à `GFS_Corbeille` et retire de la table de l'app, ne laisse jamais les deux).
// Ce qui dépend de ce que Grist envoie vraiment (identifiant rendu par AddTable, colonnes lues, adresse écrite par la formule déclenchée, pièces jointes) se mesure dans
// le labo, sur un vrai serveur (labo/run-reel-serveur.mjs, labo/run-pdf.mjs).

// `email` : l'adresse que le faux Grist inscrit, à la création d'une ligne-sonde, dans une colonne à formule déclenchée `user.Email` (null : Grist ne connaît pas la personne).
// `fail` : { AddRecord, RemoveRecord } : un message, et ce verbe échoue.
export function fakeGrist(tables = {}, { renameTo = null, email = null, fail = {} } = {}) {
  const actions = [];
  const batches = []; // un élément par appel à `applyUserActions` : les actions du lot (un lot est atomique)
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
    // Retirer une ligne qui n'est plus là n'échoue pas, comme dans Grist (mesuré, labo/run-corbeille-apps.mjs) : le lot continue, la réponse est null.
    if (verb === 'RemoveRecord') {
      const at = table.rows.findIndex(row => row.id === a);
      if (at >= 0) table.rows.splice(at, 1);
      return null;
    }
    const known = Object.keys(b);
    const unknown = known.filter(column => !table.columns.includes(column));
    if (unknown.length) throw new Error(`Invalid column ${unknown[0]}`);
    if (verb === 'AddRecord') {
      table.nextId = (table.nextId || Math.max(0, ...table.rows.map(row => row.id)) + 1);
      // `a` : le numéro de ligne voulu (une restauration le redonne), null : un numéro neuf. Un numéro pris est refusé, comme dans Grist.
      if (a != null && table.rows.some(row => row.id === a)) throw new Error(`Invalid row id ${a}`);
      const made = { id: a != null ? a : table.nextId, ...b };
      table.nextId = Math.max(table.nextId, made.id + 1);
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
    // Plusieurs lignes d'un coup (a : les numéros, b : par colonne, la liste des valeurs) : comme Grist, un numéro absent fait échouer tout le lot.
    if (verb === 'BulkUpdateRecord') { a.forEach((id, i) => Object.assign(table.rows.find(row => row.id === id) || (() => { throw new Error(`Invalid row id ${id}`); })(), Object.fromEntries(known.map(column => [column, b[column][i]])))); return null; }
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
    applyUserActions: async list => {
      const before = Object.fromEntries(Object.entries(tables).map(([name, table]) => [name, structuredClone(table)]));
      const specsBefore = structuredClone(specs);
      batches.push(list.map(action => [...action]));
      try {
        return { retValues: list.map(apply) };
      } catch (error) {
        for (const name of Object.keys(tables)) if (!(name in before)) delete tables[name];
        for (const [name, saved] of Object.entries(before)) {
          for (const key of Object.keys(tables[name])) delete tables[name][key];
          Object.assign(tables[name], saved);
        }
        for (const key of Object.keys(specs)) delete specs[key];
        Object.assign(specs, specsBefore);
        throw error;
      }
    },
  };
  return { port: { doc }, tables, actions, batches };
}
