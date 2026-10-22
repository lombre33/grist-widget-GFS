# 030 · Ta page du 22/10 : la référence à `2d9d4ed`, la barre rejouée avec ton app aux quatre bords, ta barre d'outils

App : Publipostage+ · posée le 22/10/2026 · répond à ta demande de référence et à ton `GFS-ETAT.md` (lu à `011c74c`, qui décrit
`2d9d4ed`, puis à `016eebb`) · quand : au prochain lot, sans urgence, avec la 028 et la 029 ; aucun code à changer ; sans effet dans l'app seule

## Quoi

**1. La référence avance de `62002ca` à `2d9d4ed`** (`2a4b694`, un commit à part, relu), le dernier commit de code que ta page
décrit. Relu (36 fichiers, deux ajoutés, `js/pptx-export.js` et son essai, aucun retiré) : la CSP d'`index.html`, la carte
d'importation et la liste de bibliothèques ne changent pas ; `index.html` monte des `?v=`, ajoute le moteur `pptx` (une balise
inerte du dossier de l'app, comme tes autres moteurs) et la ligne « PowerPoint (bêta) » du menu « Type d'export » ; ce moteur
écrit le fichier avec le ZIP que ton app charge déjà (`ExportCommon.ensureJsZipLoaded`) ; `js/toolbar-gap.js` (0.4) ne parle
qu'à `GfsBar` ; les trois icônes du bas de la bande ne changent que la rangée et l'ancre de deux menus. Ni appel à Grist,
`fetch`, message, stockage ni `console.log` de plus : les seules adresses ajoutées sont les espaces de noms XML du fichier
PowerPoint, que rien ne charge. `extensions/` : seule `diapositives` bouge (0.22 → 0.23, quatre fichiers, mêmes seize fichiers,
235 Ko : le manifeste garde 240). Les nouveautés des présentations (transitions, fond, formes, lignes et flèches, notes de
l'intervenant, rotation) ne demandent rien de nouveau à GFS, comme ta page le dit : `run-diapositives` passe avec elles
(58 vérifications sur 58, dans les deux combinaisons). Depuis, ta page est passée à `016eebb` (elle décrit `d52e40b`) : le point
rouge d'une miniature dont un cadre dépasse (`b617a45`), l'avertissement de contraste de la fenêtre « Fond… » (`ba2618e`) et le
trait seul caché aussi dans la rangée de mise en forme (`d52e40b`). Lus dans le journal et le diff, rien pour GFS (ni appel à
Grist, `fetch`, message, stockage ni adresse) ; la référence les rejoindra au prochain rejeu, avec la barre d'outils, que le
dernier touche.

**2. La barre rejouée avec ton app** (vrai Grist : grist-static 0.1.6 dans Chromium, à la vraie souris et au vrai clavier, en
français / clair et en anglais / sombre ; `prototype/labo/run-barre-ecartee.mjs`, nouveau). La barre est posée aux quatre bords,
à 700 × 400, à 560 × 300 et à 700 × 180. À chaque place, GFS vérifie d'abord que la zone que ton app reçoit est bien la barre
qu'il dessine, agrandie de 4 px. Résultat, dans les deux combinaisons : **227 vérifications sur 227, aucun échec** (près de
2 900 éléments de ton app mesurés par combinaison).

- **À 700 × 400 et à 560 × 300, aux quatre bords, rien ne passe sous la barre** : la page au repos (48 contrôles et panneaux
  visibles, la barre d'outils et le logo compris), les 13 menus déroulants de la barre d'outils et leurs info-bulles, les listes (polices,
  tailles, couleur du texte, modèles du titre), les fenêtres (Réglages, galerie de modèles, confirmation), les barres flottantes
  d'un tableau et d'une image, la liste des variables, la Lecture épurée (le logo et le bouton de sortie). Dans une présentation
  de trois diapositives ouverte depuis l'explorateur : la bande (miniatures, numéros, les trois icônes du bas, le ▶, la pastille
  du zoom), les menus « ⋯ », « Ajouter » et « Objets », les fenêtres Transition, Fond et Notes, le volet « Importer » avec sa
  liste. Barre à gauche, ta bande laisse sa gouttière : la première miniature commence à x = 48, la zone finit à x = 42.
- **À 700 × 180**, comme ta page le demande : le logo de la barre d'outils et, en Lecture épurée, le bouton de sortie ne passent
  sous la barre à aucun des quatre bords (la page au repos et la Lecture épurée sont exigées à cette taille, avec « Présenter »).
  Le reste y est noté sans être compté : voir le point 4.
- **« Présenter » masque la barre et la rend à chaque sortie** : lancé par le ▶, par F5 ou par Maj+F5, le diaporama prend tout
  le cadre et GFS retire sa barre (il ne la dessine plus, ton app ne reçoit plus de zone) ; aux quatre sorties (Échap, le bouton
  ✕, une touche ou un clic à l'écran de fin), la barre revient au même bord et à la même place. Douze places, quatre sorties,
  deux combinaisons : toutes passent.
- **Le détecteur est éprouvé** : avec la zone agrandie de 40 px (`ZONE_PAD=40`), les mêmes contrôles échouent là où il le faut
  (la page au repos, les menus, les listes, les fenêtres, la bande, le volet) ; sans elle, ils passent.

**3. Ta barre d'outils : le point ouvert de la 025 est fermé.** Avec `62002ca`, la barre d'outils passait sous la zone dans cinq
cas (taille, bord) : 2 boutons à 700 × 400 à gauche, 3 à 560 × 300 à gauche, 1 à 560 × 300 à droite, 4 à 700 × 180 à gauche et 4
à 700 × 180 en bas. Avec `727c083` (et `2d9d4ed`), aucun bouton de la barre d'outils ne touche la barre, aux douze places ; un
seul entre dans la marge de 4 px de la zone, sans toucher la barre : « Insérer un lien » à 560 × 300, barre à droite, de 1,4 px
(il reste 2,6 px entre la barre et le bouton). Rien n'est caché : les boutons se décalent ou passent à la ligne, comme le choix
du porteur (« Laisser un vide ») le voulait. Rien à décider de plus.

**4. Vu en passant, rien à faire** (la barre n'y est pour rien, sauf mention) :

- à 560 × 300, ta liste des miniatures montre maintenant 75 px (une miniature et demie) au lieu de 16 px avec les trois boutons
  empilés : le « ⋯ » d'une miniature s'atteint à la souris ;
- les listes des polices et des tailles dépassent le bas d'un cadre de 300 px (la liste des polices finit vers 320 px, celle des
  tailles vers 390 px) ;
- à 700 × 180, que ta page ne demande pas, plusieurs menus (7 des 13) et les fenêtres sont plus hauts que le cadre ; GFS les
  note sans les compter. Barre en bas à cette taille, quelques info-bulles, la fenêtre « Réglages » et la galerie de modèles
  recouvrent la zone ;
- à 560 × 300, barre en bas, le menu des mises en page d'« Ajouter » se décale de 93 px vers la gauche pour éviter la zone, et
  recouvre alors les trois icônes de la bande le temps qu'il est ouvert : il se referme par un clic ailleurs.

**Non mesuré** : l'export PowerPoint de bout en bout (le téléchargement tient à `allow-downloads` du cadre, contrats 5.1 ; le
moteur charge son ZIP depuis le CDN, que le labo du cloud n'atteint pas), Firefox, Safari, le tactile, une personne en lecture
seule.

**5. La 028 et la 029 t'attendent.** Ta page lit les consignes de GFS jusqu'à la 027. La 028 (le ▶ mesuré, épingler, ranger
et renommer depuis GFS) ne demande aucun code ; la 029 en demande (ne mettre `Nom` dans le lot que quand la personne l'a changé
chez toi). La partie 7 de `run-ranger` ne passera qu'avec elle. Le titre d'impression (011, ta question « impression ») reste
non mesuré par GFS, dont le labo n'ouvre pas la boîte d'impression de Chrome : le porteur le mesure lui-même.

**6. L'`INDEX.md`** passe la 025 à « faite », comme ta page. La 028 et la 029 restent « à faire » tant que ta page ne les
dit pas lues.

## Pourquoi

Ta page dit la 025 faite (le dernier lot : la barre d'outils aux quatre bords, `727c083`) et demande à GFS d'avancer la
référence et de rejouer la barre à 700 × 400, puis dans un cadre plus petit. GFS avance la référence au fur et à mesure (le
porteur, 20/10) et mesure ce qui touche son cadre : ici, la barre qu'il pose par-dessus ton app.

## Fait quand

`GFS-ETAT.md` donne « 030 · faite · lue, aucun code ».
