# 026 · Ta page du 21/10 (soir) : la référence à `15aa696`, les diapositives liées mesurées dans GFS, la barre à quatre boutons

App : Publipostage+ · posée le 21/10/2026 · répond à ton `GFS-ETAT.md` (`5c6575a`, qui décrit `15aa696`) · quand : au prochain
lot, sans urgence, avec la 024 et la 025 ; aucun code à changer pour les diapositives liées ; le point 3 complète la 025 ; sans
effet dans l'app seule

## Quoi

**1. La référence avance de `fcca7b4` à `15aa696`** (`600f2c9`, un commit à part, relu), le dernier commit de code que ta page
décrit. `fd4af98` (les menus « + », « Mode lecture » et « Type d'export » refermés au clic) et `487d66b` (la 024 dans ton code)
suivront quand ta page les décrira.

1. Relu dans le diff (119 fichiers, dont 91 essais) : la CSP d'`index.html`, la carte d'importation, la liste de bibliothèques
   et les adresses ne changent pas ; `index.html` change ses textes de secours et la marque `data-close-on-click`, charge
   `js/slide-links.js` et monte ses `?v=` ; `js/gfs-link.js`, `js/gfs-open.js`, `js/templates.js` et `js/grist-api.js` ne
   changent pas. Ni table, colonne, clé de réglages, table `_grist_*`, permission ni adresse de plus : rien à déclarer. Les
   écritures des diapositives liées passent par ce qui était déjà là (`Templates.saveContent`, `alsoWrite` de `Templates.save`,
   `Templates.ensureToken`), dans la table de tes fichiers.
2. Le poids de Diapositives passe de 141 à 165 Ko dans le manifeste (`78bcdb1`), comme ta page le calculait (165 473 octets) :
   l'essai de GFS qui compare chaque poids au dossier de ton app l'exigeait. Édition collaborative (74 Ko) et Graphique (64 Ko)
   ne bougent pas.
3. Les essais de GFS qui cherchent un bouton par son texte suivent les tiens (`d29aa41`) : « Ne pas enregistrer » (« Don’t
   save »), l'onglet « Insertion », et le texte exact du bouton, puisque « Enregistrer » est aussi dans « Ne pas enregistrer ».
   Rien à faire chez toi.

**2. Les diapositives liées, mesurées dans GFS** (vrai Grist : grist-static 0.1.6 dans Chromium, 700 × 400, à la vraie souris
et au vrai clavier, en français / clair et en anglais / sombre ; `prototype/labo/run-diapositives.mjs`, partie 3 bis, avec le
protocole de ta page : deux présentations dans le même document ; 57 vérifications sur 57 dans les deux combinaisons) :

- la case « Garder liée » (« Keep linked ») est dans le volet « Importer », décochée, et se coche à la souris ;
- une miniature de la source cliquée arrive dans la présentation, liée, avec sa pastille (« Liée à « … », dans les deux
  sens ») ;
- la ligne de la source reçoit tout de suite le numéro de la diapositive (`data-slide-id`) et son jeton ;
- un texte changé puis Ctrl+S : la présentation et la source s'écrivent dans le même lot (relevé dans le cadre de ton app) ;
  rouverte depuis l'explorateur de GFS, la source porte le changement ;
- le courtier ne refuse rien : tes écritures ne touchent que `Publipostage_Modeles`, `Publipostage_UserProbe` et
  `Publipostage_Versions`, sous ton préfixe ; aucun refus de la CSP, aucun avertissement de GFS ; l'extension charge ses sept
  fichiers (quatre scripts, trois feuilles de style), une fois chacun.

**Non mesuré** : la colonne `Jeton` créée au premier besoin (le document de l'essai l'avait déjà), les sens « Suit la source »
et « Envoie à la source », la fenêtre des deux versions, deux personnes ou deux onglets à la fois, Firefox, Safari.

**3. La barre de GFS a un bouton de plus** (contrats 4.5 et 5.2, point 7, depuis le 21/10 au soir) : « Table et ligne de
travail », entre « Apps et extensions » et « Position de la barre ». La personne y choisit une table et une ligne, que ton app
reçoit comme celles de sa section (`getSelectedTableId`, `onRecord`, `onRecords`) ; changer de table rouvre ton app. Rien à
changer chez toi : mesuré avec ton app à `15aa696` (`run-travail`, 20 vérifications), elle lit sa convocation sur la ligne
choisie et suit le changement de ligne sans être rouverte.

La barre mesure maintenant 34 × 124 px au bord gauche ou droit, 124 × 34 en haut ou en bas. À 700 × 400, à gauche,
`contexte.barre` vaut `{ "bord": "gauche", "epaisseur": 42, "zone": { "x": 0, "y": 134, "largeur": 42, "hauteur": 132 } }`
(au lieu de `"y": 149` et `"hauteur": 102` dans l'exemple de la 025). La forme de l'échange ne change pas : lis
`contexte.barre.zone` et l'événement `barre`, jamais un chiffre écrit dans ton code, qui serait faux dès que la barre change,
comme ce soir.

Ce qu'elle recouvre chez toi, refait avec ton app à `15aa696` (`run-barre-publipostage.mjs`, un modèle ouvert, 46 contrôles
visibles), à la place du tableau du point 3 de la 025 :

| Bord | Ce que la barre recouvre |
|---|---|
| gauche (par défaut) | « Appliquer le dernier surlignage », pour 17 % ; dans une présentation, la colonne des numéros de la bande des diapositives, et la pastille d'une diapositive liée quand elle tombe à sa hauteur (relevé par `run-diapositives`) |
| haut | quatre boutons de ta barre d'outils : « Supprimer » et « Tables liées » en entier, « Mode édition » presque en entier (97 %), « Enregistrer » pour 43 % |
| droite | aucun contrôle |
| bas | rien d'utile (le bord de la page d'édition, 1 %) |

C'est ce que la 025 te demande d'écarter (son point 4), qui ne change pas.

**4. Le reste, sans écart**, avec ton app à `15aa696` : l'ouverture depuis l'explorateur (28 vérifications) et la langue de GFS
(25), en français / clair et en anglais / sombre ; l'écriture en direct (60), la barre (7), le rangement dans l'explorateur
(11), la ligne de travail (20) et la démo des inscriptions (34), en français / clair.

**5. Ouvert** : la 024, que ton code fait à `487d66b` (GFS la mesurera avec ton app quand ta page la décrira), et la 025 ; le
titre d'impression (011), que le porteur mesure ; la 016 attend la bascule.

## Pourquoi

Ta page décrit `15aa696` et ses diapositives liées, qui écrivent dans d'autres lignes de ta table que celle de la présentation
ouverte : il fallait vérifier que le courtier les laisse passer dans le cadre isolé, ce que tes essais en GFS simulé ne
pouvaient pas dire. La barre a grandi le même soir : ce qu'elle recouvre chez toi change (point 3).

## Fait quand

`GFS-ETAT.md` donne « 026 · faite · lue, aucun code ».
