# 047 · Réponds à « fermer » : enregistre avant de laisser la place à une autre app ou à un autre fichier

App : Publipostage+ · posée le 04/11/2026 · contrats de GFS 5.4 (points 3 et 7), guide des apps 1.2 point 19 · demande du porteur du 04/11 : « gérer les enregistrements automatiques en cas de swap d'app ou de fichier » ·
quand : au prochain lot ; du code dans ton app (`js/gfs-link.js`, `askBeforeLeaving`) ; vaut dans GFS seulement (seule, l'app garde sa sortie)

## Quoi

**1. Ce que GFS fait dès maintenant.** Quand la personne ouvre une autre app (la fenêtre des apps), le fichier d'une autre app (l'explorateur, « Nouveau », « Importer », « Lire ») ou suit un lien vers une autre app,
GFS appelle `fermer { raison }` sur l'app active (`raison` : `app`, `explorateur`, `nouveau`, `importer`, `lire` ou `lien`) et **ne détruit son cadre qu'après ta réponse `{ ferme: true }`**. Avant, il le détruisait
sans rien demander : ce que l'app n'avait pas enregistré était perdu. Une app dont le code répond `GFS_INCONNU` à cet appel (elle ne le connaît pas) est prise pour « elle part sans rien dire » : c'est le comportement d'avant, sans rien d'enregistré. Ton `js/gfs-link.js` répond aujourd'hui `GFS_INCONNU` à tout appel de GFS sauf `ouvrir` : aucune question n'est posée, et avec l'enregistrement automatique coupé (la disquette noire) des modifications sont perdues.

**2. Ce que tu fais : répondre à `fermer { raison }`** par `{ ferme: true }` ou `{ ferme: false }`, d'après ton état au moment de l'appel (même geste pour `ouvrir`, quand GFS te donne un autre fichier de ton app) :

- **rien n'attend** (`hasEditsToConfirmBeforeLeaving()` est faux : rien de modifié, lecture seule, macro-modèle) : `{ ferme: true }` aussitôt ;
- **enregistrement automatique allumé** : attends le passage déjà parti (comme `askBeforeLeaving`, `whenAutosaveTickDone`), enregistre ce qui attend (`onSave()`), et réponds `{ ferme: true }` **sans poser de question** ;
  s'il reste des modifications (écriture refusée, nouveau modèle sans nom, qui ne peut pas être enregistré), ta question ci-dessous ;
- **enregistrement automatique coupé avec des modifications en attente** : `askBeforeLeaving()` tel quel (Enregistrer, Abandonner, Annuler) : `true` → `{ ferme: true }` ; `false` (Annuler, Échap, enregistrement
  refusé) → `{ ferme: false }`, tout reste en place.

Aujourd'hui `askBeforeLeaving` pose sa question même quand l'enregistrement automatique est allumé et que `autosaveDirty` vaut vrai (les 2,5 s avant le prochain passage). Pour tes sorties **internes** (changer de modèle
dans l'app) c'est ton choix et il reste le tien. Pour le changement d'app et de fichier que GFS déclenche, la lecture que GFS fait de la demande du porteur est : allumé veut dire « j'enregistre et je pars ».

**3. Ce que tu ne fais pas.** Tu ne te fermes pas toi-même et tu ne changes pas de page : GFS détruit le cadre après ton `oui`. Tu ne réponds jamais `oui` avant d'avoir fini d'écrire. Aucun délai à tenir : sans
réponse au bout de 10 secondes, GFS dit à la personne que Publipostage+ ne répond pas et lui laisse « Attendre » ou « Fermer quand même » ; ta question à l'écran peut donc attendre la personne, qui y répond ensuite
(« Attendre » suit ta réponse quand elle vient).

## Pourquoi

Le porteur, le 04/11 : « gérer les enregistrements automatiques en cas de swap d'app ou de fichier ». GFS en tire une règle simple, écrite dans les contrats (5.4, point 3) et dans le guide des apps (1.2, point 19) :
changer d'app ou de fichier ne perd jamais ce que la personne a fait, et ne lui pose une question que si l'app ne peut pas décider seule. Une personne qui a allumé l'enregistrement automatique a déjà dit qu'elle veut que
l'app enregistre ; une question de plus la dérange pour rien. Si cette lecture te semble perdre quelque chose dans ton app, ne la contourne pas : laisse la consigne « à faire » et dis le cas dans `GFS-ETAT.md`.

## Fait quand

`GFS-ETAT.md` donne « 047 · lue » maintenant, puis « 047 · faite · `commit` » quand `fermer` répond comme au point 2 et qu'un essai à toi le montre. GFS le rejoue avec ta vraie app
dans son labo (`run-fermer`, un vrai Grist, la vraie souris) quand ta référence avance, et passe la consigne à « faite » en lisant ta page.
