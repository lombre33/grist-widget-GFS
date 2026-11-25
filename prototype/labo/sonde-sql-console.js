// Ce que le pare-feu devant une instance de Grist laisse passer de `GET /sql` (faits vérifiés 173). À COLLER dans la console du navigateur (F12, onglet « Console »), sur une page d'un document
// Grist de l'instance (l'adresse est de la forme https://<serveur>/o/<équipe>/<document>/<titre>/p/<page>), avec la session de la personne : onze lectures, toutes en `SELECT`, sur son
// document, une toutes les 0,4 s. Rien ne s'écrit, rien ne part ailleurs que vers le serveur de la page.
// Chaque ligne du résultat dit la réponse : « Grist » (le serveur a répondu : une ligne ou une erreur JSON, donc le pare-feu a laissé passer la forme) ou « PARE-FEU » (une page HTML, ou un refus 403
// qui ne vient pas de Grist : la forme est refusée). Le dernier message de la console est le même tableau en une ligne de texte, à recopier.
(async () => {
  const [, kind, org, doc] = location.pathname.split('/');
  if (kind !== 'o' || !org || !doc) { console.error('Ouvrez une page d\'un document (adresse /o/<équipe>/<document>/…) avant de coller la sonde.'); return; }
  const base = `${location.origin}/o/${org}/api/docs/${doc}/sql`;
  const tests = [
    ['0 témoin : un compte simple', 'SELECT COUNT(*) AS n FROM _grist_Tables'],
    ['1 poids du fichier (forme actuelle de GFS)', 'SELECT (SELECT page_count FROM pragma_page_count()) * (SELECT page_size FROM pragma_page_size()) AS octets'],
    ['2 poids : sans sous-requête', 'SELECT page_count * page_size AS octets FROM pragma_page_count(), pragma_page_size()'],
    ['3 poids : sans parenthèses', 'SELECT page_count * page_size AS octets FROM pragma_page_count, pragma_page_size'],
    ['4 poids d\'une petite table (dbstat)', 'SELECT COALESCE(SUM(pgsize), 0) AS octets FROM dbstat WHERE name = \'_grist_Tables\''],
    ['5 pièces jointes stockées', 'SELECT COALESCE(SUM(LENGTH(data)), 0) AS octets FROM _gristsys_Files'],
    ['6 historique des modifications', 'SELECT COALESCE(SUM(LENGTH(body)), 0) AS octets FROM _gristsys_ActionHistory'],
    ['7 structure (forme actuelle de GFS)', 'SELECT t.tableId AS tableId, c.colId AS colId, c.type AS type FROM _grist_Tables_column AS c JOIN _grist_Tables AS t ON t.id = c.parentId '
      + 'WHERE t.tableId IN (\'GFS_Fichiers\') AND substr(c.colId, 1, 11) <> \'gristHelper\' AND c.colId <> \'manualSort\' ORDER BY c.parentId, c.colId'],
    ['8 structure : sans substr ni <>', 'SELECT t.tableId AS tableId, c.colId AS colId, c.type AS type FROM _grist_Tables_column AS c JOIN _grist_Tables AS t ON t.id = c.parentId '
      + 'WHERE t.tableId IN (\'GFS_Fichiers\') AND c.colId NOT LIKE \'gristHelper%\' AND c.colId != \'manualSort\' ORDER BY c.parentId, c.colId'],
    ['9 structure : sans jointure', 'SELECT colId, type, parentId FROM _grist_Tables_column WHERE colId NOT LIKE \'gristHelper%\' LIMIT 5'],
    ['10 lignes : CAST et length', 'SELECT id, COALESCE(length(CAST(tableId AS BLOB)), 0) AS gfs_octets FROM _grist_Tables LIMIT 5'],
  ];
  const out = [];
  for (const [label, q] of tests) {
    let line;
    try {
      const response = await fetch(`${base}?q=${encodeURIComponent(q)}`, { credentials: 'same-origin' });
      const type = response.headers.get('content-type') || '';
      const body = (await response.text()).replace(/\s+/g, ' ').slice(0, 90);
      const fromGrist = /json/i.test(type);
      line = { test: label, http: response.status, de: fromGrist ? 'Grist' : 'PARE-FEU', début: body };
    } catch (error) {
      line = { test: label, http: 0, de: 'PARE-FEU (réseau)', début: String(error && error.message || error).slice(0, 90) };
    }
    out.push(line);
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  console.table(out);
  console.log(JSON.stringify(out.map(line => [line.test, line.http, line.de])));
})();
