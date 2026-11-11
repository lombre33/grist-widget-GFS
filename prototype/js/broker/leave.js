// Quitter l'app active pour une autre (contrats 5.4, point 3, appel `fermer`) : GFS lui demande de se fermer ; l'app enregistre d'abord quand son
// enregistrement automatique est allumé, ou pose elle-même sa question (Enregistrer, Abandonner, Annuler) quand des modifications attendent, puis répond `{
// ferme: true | false }`. GFS ne ferme rien tout seul : sans réponse au bout de `PATIENCE_MS`, ou sur une erreur de l'app, la personne décide (« Fermer quand
// même », ou attendre / rester). Une app qui ne connaît pas l'appel (GFS_INCONNU) part comme avant.

import { ERR } from './filter.js';

export const PATIENCE_MS = 10000;

// La question posée à la personne quand l'app se tait (`fault` nul) ou répond par une erreur : les options de la fenêtre d'accord (js/ui/ask-window.js),
// « Fermer quand même » contre « Attendre » ou « Rester ». Le clavier est sur le choix sûr (`safeFirst`) : un Entrée distrait ne ferme pas une app dont les
// modifications ne sont pas enregistrées.
export function leaveQuestion({ t, app, fault }) {
  const reason = fault ? String(fault.message || '').slice(0, 120) || t('gfs.leave.unexpected') : '';
  return {
    title: t(fault ? 'gfs.leave.faultTitle' : 'gfs.leave.silentTitle', { app }),
    message: fault ? t('gfs.leave.faultText', { app, reason }) : t('gfs.leave.silentText', { app }),
    confirmLabel: t('gfs.leave.force'),
    cancelLabel: t(fault ? 'gfs.leave.stay' : 'gfs.leave.wait'),
    safeFirst: true,
  };
}

// `offer(erreur | null)` demande à la personne : `true` pour fermer quand même, `false` pour attendre (`null` : l'app n'a pas répondu) ou rester (l'app a
// répondu par une erreur). Rend `true` quand l'app peut partir, `false` quand elle reste.
export async function askToClose(session, reason, { offer, patience = PATIENCE_MS }) {
  let timer;
  const outcome = Promise.resolve().then(() => session.closeApp(reason)).then(
    // une réponse sans `ferme` n'est ni un oui ni un non : la personne décide
    reply => (reply && typeof reply.ferme === 'boolean' ? reply.ferme : new Error('')),
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

// L'app avait répondu `oui` à `fermer` (enregistrée, verrou levé, exécution coupée) et GFS ne la remplace pas : la personne est revenue avant la fin. GFS le
// lui dit (`rester`, contrats 5.4, point 3) pour qu'elle reprenne ce qu'elle avait arrêté. Une app qui ne connaît pas l'appel (GFS_INCONNU) n'a rien arrêté
// qu'elle sache, une app déjà partie (GFS_INACTIF) n'a plus rien à reprendre : ni l'une ni l'autre ne mérite un avertissement. Rend `true` quand l'app dit
// qu'elle a repris.
export async function tellToStay(session, reason) {
  try {
    const reply = await session.stayApp(reason);
    return Boolean(reply && reply.repris === true);
  } catch (error) {
    if (!error || (error.code !== ERR.INCONNU && error.code !== ERR.INACTIF)) console.warn('GFS : l\'app n\'a pas répondu à « rester »', error);
    return false;
  }
}

// Quitter l'app pour une autre en tenant compte de la personne. `where()` dit, quand l'app a répondu, où en est la personne : `'now'` (rien n'a changé, l'app
// part), `'moved'` (elle a fait autre chose, l'app reste en place : si elle avait dit oui, elle reçoit `rester`) ou `'gone'` (l'app a été remplacée ou fermée
// entre-temps : il n'y a plus personne à qui parler). Rend `true` seulement quand l'app part.
export async function leaveApp(session, reason, { offer, where, patience = PATIENCE_MS }) {
  const leave = await askToClose(session, reason, { offer, patience });
  const place = where();
  if (leave && place === 'moved') void tellToStay(session, reason);
  return leave && place === 'now';
}
