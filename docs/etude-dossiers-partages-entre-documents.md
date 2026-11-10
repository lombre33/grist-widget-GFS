# Dossiers partagés entre deux documents Grist (étude du 10/11, rien n'est codé)

Suite de « Partager > Un autre document Grist… » et de « Partagés avec moi » (contrats 6.6, point 17). Go du porteur le 10/11 ; **la carte
« Que doit voir l'autre document quand vous partagez un dossier ? » attend sa réponse avant tout code.** Cette étude dit ce qui est déjà
vrai dans le code, ce que chaque réponse coûte, et ce qui peut se préparer sans elle.

## Ce que le code dit déjà (lu, pas encore mesuré pour un dossier)

1. **Le dossier d'un fichier n'est pas dans `GFS_Fichiers`.** Il tient à `GFS_Rangement` (rangement de la personne, pour « Moi ») ou à
   `GFS_Placement` (partagé, pour un espace : `js/spaces-filing.js`). Un dossier partagé ne peut donc pas être « une colonne de plus »
   que le moteur exporte : le dossier est la **liste des fichiers qui y sont** au moment du partage.
2. **Un partage = une table reçue.** Chaque partage arrive dans sa propre table (`GFS_Recus`, `GFS_Recus_2`…) et son journal
   (`GFS_Journal_<nom de l'export>`) garde le nom de l'export, le document qui l'envoie (`note.name`, `note.from.docName`, kit
   `logic/received.js`). **Un dossier partagé = un partage nommé comme le dossier** : le côté qui reçoit peut montrer chaque table reçue
   comme un dossier, avec le nom du partage, sans colonne de plus.
3. **« Accepter d'un coup » est déjà presque là** : la réponse écrit `Accepte` ou `Refuse` sur une ligne (`answerFile`) ; pour un dossier, la
   même écriture sur toutes les lignes de la table reçue, en un seul lot d'actions.
4. **Suivre un dossier à jour** : le moteur n'envoie un fichier neuf que si GFS l'ajoute à la condition de l'export (faits vérifiés 69,
   `saveChosenExport`, essai « un fichier de plus » du labo des arrivées). Suivre un dossier, c'est relancer ce calcul quand un fichier y
   entre, en sort ou y est créé : **seulement quand la page de l'envoyeur est ouverte** et que la personne est propriétaire (la boucle du
   moteur ne tourne que page ouverte, faits vérifiés 76).

## Ce que chaque réponse de la carte coûte

| Réponse | Envoi | Réception | Reste à décider |
|---|---|---|---|
| **A. Le dossier, à accepter d'un coup** (conseillée) | un export nommé comme le dossier, ses fichiers en condition | une ligne « dossier » dans « Partagés avec moi » (nombre de fichiers, « À accepter ») ; un oui marque toutes ses lignes ; un fichier ajouté ensuite arrive grisé | le dossier partiellement refusé ; le regret (un refus tient aujourd'hui) |
| **B. Le dossier, accepté une seule fois** | comme A | comme A, plus **un état de la table** (« tout accepter à l'avenir ») à retenir quelque part, car une colonne par ligne ne le dit pas ; chaque ligne neuve reçoit `Accepte` à l'arrivée, **écrit par GFS** (donc seulement page ouverte) | où retenir l'état (une ligne de `GFS_Rangement`, clé `gfs.…`) ; ce qui se passe page fermée |
| **C. Les fichiers à plat** | comme A | rien de nouveau : chaque fichier à accepter, le nom du dossier en légende | un fichier ajouté ensuite n'arrive que si la personne repartage |

## Ce qui ne dépend pas de la réponse (la base commune)

- **Envoyer** : « Partager… » sur un dossier ouvre l'onglet « Dans un autre document Grist » avec la condition prise sur les fichiers du
  dossier (aujourd'hui l'article est grisé pour un dossier qui n'est pas d'un espace : `share-control.whyNotFolder`).
- **Nommer** le partage comme le dossier, à l'envoi (le nom survit dans le journal reçu).
- **Montrer** les tables reçues, à la réception, par partage plutôt qu'à plat, avec le nom du partage.

## Questions encore ouvertes (une carte chacune, quand elles servent)

1. Les dossiers de « Moi » se partagent-ils vers un autre document, ou seulement ceux d'un espace ? (Dans le document, « Moi » n'a pas de droits à
   donner ; entre documents, il n'y a pas de droits, seulement une copie.)
2. Un dossier avec des sous-dossiers : tout, ou le niveau du dossier ?
3. Un fichier qui est dans deux dossiers partagés arrive deux fois (une table par partage) : le dire, ou le dédoublonner ?
4. Retirer un fichier du dossier partagé : il disparaît chez l'autre, ou la copie reste (réception « en archive », `Supprimee_a_la_source`) ?

## Lots proposés après la réponse

1. **Envoyer un dossier, une fois** : l'article de « Partager… » dégrisé, l'export nommé comme le dossier, essai dans un vrai Grist.
2. **Recevoir un dossier** : la vue « Partagés avec moi » par partage, « Accepter le dossier » d'un coup, essai dans un vrai Grist et sous Firefox.
3. **Suivre le dossier** (« à jour ») : le calcul relancé quand un fichier entre ou sort, page ouverte.
4. **Sous-dossiers**, si la carte le veut.

Chaque lot passe par `git fetch origin main` juste avant le push, avec ses essais (vrai Grist, Firefox 700 × 400, clair/sombre, français/anglais).
