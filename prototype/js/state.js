// Ce que Grist a dit à GFS en dernier (contrats 4.1, point 2) : le dernier message de chaque sorte. Grist n'envoie l'état initial
// (réglages, thème, table) qu'au `ready` de GFS, pas à chaque app : GFS le garde pour le rejouer à l'app qui devient prête (4.2, point 2).

// Les quatre sortes de messages que le script d'API de Grist distingue dans `rpc.on('message')`.
export function classify(message) {
  if (!message || typeof message !== 'object') return null;
  if (message.settings) return 'options';
  if (message.theme) return 'theme';
  if (message.tableId && message.dataChange) return 'table';
  if (message.tableId) return 'record';
  return null;
}

export class GristState {
  options = null;
  theme = null;
  table = null;
  record = null;
  #listeners = new Set();
  #waiters = [];

  // Garde le message et prévient les abonnés : fn(kind, message).
  feed(message) {
    const kind = classify(message);
    if (!kind) return null;
    this[kind] = message;
    if (kind === 'options') this.#waiters.splice(0).forEach(resolve => resolve(message));
    for (const listener of this.#listeners) listener(kind, message);
    return kind;
  }

  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  // Les réglages de la section : le dernier objet complet que Grist a envoyé, ou null.
  get allOptions() { return this.options && this.options.options ? this.options.options : null; }

  // Le niveau d'accès que Grist a accordé à GFS lui-même.
  get grantedAccess() { return (this.options && this.options.settings && this.options.settings.accessLevel) || 'none'; }

  // Attend le premier message de réglages ; passé `ms`, rend ce qu'on a (ou null) plutôt que de bloquer le démarrage.
  whenOptions(ms = 4000) {
    if (this.options) return Promise.resolve(this.options);
    return new Promise(resolve => {
      this.#waiters.push(resolve);
      setTimeout(() => resolve(this.options), ms);
    });
  }
}
