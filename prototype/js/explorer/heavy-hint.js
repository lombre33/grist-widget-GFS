// Le souvenir du poids d'un document (24/11, choix du porteur : « Liste plus vite au démarrage » ; 25/11 : « la liste légère dès la première visite »).
// L'explorateur lit ses fichiers en lecture légère tant qu'il ne sait rien du document, et tant qu'il le sait lourd (js/explorer/explorer-sql.js) ; un
// document léger se lit plus vite en entier (ni cadre d'envoi ni jeton). Ce que la dernière visite a compté dit d'avance laquelle des deux lectures prendre :
// lourd, la lecture légère (0,9 s au lieu de 3 s sur 42 Mo) ; léger, la lecture complète ; rien, la lecture légère, qui compte le poids sans lire le contenu.
// Les tables ne se lisent jamais en entier derrière la liste : l'app qui s'ouvre lit la sienne (la copie gardée pour l'app a été retirée le 25/11, fait 157).
//
// Ce qui se garde : un seul nombre par document (le poids de ses fichiers en octets, à la dernière visite), sur le navigateur de GFS, sous la clé
// `gfs.heavy.<identifiant du document>` (le nom de la clé date du temps où seuls les documents lourds se retenaient ; il reste, pour les souvenirs déjà
// posés). Aucun contenu, aucun nom : l'identifiant du document est celui que Grist donne à la page. Rien n'est jamais obligatoire : sans souvenir (premier
// passage, navigateur qui refuse de garder, Grist qui tarde à dire le nom du document), la lecture légère sert d'abord. Un souvenir devenu faux coûte une
// lecture de l'autre sorte, puis il se corrige. Ce nombre ne choisit que la manière de lire ; il ne charge rien et n'ouvre rien.

import { HEAVY_BYTES } from './explorer-sql.js';
import { docKey, DOC_ID_WAIT_MS } from './doc-key.js';

export { DOC_ID_WAIT_MS };
export const HINT_PREFIX = 'gfs.heavy.';
const BYTES = /^\d{1,13}$/;

// `docId()` : l'identifiant du document (promesse), `store(clé)` : { read(), write(valeur | null) } sur le navigateur (js/shell/stored-choice.js, `keyStore`),
// `threshold` : le poids à partir duquel un document est lourd, `wait` : le temps qu'on laisse à Grist pour dire l'identifiant.
export function createHeavyHint({ docId, store, threshold = HEAVY_BYTES, wait = DOC_ID_WAIT_MS }) {
  let slot = null; // le souvenir de ce document : { read, write }, ou null (identifiant inconnu ou inutilisable)
  let asked = null;
  const key = docKey(docId, wait);
  const remembered = () => {
    const text = slot ? slot.read() : null;
    return typeof text === 'string' && BYTES.test(text) ? Number(text) : null;
  };
  const find = async () => {
    const id = await key();
    slot = id ? store(`${HINT_PREFIX}${id}`) : null;
  };
  return {
    // Ce que le document pesait à la dernière visite est dit à la lecture légère `reader` (js/explorer/explorer-sql.js) : lourd, elle sert d'emblée ; léger,
    // elle laisse la place à la lecture complète ; sans souvenir, elle sert d'abord. Une seule fois par page ; ne lève jamais. Rend le poids, ou null.
    async prime(reader) {
      asked = asked || find();
      await asked;
      const bytes = remembered();
      if (bytes !== null && reader) reader.learn(bytes);
      return bytes;
    },
    // Ce que la lecture vient de compter (`bytes`, pour tous les fichiers du document) se retient. Rien ne s'écrit tant que le souvenir dit encore vrai :
    // lourd ou léger, pas le nombre à l'octet près.
    note(bytes) {
      if (!slot || !Number.isFinite(bytes) || bytes < 0) return;
      const known = remembered();
      if (known === null || (known >= threshold) !== (bytes >= threshold)) slot.write(String(Math.round(bytes)));
    },
  };
}
