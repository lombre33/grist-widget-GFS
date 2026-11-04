// Quitter l'app active pour une autre (contrats 5.4, point 3, appel `fermer`) : GFS lui demande de se fermer ; l'app enregistre d'abord quand son enregistrement automatique est allumé, ou pose
// elle-même sa question (Enregistrer, Abandonner, Annuler) quand des modifications attendent, puis répond `{ ferme: true | false }`. GFS ne ferme rien tout seul : sans réponse au bout de
// `PATIENCE_MS`, ou sur une erreur de l'app, la personne décide (« Fermer quand même », ou attendre / rester). Une app qui ne connaît pas l'appel (GFS_INCONNU) part comme avant.

import { ERR } from './filter.js';

export const PATIENCE_MS = 10000;

// `offer(erreur | null)` demande à la personne : `true` pour fermer quand même, `false` pour attendre (`null` : l'app n'a pas répondu) ou rester (l'app a répondu par une erreur).
// Rend `true` quand l'app peut partir, `false` quand elle reste.
export async function askToClose(session, reason, { offer, patience = PATIENCE_MS }) {
  let timer;
  const outcome = Promise.resolve().then(() => session.closeApp(reason)).then(
    reply => (reply && typeof reply.ferme === 'boolean' ? reply.ferme : new Error('')), // une réponse sans `ferme` n'est ni un oui ni un non : la personne décide
    error => {
      if (error && error.code === ERR.INCONNU) return true; // l'app ne connaît pas l'appel : elle part comme avant
      if (error && error.code === ERR.INACTIF) return false; // l'app n'est plus là : rien à fermer
      return error || new Error('');
    });
  const first = await Promise.race([outcome, new Promise(resolve => { timer = setTimeout(resolve, patience, null); })]);
  clearTimeout(timer);
  if (typeof first === 'boolean') return first;
  if (await offer(first)) return true; // « Fermer quand même »
  if (first) return false; // l'app a répondu par une erreur : la personne reste
  return (await outcome) === true; // « Attendre » : la réponse de l'app, quand elle vient
}
