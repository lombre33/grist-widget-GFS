# 048 · Tes exports PDF se rangent dans GFS : `actions.ranger` est déclaré, la référence est à `6a22dee` et l'archive de PDF est mesurée (réponse à ta 043)

App : Publipostage+ · posée le 04/11/2026 · réponse à ta 043, que ta page dit « faite · `47e56ce` » · quand : à lire maintenant ;
aucun code à changer ; sans effet dans l'app seule

## Quoi

**1. Ta 043 est traitée.** Ta page (décrite au commit `47e56ce`, GFS-ETAT.md au commit `6a22dee`) dit la 043 faite et demande à GFS de déclarer `actions.ranger` dans ton manifeste, de rejouer le rangement
avec ton app servie et d'avancer sa référence. C'est fait. Ta 043 le disait déjà : GFS déclare `actions.ranger` quand ta page dit « 043 · faite », et le porteur a décidé le 04/11 (« Dès la lecture ») que
ce qu'il offre déjà n'attend plus un mot de sa part. Les deux lignes qui rangent, « Ranger dans GFS » et « Télécharger et ranger dans GFS », sont vivantes dans GFS (elles restent grisées, avec leur raison,
dans l'app seule).

**2. Ce que GFS a fait** (contrats 2.7, point 6, et 5.4, point 9 ; faits vérifiés, section 33).

- **La déclaration, dans ton manifeste** (`prototype/manifestes/publipostage.json` de GFS) : `actions.ranger: ["pdf"]` (un commit à part, relu). C'est la seule ligne qui fait ranger : sans elle GFS répond `GFS_REFUSE`
  (« ranger : le type « pdf » ne figure pas dans actions.ranger du manifeste de l'app « publipostage » ») et ton app télécharge le PDF en le disant, comme ta page le décrit. Aucun interrupteur de plus dans le code
  de GFS.
- **La référence de GFS** est avancée à `6a22dee` (commit à part, relu), tes douze commits depuis `3064a29`, dont `cfabee2` (le code de la 043), `690b50c` et `47e56ce`. Ton contrat avec GFS n'a pas bougé : mesuré sur ton
  code servi (`index.html`, `js/`, `css/`, `extensions/`), avant et après, les mêmes 12 verbes d'actions de Grist, les mêmes 8 tables internes `_grist_*`, les mêmes 13 appels `grist.*`, les mêmes 9 noms de tables
  `Publipostage_*`, les mêmes 82 adresses (aucune de plus ni de moins), un seul accès au stockage du navigateur (9 occurrences), le même réseau et les mêmes fenêtres (17 occurrences) - un relevé fait avec d'autres
  expressions que celui de la 044 : seuls comptent l'avant et l'après, identiques. Les deux `import(` de plus sont
  `import('kit/ambiance-message')` et `import('kit/ambiance-pose')` (ta 041), des modules du kit lus par leur nom dans ta carte d'importation, depuis ton propre dossier `kit/` : aucune adresse de plus. La publication de
  GFS prend les sous-modules en entier, celui de ton dossier `kit/` compris. Le poids de `edition` passe de 102 à 103 Ko (`live.css`, 102 512 octets) : le test des poids compare le manifeste à l'app référencée, les deux avancent
  ensemble.

**3. Ce que GFS a mesuré** (un vrai serveur Grist 1.7.19 en Docker, Chromium, 700 × 400, à la vraie souris et au vrai clavier, ton app à `6a22dee` servie par GFS, un modèle ouvert depuis l'explorateur ;
`prototype/labo/run-ranger-publipostage.mjs`, 38 vérifications dans chacune de quatre passes : français clair, français sombre, anglais clair, anglais sombre ; aucune en échec).

- **Le menu** : « Destination du PDF » porte ses trois lignes, vivantes, « Télécharger » cochée au départ ; un vrai clic coche « Ranger dans GFS » et GFS garde le choix de la personne pour ton app (`stockage.ecrire`,
  clé `pp_export_destination`).
- **Un premier export** : sur un document sans `GFS_Fichiers`, **c'est GFS qui demande l'accord pour sa table** (ton app n'en pose aucune), devant le panneau ; accordée, la table naît avec le PDF : une ligne au nom que ton modèle
  donne (« Contrat de prestation 2026.pdf »), `Origine` `publipostage`, une pièce jointe qui est un vrai PDF (`%PDF-`) ; rien n'est téléchargé ; ton coin d'état dit « PDF rangé dans GFS. » ; l'explorateur montre le PDF.
- **Un nom pris** : la fenêtre de GFS nomme ton app, le clavier est sur « Garder les deux », elle tient dans le panneau, ses textes ont le contraste voulu, rien n'est écrit avant la réponse. « Garder les deux » : « … (1).pdf »,
  l'ancien PDF garde son contenu, ton coin d'état dit « PDF rangé dans GFS sous le nom « … (1).pdf ». » ; « Remplacer » : la même ligne (même identifiant) prend le nouveau contenu, « PDF rangé dans GFS, à la place de l'ancien. » ;
  « Annuler » : rien n'est rangé ni téléchargé, « PDF non rangé : annulé dans GFS. »
- **Télécharger et ranger dans GFS** : le fichier téléchargé et la pièce jointe de GFS ont les mêmes octets ; ton coin d'état dit le rangement puis « PDF généré. » ; « Télécharger » seul ne range rien.
- **Une archive ZIP de trois lignes** : ton app envoie un PDF à la fois sous le nom de son entrée de l'archive (« nom », « nom (2) », « nom (3) »), tous du même lot ; sur des noms libres, aucune fenêtre et « 3 PDF rangés dans GFS. » ;
  le même export une seconde fois, **trois noms pris et une seule fenêtre**, avec la case « Faire pareil pour les suivants » : « Garder les deux » vaut pour les trois (trois copies de plus, les trois premiers PDF n'ont pas bougé,
  « 3 PDF rangés dans GFS (3 gardés en double). ») ; une troisième fois avec « Remplacer » pour les suivants : les trois mêmes lignes prennent un nouveau contenu, aucune de plus (« … (3 remplacés). ») ; l'archive n'est jamais
  téléchargée. GFS donne aux copies **le premier numéro libre** : sur un export rejoué, les noms rangés ne sont donc pas ceux de l'archive (« (1) », « (4) », « (5) » au lieu de « (2) » et « (3) »), et ton coin d'état ne les
  énumère pas pour un lot.
- **La console** : aucune erreur ni avertissement (GFS, ton app), ni violation de politique.
- **Pas mesuré** : Firefox avec ta vraie app (la fenêtre du nom pris, elle, est mesurée sous Firefox), le Grist en ligne du porteur (l'instance de la DINUM), un PDF de plus de 12 Mo, un nom de fichier à variables (le labo tape un nom
  sans variable), le « PDF protégé » et le PDF réuni (le même `deliver`, non joués), le refus de créer la table avec ton app.

**4. Ce que tu fais.** Rien dans ton code. Dis « 048 · faite · lue, aucun code » dans `GFS-ETAT.md` et ajoute à l'entrée de ta 043 que GFS l'a rejouée à `6a22dee` (cette consigne). Tes autres consignes ne changent pas :
la 045 (commenter un PDF) reste lue, la 046 et la 047 sont à faire.

## Pourquoi

GFS ne laisse une app ranger que ce que son manifeste déclare (contrats 2.7, point 6 : `actions.ranger`) ; une app qui n'a pas encore le code ne le déclare pas, et une app qui l'a livré le fait déclarer. Sans cette ligne, ta 043 était
faite et sans effet : l'app proposait de ranger et GFS refusait. La mesure ci-dessus est celle du geste du porteur de bout en bout (« que des exports de Publipostage+ en PDF aillent directement se ranger parmi les fichiers,
avec le choix d'écraser l'existant ou d'avoir une copie avec un (1) derrière le nom ») avec ton app, pas avec une sonde.

## Fait quand

`GFS-ETAT.md` donne « 048 · faite · lue, aucun code ». Si, dans GFS, « Ranger dans GFS » ne range pas chez toi alors que la ligne est vivante, dis-le dans « Questions pour GFS » avec la phrase de ton coin d'état :
GFS le rejoue dans un vrai Grist.
