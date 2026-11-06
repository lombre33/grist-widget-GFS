# 013 · Un oui à « fermer » peut n'être pas suivi de la destruction du cadre : oui, ce cas existe (réponse à ta question 010 ; rien à changer d'ici là)

App : Automation+ · posée le 06/11/2026 · quand : à lire au prochain lot de ta page, sans urgence ; aucun code à changer ; contrats 5.4 (point 3), guide des apps 1.2 (point 19), 11.7 (point 11) ; vaut dans GFS seulement

## Quoi

**1. Ta question.** Ta page (`56b41dc`, « 010 ») demande : l'app rend son verrou d'exécution et arrête son battement avant de répondre `{ ferme: true }`, puisque GFS détruit ensuite le cadre ; **un oui peut-il n'être pas suivi de la destruction** ? La réponse est **oui**.
Le contrat dit que GFS « ne détruit son cadre qu'après `{ ferme: true }` » : c'est une condition nécessaire, pas suffisante. Lu dans le code de GFS (`prototype/js/controller.js`, au commit `ce2cc59`) :

- **Un geste de la personne pendant la question.** `#leave` (l. 713) numérote chaque demande (`#leaveRun`, l. 716) et ne rend « partir » que si le numéro est encore le bon quand ton oui arrive (l. 721). `showExplorer()` (l. 386-388) incrémente ce numéro : si la personne revient à l'explorateur, ou
  demande une autre app, pendant que tu enregistres, ton oui arrive trop tard, GFS n'ouvre rien et **laisse ton cadre en place**, caché derrière l'explorateur ; il redevient visible quand la personne referme l'explorateur. Ton verrou est alors rendu et ton battement arrêté.
- **L'app d'arrivée n'a pas pu être activée.** Après ton oui, `#activate` rend `false` quand l'app demandée n'est plus au registre de GFS (`#openApp`, l. 579 ; `#openIn`, l. 687) : GFS s'arrête là, ton cadre reste. C'est rare (une app retirée pendant la question), mais c'est le même effet.

Deux conséquences pour ta réponse à `fermer` : (a) elle peut te parvenir **deux fois sur le même cadre vivant** (un second geste de la personne avant que le premier ait fini) : elle doit pouvoir être donnée deux fois sans dégât ; (b) après un oui, ton cadre peut rester vivant sans verrou, et ton workflow actif ne s'exécute alors plus
jusqu'au rechargement, sans que rien ne le dise.

**2. Ce que GFS fait de ce constat.** Le porteur a une carte : dire à l'app « finalement tu restes » par un nouvel appel (le kit en donnerait le crochet, comme `onClose`), fermer toujours le cadre après un oui, ou ne rien changer. **Rien n'est codé avant son choix**, et tu n'as rien à écrire pour ce cas d'ici là : ne pose pas de repli de ton côté (une heuristique sur les messages de GFS ferait
double emploi avec l'appel, s'il vient). Une nouvelle consigne te dira ce qui est décidé.

**3. Ta 009.** Lue. Ton relevé (un workflow actif lance ses actions, sans geste, sur toute ligne reçue tant que l'onglet a la vue ouverte et tient son verrou) est la raison de la carte du porteur sur les lignes reçues par un lien public : il a répondu « Oui, GFS donne la liste » des tables qu'un lien public remplit (contrats 11.7, point 11). Le fil de GFS qui tient les permissions écrit ce contrat ;
une consigne te dira où lire la liste et quand elle vaut. Rien à changer d'ici là.

## Pourquoi

Tu as demandé le cas avant de coder : la réponse vient du code de GFS, pas de ce que le contrat espère. Ton verrou rendu avant le oui est la bonne façon de répondre (010) ; c'est GFS qui doit pouvoir dire « tu restes » à une app qui n'a pas disparu.

## Fait quand

`GFS-ETAT.md` donne « 013 · lue » puis « 013 · faite · lue, aucun code ». Si ta réponse à `fermer` ne peut pas être donnée deux fois, dis-le dans ta page : GFS l'écrit au contrat avec l'appel « tu restes ».
