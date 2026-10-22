# 033 · Ta page du 22/10 : GFS te sert en direct depuis ton site, la référence à `865afa3`, tes cinq points rejoués, le plein écran

App : Publipostage+ · posée le 22/10/2026 · répond à ton `GFS-ETAT.md` (lu à `55bf715`, qui décrit `865afa3` ; consignes lues jusqu'à la
032) · quand : au prochain lot, sans urgence ; aucun code à changer ; sans effet dans l'app seule

## Quoi

**1. Ta première demande est faite : GFS te sert en direct** (`4394fb0` ; contrats 1.3, point 2 ; décision du porteur du 22/10,
« servir les dépôts live, pas une copie figée »). Le moyen, que ta page laisse à GFS : **un cadre vers ton adresse en ligne**,
`https://lombre33.github.io/publipostageGrist/index.html` (l'origine de GFS, le site de ton dépôt de développement, l'entrée de ton
manifeste). Ce que tu pousses est ce que le porteur voit dans GFS, après les 10 minutes de cache de GitHub Pages. Après la bascule
sous `grist-factory`, l'adresse sera celle que donnera la consigne qui remplace la 016. Rien ne change pour la sécurité : le
sous-cadre reste sans `allow-same-origin`, la CSP de GFS ne bouge pas (`frame-src 'self'` laisse passer les sites d'un même compte),
et l'adresse est calculée par GFS d'après son catalogue, jamais lue dans un réglage, une table ou un message. Si ton site ne répond pas
en 15 secondes, GFS ouvre la copie de son sous-module dans le même cadre et le dit une fois (« Publipostage+ : la dernière version ne
répond pas, GFS ouvre sa copie figée. »). `live=0` dans l'adresse du widget ouvre la copie : c'est ce que mesure le labo, et ce que GFS
livrera à un client (la livraison reste figée).

**2. Ce que ça change pour ta page.** Plus de référence à avancer : GFS avance la sienne de lui-même, pour ses mesures et son repli
(elle est maintenant à `865afa3`). Ta page prévient des changements de contrat, comme tu l'as écrit : ce que GFS lit ou donne à l'app,
ce que l'app écrit ou lui demande (tables, colonnes, clés de réglages et de stockage), les adresses, les bibliothèques, la CSP et la
carte d'importation, les poids des extensions de ton manifeste, les permissions ; chaque entrée avec son commit et ce que GFS doit
rejouer. Garde ton site publié et ton entrée `index.html` à la racine. Le poids de l'extension `diapositives` dans le manifeste de
GFS passe de 268 à 269 Ko (269 039 octets, quinze fichiers, version 0.31) : GFS le reporte à chaque rejeu, d'après ta page.

**3. La référence avance de `84002e4` à `865afa3`** (un commit à part, relu). Sept commits, dont quatre de code : « Présenter » avec son
menu ▾ et l'interrupteur « Plein écran » (`4dfcd0c`, 0.29), la diapositive posée en texte qui suit sa source (`df29c5e`, 0.30), le
numéro de page, la note de bas de page et la case conditionnelle dans le choix des bulles (`fa08836`), « Objets » qui passe de la bande à
la barre d'outils du haut (`865afa3`, 0.31). Relu : la CSP d'`index.html`, la carte d'importation et la liste de bibliothèques ne
changent pas ; `index.html` ajoute deux scripts et une feuille de style du dossier de l'app (`js/slide-copies.js`, `js/objects-menu.js`,
`css/slide-copies.css`) et le groupe `#v2-objects-group` de la barre d'outils ; l'extension `diapositives` n'a plus `slide-objects.js` ni
`slide-objects.css` (neuf scripts, six feuilles de style). Dans les lignes ajoutées : aucun appel à Grist, `fetch`, message, stockage du
navigateur, table `_grist_*`, colonne ni adresse de plus. Lu après lui jusqu'à `f5df308` (la puce d'une liste suit la couleur et la
taille du texte) : même constat, rien pour GFS.

**4. Tes cinq points, rejoués avec ton app** (vrai Grist, grist-static 0.1.6 dans Chromium, panneau 700 × 400 sauf mention, à la vraie
souris et au vrai clavier, français / clair et anglais / sombre). **Tous passent.**

- **Le nom donné dans l'explorateur** (partie 7 de `run-ranger`, `8e2f06f`, ta 029 faite) : enregistré dans l'app, le modèle garde le
  nom donné dans GFS (34 vérifications sur 34).
- **La barre d'outils, `d52e40b`** (`run-trait-seul.mjs`, nouveau) : sur 16 largeurs de panneau, de 400 à 1000 px, et aux quatre bords
  de la barre de GFS (64 mesures, 800 et 600 px compris), aucun trait seul n'est visible au début ou au bout d'une ligne de tes trois
  rangées. Le détecteur est éprouvé : ton app en cache 51, et la classe retirée à la main, la même mesure les voit.
- **La douzième clé, `pp_bubble_marks`** (`84002e4` ; `run-stockage-publipostage`, partie 6, nouvelle) : « Mise en forme » choisi à la
  souris dans Réglages > Thème s'applique à l'instant (`data-bubble-marks` sur `<html>`), GFS le garde sous
  `gfs.stockage.publipostage.pp_bubble_marks`, et après le rechargement du cadre la case est cochée et l'attribut est posé dès le départ.
  Aucun lot au document ; le courtier ne refuse rien.
- **« Présenter » avec `4dfcd0c`** (`run-barre-ecartee`, partie `presenter`) : le ▾ à gauche du ▶ ouvre un menu de trois lignes dans le
  panneau, rien sous la barre aux quatre bords ; « Plein écran » y est grisé avec sa raison (« Ce cadre ne le permet pas : le
  diaporama prend tout le panneau. »), un clic dessus ne change rien ; un appui hors du menu le referme ; au clavier, Entrée sur ▾
  l'ouvre sur sa première ligne, ↓ ↓ vont à « Plein écran » et Échap le referme en rendant le clavier à ▾.
- **« Objets » avec `865afa3`** : dans une présentation, le bouton derrière « Image » ouvre son menu (cadre de texte, seize formes,
  trois lignes) dans le panneau, rien sous la barre aux quatre bords (`run-barre-ecartee`, partie `diapos-menus`) ; extension éteinte,
  le bouton est grisé, jamais caché, son menu dit la raison, et son clic appelle `installer` : la fenêtre de GFS s'ouvre sur la ligne
  « Diapositives » (`run-diapositives`, 60 vérifications sur 60 avec ce cas en plus).

Et, au passage, avec ta version : `run-slice1`, `run-ouvrir-publipostage` (28 sur 28), `run-langue-publipostage` (25 sur 25),
`run-barre-publipostage` (7 sur 7) et `run-edition` (60 sur 60) passent sans changement.

**5. Le plein écran du diaporama** (ta seconde demande). Le contrat le dit déjà (1.3, point 1) : le navigateur veut `allow="fullscreen"`
sur chaque cadre au-dessus de ton app, celui que Grist donne à GFS compris ; mesuré, le mot ajouté au seul sous-cadre de GFS ne change
rien (« Disallowed by permissions policy »), et avec les deux ajoutés (labo seulement) la demande aboutit. **GFS n'ajoute donc rien
tant que Grist ne laisse pas passer le plein écran** ; le jour où il le fait, c'est un mot de plus dans `allow`, que GFS mesurera
alors avec ton interrupteur. D'ici là, ton interrupteur fait ce qu'il doit : grisé avec sa raison, le diaporama prend le panneau
(mesuré, point 4). Rien à changer chez toi.

**6. Tes consignes.** La 028, la 030, la 031 et la 032 sont lues (rien à coder) ; la 029 est faite (`8e2f06f`, mesurée au point 4).
Le titre d'impression (011) reste non mesuré par GFS, dont le labo n'ouvre pas la boîte d'impression : le porteur le mesure lui-même.
La 034 te demande une chose de plus, qui vient du porteur : « Échap » quitte l'édition de l'en-tête et du pied de page.

## Pourquoi

Ta page demande que GFS te serve en direct et rejoue cinq points avec `865afa3`. Le porteur voulait essayer dans GFS ce que tu pousses
sans attendre une référence ; GFS mesure ce qui touche son cadre, et ton app y passe.

## Fait quand

`GFS-ETAT.md` donne « 033 · faite · lue, aucun code ».
