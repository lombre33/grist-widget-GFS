# 072 · Le rangement de ta table fait foi dans GFS : relis ta liste, montre les dossiers vides, et la garde `popup &&` (décision du porteur)

App : Publipostage+ · posée le 17/11/2026 · remplace rien · décision du porteur du 17/11 (carte « Comment harmoniser les dossiers de GFS et ceux de Publipostage+ ? », choix « Le rangement de Publipostage+ fait foi ») et du 10/11 (la garde du point 3) · quand : au prochain lot, sans urgence ; du code dans ton arbre de modèles (`js/template-preferences.js`, `js/template-tree-select.js`) ; rien ne change pour ton app ouverte seule, que le porteur veut garder utilisable seule

## Quoi

**1. Ce que GFS fait depuis le 17/11** (contrats 2.4, `rangement.ecriture` ; 6.4, point 8 ; faits vérifiés, 111). Le porteur a vu un dossier créé, ou un modèle déplacé, dans l'explorateur de GFS ne pas se retrouver chez toi (ses mots : « la création de dossier et le déplacement des fichiers dans l'explorateur de GFS ne sont pas synchronisés avec l'explorateur disponible dans Publipostage+ »). Il a choisi : **ta table fait foi, GFS y écrit, et les dossiers vides se gardent chez toi aussi**. Le manifeste de GFS déclare donc que GFS écrit `Publipostage_PreferencesModeles` (colonnes `Utilisateur`, `ModeleId`, `Dossier`, `Epingle`), par sa propre connexion, dans les lignes de la personne (la même adresse que ton `user.Email`) :

- déplacer ou épingler un modèle : GFS met à jour ta ligne (personne × modèle), ou en ajoute une ; plus rien n'est rangé à part pour tes modèles dans `GFS_Rangement` ;
- « Nouveau dossier » : une ligne d'état comme la tienne (`ModeleId = 0`, `Dossier` = le chemin, `Epingle = false`, `Replie` laissée vide : le dossier s'ouvre déplié) ; supprimer un dossier vide retire ses lignes d'état ;
- GFS n'ajoute jamais une colonne ni une table chez toi : sans ta table ou sans l'une de ces quatre colonnes, il range comme avant, chez lui.

Ce que GFS avait déjà rangé pour tes modèles passe chez toi au premier rangement et part de `GFS_Rangement` : les deux listes n'en font plus qu'une, que tu ouvres seule ou dans GFS.

**2. Ce que GFS te demande** (le but vient du porteur, le moyen est le tien) :

- **a. Relire ta liste quand la personne revient de GFS.** Ton cache est chargé une fois (`loadNow`) : une ligne que GFS écrit pendant que ton widget est ouvert n'y est pas, et ton `upsert` peut alors ajouter une seconde ligne pour le même modèle (GFS met à jour toutes celles qu'il trouve ; toi tu lis la dernière). GFS n'a pas d'événement « l'app revient » à te donner et n'en invente pas sans carte : à toi de choisir le moment (par exemple à chaque ouverture de ton arbre des modèles, avant son rendu, ou au retour du focus de la page). Dis dans ta page d'état lequel.
- **b. Montrer un dossier qui n'a que sa ligne d'état.** Aujourd'hui `listFolders()` ne voit que le champ `Dossier` des lignes de modèles, et `folderStates` ne sert qu'à l'état replié : un dossier créé dans GFS reste donc invisible chez toi. Le porteur veut les dossiers vides « dans les deux » : montre-les dans ton arbre (replié ou non d'après `Replie`), sans modèle dedans, comme les autres dossiers. Un dossier existe tant qu'une ligne le nomme, celle d'un modèle ou celle d'un état (contrats 6.4, points 1 et 11). Le retirer d'un geste chez toi, si tu en donnes un, retire ses lignes d'état (`ModeleId = 0`, ce `Dossier`, la personne) ; en créer un vide depuis ton arbre n'est pas demandé, mais si tu le fais, écris la ligne d'état de même forme.
- **c. La garde `popup &&`** (choix du porteur du 10/11, « la joindre à la prochaine consigne ») : à `js/template-tree-select.js`, ligne 309 à `946a0a1`, `GfsBar.onChange(() => { if (popup.classList.contains('is-open')) positionPopup(); })` peut être appelé avant que `popup` existe (une ouverture sur trois sous Firefox) : GFS journalise « [GfsBar] abonné en échec … popup is undefined ». Mets `popup &&` devant le test.

**3. Ce que tu gardes tel quel**, ou que tu dis avant de changer : le nom de ta table, `ModeleId = 0` comme marque d'une ligne d'état, et les colonnes `Utilisateur`, `ModeleId`, `Dossier`, `Epingle` : GFS les lit et les écrit d'après le `rangement` de son manifeste (`manifestes/publipostage.json`) ; un changement de l'une d'elles est une consigne à GFS, pas une surprise.

**4. Pas demandé** : lire `GFS_Rangement` (tu ne la connais pas et GFS n'en a plus besoin pour tes modèles) ; un appel de GFS pour ranger ; le `dossier` passé à l'ouverture (`js/gfs-open.js`) ; un autre rangement que le tien pour tes modèles.

## Pourquoi

Le porteur veut un seul rangement par modèle, vu pareil dans l'explorateur de GFS et dans ton arbre, **et** ton widget utilisable seul : « le rangement de Publipostage+ fait foi, GFS écrit aux deux, les dossiers vides dans les deux aussi ». Mesuré dans un vrai Grist (`labo/run-rangement-app.mjs`, 19 vérifications, 5 qui échouent sur l'ancien code) : GFS écrit ta ligne, ta liste et celle de GFS sont les mêmes. Ton app n'a pas été ouverte dans ce banc : ce que GFS ne peut pas mesurer, c'est ce que **tu** lis (a et b) ; c'est ton essai, avec le même document ouvert par GFS puis par toi seul.

## Fait quand

`GFS-ETAT.md` dit « 072 · faite · `<commit>` » (ou « 072 · lue » avec la question qui te bloque) ; un test échoue sur l'ancien code pour chaque point : (a) une ligne ajoutée à ta table par une autre connexion pendant que ton widget est ouvert est lue au moment que tu as choisi, sans doublon dans l'arbre ; (b) une ligne `ModeleId = 0` sans modèle donne un dossier vide dans ton arbre ; (c) l'abonné de `GfsBar.onChange` appelé avant la création de `popup` ne lève plus. Mesuré à 700 × 400, à la vraie souris, en clair et en sombre, dans un vrai Grist si tu en as un, sinon dans ton banc ; ouvert seul, ton widget montre toujours son rangement sans GFS.
