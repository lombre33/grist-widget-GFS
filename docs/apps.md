# Les apps : dépôts et dernier commit lu

Sert à se mettre à jour sur une app sans relire son dépôt (CLAUDE.md, « Les apps : consignes et état »). GFS ne pousse jamais
dans le dépôt d'une app : il lui parle par `consignes/`, elle lui répond par son `GFS-ETAT.md`.

## Apps de GFS

| App | Dépôt de développement | Consignes | Dernier commit lu | Lu le | Licence (21/10) |
|---|---|---|---|---|---|
| Publipostage+ | `lombre33/publipostageGrist` | `consignes/publipostage/` | `de63f27` (**relue le 11/11 à 17:30 UTC** : sa page à `7da9af1` (14:17) **lit les consignes jusqu'à la 066** : 064 lue (les huit adresses iront dans `fixes`), 065 et 066 lues, rien posé ; elle a rejoué la liste unique et l'outil du kit sur des copies jetables de `c14d4ec`, `bd9f53e` et `fd06824`, et **demande à GFS** : le changement du kit pour un paquet dont seuls les sous-chemins sont importés (`@tiptap/pm`) = **fait, kit 0.20.2**, un seul écrivain de `script-src` (oui), sept fonctions au lieu de quatre pour la 065 (**carte au porteur**), le poids de l'éditeur (celui de la copie construite) = consigne 067 ; le sommet de `main` est `3a29389` ; ancienne note de 11:30 UTC : sa page n'a pas bougé depuis le 10/11 21:32 (`ac1245c`) : consignes lues jusqu'à la 063, **064, 065 et 066 pas encore lues** (les messages ne sont pas encore collés) ; le sommet de `main` est `a51dc97` (vingt-cinq commits du 10 et du 11/11 : imports Word et PowerPoint qui partagent leur code, PDF/A, palette de commandes Alt+/, panneau du haut qui se replie, puces « Smiley », menu « Type d'export » qui tient dans 700 × 400) dont `bd9f53e` : sa politique de sécurité ne nomme plus `https://esm.sh` en entier mais 92 dossiers de paquets à version exacte (leur choix « Resserrer la liste ») ; la référence de GFS reste à `de63f27` ; ancienne note de ce matin : sa page à `264bc35` lit les consignes jusqu'à la 063 ; **061 lue, 062 faite** à `ac9b86d`, **063 lue, pas faite** (un lot à part, après un plan) ; le sommet de `main` est `c14d4ec` (réglages de vitesse des exports et de l'import) ; la référence de GFS reste à `de63f27` ; ancienne note : sa page : « consignes lues jusqu'à la 060 », 059 lue sans code, 060 lue : `f00625f` dit le refus d'une écriture par Grist ; le sommet porte `187464a`, l'import d'un Word que GFS donne à « Nouveau > Importer », et sa demande de déclarer la valeur `word` : **faite le 07/11 soir** (`ff2ce8a`, après le « Oui, ajouter » du porteur, mesurée avec l'app à `de63f27` : 40 vérifications ; consigne 061)) | 11/11/2026 | GPL 3.0 |
| Form+ | `lombre33/FormPlus` | `consignes/form/` | `3b9ac0c` (**relue le 11/11, référence de GFS avancée à `3b9ac0c`** et rejouée dans un vrai Grist : 54 vérifications ×3, faits vérifiés 90 ; sa page à `3b9ac0c` : **029 faite** à `74f31ac` ; deux lots du 09/11 : Form+ **publie lui-même** le formulaire (demande d'écrire `_grist_Shares` et `_grist_Pages.shareRef` : **une carte au porteur**) et **construit le formulaire avant d'avoir son lien** (lecture par la route du document, à mesurer dans un vrai GFS) ; ancienne note, sa page `0fea341` : consignes 001 à 027 faites ou lues, 020 et 021 au commit `7057309`, 024 à `a8307be`, 026 à `886c550` : `dit` donne le nom de la table de la copie, sans fenêtre d'accord ; 027 lue sans code ; kit à `cb1f8cd` ; **le guide de publication `c32ae54`** : GFS déclare l'écriture de `_grist_Views.name` ; **028 posée le 09/11**, deux demandes en attente d'une carte : ouvrir une page hors du cadre, Leaflet 1.9.4 ; **029 posée le 10/11** : `tests.js` (265 Ko) ne se charge plus qu'avec `#test`, audit vitesse et poids) | 11/11/2026 | GPL 3.0 (`196734d`, consigne 004 faite) |
| Automation+ | `lombre33/GRIST_automation` | `consignes/automation/` | `aaad9bf` (**relue le 11/11 à 11:30 UTC** : sa page à `aaad9bf` : **016 faite** (`4d1cb59` le kit à 0.13.0, `c3c88d6` la reprise du verrou et du battement, app 0.15.3, rejouée par l'app dans le labo de GFS avec sa vraie page), **017 lue**, aucun code, aucune question, aucune demande ; DIAG-R10 joué sous Firefox 160 ; ancienne note (même jour, 09 h) : sa page n'avait pas bougé depuis le 09/11 06:46, elle n'avait pas encore lu la 016 (le message n'était pas collé) ; la 0.15.2 ajoute un diagnostic à copier qui lit `_grist_Tables` et `_grist_Tables_column` sur geste (non déclaré chez GFS, refusé tant que personne ne le demande) et une **question** : le cadre laisse-t-il écrire dans le presse-papiers ? (réponse : consigne 017) ; ancienne note, sa page à `08502b7` : consignes 001 à 013 faites ou lues, au commit `56b41dc` ; 015 lue sans code : aucune table de fichiers déclarée ; **016 posée le 09/11** (« tu restes » : kit 0.13.0 `GfsLink.onStay`, et `Auteur` rempli dans GFS par la capacité `formules`) ; note de la page : refus d'écriture, le verrou d'exécution est retenté à chaque battement de 6 s avec une ligne de journal chaque fois) | 11/11/2026 | GPL 3.0 (`LICENSE` ajouté à `e356021`, consigne 002 faite) |
| Grist-BI | `lombre33/Grist-BI` | `consignes/bi/` | `3c0bddd` (**relue le 11/11** : sa page à `3c0bddd`, **013 faite** à `adc5c3d` ; les demandes `d3-cloud` et `pdfjs-dist` attendent toujours un mot du porteur ; ancienne note, sa page à `c5cdd30` : consignes 001 à 012 faites ou lues, 010 au commit `7bc9383`, 012 à `5b11c45` : un bandeau dit le refus de sauvegarde d'un rapport en lecture seule ; **013 posée le 10/11** : SheetJS (882 Ko) se charge au premier export, audit vitesse et poids) | 11/11/2026 | GPL 3.0 |
| Tuesday (nom de travail ; « Thusday » dans les anciens documents) | `lombre33/grist-wisget-tuesday` | `consignes/tuesday/` | `0ad6e04` (sa page : consignes 013 et 014 faites le 06/11, `b293cba` ; 016 lue sans code, `0ad6e04` ; relue le 11/11, rien de nouveau) | 11/11/2026 | GPL 3.0 |
| Calendar+ (id GFS `calendrier`, pas encore au catalogue ; le même projet que Tuesday, un fil de plus) | `lombre33/grist-widget-calendar-plus` | aucun dossier : les 006, 007, 009, 010 et 012 de `consignes/tuesday/` lui parlent | `a9eff44` (sa page : 012 faite à `9d8fe29`, le module du kit 0.8.0 remplace `calendrier/` ; relu le 11/11, rien de nouveau depuis le 04/11) | 11/11/2026 | GPL 3.0 (`LICENSE` au socle) |
| Sync+ (« Synchro Grist » ; pas une app du catalogue : seul son moteur ira dans le kit, choix du porteur du 06/11) | `lombre33/grist-widget-one-way-sync` | `consignes/sync/` | `359e502` (**relu le 11/11 à 17:30 UTC** : **moteur 2.7.0**, Sync+ 0.16.0 (`fe318cc`) : la mise en forme des colonnes part avec l'export (`style: true`, facultatif : langue et devise du document, couleurs, règles de mise en forme conditionnelle relues par une grammaire fermée, jamais copiées) ; repris dans le kit 0.21.0 (`ede73a7`), port rejoué dans un vrai Grist (40 et 21) ; « Partager » ne passe pas `style` ; ancienne note de 11:30 UTC : sa page (mise à jour le 11/11) dit **Sync+ 0.15.3, moteur 2.6.1** : correctif de l'audit avant la Bêta (`7f0ce56` : `addEvent` ne lève plus d'erreur quand l'historique d'une note SOURCE retouchée à la main n'est pas une liste ; cinq variables renommées), ni ajout ni retrait, port inchangé ; aucune question ; **repris dans le kit 0.20.1 (`b6bb54e`) le même jour**, port de GFS rejoué dans un vrai Grist (`run-sync-port` 40, `run-sync-partage` 21) ; ancienne note de ce matin : **006 faite** à `e3c7953`, moteur **2.6.0** ; entre-temps 2.2.0 à 2.5.0 (nom et lien du document partenaire, pièces jointes dans les deux sens d'un Échange, rangement du journal sous la table reçue, lien du document que Grist écrit lui-même : « Page non trouvée » sans la bonne équipe) ; **repris dans le kit 0.17.0 (`cddb6f4`) le 11/11**, port de GFS rejoué dans un vrai Grist (40 et 21 vérifications, faits vérifiés 89) ; ancienne note : `GFS-ETAT.md` lu au commit `f37cfd9` (07/11, midi) : 001 et 002 faites, moteur 1.0.0 dans `js/engine/` (port et préfixe) ; journal relu jusqu'au sommet `2ea1c9f` (trois commits : `7c052b6`, `f37cfd9`, `2ea1c9f`) ; ses cinq questions reçoivent la consigne 003 ; la 004 (REST une seule fois dans le moteur, défaut de `docChanges` : un état perdu rend « rien n'a changé ») est posée le 07/11 soir (point 1 faite à `6159c08`) ; la 005 (le contrôle d'un lien collé, `shareInfo`, `publicAccess` et `journalStats` dans le port du moteur) est posée le 09/11 ; **003, 004 et 005 faites (09/11)** : journal relu jusqu'au sommet `e7054cc`, moteur **2.1.0** (`createRestPort` : le REST écrit une fois, l'hôte ne donne que `http` ; enchaînements sans fenêtre `source/invite.js`, `target/receive.js`, `source/export.js` ; CIBLE passive : elle applique toutes les suppressions de la SOURCE, qui note dans son journal les gros retraits, `recentDrops`), repris dans le kit 0.14.0 et rejoué dans un vrai Grist (faits vérifiés, 66) | 11/11/2026 | GPL 3.0 (déjà : `GPL-3.0-only`) |

## Lus pour référence (pas des apps de GFS)

| Dépôt | Pourquoi | Dernier commit lu | Lu le | Licence (21/10) |
|---|---|---|---|---|
| `lombre33/SlidesPlus` | référence des diapositives (cahier 1.2) | `747a700` | 20/10/2026 | GPL 3.0 |
| `lombre33/Grist-widget-audit` | outil d'audit (cahier 3.3) | `1f4aed6` | 10/11/2026 | MIT encore à cette date, à passer en GPL 3.0 (décision du 21/10, pas appliquée) |

« Dernier commit lu » est le sommet de `main` à la dernière lecture : le journal a été parcouru jusque-là, et le diff ouvert
seulement pour les commits qui touchent ce que GFS suit. Notes du 14/10 :

- Publipostage+ au 06/11 (soir) : référence de GFS avancée de `6a22dee` à `47fbd21` (sommet de `main`, 1.1.x), journal parcouru, et mesuré sur le code servi (index.html, js/, css/, extensions/) : la CSP (empreinte identique), la carte d'importation et les bibliothèques ne changent pas ; mêmes 11 verbes d'écriture et 9 tables `Publipostage_*` ; **une seule table interne de plus** (`_grist_Attachments`, déclarée par la 052) ; trois choses nouvelles qui ne servent à rien dans GFS tant qu'il ne les offre pas : le PDF joint à la ligne par un jeton d'écriture (`js/row-attachment.js`, un `fetch` de plus, les clés `pp_attach_column` et `pp_attach_mode` que GFS ne déclare pas), les appels `lecteur.*` (`js/gfs-link.js`, muets sans la clé de contexte `lecteurs`) et `pp_layer_checks` (stockage de la personne) ; cinq `grist.*` de plus sont de fausses alertes (classes CSS et variables nommées `grist`). Poids reportés au manifeste dans le même lot (diapositives 582, lecture-pdf 88, graphique 189, edition 103 inchangé ; mêmes chiffres que la page de l'app). Le dossier de l'app référencée se refait par `git archive <commit> | tar -x -C prototype/apps/publipostage`, **plus son sous-module `kit/` à la version que l'app épingle** (`8afa569`, depuis le kit : `git -C <kit> archive 8afa569 | tar -x -C prototype/apps/publipostage/kit`), puis `git update-index --cacheinfo 160000,<commit entier>,prototype/apps/publipostage`. Rejoué : `run-pieces-jointes-publipostage.mjs` (7 vérifications) ; **le rangement d'un export (`run-ranger-publipostage.mjs`) n'a pas pu être rejoué dans ce conteneur** : son miroir local des CDN n'a ni pdfmake, ni ses polices (`labo/mirror/umd/` : exceljs, jszip, marked seulement), l'export s'arrête sur « Échec de chargement du script » avant d'atteindre GFS ; le même arrêt vaudrait pour l'ancienne référence.
- Relecture de midi du 07/11 (le porteur : « tout roule ? tu as reçu des retours de certaines apps ? »). Quatre dépôts ont bougé. **Publipostage+** `987a338` → `3bb6d95` (sa page `7e72feb`, « consignes lues jusqu'à la 057 », GFS lu à `c46a1ce`) : 055, 056 et 057 lues, **le grisé du PDF joint à la ligne est levé** (`4eef1fb`, `GFS_ATTACH_WIRED = true`), la mise en forme conditionnelle des tableaux (`11e9e0f`) et l'import d'un Word (`3bb6d95`, moteur local `js/docx-import.js`, lazy comme PowerPoint, aucun appel à GFS) ; relu : la politique de sécurité, la carte d'importation et les bibliothèques ne changent pas ; une question nouvelle (fermer le lecteur vidéo au clavier : mesuré, aucune touche du cadre du fournisseur ne sort, consigne 059). **Form+** `17cfce9` → `91e4ba8` (sept commits : 019 à 024 faites ; `onClose`, `onDelete` et `onDuplicate` du kit 0.10.0 ; `closeManagedFormPublicLink` et `duplicateManagedForm` ; un script classique de `'self'` pour l'attente d'ambiance) : GFS déclare `suppression.appel` et `copie.appel`, rejoue avec la vraie app (25 vérifications, faits vérifiés 58), consigne 026. **Grist-BI** `8eb479b` → `4c86596` (010 faite, `7bc9383` : le `finally`) : `run-bi` 25 et `run-bi-fermer` 7 verts. **Sync+** : sa première page `GFS-ETAT.md` (`f37cfd9`) ; le fil « Partager… avec Sync+ » est prévenu. Automation+ (`f6da4cc`), Tuesday (`b293cba`) et Calendar+ (`a9eff44`) n'ont pas bougé. Référence de chaque app avancée dans un commit à part.
- Relecture du 11/11 à 17:30 UTC (le porteur : « les messages ont été copiés et traités, tu peux regarder si réponses ? », 17:27 UTC). **Publipostage+** `a51dc97` → `3a29389` (sa page `7da9af1`) : consignes 064, 065 et 066 lues, rien posé ; ses demandes (changement de l'outil du kit, un seul écrivain de `script-src`, sept fonctions, poids de l'éditeur) reçoivent la **consigne 067** ; kit 0.20.2. **Sync+** `5e4e38b` → `359e502` : moteur 2.7.0, repris dans le kit 0.21.0. **Form+** `3b9ac0c`, **Automation+** `aaad9bf`, **Grist-BI** `3c0bddd`, **Tuesday** `0ad6e04`, **Calendar+** `a9eff44` : rien de nouveau. Le porteur n'a plus à coller de message : une phrase par projet (« Il y a du nouveau de GFS : lis `consignes/<app>/INDEX.md` ») suffit, la consigne étant dans le dépôt.
- Relecture du 11/11 à 11:30 UTC (le porteur : « Peux tu vérifier si les app ont répondues ? », 11:21 UTC). Sept dépôts relus. **Automation+** `b565c9e` → `aaad9bf` (quatre commits, sa page du 11/11) : **016 faite** (`4d1cb59` le kit à 28e2b76, `c3c88d6` la reprise sur `rester`, 0.15.3 ; rejouée par l'app dans le labo de GFS : le verrou revient, la ligne suivante est traitée, le témoin sans reprise reste figé), **017 lue** sans code (le cadre écrit dans le presse-papiers, ne lit pas ; ses lectures de `_grist_Tables` ne sont pas demandées, son diagnostic tient sans elles, DIAG-R10 joué sous Firefox 160) ; ni question ni demande. **Sync+** `c631cfa` → `5e4e38b` : moteur 2.6.1 (correctif de l'audit, rien à faire pour GFS) et 0.15.3 ; moteur repris dans le kit 0.20.1. **Publipostage+** : page inchangée depuis le 10/11 21:32 (063 lue ; 064, 065 et 066 pas encore lues, messages non collés), mais `main` a avancé de vingt-cinq commits jusqu'à `a51dc97`, dont une politique de sécurité resserrée pour l'éditeur (92 dossiers esm.sh au lieu de l'hôte entier, leur choix). **Form+** `3b9ac0c`, **Grist-BI** `3c0bddd`, **Tuesday** `0ad6e04`, **Calendar+** `a9eff44` : rien de nouveau (Form+ n'a pas encore lu la 030). Consignes Automation+ 016 et 017 passées à « faite » ; **référence d'Automation+ avancée de `f6da4cc` à `aaad9bf`** (commit à part) : politique de sécurité identique, kit à 28e2b76, aucune écriture nouvelle ; rejoué dans un vrai Grist avec la vraie app (`run-automation`, `run-auteur-automation` 6, `run-fermer` 36, `run-liens-kit` 14) ; la reprise du verrou avec la vraie app (LIEN-20) a été jouée par l'app dans le labo de GFS, pas par nous.
- Relecture du 11/11 au matin (le porteur : « Peux-tu vérifier si les apps ont répondu ? », 09:05 UTC). Sept dépôts relus, quatre ont répondu depuis le 09/11. **Form+** `2faf93b` → `3b9ac0c` : 029 faite (`74f31ac`, `tests.js` retiré du chargement : une requête et 294 Ko de moins, mesuré par l'app) ; deux lots du 09/11 non rejoués par GFS (publication par Form+ elle-même, qui demande d'écrire `_grist_Shares` et `_grist_Pages.shareRef` : **carte au porteur**, rien codé ; construire le formulaire avant son lien : lecture par la route du document) ; ses deux autres demandes (ouvrir une page hors du cadre, Leaflet) attendent toujours le porteur. **Grist-BI** `c5cdd30` → `3c0bddd` : 013 faite (`adc5c3d`, SheetJS au premier export) ; `d3-cloud` et `pdfjs-dist` attendent un mot. **Sync+** `c631cfa` : 006 faite (`e3c7953`, moteur 2.6.0) ; moteur repris dans le kit 0.17.0 le même jour (faits vérifiés 89). **Publipostage+** `c14d4ec` : 061 lue, 062 faite (`ac9b86d`), 063 lue (lot à part, après un plan) ; **une question à GFS** (huit adresses esm.sh figées que la liste de la 063 ne porte pas : passer par `fixes` de l'outil du kit, ou que l'outil les reconnaisse). **Automation+** `b565c9e` : n'a pas encore lu la 016 (message non collé) ; une question (presse-papiers du cadre). **Tuesday** et **Calendar+** : rien de nouveau. Consignes passées à « faite » dans les cinq `INDEX.md`. Suite du même jour : consignes Automation+ 017 et Publipostage+ 064 (réponses à leurs questions), moteur de Sync+ 2.6.0 repris dans le kit 0.17.0 (faits vérifiés 89), référence de Form+ avancée à `3b9ac0c` (faits vérifiés 90) ; les autres références inchangées.
- Demande de Form+ du 09/11 (le porteur : « je crois que Form+ a une demande pour toi », vers 05:51 UTC). **Form+** `c1f84a9` → `2faf93b` (trois commits ; sa page `0fea341`) : `c32ae54` ajoute un guide de publication en trois étapes après « Créer le formulaire » (ouvrir la page, Publier, coller le lien), `2faf93b` ne touche que la CI. Rien de nouveau dans la politique de sécurité, les adresses ni les bibliothèques (relu dans le diff) ; ce que le guide lit et écrit à travers le courtier : `_grist_Views.name` en écriture (**nouveau, déclaré**), `shareOptions` en lecture et le jeton en lecture seule (déjà déclarés), la clé de stockage `formplus_pending_guide`. Trois demandes à GFS : 1) `_grist_Views` en lecture et `name` en écriture : **déclaré** (faits vérifiés 65) ; 2) un verbe pour ouvrir une page du document dans un onglet hors du cadre (`GfsLink.openPage`) : **une carte au porteur**, rien codé ; 3) Leaflet 1.9.4 : **une carte au porteur** (le catalogue ne porte qu'un fichier par bibliothèque, les tuiles d'OpenStreetMap sont une adresse de plus). Référence avancée à `2faf93b`, consigne 028. Rejoué dans un vrai Grist : `run-form` 53 mesures ×4, `run-composite-form` 25, `run-ouvrir-form` 17.
- Relecture de 15:15 UTC du 07/11 (le porteur : « Check si des apps ont répondu »). Cinq dépôts ont bougé, rien d'inquiétant. **Publipostage+** `3bb6d95` → `de63f27` (huit commits, sa page à `de63f27`) : 059 et 060 lues sans code ; `f00625f` dit le refus d'une écriture ou d'une suppression par Grist (« Blocked by… », « Only owners… ») sans panne ni nouvel essai ; `52cca07` précise Échap dans le lecteur vidéo ; `d2e0656` met « Vidéo… » dans le menu « Lien et blocs » et la rend posable dans un document ; `187464a` ajoute à l'app la quatrième valeur d'importation `word` (`importFileFromGfs`) et demande à GFS de la déclarer dans `actions.importer` : d'abord non déclarée (le porteur n'avait pas dit son choix chez nous, carte posée), puis **déclarée à `ff2ce8a`** après son « Oui, ajouter » (faits vérifiés 62, consigne 061). Politique de sécurité, carte d'importation, bibliothèques, extensions et appels à GFS : inchangés (`index.html` ne change que des numéros de version et un bouton de menu). **Form+** `91e4ba8` → `c1f84a9` : 026 faite (`886c550`, `duplicateManagedForm` rend le nom de la table et `dit` le dit : « Ses réponses iront dans une nouvelle table, « Clients_copie », vide. » ; pas de fenêtre d'accord, choix assumé), 027 lue sans code ; rejoué avec la vraie app (faits vérifiés 61). **Grist-BI** `4c86596` → `c5cdd30` : 012 faite (`5b11c45`, `GristBI.data.isAccessRuleRefusal` et un bandeau, une seule fois par sauvegarde) ; `index.html` n'ajoute que le bandeau. **Automation+** `f6da4cc` → `08502b7` et **Tuesday** `09ed14c` → `0ad6e04` : leur page seulement (015 et 016 lues, aucun code) ; Automation+ note que son verrou d'exécution est retenté toutes les 6 s avec une ligne de journal chaque fois si Grist refuse l'écriture. **Sync+** : pas de réponse depuis `2ea1c9f` (la 003 et la 004 attendent d'être collées).
- Relecture de 09:45 UTC du 07/11 (le porteur : « prévois-toi d'aller lire les réponses des apps d'ici 15 min »). Deux dépôts ont bougé : **Grist-BI** `b6f9490` → `8eb479b` (sa 009 faite à `3144955` : « Nouveau » n'écrit plus la ligne vierge sans geste ; trois fichiers, aucun appel, table ni adresse de plus ; rejoué dans un vrai Grist, faits vérifiés 57 ; consigne 010) et **Automation+** `0d000dc` → `f6da4cc` (sa 013 « lue, aucun code » : un oui à `fermer` peut n'être pas suivi de la destruction du cadre ; la référence de GFS avance de `597fe02` à `f6da4cc`, neuf commits depuis, 0.15.1, `index.html` sans changement de politique, `kit/` à `eaa2ae2`). Publipostage+ (`987a338`, page `7f1ae8f`), Form+ (`c3d59e8`), Tuesday (`b293cba`), Calendrier+ (`a9eff44`) et Sync+ (`3cc217a`, pas de `GFS-ETAT.md`) n'ont pas bougé. Aucune question ni demande nouvelle à GFS.
- Publipostage+ au 07/11 (matin) : le porteur a choisi « Politique élargie » pour le lecteur vidéo de Slides+ (carte du 07/11) : GFS nomme `www.youtube-nocookie.com` et `player.vimeo.com` dans `frame-src`, déclare `permissions.lecteurs` (`youtube`, `vimeo`) pour l'app et annonce `contexte.lecteurs` ; les quatre appels `lecteur.*` que son code envoie déjà sont lus et posent le cadre du lecteur (contrats 3.4 point 7 et 5.2 point 11, faits vérifiés 56, mesuré avec sa vraie app à `987a338`). Pas construit : l'événement `lecteur { id, etat }`. Consigne 057. Le porteur a aussi choisi « Dans la vue » pour la colonne et le mode de « Joindre à la ligne » (consigne 056).
- Publipostage+ au 06/11 (nuit) : référence de GFS avancée de `47fbd21` à `c850c89` (sommet de `main`, neuf commits, 42 fichiers), relue : ancienne et nouvelle versions côte à côte, `index.html` mis à part (versions de feuilles de style et une section « Accessibilité » des réglages) la politique de sécurité et la carte d'importation sont identiques, mêmes verbes d'écriture, mêmes tables `Publipostage_*` et mêmes tables internes lues, mêmes appels `grist.*`, mêmes adresses, **poids des extensions inchangés** (diapositives 582, lecture-pdf 88, graphique 189, edition 103 : le test du manifeste passe) ; une clé de stockage de plus (`pp_alt_reminder`, par `PersonStore` : le stockage de la personne, aucune clé à déclarer), sept fichiers de plus (le rappel de texte alternatif et la barre d'outils des cadres découpée en trois). Ce qui touche GFS : `js/gfs-link.js` gagne `attach` (repris du kit 0.11.0, sur le modèle de `deposit`) et `js/row-attachment.js` appelle `joindre` au lieu de demander un jeton d'écriture (`00d2078`, la consigne 053) ; **le grisé reste** (la constante `GFS_ATTACH_WIRED` à faux) tant que sa page ne dit pas la 053 faite, et `actions.joindre` n'est donc pas encore déclaré chez GFS. Le dossier se refait comme le 06/11 (`git archive c850c89 | tar -x -C prototype/apps/publipostage`, `kit/` toujours à `8afa569`) ; aucun fichier supprimé depuis `47fbd21`. **Rejeu de la vraie app à `c850c89` dans un vrai Grist (faits vérifiés 54, `labo/run-joindre-publipostage.mjs`, 19 vérifications fr clair et en sombre, avec le grisé levé dans le labo seulement) : tout passe ; question de l'app sur `trop-gros` répondue par un changement de GFS (un fichier trop gros ne retire que lui, `probleme` null) ; consigne 054 posée (rien à changer chez elle). Prochaine consigne : 055.** **07/11 (nuit, relecture de 01:22Z)** : sa page (`7f1ae8f`, code à `00d2078`) dit « 053 · faite » (le drapeau `GFS_ATTACH_WIRED` reste à faux dans son code publié) et « 054 · lue » ; référence de GFS avancée à `987a338` (un seul fichier servi change, `js/row-attachment.js`, deux lignes de commentaire sur le trop-gros) ; GFS déclare `actions.joindre: ["pdf"]` et rejoue la vraie app sans remplacement du manifeste (faits vérifiés 54, 20 vérifications) ; 052, 053 et 054 passées à « faite » dans l'`INDEX.md` ; reste : son essai dans le Grist du porteur et le choix du porteur sur où garder la colonne et le mode.
- Grist-BI au 06/11 (nuit) : référence de GFS avancée de `474d67f` à `b6f9490` (sommet de `main`, treize commits, sept fichiers : `js/grist-api.js`, `js/main.js`, `js/i18n.js`, ses essais, sa page d'état et le sous-module `kit` avancé de `db14544` à `eaa2ae2`, kit 0.9.0). Mesuré sur le code servi, ancienne et nouvelle versions côte à côte : `index.html` identique (même empreinte : la politique de sécurité, la carte d'importation et les bibliothèques ne changent pas), les mêmes 149 adresses, les mêmes tables `BI_*` et les mêmes deux tables internes lues (`_grist_Tables`, `_grist_Tables_column`) ; ce qui change : un `AddColumn` de plus (les quatre colonnes `Nom`, `TypeRapport`, `DateModif`, `ModifiePar` sur la table de configuration existante, jamais recréée, le manifeste de GFS les nomme déjà), un `UpdateRecord` de plus (le remplissage de la migration d'une table interne), quatre appels `grist.docApi` de plus, six lectures de `localStorage` de plus **toutes dans un `try`** (la 007, point 1 : c'est ce qui empêchait l'app de démarrer dans GFS), deux `import()` de plus (le kit, à une adresse construite sur celle du script de la page, jamais lue dans un réglage ou une table), et `GfsLink.onClose`, `onOpen` et `onLanguage`. Le dossier se refait par `git archive b6f9490 | tar -x -C prototype/apps/bi`, **plus son sous-module `kit/` à la version épinglée** (`eaa2ae2`, depuis le kit : `git -C <kit> archive eaa2ae2 | tar -x -C prototype/apps/bi/kit`), puis `git update-index --cacheinfo 160000,<commit entier>,prototype/apps/bi`. Rejoué dans un vrai Grist (`run-bi.mjs`) : l'app démarre dans le sous-cadre isolé, crée ses trois tables et les quatre colonnes ; les deux ouvertures (fichier, nouveau) sont mesurées à la livraison qui suit ce commit (faits vérifiés 51).
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
- Publipostage+ à `b711d80` (21/10, soir ; le porteur : « demande de Publipostage+ ») : trois commits de plus depuis `89890c8`.
  Son `GFS-ETAT.md` (`b711d80`, qui décrit `4f00ac2` ; GFS lu à `a4dff37`, consignes lues jusqu'à la 027) dit la 026 et la 027
  faites (lues, aucun code) et deux corrections demandées par le porteur : les pages qui commencent où elles doivent
  (`daaf364`) et le bouton ▶ « Présenter » qui reste à gauche de la pastille du zoom quand une présentation s'ouvre au
  démarrage (`4f00ac2`). « Demandes à GFS » ne garde que la barre (la 025). Lus : de `487d66b` à `4f00ac2`, 13 fichiers, un
  ajouté ; la CSP, la carte d'importation et la liste de bibliothèques ne changent pas ; ni appel à Grist, message, adresse ni
  stockage de plus. Traité le 21/10 : la référence avancée à `4f00ac2` avec le poids de Diapositives à 166 Ko (`14cc617`,
  commit à part, relu) ; le bouton ▶ mesuré à l'ouverture par GFS (`1936aef`, `run-diapositives` 2 x 58 ; la vérification
  passe aussi avec l'ancien `slide-show.js` : le cas de la page de l'app ne se reproduit pas au labo) ; l'`INDEX.md` (026 et 027
  faites) ; la consigne 028 (avec l'annonce : épingler, ranger et renommer depuis les fichiers de GFS, choix du porteur).
- Form+ à `16701fe` (21/10, soir ; le porteur : « check aussi form + qui normalement a fini les consignes données ») : quatre
  commits de plus depuis `77ffd71`. Son `GFS-ETAT.md` (`16701fe`, qui décrit `038dd1b`) dit la 007 faite : la définition de chaque
  formulaire dans `FormPlus_Formulaires` (`Nom`, `TypeFormulaire`, `DateModif`, `ModifiePar`, `Definition` en JSON, et
  `IdSectionWidget`, à elle), créée avec l'accord de la personne ; plus d'écriture de `options` ni de lecture de `_grist_Shares`.
  Attention : `038dd1b` part de `84f429d`, à côté des douze commits de `514341f` à `85ac56d` (mode interne, CSP, lien public,
  créneau horaire…), que la fusion `652b156` réunit et que la page ne décrit pas. Lus : de `39e0740` à `038dd1b`, 13 fichiers.
  Mesuré dans un vrai Grist (`run-form` 2 x 26, `run-form-seul` 2 x 7) : la fenêtre d'accord et la table passent, puis
  `ensureTableGate` pose une section de formulaire sur la page du widget et Grist recharge le cadre, avec ou sans GFS : aucune
  ligne écrite, une section de plus à chaque essai. Lu dans le code de Grist (`ACLRulesReader.ts`) : une section publiée ouvre
  sa table à l'ajout, pas à la lecture. Traité le 21/10 : la référence avancée à `038dd1b` (commit à part, relu) ; le labo
  (enregistrer un formulaire, dans GFS et sans GFS) ; l'`INDEX.md` (007 faite) ; la consigne 008 (enregistrer, les répondants,
  une ligne par formulaire, la page à compléter, l'annonce du rangement par GFS).
- Publipostage+ à `dc95ebe` (21/10, soir) : six commits de plus depuis `b711d80`. Son `GFS-ETAT.md` (`dc95ebe`, qui décrit
  `2f6440a` ; consignes lues jusqu'à la 027) dit la 024 faite (la onzième clé, `pp_news_seen` : la fenêtre des nouveautés
  s'ouvre toute seule, une fois par personne, `1f336ac`) et la 025 en cours (premier lot `9d3c52d`, la barre de GFS lue ;
  second lot commencé : la barre d'outils laisse un vide à la barre posée en haut, `f81bd8a`, et les fenêtres se calent sur la
  place libre, `2f6440a`). « Demandes à GFS » ne garde que la barre. Lus : de `4f00ac2` à `2f6440a`, 27 fichiers, six ajoutés
  dont quatre essais ; la CSP, la carte d'importation et la liste de bibliothèques ne changent pas ; ni appel à Grist, stockage
  du navigateur ni adresse de plus. Traité le 21/10 : la référence avancée à `2f6440a` (`105ff46`, commit à part, relu) ; la
  fenêtre des nouveautés mesurée avec l'app (`run-stockage-publipostage` 2 x 15), le labo la disant vue dans les autres passes
  (`ff574d0`) ; un modèle renommé dans GFS pendant que l'app le tient ouvert reprend son ancien nom à l'enregistrement suivant
  (`run-ranger`, partie 7, `f3ab290`) ; l'`INDEX.md` (024 faite, 025 en cours) ; la consigne 029 (le contrat du rangement et du
  renommage par GFS, et ne jamais remettre un ancien nom). Form+ n'a pas bougé depuis `16701fe` : la consigne 009 lui porte la
  même règle du nom. Restent ouverts chez Publipostage+ : la 025, le titre d'impression (011), l'adresse du CDN (016).
- Kit 0.2.0 (21/10, soir ; le porteur : « Dans le kit ») : le lien avec GFS (`js/gfs-link.js`) poussé dans
  `lombre33/grist-factory-kit` à `c0c8660`, sans étiquette (le porteur la pose, comme la `v0.1.0`). Form+ n'a pas bougé depuis
  `16701fe` : la consigne 010 lui demande d'avancer son `kit/` à ce commit et d'y prendre l'ouverture (au démarrage et par
  l'appel « ouvrir »), la langue de GFS, son thème gardé chez GFS et la page du contexte ; à sa « faite », GFS avance la
  référence, déclare `ouvrir` dans le manifeste de Form+ et mesure le double-clic. Publipostage+ garde son propre lien.
- La barre aux quatre bords (21/10, nuit ; le porteur : « Mesurer d'abord ») : ce qu'elle recouvre de chaque app, mesuré dans un
  vrai Grist à 700 × 400, en français / clair et en anglais / sombre (`run-barre-apps.mjs`, `barre-lab.mjs`), avant d'écrire aux
  apps. Form+ (`038dd1b`) : presque rien (en haut, le haut de l'onglet « Réponses » ; en bas, un champ au bas de la vue, libre au
  bout du défilement) ; consigne 011, qui dit aussi le rejeu au rechargement (`75276d7`). Automation+ (`4110eaf`) : « Ajouter » en
  haut (45 % du bouton en français), le journal ouvert en bas (10 %), rien à gauche ni à droite ; consigne 003, pour le lot où
  elle prend le lien du kit. Grist-BI (`23647eb`), que GFS ne référence pas encore, mesurée seule dans la section, la barre posée
  par le calcul à la place du contrat : à gauche (le défaut), le début de « Page 1 », des vues et de « Exporter en PDF » (son
  contenu commence à 16 px du bord) ; consigne 002. Publipostage+ rejouée avec sa référence (`2f6440a`, sa 025 en cours) : en
  haut, sa barre d'outils laisse déjà la place ; à gauche, le haut du surligneur de sa deuxième ligne d'outils (17 %) : à revoir
  quand sa page dira la 025 faite.
- Automation+ à `f3ab8d6` (22/10, le porteur : « automations+ a fait son taff ») : un commit de plus depuis `4110eaf`, qui ne touche
  que son `GFS-ETAT.md` (le code reste celui de `6eb0165`, version 0.11.1). Il dit la consigne 003 **lue** : la barre de GFS
  recouvre « Ajouter » (barre en haut) et le début du journal (barre en bas) ; rien ne change avant le lot qui prend le lien
  avec GFS du kit (guide 1.2, point 4), où `GfsLink.onBar` écartera la barre d'outils et le journal, puis les menus et fenêtres
  se caleront sur la zone libre, jamais écrite en dur. Questions et demandes : aucune. Traité le 22/10 : l'`INDEX.md` (003
  « lue · `f3ab8d6` », le code attend le lot du lien du kit) et la référence avancée à `f3ab8d6` (commit à part, relu : un seul
  fichier de plus que `4110eaf`, `GFS-ETAT.md`). Le rejeu de la barre chez elle, avec `run-barre-apps.mjs`, attend ce lot.
- Automation+ à `746a564` (02/11, le porteur : « retour automation + ») : deux commits de plus depuis `f3ab8d6`, tous deux du 02/11.
  `941eafd` : le site en ligne sert de nouveau la dernière version (0.11.1) ; la publication de GitHub Pages échouait depuis le 21/10
  (Jekyll refusait une accolade double non fermée dans un document), le site était resté à la 0.9.0 ; un `.nojekyll` à la racine le fait
  publier les fichiers tels quels, un test (HYG-12) le garde, un scénario (START-05) compare la version en ligne à celle de `package.json`.
  `746a564` : sa page d'état dit les consignes 004 et 005 **faites** (lues, aucun code ; la clé `workflow` n'est écrite que sur un geste de
  la personne ; le site est à `https://lombre33.github.io/GRIST_automation/index.html`, adresse inchangée). Questions et demandes : aucune.
  Le code, les styles, la page d'entrée et la licence ne changent pas (ceux de `6eb0165`, 0.11.1). **Trouvé en route** : GFS ouvre chaque
  app sur son site depuis le 22/10 (`4394fb0`), donc ce qu'il ouvrait d'Automation+ du 22/10 au 02/11 était la 0.9.0, sans les règles 3, 4
  et 12 corrigées, et rien ne le signalait (le repli sur la copie ne joue que si le site ne répond pas en 15 secondes). Le découpage de
  Liquid, rejoué sur les fichiers `.md` des quatre autres dépôts (Publipostage+, Form+, Grist-BI, SlidesPlus), ne trouve aucune accolade
  non fermée ; aucun n'a de `.nojekyll` (faits vérifiés 5). Traité le 02/11 : l'`INDEX.md` (004 et 005 faites) et la référence avancée à
  `746a564` (`5b44451`, commit à part, relu : quatre fichiers, 12 lignes, aucun n'est du code servi) ; 58 vérifications ciblées sans échec
  ; aucune consigne à écrire ; la question d'une consigne commune sur le site en ligne est posée au porteur sur une carte.
- Publipostage+ à `011c74c` (22/10, le porteur : « La 025 est faite côté Publipostage+ … avance la référence … rejoue la barre ») :
  vingt-six commits de plus depuis `dc95ebe`, dont dix-huit de code. Son `GFS-ETAT.md` (`011c74c`, qui décrit `2d9d4ed` ;
  consignes lues jusqu'à la 027) dit la 025 **faite** (`9d3c52d`, `f81bd8a`, `2ebd68d`, `2f6440a`, `d590d7c`, `40b156f`, `2928d03`,
  `103e45a` et `727c083`) : la barre d'outils laisse un vide à la barre de GFS aux quatre bords et dans les petits panneaux
  (choix du porteur « Laisser un vide », 21 et 22/10), plus aucun point ouvert. Elle porte aussi la pagination, dix lots de
  l'extension `diapositives` (0.14 à 0.23 : formes, lignes et flèches, transitions, fond, notes de l'intervenant, rotation, les
  trois icônes du bas de la bande) et l'export PowerPoint (`c919855`, dans le socle). « Demandes à GFS » : la référence, `2d9d4ed`
  ou plus loin, et la barre à rejouer. Lus : de `62002ca` à `2d9d4ed`, 36 fichiers, deux ajoutés (`js/pptx-export.js` et son
  essai) ; la CSP, la carte d'importation et la liste de bibliothèques ne changent pas ; ni appel à Grist, `fetch`, message ni
  stockage de plus ; les seules adresses ajoutées sont des espaces de noms XML. Traité le 22/10 : la référence avancée à `2d9d4ed`
  (`2a4b694`, commit à part, relu) ; la barre rejouée avec l'app aux quatre bords, à 700 × 400, 560 × 300 et 700 × 180, en français /
  clair et en anglais / sombre (`run-barre-ecartee`, 227 vérifications par combinaison, aucun échec) : rien ne passe sous la barre,
  « Présenter » la masque et la rend à chaque sortie, la barre d'outils passe de cinq cas (jusqu'à quatre boutons) à aucun bouton
  sous la barre et un seul à 1,4 px dans la marge de 4 px ; l'`INDEX.md` (025 faite) ; la consigne 030. Depuis, six commits de
  plus jusqu'à `016eebb` (sa page décrit `d52e40b`) : le point rouge d'une miniature dont un cadre dépasse, l'avertissement de
  contraste de la fenêtre « Fond… », le trait seul caché aussi dans la rangée de mise en forme ; lus, rien pour GFS ; la
  référence reste à `2d9d4ed` jusqu'au prochain rejeu. Restent ouverts chez Publipostage+ : le titre d'impression (011),
  l'adresse du CDN (016), la 028 et la 029, que l'app n'a pas encore lues (la partie 7 de `run-ranger` attend la 029).

- Les apps s'ouvrent sur leur site en ligne (22/10, le porteur : « important : tu dois servir les dépôts live pas une copie figée ! »,
  `4394fb0`) : GFS ouvre chaque app sur son site GitHub Pages (`site` du catalogue : `publipostageGrist/`, `GRIST_automation/`,
  `FormPlus/`), `live=0` pour la copie du sous-module, repli sur la copie au bout de 15 secondes (contrats 1.3, point 2). La
  référence ne sert plus qu'aux mesures du labo et au repli : GFS l'avance de lui-même, un commit à part, relu, et les pages
  d'état n'ont plus à la demander. GitHub Pages est injoignable depuis l'environnement de GFS : le chemin est mesuré avec les
  fichiers de la copie rendus à l'adresse du site (`run-live.mjs`), pas sur le site réel. Dit aux apps : consigne 033 (Publipostage+),
  012 point 8 (Form+), 005 (Automation+).
- Publipostage+ à `f5df308` (22/10, après-midi ; le porteur : « publipostage a mis à jour ses éléments ») : trente-deux commits de plus
  depuis `016eebb`, dont vingt-deux de code. Son `GFS-ETAT.md` (`55bf715`, qui décrit `865afa3` ; consignes lues jusqu'à la 032) dit la 028
  lue, la 029 **faite** (`8e2f06f` : un modèle renommé dans GFS garde son nom), les 030, 031 et 032 lues. « Demandes à GFS » : servir
  l'app en direct (faite, voir plus haut), cinq points à rejouer avec `865afa3` (la partie 7 de `run-ranger`, la barre d'outils avec
  `d52e40b`, la douzième clé de stockage `pp_bubble_marks`, le menu ▾ de « Présenter », « Objets » dans la barre d'outils) et
  `allow="fullscreen"` (rien à ajouter tant que Grist ne laisse pas passer le plein écran : contrats 1.3, point 1). Lus : de
  `84002e4` à `865afa3`, 54 fichiers dont cinq ajoutés (`js/objects-menu.js`, `js/slide-copies.js`, `css/slide-copies.css` et deux essais)
  et deux retirés (`slide-objects.js`, `slide-objects.css`) ; la CSP, la carte d'importation et la liste de bibliothèques ne changent
  pas ; ni appel à Grist, `fetch`, message, stockage du navigateur ni adresse de plus ; `diapositives` passe en 0.31 (269 039 octets
  en quinze fichiers). Puis `f5df308` (la puce d'une liste suit la couleur et la taille du texte) : rien pour GFS. Traité le 22/10 : la
  référence avancée à `865afa3` (commit à part, relu) ; les cinq points rejoués, tous passés, avec trois essais nouveaux
  (`run-trait-seul`, la partie 6 de `run-stockage-publipostage`, le ▾ de « Présenter » et le menu « Objets » dans
  `run-barre-ecartee`) et un cas de plus dans `run-diapositives` (« Objets » grisé, son clic appelle `installer`) ; `run-echap-entete`
  (demande du porteur : Échap quitte l'édition de l'en-tête, comme « Terminer ») : GFS n'avale pas la touche, l'app n'a pas de
  gestionnaire (deux `CONSTAT`) ; l'`INDEX.md` (028 à 032 faites) ; les consignes 033 (la réponse) et 034 (Échap). Restent ouverts chez
  Publipostage+ : le titre d'impression (011), l'adresse du CDN (016), la 033 et la 034 ; côté porteur, deux constats sans cause
  établie (le téléchargement de l'export PowerPoint, LanguageTool dans Firefox).
- Publipostage+ à `c13e697` (23/10 ; le porteur : « check ce qui est remonté des projets », puis « est-ce que des app ont des consignes en attente ? ») : dix-huit commits de plus depuis `f5df308`. Son `GFS-ETAT.md` (`df6b86c`, qui décrit `daeedff` ; consignes lues jusqu'à la 032, la 016 attend la bascule) n'a rien de neuf à nous demander ; les 033, 034 et 035 ne sont pas encore lues. Lus : de `865afa3` à `daeedff`, 82 fichiers (19 ajoutés dont `js/history-markers.js`, `js/list-markers.js`, `js/page-copies.js`, `js/paragraph-format.js` et `css/paragraph-format.css`, aucun retiré, 63 modifiés : les listes qui suivent la couleur du texte, Ctrl+Z et Ctrl+Y qui rendent aussi la page, « Paragraphe… », les pages A4 et les diapositives mêlées dans un macro-modèle, l'import PowerPoint qui reprend les retraits) ; puis `e66428c`, `585f209`, `a2938a1`, `1643edd` et `c13e697` (le lien entre deux tables retenu pour chaque table de la page : une colonne `TableSource` ajoutée à `Publipostage_LiensTables` par `AddVisibleColumn`, sous le préfixe de l'app, ce que le filtre laisse passer). La CSP, la carte d'importation et la liste de bibliothèques ne changent pas ; `js/gfs-link.js` et `js/gfs-open.js` non plus ; hors cette colonne, ni appel à Grist, `fetch`, message, stockage du navigateur, table `_grist_*`, clé de réglages ni adresse de plus (deux `import()` dynamiques, déjà dans la carte). Traité le 23/10 : la référence avancée à `daeedff` (commit à part, relu ; le poids de `diapositives` passe de 269 à 273 : 273 146 octets en quinze fichiers) ; les labos rejoués sur elle, en français et clair : `run-ouvrir-publipostage` 28 sur 28, `run-ranger` 34, `run-stockage-publipostage` 19, `run-barre-publipostage` 7, `run-langue-publipostage` 25, `run-echap-entete` 4 (les deux `CONSTAT` d'hier, inchangés), `run-trait-seul` 4, `run-diapositives` 60, `run-edition` 60, et en anglais et sombre ouvrir 28, langue 25, diapositives 60 ; `run-barre-ecartee` : 284 réussis, **deux échecs** au bord haut à 700 × 180, les mêmes avec l'ancienne référence `865afa3`, donc sans rapport avec elle : le labo n'avait jamais joué cette taille au bord haut, et dans un cadre aussi bas le menu ▾ recouvre le coin d'état tandis que le texte passe sous le cadre ; l'appui hors du menu cherche maintenant un endroit inerte sur une grille (`barre-ecartee-lab.mjs`), et la passe complète rejouée donne 287 réussis, aucun échec. Côté porteur, sous Firefox, les deux constats du 22/10 ont leur cause (faits vérifiés 11) : le téléchargement des exports, parce que le `frame-src` de GFS ne nommait pas `blob:` (corrigé le 23/10 par `c325551`, à confirmer par le porteur) ; LanguageTool, parce qu'il n'entre pas dans un cadre à origine opaque (la question de l'isolement est posée au porteur). Restent ouverts chez Publipostage+ : le titre d'impression (011), l'adresse du CDN (016, en attente de la bascule), la 033, la 034 et la 035.
- Publipostage+ à `3ea26b9` (23/10, l'après-midi) : trois commits de plus depuis `c13e697` (`347755f`, `406c740` et `3ea26b9`, dont un seul de code). Son `GFS-ETAT.md` (`3ea26b9`, qui décrit
  `406c740`) dit les consignes lues jusqu'à la 035 : la 033 (GFS la sert en direct, donc plus de référence à avancer pour elle : GFS avance la sienne de lui-même pour ses mesures et son repli), la
  034 **faite** (`406c740` : Échap quitte l'édition de l'en-tête et du pied de page comme « Terminer », une touche de l'éditeur et un écouteur de la page, sans table, colonne, clé, message ni adresse de
  plus) et la 035 (« Nouveau > Importer ») **à faire** : « Nouveau > Importer » reste grisé pour elle jusque-là. Traité le 23/10 : la référence avancée à `3ea26b9` (commit à part, relu sur les 30 fichiers
  de `1643edd` à `3ea26b9` : rien pour le contrat, hors la colonne `TableSource` déjà notée à `c13e697`) ; `run-echap-entete` rejoué avec la vraie app, à 700 × 400 et au vrai clavier : il passe de deux
  `CONSTAT` à six vérifications réussies (la touche arrive dans le cadre isolé, l'en-tête et le pied de page se quittent) ; l'`INDEX.md` (033 et 034 faites). Restent ouverts chez Publipostage+ : le
  titre d'impression (011), l'adresse du CDN (016, en attente de la bascule) et la 035.
- Publipostage+ à `0c37c4b` (23/10, en fin d'après-midi) : six commits de plus depuis `3ea26b9` (`14e1654`, `d76430c`, `b2805a7`, `aeeeacd`, `342521a`, `0c37c4b`). Son `GFS-ETAT.md` (`0c37c4b`, qui décrit
  `342521a`) dit la 035 **faite** (`d76430c` : « Nouveau > Importer » importe le fichier que GFS donne, par les mêmes lecteurs que son menu « + » ; `normalizeOpening` de son `gfs-link.js` garde `importation`
  quand la raison vaut `importer`, `gfs-open.js` ne la prend pas pour un « Nouveau », la réponse à `ouvrir` dit si le modèle importé est ouvert) et deux ajouts qui touchent GFS sans lui demander quoi que ce soit :
  l'export en lot et la Boucle qui suivent la vue liée par « Sélectionner par » (`14e1654`, `342521a` : `js/view-source.js` lit cinq tables internes par `fetchTableRows`, `_grist_Tables`,
  `_grist_Tables_column`, `_grist_Views_section`, `_grist_Views_section_field` et `_grist_Filters`, toutes déjà au manifeste et lues par le graphique, sans écriture ; le moteur sort de l'extension `graphique`,
  qui passe de 64 à 54 Ko) et la transparence du fond et du trait d'un cadre, d'une forme ou d'une ligne, que l'import PowerPoint reprend (`aeeeacd`, sans table ni clé). Question posée à GFS : le titre
  de l'impression (011), toujours ouverte. « Demandes à GFS » : le plein écran du diaporama (`allow="fullscreen"`), qui attend le « demande de Publipostage+ » du porteur. Traité le 23/10 : l'`INDEX.md` (035 faite) ; la
  référence avancée à `0c37c4b` (commit à part, relu sur les 52 fichiers : la CSP d'`index.html`, la carte d'importation et la liste de bibliothèques ne changent pas ; dans les lignes ajoutées, ni adresse, ni
  `import()` dynamique, ni `fetch`, ni stockage du navigateur, ni écriture dans le document) et, avec elle, le poids de `graphique` du manifeste (54, le test des poids l'exige) ; le texte de permission du groupe
  `_grist_Views…` complété (« … et pour que l'export en lot et la Boucle suivent la vue liée par « Sélectionner par » », en français et en anglais) ; `run-importer-pp` écrit et rejoué avec la vraie app (33 vérifications
  dans chacune des quatre combinaisons langue × thème : Markdown, Excel et PowerPoint au démarrage et l'app déjà ouverte, sa question d'enregistrement, un fichier illisible, aucune écriture dans le
  document) ; `ACCEPTS_OPEN.publipostage.importer` passé à `true` : Excel et Markdown se dégrisent, PowerPoint attend l'extension « Diapositives » ; `run-importer` (la sonde) remet Publipostage+ à « pas encore » le temps de
  sa passe, pour mesurer le grisé d'une app qui ne reçoit pas encore. Reste : le kit (`normalizeOpening` doit garder `importation`, promis dans la 035) à sa prochaine version.
- Publipostage+ à `5dd503b` (23/10, en soirée) : six commits de plus depuis `0c37c4b` (`90e3cee`, `419cae7`, `e56a3a8`, `9b83321`, `3addebd`, `5dd503b`) : le style du trait d'un cadre, d'une forme ou d'une ligne
  (tirets, pointillés, bouts), le trait composé (double, triple, fin puis épais, épais puis fin) et les pointes de flèche (cinq formes, trois largeurs, trois longueurs), que l'import PowerPoint reprend, et trois
  mises à jour de sa page d'état (`GFS-ETAT.md` à `5dd503b`, qui décrit `3addebd` et dit lire GFS à `8cf1cbc`, donc l'importation faite). Elle le dit elle-même : « Rien à changer côté GFS : aucune table, colonne,
  clé, adresse, contrat, bibliothèque, permission ni CSP de plus ; aucun appel nouveau à GFS ». Traité le 23/10 : la référence avancée à `5dd503b` (commit à part, relu sur les 27 fichiers dont 10 d'essais :
  `index.html` ne change que des numéros de version ; la CSP, la carte d'importation, la liste de bibliothèques, `js/gfs-link.js`, `js/gfs-open.js`, `js/templates.js` et `js/grist-api.js` ne changent pas, ni
  aucun fichier des extensions ; le seul code qui touche à la sécurité, `js/html-sanitize.js`, ajoute une liste blanche exacte pour le dessin du trait en tirets) ; `run-importer-pp` rejoué avec la nouvelle référence
  (33 sur 33, français, clair) ; aucune consigne à écrire.
- Publipostage+ à `b9184cf` (27/10) : soixante commits de plus depuis `5dd503b` (du 23/10 à 20 h 20 au 27/10 à 9 h 14) : l'import PowerPoint (les 187 formes, les formes libres, les connecteurs, les images, les animations
  d'objets, les puces, l'espacement des caractères, le texte de droite à gauche, les liens vers une autre diapositive, les commentaires), cinq transitions de plus, l'animation d'un objet, une diapositive qui se masque et
  « Présenter » dans une fenêtre à part (`2561d6c`, extension `diapositives` à 0.41). Sa page d'état (`GFS-ETAT.md`, à jour au commit `519b3ff`, lit GFS à `82597b9`) demande à GFS : le poids de `diapositives` (elle compte
  330 Ko sans `present.html` ni `slide-present.js`, servis seuls ; GFS compte le dossier entier : 337, `manifest.test.mjs`) et la confirmation de la fenêtre à part (`allow-popups` gardé, `window.opener` non coupé). Traité le
  27/10 : la référence avancée à `b9184cf` (`7a3f173`, commit à part, relu sur les 102 fichiers dont 44 d'essais : `index.html` ne change que des numéros de version et des lignes de menu ; la CSP, la carte d'importation,
  la liste de bibliothèques, `js/gfs-link.js`, `js/gfs-open.js`, `js/templates.js` et `js/grist-api.js` ne changent pas ; dans l'extension, quatre fichiers de plus à charger et deux servis seuls) avec le poids 337 ;
  `run-importer-pp` 33 sur 33, `run-diapositives` 60 sur 60 ; **la fenêtre à part mesurée** (`run-barre-ecartee`, partie `presenter`, 20 sur 20 en français / clair et en anglais / sombre) : elle s'ouvre depuis le
  sous-cadre isolé de GFS, garde son ouvreur et son nom, hérite du bac à sable, donne le plein écran au premier clic et se ferme par ✕, sans rien couvrir. **Trouvé en route** : le labo (grist-static) donne `credentialless`
  au cadre du widget, ce qui coupe l'ouvreur sous Chromium ; un Grist ordinaire n'a pas cet attribut (faits vérifiés 1) ; l'option `ordinaryFrame` du labo le retire. Consigne 036 écrite.
- Publipostage+ à `f5d6376` (28/10, le porteur : « y a-t-il des messages à envoyer aux apps ou est-ce que tout est à jour ? ») : quatre commits de plus depuis `b9184cf`
  (`42391f7` : dans le PDF de l'impression par le navigateur, les liens internes mènent à leur cible ; `9a08f05` : sa page d'état ; `f3d2774` : des textes ; `f5d6376` :
  l'import PowerPoint garde les commentaires qui se citent en rond). Sa page d'état (`GFS-ETAT.md`, à jour au commit `42391f7`, lit GFS à `2267acb`) passe la **036 à faite**
  (lue, aucun code) et ne demande rien de plus à GFS : « Demandes à GFS » dit seulement que le poids 337 et la fenêtre à part sont faits ; « Questions pour GFS » est
  inchangée (le titre de l'impression, à mesurer par le porteur dans un vrai Grist). Traité le 28/10 : la référence avancée à `f5d6376` (`ee958e9`, commit à part, relu sur
  les 14 fichiers : `index.html` ne change que des numéros de version, `js/extensions.js` donne la version 0.42 à `diapositives`, `js/print-export.js`, `js/pptx-import.js` et
  `js/main.js` sont du code de l'app seule ; la CSP, la carte d'importation, la liste de bibliothèques, `js/gfs-link.js`, `js/gfs-open.js`, `js/templates.js` et
  `js/grist-api.js` ne changent pas ; le poids de `diapositives` reste 337, soit 337 117 octets) ; 58 vérifications ciblées sans échec ; aucune consigne à écrire.
- Publipostage+ à `134d043` (02/11, le porteur : « ils ont tout traité les consignes ») : trente-sept commits de plus depuis `f5d6376` (111 fichiers, dont 50 sont ses
  propres essais) : un Ctrl+Z qui défait presque tout, les tableaux de PowerPoint posés dans un cadre, « Tableau » dans un cadre de diapositive, des textes, un `.nojekyll`.
  Sa page d'état passe la **037 à faite** (`92d8575`) ; « Questions pour GFS » (le titre du PDF à l'impression, que le porteur mesure) et « Demandes à GFS » (le plein écran
  du diaporama, `allow="fullscreen"`) n'ont rien de nouveau. Traité le 02/11 : la référence avancée à `134d043` (`e1c93cb`, commit à part, relu) ; mesuré sur le code servi,
  avant et après : les mêmes 12 verbes d'actions de Grist, les mêmes 8 tables internes lues, les mêmes 46 adresses, les mêmes 19 appels de l'API grist, les mêmes noms de
  tables, un seul accès au stockage du navigateur, pas un import dynamique, une fenêtre ou un message de plus ; le poids de `diapositives` reste 337 (337 341 octets au lieu
  de 337 117) ; un compte Lecteur de Grist n'essaie plus d'ajouter la colonne « Modifié par » à la table des modèles (`307cdd0`) : une écriture de moins ; 50 vérifications
  ciblées sans échec, 109 avec le courtier et la publication ; l'`INDEX.md` (037 faite) ; aucune consigne à écrire.
- Publipostage+ à `b2ae9aa` (03/11, le porteur : « Consignes de Publipostage+ ») : trente-deux commits de plus depuis `134d043` (169 fichiers, 22 298 lignes de plus, presque
  tout du code de l'app seule et ses essais) : « Créer un graphique… » (six lots : un graphique tracé d'après une table de Grist, puis un vrai graphique que l'on modifie dans le
  Word, le PowerPoint et l'Excel ; entonnoir, cascade, jauge), le thème de présentation (deux lots), le lien d'un objet de diapositive, la vue intervenant du diaporama, « Sinon
  afficher ». Sa page d'état (`GFS-ETAT.md`, à jour au commit `78c73e2`, lit GFS à `9bf8db4`) ne change aucune consigne (001 à 037 faites, la 016 attend la bascule de GFS) ;
  « Questions pour GFS » : toujours le titre du PDF à l'impression (le porteur le mesure) ; « Demandes à GFS » : une demande de plus, **ECharts 6.1.0** (Apache-2.0, forme `script`)
  pour l'extension « graphique », voulue par le porteur (module « Créer un graphique », radar compris, bibliothèques stables et entretenues) : elle attend « demande de Publipostage+ »
  (une demande ne se traite pas à la lecture : ni la liste de bibliothèques, ni les empreintes, ni la référence, ni les poids). Les sept commits de plus après sa page (`0dae81a`
  à `b2ae9aa`) ne changent ni `GFS-ETAT.md`, ni `js/gfs-link.js`, ni `js/grist-api.js`, ni `js/settings.js`, ni `js/template-pack.js` : pas de table, de clé de réglages ni de
  contrat de plus ; la CSP de l'app (`index.html`) nomme `docx@9.15.1` (au lieu de 9.7.1) et une adresse de plus (`charts.iife.js`, du même paquet), une bibliothèque native de
  l'app, que GFS ne suit pas ; `js/extensions.js` ne change que des versions et des fichiers listés : `graphique` passe à 0.7 (8 fichiers, 161 838 octets) et `diapositives` à 0.52
  (28 fichiers, 460 780 octets), des poids que le manifeste de GFS reportera avec la demande (la page dit 417 et 137 au dernier relevé). La référence de GFS reste à `134d043` :
  l'app est servie en direct, elle ne sert qu'aux mesures et au repli.
- Publipostage+ à `24f361e` (03/11, relève de fond : « rester à jour ») : huit commits de plus depuis `b2ae9aa` (54 fichiers, dont 19 de code, de style et la page de l'app ; le reste est la
  galerie, ses essais et sa documentation). Sa page d'état n'a pas bougé (`GFS-ETAT.md` reste à `78c73e2` : 001 à 037, rien de neuf aux « Questions » ni aux « Demandes » ; ECharts attend toujours
  « demande de Publipostage+ »). Ce que les huit commits changent, lu contre ce que GFS suit : (1) les **styles de titres partagés** (`3d298f7`, `9163002` : un style de titres
  commun à tout le document Grist, à côté de celui du modèle) vivent dans la ligne réservée aux réglages du document de `Publipostage_Modeles`, une clé `headingStyles` de plus dans
  le même JSON (`Templates.getDocumentSetting`, `updateDocumentSettings`) : ni table, ni colonne, ni clé de réglages de la vue de plus ; (2) la galerie « Présentation commerciale »
  (`6f91b4d` : 39 diapositives, 12 graphiques lus dans 12 tables, thème avec décor) fait voyager `template.page.theme` et `textFormats` dans les clés de même nom de la colonne
  `Margins` du modèle (colonne et clés déjà là) et un champ `requires` dans ses fichiers de pack (l'extension `graphique`) : tant que Grist Factory Suite ne l'a pas allumée, la
  galerie grise ses deux boutons avec la raison et leur clic l'explique (`Extensions.explain`, le mécanisme qui existait) : « grisé, jamais caché » tenu ; (3) `graphique` passe à
  0.8 (`2d49f82`, « Créer un graphique… » lot 7 : la cascade se modifie dans Word, PowerPoint et Excel ; `chart-office.js`, `docx-export.js`, `xlsx-export.js`) ; (4) Slides+ : des
  repères au glissé et des groupes d'objets (`71c3046`, Ctrl+G), à la souris, sans le glisser-déposer HTML5. Mesuré sur le diff (hors essais et galerie) : aucune ligne ajoutée
  n'appelle l'API de Grist, `fetch`, le stockage du navigateur, un message ni un `import()` ; la seule adresse de plus est l'espace de noms XML d'un fichier Office ; la CSP de
  `index.html` ne change pas (que des `?v=` et le bloc de menu des titres). Le poids de `graphique` bougera (deux fichiers d'extension plus lourds) : il se recalcule avec la demande
  d'ECharts. Référence de GFS inchangée (`134d043`). Rien à écrire.
- Publipostage+ à `067c931` (03/11, le porteur : « le volet graphique ajouté dans Slides+ via Publipostage+ semble manquer d'une librairie, as-tu bien traité toutes les consignes ? ») :
  vingt commits de plus depuis `24f361e`, soixante depuis `134d043`, la référence de GFS (220 fichiers, dont 107 de code servi, de style et d'extensions). **Non : la demande d'ECharts 6.1.0
  n'avait pas été traitée.** Elle attendait « demande de Publipostage+ » alors que « Créer un graphique… » ne dessine qu'avec cette bibliothèque (`extensions/graphique/chart-make.js`,
  `Extensions.library('echarts')`) : GFS ne la donnait pas à l'app, et la fenêtre disait « Aperçu indisponible : le module qui dessine les graphiques n'a pas pu se charger ». Traité le 03/11 :
  `echarts` 6.1.0 à la liste et au catalogue (l'adresse jsDelivr que la CSP de l'app nomme déjà, la même empreinte que sa page donne ; la copie de GFS avec sa licence et son NOTICE, que
  l'Apache 2.0 impose à une copie redistribuée) ; `graphique` exige `plotly` et `echarts` (`2b0e184`) ; référence avancée à `067c931` (commit à part, relu) ; poids reportés : `diapositives` 471, `graphique` 168,
  `edition` 102 (GFS compte le dossier entier, `present.html` et `slide-present.js` compris) ; mesuré dans un vrai Grist (`run-graphique.mjs`, section 20 de `docs/faits-verifies.md`) ;
  réponse : consigne 042. Sa page d'état (`GFS-ETAT.md`, au commit `b368ab2`, lit GFS à `c77cb24`, « consignes lues jusqu'à la 039 ») ne dit pas encore « faites » les consignes 038 et 039 :
  ses deux derniers commits le sont (`22157a8` : une règle « Tables liées » dont la colonne source manque est passée et la colonne Référence relie ; `067c931` : le rappel « Enregistrer » se
  tait quand GFS a enregistré le réglage) ; GFS ne les a pas encore rejoués dans un vrai Grist avec les six règles du porteur (le « Fait quand » de la 038). Le reste des vingt commits est du code
  de l'app seule et ses essais : l'écriture en direct s'ouvre aux présentations et la page du modèle se partage (`7608755`, `a923cdb`, `8d148f9`), le diaporama ne rame plus (`f70aa23`), un graphique
  déjà dessiné n'est plus redessiné (`ce3dd43`), la pagination ne dépend plus du défilement (`c41a51d`, `c5231d0`, `892c42a`), les tableaux de Word (docx 9.15.1, `265a440`), les touches de
  « Commenter la sélection » (`f321522`, `b368ab2`). Mesuré sur le code servi (`index.html`, `js/`, `css/`, `extensions/`), avant (`134d043`) et après (`067c931`) : les mêmes 14 verbes d'actions
  de Grist, les mêmes 8 tables internes `_grist_*` lues, les mêmes 15 appels `grist.*` (122 occurrences), les mêmes 9 noms de tables `Publipostage_*`, un seul accès au stockage du navigateur
  (9 occurrences) ; adresses : 97 au lieu de 92 (`docx@9.15.1` à la place de 9.7.1 et son `charts.iife.js`, `echarts@6.1.0`, trois espaces de noms XML de fichiers Office) ; `import(` : deux
  occurrences de plus (une phrase de commentaire ; `import('prosemirror-view')`, une bibliothèque native de l'app, par son nom, jamais par une adresse) ; trois `postMessage` dans la fenêtre à part du
  diaporama (`slide-present.js`) au lieu d'un : de cette fenêtre vers l'app qui l'a ouverte (`STATE`, `BYE`, `READY`), jamais vers GFS ; aucun `fetch`, aucune fenêtre de plus.
- Publipostage+ à `3064a29` (04/11 ; le porteur a tapé « Dès la lecture » à la carte « Ajouter la bibliothèque d'une app dès que je lis sa demande ? ») : quinze commits de plus depuis `067c931`, tous du 03/11
  (48 fichiers, dont 26 de code servi, de style et d'extensions, et 3 347 lignes de plus). Son `GFS-ETAT.md` (`3064a29`, qui décrit `2082d41`, « consignes lues jusqu'à la 043 », GFS lu à `f615cfd`) dit la 038 et la
  039 faites (`22157a8`, `067c931`), **la 040 faite par `2082d41`** (elle lit le PDF que GFS garde, dans son mode Lecture, par l'extension `lecture-pdf` et la bibliothèque `pdfjs` que GFS porte), la 042 « faite · lue,
  aucun code » ; la 041 (l'ambiance) et la 043 (ranger les exports) sont lues, pas commencées ; la 045 (posée après sa lecture de GFS) n'est pas encore lue. **Sa demande de l'extension « Lecture de PDF » (« Demandes à
  GFS ») est traitée le 04/11, le jour même** : c'est la règle que le porteur vient de donner (une fonction que GFS offre déjà : la bibliothèque ou l'extension s'ajoute dès la lecture de la demande ; une fonction
  nouvelle attend encore son mot). Fait : `lecture-pdf` dans le manifeste de GFS (ses noms, son texte, `poids` 17, `pdfjs` 1.0.0) et `actions.lire: [{ "type": "pdf", "extension": "lecture-pdf" }]` ;
  `ACCEPTS_OPEN.publipostage.lire` à `true` (« Lire » se dégrise) ; le poids de `graphique` à 183 (`d9b78a4`, huit fichiers, 182 559 octets ; `diapositives` 471 et `edition` 102 n'ont pas bougé) ; la référence avancée à
  `3064a29` (commit à part, relu) ; mesuré avec la vraie app dans un vrai serveur Grist 1.7.19 (`run-lire-publipostage.mjs`, 33 vérifications dans chacune de quatre passes, 13 pour un navigateur ancien ; contrats 5.4,
  point 8 ; faits vérifiés, section 22) et rejoué sur sa version sans échec : `run-modules` (français clair, anglais sombre), `run-ouvrir-publipostage`, `run-importer-pp`, `run-diapositives`, `run-graphique`, `run-edition`,
  `run-barre-publipostage`, `run-langue-publipostage`, `run-sans-cdn` ; réponse : consigne 044. Mesuré sur le code servi (`index.html`, `js/`, `css/`, `extensions/`), avant (`067c931`) et après (`3064a29`) : les mêmes 14 verbes
  d'actions de Grist, les mêmes 8 tables internes `_grist_*` lues (une occurrence de moins, `chart-source.js`, qui lit ses tables ensemble), les mêmes 15 appels `grist.*` (122 occurrences), les mêmes 9 noms de tables
  `Publipostage_*`, un seul accès au stockage du navigateur (9 occurrences), les mêmes 97 adresses (235 occurrences), le même réseau et les mêmes fenêtres (17 occurrences) ; `import(` : une occurrence de plus, une phrase
  de commentaire de `extensions/lecture-pdf/pdf-engine.js`, aucun appel de plus. Le reste des quinze commits est du code de l'app seule : la vitesse de la Lecture, de l'ouverture et de l'enregistrement automatique
  (`7322e6f`, `57adfe6`, `c0280fc`, `33ac331`, `533ecf5`, `2bddfae`, `4eab713`, `d9b78a4`, `92da58c`), des commits d'essais seuls (`216bd75`) et ses pages d'état. **Deux faits nouveaux.** (1) **Le navigateur** : pdf.js
  6.5.438 appelle `getOrInsertComputed` de `Map` et de `WeakMap` (Chrome et Edge 145, Firefox 144, Safari 26.2) ; le Chromium du cloud (141) ne les a pas, le labo les pose (`LAB_NAVIGATEUR_ANCIEN=1` les laisse absentes) ;
  dans un navigateur plus ancien l'app dit « Ce navigateur est trop ancien pour lire un PDF : mettez-le à jour. » et GFS n'a rien de cassé (13 vérifications) ; la version « legacy » de pdfjs-dist 6.5.438 embarque ces
  deux méthodes (lue dans le paquet de npm, pas jouée). (2) **Un défaut de GFS** que la mesure a montré : sa notice « Ouverture de « Devis.pdf »… » reste affichée 6 secondes par-dessus l'app, alors que le PDF est
  dessiné au bout d'une demi-seconde (`kept-files.js`, `load` : la notice n'est jamais retirée quand le transfert réussit ; seul `#runDemo` appelle `#hideNotice`) ; **corrigé le 04/11 (`f64bfe3`)** : la notice s'efface dès que le transfert est fini. Pas mesuré : Firefox, le Grist en ligne du porteur
  (l'instance de la DINUM), un PDF protégé par un mot de passe, un PDF de centaines de pages.
- Publipostage+ à `6a22dee` (04/11, après la pause : le porteur a dit « tu peux relancer les chantiers à l'arrêt » ; sa 043 est faite) : douze commits de plus depuis `3064a29`, onze du 04/11 et `70590da` du 03/11 (92 fichiers,
  dont 55 de code servi, de style et d'extensions, et 925 lignes de plus pour 313 de moins). Son `GFS-ETAT.md` (`6a22dee`, qui décrit `47e56ce`, « consignes lues jusqu'à la 045 », GFS lu à `56d4ba9`) dit **la 041 faite par
  `fe8e82a`** (l'ambiance : le kit 0.6.0 en sous-module de l'app, `kit/` à `8afa569`, `js/gfs-ambiance.js`, des feuilles qui lisent les jetons), **la 043 faite par `47e56ce`** (`cfabee2` le code, `690b50c` les essais, `47e56ce` les
  documents), la 044 « lue, aucun code » et la 045 lue, pas commencée. **Traité le 04/11** : la référence avancée à `6a22dee` (commit à part, relu) avec le poids d'`edition` (102 → 103 Ko : `live.css`, 102 512 octets ; le test
  des poids compare le manifeste à l'app référencée) ; `actions.ranger: ["pdf"]` dans le manifeste (commit à part, relu : c'est la seule ligne qui fait ranger, sans elle GFS répond `GFS_REFUSE` et l'app télécharge en le
  disant) ; mesuré avec la vraie app dans un vrai serveur Grist 1.7.19 (`run-ranger-publipostage.mjs`, 38 vérifications dans chacune de quatre passes ; contrats 5.4, point 9 ; faits vérifiés, section 33) et rejoué sur sa version
  sans échec : `run-lire-publipostage`, `run-ouvrir-publipostage`, `run-importer-pp`, `run-graphique`, `run-edition`, `run-diapositives`, `run-copie`, `run-corbeille-apps` ; réponse : consigne 048.
  Mesuré sur le code servi (`index.html`, `js/`, `css/`, `extensions/`), avant (`3064a29`) et après (`6a22dee`) : les mêmes 12 verbes d'actions de Grist, les mêmes 8 tables internes `_grist_*` lues, les mêmes 13 appels `grist.*`
  (165 occurrences), les mêmes 9 noms de tables `Publipostage_*`, les mêmes 82 adresses (237 occurrences, aucune de plus ni de moins), un seul accès au stockage du navigateur (9 occurrences), le même réseau et les mêmes fenêtres
  (17 occurrences) - un relevé fait avec d'autres expressions que ceux des lignes plus haut : seuls comptent l'avant et l'après ; `import(` : deux occurrences de plus, `import('kit/ambiance-message')` et
  `import('kit/ambiance-pose')`, des modules du kit lus par leur nom dans la carte d'importation, depuis le dossier `kit/` de l'app (même origine). La carte d'importation gagne ces deux entrées et la politique de sécurité de
  `index.html` l'empreinte de sa nouvelle carte, sans origine de plus. **La publication de GFS prend les sous-modules en entier** : le journal de la dernière construction de Pages (`pages build and deployment`) entre dans
  `prototype/apps/automation/kit` et `prototype/apps/form/kit`, les sous-modules de leurs apps ; le `kit/` de Publipostage+ s'y est ajouté avec cette référence (vérifié sur la construction de `7269e64` : elle entre dans `prototype/apps/publipostage/kit`). Le reste des commits est du code de l'app seule : l'interface cachée des cadres de
  Slides+ (`4f23104`), le champ à variables de « Si aucune ligne » d'une boucle (`70590da`). **Pas rejoué ici** : l'ambiance (041) avec la vraie Publipostage+, qui revient au chantier du thème ; Firefox ; l'instance de la DINUM.
- Form+ à `cc21a27` (22/10, le porteur : « check ce qui est remonté des projets ») : trois commits de plus depuis `16701fe`. Son
  `GFS-ETAT.md` (`0614f73`, qui décrit `c249c4a`) dit les consignes 008 à 011 **faites** : le formulaire natif s'enregistre dans
  `FormPlus_Formulaires` (avec la fenêtre d'accord de l'app, une ligne par formulaire par `Definition.vsId`), les répondants, le lien
  avec GFS du kit 0.2.0 (l'ouverture, la langue, le thème, la page) et la barre. Traité le 22/10 : la référence avancée à `c249c4a`
  (`02fa4da`, commit à part, relu) ; le manifeste déclare la capacité `formules` (sans elle, le courtier refusait la colonne du mode
  interne) ; le menu « Nouveau » propose « Formulaire » (`46e62e6`) ; l'enregistrement mesuré dans GFS et sans GFS (`run-form`,
  `run-form-seul`, `run-ouvrir-form`) : il passe quand le formulaire a sa propre page ; six points à reprendre dits dans la consigne
  012 (le formulaire natif posé sur la page du widget n'écrit jamais sa ligne, « Changer de formulaire source » disparaît, « Nouveau »
  rouvre un ancien formulaire, le champ caché du second formulaire est visible, le mode interne crée `FormPlus_Repondants` sans accord,
  un portillon d'un document déjà touché) ; l'`INDEX.md` (008 à 011 faites). `cc21a27` (une image attachable à la description d'une
  question, collée ou prise dans une pièce jointe de Grist) lu : le collage ne demande rien à GFS, la pièce jointe demande la capacité
  `jeton` et la lecture de `_grist_Attachments` ; et les pages de réponse d'un lien public reçoivent toutes les définitions de
  `FormPlus_Formulaires` (mesure de l'app elle-même, 008). Le porteur a répondu aux deux cartes le 22/10 : « Autoriser » (le manifeste
  déclare `jeton`, en lecture seule, et la lecture de `_grist_Attachments` ; testé) et « Form+ et GFS » : la consigne 013 (un lien ne
  montre que son formulaire et n'ouvre que ce que son formulaire remplit, une porte et sa table de réception) et, côté GFS, l'accord de la
  personne à chaque publication d'un formulaire, qui dit les tables ouvertes à l'ajout, leurs colonnes que le formulaire ne montre pas et
  les colonnes lues (contrats 3.3, point 9 ; `run-publication`, 30 vérifications, quatre combinaisons langue et thème ; `run-form` : deux
  fenêtres au premier enregistrement, aucune au second) ; GFS refuse sans demander une table de GFS, d'une autre app ou de l'app à
  l'ajout. L'`INDEX.md` : 012 et 013 à faire.
- Form+ à `fd5384a` (02/11, le porteur : « ils ont tout traité les consignes ») : six commits de plus depuis `cc21a27`. Sa page d'état (`GFS-ETAT.md`, à jour au
  commit `f9dcb81`) passe les consignes **013** (`df2dc1e`), **012** (`16cf6b1`, points 2 à 7 ; 1 et 8 sans objet) et **014** (`f9dcb81`) **à faites**. Ce que
  l'app fait maintenant : chaque formulaire publié a sa petite table d'une ligne `FormPlus_Pub_<vsId>` et sa colonne Référence cachée `FormPlusDef_<vsId>` dans la
  table du formulaire (la colonne partagée `FormPlusDef` n'est plus posée : un lien ne lit que la définition de son formulaire, là où il rendait celles de tous, clés de
  partage comprises ; mesuré par l'app sur un Grist Docker avec une vraie clé de partage) ; « Partir de zéro » pose le formulaire natif sur une page neuve ; coller le lien
  d'un formulaire posé sur la page du widget est refusé avant toute copie, avec la raison ; une fenêtre de Form+ dit, avant de publier la copie, la table qui reçoit des
  lignes (et une autre, `FormPlus_Repondants`, pour le mode interne) ; l'ancienne porte (une section de formulaire publiée sur `FormPlus_Formulaires`) est dépubliée par
  `UpdateRecord` de `shareOptions`, avec l'accord de la personne, jamais supprimée (`RemoveViewSection` n'est pas un verbe que le courtier laisse passer) ; « Changer de
  formulaire source » reste dans la page ; « Nouveau » ne rouvre plus l'ancien formulaire. **Deux limites que l'app dit elle-même** : (1) coller le lien d'un formulaire
  natif déjà publié pose la copie sur la même page que lui, avec la même clé : ce lien natif ouvre donc aussi l'ajout dans la table de la copie (la corriger fermerait le
  lien natif de la personne : question posée au porteur, dans le projet de l'app, sans réponse à la date de sa page) ; (2) la fenêtre d'accord n'existe pas encore pour la
  question « Choix depuis une table », qui écrit dans une autre table (`ensureTableGate`). Traité le 02/11 : la référence avancée à `fd5384a` (`ac5ee7d`, commit à part,
  relu : 13 fichiers, 1 411 lignes de plus dont 640 de ses essais ; les mêmes adresses, les mêmes 7 verbes d'actions de Grist, un seul appel de plus à l'API de Grist, le
  jeton en lecture seule pour télécharger une pièce jointe choisie comme image, autorisé le 22/10 ; le manifeste de l'app ne change pas) ; les essais du labo refaits pour
  la nouvelle app (`f02a03a` : `run-form` 48 vérifications et `run-form-seul` 12, toutes vertes ; les faits sont dans `faits-verifies.md`, 2) ; 43 vérifications ciblées sans
  échec, 89 avec le courtier, la publication et le filtre ; l'`INDEX.md` (012, 013 et 014 faites, les deux limites dites sur la 013). La question de la carte du 02/11 (un lien
  doit-il pouvoir lire la petite table de son formulaire ?) est **tranchée le 03/11, « Petites tables déclarées seulement »** : un lien ne lit que les petites tables que le
  manifeste déclare (`permissions.lienPublic` : `FormPlus_Pub_*`), toute autre table de l'app est refusée sans fenêtre, `FormPlus_Formulaires` en tête ; codé et mesuré (contrats 3.4,
  point 5, et 11.9, point 4c) ; consigne **015**. « Questions pour GFS » : aucune. « Demandes à GFS » : Leaflet 1.9.4 (le type de question « Lieu sur carte »), qui attend « demande de Form+ ».
- Form+ à `b54414a` (03/11, relève de fond : « rester à jour ») : un commit de plus depuis `fd5384a` (`b54414a`, 02/11 soir), **de la documentation seulement** (`docs/01-etude-comparative.md`,
  `docs/03-roadmap-priorites.md` : aucune ligne de code, `GFS-ETAT.md` inchangé, au commit `f9dcb81`). Il y place les six idées du forum Grist relevées par le porteur le 02/11, avec leur
  priorité : « dire où atterrit chaque question » (partiellement fait ; petit chantier de clarté), un lien public qui échoue si la table cible a une colonne Référence à double sens
  (vigilance avant de publier), la cascade à plusieurs niveaux (V2, besoin confirmé par un sujet du forum de 21 messages), « un seul envoi par personne » (V2, **seulement en mode interne** : il étend la
  résolution d'identité de l'app, `probeRespondentIdentity` et la table `FormPlus_Repondants`, `docs/09-mode-interne.md`), un formulaire pré-rempli sur une ligne existante (V2), deux langues pour le
  répondant (V2) et le texte riche (V3) ; et, face à Intra Form, un atout : les pièces jointes. La page dit en toutes lettres : « aucune ne touche Grist Factory Suite, qui n'a rien demandé ici ».
  Un fait pour GFS, lu au passage : Form+ (`FormPlus_Repondants`), Grist-BI (`BI_Dashboard_UserProbe`) et Tuesday (sa table d'administration) lisent chacun l'adresse e-mail de la personne par
  leur propre table-sonde : trois tables pour un même besoin, ce que la carte « Donner aux apps l'adresse e-mail de la personne connectée ? » (03/11) mettrait en un seul endroit. La consigne
  **015** (petites tables déclarées seulement) n'est pas encore lue de l'app à cette date (sa page est antérieure). Référence de GFS inchangée (`fd5384a`) : rien à avancer, rien à écrire.
- Grist-BI à `586c7c4` (22/10) : deux commits de plus depuis `23647eb`, qui ne touchent que son `GFS-ETAT.md` (le code reste celui de
  `23647eb`). Il dit la 001 faite (écarts à la règle 4 : ses trois tables internes, `BI_Dashboard_Config`, `BI_Dashboard_Comments` et
  `BI_Dashboard_UserProbe`, se créent au démarrage sans l'accord de la personne ; à la règle 11 : pas de CSP, déjà au guide) et la 002
  lue. « Demandes à GFS » : aucune. Le guide omettait `BI_Dashboard_Comments` (créée depuis le 30/09) : ajoutée. Traité le 22/10 :
  l'`INDEX.md` (001 faite, 002 lue). GFS ne référence pas encore Grist-BI.
- Grist-BI à `b2772db` (02/11, le porteur : « ils ont tout traité les consignes ») : quatre commits de plus depuis `586c7c4` (`907e084`, `21b012b`,
  `e3c835a`, `b2772db` : deux demandes de fusion, la 30 pour le `.nojekyll` et la 31 pour sa page d'état), deux fichiers : un `.nojekyll` vide à la racine et son `GFS-ETAT.md`. Il passe la
  **003 à faite** (`21b012b`) : aucun fichier caché sensible n'est exposé en plus (seuls `.nojekyll` et `.gitignore`, aucun fichier `_*`) et le run « pages build and
  deployment » est passé en succès sur ce commit. « Changements qui touchent GFS », « Questions pour GFS » et « Demandes à GFS » : aucun. Traité le 02/11 :
  l'`INDEX.md` (003 faite). GFS ne référence toujours pas Grist-BI : aucune référence à avancer.
- Grist-BI à `521a8ac` (03/11, relève de fond : « rester à jour ») : quatre commits de plus depuis `b2772db`, deux demandes de fusion du 02/11 (32 : `c7b58e5`, 33 : `adfda62`), tous de
  l'app seule : le **radar** gagne un mode « plusieurs colonnes numériques » (des compétences en colonnes, les axes sont les colonnes choisies ; demande du forum Grist) et la
  comparaison d'un élève à la moyenne du groupe filtré (`js/charts.js`, `js/data.js`, `js/main.js`, `js/i18n.js`, `index.html`, plus `HYPOTHESES.md` et `TEST_PROTOCOL.md`). Lu contre ce
  que GFS suit : la tuile garde des champs de plus (`radarAxisMode`, `'columns'` ou `'dimension'`, `radarAxes`, `radarEntityColumn`, `radarEntityValue`) dans le blob JSON de
  `BI_Dashboard_Config` (la table et la colonne existent) ; mesuré sur le diff, aucune ligne ajoutée n'appelle l'API de Grist autrement qu'avant, ni `fetch`, ni stockage du navigateur, ni message, ni adresse de plus. Sa page
  d'état n'a pas bougé (`GFS-ETAT.md` à `21b012b` : 001 faite, 002 lue, 003 faite ; « Changements », « Questions » et « Demandes » : aucun). GFS ne référence toujours pas Grist-BI :
  aucune référence à avancer, rien à écrire.
- Tuesday à `99b80e2` (02/11, le porteur colle le message du projet de Tuesday) : app de gestion de projets (tableau, kanban, chronologie,
  calendrier), dépôt `lombre33/grist-wisget-tuesday`, nom de travail (les documents de GFS écrivent « Thusday »). Trois commits en tout
  (`76eab24` le cahier 0.3, `c6a1ba3` le cœur sans interface, `99b80e2` l'interface, 187 essais) ; née sur le kit 0.2.0 (sous-module à
  `c0c8660`), GPL 3.0, `.nojekyll`, `gfs.json` à la racine, que l'outil de validation de GFS passe sans erreur. Pas encore de `GFS-ETAT.md`
  (la consigne 001 le demande). Sept demandes dans son cahier (`docs/demandes-a-gfs.md`). Traité le 02/11 : `consignes/tuesday/` (001 à 004),
  la décision d'Automation+ en fond au cahier (section 2 et section 12, ligne 4), deux cartes au porteur (construire les liens entre apps,
  le calendrier). Traité le 03/11 : la **005** (les liens entre apps sont construits ; elle remplace le point 2 de la 002), prochaine consigne 006.
  GFS ne référence pas encore Tuesday : aucune référence à avancer.
- Tuesday plus tard le 03/11 : lu jusqu'à `09ed14c` (onze commits depuis `99b80e2`, le porteur n'a pas collé de message : GFS lit le dépôt, comme la mission « rester à jour » le veut). Son `GFS-ETAT.md` (`d958504`) donne la 001 faite et les 002 à 004 lues ; la barre est faite (gouttière aux quatre bords par `GfsLink.onBar`, testée), « Lier un fichier » et « Automatiser… » sont grisés avec leur raison. Deux questions pour GFS : le script d'API de Grist vient de `docs.getgrist.com` (réponse déjà au cahier, 4.7 : validé par la DINUM d'après le README d'Automation+), et le glisser-déposer HTML5 dans le sous-cadre (kanban et calendrier le font : mesuré le 03/11 avec la sonde U, `run-glisser.mjs`, faits vérifiés 13 ; réponse par la **007**, qui dit aussi qu'un `<button draggable>` ne glisse pas sous Firefox avant la 147, lu chez Mozilla). Code : V1 0.1.1, onboarding v2 (l'outil d'abord, la mise en place en fenêtre), essais dans un vrai Grist (image officielle de Grist : quatre défauts invisibles en mémoire), 208 essais unitaires et 30 dans Chromium, `Tuesday_Projets` créée seulement avec l'accord de la personne, politique de sécurité stricte (`frame-src 'none'`, `'unsafe-eval'` pour le seul script d'API de Grist). Hôte du module de calendrier prêt (`js/ui/calendrier-hote.js`, chemin `kit/js/calendrier/index.js`, retombe sur la grille provisoire) : réponse par la **006**. **Demande nouvelle** (`docs/demandes-a-gfs.md`, 8, « décision du porteur du 03/11 », message envoyé à GFS d'après elle) : GFS centralise l'identité et les permissions pour toutes les apps et expose la personne courante, seule ou dans GFS ; elle lève le point de la 003 (« aucune identité dans le `contexte` »). Carte au porteur posée le 03/11, rien d'écrit avant son choix.
- Calendar+ à `b96b04d` (03/11, lu pour le calendrier du kit) : dépôt `lombre33/grist-widget-calendar-plus`, deux commits (`5b677a2` le socle : `LICENSE` GPL 3.0, `.nojekyll`, `CLAUDE.md`, `docs/plan.md` ; `b96b04d` la version embarquable au lot 4, demande du porteur du 03/11), aucun code, pas de `GFS-ETAT.md`. Son plan écrit le module (`calendrier/` : `noyau/`, `vue/`, `calendrier.js`, qui n'importe que le kit) et son contrat (section 3 : lignes en jours civils, rappels `onOuvrir`, `onDeplacer` qui rend une promesse, `onAjouter`, `onEtat`). Écart relevé avec l'hôte de Tuesday : `creerCalendrier(element, options)` contre `creerCalendrier(rappels)` (006, point 4). Ordre des lots : noyau, vue mois, version embarquable (sous-cadre d'essai), semaine, glisser-déposer, app autonome, GFS, Tuesday.

- Pages d'état lues sur GitHub sans cloner (03/11 au soir, le porteur : « aller lire les consignes dans les apps, sans cloner les dossiers, juste aller lire sur le GitHub ») : le
  `GFS-ETAT.md` de chaque app par `raw.githubusercontent.com` et le sommet de `main` par `git ls-remote`, sans clone ni `fetch`. Sommets : Publipostage+ `e2c9696`, Form+ `b54414a`,
  Automation+ `746a564`, Grist-BI `81fcb9e`, Tuesday `15668dc`, Calendar+ `0d5ee11`. Ce que chaque page décrit : Publipostage+ `24f361e` (inchangée), Form+ `f9dcb81` (02/11 :
  la 015 n'y est pas encore lue), Automation+ `941eafd`, Grist-BI `3556d02`, Tuesday `d958504`, Calendar+ `b96b04d`. Quatre dépôts ont avancé depuis le commit que leur page décrit
  (Publipostage+, Grist-BI, Tuesday, Calendar+) : ces commits ne sont pas lus, donc « Dernier commit lu » ne bouge pas dans le tableau. Nouveau : **Grist-BI demande deux bibliothèques**
  (`pdfjs-dist` 6.5.438, la version que GFS a mesurée pour les PDF, avec son worker ; `echarts-wordcloud` 2.1.0 pour sa tuile « Nuage de mots », dont le code amont n'a pas bougé depuis
  11/2022 : à confronter au critère du porteur « sûre, documentée, maintenue » quand il dira « demande de Grist-BI ») ; **Tuesday a lu les consignes 005 à 007** (INDEX mis à jour) et
  attend la réponse sur l'identité (008) ; **Calendar+ a maintenant un `GFS-ETAT.md`** (006 et 007 lues) et pose une question sur le labo (009). Form+ n'a pas encore lu la 015.
- Les liens entre apps (03/11, le porteur : « Construire maintenant ») : GFS livre `choisir` et `ouvrir` côté app (contrats 3.6 et 5.4, points 2 et 7 ;
  `js/broker/links.js`, l'explorateur en mode choix) et le kit passe à 0.3.0 (`GfsLink.choose` et `GfsLink.openFile`, `lombre33/grist-factory-kit` à `9d17844`, sans
  étiquette : le porteur la pose). Publipostage+ offre aussi ses présentations à choisir (`actions.choisir`, `prototype/manifestes/publipostage.json`). Mesuré dans
  un vrai Grist avec une sonde, avec la vraie Publipostage+ à `134d043` et avec le vrai client du kit (`run-liens.mjs`, `run-liens-publipostage.mjs`,
  `run-liens-kit.mjs`). Tuesday le reprend par la consigne 005.
- L'ambiance de GFS (03/11, le porteur : « Oui, ces quatre + la mienne ») : GFS livre le thème, cinq ambiances (Grist Factory, Pop, Papier, Brut, Néon, qui devient Enseigne le 04/11 : le porteur le jugeait « pas fou ») et la couleur libre (contrats 5.2, point 10 ; guide des apps,
  règle 15). **04/11, le porteur : un interrupteur « Accessibilité renforcée » à part** (texte à 7:1, traits à 3:1, cadres épais, sans décor ni capitales ; premier temps) : les apps le reçoivent par le même message, `id` `renforcee`, mêmes jetons, aucune consigne ; seul le nom de l'ambiance change pour qui a écrit une règle sur `neon`. Le kit passe à 0.5.0 (le sélecteur de couleur, `4d7f556`) puis à 0.6.0 (`lombre33/grist-factory-kit` à `8afa569` : `Ambiance.start()`, ou `createAmbiance({ link, isDark })` pour une app qui garde
  son propre lien), sans étiquette : le porteur les pose. Mesuré dans un vrai Grist avec une app écrite avec le kit (`run-ambiance-kit.mjs`). Les consignes : Publipostage+ **041** (elle garde son lien, donc
  `createAmbiance`, et sa charte UI/UX gagne la section « Ambiances de GFS »), Form+ **016** (`kit/` de `c0c8660` à `8afa569`), Automation+ **006** et Grist-BI **004** (au lot où elles prennent le kit, la 003
  d'Automation+ et le guide 1.2), Tuesday **010** (avec la 008 : un seul commit de kit ; le calendrier lit les jetons). Aucune app ne change d'ici là : seule, elle garde ses couleurs. Les graphiques de Grist-BI
  gardent la palette du tableau de bord (choix prudent, dit dans la 004 ; la couleur libre pour eux serait une autre décision).
- Pages d'état relues sur GitHub sans cloner (04/11 matin, la mission « rester à jour » ; méthode du 03/11 : `raw.githubusercontent.com` et `git ls-remote`, ni clone ni `fetch`). Sommets de `main`
  et commit que chaque page dit décrire : Publipostage+ `4f23104` (page inchangée depuis le 03/11, `2082d41`), Form+ `0de37ac` (page `954483a`), Automation+ `bb8a8dd` (page `3f7d45a`), Grist-BI `474d67f`
  (page `fef9af8`), Tuesday `87720d5` (page `0b8bca7`), Calendar+ `2f69651` (page `531e0cd`). Les six dépôts ont avancé depuis leur page. Pour Form+ (`0de37ac`) et Automation+ (`bb8a8dd`), ce commit de plus est leur page elle-même : rien d'autre n'a changé depuis `954483a` et `3f7d45a`, ce que
  GFS a relu en entier (de `fd5384a` à `0de37ac`, de `746a564` à `bb8a8dd`), donc leur « Dernier commit lu » avance et la référence de GFS les rejoint (commits à part). Pour les quatre autres, ces commits ne sont pas lus : le tableau ne bouge pas. **Les quatre consignes sur l'ambiance sont faites** (kit `8afa569` ou plus récent, `Ambiance.start()`, feuilles sur les jetons ; essais des apps sur le message d'exemple du kit, jamais dans
  un GFS) : Form+ 016 (`954483a`, 829 vérifications hors ligne), Automation+ 006 (`3f7d45a`, par `createAmbiance` : l'app garde sa clé `ab_theme`), Grist-BI 004 (`fef9af8`, `Ambiance.start()` par un `import()`
  dynamique), Tuesday 010 (`0b8bca7`) ; le rejeu avec la vraie app que le « Fait quand » de ces consignes promet est fait pour Form+ et Automation+ (entrée suivante) ; Grist-BI et Tuesday ne sont pas encore au catalogue de GFS : rien à rejouer d'ici là. Autres consignes passées à « faite » dans les
  `INDEX.md` : Form+ 015 (`01ddd10`, un lien public ne lit que les petites tables `FormPlus_Pub_*`), Automation+ 003 (`3f7d45a`, la barre lue par le lien du kit : `kit/` pris en sous-module à `db14544`, 0.7.0 ; elle
  ne dit à GFS que la demande `contexte`, aucune action `ouvrir`, `choisir`, `insérer` ni `ranger`, CSP inchangée), Tuesday 005 et 007 (`1bc3a17`), 008 (`0b8bca7`, `permissions.identite` déclarée), 009 lue, Grist-BI
  004. **Questions pour GFS** : Automation+ en pose deux (l'étiquette `v0.7.0` du kit, que le porteur pose ; les couleurs de type et d'état de ses nœuds, qui suivent l'accent), réponse par sa consigne 007.
  **Demandes à GFS** : inchangées pour Form+ (Leaflet 1.9.4) et Grist-BI (`d3-cloud` 2.0.0, `pdfjs-dist` 6.5.438), qui concernent des fonctions que GFS ne propose pas encore et attendent le mot du porteur ;
  **nouvelle : Calendar+ dit son module prêt, « version 2, avec les heures »** (`531e0cd`, après la première version `5043986` ; vues Semaine et Jour, blocs horaires au quart d'heure ; 81 essais Node et 31 sous
  Chromium), le déplacement dans le kit que la 006 de Tuesday promettait (voie A) ; Tuesday garde la demande d'entrée au catalogue « à demander quand l'app sera prête ». Publipostage+ n'a pas encore lu la 044
  ni la 045.
- Calendar+ et le calendrier du kit (04/11, après le « Oui, maintenant » du porteur à 07:50 UTC sur la carte « Ranger le calendrier de Calendar+ dans le kit maintenant ? »). Lu à `531e0cd` : le module (version 2 avec les heures) et la page
  `GFS-ETAT.md`, mise à jour le 04/11 à ce commit (006, 007, 009 et 010 « lues » ; « Module prêt » dans « Demandes à GFS » ; aucune question). Le sommet du dépôt, `2f69651`, n'est pas lu : « Dernier commit lu » est `531e0cd`. **Fait** : le module est rangé dans le
  kit 0.8.0 (commits `e442f11` à `336baf4` ; le porteur pose l'étiquette `v0.8.0`), mesuré dans un vrai Grist et sous Firefox (`faits-verifies.md`, section 25), `prototype/kit` avance à `336baf4` (commit à part). **Consignes posées** : 011 à Tuesday (monter le module du kit,
  retirer la grille provisoire) et 012 à Calendar+ (retirer sa copie, monter celle du kit ; changer le module = une demande à GFS), toutes deux dans `consignes/tuesday/`. Tuesday : inchangée (`87720d5`, page `0b8bca7`). Calendar+ n'a pas encore lu la 012.
- Pages d'état relues sur GitHub sans cloner (04/11, vers 10:30 UTC, `raw.githubusercontent.com` et `git ls-remote`). Sommets de `main` et commit que chaque page dit décrire : Publipostage+ `fef72e4` (page `47e56ce`),
  Form+ `6059fb9` (page `6c79b62`), Automation+ `6019846` (page `e27e89c`), Grist-BI `474d67f` (page `fef9af8`, inchangée), Tuesday `2c8a4e3` (page `0b8bca7`, inchangée) et Calendar+ `fcb8d0f` (page `531e0cd`, inchangée) : la 011 et la 012
  ne sont pas encore lues. Le journal des commits au-delà des pages n'est pas lu : « Dernier commit lu » ne bouge pas dans le tableau. **Passées à « faite » dans les `INDEX.md`** : Publipostage+ 041 (`fe8e82a`), 043 (`47e56ce`) et 044 (lue,
  aucun code ; la 045 est lue, pas commencée), Form+ 017 (lue), Automation+ 007 et 008 (lues, aucun code). **Ce que les pages disent pour GFS** : Automation+ a deux changements de plus que la référence de GFS (`bb8a8dd`) : `7350a5c`
  (0.13.0 : l'app lit `access` et `readonly` de son adresse, contrats 1.3, point 3 ; `sessionStorage`, clé `ab_executor_<table>`, dans des `try/catch`) et `e27e89c` (0.14.0 : une prise en main de six écrans, CSP `img-src 'self' data:`,
  `localStorage`, clé `ab_tuto` ; dans GFS elle ne s'ouvre jamais d'elle-même) ; ni table, ni colonne, ni bibliothèque, ni action ne changent, et la référence de GFS n'est pas avancée (commit à part, à relire). Les demandes qui attendent
  le mot du porteur sont celles de Form+ (Leaflet 1.9.4) et de Grist-BI (`d3-cloud` 2.0.0, `pdfjs-dist` 6.5.438). **Posées** : 046 (Publipostage+), 009 (Automation+) et 005 (Grist-BI), le relevé des lignes reçues par un lien public (contrats 11.6,
  point 9, et 11.9, point 5 ; le porteur a choisi « la table du formulaire » le 04/11, 11.7, point 9) : l'app dit où une valeur de cellule entre dans un écran, un document, une requête ou un fichier et ce qu'elle en fait, et ce qu'elle lance sans
  geste à partir des lignes d'une table, sans coder. Form+ n'en reçoit pas (sa 013 est faite et dit déjà qu'une ligne reçue est un texte non fiable). Tuesday et Calendar+ ne sont pas nommés au point 9 : à relire à l'entrée de Tuesday au catalogue ;
  le calendrier du kit n'insère aucun HTML (aucun `innerHTML` dans `kit/js`, relu le 04/11). Une carte au porteur sera posée à la première réponse qui dit qu'un workflow se lance sur une ligne reçue (Automation+). **Form+ 018** (posée par le fil qui répare
  la création de formulaire) : la politique de sa page bloque l'`eval` du script de Grist, d'où « Form+ ne répond pas » dans le Grist du porteur ; elle passe en premier.
- Automation+ : la référence de GFS avance à `6019846` (04/11, commit à part). Quatre commits depuis `bb8a8dd`, tous relus : `7350a5c` (0.13.0, l'app seule dans Grist : lit `access` et `readonly` dans son adresse ; `sessionStorage`, clé
  `ab_executor_<table>`), `b691014` (sa page), `e27e89c` (0.14.0, la prise en main de six écrans : CSP `img-src 'self' data:`, `localStorage`, clé `ab_tuto`) et `6019846` (sa page). Rien qui change le contrat : ni table, ni colonne, ni clé de réglages, ni bibliothèque,
  ni action, ni appel réseau de plus. Rejoué dans un vrai Grist (`faits-verifies.md`, section 23) : `run-automation` et `run-ambiance-apps` (quatre passes, 32 mesures chacune), aucune en échec. Form+ : sommet `2ac5769`, sept commits après sa page `6c79b62`
  (de `7e6db89` à `2ac5769`, le 04/11 de 10:19 à 10:23), dont `7e6db89` qui change l'adresse à diffuser d'un formulaire publié (la page statique de Form+ avec `#form=`, au lieu de la page Grist `/s/<clé>/p/<n>`) : sa page ne les décrit pas encore, GFS n'a lu que
  `poc/js/links.js` et en a prévenu le fil des permissions. Sa référence reste à `0de37ac` : elle avancera avec la 018 (au sommet, sa politique de sécurité n'a pas encore `'unsafe-eval'`). Publipostage+ (sommet `490fc62`, page `47e56ce`) et Tuesday (sommet `24d25be`, page `0b8bca7`)
  ont aussi avancé depuis leur page : pas lus au-delà.
- Automation+ : la référence de GFS avance à `597fe02` (04/11, commit à part). Deux commits de code depuis `6019846`, relus : `0695db5` et `0c19c80` (0.15.0, retouches avant la sortie publique : la clé de réglages `workflow` n'est plus écrite quand le graphe est gardé dans la table `Automation`, seulement sans table utilisable ; un attribut facultatif `w` sur les nœuds, largeur de 200 à 600 px ; des comparaisons au texte tapé dans le moteur) et sa page `597fe02`. Rien d'autre qui change le contrat : ni table, ni colonne, ni bibliothèque, ni action, ni adresse de la politique de sécurité, ni clé de stockage, ni appel de plus (relu dans `index.html` et par recherche dans le diff de `js/` et `css/`). **Ce qui touche GFS** : la clé `workflow`, que l'arrivée de GFS lit (consigne 004), n'est plus posée ; une vue dont le graphe est dans `Automation` s'ouvre sur l'explorateur, et le graphe ne tourne que vue ouverte. L'app demande à GFS (« Demandes à GFS ») de repérer sa vue par la ligne `Workflow` de `Automation` dont `Table` est la table de la vue. **Carte posée au porteur** (04/11, 12:10 UTC : l'app marque la vue dans GFS, GFS lit sa table, ou rien) ; rien n'est codé avant son choix et la 010 répondra. Rejoué dans un vrai Grist (`faits-verifies.md`, section 23) : `run-automation` et `run-ambiance-apps` (quatre passes, 32 mesures chacune), aucune en échec. Publipostage+ : sommet `dead7af` (il était à `15f1644`), page inchangée à `47e56ce` ; pas lu au-delà.
- Automation+ : **GFS lit sa table à l'arrivée** (04/11, choix du porteur à 13:20 UTC, « GFS lit sa table », sur la carte posée à 12:10). Le manifeste d'Automation+ déclare `arrivee: { table: "Automation", colonne: "Table", lignes: { Type: "Workflow" } }` (contrats 2.5 point 4) ; sans réglage de la section qui désigne une app, GFS lit cette table et ouvre l'app dont une ligne `Workflow` porte la table de la section ; un réglage de la vue parle avant la table (la vue d'un modèle de Publipostage+ reste à Publipostage+). Mesuré avec la vraie Automation+ 0.15.0 (`faits-verifies.md`, section 35, 36 vérifications sur 36 en français / clair et en anglais / sombre ; l'ancien contrôleur ouvre l'explorateur). **Consigne 011** (réponse à sa demande : aucun code, trois choses à garder vraies : le nom `Automation`, la colonne `Table`, `Type` = `Workflow`). Constat à part : dans GFS, sa colonne `Auteur` à formule est refusée par le courtier à la création de la table (capacité `formules` non déclarée) et reste vide ; rien de changé avant le choix du porteur.
- Grist-BI entre au catalogue de GFS (04/11, le porteur : « est-ce que Grist-BI est déjà intégré ? pourquoi je ne peux pas créer de nouveau doc BI dans le menu Nouveau ? il faudrait un nom et un type de document à suggérer », puis
  « Rapport BI », son choix sur la carte du 04/11 : « Tableau de bord » reste pour l'app dédiée qu'il annonce à part de Grist-BI). Sous-module `prototype/apps/bi` à `474d67f` (commit à part) : le code est celui de `fef9af8`,
  la page d'état que GFS avait relue ; les deux commits de plus (`f305cc3`, `474d67f`) ne changent que le hash écrit dans cette page. Le noyau est celui que l'app pointe (`kit/` à `db14544`, 0.7.0). Manifeste provisoire
  `prototype/manifestes/bi.json` : table des fichiers `BI_Dashboard_Config` (colonnes `Nom`, `TypeRapport`, `DateModif`, `ModifiePar`, que l'app n'a pas encore : une ligne d'avant s'appelle « (sans nom) »), type `rapport`
  (« Rapport BI » / « BI report », icône `chart`, sans couleur de famille), capacité `formules` (la table-sonde de l'adresse), `_grist_Tables` et `_grist_Tables_column` en lecture, `ouvrir: ["rapport"]`, aucun lien public.
  `ACCEPTS_OPEN.bi` à faux : GFS dit « Provisoire » à l'ouverture. **Mesuré dans un vrai Grist, l'app non modifiée (`labo/run-bi.mjs`) : elle ne démarre pas dans le sous-cadre isolé** (quatre lectures de `localStorage` hors
  d'un `try` : `js/i18n.js:332` et `:389`, `js/main.js:886` et `:890` ; faits vérifiés 36) ; avec ces quatre lignes gardées, tout passe. Consigne **007** posée (le stockage d'abord, puis un rapport = une ligne nommée,
  puis le lien du kit pour l'ouverture). Les demandes `d3-cloud` 2.0.0 et `pdfjs-dist` 6.5.438 attendent toujours le « demande de Grist-BI » du porteur.
- Form+ : la référence de GFS avance à `17cfce9` (04/11, commit à part ; `0de37ac` avant, la 018 faite). Onze commits depuis `0de37ac`, dont neuf de code, relus (onze fichiers, le diff de `poc/js`, `poc/css` et `poc/widget.html` en entier) :
  `6c79b62` (017 : l'app cache sa page jusqu'à l'ambiance posée, dans GFS seulement) et sa page `6059fb9` ; `7e6db89` (**l'adresse à diffuser d'un formulaire publié est la page statique de Form+ avec le lien natif dans `#form=`, au lieu de la page Grist `/s/<clé>/p/<n>`** ;
  sa page `17cfce9` ne le décrit toujours pas ; le fil des permissions en est prévenu et relit à la relance : contrats 11.9) ; des retouches de l'éditeur et du répondant (`20dcd43`, `4aeb5e0`, `a1c9185`, `0e9fa2c`, `a01591e`, `2ac5769` : écran de démarrage masqué
  une fois l'éditeur affiché, référence vide, condition enregistrée en quittant la carte, pastilles plus nettes en sombre, Suivant/Envoyer recalculé, champs natifs non répétés) ; `6c79698` (**018** : `'unsafe-eval'` et l'adresse entière du script de Grist
  dans la politique de sa page ; `isPluginApiReady` voit un script chargé mais planté et le dit dans son diagnostic, `pluginApiBroken`). Rien qui change le contrat : ni table, ni colonne, ni clé de réglages, ni bibliothèque, ni permission, ni action, ni stockage du
  navigateur, ni appel réseau de plus (recherche dans le diff de `poc/js`) ; la politique de sécurité ne change que par la 018 (`'unsafe-eval'`, l'adresse entière de `grist-plugin-api.js`) ; `kit/` reste à `8afa569`. Rejoué dans un vrai Grist (`faits-verifies.md`, section 23) :
  `run-ambiance-apps`, quatre passes, 56 mesures chacune, aucune en échec. **Constat** : sa 017 ne tient pas avant la première image (l'attribut est posé par le module `main.js`, après elle) : consigne 023. Pas de question à GFS ; la demande Leaflet 1.9.4 attend
  toujours le mot du porteur. Les consignes 019 à 022 de Form+ existent déjà : le prochain numéro libre est le 024.
- Pages d'état relues sur GitHub sans cloner (04/11, vers 14:25 UTC). Sommets de `main` et commit que chaque page dit décrire : Publipostage+ `af3e745` (page `44eb80a`, « lues jusqu'à la 045 »), Form+ `98b30bd` (page `1d71b1d`), Automation+ `597fe02` (page `0c19c80`, inchangée), Grist-BI `f2104cf` (page `ce33e5f`), Tuesday `9a8cbac` (page `cbd3d7c`) et Calendar+ `a9eff44` (page `9d8fe29`). Le journal des commits au-delà des pages n'est pas lu : « Dernier commit lu » ne bouge pas dans le tableau (la référence de Form+ reste à `17cfce9`, celle de Publipostage+ à `6a22dee`). **Passées dans les `INDEX.md`** : Form+ 019 faite (`1d71b1d` : l'app relève son `kit/` à 0.9.0 et répond à « fermer » par `GfsLink.onClose` ; sur `#config` tout de suite, sur `#fill` une question avant de quitter une réponse commencée ; la 022 reste « à faire », la page ne la dit pas encore lue), Grist-BI 005 faite (lue, aucun code, `ce33e5f`) et 006 lue, laissée à faire (elle attendait le point d'entrée du kit, offert depuis le kit 0.9.0 : consigne 008), Tuesday 011 faite (`76f8179`), 012 faite (Calendar+ `9d8fe29`) et 013 lue (`cbd3d7c` : la réponse est écrite et essayée, pas branchée, elle attend `GfsLink.onClose` : consigne 014). **Pas encore lues** : Publipostage+ 046 à 049, Automation+ 009 à 012, Grist-BI 007 et 008, Tuesday 014 et Form+ 020 à 023. **Demandes à GFS** : aucune de plus ; `d3-cloud` 2.0.0 et `pdfjs-dist` 6.5.438 (Grist-BI) et Leaflet 1.9.4 (Form+) attendent toujours le mot du porteur ; la demande d'Automation+ (repérer sa vue par sa table) est faite (consigne 011) ; Calendar+ n'en fait aucune (deux constats de GFS, 012 point 4, sans changement demandé). **Questions** : aucune nouvelle (celle de Publipostage+ sur le nom du PDF à l'impression attend la mesure du porteur).
- Pages d'état relues sur GitHub sans cloner (04/11, 17:30 UTC). Une seule page a bougé : **Publipostage+**, page `33a8737` (sommet `5a700e3`), « consignes lues jusqu'à la 050 » ; Form+ (`1d71b1d`, sommet `98b30bd`), Automation+ (`0c19c80`, `597fe02`), Grist-BI (`ce33e5f`, `f2104cf`), Tuesday (`cbd3d7c`, `9a8cbac`) et Calendar+ (`9d8fe29`, `a9eff44`) sont inchangées. Le journal des commits au-delà de la page n'est pas lu : « Dernier commit lu » ne bouge pas (la référence reste à `6a22dee`, le fil des PDF l'avance). **Passées dans l'`INDEX.md` de Publipostage+** : 045 faite (`44eb80a`, commenter un PDF en Lecture), 046 faite (`9d8794a`), 047 faite (`bed4631` : l'app répond à « fermer », l'abonné `onClose` de son propre `js/gfs-link.js`), 048 et 050 lues sans code, 049 faite (`ed1c78c`). **046, le relevé des lignes reçues par un lien public** (contrats 11.6 point 9 et 11.9 point 5) : valeur de cellule = texte partout (Lecture, aperçu, impression, champs, noms de fichier, exports Markdown, HTML, Word, PDF, Excel, PowerPoint, liens, images, règles et calculs), jamais un balisage, une formule ni une adresse de script ; **rien ne se lance sur une ligne reçue** (pas d'envoi, de téléchargement, d'export ni de document ; l'app redessine seulement, et ouvre le modèle que les règles désignent si la personne a réglé « Modèle selon la ligne ») ; **un seul défaut trouvé, corrigé** : un retour à la ligne (CR, LF, U+2028, U+2029) dans une adresse ou un objet restait dans le lien `mailto:` (injection d'en-tête classique, `Bcc:`), encodé en `%0D%0A` ; désormais un saut de ligne dans une adresse sépare deux destinataires, celui de l'objet devient une espace. Pas essayé par l'app : Firefox, un vrai client de messagerie, un vrai lien public de formulaire. Pour GFS : rien à porter au porteur (aucun lancement du point 2 ne touche une ligne reçue), le fil des permissions en est prévenu. **Demandes** : aucune nouvelle ; **question** inchangée (le nom du PDF à l'impression, à mesurer par le porteur). Il reste à lire : Automation+ 009 à 012, Grist-BI 007 et 008, Tuesday 014, Form+ 020 à 023.
- Point sur les apps (06/11, vers 17:10 UTC, demande du porteur : « vérifier si les apps ont lu tes messages et/ou leurs éventuelles consignes »). Pages d'état relues sur GitHub sans cloner : **aucune n'a changé depuis le 04/11**, hors le sommet de Publipostage+ (page `33a8737`, sommet `7c98c9a`) ; Form+ (`1d71b1d`, `98b30bd`), Automation+ (`0c19c80`, `597fe02`), Grist-BI (`ce33e5f`, `f2104cf`), Tuesday (`cbd3d7c`, `9a8cbac`) et Calendar+ (`9d8fe29`, `a9eff44`) n'ont pas un commit de plus : leurs consignes non lues (Form+ 020 à 023, Automation+ 009 à 012, Grist-BI 007 et 008, Tuesday 014) attendent que le porteur colle les messages dans leurs projets. Publipostage+ a tout lu (jusqu'à la 050). **Journal de Publipostage+ de `33a8737` à `7c98c9a`** (clone sans fichiers, hors du dépôt de GFS ; 1.0.0 puis 1.1.0 à 1.1.2, 04 au 06/11 : mise en forme conditionnelle, image liée à une colonne Pièces jointes, chemin de références, README et note de version) lu pour ce que GFS suit : **une seule lecture nouvelle**, la table interne `_grist_Attachments` (`js/grist-api.js`, `getAttachmentInfos`, depuis `1de0bc1` ; colonnes `fileName`, `fileType`, `fileExt`, `imageWidth`) ; le manifeste de GFS n'en déclare que huit, le filtre la refuse (« Lecture de _grist_Attachments non déclarée (permissions.gristInterne). », rejoué avec le vrai filtre et le vrai manifeste) et le repli de l'app tient (toute pièce jointe est tenue pour une image). Ni table `Publipostage_*`, ni clé, ni stockage, ni verbe d'écriture, ni adresse, ni bibliothèque, ni message de plus. **Consigne 051** posée (elle demande à l'app de le dire dans « Demandes à GFS » ; GFS ne déclare rien de lui-même : une carte au porteur viendra avec sa demande). Demandes en attente du mot du porteur, inchangées : `d3-cloud` 2.0.0 et `pdfjs-dist` 6.5.438 (Grist-BI), Leaflet 1.9.4 (Form+). Rien qui relève de « Dès la lecture » : aucune app n'a demandé une fonction que GFS offre déjà. La carte sur la colonne `Auteur` d'Automation+ reste sans réponse.
- Retours des apps (06/11, vers 21:15 UTC, le porteur : « les apps ont eu leurs messages, va voir si tu as des retours »). Pages d'état relues sur GitHub sans cloner ; sommets de `main` et commit que chaque page dit décrire : Publipostage+ `43d2da3` (page `8610a8c`), Form+ `c3d59e8` (page `bf0ddce`), Automation+ `0d000dc` (page `56b41dc`), Grist-BI `b6f9490` (page à `913b4a0`), Tuesday `b293cba` (page `6de3259`), Calendar+ `a9eff44` (page `9d8fe29`, inchangée). Le journal des commits au-delà des pages n'est pas lu : « Dernier commit lu » ne bouge pas dans le tableau. **Passées dans les `INDEX.md`** : Publipostage+ 051 faite (lue, aucun code) ; Form+ 022 et 023 faites (`1d71b1d`, `bf0ddce`), 020 et 021 **lues, bloquées sur le kit** ; Automation+ 009 faite (`048c616`), 010 faite (`56b41dc`), 011 faite (lue, aucun code), 012 faite (`6459b2f`, `56b41dc`) ; Grist-BI 006 et 008 faites (`4c20972`), 007 faite (point 1 `a4c53ee`, points 2 et 3 `0ae0199`) ; Tuesday 013 et 014 faites (`6de3259`). **Ce que les pages disent pour GFS.** (1) Publipostage+ 051 : sa page dit la lecture de `_grist_Attachments` (neuvième lecture interne, quatre colonnes) et la demande de la déclarer, avec le texte proposé pour la fenêtre d'installation : carte au porteur. (2) Publipostage+, **PDF joint à la ligne** (`4f9b868`, `c39fa01`) : la case « Joindre à la ligne » envoie chaque PDF d'une ligne à Grist (`POST /attachments`) avec un jeton d'écriture (`getAccessToken({ readOnly: false })`) et l'écrit dans la cellule (`BulkUpdateRecord`) ; dans GFS elle ne marche pas (le manifeste dit `jeton.lectureSeule: true`, et `setOption` refuse les clés `pp_attach_column` et `pp_attach_mode`, non déclarées dans `reglages`) ; l'app demande deux déclarations ; l'autre voie est une fonction de GFS qui joint elle-même le fichier (l'app l'a prévue : `attachAll` est son seul point de branchement) : carte au porteur. (3) Publipostage+, **lecteur vidéo de Slides+** (`67e3669`, demande du porteur du 06/11) : quatre appels `lecteur.afficher`, `lecteur.deplacer`, `lecteur.masquer`, `lecteur.fermer`, la clé `lecteurs` du contexte et l'événement `lecteur` ; GFS monterait un cadre `youtube-nocookie.com` ou `player.vimeo.com` au-dessus de l'app, deux adresses de plus dans la `frame-src` de sa page ; l'app ne code rien de plus et n'envoie rien tant que GFS n'annonce pas `lecteurs` : carte au porteur (étude d'abord conseillée). Le reste de sa 1.0 et 1.1 ne change rien (ni table, ni clé, ni adresse, ni bibliothèque) ; le manifeste de GFS dit `version: "1.0.0"` et des poids (`diapositives` 471, `graphique` 183, `lecture-pdf` 17, `edition` 103) que la page donne à jour (511, 189, 88, 103 Ko) : à reporter avec la prochaine avancée. (4) Form+ : la 020 (`supprimer`) et la 021 (`dupliquer`) ne peuvent pas être faites : le kit (`kit/js/gfs-link.js`, `receiveCall`) répond `GFS_INCONNU` à tout appel autre que `ouvrir` et `fermer`, avant tout abonné que l'app ajouterait ; il faut un crochet du kit (`onDelete` et `onDuplicate`, ou un crochet par nom d'appel) : carte au porteur. (5) Automation+ 009 : **un workflow actif se lance sans geste sur toute ligne créée ou modifiée que la vue reçoit, lien public compris, tant que l'onglet a la vue ouverte et tient le verrou** (une ligne reçue vue fermée n'est jamais traitée) ; il écrit avec les droits de la personne dont l'onglet exécute, `AddRecord` et `UpdateRecord` seulement ; elle demande la liste des tables qu'un lien public remplit (contrats 11.7, point 11) : carte au porteur, fil des permissions prévenu. (6) Automation+ 010, **question pour GFS** : après `{ ferme: true }`, le cadre est-il toujours détruit ? (sinon son workflow actif, qui a rendu son verrou, cesse de s'exécuter jusqu'au rechargement) : réponse par la consigne 013. (7) Grist-BI : l'app démarre sans `localStorage` (point 1) et gagne les quatre colonnes de `BI_Dashboard_Config` et le lien du kit ; à rejouer dans un vrai Grist, avec l'avancée de la référence (commit à part) et `ACCEPTS_OPEN.bi`. (8) Tuesday et Form+, Automation+, Grist-BI répondent à « fermer » par `GfsLink.onClose` du kit 0.9.0 (`eaa2ae2`). **Demandes** : `d3-cloud` 2.0.0 et `pdfjs-dist` 6.5.438 (Grist-BI) et Leaflet 1.9.4 (Form+) attendent toujours le mot du porteur ; Automation+ et Calendar+ n'en font aucune. **Cartes posées au porteur** (06/11, 21:10 UTC) : `_grist_Attachments`, PDF joint à la ligne, crochets du kit pour `supprimer` et `dupliquer`, lignes reçues d'Automation+, lecteur vidéo de Slides+ ; la carte sur la colonne `Auteur` d'Automation+ reste sans réponse.
- Publipostage+ et `_grist_Attachments` (06/11, vers 21:25 UTC, le porteur a répondu « Oui, déclarer » à la carte) : le manifeste (`prototype/manifestes/publipostage.json`) déclare une neuvième lecture interne, `_grist_Attachments`, en lecture seule, avec la phrase de l'app comme `pourquoi` (« Savoir si une pièce jointe est une image… »). Test dans `test/filter.test.mjs` (lue, jamais écrite, refusée sans la déclaration) ; mesuré dans un vrai Grist avec la vraie app dans son sous-cadre : `prototype/labo/run-pieces-jointes-publipostage.mjs` (lecture avec les quatre colonnes, trois écritures refusées, une autre table interne toujours refusée ; français clair, anglais sombre). **Pas mesuré** : la 1.1.2 elle-même (la référence reste à `6a22dee`), un PDF réellement importé dans le document. Consigne 052 pour l'annoncer.
- « Nouveau > Importer » (22/10, le porteur : « les imports possibles par Publipostage+ (Excel, docx, pptx…) il faudrait qu'ils soient aussi
  disponibles dans le menu Nouveau, sous-menu Import ? », puis sa réponse « Sous-menu Importer ») : GFS livre le sous-menu. Le
  manifeste déclare les formats (`actions.importer`, contrats 2.7, point 4), GFS ouvre le sélecteur de fichier et rend le `File` à l'app
  avec l'ouverture ou l'appel `ouvrir` (contrats 5.2, point 3, et 5.4, point 1) ; mesuré avec une app d'essai (`run-importer`, quatre
  combinaisons) : le `File` arrive lisible dans le cadre isolé. Les trois formats de Publipostage+ restent grisés (« Pas encore »)
  tant que sa consigne 035 n'est pas faite : l'app d'aujourd'hui prendrait l'appel pour un « Nouveau » et ouvrirait un modèle vierge.
  Le kit (`normalizeOpening`) laisse tomber `importation` : à ajouter à sa prochaine version.
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

**Sans cloner d'abord** (le porteur, 03/11 : « sans cloner les dossiers, juste aller lire sur le GitHub »). L'état de l'app :
`curl -sS https://raw.githubusercontent.com/lombre33/<dépôt>/main/GFS-ETAT.md` ; le sommet de `main` :
`git ls-remote https://github.com/lombre33/<dépôt> refs/heads/main` (dépôts publics, sans jeton ; les noms exacts sont ceux du tableau). Si le sommet
n'est pas le commit que la page dit décrire, les commits entre les deux ne se lisent pas ainsi : l'API et les pages de GitHub sont fermées depuis le
cloud, et `add_repo` ne donne les outils GitHub que contre un jeton d'écriture, à ne pas prendre pour une app. Le dire au porteur, et ne passer aux
étapes 1 à 4 (un clone sans fichiers) que s'il le demande.

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
