// La mémoire des lectures SQL que le serveur refuse (25/11, retour du porteur sur la DINUM : « tout ça dans la console quand je recharge l'explorateur » ;
// faits vérifiés 173). Deux lectures de GFS passent par `GET /sql` avec le jeton en lecture seule, sans geste de la personne : le nombre de lignes d'une table
// que le document porte sous deux noms (js/apps/row-count.js) et les colonnes utiles des fichiers (js/explorer/explorer-sql.js). Un serveur peut les refuser de
// deux façons, et GFS ne les voit pas pareil :
//   - Grist lui-même, 403 avec ses en-têtes CORS : GFS lit le code (`denied`). Un document à règles d'accès refuse `/sql` au jeton en lecture seule, même à son
//   propriétaire (faits vérifiés 43) ;
//   - un pare-feu devant Grist, 403 sans en-tête CORS : le navigateur ne rend à GFS qu'une erreur de réseau (`network`), la même qu'un serveur éteint (faits
//   vérifiés 136, relevé de Sync+ le 18/11).
// Le navigateur écrit chaque requête refusée dans la console de la personne (« Cross-Origin Request Blocked », « 403 »), et GFS les refaisait toutes à chaque
// affichage de l'explorateur (deux comptes de lignes), puis à chaque rechargement de la page. Ici, le premier refus qui reste (celui du jeton qui peut écrire,
// ou une erreur de réseau) ferme la lecture légère pour la page : tout le reste lit comme avant (la table en entier), sans une requête de plus. Chaque refus se
// garde aussi sur l'onglet, un temps (`HOLD_MS`) : la page rechargée n'essaie pas tout de suite ce que le serveur vient de refuser.
//
// Rien ne se garde que « refusé » et une date, par document, sous `gfs.sql.<identifiant du document>` (`sessionStorage`, comme le garde-fou de
// js/explorer/read-guard.js) : ni requête, ni nom, ni contenu, jamais un jeton. Sans stockage ou sans identifiant, la mémoire ne vaut que pour la page. Une
//   lecture coupée par Grist (400) ne ferme rien : elle dit seulement que cette lecture-là est trop longue.
//
// Le jeton (choix du porteur, 25/11 soir, « Lecture rapide avec le jeton du poids » : un document à règles d'accès de 147 Mo se lisait en 20 s, en entier) :
// les lectures partent d'abord avec le jeton **en lecture seule**. Dans un document à règles d'accès, Grist le refuse même au propriétaire (403 lisible) et ne
// rend `/sql` qu'au jeton qui peut écrire, au propriétaire seul : un éditeur et un lecteur sont refusés des deux façons (mesuré, faits vérifiés 43). Ce premier
// refus fait donc passer la page au jeton qui peut écrire, et la lecture refusée repart avec lui, une fois. Un second refus (« writable » déjà employé) ferme
// la lecture. Le jeton qui peut écrire ne lit ici que des `SELECT` que GFS écrit (js/explorer/explorer-sql.js, js/apps/row-count.js), jamais un texte lu
// d'ailleurs ; il va au serveur du document, dans l'adresse de la requête (comme celui du poids, js/weight/weight-reader.js `escalating`), et n'est jamais
// donné à une app.

import { docKey } from '../explorer/doc-key.js';

export const GATE_PREFIX = 'gfs.sql.';
// Combien de temps un refus se retient sur l'onglet : un refus de Grist change rarement (les règles du document, le rôle de la personne) ; une erreur de
// réseau peut n'être qu'un serveur éteint un instant. Les autres échecs (délai dépassé, pas de jeton, réponse sans lignes) ne ferment que la page.
export const HOLD_MS = { writable: 30 * 60 * 1000, denied: 30 * 60 * 1000, network: 10 * 60 * 1000 };
const NOTE = /^(writable|denied|network):(\d{1,15})$/;

// Pourquoi une lecture est refusée : 'denied' (401, 403 de Grist), 'network' (aucune réponse lisible : serveur éteint, ou pare-feu sans en-tête CORS),
// 'slow' (400 : Grist a coupé cette lecture, elle seule) ou 'failed' (le reste : jeton, délai dépassé, réponse sans lignes).
export function reasonOf(error) {
  const kind = error && error.kind;
  if (kind === 'http') {
    if (error.status === 401 || error.status === 403) return 'denied';
    return error.status === 400 ? 'slow' : 'failed';
  }
  return kind === 'network' ? 'network' : 'failed';
}

// Ce que lève une lecture quand la mémoire la ferme : aucune requête n'est partie. `reason` : la raison du premier refus.
export class SqlClosedError extends Error {
  constructor(reason) {
    super('GFS ne lit plus ce document par SQL : le serveur vient de le refuser.');
    this.closed = true;
    this.reason = reason;
  }
}

// `sql(statement, writable)` rend les lignes (`Transfer.sql`, jeton en lecture seule sauf `writable`) ; `docId()` : l'identifiant du document (promesse) ;
// `store(clé)` : { read(), write(valeur | null) } sur l'onglet (js/shell/stored-choice.js, `keyStore`, `sessionStorage`), ou rien ; `now()` : l'heure en
//   millisecondes ; `hold` : voir HOLD_MS. Rend { read(statement), isClosed(), denied() }. `read` lève ce que `sql` lève, ou SqlClosedError sans rien envoyer.
//   Fermée, la lecture le reste jusqu'au rechargement de la page : la lecture légère éteinte ne se rallume pas d'elle-même. Une page de l'onglet qui a vu le
//   refus du jeton en lecture seule (`writable`, 30 minutes) fait partir celle-ci d'emblée avec le jeton qui peut écrire : la console ne reçoit plus le refus.
export function createSqlGate({ sql, docId, store = null, now = () => Date.now(), hold = HOLD_MS }) {
  const key = docKey(docId);
  let closed = null; // la raison du premier refus de la page, ou de celui qu'une page d'avant a laissé
  let writable = false; // Grist a refusé le jeton en lecture seule : les lectures partent avec celui qui peut écrire
  let slot = null;
  let loaded = null;

  // Ce qu'une page d'avant a laissé, lu une seule fois : un refus encore frais ferme la page (ou, pour `writable`, la fait passer au jeton qui peut écrire) ;
  // un refus périmé s'efface. Une date à venir (horloge changée) vaut maintenant.
  const find = async () => {
    const id = store ? await key() : null;
    slot = id ? store(`${GATE_PREFIX}${id}`) : null;
    const text = slot ? slot.read() : null;
    const [, reason, at] = (typeof text === 'string' && NOTE.exec(text)) || [];
    if (!reason) return;
    if (now() - Math.min(Number(at), now()) >= hold[reason]) slot.write(null);
    else if (reason === 'writable') writable = true;
    else closed = closed || reason;
  };
  const remember = reason => { if (slot && hold[reason]) slot.write(`${reason}:${now()}`); };
  const close = reason => {
    if (closed) return;
    closed = reason;
    remember(reason);
  };

  return {
    isClosed: () => closed !== null,
    // Vrai quand Grist a refusé le jeton en lecture seule (cette page, ou une page de l'onglet il y a moins de 30 minutes) : une lecture qui a besoin du jeton
    // qui peut écrire (la surveillance du poids, js/weight/weight-reader.js `escalating`) peut partir avec lui d'emblée, sans refaire la requête que la console
    // écrirait en rouge.
    async denied() {
      loaded = loaded || find();
      await loaded;
      return writable || closed === 'denied';
    },
    async read(statement) {
      loaded = loaded || find();
      await loaded;
      if (closed) throw new SqlClosedError(closed);
      const used = writable; // le jeton de CETTE requête : une autre, partie en même temps, a pu faire passer la page au jeton qui peut écrire entre-temps
      try {
        return await sql(statement, used);
      } catch (error) {
        const reason = reasonOf(error);
        if (reason === 'denied' && !used) {
          if (!writable) { writable = true; remember('writable'); }
          return this.read(statement); // une seule fois : le jeton qui peut écrire refusé à son tour ferme la lecture
        }
        if (reason !== 'slow') close(reason);
        throw error;
      }
    },
  };
}
