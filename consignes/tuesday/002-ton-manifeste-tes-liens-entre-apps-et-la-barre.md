# 002 · Ton manifeste, tes liens entre apps et la barre de GFS : relus contre les contrats

App : Tuesday · posée le 02/11/2026 · réponse à ta page du 02/11 (demandes 3, 4 et 6) · quand : à lire maintenant ; du code à ton entrée
dans GFS (guide 1.2) ; rien à changer d'ici là ; sans effet dans l'app seule

## Quoi

**1. Ton `gfs.json` est valide** (demande 3). GFS l'a passé le 02/11 dans son outil de validation (contrats 2.8), à `99b80e2` : aucune
erreur. Ce que les contrats tranchent pour tes quatre points :

- **Le type « Projet »** (`projet`, table `Tuesday_Projets`) et ses cinq colonnes sont conformes à 2.4 (`id` et `nom` obligatoires,
  `type`, `dossier` et `date` facultatives). Un type unique est permis ; il figure dans `actions.ouvrir` et `actions.choisir`, comme il
  faut pour qu'on l'ouvre et qu'on le lie.
- **`Tuesday_Liens`** n'a rien à déclarer : ton préfixe `Tuesday_` la couvre ; tu la lis et l'écris sans autre déclaration, et aucune autre
  app ne peut l'écrire (3.2 et 3.3). Le cahier veut « une ligne réservée d'une table existante avant une table de plus » (contrats 6.2) :
  c'est une préférence, pas une interdiction, et des liens font plusieurs lignes par tâche, qu'une ligne réservée ne tiendrait que dans un
  texte que Grist ne sait plus lire. **Défaut pris** : une seule table de plus, créée avec l'accord de la personne, identifiant réel relu
  après `AddTable` ; écris dans ton cahier pourquoi une ligne réservée ne suffit pas.
- **`gristInterne`** : `_grist_Tables` et `_grist_Tables_column`, en lecture, avec ton `pourquoi` en français et en anglais : accepté
  (3.2, point 4).
- **`full` avec `lit` et `ecrit` à `"*"`** : `"*"` désigne les tables de la personne, donc la source choisie à l'exécution ; il ne couvre ni
  les tables d'une autre app ni `GFS_*` (3.2, point 2).
- **`inserer`** reste `{ "produit": [], "recoit": [] }` jusqu'à l'étape 7 (2.7, point 3). L'outil de validation ne le vérifie pas : le
  contrat le dit. Une carte V2 s'y déclarera quand le déroulement sera écrit.

**2. Les liens entre apps** (demande 4). « Lier un fichier » est l'action `choisir`, « Ouvrir » l'action `ouvrir` (contrats 5.4, points 1 et
2) : `choisir { types, apps?, titre? }` rend `{ app, id, nom, type }`, ou `null` si la personne annule ; `ouvrir { app, fichier: { id, type } }`
rend `{ ouvert }`. Le `type` doit figurer dans `actions.ouvrir` de l'app visée, et `choisir` ne montre que les types que son manifeste
déclare dans `actions.choisir` (aujourd'hui, pour Publipostage+ : ses documents et ses grilles, pas ses présentations).
**Écrit, pas encore construit** : ni le courtier ni le kit 0.2.0 n'ont ces deux appels côté app, et un appel de ce genre reçoit
`GFS_INCONNU`. Tant que le lot n'existe pas, tes entrées « Lier un fichier » et « Ouvrir » sont grisées avec leur raison (texte commun du
grisé, guide 5), jamais masquées, et tu ne contournes rien : n'écris dans la table d'aucune autre app et ne lis pas la leur (lecture déclarée
en toutes lettres, 3.2 point 2 : GFS n'en fait pas un contrat). Le porteur décide si GFS construit ce lot maintenant (carte posée le 02/11) ;
une consigne te le dira.

Un fichier **renommé ou disparu** (défaut pris, contrats 5.4 point 7, à confirmer) : la clé d'un lien est `{ app, id, type }` ; le nom reçu au
choix n'est qu'une étiquette. Renommé, le fichier garde son `id` : `ouvrir` l'ouvre sous son nom du jour, ton étiquette peut être périmée
sans gravité (la relire à l'ouverture serait un champ de plus dans la réponse de `ouvrir` : mets-le dans ta section « Demandes à GFS » si
tu y tiens). Disparu, ou son app non installée : ton lien ne s'efface jamais tout seul, tu le montres grisé avec la raison (« fichier
introuvable », « app à installer ») et la personne le retire ou le refait ; GFS n'ouvre alors rien et le dit (le code que reçoit l'app
s'écrira avec le lot).

**3. La barre de GFS** (demande 6 ; contrats 5.2, point 7). À gauche au milieu, à 700 × 400, elle prend `{ "x": 0, "y": 134, "largeur": 42,
"hauteur": 132 }` : une bande de 42 px de large, de y 134 à y 266. L'app ne l'écrit jamais en dur : le kit 0.2.0 la donne et la redit à chaque
changement (`GfsLink.onBar(barre => …)` avec `{ bord, epaisseur, zone }`, ou `null` seule ou explorateur ouvert), car le bord est un choix de
la personne et la zone suit la taille du cadre. **Ligne par ligne** : la zone est fixe dans le cadre et les lignes défilent, donc l'écart se
recalcule au défilement : une ligne dont le rectangle coupe `zone` en hauteur laisse `epaisseur` px libres de ce côté (marge devant sa
poignée, sa case ou son numéro), les autres gardent leur marge. Ta gouttière actuelle (`poserBarre`, épaisseur + 8 px sur toute la hauteur)
est permise aussi : elle évite ce recalcul et prend 42 px de 700 en permanence. À toi la manière ; ce qui compte, c'est que rien de cliquable
ou à lire ne reste sous la zone, au bord que la personne a choisi.

## Pourquoi

Ta page du 02/11 pose sept demandes ; celles-ci se règlent avec les contrats déjà écrits ou par un défaut prudent, sans décision nouvelle du
porteur. Les autres (carte insérée, couleur, identité, point de départ, calendrier, Automation+ en fond) sont dans la 003 et la 004. Un
manifeste valide ne dit pas que l'app est prête à entrer : seule la mesure dans GFS le dit, et elle se fera avec ton code.

## Fait quand

`GFS-ETAT.md` donne « 002 · lue » maintenant, puis « 002 · faite · `commit` » à ton entrée dans GFS, quand ton `gfs.json` est à la racine de
ton dépôt tel que validé ici, que les entrées de liens sont grisées avec leur raison et que ton tableau écarte la zone de la barre aux quatre
bords. GFS la mesure alors dans GFS, à 700 × 400, à la vraie souris, en clair et en sombre.
