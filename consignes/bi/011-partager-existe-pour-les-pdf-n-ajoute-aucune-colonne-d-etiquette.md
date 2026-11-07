# 011 · « Partager » existe pour les PDF : n'ajoute aucune colonne d'étiquette (`Visibilite`, `Personnes`, `Espace`), GFS tient le partage et pose lui-même ses colonnes `GFS_…`

App : Grist-BI · posée le 07/11/2026 · contrats de GFS 11.6 (point 6) et 11.7 (points 2 et 13) · décisions du porteur du 06/11 (« partage libre, invitation demandée » ; colonnes d'aide dans les tables des apps avec l'accord du propriétaire à chaque pose) et du 07/11 (« va » : premier lot codé)
quand : à lire au prochain lot, sans urgence ; aucun code à changer ; vaut dans GFS seulement

## Quoi

**1. Ce qui existe.** Le menu d'un fichier de GFS (clic droit ou « ⋯ ») a une ligne « Partager… » : une fenêtre dit qui a accès au fichier (une adresse, « tous les éditeurs », « tout le document »), avec un droit (lecture seule, écriture, administration), « peut télécharger » et une date de fin. Elle marche pour les PDF que GFS garde (essayée dans un vrai Grist à trois comptes). Pour les fichiers d'une app, la ligne est grisée et un clic dit « le partage de ce type de fichier arrive avec les apps » : rien n'est demandé à ton app pour que cette ligne soit là.

**2. Ce que cela change pour 11.6, point 6.** Ce point te demandait de tenir les colonnes de l'étiquette (`Visibilite`, `Personnes`, `Auteur`, `Espace`) quand une consigne à part en donnerait les noms. **Cette consigne ne viendra pas pour `Visibilite`, `Personnes` ni `Espace` : n'ajoute aucune de ces colonnes.** Le partage d'un contenu vit dans la table `GFS_Partages` de GFS (une ligne par personne et par fichier, clé `<id de ton app>:<identifiant du fichier>`), et GFS ajoutera lui-même à tes tables de contenus des colonnes d'aide `GFS_…` (formules), **avec l'accord du propriétaire du document, demandé à chaque pose**. Tu les tolères (6.1, points 3 et 4), tu ne les lis pas et tu ne les écris jamais, comme le disait déjà le point 6.

**3. Ce que tu gardes.** (a) `Auteur`, écrit à la création de chaque contenu avec l'adresse que GFS te donne (5.2, point 9) ou que ta propre lecture de Grist rend, jamais un champ qu'une personne a tapé : le partage s'appuie sur lui (l'auteur d'un fichier le gère). (b) Un identifiant de fichier qui ne change jamais, celui que tu donnes à GFS dans `ouvrir` et `choisir` (5.4) : c'est la clé du partage. (c) Ta déclaration `classes` (11.2) quand tu ne l'as pas encore : ce sont tes tables `reserve` que GFS couvrira.

**4. Ce qui n'est pas là.** Le partage des fichiers d'app, les dossiers partagés et les groupes ne sont pas codés. Tu n'as rien à écrire pour eux avant qu'une consigne te le dise ; si ton app a déjà ajouté une de ces colonnes, dis-le dans ta page (rien ne s'en perd, GFS ne la lira simplement pas).

## Pourquoi

Une règle de Grist ne lit que la ligne qu'elle protège : pour qu'un partage écrit par une personne qui n'est pas propriétaire suffise, GFS tient une seule table de partages et en tire des colonnes d'aide dans chaque table couverte. Si chaque app gardait sa propre étiquette, il y aurait autant de façons de partager que d'apps, et la fenêtre « Partager » de GFS ne pourrait pas être la même partout (règle « ne pas dupliquer de code »).

## Fait quand

`GFS-ETAT.md` donne « 011 · lue » (aucun code à changer), avec, si c'est le cas, la phrase « j'ai déjà une colonne `Visibilite`, `Personnes` ou `Espace` dans <table> » : GFS la note dans 11.7, point 2.
