# Les apps : dépôts et dernier commit lu

Sert à se mettre à jour sur une app sans relire son dépôt (CLAUDE.md, « Les apps : consignes et état »). GFS ne pousse jamais
dans le dépôt d'une app : il lui parle par `consignes/`, elle lui répond par son `GFS-ETAT.md`.

## Apps de GFS

| App | Dépôt de développement | Consignes | Dernier commit lu | Lu le | Licence (21/10) |
|---|---|---|---|---|---|
| Publipostage+ | `lombre33/publipostageGrist` | `consignes/publipostage/` | `8f2fde6` | 21/10/2026 | GPL 3.0 |
| Form+ | `lombre33/FormPlus` | `consignes/form/` | `2c0ee50` | 21/10/2026 | Apache 2.0, à passer en GPL 3.0 (consigne 004) |
| Automation+ | `lombre33/GRIST_automation` | `consignes/automation/` | `78d3619` | 21/10/2026 | GPL 3.0 (`LICENSE` ajouté à `e356021`, consigne 002 faite) |
| Grist-BI | `lombre33/Grist-BI` | `consignes/bi/` | `70d8374` | 21/10/2026 | GPL 3.0 |

## Lus pour référence (pas des apps de GFS)

| Dépôt | Pourquoi | Dernier commit lu | Lu le | Licence (21/10) |
|---|---|---|---|---|
| `lombre33/SlidesPlus` | référence des diapositives (cahier 1.2) | `747a700` | 20/10/2026 | GPL 3.0 |
| `lombre33/Grist-widget-audit` | outil d'audit (cahier 3.3) | `cc82061` | 20/10/2026 | MIT, à passer en GPL 3.0 (décision du 21/10) |

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
  et Ctrl+V sur une miniature appellent `installer`. Pas lus : `32822d6` (le bouton « Comme dans Grist » des variables),
  `6262b36`, `74dffd7` et `8f2fde6`, que la page ne décrit pas encore (la référence ira jusque-là à la prochaine lecture).
  Traité le 21/10 : la référence avancée à `cef298e` (commit à part, relu ; sept essais dans un vrai Grist, sans échec) ; le
  copier-coller des diapositives, que l'app n'avait pas essayé dans le cadre isolé de GFS, y marche (Ctrl+C sur une
  miniature, Ctrl+V sur une autre, un seul Ctrl+Z, un mot du texte copié comme toujours, extension éteinte : `installer`) ;
  le poids de Diapositives à 62 Ko ; pas de consigne, l'app n'avait rien demandé.
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
- Licences (21/10, le porteur : tous les dépôts sous GPL 3.0). Relevé sur le sommet de `main` de chaque dépôt :
  Publipostage+, Grist-BI et SlidesPlus ont un `LICENSE` qui est le texte officiel de la GPL 3.0 (mêmes octets que celui de
  GFS, SHA-256 `3972dc97…`) ; Grist-BI était sous MIT jusqu'au 29/09 (`fb3ab41`), passé en GPL 3.0 ce jour-là. Form+ :
  `LICENSE` sous Apache 2.0, README et documents de même (consigne 004). Automation+ : `package.json` (`GPL-3.0-only`),
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
