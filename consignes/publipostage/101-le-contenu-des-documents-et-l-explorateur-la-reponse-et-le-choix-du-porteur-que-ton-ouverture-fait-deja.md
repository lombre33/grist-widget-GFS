# 101 · Le contenu des documents et l'explorateur : la réponse, le choix du porteur que ton ouverture fait déjà, et ta politique fermée lue

App : Publipostage+ (`lombre33/publipostageGrist`) · posée le 24/11/2026 · remplace rien · réponse à la question « le contenu des documents et l'explorateur » de ta page à `3930bbe` (décrite jusqu'à `3930bbe`) · point 5 de la 099 · cahier 3.2.1 · faits vérifiés 151 et 153
quand : à lire au prochain lot ; aucun code dans l'app ; vaut dans GFS seulement

## Quoi

**1. L'explorateur de GFS lit-il la colonne `Content` ? Oui ou non selon la lecture, et c'est lu dans le code** (`prototype/js/explorer/explorer-data.js`, `explorer-sql.js`).
- **Lecture complète** (un document de moins de 4 Mo, ou la première visite d'un document que GFS ne connaît pas encore) : la table est lue en entier par l'API des widgets, donc **oui, `Content` passe par l'explorateur**, le temps de la liste, en mémoire, sans être gardé. C'est ce qui pèse sur un document lourd.
- **Lecture légère** (dès la deuxième visite d'un document que GFS a vu lourd, 4 Mo et plus ; il garde seulement un nombre par document, `gfs.heavy.<identifiant du document>`) : une requête SQL qui rend **seulement** le nom, le type, la date, l'auteur, le dossier et les colonnes que ton manifeste nomme pour ses règles (`exclure`, la corbeille, `poids.liees`), plus le **poids** de chaque ligne, compté en SQL sur la longueur des colonnes de texte (`Content` compris, sans le rapporter). **Non, `Content` ne passe plus.** Sur un serveur lent, la liste est prête à 1,5 s au lieu de 8,3 s à partir de la deuxième visite (faits vérifiés 151 et 153).
- GFS ne garde **aucune copie** du contenu d'un modèle.

**2. Ton idée d'une table à part pour les contenus.** GFS ne la demande pas, et le porteur n'a rien décidé sur elle : l'ouverture d'un gros document n'en a pas besoin (point 3), puisque la liste ne lit déjà plus `Content` quand le document est lourd. Si tu veux la proposer, dis-la dans « Demandes à GFS » avec ce qu'elle changerait (une table de plus à créer, donc l'accord de la personne ; le poids du contenu à compter par `poids.liees`, que ton manifeste emploie déjà pour `Publipostage_Versions`) : GFS la pose au porteur sur une carte, rien n'est codé avant son choix.

**3. Le choix du porteur (24/11) : « Lire seulement le modèle ouvert ».** Il l'a pris sur la carte « Comment raccourcir l'ouverture de ton gros fichier sur l'instance de la DINUM ? ». **Lu** sur ta page : ton ouverture depuis la seule ligne (`js/early-open.js`, `574b081` et `6c52463`) le fait déjà pour un fichier de type `document` : rien à coder pour ce choix. La mesure à froid du porteur (1,6 s au lieu de 7,3 s) est celle qui fait foi : GFS ne l'a pas rejouée, sa lecture REST est refusée dans son banc (une adresse locale en `http:`).

**4. Ce que GFS a changé pour que ton ouverture tienne** (`fca6392`) : la lecture complète que GFS lançait en fond derrière la liste est retirée. Elle faisait attendre derrière elle le jeton en lecture seule dont ton ouverture dépend (réponse à 1,9 s avec la lecture en fond, à 0,75 s sans ; tu lui laisses 2,5 s) et chargeait le serveur à chaque rafraîchissement. Rien à changer chez toi. Ce que cela coûte : un fichier que ton app ouvre en lisant sa table entière (une présentation, pour toi) s'affiche à 10,5 s au lieu de 9,7 s sur un serveur lent.

**5. Ton choix ne couvre aujourd'hui que le type `document`** (ta page : « un autre type garde l'ancien démarrage »). Le choix du porteur ne distingue pas les types ; dis dans ta page si et quand les autres suivent. GFS n'en demande pas plus.

**6. Ta politique de contenu fermée (étape 3, `3930bbe`), lue.** GFS a lu ton `index.html` à `3930bbe` avec ses propres règles, **sur le fichier** : S1 tenue ; S2 « à noter » (le `'unsafe-inline'` de `style-src`, que tu dis déjà en réserve) ; S3 « non tenue » pour une seule raison, `blob:` dans `img-src` (le jugement attend le choix du porteur, comme tu le dis), son `https:` du serveur Grist étant « à noter » grâce à ta section « Adresses » ; S4 « à noter » (les quatre cales d'`esm.sh` sans version). **Pas rejoué dans un vrai Grist** : GFS le rejoue (cadres de vidéos, polices du PDF, pièces jointes, lecture d'une seule ligne, éditeur) en avançant la copie de son laboratoire, dans un lot à part, et te dit ce qui casse par une consigne. Une remarque pour ce rejeu : ta politique refuse un Grist en `http:`, et le laboratoire de GFS en est un ; GFS le dira sans le compter comme un défaut de ton app.

**7. Ce qui reste ouvert sur ta page**, rien de nouveau : le `\r` seul, la coche sous Firefox, le titre du PDF, et les trois questions de la 060 (07/11) que GFS mesure dans un vrai Grist avant de répondre.

## Pourquoi

Ta question attendait un choix du porteur sur l'ouverture des gros fichiers (099, point 5). Il a choisi ; la réponse sur ce que lit l'explorateur est un fait de GFS, et ta politique fermée demandait la lecture de GFS que la 099 t'avait promise.

## Fait quand

1. Ta page dit « 101 · lue, sans code » ; la question « le contenu des documents et l'explorateur » sort de « Questions pour GFS » avec la réponse ci-dessus.
