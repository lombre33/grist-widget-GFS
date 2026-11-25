// Ce que le pare-feu devant une instance de Grist laisse passer de `GET /sql` (faits vérifiés 173). À COLLER dans la console du navigateur (F12, onglet « Console »), sur une page d'un document
// Grist de l'instance (l'adresse est de la forme https://<serveur>/o/<équipe>/<document>/<titre>/p/<page>), avec la session de la personne : vingt-six lectures, toutes en `SELECT`, sur son
// document, une toutes les 0,4 s. Rien ne s'écrit, rien ne part ailleurs que vers le serveur de la page.
// Chaque ligne du résultat dit la réponse : « Grist » (le serveur a répondu : une ligne ou une erreur JSON, donc le pare-feu a laissé passer la forme) ou « PARE-FEU » (une page HTML, ou un refus 403
// qui ne vient pas de Grist : la forme est refusée). La sonde copie ensuite le même tableau, en une ligne de texte, dans le presse-papiers (Firefox : fonction `copy` de la console) : il n'y a plus qu'à le coller.
(async () => {
  const [, kind, org, doc] = location.pathname.split('/');
  if (kind !== 'o' || !org || !doc) { console.error('Ouvrez une page d\'un document (adresse /o/<équipe>/<document>/…) avant de coller la sonde.'); return; }
  const base = `${location.origin}/o/${org}/api/docs/${doc}/sql`;
  const STRUCT = 'SELECT t.tableId AS tableId, c.colId AS colId, c.type AS type FROM _grist_Tables_column AS c JOIN _grist_Tables AS t ON t.id = c.parentId WHERE t.tableId IN (\'GFS_Fichiers\')';
  const tests = [
    ['0 témoin : un compte simple', 'SELECT COUNT(*) AS n FROM _grist_Tables'],
    ['1 poids du fichier (forme actuelle de GFS)', 'SELECT (SELECT page_count FROM pragma_page_count()) * (SELECT page_size FROM pragma_page_size()) AS octets'],
    ['2 poids : sans sous-requête', 'SELECT page_count * page_size AS octets FROM pragma_page_count(), pragma_page_size()'],
    ['3 poids : sans parenthèses', 'SELECT page_count * page_size AS octets FROM pragma_page_count, pragma_page_size'],
    ['4 poids d\'une petite table (dbstat)', 'SELECT COALESCE(SUM(pgsize), 0) AS octets FROM dbstat WHERE name = \'_grist_Tables\''],
    ['5 poids : une seule sous-requête', 'SELECT (SELECT page_count FROM pragma_page_count()) AS octets'],
    ['6 pièces jointes stockées', 'SELECT COALESCE(SUM(LENGTH(data)), 0) AS octets FROM _gristsys_Files'],
    ['7 historique des modifications', 'SELECT COALESCE(SUM(LENGTH(body)), 0) AS octets FROM _gristsys_ActionHistory'],
    ['8 structure (forme actuelle de GFS)', `${STRUCT} AND substr(c.colId, 1, 11) <> 'gristHelper' AND c.colId <> 'manualSort' ORDER BY c.parentId, c.colId`],
    ['9 structure : NOT LIKE et !=, sans substr ni <>', `${STRUCT} AND c.colId NOT LIKE 'gristHelper%' AND c.colId != 'manualSort' ORDER BY c.parentId, c.colId`],
    ['10 structure : sans aucun filtre de nom', `${STRUCT} ORDER BY c.parentId, c.colId`],
    ['11 structure : NOT GLOB et !=', `${STRUCT} AND c.colId NOT GLOB 'gristHelper*' AND c.colId != 'manualSort' ORDER BY c.parentId, c.colId`],
    ['12 structure : sans jointure', 'SELECT colId, type, parentId FROM _grist_Tables_column WHERE colId NOT LIKE \'gristHelper%\' LIMIT 5'],
    ['13 substr seul', 'SELECT COUNT(*) AS n FROM _grist_Tables_column WHERE substr(colId, 1, 11) = \'gristHelper\''],
    ['14 <> seul', 'SELECT COUNT(*) AS n FROM _grist_Tables_column WHERE colId <> \'manualSort\''],
    ['15 lignes : CAST et length', 'SELECT id, COALESCE(length(CAST(tableId AS BLOB)), 0) AS gfs_octets FROM _grist_Tables LIMIT 5'],
    // Les trois lectures du poids que la sonde de 11 lectures (25/11) n'avait pas vues, telles que GFS les envoie (js/weight/weight-reader.js), puis la structure à plusieurs tables.
    ['16 pièces jointes comptées (forme actuelle de GFS)', 'SELECT COALESCE(SUM(len), 0) AS octets FROM (SELECT COALESCE(MAX(meta.fileSize), 0) * (files.storageId IS NOT NULL) + COALESCE(MAX(LENGTH(files.data)), 0) * (files.storageId IS NULL) AS len '
      + 'FROM _gristsys_Files AS files JOIN _grist_Attachments AS meta ON meta.fileIdent = files.ident WHERE meta.timeDeleted IS NULL GROUP BY meta.fileIdent)'],
    ['17 poids d\'une table (pgsize - unused)', 'SELECT COALESCE(SUM(pgsize - unused), 0) AS octets FROM dbstat WHERE name = \'_grist_Tables\''],
    ['18 liste des tables', 'SELECT tableId FROM _grist_Tables ORDER BY tableId'],
    ['19 structure (forme de GFS, plusieurs tables)', 'SELECT t.tableId AS tableId, c.colId AS colId, c.type AS type FROM _grist_Tables_column AS c JOIN _grist_Tables AS t ON t.id = c.parentId '
      + 'WHERE t.tableId IN (\'GFS_Corbeille\', \'GFS_Fichiers\', \'GFS_Annuaires\', \'Publipostage_Templates\') AND c.colId NOT LIKE \'gristHelper%\' AND c.colId != \'manualSort\' ORDER BY c.parentId, c.colId'],
    // La lecture légère des fichiers (js/explorer/explorer-sql.js `rowsStatement`) : le nom des colonnes entre guillemets, la taille des cellules lourdes comptée par `length(CAST(… AS BLOB))`.
    ['20 lignes : plusieurs colonnes et deux tailles additionnées', 'SELECT id, "tableId", COALESCE(length(CAST("summarySourceTable" AS BLOB)), 0) + COALESCE(length(CAST("tableId" AS BLOB)), 0) AS gfs_octets FROM "_grist_Tables"'],
    ['21 lignes : une vraie table de GFS (sans son contenu)', 'SELECT id, "Nom", "Type", "Date", "Auteur", "Taille", COALESCE(length(CAST("Contenu" AS BLOB)), 0) AS gfs_octets FROM "GFS_Fichiers"'],
    // Les pièces jointes comptées, par morceaux : laquelle des écritures de GFS le pare-feu refuse-t-il ? (a : jointure seule ; b : table dérivée seule ; c : le test `IS NOT NULL` sans table dérivée ; d : les tailles de Grist sans jointure)
    ['22 pièces comptées (a) : jointure et somme, sans table dérivée', 'SELECT COALESCE(SUM(LENGTH(files.data)), 0) AS octets FROM _gristsys_Files AS files JOIN _grist_Attachments AS meta ON meta.fileIdent = files.ident WHERE meta.timeDeleted IS NULL'],
    ['23 pièces comptées (b) : table dérivée, sans `IS NOT NULL`', 'SELECT COALESCE(SUM(len), 0) AS octets FROM (SELECT MAX(LENGTH(files.data)) AS len FROM _gristsys_Files AS files JOIN _grist_Attachments AS meta ON meta.fileIdent = files.ident WHERE meta.timeDeleted IS NULL GROUP BY meta.fileIdent)'],
    ['24 pièces comptées (c) : `IS NOT NULL` sans table dérivée', 'SELECT COALESCE(SUM(COALESCE(meta.fileSize, 0) * (files.storageId IS NOT NULL) + COALESCE(LENGTH(files.data), 0) * (files.storageId IS NULL)), 0) AS octets FROM _gristsys_Files AS files JOIN _grist_Attachments AS meta ON meta.fileIdent = files.ident WHERE meta.timeDeleted IS NULL'],
    ['25 pièces comptées (d) : les tailles de Grist, sans jointure', 'SELECT COALESCE(SUM(fileSize), 0) AS octets FROM _grist_Attachments WHERE timeDeleted IS NULL'],
    ['26 pièces comptées (e) : `IN (SELECT …)`', 'SELECT COALESCE(SUM(LENGTH(data)), 0) AS octets FROM _gristsys_Files WHERE ident IN (SELECT fileIdent FROM _grist_Attachments WHERE timeDeleted IS NULL)'],
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
  const text = JSON.stringify(out.map(line => [line.test, line.http, line.de]));
  console.log(text);
  try { copy(text); console.log('Le résultat est copié : collez-le (Ctrl+V) dans la discussion.'); } catch (error) { console.log('Copiez la ligne ci-dessus et collez-la dans la discussion.'); }
})();
