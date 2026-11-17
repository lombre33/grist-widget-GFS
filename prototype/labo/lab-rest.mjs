// L'API REST de Grist avec la session de la page (la page de Grist est de l'origine du serveur : aucun jeton) : ce qu'une personne malveillante ferait sans passer par GFS.
// Les labos de partage s'en servent pour attaquer la donnée brute : le verrou est dans Grist, pas dans l'écran.

// Un appel : { status, json, text } (le texte coupé à 500 signes).
export const call = (page, method, path, body) => page.evaluate(async ([m, p, b]) => {
  const response = await fetch(p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
  const text = await response.text();
  let json = null; try { json = JSON.parse(text); } catch { /* texte */ }
  return { status: response.status, json, text: text.slice(0, 500) };
}, [method, path, body]);

// Des actions utilisateur en un lot (`/apply`), comme le fait `applyUserActions` du widget.
export const apply = (run, actions) => call(run.page, 'POST', `/api/docs/${run.docId}/apply`, actions);

// Les lignes d'une table : [{ id, …colonnes }], ou null quand Grist refuse la lecture.
export const rowsOf = async (run, table) => {
  const answer = await call(run.page, 'GET', `/api/docs/${run.docId}/tables/${table}/records`);
  return answer.status === 200 ? answer.json.records.map(row => ({ id: row.id, ...row.fields })) : null;
};

// Change des cellules d'une ligne par l'API des enregistrements : { status }.
export const patchRow = (run, table, id, fields) => call(run.page, 'PATCH', `/api/docs/${run.docId}/tables/${table}/records`, { records: [{ id, fields }] });
