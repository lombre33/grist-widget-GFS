// Conversation avec une app : le côté « Grist » du protocole de grain-rpc 0.1.7 (contrats 1.1 et 4.2).
// Le courtier ne retransmet aucun message : il lit un appel, l'exécute lui-même (onCall) et répond par son propre message.
// Comme chez Grist, tout ce que GFS envoie à l'app, réponses comprises, attend le message `ready` de l'app.

export const MSG = Object.freeze({ CALL: 1, RESP: 2, ERR: 3, CUSTOM: 4, READY: 5 });
const GRIST_DEST = 'grist';

export class AppPeer {
  #send;
  #onCall;
  #onMessage;
  #onReady;
  #queue = [];
  #ready = false;
  #closed = false;
  #pending = new Map();
  #nextId = 1;

  // send(msg) : poste un message à l'app. onCall({ iface, meth, args }) : exécute un appel et rend son résultat (ou lève
  // une erreur portant `code`). onMessage(data) : message libre de l'app (mtype 4). onReady() : l'app a dit `ready`.
  constructor({ send, onCall, onMessage = () => {}, onReady = () => {} }) {
    this.#send = send;
    this.#onCall = onCall;
    this.#onMessage = onMessage;
    this.#onReady = onReady;
  }

  get isReady() { return this.#ready; }

  // Un message venu de l'app, déjà attribué à son cadre par le routeur. Un objet sans `mtype` connu est ignoré.
  receive(msg) {
    if (this.#closed || !msg || typeof msg !== 'object') return;
    switch (msg.mtype) {
      case MSG.CALL: void this.#handleCall(msg); break;
      case MSG.RESP:
      case MSG.ERR: this.#handleResponse(msg); break;
      case MSG.CUSTOM: if (!msg.mdest) this.#onMessage(msg.data); break;
      case MSG.READY: this.#markReady(); break;
      default: break;
    }
  }

  // Événement vers l'app : elle le reçoit par `grist.on('message')`.
  postMessage(data) { this.#out({ mtype: MSG.CUSTOM, data }); }

  // Appel d'une fonction que l'app a enregistrée (`print`, `editOptions`) : rend sa réponse. timeoutMs : 0 = sans délai.
  callApp(name, args = [], timeoutMs = 0) {
    return new Promise((resolve, reject) => {
      const reqId = this.#nextId++;
      const entry = { resolve, reject, timer: null };
      if (timeoutMs > 0) {
        entry.timer = setTimeout(() => {
          this.#pending.delete(reqId);
          reject(Object.assign(new Error(`Pas de réponse de l'app à ${name}`), { code: 'GFS_DELAI' }));
        }, timeoutMs);
      }
      this.#pending.set(reqId, entry);
      this.#out({ mtype: MSG.CALL, reqId, iface: name, meth: 'invoke', args });
    });
  }

  // Le cadre disparaît : les appels en attente sont rejetés, plus rien n'est envoyé ni reçu.
  close(reason = 'Cadre fermé') {
    this.#closed = true;
    this.#queue = [];
    for (const entry of this.#pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(Object.assign(new Error(reason), { code: 'GFS_ANNULE' }));
    }
    this.#pending.clear();
  }

  async #handleCall(call) {
    const { reqId } = call;
    if (reqId === undefined) return; // sans numéro d'appel : ni exécuté ni répondu, comme grain-rpc
    if (call.mdest && call.mdest !== GRIST_DEST) {
      this.#fail(reqId, 'RPC_UNKNOWN_FORWARD_DEST', `Unknown forward destination: ${call.mdest}`);
      return;
    }
    try {
      const args = Array.isArray(call.args) ? call.args : [];
      const data = await this.#onCall({ iface: call.iface, meth: call.meth, args });
      this.#out({ mtype: MSG.RESP, reqId, data });
    } catch (e) {
      this.#fail(reqId, e && e.code, e && e.message);
    }
  }

  #fail(reqId, code, mesg) {
    this.#out({ mtype: MSG.ERR, reqId, mesg: String(mesg ?? 'Erreur'), code: code || 'GFS_ERREUR' });
  }

  #handleResponse(msg) {
    const entry = this.#pending.get(msg.reqId);
    if (!entry) return;
    this.#pending.delete(msg.reqId);
    clearTimeout(entry.timer);
    if (msg.mtype === MSG.ERR) entry.reject(Object.assign(new Error(msg.mesg), { code: msg.code }));
    else entry.resolve(msg.data);
  }

  // Le premier `ready` libère ce qui attendait, dans l'ordre ; chaque `ready` appelle onReady, qui rejoue l'état à l'app. Comme Grist, qui redéclenche « ready » à chaque
  // message `ready` (`WidgetFrame._onMessage`, sources de grist-static 0.1.6) : un cadre qui se recharge sur place redit `ready` et retrouve réglages, thème et table.
  #markReady() {
    if (!this.#ready) {
      this.#ready = true;
      const queued = this.#queue;
      this.#queue = [];
      queued.forEach(msg => this.#deliver(msg));
    }
    this.#onReady();
  }

  #out(msg) {
    if (this.#closed) return;
    if (this.#ready) this.#deliver(msg);
    else this.#queue.push(msg);
  }

  #deliver(msg) {
    try { this.#send(msg); } catch (e) { /* cadre disparu : le routeur le saura par close() */ }
  }
}
