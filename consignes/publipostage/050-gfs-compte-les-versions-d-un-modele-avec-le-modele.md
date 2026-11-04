# 050 · GFS compte les versions d'un modèle avec le modèle, par `Jeton` : rien à changer, ce que GFS lit chez toi est dit ici (demande du porteur sur le poids)

App : Publipostage+ · posée le 04/11/2026 · quand : à lire maintenant ; aucun code à changer ; sans effet dans l'app seule

## Quoi

**1. Ce que GFS fait.** Le porteur a demandé le 04/11 que l'explorateur de GFS dise le poids de chaque fichier (une instance de Grist limite l'ensemble des documents à 15 Go). Un modèle de Publipostage+ pèse déjà
sa ligne de `Publipostage_Modeles` (le poids est la somme des octets de ses cellules : contrats 2.4, point 5). **Depuis ce lot, un modèle compte aussi ses versions** : GFS déclare, dans le manifeste qu'il garde de ton app
(`prototype/manifestes/publipostage.json`), `poids.liees: [{ table: "Publipostage_Versions", colonne: "Jeton", fichier: "Jeton" }]`, c'est-à-dire « les lignes de `Publipostage_Versions` dont `Jeton` est le `Jeton` du modèle ».
Le dossier qui contient le modèle, le total du pied de fenêtre et le tri par poids en tiennent compte. Rien n'est écrit dans le document : le poids se recalcule à chaque ouverture.

**2. Ce que GFS lit chez toi, et ce que tu peux compter dessus** (contrats 2.4, `poids`).

- **Deux noms de colonnes**, tels que `js/versions-store.js` (`TABLE_COLUMNS`) et `Templates.ensureToken` les créent : `Publipostage_Versions.Jeton` et `Publipostage_Modeles.Jeton`. Si tu renommes l'un des deux, dis-le dans
  « Questions pour GFS » : une table liée absente ou une colonne qui manque ne compte rien et GFS le dit dans la console, sans rien casser.
- **GFS lit `Publipostage_Versions` en entier à chaque ouverture de l'explorateur** (et à chaque relecture des fichiers), depuis son propre cadre : ton choix du 13/10 (« jamais lue au démarrage du widget, lue en entier
  seulement à l'ouverture de l'historique ») vaut pour ton widget, il ne change pas. Le coût mesuré est celui de la table : **moins de 0,4 s de plus à l'ouverture de l'explorateur avec 3 Mo de versions** (ton plafond de 3 millions de
  signes pour tout le document ; la mesure varie de −372 à +249 ms d'une passe à l'autre, c'est son bruit), rien dans un document qui n'a pas la table. Une version dont le jeton ne désigne aucun modèle, ou vide, n'est comptée avec aucun fichier.
- **Une copie a un jeton vide** (la recette `copie` le vide : contrats 2.4, point 4) : elle ne compte aucune version, sa ligne seule. **À la corbeille**, l'entrée pèse sa ligne de `GFS_Corbeille` et rien de plus : les versions
  restent dans leur table, et ton ménage des orphelines les retire comme il le fait déjà (contrats 6.7, point 6, connu, non changé par ce lot) ; le modèle remis tant qu'elles sont là retrouve ses versions et le poids
  qui va avec.

**3. Ce que GFS a mesuré** (un vrai serveur Grist 1.7.19 en Docker, Chromium, 700 × 400, à la vraie souris et au vrai clavier, la table avec les colonnes de ton magasin : `Jeton`, `Date`, `Auteur`, `Nom`, `Genre`, `Donnees` ;
`prototype/labo/run-poids.mjs`, passe 7, quatre passes : français clair, français sombre, anglais clair, anglais sombre ; faits vérifiés, section 41).

- Un modèle de 600 000 signes et ses quatre versions de 120 000 signes pèsent « 1,0 Mo » (sa ligne, 586 Ko, plus environ 480 000 octets de versions), un modèle de quelques lignes et ses trois petites versions « 6 Ko » ; les versions d'un jeton inconnu
  ou vide ne sont à personne ; le total du pied est la somme de ce que la liste montre.
- L'estimation de la table de versions est à **−0,1 %** de l'octet exact de SQLite (`dbstat`), jamais au-dessus.
- La copie d'un modèle de 600 000 signes ne compte aucune version ; le modèle mis à la corbeille ne pèse que sa ligne et ses quatre versions restent dans leur table ; remis, il retrouve son poids.
- Avec 35 versions (3,0 Mo, ton plafond), l'ouverture de l'explorateur ne change pas de façon mesurable (−372, −60, +163 et +249 ms sur quatre passes, pour une ouverture d'environ une seconde) ; le poids reste celui des octets de Grist.
- **Pas mesuré** : l'instance de la DINUM, un document dont l'historique des versions a été rempli par ton app en usage réel (la mesure l'a rempli par l'API de Grist, avec des textes en base64 de la taille de tes états),
  Firefox avec ta vraie app.

**4. Ce que tu fais.** Rien dans ton code. Dis « 050 · faite · lue, aucun code » dans `GFS-ETAT.md`. Si le nom de `Publipostage_Versions` ou de sa colonne `Jeton` doit changer un jour, écris-le d'abord dans
« Questions pour GFS » : GFS change sa déclaration en même temps que ton app.

## Pourquoi

Le poids d'un modèle est ce que le porteur regarde pour ne pas dépasser la limite de son instance, et les versions sont la part de ce poids que la ligne du modèle ne montre pas : chacune pèse environ 0,3 fois le
modèle (ton commentaire de `js/versions-store.js`), jusqu'à 30 par modèle. Sans cette ligne, l'explorateur dirait le poids de la ligne seule pour un modèle dont l'historique pèse plusieurs fois la ligne. GFS préfère
lire ta table de versions que demander à ton app un nombre qu'elle ne garde pas : le contrat reste la donnée (cahier, section 2).

## Fait quand

`GFS-ETAT.md` donne « 050 · faite · lue, aucun code ». Si l'explorateur de GFS dit pour un modèle un poids qui ne contient pas ses versions alors que ton historique en montre, dis-le dans « Questions pour GFS » avec
le nom du modèle et le nombre de versions : GFS le rejoue dans un vrai Grist.
