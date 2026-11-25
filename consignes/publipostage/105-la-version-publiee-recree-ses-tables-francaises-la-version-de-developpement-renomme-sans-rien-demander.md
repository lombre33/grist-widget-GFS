# 105 · GFS a mesuré la version publiée et la version de développement : la première recrée ses tables françaises à côté d'un document renommé, la seconde renomme sans rien demander ; ce que ça change pour ta prochaine publication

App : Publipostage+ (`lombre33/publipostageGrist`) · posée le 25/11/2026 · remplace la question c de la 104 et la question a de la 102 (GFS y a répondu lui-même) · décision du porteur du 25/11 (« une fenêtre commune », bloquante, jamais en silence ; « aucun document perdu ») · faits vérifiés 165 · suite des 102 et 104
quand : à lire avec la 104, au prochain lot ; un petit changement de code tout de suite (point 3.a), puis une règle pour ta prochaine publication (point 3.b)

## Quoi

**1. Ce que GFS a lu et mesuré** (faits vérifiés 165 ; le dépôt public `grist-factory/Publipostage-Plus` lu en lecture seule, les deux versions rejouées dans un vrai Grist, 700 × 400, app seule) :
- **La version publiée (1.1.2, du 06/11) ne renomme rien et ne lit que les noms français** (`Publipostage_Modeles`…). Devant un document que ta version de développement a déjà renommé, elle **recrée sans poser de question** ses trois tables françaises (vides) et leurs pages à côté des anglaises : la personne ne voit plus ses modèles (liste vide, « Commencez à écrire votre modèle ici… »). **Rien n'est perdu** : les modèles restent dans les tables anglaises ; mais ils sont cachés, et la fenêtre « Créer les tables ? » ne revient pas (elle ne se pose que lorsqu'aucune table `Publipostage_*` n'existe).
- **La version de développement renomme sans rien demander** : dès qu'une personne qui peut modifier ouvre le widget hors de GFS, `migrate()` passe le document en anglais à la première lecture ou écriture. Aucune fenêtre, aucune vérification de propriétaire, cinq modèles gardés (mesuré).
- **Les deux versions affichent `PP_VERSION = '1.1.2'`** : le numéro ne dit pas laquelle tourne.
- La réponse à ta question a (102) et à la question c (104) est donc celle-ci ; tu n'as plus à les traiter, sauf si le dépôt public a changé depuis le 06/11. La question b de la 102 (la copie « legacy » de la Beta) reste ouverte : le dossier `beta/` du dépôt public est la copie figée de la bêta 1.0.0-beta.1, mêmes noms français, seul le porteur y publie.

**2. Pourquoi cela compte maintenant** : le porteur a décidé le 25/11 que **rien ne se renomme sans que la personne le sache, et seulement si elle peut le faire**. Aujourd'hui, un document ouvert **une seule fois** par la version de développement devient illisible, sans bruit, pour les gens sur la version publiée (cas 5 du rapport de GFS, mesuré avec le vrai code). Et la **prochaine publication** sur le dépôt public mettrait cette même règle chez tout le monde d'un coup.

**3. Ce que tu fais** :
- **a. Tout de suite (au prochain lot)** : dans le widget tel qu'il est servi, **`renameDocuments` n'est plus allumé** par défaut : plus de renommage en silence. Les documents déjà renommés restent lus (tu lis les deux jeux) ; les documents d'avant gardent leurs noms jusqu'à la fenêtre de la 104. `englishOnDisk` ne change pas (une table neuve naît en anglais). Un test échoue sur l'ancien code (un document aux noms d'avant, widget ouvert : aucune action de renommage envoyée).
- **b. Avant la prochaine publication sur `grist-factory/Publipostage-Plus`** (seul le porteur la fait, depuis sa machine : dis dans `GFS-ETAT.md` quand tu es prêt) : la version contient **la fenêtre commune de la 104**, lit les deux jeux de noms, **ne recrée jamais une table française quand l'anglaise existe**. Une version qui renomme sans la fenêtre **ne se publie pas**.
- **c. Un numéro de version à toi pour le développement** (par exemple un suffixe `-dev`), pour que « quelle version ? » ait une réponse : le numéro de la publiée ne s'écrit que dans la publiée.

## Pourquoi

Les gens sont toujours sur le lien de la dernière version : ce qui sort sur le dépôt public arrive chez tous d'un coup, sans retour possible pour un document déjà renommé. La fenêtre de la 104 est faite pour cela ; il faut seulement qu'elle précède toute publication qui renomme, et que le développement cesse de renommer en silence en attendant.

## Fait quand

`GFS-ETAT.md` donne « 105 · faite · lue » avec : le commit du point a (renommage éteint par défaut, son test), le numéro de version du développement, et la mention « prête à publier » du point b une fois la 104 faite. GFS refait la mesure avec ta version (`prototype/labo/run-noms-silencieux.mjs`, `run-noms-live.mjs`).
