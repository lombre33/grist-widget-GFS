// Les messages propres à GFS (contrats 4.4 et 5.1) : une enveloppe `{ gfs, type, … }`, sans `mtype` : le script d'API de Grist les ignore, dans
// GFS comme dans l'app. Ils passent par le même canal que la conversation du protocole des widgets, mais jamais par la même file : une réponse
// `contexte` ne doit pas attendre le `ready` de l'app (l'app peut demander son contexte avant de le dire).
// Le numéro est celui du contrat de GFS ; un message d'un autre numéro est ignoré (5.1, point 1).

import { ERR, Refus } from './filter.js';
import { CONTRACT } from './manifest.js';

export const ENVELOPE = CONTRACT;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// Un message d'enveloppe : un objet à numéro entier, sans `mtype`.
export const isEnvelope = msg => isObject(msg) && Number.isInteger(msg.gfs) && msg.mtype === undefined;

const inactive = () => new Refus(ERR.INACTIF, `L'app n'est plus active.`);

export class EnvelopePeer {
  #send;
  #handlers;
  #closed = false;
  #nextId = 1;
  #waiting = new Map();

  // send(msg) : poste un message à l'app. handlers : { nom: async (args) => données } ; un nom absent reçoit GFS_INCONNU (5.1, point 3).
  constructor({ send, handlers }) {
    this.#send = send;
    this.#handlers = handlers;
  }

  // Un message venu de l'app, déjà attribué à son cadre par le routeur : un appel, ou la réponse à un appel de GFS (`call`).
  receive(msg) {
    if (this.#closed || !isEnvelope(msg) || msg.gfs !== ENVELOPE) return;
    if (msg.type === 'appel') void this.#call(msg);
    else if (msg.type === 'reponse' || msg.type === 'erreur') this.#answered(msg);
  }

  // Un appel de GFS à l'app (`ouvrir`, `fermer` : contrats 5.1). Les ids sont ceux de GFS, à partir de 1, sans rapport avec ceux de l'app. La promesse attend la
  // réponse, sans délai (la personne répond à l'app quand elle veut) ; une erreur de l'app la rejette avec son code ; elle est rejetée aussi si l'app se ferme avant.
  call(nom, args) {
    if (this.#closed) return Promise.reject(inactive());
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      this.#waiting.set(id, { resolve, reject });
      this.#out({ gfs: ENVELOPE, type: 'appel', id, nom, args: isObject(args) ? args : {} });
    });
  }

  // Une réponse que personne n'attend (un id inconnu, déjà répondu) est ignorée.
  #answered({ id, type, data, code, message }) {
    const waiting = this.#waiting.get(id);
    if (!waiting) return;
    this.#waiting.delete(id);
    if (type === 'reponse') waiting.resolve(data === undefined ? null : data);
    else waiting.reject(Object.assign(new Error(String(message || 'Erreur')), { code: typeof code === 'string' ? code : 'GFS_ERREUR' }));
  }

  // Un événement vers l'app (`extensions`) : elle le reçoit sans l'avoir demandé.
  event(nom, data) { this.#out({ gfs: ENVELOPE, type: 'evenement', nom, data }); }

  close() {
    this.#closed = true;
    for (const waiting of this.#waiting.values()) waiting.reject(inactive());
    this.#waiting.clear();
  }

  async #call({ id, nom, args }) {
    const answers = Number.isInteger(id) && id >= 1; // un appel sans `id` n'attend pas de réponse (5.1, point 2)
    try {
      if (typeof nom !== 'string' || !Object.hasOwn(this.#handlers, nom)) throw new Refus(ERR.INCONNU, `L'appel « ${nom} » est inconnu de GFS.`);
      const data = await this.#handlers[nom](isObject(args) ? args : {});
      if (answers) this.#out({ gfs: ENVELOPE, type: 'reponse', id, data: data === undefined ? null : data });
    } catch (error) {
      if (answers) this.#out({ gfs: ENVELOPE, type: 'erreur', id, code: (error && error.code) || 'GFS_ERREUR', message: String((error && error.message) || 'Erreur') });
    }
  }

  #out(msg) {
    if (this.#closed) return;
    try { this.#send(msg); } catch (error) { /* cadre disparu : la session le saura par close() */ }
  }
}
