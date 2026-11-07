# 012 · « Partager » marche pour les fichiers des apps : tu n'écris aucun auteur, GFS le pose lui-même ; ta consigne précédente sur « Partager » est remplacée

App : Grist-BI · posée le 07/11/2026 · remplace la 011 (« Partager » existe pour les PDF…) sur un point de fond · contrats de GFS 11.6 (point 6) et 11.7 (points 2 et 13, g et h) · go du porteur du 07/11 (« dans l'ordre »)
quand : à lire au prochain lot, sans urgence ; aucun code à changer ; vaut dans GFS seulement

## Quoi

**1. Ce qui existe maintenant.** « Partager… » (menu d'un fichier) marche pour **tes fichiers** : la table `BI_Dashboard_Config` que ton manifeste déclare (`fichiers`). Au premier « Partager », le propriétaire du document active le partage : GFS ajoute à ta table des colonnes d'aide dont le nom commence par `GFS_` (dont `GFS_Auteur`) et pose des règles d'accès dans Grist, avec la question qui dit le prix. Une app ajoutée après coup demande « Étendre le partage à cette app… ». Essayé dans un vrai Grist, à trois comptes (propriétaire, éditeur, lecteur), avec la table et les colonnes de Publipostage+ ; **pas rejoué avec ta vraie app**.

**2. Ce qui remplace la 011.** Elle te disait de garder `Auteur`, « écrit à la création » : **tu n'as rien à écrire.** GFS pose lui-même `GFS_Auteur`, une colonne que **Grist** remplit avec l'adresse de la personne à la création de la ligne (une formule déclenchée sur `user.Email`) ; une personne ne peut ni la choisir ni la changer (essayé : refusé). Tu ne lis pas ce nom ni les autres `GFS_…` et tu ne les écris jamais ; tu les tolères (6.1, points 3 et 4). Le reste de la 011 tient : n'ajoute aucune colonne `Visibilite`, `Personnes` ni `Espace`.

**3. Ce que tu peux voir changer chez toi, une fois le partage activé** (rien n'est à coder, mais à savoir) :
- ta liste de fichiers est **plus courte pour qui ne lit pas tout** : un éditeur ne lit que les fichiers dont il est l'auteur, ceux qu'on lui a partagés et ceux d'avant l'activation (laissés lisibles de tous) ; une lecture par numéro ou par jeton d'un fichier qu'il ne lit pas rend « rien », comme s'il n'existait pas ;
- **Grist refuse** l'écriture ou la suppression d'un fichier qu'on ne fait que lire (le refus dit « Blocked by row update access rules », avec la note « GFS : Partages · … ») : ton app doit **dire** ce refus (comme pour `_grist_*`, 11.6 point 9) plutôt que de planter ou de réessayer ;
- les lignes que ton manifeste `exclure` (par exemple les réglages) **restent ouvertes** comme avant : elles ne sont pas des fichiers ;
- **non couvert dans ce lot** : les tables liées à un fichier (versions, commentaires, lignes en direct) restent lisibles comme avant ; leur règle viendra avec les classes `derivee` (11.2), dans une consigne à part.

## Pourquoi

La 011 demandait à chaque app d'écrire un auteur : or une colonne que l'app remplit peut être falsifiée, et une règle de Grist ne vaut que si l'auteur est écrit par Grist. En le posant lui-même, GFS rend le partage identique pour toutes les apps, sans qu'aucune ne tienne de colonne de sécurité (règle « ne pas dupliquer de code »).

## Fait quand

`GFS-ETAT.md` donne « 012 · lue » (aucun code à changer). Si ton app écrit déjà une colonne `Auteur`, `Visibilite`, `Personnes` ou `Espace`, ou si le refus d'une écriture la fait planter, dis-le dans ta page : GFS le note dans 11.7 et rejoue avec ta vraie app.
