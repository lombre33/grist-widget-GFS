# 025 · La barre de GFS : la forme de l'échange (`contexte.barre`, événement `barre`, `barre.masquer`) et ce que ton app en fait

App : Publipostage+ · posée le 21/10/2026 · répond à ta demande « la barre de GFS et la place libre de l'app » (`GFS-ETAT.md`,
« Demandes à GFS »), annoncée au point 3 de la 024 · quand : au prochain lot, sans urgence ; du code dans ton app ; sans effet dans
l'app seule

## Quoi

**1. Ce que le porteur a décidé (21/10).** La barre de GFS se place où la personne le veut : à gauche, en haut, à droite ou en
bas. Les apps adaptent leur interface aux quatre places, sans que rien se recouvre. L'emprise reste minimale : pas de bande en
plus, la barre se pose par-dessus l'espace que les apps laissent vide. C'est le second cas de ta page : la barre recouvre le cadre
de ton app, qui reste plein. Ton « Organiser » reste, ta barre d'outils reste gelée, ton app ne dessine aucun bouton de GFS. Le
cahier (6.3, question 7) est mis à jour.

**2. La forme de l'échange** (contrats 5.1 et 5.2, point 7, écrits avec cette consigne). C'est ce que ta page demandait, avec une
zone de plus :

1. **La barre** : trois boutons à icône seule (« Fichiers », « Apps et extensions », « Position de la barre »), de 34 × 94 px au
   bord gauche ou droit et de 94 × 34 px en haut ou en bas, à 4 px du bord et centrée sur lui. Elle est à gauche tant que la
   personne n'a rien choisi. GFS retient le choix dans son navigateur (`gfs.barre`, comme `gfs.langue`) et n'écrit rien sans un geste
   de la personne. Les deux boutons du coin bas droit n'existent plus.
2. **`contexte.barre`** : `{ bord, epaisseur, zone }` ou `null`. `bord` vaut `gauche`, `haut`, `droite` ou `bas`. `zone` est le
   rectangle à laisser libre, `{ x, y, largeur, hauteur }` en pixels de ton cadre (origine en haut à gauche) : la barre et 4 px
   tout autour. `epaisseur` est la largeur de la zone (bords gauche et droit) ou sa hauteur (haut et bas) : la profondeur dont tu
   écartes ce que tu poses à ce bord, si tu préfères une règle simple. Exemple, cadre de 700 × 400, barre à gauche :
   `{ "bord": "gauche", "epaisseur": 42, "zone": { "x": 0, "y": 149, "largeur": 42, "hauteur": 102 } }`. Ta page demandait
   `{ bord, epaisseur }` : GFS y ajoute la zone, parce que le porteur veut le minimum d'emprise (avec `epaisseur` seule, tu
   réserverais une bande sur toute la longueur du bord ; avec la zone, tu n'écartes que ce qui touche la barre). Hors de la zone,
   le cadre est à toi, coins compris.
3. **`null`** : l'explorateur est ouvert (ton cadre est caché derrière lui), ton app a demandé à ne pas avoir la barre (point 4),
   ou GFS ne l'affiche pas. Seule, ton app n'a pas de barre : `null`.
4. **L'événement `barre`** (`{ barre }`, la même forme) : une seule fois par changement. La personne choisit un autre bord (ou une
   autre section de GFS dans la page le change), le cadre change de taille (la barre est centrée sur son bord : la zone bouge avec
   elle), l'explorateur s'ouvre ou se ferme, tu masques la barre ou tu la rends. Ton cadre n'est jamais rechargé : tu t'adaptes sur
   place. Chaque `contexte` redit l'état d'à présent.
5. **`barre.masquer`** (`{ masquee: true | false }`), pour le diaporama de « Présenter » qui prend tout le cadre : sans `id`, comme
   ta page le demandait, aucune réponse ; avec un `id`, `{ masquee }`, l'état qui vaut. La demande ne vaut que pendant que ton app
   est montrée. GFS remontre la barre quand l'explorateur s'ouvre, quand ton app se ferme et à chaque `contexte` (un cadre rechargé
   repart avec elle). Un argument qui n'est pas vrai ou faux reçoit `GFS_REFUSE` (et GFS le dit en console, comme pour
   `stockage.ecrire`). Comme la barre n'est plus là pour ouvrir l'explorateur, c'est ton diaporama qui offre sa sortie (la touche
   Échap). Un GFS plus ancien ne fait rien d'un appel sans `id` et répond `GFS_INCONNU` à un appel qui en porte un (contrats 5.1,
   point 3) : ton app reste comme aujourd'hui.

**3. Ce que la barre recouvre chez toi aujourd'hui**, tant que ton app n'écarte rien (mesuré avec ton app à `fcca7b4`, dans un vrai
Grist, à 700 × 400 ; `prototype/labo/run-barre-publipostage.mjs`, un modèle ouvert, 46 contrôles visibles) :

| Bord | Ce que la barre recouvre |
|---|---|
| gauche (par défaut) | aucun contrôle d'un modèle (la marge grise à gauche de la page) ; dans une présentation, le début de la bande des diapositives : les numéros et la partie haute des premières miniatures (vu sur une capture de `run-diapositives` : « Ajouter » et « Importer », au bas de la bande, restent libres ; le volet « Importer » ouvert n'a pas été essayé) |
| haut | trois boutons de ta barre d'outils gelée, au milieu de sa première ligne : « Supprimer » (en entier), « Tables liées » (en entier) et « Mode édition » (pour moitié) |
| droite | aucun contrôle d'un modèle |
| bas | rien d'utile (le bas de la page d'édition) |

Le bouton ▶ « Présenter » et la pastille du zoom, au coin bas droit, ne sont plus recouverts : le ▶ se clique à la vraie souris
(`run-diapositives` : 51 vérifications, aucune en échec ; l'échec des deux passes précédentes a disparu). **En haut, ta barre d'outils
est donc la seule qui ne tient pas sans que tu fasses quelque chose** (point 4).

**4. Ce que ton app en fait, à toi d'en décider la manière** (rien n'est à changer d'ici là : sans ton code, la barre recouvre ce
qu'elle recouvre, et la personne la déplace) :

1. Lire `contexte.barre` au démarrage et écouter l'événement `barre` (comme `langue`), sans recharger ton cadre.
2. Écarter de la zone ce que tu poses près d'un bord, aux quatre bords et à toute taille de cadre : ta barre d'outils (en haut), la
   bande des diapositives et le volet « Importer », le ▶ et la pastille du zoom, le logo et la sortie de la Lecture épurée. Une
   règle simple (`epaisseur` de ce côté) ou la zone seule, au choix : GFS n'impose pas la manière.
3. Caler tes menus, bulles et fenêtres sur la zone libre, sans quoi la barre passe par-dessus.
4. Appeler `barre.masquer` à l'ouverture du diaporama (`masquee: true`) et à chaque sortie, quelle qu'elle soit (`false`), en gardant
   ta propre sortie.
5. Seule, tout reste comme aujourd'hui : `contexte.barre` vaut `null`, rien à écarter.

**5. Mesuré dans un vrai Grist** (grist-static 0.1.6 dans Chromium, 700 × 400, à la vraie souris et au vrai clavier, en français /
clair et en anglais / sombre ; `prototype/labo/run-barre.mjs`, 82 vérifications par combinaison) avec une sonde qui fait ce que fera
ton app : aux quatre bords la zone reçue est exactement la barre mesurée dans la page ; un seul événement par changement ; le cadre
de 560 × 300 déplace la zone avec la barre et l'app le sait ; `barre.masquer` va et vient, un argument hors règle est refusé ;
l'explorateur efface la barre et la demande d'une app cachée ne tient pas ; un cadre rechargé repart avec la barre ; le bord choisi
tient au rechargement de GFS et une autre section de GFS le suit ; les coins et les trois autres milieux de côté de l'app restent
cliquables à la vraie souris. **Non mesuré** : ton app elle-même, tant qu'elle n'a pas le code (dis-le-nous quand c'est fait, et la
vérification se rejoue avec elle), Firefox, Safari.

## Pourquoi

Ta page demandait la forme de l'échange avant tout code ; le porteur a fixé ce qu'il veut (point 1), GFS a écrit le contrat, l'a
codé et mesuré (point 5) et te dit ce que cela change chez toi (points 3 et 4). La zone, plus petite qu'une bande, répond au « pas
de bande en plus » du porteur.

## Fait quand

`GFS-ETAT.md` donne « 025 · faite · `<commit>` » quand ton app lit `contexte.barre` et l'événement `barre`, écarte ses éléments de
bord et cale ses menus, bulles et fenêtres sur la zone aux quatre bords, et appelle `barre.masquer` pour « Présenter » (avec sa
propre sortie), ou « lue, pas faite » avec la raison. Il retire alors de « Demandes à GFS » la demande de la barre.
