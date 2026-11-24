// Le souvenir d'un document lourd (24/11, choix du porteur : « Liste plus vite au démarrage »). L'explorateur ne sait qu'après avoir lu ses fichiers en entier
// si le document est lourd (js/explorer/explorer-sql.js) : sur 42 Mo, cette première lecture prend 3 s à chaque ouverture de la page. Quand une visite
// précédente a vu le document lourd, la page le sait d'avance et lit d'emblée en lecture légère (0,9 s) ; les tables ne se lisent pas pour autant en entier
// derrière la liste : l'app qui s'ouvre lit la sienne (24/11 soir : cette lecture en fond a été retirée, voir js/broker/table-cache.js).
//
// Ce qui se garde : un seul nombre par document lourd (son poids en octets), sur le navigateur de GFS, sous la clé `gfs.heavy.<identifiant du document>`. Aucun
// contenu, aucun nom : l'identifiant du document est celui que Grist donne à la page. Rien n'est jamais obligatoire : sans souvenir (premier passage,
// navigateur qui refuse de garder, Grist qui tarde à dire le nom du document), la première lecture se fait en entier, comme avant. Un souvenir faux (le
// document est redevenu léger) coûte une lecture légère de 0,15 s, puis il s'efface. Ce nombre ne choisit que la manière de lire ; il ne charge rien et n'ouvre
// rien.

import { HEAVY_BYTES } from './explorer-sql.js';

export const HINT_PREFIX = 'gfs.heavy.';
const ID = /^[A-Za-z0-9_~-]{1,64}$/;
const BYTES = /^\d{1,13}$/;
// Le nom du document vient de Grist : la liste des fichiers ne l'attend jamais plus longtemps (un serveur lent, ou qui ne répond pas, ne l'arrête pas).
export const DOC_ID_WAIT_MS = 1500;

// `docId()` : l'identifiant du document (promesse), `store(clé)` : { read(), write(valeur | null) } sur le navigateur (js/shell/stored-choice.js, `keyStore`),
// `threshold` : le poids à partir duquel un document est lourd, `wait` : le temps qu'on laisse à Grist pour dire l'identifiant.
export function createHeavyHint({ docId, store, threshold = HEAVY_BYTES, wait = DOC_ID_WAIT_MS }) {
  let slot = null; // le souvenir de ce document : { read, write }, ou null (identifiant inconnu ou inutilisable)
  let asked = null;
  const remembered = () => {
    const text = slot ? slot.read() : null;
    return typeof text === 'string' && BYTES.test(text) && Number(text) >= threshold ? Number(text) : null;
  };
  const find = async () => {
    let timer = null;
    try {
      const late = new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error('identifiant trop long à venir')), wait); });
      const id = String(await Promise.race([docId(), late]));
      slot = ID.test(id) ? store(`${HINT_PREFIX}${id}`) : null;
    } catch (error) { slot = null; } finally { clearTimeout(timer); }
  };
  return {
    // Le document était-il lourd à la dernière visite ? Alors la lecture légère `reader` (js/explorer/explorer-sql.js) est prête d'emblée. Une seule fois par
    // page ; ne lève jamais. Rend le poids qu'on se rappelle, ou null.
    async prime(reader) {
      asked = asked || find();
      await asked;
      const bytes = remembered();
      if (bytes !== null && reader) reader.learn(bytes);
      return bytes;
    },
    // Ce que la lecture vient de compter (`bytes`, pour tous les fichiers du document) : un document lourd se retient, un document redevenu léger s'oublie.
    // Rien ne s'écrit tant que le souvenir est juste.
    note(bytes) {
      if (!slot || !Number.isFinite(bytes)) return;
      const known = remembered();
      if (bytes >= threshold) { if (known === null) slot.write(String(Math.round(bytes))); } else if (known !== null || slot.read() !== null) slot.write(null);
    },
  };
}
