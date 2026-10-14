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

export class EnvelopePeer {
  #send;
  #handlers;
  #closed = false;

  // send(msg) : poste un message à l'app. handlers : { nom: async (args) => données } ; un nom absent reçoit GFS_INCONNU (5.1, point 3).
  constructor({ send, handlers }) {
    this.#send = send;
    this.#handlers = handlers;
  }

  // Un message venu de l'app, déjà attribué à son cadre par le routeur.
  receive(msg) {
    if (this.#closed || !isEnvelope(msg) || msg.gfs !== ENVELOPE) return;
    if (msg.type === 'appel') void this.#call(msg);
  }

  // Un événement vers l'app (`extensions`) : elle le reçoit sans l'avoir demandé.
  event(nom, data) { this.#out({ gfs: ENVELOPE, type: 'evenement', nom, data }); }

  close() { this.#closed = true; }

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
