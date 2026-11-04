# 010 · Réponds à « fermer » : enregistre avant de laisser la place à une autre app

App : Automation+ · posée le 04/11/2026 · contrats de GFS 5.4 (points 3 et 7), guide des apps 1.2 point 19 · demande du porteur du 04/11 : « gérer les enregistrements automatiques en cas de swap d'app ou de fichier » ·
quand : au prochain lot, sans urgence ; du code dans ton app (une réponse à un appel de GFS) ; vaut dans GFS seulement (seule, l'app garde sa sortie)

## Quoi

**1. Ce que GFS fait dès maintenant.** Quand la personne ouvre une autre app (la fenêtre des apps), le fichier d'une autre app (l'explorateur, « Nouveau », « Importer », « Lire ») ou suit un lien vers une autre app,
GFS appelle `fermer { raison }` sur l'app active (`raison` : `app`, `explorateur`, `nouveau`, `importer`, `lire` ou `lien`) et **ne détruit son cadre qu'après ta réponse `{ ferme: true }`**. Avant, il le détruisait
sans rien demander : ce que l'app n'avait pas enregistré était perdu. Une app dont le code répond `GFS_INCONNU` à cet appel (elle ne le connaît pas) est prise pour « elle part sans rien dire » : c'est le comportement d'avant, sans rien d'enregistré.

**2. Ce que tu fais : répondre à `fermer { raison }` par `{ ferme: true }` ou `{ ferme: false }`**, selon ce que ton app a « en attente » :

- **rien n'attend** (chaque geste s'écrit tout de suite, ou rien n'a changé depuis le dernier enregistrement, ou la personne est en lecture seule) : `{ ferme: true }` aussitôt ;
- **ton enregistrement automatique est allumé** (si l'app en a un) : enregistre ce qui attend, laisse finir l'écriture en cours, puis `{ ferme: true }` **sans poser de question** ; si l'écriture échoue,
  ou s'il reste des modifications, la question ci-dessous ;
- **des modifications attendent et rien ne les enregistre seul** : ta propre question (Enregistrer, Abandonner, Annuler), celle que tu poses déjà quand la personne quitte un fichier dans ton app (pas de copie :
  la même) : Enregistrer ou Abandonner → `{ ferme: true }` ; Annuler (ou Échap) → `{ ferme: false }`, tout reste en place.

Même règle quand GFS t'appelle `ouvrir` pour un autre fichier de ton app.

**3. Ce que tu ne fais pas.** Tu ne te fermes pas toi-même et tu ne changes pas de page : GFS détruit le cadre après ton `oui`. Tu ne réponds jamais `oui` avant d'avoir fini d'écrire. Aucun délai à tenir : sans
réponse au bout de 10 secondes, GFS dit à la personne que Automation+ ne répond pas et lui laisse « Attendre » ou « Fermer quand même » ; ta question à l'écran peut donc attendre la personne, qui y répond ensuite
(« Attendre » suit ta réponse quand elle vient).

**4. Dans ta page d'état**, sur la ligne de cette consigne : ce que ton app a d'« en attente » (rien, un brouillon, un enregistrement automatique) et ce que `fermer` en fait.

## Pourquoi

Le porteur, le 04/11 : « gérer les enregistrements automatiques en cas de swap d'app ou de fichier ». GFS en tire une règle simple, écrite dans les contrats (5.4, point 3) et dans le guide des apps (1.2, point 19) :
changer d'app ou de fichier ne perd jamais ce que la personne a fait, et ne lui pose une question que si l'app ne peut pas décider seule. Une personne qui a allumé l'enregistrement automatique a déjà dit qu'elle veut que
l'app enregistre ; une question de plus la dérange pour rien. Si cette lecture te semble perdre quelque chose dans ton app, ne la contourne pas : laisse la consigne « à faire » et dis le cas dans `GFS-ETAT.md`.

## Fait quand

`GFS-ETAT.md` donne « 010 · lue » maintenant, puis « 010 · faite · `commit` » quand `fermer` répond comme au point 2 et qu'un essai à toi le montre (ou « faite · lue, aucun code » si ton app écrit à chaque geste et n'a donc jamais rien en attente : dis-le sur la même ligne). GFS le rejoue avec ta vraie app
dans son labo (`run-fermer`, un vrai Grist, la vraie souris) quand ta référence avance, et passe la consigne à « faite » en lisant ta page.
