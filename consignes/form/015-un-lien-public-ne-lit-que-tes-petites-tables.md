# 015 · Un lien public ne lit que tes petites tables `FormPlus_Pub_*` : GFS refuse toute autre table de ton app, tes listes ne les offrent plus

App : Form+ · posée le 03/11/2026 · décision du porteur du 03/11 (carte « Un lien public peut-il lire la petite table de chaque formulaire
de Form+ ? » : « Petites tables déclarées seulement ») · quand : au prochain lot, sans urgence ; un petit changement de code (trois listes de
tables de ton éditeur) ; visible aussi dans l'app seule

## Quoi

**Ce que GFS fait depuis le 03/11** (contrats 3.3 point 9, 3.4 point 5 et 11.9 point 4c ; `faits-verifies.md` 2 et 10.11) :

- Parmi les tables de ton app (`FormPlus_…`), un lien public ne lit **que celles que ton manifeste déclare** dans `permissions.lienPublic.lit` : le
  manifeste que GFS tient pour toi (`prototype/manifestes/form.json`, en attendant ton `gfs.json`) y met `FormPlus_Pub_*`, tes petites tables d'une
  ligne (013, point 1). La lecture d'une de ces tables, la colonne `Definition` que montre ta Référence cachée `FormPlusDef_<vsId>`, passe par la
  fenêtre d'accord de GFS comme avant : **tu n'as rien à changer pour elle**. Mesuré le 03/11 avec ton `fd5384a` dans un vrai Grist (`run-form`, 48
  vérifications, en français / clair et en anglais / sombre) : les mêmes deux fenêtres de GFS à l'enregistrement par le lien, rien n'est refusé de
  ce que ton app fait.
- Toute autre table de ton app est refusée **sans fenêtre** quand une section publiée la lirait par une Référence : `FormPlus_Formulaires` en tête
  (elle garde la `Definition` de tous tes formulaires, avec leur `shareKey`, leur `formLink` et leur `publicUrl`), mais aussi `FormPlus_Repondants`
  ou toute table `FormPlus_…` que tu poseras un jour. Ton `applyUserActions` est rejeté avec `GFS_REFUSE` : « Ce lot ouvrirait FormPlus_Formulaires à
  la lecture par toute personne qui aurait le lien d'un formulaire : c'est une table de l'app que son manifeste ne déclare pas lisible par un lien
  public (permissions.lienPublic). GFS ne le propose pas à la personne. » À l'ajout rien ne change : une table de ton app est refusée depuis le 22/10.
- Une table de la personne (`Menus`, `Clients`…) lue par une question « Choix depuis une table » passe encore par la fenêtre d'accord, comme avant.

**Ce que tu fais :**

**1. N'offre plus tes propres tables là où un lien les lirait ou les remplirait.** Trois listes de `config-editor.js` prennent `listTables()` en
entier : « Partir de zéro » > « une table existante » (`scratchExistingCombo`), la table source d'une question « Choix depuis une table »
(`srcTable`) et la table de réception d'une question (`writeTable`, `wireSourceAndWriteCombos`). Elles offrent aujourd'hui `FormPlus_Formulaires`,
`FormPlus_Repondants` et tes petites tables ; une table `FormPlus_…` n'y sert à rien, et GFS la refuserait à la publication. **Dans ton app
seule, il n'y a pas de GFS** : ta confirmation (013, points 3 et 4) y est la seule, et un lien publié qui lirait `FormPlus_Formulaires` rendrait les
définitions de tous tes formulaires, clés de partage comprises. Écarte ces tables de ces trois listes, ou grise-les en disant pourquoi : à toi la
manière.

**2. Le préfixe `FormPlus_Pub_` est un contrat avec GFS.** Ne renomme jamais ces tables. Si un lien doit un jour lire une autre petite table, demande-le
dans « Demandes à GFS » de ton `GFS-ETAT.md` avant de la poser (un motif de plus dans `permissions.lienPublic`, avec sa raison dite en français et en
anglais, et l'accord du porteur) : sans cela, GFS la refuse.

**3. Un refus de lecture ne laisse rien à moitié fait**, comme les autres `GFS_REFUSE` (013, point 4) : la section créée et les champs ajoutés sont
retirés, le formulaire reste privé, et tu dis la raison que GFS donne.

## Pourquoi

Un lien lit la colonne entière que montre chaque Référence de ses formulaires, champs cachés compris, sans passer par GFS ni par ses règles
(contrats 11.9, points 1 et 2). Avant le 03/11, GFS refusait à la lecture les tables de GFS et celles d'une autre app, et laissait passer par
l'accord la lecture d'une table de la tienne, parce que ta définition y était lue. Ta 013 a changé cela : un lien ne lit plus que la petite table
de son formulaire. Le porteur a choisi, parmi les options de sa carte du 03/11, que GFS refuse sans demander toute autre table de ton app et ne
propose à la personne que les petites tables que ton manifeste nomme : la table qui garde tous les formulaires n'est ainsi jamais lue par un lien,
même si une personne, par un choix de source de questions, l'accordait dans une fenêtre qu'elle ne lit pas toujours. Les petites tables restent
possibles parce qu'elles sont nommées : GFS ne devine pas ce qui est « petit », il le lit dans le manifeste, et son validateur refuse un manifeste
dont un motif couvrirait la table de tes fichiers. Non mesuré par GFS : ce qu'un vrai lien lit (grist-static n'a pas de partages) ; ta mesure sur
un Grist Docker, citée dans ta 013, reste la preuve.

## Fait quand

Tes trois listes n'offrent plus les tables `FormPlus_…` (ou les grisent avec la raison), un de tes essais le tient, et `GFS-ETAT.md` donne
« 015 · faite · `commit` ». Si tu veux garder une de ces tables dans une liste, ou si un lien doit lire une autre petite table, dis-le dans
« Demandes à GFS » : GFS répond par une consigne.
