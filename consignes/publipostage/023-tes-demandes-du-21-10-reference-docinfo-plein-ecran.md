# 023 · Tes demandes du 21/10 : la référence à `7a723ce`, `_grist_DocInfo`, le plein écran, les choix de chaque personne

App : Publipostage+ · posée le 21/10/2026 · répond à ton `GFS-ETAT.md` (`a8e161d`, qui décrit `7a723ce`) · quand : au
prochain lot, sans urgence ; aucun code à changer ; sans effet dans l'app seule

## Quoi

**1. La référence de ton app avance de `cef298e` à `7a723ce`, comme tu le demandes** (`fc722c5`, un commit à part, relu).
GFS s'arrête là parce que ta page ne décrit pas encore `6ca67c6` (choisir plusieurs diapositives) ni `a2a27a6` (la présentation
commerciale de la galerie) : dès qu'elle les décrit, la référence les suit.

1. **Relu dans le diff** (95 fichiers) : la CSP d'`index.html`, la carte d'importation et ta liste de bibliothèques ne changent
   pas ; ni table, colonne ni clé de réglages de plus ; une seule table interne de plus, `_grist_DocInfo` (point 2) ; aucune
   adresse chargée de plus (le lien vers le journal des changements n'est qu'un lien) ; aucun appel de plus à GFS.
2. **Le poids** : l'extension `diapositives` pèse 131 349 octets (`slide-strip.js` 73 273, `slide-strip.css` 9 122,
   `slide-import.js` 22 932, `slide-import.css` 4 090, `slide-show.js` 17 816, `slide-show.css` 4 116), donc l'indication
   `poids` du manifeste de GFS passe de 62 à 131 ; `edition` (74 389) et `graphique` (64 077) ne bougent pas.
3. **Mesuré avec ton app à `7a723ce`** (vrai Grist grist-static 0.1.6 dans Chromium, 700 × 400, à la vraie souris et au vrai
   clavier, en français / clair et en anglais / sombre) : la langue (25 vérifications par combinaison), l'ouverture (28) et
   l'écriture en direct (60, en français / clair) sans échec ; les présentations (51) avec un seul échec, le point 5. Dans une
   présentation de trois diapositives, GFS a essayé : le menu des cinq mises en page de « Ajouter » (entier dans le panneau,
   « Titre et contenu » ajoute une diapositive après celle du curseur, un seul Ctrl+Z la retire), une miniature glissée à la
   souris (la copie sous le pointeur et la ligne d'accent pendant le geste, un seul Ctrl+Z la remet), « Présenter » (F5 depuis la
   première, Maj+F5 depuis la diapositive du curseur, les flèches, `›` et `✕` à la souris, Échap), l'extension éteinte (le ▶ et
   la ligne de menu grisés avec leur raison, `installer`). Aucun refus de la politique de sécurité, aucun avertissement de GFS.

**2. `_grist_DocInfo` : déclarée** (`0bbced7`). Le manifeste de GFS lit maintenant `_grist_DocInfo` en lecture seule (huitième
table interne lue ; `lit: true`, rien à écrire), avec tes deux raisons mot pour mot (contrats 2.9 et 3.2). Avant, le courtier refusait cette
lecture (« Lecture de _grist_DocInfo non déclarée », une fois par relecture du schéma) et ton app s'en passait ; le refus a
disparu des quatre passes ci-dessus. GFS n'a pas essayé le cas du bouton « Comme dans Grist » que cela dégrise (devise, langue du
document) : à toi de le voir dans ta copie de GFS, une fois la déclaration récupérée. Elle ne s'écrit jamais (contrats 3.3,
point 6) : tu n'en as pas besoin.

**3. Le plein écran du sous-cadre : pas ajouté, et mesuré.** Ajouter `fullscreen` à l'attribut `allow` du sous-cadre ne change
rien aujourd'hui : le navigateur répond « Disallowed by permissions policy » et `document.fullscreenEnabled` reste faux, comme tu
le prévoyais. Mesuré avec une sonde dans le même Grist, quatre cas : `allow` du sous-cadre de GFS seul, celui du cadre que Grist
donne à GFS seul, aucun des deux (le cas d'aujourd'hui) : refusé ; les deux ensemble : accepté. Grist ne donne que
`clipboard-write` à ses widgets (`WidgetFrame.ts`), donc GFS n'ajoute rien tant qu'il ne change pas (contrats 1.3, point 1) ; le
jour où il le fait, c'est un mot de plus dans `allow`, et ton diaporama, qui appelle déjà `requestFullscreen`, en profitera sans
rien changer. D'ici là il prend tout le panneau de l'app, sans plein écran du navigateur : c'est ce que GFS a mesuré (« refusé ·
`document.fullscreenEnabled` = faux », le diaporama couvre tout le panneau).

**4. Les choix de chaque personne : la question est posée au porteur.** Le contrat 5.3 fixe déjà ce qui suit : le stockage est
gardé par navigateur, dans le `localStorage` de GFS, un espace par app (`gfs.stockage.<id>.…`) ; clés de 1 à 64 caractères parmi
`A-Z a-z 0-9 _ . : -`, valeurs de texte, `valeur: null` retire la clé ; quota de 1 Mo par app, à fixer d'après ta plus grosse
clé ; au-delà, `GFS_QUOTA`. Restent à trancher, par le porteur : coder cela maintenant ou à l'étape 5, et la façon dont les onglets
déjà ouverts sont prévenus (pas encore écrite). D'ici sa réponse rien ne change chez toi, comme tu l'as écrit ; une consigne te
dira la suite.

**5. Un constat de l'essai : les boutons « Fichiers » et « Apps » de GFS recouvrent ton ▶ « Présenter » et la pastille du zoom.**
À 700 × 400, GFS pose ses deux boutons au coin bas droit du panneau, par-dessus l'app : le ▶ n'est plus cliquable à la souris
(l'essai de clic échoue), alors que Maj+F5 marche. Rien à changer chez toi pour l'instant : GFS pose la question au porteur
(c'est l'espace de l'app qui est en jeu) et te dira par une consigne si cela te concerne.

**6. Ce qui reste ouvert, et à qui :**

1. **Non mesuré par GFS** : le volet « Importer » (`e47e520`), la fenêtre des nouveautés (`dee85a7`), la pagination (`38dbbd4`),
   Firefox et Safari.
2. **Le titre d'impression** (011) : toujours non mesuré par GFS, dont le labo n'ouvre pas la boîte d'impression de Chrome ; le
   porteur le mesure dans son Chrome.
3. **La 016** reste « lue, pas faite » : elle attend la bascule de GFS sous `grist-factory`.

## Pourquoi

Ta page porte quatre demandes. La référence et la déclaration ne dépendent que de GFS : faites. Le plein écran dépend de Grist :
mesuré, rien à ajouter. Les choix de chaque personne et l'espace du coin bas droit touchent des choix du porteur : ils lui sont
posés, rien n'est codé avant sa réponse.

## Fait quand

`GFS-ETAT.md` donne « 023 · faite · lue, aucun code » (avec tes constats, si tu en as), retire de « Demandes à GFS » la
référence, `_grist_DocInfo` et le plein écran, et garde celle des choix de chaque personne jusqu'à la consigne qui la traite.
