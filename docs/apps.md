# Les apps : dépôts et dernier commit lu

Sert à se mettre à jour sur une app sans relire son dépôt (CLAUDE.md, « Les apps : consignes et état »). GFS ne pousse jamais
dans le dépôt d'une app : il lui parle par `consignes/`, elle lui répond par son `GFS-ETAT.md`.

## Apps de GFS

| App | Dépôt de développement | Consignes | Dernier commit lu | Lu le |
|---|---|---|---|---|
| Publipostage+ | `lombre33/publipostageGrist` | `consignes/publipostage/` | `5e14faa` | 19/10/2026 |
| Form+ | `lombre33/FormPlus` | `consignes/form/` | `b073d03` | 14/10/2026 |
| Automation+ | `lombre33/GRIST_automation` | `consignes/automation/` | `ee8f0a9` | 14/10/2026 |
| Grist-BI | `lombre33/Grist-BI` | `consignes/bi/` | `c8c819f` | 14/10/2026 |

## Lus pour référence (pas des apps de GFS)

| Dépôt | Pourquoi | Dernier commit lu | Lu le |
|---|---|---|---|
| `lombre33/SlidesPlus` | référence des diapositives (cahier 1.2) | `747a700` | 14/10/2026 |
| `lombre33/Grist-widget-audit` | outil d'audit (cahier 3.3) | `3a1b3d5` | 14/10/2026 |

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
- Publipostage+ change de langue en rechargeant la page (`53d36de` : plus de retraduction à chaud, `I18n.onChange` n'existe
  plus), ce qui va avec le contrat (5.2, point 2 : un seul événement en cours de vie, `extensions`). Son `initialLang()` ne lit
  que `localStorage` (clé `pp_lang`) puis les langues du navigateur, pas `contexte.langue` : à voir à l'étape 5, quand le kit
  donne le contexte.
- SlidesPlus : suivre `main`. La branche par défaut du dépôt sur GitHub est une autre, donc `origin/HEAD` ne convient pas.
- Grist-widget-audit : aucun commit n'avait été noté ; `3a1b3d5` est le sommet de `main` (4 octobre), qui n'a pas bougé depuis.
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
