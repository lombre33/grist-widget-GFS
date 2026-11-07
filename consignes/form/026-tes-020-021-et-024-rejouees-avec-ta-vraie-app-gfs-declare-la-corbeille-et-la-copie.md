# 026 · Tes 020, 021 et 024 sont rejouées avec ta vraie app dans un vrai Grist : GFS déclare la corbeille et la copie par ton app ; une question sur la table de la copie (guide, règle 4)

App : Form+ · posée le 07/11/2026 · quand : à lire maintenant ; aucun code à changer ; du code seulement si tu prends le point 3 (au prochain lot, sans urgence) ; réponse à tes 020, 021 et 024 faites ; contrats 2.4 (`suppression.appel`, `copie.appel`), 5.4 (points 10 et 11) ; guide des apps 1.1 (règle 4) ; vaut dans GFS seulement

## Quoi

**1. Ce que GFS a fait en lisant ta page (commit `91e4ba8`).** Le manifeste que GFS garde de ton app déclare maintenant `suppression: { ligne: true, appel: true }` et `copie: { appel: true }` (`prototype/manifestes/form.json`) : « Mettre à la corbeille » et « Dupliquer » sont dégrisés pour un formulaire quand Form+ est ouverte, et restent grisés avec leur phrase (« Ouvre Form+ pour… ») quand une autre app l'est. Il a avancé sa référence de ton app de `17cfce9` à `91e4ba8` et l'a relue : la politique de sécurité de `poc/widget.html` est la même (un script classique de `'self'` de plus), aucune bibliothèque ni adresse de plus, le kit est relevé à `cb1f8cd` (0.10.0). Tes 020, 021 et 024 passent à « faite » dans l'INDEX.

**2. Rejoué avec ta vraie app** (`labo/run-composite-form.mjs`, un vrai Grist grist-static, 700 × 400, à la vraie souris et au vrai clavier, français clair et anglais sombre : 25 vérifications chacune, aucune en échec) :
- **« Dupliquer »** : ta copie est un formulaire de plus dans la liste, sous le premier nom libre (« … (1) »), avec sa propre section, sans clé de partage ni adresse publique, son lien fermé ; sa table de réponses est à elle (`Clients_copie`) et vide ; l'original n'a pas bougé (même ligne, même définition, son lien public toujours ouvert, la table des réponses intacte) ; GFS n'a rien écrit dans `FormPlus_Formulaires` (une seule ligne ajoutée, la tienne) ; la copie prend le clavier. La phrase de GFS et la tienne (« Elle n'est pas publiée. ») sont dites bout à bout.
- **« Mettre à la corbeille »** : la question de la table `GFS_Corbeille` passe avant l'appel (un refus de la personne n'appelle pas ton app, le lien reste ouvert) ; puis `onDelete` ferme le lien public (`shareOptions` à `{}`), la ligne part à `GFS_Corbeille` dans un seul lot, ta phrase s'ajoute à celle de GFS ; la section du formulaire et sa table de réponses restent là.
- **Restaurer** : la ligne revient au même numéro, avec exactement la même définition ; ton app ne rouvre pas le lien, la personne le republie quand elle le veut.
- Aucun avertissement de GFS, aucune erreur de script dans ton app.

**3. Une question, sur ce que ta copie crée (guide des apps, règle 4).** Ta copie crée une table, `Clients_copie` (la table de réponses du formulaire copié), sans fenêtre d'accord ni mot dans la phrase de `dit` : la personne apprend que la copie « n'est pas publiée », pas qu'une table est née dans son document. La règle 4 du guide demande que l'app crée une table *avec l'accord de la personne*. GFS suppose que le geste « Dupliquer » en tient lieu (la personne a demandé la copie d'un formulaire qui a sa table de réponses). Dis dans ta page si c'est ton choix ; si tu veux que la personne le sache, une phrase de plus dans `dit` suffit (200 signes au plus) : par exemple le nom de la table et qu'elle est vide. GFS n'y met rien à ta place.

**4. Pas mesuré** : Firefox avec ta vraie app ; le Grist de la DINUM ; un formulaire publié par ton propre geste « Partir de zéro » puis « Publier » (l'essai range le formulaire comme tu le fais, par une ligne de `FormPlus_Formulaires` sur une section native, et pose `shareOptions` à la main, sans clé de partage réelle) ; la copie d'un formulaire dont une question écrit dans une autre table que la principale (ta limite connue : cette autre table reste partagée avec l'original, GFS ne la suit pas).

## Pourquoi

« Tout se fait depuis l'explorateur » (décision du porteur, 04/11) : pour un formulaire, GFS ne sait pas fermer un lien public ni créer une section natives ; c'est ton app qui le fait, et GFS ne déclare le geste qu'une fois la réponse écrite et mesurée avec elle. Elles le sont.

## Fait quand

`GFS-ETAT.md` donne « 026 · lue » : rien d'autre. Si tu prends le point 3 : « 026 · faite · `commit` », avec ce que tu as choisi (fenêtre d'accord, phrase de plus, ou « le geste en tient lieu »).
