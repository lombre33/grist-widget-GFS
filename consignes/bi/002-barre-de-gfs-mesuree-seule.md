# 002 · La barre de GFS : ce qu'elle recouvrira chez toi (mesuré avec ton app seule)

App : Grist-BI · posée le 21/10/2026 (nuit) · décision du porteur du 21/10 (la barre au bord que la personne choisit) · quand : à
lire maintenant ; du code à ton entrée dans GFS (guide 1.2) ; rien à changer d'ici là ; sans effet dans l'app seule

## Quoi

**1. La barre de GFS** (contrats 5.2, point 7 ; guide 1.2, point 9). Dans GFS, quatre boutons à icône seule (« Fichiers », « Apps
et extensions », « Table de travail », « Position de la barre »), 34 × 124 px au bord gauche ou droit, 124 × 34 en haut ou en bas,
à 4 px du bord et centrée sur lui ; à gauche tant que la personne n'a rien choisi. Elle se pose par-dessus le cadre de l'app, qui
reste plein : pas de bande en plus. La zone à laisser libre est la barre et 4 px autour : à 700 × 400, à gauche,
`{ "x": 0, "y": 134, "largeur": 42, "hauteur": 132 }`. Une app ne l'écrit jamais en dur : GFS la donne et la redit à chaque
changement.

**2. Ce qu'elle recouvrira chez toi**, tant que ton app n'écarte rien. GFS ne te référence pas encore : ton app (à `23647eb`) a été
mesurée seule dans la section d'un vrai Grist, à 700 × 400, en clair et en sombre, la barre posée par le calcul à la place exacte où
GFS la pose (vérifiée dans GFS chez les trois autres apps) ; `prototype/labo/run-barre-apps.mjs` avec `APP=bi` ; ton accueil relié
de lui-même à une table de deux lignes, une tuile ajoutée (« Nom par Ville », au bout de la page), tes Réglages :

| Bord | Ce que la barre recouvrira |
|---|---|
| gauche (par défaut) | le début de « Page 1 » (34 % du bouton), de « Vues sauvegardées… » (13 %) et de « Exporter en PDF » (17 %) : ton contenu commence à 16 px du bord, la zone en prend 42 |
| haut | rien en haut de la page (le milieu de ta barre de titre est vide) ; plus bas, ce qui passe en défilant |
| droite | le bout de « Exporter en Excel » (7 %) |
| bas | ce qui passe au bas de la vue en défilant (le champ « Dimension », en haut de la page) |

Ta fenêtre Réglages, centrée de y 22 à 378, entre dans la zone en haut et en bas par sa marge seulement : son texte reste libre, de
peu. La tuile mesurée, seule à gauche, reste libre, ses boutons compris ; deux tuiles côte à côte n'ont pas été essayées (les
boutons de celle de droite seraient près du bord droit). Aucune erreur de page n'est survenue.

**3. Ce que ton app en fera dans GFS** (à toi la manière : GFS ne l'impose pas), quand elle aura le lien avec GFS du kit (guide 1.2,
point 4 ; kit 0.2.0, `js/gfs-link.js`, `GfsLink.onBar(barre => …)`, avec `{ bord, epaisseur, zone }` en pixels de ton cadre, ou
`null` quand ton app est seule) : écarter de la zone ce qu'elle pose près d'un bord, aux quatre bords et à toute taille de cadre
(à gauche, le début de tes lignes de boutons ; à droite, le bout de la ligne des exports ; les boutons des tuiles), et caler ses
fenêtres sur la zone libre. Seule, rien ne change.

## Pourquoi

Le porteur a décidé le 21/10 que la barre se place au bord que la personne choisit et que les apps s'adaptent aux quatre places,
sans bande en plus ; il a voulu mesurer chaque app avant de lui écrire. Chez toi, c'est le bord par défaut, à gauche, qui touche le
plus : ton contenu commence plus près du bord que la zone.

## Fait quand

`GFS-ETAT.md` (que crée la 001) donne « 002 · lue » maintenant, puis « 002 · faite · `<commit>` » à ton entrée dans GFS, quand ton
app écarte ces éléments aux quatre bords. GFS la mesure alors dans GFS.
