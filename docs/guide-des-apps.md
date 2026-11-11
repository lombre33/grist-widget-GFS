# Guide des apps Grist Factory : être prête pour GFS

Version 1 du 14 octobre 2026. Pour le projet de chaque app, Publipostage+ d'abord. Ce guide dit ce qu'une app doit
respecter pour tourner dans Grist Factory Suite (GFS) sans rien perdre quand elle tourne seule. Le pourquoi est dans le
cahier des charges (`cahier-des-charges-gfs.md`) ; ses numéros de section sont cités entre parenthèses. Le tableau d'ensemble
(ce qu'est GFS, ce qui est en jeu) est dans `gfs-en-bref.md`.

## En bref

- Une app reste **complète et autonome** : GFS ne lui retire rien, il l'héberge.
- **Dès maintenant, sans attendre GFS**, treize règles qui ne coûtent presque rien et évitent de la dette (section 1.1).
- **Une seule licence, la GPL 3.0**, dans le dépôt de chaque app (section 1.3).
- **Pour Publipostage+, une seule chose est urgente** : la garde « type inconnu », avant que quiconque écrive un nouveau
  type de modèle dans sa table (section 2.2).
- **Quand GFS arrive** : le kit en sous-module, le manifeste `gfs.json`, la liste unique des bibliothèques natives, le
  contexte et le stockage par le kit, les extensions, dont la bibliothèque n'est plus dans le dépôt de l'app mais portée par
  GFS, la langue de GFS, la zone de sa barre à laisser libre, l'adresse e-mail de la personne si elle la déclare et l'ambiance choisie (section 1.2).

---

## 1. Règles communes à toutes les apps

### 1.1 À respecter dès maintenant

1. **Aucun import du code d'une autre app.** Ce qui sert à deux apps va dans le kit (cahier 4.5) ; en attendant le kit, on
   le note, on ne le copie pas.
2. **Le contenu de l'app vit dans des tables préfixées par l'app** (un modèle, un formulaire, un graphe, un tableau de bord).
   Les réglages de la vue ne gardent que ce qui se refait en un clic. Toute clé de réglage nouvelle porte le préfixe de
   l'app (cahier 5.5). Une clé déclarée dans `reglages` sert aussi à l'arrivée : une vue qui en porte une, avec une valeur,
   s'ouvre sur ton app dans GFS (cahier 6.2, point 2) ; pour retirer un choix, écris `null` ou retire la clé, les deux
   disent « pas de choix ».
3. **Préserver l'inconnu** : un fichier d'un type que l'app ne sait pas ouvrir est listé grisé, jamais ouvert, jamais
   réenregistré, jamais proposé comme fichier de départ ; un nœud ou un attribut inconnu dans un contenu est gardé tel quel à
   l'enregistrement (cahier 5.4).
4. **Données** : changements additifs seulement ; tolérer les colonnes inconnues ; ne jamais écrire une colonne absente ;
   relire l'identifiant réel après un `AddTable` ; créer une table seulement avec l'accord de la personne, et préférer une
   ligne réservée d'une table existante (cahier 5.3).
5. **Ne rien déduire de `document.referrer` ni de sa propre adresse** (page, instance, document). Une seule fonction de
   l'app le fait, facile à remplacer par le kit (cahier 5.6).
6. **Stockage du navigateur** : chaque accès dans un `try/catch`, et l'app marche sans lui. Dans GFS, l'app tourne dans une
   origine opaque où `localStorage` lève une erreur (cahier 5.7) : GFS garde ses choix à sa place, par `contexte.stockage` à
   la lecture et `stockage.ecrire` à l'écriture (contrats 5.3), un espace de 1 Mo par app. Même cause : une extension du
   navigateur qui travaille dans la page (LanguageTool) peut ne pas travailler dans ce cadre : elle n'y travaille pas sous
   Firefox 140 (PC du porteur au travail, avec LanguageTool 11.3.1, la dernière version publiée) et y travaille sous Firefox 158 (son PC de
   la maison), puis au travail après la mise à jour de Firefox (28/10) (faits vérifiés 11) : la cause tenait à la version du navigateur, et
   l'app ne peut pas compter sur une extension. Le porteur a décidé le 28/10 (cahier 2) de ne donner
   d'adresse propre à aucune app pour cela : une app ne demande pas à GFS de sortir de l'isolement pour une extension du navigateur. La
   correction de l'orthographe du navigateur reste (rapporté par le porteur, 23/10).
7. **Messages** : `addEventListener('message')` en vérifiant `event.source`, jamais `window.onmessage =`. Cette affectation
   remplacerait l'écoute du script d'API de Grist (`grist-plugin-api.ts`, ligne 520) et couperait l'app de Grist.
8. **Tables internes de Grist** (`_grist_*`) : aucune écriture sans une raison écrite. Elle devra être déclarée dans le
   manifeste, sinon le courtier la refusera.
9. **Une bibliothèque nouvelle** : si l'app ne marche pas seule sans elle (native, comme celles de l'éditeur et des
   exports), une version exacte, inscrite dans la liste de l'app, chargée au premier usage si elle est lourde, jamais par
   un lien CDN non figé. Si c'est celle d'une extension (non native), elle ne s'inscrit ni dans la liste, ni dans l'import
   map de l'app : l'extension dit seulement l'identifiant et la version exacte qu'elle exige, et GFS porte le reste (cahier
   4.7). Seule la CSP de la page garde l'adresse exacte que le catalogue de GFS donne pour le mode CDN : GFS ne peut imposer
   aucune politique à un sous-cadre (mesuré à l'étape 2), et sans cette adresse le navigateur refuse le CDN. L'app le lui
   demande dans son `GFS-ETAT.md` et ne pousse jamais chez GFS (`consignes/LISEZ-MOI.md`, « Demander à GFS »).
10. **Une fonction lourde nouvelle naît comme une extension** : son code dans un dossier à part, atteint seulement à son
    premier usage ; ses points d'entrée (bouton, ligne de menu, type, export) déclarés à un seul endroit ; le grisé dessiné
    par le socle, pas par chaque point d'entrée (cahier 4.6). Le code de la fonction reste dans l'app ; sa bibliothèque lui
    vient de GFS, par un seul point d'accès dans l'extension (règle 9).
11. **CSP stricte** : une adresse s'ajoute à la politique de sécurité de la page consciemment, avec ce qu'elle sert à faire. **Le script d'API de Grist** y figure par son
    adresse entière (`https://docs.getgrist.com/grist-plugin-api.js`, jamais toute l'origine) **avec `'unsafe-eval'`**, que ce fichier exige : c'est un bundle de développement qui
    s'évalue par `eval()`. Sans cela le script s'arrête, `window.grist` reste vide et l'app ne dit jamais « prête » : GFS écrit « ne répond pas » (faits vérifiés 27). Un script
    d'API qui n'évalue rien (celui d'un Grist Docker) ne le montre pas : l'essai de l'app le lui fait servir sous la forme `eval(…)`.
12. **La charte Grist Factory** (cahier 3.4 ; `contexte/charte-ui-ux-grist-factory.md`, section 1). **Les textes français vouvoient** (les apps le font ; GFS aussi depuis le 09/11, décision du porteur).
13. **Ne jamais écrire** qu'activer ou cocher un module rend l'app plus sûre.
14. **Publier un formulaire, c'est ouvrir une porte à toute personne qui a le lien, sans compte, et sans passer par GFS** (contrats 3.7,
    point 8, et 11.9). Un lien lit la colonne entière de chaque Référence de ses formulaires, champs cachés compris, et ajoute des
    lignes dans toutes les colonnes de la table de chaque formulaire de sa page. Une app qui publie : ne laisse lire à un lien que la
    définition de son seul formulaire (jamais celle des autres, ni leurs clés) ; donne à chaque formulaire sa page et sa table de
    réception, sans colonne de gestion ; dit à la personne ce que le lien ouvre avant de publier ; traite toute ligne reçue comme un
    texte non fiable ; prend un refus de GFS (`GFS_ANNULE` : la personne ; `GFS_REFUSE` : une table protégée) sans laisser de section à
    moitié faite. GFS demande l'accord de la personne à chaque publication (contrats 3.3, point 9). **Depuis le 11/11**, une app qui déclare `partage` (contrats 3.4, point 8) peut poser
    elle-même le partage de la page de son formulaire (la recette du bouton « Publier » de Grist) : poser le partage n'ouvre rien, l'accord se demande à la publication ; un refus de la
    personne (`GFS_ANNULE`) n'est pas un échec de l'app, elle le dit comme tel et laisse la personne recommencer ou publier à la main. Un lien commun à deux formulaires ne se propose que
    **décoché**, et la personne le confirme dans une fenêtre de GFS (3.4, point 8 d).

### 1.2 Quand GFS arrive (étapes 3 à 5 du plan, cahier 10)

1. Référencer le kit en sous-module (`kit/`) et remplacer ses propres copies par celles du kit, une à une, sans changer
   l'interface : accès à Grist, traduction, jetons et thème, fenêtres, liste avec recherche, couches, consentement des
   tables, rappel « Enregistrer ».
2. Écrire `gfs.json` à la racine du dépôt (cahier 5.1).
3. Passer à la liste unique des bibliothèques natives (`package.json` à la racine, versions exactes) et à l'outil du kit
   (`kit/outils/bibliotheques.mjs`, kit 0.16.0 ; son `README.md`, « Les bibliothèques d'une app ») qui en tire le catalogue des
   empreintes, la carte d'importation, le `script-src` de la politique de sécurité (avec l'empreinte des scripts en ligne), les
   empreintes écrites dans le code et le miroir des essais ; activer Dependabot (`npm`). Celles des extensions n'y sont pas :
   elles sont à GFS. **Leur copie figée** (décision du porteur du 11/11 : « chez GFS, comme pour Plotly », « fonction par fonction ») est
   aussi chez GFS (`vendor/`, 2.6 point 14) : l'app range ses bibliothèques par **fonction** (Export PDF, Word, Excel, divers), GFS met
   ce rangement dans son manifeste (`natives`) quand l'app lit le choix, et l'app lit `GfsLink.native(id)` (kit 0.18.0, 5.2 point 12) :
   `{ version, src, integrite, forme }` si la personne a choisi la copie figée de cette fonction, `null` sinon. **Compare `version` à
   celle de ta liste** : égale, charge la copie par `src` avec `integrite` ; différente ou `null`, charge par **ton** CDN (celui que ta
   CSP nomme déjà : GFS ne te donne jamais l'adresse d'un CDN pour tes natives). Seule (sans GFS), l'app n'a pas la copie : elle charge par son CDN. **L'éditeur** (TipTap), dont la « copie » est une carte d'importation (une seule par page sous Firefox), a sa copie **dans ton dépôt** (décision du porteur, 11/11) :
   GFS ne la sert pas, il écrit `copie=editeur` dans l'adresse de ton cadre quand la personne l'a choisie (`GfsLink.copies()`, kit 0.19.0 :
   lu tout de suite, avant que GFS réponde) ; le choix prend effet au prochain démarrage de ton app. **Tu la fabriques avec l'outil du kit 0.20.0**
   (`gfs.copie` dans ta liste, puis `node kit/outils/bibliotheques.mjs --copies` : le dossier commité, ses licences et ses empreintes) ; ta page garde
   alors **deux cartes d'importation en données et un script** qui pose la bonne au démarrage (copie quand l'adresse dit `copie=editeur`, CDN sinon) ;
   l'outil tient le bloc et la politique (consigne 066, faits vérifiés 98).
4. Passer le contexte et le stockage par le client du courtier du kit (avec ses replis quand l'app est seule).
5. Ranger les fonctions lourdes dans `extensions/`, avec le registre et le grisé du kit, et retirer leurs bibliothèques de la
   liste et de l'import map de l'app : GFS les porte (la CSP garde l'adresse du mode CDN, règle 9).
6. Montrer, dans l'app seule, la fenêtre du grisé (section 5).
7. Ajouter les tests du contrat (section 4) et vérifier avec l'outil d'audit ce que compte la surface de l'app seule : l'outil lit
   un `import()` dont le chemin commence par un texte fixe, il ne lit pas une adresse calculée (mesuré à l'étape 2). Une
   extension chargée par une adresse calculée sort donc de la surface, et son code n'est relu par aucun audit : le mode de
   chargement des extensions se décide avec GFS (cahier 3.3, point 2, question 12).
8. Suivre la langue de GFS (contrats 5.2, point 6) : dans GFS, la langue de l'app est `contexte.langue` (`fr` ou `en`) à
   chaque démarrage, et l'événement `langue` la change en cours de vie ; l'app se retraduit, ou se recharge d'elle-même
   après sa question d'enregistrement s'il y a des modifications en attente (Enregistrer, Abandonner, Annuler) et rouvre ce
   qu'elle avait ouvert. Son propre choix de langue y est grisé avec la raison (« La langue se choisit dans Grist Factory
   Suite »), jamais masqué ; seule, l'app garde son choix.
9. Laisser libre la zone de la barre de GFS (contrats 5.2, point 7). Dans GFS, `contexte.barre` dit de quel bord la barre recouvre
   le cadre et le rectangle à garder libre (`zone`, en pixels du cadre) ; l'événement `barre` le redit à chaque changement (le
   bord choisi par la personne, la taille du cadre, l'explorateur ouvert ou fermé), sans recharger le cadre. La personne place
   la barre à gauche, en haut, à droite ou en bas : aucune interface de l'app ne suppose un bord. Ce que l'app pose près d'un
   bord (barre d'outils, bulle, menu, fenêtre, bande de diapositives, volet, repères fixes des coins) s'écarte de la zone, sans
   bande réservée : hors de la zone, tout le cadre est à l'app. Une app qui masque la barre (un diaporama plein cadre) le
   demande par `barre.masquer` et offre elle-même la sortie, puisque la barre n'est plus là pour ouvrir l'explorateur.
10. Ne jamais remettre un ancien nom (contrats 6.3, point 2) : dans GFS, la personne peut renommer un fichier depuis
    l'explorateur pendant que l'app le tient ouvert ; GFS n'écrit alors que la colonne du nom (`colonnes.nom`), et refuse un nom
    qu'un autre fichier de la même table porte déjà. L'app ne met donc le nom dans la ligne qu'elle écrit qu'à la création du
    fichier et quand la personne l'a changé chez elle ; sinon il reste hors du lot (le relire avant chaque enregistrement
    coûterait la table entière, qui peut peser des mégaoctets). À la prochaine ouverture, l'app lit le nom de la table. Une app
    qui n'écrit pas de nom n'a rien à faire. Les favoris et les dossiers que la personne pose dans GFS sont à GFS
    (`GFS_Rangement`) : l'app garde les siens. **Depuis le 04/11**, GFS peut aussi retirer la ligne d'un fichier (la corbeille) et en ajouter une
    (la copie) quand le manifeste en déclare la recette (`suppression`, `copie`, contrats 2.4) : l'app accepte une ligne qu'elle n'a pas écrite,
    sans jeton (elle en donne un au premier besoin, sans écraser celui d'une ligne qui en a un), et retrouve une ligne restaurée à son numéro d'avant.
    Une app seule, sans GFS, garde sa propre gestion de ses fichiers.
11. Rester en ligne là où GFS l'ouvre (décision du porteur du 22/10 : « servir les dépôts live, pas une copie figée »). Dans GFS,
    la personne ouvre ton app sur son site GitHub Pages, tel qu'il est en ligne (contrats 1.3, point 2) : garde l'adresse du site et
    l'entrée de ton manifeste, et ne pousse pas un changement de contrat (ce que GFS lit ou te donne, les tables, colonnes, clés
    de réglages et de stockage que tu écris, les adresses, bibliothèques, CSP, poids des extensions) sans le dire, dans le même
    envoi, dans ton `GFS-ETAT.md` (« Changements qui touchent GFS » : ce que GFS doit rejouer). La référence du sous-module ne
    sert plus qu'aux mesures de GFS et de repli : la ligne « à avancer à … » de ta page n'a plus lieu d'être, celle de ton en-tête
    (le dernier commit de code que la page décrit) dit où GFS rejoue ses essais.
    **Garde ce site publié** (décision du porteur du 02/11) : un fichier vide `.nojekyll` à la racine du dépôt (sans lui,
    Pages passe les `.md` dans Jekyll, et une accolade double non fermée fait échouer la publication : le site reste sur
    l'ancienne version sans rien montrer, comme celui d'Automation+ du 21/10 au 02/11) ; à chaque lot, le run « pages build
    and deployment » vert et un changement du lot vu en ligne (faits vérifiés, section 5).
12. Recevoir le fichier d'un « Nouveau > Importer » (décision du porteur du 22/10 ; contrats 2.7, point 4, et 5.4, point 1). Une app qui
    sait lire un fichier d'un autre logiciel (un classeur, un Markdown, un PowerPoint) le déclare dans `actions.importer` (une
    `valeur`, un `nom` en français et en anglais, le `type` du modèle qu'il crée, les `extensions`) : GFS en fait le sous-menu
    « Importer » du menu « Nouveau », ouvre lui-même le sélecteur de fichier, et donne le `File` à l'app avec l'ouverture
    (`raison: importer`, `importation: { valeur, fichier }`) ou, quand elle est déjà ouverte, avec l'appel `ouvrir`. L'app prend ce
    fichier **par le chemin de son propre menu d'import** : mêmes lectures, mêmes refus dits dans son coin d'état, même question
    « Enregistrer / Abandonner / Annuler » avant de quitter un modèle modifié, un modèle vierge sans nom qui naît à son premier
    « Enregistrer » ; elle répond `{ ouvert: true }` quand il est ouvert à la fin, `{ ouvert: false }` si la personne annule ou si le
    fichier est refusé. Elle ne le prend **jamais pour un « Nouveau » du type** (`fichier: null` et un `type`) : elle ouvrirait un
    modèle vierge et dirait `ouvert`. Elle garde `importation` dans sa lecture de l'ouverture (le `normalizeOpening` du kit la
    gardera dans sa prochaine version), ne lit le `File` qu'une fois (GFS ne le rend qu'une fois) et vérifie son contenu comme celui
    de son sélecteur : la terminaison est déjà contrôlée par GFS, rien d'autre. Tant que GFS n'a pas lu dans le `GFS-ETAT.md` de l'app
    que la consigne est faite, ses formats sont grisés (« Pas encore »).
13. Lier un fichier d'une autre app, et offrir les tiens à lier (décision du porteur du 03/11 ; contrats 5.4, point 7). **Pour lier** :
    `GfsLink.choose({ types, apps?, titre? })` (kit 0.3.0) fait ouvrir à GFS son explorateur en mode choix et rend `{ app, id, nom, type }`,
    ou `null` si la personne annule ; garde la clé `{ app, id, type }` (le `nom` n'est qu'une étiquette : un fichier renommé garde son
    `id`) et rends-la à `GfsLink.openFile(clé)` pour l'ouvrir. Un lien n'est jamais supprimé par l'app : un fichier disparu
    (`GFS_INTROUVABLE`) ou une app que la personne ne débloque pas (`GFS_ANNULE`) se montre grisé, avec la raison, et la personne le retire
    ou le refait. Seule, l'app grise « Lier un fichier », avec la phrase commune (section 5). **Pour être liée** : déclare dans
    `actions.choisir` les types que l'on peut désigner (pas ceux qui n'ont pas de sens hors de l'app : un e-mail, une macro) et dans
    `actions.ouvrir` ceux que tu sais ouvrir ; réponds à l'appel `ouvrir` comme au double-clic de l'explorateur (une raison que tu ne
    connais pas, `lien` par exemple, ne change rien à ce que tu ouvres).
14. Connaître la personne qui est là (décision du porteur du 03/11 ; contrats 3.4, point 6, et 5.2, point 9). Une app qui a besoin de
    l'adresse e-mail de la personne (« Mes tâches », « qui peut modifier quoi ») la **déclare** dans son manifeste :
    `"permissions": { "identite": { "pourquoi": { "fr": "…", "en": "…" } } }`, avec une raison que la personne comprend (la fenêtre
    d'installation la montrera, et un client pourra lister les apps qui la reçoivent). GFS ne la donne qu'à celles-là : elle arrive dans
    `contexte.identite` (`{ email }`), puis par l'événement `identite` quand GFS ne l'apprend qu'après le contexte (la table du
    rangement naît pendant la session). Dans le kit : `GfsLink.identity()` et `GfsLink.onIdentity(fn)` (kit 0.4.0). **Le repli est
    obligatoire** : `null` veut dire « pas déclarée », « GFS ne la connaît pas encore » ou « app seule », sans que l'app puisse le
    distinguer ; elle fait alors comme seule (sa propre table d'essai, créée avec l'accord de la personne, ou un « Je suis… » que la
    personne choisit et que `GfsLink.storageSet` retient). L'adresse sert à montrer, filtrer et griser, jamais à décider d'un droit :
    seul Grist refuse (contrats 11.1) ; quand elle sert de clé, elle se compare en minuscules (contrats 11.1, point 7).
15. Lire un fichier que GFS garde, un PDF (demande du porteur du 03/11 ; contrats 2.7, point 5, et 5.4, point 8). Une app qui sait lire le type
    le **déclare** dans `actions.lire` (`[{ "type": "pdf", "extension": "lecture-pdf" }]`, l'`extension` étant celle de l'app qui apporte
    la lecture, déclarée dans `extensions` avec sa bibliothèque `{ id: "pdfjs", version: "1.0.0" }`) : GFS fait de « Lire » le geste du PDF, grisé
    tant que l'app ou l'extension manque ou que `ouverture.lire` n'est pas déclaré dans le manifeste (la consigne faite). GFS **télécharge lui-même** le PDF et le donne à l'app avec
    l'ouverture (`raison: lire`, `lecture: { id, fichier }`) ou, quand elle est déjà ouverte, avec l'appel `ouvrir` : l'app ne reçoit aucun jeton, ne
    demande rien à l'API de Grist, ne renvoie jamais les octets. Elle **garde `lecture` dans sa lecture de l'ouverture** (le `normalizeOpening` du kit
    la garde depuis sa version 0.7.0 ; celui de Publipostage+ ne garde aujourd'hui que `fichier`, `type`, `dossier`, `raison`, `importation`), lit `lecture.fichier` comme
    tout fichier choisi (`arrayBuffer()`), charge pdf.js par la source de `contexte.bibliotheques.pdfjs` (un `<script type="module" src integrity
    crossorigin="anonymous">`, puis `GfsPaquets.pdfjs.modules['pdfjs-dist/build/pdf.min.mjs']` : jamais `import()`, jamais le CDN d'un autre site ; la
    copie de GFS passe avec `'self'`, rien à ajouter à la CSP de l'app), ouvre le document avec `verbosity: 0` et `isEvalSupported: false`, ferme le
    précédent par sa tâche de chargement (`destroy()`), et répond `{ ouvert: true }` quand le PDF est ouvert, `{ ouvert: false }` si la personne annule ou
    si le fichier est refusé. `lecture.id` est l'identifiant du fichier chez GFS, qui ne change ni au renommage ni au remplacement : c'est la clé où
    accrocher ce que l'app garde sur ce PDF (des commentaires). Le texte d'un PDF scanné manque, un PDF protégé demande son mot de passe (`onPassword`) ;
    l'app le dit, elle ne plante pas. Le moteur tourne dans la page (faux Worker) : lire page par page, jamais tout le document d'un coup.

15. Suivre l'ambiance de GFS (décision du porteur du 02/11 et du 03/11 ; contrats 5.2, point 10 ; kit 0.6.0). Dans GFS, `contexte.ambiance` dit
    l'ambiance et la couleur que la personne a choisies pour GFS et ses apps (`null` : rien n'est choisi, l'app garde ses couleurs) ;
    l'événement `ambiance` les change en cours de vie, sans recharger le cadre. **Le kit fait la pose, l'app ne l'écrit pas** : elle appelle
    `Ambiance.start()` (`js/ambiance.js` du kit) une fois, dans son module d'entrée, avant d'afficher. Le kit lit le message avec méfiance
    (`js/ambiance-message.js` : les jetons qu'il connaît, des `#rrggbb`, rien qui sorte de sa déclaration), pose par le CSSOM les dix-neuf jetons
    de couleur du mode que l'app affiche (son thème, puis celui de Grist, puis le système : il suit le mode sans événement de GFS) et les jetons de
    forme, et retire tout ce qu'il avait posé, et rien d'autre, quand GFS dit `null`. Une app qui n'a pas encore le kit le prend (1.2, points 1 et 4 : le
    sous-module et le lien avec GFS du kit) au lieu de recopier la pose. **Une app qui garde son propre lien avec GFS** (Publipostage+ : `reglages`) n'appelle
    pas `Ambiance.start()`, qui démarrerait le lien du kit à côté du sien : deux liens dans un même cadre numéroteraient chacun leurs appels depuis 1 et
    prendraient les réponses l'un de l'autre (lu dans `js/gfs-link.js` du kit, non mesuré). Elle prend la même pose sans le lien du kit : `createAmbiance({ link, isDark })`
    de `js/ambiance-pose.js`, où `link` est le sien (il donne `ambiance()`, `onAmbiance(fn)` et sa promesse `ready`, par `normalizeAmbiance` de `js/ambiance-message.js`) et
    `isDark()` dit le mode qu'elle affiche. Ce que l'app écrit, c'est ses feuilles :
    - **Les couleurs par les jetons de la charte, jamais en dur** : sinon l'ambiance ne les change pas. GFS tient le contraste de 4,5:1 de ces paires, dans les
      deux modes : `--text` et `--text-muted` sur `--bg`, `--surface`, `--surface-sunken` et `--accent-soft` ; `--accent-ink` sur `--surface`, `--accent-soft` et
      `--bg` ; `--on-accent` sur `--accent-solid`, `--accent-solid-hover` et `--accent-end` ; `--accent` seul (une icône, un trait, un lien) sur `--surface` et `--bg`.
      Une paire que l'app invente garde son propre contraste.
    - **Le fond de la page est `--bg`**, sur un élément qui couvre la page (`min-height: 100vh`), jamais `--main-bg` (le fond de la carte de GFS : il
      vaut `transparent` chez Néon, ambiance remplacée par Enseigne le 04/11 (un mélange à 90 % de `--surface` chez elle) : un titre clair y tombait à 1,10:1, mesuré). Le décor `--wash` se pose en `background-image` de ce même fond, avec
      `--wash-size` ; sur un élément plus court que la page, il se répète à chaque hauteur de contenu (vu).
    - **Les jetons de forme que l'app a en équivalent** : `--radius-xs`, `-sm`, `-md`, `-lg`, `-pill`, `-btn`, `-input`, `-panel` (arrondis des étiquettes, contrôles,
      cartes, fenêtres, pastilles, boutons, saisies, grands panneaux) ; `--bw` (trait des contrôles et des cartes) ; `--shadow-ctl`, `--shadow-panel`, `--shadow-float`
      (un contrôle, une carte, une fenêtre ou un menu flottant) ; `--font-ui`, `--font-head` (avec `--fs-head`, `--fw-head`, `--ls-head`, `--tt-head`), `--font-label`
      (avec `--ls-label`) ; `--stripe` et `--stripe-h` (le filet en haut d'une carte ou d'une fenêtre) ; `--fill`, `--fill-hover`, `--fill-line` (le bouton plein, un
      dégradé chez Pop : `--accent-solid` sinon) ; `--avatar-*` ; `--bar-w` (la barre de la ligne choisie). Chacun avec sa valeur d'origine en repli
      (`var(--radius-md, 10px)`) : sans ambiance, la page est celle de l'app. **À ne pas lire** : `--ex-bg`, `--main-bg`, `--main-overflow`, `--gap`,
      `--divider`, `--divider-w`, la mise en page de GFS. Une app qui ne lit pas un jeton garde sa forme et prend les couleurs : rien ne casse.
    - **L'accessibilité renforcée arrive par le même message** (décision du 04/11, premier temps ; contrats 5.2, point 10) : quand la personne allume l'interrupteur de la fenêtre « Thème », `contexte.ambiance.id` vaut `renforcee`, avec les mêmes
      dix-neuf jetons de couleur (le texte à 7:1 sur les mêmes paires, le trait des commandes à 3:1 : `--border-strong` sur `--surface`, `--bg` et `--surface-sunken`) et les mêmes jetons de forme (`--bw` à 2 px, `--bar-w` à 6 px, ni ombre, ni trame, ni filet, ni capitales). L'app ne fait rien
      de plus : elle lit des jetons, **jamais l'`id`** (une règle écrite pour une ambiance ne s'applique pas à `renforcee`). Ce que GFS fait de ses propres couleurs d'état et de type, qui ne sont pas dans les dix-neuf jetons : le texte (erreur, avertissement, « bon », type) prend `--text`, la couleur reste à l'icône.
      **Le second temps (10/11) est l'interface de GFS seule** : cibles de 36 px, texte de 14 px, anneau de focus de 3 px, aucun mouvement, barre de sélection en vrai trait. Aucun jeton ne le dit, donc **l'app n'a rien à changer** (et GFS ne touche pas à son cadre) ; si elle veut le même confort dans ses propres
      écrans, c'est son choix et sa mesure, et le dire à GFS pour qu'un jeton existe si l'on veut qu'elle le suive. Une chose se fait toute seule : le contraste forcé du système et « réduire les animations » valent dans chaque cadre, et une app qui retire ses couleurs (`forced-colors: active`) doit rester lisible sans elles.
    - **Seulement ce qu'elle affiche à la personne**, jamais ce qu'elle produit (un e-mail, un PDF, un document, un formulaire public).
    Seule, l'app garde ses couleurs. Quand l'app propose elle-même un choix de couleur (une couleur de modèle, de document, de thème de présentation), elle prend
    **le sélecteur de couleur du kit** (`createColorPalette`, `ColorEditor` et `ColorDialog`, kit 0.5.0, tiré de celui de Publipostage+) et n'en garde pas de copie :
    c'est le même que GFS ouvre pour « La mienne », avec ses rangées de couleurs gardées par l'app (en lecture seule quand elles viennent d'ailleurs), ses textes
    français et anglais, et ses couleurs posées par le CSSOM, jamais par un attribut `style` (la politique de sécurité du contenu d'une app le refuse).
16. Taire le rappel « Enregistrer » quand GFS a enregistré le réglage (décision du porteur du 03/11 ; contrats 7.3, points 4 à 6). Dans
    GFS, les réglages que l'app écrit avec `setOption`, `setOptions` ou `clearOptions` (les clés de son manifeste, rien d'autre) sont écrits
    dans la vue par GFS : la personne n'a rien à enregistrer dans Grist, et l'app relit ses réglages par l'écho de Grist (`onOptions`),
    comme avant. Après chaque écriture, GFS envoie l'événement `reglages` `{ enregistres }` (contrats 5.1) : **vrai**, l'app n'affiche
    ni son rappel « Enregistrer » ni la phrase qui l'annonce ; **faux** (GFS s'est replié sur le brouillon de Grist : un brouillon était
    déjà posé, ou la structure du document est réservée), elle garde son rappel, qui n'est vrai que là. Avant le premier événement,
    et seule, elle le garde aussi. Elle n'écrit toujours aucun réglage sans geste de la personne (section 2.4).
17. Ranger dans GFS un fichier que l'app vient de fabriquer, un export en PDF (demande du porteur du 03/11 ; contrats 2.7, point 6, et 5.4,
    point 9). Une app qui sait donner ses exports à GFS le **déclare** dans `actions.ranger` (`["pdf"]`) ; sans cela GFS refuse l'appel
    (`GFS_REFUSE`). L'app n'écrit rien chez GFS : elle appelle `ranger { fichier, nom, lot?, suivants?, dossier? }` avec le `File` qu'elle vient
    de fabriquer, **un fichier par appel**, et GFS le garde (`GFS_Fichiers`, 6.6) ; elle n'a ni jeton ni droit d'écriture pour cela. C'est GFS qui
    pose à la personne la question « Ce nom est déjà pris » (Remplacer, Garder les deux, Annuler) : l'app ne refait pas cette fenêtre et ne
    devine pas le nom libre (sa propre numérotation reste à elle, pour ses téléchargements). Pour un export de plusieurs fichiers, elle donne le
    même `lot` à tous et, à chacun, le nombre de `suivants` à ranger encore (0 pour le dernier) : la personne peut alors répondre une fois pour
    tous. L'app laisse la personne choisir la destination de son export, **télécharger**, **ranger dans GFS** ou les deux, et garde ce choix
    (`GfsLink.storageSet`) ; seule, « Ranger dans GFS » est grisé, jamais masqué, avec le texte commun (section 5). Elle lit la réponse
    `{ statut, id, nom }` (`ajoute`, `remplace`, `copie`, `ignore` : la personne n'en veut pas) et **dit elle-même ce qui s'est passé** dans son
    coin d'état, car GFS ne dit rien par-dessus l'app ; une erreur arrive avec son code et sa phrase (`GFS_ANNULE` : la personne a refusé de
    créer la table des fichiers ; `GFS_ECHEC` : le serveur n'a pas pris le fichier ; `GFS_LECTURE_SEULE`, `GFS_ACCES`, `GFS_REFUSE`, `GFS_INACTIF` ;
    `GFS_INCONNU` : un GFS qui ne sait pas encore ranger) et ne fait jamais échouer l'export. Une impression par le navigateur ne fabrique pas de
    fichier : elle ne se range pas. Le kit 0.7.0 offre `GfsLink.deposit(...)` ; une app qui a son propre lien (Publipostage+) écrit le même appel.

18. Commenter un PDF que GFS garde (demande du porteur du 03/11 : lire les PDF « via le mode lecture de Publipostage+ comme ça on a aussi les
    commentaires et l'UI qui reste la même » ; contrats 5.4, point 8, et 6.6). Les fils d'un PDF sont **à l'app** : GFS ne garde que le fichier,
    n'écrit jamais la table d'une app et ne reçoit aucun commentaire. Ils s'accrochent à `lecture.id`, l'`Identifiant` du fichier, que ni un
    renommage ni un remplacement ne changent (« Garder les deux » en donne un autre : c'est un autre fichier), dans une table que l'app a déjà
    (pas de table de plus), par des colonnes de plus ajoutées **au premier fil publié** : par `AddColumn` seulement (le courtier refuse
    `ModifyColumn` et `RenameColumn`), après avoir relu les colonnes présentes (un `AddColumn` sur un identifiant pris le renomme), sans jamais
    écrire une colonne absente ; un refus de Grist (structure fermée) est dit avec sa raison, jamais perdu en silence. **Ouvrir un PDF n'écrit
    rien** : ni table, ni colonne, ni ligne, et aucune question à la personne. L'ancre d'un fil est du **texte, jamais des pixels** : la page,
    les positions et la citation dans le texte que donne pdf.js (réduit aux mêmes espaces), avec un peu de texte autour. Elle se calcule sans la
    couche de texte, qu'une page hors de l'écran n'a pas ; la marque se redessine chaque fois que la page se dessine (défilement, zoom) ; elle se
    retrouve dans une version remplacée du PDF, page par page. Un passage qui ne se retrouve plus est dit « introuvable » : le fil reste lisible,
    résoluble et supprimable, et **l'app ne l'efface jamais de son propre chef**, pas plus que les fils d'un PDF que GFS a supprimé (l'app ne
    le sait pas). Un PDF sans texte (un scan) ne se commente pas : « Commenter » est grisé avec sa raison, jamais masqué. Les règles d'accès de
    ces fils (leurs lignes n'ont pas de `ModeleId`) attendent l'étape 5 (contrats 11.7, point 3) : l'app n'en écrit aucune d'ici là.

19. Répondre à `fermer` avant de laisser la place (demande du porteur du 04/11 : « gérer les enregistrements automatiques en cas de swap
    d'app ou de fichier », que GFS lit ainsi ; contrats 5.4, points 3 et 7). Dans GFS, quand la personne ouvre une autre app (la fenêtre des apps), le fichier
    d'une autre app (l'explorateur) ou suit un lien vers une autre app, GFS appelle `fermer { raison }` sur l'app active (`raison` : `app`,
    `explorateur`, `nouveau`, `importer`, `lire` ou `lien`) et ne détruit son cadre qu'après sa réponse `{ ferme: true }`. L'app répond
    selon l'état de ses données : **rien en attente** : `{ ferme: true }` tout de suite ; **enregistrement automatique allumé** : elle
    enregistre ce qui attend (et laisse finir une écriture en cours), puis répond `{ ferme: true }` **sans poser de question** ;
    **l'écriture échoue, ou l'enregistrement automatique est coupé et des modifications attendent** : elle pose sa propre question
    (Enregistrer, Abandonner, Annuler) : Enregistrer ou Abandonner répondent `{ ferme: true }`, Annuler répond `{ ferme: false }` et tout
    reste en place. Elle ne se ferme pas d'elle-même : GFS détruit le cadre après le `oui`. Aucun délai à tenir : sans réponse au bout de
    10 secondes, ou sur une erreur, GFS demande à la personne (« Fermer quand même », qui perd ce qui n'est pas enregistré, ou « Attendre » /
    « Rester ») ; une app qui pose sa question et dont la personne tarde à répondre n'a rien à faire de plus que de répondre quand elle le
    peut. Une app qui ne connaît pas l'appel répond `GFS_INCONNU` (contrats 5.1, point 3 ; le comportement d'avant : elle part sans rien enregistrer, d'où cette
    règle) ; celle qui ne répond à rien, pas même cela, fait attendre dix secondes avant que GFS pose sa question à la personne. Même règle, déjà, quand GFS appelle `ouvrir` sur l'app active pour un autre fichier de la même app : sa question d'enregistrement
    vient avant `{ ouvert }`. Une app écrite avec le kit répond par `GfsLink.onClose(async ({ raison }) => …)` (kit 0.9.0 : vrai laisse partir, faux garde l'app, une erreur remonte à la personne) ; sans cet abonné, le kit répond `GFS_INCONNU`. **« Tu restes »** (choix du porteur du 09/11, contrats 5.4, point 3) : si l'app a répondu `{ ferme: true }` et que la personne est revenue à l'explorateur avant que GFS détruise le cadre (ou a fait « Fermer quand même » puis est revenue), GFS appelle `rester { raison }` (la raison du `fermer` auquel l'app a dit oui) et l'app **reprend ce que `fermer` avait arrêté** (un verrou levé, une exécution coupée : Automation+) puis répond `{ repris: true }` ; une app qui n'a rien arrêté n'a rien à faire (ni abonné, ni réponse : `GFS_INCONNU` ne produit aucune phrase). Écrite avec le kit : `GfsLink.onStay(async ({ raison }) => resume())` (kit 0.13.0, vrai quand l'app a repris). Seule, hors de GFS, l'app garde sa propre sortie (`beforeunload`, « Enregistrer » du kit).

20. Répondre à `supprimer` et à `dupliquer` quand un fichier de l'app tient à plus qu'une ligne (demande du porteur du 04/11 : « tout se
    fait depuis l'explorateur, pour toutes les apps » ; contrats 2.4, `suppression.appel` et `copie.appel`, et 5.4, points 10 et 11 ; **seulement
    une app dont les fichiers sont plus qu'une ligne** : Form+ (un formulaire, sa section, sa table de réponses, son lien public) ; Publipostage+,
    dont un modèle est une ligne, n'a rien à répondre). Dans GFS, la personne met ce fichier à la corbeille (Suppr, le menu de la ligne) ou le
    duplique (Ctrl+C puis Ctrl+V) depuis l'explorateur : GFS appelle l'app **ouverte** (jamais une autre), qui seule sait le faire en entier ;
    tant qu'elle ne l'est pas, l'article est grisé et dit « Ouvre <app> ». **`supprimer { fichier: { id, type }, raison }`** : ferme ce qui est
    public (le lien d'un formulaire) et réponds `{ fait: true, dit? }` après avoir fini d'écrire, `{ fait: false, dit }` si tu ne peux pas ; **ne retire pas**
    la ligne du fichier (GFS la garde pour la restaurer), ni ses tables ni ses sections, et ne demande rien à la personne : rien ne s'efface, la
    corbeille se vide à la main. **`dupliquer { fichier: { id, type }, nom }`** : copie le fichier en entier sous `nom` (le premier nom libre,
    que GFS a calculé), **sans le publier**, et réponds `{ id, nom?, dit? }` (`id` : l'identifiant de la copie) ; sans `id` (`{ dit }`), tu n'as rien
    copié. `dit` est une phrase d'une ligne (200 signes au plus) que GFS ajoute à la sienne. Aucun délai à tenir à ta charge, mais sans réponse
    au bout de 20 secondes GFS ne t'attend plus et le dit ; `GFS_INCONNU` pour un appel que tu ne connais pas. Tu n'écris ni dans `GFS_Corbeille`
    ni dans `GFS_Rangement`. Seule, hors de GFS, l'app garde sa propre gestion de ses fichiers (ses boutons de suppression et de copie).

### 1.3 Licence : GPL 3.0 dans tous les dépôts (décision du porteur, 21/10)

1. **Le texte officiel de la GNU General Public License version 3** est le fichier `LICENSE`, à la racine du dépôt : 674
   lignes, à reprendre octet pour octet de celui du dépôt de GFS. Aucun autre texte de licence ne couvre le code propre de
   l'app.
2. **Chaque `package.json`** dit `"license": "GPL-3.0-only"` ; le README, les docs et un panneau « Crédits » éventuel disent
   « GPL 3.0 ».
3. **Le code d'un tiers** gardé dans le dépôt (un QR code, une bibliothèque copiée) garde sa licence et son avis d'origine,
   à côté du fichier. Elle doit être compatible avec la GPL 3.0 (MIT, BSD et Apache 2.0 le sont) : lire la licence avant
   d'ajouter du code tiers.
4. **Aucun en-tête de licence** n'est demandé dans chaque fichier.

---

## 2. Publipostage+

Relevé sur `main` 92ecd58 (14/10/2026). Le dépôt avance vite : relire les numéros de ligne sur `origin/main` avant de s'en
servir.

### 2.1 Déjà conforme

- Modèles et données dans des tables préfixées `Publipostage_` (`Modeles`, `Commentaires`, `LiensTables`, `Abreviations`,
  `PreferencesModeles`, `FormatsPage`, `UserProbe`).
- Réglages de la vue d'un clic seulement : `modeleDeLaVue`, `modeleSelonLigne`, `droitsAcces`, `dateDernierExport`, avec le
  rappel « Enregistrer » (`js/save-reminder.js`), faux dans GFS depuis le 03/11 : à taire quand GFS dit `enregistres: true` (règle 16 de 1.2).
- Tables créées avec l'accord de la personne (`js/table-consent.js`).
- Stockage du navigateur (`pp_*`) toujours dans des `try/catch` : l'app marche sans.
- Téléchargements par un `<a download>` (`js/export-common.js`, `downloadBlob`, ligne 92). Sous Firefox, cela demande `blob:` dans le
  `frame-src` de GFS : c'est fait (faits vérifiés 11), l'app n'a rien à changer.
- Moteurs d'export chargés au premier usage (`<script type="text/x-lazy-engine">` dans `index.html`,
  `ExportEngines.ensure`) : c'est déjà le patron des extensions.
- Charte : Publipostage+ en est la source.
- Une seule écriture dans une table interne : `_grist_Tables_column` (`js/template-pack.js`, ligne 255, colonne affichée
  d'une Référence créée par la galerie). Elle sera déclarée dans le manifeste.

### 2.2 À faire dès maintenant

**La garde « type inconnu », avant tout nouveau type de modèle.** Aujourd'hui, un modèle dont `TypeModele` vaut une valeur
que l'app ne connaît pas (« presentation », par exemple) s'ouvre comme un document (`js/main.js`, `typeModeleOf`,
ligne 330 ; seul `macro` a sa branche, ligne 270) et peut devenir le modèle de départ (`js/templates.js`,
`canBeDocumentDefault`, ligne 451, n'exclut que `email` et `macro`). S'il est réenregistré, il est abîmé. La garde :

- un type inconnu n'est jamais chargé dans l'éditeur, jamais enregistré, jamais proposé comme ★ ;
- il est listé grisé dans le sélecteur et dans « Organiser », avec deux textes possibles : « Demande l'extension
  {nom} (Grist Factory Suite) » pour un type que le socle connaît mais dont l'extension manque (`{nom}` est le nom lisible de
  l'extension, celui de son manifeste, dans la langue de l'interface), « Créé avec une version plus récente de Publipostage+ »
  pour un type que le socle ne connaît pas ;
- son test échoue sur le code d'aujourd'hui : un modèle `TypeModele = 'presentation'` n'est ni ouvert, ni réenregistré, ni
  proposé comme ★.

**Les règles de la section 1.1, au fil des lots**, en particulier :

- aucune définition nouvelle dans les réglages de la vue ; une clé nouvelle prend le préfixe `pp_`, celui des clés du
  navigateur (défaut pris ici, à changer si le porteur préfère un autre préfixe) ;
- une bibliothèque nouvelle dont l'app a besoin pour marcher seule s'inscrit, comme aujourd'hui, dans l'import map, dans la
  CSP et dans `dev-tests/.offline-cache/package.json` (jusqu'à l'adoption de la liste unique, consigne 063 : ensuite, dans
  `package.json` seul) ; celle d'une extension ne s'y inscrit pas, GFS la porte (règle 9) ;
- aucune lecture nouvelle de `document.referrer` ;
- les fonctions lourdes à venir (diapositives, temps réel, formats Office) naissent en extensions, et le graphique en est le
  pilote : sa consigne est posée (`consignes/publipostage/`), Plotly quitte alors la liste et l'import map de l'app ; la CSP de
  sa page garde l'adresse du mode CDN.

### 2.3 Quand GFS arrive

- **Kit** : Publipostage+ est la source du kit ; elle devient ensuite cliente de son propre code extrait, en rejouant ses
  tests à chaque remplacement (non-régression stricte).
- **Liste unique** : `package.json` à la racine, tiré de `dev-tests/.offline-cache/package.json` (41 paquets que la page
  charge et 4 que seuls les essais lisent ; Plotly et ECharts sont à la liste de GFS avec le graphique) ; l'outil du kit
  régénère l'import map et la CSP d'`index.html`, les empreintes et le miroir des tests. **Rejoué par GFS sur une copie du
  dépôt à `ac9b86d` (faits vérifiés 80), consigne 063.**
- **Où est Grist** : `fixBaseUrl` (`js/grist-api.js`, lignes 930 à 944) lit `document.referrer` pour corriger une instance
  auto-hébergée mal réglée. Dans GFS, le référent est l'adresse de GFS : la fonction passe par le kit.
- **Stockage** : les clés `pp_*` (liste `STORED` de `outils/depot-propre/controles.mjs`) passent par le stockage du kit.
- **Langue** : `initialLang()` lit `contexte.langue` dans GFS (avant `pp_lang` et la langue du navigateur), le gestionnaire
  de messages de `GfsLink` écoute l'événement `langue`, et son choix de langue (Réglages) est grisé dans GFS (consigne 019).
- **Manifeste** : `gfs.json`, d'après l'exemple du cahier (5.1).
- **Importer** : ses quatre imports (Excel, Markdown, PowerPoint, Word) sont déclarés dans `actions.importer` ; le fichier que GFS lui donne
  prend le chemin de son menu « + » (`onImportXlsx`, `onImportMd`, `onImportPptx` de `js/main.js`), consigne 035 et règle 12 de 1.2.
- **Extensions** : le graphique dans `extensions/graphique/` (pilote), puis diapositives, temps réel, formats Office. Leur
  code reste dans l'app ; leur bibliothèque est à GFS : l'entrée du manifeste dit l'identifiant et la version exacte qu'elles
  exigent, rien de plus (contrats 2.6).
- **Publication** : l'outil d'envoi (`outils/depot-propre/`) publie `gfs.json`, `extensions/` et la référence au kit ; la
  carte du code gagne une ligne par extension.

### 2.4 À ne pas faire

- Pas de deuxième page d'entrée dans le dépôt public : l'outil d'audit additionnerait les deux ; la version vendorisée se
  livre à part.
- Pas « tout vendoriser » ; pas de lien CDN non figé.
- Pas de bouton de plus dans la barre d'outils (gelée) : l'explorateur s'ouvre par « Organiser ».
- Pas de calcul dans le widget.
- Pas d'écriture de réglage sans geste de la personne : seule, l'app ferait afficher « Enregistrer » à Grist pour rien ; dans GFS,
  la vue changerait sans que la personne l'ait voulu.

---

## 3. Les autres apps

| App | Ce qui manque pour GFS (relevé le 14/10) | Premier pas |
|---|---|---|
| Form+ (`FormPlus`, `952fe4c`) | Définition entière dans les réglages de la vue, écrite par `grist.setOptions` ; écrit trois tables internes (relevé corrigé le 21/10 à `2c0ee50`, d'après la page d'état de l'app) : `_grist_Views_section` (`shareOptions` et `options` : `poc/js/grist-meta.js`, lignes 114, 216, 295 et 315 ; la colonne `options` ne se déclare jamais, contrats 3.3, point 6), `_grist_Views_section_field` (ajouts, retraits et `widgetOptions` : `poc/js/grist-meta.js`, lignes 85 à 209 ; `poc/js/config-editor.js`, lignes 1066 et 1113) et `_grist_Tables_column` (`visibleCol` : `poc/js/grist-meta.js`, lignes 132 et 157) ; crée des sections (`CreateViewSection`, `poc/js/grist-meta.js`, ligne 70) ; `document.referrer` lu dans `poc/js/links.js` (lignes 79 et 89), `poc/js/plugin-loader.js` (ligne 19 : l'origine d'où charger l'API des widgets) et `poc/js/diag.js` (ligne 12) ; le kit est appliqué depuis `952fe4c` (consigne 005 : sous-module `kit/` à `54c48f3`, jetons, fenêtres, thème et traduction française et anglaise du kit, plus de `prompt` ni de `confirm` ; deux ombres `rgba` restent en dur, `poc/css/widget.css` lignes 80 et 229) ; pas de CSP ; une face publique hors de Grist (`poc/public-form.html`) ; une dépendance externe, Leaflet (le type « Lieu sur carte »), que l'app seule charge depuis un CDN quand la page hôte l'active (`window.FORMPLUS_ENABLE_MAP`, `poc/js/kinds.js`) | Définition dans une table préfixée (`FormPlus_Formulaires`, consigne 007 du 21/10, faite à `038dd1b`, que GFS référence ; un formulaire ne s'y enregistre pas encore, avec ou sans GFS : consigne 008) ; écriture `_grist_*` déclarée et justifiée, ou retirée ; contexte par le kit ; CSP du kit ; Leaflet demandé à GFS (extension, règle 9) |
| Automation+ (`GRIST_automation`, `6eb0165`) | Graphe gardé dans les réglages de la vue (`grist.setOption('workflow', …)`, `js/main.js`) et, depuis `5a166f4` (21/10), dans une table du document créée avec l'accord de la personne : une seule, `Automation` (workflows, journal et verrou d'exécution entre onglets, `js/store.js`), sans le « _ » que le contrat demande à la fin du préfixe (`Automation_`, contrats 2.3) ; une colonne `Auteur` à formule déclenchée (`user.Email`, à la création de la ligne ; repli sans formule si Grist la refuse), dont la capacité `formules` est déclarée par GFS depuis le 09/11 (contrats 3.4, point 2 ; une table créée avant garde sa colonne sans formule) ; lit la ligne sélectionnée (`grist.onRecord` avec `includeColumns: 'all'`, niveau `full`, contrats 4.3) ; fenêtres, traduction, thème et jetons refaits ; ne tourne que vue ouverte ; une CSP (le script de l'API des widgets de `docs.getgrist.com` seul, et `'unsafe-eval'` à cause de lui : `SECURITY.md`) ; écarts à la 1.1 relevés par l'app (consigne 001, `e356021`) : restent la règle 2 (le graphe aussi dans les réglages de la vue, clé `workflow` sans préfixe) et le logo (règle 12) ; corrigés à `6eb0165` : la règle 3 (un graphe illisible n'est plus réécrit : « Workflow conservé tel quel »), la règle 4 (l'identifiant réel est relu après `AddTable`, plus d'écriture dans une colonne absente) et le reste de la 12 (jetons `--z-*`, plus de vert hors de la palette) ; relevé corrigé le 21/10 à `6eb0165`, d'après la page d'état de l'app | Client du kit après Form+ et Publipostage+ (cahier 4.5) ; nommer la table avec le préfixe (`Automation_…`) ; graphe seulement dans la table ; section à part dans GFS (cahier, question 4) |
| Grist-BI (`Grist-BI`, `23647eb`) | Toutes ses bibliothèques vendorisées dans `js/vendor/` (ECharts, DuckDB-WASM de 34 Mo, Arrow, xlsx), pdfmake et PptxGenJS sur cdnjs ; pas de CSP ; son propre accès à Grist ; tables `BI_Dashboard_Config` et `BI_Dashboard_Comments` (les commentaires, depuis le 30/09 : sa page d'état du 22/10 relève l'omission de cette seconde dans ce guide) ; depuis `6a12db9` (21/10) l'app ne crée plus de table de test de charge (`BI_StressTest`) et se connecte à la première table existante ; depuis le 21/10, une table-sonde `BI_Dashboard_UserProbe` (une colonne à formule `user.Email`, pour proposer l'auteur d'un commentaire) créée au démarrage sans demander à la personne (`js/grist-api.js`, `getCurrentUserEmail` : règle 4 ; la formule demandera la capacité `formules`, contrats 3.4) ; lit `_grist_Tables` et `_grist_Tables_column` ; au catalogue de GFS depuis le 04/11 (type « Rapport BI ») : **elle ne démarre pas dans le sous-cadre isolé**, quatre lectures de `localStorage` sont hors d'un `try` (règle 6 ; faits vérifiés 36) | Liste unique, mode CDN par défaut (DuckDB-WASM depuis un CDN : à essayer) ; CSP du kit ; action « insérer » (le rendu portable d'une tuile) ; demander l'accord avant ses trois tables (sa page d'état du 22/10 relève l'écart à la règle 4 pour chacune), ou remplacer la table-sonde par une ligne réservée ; consigne 007 (04/11) : le stockage gardé, un rapport = une ligne nommée de `BI_Dashboard_Config` (`Nom`, `TypeRapport`, `DateModif`, `ModifiePar`), le lien du kit pour l'ouverture |
| Slides+ (`SlidesPlus`, 747a700) | Pas une app de GFS : les diapositives deviennent une extension de Publipostage+ ; son dossier `shared/` est fait de copies adaptées de Publipostage+ | Ne plus l'enrichir ; le garder comme référence |
| Tuesday (`grist-wisget-tuesday`, `99b80e2` ; « Thusday » dans les anciens documents) | Née le 02/11 sur le kit 0.2.0 : `gfs.json` à la racine (valide), `.nojekyll`, GPL 3.0, tables `Tuesday_…`, la barre de GFS déjà lue par une gouttière. Ses liens vers les fichiers d'autres apps passent par `GfsLink.choose` et `GfsLink.openFile` du kit 0.3.0 (contrats 5.4, point 7, construits le 03/11) | Les consignes 001 à 005 (`consignes/tuesday/`) |
| Dashboard | N'existe pas | Naître sur le kit, avec `gfs.json`, une liste unique et la charte dès le premier commit |

---

## 4. Tests du contrat (dans chaque app)

- **Inconnu** : un fichier d'un type inconnu n'est ni ouvert, ni réenregistré, ni proposé par défaut ; un contenu qui porte
  un nœud d'une extension absente se réenregistre à l'identique.
- **Données** : aucune écriture d'une colonne absente (rejoué avec une table à qui il manque une colonne).
- **Réglages** : l'app n'écrit que les clés de son manifeste, et jamais sans un geste.
- **Stockage** : l'app démarre et marche quand `localStorage` lève une erreur.
- **Bibliothèques d'extension** : ni la liste ni l'import map de l'app ne nomment la bibliothèque d'une de ses extensions, et
  la CSP de sa page ne la nomme que par l'adresse du catalogue de GFS (garde de code, comme `codeHygiene`).
- **Contexte et messages** : aucune lecture de `document.referrer` hors de la fonction prévue, aucun `window.onmessage =`
  (gardes de code, comme le groupe `codeHygiene` de Publipostage+).
- **Aller-retour** : seule, puis GFS, puis seule, sans perte, dans un vrai Grist (dès que GFS v0 existe).

---

## 5. Texte du grisé (proposition)

Dans l'app seule, un clic sur une fonction grisée ouvre cette fenêtre (base commune des fenêtres, largeur 400) :

> **Cette fonction demande Grist Factory Suite**
>
> « {fonction} » fait partie de l'extension « {extension} », disponible quand {app} tourne dans Grist Factory Suite.
>
> Pour l'ajouter sans rien perdre : dans le panneau de droite de Grist, remplacez l'adresse du widget par celle de Grist
> Factory Suite : {adresse} (« Copier »). Ne passez pas par la galerie des widgets : elle effacerait les réglages de cette
> vue.
>
> Vos modèles et vos réglages restent tels quels, et vous pourrez revenir à l'adresse de {app} à tout moment.
>
> [Fermer]

> **This feature needs Grist Factory Suite**
>
> "{feature}" is part of the "{extension}" extension, available when {app} runs inside Grist Factory Suite.
>
> To add it without losing anything: in Grist's right panel, replace the widget's address with the Grist Factory Suite
> address: {address} ("Copy"). Do not use the widget gallery: it would erase this view's settings.
>
> Your templates and settings stay as they are, and you can switch back to the {app} address at any time.
>
> [Close]

Les mots exacts du panneau de Grist (nom du champ de l'adresse, en français et en anglais) sont à relever dans un vrai Grist
avant d'écrire le texte définitif.
