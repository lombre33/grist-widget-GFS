# 003 · La barre de GFS chez toi : « Ajouter » en haut, le journal en bas (mesuré)

App : Automation+ · posée le 21/10/2026 (nuit) · décision du porteur du 21/10 (la barre au bord que la personne choisit) · quand :
au lot où tu prends le lien avec GFS du kit (guide 1.2, point 4) ; rien à changer d'ici là ; sans effet dans l'app seule

## Quoi

**1. La barre de GFS** (contrats 5.2, point 7 ; guide 1.2, point 9). Quatre boutons à icône seule (« Fichiers », « Apps et
extensions », « Table de travail », « Position de la barre »), 34 × 124 px au bord gauche ou droit, 124 × 34 en haut ou en bas, à
4 px du bord et centrée sur lui ; à gauche tant que la personne n'a rien choisi. Elle se pose par-dessus ton cadre, qui reste
plein : pas de bande en plus. La zone à laisser libre est la barre et 4 px autour : à 700 × 400, en haut,
`{ "x": 284, "y": 0, "largeur": 132, "hauteur": 42 }`. Ne l'écris jamais en dur : la barre a déjà changé de taille une fois.

**2. Ce qu'elle recouvre chez toi**, tant que ton app n'écarte rien (mesuré avec ton app à `4110eaf`, celle que GFS référence,
dans un vrai Grist, à 700 × 400, en français / clair et en anglais / sombre ; `prototype/labo/run-barre-apps.mjs` avec
`APP=automation` ; ta question de la table au démarrage, ton graphe après « Ne pas créer » avec deux nœuds ajoutés par « Ajouter »,
ton journal ouvert, tes Réglages) :

| Bord | Ce que la barre recouvre |
|---|---|
| gauche (par défaut) | rien : le fond de ton graphe seulement, qui se déplace |
| haut | « Ajouter », le premier bouton de ta barre d'outils (à x 372 en français) : le « + » et le début du mot en français (45 % du bouton), son bord gauche en anglais (16 %) |
| droite | rien : le fond de ton graphe |
| bas | le début des lignes de ton journal ouvert (10 % du panneau, posé en bas à droite à partir de x 330) ; le bas d'un nœud quand il descend jusque-là, que le graphe permet de remonter |

Ta question de la table et ta fenêtre Réglages restent hors de la barre aux quatre bords. Le courtier ne t'a rien refusé pendant la
passe, et aucune erreur de page n'est survenue.

**3. Ce que ton app en fera** (à toi la manière : GFS ne l'impose pas), quand elle aura le lien avec GFS : le kit 0.2.0
(`js/gfs-link.js`, commit `c0c8660` de `lombre33/grist-factory-kit`, sous-module `kit/`) donne `GfsLink.onBar(barre => …)`,
appelé aussi à l'arrivée du contexte, avec `{ bord, epaisseur, zone }` en pixels de ton cadre, ou `null` (l'explorateur ouvert, ou
ton app seule) ; `GfsLink.bar()` le relit.

1. Barre en haut : ta barre d'outils s'écarte de la zone.
2. Barre en bas : ton journal s'écarte de la zone.
3. Tes menus (celui d'« Ajouter », le clic droit sur le fond), bulles et fenêtres se calent sur la zone libre (le menu
   d'« Ajouter » n'a pas été mesuré ouvert).
4. Seule, rien ne change : `GfsLink.bar()` vaut `null`.

Le même lien donne la langue de GFS (guide 1.2, point 8) : dans GFS, tes boutons FR et EN des Réglages se grisent alors avec la
raison ; aujourd'hui, ils restent actifs.

## Pourquoi

Le porteur a décidé le 21/10 que la barre se place au bord que la personne choisit et que les apps s'adaptent aux quatre places,
sans bande en plus ; il a voulu mesurer chaque app avant de lui écrire. Chez toi, deux éléments seulement passent sous la barre,
à deux bords.

## Fait quand

`GFS-ETAT.md` donne « 003 · lue » d'ici là, puis « 003 · faite · `<commit>` » quand ton app lit la barre par le lien du kit et
écarte sa barre d'outils (en haut) et son journal (en bas). GFS rejoue alors la mesure avec ta version, aux quatre bords.
