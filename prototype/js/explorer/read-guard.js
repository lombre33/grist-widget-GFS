// Le garde-fou des lectures complètes (25/11, choix du porteur après la mesure d'un GFS très chargé : faits vérifiés 161 et 162). Au-delà d'environ 500 Mo
// dans une table, Grist ne sait plus l'envoyer en entier : il coupe la connexion de la page, la page se reconnecte, Grist reconstruit le cadre de GFS, GFS
// redémarre et redemande la table, toutes les 8 s et sans fin. Mesuré : la lecture demandée ne rend ni réponse ni refus avant la fin du cadre, et rien ne
// distingue ce redémarrage d'une page que la personne recharge (même type de navigation, mêmes événements `pagehide` et `unload`). Ce que GFS sait, c'est
// qu'il a demandé une table en entier et que la page n'en a pas vu la fin.
//
// Il le note avant chaque lecture complète, table par table, et l'efface dès que la lecture rend (une réponse ou un refus : le cadre a tenu). Une page qui
// démarre et trouve une note sait que la lecture d'avant n'a pas fini :
//   - elle relit cette table SEULE, l'une après l'autre quand il y en a plusieurs (plusieurs tables sont en vol quand Grist coupe : lue seule, celle qui
//     coupe se désigne, et les autres retrouvent leur lecture) ;
//   - après LIMIT lectures de suite sans fin, elle ne la relance plus d'elle-même : la liste se montre sans cette table, et le dit. Elle réessaie après un
//     délai (HOLD_MS, doublé à chaque nouvel échec, MAX_HOLD_MS au plus), car une personne pressée qui recharge la page trois fois pendant une lecture
//     lente laisse les mêmes notes qu'une coupure : ses fichiers ne doivent pas rester cachés longtemps.
// Les notes sont gardées par onglet (`sessionStorage`, qui survit au cadre reconstruit : mesuré) et par document, sous `gfs.reading.<document>.<table>`, de
// la forme « nombre:date ». Aucun contenu. Sans stockage ou sans identifiant de document, il n'y a pas de garde-fou : la lecture est celle d'avant.

import { docKey } from './doc-key.js';

export const GUARD_PREFIX = 'gfs.reading.';
// Les lectures de suite que la page n'a pas vues finir avant que GFS cesse de relancer la table de lui-même.
export const LIMIT = 3;
// Une note plus vieille ne compte plus tant que la limite n'est pas atteinte : la personne est partie pendant une lecture, il y a longtemps.
export const FRESH_MS = 10 * 60 * 1000;
// Le temps pendant lequel une table retenue n'est pas relancée : deux minutes à la limite, doublées à chaque échec de plus, une demi-heure au plus.
export const HOLD_MS = 2 * 60 * 1000;
export const MAX_HOLD_MS = 30 * 60 * 1000;

const TABLE = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const NOTE = /^([1-9]\d?):(\d{1,15})$/;
const MOST = 99; // le plus grand nombre qu'une note garde

// Le refus du garde-fou : `table` n'est pas relue en entier pour l'instant, `count` lectures de suite n'ont pas fini.
export class ReadHeldError extends Error {
  constructor(table, count) {
    super(`la lecture de ${table} a été interrompue ${count} fois de suite`);
    this.held = true;
    this.table = table;
    this.count = count;
  }
}

export const holdOf = (count, limit = LIMIT) => Math.min(MAX_HOLD_MS, HOLD_MS * 2 ** Math.max(0, count - limit));

// `docId()` : l'identifiant du document (promesse) ; `store(clé)` : { read(), write(valeur | null) } sur l'onglet (js/shell/stored-choice.js, `keyStore`) ;
// `now()` : l'heure, en millisecondes ; `limit` : voir LIMIT.
export function createReadGuard({ docId, store, now = () => Date.now(), limit = LIMIT }) {
  const key = docKey(docId);
  const left = new Map(); // table -> la promesse de ce qu'une page d'avant a laissé pour elle, lu une seule fois : { slot, count, at }
  let alone = Promise.resolve(); // les lectures des tables suspectes, l'une après l'autre

  // Ce qu'une page d'avant a laissé pour `table` : `count` lectures de suite sans fin (0 : aucune, ou trop vieilles), la dernière à `at`. `slot` est null
  // quand rien ne peut se garder (pas d'identifiant, nom de table étrange) : la table se lit alors sans garde-fou.
  const find = async table => {
    const id = TABLE.test(table) ? await key() : null;
    const slot = id ? store(`${GUARD_PREFIX}${id}.${table}`) : null;
    const text = slot ? slot.read() : null;
    const [, count, at] = (typeof text === 'string' && NOTE.exec(text)) || [];
    const mark = { slot, count: Number(count) || 0, at: Math.min(Number(at) || 0, now()) }; // une date à venir (horloge changée) vaut maintenant
    if (mark.count < limit && now() - mark.at >= FRESH_MS) mark.count = 0;
    return mark;
  };
  const markOf = table => {
    if (!left.has(table)) left.set(table, find(table));
    return left.get(table);
  };

  return {
    // Lit `table` en entier par `read()`, sous le garde-fou : rend ce que `read` rend, ou lève ce qu'il lève ; lève ReadHeldError sans rien lire quand la
    // table est retenue.
    async run(table, read) {
      const mark = await markOf(table);
      if (!mark.slot) return read();
      const go = async () => {
        const started = now();
        if (mark.count >= limit && started - mark.at < holdOf(mark.count, limit)) throw new ReadHeldError(table, mark.count);
        mark.slot.write(`${Math.min(MOST, mark.count + 1)}:${started}`);
        try { return await read(); } finally {
          // la page a vu la fin de la lecture : rien n'a coupé, la table repart de zéro
          mark.slot.write(null);
          mark.count = 0;
        }
      };
      if (!mark.count) return go();
      const turn = alone.then(go);
      alone = turn.catch(() => {});
      return turn;
    },
  };
}
