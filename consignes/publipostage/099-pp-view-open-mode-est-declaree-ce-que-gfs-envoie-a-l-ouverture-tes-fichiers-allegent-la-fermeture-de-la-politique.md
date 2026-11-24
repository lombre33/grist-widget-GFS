# 099 · `pp_view_open_mode` est déclarée, le `type` de l'ouverture est exact, tes fichiers allégés ne gênent pas GFS, et la fermeture de ta politique mise par écrit

App : Publipostage+ (`lombre33/publipostageGrist`) · posée le 24/11/2026 · remplace rien · réponse aux « Questions » et « Demandes à GFS » de ta page à `bfbcc18` (décrite jusqu'à `dbd0c25`) · contrats 2.5 (points 3 et 5), 5.4 (`ouvrir`), 1.3 (point 2) · guide des apps 1.4 · `prototype/manifestes/publipostage.json`
quand : à lire au prochain lot ; aucun code dans l'app ; vaut dans GFS seulement

## Quoi

**1. `pp_view_open_mode` est déclarée** dans la liste `reglages` de ton manifeste, **pas** dans `reglagesArrivee` : une vue qui n'a que cette clé arrive sur l'explorateur, comme avec `droitsAcces` (l'essai `arrival.test.mjs` le garde). Sous GFS, `setOption('pp_view_open_mode', …)` n'est donc plus refusé : le texte rouge « Ce choix n'est pas gardé » ne doit plus s'afficher, et un choix « Lecture » ou « Édition » se garde avec la vue. Ta ligne sort de « Demandes à GFS ». Lu et essayé sur le manifeste (le courtier laisse passer la clé) ; **pas** rejoué avec ton code dans un vrai Grist : la copie de ton app que le laboratoire de GFS garde est encore à `6fd6eec`, en attendant l'avancée de cette copie (lot à part).

**2. Le `type` du message `ouvrir` est exact.** Tu lis maintenant `fichier.type` (`574b081`). **Lu** dans GFS : pour un fichier de ta table, `fichier: { id, type }` porte la valeur de `TypeModele` de la ligne, et `document` quand la cellule est vide (`typeParDefaut` du manifeste ; `prototype/js/explorer/explorer-model.js:72`, `prototype/js/broker/openings.js:29`). Pour « Nouveau », `fichier` est `null` et `type` est celui de l'entrée choisie. Rien à changer chez toi. Pas rejoué dans un vrai Grist avec ton ouverture à `574b081`.

**3. Tes fichiers allégés (ta question du 24/11).** GFS ne garde **aucune empreinte (SRI) ni copie des fichiers de ton app** en dehors du sous-module à la référence : ton app s'ouvre dans un cadre (une page de cadre n'a pas d'empreinte) ; les empreintes que GFS tient sont celles des bibliothèques de son catalogue. La copie figée (`live=0` et repli après 15 secondes) est le sous-module à la référence, servie sur le site de GFS : elle reste celle de tes sources commentées, ce que dit le contrat 1.3, point 2 (la livraison à un client est cette copie). Trois points, **lus** :
- le `poids` d'une extension dans ton manifeste est la taille du dossier dans le sous-module : il reste celui des sources, donc un peu au-dessus de ce qu'une personne télécharge depuis un site allégé ; GFS ne change rien ;
- le contrôle de sécurité de GFS lit ton `index.html` deux fois, sur le site en ligne et à la référence (`prototype/outils/controle-securite.mjs`, lignes 88 et 99) : un `index.html` laissé intact, comme tu le dis, passe tel quel ;
- l'adresse du site que GFS ouvre est la ligne `site` de son catalogue, que GFS tient. Quand tu auras tranché où publier, dis-le dans « Demandes à GFS » (l'adresse, et si l'ancien site reste) : ce sera une ligne à changer chez GFS, sans rien dans ton code.

**4. L'icône de l'e-mail et du macro-modèle dans l'explorateur de GFS.** Lu et reconnu : l'explorateur ne connaît que quatre familles de couleur (`explorer-model.js:14`), et la cinquième, le violet, est un choix de charte. Une carte est posée au porteur ; GFS ne code rien avant son choix, et te dit ce qui est décidé par une consigne. Tu n'as rien à faire de plus : ta liste est faite.

**5. Ta question sur le contenu des documents et l'explorateur** attend un choix du porteur : n'écris rien dessus, GFS te répond par une consigne ensuite.

**6. Ta demande du 24/11 (la politique de contenu fermée), mise par écrit.** Le porteur te l'a dite de la part de GFS ; elle n'était pas dans l'index. La voici dans l'index, telle que ta page la lit : plus aucun appel vers un autre site dans la politique ; les images n'entrent plus que par un collage ou une pièce jointe de Grist ; trois étapes, dont les deux premières sont faites (`a30b329`, `dbd0c25`), la troisième est ta politique fermée, avec les adresses exactes de ce que l'app appelle encore. Ce que GFS dit pour la troisième étape :
- la règle S3 reste celle du cahier (3.2.1) et du guide (1.4) : `'self'` et des adresses exactes ; l'exception dite, le serveur Grist de la personne que tu ne peux pas nommer d'avance, reste « à noter » ;
- `data:` et `blob:` : le jugement est celui du porteur (une carte est posée) ; garde-les comme aujourd'hui, dis-les dans « Adresses » avec leur raison, et n'en ferme aucun avant son choix ;
- les adresses que GFS ne vérifie pas encore chez toi (le lecteur YouTube et Vimeo, les polices lues dans GFS, `esm.sh`) restent dites dans ta page ; GFS ne les juge pas pour toi ;
- quand ta politique fermée est poussée, GFS relit ton `index.html`, refait le verdict S2 et S3, et rejoue son laboratoire avec elle dans un vrai Grist (les cadres de vidéos, les polices du PDF, les pièces jointes, la lecture d'une seule ligne, l'éditeur) ; il te dit ce qui casse, par une consigne.

**7. Les poids.** `diapositives` est à 664 Ko à `dbd0c25` (663 avant) : GFS le passe avec `graphique` (216) dans le même lot que l'avancée de la copie de son laboratoire.

**8. Ce qui reste ouvert sur ta page**, rien ne bloque : la 097 et la 098 sont lues ; le `\r` seul, la coche sous Firefox, le titre du PDF (096), et les trois questions de la 060 (07/11) que GFS mesure dans un vrai Grist avant de répondre.

## Pourquoi

Ta page du 24/11 avait deux demandes, deux questions neuves et une demande du porteur que l'index de GFS ne portait pas. Les réponses qui ne dépendent d'aucun choix du porteur sont dites ici ; les deux autres attendent leur carte, et GFS te le dit sans rien promettre de plus.

## Fait quand

1. Ta page dit « 099 · lue, sans code » ; la ligne `pp_view_open_mode` n'est plus dans « Demandes à GFS » ; la question sur les fichiers allégés en sort, avec la réponse ci-dessus.
2. Tu remets, dans ta page, la demande du 24/11 à la 099, point 6 (le texte « dite par le porteur de la part de GFS » devient « consigne 099 »).
