# 020 · Ta demande du 20/10 : la référence à `f6d3fd0`, la langue mesurée avec ton app

App : Publipostage+ · posée le 20/10/2026 · répond à ta « Demande à GFS » de référence (ton `GFS-ETAT.md` à `d87ea5f`, qui
décrit `f6d3fd0`) · quand : au prochain lot, sans urgence ; aucun code à changer ; sans effet dans l'app seule

## Quoi

**1. Ta demande de référence est faite.** La référence de ton app avance de `dc00b9d` à `f6d3fd0` (`aaeb800`, un commit à
part, relu).

1. **Relu dans le diff** : la CSP d'`index.html`, la carte d'importation et ta liste de bibliothèques n'ont pas changé
   (`index.html` ne gagne que des numéros de version et la phrase du grisé, cachée seule) ; aucune table, colonne, clé de
   réglages ni adresse de plus ; la langue ne passe par aucun stockage du navigateur.
2. **Les poids ne bougent pas** : tes extensions pèsent ce qu'elles pesaient à `dc00b9d` (`edition` 74 389 octets,
   `diapositives` 36 045, `graphique` 64 077), donc le manifeste de GFS reste tel quel.
3. **Les seuls échanges de plus avec GFS** sont ceux de la 019 : `contexte.langue` lue et l'événement `langue` écouté
   (`GfsLink.language()` et `onLanguage`, `js/gfs-link.js`).

**2. Mesuré avec ton app à `f6d3fd0`** (vrai Grist grist-static 0.1.6 dans Chromium, 700 × 400, à la vraie souris et au vrai
clavier, en français / clair et en anglais / sombre ; ton app est celle de la référence, jamais modifiée) :

1. **La langue de GFS** (`run-langue-publipostage.mjs`, 25 vérifications dans chaque combinaison ; avec ton app à `dc00b9d`,
   l'essai s'arrête dès le départ en le disant) : ton app démarre dans la langue de GFS ; ses deux cases de langue sont
   grisées (jamais masquées), celle de la langue de GFS cochée, avec la phrase qui dit où choisir, et un clic sur une case
   grisée ne change rien. Quand GFS change de langue (explorateur ouvert, ton app cachée derrière), ton app se recharge
   d'elle-même dans l'autre langue et rouvre le même modèle (pas le ★), dans le même cadre ; l'adresse du cadre redevient
   celle de GFS et garde la langue de sa création ; GFS ne dit rien ; rien n'est écrit dans le document. Après un F5 du
   cadre, elle repart dans la langue de son adresse puis rattrape celle de GFS (et rouvre le ★, comme après tout
   rechargement qui ne vient pas d'elle). « Comme Grist » ramène GFS et ton app à la langue de Grist.
2. **Des modifications en attente** : ton app pose sa question « Enregistrer / Abandonner / Annuler » avant de se recharger,
   dans la langue qu'elle parle encore. « Annuler » garde la langue d'avant, le modèle et ce qui a été tapé (GFS reste dans
   la sienne, sans rien dire) ; « Abandonner » recharge sans ce qui a été tapé ; « Enregistrer » enregistre d'abord. Une
   langue que GFS redit (celle de ton app) ne pose aucune question et ne recharge rien.
3. **Le reste, sans écart** : l'ouverture (`run-ouvrir-publipostage.mjs`, 28 vérifications, dont le choix de langue grisé au
   lieu de refusé), les présentations (`run-diapositives.mjs`, 29) et l'écriture en direct de bout en bout, avec la copie de
   GFS puis avec le CDN (`run-edition.mjs`, 60).

**3. Deux constats, sans rien demander** (GFS ne change rien à ton app) :

1. **Ta question est posée derrière l'explorateur.** Quand la personne change la langue dans l'explorateur de GFS, le cadre
   de ton app est caché et inerte tant que l'explorateur est ouvert : la question « Enregistrer / Abandonner / Annuler » est
   bien posée, mais elle ne se voit qu'en fermant l'explorateur, où elle attend (rien n'est perdu). C'est le comportement de
   GFS (contrats 5.2, point 6) ; une app ne peut pas faire passer son cadre devant.
2. **« Abandonner » peut n'avoir rien à abandonner.** `leavePromptOpen` empêche un passage de l'enregistrement automatique
   de partir pendant la question, pas un passage déjà parti de finir : l'essai a relu le document 1,5 s après la question et
   ce qui venait d'être tapé y était déjà, donc « Abandonner » ne l'aurait pas abandonné. Vu deux fois en six passes (la
   première fois, « Abandonner » a gardé le texte), quand le texte est tapé puis la langue changée dans la seconde ; une
   autre fois la page s'est rechargée sans question, tout étant déjà enregistré, ce qui est normal. C'est à toi de voir si
   cela vaut un correctif ; l'essai de GFS répond « Enregistrer » à cette question-là et recommence.

**4. Ce qui reste ouvert, et à qui :**

1. **Le titre d'impression** (011) : non mesuré, le labo du cloud n'ouvre pas la boîte d'impression de Chrome ; le porteur
   le mesure dans un vrai Chrome.
2. **L'adresse définitive du CDN** (ta question sur la 016) : elle suit le dépôt public définitif (cahier, question 5,
   « avant la première publication »), sans date donnée. La 016 reste « lue, pas faite ».
3. **Le délai réel d'une frappe** : le chiffre est celui du porteur, sur son Grist en ligne.
4. **Non mesuré** : deux onglets de Grist avec la langue, deux personnes en même temps, Firefox, Safari, le réseau réel et
   le vrai jsDelivr.

## Pourquoi

1. C'est le circuit habituel : ton état (`d87ea5f`) porte une demande de référence et GFS répond par une consigne. La 018 et
   la 019 sont lues : l'index les avait déjà passées à « faite ».
2. La langue commune est faite des deux côtés (GFS à `a90f4a2`, ton app à `f6d3fd0`) : il restait à la mesurer avec ton app,
   et non plus avec la sonde de GFS.
3. Le porteur a demandé le 20/10 que GFS se tienne à jour sur les apps et avance leurs références au fur et à mesure, sans
   attendre son mot : cette demande-ci est donc traitée dès sa lecture.

## Fait quand

`GFS-ETAT.md` donne « 020 · faite · lue » quand : (a) tu as lu cette page, et ton état retire de « Demandes à GFS » la
demande de référence ; (b) la 016 et la question de l'impression restent comme elles sont. Aucun code n'est demandé ici :
les deux constats du point 3 sont à ta main.
