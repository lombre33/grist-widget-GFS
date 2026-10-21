// Le stockage des choix de chaque app (contrats 5.3) : un espace par app dans le `localStorage` de GFS, sous la clé `gfs.stockage.<id>.<clé>`. Le sous-cadre d'une app n'a aucun
// stockage (origine opaque) : l'app reçoit la copie de son espace dans `contexte.stockage` et écrit par l'appel `stockage.ecrire`. Le courtier range sous l'identifiant de la FENÊTRE
// qui écrit, jamais sous un champ du message : une app ne voit, ne change et ne vide que son espace. Ce n'est pas une écriture du document : cela marche en lecture seule, et
// le choix est celui du navigateur de la personne, le même dans tous ses documents. Un navigateur qui refuse de garder une clé (cadre sans stockage, quota du navigateur) n'arrête
// rien : la valeur vaut jusqu'au rechargement de la page, et la réponse (quand l'app a donné un `id`) dit `retenu: false`.

import { ERR, Refus } from './filter.js';
import { ID_RE } from './manifest.js';

// Un identifiant d'app n'a pas de point (manifeste, `ID_RE`) : `gfs.stockage.<id>.` ne se confond jamais avec l'espace d'une autre app (`form` et `form-plus`), et la clé, qui peut avoir des points, commence après le premier.
export const PREFIX = 'gfs.stockage.';
export const KEY_PATTERN = /^[A-Za-z0-9_.:-]{1,64}$/;
// 1 Mo par app : 1 048 576 caractères, clés comprises, ce que le navigateur compte lui-même (des unités UTF-16).
export const QUOTA = 1048576;

// Ce que le navigateur garde : lister les clés d'un préfixe, en écrire une, en retirer une. Un navigateur qui refuse n'arrête rien : la liste est vide, l'écriture et le retrait rendent `false`.
export function browserBackend(win = window) {
  return {
    list(prefix) {
      const found = [];
      try {
        const area = win.localStorage;
        for (let i = 0; i < area.length; i++) {
          const key = area.key(i);
          const value = key !== null && key.startsWith(prefix) ? area.getItem(key) : null;
          if (typeof value === 'string') found.push([key, value]);
        }
      } catch (error) { /* le navigateur refuse de lire : l'espace paraît vide */ }
      return found;
    },
    write(key, value) {
      try { win.localStorage.setItem(key, value); return true; } catch (error) { return false; }
    },
    remove(key) {
      try { win.localStorage.removeItem(key); return true; } catch (error) { return false; }
    },
  };
}

// `RegExp.test` met son argument en chaîne : `undefined` serait l'identifiant « undefined ».
const isAppId = id => typeof id === 'string' && ID_RE.test(id);
const sizeOf = space => { let total = 0; for (const [key, value] of space) total += key.length + value.length; return total; };

export class AppStorage {
  #backend;
  #quota;
  // id → (clé → valeur | null) : ce que le navigateur a refusé de garder (`null` : un retrait refusé). Il couvre ce que le navigateur garde, jusqu'au rechargement de la page.
  #refused = new Map();

  // backend : { list(préfixe) → [[clé complète, valeur]], write(clé complète, valeur) → retenu ?, remove(clé complète) → retenu ? }
  constructor({ backend, quota = QUOTA }) {
    this.#backend = backend;
    this.#quota = quota;
  }

  // L'espace de l'app tel qu'il est maintenant, `{ clé: valeur }` : relu à chaque appel (un autre onglet a pu écrire depuis le dernier). `Object.fromEntries` pose des propriétés propres,
  // donc une clé comme `__proto__` reste une clé.
  read(id) { return Object.fromEntries(this.#space(id)); }

  #space(id) {
    if (!isAppId(id)) return new Map();
    const prefix = `${PREFIX}${id}.`;
    const space = new Map(this.#backend.list(prefix).map(([full, value]) => [full.slice(prefix.length), value]));
    for (const [key, value] of this.#refused.get(id) || []) {
      if (value === null) space.delete(key);
      else space.set(key, value);
    }
    return space;
  }

  // Écrit une clé (`value` : une chaîne) ou la retire (`null`). Rend `{ retenu }`. Lève `GFS_REFUSE` pour un identifiant, une clé ou une valeur hors règle, `GFS_QUOTA` quand l'espace de l'app
  // dépasserait son quota (un remplacement qui ne l'agrandit pas passe toujours : une app au-dessus de son quota peut se vider).
  write(id, key, value) {
    if (!isAppId(id)) throw new Refus(ERR.REFUSE, `« ${id} » n'est pas un identifiant d'app.`);
    if (typeof key !== 'string' || !KEY_PATTERN.test(key)) throw new Refus(ERR.REFUSE, 'Une clé de stockage compte de 1 à 64 caractères parmi A-Z a-z 0-9 _ . : -.');
    if (value !== null && typeof value !== 'string') throw new Refus(ERR.REFUSE, 'Une valeur de stockage est une chaîne, ou null pour retirer la clé.');
    const full = `${PREFIX}${id}.${key}`;
    if (value === null) return { retenu: this.#settle(id, key, this.#backend.remove(full), null) };
    const space = this.#space(id);
    const before = sizeOf(space);
    const after = before - (space.has(key) ? key.length + space.get(key).length : 0) + key.length + value.length;
    if (after > this.#quota && after > before) throw new Refus(ERR.QUOTA, `L'espace de stockage de l'app est plein (${this.#quota} caractères au plus, clés comprises).`);
    return { retenu: this.#settle(id, key, this.#backend.write(full, value), value) };
  }

  // Le navigateur a gardé la clé : plus rien à couvrir. Il l'a refusée : elle vaut pour la page seulement.
  #settle(id, key, kept, value) {
    const refused = this.#refused.get(id) || new Map();
    if (kept) refused.delete(key);
    else refused.set(key, value);
    if (refused.size) this.#refused.set(id, refused);
    else this.#refused.delete(id);
    return kept;
  }
}

// Les appels de l'app à GFS pour le stockage (contrats 5.1) : `stockage.ecrire` `{ cle, valeur }`. L'espace est celui de la session, jamais celui qu'un message nommerait. Un refus se lit en console
// (l'auteur de l'app le voit) : sans `id`, l'app n'attend pas de réponse et n'aurait aucun autre moyen de l'apprendre.
export function storageHandlers(storage, id, warn = console.warn) {
  return {
    'stockage.ecrire': ({ cle, valeur }) => {
      try {
        return storage.write(id, cle, valeur);
      } catch (error) {
        warn(`GFS : ${id} : stockage.ecrire refusé (${error.code}) : ${error.message}`);
        throw error;
      }
    },
  };
}
