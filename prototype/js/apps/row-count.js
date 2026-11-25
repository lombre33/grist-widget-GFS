// Le nombre de lignes d'une table du document, pour choisir entre les deux tables d'une app que le document porte sous deux noms (js/apps/doc-names.js).
// La lecture SQL d'abord (`sql`, le cadre d'envoi : 30 ms, jamais le contenu) ; sinon la table lue en entier, ce que seul un document aux deux jeux de noms
// demande. Rend null quand ni l'une ni l'autre ne répond : GFS ne sait pas, et lit alors l'autre nom que le manifeste donne.

const TABLE_ID = /^[A-Za-z_][A-Za-z0-9_]*$/;

export async function countRows(table, { sql = null, doc }) {
  if (sql && TABLE_ID.test(table)) {
    try {
      const records = await sql(`SELECT COUNT(*) AS n FROM "${table}"`);
      const n = Number(records && records[0] && records[0].n);
      if (Number.isFinite(n)) return n;
    } catch {
      // la lecture légère est refusée ou coupée : la table entière, ci-dessous
    }
  }
  try {
    const columns = await doc.fetchTable(table);
    return Array.isArray(columns.id) ? columns.id.length : null;
  } catch {
    return null;
  }
}
