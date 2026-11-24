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
// Un document connu lourd d'une visite précédente se liste en lecture légère, sans lire ces tables : leur lecture complète (`fill`) part alors derrière la
// liste, et l'app qui demande la table pendant qu'elle se lit attend cette lecture au lieu d'en lancer une seconde (24/11, choix du porteur : « Liste plus vite
// au démarrage »). Une copie qui n'a pas servi s'en va au bout de deux minutes, avec la mémoire qu'elle tient.

const TTL_MS = 2 * 60 * 1000;
const MARK_TIMEOUT_MS = 1500; // l'explorateur n'attend jamais plus longtemps l'empreinte d'avant sa lecture
// Au-delà, la copie pèserait trop en mémoire pour ce qu'elle fait gagner : elle ne se garde pas.
export const KEEP_MAX_BYTES = 48 * 1024 * 1024;

const keyOf = tableId => String(tableId).toLowerCase();

export class TableCache {
  #head;
  #now;
  #entries = new Map(); // identifiant de table en minuscules -> { data (la table, ou la promesse de sa lecture), head, at }
  #marked = false;
  #doc = null; // le document sans la copie : `fill` lit par lui, jamais par la copie qu'il remplit

  // opts : { head() -> Promise<texte | null> : l'empreinte de l'état du document (null quand le serveur ne la rend pas), now?() -> millisecondes }
  constructor({ head, now = () => Date.now() }) {
    this.#head = head;
    this.#now = now;
  }

  get size() { return this.#entries.size; }

  // Les interfaces du document (`GristDocAPI`) avec la copie devant `fetchTable` et l'oubli derrière `applyUserActions` ; tout le reste passe tel quel.
  wrap(doc) {
    const cache = this;
    this.#doc = doc;
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

  // Lit en entier, derrière la liste, les tables `ids` que la lecture légère n'a pas lues en entier : même empreinte `head` (prise avant), même limite de
  // poids `bytes`. Une lecture qui échoue ne garde rien : l'app lit elle-même. Rend la promesse de toutes ces lectures (les essais l'attendent).
  fill(head, ids, bytes) {
    if (!head || bytes > KEEP_MAX_BYTES || !this.#doc) return Promise.resolve();
    const seen = new Set();
    const reads = [];
    for (const id of ids) {
      if (seen.has(keyOf(id))) continue;
      seen.add(keyOf(id));
      const read = this.#load(id);
      this.#set(id, read, head);
      reads.push(read);
    }
    return Promise.all(reads).then(() => undefined);
  }

  // La table lue par le document lui-même (`fetchTable` part tout de suite) ; null quand la lecture échoue : l'app lira elle-même.
  async #load(id) {
    try { return (await this.#doc.fetchTable(id)) || null; } catch (error) { return null; }
  }

  // Une copie, ou la lecture qui la fera ; elle s'en va d'elle-même au bout de TTL_MS si personne ne l'a prise.
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
    // l'empreinte d'aujourd'hui se prend pendant que la table finit de se lire, quand elle se lit encore
    const [current, data] = await Promise.all([Promise.resolve().then(() => this.#head()).catch(() => null), entry.data]);
    return current && current === entry.head ? data : null;
  }
}
