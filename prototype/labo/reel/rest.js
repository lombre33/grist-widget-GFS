// Les requêtes REST de Grist par jeton (cahier 9, point 6 ; contrats 9, point 5) : jouées par la page de la sonde (origine de son site, comme les apps d'aujourd'hui sur
// github.io) puis par son sous-cadre isolé (origine opaque, comme une app sous GFS). Un seul code, deux origines. Script classique : un sous-cadre sans
// `allow-same-origin` le charge sans en-tête CORS. Aucune réponse ne rend le jeton : seuls des états, des nombres et des noms sortent d'ici.
(function () {
  'use strict';
  const describe = error => `${(error && error.name) || 'Error'} : ${String((error && error.message) || error).slice(0, 110)}`;

  // La liste des tables internes du document, par SQL (Grist 1.1.9 et suivantes) : celles que GFS interdit d'écrire (contrats 3.3, point 6) y sont à relire.
  const SQL_INTERNES = "select name from sqlite_master where type = 'table' and name like '\\_grist\\_%' escape '\\' order by name";

  async function get(url, options) {
    try {
      const response = await fetch(url, options);
      return { response, statut: response.status };
    } catch (error) {
      return { erreur: describe(error) };
    }
  }
  // La réponse lue comme du JSON : { statut, data } si elle est bonne, { statut, message } sinon (Grist met la raison dans `error`), { erreur } si le navigateur a refusé.
  async function json(url, options) {
    const got = await get(url, options);
    if (got.erreur) return got;
    const text = await got.response.text().catch(() => '');
    let data;
    try { data = JSON.parse(text); } catch (error) { data = undefined; }
    if (got.response.ok && data !== undefined) return { statut: got.statut, data };
    return { statut: got.statut, message: String((data && data.error) || text || 'réponse vide').slice(0, 80) };
  }
  const sansDonnees = ({ statut, erreur, message }) => ({ statut, ...(erreur ? { erreur } : {}), ...(message ? { message } : {}) });

  // Une question à Grist, rangée sous son nom : { statut, …résumé de la réponse } si elle est bonne, sinon { statut, message } ou { erreur }. Rend la réponse entière.
  async function ask(out, label, url, options, summarize) {
    const answer = await json(url, options);
    out[label] = answer.data ? { statut: answer.statut, ...summarize(answer.data) } : sansDonnees(answer);
    return answer;
  }
  const count = (data, key) => (data[key] || []).length;

  async function downloadFirst(out, baseUrl, auth, id) {
    const download = await get(`${baseUrl}/attachments/${id}/download?${auth}`);
    out['téléchargement d\'une pièce jointe'] = download.erreur ? download : { statut: download.statut, octets: (await download.response.blob()).size, type: download.response.headers.get('content-type') };
  }

  // { baseUrl, token } : ce que rend `getAccessToken`. Rend un objet d'essais, un par question posée à Grist.
  async function battery({ baseUrl, token }) {
    const auth = `auth=${encodeURIComponent(token)}`;
    const out = {};
    const tables = await ask(out, 'tables, jeton dans l\'adresse', `${baseUrl}/tables?${auth}`, undefined, data => ({ tables: count(data, 'tables') }));
    await ask(out, 'tables, jeton dans l\'en-tête Authorization', `${baseUrl}/tables`, { headers: { Authorization: `Bearer ${token}` } }, data => ({ tables: count(data, 'tables') }));
    const first = tables.data && (tables.data.tables || [])[0];
    if (first) await ask(out, 'lignes de la première table', `${baseUrl}/tables/${encodeURIComponent(first.id)}/records?limit=1&${auth}`, undefined, data => ({ lignes: count(data, 'records') }));
    await ask(out, 'tables internes (SQL)', `${baseUrl}/sql?q=${encodeURIComponent(SQL_INTERNES)}&${auth}`, undefined, data => ({ tables: (data.records || []).map(record => record.fields.name) }));
    const files = await ask(out, 'pièces jointes', `${baseUrl}/attachments?${auth}`, undefined, data => ({ nombre: count(data, 'records') }));
    const records = files.data && files.data.records;
    if (records && records.length) await downloadFirst(out, baseUrl, auth, records[0].id);
    return out;
  }

  window.GFSRest = { battery, describe };
}());
