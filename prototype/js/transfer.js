// Le cadre d'envoi (contrats 6.6) : l'envoi d'une pièce jointe à Grist et son téléchargement passent par l'API REST du serveur, avec un jeton d'accès (`getAccessToken`). La page de GFS ne
// peut pas faire ces requêtes (sa politique de sécurité ne laisse sortir que vers elle-même, et l'adresse du serveur n'est connue qu'à l'exécution) : un petit cadre de GFS, isolé
// (`sandbox` sans `allow-same-origin`, donc une origine opaque), les fait à sa place. Il n'a d'autre pouvoir que ce que GFS lui donne, requête par requête (une adresse portant son jeton),
// et il ne parle qu'à GFS, par un canal privé (`MessageChannel`) : aucun message de la page ne le traverse, le routeur de GFS (js/router.js) n'en voit aucun.
//
// Le jeton ne sort pas d'ici : il est demandé à Grist pour une requête, passe dans l'adresse envoyée au cadre, et n'est ni gardé ni écrit nulle part.

const FRAME_PAGE = 'transfer/index.html';
const READY_TIMEOUT_MS = 8000;
const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000;
const DOWNLOAD_TIMEOUT_MS = 3 * 60 * 1000;
const STATUS_TIMEOUT_MS = 10 * 1000;
const REST_TIMEOUT_MS = 60 * 1000; // un envoi de lignes (jusqu'à 250 ko) ou la liste des webhooks
const SQL_TIMEOUT_MS = 30 * 1000; // Grist coupe lui-même une lecture au bout d'une seconde (400) ; le reste est le cadre qui ne répond pas

// Pourquoi un transfert a échoué : `kind` vaut 'frame' (le cadre ne répond pas), 'token' (Grist n'a pas donné de jeton), 'network' (le serveur n'a pas répondu, ou le navigateur a refusé la
// requête), 'http' (le serveur a répondu un refus : `status`), 'timeout' (trop long) ou 'answer' (la réponse n'est pas celle qu'on attend).
export class TransferError extends Error {
  constructor(kind, message, status = 0) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

// Le cadre dans la page : caché, isolé, sans rien d'autre que `allow-scripts`. Rend { window, loaded, remove }.
export function buildTransferFrame(doc, url, container = doc.body) {
  const frame = doc.createElement('iframe');
  frame.className = 'transfer-frame';
  frame.hidden = true;
  frame.title = '';
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.setAttribute('sandbox', 'allow-scripts');
  const loaded = new Promise(resolve => frame.addEventListener('load', resolve, { once: true }));
  frame.src = url;
  container.append(frame);
  return { get window() { return frame.contentWindow; }, loaded, remove: () => frame.remove() };
}

export class Transfer {
  #opts;
  #frame = null;
  #port = null;
  #connecting = null;
  #server = '';
  #base = '';
  #calls = new Map();
  #next = 1;

  // opts : { doc (les interfaces de Grist : getAccessToken), base (l'adresse de GFS), createFrame(url) -> { window, loaded, remove }, channel() -> MessageChannel }
  constructor(opts) { this.#opts = { channel: () => new MessageChannel(), ...opts }; }

  // Envoie `file` (un objet File) à Grist ; rend le numéro de la pièce jointe, que la cellule d'une colonne Attachments citera (`['L', numéro]`). `name` : le nom que Grist garde.
  async upload(file, name) {
    const { token, baseUrl } = await this.#token(false);
    const reply = await this.#call('upload', { url: this.#url(baseUrl, '/attachments', token), file, name }, UPLOAD_TIMEOUT_MS);
    if (!Number.isInteger(reply.value)) throw new TransferError('answer', 'Grist n’a pas rendu le numéro de la pièce jointe.');
    return reply.value;
  }

  // Télécharge la pièce jointe `attachment` ; rend un Blob (le type que le serveur dit).
  async download(attachment) {
    const { token, baseUrl } = await this.#token(true);
    const reply = await this.#call('download', { url: this.#url(baseUrl, `/attachments/${encodeURIComponent(attachment)}/download`, token) }, DOWNLOAD_TIMEOUT_MS);
    return reply.value;
  }

  // Le propriétaire du document ? `GET /webhooks` n'est rendu qu'aux propriétaires, et avec un jeton qui peut écrire (mesuré le 04/11 sur Grist 1.7.19 : 200 pour un propriétaire, 403 « No owner access »
  // pour un éditeur et un lecteur, avec ou sans règle dans le document ; le jeton en lecture seule est refusé à tous). Rend true (200), false (le refus des propriétaires seuls) ou null (tout le reste :
  // pas de jeton, pas de réponse, une autre version de Grist qui répondrait autrement). Seul le code compte : le cadre ne lit jamais le corps, qui liste les webhooks du document.
  async isOwner() {
    try {
      const { token, baseUrl } = await this.#token(false);
      await this.#call('status', { url: this.#url(baseUrl, '/webhooks', token) }, STATUS_TIMEOUT_MS);
      return true;
    } catch (error) {
      return error instanceof TransferError && error.kind === 'http' && error.status === 403 && /owner/i.test(error.message) ? false : null;
    }
  }

  // Une lecture SQL du document (`GET /sql`, le poids exact, contrats 6.6 point 14). Grist ne rend `/sql` qu'à qui peut tout copier (un document sans règles d'accès, ou un propriétaire) et coupe une lecture de
  // plus d'une seconde (400, « a slow statement resulted in a database interrupt »). Le jeton est **en lecture seule**, sauf `writable` : dans un document à règles d'accès, Grist refuse `/sql` à un jeton en
  // lecture seule même au propriétaire, et ne le rend qu'au jeton qui peut écrire (mesuré, faits vérifiés 43) ; `js/weight-reader.js` (`escalating`) ne le demande qu'après ce refus. Rend les lignes,
  // `{ colonne: valeur }` ; un refus lève une TransferError 'http' (`status` 403 ou 400). `statement` : un seul `SELECT`, que le code de GFS écrit (jamais un texte lu d'ailleurs).
  async sql(statement, { writable = false } = {}) {
    const { token, baseUrl } = await this.#token(!writable);
    const reply = await this.#call('json', { url: this.#url(baseUrl, '/sql', token, { q: statement }) }, SQL_TIMEOUT_MS);
    const records = reply.value && reply.value.records;
    if (!Array.isArray(records)) throw new TransferError('answer', 'Grist n’a pas rendu de lignes pour cette lecture.');
    return records.map(record => (record && record.fields) || {});
  }

  // Une requête REST du document, avec un jeton (le moteur de partage : webhooks, `/compare`, pièces jointes…, contrats 6.6 point 15). `path` : ce qui suit l'adresse REST du document, que GFS écrit
  // (jamais un texte lu d'ailleurs) ; `body` : un objet, envoyé en JSON ; `timeout` : le délai en millisecondes (60 s par défaut) ; `writable` : le jeton peut écrire (par défaut : un propriétaire seul lit la liste des webhooks, avec lui). Rend `{ status, body }` ;
  // un refus du serveur lève une TransferError 'http' (`status`), un serveur muet une 'network'.
  async rest(method, path, { body, writable = true, params, timeout = REST_TIMEOUT_MS } = {}) {
    const { token, baseUrl } = await this.#token(!writable);
    this.#server = new URL(baseUrl).origin;
    const reply = await this.#call('rest', { method, url: this.#url(baseUrl, path, token, params), json: body }, timeout);
    return reply.value;
  }

  // L'adresse REST du document (`https://serveur[/o/équipe]/api/docs/<identifiant>`), sans jeton : Grist la donne avec tout jeton d'accès. Gardée une fois lue.
  async baseUrl() {
    if (!this.#base) {
      const { baseUrl } = await this.#token(true);
      this.#base = baseUrl.replace(/\/+$/, '');
      this.#server = new URL(baseUrl).origin;
    }
    return this.#base;
  }

  // Une requête sans jeton vers le serveur du document : la lecture d'un document public, l'envoi de lignes à l'adresse d'un formulaire publié. `url` est celle qu'un document a donnée ; elle n'est
  // suivie que si elle est du même serveur que le document (le lien d'une autre instance ne reçoit rien). Même rendu que `rest`.
  async anonymous(method, url, { body, timeout = REST_TIMEOUT_MS } = {}) {
    if (!this.#server) this.#server = new URL((await this.#token(true)).baseUrl).origin;
    let target;
    try { target = new URL(url); } catch (error) { throw new TransferError('answer', 'Cette adresse n’est pas valable.'); }
    if (target.origin !== this.#server) throw new TransferError('answer', 'Cette adresse n’est pas celle du serveur de ce document.');
    const reply = await this.#call('rest', { method, url: target.href, json: body }, timeout);
    return reply.value;
  }

  // Referme le cadre ; le suivant se rouvrira au prochain transfert.
  close() {
    if (this.#port) this.#port.close();
    if (this.#frame) this.#frame.remove();
    this.#port = null;
    this.#frame = null;
    this.#connecting = null;
    this.#fail(new TransferError('frame', 'Le cadre d’envoi a été refermé.'));
  }

  async #token(readOnly) {
    let given;
    try {
      given = await this.#opts.doc.getAccessToken({ readOnly });
    } catch (error) {
      throw new TransferError('token', `Grist n’a pas donné de jeton d’accès : ${String((error && error.message) || error)}`);
    }
    if (!given || typeof given.token !== 'string' || typeof given.baseUrl !== 'string') throw new TransferError('token', 'Grist n’a pas donné de jeton d’accès.');
    return given;
  }

  #url(baseUrl, path, token, params = {}) {
    const extra = Object.entries(params).map(([key, value]) => `&${key}=${encodeURIComponent(value)}`).join('');
    return `${baseUrl.replace(/\/+$/, '')}${path}?auth=${encodeURIComponent(token)}${extra}`;
  }

  // Une requête au cadre, et sa réponse (ou son échec). `file` passe tel quel : un objet File se copie d'un cadre à l'autre sans être relu en mémoire.
  async #call(op, fields, timeoutMs) {
    const port = await this.#connect();
    const id = this.#next++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.#calls.delete(id); reject(new TransferError('timeout', 'Le transfert est trop long.')); }, timeoutMs);
      this.#calls.set(id, { resolve, reject, timer });
      port.postMessage({ id, op, ...fields });
    });
  }

  // Le cadre s'ouvre à la première demande, et reste. La poignée de main : une fois chargé, il reçoit le port privé, et dit `ready` par lui.
  #connect() {
    if (this.#connecting) return this.#connecting;
    const attempt = this.#open();
    this.#connecting = attempt;
    attempt.catch(() => { if (this.#connecting === attempt) this.close(); });
    return attempt;
  }

  async #open() {
    const frame = this.#opts.createFrame(new URL(FRAME_PAGE, this.#opts.base).href);
    this.#frame = frame;
    await frame.loaded;
    const { port1, port2 } = this.#opts.channel();
    const ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new TransferError('frame', 'Le cadre d’envoi de GFS ne répond pas.')), READY_TIMEOUT_MS);
      port1.onmessage = event => {
        const reply = event.data || {};
        if (reply.ready === true) { clearTimeout(timer); resolve(); } else this.#answer(reply);
      };
    });
    // La cible est '*' : le cadre est un `sandbox` sans `allow-same-origin`, son origine est opaque, aucune adresse ne peut la désigner. Le message ne dit rien ; ce qui compte est le port transféré, et le cadre est celui que GFS vient de créer.
    frame.window.postMessage({ gfs: 'transfer' }, '*', [port2]);
    await ready;
    this.#port = port1;
    return port1;
  }

  #answer(data) {
    const call = this.#calls.get(data.id);
    if (!call) return;
    this.#calls.delete(data.id);
    clearTimeout(call.timer);
    if (data.ok) call.resolve(data);
    else call.reject(new TransferError(data.network ? 'network' : (data.status ? 'http' : 'answer'), String(data.message || 'Le transfert a échoué.'), Number(data.status) || 0));
  }

  #fail(error) {
    for (const [id, call] of this.#calls) {
      clearTimeout(call.timer);
      call.reject(error);
      this.#calls.delete(id);
    }
  }
}
