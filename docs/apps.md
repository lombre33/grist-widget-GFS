# Les apps : dépôts et dernier commit lu

Sert à se mettre à jour sur une app sans relire son dépôt (CLAUDE.md, « Les apps : consignes et état »). GFS ne pousse jamais
dans le dépôt d'une app : il lui parle par `consignes/`, elle lui répond par son `GFS-ETAT.md`.

## Apps de GFS

| App | Dépôt de développement | Consignes | Dernier commit lu | Lu le | Licence (21/10) |
|---|---|---|---|---|---|
| Publipostage+ | `lombre33/publipostageGrist` | `consignes/publipostage/` | `89890c8` | 21/10/2026 | GPL 3.0 |
| Form+ | `lombre33/FormPlus` | `consignes/form/` | `77ffd71` | 21/10/2026 | GPL 3.0 (`196734d`, consigne 004 faite) |
| Automation+ | `lombre33/GRIST_automation` | `consignes/automation/` | `4110eaf` | 21/10/2026 | GPL 3.0 (`LICENSE` ajouté à `e356021`, consigne 002 faite) |
| Grist-BI | `lombre33/Grist-BI` | `consignes/bi/` | `23647eb` | 21/10/2026 | GPL 3.0 |

## Lus pour référence (pas des apps de GFS)

| Dépôt | Pourquoi | Dernier commit lu | Lu le | Licence (21/10) |
|---|---|---|---|---|
| `lombre33/SlidesPlus` | référence des diapositives (cahier 1.2) | `747a700` | 20/10/2026 | GPL 3.0 |
| `lombre33/Grist-widget-audit` | outil d'audit (cahier 3.3) | `f5f251e` | 21/10/2026 | MIT, à passer en GPL 3.0 (décision du 21/10) |

« Dernier commit lu » est le sommet de `main` à la dernière lecture : le journal a été parcouru jusque-là, et le diff ouvert
seulement pour les commits qui touchent ce que GFS suit. Notes du 14/10 :

- Publipostage+ : lu jusqu'à `0880ba0` le 14/10 au soir (17 commits depuis `e4a239c`, et son `GFS-ETAT.md` au commit `b044cab`).
  Rien n'y change ce que GFS suit, hors la garde « type inconnu » (consigne 002, faite) : ni table, ni colonne, ni clé de
  réglages, ni table `_grist_*`, ni action, ni adresse de la CSP (la colonne `Nom` de `Publipostage_Versions`, écrite par
  « Nommer… », existait déjà). Le guide des apps et les repères de lignes de `faits-verifies.md` datent de `92ecd58`, les
  contrats de `e4a239c`, les consignes 003 à 005 de `89ebdd2` et la 007 de `9d0230f` : relire sur `origin/main` avant de s'y
  fier.
- Publipostage+ au 16/10 : trois commits de plus (`fc03813`, `9702c77`, `ef299c9`) ; son `GFS-ETAT.md` (commit `fc03813`)
  donne les consignes 001, 005, 007 et 008 pour faites. Le graphique est l'extension `graphique` (`extensions/graphique/`),
  Plotly n'est plus dans sa liste, et `js/gfs-link.js` parle à GFS (contrat 0). Mesuré dans le labo, avec GFS à `4403f41` :
  Plotly 2.13.2 arrive de GFS en CDN comme en copie de GFS, se charge sous la CSP de l'app avec son empreinte et dessine ;
  la ligne grisée ouvre la fenêtre « Apps et extensions », cocher Graphique la dégrise, le décocher la regrise. Le chargeur
  de scripts de l'app (`ExportCommon.scriptRefusal`) n'accepte qu'un des deux CDN de sa liste, avec empreinte, ou un fichier
  de la même origine que sa page : la copie de GFS passe parce que GFS et l'app sont servis par le même site ; servie
  d'ailleurs (un client qui héberge GFS à part), ce chargeur la refuserait (lu dans son code, non mesuré).
- Publipostage+ plus tard le 16/10 : lu jusqu'à `9d9c6da` (neuf commits depuis `ef299c9`) ; son `GFS-ETAT.md` (commit
  `ebf1785`) donne la 009 pour faite : `js/gfs-link.js` garde `adresseWidget` du contexte et `ownWidgetUrl()` en part, seul
  ou sans réponse de GFS rien ne change. Le reste (numérotation « Article », sommaire, menu « Édition collaborative »,
  tests, journal) ne touche ni table, ni colonne, ni clé de réglages, ni action, ni bibliothèque, ni adresse de la CSP
  (dans `index.html`, des numéros de version et deux menus). « Demandes à GFS » : aucune. Un commentaire de la barre d'outils
  dit que « l'écriture en direct y prendra sa ligne avec l'extension de GFS » : la demande n'est pas encore écrite.
- Publipostage+ à `47fae07` (16/10, matin) : son `GFS-ETAT.md` (commit `1894442`) porte la demande de l'écriture en direct, six
  bibliothèques (`yjs`, `y-protocols`, `lib0`, `@tiptap/y-tiptap` et les deux extensions de collaboration de TipTap) et deux
  questions : un fichier par bibliothèque ou un seul paquet, et le canal (la table de l'app, ou mieux). `47fae07` ne touche que
  ses tests. Réponse : la consigne 012 (un seul fichier assemblé par GFS, la table reste le tuyau, relue toutes les 250 ms).
  Rien n'est porté avant le « demande de Publipostage+ » qui suivra son code et son essai assemblé.
- Publipostage+ à `bfed600` (19/10) : onze commits de plus depuis `47fae07`, tous du 16/10. Son `GFS-ETAT.md` (commit `bfed600`, qui décrit
  `abfb600`) donne les consignes 010, 011 et 012 pour faites : `ouverture` du contexte et appel `ouvrir` (`js/gfs-link.js`,
  `js/gfs-open.js`) ; l'impression par la page de l'app et les liens `mailto:` / `tel:` dans un nouvel onglet ; l'écriture en direct
  en extension `edition` (`extensions/edition/`, `js/live-entry.js`), qui exige `edition-live` 1.0.0 et crée la table du document
  `Publipostage_Direct`, sous le préfixe de l'app. Rien d'autre ne touche ce que GFS suit : pas de clé de réglages, de table
  `_grist_*`, d'adresse de la CSP ni de carte d'importation de plus (`index.html` change ses numéros de version et ses lignes de
  menu) ; l'export HTML (`bf1cf14`) et la liste « # » (`8a539a8`) ne touchent pas GFS. « Demandes à GFS » : l'écriture en direct, traitée le 19/10
  (liste de GFS, manifeste, référence de l'app avancée à `abfb600`, consigne 013). « Questions pour GFS » : cinq, dont trois
  reçoivent leur réponse dans la 013 (le labo garde `integrity` pour un script de GFS ; une section ajoutée recharge le cadre : c'est
  Grist ; le réseau réel attend le porteur) ; « Nouveau » a sa réponse dans la 014 (posée le même jour) ; le titre de l'impression
  reste ouvert.
- Publipostage+ à `5e14faa` (19/10, matin) : deux commits de plus depuis `bfed600`, qui ne lisent encore que les consignes jusqu'à la 012 (GFS lu à
  `cf8c4d5`). `da919fc` : le type `presentation` (« Présentation », `js/slides-entry.js`) et l'extension `diapositives` (une entrée du registre de
  `js/extensions.js`), sans bibliothèque et sans fichier à elle (`extensions/diapositives/` n'existe pas encore). Une présentation est le HTML de l'éditeur
  dans `Publipostage_Modeles` (`TypeModele` « presentation »), sa page 16:9 en paysage est dans `Margins` ; ni table, ni colonne, ni clé de réglages, ni
  table `_grist_*`, ni adresse de la CSP, ni carte d'importation de plus (`index.html` : des numéros de version, `js/slides-entry.js` de la même origine et
  la ligne « Nouvelle présentation » du menu « + »). `5e14faa` : son `GFS-ETAT.md` porte la demande « présentations » (déclarer l'extension et le type,
  `actions.ouvrir`, référence à `da919fc`), traitée le 19/10 (manifeste, référence, consigne 015), et une question sur le dossier de l'extension, répondue
  dans la 015 ; la question « Nouveau » d'une présentation est celle de la 014 (le point 4 de la 015 lit le `type` de la 014 parmi cinq).
- CDN de l'écriture en direct (19/10, choix du porteur : jsDelivr) : GFS sert `edition-live` aussi par jsDelivr, depuis son dépôt public, à un commit
  complet (`gfs.publication` de la liste, `--catalogue` écrit l'adresse). La CSP de Publipostage+ doit nommer cette adresse exacte (consigne 016) :
  tant qu'elle ne le fait pas, le mode « Depuis un CDN » (le défaut) est refusé par son navigateur et l'app dit « Écriture en direct impossible » ;
  « Copie de GFS » marche (mesuré, `run-edition`). Le chiffre du réseau réel et `--verifier-cdn` restent à lancer par le porteur.
- Publipostage+ à `8b7b5ab` (19/10, après-midi) : neuf commits de plus depuis `5e14faa`. Son `GFS-ETAT.md` (commit `4035ff0`,
  qui décrit `71287c4`) dit les consignes 013, 014 (`bfbe112`) et 015 faites (la 016 n'y est pas encore), et porte la demande
  de ce lot (les poids des deux extensions, la référence à `71287c4`) avec quatre questions. `bfbe112` : « Nouveau » ouvre un
  modèle vierge du type, pour les cinq types, au démarrage comme app déjà ouverte. `05c5d46` : la bande des diapositives
  (`extensions/diapositives/slide-strip.js` et `.css`, 36 045 octets, chargés quand une présentation est à l'écran).
  `71287c4` : l'entrée automatique dans le direct (`js/live-entry.js` : hors salon, une lecture de `Publipostage_Direct`
  toutes les 3 s, `listTables` puis `fetchTable` par le courtier, sous le préfixe de l'app). `8cc0daa` (sommaire cliquable),
  `27a71df` (logo des en-têtes et pieds, puces dans Word) et `8b7b5ab` (signets, plus récent que la référence) ne lisent ni
  n'écrivent rien de nouveau chez GFS : ni CSP, ni carte d'importation, ni liste de l'app, ni table, ni colonne, ni clé de
  réglages. Traité le 19/10 : les poids, la référence à `71287c4`, « Nouveau » activé, l'ouverture rendue une seule fois (sa
  question), la lecture de fond (sa réponse), consigne 017. Restent ouverts : le titre de l'impression (011) et le chiffre du
  réseau réel (le porteur).
- Publipostage+ à `1bd277f` (20/10, matin) : cinq commits de plus depuis `8b7b5ab`. Son `GFS-ETAT.md` (`ca943d7`, qui décrit
  `4829cf5`) dit la 016 « lue, pas faite » : le porteur a choisi le 20/10 d'attendre l'adresse du dépôt public définitif,
  parce que celle de la 016 passe par le dépôt de développement et porte son compte personnel, que le contrôle d'envoi de
  l'app au dépôt public refuse dans un fichier publié (`index.html` en est un). Sa CSP, sa garde de code et son essai restent
  comme à la 007 : le défaut « Depuis un CDN » y est refusé, « Copie de GFS » marche (mesuré le 19/10, `run-edition`). L'état
  n'a pas encore lu la 017 (il lit GFS à `3760817`) : sa demande et ses quatre premières questions y sont encore posées.
  Nouvelle question : quand l'adresse sera-t-elle celle du dépôt public définitif (cahier, question 5) ? Nouvelle demande :
  avancer la référence de l'app de `71287c4` à `4829cf5` (le PDF d'une présentation ne demande plus « Exporter quand même ? »
  pour une diapositive vide ; rien d'autre pour GFS). Les deux commits suivants (`e218fd9`, `1bd277f`, le menu Image des
  variables avec une colonne Pièces jointes) n'ajoutent aucun appel à Grist, ni CSP, ni carte d'importation, ni liste de
  l'app. Rien n'est traité : la demande attend le mot du porteur.
- Publipostage+ à `69a3dc9` (20/10, midi) : neuf commits de plus depuis `1bd277f`. Son `GFS-ETAT.md` (`69a3dc9`, qui décrit
  `dc00b9d`) dit la 017 « faite · lue, aucun code » (la 016 reste « lue, pas faite »), retire sa demande du 19/10 et trois de
  ses questions, et pose une demande de référence (`dc00b9d`), une demande de langue et une question sur le stockage.
  `dc00b9d` : après un rechargement que l'app déclenche elle-même (langue, caractère de déclenchement), elle rouvre le modèle
  où la personne était, par le fragment de l'adresse de son cadre (`js/settings.js`, `js/main.js`), et attend le contexte de
  GFS avant de choisir le modèle de départ. Les autres commits (en-têtes et pieds, signets, PDF des présentations, menu
  Image) ne lisent ni n'écrivent rien de nouveau chez GFS ; les poids des extensions sont inchangés (74 389 et 36 045
  octets). La demande de langue : le porteur veut un seul choix, gardé par GFS par personne, commun à toutes les apps et
  annoncé aux apps ouvertes par un événement ; elle change ce que disent le cahier (5.7) et le contrat (5.3, point 4), donc
  elle attend son choix (carte du 20/10), rien n'est codé. Le porteur ayant signalé le message de l'app, traité le 20/10 :
  la référence avancée à `dc00b9d` (commit à part, relu), la réouverture mesurée dans un vrai Grist (contrats 5.2, point 3),
  la consigne 018 (qui répond aussi à la question du stockage). Restent ouverts : la langue (le porteur), le titre de
  l'impression (011), le chiffre du réseau réel, l'adresse définitive du CDN (016).
- Langue commune (20/10, après le choix du porteur, « Réglage dans GFS ») : faite dans GFS et mesurée avec une sonde
  (contrats 5.2, point 6 ; `run-langue.mjs`, 37 vérifications par combinaison). Publipostage+ à `dc00b9d` ne lisait pas
  encore `contexte.langue` et n'écoutait pas l'événement `langue` : la consigne 019 le lui a demandé, l'app l'a fait à
  `f6d3fd0` (deux lignes plus bas). La référence de GFS est à `f6d3fd0` depuis le 20/10 (15 h 40) : la mesure avec l'app
  elle-même est au contrat 5.2, point 6 (`run-langue-publipostage.mjs`).
- Publipostage+ change de langue en rechargeant la page (`53d36de` : plus de retraduction à chaud, `I18n.onChange` n'existe
  plus), ce qui va avec le contrat (5.2, points 2 et 6 : l'événement `langue`, que l'app suit en se rechargeant). Son
  `initialLang()` ne lisait que `localStorage` (clé `pp_lang`) puis les langues du navigateur, pas `contexte.langue` : la
  consigne 019 le lui a demandé (20/10), sans attendre l'étape 5 ; fait à `f6d3fd0`, où `initialLang()` prend d'abord la
  langue de GFS.
- Publipostage+ à `d87ea5f` (20/10, après-midi) : quatre commits de plus depuis `69a3dc9`, dont trois de code. Son
  `GFS-ETAT.md` (`d87ea5f`, qui décrit `f6d3fd0` ; GFS lu à `a90f4a2`) dit la 018 « faite · lue, aucun code » et la 019
  « faite · `f6d3fd0` » ; la 016 reste « lue, pas faite » (l'adresse du dépôt public définitif). `f6d3fd0` : hébergée, l'app
  prend la langue de GFS au départ (le paramètre `language` de l'adresse de son cadre, seulement avec `gfs=<n>`, ou le
  fragment `#pp-open=<id>&pp-lang=fr|en` qu'elle se laisse en se rechargeant), garde `langue` du contexte et écoute
  l'événement `langue` (`js/gfs-link.js` : `language()` et `onLanguage`), le suit comme son propre changement de langue
  (`js/settings.js`, `followGfsLanguage` : la question Enregistrer / Abandonner / Annuler d'abord, puis le rechargement qui
  rouvre le modèle), rattrape à la fin du démarrage une langue changée pendant un rechargement, et grise les deux cases de
  langue de Réglages avec la phrase de la 019 (jamais masquées). Elle ne lit ni n'écrit la langue dans le stockage du
  navigateur ; aucune clé, table, adresse, CSP, carte d'importation ni liste de paquets de plus (`index.html` : des numéros
  de version et la phrase du grisé, cachée seule). Les deux autres commits de code (`6e7c5f9`, `c9e0532` : en-tête et pied,
  « Sommaire » et « Saut de page » grisés dans une zone, le trait d'une zone fermée) ne lisent ni n'écrivent rien chez GFS.
  « Questions pour GFS » : deux, le titre de l'impression (à mesurer dans un vrai Chrome) et l'adresse du CDN (016).
  « Demandes à GFS » : la référence de l'app à `f6d3fd0`. Traitée le 20/10 (15 h 40), après le « oui » du porteur, qui a
  aussi dit de se tenir à jour sur les apps et de monter les versions au fur et à mesure (plus besoin de son mot pour une
  référence) : la référence avancée (`aaeb800`, commit à part, relu), l'app mesurée dans un vrai Grist (contrats 5.2, point 6 ;
  `run-langue-publipostage.mjs`, 25 vérifications par combinaison ; ouverture 28, présentations 29, écriture en direct 60), la
  consigne 020. Constat de l'essai : la question de l'app est posée derrière l'explorateur ouvert, et « Abandonner » peut n'avoir
  rien à abandonner quand une écriture de l'enregistrement automatique finit pendant la question (dit à l'app, sans rien lui
  demander).
- Publipostage+ à `b9ba041` (21/10, matin) : quatorze commits de plus depuis `d87ea5f`, dont douze de code. Son
  `GFS-ETAT.md` (`c4aa76f`, qui décrit `80deef7` ; GFS lu à `8110d87`) dit la 020 « faite · lue, aucun code » et rapporte le
  correctif de « Abandonner » (`80deef7`, constat 2 de la 020 : la question attend d'abord le passage d'enregistrement
  automatique déjà parti, 8 secondes au plus). La 016 reste « lue, pas faite » ; « Questions pour GFS » : le titre
  d'impression (le porteur le mesure lui-même) et l'adresse du CDN (016) ; « Demandes à GFS » : aucune. Les onze commits de
  code après cet état (`a851780` à `b9ba041` : nom du modèle, bulles orange des variables, Boucle sur « toutes les lignes de
  la table », format de date, « Répéter la ligne », règles de condition) ne sont pas encore décrits par lui ; un seul ajoute
  un échange avec Grist, l'écoute du message `dataChange` (`js/batch-scope.js`, `ab428ba`), que GFS relaie déjà
  (`session.js`). Ni table, ni colonne, ni clé de réglages, ni adresse de la CSP, ni extension changée. Traité le 21/10 : la
  référence avancée à `80deef7` (commit à part, relu), la consigne 021 (réponse sur la 016) ; l'avance des onze autres
  commits attend que l'app les décrive.
- Dépôts publics (organisation `grist-factory`, cahier 4.2 et question 5) : Publipostage+ est à
  `grist-factory/Publipostage-Plus` (bêta 1.0.0-beta.1 du 05/10 ; le porteur l'a redit le 21/10) ; aucun autre dépôt public
  d'app n'est noté, et rien n'est poussé sur l'organisation depuis le cloud. Le 21/10, le porteur garde les dépôts de
  `lombre33` tant que le code de GFS y est : références des apps dans GFS et adresse du CDN de la 016 ne changent pas ; à la
  bascule de GFS sous `grist-factory`, GFS adapte ses liens et chaque app reçoit les adresses nouvelles par une consigne,
  sans date (consigne 021).
- SlidesPlus : suivre `main`. La branche par défaut du dépôt sur GitHub est une autre, donc `origin/HEAD` ne convient pas.
- Grist-widget-audit : aucun commit n'avait été noté ; `3a1b3d5` était le sommet de `main` (4 octobre). Lu le 20/10 : un
  commit de plus (`cc82061`, 15/10) : un appel à l'API Grist officielle ne coûte plus de points à la règle réseau ; rien à
  changer chez GFS.
- Form+, Automation+, Grist-BI, SlidesPlus (20/10) : relus par le sommet de `main`. Automation+ (`ee8f0a9`), Grist-BI
  (`c8c819f`) et SlidesPlus (`747a700`) n'ont pas bougé depuis le 14/10. Form+ : cinq commits de plus, tous du 14/10
  (`d3c8475`), des études et procédures de test d'une synchro entre deux documents Grist et un correctif de l'envoi de
  pièces jointes par un répondant anonyme (`poc/js/respond.js`, l'en-tête `X-Requested-With`, sur la page des répondants et
  non dans le widget) : ni table, ni colonne, ni clé de réglages, ni adresse de la CSP, ni appel de plus chez GFS. Pas
  encore de `GFS-ETAT.md` chez Form+ : rien à traiter.
- Form+ à `c1237a2` (21/10, le porteur demande de lui donner de quoi démarrer la liaison) : un commit de plus depuis
  `d3c8475`, de nouveaux types de question (Date et heure, Liste de références, Échelle, Classement, Signature / dessin,
  l'option « Autre », la capture photo). Chez GFS : une colonne cachée de plus dans la table du formulaire pour une « Liste
  de références » (`FormPlus_srcL_…`, `ensureRefListField`, `poc/js/grist-meta.js`), comme `FormPlus_src_…` pour un choix,
  avec la même écriture de `visibleCol` (`_grist_Tables_column`) et un champ caché (`_grist_Views_section_field`) ; ni
  table, ni clé de réglages, ni adresse de la CSP de plus. Toujours pas de `GFS-ETAT.md` chez Form+ : la 001 attend depuis
  le 14/10. Le relevé du guide (14/10) omettait l'écriture de `visibleCol`, déjà là à `b073d03` (`poc/js/grist-meta.js`,
  ligne 132) : le guide est complété le 21/10. Traité le 21/10 : la consigne 002 (lire, faire, ce qui vient ; elle annonce
  le kit sans le décrire, la consigne du kit étant celle de l'étape 3), et `docs/gfs-en-bref.md` remis à jour.
- Form+ à `2c0ee50` (21/10, après la 002) : neuf commits de plus depuis `c1237a2`, dont le saut d'étape conditionnel et la
  carte interactive grisée par défaut (`96cf415`), des études (comparatif, checklist du catalogue gristgouv), des correctifs
  d'accessibilité et des captures. Son `GFS-ETAT.md` (créé à `2c0ee50`, qui décrit `8a0bf20`) dit la 001 faite avec ses
  écarts (règles 2, 5 et 11) et la 002 lue, relève la colonne cachée `FormPlus_srcL_…` (`96cf415`), pose deux questions
  (garder le chargement autonome de Leaflet ; déclarer les écritures `_grist_Views_section_field` et `shareOptions` avant
  l'étape 5) et une demande : Leaflet 1.9.4 pour le type « Lieu sur carte » (un script, une feuille de style et des images,
  des tuiles OpenStreetMap, un repli en champ texte). Lu dans le code : `window.FORMPLUS_ENABLE_MAP` et deux adresses unpkg
  dans `poc/js/kinds.js`, chargement à la demande dans `poc/js/respond.js`, aucune CSP, ni écriture dans `_grist_*` de plus.
  Le guide est corrigé une seconde fois (écritures dans `poc/js/grist-meta.js`, quatre lectures de `document.referrer`,
  `options` de `_grist_Views_section` qui ne se déclare jamais, `CreateViewSection`). Traité le 21/10 : la consigne 003
  (réponses : garder la carte autonome, les écritures à l'étape 5) et la 004 (licence). La demande Leaflet n'est pas traitée :
  le catalogue ne porte qu'un fichier par bibliothèque et l'adresse des tuiles entrerait dans une CSP, deux choix du
  porteur (question posée le 21/10).
- Publipostage+ à `64937df` (21/10) : huit commits de plus depuis `b9ba041`, dont trois corrigent l'app (`4ae8eeb`,
  `62db523`, `e1f5d2b`), les autres sont ses essais, son audit et sa page d'état. Son `GFS-ETAT.md` (`64937df`, qui décrit
  `e1f5d2b` ; GFS lu à `21e5d20`) dit la 021 « faite · lue » (la 016 attend la bascule), rapporte l'écoute de `dataChange`
  de la Boucle et les sauts de page d'une présentation qui ne se voient plus dans l'éditeur ; « Demandes à GFS » : aucune ;
  « Questions pour GFS » : le titre d'impression. Lus : les commits de code de `a851780` à `e1f5d2b` ne lisent ni n'écrivent
  rien de nouveau chez GFS (ni table, colonne, clé de réglages, `_grist_*`, adresse de la CSP, carte d'importation ni liste
  de bibliothèques) ; `js/extensions.js` monte la version de l'extension de Diapositives de 0.2 à 0.3 et son dossier passe
  de 36 045 à 36 571 octets (trois lignes de `slide-strip.css`) ; le catalogue de la galerie de développement s'appelle
  `catalogue.json` (l'audit externe de l'app le lisait comme le manifeste d'un widget Grist). Traité le 21/10 : la référence
  avancée à `e1f5d2b` (commit à part, relu ; dix essais dans un vrai Grist, sans échec) et le poids de Diapositives (37 Ko) ;
  pas de consigne, l'app n'avait rien demandé.
- Publipostage+ à `8f2fde6` (21/10, midi) : dix-huit commits de plus depuis `64937df`, tous du 21/10. Son `GFS-ETAT.md`
  (`8f2fde6`, qui décrit `cef298e` ; GFS lu à `21e5d20`) ajoute trois lignes à « Changements qui touchent GFS » (`da1a4c3`,
  `e816ae5`, `cef298e`) ; « Demandes à GFS » : aucune ; « Questions pour GFS » : le titre d'impression, toujours ouverte (le
  porteur la mesure lui-même). Lus : de `e1f5d2b` à `cef298e`, trente-sept fichiers changent et rien de ce que GFS suit ne
  bouge (ni table, colonne, clé de réglages, `_grist_*`, adresse de la CSP, carte d'importation, liste de bibliothèques, ni
  appel à GFS de plus) ; les corrections (`448812b`, `e438124`, `6975658`, `c5efc16`, `a60d9f3`, `22dc1a8`, `f761b7d`)
  touchent l'éditeur, l'Excel, le PDF et le texte des interfaces. Pour les diapositives : `js/extensions.js` monte
  `diapositives` de 0.3 à 0.6 ; `slide-strip.js` passe de 29 220 à 54 487 octets et le CSS reste à 7 351, soit 61 838 octets
  (l'indication `poids` vaut 62 au lieu de 37) ; une présentation chargée reste légère (`da1a4c3`, un `IntersectionObserver`
  sur la liste des miniatures), une image en calque suit sa diapositive (`e816ae5`), et une diapositive se copie et se colle
  (`cef298e`, Ctrl+C et Ctrl+V) par les événements `copy` et `paste` du navigateur, sans l'API Clipboard ; éteinte, Ctrl+C
  et Ctrl+V sur une miniature appellent `installer`. Pas lus : `32822d6` (le bouton « Comme dans Grist » des variables) et
  son essai `6262b36`, que la page ne décrit pas encore (la référence ira jusque-là quand elle les décrira) ; `74dffd7` et
  `8f2fde6` ne changent que des documents. Traité le 21/10 : la référence avancée à `cef298e` (commit à part, relu ; sept
  essais dans un vrai Grist, sans échec) ; le copier-coller des diapositives, que l'app n'avait pas essayé dans le cadre
  isolé de GFS, y marche (Ctrl+C sur une miniature, Ctrl+V sur une autre, un seul Ctrl+Z, un mot du texte copié comme
  toujours, extension éteinte : `installer`) ; le poids de Diapositives à 62 Ko ; la consigne 022 le dit à l'app (la
  référence, le copier-coller mesuré, ce qui reste ouvert).
- Automation+ à `f5e4100` (21/10) : sept commits de plus depuis `ee8f0a9`, tous du 21/10 (versions 0.6.0 à 0.8.0). Chez GFS :
  le graphe est aussi gardé dans une table du document, créée avec l'accord de la personne (`js/store.js`) ; d'abord des
  tables `Automation_*` (`7dae9e3`), puis une seule, `Automation` (`5a166f4`), qui porte les workflows, le journal et un
  verrou d'exécution entre onglets (`064edcf`, relais après 20 s) ; elle n'a pas le « _ » final du préfixe (contrats 2.3) ;
  une colonne à formule `Auteur` (`user.Email`). Le graphe reste aussi dans les réglages de la vue
  (`grist.setOption('workflow', …)`). Une CSP existe (`'unsafe-eval'` à cause du script de Grist, dit `SECURITY.md`) ; ni
  bibliothèque, ni écriture dans `_grist_*`. Toujours pas de `GFS-ETAT.md` : la 001 attend. La référence de GFS reste à
  `ee8f0a9` (le manifeste d'Automation+ décrit les réglages `workflow`). Traité le 21/10 : la ligne du guide mise à jour, la
  consigne 002 (licence).
- Automation+ à `78d3619` (21/10, midi) : cinq commits de plus depuis `f5e4100`, dont trois de code (versions 0.9.0 à 0.11.0 :
  mise à jour d'une ligne repérée par une clé dans une autre table ; nœud Lecture, valeurs `{Colonne}` dans les conditions
  et déclencheur sur une ligne précise ; test à blanc sur la ligne sélectionnée, historique par pages, activation et
  désactivation tracées). Son premier `GFS-ETAT.md` (`78d3619`, qui décrit `9b19567`) passe la 001 et la 002 à « faite »
  (`e356021`) ; « Questions pour GFS » et « Demandes à GFS » : aucune. 001 : écarts aux règles 2, 3, 4 et 12 (le détail est
  dans la ligne du guide) ; la ligne du guide est juste, sauf « premier client du kit » (c'est Form+, cahier 4.5) ; `Auteur`
  est une formule déclenchée, avec repli sans formule. 002 : `LICENSE` relu sur `e356021`, 674 lignes, SHA-256 `3972dc97…`,
  mêmes octets que celui de GFS. Lus : les trois commits de code n'ajoutent ni table, ni colonne, ni clé de réglages, ni
  `_grist_*`, ni bibliothèque, ni adresse ; seuls faits nouveaux chez GFS : la lecture de la ligne sélectionnée
  (`grist.onRecord` avec `includeColumns: 'all'`, pour « Tester » ; niveau `full`, contrats 4.3) et deux valeurs de plus
  dans `Evenement` (`activate`, `deactivate`) ; le journal se relit par pages (`logsPage`, même table). Pas de `gfs.json`
  encore. Traité le 21/10 : l'`INDEX.md` (001 et 002 « faites »), la ligne du guide corrigée, la page « GFS en bref » et la
  référence avancée à `78d3619` (commit à part ; le code est celui de `9b19567`, les deux derniers commits ne portent que la
  page d'état et la licence ; essai dans un vrai Grist, sans refus du courtier ni erreur) ; pas de consigne, l'app n'avait
  rien demandé.
- Grist-BI à `70d8374` (21/10) : treize commits de plus depuis `c8c819f`, six demandes de tirage fusionnées (agrégations
  DuckDB-WASM au-delà d'un seuil de lignes, modale de détail par tuile, clés de jointure suggérées, export Excel des valeurs
  de tuile en mode mesure, auteur des commentaires reconnu, drill-down catégoriel). Chez GFS : une table-sonde
  `BI_Dashboard_UserProbe` (une colonne à formule `user.Email`, `js/grist-api.js`) créée au démarrage sans demander à la
  personne (règle 4 ; la formule demandera la capacité `formules`) ; lit `_grist_Tables` et `_grist_Tables_column` ; ni CSP,
  ni bibliothèque de plus. Toujours pas de `GFS-ETAT.md`. Traité le 21/10 : la ligne du guide mise à jour.
- Publipostage+ à `5c8800c` (21/10, après-midi) : vingt commits de plus depuis `8f2fde6`. Son `GFS-ETAT.md` (`a8e161d`, qui
  décrit `7a723ce` ; GFS lu à `eee2d5a`) dit la 022 « faite · lue, aucun code », garde la question du titre d'impression (le
  porteur la mesure lui-même) et pose quatre demandes : la référence à `7a723ce`, la lecture de `_grist_DocInfo`, le plein écran
  du sous-cadre pour « Présenter », les choix de chaque personne retenus par GFS (stockage, contrats 5.3). Lus : de `cef298e` à
  `7a723ce`, 95 fichiers ; seul fait nouveau chez GFS, `_grist_DocInfo` lue par `js/grist-api.js` (`32822d6`, le bouton « Comme
  dans Grist ») ; ni table, colonne, clé de réglages, adresse de la CSP, carte d'importation ni liste de bibliothèques de plus
  (un lien vers le journal des changements dans la fenêtre des nouveautés) ; `diapositives` passe de 0.6 à 0.10 (importer une
  diapositive, glisser une miniature, cinq mises en page, « Présenter » : quatre fichiers neufs, 131 349 octets) ; `pp_news_seen`
  n'est pas encore dans le code (clé annoncée pour la demande de stockage). Pas décrits par la page : `6ca67c6` (choisir
  plusieurs diapositives), `a2a27a6` (la présentation commerciale de la galerie), `5c8800c` (journal) : la référence s'arrête à
  `7a723ce`. Traité le 21/10 : la référence avancée à `7a723ce` (`fc722c5`, commit à part, relu ; langue 2 x 25, ouverture 2 x 28,
  présentations 2 x 50 sur 51, direct 60) ; `_grist_DocInfo` déclarée (`0bbced7`, huitième lecture) ; le poids de Diapositives à
  131 Ko ; le plein écran mesuré (`fullscreen` dans `allow` du seul sous-cadre ne change rien : il faut aussi le cadre que Grist
  donne à GFS, qui n'a que `clipboard-write`, donc rien n'est ajouté) ; la consigne 023. Constat de l'essai : les boutons
  « Fichiers » et « Apps » de GFS recouvrent le ▶ « Présenter » et la pastille du zoom à 700 × 400 (le ▶ ne se clique pas à la
  souris, Maj+F5 marche). Deux questions posées au porteur (cartes du 21/10) : le stockage de chaque personne, et le coin bas
  droit du panneau ; rien n'est codé avant ses réponses. Restent ouverts : le titre d'impression (011), l'adresse du CDN (016).
- Form+ à `a5d2207` (21/10, après-midi) : dix commits de plus depuis `2c0ee50`. Son `GFS-ETAT.md` (`80c1636`, qui décrit
  `952fe4c`) dit la 002 et la 003 « lues », la 004 faite (`196734d`) et la 005 faite (`90958ac` à `952fe4c` : kit en sous-module
  à `54c48f3`, jetons et fenêtres du kit, thème par `Theme`, traduction française et anglaise par `I18n`, `Dialogs` à la place de
  `prompt` et `confirm`) ; une question (le dépôt du kit n'a pas d'étiquette `v0.1.0`) ; une demande (Leaflet, en attente du
  porteur). Lu : sous-module au bon commit en commit à part, CI avec `submodules: true`, plus de `prompt`, `confirm` ni `alert`
  hors des essais ; restes de couleur en dur : deux ombres `rgba` (`poc/css/widget.css`, lignes 80 et 229) et `#qrCanvas`. Mesuré
  par GFS : ses 542 essais passent en `fr-FR` et en `en-US` ; le widget posé tel quel dans un vrai Grist (700 × 400, à la vraie
  souris, fr/clair, fr/sombre, en/clair, en/sombre) : 25 vérifications par combinaison, aucun échec. Pas décrits : `a5d2207`
  (création automatique d'une colonne, `AddColumn`, `poc/js/grist-meta.js`) et `adba2b4` (le comparatif). Traité le 21/10 :
  l'`INDEX.md` (003 lue, 004 et 005 faites), la consigne 006 (l'étiquette : la 005 avait tort, la référence est le commit
  `54c48f3` ; Leaflet décidé le 21/10 et porté avec Form+ ; les deux ombres), le cahier et « GFS en bref » (étape 3 livrée).
  Form+ n'est toujours pas référencé dans GFS (pas de manifeste).
- Automation+ à `4110eaf` (21/10, après-midi) : deux commits de plus depuis `78d3619`. Son `GFS-ETAT.md` (`4110eaf`, qui décrit
  `6eb0165`, version 0.11.1) dit la 001 corrigée pour les règles 3, 4 et 12 (sauf le logo) : un graphe illisible n'est plus
  réécrit (« Workflow conservé tel quel »), l'identifiant réel est relu après `AddTable`, plus aucune écriture dans une colonne
  absente, jetons `--z-*` et plus de vert hors palette ; restent la règle 2 (le graphe aussi dans les réglages de la vue, clé
  `workflow` ; table `Automation` sans le « _ » final du préfixe) et le logo. Questions et demandes : aucune. Lu : 23 fichiers ;
  deux lectures de plus (`listTables` avant et après `AddTable`, `Automation` au démarrage), rien d'autre ne change pour GFS.
  Traité le 21/10 : la référence avancée à `4110eaf` (`b60eaa7`, commit à part, relu ; 3 vérifications en fr/clair et en
  en/sombre, sans refus) et la ligne du guide ; pas de consigne, l'app n'avait rien demandé. Le nom de la table (`Automation`
  contre le préfixe `Automation_`) se règle avant l'étape 5.
- Grist-BI à `23647eb` (21/10) : huit commits de plus depuis `70d8374`, trois demandes de tirage fusionnées : les tuiles
  Waterfall et Radar, la table de test de charge `BI_StressTest` retirée (l'app se connecte d'elle-même à la première table
  existante, `js/grist-api.js`), trois défauts de l'audit UX/UI corrigés. Chez GFS : ni table de plus, ni `_grist_*` de plus (toujours
  `_grist_Tables` et `_grist_Tables_column`), ni adresse ni bibliothèque ; la table `BI_Dashboard_UserProbe` est toujours créée
  sans demander (règle 4). Toujours pas de `GFS-ETAT.md`. Traité le 21/10 : la ligne du guide.
- Grist-widget-audit à `f5f251e` (21/10) : neuf commits de plus depuis `cc82061`, tous des règles de l'audit (code minifié exempté
  des axes A et B et plafonnant la note, exemption de l'API Grist du réseau, lecture de l'objet `grist` par l'AST,
  `--sans-reseau`), lus par leurs titres seulement : rien à changer chez GFS. Toujours sous MIT à ce commit.
- Publipostage+ à `2ed567c` (21/10, soir) : trois commits de plus depuis `5c8800c`. Son `GFS-ETAT.md` (`2ed567c`, qui décrit
  `fcca7b4` ; GFS lu à `6068ce1`) dit la 023 « faite · lue, aucun code », garde la question du titre d'impression (le porteur la
  mesure lui-même) et pose deux demandes : les choix de chaque personne retenus par GFS (onze clés `pp_*`, une dizaine de ko ; le
  porteur a choisi GFS le 21/10) et la barre de GFS avec la place libre de l'app (la barre la plus étroite possible, au bord que
  la personne choisit ; un champ `barre` du contexte et un événement ; un appel `barre.masquer` pour le diaporama). Lus : de
  `7a723ce` à `fcca7b4`, 53 fichiers ; la CSP d'`index.html` (seuls des `?v=` changent), la carte d'importation, la liste de
  bibliothèques et `js/gfs-link.js` ne changent pas ; ni table, colonne, clé de réglages, table `_grist_*` ou adresse de plus ;
  `diapositives` passe de 0.10 à 0.11 (choisir plusieurs diapositives, `6ca67c6` : 140 508 octets) ; la galerie gagne un 22e
  modèle (`a2a27a6`, sans adresse) ; « 11:30pm » dans la liste « Heure » (`fcca7b4`). Aucun code de l'app n'appelle encore
  `contexte.stockage` ni `stockage.ecrire`. Traité le 21/10 : la référence avancée à `fcca7b4` (`c4b3026`, commit à part, relu ;
  langue 2 x 25, ouverture 2 x 28, présentations 2 x 50 sur 51, direct 60) ; le poids de Diapositives à 141 Ko et celui du
  Graphique à 64 Ko, avec un essai qui les compare au dossier de l'app (`6bcecc1`) ; le stockage de chaque personne livré
  (`14cfd19`, contrats 5.3, mesuré dans un vrai Grist) ; la consigne 024 (le stockage, la référence, la barre). La barre : le
  porteur a tranché le 21/10 (bord au choix de la personne, apps adaptées aux quatre places, sans bande en plus, par-dessus
  l'espace laissé libre) ; la forme de l'échange est dans la consigne 025 (posée le 21/10, soir ; contrats 5.2, point 7 ;
  mesurée dans un vrai Grist, 2 x 82 vérifications, et avec l'app à `fcca7b4` : le ▶ se clique, et en haut la barre recouvre trois
  boutons de sa barre d'outils). Restent ouverts : le titre d'impression (011), l'adresse du CDN (016).
- Form+ à `77ffd71` (21/10, soir) : quatorze commits de plus depuis `a5d2207`. Son `GFS-ETAT.md` (`84f429d`, qui décrit
  `39e0740`) dit la 006 faite (les deux ombres du kit remplacées par `--shadow-card` et `--shadow-float`), aucune question, une
  demande (Leaflet, en attente de l'entrée de Form+ dans GFS). Pas décrits par la page : un type de question « Créneau
  horaire » (`cbf3d10`, une colonne `Choice`), la synthèse des réponses, le contrôle du type d'une colonne avant d'y écrire
  (`514341f`), la correction du lien public, l'audit de l'outil (`aa13d26` : une CSP pour `widget.html` et `public-form.html`,
  un `manifest.json`, `SECURITY.md`) et le mode interne (`02be13c`) : une table-sonde `FormPlus_Repondants` créée sans
  demander, dont la colonne `Email` est à formule déclenchée (`user.Email`) ; elle demandera la capacité `formules` (contrats
  3.4) et l'accord de la personne (règle 4), à reprendre quand la page de l'app la décrira. Traité le 21/10, à la demande du
  porteur (« il faut que Form+ soit visible dans les fichiers de GFS ») : Form+ entre dans le catalogue, la référence à
  `39e0740` (le dernier commit de code que sa page décrit ; commit à part), un manifeste provisoire (table
  `FormPlus_Formulaires`, type « Formulaire », icône `form`, cinq lectures `_grist_*`, trois tables internes écrites (cinq
  colonnes), `structure`), mesuré dans un vrai Grist (`run-form`, `run-form-seul` : l'app démarre sans refus, « Partir de
  zéro » passe, `options` et `_grist_Shares` sont refusés, `setOptions` n'écrit rien ; Grist recharge le cadre dès qu'une
  section est posée, avec ou sans GFS) ; la consigne 007 (la définition dans la table) ; l'`INDEX.md` (006 faite). Leaflet
  attend le catalogue (script, feuille de style, images) ; la porte « ouvrir » attend un client du courtier, que le porteur a
  choisi d'écrire dans le kit (21/10, soir) : une consigne chacun.
- Publipostage+ à `fd4af98` (21/10, soir) : sept commits de plus depuis `2ed567c`. Son `GFS-ETAT.md` (`5c6575a`, qui décrit
  `15aa696` ; GFS lu à `6068ce1`) ajoute trois changements : les diapositives liées à leur original (`8d68bb4`, la case
  « Garder liée » du volet « Importer » ; elles écrivent `Contenu` et `DateModif` d'autres lignes de `Publipostage_Modeles`, et
  le `Jeton` d'une source, par ce qui était déjà là ; `diapositives` en 0.12, 165 473 octets), le menu d'Enregistrer refermé
  au clic (`9b2b877`) et les textes des fenêtres réécrits (`15aa696` : « Ne pas enregistrer », « Insertion », « Email »). Lus :
  de `fcca7b4` à `15aa696`, 119 fichiers dont 91 essais ; la CSP d'`index.html`, la carte d'importation, la liste de
  bibliothèques et `js/gfs-link.js` ne changent pas ; ni table, colonne, clé de réglages, table `_grist_*` ou adresse de plus.
  Après la page : `fd4af98` (les menus « + », « Mode lecture » et « Type d'export » refermés au clic : trois marques
  `data-close-on-click` et un `?v=` dans `index.html`, sans effet chez GFS) ; `487d66b` (la 024 dans son code :
  `js/person-store.js`, `js/gfs-link.js`) est vu, à lire quand sa page le décrira. Traité le 21/10 : la référence avancée à
  `15aa696` (`600f2c9`, commit à part, relu) ; le poids de Diapositives à 165 Ko (`78bcdb1`) ; les diapositives liées mesurées
  dans un vrai Grist (`run-diapositives`, partie 3 bis, 2 x 57 : le courtier laisse passer l'écriture de la source dans le même
  lot que la présentation) ; les essais de l'ouverture et de la langue sur ses nouveaux textes (`d29aa41`) ; rejoués avec l'app à `15aa696` : ouverture 2 x 28, langue 2 x 25, direct 60, barre 7
  (avec la barre à quatre boutons), rangement 11, ligne de travail 20, démo 34 ; la
  consigne 026 (avec ce que la barre à quatre boutons recouvre chez elle). Restent ouverts : la 024 et la 025 chez elle, le
  titre d'impression (011), l'adresse du CDN (016).
- Publipostage+ à `89890c8` (21/10, soir ; le porteur : « demande de Publipostage+ ») : deux commits de plus depuis `fd4af98`.
  Son `GFS-ETAT.md` (`89890c8`, qui décrit `487d66b` ; GFS lu à `36d7d36`, consignes lues jusqu'à la 025) dit la 024 faite pour
  dix des onze clés (`487d66b` : `js/person-store.js`, nouveau, et `js/gfs-link.js` 0.7 ; `pp_news_seen` et la fenêtre des
  nouveautés dans un lot à part), la 025 lue et faite en deux lots (le porteur : « Laisser un vide » en haut), et demande de
  rejouer la vérification du stockage avec l'app. « Demandes à GFS » ne garde que la barre. Lus : de `15aa696` à `487d66b`, 30
  fichiers, deux ajoutés ; la CSP d'`index.html`, la carte d'importation et la liste de bibliothèques ne changent pas ; les
  modules passent de `localStorage` à `PersonStore` ; ni table, colonne, clé de réglages, table `_grist_*`, adresse ni
  extension de plus. Traité le 21/10 : la référence avancée à `487d66b` (`becf3b8`, commit à part, relu) ; le stockage mesuré
  avec l'app dans un vrai Grist (`run-stockage-publipostage`, 2 x 12 : le thème et le zoom gardés par GFS, retrouvés au
  rechargement, la clé du zoom retirée, aucun lot au document) ; l'`INDEX.md` (024 faite pour dix clés, 025 lue) ; la consigne 027
  (avec le nouveau nom du bouton de la barre, « Table de travail »). Restent ouverts : `pp_news_seen`, la 025 chez elle, le titre
  d'impression (011), l'adresse du CDN (016).
- Licences (21/10, le porteur : tous les dépôts sous GPL 3.0). Relevé sur le sommet de `main` de chaque dépôt :
  Publipostage+, Grist-BI et SlidesPlus ont un `LICENSE` qui est le texte officiel de la GPL 3.0 (mêmes octets que celui de
  GFS, SHA-256 `3972dc97…`) ; Grist-BI était sous MIT jusqu'au 29/09 (`fb3ab41`), passé en GPL 3.0 ce jour-là. Form+ :
  passée à la GPL 3.0 à `196734d` (consigne 004 faite) : son `LICENSE` a les mêmes octets que celui de GFS (SHA-256
  `3972dc97…`, relu le 21/10 sur `a5d2207`) et son README le dit. Automation+ : `package.json` (`GPL-3.0-only`),
  README et panneau « Crédits » disaient GPL 3.0 sans fichier `LICENSE` ; il est arrivé à `e356021` (consigne 002 faite),
  mêmes octets que celui de GFS. L'outil d'audit est sous MIT, au nom du porteur : il passe aussi en GPL 3.0 (le porteur a
  dit oui le 21/10), par un message à coller dans son projet (il n'a pas de dossier `consignes/` ici) ; à relire sur `main`
  de son dépôt. Le dépôt public `grist-factory/Publipostage-Plus` est sous GPL 3.0. GFS : `LICENSE` ajouté le 21/10 et
  `license` dans ses trois `package.json` ; le kit naît sous GPL 3.0.
- Les dossiers de `consignes/` portent l'identifiant court de l'app ; l'`id` du manifeste se fixe avec chaque `gfs.json`
  (étape 5 du plan).
- Aucun de ces dépôts n'avait de `GFS-ETAT.md` : chaque projet d'app le crée en lisant sa consigne 001.

## Se mettre à jour sur une app

Quand le porteur le demande, ou avant un travail de GFS qui touche l'app. Jamais en relisant tout le dépôt.

1. Récupérer l'historique sans les fichiers, dans un dossier hors du dépôt de GFS (dépôts publics, lecture anonyme) :
   `GIT_LFS_SKIP_SMUDGE=1 git clone --filter=blob:none --no-checkout https://github.com/lombre33/<dépôt> <dossier>`
2. Lire l'état écrit par l'app : `git -C <dossier> show origin/main:GFS-ETAT.md` (absent tant que l'app ne l'a pas créé). Sa
   section « Demandes à GFS » dit ce qu'elle attend de GFS.
3. Parcourir le journal depuis le dernier commit lu :
   `git -C <dossier> log --format='%h %ad %s' --date=short <dernier commit lu>..origin/main`
4. Ouvrir un diff seulement si le message d'un commit ou le `GFS-ETAT.md` annonce ce que GFS suit (tables, types de fichiers,
   clés de réglages, tables `_grist_*`, bibliothèques et adresses, extensions, actions, manifeste) :
   `git -C <dossier> diff --stat <dernier commit lu> origin/main`, puis `git -C <dossier> show origin/main:<fichier>`.
5. Mettre à jour : l'état des consignes dans l'`INDEX.md` de l'app (« faite » et le commit de l'app, d'après son
   `GFS-ETAT.md`), la ligne de ce fichier (nouveau sommet de `main`, date), et répondre à chaque question par une consigne, ou
   par une carte de décision quand c'est au porteur de trancher. Une demande ne se traite pas à la lecture : elle attend que
   le porteur dise « demande de Publipostage+ » (ou d'une autre app ; CLAUDE.md, « Traiter une demande d'app »).

Pièges : `git grep` sur ce clone télécharge tous les fichiers (à éviter) ; écrire `origin/main`, jamais `origin/HEAD`.
