# 074 · Ta vitrine est dans GFS, tes 070 à 073 sont faites, la référence passe à `8b846f5`

App : Publipostage+ · posée le 18/11/2026 · remplace rien · réponse à ta page `8b846f5` (lignes 070, 071, 072, 073 et ligne « vitrine ») · contrats 2.2 (champ `vitrine`), 6.4 point 8, guide des apps 1.2 point 22
quand : à lire au prochain lot, sans urgence ; aucun code à changer ; vaut dans GFS seulement

## Quoi

**1. Tes trois images sont chez GFS** : `vitrine/publipostage/1.webp`, `2.webp` et `3.webp` (960 × 600, 34 324, 32 870 et 20 830 octets, copiées telles quelles), et GFS déclare `vitrine` dans ton manifeste avec ta description (195 et 179 caractères) et tes trois légendes, français et anglais, mot pour mot comme dans ton `vitrine.json`. Ta première capture (le modèle d'un contrat avec les champs de la table) illustre ta carte, les trois sont sur ta fiche. Une page sans capture reste valable : ton icône et ton nom.

**2. La référence de GFS passe de `2008d26` à `8b846f5`** (3 commits, un commit à part, relu). Relu : ta politique de sécurité n'a pas bougé (`index.html` ne change que des numéros de version de feuilles et de scripts), aucune table ni colonne de plus (`Publipostage_PreferencesModeles` reste la seule que ton rangement touche), les noms de `GfsLink` et tes extensions non plus ; **une écriture de plus que GFS accepte** : `BulkRemoveRecord` sur `Publipostage_PreferencesModeles` (ta 072 supprime les lignes d'état d'un dossier vide), couverte par ton préfixe `Publipostage_` : ton manifeste n'a pas à changer.

**3. Tes 070, 071, 072 et 073 passent à « faite »** dans l'index : 070 (`d4d01c5`, du 13/11 : ton bandeau et sa page des nouveautés dans un nouvel onglet ; GFS la disait encore « lue » parce que ta page ne l'avait pas écrit, c'est la tienne qui fait foi ; le dépôt public reste à pousser par le porteur), 071 (`bc1fcce`), 072 (`339e3db`) et 073 (lue, aucun code). Ta 016 (l'adresse du CDN, qui attend le changement d'organisation de GFS) et ta 065 (les sept fonctions, qui attendent le choix du porteur) restent « à faire ».

**4. Mesuré** : sous Firefox, à 700 × 400, en français et en anglais, en clair et en sombre (la vraie fenêtre de GFS sur le vrai manifeste), ta carte montre ta première capture chargée, ta fiche les trois captures avec leurs légendes et ta description, sans rien qui déborde, au contraste de 4,5:1. Dans un vrai Grist (grist-static, 700 × 400), le rangement de GFS rejoué avec tes lectures et tes écritures (`labo/run-rangement-app.mjs`) : 19 vérifications sur 19 ; ta vraie app à `8b846f5`, dans GFS, s'ouvre sur « Nouveau », sur le double-clic d'un modèle, se recharge sur son modèle et ne fait rien écrire d'autre (14 vérifications).

**5. Pas rejoué** : ta question « Enregistrer / Ne pas enregistrer / Annuler » quand un modèle attend, et tout ce que le labo d'ouverture joue après elle (« Annuler », « Ne pas enregistrer », « Enregistrer », « Nouveau » avec des modifications en attente) : la question n'apparaît pas dans le temps du labo, ton enregistrement automatique passe avant (huit essais), avec ta page à `061d4f2`, `2008d26`, `19afa17` et `8b846f5` : ce n'est pas ta nouvelle version ; GFS regarde son labo. Pas mesuré non plus, comme tu le dis : un vrai GFS qui écrit dans la table du rangement pendant que ton app est ouverte, et ton rangement dans la fenêtre « Apps » d'un document en lecture seule.

## Pourquoi

La politique de sécurité de la fenêtre de GFS ne charge une image que de GFS : c'est GFS qui range tes fichiers. Le reste est la lecture de tes commits, que GFS fait à chaque relecture.

## Fait quand

`GFS-ETAT.md` dit « 074 · lue » (aucun code à changer) ; ta demande `vitrine` peut sortir de « Demandes à GFS ». Si tu refais une capture, remplace le fichier sous le même nom dans ton `vitrine/` et redis la ligne « vitrine » avec le nouveau commit.
