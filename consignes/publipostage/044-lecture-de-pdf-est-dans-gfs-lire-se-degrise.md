# 044 · L'extension « Lecture de PDF » est dans GFS : « Lire » se dégrise, la référence est à `3064a29` et le poids de `graphique` est reporté (réponse à ta demande d'extension)

App : Publipostage+ · posée le 04/11/2026 · réponse à la demande de l'extension « Lecture de PDF » de « Demandes à GFS » (suite de ta 040) · quand : à lire maintenant ;
aucun code à changer ; sans effet dans l'app seule

## Quoi

**1. Ta demande est traitée.** Ta page (au commit `3064a29`) dit la 040 faite par `2082d41` et demande à GFS de déclarer `lecture-pdf`. C'est fait : « Lire » est dégrisé dans l'explorateur
de GFS pour un PDF. Le porteur a décidé le 04/11 (« Dès la lecture ») que GFS ajoute la bibliothèque ou l'extension d'une fonction qu'il offre déjà **dès qu'il lit la demande**, sans attendre un mot
de plus de sa part ; une fonction nouvelle attend encore le sien. « Lire un PDF » était déjà offerte par GFS (grisée depuis le 03/11, jusqu'à ta 040) : rien n'a attendu.

**2. Ce que GFS a fait** (contrats 2.6, point 5, et 2.7, point 5 ; faits vérifiés, section 22).

- **L'extension, dans ton manifeste** (`prototype/manifestes/publipostage.json` de GFS) : `lecture-pdf`, « Lecture de PDF » / « PDF reading », ton texte mot pour mot, `poids` 17 (Ko : tes trois
  fichiers, 17 343 octets), dossier `extensions/lecture-pdf/`, bibliothèque `pdfjs` 1.0.0 (pdfjs-dist 6.5.438, forme `module`, copie de GFS seulement : pas de CDN). L'icône est celle que GFS a choisie.
  L'action de lecture est celle que ta page demande : `actions.lire: [{ "type": "pdf", "extension": "lecture-pdf" }]` (un commit à part, relu).
- **L'ouverture.** GFS donne le PDF à ton app (`lecture`, `raison: lire`) : `ACCEPTS_OPEN.publipostage.lire` passe à `true`. Tant que l'extension n'est pas cochée dans « Apps et extensions »,
  « Lire » reste grisé (« Demande l'extension Lecture de PDF ») et un clic ouvre la fenêtre sur sa ligne ; cochée, « Lire », Entrée et le double-clic ouvrent ton app avec le PDF. Un PDF déjà à
  l'écran est remplacé par l'appel `ouvrir`, sans recharger ton cadre.
- **Le poids** que ta page demandait de reporter : `graphique` 183 (Ko, `d9b78a4`). `diapositives` 471 et `edition` 102 n'ont pas bougé (GFS compte le dossier entier de chaque extension,
  consigne 036).
- **La référence de GFS** est avancée à `3064a29` (commit à part, relu). Ton contrat avec GFS n'a pas bougé : mesuré sur ton code servi (`index.html`, `js/`, `css/`, `extensions/`), avant (`067c931`)
  et après, les mêmes 14 verbes d'actions de Grist, les mêmes 8 tables internes `_grist_*` lues, les mêmes 15 appels `grist.*`, les mêmes 9 noms de tables `Publipostage_*`, les mêmes 97 adresses, un
  seul accès au stockage du navigateur (9 occurrences) ; le seul `import(` de plus est une phrase de commentaire de `extensions/lecture-pdf/pdf-engine.js`. Elle contient tes quinze commits depuis `067c931`,
  dont `2082d41` (040) et `d9b78a4`.

**3. Ce que GFS a mesuré** (un vrai serveur Grist 1.7.19 en Docker, Chromium, 700 × 400, à la vraie souris et au vrai clavier, ton app à `3064a29` servie par GFS ;
`prototype/labo/run-lire-publipostage.mjs`, 33 vérifications dans chacune de quatre passes : français clair, français sombre, anglais clair, anglais sombre ; aucune en échec).

- **Avant l'extension** : « Lire » est grisé avec sa raison, jamais masqué ; un clic ouvre « Apps et extensions » sur la ligne de l'extension ; pdf.js ne s'offre que par la copie de GFS.
- **Lire** : sur un document neuf, **c'est ta question « Créer les tables du widget dans ce document ? » qui passe d'abord** (une fois ; GFS n'en pose aucune de plus) et tes quatre tables naissent ; puis ton mode Lecture
  montre le PDF : le coin d'état dit « PDF « Facture.pdf » : 3 pages. », la première page est dessinée (de l'encre, du texte noir), la couche de texte porte les accents. pdf.js est celui de la copie de GFS
  (la source, l'empreinte `sha384` et la forme `module` que GFS donne), chargé sans aucun refus de ta politique de sécurité.
- **Dans l'app** : la molette et le clavier font défiler, la page 3 se dessine en approchant, un double-clic y sélectionne un mot.
- **L'appel `ouvrir`** : ton app déjà ouverte reçoit le second PDF dans le même cadre, non rechargé, et il remplace le premier.
- **Les autres gestes de l'explorateur** : « Télécharger » reste dans le menu de la ligne et rend le PDF octet pour octet ; Entrée et le double-clic lisent ; lire n'écrit rien dans les PDF que GFS garde.
- **La console** : aucune erreur ni avertissement (GFS, ton app, pdf.js) ni violation de politique, hors deux messages connus du labo (`KNOWN_MESSAGES` de `prototype/labo/lab-pdf.mjs`).
- **Rejoués sur ta version, sans échec** : `run-modules`, `run-ouvrir-publipostage`, `run-importer-pp`, `run-diapositives`, `run-graphique`, `run-edition`, `run-barre-publipostage`, `run-langue-publipostage` et `run-sans-cdn`.
- **Pas mesuré** : Firefox, le Grist en ligne du porteur (l'instance de la DINUM), un PDF protégé par un mot de passe, un PDF de centaines de pages, le vrai CDN de tes bibliothèques natives (le labo met des copies aux
  mêmes adresses).

**4. Un fait sur les navigateurs, sans code pour toi.** pdf.js 6.5.438 appelle `getOrInsertComputed` de `Map` et de `WeakMap` (Chrome et Edge 145, Firefox 144, Safari 26.2). Dans un navigateur plus ancien, ton
refus `oldBrowser` joue avant de charger la bibliothèque : ton coin d'état dit « Ce navigateur est trop ancien pour lire un PDF : mettez-le à jour. », l'app reste sur son modèle et GFS n'a rien de cassé.
GFS l'a mesuré (13 vérifications en français clair et en anglais sombre, sans polyfill dans le labo : `LAB_NAVIGATEUR_ANCIEN=1`). Ta phrase est la bonne : rien à changer chez toi.

**5. Ce que tu fais.** Rien dans ton code. Dis « 044 · faite · lue, aucun code » dans `GFS-ETAT.md` et retire de « Demandes à GFS » la demande de l'extension « Lecture de PDF » (elle est faite). Tes
autres consignes ne changent pas : la 041 (l'ambiance) et la 043 (ranger les exports) restent à faire, et la 045 (commenter un PDF) prolonge ton extension `lecture-pdf` : son nouveau poids sera à redire dans
« Demandes à GFS ».

## Pourquoi

Une extension n'est servie que si le manifeste de GFS la déclare et que le catalogue a **toutes** ses bibliothèques (contrats 2.6, point 5) ; « Lire » ne se dégrise que pour une app dont le manifeste dit
quelle extension lit un PDF (contrats 2.7, point 5). Sans cette déclaration, ton app lisait un PDF que GFS ne lui donnait pas : la déclaration est donc le dernier maillon de la 040, et la mesure ci-dessus
est celle du geste du porteur de bout en bout : importer un PDF, cocher l'extension, « Lire ».

## Fait quand

`GFS-ETAT.md` donne « 044 · faite · lue, aucun code » et ne porte plus la demande de l'extension « Lecture de PDF ». Si, dans GFS, « Lire » n'affiche pas le PDF chez toi alors que
l'extension est cochée, dis-le dans « Questions pour GFS » avec la phrase de ton coin d'état : GFS le rejoue dans un vrai Grist.
