# 014 · « Nouveau » dans GFS : ouvrir un modèle vierge du type demandé

App : Publipostage+ · posée le 19/10/2026 · suite de la 010, qui laissait « Nouveau » de côté · quand : pour que « Nouveau » dans
l'explorateur de GFS ouvre un modèle vierge ; sans effet dans l'app seule

## Quoi

Hébergée par GFS, l'app ouvre un modèle vierge du type que GFS demande quand la personne choisit « Nouveau » dans l'explorateur,
au démarrage comme déjà ouverte. C'est la réponse à la question de son `GFS-ETAT.md` (« voulez-vous une erreur, ou que l'app ouvre
un modèle vierge du type demandé ? ») : **un modèle vierge**. Les messages sont ceux de `docs/contrats.md` (GFS, sections 5.1,
5.2 point 3 et 5.4 point 1) ; ce contrat est un brouillon qui évolue avec le prototype, et GFS annonce tout changement de message
par une nouvelle consigne. Ce que la 010 a mis en place (`ouverture` du contexte, `GfsLink.onOpen`, `js/gfs-open.js`) sert tel
quel : il reste le cas où `fichier` est `null`.

1. **Ce que GFS envoie.** L'`ouverture` du contexte, ou les `args` de l'appel `ouvrir` : `{ fichier: null, type, dossier,
   raison: 'nouveau' }`. `type` est l'un des quatre que le manifeste de l'app déclare dans `actions.ouvrir` : `document`,
   `grille`, `email`, `macro`. `dossier` est le dossier courant de l'explorateur, une indication : le manifeste ne déclare pas
   `colonnes.dossier` (le rangement de l'app est dans `Publipostage_PreferencesModeles`), donc le modèle arrive à la racine
   (contrats 5.4, point 1) et l'app ignore `dossier`.
2. **À l'arrivée.** `init()` attend déjà `GfsOpen.startupTemplateId()` avant de choisir le modèle de départ (`js/main.js` ligne
   2972) ; `designated()` de `js/gfs-open.js` rend `null` quand `fichier` est `null`. Pour `document`, `email` et `grille`,
   l'app ouvre un modèle vierge de ce type **à la place** de l'ordre habituel (la ligne, le modèle de la vue, ★), comme si la
   personne avait cliqué le bouton « Nouveau » du même type de sa barre (`onNew`, `onNewEmail`, `onNewGrid`). Pour `macro`,
   `onNewMacro` (`js/main.js` ligne 670) ouvre l'écran de composition, vide, par-dessus le modèle de départ habituel, comme son
   bouton : il ne vide pas l'éditeur. Un `type` que la garde de la 002 ne laisse pas ouvrir (`Templates.isOpenableType`,
   `js/templates.js` ligne 479), un `type` absent (la garde accepte un type vide, parce qu'un ancien modèle n'en a pas ; ici c'est
   une `ouverture` mal formée), ou un document en lecture seule : l'ordre habituel, sans message d'erreur, comme pour un fichier
   introuvable dans la 010.
3. **Quand elle est déjà ouverte.** GFS envoie l'appel `ouvrir` avec `fichier: null`. L'app ouvre le vierge par le chemin du
   bouton « Nouveau » du même type (`startNewTemplate`, `js/main.js` ligne 548), donc avec sa question « Enregistrer / Abandonner
   / Annuler » si des modifications attendent, puis répond `{ ouvert }` sans délai, comme dans la 010 :
   - `ouvert: true` quand le modèle vierge est à l'écran à la fin ; pour `macro`, quand l'écran de composition vide est ouvert
     (`onNewMacro` ne pose pas de question, il n'a rien à charger) ;
   - `ouvert: false` si la personne annule, si le `type` est refusé (point 2) ou si le document est en lecture seule ;
   - `startNewTemplate` ne dit pas aujourd'hui si la personne a annulé ou si rien n'a été ouvert : il faut lui faire rendre vrai
     ou faux, sans changer ce que font les boutons de la barre ;
   - les appels se traitent l'un après l'autre et après la fin du démarrage, comme ceux de la 010.
4. **Rien n'est écrit à l'ouverture.** Le modèle vierge n'est pas enregistré : il naît au premier « Enregistrer », comme avec le
   bouton « Nouveau » (contrats 5.4, point 1), et ni le modèle de la vue (`modeleDeLaVue`), ni le ★, ni aucun réglage ne bougent.
5. **Dire pourquoi.** Le coin d'état garde l'avertissement « modèle non enregistré » que pose déjà l'ouverture d'un modèle vierge
   (commentaire de `js/main.js` avant `startBlankDocument` : ne pas l'écraser par un message général). La phrase de la 010
   (« Ouvert depuis l'explorateur. ») reste celle de `raison: 'explorateur'` ; une phrase pour `nouveau` est facultative, tant
   qu'elle ne remplace pas cet avertissement.

Aucun ordre de livraison à respecter : GFS n'envoie l'appel `ouvrir` d'un « Nouveau » à l'app déjà ouverte qu'après avoir avancé
sa référence de l'app (et mesuré). L'écoute des messages de GFS suit la règle 7 du guide (1.1), comme `js/gfs-link.js` ; ce que
l'app fait d'une ouverture reste dans `js/gfs-open.js`, pas dans `js/main.js`. Lignes relevées sur `abfb600` le 19/10, à relire sur
`origin/main`.

## Pourquoi

Le 19/10, le porteur a répondu « Oui, la demander » à la carte « Demander à Publipostage+ de créer un modèle vierge quand tu
choisis « Nouveau » dans GFS ? ». Le double-clic d'un modèle marche depuis la 010 (mesuré le 19/10 dans un vrai Grist, avec la
version `abfb600` : `prototype/labo/run-ouvrir-publipostage.mjs`) ; « Nouveau » est la seule forme de l'appel `ouvrir` qui
n'aboutit pas encore : l'app répond `{ ouvert: false }` et GFS dit « Provisoire : Publipostage+ ne sait pas encore créer un
fichier de ce type depuis GFS, il s'ouvre sur son modèle habituel. » Les contrats le prévoyaient (5.4, point 1) ; l'app a posé la
question dans son `GFS-ETAT.md`, la réponse est ici.

## Fait quand

Un test échoue sur le code d'avant et passe après. Avec `gfs=0` dans son adresse et un GFS simulé par le test
(`dev-tests/gfs-stub.js`) : pour chacun des quatre types, une `ouverture` `{ fichier: null, type, dossier: '', raison: 'nouveau' }`
ouvre au démarrage un modèle vierge de ce type (document : éditeur vide ; email : bandeau Objet / À / Cc / Cci ; grille : tableau
de départ ; macro : écran de composition vide), à la place de l'ordre habituel sauf pour la macro, et sans rien écrire (aucune
ligne de plus dans `Publipostage_Modeles`, ni ★, ni modèle de la vue) ; un `dossier` rempli n'y change rien ; un `type` que la
garde de la 002 refuse, un `type` absent et un document en lecture seule suivent l'ordre habituel. Un appel `ouvrir` avec
`fichier: null` sur l'app déjà ouverte ouvre le vierge (avec la question d'enregistrement si des modifications attendent) et reçoit
`{ ouvert: true }` ; `{ ouvert: false }` si la personne annule, si le `type` est refusé ou si le document est en lecture seule ;
deux appels de suite se traitent l'un après l'autre. Sans `gfs` dans l'adresse, rien n'est envoyé ni écouté de plus et l'ordre
d'arrivée est celui d'aujourd'hui. La mesure dans un vrai Grist se fait ensuite avec le prototype, par GFS, qui avance alors sa
référence et retire sa phrase « Provisoire » pour « Nouveau ». À vérifier comme le reste de l'interface : 700 × 400, clair et
sombre, français et anglais. `GFS-ETAT.md` donne la ligne « 014 · faite · `commit` » et retire de « Questions pour GFS » la ligne
de « Nouveau ».
