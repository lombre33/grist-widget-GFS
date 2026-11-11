// Le cadre d'envoi de GFS (voir js/broker/transfer.js) : il attend de GFS un port privé, puis fait les requêtes que GFS lui envoie par ce port et en rend le
// résultat. Script classique : un module de ce cadre isolé demanderait une autorisation d'origine (CORS) à la page qui le sert.
//
// Les requêtes :
//   { id, op: 'upload', url, file, name }  POST multipart (champ `upload`) vers la liste des pièces jointes -> { id, ok: true, value: <numéro de la pièce
//                                          jointe> }
//   { id, op: 'download', url }            GET d'une pièce jointe -> { id, ok: true, value: <Blob> }
//   { id, op: 'status', url }              GET dont seul le code compte (la preuve de propriétaire, contrats 5.2 point 8) -> { id, ok: true, value: <code> } ;
//                                          le corps de la réponse n'est jamais lu
//   { id, op: 'json', url }                GET d'une lecture SQL du document (`/sql`, le poids exact, contrats 6.6 point 14) -> { id, ok: true, value: <le JSON
//                                          de la réponse> }
//   { id, op: 'rest', url, method, json? } GET, POST, PATCH ou DELETE d'une requête REST du serveur (le moteur de partage : webhooks, envois de lignes, lecture
//   publique ; contrats 6.6 point 15), sans cookie ;
//                                          avec `json`, le corps est ce JSON (Content-Type) -> { id, ok: true, value: { status, body } }, `body` : le JSON de
//                                          la réponse, sinon son texte ('' si vide)
// Un échec rend { id, ok: false, network, status, message } : `network` quand le serveur n'a pas répondu (ou que le navigateur a refusé la requête), `status`
// quand il a répondu un refus.
//
// Sur l'en-tête X-Requested-With : sans lui, Grist refuse toute écriture faite avec un jeton par un 401 sans en-têtes CORS, et le navigateur ne dit que
// « NetworkError » (faits vérifiés 14).
(function () {
  'use strict';

  var ERROR_TEXT_MAX = 200;

  // Le texte d'un refus du serveur : le champ `error` de sa réponse JSON, sinon le début du texte.
  function refusal(response, text) {
    var message = '';
    try { message = JSON.parse(text).error || ''; } catch (error) { message = ''; }
    return String(message || text || response.statusText || '').replace(/\s+/g, ' ').slice(0, ERROR_TEXT_MAX);
  }

  // Une requête qui n'aboutit pas lève une TypeError (Chromium : « Failed to fetch », Firefox : « NetworkError when attempting to fetch resource ») ; toute
  // autre erreur vient d'une réponse mal formée.
  function failure(id, error) {
    return { id: id, ok: false, network: error instanceof TypeError, status: 0, message: String((error && error.message) || error) };
  }

  async function answer(response, id, read) {
    if (!response.ok) return { id: id, ok: false, network: false, status: response.status,
      message: refusal(response, await response.text().catch(function () { return ''; })) };
    return { id: id, ok: true, value: await read(response) };
  }

  async function upload(request) {
    var form = new FormData();
    form.append('upload', request.file, request.name);
    var response = await fetch(request.url, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' }, body: form });
    return answer(response, request.id, async function (reply) {
      var ids = JSON.parse(await reply.text());
      if (!Array.isArray(ids) || ids.length !== 1 || !Number.isInteger(ids[0])) throw new Error('La réponse du serveur n’est pas un numéro de pièce jointe.');
      return ids[0];
    });
  }

  async function download(request) {
    var response = await fetch(request.url);
    return answer(response, request.id, function (reply) { return reply.blob(); });
  }

  async function status(request) {
    var response = await fetch(request.url);
    return answer(response, request.id, function (reply) { return reply.status; });
  }

  // Une lecture SQL (`GET /sql?q=…`) : la réponse est du JSON ({ statement, records: [{ fields }] }), rendue telle quelle ; une réponse qui n'en est pas est un
  // échec (« answer »).
  async function json(request) {
    var response = await fetch(request.url);
    return answer(response, request.id, async function (reply) { return JSON.parse(await reply.text()); });
  }

  // Une requête REST quelconque, dont l'adresse (jeton compris, ou sans jeton pour une lecture publique et un envoi anonyme) est celle que GFS a bâtie : jamais
  // de cookie, et l'en-tête X-Requested-With sur tout ce qui n'est pas une lecture (sans lui Grist refuse en 401 sans en-têtes CORS : faits vérifiés 14).
  var REST_METHODS = { GET: true, POST: true, PATCH: true, DELETE: true };
  async function rest(request) {
    var method = String(request.method || 'GET').toUpperCase();
    if (!Object.prototype.hasOwnProperty.call(REST_METHODS, method)) return { id: request.id, ok: false, network: false, status: 0,
      message: 'Méthode refusée.' };
    var headers = {};
    var options = { method: method, credentials: 'omit', headers: headers };
    if (method !== 'GET') headers['X-Requested-With'] = 'XMLHttpRequest';
    if (request.json !== undefined) { headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(request.json); }
    var response = await fetch(request.url, options);
    return answer(response, request.id, async function (reply) {
      var text = await reply.text();
      var body = text;
      try { body = text ? JSON.parse(text) : ''; } catch (error) { body = text; }
      return { status: reply.status, body: body };
    });
  }

  var OPERATIONS = { upload: upload, download: download, status: status, json: json, rest: rest };

  async function handle(request, port) {
    var operation = request && Object.prototype.hasOwnProperty.call(OPERATIONS, request.op) ? OPERATIONS[request.op] : null;
    if (!operation) { port.postMessage({ id: request && request.id, ok: false, network: false, status: 0, message: 'Opération inconnue.' }); return; }
    var reply;
    try { reply = await operation(request); } catch (error) { reply = failure(request.id, error); }
    port.postMessage(reply);
  }

  // Seule la page qui contient ce cadre peut lui donner le port ; une fois reçu, plus rien d'autre n'est écouté.
  window.addEventListener('message', function onMessage(event) {
    if (event.source !== window.parent || !event.data || event.data.gfs !== 'transfer' || !event.ports || !event.ports[0]) return;
    window.removeEventListener('message', onMessage);
    var port = event.ports[0];
    port.onmessage = function (message) { void handle(message.data, port); };
    port.postMessage({ ready: true });
  });
}());
