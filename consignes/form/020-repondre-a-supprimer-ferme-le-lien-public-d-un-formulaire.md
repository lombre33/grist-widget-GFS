# 020 · Réponds à « supprimer » : ferme le lien public d'un formulaire avant que GFS le mette à la corbeille

App : Form+ · posée le 04/11/2026 · contrats de GFS 2.4 (`suppression.appel`) et 5.4 (point 10), guide des apps 1.2 point 20 · demande du porteur du 04/11 : « il faut que tout puisse se faire depuis l'explorateur et prévoir une corbeille » ·
quand : au prochain lot, sans urgence ; du code dans ton app (une réponse à un appel de GFS) ; vaut dans GFS seulement (seule, l'app garde sa gestion de ses formulaires)

## Quoi

**1. Ce que GFS fait dès maintenant.** Dans l'explorateur, la personne met un fichier à la corbeille (Suppr, le menu de la ligne). Pour un modèle de Publipostage+, une ligne suffit : GFS la copie dans sa table `GFS_Corbeille` et la retire. **Un formulaire de
Form+ tient à plus qu'une ligne** : son lien public, ses sections natives, sa table de réponses. GFS ne sait pas les fermer (il n'écrit que dans les tables que ton manifeste lui déclare, et jamais `RemoveViewSection`) : **il te demande de fermer ce qui est
public avant de retirer la ligne.** Tant que ton app ne répond pas à l'appel, GFS ne touche pas à un formulaire (l'article « Mettre à la corbeille » du menu reste grisé : il ne le dégrise que pour une app qui a la porte).

**2. Ce que tu fais : répondre à `supprimer { fichier, raison }`.** `fichier` est `{ id, type }` (`id` : le numéro de la ligne de `FormPlus_Formulaires`, en texte ; `type` : la valeur de `TypeFormulaire`) ; `raison` vaut `corbeille`. Tu réponds :

- `{ fait: true }`, ou `{ fait: true, dit: "…" }`, **quand le formulaire n'est plus public** : son lien est fermé (par exemple en remettant `shareOptions` de ses sections natives à `'{}'`, ce que ton app sait déjà faire pour dépublier). GFS retire alors la ligne de
  `FormPlus_Formulaires` (copiée avant dans `GFS_Corbeille`, dans le même lot d'écriture) ;
- `{ fait: false, dit: "…" }` **si tu ne peux pas le fermer** (une publication en cours, une écriture refusée) : GFS ne touche à rien et dit ta phrase à la personne ;
- une erreur (`GFS_ERREUR` et son texte) si quelque chose casse : GFS le dit à la personne, rien n'est retiré.

`dit` est une phrase d'une ligne (200 signes au plus, sans retour à la ligne) que GFS ajoute à la sienne, par exemple « Son lien public est fermé. » : la personne apprend ce que ton app a fait de plus qu'une ligne retirée.

**3. Ce que tu ne fais pas.** Tu ne retires ni la ligne de `FormPlus_Formulaires` (GFS la garde pour la restaurer), ni la table `FormPlus_Pub_<vsId>` et ses réponses, ni les sections, ni la définition : **restaurer, c'est remettre la ligne**, et la personne
republie à la main si elle le veut. Tu ne demandes pas de confirmation à la personne : GFS a déjà dit à la personne qu'un fichier part à la corbeille, et rien ne s'efface (la corbeille se vide à la main). Tu réponds `{ fait: true }` seulement **après** avoir fini
d'écrire ; aucun délai à tenir (sans réponse au bout de 20 secondes, GFS dit à la personne que Form+ ne répond pas, et ne retire rien).

**4. Ce que GFS ne fait pas non plus** : « Supprimer définitivement » et « Vider la corbeille » ne t'appellent pas (le lien est fermé depuis la mise à la corbeille) ; ce qui reste de ton côté (la table des réponses, les sections) est à la personne, que ton app peut aider à nettoyer
(un autre chantier, pas celui-ci).

**5. Dans ta page d'état**, sur la ligne de cette consigne : ce que ton app ferme (le lien public, les sections natives dépubliées, rien d'autre) et ce qu'elle laisse.

## Pourquoi

Le porteur, le 04/11 : tout se fait depuis l'explorateur, pour toutes les apps, avec une corbeille ; une app seule, sans GFS, garde sa gestion de ses fichiers. Un lien public qui reste ouvert sur un formulaire « à la corbeille » continue de recevoir des réponses :
c'est la seule chose que GFS ne peut pas rattraper seul. Il a donc ajouté un appel (contrats 5.4, point 10) et une recette (`suppression.appel`, contrats 2.4) pour les fichiers de cette sorte. Quand tu auras répondu, GFS déclare `suppression: { ligne: true, appel: true }` dans son
manifeste de Form+ (`prototype/manifestes/form.json`) en lisant ta page : tu n'as rien à écrire dans ton `gfs.json`.

## Fait quand

`GFS-ETAT.md` donne « 020 · lue » maintenant, puis « 020 · faite · `commit` » quand `supprimer` répond comme au point 2 et qu'un essai à toi le montre : un formulaire publié, `supprimer`, son lien ne répond plus (ou ses sections ne sont plus publiées) et ses réponses sont
toujours dans `FormPlus_Pub_<vsId>`. GFS le rejoue avec ta vraie app dans son labo (`run-composite` avec la sonde ZF qui répond comme toi, puis un vrai Grist avec Form+) quand ta référence avance, et passe la consigne à « faite » en lisant ta page.
