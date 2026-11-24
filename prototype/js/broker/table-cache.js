// La copie d'une table lourde que l'explorateur vient de lire, rendue à l'app qu'il ouvre ensuite (étude du 23/11, choix du porteur : « Essayons le A »). Sur
// un document lourd (16 Mo de fichiers), l'explorateur lit la table de l'app en entier, puis l'app ouverte la lit une seconde fois : 0,8 s de plus avant
// qu'elle ne montre ses fichiers. Ici la première lecture sert la seconde, à une condition : que le document n'ait pas bougé entre-temps.
//
// Le garde-fou : l'empreinte de l'état du document (`GET /states`, le dernier : elle change à CHAQUE écriture, d'où qu'elle vienne : une autre personne, un
// autre onglet, l'app elle-même). Elle est prise AVANT la lecture (jamais après : une écriture qui tomberait pendant la lecture donnerait une copie plus neuve
// que son empreinte, qui serait alors fausse ; prise avant, elle ne peut que se trouver trop vieille, et la copie est refusée). À la demande de l'app,
// l'empreinte d'aujourd'hui est prise et comparée : la même, la copie est rendue ; sinon, ou sans réponse du serveur, la table se relit comme avant. Une copie
// ne sert qu'une fois, ne vit que deux minutes, et s'en va à la première écriture que GFS fait ou relaie.
//
// Seules les tables de fichiers que l'explorateur a lues en entier d'un document lourd se gardent, une seule fois par ouverture de la page (la première
// lecture) : un document léger ne paie ni cadre d'envoi ni jeton de plus. Rien ne se garde dans le navigateur : la copie vit autant que la page, en mémoire.
//
// Un document connu lourd d'une visite précédente se liste en lecture légère (js/explorer/heavy-hint.js) : il n'y a alors rien à garder, et rien ne se lit en
// entier derrière la liste. Cette lecture en fond (`fill`, 24/11) a été retirée le soir même : elle retardait la demande de jeton de l'app qui s'ouvrait (Grist
// rend sa réponse après les 42 Mo qui la précèdent) et chargeait le serveur à chaque rafraîchissement de la page. Une copie qui n'a pas servi s'en va au bout
// de deux minutes, avec la mémoire qu'elle tient.

const TTL_MS = 2 * 60 * 1000;
const MARK_TIMEOUT_MS = 1500; // l'explorateur n'attend jamais plus longtemps l'empreinte d'avant sa lecture
// Au-delà, la copie pèserait trop en mémoire pour ce qu'elle fait gagner : elle ne se garde pas.
export const KEEP_MAX_BYTES = 48 * 1024 * 1024;

const keyOf = tableId => String(tableId).toLowerCase();

export class TableCache {
  #head;
  #now;
  #entries = new Map(); // identifiant de table en minuscules -> { data (la table), head, at }
  #marked = false;

  // opts : { head() -> Promise<texte | null> : l'empreinte de l'état du document (null quand le serveur ne la rend pas), now?() -> millisecondes }
  constructor({ head, now = () => Date.now() }) {
    this.#head = head;
    this.#now = now;
  }

  get size() { return this.#entries.size; }

  // Les interfaces du document (`GristDocAPI`) avec la copie devant `fetchTable` et l'oubli derrière `applyUserActions` ; tout le reste passe tel quel.
  wrap(doc) {
    const cache = this;
    return new Proxy(doc, {
      get(target, key) {
        const value = target[key];
        if (typeof value !== 'function') return value;
        if (key === 'fetchTable') return async tableId => (await cache.#take(tableId)) ?? value.call(target, tableId);
        if (key === 'applyUserActions') return (...args) => { cache.invalidate(); return value.apply(target, args); };
        return value.bind(target);
      },
    });
  }

  // Avant la première lecture complète des fichiers de la page : lance la prise de l'empreinte. Rend une promesse (l'empreinte, ou null quand elle ne vient pas
  // à temps), à attendre AVANT de lancer les lectures de tables, ou null : ce n'est plus la première lecture.
  mark() {
    if (this.#marked) return null;
    this.#marked = true;
    return new Promise(resolve => {
      const timer = setTimeout(() => resolve(null), MARK_TIMEOUT_MS);
      Promise.resolve().then(() => this.#head()).then(head => head || null, () => null).then(head => { clearTimeout(timer); resolve(head); });
    });
  }

  // Garde les tables que la lecture vient de rendre : `tables` [{ id, data }] pesant `bytes` en tout, avec l'empreinte `head` prise avant elle (`mark`). Sans
  // empreinte, ou trop lourdes pour la mémoire, rien.
  keep(head, tables, bytes) {
    if (!head || bytes > KEEP_MAX_BYTES) return;
    for (const { id, data } of tables) this.#set(id, data, head);
  }

  // Une copie ; elle s'en va d'elle-même au bout de TTL_MS si personne ne l'a prise.
  #set(id, data, head) {
    const key = keyOf(id);
    const entry = { data, head, at: this.#now() };
    this.#entries.set(key, entry);
    const timer = setTimeout(() => { if (this.#entries.get(key) === entry) this.#entries.delete(key); }, TTL_MS);
    if (timer && typeof timer.unref === 'function') timer.unref();
  }

  // Une écriture : l'empreinte a changé, aucune copie ne vaut plus.
  invalidate() { this.#entries.clear(); }

  // La copie de la table, si le document est resté tel qu'il était à sa lecture ; sinon rien (l'appelant lit). Une copie ne sert qu'une fois.
  async #take(tableId) {
    const key = keyOf(tableId);
    const entry = this.#entries.get(key);
    if (!entry) return null;
    this.#entries.delete(key);
    if (this.#now() - entry.at > TTL_MS) return null;
    const current = await Promise.resolve().then(() => this.#head()).catch(() => null);
    return current && current === entry.head ? entry.data : null;
  }
}
